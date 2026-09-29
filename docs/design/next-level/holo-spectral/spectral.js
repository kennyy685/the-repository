// Aldaba "Spectral" hologram walk. Mockup. Data: window.NL (../shared/data.js). Homes are FAKE samples.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const NL = window.NL;
const Q = new URLSearchParams(location.search);
const STILL = Q.get('still') === '1';
const RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const CALM = STILL || RM;             // no intro, no flicker, no auto camera
const MOTION = STILL || RM ? 0 : 1;   // ambient shader motion
let lang = (Q.get('lang') || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
const HOUSE_Q = Math.max(0, Math.min(25, parseInt(Q.get('house'), 10) || 0));
const $ = id => document.getElementById(id);
if (STILL) document.body.classList.add('still');
if (RM) document.body.classList.add('rm');

/* ---------------- seeded randomness (no Math.random anywhere) ---------------- */
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------------- i18n ---------------- */
const S = {
  zones: { en: 'Zones', es: 'Zonas' }, overview: { en: 'Overview', es: 'Vista general' },
  eyebrow: { en: "Aldaba's pick · #1 of {z} zones", es: 'La elección de Aldaba · #1 de {z} zonas' },
  town: { en: 'Columbus, Nebraska', es: 'Columbus, Nebraska' },
  stormDay: { en: 'Storm day', es: 'Día de la tormenta' }, hailHere: { en: 'Hail here', es: 'Granizo aquí' },
  doors: { en: 'Doors', es: 'Puertas' }, best: { en: 'Best time', es: 'Mejor hora' },
  daysAgo: { en: '{d} days ago', es: 'hace {d} días' }, radar: { en: 'radar estimate', es: 'estimado de radar' },
  walkLen: { en: '{km} km on foot', es: '{km} km a pie' }, today: { en: 'today', es: 'hoy' },
  start: { en: 'Start walk', es: 'Empezar la ruta' }, doorsN: { en: '{n} doors', es: '{n} puertas' },
  park: { en: 'Park at {a} & {b}', es: 'Estaciónate en {a} y {b}' }, toDoor1: { en: '{m} m to door 1', es: '{m} m a la puerta 1' },
  sample: { en: 'Sample homes', es: 'Casas de muestra' },
  sampleTip: { en: 'Fake homes on real streets, for testing. No owner names.', es: 'Casas ficticias en calles reales, para pruebas. Sin nombres de dueños.' },
  legendT: { en: 'Hail at each home', es: 'Granizo en cada casa' },
  legendS: { en: 'inches, radar estimate, Aug 8 · ground lines every 0.02″', es: 'pulgadas, estimado de radar, 8 de ago. · líneas cada 0.02″' },
  stripT: { en: 'Walk order', es: 'Orden de la ruta' }, stripS: { en: 'bar height = roof age · color = hail', es: 'altura = edad del techo · color = granizo' },
  progOver: { en: '{n} doors · {km} km', es: '{n} puertas · {km} km' },
  progTour: { en: 'Door {i} of {n}', es: 'Puerta {i} de {n}' },
  hint: { en: 'Drag to turn · scroll to zoom · click a house for its numbers', es: 'Arrastra para girar · desplaza para acercar · haz clic en una casa para ver sus datos' },
  src: { en: 'Hail: NOAA SPC + MRMS radar · Streets: Nebraska GIS · Route + scores: Aldaba engine', es: 'Granizo: NOAA SPC + radar MRMS · Calles: Nebraska GIS · Ruta y puntajes: motor Aldaba' },
  pause: { en: 'Pause', es: 'Pausar' }, resume: { en: 'Resume', es: 'Seguir' }, stop: { en: 'End walk', es: 'Terminar ruta' },
  door: { en: 'Door', es: 'Puerta' }, of: { en: 'of', es: 'de' },
  sampleHome: { en: 'Sample home', es: 'Casa de muestra' },
  hailSize: { en: 'Hail size', es: 'Granizo' }, roofAge: { en: 'Roof age', es: 'Edad del techo' },
  est: { en: 'est.', es: 'aprox.' }, yrs: { en: 'yrs', es: 'años' },
  hailRank1: { en: 'Biggest hail on this walk', es: 'El granizo más grande de la ruta' },
  hailRankN: { en: '#{k} biggest of {n} on this walk', es: '#{k} más grande de {n} en la ruta' },
  roofTop: { en: 'Among the 5 oldest here', es: 'De los 5 más viejos aquí' },
  roofBuilt: { en: 'House built {y}', es: 'Casa construida en {y}' },
  why: { en: 'Why this door', es: 'Por qué esta puerta' },
  built: { en: 'Built', es: 'Construida' }, owner: { en: 'Owner-lived', es: 'Vive el dueño' },
  yes: { en: 'Yes', es: 'Sí' }, no: { en: 'No', es: 'No' }, score: { en: 'Score', es: 'Puntaje' },
  fromPrev: { en: 'From #{k}', es: 'Desde #{k}' }, fromP: { en: 'From P', es: 'Desde P' },
  prev: { en: 'Door {k}', es: 'Puerta {k}' },
  keys: { en: 'Esc closes · ← → doors', es: 'Esc cierra · ← → puertas' },
  csrc: { en: 'hail: radar · roof: estimate', es: 'granizo: radar · techo: estimado' },
  walking: { en: 'Walking to door {i} · {m} m', es: 'Caminando a la puerta {i} · {m} m' },
  atDoor: { en: 'At door {i} of {n}', es: 'En la puerta {i} de {n}' },
  paused: { en: 'Paused at door {i}', es: 'En pausa en la puerta {i}' },
  close: { en: 'Close', es: 'Cerrar' },
  walkDone: { en: 'Walk complete · {n} doors', es: 'Ruta completa · {n} puertas' },
  scaleLo: { en: 'walk low', es: 'mín. ruta' }, scaleHi: { en: 'walk high', es: 'máx. ruta' },
  tagHail: { en: 'hail', es: 'granizo' }, tagRoof: { en: 'yr roof', es: 'años de techo' },
  hud: { en: '{n} doors', es: '{n} puertas' },
  nogl: { en: 'This view needs WebGL.', es: 'Esta vista necesita WebGL.' },
};
const t = (k, v) => { let s = (S[k] && S[k][lang]) || k; if (v) for (const x in v) s = s.split('{' + x + '}').join(v[x]); return s; };

/* ---------------- data prep ---------------- */
const C = NL.pick.center;
const KX = 111320 * Math.cos(C.lat * Math.PI / 180), KY = 110540;
const toW = (lon, lat) => [(lon - C.lon) * KX, -(lat - C.lat) * KY]; // x east, z south (meters)
const HOMES = NL.homes.slice().sort((a, b) => a.rank - b.rank);
const N = HOMES.length;
const HMIN = 1.44, HMAX = 1.70;
const hailT = h => Math.min(1, Math.max(0, (h - HMIN) / (HMAX - HMIN)));
const SPEC_HEX = ['#7a5cff', '#4f8bff', '#22d3ee', '#5ef2b0', '#f7e35a', '#ff9a3c', '#ff3d8b'];
const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function specRGB(tt) { tt = Math.min(1, Math.max(0, tt)) * 6; const k = Math.min(5, Math.floor(tt)); let f = tt - k; f = f * f * (3 - 2 * f); const a = hexRgb(SPEC_HEX[k]), b = hexRgb(SPEC_HEX[k + 1]); return a.map((v, i) => Math.round(v + (b[i] - v) * f)); }
const specCSS = tt => `rgb(${specRGB(tt).join(',')})`;
const STORM = NL.storms.find(s => s.date === NL.pick.storm_day) || NL.storms[0];
const MON = { en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] };
const DOW = { en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], es: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] };
function fmtDay(iso, withDow) { const [y, m, d] = iso.split('-').map(Number); const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); return lang === 'es' ? `${withDow ? DOW.es[dow] + ' ' : ''}${d} ${MON.es[m - 1]}` : `${withDow ? DOW.en[dow] + ', ' : ''}${MON.en[m - 1]} ${d}`; }
function fmtClock(hhmm) { let [h, m] = hhmm.split(':').map(Number); const h12 = ((h + 11) % 12) + 1; return m ? `${h12}:${String(m).padStart(2, '0')}` : `${h12}`; }
const bestTime = () => { const bt = NL.pick.best_time; const a = fmtClock(bt.start), b = fmtClock(bt.end); return lang === 'es' ? [`${a}–${b}`, 'p. m.'] : [`${a}–${b}`, 'PM']; };

function normName(n) {
  n = String(n).toLowerCase(); const d = (n.match(/\d+/) || [''])[0];
  const ty = /\b(ave|av|avenue)\b/.test(n) ? 'a' : /\b(st|street)\b/.test(n) ? 's' : /\b(dr|drive)\b/.test(n) ? 'd' : '';
  return d ? d + ty : n.replace(/[^a-z]/g, '').slice(0, 9) + ty;
}
function prettyName(n) {
  let s = String(n).toLowerCase().replace(/\b(\d+)(st|nd|rd|th)\b/, '$1$2').replace(/\bstreet\b/, 'St').replace(/\bavenue\b/, 'Ave').replace(/\bdrive\b/, 'Dr');
  return s.replace(/\b([a-z])([a-z]*)/g, (m, a, b) => /^(st|nd|rd|th)$/.test(a + b) ? m : a.toUpperCase() + b);
}
function segDist(p, a, b) { const dx = b[0] - a[0], dz = b[1] - a[1]; const L2 = dx * dx + dz * dz || 1e-9; let u = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2; u = Math.max(0, Math.min(1, u)); const x = a[0] + u * dx, z = a[1] + u * dz; return [Math.hypot(p[0] - x, p[1] - z), u, [x, z]]; }

const STREETS = [];
for (const r of NL.columbus) {
  const pts = r.p.map(q => toW(q[0], q[1]));
  let md = Infinity; for (let i = 0; i < pts.length - 1; i++) md = Math.min(md, segDist([0, 0], pts[i], pts[i + 1])[0]);
  if (pts.length === 1) md = Math.hypot(pts[0][0], pts[0][1]);
  if (md < 1000 && !/^intersection$/i.test(r.n)) STREETS.push({ c: r.c, n: r.n, nm: normName(r.n), pts, md });
}

/* ---------------- street graph + walking route (door order = rank) ---------------- */
const G = { nodes: [], adj: [] }; const nodeIdx = new Map(); const EDGES = [];
const nodeOf = p => { const k = Math.round(p[0] * 2) + ',' + Math.round(p[1] * 2); if (!nodeIdx.has(k)) { nodeIdx.set(k, G.nodes.length); G.nodes.push(p); G.adj.push([]); } return nodeIdx.get(k); };
for (const s of STREETS) {
  if (s.md > 700) continue;
  for (let i = 0; i < s.pts.length - 1; i++) {
    const a = nodeOf(s.pts[i]), b = nodeOf(s.pts[i + 1]); if (a === b) continue;
    const w = Math.hypot(G.nodes[a][0] - G.nodes[b][0], G.nodes[a][1] - G.nodes[b][1]);
    G.adj[a].push([b, w]); G.adj[b].push([a, w]); EDGES.push({ a, b, nm: s.nm, len: w, used: false, s });
  }
}
function snap(p, nm) {
  let best = null;
  for (let pass = 0; pass < 2 && !best; pass++) for (const e of EDGES) {
    if (pass === 0 && nm && e.nm !== nm) continue;
    const [d, u, q] = segDist(p, G.nodes[e.a], G.nodes[e.b]);
    if (!best || d < best.d) best = { e, t: u, p: q, d };
  }
  return best;
}
function route(A, B) { // A,B = snaps; shortest path along the street graph
  const n = G.nodes.length, S0 = n, T0 = n + 1; const dist = new Float64Array(n + 2).fill(Infinity), prev = new Int32Array(n + 2).fill(-1), done = new Uint8Array(n + 2);
  const extra = new Map(); const add = (u, v, w) => { if (!extra.has(u)) extra.set(u, []); extra.get(u).push([v, w]); };
  add(S0, A.e.a, A.t * A.e.len); add(S0, A.e.b, (1 - A.t) * A.e.len);
  add(A.e.a, S0, A.t * A.e.len); add(A.e.b, S0, (1 - A.t) * A.e.len);
  add(B.e.a, T0, B.t * B.e.len); add(B.e.b, T0, (1 - B.t) * B.e.len);
  if (A.e === B.e) add(S0, T0, Math.abs(A.t - B.t) * A.e.len);
  dist[S0] = 0;
  for (;;) {
    let u = -1, bd = Infinity; for (let i = 0; i < n + 2; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; u = i; }
    if (u < 0 || u === T0) break; done[u] = 1;
    const nb = (u < n ? G.adj[u] : []).concat(extra.get(u) || []);
    for (const [v, w] of nb) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; }
  }
  const seq = []; for (let v = prev[T0]; v >= 0 && v !== S0; v = prev[v]) seq.push(v); seq.reverse();
  for (let i = 0; i < seq.length - 1; i++) { const a = seq[i], b = seq[i + 1]; for (const e of EDGES) if ((e.a === a && e.b === b) || (e.a === b && e.b === a)) e.used = true; }
  if (seq.length) { A.e.used = true; B.e.used = true; } else if (A.e === B.e) A.e.used = true;
  return [A.p, ...seq.map(i => G.nodes[i]), B.p];
}

/* ---------------- procedural hologram houses ---------------- */
class HB {
  constructor() { this.T = []; this.TK = []; this.E = []; this.EK = []; }
  tri(a, b, c, k) { this.T.push(...a, ...b, ...c); this.TK.push(k, k, k); }
  quad(a, b, c, d, k) { this.tri(a, b, c, k); this.tri(a, c, d, k); }
  edge(a, b, k = 0) { this.E.push(...a, ...b); this.EK.push(k); }
  box(x0, x1, y0, y1, z0, z1, k = 0, top = false) {
    const a = [x0, y0, z0], b = [x1, y0, z0], c = [x1, y0, z1], d = [x0, y0, z1], e = [x0, y1, z0], f = [x1, y1, z0], g = [x1, y1, z1], h = [x0, y1, z1];
    this.quad(d, c, g, h, k); this.quad(b, a, e, f, k); this.quad(a, d, h, e, k); this.quad(c, b, f, g, k); if (top) this.quad(h, g, f, e, 1);
    [[a, b], [b, c], [c, d], [d, a], [e, f], [f, g], [g, h], [h, e], [a, e], [b, f], [c, g], [d, h]].forEach(([p, q]) => this.edge(p, q, 0));
  }
  gable(u0, u1, v0, v1, y0, rise, oh, ax) {
    const M = ax === 'x' ? (u, y, v) => [u, y, v] : (u, y, v) => [v, y, u];
    const vm = (v0 + v1) / 2, hd = (v1 - v0) / 2, yR = y0 + rise, yE = y0 - rise * oh / hd, ua = u0 - oh, ub = u1 + oh, va = v0 - oh, vb = v1 + oh;
    const A = M(ua, yE, vb), B = M(ub, yE, vb), Cc = M(ub, yR, vm), D = M(ua, yR, vm), E = M(ub, yE, va), F = M(ua, yE, va);
    this.quad(A, B, Cc, D, 1); this.quad(E, F, D, Cc, 1);
    this.tri(M(u0, y0, v0), M(u0, y0, v1), M(u0, yR, vm), 0); this.tri(M(u1, y0, v1), M(u1, y0, v0), M(u1, yR, vm), 0);
    [[D, Cc], [A, B], [F, E], [A, D], [F, D], [B, Cc], [E, Cc]].forEach(([p, q]) => this.edge(p, q, 0));
    this.edge(M(u0, y0, v0), M(u0, yR, vm), 1); this.edge(M(u0, y0, v1), M(u0, yR, vm), 1);
    this.edge(M(u1, y0, v0), M(u1, yR, vm), 1); this.edge(M(u1, y0, v1), M(u1, yR, vm), 1);
    return yR;
  }
  hip(u0, u1, v0, v1, y0, rise, oh, ax) {
    const M = ax === 'x' ? (u, y, v) => [u, y, v] : (u, y, v) => [v, y, u];
    const hd = (v1 - v0) / 2, vm = (v0 + v1) / 2, yR = y0 + rise, yE = y0 - rise * oh / hd;
    const ua = u0 - oh, ub = u1 + oh, va = v0 - oh, vb = v1 + oh, h2 = hd + oh;
    let r0 = ua + h2, r1 = ub - h2; if (r0 > r1) r0 = r1 = (ua + ub) / 2;
    const P0 = M(r0, yR, vm), P1 = M(r1, yR, vm), A = M(ua, yE, vb), B = M(ub, yE, vb), E = M(ub, yE, va), F = M(ua, yE, va);
    this.quad(A, B, P1, P0, 1); this.quad(E, F, P0, P1, 1); this.tri(F, A, P0, 1); this.tri(B, E, P1, 1);
    if (r1 > r0) this.edge(P0, P1);
    [[A, P0], [F, P0], [B, P1], [E, P1], [A, B], [B, E], [E, F], [F, A]].forEach(([p, q]) => this.edge(p, q, 0));
    return yR;
  }
  rectZ(cx, cy, z, w, h, k, pane, mull) {
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2; const A = [x0, y0, z], B = [x1, y0, z], Cc = [x1, y1, z], D = [x0, y1, z];
    if (pane != null) this.quad(A, B, Cc, D, pane);
    this.edge(A, B, k); this.edge(B, Cc, k); this.edge(Cc, D, k); this.edge(D, A, k);
    if (mull) this.edge([cx, y0, z], [cx, y1, z], k);
  }
  rectX(x, cy, cz, w, h, k, pane) {
    const z0 = cz - w / 2, z1 = cz + w / 2, y0 = cy - h / 2, y1 = cy + h / 2; const A = [x, y0, z0], B = [x, y0, z1], Cc = [x, y1, z1], D = [x, y1, z0];
    if (pane != null) this.quad(A, B, Cc, D, pane);
    this.edge(A, B, k); this.edge(B, Cc, k); this.edge(Cc, D, k); this.edge(D, A, k);
  }
}
// face kinds: 0 wall, 1 roof, 2 window pane, 3 door pane, 4 garage door ; edge kinds: 0 frame, 1 detail, 2 door
function buildHouse(h, compact) {
  const rng = mulberry32(hashStr(h.addr + '|' + h.built));
  const b = new HB(); const oh = 0.45; const r = rng();
  let type = compact ? 'two' : h.built < 1970 ? (r < .5 ? 'ranch' : r < .78 ? 'hip' : 'split') : h.built < 1990 ? (r < .3 ? 'ranch' : r < .55 ? 'split' : r < .8 ? 'cross' : 'hip') : (r < .55 ? 'two' : 'cross');
  let W, D, wall, H, doorX, zf, porch = false;
  const frontWins = (x0, x1, y, z, avoid, n, hgt = 1.25) => { // spread n windows across [x0,x1], skipping the door zone
    for (let i = 0; i < n; i++) { const cx = x0 + (x1 - x0) * (i + 0.5) / n; if (avoid.some(([a, c]) => Math.abs(cx - a) < c)) continue; b.rectZ(cx, y, z, 1.45, hgt, 1, 2, true); }
  };
  const sideWins = (x, D0, y, n) => { for (let i = 0; i < n; i++) b.rectX(x, y, -D0 / 2 + D0 * (i + 0.5) / n, 1.2, 1.1, 1, 2); };
  if (type === 'ranch' || type === 'hip' || type === 'cross') {
    W = 13.5 + rng() * 3.5; D = 8.4 + rng() * 1.6; wall = 2.7 + rng() * 0.3; const rise = type === 'hip' ? 1.5 + rng() * .4 : 1.8 + rng() * .6;
    b.box(-W / 2, W / 2, 0, wall, -D / 2, D / 2);
    H = type === 'hip' ? b.hip(-W / 2, W / 2, -D / 2, D / 2, wall, rise, oh, 'x') : b.gable(-W / 2, W / 2, -D / 2, D / 2, wall, rise, oh, 'x');
    zf = D / 2; doorX = (rng() < .5 ? -1 : 1) * W * (0.06 + rng() * 0.1);
    let avoid = [[doorX, 1.4]];
    if (type === 'cross') { // front-facing gable wing
      const ww = 5.6, side = doorX > 0 ? -1 : 1, wx = side * (W / 2 - ww / 2 - 1.2), z0 = D / 2 - 1, z1 = D / 2 + 2.6;
      b.box(wx - ww / 2, wx + ww / 2, 0, wall, z0, z1);
      b.gable(z0, z1, wx - ww / 2, wx + ww / 2, wall, 2.0, 0.4, 'z');
      b.rectZ(wx, 1.6, z1 + 0.03, 2.3, 1.4, 1, 2, true);
      avoid.push([wx, ww / 2 + 0.6]);
    }
    frontWins(-W / 2, W / 2, 1.55, zf + 0.03, avoid, 4);
    frontWins(-W / 2, W / 2, 1.55, -zf - 0.03, [], 3);
    sideWins(-W / 2 - 0.03, D, 1.55, 1); sideWins(W / 2 + 0.03, D, 1.55, 1);
  } else if (type === 'split') {
    W = 14.5 + rng() * 2.5; D = 8.8 + rng() * 1.2; const W1 = W * 0.55; wall = 2.8;
    b.box(-W / 2, -W / 2 + W1, 0, wall, -D / 2, D / 2);
    b.gable(-W / 2, -W / 2 + W1, -D / 2, D / 2, wall, 1.6, oh, 'x');
    b.box(-W / 2 + W1, W / 2, 0, 4.5, -D / 2, D / 2);
    H = b.gable(-W / 2 + W1, W / 2, -D / 2, D / 2, 4.5, 1.9, oh, 'x');
    zf = D / 2; doorX = -W / 2 + W1 - 1.1;
    frontWins(-W / 2, -W / 2 + W1, 1.55, zf + 0.03, [[doorX, 1.2]], 3);
    const xr0 = -W / 2 + W1, xr1 = W / 2;
    b.rectZ((xr0 + xr1) / 2, 3.35, zf + 0.03, 2.4, 1.2, 1, 2, true); b.rectZ((xr0 + xr1) / 2, 1.05, zf + 0.03, 2.4, 0.9, 1, 2, true);
    sideWins(W / 2 + 0.03, D, 3.3, 2); sideWins(-W / 2 - 0.03, D, 1.55, 1);
  } else { // two-story
    W = compact ? 9.4 + rng() * 1.2 : 10 + rng() * 2.5; D = compact ? 7.8 + rng() * .6 : 8 + rng() * 1.4; wall = 5.5;
    b.box(-W / 2, W / 2, 0, wall, -D / 2, D / 2);
    H = rng() < .6 ? b.gable(-W / 2, W / 2, -D / 2, D / 2, wall, 2.2 + rng() * .6, oh, 'x') : b.hip(-W / 2, W / 2, -D / 2, D / 2, wall, 1.9, oh, 'x');
    zf = D / 2; doorX = (rng() < .5 ? -1 : 1) * W * 0.12;
    frontWins(-W / 2, W / 2, 1.5, zf + 0.03, [[doorX, 1.2]], 3);
    frontWins(-W / 2, W / 2, 4.2, zf + 0.03, [], 3);
    frontWins(-W / 2, W / 2, 4.2, -zf - 0.03, [], 3);
    sideWins(-W / 2 - 0.03, D, 4.2, 1); sideWins(W / 2 + 0.03, D, 1.5, 1);
    porch = !compact && rng() < .6;
  }
  // front door (the knock target)
  b.rectZ(doorX, 1.06, zf + 0.04, 1.0, 2.12, 2, 3, false);
  if (porch) {
    const px0 = doorX - 1.9, px1 = doorX + 1.9, pz = zf + 2.0;
    b.box(px0, px1, 0, 0.22, zf, pz, 0, true);
    b.edge([px0, 0.22, pz], [px0, 2.75, pz], 1); b.edge([px1, 0.22, pz], [px1, 2.75, pz], 1);
    b.quad([px0, 3.05, zf], [px1, 3.05, zf], [px1, 2.75, pz + 0.2], [px0, 2.75, pz + 0.2], 1);
    b.edge([px0, 2.75, pz + 0.2], [px1, 2.75, pz + 0.2], 0); b.edge([px0, 3.05, zf], [px0, 2.75, pz + 0.2], 0); b.edge([px1, 3.05, zf], [px1, 2.75, pz + 0.2], 0);
  }
  // attached garage
  if (!compact && type !== 'split' && type !== 'two' && rng() < 0.7) {
    const gw = 6.6, gd = 7.2, side = doorX > 0 ? -1 : 1, gx0 = side > 0 ? W / 2 : -W / 2 - gw, gz1 = D / 2, gz0 = D / 2 - gd;
    b.box(gx0, gx0 + gw, 0, 2.55, gz0, gz1);
    b.gable(gx0, gx0 + gw, gz0, gz1, 2.55, 1.25, 0.35, 'x');
    const gc = gx0 + gw / 2; b.rectZ(gc, 1.08, gz1 + 0.03, 4.9, 2.15, 1, 4, false);
    for (let i = 1; i < 4; i++) b.edge([gc - 2.45, 0.0 + i * 0.54, gz1 + 0.03], [gc + 2.45, i * 0.54, gz1 + 0.03], 1);
  }
  if (rng() < .45) { const cx = (rng() < .5 ? -1 : 1) * W * 0.28, cz = -D * 0.16; b.box(cx - 0.45, cx + 0.45, wall * 0.5, H + 0.75, cz - 0.45, cz + 0.45, 0, true); }
  // recenter footprint on origin
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < b.T.length; i += 3) { x0 = Math.min(x0, b.T[i]); x1 = Math.max(x1, b.T[i]); z0 = Math.min(z0, b.T[i + 2]); z1 = Math.max(z1, b.T[i + 2]); }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  for (let i = 0; i < b.T.length; i += 3) { b.T[i] -= cx; b.T[i + 2] -= cz; }
  for (let i = 0; i < b.E.length; i += 3) { b.E[i] -= cx; b.E[i + 2] -= cz; }
  return { b, type, H: Math.max(H, 0), hw: (x1 - x0) / 2, hd: (z1 - z0) / 2, door: [doorX - cx, (porch ? zf + 2.6 : zf + 1.6) - cz], front: z1 - cz };
}

// Layout: face each house to its street, keep it off every street and off its neighbours.
const HS = HOMES.map((h, i) => {
  const hp = toW(h.p[0], h.p[1]);
  let nn = Infinity; HOMES.forEach((o, j) => { if (j !== i) { const q = toW(o.p[0], o.p[1]); nn = Math.min(nn, Math.hypot(q[0] - hp[0], q[1] - hp[1])); } });
  const geo = buildHouse(h, nn < 18);
  const sn = snap(hp, normName(h.st));
  let fx = sn.p[0] - hp[0], fz = sn.p[1] - hp[1]; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
  const dc = Math.max(sn.d + 1.0, geo.front + 8.5);
  const th = Math.atan2(fx, fz);
  return { i, h, geo, th, f: [fx, fz], c: [sn.p[0] - fx * dc, sn.p[1] - fz * dc], c0: null, hailT: hailT(h.hail) };
});
HS.forEach(s => { s.c0 = s.c.slice(); });
const xAxis = s => [Math.cos(s.th), -Math.sin(s.th)];
const toLocal = (s, p) => { const dx = p[0] - s.c[0], dz = p[1] - s.c[1], c = Math.cos(s.th), sn = Math.sin(s.th); return [dx * c - dz * sn, dx * sn + dz * c]; };
const toWorld = (s, lx, lz) => { const c = Math.cos(s.th), sn = Math.sin(s.th); return [s.c[0] + lx * c + lz * sn, s.c[1] - lx * sn + lz * c]; };
(function solveLayout() {
  const samples = []; for (const s of STREETS) { if (s.md > 320) continue; for (let i = 0; i < s.pts.length - 1; i++) { const a = s.pts[i], b = s.pts[i + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.ceil(L / 2)); for (let k = 0; k <= n; k++) samples.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); } }
  const corners = s => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => toWorld(s, u * (s.geo.hw + 0.8), v * (s.geo.hd + 0.8)));
  const overlap = (A, B) => { const ca = corners(A), cb = corners(B); for (const poly of [ca, cb]) for (let i = 0; i < 4; i++) { const p = poly[i], q = poly[(i + 1) % 4]; const ax = [q[1] - p[1], p[0] - q[0]]; let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity; for (const c of ca) { const d = c[0] * ax[0] + c[1] * ax[1]; a0 = Math.min(a0, d); a1 = Math.max(a1, d); } for (const c of cb) { const d = c[0] * ax[0] + c[1] * ax[1]; b0 = Math.min(b0, d); b1 = Math.max(b1, d); } if (a1 < b0 || b1 < a0) return false; } return true; };
  for (let it = 0; it < 60; it++) {
    for (const s of HS) {
      const ax = xAxis(s); const mx = s.geo.hw + 4.2, mz0 = -s.geo.hd - 3.5, mz1 = s.geo.front + 3.5;
      for (const p of samples) { if (Math.abs(p[0] - s.c[0]) > 40 || Math.abs(p[1] - s.c[1]) > 40) continue; const [lx, lz] = toLocal(s, p); if (Math.abs(lx) < mx && lz > mz0 && lz < mz1) { const push = (mx - Math.abs(lx)) * 0.35 * (lx > 0 ? -1 : 1); s.c[0] += ax[0] * push; s.c[1] += ax[1] * push; } }
    }
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      const A = HS[i], B = HS[j]; if (Math.hypot(A.c[0] - B.c[0], A.c[1] - B.c[1]) > 45 || !overlap(A, B)) continue;
      for (const [P, O] of [[A, B], [B, A]]) { const ax = xAxis(P); let sg = Math.sign((P.c[0] - O.c[0]) * ax[0] + (P.c[1] - O.c[1]) * ax[1]) || (P.i < O.i ? -1 : 1); P.c[0] += ax[0] * 0.45 * sg; P.c[1] += ax[1] * 0.45 * sg; }
    }
  }
})();
HS.forEach(s => {
  s.doorW = toWorld(s, s.geo.door[0], s.geo.door[1]);
  s.label = [s.doorW[0], s.geo.H + 7.5, s.doorW[1]];
  s.center = [s.c[0], s.geo.H * 0.45, s.c[1]];
});

// route: P -> door 1 -> ... -> door 25
const parkW = toW(NL.walk.park[0], NL.walk.park[1]);
const LEGS = []; let routeLen = 0;
{
  let prevPt = parkW, prevSnap = snap(parkW, null);
  HS.forEach((s, i) => {
    const sn = snap(s.doorW, normName(s.h.st));
    const pts = [prevPt, ...route(prevSnap, sn), s.doorW];
    const clean = []; for (const p of pts) { const q = clean[clean.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.3) clean.push(p); }
    let L = 0; for (let k = 1; k < clean.length; k++) L += Math.hypot(clean[k][0] - clean[k - 1][0], clean[k][1] - clean[k - 1][1]);
    LEGS.push({ pts: clean, len: L, d0: routeLen, i }); routeLen += L;
    prevPt = s.doorW; prevSnap = sn;
  });
}
const doorDist = LEGS.map(l => l.d0 + l.len);
function pointAt(d) {
  d = Math.max(0, Math.min(routeLen, d));
  for (const L of LEGS) { if (d > L.d0 + L.len + 1e-6) continue; let r = d - L.d0; for (let k = 1; k < L.pts.length; k++) { const a = L.pts[k - 1], b = L.pts[k]; const sl = Math.hypot(b[0] - a[0], b[1] - a[1]); if (r <= sl || k === L.pts.length - 1) { const u = sl ? Math.min(1, r / sl) : 0; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; } r -= sl; } }
  const l = LEGS[LEGS.length - 1]; return l.pts[l.pts.length - 1];
}
// block centre (for framing)
const BB = (() => { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; HS.forEach(s => { x0 = Math.min(x0, s.c[0]); x1 = Math.max(x1, s.c[0]); z0 = Math.min(z0, s.c[1]); z1 = Math.max(z1, s.c[1]); }); return { x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 }; })();

/* ---------------- renderer ---------------- */
const canvas = $('gl');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); }
catch (e) { $('nogl').textContent = t('nogl'); $('nogl').style.display = 'grid'; throw e; }
const PR = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(PR);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
renderer.setClearColor(0x05030b, 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 1, 12000);
const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.8, 0.6, 0.16);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const lin = hex => new THREE.Color(hex); // three converts sRGB hex -> linear working space
const U = {
  uTime: { value: 7.3 }, uMotion: { value: MOTION }, uSpec: { value: SPEC_HEX.map(lin) },
  uHouse: { value: HS.map(() => new THREE.Vector4(0, 999, 1, 0)) },
  uRes: { value: new THREE.Vector2(1, 1) }, uLineW: { value: 1.6 * PR },
  uCenter: { value: new THREE.Vector3(BB.cx, 0, BB.cz) }, uReveal: { value: 5000 }, uFade: { value: 1 },
  uDraw: { value: 1e9 }, uHead: { value: -1 }, uPathDim: { value: 1 }, uSel: { value: -1 },
  uHor: { value: lin('#1a0f36') }, uZen: { value: lin('#030208') }, uHaze: { value: lin('#3a1a5e') }, uGround: { value: lin('#07051a') },
  uGrid: { value: lin('#6d5cff') }, uAurA: { value: lin('#27ffc2') }, uAurB: { value: lin('#7b5cff') }, uAurC: { value: lin('#ff4fd8') }, uAurI: { value: 0.9 },
  uStreet: { value: lin('#7d74f0') }, uStreetW: { value: lin('#b9b0ff') },
  uHomes: { value: HS.map(s => new THREE.Vector4(s.c[0], s.c[1], s.h.hail, 0)) }, uRingR: { value: 470 },
};
const GLSL_COMMON = /* glsl */`
uniform vec3 uSpec[7]; uniform float uTime; uniform float uMotion;
vec3 spectral(float t){ t = clamp(t,0.,1.)*6.; float k = min(floor(t),5.); int i = int(k); return mix(uSpec[i], uSpec[i+1], smoothstep(0.,1.,t-k)); }
float hailT(float h){ return clamp((h-1.44)/0.26, 0., 1.); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f); return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*vnoise(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return s; }
`;
const GLSL_AURORA = /* glsl */`
uniform vec3 uAurA, uAurB, uAurC, uHor, uHaze, uZen, uGround; uniform float uAurI;
vec3 horizonCol(){ return uHor + uHaze*0.5; }
vec3 skyBase(vec3 d){
  float y = d.y; vec3 hz = horizonCol();
  vec3 col = y >= 0. ? mix(hz, uZen, pow(clamp(y,0.,1.), 0.5)) : mix(hz, uGround, smoothstep(0., 0.3, -y));
  return col + uHaze*exp(-abs(y)*28.)*0.3;
}
vec3 aurora(vec3 d){
  if (d.y <= 0.0) return vec3(0.);
  float el = asin(clamp(d.y,0.,1.)); float az = atan(d.x, -d.z);
  float tt = uTime*0.03*uMotion + 3.1;
  float fold = fbm(vec2(az*1.25 + 11., tt*0.5));
  float base = 0.03 + 0.1*fold;
  float h = el - base;
  float st = vnoise(vec2(az*150. + fold*14., tt*2.)); st = 0.2 + 0.8*st*st;
  float st2 = vnoise(vec2(az*38. - fold*5., tt*1.3));
  float foot = smoothstep(-0.005, 0.012, h);
  float rise = exp(-max(h,0.) * mix(16., 4.2, st*st2));
  float patchy = smoothstep(0.28, 0.66, fbm(vec2(az*0.75 + 4., tt*0.35)));
  float north = 0.55 + 0.45*smoothstep(-0.5, 0.8, -d.z);
  vec3 c = mix(uAurA, uAurB, smoothstep(0.0, 0.1, h));
  c = mix(c, uAurC, smoothstep(0.09, 0.26, h));
  return c * foot * rise * (0.35 + 0.65*st) * patchy * north * 0.75;
}`;
const shader = (vs, fs, extra = {}, opts = {}) => new THREE.ShaderMaterial(Object.assign({ uniforms: Object.assign({}, U, extra), vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false, side: THREE.DoubleSide }, opts));
const MAXBLEND = { blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendEquationAlpha: THREE.MaxEquation };

/* sky */
{
  const m = shader(/* glsl */`varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position = p.xyww; }`,
    GLSL_COMMON + GLSL_AURORA + /* glsl */`
    uniform float uFade; varying vec3 vDir;
    void main(){
      vec3 d = normalize(vDir); float y = d.y;
      vec3 col = skyBase(d);
      col += aurora(d) * uAurI;
      vec2 sp = vec2(atan(d.x,-d.z)*380./3.14159, y*380.);
      vec2 id = floor(sp); vec2 f = fract(sp)-.5; float r = hash12(id);
      if (r > 0.972 && y > 0.015){ vec2 o = vec2(hash12(id+7.3), hash12(id+13.1))-.5; float s = smoothstep(0.16, 0.0, length(f - o*0.6));
        float tw = mix(1., 0.65+0.35*sin(uTime*1.7 + r*80.), uMotion); col += vec3(0.8,0.82,1.)*s*(r-0.972)*40.*tw*smoothstep(0.015,0.2,y); }
      gl_FragColor = vec4(col*uFade, 1.);
    }`, {}, { side: THREE.BackSide, depthTest: false, transparent: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), m); sky.renderOrder = -10; sky.frustumCulled = false; sky.name = 'sky';
  scene.add(sky);
  var SKY = sky;
}

/* ground: glass-dark projection table with calm hail contours */
{
  const g = new THREE.PlaneGeometry(9000, 9000, 1, 1); g.rotateX(-Math.PI / 2);
  const m = shader(/* glsl */`varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    GLSL_COMMON + GLSL_AURORA + /* glsl */`
    uniform vec4 uHomes[25]; uniform vec3 uCenter, uGrid; uniform float uReveal, uFade, uRingR; varying vec3 vW;
    void main(){
      vec3 V = vW - cameraPosition; float dist = length(V); V /= dist;
      vec2 p = vW.xz; float r = length(p - uCenter.xz);
      float rev = smoothstep(uReveal, uReveal - 140., r);
      vec3 col = uGround;
      float gA = (1. - smoothstep(140., 520., r)) * rev;
      vec2 g = p/10.; vec2 gd = abs(fract(g-.5)-.5)/fwidth(g); float gl = 1.-min(min(gd.x,gd.y),1.);
      vec2 G = p/50.; vec2 Gd = abs(fract(G-.5)-.5)/fwidth(G); float Gl = 1.-min(min(Gd.x,Gd.y),1.);
      float gfw = max(fwidth(g).x, fwidth(g).y);
      col += uGrid * (gl*0.05*(1.-smoothstep(0.25,0.7,gfw)) + Gl*0.085) * gA;
      // hail field: gaussian-weighted home estimates (calm contours, no particles)
      float ws = 0.0015, hs = 0.0015*1.57; vec3 glow = vec3(0.);
      for (int i=0;i<25;i++){ vec2 d = p - uHomes[i].xy; float dd = dot(d,d); float w = exp(-dd*(1./(2.*30.*30.))); ws += w; hs += w*uHomes[i].z;
        glow += spectral(hailT(uHomes[i].z)) * exp(-dd*(1./(2.*7.*7.))) * uHomes[i].w; }
      float f = hs/ws; float cover = smoothstep(0.01, 0.3, ws - 0.0015) * rev;
      float v = f/0.02; float fw = max(fwidth(v), 1e-4);
      float cl = (1. - smoothstep(0.35, 1.25, abs(fract(v+.5)-.5)/fw)) * (1. - smoothstep(0.35, 0.8, fw));
      float k = floor(v+.5); float maj = 1. - step(0.5, mod(k, 5.));
      col += spectral(hailT(k*0.02)) * cl * cover * (0.2 + 0.28*maj);
      col += spectral(hailT(f)) * cover * 0.03;
      col += glow * 0.13;
      // projection ring + ticks
      float ring = exp(-pow((r-uRingR)/1.3, 2.))*0.55 + exp(-pow((r-uRingR)/26., 2.))*0.05;
      float ang = atan(p.y-uCenter.z, p.x-uCenter.x)*57.2958/3.; float af = abs(fract(ang)-.5)/max(fwidth(ang),1e-4);
      float tick = (1.-smoothstep(0.5, 1.3, af)) * step(uRingR-10., r) * step(r, uRingR-2.);
      col += uGrid * (ring + tick*0.35) * rev * 0.9;
      // faint aurora reflected in the glassy ground
      vec3 R = reflect(V, vec3(0.,1.,0.)); float fr = pow(1.-abs(V.y), 5.);
      col += aurora(R) * uAurI * 0.28 * fr;
      col = mix(col, skyBase(V), smoothstep(650., 3600., dist));
      gl_FragColor = vec4(col*uFade, 1.);
    }`, {}, { transparent: false, depthWrite: true });
  const ground = new THREE.Mesh(g, m); ground.renderOrder = -5; scene.add(ground);
}

/* capsule-segment ribbons on the ground (streets + path) */
function ribbonGeometry(segs) { // segs: {a:[x,z], b:[x,z], hw, y, s:[4 floats]}
  const P = [], L = [], SG = [], I = [];
  let n = 0;
  for (const s of segs) {
    const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1]; const len = Math.hypot(dx, dz); if (len < 1e-3) continue;
    const ux = dx / len, uz = dz / len, nx = -uz, nz = ux, h = s.hw;
    const corners = [[-h, -h], [-h, len + h], [h, len + h], [h, -h]]; // [across, along]
    for (const [u, v] of corners) { P.push(s.a[0] + ux * v + nx * u, s.y, s.a[1] + uz * v + nz * u); L.push(u, v); SG.push(len, h, s.s[0], s.s[1]); }
    I.push(n, n + 1, n + 2, n, n + 2, n + 3); n += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aLoc', new THREE.Float32BufferAttribute(L, 2)); g.setAttribute('aSeg', new THREE.Float32BufferAttribute(SG, 4));
  g.setIndex(I); return g;
}
const RIB_VS = /* glsl */`attribute vec2 aLoc; attribute vec4 aSeg; varying vec2 vLoc; varying vec4 vSeg; varying vec3 vW;
void main(){ vLoc = aLoc; vSeg = aSeg; vW = position; gl_Position = projectionMatrix*viewMatrix*vec4(position,1.); }`;
const CAPSULE = /* glsl */`varying vec2 vLoc; varying vec4 vSeg; varying vec3 vW;
float capD(){ float L=vSeg.x; float u=vLoc.x, v=vLoc.y; return v<0. ? length(vec2(u,v)) : (v>L ? length(vec2(u,v-L)) : abs(u)); }`;
{ // streets
  const segs = [];
  const usedKey = new Set(EDGES.filter(e => e.used).map(e => { const a = G.nodes[e.a], b = G.nodes[e.b]; return [a, b].map(p => p.map(v => Math.round(v)).join(',')).sort().join('|'); }));
  for (const s of STREETS) for (let i = 0; i < s.pts.length - 1; i++) {
    const a = s.pts[i], b = s.pts[i + 1]; const k = [a, b].map(p => p.map(v => Math.round(v)).join(',')).sort().join('|');
    const w = usedKey.has(k) ? 1 : 0; segs.push({ a, b, y: 0.08, hw: s.c <= 1 ? 6 : (w ? 4.4 : 3.6), s: [w, s.c] });
  }
  const m = shader(RIB_VS, GLSL_COMMON + CAPSULE + /* glsl */`
    uniform vec3 uStreet, uStreetW, uCenter; uniform float uReveal, uFade;
    void main(){ float d = capD(); float hw = vSeg.y;
      float core = exp(-d*d/(0.5*0.5)); float halo = exp(-d*d/(hw*hw*0.45));
      float r = length(vW.xz - uCenter.xz);
      float fade = 1. - smoothstep(280., 820., r);
      float rev = smoothstep(uReveal, uReveal - 90., r);
      float w = vSeg.z; vec3 base = mix(uStreet, uStreetW, w);
      float I = core*(0.5 + 0.25*w) + halo*(0.08 + 0.05*w);
      if (vSeg.w < 1.5) I *= 1.3;
      gl_FragColor = vec4(base * I * fade * rev * uFade, 1.);
    }`, {}, MAXBLEND);
  const mesh = new THREE.Mesh(ribbonGeometry(segs), m); mesh.renderOrder = 1; mesh.frustumCulled = false; scene.add(mesh);
}
{ // prismatic walk path
  const segs = [];
  LEGS.forEach((L, li) => { let d = L.d0; for (let k = 1; k < L.pts.length; k++) { const a = L.pts[k - 1], b = L.pts[k]; segs.push({ a, b, y: 0.35, hw: 1.6, s: [d, li] }); d += Math.hypot(b[0] - a[0], b[1] - a[1]); } });
  const m = shader(RIB_VS, GLSL_COMMON + CAPSULE + /* glsl */`
    uniform float uDraw, uHead, uPathDim, uFade;
    void main(){ float L = vSeg.x, hw = vSeg.y; float d = capD(); float x = d/hw; if (x > 1.) discard;
      float along = vSeg.z + clamp(vLoc.y, 0., L);
      float drawn = smoothstep(uDraw + 0.8, uDraw - 0.8, along); if (drawn <= 0.) discard;
      float s = clamp(vLoc.x/hw, -1., 1.);
      vec3 band = spectral(s*0.5+0.5) * (1. - smoothstep(0.55, 1.0, x));
      float shimmer = 0.75 + 0.25*sin(along*0.08 - uTime*1.4*uMotion + s*1.5);
      vec3 core = vec3(1.,0.97,1.) * exp(-x*x/0.012);
      float walked = uHead < 0. ? 1. : mix(uPathDim, 1., step(along, uHead));
      float head = uHead < 0. ? 0. : exp(-pow((uHead - along)/5., 2.)) * step(along, uHead + 0.5);
      float dh = uDraw > 1e8 ? 0. : exp(-pow((uDraw - along)/4., 2.));
      vec3 col = (band*0.62*shimmer + core*0.62) * walked + vec3(1.,.98,1.)*(head*2.2 + dh*1.8)*exp(-x*x/0.35);
      gl_FragColor = vec4(col * drawn * uFade, 1.);
    }`, {}, MAXBLEND);
  const mesh = new THREE.Mesh(ribbonGeometry(segs), m); mesh.renderOrder = 2; mesh.frustumCulled = false; scene.add(mesh);
}

/* houses: one merged face mesh + one instanced fat-line mesh (all 25 homes, 2 draw calls) */
const HOUSE_VS = /* glsl */`attribute float aId; attribute float aKind; uniform vec4 uHouse[25];
varying vec3 vW; varying vec3 vN; varying float vKind; varying vec4 vH; varying float vId;
void main(){ vH = uHouse[int(aId+.5)]; vId = aId; vW = position; vN = normal; vKind = aKind; gl_Position = projectionMatrix*viewMatrix*vec4(position,1.); }`;
{
  const P = [], NRM = [], ID = [], K = [];
  HS.forEach(s => {
    const T = s.geo.b.T, TK = s.geo.b.TK; const c = Math.cos(s.th), sn = Math.sin(s.th);
    const w = [];
    for (let i = 0; i < T.length; i += 3) { const lx = T[i], ly = T[i + 1], lz = T[i + 2]; w.push(s.c[0] + lx * c + lz * sn, ly, s.c[1] - lx * sn + lz * c); }
    for (let i = 0; i < w.length; i += 9) {
      const ax = w[i + 3] - w[i], ay = w[i + 4] - w[i + 1], az = w[i + 5] - w[i + 2], bx = w[i + 6] - w[i], by = w[i + 7] - w[i + 1], bz = w[i + 8] - w[i + 2];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      for (let k = 0; k < 3; k++) { P.push(w[i + k * 3], w[i + k * 3 + 1], w[i + k * 3 + 2]); NRM.push(nx, ny, nz); ID.push(s.i); K.push(TK[i / 3 + k]); }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(NRM, 3));
  g.setAttribute('aId', new THREE.Float32BufferAttribute(ID, 1)); g.setAttribute('aKind', new THREE.Float32BufferAttribute(K, 1));
  const m = shader(HOUSE_VS, GLSL_COMMON + /* glsl */`
    uniform float uSel; varying vec3 vW; varying vec3 vN; varying float vKind; varying vec4 vH; varying float vId;
    void main(){
      float revealY = vH.y; if (vW.y > revealY) discard;
      vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW); float ndv = abs(dot(N,V));
      float fres = pow(1.-ndv, 2.2);
      float ht = vH.x;
      // thin-film interference (soap bubble): optical path 2 n d cos(theta_t) per RGB wavelength
      vec2 sw = vW.xz*0.22 + vec2(vW.y*0.35, -vW.y*0.2) + vec2(uTime*0.05*uMotion, 0.);
      float thick = 300. + 180.*ht + 260.*fbm(sw) + 60.*sin(vW.y*1.1 + uTime*0.4*uMotion);
      float cosT = sqrt(max(0., 1. - (1.-ndv*ndv)/1.77));
      vec3 film = 0.5 + 0.5*cos(6.2831853 * 2.*1.33*thick*cosT / vec3(650., 532., 450.));
      vec3 chroma = film - vec3(dot(film, vec3(0.3333)));
      vec3 hue = spectral(ht + 0.06*(fres-0.35));
      vec3 col = max(hue*(0.85 + 0.35*fres) + chroma*(0.55 + 0.7*fres), 0.);
      float k = vKind; float a;
      if (k < 0.5) a = 0.06 + 0.4*fres;
      else if (k < 1.5) { a = 0.12 + 0.42*fres; float sp = hash12(floor(vW.xz*5. + vW.y*3.)); a += step(0.985 - 0.02*ht, sp) * (0.6 + 0.4*sin(uTime*3.*uMotion + sp*60.)) * 0.8; }
      else if (k < 2.5) { a = 0.26; col = mix(col, vec3(1.,.96,.9), 0.35); }
      else if (k < 3.5) { a = 0.75; col = mix(col, vec3(1.,.93,.8), 0.55); }
      else a = 0.1;
      float scan = mix(0.9, 0.78 + 0.22*sin((vW.y*6.5 - uTime*1.5)*3.14159), uMotion) ;
      scan = mix(scan, 0.85 + 0.15*sin(vW.y*6.5*3.14159), 1.-uMotion);
      float I = vH.z * (1. + 0.75*vH.w);
      float edge = exp(-pow((revealY - vW.y)*2.5, 2.)) * step(revealY, 60.);
      gl_FragColor = vec4(col * a * scan * I + vec3(1.,.98,1.)*edge*0.9, 1.);
    }`, {}, { blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 5; mesh.frustumCulled = false; scene.add(mesh);
}
{ // edges as screen-space fat lines (constant pixel width, round-ish caps)
  const A = [], B = [], ID = [], K = [];
  HS.forEach(s => {
    const E = s.geo.b.E, EK = s.geo.b.EK; const c = Math.cos(s.th), sn = Math.sin(s.th);
    const w = (lx, ly, lz) => [s.c[0] + lx * c + lz * sn, ly, s.c[1] - lx * sn + lz * c];
    for (let i = 0, j = 0; i < E.length; i += 6, j++) { A.push(...w(E[i], E[i + 1], E[i + 2])); B.push(...w(E[i + 3], E[i + 4], E[i + 5])); ID.push(s.i); K.push(EK[j]); }
  });
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 0, 1, 0, 1, 1, 0, 1, -1, 0], 3)); g.setIndex([0, 2, 1, 0, 3, 2]);
  g.setAttribute('aA', new THREE.InstancedBufferAttribute(new Float32Array(A), 3)); g.setAttribute('aB', new THREE.InstancedBufferAttribute(new Float32Array(B), 3));
  g.setAttribute('aId', new THREE.InstancedBufferAttribute(new Float32Array(ID), 1)); g.setAttribute('aKind', new THREE.InstancedBufferAttribute(new Float32Array(K), 1));
  g.instanceCount = ID.length;
  const m = shader(/* glsl */`attribute vec3 aA, aB; attribute float aId, aKind; uniform vec4 uHouse[25]; uniform vec2 uRes; uniform float uLineW;
    varying float vSide; varying vec3 vW; varying float vKind; varying vec4 vH; varying float vHw;
    void main(){
      vH = uHouse[int(aId+.5)]; vKind = aKind;
      vec4 va = viewMatrix*vec4(aA,1.), vb = viewMatrix*vec4(aB,1.);
      float nz = -1.05;
      if (va.z > nz && vb.z > nz){ gl_Position = vec4(2.,2.,2.,1.); return; }
      if (va.z > nz) va = mix(va, vb, (va.z - nz)/(va.z - vb.z)); else if (vb.z > nz) vb = mix(vb, va, (vb.z - nz)/(vb.z - va.z));
      vec4 ca = projectionMatrix*va, cb = projectionMatrix*vb;
      vec2 sa = ca.xy/ca.w*0.5*uRes, sb = cb.xy/cb.w*0.5*uRes;
      vec2 dir = sb - sa; float dl = length(dir); dir = dl > 1e-4 ? dir/dl : vec2(1.,0.); vec2 nrm = vec2(-dir.y, dir.x);
      float w = uLineW * (vKind > 1.5 ? 1.5 : (vKind > 0.5 ? 0.8 : 1.)) * (1. + 0.45*vH.w);
      float hw = w*0.5 + 1.0; vHw = w*0.5;
      vec4 c = position.x < .5 ? ca : cb;
      vec2 off = nrm*position.y*hw + dir*(position.x < .5 ? -1. : 1.)*w*0.5;
      c.xy += off/(0.5*uRes)*c.w;
      vSide = position.y*hw;
      vW = position.x < .5 ? aA : aB;
      gl_Position = c;
    }`, GLSL_COMMON + /* glsl */`
    varying float vSide; varying vec3 vW; varying float vKind; varying vec4 vH; varying float vHw;
    void main(){
      if (vW.y > vH.y + 0.05) discard;
      float aa = 1. - smoothstep(vHw - 0.5, vHw + 0.6, abs(vSide));
      vec3 hue = spectral(vH.x + 0.05*sin(vW.y*0.7 + vW.x*0.05 + uTime*0.6*uMotion));
      float k = vKind; float I = k < 0.5 ? 1. : (k < 1.5 ? 0.5 : 1.5);
      vec3 col = mix(hue, vec3(1.), 0.22 + 0.35*step(1.5, k)) * I * 1.55 * vH.z * (1. + 0.9*vH.w);
      float edge = exp(-pow((vH.y - vW.y)*2.5, 2.)) * step(vH.y, 60.);
      gl_FragColor = vec4((col + edge*vec3(1.))*aa, 1.);
    }`, {}, { blending: THREE.AdditiveBlending });
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 6; mesh.frustumCulled = false; scene.add(mesh);
}
/* door beacons: light pillar + ground ring per door, plus the parking pad */
{
  const P = [], BS = [], CR = [], ID = [], I = []; let n = 0;
  const addQ = (base, id, kind, hgt) => { for (const [x, y] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) { P.push(base[0], 0, base[1]); BS.push(base[0], hgt, base[1]); CR.push(x, y, kind); ID.push(id); } I.push(n, n + 1, n + 2, n, n + 2, n + 3); n += 4; };
  HS.forEach(s => { addQ(s.doorW, s.i, 0, s.label[1] - 1.2); addQ(s.doorW, s.i, 1, 0); });
  addQ(parkW, -1, 0, 14.5); addQ(parkW, -1, 1, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aBase', new THREE.Float32BufferAttribute(BS, 3));
  g.setAttribute('aC', new THREE.Float32BufferAttribute(CR, 3)); g.setAttribute('aId', new THREE.Float32BufferAttribute(ID, 1)); g.setIndex(I);
  const m = shader(/* glsl */`attribute vec3 aBase, aC; attribute float aId; uniform vec4 uHouse[25];
    varying vec3 vC; varying vec4 vH; varying float vId;
    void main(){
      vId = aId; vC = aC; vH = aId < -0.5 ? vec4(-1., 999., 1., 0.) : uHouse[int(aId+.5)];
      vec3 p;
      if (aC.z < 0.5){ vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]); vec3 rt = normalize(vec3(camR.x, 0., camR.z) + 1e-5);
        vec3 b0 = vec3(aBase.x, 0., aBase.z); p = b0 + rt*aC.x*0.55 + vec3(0., aC.y*aBase.y + 0.3, 0.); }
      else { float sz = aId < -0.5 ? 6.5 : 4.2; p = vec3(aBase.x, 0.42, aBase.z) + vec3(aC.x*sz, 0., (aC.y*2.-1.)*sz); }
      gl_Position = projectionMatrix*viewMatrix*vec4(p,1.);
    }`, GLSL_COMMON + /* glsl */`
    uniform float uSel; varying vec3 vC; varying vec4 vH; varying float vId;
    void main(){
      bool park = vId < -0.5; vec3 hue = park ? vec3(0.92,0.9,1.) : spectral(vH.x);
      float on = park ? 1. : clamp((vH.y - 2.)/6., 0., 1.);
      float sel = (!park && abs(vId - uSel) < 0.1) ? 1. : 0.;
      float I = vH.z * (1. + 0.8*vH.w) * on;
      vec3 col;
      if (vC.z < 0.5){ float x = vC.x; float y = vC.y;
        float a = exp(-x*x*5.) * pow(1.-y, 1.7) * (0.55 + 0.45*exp(-x*x*40.));
        col = mix(hue, vec3(1.), 0.35) * a * 0.75 * I;
      } else {
        vec2 q = vec2(vC.x, vC.y*2.-1.); float r = length(q);
        float ring = exp(-pow((r-0.62)/0.05, 2.)) + exp(-pow(r/0.16, 2.))*0.9;
        if (park){ float hx = max(abs(q.x)*0.866 + abs(q.y)*0.5, abs(q.y)); ring = exp(-pow((hx-0.66)/0.035, 2.))*1.2 + exp(-pow((hx-0.5)/0.02, 2.))*0.35; }
        float pr = fract(uTime*0.55); float pulse = sel * exp(-pow((r - (0.2 + pr*0.8))/0.05, 2.)) * (1.-pr) * uMotion;
        float st = sel * (1.-uMotion) * exp(-pow((r-0.9)/0.04, 2.)) * 0.8;
        col = mix(hue, vec3(1.), 0.25) * (ring*0.9 + (pulse + st)*1.6) * I * (1. - smoothstep(0.92, 1., r));
      }
      gl_FragColor = vec4(col, 1.);
    }`, {}, { blending: THREE.AdditiveBlending });
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 7; mesh.frustumCulled = false; scene.add(mesh);
}

/* ---------------- camera rig ---------------- */
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.minDistance = 22; controls.maxDistance = 1100;
controls.minPolarAngle = 0.12; controls.maxPolarAngle = Math.PI * 0.47; controls.rotateSpeed = 0.55; controls.zoomSpeed = 0.8; controls.panSpeed = 0.8;
controls.screenSpacePanning = false;
const OVER = { tx: BB.cx - 2, ty: 0, tz: BB.cz + 4, dist: 360, elev: 0.56, az: -0.2 };
const INTRO = { tx: BB.cx + 10, ty: 8, tz: BB.cz - 10, dist: 560, elev: 0.075, az: -0.85 };
function framePose(i) {
  const s = HS[i]; const faceAz = Math.atan2(s.f[0], s.f[1]);
  const size = Math.max(s.geo.hw * 2, s.geo.hd * 1.6, s.geo.H * 2.2);
  return { tx: s.center[0], ty: s.geo.H * 0.55, tz: s.center[2], dist: 30 + size * 1.5, elev: 0.13, az: faceAz + 0.5 };
}
const rig = Object.assign({}, CALM ? OVER : INTRO);
const vel = { tx: 0, ty: 0, tz: 0, dist: 0, elev: 0, az: 0 };
let camMode = 'orbit'; let tw = null; let follow = null;
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
function applyRig() {
  const ce = Math.cos(rig.elev);
  camera.position.set(rig.tx + Math.sin(rig.az) * ce * rig.dist, rig.ty + Math.sin(rig.elev) * rig.dist, rig.tz + Math.cos(rig.az) * ce * rig.dist);
  controls.target.set(rig.tx, rig.ty, rig.tz); camera.lookAt(controls.target);
}
function readRig() {
  const d = camera.position.clone().sub(controls.target); const dist = d.length();
  Object.assign(rig, { tx: controls.target.x, ty: controls.target.y, tz: controls.target.z, dist, elev: Math.asin(Math.max(-1, Math.min(1, d.y / dist))), az: Math.atan2(d.x, d.z) });
}
const easeIO = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
function flyTo(pose, dur = 1.5) {
  if (RM || STILL) { Object.assign(rig, pose); applyRig(); camMode = 'orbit'; controls.enabled = true; return; }
  if (camMode === 'orbit') readRig();
  const from = Object.assign({}, rig); const move = Math.hypot(pose.tx - from.tx, pose.tz - from.tz);
  tw = { from, to: pose, t: 0, dur, lift: Math.min(140, move * 0.35) }; camMode = 'tween'; controls.enabled = false;
  for (const k in vel) vel[k] = 0;
}
function smoothDamp(k, target, st, dt) { // critically damped spring (Game Programming Gems 4, ch 1.10)
  const omega = 2 / st, x = omega * dt, ex = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let cur = rig[k]; if (k === 'az') target = cur + wrapA(target - cur);
  const change = cur - target, temp = (vel[k] + omega * change) * dt;
  vel[k] = (vel[k] - omega * temp) * ex; rig[k] = target + (change + temp) * ex;
}
function updateCamera(dt) {
  if (camMode === 'tween') {
    tw.t += dt; const u = Math.min(1, tw.t / tw.dur), e = easeIO(u), f = tw.from, to = tw.to;
    rig.tx = f.tx + (to.tx - f.tx) * e; rig.ty = f.ty + (to.ty - f.ty) * e; rig.tz = f.tz + (to.tz - f.tz) * e;
    rig.dist = f.dist + (to.dist - f.dist) * e + Math.sin(Math.PI * e) * tw.lift; rig.elev = f.elev + (to.elev - f.elev) * e + Math.sin(Math.PI * e) * 0.08 * Math.min(1, tw.lift / 60);
    rig.az = f.az + wrapA(to.az - f.az) * e; applyRig();
    if (u >= 1) { camMode = 'orbit'; controls.enabled = true; tw = null; }
  } else if (camMode === 'follow' && follow) {
    for (const k of ['tx', 'ty', 'tz', 'dist', 'elev', 'az']) smoothDamp(k, follow[k], follow.st || 0.7, Math.min(dt, 0.05));
    applyRig();
  } else { controls.update(); }
}

/* view offset: keep the subject centred in the free part of the screen (panels left / card right) */
const vo = { x: 0, y: 0, gx: 0, gy: 0 };
function voGoal() {
  const W = innerWidth, cardW = Math.min(408, Math.max(360, W * 0.28)), zoneW = Math.min(352, Math.max(300, W * 0.24));
  if (document.body.classList.contains('detail')) { vo.gx = -(cardW + 40) / 2; vo.gy = 28; }
  else { vo.gx = (zoneW + 40) / 2; vo.gy = 36; }
}
function applyVO() { camera.setViewOffset(innerWidth, innerHeight, -vo.x, vo.y, innerWidth, innerHeight); }

/* ---------------- DOM labels ---------------- */
const labelsEl = $('labels');
const pins = HS.map(s => { const el = document.createElement('div'); el.className = 'lb hide'; el.style.setProperty('--c', specCSS(s.hailT)); el.innerHTML = `<div class="pin">${s.i + 1}</div>`; el.dataset.i = s.i; labelsEl.appendChild(el); return el; });
const parkEl = document.createElement('div'); parkEl.className = 'lb'; parkEl.innerHTML = '<div class="pk3">P</div>'; labelsEl.appendChild(parkEl);
const tagEl = document.createElement('div'); tagEl.className = 'tag'; tagEl.innerHTML = '<div class="in"></div>'; labelsEl.appendChild(tagEl);
const streetLabels = (() => { // one label per nearby named street, on its most central piece
  const by = new Map();
  for (const s of STREETS) { if (s.md > 300) continue; for (let i = 0; i < s.pts.length - 1; i++) { const a = s.pts[i], b = s.pts[i + 1]; const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 45) continue; const sc = Math.hypot(m[0] - BB.cx, m[1] - BB.cz) - L * 0.15; const cur = by.get(s.nm); if (!cur || sc < cur.sc) by.set(s.nm, { sc, a, b, m, n: prettyName(s.n), nm: s.nm }); } }
  const walkNm = new Set(HS.map(s => normName(s.h.st)));
  return [...by.values()].sort((p, q) => p.sc - q.sc).slice(0, 12).map(o => { const el = document.createElement('div'); el.className = 'st' + (walkNm.has(o.nm) ? ' w' : ''); el.textContent = o.n; labelsEl.appendChild(el); return Object.assign(o, { el }); });
})();
const V3 = new THREE.Vector3();
function project(x, y, z) { V3.set(x, y, z).project(camera); return [(V3.x * 0.5 + 0.5) * innerWidth, (-V3.y * 0.5 + 0.5) * innerHeight, V3.z]; }
function placeLabels() {
  HS.forEach((s, i) => { const [x, y, z] = project(...s.label); const el = pins[i]; if (z > 1 || z < -1) { el.style.visibility = 'hidden'; return; } el.style.visibility = ''; el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`; });
  { const [x, y, z] = project(parkW[0], 16, parkW[1]); parkEl.style.visibility = z > 1 ? 'hidden' : ''; parkEl.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`; }
  for (const o of streetLabels) {
    const [x, y, z] = project(o.m[0], 0.5, o.m[1]); const [x1, y1] = project(o.a[0], 0.5, o.a[1]); const [x2, y2] = project(o.b[0], 0.5, o.b[1]);
    if (z > 1 || x < -100 || x > innerWidth + 100 || y < -40 || y > innerHeight + 40) { o.el.style.visibility = 'hidden'; continue; }
    let ang = Math.atan2(y2 - y1, x2 - x1); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
    const r = Math.hypot(o.m[0] - BB.cx, o.m[1] - BB.cz); const op = Math.max(0, Math.min(1, (420 - r) / 160)) * streetReveal;
    o.el.style.visibility = op > 0.02 ? '' : 'hidden'; o.el.style.opacity = op.toFixed(2);
    o.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-50%) rotate(${ang.toFixed(3)}rad)`;
  }
  if (hoverI >= 0) { const s = HS[hoverI]; const [x, y] = project(...s.label); tagEl.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`; }
}
let streetReveal = CALM ? 1 : 0;

/* ---------------- state ---------------- */
let sel = -1, hoverI = -1; const hov = new Float32Array(N); const focus = new Float32Array(N).fill(1); const reveal = new Float32Array(N).fill(CALM ? 1 : 0);
const tour = { on: false, paused: false, i: 0, phase: 'move', t: 0, head: 0, visited: new Set() };
let introT = CALM ? 99 : 0; let ready = CALM;

function setDetail(on) { document.body.classList.toggle('detail', on); voGoal(); }
function openCard(i, opts = {}) {
  i = Math.max(0, Math.min(N - 1, i)); sel = i; U.uSel.value = i; renderCard(); $('card').classList.add('on'); setDetail(true);
  if (opts.fly !== false) flyTo(framePose(i), opts.dur || 1.5);
  updateBars(); updateBack();
}
function closeCard() { sel = -1; U.uSel.value = -1; $('card').classList.remove('on'); setDetail(false); flyTo(OVER, 1.4); updateBars(); updateBack(); }
function whyLine(s) {
  const h = s.h; const hailRank = 1 + HOMES.filter(o => o.hail > h.hail).length; const roofRank = 1 + HOMES.filter(o => o.roof > h.roof).length;
  const hs = `<em>${h.hail.toFixed(2)}″</em>`;
  if (lang === 'es') {
    const a = hailRank <= 5 ? `Granizo de ${hs}, de los 5 más grandes de la ruta` : hailRank <= 13 ? `Granizo de ${hs}, arriba de la mitad de la ruta` : `Granizo de ${hs}, menor que en la mayoría de la ruta`;
    const b = h.roof >= 15 ? `el techo tiene unos ${h.roof} años${roofRank <= 5 ? ' (de los más viejos aquí)' : ''}` : `techo más nuevo, de unos ${h.roof} años`;
    const c = h.own ? 'aquí vive el dueño' : 'el dueño no vive aquí';
    return `${a}; ${b} en una casa de ${h.built}; ${c}. Es la #${h.rank} de ${N} de la ruta (puntaje ${h.score}).`;
  }
  const a = hailRank <= 5 ? `Top-5 hail on this walk at ${hs}` : hailRank <= 13 ? `${hs} hail, upper half of this walk` : `${hs} hail, lighter than most of this walk`;
  const b = h.roof >= 15 ? `a roof about ${h.roof} years old${roofRank <= 5 ? ' (among the oldest here)' : ''}` : `a newer roof, about ${h.roof} years old`;
  const c = h.own ? 'the owner lives here' : 'the owner does not live here';
  return `${a}; ${b} on a ${h.built} house; ${c}. Ranks #${h.rank} of ${N} on the walk (score ${h.score}).`;
}
const ARW_L = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 3 4.5 7l4 4"/></svg>';
const ARW_R = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 3l4 4-4 4"/></svg>';
function renderCard() {
  if (sel < 0) return; const s = HS[sel], h = s.h; const card = $('card');
  card.style.setProperty('--hc', specCSS(s.hailT)); card.style.setProperty('--hc2', specCSS(Math.min(1, s.hailT + 0.18)));
  $('cDoor').innerHTML = `${t('door')} ${sel + 1} <span class="st2">${t('of')} ${N}</span>`;
  $('cSmp').textContent = t('sampleHome');
  $('cClose').setAttribute('aria-label', t('close'));
  $('cHailL').innerHTML = `${t('hailSize')} <em>· ${fmtDay(STORM.date)}</em>`;
  $('cHail').innerHTML = `${h.hail.toFixed(2)}<small>″</small>`;
  const hailRank = 1 + HOMES.filter(o => o.hail > h.hail).length;
  $('cHailS').textContent = hailRank === 1 ? t('hailRank1') : t('hailRankN', { k: hailRank, n: N });
  $('cRoofL').innerHTML = `${t('roofAge')} <em>· ${t('est')}</em>`;
  $('cRoof').innerHTML = `${h.roof}<small>${t('yrs')}</small>`;
  const roofRank = 1 + HOMES.filter(o => o.roof > h.roof).length;
  $('cRoofS').textContent = roofRank <= 5 ? t('roofTop') : t('roofBuilt', { y: h.built });
  $('cMk').style.left = (s.hailT * 100).toFixed(1) + '%';
  const lo = Math.min(...HOMES.map(o => o.hail)), hi = Math.max(...HOMES.map(o => o.hail));
  $('cTk').innerHTML = `<span>${HMIN.toFixed(2)}″</span><span>${t('scaleLo')} <b>${lo.toFixed(2)}</b> · ${t('scaleHi')} <b>${hi.toFixed(2)}</b></span><span>${HMAX.toFixed(2)}″</span>`;
  $('cWhyK').textContent = t('why'); $('cWhy').innerHTML = whyLine(s);
  $('cAddr').textContent = h.addr; $('cCity').textContent = 'Columbus, NE · ' + t('sampleHome').toLowerCase();
  const legM = Math.round(LEGS[sel].len);
  $('cFacts').innerHTML = [[t('built'), h.built], [t('owner'), h.own ? t('yes') : t('no')], [t('score'), h.score], [sel ? t('fromPrev', { k: sel }) : t('fromP'), legM + ' m']]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  const pv = $('cPrev'), nx = $('cNext');
  pv.disabled = sel === 0; nx.disabled = sel === N - 1;
  pv.innerHTML = sel > 0 ? `<span class="d">${ARW_L}${t('prev', { k: sel })}</span><small>${HS[sel - 1].h.addr}</small>` : `<span class="d">${ARW_L}${t('door')}</span><small>—</small>`;
  nx.innerHTML = sel < N - 1 ? `<span class="d">${t('prev', { k: sel + 2 })}${ARW_R}</span><small>${HS[sel + 1].h.addr}</small>` : `<span class="d">${t('door')}${ARW_R}</span><small>—</small>`;
  $('cKeys').textContent = t('keys'); $('cSrc').textContent = t('csrc');
  renderTourStatus();
}
function renderTourStatus() {
  const st = $('cStatus').querySelector('span');
  if (!tour.on) { st.textContent = ''; return; }
  if (tour.done) st.textContent = t('walkDone', { n: N });
  else if (tour.paused) st.textContent = t('paused', { i: tour.i + 1 });
  else if (tour.phase === 'move') st.textContent = t('walking', { i: tour.i + 1, m: Math.round(LEGS[tour.i].len) });
  else st.textContent = t('atDoor', { i: tour.i + 1, n: N });
}

/* ---------------- tour (auto walk, pausable) ---------------- */
const DWELL = 3.4;
function legDur(i) { return RM ? 0.01 : Math.max(1.3, Math.min(3.2, LEGS[i].len / 95)); }
function startTour(from = 0) {
  tour.on = true; tour.paused = false; tour.done = false; tour.i = from; tour.phase = 'move'; tour.t = 0; tour.visited = new Set([...Array(from).keys()]);
  document.body.classList.add('touring'); U.uPathDim.value = 0.32; sel = from; U.uSel.value = from; renderCard(); $('card').classList.add('on'); setDetail(true);
  if (!RM) { readRig(); camMode = 'follow'; controls.enabled = false; follow = null; for (const k in vel) vel[k] = 0; }
  updateTourUI(); updateBars(); updateBack();
}
function stopTour(toOverview = true) {
  tour.on = false; tour.paused = false; document.body.classList.remove('touring'); U.uHead.value = -1; U.uPathDim.value = 1;
  if (camMode === 'follow') { camMode = 'orbit'; controls.enabled = true; }
  if (toOverview) closeCard(); updateTourUI(); updateBars(); updateBack();
}
function togglePause() {
  if (!tour.on) return; tour.paused = !tour.paused;
  if (tour.paused) { if (camMode === 'follow') { camMode = 'orbit'; controls.enabled = true; } }
  else if (!RM) { readRig(); camMode = 'follow'; controls.enabled = false; for (const k in vel) vel[k] = 0; }
  updateTourUI(); renderTourStatus();
}
function tourStep(dt) {
  if (!tour.on || tour.paused || tour.done) return;
  tour.t += dt;
  if (tour.phase === 'move') {
    const L = LEGS[tour.i], u = Math.min(1, tour.t / legDur(tour.i)); tour.head = L.d0 + L.len * easeIO(u);
    if (u >= 1) { tour.phase = 'dwell'; tour.t = 0; tour.visited.add(tour.i); sel = tour.i; U.uSel.value = tour.i; renderCard(); updateBars(); }
  } else if (tour.t >= DWELL) {
    if (tour.i >= N - 1) { tour.done = true; renderTourStatus(); updateTourUI(); return; }
    tour.i++; tour.phase = 'move'; tour.t = 0; sel = tour.i; U.uSel.value = tour.i; renderCard(); updateBars();
  }
  U.uHead.value = tour.head;
  if (!RM) {
    const fp = framePose(tour.i);
    if (tour.phase === 'move') { const p = pointAt(tour.head); follow = { tx: p[0], ty: 1.5, tz: p[1], dist: 150, elev: 0.52, az: fp.az, st: 0.75 }; }
    else follow = Object.assign({ st: 0.8 }, fp);
  }
  renderTourStatus(); updateTourUI();
}
function updateTourUI() {
  $('pause').innerHTML = (tour.paused ? '<svg viewBox="0 0 14 14" fill="currentColor"><path d="M4 2.5v9l7.5-4.5z"/></svg>' : '<svg viewBox="0 0 14 14" fill="currentColor"><rect x="3" y="2.5" width="2.8" height="9" rx=".6"/><rect x="8.2" y="2.5" width="2.8" height="9" rx=".6"/></svg>') + `<span>${tour.paused ? t('resume') : t('pause')}</span>`;
  $('stop').innerHTML = `<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 3l8 8M11 3l-8 8"/></svg><span>${t('stop')}</span>`;
  $('prog').textContent = tour.on ? t('progTour', { i: Math.min(N, tour.i + 1), n: N }) : t('progOver', { n: N, km: (routeLen / 1000).toFixed(1) });
  renderHud();
}

/* ---------------- static UI text ---------------- */
function renderHud() {
  const [bt, ap] = bestTime();
  const nm = NL.pick.name.split(':'); const prog = tour.on ? ` <b>${Math.min(N, tour.i + 1)}/${N}</b>` : '';
  $('hud').innerHTML = `<span>${nm[0].trim()} · ${nm.slice(1).join(':').trim().replace('&', lang === 'es' ? 'y' : '&')}</span><span>${fmtDay(STORM.date)} · <b class="hh">${NL.pick.hail_in.toFixed(2)}″</b></span><span><b>${N}</b> ${lang === 'es' ? 'puertas' : 'doors'}${prog}</span><span><b>${bt}</b> ${ap}</span>`;
}
function renderBars() {
  const bars = $('bars'); const rmax = Math.max(...HOMES.map(h => h.roof)), rmin = Math.min(...HOMES.map(h => h.roof));
  bars.innerHTML = HS.map(s => `<button class="bar" data-i="${s.i}" style="--c:${specCSS(s.hailT)};--h:${(22 + (s.h.roof - rmin) / (rmax - rmin) * 36).toFixed(0)}px" aria-label="${t('door')} ${s.i + 1}: ${s.h.addr}, ${s.h.hail.toFixed(2)}″, ${s.h.roof} ${t('yrs')}"><i></i><span>${s.i + 1}</span></button>`).join('');
  bars.querySelectorAll('.bar').forEach(b => {
    const i = +b.dataset.i;
    b.addEventListener('mouseenter', () => setHover(i)); b.addEventListener('mouseleave', () => setHover(-1));
    b.addEventListener('focus', () => setHover(i)); b.addEventListener('blur', () => setHover(-1));
    b.addEventListener('click', () => goDoor(i));
  });
  updateBars();
}
function updateBars() { $('bars').querySelectorAll('.bar').forEach(b => { const i = +b.dataset.i; b.classList.toggle('on', i === sel); b.classList.toggle('v', tour.visited.has(i)); }); }
function updateBack() { $('backT').textContent = (sel >= 0 || tour.on) ? t('overview') : t('zones'); }
function renderStatic() {
  document.documentElement.lang = lang; document.documentElement.dataset.lang = lang;
  document.querySelectorAll('[data-lang]').forEach(b => { if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', b.dataset.lang === lang); });
  const nm = NL.pick.name.split(':'); const streets = nm.slice(1).join(':').trim();
  $('zEyebrow').textContent = t('eyebrow', { z: NL.zones.length });
  const [s1, s2] = streets.split('&').map(x => x.trim());
  $('zTitle').innerHTML = s2 ? `${s1} <span class="amp">${lang === 'es' ? 'y' : '&amp;'}</span> ${s2}` : streets;
  $('zTown').textContent = t('town');
  const [bt, ap] = bestTime();
  $('zStats').innerHTML = [
    [t('stormDay'), fmtDay(STORM.date, true), t('daysAgo', { d: STORM.days })],
    [t('hailHere'), `<span class="spec-t">${NL.pick.hail_in.toFixed(2)}″</span>`, t('radar')],
    [t('doors'), `${N}`, t('walkLen', { km: (routeLen / 1000).toFixed(1) })],
    [t('best'), `${bt}<small>${ap}</small>`, t('today')],
  ].map(([l, v, s]) => `<div class="stat"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
  $('zWhy').textContent = NL.pick.why[lang];
  $('startT').textContent = t('start');
  $('startN').innerHTML = `${t('doorsN', { n: N })}<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h9.5M8.5 4l4 4-4 4"/></svg>`;
  const pn = NL.walk.pn || [];
  $('parkT').textContent = t('park', { a: pn[0] || '', b: pn[1] || '' });
  $('parkM').textContent = t('toDoor1', { m: Math.round(LEGS[0].len) });
  $('sampleT').textContent = t('sample'); $('sample').title = t('sampleTip');
  $('legend').innerHTML = `<div class="t">${t('legendT')}</div><div class="bar"></div><div class="tk"><span>${HMIN.toFixed(2)}″</span><span>1.50</span><span>1.57</span><span>1.63</span><span>${HMAX.toFixed(2)}″</span></div><div class="s">${t('legendS')}</div>`;
  $('stripT').textContent = t('stripT'); $('stripS').textContent = t('stripS');
  $('hint').innerHTML = `${t('hint')}<span class="src">${t('src')}</span>`;
  renderBars(); updateTourUI(); updateBack(); renderCard(); if (hoverI >= 0) renderTag(hoverI);
}
function renderTag(i) {
  const s = HS[i]; tagEl.style.setProperty('--c', specCSS(s.hailT));
  tagEl.querySelector('.in').innerHTML = `<div class="k">${t('door')} ${i + 1} · ${t('sampleHome')}</div><div class="a">${s.h.addr}</div><div class="m"><em>${s.h.hail.toFixed(2)}″</em> ${t('tagHail')} · ${s.h.roof} ${t('tagRoof')}</div>`;
}
function setHover(i) {
  if (i === hoverI) return; hoverI = i;
  pins.forEach((p, k) => p.classList.toggle('hov', k === i));
  if (i >= 0) { renderTag(i); tagEl.classList.add('on'); canvas.style.cursor = 'pointer'; } else { tagEl.classList.remove('on'); canvas.style.cursor = ''; }
}
function goDoor(i) {
  if (tour.on) { tour.paused = true; if (camMode === 'follow') { camMode = 'orbit'; controls.enabled = true; } tour.i = i; tour.phase = 'dwell'; tour.t = 0; tour.head = doorDist[i]; U.uHead.value = tour.head; tour.visited.add(i); updateTourUI(); }
  openCard(i);
}

/* ---------------- input ---------------- */
const ray = new THREE.Raycaster(); const mouse = new THREE.Vector2(); let mouseDirty = false, downAt = null;
canvas.addEventListener('pointermove', e => { mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); mouseDirty = true; });
canvas.addEventListener('pointerleave', () => { mouseDirty = false; setHover(-1); });
canvas.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', e => { if (!downAt) return; const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]); downAt = null; if (moved < 5) { const i = pick(); if (i >= 0) goDoor(i); } });
controls.addEventListener('start', () => { if (camMode === 'tween') { camMode = 'orbit'; tw = null; } if (tour.on && !tour.paused) togglePause(); });
function pick() {
  ray.setFromCamera(mouse, camera); const o = ray.ray.origin, d = ray.ray.direction; let best = -1, bt = Infinity;
  HS.forEach(s => { // ray vs the house's local box
    const c = Math.cos(s.th), sn = Math.sin(s.th); const ox = o.x - s.c[0], oz = o.z - s.c[1];
    const lo = [ox * c - oz * sn, o.y, ox * sn + oz * c], ld = [d.x * c - d.z * sn, d.y, d.x * sn + d.z * c];
    const mn = [-s.geo.hw - 1, 0, -s.geo.hd - 1], mx = [s.geo.hw + 1, s.geo.H + 1.5, s.geo.hd + 2.5];
    let t0 = -Infinity, t1 = Infinity;
    for (let k = 0; k < 3; k++) { if (Math.abs(ld[k]) < 1e-9) { if (lo[k] < mn[k] || lo[k] > mx[k]) { t0 = Infinity; break; } continue; } let a = (mn[k] - lo[k]) / ld[k], b = (mx[k] - lo[k]) / ld[k]; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
    if (t0 <= t1 && t1 > 0 && t0 < bt) { bt = t0; best = s.i; }
  });
  return best;
}
pins.forEach((p, i) => { p.addEventListener('mouseenter', () => setHover(i)); p.addEventListener('mouseleave', () => setHover(-1)); p.addEventListener('click', () => goDoor(i)); });
$('back').addEventListener('click', () => { if (tour.on) stopTour(true); else if (sel >= 0) closeCard(); else location.href = '../index.html'; });
$('cClose').addEventListener('click', () => { if (tour.on) stopTour(true); else closeCard(); });
$('cPrev').addEventListener('click', () => { if (sel > 0) goDoor(sel - 1); });
$('cNext').addEventListener('click', () => { if (sel < N - 1) goDoor(sel + 1); });
$('start').addEventListener('click', () => startTour(0));
$('pause').addEventListener('click', togglePause);
$('stop').addEventListener('click', () => stopTour(true));
document.querySelectorAll('.seg [data-lang]').forEach(b => b.addEventListener('click', () => { lang = b.dataset.lang; renderStatic(); }));
addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (tour.on) stopTour(true); else if (sel >= 0) closeCard(); }
  else if (e.key === 'ArrowRight' && sel >= 0) { e.preventDefault(); if (sel < N - 1) goDoor(sel + 1); }
  else if (e.key === 'ArrowLeft' && sel >= 0) { e.preventDefault(); if (sel > 0) goDoor(sel - 1); }
  else if ((e.key === ' ' || e.code === 'Space') && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); if (tour.on) togglePause(); else startTour(0); }
});

/* ---------------- resize ---------------- */
function resize() {
  const W = innerWidth, H = innerHeight;
  renderer.setSize(W, H, false); composer.setPixelRatio(PR); composer.setSize(W, H);
  camera.aspect = W / H; voGoal(); vo.x = vo.gx; vo.y = vo.gy; applyVO(); camera.updateProjectionMatrix();
  const v = new THREE.Vector2(); renderer.getDrawingBufferSize(v); U.uRes.value.copy(v);
}
addEventListener('resize', resize);

/* ---------------- boot ---------------- */
renderStatic();
resize();
applyRig();
if (CALM) {
  document.body.classList.add('ready'); pins.forEach(p => p.classList.remove('hide'));
  if (HOUSE_Q) { openCard(HOUSE_Q - 1, { fly: false }); Object.assign(rig, framePose(HOUSE_Q - 1)); applyRig(); }
  voGoal(); vo.x = vo.gx; vo.y = vo.gy; applyVO();
} else { camMode = 'intro'; controls.enabled = false; }

const clock = { last: performance.now(), t0: performance.now() };
function introUpdate(now) {
  introT = (now - clock.t0) / 1000; const T = introT;
  const k = (a, b) => Math.max(0, Math.min(1, (T - a) / (b - a)));
  U.uFade.value = 0.35 + 0.65 * easeIO(k(0, 0.9));
  U.uReveal.value = 30 + 1100 * (1 - Math.pow(1 - k(0.25, 2.4), 3)); streetReveal = k(0.8, 2.2);
  HS.forEach((s, i) => { reveal[i] = easeIO(k(0.45 + i * 0.045, 1.45 + i * 0.045)); });
  U.uDraw.value = routeLen * easeIO(k(1.3, 3.9)) + (T > 3.95 ? 1e9 : 0);
  const e = easeIO(k(0, 4.3)); for (const key of ['tx', 'ty', 'tz', 'dist', 'elev']) rig[key] = INTRO[key] + (OVER[key] - INTRO[key]) * e; rig.az = INTRO.az + wrapA(OVER.az - INTRO.az) * e; applyRig();
  HS.forEach((s, i) => pins[i].classList.toggle('hide', U.uDraw.value < doorDist[i] - 1));
  if (T > 2.9 && !ready) { ready = true; document.body.classList.add('ready'); }
  if (T >= 4.3) { camMode = 'orbit'; controls.enabled = true; U.uDraw.value = 1e9; pins.forEach(p => p.classList.remove('hide')); if (HOUSE_Q) openCard(HOUSE_Q - 1); }
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - clock.last) / 1000); clock.last = now;
  U.uTime.value = STILL ? 7.3 : 7.3 + (now - clock.t0) / 1000 * (RM ? 0 : 1);
  if (camMode === 'intro') introUpdate(now); else updateCamera(dt);
  tourStep(dt);
  // hover / focus / reveal -> per-house uniform
  if (mouseDirty && camMode !== 'intro') { mouseDirty = false; setHover(pick()); }
  const dimOthers = sel >= 0 || tour.on;
  for (let i = 0; i < N; i++) {
    const tgtF = !dimOthers ? 1 : (i === sel ? 1.3 : 0.3);
    focus[i] += (tgtF - focus[i]) * (CALM ? 1 : 1 - Math.exp(-dt * 6));
    hov[i] += ((i === hoverI ? 1 : 0) - hov[i]) * (CALM ? 1 : 1 - Math.exp(-dt * 10));
    const s = HS[i]; const ry = reveal[i] >= 1 ? 999 : reveal[i] * (s.geo.H + 1.2);
    U.uHouse.value[i].set(s.hailT, ry, focus[i], hov[i]);
    U.uHomes.value[i].w = (0.3 + 0.7 * Math.min(1, reveal[i] * 1.2)) * (0.55 + 0.45 * focus[i] + 0.6 * hov[i]) * (reveal[i] > 0 ? 1 : 0);
    pins[i].classList.toggle('dim', dimOthers && i !== sel && i !== hoverI);
    pins[i].classList.toggle('sel', i === sel);
  }
  // view offset + bloom + line width follow the camera distance (close-ups never blow out)
  const kv = CALM ? 1 : 1 - Math.exp(-dt * 5); vo.x += (vo.gx - vo.x) * kv; vo.y += (vo.gy - vo.y) * kv; applyVO();
  const cd = camera.position.distanceTo(controls.target);
  bloom.strength = 0.42 + 0.4 * Math.min(1, Math.max(0, (cd - 60) / 300));
  U.uLineW.value = PR * (1.3 + 0.9 * (1 - Math.min(1, Math.max(0, (cd - 50) / 320))));
  SKY.position.copy(camera.position);
  composer.render(dt);
  placeLabels();
}
requestAnimationFrame(frame);
window.__holo = { HS, LEGS, routeLen, openCard, closeCard, startTour, stopTour };
