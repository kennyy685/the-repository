/* Claude's Aldaba · knock.js · #knock: the street-level walk of Aldaba's pick (Columbus, 22 St & 21 St).
   The map, drawn in four layers on the shared world:
     knock-lots  (z 40, basemap canvas)  deterministic sample parcels + house footprints along every real Columbus street in
                                         reach (seeded by street name, so they never change), gable/hip roofs lit from the
                                         north-west, driveways; each lot tinted by the modeled hail field (A.world.hail.at) on an
                                         absolute scale, so equal hail reads as equal tint and the 1-inch line is a tint step.
     knock-homes (z 110, top canvas)     the 25 walk homes as brighter footprints; a logged door's roof takes its outcome color,
                                         a door on the do-not-knock list goes grey. (Top canvas: a tap never redraws the town.)
     knock-walk  (z 120, top canvas)     the route in walk order from the park spot (22 St east, 21 St west, 40 Ave north, back to
                                         the car): solid knocker orange behind you, dashed ahead; spurs to each door; knock ripples.
     knock-doors (z 210, top canvas)     the knocker ring on every walk door: sweep = door score, color = hail at the door, a
                                         dotted halo when the door sits inside the modeled 1-inch hail line, filled with the
                                         outcome once logged, struck through when the door is on the do-not-knock list.
   The panels: left = the door (House portrait, facts with sources, the 1-inch line, the 69-1602 check, one tap per door with
   N T I X B and U = undo, an inline follow-up for inspections); right = the walk (where and when, the progress ring and
   tallies, the streets in order, the map key). A do-not-knock list (no soliciting sign / asked us not to come back) is kept
   per address, so every later walk skips those doors too.
   Director hooks: A.knockDemo = {tap(outcome, rank?), flag(kind, rank?), select(rank), undo(), reset(all?), state()}. */
(function () {
  'use strict';
  const A = window.A; if (!A || !A.view) return;
  const CK = (window.COPY && window.COPY.knock) || {};
  const FT = 69.05 * 5280;                 // feet per world unit (1 world unit = 1 degree of latitude)
  const KEY = 'knock.walk.v1';             // this walk's log, per viewer
  const DNK = 'knock.dnk.v1';              // the do-not-knock list, by address: it outlives any one walk
  const LINE = 1.0;                        // the 1-inch hail line: about where roof damage usually starts to show
  const FONT_MONO = '"Geist Mono","Geist Mono L",ui-monospace,monospace';

  /* ---------------- outcomes + do-not-knock flags ---------------- */
  const OUT = [
    { id: 'no_answer', key: 'N', tok: '--muted', short: { en: 'No answer', es: 'No abrió' } },
    { id: 'talked', key: 'T', tok: '--info', short: { en: 'Talked', es: 'Hablamos' } },
    { id: 'inspection_set', key: 'I', tok: '--ok', short: { en: 'Inspection set', es: 'Inspección' } },
    { id: 'not_interested', key: 'X', tok: '--bad', short: { en: 'Not interested', es: 'No le interesa' } },
    { id: 'come_back', key: 'B', tok: '--warn', short: { en: 'Come back', es: 'Regresar' } }
  ];
  const OUTBY = {};
  OUT.forEach((o) => {
    const c = (CK.outcomes || []).find((x) => x.id === o.id) || {};
    o.label = c.label || o.short; o.hint = c.hint || { en: '', es: '' }; OUTBY[o.id] = o;
  });
  const ANSWERED = { talked: 1, inspection_set: 1, not_interested: 1, come_back: 1 };
  const FLAGS = [
    { id: 'noSoliciting', icon: 'x', label: { en: 'No soliciting sign', es: 'Letrero de no vendedores' } },
    { id: 'dontReturn', icon: 'flag', label: { en: 'Asked us not to come back', es: 'Pidió que no volvamos' } }
  ];
  const FLAGBY = {}; FLAGS.forEach((f) => { const c = (CK.flags || {})[f.id]; if (c) f.label = c; FLAGBY[f.id] = f; });

  /* ---------------- small helpers ---------------- */
  const fill = (s, v) => String(s == null ? '' : s).replace(/\{(\w+)\}/g, (m, k) => (v && v[k] != null ? v[k] : m));
  const pick = (v, l) => { const o = {}; for (const k in v || {}) o[k] = v[k] && typeof v[k] === 'object' ? v[k][l] : v[k]; return o; };
  /** copy {en,es} + vars (plain strings or {en,es}; already HTML-safe) → both-language HTML */
  const T = (o, v) => { o = o || {}; return A.L(fill(A.esc(o.en), pick(v, 'en')), fill(A.esc(o.es || o.en), pick(v, 'es'))); };
  /** same, as {en,es} plain text (toasts, canvas, vars) */
  const Tx = (o, v) => { o = o || {}; return { en: fill(o.en, pick(v, 'en')), es: fill(o.es || o.en, pick(v, 'es')) }; };
  /** a count phrase: copy entries carry an optional singular as `one` ({en, es, one:{en, es}}) */
  const one = (o, n) => (n === 1 && o && o.one ? o.one : o);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sm = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const outBack = (x) => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  function hash(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function stKey(n) {
    let s = String(n || '').toLowerCase().replace(/\b(\d+)(st|nd|rd|th)\b/g, '$1');
    const ab = { street: 'st', avenue: 'ave', drive: 'dr', road: 'rd', boulevard: 'blvd', place: 'pl', court: 'ct', lane: 'ln', circle: 'cir', parkway: 'pkwy' };
    s = s.replace(/\b(street|avenue|drive|road|boulevard|place|court|lane|circle|parkway)\b/g, (m) => ab[m]);
    return s.replace(/\s+/g, ' ').trim();
  }
  function prettySt(n) {
    let s = String(n || '').trim().replace(/\b(\d+)(ST|ND|RD|TH)\b/gi, (m, d, x) => d + x.toLowerCase()).replace(/\b([A-Z])([A-Z]+)\b/g, (m, a, b) => a + b.toLowerCase());
    const ab = { Street: 'St', Avenue: 'Ave', Road: 'Rd', Drive: 'Dr', Boulevard: 'Blvd' };
    return s.replace(/\b(Street|Avenue|Road|Drive|Boulevard)\b/g, (m) => ab[m]);
  }
  const DIRS = { en: ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'], es: ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'] };
  /** plane vector (x east, y south, feet) → compass index 0..7 (0 = north) */
  const compass = (x, y) => ((Math.round((Math.atan2(x, -y) * 180) / Math.PI / 45) % 8) + 8) % 8;

  /* ---------------- plane geometry (feet) ---------------- */
  const cross = (ax, ay, bx, by) => ax * by - ay * bx;
  function segX(p, q, a, b) {
    const d1 = cross(q[0] - p[0], q[1] - p[1], a[0] - p[0], a[1] - p[1]), d2 = cross(q[0] - p[0], q[1] - p[1], b[0] - p[0], b[1] - p[1]);
    const d3 = cross(b[0] - a[0], b[1] - a[1], p[0] - a[0], p[1] - a[1]), d4 = cross(b[0] - a[0], b[1] - a[1], q[0] - a[0], q[1] - a[1]);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  }
  function inQuad(pt, Q) { let s = 0; for (let i = 0; i < 4; i++) { const a = Q[i], b = Q[(i + 1) % 4]; const c = cross(b[0] - a[0], b[1] - a[1], pt[0] - a[0], pt[1] - a[1]); if (c === 0) continue; const sg = c > 0 ? 1 : -1; if (!s) s = sg; else if (sg !== s) return false; } return true; }
  function quadHitsSeg(Q, a, b) { if (inQuad(a, Q) || inQuad(b, Q)) return true; for (let i = 0; i < 4; i++) if (segX(Q[i], Q[(i + 1) % 4], a, b)) return true; return false; }
  function quadsOverlap(P, Q, tol) {
    for (const R of [P, Q]) for (let i = 0; i < 2; i++) {
      const a = R[i], b = R[i + 1]; let nx = b[1] - a[1], ny = a[0] - b[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      let p0 = Infinity, p1 = -Infinity, q0 = Infinity, q1 = -Infinity;
      for (const v of P) { const d = v[0] * nx + v[1] * ny; if (d < p0) p0 = d; if (d > p1) p1 = d; }
      for (const v of Q) { const d = v[0] * nx + v[1] * ny; if (d < q0) q0 = d; if (d > q1) q1 = d; }
      if (p1 < q0 + tol || q1 < p0 + tol) return false;
    }
    return true;
  }
  const bbQ = (Q) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const v of Q) { if (v[0] < x0) x0 = v[0]; if (v[0] > x1) x1 = v[0]; if (v[1] < y0) y0 = v[1]; if (v[1] > y1) y1 = v[1]; } return [x0, y0, x1, y1]; };

  /* ======================= the neighborhood (built once, deterministic) ======================= */
  let G = null;
  function geo() { if (!G) G = A.safe('knock geometry', buildGeo) || null; return G; }
  function buildGeo() {
    const W = A.world, N = A.data, wk = N.walk || {}, homes = N.homes || [];
    if (!wk.park || !W || !W.toWorld) return null;
    const O = W.toWorld(wk.park);
    const toF = (ll) => { const w = W.toWorld(ll); return [(w[0] - O[0]) * FT, (w[1] - O[1]) * FT]; };
    const toLL = (p) => W.toLonLat([O[0] + p[0] / FT, O[1] + p[1] / FT]);
    const RX = 3900, RY = 2900, CELL = 240;

    // real street centerlines in reach
    const streets = [];
    for (const s of N.columbus || []) {
      if (!s.p || s.p.length < 2) continue;
      const pts = s.p.map(toF);
      if (!pts.some((p) => Math.abs(p[0]) < RX && Math.abs(p[1]) < RY)) continue;
      const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const nm = String(s.n || '');
      streets.push({ id: streets.length, n: nm, key: stKey(nm), c: s.c, pts, cum, L: cum[cum.length - 1], odd: /intersection|service|north road|south road/i.test(nm) });
    }
    const segs = [], sgrid = new Map();
    const cells = (bb, fn) => { for (let i = Math.floor(bb[0] / CELL); i <= Math.floor(bb[2] / CELL); i++) for (let j = Math.floor(bb[1] / CELL); j <= Math.floor(bb[3] / CELL); j++) fn(i + ',' + j); };
    streets.forEach((st) => { for (let i = 1; i < st.pts.length; i++) { const sg = { a: st.pts[i - 1], b: st.pts[i], st: st.id, art: st.c === 1 }; const k = segs.push(sg) - 1; cells(bbQ([sg.a, sg.b]), (c) => { let l = sgrid.get(c); if (!l) sgrid.set(c, (l = [])); l.push(k); }); } });
    const segsIn = (bb) => { const out = new Set(); cells(bb, (c) => { const l = sgrid.get(c); if (l) l.forEach((k) => out.add(k)); }); return out; };
    function at(st, t) {
      t = clamp(t, 0, st.L); let i = 1; while (i < st.pts.length - 1 && st.cum[i] < t) i++;
      const a = st.pts[i - 1], b = st.pts[i], L = st.cum[i] - st.cum[i - 1] || 1, k = (t - st.cum[i - 1]) / L;
      return { p: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], T: [(b[0] - a[0]) / L, (b[1] - a[1]) / L] };
    }
    function projOn(st, P) {
      let best = null;
      for (let i = 1; i < st.pts.length; i++) {
        const a = st.pts[i - 1], b = st.pts[i], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
        const u = clamp(((P[0] - a[0]) * dx + (P[1] - a[1]) * dy) / L2, 0, 1), fx = a[0] + dx * u, fy = a[1] + dy * u, d = Math.hypot(P[0] - fx, P[1] - fy);
        if (!best || d < best.d) best = { d, t: st.cum[i - 1] + u * Math.sqrt(L2), side: cross(dx, dy, P[0] - a[0], P[1] - a[1]) >= 0 ? 1 : -1, end: u <= 0 || u >= 1 };
      }
      return best;
    }
    function rayHit(P, D, maxT, exSt) {
      const E = [P[0] + D[0] * maxT, P[1] + D[1] * maxT]; let best = null;
      for (const k of segsIn(bbQ([P, E]))) {
        const s = segs[k]; if (s.st === exSt) continue;
        const rx = D[0] * maxT, ry = D[1] * maxT, sx = s.b[0] - s.a[0], sy = s.b[1] - s.a[1], den = cross(rx, ry, sx, sy);
        if (Math.abs(den) < 1e-9) continue;
        const t = cross(s.a[0] - P[0], s.a[1] - P[1], sx, sy) / den, u = cross(s.a[0] - P[0], s.a[1] - P[1], rx, ry) / den;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && (best == null || t * maxT < best)) best = t * maxT;
      }
      return best;
    }
    const clearOf = (Q, exSt) => { for (const k of segsIn(bbQ(Q))) { const s = segs[k]; if (s.st !== exSt && quadHitsSeg(Q, s.a, s.b)) return false; } return true; };
    const nearArt = (P, r) => { for (const k of segsIn([P[0] - r, P[1] - r, P[0] + r, P[1] + r])) { const s = segs[k]; if (!s.art) continue; const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], L2 = dx * dx + dy * dy || 1, u = clamp(((P[0] - s.a[0]) * dx + (P[1] - s.a[1]) * dy) / L2, 0, 1); if (Math.hypot(P[0] - s.a[0] - dx * u, P[1] - s.a[1] - dy * u) < r) return true; } return false; };

    // accepted parcels (for overlap tests)
    const lgrid = new Map();
    const lotFree = (Q) => { const bb = bbQ(Q); let ok = true; cells(bb, (c) => { if (!ok) return; const l = lgrid.get(c); if (l) for (const o of l) if (quadsOverlap(Q, o, 1.5)) { ok = false; return; } }); return ok; };
    const addLot = (Q) => cells(bbQ(Q), (c) => { let l = lgrid.get(c); if (!l) lgrid.set(c, (l = [])); l.push(Q); });

    // the walk homes, each pinned to its own street (name first, then distance)
    const walk = homes.map((h) => {
      const P = toF(h.p), key = stKey(h.st); let best = null;
      for (const st of streets) {
        if (st.c === 1 || st.odd) continue;
        const pr = projOn(st, P); if (!pr) continue;
        const sc = pr.d + (st.key === key ? 0 : 400) + (pr.end ? 25 : 0);
        if (!best || sc < best.sc) best = { sc, st, t: pr.t, side: pr.side, dn: pr.d };
      }
      return { h, rank: h.rank, P, st: best && best.st, t: best ? best.t : 0, side: best ? best.side : 1, dn: best ? best.dn : 40 };
    });

    const FRONT = 17, LIGHT = (() => { const l = Math.hypot(0.55, 0.85); return [-0.55 / l, -0.85 / l]; })();
    const tone = (n) => { const d = n[0] * LIGHT[0] + n[1] * LIGHT[1]; return d > 0.3 ? 0 : d < -0.3 ? 2 : 1; };
    function roof(F, T, N, u0, u1, v0, v1, hip) {
      const du = u1 - u0, dv = v1 - v0, out = [], neg = (v) => [-v[0], -v[1]];
      if (du >= dv) {
        const vm = (v0 + v1) / 2, e = hip ? dv / 2 : 0;
        out.push({ Q: [F(u0, v0), F(u1, v0), F(u1 - e, vm), F(u0 + e, vm)], t: tone(neg(N)) });
        out.push({ Q: [F(u0 + e, vm), F(u1 - e, vm), F(u1, v1), F(u0, v1)], t: tone(N) });
        if (hip) { out.push({ Q: [F(u0, v0), F(u0 + e, vm), F(u0, v1)], t: tone(neg(T)) }); out.push({ Q: [F(u1, v0), F(u1, v1), F(u1 - e, vm)], t: tone(T) }); }
      } else {
        const um = (u0 + u1) / 2, e = hip ? du / 2 : 0;
        out.push({ Q: [F(u0, v0), F(um, v0 + e), F(um, v1 - e), F(u0, v1)], t: tone(neg(T)) });
        out.push({ Q: [F(um, v0 + e), F(u1, v0), F(u1, v1), F(um, v1 - e)], t: tone(T) });
        if (hip) { out.push({ Q: [F(u0, v0), F(u1, v0), F(um, v0 + e)], t: tone(neg(N)) }); out.push({ Q: [F(u0, v1), F(um, v1 - e), F(u1, v1)], t: tone(N) }); }
      }
      return out;
    }

    /** one parcel + its house. anchor = a walk home (house center pinned to its sample point) */
    function mkLot(st, side, a, b, anchor) {
      const m = (a + b) / 2, S = at(st, m), Tn = S.T, Nn = [-Tn[1] * side, Tn[0] * side];
      const F = (u, v) => [S.p[0] + Tn[0] * u + Nn[0] * v, S.p[1] + Tn[1] * u + Nn[1] * v];
      const rect = (u0, u1, v0, v1) => [F(u0, v0), F(u1, v0), F(u1, v1), F(u0, v1)];
      const u0 = a - m, u1 = b - m, lotW = b - a;
      if (!anchor && nearArt(F(0, 60), 70)) return null;
      const hit = rayHit(F(0, FRONT), Nn, 470, st.id);
      let back = Math.min(152, hit == null ? 152 : (hit + FRONT) / 2 - 2);
      if (anchor) back = Math.max(back, anchor.dn + 34);
      let lotQ = null;
      for (const bk of [back, Math.min(back, FRONT + 84), FRONT + 70]) {
        if (bk - FRONT < (anchor ? 40 : 62)) continue;
        const Q = rect(u0, u1, FRONT, bk);
        if (clearOf(rect(u0 - 9, u1 + 9, FRONT, bk + 5), st.id) && lotFree(Q)) { lotQ = Q; back = bk; break; }
      }
      if (!lotQ && !anchor) return null;
      const hr = rng(hash(st.n + '|' + Math.round(m) + '|' + side));
      let hw = clamp(lotW * (0.5 + 0.16 * hr()), 26, 46), hd = 26 + 11 * hr(), fs = FRONT + 12 + 10 * hr(), uc = 0;
      if (anchor) {
        hw = Math.min(hw, 38); hd = Math.min(hd, 32);
        if (anchor.dn - hd / 2 < 16) hd = Math.max(20, 2 * (anchor.dn - 16));
        fs = anchor.dn - hd / 2; uc = anchor.t - m;
      }
      if (!anchor && fs + hd > back - 8) { hd = Math.max(22, back - 8 - fs); }
      const parts = [], drive = [], hip = hr() < 0.34, gk = hr();
      let main = [uc - hw / 2, uc + hw / 2, fs, fs + hd], garage = null;
      if (gk < 0.6) {                                                   // attached garage + short driveway
        const gw = 20 + 4 * hr(), gd = 21 + 3 * hr(), gf = fs + hr() * 6 - 3;
        for (const gs of hr() < 0.5 ? [-1, 1] : [1, -1]) {
          const mc = anchor ? uc : uc - gs * gw / 2, gc = mc + gs * (hw / 2 + gw / 2);
          if (gc - gw / 2 >= u0 + 3 && gc + gw / 2 <= u1 - 3 && mc - hw / 2 >= u0 + 3 && mc + hw / 2 <= u1 - 3) {
            main = [mc - hw / 2, mc + hw / 2, fs, fs + hd]; garage = [gc - gw / 2, gc + gw / 2, gf, gf + gd];
            drive.push(rect(gc - gw / 2 + 1.5, gc + gw / 2 - 1.5, 13, gf)); break;
          }
        }
      } else if (gk < 0.88 && lotQ) {                                    // detached rear garage, drive along the side
        const gs = hr() < 0.5 ? -1 : 1, du = gs * (hw / 2 + 7), dc = uc + du, gw = 20 + 3 * hr(), gd = 20 + 3 * hr(), gv = fs + hd + 12 + 6 * hr();
        const gc = clamp(dc + gs * 4, u0 + 4 + gw / 2, u1 - 4 - gw / 2);
        if (Math.abs(dc) + 5 < lotW / 2 - 2 && gv + gd < back - 4) {
          drive.push(rect(dc - 5, dc + 5, 13, gv)); garage = [gc - gw / 2, gc + gw / 2, gv, gv + gd];
        }
      }
      if (!garage && !drive.length) drive.push(rect(uc + hw / 2 - 11, uc + hw / 2 - 1, 13, fs));
      roof(F, Tn, Nn, main[0], main[1], main[2], main[3], hip).forEach((r) => parts.push(r));
      if (garage) roof(F, Tn, Nn, garage[0], garage[1], garage[2], garage[3], false).forEach((r) => parts.push(r));
      const shadow = [rect(main[0], main[1], main[2], main[3])]; if (garage) shadow.push(rect(garage[0], garage[1], garage[2], garage[3]));
      if (lotQ) addLot(lotQ);
      const c = F(uc, (main[2] + main[3]) / 2);
      return { Q: lotQ, parts, shadow, drive, c, door: F(anchor ? uc : (main[0] + main[1]) / 2, main[2] - 5), walk: anchor ? anchor.rank : 0, d: Math.hypot(c[0], c[1]) };
    }

    /** the parcels along one side of one street: walk homes are fixed lot centers, the rest fills the rhythm */
    function runSide(st, side, anchors) {
      const cc = 30, start = cc, end = st.L - cc, out = [];
      if (end - start < 48) return out;
      const r = rng(hash(st.n + '|' + side + '|' + Math.round(st.pts[0][0]) + ',' + Math.round(st.pts[0][1])));
      const wv = () => 58 + r() * 12;
      const B = [];
      if (!anchors.length) {
        const n = Math.max(1, Math.round((end - start) / wv())), ws = []; let sum = 0;
        for (let i = 0; i < n; i++) { const w = 1 + (r() - 0.5) * 0.24; ws.push(w); sum += w; }
        let x = start; B.push(x); ws.forEach((w) => { x += (w / sum) * (end - start); B.push(x); });
      } else {
        anchors.sort((p, q) => p.t - q.t);
        const t0 = anchors[0].t, w0 = wv(); let x = t0 - w0 / 2; const pre = [];
        while (x - start >= 34) { pre.push(x); x -= wv(); }
        B.push(Math.min(start, pre.length ? pre[pre.length - 1] : t0 - 14)); pre.reverse().forEach((v) => B.push(v));
        for (let i = 0; i + 1 < anchors.length; i++) {
          const D = anchors[i + 1].t - anchors[i].t;
          if (D < 36) { B.push(anchors[i].t + D / 2); continue; }
          const k = Math.max(1, Math.round(D / (61 + r() * 6))), w = D / k;
          for (let j = 0; j < k; j++) B.push(anchors[i].t + w * (j + 0.5));
        }
        const tn = anchors[anchors.length - 1].t; x = tn + wv() / 2;
        while (end - x >= 34) { B.push(x); x += wv(); }
        B.push(Math.max(end, tn + 14));
      }
      B.sort((p, q) => p - q);
      for (let i = 0; i + 1 < B.length; i++) {
        const a = B[i], b = B[i + 1]; if (b - a < 30) continue;
        const an = anchors.find((h) => h.t >= a && h.t < b) || null;
        const lot = A.safe('knock lot', mkLot, st, side, a, b, an); if (lot) out.push(lot);
      }
      return out;
    }

    const lots = [], wh = {};
    const byStreet = new Map(); walk.forEach((w) => { if (!w.st) return; const k = w.st.id + ':' + w.side; if (!byStreet.has(k)) byStreet.set(k, []); byStreet.get(k).push(w); });
    const order = streets.filter((s) => s.c !== 1 && !s.odd && s.L > 90).sort((p, q) => {
      const pw = walk.some((w) => w.st === p) ? 1 : 0, qw = walk.some((w) => w.st === q) ? 1 : 0;
      if (pw !== qw) return qw - pw;
      return (Math.hypot(p.pts[0][0], p.pts[0][1]) - Math.hypot(q.pts[0][0], q.pts[0][1]));
    });
    for (const st of order) for (const side of [1, -1]) {
      for (const lot of runSide(st, side, byStreet.get(st.id + ':' + side) || [])) { lots.push(lot); if (lot.walk) wh[lot.walk] = lot; }
    }
    // a walk home the parcel rhythm could not place still gets its footprint
    walk.forEach((w) => {
      if (wh[w.rank] || !w.st) return;
      const lot = A.safe('knock lot', mkLot, w.st, w.side, w.t - 26, w.t + 26, w); if (lot) { lot.Q = null; lots.push(lot); wh[w.rank] = lot; }
    });

    // the route in walk order: park → each street of the walk, joined by its connectors; drawn 5 ft right of travel.
    // segLeg[i] = the leg that owns the segment rp[i-1] → rp[i]. A point two legs share stays with the leg that reached it,
    // so every segment keeps its own leg (handing the shared point to the next leg dropped the end of 22 St and all of
    // 21 St from the door matching, and those doors fell back to rank order).
    const legs = []; (wk.s || []).forEach((s, i) => { const c = (wk.c || [])[i]; if (i > 0 && c && c.length > 1) legs.push({ pts: c.map(toF) }); legs.push({ pts: s.p.map(toF), st: stKey(s.n), s }); });
    const rp = [], segLeg = [];
    legs.forEach((lg, li) => lg.pts.forEach((p, k) => {
      const l = rp[rp.length - 1];
      if (l && Math.hypot(p[0] - l[0], p[1] - l[1]) < 1) return;
      segLeg.push(l && k > 0 ? li : -1); rp.push(p);
    }));
    const off = rp.map((p, i) => {
      const a = rp[Math.max(0, i - 1)], b = rp[Math.min(rp.length - 1, i + 1)];
      const d0 = i > 0 ? [p[0] - a[0], p[1] - a[1]] : [b[0] - p[0], b[1] - p[1]], d1 = i < rp.length - 1 ? [b[0] - p[0], b[1] - p[1]] : d0;
      const n0 = Math.hypot(d0[0], d0[1]) || 1, n1 = Math.hypot(d1[0], d1[1]) || 1;
      const r0 = [-d0[1] / n0, d0[0] / n0], r1 = [-d1[1] / n1, d1[0] / n1]; let rx = r0[0] + r1[0], ry = r0[1] + r1[1]; const rl = Math.hypot(rx, ry);
      if (rl < 0.2) { rx = r1[0]; ry = r1[1]; } else { const s = 2 / (rl * rl); rx *= s; ry *= s; if (Math.hypot(rx, ry) > 2.5) { const k = 2.5 / Math.hypot(rx, ry); rx *= k; ry *= k; } }
      return [p[0] + rx * 5, p[1] + ry * 5];
    });
    const cum = [0]; for (let i = 1; i < off.length; i++) cum.push(cum[i - 1] + Math.hypot(off[i][0] - off[i - 1][0], off[i][1] - off[i - 1][1]));
    const total = cum[cum.length - 1] || 1;
    const doors = walk.map((w) => {
      const lot = wh[w.rank], D = lot ? lot.door : w.P, key = stKey(w.h.st);
      let best = null;
      for (let i = 1; i < off.length; i++) {
        const li = segLeg[i]; if (li < 0 || legs[li].st !== key) continue;
        const a = off[i - 1], b = off[i], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, u = clamp(((D[0] - a[0]) * dx + (D[1] - a[1]) * dy) / L2, 0, 1);
        const fp = [a[0] + dx * u, a[1] + dy * u], d = Math.hypot(D[0] - fp[0], D[1] - fp[1]);
        if (!best || d < best.d) best = { d, arc: cum[i - 1] + u * Math.sqrt(L2), fp };
      }
      if (!best) best = { d: 0, arc: total, fp: D };
      return { rank: w.rank, h: w.h, D, ll: toLL(D), foot: best.fp, arc: best.arc, lot, side: w.side };
    }).sort((p, q) => p.arc - q.arc || p.rank - q.rank);
    doors.forEach((d, i) => (d.idx = i + 1));
    // the walk's streets, in order: heading of travel and their doors
    const walkSt = (wk.s || []).map((s, i) => {
      const a = toF(s.p[0]), b = toF(s.p[s.p.length - 1]), key = stKey(s.n);
      return { i, s, key, dir: compass(b[0] - a[0], b[1] - a[1]), doors: doors.filter((d) => stKey(d.h.st) === key) };
    });
    doors.forEach((d) => { d.wi = walkSt.findIndex((w) => w.key === stKey(d.h.st)); });
    const end = rp[rp.length - 1];

    const g = { O, toF, toLL, lots, wh, doors, walkSt, route: off, cum, total, legs, park: [0, 0], maxD: 0, loop: !!end && Math.hypot(end[0], end[1]) < 40 };
    lots.forEach((l) => { if (l.d > g.maxD) g.maxD = l.d; });
    tint(g);
    return g;
  }

  /* hail per lot and per door, from the modeled field. Absolute buckets (0.75-1, 1-1.25 ... 2.25 in+): equal hail, equal
     tint, and the 1-inch line falls on a bucket edge. Paths are grouped in distance bands from the park spot (the reveal). */
  const TB = { lo: 0.75, step: 0.25, n: 7 };
  function tint(g) {
    const H = A.world && A.world.hail, ok = !!(H && H.ready);
    g.lots.forEach((l) => { l.hv = ok ? H.at(g.toLL(l.c)) : 0; });
    g.doors.forEach((d) => { d.fh = ok ? H.at(d.h.p) : null; d.in1 = ok && d.fh >= LINE; });
    g.hailOk = ok; g.in1 = g.doors.filter((d) => d.in1).length;
    g.edge = ok ? A.safe('knock edge', edgeOf, g) || null : null;
    g.bucket = (v) => (v >= TB.lo ? Math.min(TB.n - 1, Math.floor((v - TB.lo) / TB.step)) : -1);
    g.ver = (g.ver || 0) + 1;
    buildPaths(g);
  }
  /** from the middle of the walk, the nearest place where the modeled field crosses the 1-inch line (32 bearings, 0.05 mi steps) */
  function edgeOf(g) {
    const H = A.world.hail; let cx = 0, cy = 0;
    g.doors.forEach((d) => { cx += d.D[0]; cy += d.D[1]; }); cx /= g.doors.length || 1; cy /= g.doors.length || 1;
    const inside = H.at(g.toLL([cx, cy])) >= LINE; let best = null;
    for (let k = 0; k < 32; k++) {
      const a = (k / 32) * Math.PI * 2, ux = Math.sin(a), uy = -Math.cos(a);
      for (let s = 1; s <= 400; s++) {
        const r = s * 264; if (best && r >= best.r) break;
        if ((H.at(g.toLL([cx + ux * r, cy + uy * r])) >= LINE) !== inside) { best = { r, ux, uy }; break; }
      }
    }
    return { inside, mi: best ? best.r / 5280 : null, dir: best ? compass(best.ux, best.uy) : 0 };
  }
  function buildPaths(g) {
    const BW = 170, TW = 700, map = new Map();
    const poly = (p, Q) => { p.moveTo(Q[0][0], Q[0][1]); for (let i = 1; i < Q.length; i++) p.lineTo(Q[i][0], Q[i][1]); p.closePath(); };
    // cells = distance band (the reveal wave) x 700 ft tile (so the view culls what it cannot see)
    const cell = (l) => {
      const bi = Math.floor(l.d / BW), tx = Math.floor(l.c[0] / TW), ty = Math.floor(l.c[1] / TW), k = bi + ':' + tx + ':' + ty;
      let b = map.get(k);
      if (!b) map.set(k, (b = { d0: bi * BW, bb: [Infinity, Infinity, -Infinity, -Infinity], fill: [], lines: new Path2D(), drive: new Path2D(), shadow: new Path2D(), roof: [new Path2D(), new Path2D(), new Path2D()], lod: new Path2D() }));
      return b;
    };
    const grow = (b, Q) => { for (const v of Q) { if (v[0] < b.bb[0]) b.bb[0] = v[0]; if (v[1] < b.bb[1]) b.bb[1] = v[1]; if (v[0] > b.bb[2]) b.bb[2] = v[0]; if (v[1] > b.bb[3]) b.bb[3] = v[1]; } };
    for (const l of g.lots) {
      if (l.walk) continue;
      const b = cell(l);
      if (l.Q) {
        poly(b.lines, l.Q); grow(b, l.Q);
        const k = g.bucket(l.hv); if (k >= 0) { if (!b.fill[k]) b.fill[k] = new Path2D(); poly(b.fill[k], l.Q); }
      }
      l.drive.forEach((Q) => poly(b.drive, Q));
      l.shadow.forEach((Q) => { poly(b.shadow, Q.map((v) => [v[0] + 2.6, v[1] + 3.6])); poly(b.lod, Q); grow(b, Q); });
      l.parts.forEach((r) => poly(b.roof[r.t], r.Q));
    }
    const bands = Array.from(map.values()).sort((p, q) => p.d0 - q.d0);
    for (const r in g.wh) {
      const l = g.wh[r], p = { lot: null, drive: new Path2D(), shadow: new Path2D(), roof: [new Path2D(), new Path2D(), new Path2D()], outline: new Path2D() };
      if (l.Q) { p.lot = new Path2D(); poly(p.lot, l.Q); }
      l.drive.forEach((Q) => poly(p.drive, Q));
      l.shadow.forEach((Q) => { poly(p.shadow, Q.map((v) => [v[0] + 2.6, v[1] + 3.6])); poly(p.outline, Q); });
      l.parts.forEach((q) => poly(p.roof[q.t], q.Q));
      l.paths = p;
    }
    g.bands = bands;
  }

  /* ---------------- palette (tokens → canvas) ---------------- */
  const P = {};
  const HS = [0.8, 1.1, 1.55, 2.1];         // where the hail tokens sit on the continuous scale (in)
  function readP() {
    const rgb = (n) => A.rgba(A.tok(n) || '#888');
    const land = rgb('--map-land'), text = rgb('--text'), light = A.theme === 'light';
    const mix = (a, b, k) => 'rgb(' + [0, 1, 2].map((i) => Math.round((a[i] + (b[i] - a[i]) * k) * 255)).join(',') + ')';
    P.light = light;
    P.roof = light ? [mix(land, text, 0.09), mix(land, text, 0.16), mix(land, text, 0.24)] : [mix(land, text, 0.25), mix(land, text, 0.17), mix(land, text, 0.115)];
    P.wroof = light ? [mix(land, text, 0.3), mix(land, text, 0.42), mix(land, text, 0.54)] : [mix(land, text, 0.62), mix(land, text, 0.47), mix(land, text, 0.35)];
    P.line = mix(land, text, 0.2); P.drive = mix(land, text, light ? 0.09 : 0.085);
    P.shadow = A.tok('--shadow'); P.shadowA = light ? 0.5 : 0.75;
    P.text = A.tok('--text'); P.text2 = A.tok('--text-2'); P.muted = A.tok('--muted'); P.faint = A.tok('--faint');
    P.panel = A.tok('--panel'); P.page = A.tok('--page'); P.rule3 = A.tok('--rule-3'); P.acc = A.tok('--acc'); P.accInk = A.tok('--acc-ink'); P.onAcc = A.tok('--on-acc');
    P.out = {}; OUT.forEach((o) => (P.out[o.id] = A.tok(o.tok)));
    P.outRGB = {}; OUT.forEach((o) => (P.outRGB[o.id] = rgb(o.tok)));
    P.landRGB = land; P.textRGB = text; P.mix = mix;
    const hs = [[HS[0], rgb('--h0')], [HS[1], rgb('--h1')], [HS[2], rgb('--h15')], [HS[3], rgb('--h2')]];
    P.hail = (v) => { if (v <= hs[0][0]) return hs[0][1]; for (let i = 1; i < hs.length; i++) if (v <= hs[i][0]) { const k = (v - hs[i - 1][0]) / (hs[i][0] - hs[i - 1][0]); return hs[i - 1][1].map((c, j) => c + (hs[i][1][j] - c) * k); } return hs[hs.length - 1][1]; };
    P.css = (c, a) => 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ',' + (a == null ? 1 : a) + ')';
    // lot tint by modeled hail. Light: a warm wash. Dark: the lot lines carry the hail color and the fill stays a whisper,
    // so the block reads as lit by the storm rather than as brown ground. Both grow with hail size (absolute scale).
    P.fill = []; P.fillA = []; P.lineH = [];
    for (let k = 0; k < TB.n; k++) {
      const v = TB.lo + (k + 0.5) * TB.step, hc = P.hail(v), t = clamp((v - TB.lo) / 1.75, 0, 1);
      P.fill.push(P.css(hc)); P.fillA.push(light ? 0.07 + t * 0.12 : 0.025 + t * 0.045);
      P.lineH.push(mix(land, hc, light ? 0.3 : 0.34 + t * 0.3));
    }
  }

  /* ---------------- state (per viewer, A.store) ---------------- */
  let S = null;
  const blank = () => ({ o: {}, hist: [], cur: null, legal: {}, flags: {}, slot: {}, auto: {} });
  function dnkList() { const d = A.store.get(DNK, null); return d && typeof d === 'object' && !Array.isArray(d) ? d : {}; }
  function dnkPut(addr, v) { const d = dnkList(); if (v) d[addr] = v; else delete d[addr]; A.store.set(DNK, d); }
  /** every address on the do-not-knock list starts the walk settled */
  function applyDnk() { const g = geo(), d = dnkList(); if (!g || !S) return; g.doors.forEach((x) => { const e = d[x.h.addr]; if (e && FLAGBY[e.k] && !S.flags[x.rank]) S.flags[x.rank] = e.k; }); }
  function load() {
    const s = A.store.get(KEY, null);
    S = s && typeof s === 'object' && s.o ? s : blank();
    ['o', 'legal', 'flags', 'slot', 'auto'].forEach((k) => { if (!S[k] || typeof S[k] !== 'object') S[k] = {}; });
    if (!Array.isArray(S.hist)) S.hist = [];
    applyDnk();
  }
  const save = () => A.store.set(KEY, S);
  const settled = (r) => !!(S.o[r] || S.flags[r]);
  function counts() {
    const c = { knocked: 0, talked: 0, inspection_set: 0, come_back: 0, not_interested: 0, no_answer: 0, answered: 0, legal: 0, skipped: 0, dnk: 0, done: 0 };
    const g = geo(); if (!g || !S) return c;
    for (const d of g.doors) {
      const r = d.rank, o = S.o[r];
      if (S.flags[r]) c.dnk++;
      if (OUTBY[o]) { c.knocked++; c[o]++; c.done++; if (ANSWERED[o]) { c.answered++; if (S.legal[r]) c.legal++; } }
      else if (S.flags[r]) { c.skipped++; c.done++; }
    }
    return c;
  }

  /* ---------------- live view state (motion) ---------------- */
  const V = { reveal: 1, head: 1, lit: {}, done: { from: 0, to: 0, t0: 0 }, ripples: [], lift: { rank: 0, t0: 0 }, hover: 0, tl: null };
  let liveUntil = 0, liveFn = null;
  function setLive(id, on) { if (A.world && A.world.layer.get(id)) A.world.layer.set(id, { live: !!on }); }
  function pulse(ms) {
    if (A.still) { A.world && A.world.invalidate('top'); return; }
    liveUntil = Math.max(liveUntil, performance.now() + ms);
    if (liveFn) return;
    setLive('knock-walk', true); setLive('knock-doors', true);
    liveFn = (now) => {
      if (now < liveUntil || (V.tl && V.tl.playing)) return true;
      liveFn = null; setLive('knock-walk', false); setLive('knock-doors', false); if (A.world) A.world.invalidate('top'); return false;
    };
    A.motion.ticker.add(liveFn);
  }
  const doneArcTarget = (g) => { let m = 0; g.doors.forEach((d) => { if (settled(d.rank) && d.arc > m) m = d.arc; }); return m; };
  function doneArcNow(now) { const d = V.done; if (A.still || !d.t0) return d.to; const k = clamp((now - d.t0) / 650, 0, 1); return d.from + (d.to - d.from) * A.motion.ease.outCubic(k); }
  function retarget(g) { const now = performance.now(), cur = doneArcNow(now), to = doneArcTarget(g); if (to === V.done.to) return; V.done = { from: cur, to, t0: now }; pulse(700); }

  /* ======================= drawing ======================= */
  function worldXf(c, f, g) {
    const r = c.canvas.width / f.w, k = f.scale / FT, q = f.projectW(g.O[0], g.O[1]);
    c.setTransform(k * r, 0, 0, k * r, q[0] * r, q[1] * r);
    return 1 / k; // feet per css px
  }
  /** the sample neighborhood: cL = lot tint + lot lines, cH = driveways, shadows, roofs (the same canvas at rest) */
  function drawBands(cL, cH, f, g, px, base, R) {
    cL.lineJoin = 'round';
    const m = 40 * px, vx0 = (f.view[0] - g.O[0]) * FT - m, vy0 = (f.view[1] - g.O[1]) * FT - m, vx1 = (f.view[2] - g.O[0]) * FT + m, vy1 = (f.view[3] - g.O[1]) * FT + m;
    const lod = f.zoom < 16.4;       // far out (or flying in): one tone per house, no lot lines
    for (const b of g.bands) {
      if (b.d0 > R) break;
      if (b.bb[2] < vx0 || b.bb[0] > vx1 || b.bb[3] < vy0 || b.bb[1] > vy1) continue;
      b.fill.forEach((p, i) => { if (p) { cL.globalAlpha = base * P.fillA[i]; cL.fillStyle = P.fill[i]; cL.fill(p); } });
      if (lod) { cH.globalAlpha = base; cH.fillStyle = P.roof[1]; cH.fill(b.lod); continue; }
      cL.globalAlpha = base * 0.9; cL.lineWidth = 0.75 * px;
      const hk = b.fill.length ? b.fill.length - 1 : -1;            // lot lines pick up the hail of their band
      cL.strokeStyle = hk >= 0 ? P.lineH[hk] : P.line; cL.stroke(b.lines);
      cH.globalAlpha = base; cH.fillStyle = P.drive; cH.fill(b.drive);
      cH.globalAlpha = base * P.shadowA; cH.fillStyle = P.shadow; cH.fill(b.shadow);
      cH.globalAlpha = base;
      for (let t = 0; t < 3; t++) { cH.fillStyle = P.roof[t]; cH.fill(b.roof[t]); }
    }
  }
  /* the entrance only: two cached images (lots, then houses) so the reveal is a clipped blit each frame. Released after. */
  const LC = { a: null, b: null, key: '' };
  function dropCache() { if (!LC.a && !LC.b) return; for (const k of ['a', 'b']) if (LC[k]) { LC[k].width = 0; LC[k].height = 0; LC[k] = null; } LC.key = ''; }
  function lotsCache(c, f, g) {
    const w = c.canvas.width, h = c.canvas.height, key = f.view.map((v) => v.toFixed(9)).join(',') + '|' + w + 'x' + h + '|' + A.theme + '|' + (g.ver || 0);
    if (LC.key === key) return;
    for (const k of ['a', 'b']) { if (!LC[k]) LC[k] = document.createElement('canvas'); if (LC[k].width !== w || LC[k].height !== h) { LC[k].width = w; LC[k].height = h; } }
    const ca = LC.a.getContext('2d'), cb = LC.b.getContext('2d');
    for (const x of [ca, cb]) { x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, h); x.globalAlpha = 1; }
    const px = worldXf(ca, f, g); worldXf(cb, f, g);
    drawBands(ca, cb, f, g, px, 1, Infinity);
    LC.key = key;
  }
  /** how far (ft from the park spot) the neighborhood has drawn in; Infinity once the entrance is over */
  function revealR(f, g) {
    if (V.reveal >= 1) return Infinity;
    let Rv = 0; for (const x of [f.view[0], f.view[2]]) for (const y of [f.view[1], f.view[3]]) Rv = Math.max(Rv, Math.hypot((x - g.O[0]) * FT, (y - g.O[1]) * FT));
    return V.reveal * (Math.min(Rv, g.maxD) + 450);
  }
  function drawLots(c, f) {
    const g = geo(); if (!g || !g.bands) return;
    const za = sm(f.zoom, 14.5, 15.7); if (za <= 0) return;
    const base = c.globalAlpha * za, R = revealR(f, g);
    // at rest: straight onto the basemap canvas (the world redraws it only when the camera moves; taps redraw the top canvas)
    if (R === Infinity) { dropCache(); drawBands(c, c, f, g, worldXf(c, f, g), base, Infinity); return; }
    lotsCache(c, f, g);
    const r = c.canvas.width / f.w, k = f.scale / FT, q = f.projectW(g.O[0], g.O[1]);
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = base;
    const RL = Math.max(0, R * k * r), RH = Math.max(0, (R - 220) * k * r), cx = q[0] * r, cy = q[1] * r;
    c.save(); c.beginPath(); c.arc(cx, cy, RL, 0, Math.PI * 2); c.clip(); c.drawImage(LC.a, 0, 0); c.restore();
    if (RH > 0) { c.save(); c.beginPath(); c.arc(cx, cy, RH, 0, Math.PI * 2); c.clip(); c.drawImage(LC.b, 0, 0); c.restore(); }
    // the survey front: a thin knocker-orange ring where the neighborhood is being drawn in
    c.globalAlpha = base * 0.35 * (1 - V.reveal); c.strokeStyle = P.acc; c.lineWidth = 1.5 * r;
    c.beginPath(); c.arc(cx, cy, RL, 0, Math.PI * 2); c.stroke();
  }
  /** the 25 walk homes: brighter, tinted by their hail, then by the outcome once logged; grey on the do-not-knock list */
  function drawHomes(c, f) {
    const g = geo(); if (!g) return;
    const za = sm(f.zoom, 14.5, 15.7); if (za <= 0) return;
    const base = c.globalAlpha * za, R = revealR(f, g), px = worldXf(c, f, g), cur = curRank();
    c.lineJoin = 'round';
    for (const d of g.doors) {
      const l = d.lot; if (!l || !l.paths) continue;
      const a = R === Infinity ? 1 : clamp((R - l.d - 120) / 240, 0, 1); if (a <= 0) continue;
      const p = l.paths, o = S.o[d.rank], skip = !o && !!S.flags[d.rank], hc = P.hail(d.h.hail);
      if (p.lot) {
        c.globalAlpha = base * a * (skip ? 0.05 : P.light ? 0.13 : 0.07); c.fillStyle = skip ? P.faint : P.css(hc); c.fill(p.lot);
        c.globalAlpha = base * a * (skip ? 0.3 : 0.6); c.strokeStyle = P.text2; c.lineWidth = 0.9 * px; c.stroke(p.lot);
      }
      c.globalAlpha = base * a; c.fillStyle = P.drive; c.fill(p.drive);
      c.globalAlpha = base * a * P.shadowA; c.fillStyle = P.shadow; c.fill(p.shadow);
      c.globalAlpha = base * a;
      for (let t = 0; t < 3; t++) {
        if (o) { const oc = P.outRGB[o]; const k = [0.55, 0.45, 0.36][t]; c.fillStyle = P.mix(P.landRGB, oc, P.light ? k * 0.85 : k); }
        else c.fillStyle = skip ? P.roof[t] : P.wroof[t];
        c.fill(p.roof[t]);
      }
      if (d.rank === cur) { c.globalAlpha = base * a; c.strokeStyle = P.acc; c.lineWidth = 1.6 * px; c.stroke(p.outline); }
    }
  }
  /** the polyline of the route between two arc lengths (feet) */
  function routePath(c, g, a0, a1) {
    const R = g.route, cum = g.cum; if (a1 <= a0) return false;
    let started = false;
    for (let i = 1; i < R.length; i++) {
      if (cum[i] < a0) continue;
      const s0 = cum[i - 1], L = cum[i] - s0 || 1;
      if (!started) { const k = clamp((a0 - s0) / L, 0, 1); c.moveTo(R[i - 1][0] + (R[i][0] - R[i - 1][0]) * k, R[i - 1][1] + (R[i][1] - R[i - 1][1]) * k); started = true; }
      if (cum[i] >= a1) { const k = clamp((a1 - s0) / L, 0, 1); c.lineTo(R[i - 1][0] + (R[i][0] - R[i - 1][0]) * k, R[i - 1][1] + (R[i][1] - R[i - 1][1]) * k); break; }
      c.lineTo(R[i][0], R[i][1]);
    }
    return started;
  }
  function drawWalk(c, f) {
    const g = geo(); if (!g) return;
    const za = sm(f.zoom, 14.2, 15.2); if (za <= 0) return;
    const now = performance.now(), px = worldXf(c, f, g), base = c.globalAlpha * za;
    const head = V.head * g.total, doneA = Math.min(head, doneArcNow(now));
    c.lineCap = 'round'; c.lineJoin = 'round';
    // spurs: sidewalk → door, for every lit door (none to a door on the do-not-knock list)
    for (const d of g.doors) {
      if (!V.lit[d.rank]) continue;
      const o = S.o[d.rank]; if (!o && S.flags[d.rank]) continue;
      c.globalAlpha = base * (o ? 0.85 : 0.4); c.strokeStyle = o ? P.acc : P.text2; c.lineWidth = (o ? 1.6 : 1.1) * px;
      c.setLineDash(o ? [] : [2.2 * px, 3 * px]);
      c.beginPath(); c.moveTo(d.foot[0], d.foot[1]); c.lineTo(d.D[0], d.D[1]); c.stroke();
    }
    // ahead: dashed; behind you: solid knocker orange with a soft glow
    c.setLineDash([5 * px, 5 * px]); c.globalAlpha = base * 0.7; c.strokeStyle = P.text2; c.lineWidth = 1.8 * px;
    c.beginPath(); if (routePath(c, g, doneA, head)) c.stroke();
    c.setLineDash([]);
    if (doneA > 0) {
      c.globalAlpha = base * 0.22; c.strokeStyle = P.acc; c.lineWidth = 9 * px; c.beginPath(); if (routePath(c, g, 0, doneA)) c.stroke();
      c.globalAlpha = base; c.lineWidth = 3 * px; c.beginPath(); if (routePath(c, g, 0, doneA)) c.stroke();
    }
    // the walker: a bright head while the route draws itself
    if (V.head > 0 && V.head < 1) {
      const R = g.route, cum = g.cum; let i = 1; while (i < R.length - 1 && cum[i] < head) i++;
      const k = clamp((head - cum[i - 1]) / (cum[i] - cum[i - 1] || 1), 0, 1), x = R[i - 1][0] + (R[i][0] - R[i - 1][0]) * k, y = R[i - 1][1] + (R[i][1] - R[i - 1][1]) * k;
      c.globalAlpha = base * 0.25; c.fillStyle = P.acc; c.beginPath(); c.arc(x, y, 9 * px, 0, Math.PI * 2); c.fill();
      c.globalAlpha = base; c.beginPath(); c.arc(x, y, 3.4 * px, 0, Math.PI * 2); c.fill();
    }
    // knocks on the map: rings ring out from the door
    V.ripples = V.ripples.filter((rp) => now - rp.t0 < 1100);
    for (const rp of V.ripples) for (let j = 0; j < 3; j++) {
      const k = clamp((now - rp.t0 - j * 130) / 820, 0, 1); if (k <= 0 || k >= 1) continue;
      const e = A.motion.ease.outCubic(k);
      c.globalAlpha = base * (1 - k) * 0.9; c.strokeStyle = rp.col; c.lineWidth = (2.2 - k * 1.4) * px;
      c.beginPath(); c.arc(rp.p[0], rp.p[1], (10 + e * 58) * px, 0, Math.PI * 2); c.stroke();
    }
  }
  function ringR(f) { return clamp(4 + (f.zoom - 15.5) * 2.3, 6, 11); }
  function drawDoors(c, f) {
    const g = geo(); if (!g) return;
    const za = sm(f.zoom, 14.6, 15.6); if (za <= 0) return;
    const now = performance.now(), base = c.globalAlpha * za, R = ringR(f), cur = curRank();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const d of g.doors) {
      const lit = V.lit[d.rank]; if (!lit) continue;
      const q = f.project(d.ll); if (q[0] < -40 || q[1] < -40 || q[0] > f.w + 40 || q[1] > f.h + 40) continue;
      const pop = lit === true || A.still ? 1 : outBack(clamp((now - lit) / 460, 0, 1));
      const isCur = d.rank === cur;
      let s = pop; if (isCur) s *= 1.18 + (V.lift.rank === d.rank && !A.still ? 0.35 * Math.exp(-(now - V.lift.t0) / 170) * Math.sin(clamp((now - V.lift.t0) / 520, 0, 1) * Math.PI) : 0);
      if (d.rank === V.hover && !isCur) s *= 1.1;
      const r = R * s; if (r <= 0.3) continue;
      const o = S.o[d.rank], skip = !o && !!S.flags[d.rank], hc = P.css(P.hail(d.h.hail)), a0 = base * clamp(pop * 1.5, 0, 1);
      if (isCur) { c.globalAlpha = a0 * 0.22; c.fillStyle = P.acc; c.beginPath(); c.arc(q[0], q[1], r + 7, 0, Math.PI * 2); c.fill(); }
      // inside the modeled 1-inch line: a dotted halo in the door's hail color
      if (d.in1 && !skip) {
        c.globalAlpha = a0 * (o ? 0.5 : 0.8); c.setLineDash([1.4, 2.6]); c.lineWidth = 1.2; c.strokeStyle = hc;
        c.beginPath(); c.arc(q[0], q[1], r + (isCur ? 9.5 : 4.2), 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
      }
      c.globalAlpha = a0 * (skip ? 0.85 : 1); c.fillStyle = o ? P.out[o] : P.panel; c.beginPath(); c.arc(q[0], q[1], r, 0, Math.PI * 2); c.fill();
      if (skip) { c.lineWidth = 1.4; c.strokeStyle = P.faint; c.beginPath(); c.arc(q[0], q[1], r - 0.8, 0, Math.PI * 2); c.stroke(); }
      else if (!o) {
        c.lineWidth = 1.6; c.strokeStyle = P.rule3; c.beginPath(); c.arc(q[0], q[1], r - 1, 0, Math.PI * 2); c.stroke();
        c.lineWidth = 2.4; c.strokeStyle = hc; c.beginPath(); c.arc(q[0], q[1], r - 1, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * d.h.score) / 100); c.stroke();
      }
      if (isCur) { c.globalAlpha = a0; c.lineWidth = 2; c.strokeStyle = P.acc; c.beginPath(); c.arc(q[0], q[1], r + 3.2, 0, Math.PI * 2); c.stroke(); }
      c.globalAlpha = a0; c.fillStyle = o ? P.page : skip ? P.muted : P.text; c.font = '600 ' + Math.round(clamp(r * 0.9, 8, 11)) + 'px ' + FONT_MONO;
      c.fillText(String(d.idx), q[0], q[1] + 0.5);
      if (skip) { c.lineWidth = 1.5; c.strokeStyle = P.muted; c.beginPath(); c.moveTo(q[0] - r * 0.7, q[1] + r * 0.7); c.lineTo(q[0] + r * 0.7, q[1] - r * 0.7); c.stroke(); }
    }
  }

  /* ======================= the view ======================= */
  let ctxNow = null, api = null;
  const curRank = () => (S && S.cur) || 0;
  const doorBy = (rank) => { const g = geo(); return g && g.doors.find((d) => d.rank === rank); };
  function nextOpen(fromRank) {
    const g = geo(); if (!g) return 0;
    const i0 = Math.max(0, g.doors.findIndex((d) => d.rank === fromRank));
    for (let k = 1; k <= g.doors.length; k++) { const d = g.doors[(i0 + k) % g.doors.length]; if (!settled(d.rank)) return d.rank; }
    return 0;
  }
  const firstOpen = (g) => { const d = g.doors.find((x) => !settled(x.rank)); return (d || g.doors[0]).rank; };

  A.view.register('knock', {
    // hail 0: at street zoom the shared field is one flat value (it changed ~1/255 of a pixel); the lot tint carries the
    // modeled hail here, and flying in from a wider view the heat fades out as the tinted lots arrive
    title: { en: 'Knock', es: 'Tocar' }, key: '3', ambient: false, hail: 0, dim: 0,
    camera: (fr) => {
      const N = A.data, pts = (N.homes || []).map((h) => h.p);
      (N.walk && N.walk.s || []).forEach((s) => s.p.forEach((p) => pts.push(p)));
      if (N.walk && N.walk.park) pts.push(N.walk.park);
      return { points: pts, pad: fr && fr.stacked ? 34 : 60, maxZoom: 18.4 };
    },
    enter(ctx) {
      ctxNow = ctx;
      readP(); load();
      const g = geo();
      if (!g) { ctx.el('left', '<div class="empty"><span class="empty__t">' + A.L('The walk did not load.', 'La ruta no cargó.') + '</span></div>', 'pane'); return; }
      if (!S.cur || !doorBy(S.cur)) S.cur = firstOpen(g);
      V.done = { from: 0, to: doneArcTarget(g), t0: 0 };
      V.lit = {}; V.ripples = []; V.hover = 0;
      const still = A.still;
      if (still) { V.reveal = 1; V.head = 1; g.doors.forEach((d) => (V.lit[d.rank] = true)); } else { V.reveal = 0; V.head = 0; }

      ctx.layer({ id: 'knock-lots', z: 40, draw2d: drawLots, fadeIn: false });
      ctx.layer({ id: 'knock-homes', z: 110, draw2d: drawHomes, fadeIn: false });
      ctx.layer({ id: 'knock-walk', z: 120, draw2d: drawWalk, fadeIn: false });
      ctx.layer({
        id: 'knock-doors', z: 210, draw2d: drawDoors, fadeIn: false,
        hit(pt, f) {
          const R = ringR(f) + 6; let best = null, bd = R;
          for (const d of g.doors) { if (!V.lit[d.rank]) continue; const q = f.project(d.ll), dd = Math.hypot(q[0] - pt.x, q[1] - pt.y); if (dd < bd) { bd = dd; best = d; } }
          return best ? { id: 'door-' + best.rank, rank: best.rank } : null;
        },
        onClick(item) { if (item) select(item.rank, { fly: true, from: 'map' }); },
        onHover(item) { V.hover = item ? item.rank : 0; A.world.invalidate('top'); }
      });
      ctx.on('theme', () => { readP(); drawPortrait(true); A.world.invalidate(); });
      ctx.on('world:hail', () => { A.safe('knock tint', () => { tint(g); readP(); renderAll(false, false); }); A.world.invalidate(); });
      ctx.on('lang', () => drawPortrait(true));
      ctx.on('escape', () => { if (V.tl && V.tl.playing) V.tl.skip(); });
      ctx.on('camera:end', () => { if (V.reveal >= 1) placeTag(false, false, true); });

      buildPanel(ctx, g);

      // one tap per door: N T I X B, U undoes (1-5 belong to the tabs)
      const onKey = (e) => {
        if (A.view.current !== 'knock' || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
        const t = e.target; if (t && (t.isContentEditable || /^(TEXTAREA|SELECT)$/.test(t.tagName) || (t.tagName === 'INPUT' && t.type !== 'checkbox'))) return;
        const k = String(e.key || '').toUpperCase(), o = OUT.find((x) => x.key === k);
        if (o) { e.preventDefault(); const b = ctx.slots.left.querySelector('[data-out="' + o.id + '"]'); if (b) A.motion.ripple(b, { inside: b, rings: 2, size: b.offsetWidth * 1.2 }); tap(o.id); }
        else if (k === 'U') { e.preventDefault(); undo(); }
      };
      document.addEventListener('keydown', onKey); ctx.own(() => document.removeEventListener('keydown', onKey));
      ctx.own(() => {
        if (V.tl) V.tl.stop(); V.tl = null; if (liveFn) { A.motion.ticker.remove(liveFn); liveFn = null; }
        stopPortrait(); dropCache(); A.world && A.world.unpin('knock-cur'); ctxNow = null; els = {};
      });

      // park spot
      const wk = A.data.walk, pn = wk.pn || [];
      const park = ctx.pin('knock-park', wk.park, A.h('<div class="knock-park" tabindex="0" role="note" data-tip="' + A.esc('Park here: ' + pn.join(' & ')) + '" data-tip-es="' + A.esc('Estaciónate aquí: ' + pn.join(' y ')) + '" data-label-en="' + A.esc('Park here: ' + pn.join(' & ')) + '" data-label-es="' + A.esc('Estaciónate aquí: ' + pn.join(' y ')) + '"><b>P</b></div>'), { anchor: 'center', minZoom: 14.6, offset: [-22, -20] });
      if (park) { park.style.opacity = still ? '' : '0'; A.ui.localize(park); }
      placeTag(false);
      ctx.timer(() => placeTag(false, false, true), 90);   // the panels just changed the map's focus area: re-aim once it settled

      // the entrance: starts as the camera settles on the street
      let started = false;
      const go = () => { if (started || !ctx.alive()) return; started = true; entrance(ctx, g, park); };
      if (still) go();
      else { ctx.on('camera:end', (d) => { if (!d || d.zoom > 16) go(); }); ctx.timer(go, 3000); }
    },
    exit() { A.safe('knock exit', () => { if (V.tl) V.tl.stop(); }); }
  });

  function entrance(ctx, g, park) {
    const fin = () => {
      V.reveal = 1; V.head = 1; g.doors.forEach((d) => { if (!V.lit[d.rank]) V.lit[d.rank] = true; });
      setLive('knock-lots', false); setLive('knock-homes', false); dropCache(); if (park) park.style.opacity = '';
      placeTag(true); A.world.invalidate();
    };
    if (A.still) { fin(); rollCounters(0); return; }
    const tl = (V.tl = new A.motion.Timeline());
    setLive('knock-lots', true); setLive('knock-homes', true); pulse(300);
    tl.add(0, { ms: 1500, ease: 'outCubic', update: (p) => { V.reveal = p; } });
    tl.add(1500, () => { V.reveal = 1; setLive('knock-lots', false); setLive('knock-homes', false); dropCache(); A.world.invalidate('base'); });
    tl.add(260, () => { if (park) { park.style.opacity = ''; A.motion.reveal(park.firstElementChild, { y: 10, ring: true, size: 46 }); } });
    tl.add(420, { ms: 2100, ease: 'inOutSine', update: (p) => {
      V.head = p; const now = performance.now(), h = p * g.total;
      g.doors.forEach((d) => { if (!V.lit[d.rank] && d.arc <= h + 6) { V.lit[d.rank] = now; if (window.Sound && Sound.enabled) A.safe('knock ring', () => Sound.ring(undefined, { gain: 0.35 })); } });
    } });
    tl.add(700, () => rollCounters(0));
    tl.add(2560, () => { placeTag(true); });
    tl.play().then(() => { if (!ctx.alive()) return; fin(); pulse(600); V.tl = null; });
  }

  /* ---------------- the current door's tag on the map: it takes the side with no other door under it ---------------- */
  let tagKey = '';
  /** where the tag goes: above, below, right or left of the door, whichever covers no other ring and no P and stays on the
      map. Reads the live camera (not the last drawn frame); predict = the camera is flying to this door (it ends mid-map). */
  function tagPlace(d, w, h, predict) {
    const W = A.world, g = geo(), def = { side: 'top', x: -w / 2, y: -h - 18, stem: w / 2 };
    if (!W || !W.w || !W.project || !g) return def;
    const ins = W.insetTarget || { l: 0, r: 0, t: 0, b: 0 }, z = W.camera().zoom;
    const fc = { x: ins.l, y: ins.t, w: W.w - ins.l - ins.r, h: W.h - ins.t - ins.b };
    const zt = predict ? clamp(z, 17.2, 18.3) : z, k = Math.pow(2, zt - z), R = clamp(4 + (zt - 15.5) * 2.3, 6, 11);
    const q = W.project(d.ll), p = predict ? [fc.x + fc.w / 2, fc.y + fc.h / 2] : q;
    const rel = (ll) => { const s = W.project(ll); return [p[0] + (s[0] - q[0]) * k, p[1] + (s[1] - q[1]) * k]; };
    const obs = [];
    for (const o of g.doors) if (o !== d && V.lit[o.rank]) obs.push({ c: rel(o.ll), r: R + 4 });
    const wk = A.data.walk; if (wk && wk.park) { const c = rel(wk.park); obs.push({ c: [c[0] - 22, c[1] - 20], r: 18 }); }   // the P pin
    const E = [fc.x + 8, fc.y + 8, fc.x + fc.w - 8, fc.y + fc.h - 8], Rc = R * 1.18;
    const gap = Rc + 9, cands = [
      { side: 'top', x: -w / 2, y: -gap - h, pen: 0 },
      { side: 'bottom', x: -w / 2, y: gap, pen: 0.35 },
      { side: 'right', x: Rc + 12, y: -h / 2, pen: 0.6 },
      { side: 'left', x: -Rc - 12 - w, y: -h / 2, pen: 0.6 }
    ];
    let best = null;
    for (const c of cands) {
      let x = c.x;
      if (c.side === 'top' || c.side === 'bottom') {        // slide along the edge to stay on the map; the stem keeps pointing at the door
        const x0 = p[0] + x, x1 = x0 + w, lim = w / 2 - 16;
        if (x0 < E[0]) x += Math.min(E[0] - x0, lim); else if (x1 > E[2]) x -= Math.min(x1 - E[2], lim);
      }
      const X0 = p[0] + x, Y0 = p[1] + c.y, X1 = X0 + w, Y1 = Y0 + h;
      let cost = c.pen;
      for (const o of obs) { const cx = clamp(o.c[0], X0, X1), cy = clamp(o.c[1], Y0, Y1); if (Math.hypot(o.c[0] - cx, o.c[1] - cy) < o.r) cost += 1; }
      cost += (Math.max(0, E[0] - X0) + Math.max(0, X1 - E[2]) + Math.max(0, E[1] - Y0) + Math.max(0, Y1 - E[3])) / 10;
      if (!best || cost < best.cost - 1e-6) best = { cost, side: c.side, x, y: c.y };
    }
    best.stem = best.side === 'top' || best.side === 'bottom' ? -best.x : h / 2;
    return best;
  }
  /** animate = the door just became current (it lifts); predict = the camera is flying to it; keep = only re-aim the tag */
  function placeTag(animate, predict, keep) {
    const ctx = ctxNow; if (!ctx || !A.world) return;
    const d = doorBy(curRank());
    if (!d || !V.lit[d.rank]) { A.world.unpin('knock-cur'); tagKey = ''; return; }
    let el = keep ? document.querySelector('.pin[data-pin="knock-cur"]') : null;
    if (keep && !el) return;
    if (!el) {
      const o = S.o[d.rank], fl = !o && S.flags[d.rank];
      const tail = o ? '<span class="knock-tag__o" style="--oc:var(' + OUTBY[o].tok + ')">' + A.L(A.esc(OUTBY[o].short.en), A.esc(OUTBY[o].short.es)) + '</span>'
        : fl ? '<span class="knock-tag__o knock-tag__o--skip">' + A.L('Do not knock', 'No tocar') + '</span>' : '';
      el = A.h('<div class="knock-tag" aria-hidden="true"><div class="knock-tag__in"><span class="knock-tag__n">' + d.idx + '</span><b>' + A.esc(d.h.addr) + '</b>' + tail + '</div></div>');
      A.world.pin('knock-cur', d.ll, el, { anchor: 'none', minZoom: 15.4, offset: [-4000, -4000] });
    }
    const pl = tagPlace(d, el.offsetWidth || 160, el.offsetHeight || 28, predict);
    const k = d.rank + ':' + pl.side + ':' + Math.round(pl.x) + ':' + Math.round(pl.y);
    if (keep && k === tagKey) return;
    tagKey = k;
    A.world.pin('knock-cur', d.ll, el, { anchor: 'none', minZoom: 15.4, offset: [pl.x, pl.y] });
    el.dataset.side = pl.side; el.style.setProperty('--stem', pl.stem.toFixed(1) + 'px');
    if (animate && !A.still) {
      V.lift = { rank: d.rank, t0: performance.now() }; pulse(620);
      const from = { top: 'translateY(12px)', bottom: 'translateY(-12px)', right: 'translateX(-12px)', left: 'translateX(12px)' }[pl.side] + ' scale(.92)';
      try { el.firstElementChild.animate([{ transform: from, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: A.motion.css.hail, fill: 'backwards' }); } catch (e) { /* ignore */ }
    }
  }

  /* ======================= actions ======================= */
  function select(rank, o = {}) {
    const d = doorBy(rank); if (!d || !S) return;
    const same = S.cur === rank; S.cur = rank; save();
    renderAll(!same);
    const fly = o.fly !== false;
    if (fly) flyTo(d);
    placeTag(!same, fly);
    A.world.invalidate('top');
  }
  function flyTo(d) {
    const W = A.world; if (!W) return;
    const z = W.camera().zoom;
    A.safe('knock fly', () => W.flyTo({ center: d.ll, zoom: clamp(z, 17.2, 18.3) }, { ms: 800, instant: A.still }));
  }
  function say(en, es) { if (els.sr) els.sr.textContent = A.lang === 'es' ? es : en; }
  function tap(id, o = {}) {
    const g = geo(); if (!g || !S || !OUTBY[id]) return;
    const rank = o.rank || curRank(), d = doorBy(rank); if (!d) return;
    const was = S.o[rank] || null, aw = S.auto[rank] || 0;
    S.o[rank] = id; delete S.auto[rank]; S.hist.push({ r: rank, was, aw }); if (S.hist.length > 200) S.hist.shift();
    save();
    const wasAll = counts().done >= g.doors.length && !!was;
    if (!A.still) V.ripples.push({ p: d.D, t0: performance.now(), col: P.out[id] || P.acc });
    retarget(g); pulse(1200);
    if (window.Sound && Sound.enabled) A.safe('knock sound', () => { Sound.knock(); if (id === 'inspection_set') Sound.ring(4, { delay: 0.35 }); });
    say('Logged ' + OUTBY[id].label.en + ' at ' + d.h.addr + '.', 'Anotado: ' + OUTBY[id].label.es + ' en ' + d.h.addr + '.');
    if (id === 'inspection_set') { S.follow = rank; save(); renderAll(false, true); placeTag(false); A.world.invalidate('top'); return; }
    S.follow = 0; save();
    renderAll(false, true); placeTag(false); A.world.invalidate('top');
    advance(rank, wasAll);
  }
  /** no soliciting sign / asked us not to come back: the door goes on the do-not-knock list (by address) and is settled */
  function toggleFlag(kind, rank) {
    const g = geo(); if (!g || !S || !FLAGBY[kind]) return;
    rank = rank || curRank(); const d = doorBy(rank); if (!d) return;
    const was = S.o[rank] || null, fw = S.flags[rank] || null, aw = S.auto[rank] || 0, dw = dnkList()[d.h.addr] || null;
    S.hist.push({ r: rank, was, aw, f: 1, fw, dw }); if (S.hist.length > 200) S.hist.shift();
    const on = fw !== kind;
    if (!on) {
      delete S.flags[rank]; dnkPut(d.h.addr, null);
      if (S.auto[rank]) { delete S.o[rank]; delete S.auto[rank]; }
    } else {
      S.flags[rank] = kind; dnkPut(d.h.addr, { k: kind, day: A.story.today });
      if (S.auto[rank]) { delete S.o[rank]; delete S.auto[rank]; }
      // "asked us not to come back" means someone answered and said no
      if (kind === 'dontReturn' && !S.o[rank]) { S.o[rank] = 'not_interested'; S.auto[rank] = 1; }
    }
    if (S.follow === rank && S.o[rank] !== 'inspection_set') S.follow = 0;
    save(); retarget(g);
    if (on && !A.still) V.ripples.push({ p: d.D, t0: performance.now(), col: P.muted });
    pulse(900);
    say(on ? d.h.addr + ' is on your do-not-knock list.' : d.h.addr + ' is off your do-not-knock list.', on ? d.h.addr + ' está en tu lista de no tocar.' : d.h.addr + ' salió de tu lista de no tocar.');
    renderAll(false, true); placeTag(false); A.world.invalidate('top');
    if (on && !was) advance(rank, false);
  }
  function advance(rank, quiet) {
    const g = geo(), c = counts();
    const nx = nextOpen(rank);
    if (nx) {
      S.cur = nx; save();
      const after = () => { if (!ctxNow || S.cur !== nx) return; renderAll(true, false); flyTo(doorBy(nx)); placeTag(true, true); A.world.invalidate('top'); };
      if (A.still || !ctxNow) after(); else ctxNow.timer(after, 260);
    } else { save(); renderAll(false, false); placeTag(false); A.world.invalidate('top'); if (c.done >= g.doors.length && !quiet) walkDone(); }
  }
  function undo() {
    const g = geo(); if (!g || !S || !S.hist.length) { A.ui.toast({ en: 'Nothing to undo', es: 'No hay nada que deshacer' }, { ms: 1400 }); return; }
    const h = S.hist.pop();
    if (h.was) S.o[h.r] = h.was; else delete S.o[h.r];
    if (h.aw) S.auto[h.r] = 1; else delete S.auto[h.r];
    if (h.f) { if (h.fw) S.flags[h.r] = h.fw; else delete S.flags[h.r]; const d = doorBy(h.r); if (d) dnkPut(d.h.addr, h.dw || null); }
    if (S.follow === h.r && S.o[h.r] !== 'inspection_set') S.follow = 0;
    S.cur = h.r; save(); retarget(g);
    A.ui.toast(Tx(((window.COPY || {}).ui || {}).toast ? COPY.ui.toast.undone : { en: 'Undone', es: 'Deshecho' }), { icon: 'arrow', ms: 1400 });
    renderAll(true, true); flyTo(doorBy(h.r)); placeTag(true, true); A.world.invalidate('top');
  }
  /** a fresh walk; the do-not-knock list stays (it is per address) unless all = true */
  function reset(all) {
    const g = geo(); if (!g) return;
    if (all) A.store.del(DNK);
    S = blank(); applyDnk(); S.cur = firstOpen(g); save();
    V.done = { from: doneArcNow(performance.now()), to: doneArcTarget(g), t0: performance.now() }; pulse(700);
    renderAll(true, true); placeTag(true); A.world.invalidate('top');
    if (A.view.current === 'knock') A.view.recenter();
  }
  /** the recap dock is the message (a toast would land on it); the camera steps back to show the whole walk */
  function walkDone() {
    say('Walk finished. Your recap is ready.', 'Ruta terminada. Tu resumen está listo.');
    if (A.view.current === 'knock') A.view.recenter();
  }
  function openDeal(rank) {
    const d = doorBy(rank || curRank()); if (!d) return;
    const home = Object.assign({}, d.h, { walkIndex: d.idx, outcome: S.o[d.rank] || null, legal: !!S.legal[d.rank], slot: S.slot[d.rank] != null ? slots()[S.slot[d.rank]] : null });
    A.dealHome = home; A.emit('deal:home', home);
    A.view.go('deal');
  }
  function slots() {
    const day = '2026-09-30';
    return [{ day, time: '10:00' }, { day, time: '13:00' }, { day, time: '16:30' }];
  }

  /* ======================= the panels ======================= */
  let els = {};
  const lineTip = { en: 'Modeled from NOAA SPC/NWS storm reports + MRMS radar hail size. A radar estimate, not confirmed at this address.', es: 'Modelado con reportes de tormenta de NOAA SPC/NWS + tamaño de granizo por radar MRMS. Es un estimado del radar, no confirmado en esta dirección.' };
  const lineTag = () => A.ui.srcTag({ label: 'SPC+MRMS', tip: lineTip });
  const logTag = () => A.ui.srcTag({ label: 'log', tip: { en: 'Your own door log, kept on this device. Sample walk: sample homes, sample results.', es: 'Tu propio registro de puertas, guardado en este equipo. Ruta de muestra: casas de muestra, resultados de muestra.' } });
  const bench = () => (window.Funnel && Funnel.bench) || {};
  const hrsBetween = (a, b) => { const p = (s) => { const m = String(s || '').split(':'); return +m[0] + (+m[1] || 0) / 60; }; return p(b) - p(a); };
  const arrowSvg = (dir) => A.ui.icon('arrow', { size: 13, cls: 'knock-st__arrow' }).replace('<svg ', '<svg style="transform:rotate(' + (dir * 45 - 90) + 'deg)" ');

  function buildPanel(ctx, g) {
    // right: the walk (where and when, progress, the streets in order, the map key)
    const plan = ctx.el('right', planHTML(g), 'pane knock-plan');
    const order = ctx.el('right', orderHTML(g), 'pane pane--tight knock-order');
    // the map key sits on the map, bottom-left of the free area (under the map on phones)
    const key = ctx.el('center', keyHTML(), 'float knock-legend');
    // left: the door, then one tap per door (sticky)
    const card = ctx.el('left', '', 'pane knock-card');
    const foot = ctx.el('left', footHTML(), 'pane pane--tight pane--foot knock-foot');
    els = { plan, order, key, card, foot, recap: null, sr: foot.querySelector('.sr') };

    order.addEventListener('click', (e) => { const b = e.target.closest('[data-rank]'); if (b) select(+b.dataset.rank, { fly: true }); });
    foot.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.out) tap(b.dataset.out);
      else if (b.dataset.act === 'undo') undo();
      else if (b.dataset.act === 'reset') {
        if (b.dataset.armed) { delete b.dataset.armed; b.classList.remove('is-armed'); b.innerHTML = A.L('Reset walk', 'Reiniciar ruta'); reset(); }
        else { b.dataset.armed = '1'; b.classList.add('is-armed'); b.innerHTML = A.L('Tap again to reset', 'Toca otra vez'); ctxNow && ctxNow.timer(() => { if (b.isConnected && b.dataset.armed) { delete b.dataset.armed; b.classList.remove('is-armed'); b.innerHTML = A.L('Reset walk', 'Reiniciar ruta'); } }, 2600); }
      }
    });
    card.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const r = curRank();
      if (b.dataset.slot != null) { S.slot[r] = +b.dataset.slot; save(); const sl = slots()[+b.dataset.slot]; A.ui.toast({ en: 'Inspection saved: ' + A.fmt.date(sl.day, 'day', 'en') + ' · ' + A.fmt.time(sl.time, 'en'), es: 'Inspección guardada: ' + A.fmt.date(sl.day, 'day', 'es') + ' · ' + A.fmt.time(sl.time, 'es') }, { icon: 'clock', ms: 1800 }); S.follow = 0; save(); advance(r); }
      else if (b.dataset.act === 'deal') openDeal(r);
      else if (b.dataset.act === 'next') { S.follow = 0; save(); advance(r); }
      else if (b.dataset.flag) toggleFlag(b.dataset.flag, r);
      else if (b.dataset.goto) select(+b.dataset.goto, { fly: true });
    });
    card.addEventListener('change', (e) => { const i = e.target.closest('input[data-legal]'); if (!i) return; if (i.checked) S.legal[curRank()] = 1; else delete S.legal[curRank()]; save(); renderCard(false); });
    try {
      let lw = 0;
      const ro = new ResizeObserver(() => { const cv = card.querySelector('.knock-portrait'), w = cv ? Math.round(cv.getBoundingClientRect().width) : 0; if (w && w !== lw) { const was = lw; lw = w; if (was) drawPortrait(true); } });
      ro.observe(card); ctx.own(() => ro.disconnect());
    } catch (e) { /* no ResizeObserver: the portrait keeps its first size */ }

    renderAll(false, false, true);
  }

  function planHTML(g) {
    const N = A.data, pk = N.pick || {}, wk = N.walk || {}, U = A.ui, F = A.fmt, bt = pk.best_time || {};
    const B = bench(), dph = B.doors_per_hour || { low: 10, typical: 12, high: 15, source: 'rookie knocking benchmarks' };
    const n = g.doors.length, hrs = n / dph.typical, win = hrsBetween(bt.start || '16:00', bt.end || '19:30');
    const hh = Math.round(hrs * 2) / 2, hTxt = (l) => (hrs < 1 ? Math.max(5, Math.round((hrs * 60) / 5) * 5) + ' min' : F.num(hh, hh % 1 ? 1 : 0, l) + ' h');
    const rng2 = (l) => F.range(bt.start || '16:00', bt.end || '19:30', l);
    const mi = (l) => F.miles(Math.max(0.1, Math.round((g.total / 5280) * 10) / 10), 1, l);
    const dphTag = U.srcTag({ label: 'bench', tip: { en: 'Industry benchmark for a new rep: ' + dph.low + '-' + dph.high + ' doors an hour, typical ' + dph.typical + ' (' + dph.source + '). Replace with HMP\'s own after ~200 doors.', es: 'Referencia de la industria para un vendedor nuevo: de ' + dph.low + ' a ' + dph.high + ' puertas por hora, típico ' + dph.typical + ' (' + dph.source + '). Cámbiala por la de HMP después de ~200 puertas.' } });
    return `
      <div class="knock-plan__head">
        <p class="eyebrow eyebrow--acc"><span>${A.L("Tonight's walk", 'La ruta de hoy')} · <b>${A.L("Aldaba's pick", 'La elección de Aldaba')}</b></span></p>
        <h1 class="t-title knock-plan__title">${A.esc((pk.name || '').replace(/^Columbus:\s*/, ''))}</h1>
        <p class="knock-plan__sub">${A.L('Columbus · park at ' + A.esc(pn(wk, ' & ')), 'Columbus · estaciónate en ' + A.esc(pn(wk, ' y ')))}</p>
        <p class="knock-plan__facts"><span class="knock-fact"><span data-h="${U.hailKey(pk.hail_in)}"><b class="num">${F.num(pk.hail_in, 2)}</b> ${A.L('in hail', 'pulg de granizo')}</span> ${U.srcTag('mrms')}</span><span class="knock-fact"><span>${A.L('storm', 'tormenta')} ${A.both(() => F.date(pk.storm_day))}</span> ${U.srcTag('spc')}</span></p>
      </div>
      <div class="knock-prog">
        <div class="knock-ring" role="img" data-label-en="Walk progress" data-label-es="Avance de la ruta">
          <svg viewBox="0 0 88 88" aria-hidden="true">${ringSegs(g)}</svg>
          <div class="knock-ring__c"><span class="knock-ring__n num" data-k="done">0</span><span class="knock-ring__of">${A.L('of ' + n, 'de ' + n)}</span></div>
        </div>
        <dl class="knock-tally">
          ${tally('knocked', A.L('Knocked', 'Tocadas') + ' ' + logTag())}
          ${tally('answered', A.L('Answered', 'Abrieron'))}
          ${tally('inspection_set', A.L('Inspections', 'Inspecciones'), 'ok')}
          ${tally('come_back', A.L('Come back', 'Regresar'), 'warn')}
        </dl>
      </div>
      <ul class="knock-meta">
        <li><i data-icon="route" class="i--sm"></i><span>${A.L('<b>' + mi('en') + '</b> ' + (g.loop ? 'loop, ends back at the car' : 'walk'), '<b>' + mi('es') + '</b> ' + (g.loop ? 'en circuito, termina en el carro' : 'de ruta'))} ${U.srcTag('streets')}</span></li>
        <li><i data-icon="clock" class="i--sm"></i><span>${A.L('Best time <b>' + rng2('en') + '</b>', 'Mejor hora <b>' + rng2('es') + '</b>')} ${U.srcTag('engine')} ${A.L('· about ' + hTxt('en') + ' at ' + dph.typical + ' doors an hour' + (hrs > win ? ', longer than the window' : ''), '· unas ' + hTxt('es') + ' a ' + dph.typical + ' puertas por hora' + (hrs > win ? ', más que el horario' : ''))} ${dphTag}</span></li>
        <li class="knock-meta__line" data-line></li>
      </ul>`;
  }
  const pn = (wk, j) => (wk.pn || []).join(j);
  /** the plan's 1-inch line: how many doors sit inside it, and how far its nearest edge is */
  function lineSummary(g) {
    if (!g.hailOk) return '';
    const n = g.doors.length, e = g.edge;
    const mi = e && e.mi != null ? Math.max(0.1, Math.round(e.mi * 10) / 10) : null;
    const edge = mi != null ? A.L(', about ' + A.fmt.miles(mi, 1, 'en') + ' from its edge (' + DIRS.en[e.dir] + ')', ', a unas ' + A.fmt.miles(mi, 1, 'es') + ' de su borde (' + DIRS.es[e.dir] + ')') : '';
    return `${haloSvg('knock-meta__halo', A.ui.hailKey((A.data.pick || {}).hail_in))}<span>${A.L('<b>' + g.in1 + ' of ' + n + '</b> doors inside the 1-inch hail line', '<b>' + g.in1 + ' de ' + n + '</b> puertas dentro de la línea de 1 pulgada')}${edge}. ${lineTag()}</span>`;
  }
  function orderHTML(g) {
    const rows = g.walkSt.map((w) => {
      const ft = A.fmt.int(Math.round(((w.s.m || 0) * 3.28084) / 10) * 10, 'en'), ftEs = A.fmt.int(Math.round(((w.s.m || 0) * 3.28084) / 10) * 10, 'es');
      return `<li class="knock-st" data-st="${w.i}">
        <span class="knock-st__i">${w.i + 1}</span>
        <b class="knock-st__t" tabindex="0" data-tip="${A.esc(prettySt(w.s.f) + ' to ' + prettySt(w.s.t) + ' · ' + ft + ' ft (Nebraska GIS)')}" data-tip-es="${A.esc('de ' + prettySt(w.s.f) + ' a ' + prettySt(w.s.t) + ' · ' + ftEs + ' pies (Nebraska GIS)')}">${A.esc(w.s.n)}</b>
        <span class="knock-st__dir">${arrowSvg(w.dir)}${A.L('heading ' + DIRS.en[w.dir], 'hacia el ' + DIRS.es[w.dir])}</span>
        <span class="knock-st__n num" data-st-n="${w.i}">0/${w.doors.length}</span>
        <span class="knock-dots">${w.doors.map((d) => `<button type="button" class="knock-dot" data-rank="${d.rank}" data-tip="${A.esc(d.idx + ' · ' + d.h.addr)}" data-tip-es="${A.esc(d.idx + ' · ' + d.h.addr)}" data-label-en="${A.esc('Door ' + d.idx + ', ' + d.h.addr)}" data-label-es="${A.esc('Puerta ' + d.idx + ', ' + d.h.addr)}"><span>${d.idx}</span></button>`).join('')}</span>
      </li>`;
    }).join('');
    return `<p class="sec">${T(CK.walkTitle || { en: 'Your walk, in order', es: 'Tu ruta, en orden' })} <span class="sec__meta">${A.ui.sampleTag()}</span></p><ol class="knock-streets">${rows}</ol>`;
  }
  /** the door marker in miniature: a ring with the dotted 1-inch halo (same drawing as the map) */
  const haloSvg = (cls, h) => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"${h ? ' data-h="' + h + '"' : ''}><circle class="knock-halo__ring" cx="12" cy="12" r="5.6"/><circle class="knock-halo__dots" cx="12" cy="12" r="10.2"/></svg>`;
  function keyHTML() {
    const at = (v) => ((clamp(v, HS[0], HS[3]) - HS[0]) / (HS[3] - HS[0])) * 100;
    const pkH = (A.data.pick || {}).hail_in;
    return `<p class="knock-legend__t">${A.L('Map key', 'Guía del mapa')}</p>
      <ul class="knock-legend__list">
        <li><svg class="knock-legend__g" viewBox="0 0 24 24" aria-hidden="true"><circle class="knock-legend__trk" cx="12" cy="12" r="7.5"/><path class="knock-legend__arc" d="M12 4.5a7.5 7.5 0 1 1-7.13 9.82"/></svg><span>${A.L('Door: arc = score, color = hail', 'Puerta: arco = puntaje, color = granizo')}</span></li>
        <li>${haloSvg('knock-legend__g', A.ui.hailKey(pkH))}<span>${A.L('Dotted halo: inside the 1-inch line', 'Halo punteado: dentro de la línea de 1 pulgada')}</span></li>
        <li class="knock-legend__hail"><span class="knock-legend__lot" aria-hidden="true"></span><span>${A.L('Lot tint = modeled hail', 'Tono del lote = granizo modelado')} ${lineTag()}
          <span class="knock-legend__scale" aria-hidden="true"><i class="knock-legend__tick" style="left:${at(LINE).toFixed(1)}%"><b>${A.L('1 in', '1 pulg')}</b></i><i class="knock-legend__tick knock-legend__tick--2" style="left:${at(2).toFixed(1)}%"><b>${A.L('2 in', '2 pulg')}</b></i></span></span></li>
        <li><svg class="knock-legend__g" viewBox="0 0 24 24" aria-hidden="true"><path class="knock-legend__done" d="M1 12h10"/><path class="knock-legend__ahead" d="M14 12h9"/></svg><span>${A.L('Route: walked, still ahead', 'Ruta: caminada, lo que falta')}</span></li>
      </ul>`;
  }
  function footHTML() {
    const keysTip = CK.keys || { en: 'Keys N, T, I, X and B log the door. U undoes the last one.', es: 'Las teclas N, T, I, X y B anotan la puerta. U deshace la última.' };
    return `
      <div class="knock-foot__head"><span class="t-micro knock-foot__q">${T(CK.outcomesTitle || { en: 'How did the door go?', es: '¿Cómo salió la puerta?' })}</span>
        <span class="t-micro knock-foot__keys" tabindex="0" data-tip="${A.esc(keysTip.en)}" data-tip-es="${A.esc(keysTip.es)}">${A.L('Keys', 'Teclas')} ${OUT.map((o) => '<kbd class="kbd">' + o.key + '</kbd>').join('')} · <kbd class="kbd">U</kbd> ${A.L('undo', 'deshacer')}</span></div>
      <div class="knock-outs" role="group" data-label-en="Log this door" data-label-es="Anota esta puerta">
        ${OUT.map((o) => `<button type="button" class="knock-out" data-out="${o.id}" style="--oc:var(${o.tok})" aria-pressed="false" aria-keyshortcuts="${o.key}" data-tip="${A.esc(o.hint.en)}" data-tip-es="${A.esc(o.hint.es)}"><span class="knock-out__dot" aria-hidden="true"></span><span class="knock-out__l">${A.L(A.esc(o.label.en), A.esc(o.label.es))}</span><kbd class="kbd">${o.key}</kbd></button>`).join('')}
      </div>
      <div class="knock-foot__row">
        <button type="button" class="btn btn--ghost btn--sm" data-act="undo" aria-keyshortcuts="U"><i data-icon="arrow" class="i--sm knock-flip"></i>${T((((window.COPY || {}).ui || {}).common || {}).undo || { en: 'Undo', es: 'Deshacer' })}</button>
        <span class="knock-foot__last t-small" data-k="last"></span>
        <button type="button" class="btn btn--ghost btn--sm" data-act="reset">${A.L('Reset walk', 'Reiniciar ruta')}</button>
      </div>
      <p class="sr" role="status" aria-live="polite"></p>`;
  }
  function tally(k, label, cls) {
    return `<div class="knock-tally__r${cls ? ' is-' + cls : ''}"><dt>${label}</dt><dd class="num" data-c="${k}">0</dd></div>`;
  }
  function ringSegs(g) {
    const n = g.doors.length, R = 38, gap = 2.2, out = [];
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * 360 + gap / 2 - 90, a1 = ((i + 1) / n) * 360 - gap / 2 - 90;
      const p = (a) => [44 + R * Math.cos((a * Math.PI) / 180), 44 + R * Math.sin((a * Math.PI) / 180)];
      const s = p(a0), e = p(a1);
      out.push(`<path class="knock-ring__seg" data-rank="${g.doors[i].rank}" d="M${s[0].toFixed(2)} ${s[1].toFixed(2)}A${R} ${R} 0 0 1 ${e[0].toFixed(2)} ${e[1].toFixed(2)}"/>`);
    }
    return out.join('');
  }

  const lastC = {};
  function rollCounters(fromZero) {
    const c = counts(); if (!els.plan) return;
    els.plan.querySelectorAll('[data-c]').forEach((el) => {
      const k = el.dataset.c, v = c[k] || 0, from = fromZero === 0 ? 0 : lastC[k] == null ? v : lastC[k];
      if (from !== v || fromZero === 0) A.motion.countUp(el, v, { from, ms: 900 }); else el.textContent = A.fmt.int(v);
      lastC[k] = v;
    });
    const dn = els.plan.querySelector('[data-k="done"]');
    if (dn) { const f = fromZero === 0 ? 0 : lastC.__done == null ? c.done : lastC.__done; if (f !== c.done || fromZero === 0) A.motion.countUp(dn, c.done, { from: f, ms: 900 }); else dn.textContent = c.done; lastC.__done = c.done; }
  }

  /** refresh every live part of the panels; newDoor = the current door changed (the card lands again) */
  function renderAll(newDoor, roll, first) {
    if (!els.card || !S) return;
    const g = geo(), cur = curRank(), c = counts();
    const state = (r) => (S.o[r] ? ' is-' + S.o[r] : S.flags[r] ? ' is-skip' : '');
    els.plan.querySelectorAll('.knock-ring__seg').forEach((p) => { const r = +p.dataset.rank; p.setAttribute('class', 'knock-ring__seg' + state(r) + (r === cur ? ' is-cur' : '')); });
    els.order.querySelectorAll('.knock-dot').forEach((b) => {
      const r = +b.dataset.rank, o = S.o[r], sk = !o && S.flags[r];
      b.className = 'knock-dot' + (o ? ' is-done' : '') + (sk ? ' is-skip' : '') + (r === cur ? ' is-cur' : '');
      b.style.setProperty('--oc', o ? 'var(' + OUTBY[o].tok + ')' : '');
      b.setAttribute('aria-current', r === cur ? 'true' : 'false');
    });
    g.walkSt.forEach((w) => {
      const n = w.doors.filter((d) => settled(d.rank)).length, el = els.order.querySelector('[data-st-n="' + w.i + '"]');
      if (el) el.textContent = n + '/' + w.doors.length;
      const li = els.order.querySelector('[data-st="' + w.i + '"]'); if (li) { li.classList.toggle('is-here', w.doors.some((d) => d.rank === cur)); li.classList.toggle('is-done', n === w.doors.length); }
    });
    const ln = els.plan.querySelector('[data-line]'); if (ln) { const h = lineSummary(g); if (ln.dataset.v !== String(g.ver)) { ln.innerHTML = h; ln.dataset.v = String(g.ver); } ln.hidden = !h; }
    // outcome buttons: which one this door has
    els.foot.querySelectorAll('[data-out]').forEach((b) => b.setAttribute('aria-pressed', String(S.o[cur] === b.dataset.out)));
    const last = S.hist[S.hist.length - 1], lastEl = els.foot.querySelector('[data-k="last"]');
    if (lastEl) {
      const ld = last && doorBy(last.r), lo = last && S.o[last.r], lf = last && !lo && S.flags[last.r];
      const nx = doorBy(nextOpen(cur));
      // the card shows the next door on tall screens; on short ones this line does, until something is logged
      lastEl.innerHTML = ld && (lo || lf) ? (lo ? A.L('Last: ' + A.esc(OUTBY[lo].short.en), 'Última: ' + A.esc(OUTBY[lo].short.es)) : A.L('Last: do not knock', 'Última: no tocar')) + ' · <span class="t-mono">' + A.esc(ld.h.addr) + '</span>'
        : nx && nx.rank !== cur ? '<span class="knock-foot__next">' + T(CK.next || { en: 'Next: {address}', es: 'Sigue: {address}' }, { address: '<span class="t-mono">' + A.esc(nx.h.addr) + '</span>' }) + '</span>' : '';
    }
    const undoB = els.foot.querySelector('[data-act="undo"]'); if (undoB) undoB.disabled = !S.hist.length;
    if (roll) rollCounters();
    else if (first) {
      els.plan.querySelectorAll('[data-c]').forEach((el) => { el.textContent = A.fmt.int(c[el.dataset.c] || 0); lastC[el.dataset.c] = c[el.dataset.c] || 0; });
      const dn = els.plan.querySelector('[data-k="done"]'); if (dn) dn.textContent = c.done; lastC.__done = c.done;
    }
    renderCard(newDoor || first);
    renderRecap(c, g);
  }

  function renderCard(land) {
    const g = geo(), d = doorBy(curRank()), card = els.card; if (!d || !card) return;
    const h = d.h, U = A.ui, cc = CK.card || {}, o = S.o[d.rank], fl = S.flags[d.rank], skip = fl && !o;
    const follow = S.follow === d.rank && o === 'inspection_set';
    const hk = U.hailKey(h.hail), pr = CK.progress || { en: 'Door {i} of {n}', es: 'Puerta {i} de {n}' };
    const legal = CK.legal || {}, st = g.walkSt[d.wi];
    const slotHTML = o === 'inspection_set' ? `
      <div class="knock-follow${follow ? ' is-open' : ''}">
        <p class="knock-follow__t"><i data-icon="clock" class="i--sm"></i>${A.L('Inspection time', 'Hora de la inspección')} <span class="t-micro">${A.both(() => A.fmt.date(slots()[0].day, 'day'))}</span></p>
        <div class="knock-slots">${slots().map((s, i) => `<button type="button" class="knock-slot" data-slot="${i}" aria-pressed="${S.slot[d.rank] === i}">${A.both(() => A.fmt.time(s.time))}</button>`).join('')}</div>
        <div class="knock-follow__row">
          <button type="button" class="btn btn--primary btn--sm" data-act="deal"><i data-icon="doc" class="i--sm"></i>${A.L('Open in Deal', 'Abrir en Trato')}</button>
          ${follow ? `<button type="button" class="btn btn--ghost btn--sm" data-act="next">${A.L('Next door', 'Siguiente puerta')}<i data-icon="chevron" class="i--sm"></i></button>` : ''}
        </div>
      </div>` : '';
    const status = o ? `<span class="chip knock-card__o" style="--oc:var(${OUTBY[o].tok})"><span class="chip__dot"></span>${A.L(A.esc(OUTBY[o].label.en), A.esc(OUTBY[o].label.es))}</span>`
      : skip ? `<span class="chip knock-card__o knock-card__o--skip"><i data-icon="x" class="i--sm"></i>${A.L('Do not knock', 'No tocar')}</span>`
        : `<span class="t-micro knock-card__next">${A.L('At the door', 'En la puerta')}</span>`;
    const dayOf = () => { const e = dnkList()[h.addr]; return (e && e.day) || A.story.today; };
    card.innerHTML = `
      <div class="knock-card__bar"><span class="t-micro knock-card__n">${T(pr, { i: String(d.idx), n: String(g.doors.length) })}${st ? ' · ' + A.esc(st.s.n) : ''}</span>${status}</div>
      ${follow ? slotHTML : ''}
      <div class="knock-card__hero">
        <div class="knock-card__pic"><canvas class="knock-portrait" aria-hidden="true"></canvas></div>
        <div class="knock-card__id">
          <h2 class="t-head knock-card__addr">${A.esc(h.addr)}</h2>
          <span class="knock-card__tags">${U.sampleTag()}
            <span class="knock-card__score" tabindex="0" data-tip="${A.esc(U.sources.engine.en)}" data-tip-es="${A.esc(U.sources.engine.es)}"><span class="knock-score"><svg viewBox="0 0 44 44" aria-hidden="true"><circle class="knock-score__trk" cx="22" cy="22" r="18"/><circle class="knock-score__arc" cx="22" cy="22" r="18" pathLength="100" style="stroke-dasharray:${h.score} 100"/></svg><b class="num">${h.score}</b></span><span class="t-micro">${A.L('Door score', 'Puntaje')}</span> ${U.srcTag('engine')}</span></span>
          <div class="knock-card__hail">
            <span class="knock-f__k">${T(cc.hail || { en: 'Hail at this door', es: 'Granizo en esta puerta' })} ${U.srcTag('mrms')}</span>
            <span class="knock-card__hv"><b class="num" data-h="${hk}">${A.fmt.num(h.hail, 2)}</b><span>${A.L('in', 'pulg')}</span></span>
            <span class="knock-f__s">${A.L('Radar estimate.', 'Estimado del radar.')} ${T(cc.hailNote || { en: 'Not confirmed at this address.', es: 'No confirmado en esta dirección.' })}</span>
          </div>
        </div>
      </div>
      ${d.fh == null ? '' : `<div class="knock-line${d.in1 ? ' is-in' : ''}" data-h="${U.hailKey(d.fh)}">
        ${haloSvg('knock-line__g')}
        <span class="knock-line__t"><b>${d.in1 ? A.L('Inside the 1-inch hail line', 'Dentro de la línea de granizo de 1 pulgada') : A.L('Outside the 1-inch hail line', 'Fuera de la línea de granizo de 1 pulgada')}</b> ${lineTag()}
          <span class="knock-line__s">${A.L('Roof damage usually starts to show at about 1 inch.', 'El daño al techo suele empezar a notarse con granizo de 1 pulgada.')}</span></span>
      </div>`}
      ${fl ? `<div class="knock-dnk"><i data-icon="x" class="i--sm"></i><p><b>${A.L('Do not knock', 'No tocar')}</b> · ${T(FLAGBY[fl].label)}<span>${A.L('On your do-not-knock list since ' + A.esc(A.fmt.date(dayOf(), 'short', 'en')) + '. Every walk skips this door.', 'En tu lista de no tocar desde el ' + A.esc(A.fmt.date(dayOf(), 'short', 'es')) + '. Cada ruta se salta esta puerta.')}</span></p></div>` : ''}
      ${skip && fl === 'noSoliciting' ? '' : `<label class="knock-legal${S.legal[d.rank] ? ' is-on' : ''}">
        <input type="checkbox" data-legal ${S.legal[d.rank] ? 'checked' : ''}>
        <span class="knock-legal__box" aria-hidden="true">${U.icon('check', { size: 14 })}</span>
        <span class="knock-legal__t">${T(legal.check || { en: 'Said first: my name, HMP Siding & Roofing and what we sell (69-1602)', es: 'Dicho primero: mi nombre, HMP Siding & Roofing y lo que vendemos (69-1602)' })} ${U.srcTag('law')}</span>
      </label>`}
      <div class="knock-facts2">
        <div class="knock-f"><span class="knock-f__k">${A.L('Built', 'Construida')}</span><span class="knock-f__v"><b class="num">${h.built}</b></span></div>
        <div class="knock-f"><span class="knock-f__k">${T(cc.roofAge || { en: 'Roof age', es: 'Edad del techo' })}</span><span class="knock-f__v"><b class="num">${h.roof}</b> ${h.roof === 1 ? A.L('yr', 'año') : A.L('yrs', 'años')}</span></div>
        <div class="knock-f"><span class="knock-f__k">${A.L('Owner lives here', 'Vive el dueño')}</span><span class="knock-f__v"><b>${h.own ? T(cc.ownerYes || { en: 'Yes', es: 'Sí' }) : T(cc.ownerNo || { en: 'No', es: 'No' })}</b></span></div>
        <div class="knock-f knock-f--tag">${U.sampleTag()}</div>
      </div>
      ${nextRow(g, d)}
      <div class="knock-flags">
        ${FLAGS.map((f) => `<button type="button" class="chip knock-flag" data-flag="${f.id}" aria-pressed="${fl === f.id}" data-tip="${A.esc(fl === f.id ? 'On your do-not-knock list. Tap to take it off.' : 'Puts this address on your do-not-knock list. Every walk skips it.')}" data-tip-es="${A.esc(fl === f.id ? 'Está en tu lista de no tocar. Toca para quitarla.' : 'Pone esta dirección en tu lista de no tocar. Cada ruta se la salta.')}"><i data-icon="${f.icon}" class="i--sm"></i>${T(f.label)}</button>`).join('')}
      </div>
      ${follow ? '' : slotHTML}`;
    A.ui.icons(card); A.ui.localize(card);
    drawPortrait(false, land);
    if (land && !A.still) A.motion.stagger(card.children, { each: 30, y: 8, ms: 460 });
    if (follow) {
      const fe = card.querySelector('.knock-follow');
      if (fe) {
        A.safe('knock scroll', () => { const sl = card.closest('.slot'); if (sl && !A.stacked()) sl.scrollTo({ top: Math.max(0, card.offsetTop - 8), behavior: A.still ? 'auto' : 'smooth' }); });
        if (!A.still) A.motion.reveal(fe, { y: 10, ring: true, size: 80 });
      }
    }
  }

  /** the next open door: which one, which side, how far on foot (along the route, sidewalk to door) */
  function nextRow(g, d) {
    const nx = doorBy(nextOpen(d.rank)); if (!nx || nx === d) return '';
    const spur = (x) => Math.hypot(x.D[0] - x.foot[0], x.D[1] - x.foot[1]);
    const ft = Math.max(10, Math.round((spur(d) + Math.abs(nx.arc - d.arc) + spur(nx)) / 10) * 10), st = g.walkSt[nx.wi];
    const how = nx.wi !== d.wi ? A.L('around the corner on ' + A.esc(st ? st.s.n : nx.h.st), 'a la vuelta, en ' + A.esc(st ? st.s.n : nx.h.st))
      : nx.side !== d.side ? A.L('across the street', 'cruzando la calle') : A.L('same side', 'del mismo lado');
    const tip = { en: 'Walking distance along the route: Nebraska GIS street lines to the sample home spots', es: 'Distancia a pie por la ruta: calles de Nebraska GIS hasta los puntos de las casas de muestra' };
    return `<div class="knock-next"><span class="t-micro knock-next__k">${A.L('Next', 'Sigue')}</span><span class="knock-next__n">${nx.idx}</span><span class="knock-next__t"><b>${A.esc(nx.h.addr)}</b> <span>${how} · ${A.L('~' + A.fmt.int(ft, 'en') + ' ft', '~' + A.fmt.int(ft, 'es') + ' pies')}</span> ${A.ui.srcTag({ label: 'NE GIS', tip })}</span>
      <button type="button" class="btn btn--ghost btn--icon btn--sm knock-next__go" data-goto="${nx.rank}" data-label-en="${A.esc('Go to door ' + nx.idx + ', ' + nx.h.addr)}" data-label-es="${A.esc('Ir a la puerta ' + nx.idx + ', ' + nx.h.addr)}"><i data-icon="chevron" class="i--sm"></i></button></div>`;
  }

  let portrait = null, portraitKey = '';
  function stopPortrait() { if (portrait) { A.safe('portrait stop', () => portrait.stop()); portrait = null; } }
  function drawPortrait(redraw, animate) {
    const d = doorBy(curRank()), cv = els.card && els.card.querySelector('.knock-portrait');
    if (!d || !cv || !window.House) return;
    if (!cv.getBoundingClientRect().width) { if (ctxNow) ctxNow.timer(() => drawPortrait(redraw, animate), 40); return; }
    const tk = (n) => A.tok(n);
    const th = { ink: tk('--text'), line: tk('--rule-2'), acc: tk('--acc'), h0: tk('--h0'), h1: tk('--h1'), h15: tk('--h15'), h2: tk('--h2'), bg: tk('--panel-2') };
    const lb = House.labels(d.h, A.lang); delete lb.roof;
    const opts = { theme: th, labels: lb, sheet: false };
    stopPortrait();
    const key = d.rank + '|' + A.theme + '|' + A.lang;
    A.safe('house portrait', () => {
      if (animate && !A.still && key.split('|')[0] !== portraitKey.split('|')[0]) portrait = House.animate(cv, d.h, Object.assign({ ambient: false, speed: 2.3 }, opts));
      else House.draw(cv, d.h, opts);
    });
    portraitKey = key;
  }

  function renderRecap(c, g) {
    const ctx = ctxNow; if (!ctx) return;
    const done = c.done >= g.doors.length;
    if (!done) { if (els.recap) { const r = els.recap; els.recap = null; A.motion.exit([r], { ms: 140 }).then(() => { r.remove(); A.view.relayout(); }); } return; }
    const R = CK.recap || {}, U = A.ui, B = bench(), units = R.units || {};
    const conv = B.doors_to_conversation || { typical: 30, source: 'spotio.com, theroofstrategist.com' };
    const insp = B.doors_to_qualified_inspection_new_rep || { low: 0.5, typical: 1, high: 2, source: 'ilroofinginstitute.com, new rep, first 30 days' };
    const ans = c.knocked ? Math.round((c.answered / c.knocked) * 100) : 0;
    const ir = c.knocked ? (c.inspection_set / c.knocked) * 100 : 0;
    const ph = (o, n, fb) => Tx(one(o || fb, n), { n: String(n) });
    const summary = T(R.summary || { en: 'You knocked {n}, talked with {t} and set {i}.', es: 'Tocaste {n}, hablaste con {t} y agendaste {i}.' }, {
      n: ph(units.doors, c.knocked, { en: '{n} doors', es: '{n} puertas', one: { en: '1 door', es: '1 puerta' } }),
      t: ph(units.people, c.answered, { en: '{n} people', es: '{n} personas', one: { en: '1 person', es: '1 persona' } }),
      i: ph(units.inspections, c.inspection_set, { en: '{n} inspections', es: '{n} inspecciones', one: { en: '1 inspection', es: '1 inspección' } })
    });
    const rate = c.answered ? T(R.rate || { en: '{p}% of answered doors set an inspection ({i} of {a})', es: 'El {p}% de las puertas que abrieron agendó una inspección ({i} de {a})' }, { p: String(Math.round((c.inspection_set / c.answered) * 100)), i: String(c.inspection_set), a: String(c.answered) })
      : A.L('No one answered on this walk.', 'Nadie abrió en esta ruta.');
    const said = c.answered ? A.L('said first (69-1602) at ' + c.legal + ' of ' + c.answered + (c.answered === 1 ? ' answered door' : ' answered doors'), 'dicho primero (69-1602) en ' + c.legal + ' de ' + c.answered + (c.answered === 1 ? ' puerta que abrió' : ' puertas que abrieron')) + ' ' + U.srcTag('law') + ' · ' : '';
    const skipped = c.skipped ? A.L(c.skipped + ' skipped (do-not-knock list)', c.skipped + (c.skipped === 1 ? ' saltada' : ' saltadas') + ' (lista de no tocar)') + ' · ' : '';
    const convTag = U.srcTag({ label: 'bench', tip: { en: 'Industry benchmark: ' + conv.typical + '% of doors answer (' + conv.source + ')', es: 'Referencia de la industria: abre el ' + conv.typical + '% de las puertas (' + conv.source + ')' } });
    const inspTag = U.srcTag({ label: 'bench', tip: { en: 'Industry benchmark for a new rep: ' + insp.low + '-' + insp.high + '% of doors book a qualified inspection, typical ' + insp.typical + '% (' + insp.source + ')', es: 'Referencia de la industria para un vendedor nuevo: del ' + insp.low + ' al ' + insp.high + '% de las puertas agenda una inspección, típico ' + insp.typical + '% (' + insp.source + ')' } });
    const firstInsp = g.doors.find((d) => S.o[d.rank] === 'inspection_set');
    const html = `
      <div class="knock-recap">
        <p class="eyebrow eyebrow--acc knock-recap__eb"><span>${T(R.title || { en: 'Walk recap', es: 'Resumen de la ruta' })}</span> ${U.sampleTag()}</p>
        <div class="knock-recap__act">
          ${firstInsp ? `<button type="button" class="btn btn--primary btn--sm" data-act="deal" data-rank="${firstInsp.rank}"><i data-icon="doc" class="i--sm"></i>${A.L('Open ' + A.esc(firstInsp.h.addr) + ' in Deal', 'Abrir ' + A.esc(firstInsp.h.addr) + ' en Trato')}</button>` : ''}
          <button type="button" class="btn btn--secondary btn--sm" data-act="reset2">${A.L('New walk', 'Nueva ruta')}</button>
        </div>
        <p class="t-head knock-recap__sum">${summary}</p>
        <p class="t-small knock-recap__note">${rate} · ${said}${skipped}${T(R.sampleNote || { en: 'Sample homes, sample results.', es: 'Casas de muestra, resultados de muestra.' })}</p>
        <div class="stats knock-recap__stats">
          <div class="stat"><span class="stat__k">${A.L('Answered', 'Abrieron')} ${convTag}</span><span class="stat__v num">${ans}<span class="stat__u">%</span></span><span class="stat__s">${A.L('typical ' + conv.typical + '%', 'típico ' + conv.typical + '%')}</span></div>
          <div class="stat"><span class="stat__k">${A.L('Inspections', 'Inspecciones')} ${inspTag}</span><span class="stat__v num knock-ok">${c.inspection_set}</span><span class="stat__s">${A.L(A.fmt.num(ir, ir && ir < 10 ? 1 : 0, 'en') + '% of doors · new rep ' + insp.typical + '%', A.fmt.num(ir, ir && ir < 10 ? 1 : 0, 'es') + '% de puertas · nuevo ' + insp.typical + '%')}</span></div>
          <div class="stat"><span class="stat__k">${A.L('Come back', 'Regresar')}</span><span class="stat__v num knock-warn">${c.come_back}</span><span class="stat__s"></span></div>
          <div class="stat"><span class="stat__k">${A.L('Said no', 'Dijeron no')}</span><span class="stat__v num">${c.not_interested}</span><span class="stat__s"></span></div>
          <div class="stat"><span class="stat__k">${A.L('Do not knock', 'No tocar')}</span><span class="stat__v num">${c.dnk}</span><span class="stat__s">${A.L('on your list', 'en tu lista')}</span></div>
        </div>
      </div>`;
    if (!els.recap) {
      els.recap = ctx.el('bottom', html, 'pane pane--tight knock-recap-pane');
      els.recap.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.act === 'deal') openDeal(+b.dataset.rank); else if (b.dataset.act === 'reset2') reset(); });
      if (!A.still) { A.motion.reveal(els.recap, { y: -12, ms: 560 }); A.motion.stagger(els.recap.querySelectorAll('.stat'), { each: 50, delay: 160 }); }
      A.view.relayout();
    } else { els.recap.innerHTML = html; A.ui.icons(els.recap); }
  }

  /* ---------------- director hooks ---------------- */
  api = A.knockDemo = {
    tap(outcome, rank) { if (A.view.current !== 'knock') return false; tap(outcome, { rank }); return true; },
    flag(kind, rank) { if (A.view.current !== 'knock' || !FLAGBY[kind]) return false; toggleFlag(kind, rank); return true; },
    select(rank) { if (A.view.current !== 'knock') return false; select(rank, { fly: true }); return true; },
    undo() { if (A.view.current === 'knock') undo(); },
    reset(all) { if (A.view.current === 'knock') reset(all); else { A.store.del(KEY); if (all) A.store.del(DNK); } },
    state() {
      if (!S) load(); const g = geo();
      return { head: V.head, reveal: V.reveal, tl: V.tl ? V.tl.time : -1, cur: curRank(), counts: counts(), order: g ? g.doors.map((d) => d.rank) : [], outcomes: Object.assign({}, S.o), flags: Object.assign({}, S.flags), dnk: dnkList(), doneArc: V.done.to, inLine: g ? g.in1 : 0, edge: g && g.edge,
        doors: g ? g.doors.map((d) => ({ rank: d.rank, idx: d.idx, st: d.h.st, lon: d.h.p[0], lat: d.h.p[1], arc: Math.round(d.arc), fh: d.fh, in1: d.in1 })) : [] };
    },
    outcomes: OUT.map((o) => o.id), flags: FLAGS.map((f) => f.id)
  };
})();
