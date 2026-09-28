/* Read-only Home/Library projections. Never changes the catalog or saved state. */
(function(root){
  'use strict';
  const norm=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const attempted=a=>a&&Number.isSafeInteger(a.n)&&a.n>0;
  function books(catalog={},query='',specialty=''){
    const removed=new Set(catalog.removed_books||[]),terms=norm(query).split(/\s+/).filter(Boolean);
    return(catalog.books||[]).filter(b=>!removed.has(b.id)&&(!specialty||b.specialty===specialty)&&terms.every(t=>norm(b.title).includes(t)));
  }
  function specialties(catalog){return[...new Set(books(catalog).map(b=>b.specialty).filter(s=>typeof s==='string'&&s))].sort((a,b)=>a.localeCompare(b,'en'));}
  function progress(book,answers={},packs={}){
    const ids=new Set();let exact=Array.isArray(book.chapters)&&book.chapters.length>0;
    for(const ch of book.chapters||[]){
      const pack=packs[book.id+':'+ch.id];
      const qids=Array.isArray(ch.qids)&&ch.qids.length===ch.questions?ch.qids:
        pack?.book_id===book.id&&pack.version===book.version&&String(pack.chapter_id)===String(ch.id)?(pack.questions||[]).map(q=>q.id):[];
      if(!Number.isSafeInteger(ch.questions)||ch.questions<0||qids.length!==ch.questions||qids.some(id=>!/^Q\d{9}$/.test(id)))exact=false;
      for(const id of qids){if(ids.has(id))exact=false;ids.add(id);}
    }
    if(exact){const total=ids.size,answered=[...ids].filter(id=>attempted(answers[id])&&answers[id].b===book.id).length;return{answered,total,percent:total?Math.round(answered/total*100):0,exact:true};}
    return{answered:Object.values(answers).filter(a=>attempted(a)&&a.b===book.id).length,total:book.questions||0,percent:0,exact:false};
  }
  function goal(state,today,minutes=10){
    const target=Number.isFinite(minutes)&&minutes>0?minutes:10,raw=state.time?.[today],seconds=Number.isFinite(raw)&&raw>0?Math.floor(raw):0;
    return{seconds,minutes:Math.floor(seconds/60),target,percent:Math.min(100,Math.round(seconds/(target*60)*100)),complete:seconds>=target*60};
  }
  function resume(state,catalog){
    const r=state.resume,b=r&&books(catalog).find(b=>b.id===r.b),ch=b?.chapters?.find(ch=>String(ch.id)===String(r.ch));
    return b&&ch?{book:b,chapter:ch}:null;
  }
  const api={books,specialties,progress,goal,resume};root.KafuDiscoveryCore=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
