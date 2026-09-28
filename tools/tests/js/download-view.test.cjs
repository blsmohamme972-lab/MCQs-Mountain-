const test=require('node:test'),assert=require('node:assert/strict');const{appHarness}=require('./app-harness.cjs');
test('book view has a whole-book control, tappable chapters and a defined forward icon',async()=>{
  const h=appHarness();await h.run('CloudSync.pull()');
  h.run('CATALOG={books:[{id:"BOOK",title:"Book",version:1,questions:1,specialty:"Test",chapters:[{id:1,title:"Chapter",questions:1,url:"https://kafu-content-1.blsmohamme97.workers.dev/x.json",bytes:300}]}],specialties:[],fields:[],removed_books:[]};');
  const html=h.run('VIEWS.book({b:"BOOK"}).html');assert.match(html,/Save whole book for offline/);assert.match(html,/data-a="study-ch"/);assert.doesNotMatch(html,/undefined/);assert.equal(h.run('ICON.next===ICON.chev'),true);
});
