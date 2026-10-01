/* Privacy-safe leaderboard: server verifies Telegram initData and computes scores from source answers. */
globalThis.KafuEnhancements.installers.push({name:'leaderboard',install(){
  'use strict';
  const C=KafuDesign;
  const owner=IN_TG&&Number.isSafeInteger(TG.initDataUnsafe?.user?.id)?String(TG.initDataUnsafe.user.id):'browser';
  const key='leaderboard_pending_user_'+owner,privacyKey='leaderboard_hidden_user_'+owner,scoreKey='leaderboard_score_user_'+owner;
  const BATCH=100,FLUSH_MS=60*60*1000;
  let flushing=null,persisting=Promise.resolve(),retryDelay=0;
  let pending=[],timer=null,loading=false,period='weekly',board=null,error='',hiddenPref=false,verifiedScore=null;
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
  async function loadBoard(next=period){
    period=next;loading=true;error='';render();
    try{
      board=await api('board',{period});
    }catch(e){error=String(e.message||e);board=null}
    loading=false;render();
  }
  function row(x,own=false){
    const photo=x.photo_url?'<img src="'+C.e(x.photo_url)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':'<span class="k-leader-avatar" aria-hidden="true">'+C.e((x.name||'S').slice(0,1))+'</span>';
    return '<div class="k-leader-row'+(own?' own':'')+'">'+(own?'<span class="k-leader-you">You</span>':'<span class="k-leader-rank">'+(x.rank||'—')+'</span>')+photo+'<span class="k-leader-name">'+C.e(x.name||'Student')+'</span><strong>'+Number(x.score||0)+'</strong><small>correct first attempts</small></div>';
  }
  VIEWS.leaderboard=()=>{
    let body;
    if(!available())body='<div class="k-empty"><h2>Leaderboard</h2><p>Open Kafu inside Telegram to join the leaderboard. Browser study remains private and local.</p></div>';
    else if(loading)body='<div class="k-card"><p class="note">Loading leaderboard…</p></div>';
    else if(error)body='<div class="k-card"><p class="note">Leaderboard unavailable right now. Your study progress is still saved.</p>'+C.button('Try again',{action:'leaderboard-retry',variant:'ghost'})+'</div>';
    else if(!board)body='<div class="k-card"><p class="note">Weekly competition resets Monday 00:00 Baghdad time. Only first attempts score.</p>'+C.button('Load leaderboard',{action:'leaderboard-retry'})+'</div>';
    else{
      const tgUser=TG.initDataUnsafe?.user||{},ownName=[tgUser.first_name,tgUser.last_name].filter(Boolean).join(' ')||greetingName();
      const score=verifiedScore?(period==='all_time'?verifiedScore.total:verifiedScore.week_key===board.week_key?verifiedScore.weekly:0):null;
      const own={score:score??0,name:ownName,photo_url:tgUser.photo_url||null};
      // Beat the cutoff by one point: snapshot ties do not promise a place.
      const gap=board.cutoff==null?'The Top 30 is still filling up.':score==null?'Sync an answer batch to see your points gap.':
        'You need '+Math.max(0,board.cutoff+1-score)+' points to reach #30.';
      body='<div class="k-leader-tabs" role="tablist" aria-label="Leaderboard period">'+
        '<button role="tab" aria-selected="'+(period==='weekly')+'" data-a="leader-period" data-v="weekly">Weekly</button>'+
        '<button role="tab" aria-selected="'+(period==='all_time')+'" data-a="leader-period" data-v="all_time">All-time</button></div>'+
        '<section class="k-card k-leader-own"><h2>Your synced score</h2>'+(score==null?'<p>Score not synced on this device yet.</p>':row(own,true))+'<p>'+C.e(gap)+'</p><p class="note">Based on your last submission and the cached Top 30. Pending offline answers appear after syncing.</p></section>'+
        '<h2>Top 30</h2>'+
        '<section class="k-leader-list" aria-label="'+(period==='weekly'?'Weekly':'All-time')+' leaderboard">'+
        ((board.top||[]).length?(board.top||[]).map(x=>row(x)).join(''):'<div class="k-empty"><p>No leaderboard scores yet.</p></div>')+
        '</section>';
    }
    return{title:'Leaderboard',html:'<section class="k-leaderboard">'+body+'</section>',action:null,tabs:'me'};
  };
  ACTIONS['open-leaderboard']=()=>{go('leaderboard');if(available())loadBoard(period).catch(()=>{})};
  ACTIONS['leaderboard-retry']=()=>loadBoard(period);
  ACTIONS['leader-period']=d=>loadBoard(d.v==='all_time'?'all_time':'weekly');
  ACTIONS['leader-hide']=async (d,el)=>{
    const input=el||document.querySelector('[data-a="leader-hide"]'),hidden=!!input?.checked;
    try{
      await api('privacy',{hidden});
      hiddenPref=hidden;if(board?.own)board.own.hidden=hidden;
      await DB.put('meta',privacyKey,hiddenPref);render();
    }catch(_){toast('Could not update leaderboard privacy.');render()}
  };
  const me=VIEWS.me;
  VIEWS.me=function(...args){
    const view=me.apply(this,args);
    if(available())view.html+='<h3 class="sec">Community</h3><button class="row k-leader-entry" data-a="open-leaderboard"><span class="ic" aria-hidden="true">★</span><span class="grow"><span class="t">Leaderboard</span><span class="s">First attempts · weekly and all-time</span></span><span class="chev" aria-hidden="true">›</span></button><label class="k-leader-hide"><input type="checkbox" data-a="leader-hide" '+(hiddenPref?'checked':'')+'> Hide me from leaderboard</label>';
    return view;
  };
  addEventListener('online',()=>schedule());
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')savePending().catch(()=>{})});
  globalThis.KafuLeaderboard={loadBoard,flush,BATCH,FLUSH_MS,get pending(){return pending.slice()},get board(){return board},get period(){return period}};
}});

