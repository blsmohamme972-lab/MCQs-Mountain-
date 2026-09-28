const test=require('node:test'),assert=require('node:assert/strict');const{appHarness}=require('./app-harness.cjs');
async function setup(){const h=appHarness();await h.run('CloudSync.pull()');h.run('CATALOG={books:[],fields:[],specialties:[],removed_books:[]};');return h;}
test('educational notice appears once until acknowledged and persists with local personal state',async()=>{
  const h=await setup();assert.match(h.run('VIEWS.me().html'),/data-kafu-education="1"/);
  await h.run('ACTIONS["ack-education"]()');assert.doesNotMatch(h.run('VIEWS.me().html'),/data-kafu-education="1"/);
  assert.equal(h.run('S.settings.education_ack'),h.run('KafuPrivacy.VERSION'));
  assert.equal((await h.run('DB.get("meta","state")')).settings.education_ack,h.run('KafuPrivacy.VERSION'));
  assert.equal(h.run('KafuPrivacy.needed({education_ack:KafuPrivacy.VERSION})'),false);
  assert.equal(h.run('KafuPrivacy.needed({})'),true);
});
test('privacy and About remain available after acknowledgement with honest storage and disclaimer copy',async()=>{
  const h=await setup();await h.run('ACTIONS["ack-education"]()');
  const privacy=h.run('VIEWS.privacy().html'),about=h.run('VIEWS.about().html');
  assert.match(privacy,/We never sell student data/);assert.match(privacy,/CloudStorage/);assert.match(privacy,/saved here first and retried when online/);assert.match(privacy,/pseudonymous key is stored for rate limiting/);assert.match(privacy,/backups may retain an earlier copy/);assert.match(privacy,/older cloud checkpoints/);
  assert.match(about,/Educational use only — not for clinical decisions/);assert.match(about,/ts-fsrs 5.4.2/);assert.match(about,/fflate 0.8.3/);
  h.run('ACTIONS.privacy()');assert.equal(h.run('cur().v'),'privacy');h.run('ACTIONS.about()');assert.equal(h.run('cur().v'),'about');
});
