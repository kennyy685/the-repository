// Claude's Aldaba · dev/smoke.mjs — click-everything smoke test, offline, in the publisher's skeleton.
// Run from the repo root:  node docs/design/claudes-aldaba/dev/smoke.mjs [--view all|now,...] [--motion]
// Per view (dark, en, still unless --motion): clicks every button/tab/segment in the top bar, the slots and the map HUD,
// switches language and theme, resizes to 1280x800 and 400x860, checks no horizontal scroll, no console errors, and
// that no rAF callback took >50 ms repeatedly (3+ times). Dialogs a click opens (credits, keys) are closed with Esc.
// Then the film: F starts it, Space pauses, Right skips a chapter, Esc hands back a clean app (no film DOM, no inert,
// no letterbox layout), and ?, M work. Prints a PASS/FAIL table; exit code 1 on any FAIL.
import { ROOT, VIEWS, args, launch, serve, watch, url, waitReady } from './harness.mjs';

const o = args(process.argv.slice(2), { view: 'all' });
const views = o.view === 'all' ? VIEWS : String(o.view).split(',');
const still = !o.motion;

// wraps requestAnimationFrame so every callback is timed
const PROBE = () => {
  const raf = window.requestAnimationFrame.bind(window);
  window.__long = []; window.__frames = 0;
  window.requestAnimationFrame = (cb) => raf((t) => {
    const s = performance.now();
    try { cb(t); } finally { const d = performance.now() - s; window.__frames++; if (d > 50) window.__long.push(Math.round(d)); }
  });
};

const browser = await launch({ cpu2d: true });
const rows = [];
for (const view of views) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark' });
  await ctx.addInitScript(PROBE);
  await serve(ctx);
  const page = await ctx.newPage(); const errs = watch(page);
  const notes = [];
  await page.goto(url({ view, theme: 'dark', lang: 'en', still }), { waitUntil: 'load' });
  const ready = await waitReady(page);
  if (!ready) notes.push('never ready');
  await page.waitForTimeout(still ? 300 : 2500);
  await page.evaluate(() => { window.__long = []; });

  // the film has its own check below (clicking it here would put the app under the film's glass)
  const SEL = '#topbar button:not(#film), #topbar a[data-view], #slot-left button, #slot-right button, #slot-bottom button, #slot-center button, #slot-left [role=tab], .hud button';
  let clicks = 0;
  const total = await page.locator(SEL).count();
  for (let i = 0; i < total + 10 && i < 80; i++) {
    const loc = page.locator(SEL);
    const n = await loc.count(); if (i >= n) break;
    const el = loc.nth(i);
    try {
      if (!(await el.isVisible())) continue;
      await el.click({ timeout: 5000 }); clicks++;
      await page.waitForTimeout(still ? 60 : 350);
    } catch (e) { notes.push('click ' + i + ' failed: ' + String(e.message).split('\n')[0].slice(0, 90)); }
    // a dialog the click opened (the credits, the key sheet) closes with Esc, and must go
    if (await page.evaluate(() => !!document.querySelector('.colo, .dir-keys'))) {
      await page.keyboard.press('Escape'); await page.waitForTimeout(still ? 120 : 400);
      if (await page.evaluate(() => !!document.querySelector('.colo, .dir-keys'))) notes.push('dialog failed to close with Esc');
    }
    const cur = await page.evaluate(() => window.A && A.view.current);
    if (cur !== view) { await page.evaluate((v) => A.view.go(v, { instant: true }), view); await page.waitForTimeout(80); }
  }
  // the film: F plays, Space pauses, Right skips a chapter, Esc hands back a clean app
  await page.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
  await page.keyboard.press('f'); await page.waitForTimeout(still ? 900 : 1600);
  const f1 = await page.evaluate(() => ({ on: !!(A.director && A.director.active), dom: !!document.querySelector('.dir'), playing: !!(A.director && A.director.playing), ch: A.director ? A.director.chapter : -1 }));
  await page.keyboard.press(' '); await page.waitForTimeout(200);
  const f2 = await page.evaluate(() => !!(A.director && A.director.playing));
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(still ? 500 : 900);
  const f3 = await page.evaluate(() => A.director ? A.director.chapter : -1);
  await page.keyboard.press('Escape'); await page.waitForTimeout(1300);
  const f4 = await page.evaluate(() => ({ on: !!(A.director && A.director.active), dom: !!document.querySelector('.dir'), cursor: !!document.querySelector('.dir-cursor'),
    cls: ['dir-on', 'dir-frame', 'no-chrome'].filter((c) => document.documentElement.classList.contains(c)), inert: ['topbar', 'stage', 'world'].filter((id) => document.getElementById(id).inert),
    end: !!document.querySelector('.dir-end') }));
  if (!f1.on || !f1.dom || !f1.playing) notes.push('film failed to start with F');
  if (f2) notes.push('film failed to pause with Space');
  if (f3 !== f1.ch + 1) notes.push('film Right failed (chapter ' + f1.ch + ' -> ' + f3 + ')');
  if (f4.on || f4.dom || f4.cursor || f4.cls.length || f4.inert.length) notes.push('film failed to hand back clean: ' + JSON.stringify(f4));
  if (!f4.end) notes.push('film "Your turn" card missing');
  await page.evaluate(() => { const b = document.querySelector('.dir-end [data-end="close"]'); if (b) b.click(); });
  if ((await page.evaluate(() => A.view.current)) !== view) { await page.evaluate((v) => A.view.go(v, { instant: true }), view); await page.waitForTimeout(still ? 300 : 900); }
  // ? opens the key sheet, Esc closes it; M flips the sound switch
  await page.keyboard.press('?'); await page.waitForTimeout(250);
  const k1 = await page.evaluate(() => !!document.querySelector('.dir-keys'));
  await page.keyboard.press('Escape'); await page.waitForTimeout(still ? 150 : 400);
  const k2 = await page.evaluate(() => !!document.querySelector('.dir-keys'));
  if (!k1 || k2) notes.push('key sheet failed (' + k1 + ',' + k2 + ')');
  const m0 = await page.evaluate(() => A.sound.shown); await page.keyboard.press('m'); await page.waitForTimeout(80);
  const m1 = await page.evaluate(() => A.sound.shown); await page.keyboard.press('m'); await page.waitForTimeout(80);
  if (m0 === m1) notes.push('M failed to flip the sound switch');
  // language + theme round trips
  await page.click('#lang-es'); const es = await page.evaluate(() => document.documentElement.dataset.lang === 'es' && A.lang === 'es');
  await page.click('#lang-en'); const en = await page.evaluate(() => A.lang === 'en');
  await page.click('#theme-light'); const lt = await page.evaluate(() => A.theme === 'light');
  await page.click('#theme-dark'); const dk = await page.evaluate(() => A.theme === 'dark');
  if (!(es && en)) notes.push('language switch failed');
  if (!(lt && dk)) notes.push('theme switch failed');
  // sizes
  const hs = {};
  for (const [w, h] of [[1440, 900], [1280, 800], [400, 860]]) {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(still ? 700 : 1200);
    hs[w] = await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth);
    if (w === 400) {
      const gut = await page.evaluate(() => { const r = document.getElementById('world').getBoundingClientRect(); return Math.round(r.left); });
      if (gut < 16) notes.push('400px map gutter ' + gut + 'px');
    }
  }
  const long = await page.evaluate(() => window.__long.slice());
  const frames = await page.evaluate(() => window.__frames);
  const pass = ready && errs.length === 0 && Object.values(hs).every(Boolean) && long.length < 3 && !notes.some((n) => /failed|never/.test(n));
  rows.push({ view, pass, clicks, errs, hs, long, frames, notes });
  await ctx.close();
}
await browser.close();

const pad = (s, n) => String(s).padEnd(n);
console.log('\n' + pad('view', 8) + pad('result', 8) + pad('clicks', 8) + pad('errors', 8) + pad('hscroll 1440/1280/400', 24) + pad('long rAF', 12) + 'notes');
console.log('-'.repeat(90));
for (const r of rows) {
  console.log(pad(r.view, 8) + pad(r.pass ? 'PASS' : 'FAIL', 8) + pad(r.clicks, 8) + pad(r.errs.length, 8) +
    pad([1440, 1280, 400].map((w) => (r.hs[w] ? 'ok' : 'SCROLL')).join(' / '), 24) + pad(r.long.length + (r.long.length ? ' (' + r.long.slice(0, 4).join(',') + 'ms)' : ''), 12) + r.notes.join('; '));
  r.errs.slice(0, 6).forEach((e) => console.log('        ' + e));
}
const fails = rows.filter((r) => !r.pass).length;
console.log('\n' + (fails ? fails + ' FAIL' : 'ALL PASS') + '  (' + (still ? 'still' : 'motion') + ' mode, root ' + ROOT.replace(process.cwd() + '/', '') + ')');
process.exit(fails ? 1 : 0);
