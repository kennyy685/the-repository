import { launch, serve, watch, url, waitReady } from './harness.mjs';
const browser = await launch({ cpu2d: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark' });
await serve(ctx);
const page = await ctx.newPage(); const errs = watch(page);
await page.goto(url({ view: 'knock', theme: 'dark', lang: 'en', still: false }));
await waitReady(page); await page.waitForTimeout(4000);
// the viewer's own state: two doors logged, one flagged
await page.evaluate(() => { const o = A.knockDemo.state().order; A.knockDemo.tap('talked'); A.knockDemo.tap('come_back'); A.knockDemo.flag('noSoliciting', o[5]); });
await page.waitForTimeout(800);
const before = await page.evaluate(() => JSON.stringify([A.store.get('knock.walk.v1', null), A.store.get('knock.dnk.v1', null)]));
const beat = await page.evaluate(() => { const b = A.director.beats.find((x) => x.id === 'one-tap'); A.director.play({ at: b.at }); return b; });
await page.waitForTimeout(9000);
const mid = await page.evaluate(() => ({ cur: A.view.current, c: A.knockDemo.state().counts, rep: A.director.report() }));
console.log('mid', JSON.stringify(mid));
await page.evaluate(() => A.director.stop()); await page.waitForTimeout(2500);
const after = await page.evaluate(() => JSON.stringify([A.store.get('knock.walk.v1', null), A.store.get('knock.dnk.v1', null)]));
if (await page.evaluate(() => A.view.current) !== 'knock') { await page.evaluate(() => A.view.go('knock', { instant: true })); await page.waitForTimeout(1500); }
const st = await page.evaluate(() => A.knockDemo.state().counts);
console.log('store restored:', before === after, 'counts after:', JSON.stringify(st));
if (before !== after) console.log(before, '\n', after);
console.log('errors', errs.length, errs.slice(0, 5).join('\n'));
await browser.close();
