MedicalMotion.register({
  id:'membrane-transport',category:'Cell biology',title:'Across the cell membrane',
  description:'Compare facilitated diffusion with a generic ATP-coupled pump.',
  caption:'Passive transport follows the relevant gradient. A primary active pump couples energy use to transport against a gradient.',
  keywords:['cell','membrane','diffusion','active transport','ATP','pump','channel'],
  stages:['Compare the two sides','Cross through a protein','Check the energy requirement'],
  limitations:'A generic uncharged solute is assumed. Electrochemical gradients, stoichiometry, secondary active transport and membrane potential are not modeled.',
  sources:['https://openstax.org/books/concepts-biology/pages/3-6-active-transport','https://openstax.org/books/concepts-biology/pages/3-5-passive-transport'],
  params:{mode:'passive',speed:1},parameterSchema:{mode:{type:'enum',values:['passive','active'],description:'Passive: higher to lower concentration. Active: lower to higher with ATP coupling.'},speed:{type:'number',min:0.25,max:2,step:0.25,description:'Illustrative transport multiplier.'}},
  labels:{left:'Side A',right:'Side B'},
  render:function(c,p,t,S){
    const {C,rect,line,circle,path,arrow,text,wrap,flow}=S,active=c.params.mode==='active';
    let out=rect(28,58,244,334,C.soft,24)+rect(368,58,244,334,C.soft,24);
    out+=wrap(150,38,c.labels.left,C.ink,23,220,1,'middle')+wrap(490,38,c.labels.right,C.ink,23,220,1,'middle');
    // Two ordered phospholipid leaflets leave a visible aqueous core between them.
    for(let y=78;y<=373;y+=20){if(y>184&&y<264)continue;out+=circle(298,y,7,C.teal)+circle(342,y,7,C.teal)+line(304,y,318,y+7,C.gold,2)+line(336,y,322,y-7,C.gold,2);}
    out+=path('M 298 184 C 306 169 334 169 342 184 V 264 C 334 279 306 279 298 264 Z',C.blue,5,C.paper);
    out+=path('M 320 184 V 264 M 298 199 H 342 M 298 249 H 342',C.gold,3,'none',{opacity:.75});
    const points=(count,left)=>Array.from({length:count},(_,i)=>{const x=(left?58:398)+(i%5)*42,y=112+Math.floor(i/5)*54;return circle(x,y,7,C.teal,{opacity:.72});}).join('');
    out+=points(active?6:20,true)+points(active?20:6,false);
    out+=arrow(active?170:175,225,active?470:469,225,C.gold,3)+flow([[170,225],[470,225]],p*c.params.speed,C.gold,4,6);
    out+=text(150,370,active?'LOWER':'HIGHER',C.ink,20)+text(490,370,active?'HIGHER':'LOWER',C.ink,20);
    out+=text(320,314,active?'PRIMARY ACTIVE TRANSPORT':'FACILITATED DIFFUSION',C.teal,18,'middle',750);
    out+=rect(216,342,208,45,C.paper,14,{stroke:active?C.gold:C.line,'stroke-width':2})+text(320,371,active?'ATP → ADP + Pi':'No direct ATP use',active?C.gold:C.muted,17);
    return out;
  }
});
