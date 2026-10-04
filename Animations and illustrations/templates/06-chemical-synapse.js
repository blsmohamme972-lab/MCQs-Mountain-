MedicalMotion.register({
  id:'chemical-synapse',category:'Neuroscience',title:'From electrical to chemical',
  description:'Follow vesicle release, movement through the cleft and receptor binding.',
  caption:'Released neurotransmitter crosses the synaptic cleft and binds receptors. The postsynaptic effect depends on the transmitter and receptor.',
  keywords:['synapse','neurotransmitter','vesicle','receptor','chemical transmission'],
  stages:['Find the terminal','Release and cross the cleft','Bind a receptor'],
  limitations:'Generic chemical synapse. Calcium entry, vesicle recycling, receptor kinetics and transmitter clearance are omitted; binding does not guarantee a new action potential.',
  sources:['https://openstax.org/books/anatomy-and-physiology-2e/pages/12-5-communication-between-neurons'],
  params:{releaseCount:6},parameterSchema:{releaseCount:{type:'number',min:3,max:9,step:1,description:'Illustrative particle count, rounded to a whole number; not transmitter concentration.'}},
  labels:{pre:'Presynaptic terminal',cleft:'Synaptic cleft',post:'Postsynaptic membrane',receptor:'Receptor'},
  render:function(c,p,t,S){
    const {C,path,circle,line,text,wrap,clamp}=S;
    let out=path('M 110 55 V 134 Q 110 232 230 238 H 410 Q 530 232 530 134 V 55',C.blue,7,C.soft);
    out+=wrap(320,35,c.labels.pre,C.ink,24,550,1,'middle');
    for(const [x,y] of [[186,117],[264,97],[410,115],[461,166]]){out+=circle(x,y,22,C.paper,{stroke:C.blue,'stroke-width':3});for(let k=0;k<3;k++)out+=circle(x-9+k*9,y+(k%2?6:-5),4,C.gold);}
    const release=clamp(p/.34),vy=139+77*release;
    out+=circle(326,vy,22,C.paper,{stroke:C.blue,'stroke-width':3,opacity:p<.4?1:.35});
    const n=Math.round(c.params.releaseCount),cross=clamp((p-.3)/.5);
    for(let i=0;i<n;i++){const x=326+Math.sin(i*2.4)*26*cross,y=vy+(i%3-1)*7+cross*88;out+=circle(x,Math.min(312,y),5,C.gold);}
    out+=line(91,325,550,325,C.teal,7)+line(91,342,550,342,C.teal,4);
    for(const x of [220,325,430])out+=path('M '+(x-16)+' 355 V 310 Q '+x+' 340 '+(x+16)+' 310 V 355',p>.78&&x===325?C.gold:C.blue,7,C.paper);
    out+=wrap(555,270,c.labels.cleft,C.muted,17,144,2,'middle')+wrap(320,400,c.labels.post,C.ink,23,550,1,'middle');
    out+=wrap(433,291,c.labels.receptor,C.ink,19,180,1,'middle')+line(431,298,431,307,C.muted,2);
    return out;
  }
});
