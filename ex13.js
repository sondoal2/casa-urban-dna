'use strict';
/* Exercise 1.3 — City identity card: five topics, layer stack, climate sequence, wind, SVG export */
window.Ex13=(()=>{
 const L=(ar,en)=>Locale.language==='ar'?ar:en;
 let data=null,wind=null,loading=null,topic=null,playTimer=null,windOn=false,windSeason='summer',particles=[],windRaf=0,overlay=null,octx=null,clipFrame=true;
 const FRAME=[-9725.897,8018.927,5274.103,23018.927];

 /* ---------- colour ramps ---------- */
 const lerp=(a,b,t)=>a+(b-a)*t;
 const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
 function ramp(stops){const c=stops.map(hex);return t=>{t=Math.max(0,Math.min(1,t));const p=t*(c.length-1),i=Math.min(c.length-2,Math.floor(p)),f=p-i;return'rgb('+c[i].map((v,k)=>Math.round(lerp(v,c[i+1][k],f))).join(',')+')'}}
 const R={
  heat:ramp(['#1d1546','#2d3f8f','#2a7ab0','#2fae9c','#9ccc65','#f4dc4c','#f7a13b','#e5522f','#a3152a']),
  ndvi:ramp(['#8a5a34','#c9a36b','#ece4c4','#a9cf7d','#4f9e48','#155e2e']),
  pop:ramp(['#2a2117','#5a3a1c','#98682c','#d39a4a','#f3cf87','#fff3d2']),
  built:ramp(['#202020','#4a4a46','#7c7c76','#adada6','#dcdcd4','#ffffff']),
  bus:ramp(['#c97b6e','#d9452f','#f0281a','#ff1f10']),
  night:ramp(['#000000','#2b1600','#8a4a00','#e09a2a','#ffe3a0','#fffdf2'])};
 const ZONES=[['centre_historic','#ffd166','المركز التاريخي','Historic centre'],['centre_modern','#7ad7ff','المركز الحديث','Modern centre'],['centre_contemporary','#c58cff','المركز المعاصر','Contemporary centre'],['centre_port','#8ce0a0','الميناء / الاقتصادي','Port / economic']];
 const popBreaks=[0,25,50,100,200,400,800,1600],builtBreaks=[0,10,25,40,55,70,85];
 const classOf=(v,br)=>{let k=0;for(let i=0;i<br.length;i++)if(v>=br[i])k=i;return k/(br.length-1)};

 /* ---------- POI groups ---------- */
 const COMMERCE=new Set('supermarket convenience clothes retail bakery butcher shoe_shop jeweller florist greengrocer mall department_store kiosk market_place gift_shop beverages furniture_shop doityourself sports_shop mobile_phone_shop optician bookshop toy_shop computer_shop chemist beauty_shop outdoor_shop video_shop newsagent bicycle_shop car_dealership garden_centre stationery hairdresser'.split(' '));
 const FOOD=new Set(['cafe','restaurant','fast_food','bar','pub','food_court','ice_cream','biergarten']);
 const CIVIC=new Set(['town_hall','courthouse','university','college','hospital','police','post_office','embassy','library','theatre','museum','public_building','fire_station','arts_centre','school','clinic','bank']);

 /* ---------- layer catalogue ---------- */
 const LAYERS={
  pop:{t:['السكان · GHS-POP 2025','Population · GHS-POP 2025'],type:'grid',unit:['نسمة / خلية 100م (هكتار)','people / 100 m cell (ha)'],src:'GHSL GHS-POP E2025, 100 m',breaks:popBreaks,ramp:'pop',frame:true},
  built:{t:['المساحة المبنية · GHS-BUILT-S','Built-up surface · GHS-BUILT-S'],type:'grid',unit:['% من الخلية مبني','% of cell built'],src:'GHSL GHS-BUILT-S E2025, 100 m',breaks:builtBreaks,ramp:'built',frame:true},
  landuse:{t:['استعمالات الأراضي','Land use'],type:'landuse',src:'OpenStreetMap (Geofabrik)',frame:true},
  rail:{t:['السكك — حدود تقطع المدينة','Railways — city edges'],type:'line',color:'#ff5a36',w:2.2,src:'OpenStreetMap',frame:true},
  centres:{t:['تركّز التجارة والخدمات / كم²','Commerce + services per km²'],type:'circles',src:'OpenStreetMap POIs',frame:true},
  civic:{t:['المؤسسات العامة','Public institutions'],type:'civic',src:'OpenStreetMap POIs',frame:true},
  stops:{t:['محطات الباص والترام','Bus + tram stops'],type:'stops',src:'OpenStreetMap',frame:true},
  zones:{t:['المراكز الأربعة: تاريخي، حديث، معاصر، ميناء','Four centres: historic, modern, contemporary, port'],type:'zones',src:'Colleague layers: historic_center, modern_center, contemporary_center, Port_Economic_Center',frame:true},
  inst:{t:['المؤسسات (طبقة الزميلة)','Institutions (colleague layer)'],type:'inst',src:'Colleague layer: Institutions_Only (OSM)',frame:true},
  nightlights:{t:['الإضاءة الليلية · VIIRS 2025','Night lights · VIIRS 2025'],type:'glow',unit:['nW/cm²/sr','nW/cm²/sr'],src:'NOAA/EOG VIIRS VNL v2 2025 (colleague clip), ≈460 m cells',frame:true},
  busflow:{t:['خطوط الباص · التداخل والنبض','Bus lines · overlap + pulse'],type:'busflow',src:'Colleague layers: Bus_Routes_Colored, Bus_Street_Overlap (Casabus, OSM)',frame:true},
  busstops:{t:['المحطات حسب عدد الخطوط','Stops by number of lines'],type:'busstops',src:'Colleague layers: Bus_Stops_With_Lines, Major_Transport_Hubs',frame:true},
  heat:{t:['حرارة سطح الأرض LST','Land surface temperature'],type:'value',unit:['°C','°C'],min:21,max:57,ramp:'heat',src:'Landsat 9 C2 L2 · 17.07.2025 (single day)',frame:true},
  ndvi:{t:['الغطاء النباتي NDVI','Vegetation NDVI'],type:'value',unit:['NDVI','NDVI'],min:-0.2,max:0.5,ramp:'ndvi',src:'Sentinel/Landsat NDVI (user export)',frame:true},
  flood:{t:['أرض قابلة للغمر','Flood-prone ground'],type:'fill',color:'#3d8bff',alpha:.55,src:'GIS: HAND < 5 m above drainage lines · SRTM 1″ (2000)',frame:true},
  water:{t:['المجاري ووادي بوسكورة','Streams + Oued Bouskoura'],type:'water',src:'Hydrology (user) + OSM',frame:true},
  contours:{t:['خطوط الكنتور · 10 م','Contours · 10 m'],type:'contours',unit:['م فوق سطح البحر','m a.s.l.'],src:'DEM contours (user)',frame:false},
  wind:{t:['الريح السائدة · محطة أنفا','Prevailing wind · Anfa station'],type:'wind',src:'EPW TMYx Casablanca-Anfa 601550',frame:true},
  dots:{t:['أين الناس: تجارة ومقاهٍ (نقطة = محل)','Where people are: shops + cafés (1 dot = 1 place)'],type:'dots',src:'OpenStreetMap POIs',frame:true},
  boundary:{t:['حدود الدار البيضاء','Casablanca boundary'],type:'outline',src:'OSM admin boundary',frame:false}
 };
 const TOPICS=[
  {id:'density',n:'01',t:['الكثافة','Density'],q:['أين المدينة كثيفة — بالناس أم بالبناء؟','Where is the city dense — in people or in buildings?'],layers:['pop','built','boundary'],form:['شبكة خلايا 100 م','100 m grid']},
  {id:'morphology',n:'02',t:['المورفولوجيا','Morphology'],q:['مِمّ صُنعت المدينة، وأين يتبدّل منطقها؟','What is the city made of, and where does its logic change?'],layers:['landuse','rail','boundary'],form:['مليء وفارغ + حدود','Figure-ground + edges'],base:true},
  {id:'centre',n:'03',t:['مركز المدينة','City centre'],q:['أين القلب — وهل هو واحد؟','Where is the heart — and is there only one?'],layers:['zones','centres','inst','civic','busstops','busflow','boundary'],form:['دوائر متناسبة','Proportional circles']},
  {id:'climate',n:'04',t:['المناخ','Climate'],q:['أين الحرّ وأين أقل — وبكم درجة؟','Where is it hot, where less — and by how much?'],layers:['heat','ndvi','flood','water','contours','wind','boundary'],form:['حقل متصل + خطوط تساوٍ','Continuous field + isolines'],play:['heat','ndvi','flood','contours']},
  {id:'human',n:'05',t:['البعد الإنساني','Human dimension'],q:['أين الناس فعلًا — أين يشترون ويلتقون؟','Where are people actually — buying, meeting?'],layers:['dots','nightlights','busflow','busstops','boundary'],form:['كثافة نقاط','Dot density']}
 ];
 const state={};Object.keys(LAYERS).forEach(k=>state[k]={on:false,op:1});
 let order=[];

 /* ---------- data ---------- */
 function load(){if(data)return Promise.resolve();if(loading)return loading;
  loading=Promise.all([fetch('data/ex13.json').then(r=>r.json()),fetch('data/wind.json?v=2').then(r=>r.json()),fetch('data/layers13b.json?v=2').then(r=>r.ok?r.json():{layers:{}}).catch(()=>({layers:{}}))]).then(([d,w,b])=>{data=d;wind=w;Object.assign(data.layers,b.layers);prepare()});return loading}
 const pathOf=rings=>{const p=new Path2D();for(const r of rings)r.forEach((v,i)=>i?p.lineTo(v[0],-v[1]):p.moveTo(v[0],-v[1]));return p};
 const bbox=rings=>{let a=[1e9,1e9,-1e9,-1e9];for(const r of rings)for(const v of r){if(v[0]<a[0])a[0]=v[0];if(v[1]<a[1])a[1]=v[1];if(v[0]>a[2])a[2]=v[0];if(v[1]>a[3])a[3]=v[1]}return a};
 const inF=c=>c[0]>=FRAME[0]&&c[0]<=FRAME[2]&&c[1]>=FRAME[1]&&c[1]<=FRAME[3];
 function prepare(){
  for(const k in data.layers)for(const f of data.layers[k].features||[])if(f.r)f.b=bbox(f.r);
  data.busMax=Math.max(1,...(data.layers.bus_overlap?.features||[]).map(f=>f.n||1));
  data.stopMax=Math.max(1,...(data.layers.bus_stops?.features||[]).map(f=>f.n||1));
  data.nightMax=Math.max(1,...(data.layers.night_lights?.cells||[]).map(c=>c[2]));
  data.hubIds=new Set((data.layers.transport_hubs?.features||[]).map(f=>f.c.join(',')));
  const P=data.layers.pois.features;
  data.commerce=P.filter(p=>COMMERCE.has(p.fclass)||FOOD.has(p.fclass)).filter(p=>inF(p.c));
  data.civic=P.filter(p=>CIVIC.has(p.fclass)).filter(p=>inF(p.c));
  data.stops=[...P.filter(p=>p.fclass==='bus_stop'||p.fclass==='tram_stop'),...data.layers.transport.features.filter(p=>/bus|tram|railway_station|taxi/.test(p.fclass||''))].filter(p=>inF(p.c));
  // 500 m grid of commerce + services → proportional circles (count per km²)
  const g=new Map(),s=500;for(const p of [...data.commerce,...data.civic]){const k=Math.floor(p.c[0]/s)+','+Math.floor(p.c[1]/s);g.set(k,(g.get(k)||0)+1)}
  data.centreCells=[...g].map(([k,n])=>{const [i,j]=k.split(',').map(Number);return{c:[(i+.5)*s,(j+.5)*s],n,d:n*4}}).sort((a,b)=>b.n-a.n);
  data.maxD=data.centreCells[0]?.d||1;
  data.contourMax=Math.max(...data.layers.contours.features.map(f=>f.v));
 }

 /* ---------- painting (world coords, y flipped) ---------- */
 function paint(ctx,bounds){
  if(!data)return;const s=view.s,vis=order.filter(k=>state[k].on);if(!vis.length)return;
  for(const k of vis){if(k==='boundary')continue;const def=LAYERS[k];
   if(def.type==='grid'||def.type==='value'){drawOpaque(ctx,k,def,bounds,s);continue}
   ctx.save();ctx.globalAlpha=state[k].op;
   if(def.frame&&clipFrame){ctx.beginPath();ctx.rect(FRAME[0],-FRAME[3],FRAME[2]-FRAME[0],FRAME[3]-FRAME[1]);ctx.clip()}
   draw[def.type](ctx,k,def,bounds,s);ctx.restore()}
  if(maskOut&&state.boundary.on!==undefined&&topic){ctx.save();const big=new Path2D();big.rect(-60000,-60000,120000,120000);for(const f of data.layers.boundary.features)big.addPath(f.p||(f.p=pathOf(f.r)));ctx.fillStyle=light?'rgba(244,244,240,.8)':'rgba(8,8,8,.78)';ctx.fill(big,'evenodd');ctx.restore()}
  if(state.boundary.on){ctx.save();draw.outline(ctx,'boundary',LAYERS.boundary,bounds,s);ctx.restore()}
  // frame outline on top
  ctx.save();ctx.strokeStyle=light?'#111':'#fff';ctx.lineWidth=1/s;ctx.setLineDash([6/s,5/s]);ctx.strokeRect(FRAME[0],-FRAME[3],FRAME[2]-FRAME[0],FRAME[3]-FRAME[1]);ctx.restore();
 }
 // Cell layers are filled and stroked in the same colour to close seams. Drawn straight onto the map at
 // partial opacity, those strokes overlap the fills and show as an outline around every cell, so draw the
 // layer opaque on a scratch canvas and apply the opacity once.
 let scratch=null;
 function drawOpaque(ctx,k,def,bounds,s){const c=ctx.canvas;scratch??=document.createElement('canvas');if(scratch.width!==c.width||scratch.height!==c.height){scratch.width=c.width;scratch.height=c.height}
  const o=scratch.getContext('2d');o.setTransform(1,0,0,1,0,0);o.clearRect(0,0,scratch.width,scratch.height);o.setTransform(ctx.getTransform());
  if(def.frame&&clipFrame){o.save();o.beginPath();o.rect(FRAME[0],-FRAME[3],FRAME[2]-FRAME[0],FRAME[3]-FRAME[1]);o.clip()}
  draw[def.type](o,k,def,bounds,s);if(def.frame&&clipFrame)o.restore();
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=state[k].op;ctx.drawImage(scratch,0,0);ctx.restore()}
 // Night lights: a Gaussian-weighted average of the ≈460 m VIIRS cells, sampled at 50 m/px and coloured
 // with the night ramp. Every pixel stays within the range of its neighbouring cells; smoothing is for display.
 let glowCache=null;
 function nightGlow(){if(glowCache)return glowCache;const nl=data.layers.night_lights;if(!nl)return null;
  const res=50,cell=nl.cell_m[0],sig=cell*.6,reach=cell*1.5,xs=nl.cells.map(c=>c[0]),ys=nl.cells.map(c=>c[1]);
  const box=[Math.min(...xs)-cell,Math.min(...ys)-cell,Math.max(...xs)+cell,Math.max(...ys)+cell],w=Math.ceil((box[2]-box[0])/res),h=Math.ceil((box[3]-box[1])/res);
  const B=new Map(),bk=(x,y)=>Math.floor(x/reach)+','+Math.floor(y/reach);for(const c of nl.cells){const k=bk(c[0],c[1]);(B.get(k)||B.set(k,[]).get(k)).push(c)}
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;const ctx2=cv.getContext('2d'),img=ctx2.createImageData(w,h),d=img.data;
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){const x=box[0]+(i+.5)*res,y=box[3]-(j+.5)*res,gx=Math.floor(x/reach),gy=Math.floor(y/reach);let sw=0,sv=0;
   for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(const c of B.get((gx+a)+','+(gy+b))||[]){const dd=(c[0]-x)**2+(c[1]-y)**2;if(dd>reach*reach)continue;const wt=Math.exp(-dd/(2*sig*sig));sw+=wt;sv+=wt*c[2]}
   if(!sw)continue;const t=Math.pow(Math.min(1,sv/sw/data.nightMax),.75),rgb=R.night(t).match(/\d+/g),p=(j*w+i)*4;d[p]=+rgb[0];d[p+1]=+rgb[1];d[p+2]=+rgb[2];d[p+3]=Math.round(255*Math.min(1,sw*1.4)*Math.min(1,.25+t))}
  ctx2.putImageData(img,0,0);return glowCache={canvas:cv,box}}
 function clipCasa(ctx){const p=new Path2D();for(const f of data.layers.boundary.features)p.addPath(f.p||(f.p=pathOf(f.r)));ctx.clip(p)}
 const vis=(f,b)=>!f.b||overlap(f.b,b);
 const draw={
  grid(ctx,k,def,b,s){const fn=R[def.ramp];ctx.lineWidth=.7/s;for(const f of data.layers[k].features){if(!vis(f,b))continue;const c=fn(classOf(f.v,def.breaks)),p=f.p||(f.p=pathOf(f.r));ctx.fillStyle=ctx.strokeStyle=c;ctx.fill(p);ctx.stroke(p)}},
  value(ctx,k,def,b,s){const fn=R[def.ramp];ctx.lineWidth=.7/s;for(const f of data.layers[k].features){if(!vis(f,b))continue;const c=fn((f.v-def.min)/(def.max-def.min)),p=f.p||(f.p=pathOf(f.r));ctx.fillStyle=ctx.strokeStyle=c;ctx.fill(p);ctx.stroke(p)}},
  fill(ctx,k,def,b){ctx.fillStyle=def.color;ctx.globalAlpha*=def.alpha;for(const f of data.layers[k].features)if(vis(f,b))ctx.fill(f.p||(f.p=pathOf(f.r)),'evenodd')},
  line(ctx,k,def,b,s){ctx.strokeStyle=def.color;ctx.lineWidth=def.w/s;for(const f of data.layers[k].features)if(vis(f,b))ctx.stroke(f.p||(f.p=pathOf(f.r)))},
  outline(ctx,k,def,b,s){ctx.strokeStyle='#e0a050';ctx.lineWidth=2.4/s;for(const f of data.layers[k].features)ctx.stroke(f.p||(f.p=pathOf(f.r)))},
  water(ctx,k,def,b,s){ctx.strokeStyle='#5fb4ff';ctx.lineWidth=.8/s;for(const f of data.layers.streams.features)if(vis(f,b))ctx.stroke(f.p||(f.p=pathOf(f.r)));ctx.strokeStyle='#8fd0ff';ctx.lineWidth=2.4/s;for(const f of data.layers.bouskoura.features)ctx.stroke(f.p||(f.p=pathOf(f.r)))},
  contours(ctx,k,def,b,s){const step=s<.08?50:s<.2?20:10;for(const f of data.layers.contours.features){if(f.v%step||!vis(f,b))continue;const major=f.v%50===0;ctx.strokeStyle=major?'#d8c9a6':'#8f8670';ctx.lineWidth=(major?1.1:.5)/s;ctx.stroke(f.p||(f.p=pathOf(f.r)))}},
  landuse(ctx,k,def,b){for(const f of data.layers.landuse.features){if(!vis(f,b))continue;ctx.fillStyle=LU[f.fclass]||LU._;ctx.fill(f.p||(f.p=pathOf(f.r)))}},
  circles(ctx,k,def,b,s){ctx.strokeStyle='#ffb347';ctx.fillStyle='rgba(255,179,71,.28)';ctx.lineWidth=1/s;for(const c of data.centreCells){if(c.n<3)continue;const r=Math.sqrt(c.d/data.maxD)*480;ctx.beginPath();ctx.arc(c.c[0],-c.c[1],r,0,7);ctx.fill();ctx.stroke()}},
  civic(ctx,k,def,b,s){ctx.fillStyle='#fff';ctx.strokeStyle='#111';ctx.lineWidth=1/s;const r=Math.max(25,3.2/s);for(const p of data.civic){ctx.beginPath();ctx.rect(p.c[0]-r,-p.c[1]-r,2*r,2*r);ctx.fill();ctx.stroke()}},
  stops(ctx,k,def,b,s){ctx.fillStyle='#ff3b30';const r=Math.max(12,1.8/s);for(const p of data.stops){ctx.beginPath();ctx.arc(p.c[0],-p.c[1],r,0,7);ctx.fill()}},
  zones(ctx,k,def,b,s){for(const [key,c] of ZONES){const f=data.layers[key]?.features[0];if(!f)continue;const p=f.p||(f.p=pathOf(f.r));ctx.fillStyle=c+'2e';ctx.fill(p,'evenodd');ctx.strokeStyle=c;ctx.lineWidth=2/s;ctx.stroke(p)}
   ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.font='600 12px "Readex Pro","Noto Kufi Arabic",sans-serif';ctx.textAlign='center';
   for(const [key,c,a,e] of ZONES){const f=data.layers[key]?.features[0];if(!f)continue;const [x,y]=screen((f.b[0]+f.b[2])/2,f.b[3]),d=Math.min(devicePixelRatio||1,1.5),t=L(a,e);ctx.setTransform(d,0,0,d,0,0);ctx.fillStyle='#0e0e0ecc';const w=ctx.measureText(t).width+12;ctx.fillRect(x-w/2,y-22,w,18);ctx.fillStyle=c;ctx.fillText(t,x,y-9)}ctx.restore()},
  inst(ctx,k,def,b,s){const r=Math.max(30,4/s);ctx.fillStyle='#7ad7ff';ctx.strokeStyle='#0b2530';ctx.lineWidth=1/s;for(const p of data.layers.institutions?.features||[]){ctx.beginPath();ctx.moveTo(p.c[0],-p.c[1]-r);ctx.lineTo(p.c[0]+r,-p.c[1]);ctx.lineTo(p.c[0],-p.c[1]+r);ctx.lineTo(p.c[0]-r,-p.c[1]);ctx.closePath();ctx.fill();ctx.stroke()}},
  glow(ctx,k,def,b,s){const g=nightGlow();if(!g)return;ctx.imageSmoothingEnabled=true;ctx.drawImage(g.canvas,g.box[0],-g.box[3],g.box[2]-g.box[0],g.box[3]-g.box[1])},
  busflow(ctx,k,def,b,s){const L_=data.layers;if(!L_.bus_routes)return;ctx.lineCap=ctx.lineJoin='round';
   ctx.strokeStyle=R.bus(0);ctx.lineWidth=.9/s;for(const f of L_.bus_routes.features)if(vis(f,b))ctx.stroke(f.p||(f.p=pathOf(f.r)));
   const ov=[...L_.bus_overlap.features].sort((a,c)=>(a.n||1)-(c.n||1));
   for(const f of ov){if(!vis(f,b))continue;const t=((f.n||1)-1)/Math.max(1,data.busMax-1);ctx.strokeStyle=R.bus(t);ctx.lineWidth=(1+t*3.5)/s;ctx.stroke(f.p||(f.p=pathOf(f.r)))}},
  busstops(ctx,k,def,b,s){const L_=data.layers;if(!L_.bus_stops)return;const u=Math.max(8,1.1/s);
   for(const p of [...L_.bus_stops.features].sort((a,c)=>(a.n||1)-(c.n||1))){const r=u*Math.sqrt(p.n||1);ctx.beginPath();ctx.arc(p.c[0],-p.c[1],r,0,7);ctx.fillStyle=R.bus(((p.n||1)-1)/Math.max(1,data.stopMax-1));ctx.fill();ctx.lineWidth=.6/s;ctx.strokeStyle='#120403';ctx.stroke()}
   ctx.strokeStyle='#fff';ctx.lineWidth=1.6/s;for(const p of L_.transport_hubs.features){ctx.beginPath();ctx.arc(p.c[0],-p.c[1],u*Math.sqrt(p.n||1)+3/s,0,7);ctx.stroke()}},
  dots(ctx,k,def,b,s){const r=Math.max(10,1.4/s);for(const p of data.commerce){ctx.fillStyle=FOOD.has(p.fclass)?'#ffd166':'#f4f1ea';ctx.beginPath();ctx.arc(p.c[0],-p.c[1],r,0,7);ctx.fill()}},
  wind(){}
 };
 const LU={residential:'#4a3f35',commercial:'#a5673a',retail:'#c07a3e',industrial:'#5b5f73',park:'#3f7a43',grass:'#58864a',forest:'#2f5e35',cemetery:'#6a6a5a',farmland:'#7d7748',meadow:'#6d8a4f',recreation_ground:'#4f8f5a',military:'#704848',scrub:'#5e6b45',_:'#3d3d3a'};

 /* ---------- wind: particles on overlay canvas ---------- */
 function ensureOverlay(){if(overlay)return;overlay=document.createElement('canvas');overlay.id='windLayer';document.body.appendChild(overlay);octx=overlay.getContext('2d');size();addEventListener('resize',size)}
 function size(){if(!overlay)return;overlay.width=innerWidth;overlay.height=innerHeight}
 function sampleDir(){const f=wind[windSeason].freq;let u=Math.random()*f.reduce((a,b)=>a+b,0);for(let i=0;i<16;i++){u-=f[i];if(u<=0)return i}return 0}
 function mean(){const w=wind[windSeason];let u=0,v=0,n=0;w.freq.forEach((f,i)=>{const to=(i*22.5+180)*Math.PI/180;u+=f*w.speed[i]*Math.sin(to);v+=f*w.speed[i]*Math.cos(to);n+=f});return{ang:Math.atan2(u,v),spd:Math.max(1.5,Math.hypot(u,v)/n*1.6)}}
 function spawn(){return{x:lerp(FRAME[0],FRAME[2],Math.random()),y:lerp(FRAME[1],FRAME[3],Math.random()),age:0,life:60+Math.random()*90}}
 let tick=0;
 function windLoop(){windRaf=requestAnimationFrame(windLoop);if(!windOn||!state.wind.on){octx.clearRect(0,0,overlay.width,overlay.height);return}
  octx.globalCompositeOperation='destination-out';octx.fillStyle='rgba(0,0,0,.14)';octx.fillRect(0,0,overlay.width,overlay.height);octx.globalCompositeOperation='source-over';
  while(particles.length<1400)particles.push(spawn());
  octx.fillStyle='rgba(130,200,255,.9)';const k=14; // metres per frame per m/s (visual speed)
  const M=mean();tick+=.004;for(const p of particles){const a=M.ang+.12*Math.sin(p.x/2600+tick)*Math.cos(p.y/3100-tick*.7);p.x+=Math.sin(a)*M.spd*k;p.y+=Math.cos(a)*M.spd*k;p.age++;if(p.age>p.life||!inF([p.x,p.y])){Object.assign(p,spawn());continue}const [sx,sy]=screen(p.x,p.y);octx.fillRect(sx-1,sy-1,2,2)}}
 function setWind(on){windOn=on;if(on){ensureOverlay();if(!windRaf)windLoop()}else if(octx)octx.clearRect(0,0,overlay.width,overlay.height)}

 /* ---------- buses: illustrative pulse along the colleague's routes (no timetable) ----------
    Each bus leaves a 10%-opacity red tail drawn with additive blending, so streets shared by
    several lines build up towards bright red. */
 let busOn=false,busRaf=0,bcan=null,bctx=null,buses=null;
 const BUS_TAIL=650,BUS_SPACING=2600;
 function prepBuses(){buses=[];for(const f of data.layers.bus_routes?.features||[])for(const pts of f.r){if(pts.length<2)continue;const cum=[0];for(let i=1;i<pts.length;i++)cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));const len=cum.at(-1);if(len<500)continue;const route={pts,cum,len};for(let n=Math.max(1,Math.round(len/BUS_SPACING)),i=0;i<n;i++)buses.push({route,d:(i+Math.random()*.6)*len/n,v:5+Math.random()*2.5})}}
 function seek(r,d){let lo=0,hi=r.cum.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(r.cum[m]<d)lo=m;else hi=m}return lo}
 function pointAt(r,i,d){const a=r.pts[i],b=r.pts[i+1],t=(d-r.cum[i])/Math.max(1e-6,r.cum[i+1]-r.cum[i]);return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]}
 function busLoop(){busRaf=requestAnimationFrame(busLoop);if(!bctx)return;bctx.clearRect(0,0,bcan.width,bcan.height);if(!busOn||!topic||!state.busflow.on||!buses)return;
  bctx.save();if(clipFrame){const [x0,y0]=screen(FRAME[0],FRAME[3]),[x1,y1]=screen(FRAME[2],FRAME[1]);bctx.beginPath();bctx.rect(x0,y0,x1-x0,y1-y0);bctx.clip()}
  bctx.globalAlpha=state.busflow.op;bctx.globalCompositeOperation='lighter';bctx.lineCap=bctx.lineJoin='round';bctx.lineWidth=3.2;bctx.strokeStyle='rgba(255,40,28,.10)';
  const heads=[];
  for(const b of buses){const r=b.route;b.d+=b.v;if(b.d>r.len)b.d-=r.len;const d0=Math.max(0,b.d-BUS_TAIL),i0=seek(r,d0),i1=seek(r,b.d);
   const head=pointAt(r,i1,b.d);bctx.beginPath();let p=screen(...pointAt(r,i0,d0));bctx.moveTo(p[0],p[1]);for(let i=i0+1;i<=i1;i++){p=screen(...r.pts[i]);bctx.lineTo(p[0],p[1])}p=screen(...head);bctx.lineTo(p[0],p[1]);bctx.stroke();heads.push(p)}
  bctx.globalCompositeOperation='source-over';bctx.fillStyle='#ff6a52';for(const [x,y] of heads)bctx.fillRect(x-1.5,y-1.5,3,3);bctx.restore()}
 function setBus(on){busOn=on;if(on){if(!bcan){bcan=document.createElement('canvas');bcan.id='busLayer';document.body.appendChild(bcan);bctx=bcan.getContext('2d');const fit=()=>{bcan.width=innerWidth;bcan.height=innerHeight};fit();addEventListener('resize',fit)}if(!buses)prepBuses();if(!busRaf)busLoop()}else if(bctx)bctx.clearRect(0,0,bcan.width,bcan.height)}

 /* ---------- legend ---------- */
 const swatch=c=>`<i style="background:${c}"></i>`;
 function legend(k){const d=LAYERS[k],u=d.unit?L(d.unit[0],d.unit[1]):'';
  if(d.type==='grid'){const br=d.breaks;return `<div class="lg">${br.map((v,i)=>`<span>${swatch(R[d.ramp](i/(br.length-1)))}${i===br.length-1?'≥ '+v:v+'–'+br[i+1]}</span>`).join('')}<small>${u}</small></div>`}
  if(d.type==='value'){const n=8,ticks=[...Array(n+1)].map((_,i)=>d.min+(d.max-d.min)*i/n);return `<div class="lg grad"><b style="background:linear-gradient(90deg,${ticks.map((v,i)=>R[d.ramp](i/n)).join(',')})"></b><div>${ticks.filter((_,i)=>i%2===0).map(v=>`<span>${k==='ndvi'?v.toFixed(2):Math.round(v)}</span>`).join('')}</div><small>${u}${k==='heat'?L(' · 37 قيمة أصلية من 21 إلى 57',' · 37 source values, 21–57'):''}</small></div>`}
  if(k==='flood')return `<div class="lg">${swatch('#3d8bff')}<span>${L('أرض قابلة للغمر · أقل من 5 م فوق أقرب مجرى','Flood-prone ground · under 5 m above nearest stream')}</span></div>`;
  if(k==='water')return `<div class="lg"><span>${swatch('#5fb4ff')}${L('مجاري مائية','streams')}</span><span>${swatch('#8fd0ff')}Oued Bouskoura</span></div>`;
  if(k==='contours')return `<div class="lg"><span>${swatch('#d8c9a6')}${L('كل 50 م','every 50 m')}</span><span>${swatch('#8f8670')}10 م</span><small>0–${data?Math.round(data.contourMax):''} ${u}</small></div>`;
  if(k==='centres')return `<div class="lg"><span><em class="circ"></em>${L('مساحة الدائرة = عدد المحلات والخدمات في كم²','circle area = shops + services per km²')}</span><small>${L('أعلى خلية','max cell')}: ${data?data.maxD:''} / km² · ${L('خلايا 500 م','500 m cells')}</small></div>`;
  if(k==='civic')return `<div class="lg"><span>${swatch('#fff')}${data?data.civic.length:''} ${L('مؤسسة: بلدية، محكمة، جامعة، مستشفى، مدرسة، بنك…','institutions: town hall, court, university, hospital, school, bank…')}</span></div>`;
  if(k==='stops')return `<div class="lg"><span>${swatch('#ff3b30')}${data?data.stops.length:''} ${L('محطة (OSM) — طبقات الزميلة بالطريق','stops (OSM) — colleague layers pending')}</span></div>`;
  if(k==='zones')return `<div class="lg">${ZONES.map(([,c,a,e])=>`<span>${swatch(c)}${L(a,e)}</span>`).join('')}</div>`;
  if(k==='inst'&&data?.layers.institutions){const n={};for(const p of data.layers.institutions.features)n[p.fclass]=(n[p.fclass]||0)+1;return `<div class="lg"><span><em class="circ" style="background:#7ad7ff;border-radius:0;transform:rotate(45deg)"></em>${data.layers.institutions.features.length} ${L('مؤسسة','institutions')}</span><small>${Object.entries(n).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+' '+v).join(' · ')}</small></div>`}
  if(k==='nightlights'&&data?.layers.night_lights){const m=Math.round(data.nightMax);return `<div class="lg grad"><b style="background:linear-gradient(90deg,${[0,.2,.4,.6,.8,1].map(t=>R.night(t)).join(',')})"></b><div><span>0</span><span>${Math.round(m/2)}</span><span>${m}</span></div><small>${L('إشعاع ليلي','night radiance')} · nW/cm²/sr</small></div>`}
  if(k==='busflow'&&data?.layers.bus_routes){const n=data.busMax;return `<div class="lg grad"><b style="background:linear-gradient(90deg,${[0,.33,.66,1].map(t=>R.bus(t)).join(',')})"></b><div><span>1</span><span>${Math.round((n+1)/2)}</span><span>${n}</span></div><small>${L('عدد الخطوط على نفس المقطع','lines sharing the same street segment')} · ${data.layers.bus_routes.features.length} ${L('مسارًا','routes')}</small></div>`}
  if(k==='busstops'&&data?.layers.bus_stops){const n=data.stopMax;return `<div class="lg">${[1,Math.round(n/2),n].map(v=>`<span><em class="circ" style="width:${Math.round(6*Math.sqrt(v))}px;height:${Math.round(6*Math.sqrt(v))}px;background:${R.bus((v-1)/Math.max(1,n-1))}"></em>${v} ${L('خط','lines')}</span>`).join('')}<span><em class="circ" style="background:none;border:1.5px solid #fff"></em>${L('محطة رئيسية','major hub')} (${data.layers.transport_hubs.features.length})</span><small>${data.layers.bus_stops.features.length} ${L('محطة · مساحة الدائرة ∝ عدد الخطوط','stops · circle area ∝ number of lines')}</small></div>`}
  if(k==='dots')return `<div class="lg"><span>${swatch('#f4f1ea')}${L('محل / سوق','shop / market')}</span><span>${swatch('#ffd166')}${L('مقهى / مطعم','café / restaurant')}</span><small>${data?data.commerce.length:''} ${L('نقطة','places')}</small></div>`;
  if(k==='landuse')return `<div class="lg">${[['residential','سكني','residential'],['commercial','تجاري','commercial'],['industrial','صناعي','industrial'],['park','حدائق','parks'],['farmland','زراعي','farmland']].map(([c,a,e])=>`<span>${swatch(LU[c])}${L(a,e)}</span>`).join('')}</div>`;
  if(k==='wind'&&wind){const w=wind[windSeason],i=w.freq.indexOf(Math.max(...w.freq)),dirs=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
   const seasons=[['winter','شتاء','Winter'],['spring','ربيع','Spring'],['summer','صيف','Summer'],['autumn','خريف','Autumn'],['annual','سنوي','Year']].filter(([s])=>wind[s]);
   return `<div class="lg"><div class="seg">${seasons.map(([s,a,e])=>`<button data-season="${s}" class="${windSeason===s?'on':''}">${L(a,e)}</button>`).join('')}</div>${rose(w)}<small>${L('السائدة من','Prevailing from')} ${dirs[i]} · ${Math.round(w.freq[i]*100)}% · ${w.speed[i]} m/s · ${L('سكون','calm')} ${Math.round(w.calm*100)}%<br>${L('رياح مرجعية لمحطة واحدة — ليست حقل رياح محلي','Single-station reference wind — not a local wind field')}</small></div>`}
  return '';
 }
 function rose(w){const m=Math.max(...w.freq),c=40;let p='';w.freq.forEach((f,i)=>{const a1=(i*22.5-11.25-90)*Math.PI/180,a2=(i*22.5+11.25-90)*Math.PI/180,r=f/m*36;p+=`<path d="M${c},${c}L${c+r*Math.cos(a1)},${c+r*Math.sin(a1)}A${r},${r} 0 0 1 ${c+r*Math.cos(a2)},${c+r*Math.sin(a2)}Z"/>`});return `<svg class="rose" viewBox="0 0 80 80"><circle cx="40" cy="40" r="36"/>${p}<text x="40" y="9">N</text></svg>`}

 /* ---------- windows (same look + behaviour as the atlas windows) ---------- */
 let wins=[],speed=1000,maskOut=true,switching=Promise.resolve();
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const stage=()=>document.querySelector('#windowStage')||document.body;
 // All 1.3 windows share one size and cascade with a fixed step so each title bar stays visible:
 // Arabic stacks from the right edge, English from the left.
 const WIN={w:340,h:430,dx:28,dy:36,edge:24,top:96};
 // Windows start below the logo lockup so it never covers the first title bar.
 function placeWin(el,i){const top=Math.max(WIN.top,Math.round(document.querySelector('header .brand')?.getBoundingClientRect().bottom||0)+12);
  const w=Math.min(WIN.w,innerWidth-24),wh=Math.min(WIN.h,innerHeight-top-24-i*WIN.dy);
  el.style.width=w+'px';el.style.height=Math.max(160,wh)+'px';
  const rtl=document.documentElement.dir==='rtl';
  el.style.left=Math.max(12,rtl?innerWidth-w-WIN.edge-i*WIN.dx:WIN.edge+i*WIN.dx)+'px';el.style.top=(top+i*WIN.dy)+'px'}
 function specsFor(T){const s=[['layers',L('الطبقات','LAYERS')+' · '+T.n+' '+L(T.t[0],T.t[1]).toUpperCase()],['legend',L('المفتاح والقراءة','KEY + READING')],['export',L('عرض وتصدير','VIEW + EXPORT')]];if(T.id==='climate')s.push(['wind',L('الريح · محطة أنفا','WIND · ANFA STATION')]);return s}
 function makeWin(id,title,width,height,i){const el=document.createElement('section');el.className='win ex13win';el.dataset.ex=id;
  placeWin(el,i);el.style.zIndex=++zTop;
  el.innerHTML=`<div class="winbar"><span class="wintitle"><small>1.3</small>${title}</span><div class="wincontrols"><button data-w="min" title="Minimize">−</button><button data-w="max" title="Maximize / restore">↗</button><button data-w="close" title="Close">×</button></div></div><div class="winbody"></div>`;
  stage().append(el);
  el.addEventListener('pointerdown',()=>el.style.zIndex=++zTop);
  el.querySelectorAll('[data-w]').forEach(b=>b.onclick=()=>{if(b.dataset.w==='close'){if(id==='layers')closeAll();else{el.remove();wins=wins.filter(w=>w!==el)}}else el.classList.toggle(b.dataset.w==='min'?'minimized':'full')});
  const h=el.querySelector('.winbar');let mv=null;
  h.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;el.classList.remove('full');mv={x:e.clientX,y:e.clientY,l:el.offsetLeft,t:el.offsetTop};h.setPointerCapture(e.pointerId)});
  h.addEventListener('pointermove',e=>{if(!mv)return;el.style.left=Math.max(0,Math.min(innerWidth-80,mv.l+e.clientX-mv.x))+'px';el.style.top=Math.max(0,Math.min(innerHeight-60,mv.t+e.clientY-mv.y))+'px'});
  h.addEventListener('pointerup',()=>mv=null);h.addEventListener('pointercancel',()=>mv=null);
  h.addEventListener('dblclick',e=>{if(!e.target.closest('button'))el.classList.toggle('full')});
  bind(el);wins.push(el);return el}
 async function closeWins(list,step=90){for(const el of [...list].reverse()){el.classList.add('leaving');await wait(step);el.remove()}}
 async function closeSiteWindows(){try{const list=[...windows.values()].map(w=>w.el);windows.clear();await closeWins(list,80)}catch{}}
 async function closeAll(){stopPlay();setWind(false);setBus(false);const list=wins;wins=[];await closeWins(list);for(const k in state)state[k].on=false;topic=null;fg(false);showBuildings=true;showRoads=true;roadGroups={major:true,local:true,walking:true};render()}

 function open(id){if(typeof setMenu==='function')setMenu(false);
  switching=switching.then(async()=>{
   const prev=wins;wins=[];stopPlay();setWind(false);setBus(false);
   await Promise.all([closeWins(prev),closeSiteWindows()]);
   try{if(window.Imagery){Imagery.state.swipe=false;Imagery.state.enabled=false;Imagery.sync?.()}}catch{}
   topic=TOPICS.find(t=>t.id===id);for(const k in state){state[k].on=false;state[k].op=1}
   order=[...topic.layers].reverse();if(order.includes('wind')){order=order.filter(k=>k!=='wind');order.push('wind')}
   topic.layers.forEach((k,i)=>state[k].on=k==='boundary'||i===0||(id==='climate'&&k==='wind'));
   if(id==='climate')state.heat.op=.85;if(id==='morphology'){state.landuse.on=false;state.rail.on=false}
   try{if(window.Atlas)Atlas.mode='footprints'}catch{}
   setBase(id);await load();
   const T=topic,specs=specsFor(T);
      for(let i=0;i<specs.length;i++){if(topic!==T)return;makeWin(specs[i][0],specs[i][1],0,0,i);await wait(140)}
   fill();setWind(state.wind.on);setBus(state.busflow.on);render()})}
 function setBase(id){fg(id==='morphology');showBuildings=id==='morphology'||id==='human';showRoads=id!=='morphology';roadGroups={major:true,local:id==='human',walking:false};render()}
 function fg(on){window.Ex13FG=on;document.body.classList.toggle('fgMode',on)}

 function bind(el){
  el.addEventListener('input',e=>{const k=e.target.dataset.op;if(k){state[k].op=+e.target.value;render()}});
  el.addEventListener('change',e=>{const k=e.target.dataset.on;if(k){state[k].on=e.target.checked;if(k==='wind')setWind(e.target.checked);if(k==='busflow')setBus(e.target.checked);fill();render()}
   if(e.target.id==='clipF'){clipFrame=e.target.checked;render()}if(e.target.id==='maskF'){maskOut=e.target.checked;render()}
   if(e.target.id==='streetsF'){showRoads=e.target.checked;render()}});
  el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.dataset.w)return;
   if(b.dataset.up||b.dataset.down){const k=b.dataset.up||b.dataset.down,i=order.indexOf(k),j=i+(b.dataset.up?1:-1);if(j>=0&&j<order.length){[order[i],order[j]]=[order[j],order[i]];fill();render()}}
   if(b.dataset.season){windSeason=b.dataset.season;particles=[];fill()}
   if(b.dataset.speed){speed=+b.dataset.speed;if(playTimer){stopPlay();play()}fill()}
   if(b.id==='play13')playTimer?stopPlay():play();
   if(b.dataset.export)exportSVG(b.dataset.export)})}
 const body=id=>wins.find(w=>w.dataset.ex===id)?.querySelector('.winbody');
 function fill(){if(!topic)return;const T=topic;
  const lay=body('layers');if(lay)lay.innerHTML=`<div class="ex13">${T.play?`<div class="playRow"><button id="play13" class="act">${playTimer?'■ '+L('إيقاف','Stop'):'▶ '+L('تشغيل متتابع','Play sequence')}</button><span class="seg"><button data-speed="1000" class="${speed===1000?'on':''}">1 ${L('ث','s')}</button><button data-speed="2000" class="${speed===2000?'on':''}">2 ${L('ث','s')}</button></span></div>`:''}${[...order].reverse().map(k=>{const d=LAYERS[k],s=state[k];return `<div class="row ${s.on?'on':''}"><label><input type="checkbox" data-on="${k}" ${s.on?'checked':''}> ${L(d.t[0],d.t[1])}</label><span class="ord"><button data-up="${k}" title="up">▲</button><button data-down="${k}" title="down">▼</button></span>${s.on&&k!=='wind'?`<input type="range" min="0" max="1" step=".05" value="${s.op}" data-op="${k}">`:''}</div>`}).join('')}</div>`;
  const lg=body('legend');if(lg)lg.innerHTML=`<div class="ex13"><p class="q">${L(T.q[0],T.q[1])}</p><p class="form">${L('شكل التمثيل','Representation')}: ${L(T.form[0],T.form[1])}</p>${[...order].reverse().filter(k=>state[k].on&&k!=='wind').map(k=>`<div class="row on"><b>${L(LAYERS[k].t[0],LAYERS[k].t[1])}</b>${legend(k)}<small class="src">${LAYERS[k].src}</small>${NOTES[k]?`<small class="note">${L(...NOTES[k])}</small>`:''}</div>`).join('')}</div>`;
  const ex=body('export');if(ex)ex.innerHTML=`<div class="ex13"><label class="clip"><input type="checkbox" id="maskF" ${maskOut?'checked':''}> ${L('تعتيم ما خارج حدود كازا','Dim outside Casablanca')}</label><label class="clip"><input type="checkbox" id="clipF" ${clipFrame?'checked':''}> ${L('قصّ على إطار 15×15 كم','Clip to 15×15 km frame')}</label>${T.id==='morphology'?`<label class="clip"><input type="checkbox" id="streetsF" ${showRoads?'checked':''}> ${L('إظهار الشوارع','Show streets')}</label>`:''}<div class="exp"><span>${L('تصدير SVG','Export SVG')}</span><button data-export="25">25 × 25 cm</button><button data-export="A3">A3</button></div></div>`;
  const wd=body('wind');if(wd)wd.innerHTML=`<div class="ex13">${legend('wind')}</div>`}
 function play(){const seq=topic.play;let i=0;const step=()=>{seq.forEach(k=>state[k].on=false);state[seq[i%seq.length]].on=true;state.boundary.on=true;i++;fill();render()};step();playTimer=setInterval(step,speed);fill()}
 function stopPlay(){clearInterval(playTimer);playTimer=null;fill()}
 const NOTES={dots:['البيانات من OSM: الأطراف والأحياء الشعبية أقل توثيقًا، والتجارة غير الرسمية غير مرسومة — قلّة النقاط هناك قد تعني نقص رسم لا نقص ناس.','OSM data: peripheries and popular districts are less mapped and informal trade is absent — few dots there can mean missing mapping, not missing people.'],
  centres:['كل دائرة = خلية 500 م. نعدّ فيها المحلات والمقاهي والبنوك والمؤسسات العامة من OSM، ونحوّلها لعدد في الكم². مساحة الدائرة تتناسب مع العدد.','Each circle = a 500 m cell. We count shops, cafés, banks and public institutions from OSM and convert to count per km². Circle area is proportional to the count.'],
  flood:['قابلية غمر تقديرية: أرض ارتفاعها أقل من 5 م فوق أقرب مجرى (HAND)، محسوبة في GIS على الـstreams. ليست فيضانًا مرصودًا. مقصوصة على إطار 15×15 كم.','Indicative flood-prone ground: land less than 5 m above the nearest drainage line (HAND), computed in GIS from the streams. Not an observed flood. Clipped to the 15 × 15 km frame.'],
  nightlights:['أسطع مكان هو الميناء (إضاءة كاشفة)، والمدينة القديمة أقل منه رغم أنها أكثر ازدحامًا بالناس: الضوء لا يساوي الناس. دقة البيانات ≈460 م؛ التنعيم للعرض فقط.','The brightest place is the port (floodlights); the old medina is dimmer though far more crowded: light is not people. Data resolution ≈460 m; smoothing is for display only.'],
  zones:['حدود المراكز من طبقات الزميلة، رُسمت يدويًا في GIS.','Centre boundaries from the colleague\'s layers, drawn by hand in GIS.'],
  heat:['صورة يوم واحد صيفي (17.07.2025). تُظهر حرارة سطح الأرض، وليس حرارة الهواء.','A single summer day (17.07.2025). Shows land surface temperature, not air temperature.'],
  busflow:['النقاط المتحركة تمثيل توضيحي لتداخل الخطوط، وليست باصات حقيقية (لا يوجد جدول رحلات). كل نقطة تترك ذيلًا أحمر شفافيته 10%، فكلما مرّ خط أكثر على نفس الشارع اشتدّ الأحمر.','Moving dots illustrate line overlap; they are not real buses (no timetable). Each leaves a 10%-opacity red tail, so streets shared by more lines turn brighter red.'],
  pop:['القيمة ÷ 100 من حقل gridcode (Int100) — للتأكيد.','Value = gridcode ÷ 100 (Int100) — to confirm.']};

 /* ---------- SVG export ---------- */
 function exportSVG(paper){if(!data)return;
  const mm=paper==='A3'?{w:297,h:420,map:265}:{w:250,h:250,map:190};
  const mx=(mm.w-mm.map)/2,my=paper==='A3'?30:14,S=mm.map/(FRAME[2]-FRAME[0]);// mm per metre
  const X=x=>(mx+(x-FRAME[0])*S).toFixed(2),Y=y=>(my+(FRAME[3]-y)*S).toFixed(2);
  const pd=rings=>rings.map(r=>r.map((v,i)=>(i?'L':'M')+X(v[0])+' '+Y(v[1])).join('')+'').join('');
  const inB=f=>!f.b||overlap(f.b,FRAME);let body='';
  if(showBuildings&&window.DNA){let p='';for(const b of DNA.buildings){if(b.b&&!overlap(b.b,FRAME))continue;p+=pd(b.r)+'Z'}body+=`<g id="buildings"><path fill="${window.Ex13FG?'#111':'#9a9a94'}" fill-rule="evenodd" d="${p}"/></g>`}
  for(const k of order.filter(k=>state[k].on)){const d=LAYERS[k],op=state[k].op;let g='';
   const feats=data.layers[k]?.features||[];
   if(d.type==='grid')feats.filter(inB).forEach(f=>{const c=R[d.ramp](classOf(f.v,d.breaks));g+=`<path fill="${c}" stroke="${c}" stroke-width=".06" d="${pd(f.r)}Z"/>`});
   if(d.type==='value')feats.filter(inB).forEach(f=>{const c=R[d.ramp]((f.v-d.min)/(d.max-d.min));g+=`<path fill="${c}" stroke="${c}" stroke-width=".06" d="${pd(f.r)}Z"/>`});
   if(k==='flood')g=`<path fill="#3d8bff" fill-opacity=".55" fill-rule="evenodd" d="${feats.filter(inB).map(f=>pd(f.r)+'Z').join('')}"/>`;
   if(k==='rail')g=`<path fill="none" stroke="#ff5a36" stroke-width=".5" d="${feats.filter(inB).map(f=>pd(f.r)).join('')}"/>`;
   if(k==='water')g=`<path fill="none" stroke="#5fb4ff" stroke-width=".2" d="${data.layers.streams.features.filter(inB).map(f=>pd(f.r)).join('')}"/><path fill="none" stroke="#8fd0ff" stroke-width=".5" d="${data.layers.bouskoura.features.map(f=>pd(f.r)).join('')}"/>`;
   if(k==='contours')data.layers.contours.features.filter(f=>f.v%10===0&&inB(f)).forEach(f=>g+=`<path fill="none" stroke="${f.v%50?'#8f8670':'#5b4f36'}" stroke-width="${f.v%50?.12:.3}" d="${pd(f.r)}"/>`);
   if(k==='landuse')feats.filter(inB).forEach(f=>g+=`<path fill="${LU[f.fclass]||LU._}" d="${pd(f.r)}Z"/>`);
   if(k==='boundary')g=`<path fill="none" stroke="#c07a20" stroke-width=".6" d="${feats.map(f=>pd(f.r)+'Z').join('')}"/>`;
   if(k==='centres')data.centreCells.filter(c=>c.n>=3&&inF(c.c)).forEach(c=>g+=`<circle cx="${X(c.c[0])}" cy="${Y(c.c[1])}" r="${(Math.sqrt(c.d/data.maxD)*480*S).toFixed(2)}" fill="#ffb347" fill-opacity=".3" stroke="#d27d12" stroke-width=".2"/>`);
   if(k==='civic')data.civic.forEach(p=>g+=`<rect x="${(X(p.c[0])-.6).toFixed(2)}" y="${(Y(p.c[1])-.6).toFixed(2)}" width="1.2" height="1.2" fill="#fff" stroke="#111" stroke-width=".15"/>`);
   if(k==='stops')data.stops.forEach(p=>g+=`<circle cx="${X(p.c[0])}" cy="${Y(p.c[1])}" r=".45" fill="#ff3b30"/>`);
   if(k==='zones')for(const [key,c,,e] of ZONES){const f=data.layers[key]?.features[0];if(f)g+=`<path fill="${c}" fill-opacity=".18" stroke="${c}" stroke-width=".35" fill-rule="evenodd" d="${pd(f.r)}Z"/><text x="${X((f.b[0]+f.b[2])/2)}" y="${(+Y(f.b[3])-1).toFixed(2)}" font-size="2.4" text-anchor="middle" fill="#333">${e}</text>`}
   if(k==='inst')(data.layers.institutions?.features||[]).filter(p=>inF(p.c)).forEach(p=>{const x=+X(p.c[0]),y=+Y(p.c[1]);g+=`<path d="M${x},${(y-.7).toFixed(2)}L${(x+.7).toFixed(2)},${y}L${x},${(y+.7).toFixed(2)}L${(x-.7).toFixed(2)},${y}Z" fill="#2a9fd0" stroke="#0b2530" stroke-width=".08"/>`});
   if(k==='nightlights'){const gl=nightGlow();if(gl)g=`<image href="${gl.canvas.toDataURL('image/png')}" x="${X(gl.box[0])}" y="${Y(gl.box[3])}" width="${((gl.box[2]-gl.box[0])*S).toFixed(2)}" height="${((gl.box[3]-gl.box[1])*S).toFixed(2)}" preserveAspectRatio="none"/>`}
   if(k==='busflow'&&data.layers.bus_routes){g=`<path fill="none" stroke="${R.bus(0)}" stroke-width=".15" stroke-linecap="round" d="${data.layers.bus_routes.features.filter(inB).map(f=>pd(f.r)).join('')}"/>`;
    [...data.layers.bus_overlap.features].filter(inB).sort((a,c)=>(a.n||1)-(c.n||1)).forEach(f=>{const t=((f.n||1)-1)/Math.max(1,data.busMax-1);g+=`<path fill="none" stroke="${R.bus(t)}" stroke-width="${(.2+t*.9).toFixed(2)}" stroke-linecap="round" d="${pd(f.r)}"/>`})}
   if(k==='busstops'&&data.layers.bus_stops){[...data.layers.bus_stops.features].filter(p=>inF(p.c)).sort((a,c)=>(a.n||1)-(c.n||1)).forEach(p=>g+=`<circle cx="${X(p.c[0])}" cy="${Y(p.c[1])}" r="${(.22*Math.sqrt(p.n||1)).toFixed(2)}" fill="${R.bus(((p.n||1)-1)/Math.max(1,data.stopMax-1))}" stroke="#120403" stroke-width=".04"/>`);
    data.layers.transport_hubs.features.filter(p=>inF(p.c)).forEach(p=>g+=`<circle cx="${X(p.c[0])}" cy="${Y(p.c[1])}" r="${(.22*Math.sqrt(p.n||1)+.35).toFixed(2)}" fill="none" stroke="#111" stroke-width=".18"/>`)}
   if(k==='dots')data.commerce.forEach(p=>g+=`<circle cx="${X(p.c[0])}" cy="${Y(p.c[1])}" r=".35" fill="${FOOD.has(p.fclass)?'#e0a400':'#333'}"/>`);
   if(k==='wind'&&wind){const w=wind[windSeason];w.freq.forEach((f,i)=>{if(f<.04)return;const to=(i*22.5+180)*Math.PI/180;for(let n=0;n<Math.round(f*220);n++){const x=lerp(FRAME[0],FRAME[2],Math.random()),y=lerp(FRAME[1],FRAME[3],Math.random()),l=w.speed[i]*120;g+=`<line x1="${X(x)}" y1="${Y(y)}" x2="${X(x+Math.sin(to)*l)}" y2="${Y(y+Math.cos(to)*l)}" stroke="#1f6fd1" stroke-width=".45" stroke-opacity=".9" stroke-linecap="round"/>`}})}
   if(g)body+=`<g id="${k}" opacity="${op}">${g}</g>`}
  // scale bar
  const scaleN=Math.round(1/(S/1000)),bar=[1000,2000,5000].find(m=>m*S>=25)||5000,bw=bar*S,by=my+mm.map+9;
  const T=topic,title=`${T.n} · ${T.t[1].toUpperCase()} · ${T.t[0]}`;
  let ly=by+12,legendTxt='';
  for(const k of [...order].reverse().filter(k=>state[k].on)){const d=LAYERS[k];legendTxt+=`<text x="${mx}" y="${ly}" font-size="2.7" font-weight="bold">${d.t[1]} · ${d.t[0]}</text><text x="${mx+mm.map}" y="${ly}" font-size="2.2" fill="#666" text-anchor="end">${d.src}</text>`;ly+=2.5;
   if(d.type==='grid'){d.breaks.forEach((v,i)=>{const x=mx+i*22;legendTxt+=`<rect x="${x}" y="${ly}" width="5" height="3" fill="${R[d.ramp](i/(d.breaks.length-1))}" stroke="#999" stroke-width=".1"/><text x="${x+6}" y="${ly+2.5}" font-size="2.3">${i===d.breaks.length-1?'≥'+v:v+'–'+d.breaks[i+1]}</text>`});legendTxt+=`<text x="${mx+d.breaks.length*22}" y="${ly+2.5}" font-size="2.3" fill="#666">${d.unit[1]}</text>`;ly+=6}
   else if(d.type==='value'){const n=8;for(let i=0;i<n;i++)legendTxt+=`<rect x="${mx+i*12}" y="${ly}" width="12" height="3" fill="${R[d.ramp]((i+.5)/n)}"/>`;for(let i=0;i<=n;i+=2){const v=d.min+(d.max-d.min)*i/n;legendTxt+=`<text x="${mx+i*12}" y="${ly+6}" font-size="2.3" text-anchor="middle">${k==='ndvi'?v.toFixed(2):Math.round(v)}</text>`}legendTxt+=`<text x="${mx+n*12+4}" y="${ly+2.5}" font-size="2.3" fill="#666">${d.unit[1]}</text>`;ly+=12}
   else if(k==='wind'&&wind){const w=wind[windSeason],i=w.freq.indexOf(Math.max(...w.freq));legendTxt+=`<line x1="${mx}" y1="${ly+1.5}" x2="${mx+8}" y2="${ly+1.5}" stroke="#1f6fd1" stroke-width=".45"/><text x="${mx+10}" y="${ly+2.5}" font-size="2.3">${windSeason} · prevailing from ${(i*22.5)}° (${Math.round(w.freq[i]*100)}% of hours, ${w.speed[i]} m/s) · line length ∝ speed · single-station reference</text>`;ly+=8}
   else if(k==='centres'){legendTxt+=`<circle cx="${mx+3}" cy="${ly+2}" r="2" fill="#ffb347" fill-opacity=".3" stroke="#d27d12" stroke-width=".2"/><text x="${mx+7}" y="${ly+2.8}" font-size="2.3">circle area ∝ shops + services per km² (500 m cells) · max ${data.maxD}/km²</text>`;ly+=6}
   else if(k==='busflow'){for(let i=0;i<4;i++)legendTxt+=`<rect x="${mx+i*12}" y="${ly}" width="12" height="3" fill="${R.bus(i/3)}"/>`;legendTxt+=`<text x="${mx}" y="${ly+6}" font-size="2.3">1</text><text x="${mx+48}" y="${ly+6}" font-size="2.3" text-anchor="end">${data.busMax}</text><text x="${mx+52}" y="${ly+2.5}" font-size="2.3" fill="#666">bus lines sharing the street segment · line width ∝ overlap</text>`;ly+=10}
   else if(k==='busstops'){[1,Math.round(data.stopMax/2),data.stopMax].forEach((v,i)=>{const x=mx+3+i*16;legendTxt+=`<circle cx="${x}" cy="${ly+2}" r="${(.22*Math.sqrt(v)*2).toFixed(2)}" fill="${R.bus((v-1)/Math.max(1,data.stopMax-1))}"/><text x="${x+4}" y="${ly+2.8}" font-size="2.3">${v} lines</text>`});legendTxt+=`<text x="${mx+52}" y="${ly+2.8}" font-size="2.3" fill="#666">ring = major hub · circle area ∝ lines</text>`;ly+=7}
   else if(k==='contours'){legendTxt+=`<text x="${mx}" y="${ly+2.5}" font-size="2.3">thin = 10 m · bold = 50 m · m a.s.l.</text>`;ly+=5}
   else ly+=2.5}
  legendTxt+=`<text x="${mx}" y="${ly+3}" font-size="2.6" fill="#98682c">✎ Sentence — what the map shows, and what surprised us:</text>`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${mm.w}mm" height="${mm.h}mm" viewBox="0 0 ${mm.w} ${mm.h}" font-family="Arial, sans-serif"><rect width="100%" height="100%" fill="#fff"/><text x="${mx}" y="${my-4}" font-size="4" font-weight="bold">${title}</text><text x="${mx+mm.map}" y="${my-4}" font-size="2.6" text-anchor="end">CASABLANCA · 15 × 15 km · 1:${scaleN.toLocaleString('en-US')}</text><clipPath id="fr"><rect x="${mx}" y="${my}" width="${mm.map}" height="${mm.map}"/></clipPath><g clip-path="url(#fr)">${body}</g><rect x="${mx}" y="${my}" width="${mm.map}" height="${mm.map}" fill="none" stroke="#111" stroke-width=".3"/><g transform="translate(${mx+mm.map-8},${my+6})"><path d="M0,-4 L2.4,3 L0,1.6 L-2.4,3Z" fill="#111"/><text y="7.5" font-size="3" text-anchor="middle">N</text></g><g transform="translate(${mx},${by})"><rect width="${bw/2}" height="1.2" fill="#111"/><rect x="${bw/2}" width="${bw/2}" height="1.2" fill="none" stroke="#111" stroke-width=".2"/><text y="4.5" font-size="2.4">0</text><text x="${bw}" y="4.5" font-size="2.4" text-anchor="middle">${bar/1000} km</text></g>${legendTxt}<text x="${mx}" y="${mm.h-6}" font-size="2.2" fill="#555">Frame 15 × 15 km · WGS84 / UTM 29N (EPSG:32629) · Base: © OpenStreetMap contributors · Exported ${new Date().toISOString().slice(0,10)}</text></svg>`;
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));a.download=`casa_1.3_${T.n}_${T.id}_${paper}.svg`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}

 /* ---------- menu wiring ---------- */
 document.addEventListener('click',e=>{const b=e.target.closest('[data-ex13]');if(!b)return;e.preventDefault();e.stopPropagation();open(b.dataset.ex13)},true);
 // Language switch: retitle open windows and move them to the new side at once, keeping layer state.
 new MutationObserver(()=>{if(topic){const sp=specsFor(topic);wins.forEach((el,i)=>{const s=sp.find(x=>x[0]===el.dataset.ex);if(s)el.querySelector('.wintitle').innerHTML=`<small>1.3</small>${s[1]}`;placeWin(el,i)})}fill();document.querySelectorAll('[data-ex13]').forEach(b=>{const t=TOPICS.find(x=>x.id===b.dataset.ex13);b.querySelector('span').textContent=L(t.t[0],t.t[1])})}).observe(document.documentElement,{attributes:true,attributeFilter:['lang','dir']});
 document.querySelectorAll('[data-ex13]').forEach(b=>{const t=TOPICS.find(x=>x.id===b.dataset.ex13);b.querySelector('span').textContent=L(t.t[0],t.t[1])});
 return{paint,open,close:closeAll,get active(){return !!topic},get state(){return state},get data(){return data}};
})();
