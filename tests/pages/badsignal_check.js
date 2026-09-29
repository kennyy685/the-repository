#!/usr/bin/env node
/* T163: bad-signal stress test (salesmen knock where signal drops). The HMP App on a fake clock, Central time, with a
 * network-aware in-page mock database + asset store (based on day24_check.js's live-listener MOCK): window.__setNet()
 * flips between 'online', 'offline' (every write rejects, nothing reaches "the server") and 'flaky' (latency + a
 * failure rate, still nothing reaches the server on a failed attempt) so a rejected write is never partially applied.
 * Scenarios, in order, on one open app (no reload except the one scenario that is about reloading):
 *   1. fully offline mid-walk: 3 door taps + a new lead, saved on this phone at once (optimistic UI), queued toast +
 *      sync chip in EN then ES, nothing lost, no duplicate doors/leads once flushed
 *   2. flaky 3G (400-2200 ms latency, 30% failure): a burst of taps; the outbox drains in order, exactly once each
 *   3. connection drops mid-save (a single write rejects, the retry succeeds): no duplicate lead/door
 *   4. connection drops mid-photo-upload (file 1 succeeds, file 2 rejects mid-upload): file 1 is kept, a clear error
 *      shows for file 2, nothing is silently lost or duplicated on retry
 *   5. hard stops (44-8606 itemized + the 3-day cancel window) still hold while fully offline
 *   6. reload while offline: the outbox (localStorage) survives the reload; back online it drains once, no dupes
 *   7. whole run: no endless retries (backoff caps and resets), no console errors
 * Data: day24_build.py's real hh.py daily output (Tue 2026-09-29, practice-street hail) for the walk, plus the
 * day24_check.js claim/lead (1418 N Irving St, signed Thu, cancel_by Tue) for the hard-stop check.
 *   NODE_PATH=/opt/node22/lib/node_modules node tests/pages/badsignal_check.js [--out DIR] [--headed]
 *   Exit 0 = pass. Shots in tests/pages/out/badsignal/. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { pageUrl, closeServer } = require("./serve");

const ROOT = path.resolve(__dirname, "..", "..");
const args = process.argv.slice(2);
const OUT = args.includes("--out") ? path.resolve(args[args.indexOf("--out") + 1]) : path.join(__dirname, "out", "badsignal");
const HEADED = args.includes("--headed");
const CT = t => new Date(t + "-05:00");
function loadPlaywright() {
  for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright"]) { try { return require(p); } catch (e) { /* next */ } }
  throw new Error("playwright not found (set NODE_PATH=/opt/node22/lib/node_modules)");
}
const fails = [], notes = [];

// ---------- real engine output for the walk (Tue 2026-09-29, practice-street hail) ----------
function walkDocs() {
  const build = path.join(__dirname, "day24_build.py");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "badsignal-"));
  const out = path.join(dir, "out");
  execFileSync("python3", [build, "--daily", out, "--date", "2026-09-29"], { cwd: ROOT, encoding: "utf8" });
  const man = JSON.parse(fs.readFileSync(path.join(out, "manifest.json"), "utf8"));
  const docs = {};
  for (const [p, f] of Object.entries(man.files)) if (p.startsWith("zones/") || p.startsWith("walks/")) docs[p] = JSON.parse(fs.readFileSync(path.join(out, f), "utf8"));
  fs.rmSync(dir, { recursive: true, force: true });
  return docs;
}

// ---------- the seed: the real walk + the day24_check claim/lead (signed Thu, cancel_by Tue) for the hard-stop check ----------
function seed() {
  const raw = walkDocs();   // { "zones/current": {...}, "walks/<id>": {...}, ... } (manifest paths, as day24_check reads them)
  const docs = {}, walksCol = {};
  for (const [p, v] of Object.entries(raw)) { if (p.startsWith("walks/")) walksCol[p.slice("walks/".length)] = v; else docs[p] = v; }
  if (!Object.keys(walksCol).length) throw new Error("no walk in engine output: " + Object.keys(raw).join(","));
  return {
    docs,
    collections: {
      leads: { "1418-n-irving-st": { address: "1418 N Irving St", city: "Fremont", source: "storm", type: "insurance", stage: "approved",
        signed_on: "2026-09-24", cancel_by: "2026-09-29", next_step: { en: "Pick the build day", es: "Escoger el día de la obra", due: "2026-09-29" },
        created_at: "2026-09-10T15:00:00Z", updated_at: "2026-09-26T15:00:00Z" } },
      claims: { "1418-n-irving-st": { address: "1418 N Irving St", city: "Fremont", stage: "signed", insurer: "State Farm", claim_no: "45-902", date_of_loss: "2026-08-08",
        adjuster_date: "2026-09-18", scope_date: "2026-09-22", rcv: 21800, acv: { amount: 14650, received: "2026-09-24", deposited: "2026-09-24" }, contract_price: 21800,
        materials: { ordered: "2026-09-26" },
        job: { contingency_signed: "2026-09-10", adjuster_met: "2026-09-18", contract_signed: "2026-09-24", cancel_by: "2026-09-29",
          itemized_sent: { homeowner: "2026-09-26", insurer: "2026-09-26" }, permit: { pulled: "2026-09-26", number: "B-26-1187", city: "Fremont" },
          crew: { name: "Crew 2", scheduled: "2026-09-26", start: "2026-09-30" } },
        updated_at: "2026-09-26T15:00:00Z", updated_by: "Job tracker" } },
      doors: {}, walks: walksCol, dnk: {}, evidence: {},
    },
  };
}

// ---------- the in-page mock: live listeners (day24-style) + a controllable network (offline / flaky / online) ----------
const MOCK = seedObj => `(() => {
  const S = ${JSON.stringify(seedObj)};
  const C = S.collections, D = S.docs, cp = o => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const split = p => { const i = p.indexOf('/'); return i < 0 ? [p, ''] : [p.slice(0, i), p.slice(i + 1)]; };
  const isDoc = p => p in D || !C[split(p)[0]];
  const read = p => (isDoc(p) ? D[p] : C[split(p)[0]][split(p)[1]]);
  const subs = new Set();
  // the network mode survives a reload too (persisted in localStorage): "still offline after reload" must stay offline
  // until the test says otherwise, not silently reset to online (which would auto-flush the outbox behind the test's back).
  let NETSTATE = null; try { NETSTATE = JSON.parse(localStorage.getItem('__badsignal_net__') || 'null'); } catch (e) { NETSTATE = null; }
  const NET = window.__net = Object.assign({ mode: 'online', failRate: 0, minLat: 0, maxLat: 0 }, NETSTATE || {});
  window.__setNet = (mode, opts) => { Object.assign(NET, { mode }, opts || {}); try { localStorage.setItem('__badsignal_net__', JSON.stringify(NET)); } catch (e) {} };
  window.__applied = [];    // writes that actually reached "the server", in order
  window.__attempts = [];   // every attempt, ok or not
  const rnd = (a, b) => a + Math.random() * (b - a);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function netGate(kind, extra) {
    if (NET.mode === 'offline') { await wait(30); window.__attempts.push(Object.assign({ kind, ok: false, at: Date.now() }, extra)); throw Object.assign(new Error('network: offline'), {}); }
    if (NET.mode === 'script') {   // deterministic outcomes, in order, for "attempt 1 succeeds, attempt 2 drops mid-flight"
      const ok = NET.queue && NET.queue.length ? NET.queue.shift() : true;
      await wait(NET.minLat || 150);
      if (!ok) { window.__attempts.push(Object.assign({ kind, ok: false, at: Date.now() }, extra)); throw Object.assign(new Error('network: dropped (scripted)'), {}); }
      window.__attempts.push(Object.assign({ kind, ok: true, at: Date.now() }, extra)); return;
    }
    if (NET.mode === 'flaky') {
      await wait(rnd(NET.minLat || 400, NET.maxLat || 2200));
      if (Math.random() < (NET.failRate == null ? 0.3 : NET.failRate)) { window.__attempts.push(Object.assign({ kind, ok: false, at: Date.now() }, extra)); throw Object.assign(new Error('network: dropped'), {}); }
    }
    window.__attempts.push(Object.assign({ kind, ok: true, at: Date.now() }, extra));
  }
  const M = window.__db = { C, D, subs, delay: 0 };
  const snapDoc = (p, v) => ({ id: split(p)[1] || p, exists: v != null, data: () => cp(v == null ? undefined : v) });
  const notify = p => { for (const s of subs) if (s.path === p || s.col === split(p)[0]) setTimeout(() => subs.has(s) && s.fire(), 0); };
  const put = (p, v) => { if (isDoc(p)) { if (v == null) delete D[p]; else D[p] = v; } else { const [c, id] = split(p); if (v == null) delete C[c][id]; else C[c][id] = v; } notify(p); };
  const sub = s => { subs.add(s); setTimeout(() => subs.has(s) && s.fire(), 0); return () => subs.delete(s); };
  function doc(p) { return { id: split(p)[1] || p, path: p, get: async () => snapDoc(p, read(p)),
    onSnapshot(cb) { return sub({ path: p, fire: () => cb(snapDoc(p, read(p))) }); },
    set: async (v, x) => { await netGate('set', { path: p }); window.__applied.push({ op: 'set', path: p, at: Date.now() }); put(p, x && x.merge ? Object.assign({}, read(p) || {}, cp(v)) : cp(v)); },
    update: async v => { await netGate('update', { path: p }); window.__applied.push({ op: 'update', path: p, at: Date.now() }); put(p, Object.assign({}, read(p) || {}, cp(v))); },
    delete: async () => { await netGate('delete', { path: p }); window.__applied.push({ op: 'delete', path: p, at: Date.now() }); put(p, null); } }; }
  const OPS = { '==': (a, b) => a === b, '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '<': (a, b) => a < b };
  function query(name, filters) { const self = { where: (f, op, v) => query(name, [...filters, [f, op, v]]), orderBy: () => self, limit: () => self, doc: id => doc(name + '/' + id),
    get: async () => self._snap(), onSnapshot(cb) { return sub({ col: name, filters, fire: () => cb(self._snap()) }); },
    _snap() { const coll = C[name] || {}; const docs = Object.keys(coll).filter(id => filters.every(([f, op, v]) => coll[id] && OPS[op](coll[id][f], v))).map(id => snapDoc(name + '/' + id, coll[id]));
      return { docs, size: docs.length, empty: !docs.length, forEach: f => docs.forEach(f) }; } }; return self; }
  const db = { collection: n => query(n, []), doc };
  const user = { canEdit: async () => true, isOwner: async () => true, get: async () => ({ name: 'FilthE' }) };
  const sample = async () => ({ text: '' }); sample.json = async () => ({ reply: '', actions: [] }); sample.limits = async () => ({ maxPromptBytes: 65536 });
  let assetSeq = 0;
  const assets = { upload: async (blob, opts) => { await netGate('upload', {}); return { id: 'A' + (++assetSeq).toString(36).padStart(20, '0'), url: '' }; },
    list: async () => ({ assets: [], usage: {} }), delete: async () => ({}) };
  const caps = { db, user, sample, assets };
  window.claude = { use: async n => caps[n] || null };
  // this init script reruns on every navigation, including the one deliberate reload (scenario 6): only seed once, so a
  // reload never wipes the outbox (hmp-app-outbox) the app itself saved to localStorage before the reload.
  try { if (!localStorage.getItem('__badsignal_seeded__')) { localStorage.clear(); localStorage.setItem('hmp-app-lang', 'en'); localStorage.setItem('hmp-app-tab', 'now'); localStorage.setItem('__badsignal_seeded__', '1'); } } catch (e) {}
})();`;

// a 1x1 JPEG, twice (two distinct File objects for the two-photo upload scenario)
const JPEG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");

async function run(browser, url) {
  const out = OUT; fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  const ok = (c, m) => { if (!c) fails.push(m); return c; };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark", timezoneId: "America/Chicago", reducedMotion: "reduce" });
  await ctx.route(/^(https?|wss?):/, r => (/^https?:\/\/127\.0\.0\.1[:/]/.test(r.request().url()) ? r.continue() : r.abort()));
  await ctx.clock.install({ time: CT("2026-09-29T09:30:00") });
  const S = seed();
  await ctx.addInitScript(MOCK(S));
  const errs = [];
  const openPage = async () => {
    const p = await ctx.newPage();
    p.on("pageerror", e => errs.push(String((e && e.message) || e)));
    p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) errs.push("console: " + m.text()); });
    await p.goto(url, { waitUntil: "load" });
    await p.clock.runFor(1200);
    return p;
  };
  let p = await openPage();
  let n = 0;
  const shot = name => p.screenshot({ path: path.join(out, String(++n).padStart(2, "0") + "-" + name + ".png") });
  const tick = ms => p.clock.runFor(ms || 700);
  const vis = sel => p.locator(sel).locator("visible=true").first();
  const click = async (sel, wait) => { const l = vis(sel); await l.evaluate(e => e.scrollIntoView({ block: "center" }), null, { timeout: 3000 }).catch(() => {}); await l.click({ timeout: 3000 }); await tick(wait || 600); };
  const step = async (name, fn) => { try { await fn(); } catch (e) { fails.push(`${name}: ${String(e.message || e).split("\n").filter(x => x.trim()).slice(0, 3).join(" ").replace(/\x1b\[[0-9;]*m/g, "")}`); await shot("FAIL-" + name).catch(() => {}); } };
  const text = sel => vis(sel).innerText({ timeout: 3000 });
  const closeSheet = async () => { if (await p.locator("#sheetWrap:not([hidden])").count()) await click("#shClose"); };
  const tab = async t => { await closeSheet(); await click("#tb-" + t); };
  const setNet = (mode, opts) => p.evaluate(([m, o]) => window.__setNet(m, o), [mode, opts || null]);
  const outbox = () => p.evaluate(() => { try { return JSON.parse(localStorage.getItem("hmp-app-outbox") || "[]"); } catch (e) { return null; } });
  const applied = () => p.evaluate(() => window.__applied.slice());
  const doorIds = () => p.evaluate(() => Object.keys(window.__db.C.doors));
  const leadIds = () => p.evaluate(() => Object.keys(window.__db.C.leads));
  const knockPids = () => p.evaluate(() => [...document.querySelectorAll("#knock li[data-pid]")].map(x => x.dataset.pid));
  const cur = () => p.evaluate(() => { const b = document.querySelector("#kNow"); return b && b.dataset.pid; });
  const syncText = () => p.locator("#syncChip").innerText().catch(() => "");
  const flushToIdle = async (maxMs) => {   // advance the fake clock (Playwright clock.install controls every setTimeout on the page, including this mock's
    // simulated latency) for the whole window: backoff can be up to 60 s between retries, so a short "outbox stopped
    // changing" streak is not proof it is done, only that it is between retries - always spend the full budget.
    const total = maxMs || 20000; let elapsed = 0, len = -1;
    while (elapsed < total) { const step = Math.min(2000, total - elapsed); await tick(step); elapsed += step; const ob = await outbox(); len = ob ? ob.length : -1; if (len === 0) break; }
    return len;
  };
  // back online: a real salesman notices the signal bar and taps the "waiting to sync" chip (its own documented action,
  // V0.syncTap "Tap to try sending now") instead of just waiting out the backoff; this also resets backoff to 4000.
  const syncNow = async (maxMs) => { await setNet("online"); await closeSheet();
    if (await p.locator("#syncChip").isVisible().catch(() => false)) await click("#syncChip", 300).catch(() => {});
    await flushToIdle(maxMs || 8000); };

  try {
    await step("boot", async () => {
      ok(!(await p.locator("#practiceBar").isVisible().catch(() => false)), "Practice mode is on (this test needs the real outbox, not Practice)");
      await tab("now");
      ok(/Fremont/i.test(await text("#zones")), "Now: the engine's real zone did not load: " + (await text("#zones")).slice(0, 160));
      await shot("00-now-online");
    });

    // ---------- 1. fully offline mid-walk: taps + a new lead, nothing lost ----------
    let firstPids = [];
    await step("1-offline-walk", async () => {
      await tab("now");
      await click("#zGo", 800);
      ok((await p.evaluate(() => document.body.dataset.tab)) === "knock", "Start knocking did not open Knock");
      await setNet("offline");
      const a0 = await cur(); firstPids.push(a0);
      await click('#kNow .ans[data-r="not_home"]');
      firstPids.push(await cur());
      await click('#kNow .ans[data-r="no"]');
      firstPids.push(await cur());
      await click('#kNow .ans[data-r="interested"]');
      const c = (await text("#knock")).replace(/\n/g, " ").match(/\b(\d+)\s*\/\s*(\d+)\b/);
      ok(c && +c[1] === 3, "offline: 3 taps should show as 3 done at once (optimistic UI), got " + JSON.stringify(c));
      const ob = await outbox();
      ok(ob && ob.filter(o => o.path && o.path.startsWith("doors/")).length === 3, "offline: the outbox should hold exactly 3 door writes: " + JSON.stringify(ob && ob.map(o => o.path)));
      const applied1 = await applied();
      ok(applied1.length === 0, "offline: a write reached \"the server\" while offline: " + JSON.stringify(applied1));
      await shot("01-offline-3-taps");
      const chipEn = await syncText();
      ok(/waiting to sync|3\s*taps/i.test(chipEn), "offline EN: the sync chip does not say taps are waiting: " + JSON.stringify(chipEn));
      // a new lead while offline (the "+" > new lead)
      await tab("now");
      await click("#plusBtn");
      await click('[data-open="nl:"]', 500);
      await p.fill("#nlAddr", "410 W 5th St");
      await p.fill("#nlCity", "Fremont").catch(() => {});
      await shot("02-offline-new-lead-form");
      await click("#nlSave", 800);
      await tick(800);
      const ob2 = await outbox();
      ok(ob2 && ob2.some(o => o.path.startsWith("leads/")), "offline: the new lead did not queue: " + JSON.stringify(ob2 && ob2.map(o => o.path)));
      // language check offline: ES (close whatever sheet the new lead save opened first: #langBtn is in the top bar, covered while a sheet is open)
      await closeSheet();
      await click("#langBtn", 500);
      const chipEs = await syncText();
      ok(/esperando para guardarse|toques/i.test(chipEs), "offline ES: the sync chip is not translated: " + JSON.stringify(chipEs));
      await click("#langBtn", 500);   // back to EN
      await shot("03-offline-lead-queued");
    });

    // ---------- 5. hard stops still hold while fully offline (still offline from step 1) ----------
    await step("5-hardstops-offline", async () => {
      await tab("money");
      await click('[data-open="claim:1418-n-irving-st"]', 800);
      ok(await p.locator("#jtBox").count() === 1, "offline: the claim screen has no Job tracker");
      await p.locator("#jtBox").evaluate(e => e.scrollIntoView({ block: "start" })); await tick(300);
      await click('[data-jtopen="build"]').catch(() => {});
      const stop = await text("#jtNow .jt-stop").catch(() => "");
      ok(/cancel/i.test(stop), "offline: the tear-off's cancel-window lock text is missing: " + JSON.stringify(stop));
      ok((await p.locator('#jtNow [data-jt="tear_off"]').count()) === 0, "HARD STOP BROKEN OFFLINE: tear-off is tappable while offline, inside the cancel window");
      await shot("04-offline-hardstop-tearoff");
      await tab("leads"); await click('#lfStage [data-f="due"]', 300);
      if (!(await p.locator('[data-open="lead:1418-n-irving-st"]').locator("visible=true").count())) await click('#lfStage [data-f="active"]', 300);
      await click('[data-open="lead:1418-n-irving-st"]', 700);
      const doneBtn = vis("#nsCard [data-nsdone]");
      if (await doneBtn.count()) ok(!(await doneBtn.isEnabled()), "HARD STOP BROKEN OFFLINE: the lead's next-step Done is enabled offline before the required ticks/window");
      await shot("05-offline-hardstop-lead");
      await closeSheet();
    });

    // ---------- back online: batch 1 (3 taps + a new lead) drains with no lost tap and no duplicate ----------
    await step("1b-back-online-drain", async () => {
      const before = await doorIds();
      const expectFirst = firstPids.filter(Boolean);
      await syncNow(15000);
      const ob = await outbox();
      ok(!ob || ob.filter(o => o.op !== "king").length === 0, "batch 1 did not fully drain once back online: " + JSON.stringify(ob));
      const after = await doorIds();
      const dup = after.filter((v, i, a) => a.indexOf(v) !== i);
      ok(dup.length === 0, "batch 1: a door doc was duplicated once it reached the server: " + JSON.stringify(dup));
      const newDoors = after.filter(x => !before.includes(x));
      ok(newDoors.length === expectFirst.length, `batch 1: expected ${expectFirst.length} doors to land, got ${newDoors.length}`);
      const leads = await leadIds();
      ok(leads.some(l => /5th/.test(l) || l.includes("410")), "batch 1: the offline new lead (410 W 5th St) never reached the server: " + JSON.stringify(leads));
      await shot("05b-batch1-drained");
    });

    // ---------- 4. connection drops mid-photo-upload ----------
    await step("4-photo-drop", async () => {
      await tab("leads"); await click('#lfStage [data-f="due"]', 300);
      const anyLead = await leadIds();
      const target = anyLead.find(x => x !== "1418-n-irving-st") || anyLead[0];
      // this lead may not be visible under "due"; open it straight from the address bar isn't possible, so use Won/Active too
      for (const f of ["due", "active", "won"]) { if (await p.locator(`[data-open="lead:${target}"]`).locator("visible=true").count()) break; await click(`#lfStage [data-f="${f}"]`, 300); }
      await click(`[data-open="lead:${target}"]`, 700).catch(() => {});
      await click(`[data-open="lph:${target}"]`, 500).catch(() => {});
      const hasPhotos = await p.locator("#phBox").count();
      if (!hasPhotos) { notes.push("4-photo-drop: no lead with a Photos box in this data set; skipped"); return; }
      const photosBefore = await p.evaluate(id => (window.__db.C.leads[id] && window.__db.C.leads[id].photos || []).length, target);
      // file 1 of 2 uploads fine, file 2 drops mid-upload (a plain network error, not the store_unavailable code the app already retries once for)
      await setNet("script", { queue: [true, false] });
      const inp = p.locator('#shBody input[type="file"][data-slot]').first();
      await inp.setInputFiles([{ name: "roof1.jpg", mimeType: "image/jpeg", buffer: JPEG }, { name: "roof2.jpg", mimeType: "image/jpeg", buffer: JPEG }]);
      await tick(1500);
      await shot("06-photo-mid-batch-drop");
      const msg = await p.locator("#shBody .ph-status").innerText().catch(() => "");
      ok(/[a-z]/i.test(msg) && !/undefined|NaN|\[object/i.test(msg), "photo drop: no clear user-readable error for the dropped file: " + JSON.stringify(msg));
      const photosAfter1 = await p.evaluate(id => (window.__db.C.leads[id] && window.__db.C.leads[id].photos || []).length, target);
      ok(photosAfter1 === photosBefore + 1, `photo drop: file 1 (the one that succeeded) was not kept: ${photosBefore} -> ${photosAfter1}`);
      // retry the dropped file: it uploads as a new photo, the first one is untouched (no duplicate, nothing silently lost)
      await setNet("script", { queue: [true] });
      const inp2 = p.locator('#shBody input[type="file"][data-slot]').first();
      await inp2.setInputFiles({ name: "roof2-retry.jpg", mimeType: "image/jpeg", buffer: JPEG });
      await tick(1200);
      const msg2 = await p.locator("#shBody .ph-status").innerText().catch(() => "");
      ok(!/error|fail|not saved/i.test(msg2), "photo retry after reconnect: still shows an error: " + JSON.stringify(msg2));
      const idsAfter = await p.evaluate(id => (window.__db.C.leads[id] && window.__db.C.leads[id].photos || []).map(x => x.id), target);
      const dup = idsAfter.filter((v, i, a) => a.indexOf(v) !== i);
      ok(dup.length === 0, "photo retry: a photo id was duplicated: " + JSON.stringify(idsAfter));
      ok(idsAfter.length === photosBefore + 2, `photo retry: expected ${photosBefore + 2} photos after both uploads, got ${idsAfter.length}`);
      await shot("07-photo-retry-ok");
      await closeSheet();
    });

    // ---------- 3. connection drops mid-save, then the retry succeeds: no duplicate ----------
    await step("3-drop-mid-save", async () => {
      await setNet("flaky", { failRate: 1, minLat: 100, maxLat: 200 });   // this exact write will fail once
      await tab("knock");
      const before = await outbox();
      await click('#kNow .ans[data-r="not_home"]');
      await tick(500);
      const midOb = await outbox();
      ok(midOb && midOb.length >= (before ? before.length : 0) + 1, "drop mid-save: the tap did not queue when the write failed");
      await syncNow(8000);
      const doors1 = await doorIds();
      const dup = doors1.filter((v, i, a) => a.indexOf(v) !== i);
      ok(dup.length === 0, "drop mid-save then retry: a duplicate door doc exists: " + JSON.stringify(dup));
      const obAfter = await outbox();
      ok(obAfter && obAfter.filter(o => o.op !== "king").length === 0, "drop mid-save: the outbox did not drain after reconnecting: " + JSON.stringify(obAfter));
      await shot("08-drop-mid-save-recovered");
    });

    // ---------- 2. flaky 3G burst: outbox drains in order, exactly once each ----------
    await step("2-flaky-burst", async () => {
      await setNet("flaky", { failRate: 0.3, minLat: 300, maxLat: 1500 });
      const before = await doorIds();
      const taps = ["no", "not_home", "no", "interested", "not_home"];
      for (const r of taps) { await click(`#kNow .ans[data-r="${r}"]`, 250); }
      await shot("09-flaky-mid-burst");
      const chip = await syncText();
      ok(chip !== "", "flaky: the sync chip should show while writes are still catching up");
      await flushToIdle(150000);   // automatic recovery only (no manual chip tap): backoff caps at 60 s/retry, so give it a wide margin (fake clock: cheap)
      let ob = await outbox();
      if (ob && ob.some(o => o.op !== "king")) {
        // T163 bug (see report): under a burst of taps on a lossy connection, an item can end up parked in the outbox with
        // ZERO further retry attempts ever recorded (not just slow backoff) - ask window.__attempts if this is that, then
        // check whether the sync chip's own documented "tap to try sending now" recovers it (it does, in every repro seen).
        const stuckPaths = ob.filter(o => o.op !== "king").map(o => o.path);
        const neverRetried = await p.evaluate(paths => paths.filter(pth => !window.__attempts.some(a => a.path === pth)), stuckPaths);
        if (await p.locator("#syncChip").isVisible().catch(() => false)) { await click("#syncChip", 500); await tick(5000); }
        ob = await outbox();
        ok(false, `flaky 3G: the outbox did not drain on its own in 150 s (backoff never runs this long): stuck on ${JSON.stringify(stuckPaths)}, of which ${JSON.stringify(neverRetried)} got ZERO retry attempts ever (window.__attempts) - a manual sync-chip tap ${(!ob || !ob.some(o => o.op !== "king")) ? "DID recover it (so this is a stuck automatic retry, not lost data)" : "also failed to recover it"}`);
      }
      const after = await doorIds();
      const newDoors = after.filter(x => !before.includes(x));
      ok(newDoors.length === taps.length, `flaky 3G: expected ${taps.length} new doors, got ${newDoors.length}: ` + JSON.stringify(newDoors));
      const dup = after.filter((v, i, a) => a.indexOf(v) !== i);
      ok(dup.length === 0, "flaky 3G: a door doc was written twice: " + JSON.stringify(dup));
      const pidsAfter = await knockPids();
      ok(pidsAfter.length === new Set(pidsAfter).size, "flaky 3G: Knock lists a door twice: " + pidsAfter.join(","));
      // order: what actually reached "the server" must be in the order the taps were made (queuedAt), never reordered or skipped-ahead
      const appliedOrder = (await applied()).filter(a => a.path.startsWith("doors/")).map(a => a.path);
      const sameSet = new Set(appliedOrder).size === appliedOrder.length;
      ok(sameSet, "flaky 3G: the same door write reached the server more than once: " + JSON.stringify(appliedOrder));
      await shot("10-flaky-drained");
      const chipDone = await syncText();
      ok(chipDone === "" || /all saved|todo guardado/i.test(chipDone), "flaky 3G: sync chip did not clear/say done after draining: " + JSON.stringify(chipDone));
    });

    // ---------- 7. no endless retries: black-box check that failed attempts back off instead of hammering ----------
    await step("7-backoff", async () => {
      await setNet("offline");
      await tab("knock");
      const a0 = await p.evaluate(() => window.__attempts.length);
      await click('#kNow .ans[data-r="no"]', 900);   // queues; the immediate flush attempt fails, and the app's own backoff timer takes over
      await tick(40000);   // several retry cycles, still offline
      const mine = (await p.evaluate(() => window.__attempts.slice())).slice(a0);
      ok(mine.length >= 2, `backoff: expected more than one retry attempt over 40 s offline, got ${mine.length}`);
      ok(mine.length <= 12, `backoff: too many retry attempts in 40 s offline (endless retries, no real backoff): ${mine.length}: ` + JSON.stringify(mine.map(x => x.at)));
      const gaps = mine.slice(1).map((x, i) => x.at - mine[i].at);
      ok(gaps.every(g => g >= 2000), `backoff: two retries fired closer together than a sane minimum backoff: ${JSON.stringify(gaps)}`);
      const growing = gaps.every((g, i) => i === 0 || g >= gaps[i - 1] - 200 || gaps[i - 1] >= 55000);   // grows each time, until it's near the cap
      ok(growing, `backoff: retry gaps did not grow (no real backoff): ${JSON.stringify(gaps)}`);
      await syncNow(15000);
      const ob = await outbox();
      ok(!ob || ob.filter(o => o.op !== "king").length === 0, "backoff: the outbox did not drain once back online: " + JSON.stringify(ob));
      await closeSheet();
    });
  } catch (e) { fails.push("uncaught: " + String(e && e.message || e)); }

  // ---------- 6. reload while offline: the outbox survives; back online it drains once, no dupes ----------
  await step("6-reload-offline", async () => {
    await syncNow(20000);   // start from a clean, fully-drained baseline so "2 new doors" below is unambiguous
    await outbox().then(ob => ok(!ob || ob.filter(o => o.op !== "king").length === 0, "reload test: could not reach a clean baseline before starting: " + JSON.stringify(ob)));
    await setNet("offline");
    await tab("knock");
    const before = await doorIds();
    await click('#kNow .ans[data-r="no"]');
    await click('#kNow .ans[data-r="not_home"]');
    const obBefore = await outbox();
    ok(obBefore && obBefore.filter(o => o.op !== "king").length >= 2, "reload test: the 2 taps did not queue before reload");
    await shot("11-before-reload");
    await p.reload({ waitUntil: "load" });
    await p.clock.runFor(1200);
    const obAfterReload = await outbox();
    ok(obAfterReload && obAfterReload.length === obBefore.length, `reload while offline: the outbox changed size ${obBefore.length} -> ${obAfterReload && obAfterReload.length} (a queued write was lost)`);
    await shot("12-after-reload-still-offline");
    const chip = await syncText();
    ok(chip !== "", "reload while offline: the sync chip does not show the still-waiting writes after reload");
    await syncNow(15000);
    const obFinal = await outbox();
    ok(!obFinal || obFinal.filter(o => o.op !== "king").length === 0, "reload while offline: the outbox did not drain after coming back online: " + JSON.stringify(obFinal));
    const after = await doorIds();
    const newOnes = after.filter(x => !before.includes(x));
    const dup = after.filter((v, i, a) => a.indexOf(v) !== i);
    ok(dup.length === 0, "reload while offline: a door doc was duplicated after the reload+reconnect: " + JSON.stringify(dup));
    ok(newOnes.length === 2, `reload while offline: expected 2 new doors after reconnecting, got ${newOnes.length}: ` + JSON.stringify(newOnes));
    await shot("13-after-reconnect");
  });

  ok(!errs.length, "page errors / console errors across the run: " + errs.slice(0, 8).join(" | "));
  await ctx.close();
}

(async () => {
  const { chromium } = loadPlaywright();
  const exe = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ executablePath: exe, headless: !HEADED, args: ["--no-sandbox"] });
  const url = await pageUrl("pages/hmp-app.html");
  try { await run(browser, url); } finally { await browser.close(); await closeServer(); }
  for (const x of notes) console.log(x);
  for (const f of fails) console.error("FAIL " + f);
  console.log(fails.length ? `badsignal check: ${fails.length} failed (shots in ${OUT})` : "badsignal check OK (shots in " + OUT + ")");
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
