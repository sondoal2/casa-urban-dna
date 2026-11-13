'use strict';
window.ChangeScan=(()=>{
 const L=(ar,en)=>Locale.language==='ar'?ar:en;
 const z=16,tileSize=256,cellSize=4,cellsPerTile=tileSize/cellSize,step=cellSize/tileSize;
 let running=false,cancelled=false,message='',groups=[],pair=[],chosen=null,visible=false,scannedExtent=null;
 function summarize(pixels){
  const stride=tileSize+1,size=stride*stride;
  const brightness=new Float64Array(size),edges=new Float64Array(size),bare=new Float64Array(size),water=new Float64Array(size);
  const light=i=>pixels[i]*.299+pixels[i+1]*.587+pixels[i+2]*.114;
  for(let y=0;y<tileSize;y++){
   let lightRow=0,edgeRow=0,bareRow=0,waterRow=0;
   for(let x=0;x<tileSize;x++){
    const i=(y*tileSize+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2],l=light(i);
    const edgeX=x<tileSize-1?Math.abs(l-light(i+4)):Math.abs(l-light(i-4));
    const edgeY=y<tileSize-1?Math.abs(l-light(i+4*tileSize)):Math.abs(l-light(i-4*tileSize));
    lightRow+=l;
    edgeRow+=(edgeX+edgeY)/2;
    if(l>95&&r>=g-4&&g>=b-5&&r-b>6&&g<r*1.11)bareRow++;
    if(b>r+8&&b>=g-4)waterRow++;
    const j=(y+1)*stride+x+1;
    brightness[j]=brightness[j-stride]+lightRow;
    edges[j]=edges[j-stride]+edgeRow;
    bare[j]=bare[j-stride]+bareRow;
    water[j]=water[j-stride]+waterRow;
   }
  }
  return (u,v)=>{
   const x=u*cellSize+cellSize/2,y=v*cellSize+cellSize/2,radius=8;
   const left=Math.max(0,x-radius),right=Math.min(tileSize,x+radius);
   const top=Math.max(0,y-radius),bottom=Math.min(tileSize,y+radius);
   const count=(right-left)*(bottom-top);
   const average=a=>(a[bottom*stride+right]-a[bottom*stride+left]-a[top*stride+right]+a[top*stride+left])/count;
   return{brightness:average(brightness),edges:average(edges),bare:average(bare),water:average(water)};
  };
 }
 function signal(a,b){
  if(a.edges<8||b.edges>a.edges*.76||b.bare<.46||b.bare-a.bare<.14||b.brightness<a.brightness-8)return 0;
  return (1-b.edges/a.edges)+(b.bare-a.bare);
 }
 function boundarySupport(a,b){
  return a.edges>=6&&b.edges<=a.edges*.93&&b.bare>=.30&&b.bare-a.bare>=.05&&b.brightness>=a.brightness-14;
 }
 // Context raster over the study frame at 10 m: red = a mapped footprint (OSM or Microsoft) within ~10 m,
 // green = within ~200 m of the 0 m contour (shoreline). Beaches lose parasols and look like "built → bare",
 // so a coastal change only counts where a footprint shows something was built there.
 // blue = within 25 m of a rail line or 6 m of an OSM service road: trains, parked cars and port containers come and go.
 const maskRes=10;let masks=null;
 async function loadMasks(frameBox){
  if(masks)return masks;
  const [x0,y0,x1,y1]=frameBox,w=Math.ceil((x1-x0)/maskRes),h=Math.ceil((y1-y0)/maskRes);
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const c=canvas.getContext('2d',{willReadFrequently:true});
  c.setTransform(1/maskRes,0,0,-1/maskRes,-x0/maskRes,y1/maskRes);
  const [ex,ms]=await Promise.all([fetch('data/ex13.json').then(r=>r.ok?r.json():null).catch(()=>null),fetch('data/missing-ms.json').then(r=>r.ok?r.json():[]).catch(()=>[])]);
  c.strokeStyle='#00ff00';c.lineWidth=400;c.lineJoin=c.lineCap='round';
  for(const f of ex?.layers?.contours?.features||[]){if(f.v!==0)continue;for(const ring of f.r){c.beginPath();ring.forEach((s,i)=>{const [x,y]=String(s).split(' ').map(Number);i?c.lineTo(x,y):c.moveTo(x,y)});c.stroke()}}
  c.globalCompositeOperation='lighter';c.strokeStyle='#0000ff';
  const line=pts=>{c.beginPath();pts.forEach((p,i)=>{const [x,y]=typeof p==='string'?p.split(' ').map(Number):p;i?c.lineTo(x,y):c.moveTo(x,y)});c.stroke()};
  c.lineWidth=50;for(const f of ex?.layers?.rail?.features||[])for(const part of f.r||[])line(part);
  c.lineWidth=12;for(const r of roads)if(r.t==='service')for(const part of (Array.isArray(r.r[0]?.[0])?r.r:[r.r]))line(part);
  c.fillStyle=c.strokeStyle='#ff0000';c.lineWidth=20;
  for(const b of [...buildings,...ms]){if(!overlap(b.b,frameBox))continue;const p=new Path2D();for(const ring of b.r)ring.forEach((v,i)=>i?p.lineTo(v[0],v[1]):p.moveTo(v[0],v[1]));c.fill(p);c.stroke(p)}
  const data=c.getImageData(0,0,w,h).data;
  masks=(x,y)=>{const u=Math.floor((x-x0)/maskRes),v=Math.floor((y1-y)/maskRes);if(u<0||v<0||u>=w||v>=h)return{built:false,coast:false,moving:false};const i=(v*w+u)*4;return{built:data[i]>127,coast:data[i+1]>127,moving:data[i+2]>127}};
  return masks;
 }
 // Water in the earlier image (sea, port basins) and rail/service corridors never count.
 // Without a mapped footprint, only a dense roof texture in the earlier image counts as "built before".
 function plausible(ctx,a){if(a.water>.25||ctx.moving)return false;if(ctx.built)return true;if(ctx.coast)return false;return a.edges>=12&&a.bare<.4}
 function loadPixels(source,x,y,signal){
  return new Promise((resolve,reject)=>{
   const image=new Image();image.crossOrigin='anonymous';
   const finish=(err,result)=>{
    clearTimeout(timer);signal.removeEventListener('abort',abort);image.onload=image.onerror=null;
    if(err){image.src='';reject(err)}else resolve(result);
   };
   const abort=()=>finish(Error('cancelled'));
   const timer=setTimeout(()=>finish(Error('tile timeout')),6000);
   signal.addEventListener('abort',abort,{once:true});
   image.onerror=()=>finish(Error('tile unavailable'));
   image.onload=()=>{
    try{const canvas=document.createElement('canvas');canvas.width=canvas.height=tileSize;
     const ctx=canvas.getContext('2d',{willReadFrequently:true});
     ctx.drawImage(image,0,0,tileSize,tileSize);
     finish(null,ctx.getImageData(0,0,tileSize,tileSize).data);
    }catch(e){finish(e)}
   };
   if(signal.aborted){abort();return}
   image.src=source.tile.replace('{z}',z).replace('{x}',x).replace('{y}',y);
  });
 }
 const key=(x,y)=>x+','+y;
 function traceRings(group){
  const edges=new Map();
  const add=(a,b)=>{
   if(!edges.delete(key(...b)+'>'+key(...a)))edges.set(key(...a)+'>'+key(...b),{a,b});
  };
  for(const {x,y} of group){
   add([x,y],[x+1,y]);add([x+1,y],[x+1,y+1]);
   add([x+1,y+1],[x,y+1]);add([x,y+1],[x,y]);
  }
  const outgoing=new Map();
  for(const [id,edge] of edges){
   const k=key(...edge.a),list=outgoing.get(k)||[];
   list.push({id,...edge});outgoing.set(k,list);
  }
  const rings=[];
  while(edges.size){
   const [firstId,first]=edges.entries().next().value;
   const ring=[first.a,first.b];edges.delete(firstId);
   const origin=key(...first.a);
   while(key(...ring.at(-1))!==origin){
    const end=ring.at(-1),prev=ring.at(-2),dx=end[0]-prev[0],dy=end[1]-prev[1];
    const options=(outgoing.get(key(...end))||[]).filter(e=>edges.has(e.id));
    // Follow the same side at a diagonal touch so contours do not cross.
    const next=options.find(e=>e.b[0]-end[0]===-dy&&e.b[1]-end[1]===dx)||options[0];
    if(!next)break;
    edges.delete(next.id);ring.push(next.b);
   }
   if(ring.length<5||key(...ring.at(-1))!==origin)continue;
   const vertices=ring.slice(0,-1);
   const corners=vertices.filter((p,i)=>{
    const prev=vertices[(i+vertices.length-1)%vertices.length],next=vertices[(i+1)%vertices.length];
    return (p[0]-prev[0])*(next[1]-p[1])!==(p[1]-prev[1])*(next[0]-p[0]);
   });
   if(corners.length<4)continue;
   const inset=(p,q)=>{
    const length=Math.hypot(q[0]-p[0],q[1]-p[1]);
    return p.map((n,i)=>n+(q[i]-n)*Math.min(.35,length/3)/length);
   };
   const outline=corners.flatMap((p,i)=>[
    inset(p,corners[(i+corners.length-1)%corners.length]),
    inset(p,corners[(i+1)%corners.length])
   ]);
   outline.push(outline[0]);
   rings.push(outline.map(([u,v])=>CasaGeo.tilePoint(u*step,v*step,z)));
  }
  return rings;
 }
 // A cell is ~9.5 m at z16, so 24 cells ≈ 2,000 m²: informal fabric is read as a contiguous mass, not single roofs.
 const minCells=24;
 function groupCells(cells,checked,support){
  const index=new Map(cells.map(c=>[key(c.x,c.y),c]));
  // Grow from stronger changes only into neighbouring pixels with weaker evidence.
  const frontier=[...cells];
  for(let i=0;i<frontier.length;i++){
   const {x,y,score}=frontier[i];
   for(const [u,v] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
    const k=key(u,v);
    if(!support.has(k)||index.has(k))continue;
    const point={x:u,y:v,score:Math.min(score,.4)};
    index.set(k,point);frontier.push(point);
   }
  }
  const additions=[];
  for(const {x,y,score} of frontier){
   for(const [dx,dy] of [[1,0],[0,1]]){
    const u=x+dx,v=y+dy,k=key(u,v);
    const far=index.get(key(x+2*dx,y+2*dy));
    if(far&&checked.has(k)&&!index.has(k))additions.push({x:u,y:v,score:Math.min(score,far.score)});
   }
  }
  for(const c of additions)index.set(key(c.x,c.y),c);
  const out=[];
  while(index.size){
   const [startKey,start]=index.entries().next().value;
   index.delete(startKey);
   const group=[start];
   for(let i=0;i<group.length;i++){
    const {x,y}=group[i];
    for(const [u,v] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
     const k=key(u,v),next=index.get(k);
     if(next){group.push(next);index.delete(k)}
    }
   }
   if(group.length<minCells)continue;
   const rings=traceRings(group);
   if(!rings.length)continue;
   const bounds=ChangeGeometry.bounds(rings);
   const score=group.reduce((sum,c)=>sum+c.score,0)/group.length;
   const area=ChangeGeometry.area(rings);
   out.push({rings,bounds,score,area});
  }
  return out.sort((a,b)=>b.area*b.score-a.area*a.score);
 }
 const storageKey='casablanca-study-scan-v2';
 let controller,studyOpened=false;
 function studyTiles(frame,city,range){
  const [x0,y0,x1,y1]=range,n=cellsPerTile;
  const width=(x1-x0+1)*n,height=(y1-y0+1)*n;
  const maskCanvas=document.createElement('canvas');
  maskCanvas.width=width;maskCanvas.height=height;
  const ctx=maskCanvas.getContext('2d',{willReadFrequently:true});
  const path=rings=>{
   const p=new Path2D();
   for(const ring of rings){
    ring.forEach((point,i)=>{
     const [x,y]=CasaGeo.tileXY(...CasaGeo.inverse(...point),z);
     const u=(x-x0)*n,v=(y-y0)*n;
     if(i)p.lineTo(u,v);else p.moveTo(u,v);
    });
    p.closePath();
   }
   return p;
  };
  ctx.fill(path(frame),'evenodd');
  ctx.globalCompositeOperation='destination-in';
  ctx.fill(path(city),'evenodd');
  const mask=ctx.getImageData(0,0,width,height).data;
  const inside=(x,y)=>x>=0&&x<width&&y>=0&&y<height&&mask[(y*width+x)*4+3]>=128;
  const tiles=[];
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const left=(x-x0)*n,top=(y-y0)*n;
   let count=0;
   for(let v=0;v<n;v++)for(let u=0;u<n;u++)if(inside(left+u,top+v))count++;
   if(count)tiles.push({x,y,count,left,top});
  }
  return{tiles,inside,x0,y0};
 }
 function restoreStudy(){
  try{
   const cached=JSON.parse(localStorage.getItem(storageKey)||'null');
   if(!cached||!cached.groups?.length||cached.pair?.length!==2)return false;
   groups=cached.groups;pair=cached.pair;scannedExtent=cached.extent;chosen=null;visible=true;
   message=L('نتائج المسح المحفوظ · التغطية '+cached.percent+'% · '+groups.length+' مرشّحة','Saved scan · '+cached.percent+'% coverage · '+groups.length+' candidates');
   Transform.setPair(...pair);fit(scannedExtent);refreshPanel();render();
   return true;
  }catch{return false}
 }
 function refreshPanel(){refresh('changeScan')}
 async function start(target=null,full=false){
  if(running)return;
  running=true;cancelled=false;groups=[];chosen=null;scannedExtent=null;visible=true;controller=new AbortController();
  const viewport=currentBounds(),half=750;
  const scope=target||[
   Math.max(viewport[0],view.x-half),Math.max(viewport[1],view.y-half),
   Math.min(viewport[2],view.x+half),Math.min(viewport[3],view.y+half)
  ];
  let timedOut=false,deadline;
  message=L('جارٍ اختيار نسختي التصوير…','Selecting imagery releases…');refreshPanel();render();
  try{
   if(Imagery.sources.length<3)await Imagery.loadCatalog();
   const sources=Imagery.sources.filter(s=>s.release).sort((a,b)=>a.release.localeCompare(b.release));
   if(sources.length<2)throw Error(L('تعذّر تحميل نسختين من الأرشيف.','Two archive releases could not be loaded.'));
   pair=[sources[0],sources.at(-1)];
   if(cancelled)return;
   Transform.setPair(...pair);
   const [boundary,study]=await Promise.all(['data/casablanca-boundary.geojson','data/study.json'].map(async url=>{const r=await fetch(url);if(!r.ok)throw Error('Boundary unavailable');return r.json()}));
   const rings=boundary.geometry.coordinates.map(r=>r.map(p=>CasaGeo.forward(...p)));
   const frame=study.features.find(f=>f.kind==='frame');
   if(!frame)throw Error('Study frame unavailable');
   const extent=full?frame.b:[Math.max(frame.b[0],scope[0]),Math.max(frame.b[1],scope[1]),Math.min(frame.b[2],scope[2]),Math.min(frame.b[3],scope[3])];
   if(extent[0]>=extent[2]||extent[1]>=extent[3])throw Error(L('حرّكي الخريطة إلى داخل إطار الدراسة.','Move the map into the study frame.'));
   scannedExtent=extent;
   message=L('جارٍ تجهيز طبقات الساحل والمباني…','Preparing shoreline and footprint masks…');refreshPanel();
   const context=await loadMasks(frame.b);
   if(target||full)fit(extent);
   render();
   const range=CasaGeo.tileRange(extent,z),[x0,y0,x1,y1]=range;
   const mask=full?studyTiles(frame.r,rings,range):null;
   const tiles=mask?mask.tiles:[];
   if(!mask)for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const cells=[];
    for(let v=0;v<cellsPerTile;v++)for(let u=0;u<cellsPerTile;u++){
     const p=CasaGeo.tilePoint(x+(u+.5)*step,y+(v+.5)*step,z);
     if(p[0]>=extent[0]&&p[0]<=extent[2]&&p[1]>=extent[1]&&p[1]<=extent[3]&&ChangeGeometry.contains(frame.r,...p)&&ChangeGeometry.contains(rings,...p))cells.push({u,v});
    }
    if(cells.length)tiles.push({x,y,cells,count:cells.length});
   }
   const centre=CasaGeo.tileXY(...CasaGeo.inverse(view.x,view.y),z);
   tiles.sort((a,b)=>Math.hypot(a.x+.5-centre[0],a.y+.5-centre[1])-Math.hypot(b.x+.5-centre[0],b.y+.5-centre[1]));
   if(!tiles.length)throw Error(L('مركز العرض خارج نطاق المسح. حرّكي الخريطة إلى داخل الدار البيضاء.','The view centre is outside the scan area. Move the map into Casablanca.'));
   if(cancelled)return;
   if(!full)deadline=setTimeout(()=>{timedOut=true;controller.abort()},25000);
   const results=[],checked=new Set(),support=new Set(),loadedTiles=new Set();let next=0,done=0,failed=0,covered=0;
   const checkedCells=mask?{has(id){
    const [x,y]=id.split(',').map(Number),tx=Math.floor(x/cellsPerTile),ty=Math.floor(y/cellsPerTile);
    return loadedTiles.has(key(tx,ty))&&mask.inside(x-mask.x0*cellsPerTile,y-mask.y0*cellsPerTile);
   }}:checked;
   message=L(`جارٍ فحص ${tiles.length} بلاطة…`,`Checking ${tiles.length} tiles…`);
   refreshPanel();
   async function worker(){
    while(!controller.signal.aborted&&next<tiles.length){
     const {x,y,cells,count,left,top}=tiles[next++];
     try{
      const [a,b]=await Promise.all(pair.map(s=>loadPixels(s,x,y,controller.signal)));
      const old=summarize(a),recent=summarize(b);
      covered+=count;loadedTiles.add(key(x,y));
      const inspect=(u,v)=>{
       const gx=x*cellsPerTile+u,gy=y*cellsPerTile+v;
       if(!mask)checked.add(key(gx,gy));
       const a=old(u,v),b=recent(u,v);
       const score=signal(a,b),edge=boundarySupport(a,b);
       if(!score&&!edge)return;
       if(!plausible(context(...CasaGeo.tilePoint(x+(u+.5)*step,y+(v+.5)*step,z)),a))return;
       if(edge)support.add(key(gx,gy));
       if(score)results.push({x:gx,y:gy,score});
      };
      if(mask){
       for(let v=0;v<cellsPerTile;v++)for(let u=0;u<cellsPerTile;u++)if(mask.inside(left+u,top+v))inspect(u,v);
      }else for(const {u,v} of cells)inspect(u,v);
     }catch{failed++}
     done++;
     if(!full||done<=3||done%12===0||done===tiles.length)groups=groupCells(results,checkedCells,support);
     message=L(`فُحصت ${done} من ${tiles.length} بلاطة · ${groups.length} مرشّحة · تعذّر ${failed}`,`Checked ${done} of ${tiles.length} tiles · ${groups.length} candidates · ${failed} failed`);
     if(chosen){const status=document.querySelector('[data-scan-progress]');if(status)status.textContent=message}
     else if(!full||done<=3||done%12===0||done===tiles.length)refreshPanel();
     else {const status=document.querySelector('[data-scan-progress]');if(status)status.textContent=message}
     render();
     if(done>=5&&failed===done)controller.abort();
    }
   }
   await Promise.all(Array.from({length:5},worker));
   groups=groupCells(results,checkedCells,support);
   const total=tiles.reduce((sum,t)=>sum+t.count,0),percent=Math.round(100*covered/Math.max(1,total));
   message=L(`${timedOut?'انتهت مهلة المسح':cancelled?'مسح متوقف':'انتهى المسح'} · التغطية ${percent}% · ${groups.length} مواقع مرشّحة`,`${timedOut?'Scan time limit reached':cancelled?'Scan stopped':'Scan finished'} · ${percent}% coverage · ${groups.length} candidates`);
   if(full&&groups.length){
    try{localStorage.setItem(storageKey,JSON.stringify({groups:groups.map(({rings,bounds,score,area})=>({rings,bounds,score,area})),pair,extent,percent}))}catch{}
   }
   if(covered&&!groups.length)message+=L(' · راجعي حدود المسح السماوية والصورتين',' · Check the cyan scan boundary and both images');
   if(!covered&&!cancelled)message=L('تعذّرت قراءة بكسلات التصوير من الأرشيف.','Archive imagery pixels could not be read.');
  }catch(e){message=e.message}
  finally{clearTimeout(deadline);running=false;refreshPanel();render()}
 }
 // Researcher review per candidate, keyed by its rounded bounds so it survives rescans.
 const reviewKey='casablanca-scan-review-v1',reviewColor={confirmed:'#ff6a3d',rejected:'#8a8a8a',unsure:'#ffb347'};
 let reviews={};try{reviews=JSON.parse(localStorage.getItem(reviewKey)||'{}')||{}}catch{}
 const gid=g=>g.bounds.map(n=>Math.round(n/10)).join(',');
 function setReview(g,state){if(reviews[gid(g)]===state)delete reviews[gid(g)];else reviews[gid(g)]=state;try{localStorage.setItem(reviewKey,JSON.stringify(reviews))}catch{}refreshPanel();render()}
 const reviewLabel=s=>({confirmed:L('مؤكَّد','Confirmed'),rejected:L('مرفوض','Rejected'),unsure:L('غير محسوم','Unsure')})[s]||'';
 function open(){openWindow('changeScan')}
 // Scanning and reviewing are research tools: only on the local dev server. Visitors see the reviewed results.
 const DEV=/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
 // Reviewed results shipped with the site (data/demolition.json): every viewer sees the same
 // candidates at once, with the researcher's status as the default review.
 async function loadReviewed(){
  try{
   const r=await fetch('data/demolition.json?v=1');if(!r.ok)return false;const d=await r.json();
   if(Imagery.sources.length<3)await Imagery.loadCatalog().catch(()=>{});
   groups=d.groups;pair=d.pair.map(p=>Imagery.sources.find(s=>s.id===p.id)||p);scannedExtent=d.extent;chosen=null;visible=true;
   for(const g of groups)if(g.status&&!reviews[gid(g)])reviews[gid(g)]=g.status;
   message=L(`نتائج مراجَعة ${d.generated} · ${d.counts.confirmed} هدم مؤكَّد (${d.areaHa.confirmed} هكتار) · ${d.counts.unsure} غير محسوم · استُبعد ${d.counts.rejected}`,`Reviewed results ${d.generated} · ${d.counts.confirmed} confirmed demolitions (${d.areaHa.confirmed} ha) · ${d.counts.unsure} unsure · ${d.counts.rejected} rejected`);
   Transform.setPair(...pair);fit(scannedExtent);refreshPanel();render();return true;
  }catch{return false}
 }
 // one site, clicked on the map: its numbers and the before / after crops from the archive
 let v4Pick=null,aerial=false;
 const relSrc=y=>{const rel=window.Threats?.demolitions?.meta.releases?.[y];return Imagery.sources.find(s=>s.release===rel)||null};
 function v4Site(){const g=v4Pick;if(!g)return`<p class="tiny" style="opacity:.75">${L('اضغطي على أي موقع أحمر في الخريطة لتظهر معلوماته وصورة المقارنة.','Click any red site on the map to see its details and the before / after images.')}</p>`;
  const thr=g.status==='threatened',ty={slum:L('تفكيك صفيح','slum clearance'),project:L('إخلاء لمشروع','clearance for a project'),rebuild:L('هدم وإعادة بناء','demolished and rebuilt'),collapse:L('انهيار','collapse')}[g.type]||g.type,
   yrs=thr?[2015,2026]:[g.before,g.gone];
  return`<div class="card"><p class="tiny"><b>${g.id}</b> · ${thr?L('مهدد بالهدم','threatened'):ty} · <b>${fmt(g.ha,2)} ha</b>${thr?'':` · ${L('هُدم بين','demolished between')} ${g.before} ${L('و','and')} ${g.gone}`} <button class="action" data-v4-close style="min-width:0;padding:0 6px;float:inline-end">×</button></p>
  <div class="evidencePair">${yrs.map((y,i)=>`<figure><figcaption>${y} · ${window.Threats.demolitions.meta.releases?.[y]||''}</figcaption><canvas data-v4-proof="${i}" data-y="${y}" width="400" height="400"></canvas><small data-v4-proof-status="${i}"></small></figure>`).join('')}</div>
  ${g.source?`<p class="tiny">${L('مصدر','Source')}: ${esc(g.source)}</p>`:''}<p class="tiny" style="opacity:.7">Esri Wayback · ${L('تواريخ نشر الأرشيف','archive release dates')}</p></div>`}
 function setAerial(on){aerial=on;const S=Imagery.state;if(on){const go=()=>{const s=relSrc(2026)||Imagery.sources.filter(x=>x.release).slice(-1)[0];if(s){S.enabled=true;S.swipe=false;S.left=s;S.right=s}Imagery.sync?.();render()};Imagery.sources.some(x=>x.release)?go():Imagery.loadCatalog().then(go)}else{S.enabled=false;S.swipe=false;Imagery.sync?.();render()}}
 {let d0=null;addEventListener('pointerdown',e=>{d0=e.target.id==='map'?[e.clientX,e.clientY]:null},true);
  addEventListener('click',e=>{if(!d0||e.target.id!=='map'||Math.hypot(e.clientX-d0[0],e.clientY-d0[1])>5||windows.has('demoReview'))return;const g=window.Threats?.hitSite?.(e.clientX,e.clientY);if(!g)return;v4Pick=g;if(!windows.has('changeScan'))open();else refresh('changeScan')})}

 // public summary of the reviewed sites (data/demolition_v4.json): hectares per phase + a year slider
 function v4Summary(){const D=window.Threats?.demolitions;if(!D)return`<p class="tiny">${L('يحمّل مواقع الهدم…','Loading demolition sites…')}</p>`;
  const gone=D.g.filter(g=>g.status!=='threatened'),thr=D.g.filter(g=>g.status==='threatened'),yrs=[...new Set(gone.map(g=>g.gone))].sort(),up=Math.min(Threats.upTo,yrs[yrs.length-1]),
   ha=D.PH.map((p,k)=>gone.filter(g=>g.ph===k).reduce((a,g)=>a+g.ha,0)),tot=ha.reduce((a,b)=>a+b,0),shown=gone.filter(g=>g.gone<=up),shHa=shown.reduce((a,g)=>a+g.ha,0),
   y0=D.meta.years?.[0]||2015;
  return`<button class="action" data-v4-toggle aria-pressed="${Threats.showDemolition}">${Threats.showDemolition?'● '+L('طبقة الهدم ظاهرة · إخفاء','Demolition layer on · hide'):'○ '+L('طبقة الهدم مخفية · إظهار','Demolition layer off · show')}</button><div class="card"><p class="lead" style="margin:0">${fmt(tot,1)} ${L('هكتار هُدمت','hectares demolished')}</p>
  <p class="tiny">${gone.length} ${L('موقع','sites')} · ${y0}–${yrs[yrs.length-1]}</p>
  ${(()=>{const yh=yrs.map(y=>gone.filter(g=>g.gone===y).reduce((a,g)=>a+g.ha,0)),mx=Math.max(...yh);return`<div style="display:flex;align-items:flex-end;gap:6px;height:110px;margin:10px 0 4px;direction:ltr">${yrs.map((y,i)=>{const c=D.PH[D.PH.findIndex(p=>y<=p.to)].col;return`<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;opacity:${y<=up?1:.25}"><small style="font-size:10px;white-space:nowrap">${fmt(yh[i],1)}</small><span style="display:block;width:100%;height:${Math.max(2,yh[i]/mx*80)}px;background:${c}"></span><small style="font-size:10px">${y}</small><small style="font-size:9px;opacity:.7">${gone.filter(g=>g.gone===y).length} ${L('موقع','sites')}</small></div>`}).join('')}</div><p class="tiny" style="margin:0 0 6px">${L('هكتار حسب أول سنة اختفت فيها البيوت','Hectares by the first year the houses are gone')}</p>`})()}
  ${D.PH.map((p,k)=>`<p class="tiny" style="margin:2px 0"><span style="color:${p.col}">■</span> ${L(p.ar,p.en)} · <b>${fmt(ha[k],1)} ha</b> · ${Math.round(ha[k]/tot*100)}% · ${fmt(ha[k]/[6,2,3][k],1)} ${L('هكتار/سنة','ha/yr')}</p>`).join('')}
  ${(()=>{const a=gone.map(g=>g.ha).sort((x,y)=>x-y),med=a[a.length>>1],big=gone.reduce((m,g)=>g.ha>m.ha?g:m,gone[0]),TYN={slum:L('تفكيك صفيح','slum clearance'),project:L('إخلاء لمشروع','clearance for a project'),rebuild:L('هدم وإعادة بناء','demolished and rebuilt'),collapse:L('انهيار','collapse')},ty={};for(const g of gone){ty[g.type]=ty[g.type]||[0,0];ty[g.type][0]++;ty[g.type][1]+=g.ha}
   const row=(k,v)=>`<tr><td style="padding:3px 0;opacity:.75">${k}</td><td style="padding:3px 0;text-align:end"><b>${v}</b></td></tr>`;
   return`<table class="tiny" style="width:100%;border-collapse:collapse;margin-top:10px;border-top:1px solid rgba(128,128,128,.3)">
   ${row(L('عدد المواقع','Sites'),gone.length)}${row(L('متوسط الهدم في السنة (2015–2026)','Average per year (2015–2026)'),fmt(tot/11,1)+' ha')}
   ${row(L('حجم الموقع الوسيط','Median site size'),fmt(med,2)+' ha')}${row(L('أكبر موقع','Largest site'),fmt(big.ha,1)+' ha · '+big.gone)}
   ${row(L('أسرع فترة','Fastest phase'),L(D.PH[[0,1,2].sort((x,y)=>ha[y]/[6,2,3][y]-ha[x]/[6,2,3][x])[0]].ar,D.PH[[0,1,2].sort((x,y)=>ha[y]/[6,2,3][y]-ha[x]/[6,2,3][x])[0]].en))}
   ${Object.entries(ty).sort((x,y)=>y[1][1]-x[1][1]).map(([k,v])=>row(TYN[k]||k,v[0]+' · '+fmt(v[1],1)+' ha')).join('')}</table>`})()}
  <p class="tiny" style="margin-top:10px">${L('حتى سنة','Up to')} <b>${up}</b> · ${shown.length} ${L('موقع','sites')} · <b>${fmt(shHa,1)} ha</b></p>
  <input type="range" data-v4-year min="0" max="${yrs.length-1}" step="1" value="${yrs.indexOf(up)}" style="width:100%;direction:ltr">
  <p class="tiny" dir="ltr" style="display:flex;justify-content:space-between;margin:0">${yrs.map(y=>`<span>${y}</span>`).join('')}</p>
  ${thr.length?`<p class="tiny" style="margin-top:8px"><span style="color:#ff4d24">┅</span> ${L('خط أحمر ينبض: مهدد بالهدم','Pulsing red outline: threatened with demolition')} · ${thr.length}</p>`:''}</div>
  <p class="tiny">${L('رُسمت كل المواقع باليد على أرشيف Esri Wayback، مربعًا مربعًا (شبكة 1 كم). السنة = أول نسخة أرشيف تختفي فيها البيوت، فالهدم حصل بينها وبين النسخة اللي قبلها. التواريخ تواريخ نشر الأرشيف لا تواريخ الالتقاط. أحياء الصفيح القائمة رُصدت أيضًا لكنها غير معروضة ولا محسوبة.','Every site was traced by hand on the Esri Wayback archive, cell by cell (1 km grid). The year is the first archive release in which the houses are gone, so the demolition happened between it and the release before. Dates are archive releases, not capture dates. Standing slums were also mapped but are neither shown nor counted.')}</p>`}
 function fitV4(){const D=window.Threats?.demolitions;if(!D?.g.length)return false;const b=D.g.reduce((a,g)=>[Math.min(a[0],g.b[0]),Math.min(a[1],g.b[1]),Math.max(a[2],g.b[2]),Math.max(a[3],g.b[3])],[1e9,1e9,-1e9,-1e9]);fit(b);return true}
 function openStudy(){
  open();
  if(studyOpened||running)return;
  studyOpened=true;
  fitV4()||setTimeout(fitV4,1500);return;
  loadReviewed().then(ok=>{if(!ok&&!restoreStudy()&&DEV)void start(null,true)});
 }
 function choose(index){
  chosen=groups[index];visible=true;
  Transform.setPair(...pair);
  fit(ChangeGeometry.evidenceBox(chosen.bounds));
  refreshPanel();render();
 }
 function content(){
  return `<p class="lead">${L('أين اختفى النسيج؟','Where did the fabric disappear?')}</p><div class="menuGrid"><button class="action" data-v4-aerial aria-pressed="${aerial}">${aerial?'● ':'○ '}${L('التصوير الجوي','Aerial imagery')}</button><button class="action" data-yearcompare>⇆ ${L('مقارنة السنين','Compare years')}</button></div>${v4Site()}${v4Summary()}`;
  return `<p class="lead">${L('أين اختفى النسيج؟','Where did the fabric disappear?')}</p>${v4Summary()}
  ${DEV?`<p>${L('تظهر المضلّعات أثناء فحص الصور داخل حدود الدار البيضاء وإطار الدراسة. يمكنك أيضًا فحص مساحة أصغر حول مركز الخريطة.','Polygons appear as images are checked within Casablanca and the study frame. You can also scan a smaller area around the map centre.')}</p>`:`<p>${L('مواقع هدم حدّدناها بمقارنة صورتين جويتين وراجعناها بصريًا واحدة واحدة.','Demolition sites found by comparing two aerial images and reviewed one by one.')}</p>`}
  ${pair.length?`<p dir="ltr">${pair.map(p=>p.release).join(' ↔ ')}</p>`:''}
  ${DEV?`<button class="action" data-scan-study ${running?'disabled':''}>${L('مسح إطار الدراسة كاملًا','Scan full study area')}</button>
  <button class="action" data-scan-start ${running?'disabled':''}>${L('مسح المنطقة حول مركز الخريطة','Scan around the map centre')}</button>`:''}
  ${DEV&&window.DemoReview?`<button class="action" data-dr-open>● ${L('رصد الهدم · مربع مربع (الورك فلو الجديد)','Demolition review · cell by cell (new workflow)')}</button>`:''}${DEV&&window.PreciseScan?`<button class="action" data-ps-open>${L('رصد دقيق بالحدود الحقيقية (≈1 م) + مراجعة + عصا سحرية','Precise mapping with real outlines (≈1 m) + review + magic wand')} ↗</button>`:''}${running?`<button class="action" data-scan-stop>${L('إيقاف','Stop')}</button>`:''}
  <p role="status" data-scan-progress>${esc(message)}</p>
  <p class="tiny">${L('المضلعات مناطق تغيّر مرشّحة للمراجعة البصرية. التواريخ تخص نشر الصور.','Polygons are change candidates for visual review. Dates refer to imagery releases.')}</p>
  <p class="tiny">${L('يُستبعد الشاطئ (200 م من خط الصفر) إلا إذا كان فيه مبنى مرسوم. التغيّر يُحتسب فقط حيث توجد بصمة مبنى (OSM أو Microsoft) أو نسيج سقوف كثيف في الصورة الأقدم، وككتلة لا تقل عن 2,000 م² تقريبًا.','Beaches (200 m from the 0 m contour) are excluded unless a footprint is mapped there. Change counts only where a footprint (OSM or Microsoft) or dense roof texture exists in the earlier image, as a mass of about 2,000 m² or more.')}</p>
  ${chosen?`<div class="evidencePair">${pair.map((p,i)=>`<figure><figcaption>${p.release}</figcaption><canvas data-scan-proof="${i}" width="400" height="400"></canvas><small data-scan-proof-status="${i}"></small></figure>`).join('')}</div>${DEV?'':`<p class="tiny">${reviewLabel(reviews[gid(chosen)])}</p>`}<div class="menuGrid" ${DEV?'':'hidden'}>${['confirmed','unsure','rejected'].map(s=>`<button class="action" data-scan-review="${s}" aria-pressed="${reviews[gid(chosen)]===s}">${reviews[gid(chosen)]===s?'● ':''}${reviewLabel(s)}</button>`).join('')}</div>`:''}
  ${groups.slice(0,80).map((g,i)=>`<button class="similarRow" data-scan-result="${i}">${L('موقع مرشّح','Candidate')} ${i+1} · ${fmt(g.area/10000,2)} ha${reviews[gid(g)]?' · '+reviewLabel(reviews[gid(g)]):''} ↗</button>`).join('')}`;
 }
 function bind(body){
  const ae=body.querySelector('[data-v4-aerial]');if(ae)ae.onclick=()=>{setAerial(!aerial);refresh('changeScan')};const vc=body.querySelector('[data-v4-close]');if(vc)vc.onclick=()=>{v4Pick=null;refresh('changeScan')};
  if(v4Pick){const box=ChangeGeometry.evidenceBox(v4Pick.b);body.querySelectorAll('[data-v4-proof]').forEach(async cv=>{const st=body.querySelector('[data-v4-proof-status="'+cv.dataset.v4Proof+'"]');try{if(!Imagery.sources.some(x=>x.release))await Imagery.loadCatalog().catch(()=>{});for(let k=0;k<40&&!relSrc(+cv.dataset.y);k++)await new Promise(r=>setTimeout(r,250));const src=relSrc(+cv.dataset.y);if(!src){st.textContent=L('النسخة غير متاحة','Release unavailable');return}const r=await Imagery.renderEvidence(cv,src,box,v4Pick.rings,'#ff4d24');st.textContent=r.ok?'':L('الصورة غير مكتملة','Incomplete image')}catch{st.textContent=L('تعذّر عرض الصورة','Image unavailable')}})}
  const tg=body.querySelector('[data-v4-toggle]');if(tg)tg.onclick=()=>{Threats.showDemolition=!Threats.showDemolition;refresh('changeScan')};
  const v4=body.querySelector('[data-v4-year]');if(v4)v4.oninput=()=>{const D=Threats.demolitions,yrs=[...new Set(D.g.filter(g=>g.status!=='threatened').map(g=>g.gone))].sort();Threats.upTo=yrs[+v4.value];const keep=v4.value;refresh('changeScan');const n=document.querySelector('[data-v4-year]');if(n){n.value=keep;n.focus()}};
  const scanStudy=body.querySelector('[data-scan-study]'),scanStart=body.querySelector('[data-scan-start]');
  if(scanStudy)scanStudy.onclick=()=>start(null,true);
  if(scanStart)scanStart.onclick=()=>start();
  const ps=body.querySelector('[data-ps-open]');if(ps)ps.onclick=()=>PreciseScan.open();const dr=body.querySelector('[data-dr-open]');if(dr)dr.onclick=()=>DemoReview.open();
  const stop=body.querySelector('[data-scan-stop]');
  if(stop)stop.onclick=()=>{cancelled=true;controller.abort()};
  if(chosen){
   const group=chosen,box=ChangeGeometry.evidenceBox(group.bounds);
   pair.forEach(async (source,i)=>{
    const target=body.querySelector('[data-scan-proof="'+i+'"]');
    const status=body.querySelector('[data-scan-proof-status="'+i+'"]');
    if(!target||!status)return;
    try{const result=await Imagery.renderEvidence(target,source,box,group.rings);status.textContent=result.ok?'':L('الصورة غير مكتملة','Incomplete image')}
    catch{status.textContent=L('تعذّر عرض الصورة','Image unavailable')}
   });
  }
  body.querySelectorAll('[data-scan-review]').forEach(el=>el.onclick=()=>chosen&&setReview(chosen,el.dataset.scanReview));
  body.querySelectorAll('[data-scan-result]').forEach(el=>el.onclick=()=>choose(Number(el.dataset.scanResult)));
 }
 function paint(ctx,bounds){
  if(!visible)return;
  if(scannedExtent&&overlap(scannedExtent,bounds)){
   const [x0,y0,x1,y1]=scannedExtent;
   ctx.save();ctx.strokeStyle='#60e1ff';ctx.lineWidth=2/view.s;
   ctx.setLineDash([6/view.s,4/view.s]);
   ctx.strokeRect(x0,-y1,x1-x0,y1-y0);ctx.restore();
  }
  for(const g of groups){
   if(!overlap(g.bounds,bounds))continue;
   const color=reviewColor[reviews[gid(g)]]||'#ffb347';
   // Real shapes, not pixel squares: the building footprints (OSM + Microsoft) whose centre falls inside the
   // detected area are drawn as the change; where there are none, the pixel outline is smoothed (Chaikin).
   if(g.fpPath===undefined){const inside=(x,y)=>{let c=false;for(const r of g.rings)for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])c=!c}return c};
    const fp=new Path2D();let n=0;const test=bd=>{if(!overlap(bd.b,g.bounds))return;const r=bd.r[0];let cx=0,cy=0;for(const p of r){cx+=p[0];cy+=p[1]}cx/=r.length;cy/=r.length;if(inside(cx,cy)){fp.addPath(bd.path||(bd.path=pathFor(bd.r)));n++}};
    for(const bd of window.DNA?.buildings||[])test(bd);if(typeof msGrid!=='undefined'){const seen=new Set();for(const a of msGrid.values())for(const bd of a)if(!seen.has(bd)){seen.add(bd);test(bd)}}
    g.fpPath=n?fp:null;g.fpN=n;
    const smooth=r=>{let p=r.slice(0,-1);for(let k=0;k<3;k++){const q=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];q.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75])}p=q}return[...p,p[0]]};
    g.smoothPath=pathFor(g.rings.map(smooth))}
   ctx.fillStyle=color+(g===chosen?'55':'22');ctx.fill(g.smoothPath,'evenodd');
   ctx.strokeStyle=color;ctx.lineWidth=1.4/view.s;ctx.setLineDash(reviews[gid(g)]==='rejected'?[5/view.s,4/view.s]:[3/view.s,3/view.s]);ctx.stroke(g.smoothPath);ctx.setLineDash([]);
   if(g.fpPath){ctx.fillStyle=color+'cc';ctx.fill(g.fpPath,'evenodd');ctx.strokeStyle=color;ctx.lineWidth=1/view.s;ctx.stroke(g.fpPath)}
  }
 }
 return{open,openStudy,content,bind,paint,scanLocation:bounds=>{open();return start(ChangeGeometry.evidenceBox(bounds))}};
})();
