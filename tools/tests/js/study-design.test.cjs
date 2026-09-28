const test=require('node:test'),assert=require('node:assert/strict');
const {summarize}=require('../../../app/design/study-core.js');
test('session score uses graded responses and never historical saved answers',()=>{
 const r={a:{done:true,correct:true},b:{done:true,correct:false},c:{done:false,correct:true}};
 const before=JSON.stringify(r),s=summarize(['a','b','c','d'],r);
 assert.equal(s.answered,2);assert.equal(s.correct,1);assert.equal(s.percent,50);assert.equal(s.skipped,2);assert.equal(s.perfect,false);assert.deepEqual(s.mistakes,['b']);assert.equal(JSON.stringify(r),before);
});
test('perfect means every unique question actually answered correctly',()=>{
 assert.equal(summarize([],{}).perfect,false);assert.equal(summarize(['a'],{}).perfect,false);
 const s=summarize(['a','a'],{a:{done:true,correct:true}});assert.equal(s.total,1);assert.equal(s.perfect,true);assert.equal(s.percent,100);
});
