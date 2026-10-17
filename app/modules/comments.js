/* Comments under a question's explanation. They are written by the Kafu characters (the Leaders personas, same
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
    const id=e.sha256+'|'+qid;if(!lists.has(id))lists.set(id,Core().clean(data.questions[qid],person));
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
  const open=new Set(),noted=new Set(),seen=new Set(),loading=new Set();
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function current(){
    try{
      if(typeof SESSION==='undefined'||!SESSION||SESSION.mode==='exam'&&!SESSION.finished)return null;
      const qid=SESSION.qids?.[SESSION.index],entry=qid&&QI[qid];
      return entry?{qid,book:String(entry.b)}:null;
    }catch(_){return null;}
  }
  function avatar(who,small){
    // Same face as on the Leaders board: Telegram-style initials, with the picture on top when it loads.
    return '<span class="kc-av'+(small?' sm':'')+'" aria-hidden="true"><span style="background:linear-gradient('+esc(who.gradient[0])+','+esc(who.gradient[1])+')">'+esc(who.initials)+'</span>'+
      (who.photo?'<img src="'+esc(who.photo)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">':'')+'</span>';
  }
  function item(c,reply){
    return '<li class="kc-item'+(reply?' kc-reply':'')+'"'+(reply?'':' tabindex="-1"')+'>'+avatar(c.who,reply)+'<div class="kc-body">'+
      '<div class="kc-head"><span class="kc-name" dir="auto">'+esc(c.who.name)+'</span></div>'+
      '<small class="kc-tag">'+esc(c.who.tag)+'</small>'+
      (c.kind?'<span class="kc-kind kc-kind-'+c.kind+'">'+esc(Core().KINDS[c.kind])+'</span>':'')+
      '<p class="kc-text" dir="auto">'+esc(c.text)+'</p>'+
      (!reply&&c.replies.length?'<ol class="kc-replies">'+c.replies.map(r=>item(r,true)).join('')+'</ol>':'')+
    '</div></li>';
  }
  function build(qid,list){
    const v=Core().view(list,open.has(qid)),el=document.createElement('section'),note='kc-note-'+qid;
    el.className='kc'+(seen.has(qid)?'':' kc-enter');seen.add(qid);
    el.dataset.q=qid;el.setAttribute('aria-labelledby','kc-title-'+qid);
    el.innerHTML='<h3 class="kc-title" id="kc-title-'+qid+'">Comments <span class="kc-count">'+v.total+'</span></h3>'+
      '<p class="kc-by">By Kafu characters</p>'+
      '<ol class="kc-list">'+v.shown.map(c=>item(c,false)).join('')+'</ol>'+
      (v.hidden?'<button type="button" class="kc-more" data-a="comments-more" data-q="'+qid+'">Show '+v.hidden+' more comment'+(v.hidden===1?'':'s')+'</button>':'')+
      '<button type="button" class="kc-compose" data-a="comments-compose" data-q="'+qid+'" aria-expanded="'+noted.has(qid)+'" aria-controls="'+note+'">'+
        '<svg class="kc-compose-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.6.5-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5v-8Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg><span>Add a comment…</span></button>'+
      '<p class="kc-note" id="'+note+'" role="status" lang="ar" dir="rtl"'+(noted.has(qid)?'':' hidden')+'>التعليقات مغلقة مؤقتاً</p>';
    return el;
  }
  function place(){
    deps().then(()=>{try{
      const section=document.querySelector('.k-study');if(!section)return;
      const now=current();
      for(const el of section.querySelectorAll('.kc'))if(!now||el.dataset.q!==now.qid)el.remove();
      if(!now)return;
      const list=known(now.book,now.qid);
      if(list===undefined){
        // Fetched while the question is open, so the comments are ready when the explanation appears.
        if(!loading.has(now.qid)){
          loading.add(now.qid);
          load(now.book,now.qid).catch(()=>{}).finally(()=>{
            loading.delete(now.qid);const again=current();
            if(again?.qid===now.qid&&known(now.book,now.qid)!==undefined&&document.querySelector('.k-study .explain'))place();
          });
        }
        return;
      }
      index(now.book).catch(()=>{});   // refreshes in the background once the index is old
      if(!list?.length||!section.querySelector('.explain')||section.querySelector('.kc[data-q="'+now.qid+'"]'))return;   // no spoilers before the answer
      section.appendChild(build(now.qid,list));
      if(!warmed)(globalThis.requestIdleCallback||(f=>setTimeout(f,1500)))(()=>warm().catch(()=>{}));
    }catch(_){}},()=>{});
  }
  function refresh(qid,focus){
    const old=document.querySelector('.kc[data-q="'+qid+'"]'),now=current(),list=now?.qid===qid?known(now.book,qid):null;
    if(!old||!list?.length)return;
    const el=build(qid,list);old.replaceWith(el);
    if(focus)el.querySelector(focus)?.focus({preventScroll:true});
  }
  ACTIONS['comments-more']=d=>{open.add(d.q);refresh(d.q,'.kc-list>.kc-item:nth-child('+(Core().VISIBLE+1)+')');};
  ACTIONS['comments-compose']=d=>{noted.has(d.q)?noted.delete(d.q):noted.add(d.q);refresh(d.q,'.kc-compose');};
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
