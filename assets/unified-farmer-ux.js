/* AgriVerse unified crop-plan / farm workspace. Keeps existing data and map logic. */
(() => {
  'use strict';
  const host = document.querySelector('.av-unified-plans');
  const api = () => window.AVUnifiedAPI;
  if (!host) return;
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let selectedPlan = 0;
  function paint(){
    const model = api()?.getModel?.(); if(!model)return;
    selectedPlan = Number.isInteger(model.planIndex)?model.planIndex:0;
    const rotating = model.strategy==='rotate';
    let cards='';
    if(rotating && model.rankedCrops?.length){
      cards = `<ol class="av-unified-list">${model.rankedCrops.map(crop=>`<li><button type="button" class="avdr-pick" data-unified-crop="${esc(crop.id)}" aria-pressed="${crop.id===model.chosen}">${esc(crop.name)}</button></li>`).join('')}</ol>`;
    } else {
      const crops = model.rankedCrops || [];
      cards = crops.length
        ? `<div class="av-unified-singles">${crops.map(crop=>`<button type="button" data-unified-crop="${esc(crop.id)}" class="av-unified-single ${crop.id===model.chosen?'selected':''}" aria-pressed="${crop.id===model.chosen}"><span>${esc(crop.name)}</span><span>${crop.planning_score ?? crop.score}/100</span></button>`).join('')}</div>`
        : `<p>${model.rankedCrops ? 'No crop match for this plan.' : 'Finding crops for your farm…'}</p>`;
    }
    host.innerHTML=`<div class="av-unified-intro"><span class="av-unified-eyebrow">YOUR FARM · YOUR CHOICE</span><h3>${rotating?'Choose your crop plan':'Choose a crop'}</h3><p>${rotating?'Your crops in planting order.':'Choose one crop to explore for your land.'}</p></div>
      <div class="av-unified-list">${cards}</div>
      <p class="av-unified-caution">${rotating?'Dates use minimum growing times. Allow time for harvest and field preparation.':'Crop suitability still needs complete local soil and seasonal information.'}</p>
      <button type="button" class="av-unified-go" id="av-unified-go" ${model.chosen && model.rankedCrops?.length ? '' : 'disabled'}>${rotating?'Explore this rotation':'Explore this crop'} <span>→</span></button>`;
    host.querySelectorAll('[data-unified-plan]').forEach(btn=>btn.addEventListener('click',()=>{
      const n=Number(btn.dataset.unifiedPlan);
      if(api()?.choosePlan(n))paint();
    }));
    host.querySelectorAll('[data-unified-crop]').forEach(btn=>btn.addEventListener('click',()=>{
      if(api()?.chooseCrop(btn.dataset.unifiedCrop) && rotating) window.AVUnified?.openCrop();
    }));
    host.querySelector('#av-unified-go')?.addEventListener('click',()=>window.AVUnified?.openCrop?.());
    const dock=document.querySelector('#screen-farm-intelligence .fi-focus-dock');
    if(dock) dock.hidden=document.querySelector('.fi-side-right')?.dataset.activeFocusTab==='plans';
  }
  window.AVUnifiedRender=paint;
  const tabs=document.querySelector('#screen-farm-intelligence .fi-side-right .fi-focus-tabs');
  tabs?.addEventListener('click',()=>{
    window.requestAnimationFrame(()=>{
      const dock=document.querySelector('#screen-farm-intelligence .fi-focus-dock');
      if(dock)dock.hidden=document.querySelector('.fi-side-right')?.dataset.activeFocusTab==='plans';
      if(document.querySelector('.fi-side-right')?.dataset.activeFocusTab==='plans')paint();
    });
  });
  const screen=document.getElementById('screen-farm-intelligence');
  new MutationObserver(()=>{if(screen.classList.contains('active')){
    window.requestAnimationFrame(()=>{ if(document.querySelector('.fi-side-right')?.dataset.activeFocusTab==='plans')paint(); });
  }}).observe(screen,{attributes:true,attributeFilter:['class']});
})();
