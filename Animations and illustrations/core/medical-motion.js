/* Medical Motion v1.0.0 | Dependency-free, deterministic SVG template engine. */
(function bootMedicalMotion(G) {
  'use strict';
  const registry = new Map();
  const themes = {
    clinical: { bg:'#f3f7fc', paper:'#ffffff', ink:'#162d48', muted:'#526780', line:'#dbe5f0', blue:'#246bdd', red:'#cf4263', teal:'#087f8c', gold:'#986300', soft:'#eaf1fb', tissue:'#f8ddd6' },
    night: { bg:'#0b1526', paper:'#13243b', ink:'#f0f6ff', muted:'#b6c9e1', line:'#344a65', blue:'#80adff', red:'#ff89a1', teal:'#66d6d0', gold:'#ffd276', soft:'#203652', tissue:'#5f3843' }
  };
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone = obj => JSON.parse(JSON.stringify(obj));
  const clamp = (v,a=0,b=1) => Math.max(a,Math.min(b,v));
  const el = (tag,attrs={},children='') => '<'+tag+' '+Object.entries(attrs).map(([k,v])=>k+'="'+escape(v)+'"').join(' ')+'>'+children+'</'+tag+'>';
  const text = (x,y,value,color,size=22,anchor='middle',weight=600) => el('text',{x,y,fill:color,'font-size':size,'text-anchor':anchor,'font-weight':weight},escape(value));
  const path = (d,color,width=4,fill='none',extra={}) => el('path',{d,stroke:color,'stroke-width':width,fill,'stroke-linecap':'round','stroke-linejoin':'round',...extra});
  const circle = (x,y,r,fill,extra={}) => el('circle',{cx:x,cy:y,r,fill,...extra});
  const rect = (x,y,w,h,fill,r=16,extra={}) => el('rect',{x,y,width:w,height:h,rx:r,fill,...extra});
  const line = (x1,y1,x2,y2,color,width=4,extra={}) => el('line',{x1,y1,x2,y2,stroke:color,'stroke-width':width,'stroke-linecap':'round',...extra});
  function arrow(x1,y1,x2,y2,color,width=4) {
    const a=Math.atan2(y2-y1,x2-x1), n=11;
    return line(x1,y1,x2,y2,color,width)+path('M '+(x2-n*Math.cos(a-.5))+' '+(y2-n*Math.sin(a-.5))+' L '+x2+' '+y2+' L '+(x2-n*Math.cos(a+.5))+' '+(y2-n*Math.sin(a+.5)),color,width);
  }
  function move(points,fraction) {
    const lengths=points.slice(1).map((q,i)=>Math.hypot(q[0]-points[i][0],q[1]-points[i][1]));
    let d=clamp(fraction)*lengths.reduce((a,b)=>a+b,0);
    for(let i=0;i<lengths.length;i++) { if(d<=lengths[i] || i===lengths.length-1) { const u=lengths[i]?d/lengths[i]:0; return [points[i][0]+(points[i+1][0]-points[i][0])*u,points[i][1]+(points[i+1][1]-points[i][1])*u]; } d-=lengths[i]; }
    return points[0];
  }
  function flow(points,phase,color,count=6,r=6) {
    return Array.from({length:count},(_,i)=>{const q=move(points,((phase+i/count)%1+1)%1);return circle(q[0],q[1],r,color);}).join('');
  }
  function wrap(x,y,value,color,size,width,maxLines=3,anchor='start') {
    const limit=Math.max(8,Math.floor(width/(size*.57))), words=String(value).split(/\s+/), lines=[];
    let s='';
    for (const word of words) {
      if((s+' '+word).trim().length>limit && s) { lines.push(s); s=''; }
      if(word.length>limit) { if(s){lines.push(s);s='';} for(let j=0;j<word.length;j+=limit) lines.push(word.slice(j,j+limit)); }
      else s+=(s?' ':'')+word;
    }
    if(s) lines.push(s);
    const shown=lines.slice(0,maxLines);
    if(lines.length>maxLines) shown[maxLines-1]=shown[maxLines-1].slice(0,-3)+'...';
    return shown.map((v,i)=>text(x,y+i*size*1.3,v,color,size,anchor)).join('');
  }
  const helpers={el,text,path,circle,rect,line,arrow,move,flow,wrap,clamp,escape};
  function register(def) {
    if(!def || !/^[a-z][a-z0-9-]+$/.test(def.id) || typeof def.render!=='function') throw new Error('Invalid template definition.');
    if(registry.has(def.id)) throw new Error('Duplicate template: '+def.id);
    registry.set(def.id,def);
  }
  function get(id) { const d=registry.get(id); if(!d) throw new Error('Unknown templateId: '+id); return d; }
  function defaultConfig(id) {
    const d=get(id);
    return {version:1,templateId:id,title:d.title,subtitle:d.description,caption:d.caption,duration:6,theme:'clinical',format:'portrait',params:clone(d.params),labels:clone(d.labels)};
  }
  function normalize(input) {
    if(!input || typeof input!=='object' || Array.isArray(input)) throw new Error('Scene must be an object.');
    const d=get(input.templateId), c=defaultConfig(d.id);
    for(const k of Object.keys(input)) if(!Object.hasOwn(c,k)) throw new Error('Unknown scene field: '+k);
    for(const k of ['params','labels']) {
      if(input[k]!==undefined && (!input[k] || typeof input[k]!=='object' || Array.isArray(input[k]))) throw new Error(k+' must be an object.');
      for(const key of Object.keys(input[k] || {})) if(!Object.hasOwn(c[k],key)) throw new Error('Unknown '+k+' field: '+key);
    }
    Object.assign(c,input,{params:{...c.params,...input.params},labels:{...c.labels,...input.labels}});
    if(c.version!==1) throw new Error('Only scene version 1 is supported.');
    if(!Object.hasOwn(themes,c.theme)) throw new Error('theme must be clinical or night.');
    if(!['portrait','square','landscape'].includes(c.format)) throw new Error('Invalid format.');
    if(typeof c.duration!=='number' || !Number.isFinite(c.duration) || c.duration<2 || c.duration>60) throw new Error('duration must be between 2 and 60 seconds.');
    for(const [k,n] of [['title',72],['subtitle',160],['caption',180]]) if(typeof c[k]!=='string' || !c[k].trim() || c[k].length>n) throw new Error(k+' must contain 1-'+n+' characters.');
    for(const [k,v] of Object.entries(c.labels)) if(typeof v!=='string' || !v.trim() || v.length>48) throw new Error('Label '+k+' must contain 1-48 characters.');
    for(const [k,s] of Object.entries(d.parameterSchema)) {
      const v=c.params[k];
      if(s.type==='number' && (typeof v!=='number' || !Number.isFinite(v) || v<s.min || v>s.max)) throw new Error(k+' must be between '+s.min+' and '+s.max+'.');
      if(s.type==='enum' && !s.values.includes(v)) throw new Error(k+' must be one of '+s.values.join(', ')+'.');
    }
    return c;
  }
  function renderAccepted(c,seconds,diagramOnly=false) {
    if(typeof seconds!=='number' || !Number.isFinite(seconds)) throw new Error('Time must be a finite number.');
    const d=get(c.templateId), C=themes[c.theme], t=clamp(seconds,0,c.duration), p=t/c.duration;
    const art=d.render(c,p,t,{...helpers,C});
    let w=720,h=1280,body='';
    const phase=p<.25?0:p<.75?1:2;
    if(diagramOnly) {w=640;h=440;body=rect(0,0,w,h,C.paper,0)+art;}
    else {
      if(c.format==='square') {w=960;h=960;}
      if(c.format==='landscape') {w=1280;h=720;}
      body=rect(0,0,w,h,C.bg,0)+rect(24,24,w-48,h-48,C.paper,28);
      body+=text(48,76,'MEDICAL MOTION  /  '+d.category.toUpperCase(),C.teal,17,'start',750);
      let tx=48,ty=143,tw=w-96,ay=330,ax=40,scale=1;
      if(c.format==='square') {ty=108;ay=260;ax=176;scale=.95;}
      if(c.format==='landscape') {tx=790;ty=205;tw=438;ay=163;ax=40;scale=1.1;}
      body+=wrap(tx,ty,c.title,C.ink,c.format==='portrait'?44:38,tw,2);
      body+=wrap(tx,ty+(c.format==='portrait'?124:c.format==='square'?85:100),c.subtitle,C.muted,22,tw,c.format==='landscape'?3:2);
      if(c.format!=='landscape') body+=rect(40,ay-18,w-80,440*scale+36,C.soft,22);
      body+=el('g',{transform:'translate('+ax+' '+ay+') scale('+scale+')'},art);
      const sx=c.format==='landscape'?790:48, sy=c.format==='portrait'?901:c.format==='square'?716:409, sw=c.format==='landscape'?438:w-96;
      body+=text(sx,sy,'0'+(phase+1)+'  /  '+d.stages[phase],C.teal,23,'start',750);
      body+=wrap(sx,sy+53,c.caption,C.ink,c.format==='landscape'?22:c.format==='square'?24:26,sw,c.format==='landscape'?6:c.format==='portrait'?5:3);
      const py=c.format==='square'?865:c.format==='landscape'?632:1135;
      body+=rect(sx,py,sw,5,C.line,2)+rect(sx,py,sw*p,5,C.teal,2);
      body+=text(48,h-62,'SCHEMATIC  /  NOT TO SCALE  /  NOT A CLINICAL SIMULATOR',C.muted,14,'start',500);
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'" role="img" aria-label="'+escape(c.title)+'" style="font-family:system-ui,-apple-system,Segoe UI,sans-serif">'+el('title',{},escape(c.title))+el('desc',{},escape(c.subtitle+' '+c.caption+' '+d.limitations))+body+'</svg>';
  }
  function renderSVG(config,time=0,options={}) {return renderAccepted(normalize(config),time,options.diagramOnly===true);}
  function create(container,config,options={}) {
    if(!container || typeof container.innerHTML!=='string') throw new Error('A DOM container is required.');
    let c=normalize(config), time=0, playing=false, raf=0, last=0, lastPaint=0, dead=false;
    const state=()=>({time,duration:c.duration,playing,config:clone(c)});
    function draw(){if(dead)return;container.innerHTML=renderAccepted(c,time);if(options.onframe)options.onframe(state());}
    function pause(){playing=false;if(raf)G.cancelAnimationFrame(raf);raf=0;if(!dead)draw();}
    function tick(now){if(!playing || dead)return;time+=Math.max(0,now-last)/1000;last=now;if(time>=c.duration){time=c.duration;pause();return;}if(now-lastPaint>=1000/30){draw();lastPaint=now;}raf=G.requestAnimationFrame(tick);}
    function play(){if(dead || playing)return;if(time>=c.duration)time=0;playing=true;last=G.performance.now();lastPaint=0;draw();raf=G.requestAnimationFrame(tick);}
    function seek(value){if(dead)return;if(typeof value!=='number' || !Number.isFinite(value))throw new Error('seek requires seconds.');time=clamp(value,0,c.duration);last=G.performance.now();draw();}
    function update(next){if(dead)return;const valid=normalize(next);pause();c=valid;time=0;draw();}
    function visibility(){if(G.document.hidden)pause();}
    G.document.addEventListener('visibilitychange',visibility);
    draw();
    return {play,pause,seek,update,get state(){return state();},exportSVG:()=>renderAccepted(c,time),exportJSON:()=>JSON.stringify(c,null,2),destroy(){pause();dead=true;container.innerHTML='';G.document.removeEventListener('visibilitychange',visibility);}};
  }
  function metadata(d){const {render,...data}=d;return clone(data);}
  function scriptJSON(obj){return JSON.stringify(obj).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');}
  function standalone(config) {
    const c=normalize(config), d=get(c.templateId);
    const js='('+bootMedicalMotion.toString()+')(globalThis);MedicalMotion.register(Object.assign('+scriptJSON(metadata(d))+',{render:'+d.render.toString()+'}));const scene='+scriptJSON(c)+';const slider=document.getElementById("seek");const button=document.getElementById("play");const player=MedicalMotion.create(document.getElementById("scene"),scene,{onframe:s=>{slider.value=s.time;button.textContent=s.playing?"Pause":"Play";document.getElementById("clock").textContent=s.time.toFixed(1)+" / "+s.duration+" s";}});slider.max=scene.duration;button.onclick=()=>player.state.playing?player.pause():player.play();slider.oninput=()=>{player.pause();player.seek(Number(slider.value));};document.getElementById("reset").onclick=()=>{player.pause();player.seek(0);};player.seek(scene.duration*.5);';
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(c.title)+'</title><style>body{margin:0;background:#0b1526;color:#edf5ff;font:15px system-ui}main{max-width:900px;margin:auto;padding:16px}#scene svg{width:100%;height:auto;max-height:80vh;display:block}nav{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:16px}button{padding:12px 20px;border:0;border-radius:10px;font:inherit;cursor:pointer}input{flex:1;min-width:100px}p{color:#b6c9e1;padding:0 16px}button:focus-visible,input:focus-visible{outline:3px solid #80adff}</style></head><body><main><div id="scene"></div><nav aria-label="Playback"><button id="play">Play</button><button id="reset">Reset</button><label for="seek">Time</label><input id="seek" type="range" min="0" step="0.01" value="0"><output id="clock"></output></nav><p>Educational schematic. Motion starts only when you press Play. No network connection required.</p></main><script>'+js+'</scr'+'ipt></body></html>';
  }
  G.MedicalMotion=Object.freeze({version:'1.0.0',register,get,list:()=>Array.from(registry.values(),metadata),defaultConfig,validate:normalize,renderSVG,create,standalone,helpers});
})(globalThis);
