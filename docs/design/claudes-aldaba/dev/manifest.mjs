// Claude's Aldaba · dev/manifest.mjs — counts what the credits show: lines per code file, data sizes, fonts.
// Writes the result into js/director.js (the `const MANIFEST = /* dev/manifest.mjs */ …;` line). Re-run after code changes:
//   node docs/design/claudes-aldaba/dev/manifest.mjs
// Only published files count (files.json), so dev tools and shots never inflate the numbers.
import { readFileSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';
import { ROOT } from './harness.mjs';

const files = JSON.parse(readFileSync(join(ROOT, 'files.json'), 'utf8')).files;
const pub = Object.keys(files);
const lines = (p) => { const s = readFileSync(join(ROOT, p), 'utf8'); return s.split('\n').filter((l) => l.trim()).length; };
const size = (p) => statSync(join(ROOT, p)).size;

const DIR = 'js/director.js';
const code = pub.filter((p) => p.startsWith('js/')).map((p) => [p, lines(p)]);
const css = pub.filter((p) => p.startsWith('css/')).map((p) => [p, lines(p)]);
const data = pub.filter((p) => p.startsWith('data/')).map((p) => [p, size(p)]);
const fonts = pub.filter((p) => p.startsWith('fonts/')).length;
const page = lines('index.html');

// director.js holds the manifest on one line, so its own count does not change when the line is rewritten
const man = { at: new Date().toISOString().slice(0, 10), page, code, css, data, fonts };
const src = readFileSync(join(ROOT, DIR), 'utf8');
const re = /const MANIFEST = \/\* dev\/manifest\.mjs \*\/ .*;\n/;
if (!re.test(src)) { console.error('MANIFEST line not found in ' + DIR); process.exit(1); }
writeFileSync(join(ROOT, DIR), src.replace(re, 'const MANIFEST = /* dev/manifest.mjs */ ' + JSON.stringify(man) + ';\n'));
const tot = code.reduce((s, x) => s + x[1], 0) + css.reduce((s, x) => s + x[1], 0);
console.log('manifest: ' + code.length + ' js + ' + css.length + ' css files, ' + tot + ' non-blank lines, data ' + (data.reduce((s, x) => s + x[1], 0) / 1e6).toFixed(2) + ' MB, ' + fonts + ' fonts');
