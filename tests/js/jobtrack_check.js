/* T199: checks docs/app/jobtrack.js, the HMP App's Job tracker (research round 56's 14 steps), above all its hard stops.
 *   node tests/js/jobtrack_check.js        Exit 0 = all good. tests/release_checks.sh runs every tests/js/*_check.js.
 * 1. the 3-day cancel end matches the app's own cancelByDay (pages/hmp-app.html) for every signing day in 2026-2027;
 * 2. tear-off / install stay locked until BOTH itemized sends (homeowner + insurer, NE 44-8606) are logged AND the
 *    contract's cancel window is over; materials stay locked until the ACV check is deposited or a supplier account is
 *    approved - on a tap (tapPatch) and in the Right Hand chat (checkWrite);
 * 3. taps: today's date, the whole sub-object kept (a sibling is never dropped), the stage only moves forward, Undo values;
 * 4. due reminders: mortgage endorsement the day the ACV check arrives, depreciation request the day the job finishes,
 *    review link within 24 h (amber on the day, red after);
 * 5. old claims (the design-gate fixture) still render, legal steps are never marked done from the stage alone;
 * 6. every string in English AND Spanish, and nothing that covers/waives/rebates a deductible, promises insurance
 *    pays, says "licensed"/"licenciado" or offers a gift;
 * 7. the page's update_claim action documents every claim.job field and runs the same check. */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..", "..");
const J = require(path.join(ROOT, "docs", "app", "jobtrack.js"));
const page = fs.readFileSync(path.join(ROOT, "pages", "hmp-app.html"), "utf8");
const fails = [];
let n = 0;
const ok = (cond, msg) => { n++; if (!cond) fails.push(msg); };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
const O = today => ({ today });

// 0. the module's own cases
for (const f of J.selfCheck()) fails.push("selfCheck " + f);

// 1. cancel end = the page's cancelByDay (its helpers pulled out of the page and run as they are)
{
  const grab = re => { const m = page.match(re); if (!m) { fails.push("page helper not found: " + re); return ""; } return m[0]; };
  const src = [
    grab(/const pad2 = [^\n]+/), grab(/const ymd = [^\n]+/), grab(/const addDays = [^\n]+/), grab(/const toDate = [^\n]+/),
    grab(/function fedHolidays\(y\)\{[\s\S]*?\n\}/), grab(/function cancelByDay\(d0\)\{[^\n]+/),
  ].join("\n") + "\nthis.cancelByDay = cancelByDay;";
  const box = {}; vm.runInNewContext(src, box);
  let d = "2026-01-01", diffs = 0;
  while (d < "2028-01-01") {
    const a = box.cancelByDay(d), b = J.cancelEnd(d);
    if (a !== b && diffs++ < 5) fails.push(`cancel end for ${d}: page ${a}, module ${b}`);
    n++;
    const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + 1); d = x.toISOString().slice(0, 10);
  }
  eq(J.cancelEnd("2026-11-25"), "2026-12-01", "cancel end skips Thanksgiving, Saturday and Sunday");
  eq(J.cancelEnd("2026-12-24"), "2026-12-30", "cancel end skips Christmas, Saturday and Sunday");
  eq(J.cancelEnd("2026-10-01"), "2026-10-06", "cancel end skips Saturday (King, 2026-09-29: until the boss confirms)");
}

// 2. the hard stops
const base = () => ({ address: "1418 Irving St", stage: "signed", acv: { amount: 14650, received: "2026-09-27" }, mortgage: { company: "US Bank" },
  job: { contract_signed: "2026-09-24", itemized_sent: { homeowner: "2026-09-26" } } });
{
  let c = base(), g = J.gates(c, O("2026-09-30"));
  ok(!g.work.ok, "work must be locked with only the homeowner's itemized copy logged");
  eq(g.work.missing.map(m => m.en), ["Itemized description sent to the insurer"], "work gate names the missing insurer send");
  c.job.itemized_sent.insurer = "2026-09-27";
  ok(!J.gates(c, O("2026-09-28")).work.ok, "work must be locked inside the 3-day cancel window (signed Thu 9/24, ends Tue 9/29: Fri, Mon, Tue)");
  ok(!J.gates(c, O("2026-09-29")).work.ok, "work must be locked on the last cancel day");
  ok(J.gates(c, O("2026-09-30")).work.ok, "work opens the day after the cancel window");
  eq(J.gates(c, O("2026-09-30")).work.startOn, "2026-09-30", "work start day");
  c = base(); c.job.itemized_sent = { insurer: "2026-09-27" };
  ok(!J.gates(c, O("2026-09-30")).work.ok, "work must be locked with only the insurer's copy");
  c = base(); c.job.itemized_sent.insurer = "2026-10-05";
  ok(!J.gates(c, O("2026-09-30")).work.ok, "an itemized send dated in the future does not count");
  c = base(); c.job.itemized_sent.insurer = true; c.job.itemized_sent.homeowner = true;
  ok(!J.gates(c, O("2026-09-30")).work.ok, "itemized sends need real dates, not true");
  c = base(); c.job.itemized_sent.insurer = "2026-09-27"; delete c.job.contract_signed;
  ok(!J.gates(c, O("2026-10-30")).work.ok, "no contract date = no known cancel end = locked");
  c.stage = "materials_ordered";
  ok(!J.gates(c, O("2026-10-30")).work.ok, "a stage past 'signed' is not a contract date");
  c = base(); c.job.itemized_sent.insurer = "2026-09-27"; c.job.cancel_by = "2026-10-02";
  ok(!J.gates(c, O("2026-10-01")).work.ok, "a later stored cancel_by (e.g. a written denial, 44-8603) wins");

  c = base();
  ok(!J.gates(c, O("2026-09-30")).materials.ok, "materials locked: ACV only received, no supplier account");
  c.acv.deposited = "2026-09-29"; ok(J.gates(c, O("2026-09-30")).materials.ok, "materials open once the ACV check is deposited");
  c = base(); c.job.supplier_account = { name: "ABC Supply", approved: "2026-09-20" }; ok(J.gates(c, O("2026-09-30")).materials.ok, "materials open with a supplier account");
  c = base(); c.job.supplier_account = { name: "ABC Supply" }; ok(!J.gates(c, O("2026-09-30")).materials.ok, "an account name alone is not an approval");

  // taps
  c = base();
  for (const k of ["tear_off", "installed"]) { const r = J.tapPatch(c, k, O("2026-09-30")); ok(r.blocked && !r.patch, `tap ${k} must be blocked`); ok(/itemized/i.test(JSON.stringify(r.blocked || [])), `tap ${k} says why`); }
  ok(J.tapPatch(c, "ordered", O("2026-09-30")).blocked, "tap materials ordered must be blocked");
  c.job.itemized_sent.insurer = "2026-09-27"; c.install = { done: null, crew_note: "keep" };
  let r = J.tapPatch(c, "tear_off", O("2026-09-29"));
  ok(r.blocked, "tap tear-off blocked on the last cancel day");
  r = J.tapPatch(c, "tear_off", O("2026-09-30"));
  ok(!r.blocked && r.patch.install.start === "2026-09-30", "tap tear-off stamps today once open");
  eq(r.patch.install.crew_note, "keep", "the tap keeps the sub-object's other fields");
  eq(r.undo.install, { done: null, crew_note: "keep" }, "undo keeps the old sub-object");
  ok(!("stage" in r.patch), "tear-off start does not change the stage");
  r = J.tapPatch(c, "installed", O("2026-10-02"));
  eq(r.patch.stage, "installed", "install done moves the stage up to installed");
  r = J.tapPatch(c, "acv_in", O("2026-09-27")); eq(r.patch.acv, { amount: 14650, received: "2026-09-27" }, "ACV tap keeps the amount");
  r = J.tapPatch(Object.assign(base(), { stage: "materials_ordered" }), "contract", O("2026-09-25"));
  ok(!("stage" in r.patch), "a tap never moves the stage back");
  eq(r.patch.job.cancel_by, "2026-09-30", "contract tap stores the cancel end (Fri 9/25: Mon, Tue, Wed)");
  eq(r.patch.job.itemized_sent, { homeowner: "2026-09-26" }, "contract tap keeps the job's other fields");
  ok(!("stage" in J.tapPatch(Object.assign(base(), { stage: "lost" }), "contract", O("2026-09-25")).patch), "a lost claim keeps its stage");
  r = J.tapPatch(Object.assign(base(), { stage: "scope_in" }), "contract", O("2026-09-25")); eq(r.patch.stage, "signed", "contract tap moves scope_in -> signed");
  eq(r.undo.stage, "scope_in", "undo has the old stage");

  // the chat's check
  const old = base();
  let nx = JSON.parse(JSON.stringify(old)); nx.install = { start: "2026-09-30" };
  let why = J.checkWrite(old, nx, O("2026-09-30"));
  ok(why && why.en && why.es && /insurer/.test(why.en) && /aseguradora/.test(why.es), "chat: tear-off without the insurer send is refused, EN + ES");
  nx.job.itemized_sent.insurer = "2026-09-27";
  ok(J.checkWrite(old, nx, O("2026-09-30")) === null, "chat: tear-off allowed when both sends are in and the window is over");
  ok(J.checkWrite(old, nx, O("2026-09-28")), "chat: tear-off refused inside the cancel window");
  nx = JSON.parse(JSON.stringify(old)); nx.stage = "installed";
  ok(J.checkWrite(old, nx, O("2026-09-30")), "chat: moving the stage to installed is the same hard stop");
  nx.stage = "paid"; ok(J.checkWrite(old, nx, O("2026-09-30")) === null, "chat: closing a claim as paid is not blocked");
  nx = JSON.parse(JSON.stringify(old)); nx.materials = { ordered: "2026-09-28", supplier: "ABC Supply" };
  why = J.checkWrite(old, nx, O("2026-09-28")); ok(why && /ACV/.test(why.en), "chat: materials order before a deposit or supplier account is refused");
  nx.acv.deposited = "2026-09-28"; ok(J.checkWrite(old, nx, O("2026-09-28")) === null, "chat: materials order allowed after the deposit");
  nx = JSON.parse(JSON.stringify(old)); nx.stage = "materials_ordered"; ok(J.checkWrite(old, nx, O("2026-09-28")), "chat: stage materials_ordered is the same hard stop");
  const legacy = { stage: "materials_ordered", materials: { ordered: "2026-09-20" }, acv: { received: "2026-08-20" } };
  ok(J.checkWrite(legacy, Object.assign({}, legacy, { notes: "x" }), O("2026-09-28")) === null, "chat: an old claim that already has materials ordered can still be updated");
  ok(J.checkWrite({}, { stage: "installed", address: "1 A St" }, O("2026-09-28")), "chat: a new claim logged straight at installed needs the itemized sends");
}

// 4. due reminders
{
  const lv = (c, t, key) => { const r = J.reminders(c, O(t)).find(x => x.key === key); return r ? r.level : null; };
  const c = base();
  eq(lv(c, "2026-09-26", "mortgage"), null, "no mortgage reminder before the check arrives");
  eq(lv(c, "2026-09-27", "mortgage"), "due", "mortgage endorsement amber the day the ACV check arrives");
  eq(lv(c, "2026-09-28", "mortgage"), "late", "mortgage endorsement red the day after");
  c.mortgage.check_sent = "2026-09-28"; eq(lv(c, "2026-09-29", "mortgage"), null, "sent for endorsement clears it");
  const d = { stage: "installed", depreciation_held: 5150, install: { start: "2026-10-01", done: "2026-10-03" } };
  eq(lv(d, "2026-10-03", "depreciation"), "due", "depreciation request amber the day the install is done");
  eq(lv(d, "2026-10-04", "depreciation"), "late", "depreciation request red the next day");
  eq(lv(Object.assign({}, d, { completion_sent: "2026-10-02" }), "2026-10-03", "depreciation"), "late", "the completion certificate day starts it too");
  eq(lv(Object.assign({}, d, { job: { depreciation_requested: "2026-10-03" } }), "2026-10-05", "depreciation"), null, "logged request clears it");
  eq(lv(Object.assign({}, d, { stage: "depreciation_requested" }), "2026-10-05", "depreciation"), null, "the old stage clears it too");
  eq(lv(Object.assign({}, d, { depreciation_held: 0 }), "2026-10-05", "depreciation"), null, "no depreciation held = no request");
  eq(lv(d, "2026-10-03", "review"), "due", "review link amber on the finish day");
  eq(lv(d, "2026-10-04", "review"), "due", "review link still amber within 24 h");
  eq(lv(d, "2026-10-05", "review"), "late", "review link red after 24 h");
  eq(lv(Object.assign({}, d, { job: { review_requested: "2026-10-03" } }), "2026-10-05", "review"), null, "review sent clears it");
  eq(J.reminders(d, { today: "2026-10-05", reviewSent: "2026-10-04" }).some(x => x.key === "review"), false, "the lead's review text clears it");
  eq(lv(d, "2026-10-25", "warranty"), null, "no warranty reminder early");
  eq(lv(d, "2026-10-27", "warranty"), "due", "warranty registration amber in its last week");
  eq(lv(d, "2026-11-03", "warranty"), "late", "warranty registration red after 30 days");
  const b = base(); b.job.crew = { start: "2026-09-30" };
  eq(lv(b, "2026-09-26", "build"), null, "no build warning 4 days out");
  eq(lv(b, "2026-09-27", "build"), "due", "build day 3 days out while tear-off is locked");
  eq(J.reminders(Object.assign({}, d, { stage: "paid" }), O("2026-10-05")).length, 0, "no reminders on a paid claim");
  const rs = J.reminders(c, O("2026-09-28")); ok(rs.every(r => r.text.en && r.text.es && r.short.en && r.short.es), "reminders in English and Spanish");
}

// 5. old claims render; legal steps never done from the stage alone
{
  const fx = JSON.parse(fs.readFileSync(path.join(ROOT, "tests", "pages", "design_gate_fixture.json"), "utf8"));
  for (const [id, c] of Object.entries(fx.collections.claims)) {
    let m = null; try { m = J.model(c, O("2026-09-27")); } catch (e) { fails.push(`model throws on fixture claim ${id}: ${e.message}`); continue; }
    eq(m.steps.length, 14, `fixture ${id}: 14 steps`);
    ok(m.steps.find(s => s.id === "itemized").status !== "done", `fixture ${id}: the 44-8606 step is never done from the stage alone`);
  }
  const m = J.model(fx.collections.claims["1107-n-h-st"], O("2026-09-27"));
  eq(m.current, "itemized", "1107 N H St (materials ordered, nothing logged): the current step is the itemized description");
  eq(m.steps.find(s => s.id === "contingency").status, "skipped", "the contingency counts as passed once the contract is signed");
  const paid = J.model(fx.collections.claims["2020-e-6th-st"], O("2026-09-27"));
  ok(paid.fin && paid.current === null, "a paid claim has no current step");
  for (const s of ["inspected", "claim_filed", "adjuster_set", "scope_in", "signed", "supplement", "materials_ordered", "installed", "depreciation_requested", "paid", "lost", "bogus", undefined])
    try { J.model({ stage: s }, O("2026-09-27")); n++; } catch (e) { fails.push(`model throws on stage ${s}`); }
  try { J.model({ stage: "signed", job: "x", acv: 5, mortgage: [], install: null, supplements: "no" }, O("2026-09-27")); n++; } catch (e) { fails.push("model throws on junk fields: " + e.message); }
  const fromLead = J.model({ stage: "claim_filed" }, { today: "2026-09-27", leadSigned: "2026-09-20" });
  eq(fromLead.steps[0].status, "done", "the Sale Guide's signing day closes step 1");
  const demo = base(); demo.job.permit = { pulled: "2026-09-26", number: "B-1" };
  const dm = J.model(demo, O("2026-09-27"));
  eq([dm.current, dm.next], ["itemized", "acv"], "demo claim: current step 5, next 6");
  const build = dm.steps.find(s => s.id === "build");
  eq(build.parts.filter(p => p.state === "locked").map(p => p.k), ["tear_off", "installed"], "demo claim: tear-off and install show locked");
  eq(dm.steps.find(s => s.id === "materials").parts.find(p => p.k === "ordered").state, "locked", "demo claim: materials order shows locked");
  ok(dm.steps.find(s => s.id === "contract").info.some(x => /Sep 29/.test(x.en) && /Sep 30/.test(x.en)), "the contract step shows the cancel end and the first work day");
}

// 6. words
{
  const texts = [];
  const both = (o, where) => { ok(o && typeof o.en === "string" && o.en.trim() && typeof o.es === "string" && o.es.trim(), `${where}: needs English and Spanish`); if (o) texts.push(o.en, o.es); };
  eq(J.STEPS.map(s => s.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], "steps numbered 1-14 in order");
  for (const s of J.STEPS) {
    for (const k of ["title", "short", "who", "when", "money"]) both(s[k], `step ${s.n} ${k}`);
    if (s.law) both(s.law, `step ${s.n} law`);
    for (const p of s.papers) both(p, `step ${s.n} paper`);
    for (const p of s.parts) both(p, `step ${s.n} part ${p.k}`);
  }
  eq(J.STEPS.filter(s => s.law).map(s => s.n), [1, 2, 3, 4, 5, 6, 7, 9, 10, 12, 13, 14], "the steps with a legal line");
  const m = J.model(Object.assign(base(), { install: { done: "2026-10-03" }, supplements: [{ item: "x" }], depreciation_held: 10 }), O("2026-10-05"));
  for (const s of m.steps) for (const x of s.info) both(x, `step ${s.n} info`);
  for (const x of m.reminders) both(x.text, "reminder " + x.key);
  for (const x of J.gates(base(), O("2026-09-26")).work.missing) both(x, "work gate");
  const all = texts.join("\n").toLowerCase();
  for (const bad of ["licensed", "licenciad", "insurance will pay", "el seguro pagará", "free roof", "gift card", "tarjeta de regalo", "we cover", "le cubrimos", "assignment of benefits clause"]) ok(!all.includes(bad), `banned words in the tracker: "${bad}"`);
  for (const w of ["waiv", "rebat", "perdon", "rebaj", "cubre"]) {   // a lien waiver is a paper, not a deductible
    for (let i = all.indexOf(w); i >= 0; i = all.indexOf(w, i + 1)) if (!/lien $/.test(all.slice(Math.max(0, i - 5), i))) ok(/(never|nunca)[^.]{0,40}$/.test(all.slice(Math.max(0, i - 50), i)), `"${w}" only inside a "never" rule: ...${all.slice(Math.max(0, i - 50), i + 20)}...`);
  }
  ok(/handwritten note only|written by hand|a mano/i.test(texts.join(" ")) && /no gifts or money/.test(all) && /sin regalos ni dinero/.test(all), "referral thanks = a handwritten note only, no gifts or money (EN + ES)");
  ok(/registered/.test(all) && /registrado/.test(all), "HMP is 'registered' / 'registrado'");
}

// 7. the page's chat action knows every job field and runs the same check
{
  const line = (page.match(/- update_claim \{[^\n]+/) || [""])[0];
  const walk = (shape, pre) => Object.entries(shape).forEach(([k, t]) => { if (k === "cancel_by") return; ok(line.includes(k), `update_claim description is missing job field ${pre}${k}`); if (typeof t === "object") walk(t, pre + k + "."); });
  ok(line.includes("job{"), "update_claim description lists job{...}");
  walk(J.SHAPE, "job.");
  ok(/HMPJobTrack\.checkWrite\(old \|\| \{\}, c,/.test(page), "the update_claim handler runs HMPJobTrack.checkWrite before saving");
  ok(/HMPJobTrack\.tapPatch\(c, key, jtOpts\(c\)\)/.test(page), "the claim screen's taps go through HMPJobTrack.tapPatch");
  ok(page.includes('<script src="app/jobtrack.js"></script>'), "the page loads app/jobtrack.js");
  ok(!/data-tap="\$\{k\}"/.test(page), "the old two-tap check buttons are gone (the tracker's step 6 has them)");
}

if (fails.length) { for (const f of fails) console.error("FAIL " + f); console.error(`${fails.length} of ${n} checks failed`); process.exit(1); }
console.log(`jobtrack OK: ${n} checks (cancel end vs the page for 2026-2027, hard stops on taps and chat, reminders, old claims, EN/ES + legal words)`);
