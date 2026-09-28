const test=require('node:test'),assert=require('node:assert/strict');const {appHarness}=require('./app-harness.cjs');
const setup=async()=>{
  const h=appHarness();await h.run('CloudSync.pull()');
  h.run('CATALOG={books:[{id:"BOOK",title:"Book",questions:1,chapters:[{id:1,qids:["Q000000001"]}]}],specialties:[],fields:[],removed_books:[]}; const q={id:"Q000000001",type:"sba",stem:"Test",options:["One","Two"],answer:"A",images:[],explanation_images:[]}; QI[q.id]={b:"BOOK",ch:1,q}; PACKS["BOOK:1"]={book_id:"BOOK",chapter_id:1,questions:[q],img:{}};');return h;
};
test('actual due session records one attempt, requires rating, and schedules only once offline',async()=>{
  const h=await setup();
  h.run('S.fsrs.Q000000001=KafuReview.engine.grade(null,1,new Date(Date.now()-120000)); saveState();');
  assert.equal(h.run('KafuReview.due().length'),1);
  await h.run('ACTIONS["review-due"]()');assert.equal(h.run('SESSION.mode'),'due');
  h.run('const response=respFor(QI.Q000000001.q); response.sel=0; grade(QI.Q000000001.q,response);');
  assert.equal(h.run('S.answers.Q000000001.n'),1);assert.equal(h.run('S.fsrs.Q000000001.reps'),1);
  assert.equal(h.run('VIEWS.study().action.enabled'),false);
  h.run('ACTIONS["fsrs-rate"]({v:"3"}); ACTIONS["fsrs-rate"]({v:"3"});');
  assert.equal(h.run('S.fsrs.Q000000001.reps'),2);assert.equal(h.run('S.answers.Q000000001.n'),1);
  assert.equal(h.run('VIEWS.study().action.enabled'),true);assert.equal(h.run('KafuReview.due().length'),0);
});
test('normal practice schedules the real SDK once and missing offline cards remain due',async()=>{
  const h=await setup();h.run('SESSION={mode:"practice",bookId:"BOOK"}; recordAnswer(QI.Q000000001.q,{correct:false});');
  assert.equal(h.run('S.fsrs.Q000000001.reps'),1);
  h.run('S.fsrs.Q000000001.due=new Date(Date.now()-1000).toISOString();saveState();delete QI.Q000000001;SESSION=null;');
  await h.run('ACTIONS["review-due"]()');assert.equal(h.run('SESSION'),null);assert.equal(h.run('KafuReview.due().length'),1);
});
