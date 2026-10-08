#!/usr/bin/env python3
"""Build the 6 MotionCards scenes for MRCS Part A chapter 15 (Respiratory system).

Re-runnable: writes each scene, then adds the recipes/style kit and imports library art with the CLI.
Usage: python3 work/MRCS-CH15/build_scenes.py [--grid]
"""
import json, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCENES = Path(__file__).resolve().parent / "scenes"
GRID = "--grid" in sys.argv
D = 8000
B1, B2, B3 = (0, 2700), (2700, 5200), (5200, D)   # the three voice beats
BG = "#f7fafb"


def title(text):
    return {"type": "text", "text": text, "x": 320, "y": 42, "size": 27, "weight": 800,
            "max_width": 590, "fit": True, "fixed": True}


def caption(n, text, beat, color="@ink", edge="@line"):
    a, b = beat
    lay = {"type": "text", "text": f"{n} · {text}", "x": 320, "y": 92, "size": 20, "weight": 700, "color": color,
           "max_width": 580, "fit": True, "box": {"fill": "#ffffff", "stroke": edge}, "fixed": True,
           "show": [a, b], "enter": "fade" if n == 1 else "type"}
    if b < D:
        lay["exit"] = "fade"
    return lay


def scene(qid, takeaway, layers, script):
    if GRID:
        script = script.replace("function setup(api) {", "function setup(api) {\n  R.grid(api);", 1)
    script = 'const BLUE = "#2f5f9e", RED = "#c0392b", GREEN = "#1f7a6d", AMBER = "#9a6b00", INK = "#16323a";\n' + script
    return {"schema_version": 2, "qid": qid, "duration_ms": D, "takeaway": takeaway,
            "stage": {"width": 640, "height": 560, "background": BG},
            "layers": layers, "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>", "script": script}


CARDS, ART = {}, {}
BLUE, RED, GREEN, AMBER, INK = "#2f5f9e", "#c0392b", "#1f7a6d", "#9a6b00", "#16323a"

# ---------------------------------------------------------------- Q000009412 face mask FiO2 and inspiratory flow
CARDS["Q000009412"] = scene(
    "Q000009412",
    "A face mask supplies a fixed oxygen flow; the rest of each breath is entrained room air, so the inspiratory flow rate determines the inspired oxygen percentage.",
    [title("Face-mask oxygen: what sets the FiO₂?"),
     caption(1, "Mask oxygen: fifteen litres a minute", B1, BLUE, "#b9cbe8"),
     caption(2, "Faster breaths entrain room air", B2, "#58707c", "#cfd8dc"),
     caption(3, "Inspiratory flow rate decides it", B3, "@good", "#b9e2dc")],
    r"""
// Simplified mixing model: the mask gives 15 L/min of 100% O2; any inspiratory flow above that is room air (21%).
const O2 = 15, F0 = 25, F1 = 60, T0 = 2900, T1 = 4700;
const CX = 430, COL = {x: 400, y: 190, w: 72, h: 250};
const fio2 = (F) => (O2 + (F - O2) * 0.21) / F;
let E = {};
function flowAt(t, api) { return F0 + (F1 - F0) * api.seg(t, T0, T1, "ease_in_out"); }
function setup(api) {
  const P = R.layer(api, "#lungs");
  E.lungs = R.wrap(api, api.$("#lungs"));
  E.o2Path = api.el("path", {d: "M 60 168 C 100 190 140 210 150 262", fill: "none", stroke: "none"}, P);
  E.airPath = api.el("path", {d: "M 280 168 C 230 190 170 210 158 262", fill: "none", stroke: "none"}, P);
  E.o2Dots = [], E.airDots = [];
  for (let i = 0; i < 6; i++) E.o2Dots.push(api.el("circle", {r: 5, fill: "#4f83cc", opacity: 0}, P));
  for (let i = 0; i < 14; i++) E.airDots.push(api.el("circle", {r: 5, fill: "#9aa9b2", opacity: 0}, P));
  E.o2Tag = R.chip(api, P, "O₂ from mask: 15 L/min", 40, 146, BLUE, {size: 15});
  E.airTag = R.chip(api, P, "Room air: 21% O₂", 236, 146, "#58707c", {size: 15});
  // breath column: what one breath is made of
  E.colBg = api.el("rect", {x: COL.x, y: COL.y, width: COL.w, height: COL.h, rx: 12, fill: "#e9eef1"}, P);
  E.colAir = api.el("rect", {x: COL.x, width: COL.w, rx: 12, fill: "#9aa9b2"}, P);
  E.colO2 = api.el("rect", {x: COL.x, width: COL.w, rx: 12, fill: "#4f83cc"}, P);
  E.colTag = R.text(api, P, "Each breath", COL.x + COL.w / 2, COL.y - 14, {anchor: "middle", size: 15, color: "#58707c"});
  E.flow = R.text(api, P, "", 436, 470, {anchor: "middle", size: 17, color: INK});
  E.fio = R.text(api, P, "", 496, 330, {size: 30, color: BLUE});
  E.fioTag = R.text(api, P, "inspired O₂", 496, 354, {size: 14, color: "#58707c", weight: 600});
  E.result = R.chip(api, P, "Faster flow → lower inspired O₂", 320, 506, GREEN, {anchor: "middle", size: 18});
}
function stream(dots, path, t, period, on, api) {
  dots.forEach((c, i) => { const f = ((t / period) + i / dots.length) % 1, q = api.pointAt(path, f);
    api.set(c, {cx: q.x.toFixed(1), cy: q.y.toFixed(1), opacity: (on * Math.sin(f * Math.PI)).toFixed(3)}); });
}
function render(t, api) {
  const F = flowAt(t, api), share = O2 / F;
  R.fade(api, E.o2Tag, t, 0, 300);
  R.fade(api, E.airTag, t, 2800, 3200);
  stream(E.o2Dots, E.o2Path, t, 1100, 1, api);
  // room-air stream thickens as the patient breathes harder
  const airOn = Math.min(1, (F - O2) / (F1 - O2) * 1.4);
  stream(E.airDots.slice(0, Math.round(4 + 10 * (F - F0) / (F1 - F0))), E.airPath, t, 1100 * F0 / F, airOn, api);
  E.airDots.slice(Math.round(4 + 10 * (F - F0) / (F1 - F0))).forEach((c) => api.set(c, {opacity: 0}));
  const hO2 = COL.h * share;
  api.set(E.colO2, {y: (COL.y + COL.h - hO2).toFixed(1), height: hO2.toFixed(1)});
  api.set(E.colAir, {y: COL.y, height: COL.h});
  E.flow.firstChild.textContent = "Breathing in " + Math.round(F) + " L/min";
  E.fio.firstChild.textContent = "≈ " + Math.round(fio2(F) * 100) + "%";
  R.scaleAbout(api, E.lungs, 1 + 0.03 * Math.sin(t / (520 * F0 / F)));
  R.fade(api, E.result, t, 5400, 5900);
}
""")
ART["Q000009412"] = [("lib:lung", "lungs", "40,250,230,240", [])]

# ---------------------------------------------------------------- Q000009413 CO2 carried as bicarbonate
CARDS["Q000009413"] = scene(
    "Q000009413",
    "Most CO₂ in venous blood (about 60%) is carried as bicarbonate, made in red cells by carbonic anhydrase.",
    [title("How venous blood carries CO₂"),
     caption(1, "Tissues release carbon dioxide", B1, "#58707c", "#cfd8dc"),
     caption(2, "Red cells make bicarbonate", B2, RED, "#f0c4b8"),
     caption(3, "Sixty percent travels as bicarbonate", B3, "@good", "#b9e2dc")],
    r"""
const SHARE = [["Bicarbonate", 60, "#1f7a6d"], ["Carbamino", 30, "#4f83cc"], ["Dissolved", 10, "#9aa9b2"]];
const BX = 60, BY = 462, BW = 520;
let E = {};
function setup(api) {
  const P = R.layer(api, "#rbc");
  E.rbc = R.wrap(api, api.$("#rbc"));
  E.tissue = api.el("g", {}, P);
  api.el("rect", {x: 26, y: 180, width: 100, height: 210, rx: 18, fill: "url(#kit-tissue)", stroke: "#b5616b", "stroke-width": 2, filter: "url(#kit-volume-sm)"}, E.tissue);
  R.text(api, E.tissue, "Tissue", 76, 410, {anchor: "middle", size: 16, color: "#9a3b2e"});
  R.text(api, P, "Plasma", 566, 410, {anchor: "middle", size: 16, color: "#58707c"});
  const rnd = api.random(5);
  E.co2 = []; E.hco3 = [];
  for (let i = 0; i < 7; i++) { const g = api.el("g", {opacity: 0}, P); api.el("circle", {r: 13, fill: "#eceff1", stroke: "#78909c", "stroke-width": 1.5}, g);
    const tx = R.text(api, g, "CO₂", 0, 4, {anchor: "middle", size: 10, color: "#455a64", halo: false}); g.y0 = 210 + i * 26; g.d = i * 220; E.co2.push(g); }
  for (let i = 0; i < 6; i++) { const g = api.el("g", {opacity: 0}, P); api.el("circle", {r: 15, fill: "#e0f2ef", stroke: "#1f7a6d", "stroke-width": 1.5}, g);
    R.text(api, g, "HCO₃⁻", 0, 4, {anchor: "middle", size: 9, color: "#1f7a6d", halo: false}); g.y0 = 222 + i * 30; g.d = i * 230; E.hco3.push(g); }
  E.eq = R.chip(api, P, "CO₂ + H₂O → H₂CO₃ → H⁺ + HCO₃⁻", 320, 300, RED, {anchor: "middle", size: 16});
  E.ca = R.text(api, P, "carbonic anhydrase", 320, 336, {anchor: "middle", size: 14, color: "#9a3b2e", weight: 600});
  // share bar
  E.bar = api.el("g", {opacity: 0}, P);
  let x = BX;
  E.segs = SHARE.map(([name, pc, c]) => { const w = BW * pc / 100, r = api.el("rect", {x, y: BY, width: 0, height: 30, fill: c}, E.bar);
    const lab = pc > 20 ? R.text(api, E.bar, `${name} ${pc}%`, x + w / 2, BY + 54, {anchor: "middle", size: 16, color: c})
      : R.text(api, E.bar, `${name} ${pc}%`, x + w, BY + 76, {anchor: "end", size: 14, color: "#58707c"});
    const s = {r, x, w, lab}; x += w; return s; });
}
function render(t, api) {
  // 1 · CO2 leaves the tissue and enters the red cell
  E.co2.forEach((g) => { const f = ((t + g.d) % 1600) / 1600, on = 1 - api.seg(t, 4800, 5400);
    const x = 126 + 130 * f, y = g.y0 + (290 - g.y0) * f * 0.6;
    api.set(g, {transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`, opacity: (on * Math.sin(f * Math.PI)).toFixed(3)}); });
  // 2 · inside the cell: the reaction, then bicarbonate leaves to the plasma
  R.fade(api, E.eq, t, 2800, 3200);
  R.fade(api, E.ca, t, 3100, 3500);
  E.hco3.forEach((g) => { const on = api.seg(t, 3300, 3700), f = ((t + g.d) % 1400) / 1400;
    const x = 400 + 140 * f, y = 290 + (g.y0 - 290) * f;
    api.set(g, {transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`, opacity: (on * Math.sin(f * Math.PI)).toFixed(3)}); });
  // 3 · the shares
  R.fade(api, E.bar, t, 5200, 5500);
  E.segs.forEach((s, i) => { const k = api.seg(t, 5300 + i * 300, 6100 + i * 300, "ease_out"); api.set(s.r, {width: (s.w * k).toFixed(1)}); api.set(s.lab, {opacity: k}); });
}
""")
ART["Q000009413"] = [("lib:red-cell", "rbc", "180,170,280,260", [])]

# ---------------------------------------------------------------- Q000009414 surfactant is mainly lipid
CARDS["Q000009414"] = scene(
    "Q000009414",
    "Pulmonary surfactant is made by type 2 alveolar cells and is mainly lipid, chiefly dipalmitoylphosphatidylcholine (DPPC).",
    [title("Pulmonary surfactant: what is it made of?"),
     caption(1, "Type two cells line the alveolus", B1, "#9a3b2e", "#f0c4b8"),
     caption(2, "They secrete surfactant", B2, AMBER, "#f1dfa6"),
     caption(3, "Surfactant is mainly lipid", B3, "@good", "#b9e2dc")],
    r"""
const CX = 320, CY = 290, RA = 130, NM = 26;
let E = {};
function setup(api) {
  const P = api.svg;
  // alveolar wall, fluid lining and air space
  api.el("circle", {cx: CX, cy: CY, r: RA + 26, fill: "url(#kit-lung)", filter: "url(#kit-volume)"}, P);
  api.el("circle", {cx: CX, cy: CY, r: RA + 2, fill: "#d7ecf7"}, P);
  E.air = api.el("circle", {cx: CX, cy: CY, r: RA - 8, fill: "#f4fbff"}, P);
  R.text(api, P, "Alveolar air", CX, CY - 20, {anchor: "middle", size: 17, color: "#4f83cc"});
  // type 2 cell bulging into the alveolus, with lamellar bodies
  E.cell = api.el("g", {}, P);
  api.el("ellipse", {cx: CX, cy: CY + RA - 6, rx: 54, ry: 34, fill: "url(#kit-tissue)", stroke: "#9a3b2e", "stroke-width": 2, filter: "url(#kit-volume-sm)"}, E.cell);
  api.el("circle", {cx: CX, cy: CY + RA + 4, r: 11, fill: "#6a4c93"}, E.cell);
  E.lam = [[-30, -10], [26, -12], [-10, -22], [36, 2]].map(([dx, dy]) => api.el("circle", {cx: CX + dx, cy: CY + RA + dy, r: 7, fill: "#ffe08a", stroke: "#b8860b", "stroke-width": 1.5}, E.cell));
  E.cellTag = R.callout(api, P, "Type 2 alveolar cell", 486, 400, "#9a3b2e", [CX + 50, CY + RA - 4]);
  // surfactant molecules spreading round the inner surface (head out to the air, two tails)
  E.mol = [];
  for (let i = 0; i < NM; i++) {
    const a = Math.PI / 2 + (i + 0.5) * 2 * Math.PI / NM, g = api.el("g", {opacity: 0}, P);
    api.el("path", {d: "M -3 4 L -3 18 M 3 4 L 3 18", stroke: "#b8860b", "stroke-width": 2, "stroke-linecap": "round"}, g);
    api.el("circle", {cx: 0, cy: 0, r: 5.5, fill: "#ffcc4d", stroke: "#9a6b00", "stroke-width": 1.2}, g);
    g.a = a; g.order = Math.min(i, NM - 1 - i); E.mol.push(g);
  }
  E.dppc = R.callout(api, P, "DPPC: a phospholipid", 40, 200, AMBER, [CX - RA + 18, CY - 40]);
  E.bar = api.el("g", {opacity: 0}, P);
  E.lip = api.el("rect", {x: 60, y: 500, width: 0, height: 24, rx: 4, fill: "#e0a800"}, E.bar);
  E.pro = api.el("rect", {x: 60, y: 500, width: 0, height: 24, rx: 4, fill: "#8aa0ad"}, E.bar);
  E.lipT = R.text(api, E.bar, "Lipid ≈ 90%", 70, 492, {size: 16, color: AMBER});
  E.proT = R.text(api, E.bar, "Protein ≈ 10%", 580, 492, {anchor: "end", size: 14, color: "#58707c"});
}
function render(t, api) {
  R.fade(api, E.cellTag, t, 300, 800);
  // 2 · lamellar bodies swell, then molecules spread out from the cell along the surface
  E.lam.forEach((c, i) => api.set(c, {r: (7 + 2 * Math.sin(t / 180 + i)).toFixed(1)}));
  E.mol.forEach((g) => {
    const on = api.seg(t, 2900 + g.order * 150, 3300 + g.order * 150, "back_out");
    const r = RA - 14, a = g.a;
    api.set(g, {opacity: on, transform: `translate(${(CX + Math.cos(a) * r).toFixed(1)} ${(CY + Math.sin(a) * r).toFixed(1)}) rotate(${(a * 180 / Math.PI + 90).toFixed(1)}) scale(${(0.4 + 0.6 * on).toFixed(2)})`});
  });
  // 3 · composition
  R.fade(api, E.dppc, t, 5300, 5800);
  R.fade(api, E.bar, t, 5500, 5800);
  const k = api.seg(t, 5600, 6600, "ease_out");
  api.set(E.lip, {width: (468 * k).toFixed(1)});
  api.set(E.pro, {x: (60 + 468 * k).toFixed(1), width: (52 * k).toFixed(1)});
}
""")

# ---------------------------------------------------------------- Q000009415 massive transfusion, low 2,3-DPG, left shift
CARDS["Q000009415"] = scene(
    "Q000009415",
    "Stored (transfused) blood is low in 2,3-DPG: the O₂–Hb curve shifts left, Hb affinity for O₂ rises and less O₂ is released to the tissues.",
    [title("Massive transfusion: oxygen stays on Hb"),
     caption(1, "Stored blood lacks 2,3-DPG", B1, RED, "#f0c4b8"),
     caption(2, "The curve shifts left", B2, BLUE, "#b9cbe8"),
     caption(3, "Haemoglobin clings to its oxygen", B3, "@good", "#b9e2dc")],
    r"""
// O2–Hb dissociation curve from the Hill equation; low 2,3-DPG lowers P50 (left shift). Illustrative P50 values.
const N = 2.7, P50N = 26.8, P50L = 19, TISSUE = 40;
const X0 = 96, X1 = 590, Y0 = 470, Y1 = 170;
const sx = (p) => X0 + (X1 - X0) * p / 100, sy = (s) => Y0 - (Y0 - Y1) * s;
const sat = (p, p50) => p <= 0 ? 0 : Math.pow(p, N) / (Math.pow(p50, N) + Math.pow(p, N));
const curve = (p50) => { let d = ""; for (let p = 0; p <= 100; p += 2) d += (p ? " L " : "M ") + sx(p).toFixed(1) + " " + sy(sat(p, p50)).toFixed(1); return d; };
let E = {};
function setup(api) {
  const P = R.layer(api, "#bag");
  E.bag = R.wrap(api, api.$("#bag"));
  const g = api.el("g", {}, P);
  for (let p = 0; p <= 100; p += 20) { api.el("path", {d: `M ${sx(p)} ${Y0} V ${Y1}`, stroke: "#e3e9ec", "stroke-width": 1}, g); R.text(api, g, String(p), sx(p), Y0 + 22, {anchor: "middle", size: 13, color: "#58707c", weight: 600}); }
  for (let s = 0; s <= 1.001; s += 0.25) { api.el("path", {d: `M ${X0} ${sy(s)} H ${X1}`, stroke: "#e3e9ec", "stroke-width": 1}, g); R.text(api, g, String(Math.round(s * 100)), X0 - 10, sy(s) + 5, {anchor: "end", size: 13, color: "#58707c", weight: 600}); }
  api.el("path", {d: `M ${X0} ${Y1} V ${Y0} H ${X1}`, stroke: "#58707c", "stroke-width": 2, fill: "none"}, g);
  R.text(api, g, "PO₂ (mmHg)", (X0 + X1) / 2, Y0 + 44, {anchor: "middle", size: 14, color: "#58707c"});
  R.text(api, g, "Sat %", X0 - 50, Y1 - 14, {size: 14, color: "#58707c"});
  E.tissue = api.el("path", {d: `M ${sx(TISSUE)} ${Y0} V ${Y1}`, stroke: BLUE, "stroke-width": 2.5, "stroke-dasharray": "3 6", "stroke-linecap": "round"}, P);
  E.tTag = R.text(api, P, "Tissue PO₂", sx(TISSUE) + 8, Y0 - 12, {size: 14, color: BLUE});
  E.norm = api.el("path", {d: curve(P50N), fill: "none", stroke: "#2a9d8f", "stroke-width": 5, "stroke-linecap": "round"}, P);
  E.left = api.el("path", {d: curve(P50N), fill: "none", stroke: RED, "stroke-width": 5, "stroke-linecap": "round", opacity: 0}, P);
  E.dotN = api.el("circle", {r: 7, fill: "#2a9d8f", stroke: "#fff", "stroke-width": 2.5}, P);
  E.dotL = api.el("circle", {r: 7, fill: RED, stroke: "#fff", "stroke-width": 2.5, opacity: 0}, P);
  E.nTag = R.text(api, P, "Normal", sx(52), sy(0.8), {size: 16, color: "#1d6f66"});
  E.lTag = R.text(api, P, "Low 2,3-DPG", sx(12), sy(0.72), {size: 16, color: RED});
  E.dpg = R.chip(api, P, "14 units: 2,3-DPG ↓", 330, 330, RED, {size: 16});
  E.out = R.chip(api, P, "Less O₂ unloaded at the tissues", 330, 400, GREEN, {size: 16});
}
function render(t, api) {
  R.fade(api, E.dpg, t, 400, 900);
  const k = api.seg(t, 2900, 4600, "ease_in_out"), p50 = P50N + (P50L - P50N) * k;
  api.set(E.left, {d: curve(p50), opacity: api.seg(t, 2800, 3000)});
  api.set(E.lTag, {opacity: api.seg(t, 4300, 4700)});
  const sN = sat(TISSUE, P50N), sL = sat(TISSUE, p50);
  api.set(E.dotN, {cx: sx(TISSUE), cy: sy(sN).toFixed(1)});
  api.set(E.dotL, {cx: sx(TISSUE), cy: sy(sL).toFixed(1), opacity: api.seg(t, 2800, 3000)});
  R.fade(api, E.out, t, 5400, 5900);
  R.scaleAbout(api, E.dotL, 1 + 0.25 * api.seg(t, 5200, 5600) * (0.5 + 0.5 * Math.sin(t / 150)));
}
""")
ART["Q000009415"] = [("lib:iv-bag", "bag", "520,118,80,100", [])]

# ---------------------------------------------------------------- Q000009416 low PaO2 = hypoxaemia
CARDS["Q000009416"] = scene(
    "Q000009416",
    "A low PaO₂ is hypoxaemia: a low partial pressure of oxygen in arterial blood (it is not a measure of total oxygen content).",
    [title("What a PaO₂ of 6.1 kPa means"),
     caption(1, "PaO₂: oxygen pressure in blood", B1, BLUE, "#b9cbe8"),
     caption(2, "Here: only 6.1 kPa", B2, RED, "#f0c4b8"),
     caption(3, "Low PaO₂ means hypoxaemia", B3, "@good", "#b9e2dc")],
    r"""
const SX0 = 70, SX1 = 570, SY = 350, KMAX = 14, LO = 10.5, HI = 13.5, VAL = 6.1, T0 = 2900, T1 = 4500;
const kx = (v) => SX0 + (SX1 - SX0) * v / KMAX;
let E = {};
function setup(api) {
  const P = api.svg;
  E.art = R.tube(api, P, "M 60 220 H 580", "artery", 64);
  const rnd = api.random(9);
  E.o2 = [];
  for (let i = 0; i < 22; i++) E.o2.push({el: api.el("circle", {r: 5, fill: "#e3f2fd", stroke: "#1565c0", "stroke-width": 1.5}, P), x: rnd(), y: rnd() * 2 - 1, keep: rnd()});
  R.text(api, P, "Dissolved O₂ in arterial blood", 320, 290, {anchor: "middle", size: 15, color: "#58707c", weight: 600});
  // kPa scale with normal band
  const g = api.el("g", {}, P);
  api.el("rect", {x: SX0, y: SY - 9, width: SX1 - SX0, height: 18, rx: 9, fill: "#e9eef1"}, g);
  api.el("rect", {x: kx(LO), y: SY - 9, width: kx(HI) - kx(LO), height: 18, rx: 9, fill: "#a5d6c8"}, g);
  R.text(api, g, "normal 10.5–13.5", (kx(LO) + kx(HI)) / 2, SY + 34, {anchor: "middle", size: 13, color: GREEN});
  for (let v = 0; v <= KMAX; v += 2) R.text(api, g, String(v), kx(v), SY - 18, {anchor: "middle", size: 12, color: "#58707c", weight: 600});
  R.text(api, g, "kPa", SX1 + 16, SY + 5, {size: 13, color: "#58707c"});
  E.mark = api.el("g", {}, P);
  api.el("path", {d: "M 0 -30 L 0 14", stroke: INK, "stroke-width": 3}, E.mark);
  api.el("path", {d: "M -8 -38 L 8 -38 L 0 -26 Z", fill: INK}, E.mark);
  E.val = R.text(api, P, "", 0, SY + 62, {anchor: "middle", size: 20, color: INK});
  E.hyp = R.chip(api, P, "Low PaO₂ = hypoxaemia", 320, 486, GREEN, {anchor: "middle", size: 20});
  E.not = R.chip(api, P, "PaO₂ is not total O₂ content", 320, 530, "#58707c", {anchor: "middle", size: 14});
}
function render(t, api) {
  const k = api.seg(t, T0, T1, "ease_in_out"), v = 12 + (VAL - 12) * k, x = kx(v);
  api.set(E.mark, {transform: `translate(${x.toFixed(1)} ${SY})`});
  api.set(E.val, {x: x.toFixed(1), fill: api.mixColor(GREEN, RED, k)});
  E.val.firstChild.setAttribute("x", x.toFixed(1));
  E.val.firstChild.textContent = v.toFixed(1) + " kPa" + (k > 0.98 ? "  (46 mmHg)" : "");
  // fewer dissolved O2 molecules as the pressure falls
  const keepShare = v / 12;
  E.o2.forEach((o) => { const xx = 70 + ((o.x * 500 + t * 0.09) % 500), on = o.keep < keepShare ? 1 : 0.08;
    api.set(o.el, {cx: xx.toFixed(1), cy: (220 + o.y * 22).toFixed(1), opacity: (on * Math.min(1, (xx - 66) / 20, (574 - xx) / 20)).toFixed(3)}); });
  R.fade(api, E.hyp, t, 5300, 5800);
  R.fade(api, E.not, t, 6100, 6600);
}
""")

# ---------------------------------------------------------------- Q000009417 pulmonary shunt
CARDS["Q000009417"] = scene(
    "Q000009417",
    "Blood shunted past unventilated alveoli picks up no oxygen, so the PaO₂ falls and extra inspired oxygen corrects it poorly.",
    [title("Pulmonary shunt: blood that misses the air"),
     caption(1, "Some alveoli get no air", B1, BLUE, "#b9cbe8"),
     caption(2, "Blood passes them without oxygen", B2, "#6a1b9a", "#d9c6f2"),
     caption(3, "Shunted blood lowers the PaO₂", B3, "@good", "#b9e2dc")],
    r"""
const A = {x: 250, y: 196}, B = {x: 250, y: 372}, RA = 60, VY = 290;
const blueC = "#3f5fa8", redC = "#d32f2f";
let E = {};
function setup(api) {
  const P = api.svg;
  E.capA = api.el("path", {d: `M 40 ${A.y + RA + 6} H 400 C 450 ${A.y + RA + 6} 470 ${VY} 520 ${VY} H 610`, fill: "none", stroke: "#e8b4b8", "stroke-width": 22, "stroke-linecap": "round"}, P);
  E.capB = api.el("path", {d: `M 40 ${B.y + RA + 6} H 400 C 450 ${B.y + RA + 6} 470 ${VY} 520 ${VY} H 610`, fill: "none", stroke: "#c5cae9", "stroke-width": 22, "stroke-linecap": "round"}, P);
  // ventilated alveolus
  api.el("circle", {cx: A.x, cy: A.y, r: RA, fill: "url(#kit-lung)", filter: "url(#kit-volume)"}, P);
  api.el("circle", {cx: A.x, cy: A.y, r: RA - 12, fill: "#f4fbff"}, P);
  R.text(api, P, "Ventilated", A.x, A.y + 5, {anchor: "middle", size: 15, color: BLUE});
  // unventilated (collapsed, fluid-filled) alveolus
  E.bAlv = api.el("circle", {cx: B.x, cy: B.y, r: RA, fill: "url(#kit-lung)", filter: "url(#kit-volume)"}, P);
  E.bFill = api.el("circle", {cx: B.x, cy: B.y, r: RA - 12, fill: "#f4fbff"}, P);
  E.bTag = R.text(api, P, "No air", B.x, B.y + 5, {anchor: "middle", size: 15, color: "#6a1b9a"});
  E.bCross = api.el("path", {d: `M ${B.x - 92} ${B.y - 40} l 30 30 m 0 -30 l -30 30`, stroke: RED, "stroke-width": 5, "stroke-linecap": "round", opacity: 0}, P);
  // O2 entering the ventilated alveolus and crossing to its capillary
  E.o2 = [];
  for (let i = 0; i < 5; i++) E.o2.push(api.el("circle", {r: 5, fill: "#4f83cc", opacity: 0}, P));
  E.airIn = R.arrowGrow(api, P, `M ${A.x - 160} ${A.y - 36} L ${A.x - 70} ${A.y - 16}`, "#4f83cc", 5);
  E.air2 = R.arrowGrow(api, P, `M ${B.x - 160} ${B.y - 36} L ${B.x - 70} ${B.y - 16}`, "#9aa9b2", 5);
  // red cells along both capillaries
  E.cells = [];
  for (let i = 0; i < 9; i++) { E.cells.push({el: api.el("ellipse", {rx: 7, ry: 5, stroke: "#fff", "stroke-width": 1}, P), p: E.capA, d: i / 9}); E.cells.push({el: api.el("ellipse", {rx: 7, ry: 5, stroke: "#fff", "stroke-width": 1}, P), p: E.capB, d: i / 9 + 0.05}); }
  E.vTag = R.text(api, P, "To the heart", 560, VY - 22, {anchor: "middle", size: 14, color: "#6a1b9a"});
  E.pao2 = R.chip(api, P, "Mixed blood: PaO₂ falls", 420, 470, "#6a1b9a", {size: 17});
  E.o2Tag = R.chip(api, P, "Extra O₂ never reaches shunted blood", 120, 520, GREEN, {size: 16});
}
function render(t, api) {
  E.airIn.update(t, api.seg(t, 200, 900));
  E.air2.update(t, api.seg(t, 200, 900) * (1 - api.seg(t, 1200, 1500)));
  api.set(E.bCross, {opacity: api.seg(t, 1300, 1700)});
  api.set(E.bFill, {fill: api.mixColor("#f4fbff", "#cfd8e8", api.seg(t, 900, 1700))});
  E.o2.forEach((c, i) => { const f = ((t / 900) + i / 5) % 1;
    api.set(c, {cx: (A.x - 20 + i * 10).toFixed(1), cy: (A.y - 20 + 90 * f).toFixed(1), opacity: (Math.sin(f * Math.PI) * 0.9).toFixed(3)}); });
  // cells: through the ventilated unit they turn red; through the shunt they stay blue; mixed after the junction
  const showB = api.seg(t, 2700, 3200);
  E.cells.forEach((c) => {
    const f = ((t / 4200) + c.d) % 1, q = api.pointAt(c.p, f), x = q.x;
    let col;
    if (c.p === E.capA) col = api.mixColor(blueC, redC, api.clamp((x - A.x + 30) / 80, 0, 1));
    else col = blueC;
    if (x > 520) col = api.mixColor(col, "#8e3a8e", api.seg(t, 5200, 5800) * 0.6);
    const vis = c.p === E.capB ? showB : 1;
    api.set(c.el, {cx: x.toFixed(1), cy: q.y.toFixed(1), fill: col, opacity: (vis * Math.min(1, f * 12, (1 - f) * 12)).toFixed(3)});
  });
  R.fade(api, E.pao2, t, 5300, 5800);
  R.fade(api, E.o2Tag, t, 6100, 6600);
}
""")


def run(*args):
    r = subprocess.run([sys.executable, str(ROOT / "tools/motioncards.py"), *args], cwd=ROOT, capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"{' '.join(args[:2])}: {r.stdout}{r.stderr}")


for qid, sc in CARDS.items():
    path = SCENES / f"{qid}.scene.json"
    path.write_text(json.dumps(sc, ensure_ascii=False, indent=1) + "\n")
    run("recipes", str(path))
    for src, ident, box, extra in ART.get(qid, []):
        run("import-svg", src, "--scene", str(path), "--id", ident, "--box", box, *extra)
    print("built", path.name)
