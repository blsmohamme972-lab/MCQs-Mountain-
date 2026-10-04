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
    const {C,rect,line,circle,arrow,text,wrap,flow}=S,active=c.params.mode==='active';
    let out=rect(35,65,245,327,C.soft,24)+rect(360,65,245,327,C.soft,24);
    for(let y=72;y<=390;y+=19){if(y>188&&y<248)continue;out+=circle(293,y,6,C.teal)+circle(347,y,6,C.teal)+line(300,y,317,y+7,C.gold,2)+line(340,y,323,y-7,C.gold,2);}
    out+=rect(281,189,78,62,C.blue,18)+rect(277,210,86,20,C.paper,8);
    const points=(count,left)=>Array.from({length:count},(_,i)=>{const x=(left?62:388)+(i%5)*40,y=115+Math.floor(i/5)*55;return circle(x,y,7,C.teal,{opacity:.7});}).join('');
    out+=points(active?6:20,true)+points(active?20:6,false);
    out+=arrow(175,220,469,220,C.gold,3)+flow([[170,220],[470,220]],p*c.params.speed,C.gold,4,6);
    out+=wrap(156,39,c.labels.left,C.ink,24,235,1,'middle')+wrap(481,39,c.labels.right,C.ink,24,235,1,'middle');
    out+=text(155,370,active?'LOWER':'HIGHER',C.ink,21)+text(483,370,active?'HIGHER':'LOWER',C.ink,21);
    out+=text(320,429,active?'PRIMARY ACTIVE TRANSPORT':'FACILITATED DIFFUSION',C.teal,21);
    out+=rect(217,278,206,44,C.paper,14,{stroke:active?C.gold:C.line})+text(320,307,active?'ATP -> ADP + Pi':'No direct ATP use',active?C.gold:C.muted,18);
    return out;
  }
});
