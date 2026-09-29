/* Claude's Aldaba · world.js → A.world
   The one map every view flies over. Real Nebraska geography (data/nl.js), drawn from cached Path2D in world units
   (Canvas2D), a WebGL canvas above it for layers that want the GPU, a 2D top canvas for labels and marks, DOM pins.
   Camera flights use van Wijk & Nuij smooth zoom (rho 1.4). One rAF loop (A.motion.ticker) that idles when nothing
   moves and pauses with the tab. Ambient life: the KOAX radar beam slowly sweeps and lights the hail it passes.
   Owner: foundation. API: CONTRACT.md. */
(function () {
  'use strict';
  const A = window.A;
  if (!A) { console.warn('[aldaba] world.js needs core.js'); return; }
  const N = A.data || {}, X = A.x || {};
  const D2R = Math.PI / 180, LON0 = -96.6, LAT0 = 41.275, KX = Math.cos(LAT0 * D2R), MI = 69.05;
  const ZMIN = 6, ZMAX = 20.5;
  const W = (A.world = { hasGL: false, gl: null, gl2: false, glGen: 0, el: null, w: 0, h: 0, dpr: 1, MI, ready: false });
  const toW = (lon, lat) => [(lon - LON0) * KX, LAT0 - lat];
  W.toWorld = (p) => toW(p[0], p[1]);
  W.toLonLat = (p) => [p[0] / KX + LON0, LAT0 - p[1]];
  const BBOX = (X.storms2026 && X.storms2026.area && X.storms2026.area.bbox) || [-97.9, 40.35, -95.3, 42.2];
  W.bbox = BBOX.slice();
  /** handy camera targets: pass to flyTo({bounds: W.presets.region}) */
  W.presets = {
    state: [[BBOX[0], BBOX[1]], [BBOX[2], BBOX[3]]],
    region: [[-97.62, 41.16], [-95.86, 41.62]],
    fremont: [[-96.56, 41.40], [-96.44, 41.48]],
    columbus: [[-97.43, 41.40], [-97.31, 41.47]]
  };
  const sm = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const hitBB = (b, v) => b[0] <= v[2] && b[2] >= v[0] && b[1] <= v[3] && b[3] >= v[1];
  const clampZ = (z) => Math.min(ZMAX, Math.max(ZMIN, z));
  const warned = new Set();
  const warnOnce = (k, e) => { if (!warned.has(k)) { warned.add(k); console.warn('[aldaba] ' + k + ':', e); } };

  /* ======================= geometry: world-unit Path2D chunks, binned for culling ======================= */
  const G = {};
  function addPath(cls, cell, pts, closed) {
    if (!pts || pts.length < 2) return;
    const g = G[cls] || (G[cls] = { bins: new Map(), chunks: [] });
    const step = closed ? pts.length : 40;
    for (let s = 0; s < pts.length - 1; s += step - 1) {
      const piece = closed ? pts : pts.slice(s, s + step);
      if (piece.length < 2) break;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const ws = piece.map((p) => { const w = toW(p[0], p[1]); if (w[0] < x0) x0 = w[0]; if (w[0] > x1) x1 = w[0]; if (w[1] < y0) y0 = w[1]; if (w[1] > y1) y1 = w[1]; return w; });
      const key = Math.floor((x0 + x1) / 2 / cell) + ',' + Math.floor((y0 + y1) / 2 / cell);
      let b = g.bins.get(key);
      if (!b) { b = { p: new Path2D(), bb: [Infinity, Infinity, -Infinity, -Infinity] }; g.bins.set(key, b); g.chunks.push(b); }
      b.p.moveTo(ws[0][0], ws[0][1]);
      for (let i = 1; i < ws.length; i++) b.p.lineTo(ws[i][0], ws[i][1]);
      if (closed) b.p.closePath();
      if (x0 < b.bb[0]) b.bb[0] = x0; if (y0 < b.bb[1]) b.bb[1] = y0; if (x1 > b.bb[2]) b.bb[2] = x1; if (y1 > b.bb[3]) b.bb[3] = y1;
      if (closed) break;
    }
  }
  const MAJOR = new Set(['Missouri River', 'Platte River', 'Elkhorn River', 'Loup River']);
  function prepGeometry() {
    for (const b of N.base || []) {
      if (b.k === 'town') addPath('town', 0.3, b.p, true);
      else if (b.k === 'water') addPath('water', 0.3, b.p, b.poly !== false);
      else if (b.k === 'stream') addPath(MAJOR.has(b.n) ? 'river' : 'stream', 0.3, b.p, false);
      else if (b.k === 'county') addPath('county', 0.5, b.p, false);
      else if (b.k === 'rail') addPath('rail', 0.3, b.p, false);
      else if (b.k === 'hwy') addPath(b.t === 'I' ? 'interstate' : 'hwy', 0.3, b.p, false);
    }
    for (const a of N.arts || []) addPath(a.c === 0 ? 'art0' : 'art1', 0.1, a.p, false);
    for (const s of (N.fremont || []).concat(N.columbus || [])) addPath(s.c === 1 ? 'street2' : 'street', 0.04, s.p, false);
  }

  /* ======================= label candidates ======================= */
  const LBL = { places: [], towns: [], rivers: [], hwys: [], streets: [] };
  function prettyStreet(n) {
    let s = String(n || '').trim();
    s = s.replace(/\b(\d+)(ST|ND|RD|TH)\b/gi, (m, d, x) => d + x.toLowerCase());
    s = s.replace(/\b([A-Z])([A-Z]+)\b/g, (m, a, b) => a + b.toLowerCase());
    const ab = { Street: 'St', Avenue: 'Ave', Road: 'Rd', Drive: 'Dr', Boulevard: 'Blvd', Place: 'Pl', Court: 'Ct', Lane: 'Ln', Parkway: 'Pkwy', Circle: 'Cir', Highway: 'Hwy' };
    return s.replace(/\b(Street|Avenue|Road|Drive|Boulevard|Place|Court|Lane|Parkway|Circle|Highway)\b/g, (m) => ab[m]);
  }
  function anchorsAlong(pts, every, first) {
    const out = []; let acc = every - (first == null ? every / 2 : first);
    const ws = pts.map((p) => toW(p[0], p[1]));
    for (let i = 1; i < ws.length; i++) {
      const dx = ws[i][0] - ws[i - 1][0], dy = ws[i][1] - ws[i - 1][1], L = Math.hypot(dx, dy);
      if (!L) continue;
      let t = every - acc;
      while (t <= L) { const k = t / L; out.push({ w: [ws[i - 1][0] + dx * k, ws[i - 1][1] + dy * k], d: [dx / L, dy / L] }); t += every; }
      acc = (acc + L) % every;
    }
    return out;
  }
  function prepLabels() {
    const BIG = new Set(['Omaha', 'Lincoln', 'Fremont', 'Columbus']);
    const places = N.places || {};
    for (const n in places) LBL.places.push({ n, w: toW(places[n][0], places[n][1]), tier: BIG.has(n) ? 1 : 2 });
    LBL.places.sort((a, b) => a.tier - b.tier);
    const byName = new Map();
    for (const b of N.base || []) {
      if (b.k !== 'town' || !b.n || places[b.n]) continue;
      let sx = 0, sy = 0; b.p.forEach((p) => { sx += p[0]; sy += p[1]; });
      const len = b.p.length, cur = byName.get(b.n);
      if (!cur || len > cur.len) byName.set(b.n, { n: b.n, w: toW(sx / len, sy / len), a: b.a || 0, len });
    }
    LBL.towns = Array.from(byName.values()).sort((a, b) => b.a - a.a);
    const rivers = new Map();
    for (const b of N.base || []) if (b.k === 'stream' && MAJOR.has(b.n)) {
      const arr = rivers.get(b.n) || []; anchorsAlong(b.p, 0.34, 0.12).forEach((a) => arr.push(a)); rivers.set(b.n, arr);
    }
    rivers.forEach((arr, n) => arr.forEach((a) => LBL.rivers.push(Object.assign({ n }, a))));
    for (const b of N.base || []) if (b.k === 'hwy' && b.n) anchorsAlong(b.p, 0.3, 0.1).forEach((a) => LBL.hwys.push({ n: b.n.replace('-', ' '), t: b.t, w: a.w }));
    for (const s of N.columbus || []) {
      if (!s.n || s.p.length < 2) continue;
      let best = null, bl = 0;
      for (let i = 1; i < s.p.length; i++) { const a = toW(s.p[i - 1][0], s.p[i - 1][1]), b = toW(s.p[i][0], s.p[i][1]); const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L > bl) { bl = L; best = [a, b]; } }
      if (best) LBL.streets.push({ n: prettyStreet(s.n), a: best[0], b: best[1], L: bl, bb: [Math.min(best[0][0], best[1][0]), Math.min(best[0][1], best[1][1]), Math.max(best[0][0], best[1][0]), Math.max(best[0][1], best[1][1])] });
    }
    LBL.streets.sort((a, b) => b.L - a.L);
  }

  /* ======================= palette (tokens → canvas colors) ======================= */
  let pal = {};
  const PK = { land: '--map-land', water: '--map-water', waterLine: '--map-water-line', waterLabel: '--map-water-label', stream: '--map-stream', river: '--map-river', town: '--map-town', townLine: '--map-town-line', county: '--map-county', grid: '--map-grid', rail: '--map-rail', street: '--map-street', street2: '--map-street-2', art: '--map-art', hwy: '--map-hwy', label: '--map-label', label2: '--map-label-2', halo: '--map-halo', beam: '--map-beam', page: '--page', panel: '--panel', panel2: '--panel-2', panel3: '--panel-3', text: '--text', text2: '--text-2', muted: '--muted', faint: '--faint', rule: '--rule', rule2: '--rule-2', rule3: '--rule-3', acc: '--acc', accInk: '--acc-ink', accBg: '--acc-bg', onAcc: '--on-acc', h0: '--h0', h1: '--h1', h15: '--h15', h2: '--h2', ok: '--ok', bad: '--bad', info: '--info', shadow: '--shadow' };
  function readPal() {
    const p = {};
    for (const k in PK) p[k] = A.tok(PK[k]) || '#888';
    p.rgb = {}; for (const k of ['h0', 'h1', 'h15', 'h2', 'acc', 'beam', 'page', 'text', 'text2', 'muted', 'water', 'land', 'panel']) p.rgb[k] = A.rgba(p[k]);
    p.light = A.theme === 'light';
    pal = p; W.pal = p;
  }
  /** hail size → canvas color from the hail scale tokens */
  W.hailColor = (v) => (v == null || v < 1 ? pal.h0 : v < 1.5 ? pal.h1 : v < 2 ? pal.h15 : pal.h2);

  /* ======================= camera ======================= */
  const cam = { x: 0, y: 0, z: 9 };
  let insetCur = { l: 0, r: 0, t: 0, b: 0 }, insetTo = { l: 0, r: 0, t: 0, b: 0 }, insetTw = null;
  let flight = null, inertia = null, zoomAnim = null, dimCur = 0, dimTo = 0;
  let opts = { labels: true, streetNames: true, hud: true };
  Object.defineProperty(W, 'inset', { get: () => Object.assign({}, insetCur) });
  Object.defineProperty(W, 'insetTarget', { get: () => Object.assign({}, insetTo) });
  Object.defineProperty(W, 'zoom', { get: () => cam.z });

  function mkFrame(now, dt) {
    if (!W.w) { W.w = 1; W.h = 1; }
    const s = Math.pow(2, cam.z), ins = insetCur;
    const fw = Math.max(40, W.w - ins.l - ins.r), fh = Math.max(40, W.h - ins.t - ins.b);
    const ox = ins.l + fw / 2 - cam.x * s, oy = ins.t + fh / 2 - cam.y * s;
    const a = (2 * s) / W.w, b = (2 * ox) / W.w - 1, c = (-2 * s) / W.h, d = 1 - (2 * oy) / W.h;
    const v = [-ox / s, -oy / s, (W.w - ox) / s, (W.h - oy) / s];
    const nw = W.toLonLat([v[0], v[1]]), se = W.toLonLat([v[2], v[3]]);
    const f = {
      t: now || performance.now(), dt: dt || 16.7, w: W.w, h: W.h, dpr: W.dpr, zoom: cam.z, scale: s, ox, oy, px: 1 / s, pxPerMile: s / MI,
      inset: Object.assign({}, ins), focus: { x: ins.l, y: ins.t, w: fw, h: fh },
      cam: { center: W.toLonLat([cam.x, cam.y]), zoom: cam.z }, view: v, bbox: [nw[0], se[1], se[0], nw[1]],
      pal, lang: A.lang, still: A.still, theme: A.theme, alpha: 1, moving: false, dim: dimCur,
      m: new Float32Array([a, 0, 0, 0, c, 0, b, d, 1]), inv: new Float32Array([1 / a, 0, 0, 0, 1 / c, 0, -b / a, -d / c, 1])
    };
    f.project = (ll) => [((ll[0] - LON0) * KX) * s + ox, (LAT0 - ll[1]) * s + oy];
    f.projectW = (x, y) => [x * s + ox, y * s + oy];
    f.unproject = (p) => W.toLonLat([(p[0] - ox) / s, (p[1] - oy) / s]);
    f.toWorldCtx = (ctx, r) => { r = r || (ctx.canvas && ctx.canvas.width ? ctx.canvas.width / W.w : W.dpr); ctx.setTransform(s * r, 0, 0, s * r, ox * r, oy * r); };
    f.toScreenCtx = (ctx, r) => { r = r || (ctx.canvas && ctx.canvas.width ? ctx.canvas.width / W.w : W.dpr); ctx.setTransform(r, 0, 0, r, 0, 0); };
    f.inView = (ll, m = 40) => { const q = f.project(ll); return q[0] > -m && q[1] > -m && q[0] < W.w + m && q[1] < W.h + m; };
    return f;
  }
  /** current frame (built on demand; use inside layers via the f argument instead) */
  W.frame = () => mkFrame(performance.now(), 16.7);
  W.project = (ll) => mkFrame().project(ll);
  W.unproject = (p) => mkFrame().unproject(p);
  W.camera = () => ({ center: W.toLonLat([cam.x, cam.y]), zoom: cam.z });

  function focusDims(ins) { ins = ins || insetTo; return { w: Math.max(40, W.w - ins.l - ins.r), h: Math.max(40, W.h - ins.t - ins.b) }; }
  function padOf(p) { if (p == null) p = 48; if (typeof p === 'number') return { t: p, r: p, b: p, l: p }; return { t: p.t || 0, r: p.r || 0, b: p.b || 0, l: p.l || 0 }; }
  /** target → {x, y, z} in world units */
  function resolve(tg) {
    if (!tg) return { x: cam.x, y: cam.y, z: cam.z };
    const fd = focusDims();
    if (tg.bounds || tg.points) {
      const pts = tg.points || tg.bounds;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of pts) { const w = toW(p[0], p[1]); x0 = Math.min(x0, w[0]); x1 = Math.max(x1, w[0]); y0 = Math.min(y0, w[1]); y1 = Math.max(y1, w[1]); }
      const pd = padOf(tg.pad), aw = Math.max(20, fd.w - pd.l - pd.r), ah = Math.max(20, fd.h - pd.t - pd.b);
      let z = Math.log2(Math.min(aw / Math.max(1e-7, x1 - x0), ah / Math.max(1e-7, y1 - y0)));
      z = Math.min(z, tg.maxZoom == null ? 18.6 : tg.maxZoom); if (tg.minZoom != null) z = Math.max(z, tg.minZoom);
      z = clampZ(z); const s = Math.pow(2, z);
      return { x: (x0 + x1) / 2 + (pd.r - pd.l) / 2 / s, y: (y0 + y1) / 2 + (pd.b - pd.t) / 2 / s, z };
    }
    const c = tg.center ? toW(tg.center[0], tg.center[1]) : [cam.x, cam.y];
    const z = clampZ(tg.zoom == null ? cam.z : tg.zoom), s = Math.pow(2, z);
    const off = tg.offset || [0, 0];
    return { x: c[0] - off[0] / s, y: c[1] - off[1] / s, z };
  }
  W.resolve = (tg) => { const r = resolve(tg); return { center: W.toLonLat([r.x, r.y]), zoom: r.z }; };

  /* van Wijk & Nuij smooth zoom (as in d3.interpolateZoom) */
  function interpZoom(p0, p1, rho) {
    const rho2 = rho * rho, rho4 = rho2 * rho2;
    const ux0 = p0[0], uy0 = p0[1], w0 = p0[2], ux1 = p1[0], uy1 = p1[1], w1 = p1[2];
    const dx = ux1 - ux0, dy = uy1 - uy0, d2 = dx * dx + dy * dy;
    let i, S;
    if (d2 < 1e-14) {
      S = Math.log(w1 / w0) / rho;
      i = (t) => [ux0 + t * dx, uy0 + t * dy, w0 * Math.exp(rho * t * S)];
    } else {
      const d1 = Math.sqrt(d2);
      const b0 = (w1 * w1 - w0 * w0 + rho4 * d2) / (2 * w0 * rho2 * d1), b1 = (w1 * w1 - w0 * w0 - rho4 * d2) / (2 * w1 * rho2 * d1);
      const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0), r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
      S = (r1 - r0) / rho;
      const ch = Math.cosh(r0), sh = Math.sinh(r0);
      i = (t) => { const s = t * S, u = (w0 / (rho2 * d1)) * (ch * Math.tanh(rho * s + r0) - sh); return [ux0 + u * dx, uy0 + u * dy, (w0 * ch) / Math.cosh(rho * s + r0)]; };
    }
    i.duration = (Math.abs(S) * 1000 * rho) / Math.SQRT2;
    return i;
  }
  function endFlight(done) { if (flight) { const r = flight.res; flight = null; r(done); } }
  function stopMotion() { endFlight(false); inertia = null; zoomAnim = null; }
  /** flyTo({center:[lon,lat], zoom} | {bounds:[[w,s],[e,n]]} | {points:[..]}, {ms, speed, rho, instant, ease}) → Promise<boolean> */
  W.flyTo = function (tg, o = {}) {
    const t = resolve(tg);
    stopMotion();
    if (o.instant || o.ms === 0 || A.still || !W.w) { cam.x = t.x; cam.y = t.y; cam.z = t.z; invalidate(); return Promise.resolve(true); }
    const fw = focusDims(insetCur).w;
    const p0 = [cam.x, cam.y, fw / Math.pow(2, cam.z)], p1 = [t.x, t.y, fw / Math.pow(2, t.z)];
    if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * Math.pow(2, cam.z) < 0.5 && Math.abs(t.z - cam.z) < 0.004) return Promise.resolve(true);
    const I = interpZoom(p0, p1, o.rho || 1.4);
    const ms = o.ms != null ? o.ms : Math.min(2400, Math.max(700, I.duration * 0.85 * (o.speed || 1)));
    const ease = typeof o.ease === 'function' ? o.ease : A.motion.ease[o.ease || 'inOutCubic'];
    return new Promise((res) => { flight = { I, t0: null, ms, ease, res, fw, target: t }; wake(); });
  };
  W.jump = (tg) => W.flyTo(tg, { instant: true });
  W.fit = (bounds, o = {}) => W.flyTo({ bounds, pad: o.pad, maxZoom: o.maxZoom }, o);
  W.stop = () => stopMotion();
  W.panBy = function (dx, dy, o = {}) { const s = Math.pow(2, cam.z); return W.flyTo({ center: W.toLonLat([cam.x + dx / s, cam.y + dy / s]), zoom: cam.z }, { ms: o.ms == null ? 260 : o.ms, ease: 'outCubic' }); };
  W.zoomBy = function (dz, at) {
    zoomAnim = { to: clampZ((zoomAnim ? zoomAnim.to : cam.z) + dz), at: at || [insetCur.l + focusDims(insetCur).w / 2, insetCur.t + focusDims(insetCur).h / 2] };
    endFlight(false); inertia = null; wake();
  };
  function zoomAround(p, z2) {
    const s0 = Math.pow(2, cam.z), f = focusDims(insetCur), cx = insetCur.l + f.w / 2, cy = insetCur.t + f.h / 2;
    const wx = cam.x + (p[0] - cx) / s0, wy = cam.y + (p[1] - cy) / s0;
    cam.z = clampZ(z2); const s1 = Math.pow(2, cam.z);
    cam.x = wx - (p[0] - cx) / s1; cam.y = wy - (p[1] - cy) / s1;
  }
  function panPx(dx, dy) { const s = Math.pow(2, cam.z); cam.x -= dx / s; cam.y -= dy / s; }
  /** setInset({l,r,t,b}, {ms}) the free map area between panels; the camera center stays put, the map slides */
  W.setInset = function (ins, o = {}) {
    const n = { l: ins.l || 0, r: ins.r || 0, t: ins.t || 0, b: ins.b || 0 };
    hudIns = { r: ins.hudR != null ? ins.hudR : n.r, b: ins.hudB != null ? ins.hudB : n.b }; hudLast = '';
    insetTo = n;
    if (!o.ms || A.still) { insetCur = Object.assign({}, n); insetTw = null; invalidate(); return; }
    insetTw = { from: Object.assign({}, insetCur), to: n, t0: null, ms: o.ms }; wake();
  };
  /** setDim(0..1, {ms}) push the basemap back (money view, overlays) */
  W.setDim = function (v, o = {}) {
    dimTo = Math.min(1, Math.max(0, v || 0));
    if (A.still || o.ms === 0) dimCur = dimTo;
    if (veil) veil.style.opacity = String(dimTo * 0.78); // CSS transition carries it
    wake(); invalidate('top');
  };
  W.options = function (o) { Object.assign(opts, o || {}); if (hudEl) hudEl.hidden = !opts.hud; invalidate(); return Object.assign({}, opts); };

  /* ======================= layers ======================= */
  const layers = [];
  const LAB_Z = 150;
  function sortLayers() { layers.sort((a, b) => a.z - b.z); }
  function getL(id) { return layers.find((l) => l.id === id) || null; }
  function disposeL(L) { const i = layers.indexOf(L); if (i >= 0) layers.splice(i, 1); try { L.dispose && L.dispose(W.gl); } catch (e) { warnOnce('layer ' + L.id + ' dispose', e); } invalidate(); }
  W.layer = {
    /** add({id, z, draw2d(ctx,f), drawGL(gl,f), hit(pt,f), onClick(item,pt), onHover(item,pt), live, opacity, fadeIn, dispose(gl)}) */
    add(def) {
      if (!def || !def.id) { console.warn('[aldaba] layer needs an id'); return null; }
      const old = getL(def.id); if (old) disposeL(old);
      const L = Object.assign({ z: 50, opacity: 1, live: false, visible: true, fadeIn: true }, def);
      L._target = L.opacity; L._op = L.fadeIn && !A.still ? 0 : L.opacity; L._ms = def.fadeMs || 320;
      layers.push(L); sortLayers(); invalidate();
      return L;
    },
    remove(id, o = {}) {
      const L = getL(id); if (!L) return;
      if (o.ms && !A.still && L._op > 0.01) { L._target = 0; L._ms = o.ms; L._kill = true; wake(); } else disposeL(L);
    },
    get: getL,
    list: () => layers.map((l) => l.id),
    /** opacity(id, v, {ms}) animated */
    opacity(id, v, o = {}) { const L = getL(id); if (!L) return; L.opacity = v; L._target = v; L._kill = false; L._ms = o.ms == null ? 320 : o.ms; if (!L._ms || A.still) L._op = v; invalidate(); },
    set(id, patch) { const L = getL(id); if (L) { Object.assign(L, patch); if ('z' in patch) sortLayers(); invalidate(); } return L; }
  };

  /* ======================= pins (DOM markers) ======================= */
  const pins = new Map();
  let pinsEl = null;
  const ANCH = { center: 'translate(-50%,-50%)', bottom: 'translate(-50%,-100%)', top: 'translate(-50%,0)', left: 'translate(0,-50%)', right: 'translate(-100%,-50%)', none: '' };
  /** pin(id, [lon,lat], element, {anchor:'center'|'bottom'|..., minZoom, maxZoom, offset:[dx,dy]}) → element */
  W.pin = function (id, ll, node, o = {}) {
    W.unpin(id);
    if (!node || !pinsEl) return node;
    node.classList.add('pin'); node.dataset.pin = id;
    pinsEl.appendChild(node);
    pins.set(id, { ll: ll.slice(), node, t: ANCH[o.anchor || 'center'] || '', min: o.minZoom == null ? -1 : o.minZoom, max: o.maxZoom == null ? 99 : o.maxZoom, dx: (o.offset || [0, 0])[0], dy: (o.offset || [0, 0])[1], off: null });
    placePins(mkFrame());
    return node;
  };
  W.unpin = function (id) { const P = pins.get(id); if (P) { P.node.remove(); pins.delete(id); } };
  W.movePin = function (id, ll) { const P = pins.get(id); if (P) { P.ll = ll.slice(); placePins(mkFrame()); } };
  W.pins = () => Array.from(pins.keys());
  function placePins(f) {
    for (const P of pins.values()) {
      const q = f.project(P.ll);
      const off = q[0] < -90 || q[1] < -90 || q[0] > f.w + 90 || q[1] > f.h + 90 || f.zoom < P.min || f.zoom > P.max;
      if (off !== P.off) { P.off = off; P.node.classList.toggle('is-off', off); }
      if (!off) { const x = Math.round((q[0] + P.dx) * f.dpr) / f.dpr, y = Math.round((q[1] + P.dy) * f.dpr) / f.dpr; P.node.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) ' + P.t; }
    }
  }

  /* ======================= canvases + loop ======================= */
  let el, cvB, cvG, cvT, veil, hudEl, cB, cT, cG2 = null, cache = null, cC = null;
  let dirty = { base: true, gl: true, top: true }, running = false, keepUntil = 0, lastInput = performance.now();
  let lastKey = '', lastAmb = 0, ambientOn = true, sweepA = 2.2, movingPrev = false, drag1 = false;
  function invalidate(what) { if (!what) { dirty.base = dirty.gl = dirty.top = true; } else dirty[what] = true; wake(); }
  W.invalidate = invalidate;
  W.keepAlive = (ms) => { keepUntil = Math.max(keepUntil, performance.now() + (ms || 500)); wake(); };
  function wake() { if (!running && el) { running = true; A.motion.ticker.add(frame); } }
  /** ambient(true|false) the radar beam; it also rests by itself after 90 s without input */
  W.ambient = function (on) { ambientOn = on !== false; invalidate('gl'); };
  function ambientActive(now) { return ambientOn && !A.still && !document.hidden && W.hasGL && now - lastInput < 90000 && (getL('hail') || {})._op > 0.05; }

  function resize() {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height)), d = Math.min(2, window.devicePixelRatio || 1);
    if (w === W.w && h === W.h && d === W.dpr) return;
    W.w = w; W.h = h; W.dpr = d;
    for (const c of [cvG, cvT]) if (c) { c.width = Math.round(w * d); c.height = Math.round(h * d); }
    setBaseRes(baseRes || d, true);
    invalidate();
  }

  /* the basemap is the heaviest raster: it draws at 1x while the camera moves and at full DPR once it rests */
  let baseRes = 0, restTimer = 0;
  function setBaseRes(r, force) {
    if (!cvB || (!force && r === baseRes)) return;
    baseRes = r;
    const bw = Math.round(W.w * r), bh = Math.round(W.h * r);
    if (cvB.width !== bw || cvB.height !== bh) { cvB.width = bw; cvB.height = bh; }
    if (cache && (cache.width !== bw || cache.height !== bh)) { cache.width = bw; cache.height = bh; cache._k = ''; }
    dirty.base = true;
  }
  function frame(now, dt) {
    if (!el) { running = false; return false; }
    let anim = false;
    // camera motion
    if (flight) {
      if (flight.t0 == null) flight.t0 = now;
      const k = Math.min(1, (now - flight.t0) / flight.ms), p = flight.I(flight.ease(k));
      const fw = focusDims(insetCur).w;
      cam.x = p[0]; cam.y = p[1]; cam.z = clampZ(Math.log2(fw / p[2]));
      if (k >= 1) { cam.x = flight.target.x; cam.y = flight.target.y; cam.z = flight.target.z; endFlight(true); } else anim = true;
    }
    if (inertia) {
      panPx(inertia.vx * dt, inertia.vy * dt);
      const decay = Math.exp(-dt / 325); inertia.vx *= decay; inertia.vy *= decay;
      if (Math.hypot(inertia.vx, inertia.vy) < 0.01) inertia = null; else anim = true;
    }
    if (zoomAnim) {
      const dz = (zoomAnim.to - cam.z) * (1 - Math.exp(-dt / 70));
      zoomAround(zoomAnim.at, Math.abs(zoomAnim.to - cam.z) < 0.002 ? zoomAnim.to : cam.z + dz);
      if (cam.z === zoomAnim.to) zoomAnim = null; else anim = true;
    }
    if (insetTw) {
      if (insetTw.t0 == null) insetTw.t0 = now;
      const k = Math.min(1, (now - insetTw.t0) / insetTw.ms), e = A.motion.ease.inOutCubic(k), a = insetTw.from, b = insetTw.to;
      insetCur = { l: a.l + (b.l - a.l) * e, r: a.r + (b.r - a.r) * e, t: a.t + (b.t - a.t) * e, b: a.b + (b.b - a.b) * e };
      if (k >= 1) { insetCur = Object.assign({}, b); insetTw = null; } else anim = true;
    }
    if (dimCur !== dimTo) {
      const st = dt / 500; dimCur = dimCur < dimTo ? Math.min(dimTo, dimCur + st) : Math.max(dimTo, dimCur - st);
      dirty.top = true; anim = anim || dimCur !== dimTo;
    }
    // layer fades
    for (const L of layers.slice()) {
      if (L._op !== L._target) {
        const st = dt / (L._ms || 320); L._op = L._op < L._target ? Math.min(L._target, L._op + st) : Math.max(L._target, L._op - st);
        markLayerDirty(L); anim = true;
      } else if (L._kill && L._op <= 0.001) disposeL(L);
      if (L.live && L.visible !== false && L._op > 0.003) { markLayerDirty(L); anim = true; }
    }
    const key = cam.x.toFixed(10) + ',' + cam.y.toFixed(10) + ',' + cam.z.toFixed(6) + ',' + insetCur.l.toFixed(1) + ',' + insetCur.r.toFixed(1) + ',' + insetCur.t.toFixed(1) + ',' + insetCur.b.toFixed(1) + ',' + W.w + ',' + W.h + ',' + W.dpr;
    const moved = key !== lastKey; lastKey = key;
    if (moved) dirty.base = dirty.gl = dirty.top = true;
    if (W.dpr > 1) {
      if (moved && (flight || inertia || zoomAnim || drag1 || insetTw)) { restTimer = now; setBaseRes(1); }
      else if (baseRes !== W.dpr && now - restTimer > 90) setBaseRes(W.dpr);
      if (baseRes !== W.dpr) anim = true;
    }
    // ambient beam (throttled to ~30 fps when it is the only thing moving)
    const amb = ambientActive(now);
    let ambDraw = false;
    if (amb) {
      sweepA -= (dt / 1000) * ((2 * Math.PI) / 14);
      if (moved || anim || now - lastAmb > 32) { ambDraw = true; lastAmb = now; }
      if (ambDraw) dirty.gl = true;
    }
    const any = dirty.base || dirty.gl || dirty.top;
    if (any) {
      const f = mkFrame(now, dt); f.moving = moved; f.sweep = sweepA; f.ambient = amb;
      W.last = f;
      try { render(f); } catch (e) { warnOnce('render', e); }
      if (moved) { placePins(f); updateHud(f); A.emit('camera', { center: f.cam.center, zoom: f.zoom, moving: true }); }
    }
    if (movingPrev && !moved && !anim) A.emit('camera:end', W.camera());
    movingPrev = moved;
    const alive = anim || amb || now < keepUntil || dirty.base || dirty.gl || dirty.top;
    if (!alive) { running = false; return false; }
    return true;
  }
  function usesGL(L) { return !!L.drawGL && W.hasGL; }
  function markLayerDirty(L) { if (usesGL(L) || (L.drawGL && !W.hasGL)) dirty.gl = true; else if (L.z < 100) dirty.base = true; else dirty.top = true; }

  function render(f) {
    const unders = layers.filter((L) => !L.drawGL && L.draw2d && L.z < 100 && L.visible !== false && L._op > 0.003);
    if (dirty.base) {
      dirty.base = false;
      const camKey = lastKey + '|' + A.theme;
      if (unders.length) {
        if (!cache) { cache = document.createElement('canvas'); cache.width = cvB.width; cache.height = cvB.height; cC = cache.getContext('2d'); }
        if (cache.width !== cvB.width || cache.height !== cvB.height) { cache.width = cvB.width; cache.height = cvB.height; cache._k = ''; }
        if (cache._k !== camKey) { drawBasemap(cC, f, cache); cache._k = camKey; }
        cB.setTransform(1, 0, 0, 1, 0, 0); cB.clearRect(0, 0, cvB.width, cvB.height); cB.globalAlpha = 1; cB.drawImage(cache, 0, 0);
        draw2dLayers(cB, unders, f);
      } else drawBasemap(cB, f, cvB);
    }
    if (dirty.gl) {
      dirty.gl = false;
      if (W.hasGL) renderGL(f);
      else if (cG2) { cG2.setTransform(1, 0, 0, 1, 0, 0); cG2.clearRect(0, 0, cvG.width, cvG.height); draw2dLayers(cG2, layers.filter((L) => L.drawGL && L.draw2d && L.visible !== false && L._op > 0.003), f); }
    }
    if (dirty.top) {
      dirty.top = false;
      cT.setTransform(1, 0, 0, 1, 0, 0); cT.clearRect(0, 0, cvT.width, cvT.height);
      const tops = layers.filter((L) => !L.drawGL && L.draw2d && L.z >= 100 && L.visible !== false && L._op > 0.003);
      draw2dLayers(cT, tops.filter((L) => L.z < LAB_Z), f);
      if (opts.labels) { f.toScreenCtx(cT); cT.globalAlpha = 1; try { drawLabels(cT, f); } catch (e) { warnOnce('labels', e); } }
      draw2dLayers(cT, tops.filter((L) => L.z >= LAB_Z), f);
    }
  }
  function draw2dLayers(ctx, list, f) {
    for (const L of list) {
      ctx.save(); f.toScreenCtx(ctx); ctx.globalAlpha = L._op; f.alpha = L._op;
      try { L.draw2d(ctx, f); } catch (e) { warnOnce('layer ' + L.id + ' draw2d', e); }
      ctx.restore();
    }
    f.alpha = 1;
  }
  function renderGL(f) {
    const gl = W.gl;
    if (!gl || gl.isContextLost()) return;
    gl.viewport(0, 0, cvG.width, cvG.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    for (const L of layers) {
      if (!L.drawGL || L.visible === false || L._op <= 0.003) continue;
      f.alpha = L._op;
      try { L.drawGL(gl, f); } catch (e) { warnOnce('layer ' + L.id + ' drawGL', e); }
    }
    f.alpha = 1;
  }

  /* ---------- the basemap ---------- */
  function strokeW(z, base) { return z < 13 ? base : Math.min(base * 14, base * Math.pow(1.62, z - 13)); }
  function drawBasemap(ctx, f, cv) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.globalAlpha = 1; ctx.setLineDash([]);
    const z = f.zoom, px = f.px, m = 60 * px, v = [f.view[0] - m, f.view[1] - m, f.view[2] + m, f.view[3] + m];
    f.toWorldCtx(ctx); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const draw = (cls, fill) => { const g = G[cls]; if (!g) return; for (const c of g.chunks) if (hitBB(c.bb, v)) { if (fill) ctx.fill(c.p); else ctx.stroke(c.p); } };
    // land use: towns
    ctx.fillStyle = pal.town; draw('town', true);
    if (z > 10.2) { ctx.globalAlpha = sm(z, 10.2, 11.2) * 0.9; ctx.strokeStyle = pal.townLine; ctx.lineWidth = px * 0.8; draw('town'); ctx.globalAlpha = 1; }
    // water
    ctx.fillStyle = pal.water; draw('water', true);
    if (z > 9.6) { ctx.globalAlpha = sm(z, 9.6, 10.6); ctx.strokeStyle = pal.waterLine; ctx.lineWidth = px * 0.7; draw('water'); ctx.globalAlpha = 1; }
    ctx.strokeStyle = pal.stream; ctx.lineWidth = px * (z > 12 ? 1.2 : 0.8); draw('stream');
    ctx.strokeStyle = pal.river; ctx.lineWidth = px * (z > 12 ? 2.2 : 1.35); draw('river');
    // admin + rail
    ctx.setLineDash([6 * px, 4 * px]); ctx.strokeStyle = pal.county; ctx.lineWidth = px; draw('county');
    if (z > 9) { ctx.globalAlpha = sm(z, 9, 10); ctx.setLineDash([2.5 * px, 3 * px]); ctx.strokeStyle = pal.rail; ctx.lineWidth = px * 0.9; draw('rail'); }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    // survey marks: Nebraska is laid out on the 6-mile PLSS township grid; a faint cross every 6 miles gives scale
    if (opts.grid !== false && z > 7.6 && z < 12.4) {
      const sp = 6 / MI, arm = 2.6 * px, x0 = Math.floor(v[0] / sp) * sp, y0 = Math.floor(v[1] / sp) * sp;
      ctx.globalAlpha = sm(z, 7.6, 8.4) * (1 - sm(z, 11.6, 12.4)); ctx.strokeStyle = pal.grid; ctx.lineWidth = px; ctx.beginPath();
      for (let x = x0; x <= v[2]; x += sp) for (let y = y0; y <= v[3]; y += sp) { ctx.moveTo(x - arm, y); ctx.lineTo(x + arm, y); ctx.moveTo(x, y - arm); ctx.lineTo(x, y + arm); }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    // streets fade in as you zoom
    if (z > 9.2) { ctx.globalAlpha = 0.25 + 0.75 * sm(z, 9.2, 12.6); ctx.strokeStyle = z > 15 ? pal.street2 : pal.street; ctx.lineWidth = px * strokeW(z, z < 11 ? 0.5 : 0.55); draw('street'); }
    if (z > 8.8) {
      ctx.globalAlpha = 0.35 + 0.65 * sm(z, 8.8, 11); ctx.strokeStyle = pal.art;
      ctx.lineWidth = px * strokeW(z, 0.7); draw('art1');
      ctx.lineWidth = px * strokeW(z, 0.95); draw('art0'); draw('street2');
    }
    ctx.globalAlpha = 1; ctx.strokeStyle = pal.hwy;
    ctx.lineWidth = px * strokeW(z, 1.05); draw('hwy');
    ctx.lineWidth = px * strokeW(z, 1.45); draw('interstate');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /* ---------- labels (top canvas, screen px, collision-free) ---------- */
  const FUI = '"Geist","Geist L",system-ui,-apple-system,sans-serif', FMONO = '"Geist Mono","Geist Mono L",ui-monospace,monospace';
  const mw = new Map();
  const hasLS = (() => { try { return 'letterSpacing' in document.createElement('canvas').getContext('2d'); } catch (e) { return false; } })();
  function measure(ctx, font, s, ls) { const k = font + '|' + (ls || '') + '|' + s; let w = mw.get(k); if (w == null) { ctx.font = font; if (hasLS) ctx.letterSpacing = ls || '0px'; w = ctx.measureText(s).width; mw.set(k, w); } return w; }
  function tryBox(boxes, b) { for (const o of boxes) if (b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]) return false; boxes.push(b); return true; }
  function txt(ctx, s, x, y, font, color, alpha, ls, halo) {
    ctx.font = font; if (hasLS) ctx.letterSpacing = ls || '0px';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = alpha;
    if (halo !== false) { ctx.lineJoin = 'round'; ctx.lineWidth = 3.2; ctx.strokeStyle = pal.halo; ctx.strokeText(s, x, y); }
    ctx.fillStyle = color; ctx.fillText(s, x, y);
  }
  function upright(a) { if (a > Math.PI / 2) a -= Math.PI; if (a < -Math.PI / 2) a += Math.PI; return a; }
  function drawLabels(ctx, f) {
    const z = f.zoom, la = 1 - dimCur * 0.6, boxes = [];
    // panels are solid: keep labels out from under them
    if (f.inset.l > 1) boxes.push([-1e5, -1e5, f.inset.l - 4, 1e5]);
    if (f.inset.r > 1) boxes.push([f.w - f.inset.r + 4, -1e5, 1e5, 1e5]);
    if (f.inset.t > 1) boxes.push([-1e5, -1e5, 1e5, f.inset.t - 2]);
    if (f.inset.b > 1) boxes.push([-1e5, f.h - f.inset.b + 2, 1e5, 1e5]);
    const vis = (q, m) => q[0] > -m && q[1] > -m && q[0] < f.w + m && q[1] < f.h + m;
    // DOM pins win over labels
    for (const P of pins.values()) {
      if (P.off) continue;
      if (P.pw == null) { P.pw = P.node.offsetWidth || 0; P.ph = P.node.offsetHeight || 0; }
      const q = f.project(P.ll), x = q[0] + P.dx, y = q[1] + P.dy, w = P.pw, h = P.ph;
      const ax = P.t === ANCH.left ? x : P.t === ANCH.right ? x - w : x - w / 2, ay = P.t === ANCH.bottom ? y - h : P.t === ANCH.top ? y : y - h / 2;
      boxes.push([ax - 3, ay - 3, ax + w + 3, ay + h + 3]);
    }
    // places
    for (const p of LBL.places) {
      const a = (p.tier === 1 ? sm(z, 7.2, 8) : sm(z, 8.8, 9.5)) * (1 - sm(z, 13.4, 14.2));
      if (a < 0.02) continue;
      const q = f.projectW(p.w[0], p.w[1]); if (!vis(q, 80)) continue;
      const font = p.tier === 1 ? '600 12px ' + FUI : '500 10.5px ' + FUI, ls = p.tier === 1 ? '2.2px' : '1.5px', s = p.n.toUpperCase();
      const w = measure(ctx, font, s, ls);
      for (const dy of [0, 30, -30]) { // a pin sitting on the town pushes its name below or above
        if (!tryBox(boxes, [q[0] - w / 2 - 5, q[1] + dy - 10, q[0] + w / 2 + 5, q[1] + dy + 10])) continue;
        txt(ctx, s, q[0], q[1] + dy, font, p.tier === 1 ? pal.label2 : pal.label, a * la, ls); break;
      }
    }
    // rivers (italic, along the water)
    const ra = sm(z, 8.6, 9.4) * (1 - sm(z, 14, 15));
    if (ra > 0.02) {
      const placed = [];
      for (const r of LBL.rivers) {
        const q = f.projectW(r.w[0], r.w[1]); if (!vis(q, -30)) continue;
        if (placed.some((p) => p.n === r.n && Math.hypot(p.q[0] - q[0], p.q[1] - q[1]) < 380)) continue;
        const font = 'italic 500 11px ' + FUI, s = r.n, w = measure(ctx, font, s, '0.3px');
        const ang = upright(Math.atan2(r.d[1], r.d[0])), c = Math.abs(Math.cos(ang)), sn = Math.abs(Math.sin(ang));
        const bw = w * c + 12 * sn, bh = w * sn + 12 * c;
        if (!tryBox(boxes, [q[0] - bw / 2, q[1] - bh / 2, q[0] + bw / 2, q[1] + bh / 2])) continue;
        placed.push({ n: r.n, q });
        ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(ang); txt(ctx, s, 0, -7, font, pal.waterLabel, ra * la, '0.3px'); ctx.restore();
      }
    }
    // highway shields
    const ha = sm(z, 9.3, 10) * (1 - sm(z, 16, 16.8));
    if (ha > 0.02) {
      const placed = [];
      ctx.font = '500 9.5px ' + FMONO; if (hasLS) ctx.letterSpacing = '0.2px';
      for (const hw of LBL.hwys) {
        const q = f.projectW(hw.w[0], hw.w[1]); if (!vis(q, -20)) continue;
        if (placed.some((p) => p.n === hw.n && Math.hypot(p.q[0] - q[0], p.q[1] - q[1]) < 300)) continue;
        const w = measure(ctx, '500 9.5px ' + FMONO, hw.n, '0.2px') + 10, h = 16;
        if (!tryBox(boxes, [q[0] - w / 2 - 3, q[1] - h / 2 - 3, q[0] + w / 2 + 3, q[1] + h / 2 + 3])) continue;
        placed.push({ n: hw.n, q });
        ctx.globalAlpha = ha * la;
        ctx.beginPath(); roundRect(ctx, q[0] - w / 2, q[1] - h / 2, w, h, 4);
        ctx.fillStyle = hw.t === 'I' ? pal.panel3 : pal.panel; ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = hw.t === 'I' ? pal.rule3 : pal.rule2; ctx.stroke();
        ctx.fillStyle = pal.text2; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '500 9.5px ' + FMONO; if (hasLS) ctx.letterSpacing = '0.2px';
        ctx.fillText(hw.n, q[0], q[1] + 0.5);
      }
    }
    // towns
    for (const t of LBL.towns) {
      const z0 = t.a > 5 ? 9.8 : t.a > 1.2 ? 10.5 : 11.2;
      const a = sm(z, z0, z0 + 0.6) * (1 - sm(z, 14.2, 15));
      if (a < 0.02) continue;
      const q = f.projectW(t.w[0], t.w[1]); if (!vis(q, 40)) continue;
      const font = '500 10.5px ' + FUI, w = measure(ctx, font, t.n, '0.2px');
      if (!tryBox(boxes, [q[0] - w / 2 - 4, q[1] - 8, q[0] + w / 2 + 4, q[1] + 8])) continue;
      txt(ctx, t.n, q[0], q[1], font, pal.label, a * la, '0.2px');
    }
    // street names (only when you are at street level, a few, never clutter)
    if (opts.streetNames && z > 15.1) {
      const a = sm(z, 15.1, 15.8) * la, v = f.view; let n = 0;
      const font = '500 10.5px ' + FUI, placed = [];
      for (const s of LBL.streets) {
        if (n >= 14) break;
        if (!hitBB(s.bb, v)) continue;
        const p0 = f.projectW(s.a[0], s.a[1]), p1 = f.projectW(s.b[0], s.b[1]);
        const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), w = measure(ctx, font, s.n, '0.2px');
        if (L < w + 28) continue;
        const q = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2]; if (!vis(q, -10)) continue;
        if (placed.some((o) => o.n === s.n && Math.hypot(o.q[0] - q[0], o.q[1] - q[1]) < 420)) continue;
        const ang = upright(Math.atan2(p1[1] - p0[1], p1[0] - p0[0])), c = Math.abs(Math.cos(ang)), sn = Math.abs(Math.sin(ang));
        const bw = w * c + 14 * sn + 6, bh = w * sn + 14 * c + 6;
        if (!tryBox(boxes, [q[0] - bw / 2, q[1] - bh / 2, q[0] + bw / 2, q[1] + bh / 2])) continue;
        ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(ang); txt(ctx, s.n, 0, 0, font, pal.label2, a * 0.9, '0.2px'); ctx.restore();
        placed.push({ n: s.n, q }); n++;
      }
    }
    // the radar the beam comes from
    if (ambientOn && !A.still && W.hasGL && X.radar && z > 8 && z < 12.6) {
      const q = f.project(X.radar.c);
      if (vis(q, -10) && tryBox(boxes, [q[0] - 6, q[1] - 6, q[0] + 44, q[1] + 6])) {
        const a = 0.75 * la * (1 - sm(z, 12, 12.6));
        ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(q[0], q[1], 3, 0, Math.PI * 2); ctx.lineWidth = 1.2; ctx.strokeStyle = pal.text2; ctx.stroke();
        ctx.font = '500 9px ' + FMONO; if (hasLS) ctx.letterSpacing = '0.8px'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3; ctx.strokeStyle = pal.halo; ctx.strokeText('KOAX', q[0] + 8, q[1]); ctx.fillStyle = pal.muted; ctx.fillText('KOAX', q[0] + 8, q[1]);
      }
    }
    ctx.globalAlpha = 1; if (hasLS) ctx.letterSpacing = '0px';
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  W.roundRect = roundRect;

  /* ---------- HUD: scale bar + zoom + attribution ---------- */
  let hudBar = null, hudTxt = null, hudLast = '', hudIns = { r: 0, b: 0 };
  function buildHud() {
    hudEl = el.querySelector('.hud') || document.createElement('div');
    hudEl.className = 'hud'; hudEl.id = 'hud';
    const src = (N.src && N.src.base) || 'Nebraska GIS';
    hudEl.innerHTML =
      '<div class="hud__col">' +
      '<div class="scalebar" aria-hidden="true"><span class="scalebar__txt">1 mi</span><span class="scalebar__bar"></span></div>' +
      '<div class="attrib" tabindex="0" role="note" data-tip="' + A.esc('Map: ' + src + ' Hail heat: modeled from NOAA storm swaths and hail areas. The radar beam is decorative.') + '" data-tip-es="' + A.esc('Mapa: Nebraska GIS (condados, municipios, ríos USGS NHD, ferrocarriles y carreteras NDOT). Calor de granizo: modelado con franjas de tormenta de NOAA. El haz del radar es decorativo.') + '">' +
      A.L('Map: Nebraska GIS · USGS · NDOT', 'Mapa: Nebraska GIS · USGS · NDOT') + '</div></div>' +
      '<div class="hud__btns" role="group" data-label-en="Map zoom" data-label-es="Zoom del mapa">' +
      '<button type="button" id="map-zoom-in" data-label-en="Zoom in" data-label-es="Acercar">' + A.ui.icon('plus') + '</button>' +
      '<button type="button" id="map-zoom-out" data-label-en="Zoom out" data-label-es="Alejar">' + A.ui.icon('minus') + '</button>' +
      '<button type="button" id="map-recenter" data-label-en="Back to this view" data-label-es="Volver a esta vista" data-tip="Back to this view" data-tip-es="Volver a esta vista">' + A.ui.icon('target') + '</button>' +
      '</div>';
    if (!hudEl.parentNode) el.appendChild(hudEl);
    hudBar = hudEl.querySelector('.scalebar__bar'); hudTxt = hudEl.querySelector('.scalebar__txt');
    hudEl.querySelector('#map-zoom-in').addEventListener('click', () => { lastInput = performance.now(); W.zoomBy(1); });
    hudEl.querySelector('#map-zoom-out').addEventListener('click', () => { lastInput = performance.now(); W.zoomBy(-1); });
    hudEl.querySelector('#map-recenter').addEventListener('click', () => { lastInput = performance.now(); if (A.view && A.view.current) A.view.recenter(); else W.flyTo({ bounds: W.presets.state }); });
    A.ui.localize(hudEl);
  }
  function updateHud(f) {
    if (!hudEl) return;
    const k = hudIns.r.toFixed(0) + ',' + hudIns.b.toFixed(0) + ',' + f.w + ',' + f.h;
    if (k !== hudLast) { hudLast = k; hudEl.style.transform = 'translate(' + -(hudIns.r + 14) + 'px,' + -(hudIns.b + 14) + 'px)'; }
    const mpp = MI / f.scale, ftpp = mpp * 5280;
    let label, px;
    if (ftpp * 100 < 1000) {
      const steps = [10, 20, 50, 100, 200, 500]; let st = steps[0]; for (const s of steps) if (s / ftpp <= 110) st = s;
      px = st / ftpp; label = st + (A.lang === 'es' ? ' pies' : ' ft');
    } else {
      const steps = [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100]; let st = steps[0]; for (const s of steps) if (s / mpp <= 110) st = s;
      px = st / mpp; label = A.fmt.num(st, st === 0.25 ? 2 : st < 1 ? 1 : 0) + ' mi';
    }
    if (hudTxt.textContent !== label) hudTxt.textContent = label;
    hudBar.style.transform = 'scaleX(' + (px / 100).toFixed(4) + ')';
  }

  /* ======================= input: drag, inertia, wheel, pinch, keys, hit tests ======================= */
  function local(e) { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function hitTest(p) {
    const f = mkFrame(); const ll = f.unproject(p); const pt = { x: p[0], y: p[1], lon: ll[0], lat: ll[1] };
    for (let i = layers.length - 1; i >= 0; i--) {
      const L = layers[i]; if (!L.hit || L.visible === false || L._op < 0.05) continue;
      let it = null; try { it = L.hit(pt, f); } catch (e) { warnOnce('layer ' + L.id + ' hit', e); }
      if (it != null && it !== false) return { layer: L, item: it, pt };
    }
    return { layer: null, item: null, pt };
  }
  W.hitTest = (x, y) => { const r = hitTest([x, y]); return { layer: r.layer && r.layer.id, item: r.item, lon: r.pt.lon, lat: r.pt.lat }; };
  function bindInput() {
    const ptrs = new Map(); let drag = null, pinch = null, samples = [], hoverEv = null, hoverRaf = 0, hoverKey = null;
    const skip = (e) => e.target.closest && e.target.closest('.pin, .hud');
    el.addEventListener('pointerdown', (e) => {
      if (skip(e) || (e.pointerType === 'mouse' && e.button !== 0)) return;
      lastInput = performance.now();
      ptrs.set(e.pointerId, local(e));
      const passive = e.pointerType === 'touch' && A.stacked && A.stacked() && ptrs.size < 2;
      if (!passive) { try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } stopMotion(); }
      if (ptrs.size === 1) { const p = local(e); drag = { id: e.pointerId, p0: p, p, moved: false, passive, t0: performance.now() }; samples = [[performance.now(), p[0], p[1]]]; }
      else if (ptrs.size === 2) {
        const [a, b] = Array.from(ptrs.values());
        pinch = { d: Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], z: cam.z }; drag = null; stopMotion();
      }
    });
    el.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId)) { if (e.pointerType === 'mouse') { hoverEv = e; if (!hoverRaf) hoverRaf = requestAnimationFrame(doHover); } return; }
      lastInput = performance.now();
      const p = local(e); ptrs.set(e.pointerId, p);
      if (pinch && ptrs.size >= 2) {
        const [a, b] = Array.from(ptrs.values()); const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        drag1 = true; panPx(m[0] - pinch.m[0], m[1] - pinch.m[1]); zoomAround(m, pinch.z + Math.log2(d / pinch.d)); pinch.m = m; invalidate();
      } else if (drag && drag.id === e.pointerId && !drag.passive) {
        const dx = p[0] - drag.p[0], dy = p[1] - drag.p[1]; drag.p = p;
        if (!drag.moved && Math.hypot(p[0] - drag.p0[0], p[1] - drag.p0[1]) > 4) { drag.moved = true; el.classList.add('is-drag'); A.ui.hideTip(); }
        if (drag.moved) { drag1 = true; panPx(dx, dy); invalidate(); const t = performance.now(); samples.push([t, p[0], p[1]]); while (samples.length > 2 && t - samples[0][0] > 100) samples.shift(); }
      }
    });
    const up = (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      drag1 = false;
      if (pinch) { if (ptrs.size < 2) { pinch = null; drag = null; } return; }
      if (!drag || drag.id !== e.pointerId) return;
      el.classList.remove('is-drag');
      if (!drag.moved && e.type === 'pointerup') click(local(e), e);
      else if (drag.moved && samples.length > 1) {
        const a = samples[0], b = samples[samples.length - 1], dt = b[0] - a[0];
        if (dt > 0 && performance.now() - b[0] < 60) { inertia = { vx: (b[1] - a[1]) / dt, vy: (b[2] - a[2]) / dt }; wake(); }
      }
      drag = null;
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', () => { if (hoverKey) { hoverKey = null; el.classList.remove('is-hit'); A.emit('map:hover', null); } });
    el.addEventListener('wheel', (e) => {
      if (skip(e)) return;
      if (A.stacked && A.stacked() && !e.ctrlKey) return; // phones: the page scrolls, pinch zooms
      e.preventDefault(); lastInput = performance.now();
      const mode = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const dz = -e.deltaY * mode * (e.ctrlKey ? 0.011 : 0.0028);
      endFlight(false); inertia = null;
      zoomAnim = { to: clampZ((zoomAnim ? zoomAnim.to : cam.z) + dz), at: local(e) }; wake();
    }, { passive: false });
    el.addEventListener('dblclick', (e) => { if (skip(e)) return; e.preventDefault(); W.zoomBy(e.shiftKey ? -1 : 1, local(e)); });
    el.addEventListener('keydown', (e) => {
      if (e.target !== el) return;
      lastInput = performance.now();
      const k = e.key, st = 140;
      if (k === 'ArrowLeft') W.panBy(-st, 0); else if (k === 'ArrowRight') W.panBy(st, 0);
      else if (k === 'ArrowUp') W.panBy(0, -st); else if (k === 'ArrowDown') W.panBy(0, st);
      else if (k === '+' || k === '=') W.zoomBy(1); else if (k === '-' || k === '_') W.zoomBy(-1);
      else if (k === '0' && A.view) A.view.recenter();
      else return;
      e.preventDefault();
    });
    function doHover() {
      hoverRaf = 0; const e = hoverEv; if (!e || drag) return;
      const r = hitTest(local(e)); const key = r.layer ? r.layer.id + ':' + (r.item && (r.item.id != null ? r.item.id : JSON.stringify(r.item).slice(0, 80))) : null;
      if (key !== hoverKey) {
        hoverKey = key; el.classList.toggle('is-hit', !!r.layer);
        if (r.layer && r.layer.onHover) A.safe('layer hover', () => r.layer.onHover(r.item, r.pt));
        A.emit('map:hover', r.layer ? { layer: r.layer.id, item: r.item, lon: r.pt.lon, lat: r.pt.lat, x: r.pt.x, y: r.pt.y } : null);
      }
    }
    function click(p) {
      const r = hitTest(p);
      if (r.layer && r.layer.onClick) A.safe('layer click', () => r.layer.onClick(r.item, r.pt));
      A.emit('map:click', { layer: r.layer && r.layer.id, item: r.item, lon: r.pt.lon, lat: r.pt.lat, x: r.pt.x, y: r.pt.y });
    }
    ['pointerdown', 'pointermove', 'keydown', 'wheel'].forEach((t) => addEventListener(t, () => { const was = performance.now() - lastInput > 90000; lastInput = performance.now(); if (was) invalidate('gl'); }, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) invalidate(); });
  }

  /* ======================= WebGL helpers ======================= */
  const glCache = new Map();
  function toGL1(src, frag) {
    let s = src.replace(/^\s*#version\s+300\s+es\s*\n/, '');
    if (frag) {
      const m = s.match(/^\s*out\s+(?:lowp|mediump|highp)?\s*vec4\s+(\w+)\s*;\s*$/m);
      if (m) { s = s.replace(m[0], ''); s = s.replace(new RegExp('\\b' + m[1] + '\\b', 'g'), 'gl_FragColor'); }
      s = s.replace(/^(\s*)in\s+/gm, '$1varying ');
      if (/\b(fwidth|dFdx|dFdy)\b/.test(s)) s = '#extension GL_OES_standard_derivatives : enable\n' + s;
    } else s = s.replace(/^(\s*)in\s+/gm, '$1attribute ').replace(/^(\s*)out\s+/gm, '$1varying ');
    return s.replace(/\btexture\s*\(/g, 'texture2D(');
  }
  const glx = (W.glx = {
    /** program(vs, fs) with GLSL ES 3.00 sources (#version 300 es; auto-downgraded on WebGL1) → {p, u:{name:loc}, a:{name:loc}} */
    program(vs, fs) {
      const gl = W.gl; if (!gl) return null;
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('[aldaba] shader:', gl.getShaderInfoLog(s)); gl.deleteShader(s); return null; } return s; };
      const v = sh(gl.VERTEX_SHADER, W.gl2 ? vs : toGL1(vs, false)), f = sh(gl.FRAGMENT_SHADER, W.gl2 ? fs : toGL1(fs, true));
      if (!v || !f) return null;
      const p = gl.createProgram(); gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn('[aldaba] program:', gl.getProgramInfoLog(p)); return null; }
      const out = { p, u: {}, ut: {}, a: {} };
      const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < nu; i++) { const inf = gl.getActiveUniform(p, i); const n = inf.name.replace(/\[0\]$/, ''); out.u[n] = gl.getUniformLocation(p, inf.name); out.ut[n] = inf.type; }
      const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
      for (let i = 0; i < na; i++) { const inf = gl.getActiveAttrib(p, i); out.a[inf.name] = gl.getAttribLocation(p, inf.name); }
      return out;
    },
    /** cached(key, gl => resources) → created once per GL context (recreated after a context loss) */
    cached(key, make) {
      const k = W.glGen + ':' + key;
      if (!glCache.has(k)) { let r = null; try { r = make(W.gl); } catch (e) { warnOnce('gl resource ' + key, e); } glCache.set(k, r); }
      return glCache.get(k);
    },
    buffer(data, usage) { const gl = W.gl, b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data instanceof Float32Array ? data : new Float32Array(data), usage || gl.STATIC_DRAW); return b; },
    /** quad(): full-screen triangle strip in clip space, attribute vec2 a_p */
    quad() { return glx.cached('__quad', () => glx.buffer([-1, -1, 1, -1, -1, 1, 1, 1])); },
    attrib(prog, name, buf, size) { const gl = W.gl, loc = prog.a[name]; if (loc == null || loc < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size || 2, gl.FLOAT, false, 0, 0); },
    drawQuad(prog) { const gl = W.gl; glx.attrib(prog, 'a_p', glx.quad(), 2); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); },
    /** texture(Float32Array, w, h, {filter:'linear'|'nearest', max}) → {tex, mul, w, h}; sample.r * mul = value */
    texture(data, w, h, o = {}) {
      const gl = W.gl, t = gl.createTexture(), lin = o.filter !== 'nearest';
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      let mul = 1;
      if (W.gl2) gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, w, h, 0, gl.RED, gl.FLOAT, data);
      else {
        let max = o.max || 0; if (!max) for (let i = 0; i < data.length; i++) if (data[i] > max) max = data[i];
        max = max || 1; mul = max; const b = new Uint8Array(data.length); for (let i = 0; i < data.length; i++) b[i] = Math.round(Math.min(1, Math.max(0, data[i] / max)) * 255);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, w, h, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, b);
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, lin ? gl.LINEAR : gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, lin ? gl.LINEAR : gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return { tex: t, mul, w, h };
    },
    /** uniforms(prog, {u_x: 1, u_c: [r,g,b], u_m: Float32Array(9), u_tex: {tex, unit}}) sets by the uniform's declared type */
    uniforms(prog, vals) {
      const gl = W.gl;
      for (const k in vals) {
        const loc = prog.u[k]; if (loc == null) continue; const v = vals[k], t = prog.ut[k];
        if (t === gl.FLOAT) gl.uniform1f(loc, v);
        else if (t === gl.FLOAT_VEC2) gl.uniform2fv(loc, v);
        else if (t === gl.FLOAT_VEC3) gl.uniform3fv(loc, v.length > 3 ? v.slice(0, 3) : v);
        else if (t === gl.FLOAT_VEC4) gl.uniform4fv(loc, v);
        else if (t === gl.FLOAT_MAT3) gl.uniformMatrix3fv(loc, false, v);
        else if (t === gl.FLOAT_MAT4) gl.uniformMatrix4fv(loc, false, v);
        else if (t === gl.SAMPLER_2D) { const u = v.unit || 0; gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, v.tex || v); gl.uniform1i(loc, u); }
        else if (t === gl.INT || t === gl.BOOL) gl.uniform1i(loc, v | 0);
        else if (Array.isArray(v) || v instanceof Float32Array) gl['uniform' + v.length + 'fv'](loc, v);
        else gl.uniform1f(loc, v);
      }
    },
    /** color('--acc' | 'h15' palette key) → [r,g,b,a] 0..1 */
    color(k) { if (pal.rgb && pal.rgb[k]) return pal.rgb[k]; return A.rgba(k.startsWith('--') ? k : pal[k] || k); }
  });
  function initGL() {
    let gl = null, v2 = false;
    const o = { alpha: true, premultipliedAlpha: true, antialias: true, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' };
    if (A.q('gl') !== '0') {
      try { gl = cvG.getContext('webgl2', o); v2 = !!gl; } catch (e) { gl = null; }
      if (!gl) { try { gl = cvG.getContext('webgl', o) || cvG.getContext('experimental-webgl', o); } catch (e) { gl = null; } }
    }
    if (!gl) { W.hasGL = false; W.gl = null; try { cG2 = cvG.getContext('2d'); } catch (e) { cG2 = null; } return; }
    W.gl = gl; W.gl2 = v2; W.hasGL = true; W.glGen++;
    if (!v2) gl.getExtension('OES_standard_derivatives');
    cvG.addEventListener('webglcontextlost', (e) => { e.preventDefault(); W.hasGL = false; glCache.clear(); });
    cvG.addEventListener('webglcontextrestored', () => { W.hasGL = true; W.glGen++; if (!W.gl2) gl.getExtension('OES_standard_derivatives'); invalidate(); });
  }

  /* ======================= the hail field (shared, built once) ======================= */
  const HF = { ready: false, data: null, nx: 0, ny: 0, x0: 0, y0: 0, x1: 0, y1: 0 };
  function buildHail() {
    const a = toW(BBOX[0] - 0.12, BBOX[3] + 0.12), b = toW(BBOX[2] + 0.12, BBOX[1] - 0.12);
    const nx = 560, ny = Math.round((nx * (b[1] - a[1])) / (b[0] - a[0]));
    const cw = (b[0] - a[0]) / nx, ch = (b[1] - a[1]) / ny, data = new Float32Array(nx * ny);
    const cell = (x, y) => [Math.floor((x - a[0]) / cw), Math.floor((y - a[1]) / ch)];
    for (const ar of N.areas || []) {
      if (!ar.ring || ar.ring.length < 3 || !ar.hail) continue;
      const r = ar.ring.map((p) => toW(p[0], p[1]));
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; r.forEach((p) => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
      const c0 = cell(x0, y0), c1 = cell(x1, y1);
      for (let j = Math.max(0, c0[1]); j <= Math.min(ny - 1, c1[1]); j++) {
        const py = a[1] + (j + 0.5) * ch;
        for (let i = Math.max(0, c0[0]); i <= Math.min(nx - 1, c1[0]); i++) {
          const px = a[0] + (i + 0.5) * cw; let inside = false;
          for (let k = 0, l = r.length - 1; k < r.length; l = k++) { const xi = r[k][0], yi = r[k][1], xj = r[l][0], yj = r[l][1]; if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside; }
          if (inside) { const q = j * nx + i; if (ar.hail > data[q]) data[q] = ar.hail; }
        }
      }
    }
    const sig = 1.8 / MI, R = 3 * sig;
    for (const st of N.storms || []) {
      const P = (st.path || []).map((p) => toW(p[0], p[1])); if (P.length < 2 || !st.max) continue;
      for (let s = 1; s < P.length; s++) {
        const p0 = P[s - 1], p1 = P[s], dx = p1[0] - p0[0], dy = p1[1] - p0[1], L2 = dx * dx + dy * dy || 1e-12;
        const c0 = cell(Math.min(p0[0], p1[0]) - R, Math.min(p0[1], p1[1]) - R), c1 = cell(Math.max(p0[0], p1[0]) + R, Math.max(p0[1], p1[1]) + R);
        for (let j = Math.max(0, c0[1]); j <= Math.min(ny - 1, c1[1]); j++) {
          const py = a[1] + (j + 0.5) * ch;
          for (let i = Math.max(0, c0[0]); i <= Math.min(nx - 1, c1[0]); i++) {
            const px = a[0] + (i + 0.5) * cw; const t = Math.max(0, Math.min(1, ((px - p0[0]) * dx + (py - p0[1]) * dy) / L2));
            const ex = px - (p0[0] + t * dx), ey = py - (p0[1] + t * dy), d2 = ex * ex + ey * ey;
            const v = st.max * 0.88 * Math.exp(-d2 / (2 * sig * sig)); const q = j * nx + i; if (v > data[q]) data[q] = v;
          }
        }
      }
    }
    // soften: three box-blur passes ≈ gaussian (radius 2 cells ≈ 0.45 mi)
    const tmp = new Float32Array(data.length), r = 2, n = 2 * r + 1;
    for (let pass = 0; pass < 3; pass++) {
      for (let j = 0; j < ny; j++) { let s = 0; const o = j * nx; for (let i = -r; i <= r; i++) s += data[o + Math.min(nx - 1, Math.max(0, i))]; for (let i = 0; i < nx; i++) { tmp[o + i] = s / n; s += data[o + Math.min(nx - 1, i + r + 1)] - data[o + Math.max(0, i - r)]; } }
      for (let i = 0; i < nx; i++) { let s = 0; for (let j = -r; j <= r; j++) s += tmp[Math.min(ny - 1, Math.max(0, j)) * nx + i]; for (let j = 0; j < ny; j++) { data[j * nx + i] = s / n; s += tmp[Math.min(ny - 1, j + r + 1) * nx + i] - tmp[Math.max(0, j - r) * nx + i]; } }
    }
    Object.assign(HF, { ready: true, data, nx, ny, x0: a[0], y0: a[1], x1: b[0], y1: b[1] });
    invalidate('gl');
    A.emit('world:hail', HF);
  }
  /** A.world.hail: the modeled hail field (inches) from 38 hail areas + 18 storm swaths */
  W.hail = {
    get ready() { return HF.ready; },
    field: HF,
    /** at([lon,lat]) → modeled inches (0 outside any swath) */
    at(ll) {
      if (!HF.ready) return 0;
      const w = toW(ll[0], ll[1]), fx = ((w[0] - HF.x0) / (HF.x1 - HF.x0)) * HF.nx - 0.5, fy = ((w[1] - HF.y0) / (HF.y1 - HF.y0)) * HF.ny - 0.5;
      const i = Math.floor(fx), j = Math.floor(fy); if (i < 0 || j < 0 || i >= HF.nx - 1 || j >= HF.ny - 1) return 0;
      const tx = fx - i, ty = fy - j, d = HF.data, n = HF.nx;
      return (d[j * n + i] * (1 - tx) + d[j * n + i + 1] * tx) * (1 - ty) + (d[(j + 1) * n + i] * (1 - tx) + d[(j + 1) * n + i + 1] * tx) * ty;
    },
    /** set({opacity, sweep:false}) */
    set(o = {}) { if (o.opacity != null) W.layer.opacity('hail', o.opacity, { ms: o.ms }); if (o.sweep != null) W.ambient(o.sweep); }
  };
  const HAIL_VS = '#version 300 es\nin vec2 a_p;\nout vec2 v_w;\nuniform mat3 u_inv;\nvoid main(){ vec3 w = u_inv * vec3(a_p, 1.0); v_w = w.xy; gl_Position = vec4(a_p, 0.0, 1.0); }';
  const HAIL_FS = [
    '#version 300 es', 'precision highp float;', 'in vec2 v_w;', 'out vec4 o;',
    'uniform sampler2D u_f; uniform vec4 u_fb; uniform float u_mul, u_alpha, u_sweep, u_on, u_light, u_zf;',
    'uniform vec2 u_radar; uniform vec3 u_h1, u_h15, u_h2, u_beam;',
    'void main(){',
    '  vec2 uv = (v_w - u_fb.xy) / (u_fb.zw - u_fb.xy);',
    '  float inb = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);',
    '  float v = texture(u_f, uv).r * u_mul * inb;',
    '  vec3 c = mix(u_h1, u_h15, smoothstep(1.1, 1.55, v)); c = mix(c, u_h2, smoothstep(1.7, 2.25, v));',
    '  float heat = smoothstep(0.62, 1.2, v) * (0.07 + 0.15 * smoothstep(1.0, 2.4, v)) * u_zf;',
    '  float q = v * 4.0; float fw = max(fwidth(q), 1e-4);',
    '  float iso = 1.0 - smoothstep(0.35, 1.25, abs(fract(q + 0.5) - 0.5) / fw);',
    '  float major = 1.0 - mod(floor(q + 0.5), 2.0);',
    '  iso *= smoothstep(0.62, 0.9, v) * mix(0.2, 0.5, major);',
    '  vec2 r = v_w - u_radar; r.y = -r.y;',
    '  float ang = atan(r.y, r.x);',
    '  float dA = mod(ang - u_sweep, 6.2831853);',
    '  float dist = length(r) * 69.05;',
    '  float range = 1.0 - smoothstep(95.0, 150.0, dist);',
    '  float trail = exp(-dA * 1.8) * u_on * range;',
    '  float beam = (exp(-dA * 55.0) * 0.055 + exp(-dA * 4.0) * 0.012) * u_on * range * smoothstep(0.0, 6.0, dist);',
    '  float a = clamp(heat * (1.0 + 1.6 * trail) + iso * (0.75 + 0.9 * trail), 0.0, 0.9);',
    '  vec3 col = c * (1.0 + 0.3 * trail * (1.0 - u_light));',
    '  vec3 outc = col * a + u_beam * beam * (1.0 - a);',
    '  float oa = a + beam * (1.0 - a);',
    '  o = vec4(outc, oa) * u_alpha;',
    '}'
  ].join('\n');
  function hailLayer() {
    return {
      id: 'hail', z: 10, opacity: 1, fadeMs: 700,
      drawGL(gl, f) {
        if (!HF.ready) return;
        const R = glx.cached('hail', () => ({ prog: glx.program(HAIL_VS, HAIL_FS), tex: glx.texture(HF.data, HF.nx, HF.ny) }));
        if (!R || !R.prog) return;
        gl.useProgram(R.prog.p);
        const rc = X.radar && X.radar.c ? toW(X.radar.c[0], X.radar.c[1]) : [0, 0];
        glx.uniforms(R.prog, {
          u_inv: f.inv, u_f: { tex: R.tex.tex, unit: 0 }, u_fb: [HF.x0, HF.y0, HF.x1, HF.y1], u_mul: R.tex.mul, u_alpha: f.alpha,
          u_sweep: f.sweep == null ? sweepA : f.sweep, u_on: ambientOn && !A.still ? 1 : 0, u_light: pal.light ? 1 : 0,
          u_zf: 1 - 0.88 * sm(f.zoom, 12.2, 15), u_radar: rc, u_h1: pal.rgb.h1, u_h15: pal.rgb.h15, u_h2: pal.rgb.h2, u_beam: pal.rgb.beam
        });
        glx.drawQuad(R.prog);
      },
      draw2d(ctx, f) {
        const list = (N.areas || []).slice().sort((a, b) => a.hail - b.hail);
        for (const ar of list) {
          if (!ar.ring) continue;
          ctx.beginPath(); ar.ring.forEach((p, i) => { const q = f.project(p); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.closePath();
          const c = W.hailColor(ar.hail);
          ctx.globalAlpha = f.alpha * 0.16; ctx.fillStyle = c; ctx.fill();
          ctx.globalAlpha = f.alpha * 0.6; ctx.lineWidth = 1; ctx.strokeStyle = c; ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    };
  }

  /* ======================= init ======================= */
  W.init = function (container) {
    if (W.ready) return W;
    el = W.el = container || document.getElementById('world');
    if (!el) { console.warn('[aldaba] no #world element'); return W; }
    const need = (sel, tag, cls) => { let n = el.querySelector(sel); if (!n) { n = document.createElement(tag); n.className = cls; el.appendChild(n); } return n; };
    cvB = need('.world__cv--base', 'canvas', 'world__cv world__cv--base');
    veil = need('.world__veil', 'div', 'world__veil');
    cvG = need('.world__cv--gl', 'canvas', 'world__cv world__cv--gl');
    need('.world__vignette', 'div', 'world__vignette');
    cvT = need('.world__cv--top', 'canvas', 'world__cv world__cv--top');
    pinsEl = need('.world__pins', 'div', 'world__pins');
    cB = cvB.getContext('2d'); cT = cvT.getContext('2d');
    initGL();
    readPal();
    A.safe('world geometry', prepGeometry);
    A.safe('world labels', prepLabels);
    A.safe('world hud', buildHud);
    A.safe('world input', bindInput);
    resize();
    try { new ResizeObserver(() => resize()).observe(el); } catch (e) { addEventListener('resize', resize); }
    addEventListener('resize', resize);
    W.jump({ bounds: W.presets.state, pad: 24 });
    W.layer.add(hailLayer());
    A.on('theme', () => { readPal(); invalidate(); });
    A.on('lang', () => { hudLast = ''; invalidate('top'); if (W.last) updateHud(W.last); });
    try {
      if (document.fonts) {
        document.fonts.ready.then(() => { mw.clear(); invalidate('top'); });
        document.fonts.addEventListener('loadingdone', () => { mw.clear(); invalidate('top'); });
      }
    } catch (e) { /* ignore */ }
    const go = () => A.safe('hail field', buildHail);
    if (A.still) go(); else setTimeout(go, 30);
    W.ready = true;
    invalidate();
    A.emit('world:ready', W);
    return W;
  };
})();
