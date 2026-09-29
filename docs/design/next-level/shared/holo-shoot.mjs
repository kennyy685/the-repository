// Hologram-walk screenshot + smoke harness (no network; serves docs/design/next-level from disk as http://app.test/).
// Usage: node shared/holo-shoot.mjs <dir> [waitMs=5000]
// Shoots <dir>/shots/{walk-en,walk-es,house-en,house-es,intro-en}.png at 1440x900 and prints console errors + FPS.
// The page must honor: ?still=1 (skip/finish intro, deterministic frame), ?lang=en|es, ?house=<walkIndex 1..25> (card open).
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, resolve, extname } from 'path';
const root = resolve(new URL('..', import.meta.url).pathname);
const dir = process.argv[2]; const wait = +(process.argv[3] || 5000);
if (!dir) { console.error('usage: node shared/holo-shoot.mjs <dir> [waitMs]'); process.exit(2); }
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
mkdirSync(join(root, dir, 'shots'), { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const shots = [
  ['walk-en', '?still=1&lang=en'], ['walk-es', '?still=1&lang=es'],
  ['house-en', '?still=1&lang=en&house=1'], ['house-es', '?still=1&lang=es&house=3'],
  ['intro-en', '?lang=en'],
];
let bad = 0;
for (const [name, q] of shots) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await ctx.route('**/*', async r => {
    const u = new URL(r.request().url());
    if (u.hostname !== 'app.test') return r.abort();
    const f = join(root, decodeURIComponent(u.pathname));
    if (!existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, body: readFileSync(f), contentType: types[extname(f)] || 'application/octet-stream' });
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(`http://app.test/${dir}/index.html${q}`);
  await p.waitForTimeout(name === 'intro-en' ? 1800 : wait);
  const fps = await p.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); (function f() { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else res(n); })(); }));
  await p.screenshot({ path: join(root, dir, 'shots', `${name}.png`) });
  if (errs.length) bad++;
  console.log(name, `rAF/s=${fps}`, errs.length ? 'ERRORS: ' + errs.slice(0, 4).join(' | ') : 'ok');
  await ctx.close();
}
await b.close();
process.exit(bad ? 1 : 0);
