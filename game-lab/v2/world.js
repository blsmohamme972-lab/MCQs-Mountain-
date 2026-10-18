'use strict';
/* MCQs Mountain v2: the game world, on PixiJS 8 with its Canvas 2D renderer (DECISIONS.md D24).
   Pixel art (TEST ONLY, ASSETS.md) is drawn at 1 canvas pixel per CSS pixel and scaled by the browser with
   nearest-neighbour filtering, S CSS px per art px. World units below are art pixels, y grows downward.
   Speed rules from D8 still hold: one canvas, the loop runs only while something moves, time-based motion with a
   clamped delta, no per-frame allocation in the hot path. A chapter has 1 to 200 MCQs (D27): it is cut into stages of
   about 10 (app.js gives the split), and only the current stage exists. Its islands come from a few textures cached by
   size and its signs from one shared plate with pixel-font digits on top, so a 200-MCQ chapter costs what 8 cost. */
(function () {
  const API = window.World;
  const P = new URLSearchParams(location.search);
  const T = 32;                       // terrain tile size (art px)
  const LW = 64, SLAB = 32, GAP = 8;  // ledge width, stepping-slab width, gap between pieces
  const RISE_STEP = 28, LIFT_RISE = 112, SUMW = 128;
  let app, kit, N = 8, RM = false, LOW = false, S = 3, VW = 360, VH = 740, night = false;
  let atlasImg, tex = {}, layer = {}, world, back, mid, fx, stB, stM, hero, shadow, overlay, waterFill, veil, capC;
  const L = [], pillars = [], slabs = [], lifts = [], signs = [], coins = [], glints = [], palms = [];
  const anims = [];                   // one-shot animated sprites (dust, sparkle, trophy press, camp flag)
  const parts = [];                   // particle pool (confetti, puffs)
  let startSign, trophy, camp, heroKey = 'captain', heroDef;

  /* ---------- stages and layout: the draft's path, rebuilt for 32 px pixel-art tiles, one stage at a time ---------- */
  // Each stage is its own island chain in stage-local coordinates (the climber starts every stage at the START
  // island, x START_X + 24, y 0): a ledge per MCQ, one lift in the middle (the long beat), and a camp at the top (the
  // real summit, with the trophy, only in the last stage).
  let STG = [[0, 8]], stage = 0, sA = 0, sK = 8;
  const lastStage = () => stage === STG.length - 1;
  const stageIdx = i => { for (let k = 0; k < STG.length; k++) if (i < STG[k][1]) return k; return STG.length - 1; };
  const J = i => i - sA;                                       // chapter MCQ index -> ledge in this stage
  const liftJ = () => sK >= 6 ? Math.floor(sK / 2) - 1 : -1;   // the same ledge as the HD tier
  const stand = j => L[j].x + 14, signX = j => L[j].x + 46;
  function layout() {
    L.length = 0; slabs.length = 0; lifts.length = 0;
    let x = 0, y = 0;
    for (let j = 0; j <= sK; j++) {
      L.push({ x, y });
      if (j === sK) break;
      if (j === liftJ()) { lifts.push({ x: x + LW + 4, y, y0: y, y1: y - LIFT_RISE, j }); x += LW + 40; y -= LIFT_RISE; }
      else { slabs.push({ x: x + LW + GAP, y: y - RISE_STEP, j }); x += LW + GAP + SLAB + GAP; y -= 2 * RISE_STEP; }
    }
  }
  const START_X = -136, START_W = 192, HOME_X = START_X + 24;

  /* ---------- textures ---------- */
  function frame(name) {
    if (tex[name]) return tex[name];
    const f = kit.atlas.frames[name];
    if (!f) throw new Error('missing frame ' + name);
    return (tex[name] = new PIXI.Texture({ source: atlasImg.source, frame: new PIXI.Rectangle(f[0], f[1], f[2], f[3]) }));
  }
  const animFrames = name => kit.atlas.anims[name].frames.map(frame);
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
  function blit(x, name, dx, dy) { const f = kit.atlas.frames[name]; x.drawImage(atlasImg.source.resource, f[0], f[1], f[2], f[3], dx, dy, f[2], f[3]); }
  function tile(x, c, r, dx, dy) { const f = kit.atlas.frames.terrain; x.drawImage(atlasImg.source.resource, f[0] + c * T, f[1] + r * T, T, T, dx, dy, T, T); }
  function text(x, s, dx, dy, col) {
    for (let i = 0; i < s.length; i++) { const k = 'font-' + col + '/' + s.charCodeAt(i); if (kit.atlas.frames[k]) blit(x, k, dx + i * 8, dy); }
  }
  function label(s, col) {
    // Pixel-font label with a 1 px dark outline, baked once.
    const [c, x] = canvas(s.length * 8 + 2, 12);
    for (const [ox, oy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) text(x, s, ox, oy, 'b');
    text(x, s, 1, 1, col);
    return PIXI.Texture.from(c);
  }
  // A floating island of rock: grass top, stone edges, rounded bottom (tiles from the Treasure Hunters terrain sheet).
  // Baked once per size (columns x rows) and shared by every island of that size, in every stage.
  const islandCache = {};
  function islandTex(cols, rows) {
    const key = cols + 'x' + rows;
    if (islandCache[key]) return islandCache[key];
    const [c, x] = canvas(cols * T, rows * T);
    const col = k => cols === 1 ? 4 : k === 0 ? 0 : k === cols - 1 ? 2 : 1;
    for (let k = 0; k < cols; k++) for (let r = 0; r < rows; r++) tile(x, col(k), r === 0 ? 0 : r === rows - 1 ? 2 : 1, k * T, r * T);
    return (islandCache[key] = PIXI.Texture.from(c));
  }
  // A signpost with a blank paper plate, one texture per plate width (chars of text it holds): the text ("Q3", "Q200",
  // "CAMP") is laid on top as pixel-font glyph sprites from the atlas, so no texture is made per number.
  const plateCache = {};
  const plateW = n => Math.max(30, n * 8 + 8);
  function plateTex(n) {
    const w = plateW(n);
    if (plateCache[w]) return plateCache[w];
    const [c, x] = canvas(w, 34), ink = '#3b2c35', paper = '#f2d3a5', shade = '#d9aa74', wood = '#8a4f35';
    x.fillStyle = ink; x.fillRect(w / 2 - 2, 14, 4, 20); x.fillStyle = wood; x.fillRect(w / 2 - 1, 14, 2, 20);
    x.fillStyle = ink; x.fillRect(1, 1, w - 2, 16); x.fillStyle = shade; x.fillRect(2, 2, w - 4, 14); x.fillStyle = paper; x.fillRect(2, 2, w - 4, 12);
    return (plateCache[w] = PIXI.Texture.from(c));
  }
  // The badge on a plate's corner after grading: 1 correct (green tick), 2 saved for review (amber flag).
  const badgeCache = {};
  function badgeTex(st) {
    if (badgeCache[st]) return badgeCache[st];
    const [c, x] = canvas(10, 10), col = st === 1 ? '#2f9e57' : '#e3962c', dk = st === 1 ? '#1c6b39' : '#9a5a14';
    x.fillStyle = '#3b2c35'; x.fillRect(0, 0, 10, 10); x.fillStyle = col; x.fillRect(1, 1, 8, 8); x.fillStyle = dk; x.fillRect(1, 8, 8, 1);
    x.fillStyle = '#fff';
    if (st === 1) [[2, 4], [3, 5], [4, 6], [5, 5], [6, 4], [7, 3]].forEach(p => x.fillRect(p[0], p[1], 1, 1));
    else { x.fillRect(3, 2, 1, 6); x.fillRect(4, 2, 3, 1); x.fillRect(4, 3, 2, 1); x.fillRect(4, 4, 3, 1); }
    return (badgeCache[st] = PIXI.Texture.from(c));
  }
  // A sign: its plate, the glyphs of its text, and the badge. Anchored at its post's foot (x, y).
  function plate(s, x, y, parent) {
    const c = new PIXI.Container(), w = plateW(s.length);
    c.x = x - w / 2; c.y = y - 34; c.w = w; parent.addChild(c);
    c.addChild(new PIXI.Sprite(plateTex(s.length)));
    for (let k = 0; k < s.length; k++) {
      const name = 'font-b/' + s.charCodeAt(k);
      if (!kit.atlas.frames[name]) continue;
      const g = new PIXI.Sprite(frame(name)); g.x = w / 2 - s.length * 4 + k * 8; g.y = 3; c.addChild(g);
    }
    return c;
  }

  /* ---------- small helpers ---------- */
  const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const easeOut = t => 1 - (1 - t) * (1 - t), easeInOut = t => t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
  const sfx = k => { try { window.Sound && window.Sound.play(k); } catch (e) {} };
  function spr(t, x, y, ax, ay, parent) { const s = new PIXI.Sprite(t); s.anchor.set(ax == null ? 0.5 : ax, ay == null ? 1 : ay); s.x = x; s.y = y; (parent || mid).addChild(s); return s; }
  // Looping animation clock shared by ambient sprites; one-shot sprites track their own time.
  function oneShot(name, x, y, parent, ax, ay) {
    let a = null;
    for (const o of anims) if (!o.s.visible) { a = o; break; }
    if (!a) { a = { s: spr(frame(kit.atlas.anims[name].frames[0]), 0, 0, 0.5, 1, parent || fx) }; anims.push(a); }
    if (a.s.parent !== (parent || fx)) (parent || fx).addChild(a.s);
    a.name = name; a.t = 0; a.fr = animFrames(name); a.fps = kit.atlas.anims[name].fps; a.done = null;
    a.s.texture = a.fr[0]; a.s.anchor.set(ax == null ? 0.5 : ax, ay == null ? 1 : ay); a.s.x = x; a.s.y = y; a.s.visible = true; a.s.alpha = 1; a.s.scale.set(1);
    return a;
  }

  /* ---------- the hero ---------- */
  const H = { x: 0, y: 0, gy: 0, anim: 'idle', t: 0, sq: 0, sqD: 1, sqA: 0 };
  let HA = {};                       // the hero's animations: { idle: { fr, fps, loop }, run, jump, fall, land, spin }
  function heroAnims() {
    HA = {};
    for (const a of ['idle', 'run', 'jump', 'fall', 'land', 'spin']) {
      const A = kit.atlas.anims[heroKey + '/' + a];
      if (A) HA[a] = { fr: A.frames.map(frame), fps: A.fps, loop: A.loop };
    }
    // Pixel Adventure heroes have no landing frames: they land on the idle pose with a squash.
    if (!HA.land) HA.land = { fr: [HA.idle.fr[0]], fps: 1, loop: false };
  }
  function heroAnim(a) { if (H.anim !== a) { H.anim = a; H.t = 0; } }
  function heroFrame(dt) {
    H.t += dt;
    const A = HA[H.anim] || HA.idle, n = A.fr.length;
    let k = Math.floor(H.t * A.fps);
    k = A.loop ? k % n : Math.min(n - 1, k);
    hero.texture = A.fr[k];
    let sx = 1, sy = 1;
    if (H.sq > 0) { const a = Math.sin(Math.PI * (1 - H.sq / H.sqD)) * H.sqA; sx = 1 + a * 0.8; sy = 1 - a; }
    hero.scale.set(sx, sy);
    hero.x = H.x; hero.y = H.y;
    const k2 = Math.max(0.35, 1 - (H.gy - H.y) / 50);
    shadow.x = H.x; shadow.y = H.gy + 1; shadow.scale.set(k2, k2 * 0.7); shadow.alpha = 0.55 * k2;
  }
  function squash(d, a) { if (RM) return; H.sq = H.sqD = d; H.sqA = a; }

  /* ---------- movement plan (from the draft): walk, hop, lift, celebrate, and the stage change ---------- */
  const plan = [];
  let pi = 0, pt = 0, planOn = false, onArrive = null;
  const Wk = (x0, y0, x1, y1, d, e) => plan.push({ k: 0, x0, y0, x1, y1, d, e: e || 0 });
  const Hp = (x0, y0, x1, y1, d, hgt) => plan.push({ k: 1, x0, y0, x1, y1, d, h: hgt || 14 });
  const Lf = (x, y0, y1, d, lift) => plan.push({ k: 2, x0: x, y0, x1: x, y1, d, lift });
  const Wt = (x, y, d) => plan.push({ k: 6, x0: x, y0: y, x1: x, y1: y, d });
  // The stage change: the screen fades to the night-sky ink with "STAGE 2 OF 3", the next stage is built behind it,
  // and the fade lifts on the climber at the next START island (about 0.8 s, skippable, instant with reduced motion).
  const Fd = d => plan.push({ k: 5, x0: HOME_X, y0: 0, x1: HOME_X, y1: 0, d, swapped: false });
  let fadeK = 0;
  function swapStage(s) { s.swapped = true; setStage(stage + 1); H.x = HOME_X; H.y = H.gy = 0; heroAnim('idle'); cam.fy = cam.fy1 = feetY('walk'); snapCam(); }
  function planMove(j) {
    const a = L[j], b = L[j + 1];
    if (j === liftJ()) {
      const lf = lifts[0], mx = lf.x + 16;
      Wk(stand(j), a.y, mx, a.y, 260, 2); Lf(mx, a.y, b.y, 760, lf); Wk(mx, b.y, stand(j + 1), b.y, 200, 1);
    } else {
      const sl = slabs.find(s => s.j === j), edge = a.x + LW - 8;
      Wk(stand(j), a.y, edge, a.y, 110, 0); Hp(edge, a.y, sl.x + SLAB / 2, sl.y, 195); Hp(sl.x + SLAB / 2, sl.y, stand(j + 1), b.y, 195);
    }
  }
  function begin(cb) { pi = 0; pt = 0; onArrive = cb; if (RM) finishPlan(); else { planOn = true; wake(); } }
  function stepPlan(ms) {
    pt += ms;
    let s;
    while (pi < plan.length && pt >= plan[pi].d) {
      s = plan[pi]; pt -= s.d; pi++;
      H.x = s.x1; H.y = H.gy = s.y1;
      if (s.k === 1) { squash(0.12, 0.12); heroAnim('land'); dustAt('dust/land', H.x, H.y); sfx('land'); }
      if (s.k === 2) { s.lift.y = s.y1; liftAnim(s.lift, false); }
      if (s.k === 5) { if (!s.swapped) swapStage(s); fade(0); }
      if (pi < plan.length && plan[pi].k === 1) { heroAnim('jump'); dustAt('dust/jump', H.x, H.y); sfx('jump'); }
      if (pi < plan.length && plan[pi].k === 6) raiseCamp();
    }
    if (pi >= plan.length) { arrive(); return; }
    s = plan[pi];
    const p = pt / s.d;
    if (s.k === 0) {
      const e = s.e === 1 ? easeOut(p) : s.e === 2 ? easeInOut(p) : p;
      H.x = lerp(s.x0, s.x1, e); H.y = H.gy = s.y0;
      if (H.anim !== 'land' || H.t > 0.12) heroAnim('run');
    } else if (s.k === 1) {
      H.x = lerp(s.x0, s.x1, p); H.gy = lerp(s.y0, s.y1, p);
      H.y = lerp(s.y0, s.y1, easeOut(p)) - Math.sin(Math.PI * p) * s.h;
      heroAnim(p < 0.5 ? 'jump' : 'fall');
    } else if (s.k === 5) {
      fade(p < 0.4 ? easeInOut(p / 0.4) : p < 0.6 ? 1 : 1 - easeInOut((p - 0.6) / 0.4));
      if (!s.swapped && p >= 0.4) swapStage(s);
      heroAnim('idle');
    } else if (s.k === 6) {
      if (H.anim !== 'land' || H.t > 0.12) heroAnim('idle');
    } else {
      const e = p < 0.5 ? 4 * p * p * p : 1 - 4 * (1 - p) * (1 - p) * (1 - p);
      H.y = H.gy = lerp(s.y0, s.y1, e); s.lift.y = H.y; heroAnim('idle');
      if (pt < ms + 1) { liftAnim(s.lift, true); sfx('lift'); }
    }
  }
  function finishPlan() {
    for (; pi < plan.length; pi++) {
      const s = plan[pi];
      if (s.k === 2) { s.lift.y = s.y1; liftAnim(s.lift, false); }
      if (s.k === 6) raiseCamp(true);
      if (s.k === 5 && !s.swapped) swapStage(s);
    }
    fade(0);
    const s = plan[plan.length - 1];
    H.x = s.x1; H.y = H.gy = s.y1; arrive();
  }
  function arrive() {
    planOn = false; plan.length = 0; pi = 0;
    if (!RM) squash(0.16, 0.1);
    heroAnim('idle');
    const cb = onArrive; onArrive = null;
    if (cb) cb();
  }
  // The veil and its caption ("NEXT MOUNTAIN / STAGE 2 OF 3"), drawn over the whole screen while the stage changes.
  function fade(a) {
    fadeK = a; veil.visible = a > 0; veil.alpha = a;
    capC.visible = a > 0.6; capC.alpha = clamp((a - 0.6) / 0.4, 0, 1);
  }
  function caption(k) {
    const lines = [k === STG.length - 1 ? 'LAST MOUNTAIN' : 'NEXT MOUNTAIN', 'STAGE ' + (k + 1) + ' OF ' + STG.length];
    capC.removeChildren().forEach(g => g.destroy());
    lines.forEach((s, r) => {
      const sc = r ? S : Math.max(1, S - 1), y = r ? 0 : -16 * sc;
      for (let i = 0; i < s.length; i++) {
        const name = 'font-w/' + s.charCodeAt(i);
        if (!kit.atlas.frames[name]) continue;
        const g = new PIXI.Sprite(frame(name)); g.scale.set(sc); g.x = Math.round((i - s.length / 2) * 8 * sc); g.y = y; capC.addChild(g);
      }
    });
    capC.x = Math.round(VW / 2); capC.y = Math.round(VH * 0.44);
  }
  // At a camp the checkpoint flag runs up its pole (the Pixel Adventure checkpoint), then waves.
  function raiseCamp(now) {
    if (!camp || camp.up) return;
    camp.up = true;
    if (RM || LOW || now) { camp.texture = frame('flag/idle/0'); camp.fr = animFrames('flag/idle'); return; }
    camp.visible = false; sfx('flag');
    oneShot('flag/out', camp.x, camp.y, stM).done = () => { camp.visible = true; camp.fr = animFrames('flag/idle'); };
  }

  /* ---------- coins, particles, dust ---------- */
  const coin = { on: false, t: 0, i: 0, x0: 0, y0: 0, cb: null };
  function dustAt(name, x, y) { if (RM || LOW) return; oneShot(name, x, y + 1, back); }
  function burst(x, y, n, kind) {
    if (RM) return;
    for (let i = 0, k = 0; i < parts.length && k < n; i++) {
      const p = parts[i]; if (p.s.visible) continue; k++;
      const a = -Math.PI / 2 + (Math.random() - 0.5) * (kind === 'confetti' ? 2.2 : 3), v = kind === 'confetti' ? 90 + Math.random() * 90 : 30 + Math.random() * 30;
      p.s.visible = true; p.s.x = x; p.s.y = y; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v; p.t = 0; p.l = kind === 'confetti' ? 1.3 : 0.45;
      p.g = kind === 'confetti' ? 160 : 40; p.s.texture = kind === 'confetti' ? frame('confetti/' + (k % 6)) : frame('puff'); p.s.alpha = 1; p.s.rotation = 0; p.spin = kind === 'confetti' ? (Math.random() - 0.5) * 12 : 0;
      p.s.scale.set(kind === 'confetti' ? 0.5 : 0.6);
    }
  }
  function coinStart(j, gold, cb) {
    const c = coins[j];
    coin.on = true; coin.t = 0; coin.i = j; coin.cb = cb; coin.x0 = c.x; coin.y0 = c.y; coin.gold = gold;
    c.visible = true;
    xpLabel.texture = gold ? lbl10 : lbl5; xpLabel.visible = false;
  }
  function coinCollect() {
    const c = coins[coin.i];
    c.visible = false; c.got = true; coin.on = false;
    if (!RM && !LOW) oneShot('coin/fx', H.x, H.y - 22, fx, 0.5, 0.5).s.scale.set(1.6);
    if (!RM) { xpLabel.visible = true; xpLabel.x = H.x; xpLabel.y = H.y - 34; xpLabel.alpha = 1; xpT = 0; }
    const cb = coin.cb; coin.cb = null;
    if (cb) cb();
  }
  let xpLabel, lbl10, lbl5, xpT = 0;

  /* ---------- lifts and signs ---------- */
  function liftAnim(l, on) { l.on = on; l.s.texture = on ? l.fr[0] : frame('lift/off'); }
  function setSign(j, st) {
    const s = signs[j];
    s.st = st; s.badge.visible = st !== 0; if (st) s.badge.texture = badgeTex(st);
    s.bubble.visible = st === 0;
    const c = coins[j];
    c.visible = st !== 0; c.gold = st === 1; c.got = false;
    c.fr = animFrames(st === 1 ? 'coin/gold' : 'coin/silver'); c.texture = c.fr[0];
    c.x = signX(j); c.y = L[j].y - 44; c.pop = st ? 0 : 1;
  }

  /* ---------- camera ---------- */
  const cam = { x: 0, y: 0, fy: 0.52, fy0: 0.52, fy1: 0.52, ft: 1 };
  function feetY(mode) { return mode === 'sheet' ? Math.max(130, Math.round(VH * 0.22)) / VH : 0.5; }
  function camTarget() { return [H.x - (VW / S) * 0.36, H.y - (VH / S) * cam.fy]; }
  function snapCam() { cam.fy = cam.fy1; cam.ft = 1; const t = camTarget(); cam.x = t[0]; cam.y = t[1]; }

  /* ---------- the loop ---------- */
  let awake = false, ambientT = 0, built = false, camMoving = false, celebrateT = 0;
  const busy = () => planOn || coin.on || xpLabel.visible || H.sq > 0 || celebrateT > 0 || anyOn(anims) || anyParts() || cam.ft < 1 || camMoving || popping();
  const anyOn = a => { for (let i = 0; i < a.length; i++) if (a[i].s.visible) return true; return false; };
  const anyParts = () => { for (let i = 0; i < parts.length; i++) if (parts[i].s.visible) return true; return false; };
  const popping = () => { for (let i = 0; i < coins.length; i++) if (coins[i].visible && coins[i].pop < 1) return true; return false; };

  function update(dt) {
    ambientT += dt;
    if (planOn) stepPlan(dt * 1000);
    if (H.sq > 0) H.sq = Math.max(0, H.sq - dt);
    if (H.anim === 'land' && H.t > 0.15 && !planOn) heroAnim('idle');
    if (celebrateT > 0) {
      celebrateT -= dt;
      const p = 1 - Math.max(0, celebrateT) / 0.9;
      H.y = H.gy - Math.sin(Math.PI * Math.min(1, p * 1.25)) * 16;
      heroAnim(p < 0.8 ? (HA.spin ? 'spin' : 'jump') : 'idle');
      if (celebrateT <= 0) { H.y = H.gy; heroAnim('idle'); squash(0.16, 0.1); }
    }
    heroFrame(dt);
    // Coin: rises from its sign, then flies to the hero (0.42 s, as in the draft).
    if (coin.on) {
      const c = coins[coin.i], t = (coin.t += dt);
      if (t < 0.22) { c.y = coin.y0 - 16 * easeOut(t / 0.22); c.x = coin.x0; }
      else if (t < 0.42) { const e = ((t - 0.22) / 0.2) ** 2; c.x = lerp(coin.x0, H.x, e); c.y = lerp(coin.y0 - 16, H.y - 20, e); }
      else coinCollect();
    }
    for (let i = 0; i < coins.length; i++) {
      const c = coins[i];
      if (!c.visible) continue;
      if (c.pop < 1) { c.pop = Math.min(1, c.pop + dt / 0.28); const e = c.pop; c.scale.set(easeOut(e) * (1 + 0.25 * Math.sin(Math.PI * e))); }
      c.texture = c.fr[Math.floor(ambientT * 10) % c.fr.length];
    }
    if (xpLabel.visible) { xpT += dt; xpLabel.y -= dt * 30; xpLabel.alpha = xpT < 0.5 ? 1 : Math.max(0, 1 - (xpT - 0.5) / 0.35); if (xpT > 0.85) xpLabel.visible = false; }
    for (let i = 0; i < anims.length; i++) {
      const a = anims[i]; if (!a.s.visible) continue;
      a.t += dt; const k = Math.floor(a.t * a.fps);
      if (k >= a.fr.length) { a.s.visible = false; if (a.done) { const d = a.done; a.done = null; d(); } continue; }
      a.s.texture = a.fr[k];
    }
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]; if (!p.s.visible) continue;
      p.t += dt; if (p.t >= p.l) { p.s.visible = false; continue; }
      p.vy += p.g * dt; p.s.x += p.vx * dt; p.s.y += p.vy * dt; p.s.rotation += p.spin * dt; p.s.alpha = 1 - (p.t / p.l) ** 2;
    }
    for (const l of lifts) { l.s.y = l.y; l.chain.height = Math.max(8, l.y - l.top); l.chain.y = l.top; if (l.on) l.s.texture = l.fr[Math.floor(ambientT * 16) % 8]; }
    if (!LOW && !RM) {
      for (const g of glints) g.s.texture = g.fr[Math.floor(ambientT * 6 + g.o) % 4];
      for (const p of palms) p.s.texture = p.fr[Math.floor(ambientT * 7 + p.o) % 4];
      if (camp && camp.up && camp.visible) camp.texture = camp.fr[Math.floor(ambientT * 14) % camp.fr.length];
    }
    // Camera: horizontal and vertical follow with exponential smoothing; the framing height eases between
    // "walking" (hero mid-screen) and "MCQ open" (hero above the sheet).
    if (cam.ft < 1) { cam.ft = Math.min(1, cam.ft + dt / 0.2); cam.fy = lerp(cam.fy0, cam.fy1, easeOut(cam.ft)); }
    const t = camTarget(), k = 1 - Math.exp(-dt * 12);
    cam.x += (t[0] - cam.x) * k; cam.y += (t[1] - cam.y) * k;
    camMoving = Math.abs(t[0] - cam.x) + Math.abs(t[1] - cam.y) > 0.2;
    if (!camMoving) { cam.x = t[0]; cam.y = t[1]; }
    place();
  }
  // Positions every layer from the camera. Parallax factors (x): sky band 0.04, back mountains 0.03, big clouds 0.08,
  // front mountains 0.07, small clouds 0.16, world 1. The horizon sinks a little as the hero climbs (y 0.12); every
  // stage starts again at y 0, so the backgrounds never run out, and each stage shows its own stretch of them (so).
  let cam0y = 0;
  function place() {
    const X = Math.round(cam.x * S), Y = Math.round(cam.y * S), dy = cam.y - cam0y, so = stage * 173;
    world.x = -X; world.y = -Y;
    // horizon = the screen row of the sea line; it sinks slowly as the hero climbs.
    const horizon = Math.round(VH * 0.6 - dy * 0.12 * S);
    const drift = RM || LOW ? 0 : ambientT;
    layer.bg.y = horizon - kit.colors.sea * S; layer.bg.tilePosition.x = -(cam.x * 0.04 + so * 0.4) * S;
    waterFill.y = layer.bg.y + kit.colors.height * S - 1; waterFill.height = Math.max(0, VH - waterFill.y);
    layer.cb.y = horizon - tex.cloudsBig.height * S + 6 * S; layer.cb.tilePosition.x = -(cam.x * 0.08 + drift * 3 + so) * S;
    if (layer.cs) { layer.cs.y = Math.round(VH * 0.12 - dy * 0.16 * S); layer.cs.tilePosition.x = -(cam.x * 0.16 + drift * 6 + so) * S; }
    if (layer.stars.visible) { layer.stars.y = Math.round(VH * 0.04 - dy * 0.05 * S); layer.stars.tilePosition.x = -(cam.x * 0.02 + so * 0.5) * S; }
    if (layer.mb) { layer.mb.y = horizon + 2 * S - layer.mb.height; layer.mb.tilePosition.x = -(cam.x * 0.03 + so * 1.3) * S; }
    layer.mf.y = horizon + 2 * S - layer.mf.height; layer.mf.tilePosition.x = -(cam.x * 0.07 + so * 2.1) * S;
    for (const g of glints) g.s.y = horizon + g.dy * S;
    // Cull world sprites outside the view (cheap: a few dozen objects).
    const x0 = cam.x - 80, x1 = cam.x + VW / S + 80;
    for (const p of pillars) p.visible = p.x < x1 && p.x + p.w > x0;
    for (const s of slabs) s.s.visible = s.x < x1 && s.x + SLAB > x0;
    for (const s of signs) s.c.visible = s.c.x < x1 && s.c.x + s.c.w > x0;
  }

  // Script time per frame (update + render submission) for the harness, as in the HD tier (World.scriptTimes).
  const ST = new Float32Array(4096); let stN = 0, stT0 = 0;
  function tick(t) {
    stT0 = performance.now();
    const dt = Math.min(50, t.deltaMS) / 1000;
    update(dt);
  }
  function tickEnd() {
    ST[stN % ST.length] = performance.now() - stT0; stN++;
    if (!awake && !busy()) { app.ticker.stop(); running = false; }
  }
  let running = false;
  function wake() { awake = true; if (!running && !paused && app) { running = true; app.ticker.start(); } }
  function kick() { if (!running && !paused && app) { running = true; app.ticker.start(); } }
  let paused = false;

  /* ---------- build the scene ---------- */
  // build(): the layers, the containers, the hero and the pools (once, and again after a resize); buildStage(): the
  // current stage's islands, slabs, lifts, signs, coins, palms, START and the camp or summit.
  function build() {
    const st = app.stage;
    for (const k of st.removeChildren()) k.destroy({ children: true });
    world = new PIXI.Container(); back = new PIXI.Container(); mid = new PIXI.Container(); fx = new PIXI.Container();
    stB = new PIXI.Container(); stM = new PIXI.Container();
    // Background, back to front. The sky is the renderer's clear colour.
    layer.bg = new PIXI.TilingSprite({ texture: tex.bg, width: VW, height: kit.colors.height * S }); layer.bg.tileScale.set(S);
    waterFill = new PIXI.Sprite(PIXI.Texture.WHITE); waterFill.width = VW; waterFill.tint = kit.colors.water;
    layer.cb = new PIXI.TilingSprite({ texture: tex.cloudsBig, width: VW, height: tex.cloudsBig.height * S }); layer.cb.tileScale.set(S);
    layer.mf = new PIXI.TilingSprite({ texture: tex.mtnFront, width: VW, height: tex.mtnFront.height * S }); layer.mf.tileScale.set(S);
    layer.stars = new PIXI.TilingSprite({ texture: tex.stars, width: VW, height: tex.stars.height * S }); layer.stars.tileScale.set(S); layer.stars.visible = false;
    st.addChild(layer.stars, waterFill, layer.bg, layer.cb);
    glints.length = 0;
    if (!LOW) {
      layer.mb = new PIXI.TilingSprite({ texture: tex.mtnBack, width: VW, height: tex.mtnBack.height * S }); layer.mb.tileScale.set(S);
      layer.cs = new PIXI.TilingSprite({ texture: tex.cloudsSmall, width: VW, height: tex.cloudsSmall.height * S }); layer.cs.tileScale.set(S);
      st.addChild(layer.mb, layer.mf, layer.cs);
      [['big', 0.18, 8], ['medium', 0.62, 16], ['small', 0.84, 11], ['medium', 0.32, 26], ['small', 0.08, 34]].forEach(([k, fx0, dy], j) => {
        const s = new PIXI.Sprite(frame('glint/' + k + '/0')); s.scale.set(S); s.x = Math.round(VW * fx0); st.addChild(s);
        glints.push({ s, fr: animFrames('glint/' + k), dy, o: j });
      });
    } else { st.addChild(layer.mf); layer.cs = layer.mb = null; }
    world.scale.set(S);
    back.addChild(stB); mid.addChild(stM);
    world.addChild(back, mid, fx);
    st.addChild(world);
    // Night: the background swaps to its night textures; this veil dims the world itself to moonlight.
    overlay = new PIXI.Graphics().rect(0, 0, 4000, 4000).fill({ color: 0x101a40, alpha: 0.3 }); overlay.visible = night;
    st.addChild(overlay);
    // The stage change's veil and caption (screen space, over everything).
    veil = new PIXI.Sprite(PIXI.Texture.WHITE); veil.width = VW; veil.height = VH; veil.tint = 0x141a33; veil.visible = false;
    capC = new PIXI.Container(); capC.visible = false;
    st.addChild(veil, capC);
    shadow = spr(frame('shadow'), 0, 0, 0.5, 0.5, mid); shadow.alpha = 0.5;
    hero = spr(frame(heroKey + '/idle/0'), 0, 0, heroDef.foot.x / heroDef.frame[0], heroDef.foot.y / heroDef.frame[1], mid);
    heroAnims();
    lbl10 = lbl10 || label('+10 XP', 'w'); lbl5 = lbl5 || label('+5 XP', 'w');
    xpLabel = spr(lbl10, 0, 0, 0.5, 1, fx); xpLabel.visible = false;
    anims.length = 0; parts.length = 0;
    for (let i = 0; i < 36; i++) { const s = spr(frame('puff'), 0, 0, 0.5, 0.5, fx); s.visible = false; parts.push({ s, vx: 0, vy: 0, t: 0, l: 1, g: 0, spin: 0 }); }
    buildStage();
    built = true;
  }
  function buildStage() {
    // one-shots playing inside the old stage (the START sign, the camp flag) leave it first, so the pool keeps them
    for (const a of anims) if (a.s.parent === stB || a.s.parent === stM) { a.s.parent.removeChild(a.s); a.s.visible = false; a.done = null; }
    for (const c of [stB, stM]) for (const k of c.removeChildren()) k.destroy({ children: true });
    pillars.length = 0; palms.length = 0; signs.length = 0; coins.length = 0; camp = null;
    // Terrain: floating islands. The START island carries ledge 0; one island per ledge; stepping slabs between
    // them; a wider island at the top (the camp, or the summit in the last stage). Textures are shared by size.
    const addIsland = (x, y, w, rows) => { const p = new PIXI.Sprite(islandTex(Math.round(w / T), rows)); p.x = x; p.y = y; p.w = w; stB.addChild(p); pillars.push(p); return p; };
    addIsland(START_X - START_W + 136, 0, START_W + LW, 3);
    for (let j = 1; j < sK; j++) addIsland(L[j].x, L[j].y, LW, 2 + ((sA + j) % 2));
    addIsland(L[sK].x, L[sK].y, SUMW, 3);
    for (const s of slabs) { s.s = spr(slabTex(), s.x, s.y, 0, 0, stB); }
    // Decorations: palms behind, a front palm at the start.
    const palm = (k, x, y, o) => { const s = spr(frame('palm/' + k + '/0'), x, y + 4, 0.5, 1, stB); stB.setChildIndex(s, 0); palms.push({ s, fr: animFrames('palm/' + k), o }); };
    palm('regular', START_X - 20, 0, 0); palm('left', START_X + 60, 0, 1); palm('right', L[sK].x + 96, L[sK].y, 2);
    if (sK > 4) palm('regular', L[4].x + 40, L[4].y, 3);
    // START (the first stage) or the stage number on a plate (the next ones; it is wider, so it stands right of the
    // climber's start, where the camera always shows it).
    startSign = stage ? plate('STAGE ' + (stage + 1), HOME_X + 52, 3, stM) : spr(frame('start/idle'), START_X - 4, 3, 0.5, 1, stM);
    // The top of the stage: the trophy on the summit, or a camp (a CAMP plate and a checkpoint flag that runs up).
    trophy = spr(frame('end/idle'), L[sK].x + SUMW - 38, L[sK].y + 4, 0.5, 1, stM); trophy.visible = lastStage();
    if (!lastStage()) {
      plate('CAMP', signX(sK) + 4, L[sK].y + 3, stM);
      camp = spr(frame('flag/pole'), L[sK].x + SUMW - 34, L[sK].y + 4, 0.5, 1, stM); camp.up = false; camp.fr = animFrames('flag/idle');
    }
    // Lifts: a platform on a chain that reaches above the view.
    for (const l of lifts) {
      l.top = l.y1 - 260;
      l.chain = new PIXI.TilingSprite({ texture: frame('lift/chain'), width: 8, height: 8 }); l.chain.x = l.x + 12; stB.addChild(l.chain);
      l.s = spr(frame('lift/off'), l.x, l.y, 0, 0, stM); l.fr = animFrames('lift/on'); l.on = false;
    }
    // Signs (shared plate + pixel-font number), waiting "?" bubbles and the coins that wait on them after grading.
    for (let j = 0; j < sK; j++) {
      const c = plate('Q' + (sA + j + 1), signX(j), L[j].y + 3, stM);
      const badge = new PIXI.Sprite(badgeTex(1)); badge.x = c.w - 5; badge.y = -6; badge.visible = false; c.addChild(badge);
      const b = spr(frame('bubble/q-in/2'), signX(j) + 1, L[j].y - 32, 0.5, 1, stM);
      signs.push({ c, badge, bubble: b, st: 0 });
      const k = spr(frame('coin/gold/0'), signX(j), L[j].y - 44, 0.5, 0.5, stM); k.visible = false; k.pop = 1; k.fr = animFrames('coin/gold');
      coins.push(k);
    }
  }
  let slabT = null;
  function slabTex() {
    if (slabT) return slabT;
    const [c, x] = canvas(T, T); tile(x, 4, 4, 0, 0);
    return (slabT = PIXI.Texture.from(c));
  }
  function setStage(k) { stage = k; sA = STG[k][0]; sK = STG[k][1] - STG[k][0]; layout(); buildStage(); }

  function resetState() {
    plan.length = 0; planOn = false; onArrive = null; coin.on = false; celebrateT = 0; H.sq = 0;
    H.x = HOME_X; H.y = H.gy = 0; heroAnim('idle');
    for (let j = 0; j < sK; j++) setSign(j, 0);
    for (const c of coins) c.visible = false;
    for (const l of lifts) { l.y = l.y0; liftAnim(l, false); }
    for (const a of anims) a.s.visible = false;
    for (const p of parts) p.s.visible = false;
    if (xpLabel) xpLabel.visible = false;
    fade(0);
    startSign.visible = true; if (startSign.texture) startSign.texture = frame('start/idle');
    trophy.texture = frame('end/idle');
    cam.fy0 = cam.fy1 = cam.fy = feetY('walk'); snapCam(); cam0y = cam.y;
  }
  function renderOnce() { if (!app) return; stT0 = performance.now(); update(0); app.render(); }
  let laterT = 0;
  function renderLater() { if (!laterT) laterT = setTimeout(() => { laterT = 0; if (!running) renderOnce(); }, 260); }

  /* ---------- public interface (used by app.js) ---------- */
  Object.assign(API, {
    init(e) {
      N = e.N; RM = e.RM; LOW = e.LOW; night = e.night; VW = e.W; VH = e.H;
      STG = e.stages && e.stages.length ? e.stages : [[0, N]]; stage = 0; sA = 0; sK = STG[0][1] - STG[0][0];
      heroKey = P.get('hero') || 'captain';
      PIXI.TextureSource.defaultOptions.scaleMode = 'nearest';
      app = new PIXI.Application();
      const base = e.assetBase;
      return fetch(base + 'kit.json').then(r => r.json()).then(k => {
        kit = k;
        if (!kit.heroes[heroKey]) heroKey = 'captain';
        heroDef = kit.heroes[heroKey];
        // Canvas 2D renderer at 1 canvas px per CSS px (D24): the pixel art is upscaled by the browser.
        return app.init({ width: VW, height: VH, resolution: 1, autoDensity: false, antialias: false, roundPixels: true,
          background: kit.colors.sky, preference: P.get('gl') === '1' ? 'webgl' : 'canvas', autoStart: false, sharedTicker: false });
      }).then(() => {
        e.canvasHost.appendChild(app.canvas);
        const L1 = kit.layers;
        const keys = ['bg', 'cloudsBig', 'cloudsSmall', 'mtnBack', 'mtnFront'], nightUrl = k => base + L1[k].replace('.png', '-night.png');
        return PIXI.Assets.load([base + kit.atlas.image, base + L1.stars].concat(keys.map(k => base + L1[k]), keys.map(nightUrl))).then(t => {
          atlasImg = t[base + kit.atlas.image]; tex.stars = t[base + L1.stars];
          keys.forEach(k => { tex[k] = t[base + L1[k]]; tex[k + 'N'] = t[nightUrl(k)]; });
        });
      }).then(() => {
        S = scaleFor(VW, VH);
        layout(); build(); resetState();
        app.ticker.add(tick, null, PIXI.UPDATE_PRIORITY.HIGH);
        app.ticker.add(tickEnd, null, PIXI.UPDATE_PRIORITY.UTILITY);
        applyNight();
        renderOnce();
        // Ambient life at the start screen (idle breathing, palms, clouds) runs until the first tap.
        if (!RM) wake();
      });
    },
    walkToFirst(cb) {
      plan.length = 0; Wk(H.x, 0, stand(0), 0, 600, 2);
      if (!RM && startSign.texture) { const a = oneShot('start/go', startSign.x, startSign.y, stM); startSign.visible = false; a.done = () => { startSign.visible = true; }; }
      begin(cb);
    },
    // i is the chapter's MCQ index. After the last MCQ of a stage the climber reaches the camp, the flag runs up, the
    // screen fades with the next stage's number, and she walks in from the next START island.
    travel(i, cb) {
      const j = J(i); plan.length = 0; planMove(j);
      if (j === sK - 1 && !lastStage()) { caption(stage + 1); Wt(stand(sK), L[sK].y, 260); Fd(RM ? 1 : 820); Wk(HOME_X, 0, stand(0), 0, 520, 2); }
      begin(cb);
    },
    toSummit(cb) {
      const j = sK - 1; plan.length = 0; planMove(j);
      const end = trophy.x - 22;
      Wk(stand(sK), L[sK].y, end, L[sK].y, 260, 1);
      begin(() => {
        if (!RM) {
          const a = oneShot('end/press', trophy.x, trophy.y, stM); trophy.visible = false; a.done = () => { trophy.visible = true; trophy.texture = frame('end/idle'); };
          celebrateT = 0.9; burst(trophy.x, trophy.y - 40, 24, 'confetti'); sfx('cheer');
        }
        cb(RM ? 0 : 900);
      });
    },
    coin(i, gold, cb) {
      const j = J(i);
      if (RM || !coins[j]) { if (coins[j]) { coins[j].visible = false; coins[j].got = true; } cb(i); return; }
      coinStart(j, gold, () => cb(i)); kick();
    },
    // animate=false (Strip, Classic): the world is behind the sheet, so it is redrawn later, off the tap's frame.
    sign(i, st, animate) {
      const j = J(i); if (j < 0 || j >= sK) return;
      setSign(j, st); if (animate && !RM) kick(); else { coins[j].pop = 1; renderLater(); }
    },
    pose(p) {
      if (p === 'happy' && !RM) { squash(0.22, 0.14); kick(); }
      else if (p === 'read') heroAnim('idle');
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
      H.x = i === 'summit' ? trophy.x - 22 : stand(k); H.y = H.gy = L[k].y; fade(0);
      for (const l of lifts) if (l.j < k) { l.y = l.y1; liftAnim(l, false); }
      heroAnim('idle'); snapCam(); renderLater();
    },
    skip() {
      let did = false;
      if (coin.on) { coinCollect(); did = true; }
      if (planOn) { finishPlan(); did = true; }
      if (celebrateT > 0) { celebrateT = 0; H.y = H.gy; did = true; }
      if (did) {
        if (xpLabel) xpLabel.visible = false;
        for (const p of parts) p.s.visible = false;
        for (const a of anims) { if (a.s.visible && a.done) a.done(); a.s.visible = false; }
        trophy.visible = lastStage(); startSign.visible = true; H.sq = 0;
        snapCam(); renderOnce();
      }
      return did;
    },
    sleep() { awake = false; cam.ft = 1; cam.fy = cam.fy1; snapCam(); renderOnce(); },
    wake,
    reset() { if (stage !== 0) setStage(0); resetState(); renderOnce(); if (!RM) wake(); },
    resize(w, h) {
      if (!app || !built) return;
      VW = w; VH = h; app.renderer.resize(w, h);
      S = scaleFor(w, h);
      const keep = { x: H.x, y: H.y, gy: H.gy }, sts = signs.map(s => s.st), got = coins.map(c => c.got), ly = lifts.map(l => l.y), up = camp && camp.up, f = fadeK;
      build(); applyNight();
      // signs keep their badges; coins already collected stay gone
      sts.forEach((st, j) => { setSign(j, st); coins[j].pop = 1; coins[j].scale.set(1); if (got[j]) { coins[j].visible = false; coins[j].got = true; } });
      lifts.forEach((l, j) => { l.y = ly[j]; liftAnim(l, false); });
      if (up) raiseCamp(true);
      H.x = keep.x; H.y = keep.y; H.gy = keep.gy;
      if (f > 0) { const w = plan[pi]; caption(w && w.k === 5 && w.swapped ? stage : stage + 1); }
      fade(f);
      snapCam(); renderOnce();
    },
    theme(n) { night = n; if (built) { applyNight(); renderOnce(); } },
    pause() { paused = true; if (app && app.ticker) app.ticker.stop(); running = false; },
    resume() { paused = false; if (built && (awake || busy())) { running = true; app.ticker.start(); } },
    running: () => running,
    scriptTimes(reset) { const n = Math.min(stN, ST.length), out = Array.from(ST.subarray(0, n)); if (reset) stN = 0; return out; },
    info: () => 'S ' + S + ' · ' + (app && app.renderer ? app.renderer.name || app.renderer.type : '-') + ' · ' + heroKey + ' · stage ' + (stage + 1) + '/' + STG.length,
    // for the screenshot tool and the harness
    heroState: () => planOn && plan[pi] && plan[pi].k === 2 ? 'lift' : celebrateT > 0 ? 'cheer' : H.anim,
    stageInfo: () => ({ stage, stages: STG.length, wipe: fadeK }),
    stripArt: () => kit && {
      coin(c, gold, x, y, size) { const f = kit.atlas.frames[(gold ? 'coin/gold' : 'coin/silver') + '/0']; c.imageSmoothingEnabled = false; c.drawImage(atlasImg.source.resource, f[0], f[1], f[2], f[3], x - size / 2, y - size / 2, size, size); },
      flag(c, x, y) { const f = kit.atlas.frames['end/idle']; c.imageSmoothingEnabled = false; c.drawImage(atlasImg.source.resource, f[0], f[1], f[2], f[3], x - 14, y - 26, 28, 28); },
      hero(c, x, y, pose, size) {
        const a = kit.atlas.anims[heroKey + '/' + (pose === 'jump' ? 'jump' : 'idle')], f = kit.atlas.frames[a.frames[0]], d = heroDef;
        const k = size / (d.foot.y - d.foot.top); c.imageSmoothingEnabled = false;
        c.drawImage(atlasImg.source.resource, f[0], f[1], f[2], f[3], Math.round(x - d.foot.x * k), Math.round(y - d.foot.y * k), Math.round(f[2] * k), Math.round(f[3] * k));
      },
    },
  });

  function applyNight() {
    if (!app || !overlay) return;
    const n = night ? 'N' : '';
    overlay.visible = night; layer.stars.visible = night && !LOW;
    layer.bg.texture = tex['bg' + n]; layer.cb.texture = tex['cloudsBig' + n]; layer.mf.texture = tex['mtnFront' + n];
    if (layer.mb) layer.mb.texture = tex['mtnBack' + n];
    if (layer.cs) layer.cs.texture = tex['cloudsSmall' + n];
    waterFill.tint = night ? kit.night.water : kit.colors.water;
    app.renderer.background.color = night ? kit.night.sky : kit.colors.sky;
  }
  // Art scale: 3 CSS px per art px on phones, 4 on tablets and desktops (always a whole number, so pixels stay square).
  function scaleFor(w, h) { return Math.max(2, Math.min(4, Math.round(Math.min(w, h * 0.62) / 120))); }
})();
