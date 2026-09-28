const test=require('node:test');const assert=require('node:assert/strict');
const sdk=require('../../../app/vendor/ts-fsrs-5.4.2.js');
const core=require('../../../app/modules/review-core.js');
const NOW=new Date('2026-09-28T12:00:00.000Z');
test('real pinned ts-fsrs gives deterministic Again/Good/Easy schedules',()=>{
  const engine=core.create(sdk),again=engine.grade(null,1,NOW),good=engine.grade(null,3,NOW),easy=engine.grade(null,4,NOW);
  assert.equal(engine.version,'5.4.2');assert.ok(core.valid(good));assert.equal(good.reps,1);
  assert.ok(Date.parse(again.due)<Date.parse(good.due));assert.ok(Date.parse(good.due)<Date.parse(easy.due));
  assert.deepEqual(engine.grade(null,3,NOW),good);
});
test('card JSON survives local/cloud storage and review continues without a network',()=>{
  const engine=core.create(sdk);let card=engine.grade(null,3,NOW);card=JSON.parse(JSON.stringify(card));
  const next=engine.grade(card,3,new Date(card.due));assert.equal(next.reps,2);assert.ok(core.valid(next));
  assert.equal(next.engine_version,'5.4.2');assert.ok(Date.parse(next.due)>Date.parse(card.due));
});
test('due count includes only valid reviewed cards and is deterministic',()=>{
  const engine=core.create(sdk),card=engine.grade(null,1,NOW);
  assert.deepEqual(core.dueIds({Q000000002:card,Q000000001:card},Date.parse(card.due)),['Q000000001','Q000000002']);
  assert.deepEqual(core.dueIds({Q000000001:card},NOW.getTime()),[]);
  assert.deepEqual(core.dueIds({Q000000001:{due:'bad'}},NOW.getTime()),[]);
});
test('invalid persisted card, rating or date is refused rather than silently overwritten',()=>{
  const engine=core.create(sdk);assert.throws(()=>engine.grade({due:'bad'},3,NOW));
  assert.throws(()=>engine.grade(null,0,NOW));assert.throws(()=>engine.grade(null,3,new Date('bad')));
});
