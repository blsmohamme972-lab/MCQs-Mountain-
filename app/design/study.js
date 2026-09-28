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
    return{title,html:`<section class="k-complete" data-session-complete data-score="${last.percent}"><span class="k-complete-icon" aria-hidden="true">${ICON.check||'\u2713'}</span><p class="k-eyebrow">${C.e(title)}</p><h2>${last.perfect?'Beautifully done.':'A little progress adds up.'}</h2><p class="k-complete-title">${C.e(last.title)}</p><div class="k-score-ring" role="img" aria-label="${last.percent}% correct this session" style="--score:${last.percent}%"><strong>${last.percent}<small>%</small></strong></div><p class="k-score-caption">${last.correct} of ${last.answered} answered correctly</p><p class="note">${last.answered} of ${last.total} questions answered${last.skipped?`; ${last.skipped} not answered in this session`:''}.</p><div class="k-card k-complete-note"><p>${note}</p></div><div class="k-complete-actions">${review}${C.button('Browse chapters',{action:'find-library',variant:'quiet'})}</div></section>`,action:{label:'Back to Home',enabled:true,fn:()=>{SESSION=null;tab('home');}}};
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
