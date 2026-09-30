/* Claude's Aldaba · intro.js → A.intro: the cold open (8.7 s, skippable, once per browser session)
   One continuous shot over the real map, never from black:
     0.0 s  Eastern Nebraska, legible from frame 0, then the lights go down. A hairline radar sweep turns from KOAX
            (Valley, NE) and lifts the dark behind it like a scope's afterglow: rivers, roads and the 2026 hail areas
            show where it passes, each town pings as the beam crosses it. It finds Columbus just as
     1.2 s  the Aug 8, 2026 storm replays: the swath burns in along its real path (HailGL, arrival 'path'), stones fall
            onto the burning front and every impact rings out; a mono readout tracks the date, the hail and the miles.
     3.4 s  the season in four numbers, each with its source (odometer countUp).
     4.7 s  the camera pushes into Columbus; the real hail contours around the pick tighten into ONE ring, the ring turns
            knocker orange and becomes the Aldaba mark (roof chevron + knocker dot draw on, the knock sounds).
     6.3 s  "Good morning. Columbus: 25 doors, 4-7:30 PM." rises word by word with the hail spring.
     7.8 s  hand-off without a cut: mark, wordmark and "Claude's cut" fly into the top bar (FLIP, the spring's overshoot
            capped to a few px), the chrome returns, 'intro:handoff' fires and play() resolves; the stage fades out
            underneath the Now view landing, and the mark rings out once as it lands in the bar.
   API: A.intro.play({force, to}) → Promise<boolean played>, .skip(), .stop(), .timeline (A.motion.Timeline, seekable),
        .active. Boot calls play() before entering the start view; it plays only when the start view is #now, once per
        browser session. play({force:true}) replays it (director, colophon). Skip: click, Esc, Space, Enter, the Skip
        button (the first skip jumps to the hand-off, a second one ends it).
   Automated browsers (navigator.webdriver: the dev harness, smoke tests) skip it so view tests never wait on it.
   Dev: ?intro=0 never · ?intro=1 plays it (and marks the page ready at its start, so shoot --wait N lands N ms in)
        · ?intro=3500 freezes the frame at 3.5 s. shoot.mjs passes these through the hash: --view 'now&intro=3500'.
   Owner: the intro builder. Only this file + css/intro.css. */
(function () {
  'use strict';
  const A = window.A; if (!A || !A.motion) return;
  const N = A.data || {}, X = A.x || {}, S26 = X.storms2026 || {};
  const root = document.documentElement;
  const E = A.motion.ease;
  const TAU = Math.PI * 2;
  const KEY = 'claudes-aldaba:intro-seen';
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const seg = (T, at, ms) => clamp01((T - at) / ms);
  const lerp = (a, b, t) => a + (b - a) * t;
  const snd = () => { const s = window.Sound; return s && s.enabled ? s : null; };

  /* ---------------- the beat sheet (ms) ---------------- */
  const B = { storm: 1200, stormMs: 3200, count: 3400, push: 4700, pushMs: 1750, ring: 4950, mark: 5950, head: 6300, hand: 7800, handMs: 900 };
  const DUR = B.hand + B.handMs;
  const LAND = 600;                                   // ms after the hand-off when the flying lockup has settled

  /* ---------------- real data ---------------- */
  const pick = N.pick || {};
  const PICK = pick.center ? [pick.center.lon, pick.center.lat] : [-97.376, 41.437];
  const AUG = (N.storms || []).find((s) => s.date === pick.storm_day) || (N.storms || [])[0] || null;
  const AUG_AREAS = AUG ? (N.areas || []).filter((a) => a.st === AUG.id) : [];
  const AUG_MID = AUG && AUG.path && AUG.path.length ? AUG.path[Math.floor(AUG.path.length / 2)] : PICK;
  const KOAX = (X.radar && X.radar.c) || [-96.3667, 41.3203];
  const PLACES = N.places || {}, BIG = new Set(['Omaha', 'Lincoln', 'Fremont', 'Columbus']);
  const MONO = '"Geist Mono","Geist Mono L",ui-monospace,monospace';
  const smooth = (x, a, b) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const srcCount = (id) => ((S26.sources || []).find((s) => s.id === id) || {}).count;
  const miBetween = (a, b) => { const k = Math.cos(41.4 * Math.PI / 180); return Math.hypot((a[0] - b[0]) * k, a[1] - b[1]) * 69.05; };
  const PATH_MI = AUG ? (AUG.path || []).reduce((s, p, i, a) => (i ? s + miBetween(a[i - 1], p) : 0), 0) : 0;
  const TOWN = String(pick.name || 'Columbus').split(':')[0].trim();
  // storm days = days with any NWS hail report this season (25; the engine mapped a swath for 18 of them), the same
  // count Now's 7 AM brief states right after the hand-off, so the film and the app never disagree
  const COUNTS = [
    { v: (S26.storm_days || []).length || (N.storms || []).length, en: 'storm days', es: 'días de tormenta', src: 'lsr' },
    { v: srcCount('radar') || 0, en: 'radar hail signatures', es: 'firmas de granizo en radar', src: 'radar' },
    { v: (N.zones || []).length, en: 'zones ranked', es: 'zonas en orden', src: 'engine' },
    { v: srcCount('lsr') || 0, en: 'storm reports', es: 'reportes de tormenta', src: 'lsr' }
  ];

  /* ---------------- when to play ---------------- */
  function devParam() {
    let v = A.q ? A.q('intro') : null;
    if (v == null) { const m = String(location.hash || '').match(/[#&?]intro=(\d+)/); if (m) v = m[1]; }
    return v;
  }
  const seen = {
    get() { try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; } },
    set() { try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* storage blocked: plays again next load, fine */ } }
  };
  function startView(o) {
    if (o && o.to) return o.to;
    const h = String(location.hash || '').replace('#', '').split(/[&?]/)[0];
    return h || 'now';
  }
  function wanted(o) {
    if (A.still) return false;
    const d = devParam();
    if (d === '0') return false;
    if ((o && o.force) || (d && d !== '0')) return true;
    // automated browsers (the dev harness, smoke tests) go straight to the app; ?intro=1 plays it for them
    let bot = false; try { bot = navigator.webdriver === true; } catch (e) { /* ignore */ }
    return !bot && startView(o) === 'now' && !seen.get();
  }

  /* ---------------- state ---------------- */
  let S = null;            // the running intro
  let pre = null;          // DOM mounted at load time so the very first paint already shows the title card
  root.classList.add('intro-tokens');

  /* ---------------- DOM ---------------- */
  const Le = (en, es) => A.L(A.esc(en), A.esc(es));
  const words = (s) => String(s).split(' ').map((w) => '<span class="intro-w"><span class="intro-w__i">' + A.esc(w) + '</span></span>').join(' ');
  const endDot = (t) => (/\.$/.test(t) ? t : t + '.');
  function headline() {
    const r = pick.best_time || {}, a = r.start || '16:00', b = r.end || '19:30', d = pick.doors || 25;
    return {
      a: { en: 'Good morning.', es: 'Buenos días.' },
      // "p. m." / "a. m." stay one word, so the line never breaks inside it
      b: { en: endDot(TOWN + ': ' + d + ' doors, ' + A.fmt.range(a, b, 'en')), es: endDot(TOWN + ': ' + d + ' puertas, de ' + A.fmt.range(a, b, 'es')).replace(/\b([ap])\. m\./g, '$1.\u00a0m.') }
    };
  }
  function mount() {
    const ov = document.getElementById('slot-overlay') || document.body;
    const H = headline(), U = A.ui;
    const stats = COUNTS.map((c) => '<div class="intro-stat"><span class="intro-stat__v num" aria-label="' + A.fmt.int(c.v) + '">' + A.fmt.int(c.v) + '</span>' +
      '<span class="intro-stat__k">' + Le(c.en, c.es) + ' ' + U.srcTag(c.src) + '</span></div>').join('');
    const el = A.h('<section class="intro" data-no-in aria-roledescription="intro" data-label-en="Intro: where the hail fell and which door to knock. Press Escape to skip." data-label-es="Introducción: dónde cayó el granizo y a qué puerta tocar. Pulsa Escape para saltarla.">' +
      '<div class="intro-scrim" aria-hidden="true"></div>' +
      '<header class="intro-card">' +
        '<p class="intro-eyebrow"><span class="intro-dot" aria-hidden="true"></span>' + Le('Eastern Nebraska · 2026 season', 'Este de Nebraska · temporada 2026') + '</p>' +
        '<h1 class="intro-title"><span class="intro-title__a">' + Le('Where the hail fell.', 'Dónde cayó el granizo.') + '</span>' +
          '<span class="intro-title__b">' + Le('Which door to knock.', 'A qué puerta tocar.') + '</span></h1>' +
        '<p class="intro-src">' + Le('Radar sweep: decorative', 'Barrido del radar: decorativo') + ' <span class="intro-src__sep">·</span> KOAX, Valley NE</p>' +
        '<p class="intro-src">' + Le('Hail: NOAA SPC · NWS reports · MRMS radar', 'Granizo: NOAA SPC · reportes del NWS · radar MRMS') + '</p>' +
      '</header>' +
      '<div class="intro-readout" aria-hidden="true">' +
        '<p class="intro-eyebrow intro-eyebrow--r">' + Le('Storm replay', 'Repetición de la tormenta') + '</p>' +
        '<p class="intro-readout__date">' + (AUG ? A.both(() => A.fmt.date(AUG.date, 'day')) : '') + '</p>' +
        '<p class="intro-readout__max"><b data-h="' + U.hailKey(pick.hail_in) + '">' + A.both(() => A.fmt.inches(pick.hail_in)) + '</b> ' + Le('max', 'máx.') + ' ' + U.srcTag('mrms') + '</p>' +
        '<div class="intro-readout__path"><span>' + Le('Along the storm path', 'A lo largo de la trayectoria') + '</span>' +
          '<b class="num"><span class="intro-mi">0.0</span><span class="intro-readout__of"> / ' + A.fmt.num(PATH_MI, 1, 'en') + ' mi</span></b></div>' +
        '<div class="intro-track"><i></i></div>' +
      '</div>' +
      '<div class="intro-stats">' + stats + '</div>' +
      '<svg class="intro-svg" aria-hidden="true" focusable="false">' +
        '<g class="intro-contours"></g>' +
        '<g class="intro-mark">' +
          // the roof pitches out from its ridge: two halves drawn from the apex at once
          '<path class="intro-mark__roof" d="M24 8 9 19" pathLength="1"/>' +
          '<path class="intro-mark__roof" d="M24 8 39 19" pathLength="1"/>' +
          '<circle class="intro-mark__dot" cx="24" cy="17" r="3"/>' +
          '<circle class="intro-mark__ring" cx="24" cy="31.5" r="10"/>' +
        '</g>' +
      '</svg>' +
      '<div class="intro-word" aria-hidden="true"><span class="intro-word__name">Aldaba</span>' +
        '<span class="intro-word__cut">' + U.icon('spark', { size: 11 }) + Le("Claude's cut", 'Versión de Claude') + '</span></div>' +
      '<div class="intro-head">' +
        '<p class="intro-head__a">' + A.L(words(H.a.en), words(H.a.es)) + '</p>' +
        '<p class="intro-head__b">' + A.L(words(H.b.en), words(H.b.es)) + '</p>' +
        '<p class="intro-head__src">' + Le('Doors', 'Puertas') + ' ' + U.sampleTag() + '<span class="intro-src__sep">·</span>' + Le('Best hours', 'Mejor horario') + ' ' + U.srcTag('engine') + '</p>' +
      '</div>' +
      '<button type="button" class="intro-skip" data-label-en="Skip the intro" data-label-es="Saltar la introducción">' + Le('Skip intro', 'Saltar intro') + ' <span class="kbd">Esc</span></button>' +
      '<div class="intro-progress" aria-hidden="true"><i></i></div>' +
    '</section>');
    ov.appendChild(el);
    U.localize(el);
    // word order per language, so each language rises left to right
    ['en', 'es'].forEach((l) => { let i = 0; A.$$('.intro-head .' + l + ' .intro-w__i', el).forEach((w) => (w.dataset.i = String(i++))); });
    const q = (s) => el.querySelector(s);
    return {
      el, scrim: q('.intro-scrim'), card: q('.intro-card'), ta: q('.intro-title__a'), tb: q('.intro-title__b'),
      readout: q('.intro-readout'), mi: q('.intro-mi'), track: q('.intro-track i'),
      stats: A.$$('.intro-stat', el), statV: A.$$('.intro-stat__v', el),
      svg: q('.intro-svg'), cont: q('.intro-contours'), mark: q('.intro-mark'), roof: A.$$('.intro-mark__roof', el), dot: q('.intro-mark__dot'), ring: q('.intro-mark__ring'),
      word: q('.intro-word'), name: q('.intro-word__name'), cut: q('.intro-word__cut'),
      head: q('.intro-head'), hw: A.$$('.intro-w__i', el), hsrc: q('.intro-head__src'),
      skip: q('.intro-skip'), prog: q('.intro-progress i'), paths: []
    };
  }

  /* ---------------- camera: region → the storm → Columbus, a function of time (seekable) ---------------- */
  function interpZoom(p0, p1, rho) { // van Wijk & Nuij smooth zoom, same as the world's flights
    const rho2 = rho * rho, rho4 = rho2 * rho2, ux0 = p0[0], uy0 = p0[1], w0 = p0[2], ux1 = p1[0], uy1 = p1[1], w1 = p1[2];
    const dx = ux1 - ux0, dy = uy1 - uy0, d2 = dx * dx + dy * dy;
    if (d2 < 1e-14) { const S1 = Math.log(w1 / w0) / rho; return (t) => [ux0 + t * dx, uy0 + t * dy, w0 * Math.exp(rho * t * S1)]; }
    const d1 = Math.sqrt(d2);
    const b0 = (w1 * w1 - w0 * w0 + rho4 * d2) / (2 * w0 * rho2 * d1), b1 = (w1 * w1 - w0 * w0 - rho4 * d2) / (2 * w1 * rho2 * d1);
    const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0), r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1), S1 = (r1 - r0) / rho;
    const ch = Math.cosh(r0), sh = Math.sinh(r0);
    return (t) => { const s = t * S1, u = (w0 / (rho2 * d1)) * (ch * Math.tanh(rho * s + r0) - sh); return [ux0 + u * dx, uy0 + u * dy, (w0 * ch) / Math.cosh(rho * s + r0)]; };
  }
  function camKeys() {
    const W = A.world, w = W.w || innerWidth, h = W.h || innerHeight, narrow = w < 700;
    const r = (tg) => { const c = W.resolve(tg); const p = W.toWorld(c.center); return { x: p[0], y: p[1], z: c.zoom }; };
    const a = r({ bounds: [[-97.56, 41.12], [-96.08, 41.63]], pad: narrow ? 10 : { t: Math.round(h * 0.2), r: Math.round(w * 0.04), b: Math.round(h * 0.2), l: Math.round(w * 0.22) } });
    const b = r({ center: AUG_MID, zoom: a.z + (narrow ? 1.1 : 1.05), offset: [narrow ? 0 : w * 0.07, narrow ? 0 : h * 0.03] });
    const zC = b.z + (narrow ? 1.7 : 1.85);
    const offC = [narrow ? 0 : w * 0.17, narrow ? -h * 0.04 : h * 0.01];
    const c = (z) => r({ center: PICK, zoom: z, offset: offC });
    const c0 = c(zC);
    const I = interpZoom([b.x, b.y, w / Math.pow(2, b.z)], [c0.x, c0.y, w / Math.pow(2, c0.z)], 1.4);
    return { a, b, c, zC, w, h, I, narrow, R: A.clamp(Math.min(w, h) * (narrow ? 0.1 : 0.075), 34, 72) };
  }
  function camAt(T) {
    const K = S.keys;
    if (T <= B.push) {
      const p = E.inOutSine(seg(T, 300, 3500));
      return { x: lerp(K.a.x, K.b.x, p), y: lerp(K.a.y, K.b.y, p), z: lerp(K.a.z, K.b.z, p) };
    }
    if (T <= B.push + B.pushMs) { const q = K.I(E.inOutCubic((T - B.push) / B.pushMs)); return { x: q[0], y: q[1], z: Math.log2(K.w / q[2]) }; }
    return K.c(K.zC + 0.12 * E.outCubic(seg(T, B.push + B.pushMs, 2400)));
  }

  /* ---------------- the Aug 8 field (HailGL) + the contours around the pick ---------------- */
  function buildField() {
    const HG = window.HailGL; if (!HG || !AUG) return null;
    let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
    (AUG.path || []).concat(...AUG_AREAS.map((a) => a.ring || [])).forEach((p) => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
    return HG.fieldFromStorms({ storms: [AUG], areas: AUG_AREAS, bounds: [x0 - 0.2, y0 - 0.12, x1 + 0.2, y1 + 0.12], res: 512, project: (p) => A.world.toWorld(p), arrival: 'path' });
  }
  function sampleField(f, x, y) {
    const fx = ((x - f.x0) / (f.x1 - f.x0)) * f.w - 0.5, fy = ((y - f.y0) / (f.y1 - f.y0)) * f.h - 0.5;
    const i = Math.floor(fx), j = Math.floor(fy); if (i < 0 || j < 0 || i >= f.w - 1 || j >= f.h - 1) return 0;
    const tx = fx - i, ty = fy - j, d = f.data, n = f.w;
    return (d[j * n + i] * (1 - tx) + d[j * n + i + 1] * tx) * (1 - ty) + (d[(j + 1) * n + i] * (1 - tx) + d[(j + 1) * n + i + 1] * tx) * ty;
  }
  /** real contour shapes around the pick: for each hail level, how far each of 96 rays travels before the hail drops below it */
  function buildContours(f, zC, R) {
    const n = 96, s = Math.pow(2, zC), pw = A.world.toWorld(PICK), maxD = 5.5 / 69.05, steps = 120;
    const v0 = f ? sampleField(f, pw[0], pw[1]) : 0;
    let levels = [0.7, 0.85, 1.0, 1.15, 1.3].filter((L) => L < v0 - 0.05).slice(-4);
    const out = [];
    if (f && levels.length >= 2) {
      for (const L of levels) {
        let r = [];
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU, dx = Math.cos(a), dy = Math.sin(a); let d = maxD;
          for (let k = 1; k <= steps; k++) { const t = (k / steps) * maxD; if (sampleField(f, pw[0] + dx * t, pw[1] + dy * t) < L) { d = t; break; } }
          r.push(Math.max(R * 1.25, d * s));
        }
        for (let pass = 0; pass < 3; pass++) r = r.map((v, i) => (r[(i + n - 1) % n] + 2 * v + r[(i + 1) % n]) / 4);
        out.push({ L, r });
      }
    } else {
      levels = [0.9, 1.1, 1.3];
      levels.forEach((L, k) => out.push({ L, r: Array.from({ length: n }, (x, i) => R * (3.6 - k * 0.8) * (1 + 0.12 * Math.sin(i / n * TAU * 2 + k) + 0.06 * Math.sin(i / n * TAU * 5 - k))) }));
    }
    return out;
  }

  /* ---------------- GL: the radar sweep (hairline beam, range rings, the hail it lights) ----------------
     The stage's darkness lives here too (u_veil, the page color): the beam lifts it where it passes, so the sweep
     literally reveals the geography (rivers, roads, towns) and the 2026 hail areas, which fade back like a radar
     scope's afterglow. Behind the beam: exp(-angle * 1.5), within ~120 mi of KOAX. */
  const SW_VS = ['#version 300 es', 'in vec2 a_p;', 'uniform mat3 u_inv;', 'out vec2 v_w;',
    'void main(){ v_w = (u_inv * vec3(a_p, 1.0)).xy; gl_Position = vec4(a_p, 0.0, 1.0); }'].join('\n');
  const SW_FS = ['#version 300 es', 'precision highp float;', 'in vec2 v_w;', 'out vec4 o;',
    'uniform sampler2D u_f;', 'uniform vec4 u_fb;', 'uniform float u_mul;', 'uniform float u_hf;', 'uniform vec2 u_radar;',
    'uniform float u_sweep;', 'uniform float u_px;', 'uniform float u_a;', 'uniform float u_glow;',
    'uniform vec3 u_h1;', 'uniform vec3 u_h15;', 'uniform vec3 u_h2;', 'uniform vec3 u_beam;',
    'uniform float u_veil;', 'uniform float u_lift;', 'uniform vec3 u_page;',
    'void main(){',
    '  vec2 r = v_w - u_radar; r.y = -r.y;',
    '  float dist = length(r);',
    '  float dA = mod(atan(r.y, r.x) - u_sweep, 6.2831853);',
    '  float trail = exp(-dA * 2.4);',
    '  float mi = dist * 69.05;',
    '  float fade = smoothstep(3.0, 30.0, dist / u_px) * (1.0 - smoothstep(95.0, 140.0, mi));',
    '  float perp = dist * min(dA, 6.2831853 - dA) / u_px;',
    '  float line = (1.0 - smoothstep(0.3, 1.2, perp)) * fade;',
    '  float wedge = exp(-dA * 7.0) * 0.06 * fade;',
    '  float rr = abs(fract(mi / 20.0 + 0.5) - 0.5) * 20.0 / 69.05 / u_px;',
    '  float ring = (1.0 - smoothstep(0.3, 1.1, rr)) * step(10.0, mi) * fade * (0.05 + 0.22 * trail);',
    '  vec2 uv = (v_w - u_fb.xy) / (u_fb.zw - u_fb.xy);',
    '  float inb = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);',
    '  float v = texture(u_f, uv).r * u_mul * inb * u_hf;',
    '  vec3 c = mix(u_h1, u_h15, smoothstep(1.1, 1.55, v)); c = mix(c, u_h2, smoothstep(1.7, 2.25, v));',
    '  float q = (v - 0.125) * 4.0; float fw = max(fwidth(q), 1e-4);',
    '  float iso = (1.0 - smoothstep(0.4, 1.3, abs(fract(q + 0.5) - 0.5) / fw)) * smoothstep(0.62, 0.85, v);',
    '  float heat = smoothstep(0.6, 1.4, v) * 0.18;',
    '  float lit = u_glow + (1.0 - u_glow) * trail;',
    '  float a = clamp((heat + iso * 0.6) * lit, 0.0, 0.85);',
    '  float b = clamp(line * 0.9 + wedge + ring, 0.0, 1.0);',
    '  vec4 top = vec4(c * a + u_beam * b * (1.0 - a), a + b * (1.0 - a)) * u_a;',
    '  float lift = exp(-dA * 1.5) * (1.0 - smoothstep(95.0, 140.0, mi)) * u_lift;',
    '  float va = u_veil * (1.0 - lift);',
    '  o = top + vec4(u_page * va, va) * (1.0 - top.a);',
    '}'].join('\n');

  const sweepAng = (T) => S.s0 - (T / 1000) * (TAU / 2.8);
  const sweepA = (T) => (0.35 + 0.65 * E.outCubic(seg(T, 0, 450))) * (1 - 0.55 * E.inOutSine(seg(T, 2500, 1000))) * (1 - E.inOutSine(seg(T, B.push - 300, 900)));
  /** the stage's own darkness over the world's light dim (the world veil is set to 0.1 while the intro runs): the first
      frame keeps the map readable (thumbnails), the lights go down as the radar starts, the storm and the push get a
      softer stage, and it lifts entirely at the hand-off. */
  const veilA = (T) => lerp(lerp(0.3, 0.52, smooth(T, 0, 800)), 0.22, smooth(T, 2600, 4700)) * (1 - E.inOutSine(seg(T, B.hand - 100, 700)));
  /** 0..1 how strongly the beam lifts the veil behind it; the town names on the top canvas ping with the same curve */
  const liftAt = (T, ang) => { const dA = ((ang - sweepAng(T)) % TAU + TAU) % TAU; return Math.exp(-dA * 1.5) * sweepA(T); };
  /** GL resources the film owns (not the world's shared cache, which lives for the page): made per GL context,
      remade after a context loss (world.glGen), deleted when the layer goes */
  function freeGL(R) {
    const gl = A.world.gl; if (!gl || !R || R.gen !== A.world.glGen || gl.isContextLost()) return;
    A.safe('intro free gl', () => {
      if (R.P && R.P.p) { (gl.getAttachedShaders(R.P.p) || []).forEach((s) => gl.deleteShader(s)); gl.deleteProgram(R.P.p); }
      [R.tex, R.tex0].forEach((t) => { if (t && t.tex) gl.deleteTexture(t.tex); });
    });
  }
  function sweepLayer() {
    let R = null;
    const res = () => {
      const W = A.world, glx = W.glx, HF = W.hail.field;
      if (!R || R.gen !== W.glGen) { freeGL(R); R = { gen: W.glGen, P: glx.program(SW_VS, SW_FS), tex: null, tex0: glx.texture(new Float32Array(4), 2, 2) }; }
      if (!R.tex && W.hail.ready) R.tex = glx.texture(HF.data, HF.nx, HF.ny);
      return R;
    };
    return {
      id: 'intro-sweep', z: 12, live: true, fadeIn: false,
      prepare() { if (A.world.hasGL && A.world.gl) A.safe('intro sweep prepare', res); },
      dispose() { freeGL(R); R = null; },
      drawGL(gl, f) {
        if (!S) return;
        const sa = sweepA(S.T), a = sa * f.alpha, v = veilA(S.T) * f.alpha; if (a <= 0.003 && v <= 0.003) return;
        const glx = A.world.glx, HF = A.world.hail.field;
        const r = A.safe('intro sweep gl', res); if (!r || !r.P || !r.tex0) return;
        const P = r.P, tex = r.tex, tex0 = tex || r.tex0;
        gl.useProgram(P.p);
        glx.uniforms(P, {
          u_inv: f.inv, u_f: { tex: tex0.tex, unit: 0 }, u_fb: [HF.x0, HF.y0, HF.x1, HF.y1], u_mul: tex ? tex.mul : 1, u_hf: tex ? 1 : 0,
          u_radar: A.world.toWorld(KOAX), u_sweep: sweepAng(S.T), u_px: f.px, u_a: a, u_glow: 0.12,
          u_h1: f.pal.rgb.h1, u_h15: f.pal.rgb.h15, u_h2: f.pal.rgb.h2, u_beam: f.pal.rgb.beam,
          u_veil: v, u_lift: sa, u_page: f.pal.rgb.page
        });
        glx.drawQuad(P);
      },
      draw2d(c, f) { // Canvas2D fallback: the veil the beam lifts, the beam, a trail wedge, range rings and the hail areas it lights
        if (!S) return;
        const a = sweepA(S.T), v = veilA(S.T);
        const o = f.project(KOAX), ang = -sweepAng(S.T), Rpx = 130 * f.pxPerMile;
        if (v > 0.003) A.safe('intro veil 2d', () => veil2d(c, f, o, ang, v, a));
        if (a <= 0.003) return;
        c.save(); c.globalAlpha = a;
        c.strokeStyle = f.pal.beam; c.lineWidth = 1;
        for (let mi = 20; mi <= 120; mi += 20) { c.globalAlpha = a * 0.12; c.beginPath(); c.arc(o[0], o[1], mi * f.pxPerMile, 0, TAU); c.stroke(); }
        for (let k = 0; k < 14; k++) { c.globalAlpha = a * 0.05 * (1 - k / 14); c.beginPath(); c.moveTo(o[0], o[1]); c.arc(o[0], o[1], Rpx, ang - (k + 1) * 0.06, ang - k * 0.06); c.closePath(); c.fillStyle = f.pal.beam; c.fill(); }
        c.globalAlpha = a * 0.9; c.beginPath(); c.moveTo(o[0], o[1]); c.lineTo(o[0] + Math.cos(ang) * Rpx, o[1] + Math.sin(ang) * Rpx); c.stroke();
        for (const ar of N.areas || []) {
          if (!ar.ring || !ar.c) continue;
          const q = f.project(ar.c), da = ((Math.atan2(-(q[1] - o[1]), q[0] - o[0]) + ang) % TAU + TAU) % TAU; // angle behind the beam
          c.globalAlpha = a * (0.1 + 0.6 * Math.exp(-da * 2.4));
          c.beginPath(); ar.ring.forEach((p, i) => { const s = f.project(p); if (i) c.lineTo(s[0], s[1]); else c.moveTo(s[0], s[1]); }); c.closePath();
          c.strokeStyle = A.world.hailColor(ar.hail); c.stroke();
        }
        c.restore();
      }
    };
  }

  /** the 2D stage veil: page color, lifted behind the beam with a conic gradient (the same curve as the shader) */
  function veil2d(c, f, o, ang, v, lift) {
    const pg = f.pal.rgb.page, col = (al) => 'rgba(' + Math.round(pg[0] * 255) + ',' + Math.round(pg[1] * 255) + ',' + Math.round(pg[2] * 255) + ',' + A.clamp(al, 0, 1).toFixed(3) + ')';
    c.save();
    if (c.createConicGradient && lift > 0.003) {
      const g = c.createConicGradient(ang, o[0], o[1]), n = 24;
      for (let i = 0; i <= n; i++) { const d = (i / n) * TAU; g.addColorStop(1 - i / n, col(v * (1 - Math.exp(-d * 1.5) * lift))); }
      c.fillStyle = g;
    } else c.fillStyle = col(v);
    c.fillRect(0, 0, f.w, f.h);
    c.restore();
  }

  /* ---------------- GL: the storm (burning swath, falling hail, knock rings) ---------------- */
  function hglTheme() {
    return { base: A.theme === 'light' ? 'light' : 'dark', gold: A.rgba('--h1'), orange: A.rgba('--h15'), red: A.rgba('--h2'),
      hot: A.rgba('--intro-hot'), ice: A.rgba('--intro-ice'), ring: A.rgba('--acc') };
  }
  /** one HailGL kit per drawing target, owned by the storm layer (so its dispose frees them even after the film ends);
      the GL one is made in play(), outside any frame, and remade after a context loss */
  function stormLayer() {
    const kits = {};
    const kit = (target, gl) => {
      const HG = window.HailGL; if (!HG || !S || !S.field) return null;
      const key = gl ? 'gl' : '2d', gen = gl ? A.world.glGen : 0, old = kits[key];
      if (old && old.__t === target && old.__g === gen) return old;
      if (old) { A.safe('intro kit dispose', () => old.dispose()); delete kits[key]; }
      const k = gl ? HG.create(target, { dpr: A.world.dpr, theme: S.theme, restoreState: false }) : HG.create(target, { webgl: 0, dpr: A.world.dpr, theme: S.theme });
      if (!k || !k.ok) return null;
      k.__t = target; k.__g = gen;
      k.field.setField(S.field);
      if (S.samp) k.hail.spawn({ count: S.keys.narrow ? 1400 : 2600, sampler: S.samp, dur: B.stormMs / 1000, lag: 0.03, seed: 808, fall: { height: 0.15, speed: 0.27 } });
      kits[key] = k; S.ringsAt = {}; S.lastT = -1; S.knocked = false;   // a fresh kit (or a restored context) re-adds its rings
      return k;
    };
    return {
      id: 'intro-storm', z: 14, live: true, fadeIn: false,
      prepare() { if (A.world.hasGL && A.world.gl) A.safe('intro kit', () => kit(A.world.gl, true)); },
      drawGL(gl, f) { if (!S) return; const k = A.safe('intro kit', () => kit(gl, true)); if (k) stormFrame(k, f.m, f); },
      draw2d(c, f) { if (!S) return; const k = A.safe('intro kit 2d', () => kit(c, false)); if (k) stormFrame(k, f.m, f); },
      dispose() { Object.keys(kits).forEach((key) => { A.safe('intro kit dispose', () => kits[key].dispose()); delete kits[key]; }); }
    };
  }
  const clockOf = (T) => (T - B.storm) / 1000;          // storm clock (s): stones and rings live on it
  function stormFrame(k, m, f) {
    const T = S.T, r = seg(T, B.storm, B.stormMs), clock = clockOf(T);
    if (T < B.storm - 80) return;
    // the front rings out every 320 ms: one deterministic schedule, so seeking gives the same frame
    if (T < S.lastT) { k.rings.clear(); S.ringsAt = {}; }
    const lvl = window.Sound && window.Sound.enabled ? Math.min(1, window.Sound.level() * 4) : 0;
    for (let i = 0; i * 0.32 <= Math.min(clock, B.stormMs / 1000); i++) {
      if (S.ringsAt[i]) continue; S.ringsAt[i] = 1;
      const p = window.HailGL.frontAt(S.field, (i * 0.32) / (B.stormMs / 1000), AUG.id, [0, 0, 1, 0]);
      k.rings.add(p[0], p[1], { t0: i * 0.32, size: 92, life: 1.5, width: 1.4, color: S.theme.ice, alpha: 0.85 });
    }
    if (!S.knocked && T >= B.mark + 420) {
      S.knocked = true; const pw = A.world.toWorld(PICK);
      k.rings.add(pw[0], pw[1], { t0: clockOf(B.mark + 420), size: S.keys.R * 3.4, life: 1.9, width: 2, color: S.theme.ring, alpha: 1 });
      k.rings.add(pw[0], pw[1], { t0: clockOf(B.mark + 560), size: S.keys.R * 5.2, life: 2.2, width: 1.4, color: S.theme.ring, alpha: 0.7 });
    }
    if (T < B.mark + 420) S.knocked = false;
    const fieldOp = (1 - 0.8 * E.inOutSine(seg(T, B.ring, B.mark - B.ring))) * (1 - seg(T, B.hand, 600));
    const hailOp = 1 - seg(T, B.push + 500, 900);
    k.field.draw(m, { t: T / 1000, reveal: r, opacity: fieldOp * f.alpha, theme: S.theme });
    if (hailOp > 0.01 && clock > -1) k.hail.draw(m, { t: clock, persp: 0.2, scale: 1.7, ringSize: 11, ringLife: 0.9, residue: 2.4, streak: 0.075, opacity: hailOp * f.alpha, theme: S.theme });
    k.rings.draw(m, { t: clock, opacity: f.alpha * (1 + lvl) });
    S.lastT = T;
  }

  /* ---------------- top canvas: KOAX, the storm's path, the front; and it anchors the DOM mark to the map ---------------- */
  function syncLayer() {
    return {
      id: 'intro-sync', z: 320, live: true, fadeIn: false,
      draw2d(c, f) {
        if (!S) return;
        const T = S.T, pal = f.pal;
        c.save();
        c.textBaseline = 'middle';
        // the radar the sweep comes from
        const ls = (px) => { if ('letterSpacing' in c) c.letterSpacing = px; };
        // a few quiet place names (the world's own labels rest during the film)
        const lz = 1 - 0.7 * smooth(f.zoom, 10.5, 11.3) - 0.3 * smooth(f.zoom, 11.6, 12.2), la = (1 - seg(T, B.mark - 350, 350)) * lz;   // the mark gets a clean stage
        if (la > 0.01) {
          ls('1.8px'); c.textAlign = 'left';
          const kw = A.world.toWorld(KOAX), sa = sweepA(T);
          for (const n in PLACES) {
            const big = BIG.has(n); let a = la * (big ? 1 : smooth(f.zoom, 9.6, 10.2)) * (n === 'Valley' ? 0 : 1); if (a < 0.02) continue;
            const q = f.project(PLACES[n]); if (q[0] < -60 || q[1] < -20 || q[0] > f.w + 60 || q[1] > f.h + 20) continue;
            // the beam finds each town: it pings, then settles to a resting brightness (full once the sweep has gone)
            const pw = A.world.toWorld(PLACES[n]), ang = Math.atan2(-(pw[1] - kw[1]), pw[0] - kw[0]), lift = liftAt(T, ang);
            a *= 0.42 + 0.58 * Math.max(lift, 1 - sa);
            c.font = (big ? '600 11px ' : '500 9.5px ') + MONO;
            c.globalAlpha = a * (big ? 0.9 : 0.6); c.fillStyle = big ? pal.label2 : pal.label;
            c.beginPath(); c.arc(q[0], q[1], big ? 2.2 : 1.6, 0, TAU); c.fill();
            c.lineWidth = 3; c.strokeStyle = pal.halo; c.strokeText(n.toUpperCase(), q[0] + 8, q[1] + 0.5); c.fillText(n.toUpperCase(), q[0] + 8, q[1] + 0.5);
            const dA = ((ang - sweepAng(T)) % TAU + TAU) % TAU;
            if (dA < 0.6 && sa > 0.05 && !f.still) {           // the ping: one hairline ring leaves the town as the beam crosses it
              const k = dA / 0.6;
              c.globalAlpha = la * sa * (1 - k) * 0.7; c.lineWidth = 1; c.strokeStyle = pal.beam;
              c.beginPath(); c.arc(q[0], q[1], 3 + k * (big ? 16 : 11), 0, TAU); c.stroke();
            }
          }
          ls('0px');
        }
        // the radar the sweep comes from
        const ka = sweepA(T);
        if (ka > 0.01) {
          const o = f.project(KOAX);
          c.globalAlpha = ka * 0.9; c.lineWidth = 1.2; c.strokeStyle = pal.text2;
          c.beginPath(); c.arc(o[0], o[1], 3.2, 0, TAU); c.stroke();
          c.beginPath(); c.arc(o[0], o[1], 7.5, 0, TAU); c.globalAlpha = ka * 0.35; c.stroke();
          c.font = '500 9.5px ' + MONO; ls('1.4px'); c.textAlign = 'right';
          const kl = A.t('KOAX RADAR', 'RADAR KOAX');
          c.globalAlpha = ka * 0.9; c.lineWidth = 3; c.strokeStyle = pal.halo; c.strokeText(kl, o[0] - 13, o[1] + 0.5); c.fillStyle = pal.text2; c.fillText(kl, o[0] - 13, o[1] + 0.5);
          ls('0px'); c.textAlign = 'left';
        }
        // the storm's real path: dotted ahead of the front, solid behind it
        const r = seg(T, B.storm, B.stormMs), pa = seg(T, B.storm - 250, 350) * (1 - seg(T, B.push + 200, 700));
        if (AUG && pa > 0.01 && S.field) {
          const pts = AUG.path.map((p) => f.project(p));
          c.lineCap = 'round'; c.strokeStyle = pal.text; c.lineWidth = 1.2;
          c.setLineDash([1, 5]); c.globalAlpha = pa * 0.45; c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.stroke();
          c.setLineDash([]);
          const fr = window.HailGL.frontAt(S.field, r, AUG.id, [0, 0, 1, 0]), fq = f.projectW(fr[0], fr[1]);
          c.globalAlpha = pa * 0.95; c.lineWidth = 1.5; c.strokeStyle = pal.text;
          c.beginPath(); c.arc(fq[0], fq[1], 5, 0, TAU); c.stroke();
          c.beginPath(); c.arc(fq[0], fq[1], 1.8, 0, TAU); c.fillStyle = pal.text; c.fill();
        }
        c.restore();
        place(f, T);
      }
    };
  }

  /* ---------------- anchored DOM (contours → ring → mark, the wordmark) ----------------
     Placed from the same world frame the canvases draw (the sync layer), so the DOM never swims against the map;
     captureFlight() also calls it with a fresh frame so a seek (the director) or a dropped frame can't skip it. */
  function place(f, T) {
    const D = S.dom, K = S.keys; if (!D || !K) return;
    if (T == null) T = S.T;
    const q = f.project(PICK), px = q[0] + S.off[0], py = q[1] + S.off[1], zs = Math.pow(2, f.zoom - K.zC), R = K.R;
    // contours: the real hail levels around the pick, drawn fine, converging into one ring that thickens into the mark's
    const ca = seg(T, B.ring, 320) * (1 - seg(T, B.mark, 170));
    D.cont.style.opacity = ca.toFixed(3);
    if (ca > 0.001 && S.cont) {
      if (!D.paths.length) S.cont.forEach(() => { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('vector-effect', 'non-scaling-stroke'); D.cont.appendChild(p); D.paths.push(p); });
      const k = E.inOutCubic(seg(T, B.ring + 250, B.mark - B.ring - 250)), tint = smooth(k, 0.25, 0.85);
      D.cont.setAttribute('transform', 'translate(' + px.toFixed(1) + ' ' + py.toFixed(1) + ') scale(' + zs.toFixed(4) + ')');
      S.cont.forEach((lv, j) => {
        const n = lv.r.length; let d = '';
        for (let i = 0; i < n; i++) { const a = (i / n) * TAU, rr = lerp(lv.r[i], R, k); d += (i ? 'L' : 'M') + (Math.cos(a) * rr).toFixed(1) + ' ' + (Math.sin(a) * rr).toFixed(1); }
        const p = D.paths[j];
        p.setAttribute('d', d + 'Z');
        p.style.strokeWidth = lerp(1 + j * 0.2, R * 0.5 * zs, Math.pow(k, 5)).toFixed(2) + 'px';
        p.style.stroke = 'color-mix(in oklab, var(' + A.ui.hailTok(Math.max(1, lv.L)) + '), var(--acc) ' + Math.round(tint * 100) + '%)';
        p.style.opacity = (lerp(0.4 + 0.6 * (j + 1) / S.cont.length, 1, k)).toFixed(3);
      });
    }
    // the mark and the wordmark, anchored to the pick until the hand-off takes them (position and opacity together)
    if (T < B.hand) {
      const km = (R / 10) * Math.min(1, zs);
      S.anchor = { cx: px, cy: py, k: km };
      setMark(px, py, km);
      const F = parseFloat(S.nameF) || 60, m = Math.min(1, zs);
      S.wordAt = K.narrow ? { x: px - F * 1.6, y: py + R * 1.55 * m } : { x: px + R * 2.25 * m, y: py - R * 0.7 * m - F * 0.62 };
      const wa = seg(T, B.mark + 300, 420);
      D.word.style.opacity = wa.toFixed(3);
      D.word.style.transform = 'translate(' + (S.wordAt.x - 14 * (1 - E.outCubic(seg(T, B.mark + 300, 450)))).toFixed(1) + 'px,' + S.wordAt.y.toFixed(1) + 'px)';
    }
  }
  function setMark(cx, cy, k) { S.dom.mark.setAttribute('transform', 'matrix(' + k.toFixed(4) + ' 0 0 ' + k.toFixed(4) + ' ' + (cx - 24 * k).toFixed(2) + ' ' + (cy - 31.5 * k).toFixed(2) + ')'); }

  /* ---------------- the hand-off: FLIP the lockup into the top bar ---------------- */
  function rectIn(el) { const r = el && el.getBoundingClientRect(); return r && r.width > 0 ? { x: r.left - S.ovl.x, y: r.top - S.ovl.y, w: r.width, h: r.height } : null; }
  function captureFlight() {
    if (!S || S.fly) return;
    const D = S.dom;
    // the lockup as it stands on the last frame before the hand-off (the camera is already at its end: render clamps it)
    A.safe('intro place', () => place(A.world.frame(), Math.min(S.T, B.hand - 1)));
    if (!S.anchor) { const q = A.world.project(PICK); S.anchor = { cx: q[0] + S.off[0], cy: q[1] + S.off[1], k: S.keys.R / 10 }; }
    D.name.style.transform = ''; D.cut.style.transform = ''; D.name.style.opacity = ''; D.cut.style.opacity = '';
    const bm = rectIn(A.$('#topbar .brand__mark')), bw = rectIn(A.$('#topbar .brand__word')), bc = rectIn(A.$('#topbar .brand__cut'));
    const nw = rectIn(D.name), cw = rectIn(D.cut), wr = rectIn(D.word);
    S.fly = {
      m0: S.anchor, m1: bm ? { cx: bm.x + (24 * bm.w) / 48, cy: bm.y + (31.5 * bm.h) / 48, k: bm.w / 48 } : null,
      w0: wr, n0: nw, c0: cw, n1: bw, c1: bc
    };
  }
  /** progress along a flight of d px with the hail spring: the landing overshoot stays a few px however far it flew
      (a 5% overshoot on a 900 px flight would throw the mark off the screen's edge) */
  const land = (e, d) => (e <= 1 ? e : 1 + (e - 1) * Math.min(1, 80 / Math.max(1, Math.abs(d))));
  function flight(T) {
    const D = S.dom, F = S.fly; if (!F) return;
    const p = seg(T, B.hand, B.handMs * 0.82), e = E.hail(p), fade = 1 - seg(T, B.hand + LAND, 200);
    root.classList.toggle('intro-landed', T >= B.hand + LAND);   // the real lockup takes over at the same spot
    if (F.m1) {
      const cx = lerp(F.m0.cx, F.m1.cx, land(e, F.m1.cx - F.m0.cx)), cy = lerp(F.m0.cy, F.m1.cy, land(e, F.m1.cy - F.m0.cy));
      const k = Math.exp(lerp(Math.log(F.m0.k), Math.log(F.m1.k), Math.min(1, e)));
      setMark(cx, cy, k);
    }
    D.svg.style.opacity = F.m1 ? fade.toFixed(3) : (1 - seg(T, B.hand, 300)).toFixed(3);
    // the wordmark and "Claude's cut" land on theirs (each only when its twin is visible in the bar)
    const one = (el, from, to, base) => {
      if (!from || !to) { el.style.opacity = (1 - seg(T, B.hand, 260)).toFixed(3); return; }
      const s = Math.exp(lerp(0, Math.log(to.h / from.h), Math.min(1, e)));
      const x = (to.x - from.x) * land(e, to.x - from.x), y = (to.y - from.y) * land(e, to.y - from.y);
      el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + s.toFixed(4) + ')';
      el.style.opacity = fade.toFixed(3);
    };
    if (F.w0) {
      D.word.style.transform = 'translate(' + F.w0.x.toFixed(1) + 'px,' + F.w0.y.toFixed(1) + 'px)';
      one(D.name, F.n0, F.n1, F.w0); one(D.cut, F.c0, F.c1, F.w0);
    }
  }

  /* ---------------- everything that is not anchored: a pure function of T ---------------- */
  function render(T) {
    if (!S) return;
    S.T = T;
    const D = S.dom, H = E.hail, hand = seg(T, B.hand - 220, 320);
    // camera: a pure function of T until the hand-off (held at its last key after B.hand), so any seek lands right;
    // once handed off, the start view flies it
    if (!S.handed && S.keys) { const c = camAt(Math.min(T, B.hand)); A.world.jump({ center: A.world.toLonLat([c.x, c.y]), zoom: c.z }); }
    const set = (el, o, tf) => { if (!el) return; el.style.opacity = o.toFixed(3); if (tf != null) el.style.transform = tf; };
    // title card: legible from the first frames, the question changes as the camera dives, and it leaves entirely
    // (title and its source lines) as the mark draws, so the lockup and the answer own the payoff frame alone
    const ci = E.outCubic(seg(T, 0, 360)), back = 1 - E.inOutSine(seg(T, B.mark + 40, 400));
    set(D.card, (0.62 + 0.38 * ci) * back * (1 - hand), 'translateY(' + ((1 - ci) * 8 - (1 - back) * 10 - hand * 8).toFixed(1) + 'px)');
    const ta = seg(T, B.push, 300), tb = seg(T, B.push + 160, 560);
    set(D.ta, 1 - ta, 'translateY(' + (-12 * E.outCubic(ta)).toFixed(1) + 'px)');
    set(D.tb, Math.min(1, tb * 2.2), 'translateY(' + ((1 - H(tb)) * 0.62).toFixed(3) + 'em)');
    // storm readout
    const ri = seg(T, B.storm - 150, 450), ro = seg(T, B.push + 250, 420), r = seg(T, B.storm, B.stormMs);
    set(D.readout, ri * (1 - ro), 'translateY(' + ((1 - E.outCubic(ri)) * -8 + ro * -8).toFixed(1) + 'px)');
    const mi = A.fmt.num(r * PATH_MI, 1);
    if (D.mi.textContent !== mi) D.mi.textContent = mi;
    D.track.style.transform = 'scaleX(' + r.toFixed(4) + ')';
    // the season in four numbers
    D.stats.forEach((el, i) => {
      const p = seg(T, B.count + i * 110, 560), out = seg(T, B.head - 520 + i * 45, 320);
      set(el, Math.min(1, p * 2.4) * (1 - out), 'translateY(' + ((1 - H(p)) * 18 - out * 10).toFixed(1) + 'px)');
    });
    // the mark: the roof pitches out from its ridge, then the knocker dot drops in with the hail spring
    const ringA = seg(T, B.mark - 40, 140);
    D.ring.style.opacity = ringA.toFixed(3);
    const rd = (1 - E.outCubic(seg(T, B.mark + 60, 520))).toFixed(4), rop = seg(T, B.mark + 40, 80).toFixed(3);
    D.roof.forEach((p) => { p.style.strokeDashoffset = rd; p.style.opacity = rop; });
    const dp = seg(T, B.mark + 400, 420);
    D.dot.style.transform = 'scale(' + (dp <= 0 ? 0 : E.hail(dp)).toFixed(4) + ')';
    if (T < B.hand) {
      // the mark's and the wordmark's position + opacity are set by place(), from the same frame as the map
      D.svg.style.opacity = '1';
      D.name.style.transform = ''; D.cut.style.transform = ''; D.name.style.opacity = ''; D.cut.style.opacity = '';
    } else {
      if (!S.fly) captureFlight();                      // a seek or a dropped frame jumped straight past the cue
      D.word.style.opacity = '1'; flight(T);
    }
    // headline, word by word
    D.hw.forEach((w) => {
      const i = +w.dataset.i || 0, p = seg(T, B.head + i * 55, 640);
      w.style.transform = 'translateY(' + ((1 - H(p)) * 108).toFixed(2) + '%)';
      w.style.opacity = Math.min(1, p * 3).toFixed(3);
    });
    set(D.head, 1 - hand, 'translateY(' + (-10 * E.outCubic(hand)).toFixed(1) + 'px)');
    set(D.hsrc, seg(T, B.head + 520, 400));
    // the stage leaves with the hand-off
    set(D.scrim, 1 - seg(T, B.hand, 620));
    set(D.skip, (0.25 + 0.75 * seg(T, 250, 400)) * (1 - hand));
    D.prog.style.transform = 'scaleX(' + (T / DUR).toFixed(4) + ')';
    D.prog.parentNode.style.opacity = (1 - hand).toFixed(3);
    // sound: the hail bed follows the storm (only after a gesture turned sound on)
    const s = snd();
    if (s && S.playing && T - (S.bedAt || -1e9) > 180) { S.bedAt = T; A.safe('intro bed', () => s.hailBed(T > B.storm && T < B.push + 400 ? 0.2 + 0.45 * Math.sin(Math.PI * Math.min(1, r * 1.1)) : 0)); }
    // live layers redraw on their own while playing; a frozen or paused film (dev freeze, the director's seek) asks
    if (S.freeze != null || !S.tl || !S.tl.playing) A.world.invalidate();
    else if (S.rate && !S.rateOn) { S.rateOn = true; A.motion.ticker.add(S.rate); }   // resumed after a pause
    if (T < B.hand - 20 && S.fly && !S.handed) S.fly = null;      // seeked back before the hand-off: measure again
  }

  /* ---------------- the timeline ---------------- */
  function buildTimeline() {
    const tl = new A.motion.Timeline();
    const cue = (at, fn) => tl.add(at, (t, o) => { if (S) A.safe('intro cue', () => fn(o || {})); });
    const sound = (at, fn) => cue(at, (o) => { const s = snd(); if (s && !o.seeking) A.safe('intro sound', () => fn(s)); });
    tl.add(0, { ms: DUR, ease: E.linear, update: (e, p) => render(p * DUR) });
    sound(0, (s) => { if (!(s.state && s.state().score)) { s.score(true); S.scoreMine = true; } });
    sound(B.storm - 180, (s) => s.thunder(0.55));
    [0, 1000, 2000, 3000].forEach((d) => sound(B.storm + d, (s) => s.ring(undefined, { gain: 0.55 })));
    COUNTS.forEach((c, i) => cue(B.count + i * 110 + 40, (o) => {
      const el = S.dom.statV[i]; if (!el) return;
      if (o.seeking || A.still) el.textContent = A.fmt.int(c.v);
      else { A.motion.countUp(el, c.v, { ms: 1000, format: (v) => A.fmt.int(v) }); const s = snd(); if (s) s.tick(); }
    }));
    sound(B.mark + 420, (s) => s.knock({ count: 2, gain: 0.9 }));
    cue(B.hand - 20, () => captureFlight());
    cue(B.hand + 110, () => handoff());
    sound(B.hand + 560, (s) => s.ring(5, { gain: 0.5 }));
    // the mark lands in the bar and rings out once, like a knock
    cue(B.hand + LAND - 90, (o) => {
      const F = S.fly; if (o.seeking || A.still || !F || !F.m1) return;
      A.motion.ripple(F.m1.cx + S.ovl.x, F.m1.cy + S.ovl.y, { rings: 2, size: Math.max(28, F.m1.k * 48) });
    });
    tl.onEnd((done) => finish(done));
    return tl;
  }

  /* ---------------- play / skip / stop ---------------- */
  const filming = () => !!(A.director && A.director.active);   // inside the film the director owns keys and clicks
  function onKey(e) {
    if (!S || S.handed || e.metaKey || e.ctrlKey || e.altKey || filming()) return;
    const k = e.key;
    if (k === 'Escape' || k === ' ' || k === 'Spacebar' || k === 'Enter' || /^[1-9]$/.test(k)) { e.preventDefault(); e.stopPropagation(); skip(); }
  }
  function onResize() {
    if (!S || S.handed) return;
    A.safe('intro resize', () => {
      S.keys = camKeys(); measure(); S.cont = buildContours(S.field, S.keys.zC, S.keys.R); S.dom.paths.forEach((p) => p.remove()); S.dom.paths = [];
      S.fly = null;
      render(S.T);
    });
  }
  function measure() {
    const el = S.dom.el, ov = el.getBoundingClientRect(), wr = A.world.el.getBoundingClientRect();
    S.ovl = { x: ov.left, y: ov.top };
    S.off = [wr.left - ov.left, wr.top - ov.top];
    const K = S.keys;
    S.nameF = (K.R * (K.narrow ? 0.95 : 1.28)).toFixed(1);
    el.style.setProperty('--intro-name', S.nameF + 'px');
    // where the map sits inside the stage: on stacked screens the map is a block under the bar, and the readout,
    // the numbers and the headline arrange themselves around it
    el.style.setProperty('--intro-map-t', Math.round(wr.top - ov.top) + 'px');
    el.style.setProperty('--intro-map-b', Math.round(ov.bottom - wr.bottom) + 'px');
  }
  function unhide() {
    if (pre) { pre.el.remove(); pre = null; }
    root.classList.remove('intro-on');
    A.ui.chrome(true);
    chromeInert(false);
  }
  /* the hidden chrome (opacity 0) must not take focus either: Tab during the cold open would land on an invisible
     button. Inside the film the director owns inert on the bar and stage; the map's HUD is always ours to clear. */
  function chromeInert(on) {
    const film = !!(A.director && A.director.active);
    if (on && film) return;
    const els = film ? [] : [document.getElementById('topbar'), document.getElementById('stage')];
    els.push(document.querySelector('#world .hud'));
    els.forEach((el) => { if (el) el.inert = !!on; });
  }

  function play(o) {
    o = o || {};
    if (S) {
      if (!(o.force && S.handed)) return S.promise;    // running: the same run (the director seeks it)
      finish(true);                                    // asked again after its hand-off: end this one, start fresh
    }
    if (!wanted(o) || !A.world || !A.world.ready || !A.world.el) { unhide(); return Promise.resolve(false); }
    root.classList.remove('intro-landed');
    const dev = devParam(), freeze = dev && +dev > 1 ? A.clamp(+dev, 0, DUR) : null;
    seen.set();
    let res; const promise = new Promise((r) => (res = r));
    const W = A.world, cur = A.view && A.view.current;
    S = { promise, res, T: 0, lastT: -1, ringsAt: {}, playing: false, handed: false, dom: null, theme: hglTheme(), freeze, live: true };
    // remember what the world looked like (a replay runs over a live view)
    S.restore = { view: cur, inset: W.insetTarget, hidden: W.layer.list().filter((id) => id !== 'hail' && !/^intro-/.test(id) && (W.layer.get(id) || {}).visible !== false) };
    S.restore.hidden.forEach((id) => W.layer.set(id, { visible: false }));
    root.classList.add('intro-on');
    A.ui.chrome(false);
    chromeInert(true);
    A.safe('intro hide tip', () => A.ui.hideTip());
    W.setInset({ l: 0, r: 0, t: 0, b: 0 });
    W.layer.opacity('hail', 0, { ms: cur ? 400 : 0 });
    W.ambient(false);
    W.setDim(0.1);                                         // the rest of the stage's darkness is the sweep layer's veil
    S.restore.labels = W.options({}).labels !== false;
    W.options({ labels: false });                          // the film uses its own few, quiet place names
    S.dom = pre || mount(); pre = null;
    S.keys = camKeys();
    measure();
    S.field = A.safe('intro field', buildField) || null;
    S.samp = S.field && window.HailGL ? window.HailGL.sampler(S.field, { min: 0.55, seed: 8 }) : null;
    S.cont = A.safe('intro contours', () => buildContours(S.field, S.keys.zC, S.keys.R)) || null;
    // the sweep finds Columbus right when the storm starts
    const kx = W.toWorld(KOAX), cw = W.toWorld(AUG_MID);
    S.s0 = Math.atan2(-(cw[1] - kx[1]), cw[0] - kx[0]) + (B.storm / 1000) * (TAU / 2.8);
    const sw = sweepLayer(), st = stormLayer();
    W.layer.add(sw); W.layer.add(st); W.layer.add(syncLayer());
    // compile + upload now (outside any frame), so the storm's first frame at 1.2 s never hitches
    sw.prepare(); st.prepare();
    S.offTheme = A.on('theme', () => { if (S) { S.theme = hglTheme(); W.invalidate(); } });
    S.offLang = A.on('lang', () => { if (S) render(S.T); });
    S.dom.el.addEventListener('click', (e) => { if (!filming()) skip(e); });
    addEventListener('keydown', onKey, true);
    addEventListener('resize', onResize);
    S.tl = buildTimeline();
    render(0);
    if (freeze != null) {
      // dev: hold one frame for screenshots; tools may treat the page as settled
      S.tl.seek(freeze); render(freeze); layersLive(false); W.invalidate();
      A.ready = true;
      return promise;
    }
    // wall-clock true: when frames run slow, the timeline speeds up so the intro still lasts 8.7 s. And a frame budget:
    // a film at 3 fps is worse than none. Two frames in a row over 300 ms once the camera is moving (no GPU
    // acceleration: the moving map redraws on the CPU) and the intro steps aside. ?intro=1 (dev) always plays it.
    let last = 0, slow = 0;
    const rate = (now, dt) => {
      if (!S || !S.tl) return false;
      // paused (the director): stop redrawing and leave the loop; render() re-attaches this when the timeline plays again
      if (!S.tl.playing) { last = 0; slow = 0; if (S.live) layersLive(false); S.rateOn = false; return false; }
      if (!S.live) layersLive(true);
      const real = last ? now - last : dt; last = now;
      // inside the film the director's clock sets the pace (it does not catch up on slow frames, so neither do we)
      S.tl.rate = filming() ? 1 : A.clamp(real / Math.max(1, dt), 1, 40);
      if (dev !== '1' && S.tl.time > 300 && S.tl.time < B.hand) {
        slow = real > 300 ? slow + 1 : 0;
        if (slow >= 2) {
          A.safe('intro budget', () => A.ui.toast({ en: 'Skipped the intro so the app stays fast on this device.', es: 'Omitimos la introducción para que la app siga rápida en este equipo.' }, { icon: 'film' }));
          skip(true);
          return false;
        }
      }
      return true;
    };
    S.rate = rate; S.rateOn = true;
    A.motion.ticker.add(rate);
    S.playing = true;
    S.tl.play();
    if (dev === '1') A.ready = true;                      // dev: shoot.mjs --wait N then measures from the intro's start
    return promise;
  }
  function layersLive(on) { if (S) S.live = on; ['intro-sweep', 'intro-storm', 'intro-sync'].forEach((id) => A.world.layer.set(id, { live: on })); }
  let lastSkip = 0;
  /** skip(): the first skip jumps to the hand-off (the lockup still flies home), a second one ends it; skip(true) ends it */
  function skip(now) {
    if (!S || !S.tl) return;
    const t = performance.now(); if (now !== true && t - lastSkip < 260) return; lastSkip = t;
    if (S.freeze != null) { finish(false); return; }
    if (now !== true && S.tl.time < B.hand - 30) { S.tl.seek(B.hand - 30); if (!S.tl.playing) S.tl.play(); }
    else S.tl.skip();
  }
  function stop() { if (S && S.tl) { if (S.freeze != null) finish(false); else S.tl.stop(); } }

  /* the hand-off: the start view takes over while the lockup lands in the bar */
  function handoff(played) {
    if (!S || S.handed) return;
    S.handed = true;
    removeEventListener('keydown', onKey, true);
    S.dom.el.classList.add('is-leaving');                 // clicks pass through to the view landing underneath
    A.ui.chrome(true);
    chromeInert(false);
    const R = S.restore, W = A.world;
    W.options({ labels: R.labels });
    if (R.view) {                                         // a replay over a live view: put the view back
      const v = A.view.get(R.view) || {};
      W.layer.opacity('hail', v.hail == null ? 1 : v.hail, { ms: 500 }); W.ambient(v.ambient !== false); W.setDim(v.dim || 0);
      R.hidden.forEach((id) => W.layer.set(id, { visible: true }));
      R.hidden = [];
      A.safe('intro recenter', () => { A.view.relayout({ ms: 420 }); A.view.recenter(); });
    }
    A.emit('intro:handoff', { view: R.view || 'now' });
    const s = snd(); if (s) A.safe('intro bed off', () => s.hailBed(0));
    const r = S.res; S.res = null; if (r) r(played !== false);
  }
  function finish(done) {
    if (!S || S.done) return;
    if (!S.handed) { if (S.tl && S.tl.time >= B.hand - 30) captureFlight(); handoff(done); }
    S.done = true;
    root.classList.add('intro-landed');
    const s = snd(); if (s) A.safe('intro sound off', () => { s.hailBed(0); if (S.scoreMine && !(A.director && A.director.playing)) s.score(false); });
    const W = A.world, dom = S.dom, Sx = S;
    // the three heavy GL layers: cut at once when the intro ends or is stopped (the film's own cut covers it; a fade
    // keeps them drawing every frame on a slow renderer); only a plain skip by the viewer fades them
    const cut = done || done === false || filming();
    ['intro-sweep', 'intro-storm', 'intro-sync'].forEach((id) => W.layer.remove(id, { ms: cut ? 0 : 260 }));
    if (Sx.restore.hidden.length) Sx.restore.hidden.forEach((id) => W.layer.set(id, { visible: true }));
    A.motion.exit([dom.el], { ms: done ? 1 : 180, y: 0 }).then(() => { dom.el.remove(); });
    if (Sx.offTheme) Sx.offTheme(); if (Sx.offLang) Sx.offLang();
    removeEventListener('keydown', onKey, true);
    removeEventListener('resize', onResize);
    setTimeout(() => { if (!S) root.classList.remove('intro-on', 'intro-landed'); }, 700);
    S = null;
    W.invalidate();
  }

  A.intro = {
    play,
    skip,
    stop,
    /** the running Timeline (seekable by the director); null when idle */
    get timeline() { return S ? S.tl : null; },
    get active() { return !!S; },
    duration: DUR,
    beats: B
  };

  /* first paint: when the intro is going to play, hide the chrome and put the title card up before boot runs */
  A.safe('intro early mount', () => {
    if (!wanted({})) return;
    root.classList.add('intro-on');
    A.ui.chrome(false);
    chromeInert(true);
    pre = mount();
    render0(pre);
  });
  function render0(D) { // the title card at t=0 without a running intro
    D.card.style.opacity = '0.62'; D.card.style.transform = 'translateY(8px)';
    [D.readout, D.head, D.tb, D.word, D.hsrc].forEach((el) => { if (el) el.style.opacity = '0'; });
    D.stats.forEach((el) => (el.style.opacity = '0'));
    D.hw.forEach((w) => { w.style.transform = 'translateY(108%)'; });
    D.ring.style.opacity = '0'; D.roof.forEach((p) => (p.style.opacity = '0')); D.dot.style.transform = 'scale(0)';
  }
})();
