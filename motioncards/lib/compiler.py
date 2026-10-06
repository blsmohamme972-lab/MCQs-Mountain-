from __future__ import annotations
import json,re
from .spec import PROTOCOL_VERSION,RUNTIME_VERSION,validate_duration,QID_RE

UNSAFE_CUSTOM=re.compile(r"\b(eval|Function|fetch|XMLHttpRequest|WebSocket|EventSource|Worker|SharedWorker|setTimeout|setInterval|requestAnimationFrame|document\.|localStorage|sessionStorage|indexedDB|window\.open|location\s*=)\b")

def validate_scene(scene:dict,qid:str,duration_ms:int):
    if not isinstance(scene,dict) or scene.get("schema_version")!=1:raise ValueError("scene_schema_unsupported")
    if scene.get("qid")!=qid or not QID_RE.fullmatch(str(qid)):raise ValueError("scene_qid_mismatch")
    if scene.get("duration_ms")!=duration_ms:raise ValueError("scene_duration_mismatch")
    validate_duration(duration_ms)
    takeaway=str(scene.get("takeaway") or "").strip()
    if not takeaway or len(takeaway)>240:raise ValueError("takeaway_invalid")
    layers=scene.get("layers")
    if not isinstance(layers,list) or not 1<=len(layers)<=80:raise ValueError("layers_invalid")
    allowed={"label","rect","circle","arrow","path","highlight","focus"}
    for layer in layers:
        if not isinstance(layer,dict) or layer.get("type") not in allowed:raise ValueError("layer_type_invalid")
        start=int(layer.get("start_ms",0));end=int(layer.get("end_ms",duration_ms))
        if start<0 or end<start or end>duration_ms:raise ValueError("layer_timing_invalid")
        if layer.get("type")=="label" and len(str(layer.get("text") or ""))>120:raise ValueError("label_too_long")
        if layer.get("type")=="path" and len(str(layer.get("d") or ""))>2000:raise ValueError("path_too_long")
    custom=scene.get("custom_renderer")
    if custom is not None:
        if not isinstance(custom,str) or len(custom)>12000 or UNSAFE_CUSTOM.search(custom):raise ValueError("custom_renderer_unsafe")
        if "function renderCustom(" not in custom:raise ValueError("custom_renderer_contract")
    return scene

RUNTIME_JS=r"""
const MC={protocol:1,qid:CONFIG.qid,duration:CONFIG.duration_ms,port:null,destroyed:false};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,p)=>a+(b-a)*p;
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function state(layer,t){
  const a=layer.from||{},b=layer.to||a,s=Number(layer.start_ms||0),e=Number(layer.end_ms??CONFIG.duration_ms);
  const p=e===s?(t>=e?1:0):clamp((t-s)/(e-s),0,1),out={};
  for(const k of new Set([...Object.keys(a),...Object.keys(b)])){const x=a[k],y=b[k];out[k]=(typeof x==='number'&&typeof y==='number')?lerp(x,y,p):(p<1?(x??y):(y??x));}
  out.opacity=(t<s||t>e)?0:Number(out.opacity??layer.opacity??1);return out;
}
function common(st){return ' opacity="'+clamp(Number(st.opacity??1),0,1)+'" transform="translate('+Number(st.x||0)+' '+Number(st.y||0)+') scale('+Number(st.scale||1)+')"';}
function renderLayer(l,t){
 const s=state(l,t),stroke=esc(l.stroke||'#18363a'),fill=esc(l.fill||'none'),w=Number(l.stroke_width||3),cm=common(s);
 if(l.type==='label')return '<text x="'+Number(l.x||0)+'" y="'+Number(l.y||0)+'"'+cm+' fill="'+esc(l.color||'#18363a')+'" font-size="'+Number(l.size||24)+'" font-weight="'+esc(l.weight||'600')+'" text-anchor="'+esc(l.anchor||'middle')+'">'+esc(l.text||'')+'</text>';
 if(l.type==='rect'||l.type==='highlight'||l.type==='focus')return '<rect x="'+Number(l.x||0)+'" y="'+Number(l.y||0)+'" width="'+Number(l.width||100)+'" height="'+Number(l.height||60)+'" rx="'+Number(l.rx||12)+'"'+cm+' fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+w+'"/>';
 if(l.type==='circle')return '<circle cx="'+Number(l.cx||0)+'" cy="'+Number(l.cy||0)+'" r="'+Number(l.r||20)+'"'+cm+' fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+w+'"/>';
 if(l.type==='path')return '<path d="'+esc(l.d||'')+'"'+cm+' fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round"/>';
 if(l.type==='arrow'){const x1=Number(l.x1||0),y1=Number(l.y1||0),x2=Number(l.x2||0),y2=Number(l.y2||0);return '<g'+cm+'><line x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'" stroke="'+stroke+'" stroke-width="'+w+'" stroke-linecap="round"/><path d="M '+x2+' '+y2+' l -14 -8 l 4 8 l -4 8 z" fill="'+stroke+'"/></g>';}
 return '';
}
function renderAt(ms){
 const t=clamp(Number(ms)||0,0,CONFIG.duration_ms);art.innerHTML=CONFIG.layers.map(l=>renderLayer(l,t)).join('');
 if(typeof renderCustom==='function')renderCustom(art,t,{clamp,lerp,esc,CONFIG});
 time.textContent=(t/1000).toFixed(1)+'s';root.dataset.ended=t>=CONFIG.duration_ms?'1':'0';
}
function valid(m){return m&&m.protocol===1&&m.channel_id===CONFIG.channel_id&&m.qid===CONFIG.qid;}
addEventListener('message',ev=>{
 if(ev.source!==parent||!CONFIG.allowed_host_origins.includes(ev.origin))return;
 const m=ev.data;if(!m||m.type!=='connect'||!valid(m)||!ev.ports?.[0]||MC.port)return;
 MC.port=ev.ports[0];MC.port.onmessage=e=>{
   const x=e.data;if(!valid(x)||MC.destroyed)return;
   if(x.type==='tick'||x.type==='seek'){renderAt(x.time_ms);MC.port.postMessage({type:x.time_ms>=CONFIG.duration_ms?'ended':'state',protocol:1,channel_id:CONFIG.channel_id,qid:CONFIG.qid,time_ms:clamp(Number(x.time_ms)||0,0,CONFIG.duration_ms)});}
   else if(x.type==='restart'){renderAt(0);MC.port.postMessage({type:'state',protocol:1,channel_id:CONFIG.channel_id,qid:CONFIG.qid,time_ms:0});}
   else if(x.type==='play'||x.type==='pause'){MC.port.postMessage({type:'state',protocol:1,channel_id:CONFIG.channel_id,qid:CONFIG.qid,time_ms:Number(x.time_ms)||0,playing:x.type==='play'});}
   else if(x.type==='destroy'){MC.destroyed=true;MC.port.close();}
 };
 MC.port.start();MC.port.postMessage({type:'ready',protocol:1,channel_id:CONFIG.channel_id,qid:CONFIG.qid,duration_ms:CONFIG.duration_ms});
});
renderAt(0);
parent.postMessage({type:'kafu-motioncards-ready',protocol:1,channel_id:CONFIG.channel_id,qid:CONFIG.qid},'*');
"""

def compile_scene(scene:dict,allowed_host_origins:list[str]|None=None)->str:
    qid=str(scene["qid"]);duration=int(scene["duration_ms"]);validate_scene(scene,qid,duration)
    allowed=allowed_host_origins or ["https://kafu.blsmohamme97.workers.dev"]
    if not allowed or any(not re.fullmatch(r"https://[A-Za-z0-9.-]+(?::\d+)?",x) for x in allowed):raise ValueError("allowed_host_origin_invalid")
    cfg={"qid":qid,"duration_ms":duration,"layers":scene["layers"],"channel_id":"__HOST_REPLACES_CHANNEL__","allowed_host_origins":allowed,"runtime_version":RUNTIME_VERSION}
    custom=scene.get("custom_renderer") or "function renderCustom(){}"
    cfgtext=json.dumps(cfg,ensure_ascii=False,separators=(",",":")).replace("<","\\u003c")
    return """<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#f7fbfb;color:#18363a;font-family:system-ui,sans-serif}#root{height:100%;display:grid;grid-template-rows:1fr auto;overflow:hidden}svg{width:100%;height:100%;display:block}#time{font-size:12px;padding:4px 8px;text-align:right;color:#557277}</style></head>
<body><main id="root"><svg viewBox="0 0 640 440" role="img" aria-label="Kafu MotionCards animation"><g id="art"></g></svg><div id="time"></div></main>
<script>const CONFIG="""+cfgtext+""";const root=document.getElementById('root'),art=document.getElementById('art'),time=document.getElementById('time');"""+custom+"\n"+RUNTIME_JS+"""</script></body></html>"""
