'use strict';
window.ObservedLoss=(()=>{
 const data={"sources":[{"asset":"loss-before.png","release":"2014-02-20","size":[1872,883],"scale":0.8523666250645805,"tx":-2231.858572474667,"ty":15312.605659255427},{"asset":"loss-after.png","release":"2026-10-29","size":[1010,662],"scale":0.8525358943577527,"tx":-2574.504241644409,"ty":15285.604787792392}],"rings":[[[3438.4952276288473,17778.27194736455],[3580.4529209991533,17787.657579984072],[3709.505369517613,17775.925539209667],[3732.9694510664235,17721.958151647403],[3738.8354714536263,17649.219498846087],[3717.7177980596966,17595.252111283822],[3742.355083685948,17536.591907411796],[3768.16557338964,17477.93170353977],[3784.5904304738074,17407.539458893338],[3717.7177980596966,17378.209356957323],[3564.0280639149855,17337.147214246903],[3532.351553824091,17406.366254815897],[3499.5018396557557,17502.56898916602],[3476.0377581069447,17595.252111283822],[3452.573676558134,17700.84047825347],[3438.4952276288473,17778.27194736455]],[[3189.89999088908,17740.724921836078],[3242.6836921945837,17750.108690957055],[3296.6403646402096,17763.0113734984],[3350.5970370858354,17772.395142619378],[3393.9969692703608,17779.432969460115],[3409.2455940919504,17730.168181574976],[3429.1861034740296,17668.000711148496],[3443.2617571554974,17617.562952123237],[3389.3050847098716,17602.314327301647],[3368.19160418767,17588.238673620177],[3330.656527703756,17564.779250817734],[3279.045797538375,17554.222510556632],[3252.067461315562,17544.83874143565],[3226.2620962328715,17571.817077658467],[3207.4945579909145,17642.195346065804],[3189.89999088908,17740.724921836078]],[[3261.4512304365403,17517.86040521284],[3323.6187008630227,17527.244174333817],[3365.8456619074254,17540.146856875162],[3392.823998130238,17496.746924690637],[3420.9753054931734,17494.400982410392],[3478.4508913591662,17513.16852065235],[3494.8724873208785,17474.460473028314],[3512.4670544227133,17420.50380058269],[3531.23459266467,17363.028214716694],[3456.1644396968427,17338.395820774127],[3430.359074614152,17387.660608659266],[3397.5158826907277,17404.082204620976],[3348.251094805591,17387.660608659266],[3302.505220340821,17371.23901269755],[3283.7376820988643,17420.50380058269],[3261.4512304365403,17517.86040521284]]]};
 const L=(ar,en)=>Locale.language==='ar'?ar:en;
 const rings=data.rings,box=ChangeGeometry.bounds(rings),area=rings.reduce((sum,ring)=>sum+ChangeGeometry.area([ring]),0);
 let visible=false;
 function open(){
  visible=true;
  setMenu(false);
  fit(ChangeGeometry.evidenceBox(box));
  openWindow('observedLoss');
  render();
 }
 function crop(source,index){
  const project=([x,y])=>[x*source.scale+source.tx,source.ty-y*source.scale];
  const a=project([box[0]-40,box[3]+30]),b=project([box[2]+40,box[1]-25]);
  const polygons=rings.map(r=>'<polygon points="'+r.map(p=>project(p).join(',')).join(' ')+'" fill="#ffb34722" stroke="#ffb347" stroke-width="3" stroke-dasharray="7 4"/>').join('');
  return `<figure><figcaption>${index?L('بعد','After'):L('قبل','Before')} · ${source.release}</figcaption><svg viewBox="${a[0]} ${a[1]} ${b[0]-a[0]} ${b[1]-a[1]}" width="100%" role="img" aria-label="${L('حدود الجزء المختفي فوق التصوير','Disappearance candidate over imagery')}"><image href="assets/${source.asset}" width="${source.size[0]}" height="${source.size[1]}"/>${polygons}</svg></figure>`;
 }
 function content(){
  return `<p class="lead">${L('اختفاء جزء من التجمع','Part of the settlement disappeared')}</p><div class="evidencePair">${data.sources.map(crop).join('')}</div><p>${L('رسمت الجزء الذي يظهر فيه نسيج الأسقف المتلاصقة في اللقطة الأقدم وتظهر مكانه أرض مكشوفة في الأحدث. مساحة المضلع التقريبية','The outline traces the area where clustered roofs give way to exposed ground. Approximate outlined area')} <b>${fmt(area/10000,1)} ha</b>.</p><p class="note">${L('الحدود تقدير بصري لنطاق التغيّر من لقطتين طابقتهما مع طبقة المباني. التواريخ أعلاه تخص نشر نسخ التصوير. المضلع يصف التجمع على مستوى الموقع، وتبقى حدود البيوت الفردية وتواريخ الالتقاط بحاجة إلى صور أوضح.','A visually interpreted change extent registered against the building layer. The dates are imagery publication dates. Individual footprints and acquisition dates require clearer source imagery.')}</p><button class="action" data-loss-locate>${L('الموقع على الخريطة','Locate on map')} ↗</button><button class="action" data-loss-scan>${L('اختبر المسح هنا','Test scan here')} ↗</button><button class="action" data-loss-export>GeoJSON ↓</button><label class="reviewCheck"><input type="checkbox" data-loss-visible ${visible?'checked':''}>${L('إظهار حدود التجمع','Show settlement outline')}</label>`;
 }
 function bind(body){
  body.querySelector('[data-loss-scan]').onclick=()=>ChangeScan.scanLocation(box);
  body.querySelector('[data-loss-locate]').onclick=()=>{visible=true;fit(ChangeGeometry.evidenceBox(box));refresh('observedLoss')};
  body.querySelector('[data-loss-visible]').onchange=e=>{visible=e.target.checked;render()};
  body.querySelector('[data-loss-export]').onclick=()=>{
   const feature={type:'Feature',geometry:{type:'MultiPolygon',coordinates:rings.map(r=>[r.map(p=>CasaGeo.inverse(...p))])},properties:{label:'Settlement disappearance candidate',area_m2:Math.round(area),geometry_scope:'settlement_change_extent',method:'manual visual interpretation of registered screenshots',earlier_release:data.sources[0].release,later_release:data.sources[1].release,acquisition_dates_verified:false}};
   download('settlement-change.geojson',JSON.stringify({type:'FeatureCollection',features:[feature]},null,2),'application/geo+json');
  };
 }
 function paint(c,bounds){
  if(!visible||!overlap(box,bounds))return;
  const path=pathFor(rings);
  c.fillStyle='#ffb34724';c.fill(path,'evenodd');
  c.strokeStyle='#ffb347';c.lineWidth=2.5/view.s;c.setLineDash([7/view.s,4/view.s]);c.stroke(path);c.setLineDash([]);
 }
 return{open,content,bind,paint,show(){visible=true;render()}};
})();
