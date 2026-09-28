const test=require('node:test'),assert=require('node:assert/strict'),Core=require('../../../app/design/delight-core.js');
const Sync=require('../../../app/modules/sync-core.js');
const q=i=>'Q'+String(i).padStart(9,'0'),DAY='2026-09-28';
const catalog={books:[{id:'BOOK',chapters:[{id:1,questions:4,qids:[1,2,3,4].map(q)}]}]};
const state=()=>({answers:Object.fromEntries([1,2,3,4].map(i=>[q(i),{n:1,c:true,correct_count:1,unknown_count:0,t:1,b:'BOOK'}])),active:{}});
test('additive cosmetic record preserves every old field, nonmutation and account scope',()=>{
 const original={schema:1,earned:{future_badge:'2026-09-01'},extra:'keep'},before=JSON.stringify(original);
 const plan=Core.migrate(original);assert.equal(plan.write,false);assert.equal(JSON.stringify(original),before);
 const next=Core.markShown(plan.record,['first_chapter'],DAY);assert.equal(next.extra,'keep');assert.deepEqual(next.earned,original.earned);
 assert.equal(original.shown,undefined);assert.deepEqual(Core.markShown(next,['first_chapter'],'2026-09-29'),next);
 assert.notEqual(Core.key('123'),Core.key('456'));assert.notEqual(Core.key('123'),Core.key('browser'));
 assert.deepEqual(Core.migrate(null).record,{schema:1,shown:{}});
});
test('unknown record versions remain read-only',()=>{for(const r of [{schema:2,shown:{}},{schema:1,shown:[]},'future']){const before=JSON.stringify(r);assert.equal(Core.migrate(r).writable,false);assert.equal(JSON.stringify(r),before);assert.throws(()=>Core.markShown(r,['first_chapter'],DAY));}});
test('chapter badges require complete current QID evidence and known correct attempts',()=>{
 const s=state(),before=JSON.stringify(s);assert.equal(Core.derive(s,catalog,DAY).earned.first_perfect,true);assert.equal(JSON.stringify(s),before);
 delete s.answers[q(4)];assert.equal(Core.derive(s,catalog,DAY).earned.first_chapter,undefined);
 s.answers[q(4)]={n:2,c:false,correct_count:0,unknown_count:2,b:'BOOK'};
 assert.equal(Core.derive(s,catalog,DAY).earned.first_chapter,true);assert.equal(Core.derive(s,catalog,DAY).earned.first_perfect,undefined);
 s.answers[q(4)].correct_count=1;assert.equal(Core.derive(s,catalog,DAY).earned.first_perfect,true);
 s.answers[q(4)].b='OTHER';assert.equal(Core.derive(s,catalog,DAY).earned.first_chapter,undefined);
 for(const ch of [{questions:0,qids:[]},{questions:4,qids:[q(1)]},{questions:4,qids:[q(1),q(1),q(2),q(3)]}])assert.deepEqual(Core.derive(state(),{books:[{id:'BOOK',chapters:[ch]}]},DAY).earned,{});
});
test('current streak and historical seven-day milestone use synced calendar days only',()=>{
 const active=Object.fromEntries([20,21,22,23,24,25,26].map(d=>['2026-09-'+d,true]));
 assert.deepEqual(Core.streaks(active,DAY),{current:0,longest:7});
 active['2026-09-27']=true;assert.deepEqual(Core.streaks(active,DAY),{current:8,longest:8});
 active[DAY]=true;assert.equal(Core.streaks(active,DAY).current,9);
 assert.deepEqual(Core.streaks({'2026-09-31':true,'2026-09-29':true,'bad':true,[DAY]:false},DAY),{current:0,longest:0});
 assert.equal(Core.derive({active},catalog,DAY).earned.week_streak,true);
});
test('new device rebuilds all four badges and streak using only existing CloudStorage sync',async()=>{
 const values=new Map(),cloud={getKeys(cb){queueMicrotask(()=>cb(null,[...values.keys()]));},getItems(keys,cb){queueMicrotask(()=>cb(null,Object.fromEntries(keys.map(k=>[k,values.get(k)||'']))));},setItem(k,v,cb){values.set(k,v);queueMicrotask(()=>cb(null,true));},removeItems(keys,cb){keys.forEach(k=>values.delete(k));queueMicrotask(()=>cb(null,true));}};
 const a=new Sync.Replica({id:'a'.repeat(32),now:()=>1000}),b=new Sync.Replica({id:'b'.repeat(32),now:()=>1000});
 for(let i=1;i<=100;i++)a.answer(q(i),true,'BOOK','2026-09-'+(22+(i%7)));
 a.favorite('question',q(1),true);a.setResume({b:'BOOK',ch:1,q:q(3)});a.addTime(DAY,120);
 const initial=Core.derive(a.project(),catalog,DAY);assert.deepEqual(Core.IDS.filter(id=>initial.earned[id]),Core.IDS);assert.equal(initial.streak,7);
 assert.equal(await new Sync.CloudClient(a,cloud).flush(),true);await new Sync.CloudClient(b,cloud).pull();
 assert.deepEqual(Core.derive(b.project(),catalog,DAY),initial);assert.equal(b.project().answers[q(1)].n,1);assert.deepEqual(b.project().fav,[q(1)]);
 assert.equal(b.project().resume.q,q(3));assert.equal(b.project().time[DAY],120);
 assert.ok([...values.keys()].every(k=>!k.startsWith('ui_')));assert.ok(values.size<=716);
 b.resetProgress();assert.deepEqual(Core.derive(b.project(),catalog,DAY).earned,{});assert.deepEqual(b.project().fav,[q(1)]);
});
test('local celebration records cannot forge an earned badge',()=>{
 const s={answers:{},active:{},ui_delight:{earned:{first_chapter:DAY,first_perfect:DAY}}};assert.deepEqual(Core.derive(s,catalog,DAY).earned,{});
});
test('encouragement is varied and deterministic',()=>{assert.equal(Core.phrase('Q1',2),Core.phrase('Q1',2));assert.ok(new Set([1,2,3].map(i=>Core.phrase('Q1',i))).size>1);});
