import { launch, serve, watch, url, waitReady } from './harness.mjs';
const W = +(process.argv[2] || 1440), H = +(process.argv[3] || 900), still = process.argv[4] !== 'motion';
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, colorScheme: 'dark' });
await serve(ctx);
const page = await ctx.newPage(); const errs = watch(page);
await page.goto(url({ view: 'knock', theme: 'dark', lang: 'en', still }));
await waitReady(page); await page.waitForTimeout(still ? 1500 : 9000);
const r = await page.evaluate(() => {
  const el = document.querySelector('.pin[data-pin="knock-cur"] .knock-tag__in'); if (!el) return 'no tag';
  const b = el.getBoundingClientRect(), st = A.knockDemo.state();
  const pts = st.doors.map((d) => { const q = A.world.project(d.ll); return [d.idx, Math.round(q[0]), Math.round(q[1])]; });
  return { side: el.parentElement.dataset.side, box: [b.left, b.top, b.right, b.bottom].map(Math.round), z: A.world.camera().zoom.toFixed(2), ins: A.world.insetTarget, pts: pts.filter((p) => p[1] > 480 && p[1] < 680 && p[2] > 280 && p[2] < 440) };
});
console.log(JSON.stringify(r));
console.log('errors', errs.length);
await browser.close();
