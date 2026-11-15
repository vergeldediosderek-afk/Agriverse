"""Local AgriVerse demo server. Python 3.10+, no third-party dependencies.
Run: python server.py, open http://localhost:8899
Not intended for public deployment.
"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlsplit, parse_qs, urlencode
from urllib.request import urlopen, Request
from pathlib import Path
from io import BytesIO
from zipfile import ZipFile, BadZipFile
from xml.etree import ElementTree as ET
import argparse, errno, json, os, re, sqlite3, time, posixpath
from gis_profile import layers as gis_layers, map_start, profile as gis_profile, road_layer, seasonal_observations
from datetime import date, datetime, timedelta, timezone
from html import unescape
from math import ceil
from drive_context import attach_context, psa_benchmarks, source_inventory
from recommendation_engine import analyze as agriverse_analyze, status as agriverse_status, crop_suggestions
from manual_validation import list_records as manual_records, save as manual_save
from data_explorer import datasets as explorer_datasets, rows as explorer_rows

PAGASA_STATIONS_URL = 'https://bagong.pagasa.dost.gov.ph/automated-weather-station'


def valencia_station():
    request = Request(PAGASA_STATIONS_URL, headers={'User-Agent': 'AgriVerse/1.0'})
    with urlopen(request, timeout=8) as response:
        page = response.read(2_000_000).decode('utf-8')
    row = re.search(r'<tr[^>]*>\s*<td[^>]*>\s*5061\s*</td>(.*?)</tr>', page, re.S | re.I)
    cells = re.findall(r'<td[^>]*>(.*?)</td>', row[1], re.S | re.I) if row else []
    cells = [unescape(re.sub(r'<[^>]+>', '', cell)).strip() for cell in cells]
    if len(cells) != 9 or cells[0] != 'Valencia, Bukidnon AWS':
        raise ValueError('Valencia station missing from PAGASA table')
    observed = datetime.strptime(cells[8], '%B %d, %Y, %I:%M %p').replace(
        tzinfo=timezone(timedelta(hours=8)))

    def reading(index):
        value = re.match(r'^(-?\d+(?:\.\d+)?)\s', cells[index])
        return float(value[1]) if value else None

    return {
        'station': cells[0], 'observed_at': observed.isoformat(),
        'temperature_c': reading(1), 'humidity_pct': reading(2),
        'wind_kph': reading(3), 'rain_rate_mm_h': reading(5),
    }


ROOT=Path(__file__).parent
os.chdir(ROOT)
NS={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships','p':'http://schemas.openxmlformats.org/package/2006/relationships'}
CACHE={}

def excel_to_catalog(raw):
    if len(raw)>12_000_000: raise ValueError('File exceeds 12 MB')
    with ZipFile(BytesIO(raw)) as z:
        if sum(i.file_size for i in z.infolist())>30_000_000: raise ValueError('Expanded workbook too large')
        wb=ET.fromstring(z.read('xl/workbook.xml'))
        rel=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        paths={x.attrib.get('Id'):x.attrib.get('Target') for x in rel}
        names={x.attrib['name']:x.attrib.get('{'+NS['r']+'}id') for x in wb.findall('s:sheets/s:sheet',NS)}
        strings=[]
        if 'xl/sharedStrings.xml' in z.namelist():
            root=ET.fromstring(z.read('xl/sharedStrings.xml'))
            strings=[''.join(t.text or '' for t in si.findall('.//s:t',NS)) for si in root.findall('s:si',NS)]
        def read_sheet(name):
            rid=names.get(name)
            if not rid:return []
            target=paths.get(rid,'')
            if target.startswith('/'):path=target.lstrip('/')
            else:path=posixpath.normpath(posixpath.join('xl',target))
            root=ET.fromstring(z.read(path))
            rows=[]
            for row in root.findall('s:sheetData/s:row',NS):
                record={}
                for c in row.findall('s:c',NS):
                    ref=c.attrib.get('r','')
                    letters=re.match(r'([A-Z]+)',ref)
                    if not letters:continue
                    col=0
                    for char in letters.group(1):col=col*26+ord(char)-64
                    v=c.find('s:v',NS)
                    if c.attrib.get('t')=='inlineStr': value=''.join(t.text or '' for t in c.findall('.//s:t',NS))
                    elif v is None:continue
                    elif c.attrib.get('t')=='s':value=strings[int(v.text)]
                    elif c.attrib.get('t') in ('str','e'):value=v.text or ''
                    else:
                        try:value=float(v.text);value=int(value) if value.is_integer() else value
                        except (ValueError,AttributeError):value=v.text
                    record[col]=value
                rows.append(record)
            if not rows:return []
            hdr=rows[0]
            return [{str(hdr.get(i,'')):r.get(i,'') for i in hdr} for r in rows[1:] if r]
        plants=read_sheet('PLANTS'); verify=read_sheet('VALIDATED CROP ECOLOGY')
        vmap={str(x['Crop ID']):x for x in verify if x.get('Crop ID')}
        output=[]
        for r in plants:
            cropid=str(r.get('Crop ID',''))
            if not cropid:continue
            v=vmap.get(cropid)
            item=dict(id=cropid,name=r.get('Plant name',''),scientific=r.get('Scientific name',''),category=r.get('Category',''),family=r.get('Family',''),growth=r.get('Growth system',''),note=r.get('Use / caution',''),verified=bool(v))
            if v:
                for dst,src in {'tempMin':'Opt temp low °C','tempMax':'Opt temp high °C','annualRainMin':'Opt annual rain low mm','annualRainMax':'Opt annual rain high mm','phMin':'Opt soil pH low','phMax':'Opt soil pH high','source':'Source (FAO ECOCROP)'}.items():item[dst]=v.get(src,'')
            output.append(item)
        if len(output)<6:raise ValueError('Workbook has no usable PLANTS worksheet')
        return output

def build_rotation(first, start, slots, next_screen, turnaround=7):
    """Compare a few strong alternatives before committing to the first crop."""
    def rank(plan):
        return (len(plan), len({crop['scientific'].casefold() for crop in plan}),
                sum(crop.get('planning_score', crop['score']) for crop in plan))

    paths = [([], start, first)]
    best = []
    for step in range(slots):
        expanded = []
        for plan, planting, result in paths:
            previous_family = plan[-1]['family'].casefold() if plan else None
            used = {crop['scientific'].casefold() for crop in plan}
            options = [crop for crop in result['recommendations']
                       if crop['shortlist'] and crop['family']
                       and crop['family'].casefold() != previous_family
                       and crop['rotation'] not in ('same family', 'same crop')]
            options.sort(key=lambda crop: crop['scientific'].casefold() in used)
            for crop in options[:3]:
                harvest = planting + timedelta(days=ceil(crop['minimum_growing_days']))
                season = dict(crop, start=planting.isoformat(), earliest_harvest=harvest.isoformat())
                expanded.append(([*plan, season], harvest + timedelta(days=turnaround)))
        if not expanded:
            break
        expanded.sort(key=lambda item: rank(item[0]), reverse=True)
        best = expanded[0][0]
        if step + 1 < slots:
            paths = [(plan, planting, next_screen(planting, plan[-1]['id']))
                     for plan, planting in expanded[:3]]
    return best


class Handler(SimpleHTTPRequestHandler):
    def send_json(self,obj,status=200):
        data=json.dumps(obj,ensure_ascii=False,allow_nan=False).encode()
        self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(data)
    def do_POST(self):
        if urlsplit(self.path).path == '/api/gis/profile':
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= 30000:
                    raise ValueError('Invalid GIS request size')
                query = json.loads(self.rfile.read(size))
                if not isinstance(query, dict):
                    raise ValueError('Expected a GIS request object')
                return self.send_json(gis_profile(query))
            except (ValueError, TypeError) as exc:
                return self.send_json({'error': str(exc)}, 400)
            except (ImportError, OSError, RuntimeError) as exc:
                return self.send_json({'error': 'GIS profile unavailable: ' + str(exc)}, 503)
        if urlsplit(self.path).path=='/api/manual-validation':
            size=int(self.headers.get('Content-Length','0'))
            if size<2 or size>6000:return self.send_json({'error':'Invalid request size'},413)
            try:return self.send_json({'saved':manual_save(json.loads(self.rfile.read(size)))})
            except (ValueError,TypeError,KeyError) as exc:return self.send_json({'error':str(exc)},400)
        if urlsplit(self.path).path=='/api/recommend':
            size=int(self.headers.get('Content-Length','0'))
            if size<1 or size>40000:return self.send_json({'error':'Invalid request length'},413)
            try:
                q=json.loads(self.rfile.read(size))
                if not isinstance(q, dict):
                    raise ValueError('Expected a JSON object')
                barangay = q.get('barangay')
                if barangay is not None and not isinstance(barangay, str):
                    raise ValueError('Invalid barangay')
                month = q['planting_month']
                if isinstance(month, str):
                    month = int(month)
                gis = None
                if q.get('gis_points'):
                    gis = gis_profile({'points': q['gis_points'], 'month': month})
                    barangay = gis['barangay']
                result = agriverse_analyze(
                    barangay, month, q.get('latitude'), q.get('longitude'),
                    str(q.get('previous_crop') or ''), str(q.get('irrigation') or 'unknown'),
                    field_ph=q.get('field_ph'), field_ph_source=q.get('field_ph_source'), gis=gis,
                    year=q.get('planting_year'), available_days=q.get('available_days'),
                    drainage=q.get('drainage', 'unknown'),
                )
                slots = q.get('rotation_slots')
                if slots is not None:
                    if type(slots) is not int or not 2 <= slots <= 5:
                        raise ValueError('Choose two to five rotation seasons')
                    start = date(result['year'] or date.today().year, month, 1)
                    field_turnaround_days = 7

                    def next_screen(planting, previous):
                        return agriverse_analyze(
                            barangay, planting.month, q.get('latitude'), q.get('longitude'),
                            previous_crop=previous, irrigation=str(q.get('irrigation') or 'unknown'),
                            field_ph=q.get('field_ph'), field_ph_source=q.get('field_ph_source'),
                            gis=gis, year=planting.year, available_days=q.get('available_days'),
                            start_day=planting.day, include_research=False, drainage=q.get('drainage', 'unknown'),
                        )

                    result['rotation_plan'] = build_rotation(
                        result, start, slots, next_screen, field_turnaround_days)
                    result['field_turnaround_days'] = field_turnaround_days
                    result['rotation_slots'] = slots
                return self.send_json(attach_context(result))
            except (ValueError,TypeError,KeyError,OverflowError) as exc:return self.send_json({'error':str(exc)},400)
            except Exception as exc:return self.send_json({'error':'Dataset error: '+str(exc)},500)
        if urlsplit(self.path).path!='/api/import':return self.send_json({'error':'Unknown endpoint'},404)
        size=int(self.headers.get('Content-Length','0'))
        if size<1 or size>12_000_000:return self.send_json({'error':'Invalid file size'},413)
        raw=self.rfile.read(size)
        try:self.send_json(excel_to_catalog(raw))
        except (BadZipFile,ET.ParseError,KeyError,ValueError) as exc:self.send_json({'error':str(exc)},400)
    def do_GET(self):
        parsed = urlsplit(self.path)
        if parsed.path == '/api/gis/roads':
            try:
                return self.send_json(road_layer())
            except (ImportError, OSError, RuntimeError) as exc:
                return self.send_json({'error': 'Valencia road layer unavailable'}, 503)
        if parsed.path == '/api/gis/seasons':
            query = parse_qs(parsed.query)
            try:
                return self.send_json(seasonal_observations(query.get('barangay', [''])[0], int(query.get('year', ['2025'])[0])))
            except ValueError as exc:
                return self.send_json({'error': str(exc)}, 400)
        if parsed.path == '/api/crops/economics':
            try:
                return self.send_json({'benchmarks': psa_benchmarks()})
            except (OSError, sqlite3.Error):
                return self.send_json({'error': 'PSA income figures unavailable'}, 503)
        if parsed.path == '/api/crops/suggest':
            query = parse_qs(parsed.query).get('q', [''])[0][:80]
            return self.send_json({'crops': crop_suggestions(query)})
        if parsed.path == '/api/gis/map-start':
            query = parse_qs(parsed.query)
            try:
                return self.send_json(map_start(query.get('barangay', [''])[0], query.get('locality', [''])[0]))
            except ValueError as exc:
                return self.send_json({'error': str(exc)}, 400)
        if urlsplit(self.path).path == '/api/gis/layers':
            try:
                return self.send_json(gis_layers())
            except (ImportError, OSError, RuntimeError) as exc:
                return self.send_json({'error': 'GIS layers unavailable: ' + str(exc)}, 503)
        if urlsplit(self.path).path == '/api/drive-sources':
            try:
                return self.send_json(source_inventory())
            except (OSError, ValueError) as exc:
                return self.send_json({'error': str(exc)}, 500)
        if urlsplit(self.path).path=='/api/manual-validation':return self.send_json({'records':manual_records()})
        if urlsplit(self.path).path=='/api/data-explorer/datasets':
            try:return self.send_json({'datasets':explorer_datasets()})
            except Exception as exc:return self.send_json({'error':str(exc)},500)
        if urlsplit(self.path).path=='/api/data-explorer/rows':
            try:
                q=parse_qs(urlsplit(self.path).query)
                get=lambda k,d='':q.get(k,[d])[0]
                return self.send_json(explorer_rows(get('table'),get('page','1'),get('size','50'),get('column') or None,get('query'),get('sort') or None,get('descending')=='true'))
            except (ValueError,TypeError) as exc:return self.send_json({'error':str(exc)},400)
            except Exception as exc:return self.send_json({'error':str(exc)},500)
        if urlsplit(self.path).path == '/api/datasets/status':
            try:return self.send_json(agriverse_status())
            except Exception as exc:return self.send_json({'error':str(exc)},500)
        if parsed.path == '/api/weather/pagasa':
            key = 'pagasa-valencia'
            if key in CACHE and time.time() - CACHE[key][0] < 300:
                return self.send_json(CACHE[key][1])
            try:
                observation = valencia_station()
            except (OSError, ValueError):
                return self.send_json({'error': 'PAGASA station unavailable'}, 502)
            CACHE[key] = (time.time(), observation)
            return self.send_json(observation)
        if parsed.path == '/api/weather':
            try:
                q = parse_qs(urlsplit(self.path).query)
                lat = float(q['latitude'][0])
                lon = float(q['longitude'][0])
                if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                    raise ValueError('Invalid coordinates')
                key = ('weather', round(lat, 3), round(lon, 3))
                if key in CACHE and time.time() - CACHE[key][0] < 600:
                    return self.send_json(CACHE[key][1])
                params = {
                    'latitude': f'{lat:.5f}',
                    'longitude': f'{lon:.5f}',
                    'current': 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m',
                    'daily': 'temperature_2m_min,temperature_2m_max,precipitation_probability_max,precipitation_sum',
                    'forecast_days': 5,
                    'timezone': 'Asia/Manila'
                }
                url = 'https://api.open-meteo.com/v1/forecast?' + urlencode(params)
                request = Request(url, headers={'User-Agent': 'AgriVerse-educational-demo/1.0'})
                with urlopen(request, timeout=15) as response:
                    payload = json.loads(response.read(500_000))
                current = payload.get('current')
                if not isinstance(current, dict) or 'time' not in current:
                    raise ValueError('Weather provider did not return current data')
                result = {
                    'source': 'Open-Meteo',
                    'data_type': 'Current weather-model estimate, not a farm sensor measurement',
                    'current': current,
                    'daily': payload.get('daily', {}),
                    'units': payload.get('current_units', {}),
                    'timezone': payload.get('timezone', 'Asia/Manila')
                }
                CACHE[key] = (time.time(), result)
                return self.send_json(result)
            except Exception as exc:
                return self.send_json({'error': 'Current weather unavailable: ' + str(exc)}, 502)
        if urlsplit(self.path).path!='/api/nasa':return super().do_GET()
        try:
            q=parse_qs(urlsplit(self.path).query)
            lat=float(q['latitude'][0]);lon=float(q['longitude'][0]);
            if not(-90<=lat<=90 and -180<=lon<=180):raise ValueError('Invalid coordinates')
            # avoid redundant calls for identical rounded request coordinates only
            key=(round(lat,4),round(lon,4))
            if key in CACHE and time.time()-CACHE[key][0]<86400:return self.send_json(CACHE[key][1])
            params={'parameters':'T2M,T2M_MAX,T2M_MIN,PRECTOTCORR','community':'AG','longitude':f'{lon:.5f}','latitude':f'{lat:.5f}','start':'20200101','end':'20251231','format':'JSON'}
            url='https://power.larc.nasa.gov/api/temporal/daily/point?'+urlencode(params)
            req=Request(url,headers={'User-Agent':'AgriVerse-hackathon-demo/1.0'})
            with urlopen(req,timeout=35) as res:
                if res.status!=200:raise ValueError('Upstream NASA response unavailable')
                data=json.loads(res.read(4_000_000))
            if 'properties' not in data:raise ValueError('NASA did not return expected data')
            CACHE[key]=(time.time(),data);self.send_json(data)
        except Exception as exc:self.send_json({'error':str(exc)},502)

if __name__=='__main__':
    parser = argparse.ArgumentParser()
    # Hosting platforms such as Render supply PORT and need a public bind address.
    hosted = 'PORT' in os.environ
    parser.add_argument('--port', type=int, default=int(os.environ.get('PORT', 8899)))
    parser.add_argument('--host', default=os.environ.get('HOST', '0.0.0.0' if hosted else '127.0.0.1'))
    args = parser.parse_args()
    try:
        server = ThreadingHTTPServer((args.host, args.port), Handler)
    except OSError as exc:
        if hosted or (exc.errno != errno.EADDRINUSE and getattr(exc, 'winerror', None) != 10048):
            raise
        print(f'Port {args.port} is in use. Starting this AgriVerse project on a free port.')
        server = ThreadingHTTPServer((args.host, 0), Handler)
    with server:
        print(f'AgriVerse ({ROOT}): http://{args.host}:{server.server_port}', flush=True)
        server.serve_forever()
