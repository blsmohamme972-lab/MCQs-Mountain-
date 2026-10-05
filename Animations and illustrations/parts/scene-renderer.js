/* Medical Motion composed-scene renderer v1.
 * This is deliberately separate from the part registry. It accepts a small JSON scene,
 * supplies each part with an explicit renderer context, and can inline the exact part
 * engine for a self-contained export.
 */
(function bootMedicalMotionSceneRenderer(G){
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const palettes={
    clinical:{bg:'#f3f7fc',paper:'#ffffff',ink:'#162d48',muted:'#526780',line:'#dbe5f0',teal:'#087f8c',gold:'#986300'},
    night:{bg:'#0b1526',paper:'#13243b',ink:'#f0f6ff',muted:'#b6c9e1',line:'#344a65',teal:'#66d6d0',gold:'#ffd276'}
  };
  function validate(scene){
    if(!scene||typeof scene!=='object'||Array.isArray(scene))throw new Error('Composed scene must be an object.');
    if(scene.version!==2)throw new Error('Composed scenes require version 2.');
    if(typeof scene.title!=='string'||!scene.title.trim()||scene.title.length>72)throw new Error('title is required.');
    if(typeof scene.caption!=='string'||!scene.caption.trim()||scene.caption.length>180)throw new Error('caption is required.');
    if(!Number.isFinite(scene.duration)||scene.duration<2||scene.duration>60)throw new Error('duration must be between 2 and 60 seconds.');
    if(!['portrait','square','landscape'].includes(scene.format||'portrait'))throw new Error('Invalid format.');
    if(!palettes[scene.theme||'clinical'])throw new Error('Invalid theme.');
    if(!Array.isArray(scene.components)||!scene.components.length)throw new Error('components must contain at least one part.');
    const seen=new Set();
    scene.components.forEach((c,i)=>{
      if(!c||typeof c.id!=='string')throw new Error('Component '+i+' requires an id.');
      if(!G.MedicalMotionParts.get(c.id))throw new Error('Unknown component '+c.id+'.');
      const d=G.MedicalMotionParts.discover(c.id);
      d.dependencies.forEach(dep=>{if(!scene.components.some(x=>x.id===dep))throw new Error(c.id+' requires component '+dep+'.');});
      if(c.options!==undefined && (!c.options||typeof c.options!=='object'||Array.isArray(c.options)))throw new Error('Component options must be an object.');
      seen.add(c.id);
    });
    return {...scene,format:scene.format||'portrait',theme:scene.theme||'clinical'};
  }
  function renderSVG(input,time=0){
    const scene=validate(input),t=clamp(time,0,scene.duration),p=t/scene.duration,C=palettes[scene.theme];
    const renderer=G.MedicalMotionParts.createRenderer({scene,time:t,progress:p});
    let w=720,h=1280,art='';
    if(scene.format==='square'){w=960;h=960;}
    if(scene.format==='landscape'){w=1280;h=720;}
    scene.components.forEach((component,index)=>{
      const d=G.MedicalMotionParts.discover(component.id), options={...(component.options||{}),theme:scene.theme,time:t,progress:p};
      // The scene may explicitly provide a local attachment map for arrows and labels.
      options.state={...(options.state||{}),sceneIndex:index};
      art+=renderer.render(component.id,options);
      if(index===0 && component.options&&component.options.state&&component.options.state.attachments) options.state.attachments=component.options.state.attachments;
    });
    const title='<text x="48" y="72" fill="'+C.teal+'" font-size="17" font-weight="750">COMPOSED MEDICAL MOTION</text>';
    const heading='<text x="48" y="132" fill="'+C.ink+'" font-size="38" font-weight="750">'+esc(scene.title)+'</text>';
    const artY=scene.format==='landscape'?150:190, scale=scene.format==='landscape'?1.05:scene.format==='square'?.95:.84, artX=scene.format==='landscape'?40:64;
    const artBox='<rect x="24" y="'+(artY-28)+'" width="'+(w-48)+'" height="'+(scene.format==='landscape'?430:470)+'" rx="24" fill="'+(scene.theme==='night'?'#203652':'#eaf1fb')+'"/>';
    const captionY=scene.format==='landscape'?625:scene.format==='square'?855:1125;
    const caption='<text x="48" y="'+captionY+'" fill="'+C.ink+'" font-size="24" font-weight="600">'+esc(scene.caption)+'</text><text x="48" y="'+(captionY+34)+'" fill="'+C.muted+'" font-size="14">SCHEMATIC · ORIGINAL SVG GEOMETRY · NOT CLINICALLY VALIDATED</text>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'" role="img" aria-label="'+esc(scene.title)+'" style="font-family:system-ui,-apple-system,Segoe UI,sans-serif"><title>'+esc(scene.title)+'</title><desc>'+esc(scene.caption)+'</desc><rect width="100%" height="100%" fill="'+C.bg+'"/><rect x="24" y="24" width="'+(w-48)+'" height="'+(h-48)+'" rx="28" fill="'+C.paper+'"/>'+title+heading+artBox+'<g transform="translate('+artX+' '+artY+') scale('+scale+')">'+art+'</g>'+caption+'</svg>';
  }
  function standalone(input,engineSource=''){
    const scene=validate(input),safeEngine=String(engineSource||'').replace(/<\/script/gi,'<\\/script');
    if(!safeEngine && !G.MedicalMotionParts)throw new Error('A parts engine source is required for standalone export.');
    const boot='('+bootMedicalMotionSceneRenderer.toString()+')(globalThis);';
    const script=safeEngine+'\n'+boot+'const scene='+JSON.stringify(scene).replace(/</g,'\\u003c')+';const seek=document.getElementById("seek"),play=document.getElementById("play"),reset=document.getElementById("reset"),host=document.getElementById("scene"),clock=document.getElementById("clock");let time=0,playing=false,last=0,raf=0;function draw(){host.innerHTML=MedicalMotionScene.renderSVG(scene,time);seek.value=time;clock.textContent=time.toFixed(1)+" / "+scene.duration+" s";play.textContent=playing?"Pause":"Play";}function tick(now){if(!playing)return;time+=Math.max(0,now-last)/1000;last=now;if(time>=scene.duration){time=scene.duration;playing=false;}draw();if(playing)raf=requestAnimationFrame(tick);}play.onclick=()=>{playing=!playing;if(playing){if(time>=scene.duration)time=0;last=performance.now();raf=requestAnimationFrame(tick);}else cancelAnimationFrame(raf);draw();};seek.oninput=()=>{playing=false;cancelAnimationFrame(raf);time=Number(seek.value);draw();};reset.onclick=()=>{playing=false;cancelAnimationFrame(raf);time=0;draw();};draw();';
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(scene.title)+'</title><style>body{margin:0;background:'+palettes[scene.theme].bg+';color:'+palettes[scene.theme].ink+';font:15px system-ui}main{max-width:960px;margin:auto;padding:12px}#scene svg{width:100%;height:auto;display:block}nav{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:14px}button{padding:11px 18px;border:0;border-radius:9px;font:inherit;cursor:pointer}input{flex:1;min-width:120px}p{color:'+palettes[scene.theme].muted+'}</style></head><body><main><div id="scene"></div><nav aria-label="Playback"><button id="play">Play</button><button id="reset">Replay</button><label for="seek">Seek</label><input id="seek" type="range" min="0" max="'+scene.duration+'" step="0.01" value="0"><output id="clock"></output></nav><p>Offline composed scene. Playback is explicit and deterministic.</p></main><script>'+script+'</scr'+'ipt></body></html>';
  }
  G.MedicalMotionScene={version:'1.0.0',validate,renderSVG,standalone};
})(globalThis);
