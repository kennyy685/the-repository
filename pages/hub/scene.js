/* hub/scene.js: the Crew HQ 3D world (board T190). three.js r169, everything drawn in code.
 * Two floors, split-level: upstairs = the King's floor (board, King + Right Hand desks, Code lab desks, Research
 * corner); downstairs = storm desk, radar, Chat Reader, coffee bar, lounge, "your spot", trophy wall, charging pods.
 * Down = a spiral slide, up = a glass suction tube.
 * Interface with the page: docs/design/hub-office/CONTRACT.md (window.HUB in, window.SCENE out).
 * The page only sets st / spot / seq / instant on each agent; where a robot goes and how it gets there lives here.
 * DOM: draws into #gl inside #stage (created if missing) and sets --horizon on #sky when present. */
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const HUB = window.HUB, RM = HUB.RM;
const stage = HUB.stage || document.getElementById('stage');
let canvas = HUB.canvas || document.getElementById('gl');
if (!canvas){
  canvas = document.createElement('canvas'); canvas.id = 'gl'; canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  stage.prepend(canvas);
}
const skyEl = document.getElementById('sky');
const PHONE = Math.min(screen.width, screen.height) < 700 || matchMedia('(pointer:coarse)').matches;
const CAPTURE = location.hash === '#capture';
const tx = o => o == null ? '' : typeof o === 'string' ? o : (o[HUB.lang] || o.en || '');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true, powerPreference:'high-performance', preserveDrawingBuffer:CAPTURE});
  if (!renderer.getContext()) throw new Error('no gl');
} catch(e){ HUB.fallback(); throw e; }
renderer.setClearColor(0x000000, 0);
// Nocturne (ART 6.2): neutral tone mapping at 1.0 (night 1.05); window.__hubTM = 'agx' is the A/B switch for review shots
renderer.toneMapping = window.__hubTM === 'agx' ? THREE.AgXToneMapping : THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = PHONE ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = !PHONE;          // phones: robots use blob shadows, the static map is redrawn only when the sun moves
let DPR = Math.min(window.devicePixelRatio || 1, PHONE ? 1.75 : 2);
renderer.setPixelRatio(DPR);

const scene = new THREE.Scene();
/* studio environment (ART 6.3): a black box, one long warm softbox overhead, one narrow cool strip on the window side,
 * a dark bounce floor. Every ceramic head, brass rail and the slide carries one clean long highlight. Built once. */
const pmrem = new THREE.PMREMGenerator(renderer);
{
  const env = new THREE.Scene(), bm = c => new THREE.MeshBasicMaterial({color:c, side:THREE.BackSide});
  const room = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 20), bm(0x050506)); room.position.y = 3; env.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({color:0x2a2622})); floor.rotation.x = -Math.PI/2; floor.position.y = -1.9; env.add(floor);
  const strip = (w, d, col, k, x, y, z, rx = Math.PI/2, ry = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({color:new THREE.Color(col).multiplyScalar(k), side:THREE.DoubleSide})); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); env.add(m); };
  strip(12, 1.5, 0xffe2c0, 5.5, 0, 7.8, -1);                     // the long warm softbox overhead (8:1)
  strip(.9, 7, 0xcfdcff, 2.4, 0, 3.2, -9.8, 0);                  // the narrow cool strip on the window side
  strip(3.5, 3.5, 0xffe2c0, .9, 9.8, 3.5, 2, 0, -Math.PI/2);     // a faint fill card to the right
  scene.environment = pmrem.fromScene(env, 0.04).texture;
  env.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
}
scene.environmentIntensity = .45;

/* ================= canvas textures ================= */
function tex(w, h, draw, opts = {}){
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);
  if (opts.repeat){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
  t.userData.canvas = c; t.userData.draw = draw; return t;
}
function redraw(t){ const c = t.userData.canvas; t.userData.draw(c.getContext('2d'), c.width, c.height); t.needsUpdate = true; }
let seed = 7; const rnd = () => (seed = (seed*16807) % 2147483647) / 2147483647;
const walnutTex = tex(512, 512, (g,w,h) => {                    // oiled walnut: planks +-12%, grain, faint plane marks
  g.fillStyle = '#5b3a26'; g.fillRect(0,0,w,h);
  for (let y=0;y<h;y+=64){ const k = (rnd()-.5)*.24; g.fillStyle = k > 0 ? `rgba(150,105,70,${k*.9})` : `rgba(20,12,6,${-k*.9})`; g.fillRect(0,y,w,64); g.fillStyle = 'rgba(14,8,4,.35)'; g.fillRect(0,y,w,1.2); }
  for (let i=0;i<220;i++){ const y = rnd()*h, a = 0.04 + rnd()*0.1; g.strokeStyle = rnd() < .5 ? `rgba(130,88,56,${a})` : `rgba(28,16,9,${a+.04})`; g.lineWidth = 0.6 + rnd()*2.4;
    g.beginPath(); for (let x=0;x<=w;x+=16){ const yy = y + Math.sin(x*0.012 + i)*6*rnd() + Math.sin(x*0.05+i*3)*1.2; x ? g.lineTo(x,yy) : g.moveTo(x,yy); } g.stroke(); }
  for (let x=30;x<w;x+=60 + rnd()*40){ g.fillStyle = 'rgba(255,225,190,.035)'; g.fillRect(x, 0, 2, h); }
}, {repeat:[1,1]});
const slatTex = tex(512, 512, (g,w,h) => {
  g.drawImage(walnutTex.userData.canvas, 0, 0);
  g.save(); g.translate(w/2,h/2); g.rotate(Math.PI/2); g.translate(-w/2,-h/2); g.globalAlpha = .5; g.drawImage(walnutTex.userData.canvas,0,0); g.restore();
  for (let x=0;x<w;x+=32){ g.fillStyle = 'rgba(12,7,4,.72)'; g.fillRect(x, 0, 4, h); g.fillStyle = 'rgba(255,220,180,.06)'; g.fillRect(x+4, 0, 1.5, h); }
}, {repeat:[5,1]});
const TS = PHONE ? 512 : 1024;
const travTex = tex(TS, TS, (g,w,h) => {                        // honed travertine (upstairs): pits + faint veins, 1.2 m slabs
  const k = w/1024; g.fillStyle = '#cbbba2'; g.fillRect(0,0,w,h);
  for (let i=0;i<500;i++){ const x = rnd()*w, y = rnd()*h, r = (10 + rnd()*70)*k; const gr = g.createRadialGradient(x,y,0,x,y,r);
    const c = rnd() < .5 ? '255,248,232' : '150,132,106'; gr.addColorStop(0, `rgba(${c},${0.03 + rnd()*0.05})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x-r,y-r,r*2,r*2); }
  for (let i=0;i<6;i++){ g.strokeStyle = `rgba(150,128,98,${.12 + rnd()*.1})`; g.lineWidth = (1 + rnd()*1.5)*k; g.beginPath(); let y = rnd()*h; g.moveTo(0,y); for (let x=0;x<=w;x+=24*k){ y += (rnd()-.5)*10*k; g.lineTo(x,y); } g.stroke(); }
  for (let i=0;i<400;i++){ g.fillStyle = `rgba(92,78,58,${.25 + rnd()*.3})`; g.fillRect(rnd()*w, rnd()*h, (1 + rnd())*k, (1 + rnd())*k); }
  g.strokeStyle = 'rgba(90,78,62,.5)'; g.lineWidth = 1.6*k; for (let i=0;i<=2;i++){ g.beginPath(); g.moveTo(i*w/2,0); g.lineTo(i*w/2,h); g.stroke(); g.beginPath(); g.moveTo(0,i*h/2); g.lineTo(w,i*h/2); g.stroke(); }
}, {repeat:[3.8,2.8]});
const darkTex = tex(TS, TS, (g,w,h) => {                        // polished dark stone (downstairs): lamps reflect in it
  const k = w/1024; g.fillStyle = '#4a4640'; g.fillRect(0,0,w,h);
  for (let i=0;i<600;i++){ const x = rnd()*w, y = rnd()*h, r = (8 + rnd()*60)*k; const gr = g.createRadialGradient(x,y,0,x,y,r);
    const c = rnd() < .5 ? '120,114,104' : '30,28,26'; gr.addColorStop(0, `rgba(${c},${0.05 + rnd()*0.06})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x-r,y-r,r*2,r*2); }
  for (let i=0;i<5;i++){ g.strokeStyle = `rgba(160,150,136,${.06 + rnd()*.06})`; g.lineWidth = (.8 + rnd())*k; g.beginPath(); let x = rnd()*w; g.moveTo(x,0); for (let y=0;y<=h;y+=24*k){ x += (rnd()-.5)*14*k; g.lineTo(x,y); } g.stroke(); }
  g.strokeStyle = 'rgba(16,15,14,.7)'; g.lineWidth = 1.6*k; for (let i=0;i<=2;i++){ g.beginPath(); g.moveTo(i*w/2,0); g.lineTo(i*w/2,h); g.stroke(); g.beginPath(); g.moveTo(0,i*h/2); g.lineTo(w,i*h/2); g.stroke(); }
}, {repeat:[3.8,2.8]});
const marbleTex = tex(512, 256, (g,w,h) => {
  g.fillStyle = '#eeeae4'; g.fillRect(0,0,w,h);
  for (let i=0;i<14;i++){ g.strokeStyle = `rgba(120,112,104,${0.1 + rnd()*0.2})`; g.lineWidth = 0.6 + rnd()*1.6; g.beginPath(); let x = rnd()*w, y = 0; g.moveTo(x,y);
    while (y < h){ x += (rnd()-0.5)*40; y += 10 + rnd()*20; g.lineTo(x,y); } g.stroke(); }
});
const rugTex = tex(256, 256, (g,w,h) => {                        // plain oat wool, no pattern
  g.fillStyle = '#b9ad9b'; g.fillRect(0,0,w,h);
  for (let i=0;i<5000;i++){ g.fillStyle = `rgba(${rnd()<.5?'255,250,240':'70,60,48'},0.05)`; g.fillRect(rnd()*w, rnd()*h, 1.5, 1.5); }
}, {repeat:[3,3]});
const blobTex = tex(128, 128, (g,w,h) => { const gr = g.createRadialGradient(64,64,0,64,64,64); gr.addColorStop(0,'rgba(0,0,0,.62)'); gr.addColorStop(.45,'rgba(0,0,0,.28)'); gr.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0,0,w,h); });
const glowTex = tex(128, 128, (g,w,h) => { const gr = g.createRadialGradient(64,64,0,64,64,64); gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(.25,'rgba(255,255,255,.45)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0,0,w,h); });

/* holo screen content: shapes only (no words), so it reads from either side and in both languages */
function holo(kind){
  return tex(256, 160, (g,w,h) => {
    g.clearRect(0,0,w,h);
    const O = 'rgba(241,196,138,', W = 'rgba(255,244,228,';
    const bg = g.createLinearGradient(0,0,0,h); bg.addColorStop(0,'rgba(241,200,150,.2)'); bg.addColorStop(1,'rgba(220,180,130,.07)');
    g.fillStyle = bg; g.beginPath(); g.roundRect(2,2,w-4,h-4,12); g.fill();
    g.strokeStyle = O + '.8)'; g.lineWidth = 2.5; g.stroke();
    if (kind === 'code' || kind === 'chat'){
      for (let r=0;r<18;r++){ const y = 14 + r*8, ind = (r%4)*10 + (kind==='chat' && r%3===1 ? 90 : 0); const len = 30 + ((r*53)%130);
        g.fillStyle = (r%5===0 ? O : W) + (0.35 + (r%3)*0.18) + ')'; g.fillRect(14 + ind, y, Math.min(len, w - 30 - ind), 3.2); }
    } else if (kind === 'design'){
      const cols = ['#d98d5a','#ead1a0','#efebe4','#2a2b2f','#c9a45c'];
      cols.forEach((c,i) => { g.fillStyle = c; g.globalAlpha = .85; g.beginPath(); g.roundRect(16 + i*44, 18, 34, 34, 8); g.fill(); });
      g.globalAlpha = .5; g.fillStyle = '#fff4e4'; g.fillRect(16, 66, 140, 6); g.fillRect(16, 80, 100, 4); g.fillRect(16, 92, 120, 4);
      g.strokeStyle = O + '.8)'; g.strokeRect(170, 62, 70, 80); g.globalAlpha = 1;
    } else if (kind === 'engine' || kind === 'map'){
      for (let i=0;i<9;i++){ g.strokeStyle = W + (0.12 + i*0.03) + ')'; g.beginPath(); g.ellipse(128 + (i%3)*6, 80, 18 + i*12, 10 + i*7, 0.3, 0, Math.PI*2); g.stroke(); }
      for (let i=0;i<12;i++){ g.fillStyle = O + (0.5 + (i%3)*0.2) + ')'; g.beginPath(); g.arc(40 + (i*67)%180, 30 + (i*41)%100, 3 + (i%3), 0, Math.PI*2); g.fill(); }
    } else if (kind === 'tests'){
      for (let r=0;r<8;r++){ const y = 20 + r*16; g.strokeStyle = 'rgba(159,191,166,.9)'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(18,y); g.lineTo(23,y+5); g.lineTo(31,y-4); g.stroke();
        g.fillStyle = W + '.5)'; g.fillRect(42, y-1, 60 + (r*37)%120, 3.2); }
    } else if (kind === 'board'){
      for (let c=0;c<3;c++){ g.fillStyle = W + '.12)'; g.fillRect(14 + c*80, 14, 70, 132);
        for (let r=0;r<(4-c);r++){ g.fillStyle = (c===0 ? O + '.75)' : c===1 ? W + '.55)' : 'rgba(159,191,166,.6)'); g.fillRect(20 + c*80, 26 + r*26, 58, 16); } }
    } else if (kind === 'news'){
      g.fillStyle = W + '.7)'; g.fillRect(16, 16, 150, 9); g.fillStyle = O + '.8)'; g.fillRect(176, 16, 64, 9);
      g.fillStyle = W + '.16)'; g.fillRect(16, 34, 96, 58);
      for (let c=0;c<3;c++) for (let r=0;r<(c ? 13 : 6);r++){ const x = c ? 124 + (c-1)*60 : 16, y = c ? 36 + r*8.6 : 100 + r*8.6;
        g.fillStyle = W + (0.3 + ((r+c)%3)*0.12) + ')'; g.fillRect(x, y, (c ? 50 : 96) - ((r*17+c*5)%18), 3); }
    }
  });
}
const radarTex = tex(256, 256, (g,w,h) => {
  g.clearRect(0,0,w,h); const cx = 128, cy = 128;
  const gr = g.createRadialGradient(cx,cy,0,cx,cy,126); gr.addColorStop(0,'rgba(90,190,255,.20)'); gr.addColorStop(1,'rgba(90,190,255,.04)'); g.fillStyle = gr; g.beginPath(); g.arc(cx,cy,126,0,Math.PI*2); g.fill();
  g.strokeStyle = 'rgba(160,220,255,.55)'; g.lineWidth = 1.5; for (const r of [42,84,124]){ g.beginPath(); g.arc(cx,cy,r,0,Math.PI*2); g.stroke(); }
  g.beginPath(); g.moveTo(cx-126,cy); g.lineTo(cx+126,cy); g.moveTo(cx,cy-126); g.lineTo(cx,cy+126); g.stroke();
  g.fillStyle = 'rgba(160,220,255,.35)'; g.beginPath(); g.moveTo(40,150); g.bezierCurveTo(70,120,120,160,150,120); g.bezierCurveTo(180,90,210,130,220,110); g.lineTo(220,190); g.lineTo(40,190); g.closePath(); g.globalAlpha=.35; g.fill(); g.globalAlpha=1;
});
const sweepTex = tex(256, 256, (g) => { g.clearRect(0,0,256,256); for (let i=0;i<40;i++){ g.fillStyle = `rgba(140,215,255,${(i/40)*0.4})`; g.beginPath(); g.moveTo(128,128); g.arc(128,128,126, -Math.PI/2 + (i/40)*0.9, -Math.PI/2 + ((i+1)/40)*0.9); g.closePath(); g.fill(); } });

/* the board: whatever the page puts in HUB.boardInfo (the King's orders), drawn as frosted glass */
const FONT_H = '"Bricolage Grotesque", Geist, system-ui, sans-serif', FONT = 'Geist, system-ui, sans-serif', MONO = '"Geist Mono", ui-monospace, monospace';
const TONE = {orange:'#f1c48a', white:'rgba(241,242,244,.6)', green:'#9fbfa6', red:'#e0685c', need:'#f5883a'};
function fitText(g, s, max, font, size, min = 14){ let z = size; g.font = font.replace('#', z); while (z > min && g.measureText(s).width > max){ z -= 2; g.font = font.replace('#', z); } return s; }
const boardT = tex(1024, 520, (g,w,h) => {
  const b = HUB.boardInfo || {}, cols = Array.isArray(b.cols) ? b.cols.slice(0, 4) : [];
  g.clearRect(0,0,w,h);
  g.fillStyle = 'rgba(20,20,26,.62)'; g.beginPath(); g.roundRect(0,0,w,h,26); g.fill();
  const hi = g.createLinearGradient(0,0,w,h); hi.addColorStop(0,'rgba(255,255,255,.07)'); hi.addColorStop(.5,'rgba(255,255,255,0)'); g.fillStyle = hi; g.fill();
  const title = tx(b.title), when = tx(b.when);
  if (title){ g.fillStyle = '#ead1a0'; fitText(g, title, w - 88, '600 #px ' + FONT_H, 40, 22); g.fillText(title, 44, 66); }
  if (when){ g.fillStyle = 'rgba(245,242,236,.5)'; fitText(g, when, w - 88, '500 #px ' + MONO, 20, 12); g.fillText(when, 44, 100); }
  const n = Math.max(1, cols.length), gap = 28, cw = (w - 88 - gap*(n-1))/n;
  cols.forEach((c, i) => {
    const x = 44 + i*(cw + gap), label = tx(c.label).toUpperCase();
    g.fillStyle = 'rgba(245,242,236,.55)'; fitText(g, label, cw, '500 #px ' + MONO, 20, 12); g.fillText(label, x, 150);
    const items = Array.isArray(c.items) ? c.items : [], show = items.slice(0, 5);
    show.forEach((it, r) => { const y = 168 + r*60;
      g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.roundRect(x, y, cw, 48, 10); g.fill();
      g.fillStyle = TONE[it.tone] || TONE.white; const ww = Math.max(.15, Math.min(1, +it.w || .5));
      g.globalAlpha = .9; g.fillRect(x + 14, y + 17, 6, 14); g.globalAlpha = .75; g.fillRect(x + 30, y + 18, (cw - 60)*ww, 8);
      g.globalAlpha = .3; g.fillRect(x + 30, y + 32, (cw - 60)*ww*.55, 6); g.globalAlpha = 1; });
    for (let k = 0; k < Math.min(8, items.length - show.length); k++){ g.fillStyle = 'rgba(245,242,236,.45)'; g.beginPath(); g.arc(x + 8 + k*16, 478, 4.5, 0, Math.PI*2); g.fill(); }
  });
});
/* the trophy wall: HUB.trophies.list, newest first, up to 12 plaques */
function wrap(g, s, max, lines){ const words = String(s).split(/\s+/), out = []; let cur = '';
  for (const wd of words){ const t = cur ? cur + ' ' + wd : wd; if (g.measureText(t).width <= max || !cur) cur = t; else { out.push(cur); cur = wd; } }
  if (cur) out.push(cur);
  if (out.length > lines){ out.length = lines; let l = out[lines-1]; while (l.length > 1 && g.measureText(l + '…').width > max) l = l.slice(0,-1); out[lines-1] = l + '…'; }
  return out; }
function fmtDay(at){ if (at == null || at === '') return ''; const d = new Date(typeof at === 'number' && at < 1e11 ? at*1000 : at); if (isNaN(d)) return '';
  try { return d.toLocaleDateString(HUB.lang === 'es' ? 'es-MX' : 'en-US', {month:'short', day:'numeric'}); } catch(e){ return ''; } }
const PLAQ = {cols:4, rows:3, pw:232, ph:152};
const trophyT = tex(1024, 512, (g,w,h) => {
  g.clearRect(0,0,w,h);
  const list = (HUB.trophies && Array.isArray(HUB.trophies.list) ? HUB.trophies.list : []).slice(0, 12);
  list.forEach((tr, i) => {
    const x = 16 + (i % PLAQ.cols)*252, y = 12 + Math.floor(i / PLAQ.cols)*168, pw = PLAQ.pw, ph = PLAQ.ph;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.roundRect(x + 4, y + 7, pw, ph, 12); g.fill();
    const wood = g.createLinearGradient(x, y, x, y + ph); wood.addColorStop(0, '#6a4128'); wood.addColorStop(1, '#3d2415');
    g.fillStyle = wood; g.beginPath(); g.roundRect(x, y, pw, ph, 12); g.fill();
    g.strokeStyle = 'rgba(255,220,180,.18)'; g.lineWidth = 2; g.stroke();
    const px = x + 14, py = y + 14, pW = pw - 28, pH = ph - 28;
    const gold = g.createLinearGradient(px, py, px + pW, py + pH); gold.addColorStop(0, '#f1d9a4'); gold.addColorStop(.45, '#c9a45c'); gold.addColorStop(1, '#a8823f');
    g.fillStyle = gold; g.beginPath(); g.roundRect(px, py, pW, pH, 6); g.fill();
    g.strokeStyle = 'rgba(90,60,20,.5)'; g.lineWidth = 1.5; g.beginPath(); g.roundRect(px + 5, py + 5, pW - 10, pH - 10, 4); g.stroke();
    // a little cup
    const cx = px + pW/2; g.fillStyle = '#6b4a1c'; g.beginPath(); g.moveTo(cx - 11, py + 12); g.lineTo(cx + 11, py + 12); g.quadraticCurveTo(cx + 10, py + 28, cx, py + 30); g.quadraticCurveTo(cx - 10, py + 28, cx - 11, py + 12); g.fill(); g.fillRect(cx - 2, py + 29, 4, 5); g.fillRect(cx - 7, py + 33, 14, 3);
    g.fillStyle = '#3a2610'; g.font = '600 20px ' + FONT; g.textAlign = 'center';
    const lines = wrap(g, tx(tr.text), pW - 22, 2); lines.forEach((l, k) => g.fillText(l, cx, py + 60 + k*23));
    const day = fmtDay(tr.at); if (day){ g.font = '500 14px ' + MONO; g.fillStyle = 'rgba(58,38,16,.75)'; g.fillText(day.toUpperCase(), cx, py + pH - 12); }
    g.textAlign = 'left';
  });
});

/* ================= materials ================= */
const phys = (o) => new THREE.MeshPhysicalMaterial(o), std = (o) => new THREE.MeshStandardMaterial(o);
const MAT = {                                                  // Nocturne values (ART section 3)
  ceramic: phys({color:0xece8e1, roughness:.42, metalness:0, clearcoat:.3, clearcoatRoughness:.35, envMapIntensity:2.2}),
  graphite: phys({color:0x26272b, roughness:.42, metalness:.05, clearcoat:.3, clearcoatRoughness:.35, envMapIntensity:2}),
  visor: phys({color:0x050507, roughness:.1, metalness:.3, clearcoat:1, clearcoatRoughness:.05}),
  brass: std({color:0xc9a45c, metalness:1, roughness:.34}),
  brassSoft: std({color:0x9c7c3e, metalness:1, roughness:.45}),
  bronze: std({color:0x5a4630, metalness:.9, roughness:.45}),
  walnut: phys({map:walnutTex, roughness:.5, metalness:0, clearcoat:.12, clearcoatRoughness:.5}),
  slats: std({map:slatTex, roughness:.62}),
  floorUp: std({map:travTex, roughness:.62, metalness:0}),
  floorDown: std({map:darkTex, roughness:.18, metalness:0, envMapIntensity:1.3}),
  marble: std({map:marbleTex, roughness:.18}),
  travertine: std({color:0xcbbba2, roughness:.62}),
  leather: std({color:0x6b3f26, roughness:.55}),
  leatherDark: std({color:0x4a2a18, roughness:.6}),
  slab: std({color:0x1b1b1f, roughness:.7, metalness:.2}),
  panel: std({color:0x201f23, roughness:.55, metalness:.25}),
  steel: std({color:0x17171a, roughness:.35, metalness:.8}),
  glass: phys({color:0xdfe6ea, roughness:.03, metalness:0, transparent:true, opacity:.1, depthWrite:false, side:THREE.DoubleSide, envMapIntensity:1.2}),
  glassTop: phys({color:0xdfe6ea, roughness:.05, transparent:true, opacity:.26, depthWrite:false}),
  rug: std({map:rugTex, roughness:.95}),
  poche: new THREE.MeshBasicMaterial({color:0x141316, polygonOffset:true, polygonOffsetFactor:1, polygonOffsetUnits:1}),
  pot: std({color:0xdcd6cc, roughness:.8}),
  potStone: std({color:0x8d877d, roughness:.85}),
  leaf: std({color:0x2c5230, roughness:.45}),
  leaf2: std({color:0x3d6b3e, roughness:.45}),
  olive: std({color:0x6f7d5a, roughness:.6}),
  opal: std({color:0xfff1dd, emissive:0xffcf95, emissiveIntensity:1.6, roughness:.4}),
  orange: new THREE.MeshBasicMaterial({color:0xf5883a, toneMapped:false}),
  champagne: new THREE.MeshBasicMaterial({color:0xf1c48a, toneMapped:false}),
  ledge: new THREE.MeshBasicMaterial({color:0x8a6f4a, toneMapped:false}),
  cream: std({color:0xf3eee6, roughness:.3}),
  chrome: std({color:0xdadde2, metalness:1, roughness:.18}),
  paper: std({color:0xf1ece0, roughness:.85}),
  // outfits
  velvet: phys({color:0x8a1f33, roughness:.62, sheen:1, sheenColor:0xff7a8a, sheenRoughness:.5, side:THREE.DoubleSide}),
  hatWhite: phys({color:0xf6f3ee, roughness:.4, clearcoat:.4}),
  hatBlack: std({color:0x16161a, roughness:.35, metalness:.2}),
  hatYellow: phys({color:0xf2c230, roughness:.28, clearcoat:.8, clearcoatRoughness:.2}),
  hatOrange: phys({color:0xf07a2a, roughness:.32, clearcoat:.7, clearcoatRoughness:.25}),
  beret: phys({color:0x3a2438, roughness:.8, sheen:.6, sheenColor:0x9a6a90}),
  khaki: std({color:0xc9b58c, roughness:.7}),
  tweed: std({color:0x6e6152, roughness:.9}),
  lens: phys({color:0x1d3b30, roughness:.05, metalness:.2, clearcoat:1}),
  belt: std({color:0x5a3620, roughness:.6}),
  pencil: std({color:0xf2c230, roughness:.5}),
  wood: std({color:0xe8c89a, roughness:.7}),
  pink: std({color:0xe88a9a, roughness:.6})
};
walnutTex.wrapS = walnutTex.wrapT = THREE.RepeatWrapping;

/* ================= builders ================= */
let P = scene;                                             // current parent (a floor group)
const S = (m, cast = true, recv = true) => { m.castShadow = cast; m.receiveShadow = recv; return m; };
function box(w,h,d,mat,x,y,z,parent = P, cast = true){ const m = S(new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat), cast); m.position.set(x,y,z); parent.add(m); return m; }
function rbox(w,h,d,r,mat,x,y,z,parent = P){ const m = S(new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,r), mat)); m.position.set(x,y,z); parent.add(m); return m; }
function cyl(rt,rb,h,mat,x,y,z,seg = 28,parent = P){ const m = S(new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg), mat)); m.position.set(x,y,z); parent.add(m); return m; }
function sph(r,mat,x,y,z,parent = P){ const m = new THREE.Mesh(new THREE.SphereGeometry(r,16,12), mat); m.position.set(x,y,z); parent.add(m); return m; }
function flat(geo, mat, x, y, z, parent = P){ const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI/2; m.position.set(x,y,z); parent.add(m); return m; }
function blob(x,z,sx,sz,op = .5,parent = P){ const m = flat(new THREE.PlaneGeometry(1,1), new THREE.MeshBasicMaterial({map:blobTex, transparent:true, opacity:op, depthWrite:false}), x, .006, z, parent); m.scale.set(sx,sz,1); return m; }
const add = (mat, o) => { o.material = mat; return o; };
const dyn = m => { m.userData.dyn = true; return m; };

/* ================= the building: two floors, split level =================
 * Each floor is 9.2 x 6.8 m. The upper floor sits 3.1 m up and back-left, so the 3/4 camera sees both, stacked. */
const FX = 4.6, FZ = 3.4;
const FL = {down:{ox:0, oy:0, oz:0, wall:2.8}, up:{ox:-4.2, oy:3.1, oz:-4.6, wall:2.4}};
const gDown = new THREE.Group(), gUp = new THREE.Group(); gUp.position.set(FL.up.ox, FL.up.oy, FL.up.oz); scene.add(gDown, gUp);
const GRP = {down:gDown, up:gUp};
const SLIDE = {cx:1.15, cz:-2.3, R:.75, top:3.1, bot:.03, th0:Math.PI, turns:1.25, tr:.3};
const TUBE = {x:-3.9, z:-.7, r:.46, top:4.85};

/* --- floors, slabs, the tower below --- */
for (const f of ['down','up']){
  P = GRP[f];
  box(FX*2, f === 'up' ? .3 : .34, FZ*2, MAT.slab, 0, f === 'up' ? -.156 : -.176, 0, P, false);   // top 6 mm under the floor plane (no z-fighting)
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(FX*2, FZ*2), f === 'up' ? MAT.floorUp : MAT.floorDown); fl.rotation.x = -Math.PI/2; fl.receiveShadow = true; P.add(fl);
  // ledge light (warm brass, never orange) + brass lip on the two open edges
  box(FX*2, .025, .025, MAT.ledge, 0, -.05, FZ + .002, P, false); box(.025, .025, FZ*2, MAT.ledge, FX + .002, -.05, 0, P, false);
  box(FX*2, .02, .02, MAT.brass, 0, .01, FZ - .01, P, false); box(.02, .02, FZ*2, MAT.brass, FX - .01, .01, 0, P, false);
}
P = gDown;
{ // the tower under the lower floor: dark glass storeys with a few warm windows, fading out
  const face = (wu) => tex(512, 1024, (g,w,h) => {
    const floors = 5, fh = h/floors, cols = Math.round(wu/.65), cw = w/cols;
    const sky = g.createLinearGradient(0,0,0,h); sky.addColorStop(0,'#2c2d3c'); sky.addColorStop(.5,'#1b1c26'); sky.addColorStop(1,'#101117');
    g.fillStyle = sky; g.fillRect(0,0,w,h);
    for (let f=0; f<floors; f++){
      for (let c=0; c<cols; c++){ if (rnd() < .2){ const warm = g.createLinearGradient(0, f*fh, 0, (f+1)*fh); warm.addColorStop(0,'rgba(255,200,140,.10)'); warm.addColorStop(.7,'rgba(255,196,130,.34)'); warm.addColorStop(1,'rgba(255,190,120,.18)');
        g.fillStyle = warm; g.fillRect(c*cw, f*fh + 10, cw, fh - 14); } }
      g.fillStyle = 'rgba(8,8,11,.95)'; g.fillRect(0, f*fh, w, 9); g.fillStyle = 'rgba(201,164,92,.25)'; g.fillRect(0, f*fh + 9, w, 1.5);
    }
    g.fillStyle = 'rgba(10,10,14,.6)'; for (let c=0; c<=cols; c++) g.fillRect(c*cw - 1.5, 0, 3, h);
    const fade = g.createLinearGradient(0,0,0,h); fade.addColorStop(0,'rgba(0,0,0,0)'); fade.addColorStop(.3,'rgba(0,0,0,.25)'); fade.addColorStop(.8,'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = fade; g.fillRect(0,0,w,h);
  });
  const th = 14, mk = (w, t, rotY, x, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, th), new THREE.MeshBasicMaterial({map:t, transparent:true, depthWrite:false, toneMapped:false})); m.rotation.y = rotY; m.position.set(x, -.34 - th/2, z); m.renderOrder = -1; P.add(m); };
  mk(FX*2 - .3, face(FX*2), 0, 0, FZ - .15); mk(FZ*2 - .3, face(FZ*2), Math.PI/2, FX - .15, 0);
}

/* --- lower floor walls: slat wall (left, the trophy wall), solid back wall (charging bay + storm map) --- */
{
  const H = FL.down.wall;
  box(.16, H, FZ*2 - .1, MAT.slats, -FX + .08, H/2, -.05).castShadow = false;
  box(FX*2 - .16, H, .14, MAT.panel, .08, H/2, -FZ + .07).castShadow = false;
  // brass seams on the back wall + cap (the right part, not under the mezzanine)
  for (const x of [-3.3, -1.5, .4, 2.5]) box(.02, H - .02, .02, MAT.brassSoft, x, H/2, -FZ + .15, P, false);
  box(4.25, .04, .18, MAT.brass, 2.5, H + .02, -FZ + .07, P, false);
  box(.2, .04, 4.7, MAT.brass, -FX + .08, H + .02, 1.1, P, false);
  // the underside of the mezzanine: warm downlights over the charging bay
  for (const [x,z] of [[-3.4,-2.5],[-1.5,-2.5],[-3.4,-1.6],[-1.5,-1.6]]){ const d = new THREE.Mesh(new THREE.CircleGeometry(.09, 20), MAT.opal); d.rotation.x = Math.PI/2; d.position.set(x, 2.79, z); P.add(d); }
}
/* the storm map on the back wall behind Cowork */
const wallMap = {};
{
  const t = holo('map'); const m = dyn(new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.0), new THREE.MeshBasicMaterial({map:t, transparent:true, opacity:.5, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false})));
  m.position.set(3.55, 1.7, -FZ + .15); m.renderOrder = 6; P.add(m); wallMap.m = m;
  box(1.8, .03, .03, MAT.brass, 3.55, 1.19, -FZ + .16, P, false); box(1.8, .03, .03, MAT.brass, 3.55, 2.21, -FZ + .16, P, false);
}

/* --- upper floor walls: slat wall (left, with the board and bookshelf), glass window wall (back), glass rail --- */
P = gUp;
{
  const H = FL.up.wall;
  box(.16, H, FZ*2 - .1, MAT.slats, -FX + .08, H/2, -.05).castShadow = false; box(.2, .04, FZ*2 - .08, MAT.brass, -FX + .08, H + .02, -.05, P, false);
  const z = -FZ + .06, len = FX*2 - .16;
  box(len, .06, .1, MAT.brass, .04, .03, z, P, false); box(len, .07, .1, MAT.brass, .04, H, z, P, false);
  for (let i=0;i<=7;i++){ const x = -FX + .12 + i*(len/7); box(.035, H, .06, MAT.brassSoft, x, H/2, z, P, false); }
  const g = new THREE.Mesh(new THREE.PlaneGeometry(len, H - .06), MAT.glass); g.position.set(.04, H/2, z); g.renderOrder = 5; P.add(g);
  // glass balustrade on the open edges, with gaps for the tube landing and the slide
  const rail = (x0, x1, z0, z1) => { const L = Math.hypot(x1-x0, z1-z0), cx = (x0+x1)/2, cz = (z0+z1)/2, rot = Math.atan2(z1-z0, x1-x0);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(L, .78), MAT.glass); p.position.set(cx, .43, cz); p.rotation.y = -rot; p.renderOrder = 5; P.add(p);
    const r = cyl(.018, .018, L, MAT.brass, cx, .84, cz, 10); r.rotation.set(0, -rot, Math.PI/2); r.castShadow = false;
    for (const [px,pz] of [[x0,z0],[x1,z1]]) cyl(.016, .016, .84, MAT.brass, px, .42, pz, 8).castShadow = false; };
  const e = .03;
  rail(-FX + .1, -.3, FZ - e, FZ - e); rail(.9, FX - e, FZ - e, FZ - e);
  rail(FX - e, FX - e, FZ - e, 2.85); rail(FX - e, FX - e, 1.75, -FZ + .12);
}

/* --- the board (upper slat wall) --- */
let boardMesh;
{
  const bw = 2.5, bh = 1.27, x = -FX + .19, y = 1.45, z = -.35;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(bw + .06, bh + .06), std({color:0x0f0f12, roughness:.25, metalness:.3}));
  back.rotation.y = Math.PI/2; back.position.set(x - .01, y, z); P.add(back);
  boardMesh = dyn(new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), new THREE.MeshBasicMaterial({map:boardT, transparent:true, toneMapped:false})));
  boardMesh.rotation.y = Math.PI/2; boardMesh.position.set(x + .005, y, z); P.add(boardMesh);
  for (const dy of [-1,1]) box(.03, .025, bw + .08, MAT.brass, x, y + dy*(bh/2 + .03), z, P, false);
  for (const dz of [-1,1]) box(.03, bh + .08, .025, MAT.brass, x, y, z + dz*(bw/2 + .03), P, false);
}
/* --- bookshelf in the upper slat wall (Research Lead's corner) --- */
{
  const x0 = -FX + .16, z0 = 1.5, z1 = 3.3, depth = .3;
  for (let i=0;i<4;i++){ const y = .35 + i*.5; box(depth, .035, z1 - z0, MAT.walnut, x0 + depth/2, y, (z0+z1)/2, P, false); box(depth+.01, .01, z1 - z0, MAT.brass, x0 + depth/2, y + .02, (z0+z1)/2, P, false); }
  for (const z of [z0, z1]) box(depth, 1.95, .04, MAT.walnut, x0 + depth/2, 1.1, z, P, false);
  const bookCols = [0x6e2a2a,0x2d3e5c,0x3d5a3f,0xb08a4a,0xe6ddcc,0x4a3b5e,0x8c5a3c,0x22252b];
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1), std({roughness:.8}), 80);
  const m4 = new THREE.Matrix4(), col = new THREE.Color(); let n = 0;
  for (let s=0;s<3;s++){ let z = z0 + .06; while (z < z1 - .1 && n < 80){ const th = .035 + rnd()*.035, ht = .28 + rnd()*.12; if (rnd() < .12){ z += .1; continue; }
    const tilt = rnd() < .06 ? .25 : 0; m4.compose(new THREE.Vector3(x0 + .16, .37 + s*.5 + ht/2, z + th/2), new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt,0,0)), new THREE.Vector3(.2, ht, th));
    inst.setMatrixAt(n, m4); inst.setColorAt(n, col.setHex(bookCols[Math.floor(rnd()*bookCols.length)])); n++; z += th + .006; } }
  inst.count = n; inst.castShadow = true; inst.receiveShadow = true; P.add(inst);
}

/* --- desks + glass screens --- */
const screens = {};
function screen(id, kind, x, z, w, h, y, rotY = 0, parent = P){
  const t = holo(kind); t.wrapT = THREE.RepeatWrapping;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({map:t, transparent:true, opacity:.25, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, toneMapped:false}));
  m.position.set(x, y, z); m.rotation.set(-.18, rotY + Math.PI, 0); m.renderOrder = 6; parent.add(m);
  const kb = box(.42, .012, .15, MAT.glassTop, x, .745, z + .02, parent, false); kb.renderOrder = 4;
  screens[id] = {m, t, on:.25};
}
function desk(x, z, w, d, kind, id, parent = P){
  const h = .74, t = .05;
  box(w, t, d, MAT.walnut, x, h - t/2, z, parent); box(t, h - t, d, MAT.walnut, x - w/2 + t/2, (h-t)/2, z, parent); box(t, h - t, d, MAT.walnut, x + w/2 - t/2, (h-t)/2, z, parent);
  box(w - .1, .012, .02, MAT.brass, x, h - t - .01, z + d/2 - .02, parent, false);
  blob(x, z, w*1.3, d*2.2, .35, parent);
  if (kind) screen(id, kind, x, z - d*0.1, Math.min(.66, w*.6), .38, 1.02, 0, parent);
}
/* upstairs: the King's desk, the Right Hand's desk, four Code lab desks, a hot desk */
desk(.2, -2.45, 1.9, .8, 'board', 'code');
desk(2.95, -2.5, 1.2, .6, 'chat', 'king');
{ // King's desk extras: brass lamp + a small plant
  const lx = 1.0, lz = -2.62;
  cyl(.07,.09,.03,MAT.brass,lx,.755,lz); cyl(.008,.008,.42,MAT.brass,lx,.97,lz,8); cyl(.09,.13,.12,MAT.brass,lx,1.2,lz); sph(.045,MAT.opal,lx,1.15,lz);
  cyl(.06,.05,.1,MAT.pot,-.55,.79,-2.65); for (let i=0;i<5;i++){ const l = new THREE.Mesh(new THREE.IcosahedronGeometry(.05,0), MAT.leaf2); l.position.set(-.55 + (rnd()-.5)*.08, .88 + rnd()*.06, -2.65 + (rnd()-.5)*.08); l.scale.set(1,.6,1); P.add(l); }
}
const LAB = {builder:[-1.55,'code'], designer:[-.25,'design'], 'engine-mechanic':[1.05,'engine'], 'qa-tester':[2.35,'tests']};
for (const [id, [x, kind]] of Object.entries(LAB)) desk(x, .72, 1.1, .6, kind, id);
{ const r = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.3), MAT.rug); r.rotation.x = -Math.PI/2; r.position.set(.4, .003, .4); r.receiveShadow = true; P.add(r); }
{ // hot desk by the window (for a robot with no desk of its own): a brass-legged standing table
  const x = -2.1, z = -2.55; box(.9, .04, .5, MAT.walnut, x, 1.0, z); for (const dx of [-.4,.4]) cyl(.02,.02,1.0,MAT.brass,x+dx,.5,z,8);
  const t = holo('code'); const m = new THREE.Mesh(new THREE.PlaneGeometry(.5,.3), new THREE.MeshBasicMaterial({map:t, transparent:true, opacity:.2, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, toneMapped:false}));
  m.position.set(x, 1.24, z - .1); m.rotation.set(-.18, Math.PI, 0); m.renderOrder = 6; P.add(m); screens['~hot-up'] = {m, t, on:.2};
}
// one linear brass pendant over the Code lab (ART 6.2): a 3.2 m bronze bar with an opal underside, backed by one PointLight
{ const x = .4, z = .72, y = 1.74;
  box(3.2, .05, .1, MAT.bronze, x, y, z, P, false); box(3.12, .012, .064, MAT.opal, x, y - .031, z, P, false);
  box(3.22, .008, .104, MAT.brass, x, y + .029, z, P, false);
  for (const dx of [-1.3, 1.3]) cyl(.004,.004,.62,MAT.brass,x + dx,y + .34,z,6); }
// Research Lead's reading chair + floor lamp
{
  const x = -3.75, z = 2.6;
  rbox(.72,.12,.72,.05,MAT.leather,x,.42,z); const back = rbox(.72,.72,.12,.05,MAT.leather,x-.3,.78,z-.28); back.rotation.y = -1.05 + Math.PI/2; back.position.set(x-.33,.78,z-.12);
  box(.7,.36,.7,MAT.walnut,x,.18,z);
  cyl(.1,.1,.02,MAT.brass,-4.25,.01,1.95); cyl(.01,.01,1.5,MAT.brass,-4.25,.76,1.95,8); sph(.09,MAT.opal,-4.25,1.52,1.95);
}

/* --- plants --- */
const LEAF = new THREE.SphereGeometry(1, 10, 6);
function plant(x, z, s, n = PHONE ? 22 : 34){ cyl(.2*s,.16*s,.44*s,MAT.pot,x,.22*s,z); blob(x,z,.8*s,.8*s,.4); cyl(.012,.018,.9*s,MAT.leatherDark,x,.8*s,z,6);
  for (let i=0;i<n;i++){ const l = new THREE.Mesh(LEAF, i%3 ? MAT.leaf : MAT.leaf2); const a = rnd()*Math.PI*2, r = .05 + rnd()*.24*s, y = (.7 + rnd()*.95)*s;
    l.position.set(x + Math.cos(a)*r, y, z + Math.sin(a)*r); l.scale.set(.16*s, .014, .085*s); l.rotation.set((rnd()-.5)*1.2, -a, (rnd()-.3)*.9); S(l); P.add(l); } }
plant(4.1, -2.95, .95); plant(-1.3, 3.0, .75);

/* ================= downstairs furniture ================= */
P = gDown;
desk(3.55, -2.5, 1.2, .6, 'map', 'cowork');
desk(.5, .55, 1.1, .6, 'news', 'chat-reader');
{ // the Chat Reader's newspaper stacks + a green banker's lamp
  for (let i=0;i<3;i++){ const p = box(.26,.012,.34,MAT.paper,.08 + (i%2)*.03, .755 + i*.013, .6 + (i*.02), P); p.rotation.y = (i-1)*.12; }
  for (let i=0;i<4;i++){ const p = box(.25,.012,.33,MAT.paper,.95, .755 + i*.013, .55, P); p.rotation.y = .25 + i*.07; }
  cyl(.05,.06,.02,MAT.brass,-.18,.76,.4,16);
}
// Storm Watch's radar table: brass pedestal, glass top, live radar disc
const radar = {};
{
  const x = -2.0, z = .6;
  cyl(.2,.26,.06,MAT.brass,x,.03,z); cyl(.07,.07,.74,MAT.brassSoft,x,.4,z,16); const top = cyl(.52,.52,.03,MAT.glassTop,x,.78,z,48); top.castShadow = false; top.renderOrder = 4;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.52,.012,8,64), MAT.brass); ring.rotation.x = Math.PI/2; ring.position.set(x,.78,z); P.add(ring);
  const mk = (t, y, op) => { const m = flat(new THREE.CircleGeometry(.48, 48), new THREE.MeshBasicMaterial({map:t, transparent:true, opacity:op, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false}), x, y, z); m.renderOrder = 7; return m; };
  radar.disc = mk(radarTex, .81, .35); radar.sweep = mk(sweepTex, .815, 0);
  radar.blips = []; for (const [bx,bz] of [[.18,-.1],[.24,.02],[.12,.12],[-.2,.2]]){ const b = sph(.022, new THREE.MeshBasicMaterial({color:0xf1c48a, transparent:true, opacity:0, toneMapped:false}), x+bx,.83,z+bz); radar.blips.push(b); }
  blob(x, z, 1.4, 1.4, .35);
}
// lounge: rug, cognac sofa, travertine table, brass arc lamp
{
  const r = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.9), MAT.rug); r.rotation.x = -Math.PI/2; r.position.set(3.45,.004,-.1); r.receiveShadow = true; P.add(r);
  const sx = 4.05, sz = -.1, L = 2.2;
  rbox(.8,.36,L,.08,MAT.leather,sx,.26,sz); rbox(.26,.46,L,.1,MAT.leather,sx+.36,.62,sz); rbox(.76,.5,.2,.08,MAT.leatherDark,sx,.36,sz - L/2 - .02); rbox(.76,.5,.2,.08,MAT.leatherDark,sx,.36,sz + L/2 + .02);
  for (const dz of [-.5,.5]) rbox(.58,.1,.98,.05,MAT.leather,sx - .03,.48,sz + dz);
  box(.84,.04,2.4,MAT.brass,sx,.04,sz,P,false);
  cyl(.32,.32,.34,MAT.travertine,2.95,.17,-.1,40); blob(2.95,-.1,1.1,1.1,.4);
  cyl(.13,.13,.02,MAT.brass,4.4,.01,-1.6); cyl(.012,.012,1.9,MAT.brass,4.4,.95,-1.6,8);
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(4.4,1.9,-1.6), new THREE.Vector3(4.0,2.45,-1.0), new THREE.Vector3(3.4,1.72,-.4));
  P.add(S(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, .012, 8), MAT.brass)));
  const shade = new THREE.Mesh(new THREE.SphereGeometry(.16, 24, 12, 0, Math.PI*2, 0, Math.PI/2), MAT.brass); shade.position.set(3.4,1.72,-.4); P.add(shade);
  sph(.07, MAT.opal, 3.4, 1.66, -.4);
}
// coffee bar: walnut island, marble top, brass espresso machine, cups
{
  const x = -1.1, z = 3.0;
  box(2.0,.88,.5,MAT.walnut,x,.44,z); box(2.12,.05,.6,MAT.marble,x,.905,z); box(2.02,.012,.02,MAT.brass,x,.1,z+.26,P,false); blob(x,z,2.6,1.1,.4);
  const mx = x + .62, my = .93;
  rbox(.3,.3,.3,.03,MAT.chrome,mx,my+.15,z-.04); box(.31,.035,.31,MAT.brass,mx,my+.318,z-.04,P,false);
  box(.24,.012,.12,MAT.steel,mx,my+.01,z+.1,P,false); cyl(.04,.045,.05,MAT.chrome,mx,my+.2,z+.14,16);
  const handle = cyl(.012,.012,.14,MAT.steel,mx,my+.17,z+.22,8); handle.rotation.x = Math.PI/2.4;
  for (const dx of [-.7,-.5,-.3]){ cyl(.045,.045,.006,MAT.cream,x+dx,my+.003,z+.05,20); cyl(.034,.029,.06,MAT.cream,x+dx,my+.036,z+.05,16); }
  // two brass pendants over the bar
  for (const px of [x - .55, x + .35]){ cyl(.004,.004,.9,MAT.brass,px,2.35,z,6); const g = sph(.11,MAT.opal,px,1.84,z); g.geometry = new THREE.SphereGeometry(.11,20,14); cyl(.045,.045,.05,MAT.brass,px,1.97,z,16); }
}
// trophy wall: the plaques (canvas atlas) + a walnut ledge with three brass cups
let trophyMesh;
{
  const w = 3.5, h = 1.75, z = 1.45, y = 1.72;
  trophyMesh = dyn(new THREE.Mesh(new THREE.PlaneGeometry(w, h), std({map:trophyT, transparent:true, roughness:.45, metalness:.1})));
  trophyMesh.rotation.y = Math.PI/2; trophyMesh.position.set(-FX + .17, y, z); P.add(trophyMesh);
  box(.2, .04, 2.2, MAT.walnut, -FX + .26, .72, 1.3); box(.21, .01, 2.2, MAT.brass, -FX + .26, .745, 1.3, P, false);
  const cupPts = [[0,0],[.05,0],[.05,.012],[.014,.02],[.012,.07],[.05,.1],[.07,.2],[.065,.2],[.045,.12],[0,.1]].map(p => new THREE.Vector2(p[0], p[1]));
  const cupG = new THREE.LatheGeometry(cupPts, 20);
  for (const [cz, s] of [[.5,1.1],[1.3,1.35],[2.1,1.0]]){ const c = S(new THREE.Mesh(cupG, MAT.brass)); c.position.set(-FX + .26, .74, cz); c.scale.setScalar(s); P.add(c); }
}
// charging pods (sleeping robots dock here), tucked under the mezzanine
const PODS = [-3.75, -2.85, -1.95, -1.05].map(x => ({x, z:-2.75}));
const podGlow = [];
{
  const shellG = new THREE.CylinderGeometry(.44, .44, 1.62, 32, 1, true, Math.PI - 1.35, 2.7);
  for (const p of PODS){
    cyl(.4,.42,.05,MAT.steel,p.x,.025,p.z,32); const ring = new THREE.Mesh(new THREE.TorusGeometry(.4,.012,8,48), MAT.brass); ring.rotation.x = Math.PI/2; ring.position.set(p.x,.05,p.z); P.add(ring);
    const sh = S(new THREE.Mesh(shellG, MAT.ceramic), false); sh.material = MAT.ceramic; sh.position.set(p.x, .86, p.z); P.add(sh);
    const cap = S(new THREE.Mesh(new THREE.CylinderGeometry(.46,.46,.05,32,1,false,Math.PI - 1.35, 2.7), MAT.brass), false); cap.position.set(p.x, 1.69, p.z); P.add(cap);
    const gm = new THREE.MeshBasicMaterial({color:0xc9a45c, transparent:true, opacity:.25, depthWrite:false, toneMapped:false, blending:THREE.AdditiveBlending});
    const glow = flat(new THREE.RingGeometry(.26,.36,40), gm, p.x, .056, p.z); glow.renderOrder = 3;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(.03, 1.1, .01), new THREE.MeshBasicMaterial({color:0x8a6f4a, toneMapped:false})); strip.position.set(p.x, .95, p.z - .43); P.add(strip);
    podGlow.push({glow, strip, p});
  }
}
plant(-.2, -2.95, .8); plant(-4.05, 3.0, .7);
// "your spot": a brass arc + orange glow at the front corner, where a robot comes when it needs FilthE
const spot = {};
{
  const a0 = Math.PI/2 + .04, al = Math.PI/2 - .08;
  const arc = flat(new THREE.RingGeometry(1.98, 2.01, 64, 1, a0, al), MAT.brass, FX, .007, FZ); arc.rotation.x = -Math.PI/2;
  spot.glow = flat(new THREE.RingGeometry(1.88, 1.97, 64, 1, a0, al), new THREE.MeshBasicMaterial({color:0xf1c48a, transparent:true, opacity:.25, depthWrite:false, toneMapped:false, blending:THREE.AdditiveBlending}), FX, .008, FZ);
  spot.fill = flat(new THREE.CircleGeometry(1.9, 48, a0, al), new THREE.MeshBasicMaterial({color:0xf1c48a, transparent:true, opacity:0, depthWrite:false, toneMapped:false, blending:THREE.AdditiveBlending}), FX, .005, FZ);
}

/* ================= the spiral slide (down) ================= */
const V1 = new THREE.Vector3(), V2 = new THREE.Vector3();
function slidePt(s, out = new THREE.Vector3()){ const th = SLIDE.th0 - s*SLIDE.turns*2*Math.PI; return out.set(SLIDE.cx + Math.cos(th)*SLIDE.R, SLIDE.top + (SLIDE.bot - SLIDE.top)*s, SLIDE.cz + Math.sin(th)*SLIDE.R); }
const slide = {};
{
  P = scene;
  const N = 120, M = 12, r = SLIDE.tr, phi0 = 1.85, pos = [], uv = [], idx = [];
  for (let i=0;i<=N;i++){ const s = i/N, th = SLIDE.th0 - s*SLIDE.turns*2*Math.PI; slidePt(s, V1); const nx = Math.cos(th), nz = Math.sin(th);
    for (let j=0;j<=M;j++){ const ph = -phi0 + 2*phi0*j/M; pos.push(V1.x + nx*r*Math.sin(ph), V1.y + r*(1 - Math.cos(ph)), V1.z + nz*r*Math.sin(ph)); uv.push(j/M, s*6); } }
  for (let i=0;i<N;i++) for (let j=0;j<M;j++){ const a = i*(M+1)+j, b = a + M + 1; idx.push(a, b, a+1, b, b+1, a+1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const trough = S(new THREE.Mesh(g, phys({color:0xf1ece4, roughness:.22, clearcoat:.8, clearcoatRoughness:.15, side:THREE.DoubleSide}))); scene.add(trough);
  const railCurve = (side, lift, out) => { const pts = []; for (let i=0;i<=80;i++){ const s = i/80, th = SLIDE.th0 - s*SLIDE.turns*2*Math.PI; slidePt(s, V1); const ph = side*phi0;
    pts.push(new THREE.Vector3(V1.x + Math.cos(th)*(r*Math.sin(ph) + out), V1.y + r*(1 - Math.cos(ph)) + lift, V1.z + Math.sin(th)*(r*Math.sin(ph) + out))); } return new THREE.CatmullRomCurve3(pts); };
  scene.add(S(new THREE.Mesh(new THREE.TubeGeometry(railCurve(1, .01, 0), 160, .02, 8), MAT.brass)));
  scene.add(S(new THREE.Mesh(new THREE.TubeGeometry(railCurve(-1, .01, 0), 160, .02, 8), MAT.brass)));
  slide.stripMat = new THREE.MeshBasicMaterial({color:0x8a6f4a, toneMapped:false});
  const strip = new THREE.Mesh(new THREE.TubeGeometry(railCurve(1, -.1, .025), 160, .011, 6), slide.stripMat); scene.add(dyn(strip));
  cyl(.05,.05,3.5,MAT.brass,SLIDE.cx,1.75,SLIDE.cz,16); cyl(.2,.24,.05,MAT.brass,SLIDE.cx,.025,SLIDE.cz,24); sph(.07,MAT.brass,SLIDE.cx,3.52,SLIDE.cz);
  for (const s of [.12,.32,.52,.72,.9]){ slidePt(s, V1); const arm = cyl(.014,.014,SLIDE.R,MAT.brassSoft,(V1.x+SLIDE.cx)/2,V1.y - .02,(V1.z+SLIDE.cz)/2,8); arm.rotation.set(0, -Math.atan2(V1.z-SLIDE.cz, V1.x-SLIDE.cx), Math.PI/2); }
  // the landing: a brass-rimmed disc on the floor where the ride ends
  const end = slidePt(1, new THREE.Vector3()); blob(end.x, end.z + .2, 1.0, .9, .3, scene);
  slide.streak = []; for (let i=0;i<12;i++){ const sp = new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex, color:0xf1c48a, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false})); sp.scale.setScalar(.22 - i*.012); sp.visible = false; scene.add(sp); slide.streak.push(sp); }
}
/* ================= the glass suction tube (up) ================= */
const tube = {};
{
  P = scene; const {x, z, r, top} = TUBE;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(r, r, top - .05, 40, 1, true), phys({color:0xcfe3f5, roughness:.02, transparent:true, opacity:.16, depthWrite:false, side:THREE.DoubleSide, envMapIntensity:1.6}));
  glass.position.set(x, (top - .05)/2 + .05, z); glass.renderOrder = 5; scene.add(glass);
  // highlight streak on the glass
  const hl = new THREE.Mesh(new THREE.PlaneGeometry(.06, top - .4), new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:.12, depthWrite:false, toneMapped:false})); hl.position.set(x + r*.7, top/2, z + r*.7); hl.rotation.y = Math.PI/4; hl.renderOrder = 6; scene.add(dyn(hl));
  cyl(r + .08, r + .1, .06, MAT.steel, x, .03, z, 40); for (const y of [.07, 3.1, top]){ const t = new THREE.Mesh(new THREE.TorusGeometry(r + .01, .025, 8, 48), MAT.brass); t.rotation.x = Math.PI/2; t.position.set(x, y, z); scene.add(t); }
  const cap = cyl(r + .06, r + .02, .14, MAT.steel, x, top + .07, z, 40); cap.castShadow = false;
  tube.capMat = new THREE.MeshBasicMaterial({color:0x8a6f4a, toneMapped:false}); const capRing = new THREE.Mesh(new THREE.TorusGeometry(r + .03, .014, 6, 48), tube.capMat); capRing.rotation.x = Math.PI/2; capRing.position.set(x, top - .02, z); scene.add(dyn(capRing));
  // landing lip on the upper floor edge
  box(.9, .06, .5, MAT.slab, x, 3.07, z - .5, scene, false); box(.9, .02, .02, MAT.brass, x, 3.1, z - .26, scene, false);
  tube.ring = new THREE.Mesh(new THREE.TorusGeometry(r - .03, .03, 8, 48), new THREE.MeshBasicMaterial({color:0xf1c48a, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false}));
  tube.ring.rotation.x = Math.PI/2; tube.ring.position.set(x, .2, z); tube.ring.visible = false; scene.add(tube.ring);
  const base = flat(new THREE.RingGeometry(r - .06, r + .02, 48), new THREE.MeshBasicMaterial({color:0xc9a45c, transparent:true, opacity:.35, depthWrite:false, toneMapped:false, blending:THREE.AdditiveBlending}), x, .065, z, scene); base.renderOrder = 3; tube.base = base;
}

/* ================= fewer draw calls: merge the fixed furniture by material ================= */
{
  scene.updateMatrixWorld(true);
  const groups = new Map(), all = [];
  scene.traverse(o => { if (o.isMesh && !o.isInstancedMesh && !o.userData.dyn) all.push(o); });
  for (const o of all){
    const m = o.material; if (Array.isArray(m) || m.transparent || !o.geometry.attributes.uv || !o.geometry.attributes.normal) continue;
    if (Object.values(screens).some(s => s.m === o)) continue;
    let fl = 's'; for (let q = o.parent; q; q = q.parent) if (q === gUp){ fl = 'u'; break; }
    o.userData.fl = fl;
    const key = fl + m.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '') + (o.geometry.index ? 'i' : 'n');
    if (!groups.has(key)) groups.set(key, []); groups.get(key).push(o);
  }
  for (const list of groups.values()){
    if (list.length < 2) continue;
    const up = list[0].userData.fl === 'u', upInv = gUp.matrixWorld.clone().invert();
    const geos = list.map(o => { const g = o.geometry.clone(); for (const k of Object.keys(g.attributes)) if (!['position','normal','uv'].includes(k)) g.deleteAttribute(k); g.morphAttributes = {}; g.clearGroups(); g.applyMatrix4(o.matrixWorld); if (up) g.applyMatrix4(upInv); return g; });
    const merged = mergeGeometries(geos, false); if (!merged) continue;
    const mesh = new THREE.Mesh(merged, list[0].material); mesh.castShadow = list[0].castShadow; mesh.receiveShadow = list[0].receiveShadow; (up ? gUp : scene).add(mesh);
    for (const o of list){ o.parent.remove(o); o.geometry.dispose(); } for (const g of geos) g.dispose();
  }
}

/* ================= the floor plan: aisles per floor, the slide + tube as links =================
 * Local meters per floor (x right, z toward the viewer). SP() turns a local spot into world coordinates. */
const Q = Math.PI/4;
const face = (x, z, tx_, tz) => Math.atan2(tx_ - x, tz - z);
const NODES = {}, ADJ = {};
function node(f, name, x, z){ const F = FL[f]; NODES[(f === 'up' ? 'U:' : 'D:') + name] = {f, x:x + F.ox, z:z + F.oz}; }
[['A0',-2.7,-1.15],['A1',-1.55,-1.15],['A2',-.25,-1.15],['A3',1.05,-1.15],['A4',2.35,-1.15],['A5',3.85,-1.15],
 ['L1',-2.55,.6],['R1',3.85,.55],['F0',-2.7,2.1],['F1',-1.4,2.1],['F2',.3,2.15],['F3',2.0,2.1],['F4',3.85,2.1],['TX',.3,2.95],['SL',4.25,2.3]].forEach(n => node('up', ...n));
[['B0',-3.05,-1.2],['B1',-2.0,-1.2],['B2',-.6,-1.2],['B3',.6,-1.05],['SX',1.95,-1.1],['B4',2.62,-1.5],['M',-.8,.35],
 ['L1',-3.05,.4],['TB',TUBE.x,TUBE.z],['F0',-3.05,1.75],['F1',-1.9,1.7],['F2',-.5,1.7],['F3',1.0,1.75],['F4',2.3,1.85],['R1',2.0,.25],['FS',3.3,2.2]].forEach(n => node('down', ...n));
const EDGES = [['U:A0','U:A1'],['U:A1','U:A2'],['U:A2','U:A3'],['U:A3','U:A4'],['U:A4','U:A5'],['U:A0','U:L1'],['U:L1','U:F0'],['U:F0','U:F1'],['U:F1','U:F2'],['U:F2','U:F3'],['U:F3','U:F4'],
  ['U:A5','U:R1'],['U:R1','U:F4'],['U:F2','U:TX'],['U:F4','U:SL'],
  ['D:B0','D:B1'],['D:B1','D:B2'],['D:B2','D:B3'],['D:B3','D:SX'],['D:SX','D:B4'],['D:B0','D:L1'],['D:L1','D:F0'],['D:F0','D:F1'],['D:F1','D:F2'],['D:F2','D:F3'],['D:F3','D:F4'],
  ['D:SX','D:R1'],['D:R1','D:F4'],['D:B0','D:TB'],['D:L1','D:TB'],['D:B2','D:M'],['D:M','D:F2'],['D:F4','D:FS'],['D:R1','D:FS']];
const RIDES = [{a:'U:SL', b:'D:SX', kind:'slide', cost:3}, {a:'D:TB', b:'U:TX', kind:'tube', cost:3}];
for (const k of Object.keys(NODES)) ADJ[k] = [];
const nd = (a,b) => Math.hypot(NODES[a].x - NODES[b].x, NODES[a].z - NODES[b].z);
for (const [a,b] of EDGES){ ADJ[a].push({to:b, cost:nd(a,b)}); ADJ[b].push({to:a, cost:nd(a,b)}); }
for (const r of RIDES) ADJ[r.a].push({to:r.b, cost:r.cost, ride:r.kind});

function SP(f, x, z, yaw, nodeName, o = {}){ const F = FL[f]; const s = Object.assign({}, o); s.f = f; s.x = x + F.ox; s.z = z + F.oz; s.y = F.oy; s.yaw = yaw;
  s.node = (f === 'up' ? 'U:' : 'D:') + nodeName; s.via = (o.via || []).map(p => [p[0] + F.ox, p[1] + F.oz]); return s; }
const DESK = {
  'code':            SP('up', .2, -3.05, 0, 'A2', {via:[[-.95,-1.35],[-.95,-3.05]], work:'read'}),
  'king':            SP('up', 2.95, -3.05, 0, 'A4', {via:[[2.12,-1.35],[2.12,-3.05]], work:'type'}),
  'builder':         SP('up', -1.55, .05, 0, 'A1', {work:'type'}),
  'designer':        SP('up', -.25, .05, 0, 'A2', {work:'type'}),
  'engine-mechanic': SP('up', 1.05, .05, 0, 'A3', {work:'type'}),
  'qa-tester':       SP('up', 2.35, .05, 0, 'A4', {work:'read'}),
  'hub-keeper':      SP('up', -3.75, 2.6, 1.05, 'F0', {work:'read', seat:true}),
  'cowork':          SP('down', 3.55, -3.05, 0, 'B4', {via:[[2.62,-3.05]], work:'type'}),
  'storm-watch':     SP('down', -2.0, -.2, 0, 'B1', {work:'radar'}),
  'chat-reader':     SP('down', .5, -.1, 0, 'B3', {work:'read'})
};
const BOARD_AT = [-FX, -.35];
const POOL = {
  standup: [[-3.2,-.3],[-3.45,-1.05],[-3.45,.45],[-3.9,-1.7],[-3.95,1.1]].map(([x,z]) => SP('up', x, z, face(x, z, ...BOARD_AT), z < -.6 ? 'A0' : 'L1', {})),
  front:   [SP('down', 3.75, 2.6, Q, 'FS'), SP('down', 3.1, 3.0, Q + .15, 'FS'), SP('down', 4.25, 1.95, Q - .15, 'FS'), SP('down', 2.55, 2.55, Q + .3, 'FS')],
  coffee:  [SP('down', -1.75, 2.35, 0, 'F1'), SP('down', -1.1, 2.35, 0, 'F2'), SP('down', -.45, 2.35, 0, 'F2')],
  lounge:  [SP('down', 3.45, -.6, -Math.PI/2, 'R1', {sofa:true}), SP('down', 3.45, .45, -Math.PI/2, 'R1', {sofa:true}),
            SP('down', 2.25, .95, face(2.25, .95, 2.95, -.1), 'R1'), SP('down', 2.3, -.95, face(2.3, -.95, 2.95, -.1), 'B4'),
            SP('down', -3.55, 1.35, -Math.PI/2 + .25, 'F0'),
            SP('up', 3.95, -2.9, -.5, 'A5'), SP('up', 3.9, 1.2, -.9, 'R1')],
  pod:     PODS.map(p => SP('down', p.x, p.z, 0, p.x < -2.4 ? 'B0' : 'B1')),
  'spare-up':   [SP('up', -2.1, -3.0, 0, 'A0', {via:[[-2.7,-1.4],[-2.75,-3.0]], work:'type', hot:'~hot-up'})],
  'spare-down': [SP('down', -.25, -2.55, 0, 'B2', {work:'type'})]
};

/* ---- routing ---- */
function route(from, to){   // Dijkstra over the aisles + rides (rides are one-way)
  const d = {}, prev = {}, left = new Set(Object.keys(NODES));
  for (const k of left) d[k] = Infinity; d[from] = 0;
  while (left.size){
    let u = null; for (const k of left) if (u === null || d[k] < d[u]) u = k;
    if (d[u] === Infinity) break; left.delete(u); if (u === to) break;
    for (const e of ADJ[u]){ if (!left.has(e.to)) continue; const v = d[u] + e.cost; if (v < d[e.to]){ d[e.to] = v; prev[e.to] = {n:u, ride:e.ride}; } }
  }
  const out = [{n:to}]; let k = to; while (k !== from && prev[k]){ out[0].ride = prev[k].ride; out.unshift({n:prev[k].n}); k = prev[k].n; }
  return out;
}
function nearestNode(x, z, f){ let best = null, bd = 1e9; for (const [k,p] of Object.entries(NODES)){ if (p.f !== f) continue; const dd = Math.hypot(p.x - x, p.z - z); if (dd < bd){ bd = dd; best = k; } } return best; }
const dist = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1]);
function walkLeg(f, pts){
  const clean = [pts[0]]; for (const p of pts.slice(1)) if (dist(p, clean[clean.length-1]) > 0.05) clean.push(p);
  for (let i=1; i<clean.length-1; i++){ const a0 = clean[i-1], b0 = clean[i], c0 = clean[i+1]; const ab = [b0[0]-a0[0], b0[1]-a0[1]], bc = [c0[0]-b0[0], c0[1]-b0[1]];
    if (ab[0]*bc[0] + ab[1]*bc[1] < -0.2*Math.hypot(...ab)*Math.hypot(...bc) && Math.hypot(...ab) < 0.9){ clean.splice(i,1); i--; } }
  const cum = [0]; for (let i=1;i<clean.length;i++) cum.push(cum[i-1] + dist(clean[i], clean[i-1]));
  return {kind:'walk', f, pts:clean, cum, len:cum[cum.length-1]};
}
function pointAt(p, s){
  if (s <= 0) return p.pts[0]; if (s >= p.len) return p.pts[p.pts.length-1];
  let i = 1; while (p.cum[i] < s) i++;
  const t = (s - p.cum[i-1]) / (p.cum[i] - p.cum[i-1]); const A = p.pts[i-1], B = p.pts[i];
  return [A[0] + (B[0]-A[0])*t, A[1] + (B[1]-A[1])*t];
}
const SLIDE_END = slidePt(1, new THREE.Vector3());
function planLegs(sim, target){
  let pts = [[sim.x, sim.z]], f = sim.floor, startNode;
  const cur = sim.spot;
  if (cur && cur.f === f && Math.hypot(cur.x - sim.x, cur.z - sim.z) < 0.3){ for (const p of cur.via.slice().reverse()) pts.push(p); startNode = cur.node; }
  else startNode = nearestNode(sim.x, sim.z, f);
  const path = route(startNode, target.node), legs = [];
  for (const step of path){
    if (step.ride){ legs.push(walkLeg(f, pts)); legs.push({kind:step.ride});
      f = NODES[step.n].f; pts = step.ride === 'slide' ? [[SLIDE_END.x, SLIDE_END.z]] : [[NODES[step.n].x, NODES[step.n].z]]; }
    pts.push([NODES[step.n].x, NODES[step.n].z]);
  }
  for (const p of target.via) pts.push(p);
  pts.push([target.x, target.z]);
  legs.push(walkLeg(f, pts));
  return legs.filter(l => l.kind !== 'walk' || l.len > .02 || l === legs[legs.length-1]);
}

/* ================= the crew: movement + state (driven by HUB.agents[i].st / spot / seq) ================= */
const sims = {}, claims = new Map();
function simFor(a, i){
  if (!sims[a.id]) sims[a.id] = {id:a.id, x:0, y:0, z:0, floor:'down', vx:0, vz:0, yaw:0, yawDraw:0, bank:0, pitch:0, legs:null, li:0, s:0, v:0, moving:false, target:null, spot:null,
    queue:[], pose:'idle', poseT:0, seq:undefined, wanderAt:0, phase:(i||0)*1.37, blinkAt:2 + (i||0)*.7, blinkT:0, ride:null, wobble:0, pending:false, hidden:false};
  return sims[a.id];
}
const defFloor = a => (a.def && a.def.floor) === 'down' ? 'down' : 'up';
function release(sim){ for (const [s,id] of claims) if (id === sim.id) claims.delete(s); }
function claim(sim, pool, sameFloor){
  const list = (POOL[pool] || []).filter(s => !sameFloor || s.f === sim.floor);
  const mine = list.find(s => claims.get(s) === sim.id); if (mine && pool !== 'lounge' && pool !== 'coffee') return mine;
  let free = list.filter(s => !claims.has(s) || claims.get(s) === sim.id);
  if (pool === 'lounge' || pool === 'coffee'){ const other = free.filter(s => s !== sim.spot); if (other.length) free = other; }
  if (!free.length) return null;
  const pick = (pool === 'lounge' || pool === 'coffee') ? free[Math.floor(Math.random()*free.length)] : free[0];
  release(sim); claims.set(pick, sim.id); return pick;
}
function deskFor(sim, a){ if (DESK[sim.id]){ release(sim); return DESK[sim.id]; } return claim(sim, 'spare-' + defFloor(a)) || claim(sim, 'lounge'); }
function spotFor(sim, a, key){
  if (key === 'desk') return deskFor(sim, a);
  if (key === 'pod') return claim(sim, 'pod') || deskFor(sim, a);
  if (key === 'idle') return claim(sim, Math.random() < .3 ? 'coffee' : 'lounge') || claim(sim, 'lounge') || claim(sim, 'coffee');
  if (key === 'wander') return claim(sim, Math.random() < .3 ? 'coffee' : 'lounge', true) || claim(sim, 'lounge', true);
  if (key === 'coffee') return claim(sim, 'coffee') || claim(sim, 'lounge');
  if (key === 'lounge') return claim(sim, 'lounge') || claim(sim, 'coffee');
  if (key === 'front') return claim(sim, 'front') || claim(sim, 'lounge');
  if (key === 'standup') return claim(sim, 'standup') || deskFor(sim, a);
  return null;
}
function place(sim, spot){ sim.x = spot.x; sim.z = spot.z; sim.y = spot.y; sim.floor = spot.f; sim.vx = sim.vz = 0; sim.yaw = sim.yawDraw = spot.yaw; sim.spot = spot; sim.moving = false; sim.legs = null; sim.ride = null; }
function go(sim, spot){
  if (!spot) return false;
  if (sim.spot === spot && Math.hypot(spot.x - sim.x, spot.z - sim.z) < 0.08) return false;
  if (RM.matches){ place(sim, spot); return false; }
  sim.legs = planLegs(sim, spot); sim.li = 0; sim.s = 0; sim.v = 0; sim.moving = true; sim.target = spot; sim.spot = null; sim.pose = 'glide'; sim.poseT = 0;
  startLeg(sim); return true;
}
function startLeg(sim){ const L = sim.legs[sim.li]; sim.s = 0; if (L.kind !== 'walk'){ sim.ride = {kind:L.kind, t:0, x0:sim.x, z0:sim.z}; sim.pose = 'ride'; sim.poseT = 0; } else if (sim.pose === 'ride') sim.pose = 'glide'; }
function runQueue(sim, a){
  while (sim.queue.length){
    const step = sim.queue[0];
    if (!step.started){ step.started = true; const sp = step.spot ? spotFor(sim, a, step.spot) : null; if (sp && go(sim, sp)) return; }
    if (sim.moving) return;
    if (!step.posed){ step.posed = true; sim.pose = step.pose; sim.poseT = 0; if (sim.spot) sim.yaw = sim.spot.yaw; }
    if (step.dur && sim.poseT < step.dur) return;
    sim.queue.shift();
  }
}
function workPose(sim, spot){ const w = spot && spot.work; return w === 'radar' ? 'radar' : w === 'read' ? 'read' : 'type'; }
function applyState(sim, a, instant){
  const st = a.st, q = [];
  if (st === 'working'){ if (a.spot === 'standup') q.push({spot:'standup', pose:'meet'}); else q.push({spot:'desk', pose:'work'}); }
  else if (st === 'sleeping') q.push({spot:'pod', pose:'sleep'});
  else if (st === 'waiting') q.push({spot:'front', pose:'wait'});
  else if (st === 'blocked') q.push({spot:'desk', pose:'blocked'});
  else if (st === 'done') q.push({spot:null, pose:'cheer', dur:2.4}, {spot:'coffee', pose:'coffee', dur:6}, {spot:'lounge', pose:'lounge'});
  else q.push({spot:'idle', pose:'lounge'});
  sim.queue = q; sim.wanderAt = 0;
  // the pose at a spot follows the spot (work pose at a desk, coffee at the bar, lounge elsewhere)
  for (const s of q) if (s.pose === 'work' || s.pose === 'lounge') s.dyn = true;
  if (instant || RM.matches){
    // place, don't walk: finish the whole queue at once except a timed pose (cheer)
    while (q.length){ const step = q[0]; const sp = step.spot ? spotFor(sim, a, step.spot) : null; if (sp) place(sim, sp); step.started = step.posed = true;
      sim.pose = resolvePose(sim, step); sim.poseT = instant ? 3 + sim.phase : 0; if (step.dur && !instant) break; q.shift(); if (!instant) break; if (step.dur) continue; }
  }
}
function resolvePose(sim, step){ if (step.pose === 'work') return workPose(sim, sim.spot); if (step.pose === 'lounge' && sim.spot && POOL.coffee.includes(sim.spot)) return 'coffee'; return step.pose; }
const origRun = runQueue;
function stepQueue(sim, a){ // runQueue + dynamic poses
  const step = sim.queue[0]; if (step && step.dyn && !step.posed && step.started && !sim.moving){ step.posed = true; sim.pose = resolvePose(sim, step); sim.poseT = 0; if (sim.spot) sim.yaw = sim.spot.yaw; if (!step.dur) sim.queue.shift(); return; }
  origRun(sim, a);
}
const ease = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2;
const TUBE_T = 1.35, SLIDE_T = 2.6;
function stepSim(sim, a, dt){
  sim.poseT += dt; sim.wobble = Math.max(0, sim.wobble - dt*1.6);
  if (sim.moving){
    const L = sim.legs[sim.li];
    if (L.kind === 'walk'){
      const k = 38, damp = 2*Math.sqrt(k)*0.95, n = Math.ceil(dt/0.012), h = dt/n; let c = pointAt(L, sim.s);
      for (let i = 0; i < n; i++){
        const left = L.len - sim.s;
        sim.v = Math.min(1.9, sim.v + 2.6*h, Math.sqrt(2*1.9*Math.max(0,left)) + 0.05);
        sim.s = Math.min(L.len, sim.s + sim.v*h);
        c = pointAt(L, Math.min(L.len, sim.s + 0.18));
        sim.vx += (k*(c[0]-sim.x) - damp*sim.vx)*h; sim.vz += (k*(c[1]-sim.z) - damp*sim.vz)*h;
        sim.x += sim.vx*h; sim.z += sim.vz*h;
      }
      const last = sim.li === sim.legs.length - 1;
      if (sim.s >= L.len && Math.hypot(c[0]-sim.x, c[1]-sim.z) < (last ? 0.03 : 0.08) && (!last || Math.hypot(sim.vx,sim.vz) < 0.08)){
        if (last){ place(sim, sim.target); sim.pose = 'settle'; if (sim.pending){ sim.pending = false; applyState(sim, a, false); } }
        else { sim.li++; startLeg(sim); }
      }
    } else {
      const R = sim.ride; R.t += dt;
      if (R.kind === 'slide'){
        const p = Math.min(1, R.t/SLIDE_T);
        if (p < .08){ const k = p/.08; slidePt(0, V1); sim.x = R.x0 + (V1.x - R.x0)*k; sim.z = R.z0 + (V1.z - R.z0)*k; sim.y = FL.up.oy; sim.yawDraw = sim.yaw = Math.atan2(V1.x - R.x0, V1.z - R.z0) || sim.yawDraw; }
        else { const q = (p - .08)/.92, s = q*q*.4 + q*.6; slidePt(s, V1); slidePt(Math.min(1, s + .01), V2); sim.x = V1.x; sim.z = V1.z; sim.y = V1.y;
          sim.yawDraw = sim.yaw = Math.atan2(V2.x - V1.x, V2.z - V1.z); sim.bank = -.32; }
        R.s = p;
        if (p >= 1){ sim.floor = 'down'; sim.y = 0; sim.bank = 0; sim.vx = Math.sin(sim.yaw)*1.2; sim.vz = Math.cos(sim.yaw)*1.2; sim.ride = null; sim.wobble = .6; sim.li++; startLeg(sim); }
      } else {
        const p = Math.min(1, R.t/TUBE_T), top = FL.up.oy + .45;
        if (p < .62){ const k = ease(p/.62); sim.x = TUBE.x; sim.z = TUBE.z; sim.y = k*top; sim.yawDraw += dt*4.5*(1 - k); }
        else { const k = 1 - Math.pow(1 - (p - .62)/.38, 2), X = NODES['U:TX']; sim.x = TUBE.x + (X.x - TUBE.x)*k; sim.z = TUBE.z + (X.z - TUBE.z)*k; sim.y = top + (FL.up.oy - top)*k + Math.sin(k*Math.PI)*.12;
          const want = Math.atan2(X.x - TUBE.x, X.z - TUBE.z); let d = want - sim.yawDraw; while (d > Math.PI) d -= 2*Math.PI; while (d < -Math.PI) d += 2*Math.PI; sim.yawDraw += d*Math.min(1, dt*8); sim.yaw = sim.yawDraw; }
        R.s = p;
        if (p >= 1){ sim.floor = 'up'; sim.y = FL.up.oy; sim.vx = sim.vz = 0; sim.ride = null; sim.wobble = 1; sim.li++; startLeg(sim); }
      }
    }
  }
  if (!sim.ride){
    const sp = Math.hypot(sim.vx, sim.vz);
    const want = (sim.moving && sp > 0.12) ? Math.atan2(sim.vx, sim.vz) : (sim.spot ? sim.spot.yaw : sim.yaw);
    let d = want - sim.yawDraw; while (d > Math.PI) d -= 2*Math.PI; while (d < -Math.PI) d += 2*Math.PI;
    const turn = d * Math.min(1, dt*5.5); sim.yawDraw += turn;
    sim.bank += ((sim.moving ? Math.max(-.22, Math.min(.22, -turn/Math.max(dt,1e-3)*0.05)) : 0) - sim.bank) * Math.min(1, dt*6);
    sim.pitch += ((sim.moving ? Math.min(.14, sp*0.07) : 0) - sim.pitch) * Math.min(1, dt*5);
  }
  stepQueue(sim, a);
  // idle life: drift between lounge + coffee spots on the same floor every so often
  if (!sim.moving && !sim.queue.length && (a.st === 'idle' || a.st === 'done') && !RM.matches){
    if (!sim.wanderAt) sim.wanderAt = sim.poseT + 9 + Math.random()*7;
    else if (sim.poseT > sim.wanderAt){ sim.wanderAt = 0; sim.queue = [{spot:'wander', pose:'lounge', dyn:true}]; }
  }
  if (sim.blinkT > 0) sim.blinkT -= dt; else if ((sim.blinkAt -= dt) <= 0){ sim.blinkT = 0.13; sim.blinkAt = 2.4 + Math.random()*4; }
}
function syncAgent(a, i){
  const sim = simFor(a, i);
  if (a.hidden){ if (!sim.hidden){ sim.hidden = true; release(sim); sim.seq = undefined; } return sim; }
  if (sim.hidden){ sim.hidden = false; }
  if (sim.seq !== a.seq){
    const first = sim.seq === undefined; sim.seq = a.seq;
    if (sim.ride){ sim.pending = true; }
    else applyState(sim, a, first || !!a.instant && first);
  }
  return sim;
}

/* ================= theme (CONTRACT v2 HUB.theme): the strip colors; re-read only when theme.v changes ================= */
const THEME_DEF = {work:'#f1c48a', idle:'#cdb896', need:'#f5883a', stuck:'#e0685c', sleep:'#3a3632', jewel:'#c9a45c'};
const TH = {v:undefined, mode:'ember-only', silent:new THREE.Color(0x6d6a66)};
for (const k of Object.keys(THEME_DEF)) TH[k] = new THREE.Color(THEME_DEF[k]);
function readTheme(){
  const t = HUB.theme, v = t ? t.v : null; if (v === TH.v) return false; TH.v = v;
  for (const k of Object.keys(THEME_DEF)){ const c = t && typeof t[k] === 'string' && /^#[0-9a-f]{6}$/i.test(t[k]) ? t[k] : THEME_DEF[k]; TH[k].set(c); }
  TH.mode = t && t.stripMode === 'brand' ? 'brand' : 'ember-only';
  TONE.need = '#' + TH.need.getHexString(); TONE.orange = '#' + TH.work.getHexString(); TONE.red = '#' + TH.stuck.getHexString();
  return true;
}
readTheme();
/* the shared "needs you" breath (HUB.breath), with our own 5 s clock as the fallback */
function breathK(){ const b = HUB.breath; if (typeof b === 'number' && isFinite(b)) return b; const tt = performance.now()/1000; return .35 + .65*(.5 - .5*Math.cos(2*Math.PI*tt/5)); }

/* ================= robots: matte ceramic, black glass visor, the HMP orange light strip, dressed for the job ================= */
const bodyPts = [[0,0],[.085,.005],[.15,.028],[.19,.075],[.208,.15],[.213,.25],[.207,.35],[.19,.44],[.162,.52],[.12,.585],[.065,.628],[0,.64]].map(p => new THREE.Vector2(p[0], p[1]));
const G = {
  body: new THREE.LatheGeometry(bodyPts, PHONE ? 28 : 40),
  head: new RoundedBoxGeometry(.38,.25,.31,3,.095),
  visor: new RoundedBoxGeometry(.32,.14,.05,3,.022),
  eyes: mergeGeometries([-1,1].map(s => new THREE.CircleGeometry(.026, 24).scale(1.45, 1, 1).translate(s*.066, 0, 0))),
  strip: new THREE.TorusGeometry(.2145,.0095,6,64),
  halo: new THREE.TorusGeometry(.216,.03,6,64),
  hand: new THREE.SphereGeometry(.044, 14, 10),
  neck: new THREE.CylinderGeometry(.055,.07,.07,24),
  ears: mergeGeometries([-1,1].map(s => new THREE.CylinderGeometry(.038,.038,.018,20).rotateZ(Math.PI/2).translate(s*.193, 0, 0))),
  chase: new THREE.SphereGeometry(.02, 10, 8),
  pilot: new THREE.SphereGeometry(.009, 8, 6),
  ring: new THREE.RingGeometry(.36,.4,64),
  badge: new THREE.CircleGeometry(.03, 20),
  tablet: new RoundedBoxGeometry(.26,.012,.18,2,.006),
  cup: new THREE.CylinderGeometry(.035,.03,.065,16)
};
/* outfit parts are merged per material into one mesh each (keeps the draw count low) */
const M4 = new THREE.Matrix4(), QT = new THREE.Quaternion(), EU = new THREE.Euler(), VP = new THREE.Vector3(), VS = new THREE.Vector3();
function part(kit, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx){
  const g = geo.clone(); M4.compose(VP.set(x,y,z), QT.setFromEuler(EU.set(rx,ry,rz)), VS.set(sx,sy,sz)); g.applyMatrix4(M4);
  for (const k of Object.keys(g.attributes)) if (!['position','normal','uv'].includes(k)) g.deleteAttribute(k);
  if (!kit.has(mat)) kit.set(mat, []); kit.get(mat).push(g.index ? g.toNonIndexed() : g);
}
function bake(kit, parent, cast){ for (const [mat, geos] of kit){ const m = new THREE.Mesh(mergeGeometries(geos, false), mat); m.castShadow = cast; parent.add(m); } }
const HALF = (r, seg = 24) => new THREE.SphereGeometry(r, seg, 12, 0, Math.PI*2, 0, Math.PI/2);
const BRIM = (r, h = .014, seg = 36) => new THREE.CylinderGeometry(r, r, h, seg);
const PEAK = (r) => new THREE.CylinderGeometry(r, r, .012, 24, 1, false, -Math.PI/2, Math.PI);
function dress(a, R, def){
  const head = new Map(), body = new Map(), prop = new Map(), cast = !PHONE;
  const o = def.outfit;
  if (o === 'crown'){
    const crown = new THREE.Group(); crown.position.y = .165; crown.scale.setScalar(1.25); R.head.add(crown);
    const cm = new Map();
    part(cm, new THREE.CylinderGeometry(.13,.12,.05,40,1,true), MAT.brass);
    for (let i=0;i<5;i++){ const ang = i/5*Math.PI*2; part(cm, new THREE.ConeGeometry(.024,.075,12), MAT.brass, Math.cos(ang)*.125, .06, Math.sin(ang)*.125); part(cm, new THREE.SphereGeometry(.012,10,8), MAT.brass, Math.cos(ang)*.125, .1, Math.sin(ang)*.125); }
    part(cm, new THREE.SphereGeometry(.018,12,10), MAT.orange, 0, 0, .13);
    bake(cm, crown, cast); crown.children.forEach(m => { if (m.material === MAT.brass) m.material = MAT.brass; }); R.crown = crown;
    // the cape: deep red velvet, hung from the shoulders
    part(body, new THREE.CylinderGeometry(.13, .29, .52, 28, 1, true, Math.PI - 1.35, 2.7), MAT.velvet, 0, .36, -.012);
    part(body, new THREE.TorusGeometry(.29, .014, 6, 28, 2.7), MAT.brass, 0, .1, -.012, Math.PI/2, 0, -Math.PI/2 - 1.35 + Math.PI);
    part(body, new THREE.SphereGeometry(.022, 10, 8), MAT.brass, -.1, .6, .06); part(body, new THREE.SphereGeometry(.022, 10, 8), MAT.brass, .1, .6, .06);
  } else if (o === 'headset'){
    part(head, new THREE.TorusGeometry(.176,.011,8,40,Math.PI), MAT.brass, 0, .02, 0, 0, Math.PI/2, 0);
    part(head, new THREE.CylinderGeometry(.006,.006,.16,8), MAT.brass, .2, -.07, .07, Math.PI/2.3, 0, 0);
    part(head, new THREE.SphereGeometry(.018,10,8), MAT.steel, .2, -.1, .14);
    part(body, new THREE.BoxGeometry(.05, .04, .03), MAT.brass, 0, .585, .125, -.5, 0, 0);
    part(body, new THREE.ConeGeometry(.045, .22, 4).rotateX(Math.PI).rotateY(Math.PI/4), MAT.brass, 0, .47, .19, -.42, 0, 0, 1, 1, .28);
  } else if (o === 'captain'){
    part(head, new THREE.CylinderGeometry(.176, .15, .085, 32), MAT.hatWhite, 0, .17, -.005);
    part(head, new THREE.CylinderGeometry(.19, .178, .025, 32), MAT.hatWhite, 0, .22, -.01);
    part(head, new THREE.CylinderGeometry(.153, .153, .032, 32), MAT.hatBlack, 0, .143, -.005);
    part(head, PEAK(.15), MAT.hatBlack, 0, .135, .06, .28, 0, 0);
    part(head, new THREE.TorusGeometry(.012, .005, 6, 16), MAT.brass, 0, .175, .165);
    part(head, new THREE.CylinderGeometry(.006, .006, .16, 6), MAT.brass, 0, .15, .158, 0, 0, Math.PI/2);
  } else if (o === 'rainhat'){
    part(head, HALF(.17), MAT.hatYellow, 0, .12, -.01, 0, 0, 0, 1.05, .82, 1.05);
    part(head, BRIM(.26), MAT.hatYellow, 0, .13, -.045, -.14, 0, 0, 1, 1, 1.12);
    // antenna through the hat, blinking tip
    part(head, new THREE.CylinderGeometry(.007,.007,.22,8), MAT.brass, .09, .3, -.02);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(.026,12,10), new THREE.MeshBasicMaterial({color:0xff6a3d, toneMapped:false})); tip.position.set(.09,.42,-.02); R.head.add(tip); R.tip = tip;
  } else if (o === 'hardhat'){
    part(head, HALF(.18), MAT.hatOrange, 0, .11, 0, 0, 0, 0, 1, .8, 1.06);
    part(head, BRIM(.215), MAT.hatOrange, 0, .115, 0);
    part(head, PEAK(.235), MAT.hatOrange, 0, .116, .02);
    part(head, new THREE.BoxGeometry(.04, .03, .32), MAT.hatOrange, 0, .255, 0);
    part(body, new THREE.TorusGeometry(.213, .022, 8, 40), MAT.belt, 0, .15, 0, Math.PI/2, 0, 0);
    part(body, new THREE.BoxGeometry(.05, .045, .02), MAT.brass, 0, .15, .222);
    part(body, new THREE.BoxGeometry(.085, .1, .055), MAT.belt, .165, .1, .12, 0, .75, 0);
    part(body, new THREE.CylinderGeometry(.011, .011, .17, 8), MAT.wood, -.205, .08, .06, 0, 0, .15);
    part(body, new THREE.BoxGeometry(.075, .028, .028), MAT.steel, -.217, .165, .06, 0, 0, .15);
  } else if (o === 'beret'){
    part(head, new THREE.SphereGeometry(.175, 24, 12), MAT.beret, -.035, .15, 0, 0, 0, .2, 1.05, .3, 1.05);
    part(head, new THREE.CylinderGeometry(.01, .012, .035, 8), MAT.beret, -.07, .21, 0, 0, 0, .2);
    part(head, new THREE.CylinderGeometry(.011, .011, .2, 6), MAT.pencil, .216, .07, .0, Math.PI/2 - .35, 0, 0);
    part(head, new THREE.ConeGeometry(.011, .035, 6), MAT.wood, .216, .037, .11, Math.PI/2 - .35, 0, 0);
    part(head, new THREE.CylinderGeometry(.011, .011, .025, 6), MAT.pink, .216, .104, -.105, Math.PI/2 - .35, 0, 0);
  } else if (o === 'goggles'){
    part(head, new THREE.TorusGeometry(.2, .013, 6, 40), MAT.hatBlack, 0, .085, 0, Math.PI/2, 0, 0, 1.02, .85, 1);
    for (const s of [-1,1]){ part(head, new THREE.CylinderGeometry(.05, .05, .045, 20), MAT.lens, s*.072, .105, .158, Math.PI/2, 0, 0);
      part(head, new THREE.TorusGeometry(.05, .01, 6, 20), MAT.brass, s*.072, .105, .182); }
    // wrench (in hand)
    part(prop, new THREE.BoxGeometry(.02, .15, .012), MAT.chrome, 0, -.02, 0);
    part(prop, new THREE.TorusGeometry(.03, .011, 6, 14, Math.PI*1.4), MAT.chrome, 0, .075, 0, 0, 0, -Math.PI*.2);
    part(prop, new THREE.TorusGeometry(.022, .009, 6, 14), MAT.chrome, 0, -.1, 0);
  } else if (o === 'glasses'){
    for (const s of [-1,1]){ part(head, new THREE.TorusGeometry(.043, .007, 8, 24), MAT.brass, s*.066, 0, .174);
      part(head, new THREE.CylinderGeometry(.005, .005, .12, 6), MAT.brass, s*.112, 0, .115, Math.PI/2, 0, 0); }
    part(head, new THREE.CylinderGeometry(.005, .005, .045, 6), MAT.brass, 0, .012, .176, 0, 0, Math.PI/2);
    // clipboard (in hand)
    part(prop, new THREE.BoxGeometry(.14, .19, .012), MAT.belt, 0, 0, 0);
    part(prop, new THREE.BoxGeometry(.12, .15, .004), MAT.paper, 0, -.01, .008);
    part(prop, new THREE.BoxGeometry(.05, .02, .02), MAT.brass, 0, .09, .008);
  } else if (o === 'explorer'){
    part(head, HALF(.18), MAT.khaki, 0, .11, 0, 0, 0, 0, 1, .9, 1.1);
    part(head, BRIM(.265), MAT.khaki, 0, .115, 0, .05, 0, 0, 1, 1, 1.08);
    part(head, new THREE.CylinderGeometry(.183, .183, .03, 32), MAT.belt, 0, .135, 0, 0, 0, 0, 1, 1, 1.1);
    part(head, new THREE.SphereGeometry(.018, 10, 8), MAT.khaki, 0, .27, 0);
    // magnifying glass (in hand)
    part(prop, new THREE.CylinderGeometry(.012, .014, .1, 8), MAT.wood, 0, -.05, 0);
    part(prop, new THREE.TorusGeometry(.045, .01, 8, 28), MAT.brass, 0, .045, 0);
    part(prop, new THREE.CircleGeometry(.04, 24), MAT.glassTop, 0, .045, 0);
  } else if (o === 'newsboy'){
    part(head, new THREE.SphereGeometry(.19, 24, 12), MAT.tweed, 0, .15, -.015, 0, 0, 0, 1, .36, 1.06);
    part(head, new THREE.CylinderGeometry(.172, .172, .035, 32), MAT.tweed, 0, .133, 0, 0, 0, 0, 1, 1, 1.05);
    part(head, PEAK(.13), MAT.tweed, 0, .128, .12, .22, 0, 0);
    part(head, new THREE.SphereGeometry(.02, 10, 8), MAT.tweed, 0, .215, -.01);
    // stack of papers (in hand)
    for (let i=0;i<4;i++) part(prop, new THREE.BoxGeometry(.18, .012, .12), MAT.paper, 0, i*.014, 0, 0, (i-1.5)*.1, 0);
  }
  if (head.size) bake(head, R.head, cast);
  if (body.size) bake(body, R.hov, cast);
  if (prop.size){ const g = new THREE.Group(); bake(prop, g, false); R.hands[0].add(g); R.prop = g;
    if (o === 'newsboy'){ g.position.set(.04, .03, .03); g.rotation.set(.2, 0, .25); } else if (o === 'glasses'){ g.position.set(.03, .06, .05); g.rotation.set(-.25, .2, 0); }
    else g.position.set(0, .06, .02); }
}
const robots = {};
function makeRobot(a){
  const def = a.def || {}, shell = def.graphite ? MAT.graphite : MAT.ceramic, cast = !PHONE;
  const root = new THREE.Group(), hov = new THREE.Group(); root.add(hov); scene.add(root); hov.scale.setScalar(1.24);
  const body = S(new THREE.Mesh(G.body, shell), cast); hov.add(body);
  const stripMat = new THREE.MeshBasicMaterial({color:0xf5883a, toneMapped:false});
  const haloMat = new THREE.MeshBasicMaterial({color:0xf5883a, transparent:true, opacity:.3, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false});
  const strip = new THREE.Mesh(G.strip, stripMat); strip.rotation.x = Math.PI/2; strip.position.y = .25; hov.add(strip);
  const halo = new THREE.Mesh(G.halo, haloMat); halo.rotation.x = Math.PI/2; halo.position.y = .25; hov.add(halo);
  const chase = new THREE.Mesh(G.chase, new THREE.MeshBasicMaterial({color:0xfff0de, toneMapped:false})); hov.add(chase);
  const neck = new THREE.Mesh(G.neck, MAT.steel); neck.position.y = .655; hov.add(neck);
  const head = new THREE.Group(); head.position.y = .82; hov.add(head);
  head.add(S(new THREE.Mesh(G.head, shell), cast));
  const visor = new THREE.Mesh(G.visor, MAT.visor); visor.position.set(0, -.004, .138); head.add(visor);
  const eyeMat = new THREE.MeshBasicMaterial({color:0xfff2e0, toneMapped:false});
  const eye = new THREE.Mesh(G.eyes, eyeMat); eye.position.set(0, -.002, .1655); eye.scale.set(1, .6, 1); head.add(eye);
  head.add(new THREE.Mesh(G.ears, MAT.brass));
  const badge = new THREE.Mesh(G.badge, new THREE.MeshBasicMaterial({color:new THREE.Color(def.color || '#f5883a'), toneMapped:false}));
  const bz = Math.sqrt(.207*.207 - .1*.1) + .004; badge.position.set(-.1, .36, bz); badge.rotation.y = Math.atan2(-.1, bz); hov.add(badge);
  const hands = [-1,1].map(s => { const h = S(new THREE.Mesh(G.hand, shell), cast); h.position.set(s*.28,.32,.04); hov.add(h); return h; });
  const tablet = new THREE.Group(); tablet.add(new THREE.Mesh(G.tablet, MAT.visor));
  const tscr = new THREE.Mesh(new THREE.PlaneGeometry(.23,.15), new THREE.MeshBasicMaterial({map:holo(a.id === 'qa-tester' ? 'tests' : a.id === 'code' ? 'board' : a.id === 'chat-reader' ? 'news' : 'code'), transparent:true, toneMapped:false, opacity:.9}));
  tscr.rotation.x = -Math.PI/2; tscr.position.y = .007; tablet.add(tscr); tablet.visible = false; hov.add(tablet);
  const cup = new THREE.Mesh(G.cup, MAT.cream); cup.visible = false; hov.add(cup);
  const steam = [0,1,2].map(() => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex, color:0xffffff, transparent:true, opacity:0, depthWrite:false})); sp.scale.set(.07,.07,1); sp.visible = false; hov.add(sp); return sp; });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1,1), new THREE.MeshBasicMaterial({map:blobTex, transparent:true, opacity:.55, depthWrite:false})); shadow.rotation.x = -Math.PI/2; shadow.position.y = .008; root.add(shadow);
  const ringMat = new THREE.MeshBasicMaterial({color:0xf5883a, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false, side:THREE.DoubleSide});
  const ring = new THREE.Mesh(G.ring, ringMat); ring.rotation.x = -Math.PI/2; ring.position.y = .01; ring.visible = false; root.add(ring);
  const ring2 = new THREE.Mesh(G.ring, ringMat.clone()); ring2.rotation.x = -Math.PI/2; ring2.position.y = .011; ring2.visible = false; root.add(ring2);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex, color:0xf5883a, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false})); glow.scale.set(1,.6,1); glow.position.y = .25; hov.add(glow);
  const pilot = new THREE.Mesh(G.pilot, new THREE.MeshBasicMaterial({color:0xc9a45c, transparent:true, opacity:0, toneMapped:false})); pilot.position.set(0, .25, .226); pilot.visible = false; hov.add(pilot);
  stripMat.color.copy(TH.idle); haloMat.color.copy(TH.idle);
  const R = robots[a.id] = {root, hov, head, body, strip, stripMat, halo, haloMat, chase, pilot, eyes:[eye], eyeMat, hands, tablet, cup, steam, shadow, ring, ring2, glow, h:.2,
    hl:[new THREE.Vector3(-.28,.32,.04), new THREE.Vector3(.28,.32,.04)], lastPose:'', hat:def.outfit && def.outfit !== 'headset' && def.outfit !== 'glasses' ? (def.outfit === 'crown' ? .17 : .12) : 0};
  dress(a, R, def);
  return R;
}

/* sparkle burst for "done" */
const bursts = [];
function burst(x, y, z){
  const n = PHONE ? 30 : 42, pos = new Float32Array(n*3), colr = new Float32Array(n*3), vel = [];
  const pal = [[.95,.8,.5],[.79,.64,.36],[1,.95,.85]];
  for (let i=0;i<n;i++){ pos.set([x,y,z], i*3); colr.set(pal[i%3], i*3); const a = Math.random()*Math.PI*2, up = 1.4 + Math.random()*1.6, sp = .5 + Math.random()*1.1; vel.push([Math.cos(a)*sp, up, Math.sin(a)*sp]); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  const mat = new THREE.PointsMaterial({size:4*DPR, sizeAttenuation:false, vertexColors:true, transparent:true, opacity:1, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false});
  const p = new THREE.Points(geo, mat); scene.add(p); bursts.push({p, vel, t:0});
}

/* handoffs: a glowing folder flies from the sender to the receiver */
const flights = [];
const folderG = (() => { const k = new Map();
  part(k, new THREE.BoxGeometry(.24, .012, .17), MAT.brass, 0, 0, 0); part(k, new THREE.BoxGeometry(.09, .012, .03), MAT.brass, -.06, 0, -.095);
  part(k, new THREE.BoxGeometry(.2, .004, .13), MAT.paper, .005, .01, .01); return k; })();
function spawnFolder(from, to){
  const g = new THREE.Group(); bake(folderG, g, false);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex, color:0xe3c98f, transparent:true, opacity:.8, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false})); glow.scale.setScalar(.7); g.add(glow);
  scene.add(g); flights.push({g, glow, from, to, t:0});
}
const headPos = (sim, out) => out.set(sim.x, sim.y + 1.5, sim.z);

/* ================= lights (ART 6.2): hemi + key + rim + 6 lamps + the call pool = 10, all made here, none at runtime ================= */
const hemi = new THREE.HemisphereLight(0x3a4468, 0x3a2a1f, .5); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xff9a5c, .5); sun.castShadow = true;           // the key: low sun at dusk, a cool moon at night
sun.shadow.mapSize.set(PHONE ? 1024 : 2048, PHONE ? 1024 : 2048);
Object.assign(sun.shadow.camera, {left:-10, right:10, top:10, bottom:-10, near:1, far:60});
sun.shadow.bias = -.0004; sun.shadow.normalBias = .02; scene.add(sun); scene.add(sun.target);
const rim = new THREE.DirectionalLight(0x9fb4ff, .3); rim.position.set(12, 9, -10); rim.target.position.set(-1.5, 1.5, -2); scene.add(rim); scene.add(rim.target);
const LAMPC = 0xffc38a;
const LAMPS = [
  {l:new THREE.PointLight(LAMPC, 16, 8, 2), p:[.4 + FL.up.ox, FL.up.oy + 1.55, .72 + FL.up.oz], k:16, halo:[[-.9,1.7,.72],[.4,1.7,.72],[1.7,1.7,.72]].map(([x,y,z]) => [x + FL.up.ox, y + FL.up.oy, z + FL.up.oz])},  // the Code lab bar
  {l:new THREE.PointLight(LAMPC, 7, 5, 2),  p:[1.0 + FL.up.ox, FL.up.oy + 1.12, -2.45 + FL.up.oz], k:7, halo:[[1.0 + FL.up.ox, FL.up.oy + 1.15, -2.62 + FL.up.oz]]},   // the King's desk lamp
  {l:new THREE.PointLight(LAMPC, 12, 7, 2), p:[3.4, 1.55, -.4], k:12, halo:[[3.4, 1.64, -.4]]},                                     // downstairs: sofa arc lamp
  {l:new THREE.PointLight(LAMPC, 10, 7, 2), p:[-1.1, 1.7, 2.6], k:10, halo:[[-1.65, 1.84, 3.0], [-.75, 1.84, 3.0]]},               // coffee bar pendants
  {l:new THREE.PointLight(LAMPC, 5, 5, 2),  p:[-2.4, 2.5, -2.1], k:5, halo:[[-3.4,2.77,-2.5],[-1.5,2.77,-2.5],[-3.4,2.77,-1.6],[-1.5,2.77,-1.6]]}   // charging bay downlights
];
if (!PHONE) LAMPS.push({l:new THREE.PointLight(LAMPC, 6, 5, 2), p:[-4.25 + FL.up.ox, FL.up.oy + 1.45, 1.95 + FL.up.oz], k:6, halo:[[-4.25 + FL.up.ox, FL.up.oy + 1.52, 1.95 + FL.up.oz]]});   // Research corner
// bloom without a composer: an additive sprite halo on every lamp fixture (ART 6.4)
const halos = [];
for (const L of LAMPS){ L.l.position.set(...L.p); scene.add(L.l);
  for (const h of L.halo){ const sp = new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex, color:0xffd9ae, transparent:true, opacity:.35, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false}));
    sp.scale.setScalar(L.k > 9 ? .7 : .5); sp.renderOrder = 8;
    if (h[1] > 2.95){ sp.position.set(h[0] - FL.up.ox, h[1] - FL.up.oy, h[2] - FL.up.oz); gUp.add(sp); } else { sp.position.set(...h); scene.add(sp); } halos.push(sp); } }
// the call pool (signature 1): one SpotLight made now at 0, so it never recompiles shaders
const pool = new THREE.SpotLight(LAMPC, 0, 7, .38, .7, 1.6); pool.position.set(0, 3.2, 0); scene.add(pool); scene.add(pool.target);
const call = {k:0, id:null, x:0, z:0};
// the pool on the floor: a soft warm decal under the SpotLight, so the pool reads on the dark polished stone too
const poolDecal = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({map:glowTex, color:0xffc38a, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false}));
poolDecal.rotation.x = -Math.PI/2; poolDecal.scale.setScalar(2.4); poolDecal.renderOrder = 2; poolDecal.visible = false; scene.add(poolDecal);

/* ================= camera: orthographic 3/4, both floors; glides between views; drag to turn ================= */
const cam = new THREE.OrthographicCamera(-5, 5, 5, -5, .1, 140);
const TARGET = new THREE.Vector3(-1.9, 1.9, -2.2);
const AZ0 = Math.PI/4 - .06;
let LIFT = 0;
const view = {el:.6, drag:0, rect:null, want:{l:-5, r:5, t:5, b:-5}, mode:'', horizon:null};
function aim(az){ const d = 50; cam.position.set(TARGET.x + Math.sin(az)*Math.cos(view.el)*d, TARGET.y + Math.sin(view.el)*d, TARGET.z + Math.cos(az)*Math.cos(view.el)*d); cam.up.set(0,1,0); cam.lookAt(TARGET); cam.updateMatrixWorld(); cam.matrixWorldInverse.copy(cam.matrixWorld).invert(); }
function floorBox(f, withWalls){ const F = FL[f], out = [];
  for (const x of [-FX, FX]) for (const z of [-FZ, FZ]) out.push(new THREE.Vector3(x + F.ox, F.oy - (f === 'down' ? .5 : .35), z + F.oz));
  if (withWalls) for (const [x,z] of [[-FX,-FZ],[-FX,FZ],[FX,-FZ]]) out.push(new THREE.Vector3(x + F.ox, F.oy + F.wall + .1, z + F.oz));
  return out; }
const BOXES = {all:[...floorBox('down', false), ...floorBox('up', true), new THREE.Vector3(TUBE.x, TUBE.top + .2, TUBE.z)], up:floorBox('up', true), down:[...floorBox('down', true), new THREE.Vector3(TUBE.x, 3.1, TUBE.z)]};
let W = 1, H = 1;
function area(){
  if (CAPTURE) return {x0:20, y0:20, x1:W-20, y1:H-20};
  const A = HUB.area;                                           // CONTRACT v2: the page says where the room goes
  if (A && isFinite(A.x0) && isFinite(A.y1) && A.x1 - A.x0 > 60 && A.y1 - A.y0 > 60) return A;
  if (HUB.wide){ const pw = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--panel-w')) || 344; return {x0:30, y0:128, x1:W - pw - 60, y1:H - 64}; }
  return {x0:-12, y0:46, x1:W + 12, y1:H - 50};
}
const VC = new THREE.Vector3();
function fitRect(points, maxScale){
  let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
  for (const p of points){ VC.copy(p).applyMatrix4(cam.matrixWorldInverse); mnx = Math.min(mnx, VC.x); mxx = Math.max(mxx, VC.x); mny = Math.min(mny, VC.y); mxy = Math.max(mxy, VC.y); }
  const A = area(), aw = A.x1 - A.x0, ah = A.y1 - A.y0;
  const s = Math.min(aw/(mxx-mnx), ah/(mxy-mny), maxScale || 1e9);
  const cx = (mnx + mxx)/2, cy = (mny + mxy)/2, ax = (A.x0 + A.x1)/2, ay = (A.y0 + A.y1)/2;
  const l = cx - ax/s, t = cy + ay/s; return {l, r:l + W/s, t, b:t - H/s};
}
/* the view registry (BUILD S1): every cam id the page may ask for; unbuilt ids render as their fallback */
const VIEWS = {
  all:{built:true}, up:{built:true}, down:{built:true}, follow:{built:true, sel:true}, ride:{built:true, sel:true, as:'follow'},
  blueprint:{built:false}, cctv:{built:false}, window:{built:false}, tilt:{built:false}, tour:{built:false}, director:{built:false},
  eyes:{built:false, sel:true, fallback:'follow'}
};
const builtViews = () => Object.keys(VIEWS).filter(k => VIEWS[k].built && k !== 'ride');
function camMode(){
  let m = HUB.cam, v = VIEWS[m];
  if (!v) m = 'all'; else if (!v.built) m = v.fallback || 'all'; else if (v.as) m = v.as;
  if (VIEWS[m].sel){ const id = HUB.selected, sim = id && sims[id]; if (!sim || sim.hidden) return 'all'; }
  return m;
}
function wantRect(mode){
  if (mode === 'follow'){ const sim = sims[HUB.selected]; const c = new THREE.Vector3(sim.x, sim.y + .7, sim.z);
    const pts = [c.clone().add(new THREE.Vector3(-2.6, -.7, -2.6)), c.clone().add(new THREE.Vector3(2.6, -.7, 2.6)), c.clone().add(new THREE.Vector3(-2.6, 1.3, 2.6)), c.clone().add(new THREE.Vector3(2.6, 1.3, -2.6))];
    return fitRect(pts, 120); }
  return fitRect(BOXES[mode] || BOXES.all);
}
function applyRect(r){ cam.left = r.l; cam.right = r.r; cam.top = r.t; cam.bottom = r.b; cam.updateProjectionMatrix(); }
const HZ = {down:new THREE.Vector3(2.5, 1.25, -FZ), up:new THREE.Vector3(FL.up.ox, FL.up.oy + 1.1, -FZ + FL.up.oz), all:new THREE.Vector3(2.5, 1.25, -FZ)};
/* discrete changes (view, floor, selection, the room's area) glide 750 ms easeInOutCubic; Follow then tracks, damped
 * (k = 5); drag and drift apply at once; reduced motion and capture cut */
const tw = {key:null, from:null, t:1};
const RK = ['l','r','t','b'];
function updateCamera(dt, snap){
  const mode = camMode(), want = wantRect(mode), A = area();
  const key = mode + '|' + (mode === 'follow' ? HUB.selected : '') + '|' + Math.round(A.x0) + ',' + Math.round(A.y0) + ',' + Math.round(A.x1) + ',' + Math.round(A.y1);
  const cut = !view.rect || snap || RM.matches || CAPTURE;
  if (key !== tw.key){ if (!cut){ tw.from = Object.assign({}, view.rect); tw.t = 0; } else tw.t = 1; tw.key = key; }
  if (cut){ view.rect = Object.assign({}, want); tw.t = 1; }
  else if (tw.t < 1){ tw.t = Math.min(1, tw.t + dt/.75); const e = ease(tw.t); for (const k of RK) view.rect[k] = tw.from[k] + (want[k] - tw.from[k])*e; }
  else if (mode === 'follow'){ const k = 1 - Math.exp(-dt*5); for (const q of RK) view.rect[q] += (want[q] - view.rect[q])*k; }
  else view.rect = Object.assign({}, want);
  view.mode = mode; applyRect(view.rect);
  // Downstairs view: the upper floor lifts away (and hides) so nothing covers the lower floor
  const lw = mode === 'down' ? 1 : 0; view.lift = view.lift == null || snap || RM.matches || CAPTURE ? lw : view.lift + (lw - view.lift)*Math.min(1, dt*4.5);
  if (Math.abs(view.lift - lw) < .002) view.lift = lw;
  LIFT = view.lift*view.lift*(3 - 2*view.lift)*8; gUp.position.y = FL.up.oy + LIFT; gUp.visible = view.lift < .85;
  if (skyEl){ const f = mode === 'follow' ? sims[HUB.selected].floor : mode; const hz = VC.copy(HZ[f] || HZ.all).project(cam); const pct = (1 - hz.y)/2*100;
    view.horizon = view.horizon == null || RM.matches ? pct : view.horizon + (pct - view.horizon)*Math.min(1, dt*3.2);
    const s = Math.max(8, Math.min(92, view.horizon)).toFixed(1) + '%'; if (s !== view.hs){ view.hs = s; skyEl.style.setProperty('--horizon', s); } }
}
function resize(){ W = stage.clientWidth || 1; H = stage.clientHeight || 1; renderer.setSize(W, H, false); aim(AZ0 + view.drag); updateCamera(0, true); }
// drag to turn the building a little (a tap still selects: the page ignores taps right after a drag)
let dragStart = null; const SC = {dragged:false};
const NODRAG = '.bub,button,a,input,textarea,select,[data-nodrag]';
stage.addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest(NODRAG)) return; dragStart = {x:e.clientX, y:e.clientY, az:view.drag}; SC.dragged = false; });
window.addEventListener('pointermove', e => { if (!dragStart) return; const dx = e.clientX - dragStart.x; if (Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(e.clientY - dragStart.y)) SC.dragged = true;
  if (SC.dragged){ view.drag = Math.max(-.55, Math.min(.55, dragStart.az - dx*0.004)); view.lastDrag = performance.now(); } });
window.addEventListener('pointerup', () => { dragStart = null; setTimeout(() => SC.dragged = false, 0); });
window.addEventListener('pointercancel', () => { dragStart = null; });

/* ================= per frame ================= */
const V = new THREE.Vector3(), anchors = {};
const HOVER = {glide:.24, settle:.22, lounge:.2, type:.36, read:.34, radar:.3, meet:.24, wait:.5, blocked:.34, cheer:.36, coffee:.3, sleep:.035, ride:.14};
const lerp = (a,b,t) => a + (b-a)*t;
const DIM = new THREE.Color(0x8a6f4a), EYE = new THREE.Color(0xfff2e0), EYE_DIM = new THREE.Color(0x3a3f55), EYE_RED = new THREE.Color(0xffc7bd), GOLD = new THREE.Color(0xead1a0), SLEEPC = new THREE.Color(0x8e95ab), CHAMP = new THREE.Color(0xf1c48a), BRASSC = new THREE.Color(0xc9a45c);
const cTmp = new THREE.Color();
const HAND_PROP_POSES = new Set(['glide','settle','lounge','wait','meet','ride','idle']);
function animRobot(a, sim, R, t, dt){
  const rm = RM.matches, pose = sim.pose, pt = sim.poseT, ph = sim.phase;
  if (pose !== R.lastPose){ R.lastPose = pose; if (pose === 'cheer' && !rm) burst(sim.x, sim.y + 1.35, sim.z); }
  const up = sim.floor === 'up' && !sim.ride ? LIFT : 0;
  R.root.position.set(sim.x, sim.y + up, sim.z); R.root.visible = !sim.hidden && !(up && !gUp.visible);
  let spin = 0; if (pose === 'cheer' && !rm){ const k = Math.min(1, pt/1.1); spin = (1 - Math.pow(1-k, 3)) * Math.PI*2; }
  R.root.rotation.y = sim.yawDraw + spin;
  const seat = sim.spot && sim.spot.seat && !sim.moving ? .2 : 0;
  R.h = lerp(R.h, (HOVER[pose] ?? .22) + seat, Math.min(1, dt*(pose === 'ride' ? 10 : 3)));
  const breath = rm ? 0 : Math.sin(t*1.7 + ph);
  const bob = breath * (pose === 'sleep' ? .008 : .02);
  const jump = (pose === 'cheer' && !rm) ? Math.abs(Math.sin(pt*5.2)) * .2 * Math.max(0, 1 - pt/2.2) : 0;
  R.hov.position.y = R.h + bob + jump;
  const wob = rm ? 0 : sim.wobble*sim.wobble;
  R.hov.rotation.z = sim.bank + Math.sin(t*19 + ph)*.2*wob; R.hov.rotation.x = sim.pitch + Math.cos(t*15 + ph)*.12*wob;
  // head
  let hp = 0, hy = 0, hr = 0;
  if (pose === 'read') hp = .26; else if (pose === 'radar') hp = .38; else if (pose === 'sleep') hp = .42; else if (pose === 'type') hp = .1 + (rm?0:Math.sin(t*2.1+ph)*.03);
  else if (pose === 'blocked'){ hp = .2; hr = rm ? .1 : Math.sin(t*.9+ph)*.1; } else if (pose === 'wait') hp = -.12;
  else if (pose === 'lounge' || pose === 'settle'){ hy = rm ? 0 : Math.sin(t*.35 + ph)*.45; hp = rm ? 0 : Math.sin(t*.23+ph)*.06; }
  else if (pose === 'meet') hp = rm ? 0 : Math.max(0, Math.sin(t*1.4+ph))*.12;
  else if (pose === 'ride') hp = sim.ride && sim.ride.kind === 'tube' ? -.2 : -.1;
  R.head.rotation.x = lerp(R.head.rotation.x, hp, Math.min(1, dt*4)); R.head.rotation.y = lerp(R.head.rotation.y, hy, Math.min(1, dt*3)); R.head.rotation.z = lerp(R.head.rotation.z, hr, Math.min(1, dt*4));
  if (R.crown) R.crown.rotation.y = rm ? 0 : t*.35;
  const closed = pose === 'sleep' ? .22 : (sim.blinkT > 0 && !rm ? .12 : 1);
  for (const e of R.eyes) e.scale.y = lerp(e.scale.y, .6*closed, Math.min(1, dt*22));
  R.eyeMat.color.lerp(pose === 'sleep' ? EYE_DIM : pose === 'blocked' ? EYE_RED : EYE, Math.min(1, dt*4));
  // the light strip (ART 6.6): working champagne + chase dot, idle champagne toward ceramic, waiting ember on the shared
  // 5 s breath, stuck oxide steady, asleep off with a brass pilot dot. Colors come from HUB.theme; never multiplyScalar.
  const st = a.st, brand = TH.mode === "brand", br = breathK();
  let col = TH.idle, hop = .1, gop = .06;
  if (pose === 'sleep'){ col = TH.sleep; hop = 0; gop = 0; }
  else if (st === 'waiting'){ col = TH.need; hop = rm ? .6 : .3 + .6*br; gop = rm ? .45 : .2 + .5*br; }
  else if (st === 'blocked'){ col = TH.stuck; hop = .24; gop = .14; }
  else if (st === 'working' || pose === 'cheer' || pose === 'ride'){ col = TH.work; hop = .3; gop = .16; }
  if (a.silent && st !== 'waiting'){ col = TH.silent; hop = .04; gop = 0; }
  if (brand && pose !== 'sleep') col = TH.need;
  const ck = rm ? 1 : Math.min(1, dt*8);
  R.stripMat.color.lerp(col, ck); R.haloMat.color.lerp(col, ck); R.glow.material.color.lerp(col, ck);
  R.haloMat.opacity = lerp(R.haloMat.opacity, hop, st === 'waiting' ? 1 : Math.min(1, dt*6));
  R.glow.material.opacity = lerp(R.glow.material.opacity, gop, st === 'waiting' ? 1 : Math.min(1, dt*5));
  const zone = R.zone || 1;
  const chasing = st === 'working' && (pose === 'type' || pose === 'read' || pose === 'radar' || pose === 'meet' || pose === 'glide' || pose === 'ride') && !rm && !a.silent;
  R.chase.visible = chasing; if (chasing){ const ang = t*(pose === 'ride' ? 9 : 3.2*zone) + ph; R.chase.position.set(Math.cos(ang)*.218, .25, Math.sin(ang)*.218); }
  const asleep = pose === 'sleep'; R.pilot.visible = asleep;
  if (asleep) R.pilot.material.opacity = rm ? .8 : .45 + .5*(.5 - .5*Math.cos(2*Math.PI*t/6 + ph));
  // hands
  const L0 = R.hl[0], R0 = R.hl[1];
  if (pose === 'type'){ L0.set(-.12, .5 + (rm?0:Math.max(0,Math.sin(t*15+ph))*.025), .3); R0.set(.12, .5 + (rm?0:Math.max(0,Math.sin(t*15+ph+Math.PI))*.025), .3); }
  else if (pose === 'read' || pose === 'radar'){ L0.set(-.12, .55, .25); R0.set(.12, .55 + (rm?0:Math.max(0,Math.sin(t*.7+ph)-.9)*.3), .27); }
  else if (pose === 'wait'){ L0.set(-.27, .33, .06); R0.set(.3, .8 + (rm?0:Math.sin(t*6)*.04), .1 + (rm?0:Math.sin(t*6)*.05)); }
  else if (pose === 'blocked'){ L0.set(-.25, .86, .06); R0.set(.25, .86, .06); }
  else if (pose === 'cheer'){ L0.set(-.27, 1.02, 0); R0.set(.27, 1.02, 0); }
  else if (pose === 'ride'){ if (sim.ride && sim.ride.kind === 'tube'){ L0.set(-.25, .28, .02); R0.set(.25, .28, .02); } else { L0.set(-.3, .95, .06); R0.set(.3, .95, .06); } }
  else if (pose === 'coffee'){ const sip = rm ? 0 : Math.max(0, Math.sin(t*.9 + ph)); L0.set(-.27, .32, .06); R0.set(.1, .48 + sip*.24, .25); }
  else if (pose === 'sleep'){ L0.set(-.26, .2, .05); R0.set(.26, .2, .05); }
  else if (pose === 'meet'){ L0.set(-.27, .33, .06); R0.set(.19, .5 + (rm?0:Math.max(0,Math.sin(t*1.1+ph))*.08), .22); }
  else { const sw = rm ? 0 : Math.sin(t*1.7 + ph)*.02; L0.set(-.28, .32 + sw, .05); R0.set(.28, .32 - sw, .05); }
  const hk = Math.min(1, dt*(pose === 'type' ? 18 : 7));
  R.hands[0].position.lerp(L0, hk); R.hands[1].position.lerp(R0, hk);
  // props
  const reading = pose === 'read' && !R.prop || pose === 'meet' && a.id === 'code';
  R.tablet.visible = reading; if (reading){ R.tablet.position.set(0, R.hands[0].position.y + .02, .3); R.tablet.rotation.set(.9, 0, 0); }
  if (R.prop){ const show = HAND_PROP_POSES.has(pose) || pose === 'read' || pose === 'radar'; R.prop.visible = show;
    if (pose === 'read' || pose === 'radar'){ R.prop.position.set(.1, .08, .06); R.prop.rotation.set(-.9, 0, 0); } else if (show){ R.prop.position.set(0, .06, .03); R.prop.rotation.set(-.15, 0, a.def && a.def.outfit === 'newsboy' ? .25 : 0); } }
  R.cup.visible = pose === 'coffee'; if (R.cup.visible) R.cup.position.copy(R.hands[1].position).add(V.set(0,.06,.02));
  R.steam.forEach((s,i) => { const on = pose === 'coffee' && !rm; s.visible = on; if (!on) return; const k = ((t*.6 + i/3) % 1); s.material.opacity = Math.sin(k*Math.PI)*.35;
    s.position.set(R.cup.position.x + Math.sin(k*6+i)*.02, R.cup.position.y + .06 + k*.22, R.cup.position.z); s.scale.setScalar(.05 + k*.06); });
  // floor: contact shadow + state ring (hidden while riding: the floor is far below)
  const hh = R.hov.position.y, riding = pose === 'ride';
  R.shadow.visible = !riding || !sim.ride || sim.ride.kind === 'slide' && false; R.shadow.scale.setScalar(.95 - hh*.45); R.shadow.material.opacity = Math.max(.15, .62 - hh*.55);
  let rc = null, rop = 0, rs = 1;
  if (pose === 'wait'){ rc = TH.need; const k = rm ? .5 : (t*.2) % 1; rs = 1 + k*.9; rop = (1-k)*.7; }
  else if (pose === 'blocked'){ rc = TH.stuck; rop = .35; }
  else if (pose === 'cheer'){ rc = GOLD; const k = Math.min(1, pt/1.2); rs = 1 + k*1.6; rop = (1-k)*.9; }
  else if (HUB.selected === a.id && !riding){ rc = EYE; rop = .35; }
  if (rc) R.ring.material.color.copy(rc); R.ring.material.opacity = lerp(R.ring.material.opacity, riding ? 0 : rop, Math.min(1, dt*10)); R.ring.scale.setScalar(rs);
  const sel = HUB.selected === a.id && pose !== 'wait' && pose !== 'blocked' && !riding;
  R.ring2.material.color.copy(pose === 'wait' ? TH.need : EYE); R.ring2.material.opacity = lerp(R.ring2.material.opacity, sel ? .5 : (pose === 'wait' ? .55 : 0), Math.min(1, dt*8));
  R.ring2.scale.setScalar(pose === 'wait' ? 1.05 : 1.15);
  R.ring.visible = R.ring.material.opacity > .01; R.ring2.visible = R.ring2.material.opacity > .01;
  // overlay anchor: top of the head + the floor under the robot
  V.set(sim.x, sim.y + up + hh + 1.2 + R.hat, sim.z).project(cam); const ax = (V.x+1)/2*W, ay = (1-V.y)/2*H;
  V.set(sim.x, sim.y + up, sim.z).project(cam); const fx = (V.x+1)/2*W, fy = (1-V.y)/2*H;
  const on = !(up > .3) && ax > -20 && ax < W + 20 && ay > -40 && fy < H + 20;
  const an = anchors[a.id] || (anchors[a.id] = {});
  an.x = ax; an.y = ay; an.fx = fx; an.fy = fy; an.pose = pose; an.moving = !!sim.moving; an.visible = on; an.floor = sim.floor;
}

/* sky -> lights. Four keyed states by sun altitude (ART section 3): night, blue hour, golden, day; lerped in between.
 * The room's lamps never recolor with the hour (Turrell rule); storm dims the sky light and the lamps stay warm. */
const PAL = [
  // alt, key color, key int, key elevation deg, hemi sky, hemi ground, hemi int, rim int, lamp x, env int, exposure
  {alt:-14, key:0x9fb0d8, ki:.25, el:45, hs:0x1e2640, hg:0x120c08, hi:.3, ri:.22, lx:1.1, env:.4, exp:1.05},
  {alt:-9,  key:0xff9a5c, ki:.5,  el:8,  hs:0x3a4468, hg:0x3a2a1f, hi:.5, ri:.3,  lx:1,   env:.45, exp:1.0},
  {alt:1.5, key:0xffb46b, ki:1.5, el:20, hs:0x4a5680, hg:0x3a2a1f, hi:.6, ri:.25, lx:1,   env:.5, exp:1.0},
  {alt:16,  key:0xfff0da, ki:1.6, el:50, hs:0xb8c4d6, hg:0x4d3d2e, hi:.75, ri:.12, lx:.3,  env:.6, exp:1.0}
].map(k => Object.assign(k, {kc:new THREE.Color(k.key), hsc:new THREE.Color(k.hs), hgc:new THREE.Color(k.hg)}));
const STORMB = new THREE.Color(0x9fb2d8), AFTER = new THREE.Color(0xffb877), LAMPCC = new THREE.Color(LAMPC);
const shadowSun = {el:null, t:0}, light = {lamps:1, dim:1};
function lightFromSky(dt){
  const s = HUB.sky && HUB.sky.state, alt = s ? s.alt : -9, storm = s ? s.storm || 0 : 0, flash = s ? s.flash || 0 : 0;
  let i = 0; while (i < PAL.length - 2 && alt > PAL[i+1].alt) i++;
  const A = PAL[i], B = PAL[i+1], k = Math.max(0, Math.min(1, (alt - A.alt)/(B.alt - A.alt))), L = (p) => A[p] + (B[p] - A[p])*k;
  sun.color.copy(A.kc).lerp(B.kc, k).lerp(STORMB, storm*.8);
  sun.intensity = L('ki')*(1 - storm*.75) + flash*2.2;
  const el = Math.max(8, L('el'))*Math.PI/180, az = -2.6;                    // from the back-left, through the back glass
  sun.position.set(-1.5 + Math.sin(az)*Math.cos(el)*24, 1 + Math.sin(el)*24, -2 + Math.cos(az)*Math.cos(el)*24); sun.target.position.set(-1.5, 1, -2);
  if (!renderer.shadowMap.autoUpdate){ shadowSun.t += dt; if (shadowSun.el == null || Math.abs(shadowSun.el - el) > .01 || shadowSun.t > 6){ shadowSun.el = el; shadowSun.t = 0; renderer.shadowMap.needsUpdate = true; } }
  hemi.color.copy(A.hsc).lerp(B.hsc, k); hemi.groundColor.copy(A.hgc).lerp(B.hgc, k);
  hemi.intensity = L('hi')*(1 - storm*.3) + flash*1.2;
  rim.intensity = L('ri');
  const after = !!HUB.afterHours;
  light.lamps = (L('lx') + storm*.3)*(after ? 1.2 : 1);
  // the call pool: lamps ease to .88x while someone waits (1.2 s), the SpotLight rises to 18 above the first in line
  light.dim = 1 - .12*call.k;
  for (const Lp of LAMPS){ Lp.l.intensity = Lp.k*light.lamps*light.dim; Lp.l.color.copy(LAMPCC).lerp(AFTER, after ? 1 : 0); }
  const hk = Math.min(1, light.lamps)*light.dim; for (const h of halos) h.material.opacity = .35*hk;
  MAT.opal.emissiveIntensity = .5 + 1.3*Math.min(1.2, light.lamps);
  scene.environmentIntensity = L('env')*(1 - storm*.2);
  renderer.toneMappingExposure = L('exp');
  return light.lamps;
}

let onScreen = true;
try { new IntersectionObserver(es => { onScreen = es[0].isIntersecting; }).observe(stage); } catch(e){}
const perf = {acc:0, n:0};
const seen = {board:null, trophies:null, lang:null};
let lastT = 0;
const agentsArr = () => HUB.agents || [];
function frame(t, dt){
  dt = Math.max(0, Math.min(.1, dt || 0)); lastT = t;
  const agents = agentsArr();
  // build new robots lazily; hide hidden ones
  agents.forEach((a, i) => { const sim = syncAgent(a, i); if (!robots[a.id]) makeRobot(a); robots[a.id].root.visible = !sim.hidden; if (sim.hidden && anchors[a.id]) anchors[a.id].visible = false; });
  for (const a of agents){ const sim = sims[a.id]; if (!sim.hidden) stepSim(sim, a, dt); }
  // handoffs: shift the page's queue, fly a folder for each
  const hq = HUB.handoffs; if (Array.isArray(hq)) while (hq.length){ const h = hq.shift(); const A = h && sims[h.from], B = h && sims[h.to];
    if (A && B && !A.hidden && !B.hidden && h.from !== h.to && flights.length < 6 && !RM.matches) spawnFolder(A, B); }
  if (!onScreen && !CAPTURE) return;
  const now = performance.now();
  const drift = RM.matches || CAPTURE ? 0 : Math.sin(t*.05)*.04;
  if (!dragStart && view.lastDrag && now - view.lastDrag > 5000) view.drag *= Math.pow(.2, dt);
  const az = AZ0 + drift + view.drag;
  if (view.azNow == null || Math.abs(az - view.azNow) > 1e-5){ view.azNow = az; aim(az); }
  updateCamera(dt, false);
  if (readTheme()) redraw(boardT);
  // The Call (ART 8.4): the pool rises over the first in line (HUB.needs.ids[0], else the first waiting robot) in 1.2 s
  const nIds = HUB.needs && Array.isArray(HUB.needs.ids) ? HUB.needs.ids : null;
  let first = nIds ? nIds.find(id => sims[id] && !sims[id].hidden && HUB.byId && HUB.byId[id]) : null;
  if (!nIds){ const w = agents.find(a => a.st === 'waiting' && sims[a.id] && !sims[a.id].hidden); first = w ? w.id : null; }
  if (first) call.id = first;
  call.k = RM.matches ? (first ? 1 : 0) : Math.max(0, Math.min(1, call.k + (first ? dt : -dt)/1.2));
  const cs = call.id && sims[call.id];
  if (cs){ const up = cs.floor === 'up' && !cs.ride ? LIFT : 0; pool.position.set(cs.x, cs.y + up + 3.2, cs.z + .15); pool.target.position.set(cs.x, cs.y + up, cs.z); pool.target.updateMatrixWorld(); }
  const pk = ease(call.k)*(cs && !(cs.floor === 'up' && !gUp.visible) ? 1 : 0);
  pool.intensity = 18*2.5*pk;          // ART's 18, scaled for r169's physical units
  poolDecal.visible = pk > .01; if (cs){ poolDecal.position.set(cs.x, cs.y + (cs.floor === 'up' && !cs.ride ? LIFT : 0) + .012, cs.z); poolDecal.material.opacity = .22*pk; }
  const lamps = lightFromSky(dt);
  // board + trophies redraw when their data or the language changes
  const lang = HUB.lang; const bv = HUB.boardInfo && HUB.boardInfo.v, tv = HUB.trophies && HUB.trophies.v;
  if (bv !== seen.board || lang !== seen.lang){ seen.board = bv; redraw(boardT); }
  if (tv !== seen.trophies || lang !== seen.lang){ seen.trophies = tv; redraw(trophyT); }
  seen.lang = lang;
  const rm = RM.matches;
  for (const a of agents){ const sim = sims[a.id]; if (!sim.hidden) animRobot(a, sim, robots[a.id], t, dt); }
  // station screens wake when their robot works there
  for (const [id, sc] of Object.entries(screens)){
    let sim = sims[id], here = sim && !sim.hidden && sim.spot && sim.spot === DESK[id];
    if (id[0] === '~'){ sim = Object.values(sims).find(s => s.spot && s.spot.hot === id); here = !!sim; }
    const on = here && (sim.pose === 'type' || sim.pose === 'read' || sim.pose === 'radar') ? .95 : here && sim.pose === 'blocked' ? .5 : .16;
    sc.on = lerp(sc.on, on, Math.min(1, dt*3)); sc.m.material.opacity = sc.on;
    sc.m.material.color.setHex(here && sim.pose === 'blocked' ? 0xff6b5f : 0xffffff);
    if (here && sim.pose === 'type' && !rm) sc.t.offset.y = (sc.t.offset.y + dt*.06) % 1;
  }
  // Cowork's wall map brightens while Cowork is up
  const cw = sims['cowork']; wallMap.m.material.opacity = lerp(wallMap.m.material.opacity, cw && !cw.hidden && cw.pose !== 'sleep' ? .75 : .3, Math.min(1, dt*2));
  // radar: sweeps while Storm Watch is awake, blips once it finds hail
  const sw = sims['storm-watch'], swa = HUB.byId && HUB.byId['storm-watch'], awake = !!(sw && !sw.hidden && swa && swa.st !== 'sleeping');
  radar.sweep.material.opacity = lerp(radar.sweep.material.opacity, awake ? .9 : 0, Math.min(1, dt*2));
  radar.disc.material.opacity = lerp(radar.disc.material.opacity, awake ? .75 : .22, Math.min(1, dt*2));
  if (!rm && awake) radar.sweep.rotation.z -= dt*1.6;
  const hail = (HUB.sky && HUB.sky.state && HUB.sky.state.storm > .15) || (swa && swa.st === 'done');
  radar.blips.forEach((b,i) => { b.material.opacity = lerp(b.material.opacity, hail ? .6 + Math.sin(t*3+i)*.35 : 0, Math.min(1, dt*3)); });
  // "your spot" glows when someone is waiting on you
  const waiting = agents.some(a => sims[a.id] && sims[a.id].pose === 'wait' && !sims[a.id].hidden);
  spot.glow.material.opacity = lerp(spot.glow.material.opacity, waiting ? .6 + (rm ? 0 : Math.sin(t*4)*.25) : .16, Math.min(1, dt*4));
  spot.fill.material.opacity = lerp(spot.fill.material.opacity, waiting ? .07 + (rm ? 0 : Math.sin(t*4)*.03) : 0, Math.min(1, dt*4));
  // charging pods: blue breathing glow when a robot sleeps in one
  podGlow.forEach((pg, i) => { const occ = Object.values(sims).some(s => !s.hidden && s.spot === POOL.pod[i] && s.pose === 'sleep');
    pg.glow.material.color.copy(occ ? SLEEPC : BRASSC); pg.glow.material.opacity = lerp(pg.glow.material.opacity, occ ? .45 + (rm ? 0 : Math.sin(t*.9 + i)*.2) : .12 + lamps*.06, Math.min(1, dt*3));
    pg.strip.material.color.copy(occ ? SLEEPC : DIM); });
  // the slide: light streak chasing each rider; the tube: the suction ring
  let sl = null, tb = null; for (const s of Object.values(sims)){ if (s.ride && s.ride.kind === 'slide') sl = s; if (s.ride && s.ride.kind === 'tube') tb = s; }
  slide.stripMat.color.lerp(sl ? CHAMP : DIM, Math.min(1, dt*6));
  slide.streak.forEach((sp, i) => { const on = !!sl && !rm && sl.ride.s > .08; sp.visible = on; if (!on) return;
    const q = (sl.ride.s - .08)/.92, s0 = q*q*.4 + q*.6, s = Math.max(0, s0 - i*.018), th = SLIDE.th0 - s*SLIDE.turns*2*Math.PI; slidePt(s, V1);
    sp.position.set(V1.x + Math.cos(th)*(SLIDE.tr*Math.sin(1.85) + .025), V1.y + SLIDE.tr*(1 - Math.cos(1.85)) - .1, V1.z + Math.sin(th)*(SLIDE.tr*Math.sin(1.85) + .025)); sp.material.opacity = .85*(1 - i/12); });
  tube.ring.visible = !!tb && !rm; if (tb){ tube.ring.position.y = Math.min(TUBE.top - .1, tb.y + .3); tube.ring.material.opacity = .9*(1 - tb.ride.s*.6); }
  tube.capMat.color.copy(tb ? GOLD : DIM); tube.base.material.opacity = lerp(tube.base.material.opacity, tb ? .9 : .3, Math.min(1, dt*5));
  // handoff folders
  for (let i = flights.length - 1; i >= 0; i--){ const f = flights[i]; headPos(f.from, V1); headPos(f.to, V2);
    const d = V1.distanceTo(V2), dur = Math.min(2.8, 1.2 + d*.1); f.t += dt; const k = Math.min(1, f.t/dur), e = ease(k);
    f.g.position.lerpVectors(V1, V2, e); f.g.position.y += Math.sin(k*Math.PI)*(.8 + d*.12); f.g.rotation.set(Math.sin(t*3)*.2, t*2.2, 0);
    f.glow.material.opacity = .8*Math.sin(Math.min(1, k*1.2)*Math.PI*.5 + .3);
    if (k >= 1){ scene.remove(f.g); f.g.traverse(o => { if (o.isMesh) o.geometry.dispose(); if (o.material && o.isSprite) o.material.dispose(); }); flights.splice(i,1); burstSmall(V2); } }
  // bursts
  for (let i = bursts.length - 1; i >= 0; i--){ const b = bursts[i]; b.t += dt; const arr = b.p.geometry.attributes.position.array;
    for (let k=0;k<b.vel.length;k++){ const v = b.vel[k]; v[1] -= 3.2*dt; arr[k*3] += v[0]*dt; arr[k*3+1] += v[1]*dt; arr[k*3+2] += v[2]*dt; }
    b.p.geometry.attributes.position.needsUpdate = true; b.p.material.opacity = Math.max(0, 1 - b.t/(b.life || 1.5));
    if (b.t > (b.life || 1.5)){ scene.remove(b.p); b.p.geometry.dispose(); b.p.material.dispose(); bursts.splice(i,1); } }
  renderer.render(scene, cam);
  // keep phones smooth: drop resolution if frames run long
  perf.acc += dt; perf.n++; if (perf.acc > 2){ const avg = perf.acc/perf.n; if (avg > .026 && DPR > 1){ DPR = Math.max(1, DPR - .25); renderer.setPixelRatio(DPR); resize(); } perf.acc = 0; perf.n = 0; }
}
function burstSmall(p){ burst(p.x, p.y, p.z); const b = bursts[bursts.length-1]; b.life = .8; for (const v of b.vel){ v[0] *= .5; v[1] *= .45; v[2] *= .5; } }

if (document.fonts){ const again = () => { redraw(boardT); redraw(trophyT); }; document.fonts.ready.then(again); try { document.fonts.addEventListener('loadingdone', again); } catch(e){} }

function pick(x, y){ let best = null, bd = 34;
  for (const a of agentsArr()){ const an = anchors[a.id]; if (!an || !an.visible) continue; const cy = (an.y + an.fy)/2, d = Math.hypot(x - an.x, (y - cy)*0.7); if (d < bd){ bd = d; best = a.id; } }
  return best; }
/* test helper (not part of the contract): finish every walk, ride and timed pose right now */
function settle(){ for (const a of agentsArr()){ const sim = sims[a.id]; if (!sim || sim.hidden) continue;
  for (let i = 0; i < 10 && (sim.moving || sim.queue.length); i++){ if (sim.moving){ place(sim, sim.target); if (sim.pending){ sim.pending = false; applyState(sim, a, false); } } stepQueue(sim, a); if (sim.queue[0] && sim.queue[0].dur){ sim.poseT = sim.queue[0].dur*.4; break; } } } }

window.SCENE = {ready:true, anchors, frame, resize, pick, settle, get dragged(){ return SC.dragged; }, get info(){ return renderer.info.render; },
  get views(){ return builtViews(); }, get tweening(){ return tw.t < 1; }};
resize();
HUB.layout && HUB.layout();

if (CAPTURE){
  // render a still for the no-WebGL fallback (transparent background; the page's CSS sky shows through)
  setTimeout(() => { const out = document.createElement('textarea'); out.id = 'cap'; renderer.render(scene, cam); out.value = canvas.toDataURL('image/webp', .8); document.body.append(out); }, 7000);
}
