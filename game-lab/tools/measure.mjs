// Kafu game-lab speed test: drives a prototype through N questions in Chromium
// and reports frame times and transition latencies, with CPU throttling as a
// low-end-phone proxy. Usage: node measure.mjs <file.html | http(s)://url> [--mode story|strip|classic] [--cpu 1,4,6] [--q 6] [--json out.json]
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
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const isUrl = /^https?:\/\//.test(args[0] || '');
const file = isUrl ? args[0] : resolve(args[0]);
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const cpus = opt('cpu', '1,4,6').split(',').map(Number);
const questions = Number(opt('q', '6'));
const jsonOut = opt('json', '');
const mode = opt('mode', 'story');

const pct = (xs, p) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]; };
const round = x => Math.round(x * 10) / 10;

async function run(cpu) {
  const browser = await chromium.launch({ args: ['--disable-gpu-vsync=false'] });
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
  const url = isUrl ? file + (file.includes('?') ? '&' : '?') + 'mode=' + mode : 'file://' + file + '?mode=' + mode;
  await page.goto(url);
  await page.waitForFunction(() => window.__lab && window.__lab.state === 'start', null, { timeout: 60000 });
  const load = await page.evaluate(() => {
    const at = n => { const e = performance.getEntriesByName(n)[0]; return e ? e.startTime : null; };
    const nav = performance.getEntriesByType('navigation')[0];
    return { ready: at('lab:game-ready'), start: at('lab:game-load'), dcl: nav ? nav.domContentLoadedEventEnd : null };
  });
  const loadBytes = bytes;
  const t0 = await page.evaluate(() => performance.now());
  await page.tap('[data-lab=go]');
  const cycles = [];
  for (let q = 0; q < questions; q++) {
    await page.waitForFunction(() => window.__lab.state === 'question', null, { timeout: 20000 });
    await page.waitForTimeout(150);
    await page.locator('[data-lab=opt]').first().tap();
    await page.evaluate(() => window.__lab.answer());
    await page.waitForSelector('[data-lab=next]:visible', { timeout: 5000 });
    await page.waitForTimeout(250);
    if (q === questions - 1) break;
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
        input_to_first_frame_ms: firstFrame - nextTap,
        next_to_world_visible_ms: at('lab:world-visible') - nextTap,
        next_to_next_question_ms: at('lab:sheet-visible') - nextTap,
      };
    }, tap));
  }
  const probe = await page.evaluate(t => ({
    deltas: window.__probe.frames.filter(([t1]) => t1 >= t).map(([, d]) => d),
    longTasks: window.__probe.longTasks.filter(([s]) => s >= t),
    heap: performance.memory ? performance.memory.usedJSHeapSize : null,
  }), t0);
  await browser.close();
  const d = probe.deltas;
  const avg = key => round(cycles.reduce((s, c) => s + c[key], 0) / Math.max(1, cycles.length));
  const max = key => round(Math.max(...cycles.map(c => c[key])));
  return {
    cpu_slowdown: cpu,
    frames: d.length,
    frame_ms_p50: round(pct(d, 50)), frame_ms_p95: round(pct(d, 95)), frame_ms_p99: round(pct(d, 99)), frame_ms_max: round(Math.max(0, ...d)),
    janky_frames_over_33ms: d.filter(x => x > 33.4).length,
    long_tasks: probe.longTasks.length, long_task_ms_max: round(Math.max(0, ...probe.longTasks.map(l => l[1]))),
    next_input_to_first_frame_ms: { avg: avg('input_to_first_frame_ms'), max: max('input_to_first_frame_ms') },
    next_to_world_visible_ms: { avg: avg('next_to_world_visible_ms'), max: max('next_to_world_visible_ms') },
    next_to_next_question_ms: { avg: avg('next_to_next_question_ms'), max: max('next_to_next_question_ms') },
    js_heap_mb: probe.heap ? round(probe.heap / 1048576) : null,
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
console.log(JSON.stringify({ file, mode, questions, results }, null, 1));
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ file, mode, questions, results }, null, 1));
