const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function harness(saved=[],sharedMeta=null,uid=1){
  let installer;const meta=sharedMeta||new Map(),timers=new Map(),events={},study={books:['local-book'],images:['local-image'],answers:{}};let next=1;
  if(!meta.has('leaderboard_pending_user_'+uid))meta.set('leaderboard_pending_user_'+uid,saved);
  const ctx={globalThis:null,KafuEnhancements:{installers:{push(x){installer=x}}},KafuDesign:{e:x=>String(x),button:()=>''},IN_TG:true,TG:{initData:'signed-test-'+uid,initDataUnsafe:{user:{id:uid}}},
    navigator:{onLine:false},DB:{open:async()=>{},get:async(_,key)=>meta.get(key),put:async(_,key,value)=>meta.set(key,structuredClone(value))},S:study,
    VIEWS:{me:()=>({html:''})},ACTIONS:{},recordAnswer(q,r){study.answers[q.id]={n:1,c:r.c};return 'saved'},
    setTimeout(fn,delay){const id=next++;timers.set(id,{fn,delay});return id},clearTimeout(id){timers.delete(id)},AbortController,
    addEventListener(name,fn){events[name]=fn},document:{visibilityState:'visible',addEventListener(name,fn){events[name]=fn}},
    render(){},greetingName:()=>'Student',fetch:async()=>{throw Error('leaderboard paused')}};
  ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../../app/modules/leaderboard.js'),'utf8'),ctx);installer.install();
  return {ctx,meta,timers,events,study};
}
test('offline study saves answers/images/books with no dependency on leaderboard and restores >500 pending',async()=>{
  const saved=Array.from({length:700},(_,i)=>({qid:'Q'+String(i+1).padStart(9,'0'),selection:0})),h=harness(saved);
  await h.ctx.DB.open();assert.equal(h.ctx.KafuLeaderboard.pending.length,700);
  assert.equal(h.ctx.recordAnswer({id:'Q000000900'},{sel:0,c:true}),'saved');
  await Promise.resolve();await Promise.resolve();
  assert.equal(h.study.answers.Q000000900.c,true);assert.deepEqual(h.study.books,['local-book']);assert.deepEqual(h.study.images,['local-image']);
  h.ctx.navigator.onLine=true;await h.ctx.KafuLeaderboard.flush();
  assert.equal(h.ctx.KafuLeaderboard.pending.length,701,'failed network preserves pending');
  assert.equal(h.meta.get('leaderboard_pending_user_1').length,701);
  assert.ok([...h.timers.values()].some(x=>x.delay>=60000),'paused leaderboard backs off instead of retrying every second');
});
test('submit batching is bounded, single flight, durable, and keeps answers added during a request',async()=>{
  const h=harness(Array.from({length:100},(_,i)=>({qid:'Q'+String(i+1).padStart(9,'0'),selection:0})));
  await h.ctx.DB.open();h.ctx.navigator.onLine=true;
  let release,calls=0;h.ctx.fetch=async(_,init)=>{calls++;const body=JSON.parse(init.body);assert.equal(body.answers.length,100);await new Promise(r=>release=r);return {ok:true,json:async()=>({accepted:100})}};
  const one=h.ctx.KafuLeaderboard.flush(),two=h.ctx.KafuLeaderboard.flush();
  await new Promise(r=>setImmediate(r));assert.equal(calls,1);
  h.ctx.recordAnswer({id:'Q000000901'},{sel:1,c:false});release();await Promise.all([one,two]);
  assert.equal(h.ctx.KafuLeaderboard.pending.length,1);assert.equal(h.ctx.KafuLeaderboard.pending[0].qid,'Q000000901');
  assert.equal(h.meta.get('leaderboard_pending_user_1').length,1);
  assert.equal(h.ctx.KafuLeaderboard.BATCH,100);assert.equal(h.ctx.KafuLeaderboard.FLUSH_MS,3600000);
});

test('A -> B -> A restores only that account queue, privacy and verified score',async()=>{
  const a=harness([{qid:'Q000000001',selection:0}]);await a.ctx.DB.open();
  a.ctx.navigator.onLine=true;
  a.ctx.fetch=async()=>({ok:true,json:async()=>({score:{total:12,weekly:5,week_key:'2026-09-28'},accepted:1})});
  await a.ctx.KafuLeaderboard.flush();
  a.meta.set('leaderboard_hidden_user_1',true);
  a.ctx.recordAnswer({id:'Q000000002'},{sel:1,c:false});await new Promise(r=>setImmediate(r));
  const b=harness([],a.meta,2);await b.ctx.DB.open();
  assert.equal(b.ctx.KafuLeaderboard.pending.length,0);assert.equal(b.meta.get('leaderboard_score_user_2'),undefined);
  b.ctx.recordAnswer({id:'Q000000003'},{sel:0,c:true});await new Promise(r=>setImmediate(r));
  const a2=harness([],a.meta,1);await a2.ctx.DB.open();
  assert.equal(a2.ctx.KafuLeaderboard.pending.length,1);assert.equal(a2.ctx.KafuLeaderboard.pending[0].qid,'Q000000002');
  assert.equal(a2.ctx.KafuLeaderboard.verifiedScore.total,12);assert.equal(a2.ctx.KafuLeaderboard.hidden,true);
  assert.equal(a2.meta.get('leaderboard_pending_user_2')[0].qid,'Q000000003');
  assert.equal(a2.meta.get('leaderboard_hidden_user_1'),true);
});
test('score sync no longer renders the retired server board or the Me entry',async()=>{
  const h=harness();await h.ctx.DB.open();
  assert.equal(h.ctx.VIEWS.leaderboard,undefined);assert.equal(h.ctx.ACTIONS['open-leaderboard'],undefined);
  assert.equal(h.ctx.VIEWS.me().html,'');
});
