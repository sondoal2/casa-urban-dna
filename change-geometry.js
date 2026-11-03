'use strict';
window.ChangeGeometry=(()=>{
 const bounds=rings=>{const p=rings.flat();return[Math.min(...p.map(p=>p[0])),Math.min(...p.map(p=>p[1])),Math.max(...p.map(p=>p[0])),Math.max(...p.map(p=>p[1]))]};
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 function segmentHit(a,b,c,d){const eps=1e-7,between=(a,b,p)=>Math.abs(cross(a,b,p))<eps&&p[0]>=Math.min(a[0],b[0])-eps&&p[0]<=Math.max(a[0],b[0])+eps&&p[1]>=Math.min(a[1],b[1])-eps&&p[1]<=Math.max(a[1],b[1])+eps;const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);return(x*y<0&&z*w<0)||between(a,b,c)||between(a,b,d)||between(c,d,a)||between(c,d,b)}
 const open=ring=>ring.length>1&&Math.hypot(ring[0][0]-ring.at(-1)[0],ring[0][1]-ring.at(-1)[1])<1e-7?ring.slice(0,-1):ring.slice();
 function close(ring){const r=open(ring).map(p=>p.slice());return r.length?[...r,r[0].slice()]:r}
 function area(rings){return Math.abs(rings.reduce((s,r)=>s+open(r).reduce((n,p,i,a)=>{const q=a[(i+1)%a.length];return n+p[0]*q[1]-q[0]*p[1]},0)/2,0))}
 function valid(rings){if(!Array.isArray(rings)||!rings.length||rings.length>40)return false;for(const ring of rings){if(!Array.isArray(ring)||ring.length>3000||ring.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||Math.abs(p[0])>200000||Math.abs(p[1])>200000))return false;const r=open(ring);if(r.length<3)return false;for(let i=0;i<r.length;i++){if(Math.hypot(r[i][0]-r[(i+1)%r.length][0],r[i][1]-r[(i+1)%r.length][1])<.05)return false;for(let j=i+1;j<r.length;j++){if(j===i+1||i===0&&j===r.length-1)continue;if(segmentHit(r[i],r[(i+1)%r.length],r[j],r[(j+1)%r.length]))return false}}}return area(rings)>1}
 function contains(rings,x,y){let inside=false;for(const r of rings){let hit=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit}if(hit)inside=!inside}return inside}
 function evidenceBox(box){const pad=Math.max(25,Math.max(box[2]-box[0],box[3]-box[1])*.3),cx=(box[0]+box[2])/2,cy=(box[1]+box[3])/2,half=Math.max(box[2]-box[0],box[3]-box[1])/2+pad;return[cx-half,cy-half,cx+half,cy+half]}
 return{bounds,area,valid,contains,open,close,evidenceBox};
})();
