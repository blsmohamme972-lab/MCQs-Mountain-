/* Kafu public app-shell cache. Never stores API/bot/internal/auth requests.
 * Version is replaced by the deterministic frontend build. No skipWaiting:
 * active study tabs are not forcibly reloaded or handed a partial app update.
 */
(function(scope){
  'use strict';
  const VERSION='__KAFU_SW_VERSION__',PREFIX='kafu-public-shell-',LIMIT=48;
  // Leaders profile pictures never change, so they live in their own cache, outside the 48-entry shell
  // limit and kept across app versions. Rename the cache if a picture file is ever replaced.
  const AVATARS='kafu-leaders-avatars-1';
  const CONTENT='https://kafu-content-1.blsmohamme97.workers.dev';
  function policy(request,origin){
    if(request.method!=='GET'||request.headers?.has('authorization')||request.headers?.has('x-telegram-bot-api-secret-token')||request.headers?.has('range'))return null;
    let url,path;
    try{url=new URL(request.url,origin);path=decodeURIComponent(url.pathname);}catch(_){return null;}
    if(url.protocol!=='https:'||url.username||url.password||/^\/(api|internal|bot|admin)(\/|$)/i.test(path))return null;
    for(const key of url.searchParams.keys())if(/token|secret|password|signature|authorization|initdata|^hash$|^key$/i.test(key))return null;
    if(path==='/catalog.json'&&(url.origin===origin||url.origin===CONTENT))return{kind:'catalog',key:url.origin+path};
    if(url.origin===origin){
      if((path==='/'||path==='/index.html')&&!url.search)return{kind:'shell',key:origin+'/index.html'};
      if(!url.search&&/^\/assets\/avatars\/a\d{2}\.webp$/.test(path))return{kind:'avatar',key:url.href};
      if(!url.search&&(/^\/(?:modules|vendor|icons|fonts)\/[A-Za-z0-9_./-]+\.(?:js|css|svg|png|ico|woff2?|txt)$/.test(path)))return{kind:'asset',key:url.href};
      return null;
    }
    if(url.origin==='https://telegram.org'&&path==='/js/telegram-web-app.js'&&!url.search)return{kind:'public-script',key:url.href};
    if(url.origin==='https://fonts.googleapis.com'&&path==='/css2')return{kind:'font-css',key:url.href};
    if(url.origin==='https://fonts.gstatic.com'&&/^\/s\/[A-Za-z0-9_./-]+\.woff2?$/.test(path)&&!url.search)return{kind:'font',key:url.href};
    return null;
  }
  function runtime(env){
    const origin=env.location.origin,cacheName=PREFIX+VERSION,index=origin+'/index.html';
    const external=kind=>['font-css','public-script'].includes(kind);
    async function acceptable(response,kind){
      // Font files are requested with CORS; an opaque warm response cannot be
      // served to a later CORS font request. CSS and classic scripts can be opaque.
      if(response.type==='opaque')return external(kind);
      if(!response.ok||response.status===206)return false;
      const length=Number(response.headers.get('content-length'));
      if(length>4*1024*1024)return false;
      if(kind==='catalog'){
        try{const text=await response.clone().text();if(text.length>4*1024*1024)return false;const data=JSON.parse(text);return Array.isArray(data.books);}catch(_){return false;}
      }
      if(kind==='shell'){
        const type=response.headers.get('content-type')||'';if(!type.includes('text/html'))return false;
        try{const text=await response.clone().text();return text.length<4*1024*1024&&text.includes('<title>Kafu</title>')&&text.includes('<script');}catch(_){return false;}
      }
      return true;
    }
    async function put(cache,key,response,kind){
      if(!await acceptable(response,kind))return false;
      try{
        await cache.put(key,response.clone());
        const keys=await cache.keys();
        if(keys.length>LIMIT){const removable=keys.filter(r=>r.url!==index);for(const key of removable.slice(0,keys.length-LIMIT))await cache.delete(key);}
        return true;
      }catch(_){return false;}
    }
    async function network(request){
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);
      try{return await env.fetch(new Request(request,{signal:controller.signal}));}finally{clearTimeout(timer);}
    }
    async function handle(request){
      const selected=policy(request,origin);if(!selected)return env.fetch(request);
      if(selected.kind==='avatar'){
        try{const cache=await env.caches.open(AVATARS),cached=await cache.match(selected.key);if(cached)return cached;
          const response=await env.fetch(request);
          if(response.ok&&(response.headers.get('content-type')||'').startsWith('image/'))await cache.put(selected.key,response.clone()).catch(()=>{});
          return response;}catch(_){return env.fetch(request);}
      }
      let cache;try{cache=await env.caches.open(cacheName);}catch(_){return env.fetch(request);}
      if(!['shell','catalog'].includes(selected.kind)){
        const cached=await cache.match(selected.key);if(cached)return cached;
        const response=await network(request);await put(cache,selected.key,response,selected.kind);return response;
      }
      let response;
      try{
        response=await network(request);
        if(await acceptable(response,selected.kind)){await put(cache,selected.key,response,selected.kind);return response;}
      }catch(_){}
      const cached=await cache.match(selected.key);if(cached)return cached;
      if(response)return response;
      return new Response(selected.kind==='catalog'?'{"error":"offline_catalog_unavailable"}':'Offline app shell is not saved yet. Open Kafu once while online.',{
        status:503,headers:{'content-type':selected.kind==='catalog'?'application/json':'text/plain; charset=utf-8','cache-control':'no-store'}});
    }
    async function install(){
      const cache=await env.caches.open(cacheName);
      const response=await env.fetch(new Request(index,{cache:'reload',credentials:'omit'}));
      if(!await put(cache,index,response,'shell'))throw new Error('Could not save a valid Kafu shell');
      const icon=origin+'/icons/kafu.svg';
      try{await put(cache,icon,await env.fetch(new Request(icon,{credentials:'omit'})),'asset');}catch(_){}
    }
    async function activate(){
      for(const key of await env.caches.keys())if(key.startsWith(PREFIX)&&key!==cacheName)await env.caches.delete(key);
      await env.clients.claim();
    }
    async function warm(urls){
      const cache=await env.caches.open(cacheName);
      for(const value of [...new Set(urls)].slice(0,32)){
        if(typeof value!=='string')continue;
        let request;try{request=new Request(value,{credentials:'omit'});}catch(_){continue;}
        const selected=policy(request,origin);if(!selected||!['asset','font','font-css','public-script'].includes(selected.kind))continue;
        const mode=new URL(value).origin===origin?'same-origin':selected.kind==='font'?'cors':'no-cors';
        request=new Request(request,{mode});
        try{if(!await cache.match(selected.key))await put(cache,selected.key,await network(request),selected.kind);}catch(_){}
      }
    }
    return{handle,install,activate,warm,cacheName,acceptable};
  }
  if(typeof module==='object'&&module.exports)module.exports={policy,runtime,PREFIX,VERSION,LIMIT,AVATARS};
  if(!scope?.addEventListener||!scope.caches||!scope.clients)return;
  const app=runtime(scope);
  scope.addEventListener('install',event=>event.waitUntil(app.install()));
  scope.addEventListener('activate',event=>event.waitUntil(app.activate()));
  scope.addEventListener('fetch',event=>{if(policy(event.request,scope.location.origin))event.respondWith(app.handle(event.request));});
  scope.addEventListener('message',event=>{
    if(event.data?.type!=='KAFU_WARM_PUBLIC'||!Array.isArray(event.data.urls))return;
    try{if(new URL(event.source?.url).origin!==scope.location.origin)return;}catch(_){return;}
    event.waitUntil(app.warm(event.data.urls));
  });
})(typeof self==='undefined'?null:self);

