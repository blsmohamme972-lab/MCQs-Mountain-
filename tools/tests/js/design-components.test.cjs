const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../../../app/design/components.js');
test('design components escape text and never persist user data',()=>{
 const output=C.button('<img onerror="bad">',{action:'go',data:{book:'<book>', 'bad key':'x'}});
 assert.match(output,/&lt;img/);assert.doesNotMatch(output,/<img/);assert.doesNotMatch(output,/data-bad key/);
 assert.match(C.empty({title:'Nothing yet',body:'Choose a chapter',action:'library',label:'Open library'}),/Choose a chapter/);
 assert.match(C.progress(3,4,'Questions'),/aria-valuenow="3"/);
 assert.match(C.ring(3,4,'Progress'),/75%/);
 assert.match(C.skeleton('Loading book'),/role="status"/);
 assert.equal(C.percent(NaN,4),0);
});
