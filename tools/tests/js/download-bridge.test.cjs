const test=require('node:test'),assert=require('node:assert/strict');const {appHarness}=require('./app-harness.cjs');
const fflate=require('../../../app/vendor/fflate-0.8.3.js');
const base='https://kafu-content-1.blsmohamme97.workers.dev';
const image=new Uint8Array([82,73,70,70,8,0,0,0,87,69,66,80,1,2,3,4]);
function payload(ch=1,hasImage=true){return{book_id:'BOOK',chapter_id:ch,version:1,questions:[{id:'Q'+String(ch).padStart(9,'0'),type:'sba',options:['A','B'],answer:'A',stem:'Test',images:hasImage?['Q000000001_1.webp']:[],explanation_images:[]}]};}
const response=value=>new Response(value,{status:200,headers:{'content-type':'application/octet-stream'}});
test('actual chapter tap opens text before image download and protects image-dependent grading',async()=>{
  let release;const gate=new Promise(r=>release=r);const zip=fflate.zipSync({'Q000000001_1.webp':image});
  const h=appHarness({online:true,fetcher:async(url,init={})=>{
    if(init.method==='HEAD')return new Response(null,{status:200,headers:{'content-length':String(zip.length)}});
    if(String(url).endsWith('/text.json'))return response(JSON.stringify(payload()));
    if(String(url).endsWith('/images.zip')){await gate;return response(zip);}
    throw new Error('Unexpected URL');
  }});
  await h.run('CloudSync.pull()');h.ctx.base=base;
  h.run('CATALOG={books:[{id:"BOOK",version:1,title:"Book",questions:1,chapters:[{id:1,title:"One",questions:1,url:base+"/text.json",image_url:base+"/images.zip",bytes:300}]}],specialties:[],fields:[],removed_books:[]};');
  await Promise.race([h.run('startChapter("BOOK",1)'),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Text was blocked on images')),1000))]);
  assert.equal(h.run('SESSION.qids.length'),1);assert.equal(h.run('PACKS["BOOK:1"]._offline_complete'),false);
  assert.equal(h.run('VIEWS.study().action.enabled'),false);
  release();await h.run('KafuDownloads.manager.finish(KafuDownloads.metadata("BOOK",1))');
  assert.equal(h.run('PACKS["BOOK:1"]._offline_complete'),true);assert.equal(h.run('!!PACKS["BOOK:1"].img["Q000000001_1.webp"]'),true);
  h.run('SESSION.resp.Q000000001.sel=0;submitCurrent();');assert.equal(h.run('S.answers.Q000000001.n'),1);
  assert.equal(h.run('KafuDownloads.available("BOOK",1)'),false,'Memory-only DB must not claim persistence');
  h.run('DB.mem.images.clear();');await h.run('hydratePackImages("BOOK:1",PACKS["BOOK:1"])');
  assert.equal(h.run('PACKS["BOOK:1"]._offline_complete'),false,'Missing persisted image must invalidate the offline mark');
});
test('only the next chapter is prefetched, with no recursive full-book download',async()=>{
  const requested=[];const h=appHarness({online:true,fetcher:async url=>{requested.push(String(url));const ch=Number(String(url).match(/chapter(\d)/)[1]);return response(JSON.stringify(payload(ch,false)));}});
  await h.run('CloudSync.pull()');h.ctx.base=base;
  h.run('CATALOG={books:[{id:"BOOK",version:1,title:"Book",questions:3,chapters:[1,2,3].map(id=>({id,title:"Chapter "+id,questions:1,url:base+"/chapter"+id+".json",bytes:300}))}],specialties:[],fields:[],removed_books:[]};');
  await h.run('startChapter("BOOK",1)');await new Promise(resolve=>setImmediate(resolve));
  await h.run('KafuDownloads.manager.finish(KafuDownloads.metadata("BOOK",2))');
  assert.equal(requested.length,2);assert.ok(requested.some(url=>url.endsWith('chapter2.json')));assert.ok(!requested.some(url=>url.endsWith('chapter3.json')));
});
