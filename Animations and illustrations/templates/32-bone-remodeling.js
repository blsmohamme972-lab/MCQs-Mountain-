MedicalMotion.register({
  id:'bone-remodeling',category:'Skeletal tissue',title:'Old bone out; new bone in',
  description:'Animate osteoclast resorption followed by osteoblast deposition on the same bone surface.',
  caption:'Adult remodeling couples removal of old or damaged matrix with deposition of new matrix.',
  keywords:["bone", "remodeling", "osteoclast", "osteoblast"],
  stages:["Expose old matrix", "Resorb a surface", "Deposit new matrix"],
  limitations:'Conceptual teaching schematic only; quantitative physiology, timing and clinical inference are omitted.',
  sources:["https://openstax.org/books/anatomy-and-physiology-2e/pages/6-4-bone-formation-and-development"],
  params:{"progress": 0.65},parameterSchema:{"progress": {"type": "number", "min": 0.1, "max": 1, "step": 0.05, "description": "Relative position of resorption and deposition."}},
  labels:{"old": "Old bone matrix", "resorb": "Osteoclast resorption", "new": "New bone matrix", "build": "Osteoblast deposition"},
  render:function(c,p,t,S){const {C,rect,path,circle,text,arrow,wrap}=S;let o='',q=c.params.progress;o+=rect(70,235,500,115,C.soft,28,{stroke:C.line,'stroke-width':3})+path('M 70 235 Q 140 '+(175+35*q)+' 210 235 T 350 235 T 490 235 T 570 235',C.tissue,42,'none',{stroke:C.red,'stroke-width':5})+text(320,320,c.labels.old,C.muted,17,'middle',750);let rx=180+190*q,bx=430-140*q;o+=circle(rx,183,34,C.red)+text(rx,189,'OC',C.paper,16,'middle',800)+circle(bx,183,30,C.teal)+text(bx,189,'OB',C.paper,16,'middle',800)+arrow(160,95,rx,145,C.red,4)+text(160,70,c.labels.resorb,C.red,14,'middle',750)+arrow(480,95,bx,145,C.teal,4)+text(480,70,c.labels.build,C.teal,14,'middle',750)+wrap(320,410,c.labels.new,C.teal,18,380,1,'middle');return o;}
});
