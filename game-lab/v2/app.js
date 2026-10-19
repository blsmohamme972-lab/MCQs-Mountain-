'use strict';
/* MCQs Mountain v2: everything except the game world. The flow, the DOM MCQ sheet and its grading, the three modes,
   the summary card, the Telegram behaviour and the harness contract are carried over from game-lab/climb/index.html
   (same rules, same numbers); the world is drawn by world.js on top of the chosen engine (DECISIONS.md D24).
   window.World is the only interface between the two files. */
(function () {
  const LET = 'ABCDEF', L2I = l => LET.indexOf(l);
  const TY = { sba: 'Single best answer', mtf: 'True-False', multi: 'Choose two', emq: 'Extended matching' };
  const D = document, R = D.documentElement, $ = i => D.getElementById(i), P = new URLSearchParams(location.search);
  const RM = P.get('rm') === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LOW = /LOW\)/.test(navigator.userAgent) || P.get('low') === '1', DBG = P.get('debug') === '1';
  // Two tiers (D25, D26): 'light' is the Canvas 2D pixel-art world (weak phones: ?low=1 or Telegram's LOW class),
  // 'hd' the WebGL world for everyone else. ?tier=light|hd forces one. Support is checked cheaply here (creating a
  // test context costs about 0.2 s on a slow phone); if the HD world then fails to start, the light tier loads instead.
  const hasGL = !!(window.WebGL2RenderingContext || window.WebGLRenderingContext);
  // A phone on which the HD world ran slow last time is remembered (world-hd.js) and starts on the light tier.
  let hint = null; try { hint = localStorage.getItem('mcqm-tier'); } catch (e) {}
  let TIER = P.get('tier') === 'light' || P.get('tier') === 'hd' ? P.get('tier') : LOW || !hasGL || hint === 'light' ? 'light' : 'hd';
  const TG = window.Telegram && window.Telegram.WebApp;
  const CFG = window.LAB_CONFIG || {};
  let TC = CFG[TIER] || CFG.light;
  // Chapter size (D27): any number of MCQs from 1 to 200. The lab repeats the 8 sample MCQs to build a chapter of n
  // (?n=, or the start card's lab picker, kept in localStorage 'mcqm-n'); the app will pass its real chapter.
  let nPick = 0; try { nPick = +localStorage.getItem('mcqm-n') || 0; } catch (e) {}
  const Q0 = window.LAB_QUESTIONS, N = Math.max(1, Math.min(200, Math.round(+P.get('n') || nPick || Q0.length)));
  const Q = Array.from({ length: N }, (_, i) => Q0[i % Q0.length]);
  // The path is cut into stages of about 10 MCQs (one mountain each); a remainder under 4 joins the previous stage.
  const STAGES = (() => { const out = []; for (let a = 0; a < N; a += 10) out.push([a, Math.min(N, a + 10)]); if (out.length > 1 && out[out.length - 1][1] - out[out.length - 1][0] < 4) { const l = out.pop(); out[out.length - 1][1] = l[1]; } return out; })();
  const stageOf = i => { for (let s = 0; s < STAGES.length; s++) if (i < STAGES[s][1]) return s; return STAGES.length - 1; };
  let mode = /^(story|strip|classic)$/.test(P.get('mode')) ? P.get('mode') : 'story';
  // Harness contract (README.md): state, mode, answer(); 'loading' comes first, until the world's first frame.
  const lab = window.__lab = { state: 'loading', mode, tier: TIER, version: 2, n: N, stages: STAGES, answer: () => autoAnswer() };
  if (RM) R.classList.add('rm');
  R.classList.add('t-' + TIER);
  const now = () => performance.now(), mark = n => { try { performance.mark(n); } catch (e) {} };
  const sheet = $('sheet'), chk = $('check'), nxt = $('next'), startp = $('startp'), doneC = $('done'), live = $('live'), skipH = $('skip'), goB = $('go');
  const sc = $('strip'), sx = sc.getContext('2d');
  // world.js fills this object in (Object.assign); until then every call is a harmless no-op.
  const noop = () => {};
  const World = window.World = { init: () => Promise.resolve(), frame: noop, pose: noop, sleep: noop, wake: noop, sign: noop, coin: noop, place: noop,
    toSummit: noop, travel: noop, walkToFirst: noop, skip: () => false, reset: noop, resize: noop, theme: noop, pause: noop, resume: noop,
    stripArt: null, running: () => false, info: () => '' };
  let W = innerWidth, H = innerHeight, S = 1;

  /* ---------- state ---------- */
  let idx = 0, xp = 0, skips = 0, RS = [], tGo = 0, tNext = 0, tShown = 0, gameT = 0, readT = 0, firstOpen = false, worldReady = false;
  const st = new Uint8Array(N);
  const fresh = q => ({ sel: q.type === 'mtf' ? q.options.map(() => null) : q.type === 'multi' ? [] : null, done: false, correct: false, score: 0 });

  /* ---------- UI transitions: timed on animation frames, independent of the world's loop ---------- */
  // A transition starts on the first frame after it is requested and fires on the first frame at or after its end,
  // so 'lab:sheet-visible' is marked on the first frame the sheet is fully open (same rule as the draft).
  const TX = [];
  let uiRaf = 0;
  function after(d, cb) { const o = { t0: -1, d, cb, on: true }; TX.push(o); if (!uiRaf) uiRaf = requestAnimationFrame(uiTick); return o; }
  function cancel(o) { if (o) o.on = false; }
  function uiTick(ts) {
    uiRaf = 0;
    for (let i = 0; i < TX.length; i++) {
      const o = TX[i];
      if (!o.on) { TX.splice(i--, 1); continue; }
      if (o.t0 < 0) { o.t0 = ts; continue; }
      if (ts > o.t0 && ts - o.t0 >= o.d) { TX.splice(i--, 1); o.on = false; o.cb(ts); }
    }
    if (TX.length) uiRaf = requestAnimationFrame(uiTick);
    if (stripAnim.on) drawStrip(ts);
  }
  let opT = null, clT = null, xfT = null;

  /* ---------- MCQ sheet: two pages, the next one is pre-built ---------- */
  const PG = [{ el: $('pA'), q: -1, o: [] }, { el: $('pB'), q: -1, o: [] }];
  let act = PG[0], ina = PG[1];
  const ICO = {
    ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    no: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>',
    fl: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4h11l-2.5 4L17 12H6"/></svg>',
  };
  function h(t, c, x) { const e = D.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function bt(c, x) { const b = h('button', c, x); b.type = 'button'; b.setAttribute('aria-pressed', 'false'); return b; }
  function row(t, p) { const b = h('button', 'row', t), d = h('p', 'ph', p); b.type = 'button'; b.dataset.r = '1'; b.setAttribute('aria-expanded', 'false'); d.hidden = true; return [b, d]; }
  function build(pg, i) {
    const q = Q[i], w = h('div', 'in wrap'), hd = h('div', 'qhead'), os = h('div', 'opts');
    pg.el.textContent = ''; pg.el.scrollTop = 0; pg.q = i; pg.o = []; pg.mk = [];
    pg.h = h('h2', 'qn', 'Q ' + (i + 1) + '/' + N); pg.h.tabIndex = -1; pg.xp = h('span', 'qxp');
    hd.append(pg.h, h('span', 'chip', TY[q.type]));
    if (STAGES.length > 1) hd.append(h('span', 'qstage', 'Stage ' + (stageOf(i) + 1) + ' of ' + STAGES.length));
    hd.append(pg.xp); w.append(hd);
    if (q.lead_in) w.append(h('p', 'lead', q.lead_in));
    w.append(h('p', 'stem', q.stem));
    pg.hint = null;
    if (q.type === 'multi') w.append(pg.hint = h('p', 'hint', 'Choose ' + q.answer.length + ' answers.'));
    q.options.forEach((t, j) => {
      if (q.type === 'mtf') {
        const r = h('div', 'mrow'), g = h('div', 'tf'), m = h('span', 'mk');
        g.setAttribute('role', 'group'); g.setAttribute('aria-label', t);
        ['T', 'F'].forEach(v => { const b = bt('tfb', v === 'T' ? 'True' : 'False'); b.dataset.i = j; b.dataset.v = v; g.append(b); pg.o.push(b); });
        r.append(h('p', 'mt', t), g, m); pg.mk.push(m); os.append(r);
      } else {
        const b = bt('opt'), m = h('span', 'mk');
        b.dataset.i = j; b.append(h('span', 'l', LET[j]), h('span', 't', t), m); pg.mk.push(m); pg.o.push(b); os.append(b);
      }
    });
    w.append(os);
    const af = h('div', 'after'); af.hidden = true; pg.af = af; pg.fb = h('div', 'fb');
    const ex = h('div', 'exp'); ex.append(h('h3', null, 'Explanation'), h('p', null, q.explanation));
    af.append(pg.fb, ex, ...row('Comments · 12', "Placeholder for the app's real comments sheet. Not connected in this prototype."), ...row('Watch the lesson', 'Placeholder for the MotionCards lesson player. Not connected in this prototype.'));
    w.append(af); pg.el.append(w);
  }
  function prebuild(n) { if (n < N && ina.q !== n && act.q !== n) build(ina, n); }
  function activate(i) {
    if (act.q !== i) { if (ina.q !== i) build(ina, i); const o = act; act = ina; ina = o; }
    ina.o.forEach(b => b.removeAttribute('data-lab')); act.o.forEach(b => b.setAttribute('data-lab', 'opt'));
    if (act.el.scrollTop) act.el.scrollTop = 0;   // read before any write: no forced layout in the transition
    act.xp.textContent = xp + ' XP'; ina.el.classList.remove('on'); act.el.classList.add('on');
    chk.hidden = false; chk.disabled = true; nxt.hidden = true; $('bar').firstChild.style.transform = 'scaleX(' + (i / N) + ')';
  }
  function openSheet() {
    activate(idx); sheet.classList.add('open'); skipOn(false);
    World.frame('sheet');
    opT = after(RM || mode === 'classic' ? 0 : 200, sheetVisible);
  }
  function sheetVisible() {
    opT = null; mark('lab:sheet-visible');
    const t = now(); gameT += t - (firstOpen ? tGo : tNext); firstOpen = false; tShown = t;
    lab.state = 'question'; skipOn(false); World.pose('read'); World.sleep();
    try { act.h.focus({ preventScroll: true }); } catch (e) {}
  }
  const complete = (q, r) => q.type === 'mtf' ? r.sel.every(v => v === 'T' || v === 'F') : q.type === 'multi' ? r.sel.length === q.answer.length : r.sel !== null;
  // Grading copies the app's grade() in app/index.html: sba/emq one letter, mtf all statements, multi the exact set.
  function grade(q, r) {
    if (q.type === 'mtf') { let k = 0; q.answer.forEach((v, i) => { if (r.sel[i] === v) k++; }); r.score = k / q.answer.length; r.correct = k === q.answer.length; }
    else if (q.type === 'multi') { const key = q.answer.map(L2I).sort().join(','); r.correct = r.sel.slice().sort().join(',') === key; r.score = r.correct ? 1 : 0; }
    else { r.correct = r.sel === L2I(q.answer); r.score = r.correct ? 1 : 0; }
  }
  function paint() {
    const q = Q[idx], r = RS[idx];
    act.o.forEach(b => { const j = +b.dataset.i, on = q.type === 'mtf' ? r.sel[j] === b.dataset.v : q.type === 'multi' ? r.sel.indexOf(j) >= 0 : r.sel === j; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on); });
    chk.disabled = !complete(q, r);
  }
  function pick(b) {
    const q = Q[idx], r = RS[idx], j = +b.dataset.i;
    if (r.done || lab.state !== 'question') return;
    if (q.type === 'mtf') r.sel[j] = b.dataset.v;
    else if (q.type === 'multi') {
      const k = r.sel.indexOf(j);
      if (k >= 0) r.sel.splice(k, 1);
      else if (r.sel.length < q.answer.length) r.sel.push(j);
      else { act.hint.textContent = 'Choose ' + q.answer.length + ' answers. Tap one to unselect it.'; act.hint.classList.add('warn'); }
    } else r.sel = j;
    Sound.play('tap'); paint();
  }
  function setMk(m, ok, t) { m.innerHTML = ok ? ICO.ok : ICO.no; m.append(t); m.className = 'mk ' + (ok ? 'okc' : 'noc'); }
  let nextGuard = 0;
  function doCheck() {
    const q = Q[idx], r = RS[idx];
    if (r.done || lab.state !== 'question' || !complete(q, r)) return;
    grade(q, r); r.done = true;
    const pg = act; let t1, t2;
    pg.o.forEach(b => { b.disabled = true; });
    if (q.type === 'mtf') {
      let k = 0;
      q.answer.forEach((v, j) => { const ok = r.sel[j] === v; if (ok) k++; pg.o[j * 2 + (v === 'T' ? 0 : 1)].classList.add('ok'); if (!ok) pg.o[j * 2 + (r.sel[j] === 'T' ? 0 : 1)].classList.add('no'); setMk(pg.mk[j], ok, ok ? 'Right' : 'Answer: ' + (v === 'T' ? 'True' : 'False')); });
      t1 = r.correct ? 'Correct' : 'Not quite: ' + k + ' of ' + q.answer.length + ' right'; t2 = r.correct ? 'All ' + k + ' statements right' : 'Score ' + Math.round(r.score * 100) + '%';
    } else {
      const key = q.type === 'multi' ? q.answer.map(L2I) : [L2I(q.answer)];
      pg.o.forEach((b, j) => { const isK = key.indexOf(j) >= 0, pk = q.type === 'multi' ? r.sel.indexOf(j) >= 0 : r.sel === j; if (isK) { b.classList.add('ok'); setMk(pg.mk[j], 1, 'Correct answer'); } else if (pk) { b.classList.add('no'); setMk(pg.mk[j], 0, 'Your answer'); } });
      t1 = r.correct ? 'Correct' : 'Not quite: the answer' + (key.length > 1 ? 's are ' : ' is ') + key.map(j => LET[j]).join(' and '); t2 = r.correct ? 'Kafu!' : '';
    }
    t2 = (t2 ? t2 + ' · ' : '') + (r.correct ? '+10 XP' : 'Saved for review · +5 XP');
    pg.fb.className = 'fb ' + (r.correct ? 'good' : 'soft');
    pg.fb.innerHTML = (r.correct ? ICO.ok : ICO.fl) + '<div><b></b><span></span></div>';
    pg.fb.querySelector('b').textContent = t1; pg.fb.querySelector('span').textContent = t2;
    pg.af.hidden = false; chk.hidden = true; nxt.hidden = false; nxt.textContent = idx === N - 1 ? 'Finish chapter' : 'Next MCQ';
    // the Check button is gone, so keyboard focus moves to the feedback (not lost to the page)
    pg.fb.tabIndex = -1; try { pg.fb.focus({ preventScroll: true }); } catch (e) {}
    live.textContent = t1 + '. ' + t2;
    st[idx] = r.correct ? 1 : 2;
    // The reward appears only now, after scoring (D2): the sign shows a tick or a review flag and the coin waits on it.
    World.sign(idx, st[idx], mode === 'story'); if (mode === 'story') World.pose(r.correct ? 'happy' : 'calm');
    Sound.play(r.correct ? 'correct' : 'soft');
    if (mode === 'strip') drawStrip();
    try { pg.fb.scrollIntoView({ block: 'nearest', behavior: RM ? 'auto' : 'smooth' }); } catch (e) {}
    // the next MCQ's page is built while this one is read (in Story too, so the climb has no DOM work)
    const n1 = idx + 1; if (window.requestIdleCallback) requestIdleCallback(() => prebuild(n1), { timeout: 700 }); else setTimeout(() => prebuild(n1), 60);
  }
  function autoAnswer() {
    if (lab.state !== 'question') return false;
    const q = Q[idx], r = RS[idx];
    if (r.done) return false;
    r.sel = q.type === 'mtf' ? q.answer.slice() : q.type === 'multi' ? q.answer.map(L2I) : L2I(q.answer);
    paint(); doCheck(); return true;
  }

  /* ---------- flow ---------- */
  function go() {
    if (lab.state !== 'start') return;
    tGo = now(); firstOpen = true; lab.state = 'moving'; startp.classList.add('off'); Sound.unlock();
    saved = null; $('resume').hidden = true; from = 0;
    if (mode === 'classic') { hud(); openSheet(); return; }
    if (!RM) World.wake(); skipOn(true);   // reduced motion: no loop at all, the world is drawn once per MCQ
    World.walkToFirst(arrived);
  }
  function arrived() { hud(); stageNews(); openSheet(); }
  /* ---------- a long chapter can be left and continued later (lab: localStorage 'mcqm-progress'; the app would use
     its own resume). The place is kept after every MCQ and offered on the start card of the same chapter. ---------- */
  const PK = 'mcqm-progress';
  let saved = null, from = 0;
  try { saved = JSON.parse(localStorage.getItem(PK) || 'null'); } catch (e) {}
  if (!saved || saved.n !== N || !(saved.next > 0 && saved.next < N) || typeof saved.st !== 'string' || saved.st.length !== N) saved = null;
  function keep(next) { try { if (next >= N) localStorage.removeItem(PK); else localStorage.setItem(PK, JSON.stringify({ n: N, next, xp, st: Array.from(st).join('') })); } catch (e) {} }
  function continueChapter() {
    if (lab.state !== 'start' || !saved) return;
    const s = saved; saved = null; $('resume').hidden = true;
    for (let k = 0; k < s.next; k++) { const v = +s.st[k] || 2, r = RS[k]; st[k] = v; r.done = true; r.correct = v === 1; r.score = r.correct ? 1 : 0; }
    xp = s.xp | 0; hudXP(); idx = from = s.next;
    World.place(idx);
    for (let k = STAGES[stageOf(idx)][0]; k < idx; k++) World.sign(k, st[k], false);
    tGo = now(); firstOpen = true; lab.state = 'moving'; startp.classList.add('off'); Sound.unlock();
    hud(); drawStrip(); openSheet();
  }
  // A new stage is announced to screen readers (it is shown in the question header too).
  function stageNews() {
    if (STAGES.length < 2 || !idx || stageOf(idx) === stageOf(idx - 1)) return;
    const s = stageOf(idx);
    live.textContent = 'Stage ' + (s + 1) + ' of ' + STAGES.length + '. ' + (s === STAGES.length - 1 ? 'Last mountain.' : 'Next mountain.');
  }
  function next(e) {
    if (lab.state !== 'question' || !RS[idx].done || (e && e.timeStamp ? e.timeStamp : now()) < nextGuard) return;
    mark('lab:next-tap'); tNext = now(); readT += tNext - tShown; lab.state = 'moving';
    if (mode === 'story') {
      if (!RM) World.wake(); sheet.classList.remove('open'); World.frame('walk');
      clT = after(RM ? 0 : 140, worldVisible);
      World.coin(idx, RS[idx].correct, collected);
      skipOn(true); return;
    }
    collected(idx);
    if (idx === N - 1) { sheet.classList.remove('open'); World.place('summit'); finish(); return; }
    const a = idx; idx++; hud(); stageNews();
    if (mode === 'strip' && !RM) { stripAnim.on = true; stripAnim.t0 = -1; stripAnim.a = a; stripAnim.b = idx; }
    if (mode === 'strip') drawStrip();
    World.place(idx);
    activate(idx);
    xfT = after(mode === 'strip' && !RM ? 100 : 0, () => { xfT = null; mark('lab:world-visible'); sheetVisible(); });
  }
  function worldVisible() {
    clT = null; mark('lab:world-visible');
    if (idx === N - 1) World.toSummit(summit);
    else World.travel(idx, () => { idx++; arrived(); });
    setTimeout(() => prebuild(idx + 1), 0);
  }
  function summit(celebrateMs) { hud(true); celebT = after(RM ? 0 : celebrateMs, () => { celebT = null; finish(); }); }
  let celebT = null;
  function collected(i) {
    xp += RS[i].correct ? 10 : 5; hudXP(); keep(i + 1);
    try { if (TG && TG.HapticFeedback) TG.HapticFeedback.impactOccurred('light'); } catch (e) {}
    Sound.play(RS[i].correct ? 'coin' : 'coin2');
  }
  function skip() {
    if (lab.state !== 'moving') return;
    if (celebT) { cancel(celebT); celebT = null; skips++; World.skip(); finish(); return; }
    if (opT || xfT) return;
    if (clT) { cancel(clT); clT = null; skips++; World.skip(); worldVisibleNow(); return; }
    if (World.skip()) skips++;
  }
  // Skip during the sheet's slide-down: the climb is planned and finished in the same frame.
  function worldVisibleNow() {
    mark('lab:world-visible');
    if (idx === N - 1) { World.toSummit(summit); World.skip(); if (celebT) { cancel(celebT); celebT = null; finish(); } }
    else { World.travel(idx, () => { idx++; arrived(); }); World.skip(); }
    setTimeout(() => prebuild(idx + 1), 0);
  }
  function finish() {
    keep(N);
    const t = now(); gameT += t - tNext; lab.state = 'done'; skipOn(false); hud(true);
    if (mode === 'strip') drawStrip();
    const c = RS.filter(r => r.correct).length, sec = Math.round(readT / 1000), per = gameT / Math.max(1, N - from) / 1000;
    // numbers only, so markup is safe; each part stays on one line
    $('dS').innerHTML = [N + (N === 1 ? ' MCQ' : ' MCQs'), c + ' correct', '+' + xp + ' XP'].map(t => '<span class="nw">' + t + '</span>').join(' · ');
    const L2 = $('dL'); L2.textContent = '';
    const dur = s => s < 0.1 ? 'under 0.1 s' : s < 60 ? s.toFixed(1) + ' s' : Math.floor(Math.round(s) / 60) + ' min ' + (Math.round(s) % 60) + ' s';
    ['Time reading and answering: ' + Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'),
      'Time added by the game: ' + dur(gameT / 1000) + ' (' + (per < 0.1 ? 'under 0.1' : per.toFixed(1)) + ' s per MCQ)']
      .concat(N === 100 ? [] : ['At this pace 100 MCQs would add about ' + dur(per * 100)], ['Animations skipped: ' + skips])
      .forEach(s => L2.append(h('li', null, s)));
    $('t2').textContent = mode === 'classic' ? 'Chapter done' : 'Summit reached';
    sheet.classList.remove('open'); doneC.classList.remove('off'); World.sleep(); cardFrame();
    try { $('t2').focus({ preventScroll: true }); } catch (e) {}
  }
  function reset() {
    [opT, clT, xfT, celebT].forEach(cancel); opT = clT = xfT = celebT = null;
    idx = 0; xp = 0; skips = 0; gameT = readT = 0; RS = Q.map(fresh); st.fill(0);
    World.reset();
    sheet.classList.remove('open'); doneC.classList.add('off'); startp.classList.remove('off');
    PG.forEach(p => { p.el.classList.remove('on'); p.q = -1; });
    lab.state = 'start'; hud(); hudXP(); drawStrip(); cardFrame(); setTimeout(() => prebuild(0), 0);
    try { goB.focus({ preventScroll: true }); } catch (e) {}
  }
  function skipOn(v) { const on = !!v && !RM && mode !== 'classic'; skipH.classList.toggle('on', on); skipH.tabIndex = on ? 0 : -1; skipH.setAttribute('aria-hidden', String(!on)); }
  function hud(top) {
    const n = lab.state === 'start' || lab.state === 'loading' ? 0 : idx + 1, el = $('ledge');
    if (top) el.textContent = 'Summit'; else el.innerHTML = '<span class="lw">Ledge </span>' + n + '/' + N;
    el.setAttribute('aria-label', top ? 'Summit' : 'Ledge ' + n + ' of ' + N);
  }
  // The XP counter ticks up to its new value (about 0.4 s); reduced motion shows the number at once.
  let xpShown = 0, xpRaf = 0;
  function hudXP() {
    const el = $('xpN'), p = $('xpP'), from = xpShown, to = xp, t0 = now();
    if (RM || to <= from) { xpShown = to; el.textContent = to; return; }
    if (p.animate) p.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
    cancelAnimationFrame(xpRaf);
    const step = () => { const k = Math.min(1, (now() - t0) / 420), v = Math.round(from + (to - from) * (1 - (1 - k) * (1 - k))); if (v !== xpShown) { xpShown = v; el.textContent = v; } if (k < 1) xpRaf = requestAnimationFrame(step); };
    xpRaf = requestAnimationFrame(step);
    setTimeout(() => { if (xpShown !== xp) { xpShown = xp; el.textContent = xp; } }, 480);   // if frames are starved
  }
  const DESC = { story: 'The climber walks to each question and climbs between them. Tap the world to skip any animation.', strip: 'The question sheet stays open. A mini climber moves along a strip at the top.', classic: 'Plain questions with a progress bar. No game, for comparison.' };
  function setMode(m) {
    mode = m; lab.mode = m; R.classList.remove('m-story', 'm-strip', 'm-classic'); R.classList.add('m-' + m);
    D.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === m));
    $('mdesc').textContent = DESC[m]; sizeStrip();
  }

  /* ---------- strip mode: a mini mountain with the hero, Canvas 2D, drawn only when it changes ---------- */
  const stripAnim = { on: false, t0: -1, a: 0, b: 0 };
  let sw = 320;
  // The strip shows the current stage's ledges (a few to about 13) and, for long chapters, "Stage s/S".
  let sk = 8;
  const smx = j => 22 + j * (sw - 52) / (sk + 0.6), smy = j => 46 - j * 26.4 / Math.max(1, sk);
  // The strip's two colours come from the theme; read once and again only when the theme changes (not per draw).
  const stripCol = { rock: '#6b5b4e', grass: '#5bc46b', ink: '#182032' };
  function readStripCol() { const cs = getComputedStyle(R); stripCol.rock = cs.getPropertyValue('--strip-rock').trim() || '#6b5b4e'; stripCol.ink = cs.getPropertyValue('--ink').trim() || stripCol.ink; stripCol.grass = cs.getPropertyValue('--strip-grass').trim() || '#5bc46b'; }
  function sizeStrip() { sw = Math.max(200, sc.clientWidth || 320); sc.width = Math.round(sw * S); sc.height = Math.round(56 * S); drawStrip(); }
  // a tick (correct) or a pennant (saved for review) on a Strip coin, in ink: the result is not shown by colour alone
  function stripMark(c, s, x, y) {
    c.strokeStyle = c.fillStyle = stripCol.ink; c.lineWidth = 1.6; c.lineCap = c.lineJoin = 'round'; c.beginPath();
    if (s === 1) { c.moveTo(x - 2.6, y + 0.2); c.lineTo(x - 0.6, y + 2.2); c.lineTo(x + 2.8, y - 1.8); c.stroke(); }
    else { c.moveTo(x - 1.8, y + 3); c.lineTo(x - 1.8, y - 3); c.stroke(); c.beginPath(); c.moveTo(x - 1.8, y - 3); c.lineTo(x + 2.8, y - 1.6); c.lineTo(x - 1.8, y - 0.2); c.fill(); }
  }
  function drawStrip(ts) {
    if (mode !== 'strip') return;
    const art = World.stripArt && World.stripArt(), done = lab.state === 'done';
    const sg = stageOf(done ? N - 1 : idx), s0 = STAGES[sg][0], s1 = STAGES[sg][1];
    sk = s1 - s0;
    const c = sx, bw = (sw - 52) / (sk + 0.6), last = sg === STAGES.length - 1;
    c.setTransform(S, 0, 0, S, 0, 0); c.clearRect(0, 0, sw, 56);
    c.fillStyle = stripCol.rock;
    c.beginPath(); c.moveTo(-4, 62); c.lineTo(-4, smy(0));
    for (let j = 0; j <= sk; j++) { c.lineTo(smx(j) - bw / 2, smy(j)); c.lineTo(j < sk ? smx(j) + bw / 2 : sw + 4, smy(j)); }
    c.lineTo(sw + 4, 62); c.closePath(); c.fill();
    c.fillStyle = stripCol.grass;
    for (let j = 0; j <= sk; j++) c.fillRect(smx(j) - bw / 2, smy(j) - 1, j < sk ? bw : sw, 3);
    for (let j = 0; j < sk; j++) {
      const i = s0 + j;
      if (art && st[i]) { const cx = smx(j) + bw * 0.2, cy = smy(j) - 9; art.coin(c, st[i] === 1, cx, cy, 9); stripMark(c, st[i], cx, cy); }
      else { c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(smx(j) + bw * 0.2 - 3, smy(j) - 10, 6, 6); }
    }
    if (art) art.flag(c, smx(sk) + 6, smy(sk), last);
    if (STAGES.length > 1) {
      c.font = '800 11px Nunito, ui-rounded, system-ui, sans-serif'; c.lineWidth = 3; c.strokeStyle = 'rgba(24,32,50,.7)'; c.fillStyle = '#fff';
      // bottom right, inside the rock: the climber and the coins stand on the ledges above it, so they never cover it
      const t = (last ? 'Summit stage ' : 'Stage ') + (sg + 1) + '/' + STAGES.length; c.textAlign = 'right'; c.strokeText(t, sw - 8, 51); c.fillText(t, sw - 8, 51); c.textAlign = 'left';
    }
    let a = idx - s0, b = idx - s0, p = 1;
    if (done) a = b = sk;
    if (stripAnim.on) {
      if (stripAnim.t0 < 0) stripAnim.t0 = ts || now();
      p = Math.min(1, ((ts || now()) - stripAnim.t0) / 320); a = stripAnim.a - s0; b = stripAnim.b - s0;
      if (a < 0) a = -0.7;    // a new stage: the climber comes in from the left
      if (p >= 1) stripAnim.on = false; else if (!uiRaf) uiRaf = requestAnimationFrame(uiTick);
    }
    const x = smx(a) + (smx(b) - smx(a)) * p, y = smy(Math.max(0, a)) + (smy(b) - smy(Math.max(0, a))) * p - Math.sin(Math.PI * p) * 8;
    if (art) art.hero(c, x, y, p < 1 ? 'jump' : lab.state === 'done' ? 'happy' : 'idle', 30);
  }

  /* ---------- debug overlay (?debug=1) ---------- */
  const dbg = $('dbg');
  if (DBG) {
    dbg.hidden = false;
    const FT = new Float32Array(120), FS = new Float32Array(120); let fi = 0, fn = 0, fc = 0, last = 0;
    const tick = t => {
      if (last) { const dt = t - last; FT[fi] = dt; fi = (fi + 1) % 120; if (fn < 120) fn++; }
      last = t;
      if (++fc % 15 === 0) {
        let s = 0, o = 0; FS.set(FT); const a = FS.subarray(0, fn).sort();
        for (let i = 0; i < fn; i++) { s += a[i]; if (a[i] > 33.4) o++; }
        dbg.textContent = 'fps ' + (fn ? (1000 * fn / s).toFixed(0) : '-') + '\np95 ' + (fn ? a[Math.min(fn - 1, Math.floor(fn * 0.95))].toFixed(1) : '-') + ' ms\n>33ms ' + o +
          '\nloop ' + (World.running && World.running() ? 'running' : 'stopped') + '\n' + (World.info ? World.info() : '') + (LOW ? '\nlow quality' : '');
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- sound: off by default; the files load only after the player turns it on ---------- */
  const Sound = window.Sound = (function () {
    let on = false, ac = null, gain = null, music = null, musicSrc = null;
    const buf = {}, files = CFG.sounds || {};
    function ctx() { if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ac = new A(); gain = ac.createGain(); gain.gain.value = 0.55; gain.connect(ac.destination); } return ac; }
    function load(k) {
      if (buf[k] !== undefined || !files[k]) return Promise.resolve(buf[k]);
      buf[k] = null;
      return fetch((CFG.soundBase || TC.assetBase) + files[k]).then(r => r.arrayBuffer()).then(a => new Promise((res, rej) => ctx().decodeAudioData(a, res, rej))).then(b => (buf[k] = b)).catch(() => null);
    }
    function play(k, vol) {
      if (!on || !ac || !buf[k]) return;
      try { const s = ac.createBufferSource(), g = ac.createGain(); g.gain.value = vol == null ? 0.8 : vol; s.buffer = buf[k]; s.connect(g); g.connect(gain); s.start(); } catch (e) {}
    }
    function startMusic() {
      if (!on || !buf.music || musicSrc) return;
      musicSrc = ac.createBufferSource(); music = ac.createGain(); music.gain.value = 0.32;
      musicSrc.buffer = buf.music; musicSrc.loop = true; musicSrc.connect(music); music.connect(gain); musicSrc.start();
    }
    function stopMusic() { try { if (musicSrc) musicSrc.stop(); } catch (e) {} musicSrc = null; }
    return {
      play, unlock() { if (on && ac && ac.state === 'suspended') ac.resume(); },
      toggle() {
        on = !on;
        if (on) { if (!ctx()) { on = false; return false; } ac.resume(); Object.keys(files).forEach(k => load(k).then(() => { if (k === 'music') startMusic(); if (k === 'tap') play('tap'); })); }
        else stopMusic();
        return on;
      },
      pause() { if (ac && on) ac.suspend(); }, resume() { if (ac && on) ac.resume(); },
    };
  })();

  /* ---------- events and start-up ---------- */
  $('pages').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.r) { const p = b.nextElementSibling, o = p.hidden; p.hidden = !o; b.setAttribute('aria-expanded', o); return; }
    if (b.dataset.i != null) pick(b);
  });
  // A fast double tap on Check must not also press Next (it appears in the same place) and skip the explanation.
  chk.addEventListener('click', e => { const was = RS[idx] && RS[idx].done; doCheck(); if (!was && RS[idx] && RS[idx].done) nextGuard = (e.timeStamp || now()) + 350; }); nxt.addEventListener('click', next); goB.addEventListener('click', go); $('resume').addEventListener('click', continueChapter); $('again').addEventListener('click', reset);
  D.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => { if (lab.state === 'start' || lab.state === 'loading') setMode(b.dataset.m); }));
  $('snd').addEventListener('click', e => { const on = Sound.toggle(); e.currentTarget.setAttribute('aria-pressed', on); });
  $('world').addEventListener('pointerdown', skip); skipH.addEventListener('click', skip);
  D.addEventListener('keydown', e => { if (lab.state === 'moving' && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); skip(); } });
  const pause = () => { World.pause(); Sound.pause(); }, resume = () => { World.resume(); Sound.resume(); };
  D.addEventListener('visibilitychange', () => { D.hidden ? pause() : resume(); });
  function resize() { W = innerWidth; H = innerHeight; S = Math.min(2, window.devicePixelRatio || 1); World.resize(W, H); sizeStrip(); cardFrame(); }
  // On the start and summary cards the climber stands above the card (offsetTop: its place without the slide-in)
  function cardFrame() {
    const c = lab.state === 'done' ? doneC : lab.state === 'start' ? startp : null;
    if (c && !c.classList.contains('off') && World.frame) World.frame('card', c.offsetTop);
  }
  let rq = 0;
  addEventListener('resize', () => { if (!rq) { rq = 1; requestAnimationFrame(() => { rq = 0; resize(); }); } });
  const theme = () => World.theme(getComputedStyle(R).getPropertyValue('--world-night').trim() === '1');
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readStripCol(); theme(); drawStrip(); }); } catch (e) {}
  try { new MutationObserver(() => { readStripCol(); theme(); drawStrip(); }).observe(R, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) {}
  if (TG) {
    try { if (TG.colorScheme) R.setAttribute('data-theme', TG.colorScheme); TG.ready(); TG.expand(); } catch (e) {}
    try { if (TG.isVersionAtLeast && TG.isVersionAtLeast('7.7')) TG.disableVerticalSwipes(); } catch (e) {}
    try { TG.onEvent('activated', resume); TG.onEvent('deactivated', pause); TG.onEvent('themeChanged', () => { if (TG.colorScheme) R.setAttribute('data-theme', TG.colorScheme); }); } catch (e) {}
    try { const bg = getComputedStyle(R).getPropertyValue('--bg').trim(); TG.setHeaderColor(bg); TG.setBackgroundColor(bg); } catch (e) {}
  }
  readStripCol(); RS = Q.map(fresh); setMode(mode); hud(); prebuild(0);
  $('sub1').textContent = 'Sample chapter · ' + N + ' MCQ' + (N === 1 ? '' : 's');
  // Lab-only switches on the start card (for the phone link): the tier and the chapter size, kept in localStorage.
  D.querySelectorAll('#labo [data-tier]').forEach(b => { b.setAttribute('aria-pressed', b.dataset.tier === TIER); b.addEventListener('click', () => { try { localStorage.setItem('mcqm-tier', b.dataset.tier); } catch (e) {} relaunch('tier'); }); });
  D.querySelectorAll('#labo [data-n]').forEach(b => { b.setAttribute('aria-pressed', +b.dataset.n === N); b.addEventListener('click', () => { try { localStorage.setItem('mcqm-n', b.dataset.n); } catch (e) {} relaunch('n'); }); });
  function relaunch(p) { const u = new URL(location.href); u.searchParams.delete(p); location.replace(u.href); }
  S = Math.min(2, window.devicePixelRatio || 1); sizeStrip();

  // Load the tier's scripts in order (engine, runtimes, world), then the world; it marks lab:game-ready on its first
  // drawn frame. A script entry is a URL or { src, integrity, fallback }: with an integrity hash the file is checked
  // (Subresource Integrity, CORS) and, if the first host fails, loaded from the fallback URL with the same hash.
  mark('lab:game-load');
  const tag = (src, sri) => new Promise((res, rej) => { const s = D.createElement('script'); s.src = src; if (sri) { s.integrity = sri; s.crossOrigin = 'anonymous'; } s.onload = res; s.onerror = () => { s.remove(); rej(new Error('failed to load ' + src)); }; D.head.appendChild(s); });
  const loaded = new Set();
  const load = e => { const k = typeof e === 'string' ? e : e.src; if (loaded.has(k)) return Promise.resolve(); loaded.add(k); return typeof e === 'string' ? tag(e) : tag(e.src, e.integrity).catch(err => e.fallback ? tag(e.fallback, e.integrity) : Promise.reject(err)); };
  const loadAll = list => list.reduce((p, e) => p.then(() => load(e)), Promise.resolve());
  const start = () => loadAll(TC.scripts).then(() => World.init({ canvasHost: $('world'), assetBase: TC.assetBase, W, H, RM, LOW: TIER === 'light' && LOW, night: getComputedStyle(R).getPropertyValue('--world-night').trim() === '1', N, stages: STAGES }));
  const initSize = [W, H];
  start().catch(e => {
    if (TIER !== 'hd') throw e;
    // The HD world could not start (no usable WebGL): fall back to the light tier.
    console.warn('[lab] HD tier failed, using the light tier:', e && e.message);
    TIER = lab.tier = 'light'; TC = CFG.light; R.classList.remove('t-hd'); R.classList.add('t-light'); $('world').textContent = '';
    return start();
  })
    .then(() => {
      // lab:game-ready = the world's first frame. A world may still be loading the rest of its art; the start
      // button turns on when it says it is ready (World.whenReady), so nothing loads during the first climb.
      mark('lab:game-ready'); worldReady = true;
      if (innerWidth !== initSize[0] || innerHeight !== initSize[1]) resize();   // rotated while loading
      return World.whenReady ? World.whenReady() : null;
    })
    .then(() => {
      R.classList.add('ready'); goB.disabled = false; lab.state = 'start'; drawStrip();
      if (saved) { const b = $('resume'); b.textContent = 'Continue at Q' + (saved.next + 1) + ' of ' + N; b.hidden = false; }
      cardFrame();
      if (DBG) console.info('[lab] game ready', Math.round(performance.getEntriesByName('lab:game-ready')[0].startTime), 'ms');
    })
    .catch(e => { $('mdesc').textContent = 'The game could not load: ' + e.message; throw e; });
})();
