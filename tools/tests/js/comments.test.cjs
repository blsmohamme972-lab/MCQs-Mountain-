const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const ROOT=path.resolve(__dirname,'../../..');

function browser(id=123,{online=true}={}){
  const noop=()=>{},elements=[],events={},meta=new Map(),requests=[];
  const element={innerHTML:'',hidden:false,value:'',style:{setProperty:noop},dataset:{},classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},setAttribute:noop,appendChild:noop,scrollIntoView:noop,focus:noop,matches:()=>false,closest:()=>null};
  const ctx={console,crypto:webcrypto,TextEncoder,TextDecoder,URL,Blob,Response,Request,Headers,
    setTimeout:()=>1,clearTimeout:noop,setInterval:()=>1,clearInterval:noop,requestAnimationFrame:fn=>{fn();return 1},
    navigator:{onLine:online,storage:{persist:async()=>true}},location:{href:'https://kafu.test/',origin:'https://kafu.test'},
    document:{visibilityState:'visible',querySelector:()=>element,querySelectorAll:()=>elements,createElement:()=>({...element}),
      addEventListener:(k,fn)=>{events[k]=fn},documentElement:element,body:element,head:element},
    addEventListener:(k,fn)=>{events[k]=fn},scrollTo:noop,confirm:()=>false,
    fetch:async(url,init={})=>{requests.push({url:String(url),body:init.body});return new Response(JSON.stringify({qid:'Q000000001',items:[],next_cursor:null,notice:'Student discussion — not verified'}),{status:200,headers:{'content-type':'application/json'}})}};
  ctx.window=ctx;ctx.__meta=meta;ctx.Telegram={WebApp:{initData:'signed-session-'+id,initDataUnsafe:{user:{id,first_name:'Student'+id}},isVersionAtLeast:()=>true,
    HapticFeedback:{selectionChanged:noop,notificationOccurred:noop},MainButton:{setParams:noop,hide:noop},BackButton:{show:noop,hide:noop}}};
  vm.createContext(ctx);
  const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'app/modules/manifest.json'),'utf8'));
  for(const file of manifest.scripts)vm.runInContext(fs.readFileSync(path.join(ROOT,'app',file),'utf8'),ctx,{filename:file});
  const html=fs.readFileSync(path.join(ROOT,'app/index.html'),'utf8');
  const main=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).find(s=>s.includes('(async function boot() {'));
  vm.runInContext(main.slice(0,main.indexOf('(async function boot() {')),ctx,{filename:'base-app.js'});
  vm.runInContext(`
    DB.get=async function(store,key){return store==='meta'?globalThis.__meta.get(key):undefined};
    DB.put=async function(store,key,value){if(store==='meta')globalThis.__meta.set(key,JSON.parse(JSON.stringify(value)));return true};
    globalThis.KafuEnhancements.install();render=()=>{};
    CATALOG={books:[{id:'BOOK',chapters:[{id:1,qids:['Q000000001']}]}],specialties:[],removed_books:[]};
    QI.Q000000001={b:'BOOK',ch:1,q:{id:'Q000000001',type:'sba',options:['A','B'],answer:'A',stem:'Stem'}};
    SESSION={mode:'study',title:'One',bookId:'BOOK',qids:['Q000000001'],index:0,resp:{Q000000001:{sel:null,done:false}},order:{Q000000001:[0,1]}};
  `,ctx);
  return{ctx,meta,requests,run:code=>vm.runInContext(code,ctx)};
}

test('locked Discussion produces zero comments requests and unlocks only after local answer',async()=>{
  const h=browser(1);
  assert.match(h.run('VIEWS.study().html'),/Answer this question to unlock student discussion/);
  await h.run('ACTIONS["open-comments"]()');
  assert.equal(h.requests.length,0);
  h.run('S.answers.Q000000001={n:1,c:true,t:1,b:"BOOK"}');
  assert.match(h.run('VIEWS.study().html'),/Student discussion — not verified/);
  await h.run('ACTIONS["open-comments"]()');
  await Promise.resolve();await Promise.resolve();
  assert.equal(h.requests.length,1);
  assert.match(h.requests[0].url,/\/api\/comments\/thread$/);
});

test('comment local cache and draft keys are account scoped A -> B -> A',async()=>{
  const a=browser(101),b=browser(202);
  assert.equal(a.run('KafuComments.account'),'101');assert.equal(b.run('KafuComments.account'),'202');
  a.run('S.answers.Q000000001={n:1};KafuComments.state.draft="مرحبا A"');
  await a.run('DB.put("meta","comments_v1_101_draft_Q000000001","مرحبا A")');
  b.run('S.answers.Q000000001={n:1}');
  assert.equal(await b.run('DB.get("meta","comments_v1_202_draft_Q000000001")'),undefined);
  await b.run('DB.put("meta","comments_v1_202_draft_Q000000001","Hello B")');
  assert.equal(await a.run('DB.get("meta","comments_v1_101_draft_Q000000001")'),'مرحبا A');
  assert.equal(await b.run('DB.get("meta","comments_v1_202_draft_Q000000001")'),'Hello B');
});

test('comment rendering escapes HTML and preserves per-body dir auto',()=>{
  const src=fs.readFileSync(path.join(ROOT,'app/modules/comments.js'),'utf8');
  assert.match(src,/dir="auto"/);assert.match(src,/escBody\(x\.body\)/);
  assert.doesNotMatch(src,/innerHTML\s*=\s*x\.body/);
  for(const sample of ['مرحبا','English','مرحبا MRCS 123','(العربية) 42'])assert.ok([...sample].length>0);
});

test('normal answer path has no comments fetch hook',()=>{
  const src=fs.readFileSync(path.join(ROOT,'app/modules/comments.js'),'utf8');
  assert.doesNotMatch(src,/recordAnswer\s*=|submitCurrent\s*=/);
  assert.match(src,/ACTIONS\['open-comments'\]=open/);
});
