/* hub/eyes.js: the two eye lights as one small shader plane per robot (FUN-IDEAS idea 3).
 * Shapes act out the state and morph, never pop: working = narrow ovals scanning, waiting = big round eyes,
 * blocked = one squint, done = happy arcs (^ ^), sleeping = two low flat lines, idle = soft ovals that wander.
 * makeEyes(THREE) -> {mesh, u}; setEyes(e, target, dt, rm) eases the uniforms toward the state's shape. */
const VERT = `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = `
precision mediump float;
varying vec2 vP;
uniform vec3 uColor; uniform vec2 uLook; uniform float uW, uH, uOpen, uHappy, uSquint, uAlpha;
float eye(vec2 p, float h){
  vec2 q = p / vec2(uW, max(.0008, h));
  float e = length(q) - 1.0;
  float aa = 1.2 * fwidth(e);
  float oval = 1.0 - smoothstep(-aa, aa, e);
  // happy arc: the upper half of a ring
  vec2 r = (p - vec2(0.0, -uW*.55)) / uW;
  float ring = abs(length(r) - .8) - .16;
  float ra = 1.2 * fwidth(ring);
  float arc = (1.0 - smoothstep(-ra, ra, ring)) * step(-.05, r.y);
  return mix(oval, arc, uHappy);
}
void main(){
  vec2 c = uLook * vec2(.022, .016);
  float h = uH * uOpen;
  float a = eye(vP - vec2(-.066, 0.0) - c, h);
  float b = eye(vP - vec2(.066, 0.0) - c - vec2(0.0, uSquint*.004), h * (1.0 - .72*uSquint));
  float k = max(a, b) * uAlpha;
  if (k < .01) discard;
  gl_FragColor = vec4(uColor, k);
}`;
export const SHAPES = {
  work:    {w:.032, h:.011, happy:0, squint:0},
  wait:    {w:.031, h:.031, happy:0, squint:0},
  blocked: {w:.03,  h:.022, happy:0, squint:1},
  done:    {w:.03,  h:.022, happy:1, squint:0},
  sleep:   {w:.034, h:.0035, happy:0, squint:0},
  idle:    {w:.028, h:.02,  happy:0, squint:0},
  ride:    {w:.031, h:.028, happy:0, squint:0}
};
export function makeEyes(THREE){
  const u = {uColor:{value:new THREE.Color(0xfff2e0)}, uLook:{value:new THREE.Vector2()}, uW:{value:.028}, uH:{value:.02}, uOpen:{value:1}, uHappy:{value:0}, uSquint:{value:0}, uAlpha:{value:1}};
  const mat = new THREE.ShaderMaterial({uniforms:u, vertexShader:VERT, fragmentShader:FRAG, transparent:true, depthWrite:false, toneMapped:false});
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.3, .12), mat); mesh.renderOrder = 3;
  return {mesh, u};
}
export function setEyes(e, shape, look, open, color, dt, rm){
  const s = SHAPES[shape] || SHAPES.idle, k = rm ? 1 : Math.min(1, dt*7), u = e.u;
  u.uW.value += (s.w - u.uW.value)*k; u.uH.value += (s.h - u.uH.value)*k;
  u.uHappy.value += (s.happy - u.uHappy.value)*k; u.uSquint.value += (s.squint - u.uSquint.value)*k;
  u.uOpen.value += (open - u.uOpen.value)*Math.min(1, rm ? 1 : dt*24);
  u.uLook.value.lerp(look, rm ? 1 : Math.min(1, dt*9));
  u.uColor.value.lerp(color, rm ? 1 : Math.min(1, dt*4));
}
