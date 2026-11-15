/* Historical crop screening in the existing Analysis screen. */
(() => {
  'use strict';
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const weatherBadge = document.getElementById('top-weather');
  const weatherLabel = document.getElementById('weather-status');
  const weatherSource = document.getElementById('weather-source');
  const weatherRefreshMs = 300000;
  let stationRequest;
  let stationLoadedAt = 0;
  let badgeTimer;

  function loadValenciaStation() {
    if (stationRequest && (!stationLoadedAt || Date.now() - stationLoadedAt < weatherRefreshMs)) {
      return stationRequest;
    }
    stationLoadedAt = 0;
    stationRequest = fetch('/api/weather/pagasa').then(async response => {
      if (!response.ok) throw Error('Station unavailable');
      const station = await response.json();
      if (!Number.isFinite(Date.parse(station.observed_at))) throw Error('Station timestamp unavailable');
      stationLoadedAt = Date.now();
      return station;
    }).catch(error => {
      stationRequest = undefined;
      throw error;
    });
    return stationRequest;
  }

  function stationTimestamp(station) {
    return new Date(station.observed_at).toLocaleString('en-PH', {
      timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short'
    });
  }

  function stationDelayed(station) {
    return Date.now() - Date.parse(station.observed_at) > 3600000;
  }

  async function refreshWeatherBadge() {
    clearTimeout(badgeTimer);
    try {
      const station = await loadValenciaStation();
      if (!Number.isFinite(station.temperature_c)) throw Error('Temperature unavailable');
      const delayed = stationDelayed(station);
      weatherLabel.textContent = `${Math.round(station.temperature_c)} °C${delayed ? ' · Delayed' : ''}`;
      weatherSource.textContent = 'VALENCIA · PAGASA';
      weatherBadge.title = `PAGASA Valencia station · ${stationTimestamp(station)} Philippine time`;
    } catch {
      weatherLabel.textContent = 'Weather unavailable';
      weatherSource.textContent = 'PAGASA';
      weatherBadge.removeAttribute('title');
    } finally {
      clearTimeout(badgeTimer);
      if (!document.hidden) badgeTimer = setTimeout(refreshWeatherBadge, weatherRefreshMs);
    }
  }

  if (weatherBadge && weatherLabel && weatherSource) {
    refreshWeatherBadge();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearTimeout(badgeTimer);
      else refreshWeatherBadge();
    });
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const lookup = value => String(value ?? '').trim().toLowerCase();
  const analysis = document.getElementById('screen-analysis');
  const anchor = document.getElementById('plot-suitability');
  const dashboard = document.getElementById('screen-farm-intelligence');
  if (!analysis || !anchor || !dashboard) return;

  document.getElementById('av-planting-year')?.addEventListener('change', () => run());
  const host = document.createElement('section');
  host.id = 'av-dataset-recommendations';
  host.className = 'avdr';
  host.innerHTML = `<div class="avdr-head"><div><b>Recommended crops</b></div></div>
    <fieldset class="avdr-window"><legend>Days available per crop</legend>
      <div><button type="button" data-grow-days="90">90 days</button><button type="button" data-grow-days="120">120 days</button><button type="button" data-grow-days="180">180 days</button><button type="button" data-grow-days="" aria-pressed="true">No limit</button></div>
    </fieldset>
    <details class="avdr-details"><summary>Change growing time, last crop or drainage</summary><div class="avdr-controls"><label>Barangay<select id="avdr-barangay" disabled><option value="">Loading…</option></select></label>
    <label>Previous crop (optional)<input id="avdr-previous" list="av-crop-suggestions" maxlength="80" autocomplete="off" placeholder="Type a crop name" /></label>
    <label>Does water stay on the field after rain?<select id="avdr-drainage"><option value="unknown">Not sure</option><option value="well">No, it drains well</option><option value="poorly">Yes, the soil stays wet</option></select></label>
    <label>How many days can you grow? (optional)<input id="avdr-days" type="number" min="1" max="3650" placeholder="e.g. 90"></label><button id="avdr-run" type="button" disabled>Analyze crops</button></div></details>
    <div id="avdr-results" aria-live="polite">Loading farm data…</div>`;
  const dashboardGrid = dashboard.querySelector('.fi-layout');
  if (dashboardGrid) dashboardGrid.before(host);
  else anchor.before(host);
  const barangay = host.querySelector('#avdr-barangay');
  const previous = host.querySelector('#avdr-previous');
  const dayInput = host.querySelector('#avdr-days');
  const drainage = host.querySelector('#avdr-drainage');
  const windows = [...host.querySelectorAll('[data-grow-days]')];
  function syncWindows() {
    for (const button of windows) button.setAttribute('aria-pressed', String(button.dataset.growDays === dayInput.value));
  }
  for (const button of windows) button.addEventListener('click', () => {
    window.AVScreeningContext?.().soundEffect('tap');
    dayInput.value = button.dataset.growDays;
    syncWindows();
    run(true);
  });
  dayInput.addEventListener('input', syncWindows);
  const runButton = host.querySelector('#avdr-run');
  const results = host.querySelector('#avdr-results');

  let loaded = false;
  let locationKey;
  let planKey;
  let lastSignature;
  let pending;
  let weatherRequest;
  let weatherLocation;
  let weatherTimer;

  async function run(force = false) {
    if (!loaded || !(analysis.classList.contains('active') || dashboard.classList.contains('active'))) return;
    const context = window.AVScreeningContext?.();
    if (!context) return;
    const {state, cropData} = context;
    const nextPlan = JSON.stringify([state.province, state.city, state.barangay, state.points, state.strategy]);
    if (nextPlan !== planKey) {
      planKey = nextPlan;
      drainage.value = {good:'well', poor:'poorly'}[state.plotProfile?.drainage] || 'unknown';
      dayInput.value = state.strategy === 'single' ? '120' : '';
      syncWindows();
    }
    const mapped = window.AVGis?.current();
    const key = JSON.stringify([state.province, state.city, state.barangay, mapped?.barangay]);
    if (key !== locationKey) {
      locationKey = key;
      const local = lookup(state.city) === 'valencia city' && lookup(state.province) === 'bukidnon';
      barangay.value = local ? [...barangay.options].find(option => lookup(option.value) === lookup(mapped?.barangay || state.barangay))?.value ?? '' : '';
      if (!mapped) previous.value = '';
    }
    const month = Number(document.getElementById('av-planting-month')?.value);
    const year = Number(document.getElementById('av-planting-year')?.value);
    const days = dayInput;
    if (!days.checkValidity()) { days.reportValidity(); return; }
    const history = state.rotationHistory;
    const prior = history?.previous === 'other' ? history.other : cropData[history?.previous]?.scientific || history?.previous;
    const plot = state.plotProfile;
    const request = {
      barangay: barangay.value,
      planting_month: month,
      rotation_slots: state.strategy === 'rotate' ? state.slots : undefined,
      planting_year: year || undefined,
      available_days: days.value ? Number(days.value) : undefined,
      previous_crop: previous.value.trim() || prior || '',
      irrigation: state.water || 'unknown',
      drainage: drainage.value,
      field_ph: plot?.ph,
      field_ph_source: plot?.phSource,
      gis_points: mapped?.basis === 'Sample inside drawn plot' && lookup(mapped.barangay) === lookup(barangay.value) ? state.points : undefined
    };
    const signature = JSON.stringify(request);
    if (!force && signature === lastSignature) return;
    lastSignature = signature;
    pending?.abort();
    weatherRequest?.abort();
    clearTimeout(weatherTimer);
    weatherLocation = null;
    document.getElementById('avdr-weather').hidden = true;

    if (!month || !barangay.value) {
      window.AVUnifiedAPI.setRankedCrops([]);
      results.textContent = month ? 'Choose a Valencia barangay or mark your field on the map.' : 'Choose a planting month first.';
      return;
    }
    const controller = new AbortController();
    pending = controller;
    results.textContent = 'Finding crops for your farm…';
    try {
      const response = await fetch('/api/recommend', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: signature, signal: controller.signal
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Recommendation unavailable');
      if (!controller.signal.aborted) { render(data); loadWeather(data.location); }
    } catch (error) {
      if (controller.signal.aborted) return;
      lastSignature = undefined;
      window.AVUnifiedAPI.setRankedCrops([]);
      results.textContent = 'Analysis unavailable. ' + error.message;
    }
  }

  const formatDate = value => new Intl.DateTimeFormat('en-PH', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z'));
  function render(data) {
    const rotating = Array.isArray(data.rotation_plan);
    const crops = rotating ? data.rotation_plan : data.recommendations.filter(crop => crop.shortlist).slice(0, 3);
    host.querySelector('.avdr-head b').textContent = rotating ? 'Recommended rotation' : 'Recommended crops';
    window.AVUnifiedAPI.setRankedCrops(crops, rotating);
    const model = window.AVUnifiedAPI.getModel();
    const location = escapeHtml(data.location.barangay);
    const season = data.season.startsWith('Wetter') ? 'Usually wetter here'
      : data.season.startsWith('Drier') ? 'Usually drier here' : data.season;
    const period = monthNames[data.month - 1] + (data.year ? ' ' + data.year : '');
    results.innerHTML = `<p class="avdr-notice">${location} · ${period} · ${escapeHtml(season)}${data.available_growing_days ? ' · Up to ' + data.available_growing_days + ' growing days per crop' : ' · Any growing duration'}</p>
      <div class="avdr-list">${model.rankedCrops.length ? model.rankedCrops.map((crop, index) => `
        <div class="avdr-crop"><div>
          <b>${rotating ? 'Season ' + (index + 1) + ' · ' : index === 0 ? 'Top match · ' : ''}${escapeHtml(crop.name)}</b>
          ${rotating ? `<small>Plant ${formatDate(crop.start)} · Harvest from ${formatDate(crop.earliest_harvest)}</small>` : ''}
          ${crop.texture_fit === 'preferred' ? '<small>Matches mapped soil texture</small>' : ''}
          ${crop.water_adjustment ? '<small>Check water supply during drier months</small>' : ''}
          ${crop.minimum_growing_days ? `<small>At least ${crop.minimum_growing_days} growing days</small>` : ''}
          ${model.strategy === 'single' ? `<button class="avdr-pick" type="button" data-avdr-crop="${escapeHtml(crop.id)}">Choose crop</button>` : ''}
        </div><strong>${crop.planning_score ?? crop.score}/100 <small>Planning fit</small></strong></div>`).join('')
        : '<p>No crop match for this plan. Try another planting month or adjust how many days you can grow.</p>'}</div>`;
    if (data.location.spans_barangays) {
      const note = document.createElement('small');
      note.className = 'avdr-evidence';
      note.textContent = 'This field crosses barangays. Climate is based on the barangay that covers the largest part of the field.';
      results.append(note);
    }
    if (crops.length) {
      const evidence = document.createElement('small');
      evidence.className = 'avdr-evidence';
      const modelled = data.environment.soil_ph_source.startsWith('SoilGrids');
      evidence.textContent = modelled
        ? 'Uses historical climate, available farm water and mapped soil. Confirm soil and fertilizer needs with a field test.'
        : 'Uses historical climate, available farm water and your pH reading.';
      results.append(evidence);
    }
    if (rotating && crops.length) {
      const timing = document.createElement('small');
      timing.textContent = 'Dates are estimates. The plan leaves ' + data.field_turnaround_days + ' days between crops for field preparation.';
      results.append(timing);
    }
    if (rotating && crops.length && crops.length < data.rotation_slots) {
      const note = document.createElement('p');
      note.textContent = 'Only ' + crops.length + ' of ' + data.rotation_slots + ' seasons had a suitable crop from a different family.';
      results.append(note);
    }
    const buttons = [...results.querySelectorAll('[data-avdr-crop]')];
    const sync = () => {
      const chosen = window.AVUnifiedAPI.getModel().chosen;
      for (const button of buttons) {
        const selected = chosen === button.dataset.avdrCrop;
        button.setAttribute('aria-pressed', String(selected));
        button.textContent = selected ? 'Selected' : 'Choose crop';
      }
    };
    sync();
    for (const button of buttons) {
      button.addEventListener('click', () => {
        window.AVScreeningContext?.().soundEffect('confirm');
        window.AVUnifiedAPI.chooseCrop(button.dataset.avdrCrop);
        window.AVUnified?.openCrop();
      });
    }
    window.addEventListener('agriverse:crop-selection', sync, {signal:pending.signal});
  }

  for (const field of [previous, document.getElementById('avr-previous')]) {
    if (!field) continue;
    const picks = document.createElement('div');
    picks.className = 'av-crop-picks';
    picks.setAttribute('aria-label', 'Matching crops');
    field.removeAttribute('list');
    (field.closest('label') || field).after(picks);
    let timer;
    let request;
    field.addEventListener('input', () => {
      clearTimeout(timer);
      request?.abort();
      const query = field.value.trim();
      picks.replaceChildren();
      if (query.length < 2) return;
      timer = setTimeout(async () => {
        const controller = new AbortController();
        request = controller;
        try {
          const response = await fetch('/api/crops/suggest?' + new URLSearchParams({q:query}), {signal:controller.signal});
          if (!response.ok) return;
          const data = await response.json();
          if (controller.signal.aborted) return;
          for (const name of data.crops.slice(0, 5)) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = name;
            button.setAttribute('aria-label', 'Use ' + name + ' as the last crop');
            button.addEventListener('click', () => {
              field.value = name;
              field.focus();
              field.dispatchEvent(new Event('input'));
              clearTimeout(timer);
              picks.replaceChildren();
              window.AVScreeningContext?.().soundEffect('tap');
            });
            picks.append(button);
          }
        } catch {
          // The field accepts typed names even when suggestions are unavailable.
        }
      }, 160);
    });
  }

  async function loadWeather(location) {
    const panel = document.getElementById('avdr-weather');
    clearTimeout(weatherTimer);
    weatherRequest?.abort();
    weatherLocation = location;
    const query = new URLSearchParams({latitude: location.latitude, longitude: location.longitude});
    const controller = new AbortController();
    weatherRequest = controller;
    panel.hidden = false;
    panel.textContent = 'Loading station readings and forecast…';
    try {
      const weatherJson = async url => {
        const response = await fetch(url, {signal: controller.signal});
        if (!response.ok) throw Error('Weather unavailable');
        return response.json();
      };
      const [stationResult, forecastResult] = await Promise.allSettled([
        loadValenciaStation(), weatherJson('/api/weather?' + query)
      ]);
      const station = stationResult.value;
      const daily = forecastResult.value?.daily;
      if (controller.signal.aborted) return;
      const weatherValue = (value, unit) => Number.isFinite(value) ? Math.round(value) + unit : 'Unavailable';
      const stationTime = station ? stationTimestamp(station) : '';
      const delayed = station && stationDelayed(station);
      const stationCard = stationTime ? `<p class="avdr-current"><b>${weatherValue(station.temperature_c, ' °C')}</b>
        · Wind ${weatherValue(station.wind_kph, ' km/h')} · Humidity ${weatherValue(station.humidity_pct, '%')}
        · Rain ${Number.isFinite(station.rain_rate_mm_h) ? station.rain_rate_mm_h + ' mm/h' : 'unavailable'}</p>
        <small>${delayed ? 'Delayed reading' : 'Observed'} · ${escapeHtml(stationTime)} Philippine time</small>`
        : '<p>Valencia station readings are temporarily unavailable.</p>';
      panel.innerHTML = `<h3>PAGASA · Valencia weather station</h3>
        ${stationCard}
        <p><small><a href="https://bagong.pagasa.dost.gov.ph/automated-weather-station" target="_blank" rel="noopener">Station readings</a>
        · <a href="https://www.pagasa.dost.gov.ph/agri-weather" target="_blank" rel="noopener">Official farm advisories</a></small></p>
        <h3>Next 5 days</h3>${daily?.time?.length ? `<ul class="avdr-weather-days">${daily.time.map((day, i) => `<li>
        <b>${escapeHtml(formatDate(day))}</b>
        <span>${weatherValue(daily.temperature_2m_min?.[i], '°')} to ${weatherValue(daily.temperature_2m_max?.[i], '°C')}</span>
        <span>Chance of rain: ${weatherValue(daily.precipitation_probability_max?.[i], '%')}</span>
      </li>`).join('')}</ul><small>Forecast from Open-Meteo</small>` : '<p>Forecast temporarily unavailable.</p>'}`;
    } catch {
      if (!controller.signal.aborted) panel.textContent = 'Weather is temporarily unavailable. Check PAGASA for warnings.';
    } finally {
      if (!controller.signal.aborted) weatherTimer = setTimeout(() => {
        if (!document.hidden && dashboard.classList.contains('active') && weatherLocation) loadWeather(weatherLocation);
      }, weatherRefreshMs);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && dashboard.classList.contains('active') && weatherLocation) loadWeather(weatherLocation);
  });
  barangay.addEventListener('change', () => run(true));
  runButton.addEventListener('click', () => run(true));
  drainage.addEventListener('change', () => run());
  previous.addEventListener('input', () => {
    pending?.abort();
    lastSignature = undefined;
    results.textContent = 'Select Analyze crops to update the previous crop.';
  });
  document.getElementById('av-planting-month')?.addEventListener('change', () => run());
  const screenObserver = new MutationObserver(() => {
    if (analysis.classList.contains('active') || dashboard.classList.contains('active')) run();
    else { pending?.abort(); weatherRequest?.abort(); clearTimeout(weatherTimer); lastSignature = undefined; }
  });
  for (const screen of [analysis, dashboard]) screenObserver.observe(screen, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('agriverse:gis', () => run());
  new MutationObserver(() => {
    if (lastSignature !== undefined) run();
  }).observe(anchor, { childList: true });

  fetch('/api/datasets/status').then(async response => {
    const data = await response.json();
    if (!response.ok || !data.ready) throw Error(data.error || 'Data unavailable');
    barangay.replaceChildren(new Option('Select a barangay', ''), ...data.barangays.map(name => new Option(name, name)));
    barangay.disabled = runButton.disabled = false;
    loaded = true;
    results.textContent = 'Choose a location and planting month to analyze.';
    run();
  }).catch(error => {
    results.textContent = 'Cannot load historical datasets. ' + error.message;
  });
})();
