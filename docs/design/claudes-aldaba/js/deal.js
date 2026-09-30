/* Claude's Aldaba · js/deal.js · #deal
   One door, from first knock to a signed job, with Nebraska's legal armor.
   Desktop: left = the door (address, a key plan from real street centerlines, the numbers) + the selected step (what to
   collect, the law with its cite, next, done when, the cancel clock, the build gate) + actions. Center = the hero: the
   house portrait (House.js) drawn live over a pool of dark, the highlight and numbered marks follow the step (a mark sits
   on the part of the house each checklist item is about), and a legal stamp says when work may start. Bottom dock = the
   path (a fuse that burns to where this door is), the 12 armor rules and "Hand to homeowner".
   Overlay = the homeowner sheet, HMP Siding & Roofing (never Aldaba), EN and ES side by side, printed-paper surface.
   Stacked (<= 900 px): map (the real lot) -> portrait -> vertical path -> door + step -> armor.
   Per-viewer state (ticks, where the door is, sale date, job type, gate) lives in A.store, keyed by the sample address.
   Director: A.dealDemo = {step(i), select(i), open(), close(), tick(k, on), state()}.
   Dev: #deal&sheet=1 opens the homeowner sheet, #deal&step=6 selects a step (1-based). */
(function () {
  'use strict';
  const A = window.A; if (!A || !A.view) return;

  /* ------------------------------------------------------------------ dev params (#deal&sheet=1&step=6)
     The router only knows '#deal', so the params are read here (this file loads before boot.js) and the hash is left clean. */
  const DEV = {};
  try {
    const m = /^#deal[&?](.+)$/.exec(location.hash || '');
    if (m) {
      const keep = [];
      m[1].split('&').forEach((kv) => {
        const i = kv.indexOf('='), k = i < 0 ? kv : kv.slice(0, i), v = i < 0 ? '1' : decodeURIComponent(kv.slice(i + 1));
        if (k === 'sheet' || k === 'step') DEV[k] = v; else if (k) keep.push(kv);
      });
      history.replaceState(null, '', location.pathname + location.search + '#deal' + (keep.length ? '&' + keep.join('&') : ''));
    }
  } catch (e) { /* a sandboxed frame without history: no dev params */ }

  /* ------------------------------------------------------------------ copy + helpers */
  const CP = window.COPY || {};
  const CD = CP.deal || { labels: {}, steps: [], armor: [], homeowner: {} };
  const LB = CD.labels || {};
  const STEPS = CD.steps || [];
  const N = STEPS.length || 8;
  const E = (o) => (o ? A.L(A.esc(o.en), A.esc(o.es == null ? o.en : o.es)) : '');     // escaped EN/ES spans
  const L = (en, es) => A.L(A.esc(en), A.esc(es));
  const pad2 = (n) => String(n).padStart(2, '0');
  const cite = (c) => String(c || '').replace(/^Neb\. Rev\. Stat\.\s*/, '');
  const snd = (fn) => { try { const S = window.Sound; if (S && S.enabled) fn(S); } catch (e) { /* sound is optional */ } };
  const fill = (o, v) => ({ en: String(o.en).replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? (typeof v[k] === 'object' ? v[k].en : v[k]) : m)),
    es: String(o.es).replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? (typeof v[k] === 'object' ? v[k].es : v[k]) : m)) });
  const TITLE = { en: 'Deal', es: 'Trato' };   // the tab's word (index.html, Knock's "Abrir en Trato")

  /* what the drawing lights up for each step, and which part of the house each checklist item is about */
  const HL = { intro: null, look: 'siding', inspection: 'roof', adjuster: 'roof', itemized: null, contract: null, window: null, build: 'roof' };
  const PARTS = {
    intro: ['door'],
    look: ['door', 'siding', 'gutters', 'metal', 'side'],
    inspection: ['roof', 'siding', 'eave'],
    adjuster: [null, null, 'roof', 'door'],
    itemized: [['roof', 'siding', 'gutters']],
    contract: [], window: [],
    build: [null, null, null, null, 'yard', ['roof', 'side']]
  };
  const PART_HL = { door: null, siding: 'siding', side: 'siding', gutters: 'gutters', metal: 'gutters', eave: 'roof', roof: 'roof', yard: null };
  const PART_NAME = {
    roof: { en: 'roof', es: 'techo' }, siding: { en: 'siding', es: 'siding' }, side: { en: 'side wall', es: 'pared lateral' },
    gutters: { en: 'gutters', es: 'canaletas' }, metal: { en: 'soft metals', es: 'metal blando' }, eave: { en: 'roofline', es: 'orilla del techo' },
    door: { en: 'front door', es: 'puerta principal' }, yard: { en: 'yard', es: 'patio' }
  };
  const partsOf = (s, k) => { const p = ((s && PARTS[s.id]) || [])[k]; return p == null ? [] : Array.isArray(p) ? p : [p]; };
  const FORM = { cottage: { en: 'Cottage', es: 'Casa pequeña' }, ranch: { en: 'Ranch', es: 'Casa de un piso' }, split: { en: 'Split-level', es: 'De medio nivel' },
    two: { en: 'Two-story', es: 'De dos pisos' }, large: { en: 'Large two-story', es: 'Grande de dos pisos' } };
  const X = {
    doorHere: { en: 'This door is here', es: 'Esta puerta va aquí' },
    done: { en: 'Done', es: 'Listo' },
    ahead: { en: 'Ahead', es: 'Más adelante' },
    markDone: { en: 'Mark step done', es: 'Marcar paso listo' },
    reopen: { en: 'Reopen from this step', es: 'Reabrir desde este paso' },
    finishFirst: { en: 'Finish "{t}" first', es: 'Primero termina "{t}"' },
    reset: { en: 'Reset door', es: 'Reiniciar puerta' },
    hand: { en: 'Hand to homeowner', es: 'Entregar al dueño' },
    jobDone: { en: 'Job complete', es: 'Trabajo terminado' },
    noLaw: { en: 'No statute sets this step. The photos are the record.', es: 'Ningún estatuto regula este paso. Las fotos son el registro.' },
    stepOf: { en: 'Step {i} of {n}', es: 'Paso {i} de {n}' },
    paper: { en: 'paper step', es: 'paso de papeleo' },
    onHouse: { en: 'Marked on the house', es: 'Marcado en la casa' }
  };

  /* ------------------------------------------------------------------ business days (the cancel window)
     Nebraska 69-1601 does not define "business day"; 69-1604(2) points to the FTC Cooling-Off Rule, whose 16 CFR 429.0
     counts every day except Sunday and federal holidays. We skip Sundays, all 11 federal holidays (5 U.S.C. 6103) and the
     weekday a weekend holiday is observed on: a window counted too short is the risky direction, so this one errs long. */
  const DAYMS = 864e5;
  const parse = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; };
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  function nth(y, m, wd, n) {
    if (n > 0) { const d1 = new Date(Date.UTC(y, m, 1)).getUTCDay(); return Date.UTC(y, m, 1 + ((wd - d1 + 7) % 7) + 7 * (n - 1)); }
    const last = new Date(Date.UTC(y, m + 1, 0)), dl = last.getUTCDay(); return Date.UTC(y, m, last.getUTCDate() - ((dl - wd + 7) % 7));
  }
  const holCache = {};
  function holidays(y) {
    if (holCache[y]) return holCache[y];
    const H = {};
    const add = (ms, en, es) => {
      const k = iso(ms); if (!H[k]) H[k] = { en, es };
      const wd = new Date(ms).getUTCDay();
      const obs = wd === 6 ? ms - DAYMS : wd === 0 ? ms + DAYMS : null;
      if (obs != null && !H[iso(obs)]) H[iso(obs)] = { en: en + ' (observed)', es: es + ' (día observado)' };
    };
    add(Date.UTC(y, 0, 1), "New Year's Day", 'Año Nuevo');
    add(nth(y, 0, 1, 3), 'Martin Luther King Jr. Day', 'Día de Martin Luther King Jr.');
    add(nth(y, 1, 1, 3), "Washington's Birthday", 'Natalicio de Washington');
    add(nth(y, 4, 1, -1), 'Memorial Day', 'Día de los Caídos');
    add(Date.UTC(y, 5, 19), 'Juneteenth', 'Juneteenth');
    add(Date.UTC(y, 6, 4), 'Independence Day', 'Día de la Independencia');
    add(nth(y, 8, 1, 1), 'Labor Day', 'Día del Trabajo');
    add(nth(y, 9, 1, 2), 'Columbus Day', 'Día de la Raza');
    add(Date.UTC(y, 10, 11), 'Veterans Day', 'Día de los Veteranos');
    add(nth(y, 10, 4, 4), 'Thanksgiving', 'Día de Acción de Gracias');
    add(Date.UTC(y, 11, 25), 'Christmas Day', 'Navidad');
    return (holCache[y] = H);
  }
  const holidayOn = (d) => { const y = +d.slice(0, 4); return holidays(y)[d] || holidays(y + 1)[d] || null; };
  /** the sale day, then every day up to the end: counted (1..3) or skipped (Sunday / federal holiday) */
  function cancelWindow(saleIso) {
    const t0 = parse(saleIso); if (t0 == null) return null;
    const days = [{ iso: iso(t0), kind: 'sale' }];
    let n = 0, t = t0;
    while (n < 3 && days.length < 14) {
      t += DAYMS;
      const d = iso(t), wd = new Date(t).getUTCDay(), hol = holidayOn(d);
      if (wd === 0) days.push({ iso: d, kind: 'skip', why: { en: 'Sunday', es: 'Domingo' }, short: { en: 'Sunday', es: 'Domingo' } });
      else if (hol) days.push({ iso: d, kind: 'skip', why: hol, short: { en: 'Holiday', es: 'Feriado' } });
      else days.push({ iso: d, kind: 'count', n: ++n });
    }
    const end = days[days.length - 1].iso;
    return { days, end, endMs: parse(end) + DAYMS, startMs: t0 };
  }
  const storyNow = () => { const d = parse(A.story.today) || Date.now(); const m = /^(\d+):(\d+)/.exec(A.story.time || '07:02'); return d + (m ? (+m[1] * 60 + +m[2]) * 6e4 : 0); };
  const BDAY_TAG = () => A.ui.srcTag({ label: '16 CFR 429', cls: 'src--law', tip: {
    en: 'Business day: every day except Sunday and federal holidays (FTC Cooling-Off Rule, 16 CFR 429, which Neb. 69-1604 points to). A weekend holiday also skips its observed weekday, so the window never runs short.',
    es: 'Día hábil: todos los días excepto el domingo y los feriados federales (Regla de la FTC, 16 CFR 429, a la que remite el 69-1604 de Nebraska). Un feriado en fin de semana también salta su día observado, así el plazo nunca queda corto.' } });

  /* ------------------------------------------------------------------ the door + per-viewer state */
  function home() {
    const hs = (A.data && A.data.homes) || [];
    const d = A.dealHome && A.dealHome.p ? A.dealHome : null;
    return d || hs.find((h) => h.rank === 1) || hs[0] || { addr: '3944 21 St', st: '21 St', p: [-97.377365, 41.436869], built: 1978, roof: 21, own: true, hail: 1.68, score: 91, rank: 1 };
  }
  const blankTicks = () => { const t = {}; STEPS.forEach((s) => (t[s.id] = (s.collect || []).map(() => false))); return t; };
  function setTicks(S, id, vals) { if (S.ticks[id]) S.ticks[id] = S.ticks[id].map((_, i) => !!vals[i]); }
  /** the sample door sits at step 3 with an inspection set; a door from Knock starts where its outcome left it */
  function defaults(h) {
    const S = { v: 1, cur: 2, sel: 2, ticks: blankTicks(), type: 'ins', signed: A.story.today, gate: { ho: false, ins: false } };
    const fromKnock = !!h && Object.prototype.hasOwnProperty.call(h, 'outcome');
    const said = fromKnock ? !!h.legal : true;              // Knock's 69-1602 check is intro item 1
    if (!fromKnock || h.outcome === 'inspection_set') {
      setTicks(S, 'intro', [said, true, true, false]);
      setTicks(S, 'look', [true, true, true, true, true]);
      setTicks(S, 'inspection', [true, false, false, true, false, false]);
      return S;
    }
    S.cur = 0; S.sel = 0;
    if (h.outcome === 'talked' || h.outcome === 'come_back') setTicks(S, 'intro', [said, true, false, false]);
    else if (h.outcome === 'not_interested') setTicks(S, 'intro', [said, false, false, false]);
    return S;
  }
  const keyOf = (h) => 'deal:v1:' + String((h && h.addr) || 'home');
  function load(h) {
    const S = defaults(h), got = A.store.get(keyOf(h), null);
    if (got && got.v === 1) {
      if (Number.isInteger(got.cur)) S.cur = A.clamp(got.cur, 0, N);
      if (Number.isInteger(got.sel)) S.sel = A.clamp(got.sel, 0, N - 1);
      if (got.type === 'ins' || got.type === 'cash') S.type = got.type;
      if (parse(got.signed) != null) S.signed = got.signed;
      if (got.gate) S.gate = { ho: !!got.gate.ho, ins: !!got.gate.ins };
      if (got.ticks) STEPS.forEach((s) => { const a = got.ticks[s.id]; if (Array.isArray(a)) S.ticks[s.id] = S.ticks[s.id].map((v, i) => !!a[i]); });
    }
    return S;
  }

  /* ------------------------------------------------------------------ module state (one live view at a time) */
  let V = null;
  let drawnFor = null;     // the first visit draws the house slowly; coming back to the same house draws it at double speed
  const save = () => { if (V && !V.demo) A.store.set(keyOf(V.h), V.S); };

  /* ------------------------------------------------------------------ view */
  A.view.register('deal', {
    title: TITLE, key: '4', ambient: false, dim: 0.3, hail: 0.3,
    camera(frame) {
      const h = home();
      return { center: h.p, zoom: frame.stacked ? 17.7 : 17.35 };
    },
    enter(ctx) { A.safe('deal enter', () => enter(ctx)); },
    exit() { if (V) A.safe('deal exit', () => teardown()); }
  });

  function teardown() {
    if (!V) return;
    stopBuild(); if (V.fuseTw) V.fuseTw.cancel(); if (V.fadeTw) V.fadeTw.cancel();
    if (V.ro) try { V.ro.disconnect(); } catch (e) { /* ignore */ }
    if (V.modal) closeSheet(true);
    V = null;
  }

  function enter(ctx) {
    const h = home();
    V = { ctx, h, S: load(h), demo: false, fuseP: 0, hover: null, built: false, marksOn: false, stacked: A.stacked() };
    ctx.own(() => { if (V && V.ctx === ctx) teardown(); });
    if (DEV.step) { V.S.sel = A.clamp((+DEV.step | 0) - 1, 0, N - 1); delete DEV.step; }   // dev params act once per page load

    /* center: the portrait */
    V.stage = ctx.el('center', `
      <div class="deal-sheet">
        <div class="deal-pool" aria-hidden="true"></div>
        <div class="deal-draw">
          <canvas class="deal-cv deal-cv--a" aria-hidden="true"></canvas><canvas class="deal-cv deal-cv--b" aria-hidden="true"></canvas>
          <p class="sr">${L(portraitLabel('en'), portraitLabel('es'))}</p>
          <div class="deal-marks"></div>
        </div>
        <div class="deal-stamp" role="status" hidden></div>
        <p class="deal-cap deal-cap--l"><span>${elevationName(h)}</span>${A.ui.sampleTag()}<span class="deal-cap__rule" aria-hidden="true"></span>
          <span>${L('Hail rings', 'Anillos de granizo')}</span>${A.ui.srcTag('mrms')}
          <span class="deal-cap__k" data-h="1"><i></i>1 ${L('in', 'pulg')}</span><span class="deal-cap__k" data-h="15"><i></i>1.5</span><span class="deal-cap__k" data-h="2"><i></i>2+</span></p>
        <p class="deal-cap deal-cap--r"></p>
      </div>
      <div class="deal-trackmount deal-trackmount--center"></div>`, 'deal-stage');
    V.stage.setAttribute('data-no-in', '');
    V.sheet = A.$('.deal-sheet', V.stage); V.pool = A.$('.deal-pool', V.stage); V.draw = A.$('.deal-draw', V.stage);
    V.cvA = A.$('.deal-cv--a', V.stage); V.cvB = A.$('.deal-cv--b', V.stage);
    V.front = V.cvA; V.back = V.cvB; V.cvA.style.zIndex = '1'; V.cvB.style.opacity = '0';
    V.marks = A.$('.deal-marks', V.stage); V.stamp = A.$('.deal-stamp', V.stage);

    /* left: the door, then the selected step, then the actions */
    V.head = ctx.el('left', headHTML(h), 'pane deal-head');
    V.keyCv = A.$('.deal-key__cv', V.head);
    V.step = ctx.el('left', '', 'pane deal-step');
    V.step.setAttribute('role', 'tabpanel'); V.step.id = 'deal-step';
    V.foot = ctx.el('left', '', 'pane pane--foot deal-foot');

    /* bottom dock: the path + the armor + the homeowner button */
    V.dock = ctx.el('bottom', `
      <div class="deal-dock__path"><p class="sec deal-dock__sec">${E(LB.stepsTab || { en: 'The path', es: 'El camino' })} <span class="sec__meta deal-dock__where"></span></p></div>
      <div class="deal-trackmount deal-trackmount--dock"></div>
      <div class="deal-dock__armor">
        <p class="sec deal-armor__sec">${E(LB.armorTitle || { en: 'Legal armor', es: 'Armadura legal' })} ${A.ui.srcTag('law')} <span class="sec__meta deal-dock__note">${E(LB.armorNote)}</span></p>
        <div class="deal-armor">${armorHTML()}</div>
      </div>
      <div class="deal-dock__hand"><button type="button" class="btn btn--secondary btn--sm deal-handbtn" data-act="sheet" aria-haspopup="dialog"><i data-icon="doc" class="i--sm"></i>${E(X.hand)}</button></div>`, 'pane pane--tight deal-dock');

    /* the track: built once, mounted in the dock (desktop) or under the portrait (stacked) */
    V.track = A.h(trackHTML()); A.ui.icons(V.track); A.ui.localize(V.track);
    mountTrack();

    /* events */
    V.track.addEventListener('click', (e) => { const b = V && e.target.closest('.deal-node'); if (b) select(+b.dataset.i); });
    V.track.addEventListener('keydown', onTrackKey);
    V.dock.addEventListener('click', (e) => {
      const a = e.target.closest('.deal-arm'); if (a) { select(+a.dataset.step); return; }
      if (e.target.closest('[data-act="sheet"]')) openSheet(e.target.closest('button'));
    });
    V.step.addEventListener('click', onStepClick);
    V.step.addEventListener('change', onStepChange);
    V.step.addEventListener('pointerover', onItemHover); V.step.addEventListener('focusin', onItemHover);
    V.step.addEventListener('pointerleave', () => setHover(null)); V.step.addEventListener('focusout', (e) => { if (V && !V.step.contains(e.relatedTarget)) setHover(null); });
    V.marks.addEventListener('click', onMarkClick);
    V.marks.addEventListener('pointerover', (e) => { const m = e.target.closest('.deal-mark'); if (m) setHover(m.dataset.part, +m.dataset.k); });
    V.marks.addEventListener('pointerleave', () => setHover(null));
    V.foot.addEventListener('click', onFootClick);
    ctx.on('lang', () => { if (!V) return; paintNow(); renderCaps(); renderWhere(); renderStamp(false); drawKey(); if (A.$('.deal-clock', V.step)) renderClock(); if (A.$('.deal-gate', V.step)) renderGate(); });
    ctx.on('theme', () => { if (!V) return; themeCache = null; V.hiShown = undefined; paintNow(); drawKey(); });
    ctx.on('escape', () => { if (V && V.modal) closeSheet(); else skipIntro(); });
    ctx.on('deal:home', () => { if (A.view.current === 'deal') A.view.go('deal', { force: true, instant: true }); });

    /* sizes: the portrait fills the free area above the dock */
    const relay = () => A.safe('deal layout', layout);
    try { V.ro = new ResizeObserver(relay); V.ro.observe(V.dock); V.ro.observe(ctx.slots.center); } catch (e) { /* old browser */ }
    const onRz = () => relay(); addEventListener('resize', onRz); ctx.own(() => removeEventListener('resize', onRz));

    /* the lot on the map (the hero on phones, where the map sits above the portrait) */
    ctx.layer({ id: 'deal-site', z: 205, draw2d: drawSite });
    ctx.pin('deal-home', h.p, A.h(`<div class="deal-pin"><span class="deal-pin__addr">${A.esc(h.addr || '')}</span><span class="deal-pin__meta">${A.esc(Number(h.p[1]).toFixed(4))}° N · ${A.esc(Math.abs(Number(h.p[0])).toFixed(4))}° W</span></div>`), { anchor: 'top', minZoom: 16, offset: [0, 26] });

    /* first paint */
    renderStep(false); renderFoot(); renderWhere(); renderCaps(); updateTrack(); updateArmor(); drawKey();
    layout();
    ctx.on('view', () => relay());
    requestAnimationFrame(() => { if (V && V.ctx === ctx) relay(); });
    V.siteT0 = performance.now(); if (A.world && A.world.keepAlive) A.world.keepAlive(1900);

    /* the entrance: the fuse burns to this door's step; the house draws itself once the camera lands on the lot */
    if (A.still) { setFuse(V.S.cur, false); V.built = true; paintNow(); showMarks(false); renderStamp(false); }
    else {
      setFuse(0, false);
      ctx.timer(() => burnTo(V.S.cur, { ms: 420 + 170 * V.S.cur }), 420);
      try { V.pool.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: A.motion.css.out, fill: 'backwards' }); } catch (e) { /* ignore */ }
      A.motion.stagger(A.$$('.deal-cap', V.stage), { each: 70, y: 8, ms: 520, delay: 180 });
      let started = false;
      const go = () => { if (started || !V || V.ctx !== ctx) return; started = true; startBuild(); };
      ctx.on('camera:end', (d) => { if (!d || d.zoom > 16) go(); });
      ctx.timer(go, 2400);
    }
    if (DEV.sheet) {
      delete DEV.sheet;
      const open = () => { if (V && V.ctx === ctx) openSheet(null); };
      if (A.ready) ctx.timer(open, A.still ? 60 : 900); else A.once('ready', () => setTimeout(open, A.still ? 60 : 900));
    }
  }

  /** which way the front faces: toward the nearest point of its own street's centerline (NE GIS) */
  function facing(h) {
    const s = ((A.data.walk && A.data.walk.s) || []).find((x) => x.n === h.st);
    if (!s || !s.p || s.p.length < 2 || !h.p) return null;
    const kx = Math.cos(h.p[1] * Math.PI / 180), P = (q) => [(q[0] - h.p[0]) * kx, q[1] - h.p[1]];
    let best = null, bd = Infinity;
    for (let i = 1; i < s.p.length; i++) {
      const a = P(s.p[i - 1]), b = P(s.p[i]), dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-12;
      const t = A.clamp(-(a[0] * dx + a[1] * dy) / L2, 0, 1), q = [a[0] + dx * t, a[1] + dy * t], d = Math.hypot(q[0], q[1]);
      if (d < bd) { bd = d; best = q; }
    }
    if (!best) return null;
    return Math.abs(best[0]) > Math.abs(best[1]) ? (best[0] > 0 ? 'E' : 'W') : (best[1] > 0 ? 'N' : 'S');
  }
  const DIRS = { N: ['North', 'norte'], S: ['South', 'sur'], E: ['East', 'este'], W: ['West', 'oeste'] };
  function elevationName(h) {
    const f = facing(h), d = f && DIRS[f];
    if (!d) return L('Elevation', 'Fachada');
    return `${L(d[0] + ' elevation', 'Fachada ' + d[1])}<span class="deal-cap__faces">${L('faces ' + h.st, 'frente a ' + h.st)}</span>`;
  }
  function portraitLabel(lang) {
    const h = home(), f = window.House ? House.form(h) : 'ranch', fm = (FORM[f] || FORM.ranch)[lang];
    return lang === 'es'
      ? 'Dibujo de la fachada de la casa de muestra en ' + h.addr + ': ' + fm.toLowerCase() + ', construida en ' + h.built + ', anillos de granizo en el techo.'
      : 'Elevation drawing of the sample home at ' + h.addr + ': ' + fm.toLowerCase() + ', built ' + h.built + ', hail rings on the roof.';
  }

  function headHTML(h) {
    const f = window.House ? House.form(h) : 'ranch';
    const zid = String((A.data.walk && A.data.walk.zone_id) || ''), storm = (/^(\d{4}-\d{2}-\d{2})/.exec(zid) || [])[1];
    const town = (/_([A-Za-z ]+)~/.exec(zid) || [])[1] || 'Columbus';
    const slot = h.slot && h.slot.day ? `<p class="deal-head__slot"><span class="chip chip--acc"><i data-icon="clock"></i>${L('Inspection', 'Inspección')} · ${A.both(() => A.fmt.date(h.slot.day, 'day'))} · ${A.both(() => A.fmt.time(h.slot.time))}</span></p>` : '';
    return `
      <div class="deal-head__top">
        <p class="eyebrow eyebrow--acc">${E(TITLE)} · ${L('Door', 'Puerta')} ${A.esc(String(h.rank || 1))} ${A.ui.sampleTag()}</p>
        <p class="t-micro deal-head__pos"></p>
      </div>
      <div class="deal-head__id">
        <div class="deal-head__who">
          <h1 class="t-title deal-head__addr">${A.esc(h.addr || '')}</h1>
          <p class="t-small deal-head__sub">${A.esc(town)}, NE · ${E(FORM[f] || FORM.ranch)} · ${h.own ? L('owner lives here', 'vive el dueño') : L('may be rented', 'puede ser rentada')}</p>
          ${slot}
        </div>
        <figure class="deal-key">
          <canvas class="deal-key__cv" role="img" data-label-en="Key plan: the sample lot and the real streets around it" data-label-es="Plano de ubicación: el lote de muestra y las calles reales a su alrededor"></canvas>
          <figcaption class="deal-key__cap"><span>${L('Site', 'Sitio')}</span>${A.ui.srcTag('streets')}</figcaption>
        </figure>
      </div>
      <div class="stats deal-stats">
        <div class="stat"><span class="stat__k">${L('Hail here', 'Granizo aquí')} ${A.ui.srcTag('mrms')}</span><span class="stat__v" data-h="${A.ui.hailKey(h.hail)}">${h.hail == null ? '–' : A.both(() => A.fmt.inches(h.hail))}</span></div>
        <div class="stat"><span class="stat__k">${L('Storm', 'Tormenta')} ${A.ui.srcTag('spc')}</span><span class="stat__v">${storm ? A.both(() => A.fmt.date(storm)) : '–'}</span></div>
        <div class="stat"><span class="stat__k">${L('Roof', 'Techo')} ${A.ui.sampleTag()}</span><span class="stat__v">${A.esc(String(h.roof == null ? '–' : h.roof))}<span class="stat__u">${L('yrs', 'años')}</span></span></div>
        <div class="stat"><span class="stat__k">${L('Score', 'Puntaje')} ${A.ui.srcTag('engine')}</span><span class="stat__v">${A.esc(String(h.score == null ? '–' : h.score))}</span></div>
      </div>`;
  }

  /* ------------------------------------------------------------------ layout */
  function mountTrack() {
    const st = A.stacked(), m = A.$(st ? '.deal-trackmount--center' : '.deal-trackmount--dock', st ? V.stage : V.dock);
    V.stacked = st;
    V.track.classList.toggle('is-vert', st);
    if (m && V.track.parentNode !== m) m.appendChild(V.track);
  }
  const CAP0 = 34;         // room at the top of the stage for the caption row (desktop); two rows when they would touch
  const capRoom = () => (V && V.capH) || CAP0;
  /** the two captions share one row when they fit; otherwise the step caption drops to a second row */
  function fitCaps() {
    if (!V || V.stacked) { if (V) { V.sheet.classList.remove('is-tight'); V.capH = CAP0; } return; }
    const l = A.$('.deal-cap--l', V.stage), r = A.$('.deal-cap--r', V.stage); if (!l || !r) return;
    const was = V.sheet.classList.contains('is-tight');
    V.sheet.classList.remove('is-tight');
    const lr = l.getBoundingClientRect(), rr = r.getBoundingClientRect();
    if (!lr.width || !rr.width) { V.sheet.classList.toggle('is-tight', was); return; }   // not laid out yet
    const tight = lr.right + 18 > rr.left;
    V.sheet.classList.toggle('is-tight', tight);
    V.capH = tight ? CAP0 + 22 : CAP0;
  }
  /** where the House composition starts (callout text or roof) in canvas px */
  const compTop = (Lh) => Math.min(Lh.top, Lh.bandY - Lh.fs - 8);
  function measure(w, h) {
    if (!window.House || !(w > 0) || !(h > 0)) return null;
    const cv = V.meas || (V.meas = document.createElement('canvas'));
    House.draw(cv, V.h, { t: 99, theme: houseTheme(), labels: false, sheet: false, width: w, height: h, dpr: 1 });
    return cv.__house && cv.__house.L ? cv.__house.L : null;
  }
  function layout() {
    if (!V) return;
    if (A.stacked() !== V.stacked) { mountTrack(); setFuse(V.fuseP, false); }
    let sw, sh, cw, ch, top = 0;
    if (V.stacked) {
      V.stage.style.height = '';
      sw = Math.round(V.sheet.clientWidth || V.ctx.slots.center.clientWidth || 0);   // the card, never the canvas
      if (!(sw > 0)) return;
      cw = sw; ch = Math.round(A.clamp(sw * 0.64, 220, 400));
      V.draw.style.height = ch + 'px';
    } else {
      const cr = V.ctx.slots.center.getBoundingClientRect(), dr = V.dock.getBoundingClientRect();
      if (!cr.width || !dr.height) return;                  // slots not shown yet: the RO / 'view' event calls again
      sw = Math.round(cr.width); sh = Math.max(260, Math.round(dr.top - cr.top - 12));
      V.stage.style.height = sh + 'px'; V.draw.style.height = '';
      fitCaps();
      cw = sw >= 900 && sw < 1040 ? 899 : sw;                // House pads 7.5% under 900 px and 13% above: 899 is the sweet spot
      ch = sh;
      for (let i = 0; i < 3; i++) {                         // tall houses: slide the drawing down until it clears the caption row
        const Lm = measure(cw, ch); if (!Lm) break;
        const need = capRoom() - (top + compTop(Lm));
        if (need <= 1) break;
        top += Math.ceil(need); ch = sh - top;
      }
    }
    const left = Math.round((sw - cw) / 2);
    const key = [V.stacked ? 's' : 'd', sw, cw, ch, top, capRoom()].join('x');
    if (key === V.sizeKey) return;
    V.sizeKey = key; V.cw = cw; V.ch = ch; V.cx = left; V.cy = top;
    [V.cvA, V.cvB].forEach((c) => { c.style.width = cw + 'px'; c.style.height = ch + 'px'; c.style.left = (V.stacked ? 0 : left) + 'px'; c.style.top = (V.stacked ? 0 : top) + 'px'; });
    Object.assign(V.marks.style, { width: cw + 'px', height: ch + 'px', left: (V.stacked ? 0 : left) + 'px', top: (V.stacked ? 0 : top) + 'px' });
    V.L = measure(cw, ch); V.anchors = V.L ? anchors(V.L) : {};
    if (!V.build) { V.hiShown = undefined; paintNow(); }
    if (V.marksOn) showMarks(false);
    placeStamp();
  }

  /* ------------------------------------------------------------------ portrait */
  let themeCache = null;
  function houseTheme() {
    if (themeCache && themeCache.k === A.theme) return themeCache.t;
    const p = A.rgba('--page'), bg = 'rgba(' + Math.round(p[0] * 255) + ',' + Math.round(p[1] * 255) + ',' + Math.round(p[2] * 255) + ',0)';
    // a see-through bg: House still derives its wall and roof tones from the page color, the map pool shows around the house
    const t = { ink: A.tok('--text'), line: A.tok('--rule-2'), acc: A.tok('--acc'), h0: A.tok('--h0'), h1: A.tok('--h1'), h15: A.tok('--h15'), h2: A.tok('--h2'), bg };
    themeCache = { k: A.theme, t };
    return t;
  }
  function hl() {
    if (!V) return null;
    if (V.hover) { const g = PART_HL[V.hover]; return g === undefined ? null : g; }
    return HL[(STEPS[V.S.sel] || {}).id] || null;
  }
  function paint(cv, t, hi) {
    if (!window.House || !cv || !V || !V.cw) return;
    const c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);   // House fills no bg here: clear it ourselves
    House.draw(cv, V.h, { t, theme: houseTheme(), highlight: hi, labels: House.labels(V.h, A.lang), sheet: false, width: V.cw, height: V.ch });
  }
  function paintNow() {
    if (!V || V.build) return;
    if (!V.built && !A.still) { A.safe('deal portrait', () => paint(V.front, 0, null)); return; }   // waiting for the camera: blank sheet
    A.safe('deal portrait', () => { paint(V.front, null, hl()); V.front.style.opacity = '1'; V.back.style.opacity = '0'; V.hiShown = hl(); });
  }
  function startBuild() {
    if (!V || !window.House) return;
    stopBuild();
    if (A.still) { V.built = true; paintNow(); showMarks(false); renderStamp(false); return; }
    hideMarks();
    let t0 = null, rang = false, marked = false;
    const sp = drawnFor === V.h.addr ? 2.3 : 1.15, end = House.DURATION + 0.1;
    const fn = (now) => {
      if (!V || V.build !== fn) return false;
      if (t0 == null) t0 = now;
      const t = (now - t0) / 1000 * sp;
      A.safe('deal build', () => paint(V.front, Math.min(t, end), hl()));
      if (!rang && t > 3.1) { rang = true; snd((S) => { for (let i = 0; i < 5; i++) S.hail(0.35 + i * 0.1, { surface: 'roof', delay: i * 0.13, gain: 0.5 }); }); }
      if (!marked && t > 4.6) { marked = true; showMarks(true); }
      if (t >= end) {
        const first = drawnFor !== V.h.addr;
        V.build = null; V.built = true; drawnFor = V.h.addr; paintNow(); if (!marked) showMarks(true); renderStamp(true);
        if (first) knockDoor();                            // the house is drawn: someone knocks
        return false;
      }
      return true;
    };
    V.build = fn; A.motion.ticker.add(fn);
  }
  function knockDoor() {
    const d = V && V.anchors && V.anchors.door; if (!d || A.still) return;
    const r = V.marks.getBoundingClientRect();
    A.motion.ripple(r.left + d[0], r.top + d[1], { rings: 2, size: 72 });
    snd((S) => S.knock({ count: 2, gain: 0.7 }));
  }
  function stopBuild() { if (V && V.build) { A.motion.ticker.remove(V.build); V.build = null; } }
  function skipIntro() {
    if (!V) return;
    if (V.build || !V.built) { stopBuild(); V.built = true; paintNow(); showMarks(false); renderStamp(false); }
    if (V.fuseTw) { V.fuseTw.cancel(); V.fuseTw = null; setFuse(V.S.cur, false); V.track.classList.remove('is-burning'); }
  }
  /** the highlight follows the step: the new state goes under, the old one fades out on top (the house never goes see-through) */
  function refocus() {
    if (!V || V.build || !V.built) return;
    const hi = hl();
    if (hi === V.hiShown) return;
    V.hiShown = hi;
    if (A.still) { paintNow(); return; }
    A.safe('deal refocus', () => {
      const top = V.front, under = V.back;
      paint(under, null, hi);
      if (V.fadeTw) V.fadeTw.cancel();
      under.style.zIndex = '1'; under.style.opacity = '1'; top.style.zIndex = '2'; top.style.opacity = '1';
      V.front = under; V.back = top;
      V.fadeTw = A.motion.tween({ from: 1, to: 0, ms: 280, ease: 'inOutSine', update: (v) => { top.style.opacity = String(v); } });
    });
  }
  function renderCaps(hovering) {
    if (!V) return;
    const s = STEPS[V.S.sel] || {}, part = V.hover, hi = part ? null : HL[s.id];
    const name = part ? PART_NAME[part] : hi ? PART_NAME[hi] : null;
    const r = A.$('.deal-cap--r', V.stage);
    if (r) r.innerHTML = `<b class="num">${pad2(V.S.sel + 1)}</b><span class="deal-cap__t">${E(s.title)}</span><span class="deal-cap__arrow" aria-hidden="true">→</span>${name ? `<span class="deal-cap__part">${E(name)}</span>` : `<span class="deal-cap__paper">${E(X.paper)}</span>`}`;
    if (V.stacked || hovering) return;                    // a hover never moves the drawing
    const was = capRoom(); fitCaps();
    if (capRoom() !== was) layout(); else placeStamp();
  }

  /* ------------------------------------------------------------------ marks: each checklist item, on its part of the house */
  function anchors(Lh) {
    const P = Lh.parts || [], out = {};
    const box = (pts) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; pts.forEach((p) => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }); return { x0, y0, x1, y1 }; };
    const area = (pts) => { let a = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]); return Math.abs(a / 2); };
    const inPoly = (pt, poly) => { let ins = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if (((a[1] > pt[1]) !== (b[1] > pt[1])) && (pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0])) ins = !ins; } return ins; };
    const opens = P.filter((q) => q.grp === 'open' && q.pts && q.pts.length > 2).map((q) => box(q.pts));
    const avoid = []; if (Lh.hero && Lh.hero.c) avoid.push(Lh.hero.c); if (Lh.roofA) avoid.push(Lh.roofA);
    const dBox = (p, b) => Math.hypot(Math.max(b.x0 - p[0], 0, p[0] - b.x1), Math.max(b.y0 - p[1], 0, p[1] - b.y1));
    const clear = (p) => Math.min(80, ...opens.map((b) => dBox(p, b)), ...avoid.map((a) => Math.hypot(a[0] - p[0], a[1] - p[1])));
    // a point on part k is only useful if no part drawn after it covers that spot (a garage wing hides a gable wall)
    const seen = (p, k) => { for (let j = k + 1; j < P.length; j++) { const o = P[j].occ; if (o && o.some((poly) => poly.length > 2 && inPoly(p, poly))) return false; } return true; };
    function best(q) {
      const poly = q.pts, k = P.indexOf(q), b = box(poly); let pick = null, score = -1e9;
      for (let i = 1; i < 10; i++) for (let j = 1; j < 5; j++) {
        const p = [b.x0 + (b.x1 - b.x0) * i / 10, b.y0 + (b.y1 - b.y0) * j / 5];
        if (!inPoly(p, poly) || !seen(p, k)) continue;
        const s = clear(p) - Math.abs(i - 5) * 1.2 - Math.abs(j - 2.5) * 2;
        if (s > score) { score = s; pick = p; }
      }
      return pick;
    }
    if (Lh.knock) out.door = [Lh.knock[0], Lh.knock[1]];
    const roofs = P.filter((q) => q.t === 'roof' && q.E0 && q.Es && q.Vs).sort((a, b) => (b.src && b.src.main ? 1 : 0) - (a.src && a.src.main ? 1 : 0));
    for (const roof of roofs) {
      const k = P.indexOf(roof); let pick = null, sc = -1;
      [0.26, 0.42, 0.58, 0.74].forEach((u) => { const p = [roof.E0[0] + roof.Es[0] * u + roof.Vs[0] * 0.52, roof.E0[1] + roof.Es[1] * u + roof.Vs[1] * 0.52]; if (!seen(p, k)) return; const s = clear(p); if (s > sc) { sc = s; pick = p; } });
      if (!pick) continue;
      out.roof = pick;
      for (const u of [0.86, 0.72, 0.56, 0.3]) { const p = [roof.E0[0] + roof.Es[0] * u, roof.E0[1] + roof.Es[1] * u - 1]; if (seen(p, k) && Math.hypot(p[0] - pick[0], p[1] - pick[1]) > 44) { out.eave = p; break; } }
      break;
    }
    const walls = (face) => P.filter((q) => q.t === 'wall' && q.face === face && q.pts && q.pts.length > 2).sort((a, b) => area(b.pts) - area(a.pts));
    for (const q of walls('front')) { const p = best(q); if (p) { out.siding = p; break; } }
    for (const q of walls('side')) { const p = best(q); if (p) { out.side = p; break; } }
    if (!out.side && out.siding) out.side = out.siding;
    const gut = P.find((q) => q.t === 'gutter' && q.band && q.src && !q.src.side) || P.find((q) => q.t === 'gutter' && q.band);
    if (gut) {
      const b = box(gut.band); out.gutters = [b.x0 + (b.x1 - b.x0) * 0.34, (b.y0 + b.y1) / 2];
      const d = gut.downs && gut.downs.find((x) => x && x.length > 1);
      if (d) { const a = d[0], z = d[d.length - 1]; out.metal = [(a[0] + z[0]) / 2, a[1] + (z[1] - a[1]) * 0.62]; }
    }
    if (!out.metal && out.gutters) out.metal = [out.gutters[0] + 40, out.gutters[1]];
    out.yard = [Lh.x0 - 30 > 18 ? Lh.x0 - 30 : Math.min(Lh.w - 18, Lh.x1 + 30), Lh.groundY - 9];   // the yard in front, left of the house (the map's controls sit bottom right)
    return out;
  }
  function marksFor(i) {
    const s = STEPS[i]; if (!s || !V.anchors) return [];
    const list = [];
    (s.collect || []).forEach((c, k) => partsOf(s, k).forEach((part) => { const p = V.anchors[part]; if (p) list.push({ k, part, x: p[0], y: p[1], c }); }));
    // keep marks apart (two parts can sit close on a small house)
    const R = V.stacked ? 20 : 26;
    for (let a = 1; a < list.length; a++) for (let b = 0; b < a; b++) {
      const dx = list[a].x - list[b].x, dy = list[a].y - list[b].y;
      if (Math.hypot(dx, dy) < R) { list[a].x = list[b].x + (dx >= 0 ? R : -R); }
    }
    return list;
  }
  function showMarks(animate) {
    if (!V) return;
    V.marksOn = true;
    const s = STEPS[V.S.sel], t = (s && V.S.ticks[s.id]) || [];
    const list = marksFor(V.S.sel);
    V.marks.innerHTML = list.map((m) => `<button type="button" class="deal-mark${t[m.k] ? ' is-on' : ''}" tabindex="-1" role="checkbox" aria-checked="${!!t[m.k]}"
        data-k="${m.k}" data-part="${m.part}" style="left:${m.x.toFixed(1)}px;top:${m.y.toFixed(1)}px"
        aria-label="${A.esc(A.t(m.c))}" data-tip="${A.esc(m.c.en)}" data-tip-es="${A.esc(m.c.es)}"><span class="deal-mark__n num">${m.k + 1}</span><i data-icon="check"></i></button>`).join('');
    A.ui.icons(V.marks);
    V.marks.dataset.step = String(V.S.sel);
    if (animate && !A.still && list.length) {
      const els = A.$$('.deal-mark', V.marks);
      A.motion.stagger(els, { each: 90, y: 16, ms: 560, delay: 40 });
      els.forEach((el, i) => setTimeout(() => { if (el.isConnected) A.motion.ripple(el, { rings: 1, size: 46 }); }, 40 + i * 90 + 200));
    }
    syncHot();
  }
  function hideMarks() { if (V) { V.marksOn = false; V.marks.innerHTML = ''; } }
  function syncMarks() {
    if (!V || !V.marksOn) return;
    const s = STEPS[V.S.sel], t = (s && V.S.ticks[s.id]) || [];
    A.$$('.deal-mark', V.marks).forEach((m) => { const on = !!t[+m.dataset.k]; m.classList.toggle('is-on', on); m.setAttribute('aria-checked', String(on)); });
  }
  function syncHot() {
    if (!V) return;
    A.$$('.deal-mark', V.marks).forEach((m) => m.classList.toggle('is-hot', V.hotK != null && +m.dataset.k === V.hotK));
    A.$$('.deal-ck', V.step).forEach((b) => b.classList.toggle('is-hot', V.hotK != null && +b.dataset.k === V.hotK));
  }
  /** hovering a checklist item or a mark: the drawing lights that part, the mark lifts */
  function setHover(part, k) {
    if (!V) return;
    const p = part || null, kk = p ? (k == null ? null : k) : null;
    if (p === V.hover && kk === V.hotK) return;
    V.hover = p; V.hotK = kk;
    syncHot(); renderCaps(true); refocus();
  }
  function onItemHover(e) {
    if (!V) return;
    const b = e.target.closest && e.target.closest('.deal-ck[data-k]');
    if (!b) { if (e.type === 'focusin') setHover(null); return; }
    const s = STEPS[V.S.sel], parts = partsOf(s, +b.dataset.k);
    if (!parts.length) { setHover(null); return; }
    setHover(parts.length > 1 ? 'multi' : parts[0], +b.dataset.k);
  }
  function onMarkClick(e) {
    const m = e.target.closest('.deal-mark'); if (!m) return;
    toggleTick(+m.dataset.k);
  }

  /* ------------------------------------------------------------------ the stamp: may work start on this house? */
  function stampState() {
    const S = V.S, s = STEPS[S.sel]; if (!s) return null;
    if (S.cur >= N && S.sel === N - 1) return { ok: true, head: { en: 'Job complete', es: 'Trabajo terminado' }, line: s.next || { en: 'The final payment follows the contract.', es: 'El pago final sigue el contrato.' }, cite: '48-2104' };
    if (S.sel < 4 || (s.id === 'itemized' && S.type !== 'ins')) return null;
    const g = gateState();
    if (S.type === 'ins') {
      return g.clear
        ? { ok: true, head: { en: 'Clear to build', es: 'Listo para la obra' }, line: { en: 'Itemized description sent to both.', es: 'Descripción detallada enviada a los dos.' }, cite: '44-8606' }
        : { ok: false, head: { en: 'No repair yet', es: 'Ninguna reparación aún' }, line: { en: 'Itemized description first, to:', es: 'Primero la descripción detallada, a:' }, cite: '44-8606',
          checks: [[S.gate.ho, { en: 'Homeowner', es: 'Dueño' }], [S.gate.ins, { en: 'Insurer', es: 'Aseguradora' }]] };
    }
    const W = cancelWindow(S.signed);
    return g.clear
      ? { ok: true, head: { en: 'Clear to build', es: 'Listo para la obra' }, line: { en: 'Window closed. Check the mail for a notice mailed inside it.', es: 'El plazo cerró. Revisa el correo por un aviso enviado dentro del plazo.' }, cite: '69-1606(5)' }
      : { ok: false, head: { en: 'No work yet', es: 'Nada de trabajo aún' }, line: W ? { en: 'Cancel window open until midnight, ' + A.fmt.date(W.end, 'day', 'en') + '.', es: 'Plazo abierto hasta la medianoche del ' + A.fmt.date(W.end, 'day', 'es') + '.' } : { en: 'Cancel window open.', es: 'Plazo para cancelar abierto.' }, cite: '69-1606(5)' };
  }
  function renderStamp(animate) {
    if (!V) return;
    const st = V.built || A.still ? stampState() : null;
    const el = V.stamp, key = st ? [st.ok, st.head.en, st.line.en, (st.checks || []).map((c) => c[0] ? 1 : 0).join('')].join('|') : '';
    if (!st) { if (!el.hidden) { V.stampKey = ''; if (animate && !A.still) A.motion.exit([el], { ms: 140 }).then(() => { if (V && !V.stampKey) el.hidden = true; }); else el.hidden = true; } return; }
    if (key === V.stampKey && !el.hidden) return;
    const was = V.stampKey; V.stampKey = key;
    el.classList.toggle('is-ok', st.ok);
    el.innerHTML = `<p class="deal-stamp__h"><i data-icon="${st.ok ? 'check' : 'shield'}" class="i--sm"></i><span>${E(st.head)}</span><span class="deal-stamp__cite">${A.esc(st.cite)}</span></p>
      <p class="deal-stamp__p">${E(st.line)}</p>
      ${st.checks ? `<p class="deal-stamp__cks">${st.checks.map((c) => `<span class="deal-stamp__ck${c[0] ? ' is-on' : ''}"><i data-icon="${c[0] ? 'check' : 'x'}"></i>${E(c[1])}</span>`).join('')}</p>` : ''}`;
    try { el.getAnimations().forEach((a) => a.cancel()); } catch (e) { /* ignore */ }   // a forwards-filled exit must not keep it hidden
    A.ui.icons(el); el.hidden = false; placeStamp();
    if (animate && !A.still) {
      const ring = !was || was.split('|')[0] !== String(st.ok) || was.split('|')[1] !== st.head.en;
      A.motion.reveal(el, { y: 22, ms: 620, ring: false });
      if (ring) {
        setTimeout(() => { if (el.isConnected && !el.hidden) A.motion.ripple(el, { rings: 2, size: Math.max(120, el.offsetWidth * 0.9), color: A.tok(st.ok ? '--ok' : '--warn') }); }, 200);
        snd((S) => S.knock({ count: 1, gain: 0.45, delay: 0.18 }));   // the stamp meets the sheet
      }
    }
  }
  /** what is drawn where: the portrait canvas is see-through, so its alpha says where the house, lines and labels are.
      One small readback per placement (the portrait scaled to 4 px cells). */
  function occupancy() {
    const cv = V.front, C = 4;
    if (!cv || !cv.width || !V.cw) return null;
    const gw = Math.ceil(V.cw / C), gh = Math.ceil(V.ch / C);
    const oc = V.occCv || (V.occCv = document.createElement('canvas'));
    if (oc.width !== gw || oc.height !== gh) { oc.width = gw; oc.height = gh; V.occCtx = null; }
    const c = V.occCtx || (V.occCtx = oc.getContext('2d', { willReadFrequently: true }));
    if (!c) return null;
    let px;
    try { c.clearRect(0, 0, gw, gh); c.imageSmoothingEnabled = true; c.drawImage(cv, 0, 0, gw, gh); px = c.getImageData(0, 0, gw, gh).data; } catch (e) { return null; }
    const grid = new Uint8Array(gw * gh);
    for (let i = 0; i < grid.length; i++) grid[i] = px[i * 4 + 3] > 14 ? 1 : 0;   // lines, labels, walls; not the faint studio light
    return { grid, gw, gh, C };
  }
  /** the stamp takes the first free spot: along the top band from the right, then along the bottom band;
      never on the map's controls (bottom right). Crowded stage: the spot that covers the least. */
  function placeStamp() {
    if (!V || !V.stamp || V.stamp.hidden) return;
    V.stamp.classList.remove('is-compact');
    if (V.stacked) { V.stamp.style.left = ''; V.stamp.style.top = ''; return; }
    const O = occupancy();
    let r = spotFor(O);
    if (r.n > 0) {                                       // crowded: the compact stamp (head + checks) looks again
      V.stamp.classList.add('is-compact');
      const r2 = spotFor(O);
      if (r2.n <= r.n) r = r2; else V.stamp.classList.remove('is-compact');
    }
    V.stamp.style.left = Math.round(r.x) + 'px'; V.stamp.style.top = Math.round(r.y) + 'px';
  }
  function spotFor(O) {
    const w = V.stamp.offsetWidth || 300, h = V.stamp.offsetHeight || 64, sw = V.sheet.clientWidth || V.cw || 0, sh = V.sheet.clientHeight || V.ch || 0;
    const marks = A.$$('.deal-mark', V.marks).map((m) => [V.cx + parseFloat(m.style.left), V.cy + parseFloat(m.style.top)]);
    const hud = { x0: sw - 260, y0: sh - 124, x1: sw + 20, y1: sh + 20 };
    const hit = (x, y, b) => x < b.x1 && x + w > b.x0 && y < b.y1 && y + h > b.y0;
    const cover = (x, y) => {
      let n = 0;
      marks.forEach((m) => { if (m[0] > x - 20 && m[0] < x + w + 20 && m[1] > y - 20 && m[1] < y + h + 20) n += 400; });
      if (!O) return n;
      const gx0 = Math.max(0, Math.floor((x - V.cx - 6) / O.C)), gx1 = Math.min(O.gw - 1, Math.floor((x - V.cx + w + 6) / O.C));
      const gy0 = Math.max(0, Math.floor((y - V.cy - 6) / O.C)), gy1 = Math.min(O.gh - 1, Math.floor((y - V.cy + h + 6) / O.C));
      for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) n += O.grid[gy * O.gw + gx];
      return n;
    };
    const xs = [];
    for (let x = sw - w - 20; x >= 20; x -= 32) xs.push(x);
    if (!xs.length) xs.push(Math.max(0, (sw - w) / 2));
    const rows = [capRoom() + 4, capRoom() + 18, capRoom() + 32, sh - h - 10, sh - h - 26];
    const cand = [];
    rows.forEach((y, i) => (i < 3 ? xs : xs.slice().reverse()).forEach((x) => cand.push([x, y])));
    let best = { x: cand[0][0], y: cand[0][1], n: Infinity };
    for (const c of cand) {
      if (c[1] < 0 || hit(c[0], c[1], hud)) continue;
      const n = cover(c[0], c[1]);
      if (n < best.n) best = { x: c[0], y: c[1], n };
      if (n === 0) break;
    }
    return best;
  }

  /* ------------------------------------------------------------------ key plan: the real street centerlines around the lot */
  function drawKey() {
    const cv = V && V.keyCv; if (!cv) return;
    A.safe('deal key plan', () => {
      const r = cv.getBoundingClientRect(), w = Math.round(r.width) || 136, h = Math.round(r.height) || 88, dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
      const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
      const hm = V.h, lat0 = hm.p[1], lon0 = hm.p[0], fy = 364584, fx = fy * Math.cos(lat0 * Math.PI / 180);
      const k = w / 720;                                       // px per ft: about 720 ft across
      const X = (lon) => w / 2 + (lon - lon0) * fx * k, Y = (lat) => h / 2 + 4 - (lat - lat0) * fy * k;
      const inBox = (p) => { const x = X(p[0]), y = Y(p[1]); return x > -40 && x < w + 40 && y > -40 && y < h + 40; };
      const segs = ((A.data && A.data.columbus) || []).filter((s) => s.p && s.p.some(inBox));
      // blocks: a faint fill of the walk homes' lots first, then the streets over them
      c.lineCap = 'round'; c.lineJoin = 'round';
      segs.forEach((s) => {
        c.strokeStyle = A.tok(s.c === 1 ? '--muted' : '--rule-3'); c.lineWidth = s.c === 1 ? 2.2 : 1.4;
        c.beginPath(); s.p.forEach((p, i) => { const x = X(p[0]), y = Y(p[1]); if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.stroke();
      });
      const homes = (A.data.homes || []).filter((x) => x.p && inBox(x.p) && x.addr !== hm.addr);
      c.fillStyle = A.tok('--rule-3');
      homes.forEach((x) => { c.fillRect(X(x.p[0]) - 2, Y(x.p[1]) - 1.5, 4, 3); });
      // street names: the longest visible piece of each street, drawn along it
      const byName = {};
      segs.forEach((s) => {
        for (let i = 1; i < s.p.length; i++) {
          const a = [X(s.p[i - 1][0]), Y(s.p[i - 1][1])], b = [X(s.p[i][0]), Y(s.p[i][1])];
          const ca = [A.clamp(a[0], 0, w), A.clamp(a[1], 0, h)], cb = [A.clamp(b[0], 0, w), A.clamp(b[1], 0, h)], len = Math.hypot(cb[0] - ca[0], cb[1] - ca[1]);
          const nm = shortStreet(s.n); if (!nm) continue;
          if (!byName[nm] || byName[nm].len < len) byName[nm] = { len, a: ca, b: cb };
        }
      });
      c.font = '500 8px ' + A.tok('--mono'); c.textBaseline = 'middle'; c.textAlign = 'center';
      Object.keys(byName).sort((p, q) => byName[q].len - byName[p].len).slice(0, 4).forEach((nm) => {
        const g = byName[nm]; if (g.len < 34) return;
        let ang = Math.atan2(g.b[1] - g.a[1], g.b[0] - g.a[0]); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
        const tw = c.measureText(nm).width; if (tw > g.len - 6) return;
        const hx = Math.abs(Math.cos(ang)) * tw / 2 + Math.abs(Math.sin(ang)) * 5, hy = Math.abs(Math.sin(ang)) * tw / 2 + Math.abs(Math.cos(ang)) * 5;
        let spot = null;   // slide along the street until the whole label sits inside the plan
        for (const t of [0.5, 0.38, 0.62, 0.26, 0.74, 0.16, 0.84]) {
          const x = g.a[0] + (g.b[0] - g.a[0]) * t, y = g.a[1] + (g.b[1] - g.a[1]) * t;
          if (x - hx >= 3 && x + hx <= w - 3 && y - hy >= 3 && y + hy <= h - 3) { spot = [x, y]; break; }
        }
        if (!spot) return;
        const mx = spot[0], my = spot[1];
        c.save(); c.translate(mx, my); c.rotate(ang);
        c.lineWidth = 3; c.strokeStyle = A.tok('--panel-2'); c.strokeText(nm, 0, -0.5);
        c.fillStyle = A.tok('--muted'); c.fillText(nm, 0, -0.5); c.restore();
      });
      // this lot: the house, a ring the color of its hail
      const hx = X(lon0), hy = Y(lat0);
      c.fillStyle = A.tok('--acc'); c.fillRect(hx - 3.5, hy - 2.5, 7, 5);
      c.strokeStyle = A.tok(A.ui.hailTok(hm.hail)); c.lineWidth = 1.3; c.beginPath(); c.arc(hx, hy, 9, 0, Math.PI * 2); c.stroke();
      // north + 100 ft
      c.fillStyle = A.tok('--text-2'); c.beginPath(); c.moveTo(w - 11, 7); c.lineTo(w - 14.5, 15); c.lineTo(w - 7.5, 15); c.closePath(); c.fill();
      c.font = '600 7.5px ' + A.tok('--mono'); c.fillText('N', w - 11, 21.5);
      const sb = 100 * k; c.strokeStyle = A.tok('--text-2'); c.lineWidth = 1; c.beginPath(); c.moveTo(8, h - 8); c.lineTo(8 + sb, h - 8); c.moveTo(8, h - 11); c.lineTo(8, h - 8); c.moveTo(8 + sb, h - 11); c.lineTo(8 + sb, h - 8); c.stroke();
      c.textAlign = 'left'; c.fillStyle = A.tok('--muted'); c.fillText(A.lang === 'es' ? '100 pies' : '100 ft', 12 + sb, h - 8.5);
    });
  }
  function shortStreet(n) {
    const s = String(n || '').trim(); if (!s) return '';
    return s.replace(/\bStreet\b/i, 'St').replace(/\bAvenue\b/i, 'Ave').replace(/\bDrive\b/i, 'Dr').replace(/\bBoulevard\b/i, 'Blvd').replace(/\bRoad\b/i, 'Rd')
      .replace(/\b(\d+)(ST|ND|RD|TH)\b/i, (m, d) => d).split(' ').map((w) => (/^\d/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join(' ');
  }

  /* ------------------------------------------------------------------ the map: the real lot, ours lit by its hail */
  function hashN(s) { let x = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; } return x >>> 0; }
  function rngN(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function streetLat(h) {
    const s = ((A.data.walk && A.data.walk.s) || []).find((x) => x.n === h.st);
    if (!s || !s.p || !s.p.length) return null;
    return s.p.reduce((a, p) => a + p[1], 0) / s.p.length;
  }
  function drawSite(c, f) {
    if (!V || f.zoom < 15.5) return;
    const P = f.pal, ppf = f.pxPerMile / 5280, homes = (A.data.homes || []).slice();
    if (!homes.some((x) => x.addr === V.h.addr)) homes.push(V.h);
    const za = A.clamp((f.zoom - 15.5) / 1.2, 0, 1), base = c.globalAlpha * za;
    const since = V.siteT0 ? (performance.now() - V.siteT0) / 1000 : 9, still = A.still;
    for (const x of homes) {
      if (!x.p) continue;
      const q = f.project(x.p), me = x.addr === V.h.addr;
      if (q[0] < -200 || q[1] < -200 || q[0] > f.w + 200 || q[1] > f.h + 200) continue;
      const sl = streetLat(x), north = sl == null ? true : x.p[1] < sl;   // the front faces the street
      const fm = window.House ? House.form(x) : 'ranch';
      const hw = ({ cottage: 30, ranch: 50, split: 44, two: 38, large: 46 }[fm] || 44) * ppf, hd = ({ cottage: 26, ranch: 30, split: 30, two: 30, large: 36 }[fm] || 30) * ppf;
      const lw = 64 * ppf, ld = 128 * ppf, dir = north ? -1 : 1;
      const lotY = q[1] - dir * (ld / 2 - hd / 2 - 26 * ppf);
      c.globalAlpha = base * (me ? 0.9 : 0.5); c.strokeStyle = me ? P.text2 : P.rule2; c.lineWidth = me ? 1.1 : 0.8;
      c.setLineDash(me ? [] : [3, 3]); c.strokeRect(q[0] - lw / 2, lotY - ld / 2, lw, ld); c.setLineDash([]);
      c.globalAlpha = base * (me ? 1 : 0.8); c.fillStyle = me ? P.panel3 : P.panel2; c.fillRect(q[0] - hw / 2, q[1] - hd / 2, hw, hd);
      c.strokeStyle = me ? P.acc : P.rule3; c.lineWidth = me ? 1.6 : 0.8; c.strokeRect(q[0] - hw / 2, q[1] - hd / 2, hw, hd);
      c.globalAlpha = base * (me ? 0.7 : 0.35); c.strokeStyle = me ? P.text2 : P.rule3; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(q[0] - hw / 2 + 3, q[1]); c.lineTo(q[0] + hw / 2 - 3, q[1]); c.stroke();
      c.globalAlpha = base * (me ? 0.55 : 0.3); c.fillStyle = P.rule2;
      c.fillRect(q[0] + hw / 2 - 12 * ppf, q[1] + dir * hd / 2 - (dir < 0 ? 26 * ppf : 0), 10 * ppf, 26 * ppf);
      if (!me) continue;
      const R = rngN(hashN(String(x.addr))), n = Math.round(6 + (x.hail || 1) * 6), col = A.world.hailColor(x.hail);
      c.strokeStyle = col; c.lineWidth = 1;
      for (let i = 0; i < n; i++) {
        const u = R(), v = R(), dly = 0.25 + i * 0.05, k = still ? 1 : A.clamp((since - dly) / 0.35, 0, 1);
        if (k <= 0) continue;
        const px = q[0] - hw / 2 + 3 + u * (hw - 6), py = q[1] - hd / 2 + 3 + v * (hd - 6), r = (0.9 + (x.hail || 1) * 0.9) * (0.6 + 0.4 * A.motion.ease.hail(k));
        c.globalAlpha = base * 0.95 * k; c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.stroke();
      }
      const kk = still ? 1 : A.clamp((since - 0.1) / 1.4, 0, 1), rr = Math.max(hw, hd) * (0.75 + 0.9 * A.motion.ease.outCubic(kk));
      c.globalAlpha = base * (still ? 0.28 : 0.28 + 0.5 * (1 - kk)); c.strokeStyle = P.acc; c.lineWidth = 1.2;
      c.beginPath(); c.arc(q[0], q[1], rr, 0, Math.PI * 2); c.stroke();
    }
    c.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------ the track (a fuse) */
  function stepCite(s) { return s && s.law ? cite(s.law.cite).split(',')[0].trim() : ''; }
  function trackHTML() {
    const nodes = STEPS.map((s, i) => `
      <button type="button" class="deal-node" role="tab" data-i="${i}" id="deal-tab-${i}" aria-controls="deal-step" aria-selected="false" tabindex="-1">
        <span class="deal-node__ring"><svg viewBox="0 0 36 36" aria-hidden="true"><circle class="deal-node__bg" cx="18" cy="18" r="15"/><circle class="deal-node__arc" cx="18" cy="18" r="15" pathLength="100"/></svg><b class="num">${pad2(i + 1)}</b><i data-icon="check" class="deal-node__ok"></i></span>
        <span class="deal-node__t">${E(s.title)}</span>
        <span class="deal-node__c">${s.law ? A.esc(stepCite(s)) : s.rule ? L('house rule', 'regla interna') : L('photos', 'fotos')}</span>
      </button>`).join('');
    return `<div class="deal-track" role="tablist" data-label-en="The path, 8 steps" data-label-es="El camino, 8 pasos">
      <span class="deal-track__lens" aria-hidden="true"></span>
      <div class="deal-track__rail" aria-hidden="true"><span class="deal-track__fuse"></span></div>
      <div class="deal-track__rail deal-track__rail--top" aria-hidden="true"><span class="deal-track__sparkwrap"><span class="deal-track__spark"></span></span></div>
      ${nodes}</div>`;
  }
  function tickCount(i) { const s = STEPS[i]; const t = (V.S.ticks[s.id] || []); return { n: t.filter(Boolean).length, of: t.length }; }
  function updateTrack() {
    if (!V) return;
    const S = V.S;
    A.$$('.deal-node', V.track).forEach((b, i) => {
      const done = i < S.cur, cur = i === S.cur, sel = i === S.sel, tc = tickCount(i);
      b.classList.toggle('is-done', done); b.classList.toggle('is-cur', cur); b.classList.toggle('is-sel', sel);
      b.setAttribute('aria-selected', String(sel)); b.tabIndex = sel ? 0 : -1;
      if (cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      const arc = A.$('.deal-node__arc', b); if (arc) arc.style.strokeDasharray = (done ? 100 : Math.round(100 * tc.n / Math.max(1, tc.of))) + ' 100';
    });
    const lens = A.$('.deal-track__lens', V.track); if (lens) lens.style.setProperty('--i', S.sel);
  }
  /** the fuse: p in node units (0..N-1, N = all done) */
  function setFuse(p, passing) {
    if (!V) return;
    V.fuseP = p;
    const k = A.clamp(p / (N - 1), 0, 1), fuse = A.$('.deal-track__fuse', V.track), sw = A.$('.deal-track__sparkwrap', V.track);
    const vert = V.track.classList.contains('is-vert');
    if (fuse) fuse.style.transform = vert ? `scaleY(${k})` : `scaleX(${k})`;
    if (sw) { sw.style.transform = vert ? `translateY(${k * 100}%)` : `translateX(${k * 100}%)`; sw.classList.toggle('is-out', p >= N); }
    const lit = passing ? p + 0.02 : Math.min(p, V.S.cur);
    A.$$('.deal-node', V.track).forEach((b, i) => b.classList.toggle('is-lit', i <= lit));
  }
  function burnTo(to, o = {}) {
    if (!V) return Promise.resolve();
    if (V.fuseTw) V.fuseTw.cancel();
    const from = V.fuseP, dist = Math.abs(to - from);
    if (A.still || dist < 0.001) { setFuse(to, false); return Promise.resolve(); }
    let last = Math.floor(from + 1e-6);
    const nodes = A.$$('.deal-node__ring', V.track);
    V.fuseTw = A.motion.tween({ from, to, ms: o.ms || 360 + 220 * dist, ease: 'inOutCubic', update: (p) => {
      setFuse(p, true);
      const idx = Math.floor(p + 1e-6);
      if (to > from && idx > last) { for (let j = last + 1; j <= Math.min(idx, N - 1); j++) { const r = nodes[j]; if (r) A.motion.ripple(r, { rings: 1, size: 44 }); } last = idx; }
    } });
    const me = V, tw = V.fuseTw;
    me.track.classList.add('is-burning');
    return tw.then((done) => { if (V !== me || me.fuseTw !== tw) return; me.fuseTw = null; if (done) setFuse(to, false); me.track.classList.remove('is-burning'); });
  }
  function onTrackKey(e) {
    if (!V) return;
    const k = e.key, vert = V.track.classList.contains('is-vert');
    const nextK = vert ? 'ArrowDown' : 'ArrowRight', prevK = vert ? 'ArrowUp' : 'ArrowLeft';
    let i = V.S.sel;
    if (k === nextK) i++; else if (k === prevK) i--; else if (k === 'Home') i = 0; else if (k === 'End') i = N - 1; else return;
    e.preventDefault(); e.stopPropagation(); select(A.clamp(i, 0, N - 1), { focus: true });
  }

  /* ------------------------------------------------------------------ armor */
  const ARMOR_ALSO = { '44-8606': [7], '69-1606(5)': [7], '48-2104': [5] };   // the build gate, the registration line on the contract
  function armorStep(a) {
    const want = cite(a.cite);
    for (let i = 0; i < STEPS.length; i++) {
      const s = STEPS[i];
      if (s.law && cite(s.law.cite) === want) return i;
      if ((s.also || []).some((x) => cite(x.cite) === want)) return i;
    }
    return 0;
  }
  function armorHTML() {
    return (CD.armor || []).map((a) => {
      const c = cite(a.cite), st = armorStep(a), steps = [st].concat(ARMOR_ALSO[c] || []);
      return `<button type="button" class="deal-arm" data-step="${st}" data-steps="${steps.join(' ')}" aria-pressed="false" data-tip="${A.esc(a.plain.en)}" data-tip-es="${A.esc(a.plain.es)}">
        <span class="deal-arm__c">${A.esc(c)}</span><span class="deal-arm__t">${E(a.title)}</span></button>`;
    }).join('');
  }
  function updateArmor() {
    if (!V) return;
    A.$$('.deal-arm', V.dock).forEach((b) => { const on = String(b.dataset.steps || '').split(' ').map(Number).includes(V.S.sel); b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
  }
  function renderWhere() {
    if (!V) return;
    const w = A.$('.deal-dock__where', V.dock), p = A.$('.deal-head__pos', V.head), S = V.S;
    const txt = S.cur >= N ? E(X.jobDone) : `${E(fill(X.stepOf, { i: S.cur + 1, n: N }))} · ${E(STEPS[S.cur].title)}`;
    if (w) w.innerHTML = txt;
    if (p) p.innerHTML = S.cur >= N ? E(X.jobDone) : E(fill(X.stepOf, { i: S.cur + 1, n: N }));
  }

  /* ------------------------------------------------------------------ the step panel */
  function statusChip(i) {
    const S = V.S;
    if (i < S.cur) return `<span class="chip chip--ok"><i data-icon="check"></i>${E(X.done)}</span>`;
    if (i === S.cur) return `<span class="chip chip--acc"><span class="chip__dot"></span>${E(X.doorHere)}</span>`;
    return `<span class="chip">${E(X.ahead)}</span>`;
  }
  function lawBlock(s) {
    if (s.law) return `<section class="deal-law">
        <p class="deal-law__k"><i data-icon="shield" class="i--sm"></i>${E(LB.law)} ${A.ui.srcTag('law')}<span class="deal-law__cite">${A.esc(s.law.cite)}</span></p>
        <p class="deal-law__p">${E(s.law.plain)}</p></section>`;
    return `<section class="deal-law deal-law--none"><p class="deal-law__k"><i data-icon="shield" class="i--sm"></i>${E(LB.law)}</p><p class="deal-law__p">${E(X.noLaw)}</p></section>`;
  }
  function checklist(s) {
    const t = V.S.ticks[s.id] || [];
    return `<ul class="deal-check">${(s.collect || []).map((c, k) => {
      const on = partsOf(s, k).length > 0;
      return `<li><button type="button" class="deal-ck" role="checkbox" aria-checked="${!!t[k]}" data-k="${k}">
        <span class="deal-ck__box"><i data-icon="check"></i></span><span class="deal-ck__t">${E(c)}</span>${on ? `<span class="deal-ck__mk num" data-tip="${A.esc(X.onHouse.en)}" data-tip-es="${A.esc(X.onHouse.es)}">${k + 1}</span>` : ''}</button></li>`;
    }).join('')}</ul>`;
  }
  function renderStep(animate) {
    if (!V) return;
    const i = V.S.sel, s = STEPS[i]; if (!s) return;
    const tc = tickCount(i);
    const also = (s.also || []).length ? `<section class="deal-also"><p class="sec">${E(LB.also)}</p><ul>${s.also.map((a) =>
      `<li><span class="deal-also__c">${A.esc(cite(a.cite))}</span><span class="deal-also__p">${E(a.plain)}</span></li>`).join('')}</ul></section>` : '';
    const rule = s.rule ? `<section class="deal-rule"><p class="t-micro">${E(LB.rule)} ${A.ui.srcTag('hmp')}</p><p class="deal-rule__p">${E(s.rule)}</p></section>` : '';
    const clock = (s.id === 'contract' || s.id === 'window') ? `<section class="deal-clock"></section>` : '';
    const gate = (s.id === 'itemized' || s.id === 'build') ? `<section class="deal-gate"></section>` : '';
    V.step.setAttribute('aria-labelledby', 'deal-tab-' + i);
    V.step.innerHTML = `
      <div class="deal-step__top"><p class="eyebrow">${E(fill(X.stepOf, { i: pad2(i + 1), n: pad2(N) }))}</p>${statusChip(i)}</div>
      <h2 class="t-title deal-step__title">${E(s.title)}</h2>
      ${lawBlock(s)}
      ${rule}
      ${s.id === 'itemized' ? '' : clock + gate}
      <div class="deal-collect">
        <p class="sec">${E(LB.collect)} <span class="sec__meta deal-collect__n"><b class="num">${tc.n}</b> ${L('of', 'de')} ${tc.of}</span></p>
        <div class="deal-collect__bar" aria-hidden="true"><span style="transform:scaleX(${tc.of ? tc.n / tc.of : 0})"></span></div>
        ${checklist(s)}
      </div>
      ${s.id === 'itemized' ? gate : ''}
      <dl class="deal-nd">
        <div><dt><i data-icon="arrow" class="i--sm"></i>${E(LB.next)}</dt><dd>${E(s.next)}</dd></div>
        <div><dt><i data-icon="flag" class="i--sm"></i>${E(LB.doneWhen)}</dt><dd>${E(s.done_when)}</dd></div>
      </dl>
      ${also}`;
    A.ui.icons(V.step); A.ui.localize(V.step);
    if (clock) renderClock();
    if (gate) renderGate();
    if (animate && !A.still) {
      A.motion.stagger(Array.from(V.step.children), { each: 38, y: 12, ms: 540 });
      const sc = V.step.closest('.slot'); if (sc && !V.stacked && sc.scrollTop > V.step.offsetTop) sc.scrollTo({ top: Math.max(0, V.step.offsetTop - 8) });
    }
  }
  function refreshCount() {
    const i = V.S.sel, tc = tickCount(i);
    const n = A.$('.deal-collect__n', V.step); if (n) n.innerHTML = `<b class="num">${tc.n}</b> ${L('of', 'de')} ${tc.of}`;
    const bar = A.$('.deal-collect__bar > span', V.step);
    if (bar) {
      const k = tc.of ? tc.n / tc.of : 0, was = bar.style.transform || 'scaleX(0)';
      bar.style.transform = `scaleX(${k})`;
      if (!A.still && bar.animate) { try { bar.animate([{ transform: was }, { transform: `scaleX(${k})` }], { duration: 420, easing: A.motion.css.hail }); } catch (e) { /* ignore */ } }
    }
    return tc;
  }
  /** tick or untick item k of the selected step: the box rings, its mark on the house fills and rings out */
  function toggleTick(k, force) {
    if (!V) return;
    const s = STEPS[V.S.sel], arr = s && V.S.ticks[s.id]; if (!arr || k < 0 || k >= arr.length) return;
    const on = force == null ? !arr[k] : !!force; if (on === arr[k]) return;
    arr[k] = on; save();
    const ck = A.$(`.deal-ck[data-k="${k}"]`, V.step);
    if (ck) ck.setAttribute('aria-checked', String(on));
    syncMarks();
    if (on) {
      if (ck) A.motion.ripple(A.$('.deal-ck__box', ck), { rings: 2, size: 40, color: A.tok('--ok') });
      A.$$(`.deal-mark[data-k="${k}"]`, V.marks).forEach((m, j) => setTimeout(() => A.motion.ripple(m, { rings: 2, size: 58, color: A.tok('--ok') }), j * 70));
      snd((S) => S.ring(Math.min(5, k)));
    } else snd((S) => S.tick());
    const tc = refreshCount(); updateTrack();
    if (on && tc.n === tc.of) { const r = A.$(`.deal-node[data-i="${V.S.sel}"] .deal-node__ring`, V.track); if (r) A.motion.ripple(r, { rings: 2, size: 52, color: A.tok('--ok') }); }
  }
  function onStepClick(e) {
    if (!V) return;
    const ck = e.target.closest('.deal-ck[data-k]');
    if (ck) { toggleTick(+ck.dataset.k); return; }
    const ty = e.target.closest('[data-type]');
    if (ty) { V.S.type = ty.dataset.type === 'cash' ? 'cash' : 'ins'; save(); if (A.$('.deal-clock', V.step)) renderClock(); if (A.$('.deal-gate', V.step)) renderGate(); renderStamp(true); return; }
    const sd = e.target.closest('[data-sd]');
    if (sd) { V.S.signed = sd.dataset.sd; save(); renderClock(true); renderStamp(true); return; }
    const g = e.target.closest('[data-gate]');
    if (g) {
      const k = g.dataset.gate; V.S.gate[k] = !V.S.gate[k]; save();
      if (V.S.gate[k]) A.motion.ripple(A.$('.deal-ck__box', g) || g, { rings: 2, size: 40, color: A.tok('--ok') });
      renderGate(); renderStamp(true); return;
    }
  }
  function onStepChange(e) {
    if (!V) return;
    const inp = e.target.closest('.deal-date');
    if (inp && parse(inp.value) != null) { V.S.signed = inp.value; save(); renderClock(true); renderStamp(true); }
  }

  /* cancel window clock */
  function typeSeg() {
    const t = V.S.type;
    return `<div class="seg seg--ui deal-type" role="group" data-label-en="Job type" data-label-es="Tipo de trabajo">
      <button type="button" data-type="ins" aria-pressed="${t === 'ins'}">${L('Insurance claim', 'Con reclamo de seguro')}</button>
      <button type="button" data-type="cash" aria-pressed="${t === 'cash'}">${L('No claim', 'Sin reclamo')}</button></div>`;
  }
  function renderClock(ring) {
    const el = A.$('.deal-clock', V.step); if (!el) return;
    const W = cancelWindow(V.S.signed) || cancelWindow(A.story.today), now = storyNow();
    const started = now >= W.startMs, closed = now >= W.endMs;
    const frac = !started ? 0 : A.clamp((now - W.startMs) / (W.endMs - W.startMs), 0, 1);
    const left = W.endMs - now, dd = Math.floor(left / DAYMS), hh = Math.floor((left % DAYMS) / 36e5);
    const state = !started ? L('Opens on the sale date', 'Se abre en la fecha de la venta')
      : closed ? L('Closed. No notice inside it? The build can go on the calendar.', 'Cerrado. ¿Sin aviso dentro del plazo? La obra puede ir al calendario.')
        : `<b class="num">${dd}</b> ${L('d', 'd')} <b class="num">${hh}</b> ${L('h left, as of', 'h restantes, a las')} ${A.both(() => A.fmt.time(A.story.time))}`;
    const days = W.days.map((d) => {
      const lab = d.kind === 'sale' ? L('Sale', 'Venta') : d.kind === 'skip' ? E(d.short) : `${L('Day', 'Día')} ${d.n}`;
      const tip = d.kind === 'skip' ? ` data-tip="${A.esc(d.why.en + ': not a business day')}" data-tip-es="${A.esc(d.why.es + ': no es día hábil')}"` : '';
      return `<li class="deal-day deal-day--${d.kind}${d.iso === W.end ? ' is-end' : ''}"${tip}><span class="deal-day__w">${A.both(() => A.fmt.date(d.iso, 'day').split(/[ ,]/)[0])}</span><span class="deal-day__d num">${new Date(parse(d.iso)).getUTCDate()}</span><span class="deal-day__l">${lab}</span></li>`;
    }).join('');
    const rule = V.S.type === 'cash'
      ? `<p class="deal-clock__rule"><i data-icon="shield" class="i--sm"></i><span>${L('No work before it ends on a non-insurance sale.', 'Nada de trabajo antes de que termine, en una venta sin reclamo de seguro.')} <span class="deal-cite">69-1606(5)</span></span></p>`
      : `<p class="deal-clock__rule"><i data-icon="shield" class="i--sm"></i><span>${L('Insurance job: the itemized description goes to the homeowner and the insurer before any repair.', 'Trabajo con seguro: la descripción detallada va al dueño y a la aseguradora antes de cualquier reparación.')} <span class="deal-cite">44-8606</span> ${L('The window can also run later.', 'El plazo también puede correr después.')} <span class="deal-cite">44-8603</span></span></p>`;
    const deg = Math.round(frac * 360);
    const chip = (d, lab) => `<button type="button" class="chip" data-sd="${A.esc(d)}" aria-pressed="${V.S.signed === d}">${lab}</button>`;
    el.innerHTML = `
      <p class="sec">${L('Cancel window', 'Plazo para cancelar')} ${BDAY_TAG()} <span class="sec__meta">${L('3 business days', '3 días hábiles')}</span></p>
      <div class="deal-clock__main">
        <div class="deal-dial${closed ? ' is-closed' : ''}" aria-hidden="true">
          <svg viewBox="0 0 64 64"><circle class="deal-dial__bg" cx="32" cy="32" r="27"/><circle class="deal-dial__arc" cx="32" cy="32" r="27" pathLength="100" style="stroke-dasharray:${Math.round(frac * 100)} 100"/>
          ${[0, 1, 2, 3].map((q) => `<line class="deal-dial__tick" x1="32" y1="3" x2="32" y2="8" transform="rotate(${q * 90} 32 32)"/>`).join('')}</svg>
          <span class="deal-dial__hand" style="--deg:${deg}deg"></span><span class="deal-dial__hub"></span>
        </div>
        <div class="deal-clock__txt">
          <p class="t-micro">${L('Ends at midnight', 'Termina a la medianoche del')}</p>
          <p class="deal-clock__end">${A.both(() => A.fmt.date(W.end, 'day'))}</p>
          <p class="t-small deal-clock__left">${state}</p>
        </div>
      </div>
      <ol class="deal-days">${days}</ol>
      <div class="deal-clock__ctl">
        <label class="deal-date__l"><span class="t-micro">${L('Sale date', 'Fecha de la venta')}</span>
          <input type="date" class="deal-date" value="${A.esc(V.S.signed)}" min="2026-01-01" max="2027-12-31"></label>
        ${chip(A.story.today, L('Today', 'Hoy'))}${chip('2026-09-26', A.both(() => A.fmt.date('2026-09-26', 'short')))}${chip('2026-09-05', L('Labor Day weekend', 'Fin de semana del Día del Trabajo'))}
      </div>
      ${typeSeg()}
      ${rule}`;
    A.ui.icons(el); A.ui.localize(el);
    const hand = A.$('.deal-dial__hand', el);
    if (hand && !A.still && hand.animate) {
      try { hand.animate([{ transform: 'rotate(0deg)' }, { transform: `rotate(${deg}deg)` }], { duration: 900, easing: A.motion.css.hail }); } catch (e) { /* ignore */ }
      if (ring) { A.motion.stagger(A.$$('.deal-day', el), { each: 40, y: 8, ms: 460 }); const endEl = A.$('.deal-day.is-end', el); if (endEl) setTimeout(() => { if (endEl.isConnected) A.motion.ripple(endEl, { rings: 1, size: 60 }); }, 260); }
    }
  }
  /** before the build: insurance = 44-8606 both copies; no claim = the cancel window has closed (69-1606(5)) */
  function gateState() {
    const S = V.S;
    if (S.type === 'ins') return { clear: S.gate.ho && S.gate.ins };
    const W = cancelWindow(S.signed); const closed = W && storyNow() >= W.endMs;
    return { clear: !!closed, end: W && W.end };
  }
  function renderGate() {
    const el = A.$('.deal-gate', V.step); if (!el) return;
    const S = V.S, g = gateState();
    const row = (k, en, es) => `<button type="button" class="deal-ck deal-ck--gate" role="checkbox" aria-checked="${!!S.gate[k]}" data-gate="${k}"><span class="deal-ck__box"><i data-icon="check"></i></span><span class="deal-ck__t">${L(en, es)}</span></button>`;
    const body = S.type === 'ins'
      ? `<div class="deal-gate__rows">${row('ho', 'Itemized description sent to the homeowner', 'Descripción detallada enviada al dueño')}${row('ins', 'The same description sent to the insurance company', 'La misma descripción enviada a la aseguradora')}</div>`
      : `<p class="deal-gate__line"><span class="deal-gate__dot${g.clear ? ' is-ok' : ''}"></span><span>${g.clear ? L('The cancel window has closed', 'El plazo para cancelar ya cerró') : `${L('The cancel window is open until midnight,', 'El plazo para cancelar sigue abierto hasta la medianoche del')} ${A.both(() => A.fmt.date(g.end, 'day'))}`}</span></p>`;
    const status = g.clear ? `<span class="chip chip--ok"><i data-icon="check"></i>${L('Clear to build', 'Listo para la obra')}</span>`
      : `<span class="chip chip--warn"><span class="chip__dot"></span>${L('Not yet', 'Todavía no')}</span>`;
    el.classList.toggle('is-clear', g.clear);
    el.innerHTML = `
      <div class="deal-gate__head"><p class="deal-law__k"><i data-icon="shield" class="i--sm"></i>${L('Before the build', 'Antes de la obra')} ${A.ui.srcTag('law')}<span class="deal-law__cite">${S.type === 'ins' ? '44-8606' : '69-1606(5)'}</span></p>${status}</div>
      ${typeSeg()}
      ${body}`;
    A.ui.icons(el); A.ui.localize(el);
  }

  /* ------------------------------------------------------------------ foot actions */
  function renderFoot() {
    if (!V) return;
    const S = V.S, i = S.sel;
    let main;
    if (S.cur >= N && i === N - 1) main = `<span class="chip chip--ok"><i data-icon="check"></i>${E(X.jobDone)}</span><button type="button" class="btn btn--ghost btn--sm" data-act="reopen">${E(X.reopen)}</button>`;
    else if (i === S.cur) main = `<button type="button" class="btn btn--primary deal-foot__main" data-act="done"><i data-icon="check"></i>${E(X.markDone)}</button>`;
    else if (i < S.cur) main = `<button type="button" class="btn btn--secondary deal-foot__main" data-act="reopen"><i data-icon="arrow" class="deal-flip"></i>${E(X.reopen)}</button>`;
    else main = `<p class="t-small deal-foot__wait">${E(fill(X.finishFirst, { t: STEPS[S.cur].title }))}</p><button type="button" class="btn btn--ghost btn--sm" data-act="goto">${E(fill(X.stepOf, { i: S.cur + 1, n: N }))}</button>`;
    V.foot.innerHTML = `<div class="deal-foot__row">${main}</div><button type="button" class="btn btn--ghost btn--sm deal-foot__reset" data-act="reset"><i data-icon="x" class="i--sm"></i>${E(X.reset)}</button>`;
    A.ui.icons(V.foot); A.ui.localize(V.foot);
  }
  function onFootClick(e) {
    const b = V && e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act, S = V.S;
    if (act === 'done') markDone();
    else if (act === 'reopen') setCur(S.sel);
    else if (act === 'goto') select(S.cur);
    else if (act === 'reset') {
      V.S = defaults(V.h); V.demo = false; save(); select(V.S.sel, { force: true }); burnTo(V.S.cur); updateTrack(); renderWhere(); renderFoot();
      A.ui.toast({ en: 'Door reset to the sample state', es: 'Puerta reiniciada al estado de muestra' }, { icon: 'arrow', ms: 1600 });
    }
  }
  function markDone() {
    const S = V.S, i = S.cur; if (i >= N) return;
    if (STEPS[i + 1] && STEPS[i + 1].id === 'build') {
      const g = gateState();
      if (!g.clear) {
        A.ui.toast(S.type === 'ins' ? { en: 'Not yet: the itemized description goes to the homeowner and the insurer first (44-8606).', es: 'Todavía no: primero la descripción detallada al dueño y a la aseguradora (44-8606).' }
          : { en: 'Not yet: no work until the cancel window ends (69-1606(5)).', es: 'Todavía no: nada de trabajo hasta que termine el plazo para cancelar (69-1606(5)).' }, { icon: 'shield', ms: 2600 });
        select(i + 1);
        if (V.stamp && !V.stamp.hidden) A.motion.ripple(V.stamp, { rings: 2, size: Math.max(120, V.stamp.offsetWidth), color: A.tok('--warn') });
        return;
      }
    }
    snd((Sd) => Sd.knock({ count: 2, gain: 0.8 }));
    setCur(i + 1);
    if (i + 1 < N) select(i + 1);
    else { renderStep(false); renderFoot(); renderStamp(true); A.ui.toast({ en: 'Job complete on this door', es: 'Trabajo terminado en esta puerta' }, { icon: 'flag', ms: 1800 }); }
  }
  function setCur(c, o = {}) {
    V.S.cur = A.clamp(c, 0, N);
    if (o.save !== false) save();
    burnTo(V.S.cur); updateTrack(); renderWhere(); renderFoot();
    const chip = A.$('.deal-step__top .chip', V.step); if (chip) { chip.outerHTML = statusChip(V.S.sel); A.ui.icons(V.step); }
  }
  function select(i, o = {}) {
    if (!V) return;
    i = A.clamp(i | 0, 0, N - 1);
    const changed = i !== V.S.sel;
    V.S.sel = i; save();
    V.hover = null; V.hotK = null;
    updateTrack(); updateArmor(); renderCaps(); renderFoot();
    if (changed || o.force) {
      renderStep(true);
      if (V.marksOn) showMarks(!A.still);
      renderStamp(true);
    }
    refocus();
    if (o.focus) { const b = A.$(`.deal-node[data-i="${i}"]`, V.track); if (b) b.focus(); }
    if (changed && !A.still) { const r = A.$(`.deal-node[data-i="${i}"] .deal-node__ring`, V.track); if (r) A.motion.ripple(r, { rings: 1, size: 40 }); }
  }
  function demoStep(i) {
    if (!V) return;
    V.demo = true;
    i = A.clamp(i | 0, 0, N - 1);
    V.S.cur = i; burnTo(i); updateTrack(); renderWhere();
    select(i, { force: true });
  }

  /* ------------------------------------------------------------------ the homeowner sheet (overlay) */
  function sheetCol(lang) {
    const H = CD.homeowner || {}, g = (o) => A.esc(o ? (lang === 'es' ? o.es : o.en) : '');
    const C = H.cancel || {}, K = H.contact || {};
    // filled in once the contract is signed on this door; blank lines before that
    const S = V.S, signed = S.cur >= 5 ? S.signed : null, W = signed ? cancelWindow(signed) : null;
    const blank = (o, v) => { const s = g(o); return v ? s.replace(/_{3,}/, `<b class="deal-paper__typed">${A.esc(v)}</b>`) : s; };
    const steps = (H.steps || []).map((s, i) => `<li><span class="deal-paper__n">${i + 1}</span><div><p class="deal-paper__st">${g(s.title)}</p><p>${g(s.body)}</p></div></li>`).join('');
    const sig = lang === 'es' ? ['Recibido por el dueño', 'Fecha'] : ['Received by homeowner', 'Date'];
    const rep = K.rep ? { en: String(K.rep.en).split(/\s{2,}/)[0], es: String(K.rep.es).split(/\s{2,}/)[0] } : null;   // no phone numbers on this sheet
    return `<section class="deal-paper__col" lang="${lang}">
      <p class="deal-paper__lang">${lang === 'es' ? 'Español' : 'English'}</p>
      <h3 class="deal-paper__h">${g(H.title)}</h3>
      <p class="deal-paper__lead">${g(H.greeting)}</p>
      <p class="deal-paper__home">${lang === 'es' ? 'Casa' : 'Home'}: <b>${A.esc(V.h.addr || '')}</b></p>
      <ol class="deal-paper__steps">${steps}</ol>
      <div class="deal-paper__cancel">
        <p class="deal-paper__ch">${g(C.title)}</p>
        <p><b>${g(C.lead)}</b></p>
        <p>${g(C.how)}</p>
        <p>${g(C.insurance)}</p>
        <p>${g(C.refund)}</p>
        <p class="deal-paper__blank">${blank(C.endsOn, W ? A.fmt.date(W.end, 'long', lang) : null)}</p>
        <p class="deal-paper__fine">${g(C.official)}</p>
      </div>
      <dl class="deal-paper__contact"><div><dt>${g(K.mailingLabel)}</dt><dd>${g(K.mailing)}</dd></div></dl>
      <p class="deal-paper__blank">${g(K.registration)}</p>
      <p class="deal-paper__blank">${blank(K.saleDate, signed ? A.fmt.date(signed, 'long', lang) : null)}</p>
      ${rep ? `<p class="deal-paper__blank">${g(rep)}</p>` : ''}
      <div class="deal-paper__sig"><span class="deal-paper__line"></span><span>${sig[0]}</span><span class="deal-paper__line deal-paper__line--s"></span><span>${sig[1]}</span></div>
    </section>`;
  }
  function openSheet(opener) {
    if (!V || V.modal) return;
    const H = CD.homeowner || {}, ui = (CP.ui || {});
    const m = A.h(`<div class="deal-modal" role="dialog" aria-modal="true" aria-labelledby="deal-sheet-h">
      <div class="deal-modal__scrim"></div>
      <div class="deal-modal__box">
        <div class="deal-modal__bar">
          <p class="deal-modal__k"><i data-icon="doc" class="i--sm"></i><span id="deal-sheet-h">${E(LB.homeownerTab || { en: 'Homeowner sheet', es: 'Hoja del dueño' })}</span>
            <span class="t-micro deal-modal__sub">${L('What the homeowner keeps. Branded HMP, in English and Spanish.', 'Lo que se queda el dueño. Con la marca de HMP, en inglés y español.')}</span></p>
          <div class="deal-modal__ctl">
            <button type="button" class="btn btn--ghost btn--icon deal-modal__x" data-act="close" data-label-en="Close" data-label-es="Cerrar"><i data-icon="x"></i></button>
          </div>
        </div>
        <div class="deal-modal__scroll" tabindex="0" data-label-en="Homeowner sheet, English and Spanish" data-label-es="Hoja del dueño, inglés y español">
          <article class="deal-paper">
            <header class="deal-paper__head">
              <div class="deal-paper__brand"><svg class="deal-paper__mark" viewBox="0 0 32 32" aria-hidden="true"><path d="M4 16 16 6l12 10"/><path d="M8 13v13h16V13"/><path d="M13 26v-7h6v7"/></svg>
                <div><p class="deal-paper__name">${A.esc((H.brand || {}).en || 'HMP Siding & Roofing')}</p><p class="deal-paper__legal">${A.esc((H.legalName || {}).en || 'HMP Siding & Roofing LLC')} · Fremont, NE</p></div></div>
              <p class="deal-paper__stamp"><span lang="en">${A.esc((LB.sheetSample || {}).en || 'Sample sheet. Not a signed document.')}</span><span lang="es">${A.esc((LB.sheetSample || {}).es || 'Hoja de muestra. No es un documento firmado.')}</span></p>
            </header>
            <div class="deal-paper__cols">${sheetCol('en')}${sheetCol('es')}</div>
          </article>
        </div>
      </div></div>`);
    A.ui.icons(m); A.ui.localize(m);
    V.ctx.slots.overlay.appendChild(m);
    const prev = document.activeElement;
    V.modal = { el: m, opener: opener || (prev && prev !== document.body ? prev : null) };
    const box = A.$('.deal-modal__box', m), scrim = A.$('.deal-modal__scrim', m), scroll = A.$('.deal-modal__scroll', m);
    m.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'close') closeSheet();
    });
    m.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSheet(); return; }
      if (e.key !== 'Tab') return;
      const f = A.$$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', box).filter((n) => !n.disabled && n.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1], at = document.activeElement;
      if (!box.contains(at)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && at === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
    });
    // light dismiss: a press outside the sheet (not the top bar, not the button that opened it) closes it and still lands
    const outside = (e) => {
      if (!V || !V.modal || V.modal.el !== m) return;
      const t = e.target;
      if (box.contains(t) || (t.closest && (t.closest('#topbar') || t.closest('.deal-handbtn') || t.closest('.tip')))) return;
      closeSheet(true);
    };
    document.addEventListener('pointerdown', outside, true);
    V.modal.off = () => document.removeEventListener('pointerdown', outside, true);
    setTimeout(() => { try { (scroll || box).focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 20);
    if (!A.still) {
      try { scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: A.motion.css.out }); } catch (e) { /* ignore */ }
      A.motion.reveal(box, { y: 26, ms: 640 });
      A.motion.stagger(A.$$('.deal-paper__head, .deal-paper__col', m), { each: 90, y: 14, ms: 620, delay: 140 });
    }
    snd((S) => S.tick());
  }
  function closeSheet(quick) {
    if (!V || !V.modal) return;
    const M = V.modal; V.modal = null;
    if (M.off) M.off();
    const done = () => { M.el.remove(); if (M.opener && M.opener.isConnected) { try { M.opener.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } };
    if (quick || A.still) { done(); return; }
    A.motion.exit([M.el], { ms: 160 }).then(done);
  }

  /* ------------------------------------------------------------------ director hooks + Knock hand-off */
  A.dealDemo = {
    step: (i) => { if (V) demoStep(i); },
    select: (i) => { if (V) select(i); },
    open: () => { if (V) openSheet(null); },
    close: () => { if (V) closeSheet(); },
    tick: (k, on) => { if (V) toggleTick(k | 0, on); },
    state: () => (V ? { addr: V.h.addr, cur: V.S.cur, sel: V.S.sel, type: V.S.type, signed: V.S.signed, built: V.built, open: !!V.modal,
      ticks: JSON.parse(JSON.stringify(V.S.ticks)), marks: A.$$('.deal-mark', V.marks).length, stamp: V.stamp && !V.stamp.hidden ? V.stampKey : null,
      canvas: { w: V.cw, h: V.ch, x: V.cx, y: V.cy }, house: V.L ? { s: V.L.s, x0: V.L.x0, x1: V.L.x1, top: V.L.top, ground: V.L.groundY, band: V.L.bandY } : null } : null)
  };
  A.on('deal:home', (h) => { if (h && h.p) A.dealHome = h; });
})();
