MedicalMotion.register({
  id:'alveolar-exchange',category:'Respiration',title:'Two gases. Opposite directions.',
  description:'See oxygen and carbon dioxide cross the alveolar-capillary interface.',
  caption:'Oxygen moves from alveolar air into blood; carbon dioxide moves from blood into alveolar air.',
  keywords:['lung','alveolus','gas exchange','oxygen','carbon dioxide'],
  stages:['Find air and blood','Follow both gases','Remember the directions'],
  limitations:'Flattened interface with exaggerated thickness. No diffusion-rate, partial-pressure or ventilation-perfusion calculation.',
  sources:['https://www.nhlbi.nih.gov/health/lungs/respiratory-system'],
  params:{speed:1},parameterSchema:{speed:{type:'number',min:0.25,max:2,step:0.25,description:'Visual gas-motion multiplier.'}},
  labels:{air:'Alveolar air',blood:'Capillary blood',barrier:'Thin exchange interface'},
  render:function(c,p,t,S){
    const {C,path,rect,text,circle,arrow,flow,wrap}=S;
    let out=path('M 275 45 V 88 C 155 78 90 165 120 238 Q 320 286 520 238 C 550 165 485 78 365 88 V 45',C.blue,7,C.soft);
    out+=wrap(320,147,c.labels.air,C.ink,26,390,2,'middle');
    out+=rect(70,300,500,96,C.tissue,36)+path('M 72 298 Q 320 313 568 298',C.red,6);
    out+=path('M 135 263 Q 320 287 505 263',C.teal,5)+wrap(320,430,c.labels.blood,C.ink,23,450,1,'middle');
    out+=arrow(240,192,240,348,C.teal)+arrow(403,347,403,191,C.gold);
    out+=text(203,211,'O2',C.teal,24)+text(449,233,'CO2',C.gold,24);
    out+=flow([[240,190],[240,350]],p*c.params.speed,C.teal,4,6)+flow([[403,350],[403,190]],p*c.params.speed,C.gold,4,6);
    for(let i=0;i<7;i++){const x=100+440*((p*.4+i/7)%1);out+=S.el('ellipse',{cx:x,cy:365,rx:16,ry:9,fill:C.red,opacity:.8});}
    out+=wrap(320,31,c.labels.barrier,C.muted,18,550,1,'middle');
    return out;
  }
});
