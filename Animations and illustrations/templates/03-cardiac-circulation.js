MedicalMotion.register({
  id:'cardiac-circulation',category:'Cardiology',title:'One circuit. Two pumps.',
  description:'Trace the order of chambers, lungs and systemic tissues.',
  caption:'Body to right heart to lungs; lungs to left heart to body. Artery and vein names describe direction, not oxygen content.',
  keywords:['heart','circulation','atrium','ventricle','pulmonary','systemic'],
  stages:['Identify the chambers','Trace both circuits','Connect lungs and body'],
  limitations:'Flow-network diagram, not anatomical placement. Valves and coronary circulation are omitted. Blue is a low-oxygen convention; blood is not blue.',
  sources:['https://www.nhlbi.nih.gov/health/heart/blood-flow'],
  params:{speed:1},parameterSchema:{speed:{type:'number',min:0.25,max:2,step:0.25,description:'Circuit animation multiplier, not cardiac output.'}},
  labels:{ra:'Right atrium',rv:'Right ventricle',la:'Left atrium',lv:'Left ventricle',lungs:'Lungs',body:'Body tissues'},
  render:function(c,p,t,S){
    const {C,path,rect,wrap,flow,text,arrow}=S;
    const blue=[[290,390],[40,390],[40,180],[140,180],[140,300],[240,300],[240,60],[280,60]];
    const red=[[360,60],[500,60],[500,180],[500,300],[600,300],[600,390],[360,390]];
    let out=path('M '+blue.map(q=>q.join(' ')).join(' L '),C.blue,12)+path('M '+red.map(q=>q.join(' ')).join(' L '),C.red,12);
    out+=flow(blue,p*c.params.speed,C.paper,8,5)+flow(red,p*c.params.speed,C.paper,8,5);
    for(const [key,x,y,col] of [['ra',140,180,C.blue],['rv',140,300,C.blue],['la',500,180,C.red],['lv',500,300,C.red]]) out+=rect(x-61,y-39,122,78,C.paper,20,{stroke:col,'stroke-width':3})+wrap(x,y-1,c.labels[key],C.ink,19,111,2,'middle');
    out+=rect(263,28,114,65,C.paper,24,{stroke:C.teal,'stroke-width':3})+wrap(320,67,c.labels.lungs,C.ink,23,106,2,'middle');
    out+=rect(245,363,150,54,C.paper,18,{stroke:C.teal,'stroke-width':3})+wrap(320,396,c.labels.body,C.ink,20,144,1,'middle');
    out+=text(136,38,'LOWER O2',C.blue,17)+text(496,38,'HIGHER O2',C.red,17);
    out+=text(150,100,'Pulmonary artery',C.blue,16)+text(486,99,'Pulmonary veins',C.red,16);
    out+=arrow(140,226,140,249,C.blue,3)+arrow(500,226,500,249,C.red,3);
    out+=text(105,435,'Systemic veins',C.blue,17)+text(550,435,'Aorta / arteries',C.red,17);
    return out;
  }
});
