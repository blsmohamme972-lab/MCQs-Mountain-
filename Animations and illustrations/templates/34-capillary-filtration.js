MedicalMotion.register({
  id:'capillary-filtration',category:'Microcirculation',title:'Filtration and reabsorption balance fluid',
  description:'Show fluid leaving a capillary at one end and returning at the other, with tissue fluid between.',
  caption:'Capillary exchange reflects opposing hydrostatic and oncotic forces; this schematic shows direction only.',
  keywords:["capillary", "filtration", "reabsorption", "interstitial fluid"],
  stages:["Enter the capillary bed", "Filter outward", "Reabsorb inward"],
  limitations:'Conceptual teaching schematic only; quantitative physiology, timing and clinical inference are omitted.',
  sources:["https://openstax.org/books/anatomy-and-physiology-2e/pages/20-1-structure-and-function-of-blood-vessels"],
  params:{"progress": 0.62},parameterSchema:{"progress": {"type": "number", "min": 0.1, "max": 1, "step": 0.05, "description": "Visual flow from filtration toward reabsorption."}},
  labels:{"arterial": "Arterial end", "capillary": "Capillary", "venous": "Venous end", "tissue": "Interstitial space"},
  render:function(c,p,t,S){const {C,path,circle,rect,text,arrow,flow}=S;let o='',q=c.params.progress;o+=path('M 90 170 C 220 115 420 115 550 170',C.red,22,'none',{opacity:.32})+path('M 90 170 C 220 115 420 115 550 170',C.red,7,'none')+text(100,90,c.labels.arterial,C.red,16,'middle',750)+text(540,90,c.labels.venous,C.blue,16,'middle',750)+rect(130,240,380,100,C.tissue,35,{stroke:C.red,'stroke-width':3})+text(320,298,c.labels.tissue,C.ink,18,'middle',750)+arrow(170,183,170,245,C.gold,4)+flow([[170,183],[170,245]],q,C.gold,5,5)+arrow(470,245,470,183,C.teal,4)+flow([[470,245],[470,183]],q,C.teal,5,5)+text(320,400,c.labels.capillary,C.ink,18,'middle',750);return o;}
});
