import { launch, serve, watch, url, waitReady } from './harness.mjs';
const browser = await launch({ cpu2d: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark' });
await ctx.addInitScript(() => { const raf = window.requestAnimationFrame.bind(window); window.__f = []; window.requestAnimationFrame = (cb) => raf((t) => { const s = performance.now(); try { cb(t); } finally { window.__f.push(performance.now() - s); } }); });
await serve(ctx);
const page = await ctx.newPage(); const errs = watch(page);
await page.goto(url({ view: 'now', theme: 'dark', lang: 'en', still: false }));
await waitReady(page); await page.waitForTimeout(6000);
const t0 = Date.now();
await page.evaluate(() => { window.__f = []; A.view.go('knock'); });
let st;
for (let i = 0; i < 300; i++) { await page.waitForTimeout(500); st = await page.evaluate(() => { const s = A.knockDemo.state(); return { head: s.head, reveal: s.reveal, tl: s.tl }; }); if (st.head >= 1 && st.reveal >= 1 && st.tl < 0) break; }
const f = await page.evaluate(() => { const a = window.__f.slice().sort((x, y) => y - x); return { n: a.length, top: a.slice(0, 6).map(Math.round), mean: Math.round(a.reduce((x, y) => x + y, 0) / a.length) }; });
console.log('entrance done in', Date.now() - t0, 'ms wall', JSON.stringify(st), JSON.stringify(f), 'errors', errs.length, errs.slice(0,3).join('\n'));
await browser.close();
