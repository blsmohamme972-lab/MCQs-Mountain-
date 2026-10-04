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
    const {C,path,circle,rect,line,text,wrap,clamp,arrow}=S;
    let out='';
    out+=path('M 84 74 C 84 48 112 31 145 37 C 188 45 224 78 244 126 L 266 188 C 275 215 301 229 320 229',C.blue,7,C.soft);
    out+=path('M 320 229 C 339 229 365 215 374 188 L 396 126 C 416 78 452 45 495 37 C 528 31 556 48 556 74',C.red,7,C.tissue);
    out+=wrap(160,27,c.labels.pre,C.ink,19,250,2,'middle');
    out+=wrap(480,27,c.labels.post,C.ink,19,250,2,'middle');
    // Vesicles and calcium at the active terminal.
    for(const [x,y] of [[159,116],[205,104],[234,139],[406,117]]){out+=circle(x,y,20,C.paper,{stroke:C.blue,'stroke-width':3});for(let k=0;k<3;k++)out+=circle(x-8+k*8,y+(k%2?5:-5),4,C.gold);}
    out+=circle(320,215,24,C.paper,{stroke:C.blue,'stroke-width':3});
    for(let i=0;i<5;i++)out+=circle(281+i*18,194+(i%2)*12,4,C.gold,{opacity:.8});
    const cross=clamp((p-.28)/.55), n=Math.round(c.params.releaseCount);
    for(let i=0;i<n;i++){const x=320+Math.sin(i*2.4)*24*cross,y=237+(i%3-1)*6+cross*63;out+=circle(x,Math.min(316,y),5,C.gold);}
    out+=line(96,321,544,321,C.teal,6)+line(96,337,544,337,C.teal,3);
    // Postsynaptic receptor gates are distinct from the membrane.
    for(const x of [220,320,420]){
      out+=path('M '+(x-17)+' 353 V 311 Q '+x+' 340 '+(x+17)+' 311 V 353',p>.78&&x===320?C.gold:C.blue,7,C.paper);
      out+=circle(x,307,4,C.gold,{opacity:p>.72&&x===320?.95:.35});
    }
    out+=wrap(570,274,c.labels.cleft,C.muted,17,128,2,'middle');
    out+=wrap(320,403,c.labels.receptor,C.ink,18,300,1,'middle');
    out+=arrow(112,375,196,375,C.teal,3)+text(154,366,'Ca²⁺',C.gold,14,'middle',750);
    return out;
  }
});
