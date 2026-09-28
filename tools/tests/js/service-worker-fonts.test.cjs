const test=require('node:test'),assert=require('node:assert/strict');const{runtime}=require('../../../app/sw.js');
test('font warming uses CORS and classic SDK/CSS warming uses no-cors',async()=>{
  const seen=[];const env={location:{origin:'https://kafu.test'},caches:{open:async()=>({match:async()=>null,put:async()=>{},keys:async()=>[]})},clients:{claim:async()=>{}},fetch:async request=>{seen.push([request.url,request.mode]);return new Response('public',{status:200});}};
  const app=runtime(env);await app.warm(['https://fonts.gstatic.com/s/lora/v1/font.woff2','https://fonts.googleapis.com/css2?family=Lora','https://telegram.org/js/telegram-web-app.js','https://kafu.test/internal/claim']);
  assert.equal(seen.length,3);assert.equal(seen[0][1],'cors');assert.equal(seen[1][1],'no-cors');assert.equal(seen[2][1],'no-cors');
  assert.equal(await app.acceptable({type:'opaque'},'font'),false);assert.equal(await app.acceptable({type:'opaque'},'font-css'),true);
});
