#!/usr/bin/env python3
"""Build the 7 MotionCards scenes for MRCS Part A chapter 14 (Cardiovascular system).

Re-runnable: writes each scene, then adds the recipes/style kit and imports library art with the CLI.
Usage: python3 work/MRCS-CH14/build_scenes.py [--grid]
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
    return {"schema_version": 2, "qid": qid, "duration_ms": D, "takeaway": takeaway,
            "stage": {"width": 640, "height": 560, "background": BG},
            "layers": layers, "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>", "script": script}


CARDS = {}
ART = {}   # qid -> [(source, id, box, extra args)]

# ---------------------------------------------------------------- Q000009405 preload = myocyte length
CARDS["Q000009405"] = scene(
    "Q000009405",
    "Preload is the initial stretch of the ventricular myocytes: their length before contraction sets the force of the beat (Frank–Starling).",
    [title("Preload: how far the muscle is stretched"),
     caption(1, "Fluid fills the ventricle", B1, "@vein", "#b9cbe8"),
     caption(2, "Each muscle cell is stretched", B2, "#9a3b2e", "#f0c4b8"),
     caption(3, "Preload is myocyte length", B3, "@good", "#b9e2dc")],
    r"""
const CELL = {x: 352, y: 262, h: 74, w0: 196, w1: 262, n: 7};
let E = {};
function setup(api) {
  const P = R.layer(api, "#heart");
  E.heart = R.wrap(api, api.$("#heart"));
  E.bag = R.wrap(api, api.$("#bag"));
  E.line = R.tube(api, P, "M 112 196 C 112 232 150 232 168 262", "vein", 6);
  E.drops = R.flow(api, P, E.line.p, {n: 5, color: "#cfe3ff", r: 3.2, period: 900});
  E.fill = R.glow(api, P, 214, 396, {r: 44, color: "#4f83cc"});
  E.lvTag = R.callout(api, P, "Left ventricle", 64, 470, "#2f5f9e", [176, 382]);
  // zoom lines from the ventricle wall to the cell
  E.zoom = api.el("g", {opacity: 0}, P);
  api.el("path", {d: "M 214 352 L 344 254 M 214 380 L 344 344", stroke: "#9aa9b2", "stroke-width": 1.5, "stroke-dasharray": "5 5", fill: "none"}, E.zoom);
  api.el("circle", {cx: 206, cy: 366, r: 16, fill: "none", stroke: "#9aa9b2", "stroke-width": 2}, E.zoom);
  // one ventricular myocyte with sarcomere bands
  E.cell = api.el("g", {opacity: 0}, P);
  E.body = api.el("rect", {x: CELL.x, y: CELL.y, width: CELL.w0, height: CELL.h, rx: 30, fill: "url(#kit-muscle)", stroke: "#8e2f2a", "stroke-width": 2.5, filter: "url(#kit-volume-sm)"}, E.cell);
  E.bands = [];
  for (let i = 0; i < CELL.n; i++) E.bands.push(api.el("rect", {y: CELL.y + 10, width: 7, height: CELL.h - 20, rx: 3, fill: "#7a1f1c", opacity: 0.55}, E.cell));
  E.nuc = api.el("ellipse", {cy: CELL.y + CELL.h / 2, rx: 13, ry: 9, fill: "#5b3a8a", opacity: 0.8}, E.cell);
  E.cellTag = R.text(api, E.cell, "Ventricular myocyte", 450, 236, {anchor: "middle", size: 17, color: "#7a1f1c"});
  // length ruler
  E.ruler = api.el("g", {opacity: 0}, P);
  E.rLine = api.el("path", {stroke: "#1f7a6d", "stroke-width": 3, fill: "none", "stroke-linecap": "round"}, E.ruler);
  E.rText = R.text(api, E.ruler, "", 450, 398, {anchor: "middle", size: 18, color: "#1f7a6d"});
  E.result = R.chip(api, P, "Preload = myocyte length", 450, 452, "#1f7a6d", {anchor: "middle", size: 19});
  E.starling = R.chip(api, P, "Longer fibre → stronger beat", 450, 498, "#9a3b2e", {anchor: "middle", size: 16});
}
function render(t, api) {
  // 1 · fluid challenge runs in and the ventricle fills
  const fill = api.seg(t, 300, 2600, "ease_in_out");
  E.drops.update(t, t < 2900 ? 1 : 1 - api.seg(t, 2900, 3300));
  E.fill.update(t, (0.25 + 0.75 * fill) * (1 - 0.6 * api.seg(t, 5200, 5800)));
  R.scaleAbout(api, E.heart, 1 + 0.06 * fill);
  R.fade(api, E.lvTag, t, 600, 1100);
  // 2 · zoom to one cell, which lengthens with the filling
  R.fade(api, [E.zoom, E.cell], t, 2700, 3200);
  const s = api.seg(t, 3300, 4900, "ease_in_out");
  const w = CELL.w0 + (CELL.w1 - CELL.w0) * s, x = 450 - w / 2;
  api.set(E.body, {x, width: w});
  E.bands.forEach((b, i) => api.set(b, {x: x + w * (i + 1) / (CELL.n + 1) - 3.5}));
  api.set(E.nuc, {cx: 450});
  // 3 · the ruler names it
  R.fade(api, E.ruler, t, 3300, 3700);
  api.set(E.rLine, {d: `M ${x} 364 v -10 M ${x} 359 H ${x + w} M ${x + w} 364 v -10`});
  E.rText.firstChild.textContent = "length ×" + (w / CELL.w0).toFixed(2);
  R.fade(api, E.result, t, 5300, 5800);
  R.fade(api, E.starling, t, 6100, 6600);
}
""")
ART["Q000009405"] = [("lib:heart-front", "heart", "60,240,230,240", []),
                     ("lib:iv-bag", "bag", "62,104,100,120", [])]

# ---------------------------------------------------------------- Q000009406 coronary flow and radius
CARDS["Q000009406"] = scene(
    "Q000009406",
    "Poiseuille: resistance rises with 1/r⁴, so coronary artery diameter is the main determinant of coronary blood flow.",
    [title("Coronary blood flow: radius rules"),
     caption(1, "Blood flows down a coronary artery", B1, "@artery", "#f0c4b8"),
     caption(2, "Halve the radius: resistance soars", B2, "#9a3b2e", "#f0c4b8"),
     caption(3, "Diameter sets coronary flow", B3, "@good", "#b9e2dc")],
    r"""
const Y = 244, X0 = 232, X1 = 606, W0 = 46, W1 = 23, T0 = 2900, T1 = 4300, N = 14;
let E = {};
const radius = (t) => 1 - 0.5 * api_seg(t);          // relative radius 1 -> 0.5
let api_seg;
// flow speed ∝ r^4 at a fixed pressure; integrate it so the particles stay a pure function of t
function dist(t) {
  const v0 = 0.115, steps = 40;                       // px per ms at full radius
  if (t <= T0) return v0 * t;
  const tt = Math.min(t, T1); let d = v0 * T0, prev = T0;
  for (let i = 1; i <= steps; i++) { const ti = T0 + (tt - T0) * i / steps; const r = radius((prev + ti) / 2); d += v0 * Math.pow(r, 4) * (ti - prev); prev = ti; }
  if (t > T1) d += v0 * Math.pow(radius(T1), 4) * (t - T1);
  return d;
}
function setup(api) {
  api_seg = (t) => api.seg(t, T0, T1, "ease_in_out");
  const P = R.layer(api, "#heart");
  E.heart = R.wrap(api, api.$("#heart"));
  E.box = api.el("rect", {x: 160, y: 140, width: 26, height: 26, rx: 4, fill: "none", stroke: "#c0392b", "stroke-width": 2.5}, P);
  E.link = api.el("path", {d: "M 186 156 C 210 170 214 210 230 228", stroke: "#c0392b", "stroke-width": 2, "stroke-dasharray": "5 5", fill: "none"}, P);
  E.art = R.tube(api, P, `M ${X0} ${Y} H ${X1}`, "artery", W0);
  E.cells = [];
  const rnd = api.random(7);
  for (let i = 0; i < N; i++) E.cells.push({el: api.el("ellipse", {rx: 7, ry: 5, fill: "#ff8a80", stroke: "#b71c1c", "stroke-width": 1.2}, P), off: i * (X1 - X0) / N, lane: rnd() * 2 - 1});
  // the three numbers
  E.rows = [["Radius", "#2f5f9e"], ["Resistance", "#c0392b"], ["Flow", "#1f7a6d"]].map(([name, c], i) => {
    const y = 330 + i * 56, g = api.el("g", {opacity: 0}, P);
    R.text(api, g, name, 40, y + 6, {size: 18, color: c});
    api.el("rect", {x: 170, y: y - 12, width: 330, height: 22, rx: 11, fill: "#e9eef1"}, g);
    const bar = api.el("rect", {x: 170, y: y - 12, width: 110, height: 22, rx: 11, fill: c}, g);
    const val = R.text(api, g, "", 512, y + 6, {size: 18, color: c});
    return {g, bar, val};
  });
  E.law = R.chip(api, P, "Resistance ∝ 1 / r⁴  (Poiseuille)", 320, 506, "#9a3b2e", {anchor: "middle", size: 18});
}
function render(t, api) {
  const s = api.seg(t, T0, T1, "ease_in_out"), r = 1 - 0.5 * s;
  R.squeeze(api, E.art, s, W0, W1);
  const d = dist(t), half = (W0 + (W1 - W0) * s) / 2 - 6;
  E.cells.forEach((c) => {
    const x = X0 + 8 + ((c.off + d) % (X1 - X0 - 16));
    api.set(c.el, {cx: x, cy: Y + c.lane * Math.max(0, half - 2), opacity: Math.min(1, (x - X0) / 20, (X1 - x) / 20)});
  });
  R.fade(api, [E.box, E.link], t, 200, 700);
  // bars: radius r, resistance 1/r^4 (log-like display capped), flow r^4
  const vals = [r, 1 / Math.pow(r, 4), Math.pow(r, 4)];
  const widths = [110 * r, Math.min(330, 110 * (1 + Math.log2(vals[1]) * 0.55)), 110 * vals[2]];
  const txt = ["×" + r.toFixed(2), "×" + vals[1].toFixed(vals[1] < 10 ? 1 : 0), "×" + vals[2].toFixed(2)];
  E.rows.forEach((row, i) => {
    R.fade(api, row.g, t, 900 + i * 300, 1300 + i * 300);
    api.set(row.bar, {width: Math.max(8, widths[i])});
    row.val.firstChild.textContent = txt[i];
  });
  R.fade(api, E.law, t, 5300, 5800);
}
""")
ART["Q000009406"] = [("lib:heart", "heart", "36,112,180,190", [])]

# ---------------------------------------------------------------- Q000009407 preload: least O2 cost
CARDS["Q000009407"] = scene(
    "Q000009407",
    "To raise cardiac output with the least rise in myocardial oxygen demand, optimise preload (Laplace relationship).",
    [title("Raising cardiac output: the oxygen bill"),
     caption(1, "Several levers change cardiac output", B1, "@ink", "@line"),
     caption(2, "Each one costs the heart oxygen", B2, "#2f5f9e", "#b9cbe8"),
     caption(3, "Preload costs the least oxygen", B3, "@good", "#b9e2dc")],
    r"""
const ROWS = [["Heart rate", 0.92], ["Contractility", 0.82], ["Afterload", 0.96], ["Preload", 0.24]];
const Y0 = 196, DY = 72, BX = 236, BW = 300;
let E = {};
function setup(api) {
  const P = R.layer(api, "#heart");
  E.heart = R.wrap(api, api.$("#heart"));
  E.o2 = R.text(api, P, "O₂ demand", BX, Y0 - 44, {size: 16, color: "#2f5f9e"});
  E.rows = ROWS.map(([name, cost], i) => {
    const y = Y0 + i * DY, g = api.el("g", {opacity: 0}, P);
    E[name] = g;
    g.hl = api.el("rect", {x: 22, y: y - 28, width: 596, height: 56, rx: 16, fill: "#e6f5f1", stroke: "#1f7a6d", "stroke-width": 2, opacity: 0}, g);
    R.text(api, g, name, 40, y + 7, {size: 20, color: "#16323a"});
    api.el("rect", {x: BX, y: y - 11, width: BW, height: 22, rx: 11, fill: "#e9eef1"}, g);
    g.bar = api.el("rect", {x: BX, y: y - 11, width: 0, height: 22, rx: 11, fill: "#4f83cc"}, g);
    g.drop = api.el("path", {d: `M 0 -12 C 7 -2 8 4 0 9 C -8 4 -7 -2 0 -12 Z`, fill: "#4f83cc", opacity: 0}, g);
    g.up = R.text(api, g, "alters output", 40, y + 24, {size: 12, color: "#1f7a6d", weight: 700});
    g.cost = cost; g.y = y;
    return g;
  });
  E.lap = R.chip(api, P, "Laplace: small rise in wall tension", 320, 498, "#1f7a6d", {anchor: "middle", size: 18});
}
function render(t, api) {
  R.fade(api, E.heart, t, 0, 300);
  R.fade(api, E.o2, t, 2700, 3100);
  E.rows.forEach((g, i) => {
    const on = 1;
    const k = api.seg(t, 2900 + i * 350, 3900 + i * 350, "ease_out");
    const w = BW * g.cost * k;
    const pre = i === 3, dim = api.seg(t, 5300, 5800);
    api.set(g, {opacity: on * (pre ? 1 : 1 - 0.55 * dim)});
    api.set(g.bar, {width: w.toFixed(1), opacity: api.clamp((w - 4) / 10, 0, 1), fill: pre ? api.mixColor("#4f83cc", "#1f7a6d", dim) : "#4f83cc"});
    api.set(g.drop, {transform: `translate(${(BX + w + 16).toFixed(1)} ${g.y})`, opacity: api.clamp((w - 4) / 10, 0, 1), fill: pre ? api.mixColor("#4f83cc", "#1f7a6d", dim) : "#4f83cc"});
    if (pre) api.set(g.hl, {opacity: dim});
  });
  R.scaleAbout(api, E.heart, 1 + 0.04 * Math.max(0, Math.sin(t / 160)) * (t < 5200 ? 1 : 0.4));
  R.fade(api, E.lap, t, 6000, 6500);
}
""")
ART["Q000009407"] = [("lib:heart-front", "heart", "36,452,80,80", [])]

# ---------------------------------------------------------------- Q000009408 elastic aorta
CARDS["Q000009408"] = scene(
    "Q000009408",
    "Elastic tissue dominates the aortic wall: it stretches in systole and recoils in diastole to keep blood flow and pressure going.",
    [title("The elastic aorta: a pump in diastole"),
     caption(1, "Systole stretches the elastic aorta", B1, "#9a3b2e", "#f0c4b8"),
     caption(2, "In diastole, the wall recoils", B2, "#2f5f9e", "#b9cbe8"),
     caption(3, "Recoil keeps blood flowing forward", B3, "@good", "#b9e2dc")],
    r"""
const CX = 470, CY = 300, RL = 54, NL = 5;
let E = {};
// wall stretch over the card: expand in systole, recoil in diastole, then one gentler cycle
function stretch(t, api) {
  return api.seg(t, 300, 2300, "ease_out") - api.seg(t, 2900, 4900, "ease_in_out")
    + 0.6 * (api.seg(t, 5300, 6000, "ease_out") - api.seg(t, 6200, 7400, "ease_in_out"));
}
function setup(api) {
  const P = R.layer(api, "#aorta");
  E.aorta = R.wrap(api, api.$("#aorta"));
  E.box = api.el("circle", {cx: 214, cy: 300, r: 15, fill: "none", stroke: "#7a5a00", "stroke-width": 2.5}, P);
  E.link = api.el("path", {d: "M 229 296 L 392 240 M 229 306 L 392 360", stroke: "#9aa9b2", "stroke-width": 1.5, "stroke-dasharray": "5 5", fill: "none"}, P);
  // cross-section: lumen + concentric elastic lamellae
  E.sec = api.el("g", {}, P);
  E.wall = api.el("circle", {cx: CX, cy: CY, fill: "#f6d9cf", stroke: "#b5616b", "stroke-width": 3}, E.sec);
  E.lam = [];
  for (let i = 0; i < NL; i++) E.lam.push(api.el("circle", {cx: CX, cy: CY, fill: "none", stroke: "#d4a017", "stroke-width": 3, "stroke-dasharray": "10 4"}, E.sec));
  E.lumen = api.el("circle", {cx: CX, cy: CY, fill: "#c62828", stroke: "#8e1b1b", "stroke-width": 2}, E.sec);
  E.lamTag = R.callout(api, P, "Elastic lamellae", 470, 452, "#9a6b00", [470, 380]);
  const ray = (k, r0, r1) => { const a = Math.PI / 4 + k * Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
    return `M ${(CX + c * r0).toFixed(1)} ${(CY + s * r0).toFixed(1)} L ${(CX + c * r1).toFixed(1)} ${(CY + s * r1).toFixed(1)}`; };
  E.out = [0, 1, 2, 3].map((k) => R.arrowGrow(api, P, ray(k, 108, 138), "#c0392b", 4));
  E.inn = [0, 1, 2, 3].map((k) => R.arrowGrow(api, P, ray(k, 150, 116), "#2f5f9e", 4));
  E.flowPath = api.el("path", {d: "M 214 170 C 214 240 214 330 214 470", fill: "none", stroke: "none"}, P);
  E.flow = R.flow(api, P, E.flowPath, {n: 8, color: "#ffffff", r: 5, period: 1100});
  E.phase = R.text(api, P, "", 214, 520, {anchor: "middle", size: 18});
}
function render(t, api) {
  const k = Math.max(0, stretch(t, api)), r = RL * (1 + 0.32 * k), thick = 40 * (1 - 0.22 * k);
  api.set(E.lumen, {r: r.toFixed(1)});
  api.set(E.wall, {r: (r + thick).toFixed(1)});
  E.lam.forEach((c, i) => api.set(c, {r: (r + thick * (i + 0.7) / (NL + 0.4)).toFixed(1)}));
  R.fade(api, [E.box, E.link], t, 0, 400);
  R.fade(api, E.lamTag, t, 700, 1200);
  // systole: outward; diastole: recoil inward
  E.out.forEach((a) => a.update(t, api.seg(t, 500, 1600) * (1 - api.seg(t, 2500, 2800))));
  E.inn.forEach((a) => a.update(t, api.seg(t, 3000, 4000) * (1 - api.seg(t, 4900, 5200))));
  // blood keeps moving down the aorta in both phases
  E.flow.update(t, 0.35 + 0.65 * Math.min(1, api.seg(t, 0, 400) + api.seg(t, 5200, 5600)));
  const sys = t < 2700 || (t >= 5200 && t < 6200);
  E.phase.firstChild.textContent = sys ? "Systole" : "Diastole";
  api.set(E.phase, {fill: sys ? "#c0392b" : "#2f5f9e"});
}
""")
ART["Q000009408"] = [("lib:aorta", "aorta", "100,130,230,380", [])]

# ---------------------------------------------------------------- Q000009409 resting CO distribution
CARDS["Q000009409"] = scene(
    "Q000009409",
    "At rest the liver receives the largest share of cardiac output (about a quarter); arterioles regulate each organ's share.",
    [title("Where resting cardiac output goes"),
     caption(1, "At rest, output is shared out", B1, "@ink", "@line"),
     caption(2, "Arterioles set each organ's share", B2, "#9a3b2e", "#f0c4b8"),
     caption(3, "The liver gets the largest share", B3, "@good", "#b9e2dc")],
    r"""
// Approximate resting distribution of cardiac output (Guyton & Hall)
const ROWS = [["Liver", 27], ["Kidneys", 22], ["Skeletal muscle", 15], ["Brain", 14], ["Heart", 4]];
const Y0 = 168, DY = 52, BX = 196, SCALE = 9;
let E = {};
function setup(api) {
  const P = R.layer(api, "#liver");
  E.liver = R.wrap(api, api.$("#liver"));
  E.note = R.text(api, P, "% of resting cardiac output (approx.)", BX, Y0 - 34, {size: 14, color: "#58707c", weight: 600});
  E.rows = ROWS.map(([name, pc], i) => {
    const y = Y0 + i * DY, g = api.el("g", {opacity: 0}, P);
    R.text(api, g, name, 36, y + 7, {size: 19, color: "#16323a"});
    g.bar = api.el("rect", {x: BX, y: y - 12, width: 0, height: 24, rx: 12, fill: "#8aa0ad"}, g);
    g.val = R.text(api, g, "", BX, y + 7, {size: 18, color: "#16323a"});
    g.pc = pc; g.y = y;
    return g;
  });
  // arteriole "tap": smooth-muscle ring that narrows and widens
  E.tap = api.el("g", {opacity: 0}, P);
  E.ring = api.el("circle", {cx: 470, cy: 450, r: 30, fill: "none", stroke: "url(#kit-muscle)", "stroke-width": 16}, E.tap);
  E.lum = api.el("circle", {cx: 470, cy: 450, r: 22, fill: "#c62828"}, E.tap);
  R.text(api, E.tap, "Arteriole\nsmooth muscle", 520, 444, {size: 15, color: "#9a3b2e"});
  E.best = R.chip(api, P, "Liver ≈ a quarter of output", 456, 512, "#1f7a6d", {anchor: "middle", size: 18});
}
function render(t, api) {
  R.fade(api, E.note, t, 0, 400);
  E.rows.forEach((g, i) => {
    const show = api.seg(t, i * 200, 300 + i * 200);
    const k = api.seg(t, 300 + i * 260, 1500 + i * 260, "ease_out"), w = g.pc * SCALE * k;
    api.set(g.bar, {width: Math.max(1, w).toFixed(1), fill: i === 0 ? api.mixColor("#8aa0ad", "#1f7a6d", api.seg(t, 5300, 5800)) : "#8aa0ad"});
    api.set(g.val.firstChild, {x: (BX + w + 10).toFixed(1)});
    g.val.firstChild.textContent = Math.round(g.pc * k) + "%";
    api.set(g, {opacity: (i > 0 ? 1 - 0.5 * api.seg(t, 5300, 5800) : 1) * Math.max(show, i === 0 ? 1 : 0)});
  });
  // 2 · the arteriole ring constricts and relaxes, like a tap
  R.fade(api, E.tap, t, 2700, 3100, 5100, 5400);
  const sq = 0.5 + 0.5 * Math.sin((t - 2700) / 330);
  api.set(E.lum, {r: (10 + 12 * sq).toFixed(1)});
  api.set(E.ring, {r: (18 + 12 * sq).toFixed(1), "stroke-width": (22 - 6 * sq).toFixed(1)});
  // 3 · the liver
  R.fade(api, E.liver, t, 5300, 5800);
  R.scaleAbout(api, E.liver, 0.9 + 0.1 * api.seg(t, 5300, 6000, "back_out"));
  R.fade(api, E.best, t, 5900, 6400);
}
""")
ART["Q000009409"] = [("lib:liver-3d", "liver", "350,330,210,150", [])]

# ---------------------------------------------------------------- Q000009410 alpha-1 vasoconstriction
CARDS["Q000009410"] = scene(
    "Q000009410",
    "Adrenaline causes vasoconstriction through α₁-adrenoreceptors, which contract vascular smooth muscle.",
    [title("Adrenaline and the α₁ receptor"),
     caption(1, "Adrenaline reaches the arteriole wall", B1, "#b26a00", "#f1dfa6"),
     caption(2, "It binds alpha one receptors", B2, "#9a3b2e", "#f0c4b8"),
     caption(3, "Muscle contracts: the vessel narrows", B3, "@good", "#b9e2dc")],
    r"""
const CX = 320, CY = 318, NR = 8;
let E = {};
function geom(t, api) {
  const k = api.seg(t, 5300, 6600, "ease_in_out");
  const lumen = 92 - 44 * k, outer = 162 - 18 * k;        // wall thickens as the muscle shortens
  return {k, lumen, outer};
}
function setup(api) {
  const P = api.svg;
  E.adv = api.el("circle", {cx: CX, cy: CY, fill: "#f3e6d8", stroke: "#c9a98a", "stroke-width": 2}, P);
  E.mus = api.el("circle", {cx: CX, cy: CY, fill: "url(#kit-muscle)", filter: "url(#kit-volume)"}, P);
  E.lum = api.el("circle", {cx: CX, cy: CY, fill: "#fbe3e3", stroke: "#b5616b", "stroke-width": 3}, P);
  E.cells = [];
  const rnd = api.random(3);
  for (let i = 0; i < 9; i++) { const a = rnd() * 6.283, d = Math.sqrt(rnd()); E.cells.push({u: api.el("use", {href: "#rbc"}, P), a, d}); }
  E.rec = [];
  for (let i = 0; i < NR; i++) {
    const g = api.el("g", {}, P), ang = -Math.PI / 2 + i * 2 * Math.PI / NR;
    api.el("path", {d: "M -9 -10 L -9 4 Q 0 12 9 4 L 9 -10", fill: "none", stroke: "#6a1b9a", "stroke-width": 4, "stroke-linecap": "round"}, g);
    g.ang = ang; E.rec.push(g);
    const m = api.el("path", {d: "M 0 -8 L 8 0 L 0 8 L -8 0 Z", fill: "#f39c12", stroke: "#a85d00", "stroke-width": 1.5, opacity: 0}, P);
    m.ang = ang + (i % 2 ? 0.25 : -0.25); m.delay = i * 120; g.m = m;
  }
  E.recTag = R.chip(api, P, "α₁ receptor", 440, 166, "#6a1b9a", {size: 16});
  E.adrTag = R.chip(api, P, "Adrenaline", 70, 160, "#b26a00", {size: 16});
  E.mTag = R.text(api, P, "Smooth muscle", CX, CY + 132, {anchor: "middle", size: 16, color: "#7a1f1c"});
  E.result = R.chip(api, P, "Vasoconstriction → resistance and BP rise", 320, 516, "#1f7a6d", {anchor: "middle", size: 17});
}
function render(t, api) {
  const g = geom(t, api), mid = (g.lumen + g.outer) / 2;
  api.set(E.adv, {r: (g.outer + 14).toFixed(1)});
  api.set(E.mus, {r: g.outer.toFixed(1)});
  api.set(E.lum, {r: g.lumen.toFixed(1)});
  api.set(E.mTag, {y: (CY + mid + 6).toFixed(1)});
  E.cells.forEach((c, i) => {
    const rr = (g.lumen - 18) * c.d, a = c.a + t / 2400;
    api.set(c.u, {x: (CX + Math.cos(a) * rr).toFixed(1), y: (CY + Math.sin(a) * rr).toFixed(1)});
  });
  const bind = api.seg(t, 3000, 4400);
  E.rec.forEach((r, i) => {
    const R0 = g.outer + 14;
    api.set(r, {transform: `translate(${(CX + Math.cos(r.ang) * R0).toFixed(1)} ${(CY + Math.sin(r.ang) * R0).toFixed(1)}) rotate(${(r.ang * 180 / Math.PI + 90).toFixed(1)})`});
    // adrenaline: drift in during beat 1, dock during beat 2
    const m = r.m, arrive = api.seg(t, 300 + m.delay, 2200 + m.delay, "ease_out"), dock = api.seg(t, 2900 + m.delay, 4000 + m.delay, "ease_in_out");
    const far = 228, near = R0 + 40, seat = R0 + 8;
    const rad = far + (near - far) * arrive + (seat - near) * dock, ang = m.ang + (r.ang - m.ang) * dock;
    api.set(m, {transform: `translate(${(CX + Math.cos(ang) * rad).toFixed(1)} ${(CY + Math.sin(ang) * rad).toFixed(1)}) rotate(${(t / 8 + i * 40) % 360 * (1 - dock)})`, opacity: api.seg(t, 200 + m.delay, 700 + m.delay)});
    api.set(r.firstChild, {stroke: api.mixColor("#6a1b9a", "#e53935", dock * (0.6 + 0.4 * Math.sin(t / 120)))});
  });
  R.fade(api, E.adrTag, t, 300, 800, 2700, 3000);
  R.fade(api, E.recTag, t, 2900, 3300, 5100, 5400);
  R.fade(api, E.result, t, 6200, 6700);
}
""")
ART["Q000009410"] = [("lib:red-cell", "rbc", "26,26", ["--template"])]

# ---------------------------------------------------------------- Q000009411 carotid baroreceptor afferent
CARDS["Q000009411"] = scene(
    "Q000009411",
    "Carotid sinus baroreceptors are stretch receptors whose afferents run in the glossopharyngeal nerve (IX); falling pressure reduces their firing.",
    [title("Carotid baroreceptors: the afferent nerve"),
     caption(1, "Carotid sinus walls sense stretch", B1, "#9a3b2e", "#f0c4b8"),
     caption(2, "Blood loss: less stretch, fewer signals", B2, "#2f5f9e", "#b9cbe8"),
     caption(3, "The glossopharyngeal nerve carries them", B3, "#7a5a00", "#f1dfa6")],
    r"""
const SX = 372, SY = 372, T0 = 2900, T1 = 4300;
let E = {};
const rate = (t, api) => 1 - 0.7 * api.seg(t, T0, T1, "ease_in_out");   // firing falls as pressure falls
// impulse phase = integral of rate: keeps the signals a pure function of t
function phase(t, api) {
  const n = 30; let p = 0, prev = 0, end = Math.min(t, T1);
  for (let i = 1; i <= n; i++) { const ti = end * i / n; p += rate((prev + ti) / 2, api) * (ti - prev); prev = ti; }
  if (t > T1) p += rate(T1, api) * (t - T1);
  return p;
}
function setup(api) {
  const P = R.layer(api, "#brain");
  E.brain = R.wrap(api, api.$("#brain"));
  E.cca = R.tube(api, P, "M 400 548 C 400 500 396 446 394 412", "artery", 30);
  E.ica = R.tube(api, P, "M 390 418 C 372 380 360 340 352 250", "artery", 22);
  E.eca = R.tube(api, P, "M 400 414 C 430 370 452 330 470 250", "artery", 18);
  E.sinus = R.lump(api, P, SX, SY, "artery");
  E.nerve = R.tube(api, P, `M ${SX - 14} ${SY - 4} C 300 350 262 336 250 300 C 242 276 240 258 240 238`, "nerve", 6);
  E.imp = [];
  for (let i = 0; i < 4; i++) E.imp.push(api.el("circle", {r: 6, fill: "#fffbe6", stroke: "#ffb300", "stroke-width": 2, filter: "url(#kit-glow)", opacity: 0}, P));
  E.sinTag = R.callout(api, P, "Carotid sinus", 470, 470, "#9a3b2e", [SX + 14, SY + 10]);
  E.medTag = R.callout(api, P, "Medulla", 60, 274, "#2f5f9e", [240, 236]);
  E.ixTag = R.callout(api, P, "Glossopharyngeal nerve (IX)", 40, 420, "#7a5a00", [262, 336]);
  E.bp = R.text(api, P, "", 520, 160, {anchor: "middle", size: 19});
}
function render(t, api) {
  const k = api.seg(t, T0, T1, "ease_in_out");
  // the sinus wall pulses with each beat; it shrinks as pressure falls
  const pulse = 0.5 + 0.5 * Math.sin(t / 140);
  E.sinus.update(t, 1, 19 - 5 * k + (3 - 2 * k) * pulse, 25 - 6 * k + (3 - 2 * k) * pulse, false);
  [E.cca, E.ica, E.eca].forEach((v, i) => R.squeeze(api, v, k, [30, 22, 18][i], [30, 22, 18][i] * 0.82));
  R.fade(api, E.sinTag, t, 300, 800);
  // impulses travel from the sinus to the brainstem
  const ph = phase(t, api) / 900;
  E.imp.forEach((c, i) => {
    const f = (ph + i / 4) % 1, q = api.pointAt(E.nerve.p, f);
    api.set(c, {cx: q.x.toFixed(1), cy: q.y.toFixed(1), opacity: (Math.sin(f * Math.PI) * (0.35 + 0.65 * rate(t, api))).toFixed(3)});
  });
  E.bp.firstChild.textContent = t < T0 ? "BP normal" : "BP falling";
  api.set(E.bp, {fill: t < T0 ? "#1f7a6d" : "#c0392b", opacity: api.seg(t, 200, 600)});
  R.fade(api, E.medTag, t, 600, 1100);
  // 3 · name the nerve
  R.fade(api, E.ixTag, t, 5300, 5800);
  api.set(E.nerve.p, {"stroke-width": (6 + 3 * api.seg(t, 5300, 5800) * (0.7 + 0.3 * Math.sin(t / 150))).toFixed(1)});
}
""")
ART["Q000009411"] = [("lib:brain", "brain", "120,110,240,180", [])]


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
