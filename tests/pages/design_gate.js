#!/usr/bin/env node
/* T72: the DESIGN QUALITY GATE - the automated check FilthE asked for after catching white-on-white
 * buttons, duplicate menus and a broken map by eye. Nothing this obvious should ship again without
 * a machine catching it first.
 *
 *   node tests/pages/design_gate.js [--page pages/hmp-app.html] [--lang-key hmp-app-lang] [--tab-key hmp-app-tab]
 *
 * Renders the page headless (real Chromium, so getComputedStyle/getBoundingClientRect match what a
 * phone actually paints) at 360, 390 and 420px, in English and Spanish, with a mocked window.claude
 * (Firestore-shaped db + user/sample/assets, same contract every HMP page uses) and a fixed fixture
 * (tests/pages/design_gate_fixture.json - leads/claims/doors/today-walk, adapted from the leads-and-
 * claims fixture built for the earlier app24/app25 HMP App test harnesses in this project's history).
 * "Today" is frozen to 2026-09-27 so the fixture's dates always line up, whatever day this actually runs.
 *
 * Visits every [role="tab"] plus the "+" add sheet if the page has one, in:
 *   - light and dark via `prefers-color-scheme` at all 3 widths x both languages (the full navigation
 *     sweep - this is how a real phone actually picks a theme), and
 *   - a lighter spot-check of the `data-theme` override attribute (forced dark on a light system, and
 *     forced light on a dark system, at 360/420px) - just enough to confirm the CSS override guard
 *     (":root:not([data-theme=light])" / "[data-theme=dark]") really works, without re-running the
 *     whole tab sweep a second and third time for a check that doesn't depend on width or language.
 *
 * FAILS (nonzero exit) on: contrast < 4.5:1 for text (< 3:1 for large text or icons); a button/control
 * whose label + icon is empty or effectively invisible; tap targets under 44x44px; font sizes under
 * 12px; sideways scroll; interactive elements overlapping each other by more than half of the smaller
 * one's area; duplicate identical controls inside the same header/nav/toolbar; JS errors; broken
 * images or 0-size inline SVGs; and heading text cut off mid-word.
 *
 * Needs Playwright's Chromium (this repo has one at /opt/pw-browsers/chromium-1194) - the checks run
 * getComputedStyle and getBoundingClientRect in the page itself, so there is no lighter fallback here
 * the way tests/pages/shots.js has one: if Playwright is missing, this prints why and exits 2 rather
 * than silently skipping the gate.
 *
 * Screenshots (one per view that failed something, capped per rule) go to tests/pages/design_gate_out/
 * (gitignored scratch, like tests/pages/out/) alongside a copy of the text report.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..");
const OUT_DIR = path.join(__dirname, "design_gate_out");
const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, "design_gate_fixture.json"), "utf8"));

// Frozen "today": the fixture's dates (today/walk, today's doors) are written against this date, so
// freezing Date() here keeps the render deterministic no matter when the gate actually runs.
const FIXED_NOW_ISO = "2026-09-27T15:00:00-05:00";

const WIDTHS = [360, 390, 420];
const LANGS = ["en", "es"];
const FULL_THEMES = [
  { name: "light-system", colorScheme: "light", attr: null },
  { name: "dark-system", colorScheme: "dark", attr: null },
];
// Spot-check only: confirms the data-theme override guard, not a full second/third tab sweep.
const ATTR_SPOT_THEMES = [
  { name: "dark-attr (forced dark, light system)", colorScheme: "light", attr: "dark" },
  { name: "light-attr (forced light, dark system)", colorScheme: "dark", attr: "light" },
];
const SPOT_WIDTHS = [360, 420];

const MAX_SHOTS_PER_RULE = 3;

function parseArgs(argv) {
  const o = { rel: "pages/hmp-app.html", langKey: "hmp-app-lang", tabKey: "hmp-app-tab" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--page" && argv[i + 1]) o.rel = argv[++i];
    else if (argv[i] === "--lang-key" && argv[i + 1]) o.langKey = argv[++i];
    else if (argv[i] === "--tab-key" && argv[i + 1]) o.tabKey = argv[++i];
  }
  return o;
}

function isNetworkResourceError(text) {
  // No internet in this sandbox (Google Fonts, mainly) - a failed external load is expected here and
  // is not a bug in the page's own code. Mirrors tests/pages/shots.js's same carve-out.
  return /failed to load resource|net::err_|err_cert|err_name_not_resolved|err_internet_disconnected/i.test(text);
}

function slug(s) {
  return String(s).replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "x";
}

/* ---------- the mocked window.claude: a Firestore-shaped db (collection/doc, where/onSnapshot/get/
 * set/update/delete) plus user/sample/assets, matching the exact contract pages/hmp-app.html reads
 * (db.collection('leads'|'claims'|'doors'|'dnk'|'evidence'), db.doc('today/walk'|'stats/...'|...)).
 * Shaped after the mock built for the earlier app24/app25 HMP App test harnesses. ---------- */
function buildInitScript(opts) {
  const dataJson = JSON.stringify({ collections: FIXTURE.collections, docs: FIXTURE.docs });
  return `
(() => {
  const FIXED = Date.parse(${JSON.stringify(FIXED_NOW_ISO)});
  const REAL_START = Date.now();
  const RealDate = Date;
  class FrozenDate extends RealDate {
    constructor(...a) { super(...(a.length ? a : [FIXED + (RealDate.now() - REAL_START)])); }
    static now() { return FIXED + (RealDate.now() - REAL_START); }
  }
  window.Date = FrozenDate;

  try { localStorage.clear(); } catch (e) {}
  try { localStorage.setItem(${JSON.stringify(opts.langKey)}, ${JSON.stringify(opts.lang)}); } catch (e) {}
  ${opts.themeAttr ? `try { document.documentElement.setAttribute('data-theme', ${JSON.stringify(opts.themeAttr)}); } catch (e) {}` : ""}

  const FIX = ${dataJson};
  const C = Object.assign({}, FIX.collections);
  const D = Object.assign({}, FIX.docs);
  const cp = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const snapDoc = (id, v) => ({ id, exists: v != null, data: () => (v == null ? undefined : cp(v)) });

  function splitPath(p) { const i = p.indexOf('/'); return i < 0 ? [p, ''] : [p.slice(0, i), p.slice(i + 1)]; }
  function readPath(p) { const [c, id] = splitPath(p); return id ? (C[c] || {})[id] : D[p]; }
  function writePath(p, v) { const [c, id] = splitPath(p); if (id) { C[c] = C[c] || {}; C[c][id] = v; } else D[p] = v; }
  function deletePath(p) { const [c, id] = splitPath(p); if (id) { if (C[c]) delete C[c][id]; } else delete D[p]; }

  function doc(p) {
    return {
      id: splitPath(p)[1] || p,
      get: async () => snapDoc(splitPath(p)[1] || p, readPath(p)),
      onSnapshot(cb) { setTimeout(() => { try { cb(snapDoc(splitPath(p)[1] || p, readPath(p))); } catch (e) {} }, 0); return () => {}; },
      set: async (v) => { writePath(p, cp(v)); },
      update: async (v) => { const cur = Object.assign({}, readPath(p) || {}, cp(v)); writePath(p, cur); },
      delete: async () => { deletePath(p); },
    };
  }
  function passes(v, f) {
    const field = f[0], op = f[1], val = f[2], x = v ? v[field] : undefined;
    if (op === '==') return x === val; if (op === '!=') return x !== val;
    if (op === '>=') return x >= val; if (op === '<=') return x <= val;
    if (op === '>') return x > val; if (op === '<') return x < val;
    return true;
  }
  function query(name, filters) {
    const self = {
      where: (f, op, v) => query(name, filters.concat([[f, op, v]])),
      orderBy: () => self,
      limit: () => self,
      get: async () => self._snap(),
      onSnapshot(cb) { setTimeout(() => { try { cb(self._snap()); } catch (e) {} }, 0); return () => {}; },
      _snap() {
        const coll = C[name] || {};
        const ids = Object.keys(coll).filter((id) => filters.every((f) => passes(coll[id], f)));
        const docs = ids.map((id) => snapDoc(id, coll[id]));
        return { docs, size: docs.length, empty: docs.length === 0 };
      },
    };
    return self;
  }
  const db = { collection: (n) => query(n, []), doc };
  const user = { canEdit: async () => true, isOwner: async () => true };   // FilthE viewing his own published app: the normal case
  const sample = async () => ({ text: '' });
  sample.json = async () => ({ reply: '', actions: [] });
  sample.limits = async () => ({ maxPromptBytes: 65536 });
  const assets = {
    upload: async () => ({ id: '0'.repeat(32), url: '', sizeBytes: 0, contentType: 'image/png' }),
    list: async () => ({ assets: [], usage: {} }),
    delete: async () => ({ deleted: true }),
  };
  window.claude = { use: async (n) => (n === 'db' ? db : n === 'user' ? user : n === 'sample' ? sample : n === 'assets' ? assets : null) };
})();
`;
}

/* ================= runs entirely inside the page (page.evaluate) - must be self-contained: no
 * references to anything outside this function, since Playwright serializes it via toString(). ================= */
function pageAudit() {
  const out = [];

  function describeEl(el) {
    if (!el) return "(page)";
    try {
      const cls = typeof el.className === "string" ? el.className.trim() : (el.getAttribute && el.getAttribute("class")) || "";
      const tag = el.id ? "#" + el.id : el.tagName.toLowerCase() + (cls ? "." + cls.split(/\s+/).slice(0, 3).join(".") : "");
      const name = accName(el);
      return tag + (name ? ` "${name.slice(0, 40)}"` : "");
    } catch (e) {
      return (el.tagName || "(element)") + "";
    }
  }
  function fail(rule, msg, el, rect) {
    out.push({
      rule, msg, sel: describeEl(el),
      rect: rect ? { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) } : null,
    });
  }
  function accName(el) {
    const aria = el.getAttribute && el.getAttribute("aria-label");
    if (aria && aria.trim()) return aria.trim();
    const labelledby = el.getAttribute && el.getAttribute("aria-labelledby");
    if (labelledby) {
      const t = labelledby.split(/\s+/).map((id) => { const n = document.getElementById(id); return n ? n.textContent : ""; }).join(" ").trim();
      if (t) return t;
    }
    const text = (el.textContent || "").trim().replace(/\s+/g, " ");
    if (text) return text;
    const title = el.getAttribute && el.getAttribute("title");
    if (title && title.trim()) return title.trim();
    return "";
  }
  function hasIcon(el) { return !!el.querySelector("svg, img"); }
  function isSrOnly(el) {
    for (let n = el; n; n = n.parentElement) {
      const cls = typeof n.className === "string" ? n.className : (n.getAttribute && n.getAttribute("class")) || "";
      if (/(^|\s)(sr|sr-only|visually-hidden)(\s|$)/i.test(cls)) return true;
      if (n.tagName === "HTML") break;
    }
    return false;
  }
  function isVisible(el) {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (n.hidden) return false;
      const cs = getComputedStyle(n);
      if (cs.display === "none") return false;
      if (cs.visibility === "hidden" || cs.visibility === "collapse") return false;
      if (n.tagName === "DETAILS" && !n.open) {
        // A closed native <details> paints none of its content except <summary> - Chromium suppresses
        // it internally, not via a computed display:none on the child, so getComputedStyle alone
        // (checked above) misses this and would otherwise treat a collapsed accordion's contents as
        // on-screen.
        const summary = n.querySelector(":scope > summary");
        if (!(summary && (el === summary || summary.contains(el)))) return false;
      }
      if (n.tagName === "HTML") break;
    }
    return true;
  }
  function cumOpacity(el) {
    let o = 1;
    for (let n = el; n; n = n.parentElement) {
      const v = parseFloat(getComputedStyle(n).opacity);
      if (!Number.isNaN(v)) o *= v;
      if (n.tagName === "HTML") break;
    }
    return o;
  }
  function parseColor(str) {
    if (!str) return null;
    const m = String(str).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/i);
    if (!m) return null;
    let a = m[4];
    if (a == null) a = 1; else if (a.endsWith("%")) a = parseFloat(a) / 100; else a = parseFloat(a);
    return { r: parseFloat(m[1]), g: parseFloat(m[2]), b: parseFloat(m[3]), a };
  }
  function blend(fg, bg) {
    const a = fg.a == null ? 1 : fg.a;
    return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) };
  }
  function relLum(c) {
    const f = (v) => { v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function contrastRatio(c1, c2) {
    const L1 = relLum(c1), L2 = relLum(c2);
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  }
  function effBg(el) {
    let bg = { r: 255, g: 255, b: 255 };
    const chain = [];
    for (let n = el; n; n = n.parentElement) { chain.push(n); if (n.tagName === "HTML") break; }
    chain.reverse();
    for (const n of chain) {
      const c = parseColor(getComputedStyle(n).backgroundColor);
      if (c && (c.a == null ? 1 : c.a) > 0.001) bg = blend(c, bg);
    }
    return bg;
  }
  function effFg(colorStr, opacity, bg) {
    const c = parseColor(colorStr) || { r: 0, g: 0, b: 0, a: 1 };
    const a = (c.a == null ? 1 : c.a) * opacity;
    return blend({ r: c.r, g: c.g, b: c.b, a }, bg);
  }

  function getActiveLayer() {
    // Same idea as this project's earlier page audits (app25/audit.js): when a modal/sheet is open,
    // only what's inside it is real to the user - background chrome is inert behind the scrim, and
    // checking it too just floods the report with things nobody can see or tap right now.
    const vw = innerWidth, vh = innerHeight;
    let best = null, bestArea = 0;
    for (const c of document.querySelectorAll('[aria-modal="true"], [role="dialog"]')) {
      if (!isVisible(c)) continue;
      const r = c.getBoundingClientRect();
      const area = Math.max(0, r.width) * Math.max(0, r.height);
      if (area >= 0.4 * vw * vh && area >= bestArea) { best = c; bestArea = area; }
    }
    return best || document.body;
  }

  function checkContrastAndFontSize(root) {
    const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT", "TITLE", "DEFS", "SYMBOL"]);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        for (let n = node.parentElement; n && n !== root.parentElement; n = n.parentElement) {
          if (SKIP_TAGS.has(n.tagName)) return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const done = new Set();
    let node;
    while ((node = walker.nextNode())) {
      const el = node.parentElement;
      if (!el || done.has(el) || isSrOnly(el)) continue;
      if (!isVisible(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      done.add(el);
      const cs = getComputedStyle(el);
      const fontSize = parseFloat(cs.fontSize) || 0;
      if (fontSize > 0 && fontSize < 12) fail("font-size", `text renders at ${fontSize.toFixed(1)}px (< 12px): "${node.nodeValue.trim().slice(0, 40)}"`, el, rect);
      const op = cumOpacity(el);
      if (op <= 0) continue;   // fully-hidden text (opacity 0 through the chain) is its own thing - see empty/invisible-control
      const bg = effBg(el);
      const fg = effFg(cs.color, op, bg);
      const weight = parseInt(cs.fontWeight, 10) || 400;
      const large = fontSize >= 24 || (fontSize >= 18.66 && weight >= 700);
      const need = large ? 3.0 : 4.5;
      const ratio = contrastRatio(fg, bg);
      if (ratio < need - 0.02) fail("contrast", `text contrast ${ratio.toFixed(2)}:1 (needs ${need}:1${large ? ", large text" : ""}): "${node.nodeValue.trim().slice(0, 40)}"`, el, rect);
    }
    for (const svg of root.querySelectorAll("svg")) {
      if (!isVisible(svg) || svg.closest("defs, symbol")) continue;
      const rect = svg.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      const op = cumOpacity(svg);
      if (op <= 0) continue;
      const painted = svg.querySelector("path, circle, rect, line, polyline, polygon, ellipse");
      if (!painted) continue;
      const pcs = getComputedStyle(painted);
      const colorStr = (pcs.stroke !== "none" && pcs.stroke) || (pcs.fill !== "none" && pcs.fill) || getComputedStyle(svg).color;
      const bg = effBg(svg);
      const fg = effFg(colorStr, op, bg);
      const ratio = contrastRatio(fg, bg);
      if (ratio < 3.0 - 0.02) fail("contrast-icon", `icon contrast ${ratio.toFixed(2)}:1 (needs 3.0:1)`, svg, rect);
    }
  }

  function checkEmptyOrInvisibleControls(root) {
    const CTRL_SEL = 'button, a[href], [role="button"], [role="tab"], summary, input[type="submit"], input[type="button"]';
    for (const el of root.querySelectorAll(CTRL_SEL)) {
      if (el.disabled) continue;
      if (!isVisible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;   // not laid out at all: caught by tap-target/other checks, not this one
      const name = accName(el);
      const icon = hasIcon(el);
      if (!name && !icon) { fail("empty-control", "control has no visible label text, aria-label/title or icon", el, r); continue; }
      if (cumOpacity(el) < 0.05) fail("invisible-control", "control's label/icon exists in the DOM but is effectively invisible (opacity ~0)", el, r);
    }
  }

  function checkTapTargets(root) {
    const CTRL_SEL = 'button, a[href], input:not([type="hidden"]):not([type="file"]), select, textarea, summary, [role="button"], [role="tab"], [role="checkbox"], [role="switch"]';
    for (const el of root.querySelectorAll(CTRL_SEL)) {
      if (el.disabled) continue;
      if (!isVisible(el) || cumOpacity(el) <= 0) continue;
      const cls = typeof el.className === "string" ? el.className.trim() : "";
      if (el.tagName === "A" && el.closest("p, li") && !cls) continue;   // an inline text link, not a tap target
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.width < 43.5 || r.height < 43.5) fail("tap-target", `tap target ${Math.round(r.width)}x${Math.round(r.height)}px (needs >= 44x44)`, el, r);
    }
  }

  function checkSidewaysScroll() {
    const sw = document.documentElement.scrollWidth, cw = document.documentElement.clientWidth;
    if (sw > cw + 1) out.push({ rule: "sideways-scroll", msg: `the page scrolls sideways (scrollWidth ${sw} > clientWidth ${cw})`, sel: "html", rect: null });
    const sheet = document.querySelector('[role="dialog"] [id$="Body" i], [role="dialog"] .sheet-body, .sheet-body');
    if (sheet && isVisible(sheet)) {
      const sw2 = sheet.scrollWidth, cw2 = sheet.clientWidth;
      if (sw2 > cw2 + 1) fail("sideways-scroll", `the open sheet's body scrolls sideways (scrollWidth ${sw2} > clientWidth ${cw2})`, sheet, sheet.getBoundingClientRect());
    }
  }

  function overlapPass(items, rule, describeMsg) {
    const flagged = new Set();
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;   // parent/child nesting is normal, not an overlap bug
        const ix = Math.max(0, Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left));
        const iy = Math.max(0, Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top));
        const inter = ix * iy;
        if (inter <= 0) continue;
        const ratio = inter / Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
        if (ratio <= 0.5) continue;
        const key = describeEl(a.el) + "|" + describeEl(b.el);
        if (flagged.has(key)) continue;
        flagged.add(key);
        fail(rule, describeMsg(a, b, ratio), a.el, a.r);
      }
    }
  }

  function checkOverlaps(root) {
    // Interactive controls overlapping each other: the literal ask (a floating bar covering a button).
    const CTRL_SEL = 'button, a[href], [role="button"], [role="tab"], input:not([type="hidden"]), select, textarea, summary';
    const controls = [...root.querySelectorAll(CTRL_SEL)]
      .filter((el) => !el.disabled && isVisible(el) && cumOpacity(el) > 0.2)
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter((x) => x.r.width > 2 && x.r.height > 2)
      .slice(0, 220);   // generous cap; keeps the O(n^2) pass cheap even on a very busy screen
    overlapPass(controls, "overlap", (a, b, ratio) =>
      `overlaps ${describeEl(b.el)} by ${Math.round(ratio * 100)}% of the smaller control's area (e.g. a floating bar covering a button)`);

    // Prominent text (its own font-size >= 18px, with a directly-owned text node - a "big number" or
    // headline, not just any large ancestor) overlapping other prominent text: a narrow column with a
    // big bold value in it is exactly how FilthE's garbled-digits bug happened, and no control is
    // involved, so the pass above alone would miss it entirely.
    const big = [];
    for (const el of root.querySelectorAll("*")) {
      if (!isVisible(el) || cumOpacity(el) <= 0.2) continue;
      let hasDirectText = false;
      for (const child of el.childNodes) { if (child.nodeType === 3 && child.nodeValue && child.nodeValue.trim()) { hasDirectText = true; break; } }
      if (!hasDirectText) continue;
      if ((parseFloat(getComputedStyle(el).fontSize) || 0) < 18) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 2 && r.height > 2) big.push({ el, r });
      if (big.length >= 220) break;
    }
    overlapPass(big, "text-overlap", (a, b, ratio) =>
      `large text overlaps ${describeEl(b.el)} by ${Math.round(ratio * 100)}% of the smaller element's area (reads as garbled/unreadable, e.g. two card values colliding in a too-narrow column)`);
  }

  function checkDuplicateChrome(root) {
    const HEADER_SEL = 'nav, header, [role="tablist"], [role="toolbar"], [class*="topbar" i], [class*="toolbar" i], [class*="app-head" i], [class*="sheet-head" i], [class*="tab-bar" i], [class*="tabbar" i]';
    const containers = new Set(root.querySelectorAll(HEADER_SEL));
    if (root.nodeType === 1 && root.matches && root.matches(HEADER_SEL)) containers.add(root);
    for (const c of containers) {
      if (!isVisible(c)) continue;
      const groups = new Map();
      for (const child of c.children) {
        if (!child.matches('button, a, [role="button"], [role="tab"]')) continue;
        if (!isVisible(child) || cumOpacity(child) <= 0) continue;
        const r = child.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        const iconPath = child.querySelector("svg path");
        const iconSig = iconPath ? (iconPath.getAttribute("d") || "").slice(0, 24) : "";
        const sig = child.tagName + "|" + (child.getAttribute("role") || "") + "|" + accName(child).toLowerCase() + "|" + iconSig;
        if (!groups.has(sig)) groups.set(sig, []);
        groups.get(sig).push(child);
      }
      for (const list of groups.values()) {
        if (list.length < 2) continue;
        for (const el of list) fail("duplicate-control", `${list.length} identical controls ("${accName(el) || "(icon only)"}") in the same header/nav/toolbar`, el, el.getBoundingClientRect());
      }
    }
  }

  function checkBrokenMedia(root) {
    for (const img of root.querySelectorAll("img")) {
      if (!isVisible(img)) continue;
      const r = img.getBoundingClientRect();
      if (img.complete && img.naturalWidth === 0) fail("broken-image", "image failed to load (naturalWidth 0)", img, r);
      else if (r.width < 1 || r.height < 1) fail("broken-image", "image renders at 0 size", img, r);
    }
    for (const svg of root.querySelectorAll("svg")) {
      if (!isVisible(svg) || svg.closest("defs, symbol")) continue;
      const r = svg.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) fail("broken-svg", "inline SVG renders at 0 size", svg, r);
    }
  }

  function checkHeadingTruncation(root) {
    const WORD = /[A-Za-z0-9À-ɏ]/;
    for (const h of root.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')) {
      if (!isVisible(h) || h.children.length) continue;   // only the common case: a heading whose whole content is one text node
      const textNode = h.firstChild;
      if (!textNode || textNode.nodeType !== 3) continue;
      const text = textNode.nodeValue;
      if (!text || text.length < 4) continue;
      const cs = getComputedStyle(h);
      if (!(cs.textOverflow === "ellipsis" && cs.overflow !== "visible" && h.scrollWidth > h.clientWidth + 1)) continue;
      const rect = h.getBoundingClientRect();
      const contentRight = rect.right - (parseFloat(cs.paddingRight) || 0) - 2;
      const range = document.createRange();
      let cutoff = 0;
      for (let i = 1; i <= text.length; i++) {
        range.setStart(textNode, 0); range.setEnd(textNode, i);
        if (range.getBoundingClientRect().right <= contentRight) cutoff = i; else break;
      }
      if (cutoff > 0 && cutoff < text.length && WORD.test(text[cutoff - 1]) && WORD.test(text[cutoff])) {
        fail("heading-truncated", `heading text is cut off mid-word: "...${text.slice(Math.max(0, cutoff - 10), cutoff)}|${text.slice(cutoff, cutoff + 10)}..."`, h, rect);
      }
    }
  }

  try {
    const root = getActiveLayer();
    checkContrastAndFontSize(root);
    checkEmptyOrInvisibleControls(root);
    checkTapTargets(root);
    checkSidewaysScroll();
    checkOverlaps(root);
    checkDuplicateChrome(root);
    checkBrokenMedia(root);
    checkHeadingTruncation(root);
  } catch (e) {
    out.push({ rule: "audit-crash", msg: String((e && e.stack) || e), sel: null, rect: null });
  }
  return out;
}

/* ================= node-side driver ================= */

async function discoverTabs(page) {
  const count = await page.locator('[role="tab"]').count();
  const views = [];
  for (let i = 0; i < count; i++) {
    const loc = page.locator('[role="tab"]').nth(i);
    if (!(await loc.isVisible().catch(() => false))) continue;
    const id = await loc.evaluate((el) => el.id || el.dataset.tab || (el.textContent || "").trim().slice(0, 24)).catch(() => `tab${i}`);
    views.push({ id: id || `tab${i}`, nth: i });
  }
  return views;
}

async function runOneContext(browser, opts, shared) {
  const context = await browser.newContext({
    viewport: { width: opts.width, height: 860 },
    colorScheme: opts.colorScheme,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(buildInitScript(opts));
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(String((e && e.message) || e)));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (!isNetworkResourceError(text)) consoleErrors.push("console.error: " + text);
  });

  const findings = [];
  const fileUrl = "file://" + path.join(ROOT, opts.rel);
  let loaded = true;
  try {
    await page.goto(fileUrl, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(500);
  } catch (e) {
    loaded = false;
    findings.push({ view: "(load)", rule: "load-error", msg: String((e && e.message) || e), sel: null, rect: null });
  }

  async function runViewAudit(viewId) {
    let vf;
    try {
      vf = await page.evaluate(pageAudit);
    } catch (e) {
      vf = [{ rule: "audit-error", msg: String((e && e.message) || e), sel: null, rect: null }];
    }
    if (vf.length) {
      const rulesHere = new Set(vf.map((f) => f.rule));
      const needShot = [...rulesHere].some((r) => (shared.shotsTakenForRule.get(r) || 0) < MAX_SHOTS_PER_RULE);
      if (needShot) {
        fs.mkdirSync(OUT_DIR, { recursive: true });
        const fname = `${slug(opts.rel)}_${slug(opts.themeName)}_${opts.width}_${opts.lang}_${slug(viewId)}.png`;
        try {
          await page.screenshot({ path: path.join(OUT_DIR, fname) });
          for (const r of rulesHere) shared.shotsTakenForRule.set(r, (shared.shotsTakenForRule.get(r) || 0) + 1);
          for (const f of vf) f.shot = fname;
        } catch (e) { /* screenshot best-effort only */ }
      }
    }
    for (const f of vf) findings.push(Object.assign({ view: viewId }, f));
  }

  if (loaded) {
    const views = opts.fullSweep ? await discoverTabs(page) : [];
    if (!views.length) {
      await runViewAudit("(default)");
    } else {
      for (const view of views) {
        const loc = page.locator('[role="tab"]').nth(view.nth);
        const already = await loc.getAttribute("aria-selected").then((v) => v === "true").catch(() => false);
        if (!already) {
          try { await loc.click({ timeout: 3000 }); await page.waitForTimeout(350); }
          catch (e) { findings.push({ view: view.id, rule: "nav-error", msg: `could not open this tab: ${e.message}`, sel: null, rect: null }); continue; }
        }
        await runViewAudit(view.id);
      }
      // one extra view: the "+" add sheet, if the page has one (part of the chrome, not a role=tab)
      const plus = page.locator('#plusBtn, .plus, [data-open^="plus" i]').first();
      if ((await plus.count()) && (await plus.isVisible().catch(() => false))) {
        try {
          await plus.click({ timeout: 3000 });
          await page.waitForTimeout(350);
          await runViewAudit("+add");
        } catch (e) {
          findings.push({ view: "+add", rule: "nav-error", msg: `could not open the + sheet: ${e.message}`, sel: null, rect: null });
        }
      }
    }
  }

  for (const msg of new Set(consoleErrors)) findings.push({ view: "(any)", rule: "js-error", msg, sel: null, rect: null });

  await context.close();
  return findings;
}

function printReport(findings, rel) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const lines = [];
  const say = (s = "") => { console.log(s); lines.push(s); };
  say("=".repeat(72));
  say(`DESIGN QUALITY GATE - ${rel}`);
  say("=".repeat(72));
  if (!findings.length) {
    say("\nNo problems found: every rendered view (light/dark, 360/390/420, EN/ES, every tab)");
    say("passed contrast, tap-target, font-size, overlap, duplicate-control, broken-media");
    say("and heading-truncation checks.");
  } else {
    const byRule = new Map();
    for (const f of findings) { if (!byRule.has(f.rule)) byRule.set(f.rule, []); byRule.get(f.rule).push(f); }
    const order = ["load-error", "js-error", "audit-error", "audit-crash", "nav-error", "text-overlap", "overlap",
      "duplicate-control", "broken-image", "broken-svg", "empty-control", "invisible-control", "tap-target",
      "sideways-scroll", "contrast", "contrast-icon", "font-size", "heading-truncated"];
    const rules = [...byRule.keys()].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
    say(`\n${findings.length} problem(s) across ${rules.length} rule(s):\n`);
    for (const rule of rules) {
      const items = byRule.get(rule);
      say(`--- ${rule} (${items.length}) ---`);
      const shown = items.slice(0, 25);
      for (const f of shown) {
        const where = `${f.page} · ${f.theme} · ${f.width}px · ${f.lang} · view=${f.view}`;
        const shot = f.shot ? ` (see ${path.relative(ROOT, path.join(OUT_DIR, f.shot))})` : "";
        say(`  [${where}] ${f.msg}${f.sel ? " - " + f.sel : ""}${shot}`);
      }
      if (items.length > shown.length) say(`  ... and ${items.length - shown.length} more`);
      say("");
    }
  }
  say("=".repeat(72));
  fs.writeFileSync(path.join(OUT_DIR, "report.txt"), lines.join("\n") + "\n");
  console.log(`\nFull text report + failure screenshots: ${path.relative(ROOT, OUT_DIR)}/`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let chromium;
  try {
    ({ chromium } = require("/opt/node22/lib/node_modules/playwright"));
  } catch (e) {
    console.error("Playwright is not available at /opt/node22/lib/node_modules/playwright.");
    console.error("This gate needs a real Chromium - its checks run getComputedStyle/getBoundingClientRect");
    console.error("in-page for contrast and layout, so there is no lighter fallback the way shots.js has one.");
    console.error("Say so in the review rather than skipping it. (" + ((e && e.message) || e) + ")");
    process.exitCode = 2;
    return;
  }
  const executablePath = fs.existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
    ? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" : undefined;
  const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });

  const combos = [];
  for (const theme of FULL_THEMES) for (const width of WIDTHS) for (const lang of LANGS) {
    combos.push({ rel: args.rel, langKey: args.langKey, tabKey: args.tabKey, width, colorScheme: theme.colorScheme, themeAttr: theme.attr, themeName: theme.name, lang, fullSweep: true });
  }
  for (const theme of ATTR_SPOT_THEMES) for (const width of SPOT_WIDTHS) {
    combos.push({ rel: args.rel, langKey: args.langKey, tabKey: args.tabKey, width, colorScheme: theme.colorScheme, themeAttr: theme.attr, themeName: theme.name, lang: "en", fullSweep: false });
  }

  console.log(`Design quality gate - ${args.rel}`);
  console.log(`${combos.length} render passes (full light/dark tab sweep at 3 widths x 2 languages, plus a data-theme override spot-check)...\n`);

  const shared = { shotsTakenForRule: new Map() };
  const allFindings = [];
  for (const combo of combos) {
    const findings = await runOneContext(browser, combo, shared);
    for (const f of findings) allFindings.push(Object.assign({ page: combo.rel, theme: combo.themeName, width: combo.width, lang: combo.lang }, f));
  }
  await browser.close();

  printReport(allFindings, args.rel);
  process.exitCode = allFindings.length ? 1 : 0;
}

main().catch((e) => {
  console.error("design_gate.js crashed: " + ((e && e.stack) || e));
  process.exitCode = 2;
});
