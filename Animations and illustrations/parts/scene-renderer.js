/* Medical Motion composed-scene renderer v2.1.
 * JSON scenes are validated before render. Instance IDs, dependencies, named
 * attachments and declared local bounds are explicit; no center fallback exists.
 * Standalone exports inline the exact classic parts bundle and stay offline.
 */
(function bootMedicalMotionSceneRenderer(G){
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const palettes={
    clinical:{bg:'#f3f7fc',paper:'#ffffff',ink:'#162d48',muted:'#526780',line:'#dbe5f0',teal:'#087f8c',gold:'#986300'},
    night:{bg:'#0b1526',paper:'#13243b',ink:'#f0f6ff',muted:'#b6c9e1',line:'#344a65',teal:'#66d6d0',gold:'#ffd276'}
  };
  const finite=(v)=>typeof v==='number'&&Number.isFinite(v);
  const object=(v)=>v&&typeof v==='object'&&!Array.isArray(v);
  const wrapText=(value,maxChars)=>{
    const words=String(value).trim().split(/\s+/),lines=[];let line='';
    for(const word of words){const next=line?line+' '+word:word;if(line&&next.length>maxChars){lines.push(line);line=word;}else line=next;}
    if(line)lines.push(line);return lines;
  };
  function instanceId(component,index){return component.instanceId||component.id+'#'+(index+1);}
  function endpoint(value,label){
    if(!object(value)||typeof value.instanceId!=='string'||typeof value.attachment!=='string')throw new Error(label+' must contain instanceId and attachment.');
    return value;
  }
  function normalizeOptions(component,definition,index,scene){
    const raw=component.options===undefined?{}:component.options;
    if(!object(raw))throw new Error('Component '+index+' options must be an object.');
    const allowed=new Set(['x','y','scale','rotation','opacity','accent','theme','params','state','time','progress']);
    for(const key of Object.keys(raw))if(!allowed.has(key))throw new Error(component.id+'.options.'+key+' is not allowed.');
    // Validate caller-supplied values before the scene clock overwrites frame fields.
    G.MedicalMotionParts.validate(raw);
    const params=G.MedicalMotionParts.validateParams(definition,raw.params||{},raw.state||{});
    const state={...(raw.state||{}),attachments:{...definition.attachments,...((raw.state&&raw.state.attachments)||{})}};
    G.MedicalMotionParts.validateState(definition,state,params);
    return {x:320,y:220,scale:1,rotation:0,opacity:1,accent:'blue',theme:scene.theme,params,state,time:0,progress:0,...raw,theme:scene.theme,params,state,time:0,progress:0};
  }
  function transformPoint(component,definition,name){
    const point=(component.options&&component.options.state&&component.options.state.attachments&&component.options.state.attachments[name])||definition.attachments[name];
    if(!point)throw new Error(component.id+' has no attachment '+name+'.');
    const o={x:320,y:220,scale:1,rotation:0,...(component.options||{})};
    const angle=(o.rotation||0)*Math.PI/180,dx=(point.x-320)*(o.scale||1),dy=(point.y-220)*(o.scale||1);
    return {x:o.x+dx*Math.cos(angle)-dy*Math.sin(angle),y:o.y+dx*Math.sin(angle)+dy*Math.cos(angle)};
  }
  function validate(input){
    if(!object(input))throw new Error('Composed scene must be an object.');
    for(const key of Object.keys(input))if(!['version','title','caption','duration','format','theme','components','connections'].includes(key))throw new Error('Unknown scene field: '+key+'.');
    if(input.version!==2)throw new Error('Composed scenes require version 2.');
    if(typeof input.title!=='string'||!input.title.trim()||input.title.length>72)throw new Error('title is required.');
    if(typeof input.caption!=='string'||!input.caption.trim()||input.caption.length>180)throw new Error('caption is required.');
    if(!finite(input.duration)||input.duration<2||input.duration>60)throw new Error('duration must be between 2 and 60 seconds.');
    if(!['portrait','square','landscape'].includes(input.format||'portrait'))throw new Error('Invalid format.');
    if(!palettes[input.theme||'clinical'])throw new Error('Invalid theme.');
    if(!Array.isArray(input.components)||!input.components.length)throw new Error('components must contain at least one part.');
    const scene={...input,format:input.format||'portrait',theme:input.theme||'clinical'},ids=new Set(),byId=new Map();
    scene.components.forEach((c,i)=>{
      if(!object(c)||typeof c.id!=='string')throw new Error('Component '+i+' requires an id.');
      const d=G.MedicalMotionParts.get(c.id),key=instanceId(c,i);
      if(!/^[a-z][a-z0-9-]*(#[1-9][0-9]*)?$/.test(key)||ids.has(key))throw new Error('Component instanceId must be unique: '+key+'.');
      ids.add(key);byId.set(key,{component:c,definition:d,index:i});
      d.dependencies.forEach(dep=>{if(!scene.components.some(x=>x&&x.id===dep))throw new Error(c.id+' requires component '+dep+'.');});
      normalizeOptions(c,d,i,scene);
    });
    const connections=scene.connections===undefined?[]:scene.connections;
    if(!Array.isArray(connections))throw new Error('connections must be an array.');
    connections.forEach((connection,i)=>{
      if(!object(connection))throw new Error('Connection '+i+' must be an object.');
      const from=endpoint(connection.from,'Connection '+i+'.from'),to=endpoint(connection.to,'Connection '+i+'.to');
      for(const [label,end] of [['from',from],['to',to]]){
        const item=byId.get(end.instanceId);if(!item)throw new Error('Connection '+i+'.'+label+' references unknown instance '+end.instanceId+'.');
        if(!Object.hasOwn(item.definition.attachments,end.attachment))throw new Error('Connection '+i+'.'+label+' references unknown attachment '+end.attachment+' on '+end.instanceId+'.');
      }
    });
    for(const [i,c] of scene.components.entries()){
      const b=bbox(c,G.MedicalMotionParts.get(c.id));
      if(b.x<0||b.y<0||b.right>640||b.bottom>440)throw new Error('Component '+instanceId(c,i)+' exceeds its 640x440 scene bounds.');
    }
    return scene;
  }
  function bbox(component,definition){
    const o={x:320,y:220,scale:1,rotation:0,...(component.options||{})},b=definition.bounds;
    const corners=[[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]].map(([x,y])=>{
      const a=(o.rotation||0)*Math.PI/180,dx=(x-320)*(o.scale||1),dy=(y-220)*(o.scale||1);return [o.x+dx*Math.cos(a)-dy*Math.sin(a),o.y+dx*Math.sin(a)+dy*Math.cos(a)];
    });
    return {x:Math.min(...corners.map(p=>p[0])),y:Math.min(...corners.map(p=>p[1])),right:Math.max(...corners.map(p=>p[0])),bottom:Math.max(...corners.map(p=>p[1]))};
  }
  function overlap(a,b){const w=Math.max(0,Math.min(a.right,b.right)-Math.max(a.x,b.x)),h=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y));return w*h;}
  function audit(input,time=0){
    const scene=validate(input),warnings=[],issues=[],boxes=[];
    scene.components.forEach((component,index)=>{
      const d=G.MedicalMotionParts.discover(component.id),box=bbox(component,d);boxes.push({component,d,box,index});
      if(box.x<0||box.y<0||box.right>640||box.bottom>440)issues.push({type:'clipping',instanceId:instanceId(component,index),bounds:box});
      if(component.id==='attachment-label'){
        const p=(component.options&&component.options.params)||{},state=(component.options&&component.options.state)||{},name=p.at||'center',point=(state.attachments&&state.attachments[name])||d.attachments[name];
        if(!point)issues.push({type:'label-attachment',instanceId:instanceId(component,index),attachment:name});
        else {const x=point.x+(p.dx||0),y=point.y+(p.dy||0),width=Math.min(320,Math.max(32,String(p.label||'').length*9));if(x-width/2<0||x+width/2>640||y<16||y>424)issues.push({type:'label-out-of-bounds',instanceId:instanceId(component,index),x,y});}
      }
    });
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
      const area=overlap(boxes[i].box,boxes[j].box),a=(boxes[i].box.right-boxes[i].box.x)*(boxes[i].box.bottom-boxes[i].box.y),b=(boxes[j].box.right-boxes[j].box.x)*(boxes[j].box.bottom-boxes[j].box.y);
      if(area>0.92*Math.min(a,b)&&boxes[i].d.role==='structure'&&boxes[j].d.role==='structure')warnings.push({type:'unsafe-overlap',instances:[instanceId(boxes[i].component,boxes[i].index),instanceId(boxes[j].component,boxes[j].index)]});
    }
    return {time,issues,warnings,ok:issues.length===0};
  }
  function connectionMarkup(scene){
    return (scene.connections||[]).map((connection,i)=>{
      const fromItem=scene.components.find((c,index)=>instanceId(c,index)===connection.from.instanceId),toItem=scene.components.find((c,index)=>instanceId(c,index)===connection.to.instanceId);
      const from=transformPoint(fromItem,G.MedicalMotionParts.get(fromItem.id),connection.from.attachment),to=transformPoint(toItem,G.MedicalMotionParts.get(toItem.id),connection.to.attachment);
      return '<path data-connection="'+i+'" d="M '+from.x+' '+from.y+' L '+to.x+' '+to.y+'" fill="none" stroke="#087f8c" stroke-width="3" stroke-dasharray="8 6" marker-end="url(#connection-arrow)"/>';
    }).join('');
  }
  function renderSVG(input,time=0){
    const scene=validate(input),t=clamp(time,0,scene.duration),p=t/scene.duration,report=audit(scene,t);
    if(report.issues.length)throw new Error('Scene layout validation failed: '+report.issues.map(x=>x.type+' '+(x.instanceId||'')).join(', '));
    const renderer=G.MedicalMotionParts.createRenderer({scene,time:t,progress:p});
    let w=720,h=1280,art='';if(scene.format==='square'){w=960;h=960;}if(scene.format==='landscape'){w=1280;h=720;}
    scene.components.forEach((component,index)=>{
      const options={...(component.options||{}),theme:scene.theme,time:t,progress:p,state:{...((component.options&&component.options.state)||{}),sceneIndex:index}};
      art+=renderer.render(component.id,options);
    });
    const C=palettes[scene.theme],landscape=scene.format==='landscape',artY=landscape?64:190,scale=landscape?1.7:scene.format==='square'?.95:.84,artX=(w-640*scale)/2,artBoxY=landscape?160:artY-28,artBoxHeight=landscape?440:470;
    const title='<text x="48" y="72" fill="'+C.teal+'" font-size="17" font-weight="750">COMPOSED MEDICAL MOTION</text>';
    const heading='<text x="48" y="132" fill="'+C.ink+'" font-size="38" font-weight="750">'+esc(scene.title)+'</text>';
    const artBox='<rect x="24" y="'+artBoxY+'" width="'+(w-48)+'" height="'+artBoxHeight+'" rx="24" fill="'+(scene.theme==='night'?'#203652':'#eaf1fb')+'"/>';
    const captionY=landscape?625:scene.format==='square'?855:1125,captionLines=wrapText(scene.caption,landscape?54:42),captionSize=landscape?22:24;
    const caption=captionLines.map((line,i)=>'<text x="48" y="'+(captionY+i*28)+'" fill="'+C.ink+'" font-size="'+captionSize+'" font-weight="600">'+esc(line)+'</text>').join('')+'<text x="48" y="'+(captionY+captionLines.length*28+12)+'" fill="'+C.muted+'" font-size="14">SCHEMATIC · ORIGINAL SVG GEOMETRY · NOT CLINICALLY VALIDATED</text>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'" role="img" aria-label="'+esc(scene.title)+'" style="font-family:system-ui,-apple-system,Segoe UI,sans-serif"><title>'+esc(scene.title)+'</title><desc>'+esc(scene.caption)+'</desc><defs><marker id="connection-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="'+C.teal+'"/></marker></defs><rect width="100%" height="100%" fill="'+C.bg+'"/><rect x="24" y="24" width="'+(w-48)+'" height="'+(h-48)+'" rx="28" fill="'+C.paper+'"/>'+title+heading+artBox+'<g transform="translate('+artX+' '+artY+') scale('+scale+')">'+art+connectionMarkup(scene)+'</g>'+caption+'</svg>';
  }
  function standalone(input,engineSource=''){
    const scene=validate(input),safeEngine=String(engineSource||'').replace(/<\/script/gi,'<\\/script');if(!safeEngine&&!G.MedicalMotionParts)throw new Error('A parts engine source is required for standalone export.');
    const boot='('+bootMedicalMotionSceneRenderer.toString()+')(globalThis);';
    const script=safeEngine+'\n'+boot+'const scene='+JSON.stringify(scene).replace(/</g,'\\u003c')+';const seek=document.getElementById("seek"),play=document.getElementById("play"),reset=document.getElementById("reset"),host=document.getElementById("scene"),clock=document.getElementById("clock");let time=0,playing=false,last=0,raf=0;function draw(){host.innerHTML=MedicalMotionScene.renderSVG(scene,time);seek.value=time;clock.textContent=time.toFixed(1)+" / "+scene.duration+" s";play.textContent=playing?"Pause":"Play";}function tick(now){if(!playing)return;time+=Math.max(0,now-last)/1000;last=now;if(time>=scene.duration){time=scene.duration;playing=false;}draw();if(playing)raf=requestAnimationFrame(tick);}play.onclick=()=>{playing=!playing;if(playing){if(time>=scene.duration)time=0;last=performance.now();raf=requestAnimationFrame(tick);}else cancelAnimationFrame(raf);draw();};seek.oninput=()=>{playing=false;cancelAnimationFrame(raf);time=Number(seek.value);draw();};reset.onclick=()=>{playing=false;cancelAnimationFrame(raf);time=0;draw();};draw();';
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(scene.title)+'</title><style>body{margin:0;background:'+palettes[scene.theme].bg+';color:'+palettes[scene.theme].ink+';font:15px system-ui}main{max-width:960px;margin:auto;padding:12px}#scene svg{width:100%;height:auto;display:block}nav{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:14px}button{padding:11px 18px;border:0;border-radius:9px;font:inherit;cursor:pointer}input{flex:1;min-width:120px}p{color:'+palettes[scene.theme].muted+'}</style></head><body><main><div id="scene"></div><nav aria-label="Playback"><button id="play">Play</button><button id="reset">Replay</button><label for="seek">Seek</label><input id="seek" type="range" min="0" max="'+scene.duration+'" step="0.01" value="0"><output id="clock"></output></nav><p>Offline composed scene. Playback is explicit and deterministic.</p></main><script>'+script+'</scr'+'ipt></body></html>';
  }
  G.MedicalMotionScene={version:'2.1.0',validate,renderSVG,standalone,audit};
})(globalThis);
