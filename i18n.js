/* Interface language never changes geometry, recorded names, IDs or exported measurements. */
window.Locale=(()=>{
 let language='ar';try{language=localStorage.getItem('casa-dna-language')||'ar'}catch{}if(!['ar','en'].includes(language))language='ar';
 const dictionary={
 'CASABLANCA':'الدار البيضاء','URBAN DNA':'URBAN DNA / البصمة العمرانية','Explore':'اكتشف','ANALYSES':'التحليلات','WORKTABLE':'طاولة العمل','MAP':'الخريطة','OUTPUT / METHOD':'الإخراج والمنهج',
 'Urban fabrics':'الأنسجة العمرانية','Street networks':'شبكات الشوارع','Building DNA':'بصمة المبنى','Compare fabrics':'مقارنة الأنسجة','Layers':'الطبقات','Building register':'سجل المباني','Building record':'بطاقة المبنى','Draw samples':'تحديد العينات','Comparison':'المقارنة','Saved samples':'العينات المحفوظة','Stack windows':'تكديس النوافذ','Arrange side by side':'ترتيب للمقارنة','Export SVG ↓':'تصدير SVG ↓','Method & sources':'المنهج والمصادر','Play sequence':'تشغيل التسلسل','Pause sequence':'إيقاف التسلسل','Next analysis →':'التحليل التالي ←','Loading data…':'جارٍ تحميل البيانات…',
 'Zoom in':'تكبير الخريطة','Zoom out':'تصغير الخريطة','Fit study extent':'إظهار نطاق الدراسة','Toggle light map':'تبديل خلفية الخريطة','Draw rectangular sample A':'رسم العينة A','Draw rectangular sample B':'رسم العينة B','Map tools':'أدوات الخريطة','Explore the atlas':'اكتشف الأطلس','Interactive building footprint and street map. Drag to pan; scroll to zoom.':'خريطة المباني والشوارع. اسحب للتحريك واستخدم العجلة للتقريب.',
 'LAYER CONTROL':'التحكم بالطبقات','METHOD / SOURCES':'المنهج والمصادر','STREET REGISTER':'سجل الشوارع','BUILDING RECORD':'بطاقة المبنى','BUILDING REGISTER':'سجل المباني','SAMPLE WORKBENCH':'مساحة العينات','MORPHOLOGICAL COMPARISON':'المقارنة المورفولوجية','SAVED SAMPLES':'العينات المحفوظة','Minimize':'تصغير النافذة','Maximize / restore':'تكبير النافذة / استعادتها','Close':'إغلاق','Remove sample':'إزالة العينة',
 'FIGURE / GROUND':'المبني والفراغ','STREET NETWORKS':'شبكات الشوارع','BUILDING DNA':'بصمة المبنى','COMPARE FABRICS':'مقارنة الأنسجة','READING THE FABRIC':'قراءة النسيج',
 'Mass.':'الكتلة.','Ground. Network.':'الفراغ والشبكة.','Building footprints':'بصمات المباني','Street network':'شبكة الشوارع','Major roads + links':'الطرق الرئيسية ووصلاتها','Local + service streets':'الشوارع المحلية والخدمية','Walking + cycling':'المشي والدراجات',
 'White space in a figure–ground map is not necessarily public space. Footprints do not reveal ownership, access or street-level activity.':'الفراغ الأبيض في خريطة المبني والفراغ ليس بالضرورة مجالًا عامًا. بصمات المباني لا تثبت الملكية أو الإتاحة أو نشاط الشارع.',
 'Measured,':'قياس موثّق،','not assumed.':'لا افتراض.','SOURCE / YOUR ARCGIS EXPORTS':'المصدر / ملفاتك المصدّرة من ArcGIS',
 'Source: © OpenStreetMap contributors; user-supplied Shapefiles. Snapshot date not supplied.':'المصدر: © مساهمو OpenStreetMap؛ ملفات Shapefile المرفقة. تاريخ نسخة البيانات غير متوفر.',
 'Attribution / ODbL ↗':'الإسناد والترخيص / ODbL ↗',
 'Geometry projected from WGS84 to UTM 29N (EPSG:32629). Areas are in m².':'أُسقطت الهندسة من WGS84 إلى UTM 29N ‏(EPSG:32629). المساحات بالمتر المربع.',
 'Compactness = 4π × area / perimeter². A circle approaches 1; this is not a quality score.':'التراص الشكلي = 4π × المساحة ÷ مربع المحيط. تقترب الدائرة من 1؛ المؤشر ليس تقييمًا للجودة.',
 'Coverage = clipped footprint area / rectangular sample area. Overlapping source footprints can inflate coverage.':'التغطية = مساحة بصمات المباني المقتطعة ÷ مساحة العينة المستطيلة. تداخل البصمات في المصدر قد يرفع النسبة.',
 'Sample medians use full footprints intersecting the rectangle, including boundary buildings.':'تستخدم القيم الوسيطة كامل بصمات المباني المتقاطعة مع المستطيل، بما فيها المباني عند حدوده.',
 'No parcel boundaries, heights or automatic tissue labels are provided.':'لا تتوفر حدود قطع الأرض أو الارتفاعات، ولا يجري تصنيف الأنسجة آليًا.',
 'V.01 is a geometric workbench. No AI classification is running. Spatial resemblance alone cannot establish a neighbourhood’s history or social character.':'هذه مساحة عمل هندسية؛ تصنيف الأنسجة بالذكاء الاصطناعي لم يُضف بعد. التشابه المكاني وحده لا يثبت تاريخ الحي أو خصائصه الاجتماعية.',
 'SAVE SESSION JSON ↓':'حفظ الجلسة JSON ↓','LOAD SESSION JSON ↑':'استعادة جلسة JSON ↑','DOWNLOAD SESSION ↓':'تنزيل الجلسة ↓',
 'Hierarchy':'تراتبية الشبكة','is not access.':'لا تساوي الإتاحة.','OSM street classes describe the recorded network. A route’s presence does not establish walkability or public access.':'تصف تصنيفات OSM الشبكة المسجّلة. وجود طريق لا يثبت صلاحيته للمشي أو إتاحته للعموم.',
 'OSM CLASS':'تصنيف OSM','FEATURES':'المقاطع','Counts are line features, not unique streets. Road widths and bus routes are not inferred.':'الأعداد لمقاطع خطية وليست لشوارع فريدة. لا نستنتج عرض الطرق أو خطوط الحافلات.',
 'Select a':'اختَر','building.':'مبنى.','Click a footprint on the map, or a row in the building register.':'اضغط على بصمة مبنى في الخريطة أو على صف في سجل المباني.','OPEN REGISTER ↗':'فتح السجل ↗','Unnamed building':'مبنى دون اسم','not supplied':'غير متوفر',
 'FOOTPRINT / m²':'مساحة البصمة / m²','PERIMETER / m':'المحيط / m','COMPACTNESS / 0–1':'التراص الشكلي / 0–1','E/W : N/S BBOX RATIO':'نسبة أبعاد المستطيل المحيط: شرق–غرب / شمال–جنوب','LOCATE ↗':'تحديد الموقع ↗','EXPORT RECORD ↓':'تصدير السجل ↓',
 'This is a building footprint, not a land parcel. The bounding-box ratio depends on map orientation.':'هذه بصمة مبنى، وليست قطعة أرض. نسبة أبعاد المستطيل المحيط تتأثر باتجاه الخريطة.',
 'OSM ID, name or recorded type':'معرّف OSM، اسم المبنى أو نوعه','Search buildings':'البحث في المباني','Sort buildings':'ترتيب المباني','Largest first':'الأكبر أولًا','Smallest first':'الأصغر أولًا','Compactness':'التراص الشكلي','OSM ID':'معرّف OSM','AREA m²':'المساحة m²','COMPACT.':'التراص','TYPE':'النوع','EXPORT FILTERED CSV ↓':'تصدير النتائج CSV ↓',
 'Same scale.':'المقياس نفسه.','Different fabric.':'نسيج مختلف.','Draw sample A, then B. For a controlled comparison, use “Match B to A size” after drawing both.':'ارسم العينة A ثم B. لمقارنة متكافئة استخدم «مطابقة حجم B مع A» بعد تحديد العينتين.',
 'NOT DRAWN':'لم تُحدَّد','MATCH B TO A SIZE':'مطابقة حجم B مع A','CLEAR BOTH':'مسح العينتين','Samples are analysis windows, not automatically identified urban tissues.':'العينات نوافذ للتحليل وليست أنسجة عمرانية مُصنَّفة آليًا.',
 'Two samples.':'عينتان.','One question.':'سؤال واحد.','Draw A and B on the map to compare building scale, coverage and compactness.':'حدّد A وB على الخريطة لمقارنة أحجام المباني والتغطية والتراص الشكلي.','SET UP SAMPLES ↗':'تحديد العينات ↗','MEASURE':'المؤشر','Sample area / ha':'مساحة العينة / هكتار','Intersecting footprints':'البصمات المتقاطعة','Built coverage / %':'التغطية المبنية / %','Median footprint / m²':'وسيط مساحة البصمة / m²','Median compactness':'وسيط التراص الشكلي','EXPORT COMPARISON ↓':'تصدير المقارنة ↓',
 'Equal-area windows.':'العينتان متساويتان في المساحة.','Different sample sizes: use rates and medians, or match the window sizes before comparing counts.':'مساحتا العينتين مختلفتان: استخدم النسب والقيم الوسيطة، أو طابق المساحتين قبل مقارنة الأعداد.','Measured differences do not establish causes or tissue names.':'الفروق المقاسة لا تثبت أسبابها أو أسماء الأنسجة.',
 'An atlas':'أطلس','in progress.':'قيد التكوين.','Saved in this browser. Export your session for a portable copy.':'الحفظ في هذا المتصفح. صدّر الجلسة للاحتفاظ بنسخة قابلة للنقل.','Keep a sample from the sampling panel to build your own study collection.':'احفظ عينة من نافذة العينات لتكوين مجموعة دراستك.',
 'Draw a larger sample — at least 10 m on each side.':'ارسم عينة أكبر؛ عشرة أمتار على الأقل لكل ضلع.','Draw both samples first.':'حدّد العينتين أولًا.','Sample saved in this browser. Export a session to keep a portable copy.':'حُفظت العينة في المتصفح. صدّر الجلسة للاحتفاظ بنسخة قابلة للنقل.','Browser storage is unavailable. Download a session instead.':'التخزين في المتصفح غير متاح. نزّل ملف الجلسة بدلًا منه.','Session restored.':'استُعيدت الجلسة.','Not an Urban DNA session':'هذا ليس ملف جلسة Urban DNA','Invalid sample geometry':'هندسة العينة غير صالحة','Invalid sample bounds':'حدود العينة غير صالحة',
 'Datasets are still loading.':'البيانات لا تزال قيد التحميل.','Please wait for your datasets to finish loading.':'انتظر اكتمال تحميل البيانات.','Preparing the supplied datasets…':'جارٍ تجهيز البيانات المرفقة…','Could not load datasets. Reload to retry.':'تعذّر تحميل البيانات. أعد تحميل الصفحة للمحاولة.',
 'Presentation sequence: each analysis is shown for 8 seconds.':'وضع العرض: ثماني ثوانٍ لكل تحليل.','Editable SVG exported: map layers and sample outlines, without interface panels.':'صُدّر ملف SVG قابل للتحرير: طبقات الخريطة وحدود العينات دون نوافذ الواجهة.',
 'Name this sample (e.g. a street or tissue reference):':'سمّ هذه العينة (مثل اسم شارع أو مرجع النسيج):',
 'Historical development':'التطور التاريخي','No dated layers are loaded. Add a historical map or a second dated dataset to begin a time comparison.':'لا توجد طبقات مؤرّخة محمّلة بعد. أضف خريطة تاريخية أو بيانات لسنة ثانية لبدء المقارنة الزمنية.',
 'primary':'رئيسي','secondary':'ثانوي','trunk':'شرياني','motorway':'طريق سريع','residential':'سكني','service':'خدمي','tertiary':'تجميعي','footway':'ممر مشاة','pedestrian':'للمشاة','living_street':'شارع مشترك','path':'مسار','cycleway':'مسار دراجات','steps':'درج','track':'مسلك','unclassified':'غير مصنّف','busway':'مسار حافلات','primary_link':'وصلة طريق رئيسي','secondary_link':'وصلة طريق ثانوي','motorway_link':'وصلة طريق سريع','trunk_link':'وصلة شريانية','tertiary_link':'وصلة تجميعية','track_grade3':'مسلك / درجة 3','track_grade4':'مسلك / درجة 4',
 'Play chapter sequence':'تشغيل تسلسل التحليلات','Pause chapter sequence':'إيقاف تسلسل التحليلات','Next analysis':'التحليل التالي','Switch language':'تبديل اللغة',
 'Close all windows':'إغلاق كل النوافذ','Reset map view':'إعادة ضبط الخريطة'
 };
 const memory=new WeakMap();
 function translate(s){if(language!=='ar')return s;let leading=s.match(/^\s*/)[0],trailing=s.match(/\s*$/)[0],key=s.trim();if(!key)return s;let out=dictionary[key];
  if(out===undefined){
   if(/^SAMPLE [AB]$/.test(key))out='العينة '+key.slice(-1);
   else if(/^DRAW [AB] □$/.test(key))out='رسم '+key[5]+' □';
   else if(key==='KEEP +')out='حفظ +';
   else if(/^Sample [AB]$/.test(key))out='العينة '+key.slice(-1);
   else if(key.endsWith(' Measured differences do not establish causes or tissue names.'))out=(dictionary[key.replace(' Measured differences do not establish causes or tissue names.','')]||key.replace(' Measured differences do not establish causes or tissue names.',''))+' '+dictionary['Measured differences do not establish causes or tissue names.'];
   else if(/^Recorded type: /.test(key))out='النوع المسجّل: '+(dictionary[key.slice(15)]||key.slice(15));
   else if(/^BUILDING FOOTPRINT \/ OSM /.test(key))out='بصمة المبنى / OSM '+key.slice(25);
   else if(/ MATCHING FOOTPRINTS$/.test(key))out=key.replace(' MATCHING FOOTPRINTS',' بصمة مطابقة');
   else if(/^Sample [AB] measured\./.test(key))out='قِيست العينة '+key[7]+'. تُقتطع البصمات عند حدود العينة لحساب التغطية.';
   else if(/^Drag a rectangle on the map for sample /.test(key))out='اسحب مستطيلًا على الخريطة للعينة '+(key.match(/sample ([AB])/)||[])[1]+'. للإلغاء اضغط Escape.';
   else if(key.includes(' building footprints and '))out=key.replace(' building footprints and ',' بصمة مبنى و').replace(' street features. Major roads were clipped and merged with the local network. One zero-area source geometry was excluded from measurement.',' مقطع طريق. قُصّت الطرق الرئيسية ودُمجت بالشبكة المحلية. استُبعدت هندسة واحدة مساحتها صفر من القياس.');
   else if(key.includes('mapped coverage'))out=key.replace('mapped coverage','تغطية مبنية مسجّلة').replace('footprints','بصمة');
   else if(key.endsWith(' footprints'))out=key.replace(' footprints',' بصمة');
   else if(key.startsWith('Could not load session: '))out='تعذّر استعادة الجلسة: '+translate(key.slice(24));
   else if(key.startsWith('Data loading failed: '))out='تعذّر تحميل البيانات: '+key.slice(21);
   else out=key;
  }return leading+out+trailing;
 }
 function localize(root=document.body){const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode()){if(node.parentElement?.closest('script,style,[data-no-translate]'))continue;let entry=memory.get(node);if(!entry||node.nodeValue!==entry.last)entry={en:node.nodeValue,last:node.nodeValue};node.nodeValue=translate(entry.en);entry.last=node.nodeValue;memory.set(node,entry)}for(let el of root.querySelectorAll('[title],[placeholder],[aria-label]'))for(let attr of ['title','placeholder','aria-label']){if(!el.hasAttribute(attr))continue;let key='data-source-'+attr;if(!el.hasAttribute(key))el.setAttribute(key,el.getAttribute(attr));el.setAttribute(attr,translate(el.getAttribute(key)))}}
 function setLanguage(next){language=next;try{localStorage.setItem('casa-dna-language',language)}catch{}document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr'}
 setLanguage(language);return {get language(){return language},translate,localize,setLanguage,extend:entries=>Object.assign(dictionary,entries)};
})();

window.Locale.extend({'AERIAL / SWIPE / STUDY BOUNDARIES ↗':'التصوير / المقارنة / حدود الدراسة ↗'});

window.Locale.extend({'CHANGE ATLAS':'أطلس التغيّر','BUILDING CHANGE / EVIDENCE':'تغيّر المبنى / الأدلة','BUILDING CHANGE / TRACE ↗':'تغيّر المبنى / تتبّع الحدود ↗'});
