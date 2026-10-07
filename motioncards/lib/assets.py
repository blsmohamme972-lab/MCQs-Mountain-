"""Import third-party SVG illustrations into a v2 scene without the model ever reading them.

An author (or AI agent) runs one command; the tool cleans the file, fits it into a box on the
stage, makes its ids unique, records the licence credit, and appends it to ``scene["svg"]``.
The model then only references the illustration by id (``#heart``), so a 60 KB drawing costs
a few tokens instead of ~20k, and two imported files can never break each other's gradients.
"""
from __future__ import annotations
import re
import xml.etree.ElementTree as ET

SVG="http://www.w3.org/2000/svg"
XLINK="http://www.w3.org/1999/xlink"
EDITOR_NS=("inkscape","sodipodi","sketch","illustrator","adobe","serif","figma","bx")
DROP_TAGS={"metadata","title","desc","script","namedview"}
REF_RE=re.compile(r"url\(\s*(['\"]?)#([^)'\"]+)\1\s*\)")
NUM_RE=re.compile(r"-?(?:\d+\.\d+|\d+\.|\.\d+|\d+)(?:[eE][-+]?\d+)?")

class AssetImportError(ValueError):
    pass

def _local(tag:str)->str:return tag.split("}")[-1]

def _is_editor(name:str)->bool:
    if name.startswith("{"):
        ns=name[1:].split("}")[0].lower()
        return any(x in ns for x in EDITOR_NS)
    return any(name.startswith(x+":") for x in EDITOR_NS)

def _round_numbers(text:str,decimals:int)->str:
    out=[];pos=0
    for m in NUM_RE.finditer(text):
        out.append(text[pos:m.start()]);pos=m.end()
        v=round(float(m.group(0)),decimals)
        s=(f"{v:.{decimals}f}").rstrip("0").rstrip(".") if decimals>0 else str(int(v))
        if s in {"-0","","-"}:s="0"
        prev="".join(out)[-1:] if out else ""
        # Compact SVG syntax lets numbers touch ("1.5.5", "2-3"); never let a rounded number merge with the previous one.
        if prev and (prev.isdigit() or prev==".") and not s.startswith("-"):s=" "+s
        out.append(s)
    out.append(text[pos:])
    return "".join(out)

def _viewbox(root)->tuple[float,float,float,float]:
    vb=root.get("viewBox")
    if vb:
        parts=[float(x) for x in re.split(r"[\s,]+",vb.strip()) if x]
        if len(parts)==4 and parts[2]>0 and parts[3]>0:return tuple(parts)
    def size(v):
        m=re.match(r"\s*([0-9.]+)",str(v or ""))
        return float(m.group(1)) if m else 0.0
    w,h=size(root.get("width")),size(root.get("height"))
    if w>0 and h>0:return (0.0,0.0,w,h)
    raise AssetImportError("the SVG has no usable viewBox or width/height")

def prepare_svg(source:str,asset_id:str,box:tuple[float,float,float,float],decimals:int=2,fit:str="contain")->str:
    """Return a cleaned ``<g id=asset_id ...>`` fragment scaled into box=(x,y,w,h) stage pixels."""
    if not re.fullmatch(r"[a-z][a-z0-9_-]{0,31}",asset_id):raise AssetImportError("id must match ^[a-z][a-z0-9_-]{0,31}$")
    text=re.sub(r"<!DOCTYPE[^>\[]*(\[[^\]]*\])?\s*>","",source,flags=re.I|re.S)
    text=re.sub(r"<\?xml[^>]*\?>","",text)
    if re.search(r"<!ENTITY",text,re.I):raise AssetImportError("SVG declares entities; refusing to import")
    try:root=ET.fromstring(text)
    except ET.ParseError as exc:raise AssetImportError(f"not well-formed SVG: {exc}") from None
    if _local(root.tag)!="svg":raise AssetImportError("root element is not <svg>")
    vx,vy,vw,vh=_viewbox(root)
    # Collect ids first so every internal reference can be rewritten consistently.
    ids={el.get("id") for el in root.iter() if el.get("id")}
    rename={old:f"{asset_id}-{i}" for i,old in enumerate(sorted(ids))}
    def fix_refs(value:str)->str:
        value=REF_RE.sub(lambda m:f"url(#{rename.get(m.group(2),m.group(2))})",value)
        return value
    def clean(el):
        for child in list(el):
            tag=_local(child.tag) if isinstance(child.tag,str) else ""
            if not isinstance(child.tag,str) or tag in DROP_TAGS or _is_editor(child.tag):
                el.remove(child);continue
            clean(child)
        for name in list(el.attrib):
            if _is_editor(name):del el.attrib[name];continue
            val=el.attrib[name];lname=_local(name)
            if lname.startswith("on"):del el.attrib[name];continue
            if lname=="id":el.attrib[name]=rename.get(val,val);continue
            if lname=="href":
                if val.startswith("#"):el.attrib[name]="#"+rename.get(val[1:],val[1:])
                elif val.startswith("data:image/"):pass
                else:raise AssetImportError(f"<{_local(el.tag)}> links to an external file ({val[:60]}); embed it first")
                if name!="href":del el.attrib[name];el.set("href",val if not val.startswith("#") else "#"+rename.get(val[1:],val[1:]))
                continue
            if re.search(r"url\(\s*['\"]?\s*(?:https?:)?//",val,re.I):raise AssetImportError("SVG references an external url()")
            val=fix_refs(val)
            if lname in {"d","points","transform","x","y","x1","y1","x2","y2","cx","cy","r","rx","ry","width","height","stroke-width","offset","fx","fy","gradientTransform","stdDeviation"}:
                val=_round_numbers(val,decimals)
            el.attrib[name]=val
        if _local(el.tag)=="style" and el.text:
            if re.search(r"@import|url\(\s*['\"]?\s*(?:https?:)?//",el.text,re.I):raise AssetImportError("<style> imports external CSS")
            css=fix_refs(el.text)
            # Scope class selectors so two imported files cannot restyle each other.
            css=re.sub(r"\.([A-Za-z_][\w-]*)",lambda m:f".{asset_id}-{m.group(1)}",css)
            css=re.sub(r"#([A-Za-z_][\w-]*)(?=[\s,{.:>+~\[])",lambda m:"#"+rename.get(m.group(1),m.group(1)),css)
            el.text=css
        cls=el.get("class")
        if cls:el.set("class"," ".join(f"{asset_id}-{c}" for c in cls.split()))
    clean(root)
    x,y,w,h=box
    sx,sy=w/vw,h/vh
    if fit=="contain":s=min(sx,sy);sx=sy=s
    elif fit=="cover":s=max(sx,sy);sx=sy=s
    elif fit!="stretch":raise AssetImportError("fit must be contain, cover or stretch")
    tx=x+(w-vw*sx)/2-vx*sx;ty=y+(h-vh*sy)/2-vy*sy
    ET.register_namespace("",SVG);ET.register_namespace("xlink",XLINK)
    inner="".join(ET.tostring(child,encoding="unicode") for child in root)
    inner=inner.replace(f' xmlns="{SVG}"',"").replace(f" xmlns:ns0=\"{SVG}\"","").replace("ns0:","")
    inner=re.sub(r"\s+xmlns:xlink=\"[^\"]+\"","",inner)
    inner=re.sub(r">\s+<","><",inner)
    t=lambda v:("%.3f"%v).rstrip("0").rstrip(".")
    return f'<g id="{asset_id}" transform="translate({t(tx)} {t(ty)}) scale({t(sx)} {t(sy)})">{inner}</g>'

def prepare_template(source:str,asset_id:str,width:float,height:float,decimals:int=2)->str:
    """A reusable symbol centred on (0,0), placed in <defs>: draw copies with <use href="#id" x= y=>."""
    return "<defs>"+prepare_svg(source,asset_id,(-width/2,-height/2,width,height),decimals,"contain")+"</defs>"

def add_to_scene(scene:dict,fragment:str,credit:str|None=None)->dict:
    """Append an imported fragment to scene['svg'] (creating it) and record the credit."""
    svg=scene.get("svg") or '<svg xmlns="http://www.w3.org/2000/svg"></svg>'
    if "</svg>" not in svg:raise AssetImportError("scene svg has no closing </svg>")
    m=re.search(r'<g id="([a-z][a-z0-9_-]*)"',fragment)
    if m and re.search(r'\bid="'+re.escape(m.group(1))+r'"',svg):raise AssetImportError(f"id {m.group(1)!r} already exists in scene.svg")
    head,tail=svg.rsplit("</svg>",1)
    scene["svg"]=head+fragment+"</svg>"+tail
    if credit:
        credits=list(scene.get("credits") or [])
        if credit not in credits:credits.append(credit)
        scene["credits"]=credits
    return scene
