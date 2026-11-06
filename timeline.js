'use strict';
/* Exercise 1.3 · 06 Historical development — a chart of time in the manner of Priestley's
   "New Chart of History": parallel streams (power, plans, architecture, neighbourhoods, extent)
   on one year axis, tied to the map. Dragging the year shows what existed then. Era texts come
   from the studio's Miro research; buildings from Wikidata, photos from Wikimedia Commons. */
window.Timeline13=(()=>{
 const L=(ar,en)=>Locale.language==='ar'?ar:en;
 const Y0=1880,Y1=2026;
 const ERAS=[
  [1880,1906,'#8a7a5a',['المدينة القديمة والمرسى التجاري قبل الميناء الحديث','The old medina and its trading anchorage, before the modern port']],
  [1907,1916,'#b88a4a',['بداية التحول الاستعماري: الميناء الحديث والتوسع خارج النواة','Colonial turn: the modern port and growth beyond the old core']],
  [1917,1929,'#d9653a',['تخطيط المدينة الحديثة (بروست) وظهور الأحباس','Planning the modern city (Prost) and the Habous']],
  [1930,1944,'#c94f7a',['الآرت ديكو يملأ شوارع بروست، وتوسع الأحياء منخفضة الكثافة غربًا، وظهور أنفا','Art Deco fills Prost\'s streets; low-density growth to the west; Anfa']],
  [1945,1955,'#8a5bd1',['ما بعد الحرب: أحياء الصفيح، شبكة إيكوشار 8×8، كاريان سنطرال وعين الشق','Post-war: shantytowns, Écochard\'s 8×8 grid, Carrières Centrales, Aïn Chock']],
  [1956,2009,'#4f86c9',['ما بعد الاستقلال: البيت المغربي الحديث والعمارات والتوسع نحو الأطراف','After independence: the modern Moroccan house, apartment blocks, growth to the edges']],
  [2010,2026,'#3fa98a',['إعادة التأهيل والتجديد الحضري والتحولات المعاصرة (Casa Anfa)','Rehabilitation, urban renewal and contemporary change (Casa Anfa)']]];
 // Streams: [label, bars [from, to, ar, en]]
 const STREAMS=[
  [['السلطة','Power'],[[1880,1912,'السلطنة','Sultanate'],[1912,1956,'الحماية الفرنسية','French Protectorate'],[1956,2026,'الاستقلال','Independence']]],
  [['المخططات','Plans'],[[1914,1922,'مخطط بروست','Prost plan'],[1946,1953,'إيكوشار','Écochard'],[1984,1985,'SDAU','SDAU'],[2010,2011,'SDAU','SDAU']]],
  [['العمارة','Architecture'],[[1912,1930,'نيو-موريسكي','Neo-Moorish','neomoorish'],[1925,1945,'آرت ديكو','Art Deco','artdeco'],[1945,1975,'الحداثة','Modernism','modern'],[1990,2026,'المعاصر','Contemporary']]],
  [['الأحياء','Neighbourhoods'],[[1880,1907,'المدينة القديمة','Medina',null,[-7.6185,33.6025]],[1912,1935,'المدينة الأوروبية','Ville nouvelle',null,[-7.616,33.595]],[1918,1935,'الأحباس','Habous',null,[-7.6075,33.5775]],[1930,1950,'أنفا','Anfa',null,[-7.66,33.586]],[1945,1955,'عين الشق','Aïn Chock',null,[-7.598,33.545]],[1950,1956,'كاريان سنطرال','Carrières Centrales',null,[-7.565,33.588]],[2012,2026,'Casa Anfa','Casa Anfa',null,[-7.645,33.562]]]],
  [['الامتداد','Extent'],[]]];
 // Mapped extents from the studio GIS packages (layer names inside the packages give the year).
 const EXTENTS=[['history_1900',1900,'#e8b04a','T1900'],['history_1925',1935,'#ff6a3d','T1935'],['history_1952',1986,'#c58cff','T1986']];
 let year=1935,data=null,panel=null,family=null,drag=false,onChange=()=>{};
 const eraOf=y=>ERAS.find(e=>y>=e[0]&&y<=e[1])||ERAS.at(-1);
 function attach(d,cb){data=d;onChange=cb}
 const area=rings=>{let s=0;for(const r of rings){let a=0;for(let i=0,j=r.length-1;i<r.length;j=i++)a+=(r[j][0]+r[i][0])*(r[j][1]-r[i][1]);s+=a/2}return Math.abs(s)};
 // Plus extents traced here from the georeferenced 1918 and 1942 plans (prep/extents.py).
 const TRACED={1918:['#f4d35e',['1918 · نواة كثيفة','1918 · dense core']],1942:['#e85d75',['1942','1942']],
  // GHSL built-up epochs (prep/ghsl_extents.py): cells ≥ 15% built inside today's boundary.
  1975:['#9a7bd8',['GHSL 1975','GHSL 1975']],1990:['#6f8fe0',['GHSL 1990','GHSL 1990']],2000:['#4fa8d8',['GHSL 2000','GHSL 2000']],2015:['#3fb5a0',['GHSL 2015','GHSL 2015']],2020:['#7ccf6a',['GHSL 2020','GHSL 2020']]};
 function extents(){const a=EXTENTS.map(([k,y,c,name])=>{const f=data?.layers[k]?.features[0];return f?{k,y,c,name,f,km2:area(f.r)/1e6}:null}).filter(Boolean);
  for(const [y,e] of Object.entries(data?.histExtents||{})){const t=TRACED[y];if(t)a.push({k:'traced'+y,y:+y,c:t[0],name:L(...t[1]),f:e,km2:e.km2,traced:true,ghsl:!!e.ghsl})}
  return a.sort((p,q)=>p.y-q.y)}
 // Georeferenced plan shown under the extents: the latest one not after the cursor year.
 const imgs={};
 function paintPlan(ctx,op){const plans=data?.histPlans||[],p=[...plans].reverse().find(p=>p.year<=year)||null;if(!p)return null;
  let im=imgs[p.year];if(!im){im=imgs[p.year]=new Image();im.onload=()=>onChange();im.src='data/'+p.meta.image}
  if(!im.complete||!im.naturalWidth)return p;const b=p.meta.box;ctx.save();ctx.globalAlpha=op;ctx.imageSmoothingEnabled=true;ctx.drawImage(im,b[0],-b[3],b[2]-b[0],b[3]-b[1]);ctx.restore();return p}

 /* ---------- map ---------- */
 // One reading for anyone: the city as it is in the chosen year is a light area with a white edge; what it gained since the
 // previous record is red; every older edge stays as a thin grey line, fainter the older it is.
 function paintExtents(ctx,s){const E=extents().filter(e=>e.y<=year);if(!E.length)return;const cur=E.at(-1),prev=E.at(-2),P=e=>e.f.p||(e.f.p=pathFromRings(e.f.r));
  E.slice(0,-1).forEach((e,i)=>{ctx.strokeStyle=`rgba(170,168,160,${(.15+.45*(i+1)/E.length).toFixed(2)})`;ctx.lineWidth=.9/s;ctx.setLineDash(e.traced?[]:[5/s,4/s]);ctx.stroke(P(e))});ctx.setLineDash([]);
  ctx.fillStyle='rgba(244,242,236,.08)';ctx.fill(P(cur),'evenodd');
  if(prev){ctx.save();ctx.clip(P(cur),'evenodd');const pp=new Path2D();pp.rect(-1e6,-1e6,2e6,2e6);pp.addPath(P(prev));ctx.fillStyle='rgba(255,77,36,.34)';ctx.fill(pp,'evenodd');ctx.restore()}
  ctx.strokeStyle='#f4f2ec';ctx.lineWidth=1.6/s;ctx.stroke(P(cur))}
 function pathFromRings(rings){const p=new Path2D();for(const r of rings)r.forEach((v,i)=>i?p.lineTo(v[0],-v[1]):p.moveTo(v[0],-v[1]));return p}
 const FAM={artdeco:'#ffd166',neomoorish:'#ff8a5b',modern:'#7ad7ff'};
 function paintBuildings(ctx,s){const items=data?.history?.items||[],r=Math.max(18,4.5/s);
  for(const b of items){const dated=b.year!=null,on=dated?b.year<=year:true;if(!on)continue;if(family&&b.family!==family)continue;
   ctx.beginPath();ctx.arc(b.c[0],-b.c[1],r,0,7);ctx.fillStyle=FAM[b.family]||(dated?'#f4f1ea':'#8d8a82');ctx.globalAlpha=dated&&eraOf(b.year)===eraOf(year)?1:.55;ctx.fill();ctx.globalAlpha=1;ctx.lineWidth=1.2/s;ctx.strokeStyle='#111';ctx.stroke()}
  const n=STREAMS[3][1].filter(b=>year>=b[0]&&year<=b[1]);for(const b of n){const p=CasaGeo.forward(...b[5]);ctx.save();ctx.strokeStyle=eraOf(year)[2];ctx.lineWidth=2.5/s;ctx.setLineDash([6/s,4/s]);ctx.beginPath();ctx.arc(p[0],-p[1],Math.max(450,26/s),0,7);ctx.stroke();ctx.restore()}}

 /* ---------- the chart ---------- */
 function x(y,w){return 118+(y-Y0)/(Y1-Y0)*(w-130)}
 function svg(w){const rowH=16,top=24;let g='',y=top;
  // Bars that would overlap (span or label) drop to the next lane of their stream.
  // The extent stream is drawn first, right under the years, so it is never hidden below the panel's scroll.
  const rows=STREAMS.map(([name,bars],i)=>{if(i===4)return{name,lanes:2,items:[],ext:true};const ends=[],items=bars.map(bar=>{const [a,b,ar,en]=bar,x0=x(a,w),x1=Math.max(x(b,w),x0+L(ar,en).length*5.6+10);let lane=ends.findIndex(e=>e<=x0+3);if(lane<0){lane=ends.length;ends.push(0)}ends[lane]=x1;return{bar,lane}});return{name,lanes:Math.max(1,ends.length),items}});
  rows.unshift(...rows.splice(4,1));
  const total=rows.reduce((s,r)=>s+r.lanes*rowH,0);
  ERAS.forEach(([a,b,c])=>{g+=`<rect x="${x(a,w)}" y="0" width="${x(b+1,w)-x(a,w)}" height="${top+total+6}" fill="#ffffff" opacity="${eraOf(year)[0]===a?.05:0}"/>`});
  for(let yy=1880;yy<=2020;yy+=10)g+=`<line x1="${x(yy,w)}" x2="${x(yy,w)}" y1="${top-4}" y2="${top+total}" class="tk"/><text x="${x(yy,w)}" y="${top-8}" class="ty">${yy}</text>`;
  rows.forEach((row,i)=>{g+=`<text x="110" y="${y+14}" class="tl">${L(...row.name)}${row.ext?' · km²':''}</text>`;
   // Extent circles on one line; labels alternate between a top and a bottom line so neighbours never collide.
   if(row.ext){extents().forEach((e,j)=>{const r=Math.max(3,Math.min(13,Math.sqrt(e.km2)*1.1)),cy=y+rowH,ly=j%2?y+rowH*2-2:y+9;g+=`<circle cx="${x(e.y,w)}" cy="${cy}" r="${r}" fill="none" stroke="${e.y<=year?'#f4f2ec':'#4a4a46'}" stroke-width="1"/><line x1="${x(e.y,w)}" x2="${x(e.y,w)}" y1="${j%2?cy+r:cy-r}" y2="${j%2?ly-8:ly+2}" stroke="#4a4a46"/><text x="${x(e.y,w)+3}" y="${ly}" class="tv">${e.y} · ${fmt(e.km2,e.km2<10?1:0)}</text>`})}
   else row.items.forEach(({bar:[a,b,ar,en,fam],lane})=>{const on=year>=a&&year<=b,sel=fam&&family===fam,yy=y+lane*rowH;g+=`<g class="bar${fam?' fam':''}" data-fam="${fam||''}" data-y="${a}"><rect x="${x(a,w)}" y="${yy+11}" width="${Math.max(4,x(b,w)-x(a,w))}" height="${sel?3:2}" fill="${sel?'#ff4d24':on?'#f4f2ec':'#3a3a37'}"/><rect x="${x(a,w)}" y="${yy}" width="${Math.max(4,x(b,w)-x(a,w))}" height="${rowH}" fill="transparent"/><text x="${x(a,w)+1}" y="${yy+9}" class="tb" fill="${on?'#f4f2ec':'#6e6d69'}" style="fill:${on?'#f4f2ec':'#6e6d69'}">${L(ar,en)}</text></g>`});
   y+=row.lanes*rowH});
  const cx=x(year,w);g+=`<line x1="${cx}" x2="${cx}" y1="4" y2="${top+total+4}" class="cur"/><rect x="${cx-22}" y="2" width="44" height="16" rx="3" class="curb"/><text x="${cx}" y="14" class="cury">${year}</text>`;
  return `<svg class="chrono" viewBox="0 0 ${w} ${top+total+8}" width="100%" data-w="${w}" direction="ltr" style="direction:ltr">${g}</svg>`}
 function card(){const e=eraOf(year),items=(data?.history?.items||[]).filter(b=>b.year!=null&&b.year>=e[0]&&b.year<=e[1]&&(!family||b.family===family));
  return `<div class="tlCard"><b style="color:${e[2]}" dir="ltr">${e[0]}–${e[1]}</b><p>${L(...e[3])}</p><small>${L('من بحث الميرو','From the studio\'s Miro research')}${e[0]===1956?L(' · حقبة أضفناها لتكتمل السلسلة',' · era added to complete the series'):''}</small></div>
  <div class="tlStrip">${items.length?items.map(b=>`<a class="tlItem" ${b.file?`href="${b.file}" target="_blank" rel="noopener"`:''} data-goto="${b.c.join(',')}">${b.img?`<img src="${b.img}" alt="" loading="lazy">`:'<span class="noimg"></span>'}<span>${esc(Locale.language==='ar'&&b.ar?b.ar:b.name)}<small>${b.year}${b.arch?' · '+esc(b.arch.join(', ')):''}${b.style?' · '+esc(b.style.join(', ')):''}</small></span></a>`).join(''):`<p class="tiny">${L('لا مبانٍ مؤرَّخة في Wikidata لهذه الحقبة.','No dated buildings in Wikidata for this era.')}</p>`}</div>`}
 function render(){if(!panel)return;const w=Math.max(520,panel.clientWidth-26);panel.querySelector('.tlChart').innerHTML=svg(w);panel.querySelector('.tlBody').innerHTML=card();bigYear()}
 // The year, large and quiet over the map (as in the reference): the number, and one line for its era.
 function bigYear(){let el=document.getElementById('tlYear');if(!el){el=document.createElement('div');el.id='tlYear';document.body.appendChild(el)}const e=eraOf(year),E=extents().filter(x=>x.y<=year),cur=E.at(-1),first=E[0];const grow=cur?(cur!==first?L(`المدينة المبنية ≈${fmt(cur.km2,0)} كم² · ${(cur.km2/first.km2).toFixed(0)}× ما كانت في ${first.y}`,`built city ≈${fmt(cur.km2,0)} km² · ${(cur.km2/first.km2).toFixed(0)}× what it was in ${first.y}`):L(`المدينة المبنية ≈${fmt(cur.km2,1)} كم²`,`built city ≈${fmt(cur.km2,1)} km²`)):'';
  el.innerHTML=`<span class="y">${year}</span><span class="era">${e[0]}–${e[1]} · ${L(...e[3]).split(/[.،,]/)[0]}</span>${grow?`<span class="grow"><i class="gNew"></i>${L('أحمر: ما أُضيف منذ السجل السابق','red: added since the previous record')} · <i class="gOld"></i>${L('رمادي: الحدود الأقدم','grey: older edges')}</span><span class="km">${grow}</span>`:''}`}
 function setYear(y){year=Math.max(Y0,Math.min(Y1,Math.round(y)));render();onChange()}
 // The city's growth plays on its own from 1900 to today, looping, until the visitor stops it or drags the axis.
 let playTimer=null;
 function stopPlay(){clearInterval(playTimer);playTimer=null;const b=panel?.querySelector('[data-tlplay]');if(b)b.textContent='▶ '+L('تشغيل','Play')}
 function startPlay(){stopPlay();if(year>=Y1)year=1900;playTimer=setInterval(()=>setYear(year>=Y1?1900:year+2),220);const b=panel?.querySelector('[data-tlplay]');if(b)b.textContent='■ '+L('إيقاف','Stop')}
 function open(){if(panel)return;panel=document.createElement('section');panel.id='timeline13';panel.innerHTML=`<div class="tlHead"><button class="act" data-tlplay>■ ${L('إيقاف','Stop')}</button><b>${L('مخطط الزمن · 1880–2026','Chart of time · 1880–2026')}</b><span class="tiny">${L('اسحب على الخط لتغيير السنة · اضغط مسار العمارة لتصفية المباني','Drag along the axis to change the year · click an architecture stream to filter buildings')}</span></div><div class="tlChart"></div><button class="tlMore" data-tlmore>${L('المباني المؤرّخة في هذه الحقبة ▴','Dated buildings of this era ▴')}</button><div class="tlBody"></div>`;
  document.body.appendChild(panel);document.body.classList.add('tlOpen');panel.querySelector('[data-tlmore]').onclick=()=>panel.classList.toggle('more');panel.querySelector('[data-tlplay]').onclick=()=>playTimer?stopPlay():startPlay();year=1900;startPlay();
  const chart=panel.querySelector('.tlChart'),toYear=e=>{const svgEl=chart.querySelector('svg'),b=svgEl.getBoundingClientRect(),w=+svgEl.dataset.w,px=(e.clientX-b.left)/b.width*w;return Y0+(px-118)/(w-130)*(Y1-Y0)};
  chart.addEventListener('pointerdown',e=>{stopPlay();const fam=e.target.closest('.fam');if(fam){family=family===fam.dataset.fam?null:fam.dataset.fam;setYear(+fam.dataset.y+5);return}drag=true;e.preventDefault();chart.setPointerCapture(e.pointerId);setYear(toYear(e))});
  chart.addEventListener('pointermove',e=>{if(drag)setYear(toYear(e))});chart.addEventListener('pointerup',()=>drag=false);
  panel.addEventListener('mouseover',e=>{const a=e.target.closest('[data-goto]');if(a){hoverAt=a.dataset.goto.split(',').map(Number);onChange()}});panel.addEventListener('mouseout',e=>{if(e.target.closest('[data-goto]')){hoverAt=null;onChange()}});
  addEventListener('resize',render);render()}
 let hoverAt=null;
 function paintHover(ctx,s){if(!hoverAt)return;ctx.beginPath();ctx.arc(hoverAt[0],-hoverAt[1],Math.max(60,14/s),0,7);ctx.strokeStyle='#fff';ctx.lineWidth=3/s;ctx.stroke()}
 function close(){stopPlay();panel?.remove();panel=null;family=null;hoverAt=null;document.getElementById('tlYear')?.remove();document.body.classList.remove('tlOpen')}
 return{attach,open,close,render,setYear,paintPlan,paintExtents,paintBuildings,paintHover,extents,get year(){return year},get family(){return family},FAM,ERAS};
})();
