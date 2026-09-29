#!/usr/bin/env node
/* AI hub live-data smoke test (2026-09-29: the hub froze live while every offline check passed).
 * The hub (pages/crew-hq.html) on the real hub db's shapes (tests/fixtures/hub_live.json, words scrubbed) with a mocked
 * claude.ai runtime (hub_runtime_mock.js) whose db / sample / mcp / user can succeed, FAIL or HANG. Scenarios:
 *   live        everything answers: no errors, a free main thread, every tab, every button in every tab, the chat
 *               (message saved, instant answer, King woken), a board answer, Make it yours, Refresh
 *   quiet-load  a wake held from last visit + the King window opened, no click: zero MCP calls (a call that isn't his
 *               click never raises a claude.ai consent prompt)
 *   mcp-hang    MCP never answers: the chat still sends, Fresh King gives up and comes back, the page stays usable
 *   sample-hang the instant answer never comes: it gives up at 2 min and the King still gets the message
 *   write-hang  db writes never answer: the chat send gives the text back with "failed" within ~10 s
 *   send-fail   a board answer / a King retry that fails gives its buttons back
 *   db-fail / no-db / user-hang: the page loads, says what's wrong, tabs still work
 *   phone       the live scenario's clicks at 390 px
 *   3d-slow     a 3D room that renders ~3 fps switches to the still view by itself (real clock)
 *   NODE_PATH=/opt/node22/lib/node_modules node tests/pages/hub_live_check.js [scenario ...] [--headed]
 * Exit 0 = pass. Shots in tests/pages/out/hub_live/. */
"use strict";
const fs = require("fs");
const path = require("path");
const { pageUrl, closeServer } = require("./serve");

const OUT = path.join(__dirname, "out", "hub_live");
const HEADED = process.argv.includes("--headed");
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "fixtures", "hub_live.json"), "utf8")).docs;
const MOCK = path.join(__dirname, "hub_runtime_mock.js");
const NOW = new Date("2026-09-29T00:30:00Z");   // 37 min after the fixture's newest chat
function loadPlaywright() {
  for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright"]) { try { return require(p); } catch (e) { /* next */ } }
  throw new Error("playwright not found (set NODE_PATH=/opt/node22/lib/node_modules)");
}
const fails = [], notes = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); return !!cond; };

async function open(browser, url, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: o.vp || { width: 1470, height: 900 }, timezoneId: "America/Chicago" });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", e => errs.push("pageerror: " + e.message));
  p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|ERR_|net::/.test(m.text())) errs.push("console: " + m.text().slice(0, 200)); });
  await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());   // offline: weather, CDN (three.js) - the page must not need them
  if (o.scene) await p.route(/\/hub\/scene\.js$/, r => r.fulfill({ contentType: "text/javascript", body: o.scene }));
  await p.addInitScript(({ docs, modes, ls }) => {
    window.__MOCK = { docs, modes };
    try { localStorage.clear(); for (const [k, v] of Object.entries(ls || {})) localStorage.setItem(k, v); } catch (e) { /* none */ }
  }, { docs: FIX, modes: o.modes || {}, ls: o.ls || {} });
  await p.addInitScript({ path: MOCK });
  if (!o.realClock) await ctx.clock.install({ time: NOW });
  await p.goto(url + (o.hash || ""), { waitUntil: "load" });
  const tick = ms => o.realClock ? p.waitForTimeout(ms) : p.clock.runFor(ms);
  await tick(o.settle || 3000);
  return { ctx, p, errs, tick };
}
async function probe(p) {   // the main thread answers at once (the freeze: 0.6-0.8 s a frame)
  const t = Date.now();
  const r = await Promise.race([p.evaluate(() => 1).then(() => Date.now() - t), new Promise(res => setTimeout(() => res(9999), 5000))]);
  return r;
}
const log = p => p.evaluate(() => window.__mockLog.slice());
const mcpCalls = async p => (await log(p)).filter(x => x[0] === "mcp").map(x => x[1]);
const writes = async p => (await log(p)).filter(x => x[0] === "set" || x[0] === "update").map(x => x[1]);

async function clickAll(p, tick, label) {   // every visible button in every tab, with a real pointer: nothing covers them, nothing throws
  const tabs = await p.$$eval("#tabs [role=tab], #tabs button", bs => bs.filter(b => b.offsetParent).map(b => b.id));
  let n = 0;
  for (const id of tabs) {
    await p.click("#" + id, { timeout: 2000 }).catch(e => fails.push(`${label}: tab #${id} not clickable: ${e.message.split("\n")[0]}`));
    await tick(300);
    ok(await p.getAttribute("#" + id, "aria-selected") === "true", `${label}: tab #${id} didn't select`);
    const sel = await p.$$eval(".tbody .tpanel:not([hidden]) button", bs => bs.filter(b => b.offsetParent && !b.disabled && !b.closest(".ans") && !b.matches("[data-fk], [data-kt], [data-wakenow]"))
      .map((b, i) => { b.dataset.__c = String(i); return i; }));
    for (const i of sel.slice(0, 25)) {
      const h = await p.$(`[data-__c="${i}"]`); if (!h || !(await h.isVisible())) continue;
      await h.click({ timeout: 2000 }).then(() => n++).catch(e => { if (!/detached|not attached|not visible/.test(e.message)) fails.push(`${label}: a button in #${id} not clickable: ${e.message.split("\n")[0]}`); });
      await tick(200);
      await p.keyboard.press("Escape"); await tick(100);
    }
  }
  return n;
}
async function sendChat(p, tick, text) {
  if (await p.isHidden("#kingWin")) { await p.click("#kingBubble", { timeout: 2000 }); await tick(300); }
  await p.fill("#kcInput", text, { timeout: 2000 });
  await p.press("#kcInput", "Enter");
}

async function scenarioLive(browser, url, vp, label) {
  const { ctx, p, errs, tick } = await open(browser, url, { vp });
  ok(await probe(p) < 500, `${label}: main thread busy after load`);
  ok((await mcpCalls(p)).length === 0, `${label}: MCP called on load (a surprise consent prompt): ${await mcpCalls(p)}`);
  const n = await clickAll(p, tick, label);
  notes.push(`${label}: clicked ${n} buttons across the tabs`);
  ok(await probe(p) < 500, `${label}: main thread busy after clicking everything`);
  // the chat: saved, answered here, the King woken
  await sendChat(p, tick, "smoke test: what needs me today?");
  await tick(4000);
  const w = await writes(p);
  ok(w.some(x => /^events\/\d{8}T\d{6}Z-you-k$/.test(x)), `${label}: chat message not saved (writes: ${w.slice(-5)})`);
  ok(w.some(x => /-king-i$/.test(x)), `${label}: no instant answer saved`);
  ok((await mcpCalls(p)).includes("fire_trigger"), `${label}: the King wasn't woken`);
  ok(await p.inputValue("#kcInput") === "", `${label}: chat box not cleared after send`);
  ok(/Mock King answer/.test(await p.textContent("#ktLog")), `${label}: instant answer not shown`);
  ok(w.filter(x => x === "system/stale").length <= 1, `${label}: system/stale written ${w.filter(x => x === "system/stale").length}x on one load`);
  if (!vp || vp.width > 900) await p.click("#kingX", { timeout: 2000 }).catch(e => fails.push(`${label}: chat close: ${e.message.split("\n")[0]}`));
  await tick(300);
  // a board answer, if the real board has an open question
  await p.click("#tab-board", { timeout: 2000 }).catch(() => {}); await tick(300);
  const ans = await p.$("#boardBody .ans [data-a]");
  if (ans) { await ans.click({ timeout: 2000 }); await tick(1500); ok((await writes(p)).some(x => x.startsWith("answers/")), `${label}: board answer not saved`); }
  // Make it yours opens and closes; Refresh answers
  await p.click("#mineBtn", { timeout: 2000 }).catch(e => fails.push(`${label}: Make it yours: ${e.message.split("\n")[0]}`)); await tick(300);
  ok(await p.isVisible("#m3d"), `${label}: 3D room switch missing`);
  await p.keyboard.press("Escape"); await tick(300);
  await p.click("#refreshBtn", { timeout: 2000 }).catch(e => fails.push(`${label}: Refresh: ${e.message.split("\n")[0]}`)); await tick(1500);
  const subs = await p.evaluate(() => window.__subs);
  ok(subs <= 12, `${label}: ${subs} live subscriptions open (subscribe once)`);
  // focus + return must not resubscribe a quiet but healthy connection
  await p.evaluate(() => { window.dispatchEvent(new Event("focus")); }); await tick(4000);
  ok(await p.evaluate(() => window.__subs) === subs, `${label}: a focus resubscribed a healthy connection`);
  await p.screenshot({ path: path.join(OUT, label + ".png") });
  ok(!errs.length, `${label}: page errors: ${errs.slice(0, 4).join(" | ")}`);
  await ctx.close();
}

async function scenarioQuiet(browser, url) {
  const L = "quiet-load";
  const { ctx, p, errs, tick } = await open(browser, url, { ls: { "hub-wake-held": JSON.stringify(["answered D99 = Yes"]), "hub-wake-since": String(NOW.getTime() - 60000) } });
  await tick(60000);
  await p.click("#kingBubble", { timeout: 2000 }); await tick(65000);
  const m = await mcpCalls(p);
  ok(m.length === 0, `${L}: MCP called with no click from him (${m}): that opens a consent prompt over the page`);
  ok(await p.isVisible("#wakeLine [data-wakenow]"), `${L}: a held wake has no "Wake now" button`);
  await p.click("#wakeLine [data-wakenow]", { timeout: 2000 }).catch(e => fails.push(`${L}: Wake now: ${e.message.split("\n")[0]}`)); await tick(2000);
  ok((await mcpCalls(p)).includes("fire_trigger"), `${L}: Wake now didn't wake the King`);
  ok(!errs.length, `${L}: page errors: ${errs.slice(0, 4).join(" | ")}`);
  await ctx.close();
}

async function scenarioMcpHang(browser, url) {
  const L = "mcp-hang";
  const { ctx, p, errs, tick } = await open(browser, url, { modes: { mcp: "hang" } });
  await sendChat(p, tick, "mcp hang test"); await tick(3000);
  ok((await writes(p)).some(x => /-you-k$/.test(x)), `${L}: chat message not saved`);
  ok(await probe(p) < 500, `${L}: main thread busy`);
  await p.click("#kFreshBtn", { timeout: 2000 }); await tick(200);
  await p.click('#kFresh [data-fk="yes"]', { timeout: 2000 }); await tick(1000);
  ok(await p.isHidden("#kFreshBtn"), `${L}: Fresh King didn't start`);
  await tick(200000);   // past every MCP deadline (90 s + the create_session wait)
  ok(await p.isVisible("#kFreshBtn"), `${L}: Fresh King stuck forever when MCP never answers`);
  ok(!/Sending|Thinking/i.test(await p.textContent("#ktLog .you:last-of-type .kt-st").catch(() => "")), `${L}: chat status stuck`);
  await p.click("#tab-log", { timeout: 2000 }).catch(e => fails.push(`${L}: tabs dead: ${e.message.split("\n")[0]}`));
  ok(!errs.length, `${L}: page errors: ${errs.slice(0, 4).join(" | ")}`);
  await ctx.close();
}

async function scenarioSampleHang(browser, url) {
  const L = "sample-hang";
  const { ctx, p, errs, tick } = await open(browser, url, { modes: { sample: "hang" } });
  await sendChat(p, tick, "sample hang test"); await tick(3000);
  ok(!(await mcpCalls(p)).includes("fire_trigger"), `${L}: (setup) King woken before the instant answer gave up`);
  await tick(125000);
  ok((await mcpCalls(p)).includes("fire_trigger"), `${L}: the King never got the message after the instant answer hung`);
  ok(!/Thinking/.test(await p.textContent("#ktLog")), `${L}: "Thinking" forever`);
  ok(!errs.length, `${L}: page errors: ${errs.slice(0, 4).join(" | ")}`);
  await ctx.close();
}

async function scenarioWriteHang(browser, url) {
  const L = "write-hang";
  const { ctx, p, errs, tick } = await open(browser, url, { modes: { dbw: "hang" } });
  await sendChat(p, tick, "write hang test"); await tick(11000);
  ok(await p.inputValue("#kcInput") === "write hang test", `${L}: the unsent message wasn't given back`);
  ok(await p.isVisible("#ktWait"), `${L}: no "failed" line`);
  ok(!errs.length, `${L}: page errors: ${errs.slice(0, 4).join(" | ")}`);
  await ctx.close();
}

async function scenarioSendFail(browser, url) {   // QA 2026-09-29: a failed send must give the buttons back
  const L = "send-fail";
  let r = await open(browser, url, { modes: { dbw: "fail" } });
  await r.p.click("#tab-board", { timeout: 2000 }); await r.tick(300);
  const ans = await r.p.$("#boardBody .ans [data-a]");
  if (ok(ans, `${L}: (setup) no open board question in the fixture`)) {
    const q = await ans.evaluate(b => b.closest(".ans").dataset.q);
    await ans.click({ timeout: 2000 }); await r.tick(3000);
    const dis = await r.p.$$eval("#boardBody .ans", (rows, q) => rows.filter(x => x.dataset.q === q).flatMap(x => [...x.querySelectorAll("button")]).some(b => b.disabled), q);
    ok(!dis, `${L}: a failed answer left its buttons disabled`);
  }
  ok(!r.errs.length, `${L}: page errors: ${r.errs.slice(0, 4).join(" | ")}`);
  await r.ctx.close();
  r = await open(browser, url, { modes: { mcp: "fail" } });
  await sendChat(r.p, r.tick, "retry test"); await r.tick(4000);
  const retry = await r.p.$("#ktLog [data-kt]");
  if (ok(retry, `${L}: a message the King didn't get has no Retry button`)) {
    await retry.click({ timeout: 2000 }); await r.tick(3000);
    ok(await r.p.$eval("#ktLog [data-kt]", b => !b.disabled).catch(() => false), `${L}: Retry stayed disabled after a retry that failed again`);
  }
  ok(!r.errs.length, `${L}: page errors: ${r.errs.slice(0, 4).join(" | ")}`);
  await r.ctx.close();
}

async function scenarioDegraded(browser, url, modes, label, expect) {
  const { ctx, p, errs, tick } = await open(browser, url, { modes, settle: 30000 });
  ok(await probe(p) < 500, `${label}: main thread busy`);
  for (const t of ["#tab-board", "#tab-log", "#tab-ops"]) {
    await p.click(t, { timeout: 2000 }).catch(e => fails.push(`${label}: ${t}: ${e.message.split("\n")[0]}`)); await tick(200);
    ok(await p.getAttribute(t, "aria-selected") === "true", `${label}: ${t} didn't select`);
  }
  if (expect) ok(expect.test(await p.textContent("#live")), `${label}: live line says "${(await p.textContent("#live")).trim()}"`);
  ok(!errs.length, `${label}: page errors: ${errs.slice(0, 4).join(" | ")}`);
  await ctx.close();
}

const SLOW_SCENE = `const busy = ms => { const t = performance.now(); while (performance.now() - t < ms) {} };
window.SCENE = {ready:true, anchors:{}, frame(){ busy(300); }, resize(){}, pick(){ return null; }, settle(){}, dragged:false, info:{}, perf:{}, shadowDirty(){}};`;
async function scenarioSlow3d(browser, url) {
  const L = "3d-slow";
  const { ctx, p, errs } = await open(browser, url, { hash: "#3d", scene: SLOW_SCENE, realClock: true, settle: 1000 });
  let off = false;
  for (let i = 0; i < 24 && !off; i++) { await p.waitForTimeout(1000); off = await p.evaluate(() => document.getElementById("app").classList.contains("no-gl")); }
  ok(off, `${L}: a ~3 fps 3D room never switched to the still view`);
  await p.waitForTimeout(1500);
  ok(await probe(p) < 300, `${L}: main thread still busy after the switch (the loop kept drawing)`);
  ok(await p.evaluate(() => !!localStorage.getItem("hub-3d-slow")), `${L}: the slow machine isn't remembered`);
  ok(!errs.length, `${L}: page errors: ${errs.slice(0, 4).join(" | ")}`);
  await ctx.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = loadPlaywright();
  const exe = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find(x => fs.existsSync(x));
  const browser = await chromium.launch({ executablePath: exe, headless: !HEADED, args: ["--no-sandbox"] });
  const url = await pageUrl("pages/crew-hq.html");
  const ONLY = process.argv.slice(2).filter(a => !a.startsWith("--"));   // e.g. node hub_live_check.js mcp-hang live
  const run = async (name, fn) => { if (ONLY.length && !ONLY.includes(name)) return; const t = Date.now(); try { await fn(); } catch (e) { fails.push(`${name}: crashed: ${e.message.split("\n")[0]}`); } notes.push(`${name}: ${((Date.now() - t) / 1000).toFixed(1)} s`); };
  try {
    await run("live", () => scenarioLive(browser, url, null, "live"));
    await run("phone", () => scenarioLive(browser, url, { width: 390, height: 844 }, "phone"));
    await run("quiet-load", () => scenarioQuiet(browser, url));
    await run("mcp-hang", () => scenarioMcpHang(browser, url));
    await run("sample-hang", () => scenarioSampleHang(browser, url));
    await run("write-hang", () => scenarioWriteHang(browser, url));
    await run("send-fail", () => scenarioSendFail(browser, url));
    await run("db-fail", () => scenarioDegraded(browser, url, { db: "fail" }, "db-fail", /reconnect/i));
    await run("no-db", () => scenarioDegraded(browser, url, { use_db: "null" }, "no-db", /isn.t available|not available/i));
    await run("user-hang", () => scenarioDegraded(browser, url, { use_user: "hang", use_sample: "hang", use_mcp: "hang" }, "user-hang"));
    await run("3d-slow", () => scenarioSlow3d(browser, url));
  } finally { await browser.close(); await closeServer(); }
  for (const x of notes) console.log(x);
  const real = fails.filter(Boolean);
  if (real.length) { console.log("\nFAIL (" + real.length + ")"); for (const f of real) console.log("  - " + f); process.exit(1); }
  console.log("\nPASS: hub live-data smoke test (11 scenarios)");
})();
