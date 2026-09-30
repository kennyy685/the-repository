import { launch, serve, watch, waitReady, args } from '../harness.mjs';
const o = args(process.argv.slice(2), { view: 'knock', gl: '0', secs: 30 });
const browser = await launch({ cpu2d: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark' });
await ctx.addInitScript(() => { const raf = window.requestAnimationFrame.bind(window); window.__n = 0; window.requestAnimationFrame = (cb) => raf((t) => { window.__n++; cb(t); }); });
await serve(ctx);
const page = await ctx.newPage(); const errs = watch(page);
await page.goto('http://app.test/index.html?' + (o.gl === '0' ? 'gl=0' : '') + '#' + o.view, { waitUntil: 'load' });
console.log('ready', await waitReady(page, 60000));
let last = 0;
for (let s = 0; s < +o.secs; s += 3) {
  await page.waitForTimeout(3000);
  const r = await page.evaluate(() => ({ n: window.__n, t: A.motion.ticker.size, live: A.world.layer.list().filter((id) => (A.world.layer.get(id) || {}).live), tl: null }));
  console.log('t+' + (s + 3) + 's ticker', r.t, 'rAF', r.n - last, 'live', r.live.join(',')); last = r.n;
}
console.log('errors', errs.length);
await browser.close();
