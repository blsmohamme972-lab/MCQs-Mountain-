/* Three short screens. The new local record needs owner approval before merge. */
globalThis.KafuEnhancements.installers.push({name:'first-run-onboarding',install(){
  'use strict';
  const Core=KafuOnboardingCore,C=KafuDesign;
  const owner=IN_TG&&Number.isSafeInteger(TG.initDataUnsafe?.user?.id)?String(TG.initDataUnsafe.user.id):'browser';
  const storageKey=Core.key(owner);let loaded=false,writable=true,record=null,step=0,selected=null,busy=false,replay=false;
  const open=DB.open.bind(DB);
  DB.open=async function(...args){
    await open(...args);
    try{
      const found=await DB.get('meta',storageKey),legacy=await DB.get('meta','state');
      const migration=Core.migrate(found,legacy);record=migration.record;writable=migration.writable;
      if(migration.write)await DB.put('meta',storageKey,record);
      selected=record?.specialty||null;
    }catch(_){record={schema:1,complete:false,specialty:null};writable=false;}
    loaded=true;
  };
  function view(){
    const specialties=[...new Set((CATALOG?.books||[]).map(b=>b.specialty).filter(Boolean))].sort();
    const visual=[ICON.lib,ICON.clock,ICON.star][step];
    const titles=['A little learning, every day.','Ready when the internet is not.','Where would you like to begin?'];
    const descriptions=[
      'Kafu is your calm place for medical questions, clear explanations, and useful review. One chapter is a good start.',
      'Open a chapter while online and wait for Available offline. Its saved questions and images stay on this device.',
      'Choose a specialty to start exploring. You can still browse every book, and change direction any time.'
    ];
    const choices=step===2?`<div class="k-onboard-choices" role="group" aria-label="Starting specialty">${[null,...specialties].map(s=>`<button class="k-onboard-choice" data-a="onboard-specialty" data-s="${C.e(s||'')}" aria-pressed="${selected===s}">${C.e(s||'All specialties')}<span aria-hidden="true">${selected===s?'\u2713':'\u2192'}</span></button>`).join('')}</div>`:'';
    const offline=step===1?'<div class="k-card k-onboard-note"><strong>A quick check before you go</strong><p>Use the offline label in your book. Telegram backup catches up when a connection is available. Offline launch depends on your browser.</p></div>':'';
    return{title:'Welcome to Kafu',html:`<section class="k-onboarding" data-onboarding-step="${step}"><div class="k-onboard-top"><span class="k-eyebrow">${step+1} of 3</span>${C.button('Skip for now',{action:'onboard-skip',variant:'quiet small',disabled:busy})}</div>${C.progress(step+1,3,'Welcome tour')}<div class="k-onboard-symbol" aria-hidden="true">${visual}</div><h2>${titles[step]}</h2><p class="k-onboard-description">${descriptions[step]}</p>${offline}${choices}${step?C.button('Back',{action:'onboard-back',variant:'quiet small',disabled:busy}):'<p class="note">For learning and exam practice, not clinical decisions.</p>'}</section>`,action:{label:busy?'Saving your choice...':step===2?'Start studying':'Next',enabled:!busy,fn:()=>step===2?complete(false):advance()}};
  }
  function advance(){step=Math.min(2,step+1);render(true);}
  async function complete(skipped){
    if(busy)return;busy=true;render();
    const wasReplay=replay;
    if(record&&Core.valid(record))record=Core.finish(record,skipped?record.specialty:selected);
    else record={schema:1,complete:true,specialty:skipped?null:selected};
    try{if(writable)await DB.put('meta',storageKey,record);}catch(_){writable=false;}
    busy=false;replay=false;step=0;
    if(wasReplay&&cur().v==='onboarding')STACK.pop();
    if(!skipped&&selected){tab('library');go('spec',{s:selected});}else tab('home');
    if(!writable||!DB.db)toast('Tour finished for this session. This browser could not save the welcome preference.');
  }
  ACTIONS['onboard-next']=advance;
  ACTIONS['onboard-back']=()=>{if(!busy){step=Math.max(0,step-1);render(true);}};
  ACTIONS['onboard-specialty']=data=>{if(!busy){const value=data.s||null;if(value&&!CATALOG.books.some(b=>b.specialty===value))return;selected=value;render();}};
  ACTIONS['onboard-skip']=()=>complete(true);
  ACTIONS['quick-tour']=()=>{replay=true;step=0;go('onboarding');};
  VIEWS.onboarding=view;
  const home=VIEWS.home;VIEWS.home=function(...args){return loaded&&record&&!record.complete?view():home.apply(this,args);};
  const me=VIEWS.me;VIEWS.me=function(...args){const result=me.apply(this,args);result.html+=`<h3 class="sec">Getting started</h3>${C.button('Replay the quick tour',{action:'quick-tour',variant:'ghost'})}`;return result;};
  globalThis.KafuOnboarding={get specialty(){return record?.specialty||null;},get needed(){return loaded&&!!record&&!record.complete;},get record(){return record;},storageKey};
}});
