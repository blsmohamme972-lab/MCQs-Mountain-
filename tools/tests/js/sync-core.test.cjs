const test=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../../../app/modules/sync-core.js');
const A='a'.repeat(32),B='b'.repeat(32),C='c'.repeat(32),Q='Q000000001',DAY='2026-09-28';
const replica=(id,extra={})=>new Core.Replica({id,now:()=>1000,...extra});
class MockCloud {
  constructor(){this.values=new Map();this.fail=null;this.calls=[];this.peak=0;}
  getKeys(cb){queueMicrotask(()=>cb(null,[...this.values.keys()]));}
  getItems(keys,cb){queueMicrotask(()=>cb(null,Object.fromEntries(keys.map(k=>[k,this.values.get(k)||'']))));}
  setItem(key,value,cb){
    this.calls.push(['set',key]);
    assert.match(key,/^[A-Za-z0-9_-]{1,128}$/);assert.ok(value.length<=4096);
    if(this.fail?.(key,value,'before'))return queueMicrotask(()=>cb('failed',false));
    this.values.set(key,value);this.peak=Math.max(this.peak,this.values.size);
    if(this.fail?.(key,value,'after'))return queueMicrotask(()=>cb('ack-lost',false));
    queueMicrotask(()=>cb(null,true));
  }
  removeItems(keys,cb){for(const key of keys)this.values.delete(key);queueMicrotask(()=>cb(null,true));}
}
const plain=v=>JSON.parse(JSON.stringify(v));

test('two-device counters are additive; repeated/out-of-order pulls are idempotent',()=>{
  const a=replica(A),b=replica(B);a.answer(Q,true,'BOOK',DAY);b.answer(Q,false,'BOOK',DAY);b.answer(Q,true,'BOOK',DAY);
  a.merge(b.own);b.merge(a.own);a.merge(b.own);
  assert.deepEqual(plain(a.project()),plain(b.project()));
  assert.equal(a.project().answers[Q].n,3);assert.equal(a.project().answers[Q].correct_count,2);
  const old=Core.legacy(B,{});a.merge(old);assert.equal(a.project().answers[Q].n,3);
});
test('unstar tombstone, latest answer, FSRS and resume converge independent of merge order',()=>{
  const a=replica(A),b=replica(B);a.favorite('question',Q,true);b.merge(a.own);b.favorite('question',Q,false);
  a.answer(Q,false,'BOOK',DAY);b.merge(a.own);b.answer(Q,true,'BOOK',DAY);
  a.setResume({b:'BOOK',ch:1,q:Q});b.merge(a.own);b.setResume({b:'BOOK',ch:2,q:Q});
  a.setFSRS(Q,{due:'2026-09-29T00:00:00.000Z',stability:1});b.merge(a.own);b.setFSRS(Q,{due:'2026-09-30T00:00:00.000Z',stability:2});
  a.merge(b.own);assert.deepEqual(a.project().fav,[]);assert.equal(a.project().answers[Q].c,true);
  assert.equal(a.project().resume.ch,2);assert.equal(a.project().fsrs[Q].stability,2);
  assert.deepEqual(plain(Core.project([a.own,b.own])),plain(Core.project([b.own,a.own])));
});
test('legacy totals are not doubled and missing correct history is explicitly unknown',()=>{
  const source={answers:{[Q]:{n:7,c:true,t:100,b:'BOOK'}},time:{[DAY]:60},active:{[DAY]:true},settings:{fs:1.12}};
  const a=replica(A,{source}),b=replica(B,{source});a.addTime(DAY,5);b.addTime(DAY,10);a.merge(b.own);
  assert.equal(a.project().answers[Q].n,7);assert.equal(a.project().answers[Q].unknown_count,6);
  assert.equal(a.project().answers[Q].correct_count,1);assert.equal(a.project().time[DAY],75);
  assert.equal(a.project().settings.fs,1.12);assert.equal(a.project().active[DAY],true);
});
test('synchronized reset does not resurrect progress from a stale device, and retains stars',()=>{
  const a=replica(A),b=replica(B);a.answer(Q,true,'BOOK',DAY);a.favorite('question',Q,true);b.merge(a.own);
  b.answer(Q,false,'BOOK',DAY);a.merge(b.own);a.resetProgress();
  assert.equal(Object.keys(a.project().answers).length,0);assert.deepEqual(a.project().fav,[Q]);
  b.merge(a.own);b.answer(Q,true,'BOOK',DAY);a.merge(b.own);assert.equal(a.project().answers[Q].n,1);
});
test('forking a duplicate browser writer preserves old counts without copying them twice',()=>{
  const a=replica(A);a.answer(Q,true,'BOOK',DAY);a.forkWriter(B);a.answer(Q,false,'BOOK',DAY);
  assert.equal(a.project().answers[Q].n,2);assert.equal(a.project().answers[Q].correct_count,1);
});
test('manifest-last roundtrip, cross-device sync and legacy migration use legal keys/values',async()=>{
  const cloud=new MockCloud();cloud.values.set('v1_fav','1');cloud.values.set('v1_favbooks','BOOK');
  const a=replica(A),ca=new Core.CloudClient(a,cloud);a.answer(Q,true,'BOOK',DAY);a.addTime(DAY,25);
  assert.equal(await ca.flush(),true);assert.equal(ca.status,'synced');
  const b=replica(B),cb=new Core.CloudClient(b,cloud);await cb.pull();
  assert.equal(b.project().answers[Q].n,1);assert.deepEqual(b.project().fav,[Q]);assert.equal(b.project().time[DAY],25);
  b.favorite('question',Q,false);await cb.flush();await ca.pull();assert.deepEqual(a.project().fav,[]);
  assert.ok(cloud.peak<=716);assert.equal(cloud.values.get('v1_fav'),'1');
});
test('interrupted chunk staging leaves previous committed state readable',async()=>{
  const cloud=new MockCloud(),a=replica(A),ca=new Core.CloudClient(a,cloud);a.answer(Q,true,'BOOK',DAY);await ca.flush();
  const before=cloud.values.get('k2m_'+A);a.answer(Q,false,'BOOK',DAY);
  cloud.fail=(key,value,when)=>key.startsWith('k2c_')&&when==='before';assert.equal(await ca.flush(),false);
  assert.equal(cloud.values.get('k2m_'+A),before);cloud.fail=null;
  const b=replica(B),cb=new Core.CloudClient(b,cloud);await cb.pull();assert.equal(b.project().answers[Q].n,1);
});
test('ambiguous manifest acknowledgement never deletes already committed chunks',async()=>{
  const cloud=new MockCloud(),a=replica(A),ca=new Core.CloudClient(a,cloud);a.answer(Q,true,'BOOK',DAY);
  cloud.fail=(key,value,when)=>key.startsWith('k2m_')&&when==='after';assert.equal(await ca.flush(),false);
  cloud.fail=null;const b=replica(B),cb=new Core.CloudClient(b,cloud);await cb.pull();assert.equal(b.project().answers[Q].n,1);
});
test('missing or corrupt current generation retains a previous valid snapshot',async()=>{
  const cloud=new MockCloud(),a=replica(A),ca=new Core.CloudClient(a,cloud);a.answer(Q,true,'BOOK',DAY);await ca.flush();
  a.answer(Q,false,'BOOK',DAY);await ca.flush();const pointer=JSON.parse(cloud.values.get('k2m_'+A));
  cloud.values.set('k2c_'+A+'_'+pointer.current.r+'_0','corrupt');
  const b=replica(B),cb=new Core.CloudClient(b,cloud);await cb.pull();assert.equal(cb.status,'partial');assert.equal(b.project().answers[Q].n,1);
});
test('capacity preserves 30 percent spare and never overwrites a committed snapshot',async()=>{
  const cloud=new MockCloud();for(let i=0;i<715;i++)cloud.values.set('other_'+i,'x');
  const a=replica(A),ca=new Core.CloudClient(a,cloud);a.answer(Q,true,'BOOK',DAY);await ca.flush();
  assert.equal(ca.status,'capacity');assert.equal(cloud.values.size,715);assert.equal(a.project().answers[Q].n,1);
});
test('Unicode is lossless across ASCII chunk boundaries and values never exceed 4096 chars',async()=>{
  const cloud=new MockCloud(),a=replica(A),ca=new Core.CloudClient(a,cloud);
  for(let i=1;i<=180;i++)a.setFSRS('Q'+String(i).padStart(9,'0'),{label:'\ud83d\udcd6'.repeat(20),due:'2026-09-29'});
  await ca.flush();const b=replica(B),cb=new Core.CloudClient(b,cloud);await cb.pull();
  assert.equal(b.project().fsrs[Q].label,'\ud83d\udcd6'.repeat(20));assert.ok([...cloud.values.values()].every(v=>v.length<=4096));
});
test('CloudStorage timeouts keep study local and do not throw into the app',async()=>{
  const a=replica(A),client=new Core.CloudClient(a,{getKeys(){}},{timeout:5});a.answer(Q,true,'BOOK',DAY);
  assert.equal(await client.flush(),false);assert.equal(client.status,'offline');assert.equal(a.project().answers[Q].n,1);
});
test('unsupported stored schema is not silently remigrated into duplicate counts',()=>{
  assert.throws(()=>replica(A,{stored:{own:{v:9}}}),/Unsupported/);
});
module.exports={MockCloud};
