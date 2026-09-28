/* Optional service worker support must never block Telegram/iOS app startup. */
globalThis.KafuEnhancements.installers.push({name:'offline-shell',install(){
  'use strict';
  let status='unavailable',registration=null,started=false;
  const labels={unavailable:'Offline launch is unavailable in this browser; downloaded chapters still work after opening the app.',
    registering:'Preparing the offline app shell…',ready:'App shell saved for offline launch in this browser.',
    waiting:'An app-shell update is ready; close and reopen Kafu to activate it.',
    failed:'This browser did not allow the offline shell. Online launch and downloaded chapters still work.'};
  const changed=()=>{if(CATALOG&&cur().v==='me')render();};
  function warm(){
    if(!registration?.active)return;
    const urls=[];
    try{
      for(const node of document.querySelectorAll('script[src],link[href]')){const value=node.src||node.href;if(value)urls.push(value);}
      for(const entry of globalThis.performance?.getEntriesByType?.('resource')||[])urls.push(entry.name);
      registration.active.postMessage({type:'KAFU_WARM_PUBLIC',urls:urls.filter(value=>/^https:\/\/(?:fonts\.googleapis\.com|fonts\.gstatic\.com|telegram\.org)\//.test(value)).slice(0,32)});
    }catch(_){}
  }
  async function start(){
    if(started)return;started=true;
    if(globalThis.isSecureContext===false||!navigator.serviceWorker?.register)return;
    status='registering';changed();
    try{
      registration=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
      status=registration.waiting?'waiting':registration.active?'ready':'registering';changed();
      navigator.serviceWorker.ready.then(ready=>{registration=ready;status=ready.waiting?'waiting':'ready';warm();changed();}).catch(()=>{status='failed';changed();});
      navigator.serviceWorker.addEventListener?.('controllerchange',()=>{status='ready';warm();changed();});
      registration.addEventListener?.('updatefound',()=>{const worker=registration.installing;worker?.addEventListener?.('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller){status='waiting';changed();}});});
      window.addEventListener('load',warm,{once:true});warm();
    }catch(_){status='failed';changed();}
  }
  const me=VIEWS.me;
  VIEWS.me=function(...args){const view=me.apply(this,args);view.html+=`<h3 class="sec">Offline app shell</h3><p class="note" role="status">${esc(labels[status])}</p>`;return view;};
  globalThis.KafuShell={start,warm,get status(){return status;}};
  start().catch(()=>{});
}});
