/* Score sync only: first attempts are still submitted (Telegram initData verified server-side) so real scores
   are ready when the public board returns. The visible board is modules/leaders.js. */
globalThis.KafuEnhancements.installers.push({name:'leaderboard',install(){
  'use strict';
  const owner=IN_TG&&Number.isSafeInteger(TG.initDataUnsafe?.user?.id)?String(TG.initDataUnsafe.user.id):'browser';
  const key='leaderboard_pending_user_'+owner,privacyKey='leaderboard_hidden_user_'+owner,scoreKey='leaderboard_score_user_'+owner;
  const BATCH=100,FLUSH_MS=60*60*1000;
  let flushing=null,persisting=Promise.resolve(),retryDelay=0;
  let pending=[],timer=null,hiddenPref=false,verifiedScore=null;
  const clone=v=>v===undefined?null:JSON.parse(JSON.stringify(v));
  function available(){return !!(IN_TG&&TG?.initData&&String(TG.initDataUnsafe?.user?.id)===owner)}
  async function loadPending(){
    try{
      const saved=await DB.get('meta',key),hidden=await DB.get('meta',privacyKey);
      verifiedScore=await DB.get('meta',scoreKey)||null;
      pending=Array.isArray(saved)?saved.filter(x=>x&&/^Q\d{9}$/.test(x.qid)):[];
      hiddenPref=hidden===true;
    }catch(_){pending=[];hiddenPref=false}
  }
  function savePending(){const snapshot=clone(pending);persisting=persisting.catch(()=>{}).then(()=>DB.put('meta',key,snapshot));return persisting}
  async function api(path,body){
    if(!available())throw new Error('Telegram required');
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
    let r;try{r=await fetch('/api/leaderboard/'+path,{method:'POST',signal:controller.signal,headers:{'content-type':'application/json'},body:JSON.stringify({initData:TG.initData,...body})});}finally{clearTimeout(timeout)}
    const data=await r.json().catch(()=>({error:'invalid_response'}));
    if(!r.ok)throw new Error(data.error||('HTTP '+r.status));
    return data;
  }
  async function sendBatch(){
    clearTimeout(timer);timer=null;
    if(!available()||!navigator.onLine||!pending.length)return;
    const batch=pending.slice(0,BATCH);
    try{
      await savePending();
      const result=await api('submit',{answers:batch});
      retryDelay=0;
      if(result.score){verifiedScore=result.score;await DB.put('meta',scoreKey,verifiedScore)}
      pending=pending.filter(x=>!batch.some(y=>y.qid===x.qid));
      await savePending();
      return result;
    }catch(_){retryDelay=Math.min(FLUSH_MS,Math.max(60000,retryDelay*2));return;}
    finally{schedule()}
  }
  function flush(){
    if(flushing)return flushing;
    flushing=sendBatch().finally(()=>{flushing=null});
    return flushing;
  }
  function schedule(){
    if(timer||!pending.length)return;
    timer=setTimeout(()=>{flush().catch(()=>{})},Math.max(retryDelay,pending.length>=BATCH?1000:FLUSH_MS));
  }
  const originalOpen=DB.open.bind(DB);
  DB.open=async function(...args){const result=await originalOpen(...args);await loadPending();schedule();return result};
  const existingRecord=recordAnswer;
  recordAnswer=function(q,r){
    const prior=S.answers?.[q.id],first=!(prior&&Number(prior.n)>0),selection=clone(r.sel);
    const result=existingRecord(q,r);
    if(first&&available()&&!pending.some(x=>x.qid===q.id)){
      pending.push({qid:q.id,selection});savePending().catch(()=>{});
      if(pending.length>=BATCH){clearTimeout(timer);timer=null}schedule();
    }
    return result;
  };
  addEventListener('online',()=>schedule());
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')savePending().catch(()=>{})});
  globalThis.KafuLeaderboard={flush,BATCH,FLUSH_MS,get pending(){return pending.slice()},get verifiedScore(){return verifiedScore},get hidden(){return hiddenPref}};
}});

