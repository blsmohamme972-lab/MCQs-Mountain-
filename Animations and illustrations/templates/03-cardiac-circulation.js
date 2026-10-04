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
    const {C,path,rect,circle,wrap,flow,text,arrow}=S;
    const blue=[[284,344],[154,400],[62,355],[62,115],[170,72],[270,86]];
    const red=[[370,86],[470,72],[578,115],[578,355],[486,400],[356,344]];
    let out=path('M '+blue.map(q=>q.join(' ')).join(' L '),C.blue,11,'none',{opacity:.88});
    out+=path('M '+red.map(q=>q.join(' ')).join(' L '),C.red,11,'none',{opacity:.88});
    out+=flow(blue,(p*c.params.speed)%1,C.paper,8,5)+flow(red,(p*c.params.speed)%1,C.paper,8,5);
    // Lungs are drawn as paired lobes with a shared airway.
    out+=path('M 320 80 V 49 M 320 49 C 292 61 271 67 248 85 M 320 49 C 348 61 369 67 392 85',C.teal,6);
    out+=S.el('ellipse',{cx:270,cy:72,rx:53,ry:42,fill:C.soft,stroke:C.teal,'stroke-width':4})+S.el('ellipse',{cx:370,cy:72,rx:53,ry:42,fill:C.soft,stroke:C.teal,'stroke-width':4});
    out+=path('M 248 60 C 263 45 279 42 294 54 M 346 54 C 361 42 377 45 392 60',C.teal,2,'none',{opacity:.65});
    // Original heart silhouette, septum and valve planes keep four chambers readable.
    out+=path('M 320 328 C 291 305 235 272 235 211 C 235 170 283 151 320 187 C 357 151 405 170 405 211 C 405 272 349 305 320 328 Z',C.red,6,C.tissue);
    out+=path('M 320 187 V 282 M 246 227 C 270 217 296 219 320 232 M 320 232 C 344 219 370 217 394 227',C.red,4,'none',{opacity:.8});
    out+=path('M 280 252 Q 294 238 308 252 M 332 252 Q 346 238 360 252',C.gold,4,'none',{opacity:.9});
    for(const [key,x,y,col] of [['ra',278,203,C.blue],['rv',278,270,C.blue],['la',362,203,C.red],['lv',362,270,C.red]])
      out+=wrap(x,y,c.labels[key],C.ink,14,74,2,'middle')+circle(x,y+18,4,col,{opacity:.8});
    out+=rect(248,8,144,28,C.paper,14,{stroke:C.teal,'stroke-width':2})+wrap(320,28,c.labels.lungs,C.ink,16,132,1,'middle');
    out+=rect(242,386,156,30,C.paper,15,{stroke:C.gold,'stroke-width':2})+wrap(320,407,c.labels.body,C.ink,16,144,1,'middle');
    out+=arrow(68,335,68,270,C.blue,3)+arrow(572,270,572,335,C.red,3);
    out+=text(120,111,'LOWER O₂',C.blue,14,'middle',750)+text(520,111,'HIGHER O₂',C.red,14,'middle',750);
    out+=text(320,435,'Body → right heart → lungs → left heart → body',C.muted,14,'middle',650);
    return out;
  }
});
