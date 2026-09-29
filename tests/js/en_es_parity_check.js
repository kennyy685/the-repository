// EN/ES parity (code-health sweep 2026-09-29): every object literal with both `en: {...}` and `es: {...}` must have the
// same keys on both sides, at every depth, so no screen falls back to English (or shows "undefined") in Spanish.
// Parses the inline scripts of each page and each module with the TypeScript parser (plain JS is fine).
const fs = require("fs"), path = require("path");
const ts = require(path.join(process.env.NODE_PATH || "/opt/node22/lib/node_modules", "typescript"));
const ROOT = path.join(__dirname, "..", "..");
const FILES = ["pages/hmp-app.html", "pages/practice-door.html", "pages/translate/translate.js", "pages/v25/calls.js",
  "pages/v25/practice.js", "pages/v25/walkmap.js", "pages/estimate/estimate-module.js", "docs/design/open-map/index.html"];
const fails = []; let pairs = 0;
const keyOf = (p) => p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) || ts.isNumericLiteral(p.name)) ? p.name.text : null;
function props(obj) { const m = new Map(); for (const p of obj.properties) { const k = p.kind === ts.SyntaxKind.ShorthandPropertyAssignment ? p.name.text : keyOf(p); if (k != null) m.set(k, p); } return m; }
function hasSpread(obj) { return obj.properties.some((p) => ts.isSpreadAssignment(p)); }
function compare(a, b, where, file, line) {
  if (hasSpread(a) || hasSpread(b)) return;   // built from another object: can't check statically
  const A = props(a), B = props(b);
  for (const k of A.keys()) if (!B.has(k)) fails.push(`${file}:${line} ${where}.${k}: in EN, missing in ES`);
  for (const k of B.keys()) if (!A.has(k)) fails.push(`${file}:${line} ${where}.${k}: in ES, missing in EN`);
  for (const [k, pa] of A) { const pb = B.get(k);
    if (pb && ts.isPropertyAssignment(pa) && ts.isPropertyAssignment(pb) && ts.isObjectLiteralExpression(pa.initializer) && ts.isObjectLiteralExpression(pb.initializer)) compare(pa.initializer, pb.initializer, where + "." + k, file, line); }
}
function scan(src, file, lineOff) {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  (function walk(n) {
    if (ts.isObjectLiteralExpression(n)) { const P = props(n), en = P.get("en"), es = P.get("es");
      if (en && es && ts.isPropertyAssignment(en) && ts.isPropertyAssignment(es) && ts.isObjectLiteralExpression(en.initializer) && ts.isObjectLiteralExpression(es.initializer)) {
        pairs++; compare(en.initializer, es.initializer, "", file, lineOff + sf.getLineAndCharacterOfPosition(n.getStart()).line + 1); } }
    ts.forEachChild(n, walk);
  })(sf);
}
for (const f of FILES) {
  const p = path.join(ROOT, f); if (!fs.existsSync(p)) continue; const txt = fs.readFileSync(p, "utf8");
  if (f.endsWith(".js")) { scan(txt, f, 0); continue; }
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g; let m;
  while ((m = re.exec(txt))) { if (/type=["'](?:application\/(?:ld\+)?json|importmap)/.test(m[0].slice(0, 80))) continue; scan(m[1], f, txt.slice(0, m.index).split("\n").length - 1); }
}
if (!pairs) fails.push("found no en/es pairs: parser or file list broken");
console.log(fails.length ? "FAIL (" + fails.length + ")\n- " + fails.join("\n- ") : `PASS: ${pairs} EN/ES string tables, same keys on both sides`);
process.exit(fails.length ? 1 : 0);
