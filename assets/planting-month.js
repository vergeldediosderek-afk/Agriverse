/* AgriVerse planting month input — no invented seasonal weather observations. */
(() => {
  'use strict';
  const input=document.getElementById('av-planting-month');
  const hint=document.getElementById('av-planting-season-hint');
  if (!input || !hint) return;
  const year = document.getElementById('av-planting-year');
  if (year && !year.value) year.value = new Intl.DateTimeFormat('en', {timeZone:'Asia/Manila',year:'numeric'}).format();
  year?.addEventListener('change', () => refreshSummaries());
  const names=['','January','February','March','April','May','June','July','August','September','October','November','December'];
  const read=()=>{
    const n=Number(input.value);
    const valid=Number.isInteger(n)&&n>=1&&n<=12;
    const month=valid?names[n]:null;
    const period=null;
    if (typeof state!=='undefined') {
      state.plantingMonth=month;
      state.plantingSeason=period;
    }
    hint.hidden = true;
    refreshSummaries();
  };
  const details=()=>{
    const month=typeof state!=='undefined'?state.plantingMonth:null;
    return month?`Planned planting: ${month} ${year?.value || ''}`:'Select a planting month';
  };
  const addSummary=(id, parent, anchor) =>{
    if (!parent) return;
    let el=document.getElementById(id);
    if(!el){el=document.createElement('div');el.id=id;el.className='av-month-summary';el.setAttribute('aria-label','Planting month');(anchor||parent).insertAdjacentElement('afterend',el);}
    el.textContent=details();
  };
  function refreshSummaries(){
    const intro=document.querySelector('#screen-analysis .recommend-head');
    if(intro) addSummary('av-month-analysis',intro.parentElement,intro);
    const maphead=document.querySelector('#screen-farm-intelligence .fi-titlebar, #screen-farm-intelligence .fi-head, #screen-farm-intelligence .workspace-header');
    if(maphead) addSummary('av-month-dashboard',maphead.parentElement,maphead);
  }
  input.addEventListener('change',read);
  // Validate first. Do not activate the map with an unknown month.
  document.getElementById('to-map')?.addEventListener('click',e=>{
    if (!input.value) {
      e.preventDefault();e.stopImmediatePropagation();
      hint.hidden = false;
      hint.textContent='Choose your planting month to continue.';
      input.focus();
    } else read();
  },true);
  document.addEventListener('click',e=>{
    if (e.target.closest('[data-avc-plan],#avc-recommend-next,#finalize,.av-unified-plan,#av-unified-go')) window.setTimeout(refreshSummaries,0);
  });
  // When user starts a new journey the original reset function clears the state;
  // synchronize the control when the selection screen returns.
  const screen=document.getElementById('screen-location');
  if(screen){new MutationObserver(()=>{
    if(screen.classList.contains('active')) {
      if(typeof state!=='undefined' && !state.plantingMonth && input.value) {input.value='';read();}
    }
  }).observe(screen,{attributes:true,attributeFilter:['class']});}
  read();
})();
