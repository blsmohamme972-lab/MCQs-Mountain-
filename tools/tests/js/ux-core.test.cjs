const test=require('node:test'),assert=require('node:assert/strict');const Core=require('../../../app/modules/ux-core.js');
test('a fullscreen request is never made by construction; its result is confirmed only by platform state/event',()=>{
  let calls=0,expired=null;const events={};const tg={version:'8.0',platform:'ios',isFullscreen:false,isVersionAtLeast:()=>true,onEvent:(key,fn)=>events[key]=fn,requestFullscreen(){calls++;},exitFullscreen(){calls++;}};
  const d=new Core.FullscreenDiagnostic(tg,{timer:fn=>{expired=fn;return 1;},clear:()=>{}});assert.equal(calls,0);d.request();assert.equal(calls,1);assert.match(d.snapshot().result,/waiting/);assert.equal(d.snapshot().returned,'void (request sent)');
  tg.isFullscreen=true;events.fullscreenChanged();assert.match(d.snapshot().result,/confirmed/);d.request();assert.equal(calls,1);assert.equal(d.snapshot().result,'ALREADY_FULLSCREEN');
  d.request(true);tg.isFullscreen=false;events.fullscreenChanged();assert.equal(d.snapshot().isFullscreen,false);
  d.request();expired();assert.match(d.snapshot().result,/No fullscreen confirmation/);
});
test('tablets ask for fullscreen once by themselves; phones, desktops and old clients never do',()=>{
  const make=(platform,{version=true,full=false}={})=>{const t={platform,version:'8.0',isFullscreen:full,calls:0,isVersionAtLeast:()=>version,onEvent:()=>{},requestFullscreen(){t.calls++;}};return t;};
  const ipad={width:820,height:1180},ipadLand={width:1180,height:820},phone={width:390,height:844},androidTab={width:800,height:1280};
  let tg=make('ios');const d=new Core.FullscreenDiagnostic(tg,{timer:()=>1,clear:()=>{}});
  assert.equal(d.autoTablet(ipad),true);assert.equal(tg.calls,1);assert.equal(d.snapshot().automatic,true);assert.match(d.snapshot().result,/waiting/);
  assert.equal(d.autoTablet(ipad),false);assert.equal(tg.calls,1);
  for(const [platform,screen] of [['ios',ipadLand],['android',androidTab],['android_x',androidTab]]){tg=make(platform);assert.equal(new Core.FullscreenDiagnostic(tg,{timer:()=>1}).autoTablet(screen),true);assert.equal(tg.calls,1);}
  for(const [t,screen] of [[make('ios'),phone],[make('android'),{width:412,height:915}],[make('tdesktop'),{width:1280,height:800}],[make('macos'),ipad],[make('weba'),ipad],[make('ios',{version:false}),ipad],[make('ios',{full:true}),ipad]]){
    assert.equal(new Core.FullscreenDiagnostic(t,{timer:()=>1}).autoTablet(screen),false);assert.equal(t.calls,0);
  }
  assert.equal(new Core.FullscreenDiagnostic(null).autoTablet(ipad),false);assert.equal(Core.isTablet(make('ios'),undefined),false);
});
test('the default timers work in a browser, where a detached setTimeout or clearTimeout throws',()=>{
  const st=globalThis.setTimeout,ct=globalThis.clearTimeout,strict=fn=>function(...args){if(this!==undefined&&this!==globalThis)throw new TypeError('Illegal invocation');return fn(...args);};
  globalThis.setTimeout=strict(()=>7);globalThis.clearTimeout=strict(()=>{});
  try{
    const events={},tg={platform:'ios',version:'8.0',isFullscreen:false,isVersionAtLeast:()=>true,onEvent:(k,f)=>events[k]=f,requestFullscreen(){}};
    const d=new Core.FullscreenDiagnostic(tg);d.request();assert.match(d.snapshot().result,/waiting/);
    tg.isFullscreen=true;events.fullscreenChanged();assert.match(d.snapshot().result,/confirmed/);
    events.fullscreenFailed({error:'UNSUPPORTED'});assert.match(d.snapshot().result,/UNSUPPORTED/);
  }finally{globalThis.setTimeout=st;globalThis.clearTimeout=ct;}
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
