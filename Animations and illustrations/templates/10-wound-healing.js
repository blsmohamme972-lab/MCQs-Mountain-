MedicalMotion.register({
  id:'wound-healing',category:'Tissue repair',title:'Repair happens in overlapping phases',
  description:'Watch a conceptual wound progress from clot formation to remodeling.',
  caption:'Hemostasis, inflammation, proliferation and remodeling overlap. Timing and the final scar vary with the wound and patient.',
  keywords:['wound','healing','hemostasis','inflammation','proliferation','remodeling','scar'],
  stages:['Recognize tissue injury','Follow overlapping repair','Remodel the repaired tissue'],
  limitations:'Compressed illustrative timeline, not days or a clinical prognosis. Wound geometry, cell numbers and scar size are arbitrary; healing is not always uncomplicated.',
  sources:['https://www.ncbi.nlm.nih.gov/books/NBK470443/'],
  params:{woundWidth:110},parameterSchema:{woundWidth:{type:'number',min:60,max:150,step:10,description:'Initial drawing width in SVG units, not wound dimensions.'}},
  labels:{skin:'Epidermis',dermis:'Dermis',scar:'Remodeling tissue'},
  render:function(c,p,t,S){
    const {C,rect,path,circle,line,text,wrap,clamp}=S, gap=c.params.woundWidth*(1-.65*p),left=320-gap/2,right=320+gap/2;
    let out=rect(40,125,560,188,C.tissue,20)+rect(40,109,560,36,C.gold,12);
    out+=path('M '+left+' 109 L '+right+' 109 L '+(320+gap*.32)+' 291 L '+(320-gap*.32)+' 291 Z',C.red,2,C.paper);
    if(p<.65)for(let i=0;i<12;i++)out+=circle(left+8+(i%6)*(gap-16)/5,133+Math.floor(i/6)*14,6,C.red,{opacity:1-p});
    if(p>.12&&p<.75)for(let i=0;i<5;i++)out+=circle(300+(i%3)*21,183+Math.floor(i/3)*40,9,C.paper,{stroke:C.blue,'stroke-width':3,opacity:Math.sin(Math.PI*clamp((p-.12)/.63))});
    const repair=clamp((p-.36)/.5);
    if(repair>0){out+=rect(left+3,155,gap-6,133,C.tissue,8,{opacity:repair});for(let i=0;i<8;i++)out+=line(left+5,168+i*15,right-5,168+i*15+(1-p)*16,C.teal,2,{opacity:repair});out+=rect(left-3,112,(gap+6)*repair,28,C.gold,7);}
    out+=wrap(135,75,c.labels.skin,C.ink,20,210,1,'middle')+wrap(504,239,c.labels.dermis,C.ink,23,180,1,'middle');
    out+=wrap(320,37,p>.78?c.labels.scar:'Conceptual tissue repair',C.ink,24,540,1,'middle');
    const bands=[['Hemostasis',0,.4,C.red],['Inflammation',.1,.67,C.blue],['Proliferation',.3,.89,C.teal],['Remodeling',.6,1,C.gold]];
    bands.forEach(([name,a,b,color],i)=>{const y=337+i*25;out+=text(45,y+8,name,C.ink,16,'start')+rect(190+a*395,y-3,(b-a)*395,12,color,6,{opacity:.65});});
    out+=line(190+p*395,326,190+p*395,426,C.ink,2);
    return out;
  }
});
