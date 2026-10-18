globalThis.KafuEnhancements.installers.push({name:'ux-diagnostics',install(){
  'use strict';
  const Core=globalThis.KafuUXCore;let source='unknown',developerTaps=0,developerUnlocked=false;
  const refresh=()=>{if(CATALOG)render();};
  const fullscreen=new Core.FullscreenDiagnostic(IN_TG?TG:null,{changed:refresh});
  const loader=loadCatalog;
  loadCatalog=async function(...args){const result=await loader.apply(this,args);source=await DB.get('meta','catalog_source')||'unknown';return result;};
  const me=VIEWS.me;
  VIEWS.me=function(...args){
    const view=me.apply(this,args),build=Core.buildInfo(globalThis.KAFU_BUILD),diagnostic=fullscreen.snapshot();
    view.html+=`<section class="k-version"><button data-a="developer-version" aria-label="App version ${esc(build.version)}">Version ${esc(build.version)}</button></section>`;
    if(developerUnlocked)view.html+=`<section class="k-developer" aria-label="Developer information"><h3 class="sec">Developer</h3><dl class="kafu-diagnostic"><dt>Commit</dt><dd><code>${esc(build.commit)}</code></dd><dt>Catalog</dt><dd>${esc(Core.sourceLabel(source))}</dd><dt>Telegram version</dt><dd>${esc(diagnostic.telegramVersion)}</dd><dt>Platform</dt><dd>${esc(diagnostic.platform)}</dd><dt>isFullscreen</dt><dd>${diagnostic.isFullscreen?'true':'false'}</dd><dt>API supported</dt><dd>${diagnostic.supported?'yes':'no'}</dd><dt>Call returned</dt><dd>${esc(diagnostic.returned)}</dd><dt>Result / error</dt><dd role="status">${esc(diagnostic.result)}</dd></dl><button class="btn ghost" data-a="try-fullscreen">Try full screen</button> <button class="btn small ghost" data-a="exit-fullscreen">Exit full screen</button></section>`;
    return view;
  };
  ACTIONS['developer-version']=()=>{developerTaps++;if(developerTaps>=7&&!developerUnlocked){developerUnlocked=true;render();toast('Developer section unlocked.');}};
  ACTIONS['try-fullscreen']=()=>fullscreen.request(false);
  ACTIONS['exit-fullscreen']=()=>fullscreen.request(true);
  function banner(){return navigator.onLine===false?'<div class="offline-banner" role="status">Offline — your downloaded chapters still work</div>':'';}
  for(const key of Object.keys(VIEWS)){
    const view=VIEWS[key];VIEWS[key]=function(...args){const result=view.apply(this,args);result.html=banner()+result.html;return result;};
  }
  window.addEventListener('online',refresh);window.addEventListener('offline',refresh);
  // In full screen Telegram's own buttons float over the top of the app: the content starts below the device's safe
  // area plus Telegram's button band (both from Telegram; env() is not reliable inside its WebView).
  const safeAreas=()=>{
    const n=value=>Math.max(0,Math.min(150,Number(value)||0)),full=!!TG?.isFullscreen;
    const inset=full?n(TG?.safeAreaInset?.top)+n(TG?.contentSafeAreaInset?.top):0;
    document.documentElement.style.setProperty('--kafu-tg-safe-top',inset+'px');
    document.documentElement.classList.toggle('tg-fs',full);
  };
  try{TG?.onEvent?.('contentSafeAreaChanged',safeAreas);TG?.onEvent?.('safeAreaChanged',safeAreas);TG?.onEvent?.('fullscreenChanged',safeAreas);}catch(_){}
  safeAreas();
  // Tablets open full screen by themselves, right after boot() has told Telegram the app is ready.
  if(IN_TG)setTimeout(()=>fullscreen.autoTablet(globalThis.screen),0);
  globalThis.KafuUI={fullscreen,banner,get catalogSource(){return source;},setCatalogSource:value=>{source=value;},build:()=>Core.buildInfo(globalThis.KAFU_BUILD)};
}});
