const test=require('node:test'),assert=require('node:assert/strict');
const Core=require('../../../app/modules/download-core.js'),fflate=require('../../../app/vendor/fflate-0.8.3.js');
const meta={book:'BOOK',chapter:1,version:1,questions:1,url:'https://content.test/ch.json',image_url:'https://content.test/im.zip',bytes:300};
const pack=()=>({book_id:'BOOK',chapter_id:1,version:1,questions:[{id:'Q000000001',type:'sba',options:['A','B'],images:['Q000000001_1.webp'],explanation_images:[]}]});
function harness(){
  const cache=new Map();let calls=0,imageCalls=0,online=true,failImages=false,failStore=false,gate=null;
  const manager=new Core.Manager({cached:key=>cache.get(key),online:()=>online,
    text:async()=>{calls++;return pack();},images:async()=>{imageCalls++;if(gate)await gate;if(failImages)throw new Error('image unavailable');return{files:{'Q000000001_1.webp':new Uint8Array(12)},bytes:20};},
    saveText:async()=>{if(failStore)throw new Error('quota');},saveImages:async()=>{if(failStore)throw new Error('quota');},show:(key,value)=>cache.set(key,value),changed:()=>{}});
  return{manager,cache,get calls(){return calls;},get imageCalls(){return imageCalls;},set online(v){online=v;},set failImages(v){failImages=v;},set failStore(v){failStore=v;},set gate(v){gate=v;}};
}
test('text opens before images complete; concurrent opens deduplicate',async()=>{
  const h=harness();let release;h.gate=new Promise(r=>release=r);
  const [a,b]=await Promise.all([h.manager.open(meta),h.manager.open(meta)]);
  assert.equal(a,b);assert.equal(h.calls,1);assert.equal(Core.complete(a,meta),false);
  release();await h.manager.finish(meta);assert.equal(Core.complete(a,meta),true);assert.equal(h.imageCalls,1);
});
test('image failures retain text and never claim complete; retry needs no text refetch',async()=>{
  const h=harness();h.failImages=true;const value=await h.manager.open(meta);
  await assert.rejects(h.manager.finish(meta));assert.equal(value._offline_complete,false);assert.ok(h.cache.has('BOOK:1'));
  h.failImages=false;await h.manager.finish(meta);assert.equal(h.calls,1);assert.equal(value._offline_complete,true);
});
test('quota failures leave online text readable but offline mark false',async()=>{
  const h=harness();h.failStore=true;const value=await h.manager.open(meta);await assert.rejects(h.manager.finish(meta));
  assert.equal(value._offline_complete,false);assert.equal(h.cache.get('BOOK:1'),value);
});
test('offline fallback does not erase an earlier valid chapter version',async()=>{
  const h=harness();const old=await h.manager.finish(meta);h.online=false;
  assert.equal(await h.manager.open({...meta,version:2,url:'https://content.test/v2.json'}),old);
  await assert.rejects(h.manager.finish({...meta,version:2,url:'https://content.test/v2.json'}));assert.equal(h.calls,1);
});
test('remove waits for in-flight writes and blocks reopening during deletion',async()=>{
  const h=harness();let release;h.gate=new Promise(r=>release=r);await h.manager.open(meta);
  const deletion=h.manager.remove('BOOK:1',async()=>h.cache.delete('BOOK:1'));
  await assert.rejects(h.manager.open(meta),/removed/);release();await deletion;assert.equal(h.cache.size,0);
});
test('complete whole book is sequential and reports partial failures',async()=>{
  const h=harness();const result=await h.manager.saveBook([meta,{...meta,book:'OTHER'}]);
  assert.equal(result.saved,1);assert.equal(result.failed.length,1);assert.equal(result.total,2);
});
test('image ZIP extracts only expected safe files and rejects missing/bad images',()=>{
  const image=new Uint8Array([82,73,70,70,8,0,0,0,87,69,66,80,1,2,3,4]);
  const zip=fflate.zipSync({'Q000000001_1.webp':image,'../../bad.txt':new Uint8Array([1])});
  const result=Core.decodeImages(zip,['Q000000001_1.webp'],fflate);assert.deepEqual(Object.keys(result),['Q000000001_1.webp']);
  assert.throws(()=>Core.decodeImages(zip,['Q000000002_1.webp'],fflate));
  assert.throws(()=>Core.decodeImages(fflate.zipSync({'Q000000001_1.webp':new Uint8Array(20)}),['Q000000001_1.webp'],fflate));
});
test('size estimate explicitly tracks missing image byte metadata',()=>{
  assert.deepEqual(Core.bookSize([meta],()=>null),{bytes:300,exact:false});
  assert.deepEqual(Core.bookSize([{...meta,image_bytes:100}],()=>null),{bytes:400,exact:true});
});
