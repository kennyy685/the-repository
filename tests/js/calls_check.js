/* Checks pages/v25/calls.js (HMPCalls): the HMP App's Calls today (calls/today: account hits + business calls), the
 * practice doc built from the practice houses, the round 59 storm-age flag and the calendar-day math (America/Chicago)
 * behind the "N days late" badge. Uses the engine's real calls/today output (hh.py calltoday / accounts shapes).
 *   node tests/js/calls_check.js      Exit 0 = all good. tests/release_checks.sh runs it. */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..", "..");
const sb = {}; sb.window = sb; vm.createContext(sb);
for (const f of ["pages/v25/calls.js", "pages/v25/practice-houses.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), sb, { filename: f });
const C = sb.HMPCalls, H = sb.HMPPracticeHouses;
const fails = []; let n = 0;
const ok = (c, m) => { n++; if (!c) fails.push(m); };
const BANNED = /insurance|seguro|aseguradora|deductible|deducible|claim will|free roof|waive|rebate|licensed|licenciado/i;

// ---- calendar days (America/Chicago) ----
ok(C.daysBetween("2026-09-25", "2026-09-29") === 4, "daysBetween Fri->Tue is not 4");
ok(C.daysBetween("2026-12-31", "2027-01-01") === 1, "daysBetween over New Year is not 1");
ok(C.daysBetween("2026-03-07", "2026-03-09") === 2 && C.daysBetween("2026-10-31", "2026-11-02") === 2, "daysBetween across a DST change is off");
ok(C.daysBetween("bad", "2026-09-29") === null, "daysBetween takes a bad day");
ok(C.chiDay(Date.parse("2026-09-30T00:30:00Z")) === "2026-09-29", "7:30 PM Tue Central (00:30 UTC Wed) is not Tuesday in Chicago");
ok(C.chiDay(Date.parse("2026-09-29T05:01:00Z")) === "2026-09-29", "12:01 AM Tue Central is not Tuesday");
ok(C.chiDay(Date.parse("2026-01-15T05:30:00Z")) === "2026-01-14", "11:30 PM CST (winter, UTC-6) is not the 14th");
// the badge: last contact Fri Sep 25 3 PM Central, now Tue Sep 29 6:30 AM = 87.5 h (3 x 24 h) but 4 calendar days
const late = C.daysBetween(C.chiDay(Date.parse("2026-09-25T20:00:00Z")), C.chiDay(Date.parse("2026-09-29T11:30:00Z")));
ok(late === 4, "Fri 3 PM -> Tue 6:30 AM is not 4 calendar days: " + late);
// contact 11 PM Mon, now 7 AM Wed = 32 h (1 x 24 h) but 2 calendar days
ok(C.daysBetween(C.chiDay(Date.parse("2026-09-29T04:00:00Z")), C.chiDay(Date.parse("2026-09-30T12:00:00Z"))) === 2, "11 PM Mon -> 7 AM Wed is not 2 calendar days");

// ---- storm age (round 59): quiet flag from 60 days, never before ----
ok(C.stormAge("2026-08-08", "2026-10-06") === null, "59 days flagged");
ok(C.stormAge("2026-08-08", "2026-10-07") === 60, "60 days not flagged");
ok(C.stormAge("2026-06-13", "2026-09-28") === 107, "Jun 13 -> Sep 28 is not 107");
ok(C.stormAge(null, "2026-09-28") === null && C.stormAge("2026-10-01", "2026-09-28") === null, "no/future storm day flagged");
for (const lg of ["en", "es"]) {
  const s = C.t(lg).stormAge(75);
  ok(/75/.test(s) && (lg === "en" ? /check your policy's time limit/ : /revise el límite de tiempo de su póliza/).test(s), `${lg} storm-age line wrong: ${s}`);
  ok(!/deadline|left|remaining|quedan|fecha límite|\bplazo\b/i.test(s), `${lg} storm-age line reads like a countdown/deadline: ${s}`);
}

// ---- view(): the engine's calls/today shape ----
const doc = {
  date: "2026-09-29", accounts_hit: [
    { key: "leads/1753-n-clarkson-st", kind: "lead", address: "1753 N Clarkson St", city: "Fremont", event_date: "2026-09-29", days_ago: 0, peril: "hail",
      max_hail_in: 1.25, hail_in: 1.25, day: "2026-09-29", name: "Maria Lopez", phone: "402-555-0199", ask_for: "Maria", match: "at", also: [],
      why: { en: "Your lead: 1.25\" hail at the address.", es: "Su prospecto: granizo." }, opener: { en: "Hi", es: "Hola" }, hail_report_hint: { en: "h", es: "h" } },
    { key: "commercial|x", kind: "commercial", address: "100 Main St", city: "Fremont", event_date: "2026-09-27", peril: "wind", max_hail_in: null, max_wind_mph: 61,
      name: "Main St Apartments", phone: "(402) 555-0110", ask_for: "Leasing", ask_for_es: "Arrendamiento", also: [{ address: "102 Main St" }], call_rank: 1 }],
  calls: [
    { kind: "building", name: "Main St Apartments", phone: "402.555.0110", address: "100 Main St", hail_in: 1.5, day: "2026-09-27", account_hit: true },
    { kind: "building", name: "Oak Plaza", phone: "402-555-0120", ask_for: "Manager", address: "5 Oak", hail_in: 1.0, day: "2026-09-20", days_ago: 9 },
    { kind: "building", name: "No line", phone: "", address: "9 Elm", hail_in: 2.0, day: "2026-09-28" },
    { kind: "association", name: "Fremont Landlords", phone: "402-555-0130", hail_in: null, day: null }]
};
let v = C.view(doc, "2026-09-29");
ok(v && v.hits.length === 2 && v.calls.length === 2, "view: expected 2 hits + 2 calls: " + JSON.stringify(v && [v.hits.length, v.calls.length]));
if (v) {
  const home = v.hits[0], biz = v.hits[1];
  ok(home.name === "1753 N Clarkson St" && home.phone === "" && home.ask_for === "", "a home hit carries a person's name or phone: " + JSON.stringify([home.name, home.phone, home.ask_for]));
  ok(!JSON.stringify(v).includes("Maria"), "a homeowner's name reached the view");
  ok(home.days_ago === 0 && home.hail_in === 1.25, "home hit facts wrong");
  ok(biz.biz && biz.phone && biz.peril === "wind" && biz.wind_mph === 61 && biz.days_ago === 2, "business wind hit wrong: " + JSON.stringify(biz));
  ok(v.calls.every(c => c.phone.replace(/\D/g, "").length >= 10), "a call without a business line is shown");
  ok(!v.calls.some(c => c.name === "Main St Apartments"), "the account-hit business line shows twice");
  ok(v.calls[0].name === "Oak Plaza" && v.calls[0].days_ago === 9, "calls order/days wrong");
}
// ---- ask_for_es: view()'s 3rd arg (lang) prefers the Spanish twin, falls back to EN when it's missing ----
let vEs = C.view(doc, "2026-09-29", "es");
ok(vEs.hits[1].ask_for === "Arrendamiento", "es lang did not prefer ask_for_es on an account hit: " + vEs.hits[1].ask_for);
ok(vEs.calls[0].ask_for === "Manager", "es lang broke ask_for when no ask_for_es twin exists: " + vEs.calls[0].ask_for);
ok(v.hits[1].ask_for === "Leasing", "no/en lang picked the Spanish ask_for_es by default: " + v.hits[1].ask_for);
ok(C.view(doc, "2026-09-29", "en").hits[1].ask_for === "Leasing", "explicit en lang picked ask_for_es: " + C.view(doc, "2026-09-29", "en").hits[1].ask_for);
ok(C.view(doc, "2026-10-01").hits[0].days_ago === 2, "a 2-day-old doc does not recount days ago from the storm day");
ok(C.view(doc, "2026-10-03") === null, "a doc older than 3 days still shows");
ok(C.view(null, "2026-09-29") === null && C.view({ date: "2026-09-29" }, "2026-09-29").hits.length === 0, "empty docs mishandled");

// ---- practice doc: made-up homes and businesses on the practice streets ----
const pd = C.practiceDoc(H, "2026-09-28");
v = C.view(pd, "2026-09-28");
ok(pd && pd.practice && v && v.practice, "practice doc not marked practice");
ok(v && v.hits.length === 2 && v.calls.length === 2, "practice: expected 2 hits + 2 calls");
if (v) {
  const addrs = new Set(Object.values(H.walks).flatMap(w => w.stops.map(s => s.address)));
  ok(v.hits.every(h => addrs.has(h.address) && h.phone === "" && h.days_ago === 107 && h.hail_in >= 1), "practice hits are not practice houses (no phone, Jun 13 = 107 days)");
  ok(v.calls.every(c => c.hail_in >= 1), "practice business calls under 1\" hail (hh.py calltoday calls 1\"+ only)");
  ok(v.calls.every(c => /^402-555-01\d\d$/.test(c.phone) && /^Practice: /.test(c.name)), "practice businesses are not clearly made up (402-555-01xx, 'Practice:')");
  const words = JSON.stringify(pd);
  ok(!BANNED.test(words), "practice doc has banned/insurance words: " + (words.match(BANNED) || [])[0]);
}
ok(C.practiceDoc(null, "2026-09-28") === null, "no houses -> no practice doc");

// ---- the strings: EN + ES, same keys, no insurance talk ----
const en = C.t("en"), es = C.t("es");
ok(Object.keys(en).join() === Object.keys(es).join(), "EN/ES string keys differ");
ok(en.hitLbl === "Storm hit your customer" && es.hitLbl === "Tormenta sobre su cliente", "the account-hit label changed");
for (const [lg, T] of [["en", en], ["es", es]]) for (const [k, s] of Object.entries(T)) {
  const txt = typeof s === "function" ? s(3) : s;
  ok(!BANNED.test(txt), `${lg}.${k} has banned/insurance words: ${txt}`);
}

for (const f of fails) console.error("FAIL " + f);
console.log(fails.length ? `calls check: ${fails.length} of ${n} failed` : `calls check OK: ${n} checks (calendar days, storm age, calls/today view, practice doc, EN/ES + legal words)`);
process.exit(fails.length ? 1 : 0);
