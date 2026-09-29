/* HMP App follow-up schedule: a JavaScript copy of `hh.py followups` (hailhunter/followups.py).
 *
 * Rules come from the doc made by
 *   python3 hh.py followups --export-rules --out followups_rules.json
 * and followups(leads, today, rules) returns exactly what the Python returns:
 *   {as_of, today[], tomorrow[], later[], counts{today, tomorrow, later, overdue}, summary{en, es}},
 *   item = {id, address, city, stage, kind: "touch"|"next_step", touch, due, overdue, days_late, reason{en, es}}.
 * leads = array of lead docs, each with `id` (the app's leads/<slug> docs). today = "YYYY-MM-DD" (local day).
 * Touches at rules.touch_days (2, 5, 10) after the first Interested; one line per lead (next step or next touch,
 * whichever is due first). selfCheck(rules) runs rules.test_cases (real Python results) and returns the failures.
 * Logistics only: no insurance promises, nothing about the deductible (44-8604). No dependencies.
 */
(function () {   // one closure: the helpers below (num, pyRound, canon, selfCheck...) stay private, so the app
                 // can load estimate.js, takeoff.js and followups.js side by side without name clashes
"use strict";
var FOLLOWUPS_VERSION = 1;
var MON_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
var MON_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
var YES = ["interested", "booked"];
var NOT_HOME = ["not_home", "nothome", "not home", "not-home", "no_home", "no esta", "no está"];

function str(v) { return v === null || v === undefined ? "" : String(v); }

var CHICAGO_FMT = (typeof Intl !== "undefined") ? new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit"
}) : null;

function chicagoDay(d) {                        // a real Date -> its America/Chicago LOCAL calendar date (handles DST)
  var parts = CHICAGO_FMT.formatToParts(d), map = {};
  parts.forEach(function (p) { map[p.type] = p.value; });
  return map.year + "-" + map.month + "-" + map.day;
}

function day(v) {
  // Plain "YYYY-MM-DD" stays as-is. A full timestamp ("...T21:00:00Z") converts to its America/Chicago local
  // calendar date, so a contact after ~7 PM Central doesn't roll to the next day just because it's already
  // tomorrow in UTC. Anything unparseable falls back to the first 10 characters, then null.
  var s = str(v), s10 = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s10)) return null;
  if (s.length <= 10 || !/^[T ]/.test(s.slice(10))) {
    var d0 = new Date(s10 + "T00:00:00Z");
    if (isNaN(d0) || d0.toISOString().slice(0, 10) !== s10) return null;
    return s10;
  }
  var iso = s.replace(" ", "T");
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(iso)) iso += "Z";   // timestamps in this app are stored in UTC
  var d = new Date(iso);
  if (isNaN(d)) return null;
  return CHICAGO_FMT ? chicagoDay(d) : s10;
}

function addDays(d, n) {
  var x = new Date(d + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

function diff(a, b) { return Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000); }
function en(d) { return MON_EN[+d.slice(5, 7) - 1] + " " + (+d.slice(8, 10)); }
function es(d) { return (+d.slice(8, 10)) + " de " + MON_ES[+d.slice(5, 7) - 1]; }
function daysEn(n) { return n + " day" + (n === 1 ? "" : "s"); }
function daysEs(n) { return n + " día" + (n === 1 ? "" : "s"); }
function low(v) { return str(v).trim().toLowerCase(); }
function isObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
function visits(L) { return Array.isArray(L.doors_visits) ? L.doors_visits : []; }
function has(arr, v) { return (arr || []).indexOf(v) >= 0; }

function firstInterested(L, rules) {
  var days = [day(L.interested_at)];
  visits(L).forEach(function (v) {
    if (isObj(v) && has(YES, low(v.result))) days.push(day(v.date) || day(v.at));
  });
  days = days.filter(Boolean).sort();
  if (days.length) return days[0];
  if (has(rules.created_stages, L.stage)) return day(L.created_at);
  return null;
}

function contacts(L) {
  var out = [day(L.last_contact)];
  visits(L).forEach(function (v) {
    if (isObj(v) && v.result && !has(NOT_HOME, low(v.result))) out.push(day(v.date) || day(v.at));
  });
  return out.filter(Boolean);
}

function pickTouch(L, start, today, rules, stopAt) {
  var seen = contacts(L), pending = [];
  for (var i = 0; i < rules.touch_days.length; i++) {
    var due = addDays(start, rules.touch_days[i]);
    if (stopAt && due >= stopAt) break;
    var early = addDays(due, -rules.early_ok_days);
    if (seen.some(function (c) { return c > start && c >= early; })) continue;
    pending.push([i + 1, due]);
  }
  var late = pending.filter(function (p) { return p[1] <= today; });
  if (late.length) return late[late.length - 1];
  return pending.length ? pending[0] : null;
}

function withLate(daysLate, e, s) {
  if (daysLate <= 0) return [e, s];
  return [daysEn(daysLate) + " late. " + e, daysEs(daysLate) + " de atraso. " + s];
}

function touchReason(L, k, due, start, today, rules) {
  var n = rules.touch_days[k - 1], last = k === rules.touch_days.length;
  var ago = diff(today, start);
  var agoEn = ago === 0 ? "today" : daysEn(ago) + " ago";
  var agoEs = ago === 0 ? "hoy" : "hace " + daysEs(ago);
  var e, s;
  if (has(rules.booked_stages, L.stage)) {
    e = "Booked on " + en(start) + " (" + agoEn + "). " + n + "-day check-in: make sure the visit is still on.";
    s = "Agendado el " + es(start) + " (" + agoEs + "). Seguimiento de " + n + " días: confirma que la cita sigue en pie.";
  } else {
    var cash = L.type === "cash" || L.source === "everyday";
    e = "Interested on " + en(start) + " (" + agoEn + "). " + n + "-day follow-up: stop by, or call if they gave you their " +
        "number, to set a time for " + (cash ? "a free estimate" : "a roof check") + ".";
    s = "Interesado el " + es(start) + " (" + agoEs + "). Seguimiento de " + n + " días: pasa, o llama si te dio su número, " +
        "para agendar " + (cash ? "un estimado gratis" : "una revisión del techo") + ".";
  }
  if (last) {
    e += " Last planned touch: if it's still not a yes, mark the lead Lost.";
    s += " Último seguimiento planeado: si todavía no es un sí, marca el cliente como Perdido.";
  }
  return withLate(diff(today, due), e, s);
}

function stepReason(ns, due, today) {
  var e = str(ns.en || "Next step").trim();
  var s = str(ns.es || ns.en || "Siguiente paso").trim();
  var late = diff(today, due);
  if (late > 0) return [e + " (due " + en(due) + ", " + daysEn(late) + " late)",
                        s + " (vencía el " + es(due) + ", " + daysEs(late) + " de atraso)"];
  return [e + " (due " + en(due) + ")", s + " (vence el " + es(due) + ")"];
}

function followups(leads, today, rules) {
  today = day(today);
  if (!today) throw new Error("followups: today must be YYYY-MM-DD");
  var tomorrow = addDays(today, 1);
  var groups = {today: [], tomorrow: [], later: []};
  (leads || []).forEach(function (L) {
    if (!isObj(L) || has(rules.closed, L.stage)) return;
    var ns = isObj(L.next_step) ? L.next_step : {};
    var stepDue = day(ns.due);
    var cand = [];
    if (stepDue) cand.push(["next_step", null, stepDue]);
    var start = (has(rules.touch_stages, L.stage) || !L.stage) ? firstInterested(L, rules) : null;
    if (start) {
      var stopAt = has(rules.booked_stages, L.stage) ? stepDue : null;
      var t = stopAt && stopAt <= today ? null : pickTouch(L, start, today, rules, stopAt);
      if (t) cand.push(["touch", t[0], t[1]]);
    }
    if (!cand.length) return;
    cand.sort(function (a, b) {
      if (a[2] !== b[2]) return a[2] < b[2] ? -1 : 1;
      return (a[0] === "next_step" ? 0 : 1) - (b[0] === "next_step" ? 0 : 1);
    });
    var c = cand[0], kind = c[0], k = c[1], due = c[2];
    var r = kind === "touch" ? touchReason(L, k, due, start, today, rules) : stepReason(ns, due, today);
    var late = Math.max(diff(today, due), 0);
    var item = {id: L.id || "", address: L.address || L.id || "", city: L.city || "",
                stage: L.stage === undefined ? null : L.stage, kind: kind, touch: k, due: due, overdue: late > 0,
                days_late: late, reason: {en: r[0], es: r[1]}};
    groups[due <= today ? "today" : (due === tomorrow ? "tomorrow" : "later")].push(item);
  });
  function cmp(a, b) { return a < b ? -1 : (a > b ? 1 : 0); }
  Object.keys(groups).forEach(function (g) {
    groups[g].sort(function (a, b) { return cmp(a.due, b.due) || cmp(a.address, b.address) || cmp(a.id, b.id); });
  });
  var over = groups.today.filter(function (r) { return r.overdue; }).length;
  var nt = groups.today.length, nm = groups.tomorrow.length;
  var e = nt + " follow-up" + (nt === 1 ? "" : "s") + " today" + (over ? " (" + over + " late)" : "") + ", " + nm + " tomorrow.";
  var s = nt + " seguimiento" + (nt === 1 ? "" : "s") + " hoy" +
          (over ? " (" + over + " atrasado" + (over === 1 ? "" : "s") + ")" : "") + ", " + nm + " mañana.";
  return {as_of: today, today: groups.today, tomorrow: groups.tomorrow, later: groups.later,
          counts: {today: nt, tomorrow: nm, later: groups.later.length, overdue: over}, summary: {en: e, es: s}};
}

function canon(v) {                             // key-order-free JSON for comparing with the Python result
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (isObj(v)) return "{" + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ":" + canon(v[k]); }).join(",") + "}";
  return JSON.stringify(v === undefined ? null : v);
}

function selfCheck(rules) {
  var fails = [];
  if (rules.version !== FOLLOWUPS_VERSION) fails.push("version: rules v" + rules.version + ", page v" + FOLLOWUPS_VERSION);
  (rules.test_cases || []).forEach(function (t) {
    var got;
    try { got = followups(t.leads, t.today, rules); } catch (e) { fails.push(t.name + ": threw " + e.message); return; }
    if (canon(got) !== canon(t.result)) fails.push(t.name + ": got " + canon(got) + " want " + canon(t.result));
  });
  return fails;
}

var api = {followups: followups, selfCheck: selfCheck, FOLLOWUPS_VERSION: FOLLOWUPS_VERSION};
if (typeof module !== "undefined" && module.exports) module.exports = api;   // node: tests/js/followups_check.js
if (typeof window !== "undefined") window.HMPFollowups = api;   // the HMP App: <script src="app/followups.js">
})();
