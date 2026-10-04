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
    let out=rect(35,60,570,268,C.paper,14,{stroke:C.line});
    for(let x=55;x<600;x+=20)out+=line(x,70,x,318,C.line,1);
    for(let y=78;y<325;y+=20)out+=line(45,y,595,y,C.line,1);
    const wave=u=>260+c.params.gain*(-23*Math.exp(-Math.pow((u-.17)/.037,2))+15*Math.exp(-Math.pow((u-.37)/.014,2))-145*Math.exp(-Math.pow((u-.40)/.013,2))+38*Math.exp(-Math.pow((u-.43)/.018,2))-43*Math.exp(-Math.pow((u-.70)/.075,2)));
    const pts=Array.from({length:266},(_,i)=>[55+i*2,wave(i/265)]),scan=(t*c.params.bpm/60)%1,active=pts.filter(q=>q[0]<=55+530*scan);
    out+=path('M '+pts.map(q=>q.join(' ')).join(' L '),C.teal,2,'none',{opacity:.28});
    if(active.length>1)out+=path('M '+active.map(q=>q.join(' ')).join(' L '),C.teal,4);
    out+=line(55+530*scan,76,55+530*scan,317,C.gold,2)+circle(55+530*scan,wave(scan),6,C.gold);
    out+=text(145,211,'P',C.blue,23)+text(267,96,'QRS',C.red,23)+text(425,190,'T',C.teal,23);
    for(const [key,x,col] of [['p',122,C.blue],['qrs',320,C.red],['t',518,C.teal]])out+=rect(x-92,350,184,83,C.paper,13,{stroke:C.line})+text(x,375,key.toUpperCase(),col,20)+wrap(x,400,c.labels[key],C.ink,16,168,2,'middle');
    out+=text(320,35,'SYNTHETIC / UNCALIBRATED',C.muted,17);
    return out;
  }
});
