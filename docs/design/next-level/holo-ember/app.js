// Blueprint Holo - the hologram walk. three.js r170 (vendored), no network.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { prep } from './prep.js';
import { S, HAIL_OBJ } from './i18n.js';

// ------------------------------------------------------------------ params + state
const NL = window.NL;
const Q = new URLSearchParams(location.search);
const STILL = Q.get('still') === '1';
const RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const CALM = STILL || RM;           // no intro, no flicker, no auto camera
const MOTION = CALM ? 0 : 1;        // ambient shader motion
let lang = (Q.get('lang') || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
const HOUSE_Q = Math.max(0, Math.min(25, parseInt(Q.get('house'), 10) || 0));
const $ = id => document.getElementById(id);
const t = (k, v) => { let s = (S[k] && S[k][lang]) ?? k; if (v) for (const x in v) s = s.split('{' + x + '}').join(v[x]); return s; };
if (STILL) document.body.classList.add('still');

const D = prep(NL, { R: 238 });
const HS = D.houses; const N = HS.length; const R = D.R;
const STORM = D.stormTrack ? D.stormTrack.storm : (NL.storms.find(s => s.date === NL.pick.storm_day) || NL.storms[0]);
const ZONE = String(NL.pick.name).replace(/^[^:]*:\s*/, '');
const ZONE_NB = ZONE.split(' & ').map(p => p.replace(/ /g, '\u00a0')).join(' & ');
const M2MI = 1 / 1609.344, M2FT = 3.28084;
const hailRank = (() => { const o = HS.map(H => H.i).sort((a, b) => HS[b].h.hail - HS[a].h.hail || a - b); const r = []; o.forEach((i, k) => r[i] = k + 1); return r; })();
const TOP5 = i => i < 5;

// formatting
const f2 = v => (+v).toFixed(2);
const mi = m => (m * M2MI).toFixed(1);
function fmtClock(hhmm) { const [h, m] = hhmm.split(':').map(Number); const h12 = ((h + 11) % 12) + 1; return m ? `${h12}:${String(m).padStart(2, '0')}` : `${h12}`; }
const bestTime = () => `${fmtClock(NL.pick.best_time.start)}–${fmtClock(NL.pick.best_time.end)}`;
const stormDay = () => (STORM && STORM.d) ? STORM.d[lang] : NL.pick.storm_day;
const stormTime = () => { const s = (STORM && STORM.time) || ''; const m = s.match(/(\d+:\d+)\s*([AP]M)\s*[–-]\s*(\d+:\d+)\s*([AP]M)/); if (!m) return s; return lang === 'es' ? `${m[1]}–${m[3]} ${m[4] === 'AM' ? 'a. m.' : 'p. m.'}` : `${m[1]}–${m[3]} ${m[4]}`; };
const hailObj = v => { for (const [th, o] of HAIL_OBJ) if (v >= th - 1e-9) return o[lang]; return ''; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ------------------------------------------------------------------ renderer
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
const PR = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(PR);
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setClearColor(0x070503, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 2, 9000);
const rt = new THREE.WebGLRenderTarget(innerWidth * PR, innerHeight * PR, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(PR); composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.45, 0.32);
composer.addPass(bloom);

const col = h => new THREE.Color(h);
const U = {
  uTime: { value: STILL ? 6.0 : 0 }, uMotion: { value: MOTION }, uR: { value: R },
  uReveal: { value: CALM ? 1 : 0 }, uStreetRev: { value: CALM ? 1 : 0 }, uCtxRev: { value: CALM ? 1 : 0 },
  uFocus: { value: 0 }, uTint: { value: 1 }, uBeam: { value: 1 }, uNear: { value: 0 }, uHailMin: { value: D.hailMin }, uHailMax: { value: D.hailMax },
  uBase: { value: col('#0b0806') }, uDeep: { value: col('#b87422') }, uDeepH: { value: col('#5a3210') },
  uCyan: { value: col('#ffbf5e') }, uIce: { value: col('#fff0d2') }, uAmber: { value: col('#f2c14e') },
  uOrange: { value: col('#ff7a2a') }, uGold: { value: col('#ffd98a') }, uRed: { value: col('#ff4f5a') },
  // hail scale (cool -> hot): <0.75 blue, 0.9 teal, 1.0 yellow, 1.5 orange, 1.75 red, 2.0+ magenta. Same stops as hailCSS + legend.
  uDone: { value: col('#6f8bff') },
  uH0: { value: col('#2fa8ff') }, uH1: { value: col('#2de0c0') }, uH2: { value: col('#ffe14d') }, uH3: { value: col('#ff8a2a') }, uH4: { value: col('#ff3b4f') }, uH5: { value: col('#ff3bd0') },
};
const GL_COMMON = /* glsl */`
uniform float uTime, uMotion, uR, uHailMin, uHailMax, uTint, uNear;
uniform vec3 uBase, uDeep, uDeepH, uCyan, uIce, uAmber, uOrange, uGold, uRed, uDone;
float lineAA(float d, float w){ float fw = fwidth(d); return 1.0 - smoothstep(w*0.5, w*0.5 + fw*1.3, abs(d)); }
uniform vec3 uH0, uH1, uH2, uH3, uH4, uH5;
float seg(float v, float a, float b){ return clamp((v-a)/(b-a), 0.0, 1.0); }
vec3 hailCol(float v){ vec3 c = mix(uH0, uH1, seg(v,0.75,0.9)); c = mix(c, uH2, seg(v,0.9,1.0)); c = mix(c, uH3, seg(v,1.0,1.5)); c = mix(c, uH4, seg(v,1.5,1.75)); return mix(c, uH5, seg(v,1.75,2.0)); }
float hailRel(float v){ return clamp((v-uHailMin)/max(uHailMax-uHailMin, 1e-3), 0.0, 1.0); }
`;
const VS_WORLD = /* glsl */`varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;
const mat = (vs, fs, extra = {}, o = {}) => new THREE.ShaderMaterial(Object.assign({
  uniforms: Object.assign({}, U, extra), vertexShader: vs, fragmentShader: GL_COMMON + fs,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
}, o));
const MAXBLEND = { blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendEquationAlpha: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor };

// ------------------------------------------------------------------ sky + table
{
  const g = new THREE.SphereGeometry(6000, 32, 16);
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { a: { value: col('#040302') }, b: { value: col('#1a0f06') }, c: { value: col('#020101') } },
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 a,b,c; varying vec3 vD; void main(){ float h = normalize(vD).y; vec3 k = h > 0.0 ? mix(b, a, smoothstep(0.0, 0.5, h)) : mix(b, c, smoothstep(0.0, -0.25, h)); gl_FragColor = vec4(k, 1.0); }' });
  const sky = new THREE.Mesh(g, m); sky.renderOrder = -20; scene.add(sky);
}
// hail field texture
const hailTex = (() => {
  const n = D.fieldN; const data = new Uint16Array(n * n * 4);
  for (let i = 0; i < n * n * 4; i++) data[i] = THREE.DataUtils.toHalfFloat(D.field[i]);
  const tx = new THREE.DataTexture(data, n, n, THREE.RGBAFormat, THREE.HalfFloatType);
  tx.magFilter = THREE.LinearFilter; tx.minFilter = THREE.LinearFilter; tx.wrapS = tx.wrapT = THREE.ClampToEdgeWrapping; tx.needsUpdate = true; return tx;
})();
const ground = (() => {
  const g = new THREE.CircleGeometry(R + 36, 256); g.rotateX(-Math.PI / 2);
  const m = new THREE.ShaderMaterial({ uniforms: Object.assign({}, U, { uHail: { value: hailTex }, uHailBox: { value: new THREE.Vector3(...D.fieldBox) } }),
    vertexShader: VS_WORLD, fragmentShader: GL_COMMON + /* glsl */`
    uniform float uReveal; uniform sampler2D uHail; uniform vec3 uHailBox; varying vec3 vW;
    float grid(vec2 p, float s){ vec2 q = p/s; vec2 fw = max(fwidth(q), vec2(1e-5)); vec2 g = abs(fract(q-0.5)-0.5)/fw; return 1.0 - min(min(g.x, g.y), 1.0); }
    void main(){
      vec2 p = vW.xz; float r = length(p);
      float inD = 1.0 - smoothstep(uR-34.0, uR-2.0, r);
      vec3 c = uBase*(0.7 + 0.8*(1.0 - r/uR)*step(r, uR)) + uDeep*0.018*pow(max(0.0, 1.0 - r/uR), 2.0);
      c += uDeep*(grid(p, 10.0)*(0.055 + 0.05*uNear) + grid(p, 50.0)*0.16 + grid(p, 2.0)*0.03*uNear)*inD;
      float rr = abs(fract(r/50.0 - 0.5) - 0.5)*50.0; c += uDeep*lineAA(rr, 0.3)*0.08*inD;
      // hail: calm thermal tint + contour every 0.05 in
      vec4 hf = texture2D(uHail, (p - uHailBox.xy)/uHailBox.z);
      float hv = hf.r, hw = hf.g*inD; float rel = hailRel(hv); vec3 hc = hailCol(hv);
      c += hc*hw*(0.018 + 0.07*rel*rel)*uTint;
      float f = (hv - 1.0)/0.05; float iso = abs(fract(f - 0.5) - 0.5)/max(fwidth(f), 1e-4);
      c += hc*(1.0 - smoothstep(0.5, 1.5, iso))*hw*(0.22 + 0.28*rel)*mix(0.7, 1.0, uTint);
      // rim instrument
      float a = atan(p.y, p.x); float deg = degrees(a) + 180.0;
      c += uCyan*lineAA(r - uR, 0.9)*1.1 + uCyan*exp(-abs(r - uR)/7.0)*0.10;
      float b1 = step(uR+4.0, r)*step(r, uR+8.0), b2 = step(uR+4.0, r)*step(r, uR+12.5);
      float dmin = abs(fract(deg/2.0 + 0.5) - 0.5)*2.0*0.0174533*r;
      float dmaj = abs(fract(deg/10.0 + 0.5) - 0.5)*10.0*0.0174533*r;
      c += uCyan*lineAA(dmin, 0.35)*b1*0.45 + uIce*lineAA(dmaj, 0.55)*b2*0.7;
      float rot = uTime*0.012*uMotion;
      float da = fract((a + rot)/6.2831853*48.0);
      c += uCyan*step(uR+17.0, r)*step(r, uR+19.2)*step(da, 0.6)*0.28;
      float ar = fract((a - rot*1.8)/6.2831853*3.0);
      c += uIce*lineAA(r - (uR+24.5), 0.7)*step(ar, 0.3)*0.65;
      c += uDeep*lineAA(r - (uR+33.0), 0.5)*0.55;
      // intro wipe
      float rv = uReveal*(uR + 80.0);
      float vis = 1.0 - smoothstep(rv - 40.0, rv, r);
      float front = exp(-pow((r - rv)/5.0, 2.0))*step(0.0001, uReveal)*step(uReveal, 0.9999);
      gl_FragColor = vec4(c*vis + uIce*front*0.45, 1.0);
    }` });
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = -10; scene.add(mesh); return mesh;
})();
{ // plinth: the physical table under the projection
  const g = new THREE.CylinderGeometry(R + 36, R + 31, 16, 256, 1, true); g.translate(0, -8, 0);
  const m = new THREE.ShaderMaterial({ uniforms: Object.assign({}, U), vertexShader: VS_WORLD, fragmentShader: GL_COMMON + /* glsl */`
    uniform float uReveal; varying vec3 vW;
    void main(){
      float h = clamp((vW.y + 16.0)/16.0, 0.0, 1.0);
      vec3 c = uBase*0.9*h*h;
      c += uCyan*lineAA(vW.y + 0.6, 0.5)*0.9 + uCyan*lineAA(vW.y + 5.5, 0.25)*0.22;
      float a = atan(vW.z, vW.x); float dd = abs(fract(degrees(a)/1.2 + 0.5) - 0.5)*1.2*0.0174533*(uR + 34.0);
      c += uDeep*lineAA(dd, 0.22)*0.28*step(-4.8, vW.y)*step(vW.y, -1.4);
      gl_FragColor = vec4(c*uReveal, 1.0);
    }` });
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = -9; scene.add(mesh);
}
const haze = (() => { // the projection volume: faint light walls rising off the rim
  const g = new THREE.CylinderGeometry(R + 1, R + 1, 130, 160, 1, true); g.translate(0, 65, 0);
  const m = mat(/* glsl */`varying vec3 vW; varying vec3 vN; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*viewMatrix*w; }`,
    /* glsl */`uniform float uReveal, uHaze; varying vec3 vW; varying vec3 vN;
    void main(){
      vec3 V = normalize(cameraPosition - vW); float fr = 1.0 - abs(dot(normalize(vN), V));
      float h = clamp(vW.y/130.0, 0.0, 1.0); float fall = pow(1.0 - h, 2.4);
      float a = atan(vW.z, vW.x);
      float st = 0.55 + 0.45*sin(a*140.0 + sin(a*31.0)*2.5)*sin(a*57.0 + 1.3);
      float k = (0.012 + 0.16*pow(fr, 3.0))*fall*(0.7 + 0.3*st)*uHaze;
      gl_FragColor = vec4(uCyan, k*uReveal);
    }`, { uHaze: { value: 1 } });
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 5; scene.add(mesh); return mesh;
})();

// ------------------------------------------------------------------ ribbons (streets, path, storm)
function ribbon(polys, y) { // polys: [{p:[[x,z]..], hw, k, u0?, us?:cumulative array}]
  const pos = [], uv = [], kk = [], idx = []; let vi = 0;
  polys.forEach(pl => {
    const p = pl.p; let u = pl.u0 || 0;
    for (let i = 0; i + 1 < p.length; i++) {
      const a = p[i], b = p[i + 1]; const dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz); if (L < 1e-3) continue;
      const tx = dx / L, tz = dz / L, nx = -tz, nz = tx; const hw = pl.hw; const cap = pl.cap ?? hw;
      const ua = u - cap, ub = u + L + cap;
      const ax = a[0] - tx * cap, az = a[1] - tz * cap, bx = b[0] + tx * cap, bz = b[1] + tz * cap;
      pos.push(ax + nx * hw, y, az + nz * hw, ax - nx * hw, y, az - nz * hw, bx - nx * hw, y, bz - nz * hw, bx + nx * hw, y, bz + nz * hw);
      uv.push(ua, 1, ua, -1, ub, -1, ub, 1); kk.push(pl.k, pl.k, pl.k, pl.k);
      idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3); vi += 4; u += L;
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aUV', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aK', new THREE.Float32BufferAttribute(kk, 1)); g.setIndex(idx); return g;
}
function addCentres(g) { // per-vertex ribbon centre (for view-dependent width)
  const p = g.attributes.position.array; const c = new Float32Array(p.length);
  for (let q = 0; q < p.length; q += 12) { const x0 = (p[q] + p[q + 3]) / 2, z0 = (p[q + 2] + p[q + 5]) / 2, x1 = (p[q + 6] + p[q + 9]) / 2, z1 = (p[q + 8] + p[q + 11]) / 2; c.set([x0, p[q + 1], z0, x0, p[q + 1], z0, x1, p[q + 1], z1, x1, p[q + 1], z1], q); }
  g.setAttribute('aC', new THREE.BufferAttribute(c, 3));
}
const VS_RIB = /* glsl */`attribute vec2 aUV; attribute float aK; varying vec2 vUV; varying float vK; varying vec3 vW;
  void main(){ vUV = aUV; vK = aK; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;
const streetsMesh = (() => {
  const polys = D.drawStreets.map(s => ({ p: s.p, hw: s.walk ? 6.2 : (s.c <= 1 ? 7.6 : 5.4), k: s.walk ? 1 : (s.c <= 1 ? 2 : 0) }));
  const m = mat(VS_RIB, /* glsl */`uniform float uStreetRev; varying vec2 vUV; varying float vK; varying vec3 vW;
    void main(){
      float av = abs(vUV.y); float fw = fwidth(vUV.y);
      float edge = 1.0 - smoothstep(0.0, fw*1.6, abs(av - 0.8));
      float fill = 1.0 - smoothstep(0.76, 0.8, av);
      float cl = (1.0 - smoothstep(0.0, fw*1.6, av - 0.012));
      float dash = cl*step(fract(vUV.x/9.0), 0.5);
      float glow = exp(-av*av*5.0);
      vec3 c;
      if (vK > 0.5 && vK < 1.5) c = uCyan*edge*0.62 + uDeep*fill*0.07 + uCyan*glow*0.035 + uCyan*dash*0.30;
      else if (vK > 1.5) c = uCyan*edge*0.42 + uDeep*fill*0.05 + uCyan*dash*0.20;
      else c = uDeep*edge*0.62 + uDeep*fill*0.03 + uDeep*dash*0.30;
      float r = length(vW.xz);
      float fade = 1.0 - smoothstep(uR - 46.0, uR + 2.0, r);
      float rv = uStreetRev*(uR + 70.0);
      float vis = 1.0 - smoothstep(rv - 24.0, rv, r);
      float front = exp(-pow((r - rv)/4.0, 2.0))*step(0.001, uStreetRev)*step(uStreetRev, 0.999);
      gl_FragColor = vec4((c*vis + uIce*front*fill*0.8)*fade, 1.0);
    }`, { }, MAXBLEND);
  const mesh = new THREE.Mesh(ribbon(polys, 0.12), m); mesh.renderOrder = 1; scene.add(mesh); return mesh;
})();
const pathU = { uDraw: { value: CALM ? 1e6 : -1 }, uProg: { value: -1 }, uTour: { value: 0 }, uLen: { value: D.routeLen }, uHead: { value: -1e4 } };
const VS_PATH = /* glsl */`attribute vec2 aUV; attribute float aK; attribute vec3 aC; varying vec2 vUV; varying float vK; varying vec3 vW;
  void main(){ vUV = aUV; vK = aK; float s = clamp(distance(cameraPosition, aC)/420.0, 0.34, 1.0);
    vec3 p = aC + (position - aC)*vec3(s, 1.0, s); vec4 w = modelMatrix*vec4(p,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;
const pathMesh = (() => {
  const m = mat(VS_PATH, /* glsl */`uniform float uDraw, uProg, uTour, uLen, uHead; varying vec2 vUV; varying vec3 vW;
    void main(){
      float d = vUV.x; if (d > uDraw) discard;
      float av = abs(vUV.y);
      float core = exp(-av*av*9.0); float line = 1.0 - smoothstep(0.16, 0.34, av);
      vec3 ahead = uIce*(line*0.95 + core*0.35);
      float pl = fract((d - uTime*34.0)/120.0);
      float pulse = smoothstep(0.0, 0.05, pl)*(1.0 - smoothstep(0.05, 0.22, pl))*uMotion*(1.0 - uTour);
      ahead += uIce*pulse*core*0.9;
      ahead *= mix(1.0, 0.62, uNear);
      vec3 walked = uOrange*(line*1.15 + core*0.45)*mix(1.0, 0.75, uNear);
      vec3 c = mix(ahead*(1.0 - 0.55*uTour), walked, step(d, uProg));
      c += uIce*exp(-pow((d - uDraw)/6.0, 2.0))*core*1.6*step(uDraw, uLen - 1.0);
      c += (uIce*0.6 + uOrange)*exp(-pow((d - uHead)/5.0, 2.0))*core*1.6;
      gl_FragColor = vec4(c, 1.0);
    }`, pathU, MAXBLEND);
  const g = ribbon([{ p: D.route, hw: 2.6, k: 0, cap: 0.6 }], 0.7); addCentres(g);
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 3; scene.add(mesh); return mesh;
})();
const stormMesh = (() => {
  if (!D.stormTrack || !D.stormTrack.parts.length) return null;
  const parts = D.stormTrack.parts; let u = 0; const polys = [];
  parts.forEach(p => { polys.push({ p, hw: 64, k: 0, u0: u, cap: 0 }); u += Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]); });
  const m = mat(VS_RIB, /* glsl */`uniform float uReveal; varying vec2 vUV; varying vec3 vW;
    void main(){
      float av = abs(vUV.y); float fw = fwidth(vUV.y);
      float band = exp(-av*av*3.0)*0.045;
      float cl = (1.0 - smoothstep(0.0, fw*1.5, av - 0.012))*step(fract(vUV.x/14.0), 0.55);
      float x = fract(vUV.x/80.0)*80.0 - 40.0; float vy = vUV.y*64.0; // chevrons every 80 m, pointing along the track
      float dch = abs(x + abs(vy)*0.9);
      float chev = (1.0 - smoothstep(0.35, 0.35 + fwidth(x)*1.5, dch))*step(abs(vy), 6.5);
      float r = length(vW.xz); float fade = (1.0 - smoothstep(uR - 30.0, uR + 26.0, r));
      vec3 c = uAmber*(band + cl*0.30 + chev*0.35)*fade*uReveal;
      gl_FragColor = vec4(c, 1.0);
    }`, {}, MAXBLEND);
  const mesh = new THREE.Mesh(ribbon(polys, 0.3), m); mesh.renderOrder = 2; scene.add(mesh); return mesh;
})();

// ------------------------------------------------------------------ hologram houses (merged)
const upNormals = n => { const a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a[i * 3 + 1] = 1; return a; };
function Builder() {
  const B = { pos: [], nor: [], id: [], top: [], ep: [], eid: [], ek: [], etop: [] };
  let cx = 0, cz = 0, cs = 1, sn = 0, cid = 0, ctop = 0;
  B.bb = [0, 0, 0, 0];
  B.set = (c, yaw, id, top) => { cx = c[0]; cz = c[1]; cs = Math.cos(yaw); sn = Math.sin(yaw); cid = id; ctop = top; B.bb = [Infinity, -Infinity, Infinity, -Infinity]; };
  const W = (x, y, z) => { const b = B.bb; if (x < b[0]) b[0] = x; if (x > b[1]) b[1] = x; if (z < b[2]) b[2] = z; if (z > b[3]) b[3] = z; return [cx + x * cs + z * sn, y, cz - x * sn + z * cs]; };
  B.tri = (a, b, c) => {
    const A = W(...a), Bv = W(...b), C = W(...c);
    const ux = Bv[0] - A[0], uy = Bv[1] - A[1], uz = Bv[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    B.pos.push(...A, ...Bv, ...C); for (let i = 0; i < 3; i++) { B.nor.push(nx, ny, nz); B.id.push(cid); B.top.push(ctop); }
  };
  B.quad = (a, b, c, d) => { B.tri(a, b, c); B.tri(a, c, d); };
  B.edge = (a, b, k = 0) => { B.ep.push(...W(...a), ...W(...b)); B.eid.push(cid, cid); B.ek.push(k, k); B.etop.push(ctop, ctop); };
  B.rect = (pts, k) => { for (let i = 0; i < pts.length; i++) B.edge(pts[i], pts[(i + 1) % pts.length], k); };
  B.box = (x0, x1, y0, y1, z0, z1, o = {}) => {
    const p = (x, y, z) => [x, y, z];
    B.quad(p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)); B.quad(p(x1, y0, z0), p(x0, y0, z0), p(x0, y1, z0), p(x1, y1, z0));
    B.quad(p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1), p(x0, y1, z0)); B.quad(p(x1, y0, z1), p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1));
    if (o.top !== false) B.quad(p(x0, y1, z0), p(x0, y1, z1), p(x1, y1, z1), p(x1, y1, z0));
    const k = o.k || 0;
    [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].forEach(([x, z], i, arr) => { const [x2, z2] = arr[(i + 1) % 4]; B.edge([x, y0, z], [x2, y0, z2], k); if (o.top !== false) B.edge([x, y1, z], [x2, y1, z2], k); B.edge([x, y0, z], [x, y1, z], k); });
    if (o.top === false) [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].forEach(([x, z], i, arr) => { const [x2, z2] = arr[(i + 1) % 4]; B.edge([x, y1, z], [x2, y1, z2], k); });
  };
  B.gable = (x0, x1, z0, z1, y, rh, axis, ov = 0.5) => { // ridge along x (axis 'x') or z
    if (axis === 'x') {
      const zm = (z0 + z1) / 2, X0 = x0 - ov, X1 = x1 + ov, Z0 = z0 - ov, Z1 = z1 + ov, yr = y + rh;
      B.quad([X0, y, Z1], [X1, y, Z1], [X1, yr, zm], [X0, yr, zm]); B.quad([X1, y, Z0], [X0, y, Z0], [X0, yr, zm], [X1, yr, zm]);
      B.tri([x0, y, z0], [x0, y, z1], [x0, yr, zm]); B.tri([x1, y, z1], [x1, y, z0], [x1, yr, zm]);
      B.edge([X0, yr, zm], [X1, yr, zm]); B.edge([X0, y, Z1], [X1, y, Z1]); B.edge([X0, y, Z0], [X1, y, Z0]);
      B.edge([X0, y, Z1], [X0, yr, zm]); B.edge([X1, y, Z1], [X1, yr, zm]); B.edge([X0, y, Z0], [X0, yr, zm]); B.edge([X1, y, Z0], [X1, yr, zm]);
    } else {
      const xm = (x0 + x1) / 2, X0 = x0 - ov, X1 = x1 + ov, Z0 = z0 - ov, Z1 = z1 + ov, yr = y + rh;
      B.quad([X0, y, Z0], [X0, y, Z1], [xm, yr, Z1], [xm, yr, Z0]); B.quad([X1, y, Z1], [X1, y, Z0], [xm, yr, Z0], [xm, yr, Z1]);
      B.tri([x0, y, z1], [x1, y, z1], [xm, yr, z1]); B.tri([x1, y, z0], [x0, y, z0], [xm, yr, z0]);
      B.edge([xm, yr, Z0], [xm, yr, Z1]); B.edge([X0, y, Z0], [X0, y, Z1]); B.edge([X1, y, Z0], [X1, y, Z1]);
      B.edge([X0, y, Z0], [xm, yr, Z0]); B.edge([X1, y, Z0], [xm, yr, Z0]); B.edge([X0, y, Z1], [xm, yr, Z1]); B.edge([X1, y, Z1], [xm, yr, Z1]);
    }
  };
  B.hip = (x0, x1, z0, z1, y, rh, ov = 0.5) => {
    const X0 = x0 - ov, X1 = x1 + ov, Z0 = z0 - ov, Z1 = z1 + ov, yr = y + rh; const w = X1 - X0, d = Z1 - Z0;
    if (w >= d) {
      const zm = (Z0 + Z1) / 2, i = d / 2 * 0.9, ra = [X0 + i, yr, zm], rb = [X1 - i, yr, zm];
      B.quad([X0, y, Z1], [X1, y, Z1], rb, ra); B.quad([X1, y, Z0], [X0, y, Z0], ra, rb); B.tri([X0, y, Z0], [X0, y, Z1], ra); B.tri([X1, y, Z1], [X1, y, Z0], rb);
      B.edge(ra, rb); [[X0, Z0, ra], [X0, Z1, ra], [X1, Z0, rb], [X1, Z1, rb]].forEach(([x, z, r]) => B.edge([x, y, z], r));
    } else {
      const xm = (X0 + X1) / 2, i = w / 2 * 0.9, ra = [xm, yr, Z0 + i], rb = [xm, yr, Z1 - i];
      B.quad([X0, y, Z0], [X0, y, Z1], rb, ra); B.quad([X1, y, Z1], [X1, y, Z0], ra, rb); B.tri([X1, y, Z0], [X0, y, Z0], ra); B.tri([X0, y, Z1], [X1, y, Z1], rb);
      B.edge(ra, rb); [[X0, Z0, ra], [X1, Z0, ra], [X0, Z1, rb], [X1, Z1, rb]].forEach(([x, z, r]) => B.edge([x, y, z], r));
    }
    B.rect([[X0, y, Z0], [X1, y, Z0], [X1, y, Z1], [X0, y, Z1]]);
  };
  B.win = (x, y, w, h, z, k = 1) => { B.rect([[x - w / 2, y, z], [x + w / 2, y, z], [x + w / 2, y + h, z], [x - w / 2, y + h, z]], k); B.edge([x, y, z], [x, y + h, z], k); };
  B.winSide = (xp, zc, y, w, h, k = 1) => { B.rect([[xp, y, zc - w / 2], [xp, y, zc + w / 2], [xp, y + h, zc + w / 2], [xp, y + h, zc - w / 2]], k); };
  return B;
}
function buildHouse(B, H) {
  const s = H.spec; const hw = s.w / 2, hd = s.d / 2; const S = 1.18; const zf = hd + 0.04, zb = -hd - 0.04;
  B.set(H.c, H.yaw, H.i, s.top);
  let x0 = -hw, x1 = hw;
  if (s.garage === 1) { const gw = 6.4 * S; if (s.gside > 0) x1 = hw - gw * 0.5; else x0 = -hw + gw * 0.5; }
  const mw = x1 - x0, mx = (x0 + x1) / 2;
  B.box(x0, x1, 0, s.wall, -hd, hd, { top: false });
  const long = mw >= s.d;
  if (s.roof === 'hip') B.hip(x0, x1, -hd, hd, s.wall, s.rh); else B.gable(x0, x1, -hd, hd, s.wall, s.rh, long ? 'x' : 'z');
  // windows + door (front), a few at the back and sides
  const floors = s.wall > 5 ? 2 : 1; const fh = s.wall / floors;
  const nW = Math.max(2, Math.round(mw / 3.6));
  for (let f = 0; f < floors; f++) for (let k = 0; k < nW; k++) {
    const x = x0 + (k + 0.5) * mw / nW; if (f === 0 && Math.abs(x - mx) < 1.3) continue;
    B.win(x, f * fh + fh * 0.32, 1.15, fh * 0.42, zf); if (k % 2 === 0) B.win(x, f * fh + fh * 0.32, 1.15, fh * 0.42, zb);
  }
  B.rect([[mx - 0.55, 0, zf], [mx + 0.55, 0, zf], [mx + 0.55, 2.2, zf], [mx - 0.55, 2.2, zf]], 1);
  for (let f = 0; f < floors; f++) { B.winSide(x0 - 0.04, 0, f * fh + fh * 0.32, 1.1, fh * 0.42); B.winSide(x1 + 0.04, 0, f * fh + fh * 0.32, 1.1, fh * 0.42); }
  if (s.garage === 1) { // attached side garage, front-gabled
    const gw = 6.4 * S, gx0 = s.gside > 0 ? x1 : x0 - gw * 0.5 - (gw * 0.5), gx1 = gx0 + gw; const gz0 = -hd + 1, gz1 = hd - 0.3; const gwall = 2.9;
    const X0 = s.gside > 0 ? x1 : x0 - gw, X1 = X0 + gw;
    B.box(X0, X1, 0, gwall, gz0, gz1, { top: false }); B.gable(X0, X1, gz0, gz1, gwall, 1.5, 'z', 0.35);
    const dz = gz1 + 0.04; B.rect([[X0 + 0.7, 0, dz], [X1 - 0.7, 0, dz], [X1 - 0.7, 2.3, dz], [X0 + 0.7, 2.3, dz]], 1);
    for (let k = 1; k < 4; k++) B.edge([X0 + 0.7, k * 0.575, dz], [X1 - 0.7, k * 0.575, dz], 1);
    void gx1;
  }
  if (s.garage === 2) { // modern: garage pushed forward on one side
    const gw = Math.min(7.2 * S, mw * 0.55), X0 = s.gside > 0 ? x1 - gw : x0, X1 = X0 + gw; const gz0 = hd - 1.5, gz1 = hd + 5.2; const gwall = 3.0;
    B.box(X0, X1, 0, gwall, gz0, gz1, { top: false }); B.gable(X0, X1, gz0, gz1, gwall, 1.8, 'z', 0.35);
    const dz = gz1 + 0.04; B.rect([[X0 + 0.8, 0, dz], [X1 - 0.8, 0, dz], [X1 - 0.8, 2.3, dz], [X0 + 0.8, 2.3, dz]], 1);
    for (let k = 1; k < 4; k++) B.edge([X0 + 0.8, k * 0.575, dz], [X1 - 0.8, k * 0.575, dz], 1);
  }
  if (s.porch) { // porch roof slab + posts
    const px0 = s.garage === 2 ? (s.gside > 0 ? x0 : x0 + Math.min(7.2 * S, mw * 0.55)) : x0 + 0.3, px1 = s.garage === 2 ? (s.gside > 0 ? x1 - Math.min(7.2 * S, mw * 0.55) : x1) : x1 - 0.3;
    const py = Math.min(2.9, s.wall * 0.92), pz = hd + 2.6;
    B.box(px0, px1, py, py + 0.28, hd, pz);
    [px0 + 0.2, (px0 + px1) / 2, px1 - 0.2].forEach(x => B.edge([x, 0, pz - 0.2], [x, py, pz - 0.2]));
    B.edge([px0, 0.5, pz - 0.2], [px1, 0.5, pz - 0.2], 1);
  }
  if (s.chimney) { const cxp = s.gside > 0 ? x0 + 1.4 : x1 - 1.4; B.box(cxp - 0.45, cxp + 0.45, s.wall - 0.5, s.wall + s.rh + 0.9, -0.9, 0); }
}
const hU = { uRev: { value: new Float32Array(N).fill(CALM ? 1 : 0) }, uHov: { value: new Float32Array(N) }, uSel: { value: -1 }, uScanY: { value: -50 }, uVis: { value: new Float32Array(N) } };
const VS_HOUSE = /* glsl */`attribute float aId; attribute float aTop; uniform float uRev[${N}]; uniform float uHov[${N}]; uniform float uVis[${N}]; uniform float uSel;
  varying vec3 vW; varying vec3 vN; varying float vRev, vHov, vSelF, vTop, vVis;
  void main(){ int i = int(aId + 0.5); vRev = uRev[i]; vHov = uHov[i]; vVis = uVis[i]; vSelF = abs(aId - uSel) < 0.5 ? 1.0 : 0.0; vTop = aTop;
    vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*viewMatrix*w; }`;
const houseB = Builder(); HS.forEach(H => { buildHouse(houseB, H); H.bb = houseB.bb.slice(); });
const houseFill = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(houseB.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(houseB.nor, 3));
  g.setAttribute('aId', new THREE.Float32BufferAttribute(houseB.id, 1)); g.setAttribute('aTop', new THREE.Float32BufferAttribute(houseB.top, 1));
  const m = mat(VS_HOUSE, /* glsl */`uniform float uFocus, uScanY; varying vec3 vW; varying vec3 vN; varying float vRev, vHov, vSelF, vTop, vVis;
    void main(){
      float cut = vRev*(vTop + 1.5); if (vW.y > cut) discard;
      vec3 V = normalize(cameraPosition - vW); float fr = 1.0 - abs(dot(normalize(vN), V)); fr = fr*fr;
      float sl = 0.5 + 0.5*sin((vW.y*2.4 - uTime*1.4*uMotion)*6.2831853);
      float scan = mix(0.66, 1.0, smoothstep(0.25, 0.75, sl));
      float hl = max(vHov, vSelF);
      vec3 c = mix(uDeepH, uCyan, 0.3 + 0.7*fr); c = mix(c, uIce, fr*0.45 + hl*0.3);
      c = mix(c, mix(c, uDone, 0.6), vVis*(1.0 - vSelF)*0.55);
      float a = (0.022 + 0.15*fr)*scan*(1.0 + vHov*1.4 + vSelF*1.0);
      a *= mix(1.0, 0.28, uFocus*(1.0 - vSelF));
      float be = exp(-pow((vW.y - cut)/0.4, 2.0))*step(vRev, 0.999)*step(0.001, vRev);
      float sw = exp(-pow((vW.y - uScanY)/0.45, 2.0))*vSelF;
      gl_FragColor = vec4(c + uIce*(be*2.0 + sw*1.4), a + be*0.7 + sw*0.45);
    }`, hU);
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 6; scene.add(mesh); return mesh;
})();
const houseEdges = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(houseB.ep, 3)); g.setAttribute('aId', new THREE.Float32BufferAttribute(houseB.eid, 1));
  g.setAttribute('aK', new THREE.Float32BufferAttribute(houseB.ek, 1)); g.setAttribute('aTop', new THREE.Float32BufferAttribute(houseB.etop, 1));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(upNormals(houseB.ep.length / 3), 3));
  const m = mat(VS_HOUSE.replace('attribute float aTop;', 'attribute float aTop; attribute float aK; varying float vK;').replace('vTop = aTop;', 'vTop = aTop; vK = aK;'),
    /* glsl */`uniform float uFocus, uScanY; varying vec3 vW; varying float vRev, vHov, vSelF, vTop, vK, vVis;
    void main(){
      float cut = vRev*(vTop + 1.5); if (vW.y > cut) discard;
      float hl = max(vHov, vSelF);
      vec3 c = mix(uCyan, uIce, 0.28 + 0.62*hl); c = mix(c, uDone, vVis*(1.0 - vSelF)*0.5);
      float a = (vK > 0.5 ? 0.28 : 0.72)*(1.0 + vHov*0.7 + vSelF*0.4);
      float sl = 0.5 + 0.5*sin((vW.y*2.4 - uTime*1.4*uMotion)*6.2831853); a *= mix(0.8, 1.0, sl);
      a *= mix(1.0, 0.26, uFocus*(1.0 - vSelF));
      float be = exp(-pow((vW.y - cut)/0.4, 2.0))*step(vRev, 0.999)*step(0.001, vRev);
      float sw = exp(-pow((vW.y - uScanY)/0.45, 2.0))*vSelF;
      gl_FragColor = vec4(c + uIce*sw, a + be + sw);
    }`, hU);
  const mesh = new THREE.LineSegments(g, m); mesh.renderOrder = 7; scene.add(mesh); return mesh;
})();

// context blocks: dim neighbours so the 25 doors read as "these ones" in a real neighbourhood
const ctxMeshes = (() => {
  const B = Builder(); const rr = [];
  D.ctx.forEach(c => {
    const top = c.wall + c.rh; B.set(c.c, c.yaw, 0, top);
    const hw = c.w / 2, hd = c.d / 2; const n0 = B.pos.length, e0 = B.ep.length;
    B.box(-hw, hw, 0, c.wall, -hd, hd, { top: false }); B.gable(-hw, hw, -hd, hd, c.wall, c.rh, c.cross ? 'z' : 'x', 0.4);
    for (let i = n0; i < B.pos.length; i += 3) rr.push(c.r);
    c._e = [e0, B.ep.length];
  });
  const er = []; D.ctx.forEach(c => { for (let i = c._e[0]; i < c._e[1]; i += 3) er.push(c.r); });
  const VS = /* glsl */`attribute float aR; attribute float aTop; varying vec3 vW; varying vec3 vN; varying float vR, vTop;
    void main(){ vR = aR; vTop = aTop; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix)*normal); gl_Position = projectionMatrix*viewMatrix*w; }`;
  const FS_CUT = /* glsl */`uniform float uCtxRev, uFocus; varying vec3 vW; varying vec3 vN; varying float vR, vTop;
    float cutH(){ return clamp((uCtxRev*(uR + 90.0) - vR)/40.0, 0.0, 1.0)*(vTop + 1.0); }`;
  const gf = new THREE.BufferGeometry();
  gf.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3)); gf.setAttribute('normal', new THREE.Float32BufferAttribute(B.nor, 3));
  gf.setAttribute('aR', new THREE.Float32BufferAttribute(rr, 1)); gf.setAttribute('aTop', new THREE.Float32BufferAttribute(B.top, 1));
  const mf = mat(VS, FS_CUT + /* glsl */`void main(){ float cut = cutH(); if (vW.y > cut) discard;
      vec3 V = normalize(cameraPosition - vW); float fr = 1.0 - abs(dot(normalize(vN), V)); fr *= fr;
      float fade = 1.0 - smoothstep(uR - 60.0, uR - 10.0, length(vW.xz));
      gl_FragColor = vec4(mix(uDeepH, uDeep, fr), (0.022 + 0.07*fr)*fade*mix(1.0, 0.6, uFocus)); }`);
  const ge = new THREE.BufferGeometry();
  ge.setAttribute('position', new THREE.Float32BufferAttribute(B.ep, 3)); ge.setAttribute('normal', new THREE.Float32BufferAttribute(upNormals(B.ep.length / 3), 3));
  ge.setAttribute('aR', new THREE.Float32BufferAttribute(er, 1)); ge.setAttribute('aTop', new THREE.Float32BufferAttribute(B.etop, 1));
  const me = mat(VS, FS_CUT + /* glsl */`void main(){ float cut = cutH(); if (vW.y > cut) discard;
      float fade = 1.0 - smoothstep(uR - 60.0, uR - 10.0, length(vW.xz));
      gl_FragColor = vec4(uDeep, 0.20*fade*mix(1.0, 0.6, uFocus)); }`);
  const a = new THREE.Mesh(gf, mf); a.renderOrder = 4; const b = new THREE.LineSegments(ge, me); b.renderOrder = 4; scene.add(a, b); return [a, b];
})();

// pads: each hologram stands on its footprint, tinted by the hail at that home
const padMesh = (() => {
  const pos = [], loc = [], half = [], id = [], hail = [], idx = []; let vi = 0;
  HS.forEach(H => {
    const b = H.bb; const m = 3.2; const hx = (b[1] - b[0]) / 2 + m, hz = (b[3] - b[2]) / 2 + m; const ox = (b[0] + b[1]) / 2, oz = (b[2] + b[3]) / 2;
    const cs = Math.cos(H.yaw), sn = Math.sin(H.yaw);
    [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].forEach(([x, z]) => { const xx = x + ox, zz = z + oz; pos.push(H.c[0] + xx * cs + zz * sn, 0.25, H.c[1] - xx * sn + zz * cs); loc.push(x, z); half.push(hx, hz); id.push(H.i); hail.push(H.h.hail); });
    idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3); vi += 4;
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aLoc', new THREE.Float32BufferAttribute(loc, 2));
  g.setAttribute('aHalf', new THREE.Float32BufferAttribute(half, 2)); g.setAttribute('aId', new THREE.Float32BufferAttribute(id, 1)); g.setAttribute('aHail', new THREE.Float32BufferAttribute(hail, 1)); g.setIndex(idx);
  const m = mat(/* glsl */`attribute vec2 aLoc; attribute vec2 aHalf; attribute float aId; attribute float aHail; uniform float uRev[${N}]; uniform float uHov[${N}]; uniform float uVis[${N}]; uniform float uSel;
    varying vec2 vLoc, vHalf; varying float vHail, vRev, vHov, vSelF, vVis;
    void main(){ int i = int(aId + 0.5); vRev = uRev[i]; vHov = uHov[i]; vVis = uVis[i]; vSelF = abs(aId - uSel) < 0.5 ? 1.0 : 0.0; vLoc = aLoc; vHalf = aHalf; vHail = aHail;
      gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    /* glsl */`uniform float uFocus; varying vec2 vLoc, vHalf; varying float vHail, vRev, vHov, vSelF, vVis;
    void main(){
      vec2 q = abs(vLoc) - vHalf; float bd = max(q.x, q.y);
      float fw = fwidth(bd);
      float edge = 1.0 - smoothstep(0.0, fw*1.5 + 0.05, abs(bd + 0.35));
      float onTB = step(q.x, q.y);
      float br = mix(step(vHalf.y - 3.2, abs(vLoc.y)), step(vHalf.x - 3.2, abs(vLoc.x)), onTB);
      float fill = step(bd, 0.0);
      float rel = hailRel(vHail); vec3 hc = hailCol(vHail);
      float hl = max(vHov, vSelF);
      vec3 ec = mix(hc, uOrange, vSelF);
      vec3 c = hc*fill*(0.025 + 0.07*rel) + ec*edge*(0.12 + br*0.55 + hl*0.4);
      float k = vRev*mix(1.0, 0.45, uFocus*(1.0 - vSelF));
      gl_FragColor = vec4(c*k, 1.0);
    }`, hU);
  m.blending = THREE.AdditiveBlending;
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 2; scene.add(mesh); return mesh;
})();

// beacons: a thin light shaft from each roof up to its door number
const BEAM = 30; const beamK = () => Math.max(0.3, Math.min(1, rig.dist / 700));
const SMIN = Math.min(...HS.map(H => H.h.score)), SMAX = Math.max(...HS.map(H => H.h.score));
HS.forEach(H => { H.beam = 9 + (BEAM - 9) * (H.h.score - SMIN) / Math.max(1e-6, SMAX - SMIN); });
const beaconMesh = (() => {
  const pos = [], base = [], corner = [], id = [], tp = [], bh = [], idx = []; let vi = 0;
  HS.forEach(H => {
    const b = [H.c[0], H.spec.top + 0.8, H.c[1]];
    [[-1, 0], [1, 0], [1, 1], [-1, 1]].forEach(([x, y]) => { pos.push(...b); base.push(...b); corner.push(x, y); id.push(H.i); tp.push(TOP5(H.i) ? 1 : 0); bh.push(H.beam); });
    idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3); vi += 4;
  });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aBase', new THREE.Float32BufferAttribute(base, 3));
  g.setAttribute('aCorner', new THREE.Float32BufferAttribute(corner, 2)); g.setAttribute('aId', new THREE.Float32BufferAttribute(id, 1)); g.setAttribute('aTop5', new THREE.Float32BufferAttribute(tp, 1)); g.setAttribute('aBH', new THREE.Float32BufferAttribute(bh, 1)); g.setIndex(idx);
  const m = mat(/* glsl */`attribute vec3 aBase; attribute vec2 aCorner; attribute float aId; attribute float aTop5; attribute float aBH; uniform float uBeam; uniform float uRev[${N}]; uniform float uHov[${N}]; uniform float uVis[${N}]; uniform float uSel;
    varying vec2 vC; varying float vRev, vHov, vSelF, vT5, vVis;
    void main(){ int i = int(aId + 0.5); vRev = uRev[i]; vHov = uHov[i]; vVis = uVis[i]; vSelF = abs(aId - uSel) < 0.5 ? 1.0 : 0.0; vT5 = aTop5; vC = aCorner;
      vec3 toC = cameraPosition - aBase; vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toC));
      float d = length(toC); float hw = clamp(d*0.0016, 0.3, 1.6);
      vec3 p = aBase + right*aCorner.x*hw + vec3(0.0, aCorner.y*aBH*uBeam, 0.0);
      gl_Position = projectionMatrix*viewMatrix*vec4(p, 1.0); }`,
    /* glsl */`uniform float uFocus; varying vec2 vC; varying float vRev, vHov, vSelF, vT5, vVis;
    void main(){
      float core = exp(-vC.x*vC.x*5.0);
      float fall = mix(1.0, 0.25, vC.y);
      vec3 c = mix(uIce, uGold, vT5*0.85); c = mix(c, uDone, vVis*0.8*(1.0 - vSelF)); c = mix(c, uOrange, vSelF);
      float a = core*fall*(0.8 + vHov*0.5 + vSelF*0.6)*smoothstep(0.85, 1.0, vRev);
      a *= mix(1.0, 0.3, uFocus*(1.0 - vSelF));
      gl_FragColor = vec4(c, a);
    }`, hU);
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 8; mesh.frustumCulled = false; scene.add(mesh); return mesh;
})();

// ------------------------------------------------------------------ embers: slow motes of light rising off the best doors (top 8), seeded, never flowing "worms"
const emberMesh = (() => {
  let sd = 0x9e3779b9; const rnd = () => { sd |= 0; sd = sd + 0x6D2B79F5 | 0; let x = Math.imul(sd ^ sd >>> 15, 1 | sd); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
  const pos = [], sd4 = [], id = [];
  HS.forEach(H => { if (H.i >= 8) return; const n = Math.round(26 - H.i * 2.2);
    for (let k = 0; k < n; k++) { const a = rnd() * 6.2832, r = Math.sqrt(rnd()) * (H.spec.w * 0.55 + 2);
      pos.push(H.c[0] + Math.cos(a) * r, H.spec.top * 0.7, H.c[1] + Math.sin(a) * r); sd4.push(rnd(), rnd(), rnd(), 0.6 + rnd() * 0.8); id.push(H.i); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aS', new THREE.Float32BufferAttribute(sd4, 4)); g.setAttribute('aId', new THREE.Float32BufferAttribute(id, 1));
  const m = mat(/* glsl */`attribute vec4 aS; attribute float aId; uniform float uTime, uMotion, uFocus, uEmb; uniform float uRev[${N}]; uniform float uSel; uniform float uVis[${N}];
    varying float vA, vHot;
    void main(){ int i = int(aId + 0.5); float sel = abs(aId - uSel) < 0.5 ? 1.0 : 0.0;
      float ph = fract(aS.x + uTime*0.045*aS.w);
      float rise = ph*ph*34.0 + ph*8.0;
      vec3 p = position + vec3(sin(uTime*0.4*aS.w + aS.y*6.28)*1.4*ph, rise, cos(uTime*0.33*aS.w + aS.z*6.28)*1.4*ph);
      vec4 mv = viewMatrix*vec4(p, 1.0);
      float life = smoothstep(0.0, 0.12, ph)*(1.0 - smoothstep(0.55, 1.0, ph));
      vA = life*smoothstep(0.9, 1.0, uRev[i])*mix(1.0, 0.2, uFocus*(1.0 - sel))*(1.0 - uVis[i]*0.85)*uEmb*(0.55 + 0.45*aS.z);
      vHot = 1.0 - ph;
      gl_PointSize = clamp((2.0 + 2.6*aS.y)*(1000.0/-mv.z)*(1.0 + sel*0.4)*${PR.toFixed(1)}, 1.8, 9.0);
      gl_Position = projectionMatrix*mv; }`,
    /* glsl */`varying float vA, vHot;
    void main(){ vec2 q = gl_PointCoord - 0.5; float d = dot(q, q)*4.0; float k = exp(-d*3.2);
      vec3 c = mix(uOrange, uGold, 0.35 + 0.5*vHot); c = mix(c, uIce, k*k*0.5);
      gl_FragColor = vec4(c*k*vA*1.25, 1.0); }`, Object.assign({}, hU, { uEmb: { value: 1 } }));
  const mesh = new THREE.Points(g, m); mesh.renderOrder = 9; mesh.frustumCulled = false; scene.add(mesh); return mesh;
})();

// selection + hover rings, park marker
function ringMesh(size, colU, extraFS) {
  const g = new THREE.PlaneGeometry(size, size); g.rotateX(-Math.PI / 2);
  const m = mat(/* glsl */`varying vec2 vL; void main(){ vL = position.xz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    /* glsl */`uniform float uAmt, uRad; uniform vec3 uCol; varying vec2 vL;
    void main(){ float r = length(vL); float a = atan(vL.y, vL.x); vec3 c = vec3(0.0); ${extraFS} gl_FragColor = vec4(c*uAmt, 1.0); }`,
    { uAmt: { value: 0 }, uRad: { value: 14 }, uCol: { value: colU } });
  const mesh = new THREE.Mesh(g, m); mesh.position.y = 0.45; mesh.renderOrder = 3; scene.add(mesh); return mesh;
}
const selRing = ringMesh(80, U.uOrange.value, /* glsl */`
  float rot = uTime*0.35*uMotion;
  c += uCol*lineAA(r - uRad, 0.55)*step(fract((a + rot)/6.2831853*28.0), 0.58);
  c += uIce*lineAA(r - (uRad - 1.8), 0.22)*0.55;
  float tk = step(abs(fract((a - rot*0.5)/6.2831853*4.0 + 0.5) - 0.5), 0.004*40.0/uRad)*step(uRad + 1.5, r)*step(r, uRad + 5.0);
  c += uCol*tk*1.2;
  c += uCol*exp(-r*r/(uRad*uRad*0.8))*0.06;`);
const hovRing = ringMesh(60, U.uCyan.value, /* glsl */`c += uCol*lineAA(r - uRad, 0.4)*0.9 + uCol*exp(-pow((r - uRad)/2.5, 2.0))*0.12;`);
const parkRing = (() => {
  const m = ringMesh(46, U.uOrange.value, /* glsl */`
    c += uCol*lineAA(r - 6.0, 0.6)*0.95 + uCol*lineAA(r - 9.5, 0.3)*0.5;
    float ph = fract(uTime/3.2); float pr = 6.0 + ph*14.0;
    c += uCol*lineAA(r - pr, 0.5)*(1.0 - ph)*0.8*uMotion;
    c += uCol*exp(-r*r/30.0)*0.25;`);
  m.position.set(D.park[0], 0.5, D.park[1]); m.material.uniforms.uAmt.value = CALM ? 1 : 0; return m;
})();

// ------------------------------------------------------------------ final grade: soft chromatic aberration, scanlines, vignette, grain
const holoPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(innerWidth, innerHeight) }, uPR: { value: PR }, uTime: { value: 0 }, uMotion: { value: MOTION }, uCA: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: /* glsl */`uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uPR, uTime, uMotion, uCA; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)))*43758.5453); }
    void main(){
      vec2 d = vUv - 0.5; float l = length(d*vec2(uRes.x/uRes.y, 1.0));
      vec2 off = d*(0.0022 + 0.006*l*l)*uCA;
      vec3 c; c.r = texture2D(tDiffuse, vUv + off).r; c.g = texture2D(tDiffuse, vUv).g; c.b = texture2D(tDiffuse, vUv - off).b;
      float y = gl_FragCoord.y/uPR;
      c *= 0.955 + 0.045*sin(y*3.14159*0.72);
      float band = fract(vUv.y*0.6 - uTime*0.05);
      c *= 1.0 + 0.035*smoothstep(0.0, 0.04, band)*(1.0 - smoothstep(0.04, 0.16, band))*uMotion;
      float lum = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(c, c*vec3(1.06, 0.97, 0.86), smoothstep(0.02, 0.5, lum)*0.6); // warm glass
      c += vec3(0.012, 0.008, 0.004)*(1.0 - smoothstep(0.0, 0.08, lum)); // graphite floor
      c *= mix(1.0, 0.5, smoothstep(0.42, 1.05, l));
      c += (hash(gl_FragCoord.xy + floor(uTime*24.0)*uMotion) - 0.5)*0.012;
      gl_FragColor = vec4(c, 1.0);
    }` });
composer.addPass(holoPass);
composer.addPass(new OutputPass());

// ------------------------------------------------------------------ camera rig (target + spherical), tweened flights + critically damped springs
const OVER = { t: new THREE.Vector3(4, 0, 12), az: -0.34, el: 0.68, dist: 660 };
const INTRO = { t: new THREE.Vector3(0, 20, 0), az: -1.2, el: 0.34, dist: 1250 };
const rig = { t: new THREE.Vector3(), az: 0, el: 0, dist: 0 };
const goal = { t: new THREE.Vector3(), az: 0, el: 0, dist: 0 };
const vel = { t: new THREE.Vector3(), az: 0, el: 0, dist: 0 };
let tween = null; let omega = 5;
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const copyPose = (dst, src) => { dst.t.copy(src.t); dst.az = src.az; dst.el = src.el; dst.dist = src.dist; };
const easeIO = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
function setPose(p) { copyPose(rig, p); copyPose(goal, p); vel.t.set(0, 0, 0); vel.az = vel.el = vel.dist = 0; tween = null; }
function flyTo(p, dur = 1.35) {
  if (RM || STILL || dur <= 0) { setPose(p); return; }
  const from = { t: rig.t.clone(), az: rig.az, el: rig.el, dist: rig.dist };
  const to = { t: p.t.clone(), az: from.az + wrapA(p.az - from.az), el: p.el, dist: p.dist };
  const travel = from.t.distanceTo(to.t);
  tween = { from, to, k: 0, dur, bump: Math.min(140, travel * 0.35) };
  copyPose(goal, to); vel.t.set(0, 0, 0); vel.az = vel.el = vel.dist = 0;
}
function housePose(i) {
  const H = HS[i]; const fa = Math.atan2(H.f[0], H.f[1]);
  const az = OVER.az + Math.max(-0.55, Math.min(0.55, wrapA(fa - OVER.az)));
  return { t: new THREE.Vector3(H.c[0], H.spec.top * 0.42, H.c[1]), az, el: 0.52, dist: 128 };
}
function stepCam(dt) {
  if (tween) {
    tween.k = Math.min(1, tween.k + dt / tween.dur); const e = easeIO(tween.k); const { from, to } = tween;
    rig.t.lerpVectors(from.t, to.t, e); rig.az = from.az + (to.az - from.az) * e; rig.el = from.el + (to.el - from.el) * e;
    rig.dist = Math.exp(Math.log(from.dist) + (Math.log(to.dist) - Math.log(from.dist)) * e) + Math.sin(Math.PI * e) * tween.bump;
    if (tween.k >= 1) { tween = null; copyPose(goal, rig); }
  } else { // critically damped spring toward goal
    // exact critically damped step (stable for any dt, so a frame hitch can never fling the camera)
    const w = omega, e = Math.exp(-w * dt);
    const sp = (x, g, v) => { const d = x - g, c = v + w * d; return [g + (d + c * dt) * e, (v - w * c * dt) * e]; };
    ['x', 'y', 'z'].forEach(c => { const [x, v] = sp(rig.t[c], goal.t[c], vel.t[c]); rig.t[c] = x; vel.t[c] = v; });
    const gaz = rig.az + wrapA(goal.az - rig.az);
    [rig.az, vel.az] = sp(rig.az, gaz, vel.az); [rig.el, vel.el] = sp(rig.el, goal.el, vel.el); [rig.dist, vel.dist] = sp(rig.dist, goal.dist, vel.dist);
  }
  const ce = Math.cos(rig.el);
  camera.position.set(rig.t.x + rig.dist * ce * Math.sin(rig.az), rig.t.y + rig.dist * Math.sin(rig.el), rig.t.z + rig.dist * ce * Math.cos(rig.az));
  camera.lookAt(rig.t);
}
// view offset: keep the subject centred in the space between the panels
const vo = { x: 0, gx: 0 };
function voGoal() {
  const W = innerWidth, cs = getComputedStyle(document.documentElement);
  const g = parseFloat(cs.getPropertyValue('--g')) || 16;
  const hud = $('hud').getBoundingClientRect(); const left = hud.right + g * 0.5;
  const right = document.body.classList.contains('card-open') ? W - $('card').offsetWidth - g * 1.5 : W - g;
  vo.gx = W / 2 - (left + right) / 2;
}
function applyVO() { camera.setViewOffset(innerWidth, innerHeight, vo.x, 0, innerWidth, innerHeight); }

// ------------------------------------------------------------------ labels (DOM, projected each frame)
const labelsEl = $('labels');
const mkb = (cls, html) => { const el = document.createElement('div'); el.className = 'lb bd'; el.innerHTML = `<div class="${cls}">${html}</div>`; labelsEl.appendChild(el); return el; };
const mk = (cls, html) => { const el = document.createElement('div'); el.className = 'lb'; el.innerHTML = `<div class="${cls}">${html}</div>`; labelsEl.appendChild(el); return el; };
const badges = HS.map(H => { const el = mkb('bdg' + (TOP5(H.i) ? ' top5' : '') + (CALM ? '' : ' pre'), String(H.i + 1)); el.dataset.i = H.i; return el; });
const streetEls = D.streetLabels.map(l => ({ l, el: mk('st' + (l.walk ? ' w' : ''), '') }));
const contourEls = D.contourLabels.map(c => ({ c, el: mk('ctr', `${f2(c.L)}″`) }));
const parkEl = mk('pk', '<b>P</b><span></span>');
const cometEl = mk('comet', ''); cometEl.classList.add('off');
const rimEls = [0, 1, 2, 3].map(k => ({ k, el: mk('rim' + (k === 0 ? ' n' : ''), '') }));
const rimText = mk('rim t', ''); const stormEl = D.stormTrack ? mk('stm', '') : null;
[...rimEls.map(r => r.el), rimText, stormEl].forEach(el => el && el.classList.add('far'));
const V3 = new THREE.Vector3();
function proj(x, y, z) { V3.set(x, y, z).project(camera); return [(V3.x * 0.5 + 0.5) * innerWidth, (-V3.y * 0.5 + 0.5) * innerHeight, V3.z]; }
const place = (el, p, extra = '') => { if (p[2] > 1 || p[0] < -80 || p[0] > innerWidth + 80 || p[1] < 66 || p[1] > innerHeight + 40) { el.classList.add('off'); return false; } el.classList.remove('off'); el.style.transform = `translate3d(${p[0].toFixed(1)}px,${p[1].toFixed(1)}px,0)${extra}`; return true; };
function placeAlong(el, a, b, y) { // rotated label along a ground segment
  const pa = proj(a[0], y, a[1]), pb = proj(b[0], y, b[1]); const m = proj((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2);
  let ang = Math.atan2(pb[1] - pa[1], pb[0] - pa[0]) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
  place(el, m, ` rotate(${ang.toFixed(1)}deg) translate(-50%,-50%)`);
}
function placeLabels() {
  const lastBadge = [];
  const bk = U.uBeam.value; HS.forEach((H, i) => { const p = proj(H.c[0], H.spec.top + 0.8 + H.beam * bk, H.c[1]); place(badges[i], p); lastBadge[i] = p; });
  const pp = proj(D.park[0], 0.5, D.park[1]); place(parkEl, pp, ' translate(-18px,-30px)');
  const blocks = lastBadge.filter(p => p[2] < 1).map(p => [p[0] - 16, p[1] - 24, p[0] + 16, p[1] + 2]); blocks.push([pp[0] - 70, pp[1] - 46, pp[0] + 40, pp[1] - 14]);
  const hit = (x, y, rx, ry) => blocks.some(b => x + rx > b[0] && x - rx < b[2] && y + ry > b[1] && y - ry < b[3]);
  streetEls.forEach(({ l, el }) => { placeAlong(el, l.a, l.b, 0.2); const m = proj((l.a[0] + l.b[0]) / 2, 0.2, (l.a[1] + l.b[1]) / 2); el.classList.toggle('hid', hit(m[0], m[1], 34, 8)); });
  contourEls.forEach(({ c, el }) => { const p = proj(c.p[0], 0.3, c.p[1]); place(el, p); el.classList.toggle('hid', hit(p[0], p[1], 22, 9)); });
  const rr = R + 46; [[0, -rr], [rr, 0], [0, rr], [-rr, 0]].forEach((q, k) => place(rimEls[k].el, proj(q[0], 0, q[1])));
  const ta = -0.62; place(rimText, proj(Math.cos(ta) * (R + 46), 0, Math.sin(ta) * (R + 46)));
  if (stormEl) { const p = D.stormTrack.parts[0]; const a = p[0], b = p[1]; const u = 0.18; const s = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; const s2 = [a[0] + (b[0] - a[0]) * (u + 0.1), a[1] + (b[1] - a[1]) * (u + 0.1)]; placeAlong(stormEl, s, s2, 0.3); stormEl.firstChild.style.transform = 'translateY(-16px)'; }
  if (tour.on && !tour.paused || tour.on) { const q = D.pointAt(tour.head); place(cometEl, proj(q.p[0], 0.8, q.p[1])); } else cometEl.classList.add('off');
  return lastBadge;
}

// ------------------------------------------------------------------ UI: HUD, card, strip, tag, readout
let sel = -1, hoverI = -1;
const skipped = new Set();
const tour = { on: false, paused: false, leg: 0, phase: 'move', t: 0, dur: 1, d0: 0, d1: 0, head: -1e4, visited: new Set(), done: false };
const ICON = {
  play: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.8v8.4L10 6z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 2h2.2v8H3zM6.8 2H9v8H6.8z" fill="currentColor"/></svg>',
  stop: '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2.5" y="2.5" width="7" height="7" rx="1" fill="currentColor"/></svg>',
  l: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 3 4.5 7l4 4"/></svg>',
  r: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 3l4 4-4 4"/></svg>',
  x: '<svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7"/></svg>',
};
function renderStatic() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
  document.querySelectorAll('#langseg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  $('langseg').setAttribute('aria-label', t('lang'));
  $('zname').textContent = ZONE;
  canvas.setAttribute('aria-label', t('aria_canvas'));
  $('hud').setAttribute('aria-label', t('aria_walk')); $('card').setAttribute('aria-label', t('aria_card')); $('strip').setAttribute('aria-label', t('aria_doors'));
  const C = NL.pick.center;
  $('tele').innerHTML = `<span class="hide-s"><b>${C.lat.toFixed(3)}°</b> N · <b>${Math.abs(C.lon).toFixed(3)}°</b> W</span><span class="sb"><i id="sbar" style="width:40px"></i><b id="sbarT">200 ft</b></span>`;
  parkEl.querySelector('span').textContent = t('park');
  streetEls.forEach(({ l, el }) => { el.firstChild.textContent = l.n; });
  rimEls.forEach(({ k, el }) => { el.firstChild.textContent = t('compass')[k]; });
  rimText.firstChild.textContent = `${NL.city || 'Fremont'} NE · ${ZONE}`;
  if (stormEl) stormEl.firstChild.textContent = `${t('lg_storm', { d: stormDay() })} · ${stormTime()} ▸`;
  renderHud(); renderStrip(); if (sel >= 0) renderCard(); updateBack(); renderTag(); renderReadout();
}
function renderHud() {
  const upto = f2(D.hailMax);
  $('hud').innerHTML = `
    <div class="eyebrow"><span class="or">${t('pick')}</span><span>${t('score')} <b style="color:var(--text)">${NL.pick.score}</b></span></div>
    <h1>${esc(ZONE_NB)}</h1>
    <div class="sub">${t('sub', { mi: NL.pick.dist_mi })}</div>
    <div class="kv">
      <div><div class="k">${t('k_storm')}</div><div class="v">${stormDay()}</div><div class="s">${stormTime()}</div></div>
      <div><div class="k">${t('k_hail')}</div><div class="v hail">${(+NL.pick.hail_in).toFixed(1)}<small>in</small></div><div class="s">${t('hail_upto', { v: upto })}</div></div>
      <div><div class="k">${t('k_doors')}</div><div class="v">${N}</div><div class="s">${t('walk_mi', { mi: mi(D.lastDoorD) })}</div></div>
      <div><div class="k">${t('k_best')}</div><div class="v">${bestTime()}<small>${t('pm')}</small></div><div class="s">${NL.pick.best_time.start}–${NL.pick.best_time.end}</div></div>
    </div>
    <p class="why0">${esc(NL.pick.why[lang])}</p>
    <button class="go" id="goBtn" type="button"><span>${ICON.play}${t('start_at', { i: 1 })}</span><span class="n">${N} · ${mi(D.lastDoorD)} mi</span></button>
    <div class="go2"><button type="button" id="pauseBtn" class="p"></button><button type="button" id="stopBtn">${ICON.stop}${t('stop')}</button></div>
    <div class="prog"><div class="eyebrow"><span class="hi">${t('prog')}</span><span id="progN"></span></div>
      <div class="bar"><i id="progBar"></i>${Array.from({ length: N - 1 }, (_, k) => `<em style="left:${((k + 1) / N * 100).toFixed(2)}%"></em>`).join('')}</div>
      <div class="t"><span id="progA"></span><span id="progB"></span></div></div>
    <div class="legend">
      <div class="hs"><div class="hk"><span>${t('lg_scale')}</span><span class="rk"><i></i>${t('lg_range')} ${f2(D.hailMin)}–${f2(D.hailMax)}″</span></div>
        <div class="gr2"><span class="rg" style="left:${legPct(D.hailMin)}%;width:${Math.max(1.5, legPct(D.hailMax) - legPct(D.hailMin))}%"></span></div>
        <div class="tk">${[[0.75, '&lt;1″'], [1.0, '1″'], [1.5, '1.5″'], [2.0, '2″+']].map(([v, l]) => `<span style="left:${legPct(v)}%">${l}</span>`).join('')}</div></div>
      <div class="hs"><div class="hk">${t('lg_states')}</div>
        <div class="stl"><span class="s nx">${t('st_next')}</span><span class="s dn">${t('st_done')}</span><span class="s sk">${t('st_skip')}</span><span class="s tp">${t('st_top')}</span><span class="s se">${t('st_sel')}</span></div></div>
      <div class="l"><span class="bm">7</span><span>${t('lg_door')}</span></div>
      <div class="l"><svg class="bh" viewBox="0 0 20 16" aria-hidden="true"><path d="M4 16V9M10 16V2M16 16V11" stroke="#fff0d2" stroke-width="1.6" stroke-linecap="round"/><circle cx="10" cy="2" r="1.6" fill="#ffd27a"/></svg><span>${t('lg_beam')}</span></div>
      <div class="l"><span class="wk"></span><span>${t('lg_path')}</span></div>
      ${D.stormTrack ? `<div class="l"><span class="sm"></span><span>${t('lg_storm', { d: stormDay() })}</span></div>` : ''}
    </div>
    <div class="src">${t('src')}</div>`;
  $('goBtn').onclick = () => startTour();
  $('pauseBtn').onclick = () => togglePause();
  $('stopBtn').onclick = () => stopTour(true);
  updateTourUI();
}
function renderStrip() {
  const rmax = 30;
  $('strip').innerHTML = `<div class="grp"><div class="gl"><b>${t('strip')}</b><span>${t('strip_k')}</span></div>
    <div class="chipsd">${HS.map(H => { const hc = hailCSS(H.h.hail); return `<button type="button" class="dc${TOP5(H.i) ? ' t5' : ''}" data-i="${H.i}" aria-label="${esc(t('door_n', { i: H.i + 1 }) + ', ' + H.h.addr)}"><span class="sb" style="height:${Math.round(6 + 22 * Math.min(1, H.h.roof / rmax))}px"></span><span class="hb" style="background:${hc};box-shadow:0 0 6px ${hc}"></span><b>${H.i + 1}</b></button>`; }).join('')}</div></div>
    <div class="sum"><b>${t('strip_sum', { n: N, mi: mi(D.lastDoorD) })}</b><span>${t('strip_sum2', { t: bestTime() + ' ' + t('pm') })}</span></div>`;
  $('strip').querySelectorAll('.dc').forEach(b => {
    b.onclick = () => selectDoor(+b.dataset.i, { fromUser: true });
    b.onmouseenter = () => setHover(+b.dataset.i); b.onmouseleave = () => setHover(-1);
  });
  updateStrip();
}
const HAIL_STOPS = [[0.75, '#2fa8ff'], [0.9, '#2de0c0'], [1.0, '#ffe14d'], [1.5, '#ff8a2a'], [1.75, '#ff3b4f'], [2.0, '#ff3bd0']];
const LEG_LO = 0.75, LEG_HI = 2.25, legPct = v => ((Math.max(LEG_LO, Math.min(LEG_HI, v)) - LEG_LO) / (LEG_HI - LEG_LO) * 100).toFixed(1);
function hailCSS(v) {
  const hx = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
  if (v <= HAIL_STOPS[0][0]) return HAIL_STOPS[0][1];
  for (let k = 1; k < HAIL_STOPS.length; k++) { const [b, cb] = HAIL_STOPS[k], [a, ca] = HAIL_STOPS[k - 1]; if (v <= b) { const u = (v - a) / (b - a), A = hx(ca), B = hx(cb); return `rgb(${A.map((x, i) => Math.round(x + (B[i] - x) * u)).join(',')})`; } }
  return HAIL_STOPS[HAIL_STOPS.length - 1][1];
}
const fmtD = m => { const f = m * M2FT; return f >= 1000 ? `${(f / 5280).toFixed(2)} mi` : `${Math.max(10, Math.round(f / 10) * 10)} ${t('ft')}`; };
const legM = (a, b) => Math.abs(D.doorD[b] - (a < 0 ? 0 : D.doorD[a])); // along the walk path, meters
function nextAfter(i) { for (let j = i + 1; j < N; j++) if (!skipped.has(j) && !tour.visited.has(j)) return j; return -1; }
function nextIdx() { // the ONE door the salesman should go to next
  if (tour.on) return tour.leg;
  if (sel >= 0) { for (let j = sel + 1; j < N; j++) if (!skipped.has(j)) return j; return -1; }
  return nextAfter(-1);
}
function renderNM() {
  const el = $('nm'); if (!el) return; let k = 'go', title, sub, act = null;
  const nx = nextIdx();
  if (tour.on) {
    const i = tour.leg, H = HS[i];
    if (tour.paused) { k = 'pz'; title = t('nm_knock', { i: i + 1 }); sub = t('nm_paused'); act = () => togglePause(); }
    else if (tour.phase === 'move') { title = t('nm_walkto', { i: i + 1, d: fmtD(legM(i - 1, i)) }); sub = esc(H.h.addr); }
    else { k = 'kn'; const j = nextAfter(i); title = t('nm_knock', { i: i + 1 }); sub = j >= 0 ? t('nm_then', { a: esc(H.h.addr), j: j + 1, d: fmtD(legM(i, j)) }) : t('nm_lastsub', { a: esc(H.h.addr) }); }
  } else if (tour.done && sel < 0) { k = 'dn'; title = t('nm_done'); sub = t('nm_done_sub', { n: tour.visited.size, s: skipped.size }); act = () => $('back').click(); }
  else if (sel >= 0) {
    if (nx >= 0) { title = t('nm_next', { i: nx + 1, d: fmtD(legM(sel, nx)) }); sub = esc(HS[nx].h.addr); act = () => selectDoor(nx, { fromUser: true }); }
    else { k = 'dn'; title = t('nm_last'); sub = esc(HS[sel].h.addr); act = () => closeCard(); }
  } else if (nx >= 0) { title = t('nm_start', { i: nx + 1 }); sub = t('nm_from_car', { a: esc(HS[nx].h.addr), d: fmtD(legM(-1, nx)) }); act = () => nx === 0 ? startTour() : selectDoor(nx, { fromUser: true }); }
  else { k = 'dn'; title = t('nm_done'); sub = t('nm_done_sub', { n: tour.visited.size, s: skipped.size }); act = () => $('back').click(); }
  const html = `<span class="e"><i></i>${t('nm')}</span><span class="t">${title}</span><span class="s">${sub}</span>${act ? `<span class="ar">${ICON.r}</span>` : ''}`;
  if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; }
  el.className = 'ui ' + k + (act ? ' act' : ''); el.onclick = act; el.disabled = !act;
}
function updateStrip() {
  const nx = nextIdx();
  $('strip').querySelectorAll('.dc').forEach(b => { const i = +b.dataset.i; b.classList.toggle('sel', i === sel); b.classList.toggle('vis', tour.visited.has(i)); b.classList.toggle('hov', i === hoverI); b.classList.toggle('skp', skipped.has(i)); b.classList.toggle('nxt', i === nx && i !== sel); });
  badges.forEach((el, i) => { const c = el.firstChild; c.classList.toggle('sel', i === sel); c.classList.toggle('vis', tour.visited.has(i) && i !== sel); c.classList.toggle('hov', i === hoverI && i !== sel); c.classList.toggle('dim', sel >= 0 && i !== sel && i !== hoverI && i !== nx); c.classList.toggle('skp', skipped.has(i) && i !== sel); c.classList.toggle('nxt', i === nx && i !== sel); });
  renderNM();
}
function whyHTML(H) {
  const h = H.h, hr = hailRank[H.i], r = h.roof, y = h.built;
  const hs = `<b>${f2(h.hail)}″</b>`;
  if (lang === 'es') {
    let s = `El radar marca granizo de ${hs} aquí el ${stormDay()}${hr <= 8 ? ` (#${hr} de ${N} en esta caminata)` : ''}. `;
    s += r <= 12 ? `El techo es más nuevo (unos <b>${r} años</b>) en una casa de ${y}` : `El techo tiene unos <b>${r} años</b> en una casa de ${y}`;
    s += h.own ? ' y aquí vive el dueño. ' : '; el dueño no vive aquí, por eso queda más abajo. ';
    s += `Puntaje ${h.score.toFixed(1)}: puerta ${H.i + 1} de ${N}.`; return s;
  }
  let s = `Radar shows ${hs} hail here on ${stormDay()}${hr <= 8 ? ` (#${hr} of ${N} on this walk)` : ''}. `;
  s += r <= 12 ? `The roof is newer (about <b>${r} years</b>) on a ${y} house` : `The roof is about <b>${r} years</b> old on a ${y} house`;
  s += h.own ? ', and the owner lives here. ' : '; the owner doesn\'t live here, so it ranks lower. ';
  s += `Score ${h.score.toFixed(1)}: door ${H.i + 1} of ${N}.`; return s;
}
function chipsHTML(H) {
  const h = H.h, hr = hailRank[H.i]; const c = [];
  c.push(`<span class="chip w">${f2(h.hail)}″ ${lang === 'es' ? 'granizo' : 'hail'}${hr <= 8 ? ` · #${hr}` : ''}</span>`);
  c.push(`<span class="chip">${lang === 'es' ? `techo de ${h.roof} años` : `${h.roof}-yr roof`}</span>`);
  c.push(`<span class="chip m">${lang === 'es' ? `casa de ${h.built}` : `built ${h.built}`}</span>`);
  c.push(h.own ? `<span class="chip o">${t('f_own')}</span>` : `<span class="chip m">${t('rd_rent')}</span>`);
  return c.join('');
}
function renderCard() {
  if (sel < 0) return; const H = HS[sel], h = H.h;
  const hp = ((h.hail - D.hailMin) / Math.max(1e-3, D.hailMax - D.hailMin) * 100).toFixed(1);
  const rp = Math.min(100, h.roof / 30 * 100).toFixed(1);
  const fromCar = Math.hypot(H.door[0] - D.park[0], H.door[1] - D.park[1]) * M2FT;
  const ft = fromCar >= 1000 ? `${(fromCar / 5280).toFixed(2)} mi` : `${Math.round(fromCar / 10) * 10} ${lang === 'es' ? 'pies' : 'ft'}`;
  const nxi = tour.on ? (sel < N - 1 ? sel + 1 : -1) : nextIdx(); const pv = sel > 0 ? HS[sel - 1] : null, nx = nxi >= 0 ? HS[nxi] : null;
  $('card').innerHTML = `
    <div class="chd"><div class="eyebrow"><b>${t('door_n', { i: sel + 1 })}</b><span class="smp">${t('sample_home')}</span></div><button class="x" type="button" id="cardX" aria-label="${t('close')}">${ICON.x}</button></div>
    <div class="big">
      <div class="hail"><div class="k">${t('hail_size')}</div><div class="v">${f2(h.hail)}<small class="in">"</small></div>
        <div class="meter h"><i style="left:${hp}%"></i></div><div class="ms"><span>${t('walk_low')} ${f2(D.hailMin)}</span><span>${t('walk_high')} ${f2(D.hailMax)}</span></div>
        <div class="d">${t('hail_sub', { d: stormDay(), obj: hailObj(h.hail) })}</div></div>
      <div class="roof"><div class="k">${t('roof_age')}</div><div class="v">${h.roof}<small>${t('yrs')}</small></div>
        <div class="meter r"><span class="z" style="left:66.7%;width:16.6%"></span><i style="left:${rp}%"></i></div><div class="ms"><span>0</span><span>${t('shingle')}</span><span>30</span></div>
        <div class="d">${t('roof_sub', { y: h.built })}</div></div>
    </div>
    <div class="whyh"><div class="eyebrow"><span class="hi">${t('why')}</span></div><div class="eyebrow"><span>${t('score')} <b style="color:var(--text)">${h.score.toFixed(1)}</b></span></div></div>
    <div class="chips">${chipsHTML(H)}</div>
    <p class="why">${whyHTML(H)}</p>
    <div class="addr">${esc(h.addr)}</div><div class="addr2"><b style="color:var(--ice);font-weight:600">${t('door_of', { i: sel + 1, n: N })}</b> · ${t('city')}</div>
    <div class="facts">
      <div><div class="k">${t('f_built')}</div><div class="v">${h.built}</div></div>
      <div><div class="k">${t('f_own')}</div><div class="v">${h.own ? t('yes') : t('no')}</div></div>
      <div><div class="k">${t('f_score')}</div><div class="v">${h.score.toFixed(1)}</div></div>
      <div><div class="k">${t('f_from')}</div><div class="v">${ft}</div></div>
    </div>
    <div class="nav">
      <button type="button" id="prevBtn" ${pv ? '' : 'disabled'}><span class="t">${ICON.l}${t('prev')}</span><span class="a">${pv ? `${pv.i + 1} · ${esc(pv.h.addr)}` : '–'}</span></button>
      <button type="button" id="nextBtn" class="n" ${nx ? '' : 'disabled'}><span class="t">${nx ? t('next_door', { i: nx.i + 1 }) : t('next')}${ICON.r}</span><span class="a">${nx ? `${fmtD(legM(sel, nx.i))} · ${esc(nx.h.addr)}` : '–'}</span></button>
    </div>
    <div class="kb"><span>${t('kb')}</span><button type="button" id="skipBtn" class="skb${skipped.has(sel) ? ' on' : ''}">${skipped.has(sel) ? t('unskip') : t('skip')} <kbd>S</kbd></button></div>`;
  $('skipBtn').onclick = () => toggleSkip(sel);
  $('cardX').onclick = () => closeCard();
  $('prevBtn').onclick = () => step(-1); $('nextBtn').onclick = () => step(1);
}
function renderTag() {
  const el = $('tag'); if (hoverI < 0 || hoverI === sel) { el.classList.remove('on'); return; }
  const H = HS[hoverI];
  el.innerHTML = `<div class="k">${t('door_n', { i: hoverI + 1 })} · ${t('sample_home')}</div><div class="a">${esc(H.h.addr)}</div><div class="m">${t('tag_hail', { v: f2(H.h.hail), r: H.h.roof })}</div>`;
  el.classList.add('on');
}
function renderReadout() {
  const el = $('readout'); if (sel < 0) { el.classList.remove('on'); $('lead').classList.remove('on'); return; }
  const H = HS[sel], h = H.h; const hk = ((h.hail - 0.75) / (D.hailMax - 0.75 + 0.1) * 100).toFixed(0), rk = Math.min(100, h.roof / 30 * 100).toFixed(0), sk = Math.min(100, h.score / 50 * 100).toFixed(0);
  el.innerHTML = `<div class="h"><span>${t('rd_door')} <b>${String(sel + 1).padStart(2, '0')}</b>/${N}</span><span>${esc(h.st)}</span></div>
    <div class="r"><span>${t('rd_hail')}</span><span class="bar"><i class="w" style="width:${hk}%"></i></span><b>${f2(h.hail)}″</b></div>
    <div class="r"><span>${t('rd_roof')}</span><span class="bar"><i style="width:${rk}%"></i></span><b>${h.roof} ${t('yr')}</b></div>
    <div class="r"><span>${t('rd_score')}</span><span class="bar"><i style="width:${sk}%"></i></span><b>${h.score.toFixed(1)}</b></div>
    <div class="ft"><span>${t('rd_built')} <b>${h.built}</b></span><span>${h.own ? t('rd_own') : t('rd_rent')}</span></div>`;
  el.classList.add('on'); $('lead').classList.add('on');
}
function placeTagAndReadout(badgeP) {
  if (hoverI >= 0 && hoverI !== sel) {
    const H = HS[hoverI]; const p = proj(H.c[0], H.spec.top * 0.6, H.c[1]); const el = $('tag');
    const w = el.offsetWidth; let x = p[0] + 22, y = p[1] - 18; if (x + w > innerWidth - 20) x = p[0] - 22 - w;
    el.style.transform = `translate3d(${x.toFixed(0)}px,${y.toFixed(0)}px,0)`;
  }
  if (sel >= 0) {
    const H = HS[sel]; const p = proj(H.c[0], H.spec.top * 0.72, H.c[1]); const el = $('readout');
    const W = el.offsetWidth, Hh = el.offsetHeight;
    const hud = $('hud').getBoundingClientRect(); const cardL = document.body.classList.contains('card-open') ? $('card').getBoundingClientRect().left : innerWidth;
    let x = p[0] - W - 110, y = p[1] - Hh - 70; let side = -1;
    if (x < hud.right + 24) { x = p[0] + 110; side = 1; }
    if (x + W > cardL - 24) { x = Math.max(hud.right + 24, p[0] - W - 110); side = -1; }
    const nmB = $('nm') ? $('nm').offsetTop + $('nm').offsetHeight + 12 : 86; y = Math.max(nmB, Math.min(innerHeight - Hh - 130, y));
    el.style.transform = `translate3d(${x.toFixed(0)}px,${y.toFixed(0)}px,0)`;
    const ax = side < 0 ? x + W : x, ay = y + Hh; const ex = ax + (side < 0 ? 28 : -28);
    $('lead').querySelector('path').setAttribute('d', `M${p[0].toFixed(1)},${p[1].toFixed(1)} L${ex.toFixed(1)},${ay.toFixed(1)} L${ax.toFixed(1)},${ay.toFixed(1)}`);
    $('lead').querySelectorAll('circle').forEach(c => { c.setAttribute('cx', p[0].toFixed(1)); c.setAttribute('cy', p[1].toFixed(1)); });
  }
  void badgeP;
}
function updateBack() {
  const inner = sel >= 0 || tour.on; $('backT').textContent = inner ? t('back_over') : t('back_zones');
  $('back').querySelector('kbd').style.display = inner ? '' : 'none';
}
function updateTourUI() {
  const pb = $('pauseBtn'); if (!pb) return;
  pb.innerHTML = tour.paused ? `${ICON.play}${t('resume')}` : `${ICON.pause}${t('pause')}`;
  const v = tour.visited.size; $('progBar').style.width = `${(v / N * 100).toFixed(1)}%`;
  const walked = Math.max(0, Math.min(D.lastDoorD, tour.on || tour.done ? tour.head : 0));
  $('progN').textContent = `${v}/${N}`;
  $('progA').innerHTML = !tour.on && !tour.done ? t('prog_park') : tour.done ? t('prog_done', { n: N }) : tour.phase === 'move' ? t('prog_to', { i: tour.leg + 1 }) : t('prog_door', { i: tour.leg + 1, n: N });
  $('progB').innerHTML = t('prog_mi', { d: mi(walked), t: mi(D.lastDoorD) });
  renderNM();
}

// ------------------------------------------------------------------ selection, hover
const selAnim = { amt: 0, scan: -50, scanT: 99, lock: 1 };
function setHover(i) {
  if (i === hoverI) return; hoverI = i; document.body.classList.toggle('hovering', i >= 0); renderTag(); updateStrip();
}
function selectDoor(i, o = {}) {
  if (i < 0 || i >= N) return;
  if (o.fromUser && tour.on) { jumpTour(i); return; }
  const was = sel; sel = i; hU.uSel.value = i; document.body.classList.add('card-open');
  renderCard(); renderReadout(); updateStrip(); updateBack(); renderTag(); voGoal();
  if (was !== i) { selAnim.scanT = 0; selAnim.lock = CALM ? 1 : 0; }
  if (o.spring) { tween = null; copyPose(goal, housePose(i)); omega = RM ? 50 : 3.0; if (RM) setPose(housePose(i)); }
  else if (o.fly !== false) flyTo(housePose(i), o.dur ?? 1.35);
}
function toggleSkip(i) {
  if (i < 0) return; const on = !skipped.has(i); if (on) skipped.add(i); else skipped.delete(i);
  if (on) { toast(t('skipped_t', { i: i + 1 })); const j = nextIdx(); if (j >= 0 && !tour.on) { selectDoor(j, { fromUser: true }); return; } }
  renderCard(); updateStrip();
}
function closeCard(fly = true) {
  sel = -1; hU.uSel.value = -1; document.body.classList.remove('card-open'); renderReadout(); updateStrip(); updateBack(); voGoal();
  if (fly) flyTo(OVER, 1.4);
}
function step(d) { if (sel < 0) return; const nn = d > 0 && !tour.on ? nextIdx() : -1; const j = nn >= 0 ? nn : Math.max(0, Math.min(N - 1, sel + d)); if (j !== sel) selectDoor(j, { fromUser: true }); }

// ------------------------------------------------------------------ walk tour
const DWELL = 3.4;
const legDur = (a, b) => RM ? 0.01 : Math.max(1.3, Math.min(3.2, Math.abs(b - a) / 150));
function startTour() {
  if (RM) omega = 50;
  tour.on = true; tour.paused = false; tour.done = false; tour.leg = 0; tour.phase = 'move'; tour.t = 0; tour.d0 = 0; tour.d1 = D.doorD[0]; tour.dur = legDur(0, tour.d1); tour.head = 0; tour.visited.clear();
  pathU.uTour.value = 1; pathU.uProg.value = 0; document.body.classList.add('touring');
  selectDoor(0, { fly: false }); tween = null; omega = RM ? 50 : 2.6;
  updateTourUI(); updateStrip(); updateBack();
}
function stopTour(toOverview) {
  if (!tour.done) { tour.visited.clear(); tour.head = 0; }
  tour.on = false; tour.paused = false; pathU.uTour.value = 0; pathU.uProg.value = -1; pathU.uHead.value = -1e4; document.body.classList.remove('touring');
  omega = 5; if (toOverview) closeCard(true); updateTourUI(); updateStrip(); updateBack();
}
function togglePause() { if (!tour.on) return; tour.paused = !tour.paused; if (!tour.paused) { omega = RM ? 50 : 2.6; } updateTourUI(); }
function jumpTour(i) {
  tour.leg = i; tour.phase = 'dwell'; tour.t = 0; tour.head = D.doorD[i]; tour.visited = new Set(Array.from({ length: i + 1 }, (_, k) => k));
  pathU.uProg.value = tour.head; pathU.uHead.value = tour.head;
  const was = tour.on; tour.on = false; selectDoor(i, {}); tour.on = was; updateTourUI(); updateStrip();
}
function followPose(d) { const q = D.pointAt(d); return { t: new THREE.Vector3(q.p[0], 0, q.p[1]), az: OVER.az + 0.12, el: 0.72, dist: 330 }; }
function tourStep(dt) {
  if (!tour.on || tour.paused) return;
  tour.t += dt;
  if (tour.phase === 'move') {
    const k = Math.min(1, tour.t / tour.dur); tour.head = tour.d0 + (tour.d1 - tour.d0) * easeIO(k);
    pathU.uProg.value = tour.head; pathU.uHead.value = tour.head;
    if (RM) setPose(followPose(tour.head)); else { tween = null; copyPose(goal, followPose(tour.head)); }
    if (k >= 1) {
      tour.phase = 'dwell'; tour.t = 0; tour.visited.add(tour.leg);
      const was = tour.on; tour.on = false; selectDoor(tour.leg, { spring: true }); tour.on = was;
      updateTourUI(); updateStrip();
    }
  } else if (tour.t >= DWELL) {
    if (tour.leg >= N - 1) { tour.done = true; stopTour(false); toast(t('toast_done')); return; }
    tour.leg++; tour.phase = 'move'; tour.t = 0; tour.d0 = D.doorD[tour.leg - 1]; tour.d1 = D.doorD[tour.leg]; tour.dur = legDur(tour.d0, tour.d1);
    const was = tour.on; tour.on = false; selectDoor(tour.leg, { fly: false }); tour.on = was; tween = null; omega = RM ? 50 : 2.6;
    updateTourUI();
  }
  if (tour.phase === 'dwell' && Math.floor((tour.t - dt) * 4) !== Math.floor(tour.t * 4)) updateTourUI();
}
let toastT = 0;
function toast(msg) { const el = $('toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 3200); }

// ------------------------------------------------------------------ input: orbit/zoom/pan (own rig, so flights never fight the controls)
const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2(); let mouse = null, mouseDirty = false; let drag = null;
function userTakesCamera() { tween = null; copyPose(goal, rig); vel.t.set(0, 0, 0); vel.az = vel.el = vel.dist = 0; omega = 7; if (tour.on && !tour.paused) togglePause(); if (intro.on) finishIntro(); }
canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, moved: false, btn: e.button, shift: e.shiftKey }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => {
  mouse = [e.clientX, e.clientY]; mouseDirty = true;
  if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 4) return;
  if (!drag.moved) { drag.moved = true; userTakesCamera(); document.body.classList.add('dragging'); }
  drag.x = e.clientX; drag.y = e.clientY;
  if (drag.btn === 2 || drag.shift) { // pan on the ground plane
    const s = goal.dist * 0.0011; const ca = Math.cos(goal.az), sa = Math.sin(goal.az);
    goal.t.x -= (dx * ca - dy * sa) * s; goal.t.z -= (-dx * sa - dy * ca) * s * -1;
    const l = Math.hypot(goal.t.x, goal.t.z); if (l > R) { goal.t.x *= R / l; goal.t.z *= R / l; }
  } else { goal.az -= dx * 0.0052; goal.el = Math.max(0.16, Math.min(1.38, goal.el + dy * 0.0042)); }
});
const endDrag = e => {
  if (!drag) return; const d = drag; drag = null; document.body.classList.remove('dragging');
  try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* already released */ }
  if (!d.moved && d.btn === 0) { const i = pickHouse(e.clientX, e.clientY); if (i >= 0) selectDoor(i, { fromUser: true }); }
};
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('pointerleave', () => { mouse = null; setHover(-1); });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => { e.preventDefault(); if (!drag) { userTakesCamera(); } goal.dist = Math.max(45, Math.min(1700, goal.dist * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
function pickHouse(x, y) {
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const o = ray.ray.origin, d = ray.ray.direction; let best = -1, bt = Infinity;
  HS.forEach((H, i) => {
    const s = H.spec; const cs = Math.cos(H.yaw), sn = Math.sin(H.yaw);
    const lx = (o.x - H.c[0]) * cs - (o.z - H.c[1]) * sn, lz = (o.x - H.c[0]) * sn + (o.z - H.c[1]) * cs;
    const dx = d.x * cs - d.z * sn, dz = d.x * sn + d.z * cs;
    const b = H.bb, top = s.top + BEAM * 0.25;
    const mn = [b[0] - 1.5, 0, b[2] - 1.5], mx = [b[1] + 1.5, top, b[3] + 1.5], oo = [lx, o.y, lz], dd = [dx, d.y, dz];
    let t0 = 0, t1 = Infinity;
    for (let k = 0; k < 3; k++) { if (Math.abs(dd[k]) < 1e-9) { if (oo[k] < mn[k] || oo[k] > mx[k]) return; continue; } let a = (mn[k] - oo[k]) / dd[k], b = (mx[k] - oo[k]) / dd[k]; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return; }
    if (t0 < bt) { bt = t0; best = i; }
  });
  return best;
}
badges.forEach((el, i) => { const b = el.firstChild; b.addEventListener('pointerenter', () => setHover(i)); b.addEventListener('pointerleave', () => setHover(-1)); b.addEventListener('click', () => selectDoor(i, { fromUser: true })); });
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (tour.on) stopTour(true); else if (sel >= 0) closeCard(); }
  else if (e.key === 'ArrowRight' && sel >= 0) { e.preventDefault(); step(1); }
  else if (e.key === 'ArrowLeft' && sel >= 0) { e.preventDefault(); step(-1); }
  else if ((e.key === 's' || e.key === 'S') && sel >= 0 && !tour.on && !e.metaKey && !e.ctrlKey) { toggleSkip(sel); }
  else if (e.key === ' ' && tour.on && e.target === document.body) { e.preventDefault(); togglePause(); }
});
$('back').addEventListener('click', () => {
  if (tour.on) stopTour(true); else if (sel >= 0) closeCard();
  else { toast(t('toast_exit')); exitAnim = RM ? 1 : 0.0001; }
});
let exitAnim = 0;
document.querySelectorAll('#langseg button').forEach(b => b.addEventListener('click', () => { lang = b.dataset.lang; renderStatic(); }));

// ------------------------------------------------------------------ intro timeline
const intro = { on: !CALM, T: 0, t0: performance.now(), DUR: 4.6 };
const cl01 = x => Math.max(0, Math.min(1, x));
const easeOut = x => 1 - Math.pow(1 - x, 3);
function introStep() {
  intro.T = (performance.now() - intro.t0) / 1000; const T = intro.T;
  { const k = easeIO(cl01(T / 4.3)); const A = INTRO, B = OVER; rig.t.lerpVectors(A.t, B.t, k); rig.az = A.az + wrapA(B.az - A.az) * k; rig.el = A.el + (B.el - A.el) * k;
    rig.dist = Math.exp(Math.log(A.dist) + (Math.log(B.dist) - Math.log(A.dist)) * k); copyPose(goal, rig); tween = null; }
  U.uReveal.value = easeOut(cl01(T / 1.5)); U.uStreetRev.value = easeOut(cl01((T - 0.35) / 1.6)); U.uCtxRev.value = easeOut(cl01((T - 0.7) / 1.9));
  for (let i = 0; i < N; i++) hU.uRev.value[i] = easeOut(cl01((T - (1.05 + i * 0.055)) / 0.9));
  const dk = easeIO(cl01((T - 2.05) / 2.2)); pathU.uDraw.value = dk >= 1 ? 1e6 : dk * D.lastDoorD;
  badges.forEach((el, i) => el.firstChild.classList.toggle('pre', pathU.uDraw.value < D.doorD[i] - 1));
  parkRing.material.uniforms.uAmt.value = cl01((T - 1.9) / 0.5);
  labelsEl.style.setProperty('--lo', cl01((T - 1.7) / 0.9).toFixed(3));
  if (T > 2.5 && !document.body.classList.contains('ready')) document.body.classList.add('ready');
  $('intro').style.opacity = T < 3.1 ? 1 : 0;
  if (T >= intro.DUR) finishIntro();
}
function finishIntro() {
  if (!intro.on) return; intro.on = false;
  U.uReveal.value = U.uStreetRev.value = U.uCtxRev.value = 1; hU.uRev.value.fill(1); pathU.uDraw.value = 1e6; parkRing.material.uniforms.uAmt.value = 1;
  badges.forEach(el => el.firstChild.classList.remove('pre')); document.body.classList.add('ready'); $('intro').style.opacity = 0; labelsEl.style.setProperty('--lo', '1');
  if (HOUSE_Q) selectDoor(HOUSE_Q - 1, {});
}

// ------------------------------------------------------------------ boot
if (!CALM) labelsEl.style.setProperty('--lo', '0');
renderStatic();
$('intro').innerHTML = `${t('intro_a')}<b>${esc(ZONE)}</b><i></i>`;
if (CALM) {
  document.body.classList.add('ready'); $('intro').style.opacity = 0;
  setPose(OVER);
  if (HOUSE_Q) { sel = HOUSE_Q - 1; hU.uSel.value = sel; document.body.classList.add('card-open'); renderCard(); renderReadout(); updateStrip(); updateBack(); setPose(housePose(sel)); selAnim.amt = 1; }
} else {
  setPose(INTRO); intro.t0 = performance.now();
}
voGoal(); vo.x = vo.gx; applyVO();
let W0 = innerWidth, H0 = innerHeight;
function onResize() {
  W0 = innerWidth; H0 = innerHeight; camera.aspect = W0 / H0; renderer.setSize(W0, H0, false); composer.setSize(W0, H0); bloom.resolution.set(W0, H0);
  holoPass.uniforms.uRes.value.set(W0, H0); voGoal(); vo.x = vo.gx; applyVO(); camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);

// ------------------------------------------------------------------ frame loop
const DTMAX = Math.max(1 / 30, Math.min(0.5, +Q.get('dtmax') || 0)); // test hook: slow headless GPUs can pass ?dtmax=0.4
const clock = new THREE.Clock(); let simT = STILL ? 6.0 : 0; let sbarT = 0; let frameN = 0;
try { renderer.compile(scene, camera); } catch (_) { /* compile lazily */ }
function frame() {
  frameN++; if (frameN === 2 && intro.on) intro.t0 = performance.now();
  const dt = Math.min(DTMAX, clock.getDelta());
  if (!STILL) simT += dt;
  U.uTime.value = simT; holoPass.uniforms.uTime.value = simT;
  if (intro.on) introStep();
  tourStep(dt);
  if (exitAnim > 0) { exitAnim = Math.min(1, exitAnim + dt / 0.9); const k = 1 - exitAnim; U.uReveal.value = U.uStreetRev.value = U.uCtxRev.value = k; hU.uRev.value.fill(k); if (exitAnim >= 1) { exitAnim = 0; location.href = '../c/index.html'; } }
  // selection visuals
  const tgtFocus = sel >= 0 ? 1 : 0; U.uFocus.value += (tgtFocus - U.uFocus.value) * (CALM ? 1 : Math.min(1, dt * 5));
  selAnim.amt += ((sel >= 0 ? 1 : 0) - selAnim.amt) * (CALM ? 1 : Math.min(1, dt * 6));
  if (sel >= 0) { const H = HS[sel]; selRing.position.set(H.c[0], 0.45, H.c[1]); selAnim.lock = Math.min(1, selAnim.lock + dt / 0.7); const lk = 1 - Math.pow(1 - selAnim.lock, 3); selRing.material.uniforms.uRad.value = (Math.max(H.spec.w, H.spec.d) * 0.62 + 6) * (1 + 1.2 * (1 - lk)); }
  selRing.material.uniforms.uAmt.value = selAnim.amt;
  if (!CALM && selAnim.scanT < 1.4) { selAnim.scanT += dt; hU.uScanY.value = sel >= 0 ? -1 + (HS[sel].spec.top + 3) * (selAnim.scanT / 1.1) : -50; } else hU.uScanY.value = -50;
  for (let i = 0; i < N; i++) { const g = i === hoverI ? 1 : 0; hU.uHov.value[i] += (g - hU.uHov.value[i]) * (CALM ? 1 : Math.min(1, dt * 10)); hU.uVis.value[i] = tour.visited.has(i) ? 1 : 0; }
  if (hoverI >= 0 && hoverI !== sel) { const H = HS[hoverI]; hovRing.position.set(H.c[0], 0.45, H.c[1]); hovRing.material.uniforms.uRad.value = Math.max(H.spec.w, H.spec.d) * 0.6 + 4; }
  hovRing.material.uniforms.uAmt.value += (((hoverI >= 0 && hoverI !== sel) ? 1 : 0) - hovRing.material.uniforms.uAmt.value) * Math.min(1, dt * 10);
  // camera
  stepCam(dt);
  vo.x += (vo.gx - vo.x) * (CALM ? 1 : Math.min(1, dt * 4)); applyVO(); camera.updateMatrixWorld();
  bloom.strength = 0.42 + 0.3 * Math.min(1, Math.max(0, (rig.dist - 120) / 700));
  holoPass.uniforms.uCA.value = 0.6 + 0.4 * Math.min(1, rig.dist / 700);
  const near = 1 - Math.min(1, Math.max(0, (rig.dist - 140) / 380)); U.uNear.value = near; U.uTint.value = 1 - near * 0.7; U.uBeam.value = beamK();
  labelsEl.style.setProperty('--fo', (1 - Math.min(1, Math.max(0, (360 - rig.dist) / 140))).toFixed(3));
  // hover pick
  if (mouseDirty && mouse && !drag) { mouseDirty = false; const bEl = document.elementFromPoint(mouse[0], mouse[1]); if (bEl === canvas) setHover(pickHouse(mouse[0], mouse[1])); }
  composer.render();
  const bp = placeLabels(); placeTagAndReadout(bp);
  if ((sbarT += dt) > 0.25 || STILL) { sbarT = 0; const pxPerM = innerHeight / (2 * rig.dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))); const ft = [1000, 500, 200, 100, 50, 20, 10].find(f => f / M2FT * pxPerM <= 110) || 10; const el = $('sbar'); if (el) { el.style.width = `${(ft / M2FT * pxPerM).toFixed(0)}px`; $('sbarT').textContent = lang === 'es' ? `${ft} pies` : `${ft} ft`; } }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
