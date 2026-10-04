MedicalMotion.register({
  id:'sarcomere-sliding-filament',category:'Physiology',title:'Thin filaments slide past thick filaments',
  description:'Visualize a simplified sarcomere with actin, myosin and Z discs.',
  caption:'Contraction is represented as increased overlap; the filaments themselves do not shorten in this schematic.',
  keywords:['muscle','sarcomere','actin','myosin','contraction','physiology'],
  stages:['Find the Z discs','Compare filament positions','Increase overlap'],
  limitations:'No calcium, ATP, cross-bridge cycle or force calculation. Geometry is a conceptual longitudinal view.',
  sources:['https://www.ncbi.nlm.nih.gov/books/NBK538143/','https://openstax.org/books/anatomy-and-physiology-2e/pages/10-3-muscle-fiber-contraction-and-relaxation'],
  params:{overlap:0.55},parameterSchema:{overlap:{type:'number',min:0.2,max:0.9,step:0.05,description:'Visual overlap between actin and myosin.'}},
  labels:{zdisc:'Z disc',actin:'Thin filament / actin',myosin:'Thick filament / myosin',direction:'Sliding toward the center'},
  render:function(c,p,t,S){
    const {C,line,path,rect,text,arrow,wrap}=S; let out='';
    out+=line(75,120,75,330,C.red,10)+line(565,120,565,330,C.red,10);
    out+=text(75,92,c.labels.zdisc,C.ink,17,'middle',700)+text(565,92,c.labels.zdisc,C.ink,17,'middle',700);
    const shift=110*c.params.overlap;
    out+=path('M 75 190 H '+(290+shift)+' M 75 230 H '+(290+shift)+' M 75 270 H '+(290+shift),C.teal,8);
    out+=path('M 565 190 H '+(330-shift)+' M 565 230 H '+(330-shift)+' M 565 270 H '+(330-shift),C.blue,8);
    for(let y=190;y<=270;y+=40){out+=circle(320,y,15,C.gold)+line(309,y,331,y,C.ink,3);}
    out+=text(165,155,c.labels.actin,C.teal,18,'middle',750)+text(475,155,c.labels.myosin,C.blue,18,'middle',750);
    out+=arrow(170,360,285,360,C.teal,4)+arrow(470,360,355,360,C.blue,4);
    out+=wrap(320,410,c.labels.direction,C.ink,18,480,1,'middle');
    return out;
  }
});
