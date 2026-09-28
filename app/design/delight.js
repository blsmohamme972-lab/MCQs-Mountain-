globalThis.KafuEnhancements.installers.push({name:'tasteful-delight',install(){
  'use strict';
  const Core=KafuDelightCore,C=KafuDesign;
  const owner=IN_TG&&Number.isSafeInteger(TG.initDataUnsafe?.user?.id)?String(TG.initDataUnsafe.user.id):'browser';
  const storageKey=Core.key(owner);let record=null,writable=false,pending=Promise.resolve();
  const flame='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 5-4 6-3 10 2-1 3-3 3-4 4 3 7 5 7 9a7 7 0 0 1-14 0C5 11 11 9 12 2Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
  const badges=[['first_chapter','First chapter','Finish a full chapter'],['week_streak','Seven steady days','Study on seven days in a row'],['hundred_questions','100 questions','Answer 100 different questions'],['first_perfect','A perfect chapter','All correct in one full chapter session']];
  const motion=()=>!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  for(const name of ['tap','ok','no']){const fn=haptic[name];haptic[name]=function(...args){if(!motion())return;try{return fn.apply(this,args);}catch(_){return;}};}
  const open=DB.open.bind(DB);DB.open=async function(...args){await open(...args);try{const plan=Core.migrate(await DB.get('meta',storageKey));record=plan.record;writable=plan.writable;}catch(_){record={schema:1,earned:{}};writable=false;}};
  function remember(ids){
    pending=pending.catch(()=>{}).then(async()=>{
      if(!record)return;
      const next=Core.earn(record,ids,dayKey());
      if(JSON.stringify(next)===JSON.stringify(record))return;
      const newWeek=!record.earned.week_streak&&next.earned.week_streak;
      record=next;
      if(writable&&DB.db)try{await DB.put('meta',storageKey,record);}catch(_){writable=false;}
      if(newWeek)toast('Kafu! \ud83d\udc4f Seven steady days of learning.');
    });return pending;
  }
  const answer=recordAnswer;
  recordAnswer=function(q,r){const result=answer.call(this,q,r);const earned=[];if(Object.keys(S.answers).length>=100)earned.push('hundred_questions');if(streak()>=7)earned.push('week_streak');if(earned.length)remember(earned);return result;};
  window.addEventListener('kafu:session-complete',event=>{
    const summary=event.detail,pack=PACKS[summary.bookId+':'+summary.chId];
    const ids=(pack?.questions||[]).map(q=>q.id);
    remember(Core.qualify({...summary,qids:SESSION?.qids},ids));haptic.ok();
  });
  const study=VIEWS.study;VIEWS.study=function(...args){const result=study.apply(this,args),id=SESSION?.qids[SESSION.index],r=SESSION?.resp[id];
    if(r?.done&&r.correct&&SESSION.mode!=='exam')result.html=result.html.replace('<h4>Correct</h4>',`<h4><span class="k-kafu">${C.e(Core.phrase(id,S.answers[id]?.n))}</span><span class="k-correct-label">Correct answer</span></h4>`);
    return result;
  };
  const completed=VIEWS['chapter-complete'];VIEWS['chapter-complete']=function(...args){const result=completed.apply(this,args);if(KafuStudy.last)result.html=result.html.replace('<p class="k-eyebrow">','<p class="k-kafu k-complete-kafu">Kafu! \ud83d\udc4f</p><p class="k-eyebrow">');return result;};
  function homeMarkup(){const days=streak();return`<div class="k-streak" aria-label="${days} day study streak">${flame}<strong>${days}</strong><span>${days===1?'day of learning':'days of learning'}</span></div>`;}
  const home=VIEWS.home;VIEWS.home=function(...args){const result=home.apply(this,args);if(!globalThis.KafuOnboarding?.needed)result.html=homeMarkup()+result.html;return result;};
  const me=VIEWS.me;VIEWS.me=function(...args){const result=me.apply(this,args);result.html=`<section class="k-badge-shelf" aria-labelledby="badge-title"><h3 id="badge-title" class="sec">Small wins</h3><p class="note">A little encouragement, saved on this device.</p><div class="k-badges">${badges.map(([id,title,body])=>{const earned=!!record?.earned[id];return`<div class="k-badge ${earned?'earned':''}" data-badge="${id}" aria-label="${C.e(title)}: ${earned?'earned':'not yet earned'}"><span class="k-badge-icon" aria-hidden="true">${earned?'\u2713':'\u25cb'}</span><div><strong>${title}</strong><span>${earned?'Kafu! '+C.e(record.earned[id]):body}</span></div></div>`;}).join('')}</div>${!writable?'<p class="note">New badges are session-only in this browser.</p>':''}</section>`+result.html;return result;};
  globalThis.KafuDelight={get record(){return record;},storageKey,homeMarkup,settled:()=>pending,motion};
}});
