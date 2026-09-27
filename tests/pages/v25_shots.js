#!/usr/bin/env node
/* v25 step-3 screenshots (docs/release-checklist.md "Look at it"): the HMP App at 390 x 844 with realistic data, saved next
 * to the approved mockups so the two can be compared side by side.
 *
 *   NODE_PATH=/opt/node22/lib/node_modules node tests/pages/v25_shots.js            -> docs/design/v25-polish/built/*.png
 *   NODE_PATH=/opt/node22/lib/node_modules node tests/pages/v25_shots.js --out DIR  -> another folder (scratch)
 *   ... --only knock,money                                                            -> only shots whose name contains one of these
 *
 * Data = tests/pages/design_gate_fixture.json (leads, claims, stats: the same Rosa / Ann / US Bank the mockups use) + the
 * engine's real Columbus output behind the mockups (docs/design/v25-polish/data/columbus.js: zones/current, walks/<zone> with
 * basemap, today/walk with 25 stops) + two door taps on that walk (stop 1 not home, stop 2 no). Date frozen to
 * 2026-09-27 3 PM Central (like design_gate.js). window.claude is mocked (db, user, sample, assets) and nothing leaves the
 * machine. Exit 1 when a page error happens while shooting. */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { pageUrl, closeServer, takeMisses } = require("./serve");

const ROOT = path.resolve(__dirname, "..", "..");
const args = process.argv.slice(2);
const OUT = path.resolve(ROOT, args.includes("--out") ? args[args.indexOf("--out") + 1] : "docs/design/v25-polish/built");
const ONLY = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;
const FIXED_NOW_ISO = "2026-09-27T15:00:00-05:00";

function loadPlaywright() {
  for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright"]) { try { return require(p); } catch (e) { /* next */ } }
  throw new Error("playwright not found (set NODE_PATH=/opt/node22/lib/node_modules)");
}

function data(opts = {}) {
  const fx = JSON.parse(fs.readFileSync(path.join(__dirname, "design_gate_fixture.json"), "utf8"));
  const sb = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, "docs/design/v25-polish/data/columbus.js"), "utf8"), sb);
  const M = sb.window.HMP_MAP;
  const C = JSON.parse(JSON.stringify(fx.collections)), D = JSON.parse(JSON.stringify(fx.docs));
  const today = Object.assign({}, M.today, { date: "2026-09-27", kind: "storm", list_id: "2026-08-08_Columbus", city: "Columbus",
    stops: M.today.stops.map(s => Object.assign({ city: "Columbus" }, s)) });
  if (opts.emptyZones) { D["zones/current"] = { as_of: "2026-09-27", updated_at: "2026-09-27T11:54:00Z", zones: [] }; delete D["today/walk"]; C.walks = {}; }
  else {
    D["zones/current"] = Object.assign({}, M.zones, { as_of: "2026-09-27" });
    D["today/walk"] = today;
    C.walks = {};
    const tz = M.zones.zones.find(z => z.name === today.area) || {};
    for (const [id, w] of Object.entries(M.walks)) C.walks[id] = id === tz.id ? today : Object.assign({ stops: [] }, w);
  }
  // two taps on the Columbus walk: stop 1 not home, stop 2 said no (the mockup's "2 / 25")
  C.doors = {};
  if (!opts.emptyZones) today.stops.slice(0, 2).forEach((s, i) => {
    const pid = s.address.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    C.doors["2026-09-27_" + pid] = { date: "2026-09-27", pid, address: s.address, city: "Columbus", result: i ? "no" : "not_home", pass: 1, at: `2026-09-27T1${4 + i}:0${i}:00Z` };
  });
  // the homeowner view's house: a real lot on the Columbus walk (stop 9, 3908 22 St) with an inspection's photos (the mockups'
  // sample photos, served as assets) and circled spots, the Aug 8 hail proof, a quick estimate (roof + siding) and the price rules
  if (!opts.emptyZones) {
    const ph = (id, slot, marks) => ({ id, slot, at: "2026-09-26T16:0" + id.length % 10 + ":00Z", marks: marks.map(([x, y, r], i) => ({ x: x / 100, y: y / 100, r: r / 200, n: i + 1 })) });
    C.leads["3908-22-st"] = { address: "3908 22 St", city: "Columbus", first_name: "Dana", phone: "402-555-0199", source: "storm", type: "insurance", stage: "damage_found",
      next_step: { en: "Go over the photos at the table", es: "Revisar las fotos en la mesa", due: "2026-09-27" }, created_at: "2026-09-26T15:00:00Z", updated_at: "2026-09-26T17:00:00Z",
      photos: [ph("hoRoof0001", "roof", [[31.3, 41.7, 7.6], [58.3, 58.3, 6.4], [71.9, 34.7, 7]]), ph("hoSquare01", "sqWide", []), ph("hoVent0001", "metals", [[39.6, 38.9, 8.1], [58.3, 34.7, 6.5], [49, 58.3, 9.2], [66.7, 62.5, 6]]),
        ph("hoGutter01", "gutters", [[26, 48.6, 11.3], [43.8, 45.8, 8.7], [62.5, 51.4, 10]]), ph("hoSiding01", "siding", [[54, 44, 16], [68.5, 67, 7]])],
      estimate: { low: 25000, high: 48000, at: "2026-09-26T17:00:00Z", job: { type: "mixed", siding_squares: 18, roof_squares: 22, stories: 1, pitch: "std" } } };
    C.evidence = Object.assign({}, C.evidence, { "3908-22-st-columbus": { day: "2026-08-08", hail_in: 1.64, radar_max_in: 1.75, nearest_report: { dist_mi: 0.6, size_in: 1.5, source: "lsr" } } });
    D["system/prices"] = JSON.parse(fs.readFileSync(path.join(__dirname, "v25_prices.json"), "utf8"));
  }
  if (opts.noMoney) { C.claims = {}; for (const k of Object.keys(C.leads)) if (C.leads[k].type === "cash") delete C.leads[k]; }
  return { collections: C, docs: D };
}

function initScript(o, dt) {
  return `(() => {
  const FIXED = Date.parse(${JSON.stringify(FIXED_NOW_ISO)}), START = Date.now(), RealDate = Date;
  const now = () => FIXED + (RealDate.now() - START);
  function FrozenDate(...a) { if (!new.target) return new RealDate(now()).toString(); return a.length ? new RealDate(...a) : new RealDate(now()); }
  FrozenDate.prototype = RealDate.prototype; FrozenDate.now = now; FrozenDate.parse = RealDate.parse; FrozenDate.UTC = RealDate.UTC; window.Date = FrozenDate;
  try { localStorage.clear(); localStorage.setItem('hmp-app-lang', ${JSON.stringify(o.lang || "en")}); localStorage.setItem('hmp-app-tab', ${JSON.stringify(o.tab || "now")});
    ${o.theme ? `localStorage.setItem('hmp-app-theme', ${JSON.stringify(o.theme)});` : ""} } catch (e) {}
  const FIX = ${JSON.stringify(dt)};
  const C = FIX.collections, D = FIX.docs, cp = o => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const split = p => { const i = p.indexOf('/'); return i < 0 ? [p, ''] : [p.slice(0, i), p.slice(i + 1)]; };
  const read = p => (p in D ? D[p] : ((C[split(p)[0]] || {})[split(p)[1]]));
  const write = (p, v) => { const [c, id] = split(p); if (p in D || !C[c]) D[p] = v; else C[c][id] = v; };
  const snapDoc = (p, v) => ({ id: split(p)[1] || p, exists: v != null, data: () => cp(v == null ? undefined : v) });
  function doc(p) { return { id: split(p)[1] || p, path: p, get: async () => snapDoc(p, read(p)),
    onSnapshot(cb) { setTimeout(() => cb(snapDoc(p, read(p))), ${o.slow ? 60000 : 0}); return () => {}; },
    set: async (v, x) => write(p, x && x.merge ? Object.assign({}, read(p) || {}, cp(v)) : cp(v)), update: async v => write(p, Object.assign({}, read(p) || {}, cp(v))), delete: async () => {} }; }
  function query(name) { const self = { where: () => self, orderBy: () => self, limit: () => self, doc: id => doc(name + '/' + id),
    get: async () => self._snap(), onSnapshot(cb) { setTimeout(() => cb(self._snap()), ${o.slow ? 60000 : 0}); return () => {}; },
    _snap() { const coll = C[name] || {}; const docs = Object.keys(coll).map(id => snapDoc(name + '/' + id, coll[id])); return { docs, size: docs.length, empty: !docs.length, forEach: f => docs.forEach(f) }; } }; return self; }
  const db = { collection: n => query(n), doc };
  const user = { canEdit: async () => true, isOwner: async () => true, get: async () => ({ name: 'FilthE' }) };
  const sample = async () => ({ text: '' }); sample.json = async () => ({ reply: '', actions: [] }); sample.limits = async () => ({ maxPromptBytes: 65536 });
  const assets = { upload: async () => ({ id: '0'.repeat(32), url: '' }), list: async () => ({ assets: [], usage: {} }), delete: async () => ({}) };
  const caps = { db, user, sample, assets };
  window.claude = { use: async n => caps[n] || null };
})();`;
}

// Geist from Google Fonts on the live page; here the mockups' own copies (docs/design/v25-polish/fonts), so the shots
// show the real type (nothing leaves the machine)
async function fontRoutes(ctx) {
  const F = path.join(ROOT, "docs/design/v25-polish/fonts");
  const css = [["Geist", 400], ["Geist", 500], ["Geist", 600], ["Geist Mono", 500]].map(([f, w]) => `@font-face{font-family:"${f}";font-weight:${w};font-display:swap;src:url(https://fonts.gstatic.com/local/${f.replace(" ", "")}-${w}.woff2) format("woff2")}`).join("");
  await ctx.route(/^https:\/\/fonts\.googleapis\.com\//, r => r.fulfill({ status: 200, contentType: "text/css", body: css }));
  await ctx.route(/^https:\/\/fonts\.gstatic\.com\/local\//, r => { const f = path.join(F, r.request().url().split("/local/")[1]); return fs.existsSync(f) ? r.fulfill({ status: 200, contentType: "font/woff2", body: fs.readFileSync(f) }) : r.abort(); });
}

// name, tab, theme, lang, steps (css selectors clicked in order), data options
const SHOTS = [
  { name: "now", tab: "now" }, { name: "now-dark", tab: "now", theme: "dark" },
  { name: "now-empty", tab: "now", data: { emptyZones: true } }, { name: "now-loading", tab: "now", slow: true },
  { name: "knock", tab: "knock" }, { name: "knock-dark", tab: "knock", theme: "dark" }, { name: "knock-es", tab: "knock", lang: "es" },
  { name: "knock-map", tab: "knock", steps: ["#kMapBtn"] }, { name: "knock-es-dark", tab: "knock", lang: "es", theme: "dark" },
  { name: "leads", tab: "leads" }, { name: "leads-dark", tab: "leads", theme: "dark" },
  { name: "lead", tab: "leads", steps: ['[data-open="lead:615-n-linden-ave"]'] }, { name: "lead-dark", tab: "leads", theme: "dark", steps: ['[data-open="lead:615-n-linden-ave"]'] },
  { name: "money", tab: "money" }, { name: "money-dark", tab: "money", theme: "dark" },
  { name: "money-empty", tab: "money", data: { noMoney: true } }, { name: "money-dark-empty", tab: "money", theme: "dark", data: { noMoney: true } },
  { name: "claim", tab: "money", steps: ['[data-open="claim:1107-n-h-st"]'] },
  { name: "add", tab: "now", steps: ["#plusBtn"] }, { name: "more", tab: "now", steps: ["#moreBtn"] },
  { name: "homeowner-1", tab: "leads", steps: ['[data-open="lead:3908-22-st"]', "[data-ho]"] },
  { name: "homeowner-1-dark", tab: "leads", theme: "dark", steps: ['[data-open="lead:3908-22-st"]', "[data-ho]"] },
  { name: "homeowner-2", tab: "leads", steps: ['[data-open="lead:3908-22-st"]', "[data-ho]", '#hoView [data-p="2"]'] },
  { name: "homeowner-3", tab: "leads", steps: ['[data-open="lead:3908-22-st"]', "[data-ho]", '#hoView [data-p="3"]'] },
  { name: "homeowner-3-dark", tab: "leads", theme: "dark", steps: ['[data-open="lead:3908-22-st"]', "[data-ho]", '#hoView [data-p="3"]'] },
  { name: "homeowner-4", tab: "leads", steps: ['[data-open="lead:3908-22-st"]', "[data-ho]", '#hoView [data-p="4"]'] },
  { name: "homeowner-4-es", tab: "leads", steps: ['[data-open="lead:3908-22-st"]', "[data-ho]", '#hoView [data-p="4"]', "#hoView #hoLang"] },
  { name: "homeowner-exit", tab: "leads", steps: ['[data-open="lead:3908-22-st"]', "[data-ho]", "#hoView #hoX"] },
];

module.exports = { data, initScript, SHOTS };
if (require.main === module) (async () => {
  const { chromium } = loadPlaywright();
  const exe = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
  fs.mkdirSync(OUT, { recursive: true });
  const url = await pageUrl("pages/hmp-app.html");
  let bad = 0;
  try {
    for (const s of SHOTS) {
      if (ONLY && !ONLY.some(k => s.name.includes(k))) continue;
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: "light", timezoneId: "America/Chicago", locale: s.lang === "es" ? "es-US" : "en-US", reducedMotion: "reduce" });
      await ctx.route(/^(https?|wss?):/, r => (/^https?:\/\/127\.0\.0\.1[:/]/.test(r.request().url()) ? r.continue() : r.abort()));
      await fontRoutes(ctx);
      const IMG = { hoRoof0001: "ho-roof.jpg", hoSquare01: "ho-testsquare.jpg", hoVent0001: "ho-vent.jpg", hoGutter01: "ho-gutter.jpg", hoSiding01: "ho-siding.jpg" };
      await ctx.route(/\/_blob\//, r => { const id = decodeURIComponent(r.request().url().split("/_blob/")[1] || ""), f = IMG[id] && path.join(ROOT, "docs/design/v25-polish/img", IMG[id]);
        return f && fs.existsSync(f) ? r.fulfill({ status: 200, contentType: "image/jpeg", body: fs.readFileSync(f) }) : r.fulfill({ status: 404, body: "" }); });
      await ctx.addInitScript(initScript(s, data(s.data)));
      const p = await ctx.newPage(), errs = [];
      p.on("pageerror", e => errs.push(String(e && e.message || e)));
      p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) errs.push("console: " + m.text()); });
      await p.goto(url, { waitUntil: "load" });
      await p.waitForTimeout(700);
      try {
        for (const sel of s.steps || []) { const loc = p.locator(sel).first(); await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {}); await loc.click({ timeout: 3000 }); await p.waitForTimeout(450); }
      } catch (e) { errs.push("step failed: " + e.message.split("\n")[0]); }
      await p.waitForTimeout(300);
      await p.screenshot({ path: path.join(OUT, s.name + ".png") });
      const miss = takeMisses();
      if (errs.length || miss.length) { bad++; console.log(`[ERR] ${s.name}: ${[...errs, ...miss.map(m => "404 " + m)].join(" | ").slice(0, 400)}`); }
      else console.log(`[ok] ${s.name}`);
      await ctx.close();
    }
  } finally { await browser.close(); await closeServer(); }
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
