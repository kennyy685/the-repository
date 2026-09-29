/* Claude's Aldaba · js/lib/sound.js · window.Sound
   A tiny sound-design layer, synthesized with the Web Audio API (no files, no libraries). OFF by default: it speaks
   only after a user gesture turns it on ("Play the film" or the speaker toggle). Sparse and warm; every cue means one
   thing, and the mix keeps knock + ring in front with the storm bed and the score well under them.

     Sound.enable() -> bool      call from a click/tap: creates or resumes the one AudioContext, restores score/bed
     Sound.disable()             150 ms fade, then suspends. Sound.toggle() flips. Sound.stop() fades bed + score now
     Sound.enabled  Sound.supported  Sound.reduced        read-only flags
     Sound.setReduced(true | false | null)                null = follow prefers-reduced-motion (reduced = knock only)
     Sound.volume(v 0..1) -> v   master volume (audio taper, remembered per viewer); no argument = read it
     Sound.knock({count 2, gap .19, gain 1, pan 0, delay 0})         two soft knocks on a wooden door: a door is tapped
     Sound.hail(intensity 0..1, {pan, surface 'roof'|'glass', gain, delay})   one stone on a roof or a window
     Sound.hailBed(level 0..1)   hail texture from look-ahead scheduled ticks + air; level glides (tau .6 s); 0 = end
     Sound.thunder(dist 0..1, {gain, delay})   distant low rumble (0 = near, 1 = far); at most one per 6 s
     Sound.ring(degree, {gain, pan, tail, delay})   soft bell on D major pentatonic: 0 = D5, 1 = E5 .. 5 = D6, -1 = B4;
                                                    no degree = the next note of a gentle motif (a row always sounds musical)
     Sound.tick({gain})          nearly silent UI tick for counters/toggles (rate-limited to one per 35 ms)
     Sound.score(on)             slow ambient pad in D under the film, 2 s fade in / out
     Sound.level() -> rms        live output RMS 0..1 (for visuals that breathe with the sound)
     Sound.state() -> {supported, enabled, reduced, volume, context, bed, score}; window event 'sound:change' {detail}
     Sound.render(fn(api) | name, seconds, {args, volume, seed}) -> Promise<AudioBuffer>
                                 the same synths into an OfflineAudioContext (48 kHz, seeded, silent): tests + dev page
     Sound.analyze(buffer, {from}) -> {peakDb, rmsDb, lufs, dur, clips}   lufs = max momentary (BS.1770, 400 ms)

   score() and hailBed() are declarative: the app says what it wants and the layer plays it whenever it's allowed to
   (enabled, not reduced), so turning sound on mid-film brings the pad and the storm back. One-shots are fire-and-forget
   and return true when they played. A hidden page suspends the context and resumes on return; one-shots are dropped
   while hidden (never queued late). Master: volume -> gate -> gentle compressor -> trim -> soft ceiling (a waveshaper
   whose curve tops out at -1.6 dBFS), so the output cannot pass -1 dBFS. Any failure is caught and warned once. */
(function (root) {
  'use strict';

  var AC = root.AudioContext || root.webkitAudioContext || null;
  var OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext || null;
  var D5 = 587.3295;
  var PENTA = [0, 2, 4, 7, 9];                     // semitones: D E F# A B
  var MOTIF = [0, 2, 4, 3, 5, 4, 2, 1];            // ring() with no degree walks this
  var LOOK = 0.12, STEP_MS = 25;                   // bed scheduler: fill 120 ms ahead, wake every 25 ms
  var GLIDE = 0.6, BED_RMAX = 64, BED_BASE = 10;   // bed level glide (s), ticks/s at level 1, thinning base rate
  var VOL_KEY = 'aldaba.sound.volume';

  // The mix (linear gains before the master bus), tuned by the numbers in dev/sound-demo.html -> Measure.
  var LV = {
    knock: 0.8, knockRoom: 0.22,
    ring: 0.16, ringRoom: 0.3,
    hail: 0.34, bed: 0.5, bedRoom: 0.25, wash: 0.05,
    thunder: 0.55,
    tick: 0.17,
    score: 0.1, air: 0.07,
    roomRet: 0.55, trim: 0.9
  };

  var G = null;                                    // the live graph (built on first enable)
  var enabled = false, vol = readVol(), forced = null, osReduced = false;
  var want = { score: false, bed: 0 };
  var live = { bed: null, score: null, motif: 0, thunder: -1e9, tick: -1e9 };
  var warned = {}, suspendTimer = 0, armed = false, meterBuf = null, CURVE = null;
  var rand = Math.random;

  // ---------------------------------------------------------------- small utils
  function noop() {}
  function clamp(x, a, b) { x = +x; if (x !== x) return a; return x < a ? a : x > b ? b : x; }
  function num(v, d) { v = v == null ? d : +v; return v !== v ? d : v; }
  function warn(k, e) {
    if (warned[k]) return; warned[k] = 1;
    try { console.warn('[Sound] ' + k + ' skipped: ' + (e && e.message ? e.message : e)); } catch (_) { /* no console */ }
  }
  function safe(k, fn, fallback) {
    return function () { try { return fn.apply(null, arguments); } catch (e) { warn(k, e); return fallback; } };
  }
  function quiet(p) { if (p && p.catch) p.catch(noop); }
  function mulberry(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function taper(v) { return v * v; }
  function readVol() {
    try { var v = parseFloat(root.localStorage.getItem(VOL_KEY)); if (v >= 0 && v <= 1) return v; } catch (e) { /* storage blocked */ }
    return 0.8;
  }
  function hidden() { return !!(root.document && root.document.hidden); }
  function reduced() { return forced == null ? osReduced : forced; }
  function on() { return enabled && !!G && G.ctx.state !== 'closed'; }
  function audible() { return on() && !hidden(); }

  // ---------------------------------------------------------------- node helpers (short-lived nodes only)
  function gainN(ctx, v) { var g = ctx.createGain(); g.gain.value = v; return g; }
  function filt(ctx, type, f, q) { var b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; return b; }
  function osc(ctx, type, f) { var o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }
  function chain() { for (var i = 0; i < arguments.length - 1; i++) arguments[i].connect(arguments[i + 1]); return arguments[arguments.length - 1]; }
  function env(p, t, peak, att, tau) { p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + att); p.setTargetAtTime(0, t + att, tau); }
  function hold(p, t) {
    if (p.cancelAndHoldAtTime) { p.cancelAndHoldAtTime(t); return; }
    var v = p.value; p.cancelScheduledValues(t); p.setValueAtTime(v, t);
  }
  function panTo(g, v, dest) {
    if (!v || !g.ctx.createStereoPanner) return dest;
    var p = g.ctx.createStereoPanner(); p.pan.value = clamp(v, -1, 1); p.connect(dest); return p;
  }
  function noise(g, buf, t, dur, rate) {
    var s = g.ctx.createBufferSource(); s.buffer = buf; if (rate) s.playbackRate.value = rate;
    s.start(t, rand() * Math.max(0, buf.duration - dur - 0.05), dur); return s;
  }
  function duck(g, t, depth, len) {
    var p = g.duck.gain; p.cancelScheduledValues(t); p.setTargetAtTime(depth, t, 0.02); p.setTargetAtTime(1, t + len, 0.35);
  }

  // ---------------------------------------------------------------- graph
  function ceiling() {                            // identity to -4.4 dBFS, then a tanh knee that tops out at -1.6 dBFS
    if (CURVE) return CURVE;
    var n = 4097, c = new Float32Array(n), a = 0.6, top = 0.85, w = top - a;
    for (var i = 0; i < n; i++) {
      var x = i / (n - 1) * 2 - 1, m = Math.abs(x);
      c[i] = m <= a ? x : (x < 0 ? -1 : 1) * (a + w * Math.tanh((m - a) / w));
    }
    return (CURVE = c);
  }
  function roomIR(ctx) {                          // a small wooden room: early reflections + 0.6 s dark tail
    var sr = ctx.sampleRate, len = Math.floor(sr * 0.6), b = ctx.createBuffer(2, len, sr), r = mulberry(11);
    for (var ch = 0; ch < 2; ch++) {
      var d = b.getChannelData(ch), lp = 0;
      for (var i = 0; i < len; i++) {
        var t = i / sr, k = 0.7 - 0.55 * Math.min(1, t / 0.35);
        lp += k * ((r() * 2 - 1) - lp);
        d[i] = lp * Math.exp(-t / 0.085) * (t < 0.006 ? t / 0.006 : 1);
      }
      var er = ch ? [0.0071, 0.0133, 0.0217, 0.0311] : [0.0059, 0.0117, 0.0193, 0.0279];
      for (var j = 0; j < er.length; j++) d[Math.floor(er[j] * sr)] += (0.45 - j * 0.09) * (j % 2 ? -1 : 1);
    }
    return b;
  }
  function noiseBuffers(ctx) {                    // 3 s white + 4 s brown (seamless loop), made once per context
    var sr = ctx.sampleRate, r = mulberry(3), i;
    var wl = Math.floor(sr * 3), w = ctx.createBuffer(1, wl, sr), wd = w.getChannelData(0);
    for (i = 0; i < wl; i++) wd[i] = r() * 2 - 1;
    var bl = Math.floor(sr * 4), b = ctx.createBuffer(1, bl, sr), bd = b.getChannelData(0), x = 0, pk = 0;
    for (i = 0; i < bl; i++) { x = (x + 0.02 * (r() * 2 - 1)) / 1.02; bd[i] = x; }
    var drift = bd[bl - 1] - bd[0];
    for (i = 0; i < bl; i++) { bd[i] -= drift * i / (bl - 1); if (Math.abs(bd[i]) > pk) pk = Math.abs(bd[i]); }
    for (i = 0; i < bl; i++) bd[i] /= pk;
    return { white: w, brown: b };
  }
  function build(ctx, v) {
    var g = { ctx: ctx }, nb = noiseBuffers(ctx);
    g.white = nb.white; g.brown = nb.brown;
    g.vol = gainN(ctx, taper(v));
    g.gate = gainN(ctx, 0);
    g.comp = ctx.createDynamicsCompressor();
    g.comp.threshold.value = -16; g.comp.knee.value = 10; g.comp.ratio.value = 2.5;
    g.comp.attack.value = 0.004; g.comp.release.value = 0.22;
    g.trim = gainN(ctx, LV.trim);
    g.ceil = ctx.createWaveShaper(); g.ceil.curve = ceiling(); g.ceil.oversample = 'none';
    chain(g.vol, g.gate, g.comp, g.trim, g.ceil, ctx.destination);
    g.fg = gainN(ctx, 1); g.fg.connect(g.vol);                      // knock, ring, tick
    g.duck = gainN(ctx, 1); g.duck.connect(g.vol);                  // ambience dips under knock / ring
    g.amb = gainN(ctx, 1); g.amb.connect(g.duck);                   // hail, bed, thunder, score
    g.room = ctx.createConvolver(); g.room.buffer = roomIR(ctx);
    g.roomRet = gainN(ctx, LV.roomRet); chain(g.room, g.roomRet, g.vol);
    return g;
  }

  // ---------------------------------------------------------------- knock: contact click + body (178 -> 132 Hz) + panel modes
  function oneKnock(g, t, a, k, dest) {
    var ctx = g.ctx;
    var c = noise(g, g.white, t, 0.04), ce = gainN(ctx, 0);
    chain(c, filt(ctx, 'highpass', 700, 0.7), filt(ctx, 'bandpass', 2100 * k, 0.8), ce, dest);
    env(ce.gain, t, a * 0.32, 0.0012, 0.005);
    var b = osc(ctx, 'sine', 178 * k), be = gainN(ctx, 0);
    b.frequency.setValueAtTime(178 * k, t); b.frequency.exponentialRampToValueAtTime(132 * k, t + 0.05);
    chain(b, be, dest); env(be.gain, t, a * 0.62, 0.003, 0.048);
    b.start(t); b.stop(t + 0.45);
    var m = noise(g, g.white, t, 0.03), me = gainN(ctx, 0);
    m.connect(me); env(me.gain, t, a * 3.2, 0.001, 0.004);
    var modes = [[236, 11, 1.0], [412, 13, 0.6], [790, 9, 0.3]];
    for (var i = 0; i < modes.length; i++) chain(me, filt(ctx, 'bandpass', modes[i][0] * k, modes[i][1]), gainN(ctx, modes[i][2]), dest);
  }
  function knockAt(g, t, o) {
    var n = clamp(Math.round(num(o.count, 2)), 1, 4), gap = clamp(num(o.gap, 0.19), 0.08, 0.6);
    var a = clamp(num(o.gain, 1), 0, 1.5) * LV.knock;
    var dest = gainN(g.ctx, 1), send = gainN(g.ctx, LV.knockRoom);
    dest.connect(panTo(g, o.pan, g.fg)); chain(dest, send, g.room);
    for (var i = 0, tt = t; i < n; i++) {
      oneKnock(g, tt, a * (i === 0 ? 1 : i === n - 1 ? 0.8 : 0.9), 1 + (rand() - 0.5) * 0.05, dest);
      tt += gap * (1 + (rand() - 0.5) * 0.08);
    }
    duck(g, t, 0.55, n * gap + 0.1);
  }

  // ---------------------------------------------------------------- hail: one stone (click + ping); glass rings, shingles thud
  function hailAt(g, t, x, o, dest) {
    var ctx = g.ctx, glass = o.surface ? o.surface === 'glass' : rand() < 0.4;
    var a = clamp(num(o.gain, 1), 0, 1.5) * LV.hail * (0.35 + 0.65 * x) * (glass ? 1 : 2.2);
    var c = noise(g, g.white, t, 0.03), ce = gainN(ctx, 0);
    var f = glass ? filt(ctx, 'highpass', 3200 + rand() * 2000, 0.7) : filt(ctx, 'bandpass', (1400 + rand() * 1600) * (1 - 0.3 * x), 1.4);
    chain(c, f, ce, dest); env(ce.gain, t, a, 0.0005, glass ? 0.0025 : 0.004 + 0.004 * x);
    var p = osc(ctx, 'sine', glass ? (3600 + rand() * 3000) * (1 - 0.2 * x) : 700 + rand() * 900 - 250 * x), pe = gainN(ctx, 0);
    chain(p, pe, dest); env(pe.gain, t, a * (glass ? 0.45 : 0.3), 0.0008, glass ? 0.014 + rand() * 0.012 : 0.006 + 0.008 * x);
    p.start(t); p.stop(t + 0.2);
  }

  // ---------------------------------------------------------------- hail bed: Poisson ticks, look-ahead scheduled, gliding level
  function newBed() { return { segs: [], target: 0, next: 0, timer: 0, bus: null, pans: null, wash: null, washG: null }; }
  function bedLevel(b, t) {
    for (var i = b.segs.length - 1; i >= 0; i--) {
      var s = b.segs[i];
      if (s.t <= t) return s.to + (s.from - s.to) * Math.exp(-(t - s.t) / GLIDE);
    }
    return 0;
  }
  function bedSet(g, b, t, lvl) {
    var ctx = g.ctx;
    if (!b.bus) {
      b.bus = gainN(ctx, LV.bed); b.bus.connect(g.amb); chain(b.bus, gainN(ctx, LV.bedRoom), g.room);
      b.pans = []; for (var i = 0; i < 5; i++) b.pans.push(panTo(g, (i - 2) * 0.4, b.bus));
      b.wash = ctx.createBufferSource(); b.wash.buffer = g.white; b.wash.loop = true; b.wash.playbackRate.value = 0.97;
      b.washG = gainN(ctx, 0);
      chain(b.wash, filt(ctx, 'highpass', 1800, 0.6), filt(ctx, 'lowpass', 7500, 0.5), b.washG, b.bus);
      b.wash.start(t, rand() * 2); b.next = t;
    }
    while (b.segs.length && b.segs[b.segs.length - 1].t > t) b.segs.pop();
    b.segs.push({ t: t, from: bedLevel(b, t), to: lvl });
    b.target = lvl;
    b.washG.gain.setTargetAtTime(LV.wash * Math.pow(lvl, 1.2), t, GLIDE);
  }
  function bedFill(g, b, until) {
    while (b.next < until) {
      while (b.segs.length > 1 && b.segs[1].t <= b.next) b.segs.shift();
      var t = b.next, L = bedLevel(b, t), rate = BED_RMAX * Math.pow(L, 1.4), base = rate > BED_BASE ? rate : BED_BASE;
      if (L > 0.003 && rand() * base < rate) {
        var big = rand() < 0.05 * L, x = big ? 0.7 + 0.3 * rand() : 0.1 + 0.45 * L * rand();
        hailAt(g, t, x, { gain: 0.35 + 0.65 * rand() }, b.pans[(rand() * 5) | 0]);
      }
      b.next = t - Math.log(1 - rand()) / base;
    }
  }
  function bedDone(b, t) { var s = b.segs[b.segs.length - 1]; return !s || (s.to === 0 && t - s.t > GLIDE * 7); }
  function bedEnd(b, t) {
    try { b.wash.stop(t + 0.05); } catch (e) { /* already stopped */ }
    var bus = b.bus; setTimeout(function () { try { bus.disconnect(); } catch (e) { /* gone */ } }, 600);
  }
  function pump() {                               // the live look-ahead scheduler (setTimeout wakes, AudioContext clock times)
    var b = live.bed;
    if (!b || b.timer || !audible()) return;
    (function loop() {
      b.timer = 0;
      if (live.bed !== b || !audible()) return;
      try {
        var t = G.ctx.currentTime;
        if (b.next < t) b.next = t + 0.005;
        bedFill(G, b, t + LOOK);
        if (bedDone(b, t)) { bedEnd(b, t); live.bed = null; emit(); return; }
      } catch (e) { warn('hailBed', e); return; }
      b.timer = setTimeout(loop, STEP_MS);
    })();
  }

  // ---------------------------------------------------------------- thunder: brown noise, two lowpasses, slow rolling envelope
  function thunderAt(g, t, d, o) {
    var ctx = g.ctx, a = clamp(num(o.gain, 1), 0, 1.5) * LV.thunder * (1 - 0.5 * d);
    var fc = 380 - 260 * d, att = 0.12 + 0.8 * d;
    var s = ctx.createBufferSource(); s.buffer = g.brown; s.loop = true; s.playbackRate.value = 0.85 + 0.3 * rand();
    var lp = filt(ctx, 'lowpass', fc, 0.6), e = gainN(ctx, 0);
    lp.frequency.setValueAtTime(fc * 1.4, t); lp.frequency.setTargetAtTime(fc * 0.7, t + 0.3, 1.6);
    chain(s, filt(ctx, 'highpass', 34, 0.7), lp, filt(ctx, 'lowpass', fc * 1.2, 0.5), e, panTo(g, (rand() - 0.5) * 0.6, g.amb));
    var p = e.gain, tt = t + att, n = 2 + ((rand() * 3) | 0);
    p.setValueAtTime(0, t); p.linearRampToValueAtTime(a * 0.8, tt);
    for (var i = 0; i < n; i++) { tt += 0.35 + rand() * 0.8; p.setTargetAtTime(a * (0.45 + 0.55 * rand()), tt, 0.18 + 0.2 * rand()); }
    var tau = 0.5 + 0.6 * d;
    p.setTargetAtTime(0, tt + 0.4, tau);
    s.start(t, rand() * 3); s.stop(tt + 0.4 + tau * 8);
    if (d < 0.3) {                                // near: a soft crack on top
      var c = noise(g, g.white, t, 0.5), ce = gainN(ctx, 0);
      chain(c, filt(ctx, 'bandpass', 1100, 0.7), ce, g.amb); env(ce.gain, t, a * 0.5 * (1 - d / 0.3), 0.004, 0.11);
    }
  }

  // ---------------------------------------------------------------- ring: soft bell (sine + slow-beating twin + faint partials)
  function ringAt(g, t, deg, o) {
    var ctx = g.ctx; deg = Math.round(num(deg, 0));
    var oct = Math.floor(deg / 5), f = D5 * Math.pow(2, oct + PENTA[((deg % 5) + 5) % 5] / 12);
    var log = g.rings || (g.rings = []), n = 0, i;
    for (i = 0; i < log.length; i++) if (t - log[i] < 0.6 && t >= log[i]) n++;
    log.push(t); if (log.length > 8) log.shift();
    var a = clamp(num(o.gain, 1), 0, 1.5) * LV.ring * Math.pow(D5 / f, 0.35) / Math.sqrt(1 + 0.5 * n);   // a run of rings stays level
    var tl = clamp(num(o.tail, 1), 0.2, 3);
    var sum = gainN(ctx, 1);
    sum.connect(panTo(g, o.pan == null ? clamp((deg - 4) * 0.05, -0.3, 0.3) : o.pan, g.fg)); chain(sum, gainN(ctx, LV.ringRoom), g.room);
    var P = [[1, 0, 1, 0.9 * tl, 0.005], [1, 0.9, 0.35, 0.75 * tl, 0.005], [2, 0, 0.16, 0.32 * tl, 0.003], [3, 0, 0.05, 0.16 * tl, 0.002], [5.4, 0, 0.018, 0.06, 0.002]];
    for (i = 0; i < P.length; i++) {
      var q = P[i], fr = f * q[0] + q[1];
      if (fr > 16000) continue;
      var s = osc(ctx, 'sine', fr), e = gainN(ctx, 0);
      chain(s, e, sum); env(e.gain, t, a * q[2], q[4], q[3]);
      s.start(t); s.stop(t + q[4] + q[3] * 8);
    }
    duck(g, t, 0.8, 0.3);
  }

  // ---------------------------------------------------------------- tick
  function tickAt(g, t, o) {
    var ctx = g.ctx, s = noise(g, g.white, t, 0.02), e = gainN(ctx, 0);
    chain(s, filt(ctx, 'bandpass', 3400, 1.1), e, g.fg); env(e.gain, t, clamp(num(o.gain, 1), 0, 1.5) * LV.tick, 0.0004, 0.0022);
  }

  // ---------------------------------------------------------------- score: D3 + A3 saws, F#4 triangle, moving lowpass, air
  function scoreStart(g, t) {
    var ctx = g.ctx, sc = { src: [], bus: gainN(ctx, 0) };
    sc.bus.connect(g.amb);
    var lp = filt(ctx, 'lowpass', 520, 0.7), lfo = osc(ctx, 'sine', 0.043), lg = gainN(ctx, 230);
    lp.connect(sc.bus); chain(lfo, lg, lp.frequency); sc.src.push(lfo);
    var V = [[146.832, -7, 'sawtooth', 0.3, -0.35], [220.0, 6, 'sawtooth', 0.22, 0.35], [369.994, 3, 'triangle', 0.26, 0.05]];
    for (var i = 0; i < V.length; i++) {
      var o = osc(ctx, V[i][2], V[i][0]), vg = gainN(ctx, V[i][3]);
      o.detune.value = V[i][1] + (rand() - 0.5) * 2;
      chain(o, vg, panTo(g, V[i][4], lp)); sc.src.push(o);
      if (i === 2) { var br = osc(ctx, 'sine', 0.071), bg = gainN(ctx, 0.08); chain(br, bg, vg.gain); sc.src.push(br); }
    }
    var air = ctx.createBufferSource(); air.buffer = g.white; air.loop = true; air.playbackRate.value = 0.91;
    var ag = gainN(ctx, LV.air), al = osc(ctx, 'sine', 0.029), alg = gainN(ctx, LV.air * 0.5);
    chain(air, filt(ctx, 'bandpass', 6500, 0.55), ag, sc.bus); chain(al, alg, ag.gain); sc.src.push(al);
    for (i = 0; i < sc.src.length; i++) sc.src[i].start(t);
    air.start(t, rand() * 2); sc.src.push(air);
    var p = sc.bus.gain; p.setValueAtTime(0, t); p.linearRampToValueAtTime(LV.score, t + 2);
    return sc;
  }
  function scoreStop(g, sc, t, fast) {
    var d = fast ? 0.25 : 2, p = sc.bus.gain;
    hold(p, t); p.linearRampToValueAtTime(0, t + d);
    for (var i = 0; i < sc.src.length; i++) sc.src[i].stop(t + d + 0.05);
  }

  // ---------------------------------------------------------------- live state
  function sync() {                               // make the declarative parts (score, bed) match want + permissions
    if (!G) return;
    var ok = on() && !reduced(), t = G.ctx.currentTime + 0.01;
    var bl = ok ? want.bed : 0;
    if (live.bed ? live.bed.target !== bl : bl > 0) {
      if (!live.bed) live.bed = newBed();
      bedSet(G, live.bed, t, bl);
    }
    if (live.bed) pump();
    var so = ok && want.score;
    if (so && !live.score) live.score = scoreStart(G, t);
    else if (!so && live.score) { scoreStop(G, live.score, t, !enabled); live.score = null; }
  }
  function state() {
    return {
      supported: !!AC, enabled: enabled, reduced: reduced(), volume: vol,
      context: G ? G.ctx.state : 'none', bed: want.bed, score: want.score
    };
  }
  function emit() {
    try { root.dispatchEvent(new CustomEvent('sound:change', { detail: state() })); } catch (e) { /* old browser */ }
  }
  function arm() {                                // iOS "interrupted" / autoplay suspend: resume on the next gesture
    if (armed || !root.document) return; armed = true;
    var evs = ['pointerdown', 'keydown', 'touchend'];
    function go() {
      armed = false;
      for (var i = 0; i < evs.length; i++) root.document.removeEventListener(evs[i], go, true);
      if (enabled && G && !hidden()) quiet(G.ctx.resume());
    }
    for (var i = 0; i < evs.length; i++) root.document.addEventListener(evs[i], go, true);
  }
  function unlock(ctx) {                          // a 1-sample silent buffer inside the gesture (old iOS needs it)
    var s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); s.connect(ctx.destination); s.start(0);
  }
  function makeContext() {
    try { return new AC({ latencyHint: 'interactive' }); } catch (e) { return new AC(); }
  }
  function watch() {
    G.ctx.onstatechange = function () {
      try { if (enabled && !hidden() && G.ctx.state !== 'running' && G.ctx.state !== 'closed') arm(); emit(); } catch (e) { warn('statechange', e); }
    };
  }

  if (root.document) {
    root.document.addEventListener('visibilitychange', safe('visibility', function () {
      if (!G) return;
      if (hidden()) { if (G.ctx.state === 'running') quiet(G.ctx.suspend()); if (live.bed && live.bed.timer) { clearTimeout(live.bed.timer); live.bed.timer = 0; } }
      else if (enabled) { var p = G.ctx.resume(); if (p && p.then) p.then(function () { pump(); }, function () { arm(); }); else pump(); }
    }));
  }
  try {
    if (root.matchMedia) {
      var mq = root.matchMedia('(prefers-reduced-motion: reduce)');
      osReduced = !!mq.matches;
      var onMq = safe('reduced', function (e) { osReduced = !!e.matches; sync(); emit(); });
      if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
    }
  } catch (e) { /* no matchMedia */ }

  // ---------------------------------------------------------------- offline analysis (BS.1770 K-weighting)
  function biquad(sr, type, fc, q, gainDb) {
    var w = 2 * Math.PI * fc / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * q), b, a;
    if (type === 'shelf') {
      var A = Math.pow(10, gainDb / 40), sq = 2 * Math.sqrt(A) * al;
      b = [A * ((A + 1) + (A - 1) * cs + sq), -2 * A * ((A - 1) + (A + 1) * cs), A * ((A + 1) + (A - 1) * cs - sq)];
      a = [(A + 1) - (A - 1) * cs + sq, 2 * ((A - 1) - (A + 1) * cs), (A + 1) - (A - 1) * cs - sq];
    } else {
      b = [(1 + cs) / 2, -(1 + cs), (1 + cs) / 2]; a = [1 + al, -2 * cs, 1 - al];
    }
    return [b[0] / a[0], b[1] / a[0], b[2] / a[0], a[1] / a[0], a[2] / a[0]];
  }
  function run(c, x) {
    var y = new Float32Array(x.length), x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (var i = 0; i < x.length; i++) {
      var v = c[0] * x[i] + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  }
  function analyze(buf, o) {
    o = o || {};
    var sr = buf.sampleRate, n = buf.length, from = Math.floor(num(o.from, 0) * sr), chs = [], c, i;
    for (c = 0; c < buf.numberOfChannels; c++) chs.push(buf.getChannelData(c));
    var peak = 0, clips = 0, first = -1, last = -1, lim = Math.pow(10, -1 / 20), floor = Math.pow(10, -60 / 20);
    for (i = from; i < n; i++) for (c = 0; c < chs.length; c++) {
      var v = Math.abs(chs[c][i]);
      if (v > peak) peak = v;
      if (v >= lim) clips++;
      if (v > floor) { if (first < 0) first = i; last = i; }
    }
    var ss = 0, cnt = 0;
    if (first >= 0) for (i = first; i <= last; i++) for (c = 0; c < chs.length; c++) { ss += chs[c][i] * chs[c][i]; cnt++; }
    var hs = biquad(sr, 'shelf', 1681.974450955533, 0.7071752369554196, 3.999843853973347);
    var hp = biquad(sr, 'hp', 38.13547087602444, 0.5003270373238773);
    var kw = chs.map(function (x) { var y = run(hp, run(hs, x)); for (var j = 0; j < y.length; j++) y[j] *= y[j]; return y; });
    var win = Math.floor(0.4 * sr), hop = Math.floor(0.1 * sr), best = -Infinity;
    for (var s0 = from; s0 + win <= n || s0 === from; s0 += hop) {
      var e = s0 + win > n ? n : s0 + win, z = 0;
      for (c = 0; c < kw.length; c++) { var acc = 0; for (i = s0; i < e; i++) acc += kw[c][i]; z += acc / win; }
      var L = z > 0 ? -0.691 + 10 * Math.log10(z) : -Infinity;
      if (L > best) best = L;
      if (e >= n) break;
    }
    function db(x) { return x > 0 ? 20 * Math.log10(x) : -Infinity; }
    return {
      peak: peak, peakDb: db(peak), rmsDb: cnt ? db(Math.sqrt(ss / cnt)) : -Infinity, lufs: best,
      dur: last < 0 ? 0 : (last + 1) / sr, onset: first < 0 ? 0 : first / sr, clips: clips
    };
  }

  // ---------------------------------------------------------------- offline render (same synths, seeded)
  function render(what, seconds, o) {
    o = o || {};
    try {
      if (!OAC) return Promise.reject(new Error('OfflineAudioContext unavailable'));
      var sr = o.sampleRate || 48000, dur = clamp(num(seconds, 3), 0.05, 60);
      var ctx = new OAC(2, Math.ceil(dur * sr), sr), saved = rand;
      rand = mulberry(o.seed == null ? 7 : o.seed);
      try {
        var g = build(ctx, o.volume == null ? vol : clamp(o.volume, 0, 1)), st = { bed: null, score: null, motif: 0 };
        g.gate.gain.value = 1;
        var at = function (op) { return Math.max(0, num(op.at, num(op.delay, 0))); };
        var api = {
          knock: function (op) { op = op || {}; knockAt(g, at(op), op); },
          hail: function (x, op) { op = op || {}; hailAt(g, at(op), clamp(num(x, 0.6), 0, 1), op, panTo(g, op.pan, g.amb)); },
          thunder: function (d, op) { op = op || {}; thunderAt(g, at(op), clamp(num(d, 0.7), 0, 1), op); },
          ring: function (deg, op) { op = op || {}; if (deg == null) deg = MOTIF[st.motif++ % MOTIF.length]; ringAt(g, at(op), deg, op); },
          tick: function (op) { op = op || {}; tickAt(g, at(op), op); },
          hailBed: function (lvl, t) { if (!st.bed) st.bed = newBed(); bedSet(g, st.bed, Math.max(0, num(t, 0)), clamp(num(lvl, 0), 0, 1)); },
          score: function (on, t) {
            t = Math.max(0, num(t, 0));
            if (on && !st.score) st.score = scoreStart(g, t);
            else if (!on && st.score) { scoreStop(g, st.score, t, false); st.score = null; }
          }
        };
        if (typeof what === 'function') what(api); else api[what].apply(null, o.args || []);
        if (st.bed) { st.bed.next = st.bed.segs.length ? st.bed.segs[0].t : 0; bedFill(g, st.bed, dur); }
      } finally { rand = saved; }
      var r = ctx.startRendering();
      if (r && r.then) return r;
      return new Promise(function (res) { ctx.oncomplete = function (e) { res(e.renderedBuffer); }; });
    } catch (e) { return Promise.reject(e); }
  }

  // ---------------------------------------------------------------- public API
  var Sound = {
    enable: safe('enable', function () {
      if (!AC) return false;
      if (!G) { G = build(makeContext(), vol); watch(); }
      var ctx = G.ctx, t = ctx.currentTime;
      clearTimeout(suspendTimer);
      enabled = true;
      if (ctx.state !== 'running' && !hidden()) {
        var p = ctx.resume();
        if (p && p.then) p.then(function () { pump(); }, function (e) { warn('resume', e); arm(); });
      }
      unlock(ctx);
      hold(G.gate.gain, t); G.gate.gain.setTargetAtTime(1, t, 0.03);
      sync(); emit();
      return true;
    }, false),
    disable: safe('disable', function () {
      enabled = false;
      if (G) {
        var t = G.ctx.currentTime;
        hold(G.gate.gain, t); G.gate.gain.setTargetAtTime(0, t, 0.04);
        sync();
        clearTimeout(suspendTimer);
        suspendTimer = setTimeout(function () { if (!enabled && G && G.ctx.state === 'running') quiet(G.ctx.suspend()); }, 350);
      }
      emit();
      return true;
    }, false),
    toggle: function () { return enabled ? (Sound.disable(), false) : Sound.enable(); },
    stop: safe('stop', function () {
      want.score = false; want.bed = 0;
      if (G && live.score) { scoreStop(G, live.score, G.ctx.currentTime + 0.01, true); live.score = null; }
      sync(); emit();
    }),
    volume: safe('volume', function (v) {
      if (v == null) return vol;
      vol = clamp(v, 0, 1);
      try { root.localStorage.setItem(VOL_KEY, String(vol)); } catch (e) { /* storage blocked */ }
      if (G) G.vol.gain.setTargetAtTime(taper(vol), G.ctx.currentTime, 0.03);
      emit();
      return vol;
    }, 0),
    setReduced: safe('setReduced', function (v) { forced = v == null ? null : !!v; sync(); emit(); return reduced(); }, false),

    knock: safe('knock', function (o) {
      o = o || {}; if (!audible()) return false;
      knockAt(G, G.ctx.currentTime + 0.006 + Math.max(0, num(o.delay, 0)), o); return true;
    }, false),
    hail: safe('hail', function (x, o) {
      o = o || {}; if (!audible() || reduced()) return false;
      hailAt(G, G.ctx.currentTime + 0.006 + Math.max(0, num(o.delay, 0)), clamp(num(x, 0.6), 0, 1), o,
        panTo(G, o.pan == null ? (rand() - 0.5) * 1.2 : o.pan, G.amb));
      return true;
    }, false),
    hailBed: safe('hailBed', function (level) { want.bed = clamp(num(level, 0), 0, 1); sync(); return want.bed; }, 0),
    thunder: safe('thunder', function (d, o) {
      o = o || {}; if (!audible() || reduced()) return false;
      var t = G.ctx.currentTime + 0.006 + Math.max(0, num(o.delay, 0));
      if (t - live.thunder < 6) return false;
      live.thunder = t; thunderAt(G, t, clamp(num(d, 0.7), 0, 1), o); return true;
    }, false),
    ring: safe('ring', function (deg, o) {
      o = o || {}; if (!audible() || reduced()) return false;
      if (deg == null) deg = MOTIF[live.motif++ % MOTIF.length];
      ringAt(G, G.ctx.currentTime + 0.006 + Math.max(0, num(o.delay, 0)), deg, o); return true;
    }, false),
    tick: safe('tick', function (o) {
      o = o || {}; if (!audible() || reduced()) return false;
      var t = G.ctx.currentTime + 0.006;
      if (t - live.tick < 0.035) return false;
      live.tick = t; tickAt(G, t, o); return true;
    }, false),
    score: safe('score', function (onOff) { want.score = !!onOff; sync(); emit(); return want.score; }, false),

    level: safe('level', function () {
      if (!audible()) return 0;
      if (!G.meter) { G.meter = G.ctx.createAnalyser(); G.meter.fftSize = 1024; G.ceil.connect(G.meter); meterBuf = new Float32Array(1024); }
      G.meter.getFloatTimeDomainData(meterBuf);
      for (var i = 0, s = 0; i < meterBuf.length; i++) s += meterBuf[i] * meterBuf[i];
      return Math.sqrt(s / meterBuf.length);
    }, 0),
    state: state,
    render: render,
    analyze: analyze,
    scale: function (deg) { deg = Math.round(num(deg, 0)); return D5 * Math.pow(2, Math.floor(deg / 5) + PENTA[((deg % 5) + 5) % 5] / 12); }
  };
  Object.defineProperty(Sound, 'enabled', { get: function () { return enabled; }, enumerable: true });
  Object.defineProperty(Sound, 'supported', { get: function () { return !!AC; }, enumerable: true });
  Object.defineProperty(Sound, 'reduced', { get: function () { return reduced(); }, enumerable: true });

  root.Sound = Sound;
})(typeof window !== 'undefined' ? window : this);
