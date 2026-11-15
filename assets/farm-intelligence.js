/* AgriVerse — Farm Intelligence screen (no third-party JS dependencies beyond existing Leaflet) */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => '₱' + new Intl.NumberFormat('en-PH', {maximumFractionDigits: 0}).format(n);
  const num = n => typeof n === 'number' && Number.isFinite(n);
  const cap = s => String(s || '').replace(/\b\w/g, x => x.toUpperCase());
  let data = null;
  let map = null;
  let currentCrop = null;
  let assumptions = [];
  let photoRequest = 0;
  let incomeBenchmarks;
  let incomeRequest;
  const incomeAliases = {
    'mung bean': 'mongo',
    'bitter gourd': 'ampalaya',
    'yardlong bean': 'stringbeans',
    'yard-long bean': 'stringbeans',
    'potato': 'white potato',
    'red onion': 'onion (red)',
    'multiplier onion': 'onion (multiplier)'
  };

  const html = `
    <section class="screen" id="screen-farm-intelligence" aria-label="Farm intelligence dashboard">
      <div class="fi-heading">
        <div>
          <button class="fi-back" type="button" data-back="boundary">← Edit farm</button>
          <h2>Your farm</h2>
          <p id="fi-place">Your selected field</p>
        </div>
        
      </div>
      <div class="fi-layout">
        <aside class="fi-column fi-side-left">
          <section class="fi-glass fi-pad">
            <div class="fi-label-row"><h3>◈ Farm specifications</h3><span class="fi-tag">FIELD + GIS</span></div>
            <div class="fi-area"><small>DRAWN LAND AREA</small><strong id="fi-area">—</strong><span>Area is estimated from the drawn polygon</span></div>
            <p id="fi-gis-scope" class="fi-footnote" aria-live="polite"></p>
            <div class="fi-kv"><span>Mapped soil type</span><b id="fi-gis-series">—</b></div>
            <div class="fi-kv"><span>Elevation · SRTM 30 m</span><b id="fi-gis-elevation">—</b></div>
            <div class="fi-kv"><span>Terrain slope</span><b id="fi-gis-slope">—</b></div>
            <details><summary>Soil properties and historical GIS layers</summary>
              <div class="fi-kv"><span>Surface pH</span><b id="fi-gis-ph">—</b></div>
              <div class="fi-kv"><span>Surface texture</span><b id="fi-gis-texture">—</b></div>
              <div class="fi-kv"><span>Soil fertility indicators</span><b id="fi-gis-nutrients">—</b></div>
              <p id="fi-gis-nitrogen" class="fi-footnote"></p>
              <div class="fi-kv"><span>MODIS NDVI</span><b id="fi-gis-ndvi">—</b></div>
              <div class="fi-kv"><span>QGIS raster temperature</span><b id="fi-gis-qgis-temp">—</b></div>
              <div class="fi-kv"><span>QGIS raster rainfall</span><b id="fi-gis-qgis-rain">—</b></div>
            </details>
            <div class="fi-kv"><span>♒ Water access</span><b id="fi-water">Not entered</b></div>
            <div class="fi-kv"><span>☷ Soil moisture</span><b id="fi-moisture">Unavailable</b></div>
            <div class="fi-kv"><span id="fi-temp-label">Air temperature · 2025</span><b id="fi-temp">Not retrieved</b></div>
            <div class="fi-kv"><span id="fi-rain-label">Rainfall · 2025</span><b id="fi-rain">Not retrieved</b></div>
            <p class="fi-footnote" id="fi-data-note">Soil texture and water access are farmer reports, not satellite measurements.</p>
          </section>
          <section class="fi-glass fi-pad fi-risks">
            <div class="fi-label-row"><h3>Weather and hazards</h3></div>
            <section class="avdr-weather" id="avdr-weather" aria-label="Farm weather forecast" hidden></section>
            <p class="fi-muted">Check local advisories before planting, harvesting, or transporting crops.</p>
            <div class="fi-hazard"><span class="fi-hazard-ico">☂</span><div><b>Intense rain & flooding</b><p>Before heavy rain, clear field drains and move inputs and equipment to higher ground. Harvest mature crops early if safe. Never cross a flooded road.</p></div></div>
            <div class="fi-hazard"><span class="fi-hazard-ico">☀</span><div><b>Drought & heat stress</b><p>Before dry or hot days, check your water supply, mulch where suitable, and schedule field work during cooler hours.</p></div></div>
            <div class="fi-hazard"><span class="fi-hazard-ico">≋</span><div><b>Strong wind & storms</b><p>Before strong winds, secure loose equipment and reinforce crop supports while conditions are safe. Follow local evacuation instructions.</p></div></div>
            <a class="fi-source-link" href="https://www.pagasa.dost.gov.ph/" target="_blank" rel="noopener noreferrer">Check official PAGASA advisories ↗</a>
          </section>
          <section class="fi-glass fi-pad fi-access">
            <div class="fi-label-row"><h3>↗ Farm-to-market access</h3><span class="fi-tag">ROADS</span></div>
            <p class="fi-muted">Tap a named road on the map. Before pickup, confirm the route, road condition, and whether your vehicle can pass.</p>
            <p id="fi-road-status" role="status"></p>
            <div class="fi-kv"><span>Road information</span><b>Valencia road layer</b></div>
            <p class="fi-footnote">Check road condition and vehicle access before arranging pickup.</p>
          </section>
        </aside>
        <main class="fi-farm-center">
          <div class="fi-map-viewport">
            <div class="fi-map-top"><span>⌖ YOUR FARM BOUNDARY</span><span id="fi-map-mode">AERIAL · USER-DRAWN</span></div>
            <div id="fi-map" aria-label="Interactive farm map with drawn boundary and selectable road or dated imagery layers"></div>
            <div id="fi-map-placeholder"><div class="fi-placeholder-graphic">🌾</div><b>Farm boundary schematic</b><small>Offline schematic based on your selected coordinates. Not aerial imagery or a verified field measurement.</small></div>
            <div class="fi-map-bottom"><div><b id="fi-map-area">—</b><small>Estimated hectares</small></div><div><b id="fi-map-points">—</b><small>Boundary vertices</small></div><span class="fi-map-note">Drawn outline · check actual field coordinates</span></div>
          </div>
          <section class="fi-monthly-panel" aria-label="Monthly satellite observation explorer">
            <div class="fi-monthly-heading"><div><span class="fi-monthly-eyebrow">◉ EARTH OBSERVATION TIMELINE</span><h3>Monthly farm conditions</h3></div>
              <div class="fi-time-actions"><button id="fi-prev-month" type="button" aria-label="Previous month">‹</button><select id="fi-year" aria-label="Observation year"><option value="2026">2026</option><option value="2025" selected>2025</option><option value="2024">2024</option></select><button id="fi-next-month" type="button" aria-label="Next month">›</button></div>
            </div>
            <div class="fi-month-grid" id="fi-month-buttons" aria-label="Choose observation month"></div>
            <div class="fi-map-layers" role="group" aria-label="Map display mode">
              <button type="button" class="active" data-fi-layer="satellite">◈ Aerial</button>
              <button type="button" data-fi-layer="monthly">◉ Monthly image</button>
            </div>
            <div class="fi-month-stats">
              <div><small>TYPICAL VEGETATION</small><strong id="fi-month-ndvi">Unavailable</strong></div>
              <div><small>RAINFALL</small><strong id="fi-month-rain">Unavailable</strong></div>
              <div><small>RAINFALL SOURCE</small><strong id="fi-month-rain-days">Unavailable</strong></div>
            </div>
            <div class="fi-rain-trend"><div class="fi-rain-trend-head"><span>MONTHLY RAINFALL PATTERN</span><small id="fi-rain-chart-source">Awaiting observations</small></div><div class="fi-rain-chart" id="fi-rain-chart"></div></div>
            <p class="fi-month-status" id="fi-month-status" role="status" aria-live="polite">Choose a month. Pick a month to see rainfall and typical vegetation.</p>
            <div class="fi-month-import"><label class="fi-import-btn" for="fi-month-file">+ Load collected monthly data (.json)</label><input type="file" id="fi-month-file" accept=".json,application/json" hidden><span id="fi-month-source">Source: awaiting observations</span></div>
          </section>
        </main>
        <aside class="fi-column fi-side-right">
          <section class="fi-glass fi-crop fi-pad">
            <div class="fi-label-row"><h3>Crop details</h3><span class="fi-tag" id="fi-evidence-label">EVIDENCE</span></div>
            <div class="fi-photo"><img id="fi-photo-img" alt="" hidden><div id="fi-photo-fallback">🌿</div><span class="fi-photo-caption" id="fi-photo-credit">Crop illustration</span></div>
            <div class="fi-crop-head"><div><h4 id="fi-crop-name">Choose a crop</h4><i id="fi-crop-latin"></i></div><span id="fi-crop-family">—</span></div>
            <div id="fi-sequence" class="fi-sequence" hidden></div>
            <div class="fi-crop-details" id="fi-crop-details"></div>
            <div class="fi-weakness"><b>Watch-outs & limitations</b><p id="fi-crop-weakness">—</p></div>
            <div id="fi-crop-source"></div>
          </section>
          <section class="fi-glass fi-profit fi-pad">
            <div class="fi-label-row"><h3>₱ Estimated farm income</h3></div>
            <div id="fi-psa-income" class="fi-season" aria-live="polite"></div>
            <h4>Use your own prices and costs</h4>
            <p class="fi-muted">Enter your own expected yields, farmgate prices and full costs. No prices or yields are invented.</p>
            <div id="fi-profit-inputs"></div>
            <div class="fi-profit-result">
              <span>ESTIMATED NET RETURN</span>
              <strong id="fi-net">Awaiting inputs</strong>
              <small id="fi-profit-desc">Complete each crop/season to calculate.</small>
            </div>
            <div class="fi-profit-kv"><span>Gross revenue</span><b id="fi-revenue">—</b></div>
            <div class="fi-profit-kv"><span>Variable costs</span><b id="fi-variable">—</b></div>
            <div class="fi-profit-kv"><span>Additional fixed costs</span><b id="fi-fixed">—</b></div>
            <div class="fi-profit-kv"><span>Transport costs</span><b id="fi-transport">—</b></div>
            <div class="fi-profit-kv"><span>Estimated truck trips</span><b id="fi-loads">—</b></div>
            <div class="fi-profit-kv fi-profit-kv-strong"><span>−25% yield scenario</span><b id="fi-conservative">—</b></div>
            <p class="fi-footnote">For ₱/load, enter the actual kg per load. Revenue assumes partial loads are paid proportionally; transport trips are rounded up. Enter all relevant costs. Sequential rotation seasons are summed, not simultaneous.</p>
            <button class="fi-next" id="fi-review" type="button">Continue to plan summary ↗</button>
          </section>
        </aside>
      </div>
    </section>`;

  const analysisSection = $('screen-analysis');
  if (!analysisSection) return;
  analysisSection.insertAdjacentHTML('afterend', html);

  const waterLabels = {rainfed:'Rainfed · access type',irrigated:'Irrigated · access type',limited:'Limited water · reported'};
  const cropById = id => data?.crops?.[id] || null;
  const sequence = () => Array.isArray(data?.sequence) ? data.sequence : [];

  function drawBoundarySchematic() {
    const points=(data?.points||[]).filter(p=>Array.isArray(p)&&Number.isFinite(Number(p[0]))&&Number.isFinite(Number(p[1])));
    const target=$('fi-photo-fallback') && document.querySelector('#fi-map-placeholder .fi-placeholder-graphic');
    if(!target||points.length<3)return;
    const lats=points.map(p=>Number(p[0])),lons=points.map(p=>Number(p[1]));
    const minLat=Math.min(...lats),maxLat=Math.max(...lats),minLon=Math.min(...lons),maxLon=Math.max(...lons);
    const span=Math.max(maxLat-minLat,maxLon-minLon,0.000001);
    const xy=points.map(([lat,lon])=>[100+((Number(lon)-minLon)/span)*360,65+((maxLat-Number(lat))/span)*300]);
    const polygon=xy.map(p=>p.map(v=>v.toFixed(1)).join(',')).join(' ');
    const dots=xy.map(([x,y],i)=>`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="#e6ffb5" stroke="#276a59" stroke-width="2"/>`).join('');
    target.innerHTML=`<svg class="fi-boundary-svg" viewBox="0 0 560 430" role="img" aria-label="Schematic of the saved farm boundary, not aerial imagery">
      <defs><pattern id="fi-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d0f5df" stroke-opacity=".14" stroke-width="1"/></pattern></defs>
      <rect width="560" height="430" rx="20" fill="#164f43"/><rect width="560" height="430" rx="20" fill="url(#fi-grid)"/>
      <polygon points="${polygon}" fill="#8cd3a0" fill-opacity=".38" stroke="#e8ffb0" stroke-width="5" stroke-linejoin="round"/>
      ${dots}<text x="25" y="34" fill="#d4f6e4" font-size="14" font-weight="700" letter-spacing="2">SCHEMATIC · NOT AERIAL</text>
      <text x="523" y="38" fill="#e7ffcc" font-size="16" font-weight="800" text-anchor="end">N ↑</text>
      <text x="280" y="409" fill="#d4f6e4" font-size="13" text-anchor="middle">${points.length} SAVED VERTICES · SHAPE ONLY</text>
    </svg>`;
  }

  function paintFarmMap() {
    if (map) { map.off(); map.remove(); map = null; }
    const p = data?.points || [];
    const placeholder = $('fi-map-placeholder');
    drawBoundarySchematic();
    if (!window.L || p.length < 3) {
      $('fi-map-mode').textContent=data?.boundaryDemo?'SIMULATED · SCHEMATIC':'SCHEMATIC · OFFLINE';
      placeholder.style.display='flex';return;
    }
    placeholder.style.display = 'none';
    try {
      map = L.map('fi-map', {zoomControl: false, scrollWheelZoom:false, preferCanvas: true});
      L.control.zoom({position:'bottomright'}).addTo(map);
      const layer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution:'Imagery © Esri, Maxar, Earthstar Geographics, USDA, USGS and others', maxZoom:19
      });
      let loaded = false;
      layer.on('tileload', () => {loaded=true; placeholder.style.display='none'; $('fi-map-mode').textContent=data?.boundaryDemo?'SIMULATED · AERIAL':'AERIAL · USER-DRAWN';});
      layer.on('tileerror', () => {if(!loaded){placeholder.style.display='flex';$('fi-map-mode').textContent=data?.boundaryDemo?'SIMULATED · SCHEMATIC':'SCHEMATIC · OFFLINE';}});
      layer.addTo(map);
      window.AVGis?.mount(map, true);
      const polygon = L.polygon(p, {color:'#ecffb2',weight:4,fillColor:'#89dfb0',fillOpacity:.22, dashArray:'6 4'}).addTo(map);
      const bounds = polygon.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, {padding:[45,45],maxZoom:18});
      window.AVMonthly?.setMap(map, layer, polygon);
      setTimeout(() => map?.invalidateSize(), 240);
    } catch (e) { console.warn('Farm map:',e); placeholder.style.display='flex'; }
  }

  function setCrop(id) {
    const crop = cropById(id);
    if (!crop) {
      currentCrop = null;
      photoRequest++;
      $('fi-crop-name').textContent = 'No crop selected';
      $('fi-crop-latin').textContent = '';
      $('fi-crop-family').textContent = '';
      $('fi-evidence-label').textContent = '';
      for (const id of ['fi-crop-details','fi-crop-weakness','fi-crop-source','fi-photo-credit','fi-photo-fallback']) $(id).textContent = '';
      $('fi-photo-img').hidden = true;
      return;
    }
    currentCrop = id;
    photoRequest++;
    const requestId = photoRequest;
    $('fi-crop-name').textContent = crop.name || id;
    $('fi-crop-latin').textContent = crop.scientific || 'Scientific name not available';
    $('fi-crop-family').textContent = crop.family || 'Crop';
    $('fi-evidence-label').textContent = crop.verified ? 'FAO ECOCROP' : 'NEEDS VALIDATION';
    const pieces = [];
    if (num(crop.tempMin) && num(crop.tempMax)) pieces.push(['Temperature', `${crop.tempMin}–${crop.tempMax} °C · optimal ecological range`]);
    if (num(crop.phMin) && num(crop.phMax)) pieces.push(['Soil pH', `${crop.phMin}–${crop.phMax} · published ecology, not a soil test`]);
    if (num(crop.annualRainMin) && num(crop.annualRainMax)) pieces.push(['Annual rainfall', `${crop.annualRainMin}–${crop.annualRainMax} mm · NOT crop-cycle water demand`]);
    pieces.push(['Water requirement', crop.water || 'Not validated for this variety']);
    pieces.push(['Growing period', crop.period || 'Variety dependent / not validated']);
    $('fi-crop-details').innerHTML = pieces.map(([a,b]) => `<div><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('');
    let text = crop.verified
      ? `If field conditions fall outside the published ecological temperature or pH range, performance may suffer. A soil test and season-specific assessment are still required. ${crop.note || ''}`
      : 'Ecological requirements and crop-specific vulnerabilities are not yet validated in the database. Confirm with local agronomists before planting.';
    $('fi-crop-weakness').textContent = text + ' Local pests, diseases, drainage and cultivar susceptibility are not yet assessed.';
    const source = $('fi-crop-source');
    source.textContent = '';
    if (crop.verified && /^https:\/\//.test(crop.source || '')) {
      const link = document.createElement('a'); link.href=crop.source; link.target='_blank'; link.rel='noopener noreferrer'; link.className='fi-source-link'; link.textContent='Read crop ecology source ↗'; source.append(link);
    } else {
      source.innerHTML = '<small class="fi-footnote">No validated plant ecology source attached.</small>';
    }
    const img = $('fi-photo-img'), fallback = $('fi-photo-fallback');
    img.hidden = true; img.removeAttribute('src');
    fallback.hidden = false; fallback.textContent = crop.emoji || '🌱';
    $('fi-photo-credit').textContent = 'Crop illustration · photo not loaded';
    if (crop.wiki) {
      const title = encodeURIComponent(crop.wiki);
      fetch(`https://en.wikipedia.org/w/api.php?action=query&titles=${title}&prop=pageimages&format=json&pithumbsize=800&origin=*`)
        .then(r => {if(!r.ok) throw Error('Image lookup failed'); return r.json();})
        .then(js => {
          if (requestId !== photoRequest) return;
          const page = Object.values(js.query?.pages || {})[0];
          const src = page?.thumbnail?.source;
          if (!src || !/^https:\/\//.test(src)) return;
          img.onload = () => {if(requestId === photoRequest){img.hidden=false;fallback.hidden=true;}};
          img.onerror=()=>{img.hidden=true;fallback.hidden=false;};
          img.src = src;
          img.alt = `Photograph associated with ${crop.name}`;
          $('fi-photo-credit').textContent = 'Photo: Wikipedia thumbnail · open crop source for ecology';
        }).catch(() => {});
    }
    document.querySelectorAll('.fi-rotation-button').forEach(btn => btn.classList.toggle('active',btn.dataset.crop===id));
  }

  function renderRotation() {
    const holder = $('fi-sequence'), seq = sequence();
    holder.hidden = data.strategy !== 'rotate';
    if (data.strategy !== 'rotate') {holder.innerHTML=''; return;}
    holder.innerHTML = `<div class="fi-sequence-title">ROTATION · SELECT A CROP TO INSPECT</div><div class="fi-rotation-buttons">${seq.map((id,i)=>{
      const c=cropById(id)||{};
      return `<button type="button" class="fi-rotation-button" data-crop="${esc(id)}" aria-label="Inspect season ${i+1}: ${esc(c.name||id)}"><small>${i+1}</small><span>${esc(c.emoji||'🌱')}</span></button>`;
    }).join('<span class="fi-rotation-arrow">→</span>')}</div>`;
    holder.querySelectorAll('.fi-rotation-button').forEach(btn => btn.addEventListener('click', () => setCrop(btn.dataset.crop)));
  }

  function incomeBenchmark(name) {
    return name.toLowerCase().split('/').map(part => part.trim()).map(part =>
      incomeBenchmarks?.get(Object.hasOwn(incomeAliases, part) ? incomeAliases[part] : part)
    ).find(Boolean);
  }

  function renderIncomeEstimate() {
    const holder = $('fi-psa-income');
    if (!data || !sequence().length || !num(data.area) || data.area <= 0) {
      holder.textContent = 'Select crops and draw your farm to estimate income.';
      return;
    }
    if (!incomeBenchmarks) {
      holder.textContent = 'Loading Philippine Statistics Authority figures…';
      incomeRequest ??= fetch('/api/crops/economics').then(async response => {
        if (!response.ok) throw Error('PSA figures unavailable');
        const {benchmarks} = await response.json();
        incomeBenchmarks = new Map(benchmarks.map(row => [row.commodity.toLowerCase(), row]));
        renderIncomeEstimate();
        calculate();
      }).catch(() => {
        if (data) holder.textContent = 'PSA figures are unavailable. You can enter your own below.';
      }).finally(() => { incomeRequest = undefined; });
      return;
    }
    const estimates = sequence().map(id => {
      const name = cropById(id)?.name || id;
      const benchmark = incomeBenchmark(name);
      const rate = key => benchmark?.[key]?.trim() ? Number(benchmark[key]) : NaN;
      const sales = rate('gross_returns_php_ha');
      const costs = rate('total_costs_php_ha');
      return {name, sales: sales * data.area, costs: costs * data.area};
    });
    const complete = estimates.every(row => Number.isFinite(row.sales) && Number.isFinite(row.costs));
    holder.innerHTML = `<h4>Automatic income estimate</h4>
      <p class="fi-muted">${data.area.toFixed(2)} ha · PSA Philippines averages, 2020</p>
      ${estimates.map((row, i) => `<div class="fi-profit-kv">
        <span>${estimates.length > 1 ? 'Season ' + (i + 1) + ' · ' : ''}${esc(row.name)}</span>
        <b>${Number.isFinite(row.sales) && Number.isFinite(row.costs)
          ? money(row.sales - row.costs) + ' after costs'
          : 'No PSA figures for this crop'}</b></div>
        ${Number.isFinite(row.sales) && Number.isFinite(row.costs)
          ? `<p class="fi-footnote">Sales ${money(row.sales)} · Costs ${money(row.costs)}</p>` : ''}`).join('')}
      ${complete && estimates.length > 1 ? `<div class="fi-profit-kv"><span>Total after costs</span>
        <b>${money(estimates.reduce((total, row) => total + row.sales - row.costs, 0))}</b></div>` : ''}
      <p class="fi-footnote">Use your buyer’s current price and your own costs for a farm-specific estimate.
        <a href="https://psa.gov.ph/publication/production-costs-and-returns-selected-agricultural-commodities" target="_blank" rel="noopener">PSA source</a></p>`;
  }

  function renderProfitInputs() {
    renderIncomeEstimate();
    const seq = sequence();
    if (assumptions.length !== seq.length || assumptions.some((row,i)=>row.crop!==seq[i])) {
      assumptions = seq.map(crop => ({crop,harvest:'',yield:'',price:'',priceMode:'kg',loadKg:'',variable:'',fixed:'0',transportTrip:'0'}));
    }
    $('fi-profit-inputs').innerHTML = assumptions.map((row,i)=>{
      const c = cropById(row.crop) || {};
      return `<div class="fi-season" data-season="${i}"><div class="fi-season-name"><span>${esc(c.emoji||'🌱')} ${esc(c.name||row.crop)}</span><small>SEASON ${i+1}</small></div>
        <div class="fi-input-grid">
          <label>Harvest amount (kg)<input type="number" min="0" step="any" inputmode="decimal" data-field="harvest" value="${esc(row.harvest)}" placeholder="Total kilograms"></label>
          <label>Or yield per hectare (tonnes)<input type="number" min="0" step="any" inputmode="decimal" data-field="yield" value="${esc(row.yield)}" placeholder="Enter"></label>
          <label>Price unit<select data-field="priceMode"><option value="kg" ${row.priceMode==='kg'?'selected':''}>₱ per kg</option><option value="load" ${row.priceMode==='load'?'selected':''}>₱ per load</option></select></label>
          <label>Farmgate selling price<input type="number" min="0" step="any" inputmode="decimal" data-field="price" value="${esc(row.price)}" placeholder="Enter"></label>
          <label>Truck capacity (kg/load)<input type="number" min="0" step="any" inputmode="decimal" data-field="loadKg" value="${esc(row.loadKg)}" placeholder="If applicable"></label>
          <label>Growing costs (₱/ha)<input type="number" min="0" step="any" inputmode="decimal" data-field="variable" value="${esc(row.variable)}" placeholder="Enter"></label>
          <label>Other fixed costs (₱/season)<input type="number" min="0" step="any" inputmode="decimal" data-field="fixed" value="${esc(row.fixed)}" placeholder="0"></label>
          <label class="fi-full-input">Transport expense (₱/truck trip)<input type="number" min="0" step="any" inputmode="decimal" data-field="transportTrip" value="${esc(row.transportTrip)}" placeholder="0 if not applicable"></label>
        </div><p class="fi-live-estimate" id="fi-live-estimate-${i}" aria-live="polite"></p>
        <small class="fi-season-hint">A truck capacity is required for price per load or transport-trip calculations. Do not assume all trucks carry the same weight.</small></div>`;
    }).join('');
    $('fi-profit-inputs').querySelectorAll('input,select').forEach(input => input.addEventListener('input',event => {
      const wrap = event.target.closest('[data-season]');
      assumptions[Number(wrap.dataset.season)][event.target.dataset.field] = event.target.value;
      calculate();
    }));
    $('fi-profit-inputs').querySelectorAll('select').forEach(input => input.addEventListener('change',event => {
      const wrap = event.target.closest('[data-season]');
      assumptions[Number(wrap.dataset.season)][event.target.dataset.field] = event.target.value;
      calculate();
    }));
    calculate();
  }

  function enteredNumber(value) {
    return value != null && String(value).trim() !== '' &&
      Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
  }

  function seasonRevenue(row) {
    const harvest = enteredNumber(row.harvest);
    const yieldPerHectare = enteredNumber(row.yield);
    const harvestKg = harvest ?? (row.harvest === '' && yieldPerHectare !== null
      ? data.area * yieldPerHectare * 1000 : null);
    const loadKg = enteredNumber(row.loadKg);
    const benchmark = incomeBenchmark(cropById(row.crop)?.name || row.crop);
    const useBenchmark = row.price === '' && row.priceMode === 'kg';
    const price = enteredNumber(useBenchmark ? benchmark?.farmgate_price_php_kg : row.price);
    if (harvestKg === null || price === null || (row.priceMode === 'load' && !loadKg)) return null;
    const effectivePriceKg = row.priceMode === 'load' ? price / loadKg : price;
    return {harvestKg, loadKg, effectivePriceKg, revenue: harvestKg * effectivePriceKg,
      benchmarkPrice: useBenchmark};
  }

  function seasonFinances(row, sale) {
    if (!sale) return null;
    const variablePerHa = enteredNumber(row.variable);
    const fixed = enteredNumber(row.fixed);
    const transportTrip = enteredNumber(row.transportTrip);
    if ([variablePerHa, fixed, transportTrip].includes(null) || (transportTrip > 0 && !sale.loadKg)) return null;
    const truckTrips = sale.loadKg ? Math.ceil(sale.harvestKg / sale.loadKg) : 0;
    return {...sale, row, truckTrips, variable: data.area * variablePerHa, fixed,
      transport: truckTrips * transportTrip};
  }

  function financialRows() {
    if (!data || !num(data.area) || data.area <= 0 || !assumptions.length) return null;
    const rows = assumptions.map(row => seasonFinances(row, seasonRevenue(row)));
    return rows.every(Boolean) ? rows : null;
  }

  function calculate() {
    if (data && num(data.area) && data.area > 0) assumptions.forEach((row, index) => {
      const output = $('fi-live-estimate-' + index);
      if (!output) return;
      const sale = seasonRevenue(row);
      const budget = seasonFinances(row, sale);
      output.textContent = !sale ? 'Enter harvest amount and selling price to estimate sales.'
        : 'Estimated sales ' + money(sale.revenue)
          + (sale.benchmarkPrice ? ' using PSA’s 2020 price' : '')
          + (budget ? ' · After costs ' + money(budget.revenue - budget.variable - budget.fixed - budget.transport)
            : ' · Add costs to see estimated profit.');
    });
    const rows = financialRows();
    const keys = ['fi-revenue','fi-variable','fi-fixed','fi-transport','fi-loads','fi-conservative'];
    if (!rows) {
      $('fi-net').textContent='Awaiting inputs'; $('fi-net').classList.remove('fi-negative');
      $('fi-profit-desc').textContent='Add costs for each season to see total profit.';
      keys.forEach(id => $(id).textContent='—'); return;
    }
    const sum = key => rows.reduce((total, item) => total + item[key],0);
    const revenue=sum('revenue'), variable=sum('variable'), fixed=sum('fixed'), transport=sum('transport');
    const net=revenue-variable-fixed-transport;
    const conservative=rows.reduce((total,r)=>{
      const lessKg=r.harvestKg*.75;
      const lessRevenue=lessKg*r.effectivePriceKg;
      const lessTrips=r.loadKg&&lessKg>0?Math.ceil(lessKg/r.loadKg):0;
      return total+lessRevenue-r.variable-r.fixed-lessTrips*Number(r.row.transportTrip);
    },0);
    $('fi-net').textContent=money(net);
    $('fi-net').classList.toggle('fi-negative',net<0);
    $('fi-revenue').textContent=money(revenue);
    $('fi-variable').textContent=money(variable);
    $('fi-fixed').textContent=money(fixed);
    $('fi-transport').textContent=money(transport);
    $('fi-loads').textContent=rows.some(r=>r.loadKg)?String(rows.reduce((t,r)=>t+r.truckTrips,0)):'Not estimated';
    $('fi-conservative').textContent=money(conservative);
    $('fi-profit-desc').textContent=`${rows.length} sequential season(s) · ${data.area.toFixed(2)} ha · ${rows.some(row => row.benchmarkPrice) ? 'includes PSA 2020 prices' : 'your prices'}`;
  }


  window.AVFarm = {
    updateNasa(nasa) {
      if(!data)return;
      data.nasa=nasa;
      window.AVMonthly?.updateNasa(nasa);
      $('fi-temp').textContent = num(nasa?.temp) ? `${nasa.temp.toFixed(1)} °C · gridded` : 'NASA unavailable';
      $('fi-rain').textContent = num(nasa?.rain) ? `${Math.round(nasa.rain)} mm · gridded` : 'NASA unavailable';
    },
    updateCropSelection(context) {
      if (!data) return;
      Object.assign(data, {selected: context.selected, sequence: context.sequence, crops: context.crops});
      renderRotation();
      setCrop(data.selected);
      renderProfitInputs();
    },
    reset() {
      data=null;assumptions=[];currentCrop=null;
      window.AVMonthly?.reset();
      if(map){map.off();map.remove();map=null;}
    },
    open(context) {
      data = context;
      $('fi-place').textContent = (data.location||'Selected farm') + (data.role==='future'?' · educational simulation':'') + (data.boundaryDemo?' · SIMULATED BOUNDARY':'');
      $('fi-area').textContent = `${data.area.toFixed(2)} ha`;
      $('fi-map-area').textContent = data.area.toFixed(2);
      $('fi-map-points').textContent = String(data.points.length);
      $('fi-map-mode').textContent = data.boundaryDemo?'SIMULATED · NOT VERIFIED':'AERIAL · USER-DRAWN';
      $('fi-map-area').nextElementSibling.textContent = data.boundaryDemo?'Simulated hectares':'Estimated hectares';
      $('fi-water').textContent = waterLabels[data.water] || 'Not entered';
      $('fi-moisture').textContent = 'Loading historical SMAP…';

      $('fi-temp').textContent = num(data.nasa?.temp) ? `${data.nasa.temp.toFixed(1)} °C · gridded` : 'NASA unavailable';
      $('fi-rain').textContent = num(data.nasa?.rain) ? `${Math.round(data.nasa.rain)} mm · gridded` : 'NASA unavailable';
      $('fi-data-note').textContent = 'SoilGrids estimates the top 0–5 cm on a 250 m grid. SMAP and MODIS describe the selected barangay and month. QGIS climate layers show historical raster samples for the selected month.';
      window.AVGis?.refresh();
      window.AVMonthly?.open(data);
      renderRotation();
      setCrop(sequence().includes(data.selected) ? data.selected : sequence()[0]);
      renderProfitInputs();
      setTimeout(paintFarmMap, 90);
    },
    getBreakdownRows() {
      if(!data)return [];
      const results=financialRows();
      return assumptions.map((row,i)=>({season:i+1,crop:row.crop,
        harvest_kg:seasonRevenue(row)?.harvestKg ?? enteredNumber(row.harvest),
        yield_tons_ha:row.harvest !== '' ? enteredNumber(row.harvest) / data.area / 1000 : enteredNumber(row.yield),
        price_unit:row.priceMode==='load'?'PHP/load':'PHP/kg',
        price_entered:row.price===''?null:Number(row.price),
        kg_per_load:row.loadKg===''?null:Number(row.loadKg),
        variable_cost_php_ha:row.variable===''?null:Number(row.variable),
        additional_fixed_php_season:row.fixed===''?null:Number(row.fixed),
        transport_php_per_trip:row.transportTrip===''?null:Number(row.transportTrip),
        estimated_truck_trips:results?.[i]?.truckTrips??null,
        revenue_php:results?.[i]?.revenue??null,
        transport_php:results?.[i]?.transport??null
      }));
    },
    getCompleteRows() {
      if (!data || !num(data.area) || data.area<=0) return [];
      const results=financialRows();
      return assumptions.map((row,i) => ({
        yield: results ? String(results[i].harvestKg / data.area / 1000) : row.yield,
        price: results ? String(results[i].effectivePriceKg) : '',
        // Existing summary accepts cost/ha; include transport and fixed cost equivalents.
        cost: results ? String((results[i].variable+results[i].fixed+results[i].transport)/data.area) : ''
      }));
    }
  };
})();
