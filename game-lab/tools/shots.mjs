// Kafu game-lab screenshots for the visual reviews, day and night: start, mid-climb (a jump), the lift, an MCQ open
// and answered, the summit and the summary; with --n over 10 also the first stage change (the camp, the clouds or the
// fade rising, the covered screen with the stage caption, the next mountain).
// Usage: node shots.mjs <url> <out-dir> [--dpr 2] [--w 360 --h 740] [--n 25]
// Each moving shot freezes the world for a moment (World.pause / World.resume), so it shows the exact pose asked for.
// The PNGs are for the owner's chat and the reviewers only; never commit them (lean storage).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const url = args[0], out = args[1] || 'shots';
const opt = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1]; };
const dpr = +opt('dpr', 2), W = +opt('w', 360), H = +opt('h', 740), nOpt = opt('n', '');
mkdirSync(out, { recursive: true });

async function run(scheme) {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-accelerated-2d-canvas'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, colorScheme: scheme });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'mode=story&gov=0' + (nOpt ? '&n=' + nOpt : ''));
  await page.waitForFunction(() => window.__lab && window.__lab.state === 'start', null, { timeout: 60000 });
  const tag = scheme === 'dark' ? 'night' : 'day';
  const shot = n => page.screenshot({ path: `${out}/${tag}-${n}.png` });
  const frozen = async n => { await page.evaluate(() => World.pause()); await page.waitForTimeout(80); await shot(n); await page.evaluate(() => World.resume()); };
  const until = (fn, ms = 15000) => page.waitForFunction(fn, null, { timeout: ms, polling: 'raf' }).then(() => true).catch(() => false);
  const answer = async () => { await page.waitForFunction(() => window.__lab.state === 'question', null, { timeout: 30000 }); await page.waitForTimeout(150); await page.evaluate(() => window.__lab.answer()); await page.waitForTimeout(200); };
  // the kind of each move from MCQ i to i + 1 (as in measure.mjs): 'step', 'lift' or 'stage'
  const { n, stages } = await page.evaluate(() => ({ n: window.__lab.n || 8, stages: window.__lab.stages || [[0, 8]] }));
  const kindOf = i => { const s = stages.find(r => i >= r[0] && i < r[1]), k = s[1] - s[0], j = i - s[0]; return i + 1 === s[1] ? 'stage' : k >= 6 && j === Math.floor(k / 2) - 1 ? 'lift' : 'step'; };
  await page.waitForTimeout(1200); await shot('1-start');
  await page.tap('[data-lab=go]');
  let jumped = false, lifted = false, staged = false;
  for (let q = 0; q < n; q++) {
    await answer();
    if (lifted === 'open') { await page.waitForTimeout(900); await shot('4-mcq'); lifted = true; }   // the MCQ after the lift, answered
    await page.locator('[data-lab=next]').tap();
    if (q === n - 1) break;
    const k = kindOf(q);
    if (k === 'step' && !jumped && q >= 1) { if (await until('World.heroState() === "fall"')) { await frozen('2-climb'); jumped = true; } }
    else if (k === 'lift' && !lifted) { if (await until('World.heroState() === "lift"')) { await page.waitForTimeout(250); await frozen('3-lift'); } lifted = 'open'; }
    else if (k === 'stage' && !staged && stages.length > 1) {
      if (await until('World.stageInfo().wipe > 0')) await frozen('7-stage-camp');
      if (await until('World.stageInfo().wipe > 0.45')) await frozen('8-stage-clouds');
      if (await until('World.stageInfo().wipe >= 1')) await frozen('9-stage-cover');
      if (await until('World.stageInfo().stage > 0 && World.stageInfo().wipe === 0 && World.heroState() === "run"')) await frozen('10-stage-next');
      staged = true;
    }
    // long chapters: once every shot of a stage is taken, skip the remaining climbs to reach the summit sooner
    else if (lifted === true && (staged || stages.length === 1) && q < n - 2) await page.mouse.click(W / 2, H * 0.25);
  }
  await until('World.heroState() === "cheer"', 20000); await page.waitForTimeout(350); await frozen('5-summit');
  await page.waitForFunction(() => window.__lab.state === 'done', null, { timeout: 30000 }); await page.waitForTimeout(400); await shot('6-done');
  await browser.close();
  return errors;
}
for (const s of ['light', 'dark']) { const e = await run(s); console.log(s, e.length ? e : 'no errors'); }
