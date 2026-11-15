/*
 * AgriVerse — Plot Suitability Screening (prototype)
 * NO fabricated elevation, soil chemistry, water volume, or soil moisture.
 * Ranking is limited to available FAO ECOCROP temperature/pH range checks.
 * Terrain, water, drainage, N/P/K are explicitly labeled contextual flags
 * until crop-specific thresholds and verified spatial datasets are connected.
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const hasNumber = value => typeof value === 'number' && Number.isFinite(value);
  const readable = value => hasNumber(value) ? String(value) : 'Not provided';
  const label = (value, choices) => choices[value] || 'Not provided';
  const textureLabels = {unknown:'Unknown',loam:'Loam',clay:'Clay',sand:'Sandy'};
  const waterLabels = {rainfed:'Rainfed',irrigated:'Irrigated',limited:'Limited water'};
  const drainageLabels = {unknown:'Unknown',good:'Well-drained',moderate:'Moderate',poor:'Poor drainage'};
  const reliabilityLabels = {unknown:'Unknown',reliable:'Reliable',seasonal:'Seasonal',unreliable:'Unreliable'};
  const nutrientLabels = {unknown:'Not tested',low:'Low',adequate:'Adequate',high:'High'};

  function boundaryKey(state) {
    return (state.points || []).map(p => p.map(n => Number(n).toFixed(5)).join(',')).join('|');
  }

  function profile(state) {
    const key = boundaryKey(state);
    if (!state.plotProfile || state.plotProfile.boundaryKey !== key) {
      state.plotProfile = {
        boundaryKey: key,
        ph: null, phSource: 'unknown',
        slope: null, elevation: null,
        drainage: 'unknown', reliability: 'unknown',
        nitrogen: 'unknown', phosphorus: 'unknown', potassium: 'unknown',
        soil: state.soil || 'unknown', water: state.water || 'rainfed'
      };
    }
    return state.plotProfile;
  }

  function warnings(id, state, p) {
    const result = [];
    if (p.slope !== null && p.slope >= 15) result.push('Slope ≥15%: erosion-control assessment needed');
    if (p.drainage === 'poor' && ['peanut','mung','soy','cowpea','corn'].includes(id)) {
      result.push('Poor drainage: investigate waterlogging tolerance');
    }
    if (state.water === 'limited' && id === 'rice') {
      result.push('Limited water: verify rice production system and seasonal water budget');
    }
    if (p.reliability === 'unreliable') {
      result.push('Unreliable dry-season water: check planting window and irrigation needs');
    }
    if (['low'].some(v => [p.nitrogen,p.phosphorus,p.potassium].includes(v))) {
      result.push('Reported low nutrient status: confirm with soil analysis and nutrient plan');
    }
    return result;
  }

  function rank(state, crops) {
    const p = profile(state);
    const temp = state.nasa && hasNumber(state.nasa.temp) ? state.nasa.temp : null;
    const usePh = hasNumber(p.ph) && ['lab','kit'].includes(p.phSource);
    return Object.keys(crops).map(id => {
      const crop = crops[id];
      const checks = [];
      if (temp !== null && hasNumber(crop.tempMin) && hasNumber(crop.tempMax)) {
        checks.push({name:'2025 temperature',ok:temp >= crop.tempMin && temp <= crop.tempMax,
          detail:`${temp.toFixed(1)}°C vs ${crop.tempMin}–${crop.tempMax}°C`});
      }
      if (usePh && hasNumber(crop.phMin) && hasNumber(crop.phMax)) {
        checks.push({name:'Soil pH',ok:p.ph >= crop.phMin && p.ph <= crop.phMax,
          detail:`pH ${p.ph} vs ${crop.phMin}–${crop.phMax}`});
      }
      const passed = checks.filter(c => c.ok).length;
      const failed = checks.length - passed;
      const flags = warnings(id,state,p);
      let status;
      if (!checks.length) status = 'NOT ASSESSED · ADD DATA';
      else if (failed) status = `${passed}/${checks.length} ECOLOGY CHECKS · REVIEW`;
      else status = `${passed}/${checks.length} ECOLOGY CHECKS MET · PRELIMINARY`;
      if (flags.length) status += ' · CAUTIONS';
      // Ordinal ordering only, not a yield prediction, probability, or certified suitability score.
      const score = checks.length ? (passed * 4 - failed * 6 - flags.length) : -100 - flags.length;
      return {id, status, score, inside: failed === 0 && checks.length > 0,
        checks, passed, failed, flags, evidenceCount: checks.length};
    }).sort((a,b) => {
      const aEvaluated = a.evidenceCount > 0, bEvaluated = b.evidenceCount > 0;
      if (aEvaluated !== bEvaluated) return aEvaluated ? -1 : 1;
      if (a.failed !== b.failed) return a.failed - b.failed;
      if (a.passed !== b.passed) return b.passed - a.passed;
      if (a.flags.length !== b.flags.length) return a.flags.length - b.flags.length;
      return a.id.localeCompare(b.id);
    });
  }

  function render(ctx) {
    const host = $('plot-suitability');
    if (!host) return;
    const {state, cropData} = ctx;
    const p = profile(state);
    const t = state.nasa && hasNumber(state.nasa.temp) ? state.nasa.temp.toFixed(1) + '°C · NASA POWER 2025' : 'Not loaded';
    const ph = hasNumber(p.ph) ? `pH ${p.ph} · ${p.phSource === 'lab' ? 'lab test' : p.phSource === 'kit' ? 'test kit' : 'unverified estimate'}` : 'Not tested';
    const top = rank(state,cropData)[0];
    const factors = [
      ['Terrain', p.slope === null ? 'Slope not entered' : `${p.slope}% slope`, p.elevation === null ? 'Elevation not entered' : `${p.elevation} m elevation`],
      ['Soil', label(state.soil,textureLabels), ph],
      ['Water', label(state.water,waterLabels), label(p.reliability,reliabilityLabels) + ' availability'],
      ['Nutrients', 'N: ' + label(p.nitrogen,nutrientLabels), 'P: ' + label(p.phosphorus,nutrientLabels) + ' · K: ' + label(p.potassium,nutrientLabels) + ' (reported)']
    ];
    const checked = top?.evidenceCount || 0;
    const summary = checked === 2
      ? 'Temperature + tested pH screened; terrain, nutrients, water demand and local growing season still need validation.'
      : checked === 1
        ? 'One ecological factor is available. Add a tested soil pH and/or NASA climate to improve the screening.'
        : 'No verified ecological comparison is possible yet. Enter a tested pH or load NASA climate.';
    host.innerHTML = `
      <div class="avp-topline">
        <div class="avp-title"><span class="avp-symbol">✳</span><div><span class="avp-eyebrow">PLOT INTELLIGENCE</span><h4>Smart crop screening</h4></div></div>
        <button id="avp-edit" class="avp-edit" type="button">⚙ Plot details <span>↗</span></button>
      </div>
      <div class="avp-factor-grid">
        ${factors.map(f=>`<div class="avp-factor"><span>${safe(f[0])}</span><b>${safe(f[1])}</b><small>${safe(f[2])}</small></div>`).join('')}
      </div>
      <div class="avp-bottom"><span class="avp-evidence"><span class="avp-dot"></span> ${checked}/2 published ecology checks available</span><span class="avp-temperature">Climate: ${safe(t)}</span></div>
      <p class="avp-disclosure">${safe(summary)} This is a preliminary screening, not a validated plot-specific recommendation.</p>
    `;
    $('avp-edit').onclick = () => openProfile(ctx);
  }

  function openProfile(ctx) {
    const {state,modal,closeModal,toast,renderAnalysis} = ctx;
    const p = profile(state);
    const opts = (items,current) => items.map(([value,text]) => `<option value="${value}" ${current===value?'selected':''}>${safe(text)}</option>`).join('');
    const num = (value) => hasNumber(value) ? value : '';
    modal(`<div class="avp-modal">
      <span class="eyebrow">AGRIVERSE / FIELD PROFILE</span>
      <h3 id="modal-heading">Tell us about your plot.</h3>
      <p>Only enter values you actually know. Blank fields stay unavailable. Satellite terrain and laboratory soil data will be connected later.</p>
      <div class="avp-form-grid">
        <label>Elevation (metres) <small>Manual or survey value</small><input id="avp-elevation" type="number" min="0" max="4000" step="1" placeholder="Unknown" value="${num(p.elevation)}"></label>
        <label>Average slope (%) <small>Manual or surveyed</small><input id="avp-slope" type="number" min="0" max="100" step="0.1" placeholder="Unknown" value="${num(p.slope)}"></label>
        <label>Drainage <small>Farmer observation</small><select id="avp-drainage">${opts([['unknown','Unknown'],['good','Well-drained'],['moderate','Moderate'],['poor','Poor drainage']],p.drainage)}</select></label>
        <label>Soil pH <small>Use a measured value if possible</small><input id="avp-ph" type="number" min="0" max="14" step="0.1" placeholder="Unknown" value="${num(p.ph)}"></label>
        <label>pH evidence <small>Estimated pH is not scored</small><select id="avp-ph-source">${opts([['unknown','No pH measurement'],['lab','Laboratory test'],['kit','Field test kit'],['estimate','Unverified estimate']],p.phSource)}</select></label>
        <label>Water access <small>Farmer report</small><select id="avp-water">${opts([['rainfed','Rainfed'],['irrigated','Irrigated'],['limited','Limited water']],state.water)}</select></label>
        <label>Dry-season supply <small>Farmer report</small><select id="avp-reliability">${opts([['unknown','Unknown'],['reliable','Reliable'],['seasonal','Seasonal'],['unreliable','Unreliable']],p.reliability)}</select></label>
        <label>Nitrogen (N) <small>Reported test category</small><select id="avp-n">${opts([['unknown','Not tested'],['low','Low'],['adequate','Adequate'],['high','High']],p.nitrogen)}</select></label>
        <label>Phosphorus (P) <small>Reported test category</small><select id="avp-p">${opts([['unknown','Not tested'],['low','Low'],['adequate','Adequate'],['high','High']],p.phosphorus)}</select></label>
        <label>Potassium (K) <small>Reported test category</small><select id="avp-k">${opts([['unknown','Not tested'],['low','Low'],['adequate','Adequate'],['high','High']],p.potassium)}</select></label>
      </div>
      <p class="avp-form-note">Elevation, slope, N/P/K and water availability are currently context/caution indicators, not numerically scored crop suitability criteria. Only source-backed temperature and tested pH are checked against the six FAO ECOCROP profiles.</p>
      <div class="modal-actions"><button class="outline-btn" id="avp-cancel">Cancel</button><button class="primary" id="avp-save">Update crop screening ↗</button></div>
    </div>`);
    $('avp-cancel').onclick = closeModal;
    $('avp-save').onclick = () => {
      const get = id => $(id).value;
      const parsed = (id,min,max) => {
        const raw = get(id).trim();
        if (!raw) return null;
        const value = Number(raw);
        if (!Number.isFinite(value) || value < min || value > max) throw Error(`${id.replace('avp-','')} must be between ${min} and ${max}.`);
        return value;
      };
      try {
        const next = {
          boundaryKey: boundaryKey(state),
          elevation: parsed('avp-elevation',0,4000), slope: parsed('avp-slope',0,100),
          ph: parsed('avp-ph',0,14), phSource: get('avp-ph-source'),
          drainage: get('avp-drainage'),
          water: get('avp-water'), reliability: get('avp-reliability'),
          nitrogen: get('avp-n'), phosphorus: get('avp-p'), potassium: get('avp-k')
        };
        if (next.ph !== null && next.phSource === 'unknown') throw Error('Choose a pH evidence source, or leave soil pH blank.');
        if (next.ph === null && next.phSource !== 'unknown') throw Error('Enter the soil pH value or select No pH measurement.');
        state.plotProfile = next;
        state.water = next.water;
        if ($('water-access')) $('water-access').value = next.water;
        closeModal();
        renderAnalysis();
        toast('Plot profile updated · preliminary crop screening refreshed');
      } catch (err) {
        toast(err.message);
      }
    };
  }

  function detailsFor(state,crops,id) {
    const r = rank(state,crops).find(x=>x.id===id);
    if (!r) return null;
    return {
      checks:r.checks,
      flags:r.flags,
      notScored:['Elevation','Slope','Soil texture','Drainage','Water sustainability','N/P/K nutrients','Crop-cycle water demand','Planting calendar'],
      methodology:'FAO ECOCROP published optimal annual-temperature and soil-pH ranges; NASA POWER historical annual mean where available. These are screening checks only.'
    };
  }

  window.AVPlot = {profile,rank,render,detailsFor};
})();
