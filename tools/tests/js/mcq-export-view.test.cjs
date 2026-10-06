const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const ROOT=path.resolve(__dirname,'../../..');
const MODULES=new Set(['modules/enhancements.js','modules/download-core.js','modules/download-bridge.js','modules/mcq-export-core.js','modules/mcq-export.js']);
const flush=()=>new Promise(r=>setImmediate(r));
const count=html=>(html.match(/class="mcq-export-action"/g)||[]).length;
function book(){return{id:'BOOK',title:'Book',specialty:'Surgery',version:1,questions:2,chapters:[
{id:1,title:'Chapter One',questions:1,url:'https://kafu.test/ch1.json',bytes:300,qids:['Q000000001']},
{id:2,title:'A very long Chapter Two title that must stay inside the viewport on a narrow phone',questions:1,url:'https://kafu.test/ch2.json',bytes:300,qids:['Q000000002']}]};}
function pack(ch){return{book_id:'BOOK',chapter_id:ch,version:1,questions:[{id:`Q${String(ch).padStart(9,'0')}`,type:'sba',options:['A','B'],answer:'A',stem:'Test',images:[],explanation_images:[]}],_source_url:`https://kafu.test/ch${ch}.json`,_image_source_url:null,_offline_complete:true};}
async function harness({session='',capability=false,gate=null,status=200}={}){
 let studies=0;
 const ctx={console,crypto:webcrypto,TextEncoder,TextDecoder,URL,URLSearchParams,Blob,AbortController,AbortSignal,Response,Request,Headers,Date,Map,Set,Promise,
 setTimeout:()=>1,clearTimeout:()=>{},setInterval:()=>1,clearInterval:()=>{},navigator:{onLine:false,connection:{saveData:true},clipboard:{writeText:async()=>{}}},
 location:{href:'https://kafu.test/',origin:'https://kafu.test'},CONFIG:{CONTENT_BASE:'https://kafu.test'},addEventListener:()=>{},
 document:{visibilityState:'visible',addEventListener:()=>{},getElementById:()=>null,createElement:()=>({click(){},focus(){},select(){}})},
 CATALOG:{books:[book()],specialties:[],fields:[],removed_books:[]},PACKS:{},QI:{},SESSION:{qids:[],index:0,resp:{}},S:{favBooks:[],answers:{},dl:{}},
 DB:{db:true,put:async()=>{},mem:{images:new Map()}},ACTIONS:{},VIEWS:{book:()=>({title:'',html:''}),study:()=>({title:'',html:'study',action:{enabled:true}})},
 ICON:{next:'>',chev:'>',heart:'♡',heartOn:'♥'},TG:{initData:session},SHEET:null,render:()=>{},cur:()=>({v:'book',p:{b:'BOOK'}}),
 esc:v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 bookById:id=>ctx.CATALOG.books.find(b=>String(b.id)===String(id)),bookStats:()=>({pct:25}),coverHTML:()=>'<div>cover</div>',
 deleteChapter:async()=>{},fetchPack:async()=>null,ensureFflate:async()=>null,downloadChapter:async()=>null,startChapter:async()=>null,saveState:()=>{},
 imageKey:(k,n)=>k+':'+n,releaseImageUrls:()=>{},hydratePackImages:async()=>{},unindexPack:()=>{},indexPack:()=>{},toast:()=>{},submitCurrent:()=>{},
 startSession:v=>{studies++;ctx.SESSION={...v,resp:{}};}};
 ctx.window=ctx;ctx.ACTIONS['study-ch']=d=>ctx.startChapter(d.b,Number(d.c));
 ctx.fetch=async(url,init={})=>{if(String(url)!=='/admin/capabilities')throw new Error('Unexpected fetch '+url);if(gate)return gate.promise;
 const body=JSON.parse(init.body||'{}'),allowed=typeof capability==='function'?capability(body.initData):capability;
 return new Response(JSON.stringify(status===200?{can_export_mcqs:allowed===true}:{error:'forbidden'}),{status,headers:{'content-type':'application/json'}});};
 vm.createContext(ctx);const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'app/modules/manifest.json'),'utf8'));
 const loaded=manifest.scripts.filter(x=>MODULES.has(x));assert.deepEqual(loaded,[...MODULES]);
 for(const file of loaded)vm.runInContext(fs.readFileSync(path.join(ROOT,'app',file),'utf8'),ctx,{filename:file});
 vm.runInContext('globalThis.KafuEnhancements.install();',ctx);assert.deepEqual(Array.from(ctx.KafuEnhancements.failures),[]);
 if(!gate){await flush();await flush();}
 return{ctx,view:()=>vm.runInContext('VIEWS.book({b:"BOOK"}).html',ctx),studies:()=>studies};
}
test('owner gets exactly N+1 export controls',async()=>{const h=await harness({session:'owner',capability:true});assert.equal(count(h.view()),3);});
test('student or denied session gets zero export controls',async()=>{assert.equal(count((await harness({session:'student',capability:false})).view()),0);assert.equal(count((await harness({session:'denied',status:403})).view()),0);});
test('late capability appears on rerender and repeated render does not duplicate',async()=>{let resolve;const gate={promise:new Promise(r=>resolve=r)};const h=await harness({session:'owner',gate});assert.equal(count(h.view()),0);resolve(new Response('{"can_export_mcqs":true}',{status:200,headers:{'content-type':'application/json'}}));await flush();await flush();for(let i=0;i<4;i++)assert.equal(count(h.view()),3);});
test('download state does not suppress export controls',async()=>{const h=await harness({session:'owner',capability:true});h.ctx.PACKS['BOOK:1']=pack(1);h.ctx.KafuDownloads.manager.jobs.set('BOOK:2',{text:Promise.resolve(null),done:Promise.resolve(null)});const html=h.view();assert.equal(count(html),3);assert.match(html,/Available offline/);assert.match(html,/Saving in the background/);});
test('chapter C is sibling of study button and opens only export sheet',async()=>{const h=await harness({session:'owner',capability:true});const html=h.view();assert.doesNotMatch(html,/<button[^>]*class="ch-row"[^>]*>[\s\S]*mcq-export-action/);h.ctx.ACTIONS['mcq-export-chapter']({b:'BOOK',c:'2'});assert.equal(h.studies(),0);assert.equal(typeof h.ctx.SHEET,'function');assert.match(h.ctx.SHEET(),/ID 2/);h.ctx.PACKS['BOOK:2']=pack(2);await h.ctx.ACTIONS['study-ch']({b:'BOOK',c:'2'});assert.equal(h.studies(),1);});
test('owner-student-owner switch clears stale export state',async()=>{const h=await harness({session:'owner',capability:v=>v.includes('owner')});assert.equal(count(h.view()),3);h.ctx.ACTIONS['mcq-export-book']({b:'BOOK'});assert.equal(typeof h.ctx.SHEET,'function');h.ctx.TG.initData='student';h.ctx.render();await flush();await flush();assert.equal(count(h.view()),0);assert.equal(h.ctx.SHEET,null);h.ctx.TG.initData='owner-again';h.ctx.render();await flush();await flush();assert.equal(count(h.view()),3);assert.equal(h.ctx.SHEET,null);});
test('chapter export layout remains contained',()=>{const css=fs.readFileSync(path.join(ROOT,'app/modules/mcq-export.css'),'utf8');assert.match(css,/\.mcq-export-chapter-open\s*\{[^}]*flex:\s*1 1 auto[^}]*min-width:\s*0[^}]*min-height:\s*var\(--tap-target\)/s);assert.match(css,/\.mcq-export-chapter-open \.t\s*\{[^}]*overflow-wrap:\s*anywhere/s);});
