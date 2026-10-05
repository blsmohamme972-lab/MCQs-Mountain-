MedicalMotion.register({
  id:'fracture-repair',category:'Skeletal tissue',title:'A fracture passes through repair stages',
  description:'Show a simplified fracture gap progressing from hematoma to callus and remodeled bone.',
  caption:'Fracture repair progresses through hematoma, callus formation, bony union and remodeling.',
  keywords:["fracture", "bone repair", "hematoma", "callus", "remodeling"],
  stages:["Mark the fracture", "Build a callus", "Remodel the union"],
  limitations:'Conceptual teaching schematic only; quantitative physiology, timing and clinical inference are omitted.',
  sources:["https://openstax.org/books/anatomy-and-physiology-2e/pages/6-5-fractures-bone-repair"],
  params:{"progress": 0.65},parameterSchema:{"progress": {"type": "number", "min": 0.1, "max": 1, "step": 0.05, "description": "Progression through the repair sequence."}},
  labels:{"fracture": "Fracture gap", "hematoma": "Hematoma", "callus": "Callus", "union": "Remodeled union"},
  render:function(c,p,t,S){const {C,rect,path,text,arrow}=S;let o='',q=c.params.progress,g=42-35*q;o+=rect(70,155,210,150,C.soft,22,{stroke:C.line,'stroke-width':3})+rect(360,155,210,150,C.soft,22,{stroke:C.line,'stroke-width':3})+path('M 280 155 L '+(280+g)+' 305',C.red,8,'none')+path('M 360 155 L '+(360-g)+' 305',C.red,8,'none')+text(320,125,c.labels.fracture,C.red,18,'middle',750)+path('M 280 230 Q 320 '+(180-55*q)+' 360 230',C.gold,28,'none',{opacity:.85})+text(320,375,q<.33?c.labels.hematoma:q<.72?c.labels.callus:c.labels.union,C.ink,20,'middle',750)+arrow(100,420,540,420,C.teal,4);return o;}
});
