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
    title:'Alveolus',description:'An alveolar air space with a thin capillary interface.',
    keywords:['alveolus','alveoli','lung','gas exchange','capillary'],aliases:['lung alveolus'],
    limitations:'Flattened exchange schematic; surface area and diffusion rates are not calculated.',
    render:function(o,C){let s=circle(320,220,105,C.soft,{stroke:C.blue,'stroke-width':6});s+=path('M 220 245 Q 320 270 420 245',C.teal,7);for(let i=0;i<5;i++)s+=ellipse(250+i*35,300,17,9,C.red);return s;}
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
  const meta=d=>{const {render,...m}=d;return JSON.parse(JSON.stringify(m));};
  function get(id){const d=registry.get(id);if(!d)throw new Error('Unknown partId: '+id);return d;}
  function render(id,options={}){
    const d=get(id),o=validateOptions(options),C={...palette,accent:color(o.accent)};
    return '<g transform="translate('+o.x+' '+o.y+') rotate('+o.rotation+') scale('+o.scale+')" opacity="'+o.opacity+'">'+d.render(o,C)+'</g>';
  }
  function renderSVG(id,options={}){
    const o=validateOptions(options),d=get(id);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 440" role="img" aria-label="'+escape(d.title)+'" style="font-family:system-ui,-apple-system,Segoe UI,sans-serif">'+el('title',{},d.title)+el('desc',{},d.description+' '+d.limitations)+rect(0,0,640,440,palette.paper,0)+render(id,o)+'</svg>';
  }
  G.MedicalMotionParts=Object.freeze({
    version:'1.0.0',palette,register,get,
    list:()=>Array.from(registry.values(),meta),
    validate:validateOptions,render,renderSVG
  });
})(globalThis);
