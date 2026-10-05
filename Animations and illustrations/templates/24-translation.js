MedicalMotion.register({
  id:'translation',category:'Molecular biology',title:'Ribosome builds a polypeptide',
  description:'Show a ribosome moving along mRNA while amino acids join into a growing chain.',
  caption:'The ribosome reads mRNA 5′→3′ and links amino acids into a polypeptide.',
  keywords:["translation", "ribosome", "mRNA", "protein synthesis"],
  stages:["Find the start codon", "Read the mRNA", "Extend the chain"],
  limitations:'Conceptual teaching schematic only; quantitative physiology, timing and clinical inference are omitted.',
  sources:["https://openstax.org/books/biology-2e/pages/15-5-ribosomes-and-protein-synthesis"],
  params:{"progress": 0.65},parameterSchema:{"progress": {"type": "number", "min": 0.1, "max": 1, "step": 0.05, "description": "Ribosome position and chain length."}},
  labels:{"mrna": "mRNA 5\u2032\u21923\u2032", "ribosome": "Ribosome", "protein": "Growing polypeptide"},
  render:function(c,p,t,S){const {C,path,rect,circle,text,arrow,wrap}=S;let o='',q=c.params.progress,x=120+380*q;o+=path('M 80 265 C 170 248 260 282 560 265',C.teal,12,'none');for(let i=0;i<9;i++){let xx=105+i*55;o+=rect(xx-15,250,31,28,i==3?C.gold:C.soft,7,{stroke:C.line,'stroke-width':2})+text(xx,270,i==3?'AUG':'•',C.ink,15,'middle',750)}o+=rect(x-67,145,134,82,C.paper,28,{stroke:C.blue,'stroke-width':5})+text(x,185,c.labels.ribosome,C.ink,16,'middle',750);for(let i=0;i<Math.max(1,Math.round(1+6*q));i++){let a=i*.46,xx=x+50+Math.cos(a)*22,yy=105+Math.sin(a)*22;o+=circle(xx,yy,12,C.gold,{stroke:C.ink,'stroke-width':2})}o+=path('M '+(x+38)+' 145 C '+(x+70)+' 115 '+(x+80)+' 95 '+(x+60)+' 75',C.gold,6,'none')+arrow(100,335,500,335,C.teal,4)+text(320,381,c.labels.mrna,C.ink,18,'middle',750)+wrap(320,425,c.labels.protein,C.gold,18,390,1,'middle');return o;}
});
