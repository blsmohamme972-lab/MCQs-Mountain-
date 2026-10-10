// node shoot2.js <port> <outdir> <w> <h> <times,comma> <qid>
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const [port, outdir, w, h, times, qid] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await (await browser.newContext({ viewport: { width: +w, height: +h } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${port}/${qid}-preview.html`);
  await page.waitForFunction(() => !document.getElementById('seek').disabled, null, { timeout: 8000 });
  for (const t of times.split(',')) {
    await page.evaluate(v => { const s = document.getElementById('seek'); s.value = v; s.dispatchEvent(new Event('input')); }, +t);
    await page.waitForTimeout(120);
    await page.screenshot({ path: `${outdir}/${qid}_t${t}.png` });
  }
  if (errors.length) console.log('PAGE ERRORS', JSON.stringify(errors));
  await browser.close();
})();
