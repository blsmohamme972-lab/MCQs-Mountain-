const test=require('node:test'),assert=require('node:assert/strict');const{appHarness}=require('./app-harness.cjs');
test('Me shows build/source/fullscreen diagnostic and offline banner without requesting fullscreen',async()=>{
  const h=appHarness();await h.run('CloudSync.pull()');h.run('CATALOG={books:[],fields:[],specialties:[],removed_books:[]};KAFU_BUILD={version:"night1-ux-v1",commit:"'+ 'b'.repeat(40)+'"};KafuUI.setCatalogSource("published");');
  const html=h.run('VIEWS.me().html');assert.match(html,/night1-ux-v1/);assert.match(html,/Published catalog/);assert.match(html,/Try full screen/);assert.match(html,/Offline — your downloaded chapters still work/);assert.equal(h.run('KafuUI.fullscreen.snapshot().returned'),'not called');
  h.run('ACTIONS["try-fullscreen"]()');assert.match(h.run('KafuUI.fullscreen.snapshot().result'),/UNSUPPORTED/);
  h.run('navigator.onLine=true');assert.doesNotMatch(h.run('VIEWS.me().html'),/Offline —/);
});
