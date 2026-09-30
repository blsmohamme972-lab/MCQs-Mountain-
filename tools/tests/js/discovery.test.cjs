const test=require('node:test'),assert=require('node:assert/strict'),Core=require('../../../app/design/discovery-core.js');
const q=i=>'Q'+String(i).padStart(9,'0');
const book={id:'A',version:1,title:'Clinical Cardiolog\u00edy',specialty:'Cardiology',questions:2,chapters:[{id:1,questions:2,qids:[q(1),q(2)]}]};
const catalog={books:[book,{id:'B',title:'Surgery Essentials',specialty:'Surgery'},{id:'C',title:'Retired',specialty:'Cardiology'}],removed_books:['C']};
function branchHarness(catalog){
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
 const html=fs.readFileSync(path.resolve(__dirname,'../../../app/index.html'),'utf8');
 const escape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const ctx={CATALOG:catalog,esc:escape,BRANCH_ICON:{surgery:'<svg></svg>',heart:'<svg></svg>',emergency:'<svg></svg>'},bookCard:()=>''};
 vm.createContext(ctx);
 vm.runInContext(html.slice(html.indexOf('const BRANCH_ART ='),html.indexOf('let branchFallbackPromise'))+'\nglobalThis.branches=availableBranches;globalThis.card=branchCard;',ctx);
 const start=html.indexOf('  library() {'),end=html.indexOf('  spec(p) {',start);
 vm.runInContext('globalThis.library=({'+html.slice(start,end)+'}).library;',ctx);
 return ctx;
}
test('branch picker hides empty specialties and uses General Surgery books',()=>{
 const source={specialties:[{id:'General Surgery'},{id:'Pulmonology'},{id:'Pharmacology'}],books:[{id:'S1',specialty:'General Surgery'},{id:'S2',specialty:'General Surgery'}]};
 const original=JSON.stringify(source),h=branchHarness(source),branches=h.branches();
 assert.equal(branches.length,1);assert.equal(branches[0].count,2);assert.equal(branches[0].art.id,'surgery');
 const rendered=h.library().html;assert.match(rendered,/data-s="General Surgery"/);assert.match(rendered,/2 books/);
 assert.doesNotMatch(rendered,/Pulmonology|Pharmacology|0 books/);assert.equal(JSON.stringify(source),original);
});
test('uploading a book automatically reveals its existing specialty artwork',()=>{
 const source={specialties:[{id:'General Surgery'},{id:'Cardiology'}],books:[{id:'S',specialty:'General Surgery'}]};
 const h=branchHarness(source);assert.equal(h.branches().length,1);
 source.books.push({id:'C',specialty:'Cardiology'});
 assert.equal(h.branches().length,2);assert.match(h.library().html,/data-branch="cardiology"/);
});
test('system fixtures do not expose Cardiology but a new real book does',()=>{
 const source={specialties:[{id:'General Surgery'},{id:'Cardiology'}],books:[{id:'S',title:'Surgery',specialty:'General Surgery'},...['KAFU-FIXTURE-ALLTYPES','KAFU-FIXTURE-MULTIPART','KAFU-UPLOAD-TEST'].map(id=>({id,title:id,specialty:'Cardiology'}))]};
 const original=JSON.stringify(source),h=branchHarness(source);
 assert.equal(h.branches().length,1);assert.doesNotMatch(h.library().html,/Cardiology/);
 assert.deepEqual(Core.specialties(source),['General Surgery']);assert.equal(Core.books(source).length,1);
 assert.equal(JSON.stringify(source),original);
 source.books.push({id:'CARDIO-REVIEW',title:'Cardiology Review',specialty:'Cardiology'});
 assert.equal(h.branches().length,2);assert.deepEqual(Core.specialties(source),['Cardiology','General Surgery']);
});
test('new specialties get complete matching cards without broken image URLs',()=>{
 const h=branchHarness({specialties:[],books:[{id:'N',specialty:'New <Specialty>'}]});
 const branches=h.branches();assert.equal(branches[0].art.id,'generic');
 const rendered=h.library().html;assert.match(rendered,/kb-card kb-/);assert.match(rendered,/kb-generic-art/);
 assert.match(rendered,/data-s="New &lt;Specialty&gt;"/);assert.match(rendered,/1 book/);
 assert.doesNotMatch(rendered,/<img|undefined|Other specialties/);
});
test('removed books do not reveal specialty cards and aliases do not lose books',()=>{
 const h=branchHarness({specialties:[{id:'General Surgery'},{id:'Surgery'},{id:'Cardiology'}],removed_books:['C'],books:[{id:'G',specialty:'General Surgery'},{id:'S',specialty:'Surgery'},{id:'C',specialty:'Cardiology'}]});
 assert.equal(h.branches().length,2);assert.doesNotMatch(h.library().html,/Cardiology/);
 assert.match(h.library().html,/data-s="Surgery"/);assert.match(h.library().html,/data-s="General Surgery"/);
 const empty=branchHarness({specialties:[{id:'General Surgery'}],books:[]});assert.equal(empty.branches().length,0);
 assert.match(empty.library().html,/when books are available/);assert.doesNotMatch(empty.library().html,/class="kb-card/);
});
test('title search and specialty filters are accent/case tolerant and pure',()=>{
 const old=JSON.stringify(catalog);assert.equal(Core.books(catalog,'CLINICAL cardiologiy','Cardiology').length,1);
 assert.equal(Core.books(catalog,'Clinical','Surgery').length,0);assert.deepEqual(Core.books(catalog,'','Surgery').map(b=>b.id),['B']);
 assert.equal(Core.books(catalog,'<img>').length,0);assert.deepEqual(Core.specialties(catalog),['Cardiology','Surgery']);assert.equal(JSON.stringify(catalog),old);
});
test('progress uses complete current QID evidence and excludes other books',()=>{
 const a={[q(1)]:{b:'A',n:1},[q(2)]:{b:'B',n:3}},old=JSON.stringify(a);
 assert.deepEqual(Core.progress(book,a),{answered:1,total:2,percent:50,exact:true});assert.equal(JSON.stringify(a),old);
 const missing={...book,chapters:[{id:1,questions:2}]};assert.equal(Core.progress(missing,a).exact,false);
 assert.equal(Core.progress(missing,a,{'A:1':{book_id:'A',version:1,chapter_id:1,questions:[{id:q(1)},{id:q(2)}]}}).percent,50);
 assert.equal(Core.progress(missing,a,{'A:1':{book_id:'A',version:2,chapter_id:1,questions:[{id:q(1)},{id:q(2)}]}}).exact,false);
 assert.equal(Core.progress({...book,chapters:[{id:1,questions:2,qids:[q(1),q(1)]}]},a).exact,false);
});
test('daily goal and resume only derive existing state',()=>{
 const s={time:{'2026-09-28':420},resume:{b:'A',ch:1,q:q(2)}};const old=JSON.stringify(s);
 assert.equal(Core.goal(s,'2026-09-28').percent,70);assert.equal(Core.goal(s,'2026-09-29').seconds,0);
 assert.equal(Core.goal({time:{x:Infinity}},'x').seconds,0);assert.equal(Core.goal({time:{x:700}},'x').complete,true);
 assert.equal(Core.resume(s,catalog).book.id,'A');assert.equal(Core.resume({...s,resume:{b:'C',ch:1}},catalog),null);assert.equal(JSON.stringify(s),old);
});
