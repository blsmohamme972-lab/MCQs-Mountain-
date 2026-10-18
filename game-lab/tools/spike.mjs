// Engine spike harness (D21, D24): loads one spike scene per engine from the local server and measures what the
// engine costs: time from starting to load the game code to the first drawn frame, frame times while the camera
// follows the walking hero, long tasks, JS heap, and the open/close of a DOM MCQ sheet on top of the canvas.
// Usage (from game-lab/, with `python3 -m http.server 8765` running there):
//   node tools/spike.mjs http://127.0.0.1:8765/spike/phaser/index.html [--cpu 1,4,6] [--runs 3] [--json results/spike-phaser.json]
//
// Contract every spike scene exposes:
//   performance.mark('lab:game-load')   just before the engine script starts loading
//   performance.mark('lab:game-ready')  first frame drawn with every texture in place
//   window.__spike = { state: 'loading' | 'ready', walk(ms) -> Promise, sheet(open) -> Promise, engine, version }
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const url = args[0];
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i < 0 ? fallback : args[i + 1]; };
const cpus = opt('cpu', '1,4,6').split(',').map(Number);
const runs = Number(opt('runs', '3'));
const jsonOut = opt('json', '');
const walkMs = Number(opt('walk', '4000'));

const pct = (xs, p) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]; };
const round = x => Math.round(x * 10) / 10;
const median = xs => pct(xs, 50);

async function once(cpu) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  let bytes = 0;
  page.on('requestfinished', async r => { try { bytes += (await r.sizes()).responseBodySize; } catch (_) {} });
  await page.addInitScript(() => {
    const frames = []; let last = 0;
    const tick = t => { if (last) frames.push([t, t - last]); last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    const longTasks = [];
    try { new PerformanceObserver(l => l.getEntries().forEach(e => longTasks.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true }); } catch (_) {}
    window.__probe = { frames, longTasks };
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await page.goto(url);
  await page.waitForFunction(() => window.__spike && window.__spike.state === 'ready', null, { timeout: 120000 });
  const load = await page.evaluate(() => {
    const at = n => { const e = performance.getEntriesByName(n)[0]; return e ? e.startTime : null; };
    return { start: at('lab:game-load'), ready: at('lab:game-ready') };
  });
  const loadLongTasks = await page.evaluate(() => window.__probe.longTasks.map(l => l[1]));
  await page.waitForTimeout(300);
  const t0 = await page.evaluate(() => performance.now());
  await page.evaluate(ms => window.__spike.walk(ms), walkMs);
  const t1 = await page.evaluate(() => performance.now());
  // DOM sheet over the canvas: open, wait, close (transform/opacity only), as the MCQ would.
  const sheet = await page.evaluate(async () => { const a = performance.now(); await window.__spike.sheet(true); const b = performance.now(); await new Promise(r => setTimeout(r, 300)); const c = performance.now(); await window.__spike.sheet(false); return { open_ms: b - a, close_ms: performance.now() - c }; });
  const probe = await page.evaluate(([a, b]) => ({
    walk: window.__probe.frames.filter(([t]) => t >= a && t <= b).map(([, d]) => d),
    longTasks: window.__probe.longTasks.filter(([s]) => s >= a).map(l => l[1]),
    heap: performance.memory ? performance.memory.usedJSHeapSize : null,
  }), [t0, t1]);
  await browser.close();
  const d = probe.walk;
  return {
    load_start_ms: round(load.start), game_ready_ms: round(load.ready), load_to_ready_ms: round(load.ready - load.start),
    load_long_task_ms_max: round(Math.max(0, ...loadLongTasks)), load_long_tasks: loadLongTasks.length,
    walk_frames: d.length, frame_ms_p50: round(pct(d, 50)), frame_ms_p95: round(pct(d, 95)), frame_ms_p99: round(pct(d, 99)), frame_ms_max: round(Math.max(0, ...d)),
    janky_frames_over_33ms: d.filter(x => x > 33.4).length,
    long_tasks_after_load: probe.longTasks.length, long_task_ms_max_after_load: round(Math.max(0, ...probe.longTasks)),
    sheet_open_ms: round(sheet.open_ms), sheet_close_ms: round(sheet.close_ms),
    js_heap_mb: probe.heap ? round(probe.heap / 1048576) : null, bytes_uncompressed: bytes, errors,
  };
}

const results = [];
for (const cpu of cpus) {
  const all = [];
  for (let r = 0; r < runs; r++) all.push(await once(cpu));
  const keys = Object.keys(all[0]).filter(k => typeof all[0][k] === 'number');
  const med = Object.fromEntries(keys.map(k => [k, round(median(all.map(x => x[k])))]));
  results.push({ cpu_slowdown: cpu, runs, median: med, errors: [...new Set(all.flatMap(x => x.errors))], each: all.map(x => { const { errors, ...rest } = x; return rest; }) });
  console.error('cpu', cpu, JSON.stringify(med));
}
const out = { url, viewport: '360x740 @3x, isMobile, headless Chromium (SwiftShader WebGL)', walk_ms: walkMs, results };
console.log(JSON.stringify(out, null, 1));
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(out, null, 1));
