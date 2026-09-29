/* Aldaba · mockup D · the road hologram (window.createHolo).
   The walk's real streets + 3D hologram houses, drawn with raw WebGL2 (no libraries, no network).

   Borrowed techniques (sources):
   - Hologram shading = fresnel rim + drifting scan lines + additive glow + a rising "build" plane: the usual real-time
     recipe (e.g. Unity "Hologram shader" breakdowns; C Deck's own hologram pass in ../c/index.html).
   - Screen-space extruded, anti-aliased lines (instanced quads, capsule ends, perspective-corrected varyings):
     Matt DesLauriers, "Drawing Lines is Hard" https://mattdesl.svbtle.com/drawing-lines-is-hard
   - Anti-aliased grid / ground lines with fwidth(): Inigo Quilez, "filterable procedurals"
     https://iquilezles.org/articles/filterableprocedurals/
   - Additive light on a dark page with a transparent canvas (premultiplied alpha): Khronos WebGL best practices
     https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices
   - Camera: orbit (yaw/pitch/distance) with damping + eased tweens; animate only transform/opacity on DOM labels
     (Vercel Web Interface Guidelines https://vercel.com/design/guidelines).

   API: see the bottom of this file (createHolo). Homes are FAKE samples; no owner names anywhere. */
(function () {
'use strict';

const TAU = Math.PI * 2, DEG = Math.PI / 180;
const FOV = 40 * DEG, PITCH3D = 49 * DEG, TZ = 2.0, ENTRY_YAW = -30 * DEG;          // camera: vertical fov, default pitch, target height (m)
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sat = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease3 = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut3 = t => 1 - Math.pow(1 - t, 3);
const now = () => performance.now() / 1000;

function hex(c) {
  let s = String(c || '').trim();
  if (s[0] === '#') s = s.slice(1);
  if (s.length === 3) s = s.split('').map(x => x + x).join('');
  const n = parseInt(s, 16);
  if (s.length !== 6 || isNaN(n)) return null;
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
const toHex = c => '#' + c.map(v => Math.round(sat(v) * 255).toString(16).padStart(2, '0')).join('');
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const HAIL = { dark: ['#f2c14e', '#f5883a', '#ff4f5a'].map(hex), light: ['#b98a10', '#cf5f12', '#c92d3b'].map(hex) };
function hailCol(pal, h) {
  const c = HAIL[pal];
  if (h == null || isNaN(h)) return c[1];
  if (h <= 1) return c[0];
  if (h < 1.5) return mix3(c[0], c[1], (h - 1) / 0.5);
  if (h < 2) return mix3(c[1], c[2], (h - 1.5) / 0.5);
  return c[2];
}
const PAL = {
  dark:  { cool: hex('#8fb8ff'), walk: hex('#f5883a'), hot: hex('#ffd9b8'), grid: hex('#8fb8ff'), ink: hex('#f1f2f4'), park: hex('#dfe8ff') },
  light: { cool: hex('#3b5fc9'), walk: hex('#b4540c'), hot: hex('#f5883a'), grid: hex('#18191c'), ink: hex('#18191c'), park: hex('#18191c') },
};

// street names: "22ND Street" / "22 St" -> "22 st" (match) and "22nd St" (display; CSS uppercases)
const norm = n => String(n || '').toLowerCase().replace(/\b(\d+)(st|nd|rd|th)\b/g, '$1')
  .replace(/\bstreet\b/g, 'st').replace(/\bavenue\b/g, 'ave').replace(/\bboulevard\b/g, 'blvd').replace(/\bdrive\b/g, 'dr')
  .replace(/\broad\b/g, 'rd').replace(/\blane\b/g, 'ln').replace(/\bcircle\b/g, 'cir').replace(/\bcourt\b/g, 'ct')
  .replace(/\bplace\b/g, 'pl').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const disp = n => String(n || '').toLowerCase().replace(/\bstreet\b/g, 'St').replace(/\bavenue\b/g, 'Ave')
  .replace(/\bboulevard\b/g, 'Blvd').replace(/\bdrive\b/g, 'Dr').replace(/\broad\b/g, 'Rd').replace(/\blane\b/g, 'Ln')
  .replace(/\bcircle\b/g, 'Cir').replace(/\bcourt\b/g, 'Ct').replace(/\bplace\b/g, 'Pl').replace(/\b([a-z])/g, m => m.toUpperCase());

function mulberry(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/* =============================== shaders =============================== */
const HDR = '#version 300 es\nprecision highp float;\n';

const GROUND_VS = HDR + `
layout(location=0) in vec2 aQ;
uniform mat4 uVP; uniform vec2 uC; uniform float uGR;
out vec2 vW;
void main(){ vW = uC + aQ*uGR; gl_Position = uVP*vec4(vW, 0.0, 1.0); }`;

const GROUND_FS = HDR + `
in vec2 vW; out vec4 o;
uniform vec2 uC, uPark; uniform float uFR, uT, uMotion, uLight, uRev, uRevOn;
uniform vec3 uGrid, uCool;
float gridL(vec2 p, float s){
  vec2 g = p/s; vec2 w = max(fwidth(g), vec2(1e-5));
  vec2 d = abs(fract(g - 0.5) - 0.5)/w;
  float l = 1.0 - min(min(d.x, d.y), 1.0);
  return l*(1.0 - smoothstep(0.05, 0.28, max(w.x, w.y)));
}
float h12(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)))*43758.5453); }
void main(){
  float r = length(vW - uC);
  float fade = 1.0 - smoothstep(uFR*0.22, uFR, r);
  float g = gridL(vW, 10.0)*0.45 + gridL(vW, 50.0);
  float rp = length(vW - uPark);
  float rev = mix(1.0, smoothstep(uRev + 2.0, uRev - 45.0, rp), uRevOn);
  float rim = uRevOn*exp(-pow((rp - uRev)/3.5, 2.0))*(1.0 - smoothstep(uFR*0.7, uFR*1.1, rp));
  float P = 7.5; float ph = mod(uT, P)/P;
  float ring = uMotion*exp(-pow((rp - ph*uFR*1.05)/8.0, 2.0))*(1.0 - ph)*smoothstep(0.0, 0.06, ph);
  float a; vec3 c = uGrid;
  if (uLight < 0.5) {
    a = (g*0.075*(1.0 + ring*2.2) + ring*0.012)*fade*rev;
    float f2 = 1.0 - smoothstep(0.0, uFR*0.95, r);
    vec3 col = c*a + uCool*rim*0.22 + vec3(0.016, 0.026, 0.046)*f2*f2*rev + (h12(gl_FragCoord.xy) - 0.5)/255.0;
    o = vec4(col, 0.0);
    return;
  }
  a = (g*0.07*(1.0 + ring*1.5) + ring*0.008)*fade*rev;
  vec3 col = mix(c, uCool, clamp(rim*0.3/(a + rim*0.3 + 1e-4), 0.0, 1.0));
  a += rim*0.3;
  o = vec4(col*a, a);
}`;

// capsule ribbons on the ground (streets + walk path)
const RIB_VS = HDR + `
layout(location=0) in vec4 aA;   // x, y, along (m), across (m)
layout(location=1) in vec4 aB;   // segLen, s0, walk, class
uniform mat4 uVP; uniform float uZ;
out vec2 vW; out float vT, vD, vWk; flat out float vLen, vS0, vCls;
void main(){ vW = aA.xy; vT = aA.z; vD = aA.w; vLen = aB.x; vS0 = aB.y; vWk = aB.z; vCls = aB.w; gl_Position = uVP*vec4(aA.xy, uZ, 1.0); }`;

const STREET_FS = HDR + `
in vec2 vW; in float vT, vD, vWk; flat in float vLen, vS0, vCls; out vec4 o;
uniform vec2 uC, uPark; uniform float uFR, uLight, uSA;
uniform vec3 uCool, uWalk;
void main(){
  float bey = max(max(-vT, vT - vLen), 0.0);
  float d = length(vec2(bey, vD));
  float px = max(fwidth(vD), 1e-3);
  float art = vCls < 1.5 ? 1.0 : 0.0;
  float rw = mix(4.2, 5.6, art);
  float cw = mix(0.2, 0.28, art);
  float lw = max(cw, px*0.6);
  float core = (1.0 - smoothstep(lw - px*0.5, lw + px*0.5, d))*min(1.0, cw/(px*0.6));
  float band = 1.0 - smoothstep(rw - max(0.35, px), rw + max(0.35, px), d);
  float glow = exp(-d*d/(rw*rw*2.4));
  float w = clamp(vWk, 0.0, 1.0);
  float r = length(vW - uC);
  float fade = 1.0 - smoothstep(uFR*0.28, uFR*0.98, r);
  vec3 c = mix(uCool, uWalk, w);
  float a;
  if (uLight < 0.5) a = mix(core*mix(0.3, 0.42, art) + band*0.04 + glow*0.02, core*0.9 + band*0.12 + glow*0.2, w);
  else a = mix(core*0.4 + band*0.05, core*0.85 + band*0.12 + glow*0.05, w);
  a *= mix(fade, 1.0, w*0.85)*uSA;
  o = vec4(c*a, a*uLight);
}`;

const PATH_FS = HDR + `
in vec2 vW; in float vT, vD, vWk; flat in float vLen, vS0, vCls; out vec4 o;
uniform float uLight, uDraw, uDrawing, uComet, uCometOn;
uniform vec3 uWalk, uHot;
void main(){
  float s = vS0 + clamp(vT, 0.0, vLen);
  if (s > uDraw) discard;
  float bey = max(max(-vT, vT - vLen), 0.0);
  float d = length(vec2(bey, vD));
  float px = max(fwidth(vD), 1e-3);
  float cw = 0.38, lw = max(cw, px*0.75);
  float core = (1.0 - smoothstep(lw - px*0.5, lw + px*0.5, d))*min(1.0, cw/(px*0.75));
  float glow = exp(-d*d/(2.0*1.25*1.25));
  float halo = exp(-d*d/(2.0*3.0*3.0));
  float dc = uComet - s;
  float cm = uCometOn*(exp(-dc*dc/(2.0*2.4*2.4)) + (dc > 0.0 ? exp(-dc/24.0)*0.45 : 0.0));
  float tip = uDrawing*exp(-pow((uDraw - s)/5.0, 2.0));
  vec3 c = mix(uWalk, uHot, clamp(cm*0.45 + tip*0.6 + core*0.12, 0.0, 1.0));
  float a;
  if (uLight < 0.5) a = core*(0.75 + cm*0.7 + tip) + glow*(0.2 + cm*0.55 + tip) + halo*(0.03 + cm*0.1 + tip*0.2);
  else a = min(1.0, core*(0.85 + cm*0.3) + glow*(0.12 + cm*0.35 + tip*0.4) + halo*(cm*0.12));
  o = vec4(c*a, a*uLight);
}`;

// the house mesh: local unit coords (x,y in [-.5,.5], z code 0 ground / 1 eave / 2 ridge) + face id (4,5 = roof)
const HOUSE_COMMON = `
layout(location=3) in vec4 iPos;    // x, y, angle, walk index (-1 filler)
layout(location=4) in vec4 iSize;   // w, d, wall h, roof h
layout(location=5) in vec4 iColD;   // dark rgb, glow
layout(location=6) in vec4 iColL;   // light rgb, seed
layout(location=7) in vec4 iAnim;   // build start, build dur, path arrival s, kind (1 walk)
uniform mat4 uVP; uniform float uA, uLight, uSel, uHov, uMir, uDraw, uFR; uniform vec2 uC;
vec3 hl(vec4 a, vec4 s){
  bool roof = a.w > 3.5 && a.w < 5.5;
  float ox = roof ? 0.35 : 0.0, oy = roof ? 0.5 : 0.0;
  float x = a.x*s.x + sign(a.x)*ox, y, z;
  if (a.z < 0.5) { y = a.y*s.y; z = 0.0; }
  else if (a.z < 1.5) { y = a.y*s.y + sign(a.y)*oy; z = s.z - oy*s.w/(0.5*s.y); }
  else if (a.z < 2.5) { y = 0.0; z = s.z + s.w; }
  else { y = 0.0; z = s.z + s.w + 4.0; }
  return vec3(x, y, z);
}
vec3 toW(vec3 l){ float c = cos(iPos.z), s = sin(iPos.z); return vec3(iPos.x + c*l.x - s*l.y, iPos.y + s*l.x + c*l.y, l.z); }
float buildT(){ return clamp((uA - iAnim.x)/iAnim.y, 0.0, 1.0); }
float buildH(float bt, float top){ return (1.0 - (1.0 - bt)*(1.0 - bt))*(top + 1.4) - 0.7; }
vec4 stateOf(){
  float kind = iAnim.w;
  float isSel = (kind > 0.5 && abs(iPos.w - uSel) < 0.5) ? 1.0 : 0.0;
  float isHov = (kind > 0.5 && abs(iPos.w - uHov) < 0.5) ? 1.0 : 0.0;
  float hlv = max(isSel, isHov*0.6);
  float foc = (uSel > -0.5 && isSel < 0.5) ? (kind > 0.5 ? 0.62 : 0.8) : 1.0;
  float fade = kind > 0.5 ? 1.0 : 1.0 - smoothstep(uFR*0.45, uFR*0.95, length(iPos.xy - uC));
  float fl = (iAnim.z >= 0.0 && uDraw >= iAnim.z) ? exp(-(uDraw - iAnim.z)/9.0) : 0.0;
  return vec4(kind, hlv, foc*fade, fl);
}`;

const FACE_VS = HDR + `
layout(location=0) in vec4 aL;
` + HOUSE_COMMON + `
out vec3 vW; out vec3 vN; out vec2 vUV; out float vH;
flat out vec4 vCol; flat out vec4 vSt; flat out vec4 vSz; flat out float vFace; flat out float vSeed; flat out float vBld;
void main(){
  vec3 l = hl(aL, iSize);
  vec3 w = toW(l);
  float f = aL.w;
  vec3 n = f < 0.5 ? vec3(0.0, -1.0, 0.0) : f < 1.5 ? vec3(0.0, 1.0, 0.0) : (f < 2.5 || (f > 5.5 && f < 6.5)) ? vec3(-1.0, 0.0, 0.0)
         : (f < 3.5 || f > 6.5) ? vec3(1.0, 0.0, 0.0) : f < 4.5 ? normalize(vec3(0.0, -iSize.w, 0.5*iSize.y)) : normalize(vec3(0.0, iSize.w, 0.5*iSize.y));
  float c = cos(iPos.z), s = sin(iPos.z);
  n = vec3(c*n.x - s*n.y, s*n.x + c*n.y, n.z);
  vUV = f < 0.5 ? vec2(l.x, l.z) : f < 1.5 ? vec2(-l.x, l.z) : f < 2.5 ? vec2(-l.y, l.z) : vec2(l.y, l.z);
  vH = l.z;
  if (uMir > 0.5) { w.z = -w.z; n.z = -n.z; }
  vW = w; vN = n; vFace = f;
  float top = iSize.z + iSize.w;
  float bt = buildT();
  vSz = vec4(iSize.x, iSize.y, top, buildH(bt, top));
  vBld = bt < 1.0 ? 1.0 : 0.0;
  vSt = stateOf();
  vCol = uLight > 0.5 ? vec4(iColL.rgb, iColD.a) : iColD;
  vSeed = iColL.a;
  gl_Position = uVP*vec4(w, 1.0);
}`;

const FACE_FS = HDR + `
in vec3 vW; in vec3 vN; in vec2 vUV; in float vH;
flat in vec4 vCol; flat in vec4 vSt; flat in vec4 vSz; flat in float vFace; flat in float vSeed; flat in float vBld;
uniform vec3 uEye, uInk; uniform float uT, uMotion, uLight, uMir, uRefl;
out vec4 o;
float hash(float n){ return fract(sin(n)*43758.5453123); }
float rect(vec2 p, vec4 r, vec2 aa){
  vec2 lo = smoothstep(r.xy - aa, r.xy + aa, p); vec2 hi = 1.0 - smoothstep(r.zw - aa, r.zw + aa, p);
  return lo.x*lo.y*hi.x*hi.y;
}
void main(){
  float top = vSz.z, bH = vSz.w, h = vH;
  if (h > bH) discard;
  float kind = vSt.x, hlv = vSt.y, foc = vSt.z, fl = vSt.w;
  vec3 N = normalize(vN);
  vec3 V = normalize(uEye - vW);
  float nv = dot(N, V);
  float fres = pow(1.0 - abs(nv), 2.0);
  float face = nv > 0.0 ? 1.0 : 0.42;                     // far walls stay faint: reads as a solid house
  float roofK = (vFace > 3.5 && vFace < 5.5) ? 1.0 : 0.0;
  float hf = clamp(h/top, 0.0, 1.0);
  float sc = h/0.45 - uT*0.55;
  float scan = smoothstep(0.74, 1.0, fract(sc))*(1.0 - smoothstep(0.18, 0.55, fwidth(sc)));
  float bz = mod(uT*1.25 + vSeed*11.0, top + 9.0) - 3.0;
  float band = uMotion*exp(-pow((h - bz)/0.28, 2.0));
  float win = 0.0;
  if (vFace < 3.5) {
    vec2 uv = vUV; vec2 aa = max(fwidth(uv), vec2(1e-4))*0.8;
    float wf = 1.0 - smoothstep(0.09, 0.26, max(aa.x, aa.y));
    float sx = vSz.x/11.0;
    vec2 p = vec2(uv.x, mod(uv.y, 2.9));
    if (vFace < 0.5) win = rect(p, vec4(-4.0*sx, 1.0, -2.4*sx, 2.2), aa) + rect(p, vec4(1.1*sx, 1.0, 3.6*sx, 2.2), aa)
                         + 0.8*rect(uv, vec4(-1.0*sx, 0.0, -0.1*sx, 2.1), aa);
    else if (vFace < 1.5) win = rect(p, vec4(-3.4*sx, 1.1, -2.1*sx, 2.1), aa) + rect(p, vec4(1.6*sx, 1.1, 2.9*sx, 2.1), aa);
    else win = rect(p, vec4(-0.7, 1.1, 0.7, 2.1), aa);
    win *= wf;
  }
  float flick = 1.0;
  if (uMotion > 0.5) {
    float k = floor(uT*12.0 + vSeed*37.0);
    flick = 1.0 - 0.28*step(0.978, hash(k*1.37 + vSeed*91.0)) - 0.035*sin(uT*2.3 + vSeed*17.0);
  }
  float cut = vBld*exp(-pow((bH - h)/0.3, 2.0));
  vec3 c = vCol.rgb; float a;
  if (uLight < 0.5) {
    if (kind > 0.5) {
      a = ((0.06 + roofK*0.07 + fres*0.34 + scan*0.1)*face + band*0.32 + win*0.34*face)*mix(1.0, 0.42, hf)*vCol.a;
      a *= (1.0 + hlv*0.9 + fl*1.5)*foc;
      c = mix(c, vec3(1.0, 0.9, 0.78), clamp(win*0.45 + band*0.3, 0.0, 1.0));
    } else {
      a = ((0.016 + roofK*0.016 + fres*0.07 + scan*0.02)*face + band*0.045 + win*0.06*face)*mix(1.0, 0.5, hf)*foc*vCol.a;
    }
  } else {
    float lam = 0.8 + 0.2*dot(N, normalize(vec3(-0.35, -0.55, 0.76)));
    if (kind > 0.5) {
      a = ((0.12 + roofK*0.06 + fres*0.12 + scan*0.035)*face + band*0.1)*mix(1.0, 0.72, hf)*(1.0 + hlv*0.6 + fl)*foc;
      c = mix(c*lam, uInk, win*0.55); a += win*0.2*foc;
    } else {
      a = (0.045 + roofK*0.02 + fres*0.05 + scan*0.012)*face*mix(1.0, 0.75, hf)*foc;
      c = mix(c*lam, uInk, win*0.35); a += win*0.05*foc;
    }
  }
  a *= flick;
  a += cut*(kind > 0.5 ? 0.85 : 0.3)*foc;
  if (uLight < 0.5) c = mix(c, vec3(1.0), clamp(cut, 0.0, 1.0)*0.55);
  if (uMir > 0.5) a *= uRefl*exp(-h/2.0);
  a = clamp(a, 0.0, 1.0);
  o = vec4(c*a, a*uLight);
}`;

const EDGE_VS = HDR + `
layout(location=0) in vec4 aA;
layout(location=1) in vec4 aB;
layout(location=2) in vec2 aS;      // side (-1/1), end (0/1)
` + HOUSE_COMMON + `
uniform vec2 uRes; uniform float uDpr; uniform vec3 uEye;
out float vXw, vTw, vQ, vH, vDep;
flat out float vLen, vCore, vGw, vBH, vBld, vTop, vStem; flat out vec4 vCol; flat out vec4 vSt;
void main(){
  vec3 A = toW(hl(aA, iSize)), B = toW(hl(aB, iSize));
  float top = iSize.z + iSize.w;
  float bt = buildT(); float bH = buildH(bt, top);
  float stem = aA.w > 7.5 ? 1.0 : 0.0;
  float vis = (stem > 0.5 && iAnim.w < 0.5) ? 0.0 : 1.0;
  if (stem > 0.5) bH = mix(-1.0, top + 4.8, clamp((uA - iAnim.x - iAnim.y*0.8)/0.35, 0.0, 1.0));
  if (A.z > bH && B.z > bH) vis = 0.0;
  else if (A.z > bH) A = mix(B, A, (bH - B.z)/(A.z - B.z));
  else if (B.z > bH) B = mix(A, B, (bH - A.z)/(B.z - A.z));
  float hA = A.z, hB = B.z;
  // depth cue: edges on the far side of the house fade back, so the hologram reads as a solid house
  float rad = 0.5*length(iSize.xy);
  float dep = clamp(0.5 + (distance(uEye, vec3(iPos.xy, top*0.45)) - distance(uEye, 0.5*(A + B)))/(rad*1.1), 0.0, 1.0);
  if (uMir > 0.5) { A.z = -A.z; B.z = -B.z; }
  vec4 cA = uVP*vec4(A, 1.0), cB = uVP*vec4(B, 1.0);
  const float NW = 0.2;
  if (cA.w < NW && cB.w < NW) vis = 0.0;
  else if (cA.w < NW) cA = mix(cA, cB, (NW - cA.w)/(cB.w - cA.w));
  else if (cB.w < NW) cB = mix(cB, cA, (NW - cB.w)/(cA.w - cB.w));
  vec2 sA = cA.xy/cA.w*0.5*uRes, sB = cB.xy/cB.w*0.5*uRes;
  vec2 dv = sB - sA; float len = length(dv);
  vec2 dir = len > 1e-4 ? dv/len : vec2(1.0, 0.0); vec2 nn = vec2(-dir.y, dir.x);
  vec4 st = stateOf();
  float kind = st.x, hlv = st.y;
  float core = (kind > 0.5 ? (stem > 0.5 ? 0.4 : 0.62 + hlv*0.4) : 0.42)*uDpr;
  float gw = (kind > 0.5 ? (stem > 0.5 ? 1.2 : 2.4 + hlv*2.0) : 0.9)*uDpr;
  if (uLight > 0.5) gw = (kind > 0.5 ? 1.1 : 0.6)*uDpr;
  float W = core + gw*2.4 + uDpr;
  float e = aS.y;
  vec4 P = e > 0.5 ? cB : cA;
  P.xy += (nn*aS.x*W + dir*(e*2.0 - 1.0)*W)/(0.5*uRes)*P.w;
  gl_Position = vis > 0.5 ? P : vec4(2.0, 2.0, 2.0, 1.0);
  vQ = P.w; vXw = aS.x*W*P.w; vTw = (e > 0.5 ? len + W : -W)*P.w;
  vLen = len; vCore = core; vGw = gw; vH = e > 0.5 ? hB : hA; vBH = bH; vBld = (bt < 1.0 && stem < 0.5) ? 1.0 : 0.0; vTop = top; vStem = stem; vDep = dep;
  vCol = uLight > 0.5 ? vec4(iColL.rgb, iColD.a) : iColD; vSt = st;
}`;

const EDGE_FS = HDR + `
in float vXw, vTw, vQ, vH, vDep;
flat in float vLen, vCore, vGw, vBH, vBld, vTop, vStem; flat in vec4 vCol; flat in vec4 vSt;
uniform float uLight, uMir, uRefl; uniform vec3 uInk;
out vec4 o;
void main(){
  float x = vXw/vQ, t = vTw/vQ;
  float bey = max(max(-t, t - vLen), 0.0);
  float dd = length(vec2(bey, x));
  float core = 1.0 - smoothstep(vCore - 0.6, vCore + 0.6, dd);
  float glow = exp(-dd*dd/(2.0*vGw*vGw));
  float kind = vSt.x, hlv = vSt.y, foc = vSt.z, fl = vSt.w;
  float hf = clamp(vH/vTop, 0.0, 1.0);
  float cut = vBld*exp(-pow((vBH - vH)/0.4, 2.0));
  vec3 c = vCol.rgb; float a;
  if (uLight < 0.5) {
    if (kind > 0.5) { a = (core*0.8 + glow*0.16)*vCol.a*(1.0 + hlv*0.75 + fl*1.2); c = mix(c, vec3(1.0), 0.16 + hlv*0.22); }
    else a = core*0.17 + glow*0.025;
  } else {
    if (kind > 0.5) { a = core*0.95 + glow*0.07*(1.0 + hlv); c = c*(0.85 - hlv*0.15); }
    else { a = core*0.3; c = mix(c, uInk, 0.3); }
  }
  if (vStem > 0.5) { hf = clamp((vH - vTop)/4.0, 0.0, 1.0); a *= mix(0.55, 0.12, hf); }
  else a *= mix(kind > 0.5 ? 0.3 : 0.4, 1.0, smoothstep(0.0, 1.0, vDep));
  a *= mix(1.0, 0.72, hf)*foc;
  a += cut*(core + glow*0.6)*(kind > 0.5 ? 1.1 : 0.35);
  if (uMir > 0.5) a *= uRefl*exp(-vH/2.0);
  a = clamp(a, 0.0, 1.0);
  o = vec4(c*a, a*uLight);
}`;

// ground decals: 0 warm pool under a door, 1 selection ring, 2 park marker, 3 door node on the path
const DECAL_VS = HDR + `
layout(location=0) in vec2 aQ;
layout(location=1) in vec4 iD;   // x, y, radius, type
layout(location=2) in vec4 iC;   // rgb, intensity
layout(location=3) in vec4 iX;   // walk idx, arrival s, build start, 0
uniform mat4 uVP; uniform float uSel, uHov, uA, uDraw;
out vec2 vQ; flat out vec4 vC; flat out float vType, vOn, vFlash, vSelF;
void main(){
  float type = iD.w; float on = 1.0; vSelF = 0.0; vFlash = 0.0;
  if (type < 0.5) on = smoothstep(iX.z, iX.z + 0.9, uA)*(uSel > -0.5 && abs(iX.x - uSel) > 0.5 ? 0.55 : 1.0);
  else if (type < 1.5) { float s = abs(iX.x - uSel) < 0.5 ? 1.0 : 0.0; float h = abs(iX.x - uHov) < 0.5 ? 1.0 : 0.0; on = max(s, h*0.55); vSelF = s; }
  else if (type < 2.5) on = smoothstep(0.15, 0.6, uA);
  else { on = smoothstep(iX.y - 1.0, iX.y + 1.0, uDraw); vFlash = uDraw >= iX.y ? exp(-(uDraw - iX.y)/8.0) : 0.0; }
  vOn = on; vQ = aQ; vC = iC; vType = type;
  gl_Position = on > 0.001 ? uVP*vec4(iD.xy + aQ*iD.z, 0.06, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
}`;

const DECAL_FS = HDR + `
in vec2 vQ; flat in vec4 vC; flat in float vType, vOn, vFlash, vSelF;
uniform float uT, uMotion, uLight;
out vec4 o;
float ring(float q, float r, float th, float fw){ return 1.0 - smoothstep(0.0, fw*1.3, abs(q - r) - th); }
void main(){
  float q = length(vQ);
  if (q > 1.0) discard;
  float fw = max(fwidth(q), 1e-4);
  float a = 0.0; vec3 c = vC.rgb;
  if (vType < 0.5) a = exp(-q*q*4.2)*vC.a;
  else if (vType < 1.5) {
    float r0 = ring(q, 0.44, 0.01, fw);
    float ticks = step(0.5, fract(atan(vQ.y, vQ.x)*12.0/6.2831853 + (uMotion > 0.5 ? uT*0.15 : 0.0)))*ring(q, 0.52, 0.006, fw);
    float fill = exp(-q*q*10.0)*0.28;
    float pr = 0.0;
    if (uMotion > 0.5 && vSelF > 0.5) {
      for (int k = 0; k < 2; k++) { float ph = fract(uT*0.42 + float(k)*0.5); pr += ring(q, mix(0.44, 1.0, ph), 0.006, fw)*(1.0 - ph)*(1.0 - ph); }
    }
    a = (r0*0.85 + ticks*0.45 + fill + pr*0.7)*vC.a;
  } else if (vType < 2.5) {
    float ph = uMotion > 0.5 ? fract(uT*0.35) : 0.0;
    a = (ring(q, 0.82, 0.02, fw)*0.75 + ring(q, 0.5, 0.012, fw)*0.35 + exp(-q*q*40.0)*0.9
        + uMotion*ring(q, mix(0.2, 1.0, ph), 0.01, fw)*(1.0 - ph)*0.5)*vC.a;
  } else {
    a = (exp(-q*q*14.0)*0.9 + ring(q, 0.72, 0.05, fw)*0.5)*vC.a*(1.0 + vFlash*2.0);
  }
  a = clamp(a*vOn, 0.0, 1.0);
  o = vec4(c*a, a*uLight);
}`;

// vertical light beam (selected door) and the park pylon: camera-facing around z
const BEAM_VS = HDR + `
layout(location=0) in vec2 aQ;
uniform mat4 uVP; uniform vec4 uB; uniform vec3 uRight;
out vec2 vQ;
void main(){ vQ = aQ; vec3 p = vec3(uB.xy, 0.0) + uRight*aQ.x*uB.w + vec3(0.0, 0.0, aQ.y*uB.z); gl_Position = uVP*vec4(p, 1.0); }`;

const BEAM_FS = HDR + `
in vec2 vQ; out vec4 o;
uniform vec4 uB, uBC; uniform float uT, uMotion, uLight;
void main(){
  float u = vQ.x, v = vQ.y, H = uB.z;
  float coreP = exp(-u*u*60.0), wide = exp(-u*u*5.0);
  float vf = pow(1.0 - v, 1.7);
  float foot = exp(-v*H/2.5)*exp(-u*u*3.0);
  float dash = uMotion*smoothstep(0.82, 1.0, fract(v*H/7.0 - uT*0.8))*exp(-u*u*14.0);
  float a = ((wide*0.32 + coreP*0.85)*vf + foot*0.5 + dash*vf*0.4)*uBC.a;
  vec3 c = uLight < 0.5 ? mix(uBC.rgb, vec3(1.0), coreP*0.45) : uBC.rgb;
  a = clamp(a, 0.0, 1.0);
  o = vec4(c*a, a*uLight);
}`;

const DUST_VS = HDR + `
layout(location=0) in vec4 aP;   // x, y, seed, phase
layout(location=1) in vec4 aC;   // rgb, size
uniform mat4 uVP; uniform float uT, uDpr, uA, uSel;
out vec3 vC; out float vAl;
void main(){
  float H = 15.0;
  float z = mod(uT*(0.55 + aP.z*0.8) + aP.w*H, H);
  vec2 xy = aP.xy + vec2(sin(uT*0.5 + aP.z*20.0), cos(uT*0.4 + aP.w*20.0))*0.5;
  vec4 cp = uVP*vec4(xy, z, 1.0);
  gl_Position = cp;
  float s = sin(3.14159*z/H);
  vAl = s*s*smoothstep(3.2, 4.6, uA);
  gl_PointSize = aC.w*uDpr*clamp(240.0/max(cp.w, 1.0), 0.7, 2.6);
  vC = aC.rgb;
}`;

const DUST_FS = HDR + `
in vec3 vC; in float vAl; out vec4 o;
void main(){ vec2 q = gl_PointCoord*2.0 - 1.0; float r2 = dot(q, q); if (r2 > 1.0) discard; float a = exp(-r2*3.5)*vAl*0.5; o = vec4(vC*a, 0.0); }`;

/* =============================== base meshes =============================== */
function houseFaces() {
  const F = [];
  const tri = (a, b, c, f) => { for (const v of [a, b, c]) F.push(v[0], v[1], v[2], f); };
  const quad = (a, b, c, d, f) => { tri(a, b, c, f); tri(a, c, d, f); };
  quad([-.5, -.5, 0], [.5, -.5, 0], [.5, -.5, 1], [-.5, -.5, 1], 0);      // front (faces the street)
  quad([.5, .5, 0], [-.5, .5, 0], [-.5, .5, 1], [.5, .5, 1], 1);          // back
  quad([-.5, .5, 0], [-.5, -.5, 0], [-.5, -.5, 1], [-.5, .5, 1], 2);      // side -x
  quad([.5, -.5, 0], [.5, .5, 0], [.5, .5, 1], [.5, -.5, 1], 3);          // side +x
  quad([-.5, -.5, 1], [.5, -.5, 1], [.5, 0, 2], [-.5, 0, 2], 4);          // roof front
  quad([.5, .5, 1], [-.5, .5, 1], [-.5, 0, 2], [.5, 0, 2], 5);            // roof back
  tri([-.5, -.5, 1], [-.5, .5, 1], [-.5, 0, 2], 6);                       // gables
  tri([.5, .5, 1], [.5, -.5, 1], [.5, 0, 2], 7);
  return new Float32Array(F);
}
function houseEdges() {
  const R = 4, g = (x, y, z, f = 0) => [x, y, z, f], E = [];
  const C = [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]];
  for (let i = 0; i < 4; i++) { const a = C[i], b = C[(i + 1) % 4]; E.push([g(a[0], a[1], 0), g(b[0], b[1], 0)]); }  // base
  for (const [x, y] of C) E.push([g(x, y, 0), g(x, y, 1)]);                                                          // corners
  E.push([g(-.5, -.5, 1), g(-.5, .5, 1)], [g(.5, -.5, 1), g(.5, .5, 1)]);                                             // gable bases
  E.push([g(-.5, -.5, 1, R), g(.5, -.5, 1, R)], [g(-.5, .5, 1, R), g(.5, .5, 1, R)]);                                 // eaves
  E.push([g(-.5, -.5, 1, R), g(-.5, 0, 2, R)], [g(-.5, .5, 1, R), g(-.5, 0, 2, R)],
         [g(.5, -.5, 1, R), g(.5, 0, 2, R)], [g(.5, .5, 1, R), g(.5, 0, 2, R)]);                                      // rakes
  E.push([g(-.5, 0, 2, R), g(.5, 0, 2, R)]);                                                                          // ridge
  E.push([g(0, 0, 2, 8), g(0, 0, 3, 8)]);                                                                             // label stem (doors only)
  const V = [], I = [];
  E.forEach((e, k) => {
    for (const [side, end] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) V.push(...e[0], ...e[1], side, end);
    const o = k * 4; I.push(o, o + 1, o + 2, o + 2, o + 1, o + 3);
  });
  return { v: new Float32Array(V), i: new Uint16Array(I), n: I.length };
}

/* =============================== scene build =============================== */
function segDist(x, y, s) {
  const dx = s.bx - s.ax, dy = s.by - s.ay, L2 = dx * dx + dy * dy;
  let t = L2 > 0 ? ((x - s.ax) * dx + (y - s.ay) * dy) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = s.ax + dx * t, qy = s.ay + dy * t;
  return { d: Math.hypot(qx - x, qy - y), qx, qy, t };
}

function buildScene(scene, theme) {
  const c0 = scene.center || scene.park || (scene.homes && scene.homes[0] && scene.homes[0].p) || [0, 0];
  const lon0 = +c0[0], lat0 = +c0[1], kx = Math.cos(lat0 * DEG) * 111320, ky = 110540;
  const P = ll => [(ll[0] - lon0) * kx, (ll[1] - lat0) * ky];
  // walk streets: explicit walk:true sections win; names (walkStreets) are only a fallback
  const explicit = (scene.streets || []).some(s => s && s.walk);
  const walkNames = new Set(explicit ? [] : (scene.walkStreets || []).map(norm));
  const rnd = mulberry(Math.round(lon0 * 1e5) ^ Math.round(lat0 * 1e5) * 7);

  // ---- streets (local metres)
  const streets = [];
  for (const s of scene.streets || []) {
    if (!s || !s.p || s.p.length < 2) continue;
    const pts = s.p.map(P);
    if (!pts.some(q => q[0] * q[0] + q[1] * q[1] < 1100 * 1100)) continue;
    streets.push({ n: s.n || '', nm: norm(s.n), walk: !!s.walk, c: s.c == null ? 3 : +s.c, pts });
  }
  const segs = [];
  for (const st of streets) for (let i = 1; i < st.pts.length; i++) {
    const a = st.pts[i - 1], b = st.pts[i];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.01) continue;
    segs.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], st });
  }
  const nearest = (x, y, filter, maxD) => {
    let best = null;
    for (const s of segs) { if (filter && !filter(s)) continue; const r = segDist(x, y, s); if (r.d < maxD && (!best || r.d < best.d)) { best = r; best.s = s; } }
    return best;
  };

  // ---- walk doors
  const walk = (scene.homes || []).map((h, i) => {
    const [x, y] = P(h.p);
    const stn = norm(h.st || String(h.addr || '').replace(/^\s*\d+[a-z]?\s+/i, ''));
    const q = nearest(x, y, s => s.st.nm === stn, 45) || nearest(x, y, null, 70);
    let fx = 0, fy = -1;
    if (q && q.d > 0.5) { fx = (q.qx - x) / q.d; fy = (q.qy - y) / q.d; }
    const w = 12.5, d = 9.5, hw = 3.2, hr = 3.4, score = +h.score || 60;
    const colIn = hex(h.col);
    const cd = theme === 'dark' && colIn ? colIn : hailCol('dark', h.hail);
    const cl = theme === 'light' && colIn ? colIn : hailCol('light', h.hail);
    return {
      i, x, y, fx, fy, ang: Math.atan2(fx, -fy), w, d, hw, hr, top: hw + hr, score,
      order: h.order != null ? h.order : i + 1, addr: h.addr || '', cd, cl,
      front: [x + fx * (d / 2 + 2.2), y + fy * (d / 2 + 2.2)], glow: 0.78 + 0.42 * sat((score - 50) / 50),
    };
  });
  const N = walk.length;
  for (let it = 0; it < 4; it++) for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) {   // nudge touching doors apart
    const A = walk[a], B = walk[b], dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, need = 13.6;
    if (L < need) { const k = (need - L) / 2 / L; A.x -= dx * k; A.y -= dy * k; B.x += dx * k; B.y += dy * k; }
  }
  for (const h of walk) h.front = [h.x + h.fx * (h.d / 2 + 2.2), h.y + h.fy * (h.d / 2 + 2.2)];
  const park = scene.park ? P(scene.park) : (N ? [walk[0].front[0], walk[0].front[1]] : [0, 0]);

  // walk centre + extent
  let bb = [park[0], park[1], park[0], park[1]];
  for (const h of walk) { bb[0] = Math.min(bb[0], h.x); bb[1] = Math.min(bb[1], h.y); bb[2] = Math.max(bb[2], h.x); bb[3] = Math.max(bb[3], h.y); }
  const wc = [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2];
  let ext = 0; for (const h of walk) ext = Math.max(ext, Math.hypot(h.x - wc[0], h.y - wc[1]));
  ext = Math.max(ext, Math.hypot(park[0] - wc[0], park[1] - wc[1]));
  const FR = clamp(ext + 260, 380, 700);          // fade radius (grid, streets, filler)
  const RF = Math.min(350, FR - 25);             // filler radius

  // ---- walk-ness of a street point: on a walk street (or collinear with one) and near the doors
  const walkSegs = segs.filter(s => s.st.walk || walkNames.has(s.st.nm));
  const walkiness = (x, y, tx, ty, isWalk) => {
    let on = isWalk ? 1 : 0;
    if (!on) for (const s of walkSegs) {
      const r = segDist(x, y, s); if (r.d > 6) continue;
      const L = Math.hypot(s.bx - s.ax, s.by - s.ay); if (Math.abs(((s.bx - s.ax) * tx + (s.by - s.ay) * ty) / L) > 0.92) { on = 1; break; }
    }
    if (!on || !N) return 0;
    let dm = 1e9; for (const h of walk) dm = Math.min(dm, Math.hypot(h.x - x, h.y - y));
    return 1 - sat((dm - 24) / 26);
  };

  // ---- street ribbons (capsule quads, subdivided so walk-ness can fade)
  const SV = [], SI = []; let sv = 0;
  for (const st of streets) {
    const isWalk = st.walk || walkNames.has(st.nm);
    const hw = st.c <= 1 ? 11 : 9.5;
    for (let i = 1; i < st.pts.length; i++) {
      const a = st.pts[i - 1], b = st.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 0.01) continue;
      const tx = (b[0] - a[0]) / L, ty = (b[1] - a[1]) / L, nx = -ty, ny = tx;
      const n = Math.max(1, Math.ceil(L / 14));
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n;
        const ax = a[0] + (b[0] - a[0]) * t0, ay = a[1] + (b[1] - a[1]) * t0, bx = a[0] + (b[0] - a[0]) * t1, by = a[1] + (b[1] - a[1]) * t1;
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        if (Math.hypot(mx - wc[0], my - wc[1]) > FR * 1.05) continue;
        const l = L / n, w0 = walkiness(ax, ay, tx, ty, isWalk), w1 = walkiness(bx, by, tx, ty, isWalk);
        for (const [e, sd] of [[0, -1], [0, 1], [1, -1], [1, 1]]) {
          const px = (e ? bx + tx * hw : ax - tx * hw) + nx * sd * hw, py = (e ? by + ty * hw : ay - ty * hw) + ny * sd * hw;
          SV.push(px, py, e ? l + hw : -hw, sd * hw, l, 0, e ? w1 : w0, st.c);
        }
        SI.push(sv, sv + 1, sv + 2, sv + 2, sv + 1, sv + 3); sv += 4;
      }
    }
  }

  // ---- walk path (snap door points to the house front so the line stops at the door)
  let path = (scene.path || []).map(P);
  if (path.length < 2) { path = [park]; for (const h of walk) path.push(h.front); }
  path = path.map(q => { for (const h of walk) if (Math.hypot(q[0] - h.x, q[1] - h.y) < 4) return h.front.slice(); return q; });
  const pth = [];
  for (const q of path) { const l = pth[pth.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 0.3) pth.push(q); }
  const PV = [], PI = []; let pv = 0, plen = 0;
  const PHW = 4.5;
  const pseg = [];
  for (let i = 1; i < pth.length; i++) {
    const a = pth[i - 1], b = pth[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const tx = (b[0] - a[0]) / L, ty = (b[1] - a[1]) / L, nx = -ty, ny = tx;
    for (const [e, sd] of [[0, -1], [0, 1], [1, -1], [1, 1]]) {
      const px = (e ? b[0] + tx * PHW : a[0] - tx * PHW) + nx * sd * PHW, py = (e ? b[1] + ty * PHW : a[1] - ty * PHW) + ny * sd * PHW;
      PV.push(px, py, e ? L + PHW : -PHW, sd * PHW, L, plen, 1, 0);
    }
    PI.push(pv, pv + 1, pv + 2, pv + 2, pv + 1, pv + 3); pv += 4;
    pseg.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], s0: plen, L });
    plen += L;
  }
  for (const h of walk) {        // where the drawing line reaches each door
    let best = 1e9, s = -1;
    for (const g of pseg) { const r = segDist(h.front[0], h.front[1], g); if (r.d < best - 0.01) { best = r.d; s = g.s0 + r.t * g.L; } }
    h.arrive = best < 25 ? s : -1;
  }

  // ---- filler houses: seeded, both sides of local streets, skip corners / other streets / the doors
  const houses = walk.map(h => ({ x: h.x, y: h.y, r: 9 }));
  const cell = 24, grid = new Map();
  const key = (x, y) => Math.floor(x / cell) + ',' + Math.floor(y / cell);
  const addG = h => { const k = key(h.x, h.y); (grid.get(k) || grid.set(k, []).get(k)).push(h); };
  const clash = (x, y, r) => {
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const g = grid.get((cx + i) + ',' + (cy + j)); if (!g) continue;
      for (const h of g) if (Math.hypot(h.x - x, h.y - y) < r + h.r) return true;
    }
    return false;
  };
  houses.forEach(addG);
  const fill = [];
  const cap = Math.max(0, 590 - N);
  const locals = streets.filter(s => s.c >= 2).map(s => {
    let dm = 1e9; for (const q of s.pts) dm = Math.min(dm, Math.hypot(q[0] - wc[0], q[1] - wc[1]));
    return { s, dm };
  }).sort((a, b) => a.dm - b.dm).map(o => o.s);
  outer:
  for (const st of locals) for (const side of [-1, 1]) {
    const sp = 22 + rnd() * 4; let acc = rnd() * sp;
    for (let i = 1; i < st.pts.length; i++) {
      const a = st.pts[i - 1], b = st.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 0.01) continue;
      const tx = (b[0] - a[0]) / L, ty = (b[1] - a[1]) / L, nx = -ty * side, ny = tx * side;
      for (; acc < L; acc += sp + (rnd() - 0.5) * 2) {
        const off = 16 + rnd() * 3.5;
        const x = a[0] + tx * acc + nx * off, y = a[1] + ty * acc + ny * off;
        const dc = Math.hypot(x - wc[0], y - wc[1]);
        if (dc > RF || (dc > RF * 0.72 && rnd() < (dc - RF * 0.72) / (RF * 0.28))) continue;
        let near = 1e9; for (const s of segs) { const r = segDist(x, y, s); if (r.d < near) near = r.d; if (near < 13.5) break; }
        if (near < 13.5) continue;
        if (clash(x, y, 7.4)) continue;
        const two = rnd() < 0.12, w = 11 + rnd() * 3, d = 8.5 + rnd() * 2;
        const h = { x, y, r: 7.4, ang: Math.atan2(-nx, ny), w, d, hw: two ? 5.7 + rnd() * 0.3 : 2.9 + rnd() * 0.45, hr: 2.4 + rnd() * 1.0, b: 0.8 + rnd() * 0.4, seed: rnd() };
        fill.push(h); addG(h);
        if (fill.length >= cap) break outer;
      }
      acc -= L;
    }
  }

  // ---- instance buffer: doors first (index = walk index), then filler
  const nH = N + fill.length, INST = new Float32Array(nH * 20);
  const dist = (x, y) => Math.hypot(x - park[0], y - park[1]);
  const step = N > 1 ? Math.min(0.07, 1.6 / N) : 0;
  const T = { walk0: 0.55, step, dur: 0.8, fillSpan: 1.35 };
  T.path0 = T.walk0 + Math.max(0, N - 1) * step + 0.5;
  T.pathDur = clamp(plen / 170, 1.2, 2.2);
  T.done = T.path0 + T.pathDur;
  walk.forEach((h, k) => {
    const o = k * 20, seed = rnd();
    h.b0 = T.walk0 + k * step;
    INST.set([h.x, h.y, h.ang, k, h.w, h.d, h.hw, h.hr, h.cd[0], h.cd[1], h.cd[2], h.glow, h.cl[0], h.cl[1], h.cl[2], seed, h.b0, T.dur, h.arrive, 1], o);
  });
  const cool = PAL.dark.cool, coolL = PAL.light.cool;
  fill.forEach((h, k) => {
    const o = (N + k) * 20, start = 0.12 + (dist(h.x, h.y) / FR) * T.fillSpan + rnd() * 0.15;
    INST.set([h.x, h.y, h.ang, -1, h.w, h.d, h.hw, h.hr, cool[0], cool[1], cool[2], h.b, coolL[0], coolL[1], coolL[2], h.seed, start, 0.7, -1, 0], o);
  });

  // ---- street labels: walk streets at the middle of their doors, a few neighbours nearby
  const groups = new Map();
  for (const st of streets) {
    if (!st.nm || /intersection|ramp|unnamed/.test(st.nm)) continue;
    const g = groups.get(st.nm) || groups.set(st.nm, { nm: st.nm, text: '', walk: false, pts: [] }).get(st.nm);
    if (st.walk || walkNames.has(st.nm) || (scene.walkStreets || []).some(n => norm(n) === st.nm)) g.walk = true;
    if (!g.text || st.walk) g.text = disp(st.n);
    for (let i = 1; i < st.pts.length; i++) {
      const a = st.pts[i - 1], b = st.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 0.01) continue;
      const tx = (b[0] - a[0]) / L, ty = (b[1] - a[1]) / L;
      for (let s = 5; s < L; s += 10) g.pts.push([a[0] + tx * s, a[1] + ty * s, tx, ty, st]);
    }
  }
  const slabs = [];
  for (const g of groups.values()) {
    if (!g.pts.length) continue;
    if (g.walk) {
      const on = g.pts.filter(p => walkiness(p[0], p[1], p[2], p[3], true) > 0.85);
      if (!on.length) continue;
      let mx = 0, my = 0; on.forEach(p => { mx += p[0]; my += p[1]; }); mx /= on.length; my /= on.length;
      // beside the road (off the bright line), in a gap between doors, near the middle, never on a crossing
      let best = null, bd = 1e9;
      for (const p of on) for (const sd of [-1, 1]) {
        const x = p[0] - p[3] * sd * 8.5, y = p[1] + p[2] * sd * 8.5;
        let cross = 1e9; for (const s of segs) if (s.st.nm !== g.nm) cross = Math.min(cross, segDist(x, y, s).d);
        let clr = 1e9; for (const h of walk) clr = Math.min(clr, Math.hypot(h.x - x, h.y - y), Math.hypot(h.front[0] - x, h.front[1] - y) * 1.6);
        const d = Math.hypot(p[0] - mx, p[1] - my) + (cross < 26 ? 500 : 0) + Math.max(0, 16 - clr) * 40;
        if (d < bd) { bd = d; best = [x, y, p[2], p[3]]; }
      }
      if (best) slabs.push({ text: g.text, walk: true, x: best[0], y: best[1], tx: best[2], ty: best[3] });
    } else {
      let best = null, bd = 1e9;
      for (const p of g.pts) {
        const dc = Math.hypot(p[0] - wc[0], p[1] - wc[1]);
        if (dc < 60 || dc > FR * 0.62) continue;
        let dm = 1e9; for (const h of walk) dm = Math.min(dm, Math.hypot(h.x - p[0], h.y - p[1]));
        if (dm < 40) continue;
        let cross = 1e9; for (const s of segs) if (s.st.nm !== g.nm) { cross = Math.min(cross, segDist(p[0], p[1], s).d); if (cross < 24) break; }
        if (cross < 24) continue;
        const sc = Math.abs(dc - 150);
        if (sc < bd) { bd = sc; best = { text: g.text, walk: false, x: p[0], y: p[1], tx: p[2], ty: p[3], dc }; }
      }
      if (best) slabs.push(best);
    }
  }
  const others = slabs.filter(s => !s.walk).sort((a, b) => a.dc - b.dc).slice(0, 7);
  const sl = slabs.filter(s => s.walk).concat(others);

  // ---- rising motes above the doors (dark theme only)
  const DU = [];
  walk.forEach(h => { for (let k = 0; k < 7; k++) DU.push(h.x + (rnd() - 0.5) * 10, h.y + (rnd() - 0.5) * 8, rnd(), rnd(), h.cd[0], h.cd[1], h.cd[2], 1.6 + rnd() * 1.6); });

  return {
    lon0, lat0, kx, ky, walk, N, park, wc, bb, ext, FR, T, plen,
    street: { v: new Float32Array(SV), i: new Uint32Array(SI), n: SI.length },
    path: { v: new Float32Array(PV), i: new Uint32Array(PI), n: PI.length },
    inst: INST, nH, slabs: sl, dust: new Float32Array(DU), nDust: DU.length / 8,
  };
}

/* =============================== the component =============================== */
window.createHolo = function createHolo(canvas, labelLayer, cb) {
  try { return makeHolo(canvas, labelLayer, cb); } catch (e) {
    try { console.warn('holo: unavailable', e); } catch (err) {}
    const h = { ok: false };
    ['load', 'enter', 'start', 'stop', 'setTheme', 'setReduced', 'select', 'hover', 'setOrbit', 'setTour', 'resize', 'setInsets', 'destroy'].forEach(k => { h[k] = () => {}; });
    h.topDown = () => false;
    return h;
  }
};
function makeHolo(canvas, labelLayer, cb) {
  cb = cb || {};
  const holo = { ok: false };
  const API = ['load', 'enter', 'start', 'stop', 'setTheme', 'setReduced', 'select', 'hover', 'setOrbit', 'setTour', 'topDown', 'resize', 'setInsets', 'destroy'];
  API.forEach(k => { holo[k] = () => {}; });
  holo.topDown = () => false;
  if (!canvas) return holo;
  let gl = null;
  try { gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, depth: false, stencil: false }); } catch (e) { gl = null; }
  if (!gl) return holo;

  /* ---------- GL setup ---------- */
  function prog(vs, fs) {
    const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  }
  const buf = (data, target = gl.ARRAY_BUFFER, usage = gl.STATIC_DRAW) => { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, usage); return b; };
  function vao(attrs, index) {
    const v = gl.createVertexArray(); gl.bindVertexArray(v);
    for (const a of attrs) {
      gl.bindBuffer(gl.ARRAY_BUFFER, a.b); gl.enableVertexAttribArray(a.loc);
      gl.vertexAttribPointer(a.loc, a.size, gl.FLOAT, false, (a.stride || 0) * 4, (a.off || 0) * 4);
      gl.vertexAttribDivisor(a.loc, a.div || 0);
    }
    if (index) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
    gl.bindVertexArray(null); return v;
  }

  let PG = null, BASE = null, G = null;   // programs, static meshes, per-scene GPU objects
  function initGL() {
    PG = {
      ground: prog(GROUND_VS, GROUND_FS), street: prog(RIB_VS, STREET_FS), path: prog(RIB_VS, PATH_FS),
      face: prog(FACE_VS, FACE_FS), edge: prog(EDGE_VS, EDGE_FS), decal: prog(DECAL_VS, DECAL_FS),
      beam: prog(BEAM_VS, BEAM_FS), dust: prog(DUST_VS, DUST_FS),
    };
    const faces = houseFaces(), edges = houseEdges();
    BASE = {
      quad: buf(new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1])),
      beam: buf(new Float32Array([-1, 0, 1, 0, 1, 1, -1, 0, 1, 1, -1, 1])),
      faces: buf(faces), nFace: faces.length / 4,
      edges: buf(edges.v), edgeIdx: buf(edges.i, gl.ELEMENT_ARRAY_BUFFER), nEdgeIdx: edges.n,
    };
    BASE.groundVao = vao([{ b: BASE.quad, loc: 0, size: 2 }]);
    BASE.beamVao = vao([{ b: BASE.beam, loc: 0, size: 2 }]);
    G = null;
  }
  try { initGL(); } catch (e) { console.warn('holo: WebGL2 setup failed', e); return holo; }

  /* ---------- state ---------- */
  let S = null, light = (document.documentElement.getAttribute('data-theme') === 'light');
  let reduced = false;
  try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  let orbitOn = !reduced, orbitVel = 0;
  let sel = null, hovPtr = null, hovExt = null, selT0 = 0;
  let running = false, raf = 0, lastT = 0, t0 = now();
  let tEnter = -1e9;                              // uA = now - tEnter (huge -> everything built)
  let cssW = 1, cssH = 1, dpr = 1, dprScale = 1, cvL = 0, cvT = 0;
  let ins = null, insUser = null;
  const cam = { tx: 0, ty: 0, d: 400, yaw: 0, pitch: PITCH3D }, goal = { ...cam };
  const tw = { on: false, t0: 0, dur: 1, f: { ...cam }, t: { ...cam }, entry: false };
  const KEYS = ['tx', 'ty', 'd', 'yaw', 'pitch'];
  let fit3D = 400, fitTop = 400, isTop = false, savedYaw = ENTRY_YAW;
  let touring = false, tourI = 0, tourNext = 0;
  let drag = null, lastInteract = -1e9, lastHoverT = -1e9;
  const mouse = { x: 0, y: 0, in: false };
  let hovLast = null, hovLX = -1, hovLY = -1;
  let frameAcc = 0, frameN = 0;

  const V = new Float32Array(16), Pm = new Float32Array(16), VP = new Float32Array(16), TMP = new Float32Array(16);
  const EYE = new Float32Array(3), RIGHT = new Float32Array(3);
  let scr = new Float32Array(0);                  // per door: top x, y, w, mid x, y, w (css px)

  /* ---------- labels (HTML) ---------- */
  const labRoot = document.createElement('div');
  labRoot.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none';
  if (labelLayer) labelLayer.appendChild(labRoot);
  let chips = [], slabEls = [], pEl = null, chipState = [], slabState = [];
  function buildLabels() {
    labRoot.textContent = '';
    chips = []; slabEls = []; chipState = []; slabState = [];
    if (!S) return;
    S.walk.forEach(h => {
      const el = document.createElement('div');
      el.className = 'hlab'; el.textContent = String(h.order);
      el.style.setProperty('--dc', toHex(light ? h.cl : h.cd));
      el.style.opacity = '0'; el.style.willChange = 'transform,opacity';
      labRoot.appendChild(el); chips.push(el); chipState.push({ x: -1e4, y: -1e4, o: -1 });
    });
    S.slabs.forEach(s => {
      const el = document.createElement('div');
      el.className = 'slab' + (s.walk ? ' w' : ''); el.textContent = s.text;
      el.style.opacity = '0'; el.style.willChange = 'transform,opacity';
      labRoot.appendChild(el); slabEls.push(el); slabState.push({ x: -1e4, y: -1e4, a: 0, o: -1 });
    });
    pEl = document.createElement('div');
    pEl.className = 'hlab'; pEl.textContent = 'P';
    pEl.style.setProperty('--dc', 'var(--text-2,#b8bbc2)'); pEl.style.opacity = '0'; pEl.style.willChange = 'transform,opacity';
    labRoot.appendChild(pEl); pEl._s = { x: -1e4, y: -1e4, o: -1 };
    refreshChips();
  }
  function refreshChips() {
    if (!S) return;
    chips.forEach((el, i) => {
      const h = S.walk[i], on = sel === i;
      el.classList.toggle('sel', on);
      el.textContent = on ? h.order + ' · ' + Math.round(h.score) : String(h.order);
      el.style.setProperty('--dc', toHex(light ? h.cl : h.cd));
      el.style.zIndex = on ? '2' : '';
    });
  }

  /* ---------- GPU scene ---------- */
  function freeScene() {
    if (!G) return;
    for (const k of ['street', 'streetI', 'path', 'pathI', 'inst', 'decal', 'dust']) if (G[k]) gl.deleteBuffer(G[k]);
    for (const k of ['streetVao', 'pathVao', 'faceVao', 'edgeVao', 'decalVao', 'dustVao']) if (G[k]) gl.deleteVertexArray(G[k]);
    G = null;
  }
  function uploadScene() {
    freeScene();
    if (!S) return;
    G = {};
    const ribAttrs = b => [{ b, loc: 0, size: 4, stride: 8, off: 0 }, { b, loc: 1, size: 4, stride: 8, off: 4 }];
    G.street = buf(S.street.v); G.streetI = buf(S.street.i, gl.ELEMENT_ARRAY_BUFFER);
    G.streetVao = vao(ribAttrs(G.street), G.streetI);
    G.path = buf(S.path.v.length ? S.path.v : new Float32Array(8)); G.pathI = buf(S.path.i.length ? S.path.i : new Uint32Array(3), gl.ELEMENT_ARRAY_BUFFER);
    G.pathVao = vao(ribAttrs(G.path), G.pathI);
    G.inst = buf(S.inst.length ? S.inst : new Float32Array(20));
    const instAttrs = [0, 1, 2, 3, 4].map(k => ({ b: G.inst, loc: 3 + k, size: 4, stride: 20, off: k * 4, div: 1 }));
    G.faceVao = vao([{ b: BASE.faces, loc: 0, size: 4 }].concat(instAttrs));
    G.edgeVao = vao([{ b: BASE.edges, loc: 0, size: 4, stride: 10, off: 0 }, { b: BASE.edges, loc: 1, size: 4, stride: 10, off: 4 },
      { b: BASE.edges, loc: 2, size: 2, stride: 10, off: 8 }].concat(instAttrs), BASE.edgeIdx);
    G.decal = buf(new Float32Array(12 * (S.N * 3 + 1)), gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW);
    G.decalVao = vao([{ b: BASE.quad, loc: 0, size: 2 }, { b: G.decal, loc: 1, size: 4, stride: 12, off: 0, div: 1 },
      { b: G.decal, loc: 2, size: 4, stride: 12, off: 4, div: 1 }, { b: G.decal, loc: 3, size: 4, stride: 12, off: 8, div: 1 }]);
    G.dust = buf(S.dust.length ? S.dust : new Float32Array(8));
    G.dustVao = vao([{ b: G.dust, loc: 0, size: 4, stride: 8, off: 0 }, { b: G.dust, loc: 1, size: 4, stride: 8, off: 4 }]);
    writeDecals();
  }
  function writeDecals() {
    if (!S || !G) return;
    const pal = light ? PAL.light : PAL.dark, D = [];
    S.walk.forEach((h, k) => {
      const c = light ? h.cl : h.cd;
      D.push(h.x, h.y, 17, 0, c[0], c[1], c[2], light ? 0.07 : 0.1, k, h.arrive, h.b0, 0);
      D.push(h.x, h.y, 20, 1, c[0], c[1], c[2], light ? 0.85 : 0.9, k, -1, 0, 0);
      D.push(h.front[0], h.front[1], 1.7, 3, pal.walk[0], pal.walk[1], pal.walk[2], light ? 0.7 : 0.75, k, h.arrive, 0, 0);
    });
    D.push(S.park[0], S.park[1], 7.5, 2, pal.park[0], pal.park[1], pal.park[2], light ? 0.75 : 0.8, -1, -1, 0, 0);
    G.nDecal = D.length / 12;
    gl.bindBuffer(gl.ARRAY_BUFFER, G.decal); gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(D));
  }

  /* ---------- camera math ---------- */
  function computeVP(tx, ty, d, yaw, pitch, out, eye) {
    const cp = Math.cos(pitch), sp = Math.sin(pitch), sy = Math.sin(yaw), cy = Math.cos(yaw);
    const bx = -sy * cp, by = -cy * cp, bz = sp;
    const ex = tx + bx * d, ey = ty + by * d, ez = TZ + bz * d;
    const rx = cy, ry = -sy, ux = sp * sy, uy = sp * cy, uz = cp;
    V[0] = rx; V[1] = ux; V[2] = bx; V[3] = 0;
    V[4] = ry; V[5] = uy; V[6] = by; V[7] = 0;
    V[8] = 0; V[9] = uz; V[10] = bz; V[11] = 0;
    V[12] = -(rx * ex + ry * ey); V[13] = -(ux * ex + uy * ey + uz * ez); V[14] = -(bx * ex + by * ey + bz * ez); V[15] = 1;
    const near = Math.max(0.5, d * 0.02), far = d * 4 + 3000, f = 1 / Math.tan(FOV / 2), nf = 1 / (near - far);
    const I = insets();
    Pm.fill(0);
    Pm[0] = f / (cssW / cssH); Pm[5] = f; Pm[8] = -(I.l - I.r) / cssW; Pm[9] = -(I.b - I.t) / cssH;
    Pm[10] = (far + near) * nf; Pm[11] = -1; Pm[14] = 2 * far * near * nf;
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = Pm[r] * V[c * 4] + Pm[4 + r] * V[c * 4 + 1] + Pm[8 + r] * V[c * 4 + 2] + Pm[12 + r] * V[c * 4 + 3];
    }
    if (eye) { eye[0] = ex; eye[1] = ey; eye[2] = ez; }
  }
  function project(m, x, y, z, out, o) {
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (cw < 0.5) { out[o + 2] = 0; return false; }
    out[o] = (cx / cw * 0.5 + 0.5) * cssW; out[o + 1] = (0.5 - cy / cw * 0.5) * cssH; out[o + 2] = cw; return true;
  }
  function insets() {
    if (insUser) return insUser;
    if (!ins) {
      if (cssW < 1000) ins = { l: 0, r: 0, t: 0, b: 0 };
      else { const L = cssW > 1380 ? 384 : 358, R = cssW > 1380 ? 380 : 354; ins = { l: L, r: R, t: 66, b: 74 }; }
    }
    return ins;
  }
  const P3 = new Float32Array(3);
  function fits(tx, ty, d, yaw, pitch, pts, m) {
    computeVP(tx, ty, d, yaw, pitch, TMP, null);
    const I = insets(), x0 = I.l + m, x1 = cssW - I.r - m, y0 = I.t + m, y1 = cssH - I.b - m;
    for (let i = 0; i < pts.length; i += 3) {
      if (!project(TMP, pts[i], pts[i + 1], pts[i + 2], P3, 0)) return false;
      if (P3[0] < x0 || P3[0] > x1 || P3[1] < y0 || P3[1] > y1) return false;
    }
    return true;
  }
  function fitDist(tx, ty, yaw, pitch, pts, m) {
    let lo = 12, hi = 9000;
    for (let k = 0; k < 28; k++) { const d = Math.sqrt(lo * hi); if (fits(tx, ty, d, yaw, pitch, pts, m)) hi = d; else lo = d; }
    return hi;
  }
  function framePts() {
    const a = [S.park[0], S.park[1], 0];
    for (const h of S.walk) {
      const c = Math.cos(h.ang), s = Math.sin(h.ang);
      for (const [u, v] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) a.push(h.x + c * u * h.w - s * v * h.d, h.y + s * u * h.w + c * v * h.d, 0);
      a.push(h.x, h.y, h.top + 3.5);
    }
    return a;
  }
  function computeFits() {
    if (!S) return;
    const pts = framePts();
    fitTop = fitDist(S.wc[0], S.wc[1], 0, 90 * DEG, pts, 40);
    // 3D: frame the doors at the entry yaw, allowed to run a little under the glass panels (orbit brings them back)
    fit3D = fitDist(S.wc[0], S.wc[1], ENTRY_YAW, PITCH3D, pts, -60) * 0.85;
  }
  const selDist = () => clamp(fit3D * 0.42, 85, 150);

  function tweenTo(to, dur) {
    const t = now();
    for (const k of KEYS) { tw.f[k] = cam[k]; tw.t[k] = to[k] != null ? to[k] : goal[k]; }
    tw.entry = false;
    if (reduced || !(dur > 0)) { for (const k of KEYS) { cam[k] = goal[k] = tw.t[k]; } tw.on = false; return; }
    tw.on = true; tw.t0 = t; tw.dur = dur;
  }
  function cancelTween() { if (!tw.on) return; for (const k of KEYS) goal[k] = tw.t[k]; goal.yaw = cam.yaw; goal.pitch = cam.pitch; tw.on = false; }
  const interact = () => { lastInteract = now(); orbitVel = 0; };

  // the 2D map's walk framing (so the entry starts where the flat map was): app.js camWalk = fit(bb + 0.00022°, gap('walk'), 60)
  function mapFrame(opts) {
    if (opts && opts.from && opts.from.center && opts.from.mpp > 0) {
      const c = [(opts.from.center[0] - S.lon0) * S.kx, (opts.from.center[1] - S.lat0) * S.ky];
      return { c, ppm: 1 / opts.from.mpp, sx: opts.from.x != null ? opts.from.x : cssW / 2, sy: opts.from.y != null ? opts.from.y : cssH / 2 };
    }
    let Lp = 440, Rp = 352;
    try { const cs = getComputedStyle(document.documentElement); Lp = parseFloat(cs.getPropertyValue('--L')) || 440; Rp = parseFloat(cs.getPropertyValue('--R')) || 352; } catch (e) {}
    let g = { l: 14 + Lp + 20 + 14 + 6, r: cssW - 14 - Rp - 14 - 6, t: 76, b: cssH - 14 };
    if (g.r - g.l < 300) g = { l: 0, r: cssW, t: 0, b: cssH };
    const pad = 24.5, w = S.bb[2] - S.bb[0] + 2 * pad, h = S.bb[3] - S.bb[1] + 2 * pad;
    const ppm = Math.max(0.05, Math.min((g.r - g.l - 120) / w, (g.b - g.t - 120) / h));
    return { c: S.wc, ppm, sx: (g.l + g.r) / 2, sy: (g.t + g.b) / 2 };
  }

  /* ---------- API ---------- */
  function load(scene) {
    try {
      S = scene ? buildScene(scene, light ? 'light' : 'dark') : null;
    } catch (e) { console.warn('holo: bad scene', e); S = null; }
    sel = null; hovPtr = null; hovExt = null; touring = false; isTop = false; tw.on = false;
    scr = new Float32Array(Math.max(1, S ? S.N : 0) * 6);
    uploadScene(); buildLabels();
    if (!S) return;
    computeFits();
    Object.assign(cam, { tx: S.wc[0], ty: S.wc[1], d: fit3D, yaw: savedYaw, pitch: PITCH3D }); Object.assign(goal, cam);
    tEnter = -1e9;
  }
  function enter(opts) {
    if (!S) return;
    opts = opts || {};
    const inst = !!opts.instant || reduced;
    touring = false; isTop = false; orbitVel = 0; lastInteract = -1e9;
    computeFits();
    const end = { tx: S.wc[0], ty: S.wc[1], d: fit3D, yaw: ENTRY_YAW, pitch: PITCH3D };
    savedYaw = end.yaw;
    if (inst) { Object.assign(cam, end); Object.assign(goal, end); tw.on = false; tEnter = -1e9; return; }
    const mf = mapFrame(opts);
    const fpx = cssH / (2 * Math.tan(FOV / 2)), I = insets();
    const cxF = I.l + (cssW - I.l - I.r) / 2, cyF = I.t + (cssH - I.t - I.b) / 2;
    const d0 = Math.max(30, fpx / mf.ppm - TZ);
    Object.assign(cam, { tx: mf.c[0] - (mf.sx - cxF) / mf.ppm, ty: mf.c[1] + (mf.sy - cyF) / mf.ppm, d: d0, yaw: 0, pitch: 90 * DEG });
    Object.assign(goal, cam);
    tEnter = now();
    tweenTo(end, 2.0);
    tw.t0 = tEnter + 0.1; tw.entry = true;
  }
  function start() {
    if (running) return;
    running = true; lastT = now();
    if (!document.hidden) raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf); raf = 0;
    if (hovLast != null) { hovLast = null; try { cb.onHover && cb.onHover(null); } catch (e) {} }
    canvas.classList.remove('drag');
  }
  function setTheme(t) {
    const l = t === 'light';
    if (l === light) return;
    light = l; writeDecals(); refreshChips();
  }
  function setReduced(b) {
    reduced = !!b;
    if (reduced) { orbitVel = 0; if (tw.on) { for (const k of KEYS) cam[k] = goal[k] = tw.t[k]; tw.on = false; } tEnter = -1e9; }
  }
  const valid = i => S && i != null && i >= 0 && i < S.N && Math.floor(i) === i;
  function select(i) {
    if (!S) return;
    i = valid(i) ? i : null;
    if (i === sel && i == null) return;
    if (i !== sel) { sel = i; selT0 = now(); refreshChips(); }
    if (i != null) {
      const h = S.walk[i];
      const to = { tx: h.x, ty: h.y, d: isTop ? Math.max(selDist() * 1.5, 130) : selDist(), yaw: cam.yaw, pitch: isTop ? 90 * DEG : clamp(goal.pitch, 42 * DEG, 62 * DEG) };
      if (tw.on && tw.entry) { tw.t.tx = to.tx; tw.t.ty = to.ty; tw.t.d = to.d; return; }   // the entry glide lands on this door
      tweenTo(to, 1.15);
    } else {
      tweenTo({ tx: S.wc[0], ty: S.wc[1], d: isTop ? fitTop : fit3D, yaw: cam.yaw, pitch: isTop ? 90 * DEG : PITCH3D }, 1.1);
    }
  }
  function hover(i) { hovExt = valid(i) ? i : null; }
  function setOrbit(b) { orbitOn = !!b; if (!orbitOn) orbitVel = 0; else lastInteract = -1e9; }
  function endTour(notify) { if (!touring) return; touring = false; if (notify) { try { cb.onTourEnd && cb.onTourEnd(); } catch (e) {} } }
  function setTour(b) {
    if (!S || !S.N) return;
    b = !!b;
    if (b === touring) return;
    if (!b) { endTour(false); return; }
    touring = true; tourI = sel != null && sel < S.N - 1 ? sel + 1 : 0; tourNext = 0;
    if (isTop) { isTop = false; }
  }
  function topDown() {
    if (!S) return false;
    if (!isTop) {
      isTop = true; savedYaw = cam.yaw;
      tweenTo({ tx: S.wc[0], ty: S.wc[1], d: fitTop, yaw: Math.round(cam.yaw / TAU) * TAU, pitch: 90 * DEG }, 1.2);
    } else {
      isTop = false;
      const base = Math.round(cam.yaw / TAU) * TAU, off = ((savedYaw % TAU) + TAU) % TAU;
      tweenTo({ tx: S.wc[0], ty: S.wc[1], d: fit3D, yaw: base + (off > Math.PI ? off - TAU : off), pitch: PITCH3D }, 1.2);
    }
    return isTop;
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    cssW = Math.max(1, r.width || window.innerWidth); cssH = Math.max(1, r.height || window.innerHeight); cvL = r.left; cvT = r.top;
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1) * dprScale);
    const W = Math.round(cssW * dpr), H = Math.round(cssH * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    ins = null;
    if (S) computeFits();
  }
  function setInsets(o) { insUser = o ? { l: +o.left || 0, r: +o.right || 0, t: +o.top || 0, b: +o.bottom || 0 } : null; if (S) computeFits(); }

  /* ---------- input ---------- */
  if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0;
  canvas.style.touchAction = 'none';
  function onDown(e) {
    if (!S) return;
    drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, pan: e.button === 2 || e.shiftKey, id: e.pointerId };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  }
  function onMove(e) {
    mouse.x = e.clientX - cvL; mouse.y = e.clientY - cvT; mouse.in = true;
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) {
      drag.moved = true; canvas.classList.add('drag'); cancelTween(); endTour(true);
      if (isTop) { isTop = false; }
    }
    if (!drag.moved) return;
    interact();
    if (drag.pan) {
      const mpp = 2 * goal.d * Math.tan(FOV / 2) / cssH, sy = Math.sin(goal.yaw), cy = Math.cos(goal.yaw);
      goal.tx += (-dx * cy - dy * sy / Math.max(0.3, Math.sin(goal.pitch))) * mpp;
      goal.ty += (dx * sy - dy * cy / Math.max(0.3, Math.sin(goal.pitch))) * mpp;
      const ox = goal.tx - S.wc[0], oy = goal.ty - S.wc[1], L = Math.hypot(ox, oy), M = S.FR * 0.6;
      if (L > M) { goal.tx = S.wc[0] + ox / L * M; goal.ty = S.wc[1] + oy / L * M; }
    } else {
      goal.yaw += dx * 0.0055;
      goal.pitch = clamp(goal.pitch + dy * 0.0045, 20 * DEG, 89 * DEG);
    }
  }
  function onUp(e) {
    if (!drag) return;
    const d = drag; drag = null; canvas.classList.remove('drag');
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
    if (d.moved) return;
    const i = pickAt(e.clientX - cvL, e.clientY - cvT);
    if (i != null) {
      endTour(true); interact();
      select(i);
      try { cb.onSelect && cb.onSelect(i); } catch (err) {}
    }
  }
  function onLeave() { mouse.in = false; }
  function onWheel(e) {
    if (!S) return;
    e.preventDefault();
    const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    cancelTween(); interact();
    goal.d = clamp(goal.d * Math.exp(e.deltaY * k * (e.ctrlKey ? 0.01 : 0.0015)), 35, Math.max(fit3D, fitTop) * 2.2);
  }
  function onKey(e) {
    if (!S) return;
    const k = e.key; let used = true;
    cancelTween();
    if (k === 'ArrowLeft') goal.yaw -= 12 * DEG;
    else if (k === 'ArrowRight') goal.yaw += 12 * DEG;
    else if (k === 'ArrowUp') goal.pitch = clamp(goal.pitch + 6 * DEG, 20 * DEG, 89 * DEG);
    else if (k === 'ArrowDown') goal.pitch = clamp(goal.pitch - 6 * DEG, 20 * DEG, 89 * DEG);
    else if (k === '+' || k === '=') goal.d = Math.max(35, goal.d / 1.2);
    else if (k === '-' || k === '_') goal.d = Math.min(Math.max(fit3D, fitTop) * 2.2, goal.d * 1.2);
    else used = false;
    if (used) { e.preventDefault(); interact(); if (reduced) Object.assign(cam, goal); }
  }
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKey);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  const onVis = () => {
    if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; }
    else if (running && !raf) { lastT = now(); raf = requestAnimationFrame(frame); }
  };
  document.addEventListener('visibilitychange', onVis);
  let ro = null;
  try { ro = new ResizeObserver(() => resize()); ro.observe(canvas); } catch (e) { window.addEventListener('resize', resize); }
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); if (raf) cancelAnimationFrame(raf); raf = 0; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { initGL(); uploadScene(); if (running) { raf = requestAnimationFrame(frame); } } catch (e) { holo.ok = false; }
  });

  function pickAt(x, y) {
    if (!S) return null;
    const uA = now() - tEnter;
    let best = null, bd = 30 * 30;
    for (let i = 0; i < S.N; i++) {
      if (uA < S.walk[i].b0 + 0.6) continue;
      for (let o = i * 6; o <= i * 6 + 3; o += 3) {
        if (scr[o + 2] <= 0) continue;
        const dx = scr[o] - x, dy = scr[o + 1] - y, d2 = dx * dx + dy * dy;
        if (d2 < bd) { bd = d2; best = i; }
      }
    }
    return best;
  }

  /* ---------- frame ---------- */
  function setCommon(P, uT, uA, motion) {
    const u = P.u, g = gl;
    gl.useProgram(P.p);
    if (u.uVP) g.uniformMatrix4fv(u.uVP, false, VP);
    if (u.uEye) g.uniform3fv(u.uEye, EYE);
    if (u.uRes) g.uniform2f(u.uRes, canvas.width, canvas.height);
    if (u.uDpr) g.uniform1f(u.uDpr, dpr);
    if (u.uT) g.uniform1f(u.uT, uT);
    if (u.uA) g.uniform1f(u.uA, uA);
    if (u.uMotion) g.uniform1f(u.uMotion, motion);
    if (u.uLight) g.uniform1f(u.uLight, light ? 1 : 0);
    if (u.uC) g.uniform2f(u.uC, S.wc[0], S.wc[1]);
    if (u.uFR) g.uniform1f(u.uFR, S.FR);
    if (u.uPark) g.uniform2f(u.uPark, S.park[0], S.park[1]);
    if (u.uSel) g.uniform1f(u.uSel, sel == null ? -1 : sel);
    const hv = hovPtr != null ? hovPtr : hovExt;
    if (u.uHov) g.uniform1f(u.uHov, hv == null ? -1 : hv);
    if (u.uMir) g.uniform1f(u.uMir, 0);
    const pal = light ? PAL.light : PAL.dark;
    if (u.uCool) g.uniform3fv(u.uCool, pal.cool);
    if (u.uWalk) g.uniform3fv(u.uWalk, pal.walk);
    if (u.uHot) g.uniform3fv(u.uHot, pal.hot);
    if (u.uGrid) g.uniform3fv(u.uGrid, pal.grid);
    if (u.uInk) g.uniform3fv(u.uInk, pal.ink);
    if (u.uRefl) g.uniform1f(u.uRefl, light ? 0.06 : 0.16);
    return u;
  }
  const blendAdd = () => { gl.blendEquation(gl.FUNC_ADD); if (light) gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); else gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE); };
  const blendMax = () => { gl.blendEquation(gl.MAX); };

  function frame() {
    raf = running && !document.hidden ? requestAnimationFrame(frame) : 0;
    const t = now();
    let dt = t - lastT; lastT = t; if (dt > 0.1) dt = 0.1; if (dt < 0) dt = 0;
    // adaptive resolution: if we're slow for ~1 s at DPR 2, step down once or twice
    frameAcc += dt; frameN++;
    if (frameAcc > 1.2) { if (frameAcc / frameN > 0.026 && dprScale > 0.7 && (window.devicePixelRatio || 1) > 1.2) { dprScale -= 0.15; resize(); } frameAcc = 0; frameN = 0; }
    try { update(t, dt); render(t); overlay(t); } catch (e) { console.warn('holo frame', e); stop(); }
  }

  function update(t, dt) {
    if (!S) return;
    // tour
    if (touring && t >= tourNext) {
      if (tourI >= S.N) endTour(true);
      else { const i = tourI++; select(i); try { cb.onSelect && cb.onSelect(i); } catch (e) {} tourNext = t + 2.2; }
    }
    if (tw.on) {
      const k = sat((t - tw.t0) / tw.dur), e = ease3(k);
      for (const key of KEYS) { cam[key] = tw.f[key] + (tw.t[key] - tw.f[key]) * e; goal[key] = cam[key]; }
      if (k >= 1) { tw.on = false; for (const key of KEYS) goal[key] = tw.t[key]; }
    } else {
      const a = reduced ? 1 : 1 - Math.exp(-dt * (drag && drag.moved ? 14 : 6));
      for (const key of KEYS) cam[key] += (goal[key] - cam[key]) * a;
    }
    // resting the pointer on a door eases the orbit to a stop so the house stays under the cursor
    if (hovPtr != null) lastHoverT = t;
    const want = orbitOn && !reduced && !isTop && !(drag && drag.moved) && t - lastInteract > 6 && t - tEnter > 2.3 && t - lastHoverT > 1.5;
    orbitVel += ((want ? TAU / 90 : 0) - orbitVel) * (1 - Math.exp(-dt * (hovPtr != null ? 5 : 0.9)));
    if (Math.abs(orbitVel) > 1e-5) {
      const dy = orbitVel * dt; cam.yaw += dy; goal.yaw += dy; if (tw.on) { tw.f.yaw += dy; tw.t.yaw += dy; }
    }
  }

  function render(t) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    if (!S || !G) return;
    computeVP(cam.tx, cam.ty, cam.d, cam.yaw, cam.pitch, VP, EYE);
    RIGHT[0] = Math.cos(cam.yaw); RIGHT[1] = -Math.sin(cam.yaw); RIGHT[2] = 0;
    const motion = reduced ? 0 : 1, uT = reduced ? 0 : t - t0, uA = t - tEnter, T = S.T;
    gl.enable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);

    // ground grid + reveal wave
    blendAdd();
    let u = setCommon(PG.ground, uT, uA, motion);
    const rev = uA < 2.2 ? easeOut3(sat(uA / 1.7)) * S.FR * 1.15 : 1e5;
    gl.uniform1f(u.uGR, S.FR * 1.1); gl.uniform1f(u.uRev, rev); gl.uniform1f(u.uRevOn, uA < 2.2 ? 1 : 0);
    gl.bindVertexArray(BASE.groundVao); gl.drawArrays(gl.TRIANGLES, 0, 6);

    // path drawing state
    let draw, drawing = 0;
    if (uA < T.path0) draw = -1;
    else if (uA < T.done) { draw = ease3(sat((uA - T.path0) / T.pathDur)) * S.plen; drawing = 1; }
    else draw = S.plen + 1e4;
    const cometOn = !reduced && uA > T.done + 0.4 ? 1 : 0;
    const cp = 8.0, cph = ((uA - T.done - 0.4) % cp) / cp;
    const comet = cometOn ? cph * (S.plen + 60) / 0.82 - 20 : -1e5;

    // reflections (under the glass floor)
    const nH = S.nH;
    if (nH) {
      u = setCommon(PG.face, uT, uA, motion); gl.uniform1f(u.uMir, 1); if (u.uDraw) gl.uniform1f(u.uDraw, draw);
      gl.bindVertexArray(G.faceVao); gl.drawArraysInstanced(gl.TRIANGLES, 0, BASE.nFace, nH);
      u = setCommon(PG.edge, uT, uA, motion); gl.uniform1f(u.uMir, 1); if (u.uDraw) gl.uniform1f(u.uDraw, draw);
      gl.bindVertexArray(G.edgeVao); gl.drawElementsInstanced(gl.TRIANGLES, BASE.nEdgeIdx, gl.UNSIGNED_SHORT, 0, nH);
    }

    // streets (MAX so crossings and duplicates never double up)
    if (S.street.n) {
      blendMax();
      u = setCommon(PG.street, uT, uA, motion);
      gl.uniform1f(u.uZ, 0.0); gl.uniform1f(u.uSA, sat(uA / 0.45));
      gl.bindVertexArray(G.streetVao); gl.drawElements(gl.TRIANGLES, S.street.n, gl.UNSIGNED_INT, 0);
      blendAdd();
    }

    // ground decals (door pools, selection ring, park, door nodes)
    u = setCommon(PG.decal, uT, uA, motion); if (u.uDraw) gl.uniform1f(u.uDraw, draw);
    gl.bindVertexArray(G.decalVao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, G.nDecal);

    // houses: faces then glowing edges
    if (nH) {
      u = setCommon(PG.face, uT, uA, motion); if (u.uDraw) gl.uniform1f(u.uDraw, draw);
      gl.bindVertexArray(G.faceVao); gl.drawArraysInstanced(gl.TRIANGLES, 0, BASE.nFace, nH);
      u = setCommon(PG.edge, uT, uA, motion); if (u.uDraw) gl.uniform1f(u.uDraw, draw);
      gl.bindVertexArray(G.edgeVao); gl.drawElementsInstanced(gl.TRIANGLES, BASE.nEdgeIdx, gl.UNSIGNED_SHORT, 0, nH);
    }

    // walk path
    if (S.path.n && draw > 0) {
      blendMax();
      u = setCommon(PG.path, uT, uA, motion);
      gl.uniform1f(u.uZ, 0.35); gl.uniform1f(u.uDraw, draw); gl.uniform1f(u.uDrawing, drawing);
      gl.uniform1f(u.uComet, comet); gl.uniform1f(u.uCometOn, cometOn);
      gl.bindVertexArray(G.pathVao); gl.drawElements(gl.TRIANGLES, S.path.n, gl.UNSIGNED_INT, 0);
      blendAdd();
    }

    // beams: park pylon + selected door
    u = setCommon(PG.beam, uT, uA, motion);
    gl.uniform3fv(u.uRight, RIGHT);
    gl.bindVertexArray(BASE.beamVao);
    const pal = light ? PAL.light : PAL.dark;
    const pOn = sat((uA - 0.2) / 0.5);
    if (pOn > 0) {
      gl.uniform4f(u.uB, S.park[0], S.park[1], 6.5, 0.9);
      gl.uniform4f(u.uBC, pal.park[0], pal.park[1], pal.park[2], (light ? 0.55 : 0.6) * pOn);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    if (sel != null) {
      const h = S.walk[sel], k = reduced ? 1 : easeOut3(sat((t - selT0) / 0.7)), c = light ? h.cl : h.cd;
      gl.uniform4f(u.uB, h.x, h.y, 70 * k + 0.01, 5.5);
      gl.uniform4f(u.uBC, c[0], c[1], c[2], light ? 0.5 : 0.75);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // motes (dark only)
    if (!light && !reduced && S.nDust) {
      u = setCommon(PG.dust, uT, uA, motion);
      gl.bindVertexArray(G.dustVao); gl.drawArrays(gl.POINTS, 0, S.nDust);
    }
    gl.bindVertexArray(null);
  }

  /* ---------- labels + hover (DOM: transform/opacity only) ---------- */
  const PS = new Float32Array(3), PS2 = new Float32Array(3);
  function overlay(t) {
    if (!S) return;
    const uA = t - tEnter;
    for (let i = 0; i < S.N; i++) {
      const h = S.walk[i];
      project(VP, h.x, h.y, h.top + 4.2, scr, i * 6);
      project(VP, h.x, h.y, h.hw * 0.6, scr, i * 6 + 3);
      const el = chips[i], st = chipState[i];
      if (!el) continue;
      const vis = scr[i * 6 + 2] > 0 && scr[i * 6] > -40 && scr[i * 6] < cssW + 40 && scr[i * 6 + 1] > -40 && scr[i * 6 + 1] < cssH + 60;
      const built = uA > h.b0 + 0.75;
      const o = vis && built ? (sel != null && sel !== i ? 0.55 : 1) : 0;
      if (vis) {
        const x = Math.round(scr[i * 6] * 10) / 10, y = Math.round((scr[i * 6 + 1] - 4) * 10) / 10;
        if (x !== st.x || y !== st.y) { st.x = x; st.y = y; el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) translate(-50%,-100%)'; }
      }
      if (o !== st.o) { st.o = o; el.style.opacity = String(o); }
    }
    // street labels, rotated along the street
    const rev = uA < 2.2 ? easeOut3(sat(uA / 1.7)) * S.FR * 1.15 : 1e5;
    S.slabs.forEach((s, k) => {
      const el = slabEls[k], st = slabState[k];
      let o = 0;
      if (project(VP, s.x, s.y, 0.3, PS, 0) && project(VP, s.x + s.tx * 10, s.y + s.ty * 10, 0.3, PS2, 0)) {
        const x = PS[0], y = PS[1];
        if (x > -60 && x < cssW + 60 && y > -30 && y < cssH + 30) {
          const dc = Math.hypot(s.x - S.wc[0], s.y - S.wc[1]);
          const inRev = Math.hypot(s.x - S.park[0], s.y - S.park[1]) < rev - 10;
          o = inRev ? (s.walk ? 1 : 0.85 * (1 - sat((dc - S.FR * 0.35) / (S.FR * 0.3)))) : 0;
          let a = Math.atan2(PS2[1] - y, PS2[0] - x);
          if (a > Math.PI / 2) a -= Math.PI; else if (a < -Math.PI / 2) a += Math.PI;
          const rx = Math.round(x * 10) / 10, ry = Math.round(y * 10) / 10, ra = Math.round(a * 1000) / 1000;
          if (rx !== st.x || ry !== st.y || ra !== st.a) { st.x = rx; st.y = ry; st.a = ra; el.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0) translate(-50%,-50%) rotate(' + ra + 'rad)'; }
        }
      }
      o = Math.round(o * 20) / 20;
      if (o !== st.o) { st.o = o; el.style.opacity = String(o); }
    });
    // park chip
    if (pEl) {
      const st = pEl._s; let o = 0;
      if (project(VP, S.park[0], S.park[1], 7.5, PS, 0) && PS[0] > -30 && PS[0] < cssW + 30 && PS[1] > -30 && PS[1] < cssH + 30) {
        o = uA > 0.5 ? 1 : 0;
        const x = Math.round(PS[0] * 10) / 10, y = Math.round(PS[1] * 10) / 10;
        if (x !== st.x || y !== st.y) { st.x = x; st.y = y; pEl.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) translate(-50%,-100%)'; }
      }
      if (o !== st.o) { st.o = o; pEl.style.opacity = String(o); }
    }
    // pointer hover follows the scene while it moves
    let hv = null;
    if (mouse.in && !(drag && drag.moved)) hv = pickAt(mouse.x, mouse.y);
    if (hv !== hovPtr) { hovPtr = hv; canvas.style.cursor = hv != null ? 'pointer' : ''; }
    if (hv !== hovLast) {
      hovLast = hv; hovLX = -1; hovLY = -1;
      if (hv == null) { try { cb.onHover && cb.onHover(null); } catch (e) {} }
    }
    if (hv != null) {
      const x = cvL + scr[hv * 6], y = cvT + scr[hv * 6 + 1];
      if (Math.abs(x - hovLX) > 0.75 || Math.abs(y - hovLY) > 0.75) { hovLX = x; hovLY = y; try { cb.onHover && cb.onHover(hv, x, y); } catch (e) {} }
    }
  }

  function destroy() {
    stop(); freeScene();
    try { ro && ro.disconnect(); } catch (e) {}
    document.removeEventListener('visibilitychange', onVis);
    labRoot.remove();
  }

  resize();
  Object.assign(holo, { ok: true, load, enter, start, stop, setTheme, setReduced, select, hover, setOrbit, setTour, topDown, resize, setInsets, destroy });
  Object.defineProperty(holo, 'touring', { get: () => touring });
  Object.defineProperty(holo, 'isTop', { get: () => isTop });
  Object.defineProperty(holo, 'selected', { get: () => sel });
  return holo;
}
})();
