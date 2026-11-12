'use strict';
// DemoReview: demolition mapping by a person + AI (WORKFLOW_رصد_الهدم.md).
//  · coverage: the city cut into 1 km cells, visited one by one and ticked; hints = automatic candidates (circles)
//    and documented press sites (markers) — never shapes.
//  · outline: clicks inside a group of houses on the BEFORE image → SAM (in this browser) cuts it; the pieces are
//    merged into one envelope over the alleys (closing 8 m, holes filled) and simplified to straight lines (1 m).
//    Shift+click = exclude. A vertex can be dragged afterwards.
//  · time: a year bar flips the imagery 2015 → 2026; the reviewer picks the first year the houses are gone.
//  · check: inside the outline the newest image must have lost the roof texture, else a warning.
//  · save: data/demolition_v4.json (dev server) + this browser; only reviewed sites ever reach the public layer.
window.DemoReview=(()=>{
 const DEV=/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
 const L=(ar,en)=>Locale.language==='ar'?ar:en;
 const YEARS=[2015,2018,2021,2023,2024,2025,2026];
 const PHASES=[{to:2021,col:'#6e4a3a',ar:'2015–2021 · تباطؤ',en:'2015–2021 · slow'},{to:2023,col:'#c4562e',ar:'2021–2023 · التسارع الأول',en:'2021–2023 · first acceleration'},{to:9999,col:'#ff4d24',ar:'2024–2026 · موجة المونديال',en:'2024–2026 · World Cup wave'}];
 const phaseOf=y=>PHASES.findIndex(p=>y<=p.to);
 const TYPES=[['slum',['تفكيك صفيح','slum clearance']],['project',['إخلاء لمشروع','clearance for a project']],['collapse',['انهيار','collapse']],['rebuild',['هدم وإعادة بناء','demolished and rebuilt']]];
 // status: gone = demolished (counted, coloured by phase) · standing = slum still there (mapped to know, never counted) · threatened = announced / expected
 const STATUS=[['gone',['هُدم','demolished'],null],['standing',['صفيح قائم · لم يُهدم','standing slum · not demolished'],'#e8e6df'],['threatened',['مهدد بالهدم','threatened'],'#ffd23c']];
 const isGone=s=>(s.status||'gone')==='gone';
 // older saves wrote 'not demolished, just so we know' in the source box: move those into their own status
 function migrate(){for(const s of sites){if(s.status)continue;const t=(s.source||'')+' '+(s.note||'');s.status=/مهدد/.test(t)?'threatened':/لم يهدم|لم يُهدم/.test(t)?'standing':'gone';
  if(s.status==='gone'&&s.type==='slum'&&/المحج|الحج الملكي|ليس صفيح|مش صفيح|لا يبدو صفيح/.test(t))s.type='project';if(s.status!=='gone'&&!s.note){s.note=s.source;s.source=''}}}
 const STORE='casa-demo-review-v1',FILE='demolition_v4.json',CELL=1000;
 let cells=[],done={},sites=[],cur=0,yi=0,src={},hints=[],documented=[],ready=false,busy=false,msg='',adding=false,draft=null,sel=-1;
 let drag=null,down=null,embCache=null,sug={},space=false,hover=null;

 // ---------- state ----------
 function load(){try{const s=JSON.parse(localStorage.getItem(STORE)||'null');if(s){done=s.done||{};sites=s.sites||[];cur=s.cur||0;sug=s.sug||{}}}catch{}}
 let saveT=0;function save(){try{localStorage.setItem(STORE,JSON.stringify({done,sites,cur,sug}))}catch{}
  if(DEV&&sites.length>=fileN){clearTimeout(saveT);saveT=setTimeout(()=>fetch('/__save/'+FILE,{method:'POST',body:JSON.stringify(exportData())}).catch(()=>{}),800)}}
 function exportData(){const ha=k=>Math.round(sites.filter(s=>isGone(s)&&phaseOf(s.gone)===k).reduce((a,s)=>a+s.area,0)/1e3)/10;
  return{generated:new Date().toISOString().slice(0,10),workflow:'WORKFLOW_رصد_الهدم.md — person + SAM, reviewed by eye',years:YEARS,phases:PHASES.map((p,k)=>({...p,ha:ha(k)})),
   releases:Object.fromEntries(Object.entries(src).map(([y,s])=>[y,s.release])),cellsDone:Object.keys(done).length,cellsTotal:cells.length,done,sug,
   sites:sites.map(s=>({id:s.id,ring:s.ring,holes:s.holes||[],area:Math.round(s.area),before:s.before,gone:s.gone,status:s.status||'gone',type:s.type,confidence:s.confidence,source:s.source||'',note:s.note||'',cell:s.cell,warn:s.warn||''}))}}
 let fileN=1e9;/* writes wait until the file is read; the saved file wins when it holds more sites than this browser, so an old browser copy never overwrites newer work */
 async function fromFile(){try{const r=await fetch('data/'+FILE+'?v='+Date.now());if(r.ok){const d=await r.json();fileN=(d.sites||[]).length;if(fileN>sites.length){sites=d.sites;done=d.done||{};sug=d.sug||{}}}}catch{}fileN=0}

 // ---------- setup: imagery per year, the grid, hints ----------
 async function setup(){if(ready)return;msg=L('جارٍ التحضير…','Preparing…');refresh('demoReview');
  if(Imagery.sources.filter(s=>s.release).length<2)await Imagery.loadCatalog();
  const rel=Imagery.sources.filter(s=>s.release).sort((a,b)=>a.release.localeCompare(b.release));
  for(const y of YEARS){const inYear=rel.filter(s=>s.release.startsWith(String(y)));src[y]=inYear.at(-1)||rel.filter(s=>s.release<String(y+1)).at(-1)}
  const bnd=await fetch('data/casablanca-boundary.geojson').then(r=>r.json()),city=bnd.geometry.coordinates.map(r=>r.map(p=>CasaGeo.forward(...p)));
  const xs=city.flat().map(p=>p[0]),ys=city.flat().map(p=>p[1]),x0=Math.floor(Math.min(...xs)/CELL)*CELL,y1=Math.ceil(Math.max(...ys)/CELL)*CELL,x1=Math.max(...xs),y0=Math.min(...ys);
  // a cell is kept only if it holds buildings (OSM + Microsoft): the administrative boundary runs out into the sea
  const cnt=new Map(),add=b=>{const cx=(b.b[0]+b.b[2])/2,cy=(b.b[1]+b.b[3])/2,k=Math.floor((cx-x0)/CELL)+','+Math.floor((y1-cy)/CELL);cnt.set(k,(cnt.get(k)||0)+1)};
  for(const b of (window.DNA?.buildings||[]))add(b);const seenMs=new Set();if(typeof msGrid!=='undefined')for(const arr of msGrid.values())for(const b of arr)if(!seenMs.has(b)){seenMs.add(b);add(b)}
  cells=[];for(let y=y1;y>y0;y-=CELL)for(let x=x0;x<x1;x+=CELL){const pts=[[x+CELL/2,y-CELL/2],[x+5,y-5],[x+CELL-5,y-5],[x+5,y-CELL+5],[x+CELL-5,y-CELL+5]];
   const k=Math.floor((x-x0)/CELL)+','+Math.floor((y1-y)/CELL);
   if(pts.some(p=>ChangeGeometry.contains(city,...p))&&(cnt.get(k)||0)>=5)cells.push({id:'C'+String(cells.length+1).padStart(3,'0'),b:[x,y-CELL,x+CELL,y]})}
  const cand=(window.PreciseScan?.candidates||[]).filter(c=>c.rings?.length&&c.status!=='rejected');
  hints=cand.map(c=>[(c.b[0]+c.b[2])/2,(c.b[1]+c.b[3])/2,Math.max(15,Math.sqrt(c.area||400)/2)]);
  try{const th=await fetch('data/threatened.json').then(r=>r.json());documented=[...th.demolished.map(d=>({kind:'demolished',p:d.rings?centroid(d.rings[0]):[d.x,d.y],t:L(d.ar,d.en),src:d.src})),
   ...th.threatened.map(d=>({kind:'threatened',p:[d.x,d.y],t:L(d.ar,d.en),src:d.src}))]}catch{}
  ready=true;cur=Math.min(cur,cells.length-1);msg='';showYear(0);goCell(cur)}
 // suggestions = the automatic outlines (SAM, zoom 19) whose centre lies in the cell; the reviewer says yes / no / redraw
 const skey=c=>c.b.map(v=>Math.round(v)).join(',');
 let learned=null;fetch('data/demolition_learned.json?v='+Date.now()).then(r=>r.ok?r.json():null).then(d=>{learned=d;if(windows.has('demoReview')){refresh('demoReview');render()}}).catch(()=>{});
 const inRing=(x,y,r)=>{let o=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [xi,yi]=r[i],[xj,yj]=r[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)o=!o}return o};
 const taken=k=>{const r=k.rings[0];let n=0,h=0;for(let i=0;i<r.length;i+=Math.max(1,r.length>>4)){n++;if(sites.some(st=>inRing(r[i][0],r[i][1],st.ring)))h++}const cx=(k.b[0]+k.b[2])/2,cy=(k.b[1]+k.b[3])/2;return sites.some(st=>inRing(cx,cy,st.ring))||h/n>0.5};
 function suggestions(){const c=cells[cur];if(!c)return[];if(learned?.candidates)return learned.candidates.filter(k=>k.cell===c.id&&!taken(k)).sort((a,b)=>(a.kind===b.kind?0:a.kind==='gone'?-1:1)||b.area-a.area);return(window.PreciseScan?.candidates||[]).filter(k=>{if(k.method!=='sam'||!k.rings?.length||k.area<150)return false;const x=(k.b[0]+k.b[2])/2,y=(k.b[1]+k.b[3])/2;return x>=c.b[0]&&x<c.b[2]&&y>=c.b[1]&&y<c.b[3]}).sort((a,b)=>b.area-a.area)}
 function openSug(){return suggestions().filter(k=>!sug[skey(k)])}
 function sugYes(){const k=openSug()[0];if(!k)return;sug[skey(k)]='yes';const lib=P(),ring=k.kind?k.rings[0]:k.rings.slice().sort((a,b)=>Math.abs(lib.ringArea(b))-Math.abs(lib.ringArea(a)))[0];
  adding=true;draft={pos:[],neg:[],ring:ring.map(q=>[q[0],q[1]]),holes:k.kind?k.rings.slice(1):[],gone:null,status:k.kind==='standing'?'standing':'gone',type:'slum',parts:{},fromSug:skey(k)};draft.area=Math.abs(lib.ringArea(draft.ring));
  msg=L('اختاري أول سنة اختفت فيها البيوت ثم Enter','Pick the first year the houses are gone, then Enter');save();refresh('demoReview');render()}
 function nextSug(){const ids=new Set((learned?.candidates||[]).filter(k=>!taken(k)&&!sug[skey(k)]).map(k=>k.cell));for(let i=1;i<=cells.length;i++){const k=(cur+i)%cells.length;if(ids.has(cells[k].id)&&!done[cells[k].id]){goCell(k);return}}msg=L('ما في اقتراحات باقية','No suggestions left');refresh('demoReview')}
 function sugNo(){const k=openSug()[0];if(!k)return;sug[skey(k)]='no';save();msg=L('رُفض الاقتراح','Suggestion rejected');refresh('demoReview');render()}
 function startPen(){adding=true;draft={pen:[],ring:null,holes:[],pos:[],neg:[],gone:null,type:'slum',parts:{}};canvas.style.cursor='crosshair';
  msg=L('القلم: اضغطي على زوايا المنطقة واحدة واحدة · Enter يسكّر · Backspace يتراجع · المسافة+سحب يحرّك الخريطة','Pen: click the corners one by one · Enter closes · Backspace undoes · Space+drag pans');refresh('demoReview');render()}
 async function closePen(){if(!draft?.pen||draft.pen.length<3)return;const lib=P();draft.ring=[...draft.pen,draft.pen[0]].map(q=>[Math.round(q[0]*10)/10,Math.round(q[1]*10)/10]);draft.area=Math.abs(lib.ringArea(draft.ring));draft.pen=null;
  msg=L('اختاري أول سنة اختفت فيها البيوت ثم Enter','Pick the first year the houses are gone, then Enter');refresh('demoReview');render();draft.warn=await check(draft.ring);refresh('demoReview')}
 const centroid=r=>[r.reduce((a,p)=>a+p[0],0)/r.length,r.reduce((a,p)=>a+p[1],0)/r.length];

 // ---------- navigation ----------
 function showYear(i){yi=Math.max(0,Math.min(YEARS.length-1,i));const s=src[YEARS[yi]];if(!s)return;
  try{const S=Imagery.state;S.enabled=true;S.swipe=false;S.left=s;S.right=s;Imagery.sync?.()}catch{}refresh('demoReview');render()}
 function goCell(i){if(!cells.length)return;for(const u of PQ)PSEEN.delete(u);PQ.length=0;cur=(i+cells.length)%cells.length;const b=cells[cur].b;fit([b[0]-60,b[1]-60,b[2]+60,b[3]+60]);save();refresh('demoReview');render();prefetch(cur,true);prefetch((cur+1)%cells.length,false)}
 // every year of a cell is fetched ahead (zoom 17–18, the levels the map shows at cell scale) into the browser cache,
 // so flipping the years is instant; six requests at a time, the current cell first
 const PQ=[],PSEEN=new Set();let pRun=0;
 function prefetch(ci,here){const c=cells[ci];if(!c)return;for(const z of here?[17,18]:[17])for(const y of YEARS){if(z===18&&y!==YEARS[0]&&y!==YEARS.at(-1)&&y!==YEARS[yi])continue;const s=src[y];if(!s)continue;const [x0,y0,x1,y1]=CasaGeo.tileRange([c.b[0]-60,c.b[1]-60,c.b[2]+60,c.b[3]+60],z);
   for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){const u=s.tile.replace('{z}',z).replace('{x}',tx).replace('{y}',ty);if(!PSEEN.has(u)){PSEEN.add(u);PQ.push(u)}}}pump()}
 function pump(){while(pRun<3&&PQ.length){const u=PQ.shift(),im=new Image();pRun++;im.onload=im.onerror=()=>{pRun--;pump()};im.crossOrigin='anonymous';im.src=u}}
 function markDone(){if(!cells[cur])return;done[cells[cur].id]=new Date().toISOString().slice(0,10);const nx=cells.findIndex((c,i)=>i>cur&&!done[c.id]);goCell(nx>=0?nx:cur+1)}

 // ---------- outline with SAM on the shown (before) image ----------
 const P=()=>window.PreciseScan.lib;
 function toPx(m,x,y){const{RZ,DS,TS}=P();const [tx,ty]=CasaGeo.tileXY(...CasaGeo.inverse(x,y),RZ);return[(tx-m.x0)*TS/DS,(ty-m.y0)*TS/DS]}
 // one SAM cut per positive click (260 m around it, with the negative clicks that fall inside); the cuts are merged
 // on a 0.5 m grid, closed over the alleys (8 m), holes filled, then traced and simplified — one polygon per group.
 const embs=new Map();
 async function cutAt(p,lib,before,object=false){
  const ext=130,box=[p[0]-ext,p[1]-ext,p[0]+ext,p[1]+ext],key=before.id+box.map(Math.round).join(',');
  let E=embs.get(key);
  if(!E){const m=await lib.mosaicZ(before,box),{W,H}=m,{T,model,processor}=await lib.sam(),rgb=new Uint8ClampedArray(W*H*3);for(let i=0;i<W*H*3;i++)rgb[i]=m.px[i];
   const img=new T.RawImage(rgb,W,H,3),inp=await processor(img),emb=await model.get_image_embeddings(inp);E={m,W,H,inp,emb,T,model,processor};embs.set(key,E);if(embs.size>12)embs.delete(embs.keys().next().value)}
  const{m,W,H,inp,emb,T,model,processor}=E,n=W*H,[rh,rw]=inp.reshaped_input_sizes[0],sx=rw/W,sy=rh/H;
  const inside=q=>q[0]>box[0]&&q[0]<box[2]&&q[1]>box[1]&&q[1]<box[3];
  const pts=[[...toPx(m,...p),1]];  // exclusions never change the cuts: they are subtracted afterwards
  const ip=new T.Tensor('float32',pts.flatMap(([x,y])=>[x*sx,y*sy]),[1,1,pts.length,2]),il=new T.Tensor('int64',BigInt64Array.from(pts.map(q=>BigInt(q[2]))),[1,1,pts.length]);
  const out=await model({...emb,input_points:ip,input_labels:il}),masks=await processor.post_process_masks(out.pred_masks,inp.original_sizes,inp.reshaped_input_sizes),md=masks[0].data,sc=out.iou_scores.data,K=md.length/n;
  // the mask that holds the click and none of the exclusions: the largest (a whole group), weighted by SAM's confidence
  let best=-1,bs=-1;for(let k=0;k<K;k++){let a=0;for(let i=0;i<n;i+=4)if(md[k*n+i])a++;a*=4;
   const ok=pts.every(([x,y,l])=>{const i=Math.round(y)*W+Math.round(x);return l?md[k*n+i]:!md[k*n+i]});const v_=object?sc[k]:a*(0.5+sc[k]);if(ok&&a<n*.75&&v_>bs){bs=v_;best=k}/* the group, not one roof */}
  if(best<0)return null;
  const cells=[];for(let v=0;v<H;v+=2)for(let u=0;u<W;u+=2)if(md[best*n+v*W+u])cells.push([u/2,v/2]);
  const toW=(u,v)=>CasaGeo.tilePoint(m.x0+u*2*lib.DS/lib.TS,m.y0+v*2*lib.DS/lib.TS,lib.RZ);
  return lib.outline(cells,toW,0.6,false)}
 async function segment(){if(!draft||!draft.pos.length)return;busy=true;msg=L('SAM يقص الحد…','SAM is cutting the outline…');refresh('demoReview');
  try{const lib=P(),before=src[YEARS[yi]];
   if(draft.srcId!==before.id){draft.parts={};draft.negParts={};draft.srcId=before.id}
   for(const p of draft.pos){const k=p.join(',');if(!draft.parts[k]){const r=await cutAt(p,lib,before);draft.parts[k]=r||[]}}
   const keys=new Set(draft.pos.map(p=>p.join(',')));for(const k of Object.keys(draft.parts))if(!keys.has(k))delete draft.parts[k];
   draft.negParts=draft.negParts||{};for(const q of draft.neg){const k=q.join(',');if(!draft.negParts[k])draft.negParts[k]=(await cutAt(q,lib,before,true))||[]}
   const negRings=draft.neg.flatMap(q=>draft.negParts[q.join(',')]||[]);
   const rings=Object.values(draft.parts).flat();if(!rings.length)throw Error(L('لم يُعثر على مجموعة تحت الضغطة','nothing found under the click'));
   // merge: raster 0.5 m over all cuts, close 8 m, fill holes, keep what holds a click, trace, simplify 1 m
   const R=0.5,all=rings.flat(),x0=Math.min(...all.map(q=>q[0]))-20,y0=Math.min(...all.map(q=>q[1]))-20,x1=Math.max(...all.map(q=>q[0]))+20,y1=Math.max(...all.map(q=>q[1]))+20;
   const W=Math.ceil((x1-x0)/R),H=Math.ceil((y1-y0)/R),cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d',{willReadFrequently:true});
   g.setTransform(1/R,0,0,-1/R,-x0/R,y1/R);g.fillStyle='#fff';g.beginPath();for(const r of rings){r.forEach((q,j)=>j?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]));g.closePath()}g.fill('nonzero');
   const px=g.getImageData(0,0,W,H).data;let M=new Uint8Array(W*H);for(let i=0;i<W*H;i++)M[i]=px[i*4]>127?1:0;
   M=lib.closeMask(M,W,H,16);lib.fillHoles(M,W,H,W*H);
   if(negRings.length){g.save();g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,W,H);g.restore();g.beginPath();for(const r of negRings){r.forEach((q,j)=>j?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]));g.closePath()}g.fill('nonzero');
    const nd=g.getImageData(0,0,W,H).data;for(let i=0;i<W*H;i++)if(nd[i*4]>127)M[i]=0}  // a standing building stays out
   const seen=new Uint8Array(W*H),st=[];for(const p of draft.pos){const u=Math.floor((p[0]-x0)/R),v=Math.floor((y1-p[1])/R),i=v*W+u;if(M[i]&&!seen[i]){seen[i]=1;st.push(i)}}
   let cnt=0;while(st.length){const j=st.pop(),x=j%W,y=j/W|0;cnt++;for(const q of[x>0?j-1:-1,x<W-1?j+1:-1,y>0?j-W:-1,y<H-1?j+W:-1])if(q>=0&&M[q]&&!seen[q]){seen[q]=1;st.push(q)}}
   if(!cnt)throw Error(L('الضغطة خارج المجموعة','the click is outside the group'));
   const f=Math.max(1,Math.ceil(Math.sqrt(cnt/25000))),Wc=Math.ceil(W/f),Hc=Math.ceil(H/f),comp=[];
   for(let v=0;v<Hc;v++)for(let u=0;u<Wc;u++){let a=0,t=0;for(let y=v*f;y<Math.min(H,v*f+f);y++)for(let x=u*f;x<Math.min(W,u*f+f);x++){t++;if(seen[y*W+x])a++}if(a*2>=t)comp.push([u,v])}
   const toW=(u,v)=>[Math.round((x0+u*f*R)*10)/10,Math.round((y1-v*f*R)*10)/10];
   const out=lib.outline(comp,toW,Math.max(1.0,f*R),false);if(!out.length)throw Error('outline');
   out.sort((a,b)=>Math.abs(lib.ringArea(b))-Math.abs(lib.ringArea(a)));const ring=out[0],holes=out.slice(1).filter(h=>ChangeGeometry.contains([ring],...h[0]));
   draft.ring=ring;draft.holes=holes;draft.area=Math.abs(lib.ringArea(ring))-holes.reduce((a,h)=>a+Math.abs(lib.ringArea(h)),0);draft.warn=await check(ring);
   msg=L(`الحد جاهز · ${(draft.area/1e4).toFixed(2)} هكتار. لو ناقص اضغطي داخل الجزء الناقص. ثم اختاري أول سنة اختفت فيها البيوت.`,`Outline ready · ${(draft.area/1e4).toFixed(2)} ha. If a part is missing, click inside it. Then pick the first year the houses are gone.`)}
  catch(e){msg=L('تعذّر القص: ','Could not cut: ')+e.message}finally{busy=false;refresh('demoReview');render()}}
 // newest image: has the roof texture inside the outline gone? (relative to the before image)
 async function check(ring){try{const lib=P(),b=window.PreciseScan.lib.bboxOf([ring]),box=[b[0]-10,b[1]-10,b[2]+10,b[3]+10];
   const [ma,mb]=await Promise.all([lib.mosaicZ(src[YEARS[yi]],box),lib.mosaicZ(src[YEARS.at(-1)],box)]),fa=lib.layersOf(ma.px,ma.W,ma.H),fb=lib.layersOf(mb.px,mb.W,mb.H);
   let ta=0,tb=0,k=0;for(let v=0;v<ma.H;v+=2)for(let u=0;u<ma.W;u+=2){const w=CasaGeo.tilePoint(ma.x0+u*lib.DS/lib.TS,ma.y0+v*lib.DS/lib.TS,lib.RZ);if(!ChangeGeometry.contains([ring],...w))continue;const i=v*ma.W+u;ta+=fa.dark[i];tb+=fb.dark[i];k++}
   if(!k)return'';const r=tb/Math.max(1e-6,ta);  // wall shadows: standing houses keep them (ratio ≈1), cleared ground loses them; the sharper 2026 imagery fools raw edges
   const clash=sites.some(s=>s!==draft&&overlap(window.PreciseScan.lib.bboxOf([s.ring]),b));
   return[r>.75&&tb/k>.04?L('تنبيه: الصورة الأحدث ما زالت تشبه مبانٍ هنا — تأكدي','Warning: the newest image still looks built here — check'):'',clash?L('يتداخل مع موقع مسجّل','overlaps a saved site'):''].filter(Boolean).join(' · ')}catch{return''}}
 function accept(){const st=draft?.status||'gone';if(!draft?.ring||(st==='gone'&&!draft.gone))return;const id='D'+String(sites.length+1).padStart(4,'0');
  sites.push({id,ring:draft.ring,holes:draft.holes||[],area:draft.area,before:st==='gone'?YEARS[Math.max(0,YEARS.indexOf(draft.gone)-1)]:null,gone:st==='gone'?draft.gone:null,status:st,type:draft.type||'slum',confidence:'observed',source:draft.source||'',note:draft.note||'',cell:cells[cur]?.id,warn:draft.warn||''});
  draft=null;adding=false;canvas.style.cursor='grab';save();msg=L(`حُفظ ${id}`,`Saved ${id}`);refresh('demoReview');render()}
 function startAdd(){adding=true;draft={pos:[],neg:[],ring:null,gone:null,type:'slum',parts:{},srcId:null};canvas.style.cursor='crosshair';msg=L('اضغطي داخل مجموعة البيوت على صورة «قبل» · Shift+ضغطة = استبعاد','Click inside the group of houses on the BEFORE image · Shift+click = exclude');refresh('demoReview');render()}
 function cancel(){draft=null;adding=false;canvas.style.cursor='grab';msg='';refresh('demoReview');render()}

 // ---------- map interaction ----------
 addEventListener('pointerdown',e=>{if(!windows.has('demoReview')||e.target.id!=='map')return;down=[e.clientX,e.clientY];
  if(adding&&!space&&e.button===0)e.stopImmediatePropagation();  // drawing: the click is for the outline, not for panning
  if(draft?.ring&&!busy){const w=world(e.clientX,e.clientY),k=draft.ring.findIndex(p=>Math.hypot(p[0]-w[0],p[1]-w[1])*view.s<7);if(k>=0){drag=k;e.stopImmediatePropagation()}}},true);
 addEventListener('pointermove',e=>{if(draft?.pen&&windows.has('demoReview')&&e.target.id==='map'){hover=world(e.clientX,e.clientY);render()}if(drag==null||!draft?.ring)return;const w=world(e.clientX,e.clientY);draft.ring[drag]=[Math.round(w[0]*10)/10,Math.round(w[1]*10)/10];if(drag===0)draft.ring[draft.ring.length-1]=draft.ring[0];e.stopImmediatePropagation();render()},true);
 addEventListener('pointerup',e=>{if(drag!=null){drag=null;draft.area=Math.abs(P().ringArea(draft.ring))-(draft.holes||[]).reduce((a,h)=>a+Math.abs(P().ringArea(h)),0);e.stopImmediatePropagation();refresh('demoReview');return}
  if(!adding||busy||!draft||e.target.id!=='map'||!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>4)return;e.stopImmediatePropagation();
  const w=world(e.clientX,e.clientY);
  if(draft.pen){const f=draft.pen[0];if(draft.pen.length>=3&&Math.hypot(w[0]-f[0],w[1]-f[1])*view.s<9){closePen();return}draft.pen.push(w);render();return}
  (e.shiftKey?draft.neg:draft.pos).push(w);segment()},true);
 document.addEventListener('keydown',e=>{if(!windows.has('demoReview')||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;const k=e.key;
  if(k===' '){space=true;canvas.style.cursor='grab';return}
  if((k==='y'||k==='Y')&&!draft){sugYes();e.preventDefault();return}if((k==='x'||k==='X')&&!draft){sugNo();e.preventDefault();return}if((k==='s'||k==='S')&&!draft){nextSug();e.preventDefault();return}if((k==='p'||k==='P')&&!draft?.ring){startPen();e.preventDefault();return}
  if(k==='Backspace'&&draft?.pen){draft.pen.pop();render();e.preventDefault();return}if(k==='Enter'&&draft?.pen){closePen();e.preventDefault();return}
  if(k==='ArrowRight'){showYear(yi+1);e.preventDefault()}else if(k==='ArrowLeft'){showYear(yi-1);e.preventDefault()}
  else if(k==='n'||k==='N'){markDone();e.preventDefault()}else if(k==='a'||k==='A'){startAdd();e.preventDefault()}
  else if(k==='Enter'&&draft?.ring&&draft.gone){accept();e.preventDefault()}else if(k==='Escape'&&draft){cancel();e.preventDefault()}},true);

 document.addEventListener('keyup',e=>{if(e.key===' '){space=false;if(adding)canvas.style.cursor='crosshair'}});
 // ---------- window ----------
 function content(){if(!ready)return`<p class="lead">${L('رصد الهدم','Demolition review')}</p><p role="status">${esc(msg||L('جارٍ التحضير…','Preparing…'))}</p>`;
  const c=cells[cur],nDone=Object.keys(done).length,inCell=sites.filter(s=>s.cell===c?.id),tot=k=>sites.filter(s=>isGone(s)&&phaseOf(s.gone)===k).reduce((a,s)=>a+s.area,0)/1e4;
  return`<p class="lead">${L('رصد الهدم · المربع','Demolition review · cell')} ${c?.id||''} <span class="tiny">(${cur+1}/${cells.length})</span></p>
  <p class="tiny">${L('المنجز','Done')} ${nDone}/${cells.length} · ${L('مواقع هدم','demolition sites')} ${sites.filter(isGone).length} · ${L('قائم','standing')} ${sites.filter(s=>s.status==='standing').length} · ${L('مهدد','threatened')} ${sites.filter(s=>s.status==='threatened').length} · ${PHASES.map((p,k)=>`<span style="color:${p.col}">■</span> ${tot(k).toFixed(1)} ha`).join(' ')}</p>
  <div class="menuGrid"><button class="action" data-dr-prev>‹ ${L('السابق','prev')}</button><button class="action" data-dr-next>${L('التالي','next')} ›</button>
   <button class="action ${c&&done[c.id]?'on':''}" data-dr-done>✓ ${L('خلصت المربع','cell done')} (N)</button><button class="action" data-dr-todo>${L('أول مربع لم يُنجز','first open cell')}</button><button class="action" data-dr-nextsug>${L('المربع الجاي اللي فيه اقتراحات','next cell with suggestions')} (S)</button></div>
  <p class="tiny">${L('الصورة','Image')} (← →): ${YEARS.map((y,i)=>`<button class="action ${i===yi?'on':''}" data-dr-year="${i}" style="min-width:0;padding:2px 6px">${y}</button>`).join('')} <span class="tiny">${src[YEARS[yi]]?.release||''}</span></p>
  ${!draft?`${(()=>{const o=openSug(),all=suggestions().length;if(!all)return'';return`<div class="card"><p class="tiny"><b>${L('اقتراحات الآلة في هذا المربع','Machine suggestions in this cell')}</b> · ${all-o.length}/${all} ${L('محسومة','decided')}</p>`+(o.length?`<p class="tiny">${o[0].kind==='standing'?L('اقتراح: <b>صفيح قائم</b> (أبيض)','Suggestion: <b>standing slum</b> (white)'):L('اقتراح: <b>هدم</b> (برتقالي)','Suggestion: <b>demolished</b> (orange)')} · ${(o[0].area/1e4).toFixed(2)} ha${o[0].p?` · ${L('ثقة الآلة','machine confidence')} ${Math.round(o[0].p*100)}%`:''}</p><div class="menuGrid"><button class="action" data-dr-yes>Y · ${L('صح','right')}</button><button class="action" data-dr-no>X · ${L('غلط','wrong')}</button></div>`:`<p class="tiny">${L('كل الاقتراحات محسومة. ارسمي اللي فات بالقلم.','All suggestions decided. Draw what was missed with the pen.')}</p>`)+`</div>`})()}<div class="menuGrid"><button class="action" data-dr-pen>✎ ${L('ارسمي بالقلم','draw with the pen')} (P)</button><button class="action" data-dr-add>＋ ${L('SAM بضغطة','SAM by click')} (A)</button></div>`:`
   <div class="card"><p class="tiny">${draft.pen?L('القلم: اضغطي على الزوايا واحدة واحدة، ثم Enter أو اضغطي على أول نقطة. Backspace يتراجع. المسافة+سحب يحرّك الخريطة.','Pen: click the corners one by one, then Enter or click the first point. Backspace undoes. Space+drag pans.'):draft.fromSug?L('اقتراح مقبول. اسحبي أي نقطة لو تحتاج تصحيح.','Accepted suggestion. Drag a vertex if it needs correcting.'):L('اضغطي داخل مجموعة البيوت على صورة «قبل». Shift+ضغطة = استبعاد. اسحبي أي نقطة لتصحيح الحد.','Click inside the houses on the BEFORE image. Shift+click = exclude. Drag a vertex to correct.')}</p>
   ${draft.ring?`<p>${(draft.area/1e4).toFixed(2)} ha${draft.warn?` · <b style="color:#ff4d24">${esc(draft.warn)}</b>`:''}</p>
    <p class="tiny">${L('الحالة','Status')}: ${STATUS.map(([k,t,c])=>`<button class="action ${(draft.status||'gone')===k?'on':''}" data-dr-status="${k}" style="min-width:0;padding:2px 6px${c?';border-color:'+c:''}">${L(...t)}</button>`).join('')}</p>
    ${(draft.status||'gone')==='gone'?`<p class="tiny">${L('أول سنة اختفت فيها البيوت','First year the houses are gone')}: ${YEARS.slice(1).map(y=>`<button class="action ${draft.gone===y?'on':''}" data-dr-gone="${y}" style="min-width:0;padding:2px 6px;border-color:${PHASES[phaseOf(y)].col}">${y}</button>`).join('')}</p>`:`<p class="tiny">${L('بدون سنة · ما ينحسب في هكتارات الهدم','No year · not counted in demolished hectares')}</p>`}
    <p class="tiny">${L('النوع','Type')}: <select data-dr-type>${TYPES.map(([k,t])=>`<option value="${k}" ${draft.type===k?'selected':''}>${L(...t)}</option>`).join('')}</select></p>
    <p class="tiny">${L('مصدر (رابط خبر، اختياري)','Source (news link, optional)')}: <input data-dr-src value="${esc(draft.source||'')}" style="width:100%"></p><p class="tiny">${L('ملاحظة','Note')}: <input data-dr-note value="${esc(draft.note||'')}" style="width:100%"></p>`:''}
   <div class="menuGrid"><button class="action" data-dr-accept ${draft.ring&&(draft.gone||(draft.status||'gone')!=='gone')?'':'disabled'}>✓ ${L('احفظي الموقع','save site')} (Enter)</button><button class="action" data-dr-cancel>${L('إلغاء','cancel')} (Esc)</button></div></div>`}
  <p role="status" class="tiny">${esc(msg)}</p>
  ${inCell.length?`<p class="tiny"><b>${L('في هذا المربع','In this cell')}</b></p>${inCell.map(s=>`<p class="tiny"><span style="color:${isGone(s)?PHASES[phaseOf(s.gone)].col:STATUS.find(t=>t[0]===s.status)[2]}">${isGone(s)?'■':'□'}</span> ${s.id} · ${(s.area/1e4).toFixed(2)} ha · ${isGone(s)?s.before+'→'+s.gone:L(...STATUS.find(t=>t[0]===s.status)[1])} · ${L(...TYPES.find(t=>t[0]===s.type)[1])}${s.warn?' · ⚠':''} <button class="action" data-dr-del="${s.id}" style="min-width:0;padding:1px 6px">✕</button></p>`).join('')}`:''}
  <p class="tiny">${L('التلميحات: دوائر متقطعة = شك آلي · ◆ = موقع موثّق بالأخبار. لا تُعرض للجمهور.','Hints: dashed circles = automatic suspicion · ◆ = documented in the press. Never shown to the public.')}</p>`}
 function bind(body){const on=(s,f)=>body.querySelectorAll(s).forEach(b=>b.onclick=()=>f(b));
  on('[data-dr-prev]',()=>goCell(cur-1));on('[data-dr-next]',()=>goCell(cur+1));on('[data-dr-done]',()=>markDone());on('[data-dr-todo]',()=>{const k=cells.findIndex(c=>!done[c.id]);if(k>=0)goCell(k)});
  on('[data-dr-year]',b=>showYear(+b.dataset.drYear));on('[data-dr-yes]',()=>sugYes());on('[data-dr-nextsug]',()=>nextSug());on('[data-dr-no]',()=>sugNo());on('[data-dr-pen]',()=>startPen());on('[data-dr-add]',()=>startAdd());on('[data-dr-cancel]',()=>cancel());on('[data-dr-accept]',()=>accept());
  on('[data-dr-gone]',b=>{draft.gone=+b.dataset.drGone;refresh('demoReview')});on('[data-dr-status]',b=>{draft.status=b.dataset.drStatus;refresh('demoReview')});
  on('[data-dr-del]',b=>{if(confirm(L('حذف هذا الموقع؟','Delete this site?'))){sites=sites.filter(s=>s.id!==b.dataset.drDel);save();refresh('demoReview');render()}});
  const t=body.querySelector('[data-dr-type]');if(t)t.onchange=()=>{draft.type=t.value};const sI=body.querySelector('[data-dr-src]');if(sI)sI.oninput=()=>{draft.source=sI.value};const nI=body.querySelector('[data-dr-note]');if(nI)nI.oninput=()=>{draft.note=nI.value}}
 function paint(ctx){if(!windows.has('demoReview')||!ready)return;const s=view.s;
  ctx.lineWidth=1/s;for(const [i,c] of cells.entries()){const b=c.b;ctx.strokeStyle=i===cur?'#ffd36a':'rgba(255,255,255,.25)';ctx.lineWidth=(i===cur?2.2:.8)/s;ctx.strokeRect(b[0],-b[3],CELL,CELL);
   if(done[c.id]){ctx.fillStyle='rgba(255,255,255,.06)';ctx.fillRect(b[0],-b[3],CELL,CELL)}}
  ctx.setLineDash([4/s,3/s]);ctx.strokeStyle='rgba(255,211,106,.9)';ctx.lineWidth=1.2/s;for(const [x,y,r] of hints){ctx.beginPath();ctx.arc(x,-y,r,0,7);ctx.stroke()}ctx.setLineDash([]);
  for(const d of documented){const [x,y]=d.p,r=9/s;ctx.save();ctx.translate(x,-y);ctx.rotate(Math.PI/4);ctx.fillStyle=d.kind==='threatened'?'#ff4d24':'#fff';ctx.fillRect(-r/2,-r/2,r,r);ctx.restore()}
  if(!draft){openSug().forEach((k,j)=>{const p=new Path2D();for(const r of k.rings){r.forEach((q,i)=>i?p.lineTo(q[0],-q[1]):p.moveTo(q[0],-q[1]));p.closePath()}ctx.setLineDash(j?[5/s,4/s]:[]);const wht=k.kind==='standing';ctx.strokeStyle=j?(wht?'rgba(240,238,230,.7)':'rgba(255,140,60,.7)'):(wht?'#f0eee6':'#ff8c3c');ctx.lineWidth=(j?1.2:2.6)/s;ctx.stroke(p);if(!j){ctx.fillStyle=wht?'rgba(240,238,230,.16)':'rgba(255,140,60,.18)';ctx.fill(p,'evenodd')}});ctx.setLineDash([])}
  if(draft?.pen?.length){ctx.beginPath();draft.pen.forEach((q,j)=>j?ctx.lineTo(q[0],-q[1]):ctx.moveTo(q[0],-q[1]));if(hover)ctx.lineTo(hover[0],-hover[1]);ctx.strokeStyle='#ffd36a';ctx.lineWidth=2/s;ctx.stroke();for(const [j,q] of draft.pen.entries()){ctx.fillStyle=j?'#ffd36a':'#fff';ctx.beginPath();ctx.arc(q[0],-q[1],(j?3:5)/s,0,7);ctx.fill()}}
  for(const st of sites){const p=new Path2D();for(const r of [st.ring,...(st.holes||[])]){r.forEach((q,j)=>j?p.lineTo(q[0],-q[1]):p.moveTo(q[0],-q[1]));p.closePath()}if(!isGone(st)){const c2=STATUS.find(t=>t[0]===st.status)[2];ctx.setLineDash([6/s,4/s]);ctx.fillStyle=c2+'22';ctx.fill(p,'evenodd');ctx.strokeStyle=c2;ctx.lineWidth=1.6/s;ctx.stroke(p);ctx.setLineDash([]);continue}const col=PHASES[phaseOf(st.gone)].col;
   ctx.fillStyle=col+'88';ctx.fill(p,'evenodd');ctx.strokeStyle=col;ctx.lineWidth=1.6/s;ctx.stroke(p)}
  if(draft){if(draft.ring){const p=new Path2D();for(const r of [draft.ring,...(draft.holes||[])]){r.forEach((q,j)=>j?p.lineTo(q[0],-q[1]):p.moveTo(q[0],-q[1]));p.closePath()}ctx.fillStyle='rgba(255,211,106,.25)';ctx.fill(p,'evenodd');ctx.strokeStyle='#ffd36a';ctx.lineWidth=2/s;ctx.stroke(p);
    for(const q of draft.ring){ctx.fillStyle='#ffd36a';ctx.fillRect(q[0]-2.5/s,-q[1]-2.5/s,5/s,5/s)}}
   for(const q of draft.pos){ctx.fillStyle='#3ddc84';ctx.beginPath();ctx.arc(q[0],-q[1],4/s,0,7);ctx.fill()}
   for(const q of draft.neg){ctx.fillStyle='#ff4d24';ctx.beginPath();ctx.arc(q[0],-q[1],4/s,0,7);ctx.fill()}}}
 async function open(){for(const id of ['changeScan','preciseScan','observedLoss']){const w=windows.get(id);if(w){w.el.remove();windows.delete(id)}}  // the older demolition windows would cover this one
  openWindow('demoReview');load();await fromFile();migrate();save();try{await setup()}catch(e){msg=e.message}refresh('demoReview');render()}
 return{get draft(){return draft},addPoint:(x,y,neg)=>{if(!draft)startAdd();(neg?draft.neg:draft.pos).push([x,y]);return segment()},open,content,bind,paint,get sites(){return sites},get cells(){return cells},exportData,PHASES,phaseOf};
})();
