'use strict';
/* MCQs Mountain v2, HD tier: the game world for mid-range and high-end phones (DECISIONS.md D25, D26).
   PixiJS 8 on WebGL at min(devicePixelRatio, 2), high-resolution CC0 vector art (Kenney, TEST ONLY, ASSETS.md) and
   painted parallax layers built by tools/build_assets_hd.py. The hero is a cut-out skeleton animated in code from the
   Kenney Toon Characters body parts (no frame animation, no extra runtime). Filters from pixi-filters: light rays on
   the sky, colour grading on the whole scene, a glow on the summit beacon.
   Same interface as world.js (window.World), so app.js, the flow and the harness are shared. World units are CSS px at
   zoom 1; y grows downward. Speed rules (D8, D23): one canvas, time-based motion with a clamped delta, everything
   created at start-up (no texture or text made during a transition), pooled particles, no allocation in the hot path.
   Script time per frame (update + render submission) is kept in a ring buffer for the harness (World.scriptTimes). */
(function () {
  const API = window.World;
  const P = new URLSearchParams(location.search);
  const FX = P.get('fx') !== '0';                  // ?fx=0 turns the filters off (for comparison)
  const ART = 0.42;                                  // Kenney art px -> world units (hero about 80 units tall)
  const LW = 150, SUMW = 330, STEP_W = 34, STEP_H = 27, JUMP_GAP = 64, JUMP_RISE = 72, LIFT_W = 64, LIFT_RISE = 216;
  const START_W = 270, COL_D = 1400;
  let app, kit, N = 8, RM = false, VW = 360, VH = 740, Z = 1, night = false, base = '';
  let atlas, tex = {}, lay = {}, root, bgC, worldC, backC, midC, fxC, fgC, vignette, starsC, cloudsC, birdsC;
  let godray = null, grade = null, glow = null;
  const L = [], kinds = [], steps = [], lifts = [], signs = [], coins = [], flags = [], torches = [], falls = [], fgs = [];
  let landmark, beacon, beaconGlow, startSign;

  /* ---------- layout: one ledge per MCQ, joined by stairs, gap jumps or a lift ---------- */
  const liftAt = i => i < N - 1 && (i + 2) % 4 === 0;            // Q3->Q4 and Q7->Q8 ride a lift, as in the light tier
  const kindOf = i => i === N - 1 ? 'stairs' : liftAt(i) ? 'lift' : i % 2 ? 'jump' : 'stairs';
  const stand = i => L[i].x + 34, signX = i => L[i].x + 100, flagX = i => L[i].x + LW - 16;
  function layout() {
    L.length = 0; steps.length = 0; lifts.length = 0; kinds.length = 0;
    let x = 0, y = 0;
    for (let i = 0; i <= N; i++) {
      L.push({ x, y, w: i === N ? SUMW : LW });
      if (i === N) break;
      const k = kindOf(i); kinds.push(k);
      if (k === 'stairs') {
        const sx = x + LW;
        for (let s = 0; s < 3; s++) steps.push({ x: sx + s * STEP_W, y: y - (s + 1) * STEP_H, foot: y, i });
        x = sx + 3 * STEP_W; y -= 4 * STEP_H;
      } else if (k === 'jump') { x += LW + JUMP_GAP; y -= JUMP_RISE; }
      else { lifts.push({ x: x + LW + 6, y, y0: y, y1: y - LIFT_RISE, i }); x += LW + 12 + LIFT_W; y -= LIFT_RISE; }
    }
  }

  /* ---------- small helpers ---------- */
  const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const easeOut = t => 1 - (1 - t) * (1 - t), easeInOut = t => t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
  const D2R = Math.PI / 180;
  const sfx = k => { try { window.Sound && window.Sound.play(k); } catch (e) {} };
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  function frame(name) {
    if (tex[name]) return tex[name];
    const f = kit.atlas.frames[name];
    if (!f) throw new Error('missing frame ' + name);
    return (tex[name] = new PIXI.Texture({ source: atlas.source, frame: new PIXI.Rectangle(f[0], f[1], f[2], f[3]) }));
  }
  function spr(name, x, y, ax, ay, parent, sc) {
    const s = new PIXI.Sprite(typeof name === 'string' ? frame(name) : name);
    s.anchor.set(ax == null ? 0.5 : ax, ay == null ? 1 : ay); s.x = x; s.y = y; if (sc) s.scale.set(sc);
    if (parent) parent.addChild(s);
    return s;
  }
  const textStyle = (size, fill) => ({ fontFamily: 'Fredoka, ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif', fontSize: size, fontWeight: '700', fill, stroke: { color: 0x3a2618, width: Math.max(2, size / 7), join: 'round' } });
  function text(s, size, fill, parent) { const t = new PIXI.Text({ text: s, style: textStyle(size, fill), resolution: 2 }); t.anchor.set(0.5); if (parent) parent.addChild(t); return t; }

  /* ---------- the hero: a cut-out skeleton from the Kenney Toon parts, posed in code ---------- */
  // Joint positions come from kit.rig (pose space 192 x 256, feet at 96, 256). A pose is a set of angles and offsets;
  // the shown pose eases toward the target pose every frame, so state changes never snap.
  const HIP = [96, 222], NECK = [99, 160];
  let hero, hp = {}, rig;
  const pose = { bob: 0, lean: 0, sx: 1, sy: 1, head: 0, armL: 0, armR: 0, handL: 0, handR: 0, legL: 0, legR: 0, bend: 0, breath: 0 };
  const want = Object.assign({}, pose);
  const H = { x: 0, y: 0, gy: 0, st: 'idle', t: 0, phase: 0, face: 'head', blinkT: 2, look: 0, sq: 0, sqD: 1, sqA: 0, book: 0, hop: 0, react: '', reactT: 0 };
  function buildHero(parent) {
    hero = new PIXI.Container(); parent.addChild(hero);
    rig = kit.rig.parts;
    const mk = (tx, part) => { const s = new PIXI.Sprite(frame('hero/' + tx)); const a = rig[part].anchor; s.anchor.set(a[0] / s.texture.width, a[1] / s.texture.height); hero.addChild(s); return s; };
    hp.back = mk('back', 'back'); hp.armL = mk('arm', 'armL'); hp.handL = mk('hand', 'handL'); hp.armL.scale.x = hp.handL.scale.x = -1;
    hp.legL = mk('leg', 'legL'); hp.legR = mk('leg', 'legR'); hp.body = mk('body', 'body'); hp.head = mk('head', 'head');
    hp.book = new PIXI.Sprite(frame('hero/book')); hp.book.anchor.set(0.5, 0.65); hero.addChild(hp.book);
    hp.armR = mk('arm', 'armR'); hp.handR = mk('hand', 'handR');
    hero.scale.set(ART);
  }
  // Rotate (x, y) around the origin by a (radians).
  const rx = (x, y, a) => x * Math.cos(a) - y * Math.sin(a), ry = (x, y, a) => x * Math.sin(a) + y * Math.cos(a);
  function applyPose() {
    const p = pose, F = kit.rig.feet, R = rig;
    const bob = p.bob, lean = p.lean * D2R;
    const hx = HIP[0] - F[0], hy = HIP[1] - F[1] + bob;
    const at = (pt, a) => [hx + rx(pt[0] - HIP[0], pt[1] - HIP[1], a), hy + ry(pt[0] - HIP[0], pt[1] - HIP[1], a)];
    // legs hang from the pelvis (they do not lean with the torso)
    for (const s of ['L', 'R']) {
      const leg = hp['leg' + s], j = R['leg' + s].at, a = (s === 'L' ? p.legL : p.legR);
      leg.x = j[0] - F[0]; leg.y = j[1] - F[1] + bob * 0.6; leg.rotation = -a * D2R;
      const bent = s === 'L' ? p.bend & 1 : p.bend & 2;
      const t = bent ? frame('hero/legBend') : frame('hero/leg'); if (leg.texture !== t) leg.texture = t;
    }
    const b = at(R.body.at, lean); hp.body.x = b[0]; hp.body.y = b[1]; hp.body.rotation = lean;
    hp.body.scale.set(1 + p.breath * 0.6, 1 + p.breath);
    const n = at(NECK, lean), ha = lean + p.head * D2R;
    hp.head.x = n[0]; hp.head.y = n[1] - p.breath * 40 + 4; hp.head.rotation = ha;
    hp.back.x = hp.head.x + rx(0, -14, ha); hp.back.y = hp.head.y + ry(0, -14, ha); hp.back.rotation = ha;
    for (const s of ['L', 'R']) {
      const arm = hp['arm' + s], hand = hp['hand' + s], sh = at(R['arm' + s].at, lean), off = R['hand' + s].at;
      const a = lean - (s === 'L' ? p.armL : p.armR) * D2R;
      arm.x = sh[0]; arm.y = sh[1] - p.breath * 30; arm.rotation = a;
      hand.x = arm.x + rx(off[0], off[1], a); hand.y = arm.y + ry(off[0], off[1], a); hand.rotation = a - (s === 'L' ? p.handL : p.handR) * D2R;
    }
    hp.book.visible = H.book > 0.02; hp.book.alpha = H.book;
    if (hp.book.visible) { hp.book.x = (hp.handL.x + hp.handR.x) / 2 + 4; hp.book.y = (hp.handL.y + hp.handR.y) / 2 + 2; hp.book.rotation = lean - 0.08; }
    let sx = p.sx, sy = p.sy;
    if (H.sq > 0) { const a = Math.sin(Math.PI * (1 - H.sq / H.sqD)) * H.sqA; sx *= 1 + a * 0.8; sy *= 1 - a; }
    hero.scale.set(ART * sx, ART * sy);
    hero.x = H.x; hero.y = H.y;
    shadow.x = H.x; shadow.y = H.gy + 1; const k = clamp(1 - (H.gy - H.y) / 90, 0.35, 1); shadow.scale.set(0.9 * k, 0.9 * k); shadow.alpha = 0.42 * k;
  }
  function setFace(f) { const t = frame('hero/' + f); if (hp.head.texture !== t) hp.head.texture = t; }
  function squash(d, a) { if (RM) return; H.sq = H.sqD = d; H.sqA = a; }
  // Target pose for the current state; t is the state clock, ph the stride phase (0..1 per step pair).
  function target(dt) {
    const w = want, t = H.t, st = H.st;
    w.bob = 0; w.lean = 0; w.sx = 1; w.sy = 1; w.head = 0; w.armL = 4; w.armR = 4; w.handL = 0; w.handR = 0; w.legL = 0; w.legR = 0; w.bend = 0;
    w.breath = RM ? 0 : Math.sin(ambT * 2.3) * 0.018;
    let face = 'head';
    if (st === 'run') {
      const a = Math.sin(H.phase * 2 * Math.PI);
      w.legL = a * 30; w.legR = -a * 30; w.bend = a > 0.2 ? 1 : a < -0.2 ? 2 : 0;
      w.armL = -a * 34; w.armR = a * 34; w.handL = w.handR = 18; w.lean = 7; w.bob = -Math.abs(Math.cos(H.phase * 2 * Math.PI)) * 7 + 3; w.breath = 0;
    } else if (st === 'step') {               // climbing a stair: knee up on the leading leg, body leaning in
      const a = H.stepP, lead = H.stepN & 1;
      const up = Math.sin(Math.PI * a);
      if (lead) { w.legR = 38 * up + 8; w.legL = -12 * up; w.bend = 2; } else { w.legL = 38 * up + 8; w.legR = -12 * up; w.bend = 1; }
      w.armL = lead ? 40 * up : -30 * up; w.armR = lead ? -30 * up : 40 * up; w.handL = w.handR = 20; w.lean = 11; w.bob = 2; w.breath = 0;
    } else if (st === 'crouch') {             // anticipation before a jump
      const a = easeOut(clamp(t / 0.09, 0, 1));
      w.bob = 16 * a; w.sx = 1 + 0.08 * a; w.sy = 1 - 0.1 * a; w.lean = 14 * a; w.armL = w.armR = -40 * a; w.legL = 10 * a; w.legR = -6 * a; w.bend = 3;
    } else if (st === 'jump') {
      w.armL = 150; w.armR = 120; w.handL = w.handR = -20; w.legL = 34; w.legR = -18; w.bend = 3; w.lean = 6; w.sx = 0.94; w.sy = 1.07; w.bob = -4;
    } else if (st === 'fall') {
      w.armL = 160; w.armR = 140; w.handL = w.handR = -10; w.legL = 12; w.legR = -10; w.bend = 0; w.lean = 2; w.sx = 0.97; w.sy = 1.04;
    } else if (st === 'land') {
      const a = 1 - clamp(t / 0.14, 0, 1);
      w.bob = 14 * a; w.armL = w.armR = 30 * a; w.legL = 12 * a; w.legR = -8 * a; w.bend = a > 0.3 ? 3 : 0;
    } else if (st === 'lift') {               // riding the lift, holding the chain, looking up at the next ledge
      w.armR = 168; w.handR = -30; w.armL = 8 + Math.sin(ambT * 1.7) * 3; w.head = -13; w.lean = -2; face = 'headFocus';
    } else if (st === 'read') {               // reading the MCQ: holding a book, focused
      w.armL = 62; w.armR = 58; w.handL = 30; w.handR = 34; w.head = 9 + Math.sin(ambT * 0.9) * 1.5; w.lean = 3; face = 'headFocus';
    } else if (st === 'happy') {              // after a correct answer: a hop with both arms up, happy eyes
      const a = clamp(t / 0.5, 0, 1), hop = Math.sin(Math.PI * Math.min(1, a * 1.15));
      w.bob = -hop * 22 + (a < 0.12 ? 10 * (1 - a / 0.12) : 0); w.armL = 165 - 25 * Math.sin(t * 14) * (1 - a); w.armR = 165; w.handL = w.handR = -25;
      w.legL = hop * 20; w.legR = -hop * 12; w.bend = hop > 0.3 ? 3 : 0; face = t < 1.4 ? 'headHappy' : 'head';
      if (t > 1.0) { const b = clamp((t - 1.0) / 0.35, 0, 1); w.armL = lerp(w.armL, 62, b); w.armR = lerp(w.armR, 58, b); w.handL = w.handR = lerp(-25, 32, b); w.bob *= 1 - b; }
    } else if (st === 'calm') {               // after a wrong answer: a calm, supportive nod with a hand on the heart
      const a = clamp(t / 0.35, 0, 1);
      w.armR = 70 * a; w.handR = 85 * a; w.armL = 8; w.head = Math.sin(clamp(t, 0, 1.2) * 2 * Math.PI / 0.6) * 6 * (t < 1.2 ? 1 : 0) + 3;
      if (t > 1.6) { const b = clamp((t - 1.6) / 0.4, 0, 1); w.armR = lerp(70, 58, b); w.handR = lerp(85, 34, b); w.armL = lerp(8, 62, b); w.handL = 30 * b; face = 'headFocus'; }
    } else if (st === 'cheer') {              // at the summit
      const k = (t % 0.55) / 0.55, hop = Math.sin(Math.PI * k);
      w.bob = -hop * 26; w.armL = 160 + Math.sin(t * 12) * 12; w.armR = 160 - Math.sin(t * 12) * 12; w.handL = w.handR = -30; w.bend = hop > 0.3 ? 3 : 0; face = 'headHappy';
    } else {                                  // idle: breathing, a slow arm sway, a look around now and then
      w.armL = 5 + Math.sin(ambT * 1.1) * 2; w.armR = 5 + Math.sin(ambT * 1.1 + 1) * 2; w.head = Math.sin(ambT * 0.45) * 2.5;
      if (H.look > 0) w.head -= 8 * Math.sin(Math.PI * clamp(1 - H.look / 1.6, 0, 1));
    }
    // blink every few seconds (not while the eyes are already closed or focused-surprised)
    if (!RM) {
      H.blinkT -= dt;
      if (H.blinkT < 0) { if (face === 'head' || face === 'headFocus') face = 'headBlink'; if (H.blinkT < -0.12) H.blinkT = 2.2 + rnd() * 2.6; }
    }
    setFace(face);
    if (st === 'read' || (st === 'happy' && t > 1.0) || (st === 'calm' && t > 1.6)) H.book = Math.min(1, H.book + dt * 6); else H.book = Math.max(0, H.book - dt * 8);
  }
  function stepPose(dt) {
    target(dt);
    const k = RM ? 1 : 1 - Math.exp(-dt * (H.st === 'run' || H.st === 'step' ? 30 : 16));
    for (const key in want) if (key !== 'bend') pose[key] += (want[key] - pose[key]) * k;
    pose.bend = want.bend;
    applyPose();
  }
  function heroState(s) { if (H.st !== s) { H.st = s; H.t = 0; } }

  /* ---------- movement plan: walk, stair steps, jump with anticipation, lift ---------- */
  const plan = [];
  let pi = 0, pt = 0, planOn = false, onArrive = null;
  const Wk = (x0, y0, x1, y1, d, e) => plan.push({ k: 0, x0, y0, x1, y1, d, e: e || 0 });
  const St = (x0, y0, x1, y1, d, n) => plan.push({ k: 1, x0, y0, x1, y1, d, n });
  const Jp = (x0, y0, x1, y1, d, h) => plan.push({ k: 3, x0, y0, x1, y1, d, h });
  const Cr = (x, y, d) => plan.push({ k: 4, x0: x, y0: y, x1: x, y1: y, d });
  const Lf = (x, y0, y1, d, lift) => plan.push({ k: 2, x0: x, y0, x1: x, y1, d, lift });
  function planMove(i) {
    const a = L[i], b = L[i + 1], k = kinds[i];
    if (k === 'lift') {
      const lf = lifts.find(l => l.i === i), mx = lf.x + LIFT_W / 2;
      Wk(stand(i), a.y, mx, a.y, 260, 2); Lf(mx, a.y, b.y, 760, lf); Wk(mx, b.y, stand(i + 1), b.y, 200, 1);
    } else if (k === 'jump') {
      const edge = a.x + LW - 14;
      Wk(stand(i), a.y, edge, a.y, 190, 2); Cr(edge, a.y, 90); Jp(edge, a.y, b.x + 18, b.y, 320, 46); Wk(b.x + 18, b.y, stand(i + 1), b.y, 110, 1);
    } else {
      const edge = a.x + LW - 12, ss = steps.filter(s => s.i === i);
      Wk(stand(i), a.y, edge, a.y, 190, 2);
      let px = edge, py = a.y;
      ss.forEach((s, n) => { St(px, py, s.x + STEP_W / 2, s.y, 112, n); px = s.x + STEP_W / 2; py = s.y; });
      St(px, py, b.x + 16, b.y, 112, 3); Wk(b.x + 16, b.y, stand(i + 1), b.y, 90, 1);
    }
  }
  function begin(cb) { pi = 0; pt = 0; onArrive = cb; if (RM) finishPlan(); else { planOn = true; wake(); } }
  let lastX = 0;
  function stepPlan(ms) {
    pt += ms;
    let s;
    while (pi < plan.length && pt >= plan[pi].d) {
      s = plan[pi]; pt -= s.d; pi++;
      H.x = s.x1; H.y = H.gy = s.y1;
      if (s.k === 3) { squash(0.13, 0.13); heroState('land'); dust(H.x, H.y, 7); sfx('land'); }
      if (s.k === 1) { dust(H.x, H.y, 2); sfx('step'); }
      if (s.k === 2) { s.lift.y = s.y1; s.lift.on = false; }
      if (s.k === 4) { dust(H.x, H.y, 4); sfx('jump'); }
    }
    if (pi >= plan.length) { arrive(); return; }
    s = plan[pi];
    const p = pt / s.d;
    if (s.k === 0) {
      const e = s.e === 1 ? easeOut(p) : s.e === 2 ? easeInOut(p) : p;
      H.x = lerp(s.x0, s.x1, e); H.y = H.gy = s.y0;
      if (H.st !== 'land' || H.t > 0.1) heroState('run');
    } else if (s.k === 1) {
      H.x = lerp(s.x0, s.x1, p); H.gy = lerp(s.y0, s.y1, p > 0.5 ? 1 : 0);
      H.y = lerp(s.y0, s.y1, easeOut(p)) - Math.sin(Math.PI * p) * 9;
      heroState('step'); H.stepP = p; H.stepN = s.n;
    } else if (s.k === 4) { heroState('crouch'); H.y = H.gy = s.y0; }
    else if (s.k === 3) {
      H.x = lerp(s.x0, s.x1, p); H.gy = p < 0.85 ? Math.min(s.y0, s.y0 + 400) : s.y1;
      H.y = lerp(s.y0, s.y1, easeOut(p)) - Math.sin(Math.PI * p) * s.h;
      heroState(p < 0.48 ? 'jump' : 'fall'); if (p > 0.85) H.gy = s.y1;
    } else {
      const e = p < 0.5 ? 4 * p * p * p : 1 - 4 * (1 - p) * (1 - p) * (1 - p);
      H.y = H.gy = lerp(s.y0, s.y1, e); s.lift.y = H.y; heroState('lift');
      if (!s.lift.on) { s.lift.on = true; sfx('lift'); }
    }
    // stride locked to the distance walked, so the feet never slide
    if (H.st === 'run') H.phase = (H.phase + Math.abs(H.x - lastX) / 64) % 1;
    lastX = H.x;
  }
  function finishPlan() {
    for (; pi < plan.length; pi++) { const s = plan[pi]; if (s.k === 2) { s.lift.y = s.y1; s.lift.on = false; } }
    const s = plan[plan.length - 1];
    H.x = s.x1; H.y = H.gy = s.y1; arrive();
  }
  function arrive() {
    planOn = false; plan.length = 0; pi = 0;
    if (!RM) squash(0.16, 0.08);
    heroState('idle');
    const cb = onArrive; onArrive = null;
    if (cb) cb();
  }

  /* ---------- particles: one pool for dust, sparkles, confetti, fireworks and leaves ---------- */
  const parts = [];
  const CONF = [0xff5a5f, 0xffc93c, 0x3ec1d3, 0x7bd389, 0x9b7bff, 0xff8fb1];
  function emit(kind, x, y, vx, vy, life) {
    let p = null;
    for (let i = 0; i < parts.length; i++) if (!parts[i].s.visible) { p = parts[i]; break; }
    if (!p) return null;
    const s = p.s; s.visible = true; s.x = x; s.y = y; s.alpha = 1; s.rotation = 0;
    p.vx = vx; p.vy = vy; p.t = 0; p.l = life; p.kind = kind; p.spin = 0; p.g = 0; p.drag = 0; p.grow = 0;
    if (kind === 'dust') { s.texture = frame('fx/puff' + ((rnd() * 7) | 0)); s.tint = night ? 0x9aa3c8 : 0xf3eadc; s.blendMode = 'normal'; s.scale.set(0.16 + rnd() * 0.08); p.grow = 0.28; p.drag = 3; p.g = -10; }
    else if (kind === 'spark') { s.texture = frame('fx/star_06'); s.tint = 0xfff1b0; s.blendMode = 'add'; s.scale.set(0.12 + rnd() * 0.12); p.spin = (rnd() - 0.5) * 6; p.drag = 2; }
    else if (kind === 'confetti') { s.texture = frame('fx/confetti'); s.tint = CONF[(rnd() * 6) | 0]; s.blendMode = 'normal'; s.scale.set(0.55 + rnd() * 0.35); p.g = 260; p.drag = 1.4; p.spin = (rnd() - 0.5) * 14; }
    else if (kind === 'fire') { s.texture = frame('fx/spark_05'); s.tint = CONF[(rnd() * 6) | 0]; s.blendMode = 'add'; s.scale.set(0.16); p.g = 60; p.drag = 1.2; }
    return p;
  }
  function dust(x, y, n) { if (RM) return; for (let i = 0; i < n; i++) emit('dust', x + (rnd() - 0.5) * 18, y - 2, (rnd() - 0.5) * 70, -rnd() * 20, 0.5 + rnd() * 0.25); }
  function sparkle(x, y, n, sp) { if (RM) return; for (let i = 0; i < n; i++) { const a = rnd() * 6.28, v = (sp || 60) * (0.4 + rnd()); emit('spark', x, y, Math.cos(a) * v, Math.sin(a) * v, 0.45 + rnd() * 0.35); } }
  function confetti(x, y, n) { if (RM) return; for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (rnd() - 0.5) * 2.0, v = 200 + rnd() * 220; emit('confetti', x, y, Math.cos(a) * v, Math.sin(a) * v, 1.8 + rnd() * 0.8); } }
  function firework(x, y) { if (RM) return; const c = CONF[(rnd() * 6) | 0]; for (let i = 0; i < 22; i++) { const a = i / 22 * 6.28, v = 110 + rnd() * 30; const p = emit('fire', x, y, Math.cos(a) * v, Math.sin(a) * v, 1.0 + rnd() * 0.3); if (p) p.s.tint = c; } }
  function stepParts(dt) {
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i], s = p.s; if (!s.visible) continue;
      p.t += dt; if (p.t >= p.l) { s.visible = false; continue; }
      const f = Math.exp(-p.drag * dt);
      p.vx *= f; p.vy = p.vy * f + p.g * dt; s.x += p.vx * dt; s.y += p.vy * dt; s.rotation += p.spin * dt;
      const k = p.t / p.l;
      if (p.kind === 'confetti') { s.scale.y = Math.abs(Math.cos(p.t * 9 + i)) * 0.8 + 0.1; s.alpha = k > 0.8 ? (1 - k) / 0.2 : 1; }
      else { if (p.grow) s.scale.set(s.scale.x + p.grow * dt); s.alpha = 1 - k * k; }
    }
  }
  const anyParts = () => { for (let i = 0; i < parts.length; i++) if (parts[i].s.visible) return true; return false; };

  /* ---------- coins, signs, flags ---------- */
  const coin = { on: false, t: 0, i: 0, x0: 0, y0: 0, cb: null, trail: 0 };
  let xpText, xp10, xp5, xpT = 0;
  function setSign(i, st) {
    const s = signs[i];
    s.st = st; s.badge.visible = st !== 0; if (st) s.badge.texture = frame(st === 1 ? 'ui/ok' : 'ui/flag');
    s.badge.pop = st ? 0 : 1; s.badge.scale.set(st ? 0.01 : 0.36);
    const c = coins[i];
    c.visible = st !== 0; c.gold = st === 1; c.s.texture = frame(st === 1 ? 'item/coinGold' : 'item/coinSilver');
    c.x = signX(i); c.y = L[i].y - 92; c.pop = st ? 0 : 1; c.glow.tint = st === 1 ? 0xffd75a : 0xdfe8ff;
  }
  function coinStart(i, gold, cb) {
    const c = coins[i];
    coin.on = true; coin.t = 0; coin.i = i; coin.cb = cb; coin.x0 = c.x; coin.y0 = c.y; c.visible = true; c.pop = 1;
    xpText.text = gold ? '+10 XP' : '+5 XP'; xpText.visible = false;
  }
  function coinCollect() {
    const c = coins[coin.i];
    c.visible = false; coin.on = false;
    sparkle(H.x, H.y - 46, 14, 90);
    if (!RM) { xpText.visible = true; xpText.x = H.x; xpText.y = H.y - 96; xpText.alpha = 1; xpText.scale.set(0.6); xpT = 0; }
    const cb = coin.cb; coin.cb = null;
    if (cb) cb(coin.i);
  }
  function raiseFlag(i) {
    const f = flags[i]; if (!f || f.up) return;
    f.up = true; f.t = RM ? 1 : 0; f.s.texture = frame('item/flagGreen1'); if (!RM) sfx('flag');
  }

  /* ---------- camera: springs with look-ahead, and two framings (walking, MCQ open) ---------- */
  const cam = { x: 0, y: 0, vx: 0, vy: 0, fy: 0.56, fy0: 0.56, fy1: 0.56, ft: 1, ahead: 0 };
  function feetY(mode) { return mode === 'sheet' ? Math.max(150, Math.round(VH * 0.235)) / VH : mode === 'start' ? 0.47 : 0.56; }
  function camTarget(out) { out[0] = H.x + cam.ahead - (VW / Z) * 0.36; out[1] = H.y - (VH / Z) * cam.fy; return out; }
  const tgt = [0, 0];
  function snapCam() { cam.fy = cam.fy1; cam.ft = 1; cam.ahead = 0; camTarget(tgt); cam.x = tgt[0]; cam.y = tgt[1]; cam.vx = cam.vy = 0; }
  function stepCam(dt) {
    if (cam.ft < 1) { cam.ft = Math.min(1, cam.ft + dt / 0.24); cam.fy = lerp(cam.fy0, cam.fy1, easeInOut(cam.ft)); }
    const goAhead = planOn ? 56 : summitView ? 80 : 0;
    cam.ahead += (goAhead - cam.ahead) * (1 - Math.exp(-dt * 3));
    camTarget(tgt);
    // critically damped springs (no overshoot), a little softer vertically
    const sp = (pos, vel, to, w) => { const x = pos - to, e = Math.exp(-w * dt), a = (vel + w * x) * dt; return [to + (x + a) * e, (vel - w * a) * e]; };
    const X = sp(cam.x, cam.vx, tgt[0], 9), Y = sp(cam.y, cam.vy, tgt[1], 7.5);
    cam.x = X[0]; cam.vx = X[1]; cam.y = Y[0]; cam.vy = Y[1];
    camMoving = Math.abs(tgt[0] - cam.x) + Math.abs(tgt[1] - cam.y) > 0.25 || Math.abs(cam.vx) + Math.abs(cam.vy) > 1;
    if (!camMoving) { cam.x = tgt[0]; cam.y = tgt[1]; cam.vx = cam.vy = 0; }
  }

  /* ---------- the loop ---------- */
  let summitView = false;
  let awake = false, ambT = 0, built = false, camMoving = false, celebT = 0, running = false, paused = false;
  const busy = () => planOn || coin.on || xpText.visible || H.sq > 0 || celebT > 0 || anyParts() || cam.ft < 1 || camMoving || popping() || flagMoving() || H.st === 'happy' || H.st === 'calm';
  const popping = () => { for (let i = 0; i < coins.length; i++) if ((coins[i].visible && coins[i].pop < 1) || signs[i].badge.pop < 1) return true; return false; };
  const flagMoving = () => { for (const f of flags) if (f.up && f.t < 1) return true; return false; };
  // Ambient life (story mode, not reduced motion): the world keeps breathing at 30 fps while an MCQ is open.
  const ambient = () => !RM && !paused && (window.__lab ? window.__lab.mode === 'story' || window.__lab.state === 'start' || window.__lab.state === 'loading' : true);

  function update(dt) {
    ambT += dt; H.t += dt;
    if (planOn) stepPlan(dt * 1000);
    if (H.sq > 0) H.sq = Math.max(0, H.sq - dt);
    if (H.st === 'land' && H.t > 0.16 && !planOn) heroState('idle');
    if (H.st === 'idle' && !RM) { H.look -= dt; if (H.look < -6 - rnd() * 6) H.look = 1.6; }
    if (H.st === 'happy' && H.t > 1.5) heroState(H.after || 'idle');
    if (H.st === 'calm' && H.t > 2.1) heroState(H.after || 'idle');
    if (celebT > 0) {
      celebT -= dt;
      if (!RM && ((celebT * 10) | 0) % 4 === 0 && rnd() < 0.15) firework(beacon.x + (rnd() - 0.5) * 260, beacon.y - 120 - rnd() * 140);
      if (celebT <= 0) { heroState('idle'); squash(0.16, 0.08); }
    }
    stepPose(dt);
    // coin: rises from its sign, then flies to the hero with a sparkle trail (0.45 s)
    if (coin.on) {
      const c = coins[coin.i], t = (coin.t += dt);
      if (t < 0.2) { c.y = coin.y0 - 18 * easeOut(t / 0.2); c.x = coin.x0; }
      else if (t < 0.45) {
        const e = ((t - 0.2) / 0.25) ** 2;
        c.x = lerp(coin.x0, H.x, e); c.y = lerp(coin.y0 - 18, H.y - 50, e) - Math.sin(Math.PI * e) * 30;
        coin.trail += dt; if (coin.trail > 0.016) { coin.trail = 0; const p = emit('spark', c.x, c.y, 0, 0, 0.35); if (p) p.s.scale.set(0.1); }
      } else coinCollect();
    }
    for (let i = 0; i < coins.length; i++) {
      const c = coins[i];
      if (!c.visible) continue;
      if (c.pop < 1) { c.pop = Math.min(1, c.pop + dt / 0.32); }
      const e = c.pop, bounce = easeOut(e) * (1 + 0.25 * Math.sin(Math.PI * e));
      c.s.scale.set(0.34 * bounce * Math.cos(ambT * 4.2 + i), 0.34 * bounce);
      c.glow.scale.set(0.7 + 0.08 * Math.sin(ambT * 5 + i)); c.glow.alpha = 0.55 * bounce;
      if (!coin.on || coin.i !== i) c.y = L[i].y - 92 + Math.sin(ambT * 2.4 + i) * 3;
      const b = signs[i].badge;
      if (b.pop < 1) { b.pop = Math.min(1, b.pop + dt / 0.3); b.scale.set(0.36 * easeOut(b.pop) * (1 + 0.3 * Math.sin(Math.PI * b.pop))); }
    }
    if (xpText.visible) { xpT += dt; xpText.x = H.x; xpText.y = H.y - 104 - xpT * 36; xpText.scale.set(Math.min(1, 0.6 + xpT * 4)); xpText.alpha = xpT < 0.55 ? 1 : Math.max(0, 1 - (xpT - 0.55) / 0.35); if (xpT > 0.9) xpText.visible = false; }
    // checkpoint flags: the flag runs up the pole (the waving flag grows from the ground), then waves
    for (const f of flags) {
      if (!f.up) continue;
      if (f.t < 1) { f.t = Math.min(1, f.t + dt / 0.55); const e = f.t, b = 1 + 2.2 * (e - 1) ** 3 + 1.2 * (e - 1) ** 2; f.s.scale.y = f.sc * lerp(0.35, 1, b); if (f.t >= 1) sparkle(f.x + 24, f.y - 54, 8, 50); }
      if (!RM) f.s.texture = frame(((ambT * 5 + f.o) | 0) % 2 ? f.a : f.b);
    }
    for (const l of lifts) { l.c.y = l.y; for (const ch of l.chains) { ch.y = l.top; ch.height = Math.max(8, l.y - l.top); } }
    stepParts(dt);
    if (!RM) stepAmbient(dt);
    stepCam(dt);
    place();
  }

  // Ambient life: clouds drift, birds cross the sky now and then, waterfalls run, leaves (day) or fireflies (night)
  // float, torches flicker, stars twinkle, the beacon pulses.
  const birds = { t: 4, on: false, x: 0, y: 0, v: 0, list: [] }, floaters = [];
  function stepAmbient(dt) {
    for (const c of cloudsC.children) { c.x += c.v * dt; if (c.x > c.span) c.x -= c.span + 400; }
    birds.t -= dt;
    if (!birds.on && birds.t < 0) { birds.on = true; birds.x = -80; birds.y = VH * (0.12 + rnd() * 0.18); birds.v = 46 + rnd() * 20; birds.list.forEach((b, k) => { b.visible = true; b.o = rnd() * 6; b.dx = -k * 34 - rnd() * 10; b.dy = (k % 2 ? 1 : -1) * (k * 9 + rnd() * 6); }); }
    if (birds.on) {
      birds.x += birds.v * dt;
      birds.list.forEach(b => { b.x = birds.x + b.dx; b.y = birds.y + b.dy + Math.sin(ambT * 2 + b.o) * 4; b.texture = frame('fx/bird' + (((ambT * 9 + b.o) | 0) % 3)); });
      if (birds.x > VW + 220) { birds.on = false; birds.t = 9 + rnd() * 8; birds.list.forEach(b => { b.visible = false; }); }
    }
    for (const w of falls) { w.s.tilePosition.y += dt * 230; w.foam.alpha = 0.35 + 0.15 * Math.sin(ambT * 9 + w.o); w.foam.scale.set(w.fs * (1 + 0.06 * Math.sin(ambT * 7 + w.o))); }
    for (const f of floaters) {
      f.t += dt;
      if (night) { f.s.x = f.x + Math.sin(f.t * 0.7 + f.o) * 26; f.s.y = f.y + Math.sin(f.t * 1.1 + f.o * 2) * 16; f.s.alpha = 0.35 + 0.65 * Math.max(0, Math.sin(f.t * 2.2 + f.o)); }
      else {
        f.s.x += (f.vx + Math.sin(f.t * 1.3 + f.o) * 12) * dt; f.s.y += f.vy * dt; f.s.rotation += f.spin * dt; f.s.scale.y = 0.42 * Math.cos(f.t * 3 + f.o);
        if (f.s.y > VH + 30 || f.s.x > VW + 40) { f.s.x = -20 + rnd() * VW * 0.6; f.s.y = -20 - rnd() * 80; }
      }
    }
    for (const t of torches) t.g.alpha = (night ? 0.75 : 0.25) + 0.12 * Math.sin(ambT * 13 + t.o) + 0.06 * Math.sin(ambT * 29 + t.o);
    if (starsC.visible) for (let i = 0; i < starsC.children.length; i++) { const s = starsC.children[i]; s.alpha = 0.45 + 0.55 * Math.abs(Math.sin(ambT * s.v + s.o)); }
    beaconGlow.scale.set((celebT > 0 || beacon.lit ? 2.3 : 1.4) * (1 + 0.06 * Math.sin(ambT * 3)));
    if (godray) godray.time = ambT * 0.12;
  }

  // Positions every layer from the camera (parallax x / y factors in brackets): sky fixed, far range (0.03 / 0.02),
  // the landmark peak (0.05 / 0.04), clouds (0.1), mid range (0.12 / 0.1), near hills (0.28 / 0.24), world 1,
  // foreground plants (1.35).
  function place() {
    const cx = cam.x, cy = cam.y, X = Math.round(cx * Z * 2) / 2, Y = Math.round(cy * Z * 2) / 2;
    worldC.x = -X; worldC.y = -Y;
    const hz = VH * 0.62 - cy * Z * 0.02;                       // horizon line on screen
    lay.far.y = hz - lay.far.height * 0.62 - cy * Z * 0.0; lay.far.tilePosition.x = -cx * 0.03 * Z;
    lay.peak.x = VW * 0.72 - (cx - L[N].x * 0.5) * 0.05 * Z; lay.peak.y = hz - cy * Z * 0.04 + 20 * Z;
    cloudsC.x = -cx * 0.1 * Z; cloudsC.y = -cy * 0.08 * Z;
    lay.mid.y = hz - lay.mid.height * 0.3 - cy * Z * 0.1; lay.mid.tilePosition.x = -cx * 0.12 * Z;
    lay.fog.y = lay.mid.y + lay.mid.height * 0.45;
    lay.near.y = hz + 40 * Z - cy * Z * 0.24; lay.near.tilePosition.x = -cx * 0.28 * Z;
    lay.nearFill.y = lay.near.y + lay.near.height - 2; lay.nearFill.height = Math.max(0, VH - lay.nearFill.y);
    for (const f of fgs) { const sx = (f.wx - cx * 1.35) * Z; f.s.x = ((sx % f.span) + f.span) % f.span - 400 * Z; f.s.y = VH + 12 * Z; }
    // cull the world by x (a few dozen objects)
    const x0 = cx - 160, x1 = cx + VW / Z + 160;
    for (const c of backC.children) if (c.wx != null) c.visible = c.wx < x1 && c.wx + c.ww > x0;
    for (const c of midC.children) if (c.wx != null) c.visible = c.wx < x1 && c.wx + c.ww > x0;
  }

  // Script time per frame for the harness: the start of update to the end of render submission, in ms.
  const ST = new Float32Array(4096); let stN = 0, stT0 = 0;
  // Quality governor: if frames keep running long while the world moves (a weak GPU), step the quality down after
  // 8 slow frames or 0.6 s: resolution 1.5, then 1, then no light rays, then no colour grading. Never steps back up.
  let qStep = 0, qN = 0, qSum = 0;
  const QSTEPS = [() => setRes(1.5), () => setRes(1), () => { if (godray) bgC.filters = null; }, () => { root.filters = null; }];
  function setRes(r) { if (app.renderer.resolution > r) app.renderer.resize(VW, VH, r); }
  function govern(ms) {
    if (!(awake || planOn) || qStep >= QSTEPS.length || ms > 1000) { qN = qSum = 0; return; }
    qSum += ms; qN++;
    if (qN < 8 && qSum < 600) return;
    if (qSum / qN > 28) QSTEPS[qStep++]();
    qN = qSum = 0;
  }
  function tick(t) {
    stT0 = performance.now();
    govern(t.deltaMS);
    // Time-based: a slow frame moves things further instead of stretching the climb (the ticker restarts its clock
    // after a pause, so the clamp only guards against a stall).
    const dt = Math.min(250, t.deltaMS) / 1000;
    update(dt);
  }
  function tickEnd() {
    ST[stN % ST.length] = performance.now() - stT0; stN++;
    const amb = ambient();
    if (!awake && !busy() && !amb) { app.ticker.stop(); running = false; }
    app.ticker.maxFPS = awake || busy() ? 0 : 30;
  }
  function wake() { awake = true; app && (app.ticker.maxFPS = 0); if (!running && !paused && app) { running = true; app.ticker.start(); } }
  function kick() { if (!running && !paused && app) { running = true; app.ticker.start(); } }

  /* ---------- build the scene ---------- */
  function tiling(t, w, h) { return new PIXI.TilingSprite({ texture: t, width: w, height: h }); }
  function column(parent, x, y, w, depth, stone) {
    // A cliff column under a ledge: rock fill, grass (or stone) lip, shading on the sides, fog toward the bottom.
    const c = new PIXI.Container(); c.wx = x; c.ww = w; parent.addChild(c);
    // Few layers, little overdraw: rock texture only near the top, one shading gradient, one fog gradient, and below
    // that a single opaque fogged block (the valley haze) instead of rock under several transparent layers.
    const RD = 560;
    const fill = tiling(tex.dirt, w, RD); fill.tileScale.set(0.5); fill.x = x; fill.y = y + 16; fill.tilePosition.set(-x * 2, -y * 2);
    c.addChild(fill);
    const shade = new PIXI.Sprite(frame('fx/vgrad')); shade.x = x; shade.y = y + 16; shade.width = w; shade.height = 300; c.addChild(shade); c.shade = shade;
    const edgeL = new PIXI.Sprite(PIXI.Texture.WHITE); edgeL.x = x; edgeL.y = y + 16; edgeL.width = 7; edgeL.height = RD; edgeL.tint = 0x1a0d06; edgeL.alpha = 0.28; c.addChild(edgeL);
    const edgeR = new PIXI.Sprite(PIXI.Texture.WHITE); edgeR.x = x + w - 4; edgeR.y = y + 16; edgeR.width = 4; edgeR.height = 220; edgeR.tint = 0xffe8c8; edgeR.alpha = 0.22; c.addChild(edgeR); c.rim = edgeR;
    const fog = new PIXI.Sprite(frame('fx/vgrad')); fog.x = x; fog.y = y + 340; fog.width = w; fog.height = RD - 324; c.addChild(fog); c.fog = fog;
    const fogB = new PIXI.Sprite(PIXI.Texture.WHITE); fogB.x = x; fogB.y = y + 16 + RD - 1; fogB.width = w; fogB.height = depth - RD; c.addChild(fogB); c.fogB = fogB;
    // lip: half tiles across the top
    const tw = 128 * ART, n = Math.max(2, Math.round(w / tw));
    for (let k = 0; k < n; k++) {
      const name = stone ? (k === 0 ? 'tile/stoneHalf_left' : k === n - 1 ? 'tile/stoneHalf_right' : 'tile/stoneHalf_mid') : (k === 0 ? 'tile/grassHalf_left' : k === n - 1 ? 'tile/grassHalf_right' : 'tile/grassHalf_mid');
      const s = spr(name, x + k * (w / n), y - 2, 0, 0, c); s.scale.set((w / n) / 128, ART);
    }
    cols.push(c);
    return c;
  }
  const cols = [];
  function decorate(i) {
    // Each ledge gets its own small scene, seeded by its index (the same every run).
    seed = 1000 + i * 97;
    const l = L[i], x0 = l.x, y = l.y, w = l.w;
    const pick = a => a[(rnd() * a.length) | 0];
    const back = [], front = [];
    if (i % 3 !== 1) back.push([pick(['bg/treeSmall_green1', 'bg/treeSmall_green2', 'bg/treeSmall_green3', 'bg/treePine']), x0 + 12 + rnd() * 30, 0.36 + rnd() * 0.1]);
    if (i % 2 === 0) back.push([pick(['bg/bush1', 'bg/bush2', 'bg/bush3', 'bg/bush4']), x0 + w - 40 - rnd() * 20, 0.3]);
    front.push([pick(['prop/grass', 'prop/plantPurple', 'prop/grass']), x0 + 70 + rnd() * 10, ART * 0.8]);
    if (rnd() < 0.6) front.push(['prop/rock', x0 + w - 28, ART * 0.7]);
    if (i % 4 === 3) front.push(['prop/bush', x0 + 8, ART * 0.8]);
    for (const [n, x, s] of back) { const d = spr(n, x, y + 6, 0.5, 1, backDeco, s); d.wx = x - 60; d.ww = 120; d.tint = night ? 0x8d97c9 : 0xffffff; }
    for (const [n, x, s] of front) { const d = spr(n, x, y + 3, 0.5, 1, midC, s); d.wx = x - 40; d.ww = 80; d.tint = night ? 0x9aa3d0 : 0xffffff; }
    if (i % 3 === 2 || i === 0) { // a torch with a warm glow
      const tx = x0 + w - 8;
      const t = spr('prop/torch1', tx, y + 4, 0.5, 1, midC, ART * 0.7); t.wx = tx - 30; t.ww = 60;
      const g = spr('fx/glow', tx, y - 40, 0.5, 0.5, midC, 1.3); g.blendMode = 'add'; g.tint = 0xffb45a; g.wx = tx - 80; g.ww = 160;
      torches.push({ g, o: i * 1.7 });
    }
  }
  let backDeco, shadow;
  function build() {
    const st = app.stage;
    st.removeChildren();
    root = new PIXI.Container(); st.addChild(root);
    bgC = new PIXI.Container(); worldC = new PIXI.Container(); fgC = new PIXI.Container();
    root.addChild(bgC, worldC, fgC);
    // sky, sun or moon, stars
    lay.sky = new PIXI.Sprite(tex.sky); lay.sky.width = VW; lay.sky.height = VH; bgC.addChild(lay.sky);
    starsC = new PIXI.Container(); bgC.addChild(starsC);
    seed = 3;
    for (let i = 0; i < 70; i++) { const s = spr('fx/soft', rnd() * VW, rnd() * VH * 0.55, 0.5, 0.5, starsC, 0.05 + rnd() * 0.08); s.blendMode = 'add'; s.v = 0.5 + rnd() * 2; s.o = rnd() * 6; }
    lay.sunGlow = spr('fx/glow', VW * 0.8, VH * 0.16, 0.5, 0.5, bgC, 5); lay.sunGlow.blendMode = 'add';
    lay.sun = spr('fx/glow', VW * 0.8, VH * 0.16, 0.5, 0.5, bgC, 1.1); lay.sun.blendMode = 'add';
    lay.moon = spr('bg/moonFull', VW * 0.78, VH * 0.14, 0.5, 0.5, bgC, 0.5);
    lay.far = tiling(tex.far, VW, 300 * 1); lay.far.tileScale.set(1); lay.far.height = 300; bgC.addChild(lay.far); lay.far.scale.set(Z);
    lay.far.width = VW / Z;
    lay.peak = new PIXI.Sprite(tex.peak); lay.peak.anchor.set(0.5, 1); lay.peak.scale.set(0.62 * Z); bgC.addChild(lay.peak);
    cloudsC = new PIXI.Container(); bgC.addChild(cloudsC);
    seed = 11;
    for (let i = 0; i < 7; i++) {
      const c = spr('bg/cloud' + [1, 2, 3, 5, 6, 8, 2][i], i * 260 + rnd() * 120, VH * (0.08 + rnd() * 0.3), 0.5, 0.5, cloudsC, (0.35 + rnd() * 0.35) * Z);
      c.v = 6 + rnd() * 8; c.span = 2200; c.alpha = 0.85;
    }
    lay.mid = tiling(tex.mid, VW / Z, 420); lay.mid.scale.set(Z); bgC.addChild(lay.mid);
    lay.fog = new PIXI.Sprite(frame('fx/vgrad')); lay.fog.width = VW; lay.fog.height = 160 * Z; lay.fog.alpha = 0.5; bgC.addChild(lay.fog);
    birdsC = new PIXI.Container(); bgC.addChild(birdsC);
    birds.list = []; for (let k = 0; k < 4; k++) { const b = spr('fx/bird0', 0, 0, 0.5, 0.5, birdsC, 0.5 * Z); b.visible = false; birds.list.push(b); }
    lay.near = tiling(tex.near, VW / Z, 360); lay.near.scale.set(Z); bgC.addChild(lay.near);
    lay.nearFill = new PIXI.Sprite(PIXI.Texture.WHITE); lay.nearFill.width = VW; bgC.addChild(lay.nearFill);

    // the world
    worldC.scale.set(Z);
    backC = new PIXI.Container(); backDeco = new PIXI.Container(); midC = new PIXI.Container(); fxC = new PIXI.Container();
    worldC.addChild(backC, backDeco, midC, fxC);
    cols.length = 0; torches.length = 0; falls.length = 0; flags.length = 0;
    // waterfalls through the gaps (behind the cliffs), then the cliff columns
    const lips = [];
    for (let i = 0; i < N; i++) {
      if (kinds[i] !== 'jump') continue;
      // a spring bursts from the cliff face of the higher ledge and falls through the gap
      const x = L[i + 1].x - 30, top = L[i + 1].y + 34;
      const w = tiling(tex.waterfall, 22, COL_D); w.x = x; w.y = top; w.alpha = 0.8; w.wx = x - 10; w.ww = 60; backC.addChild(w);
      const lip = spr('fx/soft', x + 22, top + 2, 0.5, 0.5, null, 0.8); lip.alpha = 0.85; lip.wx = x - 20; lip.ww = 80; lips.push(lip);
      const foam = spr('fx/glow', x + 18, L[i].y + 150, 0.5, 0.5, backC, 1.5); foam.tint = 0xe6f6ff; foam.wx = x - 60; foam.ww = 160;
      falls.push({ s: w, foam, fs: 1.5, o: i });
    }
    // start ledge (wide) and the summit ledge
    column(backC, -START_W, 0, START_W + LW, COL_D);
    for (let i = 1; i < N; i++) column(backC, L[i].x, L[i].y, LW, COL_D);
    column(backC, L[N].x, L[N].y, SUMW, COL_D);
    for (const s of steps) column(backC, s.x, s.y, STEP_W + 1, COL_D, 'step');
    for (const lp of lips) backC.addChild(lp);
    // landmark: a stone cairn on the summit carrying a golden star beacon, and the summit pennant beside it
    const sx = L[N].x + SUMW - 100, sy = L[N].y;
    landmark = new PIXI.Container(); landmark.x = sx; landmark.y = sy + 4; landmark.wx = sx - 120; landmark.ww = 240; backDeco.addChild(landmark);
    [[-27, 0, 'tile/stoneMid'], [27, 0, 'tile/stoneMid'], [0, -52, 'tile/stoneMid'], [0, -100, 'tile/stoneHalf_mid']].forEach(([dx, dy, n]) => spr(n, dx, dy, 0.5, 1, landmark, ART));
    beaconGlow = spr('fx/glow', sx, sy - 150, 0.5, 0.5, backDeco, 1.4); beaconGlow.blendMode = 'add'; beaconGlow.tint = 0xffd36b; beaconGlow.wx = sx - 160; beaconGlow.ww = 320;
    beacon = spr('item/star', sx, sy - 112, 0.5, 1, backDeco, 0.62); beacon.wx = sx - 60; beacon.ww = 120; beacon.lit = false;
    if (FX && PIXI.filters && PIXI.filters.GlowFilter) { glow = new PIXI.filters.GlowFilter({ distance: 14, outerStrength: 2.2, color: 0xffd36b, quality: 0.2 }); beacon.filters = [glow]; }
    const bigFlag = spr('item/flagYellow1', sx + 62, sy + 4, 0.15, 1, backDeco, 0.75); bigFlag.wx = sx; bigFlag.ww = 120;
    flags.push({ x: sx, y: sy, up: true, t: 1, o: 0, s: bigFlag, sc: 0.75, a: 'item/flagYellow1', b: 'item/flagYellow2', big: true });
    for (let i = 0; i <= N; i++) decorate(i);
    // the start: a wooden sign and a fence
    startSign = spr('ui/plate', -150, 6, 0.5, 1, midC, 0.62); startSign.wx = -200; startSign.ww = 100;
    const stt = text('START', 15, 0xfff4dc, null); stt.y = -startSign.height / 0.62 + 24; stt.x = 0; stt.scale.set(1 / 0.62); startSign.addChild(stt);
    const fence = spr('bg/fence', -235, 6, 0.5, 1, backDeco, 0.4); fence.wx = -300; fence.ww = 120;
    // lifts: a log platform on two chains reaching above the view
    for (const l of lifts) {
      l.top = l.y1 - 420; l.c = new PIXI.Container(); l.c.x = l.x; l.c.y = l.y; l.c.wx = l.x - 20; l.c.ww = LIFT_W + 40;
      // two chains from a beam high above to both ends of a log platform
      l.chains = [4, LIFT_W - 14].map(dx => { const ch = tiling(frame('prop/chain'), 10, 40); ch.tileScale.set(ART * 0.36); ch.x = l.x + dx; ch.wx = l.x; ch.ww = LIFT_W; backC.addChild(ch); return ch; });
      const beam = new PIXI.Sprite(PIXI.Texture.WHITE); beam.x = l.x - 6; beam.y = l.top - 6; beam.width = LIFT_W + 12; beam.height = 10; beam.tint = 0x5a3b26; beam.wx = l.x; beam.ww = LIFT_W; backC.addChild(beam);
      const plank = spr('prop/bridgeA', -4, -4, 0, 0, l.c); plank.width = LIFT_W + 8; plank.height = 26;
      midC.addChild(l.c); l.on = false;
    }
    // signs (Q number plates), badges after grading, coins, checkpoint flags
    signs.length = 0; coins.length = 0;
    for (let i = 0; i < N; i++) {
      const sxi = signX(i), s = spr('ui/plate', sxi, L[i].y + 4, 0.5, 1, midC, 0.5); s.wx = sxi - 40; s.ww = 80;
      const tq = text('Q' + (i + 1), 34, 0xfff4dc, null); tq.y = -80; s.addChild(tq);
      const badge = spr('ui/ok', 40, -112, 0.5, 0.5, s, 0.36); badge.visible = false; badge.pop = 1;
      signs.push({ s, badge, st: 0 });
      const c = new PIXI.Container(); c.x = sxi; c.y = L[i].y - 92; c.wx = sxi - 40; c.ww = 80;
      c.glow = spr('fx/glow', 0, 0, 0.5, 0.5, c, 0.7); c.glow.blendMode = 'add';
      c.s = spr('item/coinGold', 0, 0, 0.5, 0.5, c, 0.34); c.visible = false; c.pop = 1; midC.addChild(c); coins.push(c);
      const fx0 = flagX(i), pole = spr('item/flagGreen_down', fx0, L[i].y + 4, 0.15, 1, midC, 0.5); pole.wx = fx0 - 20; pole.ww = 80;
      flags.push({ x: fx0, y: L[i].y, up: false, t: 0, o: i, s: pole, sc: 0.5, a: 'item/flagGreen1', b: 'item/flagGreen2', i });
    }
    shadow = spr('fx/shadow', 0, 0, 0.5, 0.5, midC, 0.9); shadow.alpha = 0.4;
    buildHero(midC);
    xpText = text('+10 XP', 26, 0xffe27a, fxC); xpText.visible = false;
    parts.length = 0;
    for (let i = 0; i < 110; i++) { const s = spr('fx/soft', 0, 0, 0.5, 0.5, fxC); s.visible = false; parts.push({ s, vx: 0, vy: 0, t: 0, l: 1, g: 0, spin: 0, drag: 0, grow: 0, kind: '' }); }
    // foreground: big soft fern silhouettes passing in front of the camera
    fgs.length = 0;
    for (let k = 0; k < 2; k++) { const s = spr(tex.fg, 0, 0, 0, 1, fgC, 0.62 * Z); fgs.push({ s, wx: k * 700 + 120, span: (700 * 1.35 + 400) * Z }); }
    // floaters: leaves by day, fireflies by night (screen space)
    floaters.length = 0; seed = 21;
    for (let k = 0; k < 7; k++) { const s = spr('fx/leaf', rnd() * VW, rnd() * VH, 0.5, 0.5, fgC, 0.42); floaters.push({ s, x: 40 + rnd() * (VW - 80), y: VH * (0.25 + rnd() * 0.5), vx: 14 + rnd() * 14, vy: 26 + rnd() * 16, spin: (rnd() - 0.5) * 3, t: rnd() * 9, o: rnd() * 6 }); }
    // vignette as two strips (top and bottom) instead of a full-screen layer: same look at the edges, far less fill
    vignette = new PIXI.Container(); root.addChild(vignette);
    const vt = new PIXI.Sprite(frame('fx/vgrad')); vt.width = VW; vt.height = 130; vt.scale.y *= -1; vt.y = 130; vt.tint = 0x0b1030; vignette.addChild(vt);
    const vb = new PIXI.Sprite(frame('fx/vgrad')); vb.y = VH - 120; vb.width = VW; vb.height = 120; vb.tint = 0x0b1030; vignette.addChild(vb);
    // filters: light rays over the sky and far layers, colour grading over everything
    if (FX && PIXI.filters) {
      godray = new PIXI.filters.GodrayFilter({ gain: 0.3, lacunarity: 2.4, parallel: false, center: { x: VW * 0.8, y: VH * 0.12 }, time: 0, alpha: 0.15 });
      godray.resolution = 0.5;
      grade = new PIXI.filters.AdjustmentFilter({ gamma: 1.02, saturation: 1.12, contrast: 1.06, brightness: 1.0, red: 1.03, green: 1.0, blue: 0.97 });
      bgC.filters = [godray]; root.filters = [grade];
      // a fixed filter area (the screen) spares Pixi a bounds walk over the whole scene every frame
      bgC.filterArea = root.filterArea = new PIXI.Rectangle(0, 0, VW, VH);
    }
    st.eventMode = 'none'; st.interactiveChildren = false;
    built = true;
  }

  function resetState() {
    plan.length = 0; planOn = false; onArrive = null; coin.on = false; celebT = 0; H.sq = 0; H.book = 0; H.after = '';
    H.x = -90; H.y = H.gy = 0; heroState('idle'); lastX = H.x;
    for (let i = 0; i < N; i++) setSign(i, 0);
    for (const c of coins) c.visible = false;
    for (const l of lifts) { l.y = l.y0; l.on = false; }
    for (const f of flags) if (!f.big) { f.up = false; f.t = 0; f.s.texture = frame('item/flagGreen_down'); f.s.scale.set(f.sc); }
    for (const p of parts) p.s.visible = false;
    if (xpText) xpText.visible = false;
    beacon.lit = false;
    cam.fy0 = cam.fy1 = cam.fy = feetY('start'); snapCam(); summitView = false;
    Object.assign(pose, want); stepPose(0);
  }
  // Draw every object once at start-up (culling off) so all textures are uploaded and all filter shaders compiled
  // before the first tap: no compile stall later (the beacon's glow used to cost 170 ms at the summit).
  function prewarm() {
    for (const c of [backC, midC]) for (const k of c.children) k.visible = true;
    beacon.lit = true; app.render(); beacon.lit = false;
  }
  function renderOnce() { if (!app) return; stT0 = performance.now(); update(0); app.render(); }
  let laterT = 0;
  function renderLater() { if (!laterT) laterT = setTimeout(() => { laterT = 0; if (!running) renderOnce(); }, 260); }

  /* ---------- day and night ---------- */
  function loadSet(tod) {
    const names = ['sky', 'far', 'peak', 'mid', 'near'];
    if (tex['sky-' + tod]) return Promise.resolve();
    const urls = names.map(n => base + kit.layers[n][tod]);
    return PIXI.Assets.load(urls).then(t => { names.forEach((n, k) => { tex[n + '-' + tod] = t[urls[k]]; }); });
  }
  function applyNight() {
    if (!built) return;
    const tod = night ? 'night' : 'day', pal = kit.palette[tod];
    if (!tex['sky-' + tod]) { loadSet(tod).then(() => { applyNight(); renderOnce(); }); return; }
    lay.sky.texture = tex['sky-' + tod]; lay.far.texture = tex['far-' + tod]; lay.peak.texture = tex['peak-' + tod];
    lay.mid.texture = tex['mid-' + tod]; lay.near.texture = tex['near-' + tod];
    const hex = s => parseInt(s.slice(1), 16);
    lay.nearFill.tint = hex(pal.near); lay.fog.tint = hex(pal.fog);
    starsC.visible = night; lay.moon.visible = night; lay.sun.visible = !night;
    lay.sunGlow.tint = night ? 0x8fa6ff : 0xffe2a8; lay.sunGlow.alpha = night ? 0.35 : 0.55; lay.sunGlow.x = night ? VW * 0.78 : VW * 0.8;
    for (const c of cloudsC.children) { c.tint = night ? 0x46508a : 0xffffff; c.alpha = night ? 0.55 : 0.85; }
    for (const c of cols) {
      c.fog.tint = hex(pal.colFog); c.fogB.tint = hex(pal.colFog); c.fog.alpha = 1; c.fogB.alpha = 1;
      c.shade.tint = night ? 0x060a20 : 0x3a2010; c.shade.alpha = night ? 0.75 : 0.55; c.rim.tint = night ? 0x9fb2ff : 0xffe8c8;
    }
    for (const c of cols) for (const k of c.children) if (k.texture && k.texture !== PIXI.Texture.WHITE && k !== c.fog && k !== c.shade && !(k instanceof PIXI.TilingSprite)) k.tint = night ? 0x9aa6d8 : 0xffffff;
    for (const c of cols) for (const k of c.children) if (k instanceof PIXI.TilingSprite) k.tint = night ? 0x7a84b8 : 0xffffff;
    for (const d of backDeco.children) if (d !== beaconGlow && d !== beacon && d !== landmark) d.tint = night ? 0x8d97c9 : 0xffffff;
    for (const b of landmark.children) b.tint = night ? 0x9aa6d8 : 0xffffff;
    for (const f of falls) f.s.tint = night ? 0x9fb4ff : 0xbfe4ff;
    for (const f of fgs) f.s.tint = night ? 0x0a1022 : 0xffffff;
    for (const f of floaters) { f.s.texture = frame(night ? 'fx/soft' : 'fx/leaf'); f.s.blendMode = night ? 'add' : 'normal'; f.s.tint = night ? 0xd8ff7a : 0x8fd16a; f.s.scale.set(night ? 0.12 : 0.42); if (night) { f.x = 30 + rnd() * (VW - 60); f.y = VH * (0.3 + rnd() * 0.4); f.s.rotation = 0; } }
    hero.children.forEach(s => { s.tint = night ? 0xc4cbef : 0xffffff; });
    vignette.alpha = night ? 0.6 : 0.32;
    if (godray) { godray.gain = night ? 0.26 : 0.3; godray.alpha = night ? 0.12 : 0.15; godray.center = { x: VW * (night ? 0.78 : 0.8), y: VH * (night ? 0.14 : 0.12) }; }
    if (grade) { grade.saturation = night ? 1.0 : 1.12; grade.contrast = night ? 1.08 : 1.06; grade.red = night ? 0.96 : 1.03; grade.blue = night ? 1.06 : 0.97; grade.gamma = night ? 0.98 : 1.02; }
    app.renderer.background.color = hex(pal.sky[0]);
  }

  /* ---------- public interface (used by app.js) ---------- */
  Object.assign(API, {
    init(e) {
      N = e.N; RM = e.RM; night = e.night; VW = e.W; VH = e.H; base = e.assetBase;
      app = new PIXI.Application();
      // The renderer (WebGL context, shaders) and the art (decoded off the main thread) start together.
      return fetch(base + 'kit.json').then(r => r.json()).then(k => {
        kit = k;
        const T = kit.textures, tod = night ? 'night' : 'day', urls = [base + kit.atlas.image, base + T.dirt, base + T.stone, base + T.waterfall, base + T.fg];
        const art = Promise.all([PIXI.Assets.load(urls), loadSet(tod)]).then(([t]) => {
          atlas = t[urls[0]]; tex.dirt = t[urls[1]]; tex.stone = t[urls[2]]; tex.waterfall = t[urls[3]]; tex.fg = t[urls[4]];
          for (const k2 of ['dirt', 'stone', 'waterfall']) tex[k2].source.addressMode = 'repeat';
          ['sky', 'far', 'peak', 'mid', 'near'].forEach(n => { tex[n] = tex[n + '-' + tod]; });
          ['far', 'mid', 'near'].forEach(n => { tex[n].source.addressMode = 'repeat'; });
        });
        const gl = app.init({ width: VW, height: VH, resolution: +P.get('res') || Math.min(2, window.devicePixelRatio || 1), autoDensity: true, antialias: false,
          background: 0x7fbdea, preference: 'webgl', powerPreference: 'high-performance', autoStart: false, sharedTicker: false, roundPixels: false })
          .then(() => {
            if (!app.renderer || app.renderer.name !== 'webgl') throw new Error('WebGL is not available');
            e.canvasHost.appendChild(app.canvas);
            // the world takes no pointer input (taps go to app.js), so Pixi's hit testing is switched off
            try { const f = app.renderer.events.features; f.move = f.globalMove = f.click = f.wheel = false; } catch (err) {}
          });
        return Promise.all([gl, art]);
      }).then(() => {
        Z = zoomFor(VW, VH);
        layout(); build(); resetState();
        app.ticker.add(tick, null, PIXI.UPDATE_PRIORITY.HIGH);
        app.ticker.add(tickEnd, null, PIXI.UPDATE_PRIORITY.UTILITY);
        applyNight();
        prewarm();
        renderOnce();
        // Ambient life at the start screen (breathing, blinking, clouds, birds, waterfalls) until the first tap.
        if (!RM) kick();
      });
    },
    walkToFirst(cb) {
      plan.length = 0; Wk(H.x, 0, stand(0), 0, 620, 2);
      cam.fy0 = cam.fy; cam.fy1 = feetY('walk'); cam.ft = RM ? 1 : 0;
      begin(cb);
    },
    travel(i, cb) { plan.length = 0; raiseFlag(i); planMove(i); begin(cb); },
    toSummit(cb) {
      const i = N - 1; plan.length = 0; raiseFlag(i); planMove(i);
      const end = landmark.x - 70;
      Wk(stand(N), L[N].y, end, L[N].y, 300, 1);
      begin(() => {
        beacon.lit = true; summitView = true;
        if (!RM) {
          celebT = 1.1; heroState('cheer'); confetti(H.x + 40, H.y - 120, 46); sparkle(beacon.x, beacon.y - 30, 24, 120);
          firework(beacon.x - 80, beacon.y - 160); sfx('cheer');
        }
        cb(RM ? 0 : 1100);
      });
    },
    coin(i, gold, cb) {
      if (RM) { coins[i].visible = false; cb(i); return; }
      coinStart(i, gold, cb); kick();
    },
    // animate=false (Strip, Classic): the world is behind the sheet, so it is redrawn later, off the tap's frame.
    sign(i, st, animate) {
      setSign(i, st);
      if (animate && !RM) { sparkle(signX(i) + 20, L[i].y - 56, st === 1 ? 12 : 4, 50); kick(); }
      else { coins[i].pop = 1; signs[i].badge.pop = 1; signs[i].badge.scale.set(0.36); renderLater(); }
    },
    pose(p) {
      if (p === 'happy') { H.after = 'read'; heroState('happy'); if (!RM) { sparkle(H.x, H.y - 70, 10, 80); kick(); } else renderLater(); }
      else if (p === 'calm') { H.after = 'read'; heroState('calm'); if (!RM) kick(); else renderLater(); }
      else if (p === 'read') heroState('read');
    },
    frame(f) {
      cam.fy0 = cam.fy; cam.fy1 = feetY(f); cam.ft = RM ? 1 : 0;
      if (RM) { snapCam(); renderOnce(); } else kick();
    },
    place(i) {
      const k = i === 'summit' ? N : i;
      H.x = i === 'summit' ? landmark.x - 70 : stand(k); H.y = H.gy = L[k].y;
      for (const l of lifts) if (l.i < k) { l.y = l.y1; l.on = false; }
      for (const f of flags) if (!f.big && f.i < k && !f.up) { f.up = true; f.t = 1; f.s.texture = frame(f.a); f.s.scale.set(f.sc); }
      if (i === 'summit') beacon.lit = true;
      heroState('read'); snapCam(); renderLater();
    },
    skip() {
      let did = false;
      if (coin.on) { coinCollect(); did = true; }
      if (planOn) { finishPlan(); did = true; }
      if (celebT > 0) { celebT = 0; H.y = H.gy; heroState('idle'); did = true; }
      if (did) {
        if (xpText) xpText.visible = false;
        for (const p of parts) p.s.visible = false;
        for (const f of flags) if (f.up && f.t < 1) { f.t = 1; f.s.scale.set(f.sc); }
        H.sq = 0; snapCam(); renderOnce();
      }
      return did;
    },
    sleep() { awake = false; cam.ft = 1; cam.fy = cam.fy1; snapCam(); renderOnce(); if (!ambient()) { app.ticker.stop(); running = false; } else kick(); },
    wake,
    reset() { resetState(); renderOnce(); if (!RM) kick(); },
    resize(w, h) {
      if (!app || !built) return;
      VW = w; VH = h; app.renderer.resize(w, h);
      Z = zoomFor(w, h);
      const keep = { x: H.x, y: H.y, gy: H.gy, st: H.st }, sts = signs.map(s => s.st), up = flags.map(f => f.up), ly = lifts.map(l => l.y), lit = beacon.lit;
      build(); applyNight();
      signs.forEach((s, i) => setSign(i, sts[i])); coins.forEach(c => { c.pop = 1; }); signs.forEach(s => { s.badge.pop = 1; s.badge.scale.set(0.36); });
      flags.forEach((f, i) => { if (up[i] && !f.big) { f.up = true; f.t = 1; f.s.texture = frame(f.a); } });
      lifts.forEach((l, i) => { l.y = ly[i]; }); beacon.lit = lit;
      H.x = keep.x; H.y = keep.y; H.gy = keep.gy; H.st = keep.st;
      snapCam(); renderOnce();
    },
    theme(n) { night = n; applyNight(); renderOnce(); },
    pause() { paused = true; if (app) app.ticker.stop(); running = false; },
    resume() { paused = false; if (app && (awake || busy() || ambient())) { running = true; app.ticker.start(); } },
    running: () => running,
    scriptTimes(reset) { const n = Math.min(stN, ST.length), out = Array.from(ST.subarray(0, n)); if (reset) stN = 0; return out; },
    info: () => 'HD · Z ' + Z.toFixed(2) + ' · res ' + (app ? app.renderer.resolution : '-') + ' · ' + (app && app.renderer ? app.renderer.name : '-') + (FX ? ' · fx' : ' · no fx') + ' · q-' + qStep,
    quality: () => ({ step: qStep, resolution: app ? app.renderer.resolution : null }),
    heroState: () => H.st,                                   // for the screenshot tool
    stripArt: () => kit && atlas && {
      img(c, name, x, y, w, h) { const f = kit.atlas.frames[name]; c.imageSmoothingEnabled = true; c.drawImage(atlas.source.resource, f[0], f[1], f[2], f[3], x, y, w, h); },
      coin(c, gold, x, y, size) { this.img(c, gold ? 'item/coinGold' : 'item/coinSilver', x - size * 0.75, y - size * 0.75, size * 1.5, size * 1.5); },
      flag(c, x, y) { this.img(c, 'item/flagYellow1', x - 6, y - 20, 21, 21); },
      hero(c, x, y, p, size) { const k = size * 1.5 / 128; this.img(c, 'icon/' + (p === 'jump' ? 'jump' : p === 'happy' ? 'cheer' : 'idle'), Math.round(x - 48 * k), Math.round(y - 128 * k), 96 * k, 128 * k); },
    },
  });

  // Zoom: 1 on phones (360-430 px wide), larger on tablets and desktops, from the shorter useful side.
  function zoomFor(w, h) { return clamp(Math.min(w, h * 0.62) / 380, 0.9, 1.7); }
})();
