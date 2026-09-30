import { launch, serve, watch, waitReady, args } from '../harness.mjs';
const o = args(process.argv.slice(2), { w: 1440, h: 900, theme: 'dark', wait: 7000 });
const browser = await launch({ cpu2d: true });
for (const v of ['now', 'storms', 'knock', 'deal', 'money']) {
  const ctx = await browser.newContext({ viewport: { width: +o.w, height: +o.h }, deviceScaleFactor: 1, colorScheme: o.theme });
  await serve(ctx);
  const page = await ctx.newPage(); const errs = watch(page);
  await page.goto('http://app.test/index.html?gl=0&theme=' + o.theme + '#' + v, { waitUntil: 'load' });
  const r = await waitReady(page, 60000);
  await page.waitForTimeout(+o.wait);
  const info = await page.evaluate(() => ({ gl: A.world.hasGL, view: A.view.current, hs: document.scrollingElement.scrollWidth > innerWidth, layers: A.world.layer.list().join(','), ticker: A.motion.ticker.size }));
  await page.screenshot({ path: `docs/design/claudes-aldaba/dev/tmp-review/gl0-${v}-${o.theme}-${o.w}.png` });
  console.log(v, 'ready', r, JSON.stringify(info), 'errors', errs.length, errs.slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close();
