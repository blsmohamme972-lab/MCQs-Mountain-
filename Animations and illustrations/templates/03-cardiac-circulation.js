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
    const blue=[[320,386],[46,386],[46,150],[102,150],[102,260],[178,260],[178,58],[263,58]];
    const red=[[377,58],[462,58],[462,150],[538,150],[538,260],[462,260],[462,386],[400,386]];
    let out=path('M '+blue.map(q=>q.join(' ')).join(' L '),C.blue,10)+path('M '+red.map(q=>q.join(' ')).join(' L '),C.red,10);
    out+=flow(blue,(p*c.params.speed)%1,C.paper,7,5)+flow(red,(p*c.params.speed)%1,C.paper,7,5);
    out+=arrow(46,320,46,270,C.blue,3)+arrow(102,214,102,244,C.blue,3)+arrow(178,58,235,58,C.blue,3);
    out+=arrow(462,58,420,58,C.red,3)+arrow(538,214,538,244,C.red,3)+arrow(462,320,462,365,C.red,3);
    for(const [key,x,y,col] of [['ra',164,150,C.blue],['rv',164,260,C.blue],['la',476,150,C.red],['lv',476,260,C.red]])
      out+=rect(x-62,y-34,124,68,C.paper,18,{stroke:col,'stroke-width':3})+wrap(x,y+6,c.labels[key],C.ink,18,112,2,'middle');
    out+=rect(263,24,114,68,C.paper,22,{stroke:C.teal,'stroke-width':3})+wrap(320,66,c.labels.lungs,C.ink,21,100,1,'middle');
    out+=rect(245,360,150,54,C.paper,18,{stroke:C.gold,'stroke-width':3})+wrap(320,393,c.labels.body,C.ink,19,138,1,'middle');
    out+=text(94,112,'LOWER O₂',C.blue,15,'middle',750)+text(546,112,'HIGHER O₂',C.red,15,'middle',750);
    out+=text(320,424,'Systemic veins → right heart → lungs → left heart → aorta',C.muted,14,'middle',650);
    return out;
  }
});
