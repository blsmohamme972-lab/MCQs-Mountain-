/* Presentation only: preserve all study, download and personal-backup contracts. */
globalThis.KafuEnhancements.installers.push({name:'design-foundation',install(){
  'use strict';
  const originalTheme=applyTelegramTheme;
  applyTelegramTheme=function(...args){
    originalTheme.apply(this,args);
    // Keep the Telegram scheme with tested semantic colour combinations.
    const root=document.documentElement;
    for(const name of ['--bg','--surface','--surface-2','--ink','--muted'])root.style.removeProperty?.(name);
    if(IN_TG)root.dataset.theme=TG.colorScheme==='dark'?'dark':'light';
    if(IN_TG&&typeof getComputedStyle==='function')try{
      const background=getComputedStyle(root).getPropertyValue('--color-bg').trim();
      TG.setHeaderColor?.(background);TG.setBackgroundColor?.(background);
    }catch(_){}
  };
  // Reuse the existing public-shell cache policy; no new stored-data format.
  const warmFonts=async()=>{
    if(!navigator.serviceWorker?.ready)return;
    try{
      await document.fonts?.ready;
      const registration=await navigator.serviceWorker.ready;
      const origin=globalThis.location?.origin;
      if(!origin)return;
      const urls=['poppins','lora'].flatMap(family=>[400,500,600].map(weight=>`${origin}/vendor/${family}-latin-${weight}.woff2`));
      registration.active?.postMessage({type:'KAFU_WARM_PUBLIC',urls});
    }catch(_){}
  };
  window.addEventListener('load',warmFonts,{once:true});
  const originalRender=render;
  render=function(...args){
    document.body.dataset.screen=cur().v;
    const result=originalRender.apply(this,args);
    for(const icon of document.querySelectorAll?.('button svg, .chev')||[])icon.setAttribute('aria-hidden','true');
    return result;
  };
}});
