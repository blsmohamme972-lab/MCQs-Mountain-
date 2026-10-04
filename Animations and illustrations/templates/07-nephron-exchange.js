MedicalMotion.register({
  id:'nephron-exchange',category:'Renal physiology',title:'Filter. Reclaim. Secrete.',
  description:'Separate glomerular filtration from two-way tubular exchange.',
  caption:'Filtration enters the tubule. Reabsorption returns material to blood. Secretion moves material from blood into the tubule.',
  keywords:['kidney','nephron','filtration','reabsorption','secretion','renal'],
  stages:['Find blood and tubule','Trace three directions','Distinguish the processes'],
  limitations:'Functional schematic, not complete nephron anatomy. Tubular segments, selectivity, concentrations and filtration rates are omitted. Cells and large proteins are not depicted crossing the filter.',
  sources:['https://www.niddk.nih.gov/health-information/kidney-disease/kidneys-how-they-work','https://openstax.org/books/anatomy-and-physiology-2e/pages/25-5-physiology-of-urine-formation'],
  params:{speed:1},parameterSchema:{speed:{type:'number',min:0.25,max:2,step:0.25,description:'Exchange-particle animation multiplier; not GFR.'}},
  labels:{filter:'Filtration',tubule:'Tubule / filtrate',blood:'Peritubular blood',reabsorb:'Reabsorption',secrete:'Secretion'},
  render:function(c,p,t,S){
    const {C,circle,path,line,rect,arrow,flow,wrap,text}=S;
    let out='';
    // A capillary tuft sits inside Bowman's capsule; the tubule leaves as a continuous loop.
    out+=circle(126,132,73,C.soft,{stroke:C.blue,'stroke-width':4});
    out+=path('M 62 126 C 82 82 112 164 132 116 S 182 81 176 133 S 112 187 92 135 S 145 91 166 151',C.red,10,'none',{opacity:.88});
    out+=path('M 54 161 C 82 193 132 206 178 169',C.gold,4,'none',{opacity:.8});
    out+=path('M 188 132 C 228 110 267 105 298 128 C 335 157 311 194 274 212 C 239 229 247 270 286 277 C 326 284 348 248 373 270 C 399 293 374 335 342 347 C 300 363 246 346 227 315',C.gold,24,'none');
    out+=path('M 188 132 C 228 110 267 105 298 128 C 335 157 311 194 274 212 C 239 229 247 270 286 277 C 326 284 348 248 373 270 C 399 293 374 335 342 347 C 300 363 246 346 227 315',C.paper,13,'none');
    out+=path('M 212 88 C 265 54 338 66 395 108 C 451 150 514 130 590 98',C.red,9,'none',{opacity:.65});
    out+=path('M 212 88 C 265 54 338 66 395 108 C 451 150 514 130 590 98',C.blue,3,'none');
    out+=arrow(176,132,210,132,C.teal,4)+flow([[176,132],[210,132]],p*c.params.speed,C.teal,3,5);
    out+=arrow(322,210,290,266,C.teal,4)+flow([[322,210],[290,266]],p*c.params.speed,C.teal,3,5);
    out+=arrow(350,343,314,348,C.blue,4)+flow([[350,343],[314,348]],p*c.params.speed,C.blue,3,5);
    out+=wrap(126,34,'Glomerulus',C.ink,21,200,1,'middle')+wrap(55,285,c.labels.filter,C.teal,17,110,2,'middle');
    out+=wrap(434,211,c.labels.tubule,C.ink,21,260,1,'middle')+wrap(442,407,c.labels.blood,C.red,20,330,1,'middle');
    out+=wrap(268,226,c.labels.reabsorb,C.teal,15,126,1,'middle')+wrap(500,152,c.labels.secrete,C.blue,15,120,1,'middle');
    out+=arrow(518,95,590,95,C.red,3)+text(548,78,'blood in/out',C.muted,14,'middle');
    return out;
  }
});
