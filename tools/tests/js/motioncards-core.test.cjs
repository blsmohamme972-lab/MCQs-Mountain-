const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {webcrypto}=require('node:crypto');
global.crypto=webcrypto;
require('../../../app/modules/motioncards-core.js');
const MC=global.KafuMotionCards,Core=MC.core;
const golden=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../motioncards/golden/canonical-v1.json'),'utf8')).vectors[0];

test('MotionCards JS canonical hash matches shared golden vector',async()=>{
  assert.equal(await Core.questionHash(golden.question),golden.content_hash);
});
test('availability record requires exact question identity and immutable MotionCards URL',()=>{
  const q={id:'Q000000001',version:2},entry={b:'BOOK',ch:3};
  const good={qid:q.id,book_id:'BOOK',book_version:2,chapter_id:3,content_hash:'a'.repeat(64),duration_ms:8000,entry_url:MC.CONTENT_BASE+'/assets/P/r1/Q000000001.abc.html',entry_sha256:'b'.repeat(64)};
  assert.equal(Core.validRecord(good,q,entry),true);
  assert.equal(Core.validRecord({...good,book_version:3},q,entry),false);
  assert.equal(Core.validRecord({...good,entry_url:'https://evil.test/x.html'},q,entry),false);
});
test('player messages are bounded to protocol channel and QID',()=>{
  const active={channel:'abc',qid:'Q000000001'};
  assert.equal(Core.validMessage({type:'ready',protocol:1,channel_id:'abc',qid:active.qid},active),true);
  assert.equal(Core.validMessage({type:'navigate',protocol:1,channel_id:'abc',qid:active.qid},active),false);
  assert.equal(Core.validMessage({type:'ready',protocol:1,channel_id:'other',qid:active.qid},active),false);
});
