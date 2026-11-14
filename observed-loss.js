'use strict';
window.ObservedLoss=(()=>{
 const data={"sources":[{"asset":"loss-before.png","release":"2014-02-20","size":[1872,883],"scale":0.8523666250645805,"tx":-2231.858572474667,"ty":15312.605659255427},{"asset":"loss-after.png","release":"2026-10-29","size":[1010,662],"scale":0.8525358943577527,"tx":-2574.504241644409,"ty":15285.604787792392}],"rings":[[[3261.7,17517.7],[3322.7,17527.1],[3365.7,17539.9],[3389.6,17501.9],[3393.6,17498.0],[3398.8,17496.2],[3418.6,17494.6],[3477.4,17512.8],[3483.6,17512.7],[3488.2,17514.5],[3491.6,17518.0],[3493.4,17522.6],[3493.2,17527.5],[3476.0,17595.3],[3452.6,17700.7],[3440.9,17765.0],[3436.8,17772.1],[3426.3,17775.1],[3436.2,17871.2],[3560.7,17877.8],[3604.7,17914.0],[3738.3,17913.8],[3748.3,17776.1],[3747.2,17774.9],[3723.6,17774.0],[3719.7,17771.3],[3716.3,17762.7],[3733.0,17721.0],[3738.7,17650.6],[3718.7,17595.3],[3767.9,17478.4],[3784.4,17407.6],[3717.3,17378.1],[3565.0,17337.4],[3549.7,17366.2],[3540.6,17369.2],[3535.9,17367.8],[3530.1,17362.7],[3456.2,17338.6],[3429.9,17387.2],[3397.4,17403.1],[3302.6,17371.5],[3283.6,17420.9],[3261.7,17517.7]],[[3190.1,17740.6],[3243.0,17750.2],[3296.8,17763.0],[3393.9,17779.2],[3429.2,17668.1],[3443.0,17617.7],[3387.7,17601.3],[3329.6,17564.6],[3279.8,17554.4],[3252.1,17545.1],[3225.9,17573.3],[3207.5,17642.4],[3190.1,17740.6]]],"rings_v1":[[[3438.4952276288473,17778.27194736455],[3580.4529209991533,17787.657579984072],[3709.505369517613,17775.925539209667],[3732.9694510664235,17721.958151647403],[3738.8354714536263,17649.219498846087],[3717.7177980596966,17595.252111283822],[3742.355083685948,17536.591907411796],[3768.16557338964,17477.93170353977],[3784.5904304738074,17407.539458893338],[3717.7177980596966,17378.209356957323],[3564.0280639149855,17337.147214246903],[3532.351553824091,17406.366254815897],[3499.5018396557557,17502.56898916602],[3476.0377581069447,17595.252111283822],[3452.573676558134,17700.84047825347],[3438.4952276288473,17778.27194736455]],[[3189.89999088908,17740.724921836078],[3242.6836921945837,17750.108690957055],[3296.6403646402096,17763.0113734984],[3350.5970370858354,17772.395142619378],[3393.9969692703608,17779.432969460115],[3409.2455940919504,17730.168181574976],[3429.1861034740296,17668.000711148496],[3443.2617571554974,17617.562952123237],[3389.3050847098716,17602.314327301647],[3368.19160418767,17588.238673620177],[3330.656527703756,17564.779250817734],[3279.045797538375,17554.222510556632],[3252.067461315562,17544.83874143565],[3226.2620962328715,17571.817077658467],[3207.4945579909145,17642.195346065804],[3189.89999088908,17740.724921836078]],[[3261.4512304365403,17517.86040521284],[3323.6187008630227,17527.244174333817],[3365.8456619074254,17540.146856875162],[3392.823998130238,17496.746924690637],[3420.9753054931734,17494.400982410392],[3478.4508913591662,17513.16852065235],[3494.8724873208785,17474.460473028314],[3512.4670544227133,17420.50380058269],[3531.23459266467,17363.028214716694],[3456.1644396968427,17338.395820774127],[3430.359074614152,17387.660608659266],[3397.5158826907277,17404.082204620976],[3348.251094805591,17387.660608659266],[3302.505220340821,17371.23901269755],[3283.7376820988643,17420.50380058269],[3261.4512304365403,17517.86040521284]]],"method":"Visual comparison of Esri Wayback 2014-02-20 and 2026-10-29; OSM 0 / Microsoft = GBA 49 footprints inside, so no footprint source maps the shacks","area_m2":219192};
 const L=(ar,en)=>Locale.language==='ar'?ar:en;
 const rings=data.rings,box=ChangeGeometry.bounds(rings),area=data.area_m2||rings.reduce((sum,ring)=>sum+ChangeGeometry.area([ring]),0);
 // One control only: which year of the Esri Wayback archive is under the outline.
 const YEARS=[2014,2016,2019,2026];
 let visible=false,year=2014;
 const releaseFor=y=>{const r=Imagery.sources.filter(s=>s.release&&+s.release.slice(0,4)<=y).sort((a,b)=>a.release<b.release?-1:1);return r[r.length-1]||null};
 async function showYear(y){year=y;if(Imagery.catalogStatus!=='ready'&&!Imagery.sources.some(s=>s.release))await Imagery.loadCatalog();
  const s=releaseFor(y);if(s){Imagery.state.enabled=true;Imagery.state.swipe=false;Imagery.state.left=s;Imagery.state.right=s;Imagery.sync?.()}
  visible=true;refresh('observedLoss');render()}
 function open(){
  visible=true;
  setMenu(false);
  fit(ChangeGeometry.evidenceBox(box));
  openWindow('observedLoss');
  showYear(year);
 }
 function content(){
  const s=Imagery.sources.some(x=>x.release)?releaseFor(year):null;
  return `<p class="lead">${L('اختفاء التجمع','The settlement disappeared')}</p>
  <div class="seg lossYears">${YEARS.map(y=>`<button data-loss-year="${y}" class="${y===year?'on':''}">${y}</button>`).join('')}</div>
  <p class="tiny">${s?L('نسخة الأرشيف ','Archive release ')+s.release:L('يحمّل أرشيف Esri Wayback…','Loading the Esri Wayback archive…')}</p>
  <p>${L('2014: أسقف متلاصقة في كل المساحة المحددة. 2016: معظمها ركام. 2026: أرض مكشوفة. المساحة','2014: packed roofs across the outlined area. 2016: mostly rubble. 2026: bare ground. Area')} <b>${fmt(area/10000,1)} ha</b>.</p>
  <p class="note">${L('قارنّا المصادر قبل الرسم: OSM لا يحتوي أي مبنى هنا اليوم، وMicrosoft وGlobalBuildingAtlas يحتويان نفس الـ49 مبنى فقط (6,081 م² من 22 هكتار). أي لا يوجد مصدر رسم البراريك، فالحدود مرسومة بالعين بمقارنة 2014 و2026 (≈1.5 م للبكسل). المبنيان الباقيان (القاعة في الوسط والبلوك أسفل اليسار) خارج الحدود. التواريخ تواريخ نشر الأرشيف لا تواريخ الالتقاط.','We compared the sources before drawing: OSM has no building here today, and Microsoft and GlobalBuildingAtlas share the same 49 footprints only (6,081 m² of 22 ha). No source maps the shacks, so the outline is traced by eye between 2014 and 2026 (≈1.5 m per pixel). The two buildings still standing (the hall in the middle, the block bottom left) stay outside. Dates are archive releases, not capture dates.')}</p>`;
 }
 function bind(body){
  body.querySelectorAll('[data-loss-year]').forEach(b=>b.onclick=()=>showYear(+b.dataset.lossYear));
 }
 function paint(c,bounds){
  if(!visible||!overlap(box,bounds))return;
  const path=pathFor(rings);
  c.fillStyle=year>=2026?'#ffb34730':'#ffb34712';c.fill(path,'evenodd');
  c.strokeStyle='#ffb347';c.lineWidth=2.5/view.s;c.setLineDash([7/view.s,4/view.s]);c.stroke(path);c.setLineDash([]);
 }
 return{open,content,bind,paint,show(){visible=true;render()},hide(){visible=false;render()}};
})();
// Threatened places (data/threatened.json, press-sourced): a halo that pulses on its own light canvas, so the
// map itself is not redrawn. Shown from the first view, with the demolished settlement outlined.
window.Threats=(()=>{let T=null,cv=null,cx=null,on=true,DM=null,upTo=9999,showDM=true;let WS=null;fetch('data/wadi_study.json?v=1').then(r=>r.ok?r.json():null).then(d=>{WS=d}).catch(()=>{});fetch('data/threatened.json?v=2').then(r=>r.ok?r.json():null).then(d=>{T=d;start()}).catch(()=>{});
 // reviewed demolition (data/demolition_v4.json, WORKFLOW_رصد_الهدم.md): only sites checked by eye, coloured by the phase
 // in which they disappeared — 2015–2021 slow · 2021–2023 first acceleration · 2024–2026 World Cup wave. Automatic
 // detections and the older mixed files (demolition.json, demolition_v3.json) are never shown to the public.
 const PH=[{to:2021,col:'#ff4d24',ar:'2015–2021 · تباطؤ',en:'2015–2021 · slow'},{to:2023,col:'#ff4d24',ar:'2021–2023 · التسارع الأول',en:'2021–2023 · first acceleration'},{to:9999,col:'#ff4d24',ar:'2024–2026 · موجة المونديال',en:'2024–2026 · World Cup wave'}];
 const TY={slum:['تفكيك صفيح','slum clearance'],project:['إخلاء لمشروع','clearance for a project'],collapse:['انهيار','collapse'],rebuild:['هدم وإعادة بناء','demolished and rebuilt']};
 fetch('data/demolition_v4.json?v='+Date.now().toString().slice(0,7)).then(r=>r.ok?r.json():null).catch(()=>null).then(d=>{if(!d?.sites?.length)return;
  DM={meta:d,PH,g:d.sites.filter(s=>(s.status||'gone')!=='standing').map(s=>{const ph=PH.findIndex(p=>s.gone<=p.to),rings=[s.ring,...(s.holes||[])],xs=s.ring.map(p=>p[0]),ys=s.ring.map(p=>p[1]);return{...s,ph,rings,ha:s.area/1e4,b:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]}})};if(typeof windows!=='undefined'&&windows.has('changeScan'))refresh('changeScan')}).catch(()=>{});
 function start(){if(cv||!T)return;cv=document.createElement('canvas');cv.id='threatLayer';document.body.appendChild(cv);cx=cv.getContext('2d');const fitC=()=>{cv.width=innerWidth;cv.height=innerHeight};fitC();addEventListener('resize',fitC);requestAnimationFrame(loop)}
 const near=(x,y,R)=>x>-R*3&&y>-R*3&&x<cv.width+R*3&&y<cv.height+R*3;
 function loop(t){requestAnimationFrame(loop);if(!cx)return;cx.clearRect(0,0,cv.width,cv.height);if(!on||!T||window.Ex13World||typeof screen!=='function'||typeof view==='undefined')return;
  // demolished: gold — traced outline where we have one, else a dashed circle at the documented place
  for(const s of T.demolished){cx.strokeStyle='rgba(244,242,236,.85)';cx.fillStyle='rgba(244,242,236,.06)';cx.lineWidth=1.1;
   if(s.rings){cx.beginPath();for(const r of s.rings)r.forEach((p,i)=>{const [x,y]=screen(p[0],p[1]);i?cx.lineTo(x,y):cx.moveTo(x,y)});cx.closePath();cx.fill('evenodd');cx.stroke()}
   else{const [x,y]=screen(s.x,s.y),R=Math.max(7,s.r*view.s);if(!near(x,y,R))continue;cx.setLineDash([4,3]);cx.beginPath();cx.arc(x,y,R,0,7);cx.fill();cx.stroke();cx.setLineDash([])}}
  // team wadi study (data/wadi_study.json): flood-affected areas by impact level, approximate flood extent,
  // the bed still visible (solid) and no longer visible (dashed), buildings damaged in the 2010 flood
  if(WS&&showDM){const ring=r=>{r.forEach((p,i)=>{const [x,y]=screen(p[0],p[1]);i?cx.lineTo(x,y):cx.moveTo(x,y)});cx.closePath()};
   const A={low:.10,medium:.18,high:.30};
   for(const a of WS.affected){cx.fillStyle='rgba(90,169,255,'+(A[a.level]||.12)+')';cx.beginPath();for(const pg of a.polys)for(const r of pg)ring(r);cx.fill('evenodd')}
   cx.strokeStyle='rgba(90,169,255,.55)';cx.lineWidth=1;cx.beginPath();for(const pg of WS.flood_extent)for(const r of pg)ring(r);cx.stroke();
   const ln=(rs,dash,w)=>{cx.setLineDash(dash);cx.lineWidth=w;cx.strokeStyle='#5aa9ff';cx.beginPath();for(const r of rs)r.forEach((p,i)=>{const [x,y]=screen(p[0],p[1]);i?cx.lineTo(x,y):cx.moveTo(x,y)});cx.stroke();cx.setLineDash([])};
   ln(WS.hidden,[7,5],2);ln(WS.visible,[],3);
   for(const d of WS.damaged_2010){const [x,y]=screen(d.p[0],d.p[1]);if(!near(x,y,8))continue;cx.fillStyle='#5aa9ff';cx.strokeStyle='#0e0e0e';cx.lineWidth=1;cx.beginPath();cx.moveTo(x,y-6);cx.lineTo(x+6,y);cx.lineTo(x,y+6);cx.lineTo(x-6,y);cx.closePath();cx.fill();cx.stroke()}}
  if(DM&&showDM)for(const g of DM.g){if(g.status!=='threatened'&&g.gone>upTo)continue;cx.beginPath();for(const r of g.rings){r.forEach((p,i)=>{const [x,y]=screen(p[0],p[1]);i?cx.lineTo(x,y):cx.moveTo(x,y)});cx.closePath()}if(g.status==='threatened'){cx.setLineDash([5,4]);cx.strokeStyle='rgba(255,77,36,'+(0.55+0.45*Math.sin(t/300))+')';cx.lineWidth=1.6;cx.stroke();cx.setLineDash([]);continue}const col=PH[g.ph]?.col||'#ff4d24';cx.fillStyle=col+'b0';cx.fill('evenodd');cx.strokeStyle=col;cx.lineWidth=1.4;cx.stroke();
   // tiny cities: keep a visible mark when the polygon is under a few pixels
   const [x0,y0]=screen(g.b[0],g.b[3]),[x1,y1]=screen(g.b[2],g.b[1]);if(x1-x0<5){cx.fillStyle=PH[g.ph]?.col||'#ff4d24';cx.beginPath();cx.arc((x0+x1)/2,(y0+y1)/2,2.2,0,7);cx.fill()}}
  // 1:500 frame proposed for exercise 2.1: the four sites cleared 2023-2026 beside the still-visible stretch of the wadi
  // (D0230, D0234, D0231, D0232); 420 x 297 m = one A1 sheet at 1:500. Carrieres Centrales kept as a reference square.
  if(DM&&showDM){const ar=Locale.language==='ar',ids=['D0230','D0234','D0231','D0232'],gs=ids.map(i=>DM.g.find(z=>z.id===i)).filter(Boolean);
   const box=(cxw,cyw,hw,hh,lab)=>{const [x0,y0]=screen(cxw-hw,cyw+hh),[x1,y1]=screen(cxw+hw,cyw-hh);if(!near((x0+x1)/2,(y0+y1)/2,x1-x0))return;
    cx.strokeStyle='#f4f2ec';cx.lineWidth=1.6;cx.setLineDash([6,4]);cx.strokeRect(x0,y0,x1-x0,y1-y0);cx.setLineDash([]);
    cx.font='600 12px system-ui,sans-serif';cx.fillStyle='#f4f2ec';cx.textBaseline='bottom';cx.fillText(lab,x0,y0-4)};
   if(gs.length){const mx=gs.reduce((a,g)=>a+(g.b[0]+g.b[2])/2,0)/gs.length,my=gs.reduce((a,g)=>a+(g.b[1]+g.b[3])/2,0)/gs.length;
    box(mx,my,210,148.5,'1:500 · A1 · '+(ar?'ضفة الوادي الظاهر · 2023–2026':'bank of the visible wadi · 2023–2026'))}
   box(3495,17598,100,100,'1:500 · '+(ar?'مرجع: كاريان سنطرال':'ref: Carrières Centrales'))}
  // threatened: red, pulsing
  for(const s of T.threatened){const [x,y]=screen(s.x,s.y),R=Math.max(10,s.r*view.s);if(!near(x,y,R))continue;
   for(let k=0;k<2;k++){const ph=(((t/2400)+k/2+Math.abs(s.x%7)/7)%1+1)%1,rr=R*(.6+ph*1.4);cx.strokeStyle=`rgba(255,77,36,${(1-ph)*.75})`;cx.lineWidth=1.5;cx.setLineDash(s.approx?[4,4]:[]);cx.beginPath();cx.arc(x,y,rr,0,7);cx.stroke()}
   cx.setLineDash([]);cx.fillStyle='#ff4d24';cx.beginPath();cx.arc(x,y,3,0,7);cx.fill()}
  // incidents: a small triangle (filled = collapse, outline = controversy)
  for(const s of T.incidents){const [x,y]=screen(s.x,s.y);if(!near(x,y,10))continue;cx.beginPath();cx.moveTo(x,y-8);cx.lineTo(x+7,y+5);cx.lineTo(x-7,y+5);cx.closePath();
   if(s.kind==='controversy'){cx.strokeStyle='#f4f2ec';cx.lineWidth=1.4;cx.stroke()}else{cx.fillStyle='#f4f2ec';cx.fill();cx.strokeStyle='#0e0e0e';cx.lineWidth=1;cx.stroke()}}}
 function hit(px,py){if(!T||!on||window.Ex13World)return null;
  if(WS&&showDM)for(const d of WS.damaged_2010){const [x,y]=screen(d.p[0],d.p[1]);if(Math.hypot(px-x,py-y)<9){const all=WS.damaged_2010.filter(q=>q.p[0]===d.p[0]&&q.p[1]===d.p[1]);return{ar:'تضرّر في فيضان 30 نوفمبر 2010 · '+all.map(q=>q.name_ar).join(' · '),en:'Damaged in the flood of 30 Nov 2010 · '+all.map(q=>q.name_fr).join(' · '),src:d.source+' · '+d.precision}}}
  for(const s of T.incidents){const [x,y]=screen(s.x,s.y);if(Math.hypot(px-x,py-y)<10)return s}
  for(const s of T.threatened){const [x,y]=screen(s.x,s.y);if(Math.hypot(px-x,py-y)<Math.max(10,s.r*view.s))return s}
  if(DM&&showDM){const [wx,wy]=world(px,py);for(const g of DM.g){if(g.status!=='threatened'&&g.gone>upTo)continue;const [x0,y0]=screen(g.b[0],g.b[3]),[x1,y1]=screen(g.b[2],g.b[1]);if(px>=x0-4&&px<=x1+4&&py>=y0-4&&py<=y1+4){const ar=Locale.language==='ar',ty=TY[g.type]||TY.slum,ph=PH[g.ph]||PH[2];if(g.status==='threatened')return{ar:`مهدد بالهدم · ${g.ha.toFixed(2)} هكتار`,en:`Threatened with demolition · ${g.ha.toFixed(2)} ha`,src:(g.source?g.source+' · ':'')+'Esri Wayback '+(DM.meta.releases?.[2026]||'2026')};return{ar:`هُدم بين ${g.before} و${g.gone} · ${ty[0]} · ${g.ha.toFixed(2)} هكتار · ${ph.ar}`,en:`Demolished between ${g.before} and ${g.gone} · ${ty[1]} · ${g.ha.toFixed(2)} ha · ${ph.en}`,src:(g.source?g.source+' · ':'')+'Esri Wayback '+(DM.meta.releases?.[g.before]||g.before)+' vs '+(DM.meta.releases?.[g.gone]||g.gone)+' · checked by eye'}}}}
  for(const s of T.demolished){if(s.rings){const [wx,wy]=world(px,py);let c=false;for(const r of s.rings)for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>wy)!==(b[1]>wy)&&wx<(b[0]-a[0])*(wy-a[1])/(b[1]-a[1])+a[0])c=!c}if(c)return s}else{const [x,y]=screen(s.x,s.y);if(Math.hypot(px-x,py-y)<Math.max(7,s.r*view.s))return s}}
  return null}
 // the demolition gets its own entry in the menu: the scan with its reviewed results
 document.addEventListener('click',e=>{if(!e.target.closest('[data-demolition]'))return;e.preventDefault();e.stopPropagation();if(typeof setMenu==='function')setMenu(false);if(window.Ex13?.active)Ex13.close();window.ChangeScan?.openStudy()},true);
 return{hit,set visible(v){on=v},get demolitions(){return DM},get upTo(){return upTo},set upTo(y){upTo=y},hitSite(px,py){if(!DM||!showDM||window.Ex13World)return null;const [wx,wy]=world(px,py);let best=null;for(const g of DM.g){if(g.status!=='threatened'&&g.gone>upTo)continue;if(wx<g.b[0]||wx>g.b[2]||wy<g.b[1]||wy>g.b[3])continue;let c=false;for(const r of g.rings)for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>wy)!==(b[1]>wy)&&wx<(b[0]-a[0])*(wy-a[1])/(b[1]-a[1])+a[0])c=!c}if(c&&(!best||g.area<best.area))best=g}return best},get showDemolition(){return showDM},set showDemolition(v){showDM=v}}})();