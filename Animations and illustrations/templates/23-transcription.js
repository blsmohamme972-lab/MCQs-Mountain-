MedicalMotion.register({
  id:'transcription',category:'Molecular biology',title:'DNA information becomes RNA',
  description:'Animate a transcription bubble and an RNA strand growing 5′→3′ from a DNA template.',
  caption:'RNA polymerase reads the template while the new RNA extends in the 5′→3′ direction.',
  keywords:["transcription", "mRNA", "RNA polymerase", "gene expression"],
  stages:["Open a transcription bubble", "Read the template", "Extend RNA 5\u2032\u21923\u2032"],
  limitations:'Conceptual teaching schematic only; quantitative physiology, timing and clinical inference are omitted.',
  sources:["https://openstax.org/books/biology-2e/pages/15-2-prokaryotic-transcription"],
  params:{"progress": 0.6},parameterSchema:{"progress": {"type": "number", "min": 0.1, "max": 1, "step": 0.05, "description": "Visual movement of the transcription bubble and RNA."}},
  labels:{"template": "DNA template", "polymerase": "RNA polymerase", "rna": "New RNA 5\u2032\u21923\u2032"},
  render:function(c,p,t,S){const {C,path,circle,text,arrow,flow,wrap}=S;let o='',q=c.params.progress,b=130+350*q;o+=path('M 90 145 C 210 110 300 180 550 145',C.blue,7,'none')+path('M 90 230 C 210 265 300 195 550 230',C.blue,7,'none')+path('M '+(b-70)+' 159 C '+(b-25)+' 125 '+(b+25)+' 125 '+(b+70)+' 159',C.paper,28,'none')+circle(b,194,24,C.gold,{stroke:C.ink,'stroke-width':3})+text(b,200,c.labels.polymerase,C.ink,12,'middle',750)+path('M '+(b-24)+' 210 C '+(b+4)+' 245 '+(b+40)+' 256 '+(b+72)+' 276',C.teal,7,'none')+flow([[b-20,212],[b+72,276]],q,C.teal,5,5)+arrow(b+52,276,b+140,276,C.teal,4)+text(320,78,c.labels.template,C.ink,18,'middle',750)+text(320,332,c.labels.rna,C.teal,19,'middle',750)+wrap(320,405,'Template read 3′→5′  |  RNA extends 5′→3′',C.muted,16,500,1,'middle');return o;}
});
