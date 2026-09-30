import { launch, serve, watch, waitReady, args } from '../harness.mjs';
const o = args(process.argv.slice(2), { at: 4290, wait: 900, gl: '1' });
const browser = await launch({ cpu2d: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark' });
await serve(ctx);
const page = await ctx.newPage(); const errs = watch(page);
page.on('console', (m) => { if (/aldaba/.test(m.text())) console.log('  console.' + m.type() + ': ' + m.text().slice(0, 200)); });
await page.goto('http://app.test/index.html' + (o.gl === '0' ? '?gl=0' : '') + '#now', { waitUntil: 'load' });
console.log('ready', await waitReady(page, 60000));
for (const at of String(o.at).split(',').map(Number)) {
  await page.evaluate((at) => A.director.play({ at, gesture: false }), at);
  await page.waitForTimeout(+o.wait);
  const pre = await page.evaluate(() => ({ intro: A.intro.active, tl: A.intro.timeline && { t: Math.round(A.intro.timeline.time), p: A.intro.timeline.playing, res: !!A.intro.timeline._res }, ch: A.director.chapter }));
  await page.evaluate(() => A.director.stop());
  for (let k = 0; k < 16; k++) {
    await page.waitForTimeout(500);
    const s = await page.evaluate(() => ({ intro: A.intro.active, layers: A.world.layer.list().filter((id) => /^intro/.test(id)).map((id) => { const L = A.world.layer.get(id); return id + ':' + (L._op||0).toFixed(2) + '>' + L._target + (L._kill ? 'k' : ''); }), cls: document.documentElement.className, ticker: A.motion.ticker.size }));
    if (k === 0 || k === 15 || !s.layers.length) { console.log('at', at, 'pre', JSON.stringify(pre), 'k', k, JSON.stringify(s)); if (!s.layers.length) break; }
  }
  await page.evaluate(() => { const e = document.querySelector('.dir-end [data-end="close"]'); if (e) e.click(); });
}
console.log('errors', errs);
await browser.close();
