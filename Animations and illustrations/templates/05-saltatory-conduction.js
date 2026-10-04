MedicalMotion.register({
  id:'saltatory-conduction',category:'Neuroscience',title:'Regenerate the signal at nodes',
  description:'A myelinated axon highlights successive nodes of Ranvier.',
  caption:'In a myelinated axon, action potentials are regenerated at successive nodes. The internodal electrical spread is simplified here.',
  keywords:['neuron','axon','myelin','nerve','saltatory','action potential'],
  stages:['Find myelin and gaps','Highlight successive nodes','Remember nodal regeneration'],
  limitations:'No membrane-voltage, ionic-current or conduction-velocity simulation. Myelin opacity changes appearance only, not disease severity.',
  sources:['https://openstax.org/books/anatomy-and-physiology/pages/12-4-the-action-potential'],
  params:{myelinOpacity:0.85},parameterSchema:{myelinOpacity:{type:'number',min:0.35,max:1,step:0.05,description:'Presentation opacity only; not a demyelination model.'}},
  labels:{soma:'Cell body',myelin:'Myelin sheath',nodes:'Nodes of Ranvier',direction:'Direction along the axon'},
  render:function(c,p,t,S){
    const {C,path,circle,rect,line,text,arrow,wrap}=S;
    let out=path('M 73 173 L 35 100 M 53 140 L 17 144 M 45 121 L 55 81 M 56 255 L 24 330 M 40 292 L 12 276',C.blue,6);
    out+=circle(78,218,52,C.soft,{stroke:C.blue,'stroke-width':4})+circle(78,218,19,C.blue,{opacity:.6});
    out+=line(125,205,605,205,C.blue,4)+line(125,231,605,231,C.blue,4);
    for(let i=0;i<4;i++){const x=148+i*106;out+=rect(x,175,78,87,C.teal,29,{opacity:c.params.myelinOpacity});for(let k=0;k<3;k++)out+=path('M '+(x+19+k*16)+' 184 Q '+(x+5+k*16)+' 218 '+(x+19+k*16)+' 253',C.paper,2,'none',{opacity:.6});}
    const nodes=[238,344,450,556],active=Math.min(3,Math.floor(p*4));
    nodes.forEach((x,i)=>{out+=circle(x,218,i===active?22:8,i===active?C.gold:C.blue,{opacity:i===active?.95:.55});if(i<3)out+=arrow(x+15,131,nodes[i+1]-15,131,i===active?C.gold:C.line,3);});
    out+=wrap(84,304,c.labels.soma,C.ink,19,150,2,'middle')+wrap(305,74,c.labels.nodes,C.ink,24,490,2,'middle');
    out+=line(344,90,344,189,C.muted,2,{'stroke-dasharray':'4 7'})+wrap(402,305,c.labels.myelin,C.ink,22,350,2,'middle');
    out+=arrow(174,362,573,362,C.teal,4)+wrap(365,405,c.labels.direction,C.ink,21,470,1,'middle');
    return out;
  }
});
