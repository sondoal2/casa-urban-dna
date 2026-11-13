'use strict';
// Compare years: the map split in two, each half showing an Esri Wayback year chosen above it; drag the divider.
// Also temporary marks (pins) the researcher can drop and delete; kept in this browser only, shown while comparing.
window.YearCompare=(()=>{
 const L=(ar,en)=>Locale.language==='ar'?ar:en;
 const MKEY='casa-marks-v1';
 // seeded marks: places to look at again (removing one hides it in this browser)
 const SEED=[{id:'m-c001-coast',x:9340,y:23460,ar:'صفيح على البحر · ممكن غرقان؟ · مربع C001 · غير مرصود',en:'Shacks on the beach · flooded? · cell C001 · not recorded'}];
 let st={marks:[],removed:[]};try{st=Object.assign(st,JSON.parse(localStorage.getItem(MKEY)||'{}'))}catch{}
 const saveM=()=>{try{localStorage.setItem(MKEY,JSON.stringify(st))}catch{}};
 const marks=()=>[...SEED.filter(m=>!st.removed.includes(m.id)),...st.marks];
 let on=false,ui=null,pins=null,years=[],ly=2015,ry=2026,placing=false,raf=0;
 const relFor=y=>{const r=Imagery.sources.filter(s=>s.release&&s.release.startsWith(String(y))).sort((a,b)=>a.release<b.release?-1:1);return r[r.length-1]||null};
 const css=`#ycUI select,#ycUI button{font:inherit;font-size:13px;background:rgba(14,14,14,.88);color:#f4f2ec;border:1px solid rgba(244,242,236,.35);padding:5px 8px;cursor:pointer}
 #ycUI .yc{position:fixed;top:118px;z-index:30;display:flex;gap:6px;align-items:center;transform:translateX(-50%)}
 #ycUI .ycBar{position:fixed;bottom:56px;left:50%;transform:translateX(-50%);z-index:30;display:flex;gap:6px}
 #ycPins .pin{position:fixed;z-index:29;transform:translate(-50%,-50%);pointer-events:none}
 #ycPins .pin i{display:block;width:26px;height:26px;border:2px solid #ffd23c;border-radius:50%;box-shadow:0 0 0 4px rgba(255,210,60,.25);animation:ycp 1.6s ease-out infinite}
 #ycPins .pin span{position:absolute;top:30px;left:50%;transform:translateX(-50%);white-space:nowrap;background:rgba(14,14,14,.88);color:#ffd23c;font-size:12px;padding:3px 6px;pointer-events:auto;display:flex;gap:6px;align-items:center}
 #ycPins .pin button{font:inherit;background:none;border:1px solid #ffd23c;color:#ffd23c;cursor:pointer;padding:0 5px}
 @keyframes ycp{0%{box-shadow:0 0 0 0 rgba(255,210,60,.6)}100%{box-shadow:0 0 0 16px rgba(255,210,60,0)}}`;
 function apply(){const S=Imagery.state,a=relFor(ly),b=relFor(ry);if(!a||!b)return;S.enabled=true;S.swipe=true;S.compare='dates';S.left=a;S.right=b;Imagery.sync?.();render()}
 function sel(side){const v=side==='l'?ly:ry;return`<select data-yc="${side}" aria-label="${L('السنة','Year')}">${years.map(y=>`<option value="${y}" ${y===v?'selected':''}>${y}</option>`).join('')}</select>`}
 function build(){
  if(!document.getElementById('ycStyle')){const s=document.createElement('style');s.id='ycStyle';s.textContent=css;document.head.appendChild(s)}
  ui=document.createElement('div');ui.id='ycUI';pins=document.createElement('div');pins.id='ycPins';document.body.append(ui,pins);draw()}
 function draw(){if(!ui)return;
  ui.innerHTML=`<div class="yc" data-side="l">${sel('l')}</div><div class="yc" data-side="r">${sel('r')}</div>
  <div class="ycBar"><button data-yc-add>${placing?L('اضغطي على الخريطة…','Click the map…'):'＋ '+L('علامة','Mark')}</button><button data-yc-close>× ${L('إغلاق المقارنة','Close comparison')}</button></div>`;
  ui.querySelectorAll('[data-yc]').forEach(s=>s.onchange=()=>{if(s.dataset.yc==='l')ly=+s.value;else ry=+s.value;apply()});
  ui.querySelector('[data-yc-close]').onclick=close;
  ui.querySelector('[data-yc-add]').onclick=()=>{placing=!placing;document.getElementById('map').style.cursor=placing?'crosshair':'';draw()};
  pins.innerHTML=marks().map(m=>`<div class="pin" data-pin="${m.id}"><i></i><span>${L(m.ar,m.en)} <button data-pin-del="${m.id}" title="${L('مسح العلامة','Delete mark')}">${L('مسح','delete')} ×</button></span></div>`).join('');
  pins.querySelectorAll('[data-pin-del]').forEach(b=>b.onclick=()=>{const id=b.dataset.pinDel;if(SEED.some(m=>m.id===id))st.removed.push(id);else st.marks=st.marks.filter(m=>m.id!==id);saveM();draw()})}
 function loop(){raf=requestAnimationFrame(loop);if(!ui)return;const S=Imagery.state,W=innerWidth,x=S.split*W;
  const l=ui.querySelector('[data-side=l]'),r=ui.querySelector('[data-side=r]');if(l)l.style.left=Math.max(50,x-70)+'px';if(r)r.style.left=Math.min(W-50,x+70)+'px';
  const cap=document.getElementById('swipeCaption');if(cap)cap.hidden=true;
  const all=marks();pins.querySelectorAll('[data-pin]').forEach(p=>{const m=all.find(k=>k.id===p.dataset.pin);if(!m)return;const [sx,sy]=screen(m.x,m.y);p.style.left=sx+'px';p.style.top=sy+'px'})}
 addEventListener('click',e=>{if(!on||!placing||e.target.id!=='map')return;e.stopImmediatePropagation();const [x,y]=world(e.clientX,e.clientY);const n=st.marks.length+1;st.marks.push({id:'m'+Date.now(),x,y,ar:'علامة '+n,en:'Mark '+n});saveM();placing=false;document.getElementById('map').style.cursor='';draw()},true);
 async function open(){if(typeof setMenu==='function')setMenu(false);if(on)return;on=true;
  if(!Imagery.sources.some(s=>s.release))await Imagery.loadCatalog().catch(()=>{});
  years=[...new Set(Imagery.sources.filter(s=>s.release).map(s=>+s.release.slice(0,4)))].sort();if(!years.includes(ly))ly=years[0];if(!years.includes(ry))ry=years[years.length-1];
  Imagery.state.split=.5;build();apply();raf=requestAnimationFrame(loop)}
 function close(){on=false;placing=false;cancelAnimationFrame(raf);ui?.remove();pins?.remove();ui=pins=null;const S=Imagery.state;S.swipe=false;S.enabled=false;Imagery.sync?.();document.getElementById('map').style.cursor='';render()}
 document.addEventListener('click',e=>{if(!e.target.closest('[data-yearcompare]'))return;e.preventDefault();e.stopPropagation();open()},true);
 return{open,close,get active(){return on}};
})();
