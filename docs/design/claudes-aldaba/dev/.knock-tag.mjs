import { launch, serve, watch, url, waitReady } from './harness.mjs';
const W = +(process.argv[2] || 1440), H = +(process.argv[3] || 900), rank = process.argv[4];
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, colorScheme: 'dark' });
await serve(ctx);
const page = await ctx.newPage(); const errs = watch(page);
await page.goto(url({ view: 'knock', theme: 'dark', lang: 'en', still: true }));
await waitReady(page); await page.waitForTimeout(1500);
for (const idx of [1, 5, 11, 15, 22, 23, 25]) {
  await page.evaluate((i) => { const d = A.knockDemo.state().doors.find((x) => x.idx === i); A.knockDemo.select(d.rank); }, idx);
  await page.waitForTimeout(1400);
  const r = await page.evaluate(() => {
    const el = document.querySelector('.pin[data-pin="knock-cur"] .knock-tag__in'); if (!el) return 'no tag';
    const b = el.getBoundingClientRect(), st = A.knockDemo.state();
    const hits = st.doors.filter((d) => { const q = A.world.project([d.lon, d.lat]); return q[0] > b.left - 8 && q[0] < b.right + 8 && q[1] > b.top - 8 && q[1] < b.bottom + 8; }).map((d) => d.idx);
    const cur = st.doors.find((d) => d.rank === st.cur);
    return { side: el.parentElement.dataset.side, box: [b.left, b.top, b.right, b.bottom].map(Math.round), cur: cur.idx, under: hits.filter((i) => i !== cur.idx), z: A.world.camera().zoom.toFixed(2) };
  });
  console.log(idx, JSON.stringify(r));
}
await page.screenshot({ path: 'shots/knock-check-tag.png' });
console.log('errors', errs.length, errs.slice(0,3).join('\n'));
await browser.close();
