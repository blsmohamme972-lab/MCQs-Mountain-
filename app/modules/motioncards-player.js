globalThis.KafuEnhancements.installers.push({name:"motioncards-player",install(){
"use strict";
const MC=globalThis.KafuMotionCards,Core=MC?.core;
if(!MC||!Core)throw new Error("motioncards_core_missing");
const POSITIVE_TTL=5*60_000,NEGATIVE_TTL=60_000,READY_TIMEOUT=5000;
const cache=new Map();
let active=null,lookupSerial=0;
const current=()=>{
  const qid=SESSION?.qids?.[SESSION.index],entry=qid&&QI[qid],q=entry?.q;
  if(!qid||!entry||!q||cur().v!=="study")return null;
  if(SESSION.mode==="exam"&&!SESSION.finished)return null;
  return{qid,entry,q};
};
const indexUrl=(entry,q)=>MC.CONTENT_BASE+"/indexes/"+encodeURIComponent(entry.b)+"/v"+encodeURIComponent(q.version)+"/index.json";
async function indexFor(entry,q){
  const key=String(entry.b)+":"+String(q.version),now=Date.now(),hit=cache.get(key);
  if(hit&&hit.until>now)return hit.value;
  try{
    const r=await fetch(indexUrl(entry,q),{cache:"no-cache",credentials:"omit",referrerPolicy:"no-referrer"});
    if(!r.ok){cache.set(key,{until:now+NEGATIVE_TTL,value:null});return null;}
    const data=await r.json();
    if(!data||data.schema!==1||String(data.book_id)!==String(entry.b)||Number(data.book_version)!==Number(q.version)||data.runtime_version!==MC.VERSION||data.protocol_version!==MC.PROTOCOL||!data.animations||typeof data.animations!=="object")throw new Error("motioncards_index_invalid");
    cache.set(key,{until:now+POSITIVE_TTL,value:data});return data;
  }catch(_){cache.set(key,{until:now+NEGATIVE_TTL,value:null});return null;}
}
async function resolveMatch(snapshot){
  const data=await indexFor(snapshot.entry,snapshot.q);if(!data)return null;
  const record=data.animations[snapshot.qid];if(!Core.validRecord(record,snapshot.q,snapshot.entry))return null;
  const hash=await Core.questionHash(snapshot.q);
  if(hash!==String(record.content_hash).toLowerCase())return null;
  return record;
}
function injectButton(snapshot,record){
  const now=current();if(!now||now.qid!==snapshot.qid||active)return;
  const section=document.querySelector(".k-study"),stem=section?.querySelector(".k-question-card .stem, .stem");
  if(!section||!stem||section.querySelector("[data-a='motioncards-open']"))return;
  const button=document.createElement("button");
  button.type="button";button.className="kafu-motioncards-trigger";button.dataset.a="motioncards-open";button.dataset.q=snapshot.qid;
  button.setAttribute("aria-label","Open Kafu MotionCards animation");
  button.innerHTML='<span class="kafu-motioncards-trigger-icon" aria-hidden="true">▶</span><span><strong>Kafu MotionCards</strong><small>Visual explanation</small></span>';
  stem.parentNode.insertBefore(button,stem);
  button._motioncardsRecord=record;
}
function refreshAvailability(){
  const snapshot=current();const serial=++lookupSerial;
  if(!snapshot||active)return;
  resolveMatch(snapshot).then(record=>{if(serial===lookupSerial&&record)injectButton(snapshot,record);}).catch(()=>{});
}
function ensureRoot(){
  let root=document.getElementById("kafu-motioncards-root");
  if(!root){root=document.createElement("div");root.id="kafu-motioncards-root";document.body.appendChild(root);}
  return root;
}
function randomChannel(){
  const bytes=new Uint8Array(18);crypto.getRandomValues(bytes);
  return Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");
}
function safeRecordFromButton(qid){
  const el=document.querySelector("[data-a='motioncards-open'][data-q='"+CSS.escape(qid)+"']");
  return el?._motioncardsRecord||null;
}
function setFinal(show){
  if(!active)return;
  const panel=active.root.querySelector(".kafu-motioncards-final");
  panel.hidden=!show;
}
function post(type,extra={}){
  if(!active?.port||!active.connected)return;
  active.port.postMessage({type,protocol:MC.PROTOCOL,channel_id:active.channel,qid:active.qid,...extra});
}
function sendTime(type="tick"){
  if(!active)return;
  const t=Math.max(0,Math.min(active.duration,active.time));
  post(type,{time_ms:t});active.range.value=String(t);active.timeLabel.textContent=(t/1000).toFixed(1)+" / "+(active.duration/1000).toFixed(1)+" s";
  setFinal(t>=active.duration);
}
function stopClock(){
  if(active?.raf)cancelAnimationFrame(active.raf);
  if(active)active.raf=0;
}
function frame(now){
  if(!active||!active.playing)return;
  active.time=Math.min(active.duration,Math.max(0,now-active.anchor));
  sendTime("tick");
  if(active.time>=active.duration){active.playing=false;active.play.textContent="Replay";active.play.setAttribute("aria-pressed","false");active.raf=0;return;}
  active.raf=requestAnimationFrame(frame);
}
function play(){
  if(!active||!active.connected)return;
  if(active.time>=active.duration){active.time=0;setFinal(false);post("restart",{time_ms:0});}
  active.playing=true;active.anchor=performance.now()-active.time;active.play.textContent="Pause";active.play.setAttribute("aria-pressed","true");
  post("play",{time_ms:active.time});stopClock();active.raf=requestAnimationFrame(frame);
}
function pause(){
  if(!active)return;
  if(active.playing){active.time=Math.min(active.duration,Math.max(0,performance.now()-active.anchor));}
  active.playing=false;stopClock();active.play.textContent=active.time>=active.duration?"Replay":"Play";active.play.setAttribute("aria-pressed","false");
  post("pause",{time_ms:active.time});sendTime("seek");
}
function restart(){
  if(!active)return;active.playing=false;stopClock();active.time=0;active.play.textContent="Play";active.play.setAttribute("aria-pressed","false");setFinal(false);post("restart",{time_ms:0});sendTime("seek");
}
function seek(value){
  if(!active)return;active.time=Math.max(0,Math.min(active.duration,Number(value)||0));if(active.playing)active.anchor=performance.now()-active.time;sendTime("seek");
}
function closePlayer(restore=true){
  if(!active)return;
  const a=active;active=null;lookupSerial++;stopClock();
  clearTimeout(a.readyTimer);
  try{a.port?.postMessage({type:"destroy",protocol:MC.PROTOCOL,channel_id:a.channel,qid:a.qid});a.port?.close();}catch(_){}
  window.removeEventListener("message",a.messageHandler);
  a.root.replaceChildren();a.root.hidden=true;
  document.body.classList.remove("kafu-motioncards-open");
  const app=document.getElementById("app");if(app){app.inert=false;app.removeAttribute("aria-hidden");}
  try{if(IN_TG&&mainBtnVisible===false&&ACTION&&!SHEET){TG.MainButton.setParams({text:ACTION.label,is_visible:true,is_active:ACTION.enabled});mainBtnVisible=true;}}catch(_){}
  if(restore){window.scrollTo(0,a.scrollY);a.focus?.focus?.({preventScroll:true});}
  refreshAvailability();
}
function fail(message){
  if(!active)return;pause();
  const state=active.root.querySelector(".kafu-motioncards-error");state.hidden=false;state.textContent=message;
}
function connectFromReady(event){
  if(!active||event.source!==active.frame.contentWindow)return;
  const m=event.data;
  if(!m||m.type!=="kafu-motioncards-ready"||m.protocol!==MC.PROTOCOL||m.qid!==active.qid||m.channel_id!==active.channel)return;
  if(active.connected)return;
  const channel=new MessageChannel();active.port=channel.port1;
  active.port.onmessage=e=>{
    const x=e.data;if(!Core.validMessage(x,active))return;
    if(x.type==="ready"){clearTimeout(active.readyTimer);active.connected=true;active.root.querySelector(".kafu-motioncards-loading").hidden=true;active.play.disabled=false;active.restart.disabled=false;active.range.disabled=false;sendTime("seek");}
    else if(x.type==="error")fail("This MotionCard could not render. You can close it and continue studying.");
  };
  active.port.start();
  active.frame.contentWindow.postMessage({type:"connect",protocol:MC.PROTOCOL,channel_id:active.channel,qid:active.qid},"*",[channel.port2]);
}
function openPlayer(qid,record){
  const snapshot=current();if(!snapshot||snapshot.qid!==qid||active)return;
  if(!record||!Core.validRecord(record,snapshot.q,snapshot.entry))return;
  const root=ensureRoot(),channel=randomChannel(),focus=document.activeElement,scrollY=window.scrollY;
  root.hidden=false;
  root.innerHTML='<div class="kafu-motioncards-overlay" role="dialog" aria-modal="true" aria-label="Kafu MotionCards">'+
    '<header class="kafu-motioncards-bar"><button type="button" class="kafu-motioncards-close" data-motioncards-host="close" aria-label="Close MotionCards">←</button><div><strong>Kafu MotionCards</strong><small>'+esc(snapshot.qid)+'</small></div></header>'+
    '<section class="kafu-motioncards-stage"><div class="kafu-motioncards-loading" role="status">Loading animation…</div><div class="kafu-motioncards-error" role="alert" hidden></div><iframe title="Kafu MotionCards animation" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe></section>'+
    '<section class="kafu-motioncards-final" hidden><strong>Takeaway</strong><p class="kafu-motioncards-takeaway"></p><strong>Correct answer</strong><div class="kafu-motioncards-answer"></div></section>'+
    '<footer class="kafu-motioncards-controls"><button type="button" data-motioncards-host="play" disabled aria-pressed="false">Play</button><button type="button" data-motioncards-host="restart" disabled>Restart</button><label><span class="sr-only">Animation position</span><input data-motioncards-host="seek" type="range" min="0" step="50" disabled></label><output data-motioncards-host="time"></output></footer></div>';
  const frameEl=root.querySelector("iframe"),playEl=root.querySelector("[data-motioncards-host='play']"),range=root.querySelector("[data-motioncards-host='seek']"),restartEl=root.querySelector("[data-motioncards-host='restart']"),timeLabel=root.querySelector("[data-motioncards-host='time']");
  range.max=String(record.duration_ms);
  root.querySelector(".kafu-motioncards-takeaway").textContent=String(record.final_panel?.takeaway||"");
  const answer=root.querySelector(".kafu-motioncards-answer");for(const text of record.final_panel?.correct_answer_statements||[]){const p=document.createElement("p");p.textContent=String(text);answer.appendChild(p);}
  active={qid,record,root,frame:frameEl,play:playEl,range,restart:restartEl,timeLabel,duration:record.duration_ms,time:0,playing:false,anchor:0,raf:0,channel,connected:false,focus,scrollY,messageHandler:connectFromReady,readyTimer:0};
  document.body.classList.add("kafu-motioncards-open");const app=document.getElementById("app");if(app){app.inert=true;app.setAttribute("aria-hidden","true");}
  window.addEventListener("message",connectFromReady);
  active.readyTimer=setTimeout(()=>fail("The animation did not become ready. Retry or close it and continue studying."),READY_TIMEOUT);
  frameEl.src=record.entry_url+"#"+channel;
  try{if(IN_TG){TG.MainButton.hide();mainBtnVisible=false;if(tgAt("6.1"))TG.BackButton.show();}}catch(_){}
  root.querySelector(".kafu-motioncards-close").focus();
}
ACTIONS["motioncards-open"]=(d,el)=>openPlayer(d.q,el?._motioncardsRecord||safeRecordFromButton(d.q));
const oldBack=back;back=function(...args){if(active){closePlayer();return;}return oldBack.apply(this,args);};
const oldRender=render;render=function(...args){
  const result=oldRender.apply(this,args),now=current();
  if(active&&(!now||now.qid!==active.qid)){closePlayer(false);}
  if(active){try{if(IN_TG){TG.MainButton.hide();mainBtnVisible=false;if(tgAt("6.1"))TG.BackButton.show();}}catch(_){}}
  else refreshAvailability();
  return result;
};
document.addEventListener("click",event=>{
  if(!active)return;
  const el=event.target.closest("[data-motioncards-host]");if(!el)return;
  const a=el.dataset.motioncardsHost;
  if(a==="close")closePlayer();else if(a==="play")(active.playing?pause:play)();else if(a==="restart")restart();
},true);
document.addEventListener("input",event=>{if(active&&event.target.matches("[data-motioncards-host='seek']"))seek(event.target.value);},true);
document.addEventListener("keydown",event=>{
  if(!active)return;
  if(event.key==="Escape"){event.preventDefault();event.stopImmediatePropagation();closePlayer();return;}
  if(event.key===" "){event.preventDefault();event.stopImmediatePropagation();(active.playing?pause:play)();return;}
},true);
MC.player={get active(){return active;},refresh:refreshAvailability,close:closePlayer,play,pause,seek,restart};
}});
