MedicalMotion.register({
  id:'acid-base-buffer',category:'Physiology',title:'The bicarbonate buffer links CO2 and pH',
  description:'Show the reversible carbonic-acid and bicarbonate relationships.',
  caption:'CO2 and water form carbonic acid, which can dissociate into hydrogen and bicarbonate; direction depends on the system state.',
  keywords:['acid-base','bicarbonate','carbon dioxide','pH','buffer','physiology'],
  stages:['Start with CO2 and water','Follow the reversible buffer','Interpret direction carefully'],
  limitations:'Qualitative chemistry only. No blood-gas values, compensation formula or patient interpretation is provided.',
  sources:['https://www.ncbi.nlm.nih.gov/books/NBK507807/','https://openstax.org/books/anatomy-and-physiology-2e/pages/26-4-acid-base-balance'],
  params:{state:'normal'},parameterSchema:{state:{type:'enum',values:['normal','increased CO2','decreased CO2'],description:'Choose a qualitative presentation state.'}},
  labels:{co2:'CO₂',water:'H₂O',acid:'H₂CO₃',hydrogen:'H⁺',bicarb:'HCO₃⁻',lung:'Lung link'},
  render:function(c,p,t,S){
    const {C,rect,circle,arrow,text,wrap}=S; let out='';
    const drift=Math.sin(Math.PI*p)*18, vals=[[95+drift,c.labels.co2,C.blue],[205+drift/2,c.labels.water,C.blue],[320,c.labels.acid,C.teal],[455-drift/2,c.labels.hydrogen,C.red],[555-drift,c.labels.bicarb,C.gold]];
    vals.forEach(([x,label,col])=>{out+=circle(x,205,42,C.soft,{stroke:col,'stroke-width':3})+text(x,211,label,C.ink,22,'middle',750);});
    out+=text(150,135,'+',C.muted,25,'middle',700)+text(390,135,'⇌',C.teal,26,'middle',700)+text(510,135,'+',C.muted,25,'middle',700);
    out+=arrow(138+drift,205,162+drift,205,C.blue,3)+arrow(247+drift/2,205,278+drift/2,205,C.teal,3)+arrow(362-drift/2,205,410-drift/2,205,C.red,3)+arrow(492-drift,205,512-drift,205,C.gold,3);
    out+=rect(190,310,260,64,C.paper,20,{stroke:C.line,'stroke-width':2})+wrap(320,350,c.labels.lung,C.ink,18,230,1,'middle');
    const dir=c.params.state==='increased CO2'?'More CO₂ shifts the balance rightward.':c.params.state==='decreased CO2'?'Less CO₂ shifts the balance leftward.':'The buffer is shown near a balanced state.';
    out+=wrap(320,420,dir,C.muted,16,500,2,'middle');
    return out;
  }
});

