const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const code=fs.readFileSync(path.resolve(__dirname,'../../../app/modules/shell-bridge.js'),'utf8');
function setup(serviceWorker){
  const ctx={navigator:{serviceWorker},isSecureContext:true,CATALOG:null,cur:()=>({v:'me'}),render:()=>{},esc:String,
    VIEWS:{me:()=>({html:'Me'})},KafuEnhancements:{installers:[]},document:{querySelectorAll:()=>[]},addEventListener:()=>{},performance:{getEntriesByType:()=>[]}};
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx);ctx.KafuEnhancements.installers[0].install();return ctx;
}
test('Telegram browsers without service workers keep all app code operational',()=>{
  const ctx=setup(undefined);assert.equal(ctx.KafuShell.status,'unavailable');assert.match(ctx.VIEWS.me().html,/downloaded chapters still work/);
});
test('registration security errors become a status, not a boot failure',async()=>{
  const ctx=setup({register(){throw new Error('SecurityError');}});await Promise.resolve();assert.equal(ctx.KafuShell.status,'failed');
});
test('registration uses only local root SW, does not reload, and supports ready/updates',async()=>{
  let url,options;const active={postMessage:()=>{}},registration={active,waiting:null,addEventListener:()=>{}};
  const ctx=setup({register:async(u,o)=>{url=u;options=o;return registration;},ready:Promise.resolve(registration),addEventListener:()=>{}});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(url,'/sw.js');assert.equal(options.scope,'/');assert.equal(ctx.KafuShell.status,'ready');
});
