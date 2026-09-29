// Claude's Aldaba · dev/harness.mjs — shared by shoot.mjs and smoke.mjs.
// Serves the folder from disk at http://app.test/ (offline: every other host is aborted; Google Fonts CSS gets an
// empty 200 so the page falls back to the local woff2 files without a console error), and wraps index.html in the
// same skeleton the claude.ai artifact publisher adds.
import { readFileSync, existsSync, statSync } from 'fs';
import { join, resolve, extname, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { execSync } from 'child_process';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SKEL_HEAD = '<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif;background:#fafaf7}img{max-width:100%}[hidden]{display:none!important}</style></head><body>';
export const SKEL_TAIL = '</body></html>';
export const VIEWS = ['now', 'storms', 'knock', 'deal', 'money'];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

export async function loadPlaywright() {
  try { return await import('playwright'); } catch (e) {
    const g = execSync('npm root -g').toString().trim();
    return createRequire(join(g, 'noop.js'))('playwright');
  }
}

export function args(argv, defs) {
  const o = Object.assign({}, defs);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]; if (!a.startsWith('--')) continue;
    const k = a.slice(2), n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) o[k] = true; else { o[k] = n; i++; }
  }
  return o;
}

export async function launch() {
  const { chromium } = await loadPlaywright();
  return chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
}

/** route every request: app.test → disk (index.html wrapped), fonts.googleapis.com → empty CSS, everything else aborted */
export async function serve(ctx, log) {
  await ctx.route('**/*', async (r) => {
    const u = new URL(r.request().url());
    if (u.hostname === 'fonts.googleapis.com') return r.fulfill({ status: 200, contentType: 'text/css', body: '/* offline */' });
    if (u.hostname !== 'app.test') { if (log) log.push('blocked ' + u.hostname); return r.abort(); }
    let p = decodeURIComponent(u.pathname); if (p === '/' || p === '') p = '/index.html';
    if (p === '/favicon.ico') return r.fulfill({ status: 204, body: '' });
    const f = join(ROOT, p);
    if (!f.startsWith(ROOT) || !existsSync(f) || statSync(f).isDirectory()) { if (log) log.push('404 ' + p); return r.fulfill({ status: 404, body: '' }); }
    let body = readFileSync(f);
    if (p === '/index.html') body = SKEL_HEAD + body.toString('utf8') + SKEL_TAIL;
    return r.fulfill({ status: 200, body, contentType: TYPES[extname(f)] || 'application/octet-stream' });
  });
}

/** collect console errors + page errors + failed requests on a page */
export function watch(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + (e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  page.on('requestfailed', (q) => { const u = q.url(); if (u.includes('app.test')) errs.push('requestfailed: ' + u); });
  return errs;
}

export function url({ view = 'now', theme, lang, still }) {
  const q = new URLSearchParams();
  if (theme) q.set('theme', theme); if (lang) q.set('lang', lang); if (still) q.set('still', '1');
  const qs = q.toString();
  return 'http://app.test/index.html' + (qs ? '?' + qs : '') + '#' + view;
}

export async function waitReady(page, ms = 15000) {
  try { await page.waitForFunction(() => window.A && window.A.ready === true, null, { timeout: ms }); return true; } catch (e) { return false; }
}
