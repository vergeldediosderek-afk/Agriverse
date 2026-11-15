/* AgriVerse Future Farmer — Sprig companion, location setup and disaster decision missions.
   Educational game only: events, consequences and credits are simulated, NOT live warnings.
   Entirely standalone single-player Future Farmer; no Real Farmer mode. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
let root,setup,dialog,avatar,trigger,banner,sceneAlert,sceneTimeout=null,context=null,terrain='lowland',dialogKind='',lastDialogue=null;
let setupVisible=false,dialogVisible=false;
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mascotSvg=`<svg class="sprig-svg" viewBox="0 0 160 175" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
 <ellipse cx="79" cy="158" rx="47" ry="8" fill="#145d4a" opacity=".13"/>
 <path d="M80 64C54 48 40 25 43 12c28-3 43 14 43 43" fill="#6fca7b" stroke="#2d875d" stroke-width="5" stroke-linejoin="round"/>
 <path d="M81 64c9-32 31-43 49-35-1 29-19 43-49 44" fill="#91db79" stroke="#2d875d" stroke-width="5" stroke-linejoin="round"/>
 <path d="M80 68c-1-13-1-21 0-28" fill="none" stroke="#317f58" stroke-width="6" stroke-linecap="round"/>
 <path d="M38 100c-19-10-29-7-28 1 2 11 19 18 30 17" fill="#6cc07b" stroke="#2b805e" stroke-width="4"/>
 <path d="M119 100c19-10 29-7 28 1-2 11-19 18-30 17" fill="#6cc07b" stroke="#2b805e" stroke-width="4"/>
 <path d="M80 62c-30 0-52 21-52 51 0 31 23 50 52 50 30 0 52-19 52-50 0-30-22-51-52-51z" fill="#b9eea0" stroke="#267f58" stroke-width="5"/>
 <path d="M45 85c16-21 55-25 76 0" fill="none" stroke="#e2ffbc" stroke-width="9" stroke-linecap="round" opacity=".55"/>
 <ellipse class="sprig-eye" cx="61" cy="112" rx="5.8" ry="8.2" fill="#214e42"/><ellipse class="sprig-eye" cx="99" cy="112" rx="5.8" ry="8.2" fill="#214e42"/>
 <circle cx="46" cy="124" r="8" fill="#f6a9a3" opacity=".7"/><circle cx="114" cy="124" r="8" fill="#f6a9a3" opacity=".7"/>
 <path class="sprig-smile" d="M72 131q8 9 16 0" stroke="#245a48" stroke-width="4.5" fill="none" stroke-linecap="round"/>
 <path class="sprig-worry" d="M72 136q8-9 16 0" stroke="#245a48" stroke-width="4.5" fill="none" stroke-linecap="round"/>
 </svg>`;
const presetInfo={
 lowland:{icon:'🌾',name:'Lowland farm',desc:'Wide, level green fields with an irrigation canal, orchard and animal pens. Practice balanced planting and drainage.',soil:'Loam · practice assumption',water:'Rainfed · practice assumption'},
 hillside:{icon:'⛰️',name:'Hillside farm',desc:'Three elevated growing terraces, stone retaining walls, mountain ridges and pine trees. Practice soil protection and erosion.',soil:'Loam · practice assumption',water:'Rainfed · practice assumption'},
 riverside:{icon:'💧',name:'Riverside farm',desc:'A wide winding blue river, wooden bridge, sandy banks, reeds and embanked fields. Practice flood readiness and drainage.',soil:'Alluvial soil · practice assumption',water:'Nearby water · not guaranteed irrigation'}
};
function build(){
 root=$('screen-simulation');if(!root||root.querySelector('#av-setup'))return;
 const holder=document.createElement('div');holder.className='av-adventure';holder.innerHTML=`
 <div class="av-setup" id="av-setup" hidden role="dialog" aria-modal="true" aria-labelledby="av-setup-title">
  <div class="av-setup-shell">
   <div class="av-setup-story"><span class="av-overline">AGRIVERSE · FUTURE FARMER</span><div class="av-setup-mascot">${mascotSvg}</div><span class="av-story-bubble">Hi, I'm <strong>Sprig!</strong> 🌱<br>Let's grow a resilient farm together.</span><div class="av-story-caption">A single-player farming adventure with meaningful decisions and simulated weather challenges.</div></div>
   <div class="av-setup-content"><div class="av-setup-header"><span class="av-overline">YOUR FARMING ADVENTURE</span><button type="button" id="av-setup-exit" aria-label="Exit to welcome">✕</button></div>
    <h2 id="av-setup-title">Where shall we grow?</h2><p id="av-setup-subtitle">Choose a practice landscape and starting month.</p>
    <div class="av-preset-grid" id="av-presets">
     <button type="button" class="av-preset" data-terrain="lowland"><span>🌾</span><b>Lowland</b><small>Level fields · canal</small></button>
     <button type="button" class="av-preset" data-terrain="hillside"><span>⛰️</span><b>Hillside</b><small>Raised terraces · peaks</small></button>
     <button type="button" class="av-preset" data-terrain="riverside"><span>💧</span><b>Riverside</b><small>River · bridge · reeds</small></button>
    </div>
    <div class="av-land-info" id="av-land-info" aria-live="polite"></div><label class="av-start-month-label" for="av-start-month">Planting month <select id="av-start-month"><option value="1">January</option><option value="2">February</option><option value="3">March</option><option value="4">April</option><option value="5">May</option><option value="6">June</option><option value="7">July</option><option value="8">August</option><option value="9">September</option><option value="10">October</option><option value="11">November</option><option value="12">December</option></select></label><div class="av-field-outline" id="av-field-outline" hidden></div>
    <div class="av-setup-actions"><button type="button" class="av-main-action" id="av-start-practice">Start practice farm <span>→</span></button><button type="button" class="av-map-action" id="av-map-real">⌖ Map my own plot</button></div>
    <p class="av-truth-note">Simulation only · The 3D terrain is stylized. Real elevation, nutrient levels, flood forecasts and exact field terrain are <b>not yet connected</b>.</p>
   </div>
  </div>
 </div>
 <button type="button" id="av-sprig-button" class="av-sprig-button" title="Talk to Sprig" aria-label="Talk to Sprig" aria-expanded="false">${mascotSvg}<span class="av-sprig-notification">?</span></button>
 <div id="av-sprig-dialog" class="av-sprig-dialog" role="dialog" aria-modal="false" aria-labelledby="av-dialog-title" hidden>
  <div class="av-dialog-top"><span class="av-dialog-avatar">${mascotSvg}</span><span class="av-dialog-who"><b>SPRIG</b><small id="av-dialog-role">Your farm companion</small></span><span class="av-dialog-chip" id="av-dialog-chip">MISSION GUIDE</span><button type="button" class="av-dialog-close" id="av-dialog-close" aria-label="Minimize Sprig">✕</button></div>
  <div class="av-dialog-body"><h3 id="av-dialog-title"></h3><p id="av-dialog-text"></p><div class="av-dialog-choices" id="av-dialog-choices"></div></div>
  <div class="av-dialog-foot"><span>🌱 Learn by doing</span><button type="button" id="av-dialog-replay">↻ Replay guide</button></div>
 </div>
 <div class="av-adventure-hud" id="av-adventure-hud" hidden><span class="av-hud-mark">⌖</span><div><b id="av-farm-name">Practice farm</b><small id="av-farm-data">Stylized 3D · educational simulation</small></div><button id="av-farm-info" type="button">Details</button></div>
 <div class="av-scenario-chip" id="av-scenario-chip" hidden><span>◉</span><span id="av-scenario-label">Disaster drill · Day 3</span></div>
 <div class="av-scene-event" id="av-scene-event" hidden aria-hidden="true"><span id="av-scene-event-icon">☀️</span><b id="av-scene-event-title">Dry spell</b><small>SIMULATED EVENT</small></div>
 </div>`;
 root.appendChild(holder);setup=$('av-setup');dialog=$('av-sprig-dialog');avatar=$('av-sprig-button');banner=$('av-scenario-chip');sceneAlert=$('av-scene-event');
 root.addEventListener('click',handleClick);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&root.classList.contains('active')){if(dialogVisible)hideDialog();else if(!setupVisible)avatar?.focus()}});
 window.addEventListener('avsim:warning',e=>{const sc=e.detail.scenario;showDialogue('warning',{scenario:sc});});
 window.addEventListener('avsim:decision',e=>{const c=e.detail.choice;showDialogue('prepared',{choice:c});});
 window.addEventListener('avsim:impact',e=>{const {scenario,choice,state}=e.detail;showSceneEvent(scenario);showDialogue('impact',{scenario,choice,state});updateHud()});
 window.addEventListener('avsim:season',()=>{updateHud();showDialogue('season')});
 window.addEventListener('avsim:finish',()=>{updateHud();showDialogue('finish')});
 window.addEventListener('avsim:reset',()=>{clearTimeout(sceneTimeout);if(sceneAlert)sceneAlert.hidden=true;root?.classList.remove('av-hazard-drought','av-hazard-flood','av-hazard-erosion','av-hazard-wind');updateHud();if(!setupVisible&&root?.classList.contains('active'))showDialogue('welcome')});
 window.addEventListener('avsim:farm',updateHud);
 chooseTerrain('lowland');
}
function chooseTerrain(id){terrain=presetInfo[id]?id:'lowland';if(root)root.dataset.farmTheme=terrain;root.querySelectorAll('[data-terrain]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.terrain===terrain)));const p=presetInfo[terrain];$('av-land-info').innerHTML=`<b>${p.icon} ${p.name}</b><span>${p.desc}</span><small>Each option has its own 3D scenery. All environments are fictional learning examples.</small>`;}
function fieldOutline(points){
 if(!Array.isArray(points)||points.length<3)return '';
 const lat=points.reduce((s,p)=>s+Number(p[0]),0)/points.length;
 const c=Math.cos(lat*Math.PI/180);
 const xy=points.map(p=>[Number(p[1])*c,-Number(p[0])]);
 const xs=xy.map(p=>p[0]),ys=xy.map(p=>p[1]);
 const minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);
 const range=Math.max(maxx-minx,maxy-miny,1e-7),scale=90/range;
 const poly=xy.map(p=>`${(p[0]-(minx+maxx)/2)*scale+60},${(p[1]-(miny+maxy)/2)*scale+60}`).join(' ');
 return `<svg viewBox="0 0 120 120" role="img" aria-label="Outline of the selected farm polygon"><rect x="1" y="1" width="118" height="118" rx="18" fill="#dff4d9"/><path d="M14 20L106 20M14 60L106 60M14 100L106 100M20 14L20 106M60 14L60 106M100 14L100 106" stroke="#c4e4c7" stroke-width="1"/><polygon points="${poly}" fill="#5eae75" fill-opacity=".55" stroke="#1d7958" stroke-width="3" stroke-linejoin="round"/></svg><div><b>Your saved farm shape</b><small>${points.length} mapped corners · approximate footprint only</small></div>`;
}
function showSetup(ctx){
 context=ctx||null;setupVisible=true;setup.hidden=false;window.AVFarm3D?.current?.stop();hideDialog();avatar.hidden=true;$('av-adventure-hud').hidden=true;banner.hidden=true;const outline=$('av-field-outline');outline.hidden=!(context?.points?.length>=3);outline.innerHTML=context?.points?.length>=3?fieldOutline(context.points):'';
 if(context?.points?.length>=3){
  $('av-setup-title').textContent='Your plot. Your adventure.';
  $('av-setup-subtitle').textContent=`Farm boundary saved: ${context.location||'selected location'} · ${Number(context.area||0).toFixed(2)} ha. Choose an illustrative landscape to practice on.`;
  $('av-start-practice').innerHTML='Enter my virtual farm <span>→</span>';
  $('av-map-real').textContent='⌖ Redraw my plot';
 }else{
  $('av-setup-title').textContent='Where shall we grow?';
  $('av-setup-subtitle').textContent='Choose a practice landscape, or map your own farm boundary.';
  $('av-start-practice').innerHTML='Start practice farm <span>→</span>';
  $('av-map-real').textContent='⌖ Map my own plot';
 }
 $('av-start-month').value = String(window.AVFutureSim?.publicState()?.month || 1);
 setup.querySelector('.av-setup-content').scrollTop=0;
 setTimeout(()=>$('av-start-practice')?.focus({preventScroll:true}),50);
}
function startFarm(){
 window.AVFutureSim?.reset();const p=presetInfo[terrain];
 const month = Number($('av-start-month').value || 1);
 const mapped = context?.points?.length >= 3;
 window.AVFutureSim?.configureFarm({mode:'practice',terrain,label:mapped ? context.location : p.name,
  soil:p.soil,water:p.water,month,mapped: mapped ? {area:context.area,points:context.points} : null});
 setupVisible=false;setup.hidden=true;window.AVFarm3D?.current?.start();avatar.hidden=false;$('av-adventure-hud').hidden=false;updateHud();showDialogue('welcome');
}
function hideDialog(){dialogVisible=false;if(dialog)dialog.hidden=true;avatar?.setAttribute('aria-expanded','false');root?.classList.remove('av-dialog-open')}
function showDialogue(kind,data={}){
 if(!root?.classList.contains('active')||setupVisible)return;
 dialogKind=kind;lastDialogue={kind,data};dialogVisible=true;dialog.hidden=false;avatar.hidden=false;avatar.setAttribute('aria-expanded','true');root.classList.add('av-dialog-open');
 const title=$('av-dialog-title'),body=$('av-dialog-text'),choices=$('av-dialog-choices'),role=$('av-dialog-role'),chip=$('av-dialog-chip');
 const st=window.AVFutureSim?.publicState?.();const sc=data.scenario||st?.scenario;
 let mood='happy',options=[];
 if(kind==='welcome'){
  title.textContent='Welcome to your farm!';body.textContent=`Welcome to your ${presetInfo[st?.farm?.terrain]?.name||'practice farm'}! ${presetInfo[st?.farm?.terrain]?.desc||''} Complete 20 learning tasks across five growing years. Plant crops, practice rotation, protect soil and water, and prepare for simulated hazards.`;
  options=[{label:'Show my first mission →',act:'mission',primary:true},{label:'Explore the farm',act:'close'}];
 }else if(kind==='season'||kind==='mission'){
  title.textContent=`Year ${(st?.season??0)+1}: ${sc?.title||'Your next challenge'}`;
  const mq=st?.missions;const next=mq?.next;body.textContent=`Your Year ${(st?.season??0)+1} academy progress is ${mq?.done??0}/4 tasks. ${next?'Next: '+next.title+'. '+next.next:'Fantastic—you completed all four learning tasks!'} Open Mission on the toolbar to see the checklist. The weather scenarios and points are fictional.`;
  options=[{label:'Open planting tools →',act:'plant',primary:true},{label:'Got it',act:'close'}];
 }else if(kind==='warning'){
  mood='worried';title.textContent=`${sc.icon} ${sc.title}`;role.textContent='Disaster preparedness';chip.textContent='SIMULATED WARNING';
  body.textContent=`Farmer! ${sc.summary} It's Day 3. Choose how to prepare before the simulated event on Day 5. You must decide to continue.`;
  options=sc.choices.map(c=>({label:`${c.label} · ${c.cost} cr`,note:c.benefit,act:'decision',value:c.id,primary:c.id!== 'wait'}));
 }else if(kind==='prepared'){
  title.textContent='Good decision-making!';body.textContent=`${data.choice.label}: ${data.choice.benefit}. Advance to Day 5 to see the simulated outcome. Your preparation used ${data.choice.cost} game credits.`;
  options=[{label:'Continue growing →',act:'close',primary:true}];
 }else if(kind==='impact'){
  mood='worried';title.textContent=`${sc.icon} The event has passed`;
  body.textContent=`${sc.impact} You chose: ${data.choice.label}. Your farm now has ${Math.round(data.state.water)}/100 water and ${Math.round(data.state.soil)}/100 soil health. Compare your outcome by replaying with another strategy.`;
  options=[{label:'Check my farm →',act:'status',primary:true},{label:'Continue',act:'close'}];
 }else if(kind==='finish'){
  mood='celebrate';title.textContent='You did it, farmer! 🎉';body.textContent=`Five years completed! You earned ${st?.missions?.earned??0}/20 mission achievements. Check your learning report, then replay to explore different strategies.`;
  options=[{label:'View results →',act:'close',primary:true}];
 }else if(kind==='farm'){
  title.textContent='About your virtual land';const f=st?.farm;
  body.textContent=`${f?.location||'Practice farm'} · starting month ${st?.month||1}. Soil conditions, water budget, weather and gameplay consequences are fictional. Crop requirement ranges are sourced from your uploaded crop CSV.`;
  options=[{label:'Got it',act:'close',primary:true}];
 }else{
  title.textContent='Need a hand?';body.textContent=`You have completed ${st?.missions?.done??0}/4 learning tasks this year. ${st?.missions?.next?.next||'All tasks completed—continue your farming journey!'} Plant crops, protect your resources, and check Mission for the explanation behind each task.`;
  options=[{label:'Show mission',act:'mission',primary:true},{label:'Open planting tools',act:'plant'},{label:'Close',act:'close'}];
 }
 role.textContent=kind==='warning'?'Disaster preparedness':kind==='impact'?'After-action review':'Your farming companion';
 chip.textContent=kind==='warning'?'SIMULATED WARNING':kind==='impact'?'MISSION RESULT':'FARM GUIDE';
 dialog.dataset.mood=mood;avatar.dataset.mood=mood;
 choices.innerHTML=options.map(o=>`<button type="button" class="${o.primary?'av-choice-primary':''}" data-av-act="${o.act}" ${o.value?`data-av-choice="${escapeHtml(o.value)}"`:''}>${escapeHtml(o.label)}${o.note?`<small>${escapeHtml(o.note)}</small>`:''}</button>`).join('');
 if(kind==='warning'||kind==='impact'){root.classList.remove('av3d-tools-open','av3d-status-open')}
 if(kind==='warning'){$('av-dialog-close').title='Minimize; reopen Sprig to make a decision';}
 updateHud();
}
function showSceneEvent(scenario){
 sceneAlert.hidden=false;sceneAlert.dataset.event=scenario.id;$('av-scene-event-icon').textContent=scenario.icon;$('av-scene-event-title').textContent=scenario.title;
 root.classList.remove('av-hazard-drought','av-hazard-flood','av-hazard-erosion','av-hazard-wind');root.classList.add('av-hazard-'+scenario.id);
 clearTimeout(sceneTimeout);sceneTimeout=setTimeout(()=>{sceneAlert.hidden=true;root.classList.remove('av-hazard-drought','av-hazard-flood','av-hazard-erosion','av-hazard-wind')},3000);
}
function updateHud(){
 const st=window.AVFutureSim?.publicState?.();if(!st||!root)return;
 const f=st.farm;if(!setupVisible&&presetInfo[f?.terrain])root.dataset.farmTheme=f.terrain;$('av-farm-name').textContent=f?.location||'Practice farm';
 $('av-farm-data').textContent=`${presetInfo[f?.terrain]?.name||'Practice landscape'} · ${st.month||1}/12 · simulated`; 
 $('av-scenario-label').textContent=st.eventPending?'Decision needed · Sprig is waiting':st.eventImpacted?'Hazard drill completed':`Simulated ${st.scenario?.id||'hazard'} · Day 3`;
 banner.hidden=setupVisible||!f||st.finished;
}
function handleClick(e){
 const preset=e.target.closest('[data-terrain]');if(preset){chooseTerrain(preset.dataset.terrain);return}
 if(e.target.closest('#av-setup-exit')){setup.hidden=true;setupVisible=false;$('sim-exit')?.click();return}
 if(e.target.closest('#av-map-real')){setup.hidden=true;setupVisible=false;window.AVStartFutureMapping?.();return}
 
 if(e.target.closest('#av-start-practice')){startFarm();return}
 if(e.target.closest('#av-sprig-button')){if(dialogVisible)hideDialog();else showDialogue(window.AVFutureSim?.publicState?.()?.eventPending?'warning':'help');return}
 if(e.target.closest('#av-dialog-close')){hideDialog();return}
 if(e.target.closest('#av-dialog-replay')){showDialogue('welcome');return}
 if(e.target.closest('#av-farm-info')){showDialogue('farm');return}
 const act=e.target.closest('[data-av-act]');if(!act)return;
 const a=act.dataset.avAct;
 if(a==='decision'){
  const ok=window.AVFutureSim?.chooseDisaster(act.dataset.avChoice);
  if(!ok){const t=$('av-dialog-text');t.textContent='Not enough game credits for that choice. Select a lower-cost preparation.';return}return;
 }
 if(a==='mission'){showDialogue('mission');return}
 if(a==='plant'){hideDialog();root.classList.remove('av3d-status-open');root.classList.add('av3d-tools-open');return}
 if(a==='status'){hideDialog();root.classList.remove('av3d-tools-open');root.classList.add('av3d-status-open');return}
 if(a==='close'){hideDialog();return}
}
function onEnter(ctx){if(!root)build();if(!root)return;showSetup(ctx);}
window.AVAdventure={onEnter,showMission:()=>showDialogue('mission'),debug:()=>({setupVisible,dialogVisible,dialogKind,terrain,context})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
})();
