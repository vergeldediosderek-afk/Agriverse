/* AgriVerse · Focus dashboard: side widgets only, map always centered.
   Presentation enhancement. Does not change data calculations, NASA, or map sources. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const screen = $('screen-farm-intelligence');
  if (!screen || screen.dataset.focusInstalled === 'true') return;
  screen.dataset.focusInstalled = 'true';
  const left = screen.querySelector('.fi-side-left');
  const right = screen.querySelector('.fi-side-right');
  const monthly = screen.querySelector('.fi-monthly-panel');
  const land = left.querySelector('.fi-glass:not(.fi-risks):not(.fi-access)');
  const risks = left.querySelector('.fi-risks');
  const access = left.querySelector('.fi-access');
  const crop = right.querySelector('.fi-crop');
  const profit = right.querySelector('.fi-profit');
  if (![left,right,monthly,land,risks,access,crop,profit].every(Boolean)) return;

  // Move existing, functional monthly controls to a left-side widget. No duplicate IDs.
  left.insertBefore(monthly, risks);
  const setup = (side, items, label, defaultTab) => {
    const tabs = document.createElement('div');
    tabs.className = 'fi-focus-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', label);
    const buttons = new Map();
    items.forEach(({id, title, symbol, panel}) => {
      panel.classList.add('fi-focus-view');
      panel.dataset.focusView = id;
      panel.setAttribute('role','tabpanel');
      panel.id = 'fi-focus-panel-' + id;
      panel.setAttribute('aria-labelledby','fi-focus-tab-' + id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fi-focus-tab';
      btn.id = 'fi-focus-tab-' + id;
      btn.setAttribute('role','tab');
      btn.setAttribute('aria-controls',panel.id);
      btn.innerHTML = `<span aria-hidden="true">${symbol}</span><span>${title}</span>`;
      btn.addEventListener('click', () => { window.AVScreeningContext?.().soundEffect('tap'); activate(id); });
      tabs.append(btn);
      buttons.set(id,btn);
    });
    side.prepend(tabs);
    function activate(id) {
      for (const item of items) {
        const selected = item.id === id;
        item.panel.hidden = !selected;
        item.panel.setAttribute('aria-hidden', String(!selected));
        buttons.get(item.id).classList.toggle('is-selected',selected);
        buttons.get(item.id).setAttribute('aria-selected',String(selected));
        buttons.get(item.id).tabIndex = selected ? 0 : -1;
      }
      side.dataset.activeFocusTab = id;
      if (side === left) window.AVMonthly?.setRoads(id === 'roads');
      if (id === 'seasons') window.requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }
    tabs.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      const keys = items.map(i => i.id);
      const i = Math.max(0, keys.indexOf(side.dataset.activeFocusTab));
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? keys.length-1 : (i+(event.key==='ArrowRight'?1:-1)+keys.length)%keys.length;
      event.preventDefault();activate(keys[next]);buttons.get(keys[next]).focus();
    });
    activate(defaultTab);
    return activate;
  };
  // Unified farmer journey: crop decisions occur alongside the same saved farm map.
  const plans = document.createElement('section');
  plans.className = 'fi-glass fi-pad av-unified-plans';
  plans.setAttribute('aria-label','Choose a crop or rotation plan');
  right.prepend(plans);
  const showLeft = setup(left, [
    {id:'land',title:'Farm',symbol:'⌖',panel:land},
    {id:'seasons',title:'Seasons',symbol:'◷',panel:monthly},
    {id:'hazards',title:'Weather',symbol:'⚑',panel:risks},
    {id:'roads',title:'Roads',symbol:'↗',panel:access}
  ],'Farm information', 'land');
  const showRight = setup(right, [
    {id:'plans',title:'Planting plan',symbol:'🌱',panel:plans},
    {id:'crop',title:'Crop details',symbol:'✳',panel:crop},
    {id:'profit',title:'Profit',symbol:'₱',panel:profit}
  ],'Crop and financial details','crop');

  const activateUnified = (name) => {
    showRight(name);
    const dock = document.querySelector('#screen-farm-intelligence .fi-focus-dock');
    if (dock) dock.hidden = name === 'plans';
    if (name === 'plans') window.AVUnifiedRender?.();
  };
  window.AVUnified = {
    openPlans(){activateUnified('plans');},
    openCrop(){activateUnified('crop');},
    openProfit(){activateUnified('profit');}
  };
  // Compact CropPedia: image and crop identity share one row; limitations expand on demand.
  const hero = document.createElement('div');
  hero.className = 'fi-focus-crop-hero';
  const photo = crop.querySelector('.fi-photo');
  const identity = crop.querySelector('.fi-crop-head');
  crop.insertBefore(hero, photo);
  hero.append(photo, identity);
  const weakness = crop.querySelector('.fi-weakness');
  const disclosure = document.createElement('details');
  disclosure.className = 'fi-focus-weakness';
  const warning = document.createElement('summary');
  warning.textContent = 'Growing considerations';
  weakness.before(disclosure);
  disclosure.append(warning, weakness);

  // A small, persistent return summary and action replace the stacked profit footer.
  const dock = document.createElement('div');
  dock.className = 'fi-focus-dock';
  const result = $('fi-net')?.closest('.fi-profit-result');
  const next = $('fi-review');
  if (result) dock.append(result);
  if (next) dock.append(next);
  right.append(dock);
  if (result) {
    result.setAttribute('role','button');
    result.tabIndex = 0;
    result.title = 'Open the profit calculator';
    result.addEventListener('click', () => showRight('profit'));
    result.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showRight('profit');}});
  }
  profit.querySelector('.fi-muted').textContent = 'Enter how much you expect to harvest. Add your selling price to see sales, then add costs to see profit.';
  const breakdown = document.createElement('details');
  breakdown.className = 'fi-focus-breakdown';
  const summary = document.createElement('summary');
  summary.textContent = 'Calculation breakdown';
  breakdown.append(summary);
  profit.querySelectorAll('.fi-profit-kv, .fi-footnote').forEach(node => breakdown.append(node));
  profit.append(breakdown);

  // A rotation displays one editable season at a time, not three long forms.
  const inputs = $('fi-profit-inputs');
  const seasonNav = document.createElement('div');
  seasonNav.className = 'fi-focus-seasons';
  inputs.before(seasonNav);
  let activeSeason = 0;
  let financeGroup = 'revenue';
  function updateSeasonTabs() {
    const seasons = Array.from(inputs.querySelectorAll('.fi-season'));
    if (activeSeason >= seasons.length) activeSeason = 0;
    seasonNav.replaceChildren();
    seasonNav.hidden = seasons.length < 2;
    seasons.forEach((panel,index) => {
      const hint = panel.querySelector('.fi-season-hint');
      if (hint && !hint.closest('.fi-focus-hint')) {
        const details=document.createElement('details');details.className='fi-focus-hint';
        const summary=document.createElement('summary');summary.textContent='Load pricing notes';
        hint.before(details);details.append(summary,hint);
      }
      if (!panel.querySelector('.fi-focus-finance-switch')) {
        const switcher = document.createElement('div');
        switcher.className = 'fi-focus-finance-switch';
        for (const [group,title] of [['revenue','Yield & price'],['costs','Costs & transport']]) {
          const button = document.createElement('button');
          button.type='button';button.textContent=title;
          button.dataset.group=group;
          button.addEventListener('click',()=>{
            financeGroup=group;
            inputs.querySelectorAll('.fi-season').forEach(el=>{
              el.dataset.financeGroup=group;
              el.querySelectorAll('.fi-focus-finance-switch button').forEach(b=>{
                const selected=b.dataset.group===group;
                b.classList.toggle('is-selected',selected);
                b.setAttribute('aria-pressed',String(selected));
              });
            });
          });
          switcher.append(button);
        }
        panel.querySelector('.fi-input-grid').before(switcher);
      }
      panel.dataset.financeGroup=financeGroup;
      panel.querySelectorAll('.fi-focus-finance-switch button').forEach(button=>{
        const chosen=button.dataset.group===financeGroup;
        button.classList.toggle('is-selected',chosen);
        button.setAttribute('aria-pressed',String(chosen));
      });
      const selected = index === activeSeason;
      panel.hidden = !selected;
      panel.classList.toggle('fi-season-current',selected);
      if (seasons.length < 2) return;
      const name = panel.querySelector('.fi-season-name span')?.textContent?.trim() || `Season ${index+1}`;
      const btn = document.createElement('button');
      btn.type='button';btn.className='fi-focus-season-btn';
      btn.textContent = `Season ${index+1}`;
      btn.title = name;
      btn.setAttribute('aria-pressed',String(selected));
      btn.classList.toggle('is-selected',selected);
      btn.addEventListener('click',()=>{activeSeason=index;updateSeasonTabs();});
      seasonNav.append(btn);
    });
  }
  new MutationObserver(updateSeasonTabs).observe(inputs,{childList:true});
  updateSeasonTabs();

  // The main page is locked to the viewport only on wide screens; mobile stays accessible.
  function syncActive() {
    const active = screen.classList.contains('active');
    document.body.classList.toggle('av-fi-focus',active);
    if (active) {
      showLeft('land');showRight('crop');activeSeason=0;updateSeasonTabs();
      window.setTimeout(()=>window.dispatchEvent(new Event('resize')),250);
    }
  }
  new MutationObserver(syncActive).observe(screen,{attributes:true,attributeFilter:['class']});
  syncActive();
})();
