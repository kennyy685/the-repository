/* HMP App calls + account alerts (published as v25/calls.js, a T169 module file).
 * Research round 54/59 + the 24-hour test: the King writes `calls/today` each morning (hh.py calltoday / daily:
 * {date, accounts_hit[], calls[], ...}); the app shows it on Now: "Storm hit your customer" rows first (address, hail
 * size, days ago; never a homeowner's name or phone), then today's business calls (business lines only).
 * Practice mode with the practice houses gets a made-up doc of the same shape (practiceDoc), never saved.
 *
 *   HMPCalls.view(doc, today, lang)  -> {hits[], calls[], date} or null (no doc, or older than MAX_AGE days); ask_for
 *                                       prefers the doc's ask_for_es when lang is "es" (else the EN ask_for)
 *   HMPCalls.practiceDoc(H, today)   -> a calls/today-shaped doc from the practice houses (made-up homes + businesses)
 *   HMPCalls.daysBetween(a, b)       -> whole calendar days from YYYY-MM-DD a to b
 *   HMPCalls.chiDay(ms)              -> the calendar day (YYYY-MM-DD) of a moment in America/Chicago
 *   HMPCalls.stormAge(day, today)    -> days since the storm when 60+ (STORM_FLAG_DAYS), else null (round 59: a quiet
 *                                       "check your policy's time limit", never a countdown or a carrier's deadline)
 *   HMPCalls.t(lang)                 -> the strings, "en" or "es"
 * No dependencies; sets window.HMPCalls only.
 */
(function (root) {
  "use strict";
  var MAX_AGE = 3, STORM_FLAG_DAYS = 60, DAY_MS = 864e5;
  function pl(n, a, b) { return n === 1 ? a : b; }
  var TX = {
    en: {
      h: "Calls today", hitLbl: "Storm hit your customer", hail: function (x) { return x + " hail"; },
      wind: function (x) { return x ? x + " mph wind" : "wind damage"; },
      ago: function (n) { return n === 0 ? "today" : n === 1 ? "yesterday" : n + " days ago"; },
      callLbl: "Business call", askFor: function (x) { return "ask for " + x; }, callAria: function (x) { return "Call " + x; },
      rules: "Business lines only. Offer the free inspection and nothing else.",
      say: "Say", why: "Why", phone: "Business line", also: "Also hit", hint: "Hail report", openLead: "Open the lead", openClaim: "Open the claim",
      practice: "Practice: made-up homes and businesses",
      stormAge: function (n) { return "Storm is " + n + " days old: check your policy's time limit"; }
    },
    es: {
      h: "Llamadas de hoy", hitLbl: "Tormenta sobre su cliente", hail: function (x) { return "granizo de " + x; },
      wind: function (x) { return x ? "viento de " + x + " mph" : "daños por viento"; },
      ago: function (n) { return n === 0 ? "hoy" : n === 1 ? "ayer" : "hace " + n + " " + pl(n, "día", "días"); },
      callLbl: "Llamada de negocio", askFor: function (x) { return "pregunte por " + x; }, callAria: function (x) { return "Llamar a " + x; },
      rules: "Solo líneas de negocio. Ofrezca la inspección gratis y nada más.",
      say: "Diga", why: "Por qué", phone: "Línea de negocio", also: "También afectados", hint: "Reporte de granizo", openLead: "Abrir el prospecto", openClaim: "Abrir el reclamo",
      practice: "Práctica: casas y negocios inventados",
      stormAge: function (n) { return "La tormenta tiene " + n + " días: revise el límite de tiempo de su póliza"; }
    }
  };
  var isDay = function (d) { return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.slice(0, 10)); };
  function daysBetween(a, b) {
    if (!isDay(a) || !isDay(b)) return null;
    var x = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10)), y = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
    return Math.round((y - x) / DAY_MS);
  }
  var CHI = null;
  function chiDay(ms) {
    if (!isFinite(ms)) return null;
    try {
      CHI = CHI || new Intl.DateTimeFormat("en-CA", {timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit"});
      var p = {}; CHI.formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
      return p.year + "-" + p.month + "-" + p.day;
    } catch (e) { var d = new Date(ms); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  }
  function num(v) { var n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? +v : NaN; return isFinite(n) ? n : null; }
  function str(v) { return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : ""; }
  function obj(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : null; }
  function digits(p) { return str(p).replace(/\D/g, ""); }
  function ago(day, today, fallback) { var n = daysBetween(str(day).slice(0, 10), today); return n != null && n >= 0 ? n : num(fallback); }
  function askFor(o, lang) { return lang === "es" && str(o.ask_for_es) ? str(o.ask_for_es) : str(o.ask_for); }   // Spanish twin (ask_for_es), else the EN text

  function view(doc, today, lang) {
    doc = obj(doc); if (!doc) return null;
    var age = daysBetween(str(doc.date).slice(0, 10), today);
    if (age == null || age < 0 || age > MAX_AGE) return null;
    var hits = [], calls = [], hitLines = {};
    (Array.isArray(doc.accounts_hit) ? doc.accounts_hit : []).forEach(function (a) {
      a = obj(a); if (!a || !str(a.address)) return;
      var biz = a.kind === "commercial", day = str(a.day || a.event_date).slice(0, 10);
      var h = {kind: str(a.kind) || "lead", key: str(a.key), address: str(a.address), city: str(a.city), peril: a.peril === "wind" ? "wind" : "hail",
        hail_in: num(a.hail_in != null ? a.hail_in : a.max_hail_in), wind_mph: num(a.max_wind_mph), day: day, days_ago: ago(day, today, a.days_ago),
        why: obj(a.why), opener: obj(a.opener), hint: obj(a.hail_report_hint), also: Array.isArray(a.also) ? a.also.filter(obj) : [],
        // homes: never a person's name or phone here (the lead record has its own); businesses: their business line
        name: biz ? str(a.name) || str(a.address) : str(a.address), phone: biz ? str(a.phone) : "", ask_for: biz ? askFor(a, lang) : "", biz: biz};
      if (h.phone) hitLines[digits(h.phone)] = 1;
      hits.push(h);
    });
    (Array.isArray(doc.calls) ? doc.calls : []).forEach(function (c) {
      c = obj(c); if (!c) return;
      var ph = str(c.phone); if (digits(ph).length < 10 || hitLines[digits(ph)]) return;   // business line only; an account hit already shows it
      var day = str(c.day).slice(0, 10);
      calls.push({kind: str(c.kind) || "building", key: str(c.key), name: str(c.name) || str(c.address), phone: ph, ask_for: askFor(c, lang),
        address: str(c.address), city: str(c.city), hail_in: num(c.hail_in), day: day, days_ago: day ? ago(day, today, c.days_ago) : null,
        why: obj(c.why), opener: obj(c.opener), also: Array.isArray(c.also) ? c.also.filter(obj) : []});
    });
    return {date: str(doc.date).slice(0, 10), hits: hits, calls: calls, practice: !!doc.practice};
  }

  function street(a) { return str(a).replace(/^\d+[A-Za-z]?\s+/, ""); }
  function shortDay(d, lang) {
    var m = +d.slice(5, 7), n = +d.slice(8, 10);
    var en = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], es = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sep.", "oct.", "nov.", "dic."];
    return lang === "es" ? n + " de " + es[m - 1] : en[m - 1] + " " + n;
  }
  // Practice mode: the practice houses' real Jun 13 storm over two made-up customers' homes and two made-up businesses
  // (402-555-01xx numbers are reserved fictional numbers). Never saved, never the database.
  function practiceDoc(H, today) {
    H = obj(H); if (!H || !obj(H.walks)) return null;
    var walks = Object.keys(H.walks).map(function (k) { return H.walks[k]; }).filter(function (w) { return w && Array.isArray(w.stops) && w.stops.length; });
    if (!walks.length) return null;
    var storm = obj(H.storm) || {}, day = str(storm.day) || today, ev = obj(H.evidence) || {};
    var slug = function (s) { return (str(s.address) + " " + str(s.city || "Fremont")).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); };
    var hailAt = function (s) { var e = ev[slug(s)]; return e && num(e.hail_in) != null ? num(e.hail_in) : 1.0; };
    var n = daysBetween(day, today); n = n == null ? 0 : Math.max(0, n);
    var hit = function (s, kind) {
      var h = hailAt(s);
      return {key: (kind === "claim" ? "claims/" : "leads/") + "practice-" + slug(s), kind: kind, address: s.address, city: s.city || "Fremont", peril: "hail",
        max_hail_in: h, hail_in: h, event_date: day, day: day, days_ago: n, match: "at", name: s.address, phone: "", ask_for: "", also: [],
        why: {en: (kind === "claim" ? "Your customer" : "Your lead") + ": " + h.toFixed(2) + "\" hail at the address on " + shortDay(day, "en") + ".",
              es: (kind === "claim" ? "Su cliente" : "Su prospecto") + ": granizo de " + h.toFixed(2) + "\" en la dirección el " + shortDay(day, "es") + "."},
        opener: {en: "Hi, this is HMP Siding & Roofing: hail hit your area on " + shortDay(day, "en") + ". Can I come by this week for a free inspection?",
                 es: "Hola, le llamamos de HMP Siding & Roofing: el " + shortDay(day, "es") + " cayó granizo en su zona. ¿Puedo pasar esta semana a hacerle una inspección gratis?"},
        hail_report_hint: {en: "Hail report ready for " + s.address + ".", es: "Reporte de granizo listo para " + s.address + "."}};
    };
    var biz = function (s, i) {
      var h = hailAt(s), nm = "Practice: apartments on " + street(s.address);
      return {kind: "building", rank: i + 1, name: nm, phone: "402-555-01" + (42 + i * 17), ask_for: i ? "Property manager" : "Leasing office",
        address: s.address, city: s.city || "Fremont", hail_in: h, day: day, days_ago: n, also: [], key: "practice|" + slug(s),
        why: {en: h.toFixed(2) + "\" hail at the building on " + shortDay(day, "en") + " (" + TX.en.ago(n) + "). Made-up practice business.",
              es: "Granizo de " + h.toFixed(2) + "\" en el edificio el " + shortDay(day, "es") + " (" + TX.es.ago(n) + "). Negocio inventado de práctica."},
        opener: {en: "Hi, this is HMP Siding & Roofing: we're offering a free inspection for " + nm.replace(/^Practice: /, "the ") + " after the " + shortDay(day, "en") + " hail. Who handles the building's exterior?",
                 es: "Hola, le llamamos de HMP Siding & Roofing: ofrecemos una inspección gratis para los apartamentos en " + street(s.address) + " después del granizo del " + shortDay(day, "es") + ". ¿Quién ve el exterior del edificio?"}};
    };
    var w = function (i) { return walks[Math.min(i, walks.length - 1)].stops; };
    var strong = function (i, k) { var st = w(i).filter(function (s) { return hailAt(s) >= 1; }); st = st.length ? st : w(i); return st[Math.min(k, st.length - 1)]; };   // business calls: 1"+ hail only, like hh.py calltoday
    var hits = [hit(w(0)[Math.min(4, w(0).length - 1)], "lead"), hit(w(1)[Math.min(9, w(1).length - 1)], "claim")];
    hits.forEach(function (h, i) { h.rank = i + 1; });
    return {date: today, practice: true, accounts_title: {en: "Your accounts hit", es: "Sus cuentas afectadas"}, accounts_count: hits.length, accounts_checked: hits.length,
      accounts_hit: hits, calls: [biz(strong(2, 8), 0), biz(strong(0, 12), 1)], count: 2};
  }
  function stormAge(day, today) {
    var n = daysBetween(str(day).slice(0, 10), today);
    return n != null && n >= STORM_FLAG_DAYS ? n : null;
  }
  root.HMPCalls = {view: view, practiceDoc: practiceDoc, daysBetween: daysBetween, chiDay: chiDay, stormAge: stormAge, STORM_FLAG_DAYS: STORM_FLAG_DAYS, MAX_AGE: MAX_AGE,
    t: function (lang) { return TX[lang === "es" ? "es" : "en"]; }, STR: TX};
})(typeof window !== "undefined" ? window : this);
