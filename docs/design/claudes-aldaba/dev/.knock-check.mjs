// temp knock check (scratch; deleted after)
import { launch, serve, watch, url, waitReady } from './harness.mjs';
const lang = process.argv[2] || 'en', W = +(process.argv[3] || 1440), H = +(process.argv[4] || 900);
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, colorScheme: 'dark' });
await serve(ctx);
const page = await ctx.newPage(); const errs = watch(page);
await page.goto(url({ view: 'knock', theme: 'dark', lang, still: true }));
await waitReady(page); await page.waitForTimeout(1500);
const st = await page.evaluate(() => A.knockDemo.state());
// 1. order monotonic per street
const by = {}; st.doors.forEach((d) => (by[d.st] = by[d.st] || []).push(d));
for (const k in by) { const a = by[k].sort((p, q) => p.idx - q.idx); console.log(k.padEnd(8), a.map((d) => d.idx + '@' + d.lon.toFixed(5) + ',' + d.lat.toFixed(5) + (d.in1 ? '*' : '')).join(' ')); }
console.log('inLine', st.inLine, 'edge', JSON.stringify(st.edge));
// 2. layout
const lay = await page.evaluate(() => {
  const r = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
  const hero = r('.knock-card__hero'), line = r('.knock-line'), legal = r('.knock-legal'), pic = r('.knock-card__pic');
  const clipped = [...document.querySelectorAll('#slot-left *, #slot-right *')].filter((e) => { const cs = getComputedStyle(e); return e.children.length === 0 && e.textContent.trim() && e.scrollWidth > e.clientWidth + 1 && cs.overflow !== 'visible' && e.offsetParent; }).map((e) => e.className + ':' + e.textContent.trim().slice(0, 30));
  return { heroB: hero && hero.bottom, picB: pic && pic.bottom, lineT: line && line.top, legalT: legal && legal.top, clipped, hs: document.scrollingElement.scrollWidth > innerWidth };
});
console.log('layout', JSON.stringify(lay));
// 3. walk all 25 doors by keys
const seq = 'NTIXBNNTIBNXTNNIBTNXNTBNN'.split('');
let flagged = false;
for (let i = 0; i < 40; i++) {
  const s = await page.evaluate(() => { const x = A.knockDemo.state(); return { done: x.counts.done, cur: x.cur, n: x.order.length }; });
  if (s.done >= s.n) break;
  if (i === 5 && !flagged) { flagged = true; await page.click('#slot-left [data-flag="noSoliciting"]'); await page.waitForTimeout(150); continue; }
  const k = seq[i % seq.length];
  if (i % 4 === 1) await page.click('#slot-left .knock-legal').catch(() => {});
  await page.keyboard.press(k); await page.waitForTimeout(120);
  if (k === 'I') { const b = await page.$('#slot-left .knock-slot[data-slot="1"]'); if (b) { await b.click(); await page.waitForTimeout(150); } else console.log('no slot button after I'); }
}
await page.waitForTimeout(600);
const fin = await page.evaluate(() => { const x = A.knockDemo.state(); const r = document.querySelector('.knock-recap'); return { c: x.counts, recap: r ? r.innerText.replace(/\s+/g, ' ').slice(0, 400) : null, toasts: document.querySelectorAll('.toast.is-on, .toast').length }; });
console.log('final', JSON.stringify(fin));
await page.screenshot({ path: `shots/knock-check-recap-${lang}-${W}.png` });
await page.keyboard.press('U'); await page.waitForTimeout(400);
const un = await page.evaluate(() => { const x = A.knockDemo.state(); return { done: x.counts.done, recap: !!document.querySelector('.knock-recap') }; });
console.log('after undo', JSON.stringify(un));
console.log('errors', errs.length, errs.slice(0, 5).join('\n'));
await browser.close();
