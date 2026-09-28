const test=require('node:test'),assert=require('node:assert/strict');
const {policy,runtime,PREFIX}=require('../../../app/sw.js');
const ORIGIN='https://kafu.test',CONTENT='https://kafu-content-1.blsmohamme97.workers.dev';
class MemoryCache {
  constructor(){this.values=new Map();}
  key(value){return typeof value==='string'?value:value.url;}
  async put(key,response){this.values.set(this.key(key),response.clone());}
  async match(key){return this.values.get(this.key(key))?.clone();}
  async keys(){return [...this.values.keys()].map(url=>new Request(url));}
  async delete(key){return this.values.delete(this.key(key));}
}
function setup(){
  const stores=new Map();let online=true,body={books:[{id:'PROTECTED',chapters:[{id:1}]}]},bad=false;const fetched=[];let claimed=false;
  const env={location:{origin:ORIGIN},clients:{claim:async()=>{claimed=true;}},
    caches:{open:async name=>{if(!stores.has(name))stores.set(name,new MemoryCache());return stores.get(name);},keys:async()=>[...stores.keys()],delete:async name=>stores.delete(name)},
    async fetch(request){fetched.push(request.url);if(!online)throw new TypeError('offline');
      if(request.url.includes('catalog.json'))return new Response(bad?'<html>blocked</html>':JSON.stringify(body),{status:bad?403:200,headers:{'content-type':'application/json'}});
      if(request.url.endsWith('/index.html'))return new Response('<title>Kafu</title><script>atomic app</script>',{headers:{'content-type':'text/html'}});
      return new Response('public asset',{headers:{'content-type':'image/svg+xml'}});
    }};
  return{env,app:runtime(env),stores,fetched,set online(value){online=value;},set body(value){body=value;},set bad(value){bad=value;},get claimed(){return claimed;}};
}
test('cache policy never selects API, internal, bot, authentication or mutation requests',()=>{
  for(const path of ['/api/progress','/internal/claim','/bot','/%69nternal/claim','/modules/../internal/claim'])assert.equal(policy(new Request(ORIGIN+path),ORIGIN),null);
  assert.equal(policy(new Request(ORIGIN+'/index.html',{headers:{Authorization:'Bearer unit'}}),ORIGIN),null);
  assert.equal(policy(new Request(ORIGIN+'/index.html',{method:'POST',body:'x'}),ORIGIN),null);
  assert.equal(policy(new Request(CONTENT+'/catalog.json?token=unit'),ORIGIN),null);
  assert.equal(policy(new Request('https://untrusted.test/catalog.json'),ORIGIN),null);
  assert.equal(policy(new Request(CONTENT+'/packs/BOOK/v1/q.json'),ORIGIN),null,'Question packs belong in IndexedDB, not shell cache');
  assert.equal(policy(new Request(CONTENT+'/catalog.json?proof=123'),ORIGIN).kind,'catalog');
});
test('installs an atomic shell and serves it offline without any backend request',async()=>{
  const h=setup();await h.app.install();h.online=false;
  const page=await h.app.handle(new Request(ORIGIN+'/'));assert.equal(page.status,200);assert.match(await page.text(),/atomic app/);
  assert.ok(h.fetched.every(url=>!url.includes('/api')&&!url.includes('/internal')));
});
test('catalog is network-first and a 403 HTML body cannot overwrite cached JSON',async()=>{
  const h=setup();let response=await h.app.handle(new Request(CONTENT+'/catalog.json?proof=1'));assert.equal((await response.json()).books[0].id,'PROTECTED');
  h.body={books:[{id:'NEW'}]};response=await h.app.handle(new Request(CONTENT+'/catalog.json?proof=2'));assert.equal((await response.json()).books[0].id,'NEW');
  h.bad=true;response=await h.app.handle(new Request(CONTENT+'/catalog.json'));assert.equal((await response.json()).books[0].id,'NEW');
  h.online=false;response=await h.app.handle(new Request(CONTENT+'/catalog.json'));assert.equal((await response.json()).books[0].id,'NEW');
});
test('missing offline catalog is a real 503, not an invented successful empty library',async()=>{
  const h=setup();h.online=false;const response=await h.app.handle(new Request(CONTENT+'/catalog.json'));assert.equal(response.status,503);assert.equal((await response.json()).error,'offline_catalog_unavailable');
});
test('activation removes only obsolete Kafu shell caches and keeps unrelated storage',async()=>{
  const h=setup();h.stores.set(PREFIX+'old',new MemoryCache());h.stores.set('another-app',new MemoryCache());await h.app.install();await h.app.activate();
  assert.equal(h.stores.has(PREFIX+'old'),false);assert.equal(h.stores.has('another-app'),true);assert.equal(h.claimed,true);
});
test('opaque responses are permitted for public CSS/SDK, not shells, catalogs or CORS font files',async()=>{
  const h=setup();for(const kind of ['shell','catalog','font'])assert.equal(await h.app.acceptable({type:'opaque'},kind),false);
  for(const kind of ['font-css','public-script'])assert.equal(await h.app.acceptable({type:'opaque'},kind),true);
});
test('cache quota failure does not block a valid online page',async()=>{
  const h=setup();h.env.caches.open=async()=>({match:async()=>undefined,put:async()=>{throw new Error('quota');},keys:async()=>[]});
  const response=await h.app.handle(new Request(ORIGIN+'/'));assert.equal(response.status,200);
});
