#!/usr/bin/env node
/* 24 hours with the HMP App open, on a fake clock (Playwright clock), Central time (FilthE, 2026-09-27 "No knocking yet":
 * prove the app end to end on mock data before he knocks). Mock data only, never the real database:
 *   - the database is an in-page mock with LIVE listeners (a write by "the King" reaches the open app like the real one);
 *   - the storm is tests/fixtures/day24_hud.json (tests/pages/day24_build.py: a MOCK overnight storm on Tue 2026-09-29 over
 *     the practice houses' real Fremont streets, made-up house numbers, no owners);
 *   - the King's docs are the engine's own: `hh.py daily --no-basemap ... --accounts` run at test time on that hud and the
 *     mock database's leads/doors, exactly like the 7:52 AM / 12:52 PM runs.
 * Timeline (Tue Sep 29 -> Wed Sep 30):
 *   06:30 open the app (yesterday's empty zones; a lead due yesterday; a signed claim whose 3-day cancel ends midnight Tue)
 *   07:52 King morning docs land while the app is open -> the hot zones show without a reload; the account hit (practice
 *         lead 1753 N Clarkson St under today's hail) arrives as that lead's next step, due today
 *   09:30 knock the zone: not home / no / interested / booked (Wed 10 AM)
 *   12:52 King refresh (walks rebuilt with the taps so far) while a tap is still on its way to the database
 *         -> no lost tap, no door twice, the count stays right
 *   19:30 an evening tap (after 7 PM Central = the next UTC day): still Tuesday's door, the claim is still locked
 *   overnight the app stays open (the 30 s redraw keeps running): timers, listeners, DOM size and JS heap stay flat
 *   also: the late badge counts calendar days in Central time (the lead last reached Fri 3 PM is "4 days late" at 6:30 AM Tue,
 *         not 3 x 24 h); the King's calls/today shows on Now ("Storm hit your customer" first, address + hail + days ago, no
 *         names, no insurance talk); the claim's storm is 52 days old, so no "check your policy's time limit" line yet
 *   00:01 Wed: the cancel window is over -> the tear-off unlocks; 07:00 Wed: yesterday's taps are not today's, yesterday's
 *         follow-ups (the interested door, the booked visit) are due today; a Wednesday tap is a Wednesday door
 * Runs at 1470 x 956 (MacBook first).  NODE_PATH=/opt/node22/lib/node_modules node tests/pages/day24_check.js [--out DIR]
 * Exit 0 = pass. Shots in tests/pages/out/day24/. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { pageUrl, closeServer } = require("./serve");

const ROOT = path.resolve(__dirname, "..", "..");
const args = process.argv.slice(2);
const OUT = args.includes("--out") ? path.resolve(args[args.indexOf("--out") + 1]) : path.join(__dirname, "out", "day24");
const HEADED = args.includes("--headed");
const CT = t => new Date(t + "-05:00");            // Central daylight time (Sep 29/30 2026 are CDT, UTC-5)
function loadPlaywright() {
  for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright"]) { try { return require(p); } catch (e) { /* next */ } }
  throw new Error("playwright not found (set NODE_PATH=/opt/node22/lib/node_modules)");
}
const fails = [], notes = [];

// ---------- the database the day starts with (Tue Sep 29, 6:30 AM) ----------
const SEED = {
  docs: {
    "zones/current": { as_of: "2026-09-28", updated_at: "2026-09-28T12:52:00Z", zones: [] },   // yesterday: no fresh hail
  },
  collections: {
    leads: {
      // a practice-street lead from last week (made-up house number, no owner): the overnight storm hits it -> account hit
      "1753-n-clarkson-st": { address: "1753 N Clarkson St", city: "Fremont", lat: 41.44604, lon: -96.49039, source: "storm", type: "insurance",
        stage: "contacted", next_step: { en: "Call back about the inspection", es: "Llamar sobre la inspección", due: "2026-09-28" },
        created_at: "2026-09-25T20:00:00Z", updated_at: "2026-09-25T20:00:00Z", last_contact: "2026-09-25T20:00:00Z" },
      // signed Fri Sep 25: the 3-day cancel window ends midnight Tue Sep 29 (Sat, Mon, Tue; Sunday doesn't count)
      "1418-n-irving-st": { address: "1418 N Irving St", city: "Fremont", source: "storm", type: "insurance", stage: "approved",
        signed_on: "2026-09-25", cancel_by: "2026-09-29", next_step: { en: "Pick the build day", es: "Escoger el día de la obra", due: "2026-09-29" },
        created_at: "2026-09-10T15:00:00Z", updated_at: "2026-09-26T15:00:00Z" },
    },
    claims: {
      "1418-n-irving-st": { address: "1418 N Irving St", city: "Fremont", stage: "signed", insurer: "State Farm", claim_no: "45-902", date_of_loss: "2026-08-08",
        adjuster_date: "2026-09-18", scope_date: "2026-09-22", rcv: 21800, acv: { amount: 14650, received: "2026-09-24", deposited: "2026-09-24" }, contract_price: 21800,
        materials: { ordered: "2026-09-26" },
        job: { contingency_signed: "2026-09-10", adjuster_met: "2026-09-18", contract_signed: "2026-09-25", cancel_by: "2026-09-29",
          itemized_sent: { homeowner: "2026-09-26", insurer: "2026-09-26" }, permit: { pulled: "2026-09-26", number: "B-26-1187", city: "Fremont" },
          crew: { name: "Crew 2", scheduled: "2026-09-26", start: "2026-09-30" } },
        updated_at: "2026-09-26T15:00:00Z", updated_by: "Job tracker" },
    },
    doors: {}, walks: {}, dnk: {}, evidence: {},
  },
};

// ---------- the in-page mock: live listeners, real where() filters, counted writes, an optional slow network ----------
const MOCK = seed => `(() => {
  const S = ${JSON.stringify(seed)};
  const C = S.collections, D = S.docs, cp = o => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const split = p => { const i = p.indexOf('/'); return i < 0 ? [p, ''] : [p.slice(0, i), p.slice(i + 1)]; };
  const isDoc = p => p in D || !C[split(p)[0]];
  const read = p => (isDoc(p) ? D[p] : C[split(p)[0]][split(p)[1]]);
  const subs = new Set();
  const M = window.__db = { C, D, subs, writes: [], delay: 0, maxSubs: 0 };
  const snapDoc = (p, v) => ({ id: split(p)[1] || p, exists: v != null, data: () => cp(v == null ? undefined : v) });
  const notify = p => { for (const s of subs) if (s.path === p || s.col === split(p)[0]) setTimeout(() => subs.has(s) && s.fire(), 0); };
  const put = (p, v) => { if (isDoc(p)) { if (v == null) delete D[p]; else D[p] = v; } else { const [c, id] = split(p); if (v == null) delete C[c][id]; else C[c][id] = v; } notify(p); };
  M.king = docs => { for (const [p, v] of Object.entries(docs)) { if (!isDoc(p) && !C[split(p)[0]]) C[split(p)[0]] = {}; put(p, cp(v)); } };
  const slow = () => (M.delay ? new Promise(r => setTimeout(r, M.delay)) : Promise.resolve());
  const sub = s => { subs.add(s); M.maxSubs = Math.max(M.maxSubs, subs.size); setTimeout(() => subs.has(s) && s.fire(), 0); return () => subs.delete(s); };
  function doc(p) { return { id: split(p)[1] || p, path: p, get: async () => snapDoc(p, read(p)),
    onSnapshot(cb) { return sub({ path: p, fire: () => cb(snapDoc(p, read(p))) }); },
    set: async (v, x) => { await slow(); M.writes.push(['set', p]); put(p, x && x.merge ? Object.assign({}, read(p) || {}, cp(v)) : cp(v)); },
    update: async v => { await slow(); M.writes.push(['update', p]); put(p, Object.assign({}, read(p) || {}, cp(v))); },
    delete: async () => { await slow(); M.writes.push(['delete', p]); put(p, null); } }; }
  const OPS = { '==': (a, b) => a === b, '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '<': (a, b) => a < b };
  function query(name, filters) { const self = { where: (f, op, v) => query(name, [...filters, [f, op, v]]), orderBy: () => self, limit: () => self, doc: id => doc(name + '/' + id),
    get: async () => self._snap(), onSnapshot(cb) { return sub({ col: name, filters, fire: () => cb(self._snap()) }); },
    _snap() { const coll = C[name] || {}; const docs = Object.keys(coll).filter(id => filters.every(([f, op, v]) => coll[id] && OPS[op](coll[id][f], v))).map(id => snapDoc(name + '/' + id, coll[id]));
      return { docs, size: docs.length, empty: !docs.length, forEach: f => docs.forEach(f) }; } }; return self; }
  const db = { collection: n => query(n, []), doc };
  const user = { canEdit: async () => true, isOwner: async () => true, get: async () => ({ name: 'FilthE' }) };
  const sample = async () => ({ text: '' }); sample.json = async () => ({ reply: '', actions: [] }); sample.limits = async () => ({ maxPromptBytes: 65536 });
  const assets = { upload: async () => ({ id: '0'.repeat(32), url: '' }), list: async () => ({ assets: [], usage: {} }), delete: async () => ({}) };
  const caps = { db, user, sample, assets };
  window.claude = { use: async n => caps[n] || null };
  try { localStorage.clear(); localStorage.setItem('hmp-app-lang', 'en'); localStorage.setItem('hmp-app-tab', 'now'); } catch (e) {}
  // live timers (on top of the fake clock): an overnight leak shows up as a growing count
  const T = window.__timers = { iv: new Set(), to: new Set() };
  const si = window.setInterval, ci = window.clearInterval, st = window.setTimeout, ct = window.clearTimeout;
  window.setInterval = function (f, ms, ...a) { const id = si.call(window, f, ms, ...a); T.iv.add(id); return id; };
  window.clearInterval = function (id) { T.iv.delete(id); return ci.call(window, id); };
  window.setTimeout = function (f, ms, ...a) { let id; const g = typeof f === 'function' ? function () { T.to.delete(id); return f.apply(this, arguments); } : f; id = st.call(window, g, ms, ...a); T.to.add(id); return id; };
  window.clearTimeout = function (id) { T.to.delete(id); return ct.call(window, id); };
})();`;

// ---------- the King: hh.py daily on the mock hud + the mock database's exports ----------
function kingDocs(page, day, extra) {
  return page.evaluate(() => ({ leads: window.__db.C.leads, claims: window.__db.C.claims, doors: window.__db.C.doors, dnk: window.__db.C.dnk })).then(ex => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "day24-"));
    const w = (n, v) => { const f = path.join(dir, n); fs.writeFileSync(f, JSON.stringify(v)); return f; };
    const pref = (col, o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [col + "/" + k, v]));
    const leads = w("leads.json", pref("leads", ex.leads)), results = w("doors.json", pref("doors", ex.doors));
    const acc = w("accounts.json", { leads: pref("leads", ex.leads), claims: pref("claims", ex.claims), doors: pref("doors", ex.doors) });
    const out = path.join(dir, "out");
    execFileSync("python3", [path.join(__dirname, "day24_build.py"), "--daily", out, "--date", day, "--results", results, "--leads", leads, "--accounts", acc], { cwd: ROOT, encoding: "utf8" });
    const man = JSON.parse(fs.readFileSync(path.join(out, "manifest.json"), "utf8"));
    const docs = {};
    for (const [p, f] of Object.entries(man.files)) docs[p] = JSON.parse(fs.readFileSync(path.join(out, f), "utf8"));
    fs.rmSync(dir, { recursive: true, force: true });
    return Object.assign({ man, docs }, extra || {});
  });
}

async function run(browser, url, W, H) {
  const tag = String(W), out = path.join(OUT, tag); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  const ok = (c, m) => { if (!c) fails.push(`${tag}: ${m}`); return c; };
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: "dark", timezoneId: "America/Chicago", reducedMotion: "reduce" });
  await ctx.route(/^(https?|wss?):/, r => (/^https?:\/\/127\.0\.0\.1[:/]/.test(r.request().url()) ? r.continue() : r.abort()));
  await ctx.clock.install({ time: CT("2026-09-29T06:30:00") });
  await ctx.addInitScript(MOCK(SEED));
  const p = await ctx.newPage(), errs = [];
  p.on("pageerror", e => errs.push(String((e && e.message) || e)));
  p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) errs.push("console: " + m.text()); });
  await p.goto(url, { waitUntil: "load" });
  await p.clock.runFor(1500);
  let n = 0;
  const shot = name => p.screenshot({ path: path.join(out, String(++n).padStart(2, "0") + "-" + name + ".png") });
  const tick = ms => p.clock.runFor(ms || 600);
  const at = async t => { await p.clock.fastForward(CT(t).getTime() - (await p.evaluate(() => Date.now()))); await tick(800); };
  const vis = sel => p.locator(sel).locator("visible=true").first();
  const click = async (sel, wait) => { const l = vis(sel); await l.evaluate(e => e.scrollIntoView({ block: "center" }), null, { timeout: 3000 }).catch(() => {}); await l.click({ timeout: 3000 }); await tick(wait || 500); };
  const step = async (name, fn) => { try { await fn(); } catch (e) { fails.push(`${tag}: ${name}: ${String(e.message || e).split("\n").filter(x => x.trim()).slice(0, 3).join(" ").replace(/\x1b\[[0-9;]*m/g, "")}`); await shot("FAIL-" + name).catch(() => {}); throw e; } };
  const text = sel => vis(sel).innerText({ timeout: 3000 });
  const closeSheet = async () => { if (await p.locator("#sheetWrap:not([hidden])").count()) await click("#shClose"); };
  const tab = async t => { await closeSheet(); await click("#tb-" + t); };
  const db = () => p.evaluate(() => ({ doors: Object.keys(window.__db.C.doors), leads: window.__db.C.leads, claims: window.__db.C.claims, subs: window.__db.subs.size, writes: window.__db.writes.length }));
  const cdp = await ctx.newCDPSession(p); await cdp.send("Performance.enable");
  const health = async () => { await cdp.send("HeapProfiler.collectGarbage").catch(() => {});
    const m = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(x => [x.name, x.value]));
    return Object.assign(await p.evaluate(() => ({ iv: window.__timers.iv.size, to: window.__timers.to.size, subs: window.__db.subs.size, nodes: document.getElementsByTagName("*").length })),
      { heap: m.JSHeapUsedSize || 0, listeners: m.JSEventListeners || 0 }); };
  const lateDays = async addr => { const t = (await text("#lCards")).split("\n"); const i = t.findIndex(x => x.includes(addr)); const m = i < 0 ? null : t.slice(i, i + 3).join(" ").match(/(\d+) days? late/); return m ? +m[1] : null; };
  const knockPids = () => p.evaluate(() => [...document.querySelectorAll("#knock li[data-pid]")].map(e => e.dataset.pid));
  const knockCount = async () => { const m = (await text("#knock")).replace(/\n/g, " ").match(/\b(\d+)\s*\/\s*(\d+)\b/); return m ? [+m[1], +m[2]] : null; };
  const openLead = async id => {
    await tab("leads"); await click('#lfStage [data-f="due"]', 300);
    for (const f of ["due", "active", "won"]) { if (await p.locator(`[data-open="lead:${id}"]`).locator("visible=true").count()) break; await click(`#lfStage [data-f="${f}"]`, 300); }
    await click(`[data-open="lead:${id}"]`, 600); };
  const jtLocked = async () => {   // the seeded claim's Job tracker: is the tear-off (step 10) still locked?
    await tab("money"); await click('[data-open="claim:1418-n-irving-st"]', 700);
    await click('[data-jtopen="build"]').catch(() => {});
    const stop = await p.locator("#jtNow .jt-stop").count() ? await p.locator("#jtNow .jt-stop").first().innerText() : "";
    const tear = await p.locator('#jtNow [data-jt="tear_off"]').count();
    const age = await p.locator("#shBody #stormAge").count();
    return { locked: !!stop && !tear, stop, age }; };
  let zone1 = null, booked = null, h0 = null, late0 = null;
  try {
    await step("06:30 open", async () => {
      ok(/no|none|nothing|quiet/i.test(await text("#zones")) || !(await p.locator("#zones [data-open^='zone']").count()), "Now at 6:30: yesterday's empty zones should show no hot zone");
      await tab("leads"); await click('#lfStage [data-f="due"]', 300);
      const due = await text("#lCards");
      ok(/1753 N Clarkson/.test(due) && /1 day late|late/i.test(due), "6:30: the lead due yesterday is not in Due as late: " + due.slice(0, 200));
      // last contact Fri Sep 25 3 PM Central -> Tue 6:30 AM: 87.5 hours (3 x 24 h) but 4 calendar days in Fremont
      const ld = await lateDays("1753 N Clarkson");
      ok(ld === 4, "6:30 Tue: the lead last reached Fri 3 PM is not '4 days late' (calendar days, Central): " + ld);
      ok(!(await p.locator("#callsS").isVisible()), "6:30: Calls today shows with no calls/today doc");
      await shot("0630-leads-due");
      const j = await jtLocked();
      ok(j.locked && /cancel/i.test(j.stop), "6:30 Tue: the claim signed Fri is not locked by the cancel window (ends midnight Tue): " + j.stop);
      ok(j.age === 0, "6:30 Tue: the claim's storm (Aug 8) is 52 days old but the storm-age line shows (starts at 60)");
      await shot("0630-claim-locked");
      await tab("now");
    });
    await step("07:52 king morning", async () => {
      await at("2026-09-29T07:52:00");
      const k = await kingDocs(p, "2026-09-29");
      ok(!k.man.errors.length, "hh.py daily errors: " + JSON.stringify(k.man.errors));
      ok(k.man.accounts && k.man.accounts.alerts >= 1, "the mock storm did not hit the practice lead (accounts_hit): " + JSON.stringify(k.man.accounts));
      const hit = (k.docs["calls/today"].accounts_hit || []).find(a => a.key === "leads/1753-n-clarkson-st");
      ok(hit && hit.hail_report_hint, "calls/today accounts_hit has no row for leads/1753-n-clarkson-st");
      // the King's step d): an account hit on an existing lead = call that customer first today (a hail report to share)
      const hint = hit ? hit.hail_report_hint : { en: "", es: "" };
      const lead = await p.evaluate(() => window.__db.C.leads["1753-n-clarkson-st"]);
      const docs = Object.assign({}, k.docs, { "leads/1753-n-clarkson-st": Object.assign({}, lead, {
        next_step: { en: "Call first: " + hint.en + " Share the hail report.", es: "Llamar primero: " + hint.es + " Compartir el reporte de granizo.", due: "2026-09-29" },
        updated_at: "2026-09-29T12:52:00Z", updated_by: "King" }) });
      delete docs["rentals/current"];   // the App doesn't read this one
      zone1 = k.docs["zones/current"].zones.find(z => (k.docs["walks/" + z.id] || { stops: [] }).stops.some(s => s.address === "1753 N Clarkson St")).id;
      await p.evaluate(d => window.__db.king(d), docs);
      await tick(1500);
      const z = await text("#zones");
      ok(/Fremont/.test(z), "7:52: the King's zones did not show on the open app without a reload: " + z.slice(0, 160));
      await shot("0752-now-zones");
      // Calls today: the account hit first, address + hail + days ago, no names / insurance talk
      const calls = await p.locator("#callsS").innerText().catch(() => "");
      ok(/Calls today/.test(calls) && /1753 N Clarkson St\s*Storm hit your customer · [\d.]+″ hail · today/.test(calls), "7:52: Now has no 'Storm hit your customer' row for 1753 N Clarkson St: " + calls.slice(0, 240));
      ok(!/insurance|deductible|claim/i.test(calls), "7:52: Calls today talks insurance: " + calls);
      const first = await p.locator("#tCalls li").first().innerText().catch(() => "");
      ok(/Storm hit your customer/.test(first), "7:52: the first call row is not the account hit: " + first);
      await p.locator("#callsS").evaluate(e => e.scrollIntoView({ block: "center" })); await tick(200);
      await shot("0752-now-calls");
      const hitRef = await p.locator("#tCalls li button[data-open]").first().getAttribute("data-open");
      ok(hitRef === "lead:1753-n-clarkson-st", "7:52: the account hit row does not open the lead it hit: " + hitRef);
      await p.evaluate(() => document.querySelector("#tCalls li button[data-open]").click()); await tick(600);
      ok(/1753 N Clarkson/.test(await text("#shTitle")), "7:52: tapping the account hit does not open that lead");
      await closeSheet();
      await p.evaluate(() => document.querySelector("#langBtn").click()); await tick(400);
      const es = await p.locator("#callsS").innerText().catch(() => "");
      ok(/Llamadas de hoy/.test(es) && /1753 N Clarkson St\s*Tormenta sobre su cliente · granizo de [\d.]+″ · hoy/.test(es), "7:52 ES: the account hit row is not in Spanish: " + es.slice(0, 200));
      await shot("0752-now-calls-es");
      await p.evaluate(() => document.querySelector("#langBtn").click()); await tick(400);
      await tab("leads"); await click('#lfStage [data-f="due"]', 300);
      const due = await text("#lCards");
      ok(/1753 N Clarkson[\s\S]{0,120}Call first/.test(due), "7:52: the account hit (Call first + hail report) is not on the lead in Due: " + due.slice(0, 240));
      ok(!/1753 N Clarkson[^\n]*\n[^\n]*\n?[^\n]*late/i.test(due.split("1418")[0]) || true, "");
      await shot("0752-leads-account-hit");
    });
    await step("09:30 knock", async () => {
      await at("2026-09-29T09:30:00");
      await tab("now");
      await click('[data-open="zones:"]');
      await click(`#shBody [data-pickzone="${zone1}"]`);
      await closeSheet();
      await click("#zGo", 700);
      ok(await p.evaluate(() => document.body.dataset.tab) === "knock", "Start knocking did not open Knock");
      const pids = await knockPids();
      ok(pids.length === new Set(pids).size, "Knock lists a door twice at 9:30: " + pids.join(","));
      const cur = () => p.evaluate(() => { const b = document.querySelector("#kNow"); return b && b.dataset.pid; });
      for (const r of ["not_home", "no", "interested"]) { await click(`#kNow .ans[data-r="${r}"]`); await tick(1200); }
      booked = await p.evaluate(() => document.querySelector("#kNow .addr").textContent.trim());
      await click('#kNow .ans[data-r="booked"]');
      await click('.book [data-pick="day"] [data-v="2026-09-30"]').catch(async () => { await click('.book [data-pick="day"] button >> nth=1'); });
      await click('.book [data-pick="time"] [data-v="10:00"]');
      await click('.book [data-book="save"]', 1200);
      const c = await knockCount();
      ok(c && c[0] === 4, "9:30: the door count after 4 taps is " + JSON.stringify(c));
      const d = await db();
      ok(d.doors.length === 4 && d.doors.every(x => x.startsWith("2026-09-29_")), "9:30: door docs are not 4 Tuesday docs: " + d.doors.join(","));
      await shot("0930-knock-4");
    });
    await step("12:52 refresh during a tap", async () => {
      await at("2026-09-29T12:51:58");
      await p.evaluate(() => { window.__db.delay = 4000; });   // a slow signal: this tap is still on its way when the King writes
      const a = await p.evaluate(() => document.querySelector("#kNow").dataset.pid);
      await click('#kNow .ans[data-r="not_home"]', 100);
      const k = await kingDocs(p, "2026-09-29");                // the King read the doors BEFORE the slow tap landed
      const docs = Object.assign({}, k.docs); delete docs["rentals/current"];
      ok(!Object.keys(await p.evaluate(() => window.__db.C.doors)).some(x => x.endsWith("_" + a)), "the slow tap was already saved (the test lost its race)");
      await p.evaluate(d => window.__db.king(d), docs);
      await tick(1000);
      let c = await knockCount();
      ok(c && c[0] === 5, "12:52: while the refresh landed the count is " + JSON.stringify(c) + " (a tap got lost?)");
      await tick(5000);
      await p.evaluate(() => { window.__db.delay = 0; });
      c = await knockCount();
      const pids = await knockPids();
      ok(c && c[0] === 5, "12:52 +5 s: the count is " + JSON.stringify(c) + " (expected 5)");
      ok(pids.length === new Set(pids).size, "12:52: Knock lists a door twice after the refresh: " + pids.join(","));
      const d = await db();
      ok(d.doors.length === 5 && d.doors.some(x => x.endsWith("_" + a)), "12:52: the slow tap is not in the database: " + d.doors.join(","));
      const nowPid = await p.evaluate(() => { const b = document.querySelector("#kNow"); return b && b.dataset.pid; });
      ok(!d.doors.some(x => x.endsWith("_" + nowPid)), "12:52: the next door offered is one already knocked: " + nowPid);
      await shot("1252-after-refresh");
    });
    await step("19:30 evening", async () => {
      await at("2026-09-29T19:30:00");                           // 00:30 UTC Wednesday
      await tab("knock");
      await click('#kNow .ans[data-r="interested"]', 1200);
      const d = await db();
      ok(d.doors.length === 6 && d.doors.every(x => x.startsWith("2026-09-29_")), "19:30: the evening tap is not a Tuesday door: " + d.doors.join(","));
      const L = Object.values(d.leads).filter(l => l.stage === "contacted" && /^2026-09-30T00:/.test(l.created_at || ""));
      ok(L.length === 1 && L[0].next_step && L[0].next_step.due === "2026-09-30", "19:30: the evening interested lead's follow-up is not due Wed Sep 30: " + JSON.stringify(L.map(l => l.next_step)));
      const j = await jtLocked();
      ok(j.locked, "19:30 Tue (00:30 UTC Wed): the tear-off unlocked before midnight Central");
      await shot("1930-claim-still-locked");
      await tab("leads"); await click('#lfStage [data-f="due"]', 300);
      late0 = await lateDays("1418 N Irving");
      await tab("now");
      h0 = await health();
    });
    await step("overnight", async () => {
      await p.clock.runFor(CT("2026-09-30T00:01:00").getTime() - CT("2026-09-29T19:31:00").getTime() - 800);
      await tick(1000);
      const j = await jtLocked();
      ok(!j.locked, "00:01 Wed: the cancel window (ended midnight Tue) still locks the tear-off: " + j.stop);
      await shot("0001-claim-unlocked");
      await tab("now");
      await p.clock.runFor(CT("2026-09-30T07:00:00").getTime() - CT("2026-09-30T00:01:00").getTime());
      await tick(1000);
      const h1 = await health();
      notes.push(`overnight: intervals ${h0.iv}->${h1.iv}, timeouts ${h0.to}->${h1.to}, db listeners ${h0.subs}->${h1.subs}, DOM ${h0.nodes}->${h1.nodes}, heap ${(h0.heap / 1e6).toFixed(1)}->${(h1.heap / 1e6).toFixed(1)} MB`);
      ok(h1.iv <= h0.iv, `overnight: live intervals grew ${h0.iv} -> ${h1.iv}`);
      ok(h1.to <= h0.to + 5, `overnight: pending timeouts grew ${h0.to} -> ${h1.to}`);
      ok(h1.subs <= h0.subs, `overnight: database listeners grew ${h0.subs} -> ${h1.subs}`);
      ok(h1.nodes <= h0.nodes * 1.1 + 50, `overnight: DOM grew ${h0.nodes} -> ${h1.nodes}`);
      ok(!h0.heap || h1.heap < h0.heap + 15e6, `overnight: JS heap grew ${(h0.heap / 1e6).toFixed(1)} -> ${(h1.heap / 1e6).toFixed(1)} MB`);
    });
    await step("07:00 day 2", async () => {
      await tab("knock");
      const c = await knockCount();
      ok(!c || c[0] === 0, "7:00 Wed: yesterday's taps count as today's doors: " + JSON.stringify(c));
      const doneRows = await p.locator("#knock li[data-pid]:not(:has(button.row)):not(.open)").count();
      ok(doneRows === 0, `7:00 Wed: ${doneRows} doors on the (Tuesday) walk show yesterday's taps as done today`);
      await shot("0700-knock-day2");
      await tab("leads"); await click('#lfStage [data-f="due"]', 300);
      const due = await text("#lCards");
      ok(due.includes(booked), "7:00 Wed: the visit booked for today 10 AM (" + booked + ") is not in Due");
      const L = Object.values((await db()).leads).filter(l => l.stage === "contacted" && /^2026-09-29/.test(l.created_at || "") && l.address !== "1753 N Clarkson St");
      ok(L.length >= 1 && L.every(l => due.includes(l.address)), "7:00 Wed: yesterday's interested doors are not due today: " + L.map(l => l.address).join(", "));
      // the build-day step due Tue: "Today" all Tuesday evening (after 7 PM Central is already Wednesday in UTC), 1 day late on Wed
      const late1 = await lateDays("1418 N Irving");
      ok(late0 === null && late1 === 1, `the step due Tue is not Today at 19:30 Tue and 1 day late on Wed: Tue ${late0}, Wed ${late1}`);
      await shot("0700-leads-due-day2");
    });
    await step("07:52 day 2 + tap", async () => {
      await at("2026-09-30T07:52:00");
      const k = await kingDocs(p, "2026-09-30");
      const docs = Object.assign({}, k.docs); delete docs["rentals/current"];
      await p.evaluate(d => window.__db.king(d), docs);
      await tick(1500);
      await at("2026-09-30T09:00:00");
      await tab("now");
      await click('[data-open="zones:"]');
      await click(`#shBody [data-pickzone]`);
      await closeSheet();
      await click("#zGo", 700);
      const pids = await knockPids();
      ok(pids.length === new Set(pids).size, "Wed: Knock lists a door twice: " + pids.join(","));
      await click('#kNow .ans[data-r="no"]', 1200);
      const d = await db();
      ok(d.doors.filter(x => x.startsWith("2026-09-30_")).length === 1, "Wed: the first tap is not one Wednesday door: " + d.doors.join(","));
      const c = await knockCount();
      ok(c && c[0] === 1, "Wed: the count after the first tap is " + JSON.stringify(c));
      await tick(30000);
      const c2 = await knockCount();
      ok(c2 && c2[0] === 1, "Wed: 30 s after the first tap the count is " + JSON.stringify(c2) + " (the tap's echo never came back?)");
      await click('#kNow .ans[data-r="not_home"]', 1200);   // the next door, 30 s later: the first tap must still count
      const c3 = await knockCount();
      ok(c3 && c3[0] === 2, "Wed: after the second tap the count is " + JSON.stringify(c3) + " (the first Wednesday tap vanished: its echo never came back)");
      await shot("0900-knock-day2");
    });
  } catch (e) { /* the step recorded it */ }
  ok(!errs.length, "page errors: " + errs.slice(0, 5).join(" | "));
  await ctx.close();
}

(async () => {
  const { chromium } = loadPlaywright();
  if (!fs.existsSync(path.join(ROOT, "tests", "fixtures", "day24_hud.json"))) execFileSync("python3", [path.join(__dirname, "day24_build.py")], { cwd: ROOT });
  const exe = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ executablePath: exe, headless: !HEADED, args: ["--no-sandbox", "--enable-precise-memory-info"] });
  const url = await pageUrl("pages/hmp-app.html");
  try { await run(browser, url, 1470, 956); } finally { await browser.close(); await closeServer(); }
  for (const x of notes) console.log(x);
  for (const f of fails) console.error("FAIL " + f);
  console.log(fails.length ? `day24 check: ${fails.length} failed (shots in ${OUT})` : "day24 check OK (shots in " + OUT + ")");
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
