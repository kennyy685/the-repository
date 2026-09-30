/* Claude's Aldaba · storms.js · #storms: the 2026 season as a playable instrument
   Camera: the whole eastern-Nebraska bbox. Dock: the season Mar 1 - Sep 30 as a timeline (25 real storm days sized and
   colored by hail, the 2024-25 reports as ghost ticks on a thin lane, a playhead you drag, play/pause with Space,
   previous/next storm with the arrow keys, 1x/2x/4x). Scrubbing literally replays the sky: the season's swaths burn in up
   to the playhead (HailGL, arrival 'season'), hail falls and rings out while a storm burns, 2024-25 reports appear as
   ringed points ("Past years"). Left: the selected storm day (dates EN/ES, hail by source, reports, radar cells, towns,
   zones touched → fly there, "Knock this storm" → #now with that zone via 'zone:focus'), then the season summary.
   Center: a live hail legend (reads the field under the cursor) and the radar note. Click the map: nearest swath.
   Entering replays the season fast once (2.5 s, skippable), then rests on the latest storm day with its swath replaying.
   A.stormsDemo = {select(date), play(), pause(), seek(0..1)} for the director.
   Owner: the Storms builder. Only this file + css/storms.css. */
(function () {
  'use strict';
  const A = window.A; if (!A || !A.view) return;
  const N = A.data || {}, X = A.x || {}, S26 = X.storms2026 || {}, HIST = X.hist || {};
  const COPY = (window.COPY && window.COPY.storms) || {};
  const E = A.motion.ease;
  const TAU = Math.PI * 2;
  const cp = (path, en, es) => { let o = COPY; for (const k of path.split('.')) o = o && o[k]; return o && o.en ? o : { en, es }; };
  const Lo = (o) => A.L(A.esc(o.en), A.esc(o.es));
  const Le = (en, es) => A.L(A.esc(en), A.esc(es));
  const sub = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m));
  const sm = (x, a, b) => { const t = A.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const snd = () => { const s = window.Sound; return s && s.enabled ? s : null; };
  const ic = (n, s) => A.ui.icon(n, { size: s || 16 });

  /* ======================= the season, from real data ======================= */
  const Y0 = '2026-03-01', Y1 = '2026-09-30';
  const DAYN = (iso) => A.fmt.daysBetween(Y0, iso);
  const SPAN = DAYN(Y1) + 1;                                      // 214 days on the axis
  const TODAY = DAYN(A.story.today);
  const END = Math.min(SPAN, TODAY + 1);
  const isoOf = (d) => new Date(Date.UTC(2026, 2, 1 + Math.floor(d))).toISOString().slice(0, 10);
  const MONTHS = [3, 4, 5, 6, 7, 8, 9].map((m) => ({ d: DAYN('2026-' + String(m).padStart(2, '0') + '-01'), en: ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'][m - 3], es: ['mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep'][m - 3] }));
  const AREA = {}; (N.areas || []).forEach((a) => (AREA[a.id] = a));
  const areasBySt = {}; (N.areas || []).forEach((a) => (areasBySt[a.st] = areasBySt[a.st] || []).push(a));
  const stormByDate = new Map((N.storms || []).map((s) => [s.date, s]));
  const SD = S26.storm_days || [];
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
  function zoneName(slug) {
    const base = String(slug).replace(/-\d+$/, '');
    let en = base.split('-').map(cap).join(' ').replace(/\bMc(\w)/, (m, c) => 'Mc' + c.toUpperCase()), es = en;
    const near = en.match(/^Rural Area Near (.+)$/);
    if (near) { en = 'Near ' + near[1]; es = 'Cerca de ' + near[1]; }
    return { en, es };
  }
  const DAYS = Array.from(new Set(SD.map((d) => d.date).concat((N.storms || []).map((s) => s.date)))).sort().map((date, i) => {
    const st = stormByDate.get(date) || null, sd = SD.find((d) => d.date === date) || null, mmdd = date.slice(5, 7) + date.slice(8, 10);
    const zmap = new Map();
    (sd ? sd.zones : []).forEach((z) => {
      const slug = String(z).split('~')[1] || String(z), nm = zoneName(slug), area = AREA['z' + mmdd + '-' + slug] || null;
      const g = zmap.get(nm.en) || { name: nm, n: 0, area: null };
      g.n++; if (area && (!g.area || area.hail > g.area.hail)) g.area = area; zmap.set(nm.en, g);
    });
    const zones = Array.from(zmap.values()).sort((a, b) => (b.area ? 1 : 0) - (a.area ? 1 : 0) || (b.area ? b.area.hail : 0) - (a.area ? a.area.hail : 0));
    return {
      i, date, d: DAYN(date), storm: st, sd, max: st ? st.max : sd ? sd.max_in : null, maxSrc: st ? 'storms' : 'lsr',
      rep: sd ? sd.max_in : null, radar: sd && sd.mesh_max_in ? sd.mesh_max_in : null, reports: sd ? sd.reports : null, cells: sd ? sd.radar_cells : null,
      towns: sd ? sd.towns : [], first: sd && sd.first_local, last: sd && sd.last_local, zones, nZones: sd ? sd.zones.length : 0,
      areas: st ? areasBySt[st.id] || [] : []
    };
  });
  const LAST = DAYS[DAYS.length - 1] || null;
  const SEASON_BOUNDS = (() => {
    let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
    (N.storms || []).forEach((s) => (s.path || []).forEach((p) => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }));
    (N.areas || []).forEach((a) => (a.ring || []).forEach((p) => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }));
    return x0 < x1 ? [[x0 - 0.1, y0 - 0.08], [x1 + 0.1, y1 + 0.08]] : A.world.presets.state;
  })();
  const ORD = DAYS.filter((D) => D.storm);                      // the modeled swaths, date order = HailGL 'season' rank
  ORD.forEach((D, k) => (D.rank = k));
  const NS = Math.max(1, ORD.length);
  const revealAt = (p) => { let s = 0; for (const D of ORD) s += A.clamp(p - D.d, 0, 1); return s / NS; };
  const burningAt = (p) => { let b = 0; for (const D of ORD) b = Math.max(b, sm(p, D.d - 0.12, D.d + 0.06) * (1 - sm(p, D.d + 1.05, D.d + 1.5))); return b; };
  const latestAt = (p) => { let L = null; for (const D of DAYS) if (D.d <= p - 0.02) L = D; return L; };
  function speedAt(p) {                                          // days per second: slow over a storm, fast between
    let dist = 1e9, slow = 3;
    for (const D of DAYS) { const dd = p < D.d ? D.d - p : p > D.d + 1 ? p - D.d - 1 : 0; if (dd < dist) { dist = dd; slow = D.storm ? 1.1 : 2.4; } }
    return slow + (26 - slow) * sm(dist, 0.15, 4.5);
  }
  // 2024-25 public reports on the same Mar-Sep axis
  const HPTS = (HIST.pts || []).map((r) => ({ date: r[0], y: r[0].slice(0, 4), d: DAYN('2026' + String(r[0]).slice(4)), ll: [r[2], r[1]], v: r[3] })).filter((h) => h.d >= 0 && h.d < SPAN);
  const HDAYS = (() => { const m = new Map(); HPTS.forEach((h) => { const k = h.y + h.d; const g = m.get(k) || { d: h.d, y: h.y, v: 0, n: 0, date: h.date }; g.v = Math.max(g.v, h.v); g.n++; m.set(k, g); }); return Array.from(m.values()); })();
  // season summary
  const SUM = (() => {
    const rep = SD.reduce((m, d) => (d.max_in > m.v ? { v: d.max_in, dates: [d.date] } : d.max_in === m.v ? { v: m.v, dates: m.dates.concat(d.date) } : m), { v: 0, dates: [] });
    const rad = SD.reduce((m, d) => (d.mesh_max_in > m.v ? { v: d.mesh_max_in, date: d.date } : m), { v: 0, date: null });
    const tc = {}; SD.forEach((d) => d.towns.forEach((t) => (tc[t] = (tc[t] || 0) + 1)));
    const towns = Object.entries(tc).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6);
    return { days: SD.length, swaths: ORD.length, rep, rad, towns, first: DAYS[0] && DAYS[0].date, last: LAST && LAST.date, reports: SD.reduce((s, d) => s + d.reports, 0), cells: SD.reduce((s, d) => s + d.radar_cells, 0) };
  })();
  const srcCount = (id) => ((S26.sources || []).find((s) => s.id === id) || {}).count;
  const tickH = (v) => 9 + 41 * A.clamp(((v || 0.5) - 0.5) / 2.25, 0, 1);
  const inches = (v) => (v == null ? '–' : A.both(() => A.fmt.inches(v)));
  function localTime(s) {                                        // "2:23 AM" (data) → A.fmt.time in both languages
    const m = String(s || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i); if (!m) return null;
    let h = +m[1] % 12; if (/PM/i.test(m[3])) h += 12;
    return String(h).padStart(2, '0') + ':' + m[2];
  }

  /* ======================= HailGL: the season field (shared, built once) + the selected day ======================= */
  let SEASON = null;
  function seasonField() {
    if (SEASON) return SEASON;
    const HG = window.HailGL; if (!HG || !A.world || !A.world.toWorld) return null;
    const b = A.world.bbox;
    const field = HG.fieldFromStorms({ storms: ORD.map((D) => D.storm), areas: N.areas || [], bounds: [b[0] - 0.08, b[1] - 0.08, b[2] + 0.08, b[3] + 0.08], res: 720, project: (p) => A.world.toWorld(p), arrival: 'season' });
    SEASON = { field, samp: HG.sampler(field, { min: 0.62, seed: 26 }) };
    return SEASON;
  }
  const DAYF = new Map();
  function dayField(D) {
    if (!D || !D.storm) return null;
    if (DAYF.has(D.date)) return DAYF.get(D.date);
    const HG = window.HailGL; if (!HG) return null;
    let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
    D.storm.path.concat(...D.areas.map((a) => a.ring || [])).forEach((p) => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
    const field = HG.fieldFromStorms({ storms: [D.storm], areas: D.areas, bounds: [x0 - 0.16, y0 - 0.1, x1 + 0.16, y1 + 0.1], res: 420, project: (p) => A.world.toWorld(p), arrival: 'path' });
    const r = { field, samp: HG.sampler(field, { min: 0.55, seed: D.i + 3 }), id: D.storm.id };
    DAYF.set(D.date, r);
    return r;
  }
  /* GPU side: one pair of kits (season + selected day) per drawing target, alive only while #storms is on screen.
     Made in prepare() (an event or timer, never inside a frame), remade after a WebGL context loss (world.glGen),
     freed by the hail layer's dispose() once its exit fade ends. Stones stay under 5,000 for a MacBook GPU:
     3,400 for the season + 1,400 for the selected day, and only one of the two falls at a time. */
  let KITS = {};
  function freeKits() {
    const ks = KITS; KITS = {};
    Object.keys(ks).forEach((k) => A.safe('storms kits dispose', () => { ks[k].s.dispose(); ks[k].d.dispose(); }));
  }
  function kitsFor(target, gl) {
    const HG = window.HailGL, S = SEASON; if (!HG || !S) return null;   // built outside frames (idle / enter timer)
    const key = gl ? 'gl' : '2d', gen = gl ? A.world.glGen : 0;
    let K = KITS[key];
    if (!K || K.target !== target || K.gen !== gen) {
      if (K) A.safe('storms kits dispose', () => { K.s.dispose(); K.d.dispose(); });
      // restoreState:false: the world's GL layers bind what they use, and skipping HailGL's state reads (glGet*) keeps
      // frames free of GPU round trips
      const mk = () => (gl ? HG.create(target, { dpr: A.world.dpr, theme: theme(), restoreState: false }) : HG.create(target, { webgl: 0, dpr: A.world.dpr, theme: theme() }));
      const s = mk(), d = mk();
      if (!s || !s.ok || !d || !d.ok) { [s, d].forEach((k) => k && A.safe('storms kit dispose', () => k.dispose())); delete KITS[key]; return null; }
      s.field.setField(S.field);
      s.hail.spawn({ count: 3400, sampler: S.samp, t0: 0, dur: 1, lag: 0, seed: 2026, fall: { height: 0.07, dur: 0.012 } });
      K = KITS[key] = { target, gen, s, d, df: null, rings: {}, lastT: 0 };
    }
    return K;
  }
  let THEME = null;
  function theme() {
    if (!THEME) THEME = { base: A.theme === 'light' ? 'light' : 'dark', gold: A.rgba('--h1'), orange: A.rgba('--h15'), red: A.rgba('--h2'), hot: A.rgba('--storms-hot'), ice: A.rgba('--storms-ice'), ring: A.rgba('--acc') };
    return THEME;
  }
  A.on('theme', () => { THEME = null; });

  /* ======================= the view ======================= */
  let V = null;                                                  // live state while #storms is on screen
  let FADE = null;                                               // the last state, drawn frozen while the layer fades out
  const VIEW = () => V || FADE;
  const REPLAY = 1.5;                                            // the selected day's swath replay (s)

  function paint(K, f) {
    const v = V || FADE; if (!v) return;                       // FADE: the frozen last state while the layer fades out
    const th = theme(), rv = revealAt(v.p), still = A.still;
    const showDay = v.showDay && v.sel && v.sel.storm && v.mode !== 'play' && v.mode !== 'scrub' && v.mode !== 'intro';
    // the white-hot front glows only while a storm burns under the moving playhead (not on the quiet days after it)
    const burn = burningAt(v.p);
    K.s.field.draw(f.m, { t: f.t / 1000, reveal: rv, frontWidth: 0.012, feather: 0.006, front: v.motion * burn, ghost: 0.07,
      dim: showDay ? 0.78 : 0, opacity: f.alpha, theme: th });
    const hv = burn * v.motion;
    if (hv > 0.01 && !still) K.s.hail.draw(f.m, { t: rv, persp: 0.12, scale: 1.2, ringSize: 9, ringLife: 0.02, residue: 0.03, streak: 0.0015, opacity: hv * f.alpha, theme: th });
    if (!showDay) return;
    const F = dayField(v.sel); if (!F) return;
    if (K.df !== F) loadDay(K, F, v.sel);
    const t = (performance.now() - v.dayT0) / 1000, r = A.clamp(t / REPLAY, 0, 1);
    if (t < K.lastT) { K.d.rings.clear(); K.rings = {}; }
    K.lastT = t;
    for (let i = 0; i * 0.3 <= Math.min(t, REPLAY); i++) {
      if (K.rings[i]) continue; K.rings[i] = 1;
      const p = window.HailGL.frontAt(F.field, (i * 0.3) / REPLAY, F.id, [0, 0, 1, 0]);
      K.d.rings.add(p[0], p[1], { t0: i * 0.3, size: 70, life: 1.3, width: 1.3, color: th.ice, alpha: 0.75 });
    }
    K.d.field.draw(f.m, { t: f.t / 1000, reveal: r, opacity: f.alpha, theme: th });
    if (t < REPLAY + 2.6) {
      K.d.hail.draw(f.m, { t, persp: 0.16, scale: 1.5, ringSize: 11, ringLife: 0.9, residue: 2.2, streak: 0.07, opacity: f.alpha, theme: th });
      K.d.rings.draw(f.m, { t, opacity: f.alpha });
    }
  }
  function loadDay(K, F, D) {
    K.df = F; K.rings = {}; K.lastT = 0;
    K.d.field.setField(F.field);
    K.d.hail.spawn({ count: A.world.w < 700 ? 900 : 1400, sampler: F.samp, dur: REPLAY, lag: 0.03, seed: 7 + (D ? D.i : 0), fall: { height: 0.1, speed: 0.3 } });
    K.d.rings.clear();
  }
  /** GPU uploads happen here, in an event or timer, never inside a frame */
  function prepare(D) {
    const S = A.safe('storms season field', seasonField);
    if (S && A.world.hasGL && A.world.gl) {
      const K = A.safe('storms kits', () => kitsFor(A.world.gl, true));
      const F = D && D.storm ? A.safe('storms day field', () => dayField(D)) : null;
      if (K && F && K.df !== F) A.safe('storms day upload', () => loadDay(K, F, D));
    }
    A.world.invalidate('gl');
  }
  /** the GPU kits never get built inside a frame: a frame that finds none asks for them and draws nothing this once */
  let prepAsk = 0;
  function askPrepare() { if (prepAsk) return; prepAsk = setTimeout(() => { prepAsk = 0; if (V) prepare(V.sel); }, 0); }
  function hailLayer() {
    return {
      id: 'storms-hail', z: 12, live: false, fadeMs: 500,
      drawGL(gl, f) {
        if (!V && !FADE) return;
        const K = KITS.gl;
        if (!K || K.target !== gl || K.gen !== A.world.glGen) { askPrepare(); return; }
        paint(K, f);
      },
      draw2d(c, f) { if (!V && !FADE) return; const K = A.safe('storms kits 2d', () => kitsFor(c, false)); if (K) paint(K, f); },
      // the world calls this once the exit fade is over (or when a new #storms visit replaces the layer): free the GPU side
      dispose() { if (!V) FADE = null; freeKits(); }
    };
  }

  /* top canvas: the selected swath's path + label, the hovered one, past-years points, report towns (days without a swath) */
  const PL = Object.assign({}, N.places || {});
  (N.base || []).forEach((b) => { if (b.k === 'town' && b.n && !PL[b.n] && b.p && b.p.length) { let x = 0, y = 0; b.p.forEach((p) => { x += p[0]; y += p[1]; }); PL[b.n] = [x / b.p.length, y / b.p.length]; } });
  const MONO = '"Geist Mono","Geist Mono L",ui-monospace,monospace';
  function pathPx(D, f) { return D.storm.path.map((p) => f.project(p)); }
  function marksLayer() {
    return {
      id: 'storms-marks', z: 210, live: false,
      draw2d(c, f) {
        const V = VIEW(); if (!V) return;                        // the live state, or the frozen one while fading out
        const pal = f.pal;
        c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; c.textBaseline = 'middle';
        // 2024-25 reports up to the playhead's day of the year, as small ringed points
        if (V.past) {
          for (const h of HPTS) {
            if (h.d > V.p) continue;
            const q = f.project(h.ll); if (q[0] < -10 || q[1] < -10 || q[0] > f.w + 10 || q[1] > f.h + 10) continue;
            const r = 1.6 + h.v * 0.9;
            c.globalAlpha = 0.9; c.beginPath(); c.arc(q[0], q[1], r, 0, TAU); c.fillStyle = A.world.hailColor(h.v); c.fill();
            c.globalAlpha = 0.55; c.lineWidth = 1; c.strokeStyle = A.world.hailColor(h.v); c.beginPath(); c.arc(q[0], q[1], r + 3, 0, TAU); c.stroke();
          }
        }
        const drawPath = (D, a, w) => {
          if (!D || !D.storm) return;
          const pts = pathPx(D, f);
          c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])));
          c.globalAlpha = a * 0.5; c.strokeStyle = pal.halo; c.lineWidth = w + 2; c.setLineDash([]); c.stroke();
          c.globalAlpha = a * 0.8; c.strokeStyle = pal.text; c.lineWidth = w; c.setLineDash([1, 4]); c.stroke(); c.setLineDash([]);
          c.globalAlpha = a;
          [pts[0], pts[pts.length - 1]].forEach((q, i) => { c.beginPath(); c.arc(q[0], q[1], i ? 3.2 : 2.4, 0, TAU); c.fillStyle = i ? pal.text : pal.halo; c.fill(); c.lineWidth = 1.2; c.strokeStyle = pal.text; c.stroke(); });
        };
        if (V.hover && V.hover !== V.sel) drawPath(V.hover, 0.6, 1);
        const S = V.sel;
        if (S && S.storm && V.mode !== 'intro') {
          drawPath(S, 0.95, 1.2);
          // label pill at the end of the path: date · hail
          const pts = pathPx(S, f), e = pts[pts.length - 1];
          const txt = A.fmt.date(S.date, 'short') + ' · ' + A.fmt.inches(S.max);
          c.font = '500 10.5px ' + MONO; if ('letterSpacing' in c) c.letterSpacing = '0.4px';
          const tw = c.measureText(txt).width, x = A.clamp(e[0] + 12, f.inset.l + 6, f.w - f.inset.r - tw - 26), y = A.clamp(e[1] - 16, f.inset.t + 14, f.h - f.inset.b - 14);
          c.globalAlpha = 0.96; c.beginPath(); A.world.roundRect(c, x, y - 11, tw + 20, 22, 6); c.fillStyle = pal.panel; c.fill(); c.lineWidth = 1; c.strokeStyle = pal.rule2; c.stroke();
          c.beginPath(); c.arc(x + 9, y, 3, 0, TAU); c.fillStyle = A.world.hailColor(S.max); c.fill();
          c.fillStyle = pal.text; c.textAlign = 'left'; c.fillText(txt, x + 16, y + 0.5);
          if ('letterSpacing' in c) c.letterSpacing = '0px';
        } else if (S && !S.storm && V.mode !== 'intro') {
          // a reported day without a modeled swath: ring the towns that sent reports (where the map knows them)
          c.font = '500 10px ' + MONO;
          S.towns.forEach((tn) => {
            const ll = PL[tn]; if (!ll) return; const q = f.project(ll);
            c.globalAlpha = 0.95; c.lineWidth = 1.6; c.strokeStyle = A.world.hailColor(S.rep); c.beginPath(); c.arc(q[0], q[1], 7, 0, TAU); c.stroke();
            c.beginPath(); c.arc(q[0], q[1], 2.2, 0, TAU); c.fillStyle = A.world.hailColor(S.rep); c.fill();
            c.lineWidth = 3; c.strokeStyle = pal.halo; c.textAlign = 'left'; c.strokeText(tn, q[0] + 11, q[1]); c.fillStyle = pal.text; c.fillText(tn, q[0] + 11, q[1]);
          });
        }
        c.restore();
      },
      hit(pt, f) {                                               // the nearest modeled swath under the pointer
        if (!V || V.mode === 'intro') return null;
        let best = null, bd = Infinity; const tol = Math.max(16, 3.2 * f.pxPerMile);
        for (const D of ORD) {
          if (D.d > V.p + 0.01) continue;                        // only storms that have happened on the timeline
          const pts = pathPx(D, f);
          for (let i = 0; i < pts.length; i++) {
            const a = pts[i], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
            const t = L2 ? A.clamp(((pt.x - a[0]) * dx + (pt.y - a[1]) * dy) / L2, 0, 1) : 0;
            const d = Math.hypot(pt.x - (a[0] + t * dx), pt.y - (a[1] + t * dy));
            if (d < bd) { bd = d; best = D; }
          }
        }
        return best && bd <= tol ? { id: best.date, date: best.date } : null;
      },
      onHover(item) { if (!V) return; const D = item ? DAYS.find((x) => x.date === item.date) : null; if (D !== V.hover) { V.hover = D; A.world.invalidate('top'); } },
      onClick(item) { if (item) select(item.date, { from: 'map' }); }
    };
  }

  /* ======================= DOM ======================= */
  function statHTML(k, v, src, o = {}) {
    return '<div class="stat"><span class="stat__k">' + k + ' ' + (src ? A.ui.srcTag(src) : '') + '</span><span class="stat__v"' + (o.h != null ? ' data-h="' + A.ui.hailKey(o.h) + '"' : '') + '>' + v + '</span>' + (o.s ? '<span class="stat__s">' + o.s + '</span>' : '') + '</div>';
  }
  function cardHTML(D) {
    const U = A.ui;
    if (!D) {
      return '<p class="eyebrow eyebrow--acc">' + Le('2026 season', 'Temporada 2026') + '</p>' +
        '<h1 class="t-title storms-date">' + Lo(cp('day.quiet', 'Quiet day. No hail reports.', 'Día tranquilo. Sin reportes de granizo.')) + '</h1>' +
        '<p class="t-body storms-lede">' + Le('Drag the playhead or press the right arrow to reach the first storm day.', 'Arrastra la línea de tiempo o pulsa la flecha derecha para llegar al primer día de tormenta.') + '</p>';
    }
    const ago = A.fmt.daysBetween(D.date);
    const t1 = localTime(D.first), t2 = localTime(D.last);
    const win = !t1 ? '–' : t1 === t2 ? A.both(() => A.fmt.time(t1)) : A.both(() => A.fmt.range(t1, t2));
    const zones = D.zones.map((z) => z.area
      ? '<button type="button" class="chip storms-zone" data-area="' + A.esc(z.area.id) + '" data-tip="Fly to ' + A.esc(z.name.en) + ' (' + A.esc(A.fmt.inches(z.area.hail, 2, 'en')) + ', ' + A.esc(z.area.sub ? z.area.sub.en : '') + ')" data-tip-es="Volar a ' + A.esc(z.name.es) + ' (' + A.esc(A.fmt.inches(z.area.hail, 2, 'es')) + ', ' + A.esc(z.area.sub ? z.area.sub.es : '') + ')">' +
        '<span class="chip__dot" style="color:var(' + U.hailTok(z.area.hail) + ')"></span>' + Lo(z.name) + ' <span class="storms-zone__v">' + A.esc(A.fmt.num(z.area.hail, 2, 'en')) + '</span>' + ic('arrow', 13) + '</button>'
      : '<span class="storms-zone storms-zone--plain">' + Lo(z.name) + (z.n > 1 ? ' <span class="storms-zone__n">×' + z.n + '</span>' : '') + '</span>').join('');
    const kid = knockId(D);
    const noSwath = !D.storm ? '<p class="storms-note">' + ic('info', 14) + '<span>' + Le('Reported, not modeled: the engine drew no swath for this day. The towns that sent reports are listed below.', 'Reportado, sin modelo: el motor no trazó una franja para este día. Abajo están los pueblos que enviaron reportes.') + '</span></p>' : '';
    return '<p class="eyebrow eyebrow--acc">' + Le('Storm day', 'Día de tormenta') + ' <b>' + (D.i + 1) + '</b> ' + Le('of', 'de') + ' ' + DAYS.length +
        ' <span class="storms-ago">· ' + (ago === 0 ? Le('today', 'hoy') : Lo({ en: sub(cp('timeline.daysAgo', '{n} days ago', 'hace {n} días').en, { n: ago }), es: sub(cp('timeline.daysAgo', '{n} days ago', 'hace {n} días').es, { n: ago }) })) + '</span></p>' +
      '<h1 class="t-title storms-date">' + A.both(() => A.fmt.date(D.date, 'long')) + '</h1>' +
      '<div class="stats storms-stats">' +
        statHTML(Le('Max hail', 'Granizo máx.'), inches(D.max), D.maxSrc, { h: D.max, s: D.storm ? Le('modeled swath', 'franja modelada') : Le('reported', 'reportado') }) +
        statHTML(Le('Reported', 'Reportado'), inches(D.rep), 'lsr', { h: D.rep, s: Le('largest report', 'mayor reporte') }) +
        statHTML(Le('Radar', 'Radar'), inches(D.radar), 'mrms', { h: D.radar, s: Le('estimate, runs high', 'estimado, sale alto') }) +
      '</div>' +
      '<div class="stats storms-stats">' +
        statHTML(Lo(cp('day.reports', 'Reports', 'Reportes')), D.reports == null ? '–' : A.esc(A.fmt.int(D.reports)), 'lsr') +
        statHTML(Lo(cp('day.cells', 'Radar cells', 'Celdas de radar')), D.cells == null ? '–' : A.esc(A.fmt.int(D.cells)), 'radar') +
        statHTML(Le('Reported at', 'Hora local'), '<span class="storms-win">' + win + '</span>', 'lsr') +
      '</div>' + noSwath +
      '<div class="storms-block"><p class="sec">' + Lo(cp('day.towns', 'Towns', 'Pueblos')) + ' <span class="sec__meta">' + Le('with reports', 'con reportes') + '</span></p>' +
        '<p class="storms-towns">' + (D.towns.length ? D.towns.map((t) => '<span>' + A.esc(t) + '</span>').join('') : '–') + '</p></div>' +
      '<div class="storms-block"><p class="sec">' + Lo(cp('day.zones', 'Zones touched', 'Zonas alcanzadas')) + ' <b>' + D.nZones + '</b><span class="sec__meta">' + A.ui.srcTag('engine') + '</span></p>' +
        '<div class="storms-zones">' + (zones || '<span class="storms-zone storms-zone--plain">–</span>') + '</div></div>' +
      (kid ? '' : '<p class="storms-none">' + ic('info', 14) + '<span>' + (D.storm
        ? Le('No zone to knock yet: the engine mapped this swath but ranked no neighborhood in it.', 'Todavía no hay zona para tocar: el motor trazó esta franja pero no clasificó ningún vecindario en ella.')
        : Le('No zone to knock: zones are ranked only inside a mapped swath.', 'No hay zona para tocar: las zonas se clasifican solo dentro de una franja trazada.')) + '</span></p>') +
      '<div class="storms-act">' +
        (kid ? '<button type="button" class="btn btn--primary storms-knock" data-label-en="Knock this storm: open Now with its best zone" data-label-es="Tocar puertas de esta tormenta: abrir Ahora con su mejor zona">' + ic('door') + '<span>' + Lo(cp('knockThis', 'Knock this storm', 'Tocar puertas de esta tormenta')) + '</span></button>' : '') +
        (D.storm ? '<button type="button" class="btn btn--secondary storms-replay" data-label-en="Replay this swath" data-label-es="Repetir esta franja">' + ic('play') + '<span>' + (kid ? Le('Replay', 'Repetir') : Le('Replay this swath', 'Repetir esta franja')) + '</span></button>' : '') +
      '</div>';
  }
  function seasonHTML() {
    const U = A.ui, s = SUM, maxT = s.towns.length ? s.towns[0][1] : 1;
    const repDates = s.rep.dates.slice().sort().map((d) => A.both(() => A.fmt.date(d, 'short'))).join(', ');
    const srcs = [['lsr', 'NWS'], ['spc', 'SPC'], ['ncei', 'NCEI'], ['radar', 'NEXRAD'], ['mrms', 'MRMS'], ['census', 'Census']]
      .filter((x) => srcCount(x[0]) != null).map((x) => '<span class="storms-src"><b class="num">' + A.esc(A.fmt.int(srcCount(x[0]), 'en')) + '</b> ' + U.srcTag(x[0]) + '</span>').join('');
    return '<p class="sec">' + Lo(cp('timeline.season', '2026 season', 'Temporada 2026')) + '<span class="sec__meta">' + A.both(() => A.fmt.date(s.first, 'short')) + ' – ' + A.both(() => A.fmt.date(s.last, 'short')) + '</span></p>' +
      '<div class="stats storms-sum">' +
        statHTML(Le('Storm days', 'Días de tormenta'), A.esc(A.fmt.int(s.days)), 'lsr', { s: Le(A.fmt.int(s.reports, 'en') + ' reports', A.fmt.int(s.reports, 'es') + ' reportes') }) +
        statHTML(Le('Swaths', 'Franjas'), A.esc(A.fmt.int(s.swaths)), 'storms', { s: Le('modeled', 'modeladas') }) +
        statHTML(Le('Biggest', 'Mayor'), inches(s.rep.v), 'lsr', { h: s.rep.v, s: repDates }) +
        statHTML(Le('On radar', 'En radar'), inches(s.rad.v), 'mrms', { h: s.rad.v, s: A.both(() => A.fmt.date(s.rad.date, 'short')) + ' · ' + Le('estimate', 'estimado') }) +
      '</div>' +
      '<p class="sec storms-sec2">' + Le('Most-hit towns', 'Pueblos con más reportes') + '<span class="sec__meta">' + Le('storm days with a report', 'días de tormenta con reporte') + '</span></p>' +
      '<div class="storms-bars">' + s.towns.map((t) => '<div class="storms-bar"><span class="storms-bar__n">' + A.esc(t[0]) + '</span><span class="storms-bar__t"><i style="transform:scaleX(' + (t[1] / maxT).toFixed(3) + ')"></i></span><span class="storms-bar__v num">' + t[1] + '</span></div>').join('') + '</div>' +
      '<div class="storms-srcs">' + srcs + '</div>';
  }
  function dockHTML() {
    const U = A.ui;
    const months = MONTHS.map((m) => '<span class="storms-tl__m" style="left:' + ((m.d / SPAN) * 100).toFixed(3) + '%">' + Le(m.en, m.es) + '</span>').join('');
    // each day's tooltip spells out all three hail numbers and where each comes from
    const tip = (D, l) => {
      const n = (v) => (v != null ? A.fmt.inches(v, 2, l) : '–'), en = l === 'en';
      return [A.fmt.date(D.date, 'day', l),
        D.storm ? (en ? 'swath ' : 'franja ') + n(D.max) : (en ? 'no swath modeled' : 'sin franja modelada'),
        (en ? 'largest report ' : 'mayor reporte ') + n(D.rep),
        D.radar ? (en ? 'radar ' : 'radar ') + n(D.radar) + (en ? ' (estimate)' : ' (estimado)') : null].filter(Boolean).join(' · ');
    };
    const ticks = DAYS.map((D) => {
      const tipEn = tip(D, 'en'), tipEs = tip(D, 'es');
      const r = D.radar ? '<i class="storms-tick__r" style="height:' + tickH(D.radar).toFixed(1) + 'px;color:var(' + U.hailTok(D.radar) + ')"></i>' : '';
      return '<span class="storms-tick' + (D.storm ? '' : ' storms-tick--rep') + '" data-i="' + D.i + '" style="left:' + (((D.d + 0.5) / SPAN) * 100).toFixed(3) + '%" data-tip="' + A.esc(tipEn) + '" data-tip-es="' + A.esc(tipEs) + '">' + r +
        '<i class="storms-tick__b" style="height:' + tickH(D.max).toFixed(1) + 'px;background:var(' + U.hailTok(D.max) + ')"></i><i class="storms-tick__cap"></i></span>';
    }).join('');
    // the lane's scale: bars are max hail in inches (the dash above a bar is the radar estimate)
    const gridY = [1, 2].map((v) => '<i class="storms-tl__gy" aria-hidden="true" style="bottom:' + tickH(v).toFixed(1) + 'px"></i>').join('');
    const yLabels = [1, 2].map((v) => '<span style="bottom:' + tickH(v).toFixed(1) + 'px">' + String(v) + '″' + '</span>').join('');
    const ghosts = HDAYS.map((h) => '<i class="storms-ghost" style="left:' + (((h.d + 0.5) / SPAN) * 100).toFixed(3) + '%;height:' + (3 + A.clamp(h.v / 3, 0, 1) * 9).toFixed(1) + 'px;background:var(' + U.hailTok(h.v) + ')"></i>').join('');
    return '<div class="storms-dock">' +
      '<div class="storms-ctl">' +
        '<button type="button" class="btn btn--secondary btn--icon storms-play" data-label-en="Play the season" data-label-es="Reproducir la temporada" data-tip="Play (Space)" data-tip-es="Reproducir (Espacio)">' + ic('play') + '</button>' +
        '<div class="seg storms-step" role="group" data-label-en="Storm days" data-label-es="Días de tormenta">' +
          '<button type="button" class="storms-prev" data-label-en="Previous storm day" data-label-es="Día de tormenta anterior" data-tip="Previous storm (←)" data-tip-es="Tormenta anterior (←)">' + ic('chevron') + '</button>' +
          '<button type="button" class="storms-next" data-label-en="Next storm day" data-label-es="Siguiente día de tormenta" data-tip="Next storm (→)" data-tip-es="Siguiente tormenta (→)">' + ic('chevron') + '</button></div>' +
        '<div class="storms-read" aria-live="off"><span class="storms-read__d"></span><span class="storms-read__s"></span></div>' +
        '<span class="storms-ctl__sp"></span>' +
        '<button type="button" class="chip storms-past" aria-pressed="false" data-tip="Show 2024-25 NWS and NCEI hail reports on the map, up to the playhead\'s date" data-tip-es="Mostrar los reportes de granizo 2024-25 del NWS y NCEI en el mapa, hasta la fecha de la línea de tiempo"><span class="chip__dot"></span>' + Le('Past years', 'Años anteriores') + ' <span class="t-mono storms-past__n">2024-25</span></button>' +
        '<div class="seg storms-speed" role="group" data-label-en="Speed" data-label-es="Velocidad">' + [1, 2, 4].map((s) => '<button type="button" data-speed="' + s + '" aria-pressed="' + (s === 1) + '">' + s + '×</button>').join('') + '</div>' +
      '</div>' +
      '<div class="storms-tl" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="' + SPAN + '" data-label-en="' + A.esc(cp('timeline.label', 'Storm timeline', 'Línea de tiempo de tormentas').en) + '" data-label-es="' + A.esc(cp('timeline.label', 'Storm timeline', 'Línea de tiempo de tormentas').es) + '">' +
        '<div class="storms-tl__yax" aria-hidden="true">' + yLabels + '</div>' +
        '<div class="storms-tl__in">' +
          '<div class="storms-tl__grid">' + MONTHS.map((m) => '<i style="left:' + ((m.d / SPAN) * 100).toFixed(3) + '%"></i>').join('') + '</div>' +
          '<div class="storms-tl__ms" aria-hidden="true">' + months + '</div>' +
          '<div class="storms-tl__lane"><div class="storms-tl__burn"></div>' + gridY + ticks + '</div>' +
          '<div class="storms-tl__ghosts" aria-hidden="true"><span class="storms-tl__gl">2024-25 ' + U.srcTag('ncei') + '</span>' + ghosts + '</div>' +
          '<div class="storms-tl__today" style="left:' + (((TODAY + 0.5) / SPAN) * 100).toFixed(3) + '%"><span>' + Lo(cp('timeline.today', 'Today', 'Hoy')) + '</span></div>' +
          '<div class="storms-tl__head" aria-hidden="true"><i></i></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }
  function legendHTML() {
    const lo = 0.5, hi = 2.75, pos = (v) => (((v - lo) / (hi - lo)) * 100).toFixed(2) + '%';
    const sizes = (COPY.sizes || []).filter((s) => s.in >= 0.75 && s.in <= 2.75);
    const ticks = [0.75, 1, 1.5, 2, 2.5].map((v) => {
      const s = sizes.find((x) => x.in === v) || sizes.slice().sort((a, b) => Math.abs(a.in - v) - Math.abs(b.in - v))[0];
      return '<span class="storms-lg__t" style="left:' + pos(v) + '"' + (s ? ' data-tip="' + A.esc(A.fmt.num(v, 2, 'en') + ' in: ' + s.name.en) + '" data-tip-es="' + A.esc(A.fmt.num(v, 2, 'es') + ' pulg: ' + s.name.es) + '"' : '') + '>' + (v === 2.5 ? '2.5+' : A.fmt.num(v, v % 1 ? (v === 0.75 ? 2 : 1) : 0, 'en')) + '</span>';
    }).join('');
    return '<div class="storms-lg">' +
      '<p class="storms-lg__h"><span>' + Le('Hail size, inches', 'Tamaño del granizo, pulgadas') + '</span>' + A.ui.srcTag('storms') + '</p>' +
      '<div class="storms-lg__bar"><i class="storms-lg__sel"></i><i class="storms-lg__cur"></i></div>' +
      '<div class="storms-lg__ticks">' + ticks + '</div>' +
      '<p class="storms-lg__live"><span class="storms-lg__lk storms-lg__lk--hover">' + Le('Under the cursor', 'Bajo el cursor') + '</span><span class="storms-lg__lk storms-lg__lk--touch">' + Le('Where you tap', 'Donde tocas') + '</span> <b class="storms-lg__v num">–</b></p>' +
      '<p class="storms-lg__note">' + Le('Radar sweep: decorative. Sizes: NOAA/NWS reports + MRMS radar.', 'Barrido del radar: decorativo. Tamaños: reportes de NOAA/NWS + radar MRMS.') + '</p>' +
    '</div>';
  }
  const LG = { lo: 0.5, hi: 2.75 };
  const lgPos = (v) => A.clamp((v - LG.lo) / (LG.hi - LG.lo), 0, 1);

  /* ======================= behavior ======================= */
  function knockId(D) {
    if (!D) return null;
    const ids = new Set(D.areas.map((a) => a.id));
    const z = (N.zones || []).filter((x) => ids.has(x.area_id)).sort((a, b) => a.rank - b.rank)[0];
    if (z) return z.id;
    const a = D.areas.slice().sort((x, y) => (y.score || 0) - (x.score || 0))[0];
    return a ? a.id : null;
  }
  function wake() { if (V && !V.ticking) { V.ticking = true; A.motion.ticker.add(V.tick); } }
  function setMode(m) {
    if (!V) return;
    V.mode = m;
    const playing = m === 'play';
    if (V.dom.play) {
      V.dom.play.innerHTML = ic(playing ? 'pause' : 'play');
      V.dom.play.dataset.labelEn = playing ? 'Pause' : 'Play the season'; V.dom.play.dataset.labelEs = playing ? 'Pausa' : 'Reproducir la temporada';
      V.dom.play.dataset.tip = playing ? 'Pause (Space)' : 'Play (Space)'; V.dom.play.dataset.tipEs = playing ? 'Pausa (Espacio)' : 'Reproducir (Espacio)';
      V.dom.play.setAttribute('aria-pressed', String(playing));
      A.ui.localize(V.dom.play.parentNode);
    }
    if (!playing) { const s = snd(); if (s) s.hailBed(0); }
    wake();
  }
  function setSel(D, o = {}) {
    if (!V) return;
    const prev = V.sel; V.sel = D;
    V.dom.ticks.forEach((t, i) => t.classList.toggle('is-sel', !!D && D.i === i));
    if (V.dom.lgSel) { V.dom.lgSel.style.opacity = D && D.max ? '1' : '0'; if (D && D.max) V.dom.lgSel.style.transform = 'translateX(' + (lgPos(D.max) * 100).toFixed(2) + '%)'; }
    if (prev !== D || o.force) {
      const pane = V.dom.card;
      pane.innerHTML = cardHTML(D); A.ui.icons(pane); A.ui.localize(pane);
      if (!o.quiet && !A.still) A.motion.stagger(Array.from(pane.children), { each: 28, y: 6, ms: 420 });
      if (A.world.unpin) A.world.unpin('storms-zone');
    }
    A.world.invalidate('top');
  }
  function startDay(D) {
    if (!V) return;
    V.showDay = !!(D && D.storm);
    V.dayT0 = A.still ? -1e9 : performance.now();
    if (V.showDay) prepare(D);
    wake();
  }
  function select(date, o = {}) {
    if (!V) return false;
    const D = typeof date === 'number' ? DAYS[date] : DAYS.find((x) => x.date === date);
    if (!D) return false;
    endIntro(false);
    if (V.mode === 'play' || V.mode === 'scrub') setMode('idle');
    V.p = D.d + 1; V.motion = 0;
    setSel(D); startDay(D); sync();
    ensureVisible(D);                                            // its swath (or its report towns) comes into view
    return true;
  }
  function ensureVisible(D) {
    if (!D) return;
    const pts = D.storm ? D.storm.path.concat(...D.areas.map((a) => a.ring || [])) : D.towns.map((t) => PL[t]).filter(Boolean);
    if (!pts.length) return;
    const f = A.world.frame();
    const ok = pts.every((p) => { const q = f.project(p); return q[0] > f.inset.l && q[0] < f.w - f.inset.r && q[1] > f.inset.t && q[1] < f.h - f.inset.b; });
    if (!ok) A.world.flyTo({ points: D.storm ? pts : pts.concat(SEASON_BOUNDS), pad: 90, maxZoom: 10.6 });
  }
  function step(dir) {
    if (!V) return;
    let D;
    if (dir > 0) D = DAYS.find((x) => x.d + 1 > V.p + 0.01) || null;
    else { const cur = latestAt(V.p); D = cur ? (cur.d + 1 < V.p - 0.01 ? cur : DAYS[cur.i - 1]) : null; }
    if (D) select(D.date, { from: 'key' });
  }
  function play() {
    if (!V) return false;
    endIntro(false);
    if (A.still) { const L = latestAt(END); if (L) select(L.date); return true; }
    // nothing left to play (resting on the latest storm, or at the end): replay the season from Mar 1
    const ahead = DAYS.some((D) => D.d + 0.5 > V.p + 0.01);
    if (!ahead || V.p >= END - 0.5) { V.p = 0; setSel(null, { quiet: true }); sync(); }
    V.showDay = false; V.lastDay = latestAt(V.p);
    setMode('play');
    return true;
  }
  function pause() { if (!V) return false; if (V.mode === 'play' || V.mode === 'intro') { endIntro(true); setMode('idle'); const L = latestAt(V.p); setSel(L); if (L && V.p >= L.d + 1) startDay(L); } return true; }
  function togglePlay() { if (!V) return; if (V.mode === 'play') pause(); else play(); }
  function seek(p01) {
    if (!V) return false;
    endIntro(false); if (V.mode === 'play') setMode('idle');
    V.p = A.clamp(p01, 0, 1) * SPAN; V.lastMove = performance.now(); V.motion = 1;
    const L = latestAt(V.p); if (L !== V.sel) setSel(L, { quiet: true });
    V.showDay = false; sync(); wake();
    return true;
  }
  function endIntro(toEnd) {
    if (!V || V.mode !== 'intro') return;
    V.mode = 'idle'; V.readDay = -1;
    V.dom.card.classList.remove('is-replaying');
    if (toEnd !== false) { V.p = LAST ? LAST.d + 1 : END; }
    const L = latestAt(V.p); setSel(L, { force: L !== V.sel, quiet: L === V.sel }); if (L && L.storm && V.p >= L.d + 1) startDay(L);
    sync();
    // the playhead lands on the day like a knock
    if (toEnd !== false && L && !A.still) A.safe('storms land', () => { const t = V.dom.ticks[L.i]; if (t) A.motion.ripple(t.querySelector('.storms-tick__b') || t, { rings: 2, size: 34 }); });
  }

  /* The world's shared hail layer is hidden in this view (hail: 0), and it compiles its shader + uploads its field on its
     first visible frame. After a deep link into #storms that frame is the one leaving this view (0.4-0.9 s with software
     GL). So once the entrance has settled, draw it for two frames at 0.4% opacity (invisible) while the view rests.
     Foundation request: world.js could warm that program at init. */
  let warmGen = -1;
  function warmSharedHail() {
    const W = A.world, L = W.layer.get('hail');
    if (!V || !L || !W.hasGL || warmGen === W.glGen || L._op > 0.003) return;
    warmGen = W.glGen;
    W.layer.opacity('hail', 0.004, { ms: 0 });
    requestAnimationFrame(() => requestAnimationFrame(() => { if (A.view.current === 'storms' && V) W.layer.opacity('hail', 0, { ms: 0 }); }));
  }

  /* per-frame: the playhead moves, the sky follows */
  function makeTick() {
    return function tick(now, dt) {
      if (!V || !V.ctx.alive()) { if (V) V.ticking = false; return false; }
      const p0 = V.p;
      if (V.mode === 'intro') {
        if (V.t0 == null) V.t0 = now;
        const k = A.clamp((now - V.t0) / 2500, 0, 1);
        V.p = (V.pIntro || END) * E.inOutSine(k);
        if (k >= 1) endIntro(true);
      } else if (V.mode === 'play') {
        V.p = Math.min(END, V.p + (speedAt(V.p) * V.speed * dt) / 1000);
        const L = latestAt(V.p);
        if (L && L !== V.lastDay) {
          V.lastDay = L; setSel(L, { quiet: true });
          const s = snd(); if (s) s.ring(A.clamp(Math.round(((L.max || 1) - 0.75) / 0.4), 0, 5), { gain: 0.6 });
        }
        const s = snd(); if (s && now - (V.bedAt || 0) > 200) { V.bedAt = now; s.hailBed(0.5 * burningAt(V.p)); }
        if (V.p >= END) pause();
      }
      if (V.p !== p0) V.lastMove = now;
      V.motion = A.still ? 0 : 1 - sm(now - (V.lastMove || -1e9), 150, 700);
      const dayBusy = V.showDay && performance.now() - V.dayT0 < (REPLAY + 2.8) * 1000;
      const busy = V.mode === 'intro' || V.mode === 'play' || V.mode === 'scrub' || V.motion > 0.001 || dayBusy;
      if (V.live !== busy) { V.live = busy; A.world.layer.set('storms-hail', { live: busy }); }
      if (V.p !== p0) { sync(); A.world.invalidate('top'); }
      if (!busy) { A.world.invalidate('gl'); V.ticking = false; return false; }
      return true;
    };
  }
  function sync() {
    if (!V || !V.dom) return;
    // the playhead layer spans the track, so a percent of its own width is a date: no measuring, never stale on resize
    const D = V.dom;
    D.head.style.transform = 'translateX(' + ((V.p / SPAN) * 100).toFixed(3) + '%)';
    D.burn.style.transform = 'scaleX(' + (V.p / SPAN).toFixed(4) + ')';
    DAYS.forEach((d, i) => { const past = V.p >= d.d + 0.5; if (V.past0[i] !== past) { V.past0[i] = past; D.ticks[i].classList.toggle('is-past', past); } });
    const day = A.clamp(Math.floor(V.p - 0.001), 0, SPAN - 1);
    if (day !== V.readDay) {
      V.readDay = day;
      const iso = isoOf(day), SDay = DAYS.find((x) => x.d === day), ago = A.fmt.daysBetween(iso);
      D.readD.innerHTML = A.both(() => A.fmt.date(iso, 'day'));
      D.readS.innerHTML = V.mode === 'intro' ? Le('Replaying the season', 'Repitiendo la temporada')
        : SDay ? Le('Storm day ' + (SDay.i + 1) + ' of ' + DAYS.length, 'Día de tormenta ' + (SDay.i + 1) + ' de ' + DAYS.length)
        : ago > 0 ? Le(sub(cp('timeline.daysAgo', '{n} days ago', 'hace {n} días').en, { n: ago }), sub(cp('timeline.daysAgo', '{n} days ago', 'hace {n} días').es, { n: ago })) : ago === 0 ? Lo(cp('timeline.today', 'Today', 'Hoy')) : Le('ahead', 'por venir');
      D.tl.setAttribute('aria-valuenow', String(day));
      D.tl.setAttribute('aria-valuetext', A.fmt.date(iso, 'long') + (SDay ? ', ' + A.t('storm day', 'día de tormenta') : ''));
    }
  }

  /* the timeline: drag to scrub, tap near a tick to pick that day */
  function bindTimeline() {
    const D = V.dom, el = D.tl, track = D.tin;                  // pointer math on the inner track (the scale gutter sits left)
    const pAt = (e) => { const r = track.getBoundingClientRect(); return A.clamp(((e.clientX - r.left) / Math.max(1, r.width)) * SPAN, 0, SPAN); };
    const nearTick = (e) => {
      const r = track.getBoundingClientRect(), x = e.clientX - r.left; let best = null, bd = 9;
      DAYS.forEach((d) => { const tx = ((d.d + 0.5) / SPAN) * r.width, dd = Math.abs(tx - x); if (dd < bd) { bd = dd; best = d; } });
      return best;
    };
    let drag = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      endIntro(false);
      if (V.mode === 'play') setMode('idle');
      drag = { id: e.pointerId, x0: e.clientX, moved: false, tick: nearTick(e) };
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (!drag.tick) { V.mode = 'scrub'; V.showDay = false; V.p = pAt(e); V.lastMove = performance.now(); sync(); wake(); }
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      if (!drag.moved && Math.abs(e.clientX - drag.x0) > 4) { drag.moved = true; V.mode = 'scrub'; V.showDay = false; }
      if (drag.moved) {
        V.p = pAt(e); V.lastMove = performance.now();
        const L = latestAt(V.p); if (L !== V.sel) setSel(L, { quiet: true });
        sync(); wake();
      }
    });
    const up = (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const d = drag; drag = null;
      if (!d.moved && d.tick) { select(d.tick.date); return; }
      V.mode = 'idle';
      const L = latestAt(V.p); setSel(L); if (L && L.storm && V.p >= L.d + 1) startDay(L); sync(); wake();
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Home') { e.preventDefault(); if (DAYS[0]) select(DAYS[0].date); }
      else if (e.key === 'End') { e.preventDefault(); if (LAST) select(LAST.date); }
    });
  }

  A.view.register('storms', {
    title: { en: 'Storms', es: 'Tormentas' }, key: '2',
    dim: 0.1,
    hail: 0,            // this view draws its own season field (HailGL)
    ambient: false,
    // eastern Nebraska where the 2026 hail fell: Columbus to Omaha, Lincoln to Blair (every modeled swath + hail area)
    camera: (fr) => ({ bounds: SEASON_BOUNDS, pad: fr && fr.stacked ? 10 : { t: 28, r: 30, b: 18, l: 24 } }),
    enter(ctx) {
      const card = ctx.el('left', cardHTML(LAST), 'pane storms-card');
      ctx.el('left', seasonHTML(), 'pane storms-season');
      const lg = ctx.el('center', legendHTML(), 'float storms-legend');
      const dock = ctx.el('bottom', dockHTML(), 'pane pane--tight storms-dockp');
      const q = (s, r) => (r || dock).querySelector(s);
      FADE = null;
      V = {
        ctx, p: 0, mode: 'idle', speed: 1, past: false, sel: null, hover: null, showDay: false, dayT0: 0, motion: 0, lastMove: -1e9,
        past0: DAYS.map(() => null), readDay: -1, ticking: false,
        dom: {
          card, lg, dock, tl: q('.storms-tl'), tin: q('.storms-tl__in'), head: q('.storms-tl__head'), burn: q('.storms-tl__burn'), ticks: Array.from(dock.querySelectorAll('.storms-tick')),
          play: q('.storms-play'), readD: q('.storms-read__d'), readS: q('.storms-read__s'),
          lgSel: q('.storms-lg__sel', lg), lgCur: q('.storms-lg__cur', lg), lgV: q('.storms-lg__v', lg)
        }
      };
      const my = V;
      V.tick = makeTick();
      sync();
      // the map
      ctx.layer(hailLayer());
      ctx.layer(marksLayer());
      // leaving: the layer fades for 200 ms drawing the last state (FADE), then its dispose() frees the GPU side
      ctx.own(() => { if (V === my) { FADE = V; V = null; } const s = snd(); if (s) s.hailBed(0); A.world.unpin('storms-zone'); });
      // controls
      V.dom.play.addEventListener('click', () => togglePlay());
      q('.storms-prev').addEventListener('click', () => step(-1));
      q('.storms-next').addEventListener('click', () => step(1));
      const past = q('.storms-past');
      past.addEventListener('click', () => { V.past = !V.past; past.setAttribute('aria-pressed', String(V.past)); dock.classList.toggle('is-past', V.past); A.world.invalidate('top'); });
      A.$$('[data-speed]', dock).forEach((b) => b.addEventListener('click', () => { V.speed = +b.dataset.speed || 1; A.$$('[data-speed]', dock).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
      card.addEventListener('click', (e) => {
        const z = e.target.closest('.storms-zone[data-area]');
        if (z) { const a = AREA[z.dataset.area]; if (a) focusArea(a); return; }
        if (e.target.closest('.storms-knock')) { const id = knockId(V.sel); if (id) knockThis(id); return; }
        if (e.target.closest('.storms-replay')) { if (V.sel) startDay(V.sel); }
      });
      bindTimeline();
      // keys: Space plays, arrows step through storm days (the map keeps its own arrows when it has focus)
      const onKey = (e) => {
        if (A.view.current !== 'storms' || e.metaKey || e.ctrlKey || e.altKey || (A.intro && A.intro.active) || (A.director && A.director.active)) return;
        const t = e.target;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
        if (t && t.closest && t.closest('#world')) return;
        const onBtn = t && t.closest && t.closest('button, a[href]');
        if (e.key === ' ' || e.key === 'Spacebar') { if (onBtn) return; e.preventDefault(); if (V.mode === 'intro') endIntro(true); else togglePlay(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      };
      document.addEventListener('keydown', onKey); ctx.own(() => document.removeEventListener('keydown', onKey));
      ctx.on('escape', () => { if (!V) return; if (V.mode === 'intro') endIntro(true); else if (V.mode === 'play') pause(); });
      ctx.on('theme', () => { A.world.invalidate(); });
      // the live legend reads the season field under the cursor (only what has happened by the playhead)
      let hovRaf = 0, hovE = null;
      const onMove = (e) => { hovE = e; if (!hovRaf) hovRaf = requestAnimationFrame(() => { hovRaf = 0; A.safe('storms legend', () => legend(hovE)); }); };
      const onLeave = () => legend(null);
      const onTap = (e) => { if (e.pointerType !== 'mouse') onMove(e); };   // touch: a tap reads the hail there
      A.world.el.addEventListener('pointermove', onMove, { passive: true }); A.world.el.addEventListener('pointerleave', onLeave);
      A.world.el.addEventListener('pointerdown', onTap, { passive: true });
      ctx.own(() => { A.world.el.removeEventListener('pointermove', onMove); A.world.el.removeEventListener('pointerleave', onLeave); A.world.el.removeEventListener('pointerdown', onTap); cancelAnimationFrame(hovRaf); });
      // entering: the season replays fast once, then rests on the latest storm day
      if (A.still) {
        V.p = LAST ? LAST.d + 1 : END; setSel(LAST, { force: true, quiet: true }); sync();
        ctx.timer(() => { if (V === my) startDay(LAST); }, 30);
      } else {
        V.p = 0; setSel(LAST, { force: true, quiet: true }); sync();
        const skipIntro = (e) => { if (V && V.mode === 'intro' && !(e.target.closest && e.target.closest('#topbar'))) endIntro(true); };
        document.addEventListener('pointerdown', skipIntro, true); ctx.own(() => document.removeEventListener('pointerdown', skipIntro, true));
        ctx.timer(() => prepare(LAST), 40);
        ctx.timer(() => { if (!V || V.mode !== 'idle' || V.p > 0) return; V.pIntro = LAST ? LAST.d + 1 : END; V.t0 = null; V.mode = 'intro'; V.readDay = -1; V.dom.card.classList.add('is-replaying'); wake(); }, 520);
        ctx.timer(() => { const go = () => A.safe('storms warm hail', warmSharedHail); if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 2500 }); else go(); }, 4200);
      }
    }
  });

  function legend(e) {
    if (!V || !V.dom.lgV) return;
    let v = null;
    if (e && SEASON) {
      const r = A.world.el.getBoundingClientRect(), ll = A.world.unproject([e.clientX - r.left, e.clientY - r.top]), w = A.world.toWorld(ll), F = SEASON.field;
      const fx = Math.floor(((w[0] - F.x0) / (F.x1 - F.x0)) * F.w), fy = Math.floor(((w[1] - F.y0) / (F.y1 - F.y0)) * F.h);
      if (fx >= 0 && fy >= 0 && fx < F.w && fy < F.h) { const i = fy * F.w + fx; v = F.arrival[i] <= revealAt(V.p) + 1e-4 ? F.data[i] : 0; }
    }
    const on = v != null && v >= 0.5;
    V.dom.lgV.innerHTML = v == null ? '–' : on ? A.both(() => A.fmt.inches(v, 2)) + ' <span class="storms-lg__m">' + Le('modeled', 'modelado') + '</span>' : Le('no hail modeled', 'sin granizo modelado');
    V.dom.lgV.dataset.h = on ? A.ui.hailKey(v) : '';
    V.dom.lgCur.style.opacity = on ? '1' : '0';
    if (on) V.dom.lgCur.style.transform = 'translateX(' + (lgPos(v) * 100).toFixed(2) + '%)';
  }
  /** "Knock this storm": open Now and hand it the zone the moment Now's panels exist (not after the camera lands).
      The listener is global on purpose: this view's own listeners are cleaned up while Now enters. */
  function knockThis(id) {
    let off = null;
    const done = () => { if (off) { off(); off = null; } };
    off = A.on('view', (d) => { if (d && d.name === 'now') { done(); A.emit('zone:focus', id); } else if (d && d.name !== 'storms') done(); });
    setTimeout(done, 4000);
    A.view.go('now');
  }
  function focusArea(a) {
    if (!a || !a.ring) return;
    A.world.flyTo({ points: a.ring, pad: 70, maxZoom: 12.4 });
    const el = A.h('<div class="storms-pin"><span class="mk-ring mk-ring--pulse"></span><span class="mk-label">' + Lo(a.name) + ' <span class="t-mono">' + A.both(() => A.fmt.inches(a.hail)) + '</span></span></div>');
    if (V) V.ctx.pin('storms-zone', a.c, el, { anchor: 'center' });
    const s = snd(); if (s) s.knock({ count: 2, gain: 0.7 });
  }

  /* build the season field in idle time after the app is up, so the first visit to #storms never waits on it */
  A.once('ready', () => {
    // CPU only (fields + samplers, ~0.4 s once): GPU kits exist only while #storms is on screen
    const go = () => A.safe('storms prebuild', () => { seasonField(); if (LAST) dayField(LAST); });
    if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 4000 }); else setTimeout(go, 1500);
  });

  /* the director's handle */
  A.stormsDemo = {
    select: (date) => select(date, { from: 'demo' }),
    play: () => play(),
    pause: () => pause(),
    seek: (p) => seek(p),
    get active() { return !!V; },
    days: DAYS.map((D) => D.date)
  };
})();
