const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function harness(saved=[]){
  let installer;const meta=new Map(),timers=new Map(),events={},study={books:['local-book'],images:['local-image'],answers:{}};let next=1;
  meta.set('leaderboard_pending_user_1',saved);
  const ctx={globalThis:null,KafuEnhancements:{installers:{push(x){installer=x}}},KafuDesign:{},IN_TG:true,TG:{initData:'signed-test',initDataUnsafe:{user:{id:1}}},
    navigator:{onLine:false},DB:{open:async()=>{},get:async(_,key)=>meta.get(key),put:async(_,key,value)=>meta.set(key,structuredClone(value))},S:study,
    VIEWS:{me:()=>({html:''})},ACTIONS:{},recordAnswer(q,r){study.answers[q.id]={n:1,c:r.c};return 'saved'},
    setTimeout(fn,delay){const id=next++;timers.set(id,{fn,delay});return id},clearTimeout(id){timers.delete(id)},AbortController,
    addEventListener(name,fn){events[name]=fn},document:{visibilityState:'visible',addEventListener(name,fn){events[name]=fn}},
    render(){},fetch:async()=>{throw Error('leaderboard paused')}};
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
