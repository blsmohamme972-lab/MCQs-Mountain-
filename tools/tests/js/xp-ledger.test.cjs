const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function harness(answers={},stored=null){
  let installer;const meta=new Map(stored?[['xp_ledger_user_browser',stored]]:[]);const S={answers};let now=Date.UTC(2026,9,13,9);
  const ctx={KafuEnhancements:{installers:{push(x){installer=x}}},IN_TG:false,TG:null,S,SESSION:null,
    DB:{open:async()=>{},get:async(_,k)=>meta.get(k),put:async(_,k,v)=>{meta.set(k,structuredClone(v))}},
    recordAnswer(q,r){S.answers[q.id]={c:r.correct,n:(S.answers[q.id]?.n||0)+1,t:now}},setTimeout:fn=>fn(),clearTimeout(){},
    Date:class extends Date{static now(){return now}},WeakMap,Object,Number,Math};
  ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../../app/modules/xp-ledger.js'),'utf8'),ctx);installer.install();
  return{ctx,S,meta,tick:ms=>{now+=ms},get now(){return now}};
}
const answer=(h,id,correct)=>h.ctx.recordAnswer({id},{correct});
test('new questions: 10 if correct, 5 if wrong; same question again today: 0',async()=>{
  const h=harness();await h.ctx.DB.open();
  answer(h,'Q000000001',true);answer(h,'Q000000002',false);answer(h,'Q000000001',true);
  assert.equal(h.ctx.KafuXP.total(),15);
});
test('returning on a later day (reviews, mistakes): 12 if correct, 4 if wrong',async()=>{
  const h=harness();await h.ctx.DB.open();
  answer(h,'Q000000001',false);h.tick(86400000);answer(h,'Q000000001',true);h.tick(86400000);answer(h,'Q000000001',false);
  assert.equal(h.ctx.KafuXP.total(),5+12+4);
});
test('answers from before the ledger keep 10 XP each on their own day, and are not lost when answered again',async()=>{
  const t=Date.UTC(2026,9,10,9),h=harness({Q000000001:{c:true,n:1,t},Q000000002:{c:false,n:2,t}});await h.ctx.DB.open();
  assert.equal(h.ctx.KafuXP.total(),20,'same as the old answered x 10');
  answer(h,'Q000000001',true);
  assert.equal(h.ctx.KafuXP.total(),32,'legacy 10 kept + 12 for the later-day return');
  assert.equal(h.ctx.KafuXP.between(t,t),20,'still counted on its own day');
});
test('the ledger persists per account and reloads',async()=>{
  const h=harness();await h.ctx.DB.open();answer(h,'Q000000003',true);
  const saved=h.meta.get('xp_ledger_user_browser');assert.equal(Object.values(saved.days)[0],10);
  const h2=harness({Q000000003:{c:true,n:1,t:h.now}},saved);await h2.ctx.DB.open();
  assert.equal(h2.ctx.KafuXP.total(),10,'not counted twice after reload');
});
test('session gains are tracked per session object',async()=>{
  const h=harness();await h.ctx.DB.open();const s={};h.ctx.SESSION=s;
  answer(h,'Q000000004',true);answer(h,'Q000000005',false);
  assert.equal(h.ctx.KafuXP.session(s),15);
});
