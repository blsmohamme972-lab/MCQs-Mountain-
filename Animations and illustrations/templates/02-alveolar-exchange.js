MedicalMotion.register({
  id:'alveolar-exchange',category:'Respiration',title:'Two gases. Opposite directions.',
  description:'See oxygen and carbon dioxide cross the alveolar-capillary interface.',
  caption:'Oxygen moves from alveolar air into blood; carbon dioxide moves from blood into alveolar air.',
  keywords:['lung','alveolus','gas exchange','oxygen','carbon dioxide'],
  stages:['Find air and blood','Follow both gases','Remember the directions'],
  limitations:'Flattened interface with an exaggerated but clearly separated alveolar sac and capillary. No diffusion-rate, partial-pressure or ventilation-perfusion calculation.',
  sources:['https://www.nhlbi.nih.gov/health/lungs/respiratory-system'],
  params:{speed:1},parameterSchema:{speed:{type:'number',min:0.25,max:2,step:0.25,description:'Visual gas-motion multiplier.'}},
  labels:{air:'Alveolar air',blood:'Capillary blood',barrier:'Thin exchange interface'},
  render:function(c,p,t,S){
    const {C,path,rect,text,circle,arrow,flow,wrap}=S; let out='';

    // A lobulated alveolar sac: a clearer reusable shape than a perfect circle.
    const sac='M 320 36 C 291 17 252 25 232 50 C 197 36 164 62 170 96 C 139 116 151 157 181 168 C 193 199 234 211 264 194 C 294 214 335 216 360 196 C 391 212 433 194 439 163 C 475 151 482 111 452 91 C 463 59 427 31 394 44 C 371 20 341 19 320 36 Z';
    out+=path(sac,C.blue,6,C.soft);
    out+=path('M 210 150 C 245 171 286 178 320 178 C 355 178 397 171 430 150',C.blue,3,'none',{opacity:.28});
    out+=wrap(320,94,c.labels.air,C.ink,24,210,2,'middle');
    out+=text(320,127,'thin-walled air space',C.muted,15,'middle',600);

    // The exchange surface is isolated between air and blood.
    out+=path('M 112 225 C 220 208 420 208 528 225',C.teal,6);
    out+=path('M 112 232 C 220 215 420 215 528 232',C.teal,2,'none',{opacity:.24});
    out+=wrap(320,255,c.labels.barrier,C.teal,16,360,1,'middle');

    // Capillary is separated from the air sac so labels remain readable.
    out+=rect(72,302,496,105,C.tissue,36,{stroke:C.red,'stroke-width':5});
    out+=wrap(320,338,c.labels.blood,C.ink,22,360,1,'middle');
    for(let i=0;i<7;i++){
      const x=112+72*i;
      out+=S.el('ellipse',{cx:x,cy:378,rx:17,ry:9,fill:C.red,opacity:.82});
    }

    // Direction labels sit beside the arrows, never on top of the capillary label.
    out+=text(236,276,'O₂',C.teal,22,'middle',750);
    out+=text(404,276,'CO₂',C.gold,22,'middle',750);
    out+=arrow(236,286,236,316,C.teal,4);
    out+=arrow(404,316,404,286,C.gold,4);
    out+=flow([[236,286],[236,316]],(p*c.params.speed)%1,C.teal,4,5);
    out+=flow([[404,316],[404,286]],(p*c.params.speed)%1,C.gold,4,5);

    out+=text(320,430,'O₂: alveolus → blood   |   CO₂: blood → alveolus',C.muted,15,'middle',650);
    return out;
  }
});
