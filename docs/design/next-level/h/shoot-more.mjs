// Extra QA shots for the hologram walk (1280x800, ES, tour states, knocked/skipped, lite). Same no-network harness as ../shared/holo-shoot.mjs.
// Usage (from docs/design/next-level): node h/shoot-more.mjs [only-name]
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, resolve, extname } from 'path';
const root = resolve(new URL('..', import.meta.url).pathname);
const only = process.argv[2];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png' };
mkdirSync(join(root, 'h', 'shots'), { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
// [name, query, w, h, script run after load]
const shots = [
  ['walk-en-1280', '?still=1&lang=en', 1280, 800],
  ['walk-es-1280', '?still=1&lang=es', 1280, 800],
  ['house-en-1280', '?still=1&lang=en&house=1', 1280, 800],
  ['house-es-1280', '?still=1&lang=es&house=3', 1280, 800],
  ['walk-states', '?still=1&lang=en', 1440, 900, 'H.markDoor(0,"done");H.markDoor(1,"done");H.markDoor(2,"skip");H.closeCard&&0;'],
  ['house-states', '?still=1&lang=en&house=4', 1440, 900, 'H.visited.add(0);H.visited.add(1);H.skipped.add(2);H.updateAll();H.openCard(3,{fly:false});'],
  ['tour-knock', '?still=1&lang=en', 1440, 900, 'H.visited.add(0);H.skipped.add(1);H.startTour();H.tour.head=H.__dd(2);H.tour.phase="dwell";H.tour.t=0;H.snap(2);H.updateAll();'],
  ['walk-scale-all', '?still=1&lang=en', 1440, 900, 'H.setScale("all");'],
  ['walk-lite', '?still=1&lang=en&lite=1', 1440, 900],
  ['walk-hover', '?still=1&lang=en', 1440, 900, 'H.setHover(4);'],
  ['walk-rm', '?lang=es', 1440, 900],
  ['tour-move', '?still=1&lang=en', 1440, 900, 'H.startTour();H.tour.t=0.3;H.snap(0);'],
  ['intro-t1', '?lang=en', 1440, 900, 'H.seekIntro(1.0);'],
  ['intro-t2', '?lang=en', 1440, 900, 'H.seekIntro(2.0);'],
  ['intro-t3', '?lang=en', 1440, 900, 'H.seekIntro(3.0);'],
  ['intro-t4', '?lang=en', 1440, 900, 'H.seekIntro(3.8);'],
];
let bad = 0;
for (const [name, q, w, h, js] of shots) {
  if (only && only !== name) continue;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: name.endsWith('-rm') ? 'reduce' : 'no-preference' });
  await ctx.route('**/*', async r => {
    const u = new URL(r.request().url());
    if (u.hostname !== 'app.test') return r.abort();
    const f = join(root, decodeURIComponent(u.pathname));
    if (!existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, body: readFileSync(f), contentType: types[extname(f)] || 'application/octet-stream' });
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(`http://app.test/h/index.html${q}`);
  await p.waitForTimeout(name.startsWith('intro') ? 300 : 3500);
  if (js) { await p.evaluate(`(()=>{const H=window.__holo;${js}})()`).catch(e => errs.push(String(e))); await p.waitForTimeout(3000); }
  await p.screenshot({ path: join(root, 'h', 'shots', `${name}.png`) });
  if (errs.length) bad++;
  console.log(name, errs.length ? 'ERRORS: ' + errs.slice(0, 3).join(' | ').slice(0, 600) : 'ok');
  await ctx.close();
}
await b.close();
process.exit(bad ? 1 : 0);
