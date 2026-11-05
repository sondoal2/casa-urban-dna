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
  rwi:ramp(['#3b2a5c','#6a4f8f','#a58bbf','#e5dccf','#f2c26b','#e08a1e']),
  bustime:ramp(['#f4f1ea','#f6c3b3','#f07a5c','#e2321c','#a3110a']),
  height:ramp(['#1e2433','#34466e','#5f78a8','#9fb2d6','#e6e2d6','#ffffff']),
  night:ramp(['#000000','#2b1600','#8a4a00','#e09a2a','#ffe3a0','#fffdf2'])};
 // Sun at 33.6° N, solar time (declination ±23.44°). Azimuth from north, clockwise.
 const SUN={dec12:{alt:33.0,az:180,t:['21 ديسمبر · 12:00','21 Dec · 12:00']},dec15:{alt:18.7,az:223.2,t:['21 ديسمبر · 15:00','21 Dec · 15:00']},jun12:{alt:79.8,az:180,t:['21 يونيو · 12:00','21 Jun · 12:00']},jun15:{alt:49.5,az:267.6,t:['21 يونيو · 15:00','21 Jun · 15:00']}};
 let sun='dec15';
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
  histplan:{t:['الخريطة التاريخية الأصلية (مثبّتة)','Original historical plan (georeferenced)'],type:'histplan',src:'1918: Service topographique du Maroc 1:25,000 (BnF) · 1942: War Office 1:10,000 (Wikimedia Commons, public domain) · 1938, 1955: Schéma directeur 1975 schematics in Kasmi (1994), ±300 m',frame:false},
  histext:{t:['امتداد المدينة حسب الحقبة','City extent by period'],type:'histext',src:'Traced from the 1918 and 1942 plans · studio GIS packages (T1900, T1935, T1986)',frame:false},
  histbuild:{t:['مبانٍ مؤرَّخة وطرازها','Dated buildings and their style'],type:'histbuild',src:'Wikidata (CC0) · photos Wikimedia Commons',frame:false},
  height:{t:['ارتفاع المباني · متوسط لكل 100 م','Building height · 100 m average'],type:'value',unit:['متر','m'],min:0,max:25,ramp:'height',src:'GHSL GHS-BUILT-H ANBH 2018, 100 m',frame:true},
  shadow:{t:['الظل التقريبي','Approximate shadow'],type:'shadow',src:'Heights: GlobalBuildingAtlas LoD1 per building (Zhu et al. 2025, CC BY-NC 4.0), else GHS-BUILT-H 100 m · sun position at 33.6° N',frame:true},
  patterns:{t:['أنماط شبكة الشوارع','Street-network patterns'],type:'morph',src:'OSM streets + GHS-BUILT · explicit rules per 400 m cell',frame:true},
  zones:{t:['المراكز الأربعة: تاريخي، حديث، معاصر، ميناء','Four centres: historic, modern, contemporary, port'],type:'zones',src:'Studio GIS layers: historic, modern, contemporary, port centres',frame:true},
  inst:{t:['المؤسسات','Institutions'],type:'inst',src:'Studio GIS layer: Institutions_Only (OSM)',frame:true},
  nightlights:{t:['الإضاءة الليلية · VIIRS 2025','Night lights · VIIRS 2025'],type:'glow',unit:['nW/cm²/sr','nW/cm²/sr'],src:'NOAA/EOG VIIRS VNL v2 2025, ≈460 m cells',frame:true},
  busflow:{t:['خطوط الباص · التداخل والنبض','Bus lines · overlap + pulse'],type:'busflow',src:'Studio GIS layers: Bus_Routes_Colored, Bus_Street_Overlap (Casabus, OSM)',frame:true},
  emigration:{t:['الهجرة للخارج · اتجاهها وحجمها','Emigration · direction and size'],type:'emigration',unit:['مولودون في المغرب ويعيشون خارجه، 2024','born in Morocco, living abroad, 2024'],src:'UN DESA, International Migrant Stock 2024, Table 1 (national: no city of origin in the data)',frame:false},
  districts:{t:['المقاطعات الـ16','The 16 arrondissements'],type:'districts',src:'OpenStreetMap admin_level 10 (relation 4072985), Overpass 2026-11-05',frame:false},
  rwi:{t:['مؤشر الثروة النسبي · Meta','Relative Wealth Index · Meta'],type:'rwi',unit:['نسبي داخل المغرب، ليس دخلًا','relative within Morocco, not income'],src:'Meta Data for Good, Relative Wealth Index (Chi et al. 2022), HDX, CC BY 4.0 · ≈2.4 km tiles',frame:true},
  overture:{t:['الأماكن · Overture (Meta، Microsoft…)','Places · Overture (Meta, Microsoft…)'],type:'overture',src:'Overture Maps Foundation, places release 2026-10-21.0 (CDLA-Permissive-2.0), confidence ≥ 0.4',frame:true},
  placegap:{t:['التجارة غير المرسومة في OSM','Commerce OSM does not show'],type:'placegap',unit:['خلية 500 م: محلات ومقاهٍ في Overture مقابل OSM','500 m cell: Overture shops + cafés vs OSM'],src:'Overture places vs OpenStreetMap POIs (prep/overture_layer.py)',frame:true},
  bustime:{t:['الباصات في الساعة · من المواعيد','Buses per hour · from the timetable'],type:'bustime',unit:['باص / ساعة، الاتجاهان','buses / hour, both directions'],src:'Casabus GTFS, weekday timetable (export 2026-06-04, github.com/Mouados-byte/CasaTransport-GTFS)',frame:true},
  busstops:{t:['المحطات حسب عدد الخطوط','Stops by number of lines'],type:'busstops',src:'Studio GIS layers: Bus_Stops_With_Lines, Major_Transport_Hubs',frame:true},
  heat:{t:['حرارة سطح الأرض LST','Land surface temperature'],type:'value',unit:['°C','°C'],min:30,max:57,ramp:'heat',src:'Landsat 9 C2 L2 · 17.07.2025 (single day)',frame:true},
  ndvi:{t:['الغطاء النباتي NDVI','Vegetation NDVI'],type:'value',unit:['NDVI','NDVI'],min:-0.2,max:0.5,ramp:'ndvi',src:'Sentinel/Landsat NDVI (user export)',frame:true},
  flood:{t:['أرض قابلة للغمر','Flood-prone ground'],type:'fill',color:'#3d8bff',alpha:.55,src:'GIS: HAND < 5 m above drainage lines · SRTM 1″ (2000)',frame:true},
  water:{t:['المجاري ووادي بوسكورة','Streams + Oued Bouskoura'],type:'water',src:'Hydrology (user) + OSM',frame:true},
  contours:{t:['خطوط الكنتور · 10 م','Contours · 10 m'],type:'contours',unit:['م فوق سطح البحر','m a.s.l.'],src:'DEM contours (user)',frame:false},
  wind:{t:['الريح السائدة · محطة أنفا','Prevailing wind · Anfa station'],type:'wind',src:'EPW TMYx Casablanca-Anfa 601550',frame:true},
  dots:{t:['أين الناس: تجارة ومقاهٍ (نقطة = محل)','Where people are: shops + cafés (1 dot = 1 place)'],type:'dots',src:'OpenStreetMap POIs',frame:true},
  boundary:{t:['حدود الدار البيضاء','Casablanca boundary'],type:'outline',src:'OSM admin boundary',frame:false}
 };
 const TOPICS=[
  {id:'density',n:'01',t:['الكثافة','Density'],q:['أين المدينة كثيفة — بالناس أم بالبناء؟','Where is the city dense — in people or in buildings?'],layers:['pop','built','height','shadow','rwi','districts','boundary'],form:['شبكة خلايا 100 م','100 m grid']},
  {id:'morphology',n:'02',t:['المورفولوجيا','Morphology'],q:['مِمّ صُنعت المدينة، وأين يتبدّل منطقها؟','What is the city made of, and where does its logic change?'],layers:['patterns','landuse','rail','boundary'],form:['مليء وفارغ + حدود','Figure-ground + edges'],base:true},
  {id:'centre',n:'03',t:['مركز المدينة','City centre'],q:['أين القلب — وهل هو واحد؟','Where is the heart — and is there only one?'],layers:['zones','centres','inst','civic','busstops','bustime','busflow','districts','boundary'],form:['دوائر متناسبة','Proportional circles']},
  {id:'climate',n:'04',t:['المناخ','Climate'],q:['أين الحرّ وأين أقل — وبكم درجة؟','Where is it hot, where less — and by how much?'],layers:['heat','ndvi','flood','water','contours','wind','boundary'],form:['حقل متصل + خطوط تساوٍ','Continuous field + isolines'],play:['heat','ndvi','flood','contours']},
  {id:'human',n:'05',t:['البعد الإنساني','Human dimension'],q:['أين الناس فعلًا — أين يشترون ويلتقون؟','Where are people actually — buying, meeting?'],layers:['dots','overture','placegap','nightlights','bustime','busflow','busstops','rwi','districts','emigration','boundary'],form:['كثافة نقاط','Dot density']},
  {id:'history',n:'06',t:['التطور التاريخي','Historical development'],q:['كيف نمت المدينة، ومن خطّطها، وبأي لغة معمارية؟','How did the city grow, who planned it, and in which architectural language?'],layers:['histext','histbuild','histplan','boundary'],form:['مخطط زمني بمسارات متوازية + امتدادات','Chart of time in parallel streams + extents']}
 ];
 const state={};Object.keys(LAYERS).forEach(k=>state[k]={on:false,op:1});
 let order=[];
 // Timetable buses: hourly counts per street piece, decoded from base-62 strings (one per hour from h0).
 let busT=null,busHour=8,busPlay=null;const busCache={};
 // Per-building heights from GlobalBuildingAtlas (prep/gba_heights.py); the 100 m GHSL cell is the fallback.
 let gbaH=null;
 // Overture places (prep/overture_layer.py): flat [x,y,class,…] and 500 m cells [x,y,overture,osm].
 // Arrondissements (outlines + names) and Meta's wealth tiles [x0,y0,x1,y1,rwi,error] (prep/districts_rwi.py).
 let distD=null;
 // Emigration compass (prep/emigration_un.py): one arrow per destination from the frame centre, true bearing
 // from Casablanca, length and width ∝ √(people). Direction and size only: the map is not to world scale.
 let emig=null;const EMIG_C=[-2226,15519],CASA_LL=[-7.6,33.57];
 let ovP=null;const OV_COL=['#e0a400','#ff7a59','#7ad7ff','#8ce0a0','#9a9a94'];
 const heightOf=bd=>gbaH?.osm[bd.id]??data.hIndex?.get(Math.floor((bd.b[0]+bd.b[2])/200)+','+Math.floor((bd.b[1]+bd.b[3])/200));
 const BUS_CLASSES=[1,6,12,24,48,96],B62='0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
 function busPaths(h){if(!busT)return null;if(busCache[h])return busCache[h];const row=busT.hours[h-busT.h0];if(!row)return null;
  const P=BUS_CLASSES.map(()=>null);for(let i=0;i<busT.segs.length;i++){const n=busN(row,i);if(n<1)continue;let c=0;while(c<BUS_CLASSES.length-1&&n>=BUS_CLASSES[c+1])c++;const p=P[c]||(P[c]=new Path2D()),q=busT.segs[i];p.moveTo(q[0],-q[1]);p.lineTo(q[2],-q[3])}
  return busCache[h]=P}
 // Hour change touches only the slider label and the legend line, so dragging the slider keeps working.
 function setBusHour(h){busHour=h;document.querySelectorAll('[data-bushour]').forEach(i=>{if(+i.value!==h)i.value=h});document.querySelectorAll('[data-bushour-label]').forEach(s=>s.textContent=h+':00');
  document.querySelectorAll('[data-bushour-span]').forEach(s=>s.textContent=`${h}:00–${h+1}:00`);render()}
 const busN=(row,i)=>B62.indexOf(row[2*i])*62+B62.indexOf(row[2*i+1]);
 function busTotal(h){const row=busT?.hours[h-busT.h0];if(!row)return 0;let t=0;for(let i=0;i<busT.segs.length;i++)t+=busN(row,i);return t}

 /* ---------- data ---------- */
 function load(){if(data)return Promise.resolve();if(loading)return loading;
  loading=Promise.all([fetch('data/ex13.json').then(r=>r.json()),fetch('data/wind.json?v=2').then(r=>r.json()),fetch('data/layers13b.json?v=2').then(r=>r.ok?r.json():{layers:{}}).catch(()=>({layers:{}})),fetch('data/heights.json?v=1').then(r=>r.ok?r.json():null).catch(()=>null),fetch('data/history_buildings.json?v=1').then(r=>r.ok?r.json():null).catch(()=>null),
   fetch('data/hist_extents.json?v=2').then(r=>r.ok?r.json():null).catch(()=>null),
   fetch('data/bus_gtfs.json?v=1').then(r=>r.ok?r.json():null).then(g=>{busT=g}).catch(()=>null),
   fetch('data/heights_gba.json?v=1').then(r=>r.ok?r.json():null).then(g=>{gbaH=g}).catch(()=>null),
   fetch('data/places_overture.json?v=1').then(r=>r.ok?r.json():null).then(g=>{ovP=g}).catch(()=>null),
   fetch('data/districts.json?v=1').then(r=>r.ok?r.json():null).then(g=>{distD=g}).catch(()=>null),
   fetch('data/emigration_un.json?v=1').then(r=>r.ok?r.json():null).then(g=>{emig=g}).catch(()=>null),
   // Plans shown under the timeline: the latest one not after the cursor year. 1938 and 1955 are the
   // Schéma directeur 1975 schematics reproduced by Kasmi (1994), georeferenced in prep/georef_kasmi*.json.
   ...[[1918,'hist_1918'],[1938,'hist_kasmi1938'],[1942,'hist_1942'],[1955,'hist_kasmi1955']].map(([y,f])=>fetch(`data/${f}.json?v=1`).then(r=>r.ok?r.json():null).then(meta=>meta&&{year:y,meta}).catch(()=>null))]).then(([d,w,b,h,hb,he,...plans])=>{data=d;wind=w;Object.assign(data.layers,b.layers);data.history=hb;data.histExtents=he;data.histPlans=plans.filter(Boolean);
   if(h)data.hIndex=new Map(h.cells.map(([x,y,v])=>[Math.floor(x/h.res)+','+Math.floor(y/h.res),v]));
   if(h)data.layers.height={kind:'poly',features:h.cells.map(([x,y,v])=>({v,r:[[[x,y],[x+h.res,y],[x+h.res,y+h.res],[x,y+h.res],[x,y]]]}))};prepare()});return loading}
 const pathOf=rings=>{const p=new Path2D();for(const r of rings)r.forEach((v,i)=>i?p.lineTo(v[0],-v[1]):p.moveTo(v[0],-v[1]));return p};
 const bbox=rings=>{let a=[1e9,1e9,-1e9,-1e9];for(const r of rings)for(const v of r){if(v[0]<a[0])a[0]=v[0];if(v[1]<a[1])a[1]=v[1];if(v[0]>a[2])a[2]=v[0];if(v[1]>a[3])a[3]=v[1]}return a};
 const inF=c=>c[0]>=FRAME[0]&&c[0]<=FRAME[2]&&c[1]>=FRAME[1]&&c[1]<=FRAME[3];
 function prepare(){
  for(const k in data.layers)for(const f of data.layers[k].features||[])if(f.r)f.b=bbox(f.r);
  data.busMax=Math.max(1,...(data.layers.bus_overlap?.features||[]).map(f=>f.n||1));
  data.stopMax=Math.max(1,...(data.layers.bus_stops?.features||[]).map(f=>f.n||1));
  if(window.Morph13)Morph13.compute(data.layers.built.features);
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
 /* ---------- 3D: isometric extrusion of the top visible cell layer (height = value) ---------- */
 let iso=false;const ISO_H=1600; // metres of column height at the layer's maximum, for legibility
 function isoProject(x,y,h,s){const dx=x-view.x,dy=y-view.y,u=(dx-dy)*.7071,w=(dx+dy)*.7071;return[W/2+u*s,H/2-w*s*.5-h*s]}
 function shade(rgb,f){const m=rgb.match(/\d+/g);return`rgb(${m.slice(0,3).map(v=>Math.round(v*f)).join(',')})`}
 function paintIso(ctx,vis,s){const k=vis.find(k=>LAYERS[k].type==='grid'||LAYERS[k].type==='value');
  ctx.save();const d=Math.min(devicePixelRatio||1,1.5);ctx.setTransform(d,0,0,d,0,0);
  if(state.boundary.on){ctx.strokeStyle='#e0a050';ctx.lineWidth=1.4;for(const f of data.layers.boundary.features)for(const r of f.r){ctx.beginPath();r.forEach((p,i)=>{const q=isoProject(p[0],p[1],0,s);i?ctx.lineTo(...q):ctx.moveTo(...q)});ctx.stroke()}}
  if(k){const def=LAYERS[k],fn=R[def.ramp],val=f=>def.type==='grid'?classOf(f.v,def.breaks):Math.max(0,Math.min(1,(f.v-def.min)/(def.max-def.min)));
   const list=data.layers[k].features.filter(f=>f.b&&inF([(f.b[0]+f.b[2])/2,(f.b[1]+f.b[3])/2])).map(f=>({f,t:val(f),w:((f.b[0]+f.b[2])/2-view.x)+((f.b[1]+f.b[3])/2-view.y)})).sort((a,b)=>b.w-a.w);
   ctx.globalAlpha=state[k].op;ctx.lineJoin='round';
   for(const {f,t} of list){const b=f.b,h=k==='height'?f.v*15:t*ISO_H*(k==='pop'?1:.6),c=fn(t),P=[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]],lo=P.map(p=>isoProject(p[0],p[1],0,s)),hi=P.map(p=>isoProject(p[0],p[1],h,s));
    if(h>1){for(const [i,j,f2] of [[0,1,.62],[1,2,.8]]){ctx.fillStyle=shade(c,f2);ctx.beginPath();ctx.moveTo(...lo[i]);ctx.lineTo(...lo[j]);ctx.lineTo(...hi[j]);ctx.lineTo(...hi[i]);ctx.closePath();ctx.fill()}}
    ctx.fillStyle=c;ctx.beginPath();hi.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fill()}}
  ctx.restore()}
 /* ---------- section: profiles of the cell layers and elevation along a drawn line ---------- */
 const section={pts:[],drawing:false,rows:null};
 const SEC_VARS=[['pop',['السكان','Population'],'/ha'],['built',['المبني','Built-up'],'%'],['height',['ارتفاع المباني','Building height'],'m'],['heat',['الحرارة','Heat'],'°C'],['ndvi',['NDVI','NDVI'],''],['elev',['الارتفاع','Elevation'],'m']];
 let samplers=null;
 function makeSamplers(){if(samplers)return samplers;samplers={};const B=200;
  const pip=(rings,x,y)=>{let c=false;for(const r of rings)for(let i=0,j=r.length-1;i<r.length;j=i++){if((r[i][1]>y)!==(r[j][1]>y)&&x<(r[j][0]-r[i][0])*(y-r[i][1])/(r[j][1]-r[i][1])+r[i][0])c=!c}return c};
  for(const k of ['pop','built','height','heat','ndvi']){const idx=new Map();for(const f of data.layers[k]?.features||[]){if(!f.b)continue;for(let i=Math.floor(f.b[0]/B);i<=Math.floor(f.b[2]/B);i++)for(let j=Math.floor(f.b[1]/B);j<=Math.floor(f.b[3]/B);j++){const q=i+','+j;(idx.get(q)||idx.set(q,[]).get(q)).push(f)}}
   samplers[k]=(x,y)=>{for(const f of idx.get(Math.floor(x/B)+','+Math.floor(y/B))||[])if(x>=f.b[0]&&x<=f.b[2]&&y>=f.b[1]&&y<=f.b[3]&&pip(f.r,x,y))return f.v;return null}}
  // Elevation ≈ value of the nearest 10 m contour vertex within 400 m.
  const E=new Map(),EB=400;for(const f of data.layers.contours.features)for(const r of f.r)for(const s of r){const [x,y]=typeof s==='string'?s.split(' ').map(Number):s;const q=Math.floor(x/EB)+','+Math.floor(y/EB);(E.get(q)||E.set(q,[]).get(q)).push([x,y,f.v])}
  samplers.elev=(x,y)=>{let best=null,bd=EB*EB;const i0=Math.floor(x/EB),j0=Math.floor(y/EB);for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(const p of E.get((i0+a)+','+(j0+b))||[]){const d=(p[0]-x)**2+(p[1]-y)**2;if(d<bd){bd=d;best=p[2]}}return best};
  return samplers}
 function computeSection(){const S=makeSamplers(),[A,B]=section.pts,len=Math.hypot(B[0]-A[0],B[1]-A[1]),n=Math.max(20,Math.min(300,Math.round(len/50)));
  section.len=len;section.rows=SEC_VARS.map(([k])=>{const v=[];for(let i=0;i<=n;i++){const t=i/n;v.push(S[k](A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t))}return v})}
 function sectionSVG(){const w=300,rh=52,pad=34;let g='';
  SEC_VARS.forEach(([k,name,u],r)=>{const v=section.rows[r],ok=v.filter(x=>x!=null);const y0=r*rh+16;g+=`<text x="${pad}" y="${y0-4}" class="sl">${L(...name)}</text>`;if(!ok.length){g+=`<text x="${pad}" y="${y0+20}" class="sv">${L('لا بيانات على الخط','no data on this line')}</text>`;return}
   const mn=Math.min(...ok),mx=Math.max(...ok),sc=x=>y0+rh-12-(mx===mn?.5:(x-mn)/(mx-mn))*(rh-20);let d='',pen=false;v.forEach((x,i)=>{if(x==null){pen=false;return}const X=pad+(w-pad-4)*i/(v.length-1);d+=(pen?'L':'M')+X.toFixed(1)+' '+sc(x).toFixed(1);pen=true});
   g+=`<path d="${d}" fill="none" stroke="${['#f3cf87','#dcdcd4','#9fb2d6','#f7a13b','#4f9e48','#8fd0ff'][r]}" stroke-width="1.4"/><text x="${pad-3}" y="${y0+8}" class="sv" text-anchor="end">${fmt(mx,k==='ndvi'?2:0)}</text><text x="${pad-3}" y="${y0+rh-12}" class="sv" text-anchor="end">${fmt(mn,k==='ndvi'?2:0)}</text><text x="${w-2}" y="${y0-4}" class="sv" text-anchor="end">${u}</text>`});
  const H2=SEC_VARS.length*rh+20;g+=`<text x="${pad}" y="${H2-4}" class="sv">A</text><text x="${w-4}" y="${H2-4}" class="sv" text-anchor="end">B · ${fmt(section.len/1000,1)} km</text>`;
  return `<svg class="sectionChart" viewBox="0 0 ${w} ${H2}" width="100%" direction="ltr" style="direction:ltr"><style>.sl{font:600 9px sans-serif;fill:#eee}.sv{font:8px sans-serif;fill:#aaa}</style>${g}</svg><p class="tiny">${L('عيّنة كل ≈50 م. الارتفاع تقريبي من خطوط كنتور كل 10 م.','Sampled every ≈50 m. Elevation is approximate, from 10 m contours.')}</p>`}
 canvas.addEventListener('pointerdown',e=>{if(!section.drawing)return;e.stopImmediatePropagation();e.preventDefault();section.pts.push(world(e.clientX,e.clientY));
  if(section.pts.length===2){section.drawing=false;canvas.style.cursor='grab';computeSection();let el=wins.find(w=>w.dataset.ex==='section');if(!el)el=makeWin('section',L('مقطع A–B','SECTION A–B'),0,0,wins.length);el.querySelector('.winbody').innerHTML=sectionSVG()}
  fill();render()},{capture:true});
 function setIso(on){iso=on;if(topic){showBuildings=on?false:topic.id==='morphology'||topic.id==='human';showRoads=on?false:topic.id!=='morphology'}render()}

 function paint(ctx,bounds){
  if(!data)return;const s=view.s,vis=order.filter(k=>state[k].on);if(!vis.length)return;
  if(iso){paintIso(ctx,[...vis].reverse(),s);return}
  for(const k of vis){if(k==='boundary')continue;const def=LAYERS[k];
   if(def.type==='grid'||def.type==='value'||def.type==='shadow'){drawOpaque(ctx,k,def,bounds,s);continue}
   ctx.save();ctx.globalAlpha=state[k].op;
   if(def.frame&&clipFrame){ctx.beginPath();ctx.rect(FRAME[0],-FRAME[3],FRAME[2]-FRAME[0],FRAME[3]-FRAME[1]);ctx.clip()}
   draw[def.type](ctx,k,def,bounds,s);ctx.restore()}
  if(maskOut&&state.boundary.on!==undefined&&topic){ctx.save();const big=new Path2D();big.rect(-60000,-60000,120000,120000);for(const f of data.layers.boundary.features)big.addPath(f.p||(f.p=pathOf(f.r)));ctx.fillStyle=light?'rgba(244,244,240,.8)':'rgba(8,8,8,.78)';ctx.fill(big,'evenodd');ctx.restore()}
  if(state.boundary.on){ctx.save();draw.outline(ctx,'boundary',LAYERS.boundary,bounds,s);ctx.restore()}
  if(section.pts.length){ctx.save();ctx.strokeStyle='#ff4d40';ctx.fillStyle='#ff4d40';ctx.lineWidth=2/s;ctx.setLineDash([8/s,5/s]);const [A,B]=section.pts;ctx.beginPath();ctx.moveTo(A[0],-A[1]);if(B)ctx.lineTo(B[0],-B[1]);ctx.stroke();ctx.setLineDash([]);
   for(const [p,t] of [[A,'A'],[B,'B']]){if(!p)continue;ctx.beginPath();ctx.arc(p[0],-p[1],5/s,0,7);ctx.fill();ctx.save();ctx.setTransform(1,0,0,1,0,0);const d=Math.min(devicePixelRatio||1,1.5),q=screen(p[0],p[1]);ctx.setTransform(d,0,0,d,0,0);ctx.font='600 13px sans-serif';ctx.fillText(t,q[0]+8,q[1]-8);ctx.restore()}ctx.restore()}
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
  // Each OSM footprint takes its own GlobalBuildingAtlas height (else its 100 m cell average) and is swept
  // along the shadow direction by h / tan(sun altitude); footprints are drawn on top. Street scale only.
  shadow(ctx,k,def,b,s){if(!data.hIndex||s<.12)return;const S=SUN[sun],L=1/Math.tan(S.alt*Math.PI/180),a=(S.az+180)*Math.PI/180,ux=Math.sin(a),uy=Math.cos(a),p=new Path2D(),fp=new Path2D();
   for(const bd of buildings){if(!overlap(bd.b,b))continue;const h=heightOf(bd);if(!h)continue;const dx=ux*h*L,dy=uy*h*L,q=bd.r[0];
    for(let i=0;i<q.length-1;i++){const A=q[i],B=q[i+1];p.moveTo(A[0],-A[1]);p.lineTo(B[0],-B[1]);p.lineTo(B[0]+dx,-(B[1]+dy));p.lineTo(A[0]+dx,-(A[1]+dy));p.closePath()}
    q.forEach((v,i)=>i?fp.lineTo(v[0],-v[1]):fp.moveTo(v[0],-v[1]));fp.closePath()}
   ctx.fillStyle=light?'#2a2f55':'#6f7cff';ctx.fill(p,'nonzero');ctx.fillStyle=light?'#9a9a94':'#d8d6cf';ctx.fill(fp,'nonzero')},
  histplan(ctx,k,def,b,s){window.Timeline13?.paintPlan(ctx,state[k].op)},
  histext(ctx,k,def,b,s){window.Timeline13?.paintExtents(ctx,s)},
  histbuild(ctx,k,def,b,s){if(!window.Timeline13)return;Timeline13.paintBuildings(ctx,s);Timeline13.paintHover(ctx,s)},
  morph(ctx,k,def,b,s){if(!window.Morph13?.cells)return;const P=Morph13.streetPaths();ctx.lineCap='round';
   for(const [id,,,c] of Morph13.RULES){ctx.strokeStyle=c;ctx.lineWidth=(id==='mixed'?.7:1.8)/s;ctx.globalAlpha=state[k].op*(id==='mixed'?.5:1);ctx.stroke(P[id])}
   if(s>.35){ctx.globalAlpha=state[k].op;const r=Math.max(2.5,2.2/s);for(const j of Morph13.junctions){if(j.c[0]<b[0]||j.c[0]>b[2]||j.c[1]<b[1]||j.c[1]>b[3])continue;ctx.beginPath();ctx.arc(j.c[0],-j.c[1],r,0,7);if(j.t===1){ctx.strokeStyle='#fff';ctx.lineWidth=1/s;ctx.stroke()}else{ctx.fillStyle=j.t===3?'#ffb347':'#5fb4ff';ctx.fill()}}}},
  zones(ctx,k,def,b,s){for(const [key,c] of ZONES){const f=data.layers[key]?.features[0];if(!f)continue;const p=f.p||(f.p=pathOf(f.r));ctx.fillStyle=c+'2e';ctx.fill(p,'evenodd');ctx.strokeStyle=c;ctx.lineWidth=2/s;ctx.stroke(p)}
   ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.font='600 12px "Readex Pro","Noto Kufi Arabic",sans-serif';ctx.textAlign='center';
   for(const [key,c,a,e] of ZONES){const f=data.layers[key]?.features[0];if(!f)continue;const [x,y]=screen((f.b[0]+f.b[2])/2,f.b[3]),d=Math.min(devicePixelRatio||1,1.5),t=L(a,e);ctx.setTransform(d,0,0,d,0,0);ctx.fillStyle='#0e0e0ecc';const w=ctx.measureText(t).width+12;ctx.fillRect(x-w/2,y-22,w,18);ctx.fillStyle=c;ctx.fillText(t,x,y-9)}ctx.restore()},
  inst(ctx,k,def,b,s){const r=Math.max(30,4/s);ctx.fillStyle='#7ad7ff';ctx.strokeStyle='#0b2530';ctx.lineWidth=1/s;for(const p of data.layers.institutions?.features||[]){ctx.beginPath();ctx.moveTo(p.c[0],-p.c[1]-r);ctx.lineTo(p.c[0]+r,-p.c[1]);ctx.lineTo(p.c[0],-p.c[1]+r);ctx.lineTo(p.c[0]-r,-p.c[1]);ctx.closePath();ctx.fill();ctx.stroke()}},
  glow(ctx,k,def,b,s){const g=nightGlow();if(!g)return;ctx.imageSmoothingEnabled=true;ctx.drawImage(g.canvas,g.box[0],-g.box[3],g.box[2]-g.box[0],g.box[3]-g.box[1])},
  busflow(ctx,k,def,b,s){const L_=data.layers;if(!L_.bus_routes)return;ctx.lineCap=ctx.lineJoin='round';
   ctx.strokeStyle=R.bus(0);ctx.lineWidth=.9/s;for(const f of L_.bus_routes.features)if(vis(f,b))ctx.stroke(f.p||(f.p=pathOf(f.r)));
   const ov=[...L_.bus_overlap.features].sort((a,c)=>(a.n||1)-(c.n||1));
   for(const f of ov){if(!vis(f,b))continue;const t=((f.n||1)-1)/Math.max(1,data.busMax-1);ctx.strokeStyle=R.bus(t);ctx.lineWidth=(1+t*3.5)/s;ctx.stroke(f.p||(f.p=pathOf(f.r)))}},
  emigration(ctx,k,def,b,s){if(!emig)return;const top=emig.top.filter(c=>c.pos),max=Math.max(...top.map(c=>c.v.at(-1))),[cx,cy]=EMIG_C,lbl=[];
   ctx.lineCap='round';for(const c of top){const n=c.v.at(-1),f=Math.sqrt(n/max),dx=(c.pos[0]-CASA_LL[0])*Math.cos(CASA_LL[1]*Math.PI/180),dy=c.pos[1]-CASA_LL[1],d=Math.hypot(dx,dy),ux=dx/d,uy=dy/d,Lm=1800+6200*f,x=cx+ux*Lm,y=cy+uy*Lm;
    ctx.strokeStyle='rgba(255,77,36,.85)';ctx.lineWidth=(1.5+f*9)/s;ctx.beginPath();ctx.moveTo(cx+ux*400,-(cy+uy*400));ctx.lineTo(x,-y);ctx.stroke();lbl.push([x+ux*500,y+uy*500,c,n])}
   ctx.fillStyle='#ff4d24';ctx.beginPath();ctx.arc(cx,-cy,6/s,0,7);ctx.fill();
   ctx.save();ctx.setTransform(1,0,0,1,0,0);const dpr=Math.min(devicePixelRatio||1,1.5);ctx.font='600 11px "Readex Pro","Noto Kufi Arabic",sans-serif';ctx.textAlign='center';ctx.direction='ltr';
   for(const [x,y,c,n] of lbl){const [X,Y]=screen(x,y);ctx.setTransform(dpr,0,0,dpr,0,0);const t=`${c.country.replace('United States of America','USA').replace('United Arab Emirates','UAE')} ${n>=1e6?(n/1e6).toFixed(2)+'M':Math.round(n/1e3)+'k'}`;ctx.fillStyle='#0e0e0ecc';const w=ctx.measureText(t).width+10;ctx.fillRect(X-w/2,Y-9,w,16);ctx.fillStyle='#ffb347';ctx.fillText(t,X,Y+3)}ctx.restore()},
  districts(ctx,k,def,b,s){if(!distD)return;ctx.strokeStyle='#eeeeea';ctx.lineWidth=1.2/s;ctx.setLineDash([6/s,4/s]);for(const d of distD.districts)ctx.stroke(d.p||(d.p=pathOf(d.r)));ctx.setLineDash([]);
   ctx.save();ctx.setTransform(1,0,0,1,0,0);const dpr=Math.min(devicePixelRatio||1,1.5);ctx.font='600 11px "Readex Pro","Noto Kufi Arabic",sans-serif';ctx.textAlign='center';
   for(const d of distD.districts){const bb=d.b||(d.b=bbox(d.r)),[x,y]=screen((bb[0]+bb[2])/2,(bb[1]+bb[3])/2),t=L(d.ar||d.fr,d.fr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#0e0e0ebb';const w=ctx.measureText(t).width+10;ctx.fillRect(x-w/2,y-9,w,16);ctx.fillStyle='#eeeeea';ctx.fillText(t,x,y+3)}ctx.restore()},
  rwi(ctx,k,def,b,s){if(!distD)return;for(const [x0,y0,x1,y1,v] of distD.rwi){if(x1<b[0]||x0>b[2]||y1<b[1]||y0>b[3])continue;ctx.fillStyle=R.rwi((v+.1)/1.7);ctx.fillRect(x0,-y1,x1-x0,y1-y0)}},
  overture(ctx,k,def,b,s){if(!ovP)return;const p=ovP.pts,r=Math.max(6,1.1/s);for(let c=4;c>=0;c--){ctx.fillStyle=OV_COL[c];ctx.beginPath();
    for(let i=0;i<p.length;i+=3){if(p[i+2]!==c)continue;const x=p[i],y=p[i+1];if(x<b[0]||x>b[2]||y<b[1]||y>b[3])continue;ctx.moveTo(x+r,-y);ctx.arc(x,-y,r,0,7)}ctx.fill()}},
  // Cells where OSM shows no shop or café but Overture shows several: commerce the volunteer map misses.
  placegap(ctx,k,def,b,s){if(!ovP)return;const h=ovP.cell/2;for(const [x,y,a,o] of ovP.grid){if(x+h<b[0]||x-h>b[2]||y+h<b[1]||y-h>b[3])continue;const t=Math.min(1,Math.log2((a+1)/(o+1))/4);if(t<=0)continue;
    ctx.fillStyle=o===0&&a>=5?'rgba(255,77,36,.55)':`rgba(255,179,71,${(.12+t*.4).toFixed(2)})`;ctx.fillRect(x-h,-(y+h),2*h,2*h)}},
  // Real departures per hour on each 25 m of street (prep/gtfs_buses.py), white → red; one Path2D per class and hour.
  bustime(ctx,k,def,b,s){const P=busPaths(busHour);if(!P)return;ctx.lineCap='round';
   P.forEach((p,i)=>{if(!p)return;const t=i/(BUS_CLASSES.length-1);ctx.strokeStyle=R.bustime(.08+t*.92);ctx.lineWidth=(1+t*3.2)/s;ctx.stroke(p)})},
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

 /* ---------- buses: illustrative pulse along the studio's bus routes (no timetable) ----------
    Each bus leaves a 10%-opacity red tail drawn with additive blending, so streets shared by
    several lines build up towards bright red. */
 let busOn=false,busRaf=0,bcan=null,bctx=null,buses=null;
 const BUS_TAIL=650,BUS_SPACING=2600;
 function prepBuses(){buses=[];for(const f of data.layers.bus_routes?.features||[])for(const pts of f.r){if(pts.length<2)continue;const cum=[0];for(let i=1;i<pts.length;i++)cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));const len=cum.at(-1);if(len<500)continue;const route={pts,cum,len};for(let n=Math.max(1,Math.round(len/BUS_SPACING)),i=0;i<n;i++)buses.push({route,d:(i+Math.random()*.6)*len/n,v:10+Math.random()*5})}}
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
  if(d.type==='value'){const n=8,ticks=[...Array(n+1)].map((_,i)=>d.min+(d.max-d.min)*i/n);return `<div class="lg grad"><b style="background:linear-gradient(90deg,${ticks.map((v,i)=>R[d.ramp](i/n)).join(',')})"></b><div>${ticks.filter((_,i)=>i%2===0).map(v=>`<span>${k==='ndvi'?v.toFixed(2):Math.round(v)}</span>`).join('')}</div><small>${u}${k==='heat'?L(' · القيم الأصلية 21–57؛ التدرّج يبدأ من 30 لإظهار الفروق',' · source values 21–57; the ramp starts at 30 to show the differences'):''}</small></div>`}
  if(d.type==='rwi'){const n=6;return `<div class="lg grad"><b style="background:linear-gradient(90deg,${[...Array(n+1)].map((_,i)=>R.rwi(i/n)).join(',')})"></b><div><span>${L('أفقر نسبيًا','relatively poorer')}</span><span>${L('أغنى نسبيًا','relatively richer')}</span></div><small>${u} · ${L('دقته ≈2.4 كم: صورة عامة بين الأحياء، لا بلوكًا ببلوك','≈2.4 km: a broad picture between districts, not block by block')}</small></div>`}
  if(d.type==='emigration'&&emig){const t=emig.total,y=emig.years;return `<div class="lg"><span>${L(`المجموع: ${(t[0]/1e6).toFixed(2)} مليون (${y[0]}) ← ${(t.at(-1)/1e6).toFixed(2)} مليون (${y.at(-1)})`,`Total: ${(t[0]/1e6).toFixed(2)}M (${y[0]}) → ${(t.at(-1)/1e6).toFixed(2)}M (${y.at(-1)})`)}</span>${emig.top.slice(0,8).map(c=>`<span dir="ltr">${c.country}: ${Math.round(c.v[0]/1e3)}k → ${Math.round(c.v.at(-1)/1e3)}k</span>`).join('')}<small>${u} · ${L('الاتجاه صحيح، والمسافة ليست بمقياس','true direction, distance not to scale')}</small></div>`}
  if(d.type==='districts')return `<div class="lg"><span>${swatch('#eeeeea')}${L('حدود المقاطعة واسمها','arrondissement limit and name')}</span></div>`;
  if(d.type==='overture')return `<div class="lg">${(ovP?.classes||[]).map((c,i)=>`<span>${swatch(OV_COL[i])}${L(c[0],c[1])} (${ovP.counts[i].toLocaleString('en-US')})</span>`).join('')}<small>${L(`محلات ومقاهٍ: ${(ovP?(ovP.counts[0]+ovP.counts[1]):0).toLocaleString('en-US')} في Overture مقابل ${(ovP?.osmCommerce||0).toLocaleString('en-US')} في OSM`,`Shops + cafés: ${(ovP?(ovP.counts[0]+ovP.counts[1]):0).toLocaleString('en-US')} in Overture vs ${(ovP?.osmCommerce||0).toLocaleString('en-US')} in OSM`)}</small></div>`;
  if(d.type==='placegap')return `<div class="lg"><span>${swatch('rgba(255,77,36,.7)')}${L('OSM: صفر · Overture: 5 أو أكثر','OSM: none · Overture: 5 or more')}</span><span>${swatch('rgba(255,179,71,.5)')}${L('Overture أكثر بكثير','Overture far more')}</span><small>${u}</small></div>`;
  if(d.type==='bustime')return `<div class="lg">${BUS_CLASSES.map((v,i)=>`<span>${swatch(R.bustime(.08+i/(BUS_CLASSES.length-1)*.92))}${i===BUS_CLASSES.length-1?'≥ '+v:v+'–'+(BUS_CLASSES[i+1]-1)}</span>`).join('')}<small>${u} · <span data-bushour-span>${busHour}:00–${busHour+1}:00</span> ·${L('مجموع الرحلات على كل قطعة 25 م','departures summed per 25 m piece')}</small></div>`;
  if(k==='flood')return `<div class="lg">${swatch('#3d8bff')}<span>${L('أرض قابلة للغمر · أقل من 5 م فوق أقرب مجرى','Flood-prone ground · under 5 m above nearest stream')}</span></div>`;
  if(k==='water')return `<div class="lg"><span>${swatch('#5fb4ff')}${L('مجاري مائية','streams')}</span><span>${swatch('#8fd0ff')}Oued Bouskoura</span></div>`;
  if(k==='contours')return `<div class="lg"><span>${swatch('#d8c9a6')}${L('كل 50 م','every 50 m')}</span><span>${swatch('#8f8670')}10 م</span><small>0–${data?Math.round(data.contourMax):''} ${u}</small></div>`;
  if(k==='centres')return `<div class="lg"><span><em class="circ"></em>${L('مساحة الدائرة = عدد المحلات والخدمات في كم²','circle area = shops + services per km²')}</span><small>${L('أعلى خلية','max cell')}: ${data?data.maxD:''} / km² · ${L('خلايا 500 م','500 m cells')}</small></div>`;
  if(k==='civic')return `<div class="lg"><span>${swatch('#fff')}${data?data.civic.length:''} ${L('مؤسسة: بلدية، محكمة، جامعة، مستشفى، مدرسة، بنك…','institutions: town hall, court, university, hospital, school, bank…')}</span></div>`;
  if(k==='stops')return `<div class="lg"><span>${swatch('#ff3b30')}${data?data.stops.length:''} ${L('محطة (OSM)','stops (OSM)')}</span></div>`;
  if(k==='histext'&&window.Timeline13)return `<div class="lg">${Timeline13.extents().map(e=>`<span>${swatch(e.c)}${e.name}${e.traced?'':' · '+e.y} · ${fmt(e.km2,1)} km²${e.ghsl?L(' · بيانات أقمار صناعية',' · satellite data'):e.traced?L(' · مرسوم من الخريطة',' · traced from the plan'):L(' · طبقة GIS',' · GIS layer')}</span>`).join('')}<small>${L('GHSL 1975–2020: خلايا 100 م مبنية بنسبة ≥ 15% داخل حدود كازا الحالية (JRC). خريطة 1942 تغطي المركز فقط، فقفزة 1942→1975 جزء منها حدود الخريطة. خط متصل: مرسوم هنا من خريطتي 1918 و1942 (كثافة الحبر، ثم دمج البلوكات). خط متقطع: طبقات GIS،','GHSL 1975–2020: 100 m cells ≥ 15% built inside today\'s boundary (JRC). The 1942 plan covers the centre only, so part of the 1942→1975 jump is the plan\'s edge. Solid: traced here from the 1918 and 1942 plans (ink density, then blocks merged). Dashed: GIS layers,')} والسنة من اسم الطبقة داخل الحزمة وتحتاج تأكيدًا. 1918 تُظهر النواة الكثيفة فقط: بلوكات المدينة الجديدة المرسومة بخط رفيع لا تُلتقط.','Solid: traced here from the 1918 and 1942 plans (ink density, then blocks merged). Dashed: GIS layers, year from the layer name inside each package, to be confirmed. 1918 shows the dense core only: new-city blocks drawn in thin outline are not picked up.')}</small></div>`;
  if(k==='histplan'&&data?.histPlans)return `<div class="lg">${data.histPlans.map(p=>`<span><b>${p.year}</b> · ${fmt(p.meta.scale_m_px,2)} ${L('م/بكسل في المسح الأصلي','m per scan pixel')} · ${L('دوران','rotation')} ${fmt(p.meta.rotation_deg,1)}°</span>`).join('')}<small>${L('تُعرض أحدث خريطة لا تتجاوز سنة المؤشر. ثُبّتت بنقاط معروفة (منارة العنق، ملعب فيليب، ساحة فرنسا، الصخور السوداء)، وتحقّقنا من 4 مبانٍ إضافية: الخطأ أقل من ≈20 م في 1942.','Shows the latest plan not after the cursor year. Fixed with known points (El Hank lighthouse, Stade Philip, Place de France, Roches Noires), checked against 4 further buildings: error under ≈20 m for 1942.')}</small></div>`;
  if(k==='histbuild'&&window.Timeline13)return `<div class="lg">${[['artdeco','آرت ديكو','Art Deco'],['neomoorish','نيو-موريسكي / موريسكي','Neo-Moorish / Moorish'],['modern','حداثة / بروتالية','Modernism / Brutalism']].map(([f,a,e])=>`<span>${swatch(Timeline13.FAM[f])}${L(a,e)}</span>`).join('')}<span>${swatch('#f4f1ea')}${L('مؤرَّخ، طراز غير مسجّل','dated, style not recorded')}</span><span>${swatch('#8d8a82')}${L('غير مؤرَّخ','undated')}</span><small>${data?.history?.items.length||0} ${L('مكانًا من Wikidata؛ المسجّل هناك فقط، وليس جردًا كاملًا للتراث.','places from Wikidata; only what is recorded there, not a full heritage inventory.')}</small></div>`;
  if(k==='shadow'){const S=SUN[sun];return `<div class="lg"><div class="seg">${Object.entries(SUN).map(([id,x])=>`<button data-sun="${id}" class="${sun===id?'on':''}">${L(...x.t)}</button>`).join('')}</div><span>${swatch(light?'#2a2f55':'#6f7cff')}${L('ظل','shadow')} · ${L('ارتفاع الشمس','sun altitude')} ${S.alt}° · ${L('مبنى 10 م يرمي ظلًا','a 10 m building casts')} ${fmt(10/Math.tan(S.alt*Math.PI/180),0)} ${L('م','m')}</span><small>${L('كل مبنى (OSM) يأخذ متوسط ارتفاع خليته (100 م) من GHS-BUILT-H، فالظل تقريبي: المبنى الأعلى من متوسط حيّه يرمي ظلًا أطول في الواقع. قرّب على الحي لرؤيته. التوقيت شمسي.','Each OSM building takes its 100 m cell\'s average height from GHS-BUILT-H, so shadows are approximate: a building taller than its block average casts longer in reality. Zoom in to a neighbourhood to see it. Solar time.')}</small></div>`}
  if(k==='patterns'&&window.Morph13?.cells){const n={};for(const c of Morph13.cells)n[c.type]=(n[c.type]||0)+1;return `<div class="lg morphLg">${Morph13.RULES.map(([id,,name,c,rule])=>`<span>${swatch(c)}<b>${L(...name)}</b> · ${n[id]||0} ${L('خلية','cells')}<small>${L(...rule)}</small></span>`).join('')}<small>${L('عند التكبير: ○ طريق مسدود · ● برتقالي تقاطع T · ● أزرق تقاطع +','Zoomed in: ○ dead end · orange ● T-junction · blue ● four-way')}</small></div>`}
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
 async function closeAll(){stopPlay();setWind(false);setBus(false);iso=false;section.pts=[];section.drawing=false;window.Timeline13?.close();const list=wins;wins=[];await closeWins(list);for(const k in state)state[k].on=false;topic=null;fg(false);showBuildings=true;showRoads=true;roadGroups={major:true,local:true,walking:true};render()}

 function open(id){if(typeof setMenu==='function')setMenu(false);
  switching=switching.then(async()=>{
   const prev=wins;wins=[];stopPlay();setWind(false);setBus(false);iso=false;section.pts=[];section.drawing=false;window.Timeline13?.close();
   await Promise.all([closeWins(prev),closeSiteWindows()]);
   try{if(window.Imagery){Imagery.state.swipe=false;Imagery.state.enabled=false;Imagery.sync?.()}}catch{}
   topic=TOPICS.find(t=>t.id===id);for(const k in state){state[k].on=false;state[k].op=1}
   order=[...topic.layers].reverse();if(order.includes('wind')){order=order.filter(k=>k!=='wind');order.push('wind')}
   topic.layers.forEach((k,i)=>state[k].on=k==='boundary'||i===0||(id==='climate'&&k==='wind'));
   if(id==='climate')state.heat.op=.85;if(id==='history'){state.histplan.on=true;state.histplan.op=.75;state.histbuild.on=true}if(id==='morphology'){state.landuse.on=false;state.rail.on=false}
   try{if(window.Atlas)Atlas.mode='footprints'}catch{}
   setBase(id);await load();
   const T=topic,specs=specsFor(T);
      for(let i=0;i<specs.length;i++){if(topic!==T)return;makeWin(specs[i][0],specs[i][1],0,0,i);await wait(140)}
   fill();setWind(state.wind.on);setBus(state.busflow.on);
   if(id==='history'&&window.Timeline13){Timeline13.attach(data,render);Timeline13.open()}render()})}
 function setBase(id){fg(id==='morphology');showBuildings=id==='morphology'||id==='human';showRoads=id!=='morphology';roadGroups={major:true,local:id==='human',walking:false};render()}
 function fg(on){window.Ex13FG=on;document.body.classList.toggle('fgMode',on)}

 function bind(el){
  el.addEventListener('input',e=>{const k=e.target.dataset.op;if(k){state[k].op=+e.target.value;render()}
   if(e.target.dataset.bushour!==undefined)setBusHour(+e.target.value);
   if(e.target.id==='concl13'&&topic){try{localStorage.setItem('casa13-concl-'+topic.id,e.target.value)}catch{}}});
  el.addEventListener('change',e=>{const k=e.target.dataset.on;if(k){state[k].on=e.target.checked;if(k==='wind')setWind(e.target.checked);if(k==='busflow')setBus(e.target.checked);fill();render()}
   if(e.target.id==='clipF'){clipFrame=e.target.checked;render()}if(e.target.id==='maskF'){maskOut=e.target.checked;render()}
   if(e.target.id==='streetsF'){showRoads=e.target.checked;render()}
   if(e.target.id==='iso13')setIso(e.target.checked)});
  el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.dataset.w)return;
   if(b.dataset.up||b.dataset.down){const k=b.dataset.up||b.dataset.down,i=order.indexOf(k),j=i+(b.dataset.up?1:-1);if(j>=0&&j<order.length){[order[i],order[j]]=[order[j],order[i]];fill();render()}}
   if(b.dataset.season){windSeason=b.dataset.season;particles=[];fill()}
   if(b.dataset.sun){sun=b.dataset.sun;fill();render()}
   if(b.dataset.speed){speed=+b.dataset.speed;if(playTimer){stopPlay();play()}fill()}
   if(b.id==='play13')playTimer?stopPlay():play();
   if(b.dataset.busplay!==undefined){if(busPlay){clearInterval(busPlay);busPlay=null}else busPlay=setInterval(()=>setBusHour(busHour>=22?5:busHour+1),900);b.textContent=busPlay?'■':'▶'}
   if(b.dataset.export)exportSVG(b.dataset.export);if(b.dataset.pdf)exportSVG(b.dataset.pdf,'pdf');
   if(b.dataset.section!==undefined){if(iso){iso=false;setIso(false)}section.drawing=true;section.pts=[];canvas.style.cursor='crosshair';toast(L('اضغط نقطتين على الخريطة: A ثم B.','Click two points on the map: A, then B.'));fill();render()}
   if(b.dataset.conclReset&&topic){try{localStorage.removeItem('casa13-concl-'+topic.id)}catch{}fill()}})}
 const body=id=>wins.find(w=>w.dataset.ex===id)?.querySelector('.winbody');
 function fill(){if(!topic)return;const T=topic;
  const lay=body('layers');if(lay)lay.innerHTML=`<div class="ex13">${T.play?`<div class="playRow"><button id="play13" class="act">${playTimer?'■ '+L('إيقاف','Stop'):'▶ '+L('تشغيل متتابع','Play sequence')}</button><span class="seg"><button data-speed="1000" class="${speed===1000?'on':''}">1 ${L('ث','s')}</button><button data-speed="2000" class="${speed===2000?'on':''}">2 ${L('ث','s')}</button></span></div>`:''}${[...order].reverse().map(k=>{const d=LAYERS[k],s=state[k];return `<div class="row ${s.on?'on':''}"><label><input type="checkbox" data-on="${k}" ${s.on?'checked':''}> ${L(d.t[0],d.t[1])}</label><span class="ord"><button data-up="${k}" title="up">▲</button><button data-down="${k}" title="down">▼</button></span>${s.on&&k!=='wind'?`<input type="range" min="0" max="1" step=".05" value="${s.op}" data-op="${k}">`:''}${k==='bustime'&&s.on?`<div class="playRow"><button class="act" data-busplay>${busPlay?'■':'▶'}</button><input type="range" min="5" max="22" step="1" value="${busHour}" data-bushour aria-label="${L('الساعة','Hour')}"><span data-bushour-label>${busHour}:00</span></div>`:''}</div>`}).join('')}</div>`;
  const lg=body('legend');if(lg)lg.innerHTML=`<div class="ex13"><p class="q">${L(T.q[0],T.q[1])}</p><p class="form">${L('شكل التمثيل','Representation')}: ${L(T.form[0],T.form[1])}</p>${[...order].reverse().filter(k=>state[k].on&&k!=='wind').map(k=>`<div class="row on"><b>${L(LAYERS[k].t[0],LAYERS[k].t[1])}</b>${legend(k)}<small class="src">${LAYERS[k].src}</small>${NOTES[k]?`<small class="note">${L(...NOTES[k])}</small>`:''}</div>`).join('')}</div>`;
  const ex=body('export');if(ex)ex.innerHTML=`<div class="ex13"><label class="clip"><input type="checkbox" id="maskF" ${maskOut?'checked':''}> ${L('تعتيم ما خارج حدود كازا','Dim outside Casablanca')}</label><label class="clip"><input type="checkbox" id="clipF" ${clipFrame?'checked':''}> ${L('قصّ على إطار 15×15 كم','Clip to 15×15 km frame')}</label>${T.id==='morphology'?`<label class="clip"><input type="checkbox" id="streetsF" ${showRoads?'checked':''}> ${L('إظهار الشوارع','Show streets')}</label>`:''}${T.layers.some(k=>LAYERS[k].type==='grid'||LAYERS[k].type==='value')?`<label class="clip"><input type="checkbox" id="iso13" ${iso?'checked':''}> ${L('3D أيزومتريك · ارتفاع العمود = قيمة أعلى طبقة خلايا ظاهرة','3D isometric · column height = value of the top visible cell layer')}</label>`:''}<button class="action" data-section>${section.drawing?L('اضغط نقطتين على الخريطة…','Click two points on the map…'):L('رسم مقطع ✕','Draw a section ✕')}</button><div class="exp"><span>SVG</span><button data-export="25">25 × 25 cm</button><button data-export="A3">A3</button></div><div class="exp"><span>PDF</span><button data-pdf="25">25 × 25 cm</button><button data-pdf="A3">A3</button></div><label class="fieldLabel">${L('الاستنتاج · يُطبع تحت الخريطة، عدّله كما تريد','Conclusion · printed under the map, edit freely')}<textarea id="concl13" rows="7">${esc(conclusion(T))}</textarea></label><button class="textAction" data-concl-reset>${L('استرجاع المسودة','Restore draft')} ↺</button><p class="tiny">${L('PDF: اختر «حفظ كـ PDF» في نافذة الطباعة. كل عنصر في SVG مجموعة مستقلة تُفتح كطبقة في Illustrator.','PDF: choose “Save as PDF” in the print dialog. Each SVG element is its own group and opens as a layer in Illustrator.')}</p></div>`;
  const wd=body('wind');if(wd)wd.innerHTML=`<div class="ex13">${legend('wind')}</div>`}
 function play(){const seq=topic.play;let i=0;const step=()=>{seq.forEach(k=>state[k].on=false);state[seq[i%seq.length]].on=true;state.boundary.on=true;i++;fill();render()};step();playTimer=setInterval(step,speed);fill()}
 function stopPlay(){clearInterval(playTimer);playTimer=null;fill()}
 const NOTES={dots:['البيانات من OSM: الأطراف والأحياء الشعبية أقل توثيقًا، والتجارة غير الرسمية غير مرسومة — قلّة النقاط هناك قد تعني نقص رسم لا نقص ناس.','OSM data: peripheries and popular districts are less mapped and informal trade is absent — few dots there can mean missing mapping, not missing people.'],
  centres:['كل دائرة = خلية 500 م. نعدّ فيها المحلات والمقاهي والبنوك والمؤسسات العامة من OSM، ونحوّلها لعدد في الكم². مساحة الدائرة تتناسب مع العدد.','Each circle = a 500 m cell. We count shops, cafés, banks and public institutions from OSM and convert to count per km². Circle area is proportional to the count.'],
  flood:['قابلية غمر تقديرية: أرض ارتفاعها أقل من 5 م فوق أقرب مجرى (HAND)، محسوبة في GIS على الـstreams. ليست فيضانًا مرصودًا. مقصوصة على إطار 15×15 كم.','Indicative flood-prone ground: land less than 5 m above the nearest drainage line (HAND), computed in GIS from the streams. Not an observed flood. Clipped to the 15 × 15 km frame.'],
  nightlights:['أسطع مكان هو الميناء (إضاءة كاشفة)، والمدينة القديمة أقل منه رغم أنها أكثر ازدحامًا بالناس: الضوء لا يساوي الناس. دقة البيانات ≈460 م؛ التنعيم للعرض فقط.','The brightest place is the port (floodlights); the old medina is dimmer though far more crowded: light is not people. Data resolution ≈460 m; smoothing is for display only.'],
  patterns:['لكل خلية 400 م نقيس من شبكة شوارع OSM: نوع التقاطعات (مسدود، T، +)، كثافتها، انتظام اتجاهات الشوارع ونسبة الزوايا القائمة، ومن GHS-BUILT نسبة البناء. القواعد مكتوبة أعلاه وتُطبّق بالترتيب؛ لا يوجد تجميع آلي. الأنماط مأخوذة من قراءة المدينة (קריאת העיר) وتمرين 1.2.','For each 400 m cell we measure from the OSM street graph: junction types (dead end, T, four-way), their density, bearing order and right-angle share, and built cover from GHS-BUILT. The rules above are applied in order; there is no clustering. Pattern names follow the course readings and exercise 1.2.'],
  zones:['حدود المراكز رُسمت يدويًا في GIS.','Centre boundaries drawn by hand in GIS.'],
  heat:['صورة يوم واحد صيفي (17.07.2025). تُظهر حرارة سطح الأرض، وليس حرارة الهواء.','A single summer day (17.07.2025). Shows land surface temperature, not air temperature.'],
  busflow:['النقاط المتحركة تمثيل توضيحي لتداخل الخطوط، وليست باصات حقيقية (لا يوجد جدول رحلات). كل نقطة تترك ذيلًا أحمر شفافيته 10%، فكلما مرّ خط أكثر على نفس الشارع اشتدّ الأحمر.','Moving dots illustrate line overlap; they are not real buses (no timetable). Each leaves a 10%-opacity red tail, so streets shared by more lines turn brighter red.'],
  pop:['القيمة ÷ 100 من حقل gridcode (Int100) — للتأكيد.','Value = gridcode ÷ 100 (Int100) — to confirm.']};

 /* ---------- conclusions: a draft per chapter from the data, edited by the student, kept in this browser ---------- */
 const DRAFTS={
  density:['مسودة: أكثف الخلايا تتجاوز 2,000 نسمة في الهكتار، أي أكثر من عشرين ضعف الوسيط (≈94). حيث لا تتطابق كثافة الناس مع كثافة البناء، يأتي الازدحام من تكدّس الناس لا من كتلة المباني.','Draft: the densest 100 m cells exceed 2,000 people per hectare, over twenty times the median (≈94). Where population and built-up share do not peak together, crowding comes from people per room, not from building mass.'],
  morphology:['مسودة: السكك والأراضي الصناعية تقطع النسيج إلى قطع منفصلة؛ كل قطعة لها منطقها الخاص في البلوك والشارع.','Draft: rail lines and industrial land cut the fabric into separate pieces, each with its own block and street logic.'],
  centre:['مسودة: للمدينة أربعة مراكز لا مركز واحد. خطوط الباص تتداخل أكثر شيء (حتى 11 خطًا على شارع واحد) في البولفارات المركزية، بينما تبقى الأطراف معتمدة على خط أو خطين.','Draft: the city has four centres, not one. Bus lines overlap most (up to 11 on one street) on the central boulevards, while the edges rely on one or two lines.'],
  climate:['الحزام الأوسط، على بعد 1.5–4 كم من البحر، هو حيث تتجمع المياه (34% قابلة للغمر) وحيث ما زال الأخضر يبرّد (−1.3°C). تدخّل أخضر واحد هنا يمكن أن يجيب عن الفصلين.','The middle belt, 1.5–4 km from the sea, is where water gathers (34% flood-prone) and green still cools (−1.3°C). One green intervention here could answer both seasons.'],
  history:['مسودة: نمت المدينة من نواة مسوّرة إلى حلقات متتالية رسمتها مخططات من خارجها: بروست للأوروبيين، وإيكوشار لأول مرة للمغاربة. كل حقبة تركت لغة معمارية تُقرأ حتى اليوم في نسيج الشارع.','Draft: the city grew from a walled core into successive rings drawn by plans from outside: Prost for Europeans, then Écochard, for the first time, for Moroccans. Each era left an architectural language still legible in the street fabric.'],
  human:['مسودة: الضوء لا يساوي الناس. الميناء أسطع مكان في الليل، والمدينة القديمة، رغم ازدحامها، أقل إضاءة. المحلات والمقاهي تقل نحو الأطراف، جزئيًا لأن OSM ناقص هناك.','Draft: light is not people. The port is the brightest place at night, while the old medina, far more crowded, is dimmer. Shops and cafés thin out towards the edges, partly because OSM is incomplete there.']};
 function conclusion(T){let v=null;try{v=localStorage.getItem('casa13-concl-'+T.id)}catch{}return v??L(...(DRAFTS[T.id]||['','']))}
 // Wrap for SVG text: split on spaces into lines of at most n characters, keeping the student's line breaks.
 function wrap(text,n){const out=[];for(const para of String(text).split(/\n/)){let line='';for(const w of para.split(/\s+/)){if(!w)continue;if((line+' '+w).trim().length>n){if(line)out.push(line);line=w}else line=(line+' '+w).trim()}out.push(line)}return out}
 const xmlEsc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

 /* ---------- SVG export ---------- */
 function exportSVG(paper,mode='svg',opt={}){if(!data)return;
  const site=opt.theme==='site';// the atlas's own look: black sheet, red frame, bilingual side column
  const mm=site?{w:250,h:250,map:168}:paper==='A3'?{w:297,h:420,map:265}:{w:250,h:250,map:190};
  const mx=site?10:(mm.w-mm.map)/2,my=site?40:paper==='A3'?30:14,S=mm.map/(FRAME[2]-FRAME[0]);// mm per metre
  const X=x=>(mx+(x-FRAME[0])*S).toFixed(2),Y=y=>(my+(FRAME[3]-y)*S).toFixed(2);
  const pd=rings=>rings.map(r=>r.map((v,i)=>(i?'L':'M')+X(v[0])+' '+Y(v[1])).join('')+'').join('');
  const inB=f=>!f.b||overlap(f.b,FRAME);let body='';
  if(showBuildings&&window.DNA){let p='';for(const b of DNA.buildings){if(b.b&&!overlap(b.b,FRAME))continue;p+=pd(b.r)+'Z'}body+=`<g id="buildings"><path fill="${site?'#262624':window.Ex13FG?'#111':'#9a9a94'}" fill-rule="evenodd" d="${p}"/></g>`}
  // On the sheet, continuous fields go underneath so outlines and overlays stay readable.
  const under=k=>site&&['grid','value'].includes(LAYERS[k].type)?0:1;
  for(const k of order.filter(k=>state[k].on).sort((a,b)=>under(a)-under(b))){const d=LAYERS[k],op=state[k].op;let g='';
   const feats=data.layers[k]?.features||[];
   if(d.type==='grid')feats.filter(inB).forEach(f=>{const c=R[d.ramp](classOf(f.v,d.breaks));g+=`<path fill="${c}" stroke="${c}" stroke-width=".06" d="${pd(f.r)}Z"/>`});
   if(d.type==='value')feats.filter(inB).forEach(f=>{const c=R[d.ramp]((f.v-d.min)/(d.max-d.min));g+=`<path fill="${c}" stroke="${c}" stroke-width=".06" d="${pd(f.r)}Z"/>`});
   if(k==='flood')g=`<path fill="#3d8bff" fill-opacity=".55" fill-rule="evenodd" d="${feats.filter(inB).map(f=>pd(f.r)+'Z').join('')}"/>`;
   if(k==='rail')g=`<path fill="none" stroke="#ff5a36" stroke-width=".5" d="${feats.filter(inB).map(f=>pd(f.r)).join('')}"/>`;
   if(k==='water')g=`<path fill="none" stroke="#5fb4ff" stroke-width=".2" d="${data.layers.streams.features.filter(inB).map(f=>pd(f.r)).join('')}"/><path fill="none" stroke="#8fd0ff" stroke-width=".5" d="${data.layers.bouskoura.features.map(f=>pd(f.r)).join('')}"/>`;
   if(k==='contours')data.layers.contours.features.filter(f=>f.v%10===0&&inB(f)).forEach(f=>g+=`<path fill="none" stroke="${f.v%50?'#8f8670':'#5b4f36'}" stroke-width="${f.v%50?.12:.3}" d="${pd(f.r)}"/>`);
   if(k==='landuse')feats.filter(inB).forEach(f=>g+=`<path fill="${LU[f.fclass]||LU._}" d="${pd(f.r)}Z"/>`);
   if(k==='boundary')g=`<path fill="none" stroke="${site?'#e8a24a':'#c07a20'}" stroke-width="${site?.45:.6}" d="${feats.map(f=>pd(f.r)+'Z').join('')}"/>`;
   if(k==='centres')data.centreCells.filter(c=>c.n>=3&&inF(c.c)).forEach(c=>g+=`<circle cx="${X(c.c[0])}" cy="${Y(c.c[1])}" r="${(Math.sqrt(c.d/data.maxD)*480*S).toFixed(2)}" fill="#ffb347" fill-opacity=".3" stroke="#d27d12" stroke-width=".2"/>`);
   if(k==='civic')data.civic.forEach(p=>g+=`<rect x="${(X(p.c[0])-.6).toFixed(2)}" y="${(Y(p.c[1])-.6).toFixed(2)}" width="1.2" height="1.2" fill="#fff" stroke="#111" stroke-width=".15"/>`);
   if(k==='stops')data.stops.forEach(p=>g+=`<circle cx="${X(p.c[0])}" cy="${Y(p.c[1])}" r=".45" fill="#ff3b30"/>`);
   if(k==='patterns'&&window.Morph13?.cells){const S2=Morph13.segmentsByType;for(const [id,,name,c] of Morph13.RULES){const d=S2[id].filter(([a,b])=>inF(a)||inF(b)).map(([a,b])=>`M${X(a[0])} ${Y(a[1])}L${X(b[0])} ${Y(b[1])}`).join('');if(d)g+=`<path id="pattern-${id}" fill="none" stroke="${c}" stroke-width="${id==='mixed'?.12:.3}" stroke-linecap="round"${id==='mixed'?' stroke-opacity=".5"':''} d="${d}"/>`}}
   if(k==='zones')for(const [key,c,,e] of ZONES){const f=data.layers[key]?.features[0];if(f)g+=`<path fill="${c}" fill-opacity=".18" stroke="${c}" stroke-width=".35" fill-rule="evenodd" d="${pd(f.r)}Z"/><text x="${X((f.b[0]+f.b[2])/2)}" y="${(+Y(f.b[3])-1).toFixed(2)}" font-size="2.4" text-anchor="middle" fill="${site?'#eeeeea':'#333'}">${e}</text>`}
   if(k==='inst')(data.layers.institutions?.features||[]).filter(p=>inF(p.c)).forEach(p=>{const x=+X(p.c[0]),y=+Y(p.c[1]);g+=`<path d="M${x},${(y-.7).toFixed(2)}L${(x+.7).toFixed(2)},${y}L${x},${(y+.7).toFixed(2)}L${(x-.7).toFixed(2)},${y}Z" fill="#2a9fd0" stroke="#0b2530" stroke-width=".08"/>`});
   if(k==='nightlights'){const gl=nightGlow();if(gl)g=`<image href="${gl.canvas.toDataURL('image/png')}" x="${X(gl.box[0])}" y="${Y(gl.box[3])}" width="${((gl.box[2]-gl.box[0])*S).toFixed(2)}" height="${((gl.box[3]-gl.box[1])*S).toFixed(2)}" preserveAspectRatio="none"/>`}
   if(k==='busflow'&&data.layers.bus_routes){g=`<path fill="none" stroke="${R.bus(0)}" stroke-width=".15" stroke-linecap="round" d="${data.layers.bus_routes.features.filter(inB).map(f=>pd(f.r)).join('')}"/>`;
    [...data.layers.bus_overlap.features].filter(inB).sort((a,c)=>(a.n||1)-(c.n||1)).forEach(f=>{const t=((f.n||1)-1)/Math.max(1,data.busMax-1);g+=`<path fill="none" stroke="${R.bus(t)}" stroke-width="${(.2+t*.9).toFixed(2)}" stroke-linecap="round" d="${pd(f.r)}"/>`})}
   if(k==='busstops'&&data.layers.bus_stops){[...data.layers.bus_stops.features].filter(p=>inF(p.c)).sort((a,c)=>(a.n||1)-(c.n||1)).forEach(p=>g+=`<circle cx="${X(p.c[0])}" cy="${Y(p.c[1])}" r="${(.22*Math.sqrt(p.n||1)).toFixed(2)}" fill="${R.bus(((p.n||1)-1)/Math.max(1,data.stopMax-1))}" stroke="#120403" stroke-width=".04"/>`);
    data.layers.transport_hubs.features.filter(p=>inF(p.c)).forEach(p=>g+=`<circle cx="${X(p.c[0])}" cy="${Y(p.c[1])}" r="${(.22*Math.sqrt(p.n||1)+.35).toFixed(2)}" fill="none" stroke="${site?'#eeeeea':'#111'}" stroke-width=".18"/>`)}
   // History: every traced / GHSL extent, newest underneath, plus dated buildings by style family.
   if(k==='histext'&&window.Timeline13)[...Timeline13.extents()].filter(e=>e.traced).reverse().forEach(e=>g+=`<path id="extent-${e.y}" fill="${e.c}" fill-opacity="${e.y<1950?.35:.12}" stroke="${e.c}" stroke-width="${e.y<1950?.45:.3}" fill-rule="evenodd" d="${pd(e.f.r)}Z"/>`);
   if(k==='histbuild'&&window.Timeline13)(data.history?.items||[]).filter(b=>inF(b.c)).forEach(b=>g+=`<circle cx="${X(b.c[0])}" cy="${Y(b.c[1])}" r=".75" fill="${Timeline13.FAM[b.family]||(b.year!=null?'#f4f1ea':'#8d8a82')}" stroke="#111" stroke-width=".12"/>`);
   if(k==='dots')data.commerce.forEach(p=>g+=`<circle cx="${X(p.c[0])}" cy="${Y(p.c[1])}" r="${site?.3:.35}" fill="${FOOD.has(p.fclass)?'#e0a400':site?'#d8d8d0':'#333'}"/>`);
   if(k==='wind'&&wind){const w=wind[windSeason];w.freq.forEach((f,i)=>{if(f<.04)return;const to=(i*22.5+180)*Math.PI/180;for(let n=0;n<Math.round(f*220);n++){const x=lerp(FRAME[0],FRAME[2],Math.random()),y=lerp(FRAME[1],FRAME[3],Math.random()),l=w.speed[i]*120;g+=`<line x1="${X(x)}" y1="${Y(y)}" x2="${X(x+Math.sin(to)*l)}" y2="${Y(y+Math.cos(to)*l)}" stroke="#1f6fd1" stroke-width=".45" stroke-opacity=".9" stroke-linecap="round"/>`}})}
   if(g)body+=`<g id="${k}" opacity="${op}">${g}</g>`}
  if(site)return posterSVG(body,mm,mx,my,S);
  // scale bar
  const scaleN=Math.round(1/(S/1000)),bar=[1000,2000,5000].find(m=>m*S>=25)||5000,bw=bar*S,by=my+mm.map+9;
  const T=topic,title=`${T.n} · ${T.t[1].toUpperCase()} · ${T.t[0]}`;
  let ly=by+12,legendTxt='';
  for(const k of [...order].reverse().filter(k=>state[k].on)){const d=LAYERS[k];legendTxt+=`<text x="${mx}" y="${ly}" font-size="2.7" font-weight="bold">${d.t[1]} · ${d.t[0]}</text><text x="${mx+mm.map}" y="${ly}" font-size="2.2" fill="#666" text-anchor="end">${d.src}</text>`;ly+=2.5;
   if(d.type==='grid'){d.breaks.forEach((v,i)=>{const x=mx+i*22;legendTxt+=`<rect x="${x}" y="${ly}" width="5" height="3" fill="${R[d.ramp](i/(d.breaks.length-1))}" stroke="#999" stroke-width=".1"/><text x="${x+6}" y="${ly+2.5}" font-size="2.3">${i===d.breaks.length-1?'≥'+v:v+'–'+d.breaks[i+1]}</text>`});legendTxt+=`<text x="${mx+d.breaks.length*22}" y="${ly+2.5}" font-size="2.3" fill="#666">${d.unit[1]}</text>`;ly+=6}
   else if(d.type==='value'){const n=8;for(let i=0;i<n;i++)legendTxt+=`<rect x="${mx+i*12}" y="${ly}" width="12" height="3" fill="${R[d.ramp]((i+.5)/n)}"/>`;for(let i=0;i<=n;i+=2){const v=d.min+(d.max-d.min)*i/n;legendTxt+=`<text x="${mx+i*12}" y="${ly+6}" font-size="2.3" text-anchor="middle">${k==='ndvi'?v.toFixed(2):Math.round(v)}</text>`}legendTxt+=`<text x="${mx+n*12+4}" y="${ly+2.5}" font-size="2.3" fill="#666">${d.unit[1]}</text>`;ly+=12}
   else if(k==='wind'&&wind){const w=wind[windSeason],i=w.freq.indexOf(Math.max(...w.freq));legendTxt+=`<line x1="${mx}" y1="${ly+1.5}" x2="${mx+8}" y2="${ly+1.5}" stroke="#1f6fd1" stroke-width=".45"/><text x="${mx+10}" y="${ly+2.5}" font-size="2.3">${windSeason} · prevailing from ${(i*22.5)}° (${Math.round(w.freq[i]*100)}% of hours, ${w.speed[i]} m/s) · line length ∝ speed · single-station reference</text>`;ly+=8}
   else if(k==='centres'){legendTxt+=`<circle cx="${mx+3}" cy="${ly+2}" r="2" fill="#ffb347" fill-opacity=".3" stroke="#d27d12" stroke-width=".2"/><text x="${mx+7}" y="${ly+2.8}" font-size="2.3">circle area ∝ shops + services per km² (500 m cells) · max ${data.maxD}/km²</text>`;ly+=6}
   else if(k==='patterns'&&window.Morph13?.cells){Morph13.RULES.forEach(([id,,name,c],i)=>{const x=mx+(i%3)*(mm.map/3),y=ly+Math.floor(i/3)*4;legendTxt+=`<line x1="${x}" y1="${y+1.5}" x2="${x+5}" y2="${y+1.5}" stroke="${c}" stroke-width=".8"/><text x="${x+7}" y="${y+2.5}" font-size="2.3">${name[1]}</text>`});ly+=Math.ceil(Morph13.RULES.length/3)*4+2}
   else if(k==='busflow'){for(let i=0;i<4;i++)legendTxt+=`<rect x="${mx+i*12}" y="${ly}" width="12" height="3" fill="${R.bus(i/3)}"/>`;legendTxt+=`<text x="${mx}" y="${ly+6}" font-size="2.3">1</text><text x="${mx+48}" y="${ly+6}" font-size="2.3" text-anchor="end">${data.busMax}</text><text x="${mx+52}" y="${ly+2.5}" font-size="2.3" fill="#666">bus lines sharing the street segment · line width ∝ overlap</text>`;ly+=10}
   else if(k==='busstops'){[1,Math.round(data.stopMax/2),data.stopMax].forEach((v,i)=>{const x=mx+3+i*16;legendTxt+=`<circle cx="${x}" cy="${ly+2}" r="${(.22*Math.sqrt(v)*2).toFixed(2)}" fill="${R.bus((v-1)/Math.max(1,data.stopMax-1))}"/><text x="${x+4}" y="${ly+2.8}" font-size="2.3">${v} lines</text>`});legendTxt+=`<text x="${mx+52}" y="${ly+2.8}" font-size="2.3" fill="#666">ring = major hub · circle area ∝ lines</text>`;ly+=7}
   else if(k==='contours'){legendTxt+=`<text x="${mx}" y="${ly+2.5}" font-size="2.3">thin = 10 m · bold = 50 m · m a.s.l.</text>`;ly+=5}
   else ly+=2.5}
  // Question + conclusion block, each line its own <text> so Illustrator keeps it editable.
  const rtlText=/[؀-ۿ]/.test(conclusion(T)),fs=paper==='A3'?3.2:2.6,lh=fs*1.45,maxLines=paper==='A3'?14:3;
  let tb=`<text x="${rtlText?mx+mm.map:mx}" y="${(ly+5).toFixed(2)}" font-size="${fs*.9}" fill="#98682c" font-weight="bold"${rtlText?' text-anchor="end" direction="rtl"':''}>${xmlEsc(L(T.q[0],T.q[1]))}</text>`;
  wrap(conclusion(T),Math.floor(mm.map/(fs*.5))).slice(0,maxLines).forEach((line,i)=>tb+=`<text x="${rtlText?mx+mm.map:mx}" y="${(ly+5+lh*(i+1.2)).toFixed(2)}" font-size="${fs}"${rtlText?' text-anchor="end" direction="rtl"':''} font-family="Noto Kufi Arabic, Readex Pro, Arial, sans-serif">${xmlEsc(line)}</text>`);
  legendTxt=`<g id="legend">${legendTxt}</g><g id="conclusion">${tb}</g>`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${mm.w}mm" height="${mm.h}mm" viewBox="0 0 ${mm.w} ${mm.h}" font-family="Arial, sans-serif"><rect width="100%" height="100%" fill="#fff"/><text x="${mx}" y="${my-4}" font-size="4" font-weight="bold">${title}</text><text x="${mx+mm.map}" y="${my-4}" font-size="2.6" text-anchor="end">CASABLANCA · 15 × 15 km · 1:${scaleN.toLocaleString('en-US')}</text><clipPath id="fr"><rect x="${mx}" y="${my}" width="${mm.map}" height="${mm.map}"/></clipPath><g clip-path="url(#fr)">${body}</g><rect x="${mx}" y="${my}" width="${mm.map}" height="${mm.map}" fill="none" stroke="#111" stroke-width=".3"/><g transform="translate(${mx+mm.map-8},${my+6})"><path d="M0,-4 L2.4,3 L0,1.6 L-2.4,3Z" fill="#111"/><text y="7.5" font-size="3" text-anchor="middle">N</text></g><g transform="translate(${mx},${by})"><rect width="${bw/2}" height="1.2" fill="#111"/><rect x="${bw/2}" width="${bw/2}" height="1.2" fill="none" stroke="#111" stroke-width=".2"/><text y="4.5" font-size="2.4">0</text><text x="${bw}" y="4.5" font-size="2.4" text-anchor="middle">${bar/1000} km</text></g>${legendTxt}<text x="${mx}" y="${mm.h-6}" font-size="2.2" fill="#555">Frame 15 × 15 km · WGS84 / UTM 29N (EPSG:32629) · Base: © OpenStreetMap contributors · Exported ${new Date().toISOString().slice(0,10)}</text></svg>`;
  const name=`casa_1.3_${T.n}_${T.id}_${paper}`;
  if(mode==='pdf'){// Vector PDF through the browser's print dialog, page sized to the paper.
   const f=document.createElement('iframe');f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';document.body.appendChild(f);const d=f.contentDocument;
   d.open();d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${name}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;600&family=Readex+Pro:wght@400;600&display=swap"><style>@page{size:${mm.w}mm ${mm.h}mm;margin:0}html,body{margin:0}svg{display:block;width:${mm.w}mm;height:${mm.h}mm}</style></head><body>${svg}</body></html>`);d.close();
   setTimeout(()=>{try{f.contentWindow.focus();f.contentWindow.print()}catch{toast(L('تعذّر فتح نافذة الطباعة هنا؛ استخدم SVG.','The print dialog is not available here; use SVG.'))}setTimeout(()=>f.remove(),120000)},700);return}
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));a.download=name+'.svg';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}

 /* ---------- 25 × 25 sheet in the atlas's own look (for the Miro board): EN left, AR right ---------- */
 function posterSVG(body,mm,mx,my,S){const T=topic,INK='#eeeeea',MU='#8d8d86',RED='#ff4d24',AMB='#ffb347',R0=mm.w-10;
  const LA='font-family="Readex Pro, Arial, sans-serif"',AF='font-family="Noto Kufi Arabic, Tahoma, sans-serif"';
  const en=(x,y,s,t,a='')=>`<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${s}" ${LA}${a}>${xmlEsc(t)}</text>`;
  // Arabic set right-to-left; 'start' anchors the right end at x, 'end' the left end.
  const ar=(x,y,s,t,a='',anchor='start')=>`<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${s}" ${AF} direction="rtl" text-anchor="${anchor}"${a}>${xmlEsc(t)}</text>`;
  const strip=s=>String(s).replace(/^(مسودة|Draft)\s*:\s*/,'').replace(/^[a-z]/,c=>c.toUpperCase());
  let out='';
  // header: lockup left, chapter right
  out+=ar(10,16,7.2,'الدار البيضاء',` fill="${INK}" font-weight="600"`,'end');
  out+=`<text x="10" y="25" font-size="6.6" font-weight="600" ${LA} fill="${INK}" letter-spacing="-.2">CASA<tspan fill="${RED}">/</tspan>BLANCA</text>`;
  out+=`<text x="10" y="30" font-size="1.9" ${LA} fill="${MU}" letter-spacing=".7">URBAN DNA — <tspan ${AF}>أطلس الأنسجة</tspan></text>`;
  out+=en(R0,12.5,2.1,`1.3 · CITY ID · ${T.n}`,` fill="${RED}" text-anchor="end" letter-spacing=".6"`);
  out+=en(R0,21.5,7,T.t[1].toUpperCase(),` fill="${INK}" text-anchor="end" font-weight="600"`);
  out+=ar(R0,30,5,T.t[0],` fill="${INK}"`);
  out+=`<line x1="10" y1="${my-4}" x2="${R0}" y2="${my-4}" stroke="${RED}" stroke-width=".25"/>`;
  // map, red frame, north, scale bar on the sheet
  out+=`<clipPath id="fr"><rect x="${mx}" y="${my}" width="${mm.map}" height="${mm.map}"/></clipPath><g id="map" clip-path="url(#fr)">${body}</g><rect x="${mx}" y="${my}" width="${mm.map}" height="${mm.map}" fill="none" stroke="${RED}" stroke-opacity=".8" stroke-width=".3"/>`;
  out+=`<g transform="translate(${mx+mm.map-7},${my+7})" fill="${INK}"><path d="M0,-4 L2.4,3 L0,1.6 L-2.4,3Z"/><text y="7.5" font-size="2.6" text-anchor="middle" ${LA}>N</text></g>`;
  const bar=2000,bw=bar*S,sx=mx+5,sy=my+mm.map-6;
  out+=`<g transform="translate(${sx},${sy})" fill="${INK}"><rect width="${bw/2}" height="1" /><rect x="${bw/2}" width="${bw/2}" height="1" fill="none" stroke="${INK}" stroke-width=".2"/><text y="-1.4" font-size="2" ${LA}>0</text><text x="${bw}" y="-1.4" font-size="2" text-anchor="middle" ${LA}>2 km</text><text y="4" font-size="1.8" fill="${MU}" ${LA}>1:${Math.round(1/(S/1000)).toLocaleString('en-US')} · 15 × 15 km</text></g>`;
  // side column: question, then the legend of visible layers
  const cx=mx+mm.map+7,cw=R0-cx;let y=my+2.5,col='';
  wrap(T.q[1],Math.floor(cw/1.3)).forEach(l=>{col+=en(cx,y,2.6,l,` fill="${AMB}" font-weight="600"`);y+=3.4});y+=.6;
  wrap(T.q[0],Math.floor(cw/1.45)).forEach(l=>{col+=ar(R0,y,2.5,l,` fill="${AMB}"`);y+=3.6});
  y+=2;col+=`<line x1="${cx}" y1="${y}" x2="${R0}" y2="${y}" stroke="${MU}" stroke-width=".15"/>`;y+=5;
  const sw=(c,t)=>`<rect x="${cx}" y="${(y-2.3).toFixed(2)}" width="4" height="2.6" fill="${c}"/>`+en(cx+5.5,y,2.1,t,` fill="${INK}"`);
  const ln=(c,w,t)=>`<line x1="${cx}" y1="${(y-.9).toFixed(2)}" x2="${cx+5}" y2="${(y-.9).toFixed(2)}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`+en(cx+6.5,y,2.1,t,` fill="${INK}"`);
  for(const k of [...order].reverse().filter(k=>state[k].on)){const d=LAYERS[k];
   wrap(d.t[1],Math.floor(cw/1.3)).forEach(l=>{col+=en(cx,y,2.4,l,` fill="${INK}" font-weight="600"`);y+=3.2});wrap(d.t[0],Math.floor(cw/1.25)).forEach(l=>{col+=ar(R0,y,2.2,l,` fill="${MU}"`);y+=3.2});y+=.8;
   if(d.type==='grid'){d.breaks.forEach((v,i)=>{const x=cx+(i%2)*(cw/2);col+=`<rect x="${x}" y="${(y-2.3).toFixed(2)}" width="4" height="2.6" fill="${R[d.ramp](i/(d.breaks.length-1))}" stroke="#444" stroke-width=".1"/>`+en(x+5.5,y,2.1,i===d.breaks.length-1?'≥ '+v:v+'–'+d.breaks[i+1],` fill="${INK}"`);if(i%2)y+=3.6});if(d.breaks.length%2)y+=3.6;col+=en(cx,y,1.9,d.unit[1],` fill="${MU}"`);y+=4}
   else if(d.type==='value'){const n=8,w=cw/n;for(let i=0;i<n;i++)col+=`<rect x="${(cx+i*w).toFixed(2)}" y="${(y-2.3).toFixed(2)}" width="${w.toFixed(2)}" height="2.6" fill="${R[d.ramp]((i+.5)/n)}"/>`;y+=3.4;[0,4,8].forEach(i=>{const v=d.min+(d.max-d.min)*i/n;col+=en(cx+i*w,y,1.9,(k==='ndvi'?v.toFixed(2):Math.round(v))+(i===8?' '+d.unit[1]:''),` fill="${INK}" text-anchor="${i?i===8?'end':'middle':'start'}"`)});y+=4}
   else if(k==='patterns'&&window.Morph13?.cells){Morph13.RULES.forEach(([id,,name,c])=>{col+=ln(c,1,name[1].split(':')[0]);y+=2.7;col+=ar(R0,y,1.9,name[0].split(':')[0],` fill="${MU}"`);y+=3.6})}
   else if(k==='zones')ZONES.forEach(([,c,a,e])=>{col+=sw(c,e);col+=ar(R0,y,1.9,a,` fill="${MU}"`);y+=3.4});
   else if(k==='centres'){col+=`<circle cx="${cx+2}" cy="${y-1}" r="2" fill="#ffb347" fill-opacity=".3" stroke="#d27d12" stroke-width=".2"/>`+en(cx+5.5,y,2.1,`area ∝ shops + services / km² · max ${data.maxD}`,` fill="${INK}"`);y+=4}
   else if(k==='busflow'){for(let i=0;i<4;i++)col+=`<rect x="${cx+i*8}" y="${(y-2.3).toFixed(2)}" width="8" height="2.6" fill="${R.bus(i/3)}"/>`;col+=en(cx+34,y,2.1,`1 → ${data.busMax} lines / street`,` fill="${INK}"`);y+=3.6}
   else if(k==='busstops'){[1,Math.round(data.stopMax/2),data.stopMax].forEach((v,i)=>{const x=cx+2+i*12;col+=`<circle cx="${x}" cy="${y-1}" r="${(.22*Math.sqrt(v)*2).toFixed(2)}" fill="${R.bus((v-1)/Math.max(1,data.stopMax-1))}"/>`+en(x+3.5,y,2,String(v),` fill="${INK}"`)});col+=en(cx+38,y,1.9,'lines / stop',` fill="${MU}"`);y+=4}
   else if(k==='flood'){col+=sw('rgba(61,139,255,.6)','HAND < 5 m above drainage');y+=3.6}
   else if(k==='rail'){col+=ln('#ff5a36',.6,'railway line');y+=3.6}
   else if(k==='boundary'){col+=ln('#e8a24a',.5,'administrative limit');y+=3.6}
   else if(k==='water'){col+=ln('#8fd0ff',.5,'streams · Oued Bouskoura');y+=3.6}
   else if(k==='dots'){col+=`<circle cx="${cx+1.5}" cy="${y-1}" r=".7" fill="#e0a400"/>`+en(cx+4,y,2.1,'café · restaurant',` fill="${INK}"`)+`<circle cx="${cx+cw/2+1.5}" cy="${y-1}" r=".7" fill="#d8d8d0"/>`+en(cx+cw/2+4,y,2.1,'shop · service',` fill="${INK}"`);y+=3.6}
   else if(k==='nightlights'){const n=8,w=cw/n;for(let i=0;i<n;i++){const t=(i+.5)/n;col+=`<rect x="${(cx+i*w).toFixed(2)}" y="${(y-2.3).toFixed(2)}" width="${w.toFixed(2)}" height="2.6" fill="${R.night(t)}"/>`}y+=3.4;col+=en(cx,y,1.9,'dark',` fill="${INK}"`)+en(R0,y,1.9,'brightest · nW/cm²/sr',` fill="${INK}" text-anchor="end"`);y+=4}
   else if(k==='civic'){col+=`<rect x="${cx+.9}" y="${y-1.9}" width="1.2" height="1.2" fill="#fff" stroke="#111" stroke-width=".15"/>`+en(cx+4,y,2.1,'public institution',` fill="${INK}"`);y+=3.6}
   else if(k==='inst'){col+=`<path d="M${cx+1.5},${y-2} l.8,.8 l-.8,.8 l-.8,-.8Z" fill="#2a9fd0"/>`+en(cx+4,y,2.1,'institution',` fill="${INK}"`);y+=3.6}
   else if(k==='contours'){col+=en(cx,y,2.1,'thin 10 m · bold 50 m · m a.s.l.',` fill="${INK}"`);y+=3.6}
   else if(k==='histext'&&window.Timeline13)Timeline13.extents().filter(e=>e.traced).forEach(e=>{col+=sw(e.c,`${e.ghsl?'GHSL '+e.y:e.y+(e.y===1918?' · dense core':'')} · ${e.km2.toFixed(1)} km²`);y+=3.4});
   else if(k==='histbuild'&&window.Timeline13){const it=data.history?.items||[];[['artdeco','Art Deco','آرت ديكو'],['neomoorish','Neo-Moorish','نيو-موريسكي'],['modern','Modernism','الحداثة'],[null,'other dated building','مبنى مؤرَّخ آخر']].forEach(([f,e,a])=>{const n=it.filter(b=>f?b.family===f:!Timeline13.FAM[b.family]&&b.year!=null).length;col+=`<circle cx="${cx+1.5}" cy="${y-1}" r=".9" fill="${f?Timeline13.FAM[f]:'#f4f1ea'}"/>`+en(cx+4,y,2.1,`${e} (${n})`,` fill="${INK}"`)+ar(R0,y,1.9,a,` fill="${MU}"`);y+=3.4})}
   else if(k==='wind'&&wind){const w=wind[windSeason],i=w.freq.indexOf(Math.max(...w.freq));col+=ln('#1f6fd1',.45,`${windSeason} · from ${i*22.5}° · ${Math.round(w.freq[i]*100)}% · ${w.speed[i]} m/s`);y+=3.6}
   wrap(d.src,Math.floor(cw/0.95)).forEach(l=>{col+=en(cx,y,1.7,l,` fill="${MU}"`);y+=2.4});y+=3.2}
  // History: the periods (from the studio's Miro research) in the column, and a year strip under the map.
  const hist=T.id==='history'&&window.Timeline13;let shift=0;
  if(hist){const SHORT=[['Medina and anchorage','المدينة القديمة والمرسى'],['Colonial turn, modern port','التحول الاستعماري والميناء'],['Prost plan, the Habous','مخطط بروست والأحباس'],['Art Deco, Anfa','الآرت ديكو وأنفا'],['Écochard, shantytowns, Aïn Chock','إيكوشار، الصفيح، عين الشق'],['Independence, growth to the edges','الاستقلال والتوسع للأطراف'],['Renewal, Casa Anfa','التجديد الحضري وكازا أنفا']];
   col+=`<line x1="${cx}" y1="${y-2}" x2="${R0}" y2="${y-2}" stroke="${MU}" stroke-width=".15"/>`;y+=2;
   col+=en(cx,y,2.4,'Periods',` fill="${INK}" font-weight="600"`)+ar(R0,y,2.2,'الحقب',` fill="${MU}"`);y+=4;
   Timeline13.ERAS.forEach(([a,b,c],i)=>{col+=`<rect x="${cx}" y="${(y-2.3).toFixed(2)}" width="2" height="5.6" fill="${c}"/>`+en(cx+3.5,y,2.1,`${a}–${b} · ${SHORT[i][0]}`,` fill="${INK}"`);y+=2.9;col+=ar(R0,y,1.9,SHORT[i][1],` fill="${MU}"`);y+=3.6});
   const sy=my+mm.map+7,x0=10,x1=R0,yx=v=>x0+(v-1880)/(2026-1880)*(x1-x0);let st='';
   Timeline13.ERAS.forEach(([a,b,c])=>{st+=`<rect x="${yx(a).toFixed(2)}" y="${sy}" width="${(yx(Math.min(2026,b+1))-yx(a)).toFixed(2)}" height="2.6" fill="${c}"/>`+en(yx(a),sy+5.4,1.7,String(a),` fill="${MU}"`)});
   st+=en(x1,sy+5.4,1.7,'2026',` fill="${MU}" text-anchor="end"`);
   Timeline13.extents().filter(e=>e.traced).forEach(e=>{const ex=yx(e.y);st+=`<line x1="${ex.toFixed(2)}" y1="${sy-2.6}" x2="${ex.toFixed(2)}" y2="${sy+2.6}" stroke="${e.c}" stroke-width=".5"/><circle cx="${ex.toFixed(2)}" cy="${sy-2.6}" r=".7" fill="${e.c}"/>`});
   st+=en(x0,sy-4,1.7,'● EXTENT SNAPSHOTS  ·  PERIODS 1880–2026',` fill="${MU}" letter-spacing=".4"`);
   out+=`<g id="timeline">${st}</g>`;shift=12}
  out+=`<g id="column">${col}</g>`;
  // conclusion: English left, Arabic right
  let saved=null;try{saved=localStorage.getItem('casa13-concl-'+T.id)}catch{}
  const D=DRAFTS[T.id]||['',''],isAr=s=>/[؀-ۿ]/.test(s||'');
  const tAr=strip(saved&&isAr(saved)?saved:D[0]),tEn=strip(saved&&!isAr(saved)?saved:D[1]);
  const by=my+mm.map+8+shift,half=(R0-10-8)/2,maxL=hist?3:6;let cb='';
  cb+=en(10,by,2,'CONCLUSION',` fill="${RED}" letter-spacing=".6"`)+ar(R0,by,2.2,'الاستنتاج',` fill="${RED}"`);
  wrap(tEn,Math.floor(half/1.32)).slice(0,maxL).forEach((l,i)=>cb+=en(10,by+4.6+i*3.7,2.5,l,` fill="${INK}"`));
  wrap(tAr,Math.floor(half/1.42)).slice(0,maxL).forEach((l,i)=>cb+=ar(R0,by+4.6+i*3.9,2.5,l,` fill="${INK}"`));
  out+=`<g id="conclusion">${cb}</g>`;
  out+=en(10,mm.h-4.5,1.7,`Frame 15 × 15 km · WGS84 / UTM 29N (EPSG:32629) · © OpenStreetMap contributors, GHSL, NOAA, Landsat · Studio 5 Urban Transformation · ${new Date().toISOString().slice(0,10)}`,` fill="${MU}"`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${mm.w}mm" height="${mm.h}mm" viewBox="0 0 ${mm.w} ${mm.h}" ${LA}><rect id="sheet" width="100%" height="100%" fill="#0e0e0e"/>${out}</svg>`}

 /* ---------- menu wiring ---------- */
 document.addEventListener('click',e=>{const b=e.target.closest('[data-ex13]');if(!b)return;e.preventDefault();e.stopPropagation();open(b.dataset.ex13)},true);
 // Language switch: retitle open windows and move them to the new side at once, keeping layer state.
 new MutationObserver(()=>{if(topic){const sp=specsFor(topic);wins.forEach((el,i)=>{const s=sp.find(x=>x[0]===el.dataset.ex);if(s)el.querySelector('.wintitle').innerHTML=`<small>1.3</small>${s[1]}`;placeWin(el,i)})}fill();document.querySelectorAll('[data-ex13]').forEach(b=>{const t=TOPICS.find(x=>x.id===b.dataset.ex13);b.querySelector('span').textContent=L(t.t[0],t.t[1])})}).observe(document.documentElement,{attributes:true,attributeFilter:['lang','dir']});
 document.querySelectorAll('[data-ex13]').forEach(b=>{const t=TOPICS.find(x=>x.id===b.dataset.ex13);b.querySelector('span').textContent=L(t.t[0],t.t[1])});
 return{paint,open,close:closeAll,exportSVG,get active(){return !!topic},get state(){return state},get data(){return data}};
})();
