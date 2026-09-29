/* T169: serve a page the way the claude.ai artifact host does, for the page tests (shots.js, design_gate.js).
 *
 * A page with a files manifest next to it (pages/<name>.files.json, e.g. pages/hmp-app.files.json) is a
 * multi-file artifact: its <script src>/<link href> tags load published files that live elsewhere in the repo
 * (docs/app/estimate.js is published as app/estimate.js). file:// can't do that mapping, so such a page is served
 * over http://127.0.0.1 instead, exactly like the host: /<name>.html = the page inside the publish skeleton
 * (doctype, meta charset + viewport, the small reset), /<published path> = the repo file the manifest names,
 * anything else = 404. A file the page needs but the manifest forgot fails here the same way it would live.
 * Pages without a manifest keep loading from file://, as before.
 *
 *   const { pageUrl, closeServer } = require("./serve");
 *   await page.goto(await pageUrl("pages/hmp-app.html"));  ...  await closeServer();
 */
"use strict";
const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");

// The Artifact tool wraps every published page in this skeleton (read back from the live HMP App, 2026-09-27).
const SKELETON_HEAD = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#faf9f5;color:#141413}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>';
const SKELETON_TAIL = "</body></html>";

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };

function manifestFor(rel) {
  const m = path.join(ROOT, rel.replace(/\.html$/, ".files.json"));
  return fs.existsSync(m) ? JSON.parse(fs.readFileSync(m, "utf8")) : null;
}

let server = null;
const sites = new Map();   // "pages/hmp-app.html" -> {pagePath, base, pageFile, files}
let misses = [];           // local files a page asked for that aren't published (404): a real failure, not "no internet"

function handle(req, res) {
  const url = decodeURIComponent(req.url.split("?")[0]);
  const site = [...sites.values()].find((s) => url === s.pagePath || url.startsWith(s.base)) || null;
  let file = null;
  if (site && url === site.pagePath) {
    res.writeHead(200, { "content-type": TYPES[".html"], "cache-control": "no-store" });
    res.end(SKELETON_HEAD + "\n" + fs.readFileSync(site.pageFile, "utf8") + SKELETON_TAIL);
    return;
  }
  if (site) {
    const rel = url.slice(site.base.length);
    if (Object.prototype.hasOwnProperty.call(site.files, rel)) file = path.join(ROOT, site.files[rel]);
  }
  if (!file || !fs.existsSync(file)) {
    if (url !== "/favicon.ico") misses.push(url);   // the browser asks for a favicon by itself; the host has none either
    res.writeHead(404, { "content-type": "text/plain" }); res.end("404 " + url); return;
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(file).pipe(res);
}

/** The URL to open `rel` (repo-relative, e.g. "pages/hmp-app.html") at: http when it has a manifest, else file://. */
async function pageUrl(rel) {
  const manifest = manifestFor(rel);
  if (!manifest) return "file://" + path.join(ROOT, rel);
  if (!server) {
    server = http.createServer(handle);
    await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  }
  const name = path.basename(rel);
  const base = "/" + name.replace(/\.html$/, "") + "/";   // one folder per page, so two pages' files never mix
  sites.set(rel, { pagePath: base + name, base, pageFile: path.join(ROOT, rel), files: manifest.files });
  return `http://127.0.0.1:${server.address().port}${base}${name}`;
}

/** The local files requested since the last call that the manifest doesn't publish (a page test counts each as a failure). */
function takeMisses() { const m = misses; misses = []; return [...new Set(m)]; }

async function closeServer() {
  if (!server) return;
  const s = server; server = null; sites.clear();
  await new Promise((ok) => s.close(ok));
}

module.exports = { pageUrl, closeServer, takeMisses, manifestFor, SKELETON_HEAD, SKELETON_TAIL, ROOT };
