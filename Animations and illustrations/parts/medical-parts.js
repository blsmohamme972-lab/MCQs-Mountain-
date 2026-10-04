/* Medical Motion Parts v1.0.0 | Deterministic, dependency-free SVG components. */
(function bootMedicalMotionParts(G){
  'use strict';
  const palette={
    ink:'#162d48', muted:'#526780', line:'#dbe5f0', blue:'#246bdd',
    red:'#cf4263', teal:'#087f8c', gold:'#986300', purple:'#7254b8',
    soft:'#eaf1fb', tissue:'#f8ddd6', paper:'#ffffff'
  };
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const el=(tag,attrs={},children='')=>'<'+tag+' '+Object.entries(attrs).map(([k,v])=>k+'="'+escape(v)+'"').join(' ')+'>'+children+'</'+tag+'>';
  const circle=(x,y,r,fill,extra={})=>el('circle',{cx:x,cy:y,r,fill,...extra});
  const ellipse=(x,y,rx,ry,fill,extra={})=>el('ellipse',{cx:x,cy:y,rx,ry,fill,...extra});
  const rect=(x,y,w,h,fill,r=16,extra={})=>el('rect',{x,y,width:w,height:h,rx:r,fill,...extra});
  const line=(x1,y1,x2,y2,stroke,width=4,extra={})=>el('line',{x1,y1,x2,y2,stroke,'stroke-width':width,'stroke-linecap':'round',...extra});
  const path=(d,stroke,width=4,fill='none',extra={})=>el('path',{d,stroke,'stroke-width':width,fill,'stroke-linecap':'round','stroke-linejoin':'round',...extra});
  const polygon=(points,fill,extra={})=>el('polygon',{points,fill,...extra});
  const text=(x,y,value,fill=palette.ink,size=18,anchor='middle',weight=650)=>el('text',{x,y,fill,'font-size':size,'text-anchor':anchor,'font-weight':weight},escape(value));
  const color=key=>palette[palette[key]?key:'blue'];
  const allowed=new Set(['x','y','scale','rotation','opacity','accent']);
  const defaults={x:320,y:220,scale:1,rotation:0,opacity:1,accent:'blue'};
  function validateOptions(input={}){
    if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Part options must be an object.');
    for(const key of Object.keys(input))if(!allowed.has(key))throw new Error('Unknown part option: '+key);
    const o={...defaults,...input};
    if(!Number.isFinite(o.x)||!Number.isFinite(o.y))throw new Error('x and y must be finite numbers.');
    if(!Number.isFinite(o.scale)||o.scale<=0||o.scale>8)throw new Error('scale must be between 0 and 8.');
    if(!Number.isFinite(o.rotation))throw new Error('rotation must be finite.');
    if(!Number.isFinite(o.opacity)||o.opacity<0||o.opacity>1)throw new Error('opacity must be between 0 and 1.');
    if(!Object.hasOwn(palette,o.accent))throw new Error('accent must be a palette key.');
    return o;
  }
  const registry=new Map();
  function register(def){
    if(!def||!/^[a-z][a-z0-9-]+$/.test(def.id)||typeof def.render!=='function')throw new Error('Invalid part definition.');
    if(registry.has(def.id))throw new Error('Duplicate part: '+def.id);
    registry.set(def.id,def);
  }
  register({
    id:'bacterium-coccus',category:'Microbiology',anatomyLevel:'cellular',role:'organism',
    title:'Coccus bacterium',description:'A rounded bacterial cell silhouette for morphology scenes.',
    keywords:['bacterium','coccus','cocci','spherical','microbiology'],aliases:['round bacterium'],
    limitations:'Shape-only schematic; not a species or staining claim.',
    render:function(o,C){let s='';for(let i=0;i<7;i++){const a=i*Math.PI*2/7;s+=circle(320+Math.cos(a)*35,220+Math.sin(a)*35,24,C.red,{opacity:.82});}return s;}
  });
  register({
    id:'bacterium-bacillus',category:'Microbiology',anatomyLevel:'cellular',role:'organism',
    title:'Bacillus bacterium',description:'A rod-shaped bacterial cell silhouette.',
    keywords:['bacterium','bacillus','bacilli','rod','microbiology'],aliases:['rod bacterium'],
    limitations:'Shape-only schematic; dimensions, spores and motility are omitted.',
    render:function(o,C){return rect(216,180,208,80,C.gold,40,{opacity:.9})+line(248,198,392,242,C.paper,3,{opacity:.7})+line(248,242,392,198,C.paper,3,{opacity:.7});}
  });
  register({
    id:'bacterium-spirillum',category:'Microbiology',anatomyLevel:'cellular',role:'organism',
    title:'Spirillum bacterium',description:'A curved spiral bacterial cell silhouette.',
    keywords:['bacterium','spirillum','spirilla','spiral','microbiology'],aliases:['spiral bacterium'],
    limitations:'Shape-only schematic; flagella and species identity are not represented.',
    render:function(o,C){return path('M 150 220 C 190 130 230 310 270 220 S 350 130 390 220 S 470 310 510 220',C.blue,15,'none')+path('M 150 220 C 190 130 230 310 270 220 S 350 130 390 220 S 470 310 510 220',C.paper,3,'none',{opacity:.7});}
  });
  register({
    id:'animal-cell',category:'Cell biology',anatomyLevel:'cellular',role:'cell',
    title:'Animal cell',description:'A compact animal-cell silhouette with membrane, nucleus and organelles.',
    keywords:['cell','animal cell','cytoplasm','organelle','biology'],aliases:['eukaryotic cell'],
    limitations:'Selected organelles are illustrative and not to scale.',
    render:function(o,C){let s=ellipse(320,220,158,112,C.soft,{stroke:C.teal,'stroke-width':5});s+=ellipse(320,220,48,40,C.purple,{opacity:.78});for(let i=0;i<6;i++){const x=205+(i%3)*82,y=165+Math.floor(i/3)*105;s+=ellipse(x,y,24,12,C.gold,{transform:'rotate('+(i*19-20)+' '+x+' '+y+')'});}return s;}
  });
  register({
    id:'nucleus',category:'Cell biology',anatomyLevel:'cellular',role:'organelle',
    title:'Nucleus',description:'A nucleus with envelope, nucleolus and chromatin marks.',
    keywords:['nucleus','nuclear envelope','nucleolus','chromatin','cell biology'],aliases:['cell nucleus'],
    limitations:'Nuclear organization is schematic and not a microscopy reconstruction.',
    render:function(o,C){let s=ellipse(320,220,112,88,C.soft,{stroke:C.purple,'stroke-width':6});s+=circle(320,220,28,C.purple,{opacity:.78});for(let i=0;i<5;i++)s+=path('M 245 '+(175+i*20)+' Q 320 '+(160+i*22)+' 395 '+(175+i*20),C.blue,3);return s;}
  });
  register({
    id:'mitochondrion',category:'Cell biology',anatomyLevel:'cellular',role:'organelle',
    title:'Mitochondrion',description:'An elongated mitochondrion with folded inner membrane.',
    keywords:['mitochondrion','mitochondria','cristae','ATP','organelle'],aliases:['mitochondria'],
    limitations:'Cristae and membrane spaces are simplified; no ATP rate is implied.',
    render:function(o,C){let s=ellipse(320,220,142,66,C.tissue,{stroke:C.red,'stroke-width':5});s+=path('M 205 220 Q 235 175 265 220 T 325 220 T 385 220 T 445 220',C.red,7);s+=path('M 220 245 Q 250 200 280 245 T 340 245 T 400 245',C.gold,5);return s;}
  });
  register({
    id:'epithelial-cell',category:'Histology',anatomyLevel:'tissue',role:'cell',
    title:'Epithelial cell',description:'A polarized epithelial cell with an apical surface and basal edge.',
    keywords:['epithelial cell','epithelium','histology','apical','basal'],aliases:['columnar epithelial cell'],
    limitations:'Generic cell silhouette; tissue-specific junctions and polarity markers are omitted.',
    render:function(o,C){let s=rect(250,120,140,210,C.tissue,24,{stroke:C.red,'stroke-width':4});for(let i=0;i<8;i++)s+=line(258+i*18,112,258+i*18,92,C.teal,3);s+=line(250,330,390,330,C.gold,6);return s;}
  });
  register({
    id:'cell-membrane',category:'Cell biology',anatomyLevel:'molecular',role:'boundary',
    title:'Cell membrane',description:'A phospholipid-bilayer fragment with hydrophilic heads and hydrophobic core.',
    keywords:['cell membrane','phospholipid','bilayer','membrane','transport'],aliases:['plasma membrane'],
    limitations:'Molecular arrangement is conceptual and not a molecular-scale drawing.',
    render:function(o,C){let s='';for(let i=0;i<9;i++){const x=180+i*35;s+=circle(x,185,8,C.teal)+circle(x,255,8,C.teal)+line(x,195,x,245,C.gold,9);}return s;}
  });
  register({
    id:'dna-helix',category:'Molecular biology',anatomyLevel:'molecular',role:'structure',
    title:'DNA double helix',description:'A compact DNA helix with paired bases.',
    keywords:['DNA','double helix','base pair','genetics','nucleic acid'],aliases:['DNA molecule'],
    limitations:'Base sequence and molecular dimensions are not encoded.',
    render:function(o,C){let s=path('M 240 130 C 360 160 280 280 400 310',C.blue,7)+path('M 400 130 C 280 160 360 280 240 310',C.red,7);for(let i=0;i<7;i++){const y=145+i*27,x1=260+(i%2)*18,x2=380-(i%2)*18;s+=line(x1,y,x2,y,C.gold,4);}return s;}
  });
  register({
    id:'neuron',category:'Neuroscience',anatomyLevel:'cellular',role:'cell',
    title:'Neuron',description:'A neuron with soma, dendrites and a myelinated axon path.',
    keywords:['neuron','axon','dendrite','soma','myelin','nervous system'],aliases:['nerve cell'],
    limitations:'Signal direction is illustrative; no electrophysiology is calculated.',
    render:function(o,C){let s=circle(250,220,52,C.soft,{stroke:C.blue,'stroke-width':5});s+=circle(250,220,18,C.blue,{opacity:.7});s+=path('M 205 190 L 140 135 M 205 215 L 125 205 M 205 245 L 135 295 M 295 220 H 500',C.blue,7);for(let i=0;i<4;i++)s+=rect(320+i*48,195,32,50,C.teal,16,{opacity:.75});return s;}
  });
  register({
    id:'red-blood-cell',category:'Hematology',anatomyLevel:'cellular',role:'cell',
    title:'Red blood cell',description:'A biconcave red-cell silhouette.',
    keywords:['red blood cell','erythrocyte','RBC','blood','hematology'],aliases:['erythrocyte'],
    limitations:'No cell count, oxygen saturation or disease state is represented.',
    render:function(o,C){return ellipse(320,220,125,62,C.red,{stroke:C.red,'stroke-width':3})+ellipse(320,220,55,25,C.tissue,{opacity:.68});}
  });
  register({
    id:'white-blood-cell',category:'Immunology',anatomyLevel:'cellular',role:'cell',
    title:'White blood cell',description:'A leukocyte with a lobed nucleus.',
    keywords:['white blood cell','leukocyte','neutrophil','immune cell','blood'],aliases:['leukocyte'],
    limitations:'Generic leukocyte; lineage and activation state are not identified.',
    render:function(o,C){let s=circle(320,220,82,C.soft,{stroke:C.blue,'stroke-width':5});s+=circle(287,220,24,C.purple)+circle(320,200,24,C.purple)+circle(353,220,24,C.purple)+line(305,215,335,207,C.red,5)+line(335,207,350,220,C.red,5);return s;}
  });
  register({
    id:'alveolus',category:'Respiration',anatomyLevel:'organ',role:'structure',
    title:'Alveolar cluster',description:'A cluster of ten lobulated alveolar air spaces wrapped by a thin capillary mesh.',
    keywords:['alveolus','alveoli','lung','gas exchange','capillary','air sac'],aliases:['lung alveolus'],
    limitations:'Conceptual ten-space cluster; individual cell layers, surface area, diffusion rates and ventilation-perfusion relationships are not calculated.',
    render:function(o,C){
      const sac='M 0 -47 C -18 -66 -49 -58 -54 -31 C -79 -30 -94 -8 -80 13 C -92 35 -72 59 -47 54 C -34 76 -5 78 12 58 C 37 77 66 62 61 39 C 87 33 89 5 68 -10 C 79 -35 53 -58 30 -48 C 21 -69 7 -67 0 -47 Z';
      const highlight='M -34 -10 C -18 -31 15 -37 35 -19';
      const cells=[[218,126,.55,-8],[320,109,.62,2],[422,126,.55,8],[178,181,.5,-14],[268,168,.6,-5],[372,168,.6,5],[462,181,.5,14],[224,231,.53,-8],[320,222,.62,0],[416,231,.53,8]];
      let s=path('M 320 45 V 70 M 320 70 C 292 81 266 95 245 116 M 320 70 C 348 81 374 95 395 116',C.blue,11,'none',{opacity:.9});
      cells.forEach(([x,y,k,r])=>{
        const tr='translate('+x+' '+y+') rotate('+r+') scale('+k+' '+k+')';
        s+=path(sac,C.blue,4,C.soft,{transform:tr,'data-structure':'alveolar-space'});
        s+=path(highlight,C.paper,3,'none',{transform:tr,opacity:.48});
      });
      s+=path('M 116 284 C 160 257 202 263 241 284 S 319 304 357 284 S 437 257 524 286',C.red,12,'none',{opacity:.3});
      s+=path('M 116 284 C 160 257 202 263 241 284 S 319 304 357 284 S 437 257 524 286',C.teal,3,'none',{opacity:.9});
      s+=path('M 142 296 C 181 271 214 275 249 294 S 318 317 350 294 S 420 270 499 296',C.red,3,'none',{opacity:.75});
      s+=path('M 166 281 C 185 310 208 310 228 283 M 274 284 C 292 311 314 311 332 284 M 382 284 C 400 310 422 310 443 283',C.red,3,'none',{opacity:.72});
      s+=rect(72,335,496,70,C.tissue,34,{stroke:C.red,'stroke-width':4});
      for(let i=0;i<8;i++){const x=111+62*i,y=371+(i%2?5:-4);s+=ellipse(x,y,17,9,C.red,{opacity:.86,transform:'rotate('+(i%2?8:-7)+' '+x+' '+y+')'});s+=ellipse(x,y,8,3,C.paper,{opacity:.34,transform:'rotate('+(i%2?8:-7)+' '+x+' '+y+')'});}
      return s;
    }
  });
  register({
    id:'artery-vessel',category:'Anatomy',anatomyLevel:'organ',role:'structure',
    title:'Artery cross-section',description:'A simplified vessel cross-section with wall layers and lumen.',
    keywords:['artery','vessel','lumen','blood vessel','anatomy'],aliases:['arterial cross section'],
    limitations:'Wall layers are simplified and not a histological diagnosis.',
    render:function(o,C){let s=circle(320,220,120,C.tissue,{stroke:C.red,'stroke-width':12});s+=circle(320,220,78,C.soft,{stroke:C.gold,'stroke-width':10});s+=circle(320,220,52,C.blue,{opacity:.25});return s;}
  });
  register({
    id:'receptor',category:'Cell biology',anatomyLevel:'molecular',role:'mechanism',
    title:'Membrane receptor',description:'A receptor embedded in a membrane with an external binding site.',
    keywords:['receptor','ligand','membrane protein','signaling','cell biology'],aliases:['cell receptor'],
    limitations:'Binding and downstream signaling are generic and not pathway-specific.',
    render:function(o,C){let s=line(150,185,490,185,C.teal,8)+line(150,255,490,255,C.teal,8);s+=path('M 320 185 V 255 M 320 185 L 290 155 M 320 185 L 350 155',C.blue,12);s+=circle(320,135,18,C.gold);return s;}
  });
  register({
    id:'synapse',category:'Neuroscience',anatomyLevel:'cellular',role:'mechanism',
    title:'Chemical synapse',description:'A presynaptic terminal, cleft and postsynaptic receptors.',
    keywords:['synapse','neurotransmitter','vesicle','receptor','neuron'],aliases:['chemical synapse'],
    limitations:'Release and receptor response are schematic; no transmitter concentration is implied.',
    render:function(o,C){let s=rect(120,105,170,180,C.soft,28,{stroke:C.blue,'stroke-width':5})+rect(350,150,170,135,C.tissue,28,{stroke:C.red,'stroke-width':5});for(let i=0;i<5;i++)s+=circle(165+i*28,170+(i%2)*45,9,C.gold);s+=line(300,200,350,200,C.teal,3,{'stroke-dasharray':'7 7'});for(let i=0;i<4;i++)s+=path('M '+400+i*26+' 190 Q '+412+i*26+' 170 '+424+i*26+' 190',C.red,4);return s;}
  });
  register({
    id:'bone',category:'Anatomy',anatomyLevel:'tissue',role:'structure',
    title:'Bone cross-section',description:'A compact bone fragment with a simplified trabecular pattern.',
    keywords:['bone','osseous tissue','trabeculae','skeleton','anatomy'],aliases:['bone tissue'],
    limitations:'Generic bone texture; cortical and cancellous regions are not separated.',
    render:function(o,C){let s=rect(155,105,330,230,C.tissue,34,{stroke:C.gold,'stroke-width':6});for(let i=0;i<7;i++)s+=path('M '+185+' '+(135+i*25)+' Q '+270+' '+(105+i*22)+' 455 '+(150+i*25),C.gold,7);for(let i=0;i<5;i++)s+=circle(220+i*60,220+(i%2)*34,10,C.red,{opacity:.6});return s;}
  });
  register({
    id:'scalpel',category:'Surgery',anatomyLevel:'instrument',role:'instrument',
    title:'Scalpel',description:'A simple scalpel silhouette for procedural illustrations.',
    keywords:['scalpel','surgery','instrument','incision','operative'],aliases:['surgical scalpel'],
    limitations:'Generic instrument silhouette; no manufacturer or size is represented.',
    render:function(o,C){let s=rect(255,198,190,44,C.blue,12)+path('M 445 198 L 535 175 L 470 242 L 445 242 Z',C.line,3,C.paper);s+=line(245,220,165,220,C.gold,8)+line(175,210,150,195,C.gold,5);return s;}
  });
  register({
    id:'syringe',category:'Surgery',anatomyLevel:'instrument',role:'instrument',
    title:'Syringe',description:'A syringe with barrel, plunger and needle.',
    keywords:['syringe','needle','injection','surgery','instrument'],aliases:['injection syringe'],
    limitations:'No medication, dose or route is shown.',
    render:function(o,C){let s=rect(180,175,250,90,C.soft,14,{stroke:C.blue,'stroke-width':5})+line(220,150,220,290,C.blue,7)+line(180,220,120,220,C.blue,7)+line(430,220,535,220,C.gold,4)+line(535,220,570,210,C.gold,3);for(let i=0;i<4;i++)s+=line(245+i*38,188,245+i*38,252,C.line,3);return s;}
  });
  register({
    id:'suture',category:'Surgery',anatomyLevel:'instrument',role:'mechanism',
    title:'Suture and needle',description:'A curved surgical needle with thread for wound-closure scenes.',
    keywords:['suture','needle','wound closure','surgery','thread'],aliases:['surgical suture'],
    limitations:'Closure technique, tissue tension and material properties are not represented.',
    render:function(o,C){let s=path('M 215 265 C 145 190 190 120 275 145 C 360 170 410 245 500 220',C.gold,5);s+=path('M 215 265 C 145 190 190 120 275 145',C.line,12,'none',{opacity:.75});s+=circle(500,220,7,C.gold);return s;}
  });

  register({
    id:'pituitary-gland',category:'Endocrinology',anatomyLevel:'organ',role:'structure',
    title:'Pituitary gland',description:'A compact pituitary gland silhouette with anterior and posterior lobes and a stalk.',
    keywords:['pituitary','hypophysis','pituitary gland','endocrine','sella'],aliases:['hypophysis','master gland'],
    limitations:'Gross-anatomy schematic; lobes, vascular connections and hormone pathways are simplified.',
    render:function(o,C){let s=path('M 320 150 C 282 142 242 166 232 208 C 222 248 240 284 278 292 C 296 296 308 284 320 275 C 332 284 344 296 362 292 C 400 284 418 248 408 208 C 398 166 358 142 320 150 Z',C.tissue,5,C.soft);s+=path('M 320 150 C 310 132 305 118 320 98 C 335 118 330 132 320 150',C.gold,7,'none');s+=path('M 320 155 V 275',C.red,4,'none',{opacity:.8});s+=circle(300,218,10,C.red,{opacity:.55})+circle(340,218,10,C.blue,{opacity:.55});return s;}
  });
  register({
    id:'clavicle',category:'Anatomy',anatomyLevel:'organ',role:'structure',
    title:'Clavicle',description:'An S-shaped clavicle silhouette with enlarged sternal and acromial ends.',
    keywords:['clavicle','collarbone','pectoral girdle','shoulder','bone'],aliases:['collar bone','collarbone'],
    limitations:'Single-bone gross-anatomy schematic; side, landmarks and fracture patterns are not represented.',
    render:function(o,C){let s=path('M 135 238 C 190 190 235 186 286 214 C 320 233 320 248 354 226 C 406 192 458 194 505 235',C.gold,25,'none');s+=path('M 135 238 C 190 190 235 186 286 214 C 320 233 320 248 354 226 C 406 192 458 194 505 235',C.paper,5,'none',{opacity:.7});s+=circle(133,238,20,C.gold)+circle(507,235,20,C.gold);return s;}
  });
  register({
    id:'trachea',category:'Respiration',anatomyLevel:'organ',role:'structure',
    title:'Trachea',description:'A tracheal tube with cartilage rings and a simplified bifurcation into main bronchi.',
    keywords:['trachea','windpipe','airway','bronchi','respiration'],aliases:['windpipe','tracheal tube'],
    limitations:'Airway schematic; cartilage composition, mucosa, dimensions and airflow are not to scale.',
    render:function(o,C){let s=rect(278,88,84,236,C.soft,36,{stroke:C.blue,'stroke-width':6});for(let y=112;y<305;y+=28)s+=path('M 285 '+y+' Q 320 '+(y-10)+' 355 '+y,C.teal,5,'none');s+=path('M 320 324 C 320 350 278 366 238 384',C.blue,24,'none')+path('M 320 324 C 320 350 362 366 402 384',C.blue,24,'none')+circle(238,384,16,C.soft,{stroke:C.blue,'stroke-width':5})+circle(402,384,16,C.soft,{stroke:C.blue,'stroke-width':5});return s;}
  });
  register({
    id:'thyroid-gland',category:'Endocrinology',anatomyLevel:'organ',role:'structure',
    title:'Thyroid gland',description:'A butterfly-shaped thyroid silhouette wrapped around a short tracheal segment.',
    keywords:['thyroid','thyroid gland','endocrine','neck','trachea'],aliases:['thyroid'],
    limitations:'Gross-anatomy schematic; lobe proportions, isthmus thickness and parathyroids are not shown to scale.',
    render:function(o,C){let s='';for(let y=230;y<315;y+=25)s+=line(320,y,320,y+14,C.line,10);s+=ellipse(270,245,58,82,C.tissue,{stroke:C.red,'stroke-width':5,transform:'rotate(18 270 245)'});s+=ellipse(370,245,58,82,C.tissue,{stroke:C.red,'stroke-width':5,transform:'rotate(-18 370 245)'});s+=rect(292,224,56,42,C.tissue,20,{stroke:C.red,'stroke-width':5});s+=circle(270,245,8,C.gold,{opacity:.6})+circle(370,245,8,C.gold,{opacity:.6});return s;}
  });
  register({
    id:'brainstem',category:'Neuroscience',anatomyLevel:'organ',role:'structure',
    title:'Brainstem',description:'A simplified brainstem with midbrain, pons, medulla and a cerebellar contour.',
    keywords:['brainstem','midbrain','pons','medulla','cerebellum','neuroanatomy'],aliases:['brain stem'],
    limitations:'Orientation and nuclei are simplified; this is a gross educational silhouette, not a neuroanatomy atlas.',
    render:function(o,C){let s=ellipse(420,220,72,100,C.soft,{stroke:C.purple,'stroke-width':5});for(let i=0;i<4;i++)s+=path('M '+390+' '+(155+i*35)+' Q 420 '+(135+i*35)+' 450 '+(155+i*35),C.purple,4,'none',{opacity:.75});s+=path('M 320 128 C 286 142 284 180 300 202 C 288 224 290 260 310 278 C 300 310 310 344 320 368 C 330 344 340 310 330 278 C 350 260 352 224 340 202 C 356 180 354 142 320 128 Z',C.tissue,5,C.soft);s+=line(320,150,320,352,C.red,4,{opacity:.7});return s;}
  });

  const meta=d=>{const {render,...m}=d;return JSON.parse(JSON.stringify(m));};
  function search(query='',filters={}){
    if(typeof query!=='string')throw new Error('search query must be a string.');
    const allowedFilters=new Set(['category','anatomyLevel','role']);
    for(const key of Object.keys(filters||{}))if(!allowedFilters.has(key))throw new Error('Unknown search filter: '+key);
    const q=query.trim().toLowerCase();
    return Array.from(registry.values(),meta).filter(d=>{
      const hay=[d.id,d.title,d.description,d.category,d.anatomyLevel,d.role,...d.keywords,...d.aliases].join(' ').toLowerCase();
      return (!q||hay.includes(q))&&Object.entries(filters||{}).every(([k,v])=>!v||d[k]===v);
    });
  }
  function renderBatch(specs,expectedCount){
    if(!Array.isArray(specs)||!specs.length)throw new Error('renderBatch requires at least one part.');
    if(expectedCount!==undefined&&(!Number.isInteger(expectedCount)||expectedCount<1||specs.length!==expectedCount))throw new Error('Requested '+expectedCount+' parts but received '+specs.length+'.');
    return specs.map((spec,i)=>{
      if(!spec||typeof spec!=='object'||typeof spec.id!=='string')throw new Error('Batch item '+i+' must contain a part id.');
      return render(spec.id,spec.options||{});
    }).join('');
  }
  function renderBatchSVG(specs,expectedCount){
    const clean=Array.isArray(specs)?specs:[];
    const titles=clean.map(spec=>get(spec.id).title).join(', ');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 440" role="img" aria-label="'+escape('Medical parts: '+titles)+'" style="font-family:system-ui,-apple-system,Segoe UI,sans-serif">'+el('title',{},'Medical parts batch')+el('desc',{},escape(titles))+rect(0,0,640,440,palette.paper,0)+renderBatch(clean,expectedCount)+'</svg>';
  }
  function get(id){const d=registry.get(id);if(!d)throw new Error('Unknown partId: '+id);return d;}
  function render(id,options={}){
    const d=get(id),o=validateOptions(options),C={...palette,accent:color(o.accent)};
    return '<g transform="translate('+(o.x-320)+' '+(o.y-220)+') rotate('+o.rotation+' 320 220) translate(320 220) scale('+o.scale+') translate(-320 -220)" opacity="'+o.opacity+'">'+d.render(o,C)+'</g>';
  }
  function renderSVG(id,options={}){
    const o=validateOptions(options),d=get(id);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 440" role="img" aria-label="'+escape(d.title)+'" style="font-family:system-ui,-apple-system,Segoe UI,sans-serif">'+el('title',{},d.title)+el('desc',{},d.description+' '+d.limitations)+rect(0,0,640,440,palette.paper,0)+render(id,o)+'</svg>';
  }
  G.MedicalMotionParts=Object.freeze({
    version:'1.0.0',palette,register,get,
    list:()=>Array.from(registry.values(),meta),
    search,validate:validateOptions,render,renderSVG,renderBatch,renderBatchSVG
  });
})(globalThis);
