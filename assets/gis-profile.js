(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  let requestKey;
  let pending;
  let current;
  let layerRequest;
  let timer;
  const show = (id, value) => { const item = byId(id); if (item) item.textContent = value; };
  const metric = (value, unit, digits = 1) => value == null ? 'Unavailable' : Number(value).toFixed(digits) + unit;

  function render(data, message) {
    const terrain = data?.terrain || {};
    const soil = data?.soil || {};
    const series = data?.soil_description?.join(' / ') || data?.soil_series?.join(' / ') || 'Unavailable';
    const elevation = metric(terrain.elevation_m, ' m', 0);
    const carbon = metric(soil.organic_carbon_g_kg, ' g/kg');
    const cec = metric(soil.cec_cmolc_kg, ' cmolc/kg');
    const fertility = `Organic carbon ${carbon} · CEC ${cec}`;
    const nutrientNote = 'Soil test needed for nitrogen, phosphorus and potassium.';
    const scope = data ? `${data.barangay} · ${data.basis}${data.spans_barangays ? ' · outline spans barangays' : ''}` : message;
    show('av-gis-terrain', data ? elevation : message);
    show('av-gis-slope', data ? `Slope ${metric(terrain.slope_deg, '°')} · SRTM 30 m` : '');
    show('av-gis-soil', data ? series : message);
    show('av-gis-nutrients', data ? fertility : message);
    show('av-gis-nutrient-note', data ? nutrientNote : '');
    const soilCount = data?.soil_cells?.ph;
    const terrainCount = data?.terrain_cells?.elevation_m;
    const detail = [terrainCount ? 'Terrain averaged across ' + terrainCount + ' map cells' : '',
      soilCount ? 'Soil averaged across ' + soilCount + ' map cells' : ''].filter(Boolean).join(' · ');
    show('av-gis-scope', [scope, detail].filter(Boolean).join(' · '));
    show('fi-gis-scope', scope);
    if (data?.basis === 'Sample inside drawn plot') show('fi-place', data.barangay + ', Valencia City, Bukidnon');
    show('fi-gis-series', series);
    show('fi-gis-elevation', elevation);
    show('fi-gis-slope', metric(terrain.slope_deg, '°'));
    show('fi-gis-ph', metric(soil.ph, ''));
    const texture = soil.clay_pct == null || soil.sand_pct == null || soil.silt_pct == null
      ? 'Unavailable'
      : `Sand ${soil.sand_pct}% · Silt ${soil.silt_pct}% · Clay ${soil.clay_pct}%`;
    show('avc-soil', texture);
    show('fi-gis-texture', texture);
    show('fi-gis-nutrients', fertility);
    show('fi-gis-nitrogen', nutrientNote);
    if (data?.month) {
      show('fi-temp-label', 'Typical planting-month temperature');
      show('fi-rain-label', 'Typical planting-month rainfall');
      show('fi-temp', metric(data.temperature, ' °C'));
      show('fi-rain', metric(data.rainfall, ' mm'));
    }
    show('fi-gis-ndvi', metric(data?.ndvi, '', 2));
    show('fi-gis-qgis-temp', metric(data?.qgis_climate?.temperature_c.mean, ' °C'));
    show('fi-gis-qgis-rain', metric(data?.qgis_climate?.rainfall_mm.mean, ' mm'));
    show('fi-moisture', data?.smap == null
      ? 'No quality-approved readings for this month'
      : `${metric(data.smap, ' m³/m³', 3)} · historical SMAP`);
  }

  async function refresh() {
    clearTimeout(timer);
    const state = window.AVScreeningContext?.().state;
    if (!state) return;
    const month = Number(byId('av-planting-month')?.value) || null;
    const isValencia = state.city === 'Valencia City' && state.province === 'Bukidnon';
    if (!isValencia) {
      pending?.abort();
      requestKey = current = null;
      render(null, 'GIS coverage is available in Valencia City, Bukidnon');
      return;
    }
    const body = JSON.stringify({barangay: state.barangay, points: state.points, demo: !!state.demoOutlineUsed, month});
    if (body === requestKey) {
      if (current) render(current);
      return;
    }
    requestKey = body;
    pending?.abort();
    const controller = new AbortController();
    pending = controller;
    current = null;
    render(null, 'Loading mapped field data…');
    try {
      const response = await fetch('/api/gis/profile', {
        method:'POST', headers:{'Content-Type':'application/json'}, body, signal:controller.signal
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'GIS unavailable');
      if (controller.signal.aborted) return;
      current = result;
      render(result);
      window.dispatchEvent(new Event('agriverse:gis'));
    } catch (error) {
      if (controller.signal.aborted) return;
      requestKey = null;
      render(null, error.message);
    }
  }

  function mount(map, enabled) {
    layerRequest ??= fetch('/api/gis/layers').then(async response => {
      if (!response.ok) throw Error('GIS layers unavailable');
      return response.json();
    }).catch(error => { layerRequest = null; throw error; });
    let removed = false;
    map.once('unload', () => { removed = true; });
    layerRequest.then(data => {
      if (removed) return;
      const boundary = L.geoJSON(data.barangays, {style:{color:'#fbdf88',weight:2,fill:false}, interactive:false});
      const soils = L.geoJSON(data.soil_series, {style:{color:'#90e2b4',weight:1,fillOpacity:.2}, interactive:false});
      L.control.layers(null, {'Valencia barangays':boundary, 'Mapped soil series':soils}, {position:'topright'}).addTo(map);
      if (enabled) boundary.addTo(map);
    }).catch(error => console.warn(error.message));
  }

  window.AVGis = {refresh, mount, current: () => current, schedule() {
    clearTimeout(timer);
    pending?.abort();
    requestKey = current = null;
    timer = setTimeout(refresh, 180);
  }};
  byId('av-planting-month')?.addEventListener('change', refresh);
})();
