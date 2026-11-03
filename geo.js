'use strict';
window.CasaGeo=(()=>{
 const R=6378137;
 function forward(lon,lat){const e=.0066943799901413165,k=.9996,p=lat*Math.PI/180,l=(lon+9)*Math.PI/180,ep=e/(1-e),N=R/Math.sqrt(1-e*Math.sin(p)**2),T=Math.tan(p)**2,C=ep*Math.cos(p)**2,A=Math.cos(p)*l,M=R*((1-e/4-3*e*e/64-5*e**3/256)*p-(3*e/8+3*e*e/32+45*e**3/1024)*Math.sin(2*p)+(15*e*e/256+45*e**3/1024)*Math.sin(4*p)-35*e**3/3072*Math.sin(6*p));return[k*N*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*ep)*A**5/120)+500000-630000,k*(M+N*Math.tan(p)*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*ep)*A**6/720))-3700000]}
 function inverse(x,y){const a=R,e=.0066943799901413165,k=.9996,ep=e/(1-e);x+=130000;y+=3700000;const M=y/k,mu=M/(a*(1-e/4-3*e*e/64-5*e**3/256)),e1=(1-Math.sqrt(1-e))/(1+Math.sqrt(1-e)),p=mu+(3*e1/2-27*e1**3/32)*Math.sin(2*mu)+(21*e1**2/16-55*e1**4/32)*Math.sin(4*mu)+151*e1**3/96*Math.sin(6*mu)+1097*e1**4/512*Math.sin(8*mu),C=ep*Math.cos(p)**2,T=Math.tan(p)**2,N=a/Math.sqrt(1-e*Math.sin(p)**2),r=a*(1-e)/(1-e*Math.sin(p)**2)**1.5,D=x/(N*k),lat=p-N*Math.tan(p)/r*(D*D/2-(5+3*T+10*C-4*C*C-9*ep)*D**4/24+(61+90*T+298*C+45*T*T-252*ep-3*C*C)*D**6/720),lon=-9+(D-(1+2*T+C)*D**3/6+(5-2*C+28*T-3*C*C+8*ep+24*T*T)*D**5/120)/Math.cos(p)*180/Math.PI;return[lon,lat*180/Math.PI]}
 function tileXY(lon,lat,z){const n=2**z,p=lat*Math.PI/180;return[(lon+180)/360*n,(1-Math.asinh(Math.tan(p))/Math.PI)/2*n]}
 function tilePoint(x,y,z){const n=2**z;return forward(x/n*360-180,Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI)}
 function tileRange(box,z){const pts=[[box[0],box[1]],[box[0],box[3]],[box[2],box[1]],[box[2],box[3]]].map(p=>tileXY(...inverse(...p),z));return[Math.floor(Math.min(...pts.map(p=>p[0]))),Math.floor(Math.min(...pts.map(p=>p[1]))),Math.floor(Math.max(...pts.map(p=>p[0]))),Math.floor(Math.max(...pts.map(p=>p[1])))]}
 return{forward,inverse,tileXY,tilePoint,tileRange};
})();
