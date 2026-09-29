/* Direction D "Hybrid" - app layer: 2D map (WebGL2), calm hail contours, smooth zoom, Morning + Walk views,
   navigation (Back / Esc / crumbs). The 3D road hologram lives in holo.js (window.createHolo).
   Sources are cited at the top of index.html. Homes are FAKE samples; no owner names, ever. */
(()=>{
'use strict';
const NL=window.NL, Q=new URLSearchParams(location.search), $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const STILL=Q.get('still')==='1'||RM;
const root=document.documentElement;
let theme=Q.get('theme')==='light'?'light':'dark', lang=Q.get('lang')==='es'?'es':'en';
try{ if(!Q.get('theme')){const t=localStorage.getItem('nl-d-theme'); if(t==='light'||t==='dark') theme=t;}
  if(!Q.get('lang')){const l=localStorage.getItem('nl-d-lang'); if(l==='en'||l==='es') lang=l;} }catch(e){}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const W=()=>innerWidth, H=()=>innerHeight;

/* ================= data ================= */
const P=NL.pick, BK=NL.backup, TODAY=Date.UTC(2026,8,29);
const S8=NL.storms.find(s=>s.date===P.storm_day), AREA=NL.areas.find(a=>a.id===P.area_id);
// FilthE 2026-09-29: "start with Fremont" -> the pick is Fremont (data-fremont.js); Columbus zones stay in the ranking.
const COL_ST=window.NL_COLUMBUS||NL.columbus, FRE_ST=NL.streets||NL.columbus;
const streetsAt=lon=>lon<-97?COL_ST:FRE_ST;
const PZ={id:P.zone_id,name:P.name,rank:1,score:P.score,homes:(AREA&&AREA.homes)||0,kind:P.kind,area_id:P.area_id,c:[P.center.lon,P.center.lat]};
const ZONES=(NL.zones.some(z=>z.id===P.zone_id)?NL.zones.slice():[PZ,...NL.zones]).sort((a,b)=>(a.kind==='storm'?0:1)-(b.kind==='storm'?0:1)||b.score-a.score).map((z,i)=>({...z,rank:i+1}));
const PICKZ=ZONES.find(z=>z.id===P.zone_id);
const SUN=lon=>lon<-97?{ss:19*60+17,dk:19*60+44}:{ss:19*60+13,dk:19*60+41}; // NOAA solar equations for 2026-09-29, CDT (Columbus / Fremont)
const driveMin=mi=>Math.max(5,Math.round(mi/(mi<10?20:50)*60));
const insWord=a=>{const l=a&&a.insured&&a.insured[lang];return l?l.split(': ').pop():'—'};
const dayN=d=>Math.round((TODAY-Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10)))/864e5);
const WD={en:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],es:['dom','lun','mar','mié','jue','vie','sáb']};
const wday=d=>new Date(Date.UTC(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10))).getUTCDay();
const pretty=n=>String(n||'').replace(/^North /i,'N ').replace(/^South /i,'S ').replace(/^East /i,'E ').replace(/^West /i,'W ').replace(/\b(\d+)(ST|ND|RD|TH)\b/i,(m,a,b)=>a+b.toLowerCase()).replace(/\bStreet\b/i,'St').replace(/\bAvenue\b/i,'Ave').replace(/\bDRIVE\b/i,'Dr')
  .replace(/\bBOULEVARD\b/i,'Blvd').replace(/\bRoad\b/i,'Rd').replace(/\bLane\b/i,'Ln').replace(/\b([A-Z])([A-Z]+)\b/g,(m,a,b)=>a+b.toLowerCase()).trim();
const skey=n=>pretty(n).toLowerCase().replace(/\b(\d+)(st|nd|rd|th)\b/,'$1').replace(/\./g,'');
const fmtT=(min,l=lang)=>{let h=Math.floor(min/60),m=Math.round(min%60);if(m===60){h++;m=0}const pm=h>=12,h12=((h+11)%12)+1;
  return l==='es'?`${h12}:${String(m).padStart(2,'0')} ${pm?'p. m.':'a. m.'}`:`${h12}:${String(m).padStart(2,'0')} ${pm?'PM':'AM'}`};
const PSUN=SUN(P.center.lon), SUNSET=PSUN.ss, DUSK=PSUN.dk, KN0=16*60, KN1=19*60+30;
const hailHex=h=>{const c=theme==='light'?['#b98a10','#cf5f12','#c92d3b']:['#f2c14e','#f5883a','#ff4f5a'];
  const m=(a,b,t)=>{const p=x=>[1,3,5].map(i=>parseInt(x.slice(i,i+2),16));const A=p(a),B=p(b);return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('')};
  if(h==null)return theme==='light'?'#3b55c9':'#8fa6ff'; if(h<=1)return c[0]; if(h<1.5)return m(c[0],c[1],(h-1)/.5); if(h<2)return m(c[1],c[2],(h-1.5)/.5); return c[2]};

/* ================= strings ================= */
const T={
 en:{cMorning:'Morning',cWalk:'Walk',cRoad:'Road 3D',overnight:'Overnight',date:'Tue, Sep 29',clock:'7:02 AM',dark:'Dark',light:'Light',
  pickEye:"Aldaba's pick",pickOf:n=>`#1 of ${n} zones`,doors:'Doors',doorsU:n=>`on the walk · ${n} streets`,hail:'Hail',in:'in',hailU:d=>`${d} · ground + radar`,
  drive:'Drive',driveU:m=>`from HMP HQ · ~${m} min`,best:'Best time',bestV:'4–7:30',bestU:t=>`PM today · sunset ${t}`,start:'Start the walk',
  backup:'Backup',bkM:(mi,d,sc)=>`${mi} mi · ${d} doors · ${sc}`,zones:'Ranked zones',zonesSub:'click one → 3D road',plan:"Today's plan",planSub:'Tue Sep 29',
  hdays:'Hail days',hdaysSub:'click → map',backMorning:'Morning',walkEye:'The walk · in order',colDoor:'Door · why',colHail:'Hail',colRoof:'Roof',colScore:'Score',
  viewRoad:'View the road in 3D',roadEye:'Road view · hologram',tour:'Tour',orbit:'Orbit',top:'Top',walkOrder:'Walk order',
  sample:'sample homes',everyday:'everyday',noTime:'time not reported',homesIn:n=>`${n} homes`,zonesN:n=>`${n} zone${n===1?'':'s'}`,near:p=>`near ${p}`,
  ago:n=>`${n}d`,max:'max',pickStorm:'pick',
  sum:{all:n=>`${n} days in 2026`,d90:n=>`${n} in 90 d`,big:(v,d)=>`max ${v}″ ${d}`},
  legend:(d,m)=>`<b>Hail · ${d}</b> · a line every 0.1 in · display-model peak ${m}″`,legendAll:'faint lines = all 18 storm days',showPick:'Back to the pick',
  area:a=>`<b>Area:</b> ${a.homes.toLocaleString('en-US')} homes · ${a.owner}% owner-lived · <b>likely insured: ${insWord(a)}</b> (area estimate, not a fact about one home)<sup class="s" data-src="census">3</sup>`,
  bkArea:'<b>Everyday zone:</b> no recent hail; older homes, mostly owner-lived.<sup class="s" data-src="census">3</sup>',
  showPickBtn:'Columbus pick',bkLabel:'Back to',
  walkP:(park,n,first)=>`Park at ${park} · ${n} streets · door 1 is ${first}`,
  ws:{doors:'Doors left',left:n=>`${n} left`,start:'Start',walking:'Walking',ends:'Ends'},
  stp:(n,c,dir)=>`<b>${n}</b> · ${c} doors · ${dir}`,dirs:{E:'east →',W:'← west',N:'north ↑',S:'south ↓'},
  sunsetRow:(a,b)=>`Sunset ${a} · last doors in dusk (civil dusk ${b})`,
  why:h=>[h.roof>=20?`roof ~${h.roof} yrs`:`roof ~${h.roof} yrs`,h.own?'owner-lived':'not owner-lived',`built ${h.built}`].join(' · '),
  doorOf:(k,n)=>`Door ${k} of ${n}`,after:n=>n?`${n} after this`:'last door',eta:t=>`ETA ~${t}`,
  f:{hail:d=>`Hail here (est., ${d})`,roof:'Roof age (estimate)',built:'Built',own:'Owner-lived (sample record)',type:'Home type',typeV:'Residential',areaIns:'Area likely insured (Census est.)',high:'high',yes:'yes',no:'no',yrs:'yrs'},
  score:'score',bigHail:'Hail here',bigRoof:'Roof age (est.)',whyH:'Why:',
  whyLong:h=>`${h.hail>=1.5?'big hail':h.hail>=1?'1-inch-plus hail':'smaller hail'} on a roof ~${h.roof} years old${h.own?', owner-lived (sample record)':''}, built ${h.built}.`,
  prev:'← Prev door',next:'Next door →',
  legal:'At the door, first: your name, HMP Siding & Roofing, and what you sell (Neb. 69-1602). Every sale: 3-business-day cancel form, EN + ES.',
  fine:'Sample home (fake) until knocking starts. No owner names.',
  road:{doors:'Doors',hail:'Top door hail',walk:'Walk',start:'Start'},roadP:(n,k)=>`${n} streets · ${k} doors · sample homes`,
  hint:'<b>Drag</b> to orbit · <b>scroll</b> to zoom · <b>click</b> a house · <b>Esc</b> back',
  back:{morning:'Morning',walk:'Walk'},
  toastOmaha:'Omaha is the everyday backup: street-level 3D loads in the live app (this mockup has Fremont and Columbus streets).',
  toastNoGL:'3D needs WebGL2; showing the walk list instead.',
  hq:'HMP HQ',ind:{col:(n,mi)=>`← Columbus · ${n} zones · ${mi} mi`,bk:mi=>`Omaha backup · ${mi} mi →`},
  srcs:'<b>Sources</b> · <sup>1</sup> NOAA SPC + MRMS · <sup>2</sup> Aldaba engine (hh.py) · <sup>3</sup> Census ACS 2024 · <sup>4</sup> Nebraska GIS streets · homes: sample · contours: display model',
 },
 es:{cMorning:'Mañana',cWalk:'Ruta',cRoad:'Calle 3D',overnight:'Anoche',date:'mar 29 sep',clock:'7:02 a. m.',dark:'Oscuro',light:'Claro',
  pickEye:'La elección de Aldaba',pickOf:n=>`#1 de ${n} zonas`,doors:'Puertas',doorsU:n=>`en la ruta · ${n} calles`,hail:'Granizo',in:'pulg',hailU:d=>`${d} · reportes + radar`,
  drive:'Manejo',driveU:m=>`desde la base HMP · ~${m} min`,best:'Mejor hora',bestV:'4–7:30',bestU:t=>`p. m. hoy · ocaso ${t.replace(' p. m.','')}`,start:'Empezar la ruta',
  backup:'Respaldo',bkM:(mi,d,sc)=>`${mi} mi · ${d} puertas · ${sc}`,zones:'Zonas en orden',zonesSub:'clic → calle en 3D',plan:'Plan de hoy',planSub:'mar 29 sep',
  hdays:'Días de granizo',hdaysSub:'clic → mapa',backMorning:'Mañana',walkEye:'La ruta · en orden',colDoor:'Puerta · por qué',colHail:'Granizo',colRoof:'Techo',colScore:'Puntaje',
  viewRoad:'Ver la calle en 3D',roadEye:'Vista de calle · holograma',tour:'Recorrido',orbit:'Girar',top:'Arriba',walkOrder:'Orden de la ruta',
  sample:'casas de muestra',everyday:'diario',noTime:'hora no reportada',homesIn:n=>`${n} casas`,zonesN:n=>`${n} zona${n===1?'':'s'}`,near:p=>`cerca de ${p}`,
  ago:n=>`${n} d`,max:'máx',pickStorm:'elección',
  sum:{all:n=>`${n} días en 2026`,d90:n=>`${n} en 90 d`,big:(v,d)=>`máx ${v}″ ${d}`},
  legend:(d,m)=>`<b>Granizo · ${d}</b> · una línea cada 0.1 pulg · pico del modelo ${m}″`,legendAll:'líneas tenues = los 18 días de tormenta',showPick:'Volver a la elección',
  area:a=>`<b>Zona:</b> ${a.homes.toLocaleString('en-US')} casas · en el ${a.owner}% viven sus dueños · <b>probablemente asegurado: ${insWord(a)}</b> (estimado de la zona, no dato de una casa)<sup class="s" data-src="census">3</sup>`,
  bkArea:'<b>Zona diaria:</b> sin granizo reciente; casas antiguas, en su mayoría viven sus dueños.<sup class="s" data-src="census">3</sup>',
  showPickBtn:'Elección Columbus',bkLabel:'Volver a',
  walkP:(park,n,first)=>`Estaciónate en ${park} · ${n} calles · la puerta 1 es ${first}`,
  ws:{doors:'Quedan',left:n=>`${n} puertas`,start:'Inicio',walking:'A pie',ends:'Termina'},
  stp:(n,c,dir)=>`<b>${n}</b> · ${c} puertas · ${dir}`,dirs:{E:'este →',W:'← oeste',N:'norte ↑',S:'sur ↓'},
  sunsetRow:(a,b)=>`Puesta de sol ${a} · últimas puertas al anochecer (crepúsculo ${b})`,
  why:h=>[`techo ~${h.roof} años`,h.own?'vive el dueño':'no vive el dueño',`construida en ${h.built}`].join(' · '),
  doorOf:(k,n)=>`Puerta ${k} de ${n}`,after:n=>n?`quedan ${n} después`:'última puerta',eta:t=>`llegada ~${t}`,
  f:{hail:d=>`Granizo aquí (est., ${d})`,roof:'Edad del techo (estimado)',built:'Construida',own:'Vive el dueño (registro de muestra)',type:'Tipo',typeV:'Residencial',areaIns:'Zona prob. asegurada (est. Censo)',high:'alto',yes:'sí',no:'no',yrs:'años'},
  score:'puntaje',bigHail:'Granizo aquí',bigRoof:'Edad del techo (est.)',whyH:'Por qué:',
  whyLong:h=>`${h.hail>=1.5?'granizo grande':h.hail>=1?'granizo de más de 1 pulgada':'granizo menor'} en un techo de ~${h.roof} años${h.own?', vive el dueño (registro de muestra)':''}, construida en ${h.built}.`,
  prev:'← Puerta anterior',next:'Siguiente →',
  legal:'En la puerta, primero: tu nombre, HMP Siding & Roofing y lo que vendes (Neb. 69-1602). Cada venta: formulario de cancelación de 3 días hábiles, EN + ES.',
  fine:'Casa de muestra (ficticia) hasta empezar a tocar. Sin nombres de dueños.',
  road:{doors:'Puertas',hail:'Granizo máx. puerta',walk:'A pie',start:'Inicio'},roadP:(n,k)=>`${n} calles · ${k} puertas · casas de muestra`,
  hint:'<b>Arrastra</b> para girar · <b>rueda</b> para acercar · <b>clic</b> en una casa · <b>Esc</b> regresa',
  back:{morning:'Mañana',walk:'Ruta'},
  toastOmaha:'Omaha es el respaldo diario: el 3D a nivel de calle se carga en la app en vivo (esta maqueta tiene calles de Fremont y Columbus).',
  toastNoGL:'El 3D necesita WebGL2; se muestra la lista de la ruta.',
  hq:'Base HMP',ind:{col:(n,mi)=>`← Columbus · ${n} zonas · ${mi} mi`,bk:mi=>`Respaldo Omaha · ${mi} mi →`},
  srcs:'<b>Fuentes</b> · <sup>1</sup> NOAA SPC + MRMS · <sup>2</sup> motor Aldaba (hh.py) · <sup>3</sup> Censo ACS 2024 · <sup>4</sup> calles Nebraska GIS · casas: muestra · curvas: modelo visual',
 }};
const t=k=>T[lang][k];
const SRC={en:{storms:NL.src.storms,engine:'Aldaba engine (hh.py): ranks zones from NOAA/MRMS hail + Census ACS 2024; doors = its walk',
  drive:'Engine distance from HMP HQ (2600 Laverna St, Fremont); time estimated',census:NL.src.census+' (area estimate, never a fact about one home)',streets:NL.src.streets,homes:NL.src.homes},
 es:{storms:'Reportes de tormenta NOAA SPC + estimados de granizo por radar MRMS (motor hh.py)',engine:'Motor Aldaba (hh.py): ordena zonas con granizo NOAA/MRMS + Censo ACS 2024; puertas = su ruta',
  drive:'Distancia del motor desde la base HMP (2600 Laverna St, Fremont); tiempo estimado',census:'Censo de EE. UU. ACS 2024 (estimado de la zona, nunca un dato de una casa)',streets:NL.src.streets,homes:'Casas de MUESTRA (ficticias) hasta empezar a tocar. Sin nombres de dueños.'}};

/* ================= projection + palette ================= */
const K=Math.cos(41.3*Math.PI/180), X=lon=>(lon+97)*K, Y=lat=>lat-41.3, KMX=111.32, KMY=110.54;
const hex=h=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,parseInt(h.slice(5,7),16)/255];
const PAL={
 dark:{ink:hex('#dfe4ee'),warm:hex('#d9cdbb'),water:hex('#6f9fd0'),route:hex('#f5883a'),h1:hex('#f2c14e'),h15:hex('#f5883a'),h2:hex('#ff4f5a'),walk:hex('#ffa766'),add:true,
   a:{county:.10,town:.16,townF:.03,water:.34,waterF:.10,stream:.18,hwy:.34,rail:.14,arts:.16,st0:.5,st3:.2,glow:.06},c:{all:.14,feat:.62,fill:.06}},
 light:{ink:hex('#1d2026'),warm:hex('#6a5a44'),water:hex('#2d6a9f'),route:hex('#c8640f'),h1:hex('#b98a10'),h15:hex('#cf5f12'),h2:hex('#c92d3b'),walk:hex('#b4540c'),add:false,
   a:{county:.16,town:.4,townF:.05,water:.6,waterF:.14,stream:.36,hwy:.44,rail:.2,arts:.2,st0:.56,st3:.28,glow:0},c:{all:.22,feat:.85,fill:.09}}
};

/* ================= geometry ================= */
const MAXL=.009; // split long segments (~1 km) so each fits a cull tile
function segs(lines,filter){const o=[];for(const L of lines){if(filter&&!filter(L))continue;const p=L.p;
  for(let i=1;i<p.length;i++){const ax=X(p[i-1][0]),ay=Y(p[i-1][1]),bx=X(p[i][0]),by=Y(p[i][1]),n=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/MAXL));
    for(let k=0;k<n;k++)o.push(ax+(bx-ax)*k/n,ay+(by-ay)*k/n,ax+(bx-ax)*(k+1)/n,ay+(by-ay)*(k+1)/n)}}return new Float32Array(o)}
function fan(ring){ // ear clipping (concave town/river outlines)
  let pts=ring.map(q=>[X(q[0]),Y(q[1])]);if(pts.length>3){const a=pts[0],b=pts[pts.length-1];if(a[0]===b[0]&&a[1]===b[1])pts.pop()}
  let n=pts.length;if(n<3)return [];let area=0;for(let i=0;i<n;i++){const a=pts[i],b=pts[(i+1)%n];area+=a[0]*b[1]-b[0]*a[1]}if(area<0)pts.reverse();
  const idx=pts.map((_,i)=>i),o=[];const cr=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const inT=(p,a,b,c)=>cr(a,b,p)>=0&&cr(b,c,p)>=0&&cr(c,a,p)>=0;let guard=0,i=0;
  while(idx.length>3&&guard<idx.length*3){const m=idx.length,ia=idx[(i+m-1)%m],ib=idx[i%m],ic=idx[(i+1)%m],A=pts[ia],Bq=pts[ib],C=pts[ic];let ear=cr(A,Bq,C)>0;
    if(ear){for(let j=0;j<m;j++){const k=idx[j];if(k===ia||k===ib||k===ic)continue;const Pp=pts[k];if(inT(Pp,A,Bq,C)&&!(Pp[0]===A[0]&&Pp[1]===A[1])&&!(Pp[0]===C[0]&&Pp[1]===C[1])){ear=false;break}}}
    if(ear){o.push(...A,...Bq,...C);idx.splice(i%m,1);guard=0}else{i++;guard++} if(i>=idx.length)i=0;}
  if(idx.length===3)o.push(...pts[idx[0]],...pts[idx[1]],...pts[idx[2]]);return o}
const base=NL.base;
const G={county:segs(base,l=>l.k==='county'),town:segs(base,l=>l.k==='town'),water:segs(base,l=>l.k==='water'),stream:segs(base,l=>l.k==='stream'),
 hwy:segs(base,l=>l.k==='hwy'),rail:segs(base,l=>l.k==='rail'),arts:segs(NL.arts),fr0:segs(NL.fremont,l=>l.c<=1),fr3:segs(NL.fremont,l=>l.c>=2),
 co1:segs(COL_ST,l=>l.c<=1),co3:segs(COL_ST,l=>l.c>=2)};
{const o=[];for(const L of base){if(!(L.k==='hwy'&&L.n==='US-30'))continue;const p=L.p;for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i];
  if(a[0]<-96.47&&b[0]<-96.47&&a[0]>-97.40&&b[0]>-97.40)o.push(X(a[0]),Y(a[1]),X(b[0]),Y(b[1]))}}G.route=new Float32Array(o);}
const fills={town:[],water:[]};base.forEach(l=>{if(l.poly&&(l.k==='town'||l.k==='water')&&l.p.length>2)fills[l.k].push(...fan(l.p))});
G.townF=new Float32Array(fills.town);G.waterF=new Float32Array(fills.water);

/* ================= hail field (display model: storm swaths + engine areas + zone peaks) ================= */
const hash=(x,y)=>{const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s)};
const vnoise=(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
  const a=hash(xi,yi),b=hash(xi+1,yi),c=hash(xi,yi+1),d=hash(xi+1,yi+1);return (a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v)*2-1};
const SF=NL.storms.map(s=>{const p=s.path.map(q=>[X(q[0])*KMX,Y(q[1])*KMY]);const sig=4.2+s.max*2.2;
  let bb=[1e9,1e9,-1e9,-1e9];p.forEach(q=>{bb[0]=Math.min(bb[0],q[0]);bb[1]=Math.min(bb[1],q[1]);bb[2]=Math.max(bb[2],q[0]);bb[3]=Math.max(bb[3],q[1])});
  const r=sig*3.4;bb=[bb[0]-r,bb[1]-r,bb[2]+r,bb[3]+r];
  const areas=NL.areas.filter(a=>a.st===s.id).map(a=>{let b=[1e9,1e9,-1e9,-1e9];a.ring.forEach(q=>{const x=X(q[0])*KMX,y=Y(q[1])*KMY;b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],y)});
    return {x:X(a.c[0])*KMX,y:Y(a.c[1])*KMY,r:Math.max(1.6,((b[2]-b[0])+(b[3]-b[1]))*.3),amp:a.hail||1}});
  const zones=ZONES.filter(z=>z.kind==='storm'&&z.id.startsWith(s.date));
  return {s,p,sig,bb,amp:s.max*.9,areas,zones}});
const zsc=ZONES.filter(z=>z.kind==='storm').map(z=>z.score), zmin=Math.min(...zsc), zmax=Math.max(...zsc);
const PEAK=Math.max(...NL.homes.map(h=>h.hail)); // the pick's own sample doors
SF.forEach(F=>{const sc=F.zones.filter(z=>z.id!==P.zone_id).map(z=>z.score),a=Math.min(...sc),b=Math.max(...sc);
  F.zones=F.zones.map(z=>({x:X(z.c[0])*KMX,y:Y(z.c[1])*KMY,amp:z.id===P.zone_id?PEAK:1.2+.44*(z.score-a)/((b-a)||1)}))});
const warp=(x,y)=>[vnoise(x/9,y/9),x+2.2*vnoise(y/14+7,x/14),y+2.2*vnoise(x/14+3,y/14+1),vnoise(x/2.6+3,y/2.6+8),vnoise(x/1.1+9,y/1.1+4)];
const smax=(a,b,k=14)=>Math.max(a,b)+Math.log1p(Math.exp(-k*Math.abs(a-b)))/k;
function stormVal(F,x,y,w){ // x,y in km; w = warp(x,y) (computed once per texel). Display model, not a measurement.
  const n=w[0],wx=w[1],wy=w[2],n1=w[3],n2=w[4];
  let v=0;
  if(wx>F.bb[0]&&wx<F.bb[2]&&wy>F.bb[1]&&wy<F.bb[3]){let d2=1e12;const p=F.p;
    for(let i=1;i<p.length;i++){const ax=p[i-1][0],ay=p[i-1][1],bx=p[i][0]-ax,by=p[i][1]-ay,L=bx*bx+by*by||1e-9;let u=((wx-ax)*bx+(wy-ay)*by)/L;u=u<0?0:u>1?1:u;const dx=wx-ax-u*bx,dy=wy-ay-u*by;d2=Math.min(d2,dx*dx+dy*dy)}
    const g=Math.exp(-d2/(2*F.sig*F.sig));v=g*(F.amp*(1+.08*n)+.16*n1+.07*n2);}
  for(const a of F.areas){const dx=wx-a.x,dy=wy-a.y;if(Math.abs(dx)>3*a.r||Math.abs(dy)>3*a.r)continue;const d=Math.hypot(dx,dy)/a.r;
    if(d<3){const g=Math.exp(-d*d);v=smax(v,g*(a.amp+.14*n1+.06*n2))}}
  for(const z of F.zones){const dx=wx-z.x,dy=(wy-z.y)*1.35,d2=dx*dx+dy*dy;if(d2<25)v=smax(v,z.amp*Math.exp(-d2/(2*1.35*1.35))+.05*n2,8)}
  return Math.max(0,v)}
const hailAt=(lon,lat,F=SF.find(f=>f.s.id===S8.id))=>{const x=X(lon)*KMX,y=Y(lat)*KMY;return stormVal(F,x,y,warp(x,y))};
const RB=[X(-97.62),Y(40.98),X(-95.84),Y(41.74)], LB=[X(-97.47),Y(41.385),X(-97.28),Y(41.49)];
const RW=560,RH=Math.round(RW*(RB[3]-RB[1])/(RB[2]-RB[0])), LW=400,LH=Math.round(LW*(LB[3]-LB[1])/(LB[2]-LB[0]));
const WC=new Map(); // per-texture warp cache (5 floats / texel): the noise is the costly part, storms are cheap
function bakeField(bb,w,h,out,channel,list){ // channel 0 = all storms (max), 1 = one storm
  let wc=WC.get(bb);if(!wc){wc=new Float32Array(w*h*5);for(let j=0;j<h;j++){const y=(bb[1]+(j+.5)/h*(bb[3]-bb[1]))*KMY;for(let i=0;i<w;i++){const x=(bb[0]+(i+.5)/w*(bb[2]-bb[0]))*KMX;wc.set(warp(x,y),(j*w+i)*5)}}WC.set(bb,wc)}
  const wp=[0,0,0,0,0];
  for(let j=0;j<h;j++){const y=(bb[1]+(j+.5)/h*(bb[3]-bb[1]))*KMY;
    for(let i=0;i<w;i++){const x=(bb[0]+(i+.5)/w*(bb[2]-bb[0]))*KMX,k=(j*w+i)*5;wp[0]=wc[k];wp[1]=wc[k+1];wp[2]=wc[k+2];wp[3]=wc[k+3];wp[4]=wc[k+4];
      let v=0;for(const F of list){const q=stormVal(F,x,y,wp);if(q>v)v=q}out[(j*w+i)*2+channel]=v}}}
const fieldR=new Float32Array(RW*RH*2), fieldL=new Float32Array(LW*LH*2);

/* ================= walks: the pick's real walk + generated sample walks for other Columbus zones ================= */
const M_LON=111320*Math.cos(41.43*Math.PI/180), M_LAT=110540;
function projOn(p,poly){let best={d:1e18,t:0,q:p,i:0},acc=0;
  for(let i=1;i<poly.length;i++){const a=poly[i-1],b=poly[i],ax=(b[0]-a[0])*M_LON,ay=(b[1]-a[1])*M_LAT,L=Math.hypot(ax,ay)||1e-6;
    let u=(((p[0]-a[0])*M_LON)*ax+((p[1]-a[1])*M_LAT)*ay)/(L*L);u=clamp(u);const qx=a[0]+(b[0]-a[0])*u,qy=a[1]+(b[1]-a[1])*u;
    const d=Math.hypot((p[0]-qx)*M_LON,(p[1]-qy)*M_LAT);if(d<best.d)best={d,t:acc+u*L,q:[qx,qy],i};acc+=L}
  return best}
const plen=poly=>{let s=0;for(let i=1;i<poly.length;i++)s+=Math.hypot((poly[i][0]-poly[i-1][0])*M_LON,(poly[i][1]-poly[i-1][1])*M_LAT);return s};
const dirOf=poly=>{const a=poly[0],b=poly[poly.length-1],dx=(b[0]-a[0])*M_LON,dy=(b[1]-a[1])*M_LAT;return Math.abs(dx)>Math.abs(dy)?(dx>0?'E':'W'):(dy>0?'N':'S')};
function finishWalk(w){ // curb points, path, ETAs
  const n=w.homes.length, per=(KN1-KN0)/n;let path=[w.park];
  w.homes.forEach((h,k)=>{h.order=k+1;h.eta=KN0+k*per;h.col=hailHex(h.hail);
    const pv=w.homes[k-1];if(pv&&pv.si!==h.si){const a=w.streets[pv.si].p,b=w.streets[h.si].p;path.push(a[a.length-1],b[0])} // turn the corner, don't cut the block
    path.push(h.curb,h.p,h.curb)});
  w.path=path;w.len=plen(path);
  let bb=[1e9,1e9,-1e9,-1e9];[w.park,...w.homes.map(h=>h.p)].forEach(q=>{bb[0]=Math.min(bb[0],q[0]);bb[1]=Math.min(bb[1],q[1]);bb[2]=Math.max(bb[2],q[0]);bb[3]=Math.max(bb[3],q[1])});
  w.bb=bb;w.center=[(bb[0]+bb[2])/2,(bb[1]+bb[3])/2];return w}
function pickWalk(){
  const S=NL.walk.s, homes=NL.homes.map(h=>({...h}));
  homes.forEach(h=>{const si=Math.max(0,S.findIndex(s=>s.n===h.st));const pr=projOn(h.p,S[si].p);h.si=si;h.t=pr.t;h.curb=pr.q});
  homes.sort((a,b)=>a.si-b.si||a.t-b.t);
  return finishWalk({zone:PICKZ,name:P.name,park:NL.walk.park,parkName:(NL.walk.pn||[]).join(' & '),streets:S.map(s=>({n:s.n,p:s.p,dir:dirOf(s.p),h:homes.filter(h=>h.st===s.n).length})),homes,sample:true,real:true})}
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function genWalk(z){
  const rnd=mulberry([...z.id].reduce((a,c)=>a*31+c.charCodeAt(0)|0,7)), c=z.c, R=240;
  const dm=q=>Math.hypot((q[0]-c[0])*M_LON,(q[1]-c[1])*M_LAT);
  const byName={};streetsAt(c[0]).forEach(l=>{if(l.c<2||!l.n||/INTERSECTION|SERVICE|FRONTAGE|Road/i.test(l.n))return;if(!l.p.some(q=>dm(q)<R))return;(byName[l.n]=byName[l.n]||[]).push(l)});
  const cands=Object.entries(byName).map(([n,ls])=>{ // chain the pieces of one street along its main axis
    const pts=[];ls.forEach(l=>l.p.forEach(q=>{if(dm(q)<R*1.25)pts.push(q)}));const ex=Math.max(...pts.map(q=>q[0]))-Math.min(...pts.map(q=>q[0])),ey=Math.max(...pts.map(q=>q[1]))-Math.min(...pts.map(q=>q[1]));
    const ew=ex*M_LON>ey*M_LAT;pts.sort((a,b)=>ew?a[0]-b[0]:a[1]-b[1]);const u=[];pts.forEach(q=>{if(!u.length||Math.hypot((q[0]-u[u.length-1][0])*M_LON,(q[1]-u[u.length-1][1])*M_LAT)>4)u.push(q)});
    return {n:pretty(n),p:u,len:plen(u),d:Math.min(...u.map(dm)),ew}}).filter(s=>s.p.length>1&&s.len>120).sort((a,b)=>a.d-b.d);
  const chosen=[];let doors=0;for(const s of cands){if(chosen.length>=3||doors>=25)break;chosen.push(s);doors+=Math.floor(s.len/27)*2}
  const homes=[];chosen.forEach((s,si)=>{if(si%2)s.p.reverse();const L=s.len,step=27,nn=Math.floor(L/step);let acc=0,seg=1;
    const at=d=>{while(seg<s.p.length-1&&acc+Math.hypot((s.p[seg][0]-s.p[seg-1][0])*M_LON,(s.p[seg][1]-s.p[seg-1][1])*M_LAT)<d){acc+=Math.hypot((s.p[seg][0]-s.p[seg-1][0])*M_LON,(s.p[seg][1]-s.p[seg-1][1])*M_LAT);seg++}
      const a=s.p[seg-1],b=s.p[seg],L2=Math.hypot((b[0]-a[0])*M_LON,(b[1]-a[1])*M_LAT)||1,u=clamp((d-acc)/L2);return {q:[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u],nx:-(b[1]-a[1])*M_LAT/L2,ny:(b[0]-a[0])*M_LON/L2}};
    acc=0;seg=1;
    for(let k=0;k<nn&&homes.length<25;k++){const d=step*(k+.5);const {q,nx,ny}=at(d);
      for(const side of [1,-1]){if(homes.length>=25)break;if(rnd()<.18)continue;const off=17;
        const p=[q[0]+nx*off*side/M_LON,q[1]+ny*off*side/M_LAT];
        const num=s.ew?Math.round(3900+(-97.3747-p[0])/.00275*100):Math.round(2100+(p[1]-41.437)/.00065*100);
        const n2=Math.max(100,Math.round(num/2)*2+(side>0?1:0));
        const roof=Math.round(10+rnd()*15),built=Math.round(1955+rnd()*48),own=rnd()<.72,hail=+(hailAt(p[0],p[1])*(.97+rnd()*.05)).toFixed(2);
        const score=Math.round(clamp(28+hail*18+roof*.9+(own?9:0)+rnd()*8,40,94));
        homes.push({addr:`${n2} ${s.n}`,st:s.n,p,curb:q,built,roof,own,hail,score,si,t:d})}}});
  homes.sort((a,b)=>a.si-b.si||a.t-b.t);
  const park=chosen.length?chosen[0].p[0]:c;
  return finishWalk({zone:z,name:z.name,park,parkName:chosen.length?chosen[0].n:'',streets:chosen.map(s=>({n:s.n,p:s.p,dir:dirOf(s.p),h:homes.filter(h=>h.st===s.n).length})),homes,sample:true,real:false})}
const WALKS={};const walkFor=z=>{const w=WALKS[z.id]||(WALKS[z.id]=z.id===P.zone_id?pickWalk():genWalk(z));w.sun=SUN(w.center[0]);w.area=(z.id===P.zone_id?AREA:NL.areas.find(a=>a.st===(NL.storms.find(s=>z.id.startsWith(s.date))||{}).id&&Math.abs(a.c[0]-z.c[0])<.3));return w};

/* ================= camera (van Wijk & Nuij smooth zoom) ================= */
const cam={x:0,y:0,s:1000};
const LPX=()=>parseFloat(getComputedStyle(root).getPropertyValue('--L'))||440, RPX=()=>parseFloat(getComputedStyle(root).getPropertyValue('--R'))||352;
function gap(view){const l=view==='walk'?14+LPX()+20+14:14+LPX()+14;return {l:l+6,r:W()-14-RPX()-14-6,t:76,b:H()-(view==='morning'?64:14)}}
function fit(bb,g,pad){const w=Math.max(1e-7,bb[2]-bb[0]),h=Math.max(1e-7,bb[3]-bb[1]);const s=Math.min((g.r-g.l-2*pad)/w,(g.b-g.t-2*pad)/h);
  const mx=(bb[0]+bb[2])/2,my=(bb[1]+bb[3])/2,gx=(g.l+g.r)/2-W()/2,gy=(g.t+g.b)/2-H()/2;return {x:mx-gx/s,y:my+gy/s,s}}
const llbb=(b,m=0)=>[X(b[0])-m,Y(b[1])-m,X(b[2])+m,Y(b[3])+m];
const camMorning=()=>{const c=PICKZ.c;return fit([X(c[0]-.042),Y(c[1]-.028),X(c[0]+.042),Y(c[1]+.03)],gap('morning'),10)};
const camWalk=w=>fit(llbb(w.bb,.00022),gap('walk'),60);
const camStorm=F=>{const k=F.s.path;let b=[1e9,1e9,-1e9,-1e9];k.forEach(q=>{b[0]=Math.min(b[0],q[0]);b[1]=Math.min(b[1],q[1]);b[2]=Math.max(b[2],q[0]);b[3]=Math.max(b[3],q[1])});
  NL.areas.filter(a=>a.st===F.s.id).forEach(a=>a.ring.forEach(q=>{b[0]=Math.min(b[0],q[0]);b[1]=Math.min(b[1],q[1]);b[2]=Math.max(b[2],q[0]);b[3]=Math.max(b[3],q[1])}));
  return fit(llbb(b,.06),gap('morning'),20)};
function zoomPath(a,b){ // a,b = {x,y,s}; returns t->cam and a natural duration (d3.interpolateZoom math)
  const rho=1.35,r2=rho*rho,r4=r2*r2,w0=W()/a.s,w1=W()/b.s,dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy;let S,f;
  if(d2<1e-16){S=Math.log(w1/w0)/rho;f=t=>({x:a.x+t*dx,y:a.y+t*dy,s:W()/(w0*Math.exp(rho*t*S))})}
  else{const d1=Math.sqrt(d2),b0=(w1*w1-w0*w0+r4*d2)/(2*w0*r2*d1),b1=(w1*w1-w0*w0-r4*d2)/(2*w1*r2*d1),q0=Math.log(Math.sqrt(b0*b0+1)-b0),q1=Math.log(Math.sqrt(b1*b1+1)-b1);
    S=(q1-q0)/rho;f=t=>{const s=t*S,c0=Math.cosh(q0),u=w0/(r2*d1)*(c0*Math.tanh(rho*s+q0)-Math.sinh(q0));return {x:a.x+u*dx,y:a.y+u*dy,s:W()/(w0*c0/Math.cosh(rho*s+q0))}}}
  return {f,ms:clamp(Math.abs(S)*620,900,2300)}}
let fly=null;
function flyTo(to,done,msMax){if(STILL){Object.assign(cam,to);fly=null;dirty=true;done&&done();return}
  const z=zoomPath({...cam},to);fly={z,t0:performance.now(),ms:msMax?Math.min(msMax,z.ms):z.ms,to,done};dirty=true}
function stepFly(now){if(!fly)return;const k=clamp((now-fly.t0)/fly.ms);const c=fly.z.f(ease(k));cam.x=c.x;cam.y=c.y;cam.s=c.s;
  if(k>=1){Object.assign(cam,fly.to);const d=fly.done;fly=null;d&&d()}dirty=true}
const toScreen=(lon,lat)=>[(X(lon)-cam.x)*cam.s+W()/2,H()/2-(Y(lat)-cam.y)*cam.s];

/* ================= WebGL2 map renderer ================= */
const cv=$('#map');let gl=null;try{gl=cv.getContext('webgl2',{antialias:true,premultipliedAlpha:true,alpha:true})}catch(e){gl=null}
const DPR=()=>Math.min(2,devicePixelRatio||1);
let R=null;
if(gl){
  const sh=(ty,s)=>{const o=gl.createShader(ty);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o};
  const prog=(v,f)=>{const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,v));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));const u={};const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
    for(let i=0;i<n;i++){const nm=gl.getActiveUniform(p,i).name;u[nm]=gl.getUniformLocation(p,nm)}return {p,u}};
  const HEAD=`#version 300 es
precision highp float; uniform vec2 uCam; uniform float uSc; uniform vec2 uVp;`;
  const LV=HEAD+`
layout(location=0) in vec2 q; layout(location=1) in vec4 ab; uniform float uW; out float vS;
void main(){ vec2 pa=(ab.xy-uCam)*uSc, pb=(ab.zw-uCam)*uSc; vec2 d=pb-pa; float L=length(d); vec2 dir=L>1e-4?d/L:vec2(1.,0.); vec2 n=vec2(-dir.y,dir.x);
  vec2 p=mix(pa,pb,q.x)+dir*(q.x*2.-1.)*uW+n*q.y*uW; vS=q.y*uW; gl_Position=vec4(p/(uVp*.5),0.,1.);}`;
  const LF=`#version 300 es
precision highp float; in float vS; uniform float uW,uCore; uniform vec4 uCol; out vec4 o;
void main(){ float d=abs(vS); float g=d<=uCore?1.:pow(clamp(1.-(d-uCore)/max(uW-uCore,.001),0.,1.),2.); float a=clamp(uCol.a*g,0.,1.); o=vec4(uCol.rgb*a,a);}`;
  const FV=HEAD+`layout(location=0) in vec2 pos; void main(){gl_Position=vec4((pos-uCam)*uSc/(uVp*.5),0.,1.);}`;
  const FF=`#version 300 es
precision highp float; uniform vec4 uCol; out vec4 o; void main(){o=vec4(uCol.rgb*uCol.a,uCol.a);}`;
  // contours: anti-aliased isolines of the hail field (fwidth), index line every 0.5 in, reveal from the core outward
  const CV=`#version 300 es
layout(location=0) in vec2 q; void main(){gl_Position=vec4(q,0.,1.);}`;
  const CF=`#version 300 es
precision highp float;
uniform vec2 uCamD; uniform float uScD; uniform vec2 uVpD; uniform float uDpr;
uniform sampler2D uR,uL; uniform vec4 uRB,uLB; uniform vec3 c1,c15,c2;
uniform float uThr,uAllA,uFeatA,uFillA,uGlow; out vec4 o;
vec3 ramp(float v){ if(v<1.) return c1; if(v<1.5) return mix(c1,c15,(v-1.)/.5); if(v<2.) return mix(c15,c2,(v-1.5)/.5); return c2; }
float dist(float v,float st){ float q=v/st; float fw=max(fwidth(q),1e-6); return abs(fract(q-.5)-.5)/fw/uDpr; }
void main(){
  vec2 wp=uCamD+(gl_FragCoord.xy-uVpD*.5)/uScD;
  vec2 ur=(wp-uRB.xy)/(uRB.zw-uRB.xy), ul=(wp-uLB.xy)/(uLB.zw-uLB.xy);
  vec2 er=min(ur,1.-ur), el=min(ul,1.-ul);
  vec2 f=texture(uR,clamp(ur,0.,1.)).rg*smoothstep(0.,.02,min(er.x,er.y));
  float lw=smoothstep(0.,.08,min(el.x,el.y)); vec2 fl=texture(uL,clamp(ul,0.,1.)).rg; f=mix(f,fl,lw);
  float a=f.r, v=f.g;
  float dA=dist(a,.25), dV=dist(v,.1), dI=dist(v,.5);
  float lA=(1.-smoothstep(.45,1.2,dA))*smoothstep(.55,.85,a)*uAllA;
  float rv=smoothstep(uThr-.04,uThr+.04,v); float on=smoothstep(.55,.8,v)*rv;
  float lV=(1.-smoothstep(.35,1.05,dV))*.62+(1.-smoothstep(.4,1.15,dI))*.3;
  float glow=exp(-dI*dI/30.)*uGlow;
  float fill=uFillA*smoothstep(.75,1.7,v);
  float av=(lV*uFeatA+glow+fill)*on;
  vec3 col=ramp(a)*lA+ramp(v)*av;
  o=vec4(col,clamp(lA+av,0.,1.));
}`;
  const L=prog(LV,LF),F=prog(FV,FF),C=prog(CV,CF);
  const quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,-1,1,-1,0,1,1,1]),gl.STATIC_DRAW);
  const tri=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,tri);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  const triV=gl.createVertexArray();gl.bindVertexArray(triV);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.bindVertexArray(null);
  // segments binned into ~1 km tiles (row-major) so a zoomed-in view draws only the tiles it can see
  const TS=.01,GX0=RB[0]-.1,GY0=RB[1]-.1,GX=Math.ceil((RB[2]-RB[0]+.2)/TS),GY=Math.ceil((RB[3]-RB[1]+.2)/TS);
  const tileOf=(x,y)=>clamp(Math.floor((y-GY0)/TS),0,GY-1)*GX+clamp(Math.floor((x-GX0)/TS),0,GX-1);
  const binned=arr=>{const n=arr.length/4,key=new Int32Array(n),ord=new Uint32Array(n);for(let i=0;i<n;i++){key[i]=tileOf((arr[i*4]+arr[i*4+2])/2,(arr[i*4+1]+arr[i*4+3])/2);ord[i]=i}
    ord.sort((a,b)=>key[a]-key[b]);const out=new Float32Array(arr.length),starts=new Int32Array(GX*GY+1);
    for(let j=0;j<n;j++){out.set(arr.subarray(ord[j]*4,ord[j]*4+4),j*4);starts[key[ord[j]]+1]++}for(let t=0;t<GX*GY;t++)starts[t+1]+=starts[t];return {out,starts}};
  const lineVao=(arr,tiled)=>{const v=gl.createVertexArray();gl.bindVertexArray(v);gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    let starts=null;if(tiled){const bz=binned(arr);arr=bz.out;starts=bz.starts}
    const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,arr,gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,0,0);gl.vertexAttribDivisor(1,1);
    gl.bindVertexArray(null);return {v,b,n:arr.length/4,starts}};
  const fillVao=arr=>{const v=gl.createVertexArray();gl.bindVertexArray(v);const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,arr,gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.bindVertexArray(null);return {v,n:arr.length/2}};
  const V={};for(const k of ['county','town','water','stream','hwy','rail','arts','fr0','fr3','co1','co3'])V[k]=lineVao(G[k],true);
  V.townF=fillVao(G.townF);V.waterF=fillVao(G.waterF);V.walk=lineVao(new Float32Array(4));V.storm=lineVao(new Float32Array(4));
  const setLines=(o,arr)=>{gl.bindBuffer(gl.ARRAY_BUFFER,o.b);gl.bufferData(gl.ARRAY_BUFFER,arr,gl.DYNAMIC_DRAW);o.n=arr.length/4};
  const tex=(w,h,d)=>{const x=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,x);gl.texImage2D(gl.TEXTURE_2D,0,gl.RG16F,w,h,0,gl.RG,gl.FLOAT,d);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return x};
  let tR=null,tL=null;
  const upField=()=>{if(tR){gl.deleteTexture(tR);gl.deleteTexture(tL)}tR=tex(RW,RH,fieldR);tL=tex(LW,LH,fieldL)};
  const common=p=>{gl.useProgram(p.p);gl.uniform2f(p.u.uCam,cam.x,cam.y);gl.uniform1f(p.u.uSc,cam.s);gl.uniform2f(p.u.uVp,W(),H())};
  let VB=null; // view bbox in tiles, set per frame
  const line=(o,col,a,w,core)=>{if(!o.n||a<=.003)return;gl.bindVertexArray(o.v);gl.uniform4f(L.u.uCol,col[0],col[1],col[2],a);gl.uniform1f(L.u.uW,w);gl.uniform1f(L.u.uCore,core);
    if(!o.starts||!VB||(VB[2]-VB[0]+1)*(VB[3]-VB[1]+1)>900){if(o.starts){gl.bindBuffer(gl.ARRAY_BUFFER,o.b);gl.vertexAttribPointer(1,4,gl.FLOAT,false,0,0)}gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,o.n);return}
    gl.bindBuffer(gl.ARRAY_BUFFER,o.b);
    for(let ty=VB[1];ty<=VB[3];ty++){const f=o.starts[ty*GX+VB[0]],l=o.starts[ty*GX+VB[2]+1];if(l>f){gl.vertexAttribPointer(1,4,gl.FLOAT,false,0,f*16);gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,l-f)}}
    gl.vertexAttribPointer(1,4,gl.FLOAT,false,0,0)};
  const fill=(o,col,a)=>{if(!o.n||a<=.003)return;gl.bindVertexArray(o.v);gl.uniform4f(F.u.uCol,col[0],col[1],col[2],a);gl.drawArrays(gl.TRIANGLES,0,o.n)};
  const blend=m=>{gl.enable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);if(m==='add')gl.blendFunc(gl.ONE,gl.ONE);else gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA)};
  R={upField,setLines:(k,arr)=>setLines(V[k],arr),
   resize(){const d=DPR();cv.width=Math.round(W()*d);cv.height=Math.round(H()*d);gl.viewport(0,0,cv.width,cv.height)},
   draw(st){const pal=PAL[theme],A=pal.a,add=pal.add?'add':'over',d=DPR();
    {const hw=W()/2/cam.s+TS,hh=H()/2/cam.s+TS,cx=c=>clamp(Math.floor((c-GX0)/TS),0,GX-1),cy=c=>clamp(Math.floor((c-GY0)/TS),0,GY-1);VB=[cx(cam.x-hw),cy(cam.y-hh),cx(cam.x+hw),cy(cam.y+hh)]}
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    const near=clamp((Math.log(cam.s)-Math.log(9000))/(Math.log(90000)-Math.log(9000)));
    const dim=1-.45*st.walk;
    common(F);blend('over');fill(V.waterF,pal.water,A.waterF);fill(V.townF,pal.warm,A.townF*(1-.7*near));
    // hail contours (calm: static lines, no particles)
    gl.useProgram(C.p);const u=C.u;gl.uniform2f(u.uCamD,cam.x,cam.y);gl.uniform1f(u.uScD,cam.s*d);gl.uniform2f(u.uVpD,cv.width,cv.height);gl.uniform1f(u.uDpr,d);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tR);gl.uniform1i(u.uR,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,tL);gl.uniform1i(u.uL,1);
    gl.uniform4f(u.uRB,...RB);gl.uniform4f(u.uLB,...LB);gl.uniform3fv(u.c1,pal.h1);gl.uniform3fv(u.c15,pal.h15);gl.uniform3fv(u.c2,pal.h2);
    gl.uniform1f(u.uThr,st.thr);gl.uniform1f(u.uAllA,pal.c.all*(1-.7*near)*dim);gl.uniform1f(u.uFeatA,pal.c.feat*(1-.55*near)*dim);gl.uniform1f(u.uFillA,pal.c.fill*(1-.4*near)*dim);gl.uniform1f(u.uGlow,(pal.add?.07:.03)*dim);
    blend(add==='add'?'add':'over');gl.bindVertexArray(triV);gl.drawArrays(gl.TRIANGLES,0,3);
    common(L);blend(add);
    line(V.county,pal.ink,A.county,.7,.5);
    if(A.glow)line(V.water,pal.water,A.glow*.6,3,.4);
    line(V.water,pal.water,A.water,.9,.5);line(V.stream,pal.water,A.stream,.8,.4);
    line(V.town,pal.warm,A.town*(1-.6*near),1,.5);
    line(V.rail,pal.ink,A.rail,.7,.4);line(V.arts,pal.ink,A.arts*(1-.4*near),.7,.4);
    if(A.glow)line(V.hwy,pal.ink,A.glow*.7,3.5,.3);line(V.hwy,pal.ink,A.hwy,1.1,.6);
    const sg=.3+.7*clamp((Math.log(cam.s)-Math.log(2500))/(Math.log(20000)-Math.log(2500)));
    if(A.glow){line(V.co1,pal.ink,A.glow*sg,3,.3);line(V.fr0,pal.ink,A.glow*sg*.8,3,.3)}
    line(V.co1,pal.ink,A.st0*sg,1+.5*near,.6);line(V.co3,pal.ink,A.st3*sg*(1+.6*near),.75+.5*near,.45);
    line(V.fr0,pal.ink,A.st0*sg,1,.6);line(V.fr3,pal.ink,A.st3*sg,.75,.45);
    // selected storm: thin centerline only (direction + extent), never particles
    line(V.storm,pal.h15,.5*st.storm,1.1,.7);
    // walk streets (walk view)
    if(st.walk>0){line(V.walk,pal.walk,.22*st.walk,clamp(.00008*cam.s,4,10),.5);line(V.walk,pal.walk,.85*st.walk,clamp(.000016*cam.s,1.2,2.4),1)}
    gl.bindVertexArray(null);
   }};
  try{R.upField()}catch(e){console.warn(e);R=null}
}
if(!R){ // Canvas2D fallback (no WebGL2): base lines only
  const c2=cv.getContext('2d');
  const strokeSegs=(arr,col,a,w)=>{c2.strokeStyle=`rgba(${col.map(v=>Math.round(v*255)).join(',')},${a})`;c2.lineWidth=w;c2.beginPath();
    for(let i=0;i<arr.length;i+=4){const p=[(arr[i]-cam.x)*cam.s+W()/2,H()/2-(arr[i+1]-cam.y)*cam.s],q=[(arr[i+2]-cam.x)*cam.s+W()/2,H()/2-(arr[i+3]-cam.y)*cam.s];c2.moveTo(p[0],p[1]);c2.lineTo(q[0],q[1])}c2.stroke()};
  const walkSegs={a:new Float32Array(0)};
  R={upField(){},setLines(k,arr){if(k==='walk')walkSegs.a=arr},resize(){const d=DPR();cv.width=W()*d;cv.height=H()*d;c2.setTransform(d,0,0,d,0,0)},
   draw(st){const pal=PAL[theme],A=pal.a;c2.clearRect(0,0,W(),H());
    [['county',pal.ink,A.county],['water',pal.water,A.water],['stream',pal.water,A.stream],['hwy',pal.ink,A.hwy],['co1',pal.ink,A.st0],['co3',pal.ink,A.st3],['fr0',pal.ink,A.st0]].forEach(([k,c,a])=>strokeSegs(G[k],c,a,1));
    if(st.walk>0)strokeSegs(walkSegs.a,pal.walk,.9*st.walk,2)}};
}

/* ================= state ================= */
const S={view:'morning',zone:PICKZ,walk:null,door:null,storm:S8.id,alt:false,hist:[]};
let dirty=true, thr=STILL?0:1.75, thrT0=0, walkA=0, stormA=0;
const featSet=id=>{const F=SF.find(f=>f.s.id===id);for(let i=0;i<RW*RH;i++)fieldR[i*2+1]=0;for(let i=0;i<LW*LH;i++)fieldL[i*2+1]=0;
  bakeField(RB,RW,RH,fieldR,1,[F]);bakeField(LB,LW,LH,fieldL,1,[F]);R.upField();
  const a=[];const p=F.s.path;for(let i=1;i<p.length;i++)a.push(X(p[i-1][0]),Y(p[i-1][1]),X(p[i][0]),Y(p[i][1]));R.setLines('storm',new Float32Array(a))};

/* ================= overlay: pins, labels, walk path (HTML/SVG over GL) ================= */
const pins=$('#pins');
const svgNS='http://www.w3.org/2000/svg';
const wsvg=document.createElementNS(svgNS,'svg');wsvg.setAttribute('width','100%');wsvg.setAttribute('height','100%');wsvg.style.cssText='position:absolute;inset:0;overflow:visible';
const wpathG=document.createElementNS(svgNS,'path'),wpath=document.createElementNS(svgNS,'path');
wpathG.setAttribute('fill','none');wpath.setAttribute('fill','none');wsvg.append(wpathG,wpath);pins.appendChild(wsvg);
const mk=(cls,html,parent=pins)=>{const at=document.createElement('div');at.className='at';at.style.cssText='position:absolute;left:0;top:0;will-change:transform;visibility:hidden;opacity:0';at.innerHTML=html;const el=at.firstElementChild;el.classList.add(...cls.split(' '));parent.appendChild(at);return at};
const zPins=ZONES.map((z,i)=>{const at=mk('pin'+(i===0?' pk':''),`<button aria-label="${esc(z.name)}"><span class="b">${z.rank}</span><span class="lb"></span></button>`);
  const b=at.firstElementChild;b.onclick=()=>zoneClick(z);b.onmouseenter=()=>hiZone(i,true);b.onmouseleave=()=>hiZone(i,false);return {at,z,lb:b.querySelector('.lb')}});
const hqPin=mk('plc hq',`<div></div>`);
const colZ=ZONES.filter(z=>z.c[0]<-97), colC=[colZ.reduce((a,z)=>a+z.c[0],0)/colZ.length,colZ.reduce((a,z)=>a+z.c[1],0)/colZ.length];
const IND=[{k:'col',c:colC,mi:45.5,n:colZ.length},{k:'bk',c:[BK.center.lon,BK.center.lat],mi:BK.dist_mi}].map(o=>{const at=mk('chip ind',`<button></button>`);
  at.firstElementChild.onclick=()=>{if(o.k==='bk'){$('#bk').click()}else flyTo(fit(llbb([Math.min(...colZ.map(z=>z.c[0])),Math.min(...colZ.map(z=>z.c[1])),Math.max(...colZ.map(z=>z.c[0])),Math.max(...colZ.map(z=>z.c[1]))],.008),gap('morning'),20))};return {...o,at}});
let walkEls=[],stEls=[],parkEl=null;
function buildWalkOverlay(w){
  walkEls.forEach(e=>e.at.remove());stEls.forEach(e=>e.at.remove());parkEl&&parkEl.remove();
  walkEls=w.homes.map((h,k)=>{const at=mk('door',`<button style="--dc:${h.col}" aria-label="${esc(h.addr)}">${k+1}</button>`);const b=at.firstElementChild;
    b.onclick=()=>selectDoor(k,true);b.onmouseenter=e=>{if(S.view!=='walk')return;showTipDoor(k,e.clientX,e.clientY);hlRow(k,true)};b.onmouseleave=()=>{hideTip();hlRow(k,false)};return {at,b,h}});
  // street names: walk streets + the named streets that cross the walk (real Nebraska GIS)
  const c=w.center,seen=new Set(w.streets.map(s=>skey(s.n)));const lab=[];
  // walk streets: label just past the far end, off the line; cross streets: a vertex 90-220 m out, away from the doors
  w.streets.forEach(s=>{const a=s.p[0],b=s.p[s.p.length-1],dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx*M_LON,dy*M_LAT)||1;
    lab.push({n:s.n,p:[b[0]+dx*M_LON/L*26/M_LON,b[1]+dy*M_LAT/L*26/M_LAT],w:true,ew:Math.abs(dx*M_LON)>Math.abs(dy*M_LAT)})});
  const far=q=>Math.min(...w.homes.map(h=>Math.hypot((q[0]-h.p[0])*M_LON,(q[1]-h.p[1])*M_LAT)));
  streetsAt(c[0]).forEach(l=>{const n=pretty(l.n);if(!n||seen.has(skey(n))||/Intersection|Service|Frontage/i.test(n))return;
    let best=null;l.p.forEach(p=>{const d=Math.hypot((p[0]-c[0])*M_LON,(p[1]-c[1])*M_LAT),f=far(p);if(d>90&&d<230&&f>38&&(!best||f>best.f))best={p,f}});
    if(best){seen.add(skey(n));lab.push({n,p:best.p,w:false})}});
  stEls=lab.slice(0,10).map(l=>{const at=mk('stl',`<div>${esc(l.n)}</div>`);if(l.w)at.firstElementChild.style.color='var(--acc-ink)';return {at,p:l.p,wd:l.n.length*6.4+10}});
  parkEl=mk('park',`<div style="flex-direction:row-reverse;transform:translate(calc(-100% + 11px),-50%)"><b>P</b><span>${lang==='es'?'Estaciónate':'Park'} ${fmtT(KN0-15)}</span></div>`);
  const a=[];w.streets.forEach(s=>{for(let i=1;i<s.p.length;i++)a.push(X(s.p[i-1][0]),Y(s.p[i-1][1]),X(s.p[i][0]),Y(s.p[i][1]))});R.setLines('walk',new Float32Array(a));
  dirty=true}
const place=(at,x,y,show)=>{at.style.transform=`translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;at.style.opacity=show?'':'0';at.style.visibility=show?'':'hidden'};
let doorsShown=0,doorsT0=0;
function layoutOverlay(now){
  const g=gap(S.view==='walk'?'walk':'morning'), inG=(x,y,m=0)=>x>g.l-m&&x<g.r+m&&y>g.t-m&&y<g.b+m;
  const mv=S.view==='morning';
  zPins.forEach((p,i)=>{const [x,y]=toScreen(p.z.c[0],p.z.c[1]);place(p.at,x,y,mv&&inG(x,y,6))});
  // HQ edge chip: Fremont is off to the east; clamp to the gap edge with the distance
  {const [x,y]=toScreen(NL.hq[0],NL.hq[1]);hqPin.firstElementChild.textContent=`◆ ${t('hq')}`;place(hqPin,x,y,mv&&inG(x,y))}
  IND.forEach(o=>{const [x,y]=toScreen(o.c[0],o.c[1]),inside=inG(x,y,-40);const b=o.at.firstElementChild;b.textContent=o.k==='col'?t('ind').col(o.n,o.mi):t('ind').bk(o.mi);
    const cx=clamp(x,g.l+8,g.r-8),cy=clamp(y,g.t+60,g.b-40);place(o.at,cx,cy,mv&&!inside);b.style.transform=x<g.l?'translate(0,-50%)':x>g.r?'translate(-100%,-50%)':'translate(-50%,-50%)'});
  const wv=S.view==='walk'&&S.walk, w=S.walk;
  if(w){
    const k=STILL?1e3:Math.floor((now-doorsT0)/45);
    walkEls.forEach((e,i)=>{const [x,y]=toScreen(e.h.p[0],e.h.p[1]);place(e.at,x,y,wv);e.b.classList.toggle('in',wv&&i<k);e.b.classList.toggle('sel',S.door===i)});
    const taken=walkEls.map(e=>{const [x,y]=toScreen(e.h.p[0],e.h.p[1]);return [x-12,y-12,x+12,y+12]});
    stEls.forEach(e=>{const [x,y]=toScreen(e.p[0],e.p[1]);const bx=[x-e.wd/2,y-8,x+e.wd/2,y+8];
      const hit=taken.some(b=>bx[0]<b[2]&&bx[2]>b[0]&&bx[1]<b[3]&&bx[3]>b[1]);if(!hit)taken.push(bx);place(e.at,x,y,wv&&!hit&&inG(x,y,-10))});
    {const [x,y]=toScreen(w.park[0],w.park[1]);place(parkEl,x,y,wv)}
    if(wv){let d='';w.path.forEach((q,i)=>{const [x,y]=toScreen(q[0],q[1]);d+=(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)});
      const col=theme==='light'?'#b4540c':'#ffa766';wpath.setAttribute('d',d);wpathG.setAttribute('d',d);
      wpath.setAttribute('stroke',col);wpath.setAttribute('stroke-width','1.6');wpath.setAttribute('stroke-dasharray','2 5');wpath.setAttribute('stroke-linecap','round');
      wpathG.setAttribute('stroke',col);wpathG.setAttribute('stroke-opacity','.12');wpathG.setAttribute('stroke-width','8');wpathG.setAttribute('stroke-linejoin','round');
      const L=wpath.getTotalLength?wpath.getTotalLength():0;const prog=STILL?1:clamp((now-doorsT0)/1400);wpath.style.opacity=wpathG.style.opacity=prog>0?1:0;
      wpathG.setAttribute('stroke-dasharray',`${L*prog} ${L}`)}
    else{wpath.style.opacity=wpathG.style.opacity=0}
    if(wv&&(k<walkEls.length+2||now-doorsT0<1600))dirty=true;
  }
}

/* ================= panels: render ================= */
const icoArrow='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
function renderStatic(){
  $$('[data-t]').forEach(el=>{const v=t(el.dataset.t);if(typeof v==='string')el.innerHTML=v});
  $('#headline').textContent=NL.headline[lang];
  $$('[data-lang]').forEach(b=>b.tagName==='BUTTON'&&b.setAttribute('aria-pressed',b.dataset.lang===lang));
  $$('[data-theme]').forEach(b=>b.tagName==='BUTTON'&&b.setAttribute('aria-pressed',b.dataset.theme===theme));
  root.lang=lang;root.dataset.lang=lang;
}
function renderPick(){
  const alt=S.alt,z=alt?BK:P,L=T[lang],[town,sts]=z.name.split(': '),w=walkFor(PICKZ);
  $('#pk-h').innerHTML=`${esc(town)}<span class="sep">.</span><span class="sts">${esc(sts||'')}</span>`;
  $('.pick .eyebrow span[data-t]').textContent=alt?t('backup'):t('pickEye');
  $('.pick .eyebrow .n').textContent=alt?(lang==='es'?`#${ZONES.length} · zona diaria`:`#${ZONES.length} · everyday zone`):L.pickOf(ZONES.length);
  const st=$$('.pick .st');
  st[0].querySelector('.v').innerHTML=`${z.doors}<sup class="s" data-src="engine">2</sup>`;
  st[0].querySelector('.u').textContent=alt?(lang==='es'?'en la ruta':'on the walk'):L.doorsU(w.streets.length);
  st[1].classList.toggle('hot',!alt);
  st[1].querySelector('.v').innerHTML=alt?`—<small>${lang==='es'?'sin granizo':'no hail'}</small>`:`${P.hail_in.toFixed(2)}<small>${t('in')}</small><sup class="s" data-src="storms">1</sup>`;
  st[1].querySelector('.u').textContent=alt?(lang==='es'?'zona diaria · casas antiguas':'everyday zone · older homes'):L.hailU(S8.d[lang]);
  st[2].querySelector('.v').innerHTML=`${z.dist_mi}<small>mi</small><sup class="s" data-src="drive">2</sup>`;
  st[2].querySelector('.u').textContent=L.driveU(driveMin(z.dist_mi));
  st[3].querySelector('.u').textContent=L.bestU(fmtT(SUN(z.center.lon).ss));
  $('#why').textContent=z.why[lang];
  $('#area').innerHTML=alt?t('bkArea'):t('area')(AREA);
  const bk=$('#bk'),[pt,ps]=P.name.split(': ');bk.querySelector('.k').textContent=alt?t('bkLabel'):t('backup');
  bk.querySelector('.v').textContent=alt?`${pt} · ${ps}`:BK.name.replace(': ',' · ');
  bk.querySelector('.m').textContent=alt?L.bkM(P.dist_mi,P.doors,P.hail_in.toFixed(2)+'″'):L.bkM(BK.dist_mi,BK.doors,BK.score);
  $('#go').innerHTML=`<span>${t('start')}</span>${icoArrow}`;
}
function renderZones(){
  const ul=$('#zones');ul.innerHTML='';
  ZONES.forEach((z,i)=>{const li=document.createElement('li');if(i===0)li.className='first';
    const [town,nm]=z.name.split(': ');const col=hailHex(z.kind==='storm'?1+(z.score-zmin)/(zmax-zmin||1):null);
    li.innerHTML=`<button data-z="${i}"><span class="r">${String(z.rank).padStart(2,'0')}</span><span class="nm">${esc(nm||z.name)}<em>${esc(town)}${z.kind!=='storm'?' · '+t('everyday'):''}</em></span>
      <span class="bar"><i style="width:${Math.round(z.score)}%;background:${col}"></i></span><span class="sc">${z.score.toFixed(1)}</span><span class="ar">→</span></button>`;
    const b=li.firstElementChild;b.onclick=()=>zoneClick(z);b.onmouseenter=()=>hiZone(i,true);b.onmouseleave=()=>hiZone(i,false);ul.appendChild(li)});
}
function hiZone(i,on){const p=zPins[i];p&&p.at.firstElementChild.classList.toggle('hov',on);const b=$(`#zones [data-z="${i}"]`);b&&b.classList.toggle('sel',on);
  if(p){const z=p.z,[town,nm]=z.name.split(': ');p.lb.textContent=i===0&&!on?`#1 · ${nm} · ${z.score}`:`#${z.rank} · ${nm||z.name} · ${z.score}${z.kind==='storm'?' · 3D →':''}`}}
function renderPlan(){
  const w=walkFor(PICKZ),first=w.homes[0],nd=w.homes.filter(h=>h.eta>=SUNSET).length,dm=driveMin(P.dist_mi),lv=KN0-15-dm,[town,sts]=P.name.split(': ');
  const seq=w.streets.map(s=>`${s.n} ${s.h}`).join(' → '), park=w.parkName, ssT=fmtT(SUNSET).replace(/ ?(PM|AM|p\. m\.|a\. m\.)/,''), dkT=fmtT(DUSK).replace(/ ?(PM|AM|p\. m\.|a\. m\.)/,'');
  const rows=[
   {tm:7*60+2,c:'now',en:['Pick ready',`${town} · ${sts}`],es:['Elección lista',`${town} · ${sts}`],kv:{en:`${P.doors} doors`,es:`${P.doors} puertas`}},
   {tm:9*60,en:['Prep',`${P.doors} door cards · cancel forms EN + ES`],es:['Preparar',`${P.doors} fichas · formularios de cancelación EN + ES`],kv:{en:'~30 min',es:'~30 min'}},
   {tm:lv,en:['Leave HQ',`2600 Laverna St → ${park}`],es:['Salir de la base',`2600 Laverna St → ${park}`],kv:{en:`${P.dist_mi} mi · ${dm} min`,es:`${P.dist_mi} mi · ${dm} min`}},
   {tm:KN0-15,en:['Park',`${park} · door 1: ${first.addr}`],es:['Estacionarse',`${park} · puerta 1: ${first.addr}`],kv:{en:'15 min early',es:'15 min antes'}},
   {tm:KN0,c:'win',en:['Knock · 4:00–7:30',seq],es:['Tocar · 4:00–7:30',seq],kv:{en:`${w.homes.length} · ~${Math.round((KN1-KN0)/w.homes.length)} min ea`,es:`${w.homes.length} · ~${Math.round((KN1-KN0)/w.homes.length)} min c/u`}},
   {tm:SUNSET,c:'warn',en:['Sunset',`civil dusk ${dkT} · ${nd} door${nd===1?'':'s'} after sunset`],es:['Puesta de sol',`crepúsculo ${dkT} · ${nd} puerta${nd===1?'':'s'} después`],kv:{en:`☼ ${ssT}`,es:`☼ ${ssT}`}},
   {tm:KN1,en:['Wrap up',`log doors · back at HQ ~${fmtT(KN1+10+dm)}`],es:['Cerrar',`registrar puertas · en la base ~${fmtT(KN1+10+dm)}`],kv:{en:`${P.dist_mi} mi`,es:`${P.dist_mi} mi`}}];
  $('#plan').innerHTML=rows.map(r=>`<li class="${r.c||''}"><span class="tm">${fmtT(r.tm)}</span><span class="tx">${esc(r[lang][0])}<em>${esc(r[lang][1])}</em></span><span class="kv">${esc(r.kv[lang])}</span></li>`).join('');
  // day bar 7 AM - 9 PM
  const a=7*60,b=21*60,pc=m=>((m-a)/(b-a)*100).toFixed(2)+'%',wd=(m0,m1)=>((m1-m0)/(b-a)*100).toFixed(2)+'%';
  const ax=[[7*60,'7a'],[10*60,'10a'],[13*60,'1p'],[16*60,'4p'],[19*60,'7p'],[21*60,'9p']];
  $('#day').innerHTML=`<div class="trk"><i class="sg off" style="left:${pc(9*60)};width:${wd(9*60,9*60+30)}"></i><i class="sg drv" style="left:${pc(lv)};width:${wd(lv,KN0)}"></i>
    <i class="sg kn" style="left:${pc(KN0)};width:${wd(KN0,KN1)}"></i><i class="sg drv" style="left:${pc(KN1)};width:${wd(KN1,KN1+10+dm)}"></i><i class="sg dusk" style="left:${pc(SUNSET)};width:${wd(SUNSET,DUSK)}"></i></div>
    <i class="now" style="left:${pc(7*60+2)}" title="now"></i><i class="sun" style="left:${pc(SUNSET)}"></i>
    <div class="ax">${ax.map(([m,l])=>`<span style="left:${pc(m)}">${l}</span>`).join('')}<span class="sn" style="left:calc(${pc(SUNSET)} + 14px)">☼</span></div>`;
}
const STORMS=NL.storms.map(s=>{const ar=NL.areas.filter(a=>a.st===s.id);const zn=ZONES.filter(z=>z.id.startsWith(s.date)).length;
  const mid=s.path[Math.floor(s.path.length/2)];const near=Object.entries(NL.places).reduce((b,[n,p])=>{const d=Math.hypot(p[0]-mid[0],p[1]-mid[1]);return d<b.d?{d,n}:b},{d:1e9,n:''}).n;
  const names=[...new Set(ar.sort((a,b)=>b.homes-a.homes).map(a=>a.name.en))];
  return {s,ar,zn,homes:ar.reduce((t,a)=>t+(a.homes||0),0),names,near,n:dayN(s.date)}});
function renderHail(){
  const L=T[lang],all=STORMS.length,d90=STORMS.filter(x=>x.n<=90).length,big=Math.max(...STORMS.map(x=>x.s.max)),bigD=STORMS.filter(x=>x.s.max===big).map(x=>x.s.d[lang]).join(lang==='es'?' y ':' & '),last=STORMS[0];
  $('#hsum').innerHTML=[L.sum.all(all),L.sum.d90(d90),L.sum.big(big,bigD)].map(s=>`<span class="chip">${esc(s)}</span>`).join('');
  $('#hlist').innerHTML=STORMS.map(x=>{const s=x.s,pk=s.id===S8.id,wd=WD[lang][wday(s.date)];
    const where=x.names.length?x.names.slice(0,2).join(', ')+(x.names.length>2?` +${x.names.length-2}`:''):L.near(x.near);
    const l1=[where,x.zn?L.zonesN(x.zn):null].filter(Boolean).join(' · ');
    const tm=s.time?s.time.replace(/(\d+:\d+) (AM|PM)[–-](\d+:\d+) \2/,'$1–$3 $2').replace(/AM/g,lang==='es'?'a. m.':'AM').replace(/PM/g,lang==='es'?'p. m.':'PM'):L.noTime;
    const l2=[tm,x.homes?L.homesIn(x.homes.toLocaleString('en-US')):null].filter(Boolean).join(' · ');
    return `<li class="${pk?'pk':''}${x.n>90?' old':''}"><button data-s="${s.id}" class="${S.storm===s.id?'sel':''}"><span class="dt"><b>${esc(s.d[lang])}</b><span>${wd} · ${esc(L.ago(x.n))}</span></span>
      <span class="l1">${esc(l1)}</span><span class="l2">${esc(l2)}</span>
      <span class="sz"><span class="hz"><i style="background:${hailHex(s.max)}"></i>${s.max.toFixed(2)}″</span><small${pk?' style="color:var(--acc-ink)"':''}>${pk?L.pickStorm:L.max}</small></span></button></li>`}).join('');
  $$('#hlist button').forEach(b=>b.onclick=()=>stormClick(b.dataset.s));
  $('#srcs').innerHTML=t('srcs');
}
function renderLegend(){const x=STORMS.find(q=>q.s.id===S.storm),F=SF.find(f=>f.s.id===S.storm);
  const peak=Math.max(x.s.max,...F.areas.map(a=>a.amp),...F.zones.map(z=>z.amp)).toFixed(2);
  $('#legend').innerHTML=`<div><div>${t('legend')(x.s.long[lang],peak)}<sup class="s" data-src="storms">1</sup></div><div style="color:var(--muted);font-size:10px;margin-top:2px">${t('legendAll')}</div></div>
    <div><div class="ramp"></div><div class="ticks"><span>1″</span><span>1.5″</span><span>2″+</span></div></div>
    ${S.storm!==S8.id?`<button class="back" id="lgBack" style="height:28px">${esc(t('showPick'))}</button>`:''}`;
  const lb=$('#lgBack');lb&&(lb.onclick=()=>stormClick(S8.id))}

/* ---------- walk view ---------- */
function renderWalk(){const w=S.walk;if(!w)return;const L=T[lang],n=w.homes.length;
  const [wt,ws]=w.name.split(': ');$('#wk-h').textContent=ws||wt;
  $('#wkP').textContent=`${wt} · `+L.walkP(w.parkName,w.streets.length,w.homes[0].addr);
  $('#wkChip').textContent=t('sample');
  const left=S.door==null?n:n-S.door;
  $('#wsum').innerHTML=[[L.ws.doors,`${left}<small>/ ${n}</small>`],[L.ws.start,fmtT(KN0).replace(/ (PM|AM|p\. m\.|a\. m\.)/,'<small>$1</small>')],
    [L.ws.walking,`${(w.len/1609).toFixed(1)}<small>mi</small>`],[L.ws.ends,fmtT(KN1).replace(/ (PM|AM|p\. m\.|a\. m\.)/,'<small>$1</small>')]].map(([k,v])=>`<div><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
  let html='',cur=-1,sun=false;
  w.homes.forEach((h,k)=>{
    if(h.si!==cur){cur=h.si;const s=w.streets[h.si];html+=`<li class="stp">${L.stp(esc(s.n),s.h,L.dirs[s.dir])}</li>`}
    if(!sun&&h.eta>=w.sun.ss){sun=true;html+=`<li class="stp" style="color:var(--cool)">☼ ${esc(L.sunsetRow(fmtT(w.sun.ss),fmtT(w.sun.dk)))}</li>`}
    html+=`<li><button data-k="${k}" class="${S.door===k?'sel':''}" style="--dc:${h.col}"><span class="o">${k+1}</span><span class="ad">${esc(h.addr)} <span style="color:var(--muted);font:500 10.5px var(--mono)">${fmtT(h.eta)}</span></span>
      <span class="n">${h.hail.toFixed(2)}″</span><span class="n">~${h.roof}${lang==='es'?'a':'y'}</span><span class="n sc">${h.score}</span><span class="wy">${esc(L.why(h))}</span></button></li>`});
  const dl=$('#dl');dl.innerHTML=html;
  $$('#dl button').forEach(b=>{const k=+b.dataset.k;b.onclick=()=>selectDoor(k,true);b.onmouseenter=()=>{walkEls[k]&&walkEls[k].b.classList.add('sel');holo&&S.view==='road'&&holo.hover(k)};
    b.onmouseleave=()=>{walkEls[k]&&S.door!==k&&walkEls[k].b.classList.remove('sel');holo&&S.view==='road'&&holo.hover(null)}});
  renderDoor();renderRoadPanel()}
function hlRow(k,on){const b=$(`#dl [data-k="${k}"]`);b&&b.classList.toggle('sel',on||S.door===k)}
function renderDoor(){const w=S.walk;if(!w)return;const L=T[lang],n=w.homes.length,k=S.door==null?0:S.door,h=w.homes[k];
  $('#dcardIn').innerHTML=`<div class="top2"><span class="chip hot">${esc(L.doorOf(k+1,n))}</span><span class="chip">${esc(t('sample'))}</span></div>
   <h3>${esc(h.addr)}</h3><p class="sub">${esc(h.st)} · ${esc(L.eta(fmtT(h.eta)))} · ${esc(L.after(n-k-1))}</p>
   <div class="big2"><div><span class="k">${L.bigHail}</span><span class="v" style="color:${h.col}">${h.hail.toFixed(2)}<small>″</small></span></div>
     <div><span class="k">${L.bigRoof}</span><span class="v">~${h.roof}<small>${L.f.yrs}</small></span></div></div>
   <p class="whyd"><b>${L.whyH}</b> ${esc(L.whyLong(h))}</p>
   <dl class="facts">
     <div><dt>${L.f.hail(w.zone.id===P.zone_id?S8.d[lang]:(NL.storms.find(s=>w.zone.id.startsWith(s.date))||S8).d[lang])}</dt><dd>${h.hail.toFixed(2)} ${lang==='es'?'pulg':'in'}<sup class="s" data-src="storms">1</sup></dd></div>
     <div><dt>${L.score}</dt><dd>${h.score}<sup class="s" data-src="engine">2</sup></dd></div>
     <div><dt>${L.f.built}</dt><dd>${h.built}</dd></div>
     <div><dt>${L.f.own}</dt><dd class="${h.own?'y':''}">${h.own?L.f.yes:L.f.no}</dd></div>
     <div><dt>${L.f.type}</dt><dd class="y">${L.f.typeV}</dd></div>
     <div><dt>${L.f.areaIns}</dt><dd>${insWord(w.area)}<sup class="s" data-src="census">3</sup></dd></div>
   </dl>
   <div class="nav2"><button id="pv" ${k===0?'disabled style="opacity:.4"':''}>${L.prev}</button><button id="nx" ${k===n-1?'disabled style="opacity:.4"':''}>${L.next}</button></div>
   <div class="legal" style="margin-top:12px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/></svg><span>${esc(L.legal)}</span></div>
   <p class="fine">${esc(L.fine)}</p>`;
  $('#pv').onclick=()=>k>0&&selectDoor(k-1,true);$('#nx').onclick=()=>k<n-1&&selectDoor(k+1,true)}
function selectDoor(k,fromUser){S.door=k;dirty=true;
  $$('#dl button').forEach(b=>b.classList.toggle('sel',+b.dataset.k===k));$$('#dots button').forEach(b=>b.classList.toggle('sel',+b.dataset.k===k));
  renderDoor();renderWalkSum();
  const b=$(`#dl [data-k="${k}"]`);b&&b.scrollIntoView({block:'nearest',behavior:STILL?'auto':'smooth'});
  if(S.view==='road'&&holo&&fromUser)holo.select(k)}
function renderWalkSum(){const w=S.walk;if(!w)return;const v=$('#wsum .v');if(v)v.innerHTML=`${w.homes.length-(S.door==null?0:S.door)}<small>/ ${w.homes.length}</small>`}

/* ---------- road view ---------- */
function renderRoadPanel(){const w=S.walk;if(!w)return;const L=T[lang];
  {const [rt,rs]=w.name.split(': ');$('#rdH').textContent=rs||rt}
  $('#rdP').textContent=`${w.name.split(': ')[0]} · `+L.roadP(w.streets.length,w.homes.length);
  const hmax=Math.max(...w.homes.map(h=>h.hail));
  $('#rstats').innerHTML=[[L.road.doors,w.homes.length],[L.road.hail,hmax.toFixed(2)+'″'],[L.road.walk,(w.len/1609).toFixed(1)+' mi'],[L.road.start,fmtT(KN0)]].map(([k,v])=>`<div><span class="k">${k}</span><span class="v">${v}</span></div>`).join('');
  let html='',cur=-1;w.homes.forEach((h,k)=>{if(h.si!==cur&&cur!==-1)html+='<i class="gap"></i>';cur=h.si;html+=`<button data-k="${k}" style="--dc:${h.col}" class="${S.door===k?'sel':''}" aria-label="${esc(h.addr)}">${k+1}</button>`});
  $('#dots').innerHTML=html;
  $$('#dots button').forEach(b=>{const k=+b.dataset.k;b.onclick=()=>selectDoor(k,true);b.onmouseenter=()=>holo&&holo.hover(k);b.onmouseleave=()=>holo&&holo.hover(null)});
  $('#hint').innerHTML=t('hint');
  const prev=S.hist[S.hist.length-1];$('#rdBackT').textContent=prev&&prev.view==='walk'?L.back.walk:L.back.morning}
function sceneFor(w){
  const c=w.center,dm=q=>Math.hypot((q[0]-c[0])*M_LON,(q[1]-c[1])*M_LAT);
  const streets=streetsAt(c[0]).filter(l=>l.p.some(q=>dm(q)<520)).map(l=>({n:pretty(l.n),p:l.p,walk:false,c:l.c}));
  w.streets.forEach(s=>streets.push({n:s.n,p:s.p,walk:true,c:3}));
  return {center:c,streets,homes:w.homes.map(h=>({addr:h.addr,p:h.p,hail:h.hail,score:h.score,own:h.own,built:h.built,roof:h.roof,order:h.order,col:h.col})),
    path:w.path,park:w.park,walkStreets:w.streets.map(s=>s.n)}}

/* ================= tooltips + toast ================= */
const tip=$('#tip');
function showTip(html,x,y){tip.innerHTML=html;tip.classList.add('show');const r=tip.getBoundingClientRect();tip.style.left=clamp(x+14,8,W()-r.width-8)+'px';tip.style.top=clamp(y+14,8,H()-r.height-8)+'px'}
const hideTip=()=>tip.classList.remove('show');
function showTipDoor(k,x,y){const h=S.walk&&S.walk.homes[k];if(!h)return;const L=T[lang];
  showTip(`<b>${k+1} · ${esc(h.addr)}</b><div class="tb"><span style="color:${h.col}">${h.hail.toFixed(2)}″</span><span>~${h.roof} ${L.f.yrs}</span></div><div class="m">${L.score} ${h.score} · ${fmtT(h.eta)}</div><div class="m" style="color:var(--muted)">${esc(L.why(h))}</div>`,x,y)}
document.addEventListener('mouseover',e=>{const s=e.target.closest&&e.target.closest('sup.s');if(!s)return;const txt=SRC[lang][s.dataset.src];if(txt){const r=s.getBoundingClientRect();showTip(`<div class="m" style="color:var(--text-2)">${esc(txt)}</div>`,r.left,r.bottom)}});
document.addEventListener('mouseout',e=>{if(e.target.closest&&e.target.closest('sup.s'))hideTip()});
let toastT=0;function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('show'),3600)}

/* ================= navigation ================= */
const holoCv=$('#holo');let holoPtr=false; // only show hover cards after a real pointer move over the 3D view
holoCv.addEventListener('pointermove',()=>holoPtr=true);holoCv.addEventListener('pointerleave',()=>{holoPtr=false;hideTip()});
const holo=window.createHolo?(()=>{try{return window.createHolo(holoCv,$('#hl'),{
  onHover:(i,x,y)=>{if(i==null||!holoPtr){hideTip();return}showTipDoor(i,x,y)},onSelect:i=>selectDoor(i,false),
  onTourEnd:()=>$('#tour').setAttribute('aria-pressed','false')})}catch(e){console.warn(e);return null}})():null;
const holoOK=!!(holo&&holo.ok!==false);
if(holo){try{holo.setTheme(theme);holo.setReduced(STILL)}catch(e){}}
function setView(v){S.view=v;document.body.dataset.view=v;
  $$('.crumbs button').forEach(b=>{b.setAttribute('aria-current',b.dataset.go===v?'page':'false');b.disabled=b.dataset.go!=='morning'&&!canWalk(S.zone)});
  hideTip();dirty=true}
const canWalk=z=>z&&z.kind==='storm';
function go(v,opt={}){
  if(v===S.view&&!opt.force)return;
  if(!opt.noHist)S.hist.push({view:S.view,zone:S.zone});
  const from=S.view;
  if(v==='morning'){S.alt=false;renderPick();if(holo)holo.stop();setView('morning');walkA=0;flyTo(S.storm===S8.id?camMorning():camStorm(SF.find(f=>f.s.id===S.storm)));S.hist=[];return}
  const z=opt.zone||S.zone;if(!canWalk(z)){toast(t('toastOmaha'));S.hist.pop();return}
  if(S.zone!==z||!S.walk){S.zone=z;S.walk=walkFor(z);S.door=opt.door!=null?opt.door:null;buildWalkOverlay(S.walk)}
  if(opt.door!=null)S.door=opt.door;
  renderWalk();
  if(v==='walk'){if(holo)holo.stop();setView('walk');walkA=1;doorsT0=performance.now()+(STILL?0:600);
    if(from==='road'){Object.assign(cam,camWalk(S.walk));doorsT0=0;dirty=true}else flyTo(camWalk(S.walk),()=>{doorsT0=performance.now()});return}
  if(v==='road'){
    if(!holoOK){toast(t('toastNoGL'));go('walk',{noHist:true});return}
    Object.assign(cam,camWalk(S.walk));walkA=1;
    holo.load(sceneFor(S.walk));holo.start();holo.enter({instant:STILL});
    setView('road');renderRoadPanel();if(S.door!=null)holo.select(S.door);
    $('#tour').setAttribute('aria-pressed','false');$('#orbit').setAttribute('aria-pressed',String(!STILL));holo.setOrbit(!STILL)}
}
function back(){const p=S.hist.pop();if(!p){if(S.view!=='morning')go('morning',{noHist:true});else if(S.storm!==S8.id)stormClick(S8.id);return}
  if(p.view==='morning')go('morning',{noHist:true});else go(p.view,{zone:p.zone,noHist:true})}
$$('[data-back]').forEach(b=>b.onclick=back);
$('#rdHome').onclick=()=>go('morning');
$$('.crumbs button').forEach(b=>b.onclick=()=>{if(b.dataset.go!==S.view)go(b.dataset.go,{zone:S.zone})});
addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();back()}});
$('#go').onclick=()=>{if(S.alt){toast(t('toastOmaha'));return}go('walk',{zone:PICKZ})};
$('#toRoad').onclick=()=>go('road');
$('#bk').onclick=()=>{S.alt=!S.alt;renderPick();const z=ZONES.find(q=>q.kind!=='storm');
  flyTo(S.alt?fit([X(z.c[0])-.05,Y(z.c[1])-.035,X(z.c[0])+.05,Y(z.c[1])+.035],gap('morning'),20):camMorning())};
function zoneClick(z){if(!canWalk(z)){toast(t('toastOmaha'));const zz=z;flyTo(fit([X(zz.c[0])-.05,Y(zz.c[1])-.035,X(zz.c[0])+.05,Y(zz.c[1])+.035],gap('morning'),20));return}
  go('road',{zone:z})}
function stormClick(id){S.storm=id;featSet(id);thr=STILL?0:1.2;thrT0=performance.now();renderHail();renderLegend();
  flyTo(id===S8.id?camMorning():camStorm(SF.find(f=>f.s.id===id)))}
$('#tour').onclick=()=>{const on=$('#tour').getAttribute('aria-pressed')!=='true';$('#tour').setAttribute('aria-pressed',String(on));holo&&holo.setTour(on)};
$('#orbit').onclick=()=>{const on=$('#orbit').getAttribute('aria-pressed')!=='true';$('#orbit').setAttribute('aria-pressed',String(on));holo&&holo.setOrbit(on)};
$('#topdown').onclick=()=>holo&&holo.topDown();
$$('[data-lang]').forEach(b=>b.tagName==='BUTTON'&&(b.onclick=()=>{lang=b.dataset.lang;try{localStorage.setItem('nl-d-lang',lang)}catch(e){}renderAll()}));
$$('[data-theme]').forEach(b=>b.tagName==='BUTTON'&&(b.onclick=()=>{theme=b.dataset.theme;try{localStorage.setItem('nl-d-theme',theme)}catch(e){}root.dataset.theme=theme;
  Object.values(WALKS).forEach(w=>w.homes.forEach(h=>h.col=hailHex(h.hail)));if(S.walk)buildWalkOverlay(S.walk);holo&&holo.setTheme(theme);
  if(S.view==='road'&&holo)holo.load(sceneFor(S.walk)),holo.enter({instant:true}),S.door!=null&&holo.select(S.door);renderAll()}));
function renderAll(){renderStatic();renderPick();renderZones();renderPlan();renderHail();renderLegend();if(S.walk){renderWalk()}hiZone(0,false);
  $$('.crumbs button').forEach(b=>b.setAttribute('aria-current',b.dataset.go===S.view?'page':'false'));dirty=true}

/* ================= loop ================= */
function layoutZl(){const b=$('#pick').getBoundingClientRect();root.style.setProperty('--zlTop',Math.round(b.bottom+8)+'px')}
function resize(){R.resize();layoutZl();if(holo)holo.resize();if(!fly){const v=S.view;Object.assign(cam,v==='morning'?(S.alt?cam:S.storm===S8.id?camMorning():camStorm(SF.find(f=>f.s.id===S.storm))):camWalk(S.walk))}dirty=true}
addEventListener('resize',resize);
function frame(now){
  stepFly(now);
  if(thr>0){thr=STILL?0:Math.max(0,(thrT0?1.2:1.75)-(now-thrT0)/1000*(thrT0?1.1:1.0));dirty=true}
  const wt=S.view==='walk'||S.view==='road'?1:0;if(Math.abs(walkA-wt)>.01&&!STILL){walkA+=(wt-walkA)*.12;dirty=true}else walkA=wt;
  const st=S.storm!==S8.id?1:0;if(Math.abs(stormA-st)>.01&&!STILL){stormA+=(st-stormA)*.15;dirty=true}else stormA=st;
  if(dirty&&S.view!=="road"||dirty&&fly){dirty=false;R.draw({thr,walk:walkA,storm:stormA});layoutOverlay(now)}
  requestAnimationFrame(frame)}

/* ================= boot ================= */
root.dataset.theme=theme;
renderAll();
R.resize();
const qv=Q.get('view'), qz=+(Q.get('zone')||1)-1, qd=Q.get('door');
if(qv==='walk'||qv==='road'){Object.assign(cam,camMorning());document.body.classList.remove('intro');
  go(qv==='road'?'walk':qv,{zone:ZONES[qz]||PICKZ,door:qd!=null?+qd-1:null,noHist:qv==='walk'});
  if(qv==='road'){fly&&(Object.assign(cam,fly.to),fly=null);doorsT0=0;go('road',{zone:S.zone})}
  if(qd!=null)selectDoor(+qd-1,true)}
else{
  const to=camMorning();
  if(STILL){Object.assign(cam,to);thr=0}
  else{Object.assign(cam,{x:to.x+.012,y:to.y-.02,s:to.s*.42});thrT0=0;flyTo(to,null,2000)}
  setView('morning');
}
layoutZl();(document.fonts&&document.fonts.ready||Promise.resolve()).then(layoutZl);
setTimeout(()=>document.body.classList.remove('intro'),50);
// bake the hail field after the first paint; contours then ripple out from the core
setTimeout(()=>{bakeField(RB,RW,RH,fieldR,0,SF);bakeField(LB,LW,LH,fieldL,0,SF);featSet(S.storm);thr=STILL?0:1.2;thrT0=performance.now();dirty=true},30);
requestAnimationFrame(frame);
})();
