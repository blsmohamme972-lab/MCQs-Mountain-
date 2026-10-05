MedicalMotion.register({
  id:'enzyme-inhibition',category:'Biochemistry',title:'The active site has a competitor',
  description:'Animate substrate binding and competitive inhibitor occupancy of an enzyme active site.',
  caption:'A competitive inhibitor uses the active site, so substrate and inhibitor compete for the same opening.',
  keywords:["enzyme", "competitive inhibition", "active site", "substrate"],
  stages:["Show the active site", "Let molecules compete", "Compare binding outcomes"],
  limitations:'Conceptual teaching schematic only; quantitative physiology, timing and clinical inference are omitted.',
  sources:["https://openstax.org/books/biology-2e/pages/6-5-enzymes"],
  params:{"mode": "competitive", "progress": 0.6},parameterSchema:{"mode": {"type": "enum", "values": ["competitive", "allosteric"], "description": "Binding mode to illustrate."}, "progress": {"type": "number", "min": 0.1, "max": 1, "step": 0.05, "description": "Presentation progress through binding."}},
  labels:{"enzyme": "Enzyme", "site": "Active site", "substrate": "Substrate", "inhibitor": "Inhibitor"},
  render:function(c,p,t,S){const {C,path,circle,text,arrow,wrap}=S;let o='',q=c.params.progress,all=c.params.mode==='allosteric';o+=path('M 150 200 C 180 110 330 110 390 180 C 450 250 390 335 255 325 C 165 318 110 270 150 200 Z',C.blue,6,C.soft)+circle(282,168,28,C.paper,{stroke:C.red,'stroke-width':5})+text(282,174,c.labels.site,C.red,12,'middle',750)+text(268,380,c.labels.enzyme,C.ink,18,'middle',750);let sx=all?170:70+260*q,ix=all?420:570-260*q;o+=circle(sx,95,25,C.teal,{stroke:C.ink,'stroke-width':2})+text(sx,101,c.labels.substrate,C.ink,11,'middle',750)+circle(ix,95,25,C.gold,{stroke:C.ink,'stroke-width':2})+text(ix,101,c.labels.inhibitor,C.ink,11,'middle',750);o+=all?circle(394,230,23,C.gold,{stroke:C.ink,'stroke-width':2})+arrow(420,110,394,207,C.gold,4):arrow(sx,122,282,140,C.teal,4)+arrow(ix,122,282,140,C.gold,4);o+=wrap(320,430,all?'Allosteric site changes the enzyme shape':'Both molecules compete for one active site',C.muted,16,500,1,'middle');return o;}
});
