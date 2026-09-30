/* Claude's Aldaba · core.js → window.A
   Events, storage, i18n, theme, formatting, motion (tween/spring/stagger/countUp/ripple/Timeline),
   the view router and the UI kit (icons, source tags, toasts, tooltips).
   Owner: foundation. API reference: CONTRACT.md. Every entry point is guarded: a failure warns, the page keeps working. */
(function () {
  'use strict';
  const A = (window.A = window.A || {});
  const root = document.documentElement;
  A.version = '1.0.0';
  A.data = window.NL || {};
  A.x = window.NLX || {};
  A.ready = false;

  /* ---------------- dev query params (never reach the published page) ---------------- */
  let Q;
  try { Q = new URLSearchParams(location.search); } catch (e) { Q = new URLSearchParams(''); }
  A.q = (k) => Q.get(k);

  /* ---------------- small utils ---------------- */
  A.safe = function (label, fn, ...args) {
    try { return fn(...args); } catch (e) { console.warn('[aldaba] ' + label + ' failed:', e); return undefined; }
  };
  A.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  A.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  A.lerp = (a, b, t) => a + (b - a) * t;
  A.$ = (sel, el) => (el || document).querySelector(sel);
  A.$$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  A.h = function (html) { const t = document.createElement('template'); t.innerHTML = String(html).trim(); return t.content.firstElementChild; };

  /* ---------------- events ---------------- */
  const bus = new Map();
  A.on = function (ev, fn) { if (!bus.has(ev)) bus.set(ev, new Set()); bus.get(ev).add(fn); return () => A.off(ev, fn); };
  A.off = function (ev, fn) { const s = bus.get(ev); if (s) s.delete(fn); };
  A.once = function (ev, fn) { const off = A.on(ev, (d) => { off(); fn(d); }); return off; };
  A.emit = function (ev, d) {
    const s = bus.get(ev); if (!s) return;
    for (const fn of Array.from(s)) { try { fn(d); } catch (e) { console.warn('[aldaba] listener for "' + ev + '" failed:', e); } }
  };

  /* ---------------- storage (per-viewer conveniences only) ---------------- */
  const NS = 'claudes-aldaba:';
  A.store = {
    get(k, d) { try { const v = localStorage.getItem(NS + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) { /* storage blocked: fine */ } },
    del(k) { try { localStorage.removeItem(NS + k); } catch (e) { /* ignore */ } },
    /** every key this app stored (without the namespace); the director snapshots them so the film never changes saved state */
    keys() { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(NS)) out.push(k.slice(NS.length)); } } catch (e) { /* blocked */ } return out; }
  };

  /* ---------------- still (reduced motion or ?still=1) ---------------- */
  let rmq = null;
  try { rmq = matchMedia('(prefers-reduced-motion: reduce)'); } catch (e) { /* old browser */ }
  const forceStill = Q.get('still') === '1';
  A.still = forceStill || !!(rmq && rmq.matches);
  root.classList.toggle('is-still', A.still);
  if (rmq && rmq.addEventListener) rmq.addEventListener('change', () => {
    A.still = forceStill || rmq.matches; root.classList.toggle('is-still', A.still); A.emit('still', A.still);
  });

  /* ---------------- i18n ---------------- */
  function pickLang() {
    const q = Q.get('lang'); if (q === 'es' || q === 'en') return q;
    const s = A.store.get('lang'); if (s === 'es' || s === 'en') return s;
    try { if ((navigator.language || '').toLowerCase().startsWith('es')) return 'es'; } catch (e) { /* ignore */ }
    return 'en';
  }
  A.lang = pickLang();
  root.dataset.lang = A.lang; root.lang = A.lang;
  /** A.t({en,es}) or A.t('en text','texto es') → string in the current language */
  A.t = function (a, b) {
    if (a && typeof a === 'object') return a[A.lang] != null ? a[A.lang] : (a.en != null ? a.en : '');
    if (b !== undefined) return A.lang === 'es' ? b : a;
    return a == null ? '' : String(a);
  };
  /** A.L('en html','es html') or A.L({en,es}) → both spans; CSS shows the right one. Not escaped (pass safe HTML). */
  A.L = function (a, b) {
    let en = a, es = b;
    if (a && typeof a === 'object') { en = a.en; es = a.es; }
    if (es == null) es = en;
    return '<span class="en">' + en + '</span><span class="es">' + es + '</span>';
  };
  /** A.both(() => A.fmt.date(d)) → the value rendered in EN and ES as A.L spans (escaped); survives a language switch */
  A.both = function (fn) {
    const keep = A.lang; let en = '', es = '';
    try { A.lang = 'en'; en = fn(); A.lang = 'es'; es = fn(); } catch (e) { console.warn('[aldaba] both() failed:', e); } finally { A.lang = keep; }
    return A.L(A.esc(en), A.esc(es));
  };
  A.setLang = function (l) {
    l = l === 'es' ? 'es' : 'en';
    if (l === A.lang) return;
    A.lang = l; root.dataset.lang = l; root.lang = l;
    if (!Q.get('lang')) A.store.set('lang', l);
    A.safe('localize', () => A.ui && A.ui.localize(document));
    A.emit('lang', l);
  };

  /* ---------------- theme ---------------- */
  const hostTheme = root.getAttribute('data-theme'); // the host may set one; "system" restores it
  let lightQ = null;
  try { lightQ = matchMedia('(prefers-color-scheme: light)'); } catch (e) { /* ignore */ }
  let tokCache = {};
  function resolveTheme() {
    const a = root.getAttribute('data-theme');
    if (a === 'light' || a === 'dark') return a;
    return lightQ && lightQ.matches ? 'light' : 'dark';
  }
  A.themeChoice = (function () {
    const q = Q.get('theme'); if (q === 'dark' || q === 'light' || q === 'system') return q;
    const s = A.store.get('theme'); if (s === 'dark' || s === 'light' || s === 'system') return s;
    return 'system';
  })();
  function applyTheme() {
    if (A.themeChoice === 'system') { if (hostTheme) root.setAttribute('data-theme', hostTheme); else root.removeAttribute('data-theme'); }
    else root.setAttribute('data-theme', A.themeChoice);
  }
  applyTheme();
  A.theme = resolveTheme();
  function themeMaybeChanged() {
    const t = resolveTheme();
    if (t !== A.theme) { A.theme = t; tokCache = {}; A.emit('theme', t); }
  }
  /** A.setTheme('dark'|'light'|'system') */
  A.setTheme = function (choice) {
    if (choice !== 'dark' && choice !== 'light') choice = 'system';
    A.themeChoice = choice;
    if (!Q.get('theme')) A.store.set('theme', choice);
    applyTheme(); themeMaybeChanged(); A.emit('theme:choice', choice);
  };
  if (lightQ && lightQ.addEventListener) lightQ.addEventListener('change', themeMaybeChanged);
  try { new MutationObserver(themeMaybeChanged).observe(root, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) { /* ignore */ }
  /** A.tok('--acc') → the resolved CSS value for the current theme (cached until the theme changes) */
  A.tok = function (name) {
    if (tokCache[name] !== undefined) return tokCache[name];
    let v = '';
    try { v = getComputedStyle(root).getPropertyValue(name).trim(); } catch (e) { /* ignore */ }
    tokCache[name] = v; return v;
  };
  const cctx = (function () { try { return document.createElement('canvas').getContext('2d'); } catch (e) { return null; } })();
  /** A.rgba('#f5883a' | 'rgba(..)' | '--acc') → [r,g,b,a] in 0..1 (for WebGL) */
  A.rgba = function (css) {
    if (css && css.startsWith('--')) css = A.tok(css);
    if (!css) return [0, 0, 0, 0];
    let s = css;
    if (cctx) { cctx.fillStyle = '#000'; cctx.fillStyle = css; s = cctx.fillStyle; }
    if (s[0] === '#') {
      const n = s.length === 4 ? s.slice(1).split('').map((c) => c + c).join('') : s.slice(1, 7);
      return [parseInt(n.slice(0, 2), 16) / 255, parseInt(n.slice(2, 4), 16) / 255, parseInt(n.slice(4, 6), 16) / 255, 1];
    }
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (m) { const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number); return [p[0] / 255, p[1] / 255, p[2] / 255, p[3] == null ? 1 : p[3]]; }
    return [0, 0, 0, 1];
  };

  /* ---------------- formatting (EN / ES) ---------------- */
  const MON = { en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] };
  const MONL = { en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'] };
  const DAY = { en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], es: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] };
  const DAYL = { en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] };
  const nfCache = {};
  function nf(d, l) {
    const k = l + d;
    if (!nfCache[k]) { try { nfCache[k] = new Intl.NumberFormat(l === 'es' ? 'es-US' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); } catch (e) { nfCache[k] = { format: (v) => Number(v).toFixed(d) }; } }
    return nfCache[k];
  }
  function parseDay(iso) { const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z'); return isNaN(d) ? null : d; }
  function hm(s) { const m = String(s).match(/(\d{1,2}):?(\d{2})?/); return m ? [+m[1], +(m[2] || 0)] : [0, 0]; }
  function clock12(h, m, l, withMer) {
    const hh = ((h + 11) % 12) + 1; const mm = m ? ':' + String(m).padStart(2, '0') : '';
    const mer = h < 12 ? (l === 'es' ? 'a. m.' : 'AM') : (l === 'es' ? 'p. m.' : 'PM');
    return hh + mm + (withMer === false ? '' : ' ' + mer);
  }
  A.fmt = {
    /** 1234.5 → "1,234.5" (es-US uses the same marks as the engine's Spanish text) */
    num(v, d = 0, l = A.lang) { return v == null || isNaN(v) ? '–' : nf(d, l).format(v); },
    int(v, l = A.lang) { return A.fmt.num(Math.round(v), 0, l); },
    /** 1.64 → "1.64 in" / "1.64 pulg" */
    inches(v, d = 2, l = A.lang) { return v == null ? '–' : A.fmt.num(v, d, l) + (l === 'es' ? ' pulg' : ' in'); },
    miles(v, d = 1, l = A.lang) { return v == null ? '–' : A.fmt.num(v, d, l) + ' mi'; },
    money(v, d = 0, l = A.lang) { return v == null ? '–' : (v < 0 ? '-$' : '$') + A.fmt.num(Math.abs(v), d, l); },
    pct(v, d = 0, l = A.lang) { return v == null ? '–' : A.fmt.num(v, d, l) + '%'; },
    /** date('2026-08-08') → "Aug 8" / "8 ago"; styles: short | day ("Sat, Aug 8") | long ("Saturday, August 8, 2026") | month ("August 2026") */
    date(iso, style = 'short', l = A.lang) {
      const d = parseDay(iso); if (!d) return '–';
      const M = d.getUTCMonth(), D = d.getUTCDate(), Y = d.getUTCFullYear(), W = d.getUTCDay();
      if (l === 'es') {
        if (style === 'day') return DAY.es[W] + ' ' + D + ' ' + MON.es[M];
        if (style === 'long') return DAYL.es[W] + ' ' + D + ' de ' + MONL.es[M] + ' de ' + Y;
        if (style === 'month') return MONL.es[M] + ' de ' + Y;
        return D + ' ' + MON.es[M];
      }
      if (style === 'day') return DAY.en[W] + ', ' + MON.en[M] + ' ' + D;
      if (style === 'long') return DAYL.en[W] + ', ' + MONL.en[M] + ' ' + D + ', ' + Y;
      if (style === 'month') return MONL.en[M] + ' ' + Y;
      return MON.en[M] + ' ' + D;
    },
    /** time('16:00') → "4 PM" / "4 p. m." */
    time(s, l = A.lang) { const [h, m] = hm(s); return clock12(h, m, l); },
    /** range('16:00','19:30') → "4-7:30 PM" / "4 a 7:30 p. m." */
    range(a, b, l = A.lang) {
      const [h1, m1] = hm(a), [h2, m2] = hm(b);
      const same = (h1 < 12) === (h2 < 12);
      if (l === 'es') return clock12(h1, m1, l, !same) + ' a ' + clock12(h2, m2, l);
      return clock12(h1, m1, l, !same) + (same ? '-' : ' - ') + clock12(h2, m2, l);
    },
    /** days between two ISO dates (b defaults to story today) */
    daysBetween(a, b) { const x = parseDay(a), y = parseDay(b || A.story.today); return x && y ? Math.round((y - x) / 864e5) : null; },
    /** the demo clock: "Tue, Sep 29 · 7:02 AM" / "mar 29 sep · 7:02 a. m." */
    clock(l = A.lang) { return A.fmt.date(A.story.today, 'day', l) + ' · ' + A.fmt.time(A.story.time, l); }
  };
  /** Story time: the whole app lives on the morning of NL.today at 7:02 AM */
  A.story = { today: (A.data && A.data.today) || '2026-09-29', time: '07:02' };

  /* ---------------- motion ---------------- */
  const M = (A.motion = {});
  const E = (M.ease = {
    linear: (t) => t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    outQuart: (t) => 1 - Math.pow(1 - t, 4),
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    inCubic: (t) => t * t * t
  });
  /** Underdamped spring normalised to t∈[0,1] (settles at t=1). zeta 0.68 → ~5% overshoot: the hail landing. */
  M.springEase = function (zeta = 0.68) {
    const w = 6.2 / zeta, wd = w * Math.sqrt(1 - zeta * zeta), k = (zeta * w) / wd;
    return (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + k * Math.sin(wd * t)));
  };
  E.hail = M.springEase(0.68);
  E.soft = M.springEase(0.85);
  M.css = { out: 'cubic-bezier(.16,1,.3,1)', ease: 'cubic-bezier(.2,.8,.2,1)', io: 'cubic-bezier(.65,0,.35,1)', hail: 'cubic-bezier(.34,1.3,.64,1)' };
  try {
    if (window.CSS && CSS.supports('transition-timing-function', 'linear(0, 1)')) {
      const pts = []; for (let i = 0; i <= 40; i++) pts.push(+E.hail(i / 40).toFixed(4));
      M.css.hail = 'linear(' + pts.join(',') + ')';
      root.style.setProperty('--ease-hail', M.css.hail);
    }
  } catch (e) { /* keep the cubic fallback */ }

  /* one shared rAF ticker; world.js runs on it too */
  const tick = { fns: new Set(), raf: 0, last: 0 };
  function loop(now) {
    // -1 while the frame runs: a callback that adds another (a timeline starting the next one) must not schedule a
    // second loop. Two loops would each run every callback, and each add inside a frame added one more: the film
    // piled up loops chapter by chapter until the page stalled.
    tick.raf = -1;
    const dt = tick.last ? Math.min(64, now - tick.last) : 16.7; tick.last = now;
    for (const fn of Array.from(tick.fns)) {
      let keep; try { keep = fn(now, dt); } catch (e) { console.warn('[aldaba] frame callback failed:', e); keep = false; }
      if (keep === false) tick.fns.delete(fn);
    }
    if (tick.fns.size) tick.raf = requestAnimationFrame(loop); else { tick.raf = 0; tick.last = 0; }
  }
  M.ticker = {
    add(fn) { tick.fns.add(fn); if (!tick.raf) tick.raf = requestAnimationFrame(loop); return () => tick.fns.delete(fn); },
    remove(fn) { tick.fns.delete(fn); },
    get size() { return tick.fns.size; }
  };
  function mkLerp(a, b) {
    if (typeof a === 'number') return (t) => a + (b - a) * t;
    if (Array.isArray(a)) return (t) => a.map((v, i) => v + (b[i] - v) * t);
    if (a && typeof a === 'object') { const ks = Object.keys(a); return (t) => { const o = {}; for (const k of ks) o[k] = a[k] + (b[k] - a[k]) * t; return o; }; }
    return (t) => (t < 1 ? a : b);
  }
  /** tween({from,to,ms,delay,ease,update(v,k)}) → Promise<boolean finished> with .cancel() */
  M.tween = function (o = {}) {
    const from = o.from == null ? 0 : o.from, to = o.to == null ? 1 : o.to, ms = o.ms == null ? 240 : o.ms, delay = o.delay || 0;
    const ease = typeof o.ease === 'function' ? o.ease : E[o.ease] || E.outCubic;
    const lerp = mkLerp(from, to);
    let cancel = () => {};
    const p = new Promise((res) => {
      if (A.still || ms <= 0) { A.safe('tween', () => o.update && o.update(lerp(1), 1)); res(true); return; }
      let t0 = null, dead = false;
      const fn = (now) => {
        if (dead) return false;
        if (t0 === null) t0 = now + delay;
        if (now < t0) return true;
        const k = Math.min(1, (now - t0) / ms);
        if (o.update) o.update(lerp(ease(k)), k);
        if (k >= 1) { dead = true; res(true); return false; }
        return true;
      };
      cancel = () => { if (dead) return; dead = true; M.ticker.remove(fn); res(false); };
      M.ticker.add(fn);
    });
    p.cancel = () => cancel();
    return p;
  };
  /** spring({from,to,k,c,m,v,update}) physical spring (k stiffness, c damping) → Promise with .cancel() */
  M.spring = function (o = {}) {
    let x = o.from == null ? 0 : o.from, v = o.v || 0;
    const to = o.to == null ? 1 : o.to, k = o.k || 170, c = o.c || 20, m = o.m || 1, eps = o.precision || 0.001;
    let cancel = () => {};
    const p = new Promise((res) => {
      if (A.still) { o.update && o.update(to); res(true); return; }
      let dead = false;
      const fn = (now, dt) => {
        if (dead) return false;
        let rem = dt / 1000;
        while (rem > 0) { const h = Math.min(rem, 0.004); const a = (-k * (x - to) - c * v) / m; v += a * h; x += v * h; rem -= h; }
        const done = Math.abs(v) < eps && Math.abs(x - to) < eps;
        if (done) x = to;
        o.update && o.update(x, v);
        if (done) { dead = true; res(true); return false; }
        return true;
      };
      cancel = () => { if (!dead) { dead = true; M.ticker.remove(fn); res(false); } };
      M.ticker.add(fn);
    });
    p.cancel = () => cancel();
    return p;
  };
  function order(from, i, n) {
    if (typeof from === 'function') return from(i, n);
    if (from === 'center') return Math.abs(i - (n - 1) / 2);
    if (from === 'end') return n - 1 - i;
    if (typeof from === 'number') return Math.abs(i - from);
    return i;
  }
  /** stagger(els,{from:'start'|'center'|'end'|index|fn, each:40, y:10, ms:520, delay:0, scale}) → things fall in like hail */
  M.stagger = function (els, o = {}) {
    const list = Array.from(els || []).filter((e) => e && e.animate);
    if (!list.length || A.still) return Promise.resolve();
    const each = o.each == null ? 40 : o.each, y = o.y == null ? 10 : o.y, ms = o.ms || 520, delay = o.delay || 0, n = list.length;
    return Promise.all(list.map((el, i) => {
      const d = delay + order(o.from || 'start', i, n) * each;
      try {
        const k0 = { translate: '0 ' + -y + 'px' }, k1 = { translate: '0 0' };
        if (o.scale && o.scale !== 1) { k0.scale = String(o.scale); k1.scale = '1'; }
        const a = el.animate([k0, k1], { duration: ms, delay: d, easing: M.css.hail, fill: 'backwards' });
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: Math.min(260, ms * 0.5), delay: d, easing: M.css.out, fill: 'backwards' });
        return a.finished.catch(() => {});
      } catch (e) { return null; }
    }));
  };
  /** reveal(el,{y,ms,delay,ring}) one element lands; ring:true rings out at the moment of impact */
  M.reveal = function (el, o = {}) {
    if (!el) return Promise.resolve();
    const p = M.stagger([el], Object.assign({ y: 14 }, o));
    if (o.ring && !A.still) setTimeout(() => M.ripple(el, { rings: 1, size: o.size }), (o.delay || 0) + (o.ms || 520) * 0.32);
    return p;
  };
  /** exit(els,{ms:140,y:6}) quick fade + drift down; resolves when gone (does not remove) */
  M.exit = function (els, o = {}) {
    const list = Array.from(els || []).filter((e) => e && e.animate);
    if (!list.length || A.still) return Promise.resolve();
    const ms = o.ms || 140, y = o.y == null ? 6 : o.y;
    return Promise.all(list.map((el) => {
      try { return el.animate([{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '0 ' + y + 'px' }], { duration: ms, easing: M.css.ease, fill: 'forwards' }).finished.catch(() => {}); } catch (e) { return null; }
    }));
  };
  let fxLayer = null;
  function fx() { return fxLayer || (fxLayer = document.getElementById('fx') || document.body); }
  /** ripple(el | event | x,y, {rings:2, size, color, inside}) the knock: thin rings ring out from the tap */
  M.ripple = function (a, b, c) {
    if (A.still) return;
    let x, y, o = {};
    if (typeof a === 'number') { x = a; y = b; o = c || {}; }
    else if (a && a.clientX !== undefined) { x = a.clientX; y = a.clientY; o = b || {}; }
    else if (a && a.getBoundingClientRect) { const r = a.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; o = b || {}; }
    else return;
    const host = o.inside || null; let ox = 0, oy = 0;
    if (host) { const r = host.getBoundingClientRect(); ox = r.left; oy = r.top; }
    const rings = o.rings == null ? 2 : o.rings, size = o.size || 44;
    for (let i = 0; i < rings; i++) {
      const s = document.createElement('span');
      s.className = 'knock';
      s.style.left = (x - ox) + 'px'; s.style.top = (y - oy) + 'px'; s.style.setProperty('--s', size + 'px');
      if (o.color) s.style.borderColor = o.color;
      (host || fx()).appendChild(s);
      try {
        const an = s.animate([{ transform: 'scale(.18)', opacity: 0.9 }, { transform: 'scale(1)', opacity: 0 }], { duration: 640, delay: i * 120, easing: M.css.out, fill: 'both' });
        an.onfinish = () => s.remove(); an.oncancel = () => s.remove();
      } catch (e) { s.remove(); }
    }
  };
  /** countUp(el, to, {from, decimals, ms, format(v)→string, delay}) odometer: each digit rolls and lands */
  M.countUp = function (el, to, o = {}) {
    if (!el) return Promise.resolve();
    const dec = o.decimals || 0, fmt = o.format || ((v) => A.fmt.num(v, dec));
    const finalTxt = fmt(to);
    el.setAttribute('aria-label', finalTxt);
    if (A.still || !el.animate) { el.textContent = finalTxt; return Promise.resolve(); }
    const fromTxt = fmt(o.from == null ? 0 : o.from).padStart(finalTxt.length, ' ');
    el.textContent = '';
    const cols = [];
    const chars = finalTxt.split('');
    chars.forEach((ch, i) => {
      if (!/\d/.test(ch)) { const s = document.createElement('span'); s.textContent = ch; s.setAttribute('aria-hidden', 'true'); el.appendChild(s); return; }
      const w = document.createElement('span'); w.className = 'odo'; w.setAttribute('aria-hidden', 'true');
      w.style.cssText = 'display:inline-block;height:1.1em;line-height:1.1em;overflow:hidden;vertical-align:bottom';
      const strip = document.createElement('span'); strip.style.cssText = 'display:block;will-change:transform';
      let html = ''; for (let r = 0; r < 3; r++) for (let d = 0; d < 10; d++) html += '<span style="display:block;height:1.1em">' + d + '</span>';
      strip.innerHTML = html; w.appendChild(strip); el.appendChild(w);
      const fd = /\d/.test(fromTxt[i]) ? +fromTxt[i] : 0;
      cols.push({ strip, fd, td: +ch, pos: i });
    });
    const n = cols.length, ms = o.ms || 1100, delay = o.delay || 0;
    return Promise.all(cols.map((c, j) => {
      const spins = Math.min(2, n - 1 - j + (c.fd === c.td ? 0 : 0)); // least significant digits spin the most
      const start = c.fd, end = 10 * Math.max(1, spins) + c.td;
      try {
        const a = c.strip.animate([{ transform: 'translateY(' + (-start / 30) * 100 + '%)' }, { transform: 'translateY(' + (-end / 30) * 100 + '%)' }],
          { duration: ms - (n - 1 - j) * 50, delay: delay + j * 45, easing: M.css.hail, fill: 'both' });
        return a.finished.catch(() => {});
      } catch (e) { return null; }
    })).then(() => { if (el.isConnected) el.textContent = finalTxt; });
  };

  /** Timeline: a seekable cue sheet for the intro and the director.
      tl.add(at, fn)                → cue fired once when the playhead passes `at` (ms). fn(tl, {seeking})
      tl.add(at, {ms, update(p), ease}) → tween track, scrubbable (update gets eased 0..1)
      tl.play() → Promise (resolves at end, or on stop/skip); tl.pause(); tl.seek(ms); tl.skip(); tl.stop(); tl.onEnd(fn) */
  /* new Timeline({realtime:true}) keeps real time under A.still (the director: captions still need reading time);
     every other timeline jumps to its end when A.still is on. */
  class Timeline {
    constructor(o = {}) { this.items = []; this.t = 0; this.playing = false; this.rate = o.rate || 1; this.realtime = !!o.realtime; this._end = []; this._res = null; this._fn = null; }
    add(at, x) {
      const it = typeof x === 'function' ? { at, fn: x, fired: false } : { at, ms: Math.max(1, x.ms || 1), update: x.update, ease: typeof x.ease === 'function' ? x.ease : E[x.ease] || E.inOutCubic, last: -1 };
      this.items.push(it); this.items.sort((a, b) => a.at - b.at); return this;
    }
    get duration() { return this.items.reduce((m, it) => Math.max(m, it.at + (it.ms || 0)), 0); }
    get time() { return this.t; }
    onEnd(fn) { this._end.push(fn); return this; }
    _apply(prev, now, seeking) {
      for (const it of this.items) {
        if (it.fn) {
          if (!it.fired && it.at <= now && (it.at > prev || prev === 0 || seeking)) { it.fired = true; A.safe('timeline cue', () => it.fn(this, { seeking: !!seeking })); }
        } else if (it.update) {
          const p = A.clamp((now - it.at) / it.ms, 0, 1);
          if (now >= it.at || it.last > 0) { if (p !== it.last) { it.last = p; A.safe('timeline track', () => it.update(it.ease(p), p)); } }
        }
      }
    }
    play() {
      if (this.playing) return this._p;
      this.playing = true;
      this._p = new Promise((res) => { this._res = res; });
      if (A.still && !this.realtime) { this.skip(); return this._p; }
      let first = this.t === 0;
      this._fn = (now, dt) => {
        if (!this.playing) return false;
        const prev = this.t; this.t = Math.min(this.duration, this.t + dt * this.rate);
        this._apply(first ? 0 : prev, this.t, false); first = false;
        if (this.t >= this.duration) { this._finish(true); return false; }
        return true;
      };
      M.ticker.add(this._fn);
      return this._p;
    }
    pause() { this.playing = false; if (this._fn) M.ticker.remove(this._fn); }
    seek(ms) {
      const prev = this.t; this.t = A.clamp(ms, 0, this.duration);
      if (this.t < prev) for (const it of this.items) if (it.fn && it.at > this.t) it.fired = false;
      this._apply(prev, this.t, true);
      return this;
    }
    skip() { this.seek(this.duration); this._finish(true); }
    stop() { this._finish(false); }
    _finish(done) {
      const was = this._res; this.pause(); this._res = null;
      if (was) { for (const fn of this._end) A.safe('timeline end', () => fn(done)); was(done); }
    }
  }
  M.Timeline = Timeline;

  /* ---------------- UI kit ---------------- */
  const UI = (A.ui = {});
  const IC = {
    pin: '<path d="M12 21s-6.5-6.1-6.5-11A6.5 6.5 0 0 1 18.5 10c0 4.9-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    door: '<path d="M6 21V4.6A1.6 1.6 0 0 1 7.6 3h8.8A1.6 1.6 0 0 1 18 4.6V21"/><path d="M3.5 21h17"/><circle cx="12" cy="10.5" r="2.4"/><path d="M12 6.2v1.9"/>',
    car: '<path d="M5 16.5v-4.2l1.7-4.5A2 2 0 0 1 8.6 6.5h6.8a2 2 0 0 1 1.9 1.3l1.7 4.5v4.2"/><path d="M4 12.3h16"/><path d="M5 16.5h14"/><circle cx="8" cy="16.8" r="1.7"/><circle cx="16" cy="16.8" r="1.7"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    storm: '<path d="M7.2 16.5a4.3 4.3 0 1 1 .7-8.5 5.3 5.3 0 0 1 10.2 1.6 3.5 3.5 0 0 1-.6 6.9"/><path d="M12.6 12.5 10.8 16h3l-1.8 3.5"/>',
    hail: '<path d="M7.2 14a4.3 4.3 0 1 1 .7-8.5 5.3 5.3 0 0 1 10.2 1.6A3.5 3.5 0 0 1 17.5 14z"/><circle cx="8.5" cy="18.3" r="1.3"/><circle cx="12.5" cy="20" r="1.3"/><circle cx="16" cy="17.8" r="1.3"/>',
    shield: '<path d="M12 3.2 19 6v5.4c0 4.4-2.9 8-7 9.4-4.1-1.4-7-5-7-9.4V6z"/><path d="m9 12 2.1 2.1L15.2 10"/>',
    doc: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M9.6 12h5.8M9.6 15.5h5.8"/>',
    pen: '<path d="m4.5 19.5 1-4L16 5a2.1 2.1 0 0 1 3 3L8.5 18.5z"/><path d="m14 7 3 3"/><path d="M13 20h7"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    phone: '<path d="M5.2 4h3.2l1.7 4.3-2.2 1.3a11 11 0 0 0 6.5 6.5l1.3-2.2 4.3 1.7v3.2a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.7 5.6 1.5 1.5 0 0 1 5.2 4z"/>',
    camera: '<path d="M4 8h3.4L9 5.5h6L16.6 8H20v11H4z"/><circle cx="12" cy="13.2" r="3.4"/>',
    route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16"/>',
    spark: '<path d="M11 3.5 12.8 8.7 18 10.5 12.8 12.3 11 17.5 9.2 12.3 4 10.5 9.2 8.7z"/><path d="M18.5 15.5v5M16 18h5"/>',
    chevron: '<path d="m9.5 6 6 6-6 6"/>',
    play: '<path d="M8 5.8v12.4a.8.8 0 0 0 1.2.7l9.6-6.2a.8.8 0 0 0 0-1.4L9.2 5.1A.8.8 0 0 0 8 5.8z"/>',
    pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
    sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3v1.8M12 19.2V21M5.6 5.6l1.3 1.3M17.1 17.1l1.3 1.3M3 12h1.8M19.2 12H21M5.6 18.4l1.3-1.3M17.1 6.9l1.3-1.3"/>',
    moon: '<path d="M19.5 14.6A7.8 7.8 0 1 1 9.4 4.5a6.2 6.2 0 0 0 10.1 10.1z"/>',
    system: '<circle cx="12" cy="12" r="8.2"/><path d="M12 3.8a8.2 8.2 0 0 1 0 16.4z" fill="currentColor" stroke="none"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.6 3.5 5.4 3.5 8.5s-1.1 5.9-3.5 8.5c-2.4-2.6-3.5-5.4-3.5-8.5S9.6 6.1 12 3.5z"/>',
    layers: '<path d="m12 4 8.5 4.5L12 13 3.5 8.5z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5"/><path d="m3.5 16.5 8.5 4.5 8.5-4.5"/>',
    dollar: '<path d="M12 3v18"/><path d="M16.3 7.6c-.8-1.3-2.3-2-4.3-2-2.5 0-4.2 1.3-4.2 3.1 0 4.3 8.7 2.4 8.7 6.6 0 1.9-1.8 3.3-4.6 3.3-2.1 0-3.8-.8-4.6-2.2"/>',
    flag: '<path d="M5.5 21V4"/><path d="M5.5 4.5h11l-2 4 2 4h-11"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.3"/><path d="M12 7.7h.01" stroke-width="2.4"/>',
    plus: '<path d="M12 5.5v13M5.5 12h13"/>',
    minus: '<path d="M5.5 12h13"/>',
    target: '<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="7.8"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    home: '<path d="m4 11 8-6.5 8 6.5"/><path d="M6.2 9.4V20h11.6V9.4"/><path d="M10 20v-5h4v5"/>',
    ring: '<circle cx="12" cy="13.5" r="5.5"/><path d="m5 8.5 7-5 7 5"/>',
    film: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M10 9.3v5.4l4.6-2.7z"/>',
    sound: '<path d="M4.5 9.5h3.2L12 5.8v12.4l-4.3-3.7H4.5z"/><path d="M15.4 9.2a4 4 0 0 1 0 5.6"/><path d="M17.9 6.7a7.6 7.6 0 0 1 0 10.6"/>',
    mute: '<path d="M4.5 9.5h3.2L12 5.8v12.4l-4.3-3.7H4.5z"/><path d="m15.5 9.5 5 5M20.5 9.5l-5 5"/>',
    prev: '<path d="M6.5 5.5v13"/><path d="M18 6.2v11.6a.7.7 0 0 1-1.1.6L9 12.6a.7.7 0 0 1 0-1.2l7.9-5.8a.7.7 0 0 1 1.1.6z"/>',
    next: '<path d="M17.5 5.5v13"/><path d="M6 6.2v11.6a.7.7 0 0 0 1.1.6l7.9-5.8a.7.7 0 0 0 0-1.2L7.1 5.6A.7.7 0 0 0 6 6.2z"/>',
    keys: '<rect x="2.8" y="6.5" width="18.4" height="11" rx="2.2"/><path d="M6.5 10h.01M9.5 10h.01M12.5 10h.01M15.5 10h.01M8 14h8"/>'
  };
  UI.iconNames = Object.keys(IC);
  /** icon('door',{size:18, cls}) → inline stroke SVG string */
  UI.icon = function (name, o = {}) {
    const p = IC[name] || IC.info, s = o.size || 18;
    return '<svg class="i' + (o.cls ? ' ' + o.cls : '') + '" viewBox="0 0 24 24" width="' + s + '" height="' + s + '" aria-hidden="true" focusable="false">' + p + '</svg>';
  };
  /** replaces every <i data-icon="name"></i> inside el with the SVG */
  UI.icons = function (el) {
    A.$$('[data-icon]', el || document).forEach((n) => { if (n.tagName === 'I') n.outerHTML = UI.icon(n.dataset.icon, { size: +n.dataset.size || 18, cls: n.className || '' }); });
  };

  /* sources: every number says who said it */
  const X = A.x || {}, N = A.data || {}, S26 = X.storms2026 || {};
  const srcById = {}; (S26.sources || []).forEach((s) => (srcById[s.id] = s));
  const SRC = {
    storms: { label: 'NOAA', en: (N.src && N.src.storms) || 'NOAA SPC storm reports + MRMS radar hail estimates', es: 'Reportes de tormenta de NOAA SPC + estimados de granizo por radar MRMS (motor hh.py)' },
    spc: { label: 'SPC', en: 'NOAA Storm Prediction Center reports', es: 'Reportes del Centro de Predicción de Tormentas de NOAA' },
    lsr: { label: 'NWS', en: 'NWS Local Storm Reports', es: 'Reportes locales de tormenta del NWS' },
    ncei: { label: 'NCEI', en: 'NOAA NCEI Storm Events database', es: 'Base de datos de eventos de tormenta de NOAA NCEI' },
    radar: { label: 'NEXRAD', en: 'NOAA NCEI NEXRAD hail signatures (SWDI)', es: 'Firmas de granizo del radar NEXRAD de NOAA NCEI (SWDI)' },
    mrms: { label: 'MRMS', en: 'NOAA MRMS MESH radar hail size', es: 'Tamaño de granizo por radar MRMS MESH de NOAA' },
    census: { label: 'Census', labelEs: 'Censo', en: 'US Census ACS 5-year ' + (S26.census_vintage || '2024') + ' + TIGER', es: 'Censo de EE. UU., ACS de 5 años ' + (S26.census_vintage || '2024') + ' + TIGER' },
    streets: { label: 'NE GIS', en: (N.src && N.src.streets) || 'Nebraska GIS street centerlines', es: 'Ejes de calles de Nebraska GIS (gis.ne.gov)' },
    base: { label: 'NE GIS', en: (N.src && N.src.base) || 'Nebraska GIS', es: 'Nebraska GIS: condados, municipios (Censo TIGER), ríos y cuerpos de agua (USGS NHD), ferrocarriles y carreteras (NDOT). Simplificado.' },
    homes: { label: 'sample', labelEs: 'muestra', cls: 'sample', en: 'Sample home: a fake address on a real street until knocking starts. No owner names.', es: 'Casa de muestra: dirección falsa en una calle real hasta empezar a tocar puertas. Sin nombres de dueños.' },
    engine: { label: 'engine', labelEs: 'motor', en: 'Aldaba score from the HailHunter engine (hh.py): hail size, roof age, owner-lived share, distance', es: 'Puntaje de Aldaba del motor HailHunter (hh.py): tamaño del granizo, edad del techo, casas habitadas por sus dueños, distancia' },
    law: { label: 'Neb. law', labelEs: 'ley Neb.', cls: 'src--law', en: 'Nebraska Revised Statutes (text in docs/legal)', es: 'Estatutos Revisados de Nebraska (texto en docs/legal)' },
    goal: { label: 'goal', labelEs: 'meta', cls: 'src--goal', en: 'Goal set by FilthE: $100k by the end of 2026', es: 'Meta de FilthE: $100 mil para fines de 2026' },
    hmp: { label: 'HMP', cls: 'src--hmp', en: 'HMP Siding & Roofing LLC, Fremont, NE', es: 'HMP Siding & Roofing LLC, Fremont, NE' },
    bench: { label: 'bench', labelEs: 'industria', cls: 'src--bench', en: 'Industry benchmark from vendor figures, not HMP results. HMP’s own numbers replace it after about 200 doors.', es: 'Cifra de la industria tomada de proveedores, no un resultado de HMP. Los números propios de HMP la reemplazan después de unas 200 puertas.' },
    log: { label: 'log', labelEs: 'registro', cls: 'src--log', en: 'Your own log, kept on this device.', es: 'Tu propio registro, guardado en este equipo.' }
  };
  UI.sources = SRC;
  /* labels that are words (not names like NOAA or MRMS) read in Spanish too, including the ones views pass themselves */
  const LABEL_ES = { sample: 'muestra', engine: 'motor', model: 'modelo', goal: 'meta', bench: 'industria', log: 'registro', example: 'ejemplo', estimate: 'estimado', census: 'Censo', 'neb. law': 'ley Neb.', law: 'ley' };
  const labelPair = (l, les) => {
    if (l && typeof l === 'object') return [String(l.en == null ? '' : l.en), String(l.es == null ? l.en : l.es)];
    l = String(l == null ? '' : l);
    return [l, les != null ? String(les) : (LABEL_ES[l.toLowerCase()] || l)];
  };
  /** srcTag('spc' | {label, labelEs, tip:{en,es}, cls} | 'free text', {label, note:{en,es}}) → tiny mono pill, EN/ES; hover
      or focus names the source. Labels may be {en,es}; common words translate by themselves. `note` adds specifics after
      the key's text (e.g. srcTag('bench', {note:{en:'Source: spotio.com.', es:'Fuente: spotio.com.'}})). */
  UI.srcTag = function (k, o = {}) {
    let s = typeof k === 'string' ? SRC[k] : null;
    if (!s && k && typeof k === 'object') s = { label: k.label, labelEs: k.labelEs, en: k.tip ? k.tip.en : String(k.label && k.label.en || k.label), es: k.tip ? k.tip.es : String(k.label && k.label.es || k.label), cls: k.cls };
    if (!s) s = { label: String(k), en: String(k), es: String(k) };
    let en = s.en, es = s.es || s.en;
    if (o.note) { en += ' ' + (o.note.en || ''); es += ' ' + (o.note.es || o.note.en || ''); }
    const cls = s.cls === 'sample' ? 'sample' : 'src' + (s.cls ? ' ' + s.cls : '');
    const lb = o.label != null ? labelPair(o.label, o.labelEs) : labelPair(s.label, s.labelEs);
    const txt = lb[0] === lb[1] ? A.esc(lb[0]) : A.L(A.esc(lb[0]), A.esc(lb[1]));
    return '<span class="' + cls + '" tabindex="0" role="note" data-tip="' + A.esc(en.trim()) + '" data-tip-es="' + A.esc(es.trim()) + '">' + txt + '</span>';
  };
  UI.sampleTag = function () {
    return '<span class="sample" tabindex="0" role="note" data-tip="' + A.esc(SRC.homes.en) + '" data-tip-es="' + A.esc(SRC.homes.es) + '">' + A.L('sample', 'muestra') + '</span>';
  };
  /** hail size → token name for color: '--h0' <1, '--h1' 1-1.49, '--h15' 1.5-1.99, '--h2' 2+ */
  UI.hailTok = (v) => (v == null || v < 1 ? '--h0' : v < 1.5 ? '--h1' : v < 2 ? '--h15' : '--h2');
  /** the same, for TEXT: '--h1-ink' etc. (darker in light so numbers stay readable on cream) */
  UI.hailInk = (v) => UI.hailTok(v) + '-ink';
  UI.hailKey = (v) => (v == null || v < 1 ? '0' : v < 1.5 ? '1' : v < 2 ? '15' : '2');

  /* tooltip: one floating tip for every [data-tip] (reads data-tip-es in Spanish) */
  let tipEl = null, tipFor = null;
  function showTip(t) {
    const txt = A.lang === 'es' && t.dataset.tipEs ? t.dataset.tipEs : t.dataset.tip;
    if (!txt) return;
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; tipEl.setAttribute('role', 'tooltip'); tipEl.id = 'tip'; fx().appendChild(tipEl); }
    tipFor = t; tipEl.textContent = txt;
    const r = t.getBoundingClientRect(), tw = Math.min(290, tipEl.offsetWidth || 200), th = tipEl.offsetHeight || 30;
    let x = r.left + r.width / 2 - tw / 2; x = A.clamp(x, 8, innerWidth - tw - 8);
    let y = r.bottom + 8; if (y + th > innerHeight - 8) y = r.top - th - 8;
    tipEl.style.translate = Math.round(x) + 'px ' + Math.round(y) + 'px';
    tipEl.classList.add('is-on'); t.setAttribute('aria-describedby', 'tip');
  }
  function hideTip() { if (tipEl) tipEl.classList.remove('is-on'); if (tipFor) tipFor.removeAttribute('aria-describedby'); tipFor = null; }
  UI.hideTip = hideTip;
  document.addEventListener('pointerover', (e) => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t && t !== tipFor) showTip(t); else if (!t && tipFor) hideTip(); }, { passive: true });
  document.addEventListener('focusin', (e) => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t) showTip(t); else hideTip(); });
  document.addEventListener('focusout', hideTip);
  addEventListener('scroll', hideTip, { passive: true, capture: true });

  /** toast({en,es} | 'text', {ms:2800, icon:'info'}) */
  UI.toast = function (msg, o = {}) {
    let box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.className = 'toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const t = document.createElement('div'); t.className = 'toast';
    const txt = typeof msg === 'object' ? A.L(A.esc(msg.en), A.esc(msg.es || msg.en)) : A.esc(msg);
    t.innerHTML = UI.icon(o.icon || 'info', { size: 16 }) + '<span>' + txt + '</span>';
    box.appendChild(t); M.reveal(t, { y: 12 });
    const kill = () => M.exit([t], { ms: 160 }).then(() => t.remove());
    setTimeout(kill, o.ms || 2800);
    return t;
  };

  /** localize(el): aria-labels from data-label-en / data-label-es */
  UI.localize = function (el) {
    A.$$('[data-label-en]', el || document).forEach((n) => n.setAttribute('aria-label', A.lang === 'es' && n.dataset.labelEs ? n.dataset.labelEs : n.dataset.labelEn));
  };
  /** chrome(false) hides the top bar + panels (intro / film); chrome(true) brings them back */
  UI.chrome = function (on) { root.classList.toggle('no-chrome', !on); };

  /* taps ripple like a knock */
  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || A.still) return;
    const el = e.target.closest && e.target.closest('.btn, .seg>button, .hud__btns button, button.row, a.row, button.chip, [data-knock]');
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (el.matches('.btn, .seg>button, .hud__btns button, button.row, a.row')) M.ripple(e, { inside: el, rings: 2, size: Math.max(r.width, r.height) * 1.1 });
    else M.ripple(e, { rings: 2, size: 36 });
  }, { passive: true });

  /* ---------------- sound: one switch (top bar speaker, the film's mute, the M key) ---------------- */
  /* window.Sound (js/lib/sound.js) makes the sounds; this remembers the viewer's choice. Browsers only start audio from a
     click or key, so a remembered "on" waits for the first gesture on the page. */
  const SND = 'sound';
  A.sound = {
    /** the viewer's choice: true, false, or null (never chosen) */
    get pref() { const v = A.store.get(SND, null); return v === true || v === false ? v : null; },
    /** sound is playing now */
    get on() { return !!(window.Sound && window.Sound.enabled); },
    /** what the switch shows: playing, or chosen and waiting for the first gesture */
    get shown() { return A.sound.on || A.sound.pref === true; },
    get supported() { return !!(window.Sound && window.Sound.supported); },
    /** set(true|false) from a click or key (a user gesture), so the audio context may start */
    set(on) {
      on = !!on; A.store.set(SND, on);
      const S = window.Sound;
      if (S) A.safe('sound', () => (on ? S.enable() : S.disable()));
      A.emit('sound', on);
      return on;
    },
    toggle() { return A.sound.set(!A.sound.shown); }
  };
  (function armSound() {
    if (A.sound.pref !== true) return;
    const evs = ['pointerdown', 'keydown'];
    const go = (e) => {
      const t = e && e.target;
      if (t && t.closest && t.closest('#sound')) return;          // the switch's own click decides
      if (e && e.type === 'keydown' && (e.key === 'm' || e.key === 'M')) return;
      evs.forEach((n) => document.removeEventListener(n, go, true));
      if (A.sound.pref === true && window.Sound && !window.Sound.enabled) A.safe('sound', () => { window.Sound.enable(); A.emit('sound', true); });
    };
    evs.forEach((n) => document.addEventListener(n, go, true));
  })();

  /* ---------------- views: the router ---------------- */
  const views = new Map(); const order5 = [];
  let cur = null, token = 0, ctxCur = null;
  const slotIds = ['left', 'right', 'bottom', 'center', 'overlay'];
  const slots = {};
  function slotEls() { if (!slots.left) slotIds.forEach((k) => (slots[k] = document.getElementById('slot-' + k))); return slots; }
  function stacked() { try { return matchMedia('(max-width: 900px)').matches; } catch (e) { return false; } }
  A.stacked = stacked;

  /* a slot shows its surface only while it holds something; surfaces land and leave with motion */
  function syncSlot(k, animate) {
    const el = slotEls()[k]; if (!el) return;
    const has = el.childElementCount > 0, on = el.hasAttribute('data-on');
    const surface = k !== 'center' && k !== 'overlay';
    if (has) {
      if (el._leaving) { el._leaving = false; try { el.getAnimations().forEach((a) => a.cancel()); } catch (e) { /* ignore */ } }
      if (!on) { el.setAttribute('data-on', ''); if (animate && surface) M.reveal(el, { y: k === 'bottom' ? -14 : 12, ms: 560 }); }
    } else if (on) {
      if (animate && !A.still && surface) {
        if (el._leaving) return;
        el._leaving = true;
        M.exit([el], { ms: 150 }).then(() => {
          if (!el._leaving) return;
          el._leaving = false;
          if (!el.childElementCount) el.removeAttribute('data-on');
          try { el.getAnimations().forEach((a) => a.cancel()); } catch (e) { /* ignore */ }
          if (A.view && A.world && A.world.setInset) A.world.setInset(measureInset(), { ms: 300 });
        });
      } else el.removeAttribute('data-on');
    }
  }
  function syncSlots(animate) { slotIds.forEach((k) => syncSlot(k, animate)); }
  /* reserved screen edges (css px from the viewport's top / bottom) that the map's focus area and HUD keep clear of,
     e.g. the film's letterbox. Set with A.view.reserve({t, b}); A.view.reserve() clears it. */
  let reserved = { t: 0, b: 0 };
  function measureInset() {
    const s = slotEls(), W = A.world;
    if (!W || !W.el) return { l: 0, r: 0, t: 0, b: 0 };
    if (stacked()) return { l: 0, r: 0, t: 0, b: 0 };
    const wr = W.el.getBoundingClientRect(), bar = document.getElementById('topbar');
    const ins = { l: 0, r: 0, t: 0, b: 0 };
    if (bar) ins.t = Math.max(0, bar.getBoundingClientRect().bottom - wr.top + 6);
    const on = (n) => n && n.hasAttribute('data-on') && !n._leaving;
    if (on(s.left)) ins.l = Math.max(0, s.left.getBoundingClientRect().right - wr.left + 6);
    if (on(s.right)) ins.r = Math.max(0, wr.right - s.right.getBoundingClientRect().left + 6);
    if (on(s.bottom)) ins.b = Math.max(0, wr.bottom - s.bottom.getBoundingClientRect().top + 6);
    // the map HUD (zoom, scale) sits bottom-right; a short right panel leaves that corner free
    ins.hudR = on(s.right) && s.right.getBoundingClientRect().bottom > wr.bottom - 170 ? ins.r : 0;
    ins.hudB = on(s.bottom) && s.bottom.getBoundingClientRect().right > wr.right - 140 ? ins.b : 0;
    if (reserved.t) ins.t = Math.max(ins.t, reserved.t - wr.top + 6);
    if (reserved.b) { const rb = Math.max(0, wr.bottom - (innerHeight - reserved.b)) + 6; ins.b = Math.max(ins.b, rb); ins.hudB = Math.max(ins.hudB, rb); }
    return ins;
  }
  A.measureInset = measureInset;

  function makeCtx(v) {
    const my = token, clean = [];
    const ctx = {
      name: v.name, slots: slotEls(), world: A.world, data: A.data, x: A.x,
      get lang() { return A.lang; }, get still() { return A.still; },
      alive: () => my === token,
      own(fn) { clean.push(fn); return fn; },
      on(ev, fn) { const off = A.on(ev, fn); clean.push(off); return off; },
      timer(fn, ms) { const id = setTimeout(() => { if (my === token) A.safe(v.name + ' timer', fn); }, ms); clean.push(() => clearTimeout(id)); return id; },
      layer(def) { const L = A.world && A.world.layer.add(def); if (L) clean.push(() => A.world.layer.remove(def.id, { ms: 200 })); return L; },
      pin(id, ll, el, o) { const n = A.world && A.world.pin(id, ll, el, o); clean.push(() => A.world && A.world.unpin(id)); return n; },
      el(slot, html, cls) { const d = document.createElement('div'); if (cls) d.className = cls; d.innerHTML = html || ''; UI.icons(d); slotEls()[slot].appendChild(d); return d; },
      _clean() { while (clean.length) A.safe(v.name + ' cleanup', clean.pop()); }
    };
    return ctx;
  }
  function frameInfo(inset) {
    const W = A.world; const w = (W && W.w) || innerWidth, h = (W && W.h) || innerHeight; const ins = inset || (W && W.insetTarget) || { l: 0, r: 0, t: 0, b: 0 };
    return { w, h, inset: ins, focus: { x: ins.l, y: ins.t, w: w - ins.l - ins.r, h: h - ins.t - ins.b }, stacked: stacked() };
  }
  function flyFor(v, o) {
    if (!A.world || !A.world.flyTo || !v.camera) return Promise.resolve(true);
    let target = null;
    A.safe(v.name + ' camera', () => { target = v.camera(frameInfo()); });
    if (!target) return Promise.resolve(true);
    return A.world.flyTo(target, { instant: o.instant || A.still, ms: o.ms });
  }
  function setTabs(name) {
    A.$$('#topbar [data-view]').forEach((a) => { if (a.classList.contains('tab')) { if (a.dataset.view === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); } });
    moveInd(!A.ready);
  }
  let indLast = null;
  function moveInd(instant) {
    const ind = A.$('.tabs__ind'), act = A.$('.tab[aria-current="page"]'); if (!ind || !act) return;
    const nav = ind.parentElement, nr = nav.getBoundingClientRect(), r = act.getBoundingClientRect();
    const x = r.left - nr.left, w = r.width;
    ind.style.width = w + 'px'; ind.style.transform = 'translateX(' + x + 'px)';
    if (!instant && indLast && !A.still && ind.animate) {
      try { ind.animate([{ transform: 'translateX(' + indLast.x + 'px) scaleX(' + indLast.w / w + ')' }, { transform: 'translateX(' + x + 'px) scaleX(1)' }], { duration: 420, easing: M.css.hail }); } catch (e) { /* ignore */ }
    }
    indLast = { x, w };
  }
  UI.moveInd = moveInd;

  A.view = {
    /** register(name, {title:{en,es}, key:'1', camera(frame)→target, enter(ctx), exit(ctx), dim:0..1, hail:0..1, ambient:true}) */
    register(name, def) {
      if (!views.has(name)) order5.push(name);
      views.set(name, Object.assign({ name, dim: 0, hail: 1, ambient: true }, def || {}));
    },
    get current() { return cur ? cur.name : null; },
    get ctx() { return ctxCur; },
    get(name) { return views.get(name); },
    list() { return order5.slice(); },
    has(name) { return views.has(name); },
    /** go(name,{instant}) → Promise; interrupts any running transition */
    async go(name, o = {}) {
      if (!views.has(name)) name = views.has('now') ? 'now' : order5[0];
      if (!name) return;
      if (cur && cur.name === name && !o.force) { return A.view.recenter(); }
      const my = ++token, prev = cur, v = views.get(name), instant = !!(o.instant || A.still);
      cur = v; root.dataset.view = name;
      if (o.hash !== false) { try { if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name); } catch (e) { /* sandboxed: fine */ } }
      setTabs(name);
      A.emit('view:leave', { name: prev && prev.name, to: name });
      const W = A.world;
      if (W && W.setDim) { W.setDim(v.dim || 0); W.layer.opacity('hail', v.hail == null ? 1 : v.hail, { ms: instant ? 0 : 500 }); W.ambient(v.ambient !== false); }
      // 1) camera starts at once, using the slots we expect (same as now unless the view says otherwise)
      let fly = flyFor(v, { instant });
      // 2) panels of the old view leave (120-160 ms)
      const s = slotEls();
      if (prev) {
        const old = ctxCur; ctxCur = null;
        A.safe(prev.name + ' exit', () => prev.exit && prev.exit(old));
        if (old) old._clean();
        // children marked data-keep (the film, its end card, the credits) belong to no view: they stay across views
        const kids = []; slotIds.forEach((k) => s[k] && kids.push(...Array.from(s[k].children).filter((c) => !c.hasAttribute('data-keep'))));
        await Promise.race([M.exit(kids, { ms: instant ? 0 : 140 }), new Promise((r) => setTimeout(r, 220))]);
        if (my !== token) return;
        slotIds.forEach((k) => s[k] && Array.from(s[k].children).forEach((c) => { if (!c.hasAttribute('data-keep')) c.remove(); }));
      }
      // 3) the new view fills its slots
      const ctx = (ctxCur = makeCtx(v));
      A.safe(name + ' enter', () => v.enter && v.enter(ctx));
      UI.icons(document.getElementById('stage')); UI.icons(s.overlay);
      UI.localize(document);
      syncSlots(!instant);
      // 4) the focus area follows the slots; re-aim the camera if the panels moved it
      if (W && W.setInset) {
        const ins = measureInset(), was = W.insetTarget || { l: 0, r: 0, t: 0, b: 0 };
        const moved = Math.abs(ins.l - was.l) + Math.abs(ins.r - was.r) + Math.abs(ins.t - was.t) + Math.abs(ins.b - was.b) > 8;
        W.setInset(ins, { ms: instant ? 0 : 420 });
        if (moved) fly = flyFor(v, { instant });
      }
      // 5) panels land, staggered like hail
      if (!instant) {
        const items = []; slotIds.forEach((k) => { if (s[k] && k !== 'overlay') items.push(...Array.from(s[k].children).filter((c) => !c.hasAttribute('data-no-in'))); });
        M.stagger(items, { each: 45, y: 10, ms: 560 });
      }
      A.emit('view', { name, prev: prev && prev.name });
      return fly;
    },
    /** fly back to the current view's own camera (after the user explored) */
    recenter(o = {}) { return cur ? flyFor(cur, o) : Promise.resolve(); },
    /** re-measure slots → world inset (call after a view changes panel sizes) */
    relayout(o = {}) { syncSlots(false); if (A.world && A.world.setInset) A.world.setInset(measureInset(), { ms: o.ms == null ? 300 : o.ms }); },
    /** reserve({t, b}) keeps the map's focus area and HUD clear of screen edges (css px from the viewport's top/bottom);
        reserve() clears it. Call relayout() after. Used by the film's letterbox. */
    reserve(r) { reserved = { t: Math.max(0, (r && r.t) || 0), b: Math.max(0, (r && r.b) || 0) }; },
    /** the view named in the hash; dev params after it are ignored (#knock&film=24000 → 'knock') */
    fromHash() { const h = (location.hash || '').replace('#', '').split(/[&?]/)[0]; return views.has(h) ? h : null; },
    byKey(k) { for (const v of views.values()) if (String(v.key) === String(k)) return v.name; return null; }
  };
  try { slotIds.forEach((k) => { const el = slotEls()[k]; if (el) new MutationObserver(() => syncSlot(k, true)).observe(el, { childList: true }); }); } catch (e) { /* ignore */ }

  /* "more below": a scrolling slot (left / right / dock) gets .is-more while content hides under its bottom edge, so the
     CSS fade says "scroll" on a Mac with hidden scrollbars. Checked on scroll, on resize of the slot or any pane, and
     when panes come and go; one rAF per burst. */
  (function moreBelow() {
    const ks = ['left', 'right', 'bottom'], dirty = new Set();
    let raf = 0;
    const check = (el) => {
      if (!el || !el.hasAttribute('data-on')) { if (el) el.classList.remove('is-more'); return; }
      el.classList.toggle('is-more', el.scrollHeight > el.clientHeight + el.scrollTop + 4);
    };
    const flush = () => { raf = 0; dirty.forEach(check); dirty.clear(); };
    const queue = (el) => { dirty.add(el); if (!raf) raf = requestAnimationFrame(flush); };
    UI.moreBelow = () => ks.forEach((k) => queue(slotEls()[k]));
    try {
      const ro = typeof ResizeObserver === 'function' ? new ResizeObserver((es) => es.forEach((e) => queue(e.target.closest('.slot')))) : null;
      ks.forEach((k) => {
        const el = slotEls()[k]; if (!el) return;
        el.addEventListener('scroll', () => queue(el), { passive: true });
        if (ro) { ro.observe(el); A.$$(':scope > *', el).forEach((c) => ro.observe(c)); }
        new MutationObserver((ms) => {
          if (ro) ms.forEach((m) => { m.addedNodes.forEach((n) => { if (n.nodeType === 1) ro.observe(n); }); m.removedNodes.forEach((n) => { if (n.nodeType === 1) ro.unobserve(n); }); });
          queue(el);
        }).observe(el, { childList: true, attributes: true, attributeFilter: ['data-on'] });
      });
    } catch (e) { /* the fade is a nicety; never break the page for it */ }
    A.on('lang', UI.moreBelow);
  })();

  /* chrome wiring (called by boot.js once the DOM and modules are in) */
  UI.mountChrome = function () {
    const bar = document.getElementById('topbar');
    UI.icons(document);
    // tabs + brand go to views
    A.$$('[data-view]', bar).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); A.view.go(a.dataset.view); }));
    // language
    const setLangBtns = () => A.$$('[data-lang-set]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.langSet === A.lang)));
    A.$$('[data-lang-set]').forEach((b) => b.addEventListener('click', () => A.setLang(b.dataset.langSet)));
    // theme
    const setThemeBtns = () => A.$$('[data-theme-set]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeSet === A.themeChoice)));
    A.$$('[data-theme-set]').forEach((b) => b.addEventListener('click', () => A.setTheme(b.dataset.themeSet)));
    // clock
    const clock = document.getElementById('clock');
    const setClock = () => { if (clock) clock.innerHTML = '<span class="clock__date">' + A.esc(A.fmt.date(A.story.today, 'day')) + ' · </span><b>' + A.esc(A.fmt.time(A.story.time)) + '</b>'; };
    // film
    const film = document.getElementById('film');
    if (film) film.addEventListener('click', () => {
      if (A.director && A.director.play) A.safe('director', () => A.director.play());
      else UI.toast({ en: 'The film is not built yet.', es: 'La película todavía no está lista.' });
    });
    // sound: the speaker switch shows the viewer's choice (a remembered "on" starts with the first click or key)
    const sb = document.getElementById('sound');
    const setSnd = () => {
      if (!sb) return;
      const on = A.sound.shown, ok = A.sound.supported || !window.Sound;
      sb.setAttribute('aria-pressed', String(on));
      sb.innerHTML = UI.icon(on ? 'sound' : 'mute', { size: 16 });
      sb.dataset.labelEn = on ? 'Sound on. Turn it off (M)' : 'Sound off. Turn it on (M)';
      sb.dataset.labelEs = on ? 'Sonido encendido. Apágalo (M)' : 'Sonido apagado. Enciéndelo (M)';
      sb.dataset.tip = ok ? (on ? 'Sound on · M' : 'Sound off · M') : 'Sound is not available in this browser';
      sb.dataset.tipEs = ok ? (on ? 'Sonido encendido · M' : 'Sonido apagado · M') : 'El sonido no está disponible en este navegador';
      sb.disabled = !ok;
      UI.localize(sb.parentElement || sb);
      if (tipFor === sb) showTip(sb);
    };
    if (sb) sb.addEventListener('click', () => A.sound.toggle());
    addEventListener('sound:change', setSnd);
    A.on('sound', setSnd);
    setLangBtns(); setThemeBtns(); setClock(); setSnd(); UI.localize(document);
    A.on('lang', () => { setLangBtns(); setClock(); fitBar(); moveInd(true); });
    A.on('theme:choice', setThemeBtns);
    // keys: 1-5 views, F the film, M sound, ? the key sheet; Esc bubbles as an event (intro/director skip)
    document.addEventListener('keydown', (e) => {
      const t = e.target;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === 'Escape') { A.emit('escape', e); return; }
      if (e.repeat) return;
      if (e.key === 'm' || e.key === 'M') { e.preventDefault(); A.sound.toggle(); return; }
      if ((e.key === 'f' || e.key === 'F') && A.director && A.director.play && !(A.intro && A.intro.active)) { e.preventDefault(); A.safe('director', () => A.director.play()); return; }
      if (e.key === '?' && A.director && A.director.keys) { e.preventDefault(); A.safe('keys', () => A.director.keys()); return; }
      const name = A.view.byKey(e.key);
      if (name) { e.preventDefault(); A.view.go(name); }
    });
    addEventListener('hashchange', () => { const h = A.view.fromHash(); if (h && h !== A.view.current) A.view.go(h, { hash: false }); });
    // the bar compacts itself when its content would not fit (both languages, any width)
    function fitBar() {
      if (!bar) return;
      bar.classList.remove('is-tight', 'is-tighter');
      if (stacked()) return;
      const over = () => bar.scrollWidth > bar.clientWidth + 1 || A.$$('.bar__meta', bar).some((m) => m.scrollWidth > m.clientWidth + 1);
      if (over()) bar.classList.add('is-tight');
      if (over()) bar.classList.add('is-tighter');
    }
    UI.fitBar = fitBar;
    fitBar();
    try { const nav = A.$('.tabs', bar); if (nav) new ResizeObserver(() => moveInd(true)).observe(nav); } catch (e) { /* ignore */ }
    let rz = 0;
    addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { fitBar(); moveInd(true); A.view.relayout({ ms: 0 }); }); });
    try { document.fonts && document.fonts.ready.then(() => { fitBar(); moveInd(true); }); } catch (e) { /* ignore */ }
  };
})();
