/* HailGL: storm graphics for Claude's Aldaba. Raw WebGL (WebGL2, WebGL1 fallback, Canvas2D fallback), no libraries.
 *
 *   var kit = HailGL.create(canvasOrGl, {dpr, theme:'dark'|'light'|{...colors}});
 *   kit.field.setField(HailGL.fieldFromStorms({storms, areas, bounds, res, project}));
 *   kit.field.draw(m, {t, opacity, reveal, contours, glow, dim});
 *   kit.hail.spawn({count, sampler: HailGL.sampler(field), fall:{height, speed}, dur});  kit.hail.draw(m, {t});
 *   kit.rings.add(x, y, {t0, color, size, life});  kit.rings.draw(m, t);
 *
 * World units are the caller's. m = column-major mat3 world -> clip (affine or projective).
 * Field texels are packed as RGBA8: R/G = hail inches (16-bit hi/lo, linear so hardware filtering stays exact),
 * B = arrival 0..1 (reveal), A = wide blur of the field (glow). Nothing here throws into the caller.
 */
(function (root) {
  'use strict';

  var HailGL = { version: '1.0.0' };
  var EMPTY = {};
  var warned = {};
  function warnOnce(key, msg, e) {
    if (warned[key]) return;
    warned[key] = 1;
    try { console.warn('[HailGL] ' + msg + (e ? ': ' + ((e && e.message) || e) : '')); } catch (_) { /* no console */ }
  }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function num(v, d) { return typeof v === 'number' && v === v ? v : d; }
  function capDpr(d) {
    var r = num(d, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    return clamp(r, 1, 2);
  }

  /* ------------------------------------------------------------------ colors */
  var THEMES = {
    dark: { gold: '#f2c14e', orange: '#f5883a', red: '#ff4f5a', hot: '#fff1d6', ice: '#e6f0ff', ring: '#f5883a',
      glow: 1, fill: 1, contours: 1, ink: 0 },
    light: { gold: '#a8780a', orange: '#c4561a', red: '#c21f33', hot: '#6b2400', ice: '#44556b', ring: '#c4561a',
      glow: 0, fill: 1.35, contours: 1.15, ink: 1 }
  };
  HailGL.themes = THEMES;

  function parseColor(c, out, o) {
    o = o || 0;
    if (typeof c === 'string') {
      var s = c.charAt(0) === '#' ? c.slice(1) : c;
      if (s.length === 3) s = s.charAt(0) + s.charAt(0) + s.charAt(1) + s.charAt(1) + s.charAt(2) + s.charAt(2);
      var n = parseInt(s.slice(0, 6), 16);
      if (n === n) {
        out[o] = ((n >> 16) & 255) / 255; out[o + 1] = ((n >> 8) & 255) / 255; out[o + 2] = (n & 255) / 255;
      }
    } else if (c && c.length >= 3) {
      var k = (c[0] > 1 || c[1] > 1 || c[2] > 1) ? 1 / 255 : 1;
      out[o] = c[0] * k; out[o + 1] = c[1] * k; out[o + 2] = c[2] * k;
    }
    return out;
  }

  function makePalette() {
    return { gold: new Float32Array(3), orange: new Float32Array(3), red: new Float32Array(3), hot: new Float32Array(3),
      ice: new Float32Array(3), ring: new Float32Array(3), stops: new Float32Array([0.5, 1, 1.5, 2]),
      glow: 1, fill: 1, contours: 1, ink: 0 };
  }
  function applyTheme(pal, theme) {
    var base = THEMES.dark, t = theme;
    if (typeof t === 'string') t = THEMES[t] || THEMES.dark;
    t = t || EMPTY;
    if (t.base && THEMES[t.base]) base = THEMES[t.base];
    else if (t.ink === 1 || t.ink === true) base = THEMES.light;
    var keys = ['gold', 'orange', 'red', 'hot', 'ice', 'ring'];
    for (var i = 0; i < keys.length; i++) parseColor(t[keys[i]] != null ? t[keys[i]] : base[keys[i]], pal[keys[i]]);
    pal.glow = num(t.glow, base.glow); pal.fill = num(t.fill, base.fill);
    pal.contours = num(t.contours, base.contours); pal.ink = t.ink != null ? (t.ink ? 1 : 0) : base.ink;
    if (t.stops && t.stops.length === 4) for (i = 0; i < 4; i++) pal.stops[i] = t.stops[i];
    return pal;
  }
  function rampInto(pal, v, out) {
    var s = pal.stops, a = sstep(s[1], s[2], v), b = sstep(s[2], s[3], v);
    for (var k = 0; k < 3; k++) {
      var c = pal.gold[k] + (pal.orange[k] - pal.gold[k]) * a;
      out[k] = c + (pal.red[k] - c) * b;
    }
    return out;
  }
  function cssRGB(c, a) {
    return 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ',' + (a == null ? 1 : +a.toFixed(3)) + ')';
  }
  /* rampColor(v, theme?) -> css color for legends / labels. legendGradient(theme?, from, to) -> css linear-gradient. */
  HailGL.rampColor = function (v, theme, alpha) {
    var pal = applyTheme(makePalette(), theme);
    return cssRGB(rampInto(pal, v, [0, 0, 0]), alpha == null ? 1 : alpha);
  };
  HailGL.legendGradient = function (theme, from, to) {
    var pal = applyTheme(makePalette(), theme), lo = num(from, 0.5), hi = num(to, 2.5), parts = [];
    for (var i = 0; i <= 10; i++) {
      var v = lo + (hi - lo) * i / 10, a = 0.25 + 0.75 * sstep(pal.stops[0], pal.stops[1], v);
      parts.push(cssRGB(rampInto(pal, v, [0, 0, 0]), a) + ' ' + (i * 10) + '%');
    }
    return 'linear-gradient(90deg,' + parts.join(',') + ')';
  };
  /* camera(cx, cy, pxPerUnit, cssW, cssH, out?) -> mat3 world -> clip, world y grows downward on screen. */
  HailGL.camera = function (cx, cy, k, w, h, out) {
    var m = out || new Float32Array(9), a = 2 * k / w, d = -2 * k / h;
    m[0] = a; m[1] = 0; m[2] = 0; m[3] = 0; m[4] = d; m[5] = 0; m[6] = -cx * a; m[7] = -cy * d; m[8] = 1;
    return m;
  };

  /* ------------------------------------------------------------------ noise (deterministic, world-anchored) */
  function hash2(ix, iy) {
    var h = (Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h & 0xffff) / 32767.5 - 1;
  }
  function vnoise(x, y) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    var ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10), uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    var a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }
  function fbm(x, y) {
    return 0.5 * vnoise(x, y) + 0.25 * vnoise(x * 2.03 + 17.1, y * 2.03 - 9.2) + 0.125 * vnoise(x * 4.07 - 3.3, y * 4.07 + 7.7);
  }
  function rng(seed) {
    var s = (seed >>> 0) || 0x9e3779b9;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ------------------------------------------------------------------ field builder */
  function emptyField() {
    return { x0: 0, y0: 0, x1: 1, y1: 1, w: 2, h: 2, data: new Float32Array(4), arrival: new Float32Array(4), peak: 0, mpu: 1 };
  }
  function autoBounds(storms, areas, pad) {
    var b = [180, 90, -180, -90];
    function ext(p) { if (p[0] < b[0]) b[0] = p[0]; if (p[1] < b[1]) b[1] = p[1]; if (p[0] > b[2]) b[2] = p[0]; if (p[1] > b[3]) b[3] = p[1]; }
    for (var i = 0; i < storms.length; i++) (storms[i].path || []).forEach(ext);
    for (i = 0; i < areas.length; i++) (areas[i].ring || []).forEach(ext);
    if (b[0] > b[2]) return [-1, -1, 1, 1];
    return [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad];
  }
  // bounded C1 blend of two surfaces: never exceeds max(a, b), so peaks (and labels) stay exact
  function smax(a, b, k) { return a + (b - a) * sstep(-k, k, b - a); }

  // Storm swath geometry in miles space. Paths jump between cells in the source data: split long jumps.
  function stormGeom(st, project, mpu, splitMi, idx) {
    var raw = st.path || [], pts = [];
    for (var i = 0; i < raw.length; i++) {
      var q = project(raw[i]);
      if (!q || !(q[0] === q[0]) || !(q[1] === q[1])) continue;
      var x = q[0] * mpu, y = q[1] * mpu, last = pts[pts.length - 1];
      if (last && Math.abs(last[0] - x) + Math.abs(last[1] - y) < 0.05) continue;
      pts.push([x, y]);
    }
    if (!pts.length) return null;
    var max = num(st.max, 1), halfW = clamp(2.0 + 1.2 * max, 2.8, 4.8);
    var runs = [], cur = [pts[0]], L = 0;
    for (i = 1; i < pts.length; i++) {
      var dl = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (dl > splitMi) { runs.push(cur); cur = [pts[i]]; } else cur.push(pts[i]);
    }
    runs.push(cur);
    var segs = [], bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
    for (var r = 0; r < runs.length; r++) {
      var run = runs[r];
      for (i = 0; i < run.length; i++) {
        bx0 = Math.min(bx0, run[i][0]); by0 = Math.min(by0, run[i][1]); bx1 = Math.max(bx1, run[i][0]); by1 = Math.max(by1, run[i][1]);
      }
      if (run.length === 1) { segs.push({ ax: run[0][0], ay: run[0][1], dx: 0, dy: 0, len: 0, s0: L, first: true, last: true, x0: run[0][0], y0: run[0][1], x1: run[0][0], y1: run[0][1] }); continue; }
      for (i = 0; i < run.length - 1; i++) {
        var ax = run[i][0], ay = run[i][1], dx = run[i + 1][0] - ax, dy = run[i + 1][1] - ay, len = Math.hypot(dx, dy);
        segs.push({ ax: ax, ay: ay, dx: dx, dy: dy, len: len, s0: L, first: i === 0, last: i === run.length - 2,
          x0: Math.min(ax, ax + dx), y0: Math.min(ay, ay + dy), x1: Math.max(ax, ax + dx), y1: Math.max(ay, ay + dy) });
        L += len;
      }
    }
    return { segs: segs, L: L, halfW: halfW, reach: halfW * 2.6 + 2, max: max, seed: (idx * 7.31) % 50, bbox: [bx0, by0, bx1, by1], aMin: 0, aMax: 1, id: st.id, date: st.date };
  }
  // Evaluate a swath at a point: max over segments of each segment's own profile. Continuous even when the
  // source path zigzags between cells (a nearest-segment "s" would jump and speckle the contours).
  var EV = { v: 0, a: 0, d: 0 }, SD = new Float64Array(256), SS = new Float64Array(256);
  function segDist(sg, px, py, k) {
    var ex = px - sg.ax, ey = py - sg.ay, d2, s;
    if (sg.len < 1e-6) { d2 = ex * ex + ey * ey; s = sg.s0; }
    else {
      var t = (ex * sg.dx + ey * sg.dy) / (sg.len * sg.len);
      if ((t < 0 && sg.first) || (t > 1 && sg.last)) { // tapered caps: elliptical, shorter than the swath is wide
        var lat = (ex * sg.dy - ey * sg.dx) / sg.len, over = (t < 0 ? -t : t - 1) * sg.len * 1.55;
        d2 = lat * lat + over * over; s = sg.s0 + t * sg.len;
      } else {
        var tc = t < 0 ? 0 : t > 1 ? 1 : t, cx = ex - tc * sg.dx, cy = ey - tc * sg.dy;
        d2 = cx * cx + cy * cy; s = sg.s0 + tc * sg.len;
      }
    }
    SD[k] = Math.sqrt(d2); SS[k] = s;
  }
  function stormEval(g, px, py) {
    var segs = g.segs, n = Math.min(segs.length, 256), dmin = 1e18, k, R = g.reach;
    for (k = 0; k < n; k++) {
      var sg = segs[k];
      if (px < sg.x0 - R || px > sg.x1 + R || py < sg.y0 - R || py > sg.y1 + R) { SD[k] = 1e18; continue; }
      segDist(sg, px, py, k); if (SD[k] < dmin) dmin = SD[k];
    }
    EV.d = dmin; EV.v = 0; EV.a = 0;
    if (dmin > g.reach) return EV;
    var lim = dmin + 1.25 * g.halfW, best = -1;
    for (k = 0; k < n; k++) {
      if (SD[k] > lim) continue;
      var v = stormValue(g, SD[k], SS[k]);
      if (v > best) { best = v; EV.v = v; EV.a = stormArrivalRaw(g, SD[k], SS[k]); }
    }
    return EV;
  }
  function stormValue(g, d, s) {
    var prof = Math.exp(-Math.LN2 * Math.pow(d / g.halfW, 2.2));
    var sn = g.L > 0.3 ? clamp(s / g.L, 0, 1) : 0.5;
    var env = 0.64 + 0.36 * Math.pow(Math.sin(Math.PI * sn), 0.7);
    var pulse = 1 + 0.16 * vnoise(s / 4.5 + g.seed, g.seed * 1.7);
    return prof * env * pulse;
  }
  function stormArrivalRaw(g, d, s) {
    if (g.L <= 0.3) return d;
    return s + 0.45 * d * d / g.halfW; // core arrives first: a gentle bow-shaped front
  }
  // Signed distance (miles) to a closed ring, positive inside.
  function ringSD(xs, ys, px, py) {
    var n = xs.length, inside = false, best = 1e18;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      var xi = xs[i], yi = ys[i], xj = xs[j], yj = ys[j];
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
      var dx = xi - xj, dy = yi - yj, l2 = dx * dx + dy * dy, t = l2 > 0 ? ((px - xj) * dx + (py - yj) * dy) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      var cx = px - (xj + t * dx), cy = py - (yj + t * dy), d2 = cx * cx + cy * cy;
      if (d2 < best) best = d2;
    }
    var d = Math.sqrt(best);
    return inside ? d : -d;
  }

  /* fieldFromStorms({storms, areas, bounds:[w,s,e,n], res, project, arrival:'path'|'season', splitMi})
     -> {x0,y0,x1,y1,w,h,data,arrival,peak,mpu}. data = hail inches per texel (row 0 = y0), arrival 0..1. */
  HailGL.fieldFromStorms = function (o) {
    try { return buildField(o || EMPTY); } catch (e) { warnOnce('ffs', 'fieldFromStorms failed', e); return emptyField(); }
  };
  /* frontAt(field, reveal, stormId?, out?) -> [x, y, dirX, dirY] world position of the burn front on the storm's path
     for a reveal value (path arrival mode). Use it to park a storm marker / knock ring exactly on the front. */
  HailGL.frontAt = function (field, r, id, out) {
    out = out || [0, 0, 1, 0];
    try {
      var ps = (field && field.paths) || [], p = ps[0];
      for (var i = 0; i < ps.length; i++) if (id != null && ps[i].id === id) p = ps[i];
      if (!p || !p.segs.length) return out;
      var s = clamp(p.a0 + clamp(r, 0, 1) * (p.a1 - p.a0), 0, p.L), sg = p.segs[0];
      for (i = 0; i < p.segs.length; i++) { sg = p.segs[i]; if (s <= sg.s0 + sg.len) break; }
      var f = sg.len > 0 ? clamp((s - sg.s0) / sg.len, 0, 1) : 0, inv = 1 / p.mpu;
      out[0] = (sg.ax + sg.dx * f) * inv; out[1] = (sg.ay + sg.dy * f) * inv;
      if (sg.len > 0) { out[2] = sg.dx / sg.len; out[3] = sg.dy / sg.len; }
    } catch (e) { warnOnce('frontAt', 'frontAt failed', e); }
    return out;
  };

  function buildField(o) {
    var project = o.project || function (p) { return p; };
    var storms = o.storms || [], areas = o.areas || [];
    var res = clamp(Math.round(num(o.res, 512)), 16, 4096);
    var bnd = o.bounds || autoBounds(storms, areas, 0.2);
    var W = bnd[0], S = bnd[1], E = bnd[2], N = bnd[3];
    var cs = [project([W, N]), project([E, N]), project([W, S]), project([E, S])];
    var x0 = Math.min(cs[0][0], cs[1][0], cs[2][0], cs[3][0]), x1 = Math.max(cs[0][0], cs[1][0], cs[2][0], cs[3][0]);
    var y0 = Math.min(cs[0][1], cs[1][1], cs[2][1], cs[3][1]), y1 = Math.max(cs[0][1], cs[1][1], cs[2][1], cs[3][1]);
    var mlon = (W + E) / 2, mlat = (S + N) / 2, pa = project([mlon, mlat - 0.05]), pb = project([mlon, mlat + 0.05]);
    var mpu = 6.9171 / (Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) || 1); // miles per world unit
    var spanX = x1 - x0, spanY = y1 - y0, w, h;
    if (spanX >= spanY) { w = res; h = Math.max(2, Math.round(res * spanY / spanX)); }
    else { h = res; w = Math.max(2, Math.round(res * spanX / spanY)); }
    var n = w * h, data = new Float32Array(n), arrival = new Float32Array(n);
    var tmp = new Float32Array(n), tmpA = new Float32Array(n);
    var txm = spanX / w * mpu, tym = spanY / h * mpu, gx0 = x0 * mpu, gy0 = y0 * mpu; // texel size + origin in miles
    // shared domain warp + fine amplitude noise on a 0.5 mi lattice anchored in world miles (separate builds line
    // up), bilinearly interpolated per texel: the noise is low frequency, so this is exact enough and ~10x cheaper
    var WX = new Float32Array(n), WY = new Float32Array(n), AN = new Float32Array(n), have = new Uint8Array(n);
    var LS = 0.5, lx0 = Math.floor(gx0 / LS) - 1, ly0 = Math.floor(gy0 / LS) - 1;
    var lw = Math.ceil((gx0 + spanX * mpu) / LS) - lx0 + 3, lh = Math.ceil((gy0 + spanY * mpu) / LS) - ly0 + 3;
    var LX = new Float32Array(lw * lh), LY = new Float32Array(lw * lh), LA = new Float32Array(lw * lh), lhave = new Uint8Array(lw * lh);
    function lat(ix, iy) {
      var j = iy * lw + ix;
      if (!lhave[j]) {
        var qx = (ix + lx0) * LS, qy = (iy + ly0) * LS;
        LX[j] = 1.35 * fbm(qx / 7.5 + 11.3, qy / 7.5 - 4.1);
        LY[j] = 1.35 * fbm(qx / 7.5 - 21.7, qy / 7.5 + 8.9);
        LA[j] = fbm(qx / 2.6 + 3.1, qy / 2.6 + 5.3);
        lhave[j] = 1;
      }
      return j;
    }
    function warpAt(i, px, py) {
      if (have[i]) return;
      var fx = px / LS - lx0, fy = py / LS - ly0, ix = Math.floor(fx), iy = Math.floor(fy);
      fx -= ix; fy -= iy;
      var a = lat(ix, iy), b = lat(ix + 1, iy), c = lat(ix, iy + 1), d = lat(ix + 1, iy + 1);
      var w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      WX[i] = LX[a] * w00 + LX[b] * w10 + LX[c] * w01 + LX[d] * w11;
      WY[i] = LY[a] * w00 + LY[b] * w10 + LY[c] * w01 + LY[d] * w11;
      AN[i] = LA[a] * w00 + LA[b] * w10 + LA[c] * w01 + LA[d] * w11;
      have[i] = 1;
    }
    var splitMi = num(o.splitMi, 40), seasonal = o.arrival === 'season';
    var order = storms.map(function (s, i) { return { i: i, d: String(s.date || '') }; })
      .sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
    var rank = {}, nS = Math.max(1, storms.length);
    order.forEach(function (r, k) { rank[r.i] = k; });
    var geoms = {}, peak = 0, paths = [];

    function commit(ix0, iy0, ix1, iy1, amin, amax, rk) {
      for (var iy = iy0; iy <= iy1; iy++) for (var ix = ix0; ix <= ix1; ix++) {
        var i = iy * w + ix, v = tmp[i];
        if (v <= 0.001) continue;
        var a = amax > amin ? clamp((tmpA[i] - amin) / (amax - amin), 0, 1) : 0;
        if (rk >= 0) a = (rk + a) / nS;
        if (v > data[i]) arrival[i] = a;
        else if (data[i] - v < 0.12 && a < arrival[i]) arrival[i] = a;
        data[i] = smax(data[i], v, 0.1);
        tmp[i] = 0;
      }
    }

    for (var si = 0; si < storms.length; si++) {
      var g = stormGeom(storms[si], project, mpu, splitMi, si);
      if (!g) continue;
      if (storms[si].id) geoms[storms[si].id] = g;
      var reach = g.reach;
      var ix0 = clamp(Math.floor((g.bbox[0] - reach - gx0) / txm), 0, w - 1), ix1 = clamp(Math.ceil((g.bbox[2] + reach - gx0) / txm), 0, w - 1);
      var iy0 = clamp(Math.floor((g.bbox[1] - reach - gy0) / tym), 0, h - 1), iy1 = clamp(Math.ceil((g.bbox[3] + reach - gy0) / tym), 0, h - 1);
      if (ix1 <= ix0 || iy1 <= iy0) continue;
      var pk = 0, amin = 1e9, amax = -1e9;
      for (var iy = iy0; iy <= iy1; iy++) {
        var py = gy0 + (iy + 0.5) * tym;
        for (var ix = ix0; ix <= ix1; ix++) {
          var px = gx0 + (ix + 0.5) * txm, i = iy * w + ix;
          warpAt(i, px, py);
          var ev = stormEval(g, px + WX[i], py + WY[i]);
          if (ev.v <= 0) { tmp[i] = 0; continue; }
          var v = ev.v * (1 + 0.04 * AN[i]);
          tmp[i] = v; tmpA[i] = ev.a;
          if (v > pk) pk = v;
        }
      }
      if (pk <= 0) continue;
      var scale = g.max / pk;
      for (iy = iy0; iy <= iy1; iy++) for (ix = ix0; ix <= ix1; ix++) {
        i = iy * w + ix;
        if (tmp[i] <= 0) continue;
        tmp[i] *= scale;
        if (tmp[i] > 0.3 * g.max) { if (tmpA[i] < amin) amin = tmpA[i]; if (tmpA[i] > amax) amax = tmpA[i]; }
      }
      g.aMin = amin; g.aMax = amax;
      paths.push({ id: g.id, date: g.date, max: g.max, L: g.L, a0: amin, a1: amax, segs: g.segs, mpu: mpu });
      commit(ix0, iy0, ix1, iy1, amin, amax, seasonal ? rank[si] : -1);
      if (g.max > peak) peak = g.max;
    }

    for (var ai = 0; ai < areas.length; ai++) {
      var ar = areas[ai], ring = ar.ring || [], hail = num(ar.hail, 0);
      if (ring.length < 3 || hail <= 0) continue;
      var xs = new Float64Array(ring.length), ys = new Float64Array(ring.length), bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9, area2 = 0;
      for (var k = 0; k < ring.length; k++) {
        var q = project(ring[k]);
        xs[k] = q[0] * mpu; ys[k] = q[1] * mpu;
        bx0 = Math.min(bx0, xs[k]); by0 = Math.min(by0, ys[k]); bx1 = Math.max(bx1, xs[k]); by1 = Math.max(by1, ys[k]);
      }
      for (k = 0; k < ring.length; k++) { var k2 = (k + 1) % ring.length; area2 += xs[k] * ys[k2] - xs[k2] * ys[k]; }
      var R = Math.max(0.8, Math.sqrt(Math.abs(area2) / 2 / Math.PI)), cxm = (bx0 + bx1) / 2, cym = (by0 + by1) / 2;
      var gs = ar.st && geoms[ar.st], reachA = 4.5;
      ix0 = clamp(Math.floor((bx0 - reachA - gx0) / txm), 0, w - 1); ix1 = clamp(Math.ceil((bx1 + reachA - gx0) / txm), 0, w - 1);
      iy0 = clamp(Math.floor((by0 - reachA - gy0) / tym), 0, h - 1); iy1 = clamp(Math.ceil((by1 + reachA - gy0) / tym), 0, h - 1);
      if (ix1 <= ix0 || iy1 <= iy0) continue;
      pk = 0;
      var aLo = gs ? gs.aMin : 0, aHi = gs ? gs.aMax : R * 1.6;
      for (iy = iy0; iy <= iy1; iy++) {
        py = gy0 + (iy + 0.5) * tym;
        for (ix = ix0; ix <= ix1; ix++) {
          px = gx0 + (ix + 0.5) * txm; i = iy * w + ix;
          warpAt(i, px, py);
          var wx = px + WX[i] * 0.6, wy = py + WY[i] * 0.6, sd = ringSD(xs, ys, wx, wy), kf;
          if (sd >= 0) kf = 0.6 + 0.4 * sstep(0, Math.max(1, R * 0.6), sd);
          else kf = 0.6 * Math.exp(-(sd / 1.7) * (sd / 1.7));
          if (kf < 0.02) { tmp[i] = 0; continue; }
          v = kf * (1 + 0.04 * AN[i]);
          tmp[i] = v;
          if (gs) { var eg = stormEval(gs, wx, wy); tmpA[i] = eg.v > 0 ? eg.a : gs.aMax; }
          else tmpA[i] = Math.hypot(wx - cxm, wy - cym);
          if (v > pk) pk = v;
        }
      }
      if (pk <= 0) continue;
      scale = hail / pk;
      for (iy = iy0; iy <= iy1; iy++) for (ix = ix0; ix <= ix1; ix++) { i = iy * w + ix; if (tmp[i] > 0) tmp[i] *= scale; }
      var rk = -1;
      if (seasonal) {
        rk = 0;
        for (k = 0; k < storms.length; k++) if (storms[k].id === ar.st) rk = rank[k];
      }
      commit(ix0, iy0, ix1, iy1, aLo, aHi, rk);
      if (hail > peak) peak = hail;
    }
    return { x0: x0, y0: y0, x1: x1, y1: y1, w: w, h: h, data: data, arrival: arrival, peak: peak, mpu: mpu, bounds: [W, S, E, N], paths: paths };
  }

  /* sampler(field, {min, gamma, seed, size:[lo,hi]}) -> () => [x, y, sizeIn, arrival]
     Weighted by hail size so stones fall where hail really fell, bigger where it was bigger. */
  HailGL.sampler = function (field, o) {
    o = o || EMPTY;
    try {
      var min = num(o.min, 0.6), gamma = num(o.gamma, 1.3), rnd = rng(num(o.seed, 7)), f = field;
      var n = f.w * f.h, cdf = new Float64Array(n), acc = 0, top = Math.max(min + 0.01, f.peak || 2.5);
      var lo = o.size ? o.size[0] : 0.45, hi = o.size ? o.size[1] : 1.02;
      for (var i = 0; i < n; i++) {
        var v = f.data[i];
        if (v > min) acc += Math.pow((v - min) / (top - min), gamma);
        cdf[i] = acc;
      }
      if (acc <= 0) return function () { return [f.x0, f.y0, 0, 0]; };
      return function () {
        var r = rnd() * acc, a = 0, b = n - 1;
        while (a < b) { var mid = (a + b) >> 1; if (cdf[mid] < r) a = mid + 1; else b = mid; }
        var tx = a % f.w, ty = (a / f.w) | 0;
        var x = f.x0 + (tx + rnd()) / f.w * (f.x1 - f.x0), y = f.y0 + (ty + rnd()) / f.h * (f.y1 - f.y0);
        var size = f.data[a] * (lo + (hi - lo) * Math.pow(rnd(), 0.55));
        return [x, y, size, f.arrival ? f.arrival[a] : rnd()];
      };
    } catch (e) {
      warnOnce('sampler', 'sampler failed', e);
      return function () { return [0, 0, 0, 0]; };
    }
  };

  /* Pack a field into RGBA8 (R/G hi-lo inches/4, B arrival, A glow). Glow = triple box blur (~gaussian). */
  function packField(f, o) {
    var w = f.w, h = f.h, n = w * h, out = new Uint8Array(n * 4), d = f.data, arr = f.arrival;
    var rad = Math.max(2, Math.round(num(o && o.glowRadius, 0.022 * Math.max(w, h))));
    var g = new Float32Array(n), t = new Float32Array(n), i;
    for (i = 0; i < n; i++) g[i] = d[i];
    for (var pass = 0; pass < 3; pass++) { boxH(g, t, w, h, rad); boxV(t, g, w, h, rad); }
    for (i = 0; i < n; i++) {
      var q = Math.round(clamp(d[i] / 4, 0, 1) * 65535);
      out[i * 4] = q >> 8; out[i * 4 + 1] = q & 255;
      out[i * 4 + 2] = arr ? Math.round(clamp(arr[i], 0, 1) * 255) : 0;
      out[i * 4 + 3] = Math.round(clamp(g[i] / 3, 0, 1) * 255);
    }
    // relief: central-difference gradient, normalized by the 95th percentile slope so any world units light the same
    var gx = new Float32Array(n), gy = new Float32Array(n), x, y, gmx = 1e-9, cnt = 0;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x;
      var ax = d[y * w + Math.min(x + 1, w - 1)] - d[y * w + Math.max(x - 1, 0)];
      var ay = d[Math.min(y + 1, h - 1) * w + x] - d[Math.max(y - 1, 0) * w + x];
      gx[i] = ax * 0.5; gy[i] = ay * 0.5;
      if (d[i] > 0.4) { var mg = Math.sqrt(ax * ax + ay * ay) * 0.5; if (mg > gmx) gmx = mg; cnt++; }
    }
    var hist = new Uint32Array(512), gmax = 1;
    if (cnt) {
      for (i = 0; i < n; i++) if (d[i] > 0.4) hist[Math.min(511, Math.floor(Math.sqrt(gx[i] * gx[i] + gy[i] * gy[i]) / gmx * 511))]++;
      for (var acc = 0, b = 0; b < 512; b++) { acc += hist[b]; if (acc >= cnt * 0.95) { gmax = Math.max((b + 1) / 511 * gmx, 1e-6); break; } }
    }
    var nrm = new Uint8Array(n * 4), k2 = 0.5 / (1.6 * gmax);
    for (i = 0; i < n; i++) {
      nrm[i * 4] = Math.round(clamp(0.5 + gx[i] * k2, 0, 1) * 255);
      nrm[i * 4 + 1] = Math.round(clamp(0.5 + gy[i] * k2, 0, 1) * 255);
      nrm[i * 4 + 2] = 0; nrm[i * 4 + 3] = 255;
    }
    return { rgba: out, nrm: nrm, gscale: 1.6 * gmax };
  }
  function boxH(src, dst, w, h, r) {
    var inv = 1 / (2 * r + 1);
    for (var y = 0; y < h; y++) {
      var row = y * w, acc = 0;
      for (var x = -r - 1; x < r; x++) acc += src[row + clamp(x, 0, w - 1)];
      for (x = 0; x < w; x++) {
        acc += src[row + Math.min(x + r, w - 1)] - src[row + Math.max(x - r - 1, 0)];
        dst[row + x] = acc * inv;
      }
    }
  }
  function boxV(src, dst, w, h, r) {
    var inv = 1 / (2 * r + 1);
    for (var x = 0; x < w; x++) {
      var acc = 0;
      for (var y = -r - 1; y < r; y++) acc += src[clamp(y, 0, h - 1) * w + x];
      for (y = 0; y < h; y++) {
        acc += src[Math.min(y + r, h - 1) * w + x] - src[Math.max(y - r - 1, 0) * w + x];
        dst[y * w + x] = acc * inv;
      }
    }
  }

  /* ------------------------------------------------------------------ shaders */
  function vsHead(gl2) {
    return gl2 ? '#version 300 es\n#define attribute in\n#define varying out\nprecision highp float;\n' : 'precision highp float;\n';
  }
  function fsHead(gl2, deriv) {
    var p = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
    if (gl2) return '#version 300 es\n' + p + '#define varying in\n#define texture2D texture\nout vec4 hglOut;\n#define gl_FragColor hglOut\n';
    return (deriv ? '#extension GL_OES_standard_derivatives : enable\n' : '') + p;
  }
  var GLSL_COMMON = [
    'vec2 hglProj(mat3 m, vec2 w) { vec3 c = m * vec3(w, 1.0); return c.xy / c.z; }',
    'vec3 hglRamp(float v, vec4 st, vec3 c1, vec3 c2, vec3 c3) {',
    '  vec3 c = mix(c1, c2, smoothstep(st.y, st.z, v));',
    '  return mix(c, c3, smoothstep(st.z, st.w, v));',
    '}'].join('\n');

  var VS_FIELD = [
    'attribute vec2 aCorner;',
    'uniform mat3 uM;',
    'uniform vec4 uRect;',
    'varying vec2 vUV;',
    'void main() {',
    '  vec2 uv = aCorner * 0.5 + 0.5;',
    '  vec3 c = uM * vec3(mix(uRect.xy, uRect.zw, uv), 1.0);',
    '  vUV = uv;',
    '  gl_Position = vec4(c.xy, 0.0, c.z);',
    '}'].join('\n');

  var FS_FIELD = [
    'uniform sampler2D uTex, uNrm;',
    'uniform vec2 uTexSize;',
    'uniform vec3 uLightDir;',
    'uniform float uRelief, uGScale;',
    'uniform float uT, uReveal, uRevealOn, uFeather, uFrontW, uFrontAmp, uOpacity, uGlow, uContours, uFill, uGhost;',
    'uniform float uLineW, uIdxW, uInk, uSheen, uStep, uIdxStep;',
    'uniform vec4 uStops;',
    'uniform vec3 uGold, uOrange, uRed, uHot;',
    'varying vec2 vUV;',
    'float dec(vec4 t) { return (t.r * 65280.0 + t.g * 255.0) * (4.0 / 65535.0); }',
    // B-spline bicubic in 4 bilinear taps: smooth (C2) contours at any zoom
    'vec4 cubic(sampler2D tx, vec2 uv) {',
    '  vec2 st = uv * uTexSize - 0.5;',
    '  vec2 i = floor(st);',
    '  vec2 f = st - i;',
    '  vec2 f2 = f * f; vec2 f3 = f2 * f;',
    '  vec2 w0 = (1.0 - 3.0 * f + 3.0 * f2 - f3) / 6.0;',
    '  vec2 w1 = (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0;',
    '  vec2 w2 = (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3) / 6.0;',
    '  vec2 w3 = f3 / 6.0;',
    '  vec2 g0 = w0 + w1; vec2 g1 = w2 + w3;',
    '  vec2 h0 = (i - 0.5 + w1 / g0) / uTexSize;',
    '  vec2 h1 = (i + 1.5 + w3 / g1) / uTexSize;',
    '  vec4 a = texture2D(tx, vec2(h0.x, h0.y));',
    '  vec4 b = texture2D(tx, vec2(h1.x, h0.y));',
    '  vec4 c = texture2D(tx, vec2(h0.x, h1.y));',
    '  vec4 d = texture2D(tx, vec2(h1.x, h1.y));',
    '  return g0.y * (g0.x * a + g1.x * b) + g1.y * (g0.x * c + g1.x * d);',
    '}',
    'float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }',
    // anti-aliased iso line, constant screen width via fwidth; fades out where lines crowd (no moire)
    'float iso(float v, float stp, float wpx, float crowd) {',
    '  float f = v / stp;',
    '  float df = max(fwidth(f), 1e-5);',
    '  float d = abs(fract(f + 0.5) - 0.5) / df;',
    '  return clamp(0.5 * wpx - d + 0.5, 0.0, 1.0) * (1.0 - smoothstep(crowd * 0.5, crowd, df));',
    '}',
    'void main() {',
    '  vec4 raw = texture2D(uTex, vUV);',
    // cheap early-out for empty sky: far from any swath (no value, no glow) -> skip the 8 bicubic taps
    '  if (raw.a < 0.012 && dec(raw) < 0.25 && uGhost <= 0.0) discard;',
    '  vec4 s = cubic(uTex, vUV);',
    // relief in screen space: texel gradient pushed through the pixel Jacobian, so it scales with zoom and rotation
    '  vec2 gt = (cubic(uNrm, vUV).xy * 2.0 - 1.0) * uGScale;',
    '  vec2 tc = vUV * uTexSize;',
    '  vec2 gr = vec2(dot(gt, dFdx(tc)), dot(gt, dFdy(tc))) * uRelief;',
    '  vec3 nn = normalize(vec3(-gr, 1.0));',
    '  float dif = dot(nn, uLightDir) / max(uLightDir.z, 0.2);',
    '  float shade = clamp(mix(1.0, dif, 0.75), 0.3, 1.75);',
    '  vec3 hv = normalize(uLightDir + vec3(0.0, 0.0, 1.0));',
    '  float spec = pow(max(dot(nn, hv), 0.0), 36.0) * smoothstep(0.02, 0.35, length(gr));',
    '  float v = dec(s);',
    '  float arr = s.b;',
    '  float gv = raw.a * 3.0;',
    '  vec2 e2 = min(vUV, 1.0 - vUV);',
    '  float edge = smoothstep(0.0, 0.03, min(e2.x, e2.y));',
    '  float age = uReveal - arr;',
    '  float vis = uRevealOn > 0.5 ? smoothstep(-uFeather, 0.0, age) : 1.0;',
    '  float front = uFrontAmp * vis * exp(-max(age, 0.0) / uFrontW);',
    '  float a0 = smoothstep(uStops.x, uStops.y, v);',
    '  float big = smoothstep(uStops.y, uStops.w + 0.6, v);',
    '  vec3 col = hglRamp(v, uStops, uGold, uOrange, uRed);',
    '  col = mix(col, uHot, front * 0.55 * a0);',
    '  float fillA = a0 * mix(0.06, 0.36, big * big) * uFill;',
    '  float gate = smoothstep(uStops.x - 0.07, uStops.x - 0.025, v);',
    '  float minor = iso(v, uStep, uLineW, 0.42) * gate;',
    '  float idx = iso(v, uIdxStep, mix(uLineW * 1.15, uIdxW, a0), 0.6) * gate;',
    '  float wave = 0.5 + 0.5 * sin(6.2831853 * (v * 1.35 - uT * 0.14));',
    '  float sp = fract(uT * 0.045) * 1.9 - 0.45;',
    '  float sw = (vUV.x * 0.72 + vUV.y * 0.28 - sp) / 0.075;',
    '  float sweep = exp(-sw * sw) * uSheen;',
    '  vec3 white = vec3(1.0, 0.975, 0.93);',
    '  vec3 lineCol = mix(min(col * 1.18, vec3(1.0)), white, 0.06 + 0.5 * front);',
    '  vec3 idxCol = mix(col, white, 0.3 + 0.5 * front);',
    '  if (uInk > 0.5) { lineCol = col * 0.8; idxCol = col * 0.62; }',
    '  float la = minor * (0.16 + 0.22 * a0) * mix(0.6, 1.0, wave) * (1.0 + 0.8 * sweep) * uContours;',
    '  float ia = idx * mix(0.4, 0.95, a0) * (0.82 + 0.18 * wave + 0.5 * sweep) * uContours;',
    '  la = min(la, 1.0); ia = min(ia, 1.0);',
    '  vec3 C = col * fillA * shade; float A = fillA;',
    '  C = lineCol * la + C * (1.0 - la); A = la + A * (1.0 - la);',
    '  C = idxCol * ia + C * (1.0 - ia); A = ia + A * (1.0 - ia);',
    '  float core = pow(smoothstep(0.9, 2.7, v), 1.3) * 0.5;',
    '  float halo = smoothstep(0.2, 1.4, gv) * (1.0 - a0 * 0.4) * 0.17;',
    '  vec3 Em = col * ((core * shade + halo) * uGlow + sweep * 0.07 * a0) + mix(col, white, 0.3) * spec * a0 * 0.3 * uGlow + uHot * front * (0.12 + 0.55 * a0) * gate;',
    '  float k = mix(uGhost, 1.0, vis) * edge * uOpacity;',
    '  if (uInk > 0.5) { C = C * k; A = A * k; }',
    '  else { C = (C + Em) * k; A = A * k; }',
    '  float lum = A + Em.r + Em.g;',
    '  C = max(C + (hash12(gl_FragCoord.xy + fract(uT) * 61.0) - 0.5) * (1.5 / 255.0) * step(0.004, lum), 0.0);',
    '  if (lum * k < 0.0015) discard;',
    '  gl_FragColor = vec4(C, A);',
    '}'].join('\n');

  // Hailstones: instanced quads. aA = (x, y, sizeIn, tLand), aB = (seed, fallMul, driftX, driftY)
  var VS_HAIL = [
    'attribute vec2 aCorner;',
    'attribute vec4 aA;',
    'attribute vec4 aB;',
    'uniform mat3 uM;',
    'uniform vec2 uPx, uVanish, uWind;',
    'uniform float uT, uLoop, uFall, uHeight, uPersp, uTilt, uScale, uStreak, uDpr, uAlpha;',
    'varying vec2 vQ;',
    'varying vec4 vP;',
    'varying vec2 vSpec;',
    'vec2 lift(vec2 g, float hh, vec2 drift) {',
    '  float mag = 1.0 / (1.0 - hh * uPersp);',
    '  return uVanish + (g - uVanish) * mag + vec2(0.0, hh * uHeight * uTilt) + (uWind + drift) * hh;',
    '}',
    'void main() {',
    '  float fall = uFall * aB.y;',
    '  float toLand = uLoop > 0.0 ? uLoop - mod(uT - aA.w, uLoop) : aA.w - uT;',
    '  float hh = toLand / fall;',
    '  if (hh <= 0.0 || hh > 1.0 || aA.z <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vQ = vec2(0.0); vP = vec4(0.0); vSpec = vec2(0.0); return; }',
    '  vec2 g = hglProj(uM, aA.xy);',
    '  vec2 p0 = lift(g, hh, aB.zw);',
    '  vec2 p1 = lift(g, hh + uStreak / fall, aB.zw);',
    '  vec2 tail = (p1 - p0) / uPx;',
    '  float len = length(tail);',
    '  vec2 dir = len > 0.001 ? tail / len : vec2(0.0, 1.0);',
    '  vec2 perp = vec2(-dir.y, dir.x);',
    '  float mag = 1.0 / (1.0 - hh * uPersp);',
    '  float r = (0.45 + aA.z * uScale) * uDpr * mag;',
    '  float soft = 0.7 + hh * hh * r * 0.5;',
    '  float ext = r + soft + 1.5 * uDpr;',
    '  float u = mix(-ext, len + ext, aCorner.x * 0.5 + 0.5);',
    '  float w = aCorner.y * ext;',
    '  vQ = vec2(u, w);',
    '  gl_Position = vec4(p0 + (dir * u + perp * w) * uPx, 0.0, 1.0);',
    '  vP = vec4(r, len, soft, smoothstep(1.0, 0.62, hh) * uAlpha * (0.7 + 0.3 * aB.x));',
    '  vec2 L = normalize(vec2(-0.6, 0.8));',
    '  vSpec = vec2(dot(L, dir), dot(L, perp)) * r * 0.42;',
    '}'].join('\n');

  var FS_HAIL = [
    'uniform vec3 uIce;',
    'varying vec2 vQ;',
    'varying vec4 vP;',
    'varying vec2 vSpec;',
    'void main() {',
    '  float r = vP.x, len = vP.y, soft = vP.z;',
    '  if (vP.w <= 0.0) discard;',
    '  vec2 q = vQ;',
    '  float dH = length(q) - r;',
    '  float aH = 1.0 - smoothstep(-soft, soft, dH);',
    '  float tu = clamp(q.x / max(len, 0.001), 0.0, 1.0);',
    '  float tr = r * 0.6 * (1.0 - tu) + 0.3;',
    '  float aT = (1.0 - smoothstep(tr - 0.6, tr + 0.6, abs(q.y))) * step(0.0, q.x) * step(q.x, len) * pow(1.0 - tu, 1.5) * 0.5;',
    '  vec2 n2 = q / max(r, 0.001);',
    '  float rr = clamp(dot(n2, n2), 0.0, 1.0);',
    '  float nz = sqrt(1.0 - rr);',
    '  float rim = smoothstep(0.4, 1.0, rr);',
    '  vec2 sq = q - vSpec;',
    '  float spec = exp(-dot(sq, sq) / max(r * r * 0.06, 0.3));',
    '  vec3 body = uIce * (0.58 + 0.2 * nz + 0.34 * rim);',
    '  float halo = exp(-max(dH, 0.0) / (r * 0.8 + 1.2)) * (1.0 - aH) * 0.12;',
    '  vec3 C = body * aH * 0.92 + uIce * (aT + halo) + vec3(1.0) * spec * aH;',
    '  float A = max(aH * 0.9, aT);',
    '  gl_FragColor = vec4(C, A) * vP.w;',
    '}'].join('\n');

  // Impact rings from the same hail instance buffer (GPU-only: zero CPU per landing)
  var VS_IMPACT = [
    'attribute vec2 aCorner;',
    'attribute vec4 aA;',
    'attribute vec4 aB;',
    'uniform mat3 uM;',
    'uniform vec2 uPx;',
    'uniform float uT, uLoop, uDpr, uAlpha, uLife, uSize, uResidue;',
    'uniform vec4 uStops;',
    'uniform vec3 uGold, uOrange, uRed;',
    'varying vec2 vQ;',
    'varying vec4 vR;',
    'varying vec4 vC;',
    'varying float vE;',
    'void main() {',
    '  float since = uLoop > 0.0 ? mod(uT - aA.w, uLoop) : uT - aA.w;',
    '  float total = max(uLife, uResidue);',
    '  if (since < 0.0 || since > total || aA.z <= 0.0 || (uLoop > 0.0 && since > uLoop - 0.02)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vQ = vec2(0.0); vR = vec4(0.0); vC = vec4(0.0); vE = 0.0; return; }',
    '  float p = since / uLife;',
    '  float e = 1.0 - pow(1.0 - clamp(p, 0.0, 1.0), 3.0);',
    '  float rMax = uSize * uDpr * (0.45 + 0.4 * aA.z) * (0.85 + 0.3 * aB.x);',
    '  float rad = mix(1.2 * uDpr, rMax, e);',
    '  float ext = (p < 1.0 ? rad : 3.0 * uDpr) + 3.0 * uDpr;',
    '  vQ = aCorner * ext;',
    '  gl_Position = vec4(hglProj(uM, aA.xy) + vQ * uPx, 0.0, 1.0);',
    '  float ringA = p < 1.0 ? pow(1.0 - p, 1.8) * (0.3 + 0.22 * aB.x) : 0.0;',
    '  vR = vec4(rad, (0.7 + 0.25 * aA.z) * uDpr, ringA * uAlpha, exp(-since * 16.0) * uAlpha);',
    '  vC = vec4(hglRamp(aA.z, uStops, uGold, uOrange, uRed), (1.0 - smoothstep(0.0, uResidue, since)) * 0.3 * uAlpha * smoothstep(0.0, 0.12, since));',
    '  vE = 0.0;',
    '}'].join('\n');

  // General rings ("knock ring" motif): aR0 = (x, y, t0, sizePx), aR1 = (life, widthPx, echo, _), aRC = rgba
  var VS_RINGS = [
    'attribute vec2 aCorner;',
    'attribute vec4 aR0;',
    'attribute vec4 aR1;',
    'attribute vec4 aRC;',
    'uniform mat3 uM;',
    'uniform vec2 uPx;',
    'uniform float uT, uDpr, uAlpha;',
    'varying vec2 vQ;',
    'varying vec4 vR;',
    'varying vec4 vC;',
    'varying float vE;',
    'void main() {',
    '  float since = uT - aR0.z;',
    '  if (aR1.x <= 0.0 || since < 0.0 || since > aR1.x) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vQ = vec2(0.0); vR = vec4(0.0); vC = vec4(0.0); vE = 0.0; return; }',
    '  float p = since / aR1.x;',
    '  float e = 1.0 - pow(1.0 - p, 3.0);',
    '  float rad = mix(0.12, 1.0, e) * aR0.w * uDpr;',
    '  float ext = rad + (aR1.y + 3.0) * uDpr;',
    '  vQ = aCorner * ext;',
    '  gl_Position = vec4(hglProj(uM, aR0.xy) + vQ * uPx, 0.0, 1.0);',
    '  vR = vec4(rad, max(aR1.y, 0.5) * uDpr, pow(1.0 - p, 1.5) * smoothstep(0.0, 0.05, p) * aRC.a * uAlpha, exp(-since * 10.0) * 0.6 * aRC.a * uAlpha);',
    '  vC = vec4(aRC.rgb, 0.0);',
    '  vE = aR1.z;',
    '}'].join('\n');

  var FS_RING = [
    'uniform float uDpr;',
    'varying vec2 vQ;',
    'varying vec4 vR;',
    'varying vec4 vC;',
    'varying float vE;',
    'void main() {',
    '  float d = length(vQ);',
    '  float hw = vR.y * 0.5;',
    '  float ring = 1.0 - smoothstep(hw - 0.55, hw + 0.75, abs(d - vR.x));',
    '  float echo = (1.0 - smoothstep(hw - 0.55, hw + 0.75, abs(d - vR.x * 0.64))) * 0.42 * vE;',
    '  float ra = (ring + echo) * vR.z;',
    '  float fl = exp(-d * d / (5.0 * uDpr * uDpr)) * vR.w;',
    '  float res = (1.0 - smoothstep(0.55 * uDpr, 1.35 * uDpr, d)) * vC.a;',
    '  vec3 C = vC.rgb * ra + vec3(1.0, 0.98, 0.95) * (fl + res * 0.85);',
    '  float A = clamp(ra * 0.85 + fl * 0.4 + res, 0.0, 1.0);',
    '  if (A + fl < 0.002) discard;',
    '  gl_FragColor = vec4(C, A);',
    '}'].join('\n');

  /* ------------------------------------------------------------------ public create */
  HailGL.create = function (target, opts) {
    opts = opts || EMPTY;
    try { return makeGLKit(target, opts); }
    catch (e) {
      warnOnce('create', 'WebGL unavailable or failed, using Canvas2D fallback', e);
      return make2DKit(target, opts);
    }
  };

  function isCanvas(t) { return t && typeof t.getContext === 'function' && typeof t.width === 'number'; }

  function makeGLKit(target, opts) {
    var canvas, gl;
    if (opts.webgl === 0) throw new Error('WebGL off by option');
    if (isCanvas(target)) {
      canvas = target;
      var attrs = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false,
        preserveDrawingBuffer: !!opts.preserveDrawingBuffer, powerPreference: 'high-performance' };
      if (opts.webgl !== 1) gl = canvas.getContext('webgl2', attrs);
      if (!gl) gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
      if (!gl) throw new Error('no WebGL context');
    } else if (target && typeof target.createShader === 'function') {
      gl = target; canvas = gl.canvas;
    } else throw new Error('HailGL.create needs a canvas or a WebGL context');

    var gl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    var S = {
      gl: gl, gl2: gl2, canvas: canvas, dpr: capDpr(opts.dpr), lost: false, restore: opts.restoreState !== false,
      pal: applyTheme(makePalette(), opts.theme || opts.colors), lastTheme: null,
      field: null, fieldBytes: null, fieldTex: null,
      hailData: null, hailCount: 0, hailCap: 0, fall: 0.9, fallH: 0.34, loop: 0, hailDirty: false,
      ringCap: clamp(Math.round(num(opts.maxRings, 4096)), 16, 65536), ringData: null, ringCur: 0, ringDirtyLo: 1e9, ringDirtyHi: -1,
      now: 0, P: null, ext: {}, disposed: false
    };
    S.ringData = new Float32Array(S.ringCap * 12);
    var ringCol = new Float32Array(3), tmp3 = new Float32Array(3);

    function compile(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS) && !gl.isContextLost()) {
        var log = gl.getShaderInfoLog(sh);
        gl.deleteShader(sh);
        throw new Error('shader compile: ' + log);
      }
      return sh;
    }
    function program(vs, fs, attribs, unis, deriv) {
      var p = gl.createProgram();
      var v = compile(gl.VERTEX_SHADER, vsHead(gl2) + GLSL_COMMON + '\n' + vs);
      var f = compile(gl.FRAGMENT_SHADER, fsHead(gl2, deriv) + GLSL_COMMON + '\n' + fs);
      gl.attachShader(p, v); gl.attachShader(p, f);
      for (var i = 0; i < attribs.length; i++) gl.bindAttribLocation(p, i, attribs[i]);
      gl.linkProgram(p);
      gl.deleteShader(v); gl.deleteShader(f);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error('link: ' + gl.getProgramInfoLog(p));
      var u = {};
      for (i = 0; i < unis.length; i++) u[unis[i]] = gl.getUniformLocation(p, unis[i]);
      return { p: p, u: u };
    }

    function initGL() {
      var ext = S.ext = {};
      if (!gl2) {
        ext.deriv = gl.getExtension('OES_standard_derivatives');
        ext.inst = gl.getExtension('ANGLE_instanced_arrays');
        ext.vao = gl.getExtension('OES_vertex_array_object');
        if (!ext.deriv) warnOnce('deriv', 'no OES_standard_derivatives: contours may look soft');
      }
      S.canInst = gl2 || !!ext.inst;
      S.canVao = gl2 || !!ext.vao;
      var common = ['uM', 'uPx', 'uT', 'uDpr', 'uAlpha'];
      S.P = {
        field: program(VS_FIELD, FS_FIELD, ['aCorner'], ['uM', 'uRect', 'uTex', 'uTexSize', 'uT', 'uReveal', 'uRevealOn', 'uFeather',
          'uFrontW', 'uFrontAmp', 'uOpacity', 'uGlow', 'uContours', 'uFill', 'uGhost', 'uLineW', 'uIdxW', 'uInk', 'uSheen', 'uStep',
          'uIdxStep', 'uStops', 'uGold', 'uOrange', 'uRed', 'uHot', 'uNrm', 'uLightDir', 'uRelief', 'uGScale'], true),
        rings: program(VS_RINGS, FS_RING, ['aCorner', 'aR0', 'aR1', 'aRC'], common, false)
      };
      if (S.canInst) {
        S.P.hail = program(VS_HAIL, FS_HAIL, ['aCorner', 'aA', 'aB'], common.concat(['uLoop', 'uFall', 'uHeight', 'uPersp', 'uTilt',
          'uScale', 'uStreak', 'uVanish', 'uWind', 'uIce']), false);
        S.P.impact = program(VS_IMPACT, FS_RING, ['aCorner', 'aA', 'aB'], common.concat(['uLoop', 'uLife', 'uSize', 'uResidue', 'uStops',
          'uGold', 'uOrange', 'uRed']), false);
      } else warnOnce('inst', 'no instancing: hail and rings disabled on this device');
      S.quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, S.quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      S.hailBuf = gl.createBuffer();
      S.ringBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, S.ringBuf);
      gl.bufferData(gl.ARRAY_BUFFER, S.ringData, gl.DYNAMIC_DRAW);
      if (S.hailData) {
        gl.bindBuffer(gl.ARRAY_BUFFER, S.hailBuf);
        gl.bufferData(gl.ARRAY_BUFFER, S.hailData, gl.STATIC_DRAW);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      S.fieldTex = null; S.nrmTex = null;
      if (S.fieldBytes) uploadField();
      S.vao = {};
      if (S.canVao) {
        var prev = getVao();
        S.vao.field = makeVao(setupField);
        if (S.canInst) S.vao.hail = makeVao(setupHail);
        S.vao.rings = makeVao(setupRings);
        bindVao(prev);
      }
    }
    function getVao() { return gl2 ? gl.getParameter(gl.VERTEX_ARRAY_BINDING) : (S.ext.vao ? gl.getParameter(S.ext.vao.VERTEX_ARRAY_BINDING_OES) : null); }
    function bindVao(v) { if (gl2) gl.bindVertexArray(v); else if (S.ext.vao) S.ext.vao.bindVertexArrayOES(v); }
    function makeVao(setup) {
      var v = gl2 ? gl.createVertexArray() : S.ext.vao.createVertexArrayOES();
      bindVao(v); setup(); return v;
    }
    function divisor(i, d) { if (gl2) gl.vertexAttribDivisor(i, d); else S.ext.inst.vertexAttribDivisorANGLE(i, d); }
    function setupQuad() {
      gl.bindBuffer(gl.ARRAY_BUFFER, S.quad);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    }
    function setupField() { setupQuad(); }
    function setupHail() {
      setupQuad();
      gl.bindBuffer(gl.ARRAY_BUFFER, S.hailBuf);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0); divisor(1, 1);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16); divisor(2, 1);
    }
    function setupRings() {
      setupQuad();
      gl.bindBuffer(gl.ARRAY_BUFFER, S.ringBuf);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 48, 0); divisor(1, 1);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 48, 16); divisor(2, 1);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 48, 32); divisor(3, 1);
    }
    function useLayout(name, setup) {
      if (S.canVao) bindVao(S.vao[name]); else setup();
    }
    function unsetLayout(n) {
      if (S.canVao) return;
      for (var i = 1; i <= n; i++) { if (S.canInst) divisor(i, 0); gl.disableVertexAttribArray(i); }
    }
    function drawInst(count) {
      if (gl2) gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
      else S.ext.inst.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, 4, count);
    }

    // shared-context courtesy: save and restore the little state we touch
    var SV = { vao: null, prog: null, blend: false, depth: false, cull: false, bs: 0, bd: 0, bsa: 0, bda: 0, buf: null, at: 0, tex: null };
    function begin() {
      if (S.restore) {
        if (S.canVao) SV.vao = getVao();
        SV.prog = gl.getParameter(gl.CURRENT_PROGRAM);
        SV.blend = gl.isEnabled(gl.BLEND); SV.depth = gl.isEnabled(gl.DEPTH_TEST); SV.cull = gl.isEnabled(gl.CULL_FACE);
        SV.bs = gl.getParameter(gl.BLEND_SRC_RGB); SV.bd = gl.getParameter(gl.BLEND_DST_RGB);
        SV.bsa = gl.getParameter(gl.BLEND_SRC_ALPHA); SV.bda = gl.getParameter(gl.BLEND_DST_ALPHA);
        SV.buf = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
      }
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND);
    }
    function end() {
      if (!S.restore) { if (S.canVao) bindVao(null); return; }
      if (S.canVao) bindVao(SV.vao);
      gl.useProgram(SV.prog);
      if (!SV.blend) gl.disable(gl.BLEND);
      if (SV.depth) gl.enable(gl.DEPTH_TEST);
      if (SV.cull) gl.enable(gl.CULL_FACE);
      gl.blendFuncSeparate(SV.bs, SV.bd, SV.bsa, SV.bda);
      gl.bindBuffer(gl.ARRAY_BUFFER, SV.buf);
    }
    function blendMode(b) {
      if (b === 'multiply') gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
      else if (b === 'add') gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
      else gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
    function ready() {
      if (S.disposed || S.lost) return false;
      if (gl.isContextLost()) { S.lost = true; return false; }
      return true;
    }
    function takeTheme(o) {
      var th = o.theme || o.colors;
      if (th && th !== S.lastTheme) { applyTheme(S.pal, th); S.lastTheme = th; }
    }
    function pxUniform(u) { gl.uniform2f(u, 2 / (gl.drawingBufferWidth || 1), 2 / (gl.drawingBufferHeight || 1)); }

    /* ---------------- field */
    function uploadTex(tex, f, bytes) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, f.w, f.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    function uploadField() {
      var f = S.field;
      if (!S.fieldTex) S.fieldTex = gl.createTexture();
      if (!S.nrmTex) S.nrmTex = gl.createTexture();
      var flip = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL), pre = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
      var cs = gl.getParameter(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL), align = gl.getParameter(gl.UNPACK_ALIGNMENT);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      var prevTex = gl.getParameter(gl.TEXTURE_BINDING_2D);
      uploadTex(S.fieldTex, f, S.fieldBytes.rgba);
      uploadTex(S.nrmTex, f, S.fieldBytes.nrm);
      gl.bindTexture(gl.TEXTURE_2D, prevTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flip); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, pre);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, cs); gl.pixelStorei(gl.UNPACK_ALIGNMENT, align);
    }
    function setField(f, o) {
      if (!f || !f.data || !(f.w > 1) || !(f.h > 1) || f.data.length < f.w * f.h) { warnOnce('setField', 'setField: bad field'); return false; }
      var max = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      if (f.w > max || f.h > max) { warnOnce('fsize', 'field larger than MAX_TEXTURE_SIZE ' + max); return false; }
      S.field = f; S.fieldBytes = packField(f, o);
      if (ready()) uploadField();
      return true;
    }
    function drawField(m, o) {
      o = o || EMPTY;
      if (!S.field || !S.fieldTex || !ready() || !m) return;
      takeTheme(o);
      var P = S.P.field, u = P.u, pal = S.pal, f = S.field, dpr = S.dpr;
      begin();
      gl.useProgram(P.p);
      useLayout('field', setupField);
      var prevAct = S.restore ? gl.getParameter(gl.ACTIVE_TEXTURE) : 0;
      gl.activeTexture(gl.TEXTURE1);
      var prevTex1 = S.restore ? gl.getParameter(gl.TEXTURE_BINDING_2D) : null;
      gl.bindTexture(gl.TEXTURE_2D, S.nrmTex);
      gl.activeTexture(gl.TEXTURE0);
      var prevTex = S.restore ? gl.getParameter(gl.TEXTURE_BINDING_2D) : null;
      gl.bindTexture(gl.TEXTURE_2D, S.fieldTex);
      gl.uniform1i(u.uTex, 0); gl.uniform1i(u.uNrm, 1);
      // light from the map's north-west, swaying slowly so the relief breathes
      // screen space, y up: default light from the upper left
      var tt = num(o.t, S.now), az = num(o.lightAz, 2.36) + 0.3 * Math.sin(tt * 0.21), el = num(o.lightEl, 0.8);
      gl.uniform3f(u.uLightDir, Math.cos(az) * Math.cos(el), Math.sin(az) * Math.cos(el), Math.sin(el));
      gl.uniform1f(u.uRelief, o.relief === false ? 0 : num(o.relief, 1) * 42 * dpr);
      gl.uniform1f(u.uGScale, S.fieldBytes.gscale);
      gl.uniformMatrix3fv(u.uM, false, m);
      gl.uniform4f(u.uRect, f.x0, f.y0, f.x1, f.y1);
      gl.uniform2f(u.uTexSize, f.w, f.h);
      gl.uniform1f(u.uT, num(o.t, S.now));
      var rv = o.reveal, on = typeof rv === 'number';
      gl.uniform1f(u.uReveal, on ? rv : 2);
      gl.uniform1f(u.uRevealOn, on ? 1 : 0);
      gl.uniform1f(u.uFeather, num(o.feather, 0.025));
      gl.uniform1f(u.uFrontW, num(o.frontWidth, 0.06));
      gl.uniform1f(u.uFrontAmp, on ? clamp((1.1 - rv) / 0.1, 0, 1) * num(o.front, 1) : 0);
      gl.uniform1f(u.uOpacity, num(o.opacity, 1) * (1 - 0.8 * clamp(num(o.dim, 0), 0, 1)));
      gl.uniform1f(u.uGlow, o.glow === false ? 0 : num(o.glow, 1) * pal.glow);
      gl.uniform1f(u.uContours, o.contours === false ? 0 : num(o.contours, 1) * pal.contours);
      gl.uniform1f(u.uFill, num(o.fill, 1) * pal.fill);
      gl.uniform1f(u.uGhost, num(o.ghost, 0));
      gl.uniform1f(u.uLineW, num(o.lineWidth, 0.8) * dpr);
      gl.uniform1f(u.uIdxW, num(o.indexWidth, 1.4) * dpr);
      gl.uniform1f(u.uInk, pal.ink);
      gl.uniform1f(u.uSheen, num(o.sheen, 1));
      gl.uniform1f(u.uStep, num(o.step, 0.1));
      gl.uniform1f(u.uIdxStep, num(o.indexStep, 0.5));
      gl.uniform4fv(u.uStops, pal.stops);
      gl.uniform3fv(u.uGold, pal.gold); gl.uniform3fv(u.uOrange, pal.orange); gl.uniform3fv(u.uRed, pal.red); gl.uniform3fv(u.uHot, pal.hot);
      blendMode(o.blend);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      unsetLayout(0);
      if (S.restore) {
        gl.bindTexture(gl.TEXTURE_2D, prevTex);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, prevTex1); gl.activeTexture(prevAct);
      }
      end();
    }

    /* ---------------- hail */
    function spawn(o) {
      o = o || EMPTY;
      var count = clamp(Math.round(num(o.count, 2000)), 0, 200000), sampler = o.sampler;
      if (typeof sampler !== 'function') { warnOnce('spawn', 'hail.spawn needs a sampler'); return 0; }
      var fall = o.fall || EMPTY, rnd = rng(num(o.seed, 1234));
      S.fallH = num(fall.height, 0.2);
      S.fall = num(fall.dur, S.fallH / num(fall.speed, 0.25));
      S.loop = num(o.loop, 0);
      var t0 = num(o.t0, 0), dur = num(o.dur, 8), lag = num(o.lag, 0.04), phaseRandom = o.phase === 'random' || (S.loop > 0 && o.phase !== 'arrival');
      var base = o.append ? S.hailCount : 0, total = base + count;
      if (!S.hailData || S.hailData.length < total * 8) {
        var nd = new Float32Array(total * 8);
        if (S.hailData && base) nd.set(S.hailData.subarray(0, base * 8));
        S.hailData = nd;
      }
      var D = S.hailData;
      for (var i = 0; i < count; i++) {
        var s = sampler(i) || EMPTY, j = (base + i) * 8, size = num(s[2], 0);
        var u = s.length > 3 && !phaseRandom ? num(s[3], rnd()) : rnd();
        var tl;
        if (S.loop > 0) tl = t0 + u * S.loop;
        else tl = t0 + (u + (lag > 0 ? Math.min(-lag * Math.log(1 - rnd() * 0.999), lag * 4) : 0)) * dur;
        D[j] = num(s[0], 0); D[j + 1] = num(s[1], 0); D[j + 2] = size; D[j + 3] = tl;
        D[j + 4] = rnd();
        D[j + 5] = (1 / (0.72 + 0.28 * Math.sqrt(Math.max(size, 0.1)))) * (0.9 + 0.2 * rnd());
        D[j + 6] = (rnd() - 0.5) * 0.02; D[j + 7] = (rnd() - 0.5) * 0.012;
      }
      S.hailCount = total;
      if (ready()) {
        gl.bindBuffer(gl.ARRAY_BUFFER, S.hailBuf);
        gl.bufferData(gl.ARRAY_BUFFER, S.hailData, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
      }
      return count;
    }
    function drawHail(m, o) {
      o = o || EMPTY;
      if (!S.hailCount || !S.canInst || !ready() || !m) return;
      takeTheme(o);
      var t = num(o.t, S.now), pal = S.pal, dpr = S.dpr, alpha = num(o.opacity, 1) * (1 - 0.8 * clamp(num(o.dim, 0), 0, 1));
      begin();
      blendMode(o.blend);
      if (o.rings !== false) {
        var I = S.P.impact, iu = I.u;
        gl.useProgram(I.p);
        useLayout('hail', setupHail);
        gl.uniformMatrix3fv(iu.uM, false, m); pxUniform(iu.uPx);
        gl.uniform1f(iu.uT, t); gl.uniform1f(iu.uLoop, S.loop); gl.uniform1f(iu.uDpr, dpr); gl.uniform1f(iu.uAlpha, alpha);
        gl.uniform1f(iu.uLife, num(o.ringLife, 1.1)); gl.uniform1f(iu.uSize, num(o.ringSize, 14));
        gl.uniform1f(iu.uResidue, num(o.residue, 4));
        gl.uniform4fv(iu.uStops, pal.stops);
        gl.uniform3fv(iu.uGold, pal.gold); gl.uniform3fv(iu.uOrange, pal.orange); gl.uniform3fv(iu.uRed, pal.red);
        drawInst(S.hailCount);
      }
      var H = S.P.hail, hu = H.u, vn = o.vanish, wd = o.wind;
      gl.useProgram(H.p);
      useLayout('hail', setupHail);
      gl.uniformMatrix3fv(hu.uM, false, m); pxUniform(hu.uPx);
      gl.uniform1f(hu.uT, t); gl.uniform1f(hu.uLoop, S.loop); gl.uniform1f(hu.uFall, S.fall);
      gl.uniform1f(hu.uHeight, 2 * num(o.height, S.fallH)); gl.uniform1f(hu.uPersp, clamp(num(o.persp, 0.22), 0, 0.9));
      gl.uniform1f(hu.uTilt, num(o.tilt, 1)); gl.uniform1f(hu.uScale, num(o.scale, 1.1));
      gl.uniform1f(hu.uStreak, num(o.streak, 0.085)); gl.uniform1f(hu.uDpr, dpr); gl.uniform1f(hu.uAlpha, alpha);
      gl.uniform2f(hu.uVanish, vn ? vn[0] : 0, vn ? vn[1] : 0.1);
      gl.uniform2f(hu.uWind, wd ? wd[0] : 0.05, wd ? wd[1] : 0);
      gl.uniform3fv(hu.uIce, pal.ice);
      drawInst(S.hailCount);
      unsetLayout(2);
      end();
    }

    /* ---------------- rings */
    function addRing(x, y, o) {
      o = o || EMPTY;
      var i = S.ringCur, j = i * 12, D = S.ringData;
      S.ringCur = (i + 1) % S.ringCap;
      if (o.color != null) parseColor(o.color, ringCol); else { ringCol[0] = S.pal.ring[0]; ringCol[1] = S.pal.ring[1]; ringCol[2] = S.pal.ring[2]; }
      D[j] = x; D[j + 1] = y; D[j + 2] = num(o.t0, S.now); D[j + 3] = num(o.size, 36);
      D[j + 4] = num(o.life, 1.6); D[j + 5] = num(o.width, 1.3); D[j + 6] = o.echo === false ? 0 : num(o.echo, 1); D[j + 7] = 0;
      D[j + 8] = ringCol[0]; D[j + 9] = ringCol[1]; D[j + 10] = ringCol[2]; D[j + 11] = num(o.alpha, 1);
      if (i < S.ringDirtyLo) S.ringDirtyLo = i;
      if (i > S.ringDirtyHi) S.ringDirtyHi = i;
      return i;
    }
    function clearRings() {
      S.ringData.fill(0); S.ringCur = 0; S.ringDirtyLo = 0; S.ringDirtyHi = S.ringCap - 1;
    }
    function drawRings(m, t) {
      if (!S.canInst || !ready() || !m) return;
      var o = typeof t === 'object' && t ? t : EMPTY, tt = typeof t === 'number' ? t : num(o.t, S.now);
      if (S.ringDirtyHi >= S.ringDirtyLo) {
        gl.bindBuffer(gl.ARRAY_BUFFER, S.ringBuf);
        if (gl2) gl.bufferSubData(gl.ARRAY_BUFFER, S.ringDirtyLo * 48, S.ringData, S.ringDirtyLo * 12, (S.ringDirtyHi - S.ringDirtyLo + 1) * 12);
        else gl.bufferSubData(gl.ARRAY_BUFFER, 0, S.ringData);
        S.ringDirtyLo = 1e9; S.ringDirtyHi = -1;
      }
      var R = S.P.rings, u = R.u;
      begin();
      blendMode(o.blend);
      gl.useProgram(R.p);
      useLayout('rings', setupRings);
      gl.uniformMatrix3fv(u.uM, false, m); pxUniform(u.uPx);
      gl.uniform1f(u.uT, tt); gl.uniform1f(u.uDpr, S.dpr); gl.uniform1f(u.uAlpha, num(o.opacity, 1));
      drawInst(S.ringCap);
      unsetLayout(3);
      end();
    }

    /* ---------------- lifecycle */
    function onLost(e) { if (e && e.preventDefault) e.preventDefault(); S.lost = true; }
    function onRestored() {
      try { S.lost = false; initGL(); } catch (e) { S.lost = true; warnOnce('restore', 'context restore failed', e); }
    }
    if (canvas && canvas.addEventListener) {
      canvas.addEventListener('webglcontextlost', onLost, false);
      canvas.addEventListener('webglcontextrestored', onRestored, false);
    }
    initGL();

    function resize(w, h, dpr) {
      S.dpr = capDpr(dpr != null ? dpr : S.dpr);
      if (canvas && w > 0 && h > 0) {
        var bw = Math.max(1, Math.round(w * S.dpr)), bh = Math.max(1, Math.round(h * S.dpr));
        if (canvas.width !== bw) canvas.width = bw;
        if (canvas.height !== bh) canvas.height = bh;
        if (canvas.style && typeof canvas.style === 'object' && opts.sizeStyle !== false && canvas.style.width !== w + 'px') {
          canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
        }
        if (ready()) gl.viewport(0, 0, bw, bh);
      }
    }
    function dispose() {
      if (S.disposed) return;
      S.disposed = true;
      if (canvas && canvas.removeEventListener) {
        canvas.removeEventListener('webglcontextlost', onLost, false);
        canvas.removeEventListener('webglcontextrestored', onRestored, false);
      }
      if (gl.isContextLost()) return;
      var P = S.P || EMPTY;
      for (var k in P) if (P[k]) gl.deleteProgram(P[k].p);
      gl.deleteBuffer(S.quad); gl.deleteBuffer(S.hailBuf); gl.deleteBuffer(S.ringBuf);
      if (S.fieldTex) gl.deleteTexture(S.fieldTex);
      if (S.nrmTex) gl.deleteTexture(S.nrmTex);
      if (S.canVao) for (k in S.vao) { if (gl2) gl.deleteVertexArray(S.vao[k]); else S.ext.vao.deleteVertexArrayOES(S.vao[k]); }
    }

    var kit = {
      ok: true, mode: gl2 ? 'webgl2' : 'webgl1', gl: gl,
      field: {
        setField: guard('field.setField', setField),
        draw: guard('field.draw', drawField),
        get: function () { return S.field; }
      },
      hail: {
        spawn: guard('hail.spawn', spawn),
        draw: guard('hail.draw', drawHail),
        clear: function () { S.hailCount = 0; },
        count: function () { return S.hailCount; }
      },
      rings: {
        add: guard('rings.add', addRing),
        draw: guard('rings.draw', drawRings),
        clear: guard('rings.clear', clearRings)
      },
      setTheme: guard('setTheme', function (th) { applyTheme(S.pal, th); S.lastTheme = th; }),
      setTime: function (t) { S.now = num(t, S.now); },
      resize: guard('resize', resize),
      dispose: guard('dispose', dispose),
      isLost: function () { return S.lost; },
      _state: S
    };
    return kit;
  }

  function guard(name, fn) {
    return function (a, b, c) {
      try { return fn(a, b, c); } catch (e) { warnOnce(name, name + ' failed (skipped)', e); return undefined; }
    };
  }

  /* ------------------------------------------------------------------ Canvas2D kit (same API, no WebGL) */
  function make2DKit(target, opts) {
    var ctx = null;
    if (isCanvas(target)) { try { ctx = target.getContext('2d'); } catch (e) { ctx = null; } }
    else if (target && typeof target.fillRect === 'function') ctx = target;
    var noop = function () {};
    if (!ctx) {
      warnOnce('none', 'no drawing context: HailGL is off (use HailGL.draw2DFallback on a 2D canvas)');
      return { ok: false, mode: 'none', field: { setField: noop, draw: noop, get: noop }, hail: { spawn: function () { return 0; }, draw: noop, clear: noop, count: function () { return 0; } },
        rings: { add: function () { return -1; }, draw: noop, clear: noop }, setTheme: noop, setTime: noop, resize: noop, dispose: noop, isLost: function () { return false; } };
    }
    var S = { dpr: capDpr(opts.dpr), pal: applyTheme(makePalette(), opts.theme || opts.colors), field: null, hail: null, hailCount: 0,
      fall: 0.9, fallH: 0.34, loop: 0, rings: [], now: 0, theme: opts.theme || opts.colors || 'dark' };
    var P = [0, 0], col = [0, 0, 0];
    function toPx(m, x, y) {
      var cx = m[0] * x + m[3] * y + m[6], cy = m[1] * x + m[4] * y + m[7], cz = m[2] * x + m[5] * y + m[8];
      P[0] = (cx / cz * 0.5 + 0.5) * ctx.canvas.width; P[1] = (0.5 - cy / cz * 0.5) * ctx.canvas.height;
      return P;
    }
    function drawHail2D(m, o) {
      o = o || EMPTY;
      if (!S.hailCount) return;
      var t = num(o.t, S.now), D = S.hail, W = ctx.canvas.width, H = ctx.canvas.height, dpr = S.dpr, drawn = 0;
      var hgt = num(o.height, S.fallH) * H, persp = num(o.persp, 0.32), scale = num(o.scale, 2.3);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (var i = 0; i < S.hailCount && drawn < 2500; i++) {
        var j = i * 8, fall = S.fall * D[j + 5], tl = D[j + 3];
        var toLand = S.loop > 0 ? S.loop - (((t - tl) % S.loop) + S.loop) % S.loop : tl - t;
        var since = S.loop > 0 ? (((t - tl) % S.loop) + S.loop) % S.loop : t - tl;
        var p = toPx(m, D[j], D[j + 1]), gx = p[0], gy = p[1];
        if (o.rings !== false && since >= 0 && since < 1.1) {
          var e = 1 - Math.pow(1 - since / 1.1, 3);
          rampInto(S.pal, D[j + 2], col);
          ctx.strokeStyle = cssRGB(col, Math.pow(1 - since / 1.1, 1.7) * 0.7);
          ctx.lineWidth = dpr * 0.8;
          ctx.beginPath(); ctx.arc(gx, gy, (1 + e * 16 * (0.45 + 0.4 * D[j + 2])) * dpr, 0, 6.2832); ctx.stroke();
        }
        var hh = toLand / fall;
        if (hh <= 0 || hh > 1) continue;
        var mag = 1 / (1 - hh * persp), sx = W / 2 + (gx - W / 2) * mag, sy = H * 0.45 + (gy - H * 0.45) * mag - hh * hgt;
        var r = (0.55 + D[j + 2] * scale) * dpr * mag;
        ctx.fillStyle = cssRGB(S.pal.ice, 0.85 * Math.min(1, (1 - hh) * 5));
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.2832); ctx.fill();
        drawn++;
      }
      ctx.restore();
    }
    function drawRings2D(m, t) {
      var tt = typeof t === 'number' ? t : num(t && t.t, S.now), dpr = S.dpr;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (var i = 0; i < S.rings.length; i++) {
        var r = S.rings[i], p = (tt - r.t0) / r.life;
        if (p < 0 || p > 1) continue;
        var q = toPx(m, r.x, r.y), rad = (0.12 + 0.88 * (1 - Math.pow(1 - p, 3))) * r.size * dpr;
        ctx.strokeStyle = cssRGB(r.c, Math.pow(1 - p, 1.5) * r.a); ctx.lineWidth = r.width * dpr;
        ctx.beginPath(); ctx.arc(q[0], q[1], rad, 0, 6.2832); ctx.stroke();
      }
      ctx.restore();
    }
    return {
      ok: true, mode: '2d', ctx: ctx,
      field: {
        setField: guard('2d.setField', function (f) { S.field = f; return true; }),
        draw: guard('2d.field.draw', function (m, o) { if (S.field) draw2D(ctx, S.field, m, o, S.pal, S.dpr); }),
        get: function () { return S.field; }
      },
      hail: {
        spawn: guard('2d.spawn', function (o) {
          o = o || EMPTY;
          var count = clamp(Math.round(num(o.count, 2000)), 0, 200000), rnd = rng(num(o.seed, 1234)), fall = o.fall || EMPTY;
          S.fallH = num(fall.height, 0.34); S.fall = num(fall.dur, S.fallH / num(fall.speed, 0.4)); S.loop = num(o.loop, 0);
          var t0 = num(o.t0, 0), dur = num(o.dur, 8), D = S.hail = new Float32Array(count * 8);
          for (var i = 0; i < count; i++) {
            var s = o.sampler(i) || EMPTY, j = i * 8, u = s.length > 3 && !(S.loop > 0) ? s[3] : rnd();
            D[j] = s[0]; D[j + 1] = s[1]; D[j + 2] = s[2]; D[j + 3] = S.loop > 0 ? t0 + u * S.loop : t0 + u * dur;
            D[j + 4] = rnd(); D[j + 5] = 1 / (0.72 + 0.28 * Math.sqrt(Math.max(s[2], 0.1)));
          }
          S.hailCount = count; return count;
        }),
        draw: guard('2d.hail.draw', drawHail2D),
        clear: function () { S.hailCount = 0; },
        count: function () { return S.hailCount; }
      },
      rings: {
        add: guard('2d.rings.add', function (x, y, o) {
          o = o || EMPTY;
          var c = [0, 0, 0];
          if (o.color != null) parseColor(o.color, c); else { c[0] = S.pal.ring[0]; c[1] = S.pal.ring[1]; c[2] = S.pal.ring[2]; }
          if (S.rings.length > 512) S.rings.shift();
          S.rings.push({ x: x, y: y, t0: num(o.t0, S.now), size: num(o.size, 36), life: num(o.life, 1.6), width: num(o.width, 1.3), c: c, a: num(o.alpha, 1) });
          return S.rings.length - 1;
        }),
        draw: guard('2d.rings.draw', drawRings2D),
        clear: function () { S.rings.length = 0; }
      },
      setTheme: function (th) { applyTheme(S.pal, th); },
      setTime: function (t) { S.now = num(t, S.now); },
      resize: guard('2d.resize', function (w, h, dpr) {
        S.dpr = capDpr(dpr != null ? dpr : S.dpr);
        var cv = ctx.canvas, bw = Math.round(w * S.dpr), bh = Math.round(h * S.dpr);
        if (cv.width !== bw) cv.width = bw;
        if (cv.height !== bh) cv.height = bh;
      }),
      dispose: function () { S.field = null; S.hail = null; S.rings.length = 0; },
      isLost: function () { return false; }
    };
  }

  /* ------------------------------------------------------------------ Canvas2D field renderer */
  /* draw2DFallback(ctx, field, transform, opts)
     transform: mat3 (world -> clip, drawn in canvas device px) or function(x, y) -> [px, py] in ctx's current space.
     opts: {reveal, opacity, contours, glow, theme/colors, dpr} */
  HailGL.draw2DFallback = function (ctx, field, transform, o) {
    try { draw2D(ctx, field, transform, o || EMPTY, null, null); } catch (e) { warnOnce('2d', 'draw2DFallback failed', e); }
  };

  function draw2D(ctx, f, transform, o, pal, dpr) {
    o = o || EMPTY;
    if (!ctx || !f || !f.data) return;
    if (!pal) pal = applyTheme(makePalette(), o.theme || o.colors);
    else if (o.theme || o.colors) pal = applyTheme(makePalette(), o.theme || o.colors);
    dpr = capDpr(o.dpr != null ? o.dpr : dpr);
    var isM = transform && typeof transform !== 'function' && transform.length >= 9;
    var cw = ctx.canvas.width, ch = ctx.canvas.height, OUT = [0, 0];
    var P = isM ? function (x, y) {
      var m = transform, cx = m[0] * x + m[3] * y + m[6], cy = m[1] * x + m[4] * y + m[7], cz = m[2] * x + m[5] * y + m[8];
      OUT[0] = (cx / cz * 0.5 + 0.5) * cw; OUT[1] = (0.5 - cy / cz * 0.5) * ch; return OUT;
    } : function (x, y) { var r = transform(x, y); OUT[0] = r[0]; OUT[1] = r[1]; return OUT; };
    var cache = f.__hgl2d || (f.__hgl2d = {});
    var rv = typeof o.reveal === 'number' ? Math.round(clamp(o.reveal, 0, 1.01) * 100) / 100 : 2;
    var key = rv + '|' + pal.gold.join() + pal.orange.join() + pal.red.join() + pal.ink;
    if (cache.key !== key) { build2DImages(f, pal, rv, cache); cache.key = key; }
    var lw = (isM ? dpr : 1);
    ctx.save();
    if (isM) ctx.setTransform(1, 0, 0, 1, 0, 0);
    var a = P(f.x0, f.y0), ax = a[0], ay = a[1];
    var b = P(f.x1, f.y0), bx = b[0], by = b[1];
    var c = P(f.x0, f.y1), cx2 = c[0], cy2 = c[1];
    ctx.globalAlpha = clamp(num(o.opacity, 1) * (1 - 0.8 * clamp(num(o.dim, 0), 0, 1)), 0, 1);
    ctx.save();
    ctx.transform((bx - ax) / f.w, (by - ay) / f.w, (cx2 - ax) / f.h, (cy2 - ay) / f.h, ax, ay);
    ctx.imageSmoothingEnabled = true;
    try { ctx.imageSmoothingQuality = 'high'; } catch (e) { /* older browsers */ }
    if (o.glow !== false && !pal.ink && cache.glow) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(cache.glow, 0, 0, f.w, f.h);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.drawImage(cache.img, 0, 0);
    ctx.restore();
    if (o.contours !== false) {
      if (!cache.iso) cache.iso = marching(f);
      var iso = cache.iso;
      for (var li = 0; li < iso.length; li++) {
        var L = iso[li], segs = L.segs, isIdx = Math.abs(L.v / 0.5 - Math.round(L.v / 0.5)) < 1e-3;
        rampInto(pal, L.v, OUT_C);
        var bright = pal.ink ? 0.7 : 1.25;
        ctx.strokeStyle = 'rgba(' + Math.min(255, Math.round(OUT_C[0] * 255 * bright)) + ',' + Math.min(255, Math.round(OUT_C[1] * 255 * bright)) + ',' + Math.min(255, Math.round(OUT_C[2] * 255 * bright)) + ',' + (isIdx ? 0.85 : 0.3) + ')';
        ctx.lineWidth = (isIdx ? 1.4 : 0.8) * lw;
        ctx.beginPath();
        for (var s = 0; s < segs.length; s += 5) {
          if (segs[s + 4] > rv + 0.001) continue;
          var p = P(segs[s], segs[s + 1]); ctx.moveTo(p[0], p[1]);
          p = P(segs[s + 2], segs[s + 3]); ctx.lineTo(p[0], p[1]);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  var OUT_C = [0, 0, 0];
  function build2DImages(f, pal, rv, cache) {
    var doc = typeof document !== 'undefined' ? document : null;
    if (!doc) return;
    var img = cache.img || doc.createElement('canvas');
    img.width = f.w; img.height = f.h;
    var ictx = img.getContext('2d'), id = ictx.createImageData(f.w, f.h), px = id.data, s = pal.stops, c = [0, 0, 0];
    for (var i = 0, n = f.w * f.h; i < n; i++) {
      var v = f.data[i], a0 = sstep(s[0], s[1], v);
      if (a0 <= 0 || (f.arrival && f.arrival[i] > rv)) { px[i * 4 + 3] = 0; continue; }
      rampInto(pal, v, c);
      var al = a0 * (0.12 + 0.32 * sstep(s[1], s[3] + 0.6, v)) * pal.fill;
      px[i * 4] = c[0] * 255; px[i * 4 + 1] = c[1] * 255; px[i * 4 + 2] = c[2] * 255; px[i * 4 + 3] = clamp(al, 0, 1) * 255;
    }
    ictx.putImageData(id, 0, 0);
    cache.img = img;
    var gw = Math.max(2, Math.round(f.w / 8)), gh = Math.max(2, Math.round(f.h / 8));
    var g = cache.glow || doc.createElement('canvas');
    g.width = gw; g.height = gh;
    var gctx = g.getContext('2d');
    gctx.clearRect(0, 0, gw, gh);
    gctx.imageSmoothingEnabled = true;
    gctx.globalAlpha = 0.9;
    gctx.drawImage(img, 0, 0, gw, gh);
    cache.glow = g;
  }
  // marching squares: iso-lines every 0.1 in (index every 0.5) as world-space segments [x1,y1,x2,y2,arrival]
  function marching(f) {
    var w = f.w, h = f.h, d = f.data, arr = f.arrival, st = Math.max(1, Math.round(Math.sqrt(w * h / 160000)));
    var sx = (f.x1 - f.x0) / w, sy = (f.y1 - f.y0) / h, peak = 0, i;
    for (i = 0; i < d.length; i++) if (d[i] > peak) peak = d[i];
    var out = [];
    for (var lv = 0.5; lv <= peak + 1e-6; lv = Math.round((lv + 0.1) * 10) / 10) {
      var segs = [];
      for (var y = 0; y + st < h; y += st) for (var x = 0; x + st < w; x += st) {
        var a = d[y * w + x], b = d[y * w + x + st], cc = d[(y + st) * w + x + st], dd = d[(y + st) * w + x];
        var code = (a > lv ? 8 : 0) | (b > lv ? 4 : 0) | (cc > lv ? 2 : 0) | (dd > lv ? 1 : 0);
        if (code === 0 || code === 15) continue;
        var X = f.x0 + (x + 0.5) * sx, Y = f.y0 + (y + 0.5) * sy, SX = sx * st, SY = sy * st;
        var top = [X + SX * (lv - a) / (b - a), Y], right = [X + SX, Y + SY * (lv - b) / (cc - b)];
        var bot = [X + SX * (lv - dd) / (cc - dd), Y + SY], left = [X, Y + SY * (lv - a) / (dd - a)];
        var ar = arr ? arr[y * w + x] : 0, pairs;
        switch (code) {
          case 1: case 14: pairs = [left, bot]; break;
          case 2: case 13: pairs = [bot, right]; break;
          case 3: case 12: pairs = [left, right]; break;
          case 4: case 11: pairs = [top, right]; break;
          case 5: pairs = [left, top, bot, right]; break;
          case 6: case 9: pairs = [top, bot]; break;
          case 7: case 8: pairs = [left, top]; break;
          case 10: pairs = [left, bot, top, right]; break;
        }
        for (var k = 0; k < pairs.length; k += 2) segs.push(pairs[k][0], pairs[k][1], pairs[k + 1][0], pairs[k + 1][1], ar);
      }
      out.push({ v: lv, segs: segs });
    }
    return out;
  }

  root.HailGL = HailGL;
})(typeof window !== 'undefined' ? window : this);
