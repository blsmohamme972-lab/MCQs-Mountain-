const test=require('node:test'),assert=require('node:assert/strict');const Core=require('../../../app/modules/ux-core.js');
test('fullscreen is never automatic; request result is confirmed only by platform state/event',()=>{
  let calls=0,expired=null;const events={};const tg={version:'8.0',platform:'ios',isFullscreen:false,isVersionAtLeast:()=>true,onEvent:(key,fn)=>events[key]=fn,requestFullscreen(){calls++;},exitFullscreen(){calls++;}};
  const d=new Core.FullscreenDiagnostic(tg,{timer:fn=>{expired=fn;return 1;},clear:()=>{}});assert.equal(calls,0);d.request();assert.equal(calls,1);assert.match(d.snapshot().result,/waiting/);assert.equal(d.snapshot().returned,'void (request sent)');
  tg.isFullscreen=true;events.fullscreenChanged();assert.match(d.snapshot().result,/confirmed/);d.request();assert.equal(calls,1);assert.equal(d.snapshot().result,'ALREADY_FULLSCREEN');
  d.request(true);tg.isFullscreen=false;events.fullscreenChanged();assert.equal(d.snapshot().isFullscreen,false);
  d.request();expired();assert.match(d.snapshot().result,/No fullscreen confirmation/);
});
test('unsupported APIs and errors are shown without dumping private Telegram objects',()=>{
  const d=new Core.FullscreenDiagnostic(null);d.request();assert.match(d.snapshot().result,/UNSUPPORTED/);
  const events={},tg={version:'10.1',platform:'tdesktop',isVersionAtLeast:()=>true,onEvent:(name,fn)=>events[name]=fn,requestFullscreen(){throw new TypeError('PRIVATE_DATA');},initData:'SECRET'};
  const other=new Core.FullscreenDiagnostic(tg);other.request();assert.match(other.snapshot().result,/TypeError/);assert.doesNotMatch(JSON.stringify(other.snapshot()),/PRIVATE_DATA|SECRET|initData/);
  events.fullscreenFailed({error:'UNSUPPORTED'});assert.match(other.snapshot().result,/UNSUPPORTED/);
});
test('build and catalog diagnostics use only supported public values',()=>{
  assert.equal(Core.sourceLabel('sample'),'Built-in sample catalog');assert.equal(Core.sourceLabel('published'),'Published catalog');
  assert.equal(Core.buildInfo({version:'night1-ux-v1',commit:'a'.repeat(40)}).commit,'a'.repeat(40));
  assert.equal(Core.buildInfo({version:'<script>',commit:'private-value'}).commit,'development');
});
