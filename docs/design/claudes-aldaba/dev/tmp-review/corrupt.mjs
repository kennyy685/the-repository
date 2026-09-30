import { launch, serve, watch, waitReady } from '../harness.mjs';
const browser = await launch({ cpu2d: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark' });
await ctx.addInitScript(() => {
  const P = 'claudes-aldaba:';
  try {
    localStorage.setItem(P + 'knock.walk.v1', JSON.stringify({ o: { 1: 'bogus', 999: 'talked' }, hist: [{ r: 'x' }, null, 5], cur: 999, legal: 3, flags: null, slot: { 1: 'zz' }, auto: 'x', follow: 777 }));
    localStorage.setItem(P + 'knock.dnk.v1', JSON.stringify([1, 2]));
    localStorage.setItem(P + 'money.levers', JSON.stringify('garbage'));
    localStorage.setItem(P + 'lang', JSON.stringify(42));
    localStorage.setItem(P + 'theme', '{bad json');
    localStorage.setItem(P + 'sound', JSON.stringify('yes'));
    for (let i = 0; i < localStorage.length; i++) {}
    window.__warns = []; const w = console.warn.bind(console); console.warn = (...a) => { window.__warns.push(a.map(String).join(' ').slice(0, 200)); w(...a); };
  } catch (e) {}
});
await serve(ctx);
const page = await ctx.newPage(); const errs = watch(page);
await page.goto('http://app.test/index.html?still=1#knock', { waitUntil: 'load' });
console.log('ready', await waitReady(page, 60000));
await page.waitForTimeout(800);
const st = await page.evaluate(() => A.knockDemo.state());
console.log('knock state', JSON.stringify(st).slice(0, 300));
for (const k of ['n', 't', 'u', 'u', 'u', 'u', 'i']) { await page.keyboard.press(k); await page.waitForTimeout(150); }
try { await page.evaluate(() => A.knockDemo.openDeal()); } catch (e) { console.log("openDeal threw", String(e.message).split("\n")[0]); await page.evaluate(() => A.view.go("deal", { instant: true })); } await page.waitForTimeout(1500);
console.log('view', await page.evaluate(() => A.view.current), JSON.stringify(await page.evaluate(() => A.dealDemo.state && A.dealDemo.state())).slice(0, 200));
// deal store corrupt for current home
await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.includes('deal:v1')); if (k) localStorage.setItem(k, JSON.stringify({ v: 1, cur: 99, sel: -4, ticks: { intro: 'x', look: [1, 2, 3, 4, 5, 6, 7, 8] }, gate: 5, signed: 'not-a-date' })); });
await page.evaluate(() => A.view.go('money', { instant: true })); await page.waitForTimeout(800);
await page.evaluate(() => A.view.go('deal', { instant: true })); await page.waitForTimeout(1500);
console.log('deal', JSON.stringify(await page.evaluate(() => A.dealDemo.state && A.dealDemo.state())).slice(0, 200));
for (const v of ['now', 'storms', 'money']) { await page.evaluate((v) => A.view.go(v, { instant: true }), v); await page.waitForTimeout(900); }
console.log('lang', await page.evaluate(() => A.lang), 'theme', await page.evaluate(() => A.themeChoice), 'sound', await page.evaluate(() => A.sound.pref));
console.log('errors', errs); console.log('warns', await page.evaluate(() => window.__warns));
await browser.close();
