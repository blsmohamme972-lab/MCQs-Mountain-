MedicalMotion.register({
  id:'phagocytosis',category:'Cell biology',title:'A cell engulfs a large particle',
  description:'Show recognition, membrane wrapping and internalization during phagocytosis.',
  caption:'The membrane surrounds a large target, pinches off a vesicle, and keeps the cargo inside the cell.',
  keywords:["phagocytosis", "endocytosis", "engulfment", "immune cell"],
  stages:["Recognize target", "Wrap the membrane", "Internalize cargo"],
  limitations:'Conceptual teaching schematic only; quantitative physiology, timing and clinical inference are omitted.',
  sources:["https://openstax.org/books/biology-2e/pages/5-4-bulk-transport"],
  params:{"progress": 0.68},parameterSchema:{"progress": {"type": "number", "min": 0.1, "max": 1, "step": 0.05, "description": "Presentation progress through the engulfment sequence."}},
  labels:{"cell": "Phagocyte", "target": "Target particle", "vesicle": "Internal vesicle"},
  render:function(c,p,t,S){const {C,circle,path,rect,text,arrow,wrap}=S;let o='',q=c.params.progress,cx=320,cy=235,x=520-180*q,y=224;o+=circle(cx,cy,126,C.tissue,{stroke:C.red,'stroke-width':5})+circle(cx-34,cy+8,30,C.blue,{opacity:.85})+text(cx-34,cy+60,c.labels.cell,C.ink,18,'middle',750)+circle(x,y,32,C.gold,{stroke:C.ink,'stroke-width':3})+text(x,y+6,c.labels.target,C.ink,13,'middle',750);o+=path('M 197 235 C 210 '+(150-40*q)+' '+(x-34)+' '+(y-44)+' '+(x-44)+' '+(y-44)+' C '+(x+78)+' '+(y-62)+' 442 '+(150-40*q)+' 443 235 C 442 '+(320+40*q)+' '+(x+78)+' '+(y+44)+' '+(x+44)+' '+(y+44),C.teal,8,'none',{opacity:.88})+arrow(177,95,220,125,C.teal,4)+wrap(320,82,c.labels.target,C.gold,18,220,1,'middle')+rect(150,365,340,48,C.paper,18,{stroke:C.line,'stroke-width':2})+wrap(320,395,c.labels.vesicle,C.muted,18,300,1,'middle');return o;}
});
