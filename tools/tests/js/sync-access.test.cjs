const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
const code=fs.readFileSync(path.resolve(__dirname,'../../../app/modules/sync-access.js'),'utf8');
test('cloud access requires an identifiable Telegram local account',()=>{
  for(const [inside,id,expected]of[[false,123,false],[true,undefined,false],[true,NaN,false],[true,123,true]]){
    const ctx={IN_TG:inside,TG:{initDataUnsafe:{user:{id}}},CloudSync:{ok:()=>true},KafuEnhancements:{installers:[]}};vm.createContext(ctx);vm.runInContext(code,ctx);ctx.KafuEnhancements.installers[0].install();assert.equal(ctx.CloudSync.ok(),expected);
  }
});
