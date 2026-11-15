/* AgriVerse unified farmer journey: select place → outline → profile. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const root = $('screen-location');
  const stageLocation = $('avc-location-stage');
  const stageBoundary = $('avc-boundary-stage');
  const stageProfile = $('avc-profile-stage');
  const originalBoundary = document.querySelector('#screen-boundary .boundary-layout');
  const mapContainer = document.querySelector('#screen-boundary .map-shell');
  let confirmed = false;
  let lastPhase = 'location';
  if (!root || !originalBoundary) return;
  // Reuse actual Leaflet map, controls, confirmation button and polygon logic.
  stageBoundary.appendChild(originalBoundary);

  function labelForPhase(phase) {
    const title = $('avc-heading-title');
    const kicker = $('avc-heading-kicker');
    const subtitle = $('avc-heading-sub');
    const indicator = $('avc-step-indicator');
    if (phase === 'location') {
      title.innerHTML = 'Choose your <em>place.</em>';
      kicker.textContent = '02 / FIND YOUR FARM';
      subtitle.textContent = 'Set your farm location and planting date.';
      indicator.textContent = 'STEP 1 OF 3';
    } else if (phase === 'boundary') {
      title.innerHTML = 'Mark your <em>farm.</em>';
      kicker.textContent = '02 / DRAW YOUR LAND';
      subtitle.textContent = 'Zoom in and tap the corners of the land you farm.';
      indicator.textContent = 'STEP 2 OF 3';
    } else {
      title.innerHTML = 'Your farm, <em>defined.</em>';
      kicker.textContent = '02 / FARM SUMMARY';
      subtitle.textContent = 'Your boundary is saved. Review what we know before choosing crops.';
      indicator.textContent = 'STEP 3 OF 3';
    }
  }
  function setPhase(phase, animate = false) {
    lastPhase = phase;
    stageLocation.hidden = phase !== 'location';
    stageBoundary.hidden = phase !== 'boundary';
    stageProfile.hidden = phase !== 'profile';
    root.dataset.avcPhase = phase;
    labelForPhase(phase);
    if (animate) {
      root.classList.remove('avc-transitioning');
      void root.offsetWidth;
      root.classList.add('avc-transitioning');
      window.setTimeout(() => root.classList.remove('avc-transitioning'), 700);
    }
    if (phase === 'boundary') {
      window.setTimeout(() => {
        try { window.AVBoundary?.sync?.(0,0,false,[]); } catch (_) {}
        const leaflet = window.L;
        if (leaflet && mapContainer) {
          const map = Object.values(mapContainer).find(x => x && x.invalidateSize);
          map?.invalidateSize?.();
        }
        // Trigger Leaflet resize after the element becomes visible.
        window.dispatchEvent(new Event('resize'));
      }, 350);
    }
  }
  function updateMapPreview() {
    const island = $('crumb-title')?.textContent;
    const selectedGroup = $('region-chip')?.textContent.split('·')[0].trim().toLowerCase();
    const group = selectedGroup === 'luzon' || selectedGroup === 'visayas' || selectedGroup === 'mindanao'
      ? selectedGroup : 'mindanao';
    const path = window.PH_PATHS?.[group.charAt(0).toUpperCase()+group.slice(1)] || window.PH_PATHS?.Mindanao;
    const el = $('avc-island-path');
    if (el && path) {
      el.setAttribute('d',path);
      try {
        const bounds=el.getBBox();
        $('avc-preview-svg').setAttribute('viewBox',`${bounds.x-22} ${bounds.y-30} ${bounds.width+44} ${bounds.height+60}`);
      } catch (_) {}
    }
    const province = $('province')?.value || 'your province';
    const city = $('city')?.value || '';
    const barangay = $('barangay')?.value || '';
    const sitio = $('street')?.value.trim() || '';
    $('avc-preview-label').textContent = `YOUR REGION · ${group.toUpperCase()}`;
    $('avc-map-status').textContent = [sitio,barangay,city,province].filter(Boolean).join(' · ');
  }
  let transitionTimer;
  $('to-map')?.addEventListener('click',() => {
    // Listen after the existing validation/navigation handler. Do not animate if invalid.
    window.setTimeout(() => {
      if (root.dataset.avcPhase !== 'boundary') return;
      const preview = $('avc-map-preview');
      if (preview) {
        preview.classList.add('avc-zooming');
        clearTimeout(transitionTimer);
        transitionTimer = setTimeout(() => preview.classList.remove('avc-zooming'), 900);
      }
    },0);
  });
  ['province','city','barangay','street'].forEach(id => {
    $(id)?.addEventListener('change',()=>setTimeout(updateMapPreview,0));
    $(id)?.addEventListener('input',updateMapPreview);
  });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-island],[data-go-island],#custom-ok')) setTimeout(updateMapPreview,40);
  });
  let selectedPlan = null;
  function showProfile() {
    confirmed = true;
    selectedPlan = null;
    root.querySelectorAll('[data-avc-plan]').forEach(button => {button.classList.remove('is-selected');button.setAttribute('aria-pressed','false')});
    window.AVRotationHistory?.clear?.();
    setPhase('profile',true);
    window.AVGis?.refresh();
    $('avc-plan-chooser').hidden = false;
    $('avc-land-specifications').hidden = false;
    $('avc-recommend-strip').hidden = true;
    $('avr-history').hidden = true;
    const count = Number(($('pin-count')?.textContent || '').match(/\d+/)?.[0] || 0);
    const estimate = $('area-value')?.textContent || '—';
    $('avc-profile-area').textContent = estimate === '—' ? '—' : `${estimate} ha`;
    $('avc-profile-corners').textContent = `${count} corners selected`;
    $('avc-profile-warning').textContent = $('avb-demo-warning') && !$('avb-demo-warning').hidden
      ? 'Demo boundary only. Its location and area are not verified observations.'
      : 'Terrain and soil layers describe the mapped location. Soil testing is needed for fertilizer decisions.';
    if (mapContainer && mapContainer.parentElement !== $('avc-profile-map')) $('avc-profile-map').appendChild(mapContainer);
    window.setTimeout(()=>window.dispatchEvent(new Event('resize')),180);
  }
  function choosePlan(plan) {
    selectedPlan=plan;
    // The existing planting and analysis handlers remain the source of truth.
    document.querySelector(`#screen-strategy [data-strategy="${plan}"]`)?.click();
    $('avc-plan-chooser').hidden=false;
    $('avc-land-specifications').hidden=false;
    $('avc-recommend-strip').hidden=plan==='rotate';
    $('avc-recommend-mode').textContent = plan==='rotate'?'Crop rotation · history provided':'Single crop · one planting season';
    root.querySelectorAll('[data-avc-plan]').forEach(button => {
      const chosen=button.dataset.avcPlan===plan;
      button.classList.toggle('is-selected',chosen);
      button.setAttribute('aria-pressed',String(chosen));
    });
    $('avr-history').hidden=plan!=='rotate';
    if (plan==='rotate') {
      // Never keep a stale previous-crop answer when switching crop modes.
      window.AVRotationHistory?.clear?.();
      $('avr-error').hidden=true;
      $('avr-previous').value='';
    }
    $('avc-plan-description').textContent = plan==='rotate' ? 'Crop rotation · plan several seasons' : 'Single crop · one season';
    $('avc-slots-wrap').hidden = plan!=='rotate';
    $('avc-water').value=$('water-access')?.value||'rainfed';
    $('avc-priority').value=$('farm-priority')?.value||'balanced';
    // Keep the recommendation banner out of view until crop history is complete.
    // Avoid scrolling the entire dashboard on choosing a planting mode.
  }
  root.querySelectorAll('[data-avc-plan]').forEach(button => button.addEventListener('click',()=>choosePlan(button.dataset.avcPlan)));
  $('avc-change-plan')?.addEventListener('click',()=>{
    $('avc-plan-chooser').hidden=false;
    $('avc-land-specifications').hidden=false;
    $('avc-recommend-strip').hidden=true;
    $('avr-history').hidden=true;
    selectedPlan=null;
    root.querySelectorAll('[data-avc-plan]').forEach(button => {button.classList.remove('is-selected');button.setAttribute('aria-pressed','false')});
    window.AVRotationHistory?.clear?.();
  });
  $('avr-previous')?.addEventListener('change', () => {
    $('avr-error').hidden = true;
    $('avc-recommend-strip').hidden = true;
  });
  ['avr-previous','avr-time','avr-concern','avr-earlier'].forEach(id=>$(id)?.addEventListener('input',()=>{
    if(selectedPlan==='rotate') $('avc-recommend-strip').hidden=true;
  }));
  $('avr-analyze')?.addEventListener('click', () => {
    if(selectedPlan!=='rotate') return;
    const typed=$('avr-previous').value.trim();
    if(!typed){$('avr-error').hidden=false;$('avr-previous').focus();return;}
    const previous=typed.toLowerCase()==='unknown'?'unknown':'other';
    const history={previous,other:previous==='other'?typed:null,time:$('avr-time').value,concern:$('avr-concern').value,earlier:$('avr-earlier').value||null,source:'farmer-reported'};
    window.AVRotationHistory?.set?.(history);
    $('avr-error').hidden=true;
    $('avc-recommend-mode').textContent='Crop rotation';
    $('avc-recommend-strip').hidden=false;
    // Keep the screen stationary; the banner is immediately above the map.
  });
  const syncFarmPreferences=()=>{
    $('water-access').value=$('avc-water').value;
    $('farm-priority').value=$('avc-priority').value;
    if(selectedPlan==='rotate'){
      const slots=Number($('avc-slots').value);
      let current=Number($('slots-number').textContent);
      const button= slots>=current?$('slots-plus'):$('slots-minus');
      while(current!==slots){button.click();current=Number($('slots-number').textContent)}
    }
  };
  ['avc-water','avc-priority','avc-slots'].forEach(id=>$(id)?.addEventListener('change',syncFarmPreferences));
  function returnMap() {
    if (mapContainer && mapContainer.parentElement !== originalBoundary) {
      originalBoundary.prepend(mapContainer);
    }
    setPhase('boundary',true);
  }
  $('avc-edit-boundary')?.addEventListener('click',returnMap);
  $('avc-edit-from-specs').onclick = returnMap;
  $('avc-recommend-next').onclick = () => {
    if(!selectedPlan) return;
    if(selectedPlan==='rotate' && !window.AVRotationHistory?.get?.()) { $('avr-error').hidden=false; $('avr-previous').focus(); return; }
    syncFarmPreferences();
    // Run the existing crop screening flow, without returning to the separate strategy page.
    $('to-analysis').click();
  };
  // Animate the region artwork into the actual interactive plotting workspace.
  // The transition is driven by the same Find approximate location event,
  // not by a second page or a cosmetic animation on an unrelated button.
  let isTransitioning = false;
  async function animateToPlot(navigate) {
    if (isTransitioning) return;
    isTransitioning = true;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const panel = $('avc-place-form');
    const preview = $('avc-map-preview');
    const shell = document.querySelector('#avc-boundary-stage .map-shell');
    const oldBounds = preview?.getBoundingClientRect();
    const illustration = $('avc-preview-svg');
    const replica = !reduceMotion && preview ? preview.cloneNode(true) : null;
    if (replica) {
      replica.removeAttribute('id');
      replica.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      replica.classList.add('avc-map-morph-overlay');
      Object.assign(replica.style, {
        left: oldBounds.left+'px', top:oldBounds.top+'px',
        width:oldBounds.width+'px', height:oldBounds.height+'px'
      });
      document.body.appendChild(replica);
    }
    const slide = !reduceMotion && panel ? panel.animate([
      {transform:'translateX(0)',opacity:1},
      {transform:'translateX(-16px)',opacity:0}
    ],{duration:260,easing:'cubic-bezier(.32,0,.2,1)',fill:'forwards'}) : null;
    await new Promise(r => window.setTimeout(r,reduceMotion?0:110));
    navigate();
    // Wait for the new stage to become measurable before moving the preview.
    await new Promise(r => requestAnimationFrame(()=>requestAnimationFrame(r)));
    const newBounds = shell?.getBoundingClientRect();
    if (replica && newBounds?.width) {
      const dx=newBounds.left-oldBounds.left,dy=newBounds.top-oldBounds.top;
      const sx=newBounds.width/oldBounds.width,sy=newBounds.height/oldBounds.height;
      const motion=replica.animate([
        {transform:'translate(0,0) scale(1,1)',opacity:1,filter:'blur(0px)'},
        {transform:`translate(${dx}px,${dy}px) scale(${sx},${sy})`,opacity:0,filter:'blur(5px)'}
      ],{duration:600,easing:'cubic-bezier(.18,.7,.22,1)',fill:'forwards'});
      await motion.finished.catch(()=>{});
    }
    slide?.cancel();
    replica?.remove();
    panel?.style.removeProperty('opacity');
    isTransitioning=false;
    window.dispatchEvent(new Event('resize'));
  }
  window.AVCombined = {
    beginBoundaryTransition: animateToPlot,
    showProfile,
    navigateStrategy: () => window.AVGoToStrategy?.(),
    onShow(name) {
      if (name === 'location') {
        const locationButton=$('to-map');
        if(locationButton){locationButton.dataset.transitionPending='0';locationButton.disabled=false;locationButton.removeAttribute('aria-busy');}
        // A fresh arrival from island map starts at location. Returning from
        // the plotting stage via Back also restores the location form.
        confirmed=false;
        if(mapContainer && mapContainer.parentElement !== originalBoundary) originalBoundary.prepend(mapContainer);
        setPhase('location');
        setTimeout(updateMapPreview,30);
      } else if(name === 'boundary') {
        if(confirmed) showProfile();
        else {
          if(mapContainer && mapContainer.parentElement !== originalBoundary) originalBoundary.prepend(mapContainer);
          setPhase('boundary', true);
        }
      }
    }
  };
  setPhase('location');
  updateMapPreview();
})();
