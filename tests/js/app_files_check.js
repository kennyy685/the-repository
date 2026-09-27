/* T169: the HMP App is a multi-file artifact. Checks pages/hmp-app.files.json (published path -> repo file)
 * against pages/hmp-app.html and the module files themselves:
 *   - every repo file in the manifest exists, and every published path is a plain relative path the Artifact
 *     tool accepts (no leading slash, no "..", not the reserved preflight.js);
 *   - every local <script src> / <link href> in the page is in the manifest, and every manifest path is used by
 *     the page (a tag, or a string the page loads later, like Leaflet's stylesheet);
 *   - no module is pasted back inline (the old "const HMPEstimateMath = (() => {" copies);
 *   - loaded together as classic scripts in page order, in ONE global scope (the way a browser runs them), the
 *     modules add exactly their window.HMP... names with the API the app calls, and nothing else leaks.
 *   node tests/js/app_files_check.js     Exit 0 = all good. tests/test_app_files.py runs it inside selftest.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..", "..");
const MANIFEST = path.join(ROOT, "pages", "hmp-app.files.json");
const fails = [];
const fail = (m) => fails.push(m);

const man = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const page = fs.readFileSync(path.join(ROOT, man.page), "utf8");
const files = man.files || {};

// 1. the manifest itself
for (const [pub, src] of Object.entries(files)) {
  if (!/^[A-Za-z0-9_][A-Za-z0-9_.\-/]*$/.test(pub) || pub.includes("..") || pub.includes("//")) fail(`bad published path "${pub}"`);
  if (pub === "preflight.js" || pub === "index.html") fail(`"${pub}" is reserved on the artifact host`);
  if (!fs.existsSync(path.join(ROOT, src))) fail(`${pub}: repo file ${src} is missing`);
}

// 2. page <-> manifest
const local = (u) => u && !/^(https?:|data:|blob:|#|\/\/)/i.test(u);
const tagRefs = [];
for (const m of page.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) tagRefs.push(m[1]);
for (const m of page.matchAll(/<link\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)) tagRefs.push(m[1]);
for (const ref of tagRefs.filter(local)) {
  const p = ref.split(/[?#]/)[0];
  if (!Object.prototype.hasOwnProperty.call(files, p)) fail(`the page loads "${ref}" but ${path.relative(ROOT, MANIFEST)} doesn't publish it`);
}
for (const pub of Object.keys(files)) {
  if (!page.includes(`"${pub}"`) && !page.includes(`'${pub}'`)) fail(`${pub} is published but the page never loads it`);
}

// 3. nothing pasted back inline
for (const name of ["HMPEstimateMath", "HMPTakeoff", "HMPFollowups", "EstimateScreen"]) {
  if (new RegExp(`const ${name} = \\(`).test(page)) fail(`${name} is pasted inline in the page again: load its file instead`);
}
if (/root\.HMPTranslate = api/.test(page)) fail("translate.js is pasted inline in the page again: load its file instead");

// 4. load the scripts the page loads, in page order, in one shared global scope
const EXPECT = {
  HMPEstimateMath: ["estimate", "selfCheck", "RULES_VERSION"],
  HMPTakeoff: ["takeoff", "selfCheck", "TAKEOFF_RULES_VERSION"],
  EstimateScreen: ["create", "saveToLead", "outboxDb", "savedLine", "SUPPORTED_RULES"],
  HMPFollowups: ["followups", "selfCheck", "FOLLOWUPS_VERSION"],
  HMPTranslate: ["sayIt", "readLegal", "checkRisk"],
};
const sandbox = { console, setTimeout, clearTimeout, Promise };
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);
const before = new Set(Object.getOwnPropertyNames(sandbox));
const scripts = [...page.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]).filter(local);
for (const ref of scripts) {
  const src = files[ref.split(/[?#]/)[0]];
  if (!src) continue;
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, src), "utf8"), ctx, { filename: src }); }
  catch (e) { fail(`${ref} throws when loaded next to the others: ${e.message}`); }
}
const added = Object.getOwnPropertyNames(sandbox).filter((n) => !before.has(n));
for (const n of added) if (!EXPECT[n]) fail(`a module leaks the global "${n}" (wrap it in its closure)`);
for (const [name, api] of Object.entries(EXPECT)) {
  const v = sandbox[name];
  if (!v) { fail(`window.${name} is not set after loading the page's scripts`); continue; }
  for (const k of api) if (!(k in v)) fail(`window.${name}.${k} is missing (the app calls it)`);
}
// the Spanish strings came along (a module file read with the wrong encoding would garble them)
if (sandbox.EstimateScreen && !/Tipo de siding/.test(JSON.stringify(sandbox.EstimateScreen.STR || {}))) fail("EstimateScreen lost its Spanish strings");

if (fails.length) {
  for (const f of fails) console.error("FAIL " + f);
  process.exit(1);
}
console.log(`app files OK: ${Object.keys(files).length} published files, ${scripts.length} scripts load together, globals = ${added.sort().join(", ")}`);
