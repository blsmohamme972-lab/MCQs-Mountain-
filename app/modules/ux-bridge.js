globalThis.KafuEnhancements.installers.push({name:'ux-diagnostics',install(){
  'use strict';
  const Core=globalThis.KafuUXCore;let source='unknown';
  const refresh=()=>{if(CATALOG)render();};
  const fullscreen=new Core.FullscreenDiagnostic(IN_TG?TG:null,{changed:refresh});
  const loader=loadCatalog;
  loadCatalog=async function(...args){const result=await loader.apply(this,args);source=await DB.get('meta','catalog_source')||'unknown';return result;};
  const me=VIEWS.me;
  VIEWS.me=function(...args){
    const view=me.apply(this,args),build=Core.buildInfo(globalThis.KAFU_BUILD),diagnostic=fullscreen.snapshot();
    view.html+=`<h3 class="sec">App information</h3><dl class="kafu-diagnostic"><dt>Version</dt><dd>${esc(build.version)}</dd><dt>Commit</dt><dd><code>${esc(build.commit)}</code></dd><dt>Catalog</dt><dd>${esc(Core.sourceLabel(source))}</dd></dl>
      <h3 class="sec">Temporary full-screen diagnostic</h3><p class="note">Run this on your iPad tomorrow. No account settings are changed and no private Telegram data is displayed.</p>
      <dl class="kafu-diagnostic"><dt>Telegram version</dt><dd>${esc(diagnostic.telegramVersion)}</dd><dt>Platform</dt><dd>${esc(diagnostic.platform)}</dd><dt>isFullscreen</dt><dd>${diagnostic.isFullscreen?'true':'false'}</dd><dt>API supported</dt><dd>${diagnostic.supported?'yes':'no'}</dd><dt>Call returned</dt><dd>${esc(diagnostic.returned)}</dd><dt>Result / error</dt><dd role="status">${esc(diagnostic.result)}</dd></dl>
      <button class="btn ghost" data-a="try-fullscreen">Try full screen</button> <button class="btn small ghost" data-a="exit-fullscreen">Exit full screen</button>`;
    return view;
  };
  ACTIONS['try-fullscreen']=()=>fullscreen.request(false);
  ACTIONS['exit-fullscreen']=()=>fullscreen.request(true);
  function banner(){return navigator.onLine===false?'<div class="offline-banner" role="status">Offline — your downloaded chapters still work</div>':'';}
  for(const key of Object.keys(VIEWS)){
    const view=VIEWS[key];VIEWS[key]=function(...args){const result=view.apply(this,args);result.html=banner()+result.html;return result;};
  }
  window.addEventListener('online',refresh);window.addEventListener('offline',refresh);
  const safeAreas=()=>{
    const inset=Math.max(0,Math.min(150,Number(TG?.contentSafeAreaInset?.top)||0));
    document.documentElement.style.setProperty('--kafu-tg-safe-top',TG?.isFullscreen?inset+'px':'0px');
  };
  try{TG?.onEvent?.('contentSafeAreaChanged',safeAreas);TG?.onEvent?.('fullscreenChanged',safeAreas);}catch(_){}
  safeAreas();
  globalThis.KafuUI={fullscreen,banner,get catalogSource(){return source;},setCatalogSource:value=>{source=value;},build:()=>Core.buildInfo(globalThis.KAFU_BUILD)};
}});
