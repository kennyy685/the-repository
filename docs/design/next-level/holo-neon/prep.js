// Blueprint Holo - data prep (pure JS, no three.js). Turns window.NL into table-space geometry specs.
// World space: x = east (m), z = south (m), y = up. Origin = centre of the walk (the holo-table disc centre).

export function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const ABBR = { East: 'E', West: 'W', North: 'N', South: 'S', Street: 'St', Avenue: 'Ave', Road: 'Rd', Boulevard: 'Blvd', Drive: 'Dr', Court: 'Ct', Place: 'Pl', Lane: 'Ln', Highway: 'Hwy', Circle: 'Cir', Parkway: 'Pkwy', Terrace: 'Ter', Trail: 'Trl' };
const cap = w => /^\d/.test(w) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
export function prettyStreet(n) { return String(n || '').trim().split(/\s+/).map(w => ABBR[cap(w)] || cap(w)).join(' '); }

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = v => Math.hypot(v[0], v[1]);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function segProj(p, a, b) { // -> [distance, t, point]
  const dx = b[0] - a[0], dz = b[1] - a[1]; const L2 = dx * dx + dz * dz || 1e-9;
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2; t = Math.max(0, Math.min(1, t));
  const q = [a[0] + t * dx, a[1] + t * dz]; return [dist(p, q), t, q];
}
function clipCircle(a, b, R) { // keep the part of segment a-b inside |p|<R; null if none
  const ia = len(a) <= R, ib = len(b) <= R; if (ia && ib) return [a, b];
  const d = sub(b, a); const A = d[0] * d[0] + d[1] * d[1]; const B = 2 * (a[0] * d[0] + a[1] * d[1]); const C = a[0] * a[0] + a[1] * a[1] - R * R;
  const disc = B * B - 4 * A * C; if (disc <= 0 || A < 1e-9) return null;
  const s = Math.sqrt(disc); let t0 = (-B - s) / (2 * A), t1 = (-B + s) / (2 * A);
  t0 = Math.max(0, t0); t1 = Math.min(1, t1); if (t1 <= t0) return null;
  return [[a[0] + d[0] * t0, a[1] + d[1] * t0], [a[0] + d[0] * t1, a[1] + d[1] * t1]];
}

export function prep(NL, opts = {}) {
  const C = NL.pick.center;
  const KX = 111320 * Math.cos(C.lat * Math.PI / 180), KY = 110540;
  const raw = (lon, lat) => [(lon - C.lon) * KX, -(lat - C.lat) * KY];
  const homesSorted = NL.homes.slice().sort((a, b) => a.rank - b.rank);

  // ---- disc centre = centre of homes + park
  const pts0 = homesSorted.map(h => raw(h.p[0], h.p[1])).concat([raw(NL.walk.park[0], NL.walk.park[1])]);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  pts0.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); });
  const O = [(x0 + x1) / 2, (z0 + z1) / 2];
  const toW = (lon, lat) => { const p = raw(lon, lat); return [p[0] - O[0], p[1] - O[1]]; };
  const R = opts.R || 265;
  const lonlatOf = (x, z) => [C.lon + (x + O[0]) / KX, C.lat - (z + O[1]) / KY];

  // ---- streets near the table
  const streets = [];
  for (const s of NL.streets) {
    const p = s.p.map(q => toW(q[0], q[1]));
    if (!p.some(q => len(q) < R + 420)) continue;
    streets.push({ n: prettyStreet(s.n), c: s.c, p });
  }

  // ---- street graph (block pieces are noded at intersections)
  const nodes = [], adj = [], nodeKey = new Map(); const segs = [];
  const nodeOf = p => { const k = Math.round(p[0] / 2) + ',' + Math.round(p[1] / 2); if (!nodeKey.has(k)) { nodeKey.set(k, nodes.length); nodes.push(p); adj.push([]); } return nodeKey.get(k); };
  streets.forEach((s, si) => {
    for (let i = 0; i + 1 < s.p.length; i++) {
      const a = nodeOf(s.p[i]), b = nodeOf(s.p[i + 1]); if (a === b) continue;
      const L = dist(nodes[a], nodes[b]); adj[a].push([b, L]); adj[b].push([a, L]);
      segs.push({ a, b, n: s.n, si });
    }
  });
  function snap(p, name) {
    let best = null;
    for (const pass of [true, false]) {
      for (const sg of segs) {
        if (pass && sg.n !== name) continue;
        const [d, t, q] = segProj(p, nodes[sg.a], nodes[sg.b]);
        if (!best || d < best.d) best = { d, t, q, a: sg.a, b: sg.b, n: sg.n };
      }
      if (best) break;
    }
    return best;
  }
  function dijkstra(srcs) { // srcs: [[node, d0]]
    const N = nodes.length; const D = new Float64Array(N).fill(Infinity); const prev = new Int32Array(N).fill(-1); const done = new Uint8Array(N);
    srcs.forEach(([n, d]) => { if (d < D[n]) { D[n] = d; prev[n] = -1; } });
    for (;;) {
      let u = -1, bd = Infinity; for (let i = 0; i < N; i++) if (!done[i] && D[i] < bd) { bd = D[i]; u = i; }
      if (u < 0) break; done[u] = 1;
      for (const [v, L] of adj[u]) if (D[u] + L < D[v]) { D[v] = D[u] + L; prev[v] = u; }
    }
    return { D, prev };
  }
  function pathBetween(A, B) { // A,B snaps -> points from A.q to B.q along streets
    if ((A.a === B.a && A.b === B.b) || (A.a === B.b && A.b === B.a)) return [A.q, B.q];
    const { D, prev } = dijkstra([[A.a, dist(A.q, nodes[A.a])], [A.b, dist(A.q, nodes[A.b])]]);
    const ea = D[B.a] + dist(nodes[B.a], B.q), eb = D[B.b] + dist(nodes[B.b], B.q);
    let n = ea <= eb ? B.a : B.b; const chain = [];
    while (n >= 0) { chain.push(n); n = prev[n]; }
    chain.reverse();
    return [A.q].concat(chain.map(i => nodes[i]), [B.q]);
  }

  // ---- sample homes -> hologram house specs
  const houses = homesSorted.map((h, i) => {
    const c = toW(h.p[0], h.p[1]);
    const sn = snap(c, h.st);
    let f = sub(sn.q, c); const fl = len(f) || 1; f = [f[0] / fl, f[1] / fl];
    return { i, h, c, snap: sn, f, yaw: Math.atan2(f[0], f[1]), setback: fl };
  });
  houses.forEach(H => { // nearest neighbour spacing caps the footprint
    let dn = Infinity; houses.forEach(o => { if (o !== H) dn = Math.min(dn, dist(o.c, H.c)); }); H.dn = dn;
  });
  houses.forEach(H => { H.spec = houseSpec(H); });
  houses.forEach(H => { const d = H.spec.d / 2; H.door = [H.c[0] + H.f[0] * (d + 0.6), H.c[1] + H.f[1] * (d + 0.6)]; });

  // ---- the walk: park -> door 1 -> door 2 ... (rank order), routed on real streets
  const park = toW(NL.walk.park[0], NL.walk.park[1]);
  const parkSnap = snap(park, prettyStreet(NL.walk.pn && NL.walk.pn[0]) || 'E 12th St');
  const route = [park];
  const push = p => { const l = route[route.length - 1]; if (dist(l, p) > 0.05) route.push(p); };
  let cur = parkSnap; const doorIdx = [];
  push(parkSnap.q);
  houses.forEach(H => {
    const seq = pathBetween(cur, H.snap); seq.forEach(push);
    push(H.door); doorIdx.push(route.length - 1); push(H.snap.q); cur = H.snap;
  });
  const routeD = [0]; for (let i = 1; i < route.length; i++) routeD.push(routeD[i - 1] + dist(route[i - 1], route[i]));
  const doorD = doorIdx.map(i => routeD[i]);
  const routeLen = routeD[routeD.length - 1];
  const lastDoorD = doorD[doorD.length - 1];
  function pointAt(d) {
    d = Math.max(0, Math.min(routeLen, d));
    let lo = 0, hi = routeD.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (routeD[m] <= d) lo = m; else hi = m; }
    const L = routeD[hi] - routeD[lo] || 1; const t = (d - routeD[lo]) / L; const a = route[lo], b = route[hi];
    return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], dir: Math.atan2(b[0] - a[0], b[1] - a[1]) };
  }

  // ---- streets clipped to the disc for drawing
  const walkNames = new Set(NL.walk.s.map(s => s.n));
  const drawStreets = [];
  streets.forEach(s => {
    const pieces = []; let curP = null;
    for (let i = 0; i + 1 < s.p.length; i++) {
      const cl = clipCircle(s.p[i], s.p[i + 1], R + 4);
      if (!cl) { if (curP) { pieces.push(curP); curP = null; } continue; }
      if (curP && dist(curP[curP.length - 1], cl[0]) < 0.5) curP.push(cl[1]); else { if (curP) pieces.push(curP); curP = [cl[0], cl[1]]; }
    }
    if (curP) pieces.push(curP);
    pieces.forEach(p => drawStreets.push({ n: s.n, c: s.c, walk: walkNames.has(s.n), p }));
  });

  // street labels: one per name, on its piece nearest the table centre (walk streets: nearest the walk)
  const labelSpots = new Map();
  drawStreets.forEach(s => {
    for (let i = 0; i + 1 < s.p.length; i++) {
      const a = s.p[i], b = s.p[i + 1]; const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; const L = dist(a, b);
      if (L < 40) continue;
      const score = len(m) + (s.walk ? -400 : 0);
      const cur2 = labelSpots.get(s.n);
      if (!cur2 || score < cur2.score) labelSpots.set(s.n, { n: s.n, walk: s.walk, p: m, a, b, score });
    }
  });
  // nudge walk-street labels off the houses: put them between two doors near the middle of their piece
  const streetLabels = [...labelSpots.values()].filter(l => len(l.p) < R - 30);

  // ---- context blocks (dim, not data): neighbours along every street on the table
  const R2 = rng(hashStr('ctx-' + NL.pick.name));
  const allSegs = []; drawStreets.forEach(s => { for (let i = 0; i + 1 < s.p.length; i++) allSegs.push([s.p[i], s.p[i + 1]]); });
  const ctx = [];
  drawStreets.forEach(s => {
    for (let i = 0; i + 1 < s.p.length; i++) {
      const a = s.p[i], b = s.p[i + 1]; const L = dist(a, b); if (L < 24) continue;
      const d = [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; const n = [-d[1], d[0]];
      for (let t = 13; t < L - 13; t += 18.5 + R2() * 3) {
        for (const side of [-1, 1]) {
          const off = 17.5 + R2() * 2.5;
          const c = [a[0] + d[0] * t + n[0] * side * off, a[1] + d[1] * t + n[1] * side * off];
          if (len(c) > R - 16) continue;
          if (houses.some(H => dist(H.c, c) < 19)) continue;
          if (allSegs.some(sg => segProj(c, sg[0], sg[1])[0] < 12.5)) continue;
          if (ctx.some(o => dist(o.c, c) < 14)) continue;
          if (R2() < 0.12) continue; // a few empty lots
          const f = [-n[0] * side, -n[1] * side];
          const two = R2() < 0.3;
          ctx.push({ c, yaw: Math.atan2(f[0], f[1]), w: 9.5 + R2() * 3.5, d: 8 + R2() * 2.5, wall: two ? 5.4 : 3.1, rh: 1.6 + R2() * 1.6, cross: R2() < 0.25, r: len(c) });
        }
      }
    }
  });

  // ---- hail field (Gaussian kernel regression over the sample homes, calm and smooth)
  const hailVals = homesSorted.map(h => h.hail);
  const hailMin = Math.min(...hailVals), hailMax = Math.max(...hailVals);
  const FN = opts.fieldN || 128; const box = [-R - 40, -R - 40, 2 * (R + 40)];
  const field = new Float32Array(FN * FN * 4);
  const sig = 34, s2 = 2 * sig * sig;
  for (let j = 0; j < FN; j++) for (let i = 0; i < FN; i++) {
    const x = box[0] + (i + 0.5) / FN * box[2], z = box[1] + (j + 0.5) / FN * box[2];
    let sw = 0, sv = 0, dmin = Infinity;
    houses.forEach(H => { const dd = (H.c[0] - x) ** 2 + (H.c[1] - z) ** 2; const w = Math.exp(-dd / s2); sw += w; sv += w * H.h.hail; dmin = Math.min(dmin, Math.sqrt(dd)); });
    const v = sw > 1e-6 ? sv / sw : hailMin;
    const w = Math.min(1, Math.max(0, (95 - dmin) / 70)); const ww = w * w * (3 - 2 * w);
    const k = (j * FN + i) * 4; field[k] = v; field[k + 1] = ww; field[k + 2] = 0; field[k + 3] = 1;
  }
  // contour label spots: for each level, the field cell closest to the walk that sits on the level with solid weight
  const levels = []; for (let L = Math.ceil(hailMin * 20) / 20; L <= hailMax + 1e-6; L += 0.05) levels.push(+L.toFixed(2));
  const contourLabels = [];
  levels.forEach(L => {
    let best = null;
    for (let j = 1; j < FN - 1; j++) for (let i = 1; i < FN - 1; i++) {
      const k = (j * FN + i) * 4; if (field[k + 1] < 0.9) continue;
      const v = field[k], vr = field[k + 4], vd = field[k + FN * 4];
      if ((v - L) * (vr - L) > 0 && (v - L) * (vd - L) > 0) continue;
      const x = box[0] + (i + 0.5) / FN * box[2], z = box[1] + (j + 0.5) / FN * box[2];
      if (houses.some(H => dist(H.c, [x, z]) < 16) || dist(park, [x, z]) < 40) continue;
      if (allSegs.some(sg => segProj([x, z], sg[0], sg[1])[0] < 9)) continue;
      const sc = Math.abs(z - 0) * 0.4 + Math.abs(x) * 0.2 + (contourLabels.some(o => dist(o.p, [x, z]) < 60) ? 999 : 0);
      if (!best || sc < best.sc) best = { L, p: [x, z], sc };
    }
    if (best) contourLabels.push(best);
  });

  // ---- storm track (NOAA SPC / MRMS swath centreline of the pick's storm day), clipped to the rim
  const storm = NL.storms.find(s => s.date === NL.pick.storm_day) || null;
  let stormTrack = null;
  if (storm && storm.path && storm.path.length > 1) {
    const sp = storm.path.map(q => toW(q[0], q[1])); const parts = [];
    for (let i = 0; i + 1 < sp.length; i++) { const cl = clipCircle(sp[i], sp[i + 1], R + 30); if (cl) parts.push(cl); }
    stormTrack = { parts, storm };
  }

  const walkStats = NL.walk.s.map(s => ({ n: s.n, h: s.h, m: s.m }));
  return { O, R, toW, lonlatOf, KX, KY, streets, drawStreets, streetLabels, houses, ctx, park, parkSnap, route, routeD, routeLen, lastDoorD, doorD, pointAt,
    field, fieldN: FN, fieldBox: box, hailMin, hailMax, levels, contourLabels, stormTrack, walkStats };
}

// Procedural house spec, seeded by address; the shape follows the era it was built in.
function houseSpec(H) {
  const r = rng(hashStr(H.h.addr + '|' + H.h.built));
  const y = H.h.built; const S = 1.18;
  let s;
  if (y < 1935) { // 2-storey foursquare / farmhouse with full porch
    s = { type: 'four', w: 9 + r() * 2, d: 10 + r() * 2, wall: 6.1, roof: r() < 0.55 ? 'hip' : 'gable', rh: 3.2 + r() * 0.8, porch: true, chimney: r() < 0.8, garage: 0 };
  } else if (y < 1960) { // 1.5-storey cottage, steep side gable
    s = { type: 'cottage', w: 9.5 + r() * 2.5, d: 8 + r() * 1.5, wall: 3.3, roof: 'gable', rh: 3.4 + r() * 0.8, porch: r() < 0.5, chimney: r() < 0.7, garage: r() < 0.35 ? 1 : 0, dormer: r() < 0.5 };
  } else if (y < 1990) { // ranch, long and low with attached garage
    s = { type: 'ranch', w: 13.5 + r() * 3.5, d: 8.5 + r() * 1.5, wall: 3.0, roof: r() < 0.6 ? 'gable' : 'hip', rh: 1.9 + r() * 0.6, porch: r() < 0.3, chimney: r() < 0.5, garage: 1 };
  } else { // modern 2-storey with front garage
    s = { type: 'modern', w: 11 + r() * 2, d: 9.5 + r() * 1.5, wall: 5.8, roof: r() < 0.6 ? 'hip' : 'gable', rh: 2.4 + r() * 0.6, porch: r() < 0.5, chimney: r() < 0.3, garage: 2 };
  }
  s.gside = r() < 0.5 ? -1 : 1; s.win = r();
  s.w *= S; s.d *= S; s.wall *= S; s.rh *= S;
  // keep neighbours apart (two sample homes can sit 17 m apart on a corner)
  const lim = Math.max(8, H.dn * 0.92);
  const tot = s.w + (s.garage === 1 ? 6.6 * S : 0);
  if (tot > lim) { const k = lim / tot; s.w *= k; s.d *= Math.max(0.8, k); }
  s.top = s.wall + s.rh + (s.chimney ? 0.9 : 0);
  return s;
}
