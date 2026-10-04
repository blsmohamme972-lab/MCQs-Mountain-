MedicalMotion.register({
  id:'leukocyte-recruitment',category:'Inflammation',title:'From bloodstream to tissue',
  description:'Track rolling, adhesion, transmigration and tissue-directed movement.',
  caption:'Leukocyte recruitment is a coordinated sequence. This schematic shows one cell moving toward a tissue signal.',
  keywords:['inflammation','leukocyte','neutrophil','rolling','adhesion','extravasation','chemotaxis'],
  stages:['Locate vessel and tissue','Roll, adhere and exit','Move toward a signal'],
  limitations:'Qualitative sequence only. Specific adhesion molecules, inflammatory mediators, vessel subtypes and disease-specific changes are omitted.',
  sources:['https://openstax.org/books/anatomy-and-physiology-2e/pages/21-2-barrier-defenses-and-the-innate-immune-response'],
  params:{cellSize:22},parameterSchema:{cellSize:{type:'number',min:17,max:28,step:1,description:'Illustrative cell radius, not micrometers.'}},
  labels:{blood:'Bloodstream',tissue:'Tissue',signal:'Injury signal'},
  render:function(c,p,t,S){
    const {C,rect,path,circle,line,arrow,text,wrap,move,clamp}=S;
    let out=rect(35,80,570,175,C.soft,20)+rect(35,277,570,141,C.tissue,20);
    for(let i=0;i<10;i++){const x=35+i*57;out+=rect(x,253,i===5?40:53,24,C.teal,8);}
    for(let i=0;i<7;i++){const x=60+520*((p*.5+i/7)%1);out+=S.el('ellipse',{cx:x,cy:120,rx:15,ry:9,fill:C.red,opacity:.8});}
    let q;
    if(p<.36)q=move([[85,172],[200,190],[360,229]],p/.36);
    else if(p<.54)q=[360,229];
    else if(p<.78)q=move([[360,229],[360,293],[421,333]],(p-.54)/.24);
    else q=move([[421,333],[522,370]],(p-.78)/.22);
    const r=c.params.cellSize;
    out+=circle(q[0],q[1],r+7,C.gold,{opacity:.17})+circle(q[0],q[1],r,C.paper,{stroke:C.blue,'stroke-width':3});
    for(let i=0;i<3;i++)out+=circle(q[0]-9+i*8,q[1]+(i%2?4:-3),7,C.blue,{opacity:.8});
    out+=path('M 105 174 Q 250 191 360 229 V 291 L 516 368',C.gold,2,'none',{'stroke-dasharray':'5 9'});
    out+=arrow(437,342,498,365,C.gold,3);
    for(let i=0;i<5;i++)out+=line(542+Math.cos(i*1.3)*15,368+Math.sin(i*1.3)*15,542+Math.cos(i*1.3)*27,368+Math.sin(i*1.3)*27,C.gold,3);
    out+=wrap(320,42,c.labels.blood,C.ink,25,550,1,'middle')+wrap(108,394,c.labels.tissue,C.ink,22,135,1,'middle');
    out+=text(155,225,'Rolling',C.ink,18)+text(341,185,'Adhesion',C.ink,18)+text(410,310,'Exit',C.ink,18);
    out+=wrap(526,427,c.labels.signal,C.ink,18,177,1,'middle');
    return out;
  }
});
