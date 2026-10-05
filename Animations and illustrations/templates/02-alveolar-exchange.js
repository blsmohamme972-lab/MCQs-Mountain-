MedicalMotion.register({
  id:'alveolar-exchange',category:'Respiration',title:'Two gases. Opposite directions.',
  description:'See oxygen and carbon dioxide cross the alveolar-capillary interface.',
  caption:'Oxygen moves from alveolar air into blood; carbon dioxide moves from blood into alveolar air.',
  keywords:['lung','alveolus','gas exchange','oxygen','carbon dioxide'],
  stages:['Find air and blood','Follow both gases','Remember the directions'],
  limitations:'Ten enlarged alveolar air spaces and their capillary bed are an original teaching schematic. Cell layers, diffusion rates, partial pressures and ventilation-perfusion relationships are not calculated.',
  sources:['https://www.nhlbi.nih.gov/health/lungs/respiratory-system'],
  params:{speed:1},parameterSchema:{speed:{type:'number',min:0.25,max:2,step:0.25,description:'Visual gas-motion multiplier.'}},
  labels:{air:'Alveolar air',blood:'Capillary blood',barrier:'Thin exchange interface'},
  render:function(c,p,t,S){
    const {C,path,rect,text,circle,arrow,flow,wrap,alveolarSac}=S; let out='';
    // Ten individually shaped air spaces form an alveolar cluster rather than one icon-like bubble.
    const sac=alveolarSac;
    const highlight='M -34 -10 C -18 -31 15 -37 35 -19';
    const cells=[[218,82,.55,-8],[320,65,.62,2],[422,82,.55,8],[177,140,.5,-14],[266,126,.6,-5],[374,126,.6,5],[463,140,.5,14],[224,191,.53,-8],[320,181,.62,0],[416,191,.53,8]];
    out+=path('M 320 27 V 47 M 320 47 C 292 57 266 74 245 98 M 320 47 C 348 57 374 74 395 98',C.blue,12,'none',{opacity:.9});
    cells.forEach(([x,y,k,r])=>{
      const tr='translate('+x+' '+y+') rotate('+r+') scale('+k+' '+k+')';
      out+=path(sac,C.blue,4,C.soft,{transform:tr,'data-structure':'alveolar-space'});
      out+=path(highlight,C.paper,3,'none',{transform:tr,opacity:.48});
    });
    out+=wrap(320,24,c.labels.air,C.ink,18,250,1,'middle');

    // A delicate capillary mesh hugs the septa; the enlarged barrier stays visibly thin.
    out+=path('M 116 247 C 160 220 202 226 241 247 S 319 267 357 247 S 437 220 524 249',C.red,13,'none',{opacity:.3});
    out+=path('M 116 247 C 160 220 202 226 241 247 S 319 267 357 247 S 437 220 524 249',C.teal,3,'none',{opacity:.9});
    out+=path('M 142 258 C 181 233 214 237 249 257 S 318 279 350 257 S 420 232 499 258',C.red,3,'none',{opacity:.75});
    out+=path('M 166 244 C 185 273 208 273 228 246 M 274 247 C 292 274 314 274 332 247 M 382 247 C 400 273 422 273 443 246',C.red,3,'none',{opacity:.72});
    out+=wrap(320,289,c.labels.barrier,C.teal,16,360,1,'middle');

    out+=rect(72,322,496,82,C.tissue,38,{stroke:C.red,'stroke-width':4});
    out+=path('M 90 337 C 205 317 435 317 550 337',C.paper,2,'none',{opacity:.55});
    out+=wrap(320,353,c.labels.blood,C.ink,21,360,1,'middle');
    for(let i=0;i<8;i++){
      const x=111+62*i, y=376+(i%2?6:-4);
      out+=S.el('ellipse',{cx:x,cy:y,rx:17,ry:9,fill:C.red,opacity:.86,transform:'rotate('+(i%2?8:-7)+' '+x+' '+y+')'});
      out+=S.el('ellipse',{cx:x,cy:y,rx:8,ry:3,fill:C.paper,opacity:.34,transform:'rotate('+(i%2?8:-7)+' '+x+' '+y+')'});
    }

    out+=text(232,310,'O₂',C.teal,21,'middle',750);
    out+=text(408,310,'CO₂',C.gold,21,'middle',750);
    out+=arrow(232,317,232,341,C.teal,4);
    out+=arrow(408,341,408,317,C.gold,4);
    out+=flow([[232,317],[232,341]],(p*c.params.speed)%1,C.teal,4,5);
    out+=flow([[408,341],[408,317]],(p*c.params.speed)%1,C.gold,4,5);
    out+=text(320,430,'O₂: alveolar air → blood   |   CO₂: blood → alveolar air',C.muted,14,'middle',650);
    return out;
  }
});
