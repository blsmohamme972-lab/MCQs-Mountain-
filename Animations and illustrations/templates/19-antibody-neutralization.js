MedicalMotion.register({
  id:'antibody-neutralization',category:'Immunology',title:'An antibody recognizes a matching antigen',
  description:'Illustrate recognition and neutralization as reusable immune-system pieces.',
  caption:'A matching binding site can block a target or mark it for other immune mechanisms; one antibody is not the whole immune response.',
  keywords:['antibody','antigen','immunity','neutralization','B cell','immunology'],
  stages:['Find the antigen shape','Match the binding site','Show neutralization'],
  limitations:'Generic recognition model. Affinity, isotypes, complement and clinical protection are not quantified.',
  sources:['https://www.ncbi.nlm.nih.gov/books/NBK27144/','https://openstax.org/books/biology-2e/pages/43-2-adaptive-immune-response'],
  params:{binding:0.8},parameterSchema:{binding:{type:'number',min:0.25,max:1,step:0.05,description:'Visual match confidence; not an affinity constant.'}},
  labels:{antigen:'Antigen',antibody:'Antibody',binding:'Matching site',blocked:'Target blocked'},
  render:function(c,p,t,S){
    const {C,path,circle,rect,text,arrow,wrap}=S; let out='';
    const bind=c.params.binding*(.3+.7*p);
    out+=circle(500,112,38,C.red,{stroke:C.red,'stroke-width':3})+path('M 478 94 L 489 80 L 500 94 L 511 80 L 522 94',C.paper,5,'none')+text(500,180,c.labels.antigen,C.ink,18,'middle',750);
    const y=250, stem=170;
    out+=path('M '+stem+' '+(y+80)+' V '+y+' M '+stem+' '+y+' L '+(stem-48)+' '+(y-52)+' M '+stem+' '+y+' L '+(stem+48)+' '+(y-52),C.blue,12,'none',{opacity:.45+.55*bind});
    out+=path('M '+(stem-48)+' '+(y-52)+' L '+(stem-57)+' '+(y-72)+' M '+(stem+48)+' '+(y-52)+' L '+(stem+57)+' '+(y-72),C.blue,8);
    out+=text(stem,370,c.labels.antibody,C.ink,18,'middle',750);
    out+=arrow(225,250,430-70*(1-bind),140,C.teal,4)+circle(350,205,12,C.teal,{opacity:.35+.65*bind});
    out+=rect(398,235,175,72,C.soft,18,{stroke:C.teal,'stroke-width':3})+wrap(485,278,c.labels.binding,C.ink,18,155,1,'middle');
    out+=arrow(500,155,485,235,C.gold,3)+wrap(320,430,c.labels.blocked,C.gold,20,440,1,'middle');
    return out;
  }
});

