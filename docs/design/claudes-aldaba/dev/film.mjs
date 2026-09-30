// Claude's Aldaba · dev/film.mjs — the director's film, tested offline in the publisher's skeleton.
// Run from the repo root:
//   node docs/design/claudes-aldaba/dev/film.mjs --shots 3000,12000,30000 [--theme dark|light|both] [--lang en|es|both]
//        [--w 1440 --h 900] [--wait 2600] [--view now] [--still] [--gl 0] [--hold]
//     each point: loads #<view>&film=<ms> (the film starts there and plays --wait ms; --hold freezes the seeked frame)
//     → shots/film-<ms>-<theme>-<lang>-<w>.png
//   node docs/design/claudes-aldaba/dev/film.mjs --run [--still] [--rate 3]   the whole film (rate > 1 runs the director's
//     clock faster; the software renderer here draws a few frames a second): chapters reached,
//     demo handles missing or failing, console errors, and a clean app + restored store at the end
//   node docs/design/claudes-aldaba/dev/film.mjs --stops              stop() at points in every chapter: nothing left behind
// Exit code 1 on console errors or a dirty hand-back.
import { mkdirSync } from 'fs';
import { join } from 'path';
import { ROOT, args, launch, serve, watch, waitReady } from './harness.mjs';

const o = args(process.argv.slice(2), { theme: 'dark', lang: 'en', w: 1440, h: 900, wait: 2600, view: 'now' });
const themes = o.theme === 'both' ? ['dark', 'light'] : String(o.theme).split(',');
const langs = o.lang === 'both' ? ['en', 'es'] : String(o.lang).split(',');
const W = +o.w, H = +o.h;
mkdirSync(join(ROOT, 'shots'), { recursive: true });
const browser = await launch({ cpu2d: true });   // software Canvas2D: SwiftShader's "GPU" canvas is far slower here
let bad = 0;

function pageUrl({ theme, lang, still, gl, hash }) {
  const q = new URLSearchParams();
  if (theme) q.set('theme', theme); if (lang) q.set('lang', lang); if (still) q.set('still', '1'); if (gl === '0') q.set('gl', '0');
  return 'http://app.test/index.html?' + q.toString() + '#' + hash;
}
async function open(theme, lang, hash) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, colorScheme: theme === 'light' ? 'light' : 'dark', reducedMotion: o.still ? 'reduce' : 'no-preference' });
  await serve(ctx);
  // a viewer with saved state: the film must hand it back untouched
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('claudes-aldaba:money.levers', JSON.stringify({ commission: 1500, stage: 'typical', hours: 4, days: 5 }));
      localStorage.setItem('claudes-aldaba:knock.walk.v1', JSON.stringify({ o: { 1: 'talked' }, hist: [{ r: 1 }], cur: 2, legal: {}, flags: {}, slot: {}, auto: {} }));
    } catch (e) { /* storage blocked */ }
  });
  const page = await ctx.newPage(); const errs = watch(page);
  await page.goto(pageUrl({ theme, lang, still: o.still, gl: String(o.gl), hash }), { waitUntil: 'load' });
  const ready = await waitReady(page);
  return { ctx, page, errs, ready };
}
const CLEAN = () => {
  const A = window.A, st = (k) => localStorage.getItem('claudes-aldaba:' + k);
  return {
    active: !!(A.director && A.director.active),
    dir: !!document.querySelector('.dir'), cursor: !!document.querySelector('.dir-cursor'), sign: !!document.querySelector('.dir-sign'),
    classes: ['dir-on', 'dir-frame', 'dir-hot', 'no-chrome'].filter((c) => document.documentElement.classList.contains(c)),
    inert: ['topbar', 'stage', 'world'].filter((id) => document.getElementById(id).inert),
    modal: !!document.querySelector('.deal-modal'), intro: !!(A.intro && A.intro.active),
    levers: st('money.levers'), walk: st('knock.walk.v1'), view: A.view.current,
    layers: A.world.layer.list().filter((id) => /^(intro|dir)-/.test(id)),
    ticker: A.motion.ticker.size, frameB: getComputedStyle(document.documentElement).getPropertyValue('--frame-b').trim()
  };
};
const LEVERS = JSON.stringify({ commission: 1500, stage: 'typical', hours: 4, days: 5 });
function dirty(c) {
  const out = [];
  if (c.active) out.push('film still active');
  if (c.dir) out.push('film DOM left');
  if (c.cursor) out.push('cursor left');
  if (c.sign) out.push('sign-off left');
  if (c.classes.length) out.push('classes left: ' + c.classes.join(','));
  if (c.inert.length) out.push('inert left: ' + c.inert.join(','));
  if (c.modal) out.push('deal sheet left open');
  if (c.intro) out.push('intro still running');
  if (c.layers.length) out.push('layers left: ' + c.layers.join(','));
  if (c.levers !== LEVERS) out.push('money levers changed: ' + c.levers);
  if (!c.walk || !/"talked"/.test(c.walk)) out.push('knock walk changed: ' + c.walk);
  if (c.frameB && c.frameB !== '0px') out.push('--frame-b ' + c.frameB);
  return out;
}

if (o.shots) {
  const pts = String(o.shots).split(',').map(Number);
  for (const ms of pts) for (const theme of themes) for (const lang of langs) {
    const t0 = Date.now();
    const { ctx, page, errs, ready } = await open(theme, lang, o.view + '&film=' + ms + (o.hold ? 'p' : ''));
    await page.waitForTimeout(+o.wait);
    const info = await page.evaluate(() => ({ t: Math.round(A.director.time), ch: A.director.chapter, view: A.view.current, rep: A.director.report(), hs: document.scrollingElement.scrollWidth > innerWidth }));
    const file = join(ROOT, 'shots', `film-${ms}${o.still ? '-still' : ''}${o.gl === '0' ? '-2d' : ''}-${theme}-${lang}-${W}.png`);
    await page.screenshot({ path: file });
    if (errs.length || !ready) bad++;
    console.log(`film ${String(ms).padStart(6)} ${theme.padEnd(5)} ${lang} ${W}x${H} ${errs.length ? 'ERRORS(' + errs.length + ')' : 'ok'} ready:${ready} t:${info.t} ch:${info.ch} view:${info.view} hscroll:${info.hs} ${info.rep.issues.length ? 'issues: ' + info.rep.issues.join(' | ') : ''} ${Date.now() - t0}ms → ${file.replace(ROOT + '/', '')}`);
    errs.slice(0, 6).forEach((e) => console.log('    ' + e));
    await ctx.close();
  }
}

if (o.run) {
  const { ctx, page, errs, ready } = await open(themes[0], langs[0], o.view);
  await page.evaluate(() => { window.__ch = []; A.on('film', (d) => window.__ch.push('film:' + JSON.stringify(d))); });
  await page.evaluate((rate) => A.director.play({ gesture: false, rate }), +o.rate || 1);
  const t0 = Date.now(), seen = new Set();
  let last = null;
  for (;;) {
    await page.waitForTimeout(700);
    const s = await page.evaluate(() => ({ on: A.director.active, ch: A.director.chapter, t: Math.round(A.director.time), view: A.view.current, hs: document.scrollingElement.scrollWidth > innerWidth }));
    if (s.ch >= 0 && !seen.has(s.ch)) { seen.add(s.ch); console.log(`  chapter ${String(s.ch + 1).padStart(2)} at film ${(s.t / 1000).toFixed(1)}s (wall ${((Date.now() - t0) / 1000).toFixed(1)}s) view:${s.view}${s.hs ? ' HSCROLL' : ''}`); }
    if (!s.on) break;
    if (Date.now() - t0 > 1500000) { console.log('  timeout'); break; }
    last = s;
  }
  await page.waitForTimeout(1400);
  const rep = await page.evaluate(() => A.director.report());
  const c = await page.evaluate(CLEAN);
  const d = dirty(c);
  console.log(`run: ready:${ready} chapters:${seen.size}/12 wall:${((Date.now() - t0) / 1000).toFixed(1)}s errors:${errs.length} end view:${c.view} ticker:${c.ticker}`);
  if (rep.issues.length) console.log('  issues: ' + rep.issues.join(' | '));
  if (rep.skipped.length) console.log('  skipped: ' + rep.skipped.join(', '));
  if (d.length) { bad++; console.log('  DIRTY: ' + d.join('; ')); } else console.log('  clean hand-back, store restored');
  errs.slice(0, 10).forEach((e) => console.log('    ' + e));
  if (errs.length) bad++;
  await ctx.close();
}

if (o.stops) {
  const { ctx, page, errs } = await open(themes[0], langs[0], o.view);
  const pts = await page.evaluate(() => A.director.beats.map((b) => b.at + Math.round(b.ms * 0.55)));
  for (const ms of pts) {
    await page.evaluate((ms) => A.director.play({ at: ms, gesture: false }), ms);
    await page.waitForTimeout(900);
    await page.evaluate(() => A.director.stop());
    await page.waitForTimeout(1300);
    const c = await page.evaluate(CLEAN);
    const d = dirty(c);
    console.log(`stop at ${String(ms).padStart(6)}: ${d.length ? 'DIRTY ' + d.join('; ') : 'clean'} (view ${c.view})`);
    if (d.length) bad++;
    await page.evaluate(() => { const e = document.querySelector('.dir-end [data-end="close"]'); if (e) e.click(); });
  }
  if (errs.length) { bad++; errs.slice(0, 10).forEach((e) => console.log('    ' + e)); }
  console.log('stops: errors ' + errs.length);
  await ctx.close();
}

await browser.close();
process.exit(bad ? 1 : 0);
