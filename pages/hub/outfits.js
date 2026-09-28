/* hub/outfits.js: Wardrobe v2 (docs/design/hub-office/FUN-IDEAS.md section 3), for hub/scene.js.
 * One body, ten editions. Static pieces are baked per material; moving pieces live in named groups with the pivot at
 * the hinge (R.hatG, R.faceG, R.prop, R.cape, R.tie, R.card, R.anemo), jewelry in R.jewel (hidden when small).
 * dress(K, a, R, def) builds; animOutfit(K, a, sim, R, t, dt) plays the state grammar; K = the scene's kit. */

const TAU = Math.PI*2;
let THREE, K;                               // set on the first dress()
const mats = {};
function M(key, make){ return mats[key] || (mats[key] = make()); }
const phys = o => new THREE.MeshPhysicalMaterial(o), std = o => new THREE.MeshStandardMaterial(o);
function OM(){ // outfit materials (four families: lacquer, brushed brass, soft goods, enamel)
  return {
    brassPol: M('brassPol', () => std({color:0xe6c987, metalness:1, roughness:.25})),
    brassDk: M('brassDk', () => std({color:0x9c7c3e, metalness:1, roughness:.4})),
    oxblood: M('oxblood', () => phys({color:0x6b1528, roughness:.6, sheen:1, sheenColor:0xd66a7a, side:THREE.DoubleSide})),
    ermine: M('ermine', () => phys({color:0xf4efe6, roughness:.9, sheen:.6, sheenColor:0xffffff})),
    fleck: M('fleck', () => std({color:0x111111, roughness:.8})),
    violet: M('violet', () => phys({color:0x4a2466, roughness:.3, clearcoat:.8, side:THREE.DoubleSide})),
    violetHi: M('violetHi', () => phys({color:0x6b3a92, roughness:.3, clearcoat:.8})),
    silk: M('silk', () => phys({color:0xd6a743, metalness:.35, roughness:.35, sheen:.6, sheenColor:0xffe2a0})),
    leatherG: M('leatherG', () => std({color:0x26262b, roughness:.5})),
    leatherK: M('leatherK', () => std({color:0x1c1c20, roughness:.5})),
    lacqOrange: M('lacqOrange', () => phys({color:0xf5883a, roughness:.28, clearcoat:.85, clearcoatRoughness:.15})),
    lacqRidge: M('lacqRidge', () => phys({color:0xe8772a, roughness:.3, clearcoat:.8})),
    lacqBrim: M('lacqBrim', () => phys({color:0xd4631c, roughness:.3, clearcoat:.8})),
    saddle: M('saddle', () => std({color:0xa0582a, roughness:.55})),
    leatherBr: M('leatherBr', () => std({color:0x6b3a1f, roughness:.6})),
    copper: M('copper', () => std({color:0xb87333, metalness:1, roughness:.35})),
    merino: M('merino', () => phys({color:0x1c1a20, roughness:.85, sheen:.5, sheenColor:0x6a6470})),
    gunmetal: M('gunmetal', () => phys({color:0x3b3d42, roughness:.35, clearcoat:.6})),
    rose: M('rose', () => phys({color:0xd9728c, roughness:.45, sheen:1, sheenColor:0xffc0cf})),
    roseDk: M('roseDk', () => phys({color:0xb85a72, roughness:.45, sheen:1, sheenColor:0xffc0cf})),
    eraser: M('eraser', () => std({color:0xe88a9a, roughness:.6})),
    cedar: M('cedar', () => std({color:0xe8c89a, roughness:.7})),
    cream: M('creamE', () => std({color:0xf3eee6, roughness:.4})),
    graphiteE: M('graphiteE', () => std({color:0x2c2d32, roughness:.4})),
    strap: M('strap', () => std({color:0x1a1718, roughness:.6})),
    amber: M('amber', () => phys({color:0xffa347, roughness:.1, clearcoat:1, emissive:0xf5883a, emissiveIntensity:0})),
    hickory: M('hickory', () => std({map:K.tex(64, 64, (g,w,h) => { g.fillStyle = '#2e3a57'; g.fillRect(0,0,w,h); for (let x=0;x<w;x+=9){ g.fillStyle = '#e9e2d0'; g.fillRect(x,0,3,h); g.fillStyle = '#aeb6c6'; g.fillRect(x+5,0,1,h); } }, {repeat:[6,1]}), roughness:.9})),
    indigo: M('indigo', () => std({color:0x2e3a57, roughness:.9})),
    emerald: M('emerald', () => phys({color:0x1f8a52, roughness:.15, clearcoat:1, transparent:true, opacity:.82, depthWrite:false, side:THREE.DoubleSide})),
    felt: M('felt', () => phys({color:0xb99d72, roughness:.8, sheen:.4, sheenColor:0xffe8c0})),
    feltBrim: M('feltBrim', () => phys({color:0xa88d62, roughness:.8, sheen:.4, sheenColor:0xffe8c0, side:THREE.DoubleSide})),
    choc: M('choc', () => std({color:0x2b1a12, roughness:.8})),
    twill: M('twill', () => std({color:0x5d6340, roughness:.9, side:THREE.DoubleSide})),
    walnutH: M('walnutH', () => std({color:0x6b4226, roughness:.6})),
    capBand: M('capBand', () => std({color:0x16161a, roughness:.5})),
    capWhite: M('capWhite', () => phys({color:0xf6f3ee, roughness:.4, clearcoat:.3})),
    lacqBlack: M('lacqBlack', () => phys({color:0x0b0b0e, roughness:.08, clearcoat:1})),
    boards: M('boards', () => phys({color:0x101013, roughness:.2, clearcoat:1})),
    chart: M('chart', () => std({color:0xf1ece0, roughness:.8})),
    chartEnd: M('chartEnd', () => std({color:0xd8d0c0, roughness:.8})),
    ember: M('emberE', () => phys({color:0xf5883a, roughness:.3, clearcoat:.8})),
    oilskin: M('oilskin', () => phys({color:0xf2c230, roughness:.3, clearcoat:.9, clearcoatRoughness:.15, side:THREE.DoubleSide})),
    oilUnder: M('oilUnder', () => phys({color:0xdcab1c, roughness:.35, clearcoat:.7, side:THREE.DoubleSide})),
    stitch: M('stitch', () => std({color:0xb98b16, roughness:.6})),
    ice: M('ice', () => phys({color:0xeef3f7, roughness:.2, clearcoat:1})),
    herring: M('herring', () => std({map:K.tex(64, 64, (g,w,h) => { g.fillStyle = '#b3a48a'; g.fillRect(0,0,w,h); g.strokeStyle = '#8f7f66'; g.lineWidth = 1.4;
      for (let y=0;y<h;y+=6) for (let x=0;x<w;x+=8){ g.beginPath(); g.moveTo(x, y); g.lineTo(x+4, y+3); g.lineTo(x+8, y); g.stroke(); }
      for (let i=0;i<14;i++){ g.fillStyle = i%2 ? '#d9772f' : '#f3eee6'; g.fillRect((i*37)%w, (i*23)%h, 1.5, 1.5); } }, {repeat:[3,2]}), roughness:.95})),
    capBand2: M('capBand2', () => std({color:0x3a3128, roughness:.8})),
    capBtn: M('capBtn', () => std({color:0x9c8b70, roughness:.8})),
    capPeak: M('capPeak', () => std({color:0x8a7a61, roughness:.9})),
    canvasW: M('canvasW', () => std({color:0x8b7a55, roughness:.85})),
    canvasFlap: M('canvasFlap', () => std({color:0x6f6143, roughness:.85}))
  };
}
function liveMat(){ return new THREE.MeshBasicMaterial({color:K.TH.need.clone(), toneMapped:false}); }

/* ---- geometry helpers (robot-local; H = head space, Bd = body/hov space) ---- */
const G = {};
function grp(parent, x = 0, y = 0, z = 0){ const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
function bake(kit, parent, cast){ if (kit.size) K.bake(kit, parent, cast); }
const ring = (r, t, arc = TAU, seg = 32) => new THREE.TorusGeometry(r, t, 6, seg, arc);
/* a flat ribbon hugging the body along a tilted plane (the Research sash, the Chat Reader strap) */
function ribbon(tilt, width, cy = .45, yaw = 0){
  const prof = K.bodyPts, rAt = y => { for (let i=1;i<prof.length;i++) if (prof[i].y >= y){ const a = prof[i-1], b = prof[i]; return a.x + (b.x - a.x)*(y - a.y)/Math.max(1e-6, b.y - a.y); } return 0; };
  const pts = [], n = 48;
  for (let i=0;i<=n;i++){ const th = i/n*TAU; const dx = Math.cos(th), dy0 = Math.sin(th);
    // direction in the tilted plane: rotate the horizontal circle by `tilt` about the body's z axis (right shoulder to left hip)
    const dir = new THREE.Vector3(dx*Math.cos(tilt), dx*Math.sin(tilt), dy0).applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
    let r = 0; while (r < .35){ const y = cy + dir.y*r, rr = Math.hypot(dir.x*r, dir.z*r); if (rr > rAt(y) || y < 0 || y > .64) break; r += .004; }
    const p = new THREE.Vector3(dir.x*r, cy + dir.y*r, dir.z*r); const out = new THREE.Vector3(p.x, 0, p.z).normalize().multiplyScalar(.006); p.add(out); pts.push(p); }
  const pos = [], idx = [], nrm = [], uv = [], up = new THREE.Vector3(-Math.sin(tilt), Math.cos(tilt), 0).applyAxisAngle(new THREE.Vector3(0,1,0), yaw);
  pts.forEach((p, i) => { const o = new THREE.Vector3(p.x, 0, p.z).normalize(); for (const s of [-1,1]){ const q = p.clone().addScaledVector(up, s*width/2); pos.push(q.x, q.y, q.z); nrm.push(o.x, o.y, o.z); uv.push(i/n, s < 0 ? 0 : 1); } if (i < n) idx.push(i*2, i*2+1, i*2+2, i*2+1, i*2+3, i*2+2); });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return {geo:g, pts};
}
/* bend a brim: fn(x,y,z) -> [x,y,z] per vertex */
function bend(geo, fn){ const p = geo.attributes.position; for (let i=0;i<p.count;i++){ const r = fn(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, r[0], r[1], r[2]); } geo.computeVertexNormals(); return geo; }

/* ================= dress ================= */
export function dress(kit, a, R, def){
  K = kit; THREE = K.THREE; const O = OM(), MAT = K.MAT, part = K.part, cast = !K.PHONE;
  const {HALF, BRIM, PEAK} = K;
  const head = new Map(), body = new Map(), jH = new Map(), jB = new Map();
  R.o = def.outfit; R.jewel = []; R.pop = []; R.live = null; R.moving = [];
  const o = def.outfit;
  const mk = (parent, x, y, z) => grp(parent, x, y, z);
  const bk = (g, kitm) => { bake(kitm, g, cast); return g; };
  if (o === 'crown'){
    // the crown: velvet cap, brass band, ermine rim, 5 tall + 5 short faceted points, tip gems (earned), a live cabochon
    const cg = R.hatG = R.crown = mk(R.head, 0, .15, 0), c = new Map(), cj = new Map();
    part(c, HALF(.135), O.oxblood, 0, .02, 0, 0, 0, 0, 1, .6, 1);
    part(c, new THREE.CylinderGeometry(.158, .152, .06, 40, 1, true), MAT.brass, 0, -.005, 0);
    part(c, ring(.16, .014, TAU, 40), O.ermine, 0, -.04, 0, Math.PI/2);
    for (let i=0;i<5;i++){ const an = Math.PI/2 + i/5*TAU, an2 = an + TAU/10;
      part(c, new THREE.ConeGeometry(.032, .11, 4), MAT.brass, Math.cos(an)*.15, .08, Math.sin(an)*.15);
      part(c, new THREE.ConeGeometry(.022, .058, 4), MAT.brass, Math.cos(an2)*.15, .05, Math.sin(an2)*.15); }
    for (let i=0;i<10;i++){ const an = i/10*TAU; part(cj, new THREE.BoxGeometry(.007, .018, .004), O.fleck, Math.cos(an)*.172, -.04, Math.sin(an)*.172, 0, -an + Math.PI/2); }
    bk(cg, c); bake(cj, cg, false); R.jewel.push(...cg.children.slice(-1));
    R.gems = []; const gemOff = std({color:0xc9a45c, metalness:1, roughness:.3}), gemOn = phys({color:K.TH.need.clone(), roughness:.15, clearcoat:1, emissive:K.TH.need.clone(), emissiveIntensity:.8});
    for (let i=0;i<5;i++){ const an = Math.PI/2 + i/5*TAU, m = new THREE.Mesh(new THREE.SphereGeometry(.018, 12, 8), gemOff); m.position.set(Math.cos(an)*.15, .14, Math.sin(an)*.15); cg.add(m); R.gems.push(m); }
    R.gemMats = {off:gemOff, on:gemOn};
    R.live = liveMat(); const cab = new THREE.Mesh(new THREE.SphereGeometry(.021, 12, 8).scale(1, 1, .6), R.live); cab.position.set(0, -.005, .158); cg.add(cab);
    // the capelet: short, above the strip; collar + clasp
    const cape = R.cape = mk(R.hov, 0, .615, -.005), ck = new Map();
    part(ck, new THREE.CylinderGeometry(.15, .295, .31, 32, 1, true, Math.PI - 1.75, 3.5), O.oxblood, 0, -.155, 0);
    bk(cape, ck);
    part(body, ring(.13, .032, TAU, 32), O.ermine, 0, .625, 0, Math.PI/2, 0, 0, 1, 1, .75);
    for (const s of [-1,1]) part(jB, new THREE.SphereGeometry(.016, 8, 6), MAT.brass, s*.045, .6, .12);
    part(jB, ring(.045, .004, Math.PI, 12), MAT.brass, 0, .6, .12, 0, 0, Math.PI);
  } else if (o === 'headset'){
    // waistcoat (static), gold tie (spring), headset (moves: up/around the neck), crossed-keys pin
    for (const [a0, al] of [[.12, 2.88], [-3.0, 2.88]]) part(body, new THREE.CylinderGeometry(.168, .21, .27, 24, 1, true, a0, al), O.violet, 0, .435, 0, 0, 0, 0, 1.015);
    for (const s of [-1,1]) part(body, new THREE.BoxGeometry(.05, .15, .008), O.violetHi, s*.042, .49, .172, -.35, 0, s*.3);
    for (const y of [.31, .345, .38]) part(jB, new THREE.SphereGeometry(.009, 8, 6), MAT.brass, -.03, y, .2);
    const tie = R.tie = mk(R.hov, 0, .555, .13), tk = new Map();
    part(tk, new THREE.BoxGeometry(.042, .034, .03), O.silk, 0, 0, 0);
    part(tk, new THREE.ConeGeometry(.034, .19, 4).rotateX(Math.PI), O.silk, 0, -.1, .038, -.3, 0, 0, 1, 1, .28); bk(tie, tk);
    const hs = R.faceG = mk(R.head, 0, 0, 0), hk = new Map();
    part(hk, ring(.2, .017, Math.PI, 40), O.leatherG, 0, .02, 0, 0, Math.PI/2, 0);
    part(hk, ring(.19, .004, Math.PI, 40), MAT.brass, 0, .02, 0, 0, Math.PI/2, 0);
    for (const s of [-1,1]){ part(hk, new THREE.CylinderGeometry(.07, .07, .05, 24), O.leatherK, s*.222, -.005, 0, 0, 0, Math.PI/2);
      part(hk, new THREE.CylinderGeometry(.071, .071, .018, 24), O.violet, s*.235, -.005, 0, 0, 0, Math.PI/2); }
    const boom = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(.235,-.03,.03), new THREE.Vector3(.2,-.1,.13), new THREE.Vector3(.09,-.115,.2)]), 12, .006, 6);
    part(hk, boom, O.leatherK); bk(hs, hk);
    R.live = liveMat(); const mic = new THREE.Mesh(new THREE.SphereGeometry(.02, 10, 8), R.live); mic.position.set(.085, -.115, .205); hs.add(mic);
    // crossed keys (jewelry) + the glint sprite
    for (const s of [-1,1]){ const r = s*.61; part(jB, new THREE.BoxGeometry(.007, .058, .004), O.brassPol, -.128, .47, .19, 0, 0, r); part(jB, ring(.011, .003, TAU, 12), O.brassPol, -.128 - Math.sin(r)*.03, .47 + Math.cos(r)*.03, .19); }
    R.glint = new THREE.Sprite(new THREE.SpriteMaterial({map:K.glowTex, color:0xfff1d6, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false})); R.glint.scale.setScalar(.08); R.glint.position.set(-.128, .47, .2); R.hov.add(R.glint); R.glintT = 9;
  } else if (o === 'hardhat'){
    const hg = R.hatG = mk(R.head, 0, .105, 0), k = new Map();
    part(k, HALF(.188, 32), O.lacqOrange, 0, 0, 0, 0, 0, 0, 1, .8, 1.08);
    part(k, ring(.17, .02, Math.PI, 24), O.lacqRidge, 0, 0, 0, 0, Math.PI/2, 0, 1, .82, 1.08);
    part(k, BRIM(.222), O.lacqBrim, 0, .005, 0); part(k, PEAK(.245), O.lacqBrim, 0, .006, .02);
    part(k, new THREE.CylinderGeometry(.028, .03, .03, 16), MAT.brass, 0, .05, .2, Math.PI/2); bk(hg, k);
    R.live = new THREE.MeshBasicMaterial({color:0xfff1d6, toneMapped:false}); const lens = new THREE.Mesh(new THREE.CircleGeometry(.018, 14), R.live); lens.position.set(0, .05, .216); hg.add(lens);
    R.lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({map:K.glowTex, color:0xfff1d6, transparent:true, opacity:.16, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false})); R.lampGlow.scale.setScalar(.16); R.lampGlow.position.set(0, .05, .23); hg.add(R.lampGlow);
    // decals (earned: one per page shipped this week)
    R.decals = []; const dm = [O.cream, O.graphiteE, MAT.brass];
    [-40, 40, -80, 80, -120, 120].forEach((az, i) => { const a_ = az*Math.PI/180, el = 35*Math.PI/180; const n = new THREE.Vector3(Math.sin(a_)*Math.cos(el), Math.sin(el)*.8, Math.cos(a_)*Math.cos(el)*1.08).normalize();
      const m = new THREE.Mesh(new THREE.CircleGeometry(.02, 14), dm[i%3]); m.position.copy(new THREE.Vector3(Math.sin(a_)*Math.cos(el)*.19, Math.sin(el)*.152, Math.cos(a_)*Math.cos(el)*.205)); m.lookAt(m.position.clone().add(n)); m.visible = false; hg.add(m); R.decals.push(m); });
    // the tool rig
    part(body, ring(.207, .022, TAU, 48), O.saddle, 0, .167, 0, Math.PI/2);
    for (const [w, h, x, y] of [[.056,.008,0,.187],[.056,.008,0,.147],[.008,.04,-.024,.167],[.008,.04,.024,.167]]) part(body, new THREE.BoxGeometry(w, h, .008), MAT.brass, x, y, .22);
    for (const s of [-1,1]){ part(body, new THREE.BoxGeometry(.1, .13, .065), O.leatherBr, s*.215, .1, .07, 0, s*.9, 0); part(body, new THREE.BoxGeometry(.1, .05, .07), MAT.leather, s*.215, .17, .072, 0, s*.9, 0);
      part(jB, new THREE.SphereGeometry(.006, 6, 4), O.copper, s*.2, .14, .12); }
    part(body, new THREE.CylinderGeometry(.011, .011, .17, 8), MAT.wood, -.225, .12, .07, 0, 0, .15); part(body, new THREE.BoxGeometry(.075, .028, .028), MAT.steel, -.237, .2, .07, 0, 0, .15);
    part(body, new THREE.CylinderGeometry(.028, .028, .022, 14), MAT.brass, .25, .06, .1, 0, 0, Math.PI/2);
  } else if (o === 'beret'){
    const bg = R.hatG = mk(R.head, 0, .12, 0), k = new Map();
    part(k, new THREE.SphereGeometry(.2, 24, 12), O.merino, -.05, .025, 0, 0, 0, .24, 1.12, .26, 1.08);
    part(k, new THREE.CylinderGeometry(.008, .01, .032, 8), O.merino, -.08, .08, 0, 0, 0, .24); bk(bg, k);
    part(jH, ring(.17, .007, TAU, 24), O.choc, 0, .1, 0, Math.PI/2);
    const pen = R.pencil = mk(R.head, .2, .03, -.01), pk = new Map();
    part(pk, new THREE.CylinderGeometry(.012, .012, .23, 6), O.gunmetal, 0, 0, 0); part(pk, new THREE.CylinderGeometry(.013, .013, .022, 6), MAT.brass, 0, .12, 0);
    part(pk, new THREE.BoxGeometry(.024, .02, .012), O.eraser, 0, .14, 0); part(pk, new THREE.ConeGeometry(.012, .04, 6).rotateX(Math.PI), O.cedar, 0, -.135, 0); bk(pen, pk);
    pen.rotation.set(Math.PI/2 - .35, 0, .4); R.pencilHome = {p:pen.position.clone(), r:pen.rotation.clone()};
    part(body, ring(.075, .024, TAU, 24), O.rose, 0, .66, 0, Math.PI/2); part(body, new THREE.SphereGeometry(.03, 10, 8), O.rose, .03, .645, .085);
    const tails = R.tie = mk(R.hov, .03, .64, .1), tk = new Map();
    part(tk, new THREE.BoxGeometry(.045, .13, .008), O.rose, -.02, -.07, 0, -.25, 0, .3); part(tk, new THREE.BoxGeometry(.045, .12, .008), O.roseDk, .03, -.065, .005, -.25, 0, -.3); bk(tails, tk);
    // the swatch fan: 5 strips on a brass rivet; opens to A/B/C while waiting on FilthE
    const fan = R.prop = new THREE.Group(); R.fan = []; const cols = [O.lacqOrange, O.cream, O.graphiteE, MAT.brass, O.rose];
    cols.forEach((m, i) => { const s = new THREE.Mesh(new THREE.BoxGeometry(.034, .175, .005).translate(0, .08, 0), m); s.position.z = i*.006; fan.add(s); R.fan.push(s); });
    fan.add(new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .04, 10).rotateX(Math.PI/2), MAT.brass)); R.hands[0].add(fan);
  } else if (o === 'goggles'){
    // reversed hickory welder's cap (static head) + goggles on a hinge (faceG) + chest gauge + big spanner
    part(head, new THREE.SphereGeometry(.19, 24, 12), O.hickory, 0, .105, 0, 0, 0, 0, 1.02, .45, 1.06);
    part(head, PEAK(.12), O.indigo, 0, .11, -.16, -.25, Math.PI, 0); part(head, new THREE.SphereGeometry(.013, 8, 6), O.indigo, 0, .19, 0);
    const gg = R.faceG = mk(R.head, 0, .12, 0), k = new Map();
    part(k, ring(.198, .012, TAU, 40), O.strap, 0, -.02, 0, Math.PI/2);
    for (const s of [-1,1]){ part(k, new THREE.CylinderGeometry(.056, .06, .05, 20), MAT.brass, s*.08, .015, .16, Math.PI/2); }
    part(k, new THREE.BoxGeometry(.064, .016, .02), MAT.brass, 0, .015, .17); bk(gg, k);
    R.lenses = O.amber.clone(); for (const s of [-1,1]){ const l = new THREE.Mesh(new THREE.CircleGeometry(.042, 18), R.lenses); l.position.set(s*.08, .015, .186); gg.add(l); }
    const gauge = R.gauge = mk(R.hov, .1, .46, .19);
    gauge.lookAt(new THREE.Vector3(.1*3, .46, .19*3)); const gk = new Map();
    part(gk, new THREE.CylinderGeometry(.047, .047, .022, 24), MAT.brass, 0, 0, 0, Math.PI/2);
    bk(gauge, gk); const face = new THREE.Mesh(new THREE.CircleGeometry(.036, 24), std({map:K.tex(64, 64, (g,w,h) => { g.fillStyle = '#f1ece0'; g.fillRect(0,0,w,h); g.strokeStyle = '#141416'; g.lineWidth = 2;
      for (let i=0;i<=10;i++){ const an = (-135 + i*27)*Math.PI/180 - Math.PI/2; g.beginPath(); g.moveTo(32 + Math.cos(an)*22, 32 + Math.sin(an)*22); g.lineTo(32 + Math.cos(an)*28, 32 + Math.sin(an)*28); g.stroke(); } g.fillStyle = '#f5883a'; g.beginPath(); g.arc(32 + Math.cos(Math.PI/4 - Math.PI/2 + Math.PI/2)*25, 32 - 18, 3, 0, TAU); g.fill(); }), roughness:.5}));
    face.position.z = .012; gauge.add(face);
    R.needle = new THREE.Group(); R.needle.position.z = .014; gauge.add(R.needle); const nd = new THREE.Mesh(new THREE.BoxGeometry(.003, .03, .002).translate(0, .015, 0), std({color:0x141416})); R.needle.add(nd);
    const pk = new Map(); part(pk, new THREE.BoxGeometry(.032, .21, .014), MAT.chrome, 0, -.02, 0);
    part(pk, ring(.036, .012, Math.PI*1.3, 14), MAT.chrome, 0, .11, 0, 0, 0, -Math.PI*.15); part(pk, ring(.024, .009, TAU, 14), MAT.chrome, 0, -.14, 0);
    const pr = R.prop = new THREE.Group(); bake(pk, pr, false); R.hands[0].add(pr);
  } else if (o === 'glasses'){
    // emerald eyeshade (hatG), brass spectacles (own group), loupe (faceG), clipboard with real ticks (prop), PASS pin
    const hg = R.hatG = mk(R.head, 0, .085, 0), k = new Map();
    part(k, new THREE.CylinderGeometry(.192, .192, .03, 40, 1, true), O.strap, 0, -.01, 0); bk(hg, k);
    const vis = new THREE.Mesh(new THREE.RingGeometry(.19, .3, 32, 1, Math.PI/2 - .95, 1.9).rotateX(-Math.PI/2), O.emerald); vis.rotation.x = .38; vis.position.y = .01; vis.scale.z = 1.08; vis.renderOrder = 5; hg.add(vis);
    const vb = new THREE.Mesh(ring(.3, .005, 1.9, 32).rotateX(-Math.PI/2).rotateY(Math.PI/2 - .95 + 0), MAT.brass); vb.rotation.x = .38; vb.position.y = .01; hg.add(vb); R.jewel.push(vb);
    const sp = R.specs = mk(R.head, 0, 0, 0), sk = new Map();
    for (const s of [-1,1]){ part(sk, ring(.06, .009, TAU, 28), MAT.brass, s*.07, 0, .176); part(sk, new THREE.CylinderGeometry(.005, .005, .12, 6), MAT.brass, s*.125, 0, .115, Math.PI/2); part(sk, new THREE.CircleGeometry(.057, 20), MAT.glassTop, s*.07, 0, .178); }
    part(sk, ring(.018, .006, Math.PI, 12), MAT.brass, 0, .015, .178); bk(sp, sk);
    const lp = R.faceG = mk(R.head, .13, .058, .176), lk = new Map();
    part(lk, new THREE.CylinderGeometry(.024, .022, .045, 16), MAT.brass, -.06, -.058, .03, Math.PI/2); part(lk, new THREE.CylinderGeometry(.02, .02, .01, 16), O.strap, -.06, -.058, .057, Math.PI/2); bk(lp, lk);
    const cb = R.prop = new THREE.Group(), ck = new Map();
    part(ck, new THREE.BoxGeometry(.15, .2, .012), O.saddle, 0, 0, 0); part(ck, new THREE.BoxGeometry(.06, .03, .02), MAT.brass, 0, .095, .008); bake(ck, cb, false);
    R.tally = {c:null}; R.tally.t = K.tex(48, 64, (g,w,h) => { g.fillStyle = '#f1ece0'; g.fillRect(0,0,w,h); const p = R.tallyP || {done:0, of:0}; const of = Math.max(1, Math.min(8, p.of || 6)), dn = Math.round(Math.min(1, (p.done||0)/Math.max(1, p.of||1))*of);
      for (let i=0;i<of;i++){ const y = 6 + i*7; g.fillStyle = 'rgba(40,40,40,.35)'; g.fillRect(14, y+2, 28, 2); if (i < dn){ g.strokeStyle = '#2f7a4a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(4, y+2); g.lineTo(6.5, y+4.5); g.lineTo(10.5, y-.5); g.stroke(); } } });
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(.12, .16), std({map:R.tally.t, roughness:.85})); paper.position.z = .0075; cb.add(paper); R.hands[0].add(cb);
    const pin = R.passPin = mk(R.hov, .1, .44, .2), pk2 = new Map();
    part(pk2, new THREE.CylinderGeometry(.024, .024, .006, 20), O.cream, 0, 0, 0, Math.PI/2); part(pk2, ring(.024, .003, TAU, 20), MAT.brass, 0, 0, .003);
    part(pk2, new THREE.BoxGeometry(.004, .012, .002), MAT.brass, -.005, -.002, .004, 0, 0, .7); part(pk2, new THREE.BoxGeometry(.004, .022, .002), MAT.brass, .004, .003, .004, 0, 0, -.6); bk(pin, pk2); pin.visible = false;
  } else if (o === 'explorer'){
    // fedora (hatG), scout sash with badges (earned), magnifier (prop), scouts (sprites)
    const hg = R.hatG = mk(R.head, 0, .12, 0), k = new Map();
    const crown = new THREE.LatheGeometry([[0,.135],[.1,.15],[.14,.13],[.155,.08],[.158,0]].map(p => new THREE.Vector2(p[0], p[1])).reverse(), 24);
    bend(crown, (x, y, z) => { z *= 1.12; if (z > .06) x *= 1 - .3*(z - .06)/.12; return [x, y, z]; });
    part(k, crown, O.felt, 0, .005, 0);
    part(k, new THREE.CylinderGeometry(.158, .16, .042, 24), O.choc, 0, .028, 0, 0, 0, 0, 1, 1, 1.12);
    const brim = bend(new THREE.CylinderGeometry(.305, .305, .012, 40), (x, y, z) => { z *= 1.12; if (z > .15) y -= (z - .15)*.35; if (z < -.15) y += (-z - .15)*.2; return [x, y, z]; });
    part(k, brim, O.feltBrim, 0, .005, 0); bk(hg, k);
    part(jH, new THREE.CylinderGeometry(.015, .015, .006, 12), MAT.brass, -.165, .15, 0, 0, 0, Math.PI/2);
    const sash = ribbon(-.6, .05); part(body, sash.geo, O.twill);
    R.badges = []; const faces = [O.cream, O.ember, O.graphiteE, O.rose, std({color:0xecd296, roughness:.4})];
    const front = sash.pts.filter(p => p.z > .08).sort((p, q) => q.y - p.y);
    for (let i=0;i<6;i++){ const p = front[Math.min(front.length - 1, Math.round((i + .5)*front.length/6))]; if (!p) break;
      const b = new THREE.Group(); b.position.copy(p).add(new THREE.Vector3(0, 0, .006)); b.lookAt(p.clone().multiplyScalar(2).setY(p.y));
      b.add(new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .005, 16).rotateX(Math.PI/2), faces[i%5])); b.add(new THREE.Mesh(ring(.02, .004, TAU, 16), MAT.brass)); b.visible = false; R.hov.add(b); R.badges.push(b); }
    const pk = new Map(); part(pk, new THREE.CylinderGeometry(.013, .015, .12, 8), O.walnutH, 0, -.06, 0); part(pk, new THREE.CylinderGeometry(.016, .016, .02, 8), MAT.brass, 0, .005, 0);
    part(pk, ring(.062, .013, TAU, 32), MAT.brass, 0, .08, 0); part(pk, new THREE.CircleGeometry(.058, 24), MAT.glassTop, 0, .08, 0);
    const pr = R.prop = new THREE.Group(); bake(pk, pr, false); R.hands[0].add(pr);
    R.scouts = [0,1,2].map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({map:K.glowTex, color:0xffb070, transparent:true, opacity:.9, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false})); s.scale.setScalar(.06); s.visible = false; R.head.add(s); return s; });
  } else if (o === 'captain'){
    const hg = R.hatG = mk(R.head, 0, .1, 0), k = new Map();
    part(k, new THREE.CylinderGeometry(.168, .162, .085, 32), O.capBand, 0, .048, 0);
    part(k, new THREE.CylinderGeometry(.232, .2, .045, 36), O.capWhite, 0, .105, -.01);
    part(k, PEAK(.165), O.lacqBlack, 0, .008, .07, .3); part(k, ring(.166, .005, Math.PI, 32), MAT.brass, 0, .015, 0, 0, 0, 0);
    part(k, ring(.027, .008, TAU, 20), MAT.brass, 0, .048, .172); bk(hg, k);
    R.live = liveMat(); const badge = new THREE.Mesh(new THREE.CircleGeometry(.014, 14), R.live); badge.position.set(0, .048, .18); hg.add(badge);
    R.leaves = []; const leafG = new THREE.SphereGeometry(.012, 8, 6);
    for (let i=0;i<10;i++){ const s = i < 5 ? -1 : 1, j = i % 5, an = s*(.35 + j*.22); const m = new THREE.Mesh(leafG, MAT.brass); m.scale.set(1.7, .45, 1); m.position.set(Math.sin(an)*.2, .025, .07 + Math.cos(an)*.13); m.rotation.y = an; m.visible = false; hg.add(m); R.leaves.push(m); }
    for (const s of [-1,1]){ part(body, new THREE.BoxGeometry(.124, .012, .06), O.boards, s*.17, .548, 0, 0, 0, -s*.62);
      for (let b=0;b<4;b++){ const u = -.036 + b*.024; part(body, new THREE.BoxGeometry(.009, .004, .05), MAT.brass, s*(.17 + u*Math.cos(.62)), .548 - u*Math.sin(.62) + .007, 0, 0, 0, -s*.62); } }
    for (const y of [.33, .39, .45]) for (const s of [-1,1]){ const r = y < .4 ? .208 : .19; part(body, new THREE.SphereGeometry(.012, 8, 6), MAT.brass, s*.05, y, Math.sqrt(r*r - .0025) + .004); }
    const pk = new Map(); part(pk, new THREE.CylinderGeometry(.025, .025, .22, 16), O.chart, 0, 0, 0); part(pk, new THREE.CylinderGeometry(.026, .026, .018, 16), O.ember, 0, .03, 0);
    for (const s of [-1,1]) part(pk, new THREE.CircleGeometry(.025, 12), O.chartEnd, 0, s*.111, 0, -s*Math.PI/2);
    const pr = R.prop = new THREE.Group(); bake(pk, pr, false); R.hands[0].add(pr);
  } else if (o === 'rainhat'){
    const hg = R.hatG = mk(R.head, 0, .1, 0), k = new Map();
    part(k, HALF(.172), O.oilskin, 0, .01, 0, 0, 0, 0, 1.05, .85, 1.05);
    const brim = bend(new THREE.CylinderGeometry(.27, .27, .014, 40), (x, y, z) => { if (z < 0){ const z2 = z*1.25; return [x, y - .09*(-z2/.34), z2]; } return [x, y - .012*(z/.27), z*.78]; });
    part(k, brim, O.oilUnder, 0, .015, 0); bk(hg, k);
    for (const r of [.13, .08]) part(jH, ring(r, .003, TAU, 24), O.stitch, 0, .11 + .085*(1 - r/.172), 0, Math.PI/2);
    const mast = R.mast = mk(hg, .075, .1, -.02), mk2 = new Map();
    part(mk2, new THREE.CylinderGeometry(.006, .006, .22, 8), MAT.brass, 0, .11, 0); bk(mast, mk2);
    const an = R.anemo = mk(mast, 0, .22, 0), ak = new Map();
    part(ak, new THREE.SphereGeometry(.011, 8, 6), MAT.brass, 0, 0, 0);
    for (let i=0;i<3;i++){ const th = i/3*TAU; part(ak, new THREE.CylinderGeometry(.003, .003, .05, 5), MAT.brass, Math.cos(th)*.025, 0, Math.sin(th)*.025, 0, -th, Math.PI/2);
      part(ak, HALF(.017, 10), MAT.brass, Math.cos(th)*.05, 0, Math.sin(th)*.05, 0, -th, Math.PI/2); }
    bk(an, ak);
    R.live = liveMat(); const beacon = new THREE.Mesh(new THREE.SphereGeometry(.021, 12, 10), R.live); beacon.position.y = .26; mast.add(beacon); R.tip = beacon;
    const collar = R.cape = mk(R.hov, 0, .65, 0), ck = new Map();
    part(ck, new THREE.CylinderGeometry(.105, .165, .1, 28, 1, true, .06, TAU - .12), O.oilskin, 0, 0, 0); bk(collar, ck);
    for (let i=0;i<4;i++) part(jB, new THREE.SphereGeometry(.008, 6, 4), MAT.brass, 0, .62 + i*.022, .14 - i*.012);
    R.pins = []; for (let i=0;i<8;i++){ const th = Math.PI/2 + (i - 3.5)*.3; const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.009, 0), O.ice); m.position.set(Math.cos(th)*.18, .03, Math.sin(th)*.18); m.visible = false; hg.add(m); R.pins.push(m); }
  } else if (o === 'newsboy'){
    const hg = R.hatG = mk(R.head, 0, .1, 0), k = new Map();
    part(k, new THREE.SphereGeometry(.205, 24, 12), O.herring, 0, .04, .02, 0, 0, 0, 1.03, .4, 1.1);
    part(k, new THREE.CylinderGeometry(.176, .176, .032, 32), O.capBand2, 0, 0, 0); part(k, new THREE.SphereGeometry(.02, 8, 6), O.capBtn, 0, .12, .02);
    part(k, PEAK(.14), O.capPeak, 0, 0, .135, .25); bk(hg, k);
    const card = R.card = mk(hg, .14, .09, .08);
    const cardT = (back) => K.tex(128, 88, (g,w,h) => { g.fillStyle = '#f6f1e6'; g.fillRect(0,0,w,h); g.strokeStyle = 'rgba(0,0,0,.25)'; g.strokeRect(3,3,w-6,h-6);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '600 ' + (back ? 26 : 30) + 'px Geist, system-ui, sans-serif'; g.fillStyle = back ? '#f5883a' : '#141414';
      g.fillText(back ? '¡EXTRA!' : (K.HUB.lang === 'es' ? 'PRENSA' : 'PRESS'), w/2, h/2 + 2); });
    R.cardFront = cardT(false); const cf = new THREE.Mesh(new THREE.PlaneGeometry(.088, .06), std({map:R.cardFront, roughness:.6})); cf.position.z = .002; card.add(cf);
    const cbk = new THREE.Mesh(new THREE.PlaneGeometry(.088, .06), std({map:cardT(true), roughness:.6})); cbk.rotation.y = Math.PI; cbk.position.z = -.002; card.add(cbk);
    card.rotation.set(0, .5, -.28);
    // satchel + strap
    part(body, new THREE.BoxGeometry(.13, .11, .05), O.canvasW, .23, .36, .03, 0, .5, 0); part(body, new THREE.BoxGeometry(.132, .045, .054), O.canvasFlap, .232, .39, .032, 0, .5, 0);
    for (const dx of [-.02, .02]) part(body, new THREE.CylinderGeometry(.013, .013, .07, 8), MAT.paper, .22 + dx, .43, .03);
    part(jB, new THREE.BoxGeometry(.02, .016, .006), MAT.brass, .245, .38, .06, 0, .5, 0);
    part(body, ribbon(-.55, .025, .47).geo, MAT.leatherDark);
    // the broadsheet (prop): two leaves hinged, a masthead by language
    R.paperT = K.tex(128, 160, (g,w,h) => { g.fillStyle = '#efe9dc'; g.fillRect(0,0,w,h); g.fillStyle = '#141414'; g.textAlign = 'center'; g.font = '600 12px Geist, system-ui, sans-serif';
      g.fillText(K.HUB.lang === 'es' ? 'EL DIARIO DEL EQUIPO' : 'THE CREW TIMES', w/2, 16); g.fillRect(8, 22, w - 16, 1.5);
      for (let c=0;c<3;c++) for (let r=0;r<14;r++){ g.fillStyle = 'rgba(20,20,20,' + (.25 + (r%3)*.1) + ')'; g.fillRect(10 + c*38, 32 + r*9, 32 - (r*7 + c*3)%10, 2.5); } });
    R.paperLang = K.HUB.lang;
    const pr = R.prop = new THREE.Group(), pm = std({map:R.paperT, roughness:.85, side:THREE.DoubleSide});
    const l1 = new THREE.Mesh(new THREE.PlaneGeometry(.14, .18).translate(-.07, 0, 0), pm), l2 = new THREE.Mesh(new THREE.PlaneGeometry(.14, .18).translate(.07, 0, 0), pm);
    l1.rotation.y = .35; l2.rotation.y = -.35; pr.add(l1, l2); R.leavesP = [l1, l2]; R.hands[0].add(pr);
  }
  bake(head, R.head, cast); bake(body, R.hov, cast);
  const nH = R.head.children.length, nB = R.hov.children.length;
  bake(jH, R.head, false); bake(jB, R.hov, false);
  R.jewel.push(...R.head.children.slice(nH), ...R.hov.children.slice(nB));
  // home transforms of the moving groups (the state grammar animates offsets from these)
  for (const k of ['hatG','faceG','prop','cape','tie','card','anemo','pencil','specs','mast']){ const g = R[k]; if (g) g.userData.home = {p:g.position.clone(), r:g.rotation.clone(), s:g.scale.clone()}; }
  // the real top of the headwear (head space), for the overlay anchor (replaces the magic R.hat offsets)
  const box = new THREE.Box3(); R.head.updateMatrixWorld(true); let top = .125;
  const inv = new THREE.Matrix4().copy(R.head.matrixWorld).invert();
  R.head.traverse(m => { if (m.isMesh && m !== R.tip){ m.geometry.computeBoundingBox(); box.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld).applyMatrix4(inv); top = Math.max(top, box.max.y); } });
  R.hat = Math.max(0, (top - .125))*1.24*.8;
  R.gearSeen = -1; R.gearProg = '';
}

/* ================= the state grammar ================= */
const lerp = (a, b, k) => a + (b - a)*k;
function ease(g, dt, k, p, r, s){ const h = g.userData.home; if (!h) return; const q = Math.min(1, dt*k);
  g.position.set(lerp(g.position.x, h.p.x + (p[0]||0), q), lerp(g.position.y, h.p.y + (p[1]||0), q), lerp(g.position.z, h.p.z + (p[2]||0), q));
  g.rotation.set(lerp(g.rotation.x, h.r.x + (r[0]||0), q), lerp(g.rotation.y, h.r.y + (r[1]||0), q), lerp(g.rotation.z, h.r.z + (r[2]||0), q));
  const sc = s || 1; g.scale.set(lerp(g.scale.x, h.s.x*(Array.isArray(sc) ? sc[0] : sc), q), lerp(g.scale.y, h.s.y*(Array.isArray(sc) ? sc[1] : sc), q), lerp(g.scale.z, h.s.z*(Array.isArray(sc) ? sc[2] : sc), q)); }
const OFF = null;
export function stateOf(a, sim){
  const p = sim.pose;
  if (p === 'sleep') return 'sleep';
  if (p === 'cheer') return 'done';
  if (a.st === 'waiting' && (p === 'wait' || p === 'queue')) return 'wait';
  if (p === 'blocked') return 'blocked';
  if (a.st === 'working' && (p === 'type' || p === 'read' || p === 'radar' || p === 'meet' || p === 'zone')) return 'work';
  if (p === 'ride') return 'ride';
  return 'idle';
}
function popIn(R, m){ R.pop.push({m, t:0}); m.visible = true; m.scale.setScalar(.001); }
export function animOutfit(kit, a, sim, R, t, dt, info){
  K = kit; THREE = K.THREE;
  const rm = K.RM.matches, S = stateOf(a, sim), o = R.o, br = info.breath, k8 = rm ? 1 : Math.min(1, dt*6);
  const wig = (f, amp, ph = 0) => rm ? 0 : Math.sin(t*f + sim.phase + ph)*amp;
  const cheerK = sim.pose === 'cheer' ? Math.min(1, sim.poseT/1.2) : 1, flour = sim.pose === 'cheer' && !rm ? Math.sin(cheerK*Math.PI) : 0;
  // live light: on while working or waiting (pulses with the breath while waiting), off when blocked / asleep / idle
  if (R.live){ const on = S === 'work' || S === 'wait' || S === 'done' || S === 'ride'; const tgt = o === 'hardhat' ? (S === 'work' ? 1 : 0) : on ? (S === 'wait' ? .35 + .65*br : 1) : 0;
    R.liveK = lerp(R.liveK ?? tgt, tgt, k8); const base = o === 'hardhat' ? LAMP_W : K.TH.need; R.live.color.copy(OFFC).lerp(base, R.liveK); if (R.lampGlow) R.lampGlow.material.opacity = .16*R.liveK; }
  // earned gear (agent.gear from the page; bump -> pop the new piece)
  const gear = a.gear || {}, count = Math.max(0, gear.count | 0), prog = gear.progress || null;
  const earned = (list, n) => { if (!list) return; list.forEach((m, i) => { const want = i < n; if (want && !m.visible){ if (R.gearSeen >= 0 && !rm) popIn(R, m); else { m.visible = true; m.scale.setScalar(1); } } else if (!want) m.visible = false; }); };
  earned(R.decals, Math.min(6, count)); earned(R.badges, Math.min(6, count)); earned(R.leaves, Math.min(10, count)); earned(R.pins, Math.min(8, count));
  if (R.gems) R.gems.forEach((g, i) => { const on = i < Math.min(5, count); g.material = on ? R.gemMats.on : R.gemMats.off; if (on && R.gearSeen >= 0 && i === Math.min(5, count) - 1 && R.gearSeen < count && !rm) popIn(R, g); R.gemMats.on.color.copy(K.TH.need); R.gemMats.on.emissive.copy(K.TH.need); });
  if (R.passPin){ const want = !!gear.flag; if (want && !R.passPin.visible){ if (R.gearSeen >= 0 && !rm) popIn(R, R.passPin); else R.passPin.visible = true; } else if (!want) R.passPin.visible = false; }
  R.gearSeen = count;
  for (let i = R.pop.length - 1; i >= 0; i--){ const p = R.pop[i]; p.t += dt; const k = Math.min(1, p.t/.5); const s = k < .6 ? k/.6*1.3 : 1.3 - (k - .6)/.4*.3; p.m.scale.setScalar(Math.max(.001, s)); if (k >= 1){ p.m.scale.setScalar(1); R.pop.splice(i, 1); } }
  const ps = prog ? (prog.done|0) + '/' + (prog.of|0) : ''; if (R.tally && ps !== R.gearProg){ R.gearProg = ps; R.tallyP = prog || {done:0, of:0}; K.redraw(R.tally.t); }
  // outfit by outfit (offsets from the home pose: [pos], [rot], scale)
  if (o === 'crown'){
    const c = R.hatG, cap = R.cape;
    if (S === 'wait') ease(c, dt, 5, [0,0,.01], [.14,0,0]); else if (S === 'blocked') ease(c, dt, 5, [.02,0,0], [0,0,-.17]);
    else if (S === 'sleep') ease(c, dt, 3, [0,-.03,-.01], [-.26,0,0]); else if (S === 'idle') ease(c, dt, 4, [0,0,-.005], [-.17,0,0]);
    else ease(c, dt, 5, [], []);
    if (sim.pose === 'cheer' && !rm) c.rotation.y = c.userData.home.r.y + cheerK*TAU; else c.rotation.y = lerp(c.rotation.y, 0, k8);
    const ride = S === 'ride' && sim.ride && sim.ride.kind === 'tube';
    ease(cap, dt, ride ? 10 : 4, [], [ride ? -1.2 : S === 'sleep' ? .25 : wig(.8, .035) + (info.swish || 0), 0, 0], S === 'sleep' ? [.9, 1, 1] : 1);
    if (R.live && S === 'blocked') R.live.color.copy(OFFC);
  } else if (o === 'headset'){
    const h = R.faceG, tie = R.tie;
    if (S === 'sleep' || S === 'idle' && sim.pose === 'coffee') ease(h, dt, 4, [0,-.16,0], [1.75,0,0]); else if (S === 'blocked') ease(h, dt, 5, [0,.01,0], [0,0,.26]);
    else if (S === 'wait') ease(h, dt, 5, [], [-.1,0,0]); else ease(h, dt, 5, [], [S === 'work' ? wig(2.2, .05) : 0, 0, 0]);
    ease(tie, dt, sim.pose === 'cheer' ? 8 : 4, [], [sim.pose === 'cheer' ? -1.0*flour : wig(1.3, .05) + (info.swish || 0)*.6, 0, 0]);
    if (R.glint){ R.glintT += dt; const k = R.glintT/.3; R.glint.material.opacity = k < 1 ? Math.sin(k*Math.PI)*.9 : 0; R.glint.position.x = -.14 + Math.min(1, k)*.03; }
  } else if (o === 'hardhat'){
    const h = R.hatG;
    if (S === 'wait') ease(h, dt, 5, [0, -.52, .17], [-1.45, 0, 0], .95);            // hat in hand, held to the chest
    else if (S === 'blocked') ease(h, dt, 5, [0,.01,-.02], [-.35,0,0]); else if (S === 'sleep') ease(h, dt, 3, [0,-.02,.02], [.44,0,0]);
    else if (S === 'idle') ease(h, dt, 4, [], [0,0,.14]); else ease(h, dt, 6, [0, sim.pose === 'cheer' ? .08*flour : 0, 0], [0,0,0]);
    if (S === 'work' && sim.pose === 'type' && !rm) h.position.y += Math.max(0, Math.sin(t*7 + sim.phase))*.004;
  } else if (o === 'beret'){
    const b = R.hatG, pen = R.pencil, fan = R.prop, tails = R.tie;
    if (S === 'blocked') ease(b, dt, 4, [0,-.03,0], [0,0,.35]); else if (S === 'sleep') ease(b, dt, 3, [0,-.05,.02], [.55,0,0]);
    else if (S === 'wait') ease(b, dt, 5, [], [0,0,-.2]); else if (S === 'work') ease(b, dt, 4, [], [0,0,.1]); else ease(b, dt, 4, [], []);
    if (sim.pose === 'cheer' && !rm) b.rotation.y = cheerK*TAU; else b.rotation.y = lerp(b.rotation.y, 0, k8);
    // pencil: ear <-> hand
    const inHand = S === 'work'; if (inHand !== R.penInHand){ R.penInHand = inHand; (inHand ? R.hands[1] : R.head).add(pen); }
    if (inHand){ pen.position.lerp(V(0, .05, .04), k8); pen.rotation.set(lerp(pen.rotation.x, -.6 + wig(6, .2), k8), 0, 0); }
    else { pen.position.lerp(R.pencilHome.p, k8); pen.rotation.set(R.pencilHome.r.x, R.pencilHome.r.y, R.pencilHome.r.z); }
    const open = S === 'wait'; const angs = [-.45, 0, .45];
    R.fan.forEach((s, i) => { const tgt = open ? (i < 3 ? angs[i] : 0) : 0; s.rotation.z = lerp(s.rotation.z, tgt, rm ? 1 : Math.min(1, dt*10)); s.visible = !open || i < 3; });
    ease(tails, dt, 3, [], [sim.pose === 'cheer' ? -.6*flour : 0, 0, wig(1.6, .08)]);
    fan.visible = S === 'wait' || S === 'idle' || S === 'ride' || sim.pose === 'glide';
  } else if (o === 'goggles'){
    const g = R.faceG, down = S === 'work' || S === 'sleep';
    if (S === 'blocked') ease(g, dt, 5, [0,.01,0], [-.1,0,.2]); else ease(g, dt, 5, [0, down ? -.1 : 0, down ? .012 : 0], [down ? .55 : sim.pose === 'cheer' ? -.3*flour : 0, 0, 0]);
    R.lenses.emissiveIntensity = lerp(R.lenses.emissiveIntensity, S === 'work' ? 1.6 : 0, k8); R.lenses.emissive.copy(K.TH.need);
    const p = prog && prog.of ? Math.max(0, Math.min(1, prog.done/prog.of)) : 0; const na = (135 - p*270)*Math.PI/180 + (S === 'blocked' ? wig(9, .035) : 0);
    R.needle.rotation.z = lerp(R.needle.rotation.z, na, rm ? 1 : Math.min(1, dt*4));
    if (R.prop && sim.pose === 'cheer' && !rm) R.prop.rotation.y = cheerK*TAU;
  } else if (o === 'glasses'){
    const h = R.hatG, sp = R.specs, lp = R.faceG;
    if (S === 'sleep') ease(h, dt, 3, [0,-.02,.02], [.6,0,0]); else if (S === 'idle') ease(h, dt, 4, [], [-.17,0,0]); else ease(h, dt, 5, [], []);
    ease(sp, dt, 5, S === 'blocked' ? [0,-.03,.004] : [], S === 'blocked' ? [.15,0,0] : []); sp.visible = S !== 'sleep';
    ease(lp, dt, 6, [], [S === 'work' ? 0 : -1.4, 0, 0]);
  } else if (o === 'explorer'){
    const h = R.hatG;
    if (S === 'wait') ease(h, dt, 5, [0,.01,0], [.1,0,0]); else if (S === 'blocked') ease(h, dt, 4, [0,.02,-.02], [-.35,0,0]);
    else if (S === 'sleep') ease(h, dt, 3, [0,-.06,.05], [.75,0,0]); else if (S === 'done') ease(h, dt, 8, [0, .25*flour, 0], []); else ease(h, dt, 4, [], []);
    const n = prog && prog.of > 0 ? (prog.of <= 5 ? prog.of : 3) : 3, orbit = S === 'work';
    R.scouts.forEach((s, i) => { s.visible = (orbit || S === 'wait' || S === 'blocked') && i < n && !info.small;
      if (!s.visible) return; const an = (orbit && !rm ? t*1.6 : 0) + i/n*TAU; const r = S === 'blocked' ? .28 : .35; s.position.set(Math.cos(an)*r, S === 'blocked' ? .1 : .3 + (orbit && !rm ? Math.sin(t*3 + i)*.03 : 0), Math.sin(an)*r); });
  } else if (o === 'captain'){
    const h = R.hatG;
    if (S === 'blocked') ease(h, dt, 4, [0,.01,-.01], [-.26,0,0]); else if (S === 'sleep') ease(h, dt, 3, [0,-.02,.02], [.35,0,0]);
    else if (S === 'idle') ease(h, dt, 4, [], [0,0,.1]); else if (sim.pose === 'cheer' && !rm){ h.position.y = h.userData.home.p.y + .3*flour; h.rotation.y = cheerK*TAU; } else ease(h, dt, 5, [], []);
    if (R.prop) R.prop.visible = S !== 'work';
  } else if (o === 'rainhat'){
    const h = R.hatG, storm = info.storm || 0;
    if (S === 'sleep') ease(h, dt, 3, [0,-.03,.03], [.45,0,0]); else if (S === 'wait') ease(h, dt, 5, [], [.08 + wig(3, .04),0,0]); else ease(h, dt, 5, [], []);
    ease(R.mast, dt, 3, [], [0, 0, S === 'blocked' ? .4 : 0]);
    const wind = info.wind; if (!rm && wind > 0) R.anemo.rotation.y += Math.min(25, wind)*.35*dt;
    if (R.live){ let b = R.liveK; if (S === 'work') b = Math.sin(t*TAU) > 0 || rm ? 1 : .15; else if (S === 'blocked') b = .25 + (rm ? 0 : Math.max(0, Math.sin(t*13))*.2);
      else if (sim.pose === 'cheer') b = Math.sin(sim.poseT*TAU*2.5) > 0 ? 1 : .1; R.live.color.copy(OFFC).lerp(K.TH.need, b); }
    R.cape.scale.y = lerp(R.cape.scale.y, 1 + storm*.2, k8);
    O_clear(storm);
  } else if (o === 'newsboy'){
    const h = R.hatG, pr = R.prop;
    if (S === 'work') ease(h, dt, 4, [], [-.14,0,0]); else if (S === 'blocked') ease(h, dt, 4, [], [0,0,.21]); else if (S === 'idle') ease(h, dt, 4, [], [.08,0,0]); else ease(h, dt, 4, [], []);
    const flag = !!gear.flag || S === 'wait'; R.card.rotation.y = lerp(R.card.rotation.y, R.card.userData.home.r.y + (flag ? Math.PI : 0), rm ? 1 : Math.min(1, dt*6));
    if (K.HUB.lang !== R.paperLang){ R.paperLang = K.HUB.lang; K.redraw(R.paperT); K.redraw(R.cardFront); }
    const open = S === 'work' || S === 'wait'; R.leavesP[0].rotation.y = lerp(R.leavesP[0].rotation.y, open ? .15 : 1.4, k8); R.leavesP[1].rotation.y = lerp(R.leavesP[1].rotation.y, open ? -.15 : -1.4, k8);
    pr.scale.y = lerp(pr.scale.y, S === 'blocked' ? .6 : 1, k8);
  }
  // jewelry: only in close views (60 CSS px tall or more on screen), never on phone
  const showJ = !K.PHONE && !info.small; if (R.jewelOn !== showJ){ R.jewelOn = showJ; for (const m of R.jewel) m.visible = showJ; }
}
const OFFC_ = {}; let OFFC, LAMP_W; const V_ = []; function V(x, y, z){ return (V_[0] || (V_[0] = new THREE.Vector3())).set(x, y, z); }
function O_clear(storm){ const m = mats.oilskin; if (m) m.clearcoatRoughness = .15 - .1*storm; }
export function initOutfits(kit){ K = kit; THREE = K.THREE; OFFC = new THREE.Color(0x2a2320); LAMP_W = new THREE.Color(0xfff1d6); }
/* the Right Hand's keys glint when it passes one of FilthE's messages to the King */
export function glint(R){ if (R && R.glint) R.glintT = 0; }
