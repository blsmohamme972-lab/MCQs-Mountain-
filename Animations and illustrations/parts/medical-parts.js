/* Medical Motion part definitions v2.0.0.
 * This source module owns component geometry and metadata registration. The engine owns
 * validation, transforms, discovery, batching and renderer contexts. scripts/build.mjs
 * concatenates this file with medical-parts-engine.js into the classic medical-parts.js entry point.
 */
(function defineMedicalMotionPartDefinitions(G){
  'use strict';
  G.MedicalMotionPartDefinitions=function(register,H){
    const {circle,ellipse,rect,line,path,move,arrow,text}=H;
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
    render:function(o,C){let s=rect(120,105,170,180,C.soft,28,{stroke:C.blue,'stroke-width':5})+rect(350,150,170,135,C.tissue,28,{stroke:C.red,'stroke-width':5});for(let i=0;i<5;i++)s+=circle(165+i*28,170+(i%2)*45,9,C.gold);s+=line(300,200,350,200,C.teal,3,{'stroke-dasharray':'7 7'});for(let i=0;i<4;i++){const x=400+i*26;s+=path('M '+x+' 190 Q '+(x+12)+' 170 '+(x+24)+' 190',C.red,4);}return s;}
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

  // Composition-first components. Their parameter schemas are intentionally small so an
  // agent can discover and validate a part without opening its renderer.
  register({
    id:'vessel-segment',version:2,category:'Circulation',anatomyLevel:'organ',role:'structure',
    title:'Longitudinal vessel segment',description:'A configurable artery, vein or capillary segment with named attachments and optional valve.',
    keywords:['vessel','artery','vein','capillary','valve','lumen','segment'],aliases:['longitudinal vessel'],
    limitations:'Longitudinal educational schematic; wall layers, pressure, velocity and histology are not to scale.',
    dependencies:[],attachments:{inlet:{x:60,y:220},outlet:{x:580,y:220},center:{x:320,y:220},valve:{x:320,y:220}},
    bounds:{x:40,y:100,width:560,height:240},defaults:{kind:'artery',narrowing:.2,valve:false},
    parameterSchema:{kind:{type:'enum',values:['artery','vein','capillary'],description:'Wall and lumen variant.'},narrowing:{type:'number',min:0,max:.75,step:.05,description:'Illustrative central narrowing.'},valve:{type:'boolean',description:'Show a venous valve leaf pair.'}},
    render:function(o,C){
      const k=o.params.kind,n=o.params.narrowing,wall=k==='artery'?C.red:k==='vein'?C.blue:C.teal,lumen=k==='capillary'?18:48;
      const top=220-lumen+80*n*Math.exp(-Math.pow((160)/100,2)), mid=220;
      let s=path('M 52 '+(220-lumen)+' C 180 '+(220-lumen)+' 235 '+(220-lumen+80*n)+' 320 '+(220-lumen+80*n)+' S 460 '+(220-lumen)+' 588 '+(220-lumen),wall,k==='capillary'?8:18,C.soft)+path('M 52 '+(220+lumen)+' C 180 '+(220+lumen)+' 235 '+(220+lumen-80*n)+' 320 '+(220+lumen-80*n)+' S 460 '+(220+lumen)+' 588 '+(220+lumen),wall,k==='capillary'?8:18,C.soft);
      s+=line(52,220,588,220,C.line,2,{'stroke-dasharray':'8 8',opacity:.65});
      s+=text(320,86,k[0].toUpperCase()+k.slice(1)+' segment',C.ink,18,'middle',750);
      s+=circle(60,220,7,C.gold)+circle(580,220,7,C.gold);
      if(o.params.valve){s+=path('M 320 220 Q 285 190 270 220',C.gold,8,'none')+path('M 320 220 Q 355 190 370 220',C.gold,8,'none');}
      return s;
    }
  });
  register({
    id:'blood-flow',version:2,category:'Circulation',anatomyLevel:'cellular',role:'mechanism',
    title:'Path-based blood flow',description:'Reusable deterministic red-cell particles moving along a supplied polyline.',
    keywords:['blood flow','particle flow','red blood cell','path','motion'],aliases:['blood particles'],
    limitations:'Particles illustrate direction and continuity only; no blood velocity, viscosity or cell deformability is calculated.',
    dependencies:[],attachments:{start:{x:80,y:220},end:{x:560,y:220},center:{x:320,y:220}},bounds:{x:50,y:120,width:540,height:200},
    defaults:{points:[[80,220],[560,220]],count:7,speed:1},parameterSchema:{
      points:{type:'polyline',description:'Polyline in local 640×440 coordinates.'},count:{type:'integer',min:1,max:24,step:1,description:'Particle count.'},speed:{type:'number',min:.1,max:4,step:.1,description:'Visual cycle speed.'}
    },
    render:function(o,C){
      const pts=o.params.points,phase=(o.time*o.params.speed/4+o.progress)%1;
      let s=path('M '+pts.map(q=>q.join(' ')).join(' L '),C.red,10,'none',{opacity:.2});
      for(let i=0;i<o.params.count;i++){const q=move(pts,(phase+i/o.params.count)%1);s+=ellipse(q[0],q[1],12,7,C.red,{transform:'rotate(8 '+q[0]+' '+q[1]+')'})+ellipse(q[0],q[1],5,2,C.paper,{opacity:.4});}
      return s;
    }
  });
  const attachmentPoint=(name,attachments)=>attachments[name]||attachments.center||{x:320,y:220};
  register({
    id:'attachment-arrow',version:2,category:'Composition',anatomyLevel:'tissue',role:'mechanism',
    title:'Attachment-aware arrow',description:'An arrow connecting named attachment points in a composed scene.',
    keywords:['arrow','attachment','label','direction','annotation'],aliases:['component arrow'],
    limitations:'Annotation geometry communicates a declared relationship; it does not infer anatomy or causality.',
    dependencies:[],attachments:{start:{x:100,y:220},end:{x:540,y:220},center:{x:320,y:220}},bounds:{x:60,y:150,width:520,height:140},
    defaults:{from:'start',to:'end',label:'Direction'},parameterSchema:{from:{type:'string',maxLength:32},to:{type:'string',maxLength:32},label:{type:'string',maxLength:48}},
    render:function(o,C){const a=attachmentPoint(o.params.from,o.state.attachments||{}),b=attachmentPoint(o.params.to,o.state.attachments||{});return arrow(a.x,a.y,b.x,b.y,C.teal,5)+text((a.x+b.x)/2,(a.y+b.y)/2-14,o.params.label,C.ink,16,'middle',750);}
  });
  register({
    id:'attachment-label',version:2,category:'Composition',anatomyLevel:'tissue',role:'mechanism',
    title:'Attachment-aware label',description:'A concise label placed beside a named attachment point.',
    keywords:['label','attachment','annotation','callout'],aliases:['component label'],
    limitations:'Label placement is schematic and does not encode a measured anatomical landmark.',
    dependencies:[],attachments:{center:{x:320,y:220}},bounds:{x:40,y:120,width:560,height:180},
    defaults:{at:'center',label:'Structure',dx:0,dy:-24},parameterSchema:{at:{type:'string',maxLength:32},label:{type:'string',maxLength:48},dx:{type:'number',min:-320,max:320,step:1},dy:{type:'number',min:-220,max:220,step:1}},
    render:function(o,C){const a=attachmentPoint(o.params.at,o.state.attachments||{});return text(a.x+o.params.dx,a.y+o.params.dy,o.params.label,C.ink,17,'middle',750)+line(a.x,a.y,a.x+o.params.dx,a.y+o.params.dy+6,C.muted,2);}
  });
  register({
    id:'platelet',version:2,category:'Hematology',anatomyLevel:'cellular',role:'cell',
    title:'Platelet',description:'A small activated platelet silhouette with granule marks.',
    keywords:['platelet','thrombocyte','clot','hemostasis'],aliases:['thrombocyte'],
    limitations:'Generic platelet icon; activation state and granule contents are not quantified.',
    dependencies:[],attachments:{center:{x:320,y:220}},bounds:{x:230,y:130,width:180,height:180},
    render:function(o,C){let s=circle(320,220,42,C.red,{stroke:C.ink,'stroke-width':3});for(let i=0;i<6;i++){const a=i*Math.PI/3;s+=line(320+30*Math.cos(a),220+30*Math.sin(a),320+50*Math.cos(a),220+50*Math.sin(a),C.gold,5);}for(let i=0;i<4;i++)s+=circle(305+i*10,210+(i%2)*18,4,C.gold);return s;}
  });
  register({
    id:'fibrin-mesh',version:2,category:'Hematology',anatomyLevel:'molecular',role:'mechanism',
    title:'Fibrin mesh',description:'A reusable cross-linked fibrin network whose density follows deterministic progress.',
    keywords:['fibrin','mesh','clot','coagulation','network'],aliases:['fibrin network'],
    limitations:'Network topology is illustrative; clot strength, factor concentrations and lysis are omitted.',
    dependencies:['platelet'],attachments:{center:{x:320,y:220},inlet:{x:90,y:220},outlet:{x:550,y:220}},bounds:{x:80,y:110,width:480,height:220},
    defaults:{density:.7},parameterSchema:{density:{type:'number',min:.1,max:1,step:.05,description:'Final illustrative mesh density.'}},
    render:function(o,C){let s='';const n=Math.max(2,Math.round(3+o.params.density*6*o.progress));for(let i=0;i<n;i++){const y=140+i*38;s+=path('M 100 '+y+' Q 180 '+(y-25)+' 260 '+(y+8)+' T 420 '+(y-4)+' T 540 '+y,C.gold,3,'none',{opacity:.35+.65*o.progress});}for(let i=0;i<n-1;i++)s+=path('M '+(150+i*42)+' 125 L '+(210+i*42)+' 315',C.teal,2,'none',{opacity:.25+.5*o.progress});return s;}
  });
  register({
    id:'layered-tissue',version:2,category:'Histology',anatomyLevel:'tissue',role:'structure',
    title:'Layered tissue',description:'Three distinct tissue layers with named attachment edges for wound scenes.',
    keywords:['tissue','epidermis','dermis','layer','wound'],aliases:['tissue layers'],
    limitations:'Generic educational layers; cell types, thickness and histological diagnosis are not represented.',
    dependencies:[],attachments:{apical:{x:320,y:100},basal:{x:320,y:340},left:{x:70,y:220},right:{x:570,y:220},center:{x:320,y:220}},bounds:{x:60,y:90,width:520,height:270},
    defaults:{thickness:.33},parameterSchema:{thickness:{type:'number',min:.2,max:.5,step:.05,description:'Relative layer height.'}},
    render:function(o,C){const h=220*o.params.thickness;return rect(70,110,500,h,C.gold,12,{opacity:.78})+rect(70,110+h,500,h,C.tissue,12,{opacity:.86})+rect(70,110+2*h,500,220-h*2,C.soft,12,{opacity:.9})+line(70,110,570,110,C.line,3)+line(70,330,570,330,C.line,3);}
  });
  register({
    id:'fibroblast',version:2,category:'Tissue repair',anatomyLevel:'cellular',role:'cell',
    title:'Fibroblast',description:'A spindle-shaped fibroblast with a central nucleus for repair compositions.',
    keywords:['fibroblast','wound repair','collagen','connective tissue'],aliases:['repair fibroblast'],
    limitations:'Cell silhouette only; collagen synthesis rate and lineage are not represented.',
    dependencies:[],attachments:{center:{x:320,y:220}},bounds:{x:150,y:150,width:340,height:140},
    render:function(o,C){let s=path('M 150 245 C 220 165 420 165 490 245 C 420 275 220 275 150 245 Z',C.teal,5,C.soft);s+=ellipse(320,220,34,18,C.purple,{opacity:.8});s+=line(186,236,150,214,C.teal,5)+line(454,236,490,214,C.teal,5);return s;}
  });
  register({
    id:'macrophage',version:2,category:'Immunology',anatomyLevel:'cellular',role:'cell',
    title:'Macrophage',description:'An irregular macrophage silhouette with pseudopods for an inflammation scene.',
    keywords:['macrophage','immune cell','phagocytosis','inflammation'],aliases:['tissue macrophage'],
    limitations:'Generic immune-cell silhouette; polarization, cytokines and phagocytic rate are not represented.',
    dependencies:[],attachments:{center:{x:320,y:220}},bounds:{x:150,y:120,width:340,height:220},
    render:function(o,C){let s=path('M 230 170 C 180 150 155 205 188 235 C 150 280 220 320 260 284 C 300 330 360 302 362 270 C 430 295 485 245 444 202 C 460 145 390 130 356 170 C 320 122 260 128 230 170 Z',C.soft,5,C.blue);s+=circle(320,220,42,C.purple,{opacity:.72});for(let i=0;i<6;i++)s+=circle(285+(i%3)*28,188+Math.floor(i/3)*28,5,C.gold);return s;}
  });
  register({
    id:'plaque-overlay',version:2,category:'Pathology',anatomyLevel:'tissue',role:'mechanism',
    title:'Plaque overlay',description:'A configurable plaque shelf that narrows a vessel lumen without replacing vessel geometry.',
    keywords:['plaque','atherosclerosis','stenosis','vessel','overlay'],aliases:['atherosclerotic plaque'],
    limitations:'Conceptual overlay; composition, calcification, rupture and clinical risk are not represented.',
    dependencies:['vessel-segment'],attachments:{center:{x:320,y:220},upstream:{x:240,y:205},downstream:{x:410,y:205}},bounds:{x:220,y:165,width:210,height:105},
    defaults:{severity:.5},parameterSchema:{severity:{type:'number',min:.1,max:1,step:.05,description:'Illustrative shelf thickness.'}},
    render:function(o,C){const h=12+42*o.params.severity;return path('M 220 220 C 250 '+(220-h)+' 280 '+(220-h*.6)+' 320 '+(220-h*.7)+' S 390 '+(220-h)+' 430 220',C.gold,Math.max(8,h/2),C.tissue,{opacity:.9})+path('M 225 216 Q 320 '+(184-h*.35)+' 425 216',C.red,3,'none',{opacity:.7});}
  });
  register({
    id:'heart',version:2,category:'Cardiology',anatomyLevel:'organ',role:'structure',
    title:'Heart schematic',description:'A compact four-chamber heart with great-vessel attachment points.',
    keywords:['heart','atrium','ventricle','cardiac','circulation'],aliases:['four chamber heart'],
    limitations:'Schematic heart only; chamber volumes, valves, coronary anatomy and electrical timing are omitted.',
    dependencies:[],attachments:{venaCava:{x:245,y:75},pulmonaryArtery:{x:395,y:75},aorta:{x:320,y:70},center:{x:320,y:220}},bounds:{x:150,y:70,width:340,height:300},
    render:function(o,C){
      // Structural geometry is extracted from templates/03-cardiac-circulation.js;
      // labels and animated circuit arrows remain scene-specific.
      let s=path('M 320 328 C 291 305 235 272 235 211 C 235 170 283 151 320 187 C 357 151 405 170 405 211 C 405 272 349 305 320 328 Z',C.red,6,C.tissue);
      s+=path('M 320 187 V 282 M 246 227 C 270 217 296 219 320 232 M 320 232 C 344 219 370 217 394 227',C.red,4,'none',{opacity:.8});
      s+=path('M 280 252 Q 294 238 308 252 M 332 252 Q 346 238 360 252',C.gold,4,'none',{opacity:.9});
      s+=circle(278,203,5,C.blue,{opacity:.8})+circle(278,270,5,C.blue,{opacity:.8})+circle(362,203,5,C.red,{opacity:.8})+circle(362,270,5,C.red,{opacity:.8});
      return s;
    }
  });
  register({
    id:'nephron',version:2,category:'Renal physiology',anatomyLevel:'organ',role:'structure',
    title:'Nephron schematic',description:'A nephron loop with glomerulus, tubule, loop and collecting duct attachments.',
    keywords:['nephron','glomerulus','tubule','kidney','filtration'],aliases:['nephron loop'],
    limitations:'Schematic nephron; filtration, reabsorption, secretion and concentration are not calculated.',
    dependencies:[],attachments:{afferent:{x:125,y:140},efferent:{x:175,y:140},collectingDuct:{x:520,y:110},center:{x:320,y:220}},bounds:{x:50,y:45,width:545,height:325},
    render:function(o,C){
      // Structural geometry is extracted from templates/07-nephron-exchange.js;
      // filtration and exchange arrows remain complete-scene concerns.
      let s=circle(126,132,73,C.soft,{stroke:C.blue,'stroke-width':4});
      s+=path('M 62 126 C 82 82 112 164 132 116 S 182 81 176 133 S 112 187 92 135 S 145 91 166 151',C.red,10,'none',{opacity:.88});
      s+=path('M 54 161 C 82 193 132 206 178 169',C.gold,4,'none',{opacity:.8});
      s+=path('M 188 132 C 228 110 267 105 298 128 C 335 157 311 194 274 212 C 239 229 247 270 286 277 C 326 284 348 248 373 270 C 399 293 374 335 342 347 C 300 363 246 346 227 315',C.gold,24,'none');
      s+=path('M 188 132 C 228 110 267 105 298 128 C 335 157 311 194 274 212 C 239 229 247 270 286 277 C 326 284 348 248 373 270 C 399 293 374 335 342 347 C 300 363 246 346 227 315',C.paper,13,'none');
      s+=path('M 212 88 C 265 54 338 66 395 108 C 451 150 514 130 590 98',C.red,9,'none',{opacity:.65});
      s+=path('M 212 88 C 265 54 338 66 395 108 C 451 150 514 130 590 98',C.blue,3,'none');
      return s;
    }
  });

  };
})(globalThis);

/* Medical Motion Parts v2.0.0 | Deterministic, dependency-free SVG components.
 * Generated classic bundle: definitions/medical.js + medical-parts-engine.js.
 * catalog.json is the authoritative metadata source.
 * The compact source map keeps runtime discovery offline and is checked against the
 * catalog by tests/builds. Existing render(id, {x,y,scale,rotation,opacity,accent})
 * calls remain valid.
 */
(function bootMedicalMotionParts(G){
  'use strict';
  const palette={
    ink:'#162d48', muted:'#526780', line:'#dbe5f0', blue:'#246bdd',
    red:'#cf4263', teal:'#087f8c', gold:'#986300', purple:'#7254b8',
    soft:'#eaf1fb', tissue:'#f8ddd6', paper:'#ffffff'
  };
  const themes={
    clinical:palette,
    night:{...palette,ink:'#f0f6ff',muted:'#b6c9e1',line:'#344a65',blue:'#80adff',red:'#ff89a1',teal:'#66d6d0',gold:'#ffd276',soft:'#203652',tissue:'#5f3843',paper:'#13243b'}
  };
  const sourceMap={
    'bacterium-coccus':['https://www.ncbi.nlm.nih.gov/books/NBK8406/'],
    'bacterium-bacillus':['https://www.ncbi.nlm.nih.gov/books/NBK8406/'],
    'bacterium-spirillum':['https://www.ncbi.nlm.nih.gov/books/NBK8406/'],
    'animal-cell':['https://openstax.org/books/biology-2e/pages/4-3-eukaryotic-cells'],
    'nucleus':['https://openstax.org/books/biology-2e/pages/4-4-the-nucleus-and-ribosomes'],
    'mitochondrion':['https://openstax.org/books/biology-2e/pages/4-4-the-nucleus-and-ribosomes'],
    'epithelial-cell':['https://openstax.org/books/anatomy-and-physiology-2e/pages/4-2-epithelial-tissue'],
    'cell-membrane':['https://openstax.org/books/biology-2e/pages/5-1-components-and-structure'],
    'dna-helix':['https://openstax.org/books/biology-2e/pages/14-2-dna-structure-and-sequencing'],
    'neuron':['https://openstax.org/books/anatomy-and-physiology-2e/pages/12-2-basic-structure-and-function-of-the-nervous-system'],
    'red-blood-cell':['https://openstax.org/books/anatomy-and-physiology-2e/pages/18-2-production-of-the-formed-elements'],
    'white-blood-cell':['https://openstax.org/books/anatomy-and-physiology-2e/pages/18-2-production-of-the-formed-elements'],
    'alveolus':['https://www.nhlbi.nih.gov/health/lungs/respiratory-system'],
    'artery-vessel':['https://openstax.org/books/anatomy-and-physiology-2e/pages/20-1-blood-flow-and-blood-pressure'],
    'receptor':['https://openstax.org/books/biology-2e/pages/9-1-signaling-molecules-and-cellular-receptors'],
    'synapse':['https://openstax.org/books/anatomy-and-physiology-2e/pages/12-4-the-action-potential'],
    'bone':['https://openstax.org/books/anatomy-and-physiology-2e/pages/6-3-bone-structure'],
    'scalpel':['https://www.ncbi.nlm.nih.gov/books/NBK519054/'],
    'syringe':['https://www.ncbi.nlm.nih.gov/books/NBK470404/'],
    'suture':['https://www.ncbi.nlm.nih.gov/books/NBK507908/'],
    'pituitary-gland':['https://www.ncbi.nlm.nih.gov/books/NBK279054/'],
    'clavicle':['https://openstax.org/books/anatomy-and-physiology-2e/pages/8-3-the-pectoral-girdle'],
    'trachea':['https://www.nhlbi.nih.gov/health/lungs/respiratory-system'],
    'thyroid-gland':['https://www.ncbi.nlm.nih.gov/books/NBK279388/'],
    'brainstem':['https://openstax.org/books/anatomy-and-physiology-2e/pages/12-2-basic-structure-and-function-of-the-nervous-system'],
    'vessel-segment':['https://openstax.org/books/anatomy-and-physiology-2e/pages/20-1-blood-flow-and-blood-pressure'],
    'blood-flow':['https://openstax.org/books/anatomy-and-physiology-2e/pages/20-2-blood-flow-blood-pressure-and-resistance'],
    'attachment-arrow':['https://openstax.org/books/anatomy-and-physiology-2e/pages/20-1-blood-flow-and-blood-pressure'],
    'attachment-label':['https://openstax.org/books/anatomy-and-physiology-2e/pages/20-1-blood-flow-and-blood-pressure'],
    'platelet':['https://openstax.org/books/anatomy-and-physiology-2e/pages/18-5-hemostasis'],
    'fibrin-mesh':['https://openstax.org/books/anatomy-and-physiology-2e/pages/18-5-hemostasis'],
    'layered-tissue':['https://openstax.org/books/anatomy-and-physiology-2e/pages/4-2-epithelial-tissue'],
    'fibroblast':['https://www.ncbi.nlm.nih.gov/books/NBK470443/'],
    'macrophage':['https://openstax.org/books/anatomy-and-physiology-2e/pages/21-2-barriers-and-defenses'],
    'plaque-overlay':['https://www.nhlbi.nih.gov/health/atherosclerosis'],
    'heart':['https://openstax.org/books/anatomy-and-physiology-2e/pages/19-1-heart-anatomy'],
    'nephron':['https://openstax.org/books/anatomy-and-physiology-2e/pages/25-1-the-urinary-system'],
  };
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const el=(tag,attrs={},children='')=>'<'+tag+' '+Object.entries(attrs).map(([k,v])=>k+'="'+escape(v)+'"').join(' ')+'>'+children+'</'+tag+'>';
  const circle=(x,y,r,fill,extra={})=>el('circle',{cx:x,cy:y,r,fill,...extra});
  const ellipse=(x,y,rx,ry,fill,extra={})=>el('ellipse',{cx:x,cy:y,rx,ry,fill,...extra});
  const rect=(x,y,w,h,fill,r=16,extra={})=>el('rect',{x,y,width:w,height:h,rx:r,fill,...extra});
  const line=(x1,y1,x2,y2,stroke,width=4,extra={})=>el('line',{x1,y1,x2,y2,stroke,'stroke-width':width,'stroke-linecap':'round',...extra});
  const path=(d,stroke,width=4,fill='none',extra={})=>el('path',{d,stroke,'stroke-width':width,fill,'stroke-linecap':'round','stroke-linejoin':'round',...extra});
  const polygon=(points,fill,extra={})=>el('polygon',{points,fill,...extra});
  const move=(points,fraction)=>{
    const clean=Array.isArray(points)?points:[], lengths=clean.slice(1).map((q,i)=>Math.hypot(q[0]-clean[i][0],q[1]-clean[i][1]));
    let d=clamp(fraction)*lengths.reduce((a,b)=>a+b,0);
    for(let i=0;i<lengths.length;i++){if(d<=lengths[i]||i===lengths.length-1){const u=lengths[i]?d/lengths[i]:0;return [clean[i][0]+(clean[i+1][0]-clean[i][0])*u,clean[i][1]+(clean[i+1][1]-clean[i][1])*u];}d-=lengths[i];}
    return clean[0]||[320,220];
  };
  const arrow=(x1,y1,x2,y2,stroke,width=4)=>{
    const a=Math.atan2(y2-y1,x2-x1),n=11;
    return line(x1,y1,x2,y2,stroke,width)+path('M '+(x2-n*Math.cos(a-.5))+' '+(y2-n*Math.sin(a-.5))+' L '+x2+' '+y2+' L '+(x2-n*Math.cos(a+.5))+' '+(y2-n*Math.sin(a+.5)),stroke,width);
  };
  const text=(x,y,value,fill=palette.ink,size=18,anchor='middle',weight=650)=>el('text',{x,y,fill,'font-size':size,'text-anchor':anchor,'font-weight':weight},escape(value));
  const color=key=>palette[palette[key]?key:'blue'];
  const allowed=new Set(['x','y','scale','rotation','opacity','accent','theme','params','state','time','progress']);
  const defaults={x:320,y:220,scale:1,rotation:0,opacity:1,accent:'blue',theme:'clinical',params:{},state:{},time:0,progress:0};
  function validateOptions(input={}){
    if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Part options must be an object.');
    for(const key of Object.keys(input))if(!allowed.has(key))throw new Error('Unknown part option: '+key);
    const o={...defaults,...input,params:input.params===undefined?{}:input.params,state:input.state===undefined?{}:input.state};
    if(!Number.isFinite(o.x)||!Number.isFinite(o.y))throw new Error('x and y must be finite numbers.');
    if(!Number.isFinite(o.scale)||o.scale<=0||o.scale>8)throw new Error('scale must be between 0 and 8.');
    if(!Number.isFinite(o.rotation))throw new Error('rotation must be finite.');
    if(!Number.isFinite(o.opacity)||o.opacity<0||o.opacity>1)throw new Error('opacity must be between 0 and 1.');
    if(!Object.hasOwn(palette,o.accent))throw new Error('accent must be a palette key.');
    if(!['clinical','night'].includes(o.theme))throw new Error('theme must be clinical or night.');
    if(!Number.isFinite(o.time)||o.time<0)throw new Error('time must be a non-negative finite number.');
    if(!Number.isFinite(o.progress)||o.progress<0||o.progress>1)throw new Error('progress must be between 0 and 1.');
    if(!o.params||typeof o.params!=='object'||Array.isArray(o.params))throw new Error('params must be an object.');
    if(!o.state||typeof o.state!=='object'||Array.isArray(o.state))throw new Error('state must be an object.');
    return o;
  }
  const registry=new Map();
  function register(def){
    if(!def||!/^[a-z][a-z0-9-]+$/.test(def.id)||typeof def.render!=='function')throw new Error('Invalid part definition.');
    if(registry.has(def.id))throw new Error('Duplicate part: '+def.id);
    def.version=def.version||2;
    def.sources=def.sources||sourceMap[def.id]||[];
    def.source=def.sources;
    def.dependencies=Array.isArray(def.dependencies)?def.dependencies:[];
    def.attachments=def.attachments||{center:{x:320,y:220}};
    def.bounds=def.bounds||{x:0,y:0,width:640,height:440};
    def.parameterSchema=def.parameterSchema||{};
    def.stateSchema=def.stateSchema||{time:{type:'number',min:0},progress:{type:'number',min:0,max:1}};
    registry.set(def.id,def);
  }
  function validateParams(def,params){
    for(const key of Object.keys(params||{}))if(!Object.hasOwn(def.parameterSchema||{},key))throw new Error(def.id+'.'+key+' is not a declared parameter.');
    const p={...(def.defaults||{}),...(params||{})};
    for(const [key,s] of Object.entries(def.parameterSchema||{})){
      const v=p[key];
      if(s.type==='number' && (typeof v!=='number'||!Number.isFinite(v)||v<s.min||v>s.max))throw new Error(def.id+'.'+key+' must be between '+s.min+' and '+s.max+'.');
      if(s.type==='integer' && (!Number.isInteger(v)||v<s.min||v>s.max))throw new Error(def.id+'.'+key+' must be an integer between '+s.min+' and '+s.max+'.');
      if(s.type==='enum' && !s.values.includes(v))throw new Error(def.id+'.'+key+' must be one of '+s.values.join(', ')+'.');
      if(s.type==='boolean' && typeof v!=='boolean')throw new Error(def.id+'.'+key+' must be boolean.');
      if(s.type==='string' && (typeof v!=='string'||v.length>s.maxLength))throw new Error(def.id+'.'+key+' must be a string.');
      if(s.type==='polyline' && (!Array.isArray(v)||v.length<2||v.some(q=>!Array.isArray(q)||q.length!==2||q.some(n=>!Number.isFinite(n)))))throw new Error(def.id+'.'+key+' must be a numeric polyline.');
    }
    return p;
  }
  if(typeof G.MedicalMotionPartDefinitions!=='function')throw new Error('Medical Motion definitions are not loaded.');
  G.MedicalMotionPartDefinitions(register,{circle,ellipse,rect,line,path,move,arrow,text});

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
  function renderBatch(specs,expectedCount,context={}){
    if(!Array.isArray(specs)||!specs.length)throw new Error('renderBatch requires at least one part.');
    if(expectedCount!==undefined&&(!Number.isInteger(expectedCount)||expectedCount<1||specs.length!==expectedCount))throw new Error('Requested '+expectedCount+' parts but received '+specs.length+'.');
    return specs.map((spec,i)=>{
      if(!spec||typeof spec!=='object'||typeof spec.id!=='string')throw new Error('Batch item '+i+' must contain a part id.');
      return render(spec.id,spec.options||{},context);
    }).join('');
  }
  function renderBatchSVG(specs,expectedCount,context={}){
    const clean=Array.isArray(specs)?specs:[];
    const titles=clean.map(spec=>get(spec.id).title).join(', ');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 440" role="img" aria-label="'+escape('Medical parts: '+titles)+'" style="font-family:system-ui,-apple-system,Segoe UI,sans-serif">'+el('title',{},'Medical parts batch')+el('desc',{},escape(titles))+rect(0,0,640,440,palette.paper,0)+renderBatch(clean,expectedCount,context)+'</svg>';
  }
  function get(id){const d=registry.get(id);if(!d)throw new Error('Unknown partId: '+id);return d;}
  function render(id,options={},context={}){
    const d=get(id),o=validateOptions(options),o2={...o,params:validateParams(d,o.params)},C={...themes[o.theme],accent:themes[o.theme][o.accent]};
    const raw=String(d.render(o2,C,{...context,part:d,attachments:d.attachments,theme:o.theme}));
    // Accent is a real colour channel. Legacy definitions used red/blue directly, so map
    // those primary strokes to the requested accent while retaining neutral detail colours.
    const accent=o2.accent, painted=o.accent==='blue'?raw:raw.replaceAll(themes[o.theme].blue,accent).replaceAll(themes[o.theme].red,accent);
    return '<g data-part-id="'+escape(id)+'" data-part-version="'+d.version+'" data-accent="'+escape(o.accent)+'" transform="translate('+(o.x-320)+' '+(o.y-220)+') rotate('+o.rotation+' 320 220) translate(320 220) scale('+o.scale+') translate(-320 -220)" opacity="'+o.opacity+'">'+painted+'</g>';
  }
  function renderSVG(id,options={},context={}){
    const o=validateOptions(options),d=get(id),C=themes[o.theme];
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 440" role="img" aria-label="'+escape(d.title)+'" style="font-family:system-ui,-apple-system,Segoe UI,sans-serif">'+el('title',{},d.title)+el('desc',{},d.description+' '+d.limitations)+rect(0,0,640,440,C.paper,0)+render(id,o,context)+'</svg>';
  }
  function createRenderer(context={}){
    return {render:(id,options={})=>render(id,options,context),renderSVG:(id,options={})=>renderSVG(id,options,context),renderBatch:(specs,count)=>renderBatch(specs,count,context),renderBatchSVG:(specs,count)=>renderBatchSVG(specs,count,context),get,search};
  }
  function discovery(id){
    const d=get(id);
    return {id:d.id,version:d.version,title:d.title,description:d.description,sources:d.sources,limitations:d.limitations,dependencies:d.dependencies,attachments:d.attachments,bounds:d.bounds,parameterSchema:d.parameterSchema,stateSchema:d.stateSchema};
  }
  G.MedicalMotionParts=Object.freeze({
    version:'2.0.0',contractVersion:2,palette,register,get,
    list:()=>Array.from(registry.values(),meta),
    discover:discovery,search,validate:validateOptions,validateParams,render,renderSVG,renderBatch,renderBatchSVG,createRenderer
  });
})(globalThis);
