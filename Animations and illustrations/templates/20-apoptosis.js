MedicalMotion.register({
  id:'apoptosis',category:'Cell pathology',title:'Apoptosis packages a cell for removal',
  description:'Show a simplified sequence of cell shrinkage, nuclear condensation and apoptotic bodies.',
  caption:'Programmed cell death preserves membrane containment while fragments are cleared by neighboring or phagocytic cells.',
  keywords:['apoptosis','cell death','nucleus','apoptotic bodies','pathology'],
  stages:['Start with a viable cell','Condense and fragment','Clear the apoptotic bodies'],
  limitations:'Conceptual morphology only. It does not diagnose disease or distinguish every form of cell death.',
  sources:['https://www.ncbi.nlm.nih.gov/books/NBK26873/','https://openstax.org/books/biology-2e/pages/12-4-apoptosis'],
  params:{progress:0.65},parameterSchema:{progress:{type:'number',min:0.1,max:1,step:0.05,description:'Visual progression through the schematic sequence.'}},
  labels:{cell:'Cell',nucleus:'Nucleus',bodies:'Apoptotic bodies',clearance:'Clearance'},
  render:function(c,p,t,S){
    const {C,circle,rect,path,text,arrow,wrap}=S; let out='';
    const q=c.params.progress;
    const r=72-28*q;
    out+=circle(150,205,r,C.tissue,{stroke:C.red,'stroke-width':4})+circle(150,205,30-17*q,C.blue,{opacity:.8})+text(150,315,c.labels.cell,C.ink,18,'middle',750);
    out+=arrow(240,205,300,205,C.teal,4);
    out+=circle(365,205,50-18*q,C.tissue,{stroke:C.red,'stroke-width':4})+circle(365,205,18-10*q,C.blue,{opacity:.85})+text(365,315,c.labels.nucleus,C.ink,18,'middle',750);
    out+=arrow(438,205,490,205,C.gold,4);
    for(let i=0;i<5;i++){const x=505+(i%3)*28,y=180+Math.floor(i/3)*42;out+=circle(x,y,12+4*(1-q),C.red,{opacity:.85});}
    out+=wrap(548,315,c.labels.bodies,C.ink,17,110,2,'middle');
    out+=rect(75,362,490,54,C.paper,18,{stroke:C.line,'stroke-width':2})+wrap(320,395,c.labels.clearance,C.muted,17,450,1,'middle');
    return out;
  }
});
