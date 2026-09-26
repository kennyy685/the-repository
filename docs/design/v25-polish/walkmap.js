/* HMP map renderer (v25). Vector only, no tiles, no libraries.
   Draws the engine's per-walk basemap {bbox, streets:[{name, cls, path:[[lon,lat]]}], lots:[[[lon,lat]]], labels:[{text, at, angle}]}
   plus the walk's stops (walking order), a "you" dot and hail heat. Colors come from CSS tokens (--map-*, --route,
   --you, --hmp, --heat), so the same code draws the light and the dark theme.

   renderWalkMap(svg, walk, opts)   one walk: lots, streets, names, route snapped to the streets, numbered stops
   renderZoneMap(svg, data, opts)   town view: several walks' basemaps stitched, each zone as soft heat, ranked pins

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
    return { xy, s, pxPerMeter: s / 111320, inView: (x, y, m = 0) => x >= m && y >= m && x <= W - m && y <= H - m };
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
    el('feGaussianBlur', { stdDeviation: 14 }, f);
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
    const w = c => (c === 'major' ? 9 : 6.5) * z;
    const cas = el('g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, layer);
    lines.forEach(({ s, pts }) => el('path', { d: D(pts), stroke: s.cls === 'major' ? 'var(--map-major-casing)' : 'var(--map-casing)', 'stroke-width': w(s.cls) + 2 }, cas));
    lines.forEach(({ s, pts }) => el('path', { d: D(pts), stroke: s.cls === 'major' ? 'var(--map-major)' : 'var(--map-street)', 'stroke-width': w(s.cls) }, cas));
    return lines;
  }

  function drawLabels(layer, labels, P, o, seen) {
    const g = el('g', { class: 'maplabels' }, layer);
    labels.forEach(l => {
      if (!l.text || l.text === 'Intersection' || (seen && seen.has(l.text))) return;
      const [x, y] = P.xy(l.at[0], l.at[1]); if (!P.inView(x, y, 10)) return;
      if (seen) seen.add(l.text);
      let a = l.angle || 0; if (a > 90) a -= 180; if (a < -90) a += 180;
      const t = el('text', { x: x.toFixed(1), y: y.toFixed(1), transform: `rotate(${a.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})`, 'text-anchor': 'middle', 'dominant-baseline': 'central',
        style: `font:500 ${o.labelSize || 10}px var(--f);fill:var(--map-label);paint-order:stroke;stroke:var(--map-land);stroke-width:3px;stroke-linejoin:round;letter-spacing:.01em` }, g);
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
      if (prev && prev.i !== sn.i) { const c = corner(lines[prev.i].pts, lines[sn.i].pts); if (c) route.push({ p: c, i: i - .5 }); }
      route.push({ p: sn.q, i });
    });
    const st = opts.status || [], cur = st.indexOf('current');
    const split = cur < 0 ? 0 : cur;
    const doneSeg = route.filter(r => r.i <= split).map(r => r.p), todo = route.filter(r => r.i >= split).map(r => r.p);
    const rl = el('g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    if (doneSeg.length > 1) el('path', { d: D(doneSeg), stroke: 'var(--faint)', 'stroke-width': 2, 'stroke-dasharray': '2 4' }, rl);
    if (todo.length > 1) { el('path', { d: D(todo), stroke: 'var(--card)', 'stroke-width': 5, opacity: .9 }, rl); el('path', { d: D(todo), stroke: 'var(--route)', 'stroke-width': 2.2 }, rl); }
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
    zs.forEach(z => { if (!z.polygon) return; el('path', { d: D(z.polygon.map(p => P.xy(p[0], p[1]))) + 'Z', fill: 'rgb(var(--heat))', opacity: (.18 + .5 * (z.heat || .5) ** 3).toFixed(2) }, heat); });
    const seen = new Set(); walks.forEach(bm => drawLabels(top, bm.labels.filter(l => /Ave|St|Dr|Rd|Blvd/.test(l.text)), P, { labelSize: 9 }, seen));
    // ranked pins (1 = best); the page draws the big pin for #1 in HTML
    zs.forEach((z, i) => {
      if (z.id === opts.top) return;
      const [x, y] = P.xy(z.center.lon, z.center.lat); if (!P.inView(x, y, 8)) return;
      el('circle', { cx: x, cy: y, r: 9, fill: 'var(--card)', stroke: 'var(--ink-2)', 'stroke-width': 1.3 }, top);
      const t = el('text', { x, y: y + .5, 'text-anchor': 'middle', 'dominant-baseline': 'central', style: 'font:600 9.5px var(--f);fill:var(--ink)' }, top); t.textContent = String(i + 1);
    });
    return P;
  }

  g.renderWalkMap = renderWalkMap; g.renderZoneMap = renderZoneMap;
})(window);
