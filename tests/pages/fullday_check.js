#!/usr/bin/env node
/* Full fake sales day (FilthE, 2026-09-27 "No knocking yet": prove the app end to end before he knocks).
 * The HMP App in Practice mode (T201, nothing saves) with the practice houses (v25/practice-houses.js: 60 made-up homes on
 * real Fremont streets, the real SPC 2026-06-13 1.00" Fremont hail report), driven like a salesman's day:
 *   Now -> Load practice houses -> pick a zone -> Knock the walk (not home / no / interested / booked)
 *   -> the booked lead: set, inspect (a practice photo), table, paper (the must-ticks + the 3-day cancel date)
 *   -> claim filed (next-step card) -> the Right Hand logs the claim (mocked AI answer = the page's real update_claim path)
 *   -> hard stops: the Right Hand's tear-off is refused (44-8606 + cancel window), the Job tracker shows the lock,
 *      the lead's "Job done" is refused -> Job #1 tracker steps 1-9 tapped -> itemized to homeowner AND insurer
 *   -> 4 days later the window is over: tear-off + install unlock and log.
 * Also: Now's Calls today in Practice (made-up "Storm hit your customer" homes on the practice streets + made-up business
 * lines 402-555-01xx), and the claim screen's quiet storm-age line (Jun 13 storm = 107 days: "check your policy's time limit").
 * The database gets ZERO writes and no photo is uploaded or deleted. Runs at 1470x956 (MacBook first) then 390x844.
 *   NODE_PATH=/opt/node22/lib/node_modules node tests/pages/fullday_check.js [--out DIR] [--only 1470|390]   Exit 0 = pass. */
"use strict";
const fs = require("fs");
const path = require("path");
const { pageUrl, closeServer } = require("./serve");
const { data, initScript } = require("./v25_shots");

const args = process.argv.slice(2);
const OUT = args.includes("--out") ? path.resolve(args[args.indexOf("--out") + 1]) : path.join(__dirname, "out", "fullday");
const ONLY = args.includes("--only") ? +args[args.indexOf("--only") + 1] : 0;
const START = "2026-09-28T09:30:00-05:00";   // Monday 9:30 AM Central
function loadPlaywright() {
  for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright"]) { try { return require(p); } catch (e) { /* next */ } }
  throw new Error("playwright not found (set NODE_PATH=/opt/node22/lib/node_modules)");
}
const fails = [];

// the database, the photo store and the AI are wrapped: every db write / upload / delete is counted; the Right Hand's
// answers come from window.__rhNext (queued by the test) through the page's real askKing -> applyActions path
const HARNESS = `(() => { window.__writes = []; window.__uploads = []; window.__deletes = []; window.__rhNext = []; window.__rhAsked = [];
  const use = window.claude.use;
  window.claude.use = async n => { const c = await use(n);
    if (n === 'sample') { const s = async () => ({ text: '' });
      s.json = async (msgs) => { window.__rhAsked.push(String(msgs[msgs.length - 1].content || '')); return window.__rhNext.shift() || { reply: 'OK', actions: [] }; };
      s.limits = async () => ({ maxPromptBytes: 65536 }); return s; }
    if (n === 'assets' && c && !c.__w) { c.__w = 1; const u = c.upload, d = c.delete;
      c.upload = async (...a) => { window.__uploads.push(1); return u(...a); }; c.delete = async id => { window.__deletes.push(id); return d(id); }; return c; }
    if (n !== 'db' || !c) return c;
    const wrap = d => Object.assign({}, d, {
      set: async (v, x) => { window.__writes.push(['set', d.path]); return d.set(v, x); },
      update: async v => { window.__writes.push(['update', d.path]); return d.update(v); },
      delete: async () => { window.__writes.push(['delete', d.path]); return d.delete(); } });
    return { doc: p => wrap(c.doc(p)), collection: n2 => { const q = c.collection(n2); const od = q.doc; q.doc = id => wrap(od(id)); return q; } }; };
  try { localStorage.setItem('hmp-app-practice', '1'); } catch (e) {} })();`;

// a 1x1 JPEG for the practice photo (never uploaded)
const JPEG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");

async function day(browser, url, W, H) {
  const tag = String(W), out = path.join(OUT, tag); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  const ok = (c, m) => { if (!c) fails.push(`${tag}: ${m}`); return c; };
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: "light", timezoneId: "America/Chicago", reducedMotion: "reduce" });
  await ctx.route(/^(https?|wss?):/, r => (/^https?:\/\/127\.0\.0\.1[:/]/.test(r.request().url()) ? r.continue() : r.abort()));
  // the fixture's real leads/claims stay as "the database"; no zones or walks in it: the practice houses bring those
  const init = initScript({ tab: "now" }, data({ emptyZones: true }))
    .replace(/const FIXED = Date\.parse\([^)]*\)/, `let FIXED = Date.parse(${JSON.stringify(START)}); window.__travel = days => { FIXED += days * 864e5; }`);
  if (!/__travel/.test(init)) throw new Error("the v25_shots clock changed: fullday_check can't move the date");
  await ctx.addInitScript(init);
  await ctx.addInitScript(HARNESS);
  const p = await ctx.newPage(), errs = [];
  p.on("pageerror", e => errs.push(String((e && e.message) || e)));
  p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) errs.push("console: " + m.text()); });
  await p.goto(url, { waitUntil: "load" });
  await p.waitForTimeout(800);
  let n = 0;
  const shot = name => p.screenshot({ path: path.join(out, String(++n).padStart(2, "0") + "-" + name + ".png") });
  const vis = sel => p.locator(sel).locator("visible=true").first();
  // centre the target first: the composer + tab bar are fixed over the bottom ~150 px (a thumb scrolls past them too)
  const click = async (sel, wait) => { const l = vis(sel); await l.evaluate(e => e.scrollIntoView({ block: "center" }), null, { timeout: 3000 }).catch(() => {}); await l.click({ timeout: 3000 }); await p.waitForTimeout(wait || 450); };
  const step = async (name, fn) => { try { await fn(); } catch (e) { fails.push(`${tag}: ${name}: ${String(e.message || e).split("\n").filter(x => x.trim()).slice(0, 3).join(" ").replace(/\x1b\[[0-9;]*m/g, "")}`); await shot("FAIL-" + name).catch(() => {}); throw e; } };
  const text = sel => vis(sel).innerText({ timeout: 3000 });
  const todayStr = () => p.evaluate(() => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); });
  const practiceDoc = pth => p.evaluate(x => { const o = window.HMPPractice.ops().filter(y => y.path === x).pop(); return o ? o.body : null; }, pth);
  const rh = async (msg, answer) => {   // tell the Right Hand; the mocked AI answers with `answer`; returns the receipts
    await p.evaluate(a => window.__rhNext.push(a), answer);
    if (!(await p.locator("#kcInput").isVisible())) { if (await p.locator("#sheetWrap:not([hidden])").count()) await click("#shClose"); await click("#rhBtn"); }
    await p.fill("#kcInput", msg); await click("#kcSend", 900);
    return p.evaluate(() => [...document.querySelectorAll("#kcLog .rc")].map(e => e.textContent));
  };
  let lead = null, addr = null;
  try {
    await step("start", async () => {
      ok(await p.locator("#practiceBar").isVisible(), "the Practice bar is not showing");
      await shot("now-no-zones");
    });
    await step("load-houses", async () => {
      await click("#moreBtn");
      ok(/Load practice houses/.test(await text("#prHousesBtn")), "More: no 'Load practice houses' row");
      await click("#prHousesBtn", 1200);
      ok(await p.evaluate(() => !!(window.HMPPractice.houses() && window.HMPPractice.houses().zones.zones.length === 3)), "the practice houses did not load (3 zones)");
      ok(/Practice houses loaded/.test(await text("#prHousesBtn")), "More: the row did not switch to 'loaded'");
      await shot("more-loaded");
      await click("#shClose");
      ok(/Fremont/.test(await text("#zones")), "Now: the best zone is not a Fremont practice zone");
      await shot("now-zones");
      // Calls today in Practice: 2 made-up customers' homes hit by the Jun 13 storm first, then 2 made-up business lines
      const calls = await p.locator("#callsS").innerText().catch(() => "");
      const rows = await p.locator("#tCalls li").allInnerTexts();
      ok(rows.length === 4 && /Storm hit your customer/.test(rows[0]) && /Storm hit your customer/.test(rows[1]) && /107 days ago/.test(rows[0]), "Practice: Calls today is not 2 account hits first (107 days ago) + 2 calls: " + JSON.stringify(rows));
      ok(/402-555-01\d\d/.test(rows[2] || "") && /Practice/.test(calls), "Practice: the business calls are not made-up 402-555-01xx lines marked Practice");
      ok(!/insurance|deductible/i.test(calls), "Practice: Calls today talks insurance: " + calls);
      await p.locator("#callsS").evaluate(e => e.scrollIntoView({ block: "center" })); await p.waitForTimeout(250);
      await shot("now-calls-practice");
      await click("#tCalls li:nth-child(3) button[data-open]", 600);
      ok(/Practice: apartments/.test(await text("#shTitle")) && /402-555-01/.test(await text("#shBody")), "Practice: a business call row does not open its call sheet");
      await shot("call-sheet-practice");
      await click("#shClose");
    });
    await step("pick-zone", async () => {
      await click('[data-open="zones:"]');
      const rows = await p.locator("#shBody [data-pickzone]").count();
      ok(rows === 3, `the zones sheet lists ${rows} zones, expected 3`);
      await shot("zones-sheet");
      await p.locator("#shBody [data-pickzone]").nth(1).click(); await p.waitForTimeout(500);
      if (await p.locator("#sheetWrap:not([hidden])").count()) await click("#shClose");
      await click("#zGo", 700);
      ok(await p.evaluate(() => document.body.dataset.tab) === "knock", "Start knocking did not open Knock");
      const zone2 = await p.evaluate(() => window.HMPPractice.houses().zones.zones[1].name.replace(/^Fremont:\s*/, ""));
      ok((await text("#knock")).includes(zone2), "Knock is not on the picked zone (" + zone2 + ")");
      await shot("knock-start");
    });
    await step("knock", async () => {
      const cur = () => p.evaluate(() => { const b = document.querySelector("#kNow"); return b && b.dataset.pid; });
      const a0 = await cur();
      await click('#kNow .ans[data-r="not_home"]');
      ok((await cur()) !== a0, "not home did not move to the next door");
      await click('#kNow .ans[data-r="no"]');
      await click('#kNow .ans[data-r="interested"]');
      await shot("knock-3-taps");
      lead = await cur(); addr = await p.evaluate(() => document.querySelector("#kNow .addr").textContent.trim());
      await click('#kNow .ans[data-r="booked"]');
      await click('.book [data-pick="day"] button >> nth=0');   // today
      await click('.book [data-pick="time"] [data-v="16:00"]');
      await shot("knock-booking");
      await click('.book [data-book="save"]', 700);
      const tt = await text("#knock");
      ok(/\b4\s*\/\s*20\b/.test(tt.replace(/\n/g, " ")), "the door count is not 4 / 20");
      const doors = await p.evaluate(() => window.HMPPractice.ops().filter(o => o.path.startsWith("doors/")).map(o => o.body.result));
      ok(["not_home", "no", "interested", "booked"].every(r => doors.includes(r)), "door taps kept in Practice: " + JSON.stringify(doors));
      const L = await practiceDoc("leads/" + lead);
      ok(L && L.stage === "inspection_set" && L.appt && L.appt.time === "16:00", "the booked door did not make an inspection_set lead: " + JSON.stringify(L && { stage: L.stage, appt: L.appt }));
      await shot("knock-4-taps");
    });
    const openLead = async () => {   // Leads tab -> whichever list (Due / Active / Won) holds the lead today -> its sheet
      if (await p.locator("#sheetWrap:not([hidden])").count()) await click("#shClose");
      await click("#tb-leads");
      for (const f of ["due", "active", "won"]) { if (await p.locator(`[data-open="lead:${lead}"]`).locator("visible=true").count()) break; await click(`#lfStage [data-f="${f}"]`, 300); }
      await click(`[data-open="lead:${lead}"]`, 600); };
    const done = async (label) => { const b = vis("#nsCard [data-nsdone]"); ok(await b.isEnabled(), label + ": Done is disabled"); await b.scrollIntoViewIfNeeded(); await b.click(); await p.waitForTimeout(600); };
    const stepName = () => text("#shBody .stagebar .tx");
    await step("lead-set-inspect", async () => {
      await openLead();
      ok(/2 of 8/i.test(await stepName()), "the booked lead is not on step 2: " + (await stepName()));
      await shot("lead-step2");
      await done("set");
      ok(/3 of 8/i.test(await stepName()), "after 'set' the lead is not on step 3 (inspect)");
      // a practice photo at the inspection: shown, never uploaded
      await click(`[data-open="lph:${lead}"]`);
      const inp = p.locator('#shBody input[type="file"][data-slot]').first();
      await inp.setInputFiles({ name: "roof.jpg", mimeType: "image/jpeg", buffer: JPEG }); await p.waitForTimeout(1200);
      const ph = await practiceDoc("leads/" + lead);
      ok(ph && Array.isArray(ph.photos) && ph.photos.some(x => /^practice-/.test(x.id)), "the inspection photo was not kept as a practice photo");
      await shot("lead-photo");
      await click("#shClose").catch(() => {});
      await openLead();
      await done("inspect");
      ok(/4 of 8/i.test(await stepName()), "after 'inspect' the lead is not on step 4 (table)");
      await done("table");
    });
    await step("paper-cancel", async () => {
      ok(/5 of 8/i.test(await stepName()), "after 'table' the lead is not on step 5 (paper)");
      const b = vis("#nsCard [data-nsdone]");
      ok(!(await b.isEnabled()), "HARD STOP: paper Done is enabled before the contract / 3-day cancel / copies / deductible ticks");
      const cancelTxt = await text("#guideCard .ns-cancel");
      ok(/Oct 1|10\/1/.test(cancelTxt), "the 3-day cancel date is not Thu Oct 1: " + cancelTxt);
      await shot("paper-locked");
      for (const k of ["contract", "cancelSaid", "copies", "dedNotice"]) await click(`#guideCard [data-nstick="${k}"]`);
      await shot("paper-ticked");
      await done("paper");
      const L = await practiceDoc("leads/" + lead);
      ok(L && L.signed_on === (await todayStr()) && L.cancel_by === "2026-10-01", "signing did not set signed_on/cancel_by: " + JSON.stringify(L && { s: L.signed_on, c: L.cancel_by }));
      ok(/6 of 8/i.test(await stepName()), "after 'paper' the lead is not on step 6 (claim)");
      await done("claim filed");
      await shot("lead-claim-filed");
    });
    const cid = () => lead;
    await step("right-hand-claim", async () => {
      const t0 = await todayStr();
      const rc = await rh(`${addr}: claim filed with State Farm, claim 45-7781, adjuster Thursday`, { reply: "Logged the claim.", actions: [
        { type: "update_claim", address: addr, city: "Fremont", insurer: "State Farm", claim_no: "45-7781", stage: "claim_filed", date_of_loss: "2026-06-13", adjuster_date: "2026-10-01",
          job: { contingency_signed: t0 } }] });
      ok(rc.some(x => /✓/.test(x)), "the Right Hand's claim was not logged: " + JSON.stringify(rc));
      const C = await practiceDoc("claims/" + cid());
      ok(C && C.insurer === "State Farm" && C.stage === "claim_filed", "no practice claim doc: " + JSON.stringify(C));
      await shot("rh-claim");
      // the adjuster meets, the scope comes in, the contract is signed today (Right Hand), then he tries to start the tear-off
      await rh(`${addr}: adjuster met, scope in, 21,400 RCV, contract signed today`, { reply: "Logged.", actions: [
        { type: "update_claim", address: addr, stage: "signed", scope_date: t0, rcv: 21400, contract_price: 21400, job: { adjuster_met: t0, contract_signed: t0 } }] });
      const C2 = await practiceDoc("claims/" + cid());
      ok(C2 && C2.job && C2.job.cancel_by === "2026-10-01", "contract signed: the claim's cancel_by is not Oct 1: " + JSON.stringify(C2 && C2.job));
      const rc3 = await rh(`${addr}: crew starts tear-off today`, { reply: "Logged.", actions: [{ type: "update_claim", address: addr, install: { start: t0 } }] });
      ok(rc3.some(x => /^!/.test(x.trim()) && /8606|itemized|insurer|cancel/i.test(x)), "HARD STOP: the Right Hand's tear-off was not refused: " + JSON.stringify(rc3.slice(-2)));
      const C3 = await practiceDoc("claims/" + cid());
      ok(!(C3.install && C3.install.start), "HARD STOP: install.start was written inside the cancel window");
      await shot("rh-hard-stop");
    });
    await step("lead-build-stop", async () => {
      await click("#shClose").catch(() => {});
      await openLead();
      // the adjuster date (Thu Oct 1, 10 AM) and the meeting, then the lead is on "build"
      await click('#nsCard [data-nspick="day"] [data-v="2026-10-01"]'); await click('#nsCard [data-nspick="time"] [data-v="10:00"]');
      await done("adjuster date");
      await done("adjuster met");
      const sid = await stepName();
      ok(/7 of 8/i.test(sid), "after the adjuster the lead is not on step 7 (build): " + sid);
      await shot("lead-build");
      // HARD STOP: a build day inside the 3-day cancel window (ends Thu Oct 1) can't be picked; Fri Oct 2 can
      const inside = await p.locator('#nsCard [data-nspick="day"] button').evaluateAll(bs => bs.filter(b => b.dataset.v <= "2026-10-01").map(b => b.disabled));
      ok(inside.length && inside.every(Boolean), "HARD STOP: build days inside the cancel window are pickable: " + JSON.stringify(inside));
      ok(/Oct 1/.test(await text("#nsCard .ns-after")), "the build picker does not say when the cancel window ends");
      await p.locator('#nsCard [data-nspick="day"] [data-v="2026-09-29"]').click({ force: true }).catch(() => {}); await p.waitForTimeout(300);
      ok(!(await vis("#nsCard [data-nsdone]").isEnabled()), "HARD STOP: Done is enabled with a build day inside the cancel window");
      await shot("lead-build-stop");
      await click('#nsCard [data-nspick="day"] [data-v="2026-10-02"]');
      await done("build day Fri Oct 2");
      const L = await practiceDoc("leads/" + lead);
      ok(L && L.stage === "job_scheduled" && L.appt && L.appt.day === "2026-10-02", "the build was not scheduled for Fri Oct 2: " + JSON.stringify(L && { stage: L.stage, appt: L.appt }));
      // "Job done" is locked while the window is open and the itemized copies aren't sent
      ok(!(await vis("#nsCard [data-nsdone]").isEnabled()) && /8606|itemized|insurer|cancel/i.test(await text("#nsCard .ns-stop")), "HARD STOP: the lead's 'Job done' is not locked before the window / itemized copies");
      await shot("lead-job-done-locked");
    });
    await step("job-tracker", async () => {
      await click("#shClose").catch(() => {});
      await click("#tb-money");
      await click(`[data-open="claim:${cid()}"]`, 700);
      ok(await p.locator("#jtBox").count() === 1, "the claim screen has no Job tracker");
      // round 59: the Jun 13 storm is 107 days old -> one quiet line, no countdown, no carrier deadline
      const age = await p.locator("#shBody #stormAge").innerText().catch(() => "");
      ok(/Storm is 107 days old: check your policy's time limit/.test(age), "the claim screen has no storm-age line for a 107-day-old storm: " + age);
      ok(!/deadline|left|remaining/i.test(age), "the storm-age line reads like a countdown: " + age);
      await p.locator("#shBody #stormAge").evaluate(e => e.scrollIntoView({ block: "center" })).catch(() => {}); await p.waitForTimeout(250);
      await shot("claim-storm-age");
      await p.locator("#jtBox").evaluate(e => e.scrollIntoView({ block: "start" })); await p.waitForTimeout(250);
      await shot("tracker-open");
      // step 10 (build) shows the hard stop: 44-8606 both copies + the cancel window
      await click('[data-jtopen="build"]');
      const stop = await text("#jtNow .jt-stop");
      ok(/insurer/i.test(stop) && /cancel/i.test(stop), "HARD STOP: step 10 does not show the itemized + cancel lock: " + stop);
      await shot("tracker-build-locked");
      // tapping a locked part is refused
      ok(await p.locator('#jtNow [data-jt="tear_off"]').count() === 0, "HARD STOP: tear-off is tappable while locked");
      // itemized description to the homeowner AND the insurer (step 5)
      await click('[data-jtopen="itemized"]');
      await click('#jtNow [data-jt="itemized_ho"]', 600);
      await click('[data-jtopen="itemized"]').catch(() => {});
      await click('#jtNow [data-jt="itemized_ins"]', 600);
      const C = await practiceDoc("claims/" + cid());
      ok(C && C.job && C.job.itemized_sent && C.job.itemized_sent.homeowner && C.job.itemized_sent.insurer, "itemized to both was not logged: " + JSON.stringify(C && C.job));
      // still inside the window: tear-off stays locked
      await click('[data-jtopen="build"]');
      ok(/cancel/i.test(await text("#jtNow .jt-stop")), "HARD STOP: the lock lifted before the 3-day window ended");
      await shot("tracker-itemized-still-locked");
      // steps 6-9: ACV check in + deposited, materials ordered, crew set, permit pulled
      for (const [s, k] of [["acv", "acv_in"], ["acv", "acv_dep"], ["materials", "ordered"], ["crew", "crew"], ["permit", "permit"]]) {
        await click(`[data-jtopen="${s}"]`).catch(() => {});
        await click(`#jtNow [data-jt="${k}"]`, 500);
      }
      const C2 = await practiceDoc("claims/" + cid());
      ok(C2.acv && C2.acv.deposited && C2.materials && C2.materials.ordered && C2.job.crew && C2.job.permit, "steps 6-9 were not all logged: " + JSON.stringify({ acv: C2.acv, m: C2.materials, crew: C2.job.crew, permit: C2.job.permit }));
      await shot("tracker-steps-1-9");
    });
    await step("after-window", async () => {
      // Friday Oct 2: the 3-day window (ends midnight Thu Oct 1) is over -> the tear-off unlocks
      await p.evaluate(() => window.__travel(4));
      await click("#shClose").catch(() => {});
      await click("#tb-money");
      await click(`[data-open="claim:${cid()}"]`, 700);
      await click('[data-jtopen="build"]').catch(() => {});   // step 10 is the current step now: already open
      ok(await p.locator("#jtNow .jt-stop").count() === 0, "after the window + itemized both, step 10 is still locked: " + (await p.locator("#jtNow .jt-stop").allInnerTexts()).join(" "));
      await click('#jtNow [data-jt="tear_off"]', 600);
      await click('[data-jtopen="build"]').catch(() => {});
      await click('#jtNow [data-jt="installed"]', 600);
      const C = await practiceDoc("claims/" + cid());
      ok(C.install && C.install.start === "2026-10-02" && C.install.done === "2026-10-02", "tear-off / install not logged after the window: " + JSON.stringify(C.install));
      await p.locator("#jtBox").evaluate(e => e.scrollIntoView({ block: "start" })); await p.waitForTimeout(250);
      await shot("tracker-built");
      // the lead's "Job done" unlocks too; the lead moves to step 8 (paid)
      await openLead();
      ok(await p.locator("#nsCard .ns-stop").count() === 0, "after the window + itemized both, the lead's 'Job done' is still locked");
      await done("job done");
      ok(/8 of 8/i.test(await stepName()), "after 'Job done' the lead is not on step 8 (paid): " + (await stepName()));
      await shot("lead-paid-step");
    });
  } catch (e) { /* the step already recorded it */ }
  // the whole day: nothing reached the database, nothing was uploaded or deleted
  const w = await p.evaluate(() => ({ writes: window.__writes.slice(), up: window.__uploads.length, del: window.__deletes.slice(), n: window.HMPPractice.count() }));
  ok(w.writes.length === 0, "the database got writes during a Practice day: " + JSON.stringify(w.writes.slice(0, 5)));
  ok(w.up === 0 && w.del.length === 0, `photos: ${w.up} uploads, ${w.del.length} deletes during Practice`);
  ok(!errs.length, "page errors: " + errs.join(" | "));
  // turning Practice off throws the whole day away and the real (empty) zones come back
  await click("#shClose").catch(() => {});
  await click('#practiceBar [data-practice="0"]').catch(() => {});
  ok(await p.evaluate(() => !window.HMPPractice.isOn() && window.HMPPractice.count() === 0 && !window.HMPPractice.houses()), "Practice off did not clear the day and the practice houses");
  await ctx.close();
  return w.n;
}

(async () => {
  const { chromium } = loadPlaywright();
  const exe = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
  const url = await pageUrl("pages/hmp-app.html");
  try {
    for (const [W, H] of [[1470, 956], [390, 844]]) if (!ONLY || ONLY === W) { const n = await day(browser, url, W, H); console.log(`${W}px: ${n} practice writes`); }
  } finally { await browser.close(); await closeServer(); }
  for (const f of fails) console.error("FAIL " + f);
  console.log(fails.length ? `fullday check: ${fails.length} failed (shots in ${OUT})` : "fullday check OK (shots in " + OUT + ")");
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
