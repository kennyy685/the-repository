/* Claude's Aldaba · now.js · #now = the 7 AM brief
   In five seconds: where to go today, why, how many doors, when, and that Aldaba has checked everything.
   Left: the pick (hero), its numbers with sources, the morning brief. Right: the 12 ranked zones.
   Dock: today's plan on a 7 AM to 8 PM day bar. Map: zone rings glowing by hail, rank pins, the real drive
   (Fremont -> Columbus on US-30) with mile/minute ticks, and a car that drives it on "Preview the drive".

   Hail numbers: the pick's own radar estimate (NL.pick.hail_in, MRMS at the zone) is the one headline number. The
   other zones only have the smoothed area model (A.world.hail.at), and every place that shows it says "area model".

   The entrance is the pick ASSEMBLING (skipped under A.still): the camera drops into Columbus and Aldaba scores the
   zones one by one, from HMP's side of town outward. Each ring lands as its row arrives with its score, and the
   orange "best so far" passes from ring to ring whenever a higher score comes in. The list then sorts itself
   (FLIP), the rank numbers land, the winner lifts into the hero, its numbers roll, the camera pulls back while the
   route draws itself from Fremont, and the day lands step by step. Nothing that gives the answer away is on screen
   before the lift. Exposed as A.nowAssemble(ctx) → Timeline (not yet played) for the intro and the director;
   'intro:handoff' replays it when Now is on screen. Hover only highlights; a press, wheel, key or click skips. */
(function () {
  'use strict';
  const A = window.A; if (!A || !A.view) return;
  const COPY = window.COPY || {};
  const Rt = window.Route || null;
  const TAU = Math.PI * 2;

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
  const font = (w, px, tok, fb) => w + ' ' + px + 'px ' + (A.tok(tok) || fb);

  /* ---------- data, once ---------- */
  const N = A.data || {}, X = A.x || {}, S26 = X.storms2026 || {};
  const pick = N.pick || {}, backup = N.backup || {};
  const ROUTE = Rt && window.ROUTE_BAKED ? (A.safe('now route', () => Rt.load(N)) || null) : null;
  const ZONES = (N.zones || []).map((z, i) => {
    const parts = String(z.name || '').split(':');
    return Object.assign({}, z, { i, town: parts[0].trim(), street: parts.slice(1).join(':').trim() || z.name });
  });
  const NZ = ZONES.length;
  const TOWN = (ZONES[0] && ZONES[0].town) || 'Columbus';
  const AREA = {}; (N.areas || []).forEach((a) => (AREA[a.id] = a));
  const pickArea = AREA[pick.area_id] || null;
  const stormOf = (areaId) => { const a = AREA[areaId]; if (!a) return null; return (N.storms || []).find((s) => s.id === a.st) || null; };
  const insuredLevel = (a) => { if (!a || !a.insured) return null; const f = (s) => String(s).split(':').slice(1).join(':').trim() || s; return { en: f(a.insured.en), es: f(a.insured.es) }; };
  const routeMiles = ROUTE ? ROUTE.miles : Math.round(pick.dist_mi || 0);
  const routeMin = ROUTE ? ROUTE.minutes : Math.round((pick.dist_mi || 0) * 1.15);
  const hwy = ROUTE && ROUTE.legs ? (ROUTE.legs.slice().sort((a, b) => b.miles - a.miles)[0] || {}).name || 'US-30' : 'US-30';
  const ticks = ROUTE ? (ROUTE.stops || []).filter((s) => s.mile > 3 && s.mile < ROUTE.miles - 3).map((s) => ({
    name: s.name, mile: s.mile, f: s.mile / ROUTE.miles, min: Math.round(Rt.minutesAt(ROUTE, s.mile / ROUTE.miles)), at: Rt.atMile(ROUTE, s.mile)
  })) : [];
  const knockStart = (pick.best_time && pick.best_time.start) || '16:00', knockEnd = (pick.best_time && pick.best_time.end) || '19:30';
  const leaveAt = hhmm(toMin(knockStart) - routeMin - 10);            // arrive 10 min early to park and set up
  const hq = N.hq || (ROUTE ? ROUTE.line[0] : [-96.4867, 41.4403]);
  const colZ = ZONES.filter((z) => z.town === TOWN && z.kind !== 'everyday');
  const colPts = colZ.map((z) => z.c);
  const routeCam = () => { const pts = []; if (ROUTE) ROUTE.line.forEach((p, i) => { if (i % 3 === 0) pts.push(p); }); pts.push(hq, [pick.center.lon, pick.center.lat]); return pts; };
  /* the order Aldaba scores the zones in the entrance: storm zones from HMP's side of town (east) outward, then the
     everyday zones, which score on another scale */
  const SCAN = ZONES.filter((z) => z.kind !== 'everyday').sort((a, b) => b.c[0] - a.c[0]).concat(ZONES.filter((z) => z.kind === 'everyday'));
  /* the score axis in the hero while Aldaba scores: one ring per storm zone at its score (stacked where they touch) */
  const AX = (() => {
    const st = ZONES.filter((z) => z.kind !== 'everyday'); if (st.length < 2) return null;
    const sc = st.map((z) => z.score), lo = Math.floor(Math.min.apply(null, sc) / 5) * 5, hi = Math.max(lo + 10, Math.ceil(Math.max.apply(null, sc) / 5) * 5);
    const pos = (x) => (x - lo) / (hi - lo) * 100, lanes = [], dots = {};
    st.slice().sort((a, b) => a.score - b.score).forEach((z) => {
      let k = 0; while (lanes[k] != null && z.score - lanes[k] < (hi - lo) * 0.034) k++;
      lanes[k] = z.score; dots[z.i] = { x: pos(z.score), lane: k };
    });
    const marks = []; for (let t = lo; t <= hi; t += 5) marks.push({ t, x: pos(t) });
    return { dots, marks };
  })();

  const ZL_H = () => Lx(cp('now.zones.header', 'Zones, best first', 'Zonas, las mejores primero'));

  let V = null;          // the live instance while Now is on screen
  let played = false;    // the full assemble plays once per visit to the app; later visits land quickly

  /* ---------- the view ---------- */
  A.view.register('now', {
    title: cp('now.title', 'Now', 'Ahora'), key: '1', dim: 0, hail: 0.9, ambient: true,
    camera: (fr) => ({ points: routeCam(), pad: fr.stacked ? { t: 46, r: 50, b: 46, l: 62 } : { t: 78, r: 70, b: 70, l: 70 }, maxZoom: 12 }),
    enter(ctx) { A.safe('now enter', () => build(ctx)); },
    exit() { V = null; }
  });

  function build(ctx) {
    const S = { app: ZONES.map(() => 1), routeP: 1, hover: -1, hoverFrom: null, sel: -1, pulse: null, pulseTw: null,
      lead: 0, best: -1, lpulse: null, lpulseTw: null, car: null, carAt: null, carF: 0, carMin: 0, carA: 0, carATw: null, tl: null, hailCache: {} };
    const v = (V = { ctx, S, el: {} });
    const U = A.ui, F = A.fmt;
    const area = pickArea, lvl = insuredLevel(area);
    const storm = pick.storm_day;
    const ph = '<i class="now-ph" aria-hidden="true"></i>';

    /* ======== LEFT: the pick ======== */
    const hero = ctx.el('left', `
      <p class="eyebrow eyebrow--acc now-hero__eye"><span class="now-hero__lbl">${Le('Aldaba’s pick', 'Elección de Aldaba')}</span><span class="now-hero__rk" data-pend>· <b>${Le('rank 1 of ' + NZ, 'n.º 1 de ' + NZ)}</b></span>
        <span class="now-hero__score" data-pend>${Lx(cp('now.pick.score', 'Score {n}', 'Puntaje {n}'), { n: F.num(pick.score, 1) })} ${U.srcTag('engine')}</span></p>
      <div class="now-hero__scan" aria-hidden="true">
        <p class="now-hero__wait"><span class="now-hero__spin"></span><span>${Le('Picking today’s zone', 'Eligiendo la zona de hoy')}</span> <b class="num" data-now="scored">0/${NZ}</b></p>
        <p class="now-hero__cand"><span class="now-hero__candt" data-now="cand"></span><span class="now-hero__candsc num" data-now="candsc"></span></p>
        ${AX ? `<div class="now-hero__axis"><i class="now-hero__axl"></i>${AX.marks.map((m) => `<span class="now-hero__axt" style="left:${m.x.toFixed(2)}%">${m.t}</span>`).join('')}${Object.keys(AX.dots).map((i) => `<b class="now-hero__axd" data-i="${i}" style="left:${AX.dots[i].x.toFixed(2)}%;--lane:${AX.dots[i].lane}"></b>`).join('')}<span class="now-hero__axk">${Le('score', 'puntaje')}</span></div>` : ''}
        <p class="now-hero__best"><span class="now-hero__bestk">${Le('Best so far', 'Mejor hasta ahora')}</span><b class="now-hero__bestt" data-now="best"></b><span class="num now-hero__bestsc" data-now="bestsc"></span></p>
      </div>
      <h1 class="now-hero__town" data-now="town" data-pend>${A.esc(TOWN)}<span class="now-hero__dot">.</span></h1>
      <p class="now-hero__street" data-now="street" data-pend>${A.esc(ZONES[0] ? ZONES[0].street : pick.name)}</p>
      <p class="now-hero__line" data-pend><span class="now-hero__doors"><span class="num" data-now="doors">${pick.doors}</span> ${Le('doors.', 'puertas.')}</span>
        <span class="now-hero__time">${A.both((l) => F.range(knockStart, knockEnd, l))}</span></p>
      <p class="t-lead now-hero__why" data-pend>${pick.why ? Le(pick.why.en, pick.why.es) : ''}</p>
      <div class="now-hero__act" data-pend>
        <button type="button" class="btn btn--primary" data-now="walk">${ic('door')}${Lx(cp('now.actions.startWalk', 'Start the walk', 'Empezar la ruta'))}</button>
        <button type="button" class="btn btn--secondary" data-now="drive" data-tip="Watch a car drive the real route" data-tip-es="Mira un auto recorrer la ruta real">${ic('car')}${Le('Preview the drive', 'Ver el trayecto')}</button>
      </div>`, 'pane now-hero');

    const stats = ctx.el('left', `
      <div class="stats now-stats">
        <div class="stat"><span class="stat__k">${Le('Hail', 'Granizo')} ${U.srcTag('mrms')}</span>
          <span class="stat__v" data-h="${U.hailKey(pick.hail_in)}">${ph}<span class="now-sv"><span class="num" data-now="hail">${F.num(pick.hail_in, 2)}</span><span class="stat__u">${Le('in', 'pulg')}</span></span></span>
          <span class="stat__s now-sv">${Lx(cp('now.pick.hailNote', 'Radar estimate', 'Estimado del radar'))}</span></div>
        <div class="stat"><span class="stat__k">${Le('Storm', 'Tormenta')} ${U.srcTag('spc')}</span>
          <span class="stat__v">${ph}<span class="now-sv" data-now="date">${A.both((l) => F.date(storm, 'short', l))}</span></span>
          <span class="stat__s now-sv">${Le(F.daysBetween(storm) + ' days ago', 'hace ' + F.daysBetween(storm) + ' días')}</span></div>
        <div class="stat"><span class="stat__k">${Le('Drive', 'Trayecto')} ${U.srcTag({ label: 'GIS', tip: { en: 'Route traced on Nebraska GIS roads (NDOT highways, town streets); time from posted road speeds.', es: 'Ruta trazada sobre calles de Nebraska GIS (carreteras de NDOT, calles del pueblo); el tiempo sale de las velocidades de cada vía.' } })}</span>
          <span class="stat__v">${ph}<span class="now-sv"><span class="num" data-now="miles">${routeMiles}</span><span class="stat__u">mi</span></span></span>
          <span class="stat__s now-sv">${Le('about ' + routeMin + ' min on ' + hwy, 'unos ' + routeMin + ' min por la ' + hwy)}</span></div>
      </div>
      ${lvl ? `<div class="now-ins">
        <span class="now-ins__k">${Lx(cp('now.likelyInsured.label', 'Likely insured', 'Probablemente asegurado'))}</span>
        <span class="now-ins__v">${ph}<span class="now-sv" data-now="ins">${Le(lvl.en, lvl.es)}</span></span>
        <span class="now-ins__tag" tabindex="0" role="note" data-tip="${A.esc(cp('now.likelyInsured.explain', '', '').en)}" data-tip-es="${A.esc(cp('now.likelyInsured.explain', '', '').es)}">${Lx(cp('now.likelyInsured.tag', 'area estimate', 'estimado del área'))} ${ic('info', 13)}</span>
        ${U.srcTag('census')}
        <span class="now-ins__s now-sv">${Le(F.int(area.homes, 'en') + ' homes in the ' + area.name.en + ' area · ' + area.owner + '% owner-lived', F.int(area.homes, 'es') + ' casas en el área de ' + area.name.es + ' · ' + area.owner + '% habitadas por sus dueños')}</span>
      </div>` : ''}`, 'pane pane--tight now-statpane');

    const s0 = (N.storms || [])[0];
    const s0Area = s0 ? (N.areas || []).filter((a) => a.st === s0.id).sort((a, b) => b.hail - a.hail)[0] : null;
    const srcCount = (id) => { const s = (S26.sources || []).find((x) => x.id === id); return s ? s.count : 0; };
    const nDays = (S26.storm_days || []).length;
    const bkMi = Math.round(backup.dist_mi || 0);
    // "Checked" leads: it is the work Aldaba did, so it can stay on screen while the pick assembles
    const brief = ctx.el('left', `
      <p class="sec">${Lx(cp('now.brief', '7 AM brief', 'Resumen de las 7 a. m.'))} <span class="sec__meta now-meta">${Le('written 7:02 AM', 'escrito a las 7:02 a. m.')}</span></p>
      <ol class="now-brief">
        <li><span class="now-brief__n">01</span><p><b>${Le('Checked.', 'Revisado.')}</b> ${Le(
          F.int(srcCount('lsr'), 'en') + ' hail reports, ' + F.int(srcCount('radar'), 'en') + ' radar hail signatures and ' + nDays + ' storm days this season.',
          F.int(srcCount('lsr'), 'es') + ' reportes de granizo, ' + F.int(srcCount('radar'), 'es') + ' firmas de granizo del radar y ' + nDays + ' días de tormenta esta temporada.')} ${U.srcTag('lsr')} ${U.srcTag('radar')}</p></li>
        <li data-pend><span class="now-brief__n">02</span><p><b>${Lx(cp('now.overnight.label', 'Overnight', 'Durante la noche'))}.</b> ${N.headline ? Le(N.headline.en, N.headline.es) : ''} ${U.srcTag('spc')} ${U.srcTag('mrms')}</p></li>
        ${s0 ? `<li data-pend><span class="now-brief__n">03</span><p><b>${Le('Newest hail.', 'Granizo más reciente.')}</b> ${Le(
          F.date(s0.date, 'short', 'en') + (s0Area ? ' near ' + s0Area.name.en : '') + ', ' + F.inches(s0Area ? s0Area.hail : s0.max, 2, 'en') + ', ' + F.daysBetween(s0.date) + ' days ago. ' + (s0Area ? F.int(s0Area.homes, 'en') + ' homes there; ' + TOWN + ' has ' + F.int(area ? area.homes : 0, 'en') + '.' : ''),
          F.date(s0.date, 'short', 'es') + (s0Area ? ' cerca de ' + s0Area.name.es : '') + ', ' + F.inches(s0Area ? s0Area.hail : s0.max, 2, 'es') + ', hace ' + F.daysBetween(s0.date) + ' días. ' + (s0Area ? 'Ahí hay ' + F.int(s0Area.homes, 'es') + ' casas; ' + TOWN + ' tiene ' + F.int(area ? area.homes : 0, 'es') + '.' : ''))} ${U.srcTag('spc')} ${U.srcTag('census')}</p></li>` : ''}
        <li class="now-brief__bk" data-pend><span class="now-brief__n">04</span><div>
          <p><b>${Lx(cp('now.backup.label', 'Backup zone', 'Zona de respaldo'))}.</b> ${A.esc(backup.name || '')}, ${Le('about ' + bkMi + ' mi away.', 'a unos ' + bkMi + ' mi.')} ${backup.why ? Le(backup.why.en, backup.why.es) : ''} ${U.srcTag('census')}</p>
          <button type="button" class="btn btn--ghost btn--sm now-brief__show" data-now="backup">${ic('target', 14)}${Le('Show on the map', 'Ver en el mapa')}</button></div></li>
      </ol>`, 'pane now-briefpane');

    /* ======== RIGHT: the ranked zones ======== */
    const zl = ctx.el('right', `
      <p class="sec now-zl__sec"><span data-now="zlh">${ZL_H()}</span> <span class="sec__meta">${U.srcTag('engine')}</span></p>
      <ol class="now-zl" role="list">${ZONES.map((z) => rowHtml(z, S)).join('')}</ol>`, 'pane pane--tight now-zlpane');
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
      <svg class="now-day__leads" aria-hidden="true">${plan.map((s) => `<path class="now-lead now-lead--${s.id}"/>`).join('')}</svg>
      <ol class="now-steps">${plan.map((s) => `
        <li class="now-step" data-state="${s.state}" data-step="${s.id}" tabindex="0" data-tip="${A.esc(s.d.en)}" data-tip-es="${A.esc(s.d.es)}">
          <span class="now-step__t">${s.time}</span>
          <span class="now-step__h">${s.title}</span>
          <span class="now-step__d now-step__d--s">${Le(s.s.en, s.s.es)}${s.src ? ' ' + s.src : ''}</span>
          <span class="now-step__d now-step__d--l">${Le(s.d.en, s.d.es)}${s.src ? ' ' + s.src : ''}</span></li>`).join('')}</ol>`, 'pane pane--tight now-plan');

    Object.assign(v.el, { hero, stats, brief, zl, list, rowEls, dock,
      segs: A.$$('.now-day__seg', dock), steps: A.$$('.now-step', dock), leads: dock.querySelector('.now-day__leads'), leadPaths: A.$$('.now-lead', dock) });

    /* ======== MAP ======== */
    ctx.layer({ id: 'now-route', z: 112, draw2d: (c, f) => drawRoute(c, f, S) });
    ctx.layer({
      id: 'now-zones', z: 126,
      draw2d: (c, f) => drawZones(c, f, S),
      hit(pt, f) {
        let best = null, bd = 1e9;
        ZONES.forEach((z) => { if (S.app[z.i] < 0.5) return; const q = f.project(z.c), d = Math.hypot(q[0] - pt.x, q[1] - pt.y), r = ringR(f, z, S) + 6; if (d < r && d < bd) { bd = d; best = z; } });
        return best;
      },
      onHover(z) { setHover(v, z.i, 'map'); },
      onClick(z) { select(v, z.i, { from: 'map' }); }
    });
    ctx.layer({ id: 'now-top', z: 210, draw2d: (c, f) => drawTop(c, f, v) });
    const pickPin = A.h(`<button type="button" class="mk-ring mk-ring--pulse now-pick" data-tip="${A.esc(pick.name)}: rank 1" data-tip-es="${A.esc(pick.name)}: n.º 1"><b>1</b></button>`);
    pickPin.addEventListener('click', () => select(v, 0, { from: 'map' }));
    ctx.pin('now-pick', [pick.center.lon, pick.center.lat], pickPin, { minZoom: 7.5 });
    const rkPins = [];
    ZONES.slice(1).forEach((z) => {
      const b = A.h(`<button type="button" class="now-rk" data-h="${A.ui.hailKey(zoneHail(z, S))}" data-tip="${A.esc(z.name)}" data-tip-es="${A.esc(z.name)}">${z.rank}</button>`);
      b.addEventListener('click', () => select(v, z.i, { from: 'map' }));
      b.addEventListener('pointerenter', () => setHover(v, z.i, 'map'));
      b.addEventListener('pointerleave', () => setHover(v, -1, 'map'));
      ctx.pin('now-rk-' + z.rank, z.c, b, { minZoom: z.town === TOWN ? 11.7 : 8 });
      rkPins[z.i] = b;
    });
    // one hail number on the map, and it says whose it is: the pick's radar estimate. The other zones only have the
    // smoothed area model, shown (and labeled) in their own rows.
    const cluster = ctx.pin('now-cluster', [pick.center.lon, pick.center.lat], A.h(`<div class="mk-label now-cluster" data-tip="#1 has its own radar estimate (MRMS at the zone). The other ${colZ.length - 1} zones only have the smoothed area model; open a row to see it." data-tip-es="La n.º 1 tiene su propio estimado de radar (MRMS en la zona). Las otras ${colZ.length - 1} zonas solo tienen el modelo suavizado del área; abre una fila para verlo."><b>${Le(colZ.length + ' zones', colZ.length + ' zonas')}</b><span class="t-mono">${A.both((l) => F.date(pick.storm_day, 'short', l))} · #1 ${A.both((l) => F.inches(pick.hail_in, 2, l))}</span>${U.srcTag('mrms')}</div>`), { anchor: 'none', offset: [-18, 26], maxZoom: 11.6 });
    ctx.pin('now-hq', hq, A.h(`<div class="now-hq">${ic('home', 13)}<span>HMP</span></div>`), { anchor: 'top', offset: [0, 11], minZoom: 8 });
    ticks.forEach((t, k) => {
      const node = A.h(`<div class="now-tick"><b>${F.num(t.mile, 0)} mi</b><span>${t.min} min</span></div>`);
      ctx.pin('now-tick-' + k, t.at.p, node, { anchor: 'top', offset: [0, 12], minZoom: 8.6, maxZoom: 13.5 });
      t.node = node;
    });
    Object.assign(v.el, { pickPin, rkPins, cluster });

    /* ======== wiring ======== */
    hero.querySelector('[data-now="walk"]').addEventListener('click', () => A.view.go('knock'));
    const drvBtn = hero.querySelector('[data-now="drive"]');
    drvBtn.addEventListener('click', () => drive(v, true));
    drvBtn.addEventListener('pointerenter', () => { if (!(S.tl && S.tl.playing)) drive(v, false); });
    brief.querySelector('[data-now="backup"]').addEventListener('click', () => { const i = ZONES.findIndex((z) => z.id === backup.zone_id); select(v, i >= 0 ? i : NZ - 1, { from: 'brief' }); });
    const drvStep = dock.querySelector('[data-step="drive"]'); if (drvStep) drvStep.addEventListener('pointerenter', () => { if (!(S.tl && S.tl.playing)) drive(v, false); });
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b) { e.stopPropagation(); if (b.dataset.act === 'walk') A.view.go('knock'); else if (b.dataset.act === 'back') deselect(v); return; }
      const r = e.target.closest('.now-z__row'); if (!r) return;
      const i = +r.parentElement.dataset.i; if (S.sel === i) deselect(v); else select(v, i, { from: 'list' });
    });
    list.addEventListener('pointerover', (e) => { const li = e.target.closest('.now-z'); if (li) setHover(v, +li.dataset.i, 'list'); });
    list.addEventListener('pointerleave', () => setHover(v, -1, 'list'));
    list.addEventListener('focusin', (e) => { const li = e.target.closest('.now-z'); if (li) setHover(v, +li.dataset.i, 'list'); });
    ctx.on('map:hover', (d) => { if (!d || d.layer !== 'now-zones') { if (S.hoverFrom === 'map') setHover(v, -1, 'map'); } });
    ctx.on('escape', () => {
      if (S.tl && S.tl.playing) { S.skipBy = 'esc'; S.tl.skip(); return; }
      if (S.sel >= 0) { deselect(v); return; }
      if (S.car) stopCar(v, true);
    });
    // the entrance only stops on intent: a press or wheel on the map, or a map key. Hover just highlights.
    const skipOnIntent = () => { if (S.tl && S.tl.playing) { S.skipBy = 'map'; S.tl.skip(); } };
    const wEl = A.world && A.world.el;
    if (wEl) {
      wEl.addEventListener('pointerdown', skipOnIntent, { passive: true }); wEl.addEventListener('wheel', skipOnIntent, { passive: true });
      ctx.own(() => { wEl.removeEventListener('pointerdown', skipOnIntent); wEl.removeEventListener('wheel', skipOnIntent); });
    }
    const onKey = (e) => { if (/^(Arrow|\+|-|=|0$)/.test(e.key) && !(e.target && e.target.closest && e.target.closest('input,textarea,select'))) skipOnIntent(); };
    addEventListener('keydown', onKey); ctx.own(() => removeEventListener('keydown', onKey));
    ctx.on('lang', () => { if (S.sel >= 0) fillMore(v, S.sel); A.world.invalidate('top'); });
    ctx.on('theme', () => A.world.invalidate('top'));
    // the plan's connectors follow the real card positions
    const leadsNow = () => A.safe('now leads', () => drawLeads(v));
    if (window.ResizeObserver) { const ro = new ResizeObserver(leadsNow); ro.observe(dock); ctx.own(() => ro.disconnect()); }
    requestAnimationFrame(leadsNow);
    ctx.own(() => {
      if (S.tl) { const t = S.tl; S.tl = null; t.stop(); }
      stopCar(v, false);
      [S.pulseTw, S.lpulseTw, S.carATw].forEach((t) => t && t.cancel && t.cancel());
    });

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
  function rowHtml(z, S) {
    const h = zoneHail(z, S), pk = z.i === 0, st = stormOf(z.area_id), every = z.kind === 'everyday';
    return `<li class="now-z${pk ? ' now-z--pick' : ''}${every ? ' now-z--every' : ''}" data-i="${z.i}">
      <button type="button" class="row now-z__row" aria-expanded="false">
        <span class="row__lead row__lead--ring now-z__rk" data-h="${A.ui.hailKey(h)}"><b class="now-z__n">${z.rank}</b></span>
        <span class="row__main"><span class="row__t">${A.esc(z.street)}</span>
          <span class="row__s">${z.town !== TOWN ? A.esc(z.town) + ' · ' : ''}${every ? Le('everyday zone', 'zona de todos los días') : (st ? A.both((l) => A.fmt.date(st.date, 'short', l)) + ' · ' : '') + Lx(cp('now.zones.homes', '{n} homes', '{n} casas'), { n: z.homes })}</span></span>
        ${every ? `<span class="row__trail now-z__ev" data-tip="Everyday score: older, owner-lived homes, no recent storm. A different scale from storm zones, so it ranks after them." data-tip-es="Puntaje de todos los días: casas viejas habitadas por sus dueños, sin tormenta reciente. Es otra escala que la de las zonas de tormenta, por eso va después."><span class="now-z__sc num">${A.fmt.num(z.score, 1)}</span><span class="now-z__evl now-meta">${Le('other scale', 'otra escala')}</span></span>`
        : `<span class="row__trail"><span class="now-z__sc num">${A.fmt.num(z.score, 1)}</span><span class="now-z__bar"><i style="transform:scaleX(${(z.score / 100).toFixed(3)})"></i></span></span>`}
      </button>
      <div class="now-z__more" hidden></div></li>`;
  }

  /** hail at a zone: the pick's own radar estimate, else the smoothed area model (labeled as such wherever shown) */
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
    const F = A.fmt;
    const steps = Array.isArray(COPY.now && COPY.now.plan && COPY.now.plan.steps) ? COPY.now.plan.steps : [];
    const by = (id) => steps.find((s) => s.id === id) || {};
    const T = (id, k, en, es) => { const s = by(id)[k]; return s && s.en ? s : { en, es }; };
    const now = toMin(A.story.time), addr = (pick.start && pick.start.address) || '';
    const out = [
      { id: 'brief', a: now, b: now + 20, time: A.both((l) => F.time(A.story.time, l)),
        title: Lx(T('brief', 'title', 'Brief ready', 'Resumen listo')),
        s: { en: 'All up to date', es: 'Todo al día' },
        d: T('brief', 'detail', 'Storms, zones and the pick are up to date.', 'Tormentas, zonas y la elección del día, al día.') },
      { id: 'followups', a: 9 * 60, b: 10 * 60, time: A.both((l) => F.time('09:00', l)),
        title: Lx(T('followups', 'title', 'Follow-ups', 'Seguimientos')),
        s: { en: 'None yet', es: 'Ninguno aún' },
        d: { en: 'None waiting yet. Come-backs from your walks land here.', es: 'Ninguno pendiente todavía. Aquí llegan las puertas que pidan que regreses.' } },
      { id: 'prep', a: 13 * 60, b: 14 * 60, time: A.both((l) => F.time('13:00', l)),
        title: Le('Prep door cards', 'Prepara tarjetas'),
        s: { en: pick.doors + ' cards + cancel forms EN/ES', es: pick.doors + ' tarjetas + formularios EN/ES' }, src: A.ui.srcTag('law'),
        d: { en: pick.doors + ' door cards. 3-day cancel forms in English and Spanish, one for every sale.', es: pick.doors + ' tarjetas de puerta. Formularios de cancelación de 3 días en inglés y español, uno por cada venta.' } },
      { id: 'drive', a: toMin(leaveAt), b: toMin(leaveAt) + routeMin, time: A.both((l) => F.time(leaveAt, l)),
        title: Le('Leave for ' + TOWN, 'Sal rumbo a ' + TOWN),
        s: { en: routeMiles + ' mi · ' + routeMin + ' min', es: routeMiles + ' mi · ' + routeMin + ' min' },
        d: { en: routeMiles + ' mi on ' + hwy + ', about ' + routeMin + ' min. Arrive 10 min early to park.', es: routeMiles + ' mi por la ' + hwy + ', unos ' + routeMin + ' min. Llega 10 min antes para estacionarte.' } },
      { id: 'knock', a: toMin(knockStart), b: toMin(knockEnd), time: A.both((l) => F.range(knockStart, knockEnd, l)),
        title: Lx(T('knock', 'title', 'Knock {n} doors', 'Toca {n} puertas'), { n: pick.doors }),
        s: { en: 'Start at ' + addr, es: 'Empieza en ' + addr }, src: A.ui.srcTag('engine'),
        d: { en: 'Start at ' + addr + '. The hours when most people are home.', es: 'Empieza en ' + addr + '. Las horas en que más gente está en casa.' } }
    ];
    out.forEach((s, i) => { s.state = i === 0 ? 'now' : i === 1 ? 'next' : 'later'; });
    return out;
  }
  /** elbow connectors from each day-bar segment down to its card, from the real positions */
  function drawLeads(v) {
    const svg = v.el.leads; if (!svg || !svg.isConnected) return;
    const sr = svg.getBoundingClientRect(); if (sr.width < 20 || sr.height < 4) return;
    const H = sr.height, m = Math.round(H * 0.45) + 0.5, n = (x) => x.toFixed(1);
    svg.setAttribute('viewBox', '0 0 ' + n(sr.width) + ' ' + n(H));
    v.el.leadPaths.forEach((p, i) => {
      const a = v.el.segs[i] && v.el.segs[i].getBoundingClientRect(), b = v.el.steps[i] && v.el.steps[i].getBoundingClientRect(); if (!a || !b) return;
      const x0 = Math.round(a.left + a.width / 2 - sr.left) + 0.5, x1 = Math.round(b.left + Math.min(22, b.width / 2) - sr.left) + 0.5, dx = x1 - x0;
      const r = Math.min(5, Math.abs(dx) / 2), s = Math.sign(dx);
      p.setAttribute('d', Math.abs(dx) < 2 ? 'M' + n(x0) + ' 0V' + n(H)
        : 'M' + n(x0) + ' 0V' + n(m - r) + 'Q' + n(x0) + ' ' + n(m) + ' ' + n(x0 + s * r) + ' ' + n(m) + 'H' + n(x1 - s * r) + 'Q' + n(x1) + ' ' + n(m) + ' ' + n(x1) + ' ' + n(m + r) + 'V' + n(H));
    });
  }

  /* ---------- map drawing ---------- */
  function ringR(f, z, S) { return A.clamp(0.26 * f.pxPerMile, 4.5, 44) * (S && z.i === S.lead ? 1.25 : 1); }
  function drawZones(c, f, S) {
    const dark = f.theme !== 'light';
    // the pick's walk, once the camera is close enough to read streets
    if (f.zoom > 13.2 && N.walk && N.walk.s && S.app[0] > 0.99 && S.lead === 0) {
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = rgba('--acc', 0.85); c.lineWidth = A.clamp((f.zoom - 12.5) * 1.6, 2, 5);
      N.walk.s.forEach((s) => { c.beginPath(); s.p.forEach((p, k) => { const q = f.project(p); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.stroke(); });
    }
    // the leader (the pick, or the best so far while Aldaba scores) is drawn last, on top
    const order = ZONES.filter((z) => z.i !== S.lead).reverse(); if (S.lead >= 0 && ZONES[S.lead]) order.push(ZONES[S.lead]);
    const tokOf = (z) => (z.i === S.lead ? '--acc' : A.ui.hailTok(zoneHail(z, S)));
    // glow pass (adds up where zones cluster: the swath reads as heat)
    c.save(); if (dark) c.globalCompositeOperation = 'lighter';
    for (const z of order) {
      const a = S.app[z.i]; if (a <= 0.01) continue;
      const q = f.project(z.c); if (q[0] < -120 || q[1] < -120 || q[0] > f.w + 120 || q[1] > f.h + 120) continue;
      const r = ringR(f, z, S) * 2.8, tok = tokOf(z);
      const g = c.createRadialGradient(q[0], q[1], 0, q[0], q[1], r);
      g.addColorStop(0, rgba(tok, (dark ? 0.34 : 0.2) * A.clamp(a, 0, 1))); g.addColorStop(1, rgba(tok, 0));
      c.fillStyle = g; c.beginPath(); c.arc(q[0], q[1], r, 0, TAU); c.fill();
    }
    c.restore();
    // rings
    for (const z of order) {
      const a = S.app[z.i]; if (a <= 0.01) continue;
      const q = f.project(z.c); if (q[0] < -60 || q[1] < -60 || q[0] > f.w + 60 || q[1] > f.h + 60) continue;
      const land = A.clamp(a, 0, 1.2);                                   // spring overshoot comes in as >1 then settles
      const base = ringR(f, z, S), r = base * (1 + (1 - land) * 1.6), hot = S.hover === z.i || S.sel === z.i;
      const tok = tokOf(z);
      c.globalAlpha = f.alpha * A.clamp(a * 1.4, 0, 1);
      c.fillStyle = rgba('--page', hot ? 0.55 : 0.28); c.beginPath(); c.arc(q[0], q[1], r, 0, TAU); c.fill();
      c.strokeStyle = rgba(tok, 1); c.lineWidth = (z.i === S.lead ? 2.6 : 1.6) + (hot ? 1.4 : 0);
      c.beginPath(); c.arc(q[0], q[1], r, 0, TAU); c.stroke();
      if (hot) { c.strokeStyle = rgba(tok, 0.5); c.lineWidth = 1; c.beginPath(); c.arc(q[0], q[1], r + 5, 0, TAU); c.stroke(); }
      for (const P of [S.pulse, S.lpulse]) {
        if (!P || P.i !== z.i) continue;
        const p = P.p; c.strokeStyle = rgba(tok, (1 - p) * 0.9); c.lineWidth = 2 * (1 - p) + 0.6;
        c.beginPath(); c.arc(q[0], q[1], r + 4 + p * Math.max(26, r * 1.6), 0, TAU); c.stroke();
      }
      c.globalAlpha = f.alpha;
    }
  }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function pill(c, f, txt, cx, y, o) {
    c.font = font('600', 11.5, '--mono', 'monospace');
    const w = c.measureText(txt).width + 18, h = 24;
    const x = A.clamp(cx - (o && o.left ? 0 : w / 2), 6, f.w - w - 6), yy = A.clamp(y, 6, f.h - h - 6);
    c.fillStyle = rgba('--panel', 0.97); c.strokeStyle = rgba(o && o.acc ? '--acc-line' : '--rule-3', 1); c.lineWidth = 1;
    roundRect(c, x + 0.5, yy + 0.5, w, h, 7); c.fill(); c.stroke();
    c.fillStyle = rgba('--text', 1); c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText(txt, x + 9.5, yy + 13);
  }
  /** above the world's labels: the hover name tag and the preview car (drawn in the same frame as its trail) */
  function drawTop(c, f, v) {
    const S = v.S;
    const hi = S.hover;
    if (hi >= 0 && f.zoom < 11.7 && S.app[hi] > 0.5 && ZONES[hi]) {
      const z = ZONES[hi], q = f.project(z.c), r = ringR(f, z, S);
      pill(c, f, '#' + z.rank + '  ' + z.street, q[0] + r + 10, q[1] - 12, { left: true });
    }
    if (S.carAt && S.carA > 0.01) {
      const q = f.project(S.carAt.p), h = (S.carAt.heading || 0) * Math.PI / 180, dx = Math.sin(h), dy = -Math.cos(h), nx = -dy, ny = dx;
      const k = S.carA, s = 0.6 + 0.4 * k;
      c.globalAlpha = f.alpha * k;
      const g = c.createRadialGradient(q[0], q[1], 0, q[0], q[1], 26);
      g.addColorStop(0, rgba('--acc', 0.5)); g.addColorStop(1, rgba('--acc', 0));
      c.fillStyle = g; c.beginPath(); c.arc(q[0], q[1], 26, 0, TAU); c.fill();
      c.fillStyle = rgba('--acc', 1); c.strokeStyle = rgba('--panel', 1); c.lineWidth = 2.2;
      c.beginPath(); c.arc(q[0], q[1], 9 * s, 0, TAU); c.fill(); c.stroke();
      // the heading: a small arrow pointing down the road
      const P = (a, b) => [q[0] + (dx * a + nx * b) * s, q[1] + (dy * a + ny * b) * s];
      const p1 = P(5.4, 0), p2 = P(-3.8, 4.2), p3 = P(-1.6, 0), p4 = P(-3.8, -4.2);
      c.fillStyle = rgba('--on-acc', 1); c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.lineTo(p3[0], p3[1]); c.lineTo(p4[0], p4[1]); c.closePath(); c.fill();
      // mile and minute, above the road (the town ticks sit below it)
      pill(c, f, A.fmt.num(S.carAt.mile, 0) + ' mi · ' + S.carMin + ' min', q[0], q[1] - 44, { acc: true });
      c.globalAlpha = f.alpha;
    }
  }

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
    if (S.carAt && S.carF > 0) {
      const tp = Rt.trail(ROUTE, S.carF);
      if (tp && tp.length > 1) {
        c.globalAlpha = f.alpha * S.carA;
        c.beginPath(); tp.forEach((p, k) => { const q = f.project(p); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); });
        c.strokeStyle = rgba('--text', 0.92); c.lineWidth = 2.8; c.stroke();
        c.globalAlpha = f.alpha;
      }
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
    c.beginPath(); c.arc(s0[0], s0[1], 4.5, 0, TAU); c.fill(); c.stroke();
    // the drawing head while the route writes itself
    if (S.routeP < 0.999) {
      const q = f.project(pts[pts.length - 1]);
      const g = c.createRadialGradient(q[0], q[1], 0, q[0], q[1], 16);
      g.addColorStop(0, rgba('--acc', 0.8)); g.addColorStop(1, rgba('--acc', 0));
      c.fillStyle = g; c.beginPath(); c.arc(q[0], q[1], 16, 0, TAU); c.fill();
      c.fillStyle = rgba('--text', 1); c.beginPath(); c.arc(q[0], q[1], 2.6, 0, TAU); c.fill();
    }
  }

  /* ---------- hover, select ---------- */
  function setHover(v, i, from) {
    if (!v || V !== v) return; const S = v.S;
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
    tw.then((ok) => { if (ok && V === v && S.hover === i && S.pulseTw === tw) pulseLoop(v, i); else if (S.pulse && S.pulse.i === i && S.hover !== i) { S.pulse = null; A.world.invalidate('top'); } });
  }
  function leadPulse(v, i) {
    const S = v.S; if (S.lpulseTw) S.lpulseTw.cancel();
    S.lpulse = { i, p: 0 };
    const tw = (S.lpulseTw = A.motion.tween({ from: 0, to: 1, ms: 900, ease: E.outCubic, update: (p) => { if (S.lpulse) S.lpulse.p = p; A.world.invalidate('top'); } }));
    tw.then(() => { if (S.lpulseTw === tw) { S.lpulse = null; S.lpulseTw = null; A.world.invalidate('top'); } });
  }

  function select(v, i, o = {}) {
    if (!v || V !== v || i < 0 || !ZONES[i]) return;
    const S = v.S, z = ZONES[i];
    if (S.tl && S.tl.playing) { S.skipBy = 'select'; S.tl.skip(); }
    const was = S.sel; S.sel = i;
    v.el.rowEls.forEach((li, k) => {
      if (!li) return;
      const on = k === i, btn = li.querySelector('.now-z__row'), more = li.querySelector('.now-z__more');
      btn.setAttribute('aria-expanded', String(on)); li.classList.toggle('is-open', on);
      if (on) btn.setAttribute('aria-current', 'true'); else btn.removeAttribute('aria-current');
      if (!on && !more.hidden) more.hidden = true;
    });
    fillMore(v, i);
    const li = v.el.rowEls[i], more = li.querySelector('.now-z__more');
    more.hidden = false;
    A.view.relayout();                                      // the panel grew: the map's focus and HUD move with it
    if (was !== i) A.motion.reveal(more, { y: 6, ms: 420 });
    if (o.from !== 'list') A.safe('now scroll', () => li.scrollIntoView({ block: 'nearest', behavior: A.still ? 'auto' : 'smooth' }));
    const zoom = i === 0 ? 15.2 : z.town === TOWN ? 14.4 : 13.8;
    A.world.flyTo({ center: z.c, zoom }, { instant: A.still });
    setHover(v, -1, o.from);
    if (!A.still) { S.pulse = null; pulseOnce(v, i); }
    A.world.invalidate('top');
  }
  function pulseOnce(v, i) {
    const S = v.S; S.pulse = { i, p: 0 };
    A.motion.tween({ from: 0, to: 1, ms: 1200, delay: 500, ease: E.outCubic, update: (p) => { if (S.pulse && S.pulse.i === i) { S.pulse.p = p; A.world.invalidate('top'); } } })
      .then(() => { if (S.pulse && S.pulse.i === i && S.hover !== i) { S.pulse = null; A.world.invalidate('top'); } });
  }
  function collapse(v) {
    const S = v.S; if (S.sel < 0) return;
    const li = v.el.rowEls[S.sel];
    if (li) { li.classList.remove('is-open'); const b = li.querySelector('.now-z__row'); b.setAttribute('aria-expanded', 'false'); b.removeAttribute('aria-current'); li.querySelector('.now-z__more').hidden = true; }
    S.sel = -1;
    const b0 = v.el.rowEls[0] && v.el.rowEls[0].querySelector('.now-z__row'); if (b0 && S.lead === 0) b0.setAttribute('aria-current', 'true');
    A.view.relayout();
    A.world.invalidate('top');
  }
  function deselect(v) {
    if (!v || V !== v || v.S.sel < 0) return;
    collapse(v);
    A.view.recenter();
  }
  function fillMore(v, i) {
    const z = ZONES[i], F = A.fmt, U = A.ui, S = v.S;
    const more = v.el.rowEls[i] && v.el.rowEls[i].querySelector('.now-z__more'); if (!more) return;
    const h = zoneHail(z, S), a = AREA[z.area_id], lvl = insuredLevel(a), st = stormOf(z.area_id);
    const straight = miBetween(hq, z.c);
    const rows = [];
    if (h != null) rows.push([Le('Hail', 'Granizo'), z.i === 0
      ? A.both((l) => F.inches(h, 2, l)) + ' <span class="t-muted">' + Le('radar estimate at the zone', 'estimado del radar en la zona') + '</span> ' + U.srcTag('mrms')
      : '~' + A.both((l) => F.inches(h, 2, l)) + ' <span class="t-muted">' + Le('area model, not a reading here', 'modelo del área, no una lectura aquí') + '</span> ' + U.srcTag({ label: 'model', tip: { en: 'The smoothed hail model of the whole ' + (st ? F.date(st.date, 'short', 'en') + ' ' : '') + 'storm area, from NOAA SPC reports and MRMS radar swaths. Only #1 has its own radar estimate (' + F.inches(pick.hail_in, 2, 'en') + ').', es: 'El modelo suavizado de granizo de toda el área de la tormenta' + (st ? ' del ' + F.date(st.date, 'short', 'es') : '') + ', con reportes de NOAA SPC y franjas de radar MRMS. Solo la n.º 1 tiene su propio estimado de radar (' + F.inches(pick.hail_in, 2, 'es') + ').' } })]);
    if (st) rows.push([Le('Storm', 'Tormenta'), A.both((l) => F.date(st.date, 'day', l)) + ' ' + U.srcTag('spc')]);
    else rows.push([Le('Kind', 'Tipo'), Lx(cp('now.zones.everyday', 'Everyday zone: older homes, no recent storm', 'Zona de todos los días: casas viejas, sin tormenta reciente'))]);
    rows.push([Le('Homes', 'Casas'), F.int(z.homes) + ' ' + U.srcTag('engine')]);
    rows.push([Le('Score', 'Puntaje'), F.num(z.score, 1) + (z.kind === 'everyday' ? ' <span class="t-muted">' + Le('other scale', 'otra escala') + '</span>' : '') + ' ' + U.srcTag('engine')]);
    rows.push([Le('From HMP', 'Desde HMP'), i === 0 ? Le(routeMiles + ' mi drive, about ' + routeMin + ' min', routeMiles + ' mi de camino, unos ' + routeMin + ' min') : Le(F.num(straight, 1, 'en') + ' mi straight line', F.num(straight, 1, 'es') + ' mi en línea recta')]);
    if (lvl) rows.push([Lx(cp('now.likelyInsured.label', 'Likely insured', 'Probablemente asegurado')), Le(lvl.en, lvl.es) + ' <span class="t-muted">' + Lx(cp('now.likelyInsured.tag', 'area estimate', 'estimado del área')) + '</span> ' + U.srcTag('census')]);
    if (z.i === 0 && pick.why) rows.push([Le('Why', 'Por qué'), Le(pick.why.en, pick.why.es)]);
    if (z.id === backup.zone_id && backup.why) rows.push([Le('Why', 'Por qué'), Le(backup.why.en, backup.why.es)]);
    more.innerHTML = `<dl class="kv now-z__kv">${rows.map((r) => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('')}</dl>
      <div class="now-z__act">${z.i === 0 ? `<button type="button" class="btn btn--primary btn--sm" data-act="walk">${ic('door', 14)}${Lx(cp('now.actions.startWalk', 'Start the walk', 'Empezar la ruta'))}</button>` : ''}
        <button type="button" class="btn btn--ghost btn--sm" data-act="back">${ic('arrow', 14)}${Le('Back to the plan', 'Volver al plan')} <span class="kbd">Esc</span></button></div>`;
  }

  /* ---------- the drive preview: a car on the real route, drawn in the same canvas frame as its trail ---------- */
  function carFade(v, to, ms) {
    const S = v.S; if (S.carATw) S.carATw.cancel();
    const tw = (S.carATw = A.motion.tween({ from: S.carA, to, ms, ease: E.outCubic, update: (x) => { S.carA = x; A.world.invalidate('top'); } }));
    return tw;
  }
  function drive(v, force) {
    if (!v || V !== v || !ROUTE) return; const S = v.S;
    if (S.car && !force) return;
    if (S.tl && S.tl.playing) { S.skipBy = 'drive'; S.tl.skip(); }
    if (force) { if (S.sel >= 0) collapse(v); A.view.recenter(); }       // a click shows the whole drive
    stopCar(v, false);
    const passed = (f) => ticks.forEach((tk) => tk.node && tk.node.classList.toggle('is-passed', f > tk.f + 0.004));
    if (v.el.cluster) v.el.cluster.classList.add('is-dim');
    carFade(v, 1, 220);
    const tw = (S.car = A.motion.tween({ from: 0, to: 1, ms: 4200, ease: E.inOutSine, update: (t) => {
      if (S.car !== tw) return;
      const at = Rt.atTime(ROUTE, t);
      S.carAt = at; S.carF = at.mile / ROUTE.miles; S.carMin = Math.round(Rt.minutesAt(ROUTE, S.carF));
      passed(S.carF);
      A.world.invalidate('top');
    } }));
    tw.then((ok) => { if (!ok || V !== v || S.car !== tw) return; v.ctx.timer(() => { if (S.car === tw) stopCar(v, true); }, 1500); });
  }
  function stopCar(v, fade) {
    const S = v.S, tw = S.car;
    S.car = null;
    if (tw && tw.cancel) tw.cancel();
    ticks.forEach((tk) => tk.node && tk.node.classList.remove('is-passed'));
    if (v.el.cluster) v.el.cluster.classList.remove('is-dim');
    const clear = () => { if (!S.car) { S.carAt = null; S.carF = 0; A.world.invalidate('top'); } };
    if (fade && S.carAt && !A.still) carFade(v, 0, 320).then(clear);
    else { if (S.carATw) S.carATw.cancel(); S.carA = 0; clear(); }
  }

  /* ---------- states + the assemble timeline ---------- */
  function setRowOrder(v, arr) {
    const L = v.el.list;
    arr.forEach((z, k) => { const li = v.el.rowEls[z.i]; if (li && L.children[k] !== li) L.insertBefore(li, L.children[k] || null); });
  }
  function pendAll(v, on) {
    const el = v.el, set = (e) => e && e.classList.toggle('is-pending', on);
    A.$$('[data-pend]', el.hero).forEach(set);
    A.$$('[data-pend]', el.brief).forEach(set);
    set(el.stats);
    el.steps.forEach(set); el.segs.forEach(set); el.leadPaths.forEach(set);
    set(el.dock.querySelector('.now-day__now'));
    ticks.forEach((t) => set(t.node));
    set(el.pickPin); set(el.cluster);
    el.rkPins.forEach(set);
    el.rowEls.forEach(set);
  }
  function preState(v) {
    const S = v.S, el = v.el;
    collapse(v);
    S.app = ZONES.map(() => 0); S.routeP = 0; S.lead = -1; S.best = -1; S.lpulse = null;
    setRowOrder(v, SCAN);
    el.list.classList.add('is-scan');
    el.rowEls.forEach((li) => { li.classList.remove('is-lead', 'now-z--pick'); li.querySelector('.now-z__row').removeAttribute('aria-current'); });
    pendAll(v, true);
    el.hero.classList.add('is-waiting');
    const t = (k, s) => { const e = el.hero.querySelector('[data-now="' + k + '"]'); if (e) e.textContent = s; };
    t('scored', '0/' + NZ); t('cand', ''); t('candsc', ''); t('best', ''); t('bestsc', '');
    A.$$('.now-hero__axd', el.hero).forEach((d) => d.classList.remove('is-in', 'is-lead'));
    const zh = el.zl.querySelector('[data-now="zlh"]'); if (zh) zh.innerHTML = Le('Scoring zones', 'Calificando zonas');
    A.world.invalidate('top');
  }
  function finalState(v) {
    const S = v.S, el = v.el;
    S.app = ZONES.map(() => 1); S.routeP = 1; S.lead = 0; S.lpulse = null;
    setRowOrder(v, ZONES);
    el.list.classList.remove('is-scan');
    el.rowEls.forEach((li, k) => { li.classList.remove('is-lead'); li.classList.toggle('now-z--pick', k === 0); });
    pendAll(v, false);
    el.hero.classList.remove('is-waiting');
    const b0 = el.rowEls[0] && el.rowEls[0].querySelector('.now-z__row'); if (b0 && S.sel < 0) b0.setAttribute('aria-current', 'true');
    const zh = el.zl.querySelector('[data-now="zlh"]'); if (zh) zh.innerHTML = ZL_H();
    A.world.invalidate('top');
  }

  /** The pick assembles. Puts the view in its before-state now; returns the Timeline (call .play()). */
  function assemble(ctx) {
    const v = V && (!ctx || V.ctx === ctx || ctx === A.view.ctx) ? V : null;
    if (!v || !v.ctx.alive()) return null;
    const S = v.S, el = v.el;
    if (S.tl) { const old = S.tl; S.tl = null; old.stop(); }
    stopCar(v, false);
    preState(v);
    S.skipBy = null;
    const tl = new A.motion.Timeline();
    S.tl = tl;
    const EACH = 140, LAND = 620, Z0 = 380, nS = SCAN.length;
    const live = () => V === v && v.ctx.alive();
    const alive = () => live() && S.tl === tl;
    const q = (root, k) => root.querySelector('[data-now="' + k + '"]');
    const snd = () => (window.Sound && window.Sound.enabled ? window.Sound : null);
    // a text that changes many times a second only slides up a little; it never fades out
    const tick = (e, y) => { if (!e || !e.animate) return; try { e.animate([{ translate: '0 ' + y + 'px', opacity: 0.6 }, { translate: '0 0', opacity: 1 }], { duration: 220, easing: A.motion.css.out }); } catch (err) { /* ignore */ } };

    // 1. drop into the swath where the zones are
    tl.add(0, (t, o) => { if (!o.seeking && alive() && colPts.length) A.world.flyTo({ points: colPts, pad: A.stacked() ? 36 : 90, maxZoom: 13.4 }, { ms: 1250 }); });
    // 2. Aldaba scores the zones one by one: each ring lands as its row arrives, and the orange passes to every new best
    const SPAN = EACH * (nS - 1) + LAND;
    tl.add(Z0, { ms: SPAN, ease: E.linear, update: (p, raw) => {
      if (!alive()) return; const tt = raw * SPAN;
      SCAN.forEach((z, k) => { const x = A.clamp((tt - k * EACH) / LAND, 0, 1); S.app[z.i] = x <= 0 ? 0 : x >= 1 ? 1 : E.hail(x); });
      A.world.invalidate('top');
    } });
    SCAN.forEach((z, k) => tl.add(Z0 + k * EACH, (t, o) => {
      if (!alive()) return;
      const li = el.rowEls[z.i]; li.classList.remove('is-pending');
      q(el.hero, 'scored').textContent = (k + 1) + '/' + NZ;
      const every = z.kind === 'everyday';
      q(el.hero, 'cand').textContent = z.street;
      q(el.hero, 'candsc').innerHTML = every ? Le('other scale', 'otra escala') : A.esc(A.fmt.num(z.score, 1));
      const lead = !every && z.score > S.best;
      const dot = el.hero.querySelector('.now-hero__axd[data-i="' + z.i + '"]'); if (dot) dot.classList.add('is-in');
      if (lead) {
        const prev = S.lead; S.best = z.score; S.lead = z.i;
        if (prev >= 0 && el.rowEls[prev]) el.rowEls[prev].classList.remove('is-lead');
        li.classList.add('is-lead');
        A.$$('.now-hero__axd.is-lead', el.hero).forEach((d) => d.classList.remove('is-lead')); if (dot) dot.classList.add('is-lead');
        q(el.hero, 'best').textContent = z.street; q(el.hero, 'bestsc').textContent = A.fmt.num(z.score, 1);
      }
      if (o.seeking) return;
      A.motion.reveal(li, { y: 8, ms: 460 });
      A.motion.countUp(li.querySelector('.now-z__sc'), z.score, { decimals: 1, ms: 700 });
      tick(q(el.hero, 'cand').parentElement, 7);
      if (dot) A.motion.reveal(dot, { y: 16, ms: 520 });
      if (lead) { leadPulse(v, z.i); tick(q(el.hero, 'best').parentElement, 6); if (dot) A.motion.ripple(dot, { rings: 1, size: 34, color: A.tok('--acc') }); }
      const s = snd(); if (s) s.tick({ gain: lead ? 0.7 : 0.4 });
    }));
    // 3. the list sorts itself (FLIP), then the rank numbers land, in the list and on the map
    const TSORT = Z0 + EACH * (nS - 1) + 420;
    tl.add(TSORT, (t, o) => {
      if (!alive()) return;
      const anim = !o.seeking && !A.still;
      const first = new Map(); if (anim) el.rowEls.forEach((li) => first.set(li, li.getBoundingClientRect().top));
      setRowOrder(v, ZONES);
      el.list.classList.remove('is-scan');
      el.rowEls.forEach((li, k) => { li.classList.remove('is-lead'); li.classList.toggle('now-z--pick', k === 0); });
      el.rkPins.forEach((p) => p && p.classList.remove('is-pending'));
      const zh = el.zl.querySelector('[data-now="zlh"]'); if (zh) { zh.innerHTML = ZL_H(); if (anim) A.motion.reveal(zh, { y: 6, ms: 380 }); }
      if (!anim) return;
      el.rowEls.forEach((li) => {
        const dy = first.get(li) - li.getBoundingClientRect().top; if (Math.abs(dy) < 1) return;
        try { li.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }], { duration: 620, easing: A.motion.css.hail }); } catch (e) { /* ignore */ }
      });
      A.motion.stagger(el.rowEls.map((li) => li.querySelector('.now-z__n')), { each: 32, y: 6, ms: 420, delay: 260, scale: 0.6 });
      A.motion.stagger(el.rkPins.filter(Boolean), { each: 45, y: 10, ms: 480, delay: 200 });
    });
    // 4. the winner lifts into the hero
    const TLIFT = TSORT + 560;
    tl.add(TLIFT, (t, o) => {
      if (!alive()) return;
      const b0 = el.rowEls[0].querySelector('.now-z__row'); if (S.sel < 0) b0.setAttribute('aria-current', 'true');
      const street = q(el.hero, 'street'), townEl = q(el.hero, 'town');
      const from = b0.querySelector('.row__t').getBoundingClientRect();
      A.$$('.is-pending', el.hero).forEach((e) => e.classList.remove('is-pending'));
      el.hero.classList.remove('is-waiting');
      el.pickPin.classList.remove('is-pending');
      if (o.seeking || A.still) return;
      const to = street.getBoundingClientRect();
      const onScreen = (r) => r.bottom > 0 && r.top < innerHeight && r.width > 0;
      if (onScreen(from) && onScreen(to) && !A.stacked()) {
        const s = from.height / Math.max(1, to.height);
        try { street.animate([{ transform: 'translate(' + (from.left - to.left) + 'px,' + (from.top - to.top) + 'px) scale(' + s.toFixed(3) + ')', opacity: 0.4 }, { transform: 'none', opacity: 1 }], { duration: 760, easing: A.motion.css.hail }); } catch (e) { /* ignore */ }
      } else A.motion.reveal(street, { y: 10 });
      A.motion.reveal(townEl, { y: 22, ms: 640, delay: 80 });
      A.motion.stagger(A.$$('.now-hero__line,.now-hero__why,.now-hero__act,.now-hero__rk,.now-hero__score', el.hero), { each: 60, delay: 200, y: 10 });
      A.motion.ripple(el.pickPin, { rings: 2, size: 64 });
      const s = snd(); if (s) s.ring(0, { gain: 0.6 });
    });
    // 5. its numbers roll; the brief lands under them
    tl.add(TLIFT + 240, (t, o) => {
      if (!alive()) return;
      el.stats.classList.remove('is-pending');
      const bk = A.$$('[data-pend].is-pending', el.brief); bk.forEach((e) => e.classList.remove('is-pending'));
      if (o.seeking || A.still) return;
      A.motion.countUp(q(el.stats, 'hail'), pick.hail_in, { decimals: 2, ms: 1000 });
      A.motion.reveal(q(el.stats, 'date'), { y: 8, ms: 520, delay: 60 });
      A.motion.countUp(q(el.stats, 'miles'), routeMiles, { ms: 1000, delay: 120 });
      A.motion.countUp(q(el.hero, 'doors'), pick.doors, { ms: 900, delay: 40 });
      const ins = q(el.stats, 'ins'); if (ins) A.motion.reveal(ins, { y: 6, ms: 480, delay: 200, ring: true, size: 40 });
      A.motion.stagger(bk, { each: 80, y: 10, delay: 260 });
    });
    // 6. pull back to the whole drive while the route writes itself from Fremont
    const TBACK = TLIFT + 520, TROUTE = TBACK + 200, RMS = 1900;
    tl.add(TBACK, (t, o) => {
      if (!alive() || S.sel >= 0) return;
      if (!o.seeking || !/^(map|select|drive)$/.test(S.skipBy || '')) A.view.recenter();
    });
    tl.add(TROUTE, { ms: RMS, ease: E.inOutSine, update: (p) => {
      if (!alive()) return; S.routeP = p;
      ticks.forEach((tk) => { if (tk.node && p >= tk.f && tk.node.classList.contains('is-pending')) { tk.node.classList.remove('is-pending'); if (!A.still && p < 1) A.motion.reveal(tk.node, { y: 6, ms: 380 }); } });
      A.world.invalidate('top');
    } });
    tl.add(TROUTE + RMS - 200, (t, o) => { if (!alive()) return; el.cluster.classList.remove('is-pending'); if (!o.seeking) A.motion.reveal(el.cluster, { y: 6, ms: 420 }); });
    // 7. the day lands, step by step, each with its connector; the "now" needle rings
    el.steps.forEach((st, j) => tl.add(TROUTE + 300 + j * 150, (t, o) => {
      if (!alive()) return;
      [st, el.segs[j], el.leadPaths[j]].forEach((e) => e && e.classList.remove('is-pending'));
      if (!o.seeking) { A.motion.reveal(st, { y: 10, ms: 480 }); if (el.segs[j]) A.motion.reveal(el.segs[j], { y: 0, ms: 360, scale: 0.6 }); }
    }));
    tl.add(TROUTE + 300 + el.steps.length * 150 + 60, (t, o) => {
      if (!alive()) return; const nd = el.dock.querySelector('.now-day__now'); if (!nd) return;
      nd.classList.remove('is-pending'); if (!o.seeking) A.motion.reveal(nd, { y: -6, ring: true, size: 30 });
    });
    tl.add(TROUTE + RMS + 60, () => {});
    tl.onEnd(() => { if (live() && S.tl === tl) { finalState(v); S.tl = null; } });
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

  /* Storms' "Knock this storm" → Now opens that zone (by zone id, or by the hail area it sits in). Storms emits it when
     Now's panels exist; a late event still finds the view. [integration wiring] */
  A.on('zone:focus', (id) => {
    const i = ZONES.findIndex((z) => z.id === id || z.area_id === id);
    if (i < 0) return;
    const go = () => A.safe('now zone focus', () => { if (V && V.ctx.alive()) select(V, i, { from: 'storms' }); });
    if (V) go(); else A.once('view', (d) => { if (d && d.name === 'now') go(); });
  });

  /* The director's handle (js/director.js drives the real view with these; each is a no-op when Now is not on screen).
     [integration wiring] */
  A.nowDemo = {
    get active() { return !!V; },
    /** hover(zoneIndex) highlights a zone like the pointer does (its ring pulses on the map); -1 clears */
    hover(i) { if (V) setHover(V, i, 'list'); },
    /** select(zoneIndex) opens a zone and flies to it, as a click on its row or ring does */
    select(i) { if (V) select(V, i, { from: 'demo' }); },
    /** close the open zone without moving the camera; deselect() also flies back */
    collapse() { if (V) collapse(V); },
    deselect() { if (V) deselect(V); },
    /** the drive preview: a car on the real route */
    drive() { if (V) drive(V, true); },
    /** skip a running entrance to its end state */
    settle() { if (V && V.S.tl && V.S.tl.playing) { V.S.skipBy = 'select'; V.S.tl.skip(); } },
    /** hands off: no hover, no car, nothing open */
    clear() { if (!V) return; setHover(V, -1, 'list'); stopCar(V, false); if (V.S.sel >= 0) collapse(V); },
    state() { return V ? { assembling: !!(V.S.tl && V.S.tl.playing), sel: V.S.sel, hover: V.S.hover, car: !!V.S.car } : null; }
  };
})();
