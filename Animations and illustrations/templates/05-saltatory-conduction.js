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
    out+=path('M 75 169 C 50 142 36 117 31 87 M 54 133 L 16 112 M 49 117 L 68 77 M 58 266 C 43 299 27 324 10 344 M 38 306 L 4 295',C.blue,6);
    out+=circle(78,218,54,C.soft,{stroke:C.blue,'stroke-width':5})+circle(92,208,21,C.blue,{opacity:.65})+circle(61,235,13,C.teal,{opacity:.6});
    out+=path('M 127 218 C 210 216 264 220 321 218 S 435 220 606 218',C.blue,5);
    for(let i=0;i<4;i++){const x=145+i*106;out+=rect(x,174,82,88,C.teal,30,{opacity:c.params.myelinOpacity,stroke:C.blue,'stroke-width':3});out+=path('M '+(x+14)+' 184 V 252 M '+(x+68)+' 184 V 252',C.paper,2,'none',{opacity:.35});}
    const nodes=[228,334,440,546],active=Math.min(3,Math.floor(p*4));
    nodes.forEach((x,i)=>{out+=circle(x,218,i===active?20:9,i===active?C.gold:C.paper,{stroke:i===active?C.gold:C.blue,'stroke-width':3,opacity:i===active?.98:.85});if(i<3)out+=arrow(x+20,145,nodes[i+1]-20,145,i===active?C.gold:C.line,3);});
    out+=wrap(78,320,c.labels.soma,C.ink,19,150,1,'middle');
    out+=text(320,42,c.labels.myelin,C.ink,20,'middle',750)+line(320,53,320,170,C.muted,2,{'stroke-dasharray':'4 7'});
    out+=wrap(420,320,c.labels.nodes,C.ink,20,310,1,'middle');
    out+=arrow(174,372,573,372,C.teal,4)+wrap(365,414,c.labels.direction,C.ink,18,470,1,'middle');
    return out;
  }
});
