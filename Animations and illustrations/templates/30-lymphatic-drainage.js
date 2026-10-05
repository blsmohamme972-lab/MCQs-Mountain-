MedicalMotion.register({
  id:'lymphatic-drainage',category:'Lymphatic system',title:'Lymph returns tissue fluid to blood',
  description:'Show interstitial fluid entering lymphatic capillaries, traveling through a vessel, and returning near a vein.',
  caption:'Lymphatic vessels collect excess tissue fluid and return it to the venous circulation.',
  keywords:["lymph", "lymphatic drainage", "thoracic duct", "tissue fluid"],
  stages:["Collect tissue fluid", "Move through lymphatics", "Return to venous blood"],
  limitations:'Conceptual teaching schematic only; quantitative physiology, timing and clinical inference are omitted.',
  sources:["https://openstax.org/books/anatomy-and-physiology-2e/pages/21-1-anatomy-of-the-lymphatic-and-immune-systems"],
  params:{"progress": 0.68},parameterSchema:{"progress": {"type": "number", "min": 0.1, "max": 1, "step": 0.05, "description": "Visual movement of lymph toward venous return."}},
  labels:{"tissue": "Tissue space", "vessel": "Lymphatic vessel", "vein": "Venous return"},
  render:function(c,p,t,S){const {C,path,circle,text,arrow,flow,wrap}=S;let o='',q=c.params.progress;o+=circle(155,120,62,C.tissue,{stroke:C.red,'stroke-width':4})+circle(155,120,22,C.paper,{stroke:C.red,'stroke-width':3})+text(155,120,c.labels.tissue,C.ink,15,'middle',750)+path('M 210 150 C 270 200 290 270 360 295 S 470 280 520 205',C.teal,16,'none',{opacity:.28})+path('M 210 150 C 270 200 290 270 360 295 S 470 280 520 205',C.teal,5,'none')+flow([[210,150],[270,200],[360,295],[520,205]],q,C.teal,7,6)+circle(540,170,56,C.blue,{opacity:.25,stroke:C.blue,'stroke-width':4})+text(540,175,c.labels.vein,C.ink,15,'middle',750)+arrow(198,135,232,169,C.teal,4)+arrow(492,225,515,192,C.teal,4)+text(320,55,c.labels.vessel,C.teal,19,'middle',750)+wrap(320,410,'Excess interstitial fluid → lymph → venous return',C.muted,16,500,1,'middle');return o;}
});
