const test=require('node:test'),assert=require('node:assert/strict'),Core=require('../../../app/design/discovery-core.js');
const q=i=>'Q'+String(i).padStart(9,'0');
const book={id:'A',version:1,title:'Clinical Cardiolog\u00edy',specialty:'Cardiology',questions:2,chapters:[{id:1,questions:2,qids:[q(1),q(2)]}]};
const catalog={books:[book,{id:'B',title:'Surgery Essentials',specialty:'Surgery'},{id:'C',title:'Retired',specialty:'Cardiology'}],removed_books:['C']};
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
