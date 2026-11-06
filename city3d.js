'use strict';
// City3D: every building (OSM + Microsoft) extruded to its height and drawn by the GPU (WebGL), with shadows
// cast by the same prisms for a chosen sun. The mesh is built once in a Web Worker shortly after the site
// opens, so turning 3D on is instant and nothing freezes. Projection: orthographic, tilted about the x axis;
// the 2D map uses the same tilt (view squashed by cos θ), so every layer lines up.
window.City3D=(()=>{
 let gl=null,cv=null,prog=null,sprog=null,buf=null,ready=false,building=false,count=0,origin=[0,0];
 const opt={buildings:false,shadow:false,theta:55*Math.PI/180,sun:{az:223,alt:18.7}};
 const WORKER=`
 function area(p){let a=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length];a+=p[i][0]*q[1]-q[0]*p[i][1]}return a/2}
 function earcut(p){const n=p.length,idx=[...Array(n).keys()],tris=[];let guard=0;
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const inside=(a,b,c,d)=>cross(a,b,d)>=0&&cross(b,c,d)>=0&&cross(c,a,d)>=0;
  while(idx.length>3&&guard++<5000){let cut=false;for(let i=0;i<idx.length;i++){const i0=idx[(i+idx.length-1)%idx.length],i1=idx[i],i2=idx[(i+1)%idx.length],a=p[i0],b=p[i1],c=p[i2];
    if(cross(a,b,c)<=0)continue;let ok=true;for(const j of idx){if(j===i0||j===i1||j===i2)continue;if(inside(a,b,c,p[j])){ok=false;break}}
    if(ok){tris.push(i0,i1,i2);idx.splice(i,1);cut=true;break}}if(!cut)break}
  if(idx.length===3)tris.push(idx[0],idx[1],idx[2]);else if(idx.length>3)for(let i=1;i<idx.length-1;i++)tris.push(idx[0],idx[i],idx[i+1]);return tris}
 onmessage=e=>{const {xy,offs,hs,ox,oy}=e.data,N=hs.length;let nv=0,ni=0;
  for(let b=0;b<N;b++){const n=offs[b+1]-offs[b];nv+=n*5;ni+=(n-2)*3+n*6}
  const P=new Int16Array(nv*3),S=new Uint8Array(nv),I=new Uint32Array(ni);let v=0,k=0;
  for(let b=0;b<N;b++){let p=[];for(let i=offs[b];i<offs[b+1];i++)p.push([xy[2*i],xy[2*i+1]]);if(area(p)<0)p.reverse();const n=p.length,hq=Math.min(32000,Math.round(hs[b]*10));
   const q=(x,o)=>Math.max(-32760,Math.min(32760,Math.round((x-o)*2)));
   const r0=v;for(const [x,y] of p){P[3*v]=q(x,ox);P[3*v+1]=q(y,oy);P[3*v+2]=hq;S[v]=255;v++}
   for(const t of earcut(p))I[k++]=r0+t;
   for(let i=0;i<n;i++){const a=p[i],c=p[(i+1)%n],dx=c[0]-a[0],dy=c[1]-a[1],L=Math.hypot(dx,dy)||1,nx=dy/L,ny=-dx/L;
    const sh=Math.round(255*(.35+.45*Math.max(0,nx*-.55+ny*-.83)+.2*Math.abs(nx)));const w0=v;
    for(const [pt,z] of [[a,0],[c,0],[c,hq],[a,hq]]){P[3*v]=q(pt[0],ox);P[3*v+1]=q(pt[1],oy);P[3*v+2]=z;S[v]=sh;v++}
    I[k++]=w0;I[k++]=w0+1;I[k++]=w0+2;I[k++]=w0;I[k++]=w0+2;I[k++]=w0+3}}
  postMessage({P:P.subarray(0,v*3),S:S.subarray(0,v),I:I.subarray(0,k)},[P.buffer,S.buffer,I.buffer])}`;
 const VS=`attribute vec3 aP;attribute float aS;uniform vec2 uO,uC,uHalf,uSun;uniform float uS,uK,uZ,uL,uShadow;varying float vH,vS;
  void main(){vec2 w=aP.xy*.5+uO;float z=aP.z*.1;if(uShadow>.5){w-=uSun*z*uL;z=0.;}vec2 d=(w-uC)*uS;float sy=d.y*uK+z*uS*uZ;
  gl_Position=vec4(d.x/uHalf.x,sy/uHalf.y,clamp(((w.y-uC.y)*uZ-z*uK)/60000.,-1.,1.),1.);vH=z;vS=aS;}`;
 const FS=`precision highp float;varying float vH,vS;uniform float uShadow;void main(){if(uShadow>.5){gl_FragColor=vec4(.40,.45,1.,.5);return;}
  vec3 lo=vec3(.20,.22,.27),hi=vec3(.93,.91,.86);vec3 c=mix(lo,hi,clamp(vH/40.,0.,1.)*.7+.3);gl_FragColor=vec4(c*(.4+.6*vS),1.);}`;
 function sh(t,src){const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))console.error(gl.getShaderInfoLog(s));return s}
 function init(){if(gl)return true;cv=document.createElement('canvas');cv.id='gl3d';document.body.appendChild(cv);
  gl=cv.getContext('webgl',{alpha:true,antialias:true,stencil:true,premultipliedAlpha:false});if(!gl){console.warn('WebGL unavailable');return false}
  gl.getExtension('OES_element_index_uint');prog=gl.createProgram();gl.attachShader(prog,sh(gl.VERTEX_SHADER,VS));gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))console.error('City3D link',gl.getProgramInfoLog(prog));
  addEventListener('resize',()=>draw());return true}
 // ex13 hands over footprints + heights once its data is in; the worker builds the mesh off the main thread.
 function prepare(list){if(building||ready)return;if(!init())return;building=true;
  let np=0;for(const b of list)np+=b.r.length;const xy=new Float32Array(np*2),offs=new Uint32Array(list.length+1),hs=new Float32Array(list.length);
  origin=[-2226,15519];let o=0;list.forEach((b,i)=>{offs[i]=o;for(const [x,y] of b.r){xy[2*o]=x;xy[2*o+1]=y;o++}hs[i]=b.h});offs[list.length]=o;
  const w=new Worker(URL.createObjectURL(new Blob([WORKER],{type:'text/javascript'})));
  w.onmessage=e=>{const {P,S,I}=e.data;buf={p:gl.createBuffer(),s:gl.createBuffer(),i:gl.createBuffer()};gl.bindBuffer(gl.ARRAY_BUFFER,buf.p);gl.bufferData(gl.ARRAY_BUFFER,P,gl.STATIC_DRAW);
   gl.bindBuffer(gl.ARRAY_BUFFER,buf.s);gl.bufferData(gl.ARRAY_BUFFER,S,gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,buf.i);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,I,gl.STATIC_DRAW);
   count=I.length;ready=true;building=false;w.terminate();draw()};
  w.postMessage({xy,offs,hs,ox:origin[0],oy:origin[1]},[xy.buffer,offs.buffer,hs.buffer])}
 function draw(){if(!gl)return;const on=(opt.buildings||opt.shadow)&&ready&&!window.Ex13World;cv.style.display=on?'block':'none';if(!on)return;
  const d=Math.min(devicePixelRatio||1,1.5),W=innerWidth,H=innerHeight;if(cv.width!==Math.round(W*d)){cv.width=Math.round(W*d);cv.height=Math.round(H*d)}
  gl.viewport(0,0,cv.width,cv.height);gl.clearColor(0,0,0,0);gl.clearStencil(0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT|gl.STENCIL_BUFFER_BIT);gl.useProgram(prog);
  const U=n=>gl.getUniformLocation(prog,n),th=opt.buildings?opt.theta:0;
  gl.uniform2f(U('uO'),origin[0],origin[1]);gl.uniform2f(U('uC'),view.x,view.y);gl.uniform2f(U('uHalf'),W/2,H/2);gl.uniform1f(U('uS'),view.s);gl.uniform1f(U('uK'),Math.cos(th));gl.uniform1f(U('uZ'),Math.sin(th));
  const az=opt.sun.az*Math.PI/180;gl.uniform2f(U('uSun'),Math.sin(az),Math.cos(az));gl.uniform1f(U('uL'),1/Math.tan(Math.max(2,opt.sun.alt)*Math.PI/180));
  const aP=gl.getAttribLocation(prog,'aP'),aS=gl.getAttribLocation(prog,'aS');gl.bindBuffer(gl.ARRAY_BUFFER,buf.p);gl.enableVertexAttribArray(aP);gl.vertexAttribPointer(aP,3,gl.SHORT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,buf.s);gl.enableVertexAttribArray(aS);gl.vertexAttribPointer(aS,1,gl.UNSIGNED_BYTE,true,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,buf.i);
  if(opt.shadow&&opt.sun.alt>0){gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.enable(gl.STENCIL_TEST);gl.stencilFunc(gl.EQUAL,0,255);gl.stencilOp(gl.KEEP,gl.KEEP,gl.INCR);
   gl.uniform1f(U('uShadow'),1);gl.drawElements(gl.TRIANGLES,count,gl.UNSIGNED_INT,0);gl.disable(gl.STENCIL_TEST)}
  if(opt.buildings){gl.disable(gl.BLEND);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.uniform1f(U('uShadow'),0);gl.drawElements(gl.TRIANGLES,count,gl.UNSIGNED_INT,0)}}
 // Sun position at 33.6° N for a day of the year and a solar hour (NOAA simplified).
 function sunAt(doy,hour){const lat=33.6*Math.PI/180,dec=23.44*Math.PI/180*Math.sin(2*Math.PI*(284+doy)/365),ha=(hour-12)*15*Math.PI/180;
  const alt=Math.asin(Math.sin(lat)*Math.sin(dec)+Math.cos(lat)*Math.cos(dec)*Math.cos(ha));let az=Math.acos((Math.sin(dec)-Math.sin(alt)*Math.sin(lat))/(Math.cos(alt)*Math.cos(lat)));if(ha>0)az=2*Math.PI-az;
  return{alt:alt*180/Math.PI,az:az*180/Math.PI}}
 return{prepare,draw,sunAt,opt,get ready(){return ready},get building(){return building}};
})();
// draw the GPU layer right after every map paint (the map's own paint stays untouched)
if(typeof paint==='function'){const _paint=paint;paint=function(){_paint.apply(this,arguments);City3D.draw()}}
