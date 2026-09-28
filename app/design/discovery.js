/* Search is session-local. Progress/goal/streak are views of existing data. */
globalThis.KafuEnhancements.installers.push({name:'home-library',install(){
  'use strict';
  const Core=KafuDiscoveryCore,C=KafuDesign;
  let query='',specialty='',initialized=false;
  // Keep the existing educational notice and offline banner on replaced views.
  const notices=view=>(view.html.match(/<section class="education-notice"[\s\S]*?<\/section>|<div class="offline-banner"[\s\S]*?<\/div>/g)||[]).join('');
  function offline(book){const total=book.chapters?.length||0,n=(book.chapters||[]).filter(ch=>KafuDownloads.available(book.id,ch.id)).length;return total&&n===total?'Available offline':n?`${n} of ${total} chapters offline`:'Open a chapter to save it';}
  function specialtyIcon(book){
    const key=String(book.specialty||'').toLowerCase();
    if(key.includes('cardio'))return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 53S10 40 10 23c0-8 5-13 12-13 5 0 8 3 10 7 2-4 5-7 10-7 7 0 12 5 12 13 0 17-22 30-22 30Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="M16 31h10l4-9 6 18 4-9h8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    if(key.includes('pharma'))return '<svg viewBox="0 0 64 64" aria-hidden="true"><g transform="rotate(-35 32 32)"><rect x="10" y="22" width="44" height="20" rx="10" fill="none" stroke="currentColor" stroke-width="5"/><path d="M32 22v20" stroke="currentColor" stroke-width="5"/></g></svg>';
    if(key.includes('surg'))return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M12 48 43 17l4 4-31 31-7 3 3-7Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="m42 18 5-5 8 8-5 5" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M20 45c8 5 18 5 28 0" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>';
    return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M18 10h28v44H18z" fill="none" stroke="currentColor" stroke-width="5"/><path d="M26 22h12M26 32h12M26 42h8" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>';
  }
  function stars(percent){
    const earned=percent>=100?3:percent>=60?2:percent>0?1:0;
    return '<span class="k-mastery-stars" aria-label="'+earned+' of 3 mastery stars">'+[0,1,2].map(i=>'<svg viewBox="0 0 24 24" aria-hidden="true" class="'+(i<earned?'earned':'')+'"><path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2-4.6-4.4 6.3-.9L12 2.8Z"/></svg>').join('')+'</span>';
  }
  function cover(book,p){
    let url=null;try{const parsed=new URL(book.cover_url,CONFIG.CONTENT_BASE||location.origin);if(book.cover_url&&parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&[location.origin,new URL(CONFIG.CONTENT_BASE||location.origin).origin].includes(parsed.origin))url=parsed.href;}catch(_){}
    const long=String(book.title||'').length>18?' long-title':'';
    return url?`<span class="k-book-cover has-image${long}" aria-hidden="true"><img src="${C.e(url)}" alt="" loading="lazy" decoding="async">${stars(p.percent)}</span>`:
      `<span class="k-book-cover${long}" aria-hidden="true"><span class="k-cover-pattern"></span><span class="k-cover-specialty">${C.e(book.specialty||'Practice')}</span><span class="k-cover-icon">${specialtyIcon(book)}</span><strong>${C.e(book.title)}</strong>${stars(p.percent)}<span class="k-cover-footer">Kafu collectible</span></span>`;
  }
  bookCard=function(book){
    const p=Core.progress(book,S.answers,PACKS),note=p.exact?`${p.answered} of ${p.total} answered`:`${p.answered} saved answers`,availability=offline(book);
    return`<button class="book-card k-library-book" data-a="open-book" data-b="${C.e(book.id)}" aria-label="${C.e(book.title)}. ${C.e(note)}. ${C.e(availability)}">${cover(book,p)}<span class="bt">${C.e(book.title)}</span><span class="bs">${C.e(book.specialty||'Practice')} &middot; ${Number(book.questions)||0} ${book.questions===1?'question':'questions'}</span>${p.exact?C.progress(p.answered,p.total,book.title+' progress'):''}<span class="k-book-progress">${C.e(note)}</span><span class="k-offline-label">${C.e(availability)}</span></button>`;
  };
  function results(){
    const list=Core.books(CATALOG,query,specialty),all=Core.books(CATALOG);
    if(!all.length)return C.empty({title:'Your library will appear here',body:'Connect to the internet and reopen Kafu to refresh the library. Your saved study progress is unchanged.',action:'library-home',label:'Back to Home'});
    return list.length?`<div class="books k-book-grid">${list.map(bookCard).join('')}</div>`:C.empty({title:'No matching books',body:'Try a shorter title or another specialty. Nothing has been removed from your library.',action:'library-clear',label:'Clear filters'});
  }
  function count(){const n=Core.books(CATALOG,query,specialty).length;return`${n} ${n===1?'book':'books'}${specialty?' in '+specialty:''}${query?' matching your search':''}`;}
  function controls(){
    return`<div class="k-library-controls"><div class="k-search-field"><label for="kafu-book-search">Search books</label><div class="k-search-input"><input id="kafu-book-search" type="search" maxlength="120" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Search by title" value="${C.e(query)}" aria-controls="kafu-book-results"><button data-a="library-clear-search" aria-label="Clear search">${ICON.x}</button></div></div><div class="k-specialty-field"><label for="kafu-specialty-filter">Specialty</label><select id="kafu-specialty-filter" aria-controls="kafu-book-results"><option value="">All specialties</option>${Core.specialties(CATALOG).map(s=>`<option value="${C.e(s)}"${s===specialty?' selected':''}>${C.e(s)}</option>`).join('')}</select></div></div><p class="k-result-count" id="kafu-book-count" role="status" aria-live="polite">${C.e(count())}</p>`;
  }
  function updateResults(){
    const result=document.getElementById('kafu-book-results'),status=document.getElementById('kafu-book-count');
    if(result)result.innerHTML=results();if(status)status.textContent=count();
  }
  ACTIONS['library-home']=()=>tab('home');
  ACTIONS['library-clear']=()=>{query='';specialty='';const input=document.getElementById('kafu-book-search'),select=document.getElementById('kafu-specialty-filter');if(input)input.value='';if(select)select.value='';updateResults();input?.focus();};
  ACTIONS['library-clear-search']=()=>{query='';const input=document.getElementById('kafu-book-search');if(input)input.value='';updateResults();input?.focus();};
  document.addEventListener('input',event=>{if(event.target.id==='kafu-book-search'){query=event.target.value.slice(0,120);updateResults();}});
  document.addEventListener('change',event=>{if(event.target.id==='kafu-specialty-filter'){specialty=event.target.value;updateResults();}});
  const library=VIEWS.library;
  VIEWS.library=function(...args){
    const view=library.apply(this,args);
    if(!initialized){const first=globalThis.KafuOnboarding?.specialty;specialty=Core.specialties(CATALOG).includes(first)?first:'';initialized=true;}
    view.html=notices(view)+`<section class="k-library"><h2>Find your next chapter.</h2><p class="note">A little focus, one book at a time.</p>${controls()}<div id="kafu-book-results">${results()}</div></section>`;return view;
  };
  const home=VIEWS.home;
  VIEWS.home=function(...args){
    const view=home.apply(this,args);if(globalThis.KafuOnboarding?.needed)return view;
    const r=Core.resume(S,CATALOG),g=Core.goal(S,dayKey()),due=KafuReview.due(),ready=due.filter(id=>QI[id]).length;
    const resume=r?`<button class="k-continue" data-a="continue"><span class="k-eyebrow">Continue studying</span><strong>${C.e(r.book.title)}</strong><span>${C.e(r.chapter.title)}</span><span class="k-continue-action">Continue ${ICON.chev}</span></button>`:
      `<section class="k-card k-first-step"><p class="k-eyebrow">Your next small step</p><h3>Start with one chapter.</h3><p class="note">Open it once, then look for Available offline before you go.</p>${C.button('Find a chapter',{action:'tab',data:{v:'library'}})}</section>`;
    const starred=(S.favBooks||[]).map(id=>Core.books(CATALOG).find(b=>b.id===id)).filter(Boolean),total=Core.books(CATALOG).length;
    const state=globalThis.KafuDelight?.achievements||{answered:0,streak:0},xp=(state.answered||0)*10,level=Math.floor(xp/100)+1;
    const goalRing=`<div class="k-goal-ring" role="img" aria-label="${g.minutes} of ${g.target} daily study minutes" style="--goal:${g.percent*3.6}deg"><div><strong>${g.minutes}</strong><span>/ ${g.target} min</span></div></div>`;
    view.html=notices(view)+`<section class="k-home"><div class="k-home-welcome"><div><p class="k-eyebrow">Your study arcade</p><h2>${C.e(partOfDay())}, ${C.e(greetingName())}.</h2><p class="note">One focused step is enough to begin.</p></div></div>${globalThis.KafuDelight?.homeMarkup()||''}<div class="k-home-dashboard"><div>${resume}</div><section class="k-card k-today"><div><p class="k-eyebrow">Daily goal</p><h3>Keep the streak moving</h3><p class="note">${g.complete?'Goal reached. Kafu!':'Study time counts while you use a chapter.'}</p></div>${goalRing}</section></div><h3 class="sec">A useful next step</h3><div class="list">${rowHTML('review-due',{},ICON.clock,'Review Due',due.length?`${ready} available offline`:'Nothing due. A good time for your next chapter.',due.length)}${rowHTML('practice',{list:'mistakes'},ICON.review,'My mistakes','Return to questions that need another look',null,true)}${rowHTML('practice',{list:'favorites'},ICON.star,'Starred questions','Keep the useful ones close',null)}</div><section class="k-my-books"><h3 class="sec">My books <button data-a="tab" data-v="library">Browse all ${total||''}</button></h3>${starred.length?`<div class="books k-book-grid">${starred.map(bookCard).join('')}</div>`:`<div class="k-card"><p class="note">Use the heart on a book to keep it here.</p>${C.button('Explore Library',{action:'tab',data:{v:'library'},variant:'ghost'})}</div>`}</section></section>`;
    return view;
  };
  globalThis.KafuDiscovery={get query(){return query;},get specialty(){return specialty;},progress:book=>Core.progress(book,S.answers,PACKS)};
}});
