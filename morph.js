'use strict';
/* Exercise 1.3 · Morphology — street-network patterns read from measurable traits, not clustering.
   Per 400 m cell inside the 15 km frame, from the OSM street graph and footprints:
   junction types (dead end / T / X), orientation order and right-angle share, intersection density
   and building coverage (GSI). Each pattern has an explicit rule; the evidence stays on the map. */
window.Morph13=(()=>{
 const CELL=400,FRAME=[-9725.897,8018.927,5274.103,23018.927];
 const DRIVE=new Set(['primary','secondary','tertiary','residential','unclassified','living_street','service','trunk','primary_link','secondary_link','tertiary_link','trunk_link','pedestrian']);
 let cells=null,junctions=null,cellOf=null,segsAll=null,paths=null;
 const key=p=>Math.round(p[0]*2)+','+Math.round(p[1]*2); // 0.5 m snapping of shared OSM nodes
 function compute(builtCells){
  if(cells)return cells;
  // 1. Node degree: each way end counts once, each interior vertex twice; shared vertices add up.
  const deg=new Map(),pos=new Map();
  const segs=[];
  for(const r of roads){if(!DRIVE.has(r.t))continue;for(const part of r.r){for(let i=0;i<part.length;i++){const k=key(part[i]);deg.set(k,(deg.get(k)||0)+(i===0||i===part.length-1?1:2));pos.set(k,part[i]);if(i)segs.push([part[i-1],part[i]])}}}
  junctions=[];for(const [k,d] of deg){if(d===2)continue;const p=pos.get(k);if(p[0]<FRAME[0]||p[0]>FRAME[2]||p[1]<FRAME[1]||p[1]>FRAME[3])continue;junctions.push({c:p,t:d===1?1:d===3?3:4})}
  const id=(x,y)=>Math.floor((x-FRAME[0])/CELL)+','+Math.floor((y-FRAME[1])/CELL),M=new Map();
  const get=k=>{let c=M.get(k);if(!c){const [i,j]=k.split(',').map(Number);c={i,j,box:[FRAME[0]+i*CELL,FRAME[1]+j*CELL,FRAME[0]+(i+1)*CELL,FRAME[1]+(j+1)*CELL],n1:0,n3:0,n4:0,len:0,bins:new Float64Array(18),built:0};M.set(k,c)}return c};
  for(const j of junctions){const c=get(id(...j.c));c['n'+j.t]++}
  // 2. Length-weighted bearings (0–180°, 10° bins).
  for(const [a,b] of segs){const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;if(mx<FRAME[0]||mx>FRAME[2]||my<FRAME[1]||my>FRAME[3])continue;const L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<1)continue;let ang=Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI;ang=((ang%180)+180)%180;const c=get(id(mx,my));c.bins[Math.min(17,Math.floor(ang/10))]+=L;c.len+=L}
  // 3. Built cover from GHS-BUILT (100 m, % of cell). OSM footprints are too incomplete for coverage (the medina reads 9%).
  const bc=new Map();for(const f of builtCells||[]){const x=(f.b[0]+f.b[2])/2,y=(f.b[1]+f.b[3])/2,k=id(x,y),a=bc.get(k)||[0,0];a[0]+=f.v;a[1]++;bc.set(k,a)}
  for(const [k,c] of M){const a=bc.get(k);c.built=a?a[0]/a[1]:0}
  cells=[];cellOf=M;segsAll=segs;
  for(const c of M.values()){const nj=c.n1+c.n3+c.n4;if(nj<8||c.len<800)continue;const km2=CELL*CELL/1e6;
   const tot=c.bins.reduce((a,b)=>a+b,0),p=[...c.bins].map(v=>v/tot);let H=0;for(const q of p)if(q>0)H-=q*Math.log(q);
   const order=1-H/Math.log(18);let top=0;for(let i=1;i<18;i++)if(p[i]>p[top])top=i;
   const near=i=>p[(i+17)%18]+p[i]+p[(i+1)%18],right=near(top)+near((top+9)%18);
   Object.assign(c,{dead:c.n1/nj,tShare:c.n3/Math.max(1,c.n3+c.n4),xShare:c.n4/Math.max(1,c.n3+c.n4),order,right,axis:near(top),idens:(c.n3+c.n4)/km2,topDeg:top*10+5});
   c.type=classify(c);cells.push(c)}
  return cells}
 // Explicit rules, checked in this order. Calibrated on known places: Maarif and Hay Mohammadi (grid),
 // the colonial downtown (radial), the old medina, Aïn Chock and Derb Sultan (dense T-combs).
 const RULES=[
  ['grid',c=>c.right>=.6&&c.xShare>=.3,['شبكة متعامدة / شطرنج','Orthogonal grid / chessboard'],'#5fb4ff',['≥ 60% من طول الشوارع على اتجاهين متعامدين، وتقاطعات + ≥ 30%','≥ 60% of street length on two perpendicular bearings, ≥ 30% four-way junctions']],
  ['radial',c=>c.xShare>=.35&&c.right<.5,['شعاعي / شبيه باريس','Radial / Paris-like'],'#8ce0a0',['تقاطعات + ≥ 35% لكن الشوارع لا تتعامد (< 50% على اتجاهين متعامدين): بولفارات قُطرية تلتقي في ساحات','≥ 35% four-way junctions but streets not orthogonal (< 50% on two perpendicular bearings): diagonal boulevards meeting at squares']],
  ['medina',c=>c.tShare>=.9&&c.idens>=250&&c.built>=30&&c.dead>=.15&&c.order<.3,['نسيج عضوي / مدينة قديمة','Organic / old medina'],'#e8b04a',['تقاطعات T ≥ 90%، ≥ 250 تقاطعًا/كم²، مبني ≥ 30%، طرق مسدودة ≥ 15%، اتجاهات متفرّقة','T-junctions ≥ 90%, ≥ 250 junctions/km², built ≥ 30%, dead ends ≥ 15%, scattered bearings']],
  ['fishbone',c=>c.tShare>=.85&&c.idens>=350&&c.axis>=.28&&c.right>=.5,['سمكة: محور وتفرعات قصيرة','Fishbone: spine with short branches'],'#ff6a3d',['تقاطعات T ≥ 85%، كثيفة جدًا (≥ 350/كم²)، محور واحد يحمل ≥ 28% من الطول، والتفرعات متعامدة عليه','T-junctions ≥ 85%, very dense (≥ 350/km²), one bearing carries ≥ 28% of length, branches at right angles to it']],
  ['honeycomb',c=>c.tShare>=.8&&c.right<.5,['خلية نحل: تقاطعات ثلاثية بلا اتجاه','Honeycomb: three-way junctions, no direction'],'#c58cff',['تقاطعات T ≥ 80% والشوارع لا تتبع اتجاهين متعامدين (< 50%)','T-junctions ≥ 80% and streets follow no perpendicular pair (< 50%)']],
  ['mixed',()=>true,['انتقالي / مختلط','Transitional / mixed'],'#6d6d66',['لا يطابق أي قاعدة أعلاه','matches none of the rules above']]];
 function classify(c){for(const [id,test] of RULES)if(test(c))return id}
 // One Path2D per pattern: each street segment takes the pattern of the cell its midpoint falls in (y flipped for the map).
 let segBy=null;
 function streetPaths(){if(paths)return paths;paths={};segBy={};for(const [id] of RULES){paths[id]=new Path2D();segBy[id]=[]}
  for(const [a,b] of segsAll){const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,c=cellOf.get(Math.floor((mx-FRAME[0])/CELL)+','+Math.floor((my-FRAME[1])/CELL));if(!c||!c.type)continue;const p=paths[c.type];p.moveTo(a[0],-a[1]);p.lineTo(b[0],-b[1]);segBy[c.type].push([a,b])}
  return paths}
 return{compute,RULES,streetPaths,get segmentsByType(){streetPaths();return segBy},get cells(){return cells},get junctions(){return junctions},CELL};
})();
