MedicalMotion.register({
  id:'endocrine-negative-feedback',category:'Endocrine physiology',title:'Negative feedback stabilizes a hormone axis',
  description:'Show a simple hypothalamus–pituitary–target gland control loop.',
  caption:'Upstream signals stimulate a target gland; circulating hormone feeds back to reduce upstream drive.',
  keywords:['endocrine','hormone','hypothalamus','pituitary','negative feedback','homeostasis'],
  stages:['Name the control levels','Follow forward stimulation','Return the feedback signal'],
  limitations:'Generic axis only. It does not represent a specific hormone, dose, disease or laboratory result.',
  sources:['https://www.ncbi.nlm.nih.gov/books/NBK279388/','https://openstax.org/books/anatomy-and-physiology-2e/pages/17-2-the-pituitary-gland-and-hypothalamus'],
  params:{feedbackStrength:0.75},parameterSchema:{feedbackStrength:{type:'number',min:0.25,max:1,step:0.05,description:'Visual strength of the feedback arrow.'}},
  labels:{hypothalamus:'Hypothalamus',pituitary:'Pituitary',target:'Target gland',hormone:'Circulating hormone',feedback:'Negative feedback'},
  render:function(c,p,t,S){
    const {C,rect,arrow,path,circle,text,wrap}=S; let out='';
    const boxes=[[80,170,165,82,c.labels.hypothalamus,C.blue],[238,170,165,82,c.labels.pituitary,C.teal],[396,170,165,82,c.labels.target,C.red]];
    boxes.forEach(([x,y,w,h,label,col])=>{out+=rect(x,y,w,h,C.paper,18,{stroke:col,'stroke-width':4})+wrap(x+w/2,y+42,label,C.ink,18,w-18,2,'middle');});
    out+=arrow(245,211,238,211,C.blue,4)+arrow(403,211,396,211,C.teal,4);
    const feedback=c.params.feedbackStrength*(.35+.65*p);
    out+=path('M 478 252 C 478 360 160 390 160 252',C.gold,5,'none',{opacity:.25+.75*feedback});
    out+=arrow(160,252,160,254,C.gold,4);
    out+=circle(320,335,18,C.gold,{opacity:.85})+text(320,340,c.labels.hormone,C.ink,17,'middle',700);
    out+=wrap(320,410,c.labels.feedback,C.gold,19,430,1,'middle');
    out+=text(320,120,'stimulation →',C.muted,17,'middle',650);
    return out;
  }
});

