/* Better affordances without changing a saved state or sync format. */
globalThis.KafuEnhancements.installers.push({name:'ease-of-use',install(){
  'use strict';
  const C=KafuDesign,undo=new KafuUndoWindow();
  const originalToast=toast;
  const help={
    'This chapter is not saved on this device.':'This chapter is not available offline yet. Connect to the internet, open it once, then try again.',
    'Could not open this chapter. Your saved progress is unchanged.':'Could not open this chapter. Check your connection and tap the chapter to retry. Your saved progress is unchanged.',
    'Nothing due right now.':'Nothing due right now. Study a chapter or come back later.',
    'Images are still unavailable; try again online.':'Images are not available yet. Connect to the internet and tap Retry images.',
    'No mistakes to review.':'No mistakes to review yet. Your next chapter is in Library.'
  };
  toast=function(message){
    originalToast(help[message]||message);
    const node=document.querySelector('.toast');
    if(node){node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.setAttribute('aria-atomic','true');}
  };
  function pendingToast(text){
    toast(text);clearTimeout(toastTimer);
    const node=document.querySelector('.toast');
    if(node)node.innerHTML=`<span>${C.e(text)}</span><button class="k-undo" data-a="undo-change">Undo</button>`;
  }
  ACTIONS['undo-change']=()=>{if(undo.cancel())toast('Undone. Nothing was deleted.');};
  ACTIONS['del-pack']=data=>{
    if(!data.k||!S.dl[data.k])return;
    undo.stage(async()=>{
      try{await deleteChapter(data.k);render();toast('Download removed. Your answers and stars are kept.');}
      catch(_){toast('Could not remove this download. Open Me and try again.');}
    },{kind:'download',key:data.k});
    pendingToast('Download removal scheduled in 6 seconds.');
  };
  if(globalThis.KafuPersonal){
    const reset=KafuPersonal.reset.bind(KafuPersonal);
    ACTIONS.reset=()=>confirmBox('Reset study progress on all synced devices? Stars are kept. You will have 6 seconds to undo; after that this cannot be undone.',yes=>{
      if(!yes)return;
      undo.stage(async()=>{try{await reset();toast('Study progress reset. Your stars are kept.');}catch(_){toast('The reset could not finish. Open Me and check your saved progress.');}},{kind:'reset'});
      pendingToast('Progress reset scheduled in 6 seconds.');
    });
  }
  // Never remove a chapter that the student has opened during the grace period.
  const originalStart=startChapter;
  startChapter=function(book,ch,...rest){if(undo.pending?.meta.key===book+':'+ch){undo.cancel();toast('Download kept so you can study.');}return originalStart.call(this,book,ch,...rest);};
  window.addEventListener('pagehide',()=>undo.cancel());
  for(const action of ['fav-book','fs']){
    const old=ACTIONS[action];ACTIONS[action]=function(data,...args){
      const result=old.call(this,data,...args);
      toast(action==='fs'?'Text size updated.':S.favBooks.includes(data.b)?'Book added to My books.':'Book removed from My books.');return result;
    };
  }
  const home=VIEWS.home;
  VIEWS.home=function(...args){const view=home.apply(this,args);
    view.html=view.html.replace('<div class="empty-start"><p>Pick a book and download a chapter. After that it works without internet.</p><button class="btn small" data-a="tab" data-v="library">Open the library</button></div>',
      `<section class="k-empty"><span class="k-eyebrow">Your first small step</span><h2>Make room for a little learning.</h2><p>Choose a book and open a chapter. Save it once to keep studying offline.</p>${C.button('Find a chapter',{action:'tab',data:{v:'library'}})}</section>`);
    view.html=view.html.replace('<p class="note">Tap the heart on a book to keep it here.</p>',`<section class="k-card k-empty-compact"><h4>Your books, close at hand</h4><p class="note">Tap the heart on any book to add it here.</p>${C.button('Browse the library',{action:'tab',data:{v:'library'},variant:'quiet small'})}</section>`);
    return view;
  };
  for(const name of ['spec','book','study']){
    const previous=VIEWS[name];VIEWS[name]=function(...args){const view=previous.apply(this,args);
      const messages=['No books here yet.','This book is no longer available.','Nothing to study here yet.',"This question isn't downloaded on this device."];
      for(const message of messages){
        view.html=view.html.replace(`<p class="note">${message}</p>`,C.empty({title:name==='study'?'Choose a chapter to begin':'Let\'s find your next chapter',body:name==='study'?'Open a book from Library. Saved chapters are available offline.':'Browse another specialty or return when new books are available.',action:'find-library',label:'Open Library'}));
      }return view;
    };
  }
  ACTIONS['find-library']=()=>tab('library');
  function selectorFor(element){
    if(!element?.dataset?.a)return null;
    const escaped=value=>String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"');
    return ['a','b','c','k','i','v','r','list'].filter(k=>element.dataset[k]!==undefined).map(k=>`[data-${k}="${escaped(element.dataset[k])}"]`).join('');
  }
  const previousRender=render;let sheetOpener=null,wasSheet=false;
  render=function(scrollTop,...args){
    const active=selectorFor(document.activeElement);
    if(SHEET&&!wasSheet)sheetOpener=active;
    const result=previousRender.call(this,scrollTop,...args);
    const dialog=document.querySelector('.sheet[role="dialog"]');
    if(SHEET&&dialog){
      dialog.setAttribute('aria-modal','true');dialog.setAttribute('tabindex','-1');
      for(const outside of document.querySelectorAll('main,nav,header'))outside.inert=true;
      const target=active&&dialog.querySelector?.(active);
      (target||dialog.querySelector?.('button:not([disabled]),input')||dialog).focus?.({preventScroll:true});
    }else{
      for(const outside of document.querySelectorAll('main,nav,header'))outside.inert=false;
      const target=wasSheet&&sheetOpener?document.querySelector(sheetOpener):!scrollTop&&active?document.querySelector(active):null;
      if(target)target.focus?.({preventScroll:true});
      else if(scrollTop){const heading=document.querySelector('header h1');heading?.setAttribute('tabindex','-1');heading?.focus?.({preventScroll:true});}
    }
    wasSheet=!!SHEET;return result;
  };
  document.addEventListener('keydown',event=>{
    if(!SHEET)return;
    const dialog=document.querySelector('.sheet[role="dialog"]');if(!dialog)return;
    if(event.key==='Escape'){event.preventDefault();SHEET=null;render();return;}
    if(event.key!=='Tab')return;
    const nodes=[...dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select,textarea,[tabindex="0"]')].filter(n=>!n.hidden);
    if(!nodes.length){event.preventDefault();dialog.focus();return;}
    const first=nodes[0],last=nodes[nodes.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  globalThis.KafuUsability={undo};
}});
