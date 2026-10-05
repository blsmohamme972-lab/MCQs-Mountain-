MedicalMotion.register({
  id:'epithelial-barrier',category:'Anatomy and histology',title:'An epithelial barrier controls passage',
  description:'Show cells, tight junctions and the difference between transcellular and paracellular routes.',
  caption:'A continuous epithelial sheet limits paracellular movement; selective transport across cells is a separate mechanism.',
  keywords:['epithelium','tight junction','barrier','paracellular','transcellular','histology'],
  stages:['Arrange the epithelial sheet','Close the junctions','Compare two routes'],
  limitations:'Illustrates organization, not permeability coefficients or a specific organ epithelium.',
  sources:['https://www.ncbi.nlm.nih.gov/books/NBK470395/','https://openstax.org/books/anatomy-and-physiology-2e/pages/4-2-epithelial-tissue'],
  params:{junctionIntegrity:0.8},parameterSchema:{junctionIntegrity:{type:'number',min:0.35,max:1,step:0.05,description:'Visual junction continuity; not a clinical permeability value.'}},
  labels:{lumen:'Lumen',cells:'Epithelial cells',junction:'Tight junctions',route:'Selective routes'},
  render:function(c,p,t,S){
    const {C,rect,path,circle,text,arrow,wrap}=S; let out='';
    out+=rect(48,30,544,64,C.soft,22)+text(320,70,c.labels.lumen,C.ink,22,'middle',750);
    const integrity=Math.min(1,c.params.junctionIntegrity*(.55+.45*p)+.15*p), gap=18*(1-integrity), xs=[105,205,305,405,505];
    xs.forEach((x,i)=>{out+=rect(x-42,135,84,210,C.tissue,22,{stroke:C.red,'stroke-width':3});if(i<xs.length-1){const gx=x+42+gap/2;out+=rect(gx,135,Math.max(4,18-gap),26,C.teal,8,{opacity:.9});}});
    out+=text(320,382,c.labels.cells,C.ink,22,'middle',750)+text(320,414,c.labels.junction,C.teal,18,'middle',700);
    out+=arrow(150,104,150,130,C.gold,3)+arrow(490,104,490,130,C.gold,3);
    out+=path('M 150 112 C 235 105 260 112 320 112 C 380 112 405 105 490 112',C.gold,3,'none',{'stroke-dasharray':'7 7'});
    out+=circle(190,220,8,C.blue)+circle(232,220,8,C.blue)+circle(455,220,8,C.blue);
    out+=arrow(230,220,288,220,C.blue,3)+arrow(360,220,420,220,C.blue,3);
    out+=wrap(320,445,c.labels.route,C.muted,16,470,1,'middle');
    return out;
  }
});

