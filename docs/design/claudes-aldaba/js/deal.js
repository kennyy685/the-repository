/* Claude's Aldaba · js/deal.js · #deal
   One door, from first knock to a signed job, with Nebraska's legal armor.
   Layout (desktop): left = the door + the selected step (collect, the law, next, done when, cancel clock, build gate);
   center = the house portrait (House.js) drawn live, highlight follows the step, the real lot on the dimmed map beside it;
   bottom dock = the path (a fuse that burns to where this door is) + the 12 armor rules + "Hand to homeowner".
   Overlay = the homeowner sheet, HMP Siding & Roofing (never Aldaba), EN and ES side by side, printed-paper surface.
   Per-viewer state (ticks, where the door is, sale date, job type) lives in A.store, keyed by the sample address.
   Director hook: A.dealDemo = {step(i), select(i), open(), close()}. */
(function () {
  'use strict';
  const A = window.A; if (!A || !A.view) return;

  /* ------------------------------------------------------------------ copy + helpers */
  const CD = (window.COPY && window.COPY.deal) || { labels: {}, steps: [], armor: [], homeowner: {} };
  const LB = CD.labels || {};
  const STEPS = CD.steps || [];
  const N = STEPS.length || 8;
  const E = (o) => (o ? A.L(A.esc(o.en), A.esc(o.es == null ? o.en : o.es)) : '');     // escaped EN/ES spans
  const L = (en, es) => A.L(A.esc(en), A.esc(es));
  const tt = (o) => A.t(o);
  const pad2 = (n) => String(n).padStart(2, '0');
  const cite = (c) => String(c || '').replace(/^Neb\. Rev\. Stat\.\s*/, '');
  const snd = (fn) => { try { const S = window.Sound; if (S && S.enabled) fn(S); } catch (e) { /* sound is optional */ } };
  const HL = { intro: null, look: 'siding', inspection: 'roof', adjuster: 'roof', itemized: null, contract: null, window: null, build: 'roof' };
  const HL_NAME = { roof: { en: 'roof', es: 'techo' }, siding: { en: 'siding', es: 'siding' }, gutters: { en: 'gutters', es: 'canaletas' } };
  // what this step looks at, as short mono tags on the portrait; k = the collect item each tag mirrors (ticks show)
  const TAGS = {
    intro: [[0, 'Name, HMP, what we sell', 'Nombre, HMP, qué vendemos'], [1, 'Owner or renter', 'Dueño o inquilino'], [2, 'Yes, a time or no', 'Sí, una hora o no']],
    look: [[0, 'House number photo', 'Foto del número'], [1, 'Four sides', 'Cuatro lados'], [3, 'Soft metals', 'Metal blando'], [4, 'Clean side', 'Lado sin daño']],
    inspection: [[0, 'Test square per slope', 'Cuadro de prueba por lado'], [1, 'Siding hits', 'Golpes en siding'], [3, 'Insurer name', 'Aseguradora'], [5, 'Signed form', 'Formulario firmado']],
    adjuster: [[0, 'Adjuster + date', 'Ajustador + fecha'], [1, 'Claim number', 'Número de reclamo'], [2, 'Photos + counts', 'Fotos + conteos'], [4, 'Written scope', 'Alcance por escrito']],
    itemized: [[0, 'By trade', 'Por oficio'], [1, 'Materials', 'Materiales'], [2, 'Labor + fees', 'Mano de obra + cargos'], [3, 'Total', 'Total'], [4, 'Two copies', 'Dos copias']],
    contract: [[0, 'Signed contract', 'Contrato firmado'], [2, 'Two cancel forms', 'Dos formularios'], [3, 'Sale date + initials', 'Fecha + iniciales'], [4, 'HMP address', 'Dirección de HMP']],
    window: [[0, 'Ends at midnight, day 3', 'Termina a medianoche, día 3'], [2, 'No work yet (no claim)', 'Sin obra aún (sin reclamo)'], [3, 'Mail checked', 'Correo revisado']],
    build: [[0, 'Permit', 'Permiso'], [3, 'Change orders', 'Órdenes de cambio'], [4, 'Daily cleanup', 'Limpieza diaria'], [5, 'After photos', 'Fotos del después']]
  };
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
    of: { en: '{i} of {n}', es: '{i} de {n}' }
  };
  const fill = (o, v) => ({ en: String(o.en).replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? (typeof v[k] === 'object' ? v[k].en : v[k]) : m)),
    es: String(o.es).replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? (typeof v[k] === 'object' ? v[k].es : v[k]) : m)) });

  /* ------------------------------------------------------------------ business days (cancel window) */
  // Nebraska 69-1601 does not define "business day"; we use the federal Cool-Off Rule list (16 CFR 429): every
  // day except Sunday and nine federal holidays.
  const DAYMS = 864e5;
  const parse = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; };
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  function nth(y, m, wd, n) {
    if (n > 0) { const d1 = new Date(Date.UTC(y, m, 1)).getUTCDay(); return Date.UTC(y, m, 1 + ((wd - d1 + 7) % 7) + 7 * (n - 1)); }
    const last = new Date(Date.UTC(y, m + 1, 0)), dl = last.getUTCDay(); return Date.UTC(y, m, last.getUTCDate() - ((dl - wd + 7) % 7));
  }
  const holCache = {};
  function holidays(y) {
    if (holCache[y]) return holCache[y];
    const H = {};
    const add = (ms, en, es) => { H[iso(ms)] = { en, es }; };
    add(Date.UTC(y, 0, 1), "New Year's Day", 'Año Nuevo');
    add(nth(y, 1, 1, 3), "Washington's Birthday", 'Natalicio de Washington');
    add(nth(y, 4, 1, -1), 'Memorial Day', 'Día de los Caídos');
    add(Date.UTC(y, 6, 4), 'Independence Day', 'Día de la Independencia');
    add(nth(y, 8, 1, 1), 'Labor Day', 'Día del Trabajo');
    add(nth(y, 9, 1, 2), 'Columbus Day', 'Día de la Raza');
    add(Date.UTC(y, 10, 11), 'Veterans Day', 'Día de los Veteranos');
    add(nth(y, 10, 4, 4), 'Thanksgiving', 'Acción de Gracias');
    add(Date.UTC(y, 11, 25), 'Christmas Day', 'Navidad');
    return (holCache[y] = H);
  }
  /** the sale day, every day after it up to the end, each marked counted (1..3) or skipped (Sunday / holiday) */
  function cancelWindow(saleIso) {
    const t0 = parse(saleIso); if (t0 == null) return null;
    const days = [{ iso: iso(t0), kind: 'sale' }];
    let n = 0, t = t0;
    while (n < 3 && days.length < 12) {
      t += DAYMS;
      const d = iso(t), wd = new Date(t).getUTCDay(), hol = holidays(new Date(t).getUTCFullYear())[d];
      if (wd === 0) days.push({ iso: d, kind: 'skip', why: { en: 'Sunday', es: 'Domingo' } });
      else if (hol) days.push({ iso: d, kind: 'skip', why: hol });
      else days.push({ iso: d, kind: 'count', n: ++n });
    }
    const end = days[days.length - 1].iso;
    return { days, end, endMs: parse(end) + DAYMS, startMs: t0 };
  }
  const storyNow = () => { const d = parse(A.story.today) || Date.now(); const m = /^(\d+):(\d+)/.exec(A.story.time || '07:02'); return d + (m ? (+m[1] * 60 + +m[2]) * 6e4 : 0); };
  const BDAY_TAG = () => A.ui.srcTag({ label: '16 CFR 429', cls: 'src--law', tip: {
    en: 'Business day = every day except Sunday and 9 federal holidays (FTC Cool-Off Rule, 16 CFR 429). Nebraska 69-1601 does not define it, so we use the federal list.',
    es: 'Día hábil = todos los días excepto el domingo y 9 feriados federales (Regla de la FTC, 16 CFR 429). El 69-1601 de Nebraska no lo define, así que usamos la lista federal.' } });

  /* ------------------------------------------------------------------ the door + per-viewer state */
  function home() {
    const hs = (A.data && A.data.homes) || [];
    const d = A.dealHome && A.dealHome.p ? A.dealHome : null;
    return d || hs.find((h) => h.rank === 1) || hs[0] || { addr: '3944 21 St', st: '21 St', p: A.data.hq, built: 1978, roof: 21, own: true, hail: 1.68, score: 91, rank: 1 };
  }
  const blankTicks = () => { const t = {}; STEPS.forEach((s) => (t[s.id] = (s.collect || []).map(() => false))); return t; };
  function defaults(h) {
    const S = { v: 1, cur: 2, sel: 2, ticks: blankTicks(), type: 'ins', signed: A.story.today, gate: { ho: false, ins: false } };
    const o = h && h.outcome;
    if (o && o !== 'inspection_set') { S.cur = 0; S.sel = 0; S.ticks.intro[0] = o !== 'no_answer'; return S; }
    ['intro', 'look'].forEach((id) => { if (S.ticks[id]) S.ticks[id] = S.ticks[id].map(() => true); });
    if (S.ticks.inspection) { S.ticks.inspection[0] = true; S.ticks.inspection[3] = true; }
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
  let V = null;   // {ctx, h, S, els..., front, back, build, fuseP, tw...}
  const save = () => { if (V && !V.demo) A.store.set(keyOf(V.h), V.S); };

  /* ------------------------------------------------------------------ view */
  A.view.register('deal', {
    title: { en: 'Deal', es: 'Venta' }, key: '4', ambient: false, dim: 0.42, hail: 0.25,
    camera(frame) {
      const h = home();
      if (frame.stacked) return { center: h.p, zoom: 17.7 };
      // the lot sits in the map strip to the right of the portrait
      const strip = Math.min(250, Math.max(190, frame.focus.w * 0.24));
      return { center: h.p, zoom: 18.1, offset: [frame.focus.w / 2 - strip / 2 - 4, -frame.focus.h * 0.06] };
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
    V = { ctx, h, S: load(h), demo: false, fuseP: 0, stacked: A.stacked() };
    ctx.own(() => { if (V && V.ctx === ctx) teardown(); });

    /* center: the portrait stage */
    const stage = ctx.el('center', `
      <figure class="deal-stage__fig">
        <div class="deal-canvas"><canvas class="deal-portrait deal-portrait--a" aria-hidden="true"></canvas><canvas class="deal-portrait deal-portrait--b" aria-hidden="true"></canvas></div>
      <div class="deal-plate deal-plate--tl">
        <p class="t-micro deal-plate__k">${L('Elevation', 'Fachada')} · <span class="deal-plate__addr">${A.esc(h.addr || '')}</span> ${A.ui.sampleTag()}</p>
        <p class="deal-plate__t"><span class="deal-plate__form"></span></p>
        <p class="deal-legend"><span class="t-micro">${L('Hail rings', 'Anillos de granizo')}</span> ${A.ui.srcTag('mrms')}<span data-h="1"><i></i>1 ${L('in', 'pulg')}</span><span data-h="15"><i></i>1.5</span><span data-h="2"><i></i>2+</span></p>
      </div>
      <div class="deal-plate deal-plate--tr" aria-live="polite"><p class="t-micro">${L('Focus', 'Enfoque')}</p><p class="deal-plate__focus"></p></div>
      <div class="deal-plate deal-plate--bl">
        <p class="t-micro deal-plate__k">${L('On this step', 'En este paso')} <span class="deal-plate__n"></span></p>
        <ul class="deal-tags"></ul>
      </div>
      </figure>
      <div class="deal-trackmount deal-trackmount--center"></div>`, 'deal-stage');
    stage.setAttribute('data-no-in', '');
    V.stage = stage; V.fig = A.$('.deal-stage__fig', stage);
    V.cvA = A.$('.deal-portrait--a', stage); V.cvB = A.$('.deal-portrait--b', stage);
    V.front = V.cvA; V.back = V.cvB; V.cvB.style.opacity = '0';

    /* left: the door, then the selected step, then the actions */
    const f = window.House ? House.form(h) : 'ranch';
    const zid = String((A.data.walk && A.data.walk.zone_id) || ''), storm = (/^(\d{4}-\d{2}-\d{2})/.exec(zid) || [])[1], town = (/_([A-Za-z ]+)~/.exec(zid) || [])[1] || 'Columbus';
    V.head = ctx.el('left', `
      <div class="deal-head__top">
        <p class="eyebrow eyebrow--acc">${E(LB.title || { en: 'Deal', es: 'Venta' })} · ${L('Door', 'Puerta')} ${A.esc(String(h.rank || 1))} ${A.ui.sampleTag()}</p>
        <p class="t-micro deal-head__pos"></p>
      </div>
      <h1 class="t-title deal-head__addr">${A.esc(h.addr || '')}</h1>
      <p class="t-small deal-head__sub">${A.esc(town)}, NE · ${E(FORM[f] || FORM.ranch)} · ${h.own ? L('owner lives here', 'vive el dueño') : L('may be rented', 'puede ser rentada')} ${A.ui.srcTag('homes')}</p>
      <div class="stats deal-stats">
        <div class="stat"><span class="stat__k">${L('Hail here', 'Granizo aquí')} ${A.ui.srcTag('mrms')}</span><span class="stat__v" data-h="${A.ui.hailKey(h.hail)}">${A.both(() => A.fmt.inches(h.hail))}</span></div>
        <div class="stat"><span class="stat__k">${L('Storm', 'Tormenta')} ${A.ui.srcTag('spc')}</span><span class="stat__v">${storm ? A.both(() => A.fmt.date(storm)) : '–'}</span></div>
        <div class="stat"><span class="stat__k">${L('Roof', 'Techo')} ${A.ui.sampleTag()}</span><span class="stat__v">${A.esc(String(h.roof == null ? '–' : h.roof))}<span class="stat__u">${L('yrs', 'años')}</span></span></div>
        <div class="stat"><span class="stat__k">${L('Score', 'Puntaje')} ${A.ui.srcTag('engine')}</span><span class="stat__v">${A.esc(String(h.score == null ? '–' : h.score))}</span></div>
      </div>`, 'pane deal-head');
    V.step = ctx.el('left', '', 'pane deal-step');
    V.step.setAttribute('role', 'tabpanel'); V.step.id = 'deal-step'; V.step.setAttribute('aria-live', 'polite');
    V.foot = ctx.el('left', '', 'pane pane--foot deal-foot');

    /* bottom dock: path + armor + the homeowner button (last in the DOM, shown top-right) */
    V.dock = ctx.el('bottom', `
      <div class="deal-dock__path">
        <p class="sec deal-dock__sec">${E(LB.stepsTab || { en: 'The path', es: 'El camino' })} <span class="sec__meta deal-dock__where"></span></p>
      </div>
      <div class="deal-trackmount deal-trackmount--dock"></div>
      <div class="deal-dock__armor">
        <p class="sec">${E(LB.armorTitle || { en: 'Legal armor', es: 'Armadura legal' })} ${A.ui.srcTag('law')} <span class="sec__meta deal-dock__note">${E(LB.armorNote)}</span></p>
        <div class="deal-armor">${armorHTML()}</div>
      </div>
      <div class="deal-dock__hand"><button type="button" class="btn btn--secondary btn--sm deal-handbtn" data-act="sheet" aria-haspopup="dialog"><i data-icon="doc" class="i--sm"></i>${E(X.hand)}</button></div>`, 'pane pane--tight deal-dock');

    /* the track: built once, mounted in the dock (desktop) or under the portrait (stacked) */
    V.track = A.h(trackHTML()); A.ui.icons(V.track);
    mountTrack();

    /* events */
    V.track.addEventListener('click', (e) => { const b = e.target.closest('.deal-node'); if (b) select(+b.dataset.i, { focus: false }); });
    V.track.addEventListener('keydown', onTrackKey);
    V.dock.addEventListener('click', (e) => {
      const a = e.target.closest('.deal-arm'); if (a) { select(+a.dataset.step); return; }
      if (e.target.closest('[data-act="sheet"]')) openSheet(e.target.closest('button'));
    });
    V.step.addEventListener('click', onStepClick);
    V.step.addEventListener('change', onStepChange);
    V.foot.addEventListener('click', onFootClick);
    ctx.on('lang', () => { paintNow(); renderPlates(); renderWhere(); if (V.S.sel === 5 || V.S.sel === 6) renderClock(); });
    ctx.on('theme', () => { A.ui && paintNow(); });
    ctx.on('escape', () => { if (V && V.modal) closeSheet(); else skipIntro(); });
    ctx.on('deal:home', () => { if (A.view.current === 'deal') A.view.go('deal', { force: true, instant: true }); });

    /* sizes: the portrait fills the free area above the dock */
    const relay = () => A.safe('deal layout', layout);
    try { V.ro = new ResizeObserver(relay); V.ro.observe(V.dock); V.ro.observe(ctx.slots.center); } catch (e) { /* old browser */ }
    const onRz = () => relay(); addEventListener('resize', onRz); ctx.own(() => removeEventListener('resize', onRz));

    /* the lot on the map */
    ctx.layer({ id: 'deal-site', z: 205, draw2d: drawSite });
    ctx.pin('deal-home', h.p, A.h(`<div class="deal-pin"><span class="deal-pin__addr">${A.esc(h.addr || '')}</span><span class="deal-pin__meta">${A.esc(Number(h.p[1]).toFixed(4))}° N · ${A.esc(Math.abs(Number(h.p[0])).toFixed(4))}° W</span></div>`), { anchor: 'top', minZoom: 16, offset: [0, 26] });

    /* first paint */
    renderStep(false); renderFoot(); renderWhere(); renderPlates(); updateTrack(); updateArmor();
    layout();
    ctx.on('view', () => relay());
    requestAnimationFrame(() => { if (V && V.ctx === ctx) relay(); });
    V.siteT0 = performance.now(); if (A.world && A.world.keepAlive) A.world.keepAlive(1900);
    if (A.still) { setFuse(V.S.cur, false); paintNow(); }
    else {
      setFuse(0, false);
      ctx.timer(() => burnTo(V.S.cur, { ms: 420 + 170 * V.S.cur }), 420);
      ctx.timer(() => startBuild(), 160);
    }
    A._dv = () => V;
    A.dealDemo = { step: (i) => demoStep(i), select: (i) => select(i), open: () => openSheet(null), close: () => closeSheet() };
  }

  /* ------------------------------------------------------------------ layout */
  function mountTrack() {
    const st = A.stacked(), m = A.$(st ? '.deal-trackmount--center' : '.deal-trackmount--dock', st ? V.stage : V.dock);
    V.stacked = st;
    V.track.classList.toggle('is-vert', st);
    if (m && V.track.parentNode !== m) m.appendChild(V.track);
  }
  const TAGS_H = 62;   // room under the drawing for the "on this step" tags (desktop)
  function layout() {
    if (!V) return;
    if (A.stacked() !== V.stacked) { mountTrack(); setFuse(V.fuseP, false); }
    const fig = V.fig, cw = A.$('.deal-canvas', V.stage); if (!fig || !cw) return;
    let w, ch;
    if (V.stacked) {
      w = Math.round(fig.clientWidth || V.stage.clientWidth || 0);
      ch = Math.round(A.clamp(w * 0.6, 210, 380));
      fig.style.height = ''; fig.style.width = ''; V.stage.style.height = ''; cw.style.height = ch + 'px';
    } else {
      const cr = V.ctx.slots.center.getBoundingClientRect(), dr = V.dock.getBoundingClientRect();
      if (!cr.width || !dr.height) return;                  // slots not shown yet: the RO / 'view' event calls again
      const hgt = Math.max(260, Math.round(dr.top - cr.top - 14));
      const strip = Math.min(250, Math.max(190, cr.width * 0.24));
      w = Math.max(360, Math.round(cr.width - strip));
      ch = hgt - TAGS_H - 44;
      V.stage.style.height = hgt + 'px';
      fig.style.height = hgt + 'px'; fig.style.width = w + 'px'; cw.style.height = '';
    }
    if (!(w > 0)) return;
    V.pw = w; V.ph = ch;
    const key = w + 'x' + ch;
    if (key !== V.sizeKey) { V.sizeKey = key; if (!V.build) paintNow(); }
  }

  /* ------------------------------------------------------------------ portrait */
  function houseTheme() {
    return { ink: A.tok('--text'), line: A.tok('--rule-2'), acc: A.tok('--acc'), h0: A.tok('--h0'), h1: A.tok('--h1'), h15: A.tok('--h15'), h2: A.tok('--h2'), bg: A.tok('--page') };
  }
  const hl = () => (V ? HL[(STEPS[V.S.sel] || {}).id] || null : null);
  function paint(cv, t, hi) {
    if (!window.House || !cv || !V) return;
    if (!V.pw) return;
    House.draw(cv, V.h, { t, theme: houseTheme(), highlight: hi, labels: House.labels(V.h, A.lang), sheet: true, width: V.pw, height: V.ph });
  }
  function paintNow() { if (!V || V.build) return; A.safe('deal portrait', () => { paint(V.front, null, hl()); V.front.style.opacity = '1'; V.back.style.opacity = '0'; }); }
  function startBuild() {
    if (!V || !window.House) return;
    stopBuild();
    if (A.still) { paintNow(); return; }
    let t0 = null, rang = false;
    const sp = 1.2, end = House.DURATION + 0.1;
    const fn = (now) => {
      if (!V || V.build !== fn) return false;
      if (t0 == null) t0 = now;
      const t = (now - t0) / 1000 * sp;
      A.safe('deal build', () => paint(V.front, Math.min(t, end), hl()));
      if (!rang && t > 3.1) { rang = true; snd((S) => { for (let i = 0; i < 5; i++) S.hail(0.35 + i * 0.1, { surface: 'roof', delay: i * 0.13, gain: 0.5 }); }); }
      if (t >= end) { V.build = null; paintNow(); return false; }
      return true;
    };
    V.build = fn; A.motion.ticker.add(fn);
  }
  function stopBuild() { if (V && V.build) { A.motion.ticker.remove(V.build); V.build = null; } }
  function skipIntro() {
    if (!V) return;
    if (V.build) { stopBuild(); paintNow(); }
    if (V.fuseTw) { V.fuseTw.cancel(); V.fuseTw = null; setFuse(V.S.cur, false); V.track.classList.remove('is-burning'); }
  }
  /** the highlight follows the step: crossfade two canvases (opacity only) */
  function refocus() {
    if (!V || V.build) return;           // during the build the live loop reads hl() each frame
    const hi = hl();
    if (hi === V.hiShown) return;
    V.hiShown = hi;
    if (A.still) { paintNow(); return; }
    A.safe('deal refocus', () => {
      paint(V.back, null, hi);
      if (V.fadeTw) V.fadeTw.cancel();
      const a = V.front, b = V.back;
      V.front = b; V.back = a;
      V.fadeTw = A.motion.tween({ from: 0, to: 1, ms: 320, ease: 'inOutSine', update: (k) => { b.style.opacity = String(k); a.style.opacity = String(1 - k); } });
    });
  }
  function renderPlates() {
    if (!V) return;
    const f = window.House ? House.form(V.h) : 'ranch', s = STEPS[V.S.sel] || {}, hi = HL[s.id];
    const fm = A.$('.deal-plate__form', V.stage);
    if (fm) fm.innerHTML = `${E(FORM[f] || FORM.ranch)} · ${L('built', 'construida en')} ${A.esc(String(V.h.built || '–'))} ${A.ui.sampleTag()}`;
    const fo = A.$('.deal-plate__focus', V.stage);
    if (fo) fo.innerHTML = `<b class="num">${pad2(V.S.sel + 1)}</b> ${E(s.title)}${hi ? ` <span class="deal-plate__arrow">→</span> <span class="deal-plate__part">${E(HL_NAME[hi])}</span>` : ''}`;
    renderTags(false);
  }
  function renderTags(animate) {
    const ul = A.$('.deal-tags', V.stage); if (!ul) return;
    const s = STEPS[V.S.sel] || {}, t = V.S.ticks[s.id] || [], list = TAGS[s.id] || [];
    const key = s.id + ':' + list.map((x) => (t[x[0]] ? 1 : 0)).join('');
    if (key === V.tagKey && !animate) return;
    const stepChanged = !V.tagKey || V.tagKey.split(':')[0] !== s.id; V.tagKey = key;
    ul.innerHTML = list.map((x) => `<li class="deal-tag${t[x[0]] ? ' is-on' : ''}"><span class="deal-tag__b"><i data-icon="check"></i></span>${L(x[1], x[2])}</li>`).join('');
    A.ui.icons(ul);
    const n = A.$('.deal-plate__n', V.stage), done = list.filter((x) => t[x[0]]).length;
    if (n) n.innerHTML = `<b class="num">${done}</b>/${list.length}`;
    if (stepChanged && !A.still) A.motion.stagger(ul.children, { each: 55, y: 10, ms: 520, delay: 60 });
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
      const sl = streetLat(x), north = sl == null ? true : x.p[1] < sl;   // front faces the street
      const fm = window.House ? House.form(x) : 'ranch';
      const hw = ({ cottage: 30, ranch: 50, split: 44, two: 38, large: 46 }[fm] || 44) * ppf, hd = ({ cottage: 26, ranch: 30, split: 30, two: 30, large: 36 }[fm] || 30) * ppf;
      const lw = 64 * ppf, ld = 128 * ppf, dir = north ? -1 : 1;             // screen y toward the street
      const lotY = q[1] - dir * (ld / 2 - hd / 2 - 26 * ppf);
      c.globalAlpha = base * (me ? 0.9 : 0.5); c.strokeStyle = me ? P.text2 : P.rule2; c.lineWidth = me ? 1.1 : 0.8;
      c.setLineDash(me ? [] : [3, 3]); c.strokeRect(q[0] - lw / 2, lotY - ld / 2, lw, ld); c.setLineDash([]);
      c.globalAlpha = base * (me ? 1 : 0.8); c.fillStyle = me ? P.panel3 : P.panel2; c.fillRect(q[0] - hw / 2, q[1] - hd / 2, hw, hd);
      c.strokeStyle = me ? P.acc : P.rule3; c.lineWidth = me ? 1.6 : 0.8; c.strokeRect(q[0] - hw / 2, q[1] - hd / 2, hw, hd);
      // ridge line
      c.globalAlpha = base * (me ? 0.7 : 0.35); c.strokeStyle = me ? P.text2 : P.rule3; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(q[0] - hw / 2 + 3, q[1]); c.lineTo(q[0] + hw / 2 - 3, q[1]); c.stroke();
      // driveway to the street
      c.globalAlpha = base * (me ? 0.55 : 0.3); c.fillStyle = P.rule2;
      c.fillRect(q[0] + hw / 2 - 12 * ppf, q[1] + dir * hd / 2 - (dir < 0 ? 26 * ppf : 0), 10 * ppf, 26 * ppf);
      if (!me) continue;
      // the hail at this door: seeded impacts on the roof, colored by the hail scale
      const R = rngN(hashN(String(x.addr))), n = Math.round(6 + (x.hail || 1) * 6), col = A.world.hailColor(x.hail);
      c.strokeStyle = col; c.lineWidth = 1;
      for (let i = 0; i < n; i++) {
        const u = R(), v = R(), dly = 0.25 + i * 0.05, k = still ? 1 : A.clamp((since - dly) / 0.35, 0, 1);
        if (k <= 0) continue;
        const px = q[0] - hw / 2 + 3 + u * (hw - 6), py = q[1] - hd / 2 + 3 + v * (hd - 6), r = (0.9 + (x.hail || 1) * 0.9) * (0.6 + 0.4 * A.motion.ease.hail(k));
        c.globalAlpha = base * 0.95 * k; c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.stroke();
      }
      // the knock: one ring out from the door on arrival, then a quiet halo
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
    return `<div class="deal-track" role="tablist" aria-label="${A.esc(tt(LB.stepsTab || { en: 'The path', es: 'El camino' }))}">
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
    if (passing) {
      A.$$('.deal-node', V.track).forEach((b, i) => { b.classList.toggle('is-lit', i <= p + 0.02); });
    } else A.$$('.deal-node', V.track).forEach((b, i) => b.classList.toggle('is-lit', i <= Math.min(p, V.S.cur)));
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
    const k = e.key, vert = V.track.classList.contains('is-vert');
    const nextK = vert ? 'ArrowDown' : 'ArrowRight', prevK = vert ? 'ArrowUp' : 'ArrowLeft';
    let i = V.S.sel;
    if (k === nextK) i++; else if (k === prevK) i--; else if (k === 'Home') i = 0; else if (k === 'End') i = N - 1; else return;
    e.preventDefault(); e.stopPropagation(); select(A.clamp(i, 0, N - 1), { focus: true });
  }

  /* ------------------------------------------------------------------ armor */
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
    return (CD.armor || []).map((a) => `<button type="button" class="deal-arm" data-step="${armorStep(a)}" data-tip="${A.esc(a.plain.en)}" data-tip-es="${A.esc(a.plain.es)}">
        <span class="deal-arm__c">${A.esc(cite(a.cite))}</span><span class="deal-arm__t">${E(a.title)}</span></button>`).join('');
  }
  function updateArmor() {
    if (!V) return;
    A.$$('.deal-arm', V.dock).forEach((b) => { const on = +b.dataset.step === V.S.sel; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
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
    return `<ul class="deal-check">${(s.collect || []).map((c, k) => `<li><button type="button" class="deal-ck" role="checkbox" aria-checked="${!!t[k]}" data-k="${k}">
        <span class="deal-ck__box"><i data-icon="check"></i></span><span class="deal-ck__t">${E(c)}</span></button></li>`).join('')}</ul>`;
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
    A.ui.icons(V.step);
    if (clock) renderClock();
    if (gate) renderGate();
    V.step.scrollTop = 0;
    if (animate && !A.still) {
      const kids = Array.from(V.step.children);
      A.motion.stagger(kids, { each: 38, y: 12, ms: 540 });
      const top = V.step.closest('.slot'); if (top && top.scrollTop > V.step.offsetTop) top.scrollTo({ top: Math.max(0, V.step.offsetTop - 8) });
    }
  }
  function refreshCount() {
    const i = V.S.sel, tc = tickCount(i);
    const n = A.$('.deal-collect__n', V.step); if (n) n.innerHTML = `<b class="num">${tc.n}</b> ${L('of', 'de')} ${tc.of}`;
    const bar = A.$('.deal-collect__bar > span', V.step);
    if (bar) { const k = tc.of ? tc.n / tc.of : 0; if (A.still || !bar.animate) bar.style.transform = `scaleX(${k})`; else { const was = bar.style.transform; bar.style.transform = `scaleX(${k})`; try { bar.animate([{ transform: was || 'scaleX(0)' }, { transform: `scaleX(${k})` }], { duration: 420, easing: A.motion.css.hail }); } catch (e) { /* ignore */ } } }
    return tc;
  }
  function onStepClick(e) {
    const ck = e.target.closest('.deal-ck');
    if (ck) {
      const s = STEPS[V.S.sel], k = +ck.dataset.k, arr = V.S.ticks[s.id]; if (!arr) return;
      arr[k] = !arr[k]; ck.setAttribute('aria-checked', String(arr[k])); save();
      const box = A.$('.deal-ck__box', ck);
      if (arr[k]) { A.motion.ripple(box, { rings: 2, size: 40 }); snd((S) => S.ring(Math.min(5, k))); } else snd((S) => S.tick());
      const tc = refreshCount(); updateTrack(); renderTags(false);
      if (arr[k]) { const ti = (TAGS[s.id] || []).findIndex((x) => x[0] === k), tg = ti >= 0 ? A.$$('.deal-tag', V.stage)[ti] : null; if (tg) A.motion.ripple(A.$('.deal-tag__b', tg) || tg, { rings: 1, size: 30 }); }
      if (arr[k] && tc.n === tc.of) { const r = A.$(`.deal-node[data-i="${V.S.sel}"] .deal-node__ring`, V.track); if (r) A.motion.ripple(r, { rings: 2, size: 52 }); }
      return;
    }
    const ty = e.target.closest('[data-type]');
    if (ty) { V.S.type = ty.dataset.type === 'cash' ? 'cash' : 'ins'; save(); if (A.$('.deal-clock', V.step)) renderClock(); if (A.$('.deal-gate', V.step)) renderGate(); return; }
    const sd = e.target.closest('[data-sd]');
    if (sd) { V.S.signed = sd.dataset.sd; save(); renderClock(true); return; }
    const g = e.target.closest('[data-gate]');
    if (g) {
      const k = g.dataset.gate; V.S.gate[k] = !V.S.gate[k]; save();
      if (V.S.gate[k]) A.motion.ripple(A.$('.deal-ck__box', g) || g, { rings: 2, size: 40 });
      renderGate(); return;
    }
  }
  function onStepChange(e) {
    const inp = e.target.closest('.deal-date');
    if (inp && parse(inp.value) != null) { V.S.signed = inp.value; save(); renderClock(true); }
  }

  /* cancel window clock */
  function typeSeg() {
    const t = V.S.type;
    return `<div class="seg seg--ui deal-type" role="group" aria-label="${A.esc(tt({ en: 'Job type', es: 'Tipo de trabajo' }))}">
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
      const lab = d.kind === 'sale' ? L('Sale', 'Venta') : d.kind === 'skip' ? E(d.why) : `${L('Day', 'Día')} ${d.n}`;
      const end = d.iso === W.end;
      return `<li class="deal-day deal-day--${d.kind}${end ? ' is-end' : ''}"><span class="deal-day__w">${A.both(() => A.fmt.date(d.iso, 'day').split(/[ ,]/)[0])}</span><span class="deal-day__d num">${new Date(parse(d.iso)).getUTCDate()}</span><span class="deal-day__l">${lab}</span></li>`;
    }).join('');
    const rule = V.S.type === 'cash'
      ? `<p class="deal-clock__rule"><i data-icon="shield" class="i--sm"></i><span>${L('No work before it ends on a non-insurance sale.', 'Nada de trabajo antes de que termine, en una venta sin reclamo de seguro.')} <span class="deal-cite">69-1606(5)</span></span></p>`
      : `<p class="deal-clock__rule"><i data-icon="shield" class="i--sm"></i><span>${L('Insurance job: the itemized description goes to the homeowner and the insurer before any repair.', 'Trabajo con seguro: la descripción detallada va al dueño y a la aseguradora antes de cualquier reparación.')} <span class="deal-cite">44-8606</span> ${L('The window can also run later.', 'El plazo también puede correr después.')} <span class="deal-cite">44-8603</span></span></p>`;
    const deg = Math.round(frac * 360);
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
        <button type="button" class="chip" data-sd="${A.esc(A.story.today)}" aria-pressed="${V.S.signed === A.story.today}">${L('Today', 'Hoy')}</button>
        <button type="button" class="chip" data-sd="2026-09-26" aria-pressed="${V.S.signed === '2026-09-26'}">${A.both(() => A.fmt.date('2026-09-26', 'short'))}</button>
        <button type="button" class="chip" data-sd="2026-09-05" aria-pressed="${V.S.signed === '2026-09-05'}">${L('Labor Day weekend', 'Fin de semana del Día del Trabajo')}</button>
      </div>
      ${typeSeg()}
      ${rule}`;
    A.ui.icons(el);
    const hand = A.$('.deal-dial__hand', el);
    if (hand && !A.still && hand.animate) {
      try { hand.animate([{ transform: 'rotate(0deg)' }, { transform: `rotate(${deg}deg)` }], { duration: 900, easing: A.motion.css.hail }); } catch (e) { /* ignore */ }
      if (ring) { A.motion.stagger(A.$$('.deal-day', el), { each: 40, y: 8, ms: 460 }); const endEl = A.$('.deal-day.is-end', el); if (endEl) setTimeout(() => A.motion.ripple(endEl, { rings: 1, size: 60 }), 260); }
    }
  }
  /** before the build: insurance = 44-8606 both copies; no claim = the cancel window must have closed (69-1606(5)) */
  function gateState() {
    const S = V.S;
    if (S.type === 'ins') return { clear: S.gate.ho && S.gate.ins, why: !S.gate.ho && !S.gate.ins ? 'both' : !S.gate.ho ? 'ho' : 'ins' };
    const W = cancelWindow(S.signed); const closed = W && storyNow() >= W.endMs;
    return { clear: !!closed, why: 'window', end: W && W.end };
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
    A.ui.icons(el);
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
    V.foot.innerHTML = `<div class="deal-foot__row">${main}</div><button type="button" class="btn btn--ghost btn--sm deal-foot__reset" data-act="reset" data-label-en="Reset door" data-label-es="Reiniciar puerta"><i data-icon="x" class="i--sm"></i>${E(X.reset)}</button>`;
    A.ui.icons(V.foot); A.ui.localize(V.foot);
  }
  function onFootClick(e) {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act, S = V.S;
    if (act === 'done') markDone();
    else if (act === 'reopen') { setCur(S.sel); }
    else if (act === 'goto') select(S.cur);
    else if (act === 'reset') {
      V.S = defaults(V.h); save(); if (V.S.sel === V.S.sel) select(V.S.sel, { force: true }); burnTo(V.S.cur); updateTrack(); renderWhere();
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
        select(i + 1); return;
      }
    }
    snd((Sd) => Sd.knock({ count: 2, gain: 0.8 }));
    setCur(i + 1);
    if (i + 1 < N) select(i + 1);
    else { renderStep(false); renderFoot(); A.ui.toast({ en: 'Job complete on this door', es: 'Trabajo terminado en esta puerta' }, { icon: 'flag', ms: 1800 }); }
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
    V.S.sel = i; if (!V.demo) save();
    updateTrack(); updateArmor(); renderPlates(); renderFoot();
    if (changed || o.force) renderStep(true);
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
    const steps = (H.steps || []).map((s, i) => `<li><span class="deal-paper__n">${i + 1}</span><div><p class="deal-paper__st">${g(s.title)}</p><p>${g(s.body)}</p></div></li>`).join('');
    const sig = lang === 'es' ? ['Recibido por el dueño', 'Fecha'] : ['Received by homeowner', 'Date'];
    const addrLab = lang === 'es' ? 'Casa' : 'Home';
    return `<section class="deal-paper__col" lang="${lang}">
      <p class="deal-paper__lang">${lang === 'es' ? 'Español' : 'English'}</p>
      <h3 class="deal-paper__h">${g(H.title)}</h3>
      <p class="deal-paper__lead">${g(H.greeting)}</p>
      <p class="deal-paper__home">${addrLab}: <b>${A.esc(V.h.addr || '')}</b></p>
      <ol class="deal-paper__steps">${steps}</ol>
      <div class="deal-paper__cancel">
        <p class="deal-paper__ch">${g(C.title)}</p>
        <p><b>${g(C.lead)}</b></p>
        <p>${g(C.how)}</p>
        <p>${g(C.insurance)}</p>
        <p>${g(C.refund)}</p>
        <p class="deal-paper__blank">${g(C.endsOn)}</p>
        <p class="deal-paper__fine">${g(C.official)}</p>
      </div>
      <dl class="deal-paper__contact">
        <div><dt>${g(K.mailingLabel)}</dt><dd>${g(K.mailing)}</dd></div>
      </dl>
      <p class="deal-paper__blank">${g(K.registration)}</p>
      <p class="deal-paper__blank">${g(K.saleDate)}</p>
      <p class="deal-paper__blank">${g(K.rep)}</p>
      <p class="deal-paper__fine">${g(K.phone)}</p>
      <div class="deal-paper__sig"><span class="deal-paper__line"></span><span>${sig[0]}</span><span class="deal-paper__line deal-paper__line--s"></span><span>${sig[1]}</span></div>
    </section>`;
  }
  function openSheet(opener) {
    if (!V || V.modal) return;
    const H = CD.homeowner || {};
    const ov = V.ctx.slots.overlay;
    const m = A.h(`<div class="deal-modal" role="dialog" aria-modal="true" aria-labelledby="deal-sheet-h">
      <div class="deal-modal__scrim"></div>
      <div class="deal-modal__box">
        <div class="deal-modal__bar">
          <p class="deal-modal__k"><i data-icon="doc" class="i--sm"></i><span id="deal-sheet-h">${E(LB.homeownerTab || { en: 'Homeowner sheet', es: 'Hoja del dueño' })}</span>
            <span class="t-micro deal-modal__sub">${L('What the homeowner keeps. Branded HMP.', 'Lo que se queda el dueño. Con la marca de HMP.')}</span></p>
          <div class="deal-modal__ctl">
            <button type="button" class="btn btn--secondary btn--sm" data-act="print"><i data-icon="doc" class="i--sm"></i>${E(((window.COPY || {}).ui || {}).common ? COPY.ui.common.print : { en: 'Print', es: 'Imprimir' })}</button>
            <button type="button" class="btn btn--ghost btn--icon deal-modal__x" data-act="close" data-label-en="Close" data-label-es="Cerrar"><i data-icon="x"></i></button>
          </div>
        </div>
        <div class="deal-modal__scroll" tabindex="0" data-label-en="Homeowner sheet" data-label-es="Hoja del dueño" role="document">
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
    ov.appendChild(m);
    const prev = document.activeElement;
    V.modal = { el: m, opener: opener || (prev && prev !== document.body ? prev : null) };
    const box = A.$('.deal-modal__box', m), scrim = A.$('.deal-modal__scrim', m);
    m.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'close') closeSheet();
      else if (b.dataset.act === 'print') {
        A.ui.toast(((window.COPY || {}).ui || {}).toast ? COPY.ui.toast.sheetReady : { en: 'Homeowner sheet ready to print', es: 'Hoja del dueño lista para imprimir' }, { icon: 'doc', ms: 1600 });
        setTimeout(() => { try { window.print(); } catch (err) { /* print blocked in this frame */ } }, 60);
      }
    });
    m.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSheet(); return; }
      if (e.key !== 'Tab') return;
      const f = A.$$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', box).filter((n) => !n.disabled && n.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!box.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    });
    // light dismiss: a press outside the box (not the top bar, not the opener) closes the sheet
    const outside = (e) => {
      if (!V || !V.modal) return;
      const t = e.target;
      if (box.contains(t) || (t.closest && (t.closest('#topbar') || t.closest('.deal-handbtn') || t.closest('.tip')))) return;
      closeSheet(true);
    };
    document.addEventListener('pointerdown', outside, true);
    V.modal.off = () => document.removeEventListener('pointerdown', outside, true);
    // focus lands on the sheet itself, so arrow keys scroll it; Tab reaches Print and Close
    const x = A.$('.deal-modal__scroll', m); setTimeout(() => { try { (x || box).focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 20);
    if (!A.still) {
      try { scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: A.motion.css.out }); } catch (e) { /* ignore */ }
      A.motion.reveal(box, { y: 22, ms: 620, ring: false });
      const paper = A.$('.deal-paper', m); if (paper) A.motion.stagger(A.$$('.deal-paper__col', paper), { each: 90, y: 14, ms: 620, delay: 120 });
    }
    snd((S) => S.tick());
  }
  function closeSheet(quick) {
    if (!V || !V.modal) return;
    const M = V.modal; V.modal = null;
    if (M.off) M.off();
    const done = () => { M.el.remove(); if (M.opener && M.opener.isConnected) { try { M.opener.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } };
    if (quick || A.still) { done(); return; }
    A.motion.exit([M.el], { ms: 150 }).then(done);
  }
  A.on('deal:home', (h) => { if (h && h.p) A.dealHome = h; });
})();
