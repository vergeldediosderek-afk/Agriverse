"""Local-only manual review workflow; approvals are auditable, no automatic approval."""
from pathlib import Path
from datetime import datetime, timezone
import json, os, tempfile, threading
ROOT=Path(__file__).resolve().parent
FILE=ROOT/'data'/'manual_validation.json'
LOCK=threading.RLock()
FIELDS={'mean_temperature_c','annual_rainfall_mm','soil_ph','planting_months','rotation_note','water_note','dataset_review'}
def _load():
    try:return json.loads(FILE.read_text(encoding='utf-8'))
    except FileNotFoundError:return {'records':[]}
def list_records():
    with LOCK:
        return _load()['records']
def save(entry):
    if not isinstance(entry,dict):raise ValueError('Invalid record')
    field=entry.get('field','');barangay=str(entry.get('barangay','')).strip(); crop=str(entry.get('crop','')).strip()
    status=entry.get('status','pending');value=str(entry.get('value','')).strip()
    if field not in FIELDS:raise ValueError('Unknown field')
    if status not in ('pending','approved','rejected'):raise ValueError('Invalid review status')
    if len(value)>300 or len(barangay)>100 or len(crop)>200:raise ValueError('Value too long')
    if field in ('mean_temperature_c','annual_rainfall_mm','soil_ph'):
        try:v=float(value)
        except ValueError:raise ValueError('Numeric value required')
        limits={'mean_temperature_c':(-20,60),'annual_rainfall_mm':(0,15000),'soil_ph':(0,14)}
        lo,hi=limits[field]
        if not lo<=v<=hi:raise ValueError('Value outside acceptable input range')
        if not barangay:raise ValueError('Choose a barangay for this measurement')
    if field=='dataset_review':
        if not value or '/' in value or '\\' in value:raise ValueError('Enter a dataset file name only')
    if field=='planting_months':
        if not crop:raise ValueError('Choose a crop')
        mm=[int(x.strip()) for x in value.split(',') if x.strip()]
        if not mm or any(m<1 or m>12 for m in mm):raise ValueError('Use month numbers separated by commas (1–12)')
        value=','.join(str(x) for x in sorted(set(mm)))
    record={'field':field,'barangay':barangay,'crop':crop,'value':value,'status':status,'source':str(entry.get('source') or '')[:250], 'reviewer':str(entry.get('reviewer') or '')[:100],'notes':str(entry.get('notes') or '')[:500],'updated_utc':datetime.now(timezone.utc).isoformat()}
    if status=='approved' and not record['source']:raise ValueError('An approved value requires a source or field-observation description')
    with LOCK:
        doc=_load(); records=doc['records'];key=(field,barangay.lower(),crop.lower())
        records=[r for r in records if (r['field'],r['barangay'].lower(),r['crop'].lower())!=key];records.append(record)
        pending = None
        try:
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=FILE.parent,
                                             prefix=FILE.stem, suffix='.tmp', delete=False) as stream:
                pending = Path(stream.name)
                json.dump({'records': records}, stream, ensure_ascii=False, indent=2)
            os.replace(pending, FILE)
        finally:
            if pending is not None:
                pending.unlink(missing_ok=True)
    return record

def approved_value(field,barangay='',crop=''):
    selected=None
    for r in list_records():
        if r['status']=='approved' and r['field']==field and r['barangay'].lower()==barangay.lower() and r['crop'].lower()==crop.lower():selected=r
    return selected
