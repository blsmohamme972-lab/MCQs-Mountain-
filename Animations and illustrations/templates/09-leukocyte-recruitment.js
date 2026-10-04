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
    let out=rect(35,75,570,180,C.soft,22)+rect(35,281,570,137,C.tissue,22);
    for(let i=0;i<10;i++){const x=35+i*57;out+=rect(x,251,i===5?40:53,27,C.teal,9,{stroke:C.blue,'stroke-width':1});}
    for(let i=0;i<7;i++){const x=60+520*((p*.5+i/7)%1);out+=S.el('ellipse',{cx:x,cy:119,rx:17,ry:10,fill:C.red,opacity:.82,transform:'rotate('+(i%2?8:-8)+' '+x+' 119)'});}
    let q;
    if(p<.36)q=move([[85,177],[200,192],[360,229]],p/.36);
    else if(p<.54)q=[360,229];
    else if(p<.78)q=move([[360,229],[360,300],[421,336]],(p-.54)/.24);
    else q=move([[421,336],[522,371]],(p-.78)/.22);
    const r=c.params.cellSize;
    out+=circle(q[0],q[1],r+8,C.gold,{opacity:.16})+circle(q[0],q[1],r,C.paper,{stroke:C.blue,'stroke-width':3});
    out+=circle(q[0]-9,q[1],8,C.blue,{opacity:.8})+circle(q[0]+3,q[1]-6,8,C.blue,{opacity:.8})+circle(q[0]+10,q[1]+6,8,C.blue,{opacity:.8});
    out+=path('M 105 177 Q 250 192 360 229 V 295 L 516 371',C.gold,2,'none',{'stroke-dasharray':'5 9'});
    out+=arrow(437,344,498,367,C.gold,3);
    for(let i=0;i<5;i++){const a=i*1.3;out+=line(542+Math.cos(a)*15,369+Math.sin(a)*15,542+Math.cos(a)*29,369+Math.sin(a)*29,C.gold,3);}
    out+=wrap(320,40,c.labels.blood,C.ink,24,550,1,'middle')+wrap(108,394,c.labels.tissue,C.ink,21,135,1,'middle');
    out+=text(155,225,'Rolling',C.ink,18)+text(341,184,'Adhesion',C.ink,18)+text(410,313,'Transmigration',C.ink,17);
    out+=wrap(526,427,c.labels.signal,C.ink,18,177,1,'middle');
    return out;
  }
});
