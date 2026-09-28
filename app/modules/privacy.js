/* English-only educational notice and an honest summary of current storage. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.KafuPrivacy=api;})(globalThis,function(){
  'use strict';
  const VERSION='education-2026-09-28';
  const NOTICE='Educational use only — not for clinical decisions';
  const needed=settings=>settings?.education_ack!==VERSION;
  return{VERSION,NOTICE,needed};
});
globalThis.KafuEnhancements?.installers.push({name:'privacy-disclaimer',install(){
  'use strict';
  const policy=globalThis.KafuPrivacy;
  const notice=()=>`<section class="education-notice" role="note" data-kafu-education="1"><strong>${esc(policy.NOTICE)}</strong><p>Questions and explanations may contain errors or become outdated. Use Kafu for learning and exam practice, not diagnosis, treatment or patient care.</p><button class="btn small ghost" data-a="ack-education">I understand</button> <button class="btn small ghost" data-a="privacy">Privacy</button></section>`;
  VIEWS.privacy=()=>({title:'Privacy',html:(globalThis.KafuUI?.banner()||'')+`
    <h2>Your study data</h2><p class="about">We never sell student data. Kafu uses your progress to provide study, review and optional Telegram backup features.</p>
    <h3 class="sec">On this device</h3><p class="about">Downloaded chapters and images, complete new answer-event history, progress, mistakes, stars, review schedules, study time, streak inputs, resume and settings are stored in your browser's local storage database. A question report is saved here first and retried when online. It is removed from the local queue after the server acknowledges it. Pending reports are not backed up to Telegram CloudStorage.</p>
    <h3 class="sec">In Telegram</h3><p class="about">When supported, compact personal progress, correct counts, mistakes, stars, review state, time, active days and resume are backed up through Telegram CloudStorage for your account. The full answer-event log and book files are not uploaded there. Telegram supplies basic profile information for the greeting and local account separation; Kafu's diagnostics do not display private session data.</p>
    <h3 class="sec">Running the service</h3><p class="about">Cloudflare serves the app and content. The owner's upload queue, publication records, moderation flags and pending question reports use Cloudflare D1. A report contains question ID, book and version, reason, and your optional note (up to 300 characters). Your Telegram ID is verified for submission; only a pseudonymous key is stored for rate limiting, never in the report. Expired rate-limit records are pruned when new reports arrive. The owner reads reports through a private bot command and deletes each live D1 report when resolved. Weekly private D1 backups may retain an earlier copy. Do not include patient information in a note. Master content and release archives use the private GitHub repository. Telegram, Cloudflare, GitHub and font delivery providers may process the network information needed to provide their services.</p>
    <h3 class="sec">Your controls</h3><p class="about">Me → Reset my progress clears synchronized study progress after confirmation and keeps stars. Unstar questions or books separately. Delete downloaded chapters in Me to free this device's storage; this does not delete published books. Local deletion is not a promise of immediate deletion from provider backups or older cloud checkpoints.</p>
    <p class="about">Do not upload patient-identifiable information. For a content or privacy concern, contact the Kafu owner through the channel where you received the app.</p><p class="note">Updated 28 September 2026.</p>`});
  VIEWS.about=()=>({title:'About Kafu',html:(globalThis.KafuUI?.banner()||'')+`
    <h2>Kafu</h2><p class="about">A free, local-first study app for education and exam practice.</p>
    <section class="education-notice" role="note"><strong>${esc(policy.NOTICE)}</strong><p>Content may be incorrect or outdated. It is not a substitute for supervised training, clinical guidelines or professional judgment.</p></section>
    <p class="about">Your progress stays local, with compact Telegram backup when available. We never sell student data.</p>
    <button class="btn ghost" data-a="privacy">Privacy and storage</button>
    <h3 class="sec">Open-source components</h3><p class="about">Review scheduling: ts-fsrs 5.4.2 (MIT). ZIP decoding: fflate 0.8.3 (MIT).</p>
    <p class="note"><a href="/vendor/ts-fsrs-LICENSE.txt" target="_blank" rel="noopener noreferrer">ts-fsrs license</a> · <a href="/vendor/fflate-LICENSE.txt" target="_blank" rel="noopener noreferrer">fflate license</a></p>`});
  ACTIONS.privacy=()=>go('privacy');ACTIONS.about=()=>go('about');
  ACTIONS['ack-education']=async()=>{
    S.settings=S.settings||{};S.settings.education_ack=policy.VERSION;saveState();
    try{await DB.put('meta','state',S);}catch(_){toast('Acknowledged for this session; persistent storage is unavailable.');}
    render();
  };
  const me=VIEWS.me;VIEWS.me=function(...args){const view=me.apply(this,args);view.html+=`<h3 class="sec">Privacy and educational use</h3><p class="note">${esc(policy.NOTICE)}</p><button class="btn small ghost" data-a="privacy">Privacy</button> <button class="btn small ghost" data-a="about">About Kafu</button>`;return view;};
  for(const key of Object.keys(VIEWS)){
    if(['about','privacy'].includes(key))continue;
    const original=VIEWS[key];VIEWS[key]=function(...args){const view=original.apply(this,args);if(policy.needed(S.settings))view.html=notice()+view.html;return view;};
  }
}});
