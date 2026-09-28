const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const ROOT=path.resolve(__dirname,'../../..');
function mockCloud(){const values=new Map();return{values,getKeys(cb){queueMicrotask(()=>cb(null,[...values.keys()]));},getItems(keys,cb){queueMicrotask(()=>cb(null,Object.fromEntries(keys.map(k=>[k,values.get(k)||'']))));},setItem(k,v,cb){values.set(k,v);queueMicrotask(()=>cb(null,true));},removeItems(keys,cb){keys.forEach(k=>values.delete(k));queueMicrotask(()=>cb(null,true));}};}
function browser(owner=123,cloud=mockCloud(),legacy=false){
  const noop=()=>{},element={innerHTML:'',hidden:false,style:{setProperty:noop},dataset:{},classList:{add:noop,toggle:noop,contains:()=>false},setAttribute:noop,appendChild:noop,scrollIntoView:noop};
  const ctx={console,crypto:webcrypto,TextEncoder,TextDecoder,URL,Blob,setTimeout:()=>1,clearTimeout:noop,setInterval:()=>1,clearInterval:noop,requestAnimationFrame:noop,
    navigator:{onLine:true,storage:{persist:async()=>true}},document:{visibilityState:'visible',querySelector:()=>element,querySelectorAll:()=>[],createElement:()=>({...element}),addEventListener:noop,documentElement:element,body:element,head:element},
    addEventListener:noop,scrollTo:noop,confirm:()=>false,fetch:()=>{throw new Error('No network in frontend integration tests');}};
  ctx.window=ctx;
  if(owner!==null)ctx.Telegram={WebApp:{initData:'unit-session',initDataUnsafe:{user:{id:owner,first_name:'Test'}},isVersionAtLeast:()=>true,CloudStorage:cloud,
    HapticFeedback:{selectionChanged:noop,notificationOccurred:noop},MainButton:{setParams:noop,hide:noop},BackButton:{show:noop,hide:noop}}};
  vm.createContext(ctx);
  const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'app/modules/manifest.json'),'utf8'));
  for(const filename of manifest.scripts){if(legacy&&filename.startsWith('modules/report-'))continue;vm.runInContext(fs.readFileSync(path.join(ROOT,'app',filename),'utf8'),ctx,{filename});}
  const html=fs.readFileSync(path.join(ROOT,'app/index.html'),'utf8');
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(x=>x[1]);
  const main=scripts.find(s=>s.includes('(async function boot() {'));
  assert.ok(main,'Base app boot marker exists');
  vm.runInContext(main.slice(0,main.indexOf('(async function boot() {')),ctx,{filename:'base-app.js'});
  vm.runInContext('globalThis.KafuEnhancements.install(); render=()=>{}; CATALOG={books:[{id:"BOOK",chapters:[{id:1,qids:["Q000000001"]}]}],specialties:[],removed_books:[]};',ctx);
  assert.deepEqual(Array.from(ctx.KafuEnhancements.failures),[]);
  return{ctx,run:code=>vm.runInContext(code,ctx),cloud};
}

test('actual base app records compact history, unstars, study time, FSRS and local full events',async()=>{
  const h=browser();await h.run('CloudSync.pull()');
  h.run('QI.Q000000001={b:"BOOK",ch:1,q:{id:"Q000000001"}}; SESSION={bookId:"BOOK"}; recordAnswer({id:"Q000000001"},{correct:true}); recordAnswer({id:"Q000000001"},{correct:false});');
  assert.equal(h.run('S.answers.Q000000001.n'),2);assert.equal(h.run('S.answers.Q000000001.correct_count'),1);
  assert.equal(h.run('[...DB.mem.meta.keys()].filter(k=>k.startsWith("answer_event_123_")).length'),2);
  h.run('S.fav.push("Q000000001"); saveState();');assert.equal(h.run('KafuPersonal.replica.project().fav.length'),1);
  h.run('S.fav.splice(0,1); saveState();');assert.equal(h.run('KafuPersonal.replica.project().fav.length'),0);
  h.run('S.time["2026-09-28"]=(S.time["2026-09-28"]||0)+5; saveState(); saveState();');
  assert.equal(h.run('KafuPersonal.replica.own.time["2026-09-28"]'),5);
  h.run('S.fsrs.Q000000001={due:"2026-09-29",stability:2}; saveState();');
  assert.equal(h.run('KafuPersonal.replica.project().fsrs.Q000000001.stability'),2);
  await h.run('KafuPersonal.flush()');assert.equal(h.run('KafuPersonal.status()'),'synced');
  assert.ok([...h.cloud.values.keys()].every(k=>!k.includes('answer_event')));
});
test('personal state is isolated between Telegram accounts',async()=>{
  const a=browser(123);a.run('DB.mem.meta.set("state",{answers:{Q000000001:{n:1,c:true,t:1,b:"BOOK"}}});');
  const first=await a.run('DB.get("meta","state")');assert.equal(first.answers.Q000000001.n,1);
  const b=browser(456);b.ctx.shared=a.run('DB.mem.meta');b.run('DB.mem.meta=shared;');
  assert.equal(await b.run('DB.get("meta","state")'),undefined);
});
test('plain-browser use keeps local progress without Telegram CloudStorage',async()=>{
  const h=browser(null);await h.run('CloudSync.pull()');h.run('QI.Q000000001={b:"BOOK",ch:1}; recordAnswer({id:"Q000000001"},{correct:true});');
  assert.equal(h.run('S.answers.Q000000001.n'),1);assert.equal(h.run('KafuPersonal.status()'),'local-only');
});
test('report queue saves offline, sends minimal payload once, and survives old-version rollback',async()=>{
  const h=browser();h.run('CATALOG.books[0].version=1;QI.Q000000001={b:"BOOK",ch:1,q:{id:"Q000000001"}};SESSION={qids:["Q000000001"],index:0};navigator.onLine=false;');
  h.ctx.document.getElementById=()=>({value:'A short\nnote'});
  h.run('ACTIONS.report()');assert.match(h.run('SHEET()'),/maxlength="300"/);
  h.run('ACTIONS.reason({r:"Typo"})');
  await h.run('ACTIONS["send-report"]()');
  assert.equal(h.run('S.reports.length'),1);assert.equal(h.run('S.reports[0].note'),'A short note');assert.equal(h.run('S.reports[0].reason'),'Typo');
  const stored=await h.run('DB.get("meta","state")');assert.equal(stored.reports.length,1);
  // An old app can read the additive report fields and append its legacy shape without clearing progress.
  const old=browser(123,mockCloud(),true);old.ctx.saved=JSON.parse(JSON.stringify(stored));
  old.run('S=Object.assign(S,saved);S.reports.push({q:"Q000000001",reason:"Typo",t:1});');
  assert.equal(old.run('S.reports.length'),2);assert.equal(old.run('S.reports[0].note'),'A short note');
  const payloads=[];h.ctx.fetch=async(url,init)=>{assert.equal(url,'/api/reports');payloads.push(JSON.parse(init.body));return{ok:true,json:async()=>({accepted:true})};};
  h.run('navigator.onLine=true;');await h.run('KafuReports.flush()');
  assert.equal(payloads.length,1);assert.deepEqual(Object.keys(payloads[0].report).sort(),['book','id','note','q','reason','version']);
  assert.equal(h.run('S.reports.length'),0);assert.equal((await h.run('DB.get("meta","state")')).reports.length,0);
});

test('legacy local reports upgrade only when book metadata is available',async()=>{
  const h=browser();h.run('CATALOG.books[0].version=1;QI.Q000000001={b:"BOOK",ch:1,q:{id:"Q000000001"}};S.reports=[{q:"Q000000001",reason:"Typo",t:1}];');
  const payloads=[];h.ctx.fetch=async(url,init)=>{payloads.push(JSON.parse(init.body));return{ok:true,json:async()=>({accepted:true})};};
  await h.run('KafuReports.flush()');assert.equal(payloads.length,1);assert.equal(payloads[0].report.version,1);
  assert.equal(h.run('S.reports.length'),0);
});
