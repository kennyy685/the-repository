// Screenshot a next-level mockup at MacBook Air size, from disk (no server; the agent proxy grabs localhost).
// Usage: node docs/design/next-level/shared/shoot.mjs <dir a|b|c> [waitMs=6000]
// Writes <dir>/shots/{dark,light}-{en,es}.png at 1440x900. Page must honor ?theme=light|dark&lang=en|es&still=1
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, resolve, extname } from 'path';
const root = resolve(new URL('..', import.meta.url).pathname);
const dir = process.argv[2]; const wait = +(process.argv[3] || 6000);
const extra = process.argv[4] || ''; const suf = process.argv[5] ? '-' + process.argv[5] : '';  // optional: extra query (e.g. view=walk) + file suffix
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
mkdirSync(join(root, dir, 'shots'), { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const theme of ['dark', 'light']) for (const lang of ['en', 'es']) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await ctx.route('**/*', async r => {
    const u = new URL(r.request().url());
    if (u.hostname !== 'app.test') return r.abort();   // no network: fonts fall back to local copies
    const f = join(root, decodeURIComponent(u.pathname));
    if (!existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, body: readFileSync(f), contentType: types[extname(f)] || 'application/octet-stream' });
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(`http://app.test/${dir}/index.html?theme=${theme}&lang=${lang}${extra ? '&' + extra : ''}`);
  await p.waitForTimeout(wait);
  await p.screenshot({ path: join(root, dir, 'shots', `${theme}-${lang}${suf}.png`) });
  console.log(theme, lang, errs.length ? 'ERRORS: ' + errs.slice(0, 3).join(' | ') : 'ok');
  await ctx.close();
}
await b.close();
