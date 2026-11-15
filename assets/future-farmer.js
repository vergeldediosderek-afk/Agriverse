/* AgriVerse Future Farmer: single-player five-year educational farm.
   CSV crop characteristics are used for approximate trait comparisons ONLY.
   No game climate, earnings, yield, soil values or hazards are measured or predicted. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const money=n=>Math.round(n).toLocaleString('en-PH');
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const catalog=window.AV_CROP_CATALOG;
const crops=(catalog?.playable||[]).map(c=>({...c,type:c.group,tip:`Uploaded CSV · ${c.scientific} · optimal ${c.tempOpt.join('–')}°C; pH ${c.phOpt.join('–')}; rainfall ${c.rainOpt.join('–')} mm/year.`,soil:c.soil}));
const cropById=new Map(crops.map(c=>[c.id,c]));
const crop=id=>cropById.get(String(id))||crops[0];
const actions=[
 {id:'mulch',name:'Mulch',emoji:'🍃',cost:140,desc:'+12 game water points',water:12,soil:0},
 {id:'compost',name:'Compost',emoji:'♻️',cost:175,desc:'+12 game soil points',water:0,soil:12},
 {id:'irrigate',name:'Irrigate',emoji:'💧',cost:230,desc:'+27 game water points',water:27,soil:0},
 {id:'drain',name:'Drainage',emoji:'〰️',cost:170,desc:'Reduce heavy-rain game impacts',water:0,soil:0}
];
const YEARS=[
 {title:'Dry spell',emoji:'☀️',weather:'Fictional drought preparedness',objective:'Conserve water',mission:'Finish Year 1 with at least 25 water points.',rain:1,kind:'dry'},
 {title:'Heavy rainfall',emoji:'🌧️',weather:'Fictional flooding risk',objective:'Try crop rotation',mission:'Harvest a legume where a cereal previously grew.',rain:7,kind:'wet'},
 {title:'Strong winds',emoji:'🌪️',weather:'Fictional wind scenario',objective:'Protect your farm',mission:'Finish Year 3 with soil ≥ 55 and positive game credits.',rain:3,kind:'wind'},
 {title:'Soil challenge',emoji:'🌿',weather:'Fictional extreme rain and erosion',objective:'Rebuild soil health',mission:'Finish Year 4 with soil ≥ 60.',rain:5,kind:'wet'},
 {title:'Future resilience',emoji:'🌎',weather:'Fictional combined climate challenge',objective:'Build a resilient farm',mission:'Finish with soil ≥ 60, water ≥ 25, and positive game credits.',rain:2,kind:'dry'}
];
const emptyPlot=()=>({crop:null,age:0,maturity:0,stress:0,animFrom:0,animStart:0});
const create=()=>({season:0,day:1,soil:68,water:74,budget:4300,score:0,crop:crops[0]?.id||'',action:'mulch',selected:new Set([5]),plots:Array.from({length:12},emptyPlot),lastByPlot:Array(12).fill(null),lastGroupByPlot:Array(12).fill(null),history:[],missionWins:0,seasonSpend:0,seasonRevenue:0,seasonHarvested:0,seasonLegumeRotation:false,seasonHarvestedLegume:false,seasonDrainage:false,priorCerealAtStart:false,questPlanted:0,questPlantedFamilies:[],questHarvestedFamilies:[],questCare:[],questCreditsEarned:0,questAwards:{},questHistory:[],lastQuestLesson:null,finished:false,playing:false,farm:null,month:6,eventPending:false,eventDecision:null,eventImpacted:false,message:'Tap a numbered field to select it, then choose a crop.',messageTitle:'Welcome to your virtual farm', yearStart:null,previousFuture:null,comparison:null});
let sim=create(),world=null,hasOpened=false,timer=null,search='',yearInitialScore=0;
const year=()=>YEARS[sim.season];
const action=id=>actions.find(a=>a.id===id)||actions[0];
const emit=(type,detail={})=>window.dispatchEvent(new CustomEvent('avsim:'+type,{detail}));
const copy=(o)=>JSON.parse(JSON.stringify(o));
const snapshot=()=>({season:sim.season,day:sim.day,soil:sim.soil,water:sim.water,budget:sim.budget,score:sim.score,month:sim.month,
 plots:sim.plots.map(p=>({...p})),lastByPlot:sim.lastByPlot.slice(),lastGroupByPlot:(sim.lastGroupByPlot||Array(12).fill(null)).slice(),history:sim.history.map(x=>({...x})),missionWins:sim.missionWins,
 seasonSpend:sim.seasonSpend,seasonRevenue:sim.seasonRevenue,seasonHarvested:sim.seasonHarvested,
 seasonLegumeRotation:sim.seasonLegumeRotation,seasonHarvestedLegume:sim.seasonHarvestedLegume,
 seasonDrainage:sim.seasonDrainage,priorCerealAtStart:sim.priorCerealAtStart,questPlanted:sim.questPlanted,questPlantedFamilies:sim.questPlantedFamilies.slice(),questHarvestedFamilies:sim.questHarvestedFamilies.slice(),questCare:sim.questCare.slice(),questCreditsEarned:sim.questCreditsEarned,questAwards:{...sim.questAwards},questHistory:sim.questHistory.map(x=>({...x})),lastQuestLesson:sim.lastQuestLesson,eventPending:sim.eventPending,eventDecision:sim.eventDecision,
 eventImpacted:sim.eventImpacted,finished:sim.finished,crop:sim.crop,action:sim.action,farm:sim.farm});
const restore=state=>{Object.assign(sim,copy(state));sim.selected=new Set([5]);sim.playing=false;sim.messageTitle='Try a different future';sim.message='The year was rewound. Change your crop rotation or disaster response and compare results.';world?.setState(sim);};
function startCheckpoint(){sim.yearStart=snapshot();yearInitialScore=sim.score;}
function terrainPH(){return sim.farm?.terrain==='hillside'?5.4:sim.farm?.terrain==='riverside'?6.6:6.1;}
function climate(){
 // Deliberately fictional teaching examples. They are NOT seasonal climatologies of Valencia City.
 const month=sim.month,wet=[6,7,8,9,10].includes(month),dry=[1,2,3,4].includes(month);
 return {temp:(dry?29:wet?26:27)+(sim.farm?.terrain==='hillside'?-2:0), annualRain:dry?800:wet?2100:1400,ph:terrainPH(),kind:wet?'wet':dry?'dry':'transition'};
}
function rangeScore(x,opt,absolute){
 if(!Array.isArray(opt)||opt.some(v=>v==null))return {score:null,reason:'No range'};
 const [lo,hi]=opt.map(Number);if(!Number.isFinite(lo)||!Number.isFinite(hi)||hi<lo)return {score:null,reason:'No range'};
 if(x>=lo&&x<=hi)return {score:100,reason:'Within recorded optimum'};
 if(Array.isArray(absolute)&&absolute.every(v=>v!=null)){
  const [amin,amax]=absolute.map(Number);if(x<amin||x>amax)return {score:10,reason:'Outside recorded tolerance'};
 }
 return {score:Math.round(clamp(100-33*Math.abs(x-(x<lo?lo:hi))/(Math.max(1,hi-lo)),25,80)),reason:'Outside optimum'};
}
function matchFor(c){
 const k=climate();const checks=[rangeScore(k.temp,c.tempOpt,c.tempAbs),rangeScore(k.annualRain,c.rainOpt,c.rainAbs),rangeScore(k.ph,c.phOpt,c.phAbs)];
 const known=checks.filter(o=>o.score!=null);
 const pct=known.length?Math.round(known.reduce((a,x)=>a+x.score,0)/known.length):null;
 return {pct,temp:checks[0],rain:checks[1],ph:checks[2],environment:k};
}
const scenarioFor=()=>{
 const hillside=sim.farm?.terrain==='hillside',riverside=sim.farm?.terrain==='riverside';
 const base=sim.season===0?{
  id:'drought',icon:'☀️',title:'Dry spell approaching',summary:'A simulated dry spell will challenge farm water reserves.',impact:'The fictional dry spell affected unprotected crops.',waterLoss:20,soilLoss:3,stress:3,
  choices:[{id:'mulch',label:'Protect soil with mulch',cost:140,benefit:'Reduces game water loss',protect:2,water:9,soil:0,score:25},{id:'irrigate',label:'Plan emergency irrigation',cost:260,benefit:'Adds more game water at higher cost',protect:2,water:22,soil:0,score:23},{id:'wait',label:'Take no action',cost:0,benefit:'Save credits but accept greater stress',protect:0,water:0,soil:0,score:0}]
 }:sim.season===1?{
  id:'flood',icon:'🌧️',title:'Heavy rainfall approaching',summary:'Simulated intense rainfall could waterlog your fields.',impact:'Excess game water stressed poorly protected crops.',waterLoss:-16,soilLoss:9,stress:3,
  choices:[{id:'drain',label:'Improve drainage',cost:170,benefit:'Reduces simulated waterlogging',protect:2,water:0,soil:5,score:25},{id:'cover',label:'Cover exposed soil',cost:130,benefit:'Reduces simulated soil loss',protect:1,water:0,soil:9,score:18},{id:'wait',label:'Take no action',cost:0,benefit:'No cost but greater fictional damage',protect:0,water:0,soil:0,score:0}]
 }:sim.season===2?{
  id:'wind',icon:'🌪️',title:'Strong winds approaching',summary:'A fictional storm could damage growing plants.',impact:'Strong winds affected unprotected crops.',waterLoss:4,soilLoss:4,stress:3,
  choices:[{id:'secure',label:'Secure plant supports',cost:185,benefit:'Reduces simulated wind damage',protect:2,water:0,soil:0,score:26},{id:'shelter',label:'Shelter young plants',cost:130,benefit:'Partly protects growing crops',protect:1,water:0,soil:0,score:16},{id:'wait',label:'Take no action',cost:0,benefit:'No preparation cost',protect:0,water:0,soil:0,score:0}]
 }:sim.season===3?{
  id:hillside?'erosion':'flood',icon:hillside?'⛰️':riverside?'🌊':'🌧️',title:hillside?'Hillside erosion warning':riverside?'River overflow practice drill':'Heavy rain and soil loss',summary:'A simulated intense-rain event threatens uncovered soil.',impact:'Rainfall caused fictional runoff and soil losses.',waterLoss:-8,soilLoss:hillside?19:13,stress:2,
  choices:[{id:'cover',label:'Protect exposed soil',cost:175,benefit:'Limits simulated soil erosion',protect:2,water:0,soil:11,score:30},{id:'drain',label:'Manage runoff',cost:170,benefit:'Partially mitigates runoff',protect:1,water:0,soil:6,score:22},{id:'wait',label:'Take no action',cost:0,benefit:'Higher soil-loss risk',protect:0,water:0,soil:0,score:0}]
 }: {
  id:'resilience',icon:'🌎',title:'Climate stress test',summary:'The final year combines simulated scarce water and strong winds.',impact:'Fictional combined stress affected your crops and resources.',waterLoss:17,soilLoss:8,stress:4,
  choices:[{id:'mulch',label:'Invest in water and soil protection',cost:195,benefit:'Protects both resources',protect:2,water:13,soil:8,score:34},{id:'secure',label:'Prioritize structural protection',cost:160,benefit:'Protects plants but not water reserves',protect:2,water:0,soil:0,score:24},{id:'wait',label:'Take no action',cost:0,benefit:'No up-front cost but more stress',protect:0,water:0,soil:0,score:0}]
 };
 return base;
};
/* Guided learning challenges: tracked from real player actions, not randomized rewards.
   3 core tasks + 1 optional bonus in each of 5 virtual years. */
let questTipOpen=null;
const qDone=(id)=>!!sim.questAwards[`${sim.season}-${id}`];
const makeQuest=(id,emoji,title,goal,value,lesson,next,bonus=false)=>({id,emoji,title,goal,value:Math.min(value,goal),lesson,next,bonus,done:qDone(id)});
const hasHazardPrep=()=>!!sim.eventDecision&&sim.eventDecision.id!=='wait';
const hasCare=(id)=>sim.questCare.includes(id);
const harvestStarted=()=>sim.seasonHarvested>0;
function currentQuests(){
 const terrain=sim.farm?.terrain||'lowland';
 const plantedGroups=sim.questPlantedFamilies.length,harvestGroups=sim.questHarvestedFamilies.length;
 const prepared=hasHazardPrep()?1:0,completion=harvestStarted()?1:0;
 if(sim.season===0)return [
  makeQuest('start','🌱','Plant your first field',2,sim.questPlanted,'Planting is the beginning of every farming plan. Crop requirements vary, so choosing a crop is a trade-off.','Plant on two empty plots.'),
  makeQuest('watercare','💧','Prepare for dry weather',1,(hasCare('mulch')||hasCare('irrigate')||prepared)?1:0,'Mulch can reduce soil evaporation; irrigation adds water but requires resources. Their effects depend on local conditions.','Apply mulch or irrigation, or select a protective drought response.'),
  makeQuest('watergoal','🛡️','Protect your water reserve',1,completion&&sim.water>=25?1:0,'Saving water preserves options for later seasons. The 25-point target is a fictional game benchmark.','Harvest a crop, then keep water at 25 or more.'),
  makeQuest('cereal','🌽','Prepare for next year’s rotation',1,sim.questHarvestedFamilies.includes('Cereal')?1:0,'A cereal followed by an appropriate legume can diversify crop families. Rotation benefits depend on management and soil conditions.','Grow and harvest one cereal crop.',true)
 ];
 if(sim.season===1){
  const rotation=sim.priorCerealAtStart;
  const bonus=terrain==='hillside'
   ?makeQuest('terrain','⛰️','Protect a hillside',1,(sim.eventDecision?.id==='cover'||hasCare('mulch'))?1:0,'Slopes can be vulnerable to runoff and soil erosion when soil is exposed.','Choose soil cover during the storm or apply mulch.',true)
   :terrain==='riverside'
   ?makeQuest('terrain','🌊','Practice flood drainage',1,(sim.eventDecision?.id==='drain'||sim.seasonDrainage)?1:0,'Drainage can reduce waterlogging; actual field drainage must respect downstream water conditions.','Use drainage care or choose drainage during the event.',true)
   :makeQuest('terrain','🌾','Diversify your lowland field',2,harvestGroups,'Growing different crop families can spread management risk.','Harvest crops from two families.',true);
  return [
   makeQuest('rotation','🔄',rotation?'Try cereal-to-legume rotation':'Create a diverse rotation plan',1,rotation?(sim.seasonLegumeRotation?1:0):(sim.questHarvestedFamilies.includes('Legume')&&harvestGroups>=2?1:0),'Crop rotation can help disrupt some crop-specific pest cycles and improve diversity; benefits are context-dependent.',rotation?'Harvest a legume on a plot that grew a cereal last year.':'No cereal was harvested last year. Harvest a legume and one other crop family.'),
   makeQuest('rainprep','🌧️','Prepare for heavy rainfall',1,(sim.seasonDrainage||['drain','cover'].includes(sim.eventDecision?.id))?1:0,'Heavy rain can cause waterlogging and runoff. Drainage and protective ground cover address different risks.','Apply drainage care, or choose drainage/soil cover in the warning.'),
   makeQuest('soilgoal','🌿','Keep your soil healthy',1,completion&&sim.soil>=55?1:0,'Soil-health points simplify several real soil properties. The score is educational, not a soil laboratory result.','Complete a harvest with at least 55 soil points.'),
   bonus
  ];
 }
 if(sim.season===2)return [
  makeQuest('mix','🌻','Plant a diverse field',2,plantedGroups,'Different crop families may have different growth and management requirements, which can help spread risk.','Plant crops from two different families.'),
  makeQuest('wind','🌪️','Protect against strong winds',1,(sim.eventDecision&&['secure','shelter'].includes(sim.eventDecision.id))?1:0,'Supports or shelter can reduce some wind damage, but severe events can overwhelm farm protections.','Choose supports or shelter when the wind warning appears.'),
  makeQuest('harvest','🧺','Complete a careful harvest',3,sim.seasonHarvested,'Harvesting records the outcome of your choices. The game uses fictional credits, not actual yield.','Harvest crops from three plots.'),
  makeQuest('net','🪙','Balance the game budget',1,completion&&(sim.seasonRevenue-sim.seasonSpend)>=0?1:0,'Financial resilience requires weighing input costs against uncertain returns. These credits are fictional.','Finish the year with nonnegative net game credits.',true)
 ];
 if(sim.season===3){
  const bonus=terrain==='hillside'
  ?makeQuest('terrain','⛰️','Stop erosion on the slope',1,(sim.eventDecision?.id==='cover')?1:0,'Protective cover reduces exposed soil during rainfall, an important erosion-management strategy on slopes.','Choose soil cover during the erosion drill.',true)
  :terrain==='riverside'
  ?makeQuest('terrain','💦','Keep water moving safely',1,(sim.eventDecision?.id==='drain'||sim.seasonDrainage)?1:0,'Drainage is a management strategy for waterlogged plots, but it requires suitable field conditions.','Select drainage during the drill or apply drainage care.',true)
  :makeQuest('terrain','🌾','Use a cover strategy',1,(sim.eventDecision?.id==='cover'||hasCare('mulch'))?1:0,'Reducing exposed soil can help moderate splash erosion and preserve soil moisture.','Choose soil cover during the drill or apply mulch.',true);
  return [
   makeQuest('compost','♻️','Replenish soil resources',1,hasCare('compost')?1:0,'Compost can add organic matter and support soil properties when properly managed. It does not replace soil testing.','Use Compost care once.'),
   makeQuest('runoff','🌧️','Manage stormwater',1,(sim.eventDecision&&['cover','drain'].includes(sim.eventDecision.id))?1:0,'Cover and runoff management can lower soil-loss risk. The scale of protection depends on topography and conditions.','Choose cover or runoff drainage in the storm warning.'),
   makeQuest('soil','🌱','Rebuild soil health',1,completion&&sim.soil>=60?1:0,'Soil protection is a multi-season goal; a game score is only a teaching proxy.','Finish harvesting with at least 60 soil points.'),
   bonus
  ];
 }
 return [
  makeQuest('diverse','🌾','Harvest a diverse crop mix',2,harvestGroups,'Diversified crop families can reduce reliance on one crop, although each crop has different trade-offs.','Harvest crops from two distinct families.'),
  makeQuest('stewardship','🧑‍🌾','Practice integrated farm care',2,new Set(sim.questCare).size,'Different farm-care techniques target different risks: water management, erosion, or soil condition.','Use two different care actions.'),
  makeQuest('climate','🌦️','Respond to the final warning',1,prepared,'Preparedness requires balancing likely benefits against costs. The scenario is imaginary, not a forecast.','Choose a protective response at the final hazard.'),
  makeQuest('final','🏆','Finish as a resilient farmer',1,completion&&sim.soil>=60&&sim.water>=25&&sim.budget>0?1:0,'Resilience involves environmental and financial trade-offs. These game targets cannot certify real-world sustainability.','After a harvest: soil ≥ 60, water ≥ 25, and positive game credits.',true)
 ];
}
function questSummary(){
 const quests=currentQuests();
 return {year:sim.season+1,done:quests.filter(q=>qDone(q.id)).length,total:4,
  coreDone:quests.filter(q=>!q.bonus&&qDone(q.id)).length,coreTotal:3,
  earned:Object.keys(sim.questAwards).length,available:20,
  next:quests.find(q=>!qDone(q.id)&&!q.bonus)||quests.find(q=>!qDone(q.id))||null,
  quests:quests.map(q=>({id:q.id,title:q.title,done:qDone(q.id),bonus:q.bonus,lesson:q.lesson,next:q.next}))};
}
function checkQuests(){
 const quests=currentQuests();
 for(const q of quests){
  const key=`${sim.season}-${q.id}`;
  if(!sim.questAwards[key]&&q.value>=q.goal){
   sim.questAwards[key]={title:q.title,lesson:q.lesson,year:sim.season+1,bonus:q.bonus};
   const bonus=q.bonus?40:35;sim.score+=bonus;
   sim.lastQuestLesson={key,title:q.title,lesson:q.lesson};
   sim.questHistory.push({year:sim.season+1,title:q.title,bonus:q.bonus,lesson:q.lesson});
   sim.history.push({title:'Mission completed ✓',text:`${q.title} · +${bonus} learning points`});
   emit('quest',{quest:q.id,title:q.title,lesson:q.lesson,bonus:q.bonus,state:publicState()});
  }
 }
}
function renderQuestBoard(){
 const board=$('av-mission-board');if(!board)return;
 const qs=currentQuests(),done=qs.filter(q=>qDone(q.id)).length;
 const just=sim.lastQuestLesson;
 board.innerHTML=`<div class="av-q-head"><div><span class="av-q-eyebrow">🎯 MISSION ACADEMY</span><b>${done}/4 tasks completed</b></div><span class="av-q-points">${Object.keys(sim.questAwards).length}/20 total</span></div>
 <button type="button" class="av-q-sprig" data-quest-sprig>🌱 Ask Sprig about my next task</button>
 <div class="av-q-progress" role="progressbar" aria-label="Year ${sim.season+1} task progress" aria-valuenow="${done}" aria-valuemax="4"><i style="width:${25*done}%"></i></div>
 <div class="av-q-items">${qs.map(q=>`<div class="av-q-item ${qDone(q.id)?'is-done':''}">
  <span class="av-q-symbol" aria-hidden="true">${qDone(q.id)?'✓':q.emoji}</span><div class="av-q-item-content"><div class="av-q-line"><b>${escape(q.title)}</b>${q.bonus?'<em>BONUS</em>':''}</div>
  <span class="av-q-sub">${qDone(q.id)?'Completed!':escape(q.next)}</span>
  <div class="av-q-meter"><i style="width:${100*q.value/q.goal}%"></i></div>
  <div class="av-q-bottom"><span>${qDone(q.id)?'✓ Earned '+(q.bonus?40:35)+' pts':q.value+'/'+q.goal+' progress'}</span><button type="button" data-quest-tip="${escape(q.id)}" aria-expanded="${questTipOpen===q.id}">${questTipOpen===q.id?'Hide lesson':'Why it matters?'}</button></div>
  ${questTipOpen===q.id?`<div class="av-q-lesson">${escape(q.lesson)}</div>`:''}
  </div></div>`).join('')}</div>
 ${just&&just.key.startsWith(`${sim.season}-`)?`<div class="av-q-feedback" aria-live="polite">🌟 Last lesson: <strong>${escape(just.title)}</strong><span>${escape(just.lesson)}</span></div>`:''}
 <p class="av-q-disclaimer">Earn fictional learning points. Crop properties come from your CSV; objectives and outcomes are game assumptions.</p>`;
}
function publicState(){return {season:sim.season,day:sim.day,month:sim.month,soil:sim.soil,water:sim.water,budget:sim.budget,score:sim.score,eventPending:sim.eventPending,eventImpacted:sim.eventImpacted,decision:sim.eventDecision,scenario:scenarioFor(),farm:sim.farm,finished:sim.finished,missions:questSummary()}}
function stopPlay(){if(timer)clearInterval(timer);timer=null;sim.playing=false}
function reset(){stopPlay();const farm=sim.farm;sim=create();sim.farm=farm;sim.month=farm?.month||6;world?.setState(sim);render();emit('reset',{state:publicState()})}
function configureFarm(ctx){if(ctx?.mode!=='practice')return;sim.farm={mode:'practice',terrain:ctx.terrain||'lowland',soil:ctx.soil||'Simulated loam',water:ctx.water||'Simulated rainfed',location:ctx.label||'Practice farm',mapped:ctx.mapped||null,month:clamp(Number(ctx.month)||6,1,12)};sim.month=sim.farm.month;sim.score=0;sim.yearStart=null;const labels={lowland:'🌾 Lowland · level fields and canal',hillside:'⛰️ Hillside · elevated growing terraces',riverside:'💧 Riverside · river and protective banks'};sim.messageTitle=labels[sim.farm.terrain]||'Practice farm ready';sim.message='Select a crop and a plot to begin. Your landscape changes the scenery and illustrated farming challenges.';render();emit('farm',{state:publicState()})}
function counts(){let planted=0,ready=0,empty=0;for(const p of sim.plots){if(!p.crop)empty++;else {planted++;if(p.age>=p.maturity||sim.day>=12)ready++;}}return {planted,ready,empty}}
function summary(){return {year:sim.season+1,credits:sim.budget,soil:sim.soil,water:sim.water,score:sim.score,yearScore:sim.score-yearInitialScore,net:sim.seasonRevenue-sim.seasonSpend,rotation:sim.seasonLegumeRotation,harvests:sim.seasonHarvested};}
function compareHTML(){const c=sim.comparison;if(!c)return '';const d=(a,b)=>`${b>=a?'+':''}${Math.round(b-a)}`;return `<b>Alternate Futures · Year ${c.first.year}</b><br>First attempt → New attempt<br>Net game credits: ${money(c.first.net)} → ${money(c.second.net)} (${d(c.first.net,c.second.net)})<br>Soil: ${Math.round(c.first.soil)} → ${Math.round(c.second.soil)} (${d(c.first.soil,c.second.soil)})<br>Water: ${Math.round(c.first.water)} → ${Math.round(c.second.water)} (${d(c.first.water,c.second.water)})<br><small>Both runs start from the same fictional farm state. Game scores are not predicted harvests.</small>`;}
function notify(title,msg){sim.messageTitle=title;sim.message=msg;render()}
function togglePlot(id){if(sim.finished||id<0||id>=12)return;if(sim.selected.has(id))sim.selected.delete(id);else sim.selected.add(id);render()}
function render(){if(!$('sim-season')||!crops.length)return;checkQuests();renderQuestBoard();
 const s=year(),count=counts(),selectedEmpty=[...sim.selected].filter(i=>!sim.plots[i].crop),c=crop(sim.crop),seedCost=selectedEmpty.length*c.seed;
 $('sim-season').textContent=`Year ${sim.season+1} / 5`;
 $('sim-progress').innerHTML=YEARS.map((_,i)=>`<span class="${i<sim.season?'done':i===sim.season?'now':''}"></span>`).join('');
 $('sim-day').textContent=String(sim.day).padStart(2,'0');$('sim-day-weather').textContent=`${s.emoji} ${s.title}`;
 $('sim-weather-icon').textContent=s.emoji;$('sim-weather-title').textContent=s.title;$('sim-weather-desc').textContent=s.weather;
 $('sim-mission-title').textContent=s.objective;$('sim-mission-desc').textContent=s.mission;
 $('sim-soil').textContent=`${Math.round(sim.soil)}/100`;$('sim-water').textContent=`${Math.round(sim.water)}/100`;
 $('sim-soil-bar').style.width=`${sim.soil}%`;$('sim-water-bar').style.width=`${sim.water}%`;
 $('sim-budget').textContent=`${money(sim.budget)} cr`;$('sim-score').textContent=money(sim.score);
 $('sim-planted').textContent=`${count.planted}/12`;$('sim-ready').textContent=String(count.ready);
 const terrainLabel={lowland:'🌾 LOWLAND',hillside:'⛰️ HILLSIDE',riverside:'💧 RIVERSIDE'}[sim.farm?.terrain]||'🌾 LOWLAND';$('sim-scene-mode').textContent=`${terrainLabel} · YEAR ${sim.season+1} · ${MONTHS[sim.month-1].toUpperCase()} · DAY ${String(sim.day).padStart(2,'0')}`;
 $('sim-scene-title').textContent=sim.messageTitle;$('sim-scene-detail').textContent=sim.message;
 $('sim-field-tag').textContent=`${sim.selected.size} SELECTED · ${count.ready} READY`;$('sim-selection-count').textContent=`${sim.selected.size} selected`;
 $('sim-month-picker').value=String(sim.month);$('sim-month-picker').disabled=!!sim.yearStart||sim.day>1||sim.seasonHarvested>0||count.planted>0||sim.finished;
 const k=climate();$('sim-month-note').textContent=`Practice climate: ${k.temp}°C · ${k.annualRain.toLocaleString()} mm/yr · pH ${k.ph} (fictional)`;
 $('sim-data-context').textContent=`29 plantable crops from ${catalog.allCount} uploaded profiles. Climate & pH practice assumptions, not Valencia measurements.`;
 const filtered=crops.filter(x=>(x.name+' '+x.scientific+' '+x.family+' '+x.group).toLowerCase().includes(search.toLowerCase()));
 $('sim-crop-count').textContent=`${filtered.length} available`;
 const ranked=[...filtered].sort((a,b)=>(matchFor(b).pct??0)-(matchFor(a).pct??0));
 $('sim-crop-options').innerHTML=ranked.map(x=>{const m=matchFor(x),low=m.pct!=null&&m.pct<60;return `<button type="button" class="sim-crop" data-sim-crop="${escape(x.id)}" aria-pressed="${sim.crop===x.id}"><span class="sim-crop-icon">${x.emoji}</span><span><b>${escape(x.name)}</b><small>${x.maturity} game days · ${x.seed} cr</small><span class="av-match ${low?'low':''}">${m.pct==null?'Traits unavailable':m.pct+'% practice match'}</span></span></button>`}).join('')||'<div class="sim-log-item">No crops match your search.</div>';
 $('sim-plot-picker').innerHTML=sim.plots.map((p,i)=>`<button type="button" class="sim-pick ${p.crop?'occupied':''} ${p.crop&&(p.age>=p.maturity||sim.day>=12)?'ready':''}" data-sim-plot="${i}" aria-pressed="${sim.selected.has(i)}" aria-label="Plot ${i+1}${p.crop?', '+escape(crop(p.crop).name):''}" title="Plot ${i+1}">${i+1}${p.crop?'<span>●</span>':''}</button>`).join('');
 $('sim-action-options').innerHTML=actions.map(a=>`<button type="button" class="sim-action" data-sim-action="${a.id}" aria-pressed="${sim.action===a.id}">${a.emoji} ${a.name}<small>${a.cost} cr · ${a.desc}</small></button>`).join('');
 const m=matchFor(c);const trait=x=>x?.score==null?'unavailable':x.score===100?'optimum':'outside optimum';
 $('sim-choice-info').innerHTML=`<b>${c.emoji} ${escape(c.name)}</b> · ${escape(c.scientific)}<br><b>${money(seedCost)} credits</b> for ${selectedEmpty.length} empty plot(s). ${c.maturity} <em>game</em> days (source range: ${c.growDays[0]}–${c.growDays[1]} actual days).<br>Recorded optimum: ${c.tempOpt.join('–')}°C · ${c.rainOpt.join('–')} mm/yr · pH ${c.phOpt.join('–')}.<br>Current <em>fictional</em> scenario match: <b>${m.pct}%</b> (temp ${trait(m.temp)}, rain ${trait(m.rain)}, pH ${trait(m.ph)}).`;
 $('sim-plant').disabled=sim.finished||!selectedEmpty.length||sim.day>9||sim.budget<seedCost;
 $('sim-plant').textContent=sim.day>9?'Planting closed this year':!selectedEmpty.length?'Select empty plots':sim.budget<seedCost?'Insufficient game credits':`🌱 Plant ${selectedEmpty.length} plot(s) · ${money(seedCost)} cr`;
 const growing=count.planted>0&&sim.day<12&&count.ready<count.planted;
 $('sim-grow').disabled=!growing||sim.finished||sim.eventPending;$('sim-day-next').disabled=!growing||sim.finished||sim.eventPending;
 $('sim-grow').textContent=sim.eventPending?'⚠ Choose preparation':sim.playing?'Ⅱ Pause growth':'▶ Watch growth';
 $('sim-harvest').disabled=!count.ready||sim.finished;$('sim-harvest').textContent=count.ready?`🌽 Harvest ${count.ready} plot(s)`:'🌽 Nothing ready';
 $('sim-apply-care').disabled=sim.finished||sim.budget<action(sim.action).cost;
 $('sim-next').hidden=!(count.planted===0&&sim.seasonHarvested>0&&!sim.finished);
 $('sim-next').textContent=sim.season===4?'View my five-year results ✦':`Continue to Year ${sim.season+2} →`;
 $('sim-replay-year').hidden=sim.finished||!(count.planted===0&&sim.seasonHarvested>0)||!sim.yearStart;
 $('sim-compare').hidden=!sim.comparison;$('sim-compare').innerHTML=sim.comparison?compareHTML():'';
 $('sim-outcome').hidden=!sim.history.length&&!sim.message.includes('harvest');$('sim-outcome').innerHTML=`<strong>${escape(sim.messageTitle)}</strong>${escape(sim.message)}`;
 $('sim-log-list').innerHTML=sim.history.length?sim.history.slice(-6).reverse().map(h=>`<div class="sim-log-item"><b>${escape(h.title)}</b><br>${escape(h.text)}</div>`).join(''):'<div class="sim-log-item">Your first planting will appear here.</div>';
 $('sim-finish').hidden=!sim.finished;
 if(sim.finished){$('sim-final-score').textContent=money(sim.score);$('sim-final-credits').textContent=money(sim.budget);$('sim-final-soil').textContent=String(Math.round(sim.soil));$('sim-final-missions').textContent=`${sim.missionWins}/5`;
 const notes=['Keep experimenting with planting and care choices.','Nice start! Explore rotation and water conservation.','You managed several complex farm trade-offs.','Strong resilience choices! Replay to investigate more strategies.','Excellent learning journey!','Five challenges completed—now explore alternate futures.'];
 $('sim-final-note').textContent=notes[sim.missionWins];$('av-final-learning').textContent='Your results represent fictional game outcomes. Crop traits came from your uploaded CSV; the game does not predict yield, profit, natural disasters or actual local farm performance.';$('av-final-quests').innerHTML=`<b>🎓 Learning mission report: ${Object.keys(sim.questAwards).length} / 20 completed</b><span>${sim.questHistory.filter(q=>!q.bonus).length}/15 core tasks · ${sim.questHistory.filter(q=>q.bonus).length}/5 bonuses</span><div class="av-final-lesson"><strong>Skills practiced</strong><small>Crop rotation · hazard preparation · soil conservation · water budgeting · financial trade-offs</small></div><small>Completion records are simulated achievements, not validated farming certification.</small>`;}
}
function plantSelected(){if(sim.finished||sim.day>9)return;
 const ids=[...sim.selected].filter(i=>!sim.plots[i].crop),c=crop(sim.crop),expense=ids.length*c.seed;
 if(!ids.length||sim.budget<expense)return;
 if(!sim.yearStart)startCheckpoint();
 sim.questPlanted+=ids.length;if(!sim.questPlantedFamilies.includes(c.family||c.group))sim.questPlantedFamilies.push(c.family||c.group);
 ids.forEach(i=>{sim.plots[i]={crop:c.id,age:0,maturity:c.maturity,stress:0,animFrom:0,animStart:performance.now()}});
 sim.budget-=expense;sim.seasonSpend+=expense;sim.selected.clear();
 const m=matchFor(c);sim.history.push({title:`Year ${sim.season+1} · Plant`,text:`${c.name} on ${ids.length} plot(s); ${m.pct}% illustrative trait match`});
 notify(`${c.emoji} ${c.name} planted`,`${ids.length} plot(s) planted using traits from the uploaded crop database. Advance game days to grow.`);
}
function applyCare(){if(sim.finished)return;const a=action(sim.action);if(sim.budget<a.cost)return;
 if(!sim.yearStart)startCheckpoint();
 sim.budget-=a.cost;sim.seasonSpend+=a.cost;sim.water=clamp(sim.water+a.water,0,100);sim.soil=clamp(sim.soil+a.soil,0,100);
 sim.questCare.push(a.id);if(a.id==='drain')sim.seasonDrainage=true;sim.history.push({title:'Farm care',text:`${a.name} · ${a.cost} fictional credits`});
 notify(`${a.emoji} ${a.name}`,`${a.desc}. Care effects are fictional game assumptions.`);
}
function chooseDisaster(id){if(!sim.eventPending)return false;const sc=scenarioFor(),choice=sc.choices.find(x=>x.id===id);
 if(!choice||sim.budget<choice.cost)return false;
 sim.budget-=choice.cost;sim.seasonSpend+=choice.cost;sim.eventDecision=choice;sim.eventPending=false;
 sim.history.push({title:'Preparedness',text:`${choice.label} · ${choice.cost} game credits`});
 notify('Preparation chosen',`${choice.benefit}. Continue to Day 5 to see the simulated result.`);
 emit('decision',{choice,scenario:sc,state:publicState()});return true;}
function applyDisaster(){if(sim.eventImpacted)return;const sc=scenarioFor(),choice=sim.eventDecision||sc.choices.at(-1),protect=choice.protect||0;
 sim.water=clamp(sim.water-sc.waterLoss+choice.water,0,100);sim.soil=clamp(sim.soil-sc.soilLoss+choice.soil,0,100);
 for(const p of sim.plots)if(p.crop)p.stress+=Math.max(0,sc.stress-protect);
 if(sim.seasonDrainage&&sc.id==='flood')for(const p of sim.plots)if(p.crop)p.stress=Math.max(0,p.stress-1);
 sim.score+=choice.score;sim.eventImpacted=true;
 sim.history.push({title:sc.title,text:`${choice.label}. ${sc.impact}`});sim.messageTitle=sc.title;sim.message=sc.impact+' '+choice.benefit+'.';
 emit('impact',{scenario:sc,choice,state:publicState()});}
function nextDay(){const ct=counts();if(sim.finished||sim.day>=12||!ct.planted||sim.eventPending)return false;
 sim.day++;const s=year(),active=sim.plots.filter(p=>p.crop&&p.age<p.maturity);
 const demand=active.reduce((a,p)=>a+crop(p.crop).water,0);sim.water=clamp(sim.water+s.rain+(climate().kind==='wet'?1:climate().kind==='dry'?-1:0),0,100);
 const available=demand?clamp(sim.water/demand,0,1):1;sim.water=clamp(sim.water-demand,0,100);
 for(const p of active){p.animFrom=p.age/p.maturity;p.animStart=performance.now();p.age=Math.min(p.maturity,p.age+(available<.55?.6:available<.9?.8:1));if(available<.85)p.stress++;}
 if(sim.day===5&&!sim.eventImpacted)applyDisaster();
 if(sim.day===3&&!sim.eventDecision){sim.eventPending=true;stopPlay();emit('warning',{scenario:scenarioFor(),state:publicState()});}
 const ready=counts().ready;sim.messageTitle=`Day ${sim.day} · ${s.title}`;
 sim.message=ready?`${ready} plots ready for harvest. Other plots can continue growing.`:'Your crops continue growing. Simulated water use varies with the chosen crop.';
 render();return !sim.eventPending;
}
function watchGrowth(){if(sim.playing){stopPlay();render();return}if(!counts().planted)return;sim.playing=true;render();timer=setInterval(()=>{if(!nextDay()||counts().ready===counts().planted||sim.day>=12){stopPlay();render();}},850);}
function harvest(){if(sim.finished)return;stopPlay();let harvested=0,income=0,rotationWins=0,legumes=0;
 sim.plots.forEach((p,i)=>{if(!p.crop||!(p.age>=p.maturity||sim.day>=12))return;
  const c=crop(p.crop),previous=sim.lastByPlot[i],rotation=sim.lastGroupByPlot[i]==='Cereal'&&c.group==='Legume';
  const growth=clamp(p.age/p.maturity,.32,1),stress=clamp(1-p.stress*.08,.4,1),soil=.68+.32*sim.soil/100;
  const trait=matchFor(c),matching=clamp((trait.pct??70)/100,.48,1);
  const wetPenalty=year().kind==='wet'&&c.group==='Legume'&&!sim.seasonDrainage?.90:1;
  const repetition=previous===c.family?.9:1;
  // Fictional credits, not farmgate prices, yield or projected profit.
  const payout=Math.round(c.base*growth*stress*soil*wetPenalty*matching*repetition*(rotation?1.08:1));
  income+=payout;harvested++;if(!sim.questHarvestedFamilies.includes(c.group))sim.questHarvestedFamilies.push(c.group);if(rotation)rotationWins++;if(c.group==='Legume')legumes++;
  sim.soil=clamp(sim.soil+c.soil,0,100);sim.lastByPlot[i]=c.family;sim.lastGroupByPlot=sim.lastGroupByPlot||Array(12).fill(null);sim.lastGroupByPlot[i]=c.group;sim.plots[i]=emptyPlot();
 });
 if(!harvested)return;
 sim.budget+=income;sim.questCreditsEarned+=income;sim.seasonRevenue+=income;sim.seasonHarvested+=harvested;sim.seasonLegumeRotation ||=rotationWins>0;sim.seasonHarvestedLegume ||=legumes>0;
 sim.score+=harvested*17+rotationWins*22;
 sim.history.push({title:`Year ${sim.season+1} · Harvest`,text:`${harvested} plots · +${money(income)} game credits${rotationWins?' · rotation bonus':''}`});
 if(sim.previousFuture&&counts().planted===0)sim.comparison={first:sim.previousFuture,second:summary()};
 notify('Harvest complete! 🌽',`You earned ${money(income)} fictional credits from ${harvested} plot(s). ${rotationWins?'A cereal-to-legume rotation earned a bonus.':''}`);
}
function replayYear(){if(!sim.yearStart||sim.finished||counts().planted||!sim.seasonHarvested)return;
 sim.previousFuture=sim.previousFuture||summary();const base=copy(sim.yearStart);stopPlay();restore(base);sim.previousFuture=sim.previousFuture||null;
 sim.comparison=null;sim.history.push({title:'Alternate future',text:`Replayed Year ${sim.season+1} from the same starting state`});render();emit('replay',{state:publicState()});}
function nextYear(){if(sim.finished||counts().planted||!sim.seasonHarvested)return;stopPlay();checkQuests();
 let win=false;if(sim.season===0)win=sim.water>=25;
 if(sim.season===1)win=sim.priorCerealAtStart?sim.seasonLegumeRotation:(sim.questHarvestedFamilies.includes('Legume')&&sim.questHarvestedFamilies.length>=2);
 if(sim.season===2)win=sim.soil>=55&&sim.budget>0;
 if(sim.season===3)win=sim.soil>=60;
 if(sim.season===4)win=sim.soil>=60&&sim.water>=25&&sim.budget>0;
 if(win){sim.missionWins++;sim.score+=100;}
 const net=sim.seasonRevenue-sim.seasonSpend;
 sim.history.push({title:`Year ${sim.season+1} summary`,text:`${win?'Mission completed ✓':'Mission not met'} · ${net>=0?'+':''}${money(net)} game credits (net)`});
 if(sim.season===4){sim.finished=true;render();emit('finish',{state:publicState()});return;}
 const priorCereal=sim.lastGroupByPlot.includes('Cereal');sim.season++;sim.priorCerealAtStart=priorCereal;sim.day=1;sim.month=sim.month%12+1;sim.water=clamp(sim.water+22,0,100);
 sim.questPlanted=0;sim.questPlantedFamilies=[];sim.questHarvestedFamilies=[];sim.questCare=[];sim.questCreditsEarned=0;sim.lastQuestLesson=null;questTipOpen=null;sim.seasonSpend=0;sim.seasonRevenue=0;sim.seasonHarvested=0;sim.seasonLegumeRotation=false;sim.seasonHarvestedLegume=false;sim.seasonDrainage=false;
 sim.eventPending=false;sim.eventDecision=null;sim.eventImpacted=false;sim.selected=new Set([5]);sim.yearStart=null;sim.previousFuture=null;sim.comparison=null;
 notify(`Year ${sim.season+1} begins`,`${year().title}. You can choose your planting month before sowing.`);
 emit('season',{state:publicState()});}
function pause(){stopPlay();world?.stop();}
function exit(){pause();window.AVReturnToWelcome?.();}
function events(){const screen=$('screen-simulation');if(!screen)return;
 const canvas=$('sim-3d-canvas');if(window.AVFarm3D&&canvas){world=window.AVFarm3D.create(canvas,togglePlot);world.setState(sim);}
 screen.addEventListener('click',e=>{
  if(e.target.closest('[data-quest-sprig]')){window.AVAdventure?.showMission?.();return;}
  const q=e.target.closest('[data-quest-tip]');if(q){questTipOpen=questTipOpen===q.dataset.questTip?null:q.dataset.questTip;renderQuestBoard();return;}
  const b=e.target.closest('[data-sim-crop]');if(b){sim.crop=b.dataset.simCrop;render();return;}
  const a=e.target.closest('[data-sim-action]');if(a){sim.action=a.dataset.simAction;render();return;}
  const p=e.target.closest('[data-sim-plot]');if(p){togglePlot(Number(p.dataset.simPlot));return;}
  if(e.target.closest('#sim-select-empty')){sim.selected=new Set(sim.plots.flatMap((p,i)=>p.crop?[]:[i]));render();return;}
  if(e.target.closest('#sim-clear-selection')){sim.selected.clear();render();return;}
  if(e.target.closest('#sim-plant')){plantSelected();return;}
  if(e.target.closest('#sim-apply-care')){applyCare();return;}
  if(e.target.closest('#sim-day-next')){stopPlay();nextDay();return;}
  if(e.target.closest('#sim-grow')){watchGrowth();return;}
  if(e.target.closest('#sim-harvest')){harvest();return;}
  if(e.target.closest('#sim-next')){nextYear();return;}
  if(e.target.closest('#sim-replay-year')){replayYear();return;}
  if(e.target.closest('#sim-view-left')){world?.orbitBy(-Math.PI/6,0);return;}
  if(e.target.closest('#sim-view-right')){world?.orbitBy(Math.PI/6,0);return;}
  if(e.target.closest('#sim-view-reset')){world?.resetView();return;}
  if(e.target.closest('#sim-view-zoom-in')){world?.zoom(.87);return;}
  if(e.target.closest('#sim-view-zoom-out')){world?.zoom(1.13);return;}
  if(e.target.closest('#sim-restart')||e.target.closest('#sim-play-again')){const mapped = sim.farm.mapped ? {...sim.farm.mapped, location:sim.farm.location} : null;reset();window.AVAdventure?.onEnter?.(mapped);return;}
  if(e.target.closest('#sim-exit')){exit();return;}
 });
 $('sim-crop-search').addEventListener('input',e=>{search=e.target.value;render();});
 $('sim-month-picker').addEventListener('change',e=>{if(sim.yearStart||sim.day>1||counts().planted||sim.seasonHarvested||sim.finished)return;sim.month=clamp(Number(e.target.value)||6,1,12);notify('Planting month selected',`${MONTHS[sim.month-1]} uses a fictional practice climate. The CSV trait match was updated.`);emit('farm',{state:publicState()})});
 render();
}
window.AVFutureSim={open(){if(!hasOpened){hasOpened=true;reset();}else render();world?.start();},pause,reset,configureFarm,chooseDisaster,publicState,
 questSummary,debugState:()=>({...sim,selected:[...sim.selected],plots:sim.plots.map(p=>({...p}))}),debugAdvanceDay:nextDay,
 debugNextYear:nextYear,debugPlant:plantSelected,debugHarvest:harvest,debugReplay:replayYear};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',events);else events();
})();
