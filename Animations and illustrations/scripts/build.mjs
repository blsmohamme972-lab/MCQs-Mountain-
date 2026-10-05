/** Build and validate the offline medical-illustration library.
 *
 * `library.manifest.json` is the inventory authority. Catalogs, schemas, classic
 * bundles, explicit browser loaders and checked-in examples are derived surfaces;
 * `--check` makes drift fail without rewriting anything.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const check=process.argv.includes('--check');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const json=file=>JSON.parse(read(file));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fail=message=>{throw new Error('[library build] '+message);};
function walk(dir){
  const absolute=path.join(root,dir),out=[];
  for(const entry of fs.readdirSync(absolute,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const rel=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...walk(rel));
    else if(entry.isFile()&&entry.name.endsWith('.js'))out.push(rel.replaceAll(path.sep,'/'));
  }
  return out;
}
function update(file,value){
  const current=fs.existsSync(path.join(root,file))?read(file):null;
  if(check){if(current!==value)fail('stale generated file: '+file);}
  else {fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),value);}
}
function manifestSubset(record){
  const {sourceLinks,selection,...rest}=record; return rest;
}

const manifest=json('library.manifest.json');
if(manifest.version!==1||manifest.authority!=='library.manifest.json')fail('invalid manifest authority/version.');
const templateIds=manifest.templates.map(x=>x.id),partIds=manifest.parts.map(x=>x.id);
if(new Set(templateIds).size!==templateIds.length)fail('duplicate template IDs in manifest.');
if(new Set(partIds).size!==partIds.length)fail('duplicate part IDs in manifest.');
if(manifest.counts.templates!==templateIds.length||manifest.counts.parts!==partIds.length)fail('manifest counts do not match inventory.');
if(manifest.counts.templates!==35||manifest.counts.parts!==37)fail('stable inventory changed: expected 35 templates and 37 parts.');

const templateFiles=walk('templates');
const expectedTemplateFiles=manifest.templates.map(x=>x.file);
if(!same(templateFiles,expectedTemplateFiles))fail('manifest template files differ from templates/*.js.');
const definitionFiles=walk('parts/definitions');
if(!definitionFiles.length)fail('no part definition modules found.');

const idsFromSource=[];
for(const file of definitionFiles){
  const source=read(file);
  for(const m of source.matchAll(/\bid\s*:\s*'([a-z][a-z0-9-]+)'/g))idsFromSource.push(m[1]);
}
if(new Set(idsFromSource).size!==idsFromSource.length)fail('duplicate part IDs in definition modules.');

const partDefinitionSource=definitionFiles.map((file)=>`/* source: ${file} */\n${read(file)}\n/* collected definition module: ${file} */\nif(typeof globalThis.MedicalMotionPartDefinitions==='function'&&!globalThis.MedicalMotionPartDefinitionModules.includes(globalThis.MedicalMotionPartDefinitions))globalThis.MedicalMotionPartDefinitionModules.push(globalThis.MedicalMotionPartDefinitions);`).join('\n');
const partEngineSource=read('parts/medical-parts-engine.js');
const definitionHash=sha(partDefinitionSource),engineHash=sha(partEngineSource);
const bundle='/* Generated classic bundle. Do not edit.\n * Inputs: '+definitionFiles.join(', ')+' + parts/medical-parts-engine.js\n * definition-sha256: '+definitionHash+'\n * engine-sha256: '+engineHash+'\n */\nglobalThis.MedicalMotionPartDefinitionModules=[];\n'+partDefinitionSource+'\n'+partEngineSource+'\n';
update('parts/medical-parts.js',bundle);
const partContext={console};vm.createContext(partContext);vm.runInContext(bundle,partContext,{filename:'parts/medical-parts.js'});
const Parts=partContext.MedicalMotionParts;
if(!Parts)fail('classic part bundle did not expose MedicalMotionParts.');
const runtimePartIds=Parts.list().map(x=>x.id);
if(!same(runtimePartIds,partIds))fail('manifest part IDs differ from registered runtime IDs.');
for(const p of manifest.parts){
  const runtime=Parts.discover(p.id);
  for(const key of ['id','version','category','anatomyLevel','role','title','description','keywords','aliases','limitations','dependencies','attachments','bounds','parameterSchema','stateSchema']){
    if(!same(runtime[key],p[key]))fail('manifest/runtime mismatch for part '+p.id+' field '+key+'.');
  }
}
const partsCatalog=json('parts/catalog.json');
if(!same(partsCatalog.parts.map(x=>x.id),partIds))fail('parts/catalog.json IDs drift from manifest.');
for(const p of manifest.parts){
  const catalog=partsCatalog.parts.find(x=>x.id===p.id);
  if(!catalog||!same(catalog,manifestSubset(p)))fail('parts/catalog.json metadata drift for '+p.id+'.');
}

const templateSources=['core/medical-motion.js',...templateFiles];
const templateContext={console};vm.createContext(templateContext);
for(const file of templateSources)vm.runInContext(read(file),templateContext,{filename:file});
const Motion=templateContext.MedicalMotion;
if(!Motion)fail('template runtime did not expose MedicalMotion.');
const runtimeTemplates=Motion.list();
if(!same(runtimeTemplates.map(x=>x.id),templateIds))fail('manifest/template runtime IDs differ.');
for(const p of manifest.templates){
  const runtime=Motion.get(p.id),catalog=catalogTemplate(p.id);
  for(const key of ['id','category','title','description','keywords','limitations','sources','parameterSchema','labels']){
    const expected=key==='sources'?p.sourceLinks:p[key];
    if(expected!==undefined&&!same(runtime[key],expected))fail('manifest/runtime mismatch for template '+p.id+' field '+key+'.');
  }
  if(!catalog||!same(catalog,{id:p.id,file:p.file,category:p.category,keywords:p.keywords,example:p.example}))fail('catalog metadata drift for template '+p.id+'.');
  if(!fs.existsSync(path.join(root,p.example)))fail('missing template example '+p.example+'.');
}
function catalogTemplate(id){return json('catalog.json').templates.find(x=>x.id===id);}
const catalog=json('catalog.json');
if(!same(catalog.templates.map(x=>x.id),templateIds))fail('catalog template IDs drift from manifest.');
if(!same(catalog.composedExamples,manifest.composedExamples))fail('composed example inventory drift.');
const schema=json('scene.schema.json');
if(!same(schema.properties.templateId.enum,templateIds))fail('scene.schema.json template enum drift.');
const composedSchema=json('parts/composed-scene.schema.json');
if(!composedSchema.properties.connections||!composedSchema.properties.components.items.properties.instanceId)fail('composed-scene.schema.json lacks instance and connection contract.');
const index=read('index.html');
const loader=[...index.matchAll(/<script src="(templates\/[^"]+\.js)"><\/script>/g)].map(m=>m[1]);
if(!same(loader,expectedTemplateFiles))fail('index.html explicit template loader drift.');
if(!index.includes(`${templateIds.length} TEMPLATE MODULES / ${partIds.length} REUSABLE PARTS`))fail('visible inventory badge drift.');
const partsIndex=read('parts/index.html');
if(!partsIndex.includes('data-library-count="'+partIds.length+'"'))fail('visible parts count drift.');
for(const expected of [templateIds.length,partIds.length]){
  const countInTests=(read('tests/verify.mjs')+read('tests/parts_verify.mjs')).includes(String(expected));
  if(!countInTests)fail('tests do not state expected inventory count '+expected+'.');
}

const sceneRendererSource=read('parts/scene-renderer.js');
const sceneContext={console};vm.createContext(sceneContext);vm.runInContext(bundle,sceneContext,{filename:'parts/medical-parts.js'});vm.runInContext(sceneRendererSource,sceneContext,{filename:'parts/scene-renderer.js'});
const Scene=sceneContext.MedicalMotionScene;
if(!Scene)fail('scene renderer did not expose MedicalMotionScene.');
const composedRoot=path.join(root,'examples','composed');
const composedJson=fs.readdirSync(composedRoot).filter(f=>f.endsWith('.json')).sort();
if(!same(composedJson,manifest.composedExamples.map(x=>path.basename(x.source||x)))){
  const expected=manifest.composedExamples.map(x=>path.basename(typeof x==='string'?x:x.source)).sort();
  if(!same(composedJson,expected))fail('composed JSON inventory drift.');
}
for(const file of composedJson){
  const sourceText=fs.readFileSync(path.join(composedRoot,file),'utf8');
  const source=JSON.parse(sourceText);
  Scene.validate(source);
  const html=Scene.standalone(source,bundle);
  const provenance='<!-- generated-from: examples/composed/'+file+'; source-sha256: '+sha(sourceText)+' -->\n';
  update('examples/composed/'+file.replace(/\.json$/i,'.html'),provenance+html);
}

const clotSourceFile='examples/generated/blood-clotting-inside-artery-6s.json';
const clotOutputFile='examples/generated/blood-clotting-inside-artery-6s.html';
const clotSource=JSON.parse(read(clotSourceFile));Scene.validate(clotSource);
const clotTemplateFile='examples/generated/blood-clotting-inside-artery-6s.source.html';
if(!fs.existsSync(path.join(root,clotTemplateFile)))fail('missing clot HTML source template.');
const clotTemplate=read(clotTemplateFile),clotJson=JSON.stringify(clotSource);
const clotMarker='<!-- generated-from: '+clotSourceFile+'; source-sha256: '+sha(read(clotSourceFile))+' -->';
const clotHtml=clotTemplate.replaceAll('__SOURCE_MARKER__',clotMarker).replace('__SCENE_JSON__',clotJson.replace(/</g,'\\u003c')).replace('__PARTS_BUNDLE__',()=>bundle).replace('__SCENE_RENDERER__',()=>sceneRendererSource);
update(clotOutputFile,clotHtml);

// Build the ignored portable outputs in memory and verify them in --check mode.
const out='dist';
const studio=read('index.html').replace(/<script src="([^"]+)"><\/script>/g,(_,file)=>'<script>\n'+read(file).replace(/<\/script/gi,'<\\/script')+'\n</script>');
update(out+'/medical-template-studio.html',studio);
const partsIndexOutput=partsIndex.replace('<script src="medical-parts.js"></script>','<script>\n'+bundle.replace(/<\/script/gi,'<\\/script')+'\n</script>');
update(out+'/parts/index.html',partsIndexOutput);update(out+'/parts/catalog.json',read('parts/catalog.json'));update(out+'/parts/schema.json',read('parts/schema.json'));
for(const d of runtimeTemplates)update(out+'/templates/'+d.id+'.html',Motion.standalone(Motion.defaultConfig(d.id)));
update(out+'/full-catalog.json',JSON.stringify({version:1,manifest:'library.manifest.json',templates:runtimeTemplates.map(d=>({...d,defaultConfig:Motion.defaultConfig(d.id)}))},null,2)+'\n');
for(const file of composedJson){
  const sourceText=fs.readFileSync(path.join(composedRoot,file),'utf8');
  const source=JSON.parse(sourceText);
  const provenance='<!-- generated-from: examples/composed/'+file+'; source-sha256: '+sha(sourceText)+' -->\n';
  update(out+'/composed/'+file.replace(/\.json$/i,'.html'),provenance+Scene.standalone(source,bundle));
}
console.log(JSON.stringify({checked:true,templates:templateIds.length,parts:partIds.length,definitions:definitionFiles.length,composedScenes:composedJson.length,bundleSha256:sha(bundle),mode:check?'check':'write'},null,2));
