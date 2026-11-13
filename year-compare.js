'use strict';
// Compare years: the map split in two, each half showing an Esri Wayback year chosen above it; drag the divider.
// Also temporary marks (pins) the researcher can drop and delete; kept in this browser only, shown while comparing.
window.YearCompare=(()=>{
 const L=(ar,en)=>Locale.language==='ar'?ar:en;
 const MKEY='casa-marks-v1';
 // seeded marks: places to look at again (removing one hides it in this browser)
 const SEED=[];
 let st={marks:[],removed:[]};try{st=Object.assign(st,JSON.parse(localStorage.getItem(MKEY)||'{}'))}catch{}
 const saveM=()=>{try{localStorage.setItem(MKEY,JSON.stringify(st))}catch{}};
 const marks=()=>[...SEED.filter(m=>!st.removed.includes(m.id)),...st.marks];
 let pen=null,penForm=false,penSt={status:'gone',year:2026,note:''},drawn=[],d0=null,svg=null;
 const DEV=/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
 let on=false,ui=null,pins=null,years=[],ly=2015,ry=2026,placing=false,raf=0;
 const relFor=y=>{const r=Imagery.sources.filter(s=>s.release&&s.release.startsWith(String(y))).sort((a,b)=>a.release<b.release?-1:1);return r[r.length-1]||null};
 const css=`#ycUI select,#ycUI button{font:inherit;font-size:13px;background:rgba(14,14,14,.88);color:#f4f2ec;border:1px solid rgba(244,242,236,.35);padding:5px 8px;cursor:pointer}
 #ycUI .yc{position:fixed;top:118px;z-index:30;display:flex;gap:6px;align-items:center;transform:translateX(-50%)}
 #ycUI .ycBar{position:fixed;bottom:56px;left:50%;transform:translateX(-50%);z-index:30;display:flex;gap:6px}
 #ycSvg{position:fixed;inset:0;width:100%;height:100%;z-index:28;pointer-events:none}
 #ycUI .ycForm{position:fixed;bottom:96px;left:50%;transform:translateX(-50%);z-index:30;background:rgba(14,14,14,.92);color:#f4f2ec;padding:10px;font-size:13px;display:flex;flex-direction:column;gap:6px;min-width:300px}
 #ycUI .ycForm input{font:inherit;background:#222;color:#f4f2ec;border:1px solid #555;padding:4px}
 #ycUI button.on{border-color:#ffd23c;color:#ffd23c}
 #ycPins .pin{position:fixed;z-index:29;transform:translate(-50%,-50%);pointer-events:none}
 #ycPins .pin i{display:block;width:26px;height:26px;border:2px solid #ffd23c;border-radius:50%;box-shadow:0 0 0 4px rgba(255,210,60,.25);animation:ycp 1.6s ease-out infinite}
 #ycPins .pin span{position:absolute;top:30px;left:50%;transform:translateX(-50%);white-space:nowrap;background:rgba(14,14,14,.88);color:#ffd23c;font-size:12px;padding:3px 6px;pointer-events:auto;display:flex;gap:6px;align-items:center}
 #ycPins .pin button{font:inherit;background:none;border:1px solid #ffd23c;color:#ffd23c;cursor:pointer;padding:0 5px}
 @keyframes ycp{0%{box-shadow:0 0 0 0 rgba(255,210,60,.6)}100%{box-shadow:0 0 0 16px rgba(255,210,60,0)}}`;
 function apply(){const S=Imagery.state,a=relFor(ly),b=relFor(ry);if(!a||!b)return;S.enabled=true;S.swipe=true;S.compare='dates';S.left=a;S.right=b;Imagery.sync?.();render()}
 function sel(side){const v=side==='l'?ly:ry;return`<select data-yc="${side}" aria-label="${L('السنة','Year')}">${years.map(y=>`<option value="${y}" ${y===v?'selected':''}>${y}</option>`).join('')}</select>`}
 function build(){
  if(!document.getElementById('ycStyle')){const s=document.createElement('style');s.id='ycStyle';s.textContent=css;document.head.appendChild(s)}
  ui=document.createElement('div');ui.id='ycUI';pins=document.createElement('div');pins.id='ycPins';svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.id='ycSvg';document.body.append(svg,ui,pins);draw()}
 function draw(){if(!ui)return;
  ui.innerHTML=`<div class="yc" data-side="l">${sel('l')}</div><div class="yc" data-side="r">${sel('r')}</div>
  <div class="ycBar">${DEV?`<button data-yc-pen class="${pen?'on':''}">✎ ${pen?(penForm?L('القلم','Pen'):L('القلم: اضغطي الزوايا · Enter يسكّر · Backspace يتراجع · Esc يلغي','Pen: click corners · Enter closes · Backspace undoes · Esc cancels')):L('ارسمي بالقلم','Draw with the pen')}</button>`:''}<button data-yc-add>${placing?L('اضغطي على الخريطة…','Click the map…'):'＋ '+L('علامة','Mark')}</button><button data-yc-close>× ${L('إغلاق المقارنة','Close comparison')}</button></div>${penForm?`<div class="ycForm"><div>${L('الحالة','Status')}: ${[['gone',L('هُدم','demolished')],['standing',L('صفيح قائم','standing slum')],['threatened',L('مهدد','threatened')]].map(([k,t])=>`<button data-pst="${k}" class="${penSt.status===k?'on':''}">${t}</button>`).join(' ')}</div>
  ${penSt.status==='gone'?`<div>${L('أول سنة اختفت فيها البيوت','First year the houses are gone')}: ${[2018,2021,2023,2024,2025,2026].map(y=>`<button data-pyr="${y}" class="${penSt.year===y?'on':''}">${y}</button>`).join(' ')}</div>`:''}
  <input data-pnote placeholder="${L('ملاحظة','Note')}" value="${(penSt.note||'').replace(/"/g,'&quot;')}">
  <div><button data-psave>✓ ${L('احفظي الموقع','Save the site')}</button> <button data-pcancel>${L('إلغاء','Cancel')}</button> <span data-pmsg></span></div></div>`:''}`;
  ui.querySelectorAll('[data-yc]').forEach(s=>s.onchange=()=>{if(s.dataset.yc==='l')ly=+s.value;else ry=+s.value;apply()});
  ui.querySelector('[data-yc-close]').onclick=close;
  const pb=ui.querySelector('[data-yc-pen]');if(pb)pb.onclick=()=>{if(pen){pen=null;penForm=false}else{pen=[];placing=false}document.getElementById('map').style.cursor=pen?'crosshair':'';draw()};
  ui.querySelectorAll('[data-pst]').forEach(b=>b.onclick=()=>{penSt.status=b.dataset.pst;draw()});ui.querySelectorAll('[data-pyr]').forEach(b=>b.onclick=()=>{penSt.year=+b.dataset.pyr;draw()});
  const pn=ui.querySelector('[data-pnote]');if(pn)pn.oninput=()=>{penSt.note=pn.value};
  const ps=ui.querySelector('[data-psave]');if(ps)ps.onclick=savePen;const pc=ui.querySelector('[data-pcancel]');if(pc)pc.onclick=()=>{pen=null;penForm=false;document.getElementById('map').style.cursor='';draw()};
  ui.querySelector('[data-yc-add]').onclick=()=>{placing=!placing;document.getElementById('map').style.cursor=placing?'crosshair':'';draw()};
  pins.innerHTML=marks().map(m=>`<div class="pin" data-pin="${m.id}"><i></i><span>${L(m.ar,m.en)} <button data-pin-del="${m.id}" title="${L('مسح العلامة','Delete mark')}">${L('مسح','delete')} ×</button></span></div>`).join('');
  pins.querySelectorAll('[data-pin-del]').forEach(b=>b.onclick=()=>{const id=b.dataset.pinDel;if(SEED.some(m=>m.id===id))st.removed.push(id);else st.marks=st.marks.filter(m=>m.id!==id);saveM();draw()})}
 function loop(){raf=requestAnimationFrame(loop);if(!ui)return;const S=Imagery.state,W=innerWidth,x=S.split*W;
  const l=ui.querySelector('[data-side=l]'),r=ui.querySelector('[data-side=r]');if(l)l.style.left=Math.max(50,x-70)+'px';if(r)r.style.left=Math.min(W-50,x+70)+'px';
  const cap=document.getElementById('swipeCaption');if(cap)cap.hidden=true;
  if(svg){const P=r=>r.map(q=>screen(q[0],q[1]).join(',')).join(' ');svg.innerHTML=drawn.map(d=>`<polygon points="${P(d.ring)}" fill="${d.col}33" stroke="${d.col}" stroke-width="2"/>`).join('')+(pen?.length?`<polyline points="${P(penForm?[...pen,pen[0]]:pen)}" fill="${penForm?'rgba(255,211,106,.18)':'none'}" stroke="#ffd36a" stroke-width="2"/>`+pen.map((q,i)=>{const [x,y]=screen(q[0],q[1]);return`<circle cx="${x}" cy="${y}" r="${i?3:5}" fill="${i?'#ffd36a':'#fff'}"/>`}).join(''):'')}
  const all=marks();pins.querySelectorAll('[data-pin]').forEach(p=>{const m=all.find(k=>k.id===p.dataset.pin);if(!m)return;const [sx,sy]=screen(m.x,m.y);p.style.left=sx+'px';p.style.top=sy+'px'})}
 addEventListener('pointerdown',e=>{d0=[e.clientX,e.clientY]},true);
 addEventListener('click',e=>{if(!on||!pen||penForm||e.target.id!=='map'||!d0||Math.hypot(e.clientX-d0[0],e.clientY-d0[1])>5)return;e.stopImmediatePropagation();const w=world(e.clientX,e.clientY);
  if(pen.length>=3){const [fx,fy]=screen(pen[0][0],pen[0][1]);if(Math.hypot(e.clientX-fx,e.clientY-fy)<10){closePen();return}}pen.push([Math.round(w[0]*10)/10,Math.round(w[1]*10)/10])},true);
 addEventListener('keydown',e=>{if(!on||!pen||e.target.closest?.('input,select'))return;if(e.key==='Enter'&&!penForm){closePen();e.preventDefault()}else if(e.key==='Backspace'&&!penForm){pen.pop();e.preventDefault()}else if(e.key==='Escape'){pen=null;penForm=false;document.getElementById('map').style.cursor='';draw()}},true);
 function closePen(){if(!pen||pen.length<3)return;penForm=true;document.getElementById('map').style.cursor='';draw()}
 const ringArea=r=>{let a=0;for(let i=0;i<r.length-1;i++)a+=r[i][0]*r[i+1][1]-r[i+1][0]*r[i][1];return Math.abs(a/2)};
 // saves straight into data/demolition_v4.json (dev server): read the file fresh, append, write back
 async function savePen(){const msg=ui.querySelector('[data-pmsg]');try{
  const d=await fetch('data/demolition_v4.json?t='+Date.now(),{cache:'no-store'}).then(r=>r.json());if(!d?.sites?.length)throw 0;
  const ring=[...pen,pen[0]],n=Math.max(...d.sites.map(s=>+s.id.slice(1)||0))+1,gone=penSt.status==='gone',Y=d.years||[2015,2018,2021,2023,2024,2025,2026];
  const site={id:'D'+String(n).padStart(4,'0'),ring,holes:[],area:Math.round(ringArea(ring)),before:gone?Y[Math.max(0,Y.indexOf(penSt.year)-1)]:null,gone:gone?penSt.year:null,status:penSt.status,type:'slum',confidence:'observed',source:'',note:penSt.note||'',cell:'',warn:'',drawn:'compare-pen'};
  d.sites.push(site);
  d.phases.forEach((p,k)=>{p.ha=Math.round(d.sites.filter(s=>(s.status||'gone')==='gone'&&s.gone&&s.gone<=p.to&&(k===0||s.gone>d.phases[k-1].to)).reduce((a,s)=>a+s.area,0)/1e3)/10});
  const r=await fetch('/__save/demolition_v4.json',{method:'POST',body:JSON.stringify(d)});if(!r.ok)throw 0;
  drawn.push({ring,col:gone?'#ff4d24':penSt.status==='threatened'?'#ffd23c':'#e8e6df'});pen=null;penForm=false;penSt.note='';draw();
  if(typeof toast==='function')toast(L(`انحفظ ${site.id} · ${(site.area/1e4).toFixed(2)} هكتار · حدّثي الصفحة عشان يدخل في الأرقام`,`Saved ${site.id} · ${(site.area/1e4).toFixed(2)} ha · reload to update the numbers`))
 }catch{if(msg)msg.textContent=L('ما انحفظ · لازم الأطلس يكون مفتوح من السيرفر المحلي','Not saved · open the atlas from the local server')}}
 addEventListener('click',e=>{if(!on||!placing||e.target.id!=='map')return;e.stopImmediatePropagation();const [x,y]=world(e.clientX,e.clientY);const n=st.marks.length+1;st.marks.push({id:'m'+Date.now(),x,y,ar:'علامة '+n,en:'Mark '+n});saveM();placing=false;document.getElementById('map').style.cursor='';draw()},true);
 async function open(){if(typeof setMenu==='function')setMenu(false);if(on)return;on=true;
  if(!Imagery.sources.some(s=>s.release))await Imagery.loadCatalog().catch(()=>{});
  years=[...new Set(Imagery.sources.filter(s=>s.release).map(s=>+s.release.slice(0,4)))].sort();if(!years.includes(ly))ly=years[0];if(!years.includes(ry))ry=years[years.length-1];
  Imagery.state.split=.5;build();apply();raf=requestAnimationFrame(loop)}
 function close(){on=false;placing=false;pen=null;penForm=false;svg?.remove();svg=null;cancelAnimationFrame(raf);ui?.remove();pins?.remove();ui=pins=null;const S=Imagery.state;S.swipe=false;S.enabled=false;Imagery.sync?.();document.getElementById('map').style.cursor='';render()}
 document.addEventListener('click',e=>{if(!e.target.closest('[data-yearcompare]'))return;e.preventDefault();e.stopPropagation();open()},true);
 return{open,close,get active(){return on}};
})();
