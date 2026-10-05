MedicalMotion.register({
  id:'second-messenger',category:'Cell signaling',title:'A receptor relays a signal inside the cell',
  description:'Animate ligand binding, receptor activation, second messenger spread and an intracellular response.',
  caption:'An extracellular ligand can trigger an intracellular second-messenger cascade without entering the cell.',
  keywords:["cell signaling", "receptor", "second messenger", "cAMP"],
  stages:["Bind the ligand", "Relay the signal", "Amplify the response"],
  limitations:'Conceptual teaching schematic only; quantitative physiology, timing and clinical inference are omitted.',
  sources:["https://openstax.org/books/anatomy-and-physiology-2e/pages/18-1-how-hormones-work"],
  params:{"progress": 0.65},parameterSchema:{"progress": {"type": "number", "min": 0.1, "max": 1, "step": 0.05, "description": "Visual signal relay and amplification progress."}},
  labels:{"ligand": "Ligand", "receptor": "Receptor", "messenger": "Second messenger", "response": "Cell response"},
  render:function(c,p,t,S){const {C,rect,circle,path,text,arrow}=S;let o='',q=c.params.progress;o+=rect(45,70,550,100,C.tissue,24,{stroke:C.red,'stroke-width':3})+rect(45,170,550,235,C.soft,24,{stroke:C.line,'stroke-width':3})+text(320,112,'Extracellular space',C.muted,16,'middle',750)+text(320,220,'Inside the cell',C.muted,16,'middle',750)+rect(260,142,120,34,C.blue,15)+text(320,164,c.labels.receptor,C.paper,14,'middle',750)+circle(190,115,24,C.gold,{stroke:C.ink,'stroke-width':2})+text(190,121,c.labels.ligand,C.ink,11,'middle',750)+arrow(214,115,260,150,C.gold,4);let n=2+Math.round(8*q);for(let i=0;i<n;i++){let x=180+(i%4)*78,y=275+Math.floor(i/4)*58;o+=circle(x,y,10,C.teal,{opacity:.85})}o+=path('M 320 176 C 320 210 255 235 220 270',C.teal,4,'none')+arrow(410,315,505,315,C.teal,4)+text(320,390,c.labels.messenger,C.teal,17,'middle',750)+text(530,350,c.labels.response,C.gold,15,'middle',750);return o;}
});
