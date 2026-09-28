// Real base app + every declared extension, with browser I/O mocked.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');const ROOT=path.resolve(__dirname,'../../..');
function appHarness({online=false,fetcher=null}={}){
  const noop=()=>{},events={},element={innerHTML:'',hidden:false,style:{setProperty:noop},dataset:{},classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},setAttribute:noop,appendChild:noop,scrollIntoView:noop};
  const ctx={console,crypto:webcrypto,TextEncoder,TextDecoder,URL,Blob,AbortController,Response,Request,Headers,
    setTimeout:()=>1,clearTimeout:noop,setInterval:()=>1,clearInterval:noop,requestAnimationFrame:noop,
    navigator:{onLine:online,storage:{persist:async()=>true}},location:{href:'https://kafu.test/',origin:'https://kafu.test'},
    document:{visibilityState:'visible',querySelector:()=>element,querySelectorAll:()=>[],createElement:()=>({...element}),
      addEventListener:(key,fn)=>{events[key]=fn;},documentElement:element,body:element,head:element},
    addEventListener:(key,fn)=>{events[key]=fn;},scrollTo:noop,confirm:()=>false,
    fetch:fetcher||(()=>{throw new Error('Unmocked network request refused');})};
  ctx.window=ctx;vm.createContext(ctx);
  const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'app/modules/manifest.json'),'utf8'));
  for(const file of manifest.scripts)vm.runInContext(fs.readFileSync(path.join(ROOT,'app',file),'utf8'),ctx,{filename:file});
  const html=fs.readFileSync(path.join(ROOT,'app/index.html'),'utf8');
  const main=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).find(s=>s.includes('(async function boot() {'));
  assert.ok(main);vm.runInContext(main.slice(0,main.indexOf('(async function boot() {')),ctx,{filename:'base-app.js'});
  vm.runInContext('globalThis.KafuEnhancements.install(); render=()=>{};',ctx);
  assert.deepEqual(Array.from(ctx.KafuEnhancements.failures),[]);
  return{ctx,events,run:code=>vm.runInContext(code,ctx)};
}
module.exports={appHarness};
