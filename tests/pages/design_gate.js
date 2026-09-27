#!/usr/bin/env node
/* T72 design gate (docs/release-checklist.md, step 2): renders each app page headless with the fixture data behind a
 * mocked window.claude, and fails the run on the design bugs that have already shipped once (v24's blank buttons, a
 * bar covering a button, the same menu twice). Nothing that obvious should reach FilthE's phone again.
 *
 *   node tests/pages/design_gate.js                  every page below, 360x800 + 420x900, light + dark, EN (+ ES)
 *   node tests/pages/design_gate.js --quick          360x800, light + dark, EN only (fast check while building)
 *   node tests/pages/design_gate.js --page hmp-app   only pages whose path contains "hmp-app" (repeatable)
 *   node tests/pages/design_gate.js --shots          also save a screenshot of every view, not just failing ones
 *   node tests/pages/design_gate.js --self-test      prove every check fires on a page built to break them all
 *   narrower runs: --size 360|420, --theme light,dark,data-theme=dark,data-theme=light, --lang en|es, --verbose
 *
 * What fails the gate (every rule is checked on every view: each tab, plus the sheets listed in PAGES):
 *   contrast       text under WCAG AA: 4.5:1, or 3:1 for large text (24px+, or 18.66px+ bold); an icon-only
 *                  button's icon under 3:1. Measured against the real pixels behind the text (a screenshot taken with
 *                  all text hidden), so cards, gradients, maps and translucent bars count as they actually paint.
 *   empty-control  a button/link/tab with no visible label or icon (an aria-label alone is invisible on screen), or a
 *                  label that is there but can't be seen (under 1.5:1: v24's white-on-white buttons).
 *   tap-target     a button, link or field smaller than 44x44 px (a link inside a sentence is exempt; a checkbox
 *                  counts its whole <label>).
 *   overlap        two controls on top of each other, or a control that stays covered (e.g. by the tab bar) at every
 *                  scroll position. Content that only passes under a fixed bar while scrolling is fine.
 *   duplicate      the same label AND the same action twice on one screen (a "Call" on every lead card is not a
 *                  duplicate: each card's button acts on a different lead).
 *   js-error       the page threw while rendering: every other check would be grading a broken page.
 * Not checked here: sideways scroll (tests/pages/shots.js, same checklist step), font sizes, cut-off headings and
 * broken images (the harness is offline, so no remote image ever loads). Those were in the first draft of this gate.
 *
 * Themes: light and dark through prefers-color-scheme (how a phone picks), plus the data-theme attribute forcing each
 * one against the system setting (the ":root:not([data-theme=light])" / "[data-theme=dark]" guards the pages use).
 * Dates are frozen to 2026-09-27 3 PM Central to match the fixture, and every request off this machine is blocked
 * (fonts, map tiles), so two runs on the same pages give the same answer.
 *
 * Exit 0 = every page clean. Exit 1 = design problems (report below + tests/pages/out/design_gate/report.txt, with a
 * screenshot of each failing view, problems outlined in red). Exit 2 = the gate itself could not run.
 * Needs Playwright's Chromium (like tests/pages/shots.js); unlike shots.js there is no screenshot-only fallback,
 * because every check measures the live page.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const OUT_DIR = path.join(__dirname, "out", "design_gate");
const FIXTURE_PATH = path.join(__dirname, "design_gate_fixture.json");
const FIXED_NOW_ISO = "2026-09-27T15:00:00-05:00";
const TIMEZONE = "America/Chicago";

// The pages the release checklist ships. `tabs` = the page's own tab buttons (each one is a view); `views` = extra
// screens reached by tapping through `steps` (CSS selectors, first visible match) from a fresh load.
// `storage` = what the page reads from localStorage to pick its language.
const PAGES = [
  {
    rel: "pages/hmp-app.html",
    storage: { en: { "hmp-app-lang": "en" }, es: { "hmp-app-lang": "es" } },
    tabs: '#tabs [role="tab"]',
    views: [
      { name: "add sheet", steps: ["#plusBtn"] },
      { name: "lead sheet", steps: ["#tb-leads", "#tab-leads .a-card"] },
    ],
  },
  {
    rel: "pages/crew-hq.html",
    storage: { en: { "hmp-app-lang": "en" }, es: { "hmp-app-lang": "es" } },
    tabs: null,
    views: [],
  },
  {
    rel: "pages/practice-door.html",
    storage: { en: { "hmp-practice-door-v1": '{"lang":"en"}' }, es: { "hmp-practice-door-v1": '{"lang":"es"}' } },
    tabs: null,
    views: [{ name: "cheat sheet", steps: ["#cheatBtn1"] }],
  },
];

const SIZES = [{ width: 360, height: 800 }, { width: 420, height: 900 }];
const THEMES = [
  { id: "light", scheme: "light", attr: null },
  { id: "dark", scheme: "dark", attr: null },
  { id: "data-theme=dark", scheme: "light", attr: "dark" },
  { id: "data-theme=light", scheme: "dark", attr: "light" },
];
// Spanish labels run longer (overlaps, cramped buttons); colors don't change with language, so ES skips the two
// data-theme variants.
const LANG_THEMES = { en: THEMES.map((t) => t.id), es: ["light", "dark"] };

const MAX_SHOTS = 80;   // one screenshot per distinct problem, up to this many per run

/* ================= runs inside the page: must be self-contained (it is injected as source text) ================= */
function pageLib() {
  if (window.__dg) return;
  const MIN_TAP = 44;
  const BLANK = 1.5;   // below this a label is effectively invisible
  const BUTTONISH = 'button, a[href], summary, input[type="button"], input[type="submit"], input[type="reset"], input[type="image"], [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"], [role="switch"]';
  const CONTROL = BUTTONISH + ', input:not([type="hidden"]), select, textarea, [role="checkbox"], [role="radio"], label';
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "TITLE", "DEFS", "SYMBOL", "CANVAS"]);
  const EMOJI_ONLY = /^[\p{Extended_Pictographic}\p{Emoji_Component}\uFE0F\u200D\s]+$/u;
  const WORDY = /[\p{L}\p{N}]/u;

  const S = { els: [], ids: new WeakMap(), root: document.body, ctrls: new Map(), runs: new Map(), pending: [],
    findings: [], scrollers: [], hidden: [], style: null };
  const idOf = (n) => { let i = S.ids.get(n); if (i == null) { i = S.els.length; S.els.push(n); S.ids.set(n, i); } return i; };
  const VW = () => document.documentElement.clientWidth;
  const VH = () => document.documentElement.clientHeight;

  /* ---- color ---- */
  const cv = document.createElement("canvas"); cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const colorCache = new Map();
  function rgba(str) {
    if (!str || str === "none" || /url\(/.test(str)) return null;
    if (colorCache.has(str)) return colorCache.get(str);
    const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(str);
    let c;
    if (m) c = { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : +m[4] };
    else {   // color(srgb ...), color-mix(), oklch(): let the browser paint one pixel and read it back
      cx.clearRect(0, 0, 1, 1); cx.fillStyle = "rgba(0,0,0,0)"; cx.fillStyle = str; cx.fillRect(0, 0, 1, 1);
      const d = cx.getImageData(0, 0, 1, 1).data; c = { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    }
    colorCache.set(str, c); return c;
  }
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) });
  const hex = (c) => "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

  /* ---- describing an element so a person can find it ---- */
  const STATE_CLASS = /^(on|off|active|sel|selected|open|current|flash|is-.*|has-.*)$/;
  function tagDesc(el) {
    if (el.id) return "#" + el.id;
    const cls = (el.getAttribute("class") || "").split(/\s+/).filter((c) => c && !STATE_CLASS.test(c)).slice(0, 2);
    return el.tagName.toLowerCase() + cls.map((c) => "." + c).join("");
  }
  function where(el) {
    const parts = [];
    for (let n = el, i = 0; n && n.nodeType === 1 && n !== document.body && i < 4; n = n.parentElement, i++) {
      parts.unshift(tagDesc(n));
      if (n.id) break;
    }
    return parts.join(" > ") || el.tagName.toLowerCase();
  }
  const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
  function label(el) {
    if (el.tagName === "INPUT" && /^(button|submit|reset)$/i.test(el.type)) return clean(el.value);
    return clean(el.innerText) || clean(el.getAttribute("aria-label")) || clean(el.getAttribute("title")) ||
      clean((el.querySelector("img[alt]") || {}).alt);
  }

  /* ---- visibility + geometry ---- */
  function opacity(el) {
    let o = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity) || 0;
    return o;
  }
  function inClosedDetails(el) {
    for (let d = el.parentElement && el.parentElement.closest("details:not([open])"); d; d = d.parentElement && d.parentElement.closest("details:not([open])")) {
      const s = d.querySelector(":scope > summary");
      if (!s || !s.contains(el)) return true;
    }
    return false;
  }
  function shown(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (getComputedStyle(el).visibility !== "visible") return false;
    if (el.closest("[inert]") || inClosedDetails(el)) return false;
    return opacity(el) >= 0.05;
  }
  const disabled = (el) => !!el.closest(':disabled, [aria-disabled="true"]');
  const NOTHING = { l: 0, t: 0, r: 0, b: 0 };
  // Where this element can paint: its overflow-clipping ancestors (and, for text, its own parent: `inclusive`), with
  // screen-reader-only boxes (clip: rect(0 0 0 0) / clip-path: inset(50%)) clipping to nothing. `onScreen` = right now,
  // in the viewport, scrolled where it is; otherwise only what clips it for good (hidden, not scrolled away).
  function clipOf(el, inclusive, onScreen) {
    let c = onScreen === false ? { l: -1e9, t: -1e9, r: 1e9, b: 1e9 } : { l: 0, t: 0, r: VW(), b: VH() };
    if (!inclusive && getComputedStyle(el).position === "fixed") return c;
    for (let n = inclusive ? el : el.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (/^rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)$/.test(cs.clip) || /inset\(50%\)/.test(cs.clipPath)) return NOTHING;
      const clips = onScreen === false ? /(hidden|clip)/.test(cs.overflowX + cs.overflowY) : cs.overflowX !== "visible" || cs.overflowY !== "visible";
      if (clips) {
        const b = n.getBoundingClientRect();
        c = { l: Math.max(c.l, b.left), t: Math.max(c.t, b.top), r: Math.min(c.r, b.right), b: Math.min(c.b, b.bottom) };
      }
      if (cs.position === "fixed") break;   // clipping above a fixed box doesn't reach it
    }
    return c;
  }
  function inter(a, c) {
    const l = Math.max(a.left, c.l), t = Math.max(a.top, c.t), r = Math.min(a.right, c.r), b = Math.min(a.bottom, c.b);
    return r - l >= 2 && b - t >= 2 ? { l, t, r, b } : null;
  }
  const box = (r) => ({ x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
  function hitOk(el, x, y, isText) {
    const hit = document.elementFromPoint(x, y);
    if (!hit) return { ok: false, hit: null };
    if (hit === el || el.contains(hit)) return { ok: true };
    if (isText && hit.contains(el)) return { ok: true };   // text with pointer-events:none still shows through
    if (el.labels && [...el.labels].some((l) => l === hit || l.contains(hit))) return { ok: true };
    return { ok: false, hit };
  }

  function clearOnTop(el, r, isText) {   // five points across the box, all reaching this element
    const my = (r.t + r.b) / 2, mx = (r.l + r.r) / 2, qy = (r.b - r.t) / 4;
    return [[r.l + 1, my], [mx, my], [r.r - 1, my], [mx, r.t + qy], [mx, r.b - qy]].every(([x, y]) => hitOk(el, x, y, isText).ok);
  }

  /* ---- which layer is on screen, what scrolls ---- */
  function activeRoot() {   // an open modal (any size: a short bottom sheet too) is the whole screen; the rest is inert
    const vw = VW(), vh = VH(), clamp = (v, hi) => Math.min(Math.max(v, 0), hi - 1);
    let best = null;
    for (const m of document.querySelectorAll('[aria-modal="true"], dialog')) {
      if ((m.tagName === "DIALOG" && !m.matches(":modal") && m.getAttribute("aria-modal") !== "true") || !shown(m)) continue;
      const r = m.getBoundingClientRect();
      const h = document.elementFromPoint(clamp(r.left + r.width / 2, vw), clamp(r.top + r.height / 2, vh));
      if (h && m.contains(h)) best = m;   // the one actually on top
    }
    if (best) return best;
    for (const m of document.querySelectorAll('[role="dialog"]')) {   // a non-modal dialog only counts when it fills the screen
      const r = m.getBoundingClientRect();
      if (shown(m) && r.width * r.height >= 0.6 * vw * vh) return m;
    }
    return document.body;
  }
  function scrollersIn(root) {
    const out = [];
    const se = document.scrollingElement || document.documentElement;
    if (root === document.body && se.scrollHeight > se.clientHeight + 4) out.push(se);
    for (const el of [root, ...root.querySelectorAll("*")]) {
      if (el === document.body) continue;
      const cs = getComputedStyle(el);
      if (!/(auto|scroll)/.test(cs.overflowY) || el.scrollHeight <= el.clientHeight + 4 || el.clientHeight < 120) continue;
      if (!shown(el)) continue;
      out.push(el);
      if (out.length >= 4) break;
    }
    return out;
  }

  /* ---- the controls on this view ---- */
  function isInlineLink(el) {
    if (el.tagName !== "A" || getComputedStyle(el).display !== "inline") return false;
    const p = el.parentElement;
    return !!p && clean(p.innerText).length > clean(el.innerText).length + 3;
  }
  function pseudoHitArea(el, r) {   // a positioned ::before/::after with negative insets widens the hit area
    if (getComputedStyle(el).position === "static") return r;
    let { left, top, right, bottom } = r;
    for (const p of ["::before", "::after"]) {
      const cs = getComputedStyle(el, p);
      if (cs.content === "none" || cs.content === "normal" || cs.position !== "absolute" || cs.pointerEvents === "none") continue;
      const px = (v) => (/px$/.test(v) ? parseFloat(v) : null);
      const L = px(cs.left), T = px(cs.top), R = px(cs.right), B = px(cs.bottom);
      if (L != null) left = Math.min(left, r.left + L);
      if (T != null) top = Math.min(top, r.top + T);
      if (R != null) right = Math.max(right, r.right - R);
      if (B != null) bottom = Math.max(bottom, r.bottom - B);
    }
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }
  function labelIsTarget(lab) {   // <label class="btn">Photo <input type=file hidden></label>: the label is the button
    const c = lab.control;
    if (!c) return false;
    const r = c.getBoundingClientRect();
    return r.width < 2 || r.height < 2 || getComputedStyle(c).display === "none" || opacity(c) < 0.05;
  }
  function textRuns(el) {
    const out = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let n; (n = w.nextNode());) {
      if (!/\S/.test(n.nodeValue) || EMOJI_ONLY.test(n.nodeValue)) continue;
      const p = n.parentElement;
      if (!p || SKIP_TAGS.has(p.tagName.toUpperCase()) || getComputedStyle(p).visibility !== "visible") continue;
      range.selectNodeContents(n);
      const clip = clipOf(p, true, false);
      if ([...range.getClientRects()].some((r) => inter(r, clip))) out.push(n);
    }
    return out;
  }
  function icons(el) {
    const out = [];
    for (const g of el.querySelectorAll("svg, img, canvas, video")) {
      if (g.parentElement && g.parentElement.closest("svg")) continue;
      const r = g.getBoundingClientRect();
      if (r.width < 6 || r.height < 6 || !shown(g)) continue;
      // an <img> counts by its box, loaded or not: this harness is offline, so photo thumbnails never load here
      if (g.tagName.toLowerCase() === "svg" && !paintOf(g)) continue;
      out.push(g);
    }
    for (const n of [el, ...el.querySelectorAll("*")]) {   // CSS-drawn icons: ::before/::after, background images
      if (n !== el && !shown(n)) continue;
      if (n !== el && /url\(/.test(getComputedStyle(n).backgroundImage)) { out.push(n); continue; }
      for (const p of ["::before", "::after"]) {
        const cs = getComputedStyle(n, p);
        if (cs.content === "none" || cs.content === "normal") continue;
        const txt = cs.content.replace(/^["']|["']$/g, "");
        const drawn = /url\(/.test(cs.backgroundImage) || ((parseFloat(cs.width) >= 6 && parseFloat(cs.height) >= 6) &&
          (((rgba(cs.backgroundColor) || {}).a || 0) > 0.1 || parseFloat(cs.borderTopWidth) >= 1.5));
        if (/\S/.test(txt) || drawn) { out.push(n); break; }
      }
    }
    if (/url\(/.test(getComputedStyle(el).backgroundImage)) out.push(el);
    return out;
  }
  function paintsBox(el) {
    const cs = getComputedStyle(el), bg = rgba(cs.backgroundColor), bc = rgba(cs.borderTopColor);
    return (bg && bg.a > 0.3) || (parseFloat(cs.borderTopWidth) >= 1 && bc && bc.a > 0.3);
  }
  function paintOf(svg) {   // the color an inline SVG icon paints with
    for (const s of svg.querySelectorAll("path, circle, rect, line, polyline, polygon, ellipse, use, text")) {
      const cs = getComputedStyle(s);
      if (cs.display === "none" || cs.visibility !== "visible") continue;
      const stroke = rgba(cs.stroke), fill = rgba(cs.fill);
      if (stroke && stroke.a > 0 && parseFloat(cs.strokeWidth) > 0) return Object.assign({}, stroke, { a: stroke.a * (parseFloat(cs.strokeOpacity) || 1) });
      if (fill && fill.a > 0) return Object.assign({}, fill, { a: fill.a * (parseFloat(cs.fillOpacity) || 1) });
    }
    return null;
  }
  // what a tap on this control does: data-* attributes, href, inline handlers, and listeners attached to the element
  // itself (recorded by the init script's addEventListener hook); delegated handlers are covered by the data-* attrs
  function actionKey(el) {
    if (el.tagName === "SUMMARY") return "summary:" + idOf(el.parentElement);
    const k = [el.tagName, el.getAttribute("role") || "", el.getAttribute("href") || "", el.getAttribute("onclick") || "",
      el.getAttribute("aria-controls") || "", el.getAttribute("name") || "", el.getAttribute("value") || "",
      el.getAttribute("type") === "submit" && el.form ? "form:" + idOf(el.form) : ""];
    for (const a of [...el.attributes].filter((a) => a.name.startsWith("data-")).sort((x, y) => (x.name < y.name ? -1 : 1))) k.push(a.name + "=" + a.value);
    if (typeof el.onclick === "function") k.push("onclick#" + (window.__dgFnId ? window.__dgFnId(el.onclick) : "?"));
    const ls = window.__dgListeners && window.__dgListeners.get(el);
    if (ls) for (const l of ls) if (/^(click|pointerup|pointerdown|touchend|mouseup|mousedown)$/.test(l.type)) k.push(l.type + "#" + l.fn);
    return k.join("|");
  }
  function layerOf(el) {   // controls only collide with controls that move with them
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.position === "fixed" || cs.position === "sticky") return n;
      if (n !== el && /(auto|scroll|hidden)/.test(cs.overflowY + cs.overflowX) && (n.scrollHeight > n.clientHeight + 1 || n.scrollWidth > n.clientWidth + 1)) return n;
    }
    return document.body;
  }

  function fail(rule, el, detail, extra) {
    S.findings.push(Object.assign({ rule, where: el ? where(el) : "(page)", label: el ? label(el).slice(0, 48) : "", detail, el: el ? idOf(el) : null }, extra || {}));
  }

  /* ---- the checks ---- */
  function domChecks() {
    const root = S.root;
    const all = [...(root.matches && root.matches(CONTROL) ? [root] : []), ...root.querySelectorAll(CONTROL)];
    for (const el of all) {
      if (el.tagName === "LABEL" && !labelIsTarget(el)) continue;
      if (!shown(el) || disabled(el)) continue;
      const c = { el, id: idOf(el), buttonish: el.matches(BUTTONISH) || el.tagName === "LABEL", clip: clipOf(el, false, false) };
      c.rect = el.getBoundingClientRect();
      c.vis = inter(c.rect, c.clip);
      c.pe = getComputedStyle(el).pointerEvents !== "none";
      if (c.buttonish) {
        c.texts = textRuns(el).map(idOf);
        c.icons = el.tagName === "INPUT" && el.value ? [] : icons(el);
        c.valueText = el.tagName === "INPUT" && /^(button|submit|reset)$/i.test(el.type) && /\S/.test(el.value);
      }
      c.inView = false; c.onTop = false; c.cover = null;
      S.ctrls.set(c.id, c);
    }
    const list = [...S.ctrls.values()];

    // tap-target
    for (const c of list) {
      const el = c.el;
      if (isInlineLink(el)) continue;
      let r = c.rect;
      if (el.type === "checkbox" || el.type === "radio") {
        const lab = el.closest("label") || (el.labels && el.labels[0]);
        if (lab) { const lr = lab.getBoundingClientRect(); r = { left: Math.min(r.left, lr.left), top: Math.min(r.top, lr.top), right: Math.max(r.right, lr.right), bottom: Math.max(r.bottom, lr.bottom) }; r.width = r.right - r.left; r.height = r.bottom - r.top; }
      }
      r = pseudoHitArea(el, r);
      if (r.width < MIN_TAP - 0.5 || r.height < MIN_TAP - 0.5) fail("tap-target", el, `${Math.round(r.width)}x${Math.round(r.height)} px (needs ${MIN_TAP}x${MIN_TAP})`, { val: Math.min(r.width, r.height), box: box(c.rect) });
    }

    // empty-control (nothing at all: no text, no icon). A drawn checkbox/switch (role=checkbox, aria-pressed...) that
    // paints its own box reads as a checkbox, like a native one: its words sit next to it.
    for (const c of list) {
      if (!c.buttonish || c.texts.length || c.icons.length || c.valueText) continue;
      if (c.el.matches('[role="checkbox"], [role="radio"], [role="switch"], [aria-pressed], [aria-checked]') && paintsBox(c.el)) continue;
      const aria = clean(c.el.getAttribute("aria-label") || c.el.getAttribute("title"));
      fail("empty-control", c.el, aria ? `nothing visible on it (only an aria-label: "${aria}")` : "no label, no icon: a blank button", { box: box(c.rect) });
    }

    // overlap: two controls in the same layer on top of each other
    const items = list.filter((c) => c.vis && c.pe).map((c) => Object.assign(c, { layer: layerOf(c.el) }));
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        if (a.layer !== b.layer || a.el.contains(b.el) || b.el.contains(a.el)) continue;
        if ((a.el.labels && [...a.el.labels].includes(b.el)) || (b.el.labels && [...b.el.labels].includes(a.el))) continue;
        const ix = Math.min(a.vis.r, b.vis.r) - Math.max(a.vis.l, b.vis.l), iy = Math.min(a.vis.b, b.vis.b) - Math.max(a.vis.t, b.vis.t);
        if (ix >= 4 && iy >= 4) fail("overlap", a.el, `sits on top of ${where(b.el)} "${label(b.el).slice(0, 24)}" (${Math.round(ix)}x${Math.round(iy)} px shared)`, { box: box(a.rect), other: b.id });
      }
    }

    // duplicate: same label + same action twice on this screen
    const groups = new Map();
    for (const c of list) {
      if (!c.buttonish) continue;
      const lab = label(c.el).toLowerCase();
      if (!lab) continue;
      const key = lab + "\u0000" + actionKey(c.el);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c.el);
    }
    // Same label + same action key is a duplicate when the two sit side by side, when the whole block around them is drawn
    // twice (the "duplicate menu" bug), or when they name the same explicit target (href, aria-controls, a data value
    // like "add:lead") from different parts of the screen. Not when each sits in its own list item/card, and not a flag-
    // only toggle (data-flip="1") that acts on whatever block it sits in: one "ES" per script line is the design.
    const namesTarget = (el) => !/^#?$/.test(el.getAttribute("href") || "") || !!el.getAttribute("aria-controls") ||
      [...el.attributes].some((a) => a.name.startsWith("data-") && !/^(1|0|true|false|yes|no|on|off)?$/i.test(a.value));
    const sameThing = (a, b) => {
      let lca = a.parentElement; while (lca && !lca.contains(b)) lca = lca.parentElement;
      if (!lca) return false;
      const top = (x) => { while (x.parentElement !== lca) x = x.parentElement; return x; };
      const ca = top(a), cb = top(b);
      if (ca === a && cb === b) return true;
      if (clean(ca.innerText) === clean(cb.innerText)) return true;
      if (ca.tagName === cb.tagName && (ca.getAttribute("class") || "") === (cb.getAttribute("class") || "")) return false;
      return namesTarget(a);
    };
    for (const els of groups.values()) {
      if (els.length < 2) continue;
      const dup = els.filter((a) => els.some((b) => b !== a && sameThing(a, b)));
      if (dup.length < 2) continue;
      fail("duplicate", dup[0], `"${label(dup[0]).slice(0, 32)}" appears ${dup.length}x doing the same thing: ${dup.map(where).filter((w, i, arr) => arr.indexOf(w) === i).join(", ")}`, { box: box(dup[0].getBoundingClientRect()), others: dup.slice(1).map(idOf) });
    }
  }

  function measure() {   // at the current scroll position: what text/icons/controls are on screen and on top
    const root = S.root, range = document.createRange();
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) {
      const id = idOf(n);
      const prev = S.runs.get(id);
      if (prev && (prev.done || prev.skip)) continue;
      if (!/\S/.test(n.nodeValue) || EMOJI_ONLY.test(n.nodeValue)) { S.runs.set(id, { skip: true }); continue; }
      const el = n.parentElement;
      if (!el || SKIP_TAGS.has(el.tagName.toUpperCase())) { S.runs.set(id, { skip: true }); continue; }
      const cs = getComputedStyle(el);
      if (cs.visibility !== "visible" || disabled(el) || inClosedDetails(el)) continue;
      range.selectNodeContents(n);
      const clip = clipOf(el, true);
      const all = [...range.getClientRects()].map((r) => inter(r, clip)).filter(Boolean);
      const rects = all.filter((r) => clearOnTop(el, r, true));
      // grade a run only when every line of it is in the clear (not half under a fixed bar): else try the next step
      if (!rects.length || rects.length < all.length) continue;
      const svg = el instanceof SVGElement;
      let fg = rgba(svg ? cs.fill : cs.webkitTextFillColor || cs.color);
      if (!fg) { S.runs.set(id, { skip: true }); continue; }
      fg = Object.assign({}, fg, { a: fg.a * opacity(el) });
      if (fg.a < 0.05) { S.runs.set(id, { skip: true, invisible: true }); continue; }
      const halos = [];
      if (svg && cs.stroke !== "none" && parseFloat(cs.strokeWidth) >= 1) { const h = rgba(cs.stroke); if (h && h.a > 0.5) halos.push(h); }
      for (const m of (cs.textShadow || "").matchAll(/(rgba?\([^)]*\)|#[0-9a-f]{3,8})/gi)) { const h = rgba(m[1]); if (h && h.a > 0.5) halos.push(h); }
      if (!WORDY.test(n.nodeValue)) {   // a lone "→" or "·" next to a button's words is decoration, not text
        const ctl = el.closest(BUTTONISH);
        if (ctl && WORDY.test(ctl.innerText || "")) { S.runs.set(id, { skip: true }); continue; }
      }
      const size = parseFloat(cs.fontSize) || 0, weight = parseInt(cs.fontWeight, 10) || 400;
      const rec = { kind: "text", id, el: idOf(el), text: clean(n.nodeValue).slice(0, 40), fg, halos, rects,
        large: size >= 24 || (size >= 18.66 && weight >= 700) };
      S.runs.set(id, rec); S.pending.push(rec);
    }
    for (const c of S.ctrls.values()) {
      const r = inter(c.el.getBoundingClientRect(), clipOf(c.el));
      if (!r || !c.pe) continue;
      const x = (r.l + r.r) / 2, y = (r.t + r.b) / 2;
      if (x < 0 || y < 0 || x >= VW() || y >= VH()) continue;
      c.inView = true;
      const h = hitOk(c.el, x, y, false);
      if (h.ok) c.onTop = true; else if (h.hit) c.cover = h.hit;
      if (c.buttonish && !c.texts.length && c.icons.length && !c.iconDone && h.ok) {   // icon-only: grade the icon
        const g = c.icons.find((i) => i.tagName && i.tagName.toLowerCase() === "svg");
        const paint = g && paintOf(g);
        const gr = g && inter(g.getBoundingClientRect(), clipOf(g));
        if (paint && gr && clearOnTop(c.el, gr, false)) {
          c.iconDone = true;
          const rec = { kind: "icon", ctrl: c.id, svg: g, fg: Object.assign({}, paint, { a: paint.a * opacity(g) }), halos: [], rects: [gr] };
          S.pending.push(rec); c.iconRec = rec;
        }
      }
    }
    return S.pending.length;
  }

  function hide(on) {   // hide every glyph (and the icons being graded) so the screenshot shows only what's behind them
    if (on) {
      S.style = document.createElement("style");
      S.style.textContent = "*,*::before,*::after,*::placeholder,*::first-letter,*::first-line{-webkit-text-fill-color:transparent!important;text-shadow:none!important;text-decoration-color:transparent!important;caret-color:transparent!important;-webkit-text-stroke-color:transparent!important}*::marker{color:transparent!important}svg text,svg tspan{fill:transparent!important;stroke:transparent!important}";
      document.head.appendChild(S.style);
      for (const r of S.pending) if (r.svg) { S.hidden.push([r.svg, r.svg.style.getPropertyValue("visibility"), r.svg.style.getPropertyPriority("visibility")]); r.svg.style.setProperty("visibility", "hidden", "important"); }
    } else {
      if (S.style) S.style.remove();
      S.style = null;
      for (const [el, v, p] of S.hidden) { if (v) el.style.setProperty("visibility", v, p); else el.style.removeProperty("visibility"); }
      S.hidden = [];
    }
  }

  async function sample(b64) {
    const bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height;
    const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(bmp, 0, 0);
    const img = g.getImageData(0, 0, c.width, c.height), W = c.width, H = c.height, px = img.data;
    for (const rec of S.pending) {
      const vals = [];
      for (const r of rec.rects) {
        const step = Math.max(1, Math.round(Math.sqrt(((r.r - r.l) * (r.b - r.t)) / 250)));
        for (let y = Math.floor(r.t); y < Math.min(H, Math.ceil(r.b)); y += step) {
          for (let x = Math.floor(r.l); x < Math.min(W, Math.ceil(r.r)); x += step) {
            if (x < 0 || y < 0) continue;
            const o = (y * W + x) * 4, bg = { r: px[o], g: px[o + 1], b: px[o + 2] };
            let best = contrast(over(rec.fg, bg), bg);
            for (const h of rec.halos) best = Math.max(best, contrast(over(rec.fg, h), h));
            vals.push([best, bg]);
          }
        }
      }
      if (!vals.length) continue;
      vals.sort((a, b) => a[0] - b[0]);
      const pick = vals[Math.floor(vals.length * 0.2)];   // 80% of the area behind it is at least this good
      rec.ratio = pick[0]; rec.bg = pick[1]; rec.done = true;
    }
    S.pending = [];
  }

  function finish() {
    // contrast: worst run per element
    const worst = new Map();
    for (const rec of S.runs.values()) {
      if (rec.kind !== "text" || !rec.done) continue;
      const need = rec.large ? 3 : 4.5;
      if (rec.ratio >= need - 0.01) continue;
      const cur = worst.get(rec.el);
      if (!cur || rec.ratio < cur.ratio) worst.set(rec.el, Object.assign({ need }, rec));
    }
    for (const rec of worst.values()) {
      const el = S.els[rec.el];
      fail("contrast", el, `${rec.ratio.toFixed(2)}:1, needs ${rec.need}:1${rec.large ? " (large text)" : ""} - "${rec.text}" ${hex(over(rec.fg, rec.bg))} on ${hex(rec.bg)}`, { val: rec.ratio, box: box(el.getBoundingClientRect()) });
    }
    for (const c of S.ctrls.values()) {
      // a label that exists but can't be seen (white on white): the v24 bug
      if (c.buttonish && c.texts.length && !c.icons.length) {
        const runs = c.texts.map((i) => S.runs.get(i)).filter((r) => r && r.kind === "text" && r.done);
        const gone = c.texts.every((i) => { const r = S.runs.get(i); return r && r.invisible; });
        const best = runs.length ? Math.max(...runs.map((r) => r.ratio)) : null;
        if (gone || (runs.length === c.texts.length && best < BLANK)) {
          fail("empty-control", c.el, gone ? `its label "${label(c.el).slice(0, 24)}" is fully transparent` : `looks blank: its label "${label(c.el).slice(0, 24)}" is ${best.toFixed(2)}:1 against the button`, { box: box(c.rect) });
        }
      }
      // an icon-only button: the icon is the label
      if (c.iconRec && c.iconRec.done && c.iconRec.ratio < 3 - 0.01) {
        const r = c.iconRec;
        if (r.ratio < BLANK) fail("empty-control", c.el, `looks blank: its only icon is ${r.ratio.toFixed(2)}:1 against the button`, { box: box(c.rect) });
        else fail("contrast", c.el, `icon ${r.ratio.toFixed(2)}:1, needs 3:1 (icon-only button) - ${hex(over(r.fg, r.bg))} on ${hex(r.bg)}`, { val: r.ratio, box: box(c.rect) });
      }
      // covered at every scroll position it was on screen
      if (c.inView && !c.onTop && c.pe) {
        const cov = c.cover;
        const what = cov ? (cov.closest(CONTROL) ? `the control ${where(cov.closest(CONTROL))}` : where(cov)) : "something";
        fail("overlap", c.el, `can't be tapped: covered by ${what} at every scroll position`, { box: box(c.rect) });
      }
    }
    const out = S.findings;
    const stats = { controls: S.ctrls.size, text: [...S.runs.values()].filter((r) => r.kind === "text" && r.done).length };
    return { findings: out.map((f) => Object.assign({}, f)), stats };
  }

  function settle() {   // finish transitions/one-shot animations, park looping ones at their start
    for (const a of document.getAnimations ? document.getAnimations() : []) {
      try { const t = a.effect && a.effect.getComputedTiming(); if (t && t.endTime === Infinity) a.cancel(); else a.finish(); } catch (e) { /* ignore */ }
    }
  }

  window.__dg = {
    begin() {
      settle();
      S.ctrls = new Map(); S.runs = new Map(); S.pending = []; S.findings = [];
      S.root = activeRoot();
      S.scrollers = scrollersIn(S.root);
      for (const s of S.scrollers) s.scrollTop = 0;
      domChecks();
      const plan = [{ s: -1, y: 0 }];
      S.scrollers.forEach((s, i) => {
        const max = s.scrollHeight - s.clientHeight, step = Math.max(100, Math.floor(s.clientHeight * 0.45));
        const ys = [];
        for (let y = step; y < max; y += step) ys.push(y);
        ys.push(max);
        const keep = ys.length > 60 ? ys.filter((_, k) => k % Math.ceil(ys.length / 60) === 0 || k === ys.length - 1) : ys;
        for (const y of keep) plan.push({ s: i, y });
      });
      return { plan, root: S.root === document.body ? "body" : where(S.root) };
    },
    scrollTo(p) {
      S.scrollers.forEach((s, i) => { s.scrollTop = i === p.s ? p.y : 0; });
      settle();
    },
    measure, hide, sample, finish, settle,
    mark(ids) {   // outline the problems for the failure screenshot
      S.marked = [];
      for (const id of ids) {
        const el = S.els[id];
        if (!el || !el.style) continue;
        S.marked.push([el, el.style.getPropertyValue("outline"), el.style.getPropertyValue("outline-offset")]);
        el.style.setProperty("outline", "3px solid #ff0033", "important"); el.style.setProperty("outline-offset", "-2px", "important");
      }
      for (const s of S.scrollers) s.scrollTop = 0;
    },
    unmark() {   // the next view's contrast samples must not see red outlines
      for (const [el, o, off] of S.marked || []) {
        if (o) el.style.setProperty("outline", o); else el.style.removeProperty("outline");
        if (off) el.style.setProperty("outline-offset", off); else el.style.removeProperty("outline-offset");
      }
      S.marked = [];
    },
  };
}

/* ================= the mocked window.claude + frozen clock, installed before the page's own scripts ================= */
function initScript(page, combo, data) {
  const storage = (page.storage && page.storage[combo.lang]) || {};
  return `(() => {
  const FIXED = Date.parse(${JSON.stringify(FIXED_NOW_ISO)}), START = Date.now(), RealDate = Date;
  const now = () => FIXED + (RealDate.now() - START);
  function FrozenDate(...a) {   // a plain function, so Date() without "new" keeps working too
    if (!new.target) return new RealDate(now()).toString();
    return a.length ? new RealDate(...a) : new RealDate(now());
  }
  FrozenDate.prototype = RealDate.prototype;
  FrozenDate.now = now; FrozenDate.parse = RealDate.parse; FrozenDate.UTC = RealDate.UTC;
  window.Date = FrozenDate;
  try { localStorage.clear(); const st = ${JSON.stringify(storage)}; for (const k in st) localStorage.setItem(k, st[k]); } catch (e) {}
  ${combo.attr ? `{ const set = () => document.documentElement && document.documentElement.setAttribute('data-theme', ${JSON.stringify(combo.attr)});
    set(); if (!document.documentElement) new MutationObserver((m, o) => { if (document.documentElement) { set(); o.disconnect(); } }).observe(document, { childList: true }); }` : ""}

  // remember which function each element's own click listeners run, so "same action" can be told apart
  const fnIds = new WeakMap(); let fnN = 0;
  window.__dgFnId = (fn) => { if (!fnIds.has(fn)) fnIds.set(fn, ++fnN); return fnIds.get(fn); };
  window.__dgListeners = new WeakMap();
  const add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    try { if (fn && this instanceof Element) { const l = window.__dgListeners.get(this) || []; l.push({ type, fn: window.__dgFnId(fn) }); window.__dgListeners.set(this, l); } } catch (e) {}
    return add.call(this, type, fn, opts);
  };

  const FIX = ${JSON.stringify(data)};
  const C = JSON.parse(JSON.stringify(FIX.collections || {})), D = JSON.parse(JSON.stringify(FIX.docs || {}));
  const cp = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const split = (p) => { const i = p.indexOf('/'); return i < 0 ? [p, ''] : [p.slice(0, i), p.slice(i + 1)]; };
  const read = (p) => (p in D ? D[p] : ((C[split(p)[0]] || {})[split(p)[1]]));
  const write = (p, v) => { const [c, id] = split(p); if (C[c] && !(p in D)) C[c][id] = v; else if (!(p in D) && id && !id.includes('/')) { C[c] = C[c] || {}; C[c][id] = v; } else D[p] = v; };
  const snapDoc = (p, v) => ({ id: split(p)[1] || p, exists: v != null, data: () => cp(v == null ? undefined : v), ref: doc(p) });
  function doc(p) {
    return {
      id: split(p)[1] || p, path: p,
      get: async () => snapDoc(p, read(p)),
      onSnapshot(cb) { setTimeout(() => { try { cb(snapDoc(p, read(p))); } catch (e) { console.error(e); } }, 0); return () => {}; },
      set: async (v, o) => { write(p, o && o.merge ? Object.assign({}, read(p) || {}, cp(v)) : cp(v)); },
      update: async (v) => { write(p, Object.assign({}, read(p) || {}, cp(v))); },
      delete: async () => { const [c, id] = split(p); if (p in D) delete D[p]; else if (C[c]) delete C[c][id]; },
    };
  }
  const test = (v, [f, op, x]) => { const y = v ? v[f] : undefined;
    return op === '==' ? y === x : op === '!=' ? y !== x : op === '>=' ? y >= x : op === '<=' ? y <= x : op === '>' ? y > x : op === '<' ? y < x :
      op === 'in' ? (x || []).includes(y) : op === 'array-contains' ? (y || []).includes(x) : true; };
  function query(name, filters, order, lim) {
    const self = {
      where: (f, op, v) => query(name, filters.concat([[f, op, v]]), order, lim),
      orderBy: (f, dir) => query(name, filters, [f, dir], lim),
      limit: (n) => query(name, filters, order, n),
      doc: (id) => doc(name + '/' + id),
      add: async (v) => { const id = 'dg' + Math.random().toString(36).slice(2, 10); C[name] = C[name] || {}; C[name][id] = cp(v); return doc(name + '/' + id); },
      get: async () => self._snap(),
      onSnapshot(cb) { setTimeout(() => { try { cb(self._snap()); } catch (e) { console.error(e); } }, 0); return () => {}; },
      _snap() {
        const coll = C[name] || {};
        let ids = Object.keys(coll).filter((id) => filters.every((f) => test(coll[id], f)));
        if (order) ids.sort((a, b) => { const x = coll[a][order[0]], y = coll[b][order[0]]; return (x < y ? -1 : x > y ? 1 : 0) * (order[1] === 'desc' ? -1 : 1); });
        if (lim) ids = ids.slice(0, lim);
        const docs = ids.map((id) => snapDoc(name + '/' + id, coll[id]));
        return { docs, size: docs.length, empty: !docs.length, forEach: (f) => docs.forEach(f) };
      },
    };
    return self;
  }
  const db = { collection: (n) => query(n, [], null, 0), doc };
  const user = { canEdit: async () => true, isOwner: async () => true, get: async () => ({ name: 'FilthE' }) };   // FilthE on his own published page
  const sample = async () => ({ text: '' });
  sample.json = async () => ({ reply: '', actions: [] });
  sample.limits = async () => ({ maxPromptBytes: 65536 });
  const assets = { upload: async () => ({ id: '0'.repeat(32), url: '', sizeBytes: 0, contentType: 'image/png' }), list: async () => ({ assets: [], usage: {} }), delete: async () => ({ deleted: true }) };
  const caps = { db, user, sample, assets };
  window.claude = { use: async (n) => caps[n] || null, complete: async () => '' };
})();`;
}

/* ================= node side ================= */
function loadPlaywright() {
  for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright"]) {
    try { return require(p); } catch (e) { /* try the next */ }
  }
  return null;
}
function chromiumPath(chromium) {
  for (const c of [process.env.PLAYWRIGHT_CHROMIUM_PATH, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"]) {
    if (c && fs.existsSync(c)) return c;
  }
  try { const p = chromium.executablePath(); if (p && fs.existsSync(p)) return p; } catch (e) { /* fall through */ }
  return undefined;
}
const isNetworkNoise = (t) => /failed to load resource|net::err_|err_cert|err_name_not_resolved|err_internet_disconnected|err_failed/i.test(t);
const slug = (s) => String(s).replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 60) || "x";
const LIB_SRC = `(${pageLib.toString()})()`;

async function frames(page, ms) {
  if (ms) await page.waitForTimeout(ms);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))).catch(() => {});
}

async function auditView(page, ctx, viewName) {
  await page.evaluate(LIB_SRC);
  const { plan } = await page.evaluate(() => window.__dg.begin());
  for (const step of plan) {
    await page.evaluate((s) => window.__dg.scrollTo(s), step);
    await frames(page);
    const pending = await page.evaluate(() => window.__dg.measure());
    if (!pending) continue;
    let png;
    try {
      await page.evaluate(() => window.__dg.hide(true));
      await frames(page);
      png = await page.screenshot({ animations: "disabled", caret: "hide" });
    } finally {   // never leave the text hidden for the next tab: it would be skipped, not graded
      await page.evaluate(() => window.__dg.hide(false)).catch(() => {});
    }
    await page.evaluate((b64) => window.__dg.sample(b64), png.toString("base64"));
  }
  const res = await page.evaluate(() => window.__dg.finish());
  const findings = res.findings.map((f) => Object.assign({ view: viewName }, f));
  if (!res.stats.controls && !res.stats.text) {   // a blank render must not pass as "clean"
    findings.push({ view: viewName, rule: "gate-error", where: "(page)", label: "", detail: "nothing on screen to check (blank render or the view never opened)" });
  }
  const shotKey = (f) => [ctx.page.rel, f.rule, f.view, f.where].join("|");
  const wantShot = ctx.opts.shots || (findings.some((f) => !ctx.shared.shotFor.has(shotKey(f))) && ctx.shared.shots < MAX_SHOTS);
  if (wantShot) {
    const ids = [...new Set(findings.flatMap((f) => [f.el, f.other, ...(f.others || [])]).filter((x) => x != null))];
    await page.evaluate((i) => window.__dg.mark(i), ids);
    await frames(page);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const file = `${slug(path.basename(ctx.page.rel, ".html"))}_${slug(viewName)}_${slug(ctx.combo.theme)}_${ctx.combo.width}_${ctx.combo.lang}.png`;
    try {
      await page.screenshot({ path: path.join(OUT_DIR, file), fullPage: true, animations: "disabled" });
      if (findings.length) { ctx.shared.shots++; for (const f of findings) { f.shot = file; ctx.shared.shotFor.add(shotKey(f)); } }
    } catch (e) { /* the screenshot is a courtesy; the finding stands without it */ }
    await page.evaluate(() => window.__dg.unmark());
  }
  return { findings, stats: res.stats };
}

async function clickStep(page, sel) {
  const loc = page.locator(sel);
  const n = await loc.count();
  for (let i = 0; i < n; i++) {
    const one = loc.nth(i);
    if (await one.isVisible().catch(() => false)) {
      await one.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      await one.click({ timeout: 3000 });
      return;
    }
  }
  throw new Error(`nothing visible matches ${sel}`);
}

async function runCombo(browser, page, combo, opts, shared, data) {
  const context = await browser.newContext({
    viewport: { width: combo.width, height: combo.height },   // plain viewport (no isMobile): these pages ship no meta viewport
    colorScheme: combo.scheme,
    locale: combo.lang === "es" ? "es-US" : "en-US",
    timezoneId: TIMEZONE,
    reducedMotion: "reduce",
  });
  await context.route(/^(https?|wss?):/, (r) => r.abort());   // offline on purpose: same result on every machine
  await context.addInitScript(initScript(page, combo, data));
  const p = await context.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String((e && e.message) || e)));
  p.on("console", (m) => { if (m.type() === "error" && !isNetworkNoise(m.text())) errors.push("console.error: " + m.text()); });
  const ctx = { page, combo, opts, shared };
  const findings = [];
  const views = [];
  const url = "file://" + (page.file || path.join(ROOT, page.rel));
  const load = async () => {
    await p.goto(url, { waitUntil: "load", timeout: 20000 });
    await p.evaluate(() => (document.fonts ? document.fonts.ready : null)).catch(() => {});
    await frames(p, 700);
  };
  const add = (r) => { findings.push(...r.findings); views.push(r); };
  try {
    await load();
    const tabs = page.tabs ? await p.$$eval(page.tabs, (els) => els.filter((e) => e.getClientRects().length).map((e) => e.id || e.dataset.tab || e.getAttribute("aria-controls"))) : [];
    if (!tabs.length) add(await auditView(p, ctx, "main"));
    for (const t of tabs) {
      try {
        await clickStep(p, `${page.tabs}#${t}, ${page.tabs}[data-tab="${t}"], ${page.tabs}[aria-controls="${t}"]`);
        await frames(p, 350);
        add(await auditView(p, ctx, "tab:" + t.replace(/^tb-/, "")));
      } catch (e) { findings.push({ view: "tab:" + t, rule: "gate-error", where: "(page)", label: "", detail: `could not open this tab: ${e.message.split("\n")[0]}` }); }
    }
    for (const v of page.views || []) {
      try {
        await load();
        for (const sel of v.steps) { await clickStep(p, sel); await frames(p, 400); }
        add(await auditView(p, ctx, v.name));
      } catch (e) { findings.push({ view: v.name, rule: "gate-error", where: "(page)", label: "", detail: `could not open this view: ${e.message.split("\n")[0]}` }); }
    }
  } catch (e) {
    findings.push({ view: "(load)", rule: "gate-error", where: "(page)", label: "", detail: `page failed to load: ${e.message.split("\n")[0]}` });
  }
  for (const e of new Set(errors)) findings.push({ view: "(any)", rule: "js-error", where: "(page)", label: "", detail: e.slice(0, 200) });
  await context.close();
  return { findings, views: views.length, controls: views.reduce((n, v) => n + v.stats.controls, 0), text: views.reduce((n, v) => n + v.stats.text, 0) };
}

function combosFor(opts) {
  const out = [];
  for (const lang of opts.langs) {
    for (const t of THEMES) {
      if (!LANG_THEMES[lang].includes(t.id) || !opts.themes.includes(t.id)) continue;
      for (const s of SIZES) if (opts.widths.includes(s.width)) out.push({ lang, theme: t.id, scheme: t.scheme, attr: t.attr, width: s.width, height: s.height });
    }
  }
  return out;
}

function comboText(set, all) {
  if (set.size === all.length) return "every theme, size and language";
  const byTheme = new Map(), langs = new Set();
  for (const k of set) { const [theme, w, lang] = k.split("|"); if (!byTheme.has(theme)) byTheme.set(theme, new Set()); byTheme.get(theme).add(w); langs.add(lang); }
  const themes = [...byTheme].map(([t, ws]) => `${t} ${[...ws].sort().join("+")}`).join(", ");
  return `${themes} · ${[...langs].sort().join("+")}`;
}

const RULE_ORDER = ["gate-error", "js-error", "empty-control", "overlap", "duplicate", "contrast", "tap-target"];

function report(results, opts) {
  const lines = [];
  const say = (s = "") => { console.log(s); lines.push(s); };
  let bad = 0, problems = 0, gateBroken = false;
  for (const r of results) {
    const groups = new Map();
    for (const f of r.findings) {
      const key = [f.rule, f.view, f.where].join("\u0000");
      if (!groups.has(key)) groups.set(key, Object.assign({ combos: new Set(), n: new Map() }, f));
      const g = groups.get(key), ck = `${f.combo.theme}|${f.combo.width}|${f.combo.lang}`;
      g.combos.add(ck);
      g.n.set(ck, (g.n.get(ck) || 0) + 1);
      if (f.val != null && (g.val == null || f.val < g.val)) { g.val = f.val; g.detail = f.detail; g.label = f.label || g.label; }
      if (!g.shot && f.shot) g.shot = f.shot;
    }
    const checked = `${r.views} views, ${r.controls} controls and ${r.text} text runs checked`;
    if (!groups.size) { say(`[PASS] ${r.page.rel} (${checked})`); continue; }
    bad++; problems += groups.size;
    if ([...groups.values()].some((g) => g.rule === "gate-error")) gateBroken = true;
    say(`[FAIL] ${r.page.rel}: ${groups.size} problem${groups.size === 1 ? "" : "s"} (${checked})`);
    const byRule = new Map();
    for (const g of groups.values()) { if (!byRule.has(g.rule)) byRule.set(g.rule, []); byRule.get(g.rule).push(g); }
    const rules = [...byRule.keys()].sort((a, b) => (RULE_ORDER.indexOf(a) + 99) % 99 - (RULE_ORDER.indexOf(b) + 99) % 99);
    for (const rule of rules) {
      const gs = byRule.get(rule).sort((a, b) => (a.view < b.view ? -1 : a.view > b.view ? 1 : 0));
      say(`  ${rule} (${gs.length})`);
      const show = opts.verbose ? gs : gs.slice(0, 30);
      for (const g of show) {
        const count = Math.max(...g.n.values());
        const what = g.where === "(page)" ? "" : `${g.where}${g.label ? ` "${g.label.slice(0, 32)}"` : ""}${count > 1 ? ` x${count}` : ""}: `;
        say(`    [${g.view}] ${what}${g.detail}`);
        say(`        in: ${comboText(g.combos, r.combos)}${g.shot ? `  (screenshot: ${path.relative(ROOT, path.join(OUT_DIR, g.shot))})` : ""}`);
      }
      if (show.length < gs.length) say(`    ... and ${gs.length - show.length} more (--verbose shows all)`);
    }
  }
  return { lines, bad, problems, gateBroken };
}

function parseArgs(argv) {
  const o = { pages: [], widths: SIZES.map((s) => s.width), themes: THEMES.map((t) => t.id), langs: ["en", "es"], shots: false, verbose: false, selfTest: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => argv[++i];
    if (a === "--page") o.pages.push(next());
    else if (a === "--size") o.widths = String(next()).split(",").map((w) => parseInt(w, 10));
    else if (a === "--theme") o.themes = String(next()).split(",");
    else if (a === "--lang") o.langs = String(next()).split(",");
    else if (a === "--quick") { o.widths = [360]; o.themes = ["light", "dark"]; o.langs = ["en"]; }
    else if (a === "--shots") o.shots = true;
    else if (a === "--verbose" || a === "-v") o.verbose = true;
    else if (a === "--self-test") o.selfTest = true;
    else if (a === "--help" || a === "-h") { const src = fs.readFileSync(__filename, "utf8").split("\n"); console.log(src.slice(1, src.findIndex((l) => l.startsWith('"use strict"'))).join("\n")); process.exit(0); }
    else { console.error(`unknown option ${a} (try --help)`); process.exit(2); }
  }
  const bad = [...o.langs.filter((l) => !LANG_THEMES[l]), ...o.themes.filter((t) => !THEMES.some((x) => x.id === t)),
    ...o.widths.filter((w) => !SIZES.some((x) => x.width === w))];
  if (bad.length) { console.error(`unknown --lang/--theme/--size value: ${bad.join(", ")} (try --help)`); process.exit(2); }
  return o;
}

/* ================= --self-test: a page with one known instance of every problem, next to clean look-alikes ========
 * The traps that must NOT fire: text over a gradient, an inline link in a sentence, one "Call" per list item, content
 * that scrolls under the fixed bar but can be scrolled clear, and #straddle, a two-line text whose second line stays
 * under the orange bar at full scroll (grading it against the bar's orange was a real false alarm in Spanish). */
const SELF_TEST_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;font:16px/1.4 sans-serif;background:#fff;color:#111;position:relative}
main{padding:16px}
a{color:inherit}
button{min-width:48px;min-height:48px;font:inherit;background:#e8e8e8;color:#111;border:1px solid #999}
.bar{position:fixed;left:0;right:0;bottom:0;height:64px;background:#f5883a;display:flex;gap:8px;padding:8px;box-sizing:border-box}
.bar button{background:#444;color:#fff;border:0}
.grad{background:linear-gradient(90deg,#fff,#eee);padding:8px}
.spacer{height:1500px;background:linear-gradient(#fff,#f4f4f4)}
#straddle{position:absolute;right:8px;bottom:40px;width:150px;margin:0;color:#555}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) #straddle{color:#ddd}:root:not([data-theme=light]) body{background:#111;color:#eee}:root:not([data-theme=light]) #darkLow{color:#333}:root:not([data-theme=light]) .grad,:root:not([data-theme=light]) .spacer{background:#111}}
:root[data-theme=dark] #straddle{color:#ddd}:root[data-theme=dark] body{background:#111;color:#eee}:root[data-theme=dark] #darkLow{color:#333}:root[data-theme=dark] .grad,:root[data-theme=dark] .spacer{background:#111}
</style></head><body><main>
<p id="okText">Plain readable text.</p>
<p id="lowText" style="color:#aaa">Low contrast text in light.</p>
<p id="darkLow">Only unreadable in dark.</p>
<p class="grad" id="gradText">Readable over a gradient.</p>
<button id="okBtn" data-act="save">Save</button>
<button id="blankBtn" style="background:#fff;color:#fff;border:1px solid #ccc">Send</button>
<button id="ariaOnly" aria-label="Close"></button>
<button id="iconBtn" aria-label="Menu"><svg viewBox="0 0 24 24" width="24" height="24"><path d="M4 6h16M4 12h16" stroke="#111" stroke-width="2"/></svg></button>
<button id="small" style="min-width:0;min-height:0;width:30px;height:30px">S</button>
<p>Read the <a id="inlineLink" href="#terms">terms</a> before you sign anything today.</p>
<div style="position:relative;height:60px"><button id="ovA" style="position:absolute;left:0;top:0">One</button><button id="ovB" style="position:absolute;left:24px;top:6px">Two</button></div>
<button id="dup1" data-act="delete">Delete</button> <button id="dup2" data-act="delete">Delete</button>
<ul><li>Ana <button class="call">Call</button></li><li>Bob <button class="call">Call</button></li></ul>
<div class="spacer"></div>
<button id="buried">Last</button>
</main>
<p id="straddle">Wide first line of text end</p>
<nav class="bar"><button id="barA">Home</button><button id="barB">More</button></nav>
<script>for (const b of document.querySelectorAll('.call')) b.addEventListener('click', () => b.parentNode.firstChild.textContent);</script>
</body></html>`;

// every [rule, element] the self-test page must produce, per theme; anything else it reports is a false alarm
const SELF_TEST_EXPECT = {
  light: [["contrast", "#lowText"], ["contrast", "#blankBtn"], ["empty-control", "#blankBtn"], ["empty-control", "#ariaOnly"],
    ["tap-target", "#small"], ["overlap", "#ovA"], ["duplicate", "#dup1"], ["overlap", "#buried"]],
  dark: [["contrast", "#darkLow"], ["contrast", "#blankBtn"], ["empty-control", "#blankBtn"], ["empty-control", "#ariaOnly"],
    ["tap-target", "#small"], ["overlap", "#ovA"], ["duplicate", "#dup1"], ["overlap", "#buried"]],
};

async function selfTest(browser) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, "self-test.html");
  fs.writeFileSync(file, SELF_TEST_HTML);
  const page = { rel: "(self-test page)", file, views: [] };
  const opts = { shots: false };
  const shared = { shots: MAX_SHOTS, shotFor: new Set() };   // no screenshots from the self-test
  let ok = true;
  for (const t of THEMES) {
    const combo = { lang: "en", theme: t.id, scheme: t.scheme, attr: t.attr, width: 360, height: 800 };
    const { findings } = await runCombo(browser, page, combo, opts, shared, { collections: {}, docs: {} });
    const got = new Set(findings.map((f) => `${f.rule} ${f.where}`));
    const want = new Set(SELF_TEST_EXPECT[t.id.endsWith("dark") ? "dark" : "light"].map(([r, w]) => `${r} ${w}`));
    const missing = [...want].filter((k) => !got.has(k)), extra = [...got].filter((k) => !want.has(k));
    if (missing.length || extra.length) {
      ok = false;
      console.log(`[FAIL] self-test, ${t.id}`);
      for (const k of missing) console.log(`    missed: ${k}`);
      for (const f of findings) if (extra.includes(`${f.rule} ${f.where}`)) console.log(`    false alarm: ${f.rule} ${f.where}: ${f.detail}`);
    } else console.log(`[PASS] self-test, ${t.id}: all ${want.size} planted problems found, nothing else`);
  }
  return ok;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const pw = loadPlaywright();
  if (!pw) {
    console.error("design_gate.js needs Playwright (npm i -g playwright, or the copy in /opt/node22/lib/node_modules).");
    console.error("There is no fallback: every check measures the live page. Say so in the review instead of skipping it.");
    process.exit(2);
  }
  const browser = await pw.chromium.launch({ executablePath: chromiumPath(pw.chromium), args: ["--no-sandbox", "--font-render-hinting=none"] });
  try {
    if (opts.selfTest) { const ok = await selfTest(browser); process.exitCode = ok ? 0 : 1; return; }

    const pages = PAGES.filter((p) => !opts.pages.length || opts.pages.some((q) => p.rel.includes(q)));
    if (!pages.length) { console.error(`no page matches ${opts.pages.join(", ")}`); process.exitCode = 2; return; }
    const combos = combosFor(opts);
    if (!combos.length) { console.error("that --size/--theme/--lang mix leaves nothing to render"); process.exitCode = 2; return; }
    const data = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
    const t0 = Date.now();
    console.log(`Design gate: ${pages.length} page(s) x ${combos.length} renders (${[...new Set(combos.map((c) => `${c.width}x${c.height}`))].join(", ")}; ` +
      `${[...new Set(combos.map((c) => c.theme))].join(", ")}; ${[...new Set(combos.map((c) => c.lang))].join("+")})\n`);
    const shared = { shots: 0, shotFor: new Set() };
    const results = [];
    for (const page of pages) {
      const r = { page, findings: [], views: 0, controls: 0, text: 0, combos: combos.map((c) => `${c.theme}|${c.width}|${c.lang}`) };
      for (const combo of combos) {
        const out = await runCombo(browser, page, combo, opts, shared, data);
        r.views += out.views; r.controls += out.controls; r.text += out.text;
        for (const f of out.findings) r.findings.push(Object.assign({ combo }, f));
      }
      results.push(r);
    }
    const { lines, bad, problems, gateBroken } = report(results, opts);
    const secs = Math.round((Date.now() - t0) / 1000);
    const tail = bad
      ? `\nFAIL: ${problems} design problem${problems === 1 ? "" : "s"} on ${bad} of ${results.length} page(s) (${secs}s). Screenshots of failing views, problems outlined in red: ${path.relative(ROOT, OUT_DIR)}/`
      : `\nPASS: ${results.length} page(s) clean in every view, at ${[...new Set(combos.map((c) => c.width))].join(" and ")} px, light and dark (${secs}s).`;
    console.log(tail); lines.push(tail);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, "report.txt"), lines.join("\n") + "\n");
    process.exitCode = gateBroken ? 2 : bad ? 1 : 0;
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("design_gate.js crashed: " + ((e && e.stack) || e));
  process.exit(2);
});
