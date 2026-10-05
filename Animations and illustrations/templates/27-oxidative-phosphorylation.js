MedicalMotion.register({
  id:'oxidative-phosphorylation',category:'Cell metabolism',title:'A proton gradient powers ATP synthase',
  description:'Show protons moving through ATP synthase to drive ATP formation across the inner mitochondrial membrane.',
  caption:'Electron transport builds a proton gradient; ATP synthase uses proton flow to join ADP and phosphate.',
  keywords:["mitochondria", "proton gradient", "ATP synthase", "oxidative phosphorylation"],
  stages:["Build the gradient", "Let protons flow", "Form ATP"],
  limitations:'Conceptual teaching schematic only; quantitative physiology, timing and clinical inference are omitted.',
  sources:["https://openstax.org/books/biology-2e/pages/7-4-oxidative-phosphorylation"],
  params:{"progress": 0.68},parameterSchema:{"progress": {"type": "number", "min": 0.1, "max": 1, "step": 0.05, "description": "Visual proton flow and ATP formation progress."}},
  labels:{"space": "Intermembrane space", "membrane": "Inner membrane", "matrix": "Matrix", "machine": "ATP synthase"},
  render:function(c,p,t,S){const {C,rect,circle,text,arrow,flow}=S;let o='',q=c.params.progress;o+=rect(48,48,544,112,C.tissue,18)+rect(48,280,544,112,C.soft,18)+rect(48,160,544,120,C.paper,0,{stroke:C.line,'stroke-width':3})+text(320,90,c.labels.space,C.ink,18,'middle',750)+text(320,355,c.labels.matrix,C.ink,18,'middle',750)+text(320,220,c.labels.membrane,C.muted,16,'middle',750)+rect(275,165,90,110,C.blue,30)+text(320,224,c.labels.machine,C.paper,14,'middle',750);for(let i=0;i<10;i++){let x=90+(i%5)*92,y=112+Math.floor(i/5)*28;o+=circle(x,y,7,C.gold)}o+=arrow(200,145,285,208,C.gold,4)+arrow(355,208,440,300,C.teal,4)+flow([[200,145],[285,208],[355,208],[440,300]],q,C.gold,6,6)+text(320,420,'H⁺ flow → ADP + Pi → ATP',C.teal,18,'middle',750);return o;}
});
