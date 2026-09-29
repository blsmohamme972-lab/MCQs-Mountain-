/* Optional per-question community: lazy, local-cache first, never in grading path. */
globalThis.KafuEnhancements.installers.push({name:'question-comments',install(){
  'use strict';
  const C=KafuDesign;
  const account=IN_TG&&Number.isSafeInteger(TG.initDataUnsafe?.user?.id)?String(TG.initDataUnsafe.user.id):'browser';
  const prefix='comments_v1_'+account+'_';
  let state={qid:null,sort:'helpful',items:[],next:null,loading:false,error:'',offline:false,draft:'',replyTo:null,reportTarget:null,cacheAt:0};
  const available=()=>!!(IN_TG&&TG?.initData);
  const answered=qid=>!!(S.answers?.[qid]?.n||SESSION?.resp?.[qid]?.done);
  const cacheKey=(qid,sort)=>prefix+'cache_'+qid+'_'+sort,draftKey=qid=>prefix+'draft_'+qid;
  async function api(path,body){
    if(!available())throw new Error('telegram_required');
    const r=await fetch('/api/comments/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({initData:TG.initData,...body})});
    const data=await r.json().catch(()=>({error:'invalid_response'}));if(!r.ok)throw new Error(data.error||('HTTP '+r.status));return data;
  }
  async function readCache(qid,sort){
    try{const hit=await DB.get('meta',cacheKey(qid,sort));return hit&&Array.isArray(hit.items)?hit:null}catch(_){return null}
  }
  async function saveCache(){try{await DB.put('meta',cacheKey(state.qid,state.sort),{items:state.items,next:state.next,at:Date.now()});}catch(_){}}
  async function saveDraft(){try{await DB.put('meta',draftKey(state.qid),state.draft||'');}catch(_){}}
  const escBody=v=>C.e(String(v??''));
  function avatar(x){
    if(x.photo_url)return '<img class="k-comment-avatar" src="'+C.e(x.photo_url)+'" alt="" loading="lazy" referrerpolicy="no-referrer">';
    const letters=String(x.name||'Student').trim().split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase()||'S';
    return '<span class="k-comment-avatar k-comment-fallback" aria-hidden="true">'+C.e(letters)+'</span>';
  }
  function card(x,reply=false){
    const verified=x.verified?'<span class="k-comment-verified">✓ Verified by Kafu</span>':'';
    const replies=!reply&&Array.isArray(x.replies)?x.replies.map(r=>card(r,true)).join(''):'';
    return '<article class="k-comment-card'+(reply?' is-reply':'')+'" data-comment-id="'+Number(x.id)+'">'+
      '<div class="k-comment-head">'+avatar(x)+'<div class="k-comment-who"><strong>'+C.e(x.name||'Student')+'</strong><time>'+C.e(new Date(x.created_at).toLocaleString())+'</time></div>'+verified+'</div>'+
      '<p class="k-comment-body" dir="auto">'+escBody(x.body)+'</p>'+
      '<div class="k-comment-actions"><button data-a="comment-helpful" data-id="'+Number(x.id)+'" aria-pressed="'+(x.helpful_by_me?'true':'false')+'">Helpful'+(Number(x.helpful)>0?' · '+Number(x.helpful):'')+'</button>'+
      (reply?'':'<button data-a="comment-reply" data-id="'+Number(x.id)+'" data-name="'+C.e(x.name||'Student')+'">Reply</button>')+
      '<button data-a="comment-report" data-id="'+Number(x.id)+'">Report</button>'+(x.mine?'<button data-a="comment-delete" data-id="'+Number(x.id)+'">Delete mine</button>':'')+'</div>'+replies+'</article>';
  }
  function sheet(){
    const locked=!state.qid||!answered(state.qid);
    if(locked)return '<div class="scrim" data-a="close-sheet"><div class="sheet k-comments-sheet" role="dialog" aria-label="Discussion" data-stop="1"><div class="k-comments-title"><h4>Discussion</h4><button data-a="close-sheet" aria-label="Close">×</button></div><div class="k-comment-lock"><strong>Discussion locked</strong><p>Answer this question to unlock student discussion.</p></div></div></div>';
    const content=state.loading&&!state.items.length?'<p class="note">Loading discussion…</p>':
      state.error&&!state.items.length?'<div class="k-comment-empty"><p>Discussion is unavailable right now. Studying still works normally.</p><button data-a="comment-retry">Try again</button></div>':
      state.items.length?state.items.map(x=>card(x)).join(''):'<div class="k-comment-empty"><p>No discussion yet. Start a useful thread for this question.</p></div>';
    const offline=state.offline?'<p class="k-comment-offline">Offline — showing saved discussion</p>':'';
    const reply=state.replyTo?'<div class="k-comment-replying">Replying to '+C.e(state.replyTo.name)+' <button data-a="comment-cancel-reply">Cancel</button></div>:'';
    const report=state.reportTarget?'<div class="k-comment-reportbox"><strong>Report comment</strong><button data-a="comment-report-send" data-v="answer_wrong">I think the answer is wrong</button><button data-a="comment-report-send" data-v="spam">Spam</button><button data-a="comment-report-send" data-v="abuse">Abusive</button><button data-a="comment-report-send" data-v="other">Other</button><button data-a="comment-report-cancel">Cancel</button></div>':'';
    return '<div class="scrim" data-a="close-sheet"><div class="sheet k-comments-sheet" role="dialog" aria-label="Discussion" data-stop="1">'+
      '<div class="k-comments-title"><div><h4>Discussion</h4><p>Student discussion — not verified</p></div><button data-a="close-sheet" aria-label="Close">×</button></div>'+
      '<div class="k-comment-sort"><button data-a="comment-sort" data-v="helpful" aria-pressed="'+(state.sort==='helpful')+'">Most helpful</button><button data-a="comment-sort" data-v="newest" aria-pressed="'+(state.sort==='newest')+'">Newest</button></div>'+offline+
      '<div class="k-comments-list">'+content+'</div>'+(state.next?'<button class="k-comment-more" data-a="comment-more">Load more</button>':'')+
      report+reply+'<label class="k-comment-compose"><span class="sr-only">Write a comment</span><textarea maxlength="600" data-comment-draft dir="auto" placeholder="'+(state.replyTo?'Write a reply…':'Add to the discussion…')+'">'+C.e(state.draft||'')+'</textarea><div><small><span data-comment-count>'+[...(state.draft||'')].length+'</span>/600</small><button data-a="comment-send">Post</button></div></label>'+
      '</div></div>';
  }
  async function load(qid,{force=false,append=false}={}){
    if(!answered(qid))return;
    state.qid=qid;state.error='';state.offline=!navigator.onLine;
    if(!append){
      const [cached,draft]=await Promise.all([readCache(qid,state.sort),DB.get('meta',draftKey(qid)).catch(()=>null)]);
      if(cached){state.items=cached.items;state.next=cached.next;state.cacheAt=Number(cached.at||0)}
      else{state.items=[];state.next=null;state.cacheAt=0}
      state.draft=typeof draft==='string'?draft:'';if(SHEET)render();
      if(cached&&!force&&Date.now()-state.cacheAt<300000)return;
    }
    if(!available()||!navigator.onLine){state.offline=true;if(SHEET)render();return}
    state.loading=true;if(SHEET)render();
    try{
      const data=await api('thread',{qid,sort:state.sort,cursor:append?state.next:null});
      state.items=append?state.items.concat(data.items||[]):data.items||[];state.next=data.next_cursor||null;state.offline=false;await saveCache();
    }catch(e){state.error=String(e.message||e)}
    state.loading=false;if(SHEET)render();
  }
  function open(){
    const qid=SESSION?.qids?.[SESSION.index];if(!qid)return;
    state={...state,qid,sort:'helpful',items:[],next:null,loading:false,error:'',offline:!navigator.onLine,replyTo:null,reportTarget:null,cacheAt:0};
    SHEET=sheet;render();if(answered(qid))load(qid).catch(()=>{});
  }
  async function send(){
    const ta=document.querySelector('[data-comment-draft]'),raw=ta?ta.value:state.draft,body=String(raw||'').trim();
    state.draft=raw;await saveDraft();if(!body||[...body].length>600)return;
    if(!available()||!navigator.onLine){toast('Draft saved on this device.');return}
    const nonce='c_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
    try{
      await api('create',{qid:state.qid,body,parent_id:state.replyTo?.id||null,client_nonce:nonce});
      state.draft='';state.replyTo=null;await saveDraft();await load(state.qid,{force:true});toast('Posted.');
    }catch(e){toast(e.message==='rate_limited'?'Posting limit reached. Try again later.':'Could not post. Your draft is saved.')}
  }
  const study=VIEWS.study;
  VIEWS.study=function(...args){
    const v=study.apply(this,args),qid=SESSION?.qids?.[SESSION.index];if(!qid||SESSION?.mode==='exam')return v;
    const lock=answered(qid)?'':' is-locked';
    const block='<section class="k-discussion-entry'+lock+'"><button data-a="open-comments" aria-label="Open student discussion"><span><strong>Discussion</strong><small>'+(lock?'Answer this question to unlock student discussion.':'Student discussion — not verified')+'</small></span><span aria-hidden="true">'+(lock?'🔒':'›')+'</span></button></section>';
    v.html=v.html.replace('<div class="qtools">',block+'<div class="qtools">');return v;
  };
  ACTIONS['open-comments']=open;
  ACTIONS['comment-retry']=()=>load(state.qid,{force:true});
  ACTIONS['comment-sort']=d=>{state.sort=d.v==='newest'?'newest':'helpful';state.items=[];state.next=null;load(state.qid,{force:true}).catch(()=>{})};
  ACTIONS['comment-more']=()=>{if(!state.loading&&state.next)load(state.qid,{append:true,force:true}).catch(()=>{})};
  ACTIONS['comment-reply']=d=>{state.replyTo={id:Number(d.id),name:d.name||'Student'};render();setTimeout(()=>document.querySelector('[data-comment-draft]')?.focus(),0)};
  ACTIONS['comment-cancel-reply']=()=>{state.replyTo=null;render()};
  ACTIONS['comment-send']=()=>send();
  ACTIONS['comment-helpful']=async d=>{try{await api('helpful',{comment_id:Number(d.id)});await load(state.qid,{force:true})}catch(e){toast(e.message==='self_helpful_not_allowed'?'You cannot mark your own comment helpful.':'Could not update Helpful.')}};
  ACTIONS['comment-report']=d=>{state.reportTarget=Number(d.id);render()};
  ACTIONS['comment-report-cancel']=()=>{state.reportTarget=null;render()};
  ACTIONS['comment-report-send']=async d=>{const id=state.reportTarget;if(!id)return;try{await api('report',{comment_id:id,reason:d.v||'other'});state.reportTarget=null;toast('Report sent for owner review.');await load(state.qid,{force:true})}catch(_){toast('Could not send report.')}};
  ACTIONS['comment-delete']=async d=>{try{await api('delete',{comment_id:Number(d.id)});await load(state.qid,{force:true})}catch(e){toast(e.message==='forbidden'?'You can only delete your own comment.':'Could not delete comment.')}};
  document.addEventListener('input',ev=>{if(!ev.target.matches?.('[data-comment-draft]'))return;state.draft=ev.target.value;saveDraft().catch(()=>{});const n=document.querySelector('[data-comment-count]');if(n)n.textContent=[...state.draft].length});
  addEventListener('offline',()=>{state.offline=true;if(SHEET===sheet)render()});
  globalThis.KafuComments={open,load,get state(){return JSON.parse(JSON.stringify(state))},account};
}});