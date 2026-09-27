/* HMP App Practice mode (T201), published as v25/practice.js (T169 module file).
 * FilthE, 2026-09-27: a clear on/off switch (More + a visible "Practice" badge) where door taps, leads and notes save
 * nowhere, so testing the app never pollutes real data.
 *
 * How it works: while Practice is on, the page's one write path (save() in pages/hmp-app.html) hands every write to
 * HMPPractice.put() instead of the database or the outbox. The writes live in this phone's memory only (never the db,
 * never localStorage), and the page layers them over the live data exactly like its outbox, so a practice tap shows on
 * screen the way a real one would. Turning Practice off (or reloading the page) throws them all away.
 * Photos taken in Practice are shown from this phone's memory and never uploaded (HMPPractice.photoId marks them).
 * Only the on/off choice is remembered on this phone (localStorage "hmp-app-practice"), so a reload stays in Practice
 * until he turns it off.
 *
 *   HMPPractice.isOn()            -> boolean
 *   HMPPractice.set(on)           -> the number of practice writes thrown away (turning off clears them)
 *   HMPPractice.put(o)            -> keeps one write {op: set|update|delete|stat|king, path, body}; stat/king are dropped
 *   HMPPractice.ops()             -> the kept writes, oldest first (the page's overlay reads these after its outbox)
 *   HMPPractice.count()           -> how many docs Practice has touched
 *   HMPPractice.photoId()         -> an id for a practice photo ("practice-...": never an uploaded asset)
 *   HMPPractice.isPhoto(id)       -> true for those ids
 *   HMPPractice.t(lang)           -> the strings, "en" or "es"
 *   HMPPractice.paint(bar, lang)  -> draws the Practice bar (hidden when off) and the body class "practice-on"
 * No dependencies; one closure; sets window.HMPPractice only.
 */
(function (root) {
  "use strict";
  var KEY = "hmp-app-practice";
  var TX = {
    en: {
      row: ["Practice mode", "Try the app: taps, leads and notes save nowhere"],
      rowOn: ["Practice mode is on", "Nothing you tap is saved. Tap to go back to real saves"],
      badge: "Practice",
      bar: "Nothing saves",
      off: "Turn off",
      onToast: "Practice on. Nothing you tap is saved.",
      offToast: function (n) { return n ? "Practice off. " + n + " practice " + (n === 1 ? "save" : "saves") + " thrown away." : "Practice off. Taps save for real again."; },
      photo: function (n) { return n + " practice " + (n === 1 ? "photo" : "photos") + " on screen only, not uploaded."; }
    },
    es: {
      row: ["Modo práctica", "Prueba la app: toques, clientes y notas no se guardan"],
      rowOn: ["Modo práctica activado", "Nada de lo que toques se guarda. Toca para volver a guardar de verdad"],
      badge: "Práctica",
      bar: "No se guarda nada",
      off: "Apagar",
      onToast: "Práctica activada. Nada de lo que toques se guarda.",
      offToast: function (n) { return n ? "Práctica apagada. Se borraron " + n + (n === 1 ? " cosa de práctica." : " cosas de práctica.") : "Práctica apagada. Los toques se guardan de verdad otra vez."; },
      photo: function (n) { return n + (n === 1 ? " foto de práctica" : " fotos de práctica") + " solo en pantalla, sin subir."; }
    }
  };
  var on = false, box = [], seq = 0;
  try { on = root.localStorage && root.localStorage.getItem(KEY) === "1"; } catch (e) { on = false; }

  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function isDoc(o) { return o && typeof o.path === "string" && (o.op === "set" || o.op === "update" || o.op === "delete"); }

  // the same merge rules as the page's outbox (enqueue): the newest full write of a doc wins; an update folds into
  // the write already kept for that doc
  function put(o) {
    if (!isDoc(o)) return;   // week-count math ("stat") and queued Right Hand messages ("king") have no practice copy
    if (o.op === "set" || o.op === "delete") box = box.filter(function (x) { return x.path !== o.path; });
    else {
      for (var i = 0; i < box.length; i++) {
        var p = box[i];
        if (p.path === o.path && p.op !== "delete") { p.body = Object.assign({}, p.body, clone(o.body)); return; }
      }
    }
    box.push({op: o.op, path: o.path, body: clone(o.body)});
  }
  function set(v) {
    on = !!v;
    try { if (root.localStorage) root.localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) { /* this load only */ }
    var n = 0;
    if (!on) { n = box.length; box = []; }
    return n;
  }
  function t(lang) { return TX[lang === "es" ? "es" : "en"]; }
  function paint(bar, lang) {
    var L = t(lang), doc = root.document;
    if (doc && doc.body) doc.body.classList.toggle("practice-on", on);
    if (!bar) return;
    bar.hidden = !on;
    if (!on) return;
    var html = '<span class="pr-tag">' + esc(L.badge) + '</span><span class="pr-msg">' + esc(L.bar) + '</span>' +
      '<button type="button" class="pr-off" data-practice="0">' + esc(L.off) + '</button>';
    if (bar.__h !== html) { bar.innerHTML = html; bar.__h = html; }
    bar.setAttribute("lang", lang === "es" ? "es" : "en");
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]; }); }

  root.HMPPractice = {
    isOn: function () { return on; },
    set: set,
    put: put,
    ops: function () { return box.slice(); },
    count: function () { return box.length; },
    photoId: function () { seq += 1; return "practice-" + Date.now().toString(36) + "-" + seq; },
    isPhoto: function (id) { return typeof id === "string" && id.indexOf("practice-") === 0; },
    t: t,
    paint: paint,
    STR: TX
  };
})(typeof window !== "undefined" ? window : this);
