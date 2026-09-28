const test=require('node:test'),assert=require('node:assert/strict');
const {UndoWindow}=require('../../../app/design/usability-core.js');
test('deletion does not occur before grace period and undo prevents it',async()=>{
 let callback,cleared=0,writes=0;const undo=new UndoWindow({setTimer:fn=>(callback=fn,1),clearTimer:()=>cleared++});
 undo.stage(async()=>writes++);assert.equal(writes,0);assert.equal(undo.cancel(),true);await callback();assert.equal(writes,0);assert.equal(cleared,1);
});
test('only the newest staged action can commit once',async()=>{
 const callbacks=[];let writes=[];const undo=new UndoWindow({setTimer:fn=>(callbacks.push(fn),callbacks.length),clearTimer:()=>{}});
 undo.stage(async()=>writes.push('old'));undo.stage(async()=>writes.push('new'));
 await callbacks[0]();await callbacks[1]();await callbacks[1]();assert.deepEqual(writes,['new']);assert.equal(undo.pending,null);
});
test('usability installs with real app and preserves critical entry points',async()=>{
 const {appHarness}=require('./app-harness.cjs');const h=appHarness();assert.equal(h.run('typeof ACTIONS["undo-change"]'),'function');assert.equal(h.run('typeof ACTIONS.continue'),'function');assert.equal(h.run('typeof KafuDownloads.manager.open'),'function');assert.equal(h.run('typeof KafuPersonal.flush'),'function');
});

test('default timers retain the browser global receiver',()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 const sandbox={};vm.createContext(sandbox);
 vm.runInContext(`globalThis.setTimeout=function(){if(this!==globalThis)throw new TypeError('Illegal invocation');return 5;};globalThis.clearTimeout=function(){if(this!==globalThis)throw new TypeError('Illegal invocation');};`,sandbox);
 vm.runInContext(fs.readFileSync(require.resolve('../../../app/design/usability-core.js'),'utf8'),sandbox);
 vm.runInContext(`const w=new KafuUndoWindow();w.stage(()=>{});if(!w.cancel())throw Error('cancel failed');`,sandbox);
});
