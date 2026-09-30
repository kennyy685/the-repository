/* Claude's Aldaba · now.js · #now = the 7 AM brief
   In five seconds: where to go today, why, how many doors, when, and that Aldaba has checked everything.
   Left: the pick (hero), its numbers with sources, the morning brief. Right: the 12 ranked zones.
   Dock: today's plan on a 7 AM to 8 PM day bar. Map: zone rings glowing by hail, rank pins, the real drive
   (Fremont -> Columbus on US-30) with mile/minute ticks, and a car that drives it on "Preview the drive".

   The entrance is the pick ASSEMBLING (skipped under A.still): the camera drops into Columbus, the 12 zones land
   as rings in rank order while their rows arrive unsorted with their scores, the list sorts itself (FLIP), the
   winner lifts into the hero, its numbers roll, the camera pulls back while the route draws itself from Fremont,
   and the day lands step by step. Exposed as A.nowAssemble(ctx) → Timeline (not yet played) for the intro and
   the director; 'intro:handoff' replays it when Now is on screen. */
(function () {
  'use strict';
  const A = window.A; if (!A || !A.view) return;
  const COPY = window.COPY || {};
  const Rt = window.Route || null;

  /* ---------- tiny helpers ---------- */
  const cp = (path, en, es) => { let o = COPY; for (const k of path.split('.')) o = o && o[k]; return o && o.en ? o : { en, es }; };
  const sub = (s, v) => String(s == null ? '' : s).replace(/\{(\w+)\}/g, (m, k) => (v && v[k] != null ? v[k] : m));
  const Lx = (o, v) => A.L(A.esc(sub(o.en, typeof v === 'function' ? v('en') : v)), A.esc(sub(o.es, typeof v === 'function' ? v('es') : v)));
  const Le = (en, es) => A.L(A.esc(en), A.esc(es));
  const ic = (n, s) => A.ui.icon(n, { size: s || 16 });
  const rgba = (tok, a) => { const c = A.rgba(tok); return 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ',' + (a == null ? c[3] : a * c[3]).toFixed(3) + ')'; };
  const E = A.motion.ease;
  const hhmm = (min) => String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(Math.round(min % 60)).padStart(2, '0');
  const toMin = (s) => { const m = String(s).match(/(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : 0; };
  const miBetween = (a, b) => { const k = Math.cos(41.4 * Math.PI / 180); return Math.hypot((a[0] - b[0]) * k, a[1] - b[1]) * 69.05; };

  /* ---------- data, once ---------- */
  const N = A.data || {}, X = A.x || {}, S26 = X.storms2026 || {};
  const pick = N.pick || {}, backup = N.backup || {};
  const ROUTE = Rt && window.ROUTE_BAKED ? (A.safe('now route', () => Rt.load(N)) || null) : null;
  const ZONES = (N.zones || []).map((z, i) => {
    const parts = String(z.name || '').split(':');
    return Object.assign({}, z, { i, town: parts[0].trim(), street: parts.slice(1).join(':').trim() || z.name });
  });
  const AREA = {}; (N.areas || []).forEach((a) => (AREA[a.id] = a));
  const pickArea = AREA[pick.area_id] || null;
  const stormOf = (areaId) => { const a = AREA[areaId]; if (!a) return null; return (N.storms || []).find((s) => s.id === a.st) || null; };
  const insuredLevel = (a) => { if (!a || !a.insured) return null; const f = (s) => String(s).split(':').slice(1).join(':').trim() || s; return { en: f(a.insured.en), es: f(a.insured.es) }; };
  const routeMiles = ROUTE ? ROUTE.miles : Math.round(pick.dist_mi || 0);
  const routeMin = ROUTE ? ROUTE.minutes : Math.round((pick.dist_mi || 0) * 1.15);
  const hwy = ROUTE && ROUTE.legs ? (ROUTE.legs.slice().sort((a, b) => b.miles - a.miles)[0] || {}).name : 'US-30';
  const ticks = ROUTE ? (ROUTE.stops || []).filter((s) => s.mile > 3 && s.mile < ROUTE.miles - 3).map((s) => ({
    name: s.name, mile: s.mile, f: s.mile / ROUTE.miles, min: Math.round(Rt.minutesAt(ROUTE, s.mile / ROUTE.miles)), at: Rt.atMile(ROUTE, s.mile)
  })) : [];
  const knockStart = (pick.best_time && pick.best_time.start) || '16:00', knockEnd = (pick.best_time && pick.best_time.end) || '19:30';
  const leaveAt = hhmm(toMin(knockStart) - routeMin - 10);            // arrive 10 min early to park and set up
  const hq = N.hq || (ROUTE ? ROUTE.line[0] : [-96.4867, 41.4403]);
  const colPts = ZONES.filter((z) => z.town === 'Columbus').map((z) => z.c);
  const routeCam = () => { const pts = []; if (ROUTE) ROUTE.line.forEach((p, i) => { if (i % 3 === 0) pts.push(p); }); pts.push(hq, [pick.center.lon, pick.center.lat]); return pts; };

  let V = null;          // the live instance while Now is on screen
  let played = false;    // the full assemble plays once per visit to the app; later visits land quickly

  /* ---------- the view ---------- */
  A.view.register('now', {
    title: cp('now.title', 'Now', 'Ahora'), key: '1', dim: 0, hail: 0.9, ambient: true,
    camera: (fr) => ({ points: routeCam(), pad: fr.stacked ? { t: 40, r: 44, b: 40, l: 30 } : { t: 78, r: 70, b: 70, l: 70 }, maxZoom: 12 }),
    enter(ctx) { A.safe('now enter', () => build(ctx)); },
    exit() { V = null; }
  });

  function build(ctx) {
    const S = { app: ZONES.map(() => 1), routeP: 1, hover: -1, sel: -1, pulse: null, car: null, carF: 0, tl: null, hailCache: {} };
    const v = (V = { ctx, S, el: {} });
    const U = A.ui, F = A.fmt;
    const area = pickArea, lvl = insuredLevel(area);
    const town = (ZONES[0] && ZONES[0].town) || 'Columbus';
    const storm = pick.storm_day;

    /* ======== LEFT: the pick ======== */
    const hero = ctx.el('left', `
      <p class="eyebrow eyebrow--acc now-hero__eye">${Lx(cp('now.pick.label', "Aldaba's pick", 'La elección de Aldaba'))} · <b>${Le('rank 1 of ' + ZONES.length, 'lugar 1 de ' + ZONES.length)}</b>
        <span class="now-hero__score">${Lx(cp('now.pick.score', 'Score {n}', 'Puntaje {n}'), { n: F.num(pick.score, 1) })} ${U.srcTag('engine')}</span></p>
      <p class="now-hero__wait" aria-hidden="true"><span class="now-hero__spin"></span><span>${Le('Picking today’s zone', 'Eligiendo la zona de hoy')}</span> <b class="num" data-now="scored">0/${ZONES.length}</b></p>
      <p class="now-hero__cand" aria-hidden="true"><span data-now="cand"></span><span class="now-hero__candsc num" data-now="candsc"></span></p>
      <p class="now-hero__best" aria-hidden="true"><span class="now-hero__bestk">${Le('Best so far', 'Mejor hasta ahora')}</span><b data-now="best"></b><span class="num" data-now="bestsc"></span></p>
      <h1 class="now-hero__town" data-now="town">${A.esc(town)}<span class="now-hero__dot">.</span></h1>
      <p class="now-hero__street" data-now="street">${A.esc(ZONES[0] ? ZONES[0].street : pick.name)}</p>
      <p class="now-hero__line"><span class="now-hero__doors"><span class="num" data-now="doors">${pick.doors}</span> ${Le('doors.', 'puertas.')}</span>
        <span class="now-hero__time">${A.both(() => F.range(knockStart, knockEnd))}</span></p>
      <p class="t-lead now-hero__why">${pick.why ? Le(pick.why.en, pick.why.es) : ''}</p>
      <div class="now-hero__act">
        <button type="button" class="btn btn--primary" data-now="walk">${ic('door')}${Lx(cp('now.actions.startWalk', 'Start the walk', 'Empezar la ruta'))}</button>
        <button type="button" class="btn btn--secondary" data-now="drive" data-tip="Watch the car drive the real route" data-tip-es="Mira el auto recorrer la ruta real">${ic('car')}${Le('Preview the drive', 'Ver el trayecto')}</button>
      </div>`, 'pane now-hero');

    const stats = ctx.el('left', `
      <div class="stats now-stats">
        <div class="stat"><span class="stat__k">${Le('Hail', 'Granizo')} ${U.srcTag('mrms')}</span>
          <span class="stat__v" data-h="${U.hailKey(pick.hail_in)}"><span class="num" data-now="hail">${F.num(pick.hail_in, 2)}</span><span class="stat__u">${Le('in', 'pulg')}</span></span>
          <span class="stat__s">${Lx(cp('now.pick.hailNote', 'Radar estimate', 'Estimado del radar'))}</span></div>
        <div class="stat"><span class="stat__k">${Le('Storm', 'Tormenta')} ${U.srcTag('spc')}</span>
          <span class="stat__v">${A.both((l) => F.date(storm, 'short', l))}</span>
          <span class="stat__s">${Le(F.daysBetween(storm) + ' days ago', 'hace ' + F.daysBetween(storm) + ' días')}</span></div>
        <div class="stat"><span class="stat__k">${Le('Drive', 'Trayecto')} ${U.srcTag({ label: 'GIS', tip: { en: 'Route traced on Nebraska GIS roads (NDOT highways, town streets); time from posted road speeds.', es: 'Ruta trazada sobre calles de Nebraska GIS (carreteras de NDOT, calles del pueblo); el tiempo sale de las velocidades de cada vía.' } })}</span>
          <span class="stat__v"><span class="num" data-now="miles">${routeMiles}</span><span class="stat__u">mi</span></span>
          <span class="stat__s">${Le('about ' + routeMin + ' min on ' + hwy, 'unos ' + routeMin + ' min por la ' + hwy)}</span></div>
      </div>
      ${lvl ? `<div class="now-ins">
        <span class="now-ins__k">${Lx(cp('now.likelyInsured.label', 'Likely insured', 'Probablemente asegurado'))}</span>
        <span class="now-ins__v">${Le(lvl.en, lvl.es)}</span>
        <span class="now-ins__tag" tabindex="0" role="note" data-tip="${A.esc(cp('now.likelyInsured.explain', '', '').en)}" data-tip-es="${A.esc(cp('now.likelyInsured.explain', '', '').es)}">${Lx(cp('now.likelyInsured.tag', 'area estimate', 'estimado del área'))} ${ic('info', 13)}</span>
        ${U.srcTag('census')}
        <span class="now-ins__s">${Le(F.int(area.homes) + ' homes in the ' + A.esc(area.name.en) + ' area · ' + area.owner + '% owner-lived', F.int(area.homes, 'es') + ' casas en el área de ' + A.esc(area.name.es) + ' · ' + area.owner + '% habitadas por sus dueños')}</span>
      </div>` : ''}`, 'pane pane--tight now-statpane');

    const s0 = (N.storms || [])[0];
    const s0Area = s0 ? (N.areas || []).filter((a) => a.st === s0.id).sort((a, b) => b.hail - a.hail)[0] : null;
    const srcCount = (id) => { const s = (S26.sources || []).find((x) => x.id === id); return s ? s.count : 0; };
    const nDays = (S26.storm_days || []).length;
    const brief = ctx.el('left', `
      <p class="sec">${Lx(cp('now.brief', '7 AM brief', 'Resumen de las 7 a. m.'))} <span class="sec__meta">${Le('written 7:02 AM', 'escrito a las 7:02 a. m.')}</span></p>
      <ol class="now-brief">
        <li><span class="now-brief__n">01</span><p><b>${Lx(cp('now.overnight.label', 'Overnight', 'Durante la noche'))}.</b> ${N.headline ? Le(N.headline.en, N.headline.es) : ''} ${U.srcTag('spc')} ${U.srcTag('mrms')}</p></li>
        <li><span class="now-brief__n">02</span><p><b>${Le('Checked.', 'Revisado.')}</b> ${Le(
          F.int(srcCount('lsr'), 'en') + ' hail reports, ' + F.int(srcCount('radar'), 'en') + ' radar hail signatures and ' + nDays + ' storm days this season.',
          F.int(srcCount('lsr'), 'es') + ' reportes de granizo, ' + F.int(srcCount('radar'), 'es') + ' firmas de granizo del radar y ' + nDays + ' días de tormenta esta temporada.')} ${U.srcTag('lsr')} ${U.srcTag('radar')}</p></li>
        ${s0 ? `<li><span class="now-brief__n">03</span><p><b>${Le('Newest hail.', 'Granizo más reciente.')}</b> ${Le(
          F.date(s0.date, 'short', 'en') + (s0Area ? ' near ' + s0Area.name.en : '') + ', ' + F.inches(s0Area ? s0Area.hail : s0.max, 2, 'en') + ', ' + F.daysBetween(s0.date) + ' days ago. ' + (s0Area ? F.int(s0Area.homes, 'en') + ' homes there; ' + town + ' has ' + F.int(area ? area.homes : 0, 'en') + '.' : ''),
          F.date(s0.date, 'short', 'es') + (s0Area ? ' cerca de ' + s0Area.name.es : '') + ', ' + F.inches(s0Area ? s0Area.hail : s0.max, 2, 'es') + ', hace ' + F.daysBetween(s0.date) + ' días. ' + (s0Area ? 'Ahí hay ' + F.int(s0Area.homes, 'es') + ' casas; ' + town + ' tiene ' + F.int(area ? area.homes : 0, 'es') + '.' : ''))} ${U.srcTag('spc')} ${U.srcTag('census')}</p></li>` : ''}
        <li class="now-brief__bk"><span class="now-brief__n">04</span><div>
          <p><b>${Lx(cp('now.backup.label', 'Backup zone', 'Zona de respaldo'))}.</b> ${A.esc(backup.name || '')}, ${F.num(backup.dist_mi, 1)} mi. ${backup.why ? Le(backup.why.en, backup.why.es) : ''} ${U.srcTag('census')}</p>
          <button type="button" class="btn btn--ghost btn--sm now-brief__show" data-now="backup">${ic('target', 14)}${Le('Show on the map', 'Ver en el mapa')}</button></div></li>
      </ol>`, 'pane now-briefpane');

    /* ======== RIGHT: the ranked zones ======== */
    const geo = ZONES.slice().sort((a, b) => a.c[0] - b.c[0]);                 // as found, west to east (pre-sort)
    const zl = ctx.el('right', `
      <p class="sec now-zl__sec">${Lx(cp('now.zones.header', 'Zones, best first', 'Zonas, las mejores primero'))} <span class="sec__meta" data-now="zlmeta">${U.srcTag('engine')}</span></p>
      <ol class="now-zl" role="list">${ZONES.map((z) => rowHtml(z)).join('')}</ol>`, 'pane pane--tight now-zlpane');
    const list = zl.querySelector('.now-zl');
    const rowEls = ZONES.map((z) => list.querySelector('[data-i="' + z.i + '"]'));

    /* ======== DOCK: today's plan ======== */
    const plan = planSteps();
    const T0 = 7 * 60, T1 = 20 * 60, pos = (m) => A.clamp((m - T0) / (T1 - T0) * 100, 0, 100);
    const dock = ctx.el('bottom', `
      <p class="sec">${Lx(cp('now.plan.title', "Today's plan", 'El plan de hoy'))} <span class="sec__meta">${A.both((l) => F.date(A.story.today, 'day', l))}</span></p>
      <div class="now-day" aria-hidden="true">
        <div class="now-day__track">
          ${plan.map((s) => `<span class="now-day__seg now-day__seg--${s.id}" style="left:${pos(s.a).toFixed(2)}%;width:${Math.max(0.9, pos(s.b) - pos(s.a)).toFixed(2)}%"></span>`).join('')}
          <span class="now-day__now" style="left:${pos(toMin(A.story.time)).toFixed(2)}%"><i></i><b>${A.both((l) => F.time(A.story.time, l))}</b></span>
        </div>
        <div class="now-day__hours">${[7, 10, 13, 16, 19].map((h) => `<span style="left:${pos(h * 60).toFixed(2)}%">${A.both((l) => F.time(hhmm(h * 60), l))}</span>`).join('')}</div>
      </div>
      <svg class="now-day__leads" viewBox="0 0 1000 26" preserveAspectRatio="none" aria-hidden="true">${plan.map((s, i) =>
        `<path d="M${(pos(s.a) * 10 + (pos(s.b) - pos(s.a)) * 5).toFixed(1)} 0 C ${(pos(s.a) * 10).toFixed(1)} 14, ${((i + 0.5) / plan.length * 1000).toFixed(1)} 10, ${((i + 0.5) / plan.length * 1000).toFixed(1)} 26" vector-effect="non-scaling-stroke"/>`).join('')}</svg>
      <ol class="now-steps">${plan.map((s, i) => `
        <li class="now-step" data-state="${s.state}" data-step="${s.id}" tabindex="0" data-tip="${A.esc(s.d.en)}" data-tip-es="${A.esc(s.d.es)}">
          <span class="now-step__t">${s.time}</span>
          <span class="now-step__h">${s.title}</span>
          <span class="now-step__d">${Le(s.d.en, s.d.es)}${s.src ? ' ' + s.src : ''}</span></li>`).join('')}</ol>`, 'pane pane--tight now-plan');

    Object.assign(v.el, { hero, stats, brief, zl, list, rowEls, dock, geo });

    /* ======== MAP ======== */
    ctx.layer({ id: 'now-route', z: 112, draw2d: (c, f) => drawRoute(c, f, S) });
    ctx.layer({
      id: 'now-zones', z: 126,
      draw2d: (c, f) => drawZones(c, f, S),
      hit(pt, f) {
        let best = null, bd = 1e9;
        ZONES.forEach((z) => { if (S.app[z.i] < 0.5) return; const q = f.project(z.c), d = Math.hypot(q[0] - pt.x, q[1] - pt.y), r = ringR(f, z) + 6; if (d < r && d < bd) { bd = d; best = z; } });
        return best;
      },
      onHover(z) { setHover(z.i, 'map'); },
      onClick(z) { select(z.i, { from: 'map' }); }
    });
    const pickPin = A.h(`<button type="button" class="mk-ring mk-ring--pulse now-pick" data-tip="${A.esc(pick.name)}: rank 1" data-tip-es="${A.esc(pick.name)}: lugar 1"><b>1</b></button>`);
    pickPin.addEventListener('click', () => select(0, { from: 'map' }));
    ctx.pin('now-pick', [pick.center.lon, pick.center.lat], pickPin, { minZoom: 7.5 });
    const rkPins = [];
    ZONES.slice(1).forEach((z) => {
      const b = A.h(`<button type="button" class="now-rk" data-h="${A.ui.hailKey(zoneHail(z, S))}" data-tip="${A.esc(z.name)}" data-tip-es="${A.esc(z.name)}">${z.rank}</button>`);
      b.addEventListener('click', () => select(z.i, { from: 'map' }));
      b.addEventListener('pointerenter', () => setHover(z.i, 'map'));
      b.addEventListener('pointerleave', () => setHover(-1, 'map'));
      ctx.pin('now-rk-' + z.rank, z.c, b, { minZoom: z.town === 'Columbus' ? 11.7 : 8 });
      rkPins[z.i] = b;
    });
    const nCol = colPts.length;
    // one honest hail line for the cluster: the range from the area model up to the pick's radar reading
    const colH = ZONES.filter((z) => z.town === town && z.kind !== 'everyday').map((z) => zoneHail(z, S)).filter((h) => h != null);
    const hLo = colH.length ? Math.min.apply(null, colH) : pick.hail_in, hHi = colH.length ? Math.max.apply(null, colH) : pick.hail_in;
    const hRange = (l) => Math.abs(hHi - hLo) < 0.01 ? F.inches(hHi, 2, l) : F.num(hLo, 2, l) + '-' + F.inches(hHi, 2, l);
    ctx.pin('now-cluster', [pick.center.lon, pick.center.lat], A.h(`<div class="mk-label now-cluster" data-tip="Hail: the area model near ${A.esc(F.num(hLo, 2, 'en'))} in, the pick's radar reading ${A.esc(F.num(hHi, 2, 'en'))} in (MRMS)" data-tip-es="Granizo: el modelo del área cerca de ${A.esc(F.num(hLo, 2, 'es'))} pulg, la lectura de radar de la elección ${A.esc(F.num(hHi, 2, 'es'))} pulg (MRMS)">${Le(nCol + ' zones', nCol + ' zonas')} <span class="t-mono">${A.both((l) => F.date(pick.storm_day, 'short', l))} · ${A.both(hRange)}</span></div>`), { anchor: 'none', offset: [-18, 26], maxZoom: 11.6 });
    ctx.pin('now-hq', hq, A.h(`<div class="now-hq">${ic('home', 13)}<span>HMP</span></div>`), { anchor: 'top', offset: [0, 11], minZoom: 8 });
    ticks.forEach((t, k) => {
      const node = A.h(`<div class="now-tick"><b>${F.num(t.mile, 0)} mi</b><span>${t.min} min</span></div>`);
      ctx.pin('now-tick-' + k, t.at.p, node, { anchor: 'top', offset: [0, 12], minZoom: 8.6, maxZoom: 13.5 });
      t.node = node;
    });
    Object.assign(v.el, { pickPin, rkPins });

    /* ======== wiring ======== */
    hero.querySelector('[data-now="walk"]').addEventListener('click', () => A.view.go('knock'));
    const drvBtn = hero.querySelector('[data-now="drive"]');
    drvBtn.addEventListener('click', () => drive(true));
    drvBtn.addEventListener('pointerenter', () => { if (!(S.tl && S.tl.playing)) drive(false); });
    brief.querySelector('[data-now="backup"]').addEventListener('click', () => { const i = ZONES.findIndex((z) => z.id === backup.zone_id); select(i >= 0 ? i : ZONES.length - 1, { from: 'brief' }); });
    const drvStep = dock.querySelector('[data-step="drive"]'); if (drvStep) drvStep.addEventListener('pointerenter', () => { if (!(S.tl && S.tl.playing)) drive(false); });
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b) { e.stopPropagation(); if (b.dataset.act === 'walk') A.view.go('knock'); else if (b.dataset.act === 'back') deselect(); return; }
      const r = e.target.closest('.now-z__row'); if (!r) return;
      const i = +r.parentElement.dataset.i; if (S.sel === i) deselect(); else select(i, { from: 'list' });
    });
    list.addEventListener('pointerover', (e) => { const li = e.target.closest('.now-z'); if (li) setHover(+li.dataset.i, 'list'); });
    list.addEventListener('pointerleave', () => setHover(-1, 'list'));
    list.addEventListener('focusin', (e) => { const li = e.target.closest('.now-z'); if (li) setHover(+li.dataset.i, 'list'); });
    ctx.on('map:hover', (d) => { if (!d || d.layer !== 'now-zones') { if (S.hoverFrom === 'map') setHover(-1, 'map'); } });
    ctx.on('escape', () => {
      if (S.tl && S.tl.playing) { S.tl.skip(); return; }
      if (S.sel >= 0) { deselect(); return; }
      if (S.car) stopCar(true);
    });
    // the film only stops on intent: a press or wheel on the map, or a map key. Hover just highlights.
    const skipOnIntent = () => { if (S.tl && S.tl.playing) S.tl.skip(); };
    const wEl = A.world && A.world.el;
    if (wEl) {
      wEl.addEventListener('pointerdown', skipOnIntent, { passive: true }); wEl.addEventListener('wheel', skipOnIntent, { passive: true });
      ctx.own(() => { wEl.removeEventListener('pointerdown', skipOnIntent); wEl.removeEventListener('wheel', skipOnIntent); });
    }
    const onKey = (e) => { if (/^(Arrow|\+|-|=|0$)/.test(e.key) && !(e.target && e.target.closest && e.target.closest('input,textarea,select'))) skipOnIntent(); };
    addEventListener('keydown', onKey); ctx.own(() => removeEventListener('keydown', onKey));
    ctx.on('lang', () => { if (S.sel >= 0) fillMore(S.sel); A.world.invalidate('top'); });
    ctx.on('theme', () => A.world.invalidate('top'));
    ctx.own(() => { if (S.tl) { const t = S.tl; S.tl = null; t.stop(); } stopCar(false); if (S.pulseTw) S.pulseTw.cancel(); });

    /* ======== the entrance ======== */
    if (!played) {
      played = true;
      const tl = assemble(ctx);
      if (tl) tl.play();
    } else {
      finalState(v);
      if (!A.still) { const tl = quickLand(v); if (tl) tl.play(); }
    }
  }

  /* ---------- row html ---------- */
  function rowHtml(z) {
    const h = zoneHail(z, V && V.S), pk = z.i === 0, st = stormOf(z.area_id);
    const kind = z.kind === 'everyday' ? cp('now.zones.everyday', 'Everyday zone', 'Zona de todos los días') : null;
    return `<li class="now-z${pk ? ' now-z--pick' : ''}" data-i="${z.i}">
      <button type="button" class="row now-z__row" aria-expanded="false">
        <span class="row__lead row__lead--ring now-z__rk" data-h="${A.ui.hailKey(h)}">${z.rank}</span>
        <span class="row__main"><span class="row__t">${A.esc(z.street)}</span>
          <span class="row__s">${z.town !== ZONES[0].town ? A.esc(z.town) + ' · ' : ''}${kind ? Le('everyday zone', 'zona de todos los días') : (st ? A.both((l) => A.fmt.date(st.date, 'short', l)) + ' · ' : '') + Lx(cp('now.zones.homes', '{n} homes', '{n} casas'), { n: z.homes })}</span></span>
        ${kind ? `<span class="row__trail now-z__ev" data-tip="Everyday score: older, owner-lived homes, no recent storm. A different scale from storm zones, so it ranks after them." data-tip-es="Puntaje de todos los días: casas viejas habitadas por sus dueños, sin tormenta reciente. Es otra escala que la de las zonas de tormenta, por eso va después."><span class="now-z__sc num">${A.fmt.num(z.score, 1)}</span><span class="now-z__evl">${Le('other scale', 'otra escala')}</span></span>`
        : `<span class="row__trail"><span class="now-z__sc num">${A.fmt.num(z.score, 1)}</span><span class="now-z__bar"><i style="transform:scaleX(${(z.score / 100).toFixed(3)})"></i></span></span>`}
      </button>
      <div class="now-z__more" hidden></div></li>`;
  }

  function zoneHail(z, S) {
    if (!z || z.kind === 'everyday') return null;
    if (z.i === 0 && pick.hail_in) return pick.hail_in;
    if (S && S.hailCache[z.i] != null) return S.hailCache[z.i];
    let h = null;
    if (A.world && A.world.hail && A.world.hail.ready) h = A.world.hail.at(z.c);
    if (!(h > 0.3)) { const a = AREA[z.area_id]; h = a ? a.hail : null; }
    h = h == null ? null : Math.round(h * 100) / 100;
    if (S) S.hailCache[z.i] = h;
    return h;
  }

  /* ---------- the plan ---------- */
  function planSteps() {
    const F = A.fmt, st = cp('now.plan.steps', '', '');
    const steps = Array.isArray(COPY.now && COPY.now.plan && COPY.now.plan.steps) ? COPY.now.plan.steps : [];
    const by = (id) => steps.find((s) => s.id === id) || {};
    const T = (id, k, en, es) => { const s = by(id)[k]; return s && s.en ? s : { en, es }; };
    const zone = (ZONES[0] && ZONES[0].town) || 'Columbus';
    const now = toMin(A.story.time);
    const out = [
      { id: 'brief', a: now, b: now + 20, time: A.both((l) => F.time(A.story.time, l)),
        title: Lx(T('brief', 'title', 'Brief ready', 'Resumen listo')),
        d: T('brief', 'detail', 'Storms, zones and the pick are up to date.', 'Tormentas, zonas y la elección del día, al día.') },
      { id: 'followups', a: 9 * 60, b: 10 * 60, time: A.both((l) => F.time('09:00', l)),
        title: Lx(T('followups', 'title', 'Follow-ups', 'Seguimientos')),
        d: { en: 'None waiting yet. Come-backs from your walks land here.', es: 'Ninguno pendiente todavía. Aquí llegan las puertas que pidan que regreses.' } },
      { id: 'prep', a: 13 * 60, b: 14 * 60, time: A.both((l) => F.time('13:00', l)),
        title: Le('Prep door cards + cancel forms', 'Prepara tarjetas y formularios'),
        d: { en: pick.doors + ' door cards. 3-day cancel forms in English and Spanish, one for every sale.', es: pick.doors + ' tarjetas de puerta. Formularios de cancelación de 3 días en inglés y español, uno por cada venta.' }, src: A.ui.srcTag('law') },
      { id: 'drive', a: toMin(leaveAt), b: toMin(leaveAt) + routeMin, time: Le('leave ', 'sal ') + A.both((l) => F.time(leaveAt, l)),
        title: Lx(T('drive', 'title', 'Drive to {zone}', 'Maneja a {zone}'), { zone }),
        d: { en: sub(T('drive', 'detail', '{mi} mi, about {min} min.', '').en, { mi: routeMiles, min: routeMin }) + ' Arrive 10 min early to park.', es: sub(T('drive', 'detail', '', '{mi} mi, unos {min} min.').es, { mi: routeMiles, min: routeMin }) + ' Llega 10 min antes para estacionarte.' } },
      { id: 'knock', a: toMin(knockStart), b: toMin(knockEnd), time: A.both((l) => F.range(knockStart, knockEnd, l)),
        title: Lx(T('knock', 'title', 'Knock {n} doors', 'Toca {n} puertas'), { n: pick.doors }),
        d: { en: 'Start at ' + ((pick.start && pick.start.address) || '') + '. The hours when most people are home.', es: 'Empieza en ' + ((pick.start && pick.start.address) || '') + '. Las horas en que más gente está en casa.' }, src: A.ui.srcTag('engine') }
    ];
    void st;
    out.forEach((s, i) => { s.state = i === 0 ? 'now' : i === 1 ? 'next' : 'later'; });
    return out;
  }

  /* ---------- map drawing ---------- */
  function ringR(f, z) { return A.clamp(0.26 * f.pxPerMile, 4.5, 44) * (z.i === 0 ? 1.25 : 1); }
  function drawZones(c, f, S) {
    const dark = f.theme !== 'light';
    // the pick's walk, once the camera is close enough to read streets
    if (f.zoom > 13.2 && N.walk && N.walk.s && S.app[0] > 0.99) {
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = rgba('--acc', 0.85); c.lineWidth = A.clamp((f.zoom - 12.5) * 1.6, 2, 5);
      N.walk.s.forEach((s) => { c.beginPath(); s.p.forEach((p, k) => { const q = f.project(p); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.stroke(); });
    }
    const order = ZONES.slice().reverse();
    // glow pass (adds up where zones cluster: the swath reads as heat)
    c.save(); if (dark) c.globalCompositeOperation = 'lighter';
    for (const z of order) {
      const a = S.app[z.i]; if (a <= 0.01) continue;
      const q = f.project(z.c); if (q[0] < -120 || q[1] < -120 || q[0] > f.w + 120 || q[1] > f.h + 120) continue;
      const r = ringR(f, z) * 2.8, tok = z.i === 0 ? '--acc' : A.ui.hailTok(zoneHail(z, S));
      const g = c.createRadialGradient(q[0], q[1], 0, q[0], q[1], r);
      g.addColorStop(0, rgba(tok, (dark ? 0.34 : 0.2) * a)); g.addColorStop(1, rgba(tok, 0));
      c.fillStyle = g; c.beginPath(); c.arc(q[0], q[1], r, 0, 6.2832); c.fill();
    }
    c.restore();
    // rings
    for (const z of order) {
      const a = S.app[z.i]; if (a <= 0.01) continue;
      const q = f.project(z.c); if (q[0] < -60 || q[1] < -60 || q[0] > f.w + 60 || q[1] > f.h + 60) continue;
      const land = A.clamp(a, 0, 1.2);                                   // spring overshoot comes in as >1 then settles
      const base = ringR(f, z), r = base * (1 + (1 - land) * 1.6), hot = S.hover === z.i || S.sel === z.i;
      const tok = z.i === 0 ? '--acc' : A.ui.hailTok(zoneHail(z, S));
      c.globalAlpha = f.alpha * A.clamp(a * 1.4, 0, 1);
      c.fillStyle = rgba('--page', hot ? 0.55 : 0.28); c.beginPath(); c.arc(q[0], q[1], r, 0, 6.2832); c.fill();
      c.strokeStyle = rgba(tok, 1); c.lineWidth = (z.i === 0 ? 2.6 : 1.6) + (hot ? 1.4 : 0);
      c.beginPath(); c.arc(q[0], q[1], r, 0, 6.2832); c.stroke();
      if (hot) {
        c.strokeStyle = rgba(tok, 0.5); c.lineWidth = 1; c.beginPath(); c.arc(q[0], q[1], r + 5, 0, 6.2832); c.stroke();
      }
      if (S.pulse && S.pulse.i === z.i) {
        const p = S.pulse.p; c.strokeStyle = rgba(tok, (1 - p) * 0.9); c.lineWidth = 2 * (1 - p) + 0.6;
        c.beginPath(); c.arc(q[0], q[1], r + 4 + p * Math.max(26, r * 1.6), 0, 6.2832); c.stroke();
      }
      c.globalAlpha = f.alpha;
    }
    // a name tag next to the ring under the cursor (only where the rank pins are hidden)
    const hi = S.hover >= 0 ? S.hover : -1;
    if (hi >= 0 && f.zoom < 11.7 && S.app[hi] > 0.5) {
      const z = ZONES[hi], q = f.project(z.c), r = ringR(f, z);
      const txt = '#' + z.rank + '  ' + z.street;
      c.font = '600 12px ' + (A.tok('--ui') ? 'Geist, "Geist L", system-ui, sans-serif' : 'system-ui');
      const w = c.measureText(txt).width + 16, x = q[0] + r + 10, y = q[1] - 12;
      c.fillStyle = rgba('--panel', 0.96); c.strokeStyle = rgba('--rule-3', 1); c.lineWidth = 1;
      roundRect(c, x, y, w, 24, 7); c.fill(); c.stroke();
      c.fillStyle = rgba('--text', 1); c.textBaseline = 'middle'; c.fillText(txt, x + 8, y + 12.5);
    }
  }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  function drawRoute(c, f, S) {
    if (!ROUTE || S.routeP <= 0.001) return;
    const dark = f.theme !== 'light';
    const pts = S.routeP >= 0.999 ? ROUTE.line : Rt.trail(ROUTE, S.routeP);
    if (!pts || pts.length < 2) return;
    const path = new Path2D(); pts.forEach((p, k) => { const q = f.project(p); k ? path.lineTo(q[0], q[1]) : path.moveTo(q[0], q[1]); });
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = rgba('--page', 0.75); c.lineWidth = 8; c.stroke(path);
    c.strokeStyle = rgba('--acc', dark ? 0.2 : 0.16); c.lineWidth = 7; c.stroke(path);
    c.strokeStyle = rgba('--acc', 0.95); c.lineWidth = 2.2; c.stroke(path);
    // the part the preview car has driven
    if (S.car && S.carF > 0) {
      const tp = Rt.trail(ROUTE, S.carF);
      if (tp && tp.length > 1) { c.beginPath(); tp.forEach((p, k) => { const q = f.project(p); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.strokeStyle = rgba('--text', 0.9); c.lineWidth = 2.6; c.stroke(); }
    }
    // mile ticks across the road at the towns on the way
    ticks.forEach((t) => {
      if (t.f > S.routeP) return;
      const q = f.project(t.at.p), h = (t.at.heading || 0) * Math.PI / 180, nx = Math.cos(h), ny = Math.sin(h);
      c.strokeStyle = rgba('--text', 0.9); c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(q[0] - nx * 7, q[1] - ny * 7); c.lineTo(q[0] + nx * 7, q[1] + ny * 7); c.stroke();
    });
    // start: HMP in Fremont
    const s0 = f.project(ROUTE.line[0]);
    c.fillStyle = rgba('--panel', 1); c.strokeStyle = rgba('--acc', 1); c.lineWidth = 2;
    c.beginPath(); c.arc(s0[0], s0[1], 4.5, 0, 6.2832); c.fill(); c.stroke();
    // the drawing head while the route writes itself
    if (S.routeP < 0.999) {
      const q = f.project(pts[pts.length - 1]);
      const g = c.createRadialGradient(q[0], q[1], 0, q[0], q[1], 16);
      g.addColorStop(0, rgba('--acc', 0.8)); g.addColorStop(1, rgba('--acc', 0));
      c.fillStyle = g; c.beginPath(); c.arc(q[0], q[1], 16, 0, 6.2832); c.fill();
      c.fillStyle = rgba('--text', 1); c.beginPath(); c.arc(q[0], q[1], 2.6, 0, 6.2832); c.fill();
    }
  }

  /* ---------- hover, select ---------- */
  function setHover(i, from) {
    const v = V; if (!v) return; const S = v.S;
    if (i === S.hover) return;
    S.hover = i; S.hoverFrom = i >= 0 ? from : null;
    v.el.rowEls.forEach((r, k) => r && r.classList.toggle('is-hover', k === i));
    A.world.invalidate('top');
    if (S.pulseTw) { S.pulseTw.cancel(); S.pulseTw = null; }
    S.pulse = null;
    if (i >= 0 && !A.still) pulseLoop(v, i);
  }
  function pulseLoop(v, i) {
    const S = v.S; S.pulse = { i, p: 0 };
    const tw = (S.pulseTw = A.motion.tween({ from: 0, to: 1, ms: 1150, ease: E.outCubic, update: (p) => { if (S.pulse) S.pulse.p = p; A.world.invalidate('top'); } }));
    tw.then((ok) => { if (ok && V === v && S.hover === i) pulseLoop(v, i); else if (S.pulse && S.pulse.i === i && S.hover !== i) { S.pulse = null; A.world.invalidate('top'); } });
  }

  function select(i, o = {}) {
    const v = V; if (!v || i < 0 || !ZONES[i]) return;
    const S = v.S, z = ZONES[i];
    if (S.tl && S.tl.playing) S.tl.skip();
    const was = S.sel; S.sel = i;
    v.el.rowEls.forEach((li, k) => {
      if (!li) return;
      const on = k === i, btn = li.querySelector('.now-z__row'), more = li.querySelector('.now-z__more');
      btn.setAttribute('aria-expanded', String(on)); li.classList.toggle('is-open', on);
      if (on) btn.setAttribute('aria-current', 'true'); else btn.removeAttribute('aria-current');
      if (!on && !more.hidden) more.hidden = true;
    });
    fillMore(i);
    const li = v.el.rowEls[i], more = li.querySelector('.now-z__more');
    more.hidden = false;
    if (was !== i) A.motion.reveal(more, { y: 6, ms: 420 });
    if (o.from !== 'list') A.safe('now scroll', () => li.scrollIntoView({ block: 'nearest', behavior: A.still ? 'auto' : 'smooth' }));
    const zoom = i === 0 ? 15.2 : z.town === 'Columbus' ? 14.4 : 13.8;
    A.world.flyTo({ center: z.c, zoom }, { instant: A.still });
    setHover(-1, o.from);
    S.hover = -1;
    if (!A.still) { S.pulse = null; pulseOnce(v, i); }
    A.world.invalidate('top');
  }
  function pulseOnce(v, i) {
    const S = v.S; S.pulse = { i, p: 0 };
    A.motion.tween({ from: 0, to: 1, ms: 1200, delay: 500, ease: E.outCubic, update: (p) => { if (S.pulse && S.pulse.i === i) { S.pulse.p = p; A.world.invalidate('top'); } } })
      .then(() => { if (S.pulse && S.pulse.i === i && S.hover !== i) { S.pulse = null; A.world.invalidate('top'); } });
  }
  function deselect() {
    const v = V; if (!v) return; const S = v.S;
    if (S.sel < 0) return;
    const li = v.el.rowEls[S.sel];
    if (li) { li.classList.remove('is-open'); const b = li.querySelector('.now-z__row'); b.setAttribute('aria-expanded', 'false'); b.removeAttribute('aria-current'); li.querySelector('.now-z__more').hidden = true; }
    S.sel = -1; A.world.invalidate('top');
    A.view.recenter();
  }
  function fillMore(i) {
    const v = V; if (!v) return;
    const z = ZONES[i], F = A.fmt, U = A.ui, S = v.S;
    const more = v.el.rowEls[i] && v.el.rowEls[i].querySelector('.now-z__more'); if (!more) return;
    const h = zoneHail(z, S), a = AREA[z.area_id], lvl = insuredLevel(a), st = stormOf(z.area_id);
    const straight = miBetween(hq, z.c);
    const rows = [];
    if (h != null) rows.push([Le('Hail', 'Granizo'), z.i === 0 ? A.both((l) => F.inches(h, 2, l)) + ' ' + Le('radar reading', 'lectura de radar') + ' ' + U.srcTag('mrms')
      : Le('~' + F.inches(h, 2, 'en') + ' area model', '~' + F.inches(h, 2, 'es') + ' modelo del área') + ' ' + U.srcTag({ label: 'model', tip: { en: 'Modeled at the zone center from NOAA SPC reports and MRMS radar swaths. Only the pick has its own radar reading.', es: 'Modelado en el centro de la zona con reportes de NOAA SPC y franjas de radar MRMS. Solo la elección tiene su propia lectura de radar.' } })]);
    if (st) rows.push([Le('Storm', 'Tormenta'), A.both((l) => F.date(st.date, 'day', l)) + ' ' + U.srcTag('spc')]);
    else rows.push([Le('Kind', 'Tipo'), Lx(cp('now.zones.everyday', 'Everyday zone: older homes, no recent storm', 'Zona de todos los días: casas viejas, sin tormenta reciente'))]);
    rows.push([Le('Homes', 'Casas'), F.int(z.homes) + ' ' + U.srcTag('engine')]);
    rows.push([Le('Score', 'Puntaje'), F.num(z.score, 1) + ' ' + U.srcTag('engine')]);
    rows.push([Le('From HMP', 'Desde HMP'), i === 0 ? Le(routeMiles + ' mi drive, about ' + routeMin + ' min', routeMiles + ' mi de camino, unos ' + routeMin + ' min') : Le(F.num(straight, 1, 'en') + ' mi straight line', F.num(straight, 1, 'es') + ' mi en línea recta')]);
    if (lvl) rows.push([Lx(cp('now.likelyInsured.label', 'Likely insured', 'Probablemente asegurado')), Le(lvl.en, lvl.es) + ' <span class="t-muted">' + Lx(cp('now.likelyInsured.tag', 'area estimate', 'estimado del área')) + '</span> ' + U.srcTag('census')]);
    if (z.i === 0 && pick.why) rows.push([Le('Why', 'Por qué'), Le(pick.why.en, pick.why.es)]);
    if (z.id === backup.zone_id && backup.why) rows.push([Le('Why', 'Por qué'), Le(backup.why.en, backup.why.es)]);
    more.innerHTML = `<dl class="kv now-z__kv">${rows.map((r) => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('')}</dl>
      <div class="now-z__act">${z.i === 0 ? `<button type="button" class="btn btn--primary btn--sm" data-act="walk">${ic('door', 14)}${Lx(cp('now.actions.startWalk', 'Start the walk', 'Empezar la ruta'))}</button>` : ''}
        <button type="button" class="btn btn--ghost btn--sm" data-act="back">${ic('arrow', 14)}${Le('Back to the plan', 'Volver al plan')} <span class="kbd">Esc</span></button></div>`;
  }

  /* ---------- the drive preview: a car on the real route ---------- */
  function drive(force) {
    const v = V; if (!v || !ROUTE) return; const S = v.S;
    if (S.car && !force) return;
    if (S.tl && S.tl.playing) S.tl.skip();
    stopCar(false);
    const car = v.el.car; car.classList.add('is-on');
    const ms = 4200;
    S.car = A.motion.tween({ from: 0, to: 1, ms, ease: E.inOutSine, update: (t) => {
      const at = Rt.atTime(ROUTE, t);
      S.carF = at.mile / ROUTE.miles; S.carAt = at; S.carT = t;
      A.world.movePin('now-car', at.p);
      const d = car.firstElementChild; if (d) d.style.transform = 'rotate(' + at.heading.toFixed(1) + 'deg)';
      updCarLabel(); A.world.invalidate('top');
    } });
    S.car.then((ok) => { if (!ok || V !== v) return; v.ctx.timer(() => stopCar(true), 1600); });
  }
  function updCarLabel() {
    const v = V; if (!v || !v.S.carAt) return;
    const S = v.S, lbl = v.el.car.querySelector('.now-car__lbl'); if (!lbl) return;
    const m = Math.round(Rt.minutesAt(ROUTE, S.carF));
    lbl.textContent = A.fmt.num(S.carAt.mile, 0) + ' mi · ' + m + ' min';
  }
  function stopCar(fade) {
    const v = V; if (!v) return; const S = v.S;
    if (S.car && S.car.cancel) S.car.cancel();
    S.car = null; S.carF = 0; S.carAt = null;
    if (v.el.car) v.el.car.classList.remove('is-on');
    if (fade) A.world.invalidate('top');
  }

  /* ---------- states + the assemble timeline ---------- */
  function setRowOrder(v, arr) { arr.forEach((z) => v.el.list.appendChild(v.el.rowEls[z.i])); }
  function preState(v) {
    const S = v.S;
    S.app = ZONES.map(() => 0); S.routeP = 0;
    setRowOrder(v, v.el.geo);
    v.el.rowEls.forEach((li) => { li.classList.add('is-pending'); const b = li.querySelector('.now-z__row'); b.removeAttribute('aria-current'); });
    A.$$('[data-now="town"],[data-now="street"],.now-hero__line,.now-hero__why', v.el.hero).forEach((e) => e.classList.add('is-pending'));
    A.$$('.now-step', v.el.dock).forEach((e) => e.classList.add('is-pending'));
    A.$$('.now-day__seg,.now-day__now', v.el.dock).forEach((e) => e.classList.add('is-pending'));
    ticks.forEach((t) => t.node && t.node.classList.add('is-pending'));
    v.el.pickPin.classList.add('is-pending');
    v.el.rkPins.forEach((p) => p && p.classList.add('is-pending'));
    v.el.hero.classList.add('is-waiting');
    const sc = v.el.hero.querySelector('[data-now="scored"]'); if (sc) sc.textContent = '0/' + ZONES.length;
    const meta = v.el.zl.querySelector('[data-now="zlmeta"]'); if (meta) meta.innerHTML = Le('scoring…', 'calificando…') + ' ' + A.ui.srcTag('engine');
    A.world.invalidate('top');
  }
  function finalState(v) {
    const S = v.S;
    S.app = ZONES.map(() => 1); S.routeP = 1;
    setRowOrder(v, ZONES);
    A.$$('.is-pending', v.el.hero.parentElement).forEach((e) => e.classList.remove('is-pending'));
    A.$$('.is-pending', v.el.dock).forEach((e) => e.classList.remove('is-pending'));
    v.el.rowEls.forEach((li) => li.classList.remove('is-pending'));
    ticks.forEach((t) => t.node && t.node.classList.remove('is-pending'));
    v.el.pickPin.classList.remove('is-pending');
    v.el.rkPins.forEach((p) => p && p.classList.remove('is-pending'));
    v.el.hero.classList.remove('is-waiting');
    const b0 = v.el.rowEls[0] && v.el.rowEls[0].querySelector('.now-z__row'); if (b0 && S.sel < 0) b0.setAttribute('aria-current', 'true');
    const meta = v.el.zl.querySelector('[data-now="zlmeta"]'); if (meta) meta.innerHTML = A.ui.srcTag('engine');
    A.world.invalidate('top');
  }

  /** The pick assembles. Puts the view in its before-state now; returns the Timeline (call .play()). */
  function assemble(ctx) {
    const v = V && (!ctx || V.ctx === ctx || ctx === A.view.ctx) ? V : null;
    if (!v || !v.ctx.alive()) return null;
    const S = v.S, F = A.fmt;
    if (S.tl) { const old = S.tl; S.tl = null; old.stop(); }
    preState(v);
    const tl = new A.motion.Timeline();
    S.tl = tl;
    const EACH = 105, LAND = 620, Z0 = 320;
    const alive = () => V === v && v.ctx.alive();

    // 1. drop into the swath where the zones are
    tl.add(0, (t, o) => { if (!o.seeking && alive() && colPts.length) A.world.flyTo({ points: colPts, pad: A.stacked() ? 30 : 90, maxZoom: 13.4 }, { ms: 1250 }); });
    // 2. twelve rings land in rank order; each row arrives with its score
    tl.add(Z0, { ms: EACH * (ZONES.length - 1) + LAND, ease: E.linear, update: (p, raw) => {
      if (!alive()) return; const tt = raw * (EACH * (ZONES.length - 1) + LAND);
      ZONES.forEach((z) => { const k = A.clamp((tt - z.i * EACH) / LAND, 0, 1); S.app[z.i] = k <= 0 ? 0 : k >= 1 ? 1 : E.hail(k); });
      A.world.invalidate('top');
    } });
    ZONES.forEach((z) => tl.add(Z0 + z.i * EACH, (t, o) => {
      if (!alive()) return; const li = v.el.rowEls[z.i]; li.classList.remove('is-pending');
      const pn = v.el.rkPins[z.i]; if (pn) pn.classList.remove('is-pending');
      const sc = v.el.hero.querySelector('[data-now="scored"]'); if (sc) sc.textContent = (z.i + 1) + '/' + ZONES.length;
      const cd = v.el.hero.querySelector('[data-now="cand"]'), cs = v.el.hero.querySelector('[data-now="candsc"]');
      if (cd) { cd.textContent = z.street; cs.textContent = A.fmt.num(z.score, 1); if (!o.seeking) A.motion.reveal(cd.parentElement, { y: 8, ms: 320 }); }
      if (!o.seeking) {
        A.motion.reveal(li, { y: 8, ms: 460 });
        A.motion.countUp(li.querySelector('.now-z__sc'), z.score, { decimals: 1, ms: 700 });
        if (window.Sound && window.Sound.enabled) window.Sound.tick({ gain: 0.5 });
      }
    }));
    // 3. the list sorts itself (FLIP)
    const TSORT = Z0 + EACH * (ZONES.length - 1) + LAND + 120;
    tl.add(TSORT, (t, o) => {
      if (!alive()) return;
      const first = new Map(); v.el.rowEls.forEach((li) => first.set(li, li.getBoundingClientRect().top));
      setRowOrder(v, ZONES);
      const meta = v.el.zl.querySelector('[data-now="zlmeta"]'); if (meta) meta.innerHTML = A.ui.srcTag('engine');
      if (o.seeking || A.still) return;
      v.el.rowEls.forEach((li) => {
        const dy = first.get(li) - li.getBoundingClientRect().top; if (Math.abs(dy) < 1) return;
        try { li.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }], { duration: 620, easing: A.motion.css.hail }); } catch (e) { /* ignore */ }
      });
    });
    // 4. the winner lifts into the hero
    const TLIFT = TSORT + 560;
    tl.add(TLIFT, (t, o) => {
      if (!alive()) return;
      const b0 = v.el.rowEls[0].querySelector('.now-z__row'); b0.setAttribute('aria-current', 'true');
      const street = v.el.hero.querySelector('[data-now="street"]'), townEl = v.el.hero.querySelector('[data-now="town"]');
      const from = b0.querySelector('.row__t').getBoundingClientRect();
      A.$$('.is-pending', v.el.hero).forEach((e) => e.classList.remove('is-pending'));
      v.el.hero.classList.remove('is-waiting');
      v.el.pickPin.classList.remove('is-pending');
      if (o.seeking || A.still) return;
      const to = street.getBoundingClientRect();
      const onScreen = (r) => r.bottom > 0 && r.top < innerHeight && r.width > 0;
      if (onScreen(from) && onScreen(to) && !A.stacked()) {
        const s = from.height / Math.max(1, to.height);
        try { street.animate([{ transform: 'translate(' + (from.left - to.left) + 'px,' + (from.top - to.top) + 'px) scale(' + s.toFixed(3) + ')', opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 760, easing: A.motion.css.hail }); } catch (e) { /* ignore */ }
      } else A.motion.reveal(street, { y: 10 });
      A.motion.reveal(townEl, { y: 22, ms: 640, delay: 80 });
      A.motion.stagger(A.$$('.now-hero__line,.now-hero__why', v.el.hero), { each: 70, delay: 220, y: 10 });
      A.motion.ripple(v.el.pickPin, { rings: 2, size: 64 });
      if (window.Sound && window.Sound.enabled) window.Sound.ring(0, { gain: 0.6 });
    });
    // 5. its numbers roll
    tl.add(TLIFT + 220, (t, o) => {
      if (!alive() || o.seeking || A.still) return;
      const q = (k) => v.el.stats.querySelector('[data-now="' + k + '"]');
      A.motion.countUp(q('hail'), pick.hail_in, { decimals: 2, ms: 1000 });
      A.motion.countUp(q('miles'), routeMiles, { ms: 1000, delay: 80 });
      A.motion.countUp(v.el.hero.querySelector('[data-now="doors"]'), pick.doors, { ms: 900, delay: 120 });
    });
    // 6. pull back to the whole drive while the route writes itself from Fremont
    const TBACK = TLIFT + 420, TROUTE = TBACK + 260, RMS = 1900;
    tl.add(TBACK, (t, o) => { if (!o.seeking && alive() && !(S.sel >= 0)) A.view.recenter(); });
    tl.add(TROUTE, { ms: RMS, ease: E.inOutSine, update: (p) => {
      if (!alive()) return; S.routeP = p;
      ticks.forEach((tk) => { if (tk.node && p >= tk.f && tk.node.classList.contains('is-pending')) { tk.node.classList.remove('is-pending'); if (!A.still && p < 1) A.motion.reveal(tk.node, { y: 6, ms: 380 }); } });
      A.world.invalidate('top');
    } });
    // 7. the day lands, step by step; the "now" needle rings
    const steps = A.$$('.now-step', v.el.dock), segs = A.$$('.now-day__seg', v.el.dock);
    steps.forEach((el, j) => tl.add(TROUTE + 300 + j * 150, (t, o) => {
      if (!alive()) return; el.classList.remove('is-pending'); if (segs[j]) segs[j].classList.remove('is-pending');
      if (!o.seeking) { A.motion.reveal(el, { y: 10, ms: 480 }); if (segs[j]) A.motion.reveal(segs[j], { y: 0, ms: 360, scale: 0.6 }); }
    }));
    tl.add(TROUTE + 300 + steps.length * 150 + 60, (t, o) => {
      if (!alive()) return; const nd = v.el.dock.querySelector('.now-day__now'); if (!nd) return;
      nd.classList.remove('is-pending'); if (!o.seeking) A.motion.reveal(nd, { y: -6, ring: true, size: 30 });
    });
    tl.add(TROUTE + RMS + 60, () => {});
    tl.onEnd((done) => { if (alive()) { if (!done) finalState(v); if (S.tl === tl) S.tl = null; } });
    return tl;
  }
  /** a shorter landing for later visits: rings drop in together, the route is already there */
  function quickLand(v) {
    const S = v.S; const tl = new A.motion.Timeline(); S.tl = tl;
    S.app = ZONES.map(() => 0);
    tl.add(120, { ms: 900, ease: E.linear, update: (p, raw) => {
      if (V !== v) return; const tt = raw * 900;
      ZONES.forEach((z) => { const k = A.clamp((tt - z.i * 30) / 560, 0, 1); S.app[z.i] = k <= 0 ? 0 : k >= 1 ? 1 : E.hail(k); });
      A.world.invalidate('top');
    } });
    tl.onEnd(() => { if (V === v) { S.app = ZONES.map(() => 1); A.world.invalidate('top'); if (S.tl === tl) S.tl = null; } });
    return tl;
  }

  /** For the intro and the director: the pick assembling as a Timeline (not yet played). */
  A.nowAssemble = function (ctx) { return A.safe('now assemble', () => assemble(ctx)) || null; };
  A.views = A.views || {};
  A.views.now = Object.assign(A.views.now || {}, { assemble: A.nowAssemble });
  A.on('intro:handoff', () => {
    if (A.view.current !== 'now' || !V) { played = false; return; }       // Now will assemble when it enters
    const tl = A.nowAssemble(V.ctx); if (tl) tl.play();
  });
})();
