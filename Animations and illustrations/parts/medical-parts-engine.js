/* Medical Motion Parts v2.0.0 | Deterministic, dependency-free SVG components.
 * Generated classic bundle: definitions/medical.js + medical-parts-engine.js.
 * catalog.json is the authoritative metadata source.
 * The compact source map keeps runtime discovery offline and is checked against the
 * catalog by tests/builds. Existing render(id, {x,y,scale,rotation,opacity,accent})
 * calls remain valid.
 */
(function bootMedicalMotionParts(G){
  'use strict';
  const palette={
    ink:'#162d48', muted:'#526780', line:'#dbe5f0', blue:'#246bdd',
    red:'#cf4263', teal:'#087f8c', gold:'#986300', purple:'#7254b8',
    soft:'#eaf1fb', tissue:'#f8ddd6', paper:'#ffffff'
  };
  const themes={
    clinical:palette,
    night:{...palette,ink:'#f0f6ff',muted:'#b6c9e1',line:'#344a65',blue:'#80adff',red:'#ff89a1',teal:'#66d6d0',gold:'#ffd276',soft:'#203652',tissue:'#5f3843',paper:'#13243b'}
  };
  const sourceMap={
    'bacterium-coccus':['https://www.ncbi.nlm.nih.gov/books/NBK8406/'],
    'bacterium-bacillus':['https://www.ncbi.nlm.nih.gov/books/NBK8406/'],
    'bacterium-spirillum':['https://www.ncbi.nlm.nih.gov/books/NBK8406/'],
    'animal-cell':['https://openstax.org/books/biology-2e/pages/4-3-eukaryotic-cells'],
    'nucleus':['https://openstax.org/books/biology-2e/pages/4-4-the-nucleus-and-ribosomes'],
    'mitochondrion':['https://openstax.org/books/biology-2e/pages/4-4-the-nucleus-and-ribosomes'],
    'epithelial-cell':['https://openstax.org/books/anatomy-and-physiology-2e/pages/4-2-epithelial-tissue'],
    'cell-membrane':['https://openstax.org/books/biology-2e/pages/5-1-components-and-structure'],
    'dna-helix':['https://openstax.org/books/biology-2e/pages/14-2-dna-structure-and-sequencing'],
    'neuron':['https://openstax.org/books/anatomy-and-physiology-2e/pages/12-2-basic-structure-and-function-of-the-nervous-system'],
    'red-blood-cell':['https://openstax.org/books/anatomy-and-physiology-2e/pages/18-2-production-of-the-formed-elements'],
    'white-blood-cell':['https://openstax.org/books/anatomy-and-physiology-2e/pages/18-2-production-of-the-formed-elements'],
    'alveolus':['https://www.nhlbi.nih.gov/health/lungs/respiratory-system'],
    'artery-vessel':['https://openstax.org/books/anatomy-and-physiology-2e/pages/20-1-blood-flow-and-blood-pressure'],
    'receptor':['https://openstax.org/books/biology-2e/pages/9-1-signaling-molecules-and-cellular-receptors'],
    'synapse':['https://openstax.org/books/anatomy-and-physiology-2e/pages/12-4-the-action-potential'],
    'bone':['https://openstax.org/books/anatomy-and-physiology-2e/pages/6-3-bone-structure'],
    'scalpel':['https://www.ncbi.nlm.nih.gov/books/NBK519054/'],
    'syringe':['https://www.ncbi.nlm.nih.gov/books/NBK470404/'],
    'suture':['https://www.ncbi.nlm.nih.gov/books/NBK507908/'],
    'pituitary-gland':['https://www.ncbi.nlm.nih.gov/books/NBK279054/'],
    'clavicle':['https://openstax.org/books/anatomy-and-physiology-2e/pages/8-3-the-pectoral-girdle'],
    'trachea':['https://www.nhlbi.nih.gov/health/lungs/respiratory-system'],
    'thyroid-gland':['https://www.ncbi.nlm.nih.gov/books/NBK279388/'],
    'brainstem':['https://openstax.org/books/anatomy-and-physiology-2e/pages/12-2-basic-structure-and-function-of-the-nervous-system'],
    'vessel-segment':['https://openstax.org/books/anatomy-and-physiology-2e/pages/20-1-blood-flow-and-blood-pressure'],
    'blood-flow':['https://openstax.org/books/anatomy-and-physiology-2e/pages/20-2-blood-flow-blood-pressure-and-resistance'],
    'attachment-arrow':['https://openstax.org/books/anatomy-and-physiology-2e/pages/20-1-blood-flow-and-blood-pressure'],
    'attachment-label':['https://openstax.org/books/anatomy-and-physiology-2e/pages/20-1-blood-flow-and-blood-pressure'],
    'platelet':['https://openstax.org/books/anatomy-and-physiology-2e/pages/18-5-hemostasis'],
    'fibrin-mesh':['https://openstax.org/books/anatomy-and-physiology-2e/pages/18-5-hemostasis'],
    'layered-tissue':['https://openstax.org/books/anatomy-and-physiology-2e/pages/4-2-epithelial-tissue'],
    'fibroblast':['https://www.ncbi.nlm.nih.gov/books/NBK470443/'],
    'macrophage':['https://openstax.org/books/anatomy-and-physiology-2e/pages/21-2-barriers-and-defenses'],
    'plaque-overlay':['https://www.nhlbi.nih.gov/health/atherosclerosis'],
    'heart':['https://openstax.org/books/anatomy-and-physiology-2e/pages/19-1-heart-anatomy'],
    'nephron':['https://openstax.org/books/anatomy-and-physiology-2e/pages/25-1-the-urinary-system'],
  };
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const el=(tag,attrs={},children='')=>'<'+tag+' '+Object.entries(attrs).map(([k,v])=>k+'="'+escape(v)+'"').join(' ')+'>'+children+'</'+tag+'>';
  const circle=(x,y,r,fill,extra={})=>el('circle',{cx:x,cy:y,r,fill,...extra});
  const ellipse=(x,y,rx,ry,fill,extra={})=>el('ellipse',{cx:x,cy:y,rx,ry,fill,...extra});
  const rect=(x,y,w,h,fill,r=16,extra={})=>el('rect',{x,y,width:w,height:h,rx:r,fill,...extra});
  const line=(x1,y1,x2,y2,stroke,width=4,extra={})=>el('line',{x1,y1,x2,y2,stroke,'stroke-width':width,'stroke-linecap':'round',...extra});
  const path=(d,stroke,width=4,fill='none',extra={})=>el('path',{d,stroke,'stroke-width':width,fill,'stroke-linecap':'round','stroke-linejoin':'round',...extra});
  const polygon=(points,fill,extra={})=>el('polygon',{points,fill,...extra});
  const move=(points,fraction)=>{
    const clean=Array.isArray(points)?points:[], lengths=clean.slice(1).map((q,i)=>Math.hypot(q[0]-clean[i][0],q[1]-clean[i][1]));
    let d=clamp(fraction)*lengths.reduce((a,b)=>a+b,0);
    for(let i=0;i<lengths.length;i++){if(d<=lengths[i]||i===lengths.length-1){const u=lengths[i]?d/lengths[i]:0;return [clean[i][0]+(clean[i+1][0]-clean[i][0])*u,clean[i][1]+(clean[i+1][1]-clean[i][1])*u];}d-=lengths[i];}
    return clean[0]||[320,220];
  };
  const arrow=(x1,y1,x2,y2,stroke,width=4)=>{
    const a=Math.atan2(y2-y1,x2-x1),n=11;
    return line(x1,y1,x2,y2,stroke,width)+path('M '+(x2-n*Math.cos(a-.5))+' '+(y2-n*Math.sin(a-.5))+' L '+x2+' '+y2+' L '+(x2-n*Math.cos(a+.5))+' '+(y2-n*Math.sin(a+.5)),stroke,width);
  };
  const text=(x,y,value,fill=palette.ink,size=18,anchor='middle',weight=650)=>el('text',{x,y,fill,'font-size':size,'text-anchor':anchor,'font-weight':weight},escape(value));
  const color=key=>palette[palette[key]?key:'blue'];
  const allowed=new Set(['x','y','scale','rotation','opacity','accent','theme','params','state','time','progress']);
  const defaults={x:320,y:220,scale:1,rotation:0,opacity:1,accent:'blue',theme:'clinical',params:{},state:{},time:0,progress:0};
  function validateOptions(input={}){
    if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Part options must be an object.');
    for(const key of Object.keys(input))if(!allowed.has(key))throw new Error('Unknown part option: '+key);
    const o={...defaults,...input,params:input.params===undefined?{}:input.params,state:input.state===undefined?{}:input.state};
    if(!Number.isFinite(o.x)||!Number.isFinite(o.y))throw new Error('x and y must be finite numbers.');
    if(!Number.isFinite(o.scale)||o.scale<=0||o.scale>8)throw new Error('scale must be between 0 and 8.');
    if(!Number.isFinite(o.rotation))throw new Error('rotation must be finite.');
    if(!Number.isFinite(o.opacity)||o.opacity<0||o.opacity>1)throw new Error('opacity must be between 0 and 1.');
    if(!Object.hasOwn(palette,o.accent))throw new Error('accent must be a palette key.');
    if(!['clinical','night'].includes(o.theme))throw new Error('theme must be clinical or night.');
    if(!Number.isFinite(o.time)||o.time<0)throw new Error('time must be a non-negative finite number.');
    if(!Number.isFinite(o.progress)||o.progress<0||o.progress>1)throw new Error('progress must be between 0 and 1.');
    if(!o.params||typeof o.params!=='object'||Array.isArray(o.params))throw new Error('params must be an object.');
    if(!o.state||typeof o.state!=='object'||Array.isArray(o.state))throw new Error('state must be an object.');
    return o;
  }
  const registry=new Map();
  function register(def){
    if(!def||!/^[a-z][a-z0-9-]+$/.test(def.id)||typeof def.render!=='function')throw new Error('Invalid part definition.');
    if(registry.has(def.id))throw new Error('Duplicate part: '+def.id);
    def.version=def.version||2;
    def.sources=def.sources||sourceMap[def.id]||[];
    def.source=def.sources;
    def.dependencies=Array.isArray(def.dependencies)?def.dependencies:[];
    def.attachments=def.attachments||{center:{x:320,y:220}};
    def.bounds=def.bounds||{x:0,y:0,width:640,height:440};
    def.parameterSchema=def.parameterSchema||{};
    def.stateSchema=def.stateSchema||{time:{type:'number',min:0},progress:{type:'number',min:0,max:1}};
    registry.set(def.id,def);
  }
  function validateParams(def,params){
    for(const key of Object.keys(params||{}))if(!Object.hasOwn(def.parameterSchema||{},key))throw new Error(def.id+'.'+key+' is not a declared parameter.');
    const p={...(def.defaults||{}),...(params||{})};
    for(const [key,s] of Object.entries(def.parameterSchema||{})){
      const v=p[key];
      if(s.type==='number' && (typeof v!=='number'||!Number.isFinite(v)||v<s.min||v>s.max))throw new Error(def.id+'.'+key+' must be between '+s.min+' and '+s.max+'.');
      if(s.type==='integer' && (!Number.isInteger(v)||v<s.min||v>s.max))throw new Error(def.id+'.'+key+' must be an integer between '+s.min+' and '+s.max+'.');
      if(s.type==='enum' && !s.values.includes(v))throw new Error(def.id+'.'+key+' must be one of '+s.values.join(', ')+'.');
      if(s.type==='boolean' && typeof v!=='boolean')throw new Error(def.id+'.'+key+' must be boolean.');
      if(s.type==='string' && (typeof v!=='string'||v.length>s.maxLength))throw new Error(def.id+'.'+key+' must be a string.');
      if(s.type==='polyline' && (!Array.isArray(v)||v.length<2||v.some(q=>!Array.isArray(q)||q.length!==2||q.some(n=>!Number.isFinite(n)))))throw new Error(def.id+'.'+key+' must be a numeric polyline.');
    }
    return p;
  }
  function validateState(def,state){
    const s=state||{};
    for(const key of Object.keys(s))if(!Object.hasOwn(def.stateSchema||{},key)&&!['attachments','sceneIndex'].includes(key))throw new Error(def.id+'.'+key+' is not a declared state field.');
    for(const [key,descriptor] of Object.entries(def.stateSchema||{})){
      if(s[key]===undefined)continue;
      const v=s[key];
      if(descriptor.type==='number' && (typeof v!=='number'||!Number.isFinite(v)||v<descriptor.min||(descriptor.max!==undefined&&v>descriptor.max)))throw new Error(def.id+'.'+key+' is outside its state range.');
      if(descriptor.type==='integer' && (!Number.isInteger(v)||v<descriptor.min||(descriptor.max!==undefined&&v>descriptor.max)))throw new Error(def.id+'.'+key+' is outside its state range.');
    }
    if(s.sceneIndex!==undefined&&(!Number.isInteger(s.sceneIndex)||s.sceneIndex<0))throw new Error(def.id+'.sceneIndex must be a non-negative integer.');
    if(s.attachments!==undefined){
      if(!s.attachments||typeof s.attachments!=='object'||Array.isArray(s.attachments))throw new Error(def.id+'.attachments must be an object.');
      for(const [name,point] of Object.entries(s.attachments))if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))throw new Error(def.id+'.attachments.'+name+' must contain finite x and y.');
    }
    return s;
  }
  if(typeof G.MedicalMotionPartDefinitions!=='function')throw new Error('Medical Motion definitions are not loaded.');
  G.MedicalMotionPartDefinitions(register,{circle,ellipse,rect,line,path,move,arrow,text});

  const meta=d=>{const {render,...m}=d;return JSON.parse(JSON.stringify(m));};
  function search(query='',filters={}){
    if(typeof query!=='string')throw new Error('search query must be a string.');
    const allowedFilters=new Set(['category','anatomyLevel','role']);
    for(const key of Object.keys(filters||{}))if(!allowedFilters.has(key))throw new Error('Unknown search filter: '+key);
    const q=query.trim().toLowerCase();
    return Array.from(registry.values(),meta).filter(d=>{
      const hay=[d.id,d.title,d.description,d.category,d.anatomyLevel,d.role,...d.keywords,...d.aliases].join(' ').toLowerCase();
      return (!q||hay.includes(q))&&Object.entries(filters||{}).every(([k,v])=>!v||d[k]===v);
    });
  }
  function renderBatch(specs,expectedCount,context={}){
    if(!Array.isArray(specs)||!specs.length)throw new Error('renderBatch requires at least one part.');
    if(expectedCount!==undefined&&(!Number.isInteger(expectedCount)||expectedCount<1||specs.length!==expectedCount))throw new Error('Requested '+expectedCount+' parts but received '+specs.length+'.');
    return specs.map((spec,i)=>{
      if(!spec||typeof spec!=='object'||typeof spec.id!=='string')throw new Error('Batch item '+i+' must contain a part id.');
      return render(spec.id,spec.options||{},context);
    }).join('');
  }
  function renderBatchSVG(specs,expectedCount,context={}){
    const clean=Array.isArray(specs)?specs:[];
    const titles=clean.map(spec=>get(spec.id).title).join(', ');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 440" role="img" aria-label="'+escape('Medical parts: '+titles)+'" style="font-family:system-ui,-apple-system,Segoe UI,sans-serif">'+el('title',{},'Medical parts batch')+el('desc',{},escape(titles))+rect(0,0,640,440,palette.paper,0)+renderBatch(clean,expectedCount,context)+'</svg>';
  }
  function get(id){const d=registry.get(id);if(!d)throw new Error('Unknown partId: '+id);return d;}
  function render(id,options={},context={}){
    const d=get(id),o=validateOptions(options),o2={...o,params:validateParams(d,o.params),state:validateState(d,o.state)},C={...themes[o.theme],accent:themes[o.theme][o.accent]};
    const raw=String(d.render(o2,C,{...context,part:d,attachments:d.attachments,theme:o.theme}));
    // Accent is a real colour channel. Legacy definitions used red/blue directly, so map
    // those primary strokes to the requested accent while retaining neutral detail colours.
    const accent=o2.accent, painted=o.accent==='blue'?raw:raw.replaceAll(themes[o.theme].blue,accent).replaceAll(themes[o.theme].red,accent);
    return '<g data-part-id="'+escape(id)+'" data-part-version="'+d.version+'" data-accent="'+escape(o.accent)+'" transform="translate('+(o.x-320)+' '+(o.y-220)+') rotate('+o.rotation+' 320 220) translate(320 220) scale('+o.scale+') translate(-320 -220)" opacity="'+o.opacity+'">'+painted+'</g>';
  }
  function renderSVG(id,options={},context={}){
    const o=validateOptions(options),d=get(id),C=themes[o.theme];
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 440" role="img" aria-label="'+escape(d.title)+'" style="font-family:system-ui,-apple-system,Segoe UI,sans-serif">'+el('title',{},d.title)+el('desc',{},d.description+' '+d.limitations)+rect(0,0,640,440,C.paper,0)+render(id,o,context)+'</svg>';
  }
  function createRenderer(context={}){
    return {render:(id,options={})=>render(id,options,context),renderSVG:(id,options={})=>renderSVG(id,options,context),renderBatch:(specs,count)=>renderBatch(specs,count,context),renderBatchSVG:(specs,count)=>renderBatchSVG(specs,count,context),get,search};
  }
  function discovery(id){
    const d=get(id);
    return {id:d.id,version:d.version,title:d.title,description:d.description,sources:d.sources,limitations:d.limitations,dependencies:d.dependencies,attachments:d.attachments,bounds:d.bounds,parameterSchema:d.parameterSchema,stateSchema:d.stateSchema};
  }
  G.MedicalMotionParts=Object.freeze({
    version:'2.0.0',contractVersion:2,palette,register,get,
    list:()=>Array.from(registry.values(),meta),
    discover:discovery,search,validate:validateOptions,validateParams,validateState,render,renderSVG,renderBatch,renderBatchSVG,createRenderer
  });
})(globalThis);
