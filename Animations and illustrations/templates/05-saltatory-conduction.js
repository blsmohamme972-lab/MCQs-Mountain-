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
    const {C,path,circle,rect,line,text,arrow,wrap}=S; let out='';
    out+=path('M 73 173 L 35 100 M 53 140 L 17 144 M 45 121 L 55 81 M 56 255 L 24 330 M 40 292 L 12 276',C.blue,6);
    out+=circle(78,218,52,C.soft,{stroke:C.blue,'stroke-width':4})+circle(78,218,19,C.blue,{opacity:.6});
    out+=line(125,218,605,218,C.blue,4);
    for(let i=0;i<4;i++){const x=148+i*106;out+=rect(x,175,78,86,C.teal,29,{opacity:c.params.myelinOpacity});}
    const nodes=[238,344,450,556],active=Math.min(3,Math.floor(p*4));
    nodes.forEach((x,i)=>{out+=circle(x,218,i===active?22:8,i===active?C.gold:C.blue,{opacity:i===active?.95:.55});if(i<3)out+=arrow(x+16,142,nodes[i+1]-16,142,i===active?C.gold:C.line,3);});
    out+=wrap(78,320,c.labels.soma,C.ink,19,150,1,'middle');
    out+=text(320,48,c.labels.myelin,C.ink,20,'middle',750)+line(320,58,320,168,C.muted,2,{'stroke-dasharray':'4 7'});
    out+=wrap(400,320,c.labels.nodes,C.ink,20,310,1,'middle');
    out+=arrow(174,365,573,365,C.teal,4)+wrap(365,408,c.labels.direction,C.ink,19,470,1,'middle');
    return out;
  }
});
