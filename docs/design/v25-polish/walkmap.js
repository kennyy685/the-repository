/* HMP map renderer (v25). Vector only, no tiles, no libraries.
   Draws the engine's per-walk basemap {bbox, streets:[{name, cls, path:[[lon,lat]]}], lots:[[[lon,lat]]], labels:[{text, at, angle}]}
   plus the walk's stops (walking order), a "you" dot and hail heat. Colors come from CSS tokens (--map-*, --route,
   --you, --hmp, --heat), so the same code draws the light and the dark theme.

   renderWalkMap(svg, walk, opts)   one walk: lots, streets, names, route snapped to the streets, numbered stops
   renderZoneMap(svg, data, opts)   town view: several walks' basemaps stitched, each zone as soft heat, ranked pins
   renderHomeMap(svg, walk, opts)   homeowner damage map: one house on its real lot, roof plan, numbered findings
   renderHailMap(svg, data, opts)   homeowner hail map: the storm's hail area around the home (no zones or scores)

   Both return {xy(lon,lat) -> [x,y], inView(x,y)} so the page can place HTML chips (zone pin, drive chip) on top. */
(function (g) {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const D = pts => 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L');

  // equirectangular projection fitted to a box; mode 'contain' shows the whole bbox, 'cover' fills the frame
  function projection(bbox, W, H, o) {
    const [x0, y0, x1, y1] = bbox, lat0 = (y0 + y1) / 2, k = Math.cos(lat0 * Math.PI / 180);
    const cx = o.center ? o.center.lon : (x0 + x1) / 2, cy = o.center ? o.center.lat : (y0 + y1) / 2;
    const pad = o.pad == null ? 14 : o.pad;
    let s;   // px per degree of latitude
    if (o.metersAcross) s = W / (o.metersAcross / 111320);
    else { const sx = (W - 2 * pad) / ((x1 - x0) * k), sy = (H - 2 * pad) / (y1 - y0); s = o.fit === 'cover' ? Math.max(sx, sy) : Math.min(sx, sy); }
    const xy = (lon, lat) => [W / 2 + (lon - cx) * k * s, H / 2 - (lat - cy) * s];
    const ll = (x, y) => ({ lon: cx + (x - W / 2) / (k * s), lat: cy - (y - H / 2) / s });   // screen -> lon/lat
    return { xy, ll, s, pxPerMeter: s / 111320, inView: (x, y, m = 0) => x >= m && y >= m && x <= W - m && y <= H - m };
  }

  // nearest point on a polyline (screen space)
  function nearestOn(p, line) {
    let best = null;
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, ay] = line[i], [bx, by] = line[i + 1], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / L)), q = [ax + t * dx, ay + t * dy];
      const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (!best || d < best.d) best = { q, d };
    }
    return best;
  }
  // where two streets meet (closest pair of vertices); good enough for grid towns
  function corner(a, b) {
    let best = null;
    for (const p of a) for (const q of b) { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (!best || d < best.d) best = { p: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], d }; }
    return best && best.d < 14 ? best.p : null;
  }

  function defs(svg, id) {
    const d = el('defs', {}, svg);
    const f = el('filter', { id: id + '-blur', x: '-50%', y: '-50%', width: '200%', height: '200%' }, d);
    el('feGaussianBlur', { stdDeviation: 11 }, f);
    const r = el('radialGradient', { id: id + '-heat' }, d);
    el('stop', { offset: '0', 'stop-color': 'rgb(var(--heat))', 'stop-opacity': '.55' }, r);
    el('stop', { offset: '.55', 'stop-color': 'rgb(var(--heat))', 'stop-opacity': '.22' }, r);
    el('stop', { offset: '1', 'stop-color': 'rgb(var(--heat))', 'stop-opacity': '0' }, r);
    return d;
  }

  function drawBase(svg, bm, P, o, layer) {
    const z = Math.max(.55, Math.min(1.6, P.pxPerMeter / 1.1));   // stroke scale by zoom (1 px per meter = walk scale)
    if (o.lots !== false) {
      const g = el('g', { fill: 'var(--map-lot)', stroke: 'var(--map-lotline)', 'stroke-width': o.lotWidth || .8, opacity: o.lotOpacity || 1 }, layer);
      bm.lots.forEach(l => el('path', { d: D(l.map(p => P.xy(p[0], p[1]))) + 'Z' }, g));
    }
    const lines = bm.streets.map(s => ({ s, pts: s.path.map(p => P.xy(p[0], p[1])) }));
    const w = c => o.streetWidth ? o.streetWidth(c) : (c === 'major' ? 9 : 6.5) * z;   // streetWidth: true-to-scale widths at lot zoom
    const cas = el('g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, layer);
    lines.forEach(({ s, pts }) => el('path', { d: D(pts), stroke: s.cls === 'major' ? 'var(--map-major-casing)' : 'var(--map-casing)', 'stroke-width': w(s.cls) + 2 }, cas));
    lines.forEach(({ s, pts }) => el('path', { d: D(pts), stroke: s.cls === 'major' ? 'var(--map-major)' : 'var(--map-street)', 'stroke-width': w(s.cls) }, cas));
    return lines;
  }

  function drawLabels(layer, labels, P, o, seen) {
    const g = el('g', { class: 'maplabels' }, layer), placed = o.placed || [];
    const size = o.labelSize || 10;
    labels.forEach(l => {
      if (!l.text || l.text === 'Intersection' || (seen && seen.has(l.text))) return;
      const [x, y] = P.xy(l.at[0], l.at[1]); if (!P.inView(x, y, 10)) return;
      let a = l.angle || 0; if (a > 90) a -= 180; if (a < -90) a += 180;
      // skip a label that would touch one already placed (approximate box, rotated)
      const hw = l.text.length * size * .29 + 4, hh = size * .7, c = Math.abs(Math.cos(a * Math.PI / 180)), sn = Math.abs(Math.sin(a * Math.PI / 180));
      const bx = hw * c + hh * sn, by = hw * sn + hh * c;
      if (placed.some(q => Math.abs(q[0] - x) < q[2] + bx && Math.abs(q[1] - y) < q[3] + by)) return;
      placed.push([x, y, bx, by]);
      if (seen) seen.add(l.text);
      const t = el('text', { x: x.toFixed(1), y: y.toFixed(1), transform: `rotate(${a.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})`, 'text-anchor': 'middle', 'dominant-baseline': 'central',
        style: `font:500 ${size}px var(--f);fill:var(--map-label);paint-order:stroke;stroke:var(--map-land);stroke-width:3px;stroke-linejoin:round;letter-spacing:.01em` }, g);
      t.textContent = l.text;
    });
  }

  function you(layer, x, y) {
    el('circle', { cx: x, cy: y, r: 13, fill: 'var(--you)', opacity: .18 }, layer);
    el('circle', { cx: x, cy: y, r: 6, fill: 'var(--you)', stroke: 'var(--card)', 'stroke-width': 2.5 }, layer);
  }

  /* opts: width, height (viewBox), fit, center {lat,lon}, metersAcross, pad,
           status: per-stop array of 'done' | 'no' | 'skip' | 'current' | '' (upcoming), numbers: true,
           you: {lat,lon} | {atStop:i}, heat: true */
  function renderWalkMap(svg, walk, opts = {}) {
    const W = opts.width || 358, H = opts.height || 200, id = svg.id || 'wm';
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = '';
    const bm = walk.basemap, P = projection(bm.bbox, W, H, opts);
    defs(svg, id);
    el('rect', { width: W, height: H, fill: 'var(--map-land)' }, svg);
    const base = el('g', {}, svg);
    const stops = walk.stops.map(s => P.xy(s.lon, s.lat));
    if (opts.heat !== false && stops.length) {
      const cx = stops.reduce((a, p) => a + p[0], 0) / stops.length, cy = stops.reduce((a, p) => a + p[1], 0) / stops.length;
      const r = Math.max(...stops.map(p => Math.hypot(p[0] - cx, p[1] - cy))) * 1.25 + 30;
      el('circle', { cx, cy, r, fill: `url(#${id}-heat)` }, base);
    }
    const lines = drawBase(svg, bm, P, opts, base);
    // snap each house to its street so the route runs along the street, not zig-zagging across it
    const snaps = stops.map(p => { let b = null; lines.forEach((l, i) => { const n = nearestOn(p, l.pts); if (n && (!b || n.d < b.d)) b = { ...n, i }; }); return b; });
    const route = [];
    snaps.forEach((sn, i) => {
      if (!sn) return;
      const prev = snaps[i - 1];
      let gap = false;
      if (prev && prev.i !== sn.i) { const c = corner(lines[prev.i].pts, lines[sn.i].pts); if (c) route.push({ p: c, i: i - .5 }); else gap = true; }
      route.push({ p: sn.q, i, gap });   // gap = no shared corner in the data: drawn as a light dashed hop, not a solid line
    });
    const st = opts.status || [], cur = st.indexOf('current');
    const split = cur < 0 ? 0 : cur;
    const rl = el('g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    // split the route into runs: done (faint dashes), to-do (solid), and data gaps (light dashes)
    const runs = []; let run = null;
    route.forEach((r, k) => {
      const kind = r.i <= split ? 'done' : 'todo';
      if (k && (r.gap || kind !== run.kind)) { const last = run.pts[run.pts.length - 1]; runs.push(run); run = { kind: r.gap ? 'gap' : kind, pts: [last, r.p] }; if (r.gap) { runs.push(run); run = { kind, pts: [r.p] }; } }
      else if (!run) run = { kind, pts: [r.p] }; else run.pts.push(r.p);
    });
    if (run) runs.push(run);
    runs.forEach(u => {
      if (u.pts.length < 2) return;
      if (u.kind === 'todo') { el('path', { d: D(u.pts), stroke: 'var(--card)', 'stroke-width': 5, opacity: .9 }, rl); el('path', { d: D(u.pts), stroke: 'var(--route)', 'stroke-width': 2.2 }, rl); }
      else el('path', { d: D(u.pts), stroke: u.kind === 'gap' ? 'var(--muted)' : 'var(--faint)', 'stroke-width': u.kind === 'gap' ? 1.4 : 2, 'stroke-dasharray': '2 4' }, rl);
    });
    drawLabels(svg, bm.labels, P, opts);
    // house ticks + markers (current last, on top)
    const mk = el('g', {}, svg), r = opts.r || 8.5;
    const order = stops.map((p, i) => i).sort((a, b) => (st[a] === 'current') - (st[b] === 'current'));
    order.forEach(i => {
      const [x, y] = stops[i], k = st[i] || '', n = String(i + 1), sn = snaps[i];
      if (!P.inView(x, y, -r)) return;
      if (sn && sn.d > r + 2) el('path', { d: `M${x} ${y}L${sn.q[0]} ${sn.q[1]}`, stroke: 'var(--line-2)', 'stroke-width': 1 }, mk);
      if (k === 'current') {
        el('circle', { cx: x, cy: y, r: r + 7, fill: 'rgb(var(--heat))', opacity: .25 }, mk);
        el('circle', { cx: x, cy: y, r: r + 2, fill: 'var(--hmp)', stroke: 'var(--card)', 'stroke-width': 2 }, mk);
        const t = el('text', { x, y: y + .5, 'text-anchor': 'middle', 'dominant-baseline': 'central', style: `font:600 ${r + 1}px var(--f);fill:var(--on-hmp)` }, mk); t.textContent = n;
      } else if (k === 'done' || k === 'no') {
        el('circle', { cx: x, cy: y, r: r - 1, fill: 'var(--soft)', stroke: 'var(--line-2)' }, mk);
        el('path', { d: k === 'no' ? `M${x - 3} ${y - 3}l6 6m0-6-6 6` : `M${x - 3.4} ${y}l2.3 2.4 4.6-4.8`, fill: 'none', stroke: 'var(--muted)', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, mk);
      } else if (k === 'skip') {
        el('circle', { cx: x, cy: y, r: r - 1, fill: 'var(--soft)', stroke: 'var(--line-2)', 'stroke-dasharray': '2 2' }, mk);
      } else {
        el('circle', { cx: x, cy: y, r, fill: 'var(--card)', stroke: 'var(--route)', 'stroke-width': 1.5 }, mk);
        if (opts.numbers !== false) { const t = el('text', { x, y: y + .5, 'text-anchor': 'middle', 'dominant-baseline': 'central', style: `font:600 ${n.length > 1 ? r - 0.5 : r + .5}px var(--f);fill:var(--ink);letter-spacing:-.03em` }, mk); t.textContent = n; }
      }
    });
    if (opts.you) {
      let x, y;
      if (opts.you.atStop != null && snaps[opts.you.atStop]) { const a = snaps[Math.max(0, opts.you.atStop - 1)].q, b = snaps[opts.you.atStop].q; x = (a[0] + b[0]) / 2; y = (a[1] + b[1]) / 2; }
      else [x, y] = P.xy(opts.you.lon, opts.you.lat);
      if (P.inView(x, y)) you(svg, x, y);
    }
    return P;
  }

  /* data: {zones:{zones:[...]}, walks:{zone_id: {basemap}}}; opts: width, height, pad, top (zone id to feature) */
  function renderZoneMap(svg, data, opts = {}) {
    const W = opts.width || 390, H = opts.height || 300, id = svg.id || 'zm';
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = '';
    const zs = data.zones.zones.filter(z => data.walks[z.id]);
    const b = [180, 90, -180, -90];
    zs.forEach(z => (z.polygon || [[z.center.lon, z.center.lat]]).forEach(([x, y]) => { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }));
    const P = projection(b, W, H, { fit: 'cover', pad: opts.pad == null ? 34 : opts.pad, center: opts.center });
    defs(svg, id);
    el('rect', { width: W, height: H, fill: 'var(--map-land)' }, svg);
    const base = el('g', {}, svg), heat = el('g', { filter: `url(#${id}-blur)` }, svg), top = el('g', {}, svg);
    // draw every stitched walk basemap (minor streets first, lots faint)
    const walks = zs.map(z => data.walks[z.id].basemap);
    walks.forEach(bm => drawBase(svg, bm, P, { lotOpacity: .7, lotWidth: .5 }, base));
    // zone heat = the walk hull, blurred, opacity by the engine's heat (0-1)
    zs.forEach(z => { if (!z.polygon) return; el('path', { d: D(z.polygon.map(p => P.xy(p[0], p[1]))) + 'Z', fill: 'rgb(var(--heat))', opacity: (.1 + .38 * (z.heat || .5) ** 4).toFixed(2) }, heat); });
    // the featured zone gets a crisp outline so the pin, the heat and the card clearly belong together
    const tz = zs.find(z => z.id === opts.top);
    if (tz && tz.polygon) el('path', { d: D(tz.polygon.map(p => P.xy(p[0], p[1]))) + 'Z', fill: 'rgb(var(--heat))', 'fill-opacity': .12, stroke: 'var(--hmp-ink)', 'stroke-width': 1.6, 'stroke-dasharray': '5 4', 'stroke-linejoin': 'round' }, svg);
    const seen = new Set(), placed = []; walks.forEach(bm => drawLabels(top, bm.labels.filter(l => /Ave|St|Dr|Rd|Blvd/.test(l.text)), P, { labelSize: 9.5, placed }, seen));
    // ranked pins (1 = best); the page draws the big pin for #1 in HTML
    zs.forEach((z, i) => {
      if (z.id === opts.top) return;
      const [x, y] = P.xy(z.center.lon, z.center.lat); if (!P.inView(x, y, 8)) return;
      el('circle', { cx: x, cy: y, r: 9, fill: 'var(--card)', stroke: 'var(--ink-2)', 'stroke-width': 1.3 }, top);
      const t = el('text', { x, y: y + .5, 'text-anchor': 'middle', 'dominant-baseline': 'central', style: 'font:600 9.5px var(--f);fill:var(--ink)' }, top); t.textContent = String(i + 1);
    });
    return P;
  }

  /* ---------- homeowner screen: one house at lot scale, and the hail around it ---------- */
  function inside(p, poly) {   // point in polygon, lon/lat
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c; }
    return c;
  }
  const centroid = pts => { const q = pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1] ? pts.slice(0, -1) : pts; return [q.reduce((a, p) => a + p[0], 0) / q.length, q.reduce((a, p) => a + p[1], 0) / q.length]; };
  function nearestSeg(p, lines) {   // nearest street edge: foot point, distance, unit direction, street index
    let b = null;
    lines.forEach((l, li) => { const s = l.pts; for (let i = 0; i < s.length - 1; i++) {
      const [ax, ay] = s[i], [bx, by] = s[i + 1], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / L)), q = [ax + t * dx, ay + t * dy], d = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (!b || d < b.d) { const len = Math.sqrt(L); b = { q, d, dir: [dx / len, dy / len], li }; } } });
    return b;
  }
  /* A house footprint inside its lot, square to the street it faces, set back from it. The engine sends lots but no
     building outlines yet (OSM / Microsoft building footprints are free if we want the real ones), so this is drawn.
     at(u, v): u -1..1 along the street (west -> east), v -1..1 from the back eave to the front eave. */
  function houseIn(lotPx, lines, ppm) {
    const c = centroid(lotPx), s = nearestSeg(c, lines); if (!s || s.d > 45 * ppm) return null;
    let n = [-s.dir[1], s.dir[0]]; if (n[0] * (s.q[0] - c[0]) + n[1] * (s.q[1] - c[1]) < 0) n = [-n[0], -n[1]];   // toward the street
    let d = [-n[1], n[0]]; if (d[0] < 0) d = [-d[0], -d[1]];                                                    // along it, eastward
    const pd = lotPx.map(p => (p[0] - c[0]) * d[0] + (p[1] - c[1]) * d[1]), pn = lotPx.map(p => (p[0] - c[0]) * n[0] + (p[1] - c[1]) * n[1]);
    const d0 = Math.min(...pd), d1 = Math.max(...pd), n0 = Math.min(...pn), n1 = Math.max(...pn), F = d1 - d0, Dp = n1 - n0;
    if (F < 9 * ppm || Dp < 14 * ppm) return null;
    const hw = Math.min(F * .66, 17 * ppm), hd = Math.min(Dp * .4, 10.5 * ppm), setback = Math.max(Dp * .22, 6 * ppm);
    const cu = (d0 + d1) / 2, cv = n1 - setback - hd / 2, hc = [c[0] + d[0] * cu + n[0] * cv, c[1] + d[1] * cu + n[1] * cv];
    const at = (u, v) => [hc[0] + d[0] * u * hw / 2 + n[0] * v * hd / 2, hc[1] + d[1] * u * hw / 2 + n[1] * v * hd / 2];
    return { hc, d, n, hw, hd, at, street: s, toStreet: s.d - cv };
  }
  function hipRoof(g, h, strong) {   // hip roof from above: back slope in shade, front lit, ends in between
    const r = Math.max(0, 1 - h.hd / h.hw), A = h.at;
    const faces = [[[-1, -1], [1, -1], [r, 0], [-r, 0], 'var(--map-roof-c)'], [[-r, 0], [r, 0], [1, 1], [-1, 1], 'var(--map-roof-a)'],
      [[-1, -1], [-r, 0], [-1, 1], 'var(--map-roof-b)'], [[1, -1], [1, 1], [r, 0], 'var(--map-roof-b)']];
    faces.forEach(f => el('path', { d: D(f.slice(0, -1).map(p => A(p[0], p[1]))) + 'Z', fill: f[f.length - 1] }, g));
    const line = { fill: 'none', stroke: strong ? 'var(--ink-2)' : 'var(--map-lotline)', 'stroke-width': strong ? 1.1 : .8, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
    el('path', { d: D([A(-1, -1), A(1, -1), A(1, 1), A(-1, 1)]) + 'Z', ...line }, g);
    el('path', { d: D([A(-1, -1), A(-r, 0), A(r, 0), A(1, -1)]) + 'M' + A(-1, 1).join(' ') + 'L' + A(-r, 0).join(' ') + 'M' + A(1, 1).join(' ') + 'L' + A(r, 0).join(' '), ...line, 'stroke-width': strong ? .9 : .6, opacity: strong ? .75 : .8 }, g);
  }
  function driveway(g, h, sw) {   // from the front of the house to the street edge, at the east end
    const len = Math.max(0, h.toStreet - h.hd / 2 - sw / 2);
    const p = [h.at(.52, 1), h.at(.94, 1)], o = [h.n[0] * len, h.n[1] * len];
    el('path', { d: D([p[0], p[1], [p[1][0] + o[0], p[1][1] + o[1]], [p[0][0] + o[0], p[0][1] + o[1]]]) + 'Z', fill: 'var(--map-street)', stroke: 'var(--map-casing)', 'stroke-width': .8 }, g);
  }

  /* renderHomeMap(svg, walk, opts): the damage map. The home's real lot (highlighted) with its neighbors and the street,
     a drawn roof plan, and each finding marked where it is.
     opts: width, height, home {lat, lon}, ppm (px per meter, default 9), toward (0-1: how far to slide the view from the
           house toward the street, default .3), finds [{n, kind: 'slope'|'square'|'vent'|'gutter'|'wall', at:[u,v]}],
           active (n of the highlighted finding), mini (tiny locator: no labels, dots for pins), street (label text) */
  function renderHomeMap(svg, walk, opts = {}) {
    const W = opts.width || 358, H = opts.height || 300, id = svg.id || 'hm', bm = walk.basemap, home = opts.home;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = '';
    const ppm = opts.ppm || 9, across = W / ppm;
    const lotI = bm.lots.findIndex(l => inside([home.lon, home.lat], l));
    // pass 1 finds the house frame; pass 2 re-centers between the house and its street
    let P = projection(bm.bbox, W, H, { center: home, metersAcross: across });
    const lines0 = bm.streets.map(s => ({ s, pts: s.path.map(p => P.xy(p[0], p[1])) }));
    const h0 = lotI >= 0 ? houseIn(bm.lots[lotI].map(p => P.xy(p[0], p[1])), lines0, ppm) : null;
    if (h0) { const k = opts.toward == null ? .3 : opts.toward, c = [h0.hc[0] + (h0.street.q[0] - h0.hc[0]) * k, h0.hc[1] + (h0.street.q[1] - h0.hc[1]) * k]; P = projection(bm.bbox, W, H, { center: P.ll(c[0], c[1]), metersAcross: across }); }
    defs(svg, id);
    const dd = svg.querySelector('defs'), pat = el('pattern', { id: id + '-hatch', width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, dd);
    el('rect', { width: 5, height: 5, fill: 'rgb(var(--heat))', 'fill-opacity': .18 }, pat);
    el('path', { d: 'M0 0V5', stroke: 'var(--hmp)', 'stroke-width': 1.5, 'stroke-opacity': .85 }, pat);
    el('rect', { width: W, height: H, fill: 'var(--map-land)' }, svg);
    const base = el('g', {}, svg);
    const sw = c => (c === 'major' ? 13 : 9.5) * ppm;   // curb to curb, true to scale
    const lines = drawBase(svg, bm, P, { streetWidth: sw, lotWidth: opts.mini ? .5 : .9 }, base);
    const lotsPx = bm.lots.map(l => l.map(p => P.xy(p[0], p[1])));
    // neighbors, soft; then the home lot and house
    const nb = el('g', { opacity: opts.mini ? .55 : .8 }, svg);
    lotsPx.forEach((l, i) => { if (i === lotI || !l.some(p => P.inView(p[0], p[1], -40))) return; const h = houseIn(l, lines, ppm); if (h) { if (!opts.mini) driveway(nb, h, sw('local')); hipRoof(nb, h, false); } });
    if (lotI < 0) return { P };
    const lotPx = lotsPx[lotI], h = houseIn(lotPx, lines, ppm);
    el('path', { d: D(lotPx) + 'Z', fill: 'var(--hmp-bg)', stroke: 'var(--hmp-ink)', 'stroke-width': opts.mini ? 1 : 1.4, 'stroke-dasharray': opts.mini ? '' : '5 4', 'stroke-linejoin': 'round' }, svg);
    const hg = el('g', {}, svg);
    if (!opts.mini) driveway(hg, h, sw('local'));
    hipRoof(hg, h, true);
    // findings: the damaged area first, then numbered pins on top
    const r = Math.max(0, 1 - h.hd / h.hw), A = h.at, out = [], ov = el('g', {}, svg), pins = el('g', {}, svg);
    const edge = (a, b) => { el('path', { d: D([a, b]), stroke: 'var(--card)', 'stroke-width': opts.mini ? 4 : 7, 'stroke-linecap': 'round' }, ov); el('path', { d: D([a, b]), stroke: 'var(--hmp)', 'stroke-width': opts.mini ? 2.2 : 4, 'stroke-linecap': 'round' }, ov); };
    (opts.finds || []).forEach(f => {
      const [u, v] = f.at; let anchor = A(u, v), pin = anchor;
      const off = (du, dn) => [anchor[0] + h.d[0] * du + h.n[0] * dn, anchor[1] + h.d[1] * du + h.n[1] * dn];
      if (f.kind === 'slope') el('path', { d: D(v < 0 ? [A(-1, -1), A(1, -1), A(r, 0), A(-r, 0)] : [A(-r, 0), A(r, 0), A(1, 1), A(-1, 1)]) + 'Z', fill: `url(#${id}-hatch)` }, ov);
      if (f.kind === 'square') {   // the 10 x 10 ft test area, drawn to scale
        const s = 3.048 * P.pxPerMeter / 2, q = [[-s, -s], [s, -s], [s, s], [-s, s]].map(([a, b]) => [anchor[0] + h.d[0] * a + h.n[0] * b, anchor[1] + h.d[1] * a + h.n[1] * b]);
        el('path', { d: D(q) + 'Z', fill: 'var(--card)', 'fill-opacity': .55, stroke: 'var(--card)', 'stroke-width': 4, 'stroke-linejoin': 'round' }, ov);
        el('path', { d: D(q) + 'Z', fill: 'none', stroke: 'var(--hmp-ink)', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, ov);
        pin = off(s + 11, -(s + 11)); anchor = off(s, -s);   // leader starts at the square's corner
      }
      if (f.kind === 'vent') { const s = Math.max(2.6, .45 * P.pxPerMeter); el('rect', { x: anchor[0] - s, y: anchor[1] - s, width: 2 * s, height: 2 * s, rx: 1, fill: 'var(--card)', stroke: 'var(--ink-2)', 'stroke-width': 1 }, ov); pin = off(14, -12); }
      if (f.kind === 'gutter') { edge(A(-1, 1), A(1, 1)); pin = off(0, 17); }
      if (f.kind === 'wall') { edge(A(-1, -1), A(-1, 1)); pin = off(-17, 0); }
      if (opts.mini) { pin = A(u, v); if (f.kind === 'gutter') pin = off(0, 5); if (f.kind === 'wall') pin = off(-5, 0); }
      if (!opts.mini && pin !== anchor) el('path', { d: D([anchor, pin]), stroke: 'var(--ink-2)', 'stroke-width': 1 }, pins);
      const on = opts.active === f.n, R = opts.mini ? (on ? 6 : 3.2) : 11.5;
      if (on && !opts.mini) el('circle', { cx: pin[0], cy: pin[1], r: R + 7, fill: 'rgb(var(--heat))', opacity: .28 }, pins);
      el('circle', { cx: pin[0], cy: pin[1], r: R, fill: on ? 'var(--hmp)' : 'var(--ink)', stroke: 'var(--card)', 'stroke-width': opts.mini ? 1.5 : 2 }, pins);
      if (!opts.mini) { const tx = el('text', { x: pin[0], y: pin[1] + .5, 'text-anchor': 'middle', 'dominant-baseline': 'central', style: `font:600 12px var(--f);fill:${on ? 'var(--on-hmp)' : 'var(--on-ink)'}` }, pins); tx.textContent = f.n; }
      out.push({ n: f.n, xy: pin });
    });
    // the street the house faces, named where the viewer looks: in front of the house, clear of the pins
    if (!opts.mini) {
      const st = lines[h.street.li], name = opts.street || (st && st.s.name);
      if (name) {
        const a = Math.atan2(h.d[1], h.d[0]) * 180 / Math.PI, p = [h.street.q[0] + h.d[0] * h.hw * .95, h.street.q[1] + h.d[1] * h.hw * .95];
        const tx = el('text', { x: p[0].toFixed(1), y: p[1].toFixed(1), transform: `rotate(${a.toFixed(1)} ${p[0].toFixed(1)} ${p[1].toFixed(1)})`, 'text-anchor': 'middle', 'dominant-baseline': 'central', style: 'font:500 12px var(--f);fill:var(--map-label);letter-spacing:.02em' }, svg);
        tx.textContent = name;
      }
    }
    return { P, pins: out, house: h };
  }

  function hull(pts) {   // convex hull, monotone chain
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    p.forEach(q => { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
    p.slice().reverse().forEach(q => { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); });
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  /* renderHailMap(svg, data, opts): the neighborhood with the storm's hail area and the home. No zones, ranks or scores:
     this is the homeowner's view. The area is the hull of the storm's zones, blurred (the engine can send the radar
     contour instead). opts: width, height, home {lat, lon}, metersAcross (default 1400), center */
  function renderHailMap(svg, data, opts = {}) {
    const W = opts.width || 358, H = opts.height || 120, id = svg.id || 'hl', home = opts.home;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = '';
    const zs = data.zones.zones.filter(z => data.walks[z.id] && z.polygon && z.storm_day === (opts.day || z.storm_day));
    const P = projection([0, 0, 1, 1], W, H, { center: opts.center || home, metersAcross: opts.metersAcross || 1400 });
    defs(svg, id);
    el('rect', { width: W, height: H, fill: 'var(--map-land)' }, svg);
    const base = el('g', {}, svg), seen = new Set();
    zs.forEach(z => drawBase(svg, data.walks[z.id].basemap, P, { lotOpacity: .55, lotWidth: .4 }, base));
    const pts = []; zs.forEach(z => z.polygon.forEach(p => pts.push(P.xy(p[0], p[1]))));
    if (pts.length > 2) {   // padded a little (buf px) so the blur's soft edge doesn't fade out over homes inside a zone
      const hl = hull(pts), c = centroid(hl), buf = opts.buf == null ? 26 : opts.buf;
      const pad = hl.map(p => { const dx = p[0] - c[0], dy = p[1] - c[1], L = Math.hypot(dx, dy) || 1; return [p[0] + dx / L * buf, p[1] + dy / L * buf]; });
      const g2 = el('g', { filter: `url(#${id}-blur)` }, svg); el('path', { d: D(pad) + 'Z', fill: 'rgb(var(--heat))', opacity: .34 }, g2);
    }
    const [x, y] = P.xy(home.lon, home.lat);
    if (opts.labels !== false) { const top = el('g', {}, svg), placed = [[x, y, 26, 16]].concat(opts.placed || []); zs.forEach(z => drawLabels(top, data.walks[z.id].basemap.labels.filter(l => /Ave|St|Blvd/.test(l.text)), P, { labelSize: 9, placed }, seen)); }
    el('circle', { cx: x, cy: y, r: 15, fill: 'var(--ink)', opacity: .12 }, svg);
    el('circle', { cx: x, cy: y, r: 6.5, fill: 'var(--ink)', stroke: 'var(--card)', 'stroke-width': 2.5 }, svg);
    return P;
  }

  g.renderWalkMap = renderWalkMap; g.renderZoneMap = renderZoneMap; g.renderHomeMap = renderHomeMap; g.renderHailMap = renderHailMap;
})(window);
