/* Claude's Aldaba · money.js · #money = the path to FilthE's $100,000 by Dec 31, 2026
   Honest and useful: at new-rep industry rates the goal takes ~285 doors a day, far over the ~42 his 3.5 hours hold.
   The screen does not hide that; it turns it into levers he can move and shows exactly what would make it fit.

   Left: the goal, the knocker ring (outer: logged toward $100k; inner: how much of the pace his day covers), the
   answer (doors a day it takes vs what fits), the levers (commission example set by HMP, close-rate stage, hours,
   knock days; remembered per viewer) and "what would make it fit". Right: the reverse funnel from $100k down to
   doors a day, each step with its rate and source. Dock: what it takes this week. Map (dimmed): every 2026 hail
   area as a ring sized by its homes (Census), next to a ring for the doors the goal takes, and the 12 ranked zones.
   Never a forecast or a promise of earnings; the average claim is an industry figure. */
(function () {
  'use strict';
  const A = window.A; if (!A || !A.view) return;
  const COPY = window.COPY || {};
  const FN = window.Funnel || null;

  const cp = (path, en, es) => { let o = COPY; for (const k of path.split('.')) o = o && o[k]; return o && o.en ? o : { en, es }; };
  const sub = (s, v) => String(s == null ? '' : s).replace(/\{(\w+)\}/g, (m, k) => (v && v[k] != null ? v[k] : m));
  const Lx = (o, v) => A.L(A.esc(sub(o.en, typeof v === 'function' ? v('en') : v)), A.esc(sub(o.es, typeof v === 'function' ? v('es') : v)));
  const Le = (en, es) => A.L(A.esc(en), A.esc(es));
  const ic = (n, s) => A.ui.icon(n, { size: s || 16 });
  const rgba = (tok, a) => { const c = A.rgba(tok); return 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ',' + (a == null ? c[3] : a * c[3]).toFixed(3) + ')'; };
  const E = A.motion.ease;

  const GOAL = 100000, END = '2026-12-31';
  const DEF = { commission: 1300, stage: 'new', hours: 3.5, days: 5 };
  const STAGES = [
    { id: 'new', pct: 1, label: { en: 'New rep', es: 'Novato' },
      tip: { en: 'ilroofinginstitute.com: new reps, first 30 days, 0.5-2% of doors book a qualified inspection (1% typical).', es: 'ilroofinginstitute.com: vendedores nuevos, primeros 30 días, 0.5-2% de las puertas agendan una inspección calificada (1% típico).' } },
    { id: 'typical', pct: 2, label: { en: 'Typical', es: 'Típico' },
      tip: { en: 'ilroofinginstitute.com: 2% sits where the new-rep range (0.5-2%) meets the top-performer range (2-5%).', es: 'ilroofinginstitute.com: 2% está donde se juntan el rango de novatos (0.5-2%) y el de los mejores (2-5%).' } },
    { id: 'exp', pct: 3.5, label: { en: 'Experienced', es: 'Con experiencia' },
      tip: { en: 'ilroofinginstitute.com: top performers book a qualified inspection at 2-5% of doors (3.5% typical).', es: 'ilroofinginstitute.com: los mejores agendan una inspección calificada en 2-5% de las puertas (3.5% típico).' } }
  ];
  // the foundation's 'bench' tag (industry benchmark, replaced by HMP's own numbers after ~200 doors) + where it came from
  // extra: an optional {en, es} sentence after the source (never English glued into the Spanish note)
  // funnel.js (read-only here) still carries a few English words in its sources: the Spanish note swaps them
  const SRC_ES = [['rookie knocking benchmarks (research round 6)', 'referencias de vendedores novatos (ronda de investigación 6)'],
    ['new rep, first 30 days', 'vendedor nuevo, primeros 30 días'], ['top performers', 'los mejores vendedores'],
    ['whole-company funnel', 'embudo de toda la empresa'], ['assumed 1:1 until HMP has data (no benchmark)', 'se supone 1:1 hasta tener datos de HMP (sin referencia)'],
    ['industry', 'industria']];
  const srcEs = (src) => SRC_ES.reduce((t, r) => t.split(r[0]).join(r[1]), String(src));
  const benchTag = (source, label, extra) => A.ui.srcTag('bench', { label, note: {
    en: 'Source: ' + source + '.' + (extra ? ' ' + extra.en : ''), es: 'Fuente: ' + srcEs(source) + '.' + (extra ? ' ' + extra.es : '') } });

  function loadLevers() {
    const s = A.store.get('money.levers', null) || {};
    return {
      commission: A.clamp(Math.round(+s.commission || DEF.commission), 300, 5000),
      stage: STAGES.some((x) => x.id === s.stage) ? s.stage : DEF.stage,
      hours: A.clamp(Math.round((+s.hours || DEF.hours) * 2) / 2, 1, 10),
      days: A.clamp(Math.round(+s.days || DEF.days), 3, 7)
    };
  }
  function calc(L) {
    if (!FN) return null;
    const o = { goal: GOAL, today: A.story.today, end: END, commissionPerJob: L.commission, knockDaysPerWeek: L.days, hoursPerDay: L.hours };
    if (L.stage === 'exp') o.rep = 'experienced';
    else if (L.stage === 'typical') o.rates = { doors_to_appointment: 2 };
    return FN.plan(o);
  }
  const rateOf = (p, id) => { const s = p.steps.find((x) => x.id === id); return s ? s.rate : 0; };
  /** single-lever answers + one mix that fits (all math, no promises) */
  function fixes(p, L) {
    const cap = p.capacity.doors, dph = FN.bench.doors_per_hour.typical;
    const rA = rateOf(p, 'appointments'), rI = rateOf(p, 'inspections'), rS = rateOf(p, 'signed'), rJ = rateOf(p, 'jobs');
    const jobsPossible = Math.floor(Math.floor(Math.floor(Math.floor(cap * rA) * rI) * rS) * rJ);
    const out = {
      hours: p.hoursPerDay,
      rate: cap ? Math.ceil(p.appointments / cap * 1000) / 10 : null,
      commission: jobsPossible ? Math.ceil(GOAL / jobsPossible / 50) * 50 : null,
      days7: calc(Object.assign({}, L, { days: 7 }))
    };
    let mix = null;
    const si = STAGES.findIndex((x) => x.id === L.stage);
    for (let k = si; k < STAGES.length && !mix; k++) {
      let best = null;
      for (let d = L.days; d <= 7; d++) for (let h = L.hours; h <= 8; h += 0.5) {
        const q = calc({ commission: L.commission, stage: STAGES[k].id, hours: h, days: d });
        if (q && q.capacity.fits && (!best || h * d < best.h * best.d)) best = { stage: STAGES[k].id, h, d, q };
      }
      mix = best;
    }
    out.mix = mix; out.dph = dph;
    return out;
  }

  let V = null;

  A.view.register('money', {
    title: { en: 'Money', es: 'Dinero' }, key: '5', dim: 0.5, hail: 0.3, ambient: false,
    camera: (fr) => ({ bounds: [[-97.5, 40.98], [-95.9, 41.62]], pad: fr.stacked ? 18 : { t: 40, r: 40, b: 40, l: 40 } }),
    enter(ctx) { A.safe('money enter', () => build(ctx)); },
    exit() { V = null; }
  });

  function build(ctx) {
    const F = A.fmt, U = A.ui;
    if (!FN) { ctx.el('left', `<div class="empty"><span class="empty__t">${Le('The funnel module did not load.', 'El módulo del embudo no cargó.')}</span></div>`, 'pane'); return; }
    const L = loadLevers();
    let P = calc(L);
    const v = (V = { ctx, L, P, el: {}, shown: { cov: 0, need: 0 }, grow: 1 });

    /* ======== LEFT ======== */
    const goal = ctx.el('left', `
      <p class="eyebrow eyebrow--acc">${Lx(cp('money.goal.label', "FilthE's goal", 'La meta de FilthE'))} ${U.srcTag('goal')}</p>
      <h1 class="t-title money-title">${Lx(cp('money.title', 'The path to $100,000', 'El camino a $100,000'))}</h1>
      <p class="money-when">${Le('by December 31, 2026', 'para el 31 de diciembre de 2026')} · <span data-m="days"></span></p>
      <div class="money-core">
        <div class="money-ring" tabindex="0" role="img" data-label-en="Inner ring: the share of the goal's pace your day covers. Outer ring: logged toward $100,000, $0 so far." data-label-es="Anillo interior: cuánto del ritmo de la meta cubre tu día. Anillo exterior: lo anotado hacia $100,000, $0 por ahora." data-tip="Inner ring: the share of the goal's pace your day covers. Outer ring: logged toward $100,000 (no jobs yet)." data-tip-es="Anillo interior: cuánto del ritmo de la meta cubre tu día. Anillo exterior: lo anotado hacia $100,000 (sin trabajos todavía).">
          <canvas data-m="ring" width="300" height="300" aria-hidden="true"></canvas>
          <div class="money-ring__mid"><b class="num" data-m="cov">0%</b><span>${Le('of the pace', 'del ritmo')}</span><em class="num">${Le('$0 logged', '$0 anotado')}</em></div>
        </div>
        <div class="money-ans">
          <span class="stat__k">${Le('Doors a day it takes', 'Puertas al día que pide')} ${benchTag('spotio.com, ilroofinginstitute.com, subcontractorhub.com')}</span>
          <span class="money-ans__v num" data-m="dpd">0</span>
          <span class="money-ans__fit"><span data-m="cap">0</span> ${Le('fit in your day', 'caben en tu día')}</span>
          <span class="chip" data-m="state"></span>
        </div>
      </div>
      <div class="money-mix" data-m="mix"></div>`, 'pane money-goal');

    const lev = ctx.el('left', `
      <p class="sec">${Le('Levers', 'Palancas')} <span class="sec__meta">${Le('saved on this device', 'guardadas en este equipo')}</span></p>
      <div class="money-lev">
        <div class="money-lv">
          <div class="money-lv__h"><span>${Lx(cp('money.commission.label', 'Example commission per job, set by HMP', 'Comisión de ejemplo por trabajo, la fija HMP'))}</span><b class="num" data-m="comm"></b></div>
          <input type="range" class="money-range" data-lv="commission" min="300" max="5000" step="50" aria-label="Commission per job" data-label-en="Example commission per job" data-label-es="Comisión de ejemplo por trabajo">
          <p class="money-lv__n" data-tip="${A.esc(cp('money.industry.avgClaim.note', 'Industry figure. Each claim is different, and the insurance company decides it.', '').en)}" data-tip-es="${A.esc(cp('money.industry.avgClaim.note', '', 'Cifra de la industria. Cada reclamo es distinto y lo decide la aseguradora.').es)}">${Le('Starts at 10% of a typical $13,000 wind and hail claim, an industry figure.', 'Empieza en 10% de un reclamo típico de $13,000 por viento y granizo, cifra de la industria.')} ${benchTag(FN.bench.avg_hail_wind_insurance_payout.source, undefined, { en: 'Each claim is different, and the insurance company decides it.', es: 'Cada reclamo es distinto y lo decide la aseguradora.' })} <span class="sample">${Le('example', 'ejemplo')}</span></p>
        </div>
        <div class="money-lv">
          <div class="money-lv__h"><span>${Le('Close-rate stage: doors that book an inspection', 'Etapa: puertas que agendan inspección')}</span><b class="num" data-m="stagepct"></b></div>
          <div class="seg seg--ui money-seg" role="group" data-lv="stage">${STAGES.map((s) => `<button type="button" data-v="${s.id}" data-tip="${A.esc(s.tip.en)}" data-tip-es="${A.esc(s.tip.es)}">${Le(s.label.en, s.label.es)}</button>`).join('')}</div>
        </div>
        <div class="money-lv money-lv--2">
          <div>
            <div class="money-lv__h"><span>${Le('Hours a day', 'Horas al día')}</span><b class="num" data-m="hours"></b></div>
            <input type="range" class="money-range" data-lv="hours" min="1" max="10" step="0.5" aria-label="Hours a day" data-label-en="Knocking hours a day" data-label-es="Horas de tocar puertas al día">
            <p class="money-lv__n"><span data-m="hoursDoors"></span> ${benchTag(FN.bench.doors_per_hour.source)}</p>
          </div>
          <div>
            <div class="money-lv__h"><span>${Le('Knock days a week', 'Días a la semana')}</span><b class="num" data-m="days"></b></div>
            <div class="seg money-seg money-seg--days" role="group" data-lv="days">${[3, 4, 5, 6, 7].map((d) => `<button type="button" data-v="${d}">${d}</button>`).join('')}</div>
            <p class="money-lv__n">${Le('Thanksgiving and Christmas off', 'Sin Acción de Gracias ni Navidad')}</p>
          </div>
        </div>
      </div>`, 'pane money-levpane');

    const fit = ctx.el('left', `
      <p class="sec">${Le('What would make it fit', 'Qué lo haría caber')} <span class="sec__meta">${Le('one lever at a time', 'una palanca a la vez')}</span></p>
      <ul class="money-fix" data-m="fix"></ul>
      <p class="money-note">${Lx(cp('money.bench.noPromise', 'A plan, not a promise.', 'Es un plan, no una promesa.'))}</p>`, 'pane money-fitpane');

    /* ======== RIGHT: the reverse funnel ======== */
    const fun = ctx.el('right', `
      <p class="sec">${Lx(cp('money.funnel.title', 'Work backward from the goal', 'De la meta hacia atrás'))}</p>
      <ol class="money-fun" data-m="fun"></ol>
      <p class="money-fun__note">${Lx(cp('money.bench.note', 'Industry benchmarks from vendor figures. They are not HMP’s results.', 'Cifras de la industria tomadas de proveedores. No son resultados de HMP.'))} ${Lx(cp('money.bench.replaced', 'HMP’s own numbers replace them after about 200 doors.', 'Los números propios de HMP las reemplazan después de unas 200 puertas.'))}</p>`, 'pane pane--tight money-funpane');

    /* ======== DOCK: this week ======== */
    const wk = ctx.el('bottom', `
      <p class="sec">${Lx(cp('money.week.title', 'What it takes this week', 'Lo que hace falta esta semana'))} <span class="sec__meta" data-m="weeks"></span></p>
      <div class="stats money-week" data-m="week"></div>
      <p class="money-week__line" data-m="wline"></p>`, 'pane pane--tight money-wkpane');

    Object.assign(v.el, { goal, lev, fit, fun, wk, ring: goal.querySelector('[data-m="ring"]'), mix: goal.querySelector('[data-m="mix"]') });

    /* ======== wiring ======== */
    const setL = (patch, o = {}) => {
      const prev = v.P; Object.assign(v.L, patch); v.P = calc(v.L);
      A.store.set('money.levers', v.L);
      render(v, prev, o);
    };
    A.$$('input[data-lv]', lev).forEach((inp) => {
      inp.value = v.L[inp.dataset.lv];
      inp.addEventListener('input', () => {
        if (v.mixTw) { v.mixTw.cancel(); v.mixTw = null; }
        setL({ [inp.dataset.lv]: +inp.value }, { live: true });
        // the fix list and the mix follow the drag, a beat behind (cheap, and never stale)
        clearTimeout(v.fixT); v.fixT = setTimeout(() => { if (V === v) A.safe('money fixes', () => renderFixes(v)); }, 150);
      });
      inp.addEventListener('change', () => { if (V !== v) return; clearTimeout(v.fixT); setL({}); });   // release: one full render
    });
    A.$$('.seg[data-lv]', lev).forEach((seg) => seg.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]'); if (!b) return;
      const k = seg.dataset.lv; setL({ [k]: k === 'days' ? +b.dataset.v : b.dataset.v });
    }));
    goal.addEventListener('click', (e) => {
      const b = e.target.closest('[data-m-act]'); if (!b) return;
      if (b.dataset.mAct === 'mix' && v.fx && v.fx.mix) applyMix(v, v.fx.mix, setL);
      if (b.dataset.mAct === 'reset') applyMix(v, { stage: DEF.stage, h: DEF.hours, d: DEF.days, c: DEF.commission }, setL);
    });
    ctx.on('theme', () => { drawRing(v); A.world.invalidate('top'); });
    ctx.on('lang', () => A.world.invalidate('top'));
    ctx.on('escape', () => { if (v.tl && v.tl.playing) v.tl.skip(); });
    ctx.own(() => { clearTimeout(v.fixT); if (v.mixTw) v.mixTw.cancel(); if (v.tl) { const t = v.tl; v.tl = null; t.stop(); } if (v.ringTw) v.ringTw.cancel(); if (v.needTw) v.needTw.cancel(); });
    if (window.ResizeObserver) { const ro = new ResizeObserver(() => drawRing(v)); ro.observe(v.el.ring); ctx.own(() => ro.disconnect()); }

    /* ======== map ======== */
    ctx.layer({ id: 'money-rings', z: 120, draw2d: (c, f) => drawMap(c, f, v) });
    const zones = A.data.zones || [], col = zones.filter((z) => z.kind === 'storm');
    const zHomes = zones.reduce((s, z) => s + (z.homes || 0), 0);
    if (col.length) {
      const cx = col.reduce((s, z) => s + z.c[0], 0) / col.length, cy = col.reduce((s, z) => s + z.c[1], 0) / col.length;
      v.el.zpin = ctx.pin('money-zones', [cx, cy], A.h(`<div class="money-zpin"><b>${Le(zones.length + ' ranked zones', zones.length + ' zonas en orden')}</b><span data-m="zpin"></span></div>`), { anchor: 'none', offset: ZPIN_OFF });
      v.zpinLL = [cx, cy];
    }
    // the world's place labels would fight this layer's: it draws its own (see drawMap) and gives them back on exit
    const opt0 = A.world.options ? A.world.options() : null;
    if (opt0) { A.world.options({ labels: false }); ctx.own(() => A.world.options({ labels: opt0.labels })); }
    v.zHomes = zHomes;

    /* ======== first paint + entrance ======== */
    render(v, null, { first: true });
    if (!A.still) {
      const tl = (v.tl = new A.motion.Timeline());
      v.grow = 0; v.shown.cov = 0;
      tl.add(0, { ms: 1300, ease: E.outCubic, update: (p) => { if (V !== v) return; v.grow = p; A.world.invalidate('top'); } });
      tl.add(120, (t, o) => { if (V !== v || o.seeking) return; A.motion.stagger(A.$$('.money-fun > li', fun), { each: 70, y: 12 }); });
      tl.add(260, { ms: 1100, ease: E.outCubic, update: (p) => { if (V !== v) return; v.shown.cov = p * covOf(v.P); drawRing(v); } });
      tl.onEnd(() => { if (V === v) { v.grow = 1; v.shown.cov = covOf(v.P); drawRing(v); A.world.invalidate('top'); } });
      tl.play();
    }
  }

  const covOf = (p) => (p && p.capacity ? A.clamp(p.capacity.pctOfNeed / 100, 0, 1) : 0);

  function applyMix(v, m, setL) {
    const L0 = Object.assign({}, v.L), h1 = m.h, d1 = m.d, c1 = m.c == null ? v.L.commission : m.c;
    if (v.mixTw) { v.mixTw.cancel(); v.mixTw = null; }
    setL({ stage: m.stage, days: d1 });
    if (A.still) { setL({ hours: h1, commission: c1 }); syncInputs(v); return; }
    const tw = A.motion.tween({ from: 0, to: 1, ms: 700, ease: E.inOutCubic, update: (k) => {
      if (V !== v || v.mixTw !== tw) return;
      const h = Math.round((L0.hours + (h1 - L0.hours) * k) * 2) / 2, c = Math.round((L0.commission + (c1 - L0.commission) * k) / 50) * 50;
      if (h !== v.L.hours || c !== v.L.commission) setL({ hours: h, commission: c }, { live: true });
      syncInputs(v);
    } });
    v.mixTw = tw;
    // only the tween that is still in charge lands the mix: a grabbed slider (cancel) keeps what the hand set
    tw.then((ok) => { if (!ok || V !== v || v.mixTw !== tw) return; v.mixTw = null; setL({ hours: h1, commission: c1 }); syncInputs(v); });
  }
  function syncInputs(v) { A.$$('input[data-lv]', v.el.lev).forEach((inp) => { if (+inp.value !== v.L[inp.dataset.lv]) inp.value = v.L[inp.dataset.lv]; paintRange(inp); }); }
  function paintRange(inp) { const p = (inp.value - inp.min) / (inp.max - inp.min) * 100; inp.style.setProperty('--p', p.toFixed(1) + '%'); }

  /* ---------- render: text, numbers, funnel, week, fixes ---------- */
  function setNum(el, to, o, prev, live) {
    if (!el) return;
    const fmt = o.format || ((x) => A.fmt.num(x, o.decimals || 0));
    if (live || A.still || prev == null || prev === to) { el.textContent = fmt(to); el.setAttribute('aria-label', fmt(to)); return; }
    A.motion.countUp(el, to, Object.assign({ from: prev, ms: 700 }, o));
  }
  function render(v, prev, o = {}) {
    const P = v.P, L = v.L, F = A.fmt, live = !!o.live, first = !!o.first;
    const q = (root, k) => root.querySelector('[data-m="' + k + '"]');
    const pv = prev || {};
    /* goal + answer */
    q(v.el.goal, 'days').innerHTML = Le(P.daysLeft + ' days, ' + P.knockDays + ' knock days left', 'quedan ' + P.daysLeft + ' días, ' + P.knockDays + ' para tocar');
    setNum(q(v.el.goal, 'dpd'), P.doorsPerDay, {}, first ? (A.still ? null : 0) : pv.doorsPerDay, live);
    q(v.el.goal, 'cap').textContent = F.int(P.capacity.doorsPerDay);
    const st = q(v.el.goal, 'state'), fits = P.capacity.fits;
    const over = P.capacity.doorsPerDay ? P.doorsPerDay / P.capacity.doorsPerDay : 0;
    st.className = 'chip money-state ' + (fits ? 'chip--ok' : 'chip--warn');
    st.innerHTML = '<span class="chip__dot"></span>' + (fits ? Le('Fits in your day', 'Cabe en tu día')
      : Le('Over your day: ' + F.num(over, 1, 'en') + '×', 'Se pasa de tu día: ' + F.num(over, 1, 'es') + '×'));
    if (prev && prev.capacity && prev.capacity.fits !== fits && !A.still) { A.motion.ripple(st, { rings: 2, size: 60, color: A.tok(fits ? '--ok' : '--warn') }); if (fits && window.Sound && window.Sound.enabled) window.Sound.ring(2); }
    q(v.el.goal, 'cov').textContent = F.pct(Math.min(100, P.capacity.pctOfNeed));
    // the inner ring tweens to the new coverage
    if (!first) {
      if (v.ringTw) v.ringTw.cancel();
      const a = v.shown.cov, b = covOf(P);
      if (live || A.still) { v.shown.cov = b; drawRing(v); }
      else v.ringTw = A.motion.tween({ from: a, to: b, ms: 520, ease: E.outCubic, update: (x) => { v.shown.cov = x; drawRing(v); } });
    } else { v.shown.cov = covOf(P); drawRing(v); }
    // the map's need ring follows the doors
    if (v.needTw) v.needTw.cancel();
    if (first || live || A.still) { v.shown.need = P.doors; A.world.invalidate('top'); }
    else { const a = v.shown.need; v.needTw = A.motion.tween({ from: a, to: P.doors, ms: 620, ease: E.outCubic, update: (x) => { v.shown.need = x; A.world.invalidate('top'); } }); }
    const zp = v.el.zpin && v.el.zpin.querySelector('[data-m="zpin"]');
    v.zpSize = null;
    if (zp) zp.innerHTML = Le(F.int(v.zHomes, 'en') + ' homes: ' + F.num(v.zHomes / P.doorsPerDay, 1, 'en') + ' days at the goal’s pace, ' + F.num(v.zHomes / Math.max(1, P.capacity.doorsPerDay), 0, 'en') + ' at yours',
      F.int(v.zHomes, 'es') + ' casas: ' + F.num(v.zHomes / P.doorsPerDay, 1, 'es') + ' días al ritmo de la meta, ' + F.num(v.zHomes / Math.max(1, P.capacity.doorsPerDay), 0, 'es') + ' al tuyo');

    /* levers */
    q(v.el.lev, 'comm').textContent = F.money(L.commission);
    const sg = STAGES.find((s) => s.id === L.stage);
    q(v.el.lev, 'stagepct').textContent = F.pct(sg.pct, sg.pct % 1 ? 1 : 0);
    q(v.el.lev, 'hours').textContent = F.num(L.hours, L.hours % 1 ? 1 : 0) + ' h';
    q(v.el.lev, 'days').textContent = String(L.days);
    q(v.el.lev, 'hoursDoors').innerHTML = Le('≈ ' + P.capacity.doorsPerDay + ' doors at ' + FN.bench.doors_per_hour.typical + ' an hour', '≈ ' + P.capacity.doorsPerDay + ' puertas a ' + FN.bench.doors_per_hour.typical + ' por hora');
    A.$$('.seg[data-lv] button', v.el.lev).forEach((b) => { const k = b.parentElement.dataset.lv; b.setAttribute('aria-pressed', String(String(L[k]) === b.dataset.v)); });
    syncInputs(v);

    /* funnel (rebuilt once; numbers roll after) */
    const fun = v.el.fun.querySelector('[data-m="fun"]');
    const rows = funnelRows(P, L);
    if (!fun.children.length) fun.innerHTML = rows.map((r) => `
      <li class="money-st${r.cls ? ' ' + r.cls : ''}" data-st="${r.id}">
        ${r.rate ? `<p class="money-st__rate">${ic('arrow', 12)}<span data-m="rate">${r.rate}</span></p>` : ''}
        <div class="money-st__row"><span class="money-st__k">${Le(r.label.en, r.label.es)}</span><b class="money-st__v num" data-m="v"></b></div>
        ${r.bar != null ? `<span class="money-st__bar"><i data-m="bar"></i></span>` : ''}</li>`).join('');
    const maxLog = Math.log10(Math.max(10, P.doors));
    rows.forEach((r) => {
      const li = fun.querySelector('[data-st="' + r.id + '"]'); if (!li) return;
      const pvRow = prev ? funnelRows(prev, L).find((x) => x.id === r.id) : null;
      setNum(li.querySelector('[data-m="v"]'), r.value, { format: r.fmt }, first ? (A.still ? null : 0) : pvRow ? pvRow.value : null, live);
      const rt = li.querySelector('[data-m="rate"]'); if (rt && rt.innerHTML !== r.rate) rt.innerHTML = r.rate;
      const bar = li.querySelector('[data-m="bar"]');
      if (bar) bar.style.transform = 'scaleX(' + A.clamp(Math.log10(Math.max(1, r.bar)) / maxLog, 0.02, 1).toFixed(4) + ')';
    });

    /* week */
    const w = P.perWeek || {};
    const weeks = Math.max(1, Math.round(P.daysLeft / 7));
    q(v.el.wk, 'weeks').innerHTML = Lx(cp('money.week.weeksLeft', '{n} weeks left until December 31, 2026', 'Faltan {n} semanas para el 31 de diciembre de 2026'), { n: weeks });
    const wkRoot = q(v.el.wk, 'week');
    const items = [
      ['doors', Le('Doors', 'Puertas'), w.doors, benchTag('spotio.com')],
      ['conv', Le('Conversations', 'Conversaciones'), w.conversations, benchTag(FN.bench.doors_to_conversation.source)],
      ['appt', Le('Booked', 'Agendadas'), w.appointments, benchTag(sg.tip.en.split(':')[0])],
      ['insp', Le('Inspections', 'Inspecciones'), w.inspections, benchTag(FN.bench.appointment_to_inspection.source)],
      ['signed', Le('Signed jobs', 'Firmados'), w.signed, benchTag(FN.bench.inspection_to_signed_contract.source)],
      ['hours', Le('Hours', 'Horas'), w.hours, benchTag(FN.bench.doors_per_hour.source)]
    ];
    if (!wkRoot.children.length) wkRoot.innerHTML = items.map((it) => `<div class="stat" data-w="${it[0]}"><span class="stat__k">${it[1]} ${it[3]}</span><span class="stat__v num" data-m="wv"></span></div>`).join('');
    const pw = (prev && prev.perWeek) || {};
    const pmap = { doors: pw.doors, conv: pw.conversations, appt: pw.appointments, insp: pw.inspections, signed: pw.signed, hours: pw.hours };
    items.forEach((it) => {
      const el = wkRoot.querySelector('[data-w="' + it[0] + '"] [data-m="wv"]');
      setNum(el, it[2], { decimals: it[0] === 'hours' && it[2] % 1 ? 1 : 0 }, first ? (A.still ? null : 0) : pmap[it[0]], live);
    });
    const hoursWeekHave = L.hours * L.days;
    q(v.el.wk, 'wline').innerHTML = Lx(cp('money.week.perDay', 'That is {n} doors a day, {d} days a week', 'Son {n} puertas al día, {d} días a la semana'), { n: F.int(P.doorsPerDay), d: L.days }) + ' · ' +
      Le('your week holds ' + F.num(hoursWeekHave, hoursWeekHave % 1 ? 1 : 0, 'en') + ' h of the ' + F.num(w.hours, w.hours % 1 ? 1 : 0, 'en') + ' h it takes.', 'tu semana tiene ' + F.num(hoursWeekHave, hoursWeekHave % 1 ? 1 : 0, 'es') + ' h de las ' + F.num(w.hours, w.hours % 1 ? 1 : 0, 'es') + ' h que pide.');

    /* fixes */
    if (!live) renderFixes(v);
  }

  function funnelRows(P, L) {
    const F = A.fmt, pct = (r, l) => { const x = r * 100; return F.pct(x, Math.abs(x - Math.round(x)) < 0.05 ? 0 : 1, l); };
    const talkPct = P.conversations ? P.appointments / P.conversations : 0;
    const st = (id) => P.steps.find((s) => s.id === id) || {};
    const sg = STAGES.find((s) => s.id === L.stage) || STAGES[0];
    const bt = (id) => { const s = st(id); return s.source === 'override' ? A.ui.srcTag('bench', { note: sg.tip }) : benchTag(s.source || 'industry'); };
    return [
      { id: 'goal', label: { en: 'Goal in commission', es: 'Meta en comisiones' }, value: P.goal, fmt: (x) => F.money(x), cls: 'money-st--goal' },
      { id: 'jobs', label: { en: 'Paid jobs', es: 'Trabajos pagados' }, value: P.jobs, bar: P.jobs,
        rate: Le('÷ ' + F.money(P.commission.value, 0, 'en') + ' a job', '÷ ' + F.money(P.commission.value, 0, 'es') + ' por trabajo') + ' <span class="sample">' + Le('example', 'ejemplo') + '</span>' },
      { id: 'signed', label: { en: 'Contracts signed', es: 'Contratos firmados' }, value: P.signed, bar: P.signed,
        rate: Le('1:1 assumed until HMP has data', '1:1 supuesto hasta tener datos de HMP') },
      { id: 'inspections', label: { en: 'Inspections done', es: 'Inspecciones hechas' }, value: P.inspections, bar: P.inspections,
        rate: Le(pct(st('signed').rate) + ' of inspections sign', pct(st('signed').rate) + ' de las inspecciones firman') + ' ' + bt('signed') },
      { id: 'appointments', label: { en: 'Inspections booked', es: 'Inspecciones agendadas' }, value: P.appointments, bar: P.appointments,
        rate: Le(pct(st('inspections').rate) + ' of bookings happen', pct(st('inspections').rate) + ' de las citas se cumplen') + ' ' + bt('inspections') },
      { id: 'conversations', label: { en: 'Conversations', es: 'Conversaciones' }, value: P.conversations, bar: P.conversations,
        rate: Le(pct(st('appointments').rate, 'en') + ' of doors (' + pct(talkPct, 'en') + ' of conversations) book', pct(st('appointments').rate, 'es') + ' de las puertas (' + pct(talkPct, 'es') + ' de las conversaciones) agendan') + ' ' + bt('appointments') },
      { id: 'doors', label: { en: 'Doors knocked', es: 'Puertas tocadas' }, value: P.doors, bar: P.doors,
        rate: Le(pct(st('conversations').rate) + ' of doors open and talk', pct(st('conversations').rate) + ' de las puertas abren y conversan') + ' ' + bt('conversations') },
      { id: 'dpd', label: { en: 'Doors a day', es: 'Puertas al día' }, value: P.doorsPerDay, cls: 'money-st--dpd' + (P.capacity.fits ? ' is-fit' : ''),
        rate: Le('over ' + P.knockDays + ' knock days', 'en ' + P.knockDays + ' días de tocar') }
    ];
  }

  function renderFixes(v) {
    const P = v.P, L = v.L, F = A.fmt;
    const fx = (v.fx = fixes(P, L));
    const ul = v.el.fit.querySelector('[data-m="fix"]'), mixEl = v.el.mix;
    if (P.capacity.fits) {
      ul.innerHTML = `<li class="money-fx is-ok">${ic('check', 15)}<span>${Le('These levers fit the goal inside your day. The rates are still industry figures until HMP has ~200 doors of its own.', 'Con estas palancas la meta cabe en tu día. Las tasas siguen siendo de la industria hasta que HMP tenga ~200 puertas propias.')}</span></li>`;
    } else {
      const top = FN.bench.doors_to_qualified_inspection_experienced.high;
      const rows = [
        { ok: fx.hours <= 10, k: Le('Only hours', 'Solo horas'), v: F.num(fx.hours, 1) + ' h', s: fx.hours > 12 ? Le('more than a full day', 'más que un día completo') : fx.hours > 10 ? Le('past the slider', 'más allá del control') : Le('a day', 'al día') },
        { ok: fx.rate != null && fx.rate <= top, k: Le('Only close rate', 'Solo tasa de cierre'), v: fx.rate == null ? '–' : F.pct(fx.rate, 1), s: fx.rate > top ? Le('of doors; top performers reach ' + top + '%', 'de las puertas; los mejores llegan a ' + top + '%') : Le('of doors book', 'de las puertas agendan') },
        { ok: false, k: Le('Only commission', 'Solo comisión'), v: fx.commission == null ? '–' : F.money(fx.commission), s: Le('a job; HMP sets this', 'por trabajo; lo fija HMP') },
        { ok: fx.days7 && fx.days7.capacity.fits, k: Le('7 days a week', '7 días a la semana'), v: fx.days7 ? F.int(fx.days7.doorsPerDay) : '–', s: Le('doors a day, still', 'puertas al día, aún') }
      ];
      ul.innerHTML = rows.map((r) => `<li class="money-fx${r.ok ? ' is-ok' : ''}"><span class="money-fx__k">${r.k}</span><b class="num">${A.esc(r.v)}</b><span class="money-fx__s">${r.s}</span></li>`).join('');
    }
    const m = fx.mix, isDef = L.commission === DEF.commission && L.stage === DEF.stage && L.hours === DEF.hours && L.days === DEF.days;
    const reset = isDef ? '' : `<button type="button" class="btn btn--ghost btn--sm money-mix__reset" data-m-act="reset">${ic('arrow', 14)}${Le('Back to today’s numbers', 'Volver a los números de hoy')}</button>`;
    const key = P.capacity.fits ? 'fits' : m ? [m.stage, m.h, m.d, L.commission].join('|') : 'none';
    const was = mixEl.dataset.key;
    if (P.capacity.fits) mixEl.innerHTML = reset ? `<div class="money-mix__act">${reset}</div>` : '';
    else if (m) {
      const sg = STAGES.find((s) => s.id === m.stage), hh = (l) => F.num(m.h, m.h % 1 ? 1 : 0, l);
      mixEl.innerHTML = `<div class="money-mix__card">
          <div class="money-mix__txt"><span class="money-mix__k">${Le('A mix that fits', 'Una mezcla que cabe')}</span>
            <span class="money-mix__v">${Le(sg.label.en + ' · ' + hh('en') + ' h · ' + m.d + ' days', sg.label.es + ' · ' + hh('es') + ' h · ' + m.d + ' días')}</span>
            <span class="money-mix__s"><b class="num">${F.int(m.q.doorsPerDay)}</b> ${Le('doors a day, ' + F.int(m.q.capacity.doorsPerDay, 'en') + ' fit', 'puertas al día, caben ' + F.int(m.q.capacity.doorsPerDay, 'es'))}</span></div>
          <button type="button" class="btn btn--primary btn--sm money-mix__go" data-m-act="mix">${ic('spark', 14)}${Le('Try this mix', 'Probar esta mezcla')}</button>
        </div>${reset ? `<div class="money-mix__act">${reset}</div>` : ''}`;
    } else mixEl.innerHTML = `<div class="money-mix__card money-mix__card--none"><span class="money-mix__v">${Le('No mix of stage, hours and days fits at this commission. Commission is HMP’s call.', 'Ninguna mezcla de etapa, horas y días cabe con esta comisión. La comisión la decide HMP.')}</span></div>${reset ? `<div class="money-mix__act">${reset}</div>` : ''}`;
    mixEl.dataset.key = key;
    if (was && was !== key && !A.still && mixEl.firstElementChild) A.motion.reveal(mixEl.firstElementChild, { y: 6, ms: 380 });
  }

  /* ---------- the knocker ring ---------- */
  function drawRing(v) {
    const cv = v.el.ring; if (!cv || !cv.isConnected) return;
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(40, Math.round(r.width)), H = W;
    if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    const c = cv.getContext('2d'); if (!c) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, R1 = W / 2 - 4, R2 = W / 2 - 20, a0 = -Math.PI / 2;
    // outer: logged toward $100k (none yet): a hairline track with a "you are here" tick
    c.lineCap = 'round';
    c.strokeStyle = rgba('--rule-2'); c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, R1, 0, 6.2832); c.stroke();
    c.fillStyle = rgba('--text'); c.beginPath(); c.arc(cx, cy - R1, 3.2, 0, 6.2832); c.fill();
    // inner: the knocker ring, filled to the share of the pace the day covers
    c.strokeStyle = rgba('--panel-3'); c.lineWidth = 15; c.beginPath(); c.arc(cx, cy, R2, 0, 6.2832); c.stroke();
    const k = A.clamp(v.shown.cov, 0, 1);
    if (k > 0.002) {
      c.strokeStyle = rgba('--acc-bg'); c.lineWidth = 26; c.beginPath(); c.arc(cx, cy, R2, a0, a0 + k * 6.2832); c.stroke();
      c.strokeStyle = rgba(v.P && v.P.capacity.fits ? '--ok' : '--acc'); c.lineWidth = 15; c.beginPath(); c.arc(cx, cy, R2, a0, a0 + k * 6.2832); c.stroke();
    }
    // tick marks every 10%
    c.strokeStyle = rgba('--page', 0.6); c.lineWidth = 1.2;
    for (let i = 1; i < 10; i++) { const a = a0 + i / 10 * 6.2832; c.beginPath(); c.moveTo(cx + Math.cos(a) * (R2 - 7.5), cy + Math.sin(a) * (R2 - 7.5)); c.lineTo(cx + Math.cos(a) * (R2 + 7.5), cy + Math.sin(a) * (R2 + 7.5)); c.stroke(); }
  }

  /* ---------- map: homes in each 2026 hail area vs the doors the goal takes ----------
     The world's own place labels are off on this view (they fought ours); this layer places every label itself,
     collision-free and kept inside the map area: the need ring first, then the areas, then plain place names. */
  const ZPIN_OFF = [-30, 74];
  const K = 0.46;                                   // px per sqrt(home): 18,800 doors → ~63 px
  const AREA_DATE = {};
  function areaDate(a) {
    if (!(a.id in AREA_DATE)) { const st = (A.data.storms || []).find((x) => x.id === a.st); AREA_DATE[a.id] = st ? st.date : a.st ? a.st.replace(/^d(\d{4})(\d\d)(\d\d).*/, '$1-$2-$3') : null; }
    return AREA_DATE[a.id];
  }
  function drawMap(c, f, v) {
    const areas = (A.data.areas || []).slice().sort((a, b) => b.homes - a.homes);
    const g = v.grow == null ? 1 : v.grow, dark = f.theme !== 'light';
    const F = A.fmt, FUI = A.tok('--ui') || 'system-ui', FDI = A.tok('--display') || FUI, FMO = A.tok('--mono') || 'monospace';
    const fx0 = f.inset.l + 8, fx1 = f.w - f.inset.r - 8, fy0 = f.inset.t + 8, fy1 = f.h - f.inset.b - 8;
    const boxes = [];
    const hitBox = (b) => boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
    const inside = (b) => b[0] >= fx0 && b[2] <= fx1 && b[1] >= fy0 && b[3] <= fy1;
    // the ranked-zones card is a DOM pin: keep labels off it
    const zp = v.el.zpin; if (zp && zp.isConnected && v.zpinLL) {
      if (!v.zpSize) v.zpSize = [zp.offsetWidth, zp.offsetHeight];
      const r = f.project(v.zpinLL), x = r[0] + ZPIN_OFF[0], y = r[1] + ZPIN_OFF[1], w = v.zpSize[0], h = v.zpSize[1];
      if (w) boxes.push([x - 4, y - 4, x + w + 4, y + h + 4]);
    }
    c.save();
    // storm areas: hairline rings in their hail color, biggest first so small ones stay on top
    areas.forEach((a, i) => {
      const q = f.project(a.c); if (!f.inView(a.c, 120)) return;
      const k = A.clamp(g * 1.25 - i / areas.length * 0.25, 0, 1), rr = Math.max(2.5, K * Math.sqrt(a.homes)) * E.outCubic(k);
      if (rr < 0.5) return;
      const tok = A.ui.hailTok(a.hail);
      c.fillStyle = rgba(tok, dark ? 0.07 : 0.09); c.strokeStyle = rgba(tok, 0.4); c.lineWidth = 0.9;
      c.beginPath(); c.arc(q[0], q[1], rr, 0, 6.2832); c.fill(); c.stroke();
    });
    // the 12 ranked zones: tiny, bright
    (A.data.zones || []).forEach((z) => {
      const q = f.project(z.c), rr = Math.max(2.2, K * Math.sqrt(z.homes)) * g;
      c.fillStyle = rgba('--acc', 0.9); c.beginPath(); c.arc(q[0], q[1], rr, 0, 6.2832); c.fill();
    });
    // the goal's doors: a dashed ring at HMP, sized on the same scale; the one message of this map
    const hq = A.data.hq || [-96.4867, 41.4403], q = f.project(hq);
    const rn = K * Math.sqrt(Math.max(1, v.shown.need || 0)) * g;
    c.fillStyle = rgba('--acc', dark ? 0.08 : 0.09); c.beginPath(); c.arc(q[0], q[1], rn, 0, 6.2832); c.fill();
    c.setLineDash([6, 5]); c.strokeStyle = rgba('--acc', 1); c.lineWidth = 2.2; c.stroke(); c.setLineDash([]);
    c.fillStyle = rgba('--acc', 1); c.beginPath(); c.arc(q[0], q[1], 3, 0, 6.2832); c.fill();
    boxes.push([q[0] - rn * 0.72, q[1] - rn * 0.72, q[0] + rn * 0.72, q[1] + rn * 0.72]);
    const halo = (t, x, y) => { c.lineJoin = 'round'; c.lineWidth = 3.4; c.strokeStyle = rgba('--page', 0.9); c.strokeText(t, x, y); c.fillText(t, x, y); };
    if (g > 0.35 && v.shown.need > 0) {
      const big = F.int(Math.round(v.shown.need)), small = A.t({ en: 'doors the goal takes', es: 'puertas que pide la meta' });
      c.font = '720 19px ' + FDI; const w1 = c.measureText(big).width;
      c.font = '500 10.5px ' + FMO; const w2 = c.measureText(small).width;
      const w = Math.max(w1, w2), hgt = 34;
      // right of the ring, unless that leaves the map: then left, then under it
      const cands = [[q[0] + rn * 0.72 + 10, q[1] - rn * 0.72 - 4, 'left'], [q[0] - rn * 0.72 - 10 - w, q[1] - rn * 0.72 - 4, 'left'], [q[0] - w / 2, q[1] + rn + 8, 'left']];
      let at = cands.find((k) => inside([k[0], k[1], k[0] + w, k[1] + hgt])) || cands[0];
      at = [A.clamp(at[0], fx0, Math.max(fx0, fx1 - w)), A.clamp(at[1], fy0, Math.max(fy0, fy1 - hgt))];
      c.globalAlpha = f.alpha * A.clamp((g - 0.35) / 0.4, 0, 1);
      c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      c.font = '720 19px ' + FDI; c.fillStyle = rgba('--acc-ink', 1); halo(big, at[0], at[1] + 16);
      c.font = '500 10.5px ' + FMO; c.fillStyle = rgba('--text-2', 1); halo(small, at[0], at[1] + 30);
      boxes.push([at[0] - 12, at[1] - 10, at[0] + w + 12, at[1] + hgt + 12]);   // padded: an area label never reads as part of it
      c.globalAlpha = f.alpha;
    }
    // area labels: name, storm date where a town was hit more than once, homes (Census)
    if (g >= 0.8) {
      const count = {}; areas.forEach((a) => { const n = a.name.en; count[n] = (count[n] || 0) + 1; });
      const seen = new Set();
      c.textAlign = 'center'; c.textBaseline = 'middle';
      areas.filter((a) => a.homes >= 3500).forEach((a) => {
        if (!f.inView(a.c, 20)) return;
        const d = areaDate(a), key = a.name.en + '|' + d; if (seen.has(key)) return;
        const rr = Math.max(2.5, K * Math.sqrt(a.homes)), p0 = f.project(a.c);
        const name = A.t(a.name) + (count[a.name.en] > 1 && d ? ' · ' + F.date(d, 'short') : ''), num = F.int(a.homes);
        c.font = '600 11px ' + FUI; const wn = c.measureText(name).width; c.font = '500 10.5px ' + FMO; const wm = c.measureText(num).width;
        const DOT = 6, w = DOT + 5 + wn + 6 + wm;   // hail dot · name · homes
        for (const dy of [rr + 9, -rr - 9, 0]) {
          let x = p0[0], y = p0[1] + dy;
          x = A.clamp(x, fx0 + w / 2, fx1 - w / 2);
          const box = [x - w / 2 - 3, y - 8, x + w / 2 + 3, y + 8];
          if (!inside(box) || hitBox(box)) continue;
          boxes.push(box); seen.add(key);
          c.textAlign = 'left';
          // hail size is the dot's color; the homes count is a Census number, so it reads in plain ink
          const x0 = x - w / 2;
          c.fillStyle = rgba('--page', 0.9); c.beginPath(); c.arc(x0 + DOT / 2, y, DOT / 2 + 1.5, 0, 6.2832); c.fill();
          c.fillStyle = rgba(A.ui.hailTok(a.hail), 1); c.beginPath(); c.arc(x0 + DOT / 2, y, DOT / 2, 0, 6.2832); c.fill();
          c.font = '600 11px ' + FUI; c.fillStyle = rgba('--text', 0.92); halo(name, x0 + DOT + 5, y);
          c.font = '500 10.5px ' + FMO; c.fillStyle = rgba('--text-2', 1); halo(num, x0 + DOT + 5 + wn + 6, y);
          c.textAlign = 'center';
          break;
        }
      });
    }
    // plain place names for orientation, wherever there is room
    const places = A.data.places || {};
    c.font = '500 10px ' + FMO; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = rgba('--muted', 0.9);
    for (const n in places) {
      const p = f.project(places[n]), t = A.t(n.toUpperCase(), n.toUpperCase()), w = c.measureText(t).width;
      const box = [p[0] - w / 2 - 4, p[1] - 7, p[0] + w / 2 + 4, p[1] + 7];
      if (!inside(box) || hitBox(box)) continue;
      boxes.push(box); halo(t, p[0], p[1]);
    }
    c.restore();
  }
})();
