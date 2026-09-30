/* Claude's Aldaba · director.js → A.director
   The film the app plays of itself, the "Made by Claude" credits, and the key sheet. Owner: integration.

   THE FILM  A.director.play({at, pause}) · stop() · pause() · resume() · toggle() · seek(ms) · next() · prev()
             .playing .active .time .duration .chapter .beats · report() → {issues, skipped}
   About 80 s in 12 chapters (COPY.film.beats), driving the REAL app: the views, their demo handles (A.intro,
   A.nowAssemble + A.nowDemo, A.stormsDemo, A.knockDemo, A.dealDemo) and a few real buttons. A ghost cursor glides on an
   eased arc to what each chapter uses and presses it; the press is choreography, the director calls the API itself.
   Each chapter is one A.motion.Timeline ({realtime:true}, so A.still keeps its clock): cues fire once, cursor glides and
   drags are scrubbable tracks, and every cue knows when it is being seeked, so any point of the film can be reached
   directly (chapter ticks, arrow keys, #now&film=<ms>). A chapter whose view or handle is missing is skipped and noted.
   Frame: the cold open stays full-frame; at its hand-off the letterbox slides in (transform only), the top bar floats
   quiet on the top band (the cursor still presses its tabs) and the app goes inert under a glass that pauses on click.
   The bottom band carries the captions (Bricolage, each word rising on the hail spring, the kicker in mono) and the
   controls: Space pause, Left/Right chapters, M sound, Esc exit, 1-5 leave to a view.
   Sandbox: every stored key is snapshotted at the start and put back at the end, then a view whose state the film
   touched re-enters, so the viewer's knocks, deal ticks and levers survive it. Sound: the Play click is the gesture;
   the film plays with its score unless the viewer turned sound off (A.sound). A.still: crossfades, no cursor, no flights.
   Dev: #<view>&film=<ms> starts the film at <ms>; #<view>&film=<ms>p holds that frame (shots).

   THE CREDITS  A.director.credits(opener): "Claude's cut" in the top bar and "Credits" on the map open "Made by Claude"
   (COPY.colophon): what is real (with the counts), what is sample, how it was built (lines per file from MANIFEST,
   written by dev/manifest.mjs), why one ring, the end credits, and "Play the film" / "Replay the intro".
   THE KEY SHEET  A.director.keys(opener), also "?". */
(function () {
  'use strict';
  const A = window.A; if (!A || !A.motion || !A.view) return;
  const root = document.documentElement;
  const E = A.motion.ease;
  const COPY = window.COPY || {};
  const FILM = COPY.film || {}, CTRL = FILM.controls || {}, COL = COPY.colophon || {}, UIX = COPY.ui || {};
  const TAU = Math.PI * 2;

  // lines per file and data sizes, counted from the repo by dev/manifest.mjs (re-run it after code changes)
  const MANIFEST = /* dev/manifest.mjs */ {"at":"2026-09-30","page":91,"code":[["js/core.js",860],["js/world.js",1013],["js/lib/funnel.js",237],["js/lib/hailgl.js",1439],["js/lib/house.js",906],["js/lib/route.js",573],["js/lib/sound.js",547],["js/intro.js",756],["js/now.js",797],["js/storms.js",727],["js/knock.js",1241],["js/deal.js",1267],["js/money.js",489],["js/director.js",1127],["js/boot.js",22]],"css":[["css/base.css",372],["css/now.css",203],["css/storms.css",147],["css/knock.css",301],["css/deal.css",358],["css/money.css",109],["css/intro.css",120],["css/director.css",3]],"data":[["data/nl.js",1087819],["data/extra.js",23773],["data/copy.js",84592]],"fonts":5};

  /* ======================= helpers ======================= */
  const cp = (o, en, es) => (o && o.en != null ? o : { en, es: es == null ? en : es });
  const sub = (s, v) => String(s == null ? '' : s).replace(/\{(\w+)\}/g, (m, k) => (v && v[k] != null ? v[k] : m));
  const Lx = (o, v) => A.L(A.esc(sub(o.en, typeof v === 'function' ? v('en') : v)), A.esc(sub(o.es == null ? o.en : o.es, typeof v === 'function' ? v('es') : v)));
  const Le = (en, es) => A.L(A.esc(en), A.esc(es));
  const ic = (n, s) => A.ui.icon(n, { size: s || 16 });
  const snd = () => { const s = window.Sound; return s && s.enabled ? s : null; };
  const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const pad2 = (n) => String(n).padStart(2, '0');
  const q = (sel) => () => document.querySelector(sel);
  const entered = (name) => A.view.current === name && !!A.view.ctx && A.view.ctx.name === name;
  const overlay = () => document.getElementById('slot-overlay') || document.body;
  const labelOf = (o) => ({ 'data-label-en': o.en, 'data-label-es': o.es == null ? o.en : o.es });
  const attrs = (o) => Object.keys(o).map((k) => k + '="' + A.esc(o[k]) + '"').join(' ');

  /* ======================= the story's facts ======================= */
  const N = A.data || {}, X = A.x || {}, S26 = X.storms2026 || {};
  const PICK = N.pick || {};
  const AUG8 = PICK.storm_day || '2026-08-08';
  const TOWN = String(((N.zones || [])[0] || {}).name || 'Columbus').split(':')[0].trim() || 'Columbus';
  const COL_PTS = (N.zones || []).filter((z) => z.kind !== 'everyday' && String(z.name || '').split(':')[0].trim() === TOWN).map((z) => z.c);

  /* ======================= the film's state ======================= */
  const F = {
    on: false, playing: false, i: -1, b: null, tok: 0,
    dom: null, frame: 'out', laid: false,
    snap: null, dealHome: undefined, touched: new Set(), rate: 1,
    issues: [], skipped: [], prevFocus: null, offs: [], hotT: 0
  };
  function note(kind, what) {
    const s = kind + ': ' + what;
    if (F.issues.indexOf(s) < 0) { F.issues.push(s); try { console.info('[aldaba film] ' + s); } catch (e) { /* no console */ } }
  }
  /** use('knockDemo', 'tap', 'no_answer') → calls a view's demo handle; a missing or failing handle is noted, never thrown */
  function use(name, fn, ...args) {
    const o = A[name];
    if (!o || typeof o[fn] !== 'function') { note('missing', 'A.' + name + '.' + fn); return undefined; }
    try { return o[fn](...args); } catch (e) { note('threw', 'A.' + name + '.' + fn + ' (' + (e && e.message) + ')'); console.warn('[aldaba film] A.' + name + '.' + fn + ' failed:', e); return undefined; }
  }
  /** goView(name) → resolves once that view has entered (not when its camera lands) */
  function goView(name, o = {}) {
    if (entered(name) && !o.force) return Promise.resolve(true);
    return new Promise((res) => {
      let done = false;
      const fin = (v) => { if (done) return; done = true; off(); clearTimeout(t); res(v); };
      const off = A.on('view', (d) => { if (d && d.name === name) fin(true); });
      const t = setTimeout(() => fin(entered(name)), 2500);
      A.safe('film view', () => A.view.go(name, { instant: !!(o.instant || A.still), force: !!o.force }));
    });
  }
  /** when(name, fn) runs fn once that view is on screen (now, or when it enters) */
  function when(name, fn) {
    if (entered(name)) return A.safe('film when ' + name, fn);
    const tok = F.tok;
    const off = A.on('view', (d) => { if (d && d.name === name) { off(); clearTimeout(t); if (F.on && F.tok === tok) A.safe('film when ' + name, fn); } });
    const t = setTimeout(off, 2600);
    return undefined;
  }
  function clickEl(get) {
    const el = typeof get === 'function' ? A.safe('film target', get) : get;
    if (!el || !el.isConnected) return false;
    A.safe('film click', () => el.click());
    return true;
  }

  /* ======================= targets the cursor goes to ======================= */
  const T = {
    tab: (v) => q('#topbar .tab[data-view="' + v + '"]'),
    pick: q('.world__pins .now-pick'),
    zone: (i) => q('#slot-right .now-z[data-i="' + i + '"] .now-z__row'),
    drive: q('#slot-left [data-now="drive"]'),
    walk: q('#slot-left [data-now="walk"]'),
    why: q('#slot-left .now-hero__why'),
    stats: q('#slot-left .now-stats'),
    ins: q('#slot-left .now-ins'),
    speed4: q('#slot-bottom [data-speed="4"]'),
    tick: (date) => () => { const d = A.stormsDemo && A.stormsDemo.days; const i = d ? d.indexOf(date) : -1; return i < 0 ? null : document.querySelector('.storms-tick[data-i="' + i + '"]'); },
    out: (o) => q('#slot-left [data-out="' + o + '"]'),
    slot: (i) => q('#slot-left .knock-slot[data-slot="' + i + '"]'),
    openDeal: q('#slot-left [data-act="deal"]'),
    node: (i) => q('.deal-track .deal-node[data-i="' + i + '"]'),
    hand: q('.deal-handbtn'),
    sheet: q('.deal-modal__scroll'),
    hours: q('#slot-left input[data-lv="hours"]'),
    mix: q('#slot-left [data-m-act="mix"]')
  };
  function resolve(target) {
    const t = typeof target === 'function' ? A.safe('film target', target) : target;
    return t || null;
  }
  /** a target → a screen point [x, y]; elements aim a little below their center, map points project */
  function pointOf(target, o = {}) {
    const t = resolve(target);
    if (!t) return null;
    if (Array.isArray(t)) return t;
    if (t.ll && A.world && A.world.el) { const p = A.world.project(t.ll), wr = A.world.el.getBoundingClientRect(); return [wr.left + p[0], wr.top + p[1]]; }
    if (!t.getBoundingClientRect || !t.isConnected) return null;
    const r = t.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    return [r.left + r.width * (o.fx == null ? 0.5 : o.fx) + (o.dx || 0), r.top + r.height * (o.fy == null ? 0.56 : o.fy) + (o.dy || 0)];
  }
  /** stacked screens scroll the page so the target sits in the film's frame (above the bottom band) */
  function reveal(target) {
    if (!A.stacked()) return;
    const el = resolve(target); if (!el || !el.getBoundingClientRect) return;
    const r = el.getBoundingClientRect(), bb = F.dom ? F.dom.lbB.getBoundingClientRect().top : innerHeight;
    if (r.top >= 70 && r.bottom <= bb - 12) return;
    const y = scrollY + r.top - Math.max(80, (bb - r.height) * 0.42);
    A.safe('film scroll', () => scrollTo({ top: Math.max(0, y), behavior: A.still ? 'auto' : 'smooth' }));
  }

  /* ======================= the ghost cursor ======================= */
  const Cur = {
    el: null, x: 0, y: 0, on: false, held: false,
    mount() {
      if (this.el) return this.el;
      const host = document.getElementById('fx') || document.body;
      this.el = A.h('<div class="dir-cursor" aria-hidden="true"><span class="dir-cursor__ring"></span>' +
        '<svg class="dir-cursor__arrow" viewBox="0 0 22 28" focusable="false"><path d="M2.4 1.6v21.6l5.3-5.2 3.5 8.2 3.5-1.5-3.5-8.1h7.3z"/></svg></div>');
      host.appendChild(this.el);
      this.x = innerWidth * 0.64; this.y = innerHeight * 0.56; this.place();
      return this.el;
    },
    place() { if (this.el) this.el.style.transform = 'translate3d(' + this.x.toFixed(1) + 'px,' + this.y.toFixed(1) + 'px,0)'; },
    to(x, y) { this.x = x; this.y = y; this.place(); },
    show() {
      if (A.still) return;
      this.mount();
      if (this.on) return;
      this.on = true;
      this.el.classList.add('is-on');
      A.safe('cursor in', () => this.el.firstElementChild.animate([{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }], { duration: 520, easing: A.motion.css.hail }));
    },
    hide() { if (!this.el) return; this.on = false; this.held = false; this.el.classList.remove('is-on', 'is-held'); },
    grab(on) { this.held = !!on; if (this.el) this.el.classList.toggle('is-held', this.held); },
    /** the press: the pointer dips, its ring closes and rings out, the control answers like a real tap */
    press(target) {
      const el = resolve(target);
      const s = snd(); if (s) s.tick({ gain: 0.9 });
      if (A.still || !this.el || !this.on) return;
      const arrow = this.el.querySelector('.dir-cursor__arrow'), ring = this.el.querySelector('.dir-cursor__ring');
      A.safe('cursor press', () => {
        arrow.animate([{ transform: 'scale(1)' }, { transform: 'scale(.8)', offset: 0.35 }, { transform: 'scale(1)' }], { duration: 380, easing: A.motion.css.out });
        ring.animate([{ transform: 'translate(-50%,-50%) scale(1)' }, { transform: 'translate(-50%,-50%) scale(.45)', offset: 0.3 }, { transform: 'translate(-50%,-50%) scale(1)' }], { duration: 560, easing: A.motion.css.hail });
      });
      A.motion.ripple(this.x, this.y, { rings: 2, size: 48 });
      if (el && el.matches && el.matches('.btn, .seg>button, button.row, .hud__btns button')) {
        const r = el.getBoundingClientRect();
        A.motion.ripple(el, { inside: el, rings: 2, size: Math.max(r.width, r.height) * 1.1 });
      }
    },
    remove() { if (this.el) this.el.remove(); this.el = null; this.on = false; this.held = false; }
  };

  /* ======================= spotlights: a soft ring lands around what a caption talks about ======================= */
  function spot(target, o = {}) {
    if (!F.dom) return;
    const el = resolve(target); if (!el || !el.getBoundingClientRect) return;
    const tok = F.tok;
    const run = () => {
      if (!F.on || F.tok !== tok || !el.isConnected) return;
      const r = el.getBoundingClientRect(); if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) return;
      const pad = o.pad == null ? 5 : o.pad;
      const s = A.h('<span class="dir-spot" aria-hidden="true"></span>');
      Object.assign(s.style, { left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px' });
      F.dom.spots.appendChild(s);
      const hold = o.hold || 2600;
      if (A.still) { setTimeout(() => s.remove(), hold); return; }
      A.safe('spot', () => {
        s.animate([{ opacity: 0, transform: 'scale(1.035)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 620, easing: A.motion.css.hail, fill: 'both' });
        const out = s.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, delay: hold, easing: A.motion.css.ease, fill: 'forwards' });
        out.onfinish = () => s.remove(); out.oncancel = () => s.remove();
      });
    };
    if (o.delay) setTimeout(run, o.delay); else run();
  }

  /* ======================= the chapters ======================= */
  const BC = FILM.beats || [];
  const bcopy = (id) => BC.find((b) => b.id === id) || {};
  function ensure(name, b, then) {
    if (entered(name)) { if (then) A.safe('film ensure', then); return; }
    goView(name, { instant: b.seekIn }).then(() => { if (b.alive() && then) A.safe('film ensure', then); });
  }
  const introOk = () => !A.still && !!(A.intro && typeof A.intro.play === 'function') && !!(A.world && A.world.ready);

  const BEATS = [
    /* 1 · the cold open: the real Aug 8 storm, full-frame; the letterbox waits for its hand-off */
    { id: 'cold-open', ms: 7800, capAt: 500, capOut: 5900,
      setup(b) {
        b.cold = introOk();
        if (b.cold) { frame('cold', !b.seekIn); coldOpen(b); } else stillOpen(b);
      } },
    /* 2 · the 7 AM brief: the pick assembles itself */
    { id: 'brief', ms: 6400, needs: () => A.view.has('now'),
      setup(b) {
        frame('in', !b.seekIn);
        A.ui.chrome(true);
        const run = () => {
          if (A.intro && A.intro.active) return;               // the cold open's hand-off starts the assemble itself
          const st = use('nowDemo', 'state'); if (st && st.assembling) return;
          const tl = A.nowAssemble ? A.safe('film assemble', () => A.nowAssemble()) : null;
          if (!tl) { note('missing', 'A.nowAssemble'); return; }
          if (b.seekIn || A.still) tl.skip(); else tl.play();
        };
        ensure('now', b, run);
      },
      script(b) { b.glide(4300, 1150, T.pick, { fy: 0.5 }); } },
    /* 3 · why Columbus: the camera eases onto the pick; the why line and the numbers light up */
    { id: 'why-columbus', ms: 6000, needs: () => A.view.has('now'),
      setup(b) { frame('in', false); A.ui.chrome(true); ensure('now', b, () => use('nowDemo', 'settle')); },
      script(b) {
        b.glide(0, 600, T.pick, { fy: 0.5 });
        b.press(660, T.pick, (sk) => when('now', () => {
          if (A.nowDemo) use('nowDemo', 'select', 0);
          else if (PICK.center) A.world.flyTo({ center: [PICK.center.lon, PICK.center.lat], zoom: 14.6 }, { instant: sk || A.still });
        }));
        b.at(1150, () => { spot(T.why, { hold: 3500 }); spot(T.stats, { delay: 240, hold: 3260 }); spot(T.ins, { delay: 480, hold: 3020 }); });
        b.glide(1250, 760, T.why, { fx: 0.97, fy: 0.62 });
        b.glide(2500, 620, () => { const s = T.stats(); return s && s.querySelector('.stat'); }, { fx: 0.62, fy: 0.62 });
        b.glide(3500, 620, T.ins, { fx: 0.5, fy: 0.5 });
        b.at(1450, (sk) => { if (sk) return; const pin = T.pick(); if (pin) A.motion.ripple(pin, { rings: 3, size: 120 }); const s = snd(); if (s) s.ring(0, { gain: 0.7 }); });
        b.glide(4950, 900, T.zone(1), { fx: 0.3 });
      } },
    /* 4 · the zones light up, best first */
    { id: 'zones', ms: 5600, needs: () => !!(A.nowDemo && A.nowDemo.hover),
      setup(b) { frame('in', false); A.ui.chrome(true); ensure('now', b, () => use('nowDemo', 'settle')); },
      script(b) {
        b.at(0, (sk) => when('now', () => {
          use('nowDemo', 'collapse');
          if (COL_PTS.length) A.world.flyTo({ points: COL_PTS, pad: A.stacked() ? 36 : 90, maxZoom: 13.4 }, { instant: sk || A.still, ms: 1300 });
        }));
        [1, 2, 3].forEach((z, k) => { const t = 420 + k * 1150; b.glide(t, 520, T.zone(z), { fx: 0.3 }); b.at(t + 560, () => use('nowDemo', 'hover', z)); });
        b.glide(3900, 560, T.zone(0), { fx: 0.3 });
        b.at(4500, () => use('nowDemo', 'hover', 0));
      } },
    /* 5 · replay the season: every storm lands, then Aug 8 */
    { id: 'replay', ms: 8400, needs: () => !!A.stormsDemo && A.view.has('storms'),
      setup() { frame('in', false); A.ui.chrome(true); },
      script(b) {
        b.at(0, () => { if (A.nowDemo) use('nowDemo', 'clear'); });
        b.glide(0, 800, T.tab('storms'), { bend: 0.5 });
        b.press(860, T.tab('storms'), (sk) => { hot(); F.touched.add('storms'); goView('storms', { instant: sk }); });
        b.at(1500, (sk) => when('storms', () => {
          if (sk || A.still) { use('stormsDemo', 'select', AUG8); return; }
          clickEl(T.speed4);
          use('stormsDemo', 'seek', 0);
          use('stormsDemo', 'play');
        }));
        b.glide(5500, 900, T.tick(AUG8), { fy: 0.3 });
        b.press(6500, T.tick(AUG8), () => when('storms', () => use('stormsDemo', 'select', AUG8)));
      } },
    /* 6 · the drive: a car on the real 50 mi of US-30 */
    { id: 'drive', ms: 6600, needs: () => !!(A.nowDemo && A.nowDemo.drive),
      setup() { frame('in', false); A.ui.chrome(true); },
      script(b) {
        b.glide(0, 760, T.tab('now'), { bend: 0.5 });
        b.press(820, T.tab('now'), (sk) => { hot(); goView('now', { instant: sk }); });
        b.glide(1700, 700, T.drive);
        b.press(2450, T.drive, () => when('now', () => use('nowDemo', 'drive')));
      } },
    /* 7 · the walk: the route draws from the park spot, the doors light in order */
    { id: 'walk', ms: 5600, needs: () => !!A.knockDemo && A.view.has('knock'),
      setup(b) { frame('in', false); A.ui.chrome(true); if (b.local < 760) ensure('now', b); },
      script(b) {
        b.glide(0, 700, T.walk);
        b.press(760, T.walk, (sk) => { use('knockDemo', 'reset', true); F.touched.add('knock'); goView('knock', { instant: sk }); });
        b.glide(4300, 1000, T.out('no_answer'));
      } },
    /* 8 · one tap per door, and the follow-up for an inspection */
    { id: 'one-tap', ms: 7600, needs: () => !!(A.knockDemo && A.knockDemo.tap),
      setup(b) {
        frame('in', false); A.ui.chrome(true);
        if (!entered('knock')) { use('knockDemo', 'reset', true); F.touched.add('knock'); goView('knock', { instant: b.seekIn }); }
      },
      script(b) {
        [['no_answer', 250], ['talked', 1350], ['not_interested', 2450], ['inspection_set', 3550]].forEach(([o, t], k) => {
          if (k) b.glide(t - 540, 480, T.out(o));
          b.press(t, T.out(o), () => when('knock', () => use('knockDemo', 'tap', o)));
        });
        b.glide(4300, 560, T.slot(2));
        b.press(4950, T.slot(2), () => when('knock', () => clickEl(T.slot(2))));
        b.glide(5900, 800, T.openDeal);
      } },
    /* 9 · the legal armor: the door walks the path, the law rides along */
    { id: 'legal', ms: 8800, needs: () => !!(A.dealDemo && A.dealDemo.step) && A.view.has('deal'),
      setup() { frame('in', false); A.ui.chrome(true); },
      script(b) {
        b.press(260, T.openDeal, (sk) => {
          F.touched.add('deal');
          const el = T.openDeal();
          if (el && entered('knock') && !sk) A.safe('film open deal', () => el.click()); else goView('deal', { instant: sk });
        });
        [0, 1, 2, 3, 4, 5].forEach((s, k) => {
          const t = 2000 + k * 1100;
          b.glide(t - 540, 480, T.node(s));
          b.press(t, T.node(s), () => when('deal', () => use('dealDemo', 'step', s)));
        });
      } },
    /* 10 · the homeowner's page: HMP Siding & Roofing, English and Spanish */
    { id: 'homeowner-sheet', ms: 5800, needs: () => !!(A.dealDemo && A.dealDemo.open),
      setup(b) { frame('in', false); A.ui.chrome(true); if (!entered('deal')) { F.touched.add('deal'); goView('deal', { instant: b.seekIn }); } },
      script(b) {
        b.glide(0, 700, T.hand);
        b.press(760, T.hand, () => when('deal', () => use('dealDemo', 'open')));
        b.glide(1500, 900, () => { const s = T.sheet(); if (!s) return null; const r = s.getBoundingClientRect(); return [r.right - 30, r.top + r.height * 0.4]; });
        b.at(2300, (sk) => { const s = T.sheet(); if (s && !sk) A.safe('film scroll', () => s.scrollBy({ top: Math.min(340, s.scrollHeight - s.clientHeight), behavior: A.still ? 'auto' : 'smooth' })); });
        b.at(5300, () => { const st = A.dealDemo && A.dealDemo.state ? A.safe('deal state', A.dealDemo.state) : null; if (st && st.open) use('dealDemo', 'close'); });
      } },
    /* 11 · the path to $100,000: a lever moves, the numbers roll, the ring fills */
    { id: 'path', ms: 7600, needs: () => A.view.has('money'),
      setup() { frame('in', false); A.ui.chrome(true); },
      script(b) {
        b.at(0, () => { const st = A.dealDemo && A.dealDemo.state ? A.safe('deal state', A.dealDemo.state) : null; if (st && st.open) use('dealDemo', 'close'); });
        b.glide(0, 720, T.tab('money'), { bend: 0.5 });
        b.press(780, T.tab('money'), (sk) => { hot(); F.touched.add('money'); goView('money', { instant: sk }); });
        b.glide(2150, 720, () => thumb(T.hours()));
        let from = null;
        b.at(2960, (sk) => { const inp = T.hours(); from = inp ? +inp.value : 3.5; if (!sk) Cur.grab(true); });
        b.track(2960, 1500, (raw) => {
          const inp = T.hours(); if (!inp) return;
          if (from == null) from = +inp.value;
          const to = Math.max(from, 7), v = Math.round((from + (to - from) * E.inOutSine(raw)) * 2) / 2;
          if (+inp.value !== v) { inp.value = String(v); inp.dispatchEvent(new Event('input', { bubbles: true })); }
          if (!A.still) { const p = thumb(inp); if (p) Cur.to(p[0], p[1]); }
        });
        b.at(4520, () => { Cur.grab(false); const inp = T.hours(); if (inp) inp.dispatchEvent(new Event('change', { bubbles: true })); });
        b.glide(5100, 650, T.mix);
        b.press(5800, T.mix, () => clickEl(T.mix));
      } },
    /* 12 · sign-off: the map at dusk, the mark, and the app handed back */
    { id: 'sign-off', ms: 6600, capAt: 1900,
      setup() { frame('in', false); },
      script(b) {
        b.at(0, (sk) => { Cur.hide(); A.ui.chrome(false); dusk(sk); });
        b.at(650, (sk) => Sign.show(sk));
        b.at(5000, (sk) => handBack(sk));
      } }
  ];
  const AT = []; let TOTAL = 0;
  BEATS.forEach((d) => { AT.push(TOTAL); TOTAL += d.ms; });
  const beatAt = (ms) => { for (let i = BEATS.length - 1; i >= 0; i--) if (ms >= AT[i]) return i; return 0; };
  const filmTime = () => (F.i < 0 ? 0 : AT[F.i] + (F.b ? F.b.tl.time : 0));

  /** the range input's thumb, as a screen point */
  function thumb(inp) {
    if (!inp || !inp.isConnected) return null;
    const r = inp.getBoundingClientRect(); if (!r.width) return null;
    const min = +inp.min || 0, max = +inp.max || 100, v = +inp.value, k = (v - min) / Math.max(1e-6, max - min), tw = 18;
    return [r.left + tw / 2 + k * (r.width - tw), r.top + r.height / 2];
  }

  /* the cold open: A.intro over Now, so its hand-off lands on the brief */
  function coldOpen(b) {
    A.ui.chrome(false);
    const start = () => {
      if (!b.alive()) return;
      let p = null;
      const was = !!A.intro.active;                     // already running (the chapter restarted): seek it, never restart it
      A.safe('film intro', () => { p = A.intro.play({ force: true }); });
      if (was && A.intro.timeline && A.intro.timeline.seek) A.safe('film intro seek', () => A.intro.timeline.seek(b.local));
      if (!p || typeof p.then !== 'function') { note('missing', 'A.intro.play'); stillOpen(b); return; }
      const tl = A.intro.timeline;
      if (!was && b.local > 60 && tl && tl.seek) A.safe('film intro seek', () => tl.seek(Math.min(b.local, (tl.duration || 8700) - 1)));
      if (!F.playing && tl && tl.pause) A.safe('film intro pause', () => tl.pause());
      p.then((played) => {
        if (!b.alive() || F.b !== b) return;
        if (played === false) { stillOpen(b); return; }
        // the cold open handed off early (this device skipped it for speed): the film follows
        if (b.tl.time < b.def.ms - 1200) enter(b.i + 1, 0);
      }, () => { if (b.alive()) stillOpen(b); });
    };
    if (!entered('now')) goView('now', { instant: true }).then(start); else start();
  }
  /* without the cold open (A.still, or no intro): the same storm, as a still frame on Storms */
  function stillOpen(b) {
    frame('in', !b.seekIn);
    A.ui.chrome(true);
    if (!A.stormsDemo || !A.view.has('storms')) { ensure('now', b); return; }
    F.touched.add('storms');
    ensure('storms', b, () => use('stormsDemo', 'select', AUG8));
  }
  function hot() {
    root.classList.add('dir-hot');
    clearTimeout(F.hotT);
    F.hotT = setTimeout(() => root.classList.remove('dir-hot'), 1300);
  }

  /* ======================= the engine: chapters on Timelines ======================= */
  function makeBeat(i, local) {
    const tok = ++F.tok, def = BEATS[i];
    const tl = new A.motion.Timeline({ realtime: true, rate: F.rate });
    const b = {
      i, def, tl, local, seekIn: local > 0, tok,
      alive: () => F.on && F.tok === tok,
      /** a cue: fn(seeking) runs once when the playhead passes ms */
      at(ms, fn) { tl.add(ms, (t, o) => { if (b.alive()) A.safe('film ' + def.id + ' @' + ms, () => fn(!!(o && o.seeking))); }); return b; },
      /** a scrubbable track: fn(0..1) every frame between ms and ms + dur */
      track(ms, dur, fn) { tl.add(ms, { ms: dur, ease: 'linear', update: (p, raw) => { if (b.alive()) A.safe('film ' + def.id + ' track', () => fn(raw)); } }); return b; },
      /** the cursor glides to a target on an eased arc (re-aimed every frame: targets can move) */
      glide(ms, dur, target, o = {}) {
        let from = null;
        return b.track(ms, dur, (raw) => {
          if (A.still) return;
          if (!from) { Cur.show(); reveal(target); from = [Cur.x, Cur.y]; }
          const to = pointOf(target, o); if (!to) return;
          const k = E.inOutCubic(raw), dx = to[0] - from[0], dy = to[1] - from[1], d = Math.hypot(dx, dy) || 1;
          let nx = -dy / d, ny = dx / d; if (ny > 0) { nx = -nx; ny = -ny; }          // the arc bows upward, like a hand
          const bend = Math.min(80, d * 0.14) * (o.bend == null ? 1 : o.bend);
          const cx = (from[0] + to[0]) / 2 + nx * bend, cy = (from[1] + to[1]) / 2 + ny * bend, u = 1 - k;
          Cur.to(u * u * from[0] + 2 * u * k * cx + k * k * to[0], u * u * from[1] + 2 * u * k * cy + k * k * to[1]);
        });
      },
      /** the cursor presses a target, then fn(seeking) acts (the press is choreography; fn does the work) */
      press(ms, target, fn) { return b.at(ms, (sk) => { if (!sk) Cur.press(target); if (fn) fn(sk); }); }
    };
    tl.add(def.ms, () => {});                       // the chapter's length
    return b;
  }
  function enter(i, local = 0, o = {}) {
    if (!F.on) return;
    if (F.b) { const old = F.b; F.b = null; old.tl.stop(); }
    // leaving the cold open by a jump: the intro hands off now, so the app is ready under the next chapter (played
    // through, it lands its lockup in the top bar by itself)
    if (i !== 0 && !o.natural && A.intro && A.intro.active) A.safe('film intro end', () => A.intro.stop());
    if (i >= BEATS.length) { finish(true); return; }
    const def = BEATS[i];
    if (def.needs && !A.safe('film needs', def.needs)) {
      if (F.skipped.indexOf(def.id) < 0) F.skipped.push(def.id);
      note('skipped', def.id + ' (its view or demo handle is missing)');
      F.i = i;
      enter(i + 1, 0, o);
      return;
    }
    const b = makeBeat(i, local);
    F.i = i; F.b = b;
    UI.chapter(i, !o.quiet && !A.still);
    b.at(def.capAt == null ? 280 : def.capAt, (sk) => Cap.show(i, !sk));
    if (def.capOut) b.at(def.capOut, (sk) => Cap.hide(!sk));
    A.safe('film setup ' + def.id, () => def.setup && def.setup(b));
    A.safe('film script ' + def.id, () => def.script && def.script(b));
    b.tl.onEnd((done) => { if (done && F.on && F.b === b) enter(i + 1, 0, { natural: true }); });
    if (local > 0) b.tl.seek(local);
    if (F.playing) b.tl.play();
    if (A.still && i > 0 && !o.quiet) UI.veil();
    UI.progress(true);
  }

  /* ======================= play, pause, seek, stop ======================= */
  function play(o = {}) {
    if (F.on) { if (!F.playing) resume(); return; }
    if (A.intro && A.intro.active) return;
    closeCredits(); closeKeys(); closeEnd();
    A.safe('film close sheet', () => { const st = A.dealDemo && A.dealDemo.state && A.dealDemo.state(); if (st && st.open) A.dealDemo.close(); });
    F.on = true; F.playing = true; F.i = -1; F.b = null;
    F.rate = A.clamp(+o.rate || 1, 0.25, 8);                  // dev: tests run the film faster
    F.issues = []; F.skipped = []; F.touched = new Set();
    F.snap = snapshot(); F.dealHome = A.dealHome;
    F.prevFocus = document.activeElement;
    A.safe('film hide tip', () => A.ui.hideTip());
    UI.mount();
    root.classList.add('dir-on');
    inert(true);
    listen(true);
    // sound: the Play click is the gesture; the film has a score unless the viewer turned sound off
    if (o.gesture !== false && A.sound && A.sound.pref !== false) A.sound.set(true);
    const S = window.Sound; if (S) A.safe('film score', () => S.score(true));
    UI.sound();
    A.emit('film', { on: true });
    const at = A.clamp(+o.at || 0, 0, TOTAL - 1), i = beatAt(at);
    if (i > 0 || at > 0) frame('in', false);
    enter(i, at - AT[i], { quiet: true });
    if (o.pause) pause();
    // focus lands on the film itself (keys work at once; Tab reaches the controls); a focused button would pop its tip
    requestAnimationFrame(() => { if (F.on && F.dom) A.safe('film focus', () => F.dom.root.focus({ preventScroll: true })); });
  }
  function pause() {
    if (!F.on || !F.playing) return;
    F.playing = false;
    if (F.b) F.b.tl.pause();
    A.safe('film intro pause', () => { const tl = A.intro && A.intro.active && A.intro.timeline; if (tl && tl.playing) tl.pause(); });
    const S = window.Sound; if (S) A.safe('film score', () => S.score(false));
    UI.state(); UI.flash(false);
  }
  function resume() {
    if (!F.on || F.playing) return;
    F.playing = true;
    if (F.b) F.b.tl.play();
    A.safe('film intro play', () => { const tl = A.intro && A.intro.active && A.intro.timeline; if (tl && !tl.playing && tl.time < tl.duration) tl.play(); });
    const S = window.Sound; if (S) A.safe('film score', () => S.score(true));
    UI.state(); UI.flash(true);
  }
  const toggle = () => (F.playing ? pause() : resume());
  function seek(ms) {
    if (!F.on) return;
    ms = A.clamp(ms, 0, TOTAL - 1);
    const i = beatAt(ms), local = ms - AT[i];
    if (F.b && F.b.i === i && local >= F.b.tl.time) { F.b.tl.seek(local); UI.progress(true); return; }
    enter(i, local);
  }
  function next() { if (!F.on) return; if (F.i + 1 >= BEATS.length) finish(true); else enter(F.i + 1, 0); }
  function prev() { if (!F.on) return; const back = F.b && F.b.tl.time > 1600 ? F.i : Math.max(0, F.i - 1); enter(back, 0); }

  const STATEFUL = new Set(['knock', 'deal', 'money']);
  /** ends the film: every subsystem handed back clean, saved state restored, "Your turn" */
  function finish(done, o = {}) {
    if (!F.on) return;
    F.tok++;
    F.on = false; F.playing = false;
    const b = F.b; F.b = null; F.i = -1;
    if (b) b.tl.stop();
    A.safe('film intro stop', () => { if (A.intro && A.intro.active && A.intro.stop) A.intro.stop(); });
    A.safe('film deal close', () => { const st = A.dealDemo && A.dealDemo.state && A.dealDemo.state(); if (st && st.open) A.dealDemo.close(); });
    A.safe('film storms', () => { if (A.stormsDemo && A.stormsDemo.active) A.stormsDemo.pause(); });
    A.safe('film now', () => { if (A.nowDemo) A.nowDemo.clear(); });
    Cur.remove(); Sign.remove(); Cap.hide(false);
    if (F.dom) F.dom.spots.replaceChildren();
    const S = window.Sound; if (S) A.safe('film sound', () => { S.score(false); S.hailBed(0); });
    clearTimeout(F.hotT); root.classList.remove('dir-hot');
    A.ui.chrome(true);
    restoreWorld();
    listen(false);
    inert(false);
    frame('out', !A.still);
    root.classList.remove('dir-on');
    // the viewer's saved state comes back; a view that holds it re-reads it
    restore(F.snap); F.snap = null;
    if (F.dealHome !== undefined) { if (F.dealHome) A.dealHome = F.dealHome; else delete A.dealHome; }
    F.dealHome = undefined;
    const cur = A.view.current;
    if (o.to && o.to !== cur) A.view.go(o.to);
    else if (cur && STATEFUL.has(cur) && F.touched.has(cur)) A.view.go(cur, { force: true, instant: true });
    UI.unmount();
    A.safe('film focus back', () => { const f = F.prevFocus; if (f && f.isConnected && f.focus) f.focus({ preventScroll: true }); });
    F.prevFocus = null;
    if (o.card !== false) endCard();
    A.emit('film', { on: false, done: !!done });
  }

  /* ======================= the sandbox: the film never changes what a viewer saved ======================= */
  const KEEP = /^(lang|theme|sound)$/;                 // choices the viewer makes during the film stay
  function snapshot() { const o = {}; A.store.keys().forEach((k) => { if (!KEEP.test(k)) o[k] = A.store.get(k, null); }); return o; }
  function restore(snap) {
    if (!snap) return;
    A.store.keys().forEach((k) => { if (!KEEP.test(k) && !(k in snap)) A.store.del(k); });
    Object.keys(snap).forEach((k) => { if (JSON.stringify(A.store.get(k, null)) !== JSON.stringify(snap[k])) A.store.set(k, snap[k]); });
  }

  /* ======================= the world at dusk, and back ======================= */
  function dusk(sk) {
    const W = A.world; if (!W || !W.layer) return;
    A.safe('film dusk', () => {
      W.setDim(0.6); W.layer.opacity('hail', 0.2, { ms: sk ? 0 : 900 }); W.ambient(false);
      W.flyTo({ bounds: W.presets.region, pad: A.stacked() ? 12 : 70 }, { ms: 2800, instant: sk || A.still, ease: 'inOutSine' });
    });
  }
  function restoreWorld() {
    const W = A.world; if (!W || !W.layer) return;
    const v = A.view.get(A.view.current) || {};
    A.safe('film world', () => { W.setDim(v.dim || 0); W.layer.opacity('hail', v.hail == null ? 1 : v.hail, { ms: 500 }); W.ambient(v.ambient !== false); });
  }
  function handBack(sk) {
    const S = window.Sound; if (S) A.safe('film score', () => S.score(false));   // the score fades as the app comes back
    root.classList.add('dir-hot');
    frame('out', !sk);
    A.ui.chrome(true);
    restoreWorld();
    goView('now');
    Sign.home(sk);
  }

  /* ======================= the frame: letterbox, layout, inert ======================= */
  /** state 'cold' (the cold open: no top band, a scrim under the captions) | 'in' (both bands) | 'out' */
  function frame(state, animate) {
    const d = F.dom; if (!d || F.frame === state) return;
    const was = F.frame; F.frame = state;
    d.root.dataset.frame = state;
    layout(state !== 'out');
    const mv = !A.still && animate !== false;
    const tIn = state === 'in', bIn = state !== 'out', solid = state === 'in';
    slide(d.lbT, tIn ? 'none' : 'translateY(-101%)', mv, tIn ? 760 : 520);
    slide(d.lbB, bIn ? 'none' : 'translateY(101%)', mv, bIn && was === 'out' ? 760 : 560);
    fade(d.lbBg, solid ? 1 : 0, mv ? 700 : 0);
    fade(d.scrim, state === 'cold' ? 1 : 0, mv ? 500 : 0);
  }
  function slide(el, to, mv, ms) {
    if (!el) return;
    const from = el.style.transform || getComputedStyle(el).transform;
    el.style.transform = to;
    if (!mv) { if (A.still && to === 'none') crossIn(el); return; }
    A.safe('film slide', () => { el.getAnimations().forEach((a) => a.cancel()); el.animate([{ transform: from === 'none' ? 'none' : from }, { transform: to }], { duration: ms, easing: A.motion.css.out }); });
  }
  function fade(el, to, ms) {
    if (!el) return;
    const from = +(getComputedStyle(el).opacity || 0);
    el.style.opacity = String(to);
    if (!ms || A.still) return;
    A.safe('film fade', () => el.animate([{ opacity: from }, { opacity: to }], { duration: ms, easing: A.motion.css.ease }));
  }
  function crossIn(el) { A.safe('film cross', () => el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 360, easing: A.motion.css.ease })); }
  function bandB() { if (!F.dom || A.stacked()) return 0; return Math.round(F.dom.lbB.getBoundingClientRect().height); }
  /** the slots keep clear of the bottom band; the map's focus follows; a visible dock glides to its new place */
  function layout(on) {
    if (on === F.laid) { if (on) { A.view.reserve({ b: bandB() }); } return; }
    F.laid = on;
    const dock = document.getElementById('slot-bottom');
    const vis = dock && dock.hasAttribute('data-on') && !root.classList.contains('no-chrome') && !A.stacked();
    const before = vis ? dock.getBoundingClientRect().top : null;
    root.classList.toggle('dir-frame', on);
    A.view.reserve(on ? { b: bandB() } : null);
    A.view.relayout({ ms: A.still ? 0 : 520 });
    if (before != null && !A.still) {
      const dy = before - dock.getBoundingClientRect().top;
      if (Math.abs(dy) > 2) A.safe('film dock', () => dock.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }], { duration: 680, easing: A.motion.css.out }));
    }
  }
  function inert(on) {
    ['topbar', 'stage', 'world'].forEach((id) => { const el = document.getElementById(id); if (el) el.inert = !!on; });
  }

  /* ======================= input while the film plays ======================= */
  function onKey(e) {
    if (!F.on || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key, t = e.target;
    const onBtn = t && t.closest && t.closest('.dir-bar button, .dir-glass-hint');
    const eat = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    if (k === 'Escape') { eat(); finish(false, { user: true }); return; }
    if ((k === ' ' || k === 'Spacebar' || k === 'Enter') && onBtn) { e.stopImmediatePropagation(); return; }   // the focused control answers
    if (k === ' ' || k === 'Spacebar') { eat(); if (!e.repeat) toggle(); return; }
    if (k === 'ArrowLeft') { eat(); if (!e.repeat) prev(); return; }
    if (k === 'ArrowRight') { eat(); if (!e.repeat) next(); return; }
    if (k === 'm' || k === 'M') { eat(); if (!e.repeat) mute(); return; }
    if (k === '?') { eat(); pause(); keys(); return; }
    if (/^[1-9]$/.test(k)) { eat(); const v = A.view.byKey(k); finish(false, { user: true, to: v || undefined }); return; }
    if (k === 'Tab' || k === 'Enter' || k === 'Shift') return;
    if (k.length === 1 || /^(Arrow|Page|Home|End|Backspace|Delete)/.test(k)) eat();            // views never act under the film
  }
  function mute() { if (A.sound) A.sound.toggle(); const S = window.Sound; if (S && S.enabled && F.playing) A.safe('film score', () => S.score(true)); UI.sound(); }
  let rz = 0;
  function onResize() { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { if (!F.on) return; if (F.laid) { A.view.reserve({ b: bandB() }); A.view.relayout({ ms: 0 }); } UI.progress(true); }); }
  function listen(on) {
    if (on) {
      addEventListener('keydown', onKey, true);
      addEventListener('resize', onResize);
      F.offs.push(A.on('lang', () => UI.lang()), A.on('sound', () => UI.sound()));
      const sc = () => UI.sound(); addEventListener('sound:change', sc); F.offs.push(() => removeEventListener('sound:change', sc));
    } else {
      removeEventListener('keydown', onKey, true);
      removeEventListener('resize', onResize);
      F.offs.splice(0).forEach((f) => A.safe('film off', f));
    }
  }

  /* ======================= captions ======================= */
  const Cap = {
    tok: 0,
    words(s) { return String(s).split(' ').map((w) => '<span class="dir-w"><span class="dir-w__i">' + A.esc(w) + '</span></span>').join(' '); },
    show(i, animate) {
      if (!F.dom) return;
      const c = BEATS[i] ? bcopy(BEATS[i].id) : null; if (!c || !c.caption) return;
      const box = F.dom.cap, my = ++this.tok;
      const html = (c.kicker ? '<p class="dir-cap__k"><span class="dir-cap__dot" aria-hidden="true"></span>' + A.L(A.esc(c.kicker.en), A.esc(c.kicker.es)) + '</p>' : '') +
        '<p class="dir-cap__t">' + A.L(this.words(c.caption.en), this.words(c.caption.es || c.caption.en)) + '</p>';
      const put = () => {
        if (my !== this.tok || !F.dom) return;
        box.innerHTML = html; box.classList.add('is-on');
        if (!animate) return;
        if (A.still) { crossIn(box); return; }
        const ws = A.$$('.' + A.lang + ' .dir-w__i', box);
        A.safe('caption rise', () => {
          ws.forEach((w, k) => w.animate([{ transform: 'translateY(112%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 760, delay: 40 + k * 44, easing: A.motion.css.hail, fill: 'backwards' }));
          const kk = box.querySelector('.dir-cap__k'); if (kk) kk.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 60, easing: A.motion.css.out, fill: 'backwards' });
        });
      };
      if (animate && box.classList.contains('is-on') && box.childElementCount && !A.still) {
        A.safe('caption out', () => box.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px)' }], { duration: 170, easing: A.motion.css.ease }).finished.then(put, put));
      } else put();
    },
    hide(animate) {
      const box = F.dom && F.dom.cap; if (!box) return;
      const my = ++this.tok;
      const clear = () => { if (my === this.tok && box.isConnected) { box.innerHTML = ''; box.classList.remove('is-on'); } };
      if (animate && !A.still && box.childElementCount) A.safe('caption out', () => box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: A.motion.css.ease }).finished.then(clear, clear));
      else clear();
    }
  };

  /* ======================= the film's own UI ======================= */
  const ttl = (i) => cp(bcopy(BEATS[i].id).title, BEATS[i].id, BEATS[i].id);
  const UI = {
    mount() {
      if (F.dom) return;
      const ticks = BEATS.map((d, i) => { const t = ttl(i);
        return '<button type="button" class="dir-tick" data-i="' + i + '" style="flex-grow:' + d.ms + '" ' + attrs(labelOf({ en: sub(cp(CTRL.chapter, 'Chapter {i}: {t}').en, { i: i + 1, t: t.en }), es: sub(cp(CTRL.chapter, '', 'Capítulo {i}: {t}').es, { i: i + 1, t: t.es }) })) +
          ' data-tip="' + A.esc(pad2(i + 1) + ' · ' + t.en) + '" data-tip-es="' + A.esc(pad2(i + 1) + ' · ' + t.es) + '"><i class="dir-tick__fill"></i></button>'; }).join('');
      const el = A.h(`<div class="dir" data-frame="out" role="region" tabindex="-1" ${attrs(labelOf(cp(FILM.title, 'The film', 'La película')))}>
        <div class="dir-glass" ${attrs(labelOf(cp(CTRL.glass, 'Click anywhere to pause', 'Haz clic donde sea para pausar')))}></div>
        <div class="dir-spots" aria-hidden="true"></div>
        <div class="dir-lb dir-lb--t" aria-hidden="true"></div>
        <div class="dir-lb dir-lb--b">
          <div class="dir-lb__scrim" aria-hidden="true"></div>
          <div class="dir-lb__bg" aria-hidden="true"></div>
          <div class="dir-cap" role="status" aria-live="polite"></div>
          <div class="dir-bar" role="group" ${attrs(labelOf(cp(CTRL.label, 'Film controls', 'Controles de la película')))}>
            <div class="dir-bar__l">
              <button type="button" class="dir-btn dir-btn--play" data-dir="toggle" data-knock>${ic('pause', 16)}</button>
              <button type="button" class="dir-btn" data-dir="prev" data-knock ${attrs(labelOf(cp(CTRL.prev, 'Previous chapter', 'Capítulo anterior')))} data-tip="${A.esc(cp(CTRL.prev, 'Previous chapter').en)} · ←" data-tip-es="${A.esc(cp(CTRL.prev, '', 'Capítulo anterior').es)} · ←">${ic('prev', 15)}</button>
              <button type="button" class="dir-btn" data-dir="next" data-knock ${attrs(labelOf(cp(CTRL.next, 'Next chapter', 'Siguiente capítulo')))} data-tip="${A.esc(cp(CTRL.next, 'Next chapter').en)} · →" data-tip-es="${A.esc(cp(CTRL.next, '', 'Siguiente capítulo').es)} · →">${ic('next', 15)}</button>
              <span class="dir-bar__chap" aria-hidden="true"><b class="num"></b><span class="dir-bar__t"></span></span>
            </div>
            <div class="dir-ticks" role="group" ${attrs(labelOf(cp(CTRL.chapters, 'Chapters', 'Capítulos')))}>${ticks}</div>
            <div class="dir-bar__r">
              <span class="dir-bar__time num" aria-hidden="true"><b>0:00</b><span> / ${mmss(TOTAL)}</span></span>
              <button type="button" class="dir-btn dir-btn--snd" data-dir="mute" data-knock aria-pressed="false"></button>
              <button type="button" class="dir-btn dir-btn--exit" data-dir="exit" data-knock ${attrs(labelOf(cp(CTRL.exitLong, 'Exit the film', 'Salir de la película')))}><span>${Lx(cp(CTRL.exit, 'Exit', 'Salir'))}</span><span class="kbd">Esc</span></button>
            </div>
          </div>
        </div>
        <div class="dir-flash" aria-hidden="true"><span></span></div>
        <div class="dir-veil" aria-hidden="true"></div>
      </div>`);
      A.ui.icons(el); A.ui.localize(el);
      overlay().appendChild(el);
      F.dom = {
        root: el, glass: el.querySelector('.dir-glass'), spots: el.querySelector('.dir-spots'), lbT: el.querySelector('.dir-lb--t'), lbB: el.querySelector('.dir-lb--b'),
        lbBg: el.querySelector('.dir-lb__bg'), scrim: el.querySelector('.dir-lb__scrim'), cap: el.querySelector('.dir-cap'), bar: el.querySelector('.dir-bar'),
        play: el.querySelector('[data-dir="toggle"]'), snd: el.querySelector('[data-dir="mute"]'), chapN: el.querySelector('.dir-bar__chap b'), chapT: el.querySelector('.dir-bar__t'),
        time: el.querySelector('.dir-bar__time b'), ticks: A.$$('.dir-tick', el), fills: A.$$('.dir-tick__fill', el), flash: el.querySelector('.dir-flash'), veil: el.querySelector('.dir-veil'), last: -1
      };
      F.frame = 'out';
      // bands start off screen; the chapter decides how they come in
      F.dom.lbT.style.transform = 'translateY(-101%)'; F.dom.lbB.style.transform = 'translateY(101%)';
      F.dom.lbBg.style.opacity = '0'; F.dom.scrim.style.opacity = '0';
      el.addEventListener('click', (e) => {
        const bt = e.target.closest('[data-dir]');
        if (bt) { const a = bt.dataset.dir; if (a === 'toggle') toggle(); else if (a === 'prev') prev(); else if (a === 'next') next(); else if (a === 'mute') mute(); else if (a === 'exit') finish(false, { user: true }); return; }
        const tk = e.target.closest('.dir-tick');
        if (tk) { enter(+tk.dataset.i, 0); return; }
        if (e.target === F.dom.glass) toggle();
      });
      this.state(); this.sound(); this.chapter(0, false);
      F.tick = (now) => { if (!F.on) { F.tick = null; return false; } this.progress(false); return true; };
      A.motion.ticker.add(F.tick);
    },
    unmount() {
      const d = F.dom; if (!d) return;
      F.dom = null;
      if (F.tick) { A.motion.ticker.remove(F.tick); F.tick = null; }
      const kill = () => d.root.remove();
      if (A.still) { kill(); return; }
      d.glass.remove(); d.root.classList.add('is-leaving');     // the bands slide away and no longer catch clicks
      setTimeout(kill, 760);
    },
    chapter(i, animate) {
      const d = F.dom; if (!d || i < 0 || !BEATS[i]) return;
      const t = ttl(i);
      d.chapN.textContent = pad2(i + 1);
      d.chapT.innerHTML = Lx(t);
      d.ticks.forEach((b, k) => { b.classList.toggle('is-done', k < i); b.classList.toggle('is-cur', k === i); if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
      if (animate) A.safe('film chapter', () => A.motion.reveal(d.chapT.parentElement, { y: 8, ms: 460 }));
    },
    progress(force) {
      const d = F.dom; if (!d || F.i < 0) return;
      const t = filmTime();
      d.fills.forEach((f, k) => {
        const p = k < F.i ? 1 : k > F.i ? 0 : A.clamp((t - AT[k]) / BEATS[k].ms, 0, 1);
        if (force || k === F.i || f._p !== p) { if (f._p !== p) { f._p = p; f.style.transform = 'scaleX(' + p.toFixed(4) + ')'; } }
      });
      const s = Math.floor(t / 1000);
      if (force || s !== d.last) { d.last = s; d.time.textContent = mmss(t); }
    },
    state() {
      const d = F.dom; if (!d) return;
      const p = F.playing, o = p ? cp(CTRL.pause, 'Pause', 'Pausa') : cp(CTRL.play, 'Play', 'Reproducir');
      d.play.innerHTML = ic(p ? 'pause' : 'play', 16);
      d.play.dataset.labelEn = o.en + ' (Space)'; d.play.dataset.labelEs = o.es + ' (Espacio)';
      d.play.dataset.tip = o.en + ' · Space'; d.play.dataset.tipEs = o.es + ' · Espacio';
      d.root.classList.toggle('is-paused', !p);
      A.ui.localize(d.bar);
    },
    sound() {
      const d = F.dom; if (!d) return;
      const on = A.sound ? A.sound.shown : !!snd(), o = on ? cp(CTRL.mute, 'Mute', 'Silenciar') : cp(CTRL.unmute, 'Turn sound on', 'Activar sonido');
      d.snd.innerHTML = ic(on ? 'sound' : 'mute', 16);
      d.snd.setAttribute('aria-pressed', String(!on));
      d.snd.dataset.labelEn = o.en + ' (M)'; d.snd.dataset.labelEs = o.es + ' (M)';
      d.snd.dataset.tip = o.en + ' · M'; d.snd.dataset.tipEs = o.es + ' · M';
      A.ui.localize(d.bar);
    },
    lang() { this.state(); this.sound(); if (F.i >= 0) this.chapter(F.i, false); },
    /** the glass click answers: a play or pause glyph blooms in the middle of the frame */
    flash(playing) {
      const d = F.dom; if (!d || A.still) return;
      const g = d.flash.firstElementChild; g.innerHTML = ic(playing ? 'play' : 'pause', 26);
      A.safe('film flash', () => g.animate([{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'scale(1)', offset: 0.35 }, { opacity: 0, transform: 'scale(1.18)' }], { duration: 640, easing: A.motion.css.out }));
    },
    /** A.still: a short crossfade marks every cut */
    veil() { const d = F.dom; if (!d) return; A.safe('film veil', () => d.veil.animate([{ opacity: 0 }, { opacity: 0.55, offset: 0.4 }, { opacity: 0 }], { duration: 560, easing: A.motion.css.ease })); }
  };

  /* ======================= the sign-off mark ======================= */
  const Sign = {
    el: null, tw: null, p: null, offT: null,
    show(sk) {
      this.remove();
      if (!F.dom) return;
      const el = (this.el = A.h('<div class="dir-sign" aria-hidden="true"><canvas class="dir-sign__cv"></canvas>' +
        '<p class="dir-sign__word">' + 'Aldaba'.split('').map((c) => '<span>' + c + '</span>').join('') + '</p>' +
        '<p class="dir-sign__cut">' + ic('spark', 12) + A.L("Claude's cut", 'Versión de Claude') + '</p></div>'));
      F.dom.root.insertBefore(el, F.dom.lbT);
      const p = (this.p = { roof: 0, dot: 0, ring: 0, glow: 0 });
      this.offT = A.on('theme', () => this.draw());
      if (sk || A.still) { Object.assign(p, { roof: 1, dot: 1, ring: 1, glow: 1 }); this.draw(); if (!sk) crossIn(el); return; }
      this.draw();
      this.tw = A.motion.tween({ from: 0, to: 1, ms: 1500, ease: 'linear', update: (x) => {
        p.roof = E.outCubic(A.clamp(x / 0.3, 0, 1)); p.dot = E.hail(A.clamp((x - 0.2) / 0.32, 0, 1));
        p.ring = E.inOutCubic(A.clamp((x - 0.28) / 0.56, 0, 1)); p.glow = A.clamp((x - 0.7) / 0.3, 0, 1);
        this.draw();
      } });
      const tok = F.tok;
      setTimeout(() => {                                   // the ring closes: the knock
        if (!this.el || F.tok !== tok) return;
        const cv = this.el.querySelector('canvas'), r = cv.getBoundingClientRect();
        A.motion.ripple(r.left + r.width / 2, r.top + r.height * (31.5 / 48), { rings: 3, size: r.width * 1.5 });
        const s = snd(); if (s) { s.knock({ count: 2, gain: 0.85 }); s.ring(0, { gain: 0.55, delay: 0.3, tail: 1 }); }
      }, 1340);
      A.motion.stagger(A.$$('.dir-sign__word span', el), { each: 46, y: 28, ms: 760, delay: 900 });
      A.motion.reveal(el.querySelector('.dir-sign__cut'), { y: 12, ms: 620, delay: 1350, ring: true, size: 80 });
    },
    draw() {
      const el = this.el; if (!el) return;
      const cv = el.querySelector('canvas'), p = this.p;
      const W = Math.max(40, Math.round(cv.clientWidth || 150)), dpr = Math.min(2, devicePixelRatio || 1);
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(W * dpr); }
      const c = cv.getContext('2d'); if (!c) return;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
      const s = (W * dpr) / 48; c.setTransform(s, 0, 0, s, 0, 0);
      const acc = A.rgba('--acc'), txt = A.tok('--text') || '#fff', col = (a) => 'rgba(' + Math.round(acc[0] * 255) + ',' + Math.round(acc[1] * 255) + ',' + Math.round(acc[2] * 255) + ',' + a + ')';
      if (p.glow > 0) { const g = c.createRadialGradient(24, 31.5, 3, 24, 31.5, 23); g.addColorStop(0, col(0.34 * p.glow)); g.addColorStop(1, col(0)); c.fillStyle = g; c.fillRect(0, 0, 48, 48); }
      c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = 5;
      if (p.roof > 0) { c.strokeStyle = txt; c.beginPath(); c.moveTo(24, 8); c.lineTo(24 - 15 * p.roof, 8 + 11 * p.roof); c.moveTo(24, 8); c.lineTo(24 + 15 * p.roof, 8 + 11 * p.roof); c.stroke(); }
      if (p.dot > 0) { c.fillStyle = txt; c.beginPath(); c.arc(24, 17, 3 * p.dot, 0, TAU); c.fill(); }
      if (p.ring > 0) { c.strokeStyle = col(1); c.beginPath(); c.arc(24, 31.5, 10, -Math.PI / 2, -Math.PI / 2 + TAU * p.ring); c.stroke(); }
    },
    /** the mark, the name and the cut fly into the top bar, where the app keeps them */
    home(sk) {
      const el = this.el; if (!el) return;
      const pairs = [[el.querySelector('canvas'), A.$('#topbar .brand__mark')], [el.querySelector('.dir-sign__word'), A.$('#topbar .brand__word')], [el.querySelector('.dir-sign__cut'), A.$('#topbar .brand__cut')]];
      if (sk || A.still) { this.remove(); return; }
      pairs.forEach(([a, b]) => {
        if (!a) return;
        const r = a.getBoundingClientRect(), t = b && b.getBoundingClientRect();
        if (!t || !t.width || !r.width) { A.safe('sign out', () => a.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' })); return; }
        const sc = t.height / r.height, dx = t.left + t.width / 2 - (r.left + r.width / 2), dy = t.top + t.height / 2 - (r.top + r.height / 2);
        A.safe('sign home', () => a.animate([{ transform: 'none' }, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sc + ')' }], { duration: 900, easing: A.motion.css.hail, fill: 'forwards' }));
      });
      const tok = F.tok;
      setTimeout(() => { if (this.el === el && F.tok === tok) A.safe('sign fade', () => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: 'forwards' }).finished.then(() => { if (this.el === el) this.remove(); })); }, 940);
    },
    remove() {
      if (this.tw) { this.tw.cancel(); this.tw = null; }
      if (this.offT) { this.offT(); this.offT = null; }
      if (this.el) this.el.remove();
      this.el = null;
    }
  };

  /* ======================= "Your turn" ======================= */
  let endEl = null, endT = 0;
  function endCard() {
    closeEnd();
    const el = (endEl = A.h(`<div class="dir-end" role="status" aria-live="polite">
      <span class="dir-end__ring" aria-hidden="true"></span>
      <div class="dir-end__txt"><b class="dir-end__t">${Lx(cp(CTRL.yourTurn, 'Your turn.', 'Te toca.'))}</b><span class="dir-end__s">${Lx(cp(UIX.toast && UIX.toast.filmEnd, 'That was the film. The app is yours.', 'Eso fue la película. La app es tuya.'))}</span></div>
      <div class="dir-end__acts">
        <button type="button" class="btn btn--secondary btn--sm" data-end="replay">${ic('play', 14)}${Lx(cp(UIX.topbar && UIX.topbar.replay, 'Replay', 'Repetir'))}</button>
        <button type="button" class="btn btn--ghost btn--sm" data-end="credits" aria-haspopup="dialog">${ic('spark', 14)}${Lx(cp(UIX.topbar && UIX.topbar.madeBy, 'Made by Claude', 'Hecho por Claude'))}</button>
        <button type="button" class="btn btn--ghost btn--icon btn--sm" data-end="close" ${attrs(labelOf(cp(CTRL.dismiss, 'Dismiss', 'Cerrar')))}>${ic('x', 15)}</button>
      </div></div>`));
    A.ui.localize(el);
    overlay().appendChild(el);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-end]'); if (!b) return;
      const a = b.dataset.end; closeEnd(true);
      if (a === 'replay') play(); else if (a === 'credits') credits(b);
    });
    let hold = false;
    el.addEventListener('pointerenter', () => { hold = true; }); el.addEventListener('pointerleave', () => { hold = false; });
    el.addEventListener('focusin', () => { hold = true; }); el.addEventListener('focusout', () => { hold = false; });
    const tick = () => { if (endEl !== el) return; if (hold) { endT = setTimeout(tick, 1500); return; } closeEnd(true); };
    endT = setTimeout(tick, 9000);
    if (!A.still) {
      A.motion.reveal(el, { y: 18, ms: 640 });
      setTimeout(() => { if (endEl === el) A.motion.ripple(el.querySelector('.dir-end__ring'), { rings: 2, size: 64 }); }, 260);
    }
    const s = snd(); if (s) s.ring(2, { gain: 0.5 });
  }
  function closeEnd(animate) {
    clearTimeout(endT);
    const el = endEl; endEl = null; if (!el) return;
    if (animate && !A.still) A.motion.exit([el], { ms: 180, y: 10 }).then(() => el.remove()); else el.remove();
  }

  /* ======================= dialogs (credits, keys): one small modal kit ======================= */
  function modal(el, box, opener, onClose) {
    const prev = opener || document.activeElement;
    const close = (animate) => {
      if (!el.isConnected) return;
      removeEventListener('keydown', onKey2, true);
      const done = () => { el.remove(); A.safe('dialog focus back', () => { if (prev && prev.isConnected && prev.focus) prev.focus({ preventScroll: true }); }); if (onClose) onClose(); };
      if (animate !== false && !A.still) A.motion.exit([box], { ms: 170, y: 10 }).then(done); else done();
    };
    const onKey2 = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
      if (e.key !== 'Tab') return;
      const f = A.$$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', box).filter((n) => !n.disabled && n.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1], at = document.activeElement;
      if (!box.contains(at)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && at === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
    };
    addEventListener('keydown', onKey2, true);
    el.addEventListener('pointerdown', (e) => { if (!box.contains(e.target)) close(); });
    return close;
  }

  /* ======================= the credits: "Made by Claude" ======================= */
  let colo = null;
  const fmtBytes = (b, l) => (b >= 1e6 ? A.fmt.num(b / 1e6, 1, l) + ' MB' : A.fmt.num(Math.round(b / 1e3), 0, l) + ' KB');
  const count = (id) => { const s = (S26.sources || []).find((x) => x.id === id); return s ? s.count : 0; };
  function credits(opener) {
    if (colo) return;
    if (F.on) finish(false, { user: true, card: false });
    closeKeys(); closeEnd();
    const C = COL, M = MANIFEST, nf = (v) => A.both(() => A.fmt.int(v));
    const cnt = (o, n) => '<span class="colo-n">' + A.L(A.esc(sub(o.en, { n: A.fmt.int(n, 'en') })), A.esc(sub(o.es, { n: A.fmt.int(n, 'es') }))) + '</span>';
    const K = C.counts || {};
    const streets = (N.columbus || []).length + (N.fremont || []).length;
    const realCounts = [
      [K.spc && cnt(K.spc, count('spc')), K.lsr && cnt(K.lsr, count('lsr')), K.ncei && cnt(K.ncei, count('ncei')), K.hist && cnt(K.hist, ((X.hist || {}).pts || []).length)],
      [K.radar && cnt(K.radar, count('radar')), K.mrms && cnt(K.mrms, count('mrms'))],
      [K.streets && cnt(K.streets, streets), K.features && cnt(K.features, (N.base || []).length)],
      [K.census && cnt(K.census, count('census'))],
      [K.rules && cnt(K.rules, ((COPY.deal || {}).armor || []).length)]
    ];
    const USGS = { label: 'USGS', tip: { en: 'USGS National Hydrography Dataset: rivers, streams and water bodies', es: 'Conjunto Nacional de Hidrografía del USGS: ríos, arroyos y cuerpos de agua' } };
    const realTags = [['spc', 'lsr', 'ncei'], ['radar', 'mrms'], ['streets', USGS], ['census'], ['law']];
    const real = ((C.real || {}).items || []).map((it, i) => `<li class="colo-item">
        <p class="colo-item__n">${Lx(it.name)} ${(realTags[i] || []).map((k) => A.ui.srcTag(k)).join(' ')}</p>
        <p class="colo-item__s">${Lx(it.source)}</p>
        ${(realCounts[i] || []).filter(Boolean).length ? '<p class="colo-item__c">' + realCounts[i].filter(Boolean).join('') + '</p>' : ''}</li>`).join('');
    const sample = ((C.sample || {}).items || []).map((it) => `<li class="colo-item"><p class="colo-item__n">${Lx(it.name)} <span class="sample">${Le('sample', 'muestra')}</span></p><p class="colo-item__s">${Lx(it.detail)}</p></li>`).join('');
    const built = ((C.built || {}).items || []).map((it, i) => `<li class="colo-built__i"><span class="colo-built__n num">${pad2(i + 1)}</span><p>${Lx(it)}</p></li>`).join('');
    const MOD = C.modules || {};
    const modKey = (f) => { const b = f.split('/').pop().replace(/\.(js|css)$/, ''); return f.startsWith('css/') ? 'css' : b; };
    let numbers = '';
    if (M && M.code) {
      const code = M.code.slice().sort((a, b) => b[1] - a[1]);
      const cssN = (M.css || []).reduce((s, x) => s + x[1], 0), jsN = code.reduce((s, x) => s + x[1], 0), total = jsN + cssN;
      const rows = code.concat(cssN ? [['css/*.css', cssN]] : []);
      const max = Math.max.apply(null, rows.map((r) => r[1]));
      const dataB = (M.data || []).reduce((s, x) => s + x[1], 0);
      numbers = `<section class="colo-sec colo-num">
          <p class="sec">${Lx(cp((C.numbers || {}).title, 'By the numbers', 'En números'))} <span class="sec__meta">${Lx(cp((C.numbers || {}).note, 'Counted from the files when this page was built.', 'Contado en los archivos al construir esta página.'))}</span></p>
          <div class="colo-num__stats">
            <div class="colo-stat"><b class="num" data-count="${total}">${nf(total)}</b><span>${Lx(cp((C.numbers || {}).lines, 'lines of code, by hand', 'líneas de código, a mano'))}</span></div>
            <div class="colo-stat"><b class="num">${A.both(() => fmtBytes(dataB))}</b><span>${Lx(cp((C.numbers || {}).data, 'of real Nebraska data', 'de datos reales de Nebraska'))}</span></div>
            <div class="colo-stat"><b class="num">${rows.length - (cssN ? 1 : 0) + (M.css || []).length}</b><span>${Lx(cp((C.numbers || {}).files, 'code files', 'archivos de código'))}</span></div>
            <div class="colo-stat"><b class="num">0</b><span>${Lx(cp((C.numbers || {}).frameworks, 'frameworks', 'frameworks'))}</span></div>
          </div>
          <div class="colo-num__cols">
            <div><p class="colo-h3">${Lx(cp((C.numbers || {}).code, 'The code', 'El código'))}</p><ol class="colo-bars">${rows.map((r) => { const k = modKey(r[0]), d = MOD[k];
              return `<li class="colo-bar"><span class="colo-bar__f">${A.esc(r[0])}</span><span class="colo-bar__d">${d ? Lx(d) : ''}</span><span class="colo-bar__v num">${nf(r[1])}</span><span class="colo-bar__t"><i style="--k:${(r[1] / max).toFixed(4)}"></i></span></li>`; }).join('')}</ol></div>
            <div><p class="colo-h3">${Lx(cp((C.numbers || {}).dataFiles, 'The data', 'Los datos'))}</p><ol class="colo-bars colo-bars--data">${(M.data || []).map((r) => { const k = modKey(r[0]), d = MOD[k];
              return `<li class="colo-bar"><span class="colo-bar__f">${A.esc(r[0])}</span><span class="colo-bar__d">${d ? Lx(d) : ''}</span><span class="colo-bar__v num">${A.both(() => fmtBytes(r[1]))}</span></li>`; }).join('')}</ol>
              <p class="colo-craft">${Lx(cp((C.credits || {}).craft, 'No frameworks. No image files. Every sound synthesized.', 'Sin frameworks. Sin archivos de imagen. Cada sonido, sintetizado.'))}</p></div>
          </div></section>`;
    }
    const means = ((C.meanings || {}).items || []).map((m) => `<li class="colo-ring"><span class="colo-ring__g">${GLYPH[m.id] || GLYPH.stone}</span><span class="colo-ring__n">${Lx(m.name)}</span></li>`).join('');
    const CR = C.credits || {};
    const day = String(N.as_of || N.today || S26.today || '').slice(0, 10);   // the engine's run, the day the app lives in
    const asOf = sub(cp(C.asOf, 'Storm data as of {date}', 'Datos de tormentas al {date}').en, { date: A.fmt.date(day, 'long', 'en') });
    const asOfEs = sub(cp(C.asOf, 'Storm data as of {date}', 'Datos de tormentas al {date}').es, { date: A.fmt.date(day, 'long', 'es') });
    const A2 = C.actions || {};
    const el = A.h(`<div class="colo" role="dialog" aria-modal="true" aria-labelledby="colo-h">
      <div class="colo__scrim" aria-hidden="true"></div>
      <div class="colo__box" tabindex="-1">
        <button type="button" class="btn btn--ghost btn--icon colo__x" data-colo="close" ${attrs(labelOf(cp(A2.close, 'Close the credits', 'Cerrar los créditos')))}>${ic('x')}</button>
        <header class="colo-head">
          <div class="colo-head__txt">
            <p class="eyebrow eyebrow--acc">${Lx(cp(C.eyebrow, 'Credits', 'Créditos'))} · ${Le("Claude's cut", 'Versión de Claude')}</p>
            <h2 id="colo-h" class="colo-title">${Lx(cp(C.title, 'Made by Claude', 'Hecho por Claude'))}<span class="colo-title__dot">.</span></h2>
            <p class="colo-lead">${Lx(C.intro || { en: '', es: '' })}</p>
            <p class="colo-asof t-micro">${A.L(A.esc(asOf), A.esc(asOfEs))} ${A.ui.srcTag('storms')}</p>
            <div class="colo-acts">
              <button type="button" class="btn btn--primary" data-colo="film">${ic('play')}${Lx(cp(A2.playFilm, 'Play the film', 'Ver la película'))}</button>
              <button type="button" class="btn btn--secondary" data-colo="intro">${ic('film')}${Lx(cp(A2.replayIntro, 'Replay the intro', 'Repetir la introducción'))}</button>
            </div>
          </div>
          <div class="colo-mark" aria-hidden="true">${MARK_SVG}</div>
        </header>
        <section class="colo-sec colo-two">
          <div><p class="sec">${Lx(cp((C.real || {}).title, 'What is real', 'Lo que es real'))}</p><ul class="colo-list">${real}</ul></div>
          <div><p class="sec">${Lx(cp((C.sample || {}).title, 'What is sample', 'Lo que es de muestra'))}</p><ul class="colo-list">${sample}</ul></div>
        </section>
        <section class="colo-sec">
          <p class="sec">${Lx(cp((C.built || {}).title, 'How it was built', 'Cómo se hizo'))}</p>
          <ol class="colo-built">${built}</ol>
        </section>
        ${numbers}
        <section class="colo-sec colo-thesis">
          <p class="sec">${Lx(cp((C.thesis || {}).title, 'Why one ring', 'Por qué un solo anillo'))}</p>
          <div class="colo-thesis__grid">
            <p class="colo-thesis__body">${Lx(cp((C.thesis || {}).body, '', ''))} <span class="colo-sig">${Lx(cp((C.thesis || {}).signature, 'Claude', 'Claude'))}</span></p>
            <div><p class="colo-h3">${Lx(cp((C.meanings || {}).title, 'The ring, five ways', 'El anillo, de cinco maneras'))}</p><ol class="colo-rings">${means}</ol></div>
          </div>
        </section>
        <footer class="colo-sec colo-end">
          <p class="colo-end__k">${Lx(cp(CR.roles, 'Direction, design, engineering, motion, sound', 'Dirección, diseño, ingeniería, animación, sonido'))}</p>
          <p class="colo-end__name">${Lx(cp(CR.name, 'Claude', 'Claude'))}</p>
          <p class="colo-end__with">${Lx(cp(CR.with, 'Built with FilthE for HMP Siding & Roofing, Fremont, NE', 'Hecho con FilthE para HMP Siding & Roofing, Fremont, NE'))}</p>
          <dl class="colo-end__dl">
            <div><dt>${Lx(cp(CR.storms, 'Storms', 'Tormentas'))}</dt><dd>NOAA SPC · NWS · NCEI · NEXRAD · MRMS</dd></div>
            <div><dt>${Lx(cp(CR.map, 'Map', 'Mapa'))}</dt><dd>Nebraska GIS · USGS · NDOT · ${Le('US Census TIGER', 'TIGER del Censo de EE. UU.')}</dd></div>
            <div><dt>${Lx(cp(CR.area, 'Area numbers', 'Números del área'))}</dt><dd>${Le('US Census ACS ' + (S26.census_vintage || '2024'), 'ACS ' + (S26.census_vintage || '2024') + ' del Censo de EE. UU.')}</dd></div>
            <div><dt>${Lx(cp(CR.law, 'The law', 'La ley'))}</dt><dd>${Lx(cp(CR.lawSrc, 'Nebraska Revised Statutes', 'Estatutos Revisados de Nebraska'))}</dd></div>
            <div><dt>${Lx(cp(CR.type, 'Type', 'Tipografía'))}</dt><dd>Bricolage Grotesque · Geist · Geist Mono</dd></div>
          </dl>
          <p class="colo-end__mark">${MARK_SVG}<span>Aldaba</span></p>
        </footer>
      </div></div>`);
    A.ui.localize(el);
    overlay().appendChild(el);
    const box = el.querySelector('.colo__box');
    const close = modal(el, box, opener, () => { if (colo && colo.el === el) colo = null; });
    colo = { el, close };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-colo]'); if (!b) return;
      const a = b.dataset.colo;
      if (a === 'close') close();
      else if (a === 'film') { close(false); play(); }
      else if (a === 'intro') { close(false); if (A.intro && A.intro.play) A.safe('replay intro', () => A.intro.play({ force: true })); }
    });
    A.safe('credits focus', () => box.focus({ preventScroll: true }));
    if (!A.still) {
      A.safe('credits in', () => box.animate([{ opacity: 0, transform: 'translateY(26px)' }, { opacity: 1, transform: 'none' }], { duration: 640, easing: A.motion.css.hail }));
      A.motion.stagger(A.$$('.colo-head__txt > *, .colo-sec', box).slice(0, 9), { each: 55, y: 14, ms: 620, delay: 80 });
      const bars = A.$$('.colo-bar__t i', box);
      A.safe('credits bars', () => bars.forEach((b, k) => b.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(var(--k))' }], { duration: 900, delay: 360 + k * 28, easing: A.motion.css.out, fill: 'backwards' })));
      const tot = box.querySelector('[data-count]'); if (tot) A.motion.countUp(tot, +tot.dataset.count, { ms: 1300, delay: 300 });
      A.$$('.colo-ring__g', box).forEach((g, k) => setTimeout(() => { if (el.isConnected) A.motion.ripple(g, { rings: 1, size: 54 }); }, 700 + k * 120));
    }
    const s = snd(); if (s) s.ring(0, { gain: 0.45 });
  }
  function closeCredits() { if (colo) { const c = colo; colo = null; c.close(false); } }

  // the brand mark, and the ring's five meanings as small drawings
  const MARK_SVG = '<svg viewBox="0 0 48 48" focusable="false" aria-hidden="true"><path d="M9 19 24 8 39 19" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="17" r="3" fill="currentColor"/><circle cx="24" cy="31.5" r="10" fill="none" stroke="var(--acc)" stroke-width="5"/></svg>';
  const G = (inner) => '<svg viewBox="0 0 44 44" focusable="false" aria-hidden="true">' + inner + '</svg>';
  const GLYPH = {
    stone: G('<path d="M22 5v7M16.5 8v5M27.5 8v5" stroke="var(--faint)" stroke-width="1.6" stroke-linecap="round"/><circle cx="22" cy="27" r="6.5" fill="none" stroke="var(--acc)" stroke-width="3"/>'),
    ripple: G('<circle cx="22" cy="22" r="4" fill="none" stroke="var(--acc)" stroke-width="3"/><circle cx="22" cy="22" r="10.5" fill="none" stroke="var(--acc)" stroke-width="1.6" opacity=".6"/><circle cx="22" cy="22" r="17" fill="none" stroke="var(--acc)" stroke-width="1.2" opacity=".28"/>'),
    zone: G('<circle cx="22" cy="22" r="15" fill="none" stroke="var(--acc)" stroke-width="3"/><circle cx="17" cy="20" r="1.8" fill="var(--text-2)"/><circle cx="24.5" cy="17.5" r="1.8" fill="var(--text-2)"/><circle cx="26" cy="25.5" r="1.8" fill="var(--text-2)"/><circle cx="19" cy="27" r="1.8" fill="var(--text-2)"/>'),
    door: G('<path d="M13 38V8.8A1.8 1.8 0 0 1 14.8 7h14.4A1.8 1.8 0 0 1 31 8.8V38M9 38h26" fill="none" stroke="var(--text-2)" stroke-width="1.8" stroke-linecap="round"/><circle cx="22" cy="20" r="5" fill="none" stroke="var(--acc)" stroke-width="3"/>'),
    progress: G('<circle cx="22" cy="22" r="14" fill="none" stroke="var(--rule-3)" stroke-width="3"/><path d="M22 8a14 14 0 1 1-13.3 9.7" fill="none" stroke="var(--acc)" stroke-width="3" stroke-linecap="round"/>')
  };

  /* ======================= the key sheet ("?") ======================= */
  let keysEl = null;
  function keys(opener) {
    if (keysEl) { closeKeys(); return; }
    closeEnd();
    const K = UIX.keys || {}, k = (o, en, es) => Lx(cp(o, en, es));
    const kb = (s) => s.split(' ').map((x) => '<span class="kbd">' + A.esc(x) + '</span>').join('');
    const row = (key, what) => '<div class="dir-keys__r"><dt>' + key + '</dt><dd>' + what + '</dd></div>';
    const el = A.h(`<div class="dir-keys" role="dialog" aria-modal="true" aria-labelledby="dir-keys-h">
      <div class="dir-keys__box float" tabindex="-1">
        <div class="dir-keys__top"><p id="dir-keys-h" class="t-head">${k(K.title, 'Keys', 'Teclas')}</p>
          <button type="button" class="btn btn--ghost btn--icon btn--sm" data-keys="close" ${attrs(labelOf(cp(UIX.topbar && UIX.topbar.close, 'Close', 'Cerrar')))}>${ic('x', 15)}</button></div>
        <p class="sec">${k(K.everywhere, 'Everywhere', 'En toda la app')}</p>
        <dl class="dir-keys__l">${row(kb('1') + '<span class="dir-keys__to">' + Le('to', 'a') + '</span>' + kb('5'), k(K.views, 'Switch views', 'Cambiar de vista'))}${row(kb('F'), k(K.film, 'Play the film', 'Ver la película'))}${row(kb('M'), k(K.sound, 'Sound on or off', 'Sonido sí o no'))}${row(kb('?'), k(K.sheet, 'This sheet', 'Esta hoja'))}${row(kb('Esc'), k(K.esc, 'Close, skip or leave', 'Cerrar, saltar o salir'))}</dl>
        <p class="sec">${k(K.inFilm, 'In the film', 'En la película')}</p>
        <dl class="dir-keys__l">${row(kb(A.t('Space', 'Espacio')), k(K.pause, 'Pause or play', 'Pausar o seguir'))}${row(kb('← →'), k(K.chapters, 'Previous or next chapter', 'Capítulo anterior o siguiente'))}</dl>
        <p class="sec">${k(K.onMap, 'On the map', 'En el mapa')}</p>
        <dl class="dir-keys__l">${row(kb('← ↑ → ↓') + kb('+ -'), k(K.move, 'Move and zoom', 'Mover y acercar'))}${row(kb('0'), k(K.back, 'Back to the view', 'Volver a la vista'))}</dl>
        <p class="sec">${k(K.onKnock, 'On Knock', 'En Tocar')}</p>
        <dl class="dir-keys__l">${row(kb('N T I X B'), k(K.outcomes, 'No answer, talked, inspection set, not interested, come back', 'No abrió, hablamos, inspección, no le interesa, regresar'))}${row(kb('U'), k(K.undo, 'Undo the last door', 'Deshacer la última puerta'))}</dl>
      </div></div>`);
    A.ui.localize(el);
    overlay().appendChild(el);
    const box = el.querySelector('.dir-keys__box');
    const close = modal(el, box, opener, () => { if (keysEl === el) keysEl = null; });
    keysEl = el; keysEl._close = close;
    el.addEventListener('click', (e) => { if (e.target.closest('[data-keys="close"]')) close(); });
    A.safe('keys focus', () => box.focus({ preventScroll: true }));
    if (!A.still) A.motion.reveal(box, { y: 14, ms: 560 });
  }
  function closeKeys() { if (keysEl) { const el = keysEl; keysEl = null; if (el._close) el._close(false); else el.remove(); } }

  /* ======================= wiring ======================= */
  document.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('#cut, #credits');
    if (t) { e.preventDefault(); credits(t); }
  });

  A.director = {
    play: (o) => A.safe('director play', () => play(o || {})),
    stop: () => A.safe('director stop', () => finish(false, { user: true })),
    pause: () => A.safe('director pause', pause),
    resume: () => A.safe('director resume', resume),
    toggle: () => A.safe('director toggle', toggle),
    seek: (ms) => A.safe('director seek', () => seek(+ms || 0)),
    next: () => A.safe('director next', next),
    prev: () => A.safe('director prev', prev),
    get playing() { return F.on && F.playing; },
    get active() { return F.on; },
    get time() { return filmTime(); },
    get duration() { return TOTAL; },
    get chapter() { return F.i; },
    beats: BEATS.map((d, i) => ({ id: d.id, at: AT[i], ms: d.ms })),
    report: () => ({ issues: F.issues.slice(), skipped: F.skipped.slice(), touched: Array.from(F.touched) }),
    credits: (opener) => A.safe('credits', () => credits(opener)),
    keys: (opener) => A.safe('keys', () => keys(opener))
  };

  /* dev (screenshots): #<view>&film=<ms> plays the film from <ms>, …&film=<ms>p holds that frame (no sound: no gesture);
     &credits=1 opens the credits, &keys=1 the key sheet, &yourturn=1 the end card. */
  (function devHook() {
    const h = String(location.hash || '') + '&' + String(location.search || '');
    const m = h.match(/[#&?]film=(\d+)(p?)/), has = (k) => new RegExp('[#&?]' + k + '=1').test(h);
    if (!m && !has('credits') && !has('keys') && !has('yourturn')) return;
    const go = () => setTimeout(() => {
      if (m) A.director.play({ at: +m[1], pause: m[2] === 'p', gesture: false });
      else if (has('credits')) A.director.credits();
      else if (has('keys')) A.director.keys();
      else A.safe('dev end card', endCard);
    }, 80);
    if (A.ready) go(); else A.once('ready', go);
  })();
})();
