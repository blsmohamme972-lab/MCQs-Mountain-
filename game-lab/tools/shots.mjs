// Kafu game-lab screenshots for the visual reviews: five screens (start, mid-climb, lift, MCQ open, summit) in day
// and night. Usage: node shots.mjs <url> <out-dir> [--dpr 2] [--w 360 --h 740]
// The PNGs are for the owner's chat and the reviewers only; never commit them (lean storage).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const url = args[0], out = args[1] || 'shots';
const opt = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1]; };
const dpr = +opt('dpr', 2), W = +opt('w', 360), H = +opt('h', 740);
mkdirSync(out, { recursive: true });

async function run(scheme) {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, colorScheme: scheme });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'mode=story&gov=0');
  await page.waitForFunction(() => window.__lab && window.__lab.state === 'start', null, { timeout: 60000 });
  const shot = async n => page.screenshot({ path: `${out}/${scheme === 'dark' ? 'night' : 'day'}-${n}.png` });
  const answer = async () => { await page.waitForFunction(() => window.__lab.state === 'question', null, { timeout: 20000 }); await page.waitForTimeout(150); await page.evaluate(() => window.__lab.answer()); await page.waitForTimeout(200); };
  await page.waitForTimeout(1200); await shot('1-start');
  await page.tap('[data-lab=go]');
  await answer(); await page.locator('[data-lab=next]').tap();          // Q1 -> Q2: stairs
  await answer(); await page.locator('[data-lab=next]').tap();          // Q2 -> Q3: a jump
  await page.waitForFunction(() => !World.heroState || World.heroState() === 'fall', null, { timeout: 8000, polling: 'raf' }).catch(() => {}); await shot('2-climb');
  await answer(); await page.locator('[data-lab=next]').tap();          // Q3 -> Q4: the lift
  await page.waitForFunction(() => !World.heroState || World.heroState() === 'lift', null, { timeout: 8000, polling: 'raf' }).catch(() => {}); await page.waitForTimeout(300); await shot('3-lift');
  await answer(); await page.waitForTimeout(900); await shot('4-mcq');   // Q4 open, answered (celebration or calm)
  for (let q = 4; q < 8; q++) { await page.locator('[data-lab=next]').tap(); await answer(); }
  await page.locator('[data-lab=next]').tap();                          // Finish: climb to the summit
  await page.waitForFunction(() => !World.heroState || World.heroState() === 'cheer', null, { timeout: 8000, polling: 'raf' }).catch(() => {}); await page.waitForTimeout(350); await shot('5-summit');
  await page.waitForFunction(() => window.__lab.state === 'done', null, { timeout: 20000 }); await page.waitForTimeout(400); await shot('6-done');
  await browser.close();
  return errors;
}
for (const s of ['light', 'dark']) { const e = await run(s); console.log(s, e.length ? e : 'no errors'); }
