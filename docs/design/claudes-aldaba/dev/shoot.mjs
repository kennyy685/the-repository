// Claude's Aldaba · dev/shoot.mjs — offline screenshots, wrapped in the artifact publisher's skeleton.
// Run from the repo root:
//   node docs/design/claudes-aldaba/dev/shoot.mjs [--view now|storms|knock|deal|money|all|'now&credits=1'] [--theme dark|light|both]
//        [--lang en|es|both] [--w 1440 --h 900] [--wait 6000] [--out prefix] [--still] [--dpr 1]
// Writes docs/design/claudes-aldaba/shots/<prefix|view>-<theme>-<lang>-<w>.png and prints console/page errors per shot.
// Exit code 1 if any shot had an error.
import { mkdirSync } from 'fs';
import { join } from 'path';
import { ROOT, VIEWS, args, launch, serve, watch, url, waitReady } from './harness.mjs';

const o = args(process.argv.slice(2), { view: 'now', theme: 'dark', lang: 'en', w: 1440, h: 900, dpr: 1 });
const views = o.view === 'all' ? VIEWS : String(o.view).split(',');
const themes = o.theme === 'both' ? ['dark', 'light'] : String(o.theme).split(',');
const langs = o.lang === 'both' ? ['en', 'es'] : String(o.lang).split(',');
const still = !!o.still, W = +o.w, H = +o.h, wait = o.wait != null ? +o.wait : still ? 1500 : 6000;
mkdirSync(join(ROOT, 'shots'), { recursive: true });

const browser = await launch();
let bad = 0;
for (const view of views) for (const theme of themes) for (const lang of langs) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: +o.dpr, colorScheme: theme === 'light' ? 'light' : 'dark', reducedMotion: 'no-preference' });
  const log = []; await serve(ctx, log);
  const page = await ctx.newPage(); const errs = watch(page);
  const t0 = Date.now();
  await page.goto(url({ view, theme, lang, still }), { waitUntil: 'load' });
  const ready = await waitReady(page);
  await page.waitForTimeout(wait);
  const file = join(ROOT, 'shots', `${o.out || view.replace(/[&=?]+/g, '-')}-${theme}-${lang}-${W}.png`);   // dev params in the hash: #now&film=24000p
  await page.screenshot({ path: file });
  const info = await page.evaluate(() => ({ gl: !!(window.A && A.world && A.world.hasGL), gl2: !!(window.A && A.world && A.world.gl2), view: window.A && A.view && A.view.current, hscroll: document.scrollingElement.scrollWidth > innerWidth }));
  const status = errs.length ? 'ERRORS (' + errs.length + ')' : 'ok';
  if (errs.length || !ready) bad++;
  console.log(`${view.padEnd(7)} ${theme.padEnd(5)} ${lang} ${W}x${H}  ${status}  ready:${ready} view:${info.view} webgl${info.gl2 ? '2' : info.gl ? '1' : ':none'} hscroll:${info.hscroll}  ${Date.now() - t0}ms  → ${file.replace(ROOT + '/', '')}`);
  errs.slice(0, 8).forEach((e) => console.log('    ' + e));
  log.filter((l) => l.startsWith('404')).forEach((l) => console.log('    ' + l));
  await ctx.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
