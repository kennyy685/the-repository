#!/usr/bin/env node
/* HMP App: one full REAL working day, end to end (FilthE, 2026-09-29: "prove it before I knock").
 * Unlike fullday_check.js (Practice mode, nothing saves), this runs the app in normal mode against a seeded mock runtime
 * (tests/pages/hub_runtime_mock.js + tests/fixtures/app_live.json: the engine's own 6:54 AM output on the real SPC
 * 2026-06-13 Fremont 1.00" report replayed on 2026-09-29, real Fremont streets, made-up house numbers, no owner names).
 * Every write lands in the mock store, never the real db, and survives a reload (the store is kept in sessionStorage,
 * the way the real db keeps it server side).
 * The day, at 1470x956 (MacBook Air first), in English and again in Spanish:
 *   7:00 AM open -> Now: map + hot zones + Aldaba's pick -> pick a zone -> Knock the walk in order
 *   -> Not home / No / Interested / Booked (one tap each, each saved) -> Interested = a lead -> Booked = an inspection
 *   -> reload mid-flow (tab, walk, leads all still there) -> inspection logged (a photo, damage notes)
 *   -> the claim (insurer, claim #, adjuster meeting) -> quick price ("Estimate range, not final")
 *   -> paper: 3-day cancel notice EN + ES + the 44-8607 deductible notice word for word -> follow-ups / Calls today
 *   -> end of day numbers (the review saves reviews/<day>)
 *   plus: the chat logs a door, a lead and a claim from one short message each; a slow db (3 s writes) and a failing
 *   mcp / sample never freeze a screen.
 *   NODE_PATH=/opt/node22/lib/node_modules node tests/pages/e2e_day_check.js [en|es|slow ...] [--explore]
 * Exit 0 = pass. Shots in tests/pages/out/e2e_day/. */
"use strict";
const fs = require("fs");
const path = require("path");
const { pageUrl, closeServer } = require("./serve");

const ROOT = path.resolve(__dirname, "..", "..");
const OUT = path.join(__dirname, "out", "e2e_day");
const FIXF = path.join(ROOT, "tests", "fixtures", "app_live.json");
const MOCK = path.join(__dirname, "hub_runtime_mock.js");
const T7 = "2026-09-29T07:00:00-05:00";   // Tue 7:00 AM Central
function loadPlaywright() {
  for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright"]) { try { return require(p); } catch (e) { /* next */ } }
  throw new Error("playwright not found (set NODE_PATH=/opt/node22/lib/node_modules)");
}
if (!fs.existsSync(FIXF)) require("child_process").execFileSync("python3", [path.join(__dirname, "app_live_fixture.py")], { cwd: ROOT });
const FIX = JSON.parse(fs.readFileSync(FIXF, "utf8")).docs;
const STATUTE = (() => { const t = fs.readFileSync(path.join(ROOT, "docs", "legal", "44-8607.txt"), "utf8"); const m = t.match(/IT IS A VIOLATION[\s\S]*?PENALTIES\./); return m[0].replace(/\s+/g, " "); })();
const argv = process.argv.slice(2), EXPLORE = argv.includes("--explore"), only = argv.filter(a => !a.startsWith("--"));
const fails = [], notes = [];

// before the page: the seeded store (or what the day wrote so far, after a reload), the language, the photo store
const PRE = `(() => {
  const S = sessionStorage, first = !S.getItem('__e2e_store');
  window.__MOCK = { docs: first ? window.__E2E_FIX : JSON.parse(S.getItem('__e2e_store')), modes: window.__E2E_MODES || {} };
  window.__unhandled = []; window.addEventListener('unhandledrejection', e => window.__unhandled.push(String((e.reason && (e.reason.code || e.reason.message)) || e.reason)));
  window.print = () => {};
  if (first) { try { localStorage.clear(); for (const [k, v] of Object.entries(window.__E2E_LS || {})) localStorage.setItem(k, v); } catch (e) {} S.setItem('__e2e_store', JSON.stringify(window.__E2E_FIX)); }
})();`;
const POST = `(() => {   // after the mock: keep the store across reloads; the Right Hand answers from a queue; a photo store
  const st = window.__mockDb.store, keep = () => { try { sessionStorage.setItem('__e2e_store', JSON.stringify(Object.fromEntries(st))); } catch (e) {} };
  const s0 = st.set.bind(st), d0 = st.delete.bind(st); st.set = (k, v) => { const r = s0(k, v); keep(); return r; }; st.delete = k => { const r = d0(k); keep(); return r; };
  window.__rhNext = []; window.__uploads = [];
  const M = window.__MOCK.modes || {};
  const assets = { upload: async () => { window.__uploads.push(1); return { id: Math.random().toString(16).slice(2).padEnd(32, '0').slice(0, 32), url: '' }; }, list: async () => ({ assets: [], usage: {} }), delete: async () => ({}), url: async () => '' };
  const use0 = window.claude.use;
  window.claude.use = async n => { if (n === 'assets') return assets; const c = await use0(n);
    if (n === 'sample' && c && !c.__q) { const j = c.json; c.json = (msgs, o) => { const a = window.__rhNext.shift(); if (a) window.__sampleJson = a; return j(msgs, o); }; c.__q = 1; }
    return c; };
})();`;

async function open(browser, url, o) {
  const ctx = await browser.newContext({ viewport: o.vp || { width: 1470, height: 956 }, timezoneId: "America/Chicago", colorScheme: "dark", reducedMotion: "reduce" });
  const p = await ctx.newPage(), errs = [];
  p.on("pageerror", e => errs.push("pageerror: " + e.message));
  p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|ERR_|net::/.test(m.text())) errs.push("console: " + m.text().slice(0, 200)); });
  p.on("dialog", d => d.dismiss().catch(() => {}));
  await p.route(/^(https?|wss?):\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await p.addInitScript(({ fix, modes, ls }) => { window.__E2E_FIX = fix; window.__E2E_MODES = modes; window.__E2E_LS = ls; }, { fix: FIX, modes: o.modes || {}, ls: o.ls || {} });
  await p.addInitScript(PRE);
  await p.addInitScript({ path: MOCK });
  await p.addInitScript(POST);
  await p.clock.setFixedTime(new Date(o.time || T7));
  await p.goto(url, { waitUntil: "load" });
  await p.waitForTimeout(1500);
  return { ctx, p, errs };
}

const JPEG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");
const norm = s => String(s || "").replace(/\s+/g, " ").trim();

async function day(browser, url, name, o) {
  const out = path.join(OUT, name); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  const ES = o.lang === "es";
  const ok = (c, m) => { if (!c) fails.push(`${name}: ${m}`); return !!c; };
  const s = await open(browser, url, { vp: o.vp, modes: o.modes, ls: { "hmp-app-lang": o.lang, "hmp-app-tab": "now" } });
  const { p, errs } = s;
  let n = 0;
  const shot = nm => p.screenshot({ path: path.join(out, String(++n).padStart(2, "0") + "-" + nm + ".png") }).catch(() => {});
  const vis = sel => p.locator(sel).locator("visible=true").first();
  const click = async (sel, wait) => { const l = vis(sel); await l.evaluate(e => e.scrollIntoView({ block: "center" }), null, { timeout: 3000 }).catch(() => {}); await l.click({ timeout: 3000 }); await p.waitForTimeout(wait || 450); };
  const text = sel => vis(sel).innerText({ timeout: 3000 });
  const store = () => p.evaluate(() => Object.fromEntries(window.__mockDb.store));
  const doc = async pth => { await settle(); return docNow(pth); };
  const docNow = pth => p.evaluate(x => { const v = window.__mockDb.store.get(x); return v ? JSON.parse(JSON.stringify(v)) : null; }, pth);
  const writes = () => p.evaluate(() => window.__mockLog.filter(x => x[0] === "set" || x[0] === "update" || x[0] === "delete").map(x => x[1]));
  const closeSheet = async () => { if (await p.locator("#sheetWrap:not([hidden])").count()) await click("#shClose").catch(() => {}); };
  const probe = async () => { const t = Date.now(); return Promise.race([p.evaluate(() => 1).then(() => Date.now() - t), new Promise(r => setTimeout(() => r(9999), 5000))]); };
  const step = async (nm, fn) => { const t0 = Date.now(); try { await fn(); } catch (e) { fails.push(`${name}: ${nm}: ${String(e.message || e).split("\n").filter(x => x.trim()).slice(0, 3).join(" ").replace(/\x1b\[[0-9;]*m/g, "")}`); await shot("FAIL-" + nm); throw e; }
    const ms = await probe(); ok(ms < 1500, `${nm}: the screen froze (${ms} ms to answer)`); notes.push(`${name}: ${nm} ${Date.now() - t0} ms`); };
  const rh = async (msg, answer) => {   // the Right Hand: a short message; the mocked AI answers with `answer` through the page's real apply path
    await p.evaluate(a => window.__rhNext.push(a), answer);
    await closeSheet();
    if (!(await p.locator("#kcInput").isVisible())) { if (await p.evaluate(() => document.body.dataset.tab) === "knock") await click("#tb-now"); await click("#rhBtn"); }
    await p.fill("#kcInput", msg); await click("#kcSend", 1200);
    for (let i = 0; i < 30 && await p.isDisabled("#kcInput").catch(() => false); i++) await p.waitForTimeout(500);   // a slow Right Hand: wait for its answer
    ok(!(await p.isDisabled("#kcInput").catch(() => false)), "the chat box is still locked 15 s after sending");
    await settle();
    return p.evaluate(() => [...document.querySelectorAll("#kcLog .rc")].map(e => e.textContent));
  };
  const leadIdFor = addr => p.evaluate(a => { for (const [k, v] of window.__mockDb.store) if (k.startsWith("leads/") && String(v.address || "").trim() === String(a || "").trim()) return k.slice(6); return null; }, addr);
  const settle = async () => { for (let i = 0; i < 40; i++) { if (await p.evaluate(() => JSON.parse(localStorage.getItem("hmp-app-outbox") || "[]").length === 0)) return; await p.waitForTimeout(500); } ok(false, "the outbox never drained (20 s)"); };
  const kNow = () => p.evaluate(() => { const b = document.querySelector("#kNow"); return b ? { pid: b.dataset.pid, addr: (b.querySelector(".addr") || {}).textContent } : null; });
  const ctx = {};
  try {
    await step("7am-now", async () => {
      ok(await p.evaluate(() => document.querySelector("#live") && document.querySelector("#live").dataset.state) === "on", "7 AM: the live dot is not on");
      ok(await p.locator("#zMap").isVisible(), "7 AM: no map on Now");
      ok(await p.locator("#zSvg [data-zone], #zMap .zpin, #zPin").count() > 0, "7 AM: no hot zone on the map");
      const z = await text("#zones");
      ok(new RegExp(ES ? "Mejor zona" : "Best zone today").test(z), "7 AM: no 'Best zone today' (Aldaba's pick): " + norm(z).slice(0, 120));
      ok(/N Clarkson St & E 17th St/.test(z), "7 AM: the pick is not the engine's #1 zone (N Clarkson St & E 17th St)");
      ok(/#1\b|1 de 3|of 3/.test(z), "7 AM: the pick doesn't say how many hot zones there are");
      await shot("now-7am");
    });
    await step("pick-zone", async () => {
      await click('[data-open="zones:"]');
      const rows = await p.locator("#shBody [data-pickzone]").count();
      ok(rows === 3, `the zones list shows ${rows} zones, expected 3`);
      await shot("zones-list");
      await p.locator("#shBody [data-pickzone]").nth(1).click(); await p.waitForTimeout(500);
      await closeSheet();
      ok(/E Linden Ave & E 12th St/.test(await text("#zones")), "picking zone #2 didn't show it on Now");
      await click("#zGo", 800);
      ok(await p.evaluate(() => document.body.dataset.tab) === "knock", "Start knocking didn't open Knock");
      ok(/E Linden Ave/.test(await text("#knock")), "Knock is not on the picked zone");
      await shot("knock-start");
    });
    await step("knock-walk", async () => {
      const order = await p.evaluate(() => { const w = window.__mockDb.store.get("walks/2026-09-29_Fremont_2~t1"); return (w.stops || w.doors || w.homes || []).map(x => x.pid || x.id); });
      const seen = [];
      for (const r of ["not_home", "no", "interested", "booked"]) {
        const d = await kNow(); ok(d && d.pid, "no current door on Knock before " + r); seen.push(d.pid);
        if (r === "interested") ctx.intr = d; if (r === "booked") ctx.book = d;
        await click(`#kNow .ans[data-r="${r}"]`, 500);
        if (r === "booked") {
          await shot("booking");
          await click('.book [data-pick="day"] button >> nth=1');   // tomorrow
          await click('.book [data-pick="time"] [data-v="16:00"]');
          await click('.book [data-book="save"]', 800);
        }
      }
      if (o.modes && o.modes.dbw === "slow") {   // a slow signal: close the app while the last taps are still on their way
        await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1500);
      }
      await settle();
      if (order.length) ok(JSON.stringify(seen) === JSON.stringify(order.slice(0, 4)), "the walk is not in the engine's order: " + JSON.stringify(seen) + " vs " + JSON.stringify(order.slice(0, 4)));
      const doors = (await Promise.all(seen.map(pid => doc("doors/2026-09-29_" + pid)))).map(d => d && d.result);
      ok(JSON.stringify(doors) === JSON.stringify(["not_home", "no", "interested", "booked"]), "the door docs don't hold the 4 answers: " + JSON.stringify(doors));
      ctx.intr.id = await leadIdFor(ctx.intr.addr); ctx.book.id = await leadIdFor(ctx.book.addr);
      const LI = ctx.intr.id && await doc("leads/" + ctx.intr.id), LB = ctx.book.id && await doc("leads/" + ctx.book.id);
      notes.push(`${name}: interested lead ${JSON.stringify(LI && { stage: LI.stage, next: LI.next_step })}`);
      ok(LI, "the Interested door did not become a lead");
      ok(LB && LB.stage === "inspection_set" && LB.appt && LB.appt.time === "16:00", "the Booked door is not an inspection_set lead at 4 PM: " + JSON.stringify(LB && { stage: LB.stage, appt: LB.appt }));
      ok(!LI || !/\b(owner|first_name)\b/.test(Object.keys(LI).join(" ")) || !LI.owner, "a lead from a door carries an owner name");
      await shot("knock-4-taps");
    });
    await step("reload-mid-flow", async () => {
      const before = await kNow(), w0 = (await writes()).length;
      await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1800);
      ok(await p.evaluate(() => document.body.dataset.tab) === "knock", "after a reload the app is not back on Knock");
      const after = await kNow();
      ok(after && before && after.pid === before.pid, "after a reload Knock is not on the same next door: " + JSON.stringify({ before, after }));
      ok(/\b4\s*\/\s*20\b/.test(norm(await text("#knock"))), "after a reload the door count is not 4 / 20");
      ok(await leadIdFor(ctx.book.addr), "after a reload the booked lead is gone");
      await shot("after-reload");
    });
    const openLead = async id => {
      await closeSheet(); await click("#tb-leads");
      for (const f of ["due", "active", "won", "all"]) { if (await p.locator(`[data-open="lead:${id}"]`).locator("visible=true").count()) break; if (await p.locator(`#lfStage [data-f="${f}"]`).count()) await click(`#lfStage [data-f="${f}"]`, 300); }
      await click(`[data-open="lead:${id}"]`, 700); };
    const nsDone = async label => { const b = vis("#nsCard [data-nsdone]"); ok(await b.isEnabled(), label + ": Done is disabled"); await b.evaluate(e => e.scrollIntoView({ block: "center" })); await b.click(); await p.waitForTimeout(700); };
    const stepName = () => text("#shBody .stagebar .tx");
    await step("inspection", async () => {
      await openLead(ctx.book.id);
      await shot("lead-booked");
      ok(/2 (of|de) 8/i.test(await stepName()), "the booked lead is not on step 2: " + (await stepName()));
      await nsDone("set");
      ok(/3 (of|de) 8/i.test(await stepName()), "after 'set' the lead is not on step 3 (inspect)");
      await click(`[data-open="lph:${ctx.book.id}"]`);
      const inp = p.locator('#shBody input[type="file"][data-slot]').first();
      await inp.setInputFiles({ name: "roof.jpg", mimeType: "image/jpeg", buffer: JPEG }); await p.waitForTimeout(1500);
      const L = await doc("leads/" + ctx.book.id);
      ok(L && Array.isArray(L.photos) && L.photos.length >= 1, "the inspection photo was not saved on the lead: " + JSON.stringify(L && L.photos));
      ok(await p.evaluate(() => window.__uploads.length) >= 1, "the photo never went to the photo store");
      await shot("lead-photo");
      const rc = await rh(`${ctx.book.addr}: hail hits on the ridge and the gutters, 8 hits per square on the south slope`,
        { reply: "Logged the damage.", actions: [{ type: "update_lead", address: ctx.book.addr, notes: "Hail: ridge + gutters dented, 8 hits per test square (south slope)." }] });
      ok(rc.some(x => /✓/.test(x)), "the damage notes were not logged: " + JSON.stringify(rc));
      ok(/8 hits/.test(((await doc("leads/" + ctx.book.id)) || {}).notes || ""), "the damage notes are not on the lead");
      await openLead(ctx.book.id);
      await nsDone("inspect");
      ok(/4 (of|de) 8/i.test(await stepName()), "after 'inspect' the lead is not on step 4 (table): " + (await stepName()));
      await shot("lead-inspected");
    });
    await step("quick-price", async () => {
      await openLead(ctx.book.id);
      await click(`#shBody [data-open="est:${ctx.book.id}"]`, 700);
      await click('#shBody [data-k="job:roof"]', 400);
      for (let i = 0; i < 3; i++) await click('#shBody [data-k="roof:+b"]', 200);
      const t = norm(await p.innerText("#shBody"));
      if (EXPLORE) console.log("EST:", t.slice(0, 900));
      ok(ES ? /Rango estimado, no (es )?(precio )?final/i.test(t) : /Estimate range, not (a )?final/i.test(t), "the quick price is not labeled 'estimate range, not final': " + t.slice(0, 200));
      ok(/\$[\d,]+\s*[–-]\s*\$[\d,]+/.test(t), "the quick price shows no low-high range");
      await shot("quick-price");
      const sv = p.locator('#shBody [data-act="save"]');
      if (await sv.count()) { await sv.first().click(); await p.waitForTimeout(800); const L = await doc("leads/" + ctx.book.id); ok(L && L.estimate && L.estimate.low > 0 && L.estimate.high >= L.estimate.low, "the range was not saved to the lead"); }
      else ok(false, "the quick price has no Save to lead button");
    });
    await step("claim", async () => {
      const rc = await rh(`${ctx.book.addr}: claim filed with State Farm, claim 45-7781, adjuster Thursday 10`, { reply: "Logged the claim.", actions: [
        { type: "update_claim", address: ctx.book.addr, city: "Fremont", insurer: "State Farm", claim_no: "45-7781", stage: "claim_filed", date_of_loss: "2026-09-29", adjuster_date: "2026-10-01" },
        { type: "update_lead", address: ctx.book.addr, next_step: { en: "Adjuster Thu Oct 1, 10 AM", es: "Ajustador jue 1 oct, 10 AM", due: "2026-10-01" } }] });
      ok(rc.filter(x => /✓/.test(x)).length >= 2, "the claim was not logged: " + JSON.stringify(rc));
      const C = await p.evaluate(a => { for (const [k, v] of window.__mockDb.store) if (k.startsWith("claims/") && v.address === a) return Object.assign({ id: k.slice(7) }, v); return null; }, ctx.book.addr);
      ok(C && C.insurer === "State Farm" && C.claim_no === "45-7781" && C.adjuster_date === "2026-10-01", "no claim doc with insurer, claim # and the adjuster date: " + JSON.stringify(C));
      ctx.claim = C && C.id;
      await closeSheet(); await click("#tb-money");
      await click(`[data-open="claim:${ctx.claim}"]`, 700);
      const t = norm(await p.innerText("#sheetWrap"));
      ok(/State Farm/.test(t) && /45-7781/.test(t), "the claim screen doesn't show the insurer and claim #");
      ok(/Oct 1|1 de oct|1 oct/i.test(t), "the claim screen doesn't show the adjuster meeting: " + t.slice(0, 300));
      await shot("claim");
    });
    await step("paper", async () => {
      await openLead(ctx.book.id);
      await nsDone("table");
      ok(/5 (of|de) 8/i.test(await stepName()), "after 'table' the lead is not on step 5 (paper)");
      ok(!(await vis("#nsCard [data-nsdone]").isEnabled()), "HARD STOP: paper Done is enabled before the must-ticks");
      const cancel = norm(await text("#shBody .ns-cancel"));
      ok(/Oct 2|2 de oct/i.test(cancel), "the 3-day cancel date (signed today Tue -> Fri Oct 2) is wrong: " + cancel);
      // the fixed legal text, read from the paper step itself: the cancel notice EN + ES and the 44-8607 notice word for word
      const legal = p.locator('#shBody [data-paperlegal]');
      ok(await legal.count() >= 2, "the paper step has no way to show the cancel notice and the deductible notice");
      if (await legal.count() >= 2) {
        await click('#shBody [data-paperlegal="cancel_notice"]', 400);
        const c = norm(await p.innerText("#shBody"));
        ok(/NOTICE OF CANCELLATION/i.test(c) && /AVISO DE CANCELACI[OÓ]N/i.test(c), "the paper step's cancel notice is not in English AND Spanish");
        ok(c.includes("2600 Laverna St, Apt 50, Fremont, NE 68025"), "the cancel notice has no HMP mailing address");
        await shot("paper-cancel-notice");
        await click('#shBody [data-paperlegal="deductible_notice"]', 400);
        const d = norm(await p.innerText("#shBody"));
        ok(d.includes(STATUTE), "the paper step's deductible notice is not the 44-8607 text word for word");
        ok(/REEMBOLSAR CUALQUIER PARTE DE UN DEDUCIBLE/.test(d), "the deductible notice has no Spanish");
        await shot("paper-deductible-notice");
      }
      for (const k of ["contract", "cancelSaid", "copies", "dedNotice"]) await click(`#shBody [data-nstick="${k}"]`);
      await nsDone("paper");
      const L = await doc("leads/" + ctx.book.id);
      ok(L && L.signed_on === "2026-09-29" && L.cancel_by === "2026-10-02", "signing did not set signed_on / cancel_by: " + JSON.stringify(L && { s: L.signed_on, c: L.cancel_by }));
      await shot("paper-signed");
    });
    await step("follow-ups-calls", async () => {
      await closeSheet(); await click("#tb-now");
      const t = norm(await text("#tab-now"));
      ok(/Calls today|Llamadas de hoy/.test(t), "Now has no Calls today");
      ok(await p.locator("#tCalls li, #tCalls [data-open^='call:']").count() >= 1, "Calls today lists no business line");
      await click('#tCalls [data-open^="call:"]', 600);
      ok(/402-\d{3}-\d{4}/.test(await text("#shBody")), "a call row doesn't open its call sheet with the number");
      await closeSheet();
      // tomorrow: the Interested door comes up as a follow-up
      await p.clock.setFixedTime(new Date("2026-09-30T07:00:00-05:00"));
      await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1800);
      await click("#tb-now");
      await click('#tab-now [data-open="due:"]', 600);
      const d = norm(await text("#shBody"));
      ok(d.includes(ctx.intr.addr.trim().replace(/ (St|Ave|Dr|Rd)$/, "")), "tomorrow the Interested door is not on the follow-up list: " + d.slice(0, 300));
      await shot("tomorrow-followups");
      await p.clock.setFixedTime(new Date("2026-09-29T18:30:00-05:00"));
      await p.reload({ waitUntil: "load" }); await p.waitForTimeout(1800);
    });
    await step("chat-logs", async () => {
      const rc1 = await rh("12 doors, 3 talks on Linden", { reply: "Logged.", actions: [{ type: "log_doors", doors: 12, conversations: 3 }] });
      ok(rc1.some(x => /✓/.test(x)), "the chat didn't log the doors: " + JSON.stringify(rc1.slice(-1)));
      const wk = (await doc("stats/week-2026-40")) || {};
      ok(wk.doors >= 12 && wk.conversations >= 3, "log_doors didn't add 12 doors / 3 talks to this week's stats: " + JSON.stringify(wk).slice(0, 200));
      const rc2 = await rh("new lead 1418 N Irving St, referral from the neighbor, call Thursday", { reply: "Logged.", actions: [{ type: "log_lead", address: "1418 N Irving St", city: "Fremont", source: "referral", lead_type: "insurance", stage: "contacted", next_step: { en: "Call Thu", es: "Llamar jue", due: "2026-10-01" } }] });
      ok(rc2.some(x => /✓/.test(x)), "the chat didn't log the lead: " + JSON.stringify(rc2.slice(-1)));
      const rc3 = await rh(`${ctx.intr.addr}: Allstate claim 889-12`, { reply: "Logged.", actions: [{ type: "update_claim", address: ctx.intr.addr, insurer: "Allstate", claim_no: "889-12", stage: "claim_filed" }] });
      ok(rc3.some(x => /✓/.test(x)), "the chat didn't log the claim: " + JSON.stringify(rc3.slice(-1)));
      const rc4 = await rh(`${ctx.intr.addr}: tell them we'll cover the deductible`, { reply: "No.", actions: [{ type: "update_lead", address: ctx.intr.addr, notes: "we cover the deductible" }] });
      ok(!/cover the deductible/.test(((await doc("leads/" + ctx.intr.id)) || {}).notes || ""), "LEGAL: a 'cover the deductible' note was saved (44-8604)");
      await shot("chat-logs");
    });
    await step("end-of-day", async () => {
      await closeSheet(); await click("#plusBtn", 400);
      await click('#shBody [data-done="1"]', 900);
      const t = norm(await text("#shBody"));
      if (EXPLORE) console.log("REVIEW:", t.slice(0, 600));
      ok(/\b4\b/.test(t) && /1 (booked|agendad)/i.test(t) || /4 doors|4 puertas/i.test(t), "the end-of-day numbers don't show the 4 doors / 1 booked: " + t.slice(0, 200));
      await shot("end-of-day");
      await click("#revSave", 900);
      const R = await doc("reviews/2026-09-29");
      ok(R && R.doors === 4 && R.booked === 1 && R.interested === 1, "the day's review was not saved with the day's numbers: " + JSON.stringify(R && { d: R.doors, b: R.booked, i: R.interested }));
    });
    if (EXPLORE) { console.log(norm(await p.innerText("#tab-knock")).slice(0, 1500)); }
  } catch (e) { /* recorded by step */ }
  ok(!errs.length, "page errors: " + errs.slice(0, 4).join(" | "));
  const un = await p.evaluate(() => window.__unhandled || []).catch(() => []);
  ok(!un.length, "unhandled rejections: " + un.join(" | "));
  await s.ctx.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined });
  const url = await pageUrl("pages/hmp-app.html");
  const want = k => !only.length || only.includes(k);
  try {
    if (want("en")) await day(browser, url, "en", { lang: "en" });
    if (want("es")) await day(browser, url, "es", { lang: "es" });
    if (want("slow")) await day(browser, url, "slow", { lang: "en", modes: { dbw: "slow", sample: "slow", mcp: "fail" } });   // 3 s writes, a 3 s Right Hand
  } catch (e) { fails.push("harness crashed: " + (e.stack || e.message)); }
  finally { await browser.close(); await closeServer(); }
  for (const x of notes) console.log("  " + x);
  if (fails.length) { console.log(`\nFAIL (${fails.length})`); for (const f of fails) console.log("  - " + f); process.exit(1); }
  console.log("\nPASS e2e_day_check");
})();
