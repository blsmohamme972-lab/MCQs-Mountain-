MedicalMotion.register({
  id:'peristalsis',category:'Gastrointestinal physiology',title:'A wave moves the bolus forward',
  description:'Animate alternating contraction and relaxation around a digestive tube.',
  caption:'Sequential smooth-muscle waves propel the bolus forward while the tube behind it relaxes.',
  keywords:["peristalsis", "esophagus", "bolus", "smooth muscle"],
  stages:["Place the bolus", "Contract behind it", "Propel it forward"],
  limitations:'Conceptual teaching schematic only; quantitative physiology, timing and clinical inference are omitted.',
  sources:["https://openstax.org/books/anatomy-and-physiology-2e/pages/23-2-digestive-system-processes-and-regulation"],
  params:{"speed": 1},parameterSchema:{"speed": {"type": "number", "min": 0.25, "max": 2, "step": 0.25, "description": "Visual wave speed multiplier."}},
  labels:{"tube": "Digestive tube", "bolus": "Bolus", "wave": "Contraction wave"},
  render:function(c,p,t,S){const {C,path,circle,text,arrow}=S;let o='',q=(c.params.speed*p)%1,b=115+390*q;o+=path('M 70 135 C 180 125 460 125 570 135',C.tissue,42,'none',{stroke:C.red,'stroke-width':5})+path('M 70 305 C 180 315 460 315 570 305',C.tissue,42,'none',{stroke:C.red,'stroke-width':5});for(let i=0;i<5;i++){let x=b-100+i*42;o+=path('M '+x+' 108 C '+x+' 140 '+x+' 170 '+x+' 198',C.gold,12,'none',{opacity:.85*(1-Math.abs(i-2)/4)})+path('M '+x+' 242 C '+x+' 270 '+x+' 300 '+x+' 332',C.gold,12,'none',{opacity:.85*(1-Math.abs(i-2)/4)})}o+=circle(b,220,28,C.teal,{stroke:C.ink,'stroke-width':3})+text(b,226,c.labels.bolus,C.paper,12,'middle',750)+arrow(120,390,520,390,C.teal,4)+text(320,425,c.labels.wave,C.muted,17,'middle',750)+text(320,65,c.labels.tube,C.ink,18,'middle',750);return o;}
});
