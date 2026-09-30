# Claude's Aldaba · builder contract

One page, one continuous world. A full-bleed Nebraska map (`A.world`) sits behind everything; each view is a
camera position on it plus panels in fixed slots. Changing view = a van Wijk camera flight while the old panels
leave (140 ms) and the new ones land like hail (spring, ~5% overshoot, 45 ms stagger).

## 1. Folder and owners

| File | Owner | Notes |
|---|---|---|
| `index.html`, `css/base.css`, `js/core.js`, `js/world.js`, `js/boot.js`, `dev/*`, `files.json`, `CONTRACT.md` | foundation | ask before changing; never fork a copy |
| `js/now.js` + `css/now.css` | Now builder | replace the stub, keep `A.view.register('now', …)` |
| `js/storms.js` + `css/storms.css` | Storms builder | |
| `js/knock.js` + `css/knock.css` | Knock builder | |
| `js/deal.js` + `css/deal.css` | Deal builder | |
| `js/money.js` + `css/money.css` | Money builder | |
| `js/intro.js` + `css/intro.css` | cinema builder | the cold open (`A.intro`) |
| `js/director.js` + `css/director.css` | integration | the film (`A.director`), the credits, the key sheet |
| `data/nl.js` (`NL`), `data/extra.js` (`NLX`) | data | read-only |
| `data/copy.js` (`COPY`), `js/lib/{funnel,hailgl,house,route,sound}.js` | their authors | already loaded by `index.html` |

Every script and stylesheet is already wired into `index.html` and `files.json`, so builders never edit either.
A new file of yours: put it in `js/lib/` or `data/`, then ask the foundation to add the tag and the map entry.
Scope your CSS under `:root[data-view="<view>"]` or classes prefixed `<view>-`.

## 2. The rules in 10 lines

1. Touch only your files. No git commits. No fetch to other hosts; external scripts only from cdnjs (pinned).
2. Every visible string EN + ES: `A.L(en, es)` in HTML, `A.t({en,es})` in canvas. Natural Latin American Spanish.
3. Every color is a token (`var(--x)` in CSS, `A.tok('--x')` / `f.pal.x` in canvas, re-read on `theme`). No literals.
4. Every number shows who said it: `A.ui.srcTag('spc'|'mrms'|'census'|'engine'|'law'|'goal'|…)`.
5. Homes are fake samples: `A.ui.sampleTag()`, never owner names. Say "likely insured" (an area estimate), never "insured".
6. "Registered", never "licensed". No "free/gratis", no deductible talk, never imply insurance pays, no fake urgency, no sales coaching.
7. Homeowner-facing surfaces say "HMP Siding & Roofing"; salesman screens carry the Aldaba mark.
8. Animate only transform/opacity (and canvas/WebGL). Motion means something. Everything honors `A.still`.
9. Nothing may freeze the page: wrap risky work (`A.safe(label, fn)`), and the rest keeps running.
10. Test at 1440×900, 1280×800 and 400×860 (dark + light, EN + ES): zero console errors, zero horizontal scroll.

## 3. Layout and slots

| | 1440×900 | 1280×800 | 400×860 (≤900 px stacks) |
|---|---|---|---|
| top bar `#topbar` | top 12, h 52, 16 px gutters | top 10 (short screens) | sticky, 3 rows: brand+controls / tabs / clock+chip |
| `#slot-left` | x 16, w 440, y 76 → bottom 16, solid panel, scrolls inside | w 420 | full width in page flow |
| `#slot-right` | right 16, w 320, y 76, height = content (max to bottom 16) | w 296 | in flow, after left |
| `#slot-bottom` (dock) | bottom 16, between left/right, max-height 44% | same | in flow, last |
| `#slot-center` | the free map area between slots (flex column, top-center); itself click-through | same | in flow, first |
| `#slot-overlay` | full screen, click-through except its children (intro, director, modals); cleared on view change except children with `data-keep` | same | fixed |
| `#world` (map) | full window behind all | same | block under the bar: `clamp(300px, 58vh, 560px)`, 16 px gutters, rounded |

A slot shows its surface only while it has children (core sets `data-on`; surfaces land and leave with motion).
`left`, `right` and `bottom` are solid surfaces: put content in `.pane` sections. `center` and `overlay` have no
surface: give your element `.float` (solid card) or build your own. The map's focus area (where camera targets
center) is the rectangle between visible slots and below the bar; core measures it after `enter()`.
If you resize panels later, call `A.view.relayout()`.

## 4. `window.A` API (js/core.js)

**Data + events**
- `A.data` = `NL`, `A.x` = `NLX`, `A.story = {today:'2026-09-29', time:'07:02'}` (story time: the app lives at 7:02 AM).
- `A.on(ev, fn) → off`, `A.off`, `A.once`, `A.emit(ev, detail)`. Events: `lang`, `theme`, `theme:choice`, `still`,
  `view` `{name, prev}`, `view:leave`, `camera` `{center, zoom, moving}`, `camera:end`, `map:click`, `map:hover`,
  `world:ready`, `world:hail`, `escape` (Esc key), `ready`.
- `A.store.get(k, default)`, `.set(k, v)`, `.del(k)`, `.keys()`: namespaced localStorage in try/catch (conveniences only).
  The film snapshots every key and restores it when it ends, so views may persist freely.
- More events: `film` `{on, done}` (the director starts / ends), `sound` (the switch flipped), `zone:focus` (zone id: Now
  opens that zone), `deal:home` (a sample home for Deal; also `A.dealHome`), `intro:handoff` (Now assembles).
- `A.sound`: one switch for the top bar speaker, the film's mute and the M key. `.pref` (true/false/null), `.on` (playing),
  `.shown` (what the switch shows), `.set(bool)` from a click/key, `.toggle()`. Sounds themselves: `window.Sound` (only when `Sound.enabled`).
- `A.safe(label, fn, ...args)`: runs fn, warns on throw, returns undefined. `A.esc(s)`, `A.h(html) → Element`, `A.$`, `A.$$`, `A.clamp`, `A.lerp`.

**Language** (`<span class="en">…</span><span class="es">…</span>`; CSS hides the other)
- `A.lang` ('en'|'es'), `A.setLang(l)`. `A.t({en,es})` or `A.t('en','es')` → string. `A.L('en html','es html')` or `A.L({en,es})` → both spans (not escaped).
- `A.both(() => A.fmt.date(d))` → the value formatted in EN and ES as escaped spans. Use it for any `A.fmt` output in HTML, so no re-render is needed on `lang`.
- Aria labels: `data-label-en` / `data-label-es` (core applies). Tooltips: `data-tip` / `data-tip-es`.
- Dev: `?lang=es`.

**Theme**
- `A.theme` resolved 'dark'|'light'; `A.themeChoice`; `A.setTheme('dark'|'light'|'system')`.
- `A.tok('--acc') → '#f5883a'` (cached per theme). `A.rgba('--h15' | '#hex' | 'rgba()') → [r,g,b,a]` 0..1 for GL. Dev: `?theme=light`.

**Formatting** (Spanish uses es-US marks, same as the engine's Spanish text: `1.64 pulg`)
- `A.fmt.num(v, d)`, `.int(v)`, `.inches(1.64) → '1.64 in' | '1.64 pulg'`, `.miles(45.5) → '45.5 mi'`, `.money(100000) → '$100,000'`, `.pct(v)`
- `.date('2026-08-08', 'short'|'day'|'long'|'month')` → `Aug 8` / `8 ago`, `Sat, Aug 8` / `sáb 8 ago`, `Saturday, August 8, 2026`
- `.time('16:00') → '4 PM' | '4 p. m.'`, `.range('16:00','19:30') → '4-7:30 PM' | '4 a 7:30 p. m.'`, `.daysBetween(a, b=today)`, `.clock()`
- Every fmt function takes an optional last `lang` argument.

**Motion** (`A.still` = reduced motion or `?still=1`: everything resolves instantly)
- Easings `A.motion.ease.{linear,outCubic,outQuart,outExpo,inOutCubic,inOutSine,hail,soft}`; CSS strings `A.motion.css.{out,ease,io,hail}` (hail = the spring as `linear()`), also `var(--ease-hail)` in CSS.
- `A.motion.tween({from, to, ms, delay, ease, update(v, k)}) → Promise<finished>` with `.cancel()`. from/to may be numbers, arrays or flat objects.
- `A.motion.spring({from, to, k:170, c:20, v, update(x, v)}) → Promise` with `.cancel()`.
- `A.motion.stagger(els, {from:'start'|'center'|'end'|index|fn, each:40, y:10, ms:520, delay, scale})`: fall in, land with the spring.
- `A.motion.reveal(el, {y, ms, delay, ring:true})`: one element lands; `ring` rings out at impact.
- `A.motion.exit(els, {ms:140, y:6})`. `A.motion.ripple(el | event | x, y, {rings:2, size:44, color, inside})`: the knock (auto on every `.btn`, `.seg>button`, `button.row`, `button.chip`, `[data-knock]`).
- `A.motion.countUp(el, to, {from, decimals, ms, delay, format})`: odometer, each digit rolls and lands.
- `new A.motion.Timeline({rate, realtime})` → `.add(atMs, fn(tl, {seeking}))` cue, `.add(atMs, {ms, update(p), ease})` scrubbable track, `.play() → Promise<done>`, `.pause()`, `.seek(ms)`, `.skip()`, `.stop()`, `.onEnd(fn)`, `.duration`, `.time`.
  A seek fires every cue it passes with `{seeking: true}`: apply the end state, start nothing long. Under `A.still` a timeline
  jumps to its end, unless `realtime: true` (the director: captions still need their reading time).
- `A.motion.ticker.add(fn(now, dt) → false to stop)`: the one shared rAF loop.

```js
A.motion.stagger(ctx.slots.left.querySelectorAll('.row'), { each: 35 });
A.motion.countUp(el, 61.5, { decimals: 1 });
```

**Views**
```js
A.view.register('now', {
  title: { en: 'Now', es: 'Ahora' }, key: '1',
  dim: 0,          // 0..1 push the basemap back
  hail: 1,         // opacity of the shared hail field
  ambient: true,   // the radar beam
  camera(frame) {  // frame = {w, h, inset, focus:{x,y,w,h}, stacked}
    return { bounds: A.world.presets.region, pad: 60 };   // or {center:[lon,lat], zoom} or {points:[[lon,lat]..], pad, maxZoom}
  },
  enter(ctx) { ctx.el('left', '<h1 class="t-title">…</h1>', 'pane'); },
  exit(ctx) {}     // optional; ctx cleanups run anyway
});
```
- `ctx = {name, slots:{left,right,bottom,center,overlay}, world, data, x, lang, still, alive()}` plus helpers that clean
  themselves up on exit: `ctx.el(slot, html, className) → div` (icons hydrated), `ctx.layer(def)`, `ctx.pin(id, [lon,lat], el, opts)`,
  `ctx.on(ev, fn)`, `ctx.timer(fn, ms)`, `ctx.own(cleanupFn)`. Guard async work with `if (!ctx.alive()) return;`.
- `A.view.go(name, {instant}) → Promise` (same view = recenter), `A.view.current`, `A.view.ctx`, `A.view.recenter()`, `A.view.relayout()`, `A.view.list()`.
- `A.view.reserve({t, b})` keeps the map's focus area and HUD clear of screen edges (css px from the viewport's top/bottom;
  the film's letterbox); `reserve()` clears it; call `relayout()` after. Slots follow `--frame-b` (extra bottom room).
- Router: hash `#now|#storms|#knock|#deal|#money` (dev params after the view are ignored: `#knock&film=24000`), keys 1-5, tabs,
  brand. Core hides panels for the intro and the film's sign-off: `A.ui.chrome(false|true)`.
- Keys: 1-5 views, F the film, M sound, ? the key sheet, Esc (`escape` event). Knock owns N T I X B U. While the film plays
  it takes every key first (a capture listener): views never act under the film.

**Demo handles** (the director drives the real views with these; each is a no-op when its view is not on screen)
- `A.intro.play({force}) → Promise<played>`, `.skip()`, `.stop()`, `.timeline` (seekable), `.active`.
- `A.nowAssemble() → Timeline` (the pick assembles; call `.play()`), `A.nowDemo = {hover(i), select(i), collapse(), deselect(), drive(), settle(), clear(), state()}`.
- `A.stormsDemo = {select(date), play(), pause(), seek(0..1), days, active}`, `A.knockDemo = {tap(outcome, rank?), flag(kind, rank?), select(rank), undo(), reset(all?), state()}`,
  `A.dealDemo = {step(i), select(i), open(), close(), tick(k, on), state()}`.

**The director** (js/director.js)
- `A.director.play({at, pause})`, `.stop()`, `.pause()`, `.resume()`, `.toggle()`, `.seek(ms)`, `.next()`, `.prev()`, `.playing`,
  `.active`, `.time`, `.duration`, `.chapter`, `.beats` ([{id, at, ms}]), `.report()` → `{issues, skipped, touched}`,
  `.credits(opener)` ("Made by Claude"), `.keys(opener)` (the key sheet). 12 chapters from `COPY.film.beats`; a chapter whose
  view or handle is missing is skipped and noted in `report()`. The film takes the top bar's "Play the film" click as its
  sound gesture, snapshots and restores the store, and hands back on whatever view is showing with a "Your turn" card.

**UI kit**
- `A.ui.icon(name, {size, cls}) → svg`. Or write `<i data-icon="door"></i>` in your HTML (hydrated by `ctx.el`, or call `A.ui.icons(el)`).
  Names: pin door car clock storm hail shield doc pen check x phone camera route spark chevron play pause sun moon system globe layers dollar flag info plus minus target arrow home ring film sound mute prev next keys.
- `A.ui.srcTag(key | {label, labelEs, tip:{en,es}, cls}, {label, note:{en,es}})`. Keys: storms spc lsr ncei radar mrms census streets
  base homes engine law goal hmp bench (industry benchmark; HMP's own numbers replace it after ~200 doors) log (your own log on
  this device). Labels render EN/ES (a label may be `{en, es}`; words like sample, model, bench translate by themselves);
  `note` appends specifics to the key's tip, e.g. `srcTag('bench', {note: {en: 'Source: spotio.com.', es: 'Fuente: spotio.com.'}})`.
- `A.ui.sampleTag()`, `A.ui.toast({en,es}, {ms, icon})`, `A.ui.hailTok(v) → '--h1'…`, `A.ui.hailKey(v) → '0'|'1'|'15'|'2'` (use as `data-h`).

## 5. CSS components (css/base.css)

- Surfaces: `.pane` (+`--tight`, `--grow`, `--foot` sticky footer), `.float` (+`--glass` for controls only; text sits on solid).
- Type: `.t-hero` 64 · `.t-title` 34 · `.t-head` 20 (Bricolage) · `.t-lead` 16 · `.t-body` 14 · `.t-small` 12.5 · `.t-micro` mono 10.5 · `.t-mono` · `.num` (tabular) · `.t-muted` `.t-2` `.t-acc`.
- Headers: `.eyebrow` (+`--acc` dot), `.sec` (label + hairline; `.sec__meta` on the right).
- Numbers: `.stats > .stat > .stat__k + .stat__v (+ .stat__u) + .stat__s`; `.stat--lg`, `.stat--xl`; `data-h="1|15|2"` colors by hail; `.hail-scale` legend bar.
- `.src` (+`--law --goal --hmp --bench --log`: the dot says what kind of source), `.sample`; `.chip` (+`--acc --ok --warn --bad --info --sample --live`, `.chip__dot`); `button.chip[aria-pressed]` as a filter.
- `.btn` + `--primary --secondary --ghost --icon --sm --lg --block`; `.seg > button[aria-pressed]` (+`.seg--ui`).
- `.rows` (+`--lined`) `> .row > .row__lead(--ring) + .row__main(.row__t .row__s) + .row__trail`; `button.row`, `[aria-current="true"]`.
- `.kv` (dt/dd), `.kbd`, `.empty`, `.skel`, `.stub` (placeholders only).
- Map markers: `.mk-ring` (+`--pulse`) the knocker ring, `.mk-door` (+`--hot --done`), `.mk-label`.
- Tokens you will want: `--page --panel --panel-2 --panel-3 --chip --text --text-2 --muted --faint --rule --rule-2 --rule-3 --acc --acc-ink --on-acc --acc-bg --acc-line --h0 --h1 --h15 --h2 --ok --warn --bad --info (+ -bg) --display --ui --mono --r-lg --r-md --r-sm --ease --ease-out --ease-hail`.

## 6. Motion rules

Interactions 120-180 ms eased. Things arrive like hail: fall in (`translate` from above), land with the spring
(`A.motion.css.hail`), ring out once (`reveal(el, {ring:true})` or `ripple`). Taps ring like a knock (automatic).
Big moments are Timelines: interruptible (`stop()`), skippable (`skip()`, listen to `escape`), and with `A.still`
they jump to the end. Orange is the knocker's energy, used once or twice per screen; the hail scale is data only.
Never animate layout properties. Loops must stop: `live` layers only while something moves.

## 7. The map: `A.world` (js/world.js)

Projection: local equirectangular around (-96.6, 41.275), x scaled by cos(lat0); 1 world unit = 1° latitude = 69.05 mi.
`zoom` = log2(px per world unit): state ≈ 8.5, region ≈ 9.5, town ≈ 12, street ≈ 17-18.6.

- `A.world.flyTo(target, {ms, speed, rho:1.4, instant, ease}) → Promise<arrived>`; `.jump(target)`, `.fit(bounds, {pad})`, `.panBy(dx, dy)`, `.zoomBy(dz, [x,y])`, `.stop()`.
  Target = `{center:[lon,lat], zoom, offset:[px,py]}` | `{bounds:[[w,s],[e,n]], pad, maxZoom}` | `{points:[[lon,lat]…], pad, maxZoom}`. Duration from path length, clamped 700-2400 ms. User drag or a new flight interrupts (resolves false).
- `.camera() → {center, zoom}`, `.project([lon,lat]) → [x,y]` css px, `.unproject([x,y])`, `.toWorld`, `.toLonLat`, `.resolve(target)`.
- `.presets.{state, region, fremont, columbus}` bounds. `.bbox`.
- `.setDim(0..1)`, `.ambient(on)`, `.options({labels, streetNames, hud, grid})`, `.invalidate()`, `.keepAlive(ms)`.
- `.hail.at([lon,lat]) → inches` (modeled field from 38 hail areas + 18 swaths), `.hail.set({opacity, sweep})`, `.hail.field` ({nx, ny, x0, y0, x1, y1, data}).
- `.hailColor(v)`, `.pal` (current canvas palette: `land water river hwy label label2 halo text text2 muted acc accInk panel rule h0 h1 h15 h2 ok warn bad info okBg warnBg badBg infoBg …`, `.rgb.*` as 0..1 arrays).
- Frame `f` (passed to every layer): `{t, dt, w, h, dpr, zoom, scale, px (world units per css px), pxPerMile, inset, focus, cam, view (world bbox), bbox (lon/lat), pal, lang, still, theme, alpha, moving, sweep, m, inv, project(ll), projectW(x,y), unproject(p), toWorldCtx(ctx), toScreenCtx(ctx), inView(ll)}`.
  `f.m` = column-major mat3 world→clip (feed it straight to `HailGL` draws), `f.inv` = clip→world.

**Add a layer.** z < 100 → drawn on the basemap canvas (under the GL layer); GL layers → the WebGL canvas; z ≥ 100 → top canvas
(labels sit at z 150; markers go 200+). The built-in `hail` GL layer is z 10. `draw2d` runs in css px with `globalAlpha` = layer opacity.
```js
ctx.layer({ id: 'knock-route', z: 200, live: false,
  draw2d(c, f) {
    c.strokeStyle = f.pal.acc; c.lineWidth = 3; c.beginPath();
    A.data.walk.s[0].p.forEach((p, i) => { const q = f.project(p); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); });
    c.stroke();
  },
  hit(pt, f) { return null; },            // return an item to receive clicks/hover
  avoid(f) { return [[x0, y0, x1, y1]]; },  // optional: css-px boxes of this layer's own canvas text; world labels keep out
  onClick(item, pt) {} });
A.world.layer.opacity('knock-route', 0.4, { ms: 240 });  // .remove(id, {ms}), .get(id), .set(id, patch), .list()
```
```js
const VS = ['#version 300 es', 'in vec2 a_p;', 'uniform mat3 u_inv;', 'out vec2 v_w;',
  'void main(){ v_w = (u_inv * vec3(a_p, 1.0)).xy; gl_Position = vec4(a_p, 0.0, 1.0); }'].join('\n');
const FS = ['#version 300 es', 'precision highp float;', 'in vec2 v_w;', 'out vec4 o;', 'uniform float u_a;',
  'void main(){ o = vec4(0.96, 0.53, 0.23, 1.0) * 0.1 * u_a; }'].join('\n');   // one declaration per line
ctx.layer({ id: 'storms-glow', z: 20, live: true,
  drawGL(gl, f) {
    const P = A.world.glx.cached('storms-glow', () => A.world.glx.program(VS, FS));   // recreated after context loss
    gl.useProgram(P.p); A.world.glx.uniforms(P, { u_inv: f.inv, u_a: f.alpha }); A.world.glx.drawQuad(P);
  },
  draw2d(c, f) { /* the Canvas2D fallback when WebGL is missing (?gl=0 to test) */ } });
```
GL rules: write GLSL ES 3.00 (auto-downgraded on WebGL1 when declarations start the line), output premultiplied
alpha, leave `BLEND` on with `blendFunc(ONE, ONE_MINUS_SRC_ALPHA)`. Helpers: `glx.program(vs, fs) → {p, u, a}`,
`glx.cached(key, make)`, `glx.buffer(data)`, `glx.quad()`, `glx.attrib(prog, name, buf, size)`, `glx.drawQuad(prog)`,
`glx.texture(Float32Array, w, h, {filter}) → {tex, mul}`, `glx.uniforms(prog, vals)`, `glx.color('--acc')`.
`A.world.hasGL`, `.gl`, `.gl2`. Only `live: true` layers keep the loop running: set it only while animating.

The HUD ends with a "Credits" link (`#credits`) that opens "Made by Claude". `House.layout(canvas)` (js/lib/house.js) gives the
last house drawing's anchors (`x0 x1 top groundY bandY`, `parts.roof|siding|gutters` boxes, `knock`, `rings`); `transparent: true`
draws it on a clear canvas.

**Pins** (DOM markers, positioned with transform each frame, hidden off screen or outside their zoom range; labels avoid them):
```js
ctx.pin('pick', [p.center.lon, p.center.lat], A.h('<div class="mk-ring mk-ring--pulse"><b>1</b></div>'), { anchor: 'center', minZoom: 9, offset: [0, 0] });
A.world.movePin('pick', [lon, lat]);  A.world.unpin('pick');
```
**Input** is built in: drag with inertia, wheel/trackpad zoom at the cursor, pinch, double-click, keyboard (arrows, +/-, 0 = back to
the view), and a HUD (zoom, back to view, scale bar, sources). On phones one finger scrolls the page; two fingers move the map.

## 8. Test

```
node docs/design/claudes-aldaba/dev/shoot.mjs --view now --theme both --lang both --still
node docs/design/claudes-aldaba/dev/shoot.mjs --view knock --w 1280 --h 800        # motion on, waits 6 s
node docs/design/claudes-aldaba/dev/shoot.mjs --view all --w 400 --h 860 --still
node docs/design/claudes-aldaba/dev/smoke.mjs            # all views: clicks, lang, theme, 1440/1280/400, errors, rAF, film (F, Space, Right, Esc), ?, M
node docs/design/claudes-aldaba/dev/smoke.mjs --view knock --motion
```
Shots land in `shots/<view>-<theme>-<lang>-<w>.png` (`--out name` to rename).

The film and the credits:
```
node docs/design/claudes-aldaba/dev/film.mjs --shots 3000,16000,30000 --theme both --lang both   # a frame at each point
node docs/design/claudes-aldaba/dev/film.mjs --shots 16000 --hold                                # the exact seeked frame
node docs/design/claudes-aldaba/dev/film.mjs --run --rate 2        # the whole film: chapters, issues, clean hand-back
node docs/design/claudes-aldaba/dev/film.mjs --stops               # stop() inside every chapter leaves nothing behind
node docs/design/claudes-aldaba/dev/manifest.mjs                   # recount the lines and data sizes the credits show
```
Dev hash params (they reach the published page): `#now&film=24000` plays the film from 24 s (`…p` holds the frame, no sound),
`&credits=1` opens the credits, `&keys=1` the key sheet, `&yourturn=1` the end card, `&intro=1` the cold open. Both scripts serve the folder offline in the
artifact skeleton and exit 1 on any console error. Dev params: `?still=1`, `?lang=es`, `?theme=light`, `?gl=0` (no WebGL).
Look at your own shots before you report; fix what looks cheap or empty.
