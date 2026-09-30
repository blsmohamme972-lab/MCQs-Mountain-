const test=require('node:test'),assert=require('node:assert/strict');
const {render}=require('../../../app/modules/question-text.js');
const {appHarness}=require('./app-harness.cjs');
const table='| Response | Score |\n| --- | --- |\n| Motor | |\n| Obeys commands | 6 |\n| No response | 1 |';
test('real table, semantic headers, empty-score section row and numeric scores',()=>{
  const r=render(table);assert.equal(r.hasTables,true);
  assert.match(r.html,/<table class="k-question-table"><thead>/);
  assert.match(r.html,/<th scope="col">Response<\/th>/);
  assert.match(r.html,/<tr class="k-table-section"><th scope="row" colspan="2">Motor<\/th><\/tr>/);
  assert.match(r.html,/<td>Obeys commands<\/td><td>6<\/td>/);
  assert.doesNotMatch(r.html,/\| --- \|/);
});
test('plain text and non-table pipes preserve the existing escaped line-break renderer',()=>{
  for(const s of ['Normal text\nNext line','a | b','| A | B |\n| -- | -- |','| A | B |\n| --- | --- | --- |']){
    const r=render(s);assert.equal(r.hasTables,false);assert.equal(r.html,s.replace(/\n/g,'<br>'));
  }
  assert.equal(render('<b>&"\'</b>').html,'&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;');
});
test('valid one-column tables render without inventing empty-score sections',()=>{
  const r=render('| Label |\n| --- |\n| Value |');assert.equal(r.hasTables,true);
  assert.match(r.html,/<td>Value<\/td>/);assert.doesNotMatch(r.html,/k-table-section/);
});
test('all source HTML, attributes, entities and scripts stay escaped in every cell',()=>{
  const r=render('| <img src=x onerror="alert(1)"> | <script>alert(2)</script> |\n| --- | --- |\n| <b>Motor</b> | |\n| &lt;svg onload=alert(3)&gt; | \'"& |');
  assert.doesNotMatch(r.html,/<(?:img|script|svg|b)[ >]/i);
  assert.match(r.html,/&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(r.html,/&lt;b&gt;Motor&lt;\/b&gt;/);
  assert.match(r.html,/&amp;lt;svg onload=alert\(3\)&amp;gt;/);
  assert.match(r.html,/&#39;&quot;&amp;/);
});
test('optional edge pipes, alignment delimiters, escaped pipes and multiple tables',()=>{
  const s='Before\nName | Value\n:--- | ---:\nA\\|B | 0\n\nBetween\n'+table+'\nAfter';
  const r=render(s);assert.equal((r.html.match(/<table /g)||[]).length,2);
  assert.match(r.html,/<td>A\|B<\/td><td>0<\/td>/);
  assert.match(r.html,/<p>Before<\/p>/);assert.match(r.html,/Between/);assert.match(r.html,/<p>After<\/p>/);
});
test('section rows require a label and all remaining cells empty; malformed rows stay text',()=>{
  const r=render('| Label | Score |\n| --- | --- |\n| | |\n| Zero | 0 |\n| Dash | - |\n| Bad | More | Cells |');
  assert.doesNotMatch(r.html,/k-table-section/);assert.match(r.html,/<td><\/td><td><\/td>/);
  assert.match(r.html,/\| Bad \| More \| Cells \|/);
  assert.equal(render(table.replace(/\n/g,'\r\n')).html,render(table).html);
});
test('app routes stem, SBA/multi/EMQ/MTF options and explanation through the safe renderer',()=>{
  const h=appHarness();h.ctx.tableFixture=table;
  h.run("CATALOG={books:[{id:'TABLE-BOOK',title:'Table fixture',chapters:[]}]};");
  for(const type of ['sba','multi','emq','mtf']){
    const html=h.run(`(()=>{
      const q={id:'TABLE-Q',type:${JSON.stringify(type)},stem:tableFixture,options:[tableFixture,'Plain option'],answer:${type==='mtf'?"['T','F']":type==='multi'?"['A']":"'A'"},explanation:tableFixture,no_shuffle:true};
      QI[q.id]={q,b:'TABLE-BOOK',ch:1};PACKS['TABLE-BOOK:1']={questions:[q]};
      SESSION={mode:'study',title:'Tables',qids:[q.id],index:0,resp:{[q.id]:{done:true,correct:true,score:1,sel:${type==='mtf'?"['T','F']":type==='multi'?"[0]":"0"}}},order:{[q.id]:[0,1]}};
      return VIEWS.study().html;
    })()`);
    assert.equal((html.match(/<table /g)||[]).length,3,type);
    assert.match(html,/class="stem k-question-rich"/);assert.doesNotMatch(html,/<p[^>]*><div class="k-table-box"/);
    assert.doesNotMatch(html,/\| --- \|/);
    assert.equal(h.run("QI['TABLE-Q'].q.explanation"),table);
  }
});
