// Kafu game-lab speed test: drives a prototype through N questions in Chromium
// and reports frame times and transition latencies, with CPU throttling as a
// low-end-phone proxy. Usage: node measure.mjs <file.html | http(s)://url> [--mode story|strip|classic] [--cpu 1,4,6] [--q 6] [--n 50] [--json out.json]
// --n builds a chapter of n MCQs (v2: ?n=, the 8 samples repeated; D27); --q is how many of them are answered.
// Engine-based versions load textures with fetch/WebGL, which fails from file://: serve game-lab/ with
// `python3 -m http.server 8765` (from game-lab/) and pass http://127.0.0.1:8765/v2/index.html (extra query params are kept).
//
// Contract every prototype exposes (see game-lab/README.md):
//   window.__lab.state  'start' | 'moving' | 'question' | 'done'
//   window.__lab.answer()  completes and grades the open question (test hook)
//   performance.mark('lab:next-tap')       when Next is pressed
//   performance.mark('lab:world-visible')  first frame the world is fully visible again
//   performance.mark('lab:sheet-visible')  first frame the next question sheet is fully open
//   buttons: [data-lab=go] start arrow, [data-lab=opt] options, [data-lab=next] next question
//   ?mode=story|strip|classic selects the variant
//   optional: performance.mark('lab:game-load') when the game code starts loading and
//   performance.mark('lab:game-ready') on the first drawn frame (engine + art loaded), reported as load times
//   optional (v2, D27): window.__lab.stages = [[first, end), ...] MCQ ranges per stage, so each Next is labelled
//   'step', 'lift' (the stage's long beat, the same ledge in both tiers) or 'stage' (camp to the next mountain)
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const isUrl = /^https?:\/\//.test(args[0] || '');
const file = isUrl ? args[0] : resolve(args[0]);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const cpus = opt('cpu', '1,4,6').split(',').map(Number);
const nOpt = opt('n', '');
let questions = Number(opt('q', '6'));
const jsonOut = opt('json', '');
const mode = opt('mode', 'story');

const pct = (xs, p) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]; };
const round = x => Math.round(x * 10) / 10;

async function run(cpu) {
  // The HD tier needs WebGL: with no GPU in the container it runs on SwiftShader in the GPU process (software, so its
  // frame times say little about a phone). 2D canvases stay on the CPU: with them on SwiftShader, PixiJS's start-up
  // test (it reads back a 6 x 1 px canvas) stalls about 0.6 s here, against about 1 ms on a phone. The light tier is
  // measured without these flags, as before (comparable).
  const light = /[?&](low=1|tier=light)/.test(file);
  const browser = await chromium.launch({ args: ['--disable-gpu-vsync=false'].concat(light ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-accelerated-2d-canvas']) });
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    const frames = []; let last = 0;
    const tick = t => { if (last) frames.push([t, t - last]); last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    const longTasks = [];
    try { new PerformanceObserver(l => l.getEntries().forEach(e => longTasks.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true }); } catch (_) {}
    window.__probe = { frames, longTasks };
  });
  let bytes = 0;
  page.on('requestfinished', async r => { try { const s = await r.sizes(); bytes += s.responseBodySize; } catch (_) {} });
  const cdp = await context.newCDPSession(page);
  // Throttle before navigation so the load time (engine + art + first frame) is measured at the same CPU rate.
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  const url = (isUrl ? file + (file.includes('?') ? '&' : '?') : 'file://' + file + '?') + 'mode=' + mode + (nOpt ? '&n=' + nOpt : '');
  await page.goto(url);
  await page.waitForFunction(() => window.__lab && window.__lab.state === 'start', null, { timeout: 60000 });
  const load = await page.evaluate(() => {
    const at = n => { const e = performance.getEntriesByName(n)[0]; return e ? e.startTime : null; };
    const nav = performance.getEntriesByType('navigation')[0];
    return { ready: at('lab:game-ready'), start: at('lab:game-load'), dcl: nav ? nav.domContentLoadedEventEnd : null };
  });
  const loadBytes = bytes;
  const chapter = await page.evaluate(() => ({ n: window.__lab.n || null, stages: window.__lab.stages || null, heap: performance.memory ? performance.memory.usedJSHeapSize : null }));
  // the exact JS heap after a full garbage collection (performance.memory is rounded into coarse buckets)
  const heapGC = async () => { try { await cdp.send('HeapProfiler.collectGarbage'); return (await cdp.send('Runtime.getHeapUsage')).usedSize; } catch (_) { return null; } };
  const heap0 = await heapGC();
  const nq = Math.min(questions, chapter.n || questions);
  // the kind of each move from MCQ i to i + 1 (the same rule as both worlds: one lift per stage of 6 or more, in its middle)
  const kindOf = i => {
    if (!chapter.stages) return 'step';
    const s = chapter.stages.find(r => i >= r[0] && i < r[1]), k = s[1] - s[0], j = i - s[0];
    return i + 1 === s[1] ? 'stage' : k >= 6 && j === Math.floor(k / 2) - 1 ? 'lift' : 'step';
  };
  // Warm up Playwright's own injected selector script before the measured part: its first use is a 30-40 ms task at
  // 4x CPU that belongs to the harness, not to the page.
  await page.locator('[data-lab=go]').isVisible(); await page.locator('[data-lab=next]').count(); await page.waitForTimeout(300);
  const t0 = await page.evaluate(() => { if (window.World && window.World.scriptTimes) window.World.scriptTimes(true); return performance.now(); });
  await page.tap('[data-lab=go]');
  const cycles = [];
  for (let q = 0; q < nq; q++) {
    await page.waitForFunction(() => window.__lab.state === 'question', null, { timeout: 20000 });
    await page.waitForTimeout(150);
    await page.locator('[data-lab=opt]').first().tap();
    await page.evaluate(() => window.__lab.answer());
    await page.waitForSelector('[data-lab=next]:visible', { timeout: 5000 });
    await page.waitForTimeout(250);
    if (q === nq - 1) break;
    await page.evaluate(() => performance.clearMarks());
    const tap = await page.evaluate(() => performance.now());
    await page.locator('[data-lab=next]').tap();
    await page.waitForFunction(() => performance.getEntriesByName('lab:sheet-visible').length > 0, null, { timeout: 20000 });
    cycles.push(await page.evaluate(tapAt => {
      const at = n => (performance.getEntriesByName(n)[0] || {}).startTime;
      const nextTap = at('lab:next-tap') ?? tapAt;
      const frames = window.__probe.frames.filter(([t]) => t >= nextTap);
      const firstFrame = frames.length ? frames[0][0] : NaN;
      return {
        tap: nextTap,
        input_to_first_frame_ms: firstFrame - nextTap,
        next_to_world_visible_ms: at('lab:world-visible') - nextTap,
        next_to_next_question_ms: at('lab:sheet-visible') - nextTap,
      };
    }, tap));
    cycles[cycles.length - 1].kind = mode === 'story' ? kindOf(q) : kindOf(q) === 'stage' ? 'stage' : 'step';
    cycles[cycles.length - 1].end = await page.evaluate(() => performance.now());
  }
  const probe = await page.evaluate(t => ({
    deltas: window.__probe.frames.filter(([t1]) => t1 >= t).map(([, d]) => d),
    longTasks: window.__probe.longTasks.filter(([s]) => s >= t),
    heap: performance.memory ? performance.memory.usedJSHeapSize : null,
    script: window.World && window.World.scriptTimes ? window.World.scriptTimes() : null,
    tier: window.__lab.tier || null,
    build: window.World && window.World.stageInfo ? window.World.stageInfo().buildMs : null,
    ahead: window.World && window.World.stageInfo ? window.World.stageInfo().aheadMs || null : null,
    warm: window.World && window.World.stageInfo ? window.World.stageInfo().warmMs || null : null,
  }), t0);
  // the harness's own frame log (thousands of entries in a long run) must not count as the page's heap
  await page.evaluate(() => { window.__probe.frames.length = 0; window.__probe.longTasks.length = 0; });
  const heap1 = await heapGC();
  await browser.close();
  const d = probe.deltas;
  const avg = (key, cs = cycles) => round(cs.reduce((s, c) => s + c[key], 0) / Math.max(1, cs.length));
  const max = (key, cs = cycles) => round(Math.max(0, ...cs.map(c => c[key])));
  const byKind = {};
  for (const k of ['step', 'lift', 'stage']) {
    const cs = cycles.filter(c => c.kind === k);
    if (!cs.length) continue;
    // long tasks that start inside a move of this kind (from the Next tap to the next MCQ fully open)
    const lt = probe.longTasks.filter(([s0]) => cs.some(c => s0 >= c.tap && s0 <= c.end));
    byKind[k] = { count: cs.length, next_to_next_question_ms: { avg: avg('next_to_next_question_ms', cs), max: max('next_to_next_question_ms', cs) }, long_tasks: lt.length, long_task_ms_max: round(Math.max(0, ...lt.map(l => l[1]))) };
  }
  return {
    cpu_slowdown: cpu,
    frames: d.length,
    frame_ms_p50: round(pct(d, 50)), frame_ms_p95: round(pct(d, 95)), frame_ms_p99: round(pct(d, 99)), frame_ms_max: round(Math.max(0, ...d)),
    janky_frames_over_33ms: d.filter(x => x > 33.4).length,
    long_tasks: probe.longTasks.length, long_task_ms_max: round(Math.max(0, ...probe.longTasks.map(l => l[1]))),
    long_task_list: probe.longTasks.map(l => [round(l[0]), round(l[1])]),   // [start, duration] ms since the page opened
    next_list: cycles.map(c => [round(c.tap), round(c.end), c.kind]),        // each Next: [tap, next MCQ open, kind]
    next_input_to_first_frame_ms: { avg: avg('input_to_first_frame_ms'), max: max('input_to_first_frame_ms') },
    next_to_world_visible_ms: { avg: avg('next_to_world_visible_ms'), max: max('next_to_world_visible_ms') },
    next_to_next_question_ms: { avg: avg('next_to_next_question_ms'), max: max('next_to_next_question_ms') },
    // D27: every Next by kind, and the average time the game adds per MCQ (Next to the next MCQ fully open)
    by_kind: byKind,
    added_per_mcq_ms: avg('next_to_next_question_ms'),
    chapter_mcqs: chapter.n, stages: chapter.stages ? chapter.stages.length : null, answered: nq,
    js_heap_mb: probe.heap ? round(probe.heap / 1048576) : null,
    js_heap_mb_at_start: chapter.heap ? round(chapter.heap / 1048576) : null,
    js_heap_after_gc_mb: { at_start: heap0 == null ? null : Math.round(heap0 / 1048576 * 100) / 100, at_end: heap1 == null ? null : Math.round(heap1 / 1048576 * 100) / 100 },
    // main-thread time of each stage build (the world's buildStage), as the world reports it
    // stage_build_ms: main-thread time of each stage build inside the stage change (with the next stage built
    // ahead, only the swap); stage_ahead_ms: the builds done ahead, in idle time while an MCQ was open
    stage_build_ms: probe.build ? { count: probe.build.length, max: round(Math.max(...probe.build)), avg: round(probe.build.reduce((a, b) => a + b, 0) / probe.build.length) } : null,
    stage_ahead_ms: probe.ahead && probe.ahead.length ? { count: probe.ahead.length, max: round(Math.max(...probe.ahead)), avg: round(probe.ahead.reduce((a, b) => a + b, 0) / probe.ahead.length) } : null,
    // HD: the GPU upload of the stage built ahead, in an idle task of its own
    stage_warm_ms: probe.warm && probe.warm.length ? { count: probe.warm.length, max: round(Math.max(...probe.warm)), avg: round(probe.warm.reduce((a, b) => a + b, 0) / probe.warm.length) } : null,
    tier: probe.tier,
    // HD tier: main-thread script time per world frame (update + render submission), measured inside the ticker.
    script_frames: probe.script ? probe.script.length : null,
    script_ms_p50: probe.script ? round(pct(probe.script, 50)) : null,
    script_ms_p95: probe.script ? round(pct(probe.script, 95)) : null,
    script_ms_p99: probe.script ? round(pct(probe.script, 99)) : null,
    // Load: ms from navigation start to the first drawn frame of the game, and from the start of loading the
    // game code (lab:game-load) to that frame. null when a prototype does not set the marks (the draft).
    game_ready_ms: load.ready == null ? null : round(load.ready),
    game_load_to_ready_ms: load.ready == null || load.start == null ? null : round(load.ready - load.start),
    dom_content_loaded_ms: load.dcl == null ? null : round(load.dcl),
    bytes_loaded_uncompressed: loadBytes || null,
    errors,
  };
}

const results = [];
for (const cpu of cpus) results.push(await run(cpu));
const report = { file, mode, n: nOpt ? +nOpt : null, questions, results };
console.log(JSON.stringify(report, null, 1));
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(report, null, 1));
