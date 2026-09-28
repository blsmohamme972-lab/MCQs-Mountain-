const test=require('node:test'),assert=require('node:assert/strict');
const Core=require('../../../app/design/onboarding-core.js');
test('additive migration keeps every old study field byte-for-byte',()=>{
 const state={answers:{Q1:{c:true,n:2}},fav:['Q1'],favBooks:['B'],dl:{'B:1':{complete:true}},resume:{b:'B',ch:1,q:'Q1'},sync_v2:{future:'preserve'},settings:{fs:1.25}};
 const before=JSON.stringify(state),result=Core.migrate(null,state);
 assert.deepEqual(result.record,{schema:1,complete:true,specialty:null});assert.equal(result.write,true);assert.equal(JSON.stringify(state),before);
});
test('fresh profile needs tour; completing and reloading is idempotent',()=>{
 const fresh=Core.migrate(undefined,{});assert.equal(fresh.write,false);assert.equal(fresh.record.complete,false);
 const done=Core.finish(fresh.record,'Cardiology');const next=Core.migrate(done,{});assert.deepEqual(next.record,done);assert.equal(next.write,false);assert.equal(fresh.record.complete,false);
});
test('unknown or malformed records are never overwritten',()=>{
 for(const stored of [{schema:2,complete:false},{schema:1,complete:'no'},'unknown']){const frozen=JSON.stringify(stored),plan=Core.migrate(stored,{});assert.equal(plan.writable,false);assert.equal(plan.write,false);assert.equal(JSON.stringify(stored),frozen);assert.throws(()=>Core.finish(stored,null));}
});
test('records are account scoped and known extra fields survive completion',()=>{
 assert.notEqual(Core.key('123'),Core.key('456'));assert.notEqual(Core.key('123'),Core.key('browser'));
 const src={schema:1,complete:false,specialty:null,extra:'keep'};assert.equal(Core.finish(src,null).extra,'keep');
});
