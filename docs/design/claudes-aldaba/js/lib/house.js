/* Claude's Aldaba · js/lib/house.js · window.House
   A generative "house portrait" of one sample home: a thin-line architectural elevation with a slight 2.5D
   oblique, shingle courses weathered by roof age, hail impacts drawn as the Aldaba knock ring (sized by the hail
   at that door, colored by the hail scale) and a small mono annotation layer.

     House.draw(canvas, home, {t, theme, hailReveal, highlight, labels, dpr, font, sheet})
     House.animate(canvas, home, opts) -> {stop()}     the build (House.DURATION s), then a faint ambient knock
     House.form(home)   -> 'cottage' | 'ranch' | 'split' | 'two' | 'large'
     House.labels(home, 'en'|'es') -> {built, roof, hail}   House.themes {dark, light}   House.hailColor(in, theme)

   home  = {addr, built, roof, own, hail, score}. Seeded from the address: the same home always draws the same.
   t     = seconds into the build (omit = finished). hailReveal 0..1 scrubs the hail. highlight 'roof'|'siding'|'gutters'.
   theme = {ink, line, acc, h1, h15, h2, bg} (colors; missing keys fall back to Aldaba graphite or light).
   The drawing holds no text except opts.labels {built, roof, hail} (the caller localizes; labels:false = none).
   Pure Canvas2D, no dependencies. animate() respects prefers-reduced-motion (draws the final state once). */
(function (root) {
  'use strict';

  var TAU = Math.PI * 2;
  var KX = 0.36, KY = 0.19;                  // oblique depth: 1 ft back reads 0.36 ft right and 0.19 ft up
  var TL = { line: [0, 2.1], fill: [0.45, 2.5], shingle: [1.75, 3.2], hail: [3.05, 4.8], notes: [4.3, 5.4] };
  var DURATION = 5.5;
  var MONO = '"Geist Mono","Geist Mono L",ui-monospace,"SF Mono",Menlo,Consolas,monospace';

  var THEMES = {
    dark: { ink: '#f1f2f4', line: '#2b2d32', acc: '#f5883a', h1: '#f2c14e', h15: '#f5883a', h2: '#ff4f5a', bg: '#07080a' },
    light: { ink: '#18191c', line: '#d0d2cc', acc: '#f5883a', h1: '#c9960e', h15: '#d8661a', h2: '#d9303c', bg: '#eef0ee' }
  };

  // ---------------------------------------------------------------- small utils
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function seg(t, a, b) { return b <= a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a), 0, 1); }
  function eo(x) { return 1 - Math.pow(1 - x, 3); }
  function eio(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function eback(x) { var c = 1.5; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }
  function hash(s) { var h = 2166136261 >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function rng(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function parse(c) {
    if (Array.isArray(c)) return c;
    c = String(c || '').trim(); var m;
    if (c[0] === '#') {
      if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
      return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    }
    if ((m = c.match(/rgba?\(([^)]+)\)/))) { var p = m[1].split(/[\s,\/]+/).map(parseFloat); return [p[0], p[1], p[2]]; }
    return [128, 128, 128];
  }
  function rgba(c, a) { c = parse(c); return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (+clamp(a, 0, 1)).toFixed(3) + ')'; }
  function mix(a, b, k) { a = parse(a); b = parse(b); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function lum(c) { c = parse(c); return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; }
  function inPoly(pt, poly) {
    var x = pt[0], y = pt[1], ins = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins;
    }
    return ins;
  }
  function area(poly) { var a = 0; for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]); return Math.abs(a / 2); }
  function proj(p) { return [p[0] + p[2] * KX, -(p[1] + p[2] * KY)]; }
  function reduced() { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }

  // ---------------------------------------------------------------- form
  function form(home) {
    var y = +(home && home.built) || 1975;
    if (y < 1960) return 'cottage';
    if (y < 1980) return rng(hash(String(home.addr || '') + '#form'))() < 0.38 ? 'split' : 'ranch';
    if (y < 2000) return 'two';
    return 'large';
  }

  // ---------------------------------------------------------------- scene builder (world feet: x right, y up, z back)
  function B(r) { this.r = r; this.parts = []; this.knock = null; this.lamp = null; }
  B.prototype.add = function (p) { this.parts.push(p); return p; };

  // A box with a roof. o = {x, w, z, d, h, roof:'gable'|'hip'|'front', p (rise/run), found, meet (main mass for bumps)}
  B.prototype.mass = function (o) {
    var x0 = o.x, x1 = o.x + o.w, z0 = o.z, z1 = o.z + o.d, h = o.h, f = o.found == null ? 1.1 : o.found;
    var run = o.roof === 'front' ? o.w / 2 : o.d / 2;
    o.H = h + run * o.p;
    if (!o.meet) {
      var side = [[x1, 0, z0], [x1, 0, z1], [x1, h, z1]];
      if (o.roof === 'gable') side.push([x1, o.H - 0.5, z0 + o.d / 2]);
      side.push([x1, h, z0]);
      this.add({ t: 'wall', face: 'side', poly: side, found: f, grp: 'siding' });
    } else {
      this.add({ t: 'wall', face: 'side', poly: [[x1, 0, z0], [x1, 0, z1], [x1, h, z1], [x1, h, z0]], found: f, grp: 'siding' });
    }
    var front = [[x0, 0, z0], [x1, 0, z0], [x1, h, z0]];
    if (o.roof === 'front') front.push([x0 + o.w / 2, o.H - 0.5, z0]);
    front.push([x0, h, z0]);
    this.add({ t: 'wall', face: 'front', poly: front, found: f, grp: 'siding', eave: o.roof !== 'front' ? h : null, x0: x0, x1: x1, z: z0 });
    ROOF[o.roof].call(this, o);
    return o;
  };

  var ROOF = {
    gable: function (o) {                                  // ridge along the street
      var p = o.p, ov = 1.15, rov = 0.8, run = o.d / 2, H = o.H, zr = o.z + run;
      var ye = o.h - ov * p, ze = o.z - ov, zb = o.z + o.d + ov, xl = o.x - rov, xr = o.x + o.w + rov, th = 0.55;
      this.add({ t: 'roof', poly: [[xl, ye, ze], [xr, ye, ze], [xr, H, zr], [xl, H, zr]], E0: [xl, ye, ze], E1: [xr, ye, ze], V: [0, H - ye, zr - ze], grp: 'roof', main: true });
      this.add({ t: 'rake', poly: [[xr, ye, ze], [xr, H, zr], [xr, ye, zb], [xr, ye - th, zb], [xr, H - th, zr], [xr, ye - th, ze]], grp: 'roof' });
      this.add({ t: 'gutter', a: [xl + 0.15, ye, ze], b: [xr - 0.15, ye, ze], downs: [[o.x + 0.45, o.z], [o.x + o.w - 0.45, o.z]], grp: 'gutters' });
    },
    hip: function (o) {
      var p = o.p, ov = 1.15, run = o.d / 2, H = o.H, zr = o.z + run;
      var ye = o.h - ov * p, xl = o.x - ov, xr = o.x + o.w + ov, ze = o.z - ov, zb = o.z + o.d + ov, inset = run + ov;
      var mid = o.x + o.w / 2, rl = [Math.min(xl + inset, mid), H, zr], rr = [Math.max(xr - inset, mid), H, zr];
      this.add({ t: 'roof', poly: [[xr, ye, ze], [xr, ye, zb], rr], E0: [xr, ye, ze], E1: [xr, ye, zb], V: [rr[0] - xr, H - ye, 0], grp: 'roof' });
      this.add({ t: 'roof', poly: [[xl, ye, ze], [xr, ye, ze], rr, rl], E0: [xl, ye, ze], E1: [xr, ye, ze], V: [0, H - ye, zr - ze], grp: 'roof', main: true });
      this.add({ t: 'gutter', a: [xl + 0.15, ye, ze], b: [xr - 0.15, ye, ze], downs: [[o.x + 0.45, o.z], [o.x + o.w - 0.45, o.z]], grp: 'gutters' });
      this.add({ t: 'gutter', a: [xr, ye, ze + 0.15], b: [xr, ye, zb - 0.15], downs: [], grp: 'gutters' });
    },
    front: function (o) {                                  // gable faces the street; ridge runs back
      var p = o.p, ov = 0.9, fov = 0.85, half = o.w / 2, H = o.H, cx = o.x + half, th = 0.55;
      var ye = o.h - ov * p, xl = o.x - ov, xr = o.x + o.w + ov, zf = o.z - fov, zbE, zbR;
      if (o.meet) { zbE = o.meet.z + (ye - o.meet.h) / o.meet.p; zbR = o.meet.z + (H - o.meet.h) / o.meet.p; }
      else { zbE = zbR = o.z + o.d + fov; }
      if (p < KY / KX) this.add({ t: 'roof', poly: [[cx, H, zf], [xl, ye, zf], [xl, ye, zbE], [cx, H, zbR]], E0: [xl, ye, zf], E1: [xl, ye, zbE], V: [cx - xl, H - ye, 0], grp: 'roof' });
      this.add({ t: 'roof', poly: [[cx, H, zf], [xr, ye, zf], [xr, ye, zbE], [cx, H, zbR]], E0: [xr, ye, zf], E1: [xr, ye, zbE], V: [cx - xr, H - ye, 0], grp: 'roof', main: !o.meet });
      this.add({ t: 'rake', poly: [[xl, ye, zf], [cx, H, zf], [xr, ye, zf], [xr, ye - th, zf], [cx, H - th, zf], [xl, ye - th, zf]], grp: 'roof' });
      this.add({ t: 'gutter', a: [xr, ye, zf + 0.15], b: [xr, ye, zbE - 0.15], downs: [], side: true, grp: 'gutters' });
    }
  };

  B.prototype.win = function (x, y, w, h, z, o) {
    o = o || {};
    return this.add({ t: 'win', poly: [[x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z]], cols: o.cols || 1, rows: o.rows || 1, shutters: !!o.shutters, grp: 'open' });
  };
  B.prototype.winS = function (xf, z, y, dz, h, o) {
    o = o || {};
    return this.add({ t: 'win', side: true, poly: [[xf, y, z], [xf, y, z + dz], [xf, y + h, z + dz], [xf, y + h, z]], cols: o.cols || 1, rows: o.rows || 2, grp: 'open' });
  };
  B.prototype.door = function (x, y, w, h, z, o) {
    o = o || {};
    this.knock = [x + w / 2, y + h * 0.6, z];
    this.lamp = [x + w + 0.75, y + h * 0.78, z];
    if (o.transom) this.win(x - 0.1, y + h + 0.25, w + 0.2, 1.3, z, { cols: 3, rows: 1 });
    this.add({ t: 'door', poly: [[x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z]], grp: 'open' });
    if (o.lite) this.win(x + w + 0.35, y + 0.2, 1.1, h - 0.4, z, { cols: 1, rows: 3 });
  };
  B.prototype.garage = function (x, y, w, h, z, o) {
    o = o || {};
    this.add({ t: 'garage', poly: [[x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z]], rows: o.rows || 4, lites: !!o.lites, grp: 'open' });
  };
  B.prototype.stoop = function (x, w, z, dep, ht) {
    var zf = z - dep, faces = [
      { tone: 'side', poly: [[x + w, 0, zf], [x + w, 0, z], [x + w, ht, z], [x + w, ht, zf]] },
      { tone: 'front', poly: [[x, 0, zf], [x + w, 0, zf], [x + w, ht, zf], [x, ht, zf]] },
      { tone: 'top', poly: [[x, ht, zf], [x + w, ht, zf], [x + w, ht, z], [x, ht, z]] }];
    var steps = [];
    for (var k = 1; ht > 0.9 && k < Math.round(ht / 0.6); k++) steps.push([[x, ht * k / Math.round(ht / 0.6), zf], [x + w, ht * k / Math.round(ht / 0.6), zf]]);
    this.add({ t: 'solid', faces: faces, lines: steps, grp: 'trim' });
  };
  B.prototype.chimney = function (x, cw, z, cd, top, m) {
    var y0 = m.h + z * m.p - 0.3, y1 = m.h + (z + cd) * m.p - 0.3, c = 0.22;
    this.add({ t: 'solid', grp: 'roof', brick: true, faces: [
      { tone: 'side', poly: [[x + cw, y0, z], [x + cw, y1, z + cd], [x + cw, top, z + cd], [x + cw, top, z]] },
      { tone: 'front', poly: [[x, y0, z], [x + cw, y0, z], [x + cw, top, z], [x, top, z]], brick: true },
      { tone: 'side', poly: [[x + cw + c, top, z - c], [x + cw + c, top, z + cd + c], [x + cw + c, top + 0.4, z + cd + c], [x + cw + c, top + 0.4, z - c]] },
      { tone: 'front', poly: [[x - c, top, z - c], [x + cw + c, top, z - c], [x + cw + c, top + 0.4, z - c], [x - c, top + 0.4, z - c]] },
      { tone: 'top', poly: [[x - c, top + 0.4, z - c], [x + cw + c, top + 0.4, z - c], [x + cw + c, top + 0.4, z + cd + c], [x - c, top + 0.4, z + cd + c]] }] });
  };
  // Gable dormer standing on mass m's front roof plane (y = m.h + (z - m.z) * m.p).
  B.prototype.dormer = function (x, w, zd, hd, pd, m) {
    var yb = m.h + (zd - m.z) * m.p, yt = yb + hd, half = w / 2, xc = x + half, Hd = yt + half * pd, ov = 0.45, th = 0.42;
    var zt = m.z + (yt - m.h) / m.p, ye = yt - ov * pd, zf = zd - 0.5, zE = m.z + (ye - m.h) / m.p, zR = m.z + (Hd - m.h) / m.p;
    this.add({ t: 'wall', face: 'side', poly: [[x + w, yb, zd], [x + w, yt, zd], [x + w, yt, zt]], found: 0, grp: 'siding' });
    this.add({ t: 'wall', face: 'front', poly: [[x, yb, zd], [x + w, yb, zd], [x + w, yt, zd], [xc, Hd - 0.4, zd], [x, yt, zd]], found: 0, grp: 'siding' });
    this.win(x + (w - 2.6) / 2, yb + 0.55, 2.6, hd - 1.1, zd, { cols: 2, rows: 2 });
    this.add({ t: 'roof', poly: [[xc, Hd, zf], [x + w + ov, ye, zf], [x + w + ov, ye, zE], [xc, Hd, zR]], E0: [x + w + ov, ye, zf], E1: [x + w + ov, ye, zE], V: [xc - (x + w + ov), Hd - ye, 0], grp: 'roof', small: true });
    this.add({ t: 'rake', poly: [[x - ov, ye, zf], [xc, Hd, zf], [x + w + ov, ye, zf], [x + w + ov, ye - th, zf], [xc, Hd - th, zf], [x - ov, ye - th, zf]], grp: 'roof' });
  };
  // Small gabled hood over the entry, on two slim posts.
  B.prototype.hood = function (xc, w, z, dep, y, pd) {
    var half = w / 2, H = y + half * pd, zf = z - dep, xl = xc - half, xr = xc + half, th = 0.42;
    this.add({ t: 'post', a: [xl + 0.3, 0.2, zf + 0.3], b: [xl + 0.3, y - th, zf + 0.3], grp: 'trim' });
    this.add({ t: 'post', a: [xr - 0.3, 0.2, zf + 0.3], b: [xr - 0.3, y - th, zf + 0.3], grp: 'trim' });
    this.add({ t: 'roof', poly: [[xc, H, zf], [xr, y, zf], [xr, y, z], [xc, H, z]], E0: [xr, y, zf], E1: [xr, y, z], V: [-half, H - y, 0], grp: 'roof', small: true });
    this.add({ t: 'wall', face: 'front', poly: [[xl + 0.2, y - th, zf + 0.05], [xr - 0.2, y - th, zf + 0.05], [xc, H - th - 0.1, zf + 0.05]], found: 0, nolap: true, grp: 'siding' });
    this.add({ t: 'rake', poly: [[xl, y, zf], [xc, H, zf], [xr, y, zf], [xr, y - th, zf], [xc, H - th, zf], [xl, y - th, zf]], grp: 'roof' });
  };
  B.prototype.brick = function (x, w, z, ht) {
    this.add({ t: 'brick', poly: [[x, 0, z], [x + w, 0, z], [x + w, ht, z], [x, ht, z]], grp: 'siding' });
  };

  var BUILD = {
    cottage: function (b, r) {                             // before 1960: small 1.5-story side-gable cottage
      var W = 26 + r() * 5, D = 26, h = 10.2, p = 0.92 + r() * 0.16, F = 1.9;
      var m = b.mass({ x: 0, w: W, z: 0, d: D, h: h, roof: 'gable', p: p, found: F });
      b.winS(W, D / 2 - 1.3, h + 1.2, 2.6, 3.2, { rows: 2 });          // half-story gable window
      b.winS(W, D * 0.3, 3.6, 3, 4.6, { rows: 2 });
      var dw = 3.2, dx = W / 2 - dw / 2;
      b.win(W * 0.14, 3.6, 3.1, 4.9, 0, { cols: 2, rows: 2 });
      b.win(W * 0.86 - 3.1, 3.6, 3.1, 4.9, 0, { cols: 2, rows: 2 });
      b.door(dx, F, dw, 6.8, 0, {});
      b.stoop(dx - 1.4, dw + 2.8, 0, 3.4, F);
      b.hood(dx + dw / 2, dw + 2.6, 0, 3.0, F + 7.4, 0.8);
      var two = r() < 0.55, chim = r() < 0.8;
      if (chim) b.chimney(two ? W * 0.05 : W * 0.8, 2.4, D * 0.3, 2.2, m.H + 2.2, m);
      if (two) { b.dormer(W * 0.19, 5.2, 3.2, 4.3, 1.0, m); b.dormer(W * 0.81 - 5.2, 5.2, 3.2, 4.3, 1.0, m); }
      else b.dormer(W / 2 - 3.2, 6.4, 3.2, 4.3, 1.0, m);
    },
    ranch: function (b, r) {                               // 1960-1979: long, low ranch, attached garage
      var W = 42 + r() * 9, D = 27 + r() * 3, h = 8.6, p = r() < 0.5 ? 4 / 12 : 5 / 12, F = 1.1;
      var hip = r() < 0.32, gar = r() < 0.82, gz = r() < 0.5 ? -1.2 : 1.4;
      b.mass({ x: 0, w: W, z: 0, d: D, h: h, roof: hip ? 'hip' : 'gable', p: p, found: F });
      if (!gar) b.winS(W, D * 0.45, 4.1, 3.4, 3.4, {});
      b.win(3, 3.1, 10.6, 4.7, 0, { cols: 3, rows: 1 });
      var dx = 16.4 + r() * 3;
      b.door(dx, F, 3.1, 6.8, 0, { lite: true });
      b.stoop(dx - 1, 6.2, 0, 3.3, F - 0.15);
      for (var bx = dx + 6.4; bx + 4.4 < W - 2.4; bx += 9) b.win(bx, 4.1, 4.4, 3.6, 0, { cols: 2, rows: 1 });
      if (gar) {
        b.mass({ x: W, w: 22, z: gz, d: 24, h: h, roof: hip ? 'hip' : 'gable', p: p, found: 0.45 });
        b.garage(W + 3, 0.45, 16, 7, gz, { rows: 4 });
      }
    },
    split: function (b, r) {                               // 1960-1979: split-level
      var p = 5 / 12, front = r() < 0.4, tuck = r() < 0.55, cz = -1.6;
      b.mass({ x: 0, w: 25, z: 0, d: 28, h: 11.2, roof: 'gable', p: p, found: 3.0 });
      b.win(3, 5, 10, 4.8, 0, { cols: 3, rows: 1 });
      b.door(19.1, 0.6, 3.1, 6.8, 0, {});
      b.stoop(18.1, 5.1, 0, 3.1, 0.6);
      b.mass({ x: 25, w: 23, z: cz, d: 26, h: 18.2, roof: front ? 'front' : 'gable', p: front ? 6 / 12 : p, found: 0.6 });
      b.winS(48, cz + 9, 11.6, 3.2, 3.9, {});
      b.win(28, 11.6, 4.2, 3.9, cz, { cols: 2, rows: 1 });
      b.win(39.5, 11.6, 4.2, 3.9, cz, { cols: 2, rows: 1 });
      if (tuck) b.garage(29, 0.6, 16, 7, cz, { rows: 4 });
      else { b.win(28, 3, 6.5, 3.6, cz, { cols: 3, rows: 1 }); b.win(39.5, 3, 4.2, 3.6, cz, { cols: 2, rows: 1 }); }
    },
    two: function (b, r) {                                 // 1980-1999: two-story with attached garage
      var W = 32 + r() * 6, D = 28, h = 18.4, p = r() < 0.5 ? 7 / 12 : 8 / 12, F = 1.1;
      var gl = r() < 0.28, gf = r() < 0.45, gz = -(2.5 + r() * 4), shut = r() < 0.5, pair = r() < 0.5;
      b.mass({ x: 0, w: W, z: 0, d: D, h: h, roof: 'gable', p: p, found: F });
      b.winS(W, D * 0.5, 11.4, 3.2, 4.6, {});
      [W * 0.12, W * 0.5 - 1.6, W * 0.88 - 3.2].forEach(function (x) { b.win(x, 11.4, 3.2, 4.6, 0, { cols: 2, rows: 2, shutters: shut }); });
      b.win(W * 0.08, 3.3, 5.8, 4.8, 0, { cols: 2, rows: 2, shutters: shut });
      b.win(W * 0.92 - 5.8, 3.3, 5.8, 4.8, 0, { cols: 2, rows: 2, shutters: shut });
      b.door(W * 0.5 - 1.6, F, 3.2, 7, 0, { transom: true });
      b.stoop(W * 0.5 - 3, 6, 0, 3.6, F);
      b.mass({ x: gl ? -22 : W, w: 22, z: gz, d: 24, h: 9.6, roof: gf ? 'front' : 'gable', p: gf ? 6 / 12 : p, found: 0.45 });
      var gx = gl ? -22 : W;
      if (pair && !gf) { b.garage(gx + 2.2, 0.45, 8, 7, gz, { rows: 4 }); b.garage(gx + 11.8, 0.45, 8, 7, gz, { rows: 4 }); }
      else b.garage(gx + 3, 0.45, 16, 7, gz, { rows: 4 });
    },
    large: function (b, r) {                               // 2000+: larger two-story, front gable, 3-car garage
      var W = 44 + r() * 6, D = 34, h = 19.6, p = 8 / 12, hip = r() < 0.6, F = 1.2, bx = hip ? 7.5 : 3, bw = 16, gz = -7;
      var m = b.mass({ x: 0, w: W, z: 0, d: D, h: h, roof: hip ? 'hip' : 'gable', p: p, found: F });
      b.win(bx + bw + 3.3, 11.8, 3.6, 5, 0, { cols: 2, rows: 2 });
      b.win(W - 13, 11.8, 3.4, 5, 0, { cols: 2, rows: 2 });
      b.win(W - 7.4, 11.8, 3.4, 5, 0, { cols: 2, rows: 2 });
      b.win(W - 13, 3.6, 9, 5.2, 0, { cols: 3, rows: 2 });
      b.door(bx + bw + 3.3, F, 3.6, 7.8, 0, { transom: true });
      b.stoop(bx + bw + 2, 6.2, 0, 3.4, F);
      b.mass({ x: bx, w: bw, z: -3, d: 3, h: h, roof: 'front', p: 10 / 12, found: F, meet: m });
      b.brick(bx, bw, -3, 3.4);
      b.win(bx + 3.4, 4.2, 9.2, 6.2, -3, { cols: 3, rows: 2 });
      b.win(bx + 4.5, 12, 7, 5.2, -3, { cols: 2, rows: 2 });
      b.mass({ x: W, w: 32, z: gz, d: 24, h: 10.6, roof: hip ? 'hip' : 'gable', p: 7 / 12, found: 0.45 });
      b.garage(W + 2.6, 0.45, 16, 7.6, gz, { rows: 4, lites: true });
      b.garage(W + 20.6, 0.45, 9, 7.6, gz, { rows: 4, lites: true });
    }
  };

  function build(home) {
    var key = String(home.addr || '') + '|' + (home.built || '');
    var seed = hash(key), r = rng(seed), kind = form(home), b = new B(r);
    BUILD[kind](b, r);
    return { kind: kind, parts: b.parts, knock: b.knock, lamp: b.lamp, seed: seed,
      age: Math.max(0, +home.roof || 0), hail: Math.max(0, +home.hail || 0), own: !!home.own, built: +home.built || null };
  }

  // ---------------------------------------------------------------- layout (world -> CSS px), cached per size
  function layout(scene, w, h, opt) {
    var fs = clamp(Math.round(w / 92 * 2) / 2, 8.5, 12);
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    scene.parts.forEach(function (p) {
      var pts = p.poly || (p.faces ? [].concat.apply([], p.faces.map(function (f) { return f.poly; })) : [p.a, p.b]);
      pts.forEach(function (q) { var v = proj(q); minX = Math.min(minX, v[0]); maxX = Math.max(maxX, v[0]); minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1]); });
    });
    var padX = Math.max(w * 0.075, 16), padT = fs * 3.6 + h * 0.06, padB = fs * 2.9 + h * 0.07;
    var bw = maxX - minX, bh = maxY - minY, aw = w - 2 * padX, ah = h - padT - padB;
    var sRef = Math.min(aw / 56, ah / 31);
    var s = Math.min(aw / bw, ah / bh, sRef);
    var ox = w / 2 - s * (minX + maxX) / 2, oy = (h - padB) - s * maxY;
    function S(p) { var v = proj(p); return [ox + s * v[0], oy + s * v[1]]; }
    function Sv(v) { return [s * (v[0] + v[2] * KX), -s * (v[1] + v[2] * KY)]; }
    var L = { w: w, h: h, s: s, fs: fs, S: S, groundY: oy + s * maxY, x0: ox + s * minX, x1: ox + s * maxX, top: oy + s * minY,
      lw: clamp(0.5 + s * 0.04, 0.7, 1.15), parts: [], roofs: [], rings: [], sheet: opt.sheet != null ? !!opt.sheet : w >= 480 };
    var rr = rng(scene.seed ^ 0x51ed27), N = scene.parts.length;

    scene.parts.forEach(function (p, k) {
      var q = { t: p.t, grp: p.grp, k: k, face: p.face, src: p };
      q.la = 0.03 + 0.64 * (k / N);                      // line window (in line-phase units)
      q.fa = TL.fill[0] + (TL.fill[1] - TL.fill[0] - 0.55) * (k / N);  // fill window start (s)
      if (p.poly) q.pts = p.poly.map(S);
      if (p.t === 'wall') wallLayout(q, p, S, s, rr);
      else if (p.t === 'roof') roofLayout(q, p, S, Sv, s, scene, rr, L);
      else if (p.t === 'gutter') gutterLayout(q, p, S, s);
      else if (p.t === 'post') { q.pts = [S(p.a), S(p.b)]; }
      else if (p.t === 'solid') { q.faces = p.faces.map(function (f) { return { tone: f.tone, pts: f.poly.map(S), brick: f.brick }; }); q.lines = (p.lines || []).map(function (l) { return l.map(S); }); q.pts = q.faces[1].pts; q.occ = q.faces.map(function (f) { return f.pts; }); }
      else if (p.t === 'brick') brickLayout(q, p, S, s);
      if (!q.occ && q.pts && q.pts.length > 2) q.occ = [q.pts];
      L.parts.push(q);
    });
    if (scene.knock) L.knock = S(scene.knock);
    if (scene.lamp) L.lamp = S(scene.lamp);
    hailLayout(L, scene, rng(scene.seed ^ 0xa11ce));
    // annotation band above the roof
    L.bandY = Math.max(fs + 9, L.top - (fs * 1.7 + h * 0.035));
    L.dimY = L.groundY + Math.max(fs * 1.55, 12);
    return L;
  }

  function wallLayout(q, p, S, s) {
    var ys = p.poly.map(function (v) { return v[1]; }), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var f = p.found || 0;
    if (f > 0) {
      var band = p.face === 'front'
        ? [[p.poly[0][0], y0, p.poly[0][2]], [p.poly[1][0], y0, p.poly[1][2]], [p.poly[1][0], y0 + f, p.poly[1][2]], [p.poly[0][0], y0 + f, p.poly[0][2]]]
        : [[p.poly[0][0], y0, p.poly[0][2]], [p.poly[1][0], y0, p.poly[1][2]], [p.poly[1][0], y0 + f, p.poly[1][2]], [p.poly[0][0], y0 + f, p.poly[0][2]]];
      q.found = band.map(S);
    }
    if (!p.nolap) {
      var e = 0.62, px = e * s; if (px < 2.4) e *= Math.ceil(2.4 / px);
      var xs = p.poly.map(function (v) { return v[0]; }), zs = p.poly.map(function (v) { return v[2]; });
      var xa = Math.min.apply(null, xs), xb = Math.max.apply(null, xs), za = Math.min.apply(null, zs), zb = Math.max.apply(null, zs);
      q.laps = [];
      for (var y = y0 + f + e; y < y1 - 0.05; y += e) {
        q.laps.push(p.face === 'front' ? [S([xa, y, za]), S([xb, y, za])] : [S([xa, y, za]), S([xa, y, zb])]);
      }
    }
    if (p.eave != null && p.face === 'front') {
      q.shadow = [S([p.x0, p.eave, p.z]), S([p.x1, p.eave, p.z]), S([p.x1, p.eave - 1.5, p.z]), S([p.x0, p.eave - 1.5, p.z])];
    }
  }

  function roofLayout(q, p, S, Sv, s, scene, rr, L) {
    var E0 = S(p.E0), Es = Sv([p.E1[0] - p.E0[0], p.E1[1] - p.E0[1], p.E1[2] - p.E0[2]]), Vs = Sv(p.V);
    var det = Es[0] * Vs[1] - Es[1] * Vs[0];
    if (Math.abs(det) < 1e-6) return;
    function uv(pt) { var dx = pt[0] - E0[0], dy = pt[1] - E0[1]; return [(dx * Vs[1] - dy * Vs[0]) / det, (Es[0] * dy - Es[1] * dx) / det]; }
    function at(u, v) { return [E0[0] + u * Es[0] + v * Vs[0], E0[1] + u * Es[1] + v * Vs[1]]; }
    var us = q.pts.map(uv), umin = 1e9, umax = -1e9, vmax = 0;
    us.forEach(function (a) { umin = Math.min(umin, a[0]); umax = Math.max(umax, a[0]); vmax = Math.max(vmax, a[1]); });
    var lenE = Math.hypot(Es[0], Es[1]), lenV = Math.hypot(Vs[0], Vs[1]);
    q.at = at; q.uv = uv; q.umin = umin; q.umax = umax; q.vmax = vmax; q.Es = Es; q.Vs = Vs; q.E0 = E0;
    q.area = area(q.pts); q.main = !!p.main; q.small = !!p.small;
    // world unit vectors on the plane -> screen (for the rings lying on the roof)
    var le = Math.hypot(p.E1[0] - p.E0[0], p.E1[1] - p.E0[1], p.E1[2] - p.E0[2]), lv = Math.hypot(p.V[0], p.V[1], p.V[2]);
    q.bu = [Es[0] / le / s, Es[1] / le / s]; q.bv = [Vs[0] / lv / s, Vs[1] / lv / s];     // per px of world radius
    // shingle courses: count from the on-screen slope length, joints per roof age
    var age = scene.age, sp = clamp(s * 0.36, 2.5, 4.6), n = clamp(Math.round(lenV * vmax / sp), 3, 72);
    var threeTab = age >= 17, sigma = 0.18 + clamp(age / 26, 0, 1) * 0.55, base = 0.045 + clamp(age, 0, 30) * 0.0016;
    var streaks = [];
    if (age >= 15) for (var st = 0, ns = 2 + Math.floor(rr() * 3); st < ns; st++) streaks.push([umin + rr() * (umax - umin), 0.01 + rr() * 0.03, vmax * (0.25 + rr() * 0.5)]);
    var spots = clamp((age - 10) / 55, 0, 0.35);
    q.courses = [];
    for (var k = 0; k < n; k++) {
      var v0 = vmax * k / n, v1 = vmax * (k + 1) / n, tabs = [], tw = sp * (threeTab ? 2.7 : 1.6);
      var u = umin - (threeTab ? (k % 2) * 0.5 * tw / lenE : rr() * tw / lenE);
      while (u < umax) {
        var wpx = threeTab ? tw : sp * (1.3 + rr() * 2.3), u1 = u + wpx / lenE;
        var tone = (rr() * 2 - 1) * sigma;
        if (rr() < spots) tone += rr() < 0.5 ? 1.1 : -0.9;
        var mid = (u + u1) / 2, boost = 0;
        streaks.forEach(function (sk) { if (Math.abs(mid - sk[0]) < sk[1] && v0 > vmax - sk[2]) boost += 0.5 * (1 - (vmax - v0) / sk[2]); });
        tone += boost + (v0 / vmax) * 0.25;            // lighter toward the ridge (top light)
        var a0 = at(u, v0), a1 = at(u1, v0), a2 = at(u1, v1), a3 = at(u, v1);
        tabs.push({ q: [a0, a1, a2, a3], tone: tone, u: (mid - umin) / (umax - umin) });
        u = u1;
      }
      q.courses.push({ line: [at(umin, v0), at(umax, v0)], tabs: tabs, base: base });
    }
    L.roofs.push(q);
  }

  function gutterLayout(q, p, S, s) {
    var g = 0.42, a = p.a, b = p.b;
    q.band = [S(a), S(b), S([b[0], b[1] - g, b[2]]), S([a[0], a[1] - g, a[2]])];
    q.pts = q.band;
    q.downs = (p.downs || []).map(function (d) {
      var x = d[0], zw = d[1] - 0.28, yt = a[1] - g;
      return [S([x, yt, a[2] + 0.2]), S([x, yt - 0.9, zw]), S([x, 0.5, zw]), S([x, 0.2, zw - 0.8])];
    });
    q.dw = Math.max(0.9, 0.3 * s);
  }

  function brickLayout(q, p, S, s) {
    var x0 = p.poly[0][0], x1 = p.poly[1][0], z = p.poly[0][2], ht = p.poly[2][1];
    var rh = 0.34, px = rh * s; if (px < 2.2) rh *= Math.ceil(2.2 / px);
    var bl = rh * 2.2, rows = [], joints = [];
    for (var y = rh, i = 0; y < ht - 0.01; y += rh, i++) {
      rows.push([S([x0, y, z]), S([x1, y, z])]);
      for (var x = x0 + (i % 2 ? bl / 2 : 0) + bl; x < x1 - 0.1; x += bl) joints.push([S([x, y - rh, z]), S([x, y, z])]);
    }
    q.rows = rows; q.joints = joints;
  }

  function hailLayout(L, scene, r) {
    var hail = scene.hail;
    L.rings = []; L.hero = null;
    var roofs = L.roofs.filter(function (q) { return q.courses && !q.small && q.area > 30; });
    if (!roofs.length) return;
    var hero = roofs.filter(function (q) { return q.main; }).sort(function (a, b) { return b.area - a.area; })[0] || roofs[0];
    var parts = L.parts;
    function occluded(pt, k) {
      for (var i = k + 1; i < parts.length; i++) {
        var o = parts[i].occ; if (!o) continue;
        for (var j = 0; j < o.length; j++) if (inPoly(pt, o[j])) return true;
      }
      return false;
    }
    function basis(q, rad) {
      var kp = 0.55, a = [kp * q.bu[0] * rad + (1 - kp) * rad, kp * q.bu[1] * rad], b = [kp * q.bv[0] * rad, kp * q.bv[1] * rad - (1 - kp) * rad];
      return [a, b];
    }
    function fits(q, c, bs, pad) {
      if (!inPoly(c, q.pts) || occluded(c, q.k)) return false;
      for (var i = 0; i < 8; i++) {
        var an = i / 8 * TAU, ca = Math.cos(an) * pad, sa = Math.sin(an) * pad;
        var pt = [c[0] + bs[0][0] * ca + bs[1][0] * sa, c[1] + bs[0][1] * ca + bs[1][1] * sa];
        if (!inPoly(pt, q.pts) || occluded(pt, q.k)) return false;
      }
      return true;
    }
    var unit = clamp(L.s * 0.6, 3.1, 12.5), rHero = unit * clamp(hail / 1.75, 0.5, 1.3);
    // roof anchor for the roof-age callout (placed first so no ring sits on it)
    var cand = [[0.8, 0.5], [0.72, 0.42], [0.86, 0.36], [0.64, 0.56], [0.9, 0.62], [0.58, 0.4]];
    for (var ci = 0; ci < cand.length; ci++) {
      var uu = hero.umin + (hero.umax - hero.umin) * cand[ci][0], pt = hero.at(uu, hero.vmax * cand[ci][1]);
      if (inPoly(pt, hero.pts) && !occluded(pt, hero.k)) { L.roofA = pt; break; }
    }
    if (!L.roofA) L.roofA = hero.at((hero.umin + hero.umax) / 2, hero.vmax * 0.5);
    if (!(hail > 0)) return;
    var n = clamp(Math.round(7 + (hail - 0.75) * 14), 4, 26), placed = [];
    function far(c, rad) {
      if (Math.hypot(c[0] - L.roofA[0], c[1] - L.roofA[1]) < rad + 6) return false;
      for (var i = 0; i < placed.length; i++) { var o = placed[i]; if (Math.hypot(c[0] - o.c[0], c[1] - o.c[1]) < (rad + o.r) * 1.25 + 3) return false; }
      return true;
    }
    for (var tries = 0; tries < 80 && !L.hero; tries++) {
      var c = hero.at(hero.umin + (hero.umax - hero.umin) * (0.12 + r() * 0.3), hero.vmax * (0.28 + r() * 0.36)), bs = basis(hero, rHero);
      if (fits(hero, c, bs, 1.2) && far(c, rHero)) { L.hero = { c: c, r: rHero, b: bs, q: hero, s0: 0.42, hero: true }; placed.push(L.hero); }
    }
    var tot = roofs.reduce(function (a, q) { return a + q.area; }, 0);
    for (tries = 0; tries < n * 60 && placed.length < n; tries++) {
      var pick = r() * tot, q = roofs[0];
      for (var i = 0; i < roofs.length; i++) { pick -= roofs[i].area; if (pick <= 0) { q = roofs[i]; break; } }
      var m = 0.5 + 0.42 * Math.pow(r(), 0.8), rad = rHero * m;
      var c2 = q.at(q.umin + (q.umax - q.umin) * r(), q.vmax * (0.06 + r() * 0.9)), bs2 = basis(q, rad);
      if (fits(q, c2, bs2, 1.15) && far(c2, rad)) placed.push({ c: c2, r: rad, b: bs2, q: q, s0: r() * 0.8 });
    }
    placed.sort(function (a, b) { return a.s0 - b.s0; });
    L.rings = placed;
  }

  // ---------------------------------------------------------------- theme
  function theme(th) {
    th = th || {};
    var dark = th.bg ? lum(th.bg) < 0.45 : !(th.ink && lum(th.ink) < 0.5);
    var d = dark ? THEMES.dark : THEMES.light, T = { dark: dark };
    for (var k in d) T[k] = th[k] || d[k];
    if (th.h0) T.h0 = th.h0;
    var bg = T.bg, ink = T.ink;
    function c(v) { return 'rgb(' + v.map(Math.round).join(',') + ')'; }
    T.wallF = c(dark ? mix(bg, ink, 0.05) : mix(bg, '#ffffff', 0.72));
    T.wallS = c(dark ? mix(bg, ink, 0.022) : mix(bg, ink, 0.05));
    T.roof = c(dark ? mix(bg, ink, 0.075) : mix(bg, ink, 0.1));
    T.glass = c(dark ? mix(bg, ink, 0.012) : mix(bg, ink, 0.17));
    T.door = c(dark ? mix(bg, ink, 0.1) : mix(bg, ink, 0.2));
    T.found = c(dark ? mix(bg, ink, 0.03) : mix(bg, ink, 0.09));
    T.top = c(dark ? mix(bg, ink, 0.1) : mix(bg, '#ffffff', 0.85));
    T.metal = c(dark ? mix(bg, ink, 0.2) : mix(bg, '#ffffff', 0.9));
    T.shade = dark ? '#000000' : ink;
    T.oa = dark ? 0.7 : 0.78;                         // outline alpha
    return T;
  }
  function hailColor(inches, th) {
    var T = th && th.h1 ? th : theme(th);
    var x = +inches || 0;
    return x >= 2 ? T.h2 : x >= 1.5 ? T.h15 : x >= 1 ? T.h1 : (T.h0 || T.h1);
  }

  // ---------------------------------------------------------------- render
  function pathPoly(ctx, pts) { ctx.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }
  function partial(ctx, pts, closed, q) {
    if (q <= 0) return;
    if (q >= 1) { if (closed) pathPoly(ctx, pts); else { ctx.moveTo(pts[0][0], pts[0][1]); for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]); } return; }
    var n = pts.length, segs = closed ? n : n - 1, lens = [], tot = 0, i;
    for (i = 0; i < segs; i++) { var a = pts[i], b = pts[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]); lens.push(l); tot += l; }
    var goal = tot * q; ctx.moveTo(pts[0][0], pts[0][1]);
    for (i = 0; i < segs; i++) {
      var p0 = pts[i], p1 = pts[(i + 1) % n];
      if (goal >= lens[i]) { ctx.lineTo(p1[0], p1[1]); goal -= lens[i]; }
      else { var f = lens[i] ? goal / lens[i] : 0; ctx.lineTo(p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f); break; }
    }
  }
  function bil(q, u, v) {
    var ax = q[0][0] + (q[1][0] - q[0][0]) * u, ay = q[0][1] + (q[1][1] - q[0][1]) * u;
    var bx = q[3][0] + (q[2][0] - q[3][0]) * u, by = q[3][1] + (q[2][1] - q[3][1]) * u;
    return [ax + (bx - ax) * v, ay + (by - ay) * v];
  }
  function line(ctx, a, b) { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }

  function state(t, hailReveal) {
    var L = eio(seg(t, TL.line[0], TL.line[1]));
    return { t: t, L: L, S: seg(t, TL.shingle[0], TL.shingle[1]), H: Math.min(seg(t, TL.hail[0], TL.hail[1]), hailReveal == null ? 1 : clamp(+hailReveal, 0, 1)),
      N: seg(t, TL.notes[0], TL.notes[1]), G: eo(seg(t, 0, 0.9)) };
  }

  function render(ctx, L, T, st, o) {
    var w = L.w, h = L.h, hl = o.highlight || null;
    if (T.bg) { ctx.fillStyle = T.bg; ctx.fillRect(0, 0, w, h); } else ctx.clearRect(0, 0, w, h);
    if (L.sheet) sheet(ctx, L, T, st);
    ground(ctx, L, T, st);
    for (var i = 0; i < L.parts.length; i++) drawPart(ctx, L.parts[i], L, T, st, hl);
    hailDraw(ctx, L, T, st, hl, o);
    notesDraw(ctx, L, T, st, o);
    if (o.ambient && L.knock && st.t > DURATION) ambient(ctx, L, T, st.t - DURATION);
  }

  function sheet(ctx, L, T, st) {
    var a = st.G, g = 24, w = L.w, h = L.h;
    ctx.fillStyle = rgba(T.ink, (T.dark ? 0.055 : 0.07) * a);
    for (var y = g; y < h - 4; y += g) for (var x = g; x < w - 4; x += g) ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
    var m = 14, k = 10;
    ctx.strokeStyle = rgba(T.ink, (T.dark ? 0.28 : 0.35) * a); ctx.lineWidth = 0.75; ctx.beginPath();
    [[m, m, 1, 1], [w - m, m, -1, 1], [m, h - m, 1, -1], [w - m, h - m, -1, -1]].forEach(function (c) {
      ctx.moveTo(c[0], c[1] + c[3] * k); ctx.lineTo(c[0], c[1]); ctx.lineTo(c[0] + c[2] * k, c[1]);
    });
    ctx.stroke();
  }

  function ground(ctx, L, T, st) {
    var y = L.groundY, cx = (L.x0 + L.x1) / 2, half = (L.x1 - L.x0) / 2, g = st.G;
    // soft contact shadow
    ctx.save(); ctx.translate(cx, y - 1); ctx.scale(1, 0.085);
    var rg = ctx.createRadialGradient(0, 0, 0, 0, 0, half * 1.18);
    rg.addColorStop(0, rgba(T.shade, (T.dark ? 0.7 : 0.13) * g)); rg.addColorStop(1, rgba(T.shade, 0));
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, half * 1.18, 0, TAU); ctx.fill(); ctx.restore();
    // ground line, drawn from the middle out
    var ext = Math.min(L.w * 0.47, half + L.w * 0.2) * eo(seg(st.L, 0, 0.35));
    if (ext <= 0) return;
    var lg = ctx.createLinearGradient(cx - ext, 0, cx + ext, 0);
    lg.addColorStop(0, rgba(T.ink, 0)); lg.addColorStop(0.18, rgba(T.ink, T.oa * 0.7)); lg.addColorStop(0.82, rgba(T.ink, T.oa * 0.7)); lg.addColorStop(1, rgba(T.ink, 0));
    ctx.strokeStyle = lg; ctx.lineWidth = L.lw; ctx.beginPath(); ctx.moveTo(cx - ext, y); ctx.lineTo(cx + ext, y); ctx.stroke();
  }

  function lineP(q, st) { return eo(seg(st.L, q.la, q.la + 0.34)); }
  function fillP(q, st) { return eo(seg(st.t, q.fa, q.fa + 0.55)); }

  function drawPart(ctx, q, L, T, st, hl) {
    var lp = lineP(q, st), fp = fillP(q, st), lw = L.lw, oa = T.oa, on = hl && q.grp === hl, dim = hl && !on && q.grp !== 'open' ? 0.55 : 1;
    var stroke = on ? T.acc : T.ink, sa = on ? 0.95 : oa * dim;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    switch (q.t) {
      case 'wall': {
        if (fp > 0) {
          ctx.globalAlpha = fp; ctx.fillStyle = q.face === 'side' ? T.wallS : T.wallF; ctx.beginPath(); pathPoly(ctx, q.pts); ctx.fill();
          if (on) { ctx.fillStyle = rgba(T.acc, 0.06); ctx.fill(); }
          ctx.save(); ctx.beginPath(); pathPoly(ctx, q.pts); ctx.clip();
          if (q.laps && q.laps.length) {
            ctx.strokeStyle = on ? rgba(T.acc, 0.42) : rgba(T.ink, (T.dark ? (q.face === 'side' ? 0.07 : 0.1) : 0.13) * dim); ctx.lineWidth = 0.5; ctx.beginPath();
            q.laps.forEach(function (l) { line(ctx, l[0], l[1]); }); ctx.stroke();
          }
          if (q.shadow) {
            var g = ctx.createLinearGradient(0, q.shadow[0][1], 0, q.shadow[3][1]);
            g.addColorStop(0, rgba(T.shade, T.dark ? 0.5 : 0.12)); g.addColorStop(1, rgba(T.shade, 0));
            ctx.fillStyle = g; ctx.beginPath(); pathPoly(ctx, q.shadow); ctx.fill();
          }
          if (q.face === 'side') {                       // side faces sit in shade: darken toward the back
            var b0 = q.pts[0], b1 = q.pts[1], sg = ctx.createLinearGradient(b0[0], b0[1], b1[0], b1[1]);
            sg.addColorStop(0, rgba(T.shade, 0)); sg.addColorStop(1, rgba(T.shade, T.dark ? 0.35 : 0.06));
            ctx.fillStyle = sg; ctx.beginPath(); pathPoly(ctx, q.pts); ctx.fill();
          }
          if (q.found) { ctx.fillStyle = T.found; ctx.beginPath(); pathPoly(ctx, q.found); ctx.fill();
            ctx.strokeStyle = rgba(T.ink, 0.22 * dim); ctx.lineWidth = 0.6; ctx.beginPath(); line(ctx, q.found[3], q.found[2]); ctx.stroke(); }
          ctx.restore(); ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = rgba(stroke, sa); ctx.lineWidth = lw; ctx.beginPath(); partial(ctx, q.pts, true, lp); ctx.stroke();
        break;
      }
      case 'roof': {
        if (fp > 0) {
          ctx.globalAlpha = fp; ctx.fillStyle = T.roof; ctx.beginPath(); pathPoly(ctx, q.pts); ctx.fill(); ctx.globalAlpha = 1;
          if (q.courses) shingles(ctx, q, T, st, on, dim);
        }
        ctx.strokeStyle = rgba(stroke, sa); ctx.lineWidth = lw; ctx.beginPath(); partial(ctx, q.pts, true, lp); ctx.stroke();
        break;
      }
      case 'rake': {
        if (fp > 0) { ctx.globalAlpha = fp; ctx.fillStyle = T.top; ctx.beginPath(); pathPoly(ctx, q.pts); ctx.fill(); ctx.globalAlpha = 1; }
        ctx.strokeStyle = rgba(stroke, sa); ctx.lineWidth = lw * 0.85; ctx.beginPath(); partial(ctx, q.pts, true, lp); ctx.stroke();
        break;
      }
      case 'gutter': {
        var gOn = hl === 'gutters', ga = gOn ? 0.95 : oa * 0.85 * dim, gc = gOn ? T.acc : T.ink;
        if (fp > 0) {
          ctx.globalAlpha = fp;
          ctx.strokeStyle = gOn ? rgba(T.acc, 0.85) : T.metal; ctx.lineWidth = q.dw * (gOn ? 1.5 : 1); ctx.lineCap = 'butt';
          q.downs.forEach(function (d) { ctx.beginPath(); ctx.moveTo(d[0][0], d[0][1]); for (var i = 1; i < d.length; i++) ctx.lineTo(d[i][0], d[i][1]); ctx.stroke(); });
          ctx.fillStyle = gOn ? rgba(T.acc, 0.5) : T.metal; ctx.beginPath(); pathPoly(ctx, q.band); ctx.fill();
          ctx.globalAlpha = 1; ctx.lineCap = 'round';
        }
        ctx.strokeStyle = rgba(gc, ga); ctx.lineWidth = lw * (gOn ? 1.2 : 0.8); ctx.beginPath(); partial(ctx, q.band, true, lp); ctx.stroke();
        break;
      }
      case 'win': winDraw(ctx, q, L, T, lp, fp, dim); break;
      case 'door': doorDraw(ctx, q, L, T, lp, fp, st); break;
      case 'garage': garageDraw(ctx, q, L, T, lp, fp); break;
      case 'solid': {
        q.faces.forEach(function (f) {
          if (fp > 0) {
            ctx.globalAlpha = fp; ctx.fillStyle = f.tone === 'top' ? T.top : f.tone === 'side' ? T.wallS : T.wallF; ctx.beginPath(); pathPoly(ctx, f.pts); ctx.fill();
            if (f.tone === 'side') { ctx.fillStyle = rgba(T.shade, T.dark ? 0.25 : 0.05); ctx.fill(); }
            if (f.brick && L.s > 5) { ctx.save(); ctx.beginPath(); pathPoly(ctx, f.pts); ctx.clip(); ctx.strokeStyle = rgba(T.ink, 0.14); ctx.lineWidth = 0.5; ctx.beginPath();
              var y0 = f.pts[0][1], y1 = f.pts[3][1], stp = Math.max(2.2, L.s * 0.34); for (var y = y0 - stp; y > y1; y -= stp) { ctx.moveTo(f.pts[0][0], y); ctx.lineTo(f.pts[1][0], y); } ctx.stroke(); ctx.restore(); }
            ctx.globalAlpha = 1;
          }
          ctx.strokeStyle = rgba(stroke, sa); ctx.lineWidth = lw * 0.85; ctx.beginPath(); partial(ctx, f.pts, true, lp); ctx.stroke();
        });
        if (q.lines.length && lp > 0) { ctx.strokeStyle = rgba(T.ink, oa * 0.45 * lp); ctx.lineWidth = 0.6; ctx.beginPath(); q.lines.forEach(function (l) { line(ctx, l[0], l[1]); }); ctx.stroke(); }
        break;
      }
      case 'post': {
        ctx.strokeStyle = rgba(T.ink, oa * 0.9); ctx.lineWidth = Math.max(lw, L.s * 0.28); ctx.lineCap = 'butt'; ctx.beginPath(); partial(ctx, q.pts, false, lp); ctx.stroke(); ctx.lineCap = 'round';
        break;
      }
      case 'brick': {
        if (fp > 0) {
          ctx.globalAlpha = fp; ctx.fillStyle = T.found; ctx.beginPath(); pathPoly(ctx, q.pts); ctx.fill();
          ctx.strokeStyle = rgba(on ? T.acc : T.ink, T.dark ? 0.13 : 0.16); ctx.lineWidth = 0.5; ctx.beginPath();
          q.rows.forEach(function (l) { line(ctx, l[0], l[1]); }); q.joints.forEach(function (l) { line(ctx, l[0], l[1]); }); ctx.stroke(); ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = rgba(stroke, sa * 0.8); ctx.lineWidth = lw * 0.8; ctx.beginPath(); partial(ctx, q.pts, true, lp); ctx.stroke();
        break;
      }
    }
  }

  function shingles(ctx, q, T, st, on, dim) {
    var n = q.courses.length, S = st.S, lightTone = T.dark ? T.ink : '#ffffff';
    if (S <= 0) return;
    ctx.save(); ctx.beginPath(); pathPoly(ctx, q.pts); ctx.clip();
    for (var k = 0; k < n; k++) {
      var rev = clamp((S * (n + 8) - k) / 8, 0, 1);
      if (rev <= 0) break;
      var c = q.courses[k];
      for (var j = 0; j < c.tabs.length; j++) {
        var tb = c.tabs[j]; if (tb.u > rev * 1.02) break;
        var tone = tb.tone, a = c.base * Math.abs(tone) * (T.dark ? 1.1 : 1.3);
        ctx.fillStyle = tone >= 0 ? rgba(lightTone, a * dim) : rgba(T.shade, a * (T.dark ? 2.4 : 1.1) * dim);
        ctx.beginPath(); pathPoly(ctx, tb.q); ctx.fill();
      }
      // butt edge of the course + tab joints
      ctx.strokeStyle = on ? rgba(T.acc, 0.4) : rgba(T.ink, (T.dark ? 0.15 : 0.2) * dim); ctx.lineWidth = 0.55; ctx.beginPath();
      var a0 = c.line[0], a1 = c.line[1];
      ctx.moveTo(a0[0], a0[1]); ctx.lineTo(a0[0] + (a1[0] - a0[0]) * rev, a0[1] + (a1[1] - a0[1]) * rev);
      for (j = 0; j < c.tabs.length; j++) { var tq = c.tabs[j].q; if (c.tabs[j].u > rev) break; ctx.moveTo(tq[0][0], tq[0][1]); ctx.lineTo(tq[3][0], tq[3][1]); }
      ctx.strokeStyle = on ? rgba(T.acc, 0.4) : rgba(T.ink, (T.dark ? 0.1 : 0.13) * dim);
      ctx.stroke();
    }
    ctx.restore();
  }

  function winDraw(ctx, q, L, T, lp, fp, dim) {
    var p = q.pts, big = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]) > 9, lw = L.lw, oa = T.oa * dim;
    if (fp > 0) {
      ctx.globalAlpha = fp;
      if (q.src.shutters) {
        [[-0.46, -0.1], [1.1, 1.46]].forEach(function (r) {
          var sq = [bil(p, r[0], 0), bil(p, r[1], 0), bil(p, r[1], 1), bil(p, r[0], 1)];
          ctx.fillStyle = T.door; ctx.beginPath(); pathPoly(ctx, sq); ctx.fill();
          ctx.strokeStyle = rgba(T.ink, oa * 0.5); ctx.lineWidth = 0.6; ctx.stroke();
        });
      }
      ctx.fillStyle = T.glass; ctx.beginPath(); pathPoly(ctx, p); ctx.fill();
      // cool sky reflection: one soft diagonal band
      var g = ctx.createLinearGradient(p[3][0], p[3][1], p[1][0], p[1][1]);
      g.addColorStop(0, rgba(T.ink, T.dark ? 0.1 : 0.08)); g.addColorStop(0.42, rgba(T.ink, T.dark ? 0.035 : 0.02)); g.addColorStop(0.43, rgba(T.ink, 0)); g.addColorStop(1, rgba(T.ink, T.dark ? 0.03 : 0));
      ctx.fillStyle = g; ctx.fill();
      if (big) {
        ctx.strokeStyle = rgba(T.ink, oa * 0.5); ctx.lineWidth = 0.55; ctx.beginPath();
        for (var c = 1; c < q.src.cols; c++) line(ctx, bil(p, c / q.src.cols, 0), bil(p, c / q.src.cols, 1));
        for (var r = 1; r < q.src.rows; r++) line(ctx, bil(p, 0, r / q.src.rows), bil(p, 1, r / q.src.rows));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = rgba(T.ink, oa); ctx.lineWidth = lw * 0.9; ctx.beginPath(); partial(ctx, p, true, lp); ctx.stroke();
    if (lp >= 1 && !q.src.side) { ctx.lineWidth = lw * 1.3; ctx.beginPath(); line(ctx, bil(p, -0.08, -0.02), bil(p, 1.08, -0.02)); ctx.stroke(); }
  }

  function doorDraw(ctx, q, L, T, lp, fp, st) {
    var p = q.pts, lw = L.lw, wpx = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]);
    if (fp > 0) {
      ctx.globalAlpha = fp; ctx.fillStyle = T.door; ctx.beginPath(); pathPoly(ctx, p); ctx.fill();
      if (wpx > 9) {
        ctx.strokeStyle = rgba(T.ink, T.oa * 0.3); ctx.lineWidth = 0.55; ctx.beginPath();
        [[0.16, 0.56, 0.84, 0.9], [0.16, 0.1, 0.84, 0.46]].forEach(function (r) { pathPoly(ctx, [bil(p, r[0], r[1]), bil(p, r[2], r[1]), bil(p, r[2], r[3]), bil(p, r[0], r[3])]); });
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = rgba(T.ink, T.oa); ctx.lineWidth = lw; ctx.beginPath(); partial(ctx, p, true, lp); ctx.stroke();
    // the knocker: the Aldaba mark in miniature (pivot dot + ring)
    if (L.knock && fp > 0) {
      var kr = Math.max(1.4, L.s * 0.36), k = L.knock;
      ctx.globalAlpha = fp; ctx.strokeStyle = T.acc; ctx.lineWidth = Math.max(0.9, kr * 0.42);
      ctx.beginPath(); ctx.arc(k[0], k[1] + kr * 0.6, kr, 0, TAU); ctx.stroke();
      ctx.fillStyle = T.acc; ctx.beginPath(); ctx.arc(k[0], k[1] - kr * 0.75, Math.max(0.7, kr * 0.3), 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // porch light for owner-lived homes: a small warm lamp by the door
    if (L.lamp && L.own && fp > 0) {
      var lr = Math.max(4, L.s * 2.4), lm = L.lamp, rg = ctx.createRadialGradient(lm[0], lm[1], 0, lm[0], lm[1], lr);
      rg.addColorStop(0, rgba(T.h1, (T.dark ? 0.26 : 0.18) * fp)); rg.addColorStop(1, rgba(T.h1, 0));
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(lm[0], lm[1], lr, 0, TAU); ctx.fill();
      ctx.fillStyle = rgba(T.h1, 0.85 * fp); ctx.fillRect(lm[0] - Math.max(0.6, L.s * 0.14), lm[1] - Math.max(1, L.s * 0.3), Math.max(1.2, L.s * 0.28), Math.max(2, L.s * 0.6));
    }
  }

  function garageDraw(ctx, q, L, T, lp, fp) {
    var p = q.pts, lw = L.lw, rows = q.src.rows;
    if (fp > 0) {
      ctx.globalAlpha = fp; ctx.fillStyle = T.wallF; ctx.beginPath(); pathPoly(ctx, p); ctx.fill();
      var g = ctx.createLinearGradient(0, p[3][1], 0, p[0][1]); g.addColorStop(0, rgba(T.shade, T.dark ? 0.35 : 0.06)); g.addColorStop(1, rgba(T.shade, 0));
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = rgba(T.ink, T.oa * 0.4); ctx.lineWidth = 0.55; ctx.beginPath();
      for (var r = 1; r < rows; r++) line(ctx, bil(p, 0, r / rows), bil(p, 1, r / rows));
      var wpx = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]), cols = Math.max(2, Math.round(wpx / Math.max(10, L.s * 2)));
      if (L.s > 6) for (r = 0; r < rows; r++) for (var c = 1; c < cols; c++) line(ctx, bil(p, c / cols, (r + 0.22) / rows), bil(p, c / cols, (r + 0.78) / rows));
      ctx.stroke();
      if (q.src.lites) {
        ctx.fillStyle = T.glass;
        for (c = 0; c < cols; c++) { var lq = [bil(p, (c + 0.18) / cols, (rows - 0.72) / rows), bil(p, (c + 0.82) / cols, (rows - 0.72) / rows), bil(p, (c + 0.82) / cols, (rows - 0.28) / rows), bil(p, (c + 0.18) / cols, (rows - 0.28) / rows)]; ctx.beginPath(); pathPoly(ctx, lq); ctx.fill(); ctx.strokeStyle = rgba(T.ink, T.oa * 0.45); ctx.stroke(); }
      }
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = rgba(T.ink, T.oa); ctx.lineWidth = lw; ctx.beginPath(); partial(ctx, p, true, lp); ctx.stroke();
  }

  function ringPath(ctx, c, b, rad) {
    ctx.save(); ctx.transform(b[0][0], b[0][1], b[1][0], b[1][1], c[0], c[1]); ctx.beginPath(); ctx.arc(0, 0, rad, 0, TAU); ctx.restore();
  }

  function hailDraw(ctx, L, T, st, hl, o) {
    if (!L.rings.length || st.H <= 0) return;
    var col = hailColor(L.hailIn, T), fade = hl && hl !== 'roof' ? 0.45 : 1, fall = L.h * 0.26, dir = [0.34, 0.94];
    for (var i = 0; i < L.rings.length; i++) {
      var R = L.rings[i], q = seg(st.H, R.s0 * 0.8, R.s0 * 0.8 + 0.2);
      if (q <= 0) continue;
      var drop = seg(q, 0, 0.34), imp = seg(q, 0.3, 1), c = R.c, u = R.b;
      if (drop < 1 && drop > 0) {                          // the stone falling in, wind from the upper left
        var e = drop * drop, hx = c[0] - dir[0] * fall * (1 - e), hy = c[1] - dir[1] * fall * (1 - e), tl = Math.min(fall * 0.34, fall * e + 6);
        var sg = ctx.createLinearGradient(hx - dir[0] * tl, hy - dir[1] * tl, hx, hy);
        sg.addColorStop(0, rgba(col, 0)); sg.addColorStop(1, rgba(col, 0.9 * fade));
        ctx.strokeStyle = sg; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx - dir[0] * tl, hy - dir[1] * tl); ctx.lineTo(hx, hy); ctx.stroke();
      }
      if (imp <= 0) continue;
      var grow = eback(seg(imp, 0, 0.5)), echo = eo(imp), done = imp >= 1;
      if (T.dark) {                                        // glow
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        var gr = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], R.r * 2.6);
        gr.addColorStop(0, rgba(col, 0.22 * fade * (done ? 0.8 : 1 + (1 - echo)))); gr.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(c[0], c[1], R.r * 2.6, 0, TAU); ctx.fill(); ctx.restore();
      }
      if (!done) {                                         // the knock: an echo ring running out and fading
        ringPath(ctx, c, u, 1 + 1.9 * echo); ctx.strokeStyle = rgba(col, 0.55 * (1 - echo) * fade); ctx.lineWidth = 0.8; ctx.stroke();
      } else if (R.hero) {
        ringPath(ctx, c, u, 1.85); ctx.strokeStyle = rgba(col, 0.28 * fade); ctx.lineWidth = 0.6; ctx.stroke();
      }
      ringPath(ctx, c, u, Math.max(0.05, grow));
      ctx.fillStyle = rgba(col, (T.dark ? 0.12 : 0.1) * fade); ctx.fill();
      ctx.strokeStyle = rgba(col, 0.95 * fade); ctx.lineWidth = clamp(R.r * 0.2, 0.9, 1.6); ctx.stroke();
      ctx.fillStyle = rgba(col, fade); ctx.beginPath(); ctx.arc(c[0], c[1], clamp(R.r * 0.14, 0.6, 1.5), 0, TAU); ctx.fill();
    }
  }

  function notesDraw(ctx, L, T, st, o) {
    var lab = o.labels, q = st.N;
    if (!lab || q <= 0) return;
    var fs = L.fs, font = '500 ' + fs + 'px ' + (o.font || MONO), lw = 0.75;
    ctx.save(); ctx.font = font; ctx.textBaseline = 'alphabetic';
    try { ctx.letterSpacing = (fs * 0.06).toFixed(2) + 'px'; } catch (e) { /* older engines */ }
    var lead = eo(seg(q, 0, 0.6)), txt = eo(seg(q, 0.3, 1)), rise = (1 - txt) * 3, sideR = 1;
    function callout(A, side, text, col, colA, gap) {
      var tw = ctx.measureText(text).width, B = [A[0] + side * Math.max(10, (A[1] - L.bandY) * 0.55), L.bandY];
      var minX = 10 + (side < 0 ? tw + 16 : 0), maxX = L.w - 10 - (side > 0 ? tw + 16 : 0);
      B[0] = clamp(B[0], minX, maxX);
      var C = [B[0] + side * (tw + 12), L.bandY], dx = B[0] - A[0], dy = B[1] - A[1], dl = Math.hypot(dx, dy) || 1;
      var A2 = [A[0] + dx / dl * gap, A[1] + dy / dl * gap];
      ctx.strokeStyle = rgba(col, colA); ctx.lineWidth = lw; ctx.beginPath(); partial(ctx, [A2, B, C], false, lead); ctx.stroke();
      ctx.globalAlpha = txt; ctx.fillStyle = rgba(col, Math.min(1, colA + 0.25)); ctx.textAlign = side < 0 ? 'right' : 'left';
      ctx.fillText(text, B[0] + side * 3, L.bandY - 5 + rise); ctx.globalAlpha = 1;
      return [B, C];
    }
    if (lab.hail && L.hero) {
      var hc = hailColor(L.hailIn, T);
      callout(L.hero.c, -1, lab.hail, hc, 0.8, L.hero.r * 1.25 + 2);
      if (L.hero.c[0] > L.w * 0.6) sideR = -1;
    }
    if (lab.roof && L.roofA) {
      ctx.fillStyle = rgba(T.ink, 0.85 * lead); ctx.beginPath(); ctx.arc(L.roofA[0], L.roofA[1], 1.6, 0, TAU); ctx.fill();
      callout(L.roofA, sideR, lab.roof, T.ink, 0.55, 3.5);
    }
    if (lab.built) {
      var y = L.dimY, x0 = L.x0, x1 = L.x1, xm = (x0 + x1) / 2, tw = ctx.measureText(lab.built).width, gap = tw / 2 + 9, k = 3.2;
      var grow = lead, hx = (x1 - x0) / 2 * grow;
      ctx.strokeStyle = rgba(T.ink, 0.42); ctx.lineWidth = lw; ctx.beginPath();
      if (hx > gap) { ctx.moveTo(xm - hx, y); ctx.lineTo(xm - gap, y); ctx.moveTo(xm + gap, y); ctx.lineTo(xm + hx, y); }
      if (grow >= 1) {
        [x0, x1].forEach(function (x) { ctx.moveTo(x, L.groundY + 3); ctx.lineTo(x, y + 4); ctx.moveTo(x - k, y + k); ctx.lineTo(x + k, y - k); });
      }
      ctx.stroke();
      ctx.globalAlpha = txt; ctx.fillStyle = rgba(T.ink, 0.72); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(lab.built, xm, y + 0.5 + rise * 0.5); ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function ambient(ctx, L, T, tt) {
    if (L.w < 420) return;
    var per = 5.2, k = (tt % per) / 2.8;
    if (k > 1) return;
    var r = 3 + eo(k) * Math.min(90, L.w * 0.07), a = 0.38 * Math.pow(1 - k, 2), c = L.knock, kr = Math.max(1.4, L.s * 0.36);
    ctx.strokeStyle = rgba(T.acc, a); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(c[0], c[1] + kr * 0.6, r, 0, TAU); ctx.stroke();
  }

  // ---------------------------------------------------------------- canvas + public API
  function setup(canvas, o) {
    var dpr = clamp(o.dpr || root.devicePixelRatio || 1, 1, 3);
    var rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { width: 0, height: 0 };
    var w = Math.round(o.width || rect.width || canvas.width / dpr || 300), h = Math.round(o.height || rect.height || canvas.height / dpr || 200);
    var W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W; canvas.height = H;
      if (canvas.getBoundingClientRect && Math.abs(canvas.getBoundingClientRect().width - w) > 1) { canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; }
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h, dpr: dpr };
  }

  function prepare(canvas, home, o) {
    var env = setup(canvas, o);
    var key = [home.addr, home.built, home.roof, home.hail, home.own, env.w, env.h, o.sheet].join('|');
    var cache = canvas.__house;
    if (!cache || cache.key !== key) {
      var scene = build(home), L = layout(scene, env.w, env.h, o);
      L.hailIn = scene.hail; L.own = scene.own;
      cache = canvas.__house = { key: key, L: L, scene: scene };
    }
    return { ctx: env.ctx, L: cache.L, T: theme(o.theme) };
  }

  function labels(home, lang) {
    home = home || {};
    var es = String(lang || '').slice(0, 2) === 'es', out = {};
    if (home.built) out.built = (es ? 'CASA DE ' : 'BUILT ') + home.built;
    if (home.roof != null) out.roof = es ? 'TECHO DE ' + home.roof + (+home.roof === 1 ? ' AÑO' : ' AÑOS') : 'ROOF ' + home.roof + (+home.roof === 1 ? ' YR' : ' YRS');
    if (+home.hail > 0) out.hail = (es ? 'GRANIZO ' : 'HAIL ') + (+home.hail).toFixed(2) + (es ? ' PULG' : ' IN');
    return out;
  }

  function opts(home, o) {
    o = Object.assign({}, o || {});
    if (o.labels === undefined) o.labels = labels(home, o.lang || 'en');
    return o;
  }

  function draw(canvas, home, o) {
    if (!canvas || !home) return null;
    o = opts(home, o);
    var t = o.t == null || !isFinite(+o.t) ? DURATION + 1 : +o.t;
    var P = prepare(canvas, home, o);
    render(P.ctx, P.L, P.T, state(t, o.hailReveal), o);
    return { form: canvas.__house.scene.kind, rings: P.L.rings.length };
  }

  function animate(canvas, home, o) {
    o = opts(home, o);
    var stopped = false, raf = root.requestAnimationFrame ? root.requestAnimationFrame.bind(root) : function (f) { return setTimeout(function () { f(Date.now()); }, 16); };
    var caf = root.cancelAnimationFrame ? root.cancelAnimationFrame.bind(root) : clearTimeout, id = 0;
    if (reduced() || o.t != null) {                      // reduced motion or frozen time: one still frame
      draw(canvas, home, Object.assign({}, o, { ambient: false }));
      return { stop: function () {} };
    }
    var ambientOn = o.ambient !== false, t0 = null, speed = o.speed || 1;
    function frame(now) {
      if (stopped) return;
      if (t0 == null) t0 = now;
      var t = (now - t0) / 1000 * speed + (o.from || 0);
      var P = prepare(canvas, home, o);
      render(P.ctx, P.L, P.T, state(t, o.hailReveal), Object.assign({}, o, { ambient: ambientOn }));
      if (t < DURATION || ambientOn) id = raf(frame);
      else if (o.onDone) o.onDone();
    }
    id = raf(frame);
    return { stop: function () { stopped = true; caf(id); } };
  }

  root.House = { draw: draw, animate: animate, form: form, labels: labels, hailColor: hailColor, themes: THEMES, DURATION: DURATION };
})(typeof window !== 'undefined' ? window : globalThis);
