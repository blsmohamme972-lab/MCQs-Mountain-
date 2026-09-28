globalThis.KafuEnhancements.installers.push({name:'tasteful-delight',install(){
  'use strict';
  const Core=KafuDelightCore,C=KafuDesign;
  const owner=IN_TG&&Number.isSafeInteger(TG.initDataUnsafe?.user?.id)?String(TG.initDataUnsafe.user.id):'browser';
  const storageKey=Core.key(owner);let record=null,writable=false,pending=Promise.resolve();
  const flame='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 5-4 6-3 10 2-1 3-3 3-4 4 3 7 5 7 9a7 7 0 0 1-14 0C5 11 11 9 12 2Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
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
    if(after.longest>=7&&before.longest<7){newly.push('week_streak');if(r.correct&&!record?.shown?.week_streak)toast('Kafu! \ud83d\udc4f Seven steady days of learning.');}
    remember(newly);return result;
  };
  window.addEventListener('kafu:session-complete',event=>{if(event.detail?.answered>0){remember(Core.IDS.filter(id=>project().earned[id]));haptic.ok();}});
  const study=VIEWS.study;VIEWS.study=function(...args){const result=study.apply(this,args),id=SESSION?.qids[SESSION.index],r=SESSION?.resp[id];
    if(r?.done&&r.correct&&SESSION.mode!=='exam')result.html=result.html.replace('<div class="res ok">',`<span class="k-kafu">${C.e(Core.phrase(id,S.answers[id]?.n))}</span><div class="res ok">`);
    return result;
  };
  const completed=VIEWS['chapter-complete'];VIEWS['chapter-complete']=function(...args){const result=completed.apply(this,args);if(KafuStudy.last?.answered>0)result.html=result.html.replace('<p class="k-eyebrow">','<p class="k-kafu k-complete-kafu">Kafu! \ud83d\udc4f</p><p class="k-eyebrow">');return result;};
  function homeMarkup(){const days=project().streak;return`<div class="k-streak" aria-label="${days} day study streak">${flame}<strong>${days}</strong><span>${days===1?'day of learning':'days of learning'}</span></div>`;}
  const home=VIEWS.home;VIEWS.home=function(...args){const result=home.apply(this,args);if(!globalThis.KafuOnboarding?.needed)result.html=homeMarkup()+result.html;return result;};
  const me=VIEWS.me;VIEWS.me=function(...args){const result=me.apply(this,args),state=project();result.html=`<section class="k-badge-shelf" aria-labelledby="badge-title"><h3 id="badge-title" class="sec">Small wins</h3><p class="note">Built from your study progress. Restored with your Telegram backup on a new phone.</p><div class="k-badges">${badges.map(([id,title,body])=>{const earned=!!state.earned[id];return`<div class="k-badge ${earned?'earned':''}" data-badge="${id}" aria-label="${C.e(title)}: ${earned?'earned':'not yet earned'}"><span class="k-badge-icon" aria-hidden="true">${earned?'\u2713':'\u25cb'}</span><div><strong>${title}</strong><span>${earned?'Kafu! ':''}${C.e(body)}</span></div></div>`;}).join('')}</div><p class="note">Chapter badges use the current chapter list and known answers, not a historical session score. A deliberate progress reset resets these milestones too.</p></section>`+result.html;return result;};
  globalThis.KafuDelight={get record(){return record;},get achievements(){return project();},storageKey,homeMarkup,settled:()=>pending,motion};
}});
