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
 const DEV=/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
 const L=(ar,en)=>Locale.language==='ar'?ar:en;
 const Z=17,TS=256,CELL=2,NC=TS/CELL,stepT=CELL/TS;
 let pair=[],cands=[],cur=-1,running=false,controller=null,message='',wand=false,visible=true;
 const store='casablanca-precise-scan-v3';
 try{const s=JSON.parse(localStorage.getItem(store)||'null');if(s?.cands)cands=s.cands}catch{}
 // decisions are kept in this browser and, on the dev server, in data/precise_candidates.json so any browser can review them
 let fileTimer=0;const save=()=>{try{localStorage.setItem(store,JSON.stringify({cands}))}catch{}if(DEV){clearTimeout(fileTimer);fileTimer=setTimeout(()=>fetch('/__save/precise_candidates.json',{method:'POST',body:JSON.stringify({saved:new Date().toISOString(),cands})}).catch(()=>{}),1500)}};
 const fromFile=async()=>{if(cands.length)return;try{const r=await fetch('data/precise_candidates.json?v='+Date.now());if(r.ok){const d=await r.json();if(d?.cands?.length){cands=d.cands;cur=cands.findIndex(c=>c.status==='pending')}}}catch{}};

 async function ensurePair(){if(pair.length===2)return pair;if(Imagery.sources.filter(s=>s.release).length<2)await Imagery.loadCatalog();
  const s=Imagery.sources.filter(s=>s.release).sort((a,b)=>a.release.localeCompare(b.release));pair=[s.find(x=>x.release==='2014-02-20')||s[0],s.at(-1)];return pair}
 function tile(src,x,y,signal,z=Z){return new Promise((res,rej)=>{const im=new Image();im.crossOrigin='anonymous';const t=setTimeout(()=>rej(Error('timeout')),9000);
  im.onload=()=>{clearTimeout(t);try{const c=document.createElement('canvas');c.width=c.height=TS;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0);res(g.getImageData(0,0,TS,TS).data)}catch(e){rej(e)}};
  im.onerror=()=>{clearTimeout(t);rej(Error('tile'))};signal?.addEventListener('abort',()=>{clearTimeout(t);rej(Error('abort'))},{once:true});im.src=src.tile.replace('{z}',z).replace('{x}',x).replace('{y}',y)})}
 // ---------- refine: exact edges at 0.5 m ----------
 // Zoom 19 (≈0.25 m) of the earliest release that has it here (2015+) against the latest. The two images are
 // aligned by cross-correlation, cut into superpixels that follow real edges (walls, streets, roof lines) of both
 // years, and each superpixel is judged as a whole: dense roofs before → soil, rubble-flat or green after.
 // The outline is the boundary of the kept superpixels, so it runs along edges seen in the images.
 const RZ=19,DS=2;let early=null;
 async function earlySource(lon,lat){const srcs=Imagery.sources.filter(s=>s.release&&s.release>='2015').sort((a,b)=>a.release.localeCompare(b.release));
  const [tx,ty]=CasaGeo.tileXY(lon,lat,RZ).map(Math.floor);for(const s of srcs.slice(0,12)){try{await tile(s,tx,ty,null,RZ);return s}catch{}}return null}
 async function mosaicZ(src,box,signal){const [x0,y0,x1,y1]=CasaGeo.tileRange(box,RZ),nx=x1-x0+1,ny=y1-y0+1,W=nx*TS/DS,H=ny*TS/DS,px=new Float32Array(W*H*3),ok=new Uint8Array(W*H);
  const jobs=[...Array(nx*ny).keys()];let missing=0;const one=async i=>{const x=x0+i%nx,y=y0+Math.floor(i/nx);let d=null;for(let t=0;t<3&&!d;t++){try{d=await tile(src,x,y,signal,RZ)}catch(e){if(e.message==='abort')throw e}}if(!d){missing++;return}
   for(let v=0;v<TS/DS;v++)ok.fill(1,((y-y0)*TS/DS+v)*W+(x-x0)*TS/DS,((y-y0)*TS/DS+v)*W+(x-x0+1)*TS/DS);
   for(let v=0;v<TS/DS;v++)for(let u=0;u<TS/DS;u++){const o=((((y-y0)*TS/DS+v)*W)+(x-x0)*TS/DS+u)*3;for(let c=0;c<3;c++){let s=0;for(let b=0;b<DS;b++)for(let a=0;a<DS;a++)s+=d[((v*DS+b)*TS+u*DS+a)*4+c];px[o+c]=s/(DS*DS)}}};
  // 6 at a time: firing 60+ tile requests at once makes the server drop some
  let next=0;await Promise.all(Array.from({length:6},async()=>{while(next<jobs.length)await one(jobs[next++])}));
  return{px,W,H,x0,y0,ok,missing}}
 function layersOf(px0,W,H){const n0=W*H,mu=[0,0,0];for(let i=0;i<n0;i++)for(let c=0;c<3;c++)mu[c]+=px0[i*3+c];const m0=(mu[0]+mu[1]+mu[2])/3;
  // grey-world balance: the 2015 release is green-cast, 2026 is warm; colour rules must read both the same way
  const px=new Float32Array(px0.length);for(let i=0;i<n0;i++)for(let c=0;c<3;c++)px[i*3+c]=Math.min(255,px0[i*3+c]*m0/Math.max(1,mu[c]));
  const n=W*H,lum=new Float32Array(n),grad=new Float32Array(n),veg=new Float32Array(n),bare=new Float32Array(n),wat=new Float32Array(n);
  for(let i=0;i<n;i++){const r=px[i*3],g=px[i*3+1],b=px[i*3+2],l=r*.299+g*.587+b*.114;lum[i]=l;veg[i]=g>r+6&&g>b+6?1:0;bare[i]=(r>g+3&&r>b+12&&l>60)?1:0;wat[i]=b>r+10&&b>=g-2?1:0}
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x;grad[i]=Math.abs(lum[i+1]-lum[i-1])+Math.abs(lum[i+W]-lum[i-W])}
  // texture = mean gradient over 5×5 (2.5 m), relative to the image's median
  const S=W+1,I=new Float64Array(S*(H+1));for(let y=0;y<H;y++){let a=0;for(let x=0;x<W;x++){a+=grad[y*W+x];I[(y+1)*S+x+1]=I[y*S+x+1]+a}}
  const tex=new Float32Array(n);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const x0=Math.max(0,x-2),x1=Math.min(W,x+3),y0=Math.max(0,y-2),y1=Math.min(H,y+3);tex[y*W+x]=(I[y1*S+x1]-I[y1*S+x0]-I[y0*S+x1]+I[y0*S+x0])/((x1-x0)*(y1-y0))}
  const sm=[];for(let i=0;i<n;i+=37)sm.push(tex[i]);sm.sort((a,b)=>a-b);const med=Math.max(3,sm[sm.length>>1]);for(let i=0;i<n;i++)tex[i]/=med;
  // shadow (walls and alleys between roofs) relative to the image's median brightness; grey = unsaturated roof/concrete
  const sl=[];for(let i=0;i<n;i+=37)sl.push(lum[i]);sl.sort((a,b)=>a-b);const ml=sl[sl.length>>1],dark=new Float32Array(n),grey=new Float32Array(n);
  for(let i=0;i<n;i++){const r=px[i*3],g=px[i*3+1],b=px[i*3+2];dark[i]=lum[i]<ml*.55&&!veg[i]?1:0;grey[i]=Math.max(r,g,b)-Math.min(r,g,b)<20&&lum[i]>ml*.75?1:0}
  // fabric: share of wall/alley shadow within ±8 px (≈8 m square). Dense roofs always have it; open ground has none.
  const J=new Float64Array(S*(H+1));for(let y=0;y<H;y++){let a=0;for(let x=0;x<W;x++){a+=dark[y*W+x];J[(y+1)*S+x+1]=J[y*S+x+1]+a}}
  const dw=new Float32Array(n);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const x0=Math.max(0,x-8),x1=Math.min(W,x+9),y0=Math.max(0,y-8),y1=Math.min(H,y+9);dw[y*W+x]=(J[y1*S+x1]-J[y1*S+x0]-J[y0*S+x1]+J[y0*S+x0])/((x1-x0)*(y1-y0))}
  // roof-edge density over the same ≈8 m square, relative to the image median (reads hazy 2015 as well as sharp 2026)
  const tw=new Float32Array(n);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const x0=Math.max(0,x-8),x1=Math.min(W,x+9),y0=Math.max(0,y-8),y1=Math.min(H,y+9);tw[y*W+x]=(I[y1*S+x1]-I[y1*S+x0]-I[y0*S+x1]+I[y0*S+x0])/((x1-x0)*(y1-y0))/med}
  return{lum,grad,tex,veg,bare,wat,dark,grey,dw,tw}}
 // integer shift of `b` that best matches `a` (gradient correlation, ±10 px = ±5 m)
 // coarse-to-fine: ±100 px (50 m) on a 4× reduced gradient, then ±4 px at full resolution; normalised correlation
 function align(A,B,W,H){const red=(G,f)=>{const w=W/f|0,h=H/f|0,o=new Float32Array(w*h);for(let y=0;y<h*f;y++)for(let x=0;x<w*f;x++)o[(y/f|0)*w+(x/f|0)]+=G[y*W+x];return{o,w,h}};
  const ncc=(a,b,w,h,dx,dy,m,st)=>{let s=0,sa=0,sb=0,saa=0,sbb=0,n=0;for(let y=m;y<h-m;y+=st)for(let x=m;x<w-m;x+=st){const p=a[y*w+x],q=b[(y+dy)*w+x+dx];s+=p*q;sa+=p;sb+=q;saa+=p*p;sbb+=q*q;n++}const c=s-sa*sb/n;return c/Math.sqrt((saa-sa*sa/n)*(sbb-sb*sb/n)+1e-9)};
  // Wayback releases are off by a few metres at most; a wider search locks onto the change itself
  const ra=red(A,4),rb=red(B,4);let best=[0,0],bs=-2;for(let dy=-6;dy<=6;dy++)for(let dx=-6;dx<=6;dx++){const s=ncc(ra.o,rb.o,ra.w,ra.h,dx,dy,26,1);if(s>bs){bs=s;best=[dx,dy]}}
  const [cx,cy]=[best[0]*4,best[1]*4];let fine=[cx,cy];bs=-2;const m=Math.max(Math.abs(cx),Math.abs(cy))+8;for(let dy=cy-4;dy<=cy+4;dy++)for(let dx=cx-4;dx<=cx+4;dx++){const s=ncc(A,B,W,H,dx,dy,m,2);if(s>bs){bs=s;fine=[dx,dy]}}
  return fine}
 function shiftPx(px,W,H,[dx,dy]){const d=new Float32Array(px.length);for(let y=0;y<H;y++){const yy=Math.min(H-1,Math.max(0,y+dy));for(let x=0;x<W;x++){const xx=Math.min(W-1,Math.max(0,x+dx));for(let c=0;c<3;c++)d[(y*W+x)*3+c]=px[(yy*W+xx)*3+c]}}return d}
 function shifted(L,W,H,[dx,dy]){const o={};for(const k in L){const s=L[k],d=new Float32Array(W*H);for(let y=0;y<H;y++){const yy=Math.min(H-1,Math.max(0,y+dy));for(let x=0;x<W;x++)d[y*W+x]=s[yy*W+Math.min(W-1,Math.max(0,x+dx))]}o[k]=d}return o}
 // SLIC on both years at once (colour after, luminance before, texture of both), step 6 px = 3 m
 function slic(fa,fb,pa,W,H,S=6,M=10){const n=W*H,F=6,feat=new Float32Array(n*F);
  for(let i=0;i<n;i++){feat[i*F]=pa[i*3];feat[i*F+1]=pa[i*3+1];feat[i*F+2]=pa[i*3+2];feat[i*F+3]=fa.lum[i];feat[i*F+4]=Math.min(4,fa.tex[i])*25;feat[i*F+5]=Math.min(4,fb.tex[i])*25}
  const C=[];for(let y=S>>1;y<H;y+=S)for(let x=S>>1;x<W;x+=S){const i=y*W+x;C.push([x,y,...feat.subarray(i*F,i*F+F)])}
  const lab=new Int32Array(n).fill(-1),dist=new Float32Array(n),w=(M/S)**2;
  for(let it=0;it<6;it++){dist.fill(1e12);for(let k=0;k<C.length;k++){const c=C[k],cx=Math.round(c[0]),cy=Math.round(c[1]);
    for(let y=Math.max(0,cy-S);y<Math.min(H,cy+S);y++)for(let x=Math.max(0,cx-S);x<Math.min(W,cx+S);x++){const i=y*W+x;let d=0;for(let f=0;f<F;f++){const q=feat[i*F+f]-c[2+f];d+=q*q}d+=w*((x-c[0])**2+(y-c[1])**2);if(d<dist[i]){dist[i]=d;lab[i]=k}}}
   const acc=C.map(()=>new Float64Array(3+F));for(let i=0;i<n;i++){const k=lab[i];if(k<0)continue;const a=acc[k];a[0]++;a[1]+=i%W;a[2]+=(i/W|0);for(let f=0;f<F;f++)a[3+f]+=feat[i*F+f]}
   for(let k=0;k<C.length;k++){const a=acc[k];if(!a[0])continue;C[k][0]=a[1]/a[0];C[k][1]=a[2]/a[0];for(let f=0;f<F;f++)C[k][2+f]=a[3+f]/a[0]}}
  return{lab,K:C.length}}
 // the whole chain for one box (local metres); returns rings + per-step layers for the evidence view
 async function refine(box,signal){await ensurePair();const after=pair[1],c=[(box[0]+box[2])/2,(box[1]+box[3])/2],[lon,lat]=CasaGeo.inverse(...c);
  const before=await earlySource(lon,lat);if(!before)throw Error(L('لا توجد صورة قديمة بدقة عالية هنا','no early high-res image here'));
  const [ma,mb]=await Promise.all([mosaicZ(before,box,signal),mosaicZ(after,box,signal)]),W=ma.W,H=ma.H;
  let fa=layersOf(ma.px,W,H);const fb=layersOf(mb.px,W,H);const sh=align(fb.grad,fa.grad,W,H);fa=shifted(fa,W,H,sh);ma.px=shiftPx(ma.px,W,H,sh);
  const {lab,K}=slic(fa,fb,mb.px,W,H);const cc=localNCC(fa.lum,fb.lum,W,H,6);
  const Q=['ta','tb','va','vb','ba','bb','wa','wb','la','lb','da','db','ga','gb','fa','fb','xa','xb','cc'];const st=Array.from({length:K},()=>{const o={n:0};for(const q of Q)o[q]=0;return o});
  for(let i=0;i<W*H;i++){const s=st[lab[i]];if(!s)continue;s.n++;s.ta+=fa.tex[i];s.tb+=fb.tex[i];s.va+=fa.veg[i];s.vb+=fb.veg[i];s.ba+=fa.bare[i];s.bb+=fb.bare[i];s.wa+=fa.wat[i];s.la+=fa.lum[i];s.lb+=fb.lum[i];s.da+=fa.dark[i];s.db+=fb.dark[i];s.ga+=fa.grey[i];s.gb+=fb.grey[i];s.wb+=fb.wat[i];s.fa+=fa.dw[i];s.fb+=fb.dw[i];s.xa+=fa.tw[i];s.xb+=fb.tw[i];s.cc+=cc[i]}
  const keep=new Uint8Array(K);for(let k=0;k<K;k++){const s=st[k];if(s.n<4)continue;for(const q of Q)s[q]/=s.n;keep[k]=judge(s)?1:0}
  // neighbourhood vote on the superpixel graph: fill small holes, drop isolated specks
  const nb=Array.from({length:K},()=>new Map());for(let y=0;y<H-1;y++)for(let x=0;x<W-1;x++){const a=lab[y*W+x];for(const b of [lab[y*W+x+1],lab[(y+1)*W+x]])if(a!==b&&a>=0&&b>=0){nb[a].set(b,(nb[a].get(b)||0)+1);nb[b].set(a,(nb[b].get(a)||0)+1)}}
  for(let it=0;it<2;it++){const nk=keep.slice();for(let k=0;k<K;k++){let tot=0,on=0;for(const [b,w] of nb[k]){tot+=w;if(keep[b])on+=w}if(!tot)continue;const f=on/tot;if(!keep[k]&&f>.7)nk[k]=1;if(keep[k]&&f<.15)nk[k]=0}keep.set(nk)}
  let mask=new Uint8Array(W*H);for(let i=0;i<W*H;i++)mask[i]=lab[i]>=0&&keep[lab[i]]?1:0;
  // closing (2 m) and hole filling (<60 m²): one cleared site reads as one shape, inner specks of debris don't punch holes
  mask=closeMask(mask,W,H,4);fillHoles(mask,W,H,200/((.25*DS)**2));
  // nothing is claimed where either image is missing (or within 8 px of a gap)
  const okA=new Uint8Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const xx=x+sh[0],yy=y+sh[1];okA[y*W+x]=xx>=0&&yy>=0&&xx<W&&yy<H&&ma.ok[yy*W+xx]&&mb.ok[y*W+x]?1:0}
  const good=boxMax(okA,W,H,8,0);for(let i=0;i<W*H;i++)if(!good[i])mask[i]=0;
  // a standing building today (OSM + Microsoft footprints) or a street/rail line is never "demolished"
  const mk=await masks(),c00=toWorldF(ma,0,0),c10=toWorldF(ma,W,0),c01=toWorldF(ma,0,H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!mask[i])continue;const wx=c00[0]+(c10[0]-c00[0])*x/W+(c01[0]-c00[0])*y/H,wy=c00[1]+(c10[1]-c00[1])*x/W+(c01[1]-c00[1])*y/H;if(mk.at(wx,wy)&footBits)mask[i]=0}
  // footprints still in OSM/Microsoft but enclosed by cleared ground are stale records of the demolished houses: fill them
  mask=closeMask(mask,W,H,2);fillHoles(mask,W,H,400/((.25*DS)**2));
  // components → outlines along pixel (superpixel) edges, ≥150 m²
  const px2=(.25*DS)**2,toWorld=(u,v)=>CasaGeo.tilePoint(ma.x0+u*DS/TS,ma.y0+v*DS/TS,RZ).map(n=>Math.round(n*10)/10);
  const seen=new Uint8Array(W*H),out=[];for(let i=0;i<W*H;i++){if(!mask[i]||seen[i])continue;const comp=[],stck=[i];seen[i]=1;
   while(stck.length){const j=stck.pop(),x=j%W,y=j/W|0;comp.push([x,y]);for(const q of [x>0?j-1:-1,x<W-1?j+1:-1,y>0?j-W:-1,y<H-1?j+W:-1])if(q>=0&&mask[q]&&!seen[q]){seen[q]=1;stck.push(q)}}
   if(comp.length*px2<250)continue;const rings=outlineSharp(comp,toWorld);if(!rings.length)continue;const area=Math.abs(rings.reduce((s,r)=>s+ringArea(r),0)),per=rings.reduce((s,r)=>s+r.slice(1).reduce((t,p,j)=>t+Math.hypot(p[0]-r[j][0],p[1]-r[j][1]),0),0);
   // mean width (2·area/perimeter) under 3 m = a strip (rail, kerb, shadow line), not a cleared plot
   if(2*area/per<3)continue;out.push({rings,area})}
  return{polys:out,before,after,shift:sh,missing:[ma.missing,mb.missing],dbg:{W,H,mask,lab,ma,mb,st}}}
 // a superpixel was a roofed place before (roof texture + wall shadows, not green/water) and is open ground after
 // (beige soil/rubble or green, with almost no wall shadow left)
 let builtB=s=>s.xa>=1.25&&s.va<.4&&s.wa<.2,openA=s=>s.fb<=.05&&s.db<.04&&s.wb<.2&&s.xb<=1.55&&s.xb<=s.xa*.8;// measured: standing shacks ≥1.66, rubble ≤1.54, cleared soil ≈0.7// open ground has lost the roof-edge texture; standing shacks keep it
 let judge=s=>builtB(s)&&openA(s);
 // pixel-edge trace with light simplification only (0.5 m), so the line keeps the corners of walls and streets
 // local normalised cross-correlation of the two (aligned) images over ±r px: the same roofs in both years correlate,
 // a cleared plot does not, whatever its texture
 function localNCC(A,B,W,H,r){const S=W+1,n=S*(H+1),I=[0,1,2,3,4].map(()=>new Float64Array(n));
  for(let y=0;y<H;y++){const acc=[0,0,0,0,0];for(let x=0;x<W;x++){const a=A[y*W+x],b=B[y*W+x],v=[a,b,a*a,b*b,a*b];for(let k=0;k<5;k++){acc[k]+=v[k];I[k][(y+1)*S+x+1]=I[k][y*S+x+1]+acc[k]}}}
  const o=new Float32Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const x0=Math.max(0,x-r),x1=Math.min(W,x+r+1),y0=Math.max(0,y-r),y1=Math.min(H,y+r+1),N=(x1-x0)*(y1-y0),q=k=>I[k][y1*S+x1]-I[k][y1*S+x0]-I[k][y0*S+x1]+I[k][y0*S+x0];
   const sa=q(0),sb=q(1),va=q(2)-sa*sa/N,vb=q(3)-sb*sb/N,cv=q(4)-sa*sb/N;o[y*W+x]=va>N*9&&vb>N*9?cv/Math.sqrt(va*vb):0}return o}
 let footBits=2;// streets only: OSM/Microsoft footprints in Casablanca still hold many demolished houses, so they cannot veto what the images show
 const toWorldF=(m,u,v)=>CasaGeo.tilePoint(m.x0+u*DS/TS,m.y0+v*DS/TS,RZ);
 function outlineSharp(cells,toWorld){return outline(cells,toWorld,.8,false)}
 // separable square dilate/erode via running sums
 function boxMax(m,W,H,r,want){const t=new Uint8Array(W*H),o=new Uint8Array(W*H);
  for(let y=0;y<H;y++){let c=0;for(let x=-r;x<W;x++){if(x+r<W&&m[y*W+x+r]===want)c++;if(x-r-1>=0&&m[y*W+x-r-1]===want)c--;if(x>=0)t[y*W+x]=c>0?want:1-want}}
  for(let x=0;x<W;x++){let c=0;for(let y=-r;y<H;y++){if(y+r<H&&t[(y+r)*W+x]===want)c++;if(y-r-1>=0&&t[(y-r-1)*W+x]===want)c--;if(y>=0)o[y*W+x]=c>0?want:1-want}}return o}
 function closeMask(m,W,H,r){return boxMax(boxMax(m,W,H,r,1),W,H,r,0)}
 function fillHoles(m,W,H,maxPx){const seen=new Uint8Array(W*H);for(let i=0;i<W*H;i++){if(m[i]||seen[i])continue;const comp=[],st=[i];seen[i]=1;let edge=false;
   while(st.length){const j=st.pop(),x=j%W,y=j/W|0;comp.push(j);if(!x||!y||x===W-1||y===H-1)edge=true;for(const q of [x>0?j-1:-1,x<W-1?j+1:-1,y>0?j-W:-1,y<H-1?j+W:-1])if(q>=0&&!m[q]&&!seen[q]){seen[q]=1;st.push(q)}}
   if(!edge&&comp.length<maxPx)for(const j of comp)m[j]=1}}
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
   if(builtLike(a,ea)&&eb<=ea*.6&&(b.v-a.v>.15||b.b-a.b>.15)&&b.l<235)A[i]=1}// gone = turned to soil or green, never just 'smoother' (new roofs and asphalt are smooth too)
  // tolerance for misregistration: no clearly built cell in the later image within one cell (~2 m)
  const T=new Uint8Array(nx*ny);for(let v=0;v<ny;v++)for(let u=0;u<nx;u++){if(!A[v*nx+u])continue;let ok=1;for(let dv=-1;dv<=1&&ok;dv++)for(let du=-1;du<=1;du++){const uu=u+du,vv=v+dv;if(uu>=0&&vv>=0&&uu<nx&&vv<ny&&B[vv*nx+uu]){ok=0;break}}T[v*nx+u]=ok}
  // closing (dilate then erode, one cell): joins the scattered cells of one cleared area into one shape
  const D=new Uint8Array(nx*ny),at=(M,u,v)=>u>=0&&v>=0&&u<nx&&v<ny?M[v*nx+u]:0;
  for(let v=0;v<ny;v++)for(let u=0;u<nx;u++){let h=0;for(let dv=-1;dv<=1&&!h;dv++)for(let du=-1;du<=1;du++)if(at(T,u+du,v+dv)){h=1;break}D[v*nx+u]=h}
  for(let v=0;v<ny;v++)for(let u=0;u<nx;u++){let all=1;for(let dv=-1;dv<=1&&all;dv++)for(let du=-1;du<=1;du++){const uu=u+du,vv=v+dv;if(uu>=0&&vv>=0&&uu<nx&&vv<ny&&!D[vv*nx+uu]){all=0;break}}out[v*nx+u]=all}
  return out}
 // component → outline rings in local metres (cell-boundary trace, Douglas–Peucker, Chaikin)
 function outline(cells,toWorld,eps=1.2,smooth=true){const S=new Set(cells.map(([u,v])=>u+','+v)),edges=new Map(),k=(x,y)=>x+','+y;
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
  return rings.map(r=>{const w=r.map(([u,v])=>toWorld(u,v));const s=dpRing(w,eps);return s.length>=4?(smooth?chaikin(s):s):null}).filter(Boolean)}
 const ringArea=r=>{let s=0;for(let i=0;i<r.length-1;i++)s+=r[i][0]*r[i+1][1]-r[i+1][0]*r[i][1];return s/2};
 const bboxOf=rings=>{const p=rings.flat();return[Math.min(...p.map(q=>q[0])),Math.min(...p.map(q=>q[1])),Math.max(...p.map(q=>q[0])),Math.max(...p.map(q=>q[1]))]};
 // context masks at 4 m over the frame: 1 = standing footprint, 2 = street (8 m wide), 4 = built-up city in 2015 (GHSL)
 let MK=null;async function masks(){if(MK)return MK;const F=[-9725.897,8018.927,5274.103,23018.927],R=4,W=Math.ceil((F[2]-F[0])/R),H=Math.ceil((F[3]-F[1])/R);
  const layer=draw=>{const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d',{willReadFrequently:true});g.setTransform(1/R,0,0,-1/R,-F[0]/R,F[3]/R);g.fillStyle=g.strokeStyle='#f00';draw(g);const d=g.getImageData(0,0,W,H).data,m=new Uint8Array(W*H);for(let i=0;i<m.length;i++)m[i]=d[i*4]>128?1:0;return m};
  const all=[...(window.DNA?.buildings||[])];const seen=new Set();if(typeof msGrid!=='undefined')for(const a of msGrid.values())for(const b of a)if(!seen.has(b)){seen.add(b);all.push(b)}
  const fpM=layer(g=>{for(let k=0;k<all.length;k+=5000){g.beginPath();for(const b of all.slice(k,k+5000))for(const r of b.r){r.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath()}g.fill()}});
  const osM=layer(g=>{const ob=window.DNA?.buildings||[];for(let k=0;k<ob.length;k+=5000){g.beginPath();for(const b of ob.slice(k,k+5000))for(const r of b.r){r.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath()}g.fill()}});
  const rdM=layer(g=>{g.lineWidth=8;g.lineCap=g.lineJoin='round';g.beginPath();for(const r of window.DNA?.roads||[]){if(/footway|path|steps|track/.test(r.t||''))continue;for(const part of r.r)part.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]))}g.stroke()});
  const he=await fetch('data/hist_extents.json?v=2').then(r=>r.json()).catch(()=>null),e15=he?.['2015'];const ghM=layer(g=>{const rr=e15?.r||e15?.rings||(Array.isArray(e15)?e15:[]);g.beginPath();for(const r of rr){r.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath()}g.fill('evenodd')});
  MK={at:(x,y)=>{const u=Math.floor((x-F[0])/R),v=Math.floor((F[3]-y)/R);if(u<0||v<0||u>=W||v>=H)return 0;const i=v*W+u;return fpM[i]|(rdM[i]<<1)|(ghM[i]<<2)|(osM[i]<<3)}};return MK}
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
   // independent checks: no standing footprint (OSM + Microsoft) over it, no street on it, inside the 2015 built-up city (GHSL ≥15%), ≥250 m²
   message=L('جارٍ استبعاد المباني القائمة والشوارع…','Removing standing buildings and streets…');refresh('preciseScan');await new Promise(r=>setTimeout(r,30));
   const mk=await masks();const kept=found.filter(c=>{if(c.area<250)return false;let n=0,fp=0,rd=0;for(let x=c.b[0]+2;x<c.b[2];x+=4)for(let y=c.b[1]+2;y<c.b[3];y+=4){if(!ChangeGeometry.contains(c.rings,x,y))continue;n++;const q=mk.at(x,y);if(q&1)fp++;if(q&2)rd++}
    if(!n||fp/n>.25||rd/n>.35)return false;return!!(mk.at((c.b[0]+c.b[2])/2,(c.b[1]+c.b[3])/2)&4)});found.length=0;found.push(...kept);
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
 // ---------- shape: bind the detected area to the real urban blocks (OSM streets polygonised) ----------
 // A block mostly cleared (≥55%) is taken whole, with its exact street edges. A block partly cleared keeps only the
 // cleared part, cut along the block's edges and straightened (Douglas–Peucker 2 m, no smoothing), so the result
 // reads as a drawn polygon, not as a trace of pixels.
 let BLK=null;async function blocks(){if(BLK)return BLK;const d=await fetch('data/blocks.json').then(r=>r.json());BLK=d.blocks.map(b=>{const f=b[6],r=[];for(let i=0;i<f.length;i+=2)r.push([f[i],f[i+1]]);const xs=r.map(p=>p[0]),ys=r.map(p=>p[1]);return{r,b:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]}});return BLK}
 async function shape(c){if(!c.rings?.length)return c;const raw=c.raw||c.rings;c.raw=raw;const BL=await blocks(),bb=bboxOf(raw),R=1,pad=4,x0=bb[0]-pad,y1=bb[3]+pad,W=Math.ceil((bb[2]-bb[0]+2*pad)/R),H=Math.ceil((bb[3]-bb[1]+2*pad)/R);
  const ras=draw=>{const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d',{willReadFrequently:true});g.setTransform(1/R,0,0,-1/R,-x0/R,y1/R);g.fillStyle='#f00';g.beginPath();draw(g);g.fill('evenodd');const d=g.getImageData(0,0,W,H).data,m=new Uint8Array(W*H);for(let i=0;i<m.length;i++)m[i]=d[i*4]>127?1:0;return m};
  const path=(g,rings)=>{for(const r of rings){r.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath()}};
  const M=ras(g=>path(g,raw)),mArea=M.reduce((s,v)=>s+v,0)||1,out=[];let used=0;
  for(const k of BL){if(k.b[2]<bb[0]||k.b[0]>bb[2]||k.b[3]<bb[1]||k.b[1]>bb[3])continue;const B=ras(g=>path(g,[k.r]));let inB=0,both=0;for(let i=0;i<B.length;i++)if(B[i]){inB++;if(M[i])both++}
   if(!both)continue;const blockArea=Math.abs(ringArea(k.r)),share=both*R*R/Math.max(1,blockArea);
   if(share>=.55&&blockArea<60000){out.push(k.r.map(p=>p.slice()));used+=both;continue}
   if(both*R*R<120)continue;// the cleared part of a large block: mask ∩ block, traced at 1 m and straightened
   const cells=[];for(let v=0;v<H;v++)for(let u=0;u<W;u++)if(B[v*W+u]&&M[v*W+u])cells.push([u,v]);
   for(const ring of outline(cells,(u,v)=>[x0+u*R,y1-v*R],2,false))out.push(ring);used+=both}
  // pieces outside any block (block data missing) are straightened in place
  if(used<mArea*.5){const cells=[];for(let v=0;v<H;v++)for(let u=0;u<W;u++)if(M[v*W+u])cells.push([u,v]);c.rings=outline(cells,(u,v)=>[x0+u*R,y1-v*R],2,false)}else c.rings=out;
  c.rings=c.rings.filter(r=>Math.abs(ringArea(r))>=120);c.area=c.rings.reduce((s,r)=>s+Math.abs(ringArea(r)),0);if(c.rings.length)c.b=bboxOf(c.rings);c.shaped=true;return c}
 async function shapeAll(){let n=0;for(const c of cands){if(c.refined&&c.rings?.length&&!c.shaped){try{await shape(c)}catch{}if(++n%40===0){await new Promise(r=>setTimeout(r,0))}}}save();render();return n}
 // ---------- SAM: the real edge of each cleared site ----------
 // SlimSAM (Segment Anything, Meta; Xenova/slimsam-77-uniform via transformers.js, runs in this browser) is given
 // points inside each detected piece on the 2026 image and cuts out the whole object there along its real edge
 // (fence, kerb, wall). A SAM mask is kept only if the images agree: ≥55% of it is open ground in 2026 and ≥30% of
 // it was roof fabric in 2015, and it holds at least half of the detected piece.
 let SAM=null;async function sam(){if(SAM)return SAM;const T=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2');T.env.allowLocalModels=false;
  const id='Xenova/slimsam-77-uniform',[model,processor]=await Promise.all([T.SamModel.from_pretrained(id,{dtype:'q8'}),T.AutoProcessor.from_pretrained(id)]);SAM={T,model,processor};return SAM}
 // chamfer distance inside a bitmap (for picking points deep inside a piece)
 function dist(m,W,H){const d=new Float32Array(W*H);for(let i=0;i<W*H;i++)d[i]=m[i]?1e9:0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(!d[i])continue;let v=d[i];if(x)v=Math.min(v,d[i-1]+1);if(y)v=Math.min(v,d[i-W]+1);if(x&&y)v=Math.min(v,d[i-W-1]+1.41);if(y&&x<W-1)v=Math.min(v,d[i-W+1]+1.41);d[i]=(x&&y&&x<W-1&&y<H-1)?v:Math.min(v,1)}
  for(let y=H-1;y>=0;y--)for(let x=W-1;x>=0;x--){const i=y*W+x;if(!d[i])continue;let v=d[i];if(x<W-1)v=Math.min(v,d[i+1]+1);if(y<H-1)v=Math.min(v,d[i+W]+1);if(x<W-1&&y<H-1)v=Math.min(v,d[i+W+1]+1.41);if(y<H-1&&x)v=Math.min(v,d[i+W-1]+1.41);d[i]=v}return d}
 async function samCut(box,signal){const R=await refine(box,signal),{W,H,mask,lab,st,mb,ma}=R.dbg,n=W*H;
  const okS=s=>s&&s.n>=4,Bb=new Uint8Array(n),Oa=new Uint8Array(n);for(let i=0;i<n;i++){const s=st[lab[i]];if(okS(s)){Bb[i]=builtB(s)?1:0;Oa[i]=openA(s)?1:0}}
  const {T,model,processor}=await sam();const rgb=new Uint8ClampedArray(n*3);for(let i=0;i<n*3;i++)rgb[i]=mb.px[i];
  const img=new T.RawImage(rgb,W,H,3),inp=await processor(img),emb=await model.get_image_embeddings(inp),[rh,rw]=inp.reshaped_input_sizes[0],sx=rw/W,sy=rh/H;
  // pieces of the detection
  const seen=new Uint8Array(n),pieces=[];for(let i=0;i<n;i++){if(!mask[i]||seen[i])continue;const comp=[],stck=[i];seen[i]=1;while(stck.length){const j=stck.pop(),x=j%W,y=j/W|0;comp.push(j);for(const q of [x>0?j-1:-1,x<W-1?j+1:-1,y>0?j-W:-1,y<H-1?j+W:-1])if(q>=0&&mask[q]&&!seen[q]){seen[q]=1;stck.push(q)}}if(comp.length>=800)pieces.push(comp)}
  const U=new Uint8Array(n);let kept=0;const mk=await masks(),c00=toWorldF(ma,0,0),c10=toWorldF(ma,W,0),c01=toWorldF(ma,0,H);
  for(const comp of pieces){const P=new Uint8Array(n);for(const j of comp)P[j]=1;const D=dist(P,W,H);
   // up to 3 points: the deepest, then the deepest ones at least 25 px (12 m) from those already chosen
   const order=comp.slice().sort((a,b)=>D[b]-D[a]),pts=[];for(const j of order){if(D[j]<4)break;const x=j%W,y=j/W|0;if(pts.every(([a,b])=>Math.hypot(a-x,b-y)>=25))pts.push([x,y]);if(pts.length===3)break}
   if(!pts.length)continue;
   const input_points=new T.Tensor('float32',pts.flatMap(([x,y])=>[(x+.5)*sx,(y+.5)*sy]),[1,1,pts.length,2]),input_labels=new T.Tensor('int64',BigInt64Array.from(pts.map(()=>1n)),[1,1,pts.length]);
   const out=await model({...emb,input_points,input_labels}),masks=await processor.post_process_masks(out.pred_masks,inp.original_sizes,inp.reshaped_input_sizes),md=masks[0].data,sc=out.iou_scores.data,K=md.length/n;
   let best=-1,bs=-1;for(let k=0;k<K;k++){let a=0,ov=0,op=0,bu=0;for(let i=0;i<n;i++)if(md[k*n+i]){a++;if(P[i])ov++;if(Oa[i])op++;if(Bb[i])bu++}
    if(!a||a>n*.6)continue;const fit=ov/comp.length;if(op/a<.55||bu/a<.3||fit<.5)continue;const score=sc[k]+.3*fit;if(score>bs){bs=score;best=k}}
   // a mask lying mostly on a building OSM still maps (a station roof, a mall) is a roof, not cleared ground
   if(best>=0){let a=0,os=0;for(let i=0;i<n;i+=3)if(md[best*n+i]){a++;const x=i%W,y=i/W|0,q=mk.at(c00[0]+(c10[0]-c00[0])*x/W+(c01[0]-c00[0])*y/H,c00[1]+(c10[1]-c00[1])*x/W+(c01[1]-c00[1])*y/H);if(q&8)os++}if(os/Math.max(1,a)>.4)best=-1}
   if(best<0)continue;kept++;for(let i=0;i<n;i++)if(md[best*n+i])U[i]=1}
  // outlines along SAM's edge (0.5 m pixels, straightened 0.6 m)
  const toWorld=(u,v)=>CasaGeo.tilePoint(ma.x0+u*DS/TS,ma.y0+v*DS/TS,RZ).map(q=>Math.round(q*10)/10),px2=(.25*DS)**2,s2=new Uint8Array(n),polys=[];
  for(let i=0;i<n;i++){if(!U[i]||s2[i])continue;const comp=[],stck=[i];s2[i]=1;while(stck.length){const j=stck.pop(),x=j%W,y=j/W|0;comp.push([x,y]);for(const q of [x>0?j-1:-1,x<W-1?j+1:-1,y>0?j-W:-1,y<H-1?j+W:-1])if(q>=0&&U[q]&&!s2[q]){s2[q]=1;stck.push(q)}}
   if(comp.length*px2<250)continue;const rings=outline(comp,toWorld,.6,false);if(rings.length)polys.push({rings,area:Math.abs(rings.reduce((s,r)=>s+ringArea(r),0))})}
  return{polys,before:R.before,pieces:pieces.length,kept,dbg:{W,H,U,mask,mb,ma}}}
 // ---------- refine a candidate / the view at 0.5 m ----------
 const grow_=(b,m)=>[b[0]-m,b[1]-m,b[2]+m,b[3]+m];
 async function refineCand(c,signal){if(c.refined&&c.method==='sam')return c;const R=await samCut(grow_(c.b,40),signal),near=grow_(c.b,8);
  const hit=R.polys.filter(p=>overlap(bboxOf(p.rings),near));c.refined=true;c.before=R.before.release;
  if(!hit.length){c.rings=[];c.area=0;if(c.status==='pending')c.status='rejected';c.note='no change at 0.5 m';return c}
  c.rings=hit.flatMap(p=>p.rings);c.area=hit.reduce((s,p)=>s+p.area,0);c.b=bboxOf(c.rings);c.method='sam';return c}
 async function refineView(){if(running)return;running=true;message=L('جارٍ الرصد بدقة 0.5 م لما على الشاشة…','Reading the view at 0.5 m…');refresh('preciseScan');
  try{const [a,b]=world(innerWidth*.2,innerHeight*.8),[c,d]=world(innerWidth*.8,innerHeight*.2),half=300,cx=(a+c)/2,cy=(b+d)/2,box=[Math.max(Math.min(a,c),cx-half),Math.max(Math.min(b,d),cy-half),Math.min(Math.max(a,c),cx+half),Math.min(Math.max(b,d),cy+half)];
   const R=await samCut(box);let n=0;for(const p of R.polys){const pb=bboxOf(p.rings);if(cands.some(q=>q.refined&&q.rings.length&&overlap(q.b,pb)))continue;cands.unshift({rings:p.rings,b:pb,area:p.area,status:'pending',src:'refined',refined:true,before:R.before.release});n++}
   cur=n?0:cur;save();message=L(`أُضيف ${n} موقع بحدود دقيقة. راجعيها بـ Y/N.`,`${n} sites added with exact edges. Review with Y/N.`)}
  catch(e){message=e.message}finally{running=false;refresh('preciseScan');render()}}
 async function refineAll(){if(running)return;running=true;controller=new AbortController();const todo=cands.filter(c=>c.src!=='pen'&&c.status==='pending'&&(!c.refined||c.method!=='sam'));let done=0,i=0;
  const work=async()=>{while(i<todo.length&&!controller.signal.aborted){const c=todo[i++];try{await refineCand(c,controller.signal)}catch{}done++;if(done%5===0){save();message=L(`دُقّق ${done} من ${todo.length}`,`Refined ${done} of ${todo.length}`);const el=document.querySelector('[data-ps-status]');if(el)el.textContent=message;render()}}};
  try{await Promise.all([work(),work(),work()])}finally{running=false;save();const kept=cands.filter(c=>c.refined&&c.rings.length).length;message=L(`انتهى التدقيق · بقي ${kept} موقع بتغيّر حقيقي`,`Refinement done · ${kept} sites with real change`);refresh('preciseScan');render()}}
 // ---------- review ----------
 async function go(i){if(!cands.length)return;cur=(i+cands.length)%cands.length;const c=cands[cur];fit(ChangeGeometry.evidenceBox(c.b));
  if((!c.refined||c.method!=='sam')&&c.status==='pending'&&c.src!=='pen'&&!running){message=L('جارٍ رسم الحدود بدقة 0.5 م…','Drawing exact edges at 0.5 m…');refresh('preciseScan');try{await refineCand(c);save();message=c.rings.length?L(`الحدود الدقيقة: ${(c.area/1e4).toFixed(2)} هكتار`,`Exact edges: ${(c.area/1e4).toFixed(2)} ha`):L('لا تغيّر حقيقي هنا بدقة 0.5 م (رُفض تلقائيًا)','No real change here at 0.5 m (auto-rejected)')}catch(e){message=e.message}}
  refresh('preciseScan');render()}
 function setStatus(s){if(cur<0||!cands[cur])return;cands[cur].status=s;save();const nx=cands.findIndex((c,i)=>i>cur&&c.status==='pending');go(nx>=0?nx:cur+1)}
 document.addEventListener('keydown',e=>{if(!windows.has('preciseScan')||/INPUT|TEXTAREA/.test(e.target.tagName))return;const k=e.key.toLowerCase();
  if(k==='y'){setStatus('confirmed');e.preventDefault()}else if(k==='n'){setStatus('rejected');e.preventDefault()}else if(k==='u'){setStatus('unsure');e.preventDefault()}
  else if(e.key==='ArrowRight'){go(cur+1);e.preventDefault()}else if(e.key==='ArrowLeft'){go(cur-1);e.preventDefault()}});
 // wand click on the map (a click, not a drag)
 let down=null;addEventListener('pointerdown',e=>{if(e.target.id==='map')down=[e.clientX,e.clientY]},true);
 addEventListener('pointerup',e=>{if(!wand||e.target.id!=='map'||!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>4)return;const [wx,wy]=world(e.clientX,e.clientY);grow(wx,wy)},true);
 // ---------- pen: the outline is drawn by hand, vertex by vertex, over the real images ----------
 let pen=false,draft=[],hoverPt=null,showYear=1;
 function imagery(){try{if(!window.Imagery||pair.length<2)return;const S=Imagery.state;S.enabled=true;S.swipe=false;S.left=pair[showYear];S.right=pair[1-showYear];Imagery.sync?.();render()}catch{}}
 function setPen(on){pen=on;draft=[];hoverPt=null;canvas.style.cursor=pen?'crosshair':'grab';if(pen){wand=false;ensurePair().then(imagery)}message=pen?L('القلم: اضغطي نقطة نقطة على حدّ المنطقة. اضغطي على أول نقطة أو Enter للإغلاق · Backspace تراجع · Esc إلغاء · T يبدّل 2014/2026','Pen: click vertex by vertex. Click the first point or Enter to close · Backspace undo · Esc cancel · T swaps 2014/2026'):'';refresh('preciseScan');render()}
 function closeDraft(){if(draft.length<3){message=L('تحتاجين 3 نقاط على الأقل.','Needs at least 3 points.');refresh('preciseScan');return}
  const ring=[...draft,draft[0]].map(p=>p.map(n=>Math.round(n*10)/10)),area=Math.abs(ringArea(ring));cands.unshift({rings:[ring],b:bboxOf([ring]),area,status:'confirmed',src:'pen'});cur=0;draft=[];save();
  message=L(`أُضيف مضلّع ${(area/1e4).toFixed(2)} هكتار. ارسمي التالي أو أغلقي القلم.`,`Added ${(area/1e4).toFixed(2)} ha. Draw the next one or close the pen.`);refresh('preciseScan');render()}
 addEventListener('pointerup',e=>{if(!pen||e.target.id!=='map'||!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>4)return;e.stopImmediatePropagation();
  const p=world(e.clientX,e.clientY);if(draft.length>=3){const f=draft[0];if(Math.hypot(p[0]-f[0],p[1]-f[1])*view.s<9){closeDraft();return}}draft.push(p);render()},true);
 addEventListener('pointermove',e=>{if(!pen||e.target.id!=='map'||!draft.length)return;hoverPt=world(e.clientX,e.clientY);render()},true);
 document.addEventListener('keydown',e=>{if(!pen||/INPUT|TEXTAREA/.test(e.target.tagName))return;
  if(e.key==='Enter'){closeDraft();e.preventDefault()}else if(e.key==='Backspace'){draft.pop();render();e.preventDefault()}else if(e.key==='Escape'){if(draft.length){draft=[];render()}else setPen(false);e.preventDefault()}
  else if(e.key.toLowerCase()==='t'){showYear=1-showYear;imagery();message=L('الصورة الآن: ','Image now: ')+(pair[showYear]?.release||'');refresh('preciseScan');e.preventDefault();e.stopImmediatePropagation()}},true);
 function centre(c){return[(c.b[0]+c.b[2])/2,(c.b[1]+c.b[3])/2]}
 function exportResult(){const drawn=cands.filter(c=>(c.src==='pen'||c.refined)&&c.rings.length),conf=drawn.filter(c=>c.status==='confirmed'),uns=drawn.filter(c=>c.status==='unsure'),ha=a=>Math.round(a.reduce((s,c)=>s+c.area,0)/1e3)/10;
  const out={generated:new Date().toISOString().slice(0,10),method:'Coarse scan (Esri Wayback z17, 2 m cells) points at likely sites; each is re-read at zoom 19 (0.5 m) and its edge cut by SlimSAM (Segment Anything, Meta, via transformers.js) on the 2026 image, the cut kept only if ≥55% open ground after and ≥30% roof fabric before and not mostly on an OSM building; — earliest 2015+ release vs 2026, aligned by cross-correlation, cut into SLIC superpixels on both years, each superpixel judged "roof fabric before → open ground after", standing OSM/Microsoft footprints and streets excluded; outlines follow superpixel edges; every confirmed polygon reviewed by eye',
   pair:pair.map(p=>({id:p.id,release:p.release})),counts:{candidates:cands.length,confirmed:conf.length,unsure:uns.length,rejected:cands.filter(c=>c.status==='rejected').length,pending:cands.filter(c=>c.status==='pending').length},areaHa:{confirmed:ha(conf),unsure:ha(uns)},
   groups:[...conf,...uns].map(c=>({rings:c.rings,status:c.status,src:c.src,area:Math.round(c.area)}))};
  return fetch('/__save/demolition_v3.json',{method:'POST',body:JSON.stringify(out)}).then(r=>{message=r.ok?L(`حُفظ: ${conf.length} مؤكَّد (${out.areaHa.confirmed} هكتار) في data/demolition_v3.json`,`Saved: ${conf.length} confirmed (${out.areaHa.confirmed} ha) to data/demolition_v3.json`):L('تعذّر الحفظ','Save failed');refresh('preciseScan')})}
 // ---------- window ----------
 function content(){const n=s=>cands.filter(c=>c.status===s).length,c=cands[cur];
  return `<p class="lead">${L('رصد الهدم الدقيق','Precise demolition mapping')}</p>
  <p class="tiny">${L('صورة 2014 مقابل 2026 بدقة ≈1 م، تُقرأ كل 2 م. «كان سقفًا» → «صار تربة أو أخضر». بدون شرط البصمات، فالبراريك تُحتسب. الحدود مرسومة على شكل المنطقة نفسها.','2014 vs 2026 at ≈1 m, read every 2 m. “Was a roof” → “is soil or green”. No footprint rule, so shacks count. Outlines follow the area itself.')}</p>
  <p class="tiny">${L('المسح الأول يؤشّر فقط (دوائر متقطّعة). كل مؤشّر يُعاد قراءته بدقة 0.5 م: تُقسَّم الصورتان إلى قطع تتبع الجدران والشوارع، وتُحكم كل قطعة «سقف كثيف قبل ← أرض مفتوحة بعد». المبنى القائم اليوم والشارع لا يُحتسبان.','The first scan only points (dashed circles). Each pointer is re-read at 0.5 m: both images are cut into pieces that follow walls and streets, and each piece is judged “dense roofs before → open ground after”. Standing buildings and streets never count.')}</p>
  ${DEV?`<div class="menuGrid"><button class="action" data-ps-scan="view" ${running?'disabled':''}>${L('مسح حول العرض (≈1.8 كم)','Scan around view (≈1.8 km)')}</button><button class="action" data-ps-scan="full" ${running?'disabled':''}>${L('مسح الإطار كاملًا','Scan the whole frame')}</button>
  <button class="action" data-ps-all ${running?'disabled':''}>${L('دقّقي كل المرشّحين (0.5 م)','Refine all candidates (0.5 m)')}</button><button class="action" data-ps-view ${running?'disabled':''}>${L('رصد 0.5 م لما على الشاشة','Read the view at 0.5 m')}</button><button class="action" data-ps-year>T · ${pair[showYear]?.release||L('الصورة','image')}</button>${running?`<button class="action" data-ps-stop>${L('إيقاف','Stop')}</button>`:''}</div>`:''}
  <p role="status" data-ps-status>${esc(message)}</p>
  <p class="tiny">${L('للمراجعة','Review')}: <b>Y</b> ${L('هُدم','demolished')} · <b>N</b> ${L('لا','no')} · <b>U</b> ${L('غير متأكدة','unsure')} · ← →</p>
  <p>${L('مرشّحات','Candidates')} ${cands.length} · <span style="color:#d4a73a">${L('مؤكَّد','confirmed')} ${n('confirmed')}</span> · ${L('غير محسوم','unsure')} ${n('unsure')} · ${L('مرفوض','rejected')} ${n('rejected')} · ${L('بانتظار','pending')} ${n('pending')}</p>
  ${c?`<p><b>${cur+1} / ${cands.length}</b> · ${(c.area/1e4).toFixed(2)} ha · ${c.src==='wand'?L('بالعصا','wand'):L('مسح','scan')} · <b>${c.status}</b></p><div class="evidencePair">${pair.map((p,i)=>`<figure><figcaption>${p.release}</figcaption><canvas data-ps-proof="${i}" width="380" height="380"></canvas></figure>`).join('')}</div>
   <div class="menuGrid"><button class="action" data-ps-set="confirmed">Y · ${L('هُدم','demolished')}</button><button class="action" data-ps-set="rejected">N · ${L('لا','no')}</button><button class="action" data-ps-set="unsure">U · ${L('غير متأكدة','unsure')}</button></div>`:''}
  ${DEV&&cands.length?`<button class="action" data-ps-export>${L('احفظي النتيجة للموقع','Save the result for the site')} ↓</button>`:''}`}
 async function bind(body){const on=(s,f)=>body.querySelectorAll(s).forEach(b=>b.onclick=()=>f(b));
  on('[data-ps-scan]',b=>scan(b.dataset.psScan==='full'));on('[data-ps-stop]',()=>controller?.abort());on('[data-ps-all]',()=>refineAll());on('[data-ps-view]',()=>refineView());on('[data-ps-year]',()=>{showYear=1-showYear;imagery();refresh('preciseScan')});
  on('[data-ps-set]',b=>setStatus(b.dataset.psSet));on('[data-ps-export]',()=>exportResult());
  const c=cands[cur];if(c){await ensurePair();pair.forEach((src,i)=>{const t=body.querySelector(`[data-ps-proof="${i}"]`);if(t)Imagery.renderEvidence(t,src,ChangeGeometry.evidenceBox(c.b),c.rings).catch(()=>{})})}}
 function paint(ctx){if(!visible||!windows.has('preciseScan'))return;const col={confirmed:'#d4a73a',unsure:'#d4a73a',rejected:'#777',pending:'#ff7a3d'};
  for(const [i,c] of cands.entries()){if(c.src==='pen'||c.refined)continue;if(c.status==='rejected'&&i!==cur)continue;// coarse finds not yet refined are only pointers
   const [x,y]=centre(c),r=Math.max(10/view.s,Math.sqrt(c.area)/2);ctx.beginPath();ctx.arc(x,-y,r,0,7);ctx.strokeStyle=col[c.status];ctx.lineWidth=(i===cur?2.4:1)/view.s;ctx.setLineDash([3/view.s,3/view.s]);ctx.stroke();ctx.setLineDash([]);
   ctx.beginPath();ctx.arc(x,-y,2.5/view.s,0,7);ctx.fillStyle=col[c.status];ctx.fill()}
  for(const [i,c] of cands.entries()){if(!(c.src==='pen'||c.refined)||!c.rings.length||(c.status==='rejected'&&i!==cur))continue;const p=new Path2D();for(const r of c.rings)r.forEach((q,j)=>j?p.lineTo(q[0],-q[1]):p.moveTo(q[0],-q[1]));p.closePath();
   ctx.fillStyle=col[c.status]+(c.status==='confirmed'?'66':'22');ctx.fill(p,'evenodd');ctx.strokeStyle=col[c.status];ctx.lineWidth=(i===cur?2.6:1.2)/view.s;ctx.setLineDash(c.status==='unsure'?[4/view.s,3/view.s]:[]);ctx.stroke(p);ctx.setLineDash([])}
  if(pen&&draft.length){const pts=hoverPt?[...draft,hoverPt]:draft;ctx.beginPath();pts.forEach((q,j)=>j?ctx.lineTo(q[0],-q[1]):ctx.moveTo(q[0],-q[1]));ctx.strokeStyle='#ffd36a';ctx.lineWidth=1.6/view.s;ctx.stroke();
   for(const [j,q] of draft.entries()){ctx.beginPath();ctx.arc(q[0],-q[1],(j?2.6:4.5)/view.s,0,7);ctx.fillStyle=j?'#ffd36a':'#fff';ctx.fill()}}}
 function open(){openWindow('preciseScan');fromFile().then(ensurePair).then(()=>refresh('preciseScan')).catch(()=>{})}
 return{lib:{sam,mosaicZ,layersOf,outline,ringArea,bboxOf,boxMax,closeMask,fillHoles,RZ,DS,TS},open,content,bind,paint,scan,refine,setJudge:f=>{judge=f},samCut,shape,shapeAll,builtB:s=>builtB(s),openA:s=>openA(s),setRules:(b,o)=>{if(b)builtB=b;if(o)openA=o},get candidates(){return cands},get running(){return running},get message(){return message}};
})();
