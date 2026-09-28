globalThis.KafuEnhancements.installers.push({name:"invisible-downloads",install(){
  "use strict";
  const Core=globalThis.KafuDownloadCore,sizeCache=new Map(),sizeRequests=new Set(),bookJobs=new Map();
  const originalDelete=deleteChapter,originalFetch=fetchPack;
  const metadata=(bookId,chapterId)=>{
    const book=bookById(bookId),ch=book?.chapters.find(c=>String(c.id)===String(chapterId));
    if(!book||!ch)throw new Error('Book or chapter is not in this catalog');
    return{book:book.id,chapter:ch.id,version:book.version,questions:ch.questions,url:ch.url||null,image_url:ch.image_url||null,
      bytes:ch.bytes,image_bytes:ch.image_bytes??sizeCache.get(ch.image_url)};
  };
  function safeURL(value){
    const base=CONFIG.CONTENT_BASE||location.origin,url=new URL(value,base);
    if(url.protocol!=='https:'||url.username||url.password||![new URL(base).origin,location.origin].includes(url.origin)||/^\/(?:api|internal|bot)(?:\/|$)/.test(url.pathname))throw new Error('Invalid content URL');
    return url.href;
  }
  async function read(value,limit,method='GET'){
    const controller=typeof AbortController==='function'?new AbortController():null;
    const timer=setTimeout(()=>controller?.abort(),45000);
    try{
      const response=await fetch(safeURL(value),{method,credentials:'omit',signal:controller?.signal});
      if(!response.ok)throw new Error('Content HTTP '+response.status);
      const length=Number(response.headers.get('content-length'));
      if(length>limit)throw new Error('Content exceeds the safe download size');
      if(method==='HEAD')return Number.isFinite(length)&&length>0?length:null;
      if(response.body?.getReader){
        const reader=response.body.getReader(),chunks=[];let total=0;
        try{while(true){const part=await reader.read();if(part.done)break;total+=part.value.length;if(total>limit)throw new Error('Content exceeds the safe download size');chunks.push(part.value);}}
        catch(error){await reader.cancel().catch(()=>{});throw error;}
        const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
      }
      const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>limit)throw new Error('Content exceeds the safe download size');return bytes;
    }finally{clearTimeout(timer);}
  }
  function changed(){if(CATALOG)render();}
  const manager=new Core.Manager({
    cached:key=>PACKS[key],online:()=>navigator.onLine!==false,
    async text(meta){if(!meta.url)return originalFetch(meta.book,meta.chapter);return JSON.parse(new TextDecoder().decode(await read(meta.url,Core.MAX_TEXT)));},
    async images(meta,expected){const raw=await read(meta.image_url,Core.MAX_ZIP);return{files:Core.decodeImages(raw,expected,globalThis.fflate),bytes:raw.length};},
    async saveText(key,pack){const stored={...pack,img:{}};await DB.put('packs',key,stored);S.dl[key]={v:pack.version,size:(pack._text_bytes||0)+(pack._image_bytes||0),at:Date.now(),complete:pack._offline_complete};saveState();},
    async saveImages(key,files,pack){
      for(const [name,bytes]of Object.entries(files))await DB.put('images',imageKey(key,name),new Blob([bytes],{type:'image/webp'}));
      pack._image_names=Object.keys(files);releaseImageUrls(key);await hydratePackImages(key,pack);
    },
    show(key,pack){if(PACKS[key]&&PACKS[key]!==pack)unindexPack(PACKS[key]);PACKS[key]=pack;indexPack(pack);},changed
  });
  ensureFflate=()=>globalThis.fflate?.unzipSync?Promise.resolve(globalThis.fflate):Promise.reject(new Error('Bundled ZIP decoder unavailable'));
  downloadChapter=async function(bookId,chId,quiet){
    try{return await manager.open(metadata(bookId,chId));}
    catch(_){if(!quiet)toast(navigator.onLine===false?'This chapter is not saved on this device.':'Could not open this chapter. Your saved progress is unchanged.');return PACKS[bookId+':'+chId]||null;}
  };
  startChapter=async function(bookId,chId,qid){
    const pack=await downloadChapter(bookId,chId);if(!pack)return;
    const book=bookById(bookId),ch=book.chapters.find(c=>String(c.id)===String(chId)),qids=pack.questions.map(q=>q.id);
    let index=qid?Math.max(0,qids.indexOf(qid)):qids.findIndex(id=>!S.answers[id]);if(index<0)index=0;
    startSession({mode:'study',title:ch?.title||'Chapter',qids,index,bookId,chId:ch.id});
    const pos=book.chapters.indexOf(ch),next=book.chapters[pos+1],connection=navigator.connection;
    if(next&&navigator.onLine!==false&&!connection?.saveData&&!/^(slow-)?2g$/.test(connection?.effectiveType||'')){
      // One next chapter only; completing a prefetch does not recursively prefetch.
      Promise.resolve().then(()=>manager.finish(metadata(bookId,next.id))).catch(()=>{});
    }
  };
  deleteChapter=key=>manager.remove(key,()=>originalDelete(key));
  function available(bookId,chId){try{return !!DB.db&&Core.complete(PACKS[bookId+':'+chId],metadata(bookId,chId));}catch(_){return false;}}
  function sizeLabel(book){
    const size=Core.bookSize(book.chapters.map(c=>metadata(book.id,c.id)),key=>PACKS[key]);
    const label=size.bytes>=1048576?(size.bytes/1048576).toFixed(1)+' MB':Math.max(1,Math.ceil(size.bytes/1024))+' KB';
    return size.exact?'about '+label:'at least '+label+' (some image sizes unavailable)';
  }
  async function estimateImages(book){
    if(navigator.onLine===false||sizeRequests.has(book.id)||navigator.connection?.saveData)return;
    sizeRequests.add(book.id);
    // Never fan out across a large library: at most eight headers for this book.
    for(const ch of book.chapters.filter(c=>c.image_url&&c.image_bytes===undefined&&!sizeCache.has(c.image_url)).slice(0,8)){
      try{const bytes=await read(ch.image_url,Core.MAX_ZIP,'HEAD');if(bytes)sizeCache.set(ch.image_url,bytes);}catch(_){}
    }
    if(cur().v==='book'&&cur().p?.b===book.id)changed();
  }
  VIEWS.book=function(p){
    const book=bookById(p.b);if(!book)return{title:'Book',html:'<p class="note">This book is no longer available.</p>'};
    const stats=bookStats(book),favorite=S.favBooks.includes(book.id),all=book.chapters.every(ch=>available(book.id,ch.id)),job=bookJobs.get(book.id);
    estimateImages(book);
    const rows=book.chapters.map((ch,i)=>{
      const key=book.id+':'+ch.id,pack=PACKS[key],busy=manager.isBusy(key),ready=available(book.id,ch.id);
      const note=ready?'Available offline ✓':busy?'Saving in the background…':manager.errors.has(key)?'Text saved; tap to retry missing images':pack&&!DB.db?'Available in this session':'Opens now; saves automatically';
      const answered=(pack?.questions||[]).filter(q=>S.answers[q.id]).length;
      return `<button class="ch-row" style="width:100%;text-align:left" data-a="study-ch" data-b="${esc(book.id)}" data-c="${esc(ch.id)}"><span class="ch-no">${i+1}</span><span class="grow"><span class="t">${esc(ch.title)}</span><br><span class="s note">${ch.questions} questions${answered?', '+answered+' answered':''}<br>${note}</span></span>${busy?'<span class="spin" aria-label="Saving"></span>':ICON.next}</button>`;
    }).join('');
    return{title:'',html:`<div class="book-head">${coverHTML(book)}<div><h2>${esc(book.title)}</h2><div class="meta">${esc(book.specialty)}<br>${book.questions} questions, ${stats.pct}% done</div><div class="pbar"><i style="width:${stats.pct}%"></i></div><button class="pill ${favorite?'on':''}" data-a="fav-book" data-b="${esc(book.id)}">${favorite?ICON.heartOn:ICON.heart} ${favorite?'In my books':'Add to my books'}</button></div></div>
      <button class="btn ghost" style="width:100%" data-a="save-book" data-b="${esc(book.id)}" ${job?'disabled':''}>${all?'Available offline ✓':job?`Saving ${job.done} of ${job.total} chapters…`:'Save whole book for offline'}</button><p class="note">${esc(sizeLabel(book))}${DB.db?'':' — persistent storage is unavailable; this session only'}</p><h3 class="sec">Chapters</h3><div class="list">${rows}</div>`};
  };
  ACTIONS['save-book']=async data=>{
    const book=bookById(data.b);if(!book||bookJobs.has(book.id))return;
    bookJobs.set(book.id,{done:0,total:book.chapters.length});changed();
    try{const result=await manager.saveBook(book.chapters.map(ch=>metadata(book.id,ch.id)),(saved,failed,total)=>{bookJobs.set(book.id,{done:saved+failed,total});changed();});
      toast(result.failed.length?`${result.saved} chapters saved; ${result.failed.length} need retry.`:DB.db?'Book available offline.':'Book loaded for this session; persistent storage unavailable.');
    }finally{bookJobs.delete(book.id);changed();}
  };
  ACTIONS['dl-all']=ACTIONS['save-book'];
  ACTIONS['dl']=data=>startChapter(data.b,Number(data.c));
  ACTIONS['retry-images']=data=>manager.finish(metadata(data.b,data.c)).catch(()=>toast('Images are still unavailable; try again online.'));
  const study=VIEWS.study;
  VIEWS.study=function(...args){
    const view=study.apply(this,args);if(!SESSION?.qids.length)return view;
    const qid=SESSION.qids[SESSION.index],entry=QI[qid],q=entry?.q,pack=entry&&PACKS[entry.b+':'+entry.ch];if(!q||!pack)return view;
    const missing=(q.images||[]).some(name=>!pack.img?.[name]),missingExplanation=(q.explanation_images||[]).some(name=>!pack.img?.[name]);
    if(missing||(SESSION.resp[qid]?.done&&missingExplanation)){
      view.html=`<p class="note" role="status">${manager.isBusy(entry.b+':'+entry.ch)?'Images are downloading in the background.':'Some images are not saved on this device.'} <button data-a="retry-images" data-b="${esc(entry.b)}" data-c="${esc(entry.ch)}">Retry images</button></p>`+view.html;
      if(missing&&!SESSION.resp[qid]?.done)view.action={label:'Waiting for question image',enabled:false,fn:()=>{}};
    }
    return view;
  };
  const submit=submitCurrent;
  submitCurrent=function(...args){const qid=SESSION?.qids[SESSION.index],entry=qid&&QI[qid];if(entry&&(entry.q.images||[]).some(name=>!PACKS[entry.b+':'+entry.ch]?.img?.[name])){toast('Wait for the question image before answering.');return;}return submit.apply(this,args);};
  globalThis.KafuDownloads={manager,metadata,available,sizeLabel,read,estimateImages};
}});
