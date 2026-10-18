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
  const GOV = P.get('gov') !== '0';                // ?gov=0 keeps full quality (screenshots on a machine without a GPU)
  const ART = 0.42;                                  // Kenney art px -> world units (hero about 80 units tall)
  const LW = 170, SUMW = 330, STEP_W = 34, STEP_H = 27, JUMP_GAP = 64, JUMP_RISE = 72, LIFT_W = 64, LIFT_RISE = 216;
  const START_W = 270, COL_D = 1400, START_X0 = -90;   // the climber starts each stage at x -90
  let app, kit, N = 8, RM = false, VW = 360, VH = 740, Z = 1, night = false, base = '';
  let atlas, tex = {}, lay = {}, root, bgC, worldC, backC, midC, fxC, fgC, vignette, starsC, cloudsC, birdsC;
  let godray = null, grade = null, glow = null, heroLine = null;
  const L = [], kinds = [], steps = [], lifts = [], signs = [], coins = [], flags = [], torches = [], falls = [], fgs = [];
  let landmark, beacon, beaconGlow, startSign, readyP = null, stripImg = null, wipeC, wipeCap;

  /* ---------- stages and layout ---------- */
  // A chapter has 1 to 200 MCQs (D27). It is cut into stages of about 10 (app.js gives the split): each stage is its
  // own mountain, in stage-local coordinates, with a ledge per MCQ and a camp at the top (the real summit for the last
  // stage). Only the current stage exists; its objects are built from shared textures when it starts and released
  // when it ends, so memory and work do not grow with the chapter.
  let STG = [[0, 8]], stage = 0, sA = 0, sK = 8;
  const lastStage = () => stage === STG.length - 1;
  const stageIdx = i => { for (let k = 0; k < STG.length; k++) if (i < STG[k][1]) return k; return STG.length - 1; };
  const J = i => i - sA;                                           // chapter MCQ index -> ledge in this stage
  const liftJ = () => sK >= 6 ? Math.floor(sK / 2) - 1 : -1;       // one lift per stage, in its middle
  const kindOf = j => j === sK - 1 ? 'stairs' : j === liftJ() ? 'lift' : j % 2 ? 'jump' : 'stairs';
  const stand = j => L[j].x + 40, signX = j => L[j].x + 112, flagX = j => L[j].x + 156;
  function layout() {
    L.length = 0; steps.length = 0; lifts.length = 0; kinds.length = 0;
    let x = 0, y = 0;
    for (let j = 0; j <= sK; j++) {
      L.push({ x, y, w: j === sK ? SUMW : LW });
      if (j === sK) break;
      const k = kindOf(j); kinds.push(k);
      if (k === 'stairs') {
        const sx = x + LW;
        for (let n = 0; n < 3; n++) steps.push({ x: sx + n * STEP_W, y: y - (n + 1) * STEP_H, foot: y, j, n });
        x = sx + 3 * STEP_W; y -= 4 * STEP_H;
      } else if (k === 'jump') { x += LW + JUMP_GAP; y -= JUMP_RISE; }
      else { lifts.push({ x: x + LW + 6, y, y0: y, y1: y - LIFT_RISE, j }); x += LW + 12 + LIFT_W; y -= LIFT_RISE; }
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
  // Short labels (sign numbers, Camp, Stage n, +10 XP) use one bitmap font made once at start-up: no texture per
  // sign, so a 200-MCQ chapter costs the same as 8. White fill and a dark stroke; the colour comes from the tint.
  let fontReady = false;
  function installFont() {
    if (fontReady) return;
    PIXI.BitmapFont.install({ name: 'kafu-label', style: Object.assign(textStyle(40, 0xffffff), { stroke: { color: 0x3a2618, width: 7, join: 'round' } }),
      chars: [['a', 'z'], ['A', 'Z'], ['0', '9'], ' +/'], resolution: 2, padding: 4 });
    fontReady = true;
  }
  function btext(s, size, tint, parent) { const t = new PIXI.BitmapText({ text: s, style: { fontFamily: 'kafu-label', fontSize: size } }); t.anchor.set(0.5); t.tint = tint; if (parent) parent.addChild(t); return t; }

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
      w.armR = 168; w.handR = -30; w.armL = 8 + Math.sin(ambT * 1.7) * 3; w.head = -13; w.lean = -2;
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
  // The stage change: clouds rise and cover the screen, the next mountain is built behind them, the clouds fall.
  const Wp = (x, y, d) => plan.push({ k: 5, x0: x, y0: y, x1: START_X0, y1: 0, d, swapped: false });
  let wipeK = 0;
  // The caption shown while the clouds cover the screen: "Next mountain / Stage 2 of 3" (k = the next stage, 0-based).
  function caption(k) { wipeCap.t1.text = k === STG.length - 1 ? 'Last mountain' : 'Next mountain'; wipeCap.t2.text = 'Stage ' + (k + 1) + ' of ' + STG.length; }
  function swapStage(s) { s.swapped = true; setStage(stage + 1); H.x = lastX = START_X0; H.y = H.gy = 0; heroState('idle'); cam.fy = cam.fy1 = feetY('walk'); snapCam(); }
  function planMove(i) {
    const a = L[i], b = L[i + 1], k = kinds[i];
    if (k === 'lift') {
      const lf = lifts.find(l => l.j === i), mx = lf.x + LIFT_W / 2;
      Wk(stand(i), a.y, mx, a.y, 260, 2); Lf(mx, a.y, b.y, 760, lf); Wk(mx, b.y, stand(i + 1), b.y, 200, 1);
    } else if (k === 'jump') {
      const edge = a.x + LW - 14;
      Wk(stand(i), a.y, edge, a.y, 190, 2); Cr(edge, a.y, 90); Jp(edge, a.y, b.x + 18, b.y, 320, 46); Wk(b.x + 18, b.y, stand(i + 1), b.y, 110, 1);
    } else {
      const edge = a.x + LW - 12, ss = steps.filter(s => s.j === i);
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
      if (s.k === 2) { s.lift.y = s.y1; s.lift.on = false; s.lift.used = true; }
      if (s.k === 4) { dust(H.x, H.y, 4); sfx('jump'); }
      if (s.k === 5) { if (!s.swapped) swapStage(s); wipeK = 0; }
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
      H.trail = (H.trail || 0) + ms; if (H.trail > 34) { H.trail = 0; emit('trail', H.x - 6, H.y - 30, 0, 0, 0.32); }
    } else if (s.k === 5) {
      wipeK = p < 0.42 ? easeInOut(p / 0.42) : p < 0.58 ? 1 : 1 - easeInOut((p - 0.58) / 0.42);
      if (!s.swapped && p >= 0.42) swapStage(s);
      if (!s.swapped) heroState('idle');
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
    for (; pi < plan.length; pi++) { const s = plan[pi]; if (s.k === 2) { s.lift.y = s.y1; s.lift.on = false; s.lift.used = true; } if (s.k === 5 && !s.swapped) swapStage(s); }
    wipeK = 0;
    const s = plan[plan.length - 1];
    H.x = s.x1; H.y = H.gy = s.y1; arrive();
  }
  function arrive() {
    planOn = false; plan.length = 0; pi = 0;
    for (const l of lifts) if (l.used) { l.used = false; if (RM || !ambient()) l.y = l.y0; else l.ret = true; }
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
    else if (kind === 'confetti') { s.texture = frame('fx/confetti'); s.tint = CONF[(rnd() * 6) | 0]; s.blendMode = 'normal'; p.sy = 0.42 + rnd() * 0.2; s.scale.set(0.3 + rnd() * 0.12, p.sy); p.g = 260; p.drag = 1.2; p.spin = (rnd() - 0.5) * 10; }
    else if (kind === 'fire') { s.texture = frame('fx/soft'); s.tint = CONF[(rnd() * 6) | 0]; s.blendMode = 'add'; s.scale.set(0.2, 0.07); p.g = 70; p.drag = 1.4; }
    else if (kind === 'flash') { s.texture = frame('fx/glow'); s.tint = 0xfff4d0; s.blendMode = 'add'; s.scale.set(0.5); p.grow = 2.2; }
    else if (kind === 'drop') { s.texture = frame('fx/soft'); s.tint = 0xffffff; s.blendMode = 'normal'; s.scale.set(0.07 + rnd() * 0.04); p.g = 320; }
    else if (kind === 'trail') { s.texture = frame('fx/soft'); s.tint = 0xffffff; s.blendMode = 'normal'; s.scale.set(0.12); s.alpha = 0.5; }
    return p;
  }
  function dust(x, y, n) { if (RM) return; for (let i = 0; i < n; i++) emit('dust', x + (rnd() - 0.5) * 18, y - 2, (rnd() - 0.5) * 70, -rnd() * 20, 0.5 + rnd() * 0.25); }
  function sparkle(x, y, n, sp) { if (RM) return; for (let i = 0; i < n; i++) { const a = rnd() * 6.28, v = (sp || 60) * (0.4 + rnd()); emit('spark', x, y, Math.cos(a) * v, Math.sin(a) * v, 0.45 + rnd() * 0.35); } }
  function confetti(x, y, n) { if (RM) return; for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (rnd() - 0.5) * 2.0, v = 200 + rnd() * 220; emit('confetti', x, y, Math.cos(a) * v, Math.sin(a) * v, 1.8 + rnd() * 0.8); } }
  // A firework: a quick flash, then a ring of glowing streaks that fly out, fall under gravity and fade.
  function firework(x, y) { if (RM) return; const c = CONF[(rnd() * 6) | 0], c2 = CONF[(rnd() * 6) | 0]; emit('flash', x, y, 0, 0, 0.35); for (let i = 0; i < 30; i++) { const a = rnd() * 6.28, v = 60 + rnd() * 90; const p = emit('fire', x, y, Math.cos(a) * v, Math.sin(a) * v, 0.8 + rnd() * 0.6); if (p) p.s.tint = rnd() < 0.7 ? c : c2; } }
  function stepParts(dt) {
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i], s = p.s; if (!s.visible) continue;
      p.t += dt; if (p.t >= p.l) { s.visible = false; continue; }
      const f = Math.exp(-p.drag * dt);
      p.vx *= f; p.vy = p.vy * f + p.g * dt; s.x += p.vx * dt; s.y += p.vy * dt; s.rotation += p.spin * dt;
      const k = p.t / p.l;
      if (p.kind === 'confetti') {   // flips, sways and slows to a flutter as it falls
        if (p.vy > 0) p.vy *= Math.exp(-2.6 * dt);
        s.x += Math.sin(p.t * 5 + i) * 26 * dt; s.scale.y = (Math.abs(Math.cos(p.t * 9 + i)) * 0.8 + 0.1) * p.sy; s.alpha = k > 0.8 ? (1 - k) / 0.2 : 1;
      }
      else if (p.kind === 'fire') { const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy); s.rotation = Math.atan2(p.vy, p.vx); s.scale.set(0.07 + sp * 0.0018, 0.07); s.alpha = 1 - k * k; }
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
    c.x = signX(i); c.y = L[i].y - 76; c.pop = st ? 0 : 1; c.glow.tint = st === 1 ? 0xffd75a : 0xdfe8ff;
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
    const f = flags.find(g => !g.big && g.i === i); if (!f || f.up) return;
    f.up = true; f.t = RM ? 1 : 0; if (RM) { f.pen.y = -148; f.pen.texture = frame('ui/pen0'); f.pen.anchor.set(0.03, 0.5); } else sfx('flag');
  }

  /* ---------- camera: springs with look-ahead, and two framings (walking, MCQ open) ---------- */
  const cam = { x: 0, y: 0, vx: 0, vy: 0, fy: 0.56, fy0: 0.56, fy1: 0.56, ft: 1, ahead: 0, z: 1, z1: 1 };
  let atStart = true, camX0 = 0;
  // Feet height on screen: walking 56%, at the start 47% (above the start card), MCQ open 40 px above the sheet
  // (in the HD tier the Story sheet covers the bottom 72%), never higher than 120 px so the head clears the top bar.
  function feetY(mode) { return mode === 'sheet' ? Math.max(120, Math.round(VH * 0.28) - 40) / VH : mode === 'start' ? 0.47 : 0.56; }
  function camTarget(out) { const zc = Z * cam.z; out[0] = H.x + cam.ahead - (VW / zc) * (summitView ? 0.5 : 0.36); out[1] = H.y - (VH / zc) * cam.fy; return out; }
  const tgt = [0, 0];
  function snapCam() { cam.fy = cam.fy1; cam.ft = 1; cam.z = cam.z1; cam.ahead = atStart ? 40 : summitView ? 50 : 0; camTarget(tgt); cam.x = tgt[0]; cam.y = tgt[1]; cam.vx = cam.vy = 0; }
  function stepCam(dt) {
    if (cam.ft < 1) { cam.ft = Math.min(1, cam.ft + dt / 0.24); cam.fy = lerp(cam.fy0, cam.fy1, easeInOut(cam.ft)); }
    const goAhead = planOn ? 56 : summitView ? 50 : atStart ? 40 : 0;
    cam.ahead += (goAhead - cam.ahead) * (1 - Math.exp(-dt * 3));
    cam.z += (cam.z1 - cam.z) * (1 - Math.exp(-dt * 2.2));
    // the background dims a little while an MCQ is open, so the eye goes to the climber
    const dim = cam.fy1 < 0.4 && !summitView ? 0.82 : 1; bgDim += (dim - bgDim) * (1 - Math.exp(-dt * 6));
    const st = stageTint, ch = (v, k) => Math.round(((v >> k) & 255) * bgDim);
    bgC.tint = (ch(st, 16) << 16) | (ch(st, 8) << 8) | Math.min(255, ch(st, 0) + 6);   // the stage's light, dimmed under a sheet
    camTarget(tgt);
    // critically damped springs (no overshoot), a little softer vertically
    const sp = (pos, vel, to, w) => { const x = pos - to, e = Math.exp(-w * dt), a = (vel + w * x) * dt; return [to + (x + a) * e, (vel - w * a) * e]; };
    const X = sp(cam.x, cam.vx, tgt[0], 9), Y = sp(cam.y, cam.vy, tgt[1], 7.5);
    cam.x = X[0]; cam.vx = X[1]; cam.y = Y[0]; cam.vy = Y[1];
    camMoving = Math.abs(tgt[0] - cam.x) + Math.abs(tgt[1] - cam.y) > 0.25 || Math.abs(cam.vx) + Math.abs(cam.vy) > 1 || Math.abs(cam.z1 - cam.z) > 0.002 || Math.abs(dim - bgDim) > 0.005;
    if (!camMoving) { cam.x = tgt[0]; cam.y = tgt[1]; cam.vx = cam.vy = 0; }
  }

  /* ---------- the loop ---------- */
  let summitView = false, bgDim = 1;
  let awake = false, ambT = 0, built = false, camMoving = false, celebT = 0, running = false, paused = false;
  const busy = () => planOn || lifts.some(l => l.ret) || coin.on || xpText.visible || H.sq > 0 || celebT > 0 || anyParts() || cam.ft < 1 || camMoving || popping() || flagMoving() || H.st === 'happy' || H.st === 'calm';
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
      if (!coin.on || coin.i !== i) c.y = L[i].y - 76 + Math.sin(ambT * 2.4 + i) * 3;
      const b = signs[i].badge;
      if (b.pop < 1) { b.pop = Math.min(1, b.pop + dt / 0.3); b.scale.set(0.36 * easeOut(b.pop) * (1 + 0.3 * Math.sin(Math.PI * b.pop))); }
    }
    // "+10 XP" floats up above the climber (beside the ropes when she rides the lift)
    if (xpText.visible) { xpT += dt; xpText.x = H.x + (H.st === 'lift' ? 62 : 0); xpText.y = H.y - 104 - xpT * 36; xpText.scale.set(Math.min(1, 0.6 + xpT * 4)); xpText.alpha = xpT < 0.55 ? 1 : Math.max(0, 1 - (xpT - 0.55) / 0.35); if (xpT > 0.9) xpText.visible = false; }
    // checkpoint posts: once a ledge is passed its pennant runs up the post and unfurls, then waves
    for (const f of flags) {
      if (!f.up) continue;
      if (f.big) { if (!RM) f.pen.texture = frame((f.gold ? 'ui/gold' : 'ui/pen') + (((ambT * 7 + f.o) | 0) % 3)); continue; }
      if (f.t < 1) { f.t = Math.min(1, f.t + dt / 0.6); f.pen.y = lerp(-36, -148, easeOut(f.t)); if (f.t >= 1) sparkle(f.x + 18, f.y - 72, 8, 50); }
      if (f.t > 0.15) { const k = RM ? 0 : ((ambT * 7 + f.o) | 0) % 3; const t = frame('ui/pen' + k); if (f.pen.texture !== t) { f.pen.texture = t; f.pen.anchor.set(0.03, 0.5); } }
    }
    for (const l of lifts) {
      if (l.ret) { l.y += (l.y0 - l.y) * (1 - Math.exp(-dt * 1.6)); if (Math.abs(l.y - l.y0) < 0.5) { l.y = l.y0; l.ret = false; } }
      l.c.y = l.y; l.wheel.rotation = (l.y - l.y0) / 7;
      for (const ch of l.chains) { ch.y = l.top - 12; ch.height = Math.max(8, l.y - 32 - l.top); }
      l.cw.y = l.cwTop + 18 + (l.y0 - l.y) * 0.4; l.cwRope.height = Math.max(4, l.cw.y - l.cwTop);   // the counterweight goes the other way
    }
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
    for (const w of falls) {
      w.s.tilePosition.y += dt * 460;
      // spray: droplets jump off the lip of the fall now and then
      if (w.s.renderable && (w.t -= dt) < 0) { w.t = 0.09 + rnd() * 0.08; const p = emit('drop', w.x + (rnd() - 0.5) * 18, w.y, (rnd() - 0.5) * 50, -20 - rnd() * 40, 0.55); if (p && night) p.s.tint = 0xa8b8ff; }
    }
    for (const f of floaters) {
      f.t += dt;
      if (night) { f.s.x = f.x + Math.sin(f.t * 0.7 + f.o) * 26; f.s.y = f.y + Math.sin(f.t * 1.1 + f.o * 2) * 16; f.s.alpha = 0.35 + 0.65 * Math.max(0, Math.sin(f.t * 2.2 + f.o)); }
      else {
        f.s.x += (f.vx + Math.sin(f.t * 1.3 + f.o) * 12) * dt; f.s.y += f.vy * dt; f.s.rotation += f.spin * dt; f.s.scale.y = 0.42 * Math.max(0.28, Math.abs(Math.cos(f.t * 3 + f.o)));
        if (f.s.y > VH + 30 || f.s.x > VW + 40) { f.s.x = -20 + rnd() * VW * 0.6; f.s.y = -20 - rnd() * 80; }
      }
    }
    for (const t of torches) { const f = 0.08 * Math.sin(ambT * 13 + t.o) + 0.04 * Math.sin(ambT * 29 + t.o); t.g.alpha = (night ? 0.75 : 0.12) + f; t.pool.alpha = night ? 0.5 + f : 0; }
    if (starsC.visible) for (let i = 0; i < starsC.children.length; i++) { const s = starsC.children[i]; s.alpha = 0.45 + 0.55 * Math.abs(Math.sin(ambT * s.v + s.o)); }
    beaconGlow.scale.set((celebT > 0 || beacon.lit ? 1.25 : 0.9) * (1 + 0.06 * Math.sin(ambT * 3)));
    if (godray) godray.time = ambT * 0.12;
  }

  // Positions every layer from the camera (parallax x / y factors in brackets): sky fixed, far range (0.03 / 0.02),
  // the landmark peak (0.05 / 0.04), clouds (0.1), mid range (0.12 / 0.1), near hills (0.28 / 0.24), world 1,
  // foreground plants (1.35).
  function place() {
    const cx = cam.x, cy = cam.y, Zc = Z * cam.z, X = Math.round(cx * Zc * 2) / 2, Y = Math.round(cy * Zc * 2) / 2;
    worldC.scale.set(Zc); worldC.x = -X; worldC.y = -Y;
    // Vertical placement is anchored to the start framing (the hills show just above the path at the start) and
    // sinks with the climb at each layer's factor; dy < 0 once the camera has risen.
    // Height parallax is strong on purpose: the far range, the landmark peak and the hills sink as the climber rises,
    // so by the summit everything but the sky lies below her (far 0.15, peak 0.35, clouds and sea 0.2, mid 0.3,
    // near 0.55 of the camera's rise).
    const dy = (cy + (VH / Z) * feetY('start')) * Z;
    // each stage shows a different stretch of the painted ranges (so = a fixed offset per stage)
    const so = stage * 731;
    lay.far.y = VH * 0.3 - 125 * Z - dy * 0.15; lay.far.tilePosition.x = -(cx * 0.05 + so) * 2;
    lay.peak.x = VW * (stage % 2 ? 0.34 : 0.7) - (cx - L[sK].x * 0.5) * 0.06 * Z; lay.peak.y = VH * 0.5 - dy * 0.35;
    cloudsC.x = -cx * 0.1 * Z; cloudsC.y = -dy * 0.2;
    lay.sea.y = VH * 0.37 - dy * 0.2; lay.sea.tilePosition.x = -(cx * 0.12 + (RM ? 0 : ambT * 4)) * 2;
    lay.mid.y = VH * 0.38 - 130 * Z - dy * 0.3; lay.mid.tilePosition.x = -(cx * 0.2 + so * 1.7) * 2;
    lay.fog.y = lay.mid.y + 250 * Z;
    lay.near.y = VH * 0.47 - 140 * Z - dy * 0.55; lay.near.tilePosition.x = -(cx * 0.4 + so * 2.3) * 2;
    lay.nearFill.y = lay.near.y + 356 * Z; lay.nearFill.height = Math.max(0, VH - lay.nearFill.y);
    // the cloud bank below the path (screen space, moving with the world)
    lay.bank.y = lerp(VH * 0.8, -VH * 0.34, wipeK) + (RM ? 0 : Math.sin(ambT * 0.6) * 4); lay.bank.tilePosition.x = -(cx * 1.0 + (RM ? 0 : ambT * 6)) * 2;
    lay.bankFill.y = lay.bank.y + 80 * Z; lay.bankFill.height = Math.max(0, VH - lay.bankFill.y);
    // the stage change: big clouds rise inside the bank (at their own place once it covers the screen) and the caption
    // fades in while they cover it
    wipeC.visible = wipeK > 0; if (wipeK > 0) wipeC.y = lay.bank.y + VH * 0.34;
    wipeCap.alpha = clamp((wipeK - 0.7) / 0.3, 0, 1); wipeCap.visible = wipeCap.alpha > 0;
    fgW.x = -cx * 0.25; fgW.y = -cy * 0.25;
    // cull the world by x (a few dozen objects): 'renderable' only, so an object's own visible state is kept
    const x0 = cx - 160, x1 = cx + VW / Z + 160;
    for (const c of backC.children) if (c.wx != null) c.renderable = c.wx < x1 && c.wx + c.ww > x0;
    for (const c of backDeco.children) if (c.wx != null) c.renderable = c.wx < x1 && c.wx + c.ww > x0;
    for (const c of midC.children) if (c.wx != null) c.renderable = c.wx < x1 && c.wx + c.ww > x0;
  }

  // Script time per frame for the harness: the start of update to the end of render submission, in ms.
  const ST = new Float32Array(4096); let stN = 0, stT0 = 0;
  // Quality governor: if frames keep running long while the world moves (a weak GPU), step the quality down after
  // 8 slow frames or 0.6 s: first the light rays, then the colour grading (both instant). If it is still slow, the
  // phone is remembered and the next visit starts on the light tier (changing the resolution now would reallocate the
  // canvas, a long stall). Never steps back up.
  let qStep = 0, qN = 0, qSum = 0;
  const QSTEPS = [() => { if (godray) { raysS.visible = false; godray = null; } }, () => { root.filters = null; grade = null; },
    () => { try { localStorage.setItem('mcqm-tier', 'light'); } catch (e) {} }];
  function govern(ms) {
    if (!GOV || !(awake || planOn) || qStep >= QSTEPS.length || ms > 1000) { qN = qSum = 0; return; }
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
  // A cliff column: one painted rock shape (tools/build_assets_hd.py, 2 px per unit, with a margin for its rocky
  // silhouette) under a lip of grass (or stone, for stair steps) tiles.
  const CLIFF_M = {};   // texture margin (units) around a cliff's rocky silhouette, when not the default 14
  // Textures needed after the first frame arrive a moment later (World.whenReady); until then a sprite shows nothing.
  const T = n => tex[n] || PIXI.Texture.EMPTY;
  function column(parent, x, y, w, name, stone, noLip) {
    const c = new PIXI.Container(); c.wx = x - 30; c.ww = w + 60; parent.addChild(c);
    const m = CLIFF_M[name] || 14, wu = kit.dims[name][0] / 2 - 2 * m;
    const body = new PIXI.Sprite(T(name)); body.scale.set(0.5 * w / wu, 0.5); body.x = x - m * w / wu; body.y = y + 6; c.addChild(body); c.body = body; c.texName = name;
    const tw = 128 * ART, n = noLip ? 0 : Math.max(2, Math.round(w / tw));
    c.lips = [];
    for (let k = 0; k < n; k++) {
      const part = k === 0 ? 'left' : k === n - 1 ? 'right' : 'mid';
      const s = spr((stone ? 'tile/stoneHalf_' : 'tile/grassHalf_') + part, x + k * (w / n), y - 2, 0, 0, c); s.scale.set((w / n) / 128, ART); c.lips.push(s);
    }
    cols.push(c);
    return c;
  }
  const cols = [], blocks = [];   // cliff columns and stair blocks (tinted by the moonlight at night)
  function shadowAt(x, y, w, parent) { const s = spr('fx/shadow', x, y + 1, 0.5, 0.5, parent || midC); s.scale.set(w / 96, 0.5); s.alpha = 0.32; s.wx = x - 40; s.ww = 80; return s; }
  function decorTorch(tx, y, o) { // a torch with a small warm glow and a pool of light on the ground (stronger at night)
    shadowAt(tx, y, 18);
    const t = spr('prop/torch1', tx, y + 4, 0.5, 1, midC, ART * 0.6); t.wx = tx - 30; t.ww = 60;
    const g = spr('fx/glow', tx, y - 30, 0.5, 0.5, midC, 0.62); g.blendMode = 'add'; g.tint = 0xffc46a; g.wx = tx - 60; g.ww = 120;
    const pool = spr('fx/glow', tx - 10, y + 2, 0.5, 0.5, midC); pool.scale.set(1.5, 0.3); pool.blendMode = 'add'; pool.tint = 0xffb050; pool.wx = tx - 100; pool.ww = 200;
    torches.push({ g, pool, o: o * 1.7 });
  }
  function decorate(i) {
    // Each ledge gets its own small scene, seeded by its chapter number (the same every run). Places on a ledge (x
    // from its left edge): hero 40 (spans about 10-70), a tuft 82, the sign 112, a torch 136 on some ledges, the post
    // 156. i is the ledge in this stage.
    seed = 1000 + (sA + i) * 97;
    const l = L[i], x0 = l.x, y = l.y, w = l.w;
    const pick = a => a[(rnd() * a.length) | 0];
    const tintB = night ? 0x8d97c9 : 0xffffff, tintF = night ? 0x9aa3d0 : 0xffffff;
    if (i % 3 !== 1) { const x = x0 + 14 + rnd() * 10, n = pick(['bg/treeSmall_green1', 'bg/treeSmall_green2', 'bg/treeSmall_green3']), d = spr(n, x, y + 6, 0.5, 1, backDeco, 0.32 + rnd() * 0.06); d.wx = x - 60; d.ww = 120; d.tint = tintB; }
    if (i % 2 === 0) { const x = x0 + w - 26, d = spr(pick(['bg/bush1', 'bg/bush2', 'bg/bush3', 'bg/bush4']), x, y + 6, 0.5, 1, backDeco, 0.26); d.wx = x - 60; d.ww = 120; d.tint = tintB; }
    if (i === sK) return;
    const tuft = spr(pick(['prop/grass', 'prop/plantPurple', 'prop/grass']), x0 + 84, y + 3, 0.5, 1, midC, ART * 0.62); tuft.wx = x0 + 44; tuft.ww = 80; tuft.tint = tintF;
    for (let k = 0; k < 3; k++) { const px = x0 + (k ? 146 + k * 9 + rnd() * 4 : 4 + rnd() * 4), pb = spr('prop/rock', px, y + 3, 0.5, 1, midC, 0.1 + rnd() * 0.06); pb.wx = px - 20; pb.ww = 40; pb.tint = tintF; }
    if ((sA + i) % 3 === 2 || i === 0) decorTorch(x0 + 137, y, i);
  }
  // The camp's tent, drawn once per stage (a few triangles): canvas, shaded side, open door, poles and guy ropes.
  function tent(x, y) {
    const g = new PIXI.Graphics(), ink = 0x4a2a18;
    g.moveTo(x - 66, y + 4).lineTo(x - 30, y - 36).moveTo(x + 66, y + 4).lineTo(x + 30, y - 36).stroke({ width: 1.5, color: 0xe8d6b4 });
    g.poly([x - 54, y + 5, x, y - 66, x + 54, y + 5]).fill(0xe0703f).stroke({ width: 3, color: ink, join: 'round' });
    g.poly([x, y - 66, x + 54, y + 5, x + 20, y + 5]).fill(0xb9532c);
    g.poly([x - 15, y + 5, x, y - 32, x + 13, y + 5]).fill(0x3b1d10);
    g.poly([x, y - 32, x + 13, y + 5, x + 27, y + 5]).fill(0xf0a35c).stroke({ width: 2, color: ink, join: 'round' });
    g.moveTo(x, y - 64).lineTo(x - 7, y - 78).moveTo(x, y - 64).lineTo(x + 8, y - 77).stroke({ width: 3, color: 0x5a3820 });
    backDeco.addChild(g);
    return g;
  }
  // Builds the current stage's world (stage-local coordinates): cliffs, stairs, waterfalls, decorations, signs,
  // coins, checkpoint posts, the lift and the camp or summit. The previous stage's objects are released first.
  // Constant work per stage (about 150 sprites from shared textures), whatever the chapter's length.
  function buildStage() {
    for (const c of [backC, backDeco, midC, fgW]) for (const k of c.removeChildren()) k.destroy({ children: true });
    cols.length = 0; blocks.length = 0; torches.length = 0; falls.length = 0; flags.length = 0; signs.length = 0; coins.length = 0; glow = null;
    // the start ledge (wide), one cliff per ledge, the camp or summit ledge
    column(backC, -START_W, 0, START_W + LW, 'cliff-wide');
    for (let j = 1; j < sK; j++) column(backC, L[j].x, L[j].y, LW, (j + stage) % 2 ? 'cliff-b' : 'cliff-a');
    column(backC, L[sK].x, L[sK].y, SUMW, 'cliff-summit');
    // stairs: stone blocks stacked on one rock base
    for (let j = 0; j < sK; j++) {
      const ss = steps.filter(t => t.j === j); if (!ss.length) continue;
      column(backC, ss[0].x, ss[0].foot, 3 * STEP_W + 1, (j + stage) % 2 ? 'cliff-a' : 'cliff-b', false, true);
      for (const t of ss) for (let m = 0; m <= t.n; m++) { const b = spr('tile/stoneMid', t.x, t.y + m * STEP_H, 0, 0, backC); b.scale.set((STEP_W + 1) / 128, (STEP_H + 1) / 128); b.wx = t.x - 10; b.ww = STEP_W + 20; blocks.push(b); }
    }
    // waterfalls: spill over the left lip of the higher ledge at each gap jump, between two rocks, into the cloud bank
    for (let j = 0; j < sK; j++) {
      if (kinds[j] !== 'jump') continue;
      const x = L[j + 1].x - 13, top = L[j + 1].y + 4;
      const w = tiling(T('waterfall'), 24, 700); w.tileScale.set(0.5); w.x = x; w.y = top; w.alpha = 0.92; w.wx = x - 10; w.ww = 60; backC.addChild(w);
      const spill = spr('fx/spill', x + 12, top + 2, 0.5, 0.5, backC, 0.42); spill.wx = x - 20; spill.ww = 60;
      for (const dx of [-2, 27]) { const r = spr('prop/rock', x + dx, top + 3, 0.5, 1, backC, 0.13); r.wx = x - 20; r.ww = 60; }
      falls.push({ s: w, x: x + 12, y: top + 4, t: 0, o: j });
    }
    // the top of the stage: the summit (a cairn of stones, a golden star, the summit pennant) or a camp
    const sx = L[sK].x + SUMW - 110, sy = L[sK].y, top = lastStage();
    shadowAt(sx, sy, top ? 150 : 90, backDeco);
    landmark = top ? spr('ui/cairn', sx, sy + 6, 0.5, 1, backDeco, 0.55) : tent(sx, sy); landmark.wx = sx - 120; landmark.ww = 240;
    beaconGlow = spr('fx/glow', sx, sy - 98, 0.5, 0.5, backDeco, 0.9); beaconGlow.blendMode = 'add'; beaconGlow.tint = 0xffd36b; beaconGlow.alpha = 0.75; beaconGlow.wx = sx - 160; beaconGlow.ww = 320; beaconGlow.visible = top;
    beacon = spr('item/star', sx, sy - 80, 0.5, 1, backDeco, 0.5); beacon.wx = sx - 60; beacon.ww = 120; beacon.lit = false; beacon.visible = top;
    if (top && FX && PIXI.filters && PIXI.filters.GlowFilter) { glow = new PIXI.filters.GlowFilter({ distance: 12, outerStrength: 1.6, color: 0xffd36b, quality: 0.2, resolution: 'inherit' }); beacon.filters = [glow]; }
    const sumPole = spr('ui/pole', sx + (top ? 36 : 24), sy - (top ? 20 : 8), 0.5, 1, backDeco, top ? 0.75 : 0.55); sumPole.wx = sx; sumPole.ww = 140;
    const sumPen = spr(top ? 'ui/gold0' : 'ui/pen0', 2, -150, 0.03, 0.5, sumPole, 1);
    flags.push({ x: sx, y: sy, up: true, t: 1, o: 0, s: sumPole, pen: sumPen, big: true, gold: top });
    backDeco.setChildIndex(landmark, backDeco.children.length - 1);
    if (!top) { // a camp: a tent, a sign and a torch on the stage's top ledge (the sign stands clear of the climber)
      const cs = spr('ui/plate', L[sK].x + 112, sy + 6, 0.5, 1, midC, 0.55); cs.wx = cs.x - 50; cs.ww = 100;
      const ct = btext('Camp', 26, 0xfff4dc, null); ct.y = -84; cs.addChild(ct);
      decorTorch(L[sK].x + 158, sy, 99);
    }
    for (let j = 0; j <= sK; j++) decorate(j);
    // the start: a wooden sign (START, or the stage number) and a fence
    shadowAt(-150, 4, 40);
    startSign = spr('ui/plate', -150, 6, 0.5, 1, midC, 0.62); startSign.wx = -200; startSign.ww = 100;
    const stt = btext(stage ? 'Stage ' + (stage + 1) : 'START', stage ? 22 : 24, 0xfff4dc, null); stt.y = -82; startSign.addChild(stt);
    const fence = spr('bg/fence', -235, 6, 0.5, 1, backDeco, 0.4); fence.wx = -300; fence.ww = 120;
    // lifts: a braced wooden tower on the upper ledge, an arm with a pulley over the shaft, two ropes to a gondola,
    // and a counterweight inside the tower that moves the other way
    for (const l of lifts) {
      const up = L[l.j + 1];
      l.top = l.y1 - 100; l.c = new PIXI.Container(); l.c.x = l.x; l.c.y = l.y; l.c.wx = l.x - 20; l.c.ww = LIFT_W + 40;
      const tx0 = up.x + 8, tx1 = up.x + 30, ttop = l.top - 12, tbot = up.y + 4;
      const g = new PIXI.Graphics();
      for (let y = ttop + 8; y < tbot - 14; y += 26) g.moveTo(tx0, y).lineTo(tx1, y + 26).moveTo(tx1, y).lineTo(tx0, y + 26);
      g.stroke({ width: 2.5, color: 0x5a3820 });
      g.rect(tx0 - 3.5, ttop, 7, tbot - ttop).fill(0x6b4428).rect(tx1 - 3.5, ttop, 7, tbot - ttop).fill(0x6b4428);
      g.rect(tx0 - 2, ttop, 2, tbot - ttop).fill(0x8f6038).rect(tx1 - 2, ttop, 2, tbot - ttop).fill(0x8f6038);
      g.rect(l.x - 10, ttop - 9, tx1 + 8 - (l.x - 10), 10).fill(0x6b4428).rect(l.x - 10, ttop - 9, tx1 + 8 - (l.x - 10), 3).fill(0x8f6038);
      g.moveTo(tx0, ttop + 1).lineTo(l.x + LIFT_W / 2 + 6, ttop - 8).stroke({ width: 3, color: 0x5a3820 });
      g.wx = l.x - 20; g.ww = tx1 - l.x + 60; backC.addChild(g);
      l.chains = [5, LIFT_W - 9].map(dx => { const r = tiling(frame('ui/rope'), 4, 40); r.tileScale.set(0.5); r.x = l.x + dx; r.wx = l.x; r.ww = LIFT_W; backC.addChild(r); return r; });
      l.wheel = spr('ui/pulley', l.x + LIFT_W / 2, ttop - 6, 0.5, 0.5, backC, 0.5); l.wheel.wx = l.x; l.wheel.ww = LIFT_W;
      l.cwx = (tx0 + tx1) / 2; l.cwTop = ttop + 4;
      l.cwRope = tiling(frame('ui/rope'), 3, 20); l.cwRope.tileScale.set(0.4); l.cwRope.x = l.cwx - 1.5; l.cwRope.y = l.cwTop; l.cwRope.wx = l.x; l.cwRope.ww = 120; backC.addChild(l.cwRope);
      l.cw = spr('tile/stoneMid', l.cwx, l.cwTop + 20, 0.5, 0, backC); l.cw.scale.set(0.12, 0.1); l.cw.wx = l.x; l.cw.ww = 120;
      const gd = spr('ui/gondola', -4, 2, 0, 1, l.c, 0.5); gd.width = LIFT_W + 8;
      midC.addChild(l.c); l.on = false; l.ret = false;
    }
    // signs (Q number plates), badges after grading, coins, checkpoint posts with pennants
    for (let j = 0; j < sK; j++) {
      const sxi = signX(j);
      shadowAt(sxi, L[j].y, 34);
      const s = spr('ui/plate', sxi, L[j].y + 4, 0.5, 1, midC, 0.5); s.wx = sxi - 40; s.ww = 80;
      const n = sA + j + 1, tq = btext('Q' + n, n > 99 ? 28 : 34, 0xfff4dc, null); tq.y = -80; s.addChild(tq);
      const badge = spr('ui/ok', 40, -112, 0.5, 0.5, s, 0.36); badge.visible = false; badge.pop = 1;
      signs.push({ s, badge, st: 0 });
      const c = new PIXI.Container(); c.x = sxi; c.y = L[j].y - 76; c.wx = sxi - 40; c.ww = 80;
      c.glow = spr('fx/glow', 0, 0, 0.5, 0.5, c, 0.7); c.glow.blendMode = 'add';
      c.s = spr('item/coinGold', 0, 0, 0.5, 0.5, c, 0.34); c.visible = false; c.pop = 1; midC.addChild(c); coins.push(c);
      const fx0 = flagX(j);
      shadowAt(fx0, L[j].y, 14);
      const post = spr('ui/pole', fx0, L[j].y + 4, 0.5, 1, midC, 0.5); post.wx = fx0 - 20; post.ww = 80;
      const pen = spr('ui/penDown', 2, -36, 0.1, 0.05, post, 1);
      flags.push({ x: fx0, y: L[j].y, up: false, t: 0, o: j, s: post, pen, i: j });
    }
    // foreground in the world (closer than the path, so blurred and moving at 1.25 of the camera): bush clumps on the
    // ground at the start and beyond the top ledge, where the climber never walks
    const fgb = (x, y, sc) => { const b = new PIXI.Sprite(T('fgbush')); b.anchor.set(0.5, 1); b.x = x; b.y = y; b.scale.set(sc); fgW.addChild(b); return b; };
    fgb(-300, 34, 0.42);
    fgb(L[sK].x + SUMW + 40, L[sK].y + 34, 0.45);
    stageTint = STAGE_TINT[stage % STAGE_TINT.length];
    if (built) applyNight();
  }
  // Each stage gets its own light over the same art (a gentle tint on the sky and far layers): clear, warm, fresh, cool.
  const STAGE_TINT = [0xffffff, 0xfff0e2, 0xe8f6ec, 0xeceaff];
  let stageTint = 0xffffff, heroC;
  function setStage(k) { stage = k; sA = STG[k][0]; sK = STG[k][1] - STG[k][0]; layout(); buildStage(); }
  let backDeco, shadow, fgW, raysS;
  // Painted layers tile sideways only: drawn 2 units shorter and 1 unit down, so linear filtering never blends the
  // top row with the bottom row of the repeating texture (that showed as a pale line).
  function layerTiling(name, hu) { const t = tiling(T(name), VW / Z, hu - 2); t.tileScale.set(0.5); t.tilePosition.y = -1; t.scale.set(Z); return t; }
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
    lay.sunGlow = spr('fx/glow', VW * 0.8, VH * 0.13, 0.5, 0.5, bgC, 4); lay.sunGlow.blendMode = 'add';
    lay.sun = spr('fx/glow', VW * 0.8, VH * 0.13, 0.5, 0.5, bgC, 0.9); lay.sun.blendMode = 'add';
    lay.moon = spr('bg/moonFull', VW * 0.24, VH * 0.14, 0.5, 0.5, bgC, 0.45);
    // painted ranges, back to front: far snowy range, the landmark peak, clouds, mid range, fog, near hills, the
    // valley haze under them, and the sea of clouds (seen from above once the climber is high)
    lay.far = layerTiling('far', 300); bgC.addChild(lay.far);
    lay.peak = new PIXI.Sprite(tex.peak); lay.peak.anchor.set(0.5, 1); lay.peak.scale.set(300 * Z / tex.peak.height); bgC.addChild(lay.peak);
    cloudsC = new PIXI.Container(); bgC.addChild(cloudsC);
    seed = 11;
    for (let i = 0; i < 7; i++) {
      const c = spr('bg/cloud' + [1, 2, 3, 5, 6, 8, 2][i], i * 260 + rnd() * 120, VH * (0.06 + rnd() * 0.26), 0.5, 0.5, cloudsC, (0.3 + rnd() * 0.3) * Z);
      c.v = 6 + rnd() * 8; c.span = 2200; c.alpha = 0.85;
    }
    lay.sea = layerTiling('cloudsea', 160); bgC.addChild(lay.sea);
    lay.mid = layerTiling('mid', 420); bgC.addChild(lay.mid);
    lay.fog = new PIXI.Sprite(frame('fx/band')); lay.fog.width = VW; lay.fog.height = 150 * Z; lay.fog.alpha = 0.55; bgC.addChild(lay.fog);
    birdsC = new PIXI.Container(); bgC.addChild(birdsC);
    birds.list = []; for (let k = 0; k < 4; k++) { const b = spr('fx/bird0', 0, 0, 0.5, 0.5, birdsC, 0.5 * Z); b.visible = false; birds.list.push(b); }
    lay.near = layerTiling('near', 360); bgC.addChild(lay.near);
    lay.nearFill = new PIXI.Sprite(PIXI.Texture.WHITE); lay.nearFill.width = VW; bgC.addChild(lay.nearFill);
    // light rays: a separate additive overlay at half resolution, so the painted layers stay sharp
    raysS = new PIXI.Sprite(PIXI.Texture.WHITE); raysS.tint = 0x000000; raysS.width = VW; raysS.height = VH * 0.8; bgC.addChild(raysS); raysS.visible = false;

    // the world: the stage's own objects (built by buildStage), then the climber, effects and the near foreground
    worldC.scale.set(Z);
    backC = new PIXI.Container(); backDeco = new PIXI.Container(); midC = new PIXI.Container(); heroC = new PIXI.Container();
    fxC = new PIXI.Container(); fgW = new PIXI.Container();
    worldC.addChild(backC, backDeco, midC, heroC, fxC, fgW);
    buildStage();
    shadow = spr('fx/shadow', 0, 0, 0.5, 0.5, heroC, 0.9); shadow.alpha = 0.4;
    buildHero(heroC);
    xpText = btext('+10 XP', 26, 0xffe27a, fxC); xpText.visible = false;
    parts.length = 0;
    for (let i = 0; i < 130; i++) { const s = spr('fx/soft', 0, 0, 0.5, 0.5, fxC); s.visible = false; parts.push({ s, vx: 0, vy: 0, t: 0, l: 1, g: 0, spin: 0, drag: 0, grow: 0, kind: '' }); }
    // a bank of clouds below the path (screen space, scrolling with the world): the cliffs go down into it, so the
    // valley reads as far below
    fgs.length = 0;
    lay.bankFill = new PIXI.Sprite(PIXI.Texture.WHITE); lay.bankFill.width = VW; fgC.addChild(lay.bankFill);
    lay.bank = layerTiling('cloudsea', 160); fgC.addChild(lay.bank);
    wipeC = new PIXI.Container(); fgC.addChild(wipeC); seed = 31;
    for (let k = 0; k < 7; k++) { const c = spr('bg/cloud' + [1, 2, 3, 5, 6, 8, 3][k], VW * ((k % 3) * 0.42 + 0.08 + rnd() * 0.12), VH * (0.04 + k * 0.14), 0.5, 0.5, wipeC, (0.95 + rnd() * 0.4) * Z); c.alpha = 0.92; }
    wipeCap = new PIXI.Container(); wipeCap.x = VW / 2; wipeCap.y = VH * 0.44; fgC.addChild(wipeCap);
    wipeCap.t1 = btext('Next mountain', 22, 0xfff4dc, wipeCap); wipeCap.t1.y = -40; wipeCap.t2 = btext('Stage 2', 42, 0xffffff, wipeCap);
    wipeC.visible = wipeCap.visible = false;

    // floaters: leaves by day, fireflies by night (screen space)
    floaters.length = 0; seed = 21;
    for (let k = 0; k < 7; k++) { const s = spr('fx/leaf', rnd() * VW, rnd() * VH, 0.5, 0.5, fgC, 0.42); floaters.push({ s, x: 40 + rnd() * (VW - 80), y: VH * (0.25 + rnd() * 0.5), vx: 14 + rnd() * 14, vy: 26 + rnd() * 16, spin: (rnd() - 0.5) * 3, t: rnd() * 9, o: rnd() * 6 }); }
    // vignette as two strips (top and bottom) instead of a full-screen layer: same look at the edges, far less fill
    vignette = new PIXI.Container(); root.addChild(vignette);
    const vt = new PIXI.Sprite(frame('fx/vgrad')); vt.width = VW; vt.height = 130; vt.scale.y *= -1; vt.y = 130; vt.tint = 0x0b1030; vignette.addChild(vt);
    const vb = new PIXI.Sprite(frame('fx/vgrad')); vb.y = VH - 120; vb.width = VW; vb.height = 120; vb.tint = 0x0b1030; vignette.addChild(vb);
    // filters: light rays (overlay, added on top of the sky and far layers), colour grading over everything
    if (FX && PIXI.filters) {
      godray = new PIXI.filters.GodrayFilter({ gain: 0.32, lacunarity: 2.4, parallel: false, center: { x: VW * 0.8, y: VH * 0.13 }, time: 0, alpha: 0.32 });
      godray.resolution = 0.5; godray.blendMode = 'add';
      raysS.filters = [godray]; raysS.visible = true;
      // full resolution (PixiJS filters default to resolution 1, which would soften the whole picture on 2x screens)
      grade = new PIXI.filters.AdjustmentFilter({ gamma: 1.02, saturation: 1.12, contrast: 1.06, brightness: 1.0, red: 1.03, green: 1.0, blue: 0.97, resolution: 'inherit' });
      root.filters = [grade];
      // a thin outline keeps the climber readable on pale haze by day; at night it becomes a cool moonlit rim
      heroLine = new PIXI.filters.OutlineFilter({ thickness: 1.4, color: 0x3a2622, alpha: 0.5, quality: 0.2, resolution: 'inherit' });
      hero.filters = [heroLine];
      // a fixed filter area (the screen) spares Pixi a bounds walk over the whole scene every frame
      root.filterArea = new PIXI.Rectangle(0, 0, VW, VH);
    }
    st.eventMode = 'none'; st.interactiveChildren = false;
    built = true;
  }

  function resetState() {
    plan.length = 0; planOn = false; onArrive = null; coin.on = false; celebT = 0; H.sq = 0; H.book = 0; H.after = '';
    H.x = START_X0; H.y = H.gy = 0; heroState('idle'); lastX = H.x; wipeK = 0;
    for (let j = 0; j < sK; j++) setSign(j, 0);
    for (const c of coins) c.visible = false;
    for (const l of lifts) { l.y = l.y0; l.on = false; l.ret = false; l.used = false; }
    for (const f of flags) if (!f.big) { f.up = false; f.t = 0; f.pen.texture = frame('ui/penDown'); f.pen.anchor.set(0.1, 0.05); f.pen.y = -36; }
    for (const p of parts) p.s.visible = false;
    if (xpText) xpText.visible = false;
    beacon.lit = false;
    atStart = true; summitView = false; cam.z1 = cam.z = 1; bgDim = 1;
    cam.fy0 = cam.fy1 = cam.fy = feetY('start'); snapCam(); camX0 = cam.x;
    Object.assign(pose, want); stepPose(0);
  }
  // Draw every object once at start-up (culling off) so all textures are uploaded and all filter shaders compiled
  // before the first tap: no compile stall later (the beacon's glow used to cost 170 ms at the summit).
  function prewarm() {
    for (const c of [backC, backDeco, midC]) for (const k of c.children) k.renderable = true;
    // the summit star's glow exists only in the last stage: compile its shader now, not in the middle of a climb
    let w = null;
    if (FX && !glow && PIXI.filters && PIXI.filters.GlowFilter) { w = spr('fx/soft', 40, 40, 0.5, 0.5, fxC, 0.2); w.alpha = 0.01; w.filters = [new PIXI.filters.GlowFilter({ distance: 12, outerStrength: 1.6, color: 0xffd36b, quality: 0.2, resolution: 'inherit' })]; }
    const keep = worldC.position.clone(); worldC.position.set(0, 0); app.render(); worldC.position.copyFrom(keep);
    if (w) { w.destroy(); }
  }
  function renderOnce() { if (!app) return; stT0 = performance.now(); update(0); app.render(); }
  let laterT = 0;
  function renderLater() { if (!laterT) laterT = setTimeout(() => { laterT = 0; if (!running) renderOnce(); }, 260); }

  /* ---------- day and night ---------- */
  const LAYERS = ['sky', 'far', 'peak', 'cloudsea', 'mid', 'near'];
  function loadSet(tod) {
    if (tex['sky-' + tod]) return Promise.resolve();
    const urls = LAYERS.map(n => base + kit.layers[n][tod]);
    return PIXI.Assets.load(urls).then(t => {
      LAYERS.forEach((n, k) => { const x = tex[n + '-' + tod] = t[urls[k]]; if (n !== 'sky' && n !== 'peak') x.source.addressMode = 'repeat'; });
    });
  }
  function applyNight() {
    if (!built) return;
    const tod = night ? 'night' : 'day', pal = kit.palette[tod];
    if (!tex['sky-' + tod]) { loadSet(tod).then(() => { applyNight(); renderOnce(); }); return; }
    lay.sky.texture = tex['sky-' + tod]; lay.far.texture = tex['far-' + tod]; lay.peak.texture = tex['peak-' + tod];
    lay.mid.texture = tex['mid-' + tod]; lay.near.texture = tex['near-' + tod]; lay.sea.texture = lay.bank.texture = tex['cloudsea-' + tod];
    lay.bankFill.tint = night ? 0x3a4078 : 0xc6d8ee;
    for (const c of wipeC.children) c.tint = night ? 0x5c66a6 : 0xffffff;
    lay.fog.alpha = night ? 0.3 : 0.55;
    if (heroLine) { heroLine.color = night ? 0x9fb2ff : 0x3a2622; heroLine.alpha = night ? 0.3 : 0.5; }
    const hex = s => parseInt(s.slice(1), 16);
    lay.nearFill.tint = hex(pal.nearBottom); lay.fog.tint = hex(pal.fog);
    starsC.visible = night; lay.moon.visible = night; lay.sun.visible = !night;
    lay.sunGlow.tint = night ? 0x8fa6ff : 0xffe2a8; lay.sunGlow.alpha = night ? 0.3 : 0.55; lay.sunGlow.x = night ? VW * 0.24 : VW * 0.8; lay.sunGlow.y = VH * (night ? 0.14 : 0.13);
    for (const c of cloudsC.children) { c.tint = night ? 0x46508a : 0xffffff; c.alpha = night ? 0.55 : 0.85; }
    // night: the rock and plants take the moonlight (cool, darker); lamps and the beacon keep their warm light
    const rock = night ? 0x7a84b8 : 0xffffff, plant = night ? 0x7f8bc0 : 0xffffff;
    for (const c of cols) { c.body.tint = rock; for (const k of c.lips) k.tint = plant; }
    for (const b of blocks) b.tint = rock;
    for (const d of backDeco.children) if (d !== beaconGlow && d !== beacon) d.tint = night ? 0x8d97c9 : 0xffffff;
    for (const f of flags) if (f.big) { f.s.tint = night ? 0xb8c0e0 : 0xffffff; f.pen.tint = night ? (f.gold ? 0xfff0c0 : 0x9aa6d8) : 0xffffff; }
    for (const sg of signs) sg.s.tint = night ? 0xb0b8e0 : 0xffffff;
    for (const f of falls) { f.s.tint = night ? 0x7084c8 : 0xd6f0ff; f.s.alpha = night ? 0.7 : 0.92; }
    for (const f of fgs) f.s.tint = night ? 0x0a1022 : 0xffffff;
    for (const b of fgW.children) b.tint = night ? 0x2a3360 : 0xffffff;
    for (const f of floaters) { f.s.texture = frame(night ? 'fx/soft' : 'fx/leaf'); f.s.blendMode = night ? 'add' : 'normal'; f.s.tint = night ? 0xd8ff7a : 0x8fd16a; f.s.scale.set(night ? 0.12 : 0.42); if (night) { f.x = 30 + rnd() * (VW - 60); f.y = VH * (0.3 + rnd() * 0.4); f.s.rotation = 0; } }
    hero.children.forEach(s => { s.tint = night ? 0xb6bee2 : 0xffffff; });
    vignette.alpha = night ? 0.6 : 0.32;
    // light rays by day only (at night they would streak across the moon)
    raysS.visible = !!godray && !night;
    if (grade) { grade.saturation = night ? 1.0 : 1.12; grade.contrast = night ? 1.08 : 1.06; grade.red = night ? 0.96 : 1.03; grade.blue = night ? 1.06 : 0.97; grade.gamma = night ? 0.98 : 1.02; }
    app.renderer.background.color = hex(pal.sky[0]);
  }

  /* ---------- public interface (used by app.js) ---------- */
  Object.assign(API, {
    init(e) {
      N = e.N; RM = e.RM; night = e.night; VW = e.W; VH = e.H; base = e.assetBase;
      STG = e.stages && e.stages.length ? e.stages : [[0, N]]; stage = 0; sA = 0; sK = STG[0][1] - STG[0][0];
      app = new PIXI.Application();
      // The renderer (WebGL context, shaders) and the art (decoded off the main thread) start together.
      return fetch(base + 'kit.json').then(r => r.json()).then(k => {
        kit = k;
        // the first frame needs the atlas, the layers and the start ledge's cliff; the rest loads right after it
        const tod = night ? 'night' : 'day', urls = [base + kit.atlas.image, base + kit.textures['cliff-wide']];
        const art = Promise.all([PIXI.Assets.load(urls), loadSet(tod)]).then(([t]) => {
          atlas = t[urls[0]]; tex['cliff-wide'] = t[urls[1]];
          LAYERS.forEach(n => { tex[n] = tex[n + '-' + tod]; });
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
        installFont(); layout(); build(); resetState();
        app.ticker.add(tick, null, PIXI.UPDATE_PRIORITY.HIGH);
        app.ticker.add(tickEnd, null, PIXI.UPDATE_PRIORITY.UTILITY);
        applyNight();
        renderOnce();
        // Ambient life at the start screen (breathing, blinking, clouds, birds, waterfalls) until the first tap.
        if (!RM) kick();
        // The rest of the art loads now (the start screen is already on screen) and is drawn once while the player
        // is still on the start card, so no texture is uploaded during a climb. app.js enables the start button after.
        const rest = Object.keys(kit.textures).filter(n => !tex[n]), ru = rest.map(n => base + kit.textures[n]);
        readyP = Promise.all([PIXI.Assets.load(ru), new Promise(res => { stripImg = new Image(); stripImg.onload = stripImg.onerror = res; stripImg.src = base + kit.strip.image; })])
          .then(([t]) => {
            rest.forEach((n, k) => { tex[n] = t[ru[k]]; });
            tex.waterfall.source.addressMode = 'repeat';
            for (const c of cols) c.body.texture = tex[c.texName];
            for (const f of falls) f.s.texture = tex.waterfall;
            for (const b of fgW.children) b.texture = tex.fgbush;
            prewarm(); renderOnce();
          });
      });
    },
    whenReady: () => readyP || Promise.resolve(),
    walkToFirst(cb) {
      plan.length = 0; Wk(H.x, 0, stand(0), 0, 620, 2);
      atStart = false; cam.fy0 = cam.fy; cam.fy1 = feetY('walk'); cam.ft = RM ? 1 : 0;
      begin(cb);
    },
    // i is the chapter's MCQ index. After the last MCQ of a stage the climber reaches the camp, the clouds rise, the
    // next mountain is built behind them, and she walks in to its first ledge (about 1.5 s on top of the climb).
    travel(i, cb) {
      const j = J(i); plan.length = 0; raiseFlag(j); planMove(j);
      if (j === sK - 1 && !lastStage()) { const b = L[sK]; caption(stage + 1); Wp(b.x + 16, b.y, RM ? 1 : 1000); Wk(START_X0, 0, stand(0), 0, 520, 2); }
      begin(cb);
    },
    toSummit(cb) {
      const j = sK - 1; plan.length = 0; raiseFlag(j); planMove(j);
      const end = landmark.x - 118;
      Wk(stand(sK), L[sK].y, end, L[sK].y, 300, 1);
      begin(() => {
        // the camera pulls back over the climbed ledges and the sea of clouds
        beacon.lit = true; summitView = true; cam.z1 = 0.84; if (RM) snapCam();
        if (!RM) {
          celebT = 1.1; heroState('cheer'); confetti(H.x + 40, H.y - 120, 46); sparkle(beacon.x, beacon.y - 30, 24, 120);
          firework(beacon.x - 80, beacon.y - 160); sfx('cheer');
        }
        cb(RM ? 0 : 1100);
      });
    },
    coin(i, gold, cb) {
      const j = J(i);
      if (RM || !coins[j]) { if (coins[j]) coins[j].visible = false; cb(i); return; }
      coinStart(j, gold, () => cb(i)); kick();
    },
    // animate=false (Strip, Classic): the world is behind the sheet, so it is redrawn later, off the tap's frame.
    sign(i, st, animate) {
      const j = J(i); if (j < 0 || j >= sK) return;
      setSign(j, st);
      if (animate && !RM) { sparkle(signX(j) + 20, L[j].y - 56, st === 1 ? 12 : 4, 50); kick(); }
      else { coins[j].pop = 1; signs[j].badge.pop = 1; signs[j].badge.scale.set(0.36); renderLater(); }
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
    // Strip and Classic jump straight to a question (the world is behind the sheet); this may change the stage.
    place(i) {
      const sg = i === 'summit' ? STG.length - 1 : stageIdx(i);
      if (sg !== stage) setStage(sg);
      const k = i === 'summit' ? sK : J(i);
      H.x = i === 'summit' ? landmark.x - 118 : stand(k); H.y = H.gy = L[k].y; wipeK = 0;
      atStart = false; if (i === 'summit') { summitView = true; cam.z1 = 0.84; }
      for (const l of lifts) { l.y = l.y0; l.on = false; l.ret = false; }
      for (const f of flags) if (!f.big && f.i < k && !f.up) { f.up = true; f.t = 1; f.pen.y = -148; f.pen.texture = frame('ui/pen0'); f.pen.anchor.set(0.03, 0.5); }
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
        for (const f of flags) if (f.up && f.t < 1 && !f.big) { f.t = 1; f.pen.y = -148; }
        H.sq = 0; snapCam(); renderOnce();
      }
      return did;
    },
    sleep() { awake = false; cam.ft = 1; cam.fy = cam.fy1; snapCam(); renderOnce(); if (!ambient()) { app.ticker.stop(); running = false; } else kick(); },
    wake,
    reset() { if (stage !== 0) setStage(0); resetState(); renderOnce(); if (!RM) kick(); },
    resize(w, h) {
      if (!app || !built) return;
      VW = w; VH = h; app.renderer.resize(w, h);
      Z = zoomFor(w, h);
      const keep = { x: H.x, y: H.y, gy: H.gy, st: H.st }, sts = signs.map(s => s.st), up = flags.map(f => f.up), ly = lifts.map(l => l.y), lit = beacon.lit;
      build(); applyNight(); prewarm();
      signs.forEach((s, i) => setSign(i, sts[i])); coins.forEach(c => { c.pop = 1; }); signs.forEach(s => { s.badge.pop = 1; s.badge.scale.set(0.36); });
      flags.forEach((f, i) => { if (up[i] && !f.big) { f.up = true; f.t = 1; f.pen.y = -148; f.pen.texture = frame('ui/pen0'); f.pen.anchor.set(0.03, 0.5); } });
      lifts.forEach((l, i) => { l.y = ly[i]; }); beacon.lit = lit;
      H.x = keep.x; H.y = keep.y; H.gy = keep.gy; H.st = keep.st;
      snapCam(); renderOnce();
    },
    theme(n) { night = n; if (built) { applyNight(); renderOnce(); } },
    pause() { paused = true; if (app && app.ticker) app.ticker.stop(); running = false; },
    resume() { paused = false; if (built && (awake || busy() || ambient())) { running = true; app.ticker.start(); } },
    running: () => running,
    scriptTimes(reset) { const n = Math.min(stN, ST.length), out = Array.from(ST.subarray(0, n)); if (reset) stN = 0; return out; },
    info: () => 'HD · Z ' + Z.toFixed(2) + ' · res ' + (app ? app.renderer.resolution : '-') + ' · ' + (app && app.renderer ? app.renderer.name : '-') + (FX ? ' · fx' : ' · no fx') + ' · q-' + qStep,
    quality: () => ({ step: qStep, resolution: app ? app.renderer.resolution : null }),
    heroState: () => H.st,                                   // for the screenshot tool
    stageInfo: () => ({ stage, stages: STG.length, wipe: wipeK }),
    // Strip mode draws from a small sheet of its own (never from the 2048 px atlas).
    stripArt: () => stripImg && stripImg.naturalWidth && {
      img(c, name, x, y, w, h) { const f = kit.strip.frames[name]; c.imageSmoothingEnabled = true; c.drawImage(stripImg, f[0], f[1], f[2], f[3], x, y, w, h); },
      coin(c, gold, x, y, size) { this.img(c, gold ? 'coinGold' : 'coinSilver', x - size * 0.75, y - size * 0.75, size * 1.5, size * 1.5); },
      flag(c, x, y) { this.img(c, 'flag', x - 6, y - 20, 21, 21); },
      hero(c, x, y, p, size) { const k = size * 1.5 / 96; this.img(c, p === 'jump' ? 'jump' : p === 'happy' ? 'cheer' : 'idle', Math.round(x - 36 * k), Math.round(y - 96 * k), 72 * k, 96 * k); },
    },
  });

  // Zoom: 1 on phones (360-430 px wide), larger on tablets and desktops, from the shorter useful side.
  function zoomFor(w, h) { return clamp(Math.min(w, h * 0.62) / 380, 0.9, 1.7); }
})();
