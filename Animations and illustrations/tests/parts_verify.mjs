/** Reusable parts engine and catalog tests. Run: node tests/parts_verify.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
vm.runInThisContext(fs.readFileSync(path.join(root,'parts/medical-parts.js'),'utf8'),{filename:'parts/medical-parts.js'});
const M=globalThis.MedicalMotionParts;
const definitionsSource=fs.readFileSync(path.join(root,'parts','definitions','medical.js'),'utf8');
const definitionIds=[...definitionsSource.matchAll(/\bid:'([a-z0-9-]+)'/g)].map(m=>m[1]);
assert.equal(new Set(definitionIds).size,37);
assert.equal(definitionIds.length,37);
assert.ok(fs.readFileSync(path.join(root,'parts','medical-parts.js'),'utf8').includes('Generated classic bundle'));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'parts/catalog.json'),'utf8'));
const schema=JSON.parse(fs.readFileSync(path.join(root,'parts/schema.json'),'utf8'));
const sceneSchema=JSON.parse(fs.readFileSync(path.join(root,'parts/composed-scene.schema.json'),'utf8'));
assert.equal(schema.properties.version.const,2);
assert.equal(schema.properties.engine.const,'parts/medical-parts.js');
assert.ok(['attachments','bounds','dependencies','parameterSchema','stateSchema'].every(k=>schema.properties.parts.items.required.includes(k)));
assert.equal(sceneSchema.properties.version.const,2);
assert.equal(M.version,'2.0.0');
assert.equal(M.contractVersion,2);
assert.equal(M.list().length,37);
assert.equal(catalog.version,2);
assert.equal(catalog.parts.length,37);
assert.deepEqual(catalog.parts.map(p=>p.id),M.list().map(p=>p.id));
for(const part of M.list()){
  assert.ok(part.category && part.anatomyLevel && part.role);
  assert.ok(part.keywords.length && part.aliases.length);
  assert.ok(part.sources.length && part.limitations && part.attachments && part.bounds);
  const catalogPart=catalog.parts.find(p=>p.id===part.id);
  assert.deepEqual(catalogPart.source,part.sources);
  assert.deepEqual(catalogPart.attachments,part.attachments);
  assert.deepEqual(catalogPart.bounds,part.bounds);
  assert.equal(catalogPart.file,'parts/medical-parts.js');
  assert.deepEqual(catalogPart.dependencies,part.dependencies);
  assert.deepEqual(catalogPart.parameterSchema,part.parameterSchema);
  assert.deepEqual(catalogPart.stateSchema,part.stateSchema);
  assert.deepEqual(catalogPart.composition.options,['x','y','scale','rotation','opacity','accent','theme','params','state','time','progress']);
  for(const [name,point] of Object.entries(part.attachments)) assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y),name);
  for(const options of [{},{x:120,y:130,scale:.65,rotation:25,opacity:.8,accent:'teal',theme:'night'},{x:500,y:300,scale:1.4,accent:'gold',progress:.5,time:1.25}]){
    const svg=M.renderSVG(part.id,options);
    assert.ok(svg.startsWith('<svg '));
    assert.ok(!/NaN|Infinity|undefined/.test(svg));
    assert.equal(svg,M.renderSVG(part.id,options));
    assert.ok(M.render(part.id,options).startsWith('<g '));
  }
}
for(const bad of [{scale:0},{scale:9},{opacity:-.1},{opacity:1.1},{x:NaN},{accent:'not-a-palette-key'},{unknown:1},null,[]])assert.throws(()=>M.validate(bad));
assert.equal(M.render('red-blood-cell',{x:100,y:90}).includes('translate(-220 -130)'),true);
assert.notEqual(M.render('red-blood-cell',{accent:'blue'}),M.render('red-blood-cell',{accent:'teal'}));
assert.notEqual(M.render('vessel-segment',{params:{kind:'artery',narrowing:0,valve:false},progress:0}),M.render('vessel-segment',{params:{kind:'artery',narrowing:.7,valve:true},progress:1}));
assert.throws(()=>M.render('vessel-segment',{params:{kind:'artery',narrowing:2,valve:false}}));
// Vessel geometry is a closed, layered lumen. This catches regressions where a
// composed flow lane is drawn against two open strokes and appears outside the vessel.
const vesselMarkup=M.render('vessel-segment',{params:{kind:'artery',narrowing:0,valve:false}});
assert.ok((vesselMarkup.match(/ Z\"/g)||[]).length>=2,'vessel must expose closed outer and inner ribbons');
assert.ok(vesselMarkup.includes('fill=\"#eaf1fb\"'),'vessel must include an explicit lumen fill');
const denseFibrinMarkup=M.render('fibrin-mesh',{params:{density:1},progress:1});
const denseHorizontalYs=[...denseFibrinMarkup.matchAll(/M 100 ([0-9.]+)/g)].map(m=>Number(m[1]));
const denseDiagonalEnds=[...denseFibrinMarkup.matchAll(/ L [0-9.]+ ([0-9.]+)/g)].map(m=>Number(m[1]));
assert.ok([...denseHorizontalYs,...denseDiagonalEnds].every(y=>y>=110&&y<=330),'dense fibrin must remain inside its declared local bounds');
assert.throws(()=>M.render('blood-flow',{params:{points:[[1,2]],count:2,speed:1}}));
assert.throws(()=>M.render('attachment-label',{state:{attachments:{center:{x:'bad',y:2}}}}));
assert.throws(()=>M.render('attachment-label',{state:{hiddenState:true}}));
const parameterVariants=[
  ['blood-flow',{params:{points:[[80,220],[560,220]],count:3,speed:.2},time:0}, {params:{points:[[80,180],[320,260],[560,180]],count:9,speed:2},time:2}],
  ['fibrin-mesh',{params:{density:.2},progress:.1},{params:{density:1},progress:1}],
  ['layered-tissue',{params:{thickness:.2}},{params:{thickness:.5}}],
  ['plaque-overlay',{params:{severity:.1}},{params:{severity:1}}],
  ['vessel-segment',{params:{kind:'capillary',narrowing:0,valve:false}},{params:{kind:'vein',narrowing:.7,valve:true}}]
];
for(const [id,a,b] of parameterVariants)assert.notEqual(M.render(id,a),M.render(id,b),id+' parameters do not affect artwork');
const attachedArrow=M.render('attachment-arrow',{params:{from:'inlet',to:'outlet',label:'Flow'},state:{attachments:{inlet:{x:100,y:190},outlet:{x:520,y:250}}}});
assert.ok(attachedArrow.includes('100')&&attachedArrow.includes('520')&&attachedArrow.includes('Flow'));
assert.throws(()=>M.discover('coccus'));
assert.equal(M.discover('bacterium-coccus').limitations,'Shape-only schematic; not a species or staining claim.');
assert.equal(M.search('pituitary gland')[0].id,'pituitary-gland');
assert.equal(M.search('',{category:'Endocrinology'}).length,2);
const alveolarPart=M.renderSVG('alveolus');
assert.equal((alveolarPart.match(/data-structure="alveolar-space"/g)||[]).length,10);
const batch=[{id:'pituitary-gland',options:{x:180,y:220,scale:.5}},{id:'clavicle',options:{x:320,y:220,scale:.45}},{id:'trachea',options:{x:480,y:220,scale:.45}}];
assert.ok(M.renderBatch(batch,3).startsWith('<g '));
assert.ok(M.renderBatchSVG(batch,3).startsWith('<svg '));
assert.throws(()=>M.renderBatch(batch,2));
// Composed scene checks exercise the explicit renderer context and offline export.
vm.runInThisContext(fs.readFileSync(path.join(root,'parts/scene-renderer.js'),'utf8'),{filename:'parts/scene-renderer.js'});
const Scene=globalThis.MedicalMotionScene;
assert.throws(()=>Scene.validate({version:2,title:'Missing dependency',caption:'x',duration:4,format:'landscape',theme:'clinical',components:[{id:'plaque-overlay'}]}));
const composedRoot=path.join(root,'examples','composed');
const composed=fs.readdirSync(composedRoot).filter(f=>f.endsWith('.json')).sort();
assert.equal(composed.length,3);
for(const file of composed){
  const scene=JSON.parse(fs.readFileSync(path.join(composedRoot,file),'utf8'));
  assert.doesNotThrow(()=>Scene.validate(scene));
  const a=Scene.renderSVG(scene,0),b=Scene.renderSVG(scene,scene.duration*.6);
  assert.ok(a.startsWith('<svg ')&&b.startsWith('<svg '));assert.notEqual(a,b);
  for(const format of ['portrait','square','landscape'])for(const theme of ['clinical','night']){
    const variant={...scene,format,theme},svg=Scene.renderSVG(variant,variant.duration*.35);
    assert.ok(!/NaN|Infinity|undefined|<script/i.test(svg));
  }
  const hostile={...scene,title:'<script>alert(1)</script>',caption:'<img src=x>'};
  assert.ok(!Scene.renderSVG(hostile,1).includes('<script>'));
  const html=Scene.standalone(scene,fs.readFileSync(path.join(root,'parts/medical-parts.js'),'utf8'));
  assert.ok(html.includes('MedicalMotionParts')&&html.includes('Replay')&&!/<script[^>]+src=/.test(html)&&!html.includes('fetch('));
}
const layoutScene=JSON.parse(fs.readFileSync(path.join(composedRoot,'vessel-narrowing-flow.json'),'utf8'));
const landscapeLayout=Scene.renderSVG({...layoutScene,format:'landscape'},layoutScene.duration*.5);
assert.ok(landscapeLayout.includes('x="24" y="160"'),'landscape art box must begin below the heading');
assert.ok(landscapeLayout.includes('translate(96 64) scale(1.7)'),'landscape local canvas must be centered and enlarged');
assert.ok((landscapeLayout.match(/font-size="22"/g)||[]).length>=1,'landscape captions must use the wrapped compact size');
// The maintained six-second clot example keeps the flow lane and clot inside the
// artery's local lumen. This is intentionally checked from the scene source, not by
// counting rendered instances.
const clotHtml=fs.readFileSync(path.join(root,'examples/generated/blood-clotting-inside-artery-6s.html'),'utf8');
const clotMatch=clotHtml.match(/\nconst scene=(\{[\s\S]*?\});\nconst host=/);
assert.ok(clotMatch,'generated clot example must expose its deterministic scene source');
const clotScene=JSON.parse(clotMatch[1]);
const clotVessel=clotScene.components.find(c=>c.id==='vessel-segment');
const clotFlow=clotScene.components.find(c=>c.id==='blood-flow');
const clotMesh=clotScene.components.find(c=>c.id==='fibrin-mesh');
assert.equal(clotVessel.options.params.narrowing,0);
assert.ok(clotFlow.options.params.points.every(([x,y])=>x>=60&&x<=580&&y>=190&&y<=250));
assert.equal(clotMesh.options.x,320);assert.equal(clotMesh.options.y,220);assert.ok(clotMesh.options.scale<=.3);
console.log(JSON.stringify({parts:37,contractVersion:2,deterministic:true,transforms:true,search:true,exactCountBatch:true,compositionExamples:3,invalidOptionsRejected:9},null,2));
