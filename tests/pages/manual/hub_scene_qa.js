"use strict";
const fs = require("fs"), path = require("path");
const REPO = path.resolve(__dirname, '../../..'), SD = process.env.HUB_QA_SD || '/tmp/hub-qa';  // SD/three/package = a local three@0.169.0
const { pageUrl, closeServer } = require(path.join(REPO, "tests/pages/serve.js"));
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const THREE_DIR = path.join(SD, "three/package"), OUT = path.join(SD, "qa/out"); fs.mkdirSync(OUT, { recursive: true });
const FIX = JSON.parse(fs.readFileSync(path.join(REPO, "tests/fixtures/hub_live.json"), "utf8")).docs;
const log = (...a) => console.log(...a);
async function open(browser, url, w, h, opt) {
  opt = opt || {};
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, timezoneId: "America/Chicago", reducedMotion: opt.rm ? "reduce" : "no-preference" });
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", e => errs.push("pageerror: " + e.message));
  p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|ERR_|net::/.test(m.text())) errs.push("console: " + m.text().slice(0, 300)); });
  await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.169\.0\/(.*)$/, r => { const rel = r.request().url().split("three@0.169.0/")[1]; const f = path.join(THREE_DIR, rel);
    if (fs.existsSync(f)) r.fulfill({ contentType: "text/javascript", body: fs.readFileSync(f, "utf8") }); else r.abort(); });
  await p.route(/^https?:\/\/(?!127\.0\.0\.1)(?!cdn\.jsdelivr)/, r => r.abort());
  await p.addInitScript(({ docs, ls }) => { window.__MOCK = { docs, modes: {} }; try { localStorage.clear(); for (const [k, v] of Object.entries(ls || {})) localStorage.setItem(k, v); } catch (e) {}
    const iv = setInterval(() => { const H = window.HUB; if (!H || H.__pf) return; H.__pf = 1; const f = H.fallback; H.fallback = why => why === 'slow' ? 0 : f.call(H, why); clearInterval(iv); }, 5); }, { docs: opt.docs || FIX, ls: opt.ls || {} });
  await p.addInitScript({ path: path.join(REPO, "tests/pages/hub_runtime_mock.js") });
  await p.goto(url + "#3d-test", { waitUntil: "load" });
  await p.waitForFunction(() => window.SCENE && window.SCENE.ready, null, { timeout: 40000 });
  await p.waitForTimeout(1500);
  return { ctx, p, errs };
}
const dbg = p => p.evaluate(() => window.SCENE.debug().cat);
async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const url = await pageUrl("pages/crew-hq.html");
  const which = process.argv[2] || "all";
    if (which === "late") {   // agents arrive late (slow db): does the cat play with a robot that was ALREADY waiting?
      const docs = JSON.parse(JSON.stringify(FIX)); docs["agents/builder"] = Object.assign({}, docs["agents/builder"], { status: "waiting", ask: "Old question FilthE already knows about?", at: new Date(Date.now() - 3600e3).toISOString() });
      const ctx = await browser.newContext({ viewport: { width: 420, height: 300 }, timezoneId: "America/Chicago" }); const p = await ctx.newPage(); const errs = [];
      p.on("pageerror", e => errs.push(e.message));
      await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.169\.0\/(.*)$/, r => { const rel = r.request().url().split("three@0.169.0/")[1]; const f = path.join(THREE_DIR, rel); if (fs.existsSync(f)) r.fulfill({ contentType: "text/javascript", body: fs.readFileSync(f, "utf8") }); else r.abort(); });
      await p.route(/^https?:\/\/(?!127\.0\.0\.1)(?!cdn\.jsdelivr)/, r => r.abort());
      await p.addInitScript(({ docs }) => { window.__MOCK = { docs, modes: {} }; try { localStorage.clear(); } catch (e) {}
        const iv = setInterval(() => { const H = window.HUB; if (!H || H.__pf) return; H.__pf = 1; const f = H.fallback; H.fallback = why => why === 'slow' ? 0 : f.call(H, why); clearInterval(iv); }, 5); }, { docs });
      await p.addInitScript({ path: path.join(REPO, "tests/pages/hub_runtime_mock.js") });
      await p.addInitScript(() => { const u = window.claude.use; window.claude.use = (n, ...a) => n === "db" ? new Promise(r => setTimeout(() => r(u.call(window.claude, n, ...a)), 13000)) : u.call(window.claude, n, ...a); });
      await p.goto(url + "#3d-test", { waitUntil: "load" });
      await p.waitForFunction(() => window.SCENE && window.SCENE.ready, null, { timeout: 40000 });
      const t0 = Date.now(); let armedAt = null, withAt = null, idsAt = null;
      for (let i = 0; i < 120 && !withAt; i++) { await p.waitForTimeout(500); const r = await p.evaluate(() => ({ c: window.SCENE.debug().cat, ids: window.HUB.needs.ids.slice() })); const t = ((Date.now() - t0) / 1000).toFixed(1);
        if (r.c.armed && armedAt == null) armedAt = t; if (r.ids.length && idsAt == null) idsAt = t; if (r.c.with) withAt = t; }
      log("scene armed at", armedAt, "s; needs appeared at", idsAt, "s; cat started playing with an ALREADY-WAITING robot at", withAt, "s", "errs", JSON.stringify(errs));
      await ctx.close(); await browser.close(); await closeServer(); return; }
    if (which === "flows") {
      const { ctx, p, errs } = await open(browser, url, 700, 450);
      await p.waitForTimeout(2000);
      const at = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");
      const ev = (i, a, to) => p.evaluate(({ i, a, to, at }) => { window.__mockDb.store.set("events/" + at.replace(/[-:]/g, "") + "-" + a + i, { agent: a, to, kind: "handoff", task: "T" + i, text: "h" + i, at, lane: "code" }); window.__mockDb.notify(); }, { i, a, to, at: at() });
      await ev(1, "builder", "qa-tester"); await ev(2, "designer", "qa-tester"); await ev(3, "engine-mechanic", "hub-keeper"); await ev(4, "qa-tester", "code"); await ev(5, "hub-keeper", "builder");
      let maxWalk = 0, maxList = 0; const shots = [];
      for (let i = 0; i < 80; i++) { await p.waitForTimeout(400); const d = await p.evaluate(() => { const x = window.SCENE.debug(); return { w: x.walk, n: x.flows.length, q: window.HUB.flows.length }; }); maxWalk = Math.max(maxWalk, d.w); maxList = Math.max(maxList, d.n); if (i === 3) await p.screenshot({ path: path.join(OUT, "flows-4.png") }); }
      log("5 handoffs at once: max walkers", maxWalk, "max capsules", maxList, "queue left", await p.evaluate(() => window.HUB.flows.length), "errs", JSON.stringify(errs));
      await ctx.close(); await browser.close(); await closeServer(); return; }
    if (which === "rm") {
      const { ctx, p, errs } = await open(browser, url, 900, 600, { rm: true });
      await p.waitForTimeout(3000);
      const at = new Date().toISOString().replace(/\.\d+Z$/, "Z");
      await p.evaluate(({ at }) => { const s = window.__mockDb.store; s.set("events/x1-builder", { agent: "builder", to: "qa-tester", kind: "handoff", task: "T1", text: "h", at, lane: "code" });
        const cur = s.get("agents/designer") || {}; s.set("agents/designer", Object.assign({}, cur, { status: "waiting", ask: "RM question?", at })); window.__mockDb.notify(); }, { at });
      let moved = 0, withSeen = false, lastPos = null; const states = new Set();
      for (let i = 0; i < 40; i++) { await p.waitForTimeout(500); const d = await p.evaluate(() => { const x = window.SCENE.debug(); return { c: x.cat, w: x.walk, n: x.flows.length, st: window.SCENE.cat && window.SCENE.cat.state }; });
        states.add(d.st); if (d.c.with) withSeen = true; if (d.w || d.n) moved++; if (lastPos && (Math.abs(lastPos[0] - d.c.x) > 0.01 || Math.abs(lastPos[1] - d.c.z) > 0.01) && d.c.moving) moved += 100; lastPos = [d.c.x, d.c.z]; }
      log("reduced motion: cat states", [...states], "play with robot seen:", withSeen, "walkers/capsules/cat-moving samples:", moved, "errs", JSON.stringify(errs));
      await ctx.close(); await browser.close(); await closeServer(); return; }
    if (which === "ledger") {
      const { ctx, p, errs } = await open(browser, url, 1440, 900);
      await p.click("#mineBtn"); await p.waitForTimeout(300); await p.click('[data-look="ledger"]'); await p.waitForTimeout(500); await p.click("#mineX"); await p.waitForTimeout(500);
      await p.evaluate(() => document.activeElement && document.activeElement.blur());
      await p.screenshot({ path: path.join(OUT, "ledger-whole.png") });
      await p.keyboard.press("o"); await p.waitForTimeout(3500); await p.screenshot({ path: path.join(OUT, "ledger-O.png") });
      await p.keyboard.press("y"); await p.waitForTimeout(3500); await p.screenshot({ path: path.join(OUT, "ledger-Y.png") });
      log("errs", JSON.stringify(errs)); await ctx.close(); await browser.close(); await closeServer(); return; }
    if (which === "catcam") {
      const { ctx, p, errs } = await open(browser, url, 700, 450);
      await p.evaluate(() => document.activeElement && document.activeElement.blur());
      await p.keyboard.press("y"); await p.waitForTimeout(1500);
      log("in cat view: HUB.cam", await p.evaluate(() => window.HUB.cam));
      await p.click("#mineBtn"); await p.waitForTimeout(300); await p.click("#mCatOn"); await p.waitForTimeout(1500);
      log("cat turned off in cat view: HUB.cam =", await p.evaluate(() => window.HUB.cam), "| scene camera mode falls to all; SCENE.views has cat:", await p.evaluate(() => window.SCENE.views.includes("cat")));
      await ctx.close(); await browser.close(); await closeServer(); return; }
    if (which === "off") { const { ctx, p, errs } = await open(browser, url, 1440, 900);
      await p.keyboard.press("y"); await p.waitForTimeout(1500);
      const q = () => p.evaluate(() => ({ on: window.HUB.cat.on, vis: window.SCENE.points.cat.visible, cat: window.SCENE.cat, tag: document.getElementById("catTag").classList.contains("on"), dbg: window.SCENE.debug().cat.state }));
      log("before", JSON.stringify(await q()));
      await p.click("#mineBtn"); await p.waitForTimeout(300); await p.click("#mCatOn");
      await p.waitForTimeout(300); log("300ms after off", JSON.stringify(await q()));
      await p.waitForTimeout(2000); log("2.3s after off", JSON.stringify(await q()));
      await p.screenshot({ path: path.join(OUT, "off.png") });
      await ctx.close(); await browser.close(); await closeServer(); return; }
  try {
    if (which === "all" || which === "keys") {
      const { ctx, p, errs } = await open(browser, url, 1440, 900);
      log("views", await p.evaluate(() => window.SCENE.views), "HUB.cat", await p.evaluate(() => JSON.stringify(window.HUB.cat)), "obs v", await p.evaluate(() => window.HUB.observatory && window.HUB.observatory.v));
      const rect = () => p.evaluate(() => { const s = window.HUB.cam; return s; });
      await p.evaluate(() => document.activeElement && document.activeElement.blur());
      await p.screenshot({ path: path.join(OUT, "k0-whole.png") });
      await p.keyboard.press("o"); await p.waitForTimeout(1800);
      log("after O cam", await rect(), "tab", await p.getAttribute("#tab-crew", "aria-selected"));
      await p.screenshot({ path: path.join(OUT, "k1-O.png") });
      await p.keyboard.press("o"); await p.waitForTimeout(1500); log("O again cam", await rect());
      await p.keyboard.press("y"); await p.waitForTimeout(2500);
      log("after Y cam", await rect(), "cat", JSON.stringify(await p.evaluate(() => window.SCENE.cat)), "pt", JSON.stringify(await p.evaluate(() => { const c = window.SCENE.points.cat; return {x: c.x, y: c.y, v: c.visible}; })));
      const tag = await p.evaluate(() => { const t = document.getElementById("catTag"); return { on: t.classList.contains("on"), tf: t.style.transform, txt: t.textContent, w: t.offsetWidth }; });
      log("cattag", JSON.stringify(tag));
      await p.screenshot({ path: path.join(OUT, "k2-Y.png") });
      await p.keyboard.press("y"); await p.waitForTimeout(1200); log("Y again cam", await rect());
      // typing in a field: keys must not fire
      await p.click("#q").catch(() => {}); await p.keyboard.type("oy"); await p.waitForTimeout(300); log("typed in search, cam", await rect(), "value", await p.inputValue("#q").catch(() => "?"));
      // cat off
      await p.evaluate(() => document.activeElement && document.activeElement.blur());
      await p.click("#mineBtn"); await p.waitForTimeout(300);
      await p.click("#mCatOn"); await p.waitForTimeout(600);
      log("cat off: HUB.cat", await p.evaluate(() => JSON.stringify(window.HUB.cat)), "SCENE.cat", JSON.stringify(await p.evaluate(() => window.SCENE.cat)), "views", await p.evaluate(() => window.SCENE.views), "point vis", await p.evaluate(() => window.SCENE.points.cat.visible), "petBtn hidden", await p.evaluate(() => document.getElementById("petBtn").hidden));
      await p.screenshot({ path: path.join(OUT, "k3-catoff.png") });
      log("ls hub-cat", await p.evaluate(() => localStorage.getItem("hub-cat")));
      log("errs", JSON.stringify(errs));
      await ctx.close();
    }
    if (which === "all" || which === "nonag") {
      const { ctx, p, errs } = await open(browser, url, 1440, 900);
      await p.waitForFunction(() => window.SCENE.debug().cat.armed, null, { timeout: 120000, polling: 500 });
      const setAgent = (id, patch) => p.evaluate(({ id, patch }) => { const s = window.__mockDb.store; const cur = s.get("agents/" + id) || {}; s.set("agents/" + id, Object.assign({}, cur, patch)); window.__mockDb.notify(); }, { id, patch });
      const t0 = Date.now(); const T = () => ((Date.now() - t0) / 1000).toFixed(1);
      await setAgent("builder", { status: "waiting", ask: "Ship v28.1 to the hub today?", at: new Date().toISOString(), room: "dock" });
      log(T(), "builder waiting");
      let plays = 0, prev = null, ended = false, reposted = false, repostT = 0;
      const samples = [];
      for (let i = 0; i < 500; i++) { await p.waitForTimeout(500); const c = await dbg(p);
        if (c.with !== prev) { samples.push([T(), c.with, c.state, c.withPose]); if (c.with) plays++; if (!c.with && prev) ended = true; prev = c.with; }
        if (i % 40 === 0) log(T(), JSON.stringify(c), JSON.stringify(await p.evaluate(() => ({ ids: window.HUB.needs.ids, st: window.HUB.byId.builder.st, since: window.HUB.byId.builder.since, hidden: false }))));
        if (ended && !reposted) { await setAgent("builder", { at: new Date().toISOString() }); reposted = true; repostT = T(); log(T(), "play ended; RE-POST same question (still waiting), new at"); }
        if (reposted && Date.now() - t0 > (repostT * 1000) + 60000) break; }
      log("samples", JSON.stringify(samples), "plays", plays);
      await setAgent("builder", { status: "working", ask: "", at: new Date().toISOString() });
      await p.waitForTimeout(3000); log(T(), "answered ->", JSON.stringify(await dbg(p)));
      log("errs", JSON.stringify(errs)); await ctx.close();
    }
  } finally { await browser.close(); await closeServer(); }
}
main();
