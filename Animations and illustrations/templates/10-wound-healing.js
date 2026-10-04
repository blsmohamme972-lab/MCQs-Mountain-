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
    let out=rect(40,132,560,176,C.tissue,20,{stroke:C.red,'stroke-width':2})+rect(40,107,560,38,C.gold,12);
    out+=path('M 40 182 H 600 M 40 246 H 600',C.paper,3,'none',{opacity:.5});
    // The wound cavity is a real gap through the epidermis and into the dermis.
    out+=path('M '+left+' 107 L '+right+' 107 L '+(320+gap*.32)+' 293 L '+(320-gap*.32)+' 293 Z',C.red,3,C.paper);
    if(p<.65)for(let i=0;i<14;i++)out+=circle(left+8+(i%7)*(gap-16)/6,132+Math.floor(i/7)*14,6,C.red,{opacity:1-p});
    if(p>.12&&p<.75)for(let i=0;i<6;i++)out+=circle(286+(i%3)*22,178+Math.floor(i/3)*45,9,C.paper,{stroke:C.blue,'stroke-width':3,opacity:Math.sin(Math.PI*clamp((p-.12)/.63))});
    const repair=clamp((p-.36)/.5);
    if(repair>0){
      out+=path('M '+(left+4)+' 153 H '+(right-4)+' L '+(right-10)+' 286 H '+(left+10)+' Z',C.tissue,2,C.tissue,{opacity:repair});
      for(let i=0;i<9;i++)out+=line(left+8,165+i*13,right-8,165+i*13+(1-p)*15,C.teal,2,{opacity:repair});
      out+=rect(left-4,111,(gap+8)*repair,27,C.gold,7,{opacity:.85});
      for(let i=0;i<5;i++)out+=circle(left+18+i*Math.max(12,gap-36)/4,205+(i%2)*33,5,C.blue,{opacity:repair*.8});
    }
    out+=wrap(135,77,c.labels.skin,C.ink,19,210,1,'middle')+wrap(504,239,c.labels.dermis,C.ink,22,180,1,'middle');
    out+=wrap(320,37,p>.78?c.labels.scar:'Open wound → clot → repair',C.ink,23,540,1,'middle');
    const bands=[['Hemostasis',0,.4,C.red],['Inflammation',.1,.67,C.blue],['Proliferation',.3,.89,C.teal],['Remodeling',.6,1,C.gold]];
    bands.forEach(([name,a,b,color],i)=>{const y=337+i*25;out+=text(45,y+8,name,C.ink,16,'start')+rect(190+a*395,y-3,(b-a)*395,12,color,6,{opacity:.65});});
    out+=line(190+p*395,326,190+p*395,426,C.ink,2);
    return out;
  }
});
