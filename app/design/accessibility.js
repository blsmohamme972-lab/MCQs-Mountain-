/* Semantics and reflow only; persisted font choices and all data formats stay unchanged. */
globalThis.KafuEnhancements.installers.push({name:'accessibility',install(){
  'use strict';
  const me=VIEWS.me;VIEWS.me=function(...args){const view=me.apply(this,args);view.html=view.html.replace('Question text size','Text size');return view;};
  function decorate(){
    const main=document.querySelector('main');if(!main||typeof main.querySelector!=='function')return;
    main.id='kafu-main';main.setAttribute('tabindex','-1');
    if(document.getElementById&&!document.getElementById('kafu-skip')){
      const skip=document.createElement('a');skip.id='kafu-skip';skip.className='k-skip-link';skip.href='#kafu-main';skip.textContent='Skip to content';
      skip.addEventListener('click',event=>{event.preventDefault();document.getElementById('kafu-main')?.focus();});
      document.body.prepend(skip);
    }
    const heading=document.querySelector('header h1');
    if(heading&&!heading.textContent.trim())heading.textContent=cur().v==='book'?'Book details':'Kafu';
    const stem=main.querySelector('.stem');if(stem){stem.id='kafu-question';stem.setAttribute('role','heading');stem.setAttribute('aria-level','2');stem.setAttribute('tabindex','-1');}
    const options=main.querySelector('.opts');if(options){options.setAttribute('role','group');options.setAttribute('aria-label','Answer options');}
    for(const [i,statement] of [...main.querySelectorAll('.tf')].entries()){
      const text=statement.querySelector('p');if(!text)continue;
      text.id='kafu-statement-'+i;statement.setAttribute('role','group');statement.setAttribute('aria-labelledby',text.id);
    }
    for(const field of main.querySelectorAll('input,select,textarea')){
      if(field.id&&main.querySelector('label[for="'+field.id+'"]'))continue;
      if(field.hasAttribute('aria-label')||field.hasAttribute('aria-labelledby'))continue;
      const fallback=field.getAttribute('placeholder');if(fallback)field.setAttribute('aria-label',fallback);
    }
    for(const control of main.querySelectorAll('[data-a="del-pack"]')){
      const row=control.closest('.ch-row,.row'),title=row?.querySelector('.t,.grow strong,.grow')?.textContent.trim();
      control.setAttribute('aria-label',title?'Remove download: '+title:'Remove this download');
    }
    return stem;
  }
  const previous=render;
  render=function(scrollTop,...args){
    const result=previous.call(this,scrollTop,...args),stem=decorate();
    if(scrollTop&&stem&&!SHEET)stem.focus({preventScroll:true});
    return result;
  };
  globalThis.KafuA11y={decorate};
}});
