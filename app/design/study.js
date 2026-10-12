/* Reading and completion presentation. Existing grading, FSRS and saves stay intact. */
globalThis.KafuEnhancements.installers.push({name:'study-polish',install(){
  'use strict';
  const C=KafuDesign,Core=KafuStudyCore;let last=null,lastQuestion=null,restoreReportFocus=false;
  const next=nextQuestion;
  nextQuestion=function(...args){
    const session=SESSION;
    if(!session||!['study','review'].includes(session.mode)||session.index<session.qids.length-1)
      return next.apply(this,args);
    if(session.finished)return;
    last={...Core.summarize(session.qids,session.resp),xp:globalThis.KafuXP?.session(session),title:session.title,bookId:session.bookId,chId:session.chId,mode:session.mode};
    session.finished=true;session.endedAt=Date.now();
    STACK.splice(0,STACK.length,{v:'home',p:{}},{v:'chapter-complete',p:{}});
    render(true);
    window.dispatchEvent(new CustomEvent('kafu:session-complete',{detail:last}));
  };
  VIEWS['chapter-complete']=()=>{
    if(!last)return{title:'Study session',html:C.empty({title:'Your next small step',body:'Choose a saved chapter to keep learning.',action:'find-library',label:'Open Library'})};
    const title=last.mode==='study'&&last.skipped===0?'Chapter complete':'Session complete';
    const note=last.perfect?'Every answer correct. A focused session, well spent.':'Every explanation is another step forward.';
    const secondary=last.mistakes.length?C.button('Review mistakes',{action:'session-mistakes',variant:'ghost'}):C.button('Browse chapters',{action:'find-library',variant:'ghost'});
    const stars=last.percent>=85?3:last.percent>=60?2:1,xp=last.xp??last.answered*10;
    const starSvg=i=>`<svg viewBox="0 0 24 24" aria-hidden="true" class="${i<stars?'earned':''}"><path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2-4.6-4.4 6.3-.9L12 2.8Z"/></svg>`;
    const mascot='<svg viewBox="0 0 72 72" aria-hidden="true"><path d="M18 28c0-12 8-20 18-20s18 8 18 20v22c0 9-8 14-18 14S18 59 18 50V28Z" fill="currentColor"/><circle cx="29" cy="31" r="3" fill="var(--color-surface)"/><circle cx="43" cy="31" r="3" fill="var(--color-surface)"/><path d="M28 43c5 5 11 5 16 0" fill="none" stroke="var(--color-surface)" stroke-width="3" stroke-linecap="round"/><path d="M18 39 9 33M54 39l9-6" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>';
    const confetti='<div class="k-confetti" aria-hidden="true">'+Array.from({length:12},(_,i)=>`<i style="--x:${(i%2?-1:1)*(36+i*5)}px;--y:${80+i*4}px;--delay:${i*12}ms"></i>`).join('')+'</div>';
    return{title,html:`<section class="k-complete" data-session-complete data-score="${last.percent}">${confetti}<span class="k-complete-mascot" aria-hidden="true">${mascot}</span><p class="k-eyebrow">${C.e(title)}</p><h2>${last.perfect?'Chapter mastered!':'Session cleared!'}</h2><p class="k-complete-title">${C.e(last.title)}</p><div class="k-victory-stars" role="img" aria-label="${stars} of 3 stars earned">${[0,1,2].map(starSvg).join('')}</div><div class="k-score-ring" role="img" aria-label="${last.percent}% correct this session" style="--score:${last.percent}%"><strong>${last.percent}<small>%</small></strong></div><div class="k-xp-gained"><span class="k-pixel">XP GAINED</span><strong>+${xp} XP</strong></div><p class="k-score-caption">${last.correct} of ${last.answered} answered correctly</p><p class="note">${last.answered} of ${last.total} questions answered${last.skipped?`; ${last.skipped} not answered in this session`:''}.</p><div class="k-card k-complete-note"><p>${note}</p></div></section><div class="k-complete-footer">${C.button('Next chapter',{action:'next-chapter'})}${secondary}</div>`,action:null};
  };
  ACTIONS['next-chapter']=async()=>{
    const book=(CATALOG.books||[]).find(b=>String(b.id)===String(last?.bookId));
    const chapters=book?.chapters||[],index=chapters.findIndex(ch=>String(ch.id)===String(last?.chId)),next=index>=0?chapters[index+1]:null;
    SESSION=null;
    if(next){await startChapter(book.id,next.id);return;}
    if(book){go('book',{b:book.id});return;}
    tab('library');
  };
  ACTIONS['session-mistakes']=()=>{
    const ids=(last?.mistakes||[]).filter(id=>QI[id]);
    if(!ids.length){toast('No mistakes from this session to review.');return;}
    startSession({mode:'review',title:'Review this session',qids:ids});
  };
  const study=VIEWS.study;
  VIEWS.study=function(...args){
    const view=study.apply(this,args);
    if(SESSION&&QI[SESSION.qids[SESSION.index]]){view.title=`Chapter · Q ${SESSION.index+1}/${SESSION.qids.length}`;view.html=`<section class="k-study">${view.html}</section>`;}
    return view;
  };
  function sessionCombo(session){
    let n=0;
    for(let i=session.index;i>=0;i--){
      const r=session.resp[session.qids[i]];
      if(!r?.done||!r.correct)break;
      n++;
    }
    return n;
  }
  function decorateStudy(section){
    const session=SESSION,qid=session?.qids[session.index],entry=qid&&QI[qid],q=entry?.q,r=qid&&session.resp[qid];
    if(!session||!entry||!q)return;
    const pos=session.index+1,total=session.qids.length,book=bookById(entry.b),starred=S.fav.includes(qid);
    const header=document.querySelector('.top-in');
    if(header){
      header.classList.add('k-study-topbar');
      header.innerHTML=`<button class="icon-btn back-btn k-study-icon" data-a="back" aria-label="Back to chapter">${ICON.back}</button>
        <div class="k-study-where"><div class="k-study-book">${C.e(book?.title||'Study')}</div><div class="k-study-sub"><span>${C.e(session.title||'Chapter')}</span><h1>Chapter · Q ${pos}/${total}</h1></div></div>
        <button class="icon-btn k-study-icon k-study-star ${starred?'on':''}" data-a="fav-q" aria-pressed="${starred}" aria-label="${starred?'Remove star':'Star this question'}">${starred?ICON.starOn:ICON.star}</button>
        <button class="icon-btn k-study-icon" data-a="report" aria-label="Report a problem">${ICON.flag}</button>`;
    }
    const studyTop=section.querySelector('.study-top');
    if(studyTop){
      const timer=studyTop.querySelector('.timer')?.outerHTML||'';
      let progress;
      if(total>40){
        progress=`<div class="k-long-progress" aria-hidden="true"><i style="width:${Math.max(0,Math.min(100,(pos/total)*100))}%"></i></div>`;
      }else{
        const pips=session.qids.map((id,i)=>{
          const rr=session.resp[id];
          const state=i===session.index?' current':rr?.done?(rr.correct?' correct':' wrong'):'';
          return `<i class="k-pip${state}"${i===session.index?' data-current=""':''} aria-hidden="true"></i>`;
        }).join('');
        progress=`<div class="k-pips-viewport" aria-hidden="true"><div class="k-pips">${pips}</div></div>`;
      }
      studyTop.className='study-top k-study-progress';
      studyTop.innerHTML=`${progress}<span class="k-study-count" aria-label="Question ${pos} of ${total}"><strong>${pos}</strong><span>/${total}</span></span>${timer}`;
      studyTop.setAttribute('role','progressbar');studyTop.setAttribute('aria-label','Question progress');studyTop.setAttribute('aria-valuemin','0');studyTop.setAttribute('aria-valuemax',String(total));studyTop.setAttribute('aria-valuenow',String(pos));
      const viewport=studyTop.querySelector('.k-pips-viewport'),current=viewport?.querySelector('[data-current]');
      if(viewport&&current){
        const left=current.offsetLeft-(viewport.clientWidth-current.offsetWidth)/2;
        viewport.scrollLeft=Math.max(0,left);
      }
    }
    const tools=section.querySelector('.qtools');
    tools?.querySelector('[data-a="fav-q"]')?.remove();
    tools?.querySelector('[data-a="report"]')?.remove();
    const opts=section.querySelector('.opts');
    if(opts&&!section.querySelector('.k-question-card')){
      const children=[...section.children],before=[];
      for(const child of children){
        if(child===opts)break;
        if(!child.classList.contains('study-top'))before.push(child);
      }
      const head=document.createElement('div');head.className='k-question-head';
      const combo=sessionCombo(session),xp=globalThis.KafuXP?KafuXP.session(session):Object.values(session.resp).filter(x=>x?.done&&x.correct).length*10;
      head.innerHTML=`<div class="k-question-tab"><strong>${pos}</strong><span>of ${total}</span></div><div class="k-question-hud"><span class="k-hud-streak" aria-label="${combo} correct in a row"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.2 2.5c.9 3.3 4.9 5.2 4.9 10.6A5.1 5.1 0 0 1 12 18.4a5.1 5.1 0 0 1-5.1-5.3c0-2.6 1.4-4.2 2.6-5.3.2 1.6 1 2.8 2.1 3.1-.6-2.6-.4-5.3.6-8.4z"/></svg><b>${combo}</b></span><span class="k-hud-xp k-pixel">${xp} XP</span></div>`;
      const card=document.createElement('article');card.className='k-question-card';
      section.insertBefore(head,opts);section.insertBefore(card,opts);
      before.forEach(el=>card.appendChild(el));
    }
    for(const button of section.querySelectorAll('.opt.correct,.opt.wrong')){
      if(button.querySelector('.k-answer-state'))continue;
      const state=document.createElement('span');state.className='k-answer-state';
      state.textContent=button.classList.contains('correct')?'Correct answer':'Your answer';button.appendChild(state);
    }
    const explanation=section.querySelector('.explain');
    if(explanation){
      explanation.classList.add('k-feedback-panel');
      explanation.setAttribute('role','status');explanation.setAttribute('aria-live','polite');
      const scroll=explanation.scrollIntoView.bind(explanation),reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      explanation.scrollIntoView=options=>scroll(reduced?{...options,behavior:'auto'}:options);
    }
  }
  const reportAction=ACTIONS.report;
  ACTIONS.report=function(...args){restoreReportFocus=true;return reportAction.apply(this,args);};
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||!restoreReportFocus)return;
    setTimeout(()=>{
      if(!SHEET&&document.querySelector('.k-study')){
        restoreReportFocus=false;
        document.querySelector('.k-study-topbar [data-a="report"]')?.focus({preventScroll:true});
      }
    },0);
  },true);
  const originalRender=render;
  render=function(...args){
    const result=originalRender.apply(this,args),section=document.querySelector('.k-study');
    const qid=section&&SESSION?.qids[SESSION.index];
    document.body.toggleAttribute('data-study-screen',!!section);
    if(section){
      const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if(qid!==lastQuestion&&!reduced)section.classList.add('k-question-enter');
      decorateStudy(section);
      if(restoreReportFocus&&!SHEET){
        restoreReportFocus=false;
        document.querySelector('.k-study-topbar [data-a="report"]')?.focus({preventScroll:true});
      }
    }
    lastQuestion=qid||null;return result;
  };
  globalThis.KafuStudy={get last(){return last;}};
}});
