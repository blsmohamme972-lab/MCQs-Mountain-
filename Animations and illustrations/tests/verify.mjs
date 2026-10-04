/** Dependency-free engine and configuration tests. Run: node tests/verify.mjs */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
for(const file of ['core/medical-motion.js',...fs.readdirSync(path.join(root,'templates')).filter(f=>f.endsWith('.js')).sort().map(f=>'templates/'+f)]) vm.runInThisContext(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
const M=globalThis.MedicalMotion;assert.equal(M.list().length,10);let frames=0,invalid=0;
for(const d of M.list()){
 const original=M.defaultConfig(d.id),c=M.validate(original);assert.deepEqual(c,original);
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'examples',d.id+'.json'),'utf8')),original);
 assert.ok(d.sources.length && d.limitations.length>25);assert.equal(d.stages.length,3);
 for(const format of ['portrait','square','landscape'])for(const theme of ['clinical','night'])for(const p of [0,.125,.25,.5,.75,.9,1]){
  const config={...c,format,theme},svg=M.renderSVG(config,p*c.duration);frames++;
  assert.ok(svg.startsWith('<svg '));assert.ok(!/NaN|Infinity|undefined/.test(svg));assert.equal(svg,M.renderSVG(config,p*c.duration));
 }
 for(const [key,s] of Object.entries(d.parameterSchema)){
  for(const value of s.type==='enum'?s.values:[s.min,s.max]){
   const config={...c,params:{...c.params,[key]:value}};assert.doesNotThrow(()=>M.validate(config));
   for(const p of [0,.3,.6,1]){assert.ok(!/NaN|Infinity|undefined/.test(M.renderSVG(config,p*c.duration)));frames++;}
  }
  for(const value of s.type==='enum'?['invalid',null]:[s.min-1,s.max+1,NaN,Infinity,'1',null]){assert.throws(()=>M.validate({...c,params:{...c.params,[key]:value}}));invalid++;}
 }
 const html=M.standalone(c);assert.ok(!/<script[^>]+src=/.test(html));assert.ok(html.includes('MedicalMotion.register'));
 // Re-evaluate serialized renderer in a fresh context: no hidden template closures.
 const isolated=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(root,'core/medical-motion.js'),'utf8'),isolated);
 const {render,...data}=d;vm.runInContext('MedicalMotion.register(Object.assign('+JSON.stringify(data)+',{render:'+M.get(d.id).render.toString()+'}));',isolated);
 const svg=vm.runInContext('MedicalMotion.renderSVG('+JSON.stringify(c)+',3)',isolated);assert.equal(svg,M.renderSVG(c,3));
}
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'catalog.json'),'utf8')).templates.map(d=>d.id),M.list().map(d=>d.id));
const c=M.defaultConfig('vessel-flow');
for(const bad of [{...c,duration:0},{...c,duration:'6'},{...c,version:2},{...c,theme:'__proto__'},{...c,params:{foo:1}},{...c,labels:{foo:'X'}},{...c,title:''},{...c,title:'A'.repeat(73)},{...c,format:'bad'},JSON.parse('{"templateId":"vessel-flow","__proto__":{}}'),null,[]]){assert.throws(()=>M.validate(bad));invalid++;}
const hostile={...c,title:'<script>alert(1)</script>',caption:'</script><img src=x onerror=alert(1)>'};
assert.ok(!M.renderSVG(hostile).includes('<script>'));assert.ok(!M.standalone(hostile).includes('<img src=x'));
assert.throws(()=>M.renderSVG(c,NaN));assert.equal(M.renderSVG(c,-2),M.renderSVG(c,0));assert.equal(M.renderSVG(c,99),M.renderSVG(c,c.duration));
console.log(JSON.stringify({templates:10,frames,invalidConfigurationsRejected:invalid,deterministic:true,closureIsolation:true},null,2));
