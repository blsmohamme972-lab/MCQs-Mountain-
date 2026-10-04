MedicalMotion.register({
  id:'action-potential',category:'Neurophysiology',title:'An action potential changes membrane voltage',
  description:'Trace resting state, depolarization, repolarization and the refractory period.',
  caption:'The waveform is an explanatory trace of electrical state; it is not a patient ECG and not a measured membrane recording.',
  keywords:['action potential','neuron','depolarization','repolarization','refractory','membrane voltage'],
  stages:['Start at rest','Cross the peak','Return through refractoriness'],
  limitations:'Ion-channel timing and voltage values are qualitative. No patch-clamp data or disease inference is shown.',
  sources:['https://www.ncbi.nlm.nih.gov/books/NBK538143/','https://openstax.org/books/anatomy-and-physiology-2e/pages/12-4-the-action-potential'],
  params:{speed:1},parameterSchema:{speed:{type:'number',min:0.25,max:2,step:0.25,description:'Waveform cursor speed multiplier only.'}},
  labels:{rest:'Resting state',up:'Depolarization',down:'Repolarization',ref:'Refractory period',voltage:'Relative membrane voltage'},
  render:function(c,p,t,S){
    const {C,line,path,text,circle,wrap}=S; let out='';
    out+=line(70,330,570,330,C.line,3)+line(70,90,70,330,C.line,3);
    const d='M 80 260 L 205 260 L 255 245 L 300 90 L 345 245 L 395 360 L 455 315 L 570 315';
    out+=path(d,C.blue,7,'none');
    const q=S.move([[80,260],[205,260],[255,245],[300,90],[345,245],[395,360],[455,315],[570,315]],p*c.params.speed%1);
    out+=circle(q[0],q[1],10,C.gold)+text(320,55,c.labels.voltage,C.muted,16,'middle',650);
    out+=text(150,290,c.labels.rest,C.ink,17,'middle',700)+text(300,78,c.labels.up,C.teal,17,'middle',700)+text(390,392,c.labels.down,C.red,17,'middle',700)+text(505,290,c.labels.ref,C.gold,17,'middle',700);
    out+=wrap(320,420,'Electrical event sequence only; the trace is not a clinical rhythm strip.',C.muted,15,510,1,'middle');
    return out;
  }
});
