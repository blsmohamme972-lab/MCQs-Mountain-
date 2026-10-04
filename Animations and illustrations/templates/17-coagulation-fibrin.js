MedicalMotion.register({
  id:'coagulation-fibrin',category:'Hematology and pathology',title:'A clotting response builds a fibrin mesh',
  description:'Follow a simplified injury-to-fibrin sequence without dosing or treatment claims.',
  caption:'Tissue injury exposes a trigger; thrombin generation helps convert fibrinogen into a stabilizing fibrin network.',
  keywords:['coagulation','fibrin','thrombin','hemostasis','injury','hematology'],
  stages:['Locate the injury','Generate thrombin','Stabilize with fibrin'],
  limitations:'Many coagulation factors and regulatory steps are omitted. This is not a test result or a treatment guide.',
  sources:['https://www.ncbi.nlm.nih.gov/books/NBK507708/','https://openstax.org/books/anatomy-and-physiology-2e/pages/18-5-hemostasis'],
  params:{activation:0.7},parameterSchema:{activation:{type:'number',min:0.25,max:1,step:0.05,description:'Visual activation level, not a clotting measurement.'}},
  labels:{injury:'Vessel injury',thrombin:'Thrombin',fibrin:'Fibrin mesh',platelets:'Platelet plug'},
  render:function(c,p,t,S){
    const {C,rect,path,circle,arrow,text,wrap}=S; let out='';
    out+=rect(45,75,145,220,C.tissue,28,{stroke:C.red,'stroke-width':4})+path('M 118 78 V 292',C.red,8)+text(118,325,c.labels.injury,C.ink,18,'middle',750);
    out+=arrow(205,185,282,185,C.blue,4)+circle(320,185,45,C.soft,{stroke:C.blue,'stroke-width':3})+wrap(320,181,c.labels.thrombin,C.ink,18,84,2,'middle');
    out+=arrow(365,185,442,185,C.teal,4);
    out+=rect(448,80,145,210,C.paper,24,{stroke:C.teal,'stroke-width':3});
    for(let i=0;i<8;i++){const y=105+i*22;out+=path('M 462 '+y+' Q 520 '+(y+18)+' 579 '+(y-2),C.gold,3,'none',{opacity:.35+.65*c.params.activation});}
    out+=wrap(520,326,c.labels.fibrin,C.ink,18,140,1,'middle');
    for(let i=0;i<5;i++)out+=circle(220+i*24,278,10,C.red,{opacity:.8});
    out+=wrap(320,390,c.labels.platelets,C.red,17,280,1,'middle');
    out+=text(320,430,'Conceptual hemostasis sequence',C.muted,15,'middle',650);
    return out;
  }
});
