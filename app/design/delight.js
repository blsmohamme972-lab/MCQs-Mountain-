globalThis.KafuEnhancements.installers.push({name:'tasteful-delight',install(){
  'use strict';
  const Core=KafuDelightCore,C=KafuDesign;
  const owner=IN_TG&&Number.isSafeInteger(TG.initDataUnsafe?.user?.id)?String(TG.initDataUnsafe.user.id):'browser';
  const storageKey=Core.key(owner);let record=null,writable=false,pending=Promise.resolve();
  const flame='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M17 2c2 7-5 9-3 15 2-1 4-4 4-7 6 4 10 8 10 13a12 12 0 0 1-24 0c0-8 8-11 13-21Z" fill="currentColor"/><path d="M16 16c3 3 5 5 5 8a5 5 0 0 1-10 0c0-3 2-5 5-8Z" fill="var(--color-accent-a)"/></svg>';
  const check='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const lock='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  const badges=[['first_chapter','First chapter','Answer every question in a chapter'],['week_streak','Seven steady days','Study on seven days in a row'],['hundred_questions','100 questions','Answer 100 different questions'],['first_perfect','Chapter mastered','Record a correct answer for every question in a chapter']];
  const motion=()=>!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  for(const name of ['tap','ok','no']){const fn=haptic[name];haptic[name]=function(...args){if(!motion())return;try{return fn.apply(this,args);}catch(_){return;}};}
  const project=()=>Core.derive(S,CATALOG||{},dayKey());
  const open=DB.open.bind(DB);DB.open=async function(...args){await open(...args);try{const plan=Core.migrate(await DB.get('meta',storageKey));record=plan.record;writable=plan.writable;}catch(_){record={schema:1,shown:{}};writable=false;}};
  function remember(ids){
    pending=pending.catch(()=>{}).then(async()=>{
      if(!record||!ids.length)return;
      const next=Core.markShown(record,ids,dayKey());if(JSON.stringify(next)===JSON.stringify(record))return;
      record=next;if(writable&&DB.db)try{await DB.put('meta',storageKey,record);}catch(_){writable=false;}
    });return pending;
  }
  const answer=recordAnswer;
  recordAnswer=function(q,r){
    const before=Core.streaks(S.active,dayKey()),result=answer.call(this,q,r),after=Core.streaks(S.active,dayKey());
    const newly=[];
    if(after.longest>=7&&before.longest<7){newly.push('week_streak');if(r.correct&&!record?.shown?.week_streak)toast('Kafu! Seven steady days of learning.');}
    remember(newly);return result;
  };
  window.addEventListener('kafu:session-complete',event=>{if(event.detail?.answered>0){const earned=project().earned;remember(Core.IDS.filter(id=>earned[id]));haptic.ok();}});
  const study=VIEWS.study;VIEWS.study=function(...args){const result=study.apply(this,args),id=SESSION?.qids[SESSION.index],r=SESSION?.resp[id];
    if(r?.done&&r.correct&&SESSION.mode!=='exam')result.html=result.html.replace(/<div class="res ok">[\s\S]*?<\/div>/,`<div class="res ok k-feedback-correct">${check}<span>Correct — Kafu!</span></div>`);
    return result;
  };
  const completed=VIEWS['chapter-complete'];VIEWS['chapter-complete']=function(...args){const result=completed.apply(this,args);return result;};
  function levelState(){
    const answered=project().answered,xp=globalThis.KafuXP?KafuXP.total():answered*10,level=Math.floor(xp/100)+1,into=xp%100;
    return{answered,xp,level,into,next:100};
  }
  function homeMarkup(){
    const state=project(),level=levelState();
    return `<section class="k-game-hud" aria-label="Study game progress"><span class="k-level-badge k-pixel">LV ${level.level}</span><div class="k-xp"><span><strong>${level.xp} XP</strong><small>${level.into} / ${level.next} to next level</small></span><div class="k-xp-track" role="progressbar" aria-label="XP to next level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${level.into}"><i style="width:${level.into}%"></i></div></div><div class="k-streak" aria-label="${state.streak} day study streak">${flame}<strong>${state.streak}</strong><span>day streak</span></div></section>`;
  }
  const home=VIEWS.home;VIEWS.home=function(...args){const result=home.apply(this,args);if(!globalThis.KafuOnboarding?.needed)result.html=homeMarkup()+result.html;return result;};
  const me=VIEWS.me;VIEWS.me=function(...args){
    const result=me.apply(this,args),state=project(),level=levelState();
    const profile=`<section class="k-profile-card"><div class="k-profile-level"><span class="k-pixel">STUDENT LEVEL</span><strong>${level.level}</strong></div><div class="k-profile-xp"><span>${level.xp} XP</span><div class="k-xp-track" role="progressbar" aria-label="XP to next level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${level.into}"><i style="width:${level.into}%"></i></div><small>${level.into} / ${level.next} to level ${level.level+1}</small></div><div class="k-pixel k-profile-badge">BADGE CASE</div></section>`;
    const badgeMark='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8 5h16v18l-8 5-8-5V5Z" fill="currentColor"/><path d="m16 9 2 4 5 .7-3.5 3.4.8 4.9-4.3-2.3-4.3 2.3.8-4.9L9 13.7l5-.7 2-4Z" fill="var(--color-surface)"/></svg>';
    const shelf=`<section class="k-badge-shelf" aria-labelledby="badge-title"><h3 id="badge-title" class="sec">Badge showcase</h3><div class="k-badges">${badges.map(([id,title,body])=>{const earned=!!state.earned[id];return`<button class="k-badge ${earned?'earned':'locked'}" data-a="badge-detail" data-b="${id}" aria-expanded="false" aria-label="${C.e(title)}: ${earned?'earned':'locked'}"><span class="k-badge-icon" aria-hidden="true">${badgeMark}</span><strong>${C.e(title)}</strong><span class="k-badge-detail" hidden>${earned?'Unlocked. ':''}${C.e(body)}</span></button>`;}).join('')}</div></section>`;
    ACTIONS['badge-detail']=data=>{const button=document.querySelector(`.k-badge[data-b="${CSS.escape(String(data.b||''))}"]`);if(!button)return;const detail=button.querySelector('.k-badge-detail'),open=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!open));if(detail)detail.hidden=open;};
    result.html=profile+shelf+result.html;return result;
  };
  globalThis.KafuDelight={get record(){return record;},get achievements(){return project();},storageKey,homeMarkup,settled:()=>pending,motion};
}});
