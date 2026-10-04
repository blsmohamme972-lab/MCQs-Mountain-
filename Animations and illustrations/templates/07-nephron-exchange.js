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
    let out=circle(132,135,70,C.soft,{stroke:C.blue,'stroke-width':4});
    out+=path('M 25 98 H 102 C 75 165 180 175 160 105 C 140 65 100 160 154 156 C 191 151 164 80 132 109 C 100 148 190 127 188 100 H 605 V 359 H 260',C.red,12);
    out+=path('M 132 207 V 258 H 585',C.gold,29)+path('M 132 207 V 258 H 585',C.paper,18);
    out+=arrow(132,176,132,241,C.teal,4)+flow([[132,178],[132,240]],p*c.params.speed,C.teal,3,5);
    out+=arrow(338,280,338,344,C.teal,4)+flow([[338,280],[338,343]],p*c.params.speed,C.teal,3,5);
    out+=arrow(473,343,473,280,C.blue,4)+flow([[473,343],[473,280]],p*c.params.speed,C.blue,3,5);
    out+=wrap(134,36,'Glomerulus',C.ink,23,245,1,'middle')+wrap(74,307,c.labels.filter,C.teal,19,144,2,'middle');
    out+=wrap(420,211,c.labels.tubule,C.ink,24,340,1,'middle')+wrap(439,406,c.labels.blood,C.red,22,360,1,'middle');
    out+=wrap(259,322,c.labels.reabsorb,C.teal,16,132,1,'middle')+wrap(537,322,c.labels.secrete,C.blue,16,112,1,'middle');
    out+=arrow(550,258,603,258,C.gold,3)+text(545,293,'Toward urine',C.muted,16);
    return out;
  }
});
