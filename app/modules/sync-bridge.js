/* Bridge the tested replica to Kafu's existing state, sessions and views. */
globalThis.KafuEnhancements.installers.push({name:"personal-sync",install(){
  "use strict";
  const Core=globalThis.KafuSyncCore, clone=value=>JSON.parse(JSON.stringify(value));
  let replica=null,client=null,projected=null,applying=false,timer=null,lastFlush=0,initializing=null,unavailable=false;
  let channel=null,forked=false;
  const originalSave=saveState,originalGet=DB.get.bind(DB),originalPut=DB.put.bind(DB);
  const owner=IN_TG&&Number.isSafeInteger(TG.initDataUnsafe?.user?.id)?String(TG.initDataUnsafe.user.id):"browser";
  const stateKey="state_user_"+owner,tabId=Core.randomId(),openedAt=Date.now();
  DB.get=async function(store,key){
    if(store!=="meta"||key!=="state")return originalGet(store,key);
    const own=await originalGet("meta",stateKey);if(own)return own;
    const legacyOwner=await originalGet("meta","legacy_state_owner");if(legacyOwner&&legacyOwner!==owner)return undefined;
    const old=await originalGet("meta","state");
    if(old){await originalPut("meta","legacy_state_owner",owner);await originalPut("meta",stateKey,old);}return old;
  };
  DB.put=function(store,key,value){return originalPut(store,store==="meta"&&key==="state"?stateKey:key,value);};
  const historyPrefix="answer_event_"+owner+"_";
  const sameResume=(a,b)=>(!a&&!b)||(a&&b&&a.b===b.b&&String(a.ch)===String(b.ch)&&a.q===b.q);
  const stringify=value=>JSON.stringify(value||null);
  const publicStatus=()=>unavailable?"unavailable":(client?.status||(replica?"local-only":"starting"));
  const labels={starting:"Starting",pending:"Changes saved on this device; sync pending",syncing:"Syncing with Telegram",synced:"Synced with Telegram",
    partial:"A cloud snapshot is incomplete; local progress is safe",offline:"Saved on this device — will sync when available","local-only":"Saved on this device; Telegram sync unavailable",
    capacity:"Cloud backup is full; all progress remains on this device",unavailable:"Sync could not read this device's backup format; existing progress is preserved"};
  function apply(){
    if(!replica)return;applying=true;const priorEpoch=projected?.epoch||0;projected=replica.project();
    // Keep the comparison snapshot separate from arrays/objects mutated by the UI.
    for(const key of ["answers","fav","favBooks","resume","time","active","fsrs"])S[key]=clone(projected[key]);
    S.settings=Object.assign(S.settings||{},projected.settings);S.sync_v2=replica.export();applying=false;originalSave();
    if(projected.epoch>priorEpoch){const epoch=projected.epoch;DB.all("meta").then(rows=>Promise.all(rows.filter(([key,value])=>String(key).startsWith(historyPrefix)&&value?.at<=epoch).map(([key])=>DB.del("meta",key)))).catch(()=>{});}
  }
  function capture(){
    if(!replica||!projected||applying)return;
    for(const [key,kind]of[["fav","question"],["favBooks","book"]]){
      const before=new Set(projected[key]),after=new Set(S[key]||[]);
      for(const id of before)if(!after.has(id))replica.favorite(kind,id,false);
      for(const id of after)if(!before.has(id))replica.favorite(kind,id,true);
    }
    for(const [day,seconds]of Object.entries(S.time||{})){const delta=Math.floor(seconds-(projected.time[day]||0));if(delta>0)replica.addTime(day,delta);}
    if(!sameResume(S.resume,projected.resume))replica.setResume(S.resume||null);
    for(const [qid,card]of Object.entries(S.fsrs||{}))if(stringify(card)!==stringify(projected.fsrs[qid]))replica.setFSRS(qid,card);
    if(S.settings?.fs!==projected.settings.fs)replica.preference("fs",S.settings.fs);
    apply();
  }
  function announce(){try{channel?.postMessage({actor:replica.own.id,tab:tabId,openedAt,kind:"hello"});}catch(_){}}
  function openChannel(){
    if(typeof BroadcastChannel!=="function")return;
    try{channel=new BroadcastChannel("kafu-personal-writer-"+owner);channel.onmessage=event=>{
      const info=event.data;if(!replica||!info||info.tab===tabId||info.actor!==replica.own.id||!Number.isSafeInteger(info.openedAt))return;
      const otherFirst=info.openedAt<openedAt||(info.openedAt===openedAt&&String(info.tab)<tabId);
      if(otherFirst&&!forked){forked=true;capture();replica.forkWriter();apply();announce();}
      else if(info.kind==="hello")channel.postMessage({actor:replica.own.id,tab:tabId,openedAt,kind:"owner"});
    };announce();}catch(_){channel=null;}
  }
  function ensure(){
    if(replica)return true;if(unavailable)return false;
    try{replica=new Core.Replica({source:S,stored:S.sync_v2||null});client=new Core.CloudClient(replica,CloudSync.ok()?TG.CloudStorage:null);apply();openChannel();return true;}
    catch(_){client=null;replica=null;unavailable=true;return false;}
  }
  async function flush(force=false){
    clearTimeout(timer);timer=null;if(!ensure())return false;capture();
    if(!force&&Date.now()-lastFlush<30000){schedule();return false;}lastFlush=Date.now();
    const result=await client.flush();apply();if(CATALOG&&cur().v!=="study")render();return result;
  }
  function schedule(){if(!ensure()||!client.cloud||timer)return;const delay=Math.max(1500,30000-(Date.now()-lastFlush));timer=setTimeout(()=>{timer=null;flush().catch(()=>{});},delay);}
  saveState=function(){if(replica&&!applying){capture();schedule();}else originalSave();};
  recordAnswer=function(q,r){
    const book=QI[q.id]?.b||SESSION?.bookId;
    if(!ensure()){const prior=S.answers[q.id];S.answers[q.id]={c:r.correct,n:(prior?.n||0)+1,t:Date.now(),b:book};S.active[dayKey()]=true;originalSave();return;}
    capture();const event=replica.answer(q.id,r.correct,book,dayKey());apply();
    DB.put("meta",historyPrefix+event.id,event).catch(()=>{});DB.put("meta","state",S).catch(()=>{});schedule();
  };
  CloudSync.pull=function(){
    if(!ensure())return Promise.resolve();if(initializing)return initializing;
    const work=client.pull().then(()=>{apply();schedule();if(CATALOG)render();}).catch(()=>{});
    initializing=Promise.race([work,new Promise(resolve=>setTimeout(resolve,2000))]);return initializing;
  };
  CloudSync.push=schedule;CloudSync.flush=()=>flush(true);
  globalThis.KafuPersonal={status:publicStatus,statusText:()=>labels[publicStatus()]||"Local progress is safe",flush:()=>flush(true),
    get replica(){return replica;},get client(){return client;},capture,apply,
    reset:async()=>{if(!ensure())return;replica.resetProgress();apply();await DB.put("meta","state",S);schedule();render();}};
  ACTIONS["sync-now"]=()=>flush(true).then(()=>toast(labels[publicStatus()]||"Saved locally"));
  ACTIONS.reset=()=>confirmBox("Reset answers, review state, study time and resume on ALL synced devices? Stars are kept. This cannot be undone.",yes=>{if(yes)globalThis.KafuPersonal.reset();});
  const allReviewIds=list=>list==="mistakes"?Object.keys(S.answers).filter(id=>!S.answers[id].c):S.fav.slice();
  const row=rowHTML;
  rowHTML=function(action,data,icon,title,sub,right,red){
    if(action==="practice"&&data?.list){const ids=allReviewIds(data.list),available=ids.filter(id=>QI[id]).length;right=ids.length;if(available<ids.length)sub=available+" available offline; other chapters download when opened";}
    return row(action,data,icon,title,sub,right,red);
  };
  ACTIONS.practice=async function(data){
    const ids=allReviewIds(data.list);if(!ids.length){toast(data.list==="mistakes"?"No mistakes to review.":"Star a question to save it.");return;}
    const chapters=new Map();
    for(const id of ids.filter(id=>!QI[id])){
      let found=null;
      for(const b of CATALOG.books){const ch=b.chapters.find(ch=>Array.isArray(ch.qids)&&ch.qids.includes(id));if(ch){found={b:b.id,ch:ch.id};break;}}
      if(found)chapters.set(found.b+":"+found.ch,found);
    }
    // Only a user-requested review fetches these chapters; never a background scan.
    if(navigator.onLine!==false)for(const item of chapters.values())await downloadChapter(item.b,item.ch,true);
    const available=ids.filter(id=>QI[id]);
    if(!available.length){toast("Open or save the relevant book chapters, then review them here.");return;}
    if(available.length<ids.length)toast("Reviewing downloaded questions; the rest remain saved in your progress.");
    startSession({mode:"review",title:data.list==="mistakes"?"My mistakes":"Starred questions",qids:available});
  };
  const me=VIEWS.me;VIEWS.me=function(...args){const view=me.apply(this,args);view.html=view.html.replace("Clears answers, mistakes and study time on this device","Clears synced study progress on all devices; keeps stars");view.html+=`<h3 class="sec">Personal backup</h3><p class="note" role="status">${esc(labels[publicStatus()]||"Saved locally")}</p><button class="btn small ghost" data-a="sync-now">Sync now</button>`;return view;};
  const home=VIEWS.home;VIEWS.home=function(...args){const view=home.apply(this,args);view.html=view.html.replace(" and synced with Telegram","; Telegram backup is available");return view;};
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="hidden"){capture();DB.put("meta","state",S).catch(()=>{});flush(true).catch(()=>{});}
    else if(replica&&client.cloud)client.pull().then(()=>{apply();schedule();if(CATALOG)render();}).catch(()=>{});
  });
  window.addEventListener("online",()=>flush(true).catch(()=>{}));
  window.addEventListener("pagehide",()=>{capture();DB.put("meta","state",S).catch(()=>{});});
}});
