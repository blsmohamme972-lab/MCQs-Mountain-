// Kafu MotionCards voice player (see voiceover/DESIGN.md): verified Opus bytes, played on the Play tap, voice is the master clock.
(function(root){
"use strict";
const API=root.KafuMotionCards=root.KafuMotionCards||{};
const PREF="kafu.motioncards.voice.muted",MAX_BYTES=64*1024,MIME="audio/ogg; codecs=opus";
const MAX_INTERP_MS=250;
function readMuted(){try{return root.localStorage?.getItem(PREF)==="1";}catch(_){return false;}}
function writeMuted(v){try{root.localStorage?.setItem(PREF,v?"1":"0");}catch(_){}}
function supported(mime=MIME){try{const a=root.document.createElement("audio");return !!a.canPlayType&&a.canPlayType(mime)!=="";}catch(_){return false;}}
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
    get position(){return a.currentTime*1000;},
    get paused(){return a.paused;},
    setMuted(v){a.muted=!!v;writeMuted(!!v);},
    play(ms){wanted=true;at(ms);if(!ended){const p=a.play();if(p&&p.catch)p.catch(()=>{wanted=false;});}},
    pause(ms){wanted=false;a.pause();at(ms);},
    seek(ms,playing){at(ms);if(playing&&!ended){wanted=true;const p=a.play();if(p&&p.catch)p.catch(()=>{});}},
    clock(perfMs){
      if(!audible())return perfMs;
      const t=a.currentTime*1000,n=now();
      if(t!==lastAudio){lastAudio=t;lastAt=n;}
      const est=lastAudio+Math.min(MAX_INTERP_MS,n-lastAt);
      if(Math.abs(est-perfMs)>1000)return perfMs;
      return est;
    },
    destroy(){wanted=false;try{a.pause();a.removeAttribute("src");a.load?.();}catch(_){}root.URL.revokeObjectURL(url);}
  };
}
API.voice={create,supported,MIME,MAX_BYTES,PREF};
})(globalThis);
