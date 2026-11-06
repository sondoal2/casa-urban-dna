'use strict';
// PreciseScan: demolition mapping at ~1 m (Esri Wayback zoom 17), read every 2 m, with exact outlines.
//  1. scan    — a 2 m cell is "built before" when the earlier image shows roof texture that is not green or water,
//               and "gone after" when the later image there is smoother and has turned to soil or green, with no
//               built cell within ~4 m (tolerance for the small shift between the two releases). No footprint rule,
//               so shacks without any mapped building count. Components under ~120 m² are dropped.
//  2. outline — the component's own cell boundary (2 m), simplified (Douglas–Peucker 1.2 m) and smoothed (Chaikin).
//  3. review  — Y confirmed · N rejected · U unsure · ←/→ move; before/after evidence for each candidate.
//  4. wand    — click a place the scan missed: the outline grows from there over changed pixels at full 1 m.
// The AI is the instrument; every polygon that ends up "confirmed" was looked at by a person.
window.PreciseScan=(()=>{
 const L=(ar,en)=>Locale.language==='ar'?ar:en;
 const Z=17,TS=256,CELL=2,NC=TS/CELL,stepT=CELL/TS;
 let pair=[],cands=[],cur=-1,running=false,controller=null,message='',wand=false,visible=true;
 const store='casablanca-precise-scan-v3';
 try{const s=JSON.parse(localStorage.getItem(store)||'null');if(s?.cands)cands=s.cands}catch{}
 const save=()=>{try{localStorage.setItem(store,JSON.stringify({cands}))}catch{}};
 const DEV=/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
 async function ensurePair(){if(pair.length===2)return pair;if(Imagery.sources.filter(s=>s.release).length<2)await Imagery.loadCatalog();
  const s=Imagery.sources.filter(s=>s.release).sort((a,b)=>a.release.localeCompare(b.release));pair=[s.find(x=>x.release==='2014-02-20')||s[0],s.at(-1)];return pair}
 function tile(src,x,y,signal){return new Promise((res,rej)=>{const im=new Image();im.crossOrigin='anonymous';const t=setTimeout(()=>rej(Error('timeout')),9000);
  im.onload=()=>{clearTimeout(t);try{const c=document.createElement('canvas');c.width=c.height=TS;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0);res(g.getImageData(0,0,TS,TS).data)}catch(e){rej(e)}};
  im.onerror=()=>{clearTimeout(t);rej(Error('tile'))};signal?.addEventListener('abort',()=>{clearTimeout(t);rej(Error('abort'))},{once:true});im.src=src.tile.replace('{z}',Z).replace('{x}',x).replace('{y}',y)})}
 // Per-pixel layers → integral images → per-cell means over a 7 px window.
 function features(px,W=TS,H=TS){const S=W+1,n=S*(H+1),edge=new Float64Array(n),veg=new Float64Array(n),bare=new Float64Array(n),wat=new Float64Array(n),lum=new Float64Array(n);
  const l=i=>px[i]*.299+px[i+1]*.587+px[i+2]*.114;
  for(let y=0;y<H;y++){let a=0,b=0,c=0,d=0,e=0;for(let x=0;x<W;x++){const i=(y*W+x)*4,r=px[i],g=px[i+1],bl=px[i+2],L_=l(i);
    const gx=x<W-1?Math.abs(L_-l(i+4)):0,gy=y<H-1?Math.abs(L_-l(i+4*W)):0;a+=gx+gy;
    b+=(g>r+6&&g>bl+4)?1:0;c+=(L_>95&&r>=g-4&&g>=bl-6&&r-bl>8)?1:0;d+=(bl>r+10&&bl>=g-2)?1:0;e+=L_;
    const j=(y+1)*S+x+1;edge[j]=edge[j-S]+a;veg[j]=veg[j-S]+b;bare[j]=bare[j-S]+c;wat[j]=wat[j-S]+d;lum[j]=lum[j-S]+e}}
  return(cx,cy,r=3)=>{const x0=Math.max(0,cx-r),x1=Math.min(W,cx+r+1),y0=Math.max(0,cy-r),y1=Math.min(H,cy+r+1),k=(x1-x0)*(y1-y0),m=A=>(A[y1*S+x1]-A[y1*S+x0]-A[y0*S+x1]+A[y0*S+x0])/k;
   return{e:m(edge),v:m(veg),b:m(bare),w:m(wat),l:m(lum)}}}
 // Texture is read relative to each image's own median: the 2026 release is much sharper than 2014's,
 // so raw edge strength would make everything look "rougher after".
 const builtLike=(f,e)=>e>=1.15&&f.v<.2&&f.w<.2&&f.l>45&&f.l<235;
 // one tile pair → changed-cell bitmap (NC×NC)
 function changeMap(pa,pb,W=TS,H=TS,cell=CELL){const fa=features(pa,W,H),fb=features(pb,W,H),nx=W/cell,ny=H/cell,A=new Uint8Array(nx*ny),B=new Uint8Array(nx*ny),out=new Uint8Array(nx*ny);
  const FA=new Array(nx*ny),FB=new Array(nx*ny);for(let v=0;v<ny;v++)for(let u=0;u<nx;u++){const cx=u*cell+(cell>>1),cy=v*cell+(cell>>1);FA[v*nx+u]=fa(cx,cy);FB[v*nx+u]=fb(cx,cy)}
  const med=F=>{const s=F.map(f=>f.e).sort((p,q)=>p-q);return Math.max(4,s[s.length>>1])},ma=med(FA),mb=med(FB);
  for(let i=0;i<nx*ny;i++){const a=FA[i],b=FB[i],ea=a.e/ma,eb=b.e/mb;
   // "still built after" must be clearly built (strong texture, not soil, not green): the sharp 2026 image
   // gives trees and paths texture too, which must not cancel a real demolition
   if(eb>=1.6&&b.v<.2&&b.b<.35&&b.w<.2)B[i]=1;
   if(builtLike(a,ea)&&eb<=ea*.6&&(b.v-a.v>.15||b.b-a.b>.15||eb<.75)&&b.l<235)A[i]=1}
  // tolerance for misregistration: no clearly built cell in the later image within one cell (~2 m)
  const T=new Uint8Array(nx*ny);for(let v=0;v<ny;v++)for(let u=0;u<nx;u++){if(!A[v*nx+u])continue;let ok=1;for(let dv=-1;dv<=1&&ok;dv++)for(let du=-1;du<=1;du++){const uu=u+du,vv=v+dv;if(uu>=0&&vv>=0&&uu<nx&&vv<ny&&B[vv*nx+uu]){ok=0;break}}T[v*nx+u]=ok}
  // closing (dilate then erode, one cell): joins the scattered cells of one cleared area into one shape
  const D=new Uint8Array(nx*ny),at=(M,u,v)=>u>=0&&v>=0&&u<nx&&v<ny?M[v*nx+u]:0;
  for(let v=0;v<ny;v++)for(let u=0;u<nx;u++){let h=0;for(let dv=-1;dv<=1&&!h;dv++)for(let du=-1;du<=1;du++)if(at(T,u+du,v+dv)){h=1;break}D[v*nx+u]=h}
  for(let v=0;v<ny;v++)for(let u=0;u<nx;u++){let all=1;for(let dv=-1;dv<=1&&all;dv++)for(let du=-1;du<=1;du++){const uu=u+du,vv=v+dv;if(uu>=0&&vv>=0&&uu<nx&&vv<ny&&!D[vv*nx+uu]){all=0;break}}out[v*nx+u]=all}
  return out}
 // component → outline rings in local metres (cell-boundary trace, Douglas–Peucker, Chaikin)
 function outline(cells,toWorld){const S=new Set(cells.map(([u,v])=>u+','+v)),edges=new Map(),k=(x,y)=>x+','+y;
  const add=(a,b)=>{if(!edges.delete(k(...b)+'>'+k(...a)))edges.set(k(...a)+'>'+k(...b),{a,b})};
  for(const [u,v] of cells){add([u,v],[u+1,v]);add([u+1,v],[u+1,v+1]);add([u+1,v+1],[u,v+1]);add([u,v+1],[u,v])}
  const out=new Map();for(const [id,e] of edges){const q=k(...e.a);if(!out.has(q))out.set(q,[]);out.get(q).push({id,...e})}
  const rings=[];while(edges.size){const [fid,f]=edges.entries().next().value;edges.delete(fid);const r=[f.a,f.b],o=k(...f.a);let guard=0;
   while(k(...r.at(-1))!==o&&guard++<200000){const end=r.at(-1),prev=r.at(-2),dx=end[0]-prev[0],dy=end[1]-prev[1],opts=(out.get(k(...end))||[]).filter(e=>edges.has(e.id));const nx=opts.find(e=>e.b[0]-end[0]===-dy&&e.b[1]-end[1]===dx)||opts[0];if(!nx)break;edges.delete(nx.id);r.push(nx.b)}
   if(r.length>=5)rings.push(r)}
  const dp=(pts,eps)=>{if(pts.length<3)return pts;let dmax=0,idx=0;const [a,b]=[pts[0],pts.at(-1)],L_=Math.hypot(b[0]-a[0],b[1]-a[1])||1;for(let i=1;i<pts.length-1;i++){const d=Math.abs((b[1]-a[1])*pts[i][0]-(b[0]-a[0])*pts[i][1]+b[0]*a[1]-b[1]*a[0])/L_;if(d>dmax){dmax=d;idx=i}}return dmax>eps?[...dp(pts.slice(0,idx+1),eps).slice(0,-1),...dp(pts.slice(idx),eps)]:[a,b]};
  const chaikin=p=>{let q=p.slice(0,-1);for(let n=0;n<2;n++){const o2=[];for(let i=0;i<q.length;i++){const a=q[i],b=q[(i+1)%q.length];o2.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75])}q=o2}return[...q,q[0]]};
  // a closed ring is split at its farthest point from the start, so Douglas–Peucker never sees a zero-length base
  const dpRing=(w,eps)=>{const a=w[0];let far=1,fd=-1;for(let i=1;i<w.length-1;i++){const d=Math.hypot(w[i][0]-a[0],w[i][1]-a[1]);if(d>fd){fd=d;far=i}}return[...dp(w.slice(0,far+1),eps).slice(0,-1),...dp(w.slice(far),eps)]};
  return rings.map(r=>{const w=r.map(([u,v])=>toWorld(u,v));const s=dpRing(w,1.2);return s.length>=4?chaikin(s):null}).filter(Boolean)}
 const ringArea=r=>{let s=0;for(let i=0;i<r.length-1;i++)s+=r[i][0]*r[i+1][1]-r[i+1][0]*r[i][1];return s/2};
 const bboxOf=rings=>{const p=rings.flat();return[Math.min(...p.map(q=>q[0])),Math.min(...p.map(q=>q[1])),Math.max(...p.map(q=>q[0])),Math.max(...p.map(q=>q[1]))]};
 // ---------- scan ----------
 async function scan(full){if(running)return;running=true;controller=new AbortController();message=L('جارٍ التحضير…','Preparing…');refresh('preciseScan');
  try{await ensurePair();const study=await fetch('data/study.json').then(r=>r.json()),frame=study.features.find(f=>f.kind==='frame');
   const bnd=await fetch('data/casablanca-boundary.geojson').then(r=>r.json()),city=bnd.geometry.coordinates.map(r=>r.map(p=>CasaGeo.forward(...p)));
   const half=900,box=full?frame.b:[Math.max(frame.b[0],view.x-half),Math.max(frame.b[1],view.y-half),Math.min(frame.b[2],view.x+half),Math.min(frame.b[3],view.y+half)];
   const [x0,y0,x1,y1]=CasaGeo.tileRange(box,Z),tiles=[];for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const c=CasaGeo.tilePoint(x+.5,y+.5,Z);if(ChangeGeometry.contains(city,...c))tiles.push({x,y})}
   const c0=CasaGeo.tileXY(...CasaGeo.inverse(view.x,view.y),Z);tiles.sort((a,b)=>Math.hypot(a.x-c0[0],a.y-c0[1])-Math.hypot(b.x-c0[0],b.y-c0[1]));
   const maps=new Map();let next=0,done=0,failed=0;
   const work=async()=>{while(next<tiles.length&&!controller.signal.aborted){const t=tiles[next++];try{const [a,b]=await Promise.all(pair.map(s=>tile(s,t.x,t.y,controller.signal)));maps.set(t.x+','+t.y,changeMap(a,b))}catch{failed++}done++;
     if(done%20===0||done===tiles.length){message=L(`فُحصت ${done} من ${tiles.length} بلاطة · تعذّر ${failed}`,`Checked ${done} of ${tiles.length} tiles · ${failed} failed`);const el=document.querySelector('[data-ps-status]');if(el)el.textContent=message}}};
   await Promise.all(Array.from({length:6},work));

   message=L('جارٍ رسم الحدود…','Tracing outlines…');refresh('preciseScan');await new Promise(r=>setTimeout(r,30));
   // connected components across tiles on the global 2 m cell grid
   const has=(gu,gv)=>{const tx=Math.floor(gu/NC),ty=Math.floor(gv/NC),m=maps.get(tx+','+ty);return m?m[(gv-ty*NC)*NC+(gu-tx*NC)]===1:false};
   const seen=new Set(),found=[];
   for(const [kk,m] of maps){const [tx,ty]=kk.split(',').map(Number);for(let i=0;i<m.length;i++){if(!m[i])continue;const gu=tx*NC+i%NC,gv=ty*NC+Math.floor(i/NC),id=gu+','+gv;if(seen.has(id))continue;
     const comp=[],stack=[[gu,gv]];seen.add(id);while(stack.length&&comp.length<60000){const [u,v]=stack.pop();comp.push([u,v]);for(let dv=-1;dv<=1;dv++)for(let du=-1;du<=1;du++){if(!du&&!dv)continue;const uu=u+du,vv=v+dv,q=uu+','+vv;if(!seen.has(q)&&has(uu,vv)){seen.add(q);stack.push([uu,vv])}}}
     if(comp.length<30)continue;// ~120 m²
     const toWorld=(u,v)=>CasaGeo.tilePoint(u*stepT,v*stepT,Z).map(n=>Math.round(n*10)/10);
     const rings=outline(comp,toWorld);if(!rings.length)continue;const area=Math.abs(rings.reduce((s,r)=>s+ringArea(r),0));if(area<120)continue;
     found.push({rings,b:bboxOf(rings),area,cells:comp.length,status:'pending',src:'scan'})}}
   // keep the person's decisions where a new candidate overlaps an old reviewed one
   const keep=cands.filter(c=>c.status!=='pending');for(const f of found){const o=keep.find(c=>overlap(c.b,f.b));if(o&&o.src==='wand')continue;if(o)f.status=o.status}
   cands=[...keep.filter(c=>c.src==='wand'),...found].sort((a,b)=>b.area-a.area);cur=cands.findIndex(c=>c.status==='pending');save();
   const ha=cands.reduce((s,c)=>s+c.area,0)/1e4;message=L(`انتهى المسح · ${cands.length} مرشّح · ${ha.toFixed(1)} هكتار · تعذّر ${failed}`,`Scan done · ${cands.length} candidates · ${ha.toFixed(1)} ha · ${failed} failed`)}
  catch(e){message=e.message}finally{running=false;refresh('preciseScan');render()}}
 // ---------- magic wand ----------
 async function grow(wx,wy){message=L('العصا السحرية: جارٍ القراءة…','Wand: reading…');refresh('preciseScan');
  try{await ensurePair();const R_=260,box=[wx-R_,wy-R_,wx+R_,wy+R_],[x0,y0,x1,y1]=CasaGeo.tileRange(box,Z),w=(x1-x0+1)*TS,h=(y1-y0+1)*TS;
   const mosaic=async src=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d',{willReadFrequently:true});
    await Promise.all([...Array((x1-x0+1)*(y1-y0+1)).keys()].map(async i=>{const x=x0+i%(x1-x0+1),y=y0+Math.floor(i/(x1-x0+1));const d=await tile(src,x,y);g.putImageData(new ImageData(d,TS,TS),(x-x0)*TS,(y-y0)*TS)}));return g.getImageData(0,0,w,h).data};
   const [pa,pb]=await Promise.all(pair.map(mosaic));const m=changeMap(pa,pb,w,h,CELL),nx=w/CELL,ny=h/CELL;// same 2 m cells as the scan
   const [sx,sy]=CasaGeo.tileXY(...CasaGeo.inverse(wx,wy),Z).map((v,i)=>Math.round((v-(i?y0:x0))*TS/CELL));
   // seed: the nearest changed pixel within 12 m
   let seed=null;for(let r=0;r<=8&&!seed;r++)for(let dy=-r;dy<=r&&!seed;dy++)for(let dx=-r;dx<=r;dx++){const u=sx+dx,v=sy+dy;if(u>=0&&v>=0&&u<nx&&v<ny&&m[v*nx+u]){seed=[u,v];break}}
   if(!seed){message=L('لا يوجد تغيّر واضح هنا بين الصورتين.','No clear change here between the two images.');refresh('preciseScan');return}
   // close 1-px gaps so the grown area is one piece, then flood fill (8-neighbours) within the window
   // bridge one-cell gaps so a cleared area reads as one piece
   const M=new Uint8Array(m.length);for(let v=1;v<ny-1;v++)for(let u=1;u<nx-1;u++){let s=0;for(let dv=-1;dv<=1;dv++)for(let du=-1;du<=1;du++)s+=m[(v+dv)*nx+u+du];M[v*nx+u]=m[v*nx+u]||s>=3?1:0}
   const comp=[],seen=new Uint8Array(m.length),st=[seed];seen[seed[1]*nx+seed[0]]=1;while(st.length&&comp.length<250000){const [u,v]=st.pop();comp.push([u,v]);for(let dv=-1;dv<=1;dv++)for(let du=-1;du<=1;du++){const uu=u+du,vv=v+dv;if(uu<0||vv<0||uu>=nx||vv>=ny)continue;const i=vv*nx+uu;if(!seen[i]&&M[i]){seen[i]=1;st.push([uu,vv])}}}
   const toWorld=(u,v)=>CasaGeo.tilePoint(x0+u*CELL/TS,y0+v*CELL/TS,Z).map(n=>Math.round(n*10)/10);const rings=outline(comp,toWorld);if(!rings.length)throw Error('outline');
   const area=Math.abs(rings.reduce((s,r)=>s+ringArea(r),0));cands.unshift({rings,b:bboxOf(rings),area,cells:comp.length,status:'confirmed',src:'wand'});cur=0;save();
   message=L(`العصا السحرية أضافت ${(area/1e4).toFixed(2)} هكتار (مؤكَّد). اضغطي N لو خطأ.`,`Wand added ${(area/1e4).toFixed(2)} ha (confirmed). Press N if wrong.`)}
  catch(e){message=L('تعذّرت القراءة: ','Could not read: ')+e.message}finally{refresh('preciseScan');render()}}
 // ---------- review ----------
 function go(i){if(!cands.length)return;cur=(i+cands.length)%cands.length;const c=cands[cur];fit(ChangeGeometry.evidenceBox(c.b));refresh('preciseScan');render()}
 function setStatus(s){if(cur<0||!cands[cur])return;cands[cur].status=s;save();const nx=cands.findIndex((c,i)=>i>cur&&c.status==='pending');go(nx>=0?nx:cur+1)}
 document.addEventListener('keydown',e=>{if(!windows.has('preciseScan')||/INPUT|TEXTAREA/.test(e.target.tagName))return;const k=e.key.toLowerCase();
  if(k==='y'){setStatus('confirmed');e.preventDefault()}else if(k==='n'){setStatus('rejected');e.preventDefault()}else if(k==='u'){setStatus('unsure');e.preventDefault()}
  else if(e.key==='ArrowRight'){go(cur+1);e.preventDefault()}else if(e.key==='ArrowLeft'){go(cur-1);e.preventDefault()}});
 // wand click on the map (a click, not a drag)
 let down=null;addEventListener('pointerdown',e=>{if(e.target.id==='map')down=[e.clientX,e.clientY]},true);
 addEventListener('pointerup',e=>{if(!wand||e.target.id!=='map'||!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>4)return;const [wx,wy]=world(e.clientX,e.clientY);grow(wx,wy)},true);
 function exportResult(){const conf=cands.filter(c=>c.status==='confirmed'),uns=cands.filter(c=>c.status==='unsure'),ha=a=>Math.round(a.reduce((s,c)=>s+c.area,0)/1e3)/10;
  const out={generated:new Date().toISOString().slice(0,10),method:'PreciseScan v3: Esri Wayback z17 (~1 m), 2 m cells, roof texture → soil/green, 4 m shift tolerance; outlines traced at 2 m, Douglas–Peucker 1.2 m + Chaikin; magic wand at 1 m; every confirmed polygon reviewed by eye',
   pair:pair.map(p=>({id:p.id,release:p.release})),counts:{candidates:cands.length,confirmed:conf.length,unsure:uns.length,rejected:cands.filter(c=>c.status==='rejected').length,pending:cands.filter(c=>c.status==='pending').length},areaHa:{confirmed:ha(conf),unsure:ha(uns)},
   groups:[...conf,...uns].map(c=>({rings:c.rings,status:c.status,src:c.src,area:Math.round(c.area)}))};
  return fetch('/__save/demolition_v3.json',{method:'POST',body:JSON.stringify(out)}).then(r=>{message=r.ok?L(`حُفظ: ${conf.length} مؤكَّد (${out.areaHa.confirmed} هكتار) في data/demolition_v3.json`,`Saved: ${conf.length} confirmed (${out.areaHa.confirmed} ha) to data/demolition_v3.json`):L('تعذّر الحفظ','Save failed');refresh('preciseScan')})}
 // ---------- window ----------
 function content(){const n=s=>cands.filter(c=>c.status===s).length,c=cands[cur];
  return `<p class="lead">${L('رصد الهدم الدقيق','Precise demolition mapping')}</p>
  <p class="tiny">${L('صورة 2014 مقابل 2026 بدقة ≈1 م، تُقرأ كل 2 م. «كان سقفًا» → «صار تربة أو أخضر». بدون شرط البصمات، فالبراريك تُحتسب. الحدود مرسومة على شكل المنطقة نفسها.','2014 vs 2026 at ≈1 m, read every 2 m. “Was a roof” → “is soil or green”. No footprint rule, so shacks count. Outlines follow the area itself.')}</p>
  ${DEV?`<div class="menuGrid"><button class="action" data-ps-scan="view" ${running?'disabled':''}>${L('مسح حول العرض (≈1.8 كم)','Scan around view (≈1.8 km)')}</button><button class="action" data-ps-scan="full" ${running?'disabled':''}>${L('مسح الإطار كاملًا','Scan the whole frame')}</button>
  <button class="action ${wand?'on':''}" data-ps-wand>${wand?'● ':''}${L('العصا السحرية: اضغطي على منطقة','Magic wand: click an area')}</button>${running?`<button class="action" data-ps-stop>${L('إيقاف','Stop')}</button>`:''}</div>`:''}
  <p role="status" data-ps-status>${esc(message)}</p>
  <p class="tiny">${L('للمراجعة','Review')}: <b>Y</b> ${L('هُدم','demolished')} · <b>N</b> ${L('لا','no')} · <b>U</b> ${L('غير متأكدة','unsure')} · ← →</p>
  <p>${L('مرشّحات','Candidates')} ${cands.length} · <span style="color:#d4a73a">${L('مؤكَّد','confirmed')} ${n('confirmed')}</span> · ${L('غير محسوم','unsure')} ${n('unsure')} · ${L('مرفوض','rejected')} ${n('rejected')} · ${L('بانتظار','pending')} ${n('pending')}</p>
  ${c?`<p><b>${cur+1} / ${cands.length}</b> · ${(c.area/1e4).toFixed(2)} ha · ${c.src==='wand'?L('بالعصا','wand'):L('مسح','scan')} · <b>${c.status}</b></p><div class="evidencePair">${pair.map((p,i)=>`<figure><figcaption>${p.release}</figcaption><canvas data-ps-proof="${i}" width="380" height="380"></canvas></figure>`).join('')}</div>
   <div class="menuGrid"><button class="action" data-ps-set="confirmed">Y · ${L('هُدم','demolished')}</button><button class="action" data-ps-set="rejected">N · ${L('لا','no')}</button><button class="action" data-ps-set="unsure">U · ${L('غير متأكدة','unsure')}</button></div>`:''}
  ${DEV&&cands.length?`<button class="action" data-ps-export>${L('احفظي النتيجة للموقع','Save the result for the site')} ↓</button>`:''}`}
 async function bind(body){const on=(s,f)=>body.querySelectorAll(s).forEach(b=>b.onclick=()=>f(b));
  on('[data-ps-scan]',b=>scan(b.dataset.psScan==='full'));on('[data-ps-stop]',()=>controller?.abort());on('[data-ps-wand]',()=>{wand=!wand;canvas.style.cursor=wand?'crosshair':'grab';refresh('preciseScan')});
  on('[data-ps-set]',b=>setStatus(b.dataset.psSet));on('[data-ps-export]',()=>exportResult());
  const c=cands[cur];if(c){await ensurePair();pair.forEach((src,i)=>{const t=body.querySelector(`[data-ps-proof="${i}"]`);if(t)Imagery.renderEvidence(t,src,ChangeGeometry.evidenceBox(c.b),c.rings).catch(()=>{})})}}
 function paint(ctx){if(!visible||!windows.has('preciseScan'))return;const col={confirmed:'#d4a73a',unsure:'#d4a73a',rejected:'#777',pending:'#ff7a3d'};
  for(const [i,c] of cands.entries()){const p=new Path2D();for(const r of c.rings)r.forEach((q,j)=>j?p.lineTo(q[0],-q[1]):p.moveTo(q[0],-q[1]));p.closePath();
   ctx.fillStyle=col[c.status]+(c.status==='confirmed'?'66':'22');ctx.fill(p,'evenodd');ctx.strokeStyle=col[c.status];ctx.lineWidth=(i===cur?2.6:1.2)/view.s;ctx.setLineDash(c.status==='unsure'?[4/view.s,3/view.s]:[]);ctx.stroke(p);ctx.setLineDash([])}}
 function open(){openWindow('preciseScan');ensurePair().then(()=>refresh('preciseScan')).catch(()=>{})}
 return{open,content,bind,paint,get candidates(){return cands}};
})();
