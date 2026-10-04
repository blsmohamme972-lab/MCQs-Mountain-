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
    const {C,path,rect,text,circle,arrow,flow,wrap}=S; let out='';
    out+=circle(320,112,92,C.soft,{stroke:C.blue,'stroke-width':6});
    out+=wrap(320,105,c.labels.air,C.ink,24,150,2,'middle');
    out+=path('M 92 224 Q 320 238 548 224',C.teal,6);
    out+=wrap(320,265,c.labels.barrier,C.teal,17,430,1,'middle');
    out+=rect(70,300,500,105,C.tissue,34,{stroke:C.red,'stroke-width':5});
    out+=wrap(320,342,c.labels.blood,C.ink,22,390,1,'middle');
    out+=arrow(238,284,238,330,C.teal,4)+arrow(402,330,402,284,C.gold,4);
    out+=text(198,286,'O₂',C.teal,22,'middle',750)+text(445,286,'CO₂',C.gold,22,'middle',750);
    out+=flow([[238,282],[238,330]],(p*c.params.speed)%1,C.teal,4,6);
    out+=flow([[402,330],[402,282]],(p*c.params.speed)%1,C.gold,4,6);
    for(let i=0;i<7;i++){const x=105+430*((p*.35+i/7)%1);out+=S.el('ellipse',{cx:x,cy:378,rx:16,ry:9,fill:C.red,opacity:.8});}
    out+=text(320,438,'O₂: alveolus → blood   |   CO₂: blood → alveolus',C.muted,15,'middle',650);
    return out;
  }
});
