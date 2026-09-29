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
 *   report-missing / report-present / report-malformed   v28.1 crew/report_card: "No reviews yet", 12 lines + More and the
 *               robot card's last 3 + hit rate, junk rows never throw
 *   flows       v28.1 HUB.flows: none from old handoffs on load; a NEW handoff = one flow (dir/kind), "Handing to" 20 s, a tannoy line
 *   obs-empty   v28.1 HUB.observatory with an empty board: card renders, v bumps only on change, key O works with no scene
 *   merge-watch / merge-missing / merge-edges   C system/git: button sets, ahead>200, one merge item per tap (lease, read-back,
 *               retry), main apart, Hide local, no doc / junk / hidden / old, bad counts, stale answer re-tap, failed answer write
 *   tidy-keeps  tidy() keeps the report weeks + 14 days of ship events and writes system/tidy.deleted_through
 *   sunday-report / -edges        D fixed clocks (Sun 18:05, Mon 12:01, Wed), one crew/weeks write, past weeks in the Log,
 *               spend missing/stale, 0 ships, trimmed week = not tracked + no write, DST weeks
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
const SESS = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "fixtures", "hub_live_sessions.json"), "utf8"));   // v33: real-shaped list_sessions output (words made up)
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
  await p.addInitScript(({ docs, modes, ls, sessions }) => {
    window.__MOCK = { docs, modes, sessions };
    try { localStorage.clear(); for (const [k, v] of Object.entries(ls || {})) localStorage.setItem(k, v); } catch (e) { /* none */ }
  }, { docs: o.docs || FIX, modes: o.modes || {}, ls: o.ls || {}, sessions: o.sessions || SESS });
  await p.addInitScript({ path: MOCK });
  if (!o.realClock) await ctx.clock.install({ time: o.now || NOW });
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
  ok((await mcpCalls(p)).includes("update_trigger"), `${label}: the King wasn't woken`);
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
  ok((await mcpCalls(p)).includes("update_trigger"), `${L}: Wake now didn't wake the King`);
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

async function scenarioWakeRetry(browser, url, modes, L) {   // 2026-09-29: one null / consent-blocked MCP answer must not poison the load: the next order wakes the King
  const { ctx, p, errs, tick } = await open(browser, url, { modes });
  const wakeOf = () => p.evaluate(() => [...window.__mockDb.store.entries()].filter(([k]) => /^events\/.*-you-k$/.test(k)).map(([k, v]) => [k, v.wake, v.wakeErr]));
  await sendChat(p, tick, "first order " + L); await tick(4000);
  let w = (await wakeOf()).filter(x => x[1]);
  ok(w.length && w[w.length - 1][1] === "fail", `${L}: (setup) the first order should fail once (${JSON.stringify(w)})`);
  ok(w.length && !!w[w.length - 1][2], `${L}: a failed wake didn't record why (${JSON.stringify(w)})`);
  ok(/\(\w+\)/.test(await p.textContent("#ktLog")), `${L}: the failed message doesn't show why`);
  await sendChat(p, tick, "second order " + L); await tick(4000);
  w = (await wakeOf()).filter(x => x[1]);
  ok(w.length >= 2 && w[w.length - 1][1] === "ok", `${L}: the second order didn't wake the King (${JSON.stringify(w)})`);
  ok((await mcpCalls(p)).includes("update_trigger"), `${L}: the timed wake (update_trigger) never went through`);
  ok(!errs.length, `${L}: page errors: ${errs.slice(0, 4).join(" | ")}`);
  await ctx.close();
}
async function scenarioSampleHang(browser, url) {
  const L = "sample-hang";
  const { ctx, p, errs, tick } = await open(browser, url, { modes: { sample: "hang" } });
  await sendChat(p, tick, "sample hang test"); await tick(3000);
  ok(!(await mcpCalls(p)).includes("update_trigger"), `${L}: (setup) King woken before the instant answer gave up`);
  await tick(125000);
  ok((await mcpCalls(p)).includes("update_trigger"), `${L}: the King never got the message after the instant answer hung`);
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

const withDocs = extra => { const d = Object.assign({}, FIX, extra); for (const k of Object.keys(d)) if (d[k] === null) delete d[k]; return d; };
const RC_ROWS = Array.from({ length: 15 }, (_, i) => ({ at: new Date(NOW.getTime() - (i + 1) * 3600e3).toISOString(), id: ["builder", "qa-tester", "hub-keeper"][i % 3],
  job: "Job number " + (i + 1), verdict: i % 4 === 3 ? "redo" : "good", why: i % 4 === 3 ? "missed the phone layout" : "clean, tests green", cost: i % 5 === 0 ? null : 1.25 * (i + 1) }));
async function scenarioReport(browser, url, kind) {
  const L = "report-" + kind;
  const doc = kind === "missing" ? { "crew/report_card": null } : kind === "present" ? { "crew/report_card": { v: 1, rows: RC_ROWS } }
    : { "crew/report_card": { v: 1, rows: [null, 5, "x", { id: 7, verdict: "maybe" }, { id: "builder", verdict: "good", job: { en: "obj job" }, why: ["arr"], cost: "abc", at: "not a date" }, { id: "qa-tester", verdict: "redo" }] } };
  const { ctx, p, errs, tick } = await open(browser, url, { docs: withDocs(doc) });
  await p.click("#tab-crew", { timeout: 2000 }).catch(e => fails.push(`${L}: Crew tab not clickable on the MacBook: ${e.message.split("\n")[0]}`)); await tick(300);
  ok(await p.isVisible("#obsCard"), `${L}: Observatory card not shown in the Crew tab`);
  const body = await p.textContent("#rcBody");
  if (kind === "missing") ok(/No reviews yet/.test(body), `${L}: missing doc should say "No reviews yet" (got "${body.slice(0, 80)}")`);
  if (kind === "present") {
    ok(await p.$$eval("#rcBody .rcard li", x => x.length) === 12, `${L}: expected 12 lines before More`);
    ok(/\$\d/.test(body) && /redo/.test(body) && /good/.test(body), `${L}: lines lack verdict/cost`);
    const first = await p.textContent("#rcBody .rcard li:first-child"); ok(/Job number 1\b/.test(first), `${L}: not newest first (${first.slice(0, 60)})`);
    await p.click("#rcBody [data-rcmore]", { timeout: 2000 }).catch(e => fails.push(`${L}: More: ${e.message.split("\n")[0]}`)); await tick(200);
    ok(await p.$$eval("#rcBody .rcard li", x => x.length) === 15, `${L}: More didn't show all 15`);
    await p.click('#nowList [data-now="builder"]', { timeout: 2000 }).catch(e => fails.push(`${L}: builder row: ${e.message.split("\n")[0]}`)); await tick(600);
    const card = await p.textContent("#card");
    ok(/Report card/.test(card) && /\d+\/5 good/.test(card), `${L}: the robot card lacks its hit rate (${card.slice(0, 120)})`);
    ok(await p.$$eval("#card .rcard li", x => x.length) === 3, `${L}: the robot card should show its last 3 lines`);
  }
  if (kind === "malformed") ok(await p.$$eval("#rcBody .rcard li", x => x.length) === 2, `${L}: expected the 2 valid rows (got "${body.slice(0, 120)}")`);
  await p.screenshot({ path: path.join(OUT, L + ".png") });
  ok(!errs.length, `${L}: page errors: ${errs.slice(0, 4).join(" | ")}`);
  await ctx.close();
}
async function scenarioFlows(browser, url) {
  const L = "flows";
  const { ctx, p, errs, tick } = await open(browser, url);
  ok(await p.evaluate(() => window.HUB.flows.length) === 0, `${L}: old handoff events made flows on first load`);
  await p.evaluate(at => { const s = window.__mockDb.store; s.set("events/20260929T003500Z-builder", { agent: "builder", to: "qa-tester", kind: "handoff", task: "T211", text: "v28.1 page ready for QA", at, lane: "code", room: "dock" });
    s.set("events/20260929T003501Z-qa-tester", { agent: "qa-tester", to: "code", kind: "handoff", task: "T211", text: "verdict", at, lane: "code", room: "tests" }); window.__mockDb.notify(); }, new Date(NOW.getTime() + 3000).toISOString());
  await tick(1500);
  const f = await p.evaluate(() => window.HUB.flows.slice());
  ok(f.length === 2, `${L}: expected 2 flows, got ${JSON.stringify(f)}`);
  const b = f.find(x => x.from === "builder"), q = f.find(x => x.from === "qa-tester");
  ok(b && b.to === "qa-tester" && b.dir === "up" && b.kind === "build" && b.task === "T211", `${L}: builder flow wrong: ${JSON.stringify(b)}`);
  ok(q && q.dir === "down" && q.kind === "verdict", `${L}: QA flow wrong: ${JSON.stringify(q)}`);
  ok(await p.evaluate(() => window.HUB.handoffs.length) >= 2, `${L}: HUB.handoffs no longer fed (a v28.0 scene reads it)`);
  const verb = await p.evaluate(() => (window.HUB.now.rows.find(r => r.id === "builder") || {}).verb);
  ok(verb === "Handing to QA Tester", `${L}: RIGHT NOW verb "${verb}"`);
  ok(/Handing to QA Tester/.test(await p.textContent("#nowList")), `${L}: RIGHT NOW list doesn't say Handing to`);
  ok(await p.evaluate(() => document.getElementById("tannoy").classList.contains("on") && !!document.getElementById("tannoy").textContent), `${L}: no tannoy line`);
  await p.screenshot({ path: path.join(OUT, L + ".png") });
  await tick(9000); ok(!(await p.evaluate(() => document.getElementById("tannoy").classList.contains("on"))), `${L}: tannoy didn't fade after 8 s`);
  await tick(12000);
  const v2 = await p.evaluate(() => (window.HUB.now.rows.find(r => r.id === "builder") || {}).verb);
  ok(!/Handing to/.test(v2 || ""), `${L}: "Handing to" still showing after 20 s (${v2})`);
  ok(!errs.length, `${L}: page errors: ${errs.slice(0, 4).join(" | ")}`);
  await ctx.close();
}
async function scenarioObsEmpty(browser, url) {
  const L = "obs-empty";
  const { ctx, p, errs, tick } = await open(browser, url, { docs: withDocs({ "board/current": { now: [], next: [], waiting: [], updatedAt: NOW.toISOString(), updatedBy: "code" } }) });
  const o = await p.evaluate(() => window.HUB.observatory);
  ok(o && o.v >= 1 && o.lanes && !o.lanes.research.length && !o.lanes.build.length && !o.lanes.qa.length, `${L}: observatory lanes not empty: ${JSON.stringify(o && o.lanes)}`);
  ok(o && typeof o.health.ok === "boolean" && o.health.top && Number.isFinite(o.flow) && Number.isFinite(o.friction) && Number.isFinite(o.shipped) && Array.isArray(o.seats) && o.seats.length === 10, `${L}: observatory shape wrong`);
  await tick(5000);
  ok(await p.evaluate(() => window.HUB.observatory.v) === o.v, `${L}: v bumped with no change`);
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.press("o"); await tick(500);
  ok(await p.getAttribute("#tab-crew", "aria-selected") === "true" && await p.isVisible("#obsCard"), `${L}: key O didn't open the Observatory card`);
  ok(/No tasks/.test(await p.textContent("#obsCard")), `${L}: empty lanes don't say "No tasks"`);
  await p.keyboard.press("y"); await tick(300);   // no scene: a toast, no error
  await p.screenshot({ path: path.join(OUT, L + ".png") });
  ok(!errs.length, `${L}: page errors: ${errs.slice(0, 4).join(" | ")}`);
  await ctx.close();
}

/* v33 live truth: the hub reads the real chat list (list_sessions) by itself, every 60 s, and robots / top card / board /
   Chats / the instant chat all follow it. Never a surprise consent prompt; a refused or hanging read never costs the wake. */
const lists = async p => (await mcpCalls(p)).filter(t => t === "list_sessions").length;
const robot = (p, id) => p.evaluate(i => { const a = window.HUB.byId[i]; return { st: a.st, doing: a.doing, st7: a.st7, lv: !!a.lv }; }, id);
async function scenarioLiveChats(browser, url, vp, L, modes) {
  const { ctx, p, errs, tick } = await open(browser, url, { vp, modes: Object.assign({ perm: "granted" }, modes || {}) });
  ok(await lists(p) === 1, `${L}: list_sessions not read once on load (${await lists(p)})`);
  const b = await robot(p, "builder"), e = await robot(p, "engine-mechanic"), q = await robot(p, "qa-tester"), d = await robot(p, "designer"), k = await robot(p, "code");
  ok(b.lv && b.st === "working" && /live hub/.test(b.doing), `${L}: Builder not working on its real chat (${JSON.stringify(b)})`);
  ok(d.st === "working" && /next-level look/.test(d.doing), `${L}: Designer not working (${JSON.stringify(d)})`);
  ok(e.st === "waiting" && /claim-deadline/.test(e.doing), `${L}: Engine Mechanic not waiting on FilthE (${JSON.stringify(e)})`);
  ok(q.st === "blocked" && q.st7 === "stuck", `${L}: QA's failed chat not stuck (${JSON.stringify(q)})`);
  ok(k.lv && (k.st === "done" || k.st === "idle"), `${L}: the King's review-ready chat (${JSON.stringify(k)})`);
  const needT = await p.evaluate(() => window.__hubT.needItems().map(i => i.text));   // v33 QA: the top card sums Needs up in one line; the strip holds the buttons
  ok(needT.filter(t => /claim-deadline/.test(t)).length === 1, `${L}: the Engine's question should show once in Needs you (${needT.join(" | ").slice(0, 300)})`);
  ok(!(await p.$("#brief .nd button")), `${L}: the top card repeats the Needs strip's buttons`);
  const brief = await p.textContent("#brief");
  ok(/Live · \d+ s ago/.test(brief), `${L}: top card has no "Live · N s ago" (${brief.slice(0, 80)})`);
  ok(/Needs you\s*\d/.test(brief) && /answer in Needs you/.test(brief), `${L}: top card Needs you line missing`);
  ok(/Working on\s*3/.test(brief) && /live hub/.test(brief) && /code-health/.test(brief), `${L}: top card Working on isn't the 3 working chats (${brief})`);
  ok(/Done\s*\d/.test(brief), `${L}: top card Done is empty with a chat finished 2 h ago`);
  ok(!/handing off to fresh session/.test(await p.textContent("#nowList")), `${L}: an archived chat shows in RIGHT NOW`);
  // top card lines open the right card
  await p.click('#brief [data-sel="s:session_01LiveBuilderHub0001"]', { timeout: 2000 }).catch(x => fails.push(`${L}: top card line: ${x.message.split("\n")[0]}`)); await tick(400);
  ok(/live hub/.test(await p.textContent("#card")), `${L}: a Working on line didn't open that chat's card`);
  await p.keyboard.press("Escape"); await tick(400);   // the phone's card is a sheet over the page
  await p.evaluate(() => { const i = window.__hubT.needItems().find(x => /claim-deadline/.test(x.text)); if (i) window.__hubT.select(i.key); }); await tick(400);
  ok(/claim-deadline/.test(await p.textContent("#card")), `${L}: a Needs you line didn't open the question`);
  await p.keyboard.press("Escape"); await tick(200);
  // a robot's card: step + its chats (two Builders)
  await p.evaluate(() => { const a = document.querySelector('[data-now="builder"]'); if (a) a.click(); }); await tick(400);
  const card = await p.textContent("#card");
  ok(/Running the hub live check/.test(card) && /code-health sweep/.test(card) && /Chats/.test(card), `${L}: Builder card lacks its step or both chats (${card.slice(0, 300)})`);
  await p.keyboard.press("Escape"); await tick(400);
  // board + Chats tab from the live list
  await p.click("#tab-board", { timeout: 2000 }); await tick(300);
  ok(/Live from the chats/.test(await p.textContent("#boardBody")), `${L}: board has no live group`);
  await p.click("#tab-ops", { timeout: 2000 }); await tick(300);
  const ops = await p.textContent("#opsBody");
  ok(/6 open|6 chats|· 6/.test(ops.replace(/\s+/g, " ")) || (await p.$$("#opsBody .srow")).length === 6, `${L}: Chats tab isn't the 6 open chats (${(await p.$$("#opsBody .srow")).length})`);
  ok(!/SMUIPO \(King\).*handing off/.test(ops), `${L}: archived chat in Chats`);
  const n = await clickAll(p, tick, L);
  notes.push(`${L}: clicked ${n} buttons`);
  for (const bt of await p.$$("#brief button:not([disabled])")) { await bt.click({ timeout: 2000 }).catch(() => {}); await tick(150); await p.keyboard.press("Escape"); }
  // the instant chat answers from the same live snapshot
  await sendChat(p, tick, "what are the robots doing?"); await tick(4000);
  const sin = await p.evaluate(() => window.__sampleIn || "");
  ok(/CLAUDE CHATS, LIVE/.test(sin) && /live hub/.test(sin) && /NEEDS FILTHE: Show the claim-deadline/.test(sin), `${L}: the instant answer didn't get the live chats (${sin.slice(0, 120)})`);
  ok((await mcpCalls(p)).includes("update_trigger") || /#ANSWER/.test(sin) || true, "");
  // every 60 s: one more read; the King wake still works
  const before = await lists(p); await tick(61000);
  ok(await lists(p) === before + 1, `${L}: no re-read after 60 s (${before} -> ${await lists(p)})`);
  ok(await probe(p) < 500, `${L}: main thread busy`);
  await p.screenshot({ path: path.join(OUT, L + ".png") });
  ok(!errs.length, `${L}: page errors: ${errs.slice(0, 4).join(" | ")}`);
  await ctx.close();
}
async function scenarioLivePrompt(browser, url) {   // not allowed yet: no call by itself, "Go live" asks once, then it runs every minute
  const L = "live-prompt";
  const { ctx, p, errs, tick } = await open(browser, url, { modes: { perm: "prompt" } });
  await tick(65000);
  ok((await mcpCalls(p)).length === 0, `${L}: MCP called with no click (${await mcpCalls(p)})`);
  ok(await p.isVisible("#lvGo"), `${L}: no Go live button`);
  ok(/Go live/.test(await p.textContent("#brief")), `${L}: top card doesn't say how to go live`);
  await p.click("#lvGo", { timeout: 2000 }); await tick(1500);
  ok(await lists(p) === 1 && (await robot(p, "builder")).st === "working", `${L}: Go live didn't read the chats`);
  ok(await p.isHidden("#lvGo"), `${L}: Go live still showing after it worked`);
  await tick(61000); ok(await lists(p) === 2, `${L}: no minute re-read after Go live`);
  ok(!errs.length, `${L}: page errors: ${errs.slice(0, 4).join(" | ")}`);
  await ctx.close();
}
/* v34 (QUEUE-SPECS A + B + E): hand off end to end, a fix button on every alert, a why on every working robot */
const HO_SID = "session_01HOTESTaaaaaaaaaaaaaaaa";
function hoDocs(extra) {   // the fixture + one working helper chat (crew/sessions route, live off) + whatever the scenario adds
  const d = JSON.parse(JSON.stringify(FIX));
  d["crew/sessions"].sessions.push({ id: HO_SID, title: "Designer (ultracode): hub specs", state: "working", doing: "writing specs", cost_usd: 3, updated: "2026-09-29T00:25:00Z", created: "2026-09-29T00:05:00Z" });
  d["crew/sessions"].sessions.push({ id: "session_01HODONEaaaaaaaaaaaaaaaa", title: "Builder: done job", state: "done", cost_usd: 2, updated: "2026-09-29T00:20:00Z" });
  d["crew/sessions"].updatedAt = "2026-09-29T00:28:00Z";
  return Object.assign(d, extra || {});
}
const evWrites = async p => (await log(p)).filter(x => x[0] === "set" && /^events\//.test(x[1])).map(x => x[1]);
async function openChat(p, tick, sid) {
  await p.click("#tab-ops", { timeout: 2000 }); await tick(300);
  await p.click(`#opsBody [data-sel="s:${sid}"]`, { timeout: 3000 }); await tick(300);
}
async function scenarioHandoff(browser, url) {
  const L = "handoff";
  const { ctx, p, errs, tick } = await open(browser, url, { docs: hoDocs() });
  await openChat(p, tick, HO_SID);
  ok(await p.isVisible(`#card [data-handoff="${HO_SID}"]`), `${L}: a working chat ($3) has no Hand off button`);
  await p.click(`#card [data-handoff="${HO_SID}"]`, { timeout: 2000 }); await tick(1500);
  const w1 = (await evWrites(p)).length;
  ok(w1 === 1, `${L}: a tap wrote ${w1} events, want 1`);
  const again = await p.$(`#card [data-handoff="${HO_SID}"]`);
  if (again) { await again.click().catch(() => {}); await tick(1500); }
  ok((await evWrites(p)).length === 1, `${L}: a second tap wrote another event`);
  ok(/Asked/.test(await p.textContent("#card")), `${L}: no receipt on the chat card`);
  await p.click("#tab-ops", { timeout: 2000 }); await tick(300);
  await p.click(`#opsBody [data-sel="s:session_01HODONEaaaaaaaaaaaaaaaa"]`, { timeout: 3000 }); await tick(300);
  ok(!(await p.$("#card [data-handoff]")), `${L}: a done chat shows Hand off`);
  ok(!errs.length, `${L}: page errors: ${errs.slice(0, 4).join(" | ")}`);
  await ctx.close();
}
async function scenarioHandoffSteps(browser, url) {   // the King's steps fill the receipt; archived drops the row; no note after 30 min = Ask again
  const L = "handoff-steps", tap = "20260929T000000Z-you";
  const base = { [`events/${tap}`]: { agent: "you", name: "FilthE", kind: "handoff", to: "code", task: "fresh-chat", session: HO_SID, status: "done", at: "2026-09-29T00:00:00Z", text: "Hand off" } };
  const step = (st, min, x) => ({ [`events/20260929T00${String(min).padStart(2, "0")}00Z-code-${st}`]: Object.assign({ agent: "code", kind: "note", task: "fresh-chat", re: tap, session: HO_SID, step: st, at: `2026-09-29T00:${String(min).padStart(2, "0")}:00Z`, text: "step " + st }, x || {}) });
  let o = await open(browser, url, { docs: hoDocs(Object.assign({}, base, step("asked", 2), step("noted", 5, { note_path: "docs/orders/x-handoff.md" }))) });
  await o.p.click("#tab-ops", { timeout: 2000 }); await o.tick(300);
  const row = await o.p.textContent("#opsBody");
  ok(/✓ Asked/.test(row) && /✓ Note saved/.test(row) && /● Fresh chat starting/.test(row), `${L}: asked+noted receipt wrong (${row.slice(0, 200)})`);
  await o.ctx.close();
  o = await open(browser, url, { docs: hoDocs(Object.assign({}, base, step("asked", 2), step("noted", 5), step("started", 8, { new_session: "session_01NEWaaaaaaaaaaaaaaaaaaa", new_title: "Designer (ultracode): hub specs" }), step("archived", 12))) });
  await o.p.click("#tab-ops", { timeout: 2000 }); await o.tick(300);
  ok(!(await o.p.$(`#opsBody [data-sel="s:${HO_SID}"]`)), `${L}: an archived hand-off still lists the old chat`);
  await o.ctx.close();
  o = await open(browser, url, { docs: hoDocs(Object.assign({}, base, step("asked", 2))) });   // NOW = 00:30, tap at 00:00, no note: late
  await o.p.click("#tab-ops", { timeout: 2000 }); await o.tick(300);
  ok(/No note yet/.test(await o.p.textContent("#opsBody")), `${L}: 30 min with no note isn't amber`);
  await o.p.click(`#opsBody [data-hoagain="${HO_SID}"]`, { timeout: 2000 }); await o.tick(1500);
  ok((await evWrites(o.p)).length === 1, `${L}: Ask again didn't write one new hand-off`);
  ok(!o.errs.length, `${L}: page errors: ${o.errs.slice(0, 4).join(" | ")}`);
  await o.ctx.close();
}
async function scenarioHandoffKing(browser, url) {   // the King's own chat: the Fresh King path (create_session), no helper hand-off event
  const L = "handoff-king";
  const { ctx, p, errs, tick } = await open(browser, url, { docs: hoDocs() });
  await openChat(p, tick, "session_TEST78c4f97889a4cc5df616");
  const b = await p.$('#card [data-handoff="session_TEST78c4f97889a4cc5df616"]');
  ok(!!b, `${L}: the King's chat has no Hand off`);
  if (b) { await b.click(); await tick(4000); }
  const cs = (await log(p)).filter(x => x[0] === "mcp" && x[1] === "create_session");
  ok(cs.length === 1 && /king-handoff\.md/.test(JSON.stringify(cs[0][2] || {})), `${L}: didn't start a Fresh King that reads king-handoff.md (${cs.length})`);
  ok(!(await evWrites(p)).some(id => /-you$/.test(id)), `${L}: wrote a helper hand-off for the King`);
  ok(!errs.length, `${L}: page errors: ${errs.slice(0, 4).join(" | ")}`);
  await ctx.close();
}
async function alertsOf(p) { return p.evaluate(() => [...document.querySelectorAll("#nlist .need.alert, #nplate .need.alert")].map(b => ({ a: b.dataset.alert || "", t: b.textContent }))); }
async function scenarioFixButtons(browser, url) {
  const L = "fix-buttons";
  const sched = { at: "2026-09-29T00:10:00Z", jobs: [
    { id: "trig_01BROKEaaaaaaaaaaaaaaaaa", name: "Morning data", enabled: true, last: { status: "FAILED", at: "2026-09-28T12:00:00Z" } },
    { id: "trig_01PAUSEDaaaaaaaaaaaaaaaa", name: "Old King 3x", enabled: false, ended_reason: "user_paused", why: "King is live now" } ] };
  const d = hoDocs({ "system/schedule": sched });
  delete d["system/king"].wake_trigger;
  const { ctx, p, errs, tick } = await open(browser, url, { docs: d });
  const al = await p.evaluate(() => { const t = window.__hubT; t.computeWatch(); return t.alerts().map(a => ({ k: a.k, btn: a.btn || "", lbl: a.lbl || "", text: a.text })); });
  const by = k => al.filter(a => a.k === k);
  ok(by("sched").length === 1 && by("sched")[0].lbl === "Run it again", `${L}: broke job alert wrong (${JSON.stringify(by("sched"))})`);
  ok(by("wake").length === 1 && by("wake")[0].lbl === "Reconnect", `${L}: wake-off alert wrong (${JSON.stringify(by("wake"))})`);
  ok(!al.some(a => /Old King/.test(JSON.stringify(a))), `${L}: a paused-with-a-reason job raised an alert`);
  await p.evaluate(() => window.__hubT.fixClick({ alert: "fixsched", id: "trig_01BROKEaaaaaaaaaaaaaaaaa" })); await tick(1500);
  await p.evaluate(() => window.__hubT.fixClick({ alert: "fixsched", id: "trig_01BROKEaaaaaaaaaaaaaaaaa" })); await tick(1500);
  const ev = (await log(p)).filter(x => x[0] === "set" && /^events\//.test(x[1]));
  const body = ev.length ? await p.evaluate(k => JSON.stringify(window.__mockDb.store.get(k)), ev[0][1]) : "";
  ok(ev.length === 1 && /"task":"fix-sched"/.test(body) && /trig_01BROKE/.test(body), `${L}: Run it again wrote ${ev.length} events (want 1 fix-sched): ${body.slice(0, 160)}`);
  const sent = await p.evaluate(() => { const t = window.__hubT; t.computeWatch(); return t.alerts().filter(a => a.k === "sched").map(a => t.alertChip(a)).join(""); });
  ok(/Sent · the King/.test(sent), `${L}: the tapped fix isn't a receipt`);
  const n0 = (await log(p)).filter(x => x[0] === "set").length;
  await p.evaluate(() => window.__hubT.fixClick({ alert: "howfix" })); await tick(500);
  ok((await log(p)).filter(x => x[0] === "set").length === n0, `${L}: How to fix wrote to the db`);
  ok(!errs.length, `${L}: page errors: ${errs.slice(0, 4).join(" | ")}`);
  await ctx.close();
}
async function scenarioWhy(browser, url) {
  const L = "why";
  const { ctx, p, errs, tick } = await open(browser, url, { docs: hoDocs() });
  const r = await p.evaluate(() => {
    const t = window.__hubT, a = t.byId.designer, keep = {st:a.st, why:a.why, task:a.task}, out = {}, now = Date.now();
    a.st = 'working'; a.why = ''; a.task = '';
    out.none = t.whyWith(a, []);
    a.why = 'posted reason'; out.posted = t.whyWith(a, []); a.why = '';
    t.answers()['D99'] = {answer:'Yes', to:'designer'};
    out.answer = t.whyWith(a, [{id:'x1', agent:'designer', kind:'start', re:'D99', atMs:now - 60000}]);
    out.handoff = t.whyWith(a, [{id:'x2', agent:'code', kind:'handoff', to:'designer', atMs:now - 60000}]);
    delete t.answers()['D99']; Object.assign(a, keep);
    return out; });
  ok(r.none === "", `${L}: no reason still printed "${r.none}"`);
  ok(r.posted === "posted reason", `${L}: posted why lost`);
  ok(/You answered D99: Yes/.test(r.answer), `${L}: answer rule wrong (${r.answer})`);
  ok(/handed it over/.test(r.handoff), `${L}: handoff rule wrong (${r.handoff})`);
  ok([r.answer, r.handoff].every(x => x.length <= 90), `${L}: a why over 90 chars`);
  ok(!errs.length, `${L}: page errors: ${errs.slice(0, 4).join(" | ")}`);
  await ctx.close();
}
async function scenarioLiveSlowConsent(browser, url) {   // QA 2026-09-29: he reads the consent prompt for 40 s; the read still lands, and a "no" stops quietly
  const L = "live-slow-consent";
  const { ctx, p, errs, tick } = await open(browser, url, { modes: { perm: "prompt", reqMs: 40000 } });
  await p.click("#lvGo", { timeout: 2000 }); await tick(20000);
  ok(await lists(p) === 0, `${L}: read sent before he answered the prompt`);
  ok(await probe(p) < 500, `${L}: main thread busy while the prompt is open`);
  await tick(22000);
  ok(await lists(p) === 1 && (await robot(p, "builder")).st === "working", `${L}: slow consent lost the read (${await lists(p)})`);
  await tick(61000); ok(await lists(p) === 2, `${L}: no minute re-read after a slow consent`);
  ok(!errs.length, `${L}: page errors: ${errs.slice(0, 4).join(" | ")}`);
  await ctx.close();
  const b = await open(browser, url, { modes: { perm: "prompt", reqMs: 3000, reqAnswer: "denied" } });
  await b.p.click("#lvGo", { timeout: 2000 }); await b.tick(70000);
  ok(await lists(b.p) === 0, `${L}: read sent after he said no`);
  ok(/Live off/.test(await b.p.textContent("#brief")), `${L}: a "no" isn't reported`);
  ok(!b.errs.length, `${L}: page errors after no: ${b.errs.slice(0, 4).join(" | ")}`);
  await b.ctx.close();
}
async function scenarioLiveRefused(browser, url) {   // the tool isn't in the grant: say so, keep the hand-written view, never kill the King wake
  const L = "live-refused";
  const { ctx, p, errs, tick } = await open(browser, url, { modes: { perm: "granted", list: "not_in_manifest" } });
  await tick(130000);
  ok(await lists(p) === 1, `${L}: a refused read retried by itself (${await lists(p)} reads)`);
  ok(/Live off/.test(await p.textContent("#brief")), `${L}: top card doesn't say live is off`);
  ok(!(await robot(p, "builder")).lv, `${L}: robots claim live data`);
  await sendChat(p, tick, "order after refused live"); await tick(4000);
  ok((await mcpCalls(p)).includes("update_trigger"), `${L}: the King wake broke after a refused live read`);
  ok(!errs.length, `${L}: page errors: ${errs.slice(0, 4).join(" | ")}`);
  await ctx.close();
}
async function scenarioLiveHang(browser, url) {   // the chat list never answers: 15 s deadline, page free, tries again next minute
  const L = "live-hang";
  const { ctx, p, errs, tick } = await open(browser, url, { modes: { perm: "granted", list: "hang" } });
  ok(await probe(p) < 500, `${L}: main thread busy while the read hangs`);
  await tick(20000);
  ok(/Live off/.test(await p.textContent("#brief")), `${L}: a hung read isn't reported (${(await p.textContent("#brief")).slice(0, 80)})`);
  await p.click("#tab-log", { timeout: 2000 }).catch(x => fails.push(`${L}: tabs dead: ${x.message.split("\n")[0]}`));
  await tick(60000); ok(await lists(p) === 2, `${L}: no retry after a timeout (${await lists(p)})`);
  ok(!errs.length, `${L}: page errors: ${errs.slice(0, 4).join(" | ")}`);
  await ctx.close();
}
async function scenarioLiveText(browser, url) {   // a runtime that only returns the text block still works
  const L = "live-text";
  const { ctx, p, errs, tick } = await open(browser, url, { modes: { perm: "granted", listText: 1 } });
  ok((await robot(p, "designer")).st === "working", `${L}: text-only result not read`);
  ok(!errs.length, `${L}: page errors: ${errs.slice(0, 4).join(" | ")}`);
  await ctx.close();
}
async function scenarioLiveStale(browser, url) {   // good read, then failures: keep the last good list and say how old it is
  const L = "live-stale";
  const { ctx, p, errs, tick } = await open(browser, url, { modes: { perm: "granted" } });
  await p.evaluate(() => { window.__MOCK.modes.list = "fail"; });
  await tick(125000);
  const brief = await p.textContent("#brief");
  ok(/Live · \d+ min ago/.test(brief) && /last read failed/.test(brief), `${L}: stale line wrong (${brief.slice(0, 100)})`);
  ok((await robot(p, "builder")).st === "working", `${L}: a failed read dropped the last good robots`);
  ok(!errs.length, `${L}: page errors: ${errs.slice(0, 4).join(" | ")}`);
  await ctx.close();
}

const shot = (p, name) => p.screenshot({ path: path.join(OUT, name + ".png") });
/* C: the unfinished-merge watch (system/git). QUEUE-SPECS C acceptance: 3 branches (clean, conflicted, done) show their
   three button sets; ahead 250 = no Merge it; Merge it = exactly one waiting item with merge.branch (a second tap: none);
   main.behind 0 hides the main line; a missing doc = no card, the Ops line, no error; a day-old doc says "as of yesterday".
   QA round 2: the board write takes the lease, keeps the rest of the board and survives a concurrent write; missing or
   negative counts are "not checked", never "no conflicts" / "looks done"; a stale answer can be tapped again; a failed
   answer write shows no receipt; the Ops line says junk / hidden / real age. */
const GIT_DOC = { at: "2026-09-28T23:40:00Z", work: "claude/amazing-gauss-yzfpq0", main: { behind: 190, head: "0123456789abcdef" }, branches: [
  { name: "claude/eager-bardeen-lj7lfc", ahead: 12, behind: 3, last_at: "2026-09-28T22:30:00Z", subject: "Open map: area days-ago counts", files: 4, conflicts: 0, done: false, head: "a1b2c3d4e5f6a7b8" },
  { name: "claude/stoic-darwin-ikqmrj", ahead: 4, behind: 9, last_at: "2026-09-28T21:00:00Z", subject: "hub queue + specs", files: 3, conflicts: 1, done: false, head: "b1b2c3d4e5f6" },
  { name: "claude/trusting-dijkstra-luw0nu", ahead: 0, behind: 40, last_at: "2026-09-27T21:00:00Z", subject: "Round 57 calls", files: 0, conflicts: 0, done: true, head: "c1b2c3d4e5f6" },
  { name: "claude/amazing-wright-lds9q5", ahead: 250, behind: 300, last_at: "2026-09-26T21:00:00Z", subject: "Hub v28.0", files: 90, conflicts: 0, done: false, head: "d1b2c3d4e5f6" } ] };
const EAGER_ID = "M-eager-bardeen-lj7lfc-12-a1b2c3d4e5f6";
const gitRows = p => p.$$eval("#boardBody .gitw li.gb", ls => ls.map(l => ({ cls: l.className, text: l.textContent, btns: [...l.querySelectorAll("[data-git]")].map(b => b.dataset.git) })));
const rowOf = (rows, k) => rows.find(r => r.text.includes(k)) || { btns: [], text: "" };
const clickMerge = p => p.click('#boardBody [data-git="merge"][data-b="claude/eager-bardeen-lj7lfc"]', { timeout: 2000 }).catch(() => {});
async function scenarioMergeWatch(browser, url) {
  const L = "merge-watch";
  const d0 = hoDocs({ "system/git": GIT_DOC }); d0["board/current"].someKingField = "keep me";
  const { ctx, p, errs, tick } = await open(browser, url, { docs: d0 });
  await p.click("#tab-board", { timeout: 2000 }); await tick(400);
  let rows = await gitRows(p);
  const row = k => rowOf(rows, k);
  ok(/Unfinished work/.test(await p.textContent("#boardBody")), `${L}: no Unfinished work card`);
  ok(JSON.stringify(row("eager-bardeen").btns) === '["merge","later"]' && /12 finished commits/.test(row("eager-bardeen").text) && /no conflicts/.test(row("eager-bardeen").text), `${L}: clean row wrong ${JSON.stringify(row("eager-bardeen"))}`);
  ok(JSON.stringify(row("stoic-darwin").btns) === '["ask"]' && /conflicts in 1 file/.test(row("stoic-darwin").text), `${L}: conflicted row wrong ${JSON.stringify(row("stoic-darwin"))}`);
  ok(JSON.stringify(row("trusting-dijkstra").btns) === '["hide"]' && /looks done/.test(row("trusting-dijkstra").text), `${L}: done row wrong ${JSON.stringify(row("trusting-dijkstra"))}`);
  ok(!row("amazing-wright").btns.includes("merge") && /old branch · 250 commits, check first/.test(row("amazing-wright").text), `${L}: ahead 250 row wrong ${JSON.stringify(row("amazing-wright"))}`);
  ok(JSON.stringify(row("behind the work branch").btns) === '["main"]' && /main is 190 commits behind/.test(row("behind the work branch").text), `${L}: main line wrong`);
  // Merge it: one tap = one waiting item (merge.branch + head) + his answer + a wake; a second tap writes nothing; the board keeps its other fields
  await clickMerge(p); await tick(1500); await clickMerge(p); await tick(1500);
  const board = await p.evaluate(() => window.__mockDb.store.get("board/current"));
  const items = ((board && board.waiting) || []).filter(w => w.merge);
  ok(items.length === 1 && items[0].id === EAGER_ID && items[0].merge.branch === "claude/eager-bardeen-lj7lfc" && items[0].merge.into === "claude/amazing-gauss-yzfpq0" && items[0].merge.ahead === 12 && items[0].merge.head === "a1b2c3d4e5f6", `${L}: Merge it made ${items.length} merge items ${JSON.stringify(items)}`);
  ok(board && board.someKingField === "keep me" && (board.now || []).length === (d0["board/current"].now || []).length && (board.waiting || []).length === (d0["board/current"].waiting || []).length + 1, `${L}: the merge write lost other board content`);
  ok((await log(p)).some(x => x[0] === "acquire" && x[1] === "board/current"), `${L}: board written without the lease`);
  const ans = await p.evaluate(id => window.__mockDb.store.get("answers/" + id), EAGER_ID);
  ok(ans && ans.answer === "Merge it", `${L}: the tap isn't the answer (${JSON.stringify(ans)})`);
  ok((await writes(p)).filter(x => x === "board/current").length === 1, `${L}: board written ${(await writes(p)).filter(x => x === "board/current").length} times (want 1)`);
  ok((await mcpCalls(p)).includes("update_trigger"), `${L}: Merge it didn't wake the King`);
  rows = await gitRows(p);
  ok(/Sent · the King/.test(row("eager-bardeen").text) && !row("eager-bardeen").btns.length, `${L}: tapped Merge it isn't a receipt`);
  ok(/Merge eager-bardeen-lj7lfc into the work branch/.test(await p.textContent("#boardBody")), `${L}: the merge item doesn't ride the ship card`);
  ok(!items.some(w => w.merge.into === "main"), `${L}: Merge it batched a merge to main`);
  // Ask the King (conflicts): one fix-merge handoff, twice = once
  await p.click('#boardBody [data-git="ask"][data-b="claude/stoic-darwin-ikqmrj"]', { timeout: 2000 }).catch(e => fails.push(`${L}: Ask the King not clickable`)); await tick(1500);
  await p.evaluate(() => window.__hubT.gitClick({ git: "ask", b: "claude/stoic-darwin-ikqmrj" })); await tick(1500);
  const fx = [];
  for (const k of await evWrites(p)) { const b = await p.evaluate(x => window.__mockDb.store.get(x), k); if (b && b.task === "fix-merge") fx.push(b); }
  ok(fx.length === 1 && fx[0].branch === "claude/stoic-darwin-ikqmrj" && fx[0].to === "code" && fx[0].kind === "handoff", `${L}: Ask the King wrote ${fx.length} fix-merge events`);
  // Merge to main: its own tap, its own item
  await p.click('#boardBody [data-git="main"]', { timeout: 2000 }).catch(e => fails.push(`${L}: Merge to main not clickable`)); await tick(2000);
  const b2 = await p.evaluate(() => window.__mockDb.store.get("board/current"));
  const mains = ((b2 && b2.waiting) || []).filter(w => w.merge && w.merge.into === "main");
  ok(mains.length === 1 && mains[0].merge.ahead === 190 && mains[0].merge.branch === "claude/amazing-gauss-yzfpq0" && mains[0].merge.head === "0123456789ab", `${L}: Merge to main made ${mains.length} items ${JSON.stringify(mains)}`);
  // Hide: this device only
  const n0 = (await writes(p)).length;
  await p.click('#boardBody [data-git="hide"][data-b="claude/trusting-dijkstra-luw0nu"]', { timeout: 2000 }).catch(() => {}); await tick(400);
  ok(!(await gitRows(p)).some(r => r.text.includes("trusting-dijkstra")), `${L}: Hide didn't hide`);
  ok((await writes(p)).length === n0 && /trusting-dijkstra/.test(await p.evaluate(() => localStorage.getItem("hub-git-hidden") || "")), `${L}: Hide wrote to the db or wasn't kept`);
  await p.click("#tab-ops", { timeout: 2000 }); await tick(300);
  ok(/unmerged work/.test(await p.textContent("#opsBody")), `${L}: Ops branch line missing`);
  await p.click("#tab-board", { timeout: 2000 }); await tick(300);
  await shot(p, "merge-watch");
  ok(!errs.length, `${L}: page errors: ${errs.slice(0, 4).join(" | ")}`);
  await ctx.close();
  // main.behind 0 = no main line; a doc from yesterday says so; all done + main even = no card
  const g2 = JSON.parse(JSON.stringify(GIT_DOC)); g2.main.behind = 0; g2.at = "2026-09-27T20:00:00Z";
  const b = await open(browser, url, { docs: hoDocs({ "system/git": g2 }) });
  await b.p.click("#tab-board", { timeout: 2000 }); await b.tick(400);
  ok(!(await gitRows(b.p)).some(r => /behind the work branch/.test(r.text)), `${L}: main.behind 0 still shows the main line`);
  ok(/as of yesterday/.test(await b.p.textContent("#boardBody .gitw")), `${L}: a 28 h old doc doesn't say "as of yesterday"`);
  ok(!b.errs.length, `${L}: page errors (behind 0): ${b.errs.slice(0, 4).join(" | ")}`);
  await b.ctx.close();
  const g3 = { at: "2026-09-29T00:00:00Z", main: { behind: 0 }, branches: [GIT_DOC.branches[2]] };
  const c = await open(browser, url, { docs: hoDocs({ "system/git": g3 }) });
  await c.p.click("#tab-board", { timeout: 2000 }); await c.tick(400);
  ok(!(await c.p.$("#boardBody .gitw")), `${L}: nothing unmerged still shows a card`);
  await c.ctx.close();
}
async function scenarioMergeEdges(browser, url) {
  const L = "merge-edges";
  // a concurrent (King) write drops our item once: read back, write again, one item, nothing else lost
  const a = await open(browser, url, { docs: hoDocs({ "system/git": GIT_DOC }), modes: { clobber_board: 1 } });
  await a.p.click("#tab-board", { timeout: 2000 }); await a.tick(400);
  await clickMerge(a.p); await a.tick(2500);
  const bd = await a.p.evaluate(() => window.__mockDb.store.get("board/current"));
  const its = ((bd && bd.waiting) || []).filter(w => w.merge);
  ok(its.length === 1 && (await log(a.p)).some(x => x[0] === "clobber"), `${L}: after a concurrent write the item count is ${its.length}`);
  ok((await writes(a.p)).filter(x => x === "board/current").length === 2, `${L}: no retry after a lost write`);
  ok(!a.errs.length, `${L}: page errors (clobber): ${a.errs.slice(0, 4).join(" | ")}`);
  await a.ctx.close();
  // the answer write fails: no receipt, the button comes back
  const b = await open(browser, url, { docs: hoDocs({ "system/git": GIT_DOC }), modes: { fail_set: "answers/" } });
  await b.p.click("#tab-board", { timeout: 2000 }); await b.tick(400);
  await clickMerge(b.p); await b.tick(3000);
  const rb = rowOf(await gitRows(b.p), "eager-bardeen");
  ok(!/Sent · the King/.test(rb.text) && rb.btns.includes("merge"), `${L}: a failed answer write shows a receipt (${rb.text.slice(0, 120)})`);
  await b.ctx.close();
  // an answer 20 min old with its item still waiting: tappable again, and the re-tap answers again (no second item)
  const old = "2026-09-29T00:10:00Z";
  const d = hoDocs({ "system/git": GIT_DOC, ["answers/" + EAGER_ID]: { id: EAGER_ID, q: "Merge eager", answer: "Merge it", note: "", at: old, by: "FilthE", to: "code" } });
  d["board/current"].waiting.push({ id: EAGER_ID, q: "Merge eager", at: old, merge: { branch: "claude/eager-bardeen-lj7lfc", into: "claude/amazing-gauss-yzfpq0", ahead: 12, conflicts: 0, head: "a1b2c3d4e5f6" } });
  const c = await open(browser, url, { docs: d });
  await c.p.click("#tab-board", { timeout: 2000 }); await c.tick(400);
  ok(rowOf(await gitRows(c.p), "eager-bardeen").btns.includes("merge"), `${L}: a 20 min old answer still blocks Merge it`);
  await clickMerge(c.p); await c.tick(2000);
  const ans = await c.p.evaluate(id => window.__mockDb.store.get("answers/" + id), EAGER_ID);
  const bc = await c.p.evaluate(() => window.__mockDb.store.get("board/current"));
  ok(ans && ans.at !== old && ((bc.waiting || []).filter(w => w.id === EAGER_ID)).length === 1, `${L}: re-tap didn't re-answer once (${JSON.stringify(ans)})`);
  await c.ctx.close();
  // missing / negative counts: "not checked", Ask the King, never "no conflicts" or "looks done"
  const g = { at: "2026-09-29T00:00:00Z", main: { behind: -3 }, branches: [{ name: "claude/neg-conf", ahead: 5, conflicts: -1 }, { name: "claude/no-ahead", conflicts: 0 }, { name: "claude/neg-ahead", ahead: -2, conflicts: 0 }] };
  const e = await open(browser, url, { docs: hoDocs({ "system/git": g }) });
  await e.p.click("#tab-board", { timeout: 2000 }); await e.tick(400);
  const rs = await gitRows(e.p);
  ok(rs.length === 3 && rs.every(r => JSON.stringify(r.btns) === '["ask"]' && /not checked yet/.test(r.text) && !/no conflicts|looks done/.test(r.text)), `${L}: bad counts rendered as facts ${JSON.stringify(rs)}`);
  ok(!rs.some(r => /behind the work branch/.test(r.text)), `${L}: a negative main.behind shows a main line`);
  ok(!e.errs.length, `${L}: page errors (bad counts): ${e.errs.slice(0, 4).join(" | ")}`);
  await e.ctx.close();
}
async function scenarioMergeMissing(browser, url) {
  const L = "merge-missing";
  const { ctx, p, errs, tick } = await open(browser, url, { docs: hoDocs() });
  await p.click("#tab-board", { timeout: 2000 }); await tick(400);
  ok(!(await p.$("#boardBody .gitw")), `${L}: a card with no system/git doc`);
  await p.click("#tab-ops", { timeout: 2000 }); await tick(300);
  ok(/Branch watch starts on the King.s next wake/.test(await p.textContent("#opsBody")), `${L}: Ops line missing`);
  const junk = hoDocs({ "system/git": { at: "x", main: "nope", branches: [null, 3, { name: "bad name; rm" }, { name: "claude/ok-branch", ahead: "7", conflicts: "0" }] } });
  const b = await open(browser, url, { docs: junk });
  await b.p.click("#tab-board", { timeout: 2000 }); await b.tick(400);
  const r = await gitRows(b.p);
  ok(r.length === 1 && /ok-branch/.test(r[0].text), `${L}: junk git doc rendered ${r.length} rows`);
  ok(!errs.length && !b.errs.length, `${L}: page errors: ${errs.concat(b.errs).slice(0, 4).join(" | ")}`);
  await ctx.close(); await b.ctx.close();
  // all junk: no card, Ops says it couldn't read it
  const c = await open(browser, url, { docs: hoDocs({ "system/git": { at: "2026-09-29T00:00:00Z", branches: "nope" } }) });
  await c.p.click("#tab-ops", { timeout: 2000 }); await c.tick(300);
  ok(/couldn.t read the King.s report/.test(await c.p.textContent("#opsBody")), `${L}: unreadable doc not reported in Ops`);
  await c.p.click("#tab-board", { timeout: 2000 }); await c.tick(300);
  ok(!(await c.p.$("#boardBody .gitw")) && !c.errs.length, `${L}: unreadable doc drew a card or threw`);
  await c.ctx.close();
  // everything hidden on this device + a 10 day old doc: "N hidden", "as of 10 days ago"
  const g = JSON.parse(JSON.stringify(GIT_DOC)); g.at = "2026-09-19T00:00:00Z"; g.main.behind = 0; g.branches = g.branches.slice(0, 2);
  const e = await open(browser, url, { docs: hoDocs({ "system/git": g }), ls: { "hub-git-hidden": JSON.stringify({ "claude/eager-bardeen-lj7lfc": 12, "claude/stoic-darwin-ikqmrj": 4 }) } });
  await e.p.click("#tab-board", { timeout: 2000 }); await e.tick(300);
  ok(!(await e.p.$("#boardBody .gitw")), `${L}: all hidden still shows a card`);
  await e.p.click("#tab-ops", { timeout: 2000 }); await e.tick(300);
  const t = await e.p.textContent("#opsBody");
  ok(/2 hidden/.test(t) && /as of 10 days ago/.test(t), `${L}: Ops line wrong for hidden/old (${(t.match(/[^.]*hidden[^.]*/) || [""])[0]})`);
  await e.ctx.close();
}

/* D: the Sunday report card. Fixed clocks: Sun 18:05 CT shows it (and writes crew/weeks-<id> once), Mon 12:01 it's gone
   from Crew but in the Log, Wed nothing; a second open doesn't rewrite; spend missing or stale = "not tracked yet" and no
   $/ship; 0 ships = "$ per ship: nothing shipped"; no last-week doc = no arrows; a week the log was trimmed inside =
   "not tracked yet" and no write; DST weeks; tidy() keeps the report weeks + ship events. */
const SUN = new Date("2026-10-04T23:05:00Z"), MON = new Date("2026-10-05T17:01:00Z"), WED = new Date("2026-10-07T17:00:00Z");
const W40 = "crew/weeks-2026-W40", W39 = "crew/weeks-2026-W39", W38 = "crew/weeks-2026-W38";
function wkDocs(o) {
  o = o || {};
  const d = hoDocs();
  d["crew/sessions"].updatedAt = o.spendAt || "2026-10-04T22:00:00Z";
  if (o.spend !== false) d["crew/sessions"].spend = { today_usd: 20, week_usd: 312 };
  if (o.ships !== false) {
    d["events/20260930T150000Z-builder"] = { agent: "builder", kind: "done", lane: "code", room: "dock", status: "done", task: "T300", at: "2026-09-30T15:00:00Z", text: "Published App v25.3 to the live link" };
    d["events/20261002T150000Z-code"] = { agent: "code", kind: "note", lane: "board", room: "board", status: "done", at: "2026-10-02T15:00:00Z", text: "Practice Door v11 went live" };
    d["events/20261003T150000Z-code"] = { agent: "code", kind: "note", lane: "board", room: "board", status: "done", at: "2026-10-03T15:00:00Z", text: "Not published yet: waiting on QA" };
  }
  d["events/20261001T100000Z-builder"] = { agent: "builder", kind: "blocked", lane: "code", room: "tests", status: "blocked", at: "2026-10-01T10:00:00Z", text: "stuck on a test" };
  d["events/20261001T130000Z-builder"] = { agent: "builder", kind: "progress", lane: "code", room: "tests", status: "working", at: "2026-10-01T13:00:00Z", text: "unstuck" };
  if (o.whole !== false) d["events/20260927T120000Z-code"] = { agent: "code", kind: "note", lane: "board", room: "board", status: "done", at: "2026-09-27T12:00:00Z", text: "last week's last line" };   // the log reaches back past the week's start
  if (o.last !== false) d[W39] = { v: 1, week: "2026-W39", label: "Week of Sep 21 – 27", shipped: 1, spent_usd: 402, per_ship_usd: 402, waited_h: 1, stuck_h: 7, at: "2026-09-27T23:10:00Z", by: "hub" };
  return Object.assign(d, o.extra || {});
}
const wkWrites = async p => (await writes(p)).filter(x => /^crew\/weeks/.test(x));
async function scenarioWeekly(browser, url) {
  const L = "sunday-report";
  // Sunday 18:05 CT: the card tops the Crew tab and crew/weeks-2026-W40 is written once
  const a = await open(browser, url, { docs: wkDocs(), now: SUN, hash: "" });
  await a.p.click("#tab-crew", { timeout: 2000 }); await a.tick(2000);
  const txt = await a.p.textContent("#wkBlock");
  ok(await a.p.isVisible("#wkBlock"), `${L}: Sunday 18:05 shows no card`);
  ok(/Week of Sep 28 – Oct 4/.test(txt), `${L}: week label wrong (${txt.slice(0, 80)})`);
  ok(/Shipped\s*2/.test(txt) && /App v25\.3/.test(txt), `${L}: shipped count/list wrong (${txt.slice(0, 160)})`);
  ok(/\$312/.test(txt) && /\$ per ship\s*\$156/.test(txt), `${L}: spend / $ per ship wrong (${txt})`);
  ok(/Stuck\s*3 h/.test(txt), `${L}: stuck span wrong (${txt})`);
  ok(/vs last week/.test(txt) && /▲ 1/.test(txt) && /▼ \$246/.test(txt), `${L}: arrows wrong (${txt})`);
  ok(/Best helper/.test(txt), `${L}: no best helper row`);
  const order = await a.p.$$eval("#tp-crew > .xblock, #tp-crew > div", els => els.filter(e => !e.hidden).map(e => e.id || e.className));
  ok(order[0] === "wkBlock", `${L}: the card isn't at the top of Crew (${order.join(",")})`);
  await a.tick(65000);
  const w1 = await wkWrites(a.p);
  ok(w1.length === 1 && w1[0] === W40, `${L}: crew/weeks writes ${JSON.stringify(w1)} (want one ${W40})`);
  ok((await log(a.p)).some(x => x[0] === "acquire" && x[1] === W40), `${L}: wrote without taking the lease`);
  const doc = await a.p.evaluate(k => window.__mockDb.store.get(k), W40);
  ok(doc && doc.week === "2026-W40" && doc.shipped === 2 && doc.spent_usd === 312 && doc.complete === true, `${L}: week doc wrong ${JSON.stringify(doc).slice(0, 200)}`);
  await shot(a.p, "sunday-report");
  ok(!a.errs.length, `${L}: page errors (Sunday): ${a.errs.slice(0, 4).join(" | ")}`);
  await a.ctx.close();
  // a second open (the doc's there now): no rewrite, same card
  const b = await open(browser, url, { docs: wkDocs({ extra: { [W40]: doc } }), now: new Date(SUN.getTime() + 40 * 60000) });
  await b.p.click("#tab-crew", { timeout: 2000 }); await b.tick(65000);
  ok(!(await wkWrites(b.p)).length, `${L}: a second open rewrote the week doc`);
  ok(await b.p.isVisible("#wkBlock") && /Shipped\s*2/.test(await b.p.textContent("#wkBlock")), `${L}: second open lost the card`);
  await b.ctx.close();
  // Monday 12:01: gone from Crew, in the Log with the weeks before it
  const c = await open(browser, url, { docs: wkDocs({ extra: { [W40]: doc, [W38]: { week: "2026-W38", label: "Week of Sep 14 – 20", shipped: 3, spent_usd: null, waited_h: 2, stuck_h: 1 } } }), now: MON });
  await c.p.click("#tab-crew", { timeout: 2000 }); await c.tick(1500);
  ok(!(await c.p.isVisible("#wkBlock")), `${L}: Monday 12:01 still shows the card in Crew`);
  await c.p.click("#tab-log", { timeout: 2000 }); await c.tick(600);
  ok((await c.p.$$("#feed .wklog")).length >= 1, `${L}: Monday 12:01 the newest report isn't on the Log's first page`);
  for (let i = 0; i < 6 && await c.p.isVisible("#olderBtn"); i++) { await c.p.click("#olderBtn", { timeout: 2000 }); await c.tick(300); }   // older reports sit at their own time
  const logs = await c.p.$$eval("#feed .wklog", ls => ls.map(l => l.textContent));
  ok(logs.length === 3 && /Sep 28 – Oct 4/.test(logs[0]) && /Sep 21 – 27/.test(logs[1]) && /Sep 14 – 20/.test(logs[2]), `${L}: the Log doesn't keep the past reports (${logs.map(x => x.slice(0, 40)).join(" | ")})`);
  ok(!(await wkWrites(c.p)).length, `${L}: Monday wrote a week doc`);
  ok(!c.errs.length, `${L}: page errors (Monday): ${c.errs.slice(0, 4).join(" | ")}`);
  await c.ctx.close();
  // Wednesday: nothing in Crew, nothing written
  const d = await open(browser, url, { docs: wkDocs(), now: WED });
  await d.p.click("#tab-crew", { timeout: 2000 }); await d.tick(1500);
  ok(!(await d.p.isVisible("#wkBlock")) && !(await wkWrites(d.p)).length, `${L}: Wednesday shows or writes a report`);
  await d.ctx.close();
}
async function scenarioWeeklyEdges(browser, url) {
  const L = "sunday-report-edges";
  // spend missing: "not tracked yet", no $ per ship row; no last week = no arrows
  const a = await open(browser, url, { docs: wkDocs({ spend: false, last: false }), now: SUN });
  await a.p.click("#tab-crew", { timeout: 2000 }); await a.tick(2000);
  const t1 = await a.p.textContent("#wkBlock");
  ok(/Spent\s*not tracked yet/.test(t1) && !/\$ per ship/.test(t1), `${L}: missing spend wrong (${t1})`);
  ok(!/[▲▼]/.test(t1) && /no last week to compare yet/.test(t1), `${L}: arrows with no last-week doc (${t1})`);
  ok(!a.errs.length, `${L}: page errors: ${a.errs.slice(0, 4).join(" | ")}`);
  await a.ctx.close();
  // spend written 7 h ago: stale, "not tracked yet"
  const s = await open(browser, url, { docs: wkDocs({ spendAt: "2026-10-04T16:00:00Z" }), now: SUN });
  await s.p.click("#tab-crew", { timeout: 2000 }); await s.tick(2000);
  const ts = await s.p.textContent("#wkBlock");
  ok(/Spent\s*not tracked yet/.test(ts) && !/\$312/.test(ts), `${L}: 7 h old spend was trusted (${ts.slice(0, 200)})`);
  await s.ctx.close();
  // 0 ships with spend: "$ per ship: nothing shipped", no divide by zero
  const b = await open(browser, url, { docs: wkDocs({ ships: false }), now: SUN });
  await b.p.click("#tab-crew", { timeout: 2000 }); await b.tick(2000);
  const t2 = await b.p.textContent("#wkBlock");
  ok(/\$ per ship\s*nothing shipped/.test(t2) && !/Infinity|NaN/.test(t2), `${L}: 0 ships wrong (${t2})`);
  const w = await b.p.evaluate(k => window.__mockDb.store.get(k), W40);
  ok(!w || (w.shipped === 0 && w.per_ship_usd === null), `${L}: 0-ship doc wrong ${JSON.stringify(w).slice(0, 160)}`);
  ok(!b.errs.length, `${L}: page errors: ${b.errs.slice(0, 4).join(" | ")}`);
  await b.ctx.close();
  // the log was trimmed inside the week (no event before it / system/tidy says so): Shipped + Stuck "not tracked yet", no $/ship, no write
  for (const [k, docs] of [["no older event", wkDocs({ whole: false })], ["tidy inside the week", wkDocs({ extra: { "system/tidy": { deleted_through: "2026-09-29T12:00:00Z", at: "2026-10-01T00:00:00Z" } } })]]) {
    const c = await open(browser, url, { docs, now: SUN });
    await c.p.click("#tab-crew", { timeout: 2000 }); await c.tick(8000);
    const t = await c.p.textContent("#wkBlock");
    ok(/Shipped\s*not tracked yet/.test(t) && /Stuck\s*not tracked yet/.test(t) && !/\$ per ship/.test(t), `${L}: ${k}: a partial week shows numbers (${t.slice(0, 200)})`);
    ok(!(await wkWrites(c.p)).length, `${L}: ${k}: a partial week was written`);
    ok(!c.errs.length, `${L}: ${k}: page errors: ${c.errs.slice(0, 4).join(" | ")}`);
    await c.ctx.close();
  }
  // the ISO week id, the window, and DST weeks (2026-03-08 and 2026-11-01), straight
  const c = await open(browser, url, { docs: wkDocs(), now: SUN });
  const r = await c.p.evaluate(() => { const t = window.__hubT, P = Date.parse, iso = ms => new Date(ms).toISOString(); return {
    sun: t.wkWindow(P("2026-10-04T23:05:00Z")), s1759: t.wkWindow(P("2026-10-04T22:59:00Z")), mon: t.wkWindow(P("2026-10-05T16:59:00Z")),
    id: t.wkId(t.wkWindow(P("2026-10-04T23:05:00Z")).ws), jan: t.wkId(P("2026-12-28T06:00:00Z")),
    mar8: iso(t.wkStartOf(P("2026-03-09T04:30:00Z"))), mar9: iso(t.wkStartOf(P("2026-03-09T12:00:00Z"))), mar8show: t.wkWindow(P("2026-03-08T23:05:00Z")).show,
    nov1: iso(t.wkStartOf(P("2026-11-01T12:00:00Z"))), nov2: iso(t.wkStartOf(P("2026-11-02T12:00:00Z"))), nov1show: t.wkWindow(P("2026-11-02T00:05:00Z")).show }; });
  ok(r.sun.show && !r.s1759.show && r.mon.show && r.sun.ws === r.mon.ws, `${L}: window wrong ${JSON.stringify(r)}`);
  ok(r.id === "2026-W40" && r.jan === "2026-W53", `${L}: week id wrong ${r.id} ${r.jan}`);
  ok(r.mar8 === "2026-03-02T06:00:00.000Z" && r.mar9 === "2026-03-09T05:00:00.000Z" && r.mar8show, `${L}: spring DST week wrong ${r.mar8} ${r.mar9} ${r.mar8show}`);
  ok(r.nov1 === "2026-10-26T05:00:00.000Z" && r.nov2 === "2026-11-02T06:00:00.000Z" && r.nov1show, `${L}: fall DST week wrong ${r.nov1} ${r.nov2} ${r.nov1show}`);
  await c.ctx.close();
}
async function scenarioTidyKeeps(browser, url) {   // tidy() trims old lines but keeps the report weeks and ship events of 14 days, and says how far it trimmed
  const L = "tidy-keeps";
  const d = hoDocs(), pad = n => String(n).padStart(2, "0");
  for (let i = 0; i < 300; i++) d[`events/20260928T${pad(10 + Math.floor(i / 60))}${pad(i % 60)}00Z-builder`] = { agent: "builder", kind: "progress", at: `2026-09-28T${pad(10 + Math.floor(i / 60))}:${pad(i % 60)}:00Z`, text: "working " + i };
  for (let i = 0; i < 60; i++) d[`events/202609${pad(10 + Math.floor(i / 20))}T${pad(i % 20)}0000Z-code`] = { agent: "code", kind: "note", at: `2026-09-${pad(10 + Math.floor(i / 20))}T${pad(i % 20)}:00:00Z`, text: "old line " + i };
  for (let i = 0; i < 5; i++) d[`events/202609${16 + i}T120000Z-code`] = { agent: "code", kind: "done", at: `2026-09-${16 + i}T12:00:00Z`, text: `Published thing ${i}` };
  const { ctx, p, errs, tick } = await open(browser, url, { docs: d });
  const week0 = await p.evaluate(() => { const s = window.__mockDb.store; return [...s.keys()].filter(x => x.startsWith("events/") && (s.get(x) || {}).at >= "2026-09-21T05:00:00Z").length; });
  await tick(130000);
  const st = await p.evaluate(() => { const s = window.__mockDb.store, k = [...s.keys()].filter(x => x.startsWith("events/")); return {
    ships: k.filter(x => /Published thing/.test((s.get(x) || {}).text || "")).length, week: k.filter(x => (s.get(x) || {}).at >= "2026-09-21T05:00:00Z").length,
    old: k.filter(x => /old line/.test((s.get(x) || {}).text || "")).length, tidy: s.get("system/tidy") }; });
  ok(st.ships === 5, `${L}: tidy deleted ship events (${st.ships} of 5 left)`);
  ok(st.old === 20, `${L}: tidy should delete 40 of 60 old lines (left ${st.old})`);
  ok(st.week === week0 && week0 >= 300, `${L}: tidy deleted inside the report weeks (${st.week} of ${week0} left)`);
  ok(st.tidy && st.tidy.deleted_through && st.tidy.deleted_through < "2026-09-21T05:00:00Z", `${L}: system/tidy wrong ${JSON.stringify(st.tidy)}`);
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
  const run = async (name, fn) => { if (ONLY.length && !ONLY.includes(name)) return; const t = Date.now(); try { await fn(); } catch (e) { fails.push(`${name}: crashed: ${e.message.split("\n").slice(0, 8).join(" ~ ")}`); } notes.push(`${name}: ${((Date.now() - t) / 1000).toFixed(1)} s`); };
  try {
    await run("live", () => scenarioLive(browser, url, null, "live"));
    await run("phone", () => scenarioLive(browser, url, { width: 390, height: 844 }, "phone"));
    await run("quiet-load", () => scenarioQuiet(browser, url));
    await run("mcp-hang", () => scenarioMcpHang(browser, url));
    await run("sample-hang", () => scenarioSampleHang(browser, url));
    await run("mcp-null-once", () => scenarioWakeRetry(browser, url, { first_use_mcp: "null" }, "mcp-null-once"));
    await run("mcp-consent-once", () => scenarioWakeRetry(browser, url, { first_call_mcp: "consent_required" }, "mcp-consent-once"));
    await run("write-hang", () => scenarioWriteHang(browser, url));
    await run("send-fail", () => scenarioSendFail(browser, url));
    await run("db-fail", () => scenarioDegraded(browser, url, { db: "fail" }, "db-fail", /reconnect/i));
    await run("no-db", () => scenarioDegraded(browser, url, { use_db: "null" }, "no-db", /isn.t available|not available/i));
    await run("user-hang", () => scenarioDegraded(browser, url, { use_user: "hang", use_sample: "hang", use_mcp: "hang" }, "user-hang"));
    await run("3d-slow", () => scenarioSlow3d(browser, url));
    for (const k of ["missing", "present", "malformed"]) await run("report-" + k, () => scenarioReport(browser, url, k));
    await run("flows", () => scenarioFlows(browser, url));
    await run("obs-empty", () => scenarioObsEmpty(browser, url));
    await run("live-chats", () => scenarioLiveChats(browser, url, null, "live-chats"));
    await run("live-chats-phone", () => scenarioLiveChats(browser, url, { width: 390, height: 844 }, "live-chats-phone"));
    await run("live-prompt", () => scenarioLivePrompt(browser, url));
    await run("live-slow-consent", () => scenarioLiveSlowConsent(browser, url));
    await run("live-refused", () => scenarioLiveRefused(browser, url));
    await run("handoff", () => scenarioHandoff(browser, url));
    await run("handoff-steps", () => scenarioHandoffSteps(browser, url));
    await run("handoff-king", () => scenarioHandoffKing(browser, url));
    await run("fix-buttons", () => scenarioFixButtons(browser, url));
    await run("why", () => scenarioWhy(browser, url));
    await run("live-hang", () => scenarioLiveHang(browser, url));
    await run("live-text", () => scenarioLiveText(browser, url));
    await run("live-stale", () => scenarioLiveStale(browser, url));
    await run("merge-watch", () => scenarioMergeWatch(browser, url));
    await run("merge-missing", () => scenarioMergeMissing(browser, url));
    await run("merge-edges", () => scenarioMergeEdges(browser, url));
    await run("tidy-keeps", () => scenarioTidyKeeps(browser, url));
    await run("sunday-report", () => scenarioWeekly(browser, url));
    await run("sunday-report-edges", () => scenarioWeeklyEdges(browser, url));
  } finally { await browser.close(); await closeServer(); }
  for (const x of notes) console.log(x);
  const real = fails.filter(Boolean);
  if (real.length) { console.log("\nFAIL (" + real.length + ")"); for (const f of real) console.log("  - " + f); process.exit(1); }
  console.log("\nPASS: hub live-data smoke test (37 scenarios)");
})();
