"""MotionCards art kit (v2): shaded anatomical illustration on a dark stage.

Output is an ordinary scene JSON (declarative layers + one bounded custom_renderer).
Constraints from motioncards/lib/compiler.py that shape this kit:
  * layer visible only inside [start_ms, end_ms]; "appear and stay" = consecutive segments,
    last one ends at DUR.  Max 80 layers / scene, `d` <= 2000 chars, custom_renderer <= 12000 chars.
  * layer transform = translate(x y) rotate(r) scale(s) about the SVG ORIGIN.  To pivot a shape
    about (px,py): author its path with the pivot at (0,0) and animate x/y = (px,py), rotate = angle.
  * layer fill/stroke may be "url(#id)" (<=64 chars) - gradients are defined by renderCustom.
  * stroke_width 0 is treated as 3 by the runtime -> use stroke "none" for no outline.
  * custom_renderer may not mention: eval, Function, fetch, XMLHttpRequest, WebSocket, EventSource,
    Worker, setTimeout, setInterval, requestAnimationFrame, document., localStorage, ... , location =
"""
import json, math

DUR = 8000

# ----------------------------------------------------------------- palette
BG = "url(#bg)"
INK = "#e8f4f4"          # label text on dark stage
SOFT = "#9fc4c8"         # secondary text
GOLD = "#f3c04c"         # nerve body / emphasis
GOLD_D = "#5b4510"       # nerve outline
GOLD_L = "#fff3bf"       # nerve sheen
RED = "#ef6a5f"
CYAN = "#5fd0d6"
BONE_LINE = "#8d7f5f"


def S(o=1, x=0, y=0, r=None, s=None):
    d = {"opacity": o, "x": x, "y": y}
    if r is not None:
        d["rotate"] = r
    if s is not None:
        d["scale"] = s
    return d


def ease(a, b, n=4):
    """smoothstep intermediate keyframes between two (t, state) tuples (inclusive)."""
    (t0, s0), (t1, s1) = a, b
    out = []
    for i in range(n + 1):
        u = i / n
        e = u * u * (3 - 2 * u)
        st = {}
        for k in s0:
            st[k] = round(s0[k] + (s1.get(k, s0[k]) - s0[k]) * e, 3)
        out.append((int(round(t0 + (t1 - t0) * u)), st))
    return out


# ----------------------------------------------------------------- geometry helpers
def bez(p0, p1, p2, p3, n=9):
    pts = []
    for i in range(n + 1):
        u = i / n
        a = (1 - u) ** 3
        b = 3 * (1 - u) ** 2 * u
        c = 3 * (1 - u) * u ** 2
        d = u ** 3
        pts.append((round(a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], 1),
                    round(a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1], 1)))
    return pts


class P:
    """Path builder that also records a sampled polyline (for glow routes)."""

    def __init__(self, x, y):
        self.d = f"M {x:g} {y:g}"
        self.pts = [(x, y)]
        self.cur = (x, y)

    def C(self, x1, y1, x2, y2, x3, y3):
        s = bez(self.cur, (x1, y1), (x2, y2), (x3, y3))
        self.pts += s[1:]
        self.d += f" C {x1:g} {y1:g} {x2:g} {y2:g} {x3:g} {y3:g}"
        self.cur = (x3, y3)
        return self

    def L(self, x, y):
        self.pts.append((x, y))
        self.d += f" L {x:g} {y:g}"
        self.cur = (x, y)
        return self

    def M(self, x, y):
        self.d += f" M {x:g} {y:g}"
        self.cur = (x, y)
        self.pts.append((x, y))
        return self


def rr(x, y, w, h, r):
    """rounded-rect subpath string."""
    return (f"M {x+r:g} {y:g} H {x+w-r:g} Q {x+w:g} {y:g} {x+w:g} {y+r:g} V {y+h-r:g} "
            f"Q {x+w:g} {y+h:g} {x+w-r:g} {y+h:g} H {x+r:g} Q {x:g} {y+h:g} {x:g} {y+h-r:g} "
            f"V {y+r:g} Q {x:g} {y:g} {x+r:g} {y:g} Z")


# ----------------------------------------------------------------- layer constructors
def path(d, fill="none", stroke="none", sw=3):
    return {"type": "path", "d": d, "fill": fill, "stroke": stroke, "stroke_width": sw}


def rect(x, y, w, h, fill, stroke="none", sw=3, rx=12):
    return {"type": "rect", "x": x, "y": y, "width": w, "height": h, "rx": rx,
            "fill": fill, "stroke": stroke, "stroke_width": sw}


def circle(cx, cy, r, fill, stroke="none", sw=3):
    return {"type": "circle", "cx": cx, "cy": cy, "r": r, "fill": fill,
            "stroke": stroke, "stroke_width": sw}


def label(text, x, y, size=18, color=INK, anchor="middle", weight=700):
    return {"type": "label", "text": text, "x": x, "y": y, "size": size, "color": color,
            "anchor": anchor, "weight": weight}


def tube(d, w, colors=(GOLD_D, GOLD, GOLD_L)):
    """3 stacked stroke layers that read as a shaded tube (outline, body, sheen)."""
    o, b, s = colors
    return [path(d, "none", o, w + 3.2), path(d, "none", b, w), path(d, "none", s, max(1.2, w * 0.28))]


# ----------------------------------------------------------------- defs (gradients / filters)
DEFS = (
    '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#17383f"/><stop offset="1" stop-color="#0a1b21"/></linearGradient>'
    '<linearGradient id="bone" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#bfae88"/><stop offset=".42" stop-color="#f7f0dd"/><stop offset="1" stop-color="#a99870"/></linearGradient>'
    '<linearGradient id="boneV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7f0dd"/><stop offset="1" stop-color="#b3a37c"/></linearGradient>'
    '<linearGradient id="musc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ee7d70"/><stop offset="1" stop-color="#a73a3d"/></linearGradient>'
    '<linearGradient id="muscP" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a5662"/><stop offset="1" stop-color="#4a3440"/></linearGradient>'
    '<linearGradient id="skin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1cdb2"/><stop offset="1" stop-color="#d49c7c"/></linearGradient>'
    '<linearGradient id="skinF" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3d5a60"/><stop offset="1" stop-color="#27424a"/></linearGradient>'
    '<radialGradient id="glowR"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".4" stop-color="#ffe9a3" stop-opacity=".5"/><stop offset="1" stop-color="#ffe9a3" stop-opacity="0"/></radialGradient>'
    '<filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.2"/></filter>'
)

# ----------------------------------------------------------------- scene assembly
class Scene:
    def __init__(self):
        self.items = []      # (base_layer, keyframes)
        self.routes = {}     # name -> [[x,y],..]
        self.glows = []      # [route,t0,t1,color,width]
        self.dots = []       # [route,t0,t1,color,n,speed,r]
        self.rings = []      # [x,y,t0,dur,color,rmax]
        self.extra_defs = ""  # extra <linearGradient>/<radialGradient>/<filter>/<clipPath> markup, ids must be unique
        self.texts = []      # [text,x,y,size,color,anchor,t0,fade,dimAt,dimTo,weight]

    # -- layers
    def add(self, layer_or_list, kfs=None):
        if kfs is None:
            kfs = [(0, S(1))]
        if isinstance(layer_or_list, dict):
            layer_or_list = [layer_or_list]
        for l in layer_or_list:
            self.items.append((l, kfs))

    def appear(self, t, fade=600, dx=0, dy=0):
        return [(t, S(0, dx, dy)), (t + fade, S(1))]

    def dim(self, kfs, t, to=0.3, fade=600):
        last = kfs[-1]
        return kfs + [(t, last[1]), (t + fade, S(to, last[1]["x"], last[1]["y"]))]

    # -- custom-renderer data
    def route(self, name, p):
        self.routes[name] = [[round(a, 1), round(b, 1)] for a, b in (p.pts if isinstance(p, P) else p)]

    def glow(self, route, t0, t1, color=GOLD, width=5):
        self.glows.append([route, t0, t1, color, width])

    def flow(self, route, t0, t1, color=RED, n=6, speed=0.00035, r=3.2):
        self.dots.append([route, t0, t1, color, n, speed, r])

    def ring(self, x, y, t0, dur=900, color=GOLD, rmax=34):
        self.rings.append([x, y, t0, dur, color, rmax])

    def text(self, text, x, y, size=16, color=INK, anchor="middle", t0=0, fade=500, dim_at=-1, dim_to=0.3, weight=700):
        self.texts.append([text, x, y, size, color, anchor, t0, fade, dim_at, dim_to, weight])

    # -- build
    def _custom(self):
        js = (
            "function renderCustom(art,t,h){var R=%R%,G=%G%,D=%D%,X=%X%,K=%K%,c=h.clamp,s='<defs>%DEFS%</defs>';"
            "function Q(k,u){var a=R[k],L=[0],d=0,i,j=1;for(i=1;i<a.length;i++){d+=Math.hypot(a[i][0]-a[i-1][0],a[i][1]-a[i-1][1]);L.push(d)}"
            "var q=u*d;while(j<a.length-1&&L[j]<q)j++;var f=(q-L[j-1])/((L[j]-L[j-1])||1),x=a[j-1][0]+(a[j][0]-a[j-1][0])*f,y=a[j-1][1]+(a[j][1]-a[j-1][1])*f,p=a.slice(0,j);p.push([x,y]);return{x:x,y:y,p:p}}"
            "function PL(p,w,col,o,f){return'<polyline points=\"'+p.map(function(z){return z[0].toFixed(1)+','+z[1].toFixed(1)}).join(' ')+'\" fill=\"none\" stroke=\"'+col+'\" stroke-width=\"'+w+'\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\"'+o.toFixed(3)+'\"'+(f?' filter=\"url(#glow)\"':'')+'/>'}"
            "G.forEach(function(g){if(t<g[1])return;var u=c((t-g[1])/(g[2]-g[1]),0,1),r=Q(g[0],u),pu=.8+.2*Math.sin(t/170);"
            "s+=PL(r.p,g[4]*2.6,g[3],.3*pu,1)+PL(r.p,g[4],g[3],.95,0)+PL(r.p,Math.max(1.2,g[4]*.3),'#fffbe6',.9,0);"
            "if(u<1)s+='<circle cx=\"'+r.x.toFixed(1)+'\" cy=\"'+r.y.toFixed(1)+'\" r=\"15\" fill=\"url(#glowR)\"/><circle cx=\"'+r.x.toFixed(1)+'\" cy=\"'+r.y.toFixed(1)+'\" r=\"4.5\" fill=\"#fff\"/>'});"
            "D.forEach(function(g){if(t<g[1]||t>g[2])return;var m,e=c(Math.min((t-g[1])/400,(g[2]-t)/400),0,1);for(m=0;m<g[4];m++){var u=((m/g[4])+t*g[5])%1,r=Q(g[0],u);s+='<circle cx=\"'+r.x.toFixed(1)+'\" cy=\"'+r.y.toFixed(1)+'\" r=\"'+g[6]+'\" fill=\"'+g[3]+'\" opacity=\"'+(.9*e).toFixed(2)+'\"/>'}});"
            "K.forEach(function(a){if(t<a[2]||t>a[2]+a[3])return;var u=(t-a[2])/a[3];s+='<circle cx=\"'+a[0]+'\" cy=\"'+a[1]+'\" r=\"'+(6+u*(a[5]-6)).toFixed(1)+'\" fill=\"none\" stroke=\"'+a[4]+'\" stroke-width=\"'+(3.5*(1-u)+.5).toFixed(2)+'\" opacity=\"'+(1-u).toFixed(3)+'\"/>'});"
            "X.forEach(function(a){var o=c((t-a[6])/(a[7]||1),0,1);if(a[8]>=0)o*=1-(1-a[9])*c((t-a[8])/500,0,1);if(o>0)s+='<text x=\"'+a[1]+'\" y=\"'+a[2]+'\" font-size=\"'+a[3]+'\" fill=\"'+a[4]+'\" text-anchor=\"'+a[5]+'\" font-weight=\"'+a[10]+'\" opacity=\"'+o.toFixed(3)+'\">'+h.esc(a[0])+'</text>'});"
            "art.insertAdjacentHTML('beforeend',s)}"
        )
        j = lambda v: json.dumps(v, separators=(",", ":"), ensure_ascii=False)
        js = (js.replace("%R%", j(self.routes)).replace("%G%", j(self.glows))
                .replace("%D%", j(self.dots)).replace("%K%", j(self.rings)).replace("%X%", j(self.texts))
                .replace("%DEFS%", DEFS + self.extra_defs))
        return js

    def build(self, qid, takeaway):
        layers = []
        for base, kfs in self.items:
            for i, (t, st) in enumerate(kfs):
                if i + 1 < len(kfs):
                    t2, st2 = kfs[i + 1]
                    if t2 == t:
                        continue
                    layers.append(dict(base, start_ms=t, end_ms=t2, **{"from": st, "to": st2}))
                elif t < DUR:
                    layers.append(dict(base, start_ms=t, end_ms=DUR, **{"from": st, "to": st}))
        assert 1 <= len(layers) <= 80, (qid, "layers", len(layers))
        for l in layers:
            assert 0 <= l["start_ms"] <= l["end_ms"] <= DUR, (qid, l)
            if l["type"] == "path":
                assert len(l["d"]) <= 2000, (qid, "path too long", len(l["d"]))
        custom = self._custom()
        assert len(custom) <= 12000, (qid, "custom_renderer", len(custom))
        assert 0 < len(takeaway) <= 240
        return {"schema_version": 1, "qid": qid, "duration_ms": DUR, "takeaway": takeaway,
                "layers": layers, "custom_renderer": custom}


def backdrop(sc):
    sc.add(rect(0, 0, 640, 440, BG, "none", 3, 0))
