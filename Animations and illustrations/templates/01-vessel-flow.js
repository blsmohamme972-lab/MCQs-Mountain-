MedicalMotion.register({
  id:'vessel-flow',category:'Circulation',title:'A narrower route for blood',
  description:'Follow directional flow through a simplified vessel lumen.',
  caption:'A narrowing changes the available lumen. Particle motion here is illustrative, not a flow or pressure calculation.',
  keywords:['vessel','artery','stenosis','lumen','blood flow'],
  stages:['Locate the lumen','Follow the flow','Compare the space'],
  limitations:'Longitudinal schematic, not a measured stenosis. No pressure, perfusion or turbulence model.',
  sources:['https://www.nhlbi.nih.gov/health/atherosclerosis'],
  params:{narrowing:0.55,speed:1},
  parameterSchema:{narrowing:{type:'number',min:0,max:0.75,step:0.05,description:'Fractional reduction in illustrated central lumen diameter; not a clinical measurement.'},speed:{type:'number',min:0.25,max:2,step:0.25,description:'Visual flow multiplier, not blood velocity.'}},
  labels:{lumen:'Vessel lumen',wall:'Vessel wall',direction:'Direction of flow'},
  render:function(c,p,t,S){
    const {C,path,rect,circle,text,arrow,wrap}=S, n=c.params.narrowing;
    const top=[],bottom=[];
    for(let x=38;x<=602;x+=8){const g=Math.exp(-Math.pow((x-320)/100,2));top.push([x,118+86*n*g]);bottom.push([x,322-86*n*g]);}
    const lumen='M '+top.map(q=>q.join(' ')).join(' L ')+' L '+bottom.slice().reverse().map(q=>q.join(' ')).join(' L ')+' Z';
    let out=path(lumen,C.red,18,C.soft,{opacity:.95});
    out+=path('M '+top.map(q=>q.join(' ')).join(' L '),C.red,10,'none',{opacity:.9});
    out+=path('M '+bottom.map(q=>q.join(' ')).join(' L '),C.red,10,'none',{opacity:.9});
    out+=path('M 38 130 H 602',C.paper,2,'none',{opacity:.55,'stroke-dasharray':'8 10'});
    out+=path('M 38 310 H 602',C.paper,2,'none',{opacity:.55,'stroke-dasharray':'8 10'});
    out+=wrap(320,57,c.labels.lumen,C.ink,25,500,1,'middle');
    out+=wrap(95,104,c.labels.wall,C.muted,17,145,2,'middle');
    // A smooth plaque shelf creates the narrowing while the wall remains continuous.
    out+=path('M 248 205 C 266 190 288 197 306 207 C 325 216 343 215 360 204 C 377 193 399 197 414 210',C.gold,18,C.tissue,{opacity:.92});
    out+=path('M 250 201 C 280 183 303 204 329 209 C 354 214 378 186 411 207',C.gold,3,'none',{opacity:.72});
    for(let i=0;i<16;i++){
      const x=46+552*((p*c.params.speed+i/16)%1),g=Math.exp(-Math.pow((x-320)/100,2));
      const y=220+Math.sin(i*2.37)*(58-58*n*g), rx=12, ry=7;
      out+=S.el('ellipse',{cx:x,cy:y,rx,ry,fill:C.red,opacity:.92,transform:'rotate('+(i%2?8:-8)+' '+x+' '+y+')'});
      out+=S.el('ellipse',{cx:x,cy:y,rx:5,ry:2.5,fill:C.paper,opacity:.4});
    }
    out+=arrow(320,100,320,155,C.gold,3)+text(320,91,'PLAQUE / NARROWING',C.gold,15,'middle',750);
    out+=arrow(88,374,552,374,C.teal,4)+wrap(320,415,c.labels.direction,C.ink,21,500,1,'middle');
    return out;
  }
});
