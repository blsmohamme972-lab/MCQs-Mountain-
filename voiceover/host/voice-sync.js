// Kafu MotionCards voice sync — host side (prototype for app/modules/motioncards-player.js; not wired in yet).
// Golden rule 7: the voice is the master clock while it plays, so picture and sound cannot drift apart.
// The card iframe never plays media (its CSP stays media-src 'none'); it hands the Opus bytes to the host,
// and the host plays them on the student's own Play tap (the gesture Telegram/iOS require for sound).
(function(root){
"use strict";
const API=root.KafuMotionCards=root.KafuMotionCards||{};
const PREF="kafu.motioncards.voice.muted",MAX_BYTES=64*1024,MIME="audio/ogg; codecs=opus";
const MAX_INTERP_MS=250;   // never extrapolate the audio clock further than this past its last real update
const DRIFT_MS=60;         // re-seek the audio if it is this far from where the timeline says it should be

function readMuted(){try{return root.localStorage?.getItem(PREF)==="1";}catch(_){return false;}}
function writeMuted(v){try{root.localStorage?.setItem(PREF,v?"1":"0");}catch(_){}}
function supported(mime=MIME){try{const a=root.document.createElement("audio");return !!a.canPlayType&&a.canPlayType(mime)!=="";}catch(_){return false;}}

// bytes: ArrayBuffer of the card's Opus track (verified by the caller against the manifest SHA-256).
// opts.audio: an HTMLAudioElement factory (tests inject a fake); opts.now: performance.now.
function create(bytes,opts={}){
  if(!(bytes instanceof ArrayBuffer)||bytes.byteLength===0||bytes.byteLength>MAX_BYTES)throw new Error("voice_bytes_invalid");
  const mime=opts.mime||MIME,now=opts.now||(()=>root.performance.now());
  const a=(opts.audio||(()=>root.document.createElement("audio")))();
  const url=root.URL.createObjectURL(new root.Blob([bytes],{type:mime}));
  a.preload="auto";a.src=url;a.muted=readMuted();
  let wanted=false,lastAudio=-1,lastAt=0,ended=false;
  a.addEventListener?.("ended",()=>{ended=true;});
  const audible=()=>wanted&&!a.paused&&!ended&&a.readyState>=2;
  function at(ms){try{a.currentTime=Math.max(0,ms)/1000;}catch(_){}lastAudio=-1;ended=ms/1000>=(a.duration||Infinity);}
  return{
    mime,
    get muted(){return a.muted;},
    setMuted(v){a.muted=!!v;writeMuted(!!v);},
    // Call inside the Play click handler (keeps the user gesture for autoplay rules).
    play(ms){wanted=true;at(ms);if(!ended){const p=a.play();if(p&&p.catch)p.catch(()=>{wanted=false;});}},
    pause(ms){wanted=false;a.pause();at(ms);},
    seek(ms,playing){at(ms);if(playing&&!ended){wanted=true;const p=a.play();if(p&&p.catch)p.catch(()=>{});}},
    // Timeline time for this frame. perfMs is the host's own clock reading (now - anchor).
    // While the voice is audible the audio position leads; between its coarse updates we interpolate.
    clock(perfMs){
      if(!audible())return perfMs;
      const t=a.currentTime*1000,n=now();
      if(t!==lastAudio){lastAudio=t;lastAt=n;}
      const est=lastAudio+Math.min(MAX_INTERP_MS,n-lastAt);
      if(Math.abs(est-perfMs)>1000)return perfMs;        // audio stuck far behind (e.g. decode stall): don't jump the picture back
      return est;
    },
    // Optional guard when the timeline is the master (e.g. voice muted but still loaded): keep audio aligned.
    align(ms){if(audible()&&Math.abs(a.currentTime*1000-ms)>DRIFT_MS)at(ms);},
    destroy(){wanted=false;try{a.pause();a.removeAttribute("src");a.load?.();}catch(_){}root.URL.revokeObjectURL(url);}
  };
}
API.voice={create,supported,MIME,MAX_BYTES,PREF};
})(globalThis);
