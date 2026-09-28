const test=require('node:test'),assert=require('node:assert/strict'),Core=require('../../../app/design/delight-core.js');
test('additive local record preserves unknown fields and never mutates existing study data',()=>{
 const state={answers:{Q1:{n:4,c:false}},fav:['Q1'],dl:{'B:1':{complete:true}},sync_v2:{v:2,extra:1}};const before=JSON.stringify(state);
 const plan=Core.migrate(null,state);assert.equal(plan.write,false);assert.equal(JSON.stringify(state),before);
 const record={schema:1,earned:{future_badge:'2026-09-01'},extra:'keep'};
 const earned=Core.earn(record,['first_chapter'],'2026-09-28');assert.equal(record.earned.first_chapter,undefined);assert.equal(earned.extra,'keep');assert.equal(earned.earned.future_badge,'2026-09-01');
 assert.deepEqual(Core.earn(earned,['first_chapter'],'2026-09-29'),earned);
 assert.notEqual(Core.key('123'),Core.key('456'));assert.notEqual(Core.key('123'),Core.key('browser'));
});
test('unsupported record remains read-only and cannot be silently rewritten',()=>{for(const r of [{schema:2,earned:{}},{schema:1,earned:[]},'future']){const before=JSON.stringify(r);assert.equal(Core.migrate(r).writable,false);assert.equal(JSON.stringify(r),before);assert.throws(()=>Core.earn(r,['first_chapter'],'today'));}});
test('chapter badges require all chapter questions graded in one study session',()=>{
 const full={mode:'study',qids:['a','b','c','d'],total:4,answered:4,skipped:0,perfect:true};assert.deepEqual(Core.qualify(full,['a','b','c','d']),['first_chapter','first_perfect']);
 for(const bad of [{...full,mode:'review'},{...full,answered:1,skipped:3},{...full,total:1,answered:1},{...full,qids:['a','b','c','x']}])assert.deepEqual(Core.qualify(bad,['a','b','c','d']),[]);
 assert.deepEqual(Core.qualify({...full,perfect:false},['a','b','c','d']),['first_chapter']);
});
test('encouragement is varied and deterministic',()=>{assert.equal(Core.phrase('Q1',2),Core.phrase('Q1',2));assert.ok(new Set([1,2,3].map(i=>Core.phrase('Q1',i))).size>1);});
