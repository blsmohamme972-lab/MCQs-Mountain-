MedicalMotion.register({
  id:'venous-valves',category:'Circulation',title:'Valves keep venous flow one-way',
  description:'Show a venous valve opening toward the heart and closing against backflow.',
  caption:'Low-pressure veins use valves and muscle compression to support one-way return toward the heart.',
  keywords:["vein", "venous valve", "backflow", "circulation"],
  stages:["Open toward the heart", "Close against backflow", "Keep one-way flow"],
  limitations:'Conceptual teaching schematic only; quantitative physiology, timing and clinical inference are omitted.',
  sources:["https://openstax.org/books/anatomy-and-physiology-2e/pages/20-1-structure-and-function-of-blood-vessels"],
  params:{"progress": 0.65},parameterSchema:{"progress": {"type": "number", "min": 0.1, "max": 1, "step": 0.05, "description": "Blend between open and closed valve positions."}},
  labels:{"vein": "Vein", "valve": "Venous valve", "heart": "Toward heart", "backflow": "Backflow blocked"},
  render:function(c,p,t,S){const {C,rect,path,circle,text,arrow,flow,wrap}=S;let o='',q=c.params.progress,g=70-48*q;o+=rect(220,48,200,344,C.tissue,52,{stroke:C.red,'stroke-width':5})+path('M 225 204 Q 292 '+(204-g)+' 320 244 Q 348 '+(204-g)+' 415 204',C.blue,10,'none')+path('M 225 204 Q 292 '+(204+g)+' 320 164 Q 348 '+(204+g)+' 415 204',C.blue,10,'none')+circle(320,204,11,C.paper,{stroke:C.ink,'stroke-width':3})+arrow(320,350,320,280,C.teal,5)+flow([[320,350],[320,280]],q,C.teal,5,6)+arrow(320,120,320,55,C.gold,4)+text(320,30,c.labels.heart,C.gold,18,'middle',750)+wrap(320,425,q<.5?c.labels.backflow:c.labels.valve,C.ink,17,350,1,'middle');return o;}
});
