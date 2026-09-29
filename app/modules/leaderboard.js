/* Privacy-safe leaderboard: server verifies Telegram initData and computes scores from source answers. */
globalThis.KafuEnhancements.installers.push({name:'leaderboard',install(){
  'use strict';
  const C=KafuDesign;
  const owner=IN_TG&&Number.isSafeInteger(TG.initDataUnsafe?.user?.id)?String(TG.initDataUnsafe.user.id):'browser';
  const key='leaderboard_pending_user_'+owner;
  let pending=[],timer=null,loading=false,period='weekly',board=null,error='';
  const clone=v=>JSON.parse(JSON.stringify(v));
  function available(){return !!(IN_TG&&TG?.initData)}
  async function loadPending(){
    try{const saved=await DB.get('meta',key);pending=Array.isArray(saved)?saved.filter(x=>x&&/^Q\\d{9}$/.test(x.qid)).slice(-500):[];}catch(_){pending=[]}
  }
  async function savePending(){try{await DB.put('meta',key,pending.slice(-500));}catch(_){}}
  async function api(path,body){
    if(!available())throw new Error('Telegram required');
    const r=await fetch('/api/leaderboard/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({initData:TG.initData,...body})});
    const data=await r.json().catch(()=>({error:'invalid_response'}));
    if(!r.ok)throw new Error(data.error||('HTTP '+r.status));
    return data;
  }
  async function flush(){
    clearTimeout(timer);timer=null;
    if(!available()||!navigator.onLine||!pending.length)return;
    const batch=pending.slice(0,50);
    try{
      const result=await api('submit',{answers:batch});
      pending=pending.filter(x=>!batch.some(y=>y.qid===x.qid));
      await savePending();
      return result;
    }catch(e){
      if(String(e.message)==='rate_limited')return;
      return;
    }
  }
  function schedule(){if(timer||!pending.length)return;timer=setTimeout(()=>{flush().catch(()=>{})},30000)}
  const originalOpen=DB.open.bind(DB);
  DB.open=async function(...args){const result=await originalOpen(...args);await loadPending();schedule();return result};
  const existingRecord=recordAnswer;
  recordAnswer=function(q,r){
    const prior=S.answers?.[q.id],first=!(prior&&Number(prior.n)>0),selection=clone(r.sel);
    const result=existingRecord(q,r);
    if(first&&available()&&!pending.some(x=>x.qid===q.id)){
      pending.push({qid:q.id,selection,answered_at_ms:Date.now()});savePending().catch(()=>{});schedule();
    }
    return result;
  };
  async function loadBoard(next=period){
    period=next;loading=true;error='';render();
    try{board=await api('board',{period});}catch(e){error=String(e.message||e);board=null}
    loading=false;render();
  }
  function row(x,own=false){
    const photo=x.photo_url?'<img src="'+C.e(x.photo_url)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':'<span class="k-leader-avatar" aria-hidden="true">'+C.e((x.name||'S').slice(0,1))+'</span>';
    return '<div class="k-leader-row'+(own?' own':'')+'">'+(own?'<span class="k-leader-you">You</span>':'<span class="k-leader-rank">'+(x.rank||'—')+'</span>')+photo+'<span class="k-leader-name">'+C.e(x.name||'Student')+'</span><strong>'+Number(x.score||0)+'</strong><small>'+Number(x.answered||0)+' answered</small></div>';
  }
  VIEWS.leaderboard=()=>{
    let body;
    if(!available())body='<div class="k-empty"><h2>Leaderboard</h2><p>Open Kafu inside Telegram to join the leaderboard. Browser study remains private and local.</p></div>';
    else if(loading)body='<div class="k-card"><p class="note">Loading leaderboard…</p></div>';
    else if(error)body='<div class="k-card"><p class="note">Leaderboard unavailable right now. Your study progress is still saved.</p>'+C.button('Try again',{action:'leaderboard-retry',variant:'ghost'})+'</div>';
    else if(!board)body='<div class="k-card"><p class="note">Weekly competition resets Monday 00:00 Baghdad time. Only first attempts score.</p>'+C.button('Load leaderboard',{action:'leaderboard-retry'})+'</div>';
    else{
      const own={...board.own,name:greetingName(),photo_url:TG.initDataUnsafe?.user?.photo_url||null};
      const eligibility=own.answered<board.min_answered?'<p class="note">Answer '+(board.min_answered-own.answered)+' more first-attempt questions to appear publicly.</p>':'';
      body='<div class="k-leader-tabs" role="tablist" aria-label="Leaderboard period">'+
        '<button role="tab" aria-selected="'+(period==='weekly')+'" data-a="leader-period" data-v="weekly">Weekly</button>'+
        '<button role="tab" aria-selected="'+(period==='all_time')+'" data-a="leader-period" data-v="all_time">All-time</button></div>'+
        '<section class="k-card k-leader-own"><h2>Your score</h2>'+row(own,true)+eligibility+
        '<label class="k-leader-hide"><input type="checkbox" data-a="leader-hide" '+(own.hidden?'checked':'')+'> Hide me from public leaderboards</label></section>'+
        '<section class="k-leader-list" aria-label="'+(period==='weekly'?'Weekly':'All-time')+' leaderboard">'+
        ((board.top||[]).length?(board.top||[]).map(x=>row(x)).join(''):'<div class="k-empty"><p>No students have reached the '+board.min_answered+'-question minimum yet.</p></div>')+
        '</section>';
    }
    return{title:'Leaderboard',html:'<section class="k-leaderboard">'+body+'</section>',action:null};
  };
  ACTIONS['open-leaderboard']=()=>{go('leaderboard');if(available())loadBoard(period).catch(()=>{})};
  ACTIONS['leaderboard-retry']=()=>loadBoard(period);
  ACTIONS['leader-period']=d=>loadBoard(d.v==='all_time'?'all_time':'weekly');
  ACTIONS['leader-hide']=async d=>{
    const input=d.el||document.querySelector('[data-a="leader-hide"]'),hidden=!!input?.checked;
    try{await api('privacy',{hidden});if(board?.own)board.own.hidden=hidden;render()}catch(_){toast('Could not update leaderboard privacy.');render()}
  };
  const me=VIEWS.me;
  VIEWS.me=function(...args){const view=me.apply(this,args);view.html+='<h3 class="sec">Community</h3><button class="row k-leader-entry" data-a="open-leaderboard"><span class="ic" aria-hidden="true">★</span><span class="grow"><span class="t">Leaderboard</span><span class="s">First attempts · weekly and all-time</span></span><span class="chev" aria-hidden="true">›</span></button>';return view};
  addEventListener('online',()=>flush().catch(()=>{}));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush().catch(()=>{})});
  globalThis.KafuLeaderboard={loadBoard,flush,get pending(){return pending.slice()},get board(){return board},get period(){return period}};
}});
