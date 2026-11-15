/*
 * AgriVerse Farm World — self-contained perspective 3D renderer.
 * No external dependencies, no satellite imagery, no network requests.
 * Geometry is generated in XYZ coordinates and perspective-projected onto Canvas.
 * Drag to orbit, wheel/pinch to zoom, click/tap beds to select.
 */
(function(){
'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const V=(x,y,z)=>[x,y,z];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const l=Math.hypot(...a)||1;return mul(a,1/l)};
const tileX=c=>(c-1.5)*3.12;
const tileZ=r=>(r-1)*2.94;
const colors={ground:'#315c45',grass:'#46965b',grass2:'#64b86c',soil:'#926a47',soil2:'#ad8158',border:'#cee6a0',wood:'#ba8b5a',dark:'#1c493c',leaf:'#2c9d58',leaf2:'#83ca59',mint:'#d7faa6',cream:'#fff0cb',yellow:'#ffd059'};
const colorCache=new Map();
function rgb(hex){if(colorCache.has(hex))return colorCache.get(hex);const h=hex.replace('#','');const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);const v=[r,g,b];colorCache.set(hex,v);return v}
function tint(hex,fac){const c=rgb(hex);return `rgb(${clamp(Math.round(c[0]*fac),0,255)},${clamp(Math.round(c[1]*fac),0,255)},${clamp(Math.round(c[2]*fac),0,255)})`}
class FarmWorld{
 constructor(canvas,onPick){
  this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.onPick=onPick;
  this.state=null;this.yaw=-.62;this.pitch=.92;this.distance=42;
  // Desired camera values animate independently from pointer/keyboard input.
  this.goalYaw=this.yaw;this.goalPitch=this.pitch;this.goalDistance=this.distance;
  this.spinYaw=0;this.spinPitch=0;this.pointers=new Map();this.gesture=null;
  this.staticFaces=null;this.staticTerrain=null;this.meshY=0;this.target=[0,.20,0];this.drag=null;this.hover=-1;this.hit=[];
  this.active=false;this.raf=0;this.lastFrame=0;this.lastDraw=0;this.drawnFrames=0;
  this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  this._down=e=>this.down(e);this._move=e=>this.move(e);this._up=e=>this.up(e);this._wheel=e=>this.wheel(e);
  canvas.addEventListener('pointerdown',this._down);
  canvas.addEventListener('pointermove',this._move);
  canvas.addEventListener('pointerup',this._up);
  canvas.addEventListener('pointercancel',this._up);
  canvas.addEventListener('lostpointercapture',e=>{this.pointers.delete(e.pointerId);if(this.drag?.id===e.pointerId)this.drag=null});
  canvas.addEventListener('wheel',this._wheel,{passive:false});
  canvas.addEventListener('keydown',e=>{
   if(e.altKey||e.ctrlKey||e.metaKey)return;
   const key=e.key;
   if(key==='ArrowLeft'){this.orbitBy(-Math.PI/9,0);e.preventDefault()}
   else if(key==='ArrowRight'){this.orbitBy(Math.PI/9,0);e.preventDefault()}
   else if(key==='ArrowUp'){this.orbitBy(0,.13);e.preventDefault()}
   else if(key==='ArrowDown'){this.orbitBy(0,-.13);e.preventDefault()}
   else if(key==='+'||key==='='){this.zoom(.89);e.preventDefault()}
   else if(key==='-'||key==='_'){this.zoom(1.12);e.preventDefault()}
   else if(key==='0'||key==='Home'){this.resetView();e.preventDefault()}
  });
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);
 }
 setState(state){const was=this.state?.farm?.terrain;this.state=state;const now=state?.farm?.terrain;if(was!==now){this.staticFaces=null;this.staticTerrain=null}}
 start(){
  if(this.active)return;
  this.active=true;this.resize();this.lastFrame=0;this.lastDraw=0;
  const tick=t=>{
   if(!this.active)return;
   const dt=Math.min((t-(this.lastFrame||t))/1000,.05);
   this.lastFrame=t;
   const moving=this.step(dt);
   // Draw at display refresh during camera movement; at rest, save power.
   // Slow devices can naturally skip frames rather than accumulating a queue.
   const interval=moving||this.pointers.size?15:45;
   if(t-this.lastDraw>=interval){this.draw(t);this.lastDraw=t;this.drawnFrames++}
   this.raf=requestAnimationFrame(tick);
  };
  this.raf=requestAnimationFrame(tick);
 }
 stop(){this.active=false;cancelAnimationFrame(this.raf);this.lastFrame=0;this.pointers.clear();this.drag=null;this.gesture=null}
 resetView(){
  this.goalYaw=-.62;this.goalPitch=.92;this.goalDistance=42;this.spinYaw=0;this.spinPitch=0;
  if(this.reduced){this.yaw=this.goalYaw;this.pitch=this.goalPitch;this.distance=this.goalDistance}
 }
 orbitBy(yawDelta,pitchDelta){
  this.spinYaw=0;this.spinPitch=0;
  this.goalYaw+=yawDelta;this.goalPitch=clamp(this.goalPitch+pitchDelta,.33,1.35);
  if(this.reduced){this.yaw=this.goalYaw;this.pitch=this.goalPitch}
 }
 zoom(factor){
  this.goalDistance=clamp(this.goalDistance*factor,22,66);
  if(this.reduced)this.distance=this.goalDistance;
 }
 wheel(e){
  e.preventDefault();
  // Trackpads supply small pixel deltas; mouse wheels may use line or page units.
  const pixels=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?this.h:1);
  this.zoom(Math.exp(clamp(pixels,-240,240)*.00135));
 }
 step(dt){
  if(!this.reduced&&!this.pointers.size&&!this.gesture){
   // Inertia is capped and quickly damped so the farm never spins out of control.
   this.goalYaw+=this.spinYaw*dt;this.goalPitch=clamp(this.goalPitch+this.spinPitch*dt,.33,1.35);
   const fade=Math.exp(-dt*9);
   this.spinYaw*=fade;this.spinPitch*=fade;
   if(Math.abs(this.spinYaw)<.007)this.spinYaw=0;
   if(Math.abs(this.spinPitch)<.007)this.spinPitch=0;
  }
  const alpha=this.reduced?1:1-Math.exp(-dt*19);
  this.yaw+=(this.goalYaw-this.yaw)*alpha;
  this.pitch+=(this.goalPitch-this.pitch)*alpha;
  this.distance+=(this.goalDistance-this.distance)*alpha;
  const diff=Math.max(Math.abs(this.goalYaw-this.yaw),Math.abs(this.goalPitch-this.pitch),Math.abs(this.goalDistance-this.distance)*.02);
  return diff>.0005||Math.abs(this.spinYaw)>.007||Math.abs(this.spinPitch)>.007;
 }
 resize(){
  const r=this.canvas.getBoundingClientRect();const w=Math.max(1,Math.round(r.width)),h=Math.max(1,Math.round(r.height));
  // Cap canvas pixel density to keep orbiting smooth on high-DPI displays.
  const dpr=Math.min(window.devicePixelRatio||1,w<650?1.15:1.3);
  if(this.canvas.width!==Math.round(w*dpr)||this.canvas.height!==Math.round(h*dpr)){
   this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);
  }
  this.w=w;this.h=h;this.dpr=dpr;
 }
 coords(e){const r=this.canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top]}
 down(e){
  if(e.pointerType==='mouse'&&e.button!==0)return;
  const [x,y]=this.coords(e),now=performance.now();
  try{this.canvas.setPointerCapture?.(e.pointerId)}catch(_){/* synthetic events may not be capturable */}
  this.pointers.set(e.pointerId,{x,y});
  this.spinYaw=0;this.spinPitch=0;
  if(this.pointers.size===1){
   this.drag={id:e.pointerId,x,y,lastX:x,lastY:y,lastTime:now,moved:false,vyaw:0,vpitch:0};
   this.gesture=null;
  }else if(this.pointers.size===2){
   const pts=[...this.pointers.values()];
   this.gesture={distance:Math.hypot(pts[1].x-pts[0].x,pts[1].y-pts[0].y),goalDistance:this.goalDistance};
   if(this.drag)this.drag.moved=true;
  }
  this.canvas.style.cursor='grabbing';
 }
 move(e){
  const [x,y]=this.coords(e);
  if(!this.pointers.has(e.pointerId)){
   // Hover is separate from gesture handling, so taps still pick the right plot.
   if(e.pointerType==='mouse')this.hoverAt(e);
   return;
  }
  this.pointers.set(e.pointerId,{x,y});
  if(this.pointers.size>=2){
   const pts=[...this.pointers.values()];const distance=Math.hypot(pts[1].x-pts[0].x,pts[1].y-pts[0].y);
   if(this.gesture&&this.gesture.distance>8)this.goalDistance=clamp(this.gesture.goalDistance*this.gesture.distance/Math.max(distance,8),22,66);
   return;
  }
  const d=this.drag;if(!d||d.id!==e.pointerId)return;
  const dx=x-d.lastX,dy=y-d.lastY,now=performance.now(),dt=Math.max(.008,Math.min(.08,(now-d.lastTime)/1000));
  if(Math.hypot(x-d.x,y-d.y)>5)d.moved=true;
  if(d.moved){
   // Continuous free-orbit instead of switching between 90-degree preset views.
   const yawDelta=-dx*.0064,pitchDelta=dy*.0042;
   this.goalYaw+=yawDelta;this.goalPitch=clamp(this.goalPitch+pitchDelta,.33,1.35);
   const mix=.37;
   d.vyaw=clamp(d.vyaw*(1-mix)+(yawDelta/dt)*mix,-2.6,2.6);
   d.vpitch=clamp(d.vpitch*(1-mix)+(pitchDelta/dt)*mix,-1.2,1.2);
   if(this.reduced){this.yaw=this.goalYaw;this.pitch=this.goalPitch}
  }
  d.lastX=x;d.lastY=y;d.lastTime=now;
 }
 up(e){
  const wasPinching=this.gesture!==null;
  const d=this.drag,canClick=!!d&&d.id===e.pointerId&&!d.moved&&!wasPinching&&e.type==='pointerup';
  this.pointers.delete(e.pointerId);
  try{if(this.canvas.hasPointerCapture?.(e.pointerId))this.canvas.releasePointerCapture(e.pointerId)}catch(_){/* pointer may already be released */}
  if(wasPinching){
   this.gesture=null;
   // Do not interpret the remaining finger of a pinch as a plot tap.
   this.drag=null;
  }else if(d&&d.id===e.pointerId){
   const age=(performance.now()-d.lastTime)/1000;
   if(d.moved&&!this.reduced&&age<.07){this.spinYaw=d.vyaw*.22;this.spinPitch=d.vpitch*.16}
   this.drag=null;
  }
  if(!this.pointers.size){this.canvas.style.cursor=this.hover>=0?'pointer':'grab'}
  if(canClick){const [x,y]=this.coords(e),idx=this.hitAt(x,y);if(idx>=0)this.onPick?.(idx)}
 }
 hoverAt(e){if(this.pointers.size)return;const [x,y]=this.coords(e);this.hover=this.hitAt(x,y);this.canvas.style.cursor=this.hover>=0?'pointer':'grab'}
 hitAt(x,y){for(let i=this.hit.length-1;i>=0;i--){const h=this.hit[i];if(this.pointIn(x,y,h.poly))return h.id}return -1}
 pointIn(x,y,p){let inside=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}
 camera(){const r=this.distance,p=this.pitch,y=this.yaw;this.eye=[r*Math.cos(p)*Math.sin(y),r*Math.sin(p)+.25,r*Math.cos(p)*Math.cos(y)];this.forward=norm(sub(this.target,this.eye));this.right=norm(cross(this.forward,[0,1,0]));this.camUp=norm(cross(this.right,this.forward));this.f=Math.min(this.w*1.8,this.h*1.58);this.cx=this.w*.5;this.cy=this.h*.54}
 project(v){const d=sub(v,this.eye),z=dot(d,this.forward);if(z<.4)return null;return [this.cx+dot(d,this.right)*this.f/z,this.cy-dot(d,this.camUp)*this.f/z,z]}
 face(points,color,alpha=1,unlit=false){if(this.meshY)points=points.map(v=>V(v[0],v[1]+this.meshY,v[2]));this.faces.push({points,color,alpha,unlit,layer:this.layer||0})}
 quad(a,b,c,d,color,alpha=1){this.face([a,b,c,d],color,alpha)}
 box(x,y,z,w,h,d,top,side){const a=x-w/2,b=x+w/2,c=z-d/2,e=z+d/2,lo=y,hi=y+h,s=side||top;
  this.quad(V(a,hi,c),V(b,hi,c),V(b,hi,e),V(a,hi,e),top);
  this.quad(V(a,lo,e),V(b,lo,e),V(b,hi,e),V(a,hi,e),s);
  this.quad(V(b,lo,c),V(a,lo,c),V(a,hi,c),V(b,hi,c),s);
  this.quad(V(a,lo,c),V(a,lo,e),V(a,hi,e),V(a,hi,c),s);
  this.quad(V(b,lo,e),V(b,lo,c),V(b,hi,c),V(b,hi,e),s)
 }
 cylinder(x,y,z,r,h,color,seg=7){if(h<=0)return;const p=[];for(let i=0;i<seg;i++){const a=i*2*Math.PI/seg;p.push([x+r*Math.cos(a),z+r*Math.sin(a)])}
  for(let i=0;i<seg;i++){const j=(i+1)%seg;this.quad(V(p[i][0],y,p[i][1]),V(p[j][0],y,p[j][1]),V(p[j][0],y+h,p[j][1]),V(p[i][0],y+h,p[i][1]),color)}
  this.face(p.map(q=>V(q[0],y+h,q[1])),color)
 }
 cone(x,y,z,r,h,color,seg=7){for(let i=0;i<seg;i++){const a=i*2*Math.PI/seg,b=(i+1)*2*Math.PI/seg;this.face([V(x+r*Math.cos(a),y,z+r*Math.sin(a)),V(x+r*Math.cos(b),y,z+r*Math.sin(b)),V(x,y+h,z)],color)}}
 sphere(x,y,z,rx,ry,rz,color,segments=7,rings=4){for(let j=0;j<rings;j++){const a=-Math.PI/2+j*Math.PI/rings,b=-Math.PI/2+(j+1)*Math.PI/rings;for(let i=0;i<segments;i++){const p=i*2*Math.PI/segments,q=(i+1)*2*Math.PI/segments;const f=(lat,lon)=>V(x+rx*Math.cos(lat)*Math.cos(lon),y+ry*Math.sin(lat),z+rz*Math.cos(lat)*Math.sin(lon));this.face([f(a,p),f(a,q),f(b,q),f(b,p)],color)}}}
 leaf(x,y,z,len,dir,col,w=.16){const dx=Math.cos(dir),dz=Math.sin(dir),px=-dz,pz=dx;const a=V(x,y,z),b=V(x+dx*len*.5+px*w,y+len*.18,z+dz*len*.5+pz*w),c=V(x+dx*len,y+len*.03,z+dz*len),d=V(x+dx*len*.5-px*w,y+len*.18,z+dz*len*.5-pz*w);this.face([a,b,c,d],col)}
 tree(x,z,s=1){this.cylinder(x,.08,z,.19*s,1.55*s,'#775c3e',7);this.sphere(x,1.7*s,z,.95*s,1.15*s,.86*s,'#2f7858',8,4);this.sphere(x-.48*s,1.6*s,z+.18*s,.68*s,.75*s,.67*s,'#4e9b68',7,4);this.sphere(x+.36*s,2.1*s,z-.1*s,.72*s,.85*s,.72*s,'#64aa6f',8,4)}
 roof(x,y,z,w,d){const l=x-w/2,r=x+w/2,f=z-d/2,b=z+d/2,p=y+.95;this.face([V(l,y,f),V(x,p,f),V(x,p,b),V(l,y,b)],'#a75c4c');this.face([V(x,p,f),V(r,y,f),V(r,y,b),V(x,p,b)],'#7e493c');this.face([V(l,y,f),V(r,y,f),V(x,p,f)],'#d09b6b');this.face([V(r,y,b),V(l,y,b),V(x,p,b)],'#a75f48')}
 barn(){const x=9,z=-7.3;this.box(x,.05,z,4,2.45,3.2,'#efd8a5','#e6c69a');this.roof(x,2.5,z,4.6,3.7);this.box(x+.5,.1,z+1.63,.92,1.65,.06,'#7c5847','#7c5847');this.box(x-1,.9,z+1.63,.68,.62,.08,'#90c3b3','#90c3b3');this.box(x+1.35,1.2,z-.4,.5,.55,.08,'#90c3b3','#90c3b3');this.cylinder(x+1.3,2.7,z-.6,.2,1,'#d4a37e',5)}

 // Stylized low-poly voxel world inspired by playful farm-building games.
 voxelTree(x,z,s=1,variant=0){
  const green=['#36a84f','#46b954','#279e59','#65c95c','#318c4b'][variant%5];
  this.box(x,.06,z,.24*s,1.55*s,.24*s,'#9c6841','#805233');
  this.box(x,.95*s,z,.96*s,.7*s,.94*s,green);
  this.box(x-.37*s,1.39*s,z,.75*s,.8*s,.76*s,variant%2?'#5bd15e':'#48b95c');
  this.box(x+.34*s,1.48*s,z-.22*s,.77*s,.87*s,.79*s,green);
  this.box(x,1.96*s,z,.85*s,.72*s,.83*s,'#75d06a');
 }
 fruitTree(x,z,s=1,berry=false){
  this.box(x,.05,z,.22*s,1.15*s,.22*s,'#8c5c37','#6e492c');
  this.box(x,1.04*s,z,1.18*s,.7*s,1.08*s,'#39b74b');
  this.box(x-.4*s,1.42*s,z+.22*s,.87*s,.74*s,.88*s,'#60c857');
  this.box(x+.33*s,1.43*s,z-.26*s,.88*s,.78*s,.85*s,'#2da84c');
  for(let i=0;i<5;i++){
   const a=i*2.399;const xx=x+Math.cos(a)*.43*s,zz=z+Math.sin(a)*.43*s;
   this.box(xx,1.23*s+(i%2)*.24*s,zz+.52*s,.27*s,.25*s,.24*s,berry?'#a55ae9':'#f34b46');
  }
 }
 fence(x1,z1,x2,z2){
  const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz),n=Math.max(1,Math.round(len/1.7));
  for(let i=0;i<=n;i++){const t=i/n;this.box(x1+dx*t,.1,z1+dz*t,.15,.94,.15,'#fffdf3','#e1e9db')}
  for(const y of [.43,.78]){
   if(Math.abs(dx)>Math.abs(dz))this.box((x1+x2)/2,y,(z1+z2)/2,len,.12,.12,'#ffffff','#e3e9de');
   else this.box((x1+x2)/2,y,(z1+z2)/2,.12,.12,len,'#ffffff','#e3e9de');
  }
 }
 animal(x,z,kind='sheep',t=0){
  const bob=this.reduced?0:Math.sin(t*.0016+x*2+z)*.03;
  const col=kind==='pig'?'#f6a6b7':kind==='chicken'?'#f7f1db':'#f6f2e6';
  const scale=kind==='chicken'?.55:1;
  this.box(x,.22+bob,z,.67*scale,.47*scale,.48*scale,col);
  this.box(x+.30*scale,.42+bob,z,.31*scale,.35*scale,.34*scale,col);
  for(const xx of [-.21,.21])for(const zz of [-.17,.17])this.box(x+xx*scale,.05+bob,z+zz*scale,.11*scale,.25*scale,.11*scale,col);
  this.box(x+.47*scale,.53+bob,z-.10*scale,.055*scale,.055*scale,.055*scale,'#283a35');
  if(kind==='pig'){this.box(x+.47*scale,.36+bob,z,.16*scale,.15*scale,.21*scale,'#e885a4')}
  if(kind==='chicken'){this.box(x+.45*scale,.45+bob,z,.13*scale,.10*scale,.16*scale,'#f6b843');this.box(x+.30*scale,.68+bob,z,.13*scale,.13*scale,.13*scale,'#df4f4d')}
 }
 farmhouse(){
  const x=9.8,z=-6.9;
  this.box(x,.06,z,3.4,2.25,3.2,'#fff5dc','#e7e1c9');
  this.roof(x,2.28,z,3.9,3.65);
  this.box(x+.4,.1,z+1.65,.85,1.65,.09,'#5e8d7a','#5e8d7a');
  this.box(x-1,.99,z+1.65,.78,.7,.09,'#8ee0f1','#b0f0f5');
  this.box(x+1.05,1.03,z-1.65,.65,.68,.09,'#8ee0f1','#b0f0f5');
  this.box(x-1.2,.1,z+2.0,1.1,.34,.65,'#f3e8cd');
 }
 // Each fictional landscape is constructed separately. All share 12 playable plots,
 // but surroundings, elevation, obstacles and visual language are different.
 terrainKind(){return ['lowland','hillside','riverside'].includes(this.state?.farm?.terrain)?this.state.farm.terrain:'lowland'}
 rowElevation(r){return this.terrainKind()==='hillside'?[1.48,.83,.18][r]:0}
 paintGround(type){
  const palettes={lowland:['#9cdd60','#aeea73','#8fd151','#5e9c45'],hillside:['#7dc77a','#96d98d','#6cb76e','#46865e'],riverside:['#76d6a1','#8ce2aa','#62c994','#3c947d']};
  const p=palettes[type];this.layer=-3;
  this.box(0,-1,0,54,.9,43,p[2],p[3]);
  for(let i=0;i<18;i++)for(let j=0;j<14;j++){
   const x=-25.5+i*3,z=-19.5+j*3;
   this.box(x,-.065,z,3,.04,3,(i+j)%2?p[0]:p[1]);
  }
  this.layer=-2;
 }
 wildflowers(x,z,cols=6,rows=4){
  this.box(x,-.025,z,cols*1.28+.6,.14,rows*1.26+.6,'#ae805c','#8d6249');
  for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){
   const px=x+(i-(cols-1)/2)*1.28,pz=z+(j-(rows-1)/2)*1.26;
   const bloom=['#ffcf55','#f987ad','#8c9afa','#ffeb8c','#ff9874'][(i*3+j)%5];
   this.box(px,.13,pz,.15,.39,.15,'#2b9b61','#287e51');
   this.box(px,.52,pz,.44,.15,.40,bloom);
   this.box(px,.61,pz,.17,.11,.18,'#fff9bb');
  }
 }
 hedge(x,z,length,axis='x',color='#43966d'){
  const n=Math.round(length/1.25);
  for(let i=0;i<n;i++){
   const d=(i-(n-1)/2)*1.25;
   this.box(x+(axis==='x'?d:0),.03,z+(axis==='z'?d:0),1.1,.58,.98,color,'#347955');
  }
 }
 pineTree(x,z,s=1){
  this.cylinder(x,.05,z,.17*s,1.27*s,'#805f4c',6);
  this.cone(x,.52*s,z,.78*s,1.1*s,'#326f59',6);
  this.cone(x,1.02*s,z,.66*s,1.08*s,'#3f8b67',6);
  this.cone(x,1.55*s,z,.47*s,1.02*s,'#64a879',6);
 }
 rock(x,z,s=1){
  this.box(x,.04,z,.86*s,.48*s,.69*s,'#9eaca0','#74867c');
  this.box(x-.28*s,.36*s,z+.15*s,.45*s,.27*s,.5*s,'#c2bcb0','#9b9c91');
 }
 railAt(x1,z1,x2,z2,y,color='#d7b88c'){
  const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz),n=Math.max(1,Math.round(len/2.4));
  for(let i=0;i<=n;i++){const t=i/n;this.box(x1+dx*t,y,z1+dz*t,.17,.67,.17,color,'#94785b')}
  if(Math.abs(dx)>Math.abs(dz))this.box((x1+x2)/2,y+.45,(z1+z2)/2,len,.11,.13,color,'#94785b');
  else this.box((x1+x2)/2,y+.45,(z1+z2)/2,.13,.11,len,color,'#94785b');
 }
 lowlandScene(){
  // Level patchwork fields, broad irrigation canal, orchard and animal enclosure.
  this.paintGround('lowland');
  this.box(-12,-.17,11.2,24,.12,5.8,'#e6e6d8','#bcc6bb');
  this.box(-12,-.12,11.2,22.9,.14,4.9,'#23c4f6','#028cdb');
  for(let i=0;i<10;i++)this.box(-23+i*2.2,-.04,10.9+Math.sin(i)*.5,1.25,.012,.10,'#d4f8ff');
  this.box(-5,-.04,8.1,20,.08,1.0,'#e3e4d7');
  this.box(7.55,-.035,0,.95,.07,17,'#d7c8b4');
  this.box(1.8,-.03,8.0,22,.06,.95,'#d8c8b5');
  this.box(9.8,-.035,-10.0,9,.06,.9,'#d8c8b5');
  this.box(0,-.06,0,14.5,.29,10.75,'#79cb60','#4f9955');
  this.box(0,.16,0,14.15,.12,10.3,'#6fbc4f','#448548');
  this.box(13.2,-.03,1.65,10.6,.12,10.3,'#a1dd66','#549752');
  for(let row=0;row<3;row++)for(let col=0;col<4;col++)this.fruitTree(9.7+col*2.2,-1.8+row*2.95,.86,(row+col)%3===0);
  this.box(13,-.025,-9.9,11.4,.12,7.3,'#b3e777','#71ad63');
  this.fence(7.4,-13.5,18.6,-13.5);this.fence(18.6,-13.5,18.6,-6.3);
  this.fence(18.6,-6.3,7.4,-6.3);this.fence(7.4,-6.3,7.4,-13.5);
  this.fence(12.9,-13.5,12.9,-6.3);
  for(let i=0;i<3;i++)this.animal(9.3+i*1.25,-10.1+(i%2)*1.5,i===2?'pig':'sheep');
  for(let i=0;i<4;i++)this.animal(14.2+i*.94,-9.1+(i%2)*1.4,i%2?'chicken':'pig');
  this.box(9.4,-.015,-12.1,2.4,.09,1.1,'#efd891');
  this.box(15.1,-.015,-12.1,2.4,.09,1.1,'#efd891');
  this.farmhouse();
  this.wildflowers(-13.6,-4.2,7,6);
  this.wildflowers(20.5,14,3,3);
  for(let i=0;i<17;i++)this.voxelTree(-24+i*2.9,-17.3+(i%3)*.48,.8+(i%4)*.10,i);
  for(let i=0;i<11;i++)this.voxelTree(-24+i*2.5,-13.9+(i%2)*.6,.62+(i%3)*.11,i+2);
  for(let i=0;i<8;i++)this.voxelTree(22-(i%3)*.3,-8+i*3.2,.7+(i%3)*.13,i);
  for(let i=0;i<7;i++)this.voxelTree(-23+(i%2)*.6,-9+i*3.5,.75+(i%3)*.12,i+2);
  this.layer=0;
  this.fence(-7.25,-5.45,7.25,-5.45);this.fence(-7.25,5.45,7.25,5.45);
  this.fence(-7.25,-5.45,-7.25,5.45);this.fence(7.25,-5.45,7.25,5.45);
 }
 hillsideScene(){
  // Dramatic elevated terraces, rocky retaining walls and forested high ridge.
  // The playable rows are stepped upward toward the mountain (not merely decorated).
  this.paintGround('hillside');
  for(const [x,z,w,d,h] of [[-15,-15,23,10,2.8],[9,-17,25,9,3.5],[-4,-19,20,6,4.8]]){
   this.box(x,-.24,z,w,h,d,'#648a66','#6f795e');
   this.box(x,h-.24,z,w-.7,.28,d-.5,'#78bf81','#3e8b61');
  }
  for(let i=0;i<9;i++){
   const x=-22+i*5.7;
   this.cone(x,3.5+Math.sin(i)*.2,-22+(i%2)*1.6,3.2+(i%3)*.7,4.5+(i%4)*.75,i%2?'#6a8875':'#829a7f',6);
  }
  // A steep grass hillside behind and left of the farm, with contour bands.
  this.box(-16,-.12,0,11,.45,21,'#7fcb72','#42955e');
  for(let i=0;i<5;i++){
   const z=-9.5+i*4.25,h=1.9-i*.29;
   this.box(-17,h-.45,z,8.6,.65,2.7,i%2?'#a8dc8a':'#73bf70','#7e8062');
   this.box(-17,h+.14,z+1.25,8.6,.12,.18,'#dbbe88','#ad9267');
  }
  // Each growing row has its own real elevation and stone-faced terrace.
  for(let r=0;r<3;r++){
   const z=tileZ(r),h=this.rowElevation(r);
   this.box(0,h-1.21,z,14.45,1.45,2.87,r%2?'#83d08b':'#a4de94','#827a67');
   this.box(0,h+.18,z,14.12,.065,2.78,'#70c675','#4f9f62');
   this.box(0,h-.85,z+1.42,14.45,1.04,.18,'#b2a28a','#89806d');
   for(let j=0;j<15;j++)this.box(-6.8+j*.97,h-.79,z+1.53,.86,.17,.035,j%3===0?'#ccc2a5':'#aa9b85');
   this.railAt(-7.27,z-1.42,7.27,z-1.42,h+.21);
   this.railAt(-7.27,z-1.42,-7.27,z+1.36,h+.21);
   this.railAt(7.27,z-1.42,7.27,z+1.36,h+.21);
  }
  // Zig-zag access stairway and erosion-control brush beside the terraces.
  for(let i=0;i<11;i++){
   const z=-4.9+i*.94,h=1.7-i*.16;
   this.box(8.5+(i%3)*.17,h-.18,z,1.25,.21,.82,'#cfb68f','#9f8e74');
  }
  for(let i=0;i<13;i++)this.hedge(-9.5, -10+i*1.7,1.6,'x',i%2?'#4c9764':'#43845e');
  for(let i=0;i<11;i++)this.pineTree(-20+(i%4)*2.2,-15+(Math.floor(i/4))*6.5,.8+(i%3)*.23);
  for(let i=0;i<9;i++)this.pineTree(12+(i%3)*3.3,-14+Math.floor(i/3)*6.5,.9+(i%3)*.14);
  for(let i=0;i<10;i++)this.rock(-11+(i%3)*1.5,-10+i*1.65,.65+(i%4)*.18);
  for(let i=0;i<8;i++)this.rock(12+(i%3)*3.1,2+(Math.floor(i/3))*3.9,.6+(i%3)*.16);
  // Simple hillside shelter and uphill tree crops, rather than lowland pens.
  this.box(12,-.04,-8,8,.32,7,'#839e6f','#718166');
  this.box(11,.27,-8.5,3.2,1.8,2.9,'#e1cb9d','#a88965');
  this.roof(11,2.10,-8.5,3.7,3.25);
  this.box(11.55,.31,-6.98,.68,1.25,.06,'#6a6655','#6a6655');
  for(let i=0;i<6;i++)this.fruitTree(10+(i%3)*3.1,1+Math.floor(i/3)*4.0,.67,i%2===0);
  this.box(-15,-.08,12,12,.08,2.1,'#b9b297','#9a8c74');
  this.wildflowers(17.5,11.5,3,3);
 }
 riversideScene(){
  // Broad winding waterway, sandy banks, reeds, footbridge and embanked fields.
  this.paintGround('riverside');
  for(let i=0;i<16;i++){
   const z=-20+i*2.65,z2=z+2.68;
   const right1=-10.75+Math.sin(z*.19)*1.1,right2=-10.75+Math.sin(z2*.19)*1.1;
   const w=10.3;
   this.quad(V(right1+1.5,-.036,z),V(right2+1.5,-.036,z2),V(right2-w-1.2,-.036,z2),V(right1-w-1.2,-.036,z),'#ddcc9e');
   this.quad(V(right1,-.021,z),V(right2,-.021,z2),V(right2-w,-.021,z2),V(right1-w,-.021,z),'#0daee4');
   this.quad(V(right1-1.8,-.012,z),V(right2-1.8,-.012,z2),V(right2-w+1.0,-.012,z2),V(right1-w+1.0,-.012,z),'#37d3ec');
   for(let j=0;j<3;j++){
    const xx=right1-2-j*2.15;
    this.box(xx,-.005,z+.65+j*.55,1.25,.008,.115,'#c8f6fb');
   }
  }
  // Flood protection berm makes riverside land visually different from dry lowland.
  this.box(-7.95,-.06,0,.92,.45,12.3,'#92df93','#4ca27a');
  this.box(-7.90,.36,0,.26,.15,12.3,'#d0cf97','#9baf78');
  this.box(0,-.17,0,14.7,.44,10.85,'#76d3a0','#3f9f81');
  this.box(0,.18,0,14.23,.065,10.35,'#89e0a0','#4fae87');
  // A timber footbridge, crossing the river away from the planting beds.
  this.box(-15.2,.17,-3.75,14.2,.20,2.1,'#d7b589','#a17c5b');
  for(let i=0;i<16;i++){
   const x=-22.2+i*.91;
   this.box(x,.37,-3.75,.045,.03,1.96,i%2?'#b9906a':'#e0c49b');
  }
  this.railAt(-22.1,-4.85,-8.1,-4.85,.35,'#e6d1ab');
  this.railAt(-22.1,-2.65,-8.1,-2.65,.35,'#e6d1ab');
  this.box(-15.3,-.05,2.5,2.3,.18,1.1,'#b7966c','#9a764f');
  this.box(-15.1,.06,2.5,1.8,.28,.7,'#b58a5f','#805c46');
  // Wetland reeds and riverbank vegetation.
  for(let i=0;i<32;i++){
   const z=-17+i*1.13,x=-9.3+Math.sin(z*.19)*1.1;
   const px=x+(i%4)*.22;
   this.cylinder(px,-.012,z,.045,.48+(i%3)*.13,'#64996a',5);
   this.cone(px,.42+(i%3)*.12,z,.14,.27,i%4===0?'#ad9163':'#76ba7d',5);
  }
  for(let i=0;i<18;i++){
   const z=-16+i*1.7,x=-20.8+Math.sin(z*.19)*1.1;
   this.cylinder(x,-.012,z,.048,.35+(i%3)*.08,'#6f9a71',5);
  }
  // Waterside shelter, trees, flowers and a smaller orchard.
  this.box(9.2,-.02,-8,7.5,.25,7.4,'#a0e89a','#50ab84');
  this.box(10.1,.22,-8.3,3.5,2,3.0,'#fff1cc','#d4c5a7');
  this.roof(10.1,2.23,-8.3,3.9,3.5);
  this.box(10.4,.26,-6.78,.72,1.3,.08,'#74a3a5','#638987');
  this.box(9,-.03,2.3,3.8,.09,10.7,'#e3d1ad','#d2bd96');
  for(let i=0;i<8;i++)this.fruitTree(11+(i%2)*2.6,-1.9+Math.floor(i/2)*2.7,.73,i%3===0);
  for(let i=0;i<9;i++)this.voxelTree(17+(i%2)*3.0,-15+(Math.floor(i/2))*7.2,.72+(i%3)*.12,i);
  this.wildflowers(17.5,10.4,3,3);
  this.wildflowers(14.5,14.1,3,2);
  this.layer=0;
  this.railAt(-7.25,-5.45,7.25,-5.45,.42,'#f1e9ca');
  this.railAt(7.25,-5.45,7.25,5.45,.42,'#f1e9ca');
  this.railAt(-7.25,5.45,7.25,5.45,.42,'#f1e9ca');
 }
 environment(t){
  const terrain=this.terrainKind();
  if(terrain==='hillside')this.hillsideScene();
  else if(terrain==='riverside')this.riversideScene();
  else this.lowlandScene();
 }

 plantModel(crop,x,z,progress,t,seed){
  const h=clamp(.13+progress*1.65,.12,1.9),sway=this.reduced?0:Math.sin(t*.0014+seed*1.37)*.045*progress;
  const top=x+sway,leaf1='#4caa65',leaf2='#78be75';
  if(progress<.13){this.cylinder(x,.39,z,.055,.13,'#57a86c',5);this.leaf(x,.48,z,.25,seed*2.1,leaf2);return}
  if(crop==='corn'){
   this.cylinder(x,.39,z,.065,h,'#4c9e57',6);
   for(let j=0;j<5;j++){const q=(j*2.42+seed)%6.28;this.leaf(x,.55+j*h*.18,z,.45+progress*.27,q,j%2?leaf1:leaf2,.11)}
   if(progress>.55){this.cylinder(x+.12,.39+h*.52,z,.11,.23*progress,'#f1bf54',7);this.sphere(x+.12,.58+h*.52,z,.11,.18,.11,'#e9ce65',6,3)}
   if(progress>.83)this.cone(top,.39+h,z,.17,.29,'#dfc27c',7);
  }else if(crop==='rice'){
   for(let j=0;j<5;j++){const q=j*2.4+seed,dx=Math.cos(q)*.12,dz=Math.sin(q)*.12;this.cylinder(x+dx,.39,z+dz,.026,h*(.82+.08*Math.sin(j)),'#68a966',5);this.leaf(x+dx,.5+h*.4,z+dz,.31+progress*.18,q,leaf2,.07);if(progress>.7)this.sphere(x+dx,.42+h*.85,z+dz,.09,.2,.08,'#e5cb70',6,3)}
  }else{
   this.cylinder(x,.39,z,.045,h*.72,'#3f8e54',5);
   for(let j=0;j<4;j++){const q=j*1.55+seed,yy=.43+h*(.3+j*.11);this.leaf(x,yy,z,.28+progress*.25,q,j%2?leaf1:leaf2,.13);this.sphere(x+Math.cos(q)*.17,yy+.05,z+Math.sin(q)*.17,.17*progress+.05,.10*progress+.05,.12*progress+.04,j%2?'#5cae67':'#8bc67b',6,3)}
   if(progress>.78){const podCol=crop==='peanut'?'#d8bc85':crop==='mung'?'#4e9050':'#6da55b';this.sphere(x+.12,.5+h*.25,z+.06,.085,.2,.07,podCol,6,3)}
  }
 }
 plots(t){this.tileTop=[];const state=this.state;if(!state)return;
  for(let id=0;id<12;id++){
   const c=id%4,r=Math.floor(id/4),x=tileX(c),z=tileZ(r),plot=state.plots[id],selected=state.selected.has(id),hover=this.hover===id;const elevation=this.rowElevation(r);this.meshY=elevation;
   const soilType=String(state.farm?.soil||'').toLowerCase();const top=soilType.includes('clay')?'#9b6952':soilType.includes('sand')?'#c1a16b':plot.crop?'#806247':'#8c7150',side='#654c39';this.box(x,.26,z,2.89,.14,2.7,top,side);
   for(let k=0;k<4;k++){const xx=x-1.03+k*.69;this.box(xx,.405,z,.08,.02,2.37,'#a2835d','#977450')}
   if(selected||hover){this.quad(V(x-1.43,.428,z-1.33),V(x+1.43,.428,z-1.33),V(x+1.43,.428,z+1.33),V(x-1.43,.428,z+1.33),selected?'#c6ee9e':'#a1dfbc',selected?.32:.18)}
   if(plot.crop){
    const raw=plot.age/plot.maturity;
    const prog=clamp(plot.animFrom!==undefined&&plot.animStart!==undefined?plot.animFrom+(raw-plot.animFrom)*clamp((t-plot.animStart)/1000,0,1):raw,.04,1);
    for(let k=0;k<6;k++){const dx=(k%3-1)*.74,dz=(Math.floor(k/3)-.5)*1.05;this.plantModel(plot.crop,x+dx,z+dz,prog,t,id*7+k)}
   }
   this.tileTop.push({id,poly:[V(x-1.43,.46+elevation,z-1.33),V(x+1.43,.46+elevation,z-1.33),V(x+1.43,.46+elevation,z+1.33),V(x-1.43,.46+elevation,z+1.33)],center:V(x,.51+elevation,z),selected,ready:plot.crop&&plot.age>=plot.maturity})
  }
  this.meshY=0;
 }
 draw(t){if(!this.ctx||!this.w||!this.h)return;const ctx=this.ctx;ctx.setTransform(this.dpr,0,0,this.dpr,0,0);this.camera();const w=this.w,h=this.h;
  const terrain=this.terrainKind();const sky=ctx.createLinearGradient(0,0,w,h);
  if(terrain==='hillside'){sky.addColorStop(0,'#6db9ed');sky.addColorStop(.55,'#d5f3db');sky.addColorStop(1,'#b4e39b')}
  else if(terrain==='riverside'){sky.addColorStop(0,'#49bbef');sky.addColorStop(.55,'#c3f4ef');sky.addColorStop(1,'#95e5be')}
  else {sky.addColorStop(0,'#70c8ff');sky.addColorStop(.55,'#d4f7d1');sky.addColorStop(1,'#b9eb89')}ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
  const glow=ctx.createRadialGradient(w*.75,h*.19,0,w*.75,h*.19,w*.62);glow.addColorStop(0,'rgba(255,250,206,.58)');glow.addColorStop(.38,'rgba(245,255,214,.13)');glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
  // The ground and plants are real XYZ meshes, projected by the orbit camera.
  if(!this.staticFaces||this.staticTerrain!==terrain){this.meshY=0;this.faces=[];this.layer=0;this.environment(0);this.staticFaces=this.faces;this.staticTerrain=terrain;}this.faces=this.staticFaces.slice();this.layer=1;this.plots(t);
  const drawables=[];for(const f of this.faces){const p=f.points.map(v=>this.project(v));if(p.some(v=>!v))continue;const depth=p.reduce((a,v)=>a+v[2],0)/p.length;const e1=sub(f.points[1],f.points[0]),e2=sub(f.points[2],f.points[0]),n=norm(cross(e1,e2));const sun=norm([.35,1,.58]);const light=clamp(.78+Math.abs(dot(n,sun))*.27,.73,1.12);drawables.push({p,depth,layer:f.layer,color:tint(f.color,light),alpha:f.alpha})}
  drawables.sort((a,b)=>a.layer-b.layer||b.depth-a.depth);
  for(const f of drawables){ctx.globalAlpha=f.alpha;ctx.fillStyle=f.color;ctx.beginPath();ctx.moveTo(f.p[0][0],f.p[0][1]);for(let j=1;j<f.p.length;j++)ctx.lineTo(f.p[j][0],f.p[j][1]);ctx.closePath();ctx.fill()}
  ctx.globalAlpha=1;
  this.hit=[];
  for(const tile of this.tileTop){const p=tile.poly.map(v=>this.project(v));if(p.some(v=>!v))continue;this.hit.push({id:tile.id,poly:p.map(v=>[v[0],v[1]])});const center=this.project(tile.center);if(!center)continue;
   if(tile.selected||tile.ready||this.hover===tile.id){ctx.lineWidth=tile.selected?3.5:2;ctx.strokeStyle=tile.selected?'#e8ffa8':tile.ready?'#f5dc8d':'#c4f3d2';ctx.beginPath();p.forEach((v,i)=>i?ctx.lineTo(v[0],v[1]):ctx.moveTo(v[0],v[1]));ctx.closePath();ctx.stroke()}
   const size=tile.selected?14:11;ctx.beginPath();ctx.fillStyle=tile.selected?'#e8ffa8':'rgba(12,57,45,.83)';ctx.arc(center[0],center[1],size,0,Math.PI*2);ctx.fill();ctx.font=`800 ${tile.selected?11:10}px system-ui,sans-serif`;ctx.fillStyle=tile.selected?'#19483d':'#efffef';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(tile.id+1),center[0],center[1]+.5);
  }
  const s=this.state;if(s&&s.season===1){ctx.strokeStyle='rgba(204,244,236,.22)';ctx.lineWidth=1.5;for(let i=0;i<32;i++){const x=(i*71+t*.08)%(w+100)-50,y=(i*107+t*.18)%(h+100)-50;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-8,y+20);ctx.stroke()}}
 }
}
window.AVFarm3D={create:(canvas,onPick)=>{const world=new FarmWorld(canvas,onPick);window.AVFarm3D.current=world;return world}};
})();
