globalThis.KafuEnhancements.installers.push({name:"motioncards-player",install(){
"use strict";
const MC=globalThis.KafuMotionCards,Core=MC?.core;
if(!MC||!Core)throw new Error("motioncards_core_missing");
const POSITIVE_TTL=30_000,NEGATIVE_TTL=15_000,READY_TIMEOUT=5000,REFRESH_AFTER=35_000;
const refreshAfter=()=>Number.isFinite(Number(MC.REFRESH_AFTER_MS))?Math.max(100,Number(MC.REFRESH_AFTER_MS)):REFRESH_AFTER;
const cache=new Map();
let active=null,lookupSerial=0,refreshTimer=0,nextSessionId=1,lastSessionObject=null,lastSessionToken="none";
const accountKey=()=>IN_TG&&TG?.initDataUnsafe?.user?.id!=null?"tg:"+String(TG.initDataUnsafe.user.id):IN_TG?"tg:session":"browser";
const sessionKey=()=>{
  if(typeof SESSION==="undefined"||!SESSION||typeof SESSION!=="object"){lastSessionObject=null;lastSessionToken="none";return lastSessionToken;}
  if(SESSION!==lastSessionObject){lastSessionObject=SESSION;lastSessionToken="s"+nextSessionId++;}
  return lastSessionToken;
};
const current=()=>{
  let route=null;
  try{route=typeof cur==="function"?cur():null;}catch(_){return null;}
  if(typeof SESSION==="undefined"||typeof QI==="undefined")return null;
  const qid=SESSION?.qids?.[SESSION.index],entry=qid&&QI[qid],q=entry?.q;
  if(!qid||!entry||!q||route?.v!=="study")return null;
  if(SESSION.mode==="exam"&&!SESSION.finished)return null;
  return{qid,entry,q,account:accountKey(),session:sessionKey(),book_id:String(entry.b),book_version:Number(q.version),chapter_id:String(entry.ch)};
};
const sameIdentity=(a,b)=>!!a&&!!b&&a.qid===b.qid&&a.account===b.account&&a.session===b.session&&a.book_id===b.book_id&&a.book_version===b.book_version&&a.chapter_id===b.chapter_id;
const indexUrl=(entry,q)=>MC.CONTENT_BASE+"/indexes/"+encodeURIComponent(entry.b)+"/v"+encodeURIComponent(q.version)+"/index.json";
async function indexFor(entry,q){
  const key=String(entry.b)+":"+String(q.version),now=Date.now(),hit=cache.get(key);
  if(hit&&hit.until>now)return hit.value;
  try{
    const r=await fetch(indexUrl(entry,q),{cache:"no-cache",credentials:"omit",referrerPolicy:"no-referrer"});
    if(!r.ok)throw new Error("motioncards_index_http");
    const data=await r.json();if(!okIndex(data,entry,q))throw new Error("motioncards_index_invalid");
    cache.set(key,{until:now+POSITIVE_TTL,value:data});return data;
  }catch(_){
    let saved;try{const hit=await(await store()).match(indexUrl(entry,q));saved=hit&&await hit.json();}catch(_){}   // offline: the copy saved with the chapter
    saved=okIndex(saved,entry,q)?saved:undefined;cache.set(key,{until:now+NEGATIVE_TTL,value:saved});return saved;
  }
}
const okIndex=(d,entry,q)=>!!d&&d.schema===1&&String(d.book_id)===String(entry.b)&&Number(d.book_version)===Number(q.version)&&d.runtime_version===MC.VERSION&&d.protocol_version===MC.PROTOCOL&&!!d.animations&&typeof d.animations==="object";
// Cards on the device (voice is inside each card): saved with the chapter or on first play, used only if the bytes match the index SHA-256.
const STORE="kafu-motioncards-v1",HEAD='<!doctype html><html><head><meta charset="utf-8">';
const CSP='<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; font-src \'none\'; connect-src \'none\'; media-src \'none\'; object-src \'none\'; frame-src \'none\'; worker-src \'none\'; form-action \'none\'; base-uri \'none\'">';
const store=()=>typeof caches==="object"?caches.open(STORE):Promise.reject(new Error("no_cache_storage"));
const hexOf=async b=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",b))].map(x=>x.toString(16).padStart(2,"0")).join("");
async function cardBytes(record,chapter){
  const c=await store(),url=record.entry_url,want=String(record.entry_sha256).toLowerCase(),hit=await c.match(url);
  let b=hit&&await hit.arrayBuffer();if(b&&await hexOf(b)===want)return b;
  const r=await fetch(url,{credentials:"omit",referrerPolicy:"no-referrer"});if(!r.ok)throw new Error("card_http");
  b=await r.arrayBuffer();if(b.byteLength>4194304||await hexOf(b)!==want)throw new Error("card_sha256");
  await c.put(url,new Response(b,{headers:{"content-type":"text/html","x-kafu-chapter":chapter}}));return b;
}
async function dropCards(chapter,keep=new Set()){
  const c=await store();for(const req of await c.keys()){const m=await c.match(req);if(m?.headers.get("x-kafu-chapter")===chapter&&!keep.has(req.url))await c.delete(req);}
}
async function saveCards(key,pack){
  const q=pack?.questions?.[0];if(!q)return;
  const entry={b:pack.book_id,ch:pack.chapter_id},data=await indexFor(entry,q);if(!data)return;
  const qs=new Map(pack.questions.map(x=>[x.id,x])),keep=new Set();
  for(const r of Object.values(data.animations))if(qs.has(r?.qid)&&Core.validRecord(r,qs.get(r.qid),entry)){keep.add(r.entry_url);try{await cardBytes(r,key);}catch(_){}}
  const c=await store();await c.put(indexUrl(entry,q),new Response(JSON.stringify(data),{headers:{"content-type":"application/json","x-kafu-chapter":key}}));keep.add(new URL(indexUrl(entry,q)).href);
  await dropCards(key,keep);
}
async function resolveMatch(snapshot){
  const data=await indexFor(snapshot.entry,snapshot.q);if(!data)return data;   // undefined: index unreachable right now
  const record=data.animations[snapshot.qid];if(!Core.validRecord(record,snapshot.q,snapshot.entry))return null;
  const hash=await Core.questionHash(snapshot.q);
  if(hash!==String(record.content_hash).toLowerCase())return null;
  return record;
}
function buttonFor(qid){if(!Core.QID.test(String(qid||"")))return null;return document.querySelector("[data-a='motioncards-open'][data-q='"+String(qid)+"']");}
function clearButton(qid){buttonFor(qid)?.remove();}
function injectButton(snapshot,record){
  const now=current();if(!sameIdentity(now,snapshot)||active)return;
  const section=document.querySelector(".k-study"),stem=section?.querySelector(".k-question-card .stem, .stem");
  if(!section||!stem)return;
  const anchor=section.querySelector(".k-question-head")||stem.closest(".k-question-card");
  if(!anchor||anchor.parentNode!==section)return;
  let button=buttonFor(snapshot.qid);
  if(!button){
    button=document.createElement("button");button.type="button";button.className="kafu-motioncards-trigger";button.dataset.a="motioncards-open";button.dataset.q=snapshot.qid;
    button.setAttribute("aria-label","Open Kafu MotionCards animation");
    button.innerHTML='<span class="kafu-motioncards-trigger-icon" aria-hidden="true">▶</span><span><strong>Kafu MotionCards</strong><small>Visual explanation</small></span>';
  }
  if(button.parentNode!==section||button.nextElementSibling!==anchor)section.insertBefore(button,anchor);
  button._motioncardsRecord=record;
}
function scheduleAvailability(){
  clearTimeout(refreshTimer);refreshTimer=0;
  if(!active&&current())refreshTimer=setTimeout(()=>{cache.clear();refreshAvailability();},refreshAfter());
}
function refreshAvailability(){
  const snapshot=current(),serial=++lookupSerial;
  clearTimeout(refreshTimer);refreshTimer=0;
  if(!snapshot||active)return;
  resolveMatch(snapshot).then(async record=>{
    if(serial!==lookupSerial)return;
    const now=current();if(!sameIdentity(now,snapshot))return;
    if(record===undefined){scheduleAvailability();return;}   // a network blip keeps the button; only a fresh index removes it
    if(!record){clearButton(snapshot.qid);scheduleAvailability();return;}
    const currentHash=await Core.questionHash(now.q);
    if(serial!==lookupSerial||!sameIdentity(current(),snapshot)||currentHash!==String(record.content_hash).toLowerCase()){clearButton(snapshot.qid);return;}
    injectButton(snapshot,record);scheduleAvailability();
  }).catch(()=>{clearButton(snapshot.qid);scheduleAvailability();});
}
function ensureRoot(){
  let root=document.getElementById("kafu-motioncards-root");
  if(!root){root=document.createElement("div");root.id="kafu-motioncards-root";document.body.appendChild(root);}
  return root;
}
function randomChannel(){const bytes=new Uint8Array(18);crypto.getRandomValues(bytes);return Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");}
function safeRecordFromButton(qid){return buttonFor(qid)?._motioncardsRecord||null;}
function setFinal(show){if(active)active.root.querySelector(".kafu-motioncards-final").hidden=!show;}
function post(type,extra={}){
  if(!active?.port||!active.connected)return;
  active.port.postMessage({type,protocol:MC.PROTOCOL,channel_id:active.channel,qid:active.qid,...extra});
}
function sendTime(type="tick"){
  if(!active)return;const t=Math.max(0,Math.min(active.duration,active.time));
  post(type,{time_ms:t});active.range.value=String(t);
  active.range.style.setProperty("--kafu-motioncards-progress",String(active.duration>0?(t/active.duration)*100:0)+"%");
  const rangeText=(t/1000).toFixed(1)+" of "+(active.duration/1000).toFixed(1)+" seconds";
  if(active.range.getAttribute("aria-valuetext")!==rangeText)active.range.setAttribute("aria-valuetext",rangeText);
  active.timeLabel.textContent=(t/1000).toFixed(1)+" / "+(active.duration/1000).toFixed(1)+" s";setFinal(t>=active.duration);
}
function stopClock(a=active){if(a?.raf)cancelAnimationFrame(a.raf);if(a)a.raf=0;}
function frame(now){
  if(!active||!active.playing)return;
  let t=now-active.anchor;
  if(active.voice){t=active.voice.clock(t);active.anchor=now-t;}   // voice is the master clock while it plays
  active.time=Math.min(active.duration,Math.max(0,t));sendTime("tick");
  if(active.time>=active.duration){active.playing=false;active.voice?.pause(active.duration);active.play.textContent="Replay";active.play.setAttribute("aria-pressed","false");active.raf=0;return;}
  active.raf=requestAnimationFrame(frame);
}
function play(){
  if(!active||!active.connected)return;
  if(active.time>=active.duration){active.time=0;setFinal(false);post("restart",{time_ms:0});}
  active.playing=true;active.anchor=performance.now()-active.time;active.play.textContent="Pause";active.play.setAttribute("aria-pressed","true");
  post("play",{time_ms:active.time});active.voice?.play(active.time);stopClock();active.raf=requestAnimationFrame(frame);
}
function pause(){
  if(!active)return;
  if(active.playing)active.time=Math.min(active.duration,Math.max(0,performance.now()-active.anchor));
  active.playing=false;stopClock();active.play.textContent=active.time>=active.duration?"Replay":"Play";active.play.setAttribute("aria-pressed","false");
  post("pause",{time_ms:active.time});active.voice?.pause(active.time);sendTime("seek");
}
function restart(){
  if(!active)return;active.playing=false;stopClock();active.time=0;active.play.textContent="Play";active.play.setAttribute("aria-pressed","false");setFinal(false);post("restart",{time_ms:0});active.voice?.pause(0);sendTime("seek");
}
function seek(value){if(!active)return;active.time=Math.max(0,Math.min(active.duration,Number(value)||0));if(active.playing)active.anchor=performance.now()-active.time;active.voice?.seek(active.time,active.playing);sendTime("seek");}
function restoreTelegram(a){
  try{
    if(!IN_TG)return;
    if(a.mainWasVisible&&ACTION&&!SHEET){TG.MainButton.setParams({text:ACTION.label,is_visible:true,is_active:ACTION.enabled});mainBtnVisible=true;}else if(!a.mainWasVisible){TG.MainButton.hide();mainBtnVisible=false;}
    if(tgAt("6.1")){if(a.backWasVisible)TG.BackButton.show();else TG.BackButton.hide();}
  }catch(_){}
}
function closePlayer(restore=true){
  if(!active)return;
  const a=active;stopClock(a);clearTimeout(a.readyTimer);clearTimeout(a.loadWait);a.pending=0;dropVoice(a);dropBlob(a);
  try{a.port?.postMessage({type:"destroy",protocol:MC.PROTOCOL,channel_id:a.channel,qid:a.qid});a.port?.close();}catch(_){}
  window.removeEventListener("message",a.messageHandler);try{a.frame.src="about:blank";}catch(_){}active=null;lookupSerial++;
  a.root.replaceChildren();a.root.hidden=true;document.body.classList.remove("kafu-motioncards-open");
  const app=document.getElementById("app");if(app){app.inert=false;app.removeAttribute("aria-hidden");}
  restoreTelegram(a);
  if(restore){window.scrollTo(0,a.scrollY);a.focus?.focus?.({preventScroll:true});}
  scheduleAvailability();refreshAvailability();
}
function fail(message){
  if(!active)return;pause();
  const box=active.root.querySelector(".kafu-motioncards-error"),text=box.querySelector("[data-motioncards-error-text]");
  text.textContent=message;box.hidden=false;active.root.querySelector("[data-motioncards-host='retry']").hidden=false;
}
// Voice-over (voiceover/): the card hands over its Opus bytes; play them only if they match the index exactly.
function dropVoice(a){if(a?.voice){try{a.voice.destroy();}catch(_){}a.voice=null;}const b=a?.root?.querySelector("[data-motioncards-host='mute']");if(b)b.hidden=true;}
function muteButton(){return active?.root.querySelector("[data-motioncards-host='mute']");}
function paintMute(){const b=muteButton();if(!b||!active?.voice)return;const m=active.voice.muted;b.hidden=false;b.setAttribute("aria-pressed",m?"true":"false");b.textContent=m?"Unmute voice":"Mute voice";}
function toggleMute(){if(!active?.voice)return;active.voice.setMuted(!active.voice.muted);paintMute();}
async function acceptVoice(x,channel){
  const want=active?.record?.voice,V=MC.voice;
  if(!want||!V||active.voice||!(x.data instanceof ArrayBuffer)||x.mime!==want.mime||x.data.byteLength!==Number(want.bytes)||!V.supported(want.mime))return;
  let hex="";
  try{const d=await crypto.subtle.digest("SHA-256",x.data);hex=[...new Uint8Array(d)].map(v=>v.toString(16).padStart(2,"0")).join("");}catch(_){return;}
  if(!active||active.channel!==channel||active.voice||hex!==String(want.sha256).toLowerCase())return;
  try{active.voice=V.create(x.data,{mime:want.mime});}catch(_){active.voice=null;return;}
  paintMute();if(active.playing)active.voice.play(active.time);
}
function connectFromReady(event){
  if(!active||event.source!==active.frame.contentWindow)return;
  const m=event.data;if(!m||m.type!=="kafu-motioncards-ready"||m.protocol!==MC.PROTOCOL||m.qid!==active.qid||m.channel_id!==active.channel)return;
  if(active.connected||active.port||active.pending)return;
  // The card says ready before its voice script has run; connect only once its document has fully loaded.
  const a=active,go=()=>{if(active===a&&a.pending){a.pending=0;clearTimeout(a.loadWait);connectPort();}};
  a.pending=go;if(a.loaded)go();else a.loadWait=setTimeout(go,3000);
}
function connectPort(){
  const channel=new MessageChannel(),expectedChannel=active.channel;active.port=channel.port1;
  active.port.onmessage=e=>{
    if(!active||active.channel!==expectedChannel)return;
    const x=e.data;if(!Core.validMessage(x,active))return;
    if(x.type==="ready"){clearTimeout(active.readyTimer);active.connected=true;active.root.querySelector(".kafu-motioncards-loading").hidden=true;active.root.querySelector(".kafu-motioncards-error").hidden=true;active.play.disabled=false;active.restart.disabled=false;active.range.disabled=false;sendTime("seek");}
    else if(x.type==="error")fail("This MotionCard could not render. Retry or close it and continue studying.");
    else if(x.type==="voice")acceptVoice(x,expectedChannel);
  };
  active.port.start();
  active.frame.contentWindow.postMessage({type:"connect",protocol:MC.PROTOCOL,channel_id:active.channel,qid:active.qid},"*",[channel.port2]);
}
function dropBlob(a){if(a?.blob){URL.revokeObjectURL(a.blob);a.blob=null;}}
function loadFrame(){
  if(!active)return;
  clearTimeout(active.readyTimer);try{active.port?.close();}catch(_){}
  dropVoice(active);active.port=null;active.connected=false;active.channel=randomChannel();active.loadAttempt=(active.loadAttempt||0)+1;active.play.disabled=true;active.restart.disabled=true;active.range.disabled=true;
  active.root.querySelector(".kafu-motioncards-loading").hidden=false;active.root.querySelector(".kafu-motioncards-error").hidden=true;
  active.readyTimer=setTimeout(()=>fail("The animation did not become ready. Retry or close it and continue studying."),READY_TIMEOUT);
  const target=new URL(active.record.entry_url);
  if(active.loadAttempt>1)target.searchParams.set("motioncards_retry",active.channel);
  const a=active,c=a.channel;a.loaded=false;a.pending=0;clearTimeout(a.loadWait);a.frame.onload=()=>{if(active===a&&a.channel===c){a.loaded=true;if(a.pending)a.pending();}};
  target.hash=active.channel;dropBlob(a);
  cardBytes(a.record,a.book_id+":"+a.chapter_id).then(b=>{
    const html=new TextDecoder().decode(b);if(!html.startsWith(HEAD))throw new Error("card_head");
    if(active!==a||a.channel!==c)return;a.blob=URL.createObjectURL(new Blob([HEAD+CSP+html.slice(HEAD.length)],{type:"text/html"}));a.frame.src=a.blob+"#"+c;
  }).catch(()=>{if(active===a&&a.channel===c)a.frame.src=target.href;});
}
function openPlayer(qid,record,providedSnapshot=null,standalone=false){
  const snapshot=providedSnapshot||current();
  if(!snapshot||snapshot.qid!==qid||active)return;
  if(!record||!Core.validRecord(record,snapshot.q,snapshot.entry))return;
  const root=ensureRoot(),focus=document.activeElement,scrollY=window.scrollY;
  root.hidden=false;
  root.innerHTML='<div class="kafu-motioncards-overlay" role="dialog" aria-modal="true" aria-label="Kafu MotionCards">'+
    '<header class="kafu-motioncards-bar"><button type="button" class="kafu-motioncards-close" data-motioncards-host="close" aria-label="Close MotionCards">←</button><div><strong>Kafu MotionCards</strong><small>'+esc(snapshot.qid)+'</small></div></header>'+
    '<div class="kafu-motioncards-scroll"><div class="kafu-motioncards-main">'+
      '<section class="kafu-motioncards-stage"><iframe title="Kafu MotionCards animation" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe></section>'+
      '<div class="kafu-motioncards-status"><div class="kafu-motioncards-error" role="alert" hidden><span data-motioncards-error-text></span><button type="button" data-motioncards-host="retry">Retry</button></div><div class="kafu-motioncards-loading" role="status">Loading animation…</div></div>'+
      '<footer class="kafu-motioncards-controls"><button type="button" data-motioncards-host="play" disabled aria-pressed="false">Play</button><button type="button" data-motioncards-host="restart" disabled>Restart</button><button type="button" data-motioncards-host="mute" hidden aria-pressed="false">Mute voice</button><label><span class="sr-only">Animation position</span><input data-motioncards-host="seek" type="range" min="0" step="50" disabled></label><output data-motioncards-host="time" aria-live="off"></output></footer>'+
    '</div><div class="kafu-motioncards-final-slot" aria-live="polite" aria-atomic="true"><section class="kafu-motioncards-final" hidden><strong>Takeaway</strong><p class="kafu-motioncards-takeaway"></p><strong>Correct answer</strong><div class="kafu-motioncards-answer"></div></section><div class="kafu-motioncards-final-placeholder" aria-hidden="true"><strong>Takeaway</strong><p>Your takeaway and correct answer appear here when the animation finishes.</p></div></div></div></div>';
  const frameEl=root.querySelector("iframe"),playEl=root.querySelector("[data-motioncards-host='play']"),range=root.querySelector("[data-motioncards-host='seek']"),restartEl=root.querySelector("[data-motioncards-host='restart']"),timeLabel=root.querySelector("[data-motioncards-host='time']");
  range.max=String(record.duration_ms);root.querySelector(".kafu-motioncards-takeaway").textContent=String(record.final_panel?.takeaway||"");
  const answer=root.querySelector(".kafu-motioncards-answer");for(const text of record.final_panel?.correct_answer_statements||[]){const p=document.createElement("p");p.textContent=String(text);answer.appendChild(p);}
  active={qid,record,root,frame:frameEl,play:playEl,range,restart:restartEl,timeLabel,duration:record.duration_ms,time:0,playing:false,anchor:0,raf:0,channel:"",connected:false,focus,scrollY,
    messageHandler:connectFromReady,readyTimer:0,account:snapshot.account,session:snapshot.session,book_id:snapshot.book_id,book_version:snapshot.book_version,chapter_id:snapshot.chapter_id,contentHash:String(record.content_hash).toLowerCase(),standalone,
    mainWasVisible:!!mainBtnVisible,backWasVisible:!!(IN_TG&&TG.BackButton?.isVisible)};
  document.body.classList.add("kafu-motioncards-open");clearTimeout(refreshTimer);
  const app=document.getElementById("app");if(app){app.inert=true;app.setAttribute("aria-hidden","true");}
  window.addEventListener("message",connectFromReady);loadFrame();
  try{if(IN_TG){TG.MainButton.hide();mainBtnVisible=false;if(tgAt("6.1"))TG.BackButton.show();}}catch(_){}
  root.querySelector(".kafu-motioncards-close").focus();
}
async function openTrustedPreview(qid){
  try{
    for(let i=0;i<30&&!CATALOG;i++)await sleep(100);
    const route=await resolveQuestionRoute(qid);if(!route)throw new Error("route_missing");
    const bookId=String(route.book_id||route.b||""),book=bookById(bookId);if(!book)throw new Error("book_missing");
    let chId=route.chapter_id??route.ch;
    if(chId==null){const meta=book.chapters.find(ch=>Array.isArray(ch.qids)&&ch.qids.includes(qid));chId=meta?.id;}
    if(chId==null)throw new Error("chapter_missing");
    const pack=await fetchPack(bookId,chId),q=(pack.questions||[]).find(x=>x.id===qid);if(!q)throw new Error("question_missing");
    const snapshot={qid,q,entry:{q,b:bookId,ch:chId},account:accountKey(),book_id:bookId,book_version:Number(q.version),chapter_id:String(chId)};
    const record=await resolveMatch(snapshot);if(!record)throw new Error("motioncard_unavailable");
    openPlayer(qid,record,snapshot,true);
  }catch(_){toast("MotionCard preview is unavailable or no longer compatible.");}
}
ACTIONS["motioncards-open"]=(d,el)=>openPlayer(d.q,el?._motioncardsRecord||safeRecordFromButton(d.q));
const oldBack=back;back=function(...args){if(active){closePlayer();return;}return oldBack.apply(this,args);};
const oldRender=render;render=function(...args){
  const result=oldRender.apply(this,args),now=current();
  if(active&&!active.standalone){
    if(!sameIdentity(now,active)){closePlayer(false);}
    else Core.questionHash(now.q).then(hash=>{if(active&&!active.standalone&&hash!==active.contentHash)closePlayer(false);}).catch(()=>closePlayer(false));
  }
  if(active){try{if(IN_TG){TG.MainButton.hide();mainBtnVisible=false;if(tgAt("6.1"))TG.BackButton.show();}}catch(_){}}
  else refreshAvailability();
  return result;
};
document.addEventListener("click",event=>{
  if(!active)return;const el=event.target.closest("[data-motioncards-host]");if(!el)return;
  const a=el.dataset.motioncardsHost;
  if(a==="close")closePlayer();else if(a==="mute")toggleMute();else if(a==="play")(active.playing?pause:play)();else if(a==="restart")restart();else if(a==="retry"){restart();loadFrame();}
},true);
document.addEventListener("input",event=>{if(active&&event.target.matches("[data-motioncards-host='seek']"))seek(event.target.value);},true);
document.addEventListener("keydown",event=>{
  if(!active)return;
  if(event.key==="Escape"){event.preventDefault();event.stopImmediatePropagation();closePlayer();return;}
  if(event.key==="Tab"){
    const focusable=[...active.root.querySelectorAll("button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex='-1'])")].filter(x=>!x.hidden);
    if(focusable.length){const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
    return;
  }
  if(event.key===" "){
    const target=event.target,tag=target?.tagName;
    if(["BUTTON","INPUT","TEXTAREA","SELECT","A"].includes(tag)||target?.isContentEditable)return;
    event.preventDefault();event.stopImmediatePropagation();(active.playing?pause:play)();
  }
},true);
document.addEventListener("visibilitychange",()=>{if(document.hidden&&active?.playing)pause();});
window.addEventListener("pagehide",()=>{if(active?.playing)pause();});
const D=globalThis.KafuDownloads?.manager?.io;
if(D){const show=D.show;D.show=(key,pack)=>{show(key,pack);if(pack?._offline_complete)saveCards(key,pack).catch(()=>{});};}
if(typeof deleteChapter==="function"){const del=deleteChapter;deleteChapter=async key=>{const out=await del(key);await dropCards(key).catch(()=>{});return out;};}
MC.player={get active(){return active;},saveCards,refresh:refreshAvailability,close:closePlayer,play,pause,seek,restart,retry:loadFrame,openTrustedPreview,productionRefreshWindowMs:REFRESH_AFTER};
scheduleAvailability();refreshAvailability();
const previewQid=typeof location!=="undefined"&&location?.href?new URL(location.href).searchParams.get("motioncards_preview"):null;
if(Core.QID.test(String(previewQid||"")))setTimeout(()=>openTrustedPreview(String(previewQid)),0);
}});