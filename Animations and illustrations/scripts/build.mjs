/** Optional development/export command: node scripts/build.mjs (Node 18+). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const partDefinitionsSource=fs.readFileSync(path.join(root,'parts','definitions','medical.js'),'utf8');
const partEngineSource=fs.readFileSync(path.join(root,'parts','medical-parts-engine.js'),'utf8');
const partBundleSource=partDefinitionsSource+'\n'+partEngineSource;
// Keep the long-standing classic entry point as a reproducible offline bundle while
// keeping individual renderers separate from the registry/engine source.
fs.writeFileSync(path.join(root,'parts','medical-parts.js'),partBundleSource);
const scripts=['core/medical-motion.js',...fs.readdirSync(path.join(root,'templates')).filter(f=>f.endsWith('.js')).sort().map(f=>'templates/'+f)];
for(const file of scripts)vm.runInThisContext(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
const M=globalThis.MedicalMotion,out=path.join(root,'dist');fs.mkdirSync(path.join(out,'templates'),{recursive:true});
const index=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script src="([^"]+)"><\/script>/g,(_,file)=>'<script>\n'+fs.readFileSync(path.join(root,file),'utf8').replace(/<\/script/gi,'<\\/script')+'\n</script>');
fs.writeFileSync(path.join(out,'medical-template-studio.html'),index);
fs.mkdirSync(path.join(out,'parts'),{recursive:true});
const partsIndex=fs.readFileSync(path.join(root,'parts','index.html'),'utf8').replace('<script src="medical-parts.js"></script>','<script>\n'+partBundleSource.replace(/<\/script/gi,'<\\/script')+'\n</script>');
fs.writeFileSync(path.join(out,'parts','index.html'),partsIndex);
fs.copyFileSync(path.join(root,'parts','catalog.json'),path.join(out,'parts','catalog.json'));
fs.copyFileSync(path.join(root,'parts','schema.json'),path.join(out,'parts','schema.json'));
for(const d of M.list())fs.writeFileSync(path.join(out,'templates',d.id+'.html'),M.standalone(M.defaultConfig(d.id)));
fs.writeFileSync(path.join(out,'full-catalog.json'),JSON.stringify({version:1,templates:M.list().map(d=>({...d,defaultConfig:M.defaultConfig(d.id)}))},null,2)+'\n');
// Composed scenes inline the parts engine and scene renderer so file:// opening has no
// missing globals, runtime fetches or external assets.
vm.runInThisContext(partBundleSource,{filename:'parts/medical-parts.js'});
vm.runInThisContext(fs.readFileSync(path.join(root,'parts','scene-renderer.js'),'utf8'),{filename:'parts/scene-renderer.js'});
const sceneRenderer=globalThis.MedicalMotionScene,partsSource=partBundleSource;
const composedOut=path.join(out,'composed');fs.mkdirSync(composedOut,{recursive:true});
const composedRoot=path.join(root,'examples','composed');
for(const file of fs.readdirSync(composedRoot).filter(f=>f.endsWith('.json')).sort()){
  const scene=JSON.parse(fs.readFileSync(path.join(composedRoot,file),'utf8'));
  fs.writeFileSync(path.join(composedOut,file.replace(/\.json$/i,'.html')),sceneRenderer.standalone(scene,partsSource));
}
console.log('Built offline studio, 35 independent HTML scenes, 3 composed HTML scenes, searchable parts gallery and full metadata in dist/.');

