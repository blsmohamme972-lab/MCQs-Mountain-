/** Inventory, provenance and generated-output consistency checks. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');const json=f=>JSON.parse(read(f));
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const manifest=json('library.manifest.json');assert.equal(manifest.authority,'library.manifest.json');
assert.deepEqual(manifest.counts,{templates:35,parts:37,composedExamples:3});
assert.deepEqual(json('catalog.json').templates.map(x=>x.id),manifest.templates.map(x=>x.id));
assert.deepEqual(json('parts/catalog.json').parts.map(x=>x.id),manifest.parts.map(x=>x.id));
assert.deepEqual(json('scene.schema.json').properties.templateId.enum,manifest.templates.map(x=>x.id));
const composedSchema=json('parts/composed-scene.schema.json');assert.ok(composedSchema.properties.connections&&composedSchema.properties.components.items.properties.instanceId);
const bundle=read('parts/medical-parts.js');assert.match(bundle,/Generated classic bundle/);assert.match(bundle,/definition-sha256: [0-9a-f]{64}/);assert.match(bundle,/engine-sha256: [0-9a-f]{64}/);
for(const file of manifest.composedExamples.map(x=>x.source||x)){
 const name=path.basename(file),source=read('examples/composed/'+name),html=read('examples/composed/'+name.replace('.json','.html'));
 assert.match(html,new RegExp('generated-from: examples/composed/'+name));assert.match(html,new RegExp('source-sha256: '+sha(source)));
 assert.ok(!/<script[^>]+src=/.test(html)&&!html.includes('fetch('));
}
const source='examples/generated/blood-clotting-inside-artery-6s.json',output='examples/generated/blood-clotting-inside-artery-6s.html';
const sourceText=read(source),outputText=read(output);assert.match(outputText,new RegExp('generated-from: '+source+'; source-sha256: '+sha(sourceText)));assert.ok(fs.existsSync(path.join(root,'examples/generated/blood-clotting-inside-artery-6s.source.html')));assert.match(outputText,/const scene=\{[\s\S]*?\};\nconst host=/);
const generatedScene=JSON.parse(outputText.match(/const scene=(\{\"version\":2,[\s\S]*?\});\nconst host=/)[1]);assert.deepEqual(generatedScene,json(source));
console.log(JSON.stringify({manifest:true,templateCount:35,partCount:37,generatedExamples:4,provenance:true},null,2));
