MedicalMotion.register({
  id:'ecg-cycle',category:'Electrophysiology',title:'Read the electrical sequence',
  description:'A synthetic P-QRS-T waveform links labels to electrical events.',
  caption:'P: atrial depolarization. QRS: ventricular depolarization. T: ventricular repolarization. Electrical activity is not contraction itself.',
  keywords:['ECG','EKG','P wave','QRS','T wave','electrical'],
  stages:['Find the baseline','Follow P, QRS and T','Separate electricity and force'],
  limitations:'Synthetic, uncalibrated waveform, not a patient trace, diagnostic rhythm or clinical lead. Grid spacing has no mm, mV or paper-speed meaning.',
  sources:['https://openstax.org/books/anatomy-and-physiology-2e/pages/19-2-cardiac-muscle-and-electrical-activity'],
  params:{bpm:75,gain:1},parameterSchema:{bpm:{type:'number',min:40,max:160,step:5,description:'Cursor cycles per minute. This is an illustrative setting, not a normal-range recommendation.'},gain:{type:'number',min:0.5,max:1.25,step:0.05,description:'Visual amplitude multiplier; not mV calibration.'}},
  labels:{p:'Atrial depolarization',qrs:'Ventricular depolarization',t:'Ventricular repolarization'},
  render:function(c,p,t,S){
    const {C,rect,line,path,circle,text,wrap}=S;
    let out=rect(28,48,584,290,C.paper,18,{stroke:C.line,'stroke-width':2});
    for(let x=48;x<600;x+=20)out+=line(x,58,x,328,C.line,1,{opacity:.72});
    for(let y=68;y<330;y+=20)out+=line(38,y,602,y,C.line,1,{opacity:.72});
    out+=line(38,260,602,260,C.muted,2,{'stroke-dasharray':'7 8',opacity:.6});
    const wave=u=>260+c.params.gain*(-23*Math.exp(-Math.pow((u-.17)/.037,2))+15*Math.exp(-Math.pow((u-.37)/.014,2))-145*Math.exp(-Math.pow((u-.40)/.013,2))+38*Math.exp(-Math.pow((u-.43)/.018,2))-43*Math.exp(-Math.pow((u-.70)/.075,2)));
    const pts=Array.from({length:266},(_,i)=>[55+i*2,wave(i/265)]),scan=(t*c.params.bpm/60)%1,active=pts.filter(q=>q[0]<=55+530*scan);
    out+=path('M '+pts.map(q=>q.join(' ')).join(' L '),C.teal,2,'none',{opacity:.2});
    if(active.length>1)out+=path('M '+active.map(q=>q.join(' ')).join(' L '),C.teal,4);
    out+=line(55+530*scan,62,55+530*scan,327,C.gold,2)+circle(55+530*scan,wave(scan),7,C.gold);
    out+=text(145,211,'P',C.blue,24)+text(267,96,'QRS',C.red,24)+text(425,190,'T',C.teal,24);
    out+=text(320,30,'P–QRS–T  /  SYNTHETIC TRACE',C.muted,16,'middle',750);
    for(const [key,x,col] of [['p',122,C.blue],['qrs',320,C.red],['t',518,C.teal]])
      out+=rect(x-92,354,184,79,C.paper,16,{stroke:col,'stroke-width':2,opacity:.95})+text(x,378,key.toUpperCase(),col,19)+wrap(x,402,c.labels[key],C.ink,15,168,2,'middle');
    return out;
  }
});
