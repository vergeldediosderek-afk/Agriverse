/* AgriVerse Monthly Earth Observation Explorer
 * Future-ready, data-honest: dated, georeferenced imagery only.
 * Road map is an OSM reference, NOT a verified farm-to-market route.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  if (!$('fi-month-buttons')) return;
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  let year = 2025, month = 1, mode = 'satellite';
  let farm = null, map = null, aerial = null, polygon = null, roads = null, monthlyLayer = null;
  let dataset = {schema:'agriverse-monthly-v1',records:[]};
  let imported = false, datasetLoaded = false, loadPromise = null;
  let mapLoadToken = 0;
  let roadRequest, seasonKey, seasonData, seasonRequest;
  const num = n => typeof n === 'number' && Number.isFinite(n);
  const farmCenter = () => {
    const points = farm?.points;
    if (!Array.isArray(points) || points.length < 3) return null;
    return [points.reduce((s,p)=>s+Number(p[0]),0)/points.length,
            points.reduce((s,p)=>s+Number(p[1]),0)/points.length];
  };
  function validBounds(b) {
    return Array.isArray(b) && b.length === 2 && b.every(p=>Array.isArray(p)&&p.length===2&&p.every(v=>num(v)))
      && b[0][0]<b[1][0] && b[0][1]<b[1][1] && b[0][0]>=-90 && b[1][0]<=90
      && b[0][1]>=-180 && b[1][1]<=180;
  }
  function includesFarm(bounds) {
    const center = farmCenter();
    return center && validBounds(bounds) && center[0]>=bounds[0][0] && center[0]<=bounds[1][0]
      && center[1]>=bounds[0][1] && center[1]<=bounds[1][1];
  }
  function safeImageUrl(s) {
    if (typeof s!=='string' || s.length>1800) return false;
    return /^https:\/\/[^\s<>"']+$/i.test(s) || /^assets\/monthly\/[\w.\/-]+\.(?:png|jpg|jpeg|webp)$/i.test(s) && !s.includes('..');
  }
  function observation() {
    const rows = Array.isArray(dataset?.records) ? dataset.records : [];
    return rows.find(r=>r && Number(r.year)===year && Number(r.month)===month && includesFarm(r.farm_bounds)) || null;
  }
  function imageInfo(rec) {
    const im = rec?.imagery;
    if (!im || !validBounds(im.bounds) || !includesFarm(im.bounds) || !safeImageUrl(im.url)
      || typeof im.source!=='string' || !im.source.trim() || typeof im.acquired_on!=='string') return null;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(im.acquired_on) ? new Date(im.acquired_on+'T00:00:00Z') : null;
    if (!date || Number.isNaN(date.getTime()) || date.getUTCFullYear()!==year || date.getUTCMonth()+1!==month) return null;
    return im;
  }
  function status(message, source='') {
    $('fi-month-status').textContent=message;
    $('fi-month-source').textContent=source || (imported?'Imported dataset · farm coverage checked':'Source: awaiting observations');
  }
  function localRain(m) {
    const value = seasonData?.months[m-1]?.rain_mm;
    return num(value) ? {total_mm:value, source:'CHIRPS'} : null;
  }
  async function loadSeason() {
    const name = window.AVGis?.current()?.barangay || window.AVScreeningContext?.().state.barangay;
    const state = window.AVScreeningContext?.().state;
    if (!farm || !name || state?.city !== 'Valencia City' || state?.province !== 'Bukidnon') return;
    const key = new URLSearchParams({barangay:name,year}).toString();
    if (key === seasonKey) return;
    seasonKey = key;
    seasonData = null;
    seasonRequest?.abort();
    const controller = new AbortController();
    seasonRequest = controller;
    try {
      const response = await fetch('/api/gis/seasons?' + key, {signal:controller.signal});
      if (!response.ok) throw Error('Monthly observations unavailable');
      const data = await response.json();
      if (!controller.signal.aborted) { seasonData = data; setStats(); }
    } catch { if (!controller.signal.aborted) seasonKey = null; }
  }
  window.addEventListener('agriverse:gis', loadSeason);
  function nasaRainForMonth(m=month,y=year) {
    const nasa=farm?.nasa, center=farmCenter();
    if (!nasa || !center || !num(nasa.lat) || !num(nasa.lon)
        || Math.abs(center[0]-nasa.lat)>.02 || Math.abs(center[1]-nasa.lon)>.02) return null;
    const total=nasa.monthlyRainByYear?.[y]?.[m-1] ?? (y===2025?nasa.monthlyRain?.[m-1]:null);
    const days=nasa.monthlyRainDaysByYear?.[y]?.[m-1];
    if (!num(total) || total<0) return null;
    return {total_mm:total,rainy_days:Number.isInteger(days)?days:null,
      source:'NASA POWER · historical gridded daily precipitation, ≥90% completeness'};
  }
  function validMonthlyMetric(metric,m=month,y=year) {
    return metric && typeof metric.source==='string' && metric.source.trim()
      && metric.period===`${y}-${String(m).padStart(2,'0')}`;
  }
  function renderRainChart() {
    const holder=$('fi-rain-chart');
    const values=MONTHS.map((_,i)=>{
      const fromRecord=(dataset?.records||[]).find(r=>r&&Number(r.year)===year&&Number(r.month)===i+1&&includesFarm(r.farm_bounds)&&validMonthlyMetric(r.rainfall,i+1,year)&&num(r.rainfall.total_mm)&&r.rainfall.total_mm>=0);
      return fromRecord?.rainfall.total_mm ?? localRain(i+1)?.total_mm ?? nasaRainForMonth(i+1,year)?.total_mm ?? null;
    });
    const available=values.filter(num);
    if (!available.length) {
      holder.innerHTML='<p class="fi-rain-empty">No monthly rainfall series loaded for this farm and year.</p>';
      $('fi-rain-chart-source').textContent='Data not connected';return;
    }
    const maximum=Math.max(1,...available);
    holder.replaceChildren();
    values.forEach((v,i)=>{
      const b=document.createElement('button');b.type='button';b.className='fi-rain-bar'+(i+1===month?' selected':'');
      b.setAttribute('aria-label',`${MONTHS[i]}: ${num(v)?v.toFixed(1)+' mm':'no rainfall data'}`);
      b.title=`${MONTHS[i]}: ${num(v)?v.toFixed(1)+' mm':'not available'}`;
      const bar=document.createElement('span');bar.className='fi-rain-bar-fill';
      bar.style.height=num(v)?`${Math.max(4,Math.round(v/maximum*42))}px`:'3px';
      if(!num(v))b.classList.add('missing');
      const text=document.createElement('small');text.textContent=MONTHS[i];
      b.append(bar,text);b.addEventListener('click',()=>selectMonth(i+1));holder.append(b);
    });
    $('fi-rain-chart-source').textContent=seasonData ? 'CHIRPS · ' + year : 'Monthly rainfall · ' + year;
  }
  function setStats() {
    const rec = observation();
    const ndvi = validMonthlyMetric(rec?.ndvi) ? rec.ndvi : null;
    const rain = validMonthlyMetric(rec?.rainfall) ? rec.rainfall : localRain(month) || nasaRainForMonth();
    $('fi-month-ndvi').textContent=num(ndvi?.mean)&&ndvi.mean>=-1&&ndvi.mean<=1&&ndvi.source
      ? ndvi.mean.toFixed(2) : num(seasonData?.months[month-1]?.typical_ndvi) ? seasonData.months[month-1].typical_ndvi.toFixed(2) + ' · MODIS' : 'Unavailable';
    $('fi-month-rain').textContent=num(rain?.total_mm)&&rain.total_mm>=0&&rain.source
      ? rain.total_mm.toLocaleString('en-PH',{maximumFractionDigits:1})+' mm' : 'Not connected';
    $('fi-month-rain-days').textContent = rain ? (rain.source === 'CHIRPS' ? 'CHIRPS' : validMonthlyMetric(rec?.rainfall) ? 'Imported' : 'NASA POWER') : 'Unavailable';
    $('fi-month-buttons').querySelectorAll('button').forEach(btn=>{
      const m=Number(btn.dataset.month);
      btn.classList.toggle('selected',m===month);
      btn.setAttribute('aria-pressed',String(m===month));
      const any = (dataset?.records||[]).some(r=>r&&Number(r.year)===year&&Number(r.month)===m&&includesFarm(r.farm_bounds)
        && (imageInfoForMonth(r,m) || num(r.ndvi?.mean)&&validMonthlyMetric(r.ndvi,m,year) || num(r.rainfall?.total_mm)&&validMonthlyMetric(r.rainfall,m,year)));
      btn.classList.toggle('has-data',Boolean(any || localRain(m) || nasaRainForMonth(m,year)));
    });
    renderRainChart();
  }
  function imageInfoForMonth(rec,m) {
    const im=rec?.imagery;
    if (!im || !validBounds(im.bounds) || !includesFarm(im.bounds) || !safeImageUrl(im.url)
      || !im.source || !/^\d{4}-\d{2}-\d{2}$/.test(im.acquired_on||'')) return false;
    const d=new Date(im.acquired_on+'T00:00:00Z');
    return !Number.isNaN(d.getTime()) && d.getUTCFullYear()===year && d.getUTCMonth()+1===m;
  }
  function clearMonthly() {
    mapLoadToken++; // Ignore stale image-loading errors after switching months or layers.
    if (map && monthlyLayer && map.hasLayer(monthlyLayer)) map.removeLayer(monthlyLayer);
    monthlyLayer=null;
  }
  function showMap() {
    const rec=observation(), im=imageInfo(rec);
    const imageButton = document.querySelector('[data-fi-layer=monthly]');
    if (imageButton) imageButton.hidden = !im;
    if (mode === 'monthly' && !im) mode = 'satellite';
    document.querySelectorAll('[data-fi-layer]').forEach(b=>{
      const selected=b.dataset.fiLayer===mode;
      b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));
    });
    clearMonthly();
    if (!map || !window.L) {
      if (mode==='roads' && $('fi-road-status')) $('fi-road-status').textContent='Roads appear once the interactive map loads.';
      $('fi-map-mode').textContent='OFFLINE · SAVED BOUNDARY';
      status(mode==='roads'
        ? 'Road-map tiles are unavailable offline. No access route or distance has been computed.'
        : `Showing the saved boundary schematic. ${MONTHS[month-1]} ${year} imagery requires a dated satellite layer and an online map.`,
        rec ? 'Collected record for this farm; map imagery unavailable' : nasaRainForMonth() ? 'NASA POWER gridded monthly rainfall available · imagery not connected' : 'No monthly record for this farm');
      return;
    }
    if (roads && map.hasLayer(roads)) map.removeLayer(roads);

    if (aerial && !map.hasLayer(aerial)) aerial.addTo(map);
    if (mode==='roads') {
      const targetMap = map;
      const roadStatus = $('fi-road-status');
      if (roadStatus) roadStatus.textContent = 'Loading Valencia roads…';
      roadRequest ??= fetch('/api/gis/roads').then(response => {
        if (!response.ok) throw Error('Road layer unavailable');
        return response.json();
      }).catch(error => { roadRequest = null; throw error; });
      roadRequest.then(data => {
        if (map !== targetMap || mode !== 'roads') return;
        if (!roads) roads = L.geoJSON(data, {
          renderer:L.canvas(), style:feature=>({color:feature.properties.highway==='track'?'#ffe6a0':'#63f3ff',weight:2,opacity:.9}),
          onEachFeature(feature,layer){
            if (!feature.properties.name) return;
            const label=document.createElement('span');
            label.textContent=feature.properties.name;
            layer.bindTooltip(label);
            layer.bindPopup(label.cloneNode(true));
          }
        });
        roads.addTo(map);
        polygon?.bringToFront?.();
        if (roadStatus) roadStatus.textContent = 'Valencia roads shown on the map.';

      }).catch(() => { if (roadStatus) roadStatus.textContent = 'Could not load Valencia roads. Try again.'; });
      $('fi-map-mode').textContent='VALENCIA ROADS';
      status('Valencia roads and tracks', 'Source: Valencia road layer');
    } else if (mode==='monthly' && im) {
      try {
        const token=++mapLoadToken;
        monthlyLayer=L.imageOverlay(im.url,im.bounds,{opacity:.90,interactive:false,alt:`Satellite image acquired ${im.acquired_on}`});
        monthlyLayer.on('error',()=>{
          if(token!==mapLoadToken)return;
          clearMonthly();$('fi-map-mode').textContent='MONTHLY IMAGE · FAILED';
          status(`The ${MONTHS[month-1]} ${year} image could not load. Aerial basemap remains visible, and is not month-specific.`,
            'Expected source: '+im.source);
        });
        monthlyLayer.addTo(map);
        $('fi-map-mode').textContent='DATED IMAGE · '+im.acquired_on;
        status(`Image acquired ${im.acquired_on} · ${im.source}. NDVI and rainfall values are independent observations; visible greenness cannot identify a crop by itself.`,
          'Source: '+im.source+(num(im.cloud_cover_pct)?` · ${im.cloud_cover_pct}% reported cloud cover`:''));
      } catch (_) {
        $('fi-map-mode').textContent='MONTHLY IMAGE · UNAVAILABLE';
        status('The dated image could not be displayed. Aerial basemap is not month-specific.');
      }
    } else {
      $('fi-map-mode').textContent=mode==='monthly'?'NO DATED IMAGE':'AERIAL · NOT TIME-SERIES';
      if (mode==='monthly') {
        status(`No verified, georeferenced image for ${MONTHS[month-1]} ${year} covering this farm. The underlying aerial map does NOT represent this month.`,
          rec ? 'Record found · dated imagery not supplied' : nasaRainForMonth() ? 'NASA POWER gridded rainfall only · no dated imagery' : 'No monthly observations for this farm');
      } else {
        status(`Aerial map for orientation. Rainfall is shown for the selected year. Vegetation shows typical monthly MODIS values.`,
          rec ? 'Collected monthly record available · inspect Monthly image' : nasaRainForMonth() ? 'NASA POWER gridded rainfall available · imagery date unspecified' : 'Source: aerial basemap · acquisition date unspecified');
      }
    }
    polygon?.bringToFront?.();
    setTimeout(()=>map?.invalidateSize(),90);
  }
  function render() {
    $('fi-year').value=String(year);
    loadSeason();setStats();showMap();
  }
  function selectMonth(nextMonth,nextYear=year) {
    if (nextMonth<1) {nextMonth=12;nextYear--;}
    if (nextMonth>12) {nextMonth=1;nextYear++;}
    const available=[...$('fi-year').options].map(o=>Number(o.value));
    if (!available.includes(nextYear)) return;
    month=nextMonth;year=nextYear;render();
  }
  const holder=$('fi-month-buttons');
  MONTHS.forEach((name,i)=>{
    const button=document.createElement('button');
    button.type='button';button.textContent=name;button.dataset.month=String(i+1);
    button.setAttribute('aria-label',`Show ${name} observations`);
    button.addEventListener('click',()=>selectMonth(i+1));holder.append(button);
  });
  const years=$('fi-year');
  years.replaceChildren();
  for(let y=2025;y>=2016;y--){const opt=new Option(String(y),String(y));years.add(opt);}
  year=Math.min(2025,new Date().getFullYear());
  years.value=String(year);
  $('fi-prev-month').addEventListener('click',()=>selectMonth(month-1));
  $('fi-next-month').addEventListener('click',()=>selectMonth(month+1));
  years.addEventListener('change',()=>{year=Number(years.value);render();});
  document.querySelectorAll('[data-fi-layer]').forEach(btn=>btn.addEventListener('click',()=>{mode=btn.dataset.fiLayer;showMap();}));
  $('fi-month-file').addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return;
    if(file.size>2_000_000){status('File too large. Maximum 2 MB.');return;}
    try {
      const raw=JSON.parse(await file.text());
      if(raw?.schema!=='agriverse-monthly-v1'||!Array.isArray(raw.records)||raw.records.length>2000) throw Error('Use schema agriverse-monthly-v1 with a records array (max 2,000).');
      dataset=raw;imported=true;datasetLoaded=true;render();
      $('fi-month-source').textContent=`Loaded ${raw.records.length} observation records · ${file.name}`;
    } catch (err) {status('Could not import monthly observations: '+err.message);}
    e.target.value='';
  });
  async function loadStatic() {
    if(datasetLoaded || imported) return;
    if(!loadPromise) loadPromise=fetch('assets/monthly-observations.json',{cache:'no-store'})
      .then(r=>{if(!r.ok)throw Error('Missing monthly template');return r.json();})
      .then(js=>{if(js?.schema==='agriverse-monthly-v1'&&Array.isArray(js.records)&&!imported){dataset=js;datasetLoaded=true;}})
      .catch(()=>{datasetLoaded=true;});
    await loadPromise;
    if(farm)render();
  }
  window.AVMonthly={
    setRoads(enabled){
      if (enabled && mode !== 'roads') { mode = 'roads'; showMap(); }
      if (!enabled && mode === 'roads') { mode = 'satellite'; showMap(); }
    },
    open(context){
      farm=context;
      // Month records are linked to their geographic bounds, never a barangay name.
      render();loadStatic();
    },
    updateNasa(nasa){if(farm){farm.nasa=nasa;render();}},
    setMap(nextMap,baseLayer=null,boundary=null){
      if(map && map!==nextMap)clearMonthly();
      map=nextMap;aerial=baseLayer;polygon=boundary;roads=null;
      if(map)showMap();
    },
    reset(){clearMonthly();map=null;aerial=null;polygon=null;roads=null;farm=null;seasonRequest?.abort();seasonKey=null;seasonData=null;},
    // For later integration with an authenticated satellite processing service.
    setObservations(payload){
      if(payload?.schema!=='agriverse-monthly-v1'||!Array.isArray(payload.records))return false;
      dataset=payload;datasetLoaded=true;imported=true;render();return true;
    },
    getSelection(){return {year,month,mode,record:observation()};}
  };
})();
