/* Arcade-Clean game feel: tactile feedback only; sound is memory-only and off by default. */
globalThis.KafuEnhancements.installers.push({name:'arcade-clean-game-feel',install(){
  'use strict';
  let soundEnabled=false,audio=null;
  const haptic=(style='light')=>{
    try{
      const h=globalThis.Telegram?.WebApp?.HapticFeedback;
      if(h?.impactOccurred)h.impactOccurred(style);
    }catch(_){}
  };
  const tone=(kind='tap')=>{
    if(!soundEnabled)return;
    try{
      audio ||= new (globalThis.AudioContext||globalThis.webkitAudioContext)();
      const osc=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;
      const tones={tap:[520,.035],success:[720,.075],warning:[320,.07]};
      const [frequency,duration]=tones[kind]||tones.tap;
      osc.frequency.setValueAtTime(frequency,now);
      osc.type='sine';
      gain.gain.setValueAtTime(.0001,now);
      gain.gain.exponentialRampToValueAtTime(.035,now+.006);
      gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
      osc.connect(gain);gain.connect(audio.destination);osc.start(now);osc.stop(now+duration+.01);
    }catch(_){}
  };
  const keySelector='.btn,.tab,.opt,.qtool,.pill,button.k-chip';
  document.addEventListener('click',event=>{
    if(event.target.closest?.(keySelector)){haptic('light');tone('tap');}
  },{passive:true});
  globalThis.KafuGameFeel={
    haptic,tone,
    get soundEnabled(){return soundEnabled;},
    setSoundEnabled(value){soundEnabled=value===true;return soundEnabled;}
  };
}});
