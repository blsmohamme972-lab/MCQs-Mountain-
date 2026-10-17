/* Question comments: a bar above the question (locked until it is answered) and the comments after the explanation,
   with posting times, likes and reactions. They are written by the Kafu characters (the Leaders personas, same
   names and pictures); one line under the card's title says so. Students cannot post: the composer says comments
   are temporarily closed. Packs come from COMMENTS_<BOOK-ID>_rN.zip through the bot (docs/COMMENTS.md).
   Loaded lazily by comments-loader.js. Data: one small index per book, then the shard holding the question
   (content-addressed, so a cached copy is checked by its SHA-256). Everything fetched is kept in Cache Storage
   for offline study; a book whose comments are taken away (index 404) is removed from the device too. */
(function(){
  'use strict';
  const STORE='kafu-comments-v1',INDEX_TTL=5*60000,MISS_TTL=10*60000,FAIL_TTL=30000,MAX_SHARD=2*1024*1024;
  const add=(tag,attrs)=>new Promise((ok,no)=>{
    const el=Object.assign(document.createElement(tag),attrs),t=setTimeout(()=>{el.remove();no(new Error('timeout'))},10000);
    el.onload=()=>{clearTimeout(t);ok()};el.onerror=()=>{clearTimeout(t);el.remove();no(new Error('load'))};document.head.appendChild(el);
  });
  let ready=null;
  const deps=()=>ready||(ready=Promise.all([
    globalThis.KafuCommentsCore||add('script',{src:'modules/comments-core.js'}),
    globalThis.KafuLeadersCore?.person||add('script',{src:'modules/leaders-core.js'}),
    add('link',{rel:'stylesheet',href:'modules/comments.css'})
  ]).catch(error=>{ready=null;throw error}));
  const Core=()=>globalThis.KafuCommentsCore,person=name=>globalThis.KafuLeadersCore.person(name);

  /* ---------- data ---------- */
  const base=()=>typeof CONFIG==='object'&&CONFIG&&typeof CONFIG.CONTENT_BASE==='string'?CONFIG.CONTENT_BASE.replace(/\/+$/,''):'';
  const indexUrl=book=>base()+'/comments/'+encodeURIComponent(book)+'.json';
  const store=()=>typeof caches==='object'?caches.open(STORE):Promise.reject(new Error('no_cache_storage'));
  const hex=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const indexes=new Map(),shards=new Map(),pendingShards=new Map(),failedShards=new Map(),lists=new Map();
  async function get(url,cache,ms){
    const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);
    try{return await fetch(url,{cache,credentials:'omit',referrerPolicy:'no-referrer',signal:c.signal});}finally{clearTimeout(t);}
  }
  async function keep(url,body,book){try{await(await store()).put(url,new Response(body,{headers:{'content-type':'application/json','x-kafu-book':book}}));}catch(_){}}
  async function dropBook(book,want=null){
    try{const c=await store();for(const req of await c.keys()){const m=await c.match(req);if(m?.headers.get('x-kafu-book')===book&&!want?.has(req.url))await c.delete(req);}}catch(_){}
  }
  function index(book){
    const hit=indexes.get(book);
    if(hit&&(hit.pending||hit.until>Date.now()))return hit.pending||Promise.resolve(hit.value);
    const pending=(async()=>{
      const url=indexUrl(book);let value=null,ttl=INDEX_TTL;
      try{
        if(!base())throw new Error('no_content_base');
        const r=await get(url,'no-cache',8000);
        if(r.status===404){ttl=MISS_TTL;dropBook(book);}       // no comments for this book, or taken away
        else{
          if(!r.ok)throw new Error('comments_index_http');
          value=await r.json();if(!Core().validIndex(value,book))throw new Error('comments_index_invalid');
          await keep(url,JSON.stringify(value),book);
          dropBook(book,new Set([new URL(url).href,...Object.values(value.shards).map(e=>new URL(base()+e.url).href)]));
        }
      }catch(_){
        ttl=FAIL_TTL;value=null;
        try{const m=await(await store()).match(url),saved=m&&await m.json();if(Core().validIndex(saved,book))value=saved;}catch(_){}   // offline copy
      }
      indexes.set(book,{until:Date.now()+ttl,value});return value;
    })();
    indexes.set(book,{...hit,until:0,pending});
    return pending;
  }
  function shard(book,key,e){
    if(shards.has(e.sha256))return Promise.resolve(shards.get(e.sha256));
    if(Date.now()-(failedShards.get(e.sha256)||0)<FAIL_TTL)return Promise.resolve(null);
    if(!pendingShards.has(e.sha256))pendingShards.set(e.sha256,(async()=>{
      const url=base()+e.url;let raw=null;
      try{const m=await(await store()).match(url);if(m)raw=await m.arrayBuffer();}catch(_){}
      if(!raw||await hex(raw)!==e.sha256){
        const r=await get(url,'default',15000);if(!r.ok)throw new Error('comments_shard_http');
        raw=await r.arrayBuffer();if(raw.byteLength>MAX_SHARD||await hex(raw)!==e.sha256)throw new Error('comments_shard_sha256');
        await keep(url,raw,book);
      }
      const data=JSON.parse(new TextDecoder().decode(raw));if(!Core().validShard(data,book,key))throw new Error('comments_shard_invalid');
      shards.set(e.sha256,data);failedShards.delete(e.sha256);return data;
    })().catch(()=>{   // e.g. replaced since the index was read: the next look re-reads the index
      failedShards.set(e.sha256,Date.now());const hit=indexes.get(book);if(hit&&!hit.pending)hit.until=0;return null;
    })
      .finally(()=>pendingShards.delete(e.sha256)));
    return pendingShards.get(e.sha256);
  }
  // What is known right now, without waiting: undefined = not loaded yet, null = no comments.
  function known(book,qid){
    const hit=indexes.get(book);if(!hit||hit.value===undefined)return undefined;
    const idx=hit.value,key=Core().shardOf(qid),e=idx?.shards[key];if(!e)return null;
    const data=shards.get(e.sha256);
    if(!data)return Date.now()-(failedShards.get(e.sha256)||0)<FAIL_TTL?null:undefined;
    const id=e.sha256+'|'+qid;if(!lists.has(id))lists.set(id,Core().clean(data.questions[qid],person,qid));
    return lists.get(id);
  }
  async function load(book,qid){
    const idx=await index(book),key=Core().shardOf(qid),e=idx?.shards[key];
    if(e)await shard(book,key,e);
  }
  // A saved chapter keeps its questions' comments for offline study.
  async function save(pack){
    try{
      await deps();
      const book=String(pack?.book_id||'');if(!book||!Array.isArray(pack.questions))return;
      const idx=await index(book);if(!idx)return;
      for(const key of new Set(pack.questions.map(q=>Core().shardOf(q.id)))){const e=idx.shards[key];if(e)await shard(book,key,e);}
    }catch(_){}
  }
  // Chapters saved before this module first ran get their comments once per session, quietly.
  let warmed=false;
  async function warm(){
    if(warmed||navigator.onLine===false)return;warmed=true;
    const books=new Map();
    for(const [qid,entry] of Object.entries(typeof QI==='object'?QI:{})){const b=String(entry.b);if(!books.has(b))books.set(b,new Set());books.get(b).add(Core().shardOf(qid));}
    for(const [book,keys] of [...books].slice(0,30)){
      const idx=await index(book);if(!idx)continue;
      for(const key of keys){const e=idx.shards[key];if(e)await shard(book,key,e);}
    }
  }

  /* ---------- view ---------- */
  // A bar above the question (locked until the answer) and the card after the explanation.
  const open=new Set(),noted=new Set(),seen=new Set(),seenBar=new Set(),loading=new Set(),threads=new Set();
  let visit={qid:null,t:0};   // when the question on screen opened
  const LATE=1200,LIKES='kafu-comment-likes-v1',KEEP_LIKES=500;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ICONS={
    lock:'<svg class="kc-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    down:'<svg class="kc-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9.5 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    compose:'<svg class="kc-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.6.5-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5v-8Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>'
  };
  // The student's own likes stay on this phone only.
  let liked=null;
  function likes(){
    if(!liked){liked=new Set();try{const v=JSON.parse(localStorage.getItem(LIKES)||'[]');if(Array.isArray(v))v.forEach(k=>typeof k==='string'&&liked.add(k));}catch(_){}}
    return liked;
  }
  const isLiked=key=>likes().has(key);
  function setLiked(key,on){
    const s=likes();s.delete(key);if(on)s.add(key);
    while(s.size>KEEP_LIKES)s.delete(s.values().next().value);
    try{localStorage.setItem(LIKES,JSON.stringify([...s]));}catch(_){}
  }
  function current(){
    try{
      if(typeof SESSION==='undefined'||!SESSION||SESSION.mode==='exam'&&!SESSION.finished)return null;
      const qid=SESSION.qids?.[SESSION.index],entry=qid&&QI[qid];
      return entry?{qid,book:String(entry.b)}:null;
    }catch(_){return null;}
  }
  function avatar(who,size){
    // Same face as on the Leaders board: Telegram-style initials, with the picture on top when it loads.
    return '<span class="kc-av'+(size?' '+size:'')+'" aria-hidden="true"><span style="background:linear-gradient('+esc(who.gradient[0])+','+esc(who.gradient[1])+')">'+esc(who.initials)+'</span>'+
      (who.photo?'<img src="'+esc(who.photo)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">':'')+'</span>';
  }
  const plural=(n,word)=>n+' '+word+(n===1?'':'s'),emoji=icons=>icons.map(e=>'<i>'+e+'</i>').join('');
  const active=at=>{const t=Core().ago(at,Date.now());return t?t==='now'?'Active now':'Active '+t+' ago':'';};
  function reacts(c){
    const r=Core().reactions(c,isLiked(c.key));
    return '<span class="kc-reacts'+(r.count?'':' kc-none')+'" aria-label="'+plural(r.count,'reaction')+'"><span class="kc-icons" aria-hidden="true">'+emoji(r.icons)+'</span><b>'+r.count+'</b></span>';
  }
  function item(c,qid,reply){
    const when=Core().ago(c.at,Date.now()),on=isLiked(c.key);
    return '<li class="kc-item'+(reply?' kc-reply':'')+'" data-k="'+esc(c.key)+'" tabindex="-1">'+avatar(c.who,reply?'sm':'')+'<div class="kc-body">'+
      '<div class="kc-bubble"><span class="kc-name"><bdi>'+esc(c.who.name)+'</bdi></span><small class="kc-tag">'+esc(c.who.tag)+'</small>'+
        (c.kind?'<span class="kc-kind kc-kind-'+c.kind+'">'+esc(Core().KINDS[c.kind])+'</span>':'')+
        '<p class="kc-text" dir="auto">'+esc(c.text)+'</p>'+reacts(c)+'</div>'+
      '<div class="kc-meta">'+(when?'<time class="kc-time" datetime="'+new Date(c.at).toISOString()+'">'+when+'</time>':'')+
        '<button type="button" class="kc-like'+(on?' on':'')+'" data-a="comments-like" data-q="'+qid+'" data-k="'+esc(c.key)+'" aria-pressed="'+on+'">Like</button></div>'+
      (!reply&&c.shownReplies.length?'<ol class="kc-replies">'+c.shownReplies.map(r=>item(r,qid,true)).join('')+'</ol>':'')+
      (!reply&&c.hiddenReplies?'<button type="button" class="kc-more-replies" data-a="comments-replies" data-q="'+qid+'" data-k="'+esc(c.key)+'">'+
        '<span aria-hidden="true"></span>View '+c.hiddenReplies+' more '+(c.hiddenReplies===1?'reply':'replies')+'</button>':'')+
    '</div></li>';
  }
  function bar(qid,list,answered){
    const s=Core().stats(list,isLiked),el=document.createElement('button'),when=active(s.last);
    el.type='button';el.className='kc-bar '+(answered?'kc-open':'kc-locked')+(seenBar.has(qid)?'':' kc-enter');seenBar.add(qid);
    el.dataset.a='comments-bar';el.dataset.q=qid;
    el.setAttribute('aria-label',plural(s.comments,'comment')+', '+plural(s.reactions,'reaction')+(when?', '+when.toLowerCase():'')+
      (answered?'. Read the discussion':'. Answer the question to open the discussion'));
    el.innerHTML='<span class="kc-faces" aria-hidden="true">'+s.faces.map(w=>avatar(w,'xs')).join('')+'</span>'+
      '<span class="kc-bar-main" aria-hidden="true"><strong>'+plural(s.comments,'comment')+'</strong>'+
        '<small><span class="kc-icons">'+emoji(s.icons)+'</span><b>'+s.reactions+'</b>'+(when?'<i class="kc-dot"></i>'+
          (Date.now()-s.last<864e5?'<i class="kc-live"></i>':'')+when.replace('Active ','<span class="kc-wide">Active </span>'):'')+'</small></span>'+
      '<span class="kc-bar-cta" aria-hidden="true">'+(answered?'<span>Read</span>'+ICONS.down:ICONS.lock+'<span>Answer first</span>')+'</span>';
    return el;
  }
  function build(qid,list){
    const v=Core().view(list,open.has(qid),threads),s=Core().stats(list,isLiked),el=document.createElement('section'),note='kc-note-'+qid;
    el.className='kc'+(seen.has(qid)?'':' kc-enter');seen.add(qid);
    el.dataset.q=qid;el.setAttribute('aria-labelledby','kc-title-'+qid);
    el.innerHTML='<div class="kc-top"><h3 class="kc-title" id="kc-title-'+qid+'" tabindex="-1">Comments <span class="kc-count">'+v.total+'</span></h3>'+
        '<span class="kc-sum" aria-label="'+plural(s.reactions,'reaction')+'"><span class="kc-icons" aria-hidden="true">'+emoji(s.icons)+'</span><b>'+s.reactions+'</b></span></div>'+
      '<p class="kc-by">By Kafu characters</p>'+
      '<ol class="kc-list">'+v.shown.map(c=>item(c,qid,false)).join('')+'</ol>'+
      (v.hidden?'<button type="button" class="kc-more" data-a="comments-more" data-q="'+qid+'">Show '+v.hidden+' more comment'+(v.hidden===1?'':'s')+'</button>':'')+
      '<button type="button" class="kc-compose" data-a="comments-compose" data-q="'+qid+'" aria-expanded="'+noted.has(qid)+'" aria-controls="'+note+'">'+
        ICONS.compose+'<span>Add a comment…</span></button>'+
      '<p class="kc-note" id="'+note+'" role="status" lang="ar" dir="rtl"'+(noted.has(qid)?'':' hidden')+'>التعليقات مغلقة مؤقتاً</p>';
    return el;
  }
  // Above the question: before the question card's number tab, so the card itself stays whole.
  const anchor=section=>section.querySelector(':scope>.k-question-head')||section.querySelector(':scope>.k-question-card')||section.querySelector('.qmeta')||section.querySelector('.stem');
  function place(){
    deps().then(()=>{try{
      const section=document.querySelector('.k-study');if(!section)return;
      const now=current();
      for(const el of section.querySelectorAll('.kc,.kc-bar'))if(!now||el.dataset.q!==now.qid)el.remove();
      if(!now)return;
      if(visit.qid!==now.qid)visit={qid:now.qid,t:Date.now()};
      const list=known(now.book,now.qid);
      if(list===undefined){
        // Fetched while the question is open: the bar shows as soon as it arrives, the card with the explanation.
        if(!loading.has(now.qid)){
          loading.add(now.qid);
          load(now.book,now.qid).catch(()=>{}).finally(()=>{
            loading.delete(now.qid);const again=current();
            if(again?.qid===now.qid&&known(now.book,now.qid)!==undefined)place();
          });
        }
        return;
      }
      index(now.book).catch(()=>{});   // refreshes in the background once the index is old
      prefetch();
      if(!list?.length)return;
      const answered=!!section.querySelector('.explain');
      // No spoilers before the answer: the bar only counts. It is not pushed in late above a question being read.
      const at=anchor(section);
      if(at&&!section.querySelector('.kc-bar[data-q="'+now.qid+'"]')&&(answered||seenBar.has(now.qid)||Date.now()-visit.t<=LATE))
        at.parentNode.insertBefore(bar(now.qid,list,answered),at);
      if(!answered||section.querySelector('.kc[data-q="'+now.qid+'"]'))return;
      section.appendChild(build(now.qid,list));
      if(!warmed)(globalThis.requestIdleCallback||(f=>setTimeout(f,1500)))(()=>warm().catch(()=>{}));
    }catch(_){}},()=>{});
  }
  // The next question's comments load in the background, so its bar is there when it opens.
  function prefetch(){
    try{
      const qid=SESSION.qids?.[SESSION.index+1],entry=qid&&QI[qid];
      if(entry&&known(String(entry.b),qid)===undefined)load(String(entry.b),qid).catch(()=>{});
    }catch(_){}
  }
  function refresh(qid,focus){
    const old=document.querySelector('.kc[data-q="'+qid+'"]'),now=current(),list=now?.qid===qid?known(now.book,qid):null;
    if(!old||!list?.length)return;
    const el=build(qid,list);old.replaceWith(el);
    const oldBar=document.querySelector('.kc-bar[data-q="'+qid+'"]');
    if(oldBar)oldBar.replaceWith(bar(qid,list,true));
    if(focus)el.querySelector(focus)?.focus({preventScroll:true});
  }
  ACTIONS['comments-more']=d=>{open.add(d.q);refresh(d.q,'.kc-list>.kc-item:nth-child('+(Core().VISIBLE+1)+')');};
  ACTIONS['comments-replies']=d=>{threads.add(d.k);refresh(d.q,'.kc-item[data-k="'+d.k+'"] .kc-replies>.kc-item:nth-child('+(Core().REPLIES+1)+')');};
  ACTIONS['comments-compose']=d=>{noted.has(d.q)?noted.delete(d.q):noted.add(d.q);refresh(d.q,'.kc-compose');};
  ACTIONS['comments-like']=d=>{
    setLiked(d.k,!isLiked(d.k));
    try{haptic.tap();}catch(_){}
    refresh(d.q,'.kc-like[data-k="'+d.k+'"]');
    const button=document.querySelector('.kc-like[data-k="'+d.k+'"]');
    if(button&&isLiked(d.k))button.classList.add('kc-pop');
  };
  ACTIONS['comments-bar']=d=>{
    const card=document.querySelector('.kc[data-q="'+d.q+'"]'),reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if(card){card.scrollIntoView({behavior:reduced?'auto':'smooth',block:'start'});card.querySelector('.kc-title')?.focus({preventScroll:true});return;}
    const el=document.querySelector('.kc-bar[data-q="'+d.q+'"]');
    if(el){el.classList.remove('kc-shake');void el.offsetWidth;el.classList.add('kc-shake');}
    try{haptic.no();}catch(_){}
    if(typeof toast==='function')toast('Answer the question to open the discussion.');
  };
  if(typeof deleteChapter==='function'){
    const del=deleteChapter;
    deleteChapter=async key=>{
      const out=await del(key),book=String(key).split(':')[0];
      if(!Object.keys(S?.dl||{}).some(k=>k.split(':')[0]===book)){indexes.delete(book);dropBook(book);}   // last chapter of the book gone
      return out;
    };
  }
  globalThis.KafuComments={place,save,warm,ready:deps,_known:known};
})();
