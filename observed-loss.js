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
window.Threats=(()=>{let T=null,cv=null,cx=null,on=true,DM=null;fetch('data/threatened.json?v=2').then(r=>r.ok?r.json():null).then(d=>{T=d;start()}).catch(()=>{});
 // the reviewed scan (data/demolition.json): confirmed demolitions 2014–2026 as gold outlines, undecided dashed, from the first view
 // the precise scan (data/demolition_v3.json, reviewed by eye) is added on top when it exists
 Promise.all(['data/demolition.json?v=1','data/demolition_v3.json?v='+Date.now().toString().slice(0,7)].map(u=>fetch(u).then(r=>r.ok?r.json():null).catch(()=>null))).then(([d1,d3])=>{const d=d1||d3;if(!d)return;if(d1&&d3)d.groups=[...d1.groups,...d3.groups];const sm=r=>{let p=r.slice(0,-1);for(let k=0;k<2;k++){const q=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];q.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75])}p=q}return[...p,p[0]]};
  DM={meta:d,g:d.groups.filter(g=>g.status==='confirmed'||g.status==='unsure').map(g=>{const rings=g.rings.map(sm);let a=0;for(const r of g.rings){let s=0;for(let i=0;i<r.length-1;i++)s+=r[i][0]*r[i+1][1]-r[i+1][0]*r[i][1];a+=Math.abs(s/2)}const xs=rings.flat();return{rings,st:g.status,ha:a/1e4,b:[Math.min(...xs.map(p=>p[0])),Math.min(...xs.map(p=>p[1])),Math.max(...xs.map(p=>p[0])),Math.max(...xs.map(p=>p[1]))]}})}}).catch(()=>{});
 function start(){if(cv||!T)return;cv=document.createElement('canvas');cv.id='threatLayer';document.body.appendChild(cv);cx=cv.getContext('2d');const fitC=()=>{cv.width=innerWidth;cv.height=innerHeight};fitC();addEventListener('resize',fitC);requestAnimationFrame(loop)}
 const near=(x,y,R)=>x>-R*3&&y>-R*3&&x<cv.width+R*3&&y<cv.height+R*3;
 function loop(t){requestAnimationFrame(loop);if(!cx)return;cx.clearRect(0,0,cv.width,cv.height);if(!on||!T||window.Ex13World||typeof screen!=='function'||typeof view==='undefined')return;
  // demolished: gold — traced outline where we have one, else a dashed circle at the documented place
  for(const s of T.demolished){cx.strokeStyle='#d4a73a';cx.fillStyle='rgba(212,167,58,.28)';cx.lineWidth=1.4;
   if(s.rings){cx.beginPath();for(const r of s.rings)r.forEach((p,i)=>{const [x,y]=screen(p[0],p[1]);i?cx.lineTo(x,y):cx.moveTo(x,y)});cx.closePath();cx.fill('evenodd');cx.stroke()}
   else{const [x,y]=screen(s.x,s.y),R=Math.max(7,s.r*view.s);if(!near(x,y,R))continue;cx.setLineDash([4,3]);cx.beginPath();cx.arc(x,y,R,0,7);cx.fill();cx.stroke();cx.setLineDash([])}}
  if(DM)for(const g of DM.g){cx.beginPath();for(const r of g.rings)r.forEach((p,i)=>{const [x,y]=screen(p[0],p[1]);i?cx.lineTo(x,y):cx.moveTo(x,y)});cx.closePath();const ok=g.st==='confirmed';cx.fillStyle=ok?'rgba(212,167,58,.42)':'rgba(212,167,58,.12)';cx.fill('evenodd');cx.strokeStyle='#d4a73a';cx.lineWidth=ok?1.4:1;cx.setLineDash(ok?[]:[3,3]);cx.stroke();cx.setLineDash([]);
   // tiny cities: keep a visible mark when the polygon is under a few pixels
   const [x0,y0]=screen(g.b[0],g.b[3]),[x1,y1]=screen(g.b[2],g.b[1]);if(x1-x0<5){cx.fillStyle='#d4a73a';cx.beginPath();cx.arc((x0+x1)/2,(y0+y1)/2,2.2,0,7);cx.fill()}}
  // threatened: red, pulsing
  for(const s of T.threatened){const [x,y]=screen(s.x,s.y),R=Math.max(10,s.r*view.s);if(!near(x,y,R))continue;
   for(let k=0;k<2;k++){const ph=(((t/2400)+k/2+Math.abs(s.x%7)/7)%1+1)%1,rr=R*(.6+ph*1.4);cx.strokeStyle=`rgba(255,77,36,${(1-ph)*.75})`;cx.lineWidth=1.5;cx.setLineDash(s.approx?[4,4]:[]);cx.beginPath();cx.arc(x,y,rr,0,7);cx.stroke()}
   cx.setLineDash([]);cx.fillStyle='#ff4d24';cx.beginPath();cx.arc(x,y,3,0,7);cx.fill()}
  // incidents: a small triangle (filled = collapse, outline = controversy)
  for(const s of T.incidents){const [x,y]=screen(s.x,s.y);if(!near(x,y,10))continue;cx.beginPath();cx.moveTo(x,y-8);cx.lineTo(x+7,y+5);cx.lineTo(x-7,y+5);cx.closePath();
   if(s.kind==='controversy'){cx.strokeStyle='#f4f2ec';cx.lineWidth=1.4;cx.stroke()}else{cx.fillStyle='#f4f2ec';cx.fill();cx.strokeStyle='#0e0e0e';cx.lineWidth=1;cx.stroke()}}}
 function hit(px,py){if(!T||!on||window.Ex13World)return null;
  for(const s of T.incidents){const [x,y]=screen(s.x,s.y);if(Math.hypot(px-x,py-y)<10)return s}
  for(const s of T.threatened){const [x,y]=screen(s.x,s.y);if(Math.hypot(px-x,py-y)<Math.max(10,s.r*view.s))return s}
  if(DM){const [wx,wy]=world(px,py);for(const g of DM.g){const [x0,y0]=screen(g.b[0],g.b[3]),[x1,y1]=screen(g.b[2],g.b[1]);if(px>=x0-4&&px<=x1+4&&py>=y0-4&&py<=y1+4){const ar=Locale.language==='ar';return{ar:(g.st==='confirmed'?'هدم مؤكَّد':'تغيّر غير محسوم')+' بين 2014 و2026 · '+g.ha.toFixed(2)+' هكتار',en:(g.st==='confirmed'?'Confirmed demolition':'Undecided change')+' 2014–2026 · '+g.ha.toFixed(2)+' ha',src:'Scan of Esri Wayback '+DM.meta.pair.map(p=>p.release||p.id).join(' vs ')+', reviewed by hand'}}}}
  for(const s of T.demolished){if(s.rings){const [wx,wy]=world(px,py);let c=false;for(const r of s.rings)for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>wy)!==(b[1]>wy)&&wx<(b[0]-a[0])*(wy-a[1])/(b[1]-a[1])+a[0])c=!c}if(c)return s}else{const [x,y]=screen(s.x,s.y);if(Math.hypot(px-x,py-y)<Math.max(7,s.r*view.s))return s}}
  return null}
 // the demolition gets its own entry in the menu: the scan with its reviewed results
 document.addEventListener('click',e=>{if(!e.target.closest('[data-demolition]'))return;e.preventDefault();e.stopPropagation();if(typeof setMenu==='function')setMenu(false);if(window.Ex13?.active)Ex13.close();window.ChangeScan?.openStudy()},true);
 return{hit,set visible(v){on=v},get demolitions(){return DM}}})();