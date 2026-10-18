const test=require('node:test'),assert=require('node:assert/strict');const{appHarness}=require('./app-harness.cjs');
test('Me hides developer diagnostics until seven version taps; outside Telegram fullscreen is never requested',async()=>{
  const h=appHarness();await h.run('CloudSync.pull()');h.run('CATALOG={books:[],fields:[],specialties:[],removed_books:[]};KAFU_BUILD={version:"night1-ux-v1",commit:"'+ 'b'.repeat(40)+'"};KafuUI.setCatalogSource("published");');
  let html=h.run('VIEWS.me().html');assert.match(html,/Version night1-ux-v1/);assert.doesNotMatch(html,/Published catalog/);assert.doesNotMatch(html,/Try full screen/);assert.match(html,/Offline — your downloaded chapters still work/);assert.equal(h.run('KafuUI.fullscreen.snapshot().returned'),'not called');
  for(let i=0;i<6;i++)h.run('ACTIONS["developer-version"]()');
  assert.doesNotMatch(h.run('VIEWS.me().html'),/Published catalog|Try full screen/);
  h.run('ACTIONS["developer-version"]()');html=h.run('VIEWS.me().html');assert.match(html,/Published catalog/);assert.match(html,/Try full screen/);assert.match(html,/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/);
  assert.equal(h.run('KafuUI.fullscreen.snapshot().returned'),'not called');
  h.run('ACTIONS["try-fullscreen"]()');assert.match(h.run('KafuUI.fullscreen.snapshot().result'),/UNSUPPORTED/);
  h.run('navigator.onLine=true');assert.doesNotMatch(h.run('VIEWS.me().html'),/Offline —/);
});
