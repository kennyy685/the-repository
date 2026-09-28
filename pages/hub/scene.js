/* hub/scene.js: the Crew HQ 3D world (board T190). three.js r169, everything drawn in code.
 * Two floors, split-level, by kind of work (v28, blueprint 5): upstairs = Intelligence (the experiment table, the QA bench,
 * Storm Watch's radar by the glass, the board, the reading chair); downstairs = Execution (the dispatch table for the King +
 * the Right Hand, the build bench, the design studio, the comms corner, coffee bar, lounge, "your spot", trophy wall, pods).
 * Down = a spiral slide, up = a glass suction tube.
 * Interface with the page: docs/design/hub-office/CONTRACT.md (window.HUB in, window.SCENE out).
 * The page only sets st / spot / seq / instant on each agent; where a robot goes and how it gets there lives here.
 * DOM: draws into #gl inside #stage (created if missing) and sets --horizon on #sky when present. */
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {dress, animOutfit, initOutfits, glint, stateOf} from './outfits.js';
import {makeEyes, setEyes} from './eyes.js';

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
  // v28: no native MSAA on Retina/phones (DPR >= 1.5 already supersamples, and MSAA + alpha is the slow Safari/macOS path);
  // a DPR-1 screen keeps MSAA, since 1x pixels are cheap and its edges would stair-step without it
  renderer = new THREE.WebGLRenderer({canvas, antialias:(window.devicePixelRatio || 1) < 1.5, alpha:true, powerPreference:'high-performance', preserveDrawingBuffer:CAPTURE});
  if (!renderer.getContext()) throw new Error('no gl');
} catch(e){ HUB.fallback(); throw e; }
renderer.setClearColor(0x000000, 0);
// Nocturne (ART 6.2): neutral tone mapping at 1.0 (night 1.05); window.__hubTM = 'agx' is the A/B switch for review shots
renderer.toneMapping = window.__hubTM === 'agx' ? THREE.AgXToneMapping : THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = PHONE ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;           // v28: the shadow pass redraws only when the static room changes (sun steps, the upper floor lifts); robots use blob shadows
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
    } else if (kind === 'graph'){                              // v28 research: a rising line (the Intelligence blue), bars, a source list
      g.strokeStyle = W + '.25)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(16,16); g.lineTo(16,104); g.lineTo(148,104); g.stroke();
      g.strokeStyle = 'rgba(108,184,236,.9)'; g.lineWidth = 2.6; g.beginPath(); [[18,92],[40,82],[60,88],[82,62],[104,58],[126,38],[146,30]].forEach(([x,y],i) => i ? g.lineTo(x,y) : g.moveTo(x,y)); g.stroke();
      for (let i=0;i<6;i++){ g.fillStyle = O + (.35 + i*.08) + ')'; g.fillRect(20 + i*22, 146 - 10 - i*4, 14, 10 + i*4); }
      for (let r=0;r<9;r++){ const y = 20 + r*14; g.fillStyle = 'rgba(108,184,236,' + (r%3 ? .45 : .85) + ')'; g.fillRect(164, y, 6, 6); g.fillStyle = W + (.3 + (r%3)*.12) + ')'; g.fillRect(176, y + 1, 30 + (r*29)%44, 3.2); }
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
const TONE = {orange:'#f1c48a', white:'rgba(241,242,244,.6)', green:'#9fbfa6', red:'#d9483b', need:'#f5883a', done:'#3fbf94'};
function fitText(g, s, max, font, size, min = 14){ let z = size; g.font = font.replace('#', z); while (z > min && g.measureText(s).width > max){ z -= 2; g.font = font.replace('#', z); } return s; }
/* the glass board (ART 6.6): the real counts, DOING / STUCK / DONE TODAY as ivory rows at 60%; only NEEDS YOU is ember */
const boardFlip = {t:1, a:0};
const BL = {en:['DOING','STUCK','DONE TODAY','NEEDS YOU'], es:['EN CURSO','ATASCADAS','HECHAS HOY','TE ESPERAN']};
function boardCounts(){
  const b = HUB.boardInfo || {}, cols = Array.isArray(b.cols) ? b.cols : [], n = {doing:0, stuck:0, done:0};
  for (const c of cols) for (const it of (Array.isArray(c.items) ? c.items : [])){ if (it.tone === 'orange') n.doing++; else if (it.tone === 'red') n.stuck++; else if (it.tone === 'green') n.done++; }
  n.needs = HUB.needs && Array.isArray(HUB.needs.ids) ? HUB.needs.ids.length : (HUB.agents || []).filter(a => a.st === 'waiting').length;
  return n;
}
const boardT = tex(1024, 520, (g,w,h) => {
  const b = HUB.boardInfo || {}, n = boardCounts(), L = BL[HUB.lang === 'es' ? 'es' : 'en'];
  g.clearRect(0,0,w,h);
  g.fillStyle = 'rgba(16,16,20,.72)'; g.beginPath(); g.roundRect(0,0,w,h,26); g.fill();
  const hi = g.createLinearGradient(0,0,w,h); hi.addColorStop(0,'rgba(255,255,255,.06)'); hi.addColorStop(.5,'rgba(255,255,255,0)'); g.fillStyle = hi; g.fill();
  const title = tx(b.title), when = tx(b.when);
  if (title){ g.fillStyle = '#ead1a0'; fitText(g, title, w - 88, '600 #px ' + FONT_H, 40, 22); g.fillText(title, 44, 62); }
  if (when){ g.fillStyle = 'rgba(241,242,244,.5)'; fitText(g, when, w - 88, '500 #px ' + MONO, 20, 12); g.fillText(when, 44, 96); }
  const rows = [[L[0], n.doing, 'rgba(241,242,244,.6)'], [L[1], n.stuck, n.stuck ? TONE.red : 'rgba(241,242,244,.6)'], [L[2], n.done, 'rgba(241,242,244,.6)'], [L[3], n.needs, n.needs ? TONE.need : 'rgba(241,242,244,.35)']];
  rows.forEach(([label, v, c], i) => { const y = 132 + i*92;
    g.fillStyle = 'rgba(241,242,244,.12)'; g.fillRect(44, y, w - 88, 1.5);
    g.fillStyle = c; g.font = '500 26px ' + MONO; g.textAlign = 'left'; g.fillText(label, 44, y + 58);
    if (boardFlip.t < 1){ flapText(g, String(v).padStart(2, '0'), w - 44 - 108, y + 18, 54, 64, '600 50px ' + FONT_H, boardFlip.t, i*.13); g.fillStyle = c; }
    else { g.font = '600 60px ' + FONT_H; g.textAlign = 'right'; g.fillText(String(v).padStart(2, '0'), w - 44, y + 66); } g.textAlign = 'left';
    for (let k = 0; k < Math.min(10, v); k++){ g.globalAlpha = .7; g.beginPath(); g.arc(420 + k*26, y + 49, 7, 0, Math.PI*2); g.fill(); } g.globalAlpha = 1; });
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
  opalCool: std({color:0xfff6ee, emissive:0xffe2c4, emissiveIntensity:1.6, roughness:.4}),   // v28: the upstairs 4000K task lamps
  intel: new THREE.MeshBasicMaterial({color:0x6cb8ec, toneMapped:false}),                    // v28: the Intelligence floor's edge (never a status)
  orange: new THREE.MeshBasicMaterial({color:0xf5883a, toneMapped:false}),
  champagne: new THREE.MeshBasicMaterial({color:0xf1c48a, toneMapped:false}),
  ledge: new THREE.MeshBasicMaterial({color:0x8a6f4a, toneMapped:false}),
  cream: std({color:0xf3eee6, roughness:.3}),
  chrome: std({color:0xdadde2, metalness:1, roughness:.18}),
  paper: std({color:0xf1ece0, roughness:.85}),
  manila: std({color:0xcdb487, roughness:.8}),
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
/* outfit parts are merged per material into one mesh each (keeps the draw count low) */
const M4 = new THREE.Matrix4(), QT = new THREE.Quaternion(), EU = new THREE.Euler(), VP = new THREE.Vector3(), VS = new THREE.Vector3();
function part(kit, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx){
  const g = geo.clone(); M4.compose(VP.set(x,y,z), QT.setFromEuler(EU.set(rx,ry,rz)), VS.set(sx,sy,sz)); g.applyMatrix4(M4);
  for (const k of Object.keys(g.attributes)) if (!['position','normal','uv'].includes(k)) g.deleteAttribute(k);
  if (!kit.has(mat)) kit.set(mat, []); kit.get(mat).push(g.index ? g.toNonIndexed() : g);
}
function bake(kit, parent, cast){ for (const [mat, geos] of kit){ const m = new THREE.Mesh(mergeGeometries(geos, false), mat); m.castShadow = cast; parent.add(m); } }

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
    const sky = g.createLinearGradient(0,0,0,h); sky.addColorStop(0,'#1d1b1a'); sky.addColorStop(.5,'#151413'); sky.addColorStop(1,'#121110');
    g.fillStyle = sky; g.fillRect(0,0,w,h);
    const lit = new Set([Math.floor(rnd()*cols*2), cols*2 + Math.floor(rnd()*cols), Math.floor(rnd()*cols*2) + (wu > 8 ? 0 : 1)].slice(0, wu > 8 ? 2 : 1));
    for (let f=0; f<floors; f++){
      for (let c=0; c<cols; c++){ if (lit.has(f*cols + c)){ const warm = g.createLinearGradient(0, f*fh, 0, (f+1)*fh); warm.addColorStop(0,'rgba(255,200,140,.10)'); warm.addColorStop(.7,'rgba(255,196,130,.34)'); warm.addColorStop(1,'rgba(255,190,120,.18)');
        g.fillStyle = warm; g.fillRect(c*cw, f*fh + 10, cw, fh - 14); } }
      g.fillStyle = 'rgba(8,8,11,.95)'; g.fillRect(0, f*fh, w, 9); g.fillStyle = 'rgba(201,164,92,.25)'; g.fillRect(0, f*fh + 9, w, 1.5);
    }
    g.fillStyle = 'rgba(10,10,14,.6)'; for (let c=0; c<=cols; c++) g.fillRect(c*cw - 1.5, 0, 3, h);
    const fade = g.createLinearGradient(0,0,0,h); fade.addColorStop(0,'rgba(0,0,0,0)'); fade.addColorStop(.3,'rgba(0,0,0,.25)'); fade.addColorStop(.8,'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = fade; g.fillRect(0,0,w,h);
  });
  const th = 14, mk = (w, t, rotY, x, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, th), new THREE.MeshBasicMaterial({map:t, transparent:true, depthWrite:false, toneMapped:false})); m.rotation.y = rotY; m.position.set(x, -.34 - th/2, z); m.renderOrder = -1; P.add(m); };
  mk(FX*2 - .3, face(FX*2), 0, 0, FZ - .15); mk(FZ*2 - .3, face(FZ*2), Math.PI/2, FX - .15, 0);
  // bronze fins, fading down with the facade (one merged mesh)
  const finT = tex(8, 256, (g,w,h) => { const gr = g.createLinearGradient(0,0,0,h); gr.addColorStop(0,'rgba(120,96,64,1)'); gr.addColorStop(.35,'rgba(90,70,48,.7)'); gr.addColorStop(.85,'rgba(90,70,48,0)'); g.fillStyle = gr; g.fillRect(0,0,w,h); });
  const fins = [];
  for (let x = -FX + .5; x < FX - .3; x += .78) fins.push(new THREE.PlaneGeometry(.05, th).rotateY(Math.PI/2).translate(x, -.34 - th/2, FZ - .1));
  for (let z = -FZ + .5; z < FZ - .3; z += .78) fins.push(new THREE.PlaneGeometry(.05, th).translate(FX - .1, -.34 - th/2, z));
  const fm = new THREE.Mesh(mergeGeometries(fins), new THREE.MeshBasicMaterial({map:finT, transparent:true, depthWrite:false, side:THREE.DoubleSide, toneMapped:false})); fm.renderOrder = -1; P.add(dyn(fm));
}
/* poche (ART 6.3): the cut faces of the cutaway are flat unlit #141316, with a 12 mm brass reveal 2 mm proud */
for (const f of ['down','up']){
  const G_ = GRP[f], th = f === 'up' ? .3 : .34, y = -th/2 - .006, W_ = FL[f].wall;
  const face = (w, h, x, yy, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), MAT.poche); m.position.set(x, yy, z); m.rotation.y = ry; G_.add(m); };
  face(FX*2, th, 0, y, FZ + .003, 0); face(FZ*2, th, FX + .003, y, 0, Math.PI/2);
  face(.16, W_, -FX + .08, W_/2, FZ - .1 + .003, 0);                                // the slat wall's cut end
  if (f === 'down') face(.14, W_, FX + .003, W_/2, -FZ + .07, Math.PI/2);   // the back wall's cut end
  box(FX*2, .012, .004, MAT.brass, 0, -.012, FZ + .005, G_, false); box(.004, .012, FZ*2, MAT.brass, FX + .005, -.012, 0, G_, false);
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
  for (let i=0;i<=7;i++){ const x = -FX + .12 + i*(len/7); box(.04, H, .04, MAT.bronze, x, H/2, z + .022, P, false); }
  const g = new THREE.Mesh(new THREE.PlaneGeometry(len, H - .06), MAT.glass); g.position.set(.04, H/2, z); g.renderOrder = 5; P.add(g);
  // three lamp streaks on the glass (ART 6.4): the Nighthawks reflection with no reflection pass
  const stT = tex(32, 256, (g2,w,h) => { const gr = g2.createLinearGradient(0,0,0,h); gr.addColorStop(0,'rgba(255,200,140,0)'); gr.addColorStop(.45,'rgba(255,205,150,1)'); gr.addColorStop(1,'rgba(255,190,120,0)');
    g2.fillStyle = gr; g2.fillRect(0,0,w,h); const hz = g2.createLinearGradient(0,0,w,0); hz.addColorStop(0,'rgba(0,0,0,1)'); hz.addColorStop(.5,'rgba(0,0,0,0)'); hz.addColorStop(1,'rgba(0,0,0,1)'); g2.globalCompositeOperation = 'destination-out'; g2.fillStyle = hz; g2.fillRect(0,0,w,h); });
  const stM = new THREE.MeshBasicMaterial({map:stT, transparent:true, opacity:.06, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false});
  for (const [x, w] of [[-1.5, .5], [.4, .9], [2.9, .45]]){ const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H*.8), stM); m.position.set(x, H*.5, z + .012); m.renderOrder = 6; P.add(dyn(m)); }
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
function screen(id, kind, x, z, w, h, y, rotY = 0, parent = P, ky = .745){
  const t = kind && kind.isTexture ? kind : holo(kind); t.wrapT = THREE.RepeatWrapping;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({map:t, transparent:true, opacity:.25, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, toneMapped:false}));
  m.position.set(x, y, z); m.rotation.set(-.18, rotY + Math.PI, 0); m.renderOrder = 6; parent.add(m);
  // v28: the glass keyboards are merged into one mesh per floor below (transparent, so the furniture merge skips them)
  if (!kbGeos.has(parent)) kbGeos.set(parent, []); kbGeos.get(parent).push(new THREE.BoxGeometry(.42, .012, .15).translate(x, ky, z + .02));
  screens[id] = {m, t, on:.25};
}
const kbGeos = new Map();
function desk(x, z, w, d, kind, id, parent = P){
  const h = .74, t = .05;
  box(w, t, d, MAT.walnut, x, h - t/2, z, parent); box(t, h - t, d, MAT.walnut, x - w/2 + t/2, (h-t)/2, z, parent); box(t, h - t, d, MAT.walnut, x + w/2 - t/2, (h-t)/2, z, parent);
  box(w - .1, .012, .02, MAT.brass, x, h - t - .01, z + d/2 - .02, parent, false);
  blob(x, z, w*1.3, d*2.2, .35, parent);
  if (kind) screen(id, kind, x, z - d*0.1, Math.min(.66, w*.6), .38, 1.02, 0, parent);
}
/* the Intelligence floor's accent (blueprint 3.4): a hairline --intel ring on the rim of every upstairs task-lamp shade */
const intelRim = (x, y, z, r, parent = P) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, .005, 6, 40), MAT.intel); m.rotation.x = Math.PI/2; m.position.set(x, y, z); parent.add(m); return m; };
/* a small brass task lamp with an opal bulb (4000K upstairs): base, stem, shade */
function taskLamp(x, z, y0 = .745, cool = true){ cyl(.07,.09,.03,MAT.brass,x,y0 + .01,z); cyl(.008,.008,.42,MAT.brass,x,y0 + .225,z,8); cyl(.09,.13,.12,MAT.brass,x,y0 + .455,z); sph(.045,cool ? MAT.opalCool : MAT.opal,x,y0 + .405,z); if (cool) intelRim(x, y0 + .395, z, .13); }
/* v28 upstairs = Intelligence (blueprint 5.1, change list 1-5): the experiment table (the old King's desk), one QA bench (the two old
 * lab desks merged; the other two are gone: a quiet floor needs empty floor), Storm Watch's radar table by the glass (the old Right
 * Hand desk), the focus desk by the window, the reading chair, the board */
desk(.2, -2.45, 1.9, .8, 'graph', 'hub-keeper');
{ // the experiment table: the 4000K task lamp, a small plant, fanned papers and a short stack of sources
  taskLamp(1.0, -2.62);
  cyl(.06,.05,.1,MAT.pot,-.55,.79,-2.65); for (let i=0;i<5;i++){ const l = new THREE.Mesh(new THREE.IcosahedronGeometry(.05,0), MAT.leaf2); l.position.set(-.55 + (rnd()-.5)*.08, .88 + rnd()*.06, -2.65 + (rnd()-.5)*.08); l.scale.set(1,.6,1); P.add(l); }
  for (let i=0;i<3;i++){ const p = box(.21,.004,.29,MAT.paper,.62 + i*.05, .747 + i*.004, -2.22 + i*.02); p.rotation.y = -.35 + i*.22; }
  for (let i=0;i<3;i++){ const b = box(.24 - i*.02, .035, .17, [MAT.leatherDark, MAT.walnut, MAT.leather][i], -.72, .76 + i*.035, -2.22); b.rotation.y = .1 - i*.12; }
}
// the QA bench: one 2.4 m walnut slab; a laptop glass + a phone whose screens tick, the queue rack, the 4000K task lamp
const qa = {n:0, fail:false, tick:0};
const qaT = tex(256, 160, (g,w,h) => {                          // QA device screens: one tick per stamp, an oxide cross on a fail
  g.clearRect(0,0,w,h); const bg = g.createLinearGradient(0,0,0,h); bg.addColorStop(0,'rgba(241,200,150,.2)'); bg.addColorStop(1,'rgba(220,180,130,.07)');
  g.fillStyle = bg; g.beginPath(); g.roundRect(2,2,w-4,h-4,12); g.fill(); g.strokeStyle = 'rgba(241,196,138,.8)'; g.lineWidth = 2.5; g.stroke();
  for (let r=0;r<8;r++){ const y = 20 + r*16, on = r < qa.n, bad = qa.fail && r === qa.n - 1;
    g.lineWidth = 2.6; g.strokeStyle = bad ? (TONE.red || '#d9483b') : on ? (TONE.done || '#3fbf94') : 'rgba(255,244,228,.18)'; g.beginPath();
    if (bad){ g.moveTo(19,y-4); g.lineTo(29,y+5); g.moveTo(29,y-4); g.lineTo(19,y+5); } else { g.moveTo(18,y); g.lineTo(23,y+5); g.lineTo(31,y-4); } g.stroke();
    g.fillStyle = 'rgba(255,244,228,' + (on ? .55 : .2) + ')'; g.fillRect(42, y-1, 60 + (r*37)%120, 3.2); } });
desk(1.7, .72, 2.4, .6, null, null);
screen('qa-tester', qaT, 1.3, .66, .52, .32, 1.0);
{
  const k = new Map();                                             // the phone on a brass stand, its screen shares the ticks
  part(k, new RoundedBoxGeometry(.1, .18, .012, 2, .01), MAT.visor, 0, 0, 0); part(k, new THREE.BoxGeometry(.06, .012, .06), MAT.brass, 0, -.095, .02);
  const g = new THREE.Group(); bake(k, g, false); g.position.set(1.9, .845, .6); g.rotation.set(-.25, -.2, 0); P.add(g);
  const ph = new THREE.Mesh(new THREE.PlaneGeometry(.085, .16), new THREE.MeshBasicMaterial({map:qaT, transparent:true, opacity:.9, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false}));
  ph.position.set(0, 0, .0075); ph.renderOrder = 6; g.add(dyn(ph)); qa.phone = ph;
  const rk = new Map();                                            // the queue rack: a brass letter rack, one envelope per build waiting on QA
  part(rk, new THREE.BoxGeometry(.34, .02, .16), MAT.brass, 0, .01, 0); for (let i=0;i<4;i++) part(rk, new THREE.BoxGeometry(.006, .1, .15), MAT.brassSoft, -.15 + i*.1, .06, 0);
  for (let i=0;i<3;i++) part(rk, new THREE.BoxGeometry(.012, .12, .13), MAT.paper, -.1 + i*.1, .08, (i-1)*.01, 0, 0, (i-1)*.08);
  const rg = new THREE.Group(); bake(rk, rg, false); rg.position.set(2.62, .745, .62); P.add(rg);
  taskLamp(.66, .52);
}
{ const r = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.3), MAT.rug); r.rotation.x = -Math.PI/2; r.position.set(.4, .003, .4); r.receiveShadow = true; P.add(r); }
{ // the focus desk by the window (a robot with no desk of its own): a brass-legged standing table
  const x = -2.1, z = -2.55; box(.9, .04, .5, MAT.walnut, x, 1.0, z); for (const dx of [-.4,.4]) cyl(.02,.02,1.0,MAT.brass,x+dx,.5,z,8);
  const t = holo('code'); const m = new THREE.Mesh(new THREE.PlaneGeometry(.5,.3), new THREE.MeshBasicMaterial({map:t, transparent:true, opacity:.2, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, toneMapped:false}));
  m.position.set(x, 1.24, z - .1); m.rotation.set(-.18, Math.PI, 0); m.renderOrder = 6; P.add(m); screens['~hot-up'] = {m, t, on:.2};
}
// the reading chair + floor lamp (the Research Lead's quiet corner; a lounge seat now)
{
  const x = -3.75, z = 2.6;
  rbox(.72,.12,.72,.05,MAT.leather,x,.42,z); const back = rbox(.72,.72,.12,.05,MAT.leather,x-.3,.78,z-.28); back.rotation.y = -1.05 + Math.PI/2; back.position.set(x-.33,.78,z-.12);
  box(.7,.36,.7,MAT.walnut,x,.18,z);
  cyl(.1,.1,.02,MAT.brass,-4.25,.01,1.95); cyl(.01,.01,1.5,MAT.brass,-4.25,.76,1.95,8); sph(.09,MAT.opalCool,-4.25,1.52,1.95); intelRim(-4.25, 1.52, 1.95, .093);
}
// Storm Watch's radar table, up by the glass (change list 2): brass pedestal, glass top, live radar disc; the watcher faces the sky
const radar = {x:2.95, z:-2.15};
{
  const {x, z} = radar;
  cyl(.2,.26,.06,MAT.brass,x,.03,z); cyl(.07,.07,.74,MAT.brassSoft,x,.4,z,16); const top = cyl(.52,.52,.03,MAT.glassTop,x,.78,z,48); top.castShadow = false; top.renderOrder = 4;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.52,.012,8,64), MAT.brass); ring.rotation.x = Math.PI/2; ring.position.set(x,.78,z); P.add(ring);
  const mk = (t, y, op) => { const m = flat(new THREE.CircleGeometry(.48, 48), new THREE.MeshBasicMaterial({map:t, transparent:true, opacity:op, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false}), x, y, z); m.renderOrder = 7; return m; };
  radar.disc = mk(radarTex, .81, .35); radar.sweep = mk(sweepTex, .815, 0);
  radar.blips = []; for (const [bx,bz] of [[.18,-.1],[.24,.02],[.12,.12],[-.2,.2]]){ const b = sph(.022, new THREE.MeshBasicMaterial({color:0xf1c48a, transparent:true, opacity:0, toneMapped:false}), x+bx,.83,z+bz); radar.blips.push(b); }
  blob(x, z, 1.4, 1.4, .35);
}

/* --- plants --- */
const LEAF = new THREE.SphereGeometry(1, 10, 6);
function plant(x, z, s, n = PHONE ? 22 : 34){ cyl(.2*s,.16*s,.44*s,MAT.pot,x,.22*s,z); blob(x,z,.8*s,.8*s,.4); cyl(.012,.018,.9*s,MAT.leatherDark,x,.8*s,z,6);
  for (let i=0;i<n;i++){ const l = new THREE.Mesh(LEAF, i%3 ? MAT.leaf : MAT.leaf2); const a = rnd()*Math.PI*2, r = .05 + rnd()*.24*s, y = (.7 + rnd()*.95)*s;
    l.position.set(x + Math.cos(a)*r, y, z + Math.sin(a)*r); l.scale.set(.16*s, .014, .085*s); l.rotation.set((rnd()-.5)*1.2, -a, (rnd()-.3)*.9); S(l); P.add(l); } }
function olive(x, z, s){                                          // an olive tree in a stone pot, upstairs by the glass
  cyl(.24*s,.2*s,.46*s,MAT.potStone,x,.23*s,z,20); blob(x,z,.9*s,.9*s,.4);
  const tr = cyl(.018,.03,1.1*s,MAT.leatherDark,x,.9*s,z,6); tr.rotation.z = .08;
  for (let i=0;i<(PHONE ? 30 : 60);i++){ const l = new THREE.Mesh(LEAF, MAT.olive); const a = rnd()*Math.PI*2, r = .05 + rnd()*.32*s, y = (1.05 + rnd()*.75)*s;
    l.position.set(x + Math.cos(a)*r + .04, y, z + Math.sin(a)*r); l.scale.set(.07*s, .01, .022*s); l.rotation.set((rnd()-.5)*1.4, -a, (rnd()-.3)*.9); S(l); P.add(l); } }
olive(4.1, -2.95, 1);

/* ================= downstairs furniture: Execution (blueprint 5.2) ================= */
P = gDown;
// the comms corner (back right): Cowork's storm-ops desk + the Chat Reader's standing press desk, out of the build traffic
desk(3.9, -2.5, 1.0, .6, 'map', 'cowork');
{ // the press desk: a brass-legged standing desk, today's papers stacked on it
  const x = 2.6, z = -2.4;
  box(.5, .04, .4, MAT.walnut, x, 1.0, z); for (const dx of [-.2,.2]) cyl(.018,.018,1.0,MAT.brass,x+dx,.5,z,8); box(.46, .012, .02, MAT.brass, x, .972, z + .19, P, false);
  screen('chat-reader', 'news', x, z - .09, .4, .26, 1.25, 0, P, 1.027);
  for (let i=0;i<3;i++){ const p = box(.2,.01,.27,MAT.paper,x + .12, 1.026 + i*.011, z + .05, P); p.rotation.y = .3 + (i-1)*.14; }
}
// the dispatch table (change list 4): the King at its head, the Right Hand beside it, where every build and verdict passes;
// NOW tasks lie on it as cards in four columns (TODO / DOING / REVIEW / DONE; the real cards come in v28.2)
const dispatch = {x:.7, z:.5, cards:[], card:null};
desk(.7, .5, 2.4, .85, null, null);
screen('code', 'board', .25, .415, .5, .34, 1.0);
screen('king', 'chat', 1.2, .415, .5, .34, 1.0);
{
  const cols = [[-.3, 3], [.3, 2], [.9, 1], [1.5, 2]];
  for (const [cx, n] of cols){ box(.11, .003, .012, MAT.brass, cx, .747, .56, P, false);
    for (let i=0;i<n;i++){ const c = box(.1, .004, .13, MAT.paper, cx + (i%2 ? .012 : -.008), .748 + i*.001, .66 + i*.1, P, false); c.rotation.y = (i%2 ? .05 : -.04); } }
  dispatch.card = dyn(box(.1, .005, .13, MAT.paper, -.12, .752, .24, P, false));        // the King's card in hand (slide-card moves it)
  dispatch.cardA = new THREE.Vector3(-.12, .752, .24); dispatch.cardB = new THREE.Vector3(.5, .752, .24);
  const k = new Map();                                             // the Right Hand's note tray
  part(k, new THREE.BoxGeometry(.24, .012, .17), MAT.brass, 0, 0, 0); for (const s of [-1,1]) part(k, new THREE.BoxGeometry(.24, .03, .008), MAT.brass, 0, .015, s*.085);
  for (let i=0;i<3;i++) part(k, new THREE.BoxGeometry(.2, .004, .13), MAT.paper, (i-1)*.01, .012 + i*.005, 0, 0, (i-1)*.1);
  const g = new THREE.Group(); bake(k, g, false); g.position.set(1.66, .75, .26); g.rotation.y = -.2; P.add(g);
}
// the linear brass pendant, moved over the dispatch table (ART 6.2, blueprint 3.4): a bronze bar with an opal underside, one PointLight
{ const x = .7, z = .32, y = 2.46;                                 // high and a little back, so it never crosses the King's face
  box(2.4, .05, .1, MAT.bronze, x, y, z, P, false); box(2.32, .012, .064, MAT.opal, x, y - .031, z, P, false);
  box(2.42, .008, .104, MAT.brass, x, y + .029, z, P, false);
  for (const dx of [-1.0, 1.0]) cyl(.004,.004,.34,MAT.brass,x + dx,y + .2,z,6); }
// the build bench (the radar's old place, next to the tube base): Builder + Engine Mechanic at one walnut slab, a matte black tool
// rail, and the staging tray at its front (builds waiting to go up to QA)
desk(-2.35, .5, 2.2, .65, null, null);
screen('builder', 'code', -2.9, .435, .5, .34, 1.0);
screen('engine-mechanic', 'engine', -1.8, .435, .5, .34, 1.0);
{
  box(2.1, .028, .028, MAT.steel, -2.35, .63, .845, P, false);
  for (const [tx, th] of [[-3.15, .12], [-3.0, .09], [-1.75, .11], [-1.6, .08]]){ box(.018, th, .012, MAT.steel, tx, .615 - th/2, .862, P, false); box(.04, .02, .012, MAT.steel, tx, .61 - th, .862, P, false); }
  const k = new Map();                                             // the staging tray: builds on their way up to QA
  part(k, new THREE.BoxGeometry(.3, .014, .2), MAT.brass, 0, 0, 0); for (const s of [-1,1]) part(k, new THREE.BoxGeometry(.3, .03, .008), MAT.brass, 0, .015, s*.1);
  for (let i=0;i<2;i++) part(k, new THREE.BoxGeometry(.24, .008, .15), MAT.paper, (i-.5)*.02, .014 + i*.009, 0, 0, (i-.5)*.14);
  const g = new THREE.Group(); bake(k, g, false); g.position.set(-2.35, .752, .68); P.add(g);
}
// the design studio (front left): the Designer's desk and a standing easel (the pin wall + Shipped shelf come in v28.2)
desk(-3.1, 2.6, 1.1, .6, 'design', 'designer');
const easel = {x:-3.62, z:1.95, yaw:.75};
{
  const t = tex(128, 160, (g,w,h) => { g.fillStyle = '#efe9df'; g.fillRect(0,0,w,h);          // the board: two options pinned, a swatch strip
    ['#d98d5a','#ead1a0','#2a2b2f','#c9a45c','#9fbfa6'].forEach((c,i) => { g.fillStyle = c; g.fillRect(10 + i*22, 10, 18, 18); });
    for (const [x0, y0] of [[10, 40], [68, 52]]){ g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x0 + 3, y0 + 3, 50, 64); g.fillStyle = '#fbf8f2'; g.fillRect(x0, y0, 50, 64);
      g.fillStyle = '#2a2b2f'; g.fillRect(x0 + 6, y0 + 8, 38, 26); g.fillStyle = '#d98d5a'; g.fillRect(x0 + 6, y0 + 40, 24, 4); g.fillStyle = 'rgba(42,43,47,.45)'; g.fillRect(x0 + 6, y0 + 48, 34, 3);
      g.fillStyle = '#c9a45c'; g.beginPath(); g.arc(x0 + 25, y0 + 2, 3.5, 0, Math.PI*2); g.fill(); }
    g.fillStyle = 'rgba(42,43,47,.35)'; g.fillRect(10, 128, 108, 3); g.fillRect(10, 138, 70, 3); });
  const k = new Map();
  for (const s of [-1,1]) part(k, new THREE.CylinderGeometry(.012, .014, 1.62, 6), MAT.walnut, s*.2, .8, .04, -.08, 0, s*-.1);
  part(k, new THREE.CylinderGeometry(.012, .014, 1.55, 6), MAT.walnut, 0, .76, -.24, .32);
  part(k, new THREE.BoxGeometry(.52, .025, .06), MAT.walnut, 0, .93, .07, -.08); part(k, new THREE.BoxGeometry(.06, .025, .03), MAT.brass, 0, 1.58, .0, -.08);
  const g = new THREE.Group(); bake(k, g, true); g.position.set(easel.x, 0, easel.z); g.rotation.y = easel.yaw; P.add(g);
  const bk = S(new THREE.Mesh(new THREE.BoxGeometry(.48, .58, .016), MAT.walnut)); bk.position.set(0, 1.24, .045); bk.rotation.x = -.08; g.add(bk);
  const b = new THREE.Mesh(new THREE.PlaneGeometry(.46, .56), std({map:t, roughness:.75})); b.position.set(0, 1.24, .0545); b.rotation.x = -.08; g.add(b); easel.board = b;
  easel.pin = new THREE.Vector3(0, 1.26, .08); g.updateMatrixWorld(true); easel.g = g;
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
plant(4.32, 1.4, .62); plant(-4.05, 3.0, .7);
/* ================= the instrument room (ART 6.6): one 1.25x hero prop per desk, brass plates No. 01-10, status bars ================= */
const SEATS = [['code','01'],['king','02'],['builder','03'],['designer','04'],['engine-mechanic','05'],['qa-tester','06'],['hub-keeper','07'],['cowork','08'],['storm-watch','09'],['chat-reader','10']];
const plateT = tex(512, 128, (g,w,h) => {
  SEATS.forEach(([, n], i) => { const x = (i%5)*102, y = Math.floor(i/5)*64;
    const gr = g.createLinearGradient(x, y, x, y + 60); gr.addColorStop(0,'#e3c98f'); gr.addColorStop(.5,'#c9a45c'); gr.addColorStop(1,'#8a6a3a'); g.fillStyle = gr; g.fillRect(x + 1, y + 2, 100, 60);
    g.strokeStyle = 'rgba(60,40,15,.55)'; g.lineWidth = 2; g.strokeRect(x + 5, y + 6, 92, 52);
    g.fillStyle = '#3a2610'; g.font = '600 30px ' + MONO; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('No. ' + n, x + 51, y + 33); });
});
/* v28 seat map (blueprint 5): the brass plate + the hairline status bar on the desk's front edge (bar under the robot's own
 * half of a shared table), the andon stack on a back corner. {f, x: plate/bar center, z: desk center, d: depth, bw: bar width,
 * py/by: plate/bar height, an: [x, z, y0, pole]: the andon lamp (floor-local)} */
const DESKS = {
  code:              {f:'down', x:.25,  z:.5,   d:.85,  bw:.8,  an:[-.38, .2, .745, .16]},           // the dispatch table, the King's half
  king:              {f:'down', x:1.2,  z:.5,   d:.85,  bw:.8,  an:[1.78, .2, .745, .16]},           // ... the Right Hand's half
  builder:           {f:'down', x:-2.9, z:.5,   d:.65,  bw:.8,  an:[-3.35, .25, .745, .16]},         // the build bench
  'engine-mechanic': {f:'down', x:-1.8, z:.5,   d:.65,  bw:.8,  an:[-1.35, .25, .745, .16]},
  designer:          {f:'down', x:-3.1, z:2.6,  d:.6,   bw:.8,  an:[-2.65, 2.42, .745, .16]},
  'chat-reader':     {f:'down', x:2.6,  z:-2.4, d:.4,   bw:.36, py:.955, by:.93, an:[2.79, -2.53, 1.02, .12]},   // the press desk
  cowork:            {f:'down', x:3.9,  z:-2.5, d:.6,   bw:.7,  an:[4.3, -2.72, .745, .16]},
  'hub-keeper':      {f:'up',   x:.2,   z:-2.45,d:.8,   bw:.9,  an:[1.02, -2.28, .745, .16]},         // the experiment table
  'qa-tester':       {f:'up',   x:1.3,  z:.72,  d:.6,   bw:.9,  an:[2.86, .5, .745, .16]},            // the QA bench
  'storm-watch':     {f:'up',   x:2.95, z:-2.15,d:1.04, bw:.5,  py:.2, by:.155, an:[3.56, -2.62, 0, .9]}   // the radar table (a floor pole)
};
const deskBars = {}, andons = {};
const ANDON_OFF = new THREE.Color(0x2b2522);
{
  const plates = {up:[], down:[]}, bars = {up:[], down:[]}, lamps = {up:[], down:[]};
  SEATS.forEach(([id], i) => { const D = DESKS[id]; const u0 = (i%5)*102/512, v1 = 1 - Math.floor(i/5)*64/128;
    const pg = new THREE.PlaneGeometry(.15, .045); const uv = pg.attributes.uv; uv.setXY(0, u0 + 2/512, v1 - 2/128); uv.setXY(1, u0 + 100/512, v1 - 2/128); uv.setXY(2, u0 + 2/512, v1 - 62/128); uv.setXY(3, u0 + 100/512, v1 - 62/128);
    pg.translate(D.x, D.py ?? .715, D.z + D.d/2 + .004); plates[D.f].push(pg); bars[D.f].push([id, D.x, D.z + D.d/2 + .006, D.bw, D.by ?? .688]); lamps[D.f].push([id, ...D.an]); });
  for (const f of ['up','down']){
    P = GRP[f];
    const m = new THREE.Mesh(mergeGeometries(plates[f]), std({map:plateT, metalness:.6, roughness:.4})); GRP[f].add(dyn(m));
    // hairline status light bars: one InstancedMesh per floor, colored per robot state; v28: a stuck bar is hatched (every other
    // dash dark), cocked 6 deg and 3x taller (the flight-strip "cocked strip"), per-instance aHatch
    const bg = new THREE.BoxGeometry(1, .008, .006); bg.setAttribute('aHatch', new THREE.InstancedBufferAttribute(new Float32Array(bars[f].length), 1));
    const bm = new THREE.MeshBasicMaterial({toneMapped:false});
    bm.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aHatch; varying float vHatch; varying float vBx;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvHatch = aHatch; vBx = position.x;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vHatch; varying float vBx;').replace('#include <color_fragment>', '#include <color_fragment>\nif (vHatch > .5 && fract(vBx*16.0) > .5) diffuseColor.rgb *= .16;');
    };
    const im = new THREE.InstancedMesh(bg, bm, bars[f].length);
    bars[f].forEach(([id, x, z, w, y], k) => { M4.compose(VP.set(x, y, z), QT.identity(), VS.set(w, 1, 1)); im.setMatrixAt(k, M4); im.setColorAt(k, new THREE.Color(0x3a3632)); deskBars[id] = {im, k, x, y, z, w, cls:'', fill:1}; });
    GRP[f].add(dyn(im));
    // the andon (blueprint 4: Toyota stack light): a small 2-tier lamp on each desk, off (smoked) until needed: the top tier lights
    // oxide when the robot is stuck, the bottom tier ember when it needs FilthE. Steady, never blinking. One InstancedMesh per floor.
    const lm = new THREE.InstancedMesh(new THREE.CylinderGeometry(.024, .024, .042, 14), new THREE.MeshBasicMaterial({toneMapped:false}), lamps[f].length*2);
    lamps[f].forEach(([id, x, z, y0, pole], k) => {
      cyl(.006, .006, pole, MAT.brass, x, y0 + pole/2, z, 8).castShadow = false; cyl(.028, .032, .012, MAT.brass, x, y0 + .006, z, 14).castShadow = false;
      cyl(.027, .027, .008, MAT.brass, x, y0 + pole + .096, z, 14).castShadow = false;                // the brass cap
      for (let tier = 0; tier < 2; tier++){ M4.compose(VP.set(x, y0 + pole + .025 + tier*.046, z), QT.identity(), VS.set(1, 1, 1)); lm.setMatrixAt(k*2 + tier, M4); lm.setColorAt(k*2 + tier, ANDON_OFF); }
      andons[id] = {im:lm, k:k*2, need:null, stuck:null}; });
    GRP[f].add(dyn(lm)); andons[f] = {im:lm, dirty:false};
  }
  // hero props (ART 6.6), grouped tight on each desk
  P = gDown;
  { const k = new Map();                                            // Builder: a lit page frame, on the build bench
    part(k, new THREE.BoxGeometry(.3, .22, .02), MAT.bronze, 0, 0, 0); part(k, new THREE.BoxGeometry(.26, .18, .005), MAT.opal, 0, 0, .012); part(k, new THREE.BoxGeometry(.04, .12, .08), MAT.bronze, 0, -.1, -.03, .3);
    const g = new THREE.Group(); bake(k, g, false); g.position.set(-3.28, .87, .6); g.rotation.y = .5; P.add(g); }
  { const k = new Map();                                            // Engine Mechanic: an open engine box, on the build bench
    part(k, new THREE.BoxGeometry(.3, .12, .2), MAT.steel, 0, .06, 0); part(k, new THREE.BoxGeometry(.3, .012, .2), MAT.brass, 0, .19, -.12, -1.1);
    for (let i=0;i<4;i++) part(k, new THREE.CylinderGeometry(.022,.022,.06,10), MAT.chrome, -.1 + i*.066, .14, 0);
    const g = new THREE.Group(); bake(k, g, false); g.position.set(-1.45, .74, .64); g.rotation.y = -.35; P.add(g); }
  { const t = tex(256, 160, (g,w,h) => { g.fillStyle = '#d8ccb0'; g.fillRect(0,0,w,h); g.strokeStyle = 'rgba(90,70,40,.35)'; g.lineWidth = 1;   // Cowork: a map table with pins
      for (let i=0;i<9;i++){ g.beginPath(); g.moveTo(0, 12 + i*17 + Math.sin(i)*4); for (let x=0;x<=w;x+=16) g.lineTo(x, 12 + i*17 + Math.sin(x*.03 + i)*6); g.stroke(); }
      g.strokeStyle = 'rgba(60,70,90,.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(20,120); g.bezierCurveTo(80,60,160,140,240,40); g.stroke(); });
    const mx = 3.58, mz = -2.36;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(.5, .32), std({map:t, roughness:.8})); m.rotation.x = -Math.PI/2; m.rotation.z = .15; m.position.set(mx, .752, mz); P.add(m);
    const k = new Map(); for (const [dx,dz] of [[-.12,-.05],[.05,.06],[.14,-.08],[-.02,-.1]]) { part(k, new THREE.CylinderGeometry(.003,.003,.05,6), MAT.chrome, mx + dx, .775, mz + dz); part(k, new THREE.SphereGeometry(.011,8,6), MAT.brass, mx + dx, .8, mz + dz); }
    bake(k, P, false); }
  P = gUp;
  { const k = new Map();                                            // QA Tester: a clipboard (its rubber stamp is loose: it stamps with it)
    part(k, new THREE.BoxGeometry(.2, .012, .27), MAT.leather, 0, .006, 0); part(k, new THREE.BoxGeometry(.16, .004, .21), MAT.paper, 0, .014, .01); part(k, new THREE.BoxGeometry(.07, .02, .03), MAT.brass, 0, .02, -.12);
    const g = new THREE.Group(); bake(k, g, false); g.position.set(1.6, .745, .6); g.rotation.y = -.3; P.add(g);
    const sk = new Map(); part(sk, new THREE.CylinderGeometry(.022,.03,.09,12), MAT.walnut, 0, .06, 0); part(sk, new THREE.SphereGeometry(.034,12,8), MAT.walnut, 0, .12, 0); part(sk, new THREE.CylinderGeometry(.045,.045,.016,14), MAT.brass, 0, .008, 0);
    qa.stamp = new THREE.Group(); bake(sk, qa.stamp, false); qa.stamp.traverse(o => { o.userData.dyn = true; }); qa.rest = new THREE.Vector3(1.84, .745, .74); qa.stamp.position.copy(qa.rest); P.add(qa.stamp); }
  { const x = -.28, z = -2.2;                                       // Research Lead: a big open book, on the experiment table
    const k = new Map(); for (const s of [-1,1]) part(k, new THREE.BoxGeometry(.19, .03, .26), MAT.paper, s*.1, .02, 0, 0, 0, s*.08); part(k, new THREE.BoxGeometry(.42, .012, .28), MAT.leatherDark, 0, .002, 0);
    const g = new THREE.Group(); bake(k, g, false); g.position.set(x, .75, z); g.rotation.y = .35; P.add(g); }
  { const x = -3.4, z = 3.02;                                       // the side table by the reading chair: two books
    cyl(.2,.2,.03,MAT.walnut,x,.5,z,20); cyl(.02,.02,.5,MAT.brass,x,.25,z,8); cyl(.12,.12,.015,MAT.brass,x,.008,z,16);
    box(.2,.035,.15,MAT.leatherDark,x,.535,z).rotation.y = .4; box(.18,.03,.13,MAT.leather,x,.567,z).rotation.y = .1; }
  { const k = new Map(), bx = -FX + .24, by = .8, bz = -.35;       // King: a brass pointer resting on the board's ledge
    part(k, new THREE.CylinderGeometry(.006,.01,.9,8), MAT.brass, 0, 0, 0, Math.PI/2); part(k, new THREE.SphereGeometry(.014,8,6), MAT.brass, 0, 0, .45);
    const g = new THREE.Group(); bake(k, g, false); g.position.set(bx, by, bz + .5); g.rotation.set(0, 0, .05); P.add(g); }
  P = gDown;
}
// "your spot": a brass arc + orange glow at the front corner, where a robot comes when it needs FilthE
const spot = {};
{
  const a0 = Math.PI/2 + .04, al = Math.PI/2 - .08;
  const arc = flat(new THREE.RingGeometry(1.98, 2.01, 64, 1, a0, al), MAT.brass, FX, .007, FZ); arc.rotation.x = -Math.PI/2;
  spot.glow = flat(new THREE.RingGeometry(1.88, 1.97, 64, 1, a0, al), new THREE.MeshBasicMaterial({color:0xf1c48a, transparent:true, opacity:.25, depthWrite:false, toneMapped:false, blending:THREE.AdditiveBlending}), FX, .008, FZ);
  spot.fill = flat(new THREE.CircleGeometry(1.9, 48, a0, al), new THREE.MeshBasicMaterial({color:0xf1c48a, transparent:true, opacity:0, depthWrite:false, toneMapped:false, blending:THREE.AdditiveBlending}), FX, .005, FZ);
}
/* ================= your figure + the line at your spot (FUN 2): brass posts, a velvet rope, up to 5 slots, a wait sign ================= */
const FIG = {x:4.3, z:2.6};              // beside the line, so it never hides a face from the 3/4 camera
const LINE = [[3.58,2.6],[2.98,2.54],[2.38,2.48],[1.78,2.42],[1.18,2.36]];
const lineUI = {ropes:[], n:-1, sign:null, signText:''};
{
  // you: a quiet graphite figure with a brass collar pin, facing the line
  const k = new Map(), fy = Math.atan2(LINE[0][0] - FIG.x, LINE[0][1] - FIG.z);
  MAT.jacket = std({color:0x2a2b30, roughness:.7}); MAT.trouser = std({color:0x1b1c20, roughness:.8}); MAT.skin = std({color:0xb89c84, roughness:.6});
  for (const s_ of [-1,1]) part(k, new THREE.CylinderGeometry(.06, .055, .82, 12), MAT.trouser, s_*.085, .41, 0);
  part(k, new RoundedBoxGeometry(.4, .62, .24, 3, .09), MAT.jacket, 0, 1.13, 0);
  for (const s_ of [-1,1]) part(k, new THREE.CylinderGeometry(.05, .045, .6, 10), MAT.jacket, s_*.24, 1.1, .02, 0, 0, s_*.08);
  part(k, new THREE.CylinderGeometry(.05, .055, .08, 12), MAT.skin, 0, 1.48, 0); part(k, new THREE.SphereGeometry(.12, 20, 14), MAT.skin, 0, 1.62, 0, 0, 0, 0, 1, 1.12, 1);
  part(k, new THREE.SphereGeometry(.018, 8, 6), MAT.brass, -.1, 1.34, .12);
  const g = new THREE.Group(); bake(k, g, true); g.position.set(FIG.x, 0, FIG.z); g.rotation.y = fy; P.add(g); blob(FIG.x, FIG.z, .7, .7, .45);
  // brass posts on the room side of the line, a leather bench behind it
  const dir = new THREE.Vector2(LINE[0][0] - LINE[4][0], LINE[0][1] - LINE[4][1]).normalize(), off = [dir.y*.42, -dir.x*.42];   // posts behind the line (room side)
  lineUI.posts = LINE.map(([x, z]) => [x + off[0], z + off[1]]); lineUI.posts.push([LINE[4][0] - dir.x*.58 + off[0], LINE[4][1] - dir.y*.58 + off[1]]);
  const pk = new Map(); for (const [x, z] of lineUI.posts){ part(pk, new THREE.CylinderGeometry(.018, .018, .86, 10), MAT.brass, x, .43, z); part(pk, new THREE.SphereGeometry(.03, 10, 8), MAT.brass, x, .88, z); part(pk, new THREE.CylinderGeometry(.09, .1, .025, 16), MAT.brass, x, .012, z); }
  bake(pk, P, true);
  const bx = (LINE[1][0] + LINE[3][0])/2 + off[0]*1.9, bz = (LINE[1][1] + LINE[3][1])/2 + off[1]*1.9, byaw = -Math.atan2(dir.y, dir.x);
  const bench = rbox(1.3, .1, .34, .04, MAT.leather, bx, .36, bz); bench.rotation.y = byaw;
  for (const s_ of [-1,1]){ const lg = box(.03, .32, .28, MAT.brass, bx + Math.cos(byaw)*s_*.55, .16, bz - Math.sin(byaw)*s_*.55); lg.rotation.y = byaw; }
  // the rope: one sagging velvet segment per gap (shown for the robots in line), plus the unhooked end at zero
  const ropeM = std({color:0x6b1528, roughness:.6});
  for (let i=0;i<5;i++){ const [x0, z0] = lineUI.posts[i], [x1, z1] = lineUI.posts[i+1];
    const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x0, .82, z0), new THREE.Vector3((x0+x1)/2, .6, (z0+z1)/2), new THREE.Vector3(x1, .82, z1));
    const r = new THREE.Mesh(new THREE.TubeGeometry(c, 16, .014, 6), ropeM); r.visible = false; P.add(dyn(r)); lineUI.ropes.push(r); }
  { const [x0, z0] = lineUI.posts[0]; const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x0, .82, z0), new THREE.Vector3(x0 + .06, .45, z0 + .04), new THREE.Vector3(x0 + .02, .2, z0 + .1));
    lineUI.loose = dyn(new THREE.Mesh(new THREE.TubeGeometry(c, 12, .014, 6), ropeM)); P.add(lineUI.loose); }
  // the wait sign on the first post (redrawn at most once a minute)
  lineUI.tex = tex(256, 96, (g2, w, h) => { g2.clearRect(0,0,w,h); const gr = g2.createLinearGradient(0,0,0,h); gr.addColorStop(0,'#e3c98f'); gr.addColorStop(1,'#a8823f');
    g2.fillStyle = gr; g2.beginPath(); g2.roundRect(2,2,w-4,h-4,10); g2.fill(); g2.strokeStyle = 'rgba(60,40,15,.5)'; g2.lineWidth = 2; g2.beginPath(); g2.roundRect(8,8,w-16,h-16,6); g2.stroke();
    g2.fillStyle = '#2a1c0c'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; fitText(g2, lineUI.signText, w - 36, '600 #px ' + MONO, 30, 14); g2.fillText(lineUI.signText, w/2, h/2 + 2); });
  const [sx, sz] = lineUI.posts[0];
  lineUI.sign = dyn(new THREE.Mesh(new THREE.PlaneGeometry(.42, .16), std({map:lineUI.tex, transparent:true, metalness:.5, roughness:.4})));
  lineUI.sign.position.set(sx, 1.02, sz); lineUI.sign.rotation.y = Math.PI/4; lineUI.sign.visible = false; P.add(lineUI.sign);
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
for (const [parent, geos] of kbGeos){ const kb = new THREE.Mesh(mergeGeometries(geos, false), MAT.glassTop); kb.renderOrder = 4; kb.userData.dyn = true; parent.add(kb); geos.forEach(g => g.dispose()); }
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
// v28 lower floor: the back aisle behind the build bench and the dispatch table, one gap (M) between them, the front aisle
// in front of both; the comms corner is reached from B4 around the press desk
[['B0',-3.1,-1.25],['B1',-2.35,-1.25],['B2',-1.2,-1.25],['B3',.25,-1.15],['SX',1.95,-1.1],['B4',2.62,-1.5],['M',-.88,.45],
 ['TB',TUBE.x,TUBE.z],['F0',-3.4,1.3],['F1',-1.9,1.3],['F2',-.88,1.3],['F3',1.0,1.75],['F4',2.3,1.85],['R1',2.3,.1],['FS',3.3,2.2]].forEach(n => node('down', ...n));
const EDGES = [['U:A0','U:A1'],['U:A1','U:A2'],['U:A2','U:A3'],['U:A3','U:A4'],['U:A4','U:A5'],['U:A0','U:L1'],['U:L1','U:F0'],['U:F0','U:F1'],['U:F1','U:F2'],['U:F2','U:F3'],['U:F3','U:F4'],
  ['U:A5','U:R1'],['U:R1','U:F4'],['U:F2','U:TX'],['U:F4','U:SL'],
  ['D:B0','D:B1'],['D:B1','D:B2'],['D:B2','D:B3'],['D:B3','D:SX'],['D:SX','D:B4'],['D:F0','D:F1'],['D:F1','D:F2'],['D:F2','D:F3'],['D:F3','D:F4'],
  ['D:SX','D:R1'],['D:R1','D:F4'],['D:B0','D:TB'],['D:B2','D:M'],['D:M','D:F2'],['D:F4','D:FS'],['D:R1','D:FS']];
const RIDES = [{a:'U:SL', b:'D:SX', kind:'slide', cost:3}, {a:'D:TB', b:'U:TX', kind:'tube', cost:3}];
for (const k of Object.keys(NODES)) ADJ[k] = [];
const nd = (a,b) => Math.hypot(NODES[a].x - NODES[b].x, NODES[a].z - NODES[b].z);
for (const [a,b] of EDGES){ ADJ[a].push({to:b, cost:nd(a,b)}); ADJ[b].push({to:a, cost:nd(a,b)}); }
for (const r of RIDES) ADJ[r.a].push({to:r.b, cost:r.cost, ride:r.kind});

function SP(f, x, z, yaw, nodeName, o = {}){ const F = FL[f]; const s = Object.assign({}, o); s.f = f; s.x = x + F.ox; s.z = z + F.oz; s.y = F.oy; s.yaw = yaw;
  s.node = (f === 'up' ? 'U:' : 'D:') + nodeName; s.via = (o.via || []).map(p => [p[0] + F.ox, p[1] + F.oz]); return s; }
/* every robot's own place (CONTRACT v3 def.floor: up = Intelligence, down = Execution). The scene owns these, so a v27 page
 * that still sends the old floors seats the robots the same way. */
const DESK = {
  'code':            SP('down', .25, -.3, 0, 'B3', {work:'type'}),                                   // the dispatch table, at its head
  'king':            SP('down', 1.2, -.3, 0, 'B3', {work:'type'}),                                   // ... beside the King
  'builder':         SP('down', -2.9, -.2, 0, 'B1', {work:'type'}),                                  // the build bench
  'engine-mechanic': SP('down', -1.8, -.2, 0, 'B2', {work:'type'}),
  'designer':        SP('down', -3.1, 1.93, 0, 'F0', {work:'type'}),                                 // the design studio
  'chat-reader':     SP('down', 2.6, -3.0, 0, 'B4', {via:[[2.1,-1.9],[2.1,-3.0]], work:'read'}),     // the comms corner
  'cowork':          SP('down', 3.9, -3.05, 0, 'B4', {via:[[3.1,-1.9],[3.1,-3.05]], work:'type'}),
  'hub-keeper':      SP('up', .2, -3.05, 0, 'A2', {via:[[-.95,-1.35],[-.95,-3.05]], work:'read'}),   // the experiment table
  'qa-tester':       SP('up', 1.3, .05, 0, 'A3', {work:'read'}),                                     // the QA bench
  'storm-watch':     SP('up', 2.95, -2.95, 0, 'A4', {via:[[2.12,-1.35],[2.12,-2.95]], work:'radar'}) // the radar, by the glass
};
const BOARD_AT = [-FX, -.35];
const POOL = {
  standup: [[-3.2,-.3],[-3.45,-1.05],[-3.45,.45],[-3.9,-1.7],[-3.95,1.1]].map(([x,z]) => SP('up', x, z, face(x, z, ...BOARD_AT), z < -.6 ? 'A0' : 'L1', {})),
  front:   LINE.map(([x, z], i) => SP('down', x, z, face(x, z, FIG.x, FIG.z), i < 2 ? 'FS' : i < 4 ? 'F4' : 'F3', {slot:i})),
  coffee:  [SP('down', -1.75, 2.35, 0, 'F1'), SP('down', -1.1, 2.35, 0, 'F2'), SP('down', -.45, 2.35, 0, 'F2')],
  lounge:  [SP('down', 3.45, -.6, -Math.PI/2, 'R1', {sofa:true}), SP('down', 3.45, .45, -Math.PI/2, 'R1', {sofa:true}),
            SP('down', 2.45, 1.05, face(2.45, 1.05, 2.95, -.1), 'R1'), SP('down', 2.3, -.95, face(2.3, -.95, 2.95, -.1), 'B4'),
            SP('down', -3.85, .5, -Math.PI/2 + .3, 'F0'),                                            // admiring the trophy wall
            SP('up', -3.75, 2.6, 1.05, 'F0', {seat:true}), SP('up', 3.9, 1.2, -.9, 'R1')],           // the reading chair; by the rail
  pod:     PODS.map(p => SP('down', p.x, p.z, 0, p.x < -2.4 ? 'B0' : 'B1')),
  rack:    [SP('up', 2.45, .05, 0, 'A4', {work:'read'})],                                            // queued at the QA queue rack
  rail:    [SP('up', 2.7, 2.95, .2, 'F3', {rail:true})],                                             // Storm Watch on hail: at the glass rail
  'spare-up':   [SP('up', -2.1, -3.0, 0, 'A0', {via:[[-2.7,-1.4],[-2.75,-3.0]], work:'type', hot:'~hot-up'})],
  'spare-down': [SP('down', -.25, -2.55, 0, 'B2', {work:'type'})]
};
POOL.huddle = POOL.lounge.slice(0, 4);   // the huddle (blueprint 5.2): a helper -> helper talk on the sofa (v28.1 plays it)

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
  if (key === 'front'){ const i = lineOrder().indexOf(sim.id); if (i >= 0 && i < 5){ release(sim); sim.slot = i; return POOL.front[i]; } sim.slot = -1; return claim(sim, 'lounge'); }
  if (key === 'standup' || key === 'board') return claim(sim, 'standup') || deskFor(sim, a);
  if (key === 'rack' || key === 'rail') return claim(sim, key) || deskFor(sim, a);
  return null;
}
/* CONTRACT v3 HUB.now: one RIGHT NOW row per robot; rows[i].step (the resolved verb) picks the work animation, so the list and
 * the room never disagree. Missing rows: agent.step, then the v27 work pose. Unknown verbs fall back to the v27 work pose. */
const NOWC = {ref:null, v:undefined, map:{}};
function nowRow(id){ const n = HUB.now; if (!n || !Array.isArray(n.rows)) return null;
  if (n !== NOWC.ref || n.v !== NOWC.v){ NOWC.ref = n; NOWC.v = n.v; NOWC.map = {}; for (const r of n.rows) if (r && typeof r.id === 'string') NOWC.map[r.id] = r; }
  return NOWC.map[id] || null; }
const STEP = {building:'type', fixing:'type', tuning:'type', writing:'type', publishing:'type', filing:'type', running:'type', relaying:'type', handing:'type',
  designing:'pin', pinning:'pin', dispatching:'slide-card', reviewing:'slide-card', planning:'plan', reading:'read', briefing:'read', researching:'read',
  scanning:'read', 'storm-ops':'read', testing:'stamp', investigating:'stamp', verified:'stamp', failed:'stamp', watching:'radar', hail:'hail', shipped:'shipped'};
const OWN = {pin:'designer', stamp:'qa-tester', 'slide-card':'code'};      // these need their prop: the easel, the stamp, the dispatch cards
function stepOf(a){ const r = nowRow(a.id); return r && typeof r.step === 'string' ? r.step : typeof a.step === 'string' ? a.step : ''; }
function planFor(a){                                                         // a working robot's {spot, pose, cheer}, or null = the v27 pose
  const p = STEP[stepOf(a)]; if (!p) return null;
  if (OWN[p]) return {pose:OWN[p] === a.id ? p : 'type'};
  if (p === 'radar') return a.id === 'storm-watch' ? {pose:'radar'} : null;
  if (p === 'hail') return a.id === 'storm-watch' ? {spot:'rail', pose:'radar'} : null;
  if (p === 'plan') return a.id === 'code' ? {spot:'board', pose:'meet'} : {pose:'type'};
  if (p === 'shipped') return {cheer:true};
  return {pose:p};
}
const planKey = p => p ? (p.spot || '') + ':' + (p.pose || '') + (p.cheer ? '!' : '') : '';
/* the state the room acts out: the agent's st, plus queued (CONTRACT v3: a handoff to it not picked up, or its task holds) */
function estOf(a){ const r = nowRow(a.id), q = r ? r.st7 === 'queued' : !!a.queued;
  return q && a.st !== 'waiting' && a.st !== 'blocked' && a.st !== 'sleeping' ? 'queued' : a.st; }
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
    if (!step.posed){ step.posed = true; sim.pose = resolvePose(sim, step); sim.poseT = 0; if (sim.spot) sim.yaw = sim.spot.yaw; }
    if (step.dur && sim.poseT < step.dur) return;
    sim.queue.shift();
  }
}
function workPose(sim, spot){ if (sim.stepPose && spot === DESK[sim.id]) return sim.stepPose; const w = spot && spot.work; return w === 'radar' ? 'radar' : w === 'read' ? 'read' : 'type'; }
function applyState(sim, a, instant){
  const st = sim.est || a.st, q = [], plan = st === 'working' ? sim.plan : null;
  sim.stepPose = plan && plan.pose && !plan.spot ? plan.pose : null;
  if (st === 'working'){ if (a.spot === 'standup') q.push({spot:'standup', pose:'meet'});
    else if (plan && plan.spot) q.push({spot:plan.spot, pose:plan.pose || 'work'});
    else { if (plan && plan.cheer) q.push({spot:'desk', pose:'cheer', dur:2.4}); q.push({spot:'desk', pose:'work'}); } }
  else if (st === 'queued') q.push({spot:a.id === 'qa-tester' ? 'rack' : 'desk', pose:'hold'});   // queued: at the QA queue rack, or its own desk
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
  sim.tiptoe = sim.moving && !sim.ride && zonePrev.some(z => z !== sim && z.floor === sim.floor && Math.hypot(z.x - sim.x, z.z - sim.z) < 1.2);   // passers tiptoe past a robot in the zone
  if (sim.moving){
    const L = sim.legs[sim.li];
    if (L.kind === 'walk'){
      const k = 38, damp = 2*Math.sqrt(k)*0.95, n = Math.ceil(dt/0.012), h = dt/n; let c = pointAt(L, sim.s);
      for (let i = 0; i < n; i++){
        const left = L.len - sim.s;
        const vmax = sim.tiptoe ? 1.1 : 1.9; sim.v = Math.min(vmax, sim.v + 2.6*h, Math.sqrt(2*1.9*Math.max(0,left)) + 0.05);
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
    sim.turnD = d; const turn = d * Math.min(1, dt*3.2); sim.yawDraw += turn;   // the head leads (dt x 4-5), the body follows
    sim.bank += ((sim.moving ? Math.max(-.22, Math.min(.22, -turn/Math.max(dt,1e-3)*0.05)) : 0) - sim.bank) * Math.min(1, dt*6);
    sim.pitch += ((sim.moving ? Math.min(.14, sp*0.07) : 0) - sim.pitch) * Math.min(1, dt*5);
  }
  stepQueue(sim, a);
  // idle life: drift between lounge + coffee spots on the same floor every so often
  if (!sim.moving && !sim.queue.length && ((sim.est || a.st) === 'idle' || (sim.est || a.st) === 'done') && !RM.matches){
    if (!sim.wanderAt) sim.wanderAt = sim.poseT + 9 + Math.random()*7;
    else if (sim.poseT > sim.wanderAt){ sim.wanderAt = 0; sim.queue = [{spot:'wander', pose:'lounge', dyn:true}]; }
  }
  if (sim.blinkT > 0) sim.blinkT -= dt; else if ((sim.blinkAt -= dt) <= 0){ sim.blinkT = 0.13; sim.blinkAt = 2.4 + Math.random()*4; }
}
function syncAgent(a, i){
  const sim = simFor(a, i);
  if (a.hidden){ if (!sim.hidden){ sim.hidden = true; release(sim); sim.seq = undefined; } return sim; }
  if (sim.hidden){ sim.hidden = false; }
  // v28: re-plan on a new seq, or when the RIGHT NOW row changes what the room should show (a new step, queued on/off)
  const est = estOf(a), plan = est === 'working' && a.spot !== 'standup' ? planFor(a) : null, pk = est + '|' + planKey(plan);
  if (sim.seq !== a.seq || sim.pk !== pk){
    const first = sim.seq === undefined, seqCh = sim.seq !== a.seq; sim.seq = a.seq; sim.pk = pk; sim.est = est; sim.plan = plan; sim.stepId = stepOf(a);
    if (est === 'done' && (seqCh || first)) sim.doneAt = first ? -1e9 : performance.now();
    if (seqCh && !first && !RM.matches && (a.st === 'done' || a.st === 'waiting'))   // the others glance: eyes first, then heads
      for (const o of Object.values(sims)) if (o !== sim && !o.hidden) o.glance = {id:a.id, t:0, dur:2.6, head:.18 + Math.random()*.25};
    if (sim.ride){ sim.pending = true; }
    else applyState(sim, a, first || !!a.instant && first);
  } else sim.stepId = stepOf(a);
  return sim;
}

/* ================= theme (CONTRACT v2 + v3 HUB.theme): the status colors; re-read only when theme.v changes =================
 * v3 (blueprint 3.1): stuck moves darker (#d9483b, tritan-safe vs ember), done = verdigris, queue = stone, intel = the Intelligence
 * floor's accent (never a status). Color is held back for needs / stuck / done; working is champagne, "normal, not a signal". */
const THEME_DEF = {work:'#f1c48a', idle:'#cdb896', need:'#f5883a', stuck:'#d9483b', sleep:'#3a3632', jewel:'#c9a45c', done:'#3fbf94', queue:'#cdb896', intel:'#6cb8ec'};
const TH = {v:undefined, mode:'ember-only', silent:new THREE.Color(0x6d6a66)};
for (const k of Object.keys(THEME_DEF)) TH[k] = new THREE.Color(THEME_DEF[k]);
function readTheme(){
  const t = HUB.theme, v = t ? t.v : null; if (v === TH.v) return false; TH.v = v;
  for (const k of Object.keys(THEME_DEF)){ const c = t && typeof t[k] === 'string' && /^#[0-9a-f]{6}$/i.test(t[k]) ? t[k] : THEME_DEF[k]; TH[k].set(c); }
  TH.mode = t && t.stripMode === 'brand' ? 'brand' : 'ember-only';
  TONE.need = '#' + TH.need.getHexString(); TONE.orange = '#' + TH.work.getHexString(); TONE.red = '#' + TH.stuck.getHexString(); TONE.done = '#' + TH.done.getHexString();
  MAT.intel.color.copy(TH.intel); for (const f of ['up', 'down']) if (andons[f]) andons[f].dirty = true;
  return true;
}
/* the 7-state class the room shows (blueprint 3.1): needs > stuck > silent > done (6 s) > working > queued > idle; asleep by pose */
const DONE_MS = 6000;
function statusOf(a, sim){
  if (sim.pose === 'sleep') return 'asleep';
  const st = sim.est || a.st;
  if (st === 'waiting') return 'needs'; if (st === 'blocked') return 'stuck'; if (a.silent) return 'silent';
  if (sim.pose === 'cheer' || st === 'done' && sim.doneAt != null && performance.now() - sim.doneAt < DONE_MS) return 'done';
  return st === 'working' ? 'working' : st === 'queued' ? 'queued' : 'idle';
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
  strip: new THREE.TorusGeometry(.2145,.0095,6,64),
  halo: new THREE.TorusGeometry(.216,.03,6,64),
  hand: new THREE.SphereGeometry(.044, 14, 10),
  neck: new THREE.CylinderGeometry(.055,.07,.07,24),
  ears: mergeGeometries([-1,1].map(s => new THREE.CylinderGeometry(.038,.038,.018,20).rotateZ(Math.PI/2).translate(s*.193, 0, 0))),
  chase: new THREE.SphereGeometry(.02, 10, 8),
  pilot: new THREE.SphereGeometry(.009, 8, 6),
  ring: new THREE.RingGeometry(.36,.4,64), selRing: new THREE.RingGeometry(.385,.4,72),
  badge: new THREE.CircleGeometry(.03, 20),
  tablet: new RoundedBoxGeometry(.26,.012,.18,2,.006),
  cup: new THREE.CylinderGeometry(.035,.03,.065,16)
};
const HALF = (r, seg = 24) => new THREE.SphereGeometry(r, seg, 12, 0, Math.PI*2, 0, Math.PI/2);
const BRIM = (r, h = .014, seg = 36) => new THREE.CylinderGeometry(r, r, h, seg);
const PEAK = (r) => new THREE.CylinderGeometry(r, r, .012, 24, 1, false, -Math.PI/2, Math.PI);
/* wardrobe v2 lives in hub/outfits.js; this is the kit it builds with */
const KIT = {THREE, MAT, part, bake, tex, redraw, HALF, BRIM, PEAK, PHONE, glowTex, bodyPts, TH, HUB, RM};
initOutfits(KIT);
const robots = {};
function makeRobot(a){
  const def = a.def || {}, shell = (def.graphite ? MAT.graphite : MAT.ceramic).clone(), cast = false;   // own shell copy: a silent robot dims; v28: robots never cast into the shadow map (the blob is their shadow)
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
  const E = makeEyes(THREE); E.mesh.position.set(0, -.002, .1655); head.add(E.mesh);   // hub/eyes.js: shapes act out the state
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
  const ring2 = new THREE.Mesh(G.selRing, ringMat.clone()); ring2.rotation.x = -Math.PI/2; ring2.position.y = .011; ring2.visible = false; root.add(ring2);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex, color:0xf5883a, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false})); glow.scale.set(1,.6,1); glow.position.y = .25; hov.add(glow);
  const pilot = new THREE.Mesh(G.pilot, new THREE.MeshBasicMaterial({color:0xc9a45c, transparent:true, opacity:0, toneMapped:false})); pilot.position.set(0, .25, .226); pilot.visible = false; hov.add(pilot);
  stripMat.color.copy(TH.idle); haloMat.color.copy(TH.idle);
  const R = robots[a.id] = {root, hov, head, body, strip, stripMat, halo, haloMat, chase, pilot, E, hands, tablet, cup, steam, shadow, ring, ring2, glow, h:.2,
    hl:[new THREE.Vector3(-.28,.32,.04), new THREE.Vector3(.28,.32,.04)], lastPose:'', hat:def.outfit && def.outfit !== 'headset' && def.outfit !== 'glasses' ? (def.outfit === 'crown' ? .17 : .12) : 0};
  R.shell = shell; R.shellC = shell.color.clone();
  R.zoneDecal = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .8), new THREE.MeshBasicMaterial({map:glowTex, color:0xffc38a, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false}));
  R.thought = new THREE.Sprite(new THREE.SpriteMaterial({map:thoughtTex.clone(), transparent:true, opacity:0, depthWrite:false, toneMapped:false})); R.thought.material.map.repeat.set(1/5, 1);
  R.thought.scale.setScalar(.2); R.thought.visible = false; R.thought.renderOrder = 9; root.add(R.thought);
  R.zoneDecal.rotation.x = -Math.PI/2; R.zoneDecal.position.set(0, .752, .62); R.zoneDecal.visible = false; root.add(R.zoneDecal);
  // polished-floor reflection (ART 6.4): a vertically stretched additive sprite under a downstairs robot
  R.refl = new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex, color:0xf1c48a, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false}));
  R.refl.center.set(.5, 1); R.refl.scale.set(.22, .75, 1); R.refl.position.y = .01; R.refl.renderOrder = 2; root.add(R.refl);
  // after hours (CONTRACT v2 HUB.afterHours): a small brass desk lamp + a cup for a robot still working at its desk
  const ah = new THREE.Group(), ak = new Map();
  part(ak, new THREE.CylinderGeometry(.045,.055,.015,14), MAT.brass, .34, .755, .6); part(ak, new THREE.CylinderGeometry(.005,.005,.26,6), MAT.brass, .34, .88, .6);
  part(ak, new THREE.ConeGeometry(.07, .08, 14, 1, true), MAT.brass, .34, 1.02, .6); part(ak, new THREE.SphereGeometry(.025, 10, 8), MAT.opal, .34, .99, .6);
  part(ak, new THREE.CylinderGeometry(.035,.03,.07,12), MAT.cream, -.3, .785, .56); bake(ak, ah, false); ah.visible = false; root.add(ah); R.after = ah;
  dress(KIT, a, R, def);
  return R;
}

/* gold leaf for "done" (ART 6.6): 24 flakes, a soft lift then a slow fall with sway, 1.6 s */
const bursts = [];
function burst(x, y, z, n = PHONE ? 16 : 24, life = 1.6){
  const pos = new Float32Array(n*3), colr = new Float32Array(n*3), vel = [];
  const pal = [[.95,.82,.55],[.79,.64,.36],[1,.93,.78]];
  for (let i=0;i<n;i++){ pos.set([x,y,z], i*3); colr.set(pal[i%3], i*3); const a = Math.random()*Math.PI*2, up = .9 + Math.random()*.9, sp = .25 + Math.random()*.55; vel.push([Math.cos(a)*sp, up, Math.sin(a)*sp, Math.random()*6]); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  const mat = new THREE.PointsMaterial({size:3.2*DPR, sizeAttenuation:false, vertexColors:true, transparent:true, opacity:1, depthWrite:false, toneMapped:false});
  const p = new THREE.Points(geo, mat); scene.add(p); bursts.push({p, vel, t:0, life});
}

/* handoffs: a manila envelope with a brass wax seal flies from the sender to the receiver, trailing brass */
const flights = [];
const folderG = (() => { const k = new Map();
  part(k, new THREE.BoxGeometry(.26, .01, .17), MAT.manila, 0, 0, 0);
  part(k, new THREE.ConeGeometry(.14, .085, 3).rotateX(Math.PI/2).rotateY(Math.PI).scale(1.05, .06, 1), MAT.manila, 0, .007, -.04);
  part(k, new THREE.CylinderGeometry(.022, .022, .008, 16), MAT.brass, 0, .012, .0); return k; })();
const trailMat = new THREE.SpriteMaterial({map:glowTex, color:0xc9a45c, transparent:true, opacity:.5, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false});
const cardG = (() => { const k = new Map(); part(k, new THREE.BoxGeometry(.12, .005, .17), new THREE.MeshBasicMaterial({color:0xe0685c, toneMapped:false}), 0, 0, 0); return k; })();
function spawnFolder(from, to, kind){
  const g = new THREE.Group(); bake(kind === 'card' ? cardG : folderG, g, false);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex, color:0xe3c98f, transparent:true, opacity:.5, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false})); glow.scale.setScalar(.4); g.add(glow);
  const trail = []; for (let i=0;i<8;i++){ const sp = new THREE.Sprite(trailMat); sp.scale.setScalar(.12 - i*.011); sp.visible = false; scene.add(sp); trail.push(sp); }
  scene.add(g); flights.push({g, glow, from, to, t:0, trail, hist:[]});
}
const headPos = (sim, out) => out.set(sim.x, sim.y + 1.5, sim.z);

/* ================= lights (ART 6.2): hemi + key + rim + 6 lamps + the call pool = 10, all made here, none at runtime ================= */
const hemi = new THREE.HemisphereLight(0x3a4468, 0x3a2a1f, .5); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xff9a5c, .5); sun.castShadow = true;           // the key: low sun at dusk, a cool moon at night
sun.shadow.mapSize.set(PHONE ? 1024 : 2048, PHONE ? 1024 : 2048);
Object.assign(sun.shadow.camera, {left:-10, right:10, top:10, bottom:-10, near:1, far:60});
sun.shadow.bias = -.0004; sun.shadow.normalBias = .02; scene.add(sun); scene.add(sun.target);
/* v28 shadow fit: the shadow box hugs the two floors' real footprint (walls, tube, lifted upper floor) in the light's own
 * frame, so the 2048 texels cover the room and nothing else; the bias grows as the light grazes (acne at 8 deg, no
 * peter-panning at noon). Runs only when the shadow map is redrawn. */
const SHADOW_PTS = [], SHV = new THREE.Vector3(), shadowEye = new THREE.Camera();   // a Camera looks down -Z, like the shadow camera
for (const f of ['down', 'up']){ const F = FL[f]; for (const x of [-FX, FX]) for (const z of [-FZ, FZ]) for (const y of [-.05, F.wall + .1]) SHADOW_PTS.push([x + F.ox, y, z + F.oz, f]); }
SHADOW_PTS.push([TUBE.x, TUBE.top + .2, TUBE.z, 'down']);
function fitShadow(el){
  const sc = sun.shadow.camera; shadowEye.position.copy(sun.position); shadowEye.lookAt(sun.target.position); shadowEye.updateMatrixWorld(true);
  const inv = shadowEye.matrixWorld.clone().invert(); let l = 1e9, r = -1e9, b = 1e9, t = -1e9, n = 1e9, fr = -1e9;
  for (const [x, y, z, f] of SHADOW_PTS){ const oy = f === 'up' ? gUp.position.y : 0; SHV.set(x, y + oy, z).applyMatrix4(inv);
    l = Math.min(l, SHV.x); r = Math.max(r, SHV.x); b = Math.min(b, SHV.y); t = Math.max(t, SHV.y); n = Math.min(n, -SHV.z); fr = Math.max(fr, -SHV.z); }
  const pad = .25; Object.assign(sc, {left:l - pad, right:r + pad, bottom:b - pad, top:t + pad, near:.5, far:fr + 1}); sc.updateProjectionMatrix();
  const g = 1 - Math.max(0, Math.min(1, (Math.sin(el) - Math.sin(8*Math.PI/180))/(Math.sin(50*Math.PI/180) - Math.sin(8*Math.PI/180))));   // 1 at a grazing 8 deg, 0 at 50 deg
  sun.shadow.normalBias = .018 + .027*g; sun.shadow.bias = -.0002 - .0003*g;
}
const rim = new THREE.DirectionalLight(0x9fb4ff, .3); rim.position.set(12, 9, -10); rim.target.position.set(-1.5, 1.5, -2); scene.add(rim); scene.add(rim.target);
const LAMPC = 0xffc38a;
const UPW = (x, y, z) => [x + FL.up.ox, y + FL.up.oy, z + FL.up.oz];
const LAMPS = [
  // v28: the linear pendant moved down over the dispatch table (the charging bay's downlight discs keep their glow on its halo list)
  {l:new THREE.PointLight(LAMPC, 16, 8, 2), p:[.7, 2.2, .45], k:16, halo:[[-.2,2.41,.32],[.7,2.41,.32],[1.6,2.41,.32],[-3.4,2.77,-2.5],[-1.5,2.77,-2.5],[-3.4,2.77,-1.6],[-1.5,2.77,-1.6]]},
  {l:new THREE.PointLight(LAMPC, 7, 5, 2),  p:UPW(1.0, 1.12, -2.45), k:7, up:true, halo:[UPW(1.0, 1.15, -2.62)]},       // upstairs: the experiment table's task lamp
  {l:new THREE.PointLight(LAMPC, 12, 7, 2), p:[3.4, 1.55, -.4], k:12, halo:[[3.4, 1.64, -.4]]},                         // downstairs: sofa arc lamp
  {l:new THREE.PointLight(LAMPC, 10, 7, 2), p:[-1.1, 1.7, 2.6], k:10, halo:[[-1.2, 1.84, 3.0, 1.45]]},                  // coffee bar pendants (one wide halo sprite: half the additive overdraw)
  {l:new THREE.PointLight(LAMPC, 8, 5, 2),  p:UPW(.7, 1.1, .62), k:8, up:true, halo:[UPW(.66, 1.15, .52)]}              // upstairs: the QA bench's task lamp (was the charging bay's light)
];
if (!PHONE) LAMPS.push({l:new THREE.PointLight(LAMPC, 6, 5, 2), p:UPW(-4.25, 1.45, 1.95), k:6, up:true, halo:[UPW(-4.25, 1.52, 1.95)]});   // the reading corner
// bloom without a composer: an additive sprite halo on every lamp fixture (ART 6.4)
const halos = [];
for (const L of LAMPS){ L.l.position.set(...L.p); scene.add(L.l);
  for (const h of L.halo){ const sp = new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex, color:0xffd9ae, transparent:true, opacity:.35, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false}));
    sp.scale.setScalar(L.k > 9 ? .7 : .5); if (h[3]) sp.scale.x = h[3]; sp.renderOrder = 8;
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
  blueprint:{built:true, el:1.5, az:0}, cctv:{built:true, persp:true}, window:{built:true, persp:true}, tilt:{built:true, el:.42}, tour:{built:true}, director:{built:true},
  eyes:{built:true, sel:true, persp:true}
};
/* perspective views (cctv, window, eyes) render through pcam; everything else is the orthographic cutaway */
const pcam = new THREE.PerspectiveCamera(60, 1, .05, 200);
let rcam = cam;
const TOUR = [['all', 5], ['up', 5], ['box', 5, [[-4.4,0,-2.2],[-2.2,2.4,1.6]], 'up'], ['box', 5, [[-2.2,0,-.2],[3,1.8,1.6]], 'up'], ['down', 5], ['box', 5, [[.8,0,1.4],[4.6,1.8,3.4]], 'down'], ['box', 5, [[-3.2,0,-.8],[-.6,1.8,2.2]], 'down']];
const tour = {i:0, t:0}, director = {mode:'all', id:null, t:0, hold:0, seen:{}};
const cctv = {i:0, t:0};
function boxPts(b, f){ const F = FL[f], out = []; for (const x of [b[0][0], b[1][0]]) for (const y of [b[0][1], b[1][1]]) for (const z of [b[0][2], b[1][2]]) out.push(new THREE.Vector3(x + F.ox, y + F.oy, z + F.oz)); return out; }
/* Director (8): cuts on real moments with a 400 ms settle: a finish -> that robot, a new question -> your spot, a ride -> its eyes */
function directorPick(dt){
  const d = director; d.t += dt; d.hold -= dt;
  for (const a of HUB.agents || []){ const sim = sims[a.id]; if (!sim || sim.hidden) continue; const prev = d.seen[a.id]; d.seen[a.id] = a.st + '|' + !!sim.ride;
    if (prev === undefined || prev === d.seen[a.id]) continue;
    if (sim.ride && d.hold < 2){ d.mode = 'eyes'; d.id = a.id; d.hold = sim.ride.kind === 'slide' ? 2.6 : 1.4; }
    else if (a.st === 'done'){ d.mode = 'follow'; d.id = a.id; d.hold = 5; }
    else if (a.st === 'waiting'){ d.mode = 'spot'; d.id = a.id; d.hold = 6; } }
  if (d.hold <= 0){ d.mode = 'all'; d.id = null; }
  if ((d.mode === 'follow' || d.mode === 'eyes') && (!sims[d.id] || sims[d.id].hidden)) d.mode = 'all';
  return d;
}
const builtViews = () => Object.keys(VIEWS).filter(k => VIEWS[k].built && k !== 'ride');
function camMode(){
  let m = HUB.cam, v = VIEWS[m];
  if (m === 'eyes' && RM.matches) m = 'follow', v = VIEWS.follow;          // reduced motion: no first-person ride
  if (!v) m = 'all'; else if (!v.built) m = v.fallback || 'all'; else if (v.as) m = v.as;
  if (VIEWS[m].sel){ const id = HUB.selected, sim = id && sims[id]; if (!sim || sim.hidden) return 'all'; }
  return m;
}
function wantRect(mode, id, extra){
  if (mode === 'spot') return fitRect(boxPts([[.6,0,1.2],[4.6,1.9,3.4]], 'down'), 140);
  if (mode === 'box') return fitRect(boxPts(extra[0], extra[1]), 160);
  if (mode === 'tilt'){ const f = (sims[HUB.selected] && sims[HUB.selected].floor) || 'up'; return fitRect(boxPts([[-3.2,0,-2.4],[3.2,1.4,2.4]], f), 150); }
  if (mode === 'follow'){ const sim = sims[id || HUB.selected]; const c = new THREE.Vector3(sim.x, sim.y + .7, sim.z);
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
  const top = camMode(), A = area();
  let mode = top, id = HUB.selected, extra = null;
  if (top === 'director' && !RM.matches){ const d = directorPick(dt); mode = d.mode; id = d.id; }
  else if (top === 'director') mode = 'all';
  if (top === 'tour'){ const T = TOUR[tour.i % TOUR.length]; if (!RM.matches){ tour.t += dt; if (tour.t > T[1]){ tour.t = 0; tour.i++; } } const T2 = TOUR[tour.i % TOUR.length]; mode = T2[0]; extra = T2.slice(2); }
  view.sub = mode; view.subId = id;
  const V_ = VIEWS[mode] || {};
  if (V_.persp){ rcam = pcam; view.mode = mode; perspCam(mode, id, dt); gUp.position.y = FL.up.oy; LIFT = 0; view.lift = 0; gUp.visible = true; tw.key = null; horizonFrom(pcam, dt); return; }
  rcam = cam;
  // orientation: the view's own elevation / azimuth (blueprint looks straight down, tilt sits low), glided with the rect
  const elT = V_.el ?? .6, azT = V_.az != null ? V_.az : view.azLive;
  const key = mode + '|' + (mode === 'follow' ? id : '') + '|' + (top === 'tour' ? tour.i : '') + '|' + Math.round(A.x0) + ',' + Math.round(A.y0) + ',' + Math.round(A.x1) + ',' + Math.round(A.y1);
  const cut = !view.rect || snap || RM.matches || CAPTURE;
  if (key !== tw.key){ if (!cut){ tw.from = Object.assign({}, view.rect, {el:view.el, az:view.azNow}); tw.t = 0; tw.dur = top === 'director' ? .4 : .75; } else tw.t = 1; tw.key = key; }
  if (cut || tw.t >= 1){ view.el = elT; view.azNow = azT; } else { const e = ease(Math.min(1, tw.t + dt/tw.dur)); view.el = tw.from.el + (elT - tw.from.el)*e; let da = azT - tw.from.az; da = Math.atan2(Math.sin(da), Math.cos(da)); view.azNow = tw.from.az + da*e; }
  aim(view.azNow);
  const want = wantRect(mode, id, extra);
  if (cut){ view.rect = Object.assign({}, want); tw.t = 1; }
  else if (tw.t < 1){ tw.t = Math.min(1, tw.t + dt/(tw.dur || .75)); const e = ease(tw.t); for (const k of RK) view.rect[k] = tw.from[k] + (want[k] - tw.from[k])*e; }
  else if (mode === 'follow'){ const k = 1 - Math.exp(-dt*5); for (const q of RK) view.rect[q] += (want[q] - view.rect[q])*k; }
  else view.rect = Object.assign({}, want);
  view.mode = mode; applyRect(view.rect);
  // Downstairs view: the upper floor lifts away (and hides) so nothing covers the lower floor
  const lw = mode === 'down' ? 1 : 0; view.lift = view.lift == null || snap || RM.matches || CAPTURE ? lw : view.lift + (lw - view.lift)*Math.min(1, dt*4.5);
  if (Math.abs(view.lift - lw) < .002) view.lift = lw;
  LIFT = view.lift*view.lift*(3 - 2*view.lift)*8; gUp.position.y = FL.up.oy + LIFT; gUp.visible = view.lift < .85;
  if (skyEl){ const f = mode === 'follow' ? (sims[id] ? sims[id].floor : 'all') : mode === 'box' ? extra[1] : mode; const hz = VC.copy(HZ[f] || HZ.all).project(cam); setHorizon((1 - hz.y)/2*100, dt); }
}
function setHorizon(pct, dt){ if (!skyEl) return; view.horizon = view.horizon == null || RM.matches ? pct : view.horizon + (pct - view.horizon)*Math.min(1, dt*3.2);
  const s = Math.max(8, Math.min(92, view.horizon)).toFixed(1) + '%'; if (s !== view.hs){ view.hs = s; skyEl.style.setProperty('--horizon', s); } }
function horizonFrom(c, dt){ const d = new THREE.Vector3(); c.getWorldDirection(d); d.y = 0; d.normalize().multiplyScalar(150).add(c.position); d.y = 0; d.project(c); setHorizon((1 - d.y)/2*100, dt); }
/* the perspective views */
const HEADV = new THREE.Vector3(), FWD = new THREE.Vector3();
function perspCam(mode, id, dt){
  pcam.aspect = W/H;
  if (mode === 'cctv'){               // Security cam: Cam 1 up / Cam 2 down, a new camera every 8 s; the page adds the timestamp + grain
    if (!RM.matches){ cctv.t += dt; if (cctv.t > 8){ cctv.t = 0; cctv.i++; } }
    const up = cctv.i % 2 === 0, F = FL[up ? 'up' : 'down'];
    pcam.fov = 72; pcam.position.set(F.ox + FX - .25, F.oy + (up ? 2.25 : 2.55), F.oz - FZ + .3); pcam.lookAt(F.ox - .6, F.oy + .2, F.oz + 1.2);
  } else if (mode === 'window'){      // Through the window: outside the upper glass, looking in at the Code lab
    const F = FL.up, sway = RM.matches ? 0 : Math.sin(performance.now()/1000*.12)*.6;
    pcam.fov = 42; pcam.position.set(F.ox + .4 + sway, F.oy + 1.45, F.oz - FZ - 3.4); pcam.lookAt(F.ox + .2, F.oy + .85, F.oz + .9);
  } else {                            // Robot eyes (key 9): from the visor, fov 70; the slide / tube ride in first person at fov 110
    const sim = sims[id], R = robots[id]; if (!sim || !R) return;
    const riding = !!sim.ride; pcam.fov = riding ? 110 : 70;
    HEADV.set(0, R.hov.position.y*1 + .82*1.24, 0); R.root.localToWorld(HEADV);
    const yaw = sim.yawDraw + R.head.rotation.y, pit = R.head.rotation.x*.8 + (riding ? .15 : .12);
    FWD.set(Math.sin(yaw)*Math.cos(pit), -Math.sin(pit), Math.cos(yaw)*Math.cos(pit));
    pcam.position.copy(HEADV).addScaledVector(FWD, .24); pcam.lookAt(VC.copy(pcam.position).add(FWD));
  }
  pcam.updateProjectionMatrix(); pcam.updateMatrixWorld();
}
function resize(){ W = stage.clientWidth || 1; H = stage.clientHeight || 1; renderer.setSize(W, H, false); view.azLive = AZ0 + view.drag; if (view.azNow == null) view.azNow = view.azLive; aim(view.azNow); updateCamera(0, true); }
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
const HOVER = {glide:.24, settle:.22, lounge:.2, type:.36, read:.34, radar:.3, meet:.24, wait:.5, blocked:.34, cheer:.36, coffee:.3, sleep:.035, ride:.14,
  stamp:.36, pin:.34, 'slide-card':.36, hold:.24};
const WORK_POSES = new Set(['type', 'read', 'radar', 'meet', 'stamp', 'pin', 'slide-card']);   // a robot at work (v28 adds the step poses)
const STEP_HANDS = new Set(['stamp', 'pin', 'slide-card']);
/* v28 step poses (CONTRACT v3 verbs): stamp = QA's verdict at the bench, pin = the Designer at the easel, slide-card = the King at the
 * dispatch table. The hands reach real points in the room (world -> the robot's hover space), so hand and prop meet. Reduced
 * motion: the final pose, no cycle. */
const WA = {v:new THREE.Vector3(), n:new THREE.Vector3()};
function toHov(R, p, out){ R.hov.updateWorldMatrix(true, false); return R.hov.worldToLocal(out.copy(p)); }
function stepHands(a, sim, R, pose, t, rm, L0, R0){
  const ph = sim.phase;
  if (pose === 'stamp'){                                                   // lift, slam, press, ease back; a tick on every press
    const per = 1.6, u = rm ? .55 : ((t + ph) % per)/per;
    const lift = u < .35 ? .15*ease(u/.35) : u < .48 ? .15*(1 - (u - .35)/.13) : u < .66 ? 0 : .04*ease((u - .66)/.34);
    const P0 = gUp.localToWorld(WA.v.set(1.6, .765, .6)); P0.y += .13 + lift; toHov(R, P0, R0);
    P0.set(1.76, .79, .5); gUp.localToWorld(P0); toHov(R, P0, L0);             // the other hand steadies the clipboard
    if (qa.stamp.parent !== R.hands[1]){ R.hands[1].add(qa.stamp); qa.stamp.position.set(0, -.13/1.24, 0); qa.stamp.rotation.set(0, 0, 0); qa.stamp.scale.setScalar(1/1.24); }
    const step = sim.stepId;
    if (rm){ if (qa.rmKey !== step){ qa.rmKey = step; qa.n = 8; qa.fail = step === 'failed'; redraw(qaT); } }
    else if (R.lastU != null && R.lastU < .48 && u >= .48){ qa.n = qa.n % 8 + 1; qa.fail = step === 'failed'; redraw(qaT); R.thump = .12; }
    R.lastU = u; return true;
  }
  if (pose === 'pin'){                                                     // reach to the board, press a pin, hold, back; three spots in turn
    const per = 2.4, u = rm ? .5 : ((t + ph) % per)/per, i = rm ? 0 : Math.floor((t + ph)/per) % 3, off = [[-.1,.1],[.1,-.02],[-.03,-.15]][i];
    const P0 = easel.g.localToWorld(WA.v.set(easel.pin.x + off[0], easel.pin.y + off[1], easel.pin.z)), N = WA.n.set(Math.sin(easel.yaw), 0, Math.cos(easel.yaw));
    const out = u < .3 ? .14*(1 - ease(u/.3)) : u < .42 ? 0 : u < .72 ? .012 : .14*ease((u - .72)/.28);
    P0.addScaledVector(N, .035 + out); toHov(R, P0, L0); R0.set(.12, .56, .24);   // the other hand holds a swatch card
    return true;
  }
  if (pose === 'slide-card'){                                              // hand onto the card, slide it a column over, lift, rest
    const per = 3.2, cyc = rm ? 0 : Math.floor((t + ph)/per), u = rm ? .4 : ((t + ph) % per)/per, from = cyc % 2 ? dispatch.cardB : dispatch.cardA, to = cyc % 2 ? dispatch.cardA : dispatch.cardB;
    const k = u < .15 ? 0 : u < .5 ? ease((u - .15)/.35) : 1; dispatch.card.position.lerpVectors(from, to, k); dispatch.card.rotation.y = Math.sin(k*Math.PI)*.12;
    const hover = u < .15 ? .1*(1 - u/.15) : u < .5 ? 0 : u < .62 ? .1*(u - .5)/.12 : .1;
    if (u < .75){ WA.v.copy(dispatch.card.position); WA.v.y += .035 + hover; toHov(R, WA.v, R0); } else R0.set(.12, .5, .3);
    L0.set(-.12, .5, .3); return true;
  }
  return false;
}
const lerp = (a,b,t) => a + (b-a)*t;
const DIM = new THREE.Color(0x8a6f4a), EYE = new THREE.Color(0xfff2e0), EYE_DIM = new THREE.Color(0x3a3f55), EYE_RED = new THREE.Color(0xffc7bd), GOLD = new THREE.Color(0xead1a0), SLEEPC = new THREE.Color(0x8e95ab), CHAMP = new THREE.Color(0xf1c48a), BRASSC = new THREE.Color(0xc9a45c);
const cTmp = new THREE.Color(), QDIM = new THREE.Color(0x1a1816);
const HAND_PROP_POSES = new Set(['glide','settle','lounge','wait','meet','ride','idle']);
/* thought icons over working robots, from the words in agent.doing: hail cloud, bug, paintbrush, wrench, book */
const thoughtTex = tex(320, 64, (g, w, h) => { g.clearRect(0,0,w,h); g.strokeStyle = '#f1f2f4'; g.fillStyle = '#f1f2f4'; g.lineWidth = 3.2; g.lineCap = g.lineJoin = 'round';
  const bub = x => { g.save(); g.fillStyle = 'rgba(17,18,20,.72)'; g.beginPath(); g.arc(x + 32, 30, 27, 0, Math.PI*2); g.fill(); g.restore(); };
  for (let i=0;i<5;i++) bub(i*64);
  g.beginPath(); g.arc(22, 30, 8, Math.PI*.5, Math.PI*1.5); g.arc(32, 22, 10, Math.PI, 0); g.arc(43, 30, 8, -Math.PI*.5, Math.PI*.5); g.closePath(); g.stroke();   // cloud
  for (const [x, y] of [[24,46],[32,49],[40,46]]){ g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI*2); g.fill(); }                                                   // hail
  g.beginPath(); g.ellipse(96, 32, 9, 12, 0, 0, Math.PI*2); g.stroke(); g.beginPath(); g.moveTo(96, 20); g.lineTo(96, 44); for (const s_ of [-1,1]) for (const y of [26,33,40]){ g.moveTo(96 + s_*9, y); g.lineTo(96 + s_*16, y - 3); } g.stroke();   // bug
  g.beginPath(); g.moveTo(150, 16); g.lineTo(166, 40); g.stroke(); g.beginPath(); g.ellipse(168, 44, 5, 8, -.6, 0, Math.PI*2); g.fill();                     // brush
  g.beginPath(); g.moveTo(212, 44); g.lineTo(228, 24); g.stroke(); g.beginPath(); g.arc(231, 20, 7, Math.PI*.2, Math.PI*1.7); g.stroke();                        // wrench
  g.beginPath(); g.moveTo(272, 20); g.lineTo(288, 24); g.lineTo(304, 20); g.lineTo(304, 42); g.lineTo(288, 46); g.lineTo(272, 42); g.closePath(); g.moveTo(288, 24); g.lineTo(288, 46); g.stroke(); });   // book
const THOUGHT = [/hail|storm|granizo|tormenta|radar|weather/i, /bug|fix|error|test|qa\b|gate|check|prueba/i, /design|color|colour|layout|css|font|look|diseñ|icon/i, /engine|build|code|script|deploy|publish|motor|page|refactor/i, /research|read|doc|learn|study|brief|investig|lee/i];
function thoughtOf(a){ const d = String(a.doing || ''); if (!d) return -1; for (let i=0;i<THOUGHT.length;i++) if (THOUGHT[i].test(d)) return i; return -1; }
const rollcall = {t:-1};
const CUE = {}, CUE_LATE = {};
CUE_LATE.arrive = () => { if (!RM.matches) rollcall.t = 0; };
CUE_LATE.poke = (c) => { const sim = c.id && sims[c.id], R = robots[c.id]; if (!sim || !R) return; if (!RM.matches){ sim.poke = 0; if (!sim.moving && HUB.byId[c.id] && HUB.byId[c.id].st !== 'working'){ R.hab = {t:0}; } } };
CUE_LATE.coffee = (c) => { const sim = c.id && sims[c.id]; if (sim) sim.perk = RM.matches ? 3.9 : 0; };
function lineOrder(){ const H = HUB, ag = H.agents || []; if (lineOrder.f === frameNo) return lineOrder.v; lineOrder.f = frameNo;
  let ids = H.needs && Array.isArray(H.needs.ids) ? H.needs.ids.filter(id => H.byId && H.byId[id] && H.byId[id].st === 'waiting') : ag.filter(a => a.st === 'waiting').sort((p, q) => (p.since || 0) - (q.since || 0)).map(a => a.id);
  for (const a of ag) if (a.st === 'waiting' && !ids.includes(a.id)) ids.push(a.id);
  return (lineOrder.v = ids); }
function fmtWait(ms){ const m = Math.max(0, Math.floor(ms/60e3)), h = Math.floor(m/60); return h ? h + ' h ' + (m % 60) + ' min' : m + ' min'; }
let frameNo = 0;
const SEATN = {code:1, king:2, builder:3, designer:4, 'engine-mechanic':5, 'qa-tester':6, 'hub-keeper':7, cowork:8, 'storm-watch':9, 'chat-reader':10};
const V3 = new THREE.Vector3(), V2d = new THREE.Vector2(), SCR_W = new THREE.Color(0xffffff), SCR_DIM = new THREE.Color(0xb8a89a);
let zoneNow = [], zonePrev = [];
function fremontMin(){ const n = Date.now(); if (fremontMin.at && n - fremontMin.at < 20e3) return fremontMin.v; fremontMin.at = n;
  try { const p = new Intl.DateTimeFormat('en-US', {timeZone:'America/Chicago', hour:'numeric', minute:'numeric', hour12:false}).formatToParts(new Date()); fremontMin.v = (+p.find(x => x.type === 'hour').value % 24)*60 + +p.find(x => x.type === 'minute').value; }
  catch(e){ const d = new Date(); fremontMin.v = d.getHours()*60 + d.getMinutes(); } return fremontMin.v; }
/* one idle habit per robot at full amplitude, every 12-20 s while it idles; Storm Watch yawns at 6:54 (its real run) */
const HB = {L:new THREE.Vector3(), R:new THREE.Vector3(), look:new THREE.Vector3()};
function stepHabit(a, sim, R, S, dt){
  if (RM.matches || sim.moving) { R.hab = null; R.habitSwish = 0; return null; }
  const m = fremontMin();
  if (a.id === 'storm-watch' && m >= 414 && m <= 416 && S !== 'sleep'){ const k = Math.sin(((performance.now()/1000) % 4)/4*Math.PI);
    return {hp:-.45*k, eyes:'sleep', open:1, L:HB.L.set(-.3, .5 + .4*k, 0), R:HB.R.set(.3, .5 + .4*k, 0)}; }
  if (S !== 'idle' || sim.pose === 'glide'){ R.hab = null; R.habitSwish = 0; return null; }
  if (!R.hab){ R.habAt = (R.habAt || 0) + dt; if (R.habAt < 12 + (SEATN[a.id] || 0)*.8) return null; R.habAt = 0; R.hab = {t:0}; }
  const h = R.hab; h.t += dt; const k = Math.sin(Math.min(1, h.t/2.6)*Math.PI); if (h.t > 2.6){ R.hab = null; R.habitSwish = 0; return null; }
  switch (a.id){
    case 'code': R.habitSwish = Math.sin(h.t*6)*.45*k; return {hy:.3*k};                                           // the King's cape swish
    case 'king': return {R:HB.R.set(.22, .88, 0), hy:.25*k};                                                         // a hand to the headset
    case 'builder': return {R:HB.R.set(.12, 1.05 + Math.max(0, Math.sin(h.t*10))*.03*k, .05)};                     // taps the hard hat
    case 'designer': return {hy:-.7*k, eyes:'blocked', look:HB.look.set(-.8*k, .1, 0)};                              // squints at the board
    case 'engine-mechanic': if (R.prop) R.prop.rotation.y = h.t/2.6*Math.PI*2; return {L:HB.L.set(-.24, .5, .12)};  // twirls the spanner
    case 'qa-tester': return {L:HB.L.set(-.08, .62, .28), hp:.3*k, look:HB.look.set(0, -.6, 0)};                   // re-checks its clipboard
    case 'hub-keeper': return {L:HB.L.set(-.08, .95, .26), hp:-.05};                                                 // lens to the eye
    case 'cowork': return {R:HB.R.set(.14, 1.02, .16), hy:-.4*k};                                                    // shades its eyes, scans the horizon
    case 'storm-watch': return {hp:-.35*k, look:HB.look.set(0, .8, 0)};                                              // checks the sky
    case 'chat-reader': if (R.prop) R.prop.rotation.z = Math.sin(h.t*5)*.4*k; return {L:HB.L.set(-.12, .62, .26)};  // flips the paper
  }
  return null;
}
function animRobot(a, sim, R, t, dt){
  const rm = RM.matches, pose = sim.pose, pt = sim.poseT, ph = sim.phase;
  if (pose !== R.lastPose){ R.lastPose = pose; if (pose === 'cheer' && !rm) burst(sim.x, sim.y + 1.35, sim.z); }
  const up = sim.floor === 'up' && !sim.ride ? LIFT : 0;
  R.root.position.set(sim.x, sim.y + up, sim.z); R.root.visible = !sim.hidden && !(up && !gUp.visible);
  let spin = 0; if (pose === 'cheer' && !rm){ const k = Math.min(1, pt/1.1); spin = (1 - Math.pow(1-k, 3)) * Math.PI*2; }
  R.poseYaw = lerp(R.poseYaw || 0, pose === 'pin' && !sim.moving ? -.45 : 0, rm ? 1 : Math.min(1, dt*4));   // the Designer turns to its easel
  R.root.rotation.y = sim.yawDraw + spin + R.poseYaw;
  // a silent robot (the run watchdog): the shell dims slightly
  R.shell.color.lerp(a.silent ? cTmp.copy(R.shellC).multiplyScalar(.7) : R.shellC, Math.min(1, dt*3));
  // the thank-you bow (Special Delivery): 400 ms forward and back
  // the thank-you (Special Delivery), in the outfit's own way: bow + cape sweep, salute, cap tip, glasses push, hard-hat tap
  let bowX = 0, thank = null; const oft = a.def && a.def.outfit;
  if (sim.bow != null){ sim.bow += dt; const k = sim.bow/1.1; if (k >= 1) sim.bow = null; else { const e = Math.sin(k*Math.PI);
    if (oft === 'captain') thank = {R:[.14, 1.02, .16]}; else if (oft === 'glasses') thank = {R:[.07, .96, .22]}; else if (oft === 'hardhat') thank = {R:[.1, 1.06 + Math.max(0, Math.sin(k*20))*.02, .06]};
    else if (oft === 'newsboy'){ thank = {R:[.12, 1.05, .14]}; bowX = e*.18; } else { bowX = e*.42; if (oft === 'crown') R.habitSwish = e*.5; } } }
  // poke (the page shows the line) and coffee (perks up)
  if (sim.poke != null){ sim.poke += dt; if (sim.poke > 1.6) sim.poke = null; }
  if (sim.perk != null){ sim.perk += dt; if (sim.perk > 4) sim.perk = null; }
  // the line: posture ages with the wait (alert, settled, seated reading, dozing upright)
  const inLine = pose === 'wait', qAge = a.since ? (Date.now() - a.since)/60e3 : 0, qStage = !inLine ? -1 : qAge < 10 ? 0 : qAge < 60 ? 1 : qAge < 240 ? 2 : 3;
  const seat = sim.spot && sim.spot.seat && !sim.moving ? .2 : 0;
  const S = stateOf(a, sim), seatN = SEATN[a.id] ?? 0;
  // in the zone (FUN 3): 45 min of unbroken work -> lean in 8 deg, the chase runs 1.5x, a warm pool on the desk
  const zone = a.st === 'working' && a.since && Date.now() - a.since > 45*60e3 && WORK_POSES.has(pose) && pose !== 'meet' && !sim.moving;
  R.zone = zone ? 1.5 : 1; if (zone) zoneNow.push(sim);
  R.zoneK = lerp(R.zoneK || 0, zone ? 1 : 0, Math.min(1, dt*2)); R.zoneDecal.visible = R.zoneK > .02; R.zoneDecal.material.opacity = .2*R.zoneK;
  // blocked, acted out: try, recoil, sigh, tap the visor, try again; the cycle slows from 6 s to 20 s as the block ages
  const bAge = a.since ? (Date.now() - a.since)/3600e3 : 0, bCyc = 6 + 14*Math.min(1, bAge/3), bf = pose === 'blocked' && !rm ? ((t + ph)/bCyc) % 1 : -1;
  const sigh = bf > .4 && bf < .65 ? Math.sin((bf - .4)/.25*Math.PI) : 0;
  const lift = (qStage > 0 ? [0, -.16, -.26, -.28][qStage] : 0) + (sim.perk != null ? .05 : 0) + (HUB.hover === a.id ? .03 : 0) + (S === 'idle' && HUB.watching ? .02 : 0) + (sim.poke != null ? Math.abs(Math.sin(sim.poke*6))*.06*Math.max(0, 1 - sim.poke) : 0);
  R.h = lerp(R.h, (HOVER[pose] ?? .22) + seat + lift - sigh*.03 - (sim.tiptoe ? .06 : 0), Math.min(1, dt*(pose === 'ride' ? 10 : pose === 'sleep' ? 1.2 : 3)));
  // breathing: +-6 mm on a 4.2 s sine (6 s asleep), phase by seat so no two robots breathe together
  const bob = rm ? 0 : Math.sin(t*2*Math.PI/(pose === 'sleep' ? 6 : 4.2) + seatN*1.37)*.006;
  let jump = (pose === 'cheer' && !rm) ? Math.abs(Math.sin(pt*5.2)) * .2 * Math.max(0, 1 - pt/2.2) : 0;
  if (sim.hi5 != null){ sim.hi5 += dt; if (sim.hi5 > .7) sim.hi5 = null; else if (sim.hi5 > 0){ jump += Math.sin(sim.hi5/.7*Math.PI)*.22; } }
  R.thump = Math.max(0, (R.thump || 0) - dt); R.hov.position.y = R.h + bob + jump - R.thump*.1;   // v28: a small dip on each stamp press
  const wob = rm ? 0 : sim.wobble*sim.wobble;
  R.hov.rotation.z = sim.bank + Math.sin(t*19 + ph)*.2*wob; R.hov.rotation.x = sim.pitch + Math.cos(t*15 + ph)*.12*wob + bowX + .14*R.zoneK;
  // cape / tie / antenna spring (stiffness 120, damping .7), driven by turning and speed
  const yawRate = (sim.yawDraw - (R.lastYaw ?? sim.yawDraw))/Math.max(dt, 1e-3); R.lastYaw = sim.yawDraw;
  const swT = rm ? 0 : Math.max(-.5, Math.min(.5, -yawRate*.12 - Math.hypot(sim.vx, sim.vz)*.12 + (R.habitSwish || 0)));
  R.swv = (R.swv || 0) + ((swT - (R.swish || 0))*120 - 2*.7*Math.sqrt(120)*(R.swv || 0))*Math.min(dt, .05); R.swish = (R.swish || 0) + R.swv*Math.min(dt, .05);
  // idle habits (one per robot, full amplitude) + Storm Watch's 6:54 yawn
  const habit = stepHabit(a, sim, R, S, dt);
  // head: leads the body on turns; glances at whoever just finished or started waiting (eyes first, then the head)
  let hp = 0, hy = 0, hr = 0;
  if (pose === 'read') hp = .26; else if (pose === 'radar') hp = .38; else if (pose === 'sleep') hp = .42; else if (pose === 'type') hp = .1 + (rm?0:Math.sin(t*2.1+ph)*.03);
  else if (pose === 'blocked'){ hp = .2 - sigh*.15; hr = bf > .3 && bf < .4 ? -.12 : .06; } else if (pose === 'wait') hp = -.12;
  else if (pose === 'lounge' || pose === 'settle'){ hy = rm ? 0 : Math.sin(t*.35 + ph)*.45; hp = rm ? 0 : Math.sin(t*.23+ph)*.06; }
  else if (pose === 'meet') hp = rm ? 0 : Math.max(0, Math.sin(t*1.4+ph))*.12;
  else if (pose === 'ride') hp = sim.ride && sim.ride.kind === 'tube' ? -.2 : -.1;
  else if (pose === 'stamp') hp = .3;                                                   // eyes on the paper
  else if (pose === 'pin'){ hp = -.02; hy = -.55; }                                     // eyes on the easel
  else if (pose === 'slide-card'){ hp = .24; hy = Math.max(-.5, Math.min(.5, (dispatch.card.position.x - sim.x)*1.2)); }   // eyes follow the card
  else if (pose === 'hold') hp = .1;                                                    // queued: waiting its turn, patient
  if (pose === 'radar' && sim.spot && sim.spot.rail) hp = -.3;                          // hail: at the glass rail, looking out at the sky
  if (sim.moving && !sim.ride) hy = Math.max(-.6, Math.min(.6, (sim.turnD || 0)*.7));
  const look = V3.set(0, 0, 0);
  if (S === 'work') look.set(rm ? 0 : Math.sin(t*1.3 + ph)*.8, -.3, 0); else if (S === 'idle') look.set(rm ? 0 : Math.sin(t*.4 + ph)*.6, rm ? 0 : Math.sin(t*.27 + ph*2)*.4, 0);
  if (pose === 'pin') look.set(-.9, .1, 0); else if (pose === 'stamp') look.set(.35, -.7, 0); else if (pose === 'slide-card') look.set(Math.max(-1, Math.min(1, (dispatch.card.position.x - sim.x)*2.5)), -.6, 0);
  const gl = sim.glance; if (gl){ gl.t += dt; const o = sims[gl.id];
    if (!o || gl.t > gl.dur || o.hidden) sim.glance = null;
    else { const ang = Math.atan2(o.x - sim.x, o.z - sim.z) - sim.yawDraw; const d = Math.atan2(Math.sin(ang), Math.cos(ang)), k = Math.min(1, gl.t/.25)*Math.min(1, (gl.dur - gl.t)/.4);
      look.set(Math.max(-1, Math.min(1, d/1.1))*k, .1*k, 0); if (gl.t > gl.head) hy = lerp(hy, Math.max(-.9, Math.min(.9, d))*.8, k); } }
  if (habit){ if (habit.hp != null) hp = habit.hp; if (habit.hy != null) hy = habit.hy; if (habit.look) look.copy(habit.look); }
  // awareness: roll call, the cursor, hover, being watched (heads turn in the robot's own frame; the camera sits at view.azNow)
  const toCam = Math.atan2(Math.sin((view.azNow || AZ0) - sim.yawDraw), Math.cos((view.azNow || AZ0) - sim.yawDraw));
  const awake = pose !== 'sleep' && pose !== 'ride' && !sim.moving;
  if (rollcall.t >= 0 && awake){ const t0 = (seatN - 1)*.07, k = (rollcall.t - t0)/.6; if (k > 0 && k < 1){ const e = Math.sin(k*Math.PI); hy = lerp(hy, Math.max(-1.2, Math.min(1.2, toCam)), e); hp = lerp(hp, -.18, e); look.set(0, 0, 0); } }
  if (rollcall.t >= 0 && a.id === 'code' && rollcall.t > .75 && rollcall.t < 1.2) hp = Math.sin((rollcall.t - .75)/.45*Math.PI)*.3;   // the King nods last
  const pt_ = HUB.pointer, anP = anchors[a.id];
  if (pt_ && pt_.in && anP && awake && S !== 'blocked' && Math.abs(Date.now() - pt_.t) < 4000 || pt_ && pt_.in && anP && awake && S !== 'blocked' && Math.abs(performance.now() - pt_.t) < 4000){
    const dx = pt_.x - anP.x, dy = pt_.y - (anP.y + anP.fy)/2, d = Math.hypot(dx, dy);
    if (d < 300){ const k = (1 - d/300)*.9; hy = lerp(hy, Math.max(-1.1, Math.min(1.1, toCam + dx/300*.9)), k); hp = lerp(hp, Math.max(-.3, Math.min(.3, dy/300*.4)), k*.6); look.set(Math.max(-1, Math.min(1, dx/150)), -Math.max(-1, Math.min(1, dy/150)), 0); } }
  if (HUB.hover === a.id && awake){ hy = lerp(hy, Math.max(-1.2, Math.min(1.2, toCam)), .85); hp = -.1; look.set(0, 0, 0); }
  if (S === 'idle' && HUB.watching && !habit) hy *= .35;
  if (qStage === 1 && !rm && ((t + ph) % 9) < 1.4) hy = .9;                           // a glance up the stairs
  if (qStage === 2){ hp = .26; } else if (qStage === 3){ hp = .35; }
  if (sim.lookWin > 0){ sim.lookWin -= dt; const aw = Math.atan2(Math.sin(Math.PI - sim.yawDraw), Math.cos(Math.PI - sim.yawDraw)); hy = Math.max(-1.3, Math.min(1.3, aw)); hp = -.12; look.set(Math.sign(aw)*.6, .2, 0); }
  const hkx = Math.min(1, dt*4); R.head.rotation.x = lerp(R.head.rotation.x, hp, hkx); R.head.rotation.y = lerp(R.head.rotation.y, hy, Math.min(1, dt*(sim.moving ? 5 : 3))); R.head.rotation.z = lerp(R.head.rotation.z, hr, hkx);
  // eyes (hub/eyes.js)
  const blink = sim.blinkT > 0 && !rm && pose !== 'sleep' ? .08 : 1;
  const eyeShape = habit && habit.eyes ? habit.eyes : qStage === 3 || R.dozer ? 'sleep' : sim.perk != null ? 'wait' : S === 'ride' ? 'ride' : S === 'done' || thank ? 'done' : S;
  setEyes(R.E, eyeShape, V2d.set(look.x, look.y), habit && habit.open != null ? habit.open : blink, pose === 'sleep' ? EYE_DIM : S === 'blocked' ? EYE_RED : EYE, dt, rm);
  // the light strip (ART 6.6): working champagne + chase dot, idle champagne toward ceramic, waiting ember on the shared
  // 5 s breath, stuck oxide steady, asleep off with a brass pilot dot. Colors come from HUB.theme; never multiplyScalar.
  // v28 (blueprint 3.1): 7 states; color only for needs (ember, the one breath), stuck (oxide, steady), done (verdigris, 6 s);
  // working champagne, queued stone dimmed, idle stone, silent grey, asleep off with the pilot dot
  const st = a.st, brand = TH.mode === "brand", br = breathK(), stc = statusOf(a, sim); R.stc = stc;
  let col = TH.idle, hop = .1, gop = .06;
  if (stc === 'asleep'){ col = TH.sleep; hop = 0; gop = 0; }
  else if (stc === 'needs'){ col = TH.need; hop = rm ? .6 : .3 + .6*br; gop = rm ? .45 : .2 + .5*br; }
  else if (stc === 'stuck'){ col = TH.stuck; hop = .24; gop = .14; }
  else if (stc === 'silent'){ col = TH.silent; hop = .04; gop = 0; }
  else if (stc === 'done'){ col = TH.done; hop = .3; gop = .18; }
  else if (stc === 'working' || pose === 'ride'){ col = TH.work; hop = .3; gop = .16; }
  else if (stc === 'queued'){ col = cTmp.copy(TH.queue).lerp(QDIM, .45); hop = .05; gop = .03; }
  if (brand && pose !== 'sleep') col = TH.need;
  const ck = rm ? 1 : Math.min(1, dt*8);
  R.stripMat.color.lerp(col, ck); R.haloMat.color.lerp(col, ck); R.glow.material.color.lerp(col, ck);
  R.haloMat.opacity = lerp(R.haloMat.opacity, hop, stc === 'needs' ? 1 : Math.min(1, dt*6));
  R.glow.material.opacity = lerp(R.glow.material.opacity, gop, stc === 'needs' ? 1 : Math.min(1, dt*5));
  R.glow.visible = R.glow.material.opacity > .005; R.halo.visible = R.haloMat.opacity > .005;   // v28: a faded-out additive layer costs a draw + overdraw, so skip it

  const chasing = stc === 'working' && (WORK_POSES.has(pose) || pose === 'glide' || pose === 'ride') && !rm;
  R.chase.visible = chasing; if (chasing){ const ang = t*(pose === 'ride' ? 9 : 3.2*(R.zone || 1)) + ph; R.chase.position.set(Math.cos(ang)*.218, .25, Math.sin(ang)*.218); }
  const asleep = pose === 'sleep'; R.pilot.visible = asleep;
  if (asleep) R.pilot.material.opacity = rm ? .8 : .45 + .5*(.5 - .5*Math.cos(2*Math.PI*t/6 + ph));
  // hands
  const L0 = R.hl[0], R0 = R.hl[1];
  if (pose === 'type'){ L0.set(-.12, .5 + (rm?0:Math.max(0,Math.sin(t*15+ph))*.025), .3); R0.set(.12, .5 + (rm?0:Math.max(0,Math.sin(t*15+ph+Math.PI))*.025), .3); }
  else if (pose === 'radar' && sim.spot && sim.spot.rail){ L0.set(-.2, .56, .32); R0.set(.2, .56, .32); }   // both hands on the glass rail
  else if (pose === 'read' || pose === 'radar'){ L0.set(-.12, .55, .25); R0.set(.12, .55 + (rm?0:Math.max(0,Math.sin(t*.7+ph)-.9)*.3), .27); }
  else if (stepHands(a, sim, R, pose, t, rm, L0, R0)){ /* stamp / pin / slide-card */ }
  else if (pose === 'hold'){ L0.set(-.09, .42, .22); R0.set(.09, .42, .22); }
  else if (pose === 'wait'){
    if (qStage <= 0 && sim.slot === 0){ L0.set(-.27, .33, .06); R0.set(.3, .8 + (rm?0:Math.sin(t*6)*.04), .1 + (rm?0:Math.sin(t*6)*.05)); }   // front of the line: a small wave
    else if (qStage >= 2){ L0.set(-.12, .5, .28); R0.set(.12, .5, .28); }                                                                     // seated, reading
    else { L0.set(-.09, .42, .22); R0.set(.09, .42, .22); } }                                                                                 // hands together
  else if (pose === 'blocked'){
    if (bf < .3 || bf > .8){ const tap = rm ? 0 : Math.max(0, Math.sin(t*9))*.02; L0.set(-.12, .52 + tap, .32); R0.set(.12, .52, .32); if (bf >= 0 && Math.sin(t*9) > .95) R.blip = .3; }   // try
    else if (bf < .4){ L0.set(-.25, .86, .06); R0.set(.25, .86, .06); }                                     // recoil
    else if (bf < .65){ L0.set(-.27, .28, .05); R0.set(.27, .28, .05); }                                    // sigh
    else { const tap = rm ? 0 : Math.max(0, Math.sin(t*14))*.03; L0.set(-.27, .33, .06); R0.set(.1, .93, .2 + tap); } }   // tap the visor
  else if (pose === 'cheer'){ L0.set(-.27, 1.02, 0); R0.set(.27, 1.02, 0); }
  else if (pose === 'ride'){ if (sim.ride && sim.ride.kind === 'tube'){ L0.set(-.25, .28, .02); R0.set(.25, .28, .02); } else { L0.set(-.3, .95, .06); R0.set(.3, .95, .06); } }
  else if (pose === 'coffee'){ const sip = rm ? 0 : Math.max(0, Math.sin(t*.9 + ph)); L0.set(-.27, .32, .06); R0.set(.1, .48 + sip*.24, .25); }
  else if (pose === 'sleep'){ L0.set(-.26, .2, .05); R0.set(.26, .2, .05); }
  else if (pose === 'meet'){ L0.set(-.27, .33, .06); R0.set(.19, .5 + (rm?0:Math.max(0,Math.sin(t*1.1+ph))*.08), .22); }
  else { const sw = rm ? 0 : Math.sin(t*1.7 + ph)*.02; L0.set(-.28, .32 + sw, .05); R0.set(.28, .32 - sw, .05); }
  if (habit && habit.L) L0.copy(habit.L); if (habit && habit.R) R0.copy(habit.R);
  if (thank) R0.set(...thank.R);
  if (sim.poke != null && a.st === 'working') R0.set(.2, .92, .14);                    // working: "one sec" (a finger up)
  if (sim.perk != null) R0.set(.1, .56, .25);
  if (R.pointer) R0.set(.3, 1.0, .25);                                                   // the King points at the board
  const hk = rm && STEP_HANDS.has(pose) ? 1 : Math.min(1, dt*(pose === 'type' ? 18 : STEP_HANDS.has(pose) ? 14 : 7));
  R.hands[0].position.lerp(L0, hk); R.hands[1].position.lerp(R0, hk);
  if (a.id === 'qa-tester' && pose !== 'stamp' && qa.stamp.parent !== gUp){ gUp.add(qa.stamp); qa.stamp.position.copy(qa.rest); qa.stamp.rotation.set(0, 0, 0); qa.stamp.scale.setScalar(1); R.lastU = null; }
  // props
  const reading = pose === 'read' && !R.prop || pose === 'meet' && a.id === 'code';
  const reading2 = reading || qStage === 2; R.tablet.visible = reading2; if (qStage === 2){ R.tablet.position.set(0, R.hands[0].position.y + .02, .3); R.tablet.rotation.set(.9, 0, 0); }
  if (reading) if (reading){ R.tablet.position.set(0, R.hands[0].position.y + .02, .3); R.tablet.rotation.set(.9, 0, 0); }
  if (R.prop){ const show = HAND_PROP_POSES.has(pose) || pose === 'read' || pose === 'radar'; R.prop.visible = show;
    if (pose === 'read' || pose === 'radar'){ R.prop.position.set(.1, .08, .06); R.prop.rotation.set(-.9, 0, 0); } else if (show){ R.prop.position.set(0, .06, .03); R.prop.rotation.set(-.15, 0, a.def && a.def.outfit === 'newsboy' ? .25 : 0); } }
  // wardrobe v2: the state grammar for this robot's edition (hub/outfits.js)
  if (R.blip > 0) R.blip -= dt;
  const anPrev = anchors[a.id];
  animOutfit(KIT, a, sim, R, t, dt, {step:sim.stepId, breath:br, small:!anPrev || (anPrev.fy - anPrev.y) < 60, swish:R.swish || 0, wind:HUB.sky && HUB.sky.state && +HUB.sky.state.wind || 0, storm:HUB.sky && HUB.sky.state && HUB.sky.state.storm || 0});
  R.cup.visible = pose === 'coffee' || sim.perk != null; if (R.cup.visible) R.cup.position.copy(R.hands[1].position).add(V.set(0,.06,.02));
  R.steam.forEach((s,i) => { const on = R.cup.visible && !rm; s.visible = on; if (!on) return; const k = ((t*.6 + i/3) % 1); s.material.opacity = Math.sin(k*Math.PI)*.35;
    s.position.set(R.cup.position.x + Math.sin(k*6+i)*.02, R.cup.position.y + .06 + k*.22, R.cup.position.z); s.scale.setScalar(.05 + k*.06); });
  // floor: contact shadow + state ring (hidden while riding: the floor is far below)
  const hh = R.hov.position.y, riding = pose === 'ride';
  R.shadow.visible = !riding || !sim.ride || sim.ride.kind === 'slide' && false; R.shadow.scale.setScalar(.95 - hh*.45); R.shadow.material.opacity = Math.max(.15, .62 - hh*.55);
  let rc = null, rop = 0, rs = 1;
  if (pose === 'wait'){ rc = TH.need; const k = rm ? .5 : (t*.2) % 1; rs = 1 + k*.9; rop = (1-k)*.7; }
  else if (pose === 'blocked'){ rc = TH.stuck; rop = .35; }
  else if (pose === 'cheer'){ rc = GOLD; const k = Math.min(1, pt/1.2); rs = 1 + k*1.6; rop = (1-k)*.9; }
  if (rc) R.ring.material.color.copy(rc); R.ring.material.opacity = lerp(R.ring.material.opacity, riding ? 0 : rop, Math.min(1, dt*10)); R.ring.scale.setScalar(rs);
  // v28: the selection ring is a thin brass ring under the selected robot (a grown-up plumbob), over any state ring
  const sel = HUB.selected === a.id && !riding;
  R.ring2.material.color.copy(sel ? TH.jewel : TH.need); R.ring2.material.opacity = lerp(R.ring2.material.opacity, sel ? .85 : (pose === 'wait' ? .55 : 0), Math.min(1, dt*8));
  R.ring2.scale.setScalar(sel ? 1.18 : 1.05);
  R.ring.visible = R.ring.material.opacity > .01; R.ring2.visible = R.ring2.material.opacity > .01;
  // overlay anchor: top of the head + the floor under the robot
  V.set(sim.x, sim.y + up + hh + 1.2 + R.hat, sim.z).project(rcam); const ax = (V.x+1)/2*W, ay = (1-V.y)/2*H, behind = V.z > 1;
  V.set(sim.x, sim.y + up, sim.z).project(rcam); const fx = (V.x+1)/2*W, fy = (1-V.y)/2*H;
  const persFloor = rcam === pcam ? (view.sub === 'cctv' ? (cctv.i % 2 === 0 ? 'up' : 'down') : view.sub === 'window' ? 'up' : null) : null;
  const on = !(up > .3) && !behind && !(persFloor && sim.floor !== persFloor) && !(rcam === pcam && view.sub === 'eyes' && view.subId === a.id) && ax > -20 && ax < W + 20 && ay > -40 && fy < H + 20;
  const an = anchors[a.id] || (anchors[a.id] = {});
  an.x = ax; an.y = ay; an.fx = fx; an.fy = fy; an.pose = sim.bow != null ? 'bow' : sim.poke != null ? 'poke' : pose === 'wait' && sim.slot > 0 ? 'queue' : R.zone > 1 ? 'zone' : pose; an.moving = !!sim.moving; an.visible = on; an.floor = sim.floor;
  // floor reflection, desk status bar, after-hours lamp
  const refOn = sim.floor === 'down' && !sim.ride && !lowfx && pose !== 'sleep';
  R.refl.visible = refOn; if (refOn){ R.refl.material.color.copy(R.stripMat.color); R.refl.material.opacity = .18*light.lamps; }
  const ti = a.st === 'working' && !sim.moving && S === 'work' ? thoughtOf(a) : -1;
  if (ti >= 0){ R.thought.material.map.offset.x = ti/5; R.thought.visible = true; R.thought.position.set(.34, hh*1.24 + 1.42 + R.hat + (rm ? 0 : Math.sin(t*1.6 + ph)*.03), 0); R.thought.material.opacity = lerp(R.thought.material.opacity, .85, Math.min(1, dt*3)); }
  else { R.thought.material.opacity = lerp(R.thought.material.opacity, 0, Math.min(1, dt*5)); R.thought.visible = R.thought.material.opacity > .02; }
  deskStatus(a, stc, dt, rm);
  R.after.visible = !!HUB.afterHours && a.st === 'working' && !sim.moving && !!DESK[a.id] && sim.spot === DESK[a.id] && !DESK[a.id].seat && a.id !== 'storm-watch' && a.id !== 'chat-reader' && a.id !== 'code' && a.id !== 'king';
}

/* v28 desk status (M2 #8): the hairline bar in the status color (stuck: hatched, cocked, taller; done: a 900 ms verdigris fill), and
 * the andon's two tiers. Buffers are touched only when something changes. */
const ZAX = new THREE.Vector3(0, 0, 1), cBar = new THREE.Color();
function deskStatus(a, stc, dt, rm){
  const db = deskBars[a.id];
  if (db){
    if (db.cls !== stc){ db.fillT = stc === 'done' && db.cls && !rm ? 0 : null; db.cls = stc; db.dirty = true; }
    if (db.fillT != null){ db.fillT += dt; db.dirty = true; if (db.fillT >= .9) db.fillT = null; }
    const c = stc === 'silent' ? TH.silent : stc === 'asleep' ? TH.sleep : stc === 'needs' ? TH.need : stc === 'stuck' ? TH.stuck : stc === 'done' ? TH.done :
      stc === 'working' ? TH.work : cBar.copy(stc === 'queued' ? TH.queue : TH.idle).multiplyScalar(stc === 'queued' ? .5 : .55);
    const hex = c.getHex(); if (hex !== db.hex){ db.hex = hex; db.im.setColorAt(db.k, c); db.im.instanceColor.needsUpdate = true; }
    if (db.dirty){ db.dirty = false; const stuck = stc === 'stuck', fill = db.fillT != null ? ease(db.fillT/.9) : 1;
      QT.setFromAxisAngle(ZAX, stuck ? -.1 : 0); M4.compose(VP.set(db.x - db.w*(1 - fill)/2, db.y + (stuck ? .006 : 0), db.z), QT, VS.set(Math.max(.001, db.w*fill), stuck ? 3 : 1, 1));
      db.im.setMatrixAt(db.k, M4); db.im.instanceMatrix.needsUpdate = true;
      const ha = db.im.geometry.attributes.aHatch; ha.setX(db.k, stuck ? 1 : 0); ha.needsUpdate = true; }
  }
  const an = andons[a.id];
  if (an){ const need = stc === 'needs', stuck = stc === 'stuck', fl = andons[DESKS[a.id].f];
    if (an.need !== need || an.stuck !== stuck || fl.dirty){ an.need = need; an.stuck = stuck;
      an.im.setColorAt(an.k, need ? TH.need : ANDON_OFF); an.im.setColorAt(an.k + 1, stuck ? TH.stuck : ANDON_OFF); an.im.instanceColor.needsUpdate = true; } }
}
/* the status mark over the head, only when it matters (blueprint 6, Two Point): ◆ needs you (on the shared breath), ■ stuck
 * (steady), ✓ done (fades by 6 s). Working and idle show nothing. One InstancedMesh for the whole crew, billboarded. */
const markTex = tex(384, 128, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  for (let i = 0; i < 3; i++){ const cx = i*128 + 64, cy = 64;
    const gr = g.createRadialGradient(cx, cy, 8, cx, cy, 62); gr.addColorStop(0, 'rgba(0,0,0,.62)'); gr.addColorStop(.62, 'rgba(0,0,0,.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(i*128, 0, 128, 128); g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineCap = g.lineJoin = 'round';
    if (i === 0){ g.beginPath(); g.moveTo(cx, cy - 34); g.lineTo(cx + 30, cy); g.lineTo(cx, cy + 34); g.lineTo(cx - 30, cy); g.closePath(); g.fill(); }                 // ◆
    else if (i === 1){ g.beginPath(); g.moveTo(cx - 26, cy - 26); g.lineTo(cx + 12, cy - 26); g.lineTo(cx + 26, cy - 12); g.lineTo(cx + 26, cy + 26); g.lineTo(cx - 26, cy + 26); g.closePath(); g.fill(); }   // ■ with a notch
    else { g.lineWidth = 15; g.beginPath(); g.moveTo(cx - 28, cy + 2); g.lineTo(cx - 8, cy + 24); g.lineTo(cx + 30, cy - 24); g.stroke(); } }                         // ✓
});
const MARKS = (() => {
  const geo = new THREE.PlaneGeometry(1, 1), n = 16;
  geo.setAttribute('aTile', new THREE.InstancedBufferAttribute(new Float32Array(n), 1)); geo.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
  const mat = new THREE.ShaderMaterial({uniforms:{map:{value:markTex}}, transparent:true, depthWrite:false, toneMapped:false,
    vertexShader:'attribute float aTile; attribute float aAlpha; varying vec2 vUv; varying float vA; varying vec3 vC;\nvoid main(){ vUv = vec2((uv.x + aTile)/3.0, uv.y); vA = aAlpha; vC = instanceColor; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }',
    fragmentShader:'uniform sampler2D map; varying vec2 vUv; varying float vA; varying vec3 vC;\nvoid main(){ vec4 t = texture2D(map, vUv); float a = t.a * vA; if (a < .01) discard; gl_FragColor = vec4(vC * t.r, a);\n#include <colorspace_fragment>\n}'});
  const im = new THREE.InstancedMesh(geo, mat, n); im.count = 0; im.frustumCulled = false; im.renderOrder = 9; im.setColorAt(0, new THREE.Color()); scene.add(im);
  return {im, n};
})();
const MK_TILE = {needs:0, stuck:1, done:2}, MKP = new THREE.Vector3();
function stepMarks(agents){
  const im = MARKS.im, tile = im.geometry.attributes.aTile, alpha = im.geometry.attributes.aAlpha, br = breathK(), now = performance.now();
  const ppm = rcam === cam ? H/Math.max(1e-3, cam.top - cam.bottom) : 0;             // stage px per meter (ortho)
  let n = 0;
  for (const a of agents){
    const sim = sims[a.id], R = robots[a.id], an = anchors[a.id]; if (!sim || !R || sim.hidden || !an || !an.visible || !R.root.visible) continue;
    const stc = R.stc, k = MK_TILE[stc]; if (k === undefined || n >= MARKS.n) continue;
    if (rcam === pcam && view.sub === 'eyes' && view.subId === a.id) continue;
    const age = stc === 'done' && sim.doneAt != null ? now - sim.doneAt : 0, al = stc === 'needs' ? (RM.matches ? 1 : .55 + .45*br) : stc === 'done' ? Math.max(0, Math.min(1, (DONE_MS - age)/900)) : 1;
    if (al <= .01) continue;
    const s = ppm ? Math.max(.1, Math.min(.34, 22/ppm)) : .2;
    MKP.set(0, R.hov.position.y + (1.2 + R.hat)*1.0 + s*.7, 0); R.root.localToWorld(MKP);
    M4.compose(MKP, rcam.quaternion, VS.set(s, s, s)); im.setMatrixAt(n, M4);
    im.setColorAt(n, stc === 'needs' ? TH.need : stc === 'stuck' ? TH.stuck : TH.done); tile.setX(n, k); alpha.setX(n, al); n++;
  }
  im.count = n; im.visible = n > 0;
  if (n){ im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; tile.needsUpdate = true; alpha.needsUpdate = true; }
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
const MOOD_W = new THREE.Color(0xffe0b8), MOOD_C = new THREE.Color(0x9fb4ff), STORMB = new THREE.Color(0x9fb2d8), AFTER = new THREE.Color(0xffb877), LAMPCC = new THREE.Color(LAMPC);
const shadowSun = {el:null, lift:null, vis:null, dirty:true, n:0}, light = {lamps:1, dim:1};
function lightFromSky(dt){
  const s = HUB.sky && HUB.sky.state, alt = s ? s.alt : -9, storm = s ? s.storm || 0 : 0, flash = s ? s.flash || 0 : 0;
  let i = 0; while (i < PAL.length - 2 && alt > PAL[i+1].alt) i++;
  const A = PAL[i], B = PAL[i+1], k = Math.max(0, Math.min(1, (alt - A.alt)/(B.alt - A.alt))), L = (p) => A[p] + (B[p] - A[p])*k;
  sun.color.copy(A.kc).lerp(B.kc, k).lerp(STORMB, storm*.8);
  sun.intensity = L('ki')*(1 - storm*.75) + flash*2.2;
  const el = Math.max(8, L('el'))*Math.PI/180, az = -2.6;                    // from the back-left, through the back glass
  sun.position.set(-1.5 + Math.sin(az)*Math.cos(el)*24, 1 + Math.sin(el)*24, -2 + Math.cos(az)*Math.cos(el)*24); sun.target.position.set(-1.5, 1, -2);
  // v28: redraw the shadow pass only when the static room changes: the sun steps (~.6 deg), the upper floor lifts or hides,
  // or someone calls SCENE.shadowDirty(). Robot motion never triggers it (robots don't cast), so no periodic full passes.
  if (shadowSun.dirty || shadowSun.el == null || Math.abs(shadowSun.el - el) > .01 || shadowSun.lift !== gUp.position.y || shadowSun.vis !== gUp.visible){
    shadowSun.el = el; shadowSun.lift = gUp.position.y; shadowSun.vis = gUp.visible; shadowSun.dirty = false; shadowSun.n++;
    sun.updateMatrixWorld(); sun.target.updateMatrixWorld(); fitShadow(el); renderer.shadowMap.needsUpdate = true; }
  hemi.color.copy(A.hsc).lerp(B.hsc, k); hemi.groundColor.copy(A.hgc).lerp(B.hgc, k);
  const fl = HUB.flap; if (fl && isFinite(fl.blockDays)){ const d = +fl.blockDays; if (d >= 1) hemi.color.lerp(MOOD_W, Math.min(.08, d*.012)); else hemi.color.lerp(MOOD_C, .05); }
  hemi.intensity = L('hi')*(1 - storm*.3) + flash*1.2;
  rim.intensity = L('ri');
  const after = !!HUB.afterHours;
  light.lamps = (L('lx') + storm*.3)*(after ? 1.2 : 1);
  // the call pool: lamps ease to .88x while someone waits (1.2 s), the SpotLight rises to 18 above the first in line
  light.dim = 1 - .12*call.k;
  for (const Lp of LAMPS){ Lp.l.intensity = Lp.k*light.lamps*light.dim; Lp.l.color.copy(LAMPCC).lerp(AFTER, after ? 1 : 0); }
  const hk = Math.min(1, light.lamps)*light.dim; for (const h of halos) h.material.opacity = .35*hk; for (const r of lampRefl) r.material.opacity = .18*hk;
  MAT.opal.emissiveIntensity = .5 + 1.3*Math.min(1.2, light.lamps);
  scene.environmentIntensity = L('env')*(1 - storm*.2);
  renderer.toneMappingExposure = L('exp');
  return light.lamps;
}

/* v28 dev overlay: ?perf (or #perf, or localStorage hub-perf=1) shows draw calls, triangles, fps, frame-time graph and
 * shadow passes, read from renderer.info right after the main render. Never on without the flag. */
const PERF = (() => { try { return /[?&#]perf\b/.test(location.search + location.hash) || localStorage.getItem('hub-perf') === '1'; } catch(e){ return /[?&#]perf\b/.test(location.search + location.hash); } })();
const perfO = {el:null, g:null, ft:[], last:0, fps:0, calls:0, tris:0, maxCalls:0, shCalls:0, shAt:0};
function perfHud(dt, shPass){
  const o = perfO, i = renderer.info.render;
  if (shPass){ o.shCalls = Math.max(0, i.calls - o.calls); o.shAt = performance.now(); } else { o.calls = i.calls; o.tris = i.triangles; }
  o.maxCalls = Math.max(o.maxCalls, i.calls);
  if (dt > 0){ o.ft.push(dt*1000); if (o.ft.length > 120) o.ft.shift(); o.fps = o.fps ? o.fps*.92 + (1/dt)*.08 : 1/dt; }
  const now = performance.now(); if (now - o.last < 250) return; o.last = now;
  if (!o.el){ o.el = document.createElement('div'); o.el.id = 'perfHud';
    o.el.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99999;pointer-events:none;background:rgba(10,10,12,.82);color:#e8e6e1;font:11px/1.35 ui-monospace,Menlo,monospace;padding:6px 8px;border-radius:6px;white-space:pre';
    o.txt = document.createElement('div'); o.cv = document.createElement('canvas'); o.cv.width = 180; o.cv.height = 36; o.cv.style.cssText = 'display:block;margin-top:4px;width:180px;height:36px';
    o.el.append(o.txt, o.cv); document.body.appendChild(o.el); o.g = o.cv.getContext('2d'); }
  const ft = o.ft.slice().sort((a, b) => a - b), p95 = ft.length ? ft[Math.floor(ft.length*.95)] : 0;
  o.txt.textContent = 'calls ' + o.calls + ' (max ' + o.maxCalls + ')  tris ' + (o.tris/1000).toFixed(1) + 'k\n' + 'fps ' + o.fps.toFixed(0) + '  p95 ' + p95.toFixed(1) + ' ms  dpr ' + renderer.getPixelRatio().toFixed(2) + '\n' +
    'shadow passes ' + shadowSun.n + ' (' + o.shCalls + ' calls, last ' + (o.shAt ? ((now - o.shAt)/1000).toFixed(0) + ' s ago' : '-') + ')\ngeo ' + renderer.info.memory.geometries + '  tex ' + renderer.info.memory.textures;
  const g = o.g; g.clearRect(0, 0, 180, 36); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, 36 - 16.7*36/50, 180, 1);   // the 60 fps line (16.7 ms of 50)
  o.ft.forEach((v, k) => { const h = Math.min(36, v*36/50); g.fillStyle = v > 25 ? '#e5484d' : v > 17.5 ? '#f5883a' : '#8fbf8f'; g.fillRect(k*1.5, 36 - h, 1.2, h); });
}
let onScreen = true;
try { new IntersectionObserver(es => { onScreen = es[0].isIntersecting; }).observe(stage); } catch(e){}
const perf = {acc:0, n:0};
const seen = {board:null, trophies:null, lang:null, trophyTop:undefined};
let lowfx = false;
/* the trophy plaque light sweep (900 ms) when a new plaque lands */
const sweep = new THREE.Mesh(new THREE.PlaneGeometry(.07, .62), new THREE.MeshBasicMaterial({color:0xfff1d6, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false}));
sweep.rotation.z = .35; sweep.position.set(-1.3, .57, .006); sweep.visible = false; trophyMesh.add(sweep); sweep.userData.t = 1;
/* floor reflections under the downstairs lamps */
const lampRefl = [[3.4,-.4],[-1.65,3.0],[-.75,3.0]].map(([x,z]) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex, color:0xffd9ae, transparent:true, opacity:.18, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false}));
  sp.center.set(.5, 1); sp.scale.set(.3, 1.1, 1); sp.position.set(x, .01, z); sp.renderOrder = 2; scene.add(sp); return sp; });

/* ================= cues (CONTRACT v2 HUB.cues): shift every cue; unknown kinds are ignored ================= */
const deliveries = [];
const capsuleG = (() => { const k = new Map(); part(k, new THREE.CylinderGeometry(.035,.035,.1,14), MAT.brass, 0, 0, 0); part(k, new THREE.SphereGeometry(.035,14,8), MAT.brass, 0, .05, 0); part(k, new THREE.SphereGeometry(.035,14,8), MAT.brass, 0, -.05, 0);
  part(k, new THREE.TorusGeometry(.036,.006,6,16), MAT.bronze, 0, 0, 0, Math.PI/2); return k; })();
const B3 = (a, b, c, k, out) => out.set((1-k)*(1-k)*a.x + 2*(1-k)*k*b.x + k*k*c.x, (1-k)*(1-k)*a.y + 2*(1-k)*k*b.y + k*k*c.y, (1-k)*(1-k)*a.z + 2*(1-k)*k*b.z + k*k*c.z);
// Special Delivery (ART 8.5): a brass capsule flies from the asker to the King, who sits at the dispatch table downstairs in v28:
// straight across when they share a floor, else through the tube (down from upstairs, up to the board); the asker bows
CUE.answered = (c) => {
  const sim = c.id && sims[c.id];
  if (sim && !sim.hidden && !(sim.floor === 'up' && !gUp.visible) && !RM.matches) sim.bow = 0;
  if (RM.matches) return;
  const g = new THREE.Group(); bake(capsuleG, g, false);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex, color:0xe3c98f, transparent:true, opacity:.6, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false})); glow.scale.setScalar(.35); g.add(glow);
  const fromUp = !!(sim && !sim.hidden && sim.floor === 'up'), from = sim && !sim.hidden ? new THREE.Vector3(sim.x, sim.y + 1.0, sim.z) : new THREE.Vector3(FX - 1.2, 1.0, FZ - 1.2);
  const ks = sims.code && !sims.code.hidden && !sims.code.moving ? sims.code : DESK.code, kUp = (ks.floor || ks.f) === 'up';
  const end = new THREE.Vector3(ks.x - .22, (kUp ? FL.up.oy : 0) + .82, ks.z + .48);
  const base = new THREE.Vector3(TUBE.x, .35, TUBE.z), top = new THREE.Vector3(TUBE.x, TUBE.top - .2, TUBE.z), legs = [];
  if (fromUp === kUp) legs.push({k:'arc', a:from, b:end, dur:.9, au:fromUp, bu:kUp});
  else if (fromUp){ legs.push({k:'arc', a:from, b:top, dur:.5, au:true}, {k:'tube', a:top, b:base, dur:.9}, {k:'arc', a:base, b:end, dur:.6}); }
  else legs.push({k:'arc', a:from, b:base, dur:.5}, {k:'tube', a:base, b:top, dur:.9}, {k:'arc', a:top, b:end, dur:.6, bu:true});
  scene.add(g); deliveries.push({g, glow, t:0, legs, li:0});
};
function stepDeliveries(dt){
  let inTube = null;
  for (let i = deliveries.length - 1; i >= 0; i--){ const d = deliveries[i]; d.t += dt; const p = d.g.position, L = d.legs[d.li];
    if (d.t >= L.dur){ d.t -= L.dur; d.li++; if (d.li >= d.legs.length){ burstSmall(p); scene.remove(d.g); d.g.traverse(o => { if (o.isMesh) o.geometry.dispose(); if (o.isSprite) o.material.dispose(); }); deliveries.splice(i, 1); continue; } }
    const C = d.legs[d.li], k = ease(Math.min(1, d.t/C.dur)), a = V1.copy(C.a), b = V2.copy(C.b); if (C.au) a.y += LIFT; if (C.bu) b.y += LIFT;
    if (C.k === 'tube'){ p.lerpVectors(a, b, k); inTube = p.y; }
    else { const mid = V3.set((a.x + b.x)/2, Math.max(a.y, b.y) + .6, (a.z + b.z)/2); B3(a, mid, b, k, p); }
    d.g.rotation.set(C.k === 'tube' ? 0 : Math.PI/2, (d.t + d.li)*3, 0); }
  return inTube;
}
/* the line, the stand-up, QA's red card, the big finish, SCENE.points: once per frame */
const points = {spot:{x:0, y:0, visible:false}, tube:{x:0, y:0, visible:false}};
const fx_ = {qaSt:null, finish:null, finishDay:null};
function stepAwareness(agents, dt){
  frameNo++; if (rollcall.t >= 0){ rollcall.t += dt; if (rollcall.t > 1.4) rollcall.t = -1; }
  // the line: re-slot robots when the order changes; rope hooked per robot in line, unhooked at zero; the wait sign
  const order = lineOrder(), n = Math.min(5, order.length);
  order.forEach((id, i) => { const sim = sims[id]; if (!sim || sim.hidden || sim.moving || sim.ride || i >= 5) return; if (sim.slot !== i && !sim.queue.length) sim.queue = [{spot:'front', pose:'wait'}]; });
  if (n !== lineUI.n){ lineUI.n = n; lineUI.ropes.forEach((r, i) => r.visible = i < n); lineUI.loose.visible = n === 0; lineUI.sign.visible = n > 0; }
  if (n){ const a0 = HUB.byId && HUB.byId[order[0]]; const txt = (HUB.lang === 'es' ? 'ESPERA ' : 'WAIT ') + fmtWait(a0 && a0.since ? Date.now() - a0.since : 0) + (order.length > 5 ? '  +' + (order.length - 5) : '');
    if (txt !== lineUI.signText){ lineUI.signText = txt; redraw(lineUI.tex); } }
  // stand-up: 3+ at the board -> the King points at it, one of them dozes; v28: the King planning at the board points too
  const su = agents.filter(a => a.spot === 'standup' && a.st === 'working' && sims[a.id] && !sims[a.id].moving);
  for (const a of agents){ const R = robots[a.id]; if (!R) continue; R.pointer = a.id === 'code' && sims.code && !sims.code.moving && (su.length >= 3 || POOL.standup.includes(sims.code.spot)); R.dozer = su.length >= 3 && su[su.length - 1] === a && ((performance.now()/1000) % 14) < 5; }
  // QA carries a red card to the Builder when QA gets stuck on the Builder's task
  const qa = HUB.byId && HUB.byId['qa-tester'], bu = HUB.byId && HUB.byId.builder;
  if (qa){ if (fx_.qaSt && fx_.qaSt !== 'blocked' && qa.st === 'blocked' && bu && (qa.task && qa.task === bu.task || bu.task && String(qa.doing || '').includes(bu.task)) && sims['qa-tester'] && sims.builder && !RM.matches) spawnFolder(sims['qa-tester'], sims.builder, 'card');
    fx_.qaSt = qa.st; }
  // the big finish (whole board done, once a day): a high-five chain and one victory lap down the slide
  const bc = boardCounts(), fin = bc.done > 0 && bc.doing === 0 && bc.stuck === 0 && bc.needs === 0;
  if (fin && fx_.finish === false && !RM.matches){ const day = new Date().toDateString(); let last = null; try { last = localStorage.getItem('hub-finish'); } catch(e){}
    if (last !== day){ try { localStorage.setItem('hub-finish', day); } catch(e){}
      agents.forEach((a, i) => { const sm = sims[a.id]; if (sm && !sm.hidden && !sm.moving) sm.hi5 = -i*.12; });
      const lap = agents.find(a => sims[a.id] && sims[a.id].floor === 'up' && (a.st === 'idle' || a.st === 'done') && !sims[a.id].moving);
      if (lap){ const sm = sims[lap.id], free = POOL.lounge.find(p => p.f === 'down' && !claims.has(p)); if (free){ release(sm); claims.set(free, sm.id); sm.queue = [{spot:null, pose:'cheer', dur:1.2}]; go(sm, free); } } } }
  fx_.finish = fin;
  // your spot + the tube base, in stage px (for the page's overlays and the mind)
  V1.set(FIG.x, 1.2, FIG.z).project(rcam); points.spot.x = (V1.x + 1)/2*W; points.spot.y = (1 - V1.y)/2*H; points.spot.visible = V1.z < 1 && points.spot.x > -20 && points.spot.x < W + 20;
  V1.set(TUBE.x, .1, TUBE.z).project(rcam); points.tube.x = (V1.x + 1)/2*W; points.tube.y = (1 - V1.y)/2*H; points.tube.visible = points.tube.x > -20 && points.tube.x < W + 20;
}
function runCues(){
  const q = HUB.cues; if (!Array.isArray(q)) return false; let any = false;
  while (q.length){ const c = q.shift(); any = true; const fn = c && (CUE[c.kind] || CUE_LATE[c.kind]); if (fn) try { fn(c); } catch(e){} }
  return any;
}
/* power (CONTRACT v2 HUB.power): full / saver (30 fps, DPR 1.25) / paused; 30 fps idle cap after 10 s calm */
const pw = {acc:0, calm:0, dprMax:DPR, dprSet:DPR, hover:null, ptr:0};
const isBusy = () => tw.t < 1 || flights.length > 0 || bursts.length > 0 || deliveries.length > 0 || sweep.userData.t < 1 || call.k > 0 && call.k < 1 ||
  Object.values(sims).some(s => !s.hidden && (s.moving || s.ride || s.pose === 'cheer' || s.bow != null));
let lastT = 0;
const agentsArr = () => HUB.agents || [];
function frame(t, dt){
  const power = HUB.power || 'full';
  if (power === 'paused' && !CAPTURE) return;
  const cued = runCues();
  zonePrev = zoneNow; zoneNow = [];
  { const k = sims.code, now = performance.now(); const stuck = (HUB.agents || []).find(a => a.st === 'blocked' && sims[a.id] && !sims[a.id].hidden);   // the King glances at a stuck robot every 10 min
    if (k && stuck && HUB.byId && HUB.byId.code && HUB.byId.code.st === 'working' && now - (k.kingGl || 0) > 600e3 && !RM.matches){ k.kingGl = now; k.glance = {id:stuck.id, t:0, dur:2.4, head:.2}; } }
  const ptrT = HUB.pointer && HUB.pointer.t || 0, hov = HUB.hover || null;
  if (cued || isBusy() || ptrT !== pw.ptr || hov !== pw.hover || dragStart){ pw.calm = 0; pw.ptr = ptrT; pw.hover = hov; } else pw.calm += Math.min(.1, dt || 0);
  const cap = !CAPTURE && (power === 'saver' || pw.calm > 10) ? 1/30 : 0;
  pw.acc += Math.max(0, dt || 0); if (cap && pw.acc < cap - .004) return;
  const rawDt = dt; dt = Math.max(0, Math.min(.1, pw.acc)); pw.acc = 0; lastT = t;
  const wantDpr = power === 'saver' ? Math.min(DPR, 1.25) : DPR;
  if (wantDpr !== pw.dprSet){ pw.dprSet = wantDpr; renderer.setPixelRatio(wantDpr); resize(); }
  const agents = agentsArr();
  // build new robots lazily; hide hidden ones
  agents.forEach((a, i) => { const sim = syncAgent(a, i); if (!robots[a.id]) makeRobot(a); robots[a.id].root.visible = !sim.hidden; if (sim.hidden && anchors[a.id]) anchors[a.id].visible = false; });
  for (const a of agents){ const sim = sims[a.id]; if (!sim.hidden) stepSim(sim, a, dt); }
  // handoffs: shift the page's queue, fly a folder for each
  const hq = HUB.handoffs; if (Array.isArray(hq)) while (hq.length){ const h = hq.shift(); const A = h && sims[h.from], B = h && sims[h.to];
    if (A && B && !A.hidden && !B.hidden && h.from !== h.to && flights.length < 6 && !RM.matches) spawnFolder(A, B); if (h && h.from === 'king' && h.to === 'code') glint(robots.king); }
  if (!onScreen && !CAPTURE) return;
  const now = performance.now();
  const drift = 0;   // v28: no idle camera drift; a slowly turning ortho camera made every edge crawl (no MSAA) and repainted the whole room
  if (!dragStart && view.lastDrag && now - view.lastDrag > 5000) view.drag *= Math.pow(.2, dt);
  view.azLive = AZ0 + drift + view.drag;
  updateCamera(dt, false);
  if (readTheme()){ redraw(boardT); redraw(qaT); }
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
  const bolt = stepStorm(dt);
  const lamps = lightFromSky(dt);
  if (bolt){ sun.intensity += 3*bolt; hemi.intensity += 1.2*bolt; }
  // board + trophies redraw when their data or the language changes
  const lang = HUB.lang; const bv = HUB.boardInfo && HUB.boardInfo.v, tv = HUB.trophies && HUB.trophies.v;
  const bsig = bv + '|' + JSON.stringify(boardCounts()), run = HUB.boardInfo ? tx(HUB.boardInfo.when) : '';
  if (bsig !== seen.board || lang !== seen.lang){ if (seen.board != null && run !== seen.run && !RM.matches) boardFlip.t = 0; seen.run = run; seen.board = bsig; redraw(boardT); }
  if (boardFlip.t < 1){ boardFlip.t = Math.min(1, boardFlip.t + dt/1.4); if ((boardFlip.a += dt) > .07 || boardFlip.t >= 1){ boardFlip.a = 0; redraw(boardT); } }
  if (tv !== seen.trophies || lang !== seen.lang){ seen.trophies = tv; redraw(trophyT);
    const top = HUB.trophies && HUB.trophies.list && HUB.trophies.list[0] && HUB.trophies.list[0].id;
    if (seen.trophyTop !== undefined && top && top !== seen.trophyTop && !RM.matches) sweep.userData.t = 0; seen.trophyTop = top || null; }
  if (sweep.userData.t < 1){ sweep.userData.t = Math.min(1, sweep.userData.t + dt/.9); const k = sweep.userData.t; sweep.visible = k < 1; sweep.position.x = -1.3 - .5 + k; sweep.material.opacity = Math.sin(k*Math.PI)*.55; }
  seen.lang = lang;
  const rm = RM.matches;
  for (const a of agents){ const sim = sims[a.id]; if (!sim.hidden) animRobot(a, sim, robots[a.id], t, dt); }
  stepMarks(agents); andons.up.dirty = andons.down.dirty = false;
  stepAwareness(agents, dt);
  // station screens wake when their robot works there
  for (const [id, sc] of Object.entries(screens)){
    let sim = sims[id], here = sim && !sim.hidden && sim.spot && sim.spot === DESK[id];
    if (id[0] === '~'){ sim = Object.values(sims).find(s => s.spot && s.spot.hot === id); here = !!sim; }
    const on = here && WORK_POSES.has(sim.pose) && sim.pose !== 'meet' ? .95 : here && sim.pose === 'blocked' ? .5 : .16;
    sc.on = lerp(sc.on, on, Math.min(1, dt*3)); sc.m.material.opacity = sc.on;
    const blip = here && sim.pose === 'blocked' && robots[sim.id] && robots[sim.id].blip > 0;
    sc.m.material.color.copy(blip ? TH.stuck : here && sim.pose === 'blocked' ? SCR_DIM : SCR_W);
    if (here && sim.pose === 'type' && !rm) sc.t.offset.y = (sc.t.offset.y + dt*.06) % 1;
  }
  if (qa.phone) qa.phone.material.opacity = screens['qa-tester'].on;   // the QA phone wakes with the laptop glass
  // Cowork's wall map brightens while Cowork is up
  const cw = sims['cowork']; wallMap.m.material.opacity = lerp(wallMap.m.material.opacity, cw && !cw.hidden && cw.pose !== 'sleep' ? .75 : .3, Math.min(1, dt*2));
  // radar: sweeps while Storm Watch is awake, blips once it finds hail
  const sw = sims['storm-watch'], swa = HUB.byId && HUB.byId['storm-watch'], awake = !!(sw && !sw.hidden && swa && swa.st !== 'sleeping');
  radar.sweep.material.opacity = lerp(radar.sweep.material.opacity, awake ? .9 : 0, Math.min(1, dt*2));
  radar.disc.material.opacity = lerp(radar.disc.material.opacity, awake ? .75 : .22, Math.min(1, dt*2));
  if (!rm && awake) radar.sweep.rotation.z -= dt*1.6;
  const hail = (HUB.sky && HUB.sky.state && HUB.sky.state.storm > .15) || (swa && swa.st === 'done');
  radar.blips.forEach((b,i) => { b.material.opacity = lerp(b.material.opacity, hail ? .6 + Math.sin(t*3+i)*.35 : 0, Math.min(1, dt*3)); b.visible = b.material.opacity > .005; });
  radar.sweep.visible = radar.sweep.material.opacity > .005;
  // "your spot" glows when someone is waiting on you
  const waiting = agents.some(a => sims[a.id] && sims[a.id].pose === 'wait' && !sims[a.id].hidden);
  const bk_ = breathK(); spot.glow.material.opacity = lerp(spot.glow.material.opacity, waiting ? .35 + .35*bk_ : .16, Math.min(1, dt*4));
  spot.fill.material.opacity = lerp(spot.fill.material.opacity, waiting ? .04 + .04*bk_ : 0, Math.min(1, dt*4)); spot.fill.visible = spot.fill.material.opacity > .003;
  // charging pods: blue breathing glow when a robot sleeps in one
  podGlow.forEach((pg, i) => { const occ = Object.values(sims).some(s => !s.hidden && s.spot === POOL.pod[i] && s.pose === 'sleep');
    pg.glow.material.color.copy(occ ? SLEEPC : BRASSC); pg.glow.material.opacity = lerp(pg.glow.material.opacity, occ ? .45 : .12 + lamps*.06, Math.min(1, dt*3));
    pg.strip.material.color.copy(occ ? SLEEPC : DIM); });
  // the slide: light streak chasing each rider; the tube: the suction ring
  let sl = null, tb = null; for (const s of Object.values(sims)){ if (s.ride && s.ride.kind === 'slide') sl = s; if (s.ride && s.ride.kind === 'tube') tb = s; }
  slide.stripMat.color.lerp(sl ? CHAMP : DIM, Math.min(1, dt*6));
  slide.streak.forEach((sp, i) => { const on = !!sl && !rm && sl.ride.s > .08; sp.visible = on; if (!on) return;
    const q = (sl.ride.s - .08)/.92, s0 = q*q*.4 + q*.6, s = Math.max(0, s0 - i*.018), th = SLIDE.th0 - s*SLIDE.turns*2*Math.PI; slidePt(s, V1);
    sp.position.set(V1.x + Math.cos(th)*(SLIDE.tr*Math.sin(1.85) + .025), V1.y + SLIDE.tr*(1 - Math.cos(1.85)) - .1, V1.z + Math.sin(th)*(SLIDE.tr*Math.sin(1.85) + .025)); sp.material.opacity = .85*(1 - i/12); });
  const capY = stepDeliveries(dt);
  tube.ring.visible = (!!tb || capY != null) && !rm; if (tb){ tube.ring.position.y = Math.min(TUBE.top - .1, tb.y + .3); tube.ring.material.opacity = .9*(1 - tb.ride.s*.6); } else if (capY != null){ tube.ring.position.y = capY; tube.ring.material.opacity = .7; }
  tube.capMat.color.copy(tb ? GOLD : DIM); tube.base.material.opacity = lerp(tube.base.material.opacity, tb ? .9 : .3, Math.min(1, dt*5));
  // handoff envelopes
  for (let i = flights.length - 1; i >= 0; i--){ const f = flights[i]; headPos(f.from, V1); headPos(f.to, V2);
    const d = V1.distanceTo(V2), dur = Math.min(2.8, 1.2 + d*.1); f.t += dt; const k = Math.min(1, f.t/dur), e = ease(k);
    f.g.position.lerpVectors(V1, V2, e); f.g.position.y += Math.sin(k*Math.PI)*(.8 + d*.12); f.g.rotation.set(Math.sin(t*3)*.15, t*1.6, Math.sin(t*2)*.1);
    f.hist.unshift(f.g.position.clone()); if (f.hist.length > 24) f.hist.length = 24;
    f.trail.forEach((sp, j) => { const h = f.hist[j*3]; sp.visible = !!h && k < 1; if (h) sp.position.copy(h); });
    if (k >= 1){ scene.remove(f.g); for (const sp of f.trail) scene.remove(sp); f.g.traverse(o => { if (o.isMesh) o.geometry.dispose(); if (o.material && o.isSprite) o.material.dispose(); }); flights.splice(i,1); burstSmall(V2); } }
  // gold leaf: a soft lift, then drag + sway down
  for (let i = bursts.length - 1; i >= 0; i--){ const b = bursts[i]; b.t += dt; const arr = b.p.geometry.attributes.position.array;
    for (let k=0;k<b.vel.length;k++){ const v = b.vel[k]; v[1] = Math.max(-.45, v[1] - 2.4*dt); v[0] *= 1 - dt*1.6; v[2] *= 1 - dt*1.6;
      arr[k*3] += (v[0] + Math.sin(b.t*5 + v[3])*.12)*dt; arr[k*3+1] += v[1]*dt; arr[k*3+2] += (v[2] + Math.cos(b.t*4 + v[3])*.12)*dt; }
    b.p.geometry.attributes.position.needsUpdate = true; b.p.material.opacity = Math.max(0, Math.min(1, (b.life - b.t)/(b.life*.35)));
    if (b.t > b.life){ scene.remove(b.p); b.p.geometry.dispose(); b.p.material.dispose(); bursts.splice(i,1); } }
  const selfR = rcam === pcam && view.sub === 'eyes' && robots[view.subId]; if (selfR) selfR.root.visible = false;   // your own head stays out of your eyes
  const shPass = PERF && renderer.shadowMap.needsUpdate; if (PERF){ renderer.info.autoReset = false; renderer.info.reset(); }   // perf: count the shadow pass too
  renderer.render(scene, rcam);
  if (PERF){ perfHud(rawDt, shPass); renderer.info.autoReset = true; }
  if (selfR) selfR.root.visible = true;
  renderPip();
  // keep phones smooth: drop resolution if frames run long
  if (!cap && !CAPTURE){ perf.acc += Math.min(.1, rawDt || 0); perf.n++; if (perf.acc > 2){ const avg = perf.acc/perf.n;
    if (avg > .026 && DPR > 1){ DPR = Math.max(1, DPR - .25); pw.dprSet = DPR; renderer.setPixelRatio(DPR); resize();
      if (!lowfx){ lowfx = true; try { HUB.onLowFx && HUB.onLowFx(true); } catch(e){} halos.forEach((h, i) => { if (i % 2) h.visible = false; }); lampRefl.forEach(r => r.visible = false); } }
    perf.acc = 0; perf.n = 0; } }
}
/* ================= Storm Watch's morning (FUN 7), the hail moment, the flap boards (FUN 8) ================= */
const GLYPH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function flapText(g, text, x, y, cw, ch, font, flip, seed){        // split-flap cells: ivory glyphs on dark leaves; unsettled cells show a random glyph
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i=0;i<text.length;i++){ const c = text[i], cx = x + i*cw;
    if (c !== ' '){ g.fillStyle = '#16161a'; g.fillRect(cx + 1, y, cw - 2, ch); g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(cx + 1, y + ch/2 - .5, cw - 2, 1); }
    const settled = flip >= 1 || flip > .15 + (i*.37 + seed) % .6; const ch_ = settled ? c : GLYPH[Math.floor(Math.random()*GLYPH.length)];
    g.fillStyle = '#f1f2f4'; if (c !== ' ') g.fillText(ch_, cx + cw/2, y + ch/2 + 1); }
  g.textBaseline = 'alphabetic'; }
const storm = {note:null, noteK:1, noteKey:'', counter:null, cnt:'', flipT:1, cloud:null, notches:[], hail:null};
{
  P = gDown;
  storm.counterT = tex(256, 150, (g, w, h) => { g.clearRect(0,0,w,h); const gr = g.createLinearGradient(0,0,0,h); gr.addColorStop(0,'#d9bd82'); gr.addColorStop(1,'#8a6a3a');
    g.fillStyle = gr; g.beginPath(); g.roundRect(0,0,w,h,12); g.fill(); g.fillStyle = '#2a1c0c'; g.font = '600 17px ' + MONO; g.textAlign = 'center';
    g.fillText(HUB.lang === 'es' ? 'DÍAS SIN GRANIZO' : 'DAYS SINCE HAIL', w/2, 26);
    flapText(g, storm.cnt.padStart(2, ' '), 68, 40, 60, 92, '600 64px ' + FONT_H, storm.flipT, .1); });
  storm.counter = dyn(new THREE.Mesh(new THREE.PlaneGeometry(.3, .176), std({map:storm.counterT, transparent:true, roughness:.4, metalness:.3})));
  // v28: the days-since-hail counter and the notches ride with the radar table, upstairs by the glass
  storm.counter.position.set(radar.x + .38, .98, radar.z + .38); storm.counter.scale.setScalar(1.35); storm.counter.rotation.set(-.15, Math.PI/4, 0); storm.counter.renderOrder = 8; storm.counter.visible = false; gUp.add(storm.counter);
  for (let i=0;i<12;i++){ const an = -Math.PI/2 + i*.2; const m = new THREE.Mesh(new THREE.BoxGeometry(.03, .02, .03), MAT.bronze); m.position.set(radar.x + Math.cos(an)*.52, .79, radar.z + Math.sin(an)*.52); m.rotation.y = -an; m.visible = false; gUp.add(dyn(m)); storm.notches.push(m); }
  storm.noteT = tex(256, 256, (g, w, h) => { g.clearRect(0,0,w,h); const k = storm.noteK, n = storm.noteData || {};
    const fog = g.createRadialGradient(128,128,10,128,128,120); fog.addColorStop(0,'rgba(235,240,245,.55)'); fog.addColorStop(.7,'rgba(235,240,245,.3)'); fog.addColorStop(1,'rgba(235,240,245,0)'); g.fillStyle = fog; g.fillRect(0,0,w,h);
    g.globalCompositeOperation = 'destination-out'; g.strokeStyle = 'rgba(0,0,0,.95)'; g.fillStyle = 'rgba(0,0,0,.95)'; g.lineWidth = 9; g.lineCap = 'round';   // a finger wipes the fog
    g.beginPath(); g.arc(128, 104, 38, -Math.PI/2, -Math.PI/2 + Math.PI*2*Math.min(1, k/.45)); g.stroke();
    if (!n.hail && k > .45){ g.beginPath(); g.moveTo(92, 142); g.lineTo(92 + 72*Math.min(1, (k - .45)/.25), 142 - 76*Math.min(1, (k - .45)/.25)); g.stroke(); }
    if (k > .7){ g.globalAlpha = Math.min(1, (k - .7)/.3); g.font = '600 40px ' + MONO; g.textAlign = 'center'; g.fillText(n.label || '', 128, 196); g.globalAlpha = 1; } g.globalCompositeOperation = 'source-over'; });
  storm.note = new THREE.Mesh(new THREE.PlaneGeometry(.62, .62), new THREE.MeshBasicMaterial({map:storm.noteT, transparent:true, depthWrite:false, toneMapped:false}));
  storm.note.position.set(TUBE.x + .34, 1.45, TUBE.z + .34); storm.note.rotation.y = Math.PI/4; storm.note.renderOrder = 7; storm.note.visible = false; scene.add(storm.note);
  storm.cloudT = tex(256, 256, (g, w, h) => { g.clearRect(0,0,w,h); const blob = (x, y, r, a) => { const gr = g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,`rgba(58,62,74,${a})`); gr.addColorStop(1,'rgba(58,62,74,0)'); g.fillStyle = gr; g.fillRect(x-r,y-r,r*2,r*2); };
    blob(128, 70, 80, .85); blob(70, 78, 50, .7); blob(186, 78, 50, .7); blob(128, 150, 60, .8); for (let i=0;i<12;i++) blob(96 + (i*23)%70, 190 + (i%3)*14, 18, .35); });
  storm.cloud = new THREE.Sprite(new THREE.SpriteMaterial({map:storm.cloudT, transparent:true, opacity:0, depthWrite:false, depthTest:false, toneMapped:false})); storm.cloud.renderOrder = -3; storm.cloud.visible = false; scene.add(storm.cloud);
  storm.flapT = tex(512, 200, (g, w, h) => { g.fillStyle = '#0e0e11'; g.fillRect(0,0,w,h); g.strokeStyle = '#c9a45c'; g.lineWidth = 3; g.strokeRect(3,3,w-6,h-6);
    const f = HUB.flap || {}, es = storm.flapLang === 'es';
    const rows = es ? [['DÍAS SIN BLOQUEOS', f.blockDays], ['ENTREGADO', f.shipped], ['TE ESPERAN', f.waiting]] : [['DAYS WITHOUT A BLOCK', f.blockDays], ['SHIPPED THIS WEEK', f.shipped], ['WAITING ON YOU', f.waiting]];
    rows.forEach(([l, v], i) => { const y = 16 + i*60; g.fillStyle = 'rgba(241,242,244,.62)'; g.font = '500 22px ' + MONO; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(l, 22, y + 24);
      flapText(g, String(v == null ? '--' : Math.min(99, v | 0)).padStart(2, '0'), w - 118, y, 46, 50, '600 36px ' + FONT_H, storm.flapFlip, i*.2);
      if (i === 2 && v > 0){ g.fillStyle = TONE.need; g.fillRect(w - 128, y + 8, 4, 34); } }); });
  storm.flapLang = 'en'; storm.flapFlip = 1; storm.flapAt = 0;
  storm.flap = dyn(new THREE.Mesh(new THREE.PlaneGeometry(1.0, .39), std({map:storm.flapT, roughness:.5, metalness:.2})));
  storm.flap.position.set(-1.1, 2.2, 3.05); storm.flap.visible = false; P.add(storm.flap);
  storm.rods = [-.4, .4].map(dx => { const r = cyl(.006, .006, .45, MAT.brass, -1.1 + dx, 2.62, 3.05, 6); r.userData.dyn = true; r.visible = false; return r; });
}
const MS_DAY = 86400e3;
function stepStorm(dt){
  const sw = HUB.stormWatch, rm = RM.matches, swA = HUB.byId && HUB.byId['storm-watch'];
  const cnt = sw && isFinite(sw.dryDays) ? String(Math.min(99, Math.max(0, sw.dryDays | 0))) : '';
  storm.counter.visible = !!cnt;
  if (cnt && cnt !== storm.cnt){ storm.flipT = rm || !storm.cnt ? 1 : 0; storm.cnt = cnt; redraw(storm.counterT); }
  if (storm.flipT < 1){ storm.flipT = Math.min(1, storm.flipT + dt/1.1); if ((storm.f1 = (storm.f1 || 0) + dt) > .07 || storm.flipT >= 1){ storm.f1 = 0; redraw(storm.counterT); } }
  if (storm.lang !== HUB.lang){ storm.lang = HUB.lang; if (cnt) redraw(storm.counterT); }
  const nn = Math.min(12, swA && swA.gear ? swA.gear.count | 0 : 0); storm.notches.forEach((m, i) => m.visible = i < nn);
  const m = fremontMin(), recent = !!(sw && sw.lastHailAt && Date.now() - Date.parse(sw.lastHailAt) < 18*3600e3);
  const show = !!sw && m >= 414 && m < 1320;
  const label = recent && sw.inches ? (+sw.inches).toFixed(2).replace(/0$/, '') + '"' : '6:54', key = show + '|' + label;
  if (key !== storm.noteKey){ storm.noteKey = key; storm.noteData = {hail:recent, label}; storm.noteK = rm ? 1 : 0; redraw(storm.noteT); }
  storm.note.visible = show;
  if (storm.noteK < 1){ storm.noteK = Math.min(1, storm.noteK + dt/1.5); if ((storm.f2 = (storm.f2 || 0) + dt) > .1 || storm.noteK >= 1){ storm.f2 = 0; redraw(storm.noteT); } }
  const cloudOn = !!(sw && sw.lastHailAt && Date.now() - Date.parse(sw.lastHailAt) < MS_DAY && isFinite(sw.dir)) || !!storm.hail;
  if (cloudOn){ const src = storm.hail || sw, dir = (+src.dir || 0)*Math.PI/180, inch = Math.max(.75, +src.inches || 1), hgt = 3 + Math.min(2.5, inch)*2.6;
    storm.cloud.position.set(-1 + Math.sin(dir)*13, 2 + hgt*.55, -1 - Math.cos(dir)*13); storm.cloud.scale.set(hgt*1.25, hgt, 1); }
  storm.cloud.visible = cloudOn || storm.cloud.material.opacity > .02; storm.cloud.material.opacity = lerp(storm.cloud.material.opacity, cloudOn ? .85 : 0, rm ? 1 : Math.min(1, dt*.8));
  const fl = HUB.flap; storm.flap.visible = !!fl; storm.rods.forEach(r => r.visible = !!fl);
  if (fl){ const sig = JSON.stringify([fl.blockDays, fl.shipped, fl.waiting]); storm.flapAt += dt;
    if (sig !== storm.flapSig || storm.flapAt > 20){ const first = storm.flapSig == null; if (storm.flapAt > 20) storm.flapLang = storm.flapLang === 'en' ? 'es' : 'en'; storm.flapAt = 0; storm.flapSig = sig; storm.flapFlip = rm || first ? 1 : 0; redraw(storm.flapT); }
    if (storm.flapFlip < 1){ storm.flapFlip = Math.min(1, storm.flapFlip + dt/1.2); if ((storm.f3 = (storm.f3 || 0) + dt) > .07 || storm.flapFlip >= 1){ storm.f3 = 0; redraw(storm.flapT); } } }
  const hl = storm.hail; if (hl){ hl.t += dt; if (hl.t > 14){ storm.hail = null; const s2 = sims['storm-watch']; if (s2 && swA) applyState(s2, swA, false); } }
  return hl && !rm ? ([[.3,.45],[.6,.7],[2.1,2.25]].some(([a, b]) => hl.t > a && hl.t < b) ? 1 : 0) : 0;
}
CUE_LATE.hail = (c) => {
  storm.hail = {t:0, inches:+c.inches || 1, dir:+c.dir || 0};
  if (RM.matches) return;
  for (const s2 of Object.values(sims)) if (!s2.hidden) s2.lookWin = 5;
  const sw = sims['storm-watch']; if (sw && !sw.hidden && !sw.ride){ sw.lookWin = 0; sw.queue = [{spot:'front', pose:'wait'}]; }
};
/* The Call face-cam (FUN 4): while HUB.pip is set, the asker's face is scissor-rendered into the page's #pip box */
const fcam = new THREE.PerspectiveCamera(30, 1, .05, 30);
/* SCENE.pipDrawn (lead, v28): true once the face was really drawn into #pip for the current HUB.pip id; false when HUB.pip is
 * null or this frame's face render didn't run, so the page keeps its avatar fallback instead of a black box */
const pipSt = {id:null, drawn:false};
function renderPip(){
  const pp = HUB.pip; pipSt.drawn = false; if (!pp || !pp.id){ pipSt.id = null; return; } pipSt.id = pp.id;
  const sim = sims[pp.id], R = robots[pp.id]; if (!sim || !R || sim.hidden) return;
  const el = document.getElementById('pip'); if (!el) return; const r = el.getBoundingClientRect(), sr = stage.getBoundingClientRect();
  const w = Math.round(r.width), h = Math.round(r.height), x = Math.round(r.left - sr.left), y = Math.round(r.top - sr.top); if (w < 8 || h < 8 || el.offsetParent === null) return;
  HEADV.set(0, R.hov.position.y + .82*1.24, 0); R.root.localToWorld(HEADV);
  const yaw = sim.yawDraw; fcam.aspect = w/h; fcam.position.set(HEADV.x + Math.sin(yaw)*.95, HEADV.y + .06, HEADV.z + Math.cos(yaw)*.95); fcam.lookAt(HEADV.x, HEADV.y - .02, HEADV.z); fcam.updateProjectionMatrix();
  const vis = R.root.visible; R.root.visible = true;                   // an upstairs asker still shows its face while the floor is lifted away
  const yb = H - y - h; renderer.setScissorTest(true); renderer.setScissor(x, yb, w, h); renderer.setViewport(x, yb, w, h); renderer.clear(); renderer.render(scene, fcam);
  renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H); R.root.visible = vis;
  pipSt.drawn = true;
}
function burstSmall(p){ burst(p.x, p.y, p.z, 10, .9); }

if (document.fonts){ const again = () => { redraw(boardT); redraw(trophyT); }; document.fonts.ready.then(again); try { document.fonts.addEventListener('loadingdone', again); } catch(e){} }

function pick(x, y){ let best = null, bd = 34;
  for (const a of agentsArr()){ const an = anchors[a.id]; if (!an || !an.visible) continue; const cy = (an.y + an.fy)/2, d = Math.hypot(x - an.x, (y - cy)*0.7); if (d < bd){ bd = d; best = a.id; } }
  return best; }
/* test helper (not part of the contract): finish every walk, ride and timed pose right now */
function settle(){ for (const a of agentsArr()){ const sim = sims[a.id]; if (!sim || sim.hidden) continue;
  for (let i = 0; i < 10 && (sim.moving || sim.queue.length); i++){ if (sim.moving){ place(sim, sim.target); if (sim.pending){ sim.pending = false; applyState(sim, a, false); } } stepQueue(sim, a); if (sim.queue[0] && sim.queue[0].dur){ sim.poseT = sim.queue[0].dur*.4; break; } } } }

window.SCENE = {ready:true, anchors, frame, resize, pick, settle, get dragged(){ return SC.dragged; }, get info(){ return renderer.info.render; }, get perf(){ return {calls:perfO.calls, tris:perfO.tris, maxCalls:perfO.maxCalls, fps:perfO.fps, shadowPasses:shadowSun.n, shadowCalls:perfO.shCalls}; }, shadowDirty(){ shadowSun.dirty = true; },
  get views(){ return builtViews(); }, get tweening(){ return tw.t < 1; }, get pipDrawn(){ return !!(pipSt.drawn && HUB.pip && HUB.pip.id === pipSt.id); }, get busy(){ return isBusy(); }, points, get cctv(){ return cctv.i % 2 === 0 ? 1 : 2; }};
resize();
HUB.layout && HUB.layout();

if (CAPTURE){
  // render a still for the no-WebGL fallback (transparent background; the page's CSS sky shows through)
  setTimeout(() => { const out = document.createElement('textarea'); out.id = 'cap'; renderer.render(scene, rcam); out.value = canvas.toDataURL('image/webp', .8); document.body.append(out); }, 7000);
}
