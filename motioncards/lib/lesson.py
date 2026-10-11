"""Image lessons: one illustration plus a voice, played as a landscape lesson below each MCQ.

A lesson is written as work/<batch>/lessons/<QID>.lesson.json (the image, the spoken lines, and which part of the
image each line shows). `build_lesson` turns it into an ordinary v2 scene plus its voice track, so the existing
package, validate, bot upload, hosting and offline download all work unchanged:

- the image becomes an AVIF asset (about half the size of WebP at the same quality);
- every line is spoken with the chosen engine (voiceover/voiceover.py: kokoro, elevenlabs or breeze) and joined into
  one Opus track, with one cue per line;
- the scene script moves a camera over the image (eased zoom and pan per shot, a slow push-in while a shot holds),
  dims everything but the part being explained (spotlight), pulses a ring on it, and shows the line as a caption with
  the speaker's name. The voice is the master clock in the app, so picture and sound cannot drift.
"""
from __future__ import annotations
import base64, json, math, subprocess, sys
from pathlib import Path

W, H = 960, 540                       # landscape stage (16:9)
MAX_IMAGE_BYTES = 600 * 1024          # engine_v2 asset limit
LESSON_KEYS = {"qid", "image", "takeaway", "engine", "voices", "names", "tempo", "gap_ms", "shots", "lines", "lang"}
LINE_KEYS = {"who", "text", "say", "dir", "shot", "tag"}


def _fail(msg: str): raise ValueError("lesson: " + msg)


def check_lesson(spec: dict, qid: str) -> dict:
    """Validate a lesson spec and fill defaults. Errors name the exact field."""
    if not isinstance(spec, dict): _fail("must be a JSON object")
    extra = set(spec) - LESSON_KEYS
    if extra: _fail("unknown fields " + ", ".join(sorted(extra)))
    if spec.get("qid") != qid: _fail(f"qid must be {qid}")
    for k in ("image", "takeaway"):
        if not isinstance(spec.get(k), str) or not spec[k].strip(): _fail(f"{k} is required")
    if len(spec["takeaway"]) > 240: _fail("takeaway is longer than 240 characters")
    shots = spec.get("shots")
    if not isinstance(shots, list) or not shots: _fail("shots must be a non-empty list")
    for i, s in enumerate(shots):
        if not isinstance(s, dict) or not all(isinstance(s.get(k), (int, float)) for k in ("x", "y", "z")): _fail(f"shots[{i}] needs x, y, z")
        if not 1 <= s["z"] <= 4: _fail(f"shots[{i}].z must be 1..4")
        sp = s.get("spot")
        if sp is not None and not (isinstance(sp, list) and len(sp) == 3 and all(isinstance(v, (int, float)) for v in sp)): _fail(f"shots[{i}].spot must be [x, y, r]")
    lines = spec.get("lines")
    if not isinstance(lines, list) or not 1 <= len(lines) <= 64: _fail("lines must be a list of 1..64")
    for i, ln in enumerate(lines):
        if not isinstance(ln, dict): _fail(f"lines[{i}] must be an object")
        extra = set(ln) - LINE_KEYS
        if extra: _fail(f"lines[{i}]: unknown fields " + ", ".join(sorted(extra)))
        if not isinstance(ln.get("text"), str) or not ln["text"].strip() or len(ln["text"]) > 200: _fail(f"lines[{i}].text must be 1..200 characters")
        if not isinstance(ln.get("shot"), int) or not 0 <= ln["shot"] < len(shots): _fail(f"lines[{i}].shot must index shots")
    out = {"engine": "kokoro", "voices": {}, "names": {}, "tempo": 1.0, "gap_ms": 450, "lang": "en-us", **spec}
    if not 0.8 <= float(out["tempo"]) <= 1.25: _fail("tempo must be 0.8..1.25")
    return out


def encode_avif(src: Path, crf: int = 30, max_width: int = 1600) -> tuple[bytes, int, int]:
    """Image -> AVIF bytes (4:4:4 keeps red text and fine lines sharp). Raises the CRF until it fits the asset limit."""
    w, h = _image_size(src)
    scale = min(1.0, max_width / w); w2, h2 = round(w * scale / 2) * 2, round(h * scale / 2) * 2
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:                       # the AVIF muxer needs a seekable file, not a pipe
        out = Path(tmp) / "img.avif"
        for c in range(crf, 52, 3):
            r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vf", f"scale={w2}:{h2}:flags=lanczos", "-c:v", "libaom-av1",
                                "-still-picture", "1", "-crf", str(c), "-cpu-used", "3", "-pix_fmt", "yuv444p", str(out)], capture_output=True)
            if r.returncode: _fail("ffmpeg could not encode the image to AVIF: " + r.stderr.decode()[-300:])
            if out.stat().st_size <= MAX_IMAGE_BYTES: return out.read_bytes(), w2, h2
    _fail("image does not fit 600 KB even at low quality; use a smaller image")


def voice_tool():
    root = Path(__file__).resolve().parents[2] / "voiceover"
    if str(root) not in sys.path: sys.path.insert(0, str(root))
    import voiceover as V
    return V


def build_voice(spec: dict, voice_dir: Path, qid: str) -> dict:
    """Speak every line, join them with gaps into one Opus track, write <QID>.opus and <QID>.track.json."""
    import numpy as np
    V = voice_tool(); lex = V.load_lexicon(); engine = spec["engine"]
    if engine not in V.ENGINES: _fail(f"engine must be one of {', '.join(V.ENGINES)}")
    lead, gap, tail = 500, int(spec["gap_ms"]), 600
    pcm = [np.zeros(V.SR * lead // 1000, np.float32)]; t = lead; cues = []
    for i, ln in enumerate(spec["lines"]):
        voice = spec["voices"].get(ln.get("who", ""), V.ENGINES[engine]["voice"])
        clip = V.speak(ln.get("say") or ln["text"], voice, spec["lang"], float(spec["tempo"]), lex, engine, ln.get("dir"))
        ms = len(clip) * 1000 / V.SR
        cues.append({"t_ms": round(t), "end_ms": round(t + ms), "text": ln["text"]})
        pcm += [clip, np.zeros(V.SR * gap // 1000, np.float32)]; t += ms + gap
    pcm[-1] = np.zeros(V.SR * tail // 1000, np.float32)                 # the last gap becomes the closing tail
    track = np.concatenate(pcm); voice_dir.mkdir(parents=True, exist_ok=True); out = voice_dir / f"{qid}.opus"
    Q = V.QUALITY[V.ENGINE_QUALITY[engine]]; V.encode_opus(track, out, Q["bitrate"], Q["app"], Q["frame"])
    info = {"qid": qid, "file": out.name, "mime": "audio/ogg; codecs=opus", "bytes": out.stat().st_size, "sha256": V.sha256(out),
            "track_ms": round(len(track) * 1000 / V.SR), "engine": V.ENGINES[engine]["label"], "bitrate": Q["bitrate"], "cues": cues}
    (voice_dir / f"{qid}.track.json").write_text(json.dumps(info, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return info


SCRIPT = r"""// Image lesson player: camera, spotlight, pulse ring and captions, all a pure function of t (the voice clock in the app).
const L = __LESSON__;
const MOVE = 1500, LEAD = 350;
const ease = p => p < .5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3) / 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, p) => a + (b - a) * p;
const EV = {"(laugh)": "laughs", "(sigh)": "sighs", "(cough)": "coughs", "(clears throat)": "clears throat"};
let el = {}, runs = [], base = 1;
function setup(api) {
  base = Math.max(api.W / L.iw, api.H / L.ih);                  // the image covers the stage at zoom 1
  el.img = api.$("#lesson-img"); el.spot = api.$("#lesson-spot"); el.spotG = api.$("#lesson-spot-g");
  el.ring = api.$("#lesson-ring"); el.cap = api.$("#lesson-cap"); el.capBox = api.$("#lesson-cap-box"); el.tag = api.$("#lesson-tag");
  el.tagText = api.$("#lesson-tag-text");
  L.cues.forEach((c, i) => { if (!runs.length || runs[runs.length - 1].shot !== c.shot) runs.push({shot: c.shot, start: i ? c.t - LEAD : 0}); });
  runs.forEach((r, i) => r.end = i + 1 < runs.length ? runs[i + 1].start : api.D);
  // pre-wrap every caption into lines that fit the caption width
  const probe = api.el("text", {"font-size": 34, "font-weight": 700, "font-family": "system-ui, sans-serif", opacity: 0}, api.svg);
  const fits = s => { probe.textContent = s; return probe.getComputedTextLength() <= api.W * 0.88; };
  L.cues.forEach(c => {
    let words = c.text; for (const e in EV) words = words.split(e).join(" " + EV[e] + " ");
    const name = c.who ? (L.names[c.who] || c.who) + "  " : "", out = []; let line = name;
    for (const w of words.split(/\s+/).filter(Boolean)) { const tryL = line ? line + (line.endsWith("  ") ? "" : " ") + w : w; if (fits(tryL) || !line.trim()) line = tryL; else { out.push(line); line = w; } }
    out.push(line); c.lines = out.slice(0, 3); c.nameLen = name.length;
  });
  probe.remove();
}
function camera(t) {
  let k = 0; for (let j = 0; j < runs.length; j++) if (t >= runs[j].start) k = j;
  const r = runs[k], s = L.shots[r.shot], a = L.shots[k ? runs[k - 1].shot : r.shot];
  const p = k ? ease(clamp((t - r.start) / MOVE, 0, 1)) : 1, hold = clamp((t - r.start - MOVE) / Math.max(100, r.end - r.start - MOVE), 0, 1);
  let z = Math.exp(lerp(Math.log(a.z), Math.log(s.z), p)) * (1 + 0.04 * hold);
  if (k === 0) z = lerp(1.1, 1, ease(clamp(t / 2200, 0, 1))) * (1 + 0.04 * hold);
  return {x: lerp(a.x, s.x, p), y: lerp(a.y, s.y, p), z, s, p, r};
}
function render(t, api) {
  const c = camera(t), k = base * c.z, sw = L.iw * k, sh = L.ih * k;
  const ox = clamp(api.W / 2 - c.x * k, api.W - sw, 0), oy = clamp(api.H / 2 - c.y * k, api.H - sh, 0);
  api.set(el.img, {transform: `translate(${ox.toFixed(2)} ${oy.toFixed(2)}) scale(${k.toFixed(5)})`});
  // spotlight on the part being explained; off while the camera travels
  const sp = c.s.spot, on = sp && c.p >= 1 ? clamp((t - c.r.start - MOVE) / 600, 0, 1) : 0;
  if (sp) {
    const sx = ox + sp[0] * k, sy = oy + sp[1] * k, rr = sp[2] * k;
    api.set(el.spotG, {cx: sx.toFixed(1), cy: sy.toFixed(1), r: (rr * 1.35).toFixed(1)});
    const rp = clamp((t - c.r.start - MOVE) / 1100, 0, 1);
    api.set(el.ring, {cx: sx.toFixed(1), cy: sy.toFixed(1), r: (rr * (0.25 + 0.75 * rp)).toFixed(1), opacity: (rp > 0 && rp < 1 ? Math.sin(Math.PI * rp) * 0.9 : 0).toFixed(3)});
  } else api.set(el.ring, {opacity: 0});
  api.set(el.spot, {opacity: (0.8 * on).toFixed(3)});
  // caption of the line being spoken
  let q = null; for (const cue of L.cues) if (t >= cue.t - 100 && t <= cue.e + 400) q = cue;
  if (el.capFor !== q) {
    el.capFor = q; el.cap.textContent = "";
    if (q) q.lines.forEach((ln, i) => {
      const ts = api.el("tspan", {x: api.W / 2, dy: i ? 42 : 0}, el.cap);
      if (i === 0 && q.nameLen) { api.el("tspan", {fill: L.colors[q.who] || "#ffd27a"}, ts).textContent = ln.slice(0, q.nameLen); api.el("tspan", {}, ts).textContent = ln.slice(q.nameLen); }
      else ts.textContent = ln;
    });
    const n = q ? q.lines.length : 0, h = 26 + 42 * n;
    api.set(el.cap, {y: api.H - 20 - h + 47}); api.set(el.capBox, {y: api.H - 20 - h, height: h, opacity: n ? 0.78 : 0});
    const tg = q && q.tag || ""; el.tagText.textContent = tg; api.set(el.tag, {opacity: tg ? 1 : 0});
    if (tg) api.set(api.$("#lesson-tag-box"), {width: el.tagText.getComputedTextLength() + 30});
  }
}"""

SPEAKER_COLORS = ["#8fd3ff", "#ffb3d1", "#b8f28c", "#ffd27a"]


def build_scene(spec: dict, qid: str, avif: bytes, iw: int, ih: int, track: dict) -> dict:
    duration = int(math.ceil((track["track_ms"] + 300) / 100) * 100)
    who = list(dict.fromkeys(ln.get("who") for ln in spec["lines"] if ln.get("who")))
    cues = [{"t": c["t_ms"], "e": c["end_ms"], "text": c["text"], "who": ln.get("who", ""), "shot": ln["shot"], "tag": ln.get("tag", "")}
            for c, ln in zip(track["cues"], spec["lines"])]
    data = {"iw": iw, "ih": ih, "shots": spec["shots"], "cues": cues, "names": spec["names"],
            "colors": {w: SPEAKER_COLORS[i % len(SPEAKER_COLORS)] for i, w in enumerate(who)}}
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg"><defs>'
           f'<radialGradient id="lesson-spot-g" gradientUnits="userSpaceOnUse" cx="480" cy="270" r="200">'
           f'<stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#0c0906" stop-opacity=".58"/></radialGradient>'
           f'<radialGradient id="lesson-vig" cx=".5" cy=".5" r=".75"><stop offset=".62" stop-color="#000" stop-opacity="0"/>'
           f'<stop offset="1" stop-color="#000" stop-opacity=".42"/></radialGradient></defs>'
           f'<image id="lesson-img" href="asset:img" x="0" y="0" width="{iw}" height="{ih}"/>'
           f'<rect id="lesson-spot" x="0" y="0" width="{W}" height="{H}" fill="url(#lesson-spot-g)" opacity="0"/>'
           f'<rect x="0" y="0" width="{W}" height="{H}" fill="url(#lesson-vig)"/>'
           f'<circle id="lesson-ring" cx="0" cy="0" r="10" fill="none" stroke="#d9a441" stroke-width="3" opacity="0"/>'
           f'<g id="lesson-tag" opacity="0"><rect id="lesson-tag-box" x="22" y="20" width="200" height="40" rx="20" fill="#d9a441"/>'
           f'<text id="lesson-tag-text" x="36" y="47" font-size="22" font-weight="750" fill="#1f1a14" font-family="system-ui, sans-serif"></text></g>'
           f'<rect id="lesson-cap-box" x="{W*0.05:.0f}" y="440" width="{W*0.9:.0f}" height="60" rx="14" fill="#140f0a" opacity="0"/>'
           f'<text id="lesson-cap" x="{W/2:.0f}" y="480" text-anchor="middle" font-size="34" font-weight="700" fill="#fff" '
           f'font-family="system-ui, sans-serif"></text></svg>')
    return {"schema_version": 2, "qid": qid, "duration_ms": duration, "takeaway": spec["takeaway"],
            "stage": {"width": W, "height": H, "background": "#000000"},
            "assets": {"img": "data:image/avif;base64," + base64.b64encode(avif).decode("ascii")},
            "svg": svg, "script": SCRIPT.replace("__LESSON__", json.dumps(data, ensure_ascii=False, separators=(",", ":")))}


def build_lesson(workspace: Path, qid: str) -> dict:
    """lessons/<QID>.lesson.json -> scenes/<QID>.scene.json + voice/<QID>.opus/.track.json; selection.json gets the real length."""
    src = workspace / "lessons" / f"{qid}.lesson.json"
    spec = check_lesson(json.loads(src.read_text(encoding="utf-8")), qid)
    img = (src.parent / spec["image"]).resolve()
    if not img.is_file(): _fail(f"image not found: {img}")
    avif, iw, ih = encode_avif(img)
    sx = iw / _image_size(img)[0]                                        # shots are written in the original image's pixels
    spec["shots"] = [{**s, "x": s["x"] * sx, "y": s["y"] * sx, **({"spot": [v * sx for v in s["spot"]]} if s.get("spot") else {})} for s in spec["shots"]]
    track = build_voice(spec, workspace / "voice", qid)
    scene = build_scene(spec, qid, avif, iw, ih, track)
    (workspace / "scenes" / f"{qid}.scene.json").write_text(json.dumps(scene, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    sel_path = workspace / "selection.json"; sel = json.loads(sel_path.read_text(encoding="utf-8"))
    for row in sel["selected"]:
        if row["qid"] == qid: row["duration_ms"] = scene["duration_ms"]
    sel_path.write_text(json.dumps(sel, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"qid": qid, "duration_ms": scene["duration_ms"], "image_bytes": len(avif), "voice_bytes": track["bytes"], "lines": len(track["cues"])}


def _image_size(p: Path) -> tuple[int, int]:
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", str(p)],
                       capture_output=True, text=True)
    try: w, h = (int(v) for v in r.stdout.strip().split(",")[:2])
    except ValueError: _fail(f"cannot read the image size of {p.name}")
    return w, h
