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
    const {C,path,circle,text,arrow,wrap}=S, n=c.params.narrowing;
    const top=[],bottom=[];
    for(let x=40;x<=600;x+=10){const g=Math.exp(-Math.pow((x-320)/95,2));top.push([x,130+90*n*g]);bottom.push([x,310-90*n*g]);}
    const d='M '+top.map(q=>q.join(' ')).join(' L ')+' L '+bottom.slice().reverse().map(q=>q.join(' ')).join(' L ')+' Z';
    let out=path(d,'none',0,C.paper)+path('M '+top.map(q=>q.join(' ')).join(' L '),C.red,16)+path('M '+bottom.map(q=>q.join(' ')).join(' L '),C.red,16)+path('M 40 130 H 600',C.line,2,'none',{'stroke-dasharray':'6 8'})+path('M 40 310 H 600',C.line,2,'none',{'stroke-dasharray':'6 8'});
    out+=wrap(320,66,c.labels.lumen,C.ink,26,500,2,'middle');
    for(let i=0;i<15;i++){const x=50+540*((p*c.params.speed+i/15)%1),g=Math.exp(-Math.pow((x-320)/95,2)),y=220+Math.sin(i*2.4)*(65-65*n*g);out+=S.el('ellipse',{cx:x,cy:y,rx:11,ry:7,fill:C.red,opacity:.9})+S.el('ellipse',{cx:x,cy:y,rx:5,ry:3,fill:C.paper,opacity:.42});}
    out+=arrow(285,106,320,130+90*n,C.gold,3)+text(320,97,'NARROWING',C.gold,17);
    out+=arrow(90,360,550,360,C.teal,4)+wrap(320,403,c.labels.direction,C.ink,22,500,1,'middle');
    out+=wrap(95,110,c.labels.wall,C.muted,18,130,2,'middle');
    return out;
  }
});
