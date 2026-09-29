#!/usr/bin/env node
/* HMP HQ live-data smoke test (2026-09-29 rule: a runtime call must never freeze a page). pages/hmp-hq.html on the real
 * hq/snapshot doc (tests/fixtures/hq_live.json) behind tests/pages/hub_runtime_mock.js. Scenarios:
 *   live        db answers: dashboard draws, every button/link clicked, EN/ES toggled, no errors, main thread free
 *   phone       same at 420 px
 *   db-hang     use('db') never answers: after 12 s the page says it can't load (never stuck on "Loading")
 *   snap-hang   use('db') ok but the listener never fires: same, after 15 s
 *   db-fail     listener errors: visible error state
 *   db-off      use('db') gives null: "live data is on the published page"
 *   late-fail   data arrives, then the feed errors: last summary stays with a "couldn't refresh" note
 *   NODE_PATH=/opt/node22/lib/node_modules node tests/pages/hq_live_check.js [scenario ...]   (exit 0 = pass) */
"use strict";
const fs = require("fs");
const path = require("path");
const { pageUrl, closeServer } = require("./serve");
const ROOT = path.resolve(__dirname, "..", "..");
const OUT = path.join(__dirname, "out", "hq_live");
const FIX = JSON.parse(fs.readFileSync(path.join(ROOT, "tests", "fixtures", "hq_live.json"), "utf8")).docs;
const MOCK = path.join(__dirname, "hub_runtime_mock.js");
const NOW = new Date(FIX["hq/snapshot"].updated_at || "2026-09-29T12:05:00Z"); NOW.setMinutes(NOW.getMinutes() + 30);
function loadPlaywright() {
  for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright"]) { try { return require(p); } catch (e) { /* next */ } }
  throw new Error("playwright not found (set NODE_PATH=/opt/node22/lib/node_modules)");
}
const fails = []; let cur = "";
const ok = (c, m) => { if (!c) fails.push(`${cur}: ${m}`); return !!c; };
fs.mkdirSync(OUT, { recursive: true });

async function open(browser, url, o) {
  const ctx = await browser.newContext({ viewport: o.vp || { width: 1470, height: 900 }, timezoneId: "America/Chicago", colorScheme: "dark", reducedMotion: "reduce" });
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", e => errs.push("pageerror: " + e.message));
  p.on("console", m => { if (["error", "warning"].includes(m.type()) && !/Failed to load resource|ERR_|net::/.test(m.text())) errs.push(m.type() + ": " + m.text().slice(0, 200)); });
  await p.route(/^(https?|wss?):\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await p.addInitScript(({ docs, modes }) => {
    window.__MOCK = { docs, modes }; window.__unhandled = [];
    window.addEventListener("unhandledrejection", e => window.__unhandled.push(String((e.reason && (e.reason.code || e.reason.message)) || e.reason)));
    try { localStorage.clear(); } catch (e) { /* none */ }
  }, { docs: o.docs || FIX, modes: o.modes || {} });
  await p.addInitScript({ path: MOCK });
  await p.addInitScript(() => {   // expose the snapshot error callback so a test can drop the feed after data arrived
    const u = window.claude.use;
    window.claude.use = async n => { const c = await u(n); if (n !== "db" || !c) return c;
      return { ...c, doc: path => { const r = c.doc(path); return { ...r, onSnapshot: (ok, bad) => { window.__errCb = bad; return r.onSnapshot(ok, bad); } }; } }; };
  });
  await ctx.clock.install({ time: NOW });
  await p.goto(url, { waitUntil: "load" });
  await p.clock.runFor(o.settle || 1000);
  return { ctx, p, errs };
}
async function finish(o, shot) {
  const { p, errs, ctx } = o;
  const t = Date.now();
  const ms = await Promise.race([p.evaluate(() => 1).then(() => Date.now() - t), new Promise(r => setTimeout(() => r(9999), 5000))]);
  ok(ms < 1500, `main thread busy (${ms} ms)`);
  const un = await p.evaluate(() => window.__unhandled || []).catch(() => []);
  ok(!un.length, "unhandled rejections: " + un.join(" | "));
  ok(!errs.length, "errors: " + errs.slice(0, 4).join(" | "));
  if (shot) await p.screenshot({ path: path.join(OUT, shot + ".png") }).catch(() => {});
  await ctx.close();
}
const vis = (p, sel) => p.$eval(sel, e => !e.hidden && !!e.offsetParent).catch(() => false);
const text = (p, sel) => p.$eval(sel, e => e.textContent).catch(() => "");

async function clickAll(p) {   // every button and every link (links are prevented from navigating), then type in any box
  const n = await p.$$eval("button, a[href]", els => els.length);
  ok(n >= 2, "no buttons/links found");
  await p.evaluate(() => document.addEventListener("click", e => { if (e.target.closest("a")) e.preventDefault(); }, true));
  for (let i = 0; i < n; i++) {
    const h = (await p.$$("button, a[href]"))[i];
    if (h && await h.isVisible().catch(() => false)) await h.click({ timeout: 2000 }).catch(e => { if (!/detached|intercepts/.test(e.message)) fails.push(`${cur}: control ${i} not clickable: ${e.message.split("\n")[0]}`); });
    await p.clock.runFor(100);
  }
  for (const b of await p.$$("input, textarea, select")) { await b.fill("hail test 1712 N Clarkson").catch(() => {}); }
}
const SC = {
  async live(br, url, vp, name) {
    const o = await open(br, url, { vp });
    ok(await vis(o.p, "#dash"), "dashboard hidden");
    ok(!/Loading|Cargando/.test(await text(o.p, "#updated")), "still says loading");
    ok((await text(o.p, "#needs")).length > 5, "needs empty");
    await clickAll(o.p);
    await o.p.click("#langEs"); await o.p.clock.runFor(200);
    ok(await o.p.getAttribute("html", "lang") === "es", "ES did not apply");
    ok(/Pendientes/.test(await text(o.p, "#hNeeds")), "ES heading missing");
    await o.p.click("#langEn"); await o.p.clock.runFor(200);
    await o.p.clock.runFor(60000);
    await finish(o, name || "live");
  },
  async phone(br, url) { return SC.live(br, url, { width: 420, height: 900 }, "phone"); },
  async "db-hang"(br, url) {
    const o = await open(br, url, { modes: { use_db: "hang" }, settle: 500 });
    ok(/Loading/.test(await text(o.p, "#updated")), "no loading state at start");
    await o.p.clock.runFor(13000);
    ok(!/Loading/.test(await text(o.p, "#updated")), "stuck on Loading after 12 s");
    ok(await vis(o.p, "#empty"), "no error state shown");
    await o.p.click("#langEs"); await o.p.clock.runFor(100);
    ok(/No se pudo/.test(await text(o.p, "#empty")), "error state not in Spanish");
    await finish(o, "db-hang");
  },
  async "snap-hang"(br, url) {
    const o = await open(br, url, { modes: { db: "hang" }, settle: 500 });
    await o.p.clock.runFor(16000);
    ok(!/Loading/.test(await text(o.p, "#updated")), "stuck on Loading after 15 s");
    ok(await vis(o.p, "#empty"), "no error state shown");
    await finish(o, "snap-hang");
  },
  async "db-fail"(br, url) {
    const o = await open(br, url, { modes: { db: "fail" } });
    ok(await vis(o.p, "#empty") && /load|cargar/i.test(await text(o.p, "#empty")), "no visible error state");
    await finish(o, "db-fail");
  },
  async "db-off"(br, url) {
    const o = await open(br, url, { modes: { use_db: "null" } });
    ok(await vis(o.p, "#empty"), "no off state");
    await finish(o, "db-off");
  },
  async "late-fail"(br, url) {
    const o = await open(br, url, {});
    ok(await vis(o.p, "#dash"), "dashboard hidden");
    await o.p.evaluate(() => window.__errCb && window.__errCb(new Error("unavailable")));   // the feed drops after data arrived
    await o.p.clock.runFor(200);
    ok(await vis(o.p, "#dash"), "last summary vanished when the feed dropped");
    ok(await vis(o.p, "#note"), "no visible 'couldn't refresh' note");
    await finish(o, "late-fail");
  },
};
(async () => {
  const { chromium } = loadPlaywright();
  const br = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox", "--disable-gpu"] });
  const url = await pageUrl("pages/hmp-hq.html");
  const want = process.argv.slice(2);
  for (const k of Object.keys(SC)) {
    if (want.length && !want.includes(k)) continue;
    cur = k;
    try { await SC[k](br, url); } catch (e) { fails.push(`${k}: threw ${e.message.split("\n")[0]}`); }
    console.log(`${fails.some(f => f.startsWith(k + ":")) ? "FAIL" : "ok  "} ${k}`);
  }
  await br.close(); await closeServer();
  if (fails.length) { console.log("\n" + fails.join("\n")); process.exit(1); }
  console.log("hq_live_check: all green");
})();
