/* Reading and completion presentation. Existing grading, FSRS and saves stay intact. */
globalThis.KafuEnhancements.installers.push({name:'study-polish',install(){
  'use strict';
  const C=KafuDesign,Core=KafuStudyCore;let last=null,lastQuestion=null;
  const next=nextQuestion;
  nextQuestion=function(...args){
    const session=SESSION;
    if(!session||!['study','review'].includes(session.mode)||session.index<session.qids.length-1)
      return next.apply(this,args);
    if(session.finished)return;
    last={...Core.summarize(session.qids,session.resp),title:session.title,bookId:session.bookId,chId:session.chId,mode:session.mode};
    session.finished=true;session.endedAt=Date.now();
    STACK[STACK.length-1]={v:'chapter-complete',p:{}};
    render(true);
    window.dispatchEvent(new CustomEvent('kafu:session-complete',{detail:last}));
  };
  VIEWS['chapter-complete']=()=>{
    if(!last)return{title:'Study session',html:C.empty({title:'Your next small step',body:'Choose a saved chapter to keep learning.',action:'find-library',label:'Open Library'})};
    const title=last.mode==='study'&&last.skipped===0?'Chapter complete':'Session complete';
    const note=last.perfect?'Every answer correct. A focused session, well spent.':'Every explanation is another step forward.';
    const review=last.mistakes.length?C.button('Review mistakes',{action:'session-mistakes',variant:'ghost'}):'';
    const stars=last.percent>=85?3:last.percent>=60?2:1,xp=last.answered*10;
    const starSvg=i=>`<svg viewBox="0 0 24 24" aria-hidden="true" class="${i<stars?'earned':''}"><path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2-4.6-4.4 6.3-.9L12 2.8Z"/></svg>`;
    const mascot='<svg viewBox="0 0 72 72" aria-hidden="true"><path d="M18 28c0-12 8-20 18-20s18 8 18 20v22c0 9-8 14-18 14S18 59 18 50V28Z" fill="currentColor"/><circle cx="29" cy="31" r="3" fill="var(--color-surface)"/><circle cx="43" cy="31" r="3" fill="var(--color-surface)"/><path d="M28 43c5 5 11 5 16 0" fill="none" stroke="var(--color-surface)" stroke-width="3" stroke-linecap="round"/><path d="M18 39 9 33M54 39l9-6" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>';
    const confetti='<div class="k-confetti" aria-hidden="true">'+Array.from({length:12},(_,i)=>`<i style="--i:${i}"></i>`).join('')+'</div>';
    return{title,html:`<section class="k-complete" data-session-complete data-score="${last.percent}">${confetti}<span class="k-complete-mascot" aria-hidden="true">${mascot}</span><p class="k-eyebrow">${C.e(title)}</p><h2>${last.perfect?'Chapter mastered!':'Session cleared!'}</h2><p class="k-complete-title">${C.e(last.title)}</p><div class="k-victory-stars" role="img" aria-label="${stars} of 3 stars earned">${[0,1,2].map(starSvg).join('')}</div><div class="k-score-ring" role="img" aria-label="${last.percent}% correct this session" style="--score:${last.percent}%"><strong>${last.percent}<small>%</small></strong></div><div class="k-xp-gained"><span class="k-pixel">XP GAINED</span><strong>+${xp} XP</strong></div><p class="k-score-caption">${last.correct} of ${last.answered} answered correctly</p><p class="note">${last.answered} of ${last.total} questions answered${last.skipped?`; ${last.skipped} not answered in this session`:''}.</p><div class="k-card k-complete-note"><p>${note}</p></div><div class="k-complete-actions">${review}${C.button('Browse chapters',{action:'find-library',variant:'quiet'})}</div></section>`,action:{label:'Back to Home',enabled:true,fn:()=>{SESSION=null;tab('home');}}};
  };
  ACTIONS['session-mistakes']=()=>{
    const ids=(last?.mistakes||[]).filter(id=>QI[id]);
    if(!ids.length){toast('No mistakes from this session to review.');return;}
    startSession({mode:'review',title:'Review this session',qids:ids});
  };
  const study=VIEWS.study;
  VIEWS.study=function(...args){
    const view=study.apply(this,args);
    if(SESSION&&QI[SESSION.qids[SESSION.index]])view.html=`<section class="k-study">${view.html}</section>`;
    return view;
  };
  const originalRender=render;
  render=function(...args){
    const result=originalRender.apply(this,args),section=document.querySelector('.k-study');
    const qid=section&&SESSION?.qids[SESSION.index];
    if(section){
      const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if(qid!==lastQuestion&&!reduced)section.classList.add('k-question-enter');
      const progress=section.querySelector('.pbar');
      if(progress){progress.setAttribute('role','progressbar');progress.setAttribute('aria-label','Question progress');progress.setAttribute('aria-valuemin','0');progress.setAttribute('aria-valuemax',String(SESSION.qids.length));progress.setAttribute('aria-valuenow',String(SESSION.index+1));}
      for(const button of section.querySelectorAll('.opt.correct,.opt.wrong')){
        const state=document.createElement('span');state.className='k-answer-state';
        state.textContent=button.classList.contains('correct')?'Correct answer':'Your answer';button.appendChild(state);
      }
      const explanation=section.querySelector('.explain');
      if(explanation){
        explanation.setAttribute('role','status');explanation.setAttribute('aria-live','polite');
        const scroll=explanation.scrollIntoView.bind(explanation);
        explanation.scrollIntoView=options=>scroll(reduced?{...options,behavior:'auto'}:options);
      }
    }
    lastQuestion=qid||null;return result;
  };
  globalThis.KafuStudy={get last(){return last;}};
}});
