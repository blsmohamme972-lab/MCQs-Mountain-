/** Reusable parts engine and catalog tests. Run: node tests/parts_verify.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
vm.runInThisContext(fs.readFileSync(path.join(root,'parts/medical-parts.js'),'utf8'),{filename:'parts/medical-parts.js'});
const M=globalThis.MedicalMotionParts;
const catalog=JSON.parse(fs.readFileSync(path.join(root,'parts/catalog.json'),'utf8'));
assert.equal(M.list().length,20);
assert.equal(catalog.parts.length,20);
assert.deepEqual(catalog.parts.map(p=>p.id),M.list().map(p=>p.id));
for(const part of M.list()){
  assert.ok(part.category && part.anatomyLevel && part.role);
  assert.ok(part.keywords.length && part.aliases.length);
  for(const options of [{},{x:120,y:130,scale:.65,rotation:25,opacity:.8,accent:'teal'},{x:500,y:300,scale:1.4,accent:'gold'}]){
    const svg=M.renderSVG(part.id,options);
    assert.ok(svg.startsWith('<svg '));
    assert.ok(!/NaN|Infinity|undefined/.test(svg));
    assert.equal(svg,M.renderSVG(part.id,options));
    assert.ok(M.render(part.id,options).startsWith('<g '));
  }
}
for(const bad of [{scale:0},{scale:9},{opacity:-.1},{opacity:1.1},{x:NaN},{accent:'not-a-palette-key'},{unknown:1},null,[]])assert.throws(()=>M.validate(bad));
assert.equal(M.render('red-blood-cell',{x:100,y:90}).includes('translate(-220 -130)'),true);
console.log(JSON.stringify({parts:20,deterministic:true,transforms:true,invalidOptionsRejected:9},null,2));
