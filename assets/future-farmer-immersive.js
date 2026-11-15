/* AgriVerse Future Farmer — full-screen immersive HUD and collapsible glass controls.
   The underlying planting/harvesting simulation remains the source of truth. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
function init(){
 const screen=$('screen-simulation');if(!screen||screen.querySelector('.av3d-dock'))return;
 const right=screen.querySelector('.sim-right'),left=screen.querySelector('.sim-left');
 if(!right||!left)return;
 const closeRight=document.createElement('button');closeRight.type='button';closeRight.className='av3d-close';closeRight.textContent='← Back to farm';closeRight.dataset.av3d='close';right.prepend(closeRight);
 const closeLeft=document.createElement('button');closeLeft.type='button';closeLeft.className='av3d-close';closeLeft.textContent='← Back to farm';closeLeft.dataset.av3d='close';left.prepend(closeLeft);
 const hud=document.createElement('div');hud.className='av3d-hud';hud.setAttribute('aria-label','Game statistics');
 hud.innerHTML='<span class="av3d-hud-item">🌱 <b id="av3d-hud-season">Season 1/3</b></span><span class="av3d-hud-item">☀️ <b id="av3d-hud-day">Day 01</b></span><span class="av3d-hud-item">🪙 <b id="av3d-hud-credits">4,200 cr</b></span><span class="av3d-hud-item">💧 <b id="av3d-hud-water">72/100</b></span><span class="av3d-hud-item">🌿 <b id="av3d-hud-soil">68/100</b></span>';
 screen.appendChild(hud);
 const note=document.createElement('div');note.className='av3d-note';note.textContent='Drag to orbit smoothly · Drag up/down to tilt · Scroll or pinch to zoom';screen.appendChild(note);
 const dock=document.createElement('div');dock.className='av3d-dock';dock.setAttribute('role','toolbar');dock.setAttribute('aria-label','Future Farmer quick actions');
 dock.innerHTML='<button type="button" data-av3d="status" aria-pressed="false"><span class="av3d-icon">📋</span>Mission</button><button type="button" data-av3d="plant" aria-pressed="false"><span class="av3d-icon">🌱</span>Plant</button><button type="button" data-av3d="care" aria-pressed="false"><span class="av3d-icon">💧</span>Care</button><span class="av3d-divider" aria-hidden="true"></span><button type="button" class="av3d-primary" data-av3d="grow"><span class="av3d-icon">▶</span>Grow</button><button type="button" data-av3d="harvest"><span class="av3d-icon">🌽</span>Harvest</button><button type="button" class="av3d-primary" data-av3d="next" hidden><span class="av3d-icon">→</span>Next year</button><button type="button" data-av3d="replay" hidden><span class="av3d-icon">↶</span>Replay year</button>';
 screen.appendChild(dock);
 const full=document.createElement('button');full.type='button';full.id='av3d-fullscreen';full.textContent='⛶ Fullscreen';full.title='Toggle browser fullscreen';screen.querySelector('.sim-top-actions')?.prepend(full);
 const light=document.createElement('button');light.type='button';light.id='av3d-light';light.textContent='☀️';light.title='Toggle day and evening scene';screen.querySelector('.sim-top-actions')?.prepend(light);
 function closePanels(){if(screen.classList.contains('av3d-tools-open'))screen.classList.remove('av3d-tools-open');if(screen.classList.contains('av3d-status-open'))screen.classList.remove('av3d-status-open');updateButtons()}
 function openPanel(name){
  const isStatus=name==='status',className=isStatus?'av3d-status-open':'av3d-tools-open';
  const already=screen.classList.contains(className);
  closePanels();if(!already){screen.classList.add(className);if(!isStatus){const scroller=right.querySelector('.sim-options-scroll');if(scroller)scroller.scrollTop=name==='care'?scroller.scrollHeight:0}}
  updateButtons();
 }
 function updateButtons(){
  dock.querySelectorAll('[data-av3d="status"],[data-av3d="plant"],[data-av3d="care"]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.av3d==='status'?String(screen.classList.contains('av3d-status-open')):String(screen.classList.contains('av3d-tools-open'))));
 }
 function sync(){if(!screen.classList.contains('active'))return;
  const text=id=>$(id)?.textContent||'';
  $('av3d-hud-season').textContent=text('sim-season').replace(' / ','/');
  $('av3d-hud-day').textContent='Day '+text('sim-day');
  $('av3d-hud-credits').textContent=text('sim-budget');
  $('av3d-hud-water').textContent=text('sim-water');
  $('av3d-hud-soil').textContent=text('sim-soil');
  const grow=$('sim-grow'),harvest=$('sim-harvest');
  dock.querySelector('[data-av3d="grow"]').disabled=!!grow?.disabled;
  dock.querySelector('[data-av3d="grow"]').querySelector('.av3d-icon').textContent=grow?.textContent?.includes('Pause')?'Ⅱ':'▶';
  dock.querySelector('[data-av3d="harvest"]').disabled=!!harvest?.disabled;
  const readyForNext=!!$('sim-next')&&!$('sim-next').hidden;
  dock.querySelector('[data-av3d="next"]').hidden=!readyForNext;
  dock.querySelector('[data-av3d="replay"]').hidden=!readyForNext;
  dock.querySelector('[data-av3d="grow"]').hidden=readyForNext;
  dock.querySelector('[data-av3d="harvest"]').hidden=readyForNext;
  dock.querySelector('[data-av3d="next"]').querySelector('.av3d-icon').textContent='→';
  dock.querySelector('[data-av3d="next"]').lastChild.textContent=readyForNext&&$('sim-next').textContent.includes('results')?'Results':'Next year';
 }
 screen.addEventListener('click',e=>{
  const button=e.target.closest('[data-av3d]');
  if(button){const a=button.dataset.av3d;
   if(a==='close')closePanels();else if(a==='status'||a==='plant'||a==='care')openPanel(a);
   else if(a==='grow')$('sim-grow')?.click();else if(a==='harvest')$('sim-harvest')?.click();else if(a==='next')$('sim-next')?.click();else if(a==='replay')$('sim-replay-year')?.click();
   queueMicrotask(sync);return;
  }
  if(e.target.closest('#av3d-light')){const evening=screen.classList.toggle('sim-evening');light.textContent=evening?'🌙':'☀️';light.title=evening?'Switch to day':'Switch to evening';return}
  if(e.target.closest('#av3d-fullscreen')){
   if(document.fullscreenElement){document.exitFullscreen?.().catch(()=>{})}
   else{screen.requestFullscreen?.().catch(()=>{})}return;
  }
  queueMicrotask(sync);
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&screen.classList.contains('active'))closePanels()});
 new MutationObserver(()=>{if(!screen.classList.contains('active'))closePanels();sync()}).observe(screen,{attributes:true,attributeFilter:['class']});
 const stats=left.querySelector('.sim-season');if(stats)new MutationObserver(sync).observe(left,{subtree:true,characterData:true,childList:true});
 const controls=right.querySelector('.sim-controls');if(controls)new MutationObserver(sync).observe(controls,{subtree:true,characterData:true,childList:true,attributes:true,attributeFilter:['disabled']});
 sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
