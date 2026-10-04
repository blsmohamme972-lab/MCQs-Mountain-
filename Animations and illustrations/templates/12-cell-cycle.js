MedicalMotion.register({
  id:'cell-cycle',category:'Cell biology',title:'A cell moves through a cycle',
  description:'Follow the major phases G1, S, G2 and M in order.',
  caption:'The cycle is a teaching map: DNA replication occurs in S phase, while mitosis separates replicated chromosomes.',
  keywords:['cell cycle','G1','S phase','G2','mitosis','DNA replication'],
  stages:['Orient to the cycle','Locate DNA synthesis','Separate chromosomes in M'],
  limitations:'Timing, checkpoints and tissue-specific variation are simplified. The diagram is not a live-cell measurement.',
  sources:['https://www.ncbi.nlm.nih.gov/books/NBK9876/','https://openstax.org/books/biology-2e/pages/10-2-the-cell-cycle'],
  params:{speed:1},parameterSchema:{speed:{type:'number',min:0.25,max:2,step:0.25,description:'Presentation speed multiplier only.'}},
  labels:{g1:'G1 growth',s:'S: DNA synthesis',g2:'G2 preparation',m:'M: mitosis',direction:'Cycle order'},
  render:function(c,p,t,S){
    const {C,rect,circle,path,text,arrow,wrap}=S; let out='';
    const phases=[['g1',120,c.labels.g1,C.blue],['s',280,c.labels.s,C.teal],['g2',440,c.labels.g2,C.gold],['m',600,c.labels.m,C.red]];
    const active=Math.min(3,Math.floor((p*c.params.speed%1)*4));
    out+=circle(320,220,150,'none',{stroke:C.line,'stroke-width':8});
    phases.forEach(([key,x,label,col],i)=>{
      const y=i%2===0?110:330, hi=i===active;
      out+=rect(x-76,y-38,152,76,hi?C.soft:C.paper,20,{stroke:hi?col:C.line,'stroke-width':hi?4:2});
      out+=wrap(x,y-4,label,C.ink,18,138,2,'middle');
      if(i<3) out+=arrow(x+78,y,xs=phases[i+1][1]-78,phases[i+1][1]%2?330:110,col,3);
    });
    out+=arrow(520,330,120,110,C.teal,3);
    out+=text(320,220,c.labels.direction,C.muted,17,'middle',650);
    out+=text(320,250,'G1 → S → G2 → M → G1',C.ink,20,'middle',750);
    out+=wrap(320,425,'S phase copies DNA; M phase separates the replicated chromosomes.',C.muted,17,500,2,'middle');
    return out;
  }
});
