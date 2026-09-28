/* Aldaba desktop A · FUTURE layer (pairs with future.css). No libraries: raw WebGL1, ~4 KB.
   1. Ambient field: a slow domain-warped noise field (graphite silk, knocker-orange light at the screen's focus,
      a cool counter-light) drawn at 1/4 resolution behind the glass.
   2. The light follows you: the field's warm light leans toward the pointer and moves to each screen's focus
      (map on Now, door card on Knock, next step on Job); glass rims brighten under the pointer.
   3. Panels settle in on a spring (CSS); hero numbers count up once per visit.
   24h safety (the tool stays open all day on a MacBook Air):
   - frame cap 24 fps while you're active, 12 fps after 60 s without input, fully stopped after 3 min idle
     (the last frame stays on screen); any key/pointer/wheel wakes it. Stopped while the tab is hidden.
   - time never grows: motion is a seamless 4-minute loop driven by one wrapped phase angle, so float precision
     is identical at hour 1 and hour 24. dt is clamped, so waking up never jumps.
   - no per-frame allocation: one program, one 3-vertex buffer, uniforms set from plain numbers, one bound
     frame function. Canvas backing store capped at 480x300 px whatever the display.
   - WebGL context lost -> stop, hide the canvas, the CSS gradient in future.css shows (static). Restored -> rebuild once.
   - prefers-reduced-motion: one still frame (redrawn on resize/theme/screen change), never a loop. No WebGL at all:
     the CSS gradient. */
(function () {
  'use strict';
  const root = document.documentElement;
  if (root.dataset.look !== 'future') return;

  const RM = window.matchMedia('(prefers-reduced-motion: reduce)');
  const FOCUS = {now: [0.40, 0.60], knock: [0.84, 0.42], job: [0.42, 0.46]};  // x,y in 0..1 of the viewport, y down
  const PERIOD = 240;          // seconds per seamless loop of the field
  const SCALE = 0.25, MAXW = 480, MAXH = 300;
  const IDLE_SLOW = 60e3, IDLE_STOP = 180e3;

  /* ---------------- ambient field ---------------- */
  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;uniform float uA;uniform vec2 uFocus;uniform vec2 uMouse;uniform float uTheme;uniform float uEnergy;
float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1.,0.)),u.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 r=mat2(.8,-.6,.6,.8);for(int i=0;i<4;i++){v+=a*n(p);p=r*p*2.03+17.1;a*=.5;}return v;}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  float asp=uRes.x/uRes.y;
  vec2 p=(uv-.5)*vec2(asp,1.);
  vec2 o1=vec2(cos(uA),sin(uA))*1.15;                 /* integer harmonics of one angle = a seamless loop */
  vec2 o2=vec2(cos(2.*uA+1.3),sin(2.*uA+1.3))*.5;
  vec2 w=p+.55*vec2(fbm(p*.95+o1)-.5,fbm(p*.95-o1+3.1)-.5);
  float a1=w.x*5.2+w.y*6.8+1.6*fbm(w*1.25+o2)+uA;       /* two layers of silk folds drifting across the room */
  float a2=w.y*3.9-w.x*2.6+1.2*fbm(w*1.1-o2+7.)-uA;
  float s1=cos(a1),s2=cos(a2);
  float hi=.8*pow(max(s1,0.),4.)+.45*pow(max(s2,0.),3.); /* lit flank of each fold */
  float lo=.6*pow(max(-s1,0.),2.)+.4*pow(max(-s2,0.),2.);/* shaded flank */
  float fil=pow(max(s1,0.),60.)+.5*pow(max(s2,0.),60.);  /* fine filament on the crest */
  vec2 f=(vec2(uFocus.x,1.-uFocus.y)-.5)*vec2(asp,1.)+uMouse*vec2(.14,-.12);
  float d=length((p-f)*vec2(.8,1.05));
  float ember=exp(-d*d*1.9);
  vec2 c=vec2(-f.x*.7+.35,.7);
  float cool=exp(-dot(p-c,p-c)*1.1);
  vec3 col=vec3(.022,.024,.029);
  col+=vec3(.05,.054,.064)*hi-vec3(.01)*lo;
  col+=vec3(.96,.48,.18)*ember*(.035+.13*hi+.2*fil)*uEnergy;
  col+=vec3(.32,.43,.64)*cool*(.02+.07*hi+.1*fil);
  col*=1.-.9*dot(uv-.5,uv-.5);
  vec3 lc=vec3(.918,.928,.943);
  lc+=vec3(.05)*hi-vec3(.018)*lo;
  lc+=vec3(.08,.015,-.06)*ember*(.3+.6*hi+.4*fil)*uEnergy;
  lc+=vec3(-.05,-.015,.04)*cool*(.35+.6*hi+.3*fil);
  lc-=vec3(.035)*dot(uv-.5,uv-.5);
  gl_FragColor=vec4(mix(col,lc,uTheme),1.);
}`;

  const cv = document.createElement('canvas');
  cv.id = 'fx-field';
  cv.setAttribute('aria-hidden', 'true');
  let gl = null, prog = null, buf = null, U = null, alive = false;
  let raf = 0, timer = 0, last = 0, phase = 0;
  const TAU = Math.PI * 2;
  let lastInput = performance.now(), hidden = document.hidden;
  // smoothed state (numbers only, no objects per frame)
  let fx = 0.40, fy = 0.60, tfx = 0.40, tfy = 0.60;
  let mx = 0, my = 0, tmx = 0, tmy = 0;
  let th = root.dataset.theme === 'light' ? 1 : 0, tth = th;
  let en = 0.85, ten = 0.85;

  function build() {
    gl = cv.getContext('webgl', {alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false,
      preserveDrawingBuffer: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: false});
    if (!gl) return false;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const v = sh(gl.VERTEX_SHADER, VS), f = sh(gl.FRAGMENT_SHADER, FS);
    if (!v || !f) return false;
    prog = gl.createProgram(); gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);
    buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);   // one triangle covers the screen
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    U = {};
    ['uRes', 'uA', 'uFocus', 'uMouse', 'uTheme', 'uEnergy'].forEach(k => { U[k] = gl.getUniformLocation(prog, k); });
    return true;
  }
  function size() {
    if (!gl) return;
    const w = Math.max(64, Math.min(MAXW, Math.round(innerWidth * SCALE)));
    const hh = Math.max(40, Math.min(MAXH, Math.round(innerHeight * SCALE)));
    if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; gl.viewport(0, 0, w, hh); }
  }
  function draw() {
    gl.uniform2f(U.uRes, cv.width, cv.height);
    gl.uniform1f(U.uA, phase);
    gl.uniform2f(U.uFocus, fx, fy);
    gl.uniform2f(U.uMouse, mx, my);
    gl.uniform1f(U.uTheme, th);
    gl.uniform1f(U.uEnergy, en);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function settle() { fx = tfx; fy = tfy; mx = tmx; my = tmy; th = tth; en = ten; }
  // The loop wakes the main thread only ~24x/s (a timer, then one rAF to draw in sync), never 60/120x.
  function tick() { timer = 0; raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    if (!alive || hidden) return;
    const idle = now - lastInput;
    if (idle > IDLE_STOP) return;                                  // asleep: the last frame stays on screen
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    phase = (phase + dt * TAU / PERIOD) % TAU;
    const k = 1 - Math.exp(-dt * 2.6);                             // smooth follow, no overshoot
    fx += (tfx - fx) * k; fy += (tfy - fy) * k;
    mx += (tmx - mx) * k * 0.6; my += (tmy - my) * k * 0.6;
    th += (tth - th) * Math.min(1, k * 2.2); en += (ten - en) * k;
    draw();
    timer = setTimeout(tick, idle > IDLE_SLOW ? 1000 / 12 : 1000 / 24);
  }
  function halt() { clearTimeout(timer); timer = 0; cancelAnimationFrame(raf); raf = 0; }
  function wake() {
    lastInput = performance.now();
    if (alive && !hidden && !RM.matches && !raf && !timer) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function still() { if (alive) { settle(); size(); draw(); } }
  function kick() { if (RM.matches) still(); else wake(); }

  function start() {
    if (!build()) { cv.remove(); return; }
    alive = true; size();
    cv.addEventListener('webglcontextlost', e => {
      e.preventDefault(); alive = false; halt(); cv.classList.remove('on');   // CSS gradient shows
    });
    cv.addEventListener('webglcontextrestored', () => {
      if (build()) { alive = true; size(); settle(); draw(); cv.classList.add('on'); kick(); }
    });
    settle(); draw();
    requestAnimationFrame(() => cv.classList.add('on'));
    kick();
  }

  /* ---------------- inputs ---------------- */
  function setView() {
    const v = document.body.dataset.view || 'now', t = FOCUS[v] || FOCUS.now;
    tfx = t[0]; tfy = t[1]; kick();
    stagger();
  }
  let pmx = 0, pmy = 0, pend = 0, litCard = null, pe = null;
  function onMove(e) { pe = e; if (!pend) pend = requestAnimationFrame(applyMove); }
  function applyMove() {
    pend = 0; const e = pe; if (!e) return;
    pmx = e.clientX / innerWidth - 0.5; pmy = e.clientY / innerHeight - 0.5;
    tmx = pmx; tmy = pmy; ten = 1;
    const card = e.target && e.target.closest ? e.target.closest('.card, .zcard') : null;
    if (card !== litCard) { if (litCard) litCard.classList.remove('fx-lit'); litCard = card; if (card) card.classList.add('fx-lit'); }
    if (card) { const r = card.getBoundingClientRect(); card.style.setProperty('--mx', (e.clientX - r.left) + 'px'); card.style.setProperty('--my', (e.clientY - r.top) + 'px'); }
    wake();
  }
  document.addEventListener('pointermove', onMove, {passive: true});
  document.addEventListener('pointerleave', () => { ten = 0.85; tmx = 0; tmy = 0; if (litCard) { litCard.classList.remove('fx-lit'); litCard = null; } });
  ['pointerdown', 'keydown', 'wheel', 'focusin'].forEach(t => document.addEventListener(t, wake, {passive: true}));
  document.addEventListener('visibilitychange', () => {
    hidden = document.hidden;
    if (hidden) halt(); else kick();
  });
  RM.addEventListener && RM.addEventListener('change', () => { halt(); kick(); });
  let rz = 0;
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { size(); if (RM.matches || (!raf && !timer)) still(); }, 120); });
  new MutationObserver(() => { tth = root.dataset.theme === 'light' ? 1 : 0; if (RM.matches) still(); else wake(); })
    .observe(root, {attributes: true, attributeFilter: ['data-theme']});

  /* ---------------- panels: spring stagger index, one-time count-up ---------------- */
  function stagger() {
    document.querySelectorAll('[data-screen]').forEach(s => s.querySelectorAll(':scope > .card, :scope .card').forEach((c, i) => c.style.setProperty('--i', i)));
  }
  let counted = false;
  function countUp() {
    if (counted || RM.matches) return; counted = true;
    const els = document.querySelectorAll('.fx-lead .hero, .week > div:last-child b');
    els.forEach(el => {
      const end = parseInt(el.textContent, 10); if (!(end > 1)) return;
      const t0 = performance.now(), dur = 900;
      const step = now => {
        const x = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - x, 4);
        el.textContent = String(Math.round(end * e));
        if (x < 1) requestAnimationFrame(step);
      };
      el.textContent = '0'; requestAnimationFrame(step);
    });
  }

  function init() {
    document.body.appendChild(cv);
    start();
    setView();
    addEventListener('hashchange', () => setTimeout(setView, 0));
    setTimeout(countUp, 120);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
