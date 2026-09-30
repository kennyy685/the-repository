// reviewer scratch: rapid view switching + lang/theme/resize mid-flight + film start/stop, then leak checks.
// node docs/design/claudes-aldaba/dev/tmp-review/stress.mjs [--gl 0] [--seed 7] [--n 30]
import { launch, serve, watch, waitReady, args } from '../harness.mjs';
const o = args(process.argv.slice(2), { seed: 7, n: 30, gl: '1' });
let seed = +o.seed; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const PROBE = () => {
  const raf = window.requestAnimationFrame.bind(window);
  window.__rafN = 0; window.__long = [];
  window.requestAnimationFrame = (cb) => raf((t) => { const s = performance.now(); try { cb(t); } finally { window.__rafN++; const d = performance.now() - s; if (d > 80) window.__long.push(Math.round(d)); } });
  window.__warns = [];
  const w = console.warn.bind(console); console.warn = (...a) => { try { window.__warns.push(a.map((x) => (x && x.stack) ? String(x.stack).split('\n').slice(0, 3).join(' / ') : String(x)).join(' ')); } catch (e) {} w(...a); };
};
const browser = await launch({ cpu2d: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark' });
await ctx.addInitScript(PROBE); await serve(ctx);
const page = await ctx.newPage(); const errs = watch(page);
const q = o.gl === '0' ? '?gl=0' : '';
await page.goto('http://app.test/index.html' + q + '#now', { waitUntil: 'load' });
console.log('ready', await waitReady(page, 40000));
await page.waitForTimeout(1500);
const STATE = () => ({
  view: A.view.current, layers: A.world.layer.list(), pins: A.world.pins(), ticker: A.motion.ticker.size,
  overlay: Array.from(document.getElementById('slot-overlay').children).map((c) => c.className),
  slots: ['left', 'right', 'bottom', 'center'].map((k) => document.getElementById('slot-' + k).children.length),
  cls: ['dir-on', 'dir-frame', 'dir-hot', 'dir-dusk', 'no-chrome', 'intro-on', 'intro-landed'].filter((c) => document.documentElement.classList.contains(c)),
  inert: ['topbar', 'stage', 'world'].filter((id) => document.getElementById(id).inert),
  dir: !!document.querySelector('.dir'), colo: !!document.querySelector('.colo'), keys: !!document.querySelector('.dir-keys'), modal: !!document.querySelector('.deal-modal'),
  end: !!document.querySelector('.dir-end'), film: !!(A.director && A.director.active), intro: !!(A.intro && A.intro.active),
  hs: document.scrollingElement.scrollWidth > innerWidth, fx: document.getElementById('fx').children.length, pinsDom: document.querySelector('.world__pins').children.length,
  lang: A.lang, theme: A.theme
});
// baseline: each view settled cleanly
const base = {};
for (const v of ['now', 'storms', 'knock', 'deal', 'money']) {
  await page.evaluate((v) => A.view.go(v), v); await page.waitForTimeout(3500);
  base[v] = await page.evaluate(STATE);
}
await page.evaluate(() => A.view.go('now')); await page.waitForTimeout(2500);
const log = [];
const sizes = [[1440, 900], [400, 860], [1280, 800]];
for (let i = 0; i < +o.n; i++) {
  const r = rnd();
  const k = String(1 + Math.floor(rnd() * 5));
  await page.keyboard.press(k); log.push(k);
  await page.waitForTimeout(40 + Math.floor(rnd() * 350));
  if (r < 0.2) { const b = pick(['#lang-es', '#lang-en', '#theme-light', '#theme-dark']); await page.evaluate((b) => document.querySelector(b).click(), b); log.push(b); }
  else if (r < 0.32) { const s = pick(sizes); await page.setViewportSize({ width: s[0], height: s[1] }); log.push('size' + s[0]); }
  else if (r < 0.42) {
    const at = Math.floor(rnd() * 80000);
    await page.evaluate((at) => A.director.play({ at, gesture: false }), at); log.push('film@' + at);
    await page.waitForTimeout(200 + Math.floor(rnd() * 1500));
    if (rnd() < 0.5) { await page.keyboard.press('Escape'); log.push('esc'); } else { await page.evaluate(() => A.director.stop()); log.push('stop'); }
    await page.waitForTimeout(100);
    await page.evaluate(() => { const e = document.querySelector('.dir-end [data-end="close"]'); if (e) e.click(); });
  } else if (r < 0.47) { await page.keyboard.press('?'); await page.waitForTimeout(150); await page.keyboard.press('Escape'); log.push('?esc'); }
}
await page.setViewportSize({ width: 1440, height: 900 });
console.log('actions:', log.join(' '));
const errsMid = errs.length;
// settle on each view and compare with baseline
const diffs = [];
for (const v of ['now', 'storms', 'knock', 'deal', 'money']) {
  await page.evaluate((v) => A.view.go(v), v); await page.waitForTimeout(4000);
  const s = await page.evaluate(STATE);
  const b = base[v];
  const extraL = s.layers.filter((x) => !b.layers.includes(x)), missL = b.layers.filter((x) => !s.layers.includes(x));
  const extraP = s.pins.filter((x) => !b.pins.includes(x)), missP = b.pins.filter((x) => !s.pins.includes(x));
  const d = [];
  if (extraL.length) d.push('extra layers ' + extraL); if (missL.length) d.push('missing layers ' + missL);
  if (extraP.length) d.push('extra pins ' + extraP); if (missP.length) d.push('missing pins ' + missP);
  if (JSON.stringify(s.slots) !== JSON.stringify(b.slots)) d.push('slots ' + JSON.stringify(b.slots) + '->' + JSON.stringify(s.slots));
  if (s.overlay.length !== b.overlay.length) d.push('overlay ' + JSON.stringify(b.overlay) + '->' + JSON.stringify(s.overlay));
  if (s.cls.length || s.inert.length || s.dir || s.colo || s.keys || s.modal || s.film || s.intro) d.push('stuck ' + JSON.stringify({ cls: s.cls, inert: s.inert, dir: s.dir, colo: s.colo, keys: s.keys, modal: s.modal, film: s.film, intro: s.intro }));
  if (s.hs) d.push('HSCROLL'); if (s.pinsDom !== s.pins.length) d.push('pin DOM ' + s.pinsDom + ' vs ' + s.pins.length);
  diffs.push(v + ': ' + (d.join('; ') || 'ok') + ' (layers ' + s.layers.length + ', pins ' + s.pins.length + ', fx ' + s.fx + ')');
}
diffs.forEach((d) => console.log('  ' + d));
// idle: 5 s after last input, count ticker + rAF
await page.evaluate(() => A.view.go('money')); await page.waitForTimeout(5000);
const idle = [];
for (const v of ['now', 'storms', 'knock', 'deal', 'money']) {
  await page.evaluate((v) => A.view.go(v), v); await page.waitForTimeout(6000);
  const a = await page.evaluate(() => ({ n: window.__rafN, t: A.motion.ticker.size }));
  await page.waitForTimeout(2000);
  const b = await page.evaluate(() => ({ n: window.__rafN, t: A.motion.ticker.size, live: A.world.layer.list().filter((id) => { const L = A.world.layer.get(id); return L && L.live; }) }));
  idle.push(v + ': ticker ' + b.t + ', rAF/2s ' + (b.n - a.n) + ', live layers ' + b.live.join(','));
}
idle.forEach((d) => console.log('  idle ' + d));
const w = await page.evaluate(() => window.__warns.slice(0, 30));
console.log('errors', errs.length, '(during stress ' + errsMid + ')'); errs.slice(0, 15).forEach((e) => console.log('   ' + e));
console.log('warns', w.length); w.forEach((e) => console.log('   ' + e.slice(0, 300)));
console.log('long frames', await page.evaluate(() => window.__long.length), await page.evaluate(() => window.__long.slice(0, 20).join(',')));
await browser.close();
