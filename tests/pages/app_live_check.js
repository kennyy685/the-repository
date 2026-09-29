#!/usr/bin/env node
/* HMP App + Practice Door live-data smoke test (2026-09-29: the AI hub froze live while every offline check passed, so
 * every page now also runs against a claude.ai runtime that can succeed, FAIL or HANG).
 * The HMP App (pages/hmp-app.html + its files map) on a realistic Tuesday-morning database (tests/fixtures/app_live.json,
 * built by app_live_fixture.py: mock homes, no names) and the Practice Door (pages/practice-door.html, sample only),
 * both behind tests/pages/hub_runtime_mock.js (db / sample / user) plus a mocked `assets` store. Scenarios:
 *   app-live      everything answers: every tab, every button on each tab, the sheets they open, the Right Hand chat
 *                 (reply + a logged action), a door tap saved to the db; no errors, a free main thread
 *   app-phone     the same clicks at 390 px
 *   app-db-hang   use('db') never answers: the page stops waiting by itself and says live data is off; tabs work
 *   app-db-slow   use('db') answers after 20 s: 'off' at 12 s, then it connects by itself
 *   app-sample-slow use('sample') answers after 20 s: the Right Hand shows up then
 *   app-use-hang  user + sample never answer: the data still loads and the Right Hand stays hidden (no dead button)
 *   app-db-fail   every listener errors: the page says it could not load; tabs work
 *   app-write-hang  writes never answer: a door tap still shows at once and waits in the outbox (sync chip)
 *   app-sample-hang the Right Hand never answers: the chat box frees itself (hard deadline, even if the signal is ignored)
 *   app-sample-fail the Right Hand errors: the box comes back with a message
 *   app-say-hang  Help me say it never answers: it says it couldn't translate (45 s), never spins forever
 *   app-es / app-practice  the live clicks in Spanish, and in Practice mode (zero db writes)
 *   door-live     Practice Door: a full door (knock, talk, the homeowner answers, the door ends), no errors
 *   door-hang     the homeowner never answers: the box frees itself and says so
 *   door-fail / door-use-hang / door-off: an error message / Claude off, never a dead page
 *   NODE_PATH=/opt/node22/lib/node_modules node tests/pages/app_live_check.js [scenario ...]
 * Exit 0 = pass. Shots in tests/pages/out/app_live/. */
"use strict";
const fs = require("fs");
const path = require("path");
const { pageUrl, closeServer } = require("./serve");

const ROOT = path.resolve(__dirname, "..", "..");
const OUT = path.join(__dirname, "out", "app_live");
const FIXF = path.join(ROOT, "tests", "fixtures", "app_live.json");
const MOCK = path.join(__dirname, "hub_runtime_mock.js");
const NOW = new Date("2026-09-29T12:05:00Z");   // Tue 7:05 AM Central: the engine's 6:54 run is in, the day hasn't started
function loadPlaywright() {
  for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright"]) { try { return require(p); } catch (e) { /* next */ } }
  throw new Error("playwright not found (set NODE_PATH=/opt/node22/lib/node_modules)");
}
if (!fs.existsSync(FIXF)) require("child_process").execFileSync("python3", [path.join(__dirname, "app_live_fixture.py")], { cwd: ROOT });
const FIX = JSON.parse(fs.readFileSync(FIXF, "utf8")).docs;
const fails = [], notes = [];
let cur = "";
const ok = (cond, msg) => { if (!cond) fails.push(`${cur}: ${msg}`); return !!cond; };

// the hub mock has no `assets`; the app needs one for photos (same modes: ok / fail / hang)
const ASSETS_MOCK = `(() => { const M = (window.__MOCK || {}).modes || {};
  const g = fn => M.assets === 'hang' ? new Promise(() => {}) : M.assets === 'fail' ? Promise.reject(Object.assign(new Error('x'), {code: 'unavailable'})) : Promise.resolve(fn());
  const assets = { upload: () => g(() => ({ id: Math.random().toString(16).slice(2).padEnd(32, '0').slice(0, 32), url: '' })), list: () => g(() => ({ assets: [], usage: {} })), delete: () => g(() => ({})), url: () => g(() => '') };
  const use0 = window.claude.use, slow = n => M['use_' + n] === 'slow20';   // answers after 20 s (slow, not gone)
  window.claude.use = n => slow(n) ? new Promise(r => setTimeout(() => r(use0(n)), 20000)) : use0(n);
  const use1 = window.claude.use;
  window.claude.use = n => n === 'assets' ? (M.use_assets === 'hang' ? new Promise(() => {}) : Promise.resolve(assets)) : use1(n); })();`;

async function open(browser, url, o) {
  const ctx = await browser.newContext({ viewport: o.vp || { width: 1470, height: 900 }, timezoneId: "America/Chicago", colorScheme: "dark", reducedMotion: "reduce" });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", e => errs.push("pageerror: " + e.message));
  p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|ERR_|net::/.test(m.text())) errs.push("console: " + m.text().slice(0, 200)); });
  p.on("dialog", d => d.dismiss().catch(() => {}));
  await p.route(/^(https?|wss?):\/\/(?!127\.0\.0\.1)/, r => r.abort());   // offline: map tiles, CDNs - the page must not need them
  await p.addInitScript(({ docs, modes, ls }) => {
    window.__MOCK = { docs, modes };
    window.__unhandled = [];
    window.addEventListener("unhandledrejection", e => window.__unhandled.push(String((e.reason && (e.reason.code || e.reason.message)) || e.reason)));
    window.print = () => {};   // a print dialog would block the run
    try { localStorage.clear(); for (const [k, v] of Object.entries(ls || {})) localStorage.setItem(k, v); } catch (e) { /* none */ }
  }, { docs: o.docs === undefined ? FIX : o.docs, modes: o.modes || {}, ls: o.ls || {} });
  if (!o.noRuntime) { await p.addInitScript({ path: MOCK }); await p.addInitScript(ASSETS_MOCK); }
  await ctx.clock.install({ time: NOW });
  await p.goto(url, { waitUntil: "load" });
  const tick = ms => p.clock.runFor(ms);
  await tick(o.settle || 3000);
  return { ctx, p, errs, tick };
}
async function probe(p) {   // the main thread answers at once
  const t = Date.now();
  return Promise.race([p.evaluate(() => 1).then(() => Date.now() - t), new Promise(res => setTimeout(() => res(9999), 5000))]);
}
const log = p => p.evaluate(() => window.__mockLog.slice());
const writes = async p => (await log(p)).filter(x => x[0] === "set" || x[0] === "update" || x[0] === "delete").map(x => x[1]);
async function finish(o, shot) {
  const { p, errs, ctx } = o;
  const ms = await probe(p);
  ok(ms < 1500, `main thread busy (${ms} ms to answer)`);
  const un = await p.evaluate(() => window.__unhandled || []).catch(() => []);
  ok(!un.length, "unhandled rejections: " + un.join(" | "));
  ok(!errs.length, "errors: " + errs.slice(0, 4).join(" | "));
  if (shot) await p.screenshot({ path: path.join(OUT, shot + ".png") }).catch(() => {});
  await ctx.close();
}
async function closeSheets(p, tick) {
  for (let i = 0; i < 3; i++) { await p.keyboard.press("Escape"); await tick(150); }
  await p.evaluate(() => { for (const d of document.querySelectorAll("dialog[open]")) try { d.close(); } catch (e) { /* none */ } });
}

/* ---------- HMP App ---------- */
const TABS = ["now", "knock", "leads", "money"];
async function appTab(p, tick, t) {
  await p.click("#tb-" + t, { timeout: 3000 }).catch(e => fails.push(`${cur}: tab ${t} not clickable: ${e.message.split("\n")[0]}`));
  await tick(400);
  ok(await p.getAttribute("#tb-" + t, "aria-selected") === "true", `tab ${t} didn't select`);
}
// every visible, enabled button in the open tab (and in any sheet it opens), with a real pointer. Links out, print and
// "delete" style buttons are skipped: the smoke test is about freezes and throws, not about wiping the fixture.
const SKIP = "[data-del], [data-delete], .danger, [href^='tel:'], [href^='sms:'], [href^='mailto:'], a[target=_blank]";
async function clickAll(p, tick, t) {
  // the tab re-renders after each click, so buttons are found again by position each time (a marker would be wiped)
  const pick = (i) => p.evaluate(({ t, skip, i }) => {
    const bs = [...document.querySelectorAll(`#tab-${t} button, #tab-${t} [role=button]`)].filter(b => b.offsetParent && !b.disabled && !b.matches(skip));
    document.querySelectorAll("[data-__c]").forEach(b => b.removeAttribute("data-__c"));
    if (bs[i]) bs[i].setAttribute("data-__c", "1");
    return bs.length;
  }, { t, skip: SKIP, i });
  let n = 0, total = await pick(0);
  for (let i = 0; i < Math.min(total, 30); i++) {
    total = await pick(i); if (i >= total) break;
    const h = await p.$('[data-__c="1"]'); if (!h || !(await h.isVisible().catch(() => false))) continue;
    await h.click({ timeout: 2000 }).then(() => n++).catch(e => { if (!/detached|not attached|not visible|intercepts pointer/.test(e.message)) fails.push(`${cur}: a button in ${t} not clickable: ${e.message.split("\n")[0]}`); });
    await tick(250);
    // a sheet opened: click what's in it too (one level), then close it
    const inSheet = await p.$$eval("#sheet:not([hidden]) button, dialog[open] button", (bs, skip) => bs.filter(b => b.offsetParent && !b.disabled && !b.matches(skip) && !/close|cerrar|×/i.test(b.getAttribute("aria-label") || b.textContent))
      .map((b, k) => { b.dataset.__s = "s" + k; return "s" + k; }), SKIP).catch(() => []);
    for (const sid of inSheet.slice(0, 12)) {
      const s = await p.$(`[data-__s="${sid}"]`); if (!s || !(await s.isVisible().catch(() => false))) continue;
      await s.click({ timeout: 1500 }).then(() => n++).catch(() => {});
      await tick(200);
    }
    await closeSheets(p, tick);
    if (await p.getAttribute("#tb-" + t, "aria-selected") !== "true") await p.click("#tb-" + t, { timeout: 2000 }).catch(() => {});
    await tick(100);
  }
  return n;
}
async function fillForms(p, tick) {   // every text field visible anywhere gets realistic text; selects get their 2nd option
  await p.$$eval("input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]), textarea", els => els.filter(e => e.offsetParent && !e.disabled && !e.readOnly).forEach(e => {
    const v = e.type === "number" ? "12" : e.type === "tel" ? "402-555-0100" : e.type === "date" ? "2026-09-30" : e.type === "time" ? "16:00" : "1712 N Clarkson St, hail on the gutters";
    e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); }));
  await tick(200);
}
async function plusForms(p, tick, name, practice) {   // the Add sheet: a new lead saved, Help me say it translated, each action opens
  const openPlus = async (what) => { await closeSheets(p, tick); await p.click("#plusBtn", { timeout: 3000 }).catch(e => fails.push(`${cur}: Add button: ${e.message.split("\n")[0]}`)); await tick(300);
    const b = await p.$(`#shBody [data-open="${what}"]`); if (!b) { fails.push(`${cur}: Add sheet has no ${what}`); return false; } await b.click({ timeout: 2000 }).catch(() => {}); await tick(400); return true; };
  if (await openPlus("nl:")) {
    const before = (await writes(p)).filter(w => w.startsWith("leads/")).length;
    await p.fill("#nlAddr", "1712 N Clarkson St").catch(() => fails.push(`${cur}: new lead form has no address field`));
    await p.fill("#nlName", "Test").catch(() => {}); await p.fill("#nlCity", "Fremont").catch(() => {});
    await p.$$eval("#nlForm [data-nl] button[data-v]", bs => { const seen = new Set(); for (const b of bs) { const k = b.closest("[data-nl]").dataset.nl; if (!seen.has(k)) { seen.add(k); b.click(); } } }).catch(() => {});
    await tick(200);
    await p.click("#nlSave", { timeout: 2000 }).catch(e => fails.push(`${cur}: new lead Save: ${e.message.split("\n")[0]}`));
    await tick(1500);
    if (!practice) ok((await writes(p)).filter(w => w.startsWith("leads/")).length > before, "a new lead from the Add form wrote nothing");
  }
  if (await openPlus("say:")) {
    await p.evaluate(() => { window.__sampleJson = { text: "Hola, soy Kenny de HMP Siding and Roofing." }; });
    await p.fill("#sayIn", "Hi, I'm Kenny with HMP Siding and Roofing.").catch(() => fails.push(`${cur}: Help me say it has no box`));
    await p.press("#sayIn", "Enter").catch(() => {});
    await tick(1500);
    ok(/Hola, soy Kenny/.test(await p.textContent("#shBody").catch(() => "")), "Help me say it never showed the translation");
  }
  await openPlus("est:"); await fillForms(p, tick); await closeSheets(p, tick);
}
async function appLive(browser, url, vp, name, ls) {
  const o = await open(browser, url, { vp, ls: Object.assign({ "hmp-app-lang": "en", "hmp-app-tab": "now" }, ls || {}) });
  const { p, tick } = o, practice = !!ls && ls["hmp-app-practice"] === "1";
  ok(await p.evaluate(() => (window.__subs || 0) > 0), "db never connected (no listeners)");
  ok(await liveState(p) === "on", `live dot says "${await liveState(p)}", not on`);
  ok(await p.isVisible("#rhBtn").catch(() => false), "Right Hand button hidden with sample + edit rights");
  let n = 0;
  const per = [];
  for (const t of TABS) { await appTab(p, tick, t); await fillForms(p, tick); const c = await clickAll(p, tick, t); per.push(t + " " + c); n += c; }
  notes.push(`${name}: clicks per tab: ${per.join(", ")}`);
  notes.push(`${name}: ${n} buttons clicked`);
  ok(n >= 20, `only ${n} buttons clicked (the page may not have loaded its data)`);
  await plusForms(p, tick, name, practice);
  // a door tap on the Knock walk saves to the db
  await appTab(p, tick, "knock");
  const before = (await writes(p)).length;
  const tapped = await tapDoor(p, tick);
  if (tapped && !practice) ok((await writes(p)).length > before, "a door tap wrote nothing to the db");
  else notes.push(`${name}: no open door to tap on Knock`);
  // the Right Hand: a reply and a logged action
  await p.evaluate(() => { window.__sampleJson = { reply: "Logged 12 doors.", actions: [{ type: "log_doors", doors: 12, conversations: 3 }] }; });
  await closeSheets(p, tick);
  await appTab(p, tick, "now");   // the Right Hand button is docked on the tab bar, hidden on Knock
  await p.click("#rhBtn", { timeout: 3000 }).catch(e => fails.push(`${cur}: Right Hand button: ${e.message.split("\n").slice(0, 12).join(" / ")}`));
  await tick(300);
  if (await p.isVisible("#kcInput").catch(() => false)) {
    await p.fill("#kcInput", "12 doors, 3 talks on Clarkson");
    await p.click("#kcSend", { timeout: 2000 }).catch(() => {});
    await tick(2000);
    const txt = await p.textContent("#kcLog");
    ok(/Logged 12 doors/.test(txt), "the Right Hand's reply never showed");
    ok(!(await p.isDisabled("#kcInput")), "chat box still locked after the reply");
    if (!practice) ok((await writes(p)).some(w => /^stats\/week-/.test(w)), "log_doors didn't write the week stats");
  } else ok(false, "Right Hand chat never opened");
  if (practice) ok(!(await writes(p)).length, "Practice mode wrote to the real db: " + (await writes(p)).slice(0, 5).join(", "));
  await finish(o, name);
}
async function appDegraded(browser, url, name, modes, check) {
  const o = await open(browser, url, { modes, ls: { "hmp-app-lang": "en", "hmp-app-tab": "now" }, settle: 1000 });
  const { p, tick } = o;
  await check(o);
  for (const t of TABS) await appTab(p, tick, t);
  await finish(o, name);
}
const liveState = p => p.evaluate(() => { const e = document.querySelector("#live"); return e ? e.dataset.state : ""; });
async function tapDoor(p, tick) {   // Knock: open the next door and answer "No" (one tap = one write)
  await appTab(p, tick, "knock");
  let b = await p.$("#tab-knock button.ans[data-r=no]:not([disabled])");
  if (!b) { const o = await p.$("#tab-knock [data-kopen]"); if (o) { await o.click().catch(() => {}); await tick(300); } b = await p.$("#tab-knock button.ans[data-r=no]:not([disabled])"); }
  if (!b) return false;
  await b.click({ timeout: 2000 }).catch(() => {}); await tick(1500);
  return true;
}
const liveText = p => p.evaluate(() => { const e = document.querySelector("#live, .live, [data-live]"); return e ? e.textContent : ""; });
async function appScenarios(browser) {
  const url = await pageUrl("pages/hmp-app.html");
  const run = async (name, fn) => { if (want(name)) { cur = name; await fn(); } };
  await run("app-live", () => appLive(browser, url, null, "app-live"));
  await run("app-phone", () => appLive(browser, url, { width: 390, height: 844 }, "app-phone"));
  await run("app-es", () => appLive(browser, url, null, "app-es", { "hmp-app-lang": "es" }));
  await run("app-practice", () => appLive(browser, url, null, "app-practice", { "hmp-app-practice": "1" }));
  await run("app-db-hang", () => appDegraded(browser, url, "app-db-hang", { use_db: "hang" }, async ({ p, tick }) => {
    await tick(15000);
    ok(await liveState(p) === "off", `use('db') hung and the live dot still says "${await liveState(p)}" after 15 s`);
  }));
  await run("app-db-slow", () => appDegraded(browser, url, "app-db-slow", { use_db: "slow20" }, async ({ p, tick }) => {   // slow, not gone
    await tick(14000);
    ok(await liveState(p) === "off", `use('db') 14 s late and the live dot says "${await liveState(p)}", not off`);
    await tick(10000);
    ok(await liveState(p) === "on", `use('db') answered at 20 s and the page never connected (live: ${await liveState(p)})`);
  }));
  await run("app-sample-slow", () => appDegraded(browser, url, "app-sample-slow", { use_sample: "slow20" }, async ({ p, tick }) => {
    await tick(14000);
    ok(!(await p.isVisible("#rhBtn").catch(() => false)), "Right Hand shown before sample answered");
    await tick(10000);
    ok(await p.isVisible("#rhBtn").catch(() => false), "sample answered at 20 s and the Right Hand never showed");
  }));
  await run("app-use-hang", () => appDegraded(browser, url, "app-use-hang", { use_user: "hang", use_sample: "hang" }, async ({ p, tick }) => {
    await tick(15000);
    ok(await liveState(p) === "on", `db didn't connect while user/sample hang (live: ${await liveState(p)})`);
    ok(!(await p.isVisible("#rhBtn").catch(() => false)), "Right Hand shown though sample never answered");
  }));
  await run("app-db-fail", () => appDegraded(browser, url, "app-db-fail", { db: "fail" }, async ({ p, tick }) => {
    await tick(3000);
    ok(await liveState(p) !== "wait", "listeners failed and the page is still 'loading'");
  }));
  await run("app-write-hang", () => appDegraded(browser, url, "app-write-hang", { dbw: "hang" }, async ({ p, tick }) => {
    await tick(2000);
    if (!(await tapDoor(p, tick))) { ok(false, "no open door to tap on Knock"); return; }
    await tick(12000);
    ok(await p.evaluate(() => JSON.parse(localStorage.getItem("hmp-app-outbox") || "[]").length > 0), "a write that never answered left the outbox");
    ok(await p.isVisible("#syncChip"), "sync chip hidden with a write waiting");
  }));
  const kingHang = (name, modes, waitMs, expect) => run(name, () => appDegraded(browser, url, name, modes, async ({ p, tick }) => {
    await tick(2000);
    await appTab(p, tick, "now");
    await p.click("#rhBtn", { timeout: 3000 }).catch(e => fails.push(`${cur}: Right Hand button: ${e.message.split("\n").slice(0, 12).join(" / ")}`));
    await tick(300);
    await p.fill("#kcInput", "12 doors today").catch(() => {});
    await p.click("#kcSend", { timeout: 2000 }).catch(() => {});
    await tick(waitMs);
    ok(!(await p.isDisabled("#kcInput")), `chat box still locked ${waitMs / 1000} s after sending`);
    const log = await p.textContent("#kcLog"); ok(expect.test(log), "no clear message in the chat after the failure: " + log.slice(-120));
    await closeSheets(p, tick);
  }));
  await kingHang("app-sample-hang", { sample: "hang" }, 125000, /saved on this phone/);
  await run("app-say-hang", () => appDegraded(browser, url, "app-say-hang", { sample: "hang" }, async ({ p, tick }) => {   // Help me say it never answers
    await tick(2000);
    await p.click("#plusBtn", { timeout: 3000 }).catch(() => {}); await tick(300);
    await p.click('#shBody [data-open="say:"]', { timeout: 2000 }).catch(e => fails.push(`${cur}: say: ${e.message.split("\n")[0]}`)); await tick(400);
    await p.fill("#sayIn", "Hi, I'm Kenny with HMP.").catch(() => {}); await p.press("#sayIn", "Enter").catch(() => {});
    await tick(1000);
    ok(/Translating/.test(await p.textContent("#shBody")), "Help me say it didn't start");
    await tick(50000);
    const t = await p.textContent("#shBody");
    ok(!/Translating/.test(t) && /Could not translate|Translation failed/.test(t), "Help me say it still says Translating… 50 s later: " + t.slice(0, 120));
    await closeSheets(p, tick);
  }));
  await kingHang("app-sample-fail", { sample: "fail" }, 2000, /saved on this phone|can’t use Claude|could not be reached/);
}

/* ---------- Practice Door ---------- */
async function doorScenarios(browser) {
  const url = await pageUrl("pages/practice-door.html");
  const run = async (name, fn) => { if (want(name)) { cur = name; await fn(); } };
  const start = async (p, tick) => {   // pick the first homeowner and knock
    const b = await p.$("#start, [data-start], #knockBtn, button.knock, #go");
    if (b) await b.click({ timeout: 2000 }).catch(() => {});
    await tick(800);
  };
  const say = async (p, tick, text) => {
    if (!(await p.isVisible("#box").catch(() => false))) return false;
    await p.fill("#box", text); await p.keyboard.press("Enter"); await tick(300);
    if (await p.evaluate(() => document.querySelector("#box") && document.querySelector("#box").value !== "")) { const s = await p.$("#sendBtn"); if (s) await s.click().catch(() => {}); }
    return true;
  };
  await run("door-live", async () => {
    const o = await open(browser, url, {});
    const { p, tick } = o;
    await p.evaluate(() => { window.__sampleText = "Hi. What do you need? [[END:NO]]"; window.__sampleJson = { hint: "Say your name and HMP first.", checks: [{ id: "legal", pass: true }], score: 7 }; });
    // every visible button on the first screen, then a door
    const bs = await p.$$eval("button", xs => xs.filter(b => b.offsetParent && !b.disabled).map((b, i) => { b.dataset.__c = "d" + i; return "d" + i; }));
    let n = 0;
    for (const id of bs.slice(0, 25)) { const h = await p.$(`[data-__c="${id}"]`); if (!h || !(await h.isVisible().catch(() => false))) continue; await h.click({ timeout: 1500 }).then(() => n++).catch(() => {}); await tick(300); await p.keyboard.press("Escape"); await tick(100); }
    notes.push(`door-live: ${n} buttons clicked`);
    await p.goto(url); await tick(1500); await start(p, tick);
    const said = await say(p, tick, "Hi, I'm Kenny with HMP Siding and Roofing, we do roofs and siding.");
    if (said) { await tick(3000); ok(!(await p.isDisabled("#sendBtn").catch(() => false)), "Send stayed locked after the homeowner answered"); }
    notes.push(`door-live: talked=${said}`);
    // end the door and get it graded: the score screen shows a score or a retry, never a spinner forever
    if (await p.isVisible("#endBtn").catch(() => false)) { await p.click("#endBtn").catch(() => {}); await tick(500); }
    if (await p.isVisible("#scoreBtn").catch(() => false)) { await p.click("#scoreBtn").catch(() => {}); await tick(3000); }
    ok(!(await p.isVisible("#scoreLoading").catch(() => false)), "the score screen is still loading 3 s after the grade came back");
    await finish(o, "door-live");
  });
  const hangs = [["door-hang", { sample: "hang" }, 95000], ["door-fail", { sample: "fail" }, 2000]];
  for (const [name, modes, wait] of hangs) await run(name, async () => {
    const o = await open(browser, url, { modes });
    const { p, tick } = o;
    await start(p, tick);
    const said = await say(p, tick, "Hi, I'm Kenny with HMP Siding and Roofing.");
    if (said) { await tick(wait); ok(!(await p.isDisabled("#sendBtn").catch(() => false)), `Send is still locked ("waiting for them") ${wait / 1000} s later`);
      ok(await p.isVisible("#chatErr").catch(() => false), "no error message in the chat after the homeowner failed to answer"); }
    else ok(false, "no chat box to type in after Knock");
    await finish(o, name);
  });
  await run("door-use-hang", async () => {
    const o = await open(browser, url, { modes: { use_sample: "hang" } });
    await o.tick(15000);
    ok(await o.p.isVisible("#scrOff").catch(() => false), "use('sample') hung and the Door never went to its no-Claude screen");
    await finish(o, "door-use-hang");
  });
  await run("door-off", async () => {
    const o = await open(browser, url, { noRuntime: true });
    await finish(o, "door-off");
  });
}

const only = process.argv.slice(2).filter(a => !a.startsWith("--"));
const want = n => !only.length || only.some(x => n.startsWith(x));
(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined });
  try { await appScenarios(browser); await doorScenarios(browser); }
  catch (e) { fails.push(`${cur}: harness crashed: ${e.stack || e.message}`); }
  finally { await browser.close(); await closeServer(); }
  for (const n of notes) console.log("  " + n);
  if (fails.length) { console.log(`\nFAIL (${fails.length})`); for (const f of fails) console.log("  - " + f); process.exit(1); }
  console.log("\nPASS app_live_check");
})();
