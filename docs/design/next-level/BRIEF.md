# Next level: the 7 AM open (brief for directions A, B, C)

FilthE, 2026-09-29: "we entered the iron age, let's upgrade and revolutionize, it's time we go next level on
building, themes, ideas." A leap, not polish. Futuristic, like Apple ads, premium AI look, abstract generative
forms, cinematic, dark and alive. Work screens stay fast.

## The moment
7 AM, MacBook Air (1440x900 window, design at 1440x900; must not break at 1280x800). He opens the HMP App and in
5 seconds he must know: where to go today, why, how many doors, when, and that Aldaba has his back.
Must show: map + hot zones, Aldaba's pick (zone, why, doors, best time, drive), today's plan, what changed overnight.
The live app today (v14 desk layout) is the thing to beat.

## Data (all real, already built): `shared/data.js` -> `window.NL`
- `NL.headline {en,es}` overnight line. `NL.pick` / `NL.backup` = the engine's pick (Columbus: 22 St & 21 St,
  1.64 in hail on 2026-08-08, 25 doors, 45.5 mi, best time 4-7:30 PM, `why`/`plan`/`best_time` in EN+ES).
- `NL.zones` 12 ranked zones `{id,name,rank,score,homes,kind,c:[lon,lat]}`.
- `NL.storms` 18 real storm days `{date,days,time,d{en,es},long{en,es},max(in),path:[[lon,lat]...]}` (swath centerline).
- `NL.areas` hail areas `{name,c,ring,hail,homes,owner,insured:{en,es} label}`.
- `NL.base` basemap lines `{k: water|stream|hwy|rail|town|county, n, poly, p:[[lon,lat]]}` (Columbus to Omaha).
- `NL.arts` regional arterials; `NL.fremont` Fremont street grid `{c:0-3 class, p}`; `NL.columbus` Columbus street
  grid `{c, n name, p}` (Nebraska GIS, real).
- `NL.walk` the pick's real walk (streets `s[]` with `n` name, `h` homes, `p` line; `park` = where to park).
- `NL.homes` 25 FAKE sample homes on that walk `{rank,addr,st,p,built,roof(yrs),own(bool),hail,score}`.
  Label them "sample" somewhere quiet. Never add owner names.
- `NL.places` town label points, `NL.hq` Fremont.
- `NL.src` source lines: every number on screen shows who said it (small, on hover or in a quiet line).

## System (non-negotiable)
- Aldaba brand: graphite dark default (`--page:#07080a`, text `#f1f2f4`, `--text-2:#b8bbc2`, muted `#80838b`),
  knocker orange `--acc:#f5883a` (ink `#ffa766`), hail scale `--h1:#f2c14e` 1in, `--h15:#f5883a` 1.5in, `--h2:#ff4f5a` 2in+.
  Ledger light: `--page:#eef0ee`, text `#18191c`, `--text-2:#3d3f45`, muted `#6c6f77`, acc-ink `#a4520f`.
  Theme toggle in the page + `?theme=light|dark` URL param.
- Type: Bricolage Grotesque headlines (opsz 96, weight 650-750, tight -0.03em), Geist UI, Geist Mono for numbers.
  `@font-face` from `../shared/fonts/` (BricolageGrotesque-var, Geist-400/500/600, GeistMono-500) + Google Fonts link
  as a bonus. Use font-family lists "Bricolage Grotesque","Bricolage L" etc. like docs/design/product-brand/aldaba.
- EN + ES toggle (every visible string both ways, natural Latin American Spanish) + `?lang=es`. `?still=1` may skip
  intro motion (screenshots wait ~6 s anyway, so the wow should be settled by then).
- Salesman screen: shows the Aldaba mark (docs/design/product-brand/aldaba/mark.svg, inline it). No HMP homeowner copy.
- Legal words: never "insured" for a home (say "likely insured" as an area estimate from Census, never a fact about one
  home), "registered/registrado" never "licensed", never "free/gratis", no deductible talk, no promises insurance
  pays, no fake urgency. No coaching/sales tips text in the app.
- No network needed: everything local (inline JS/CSS in index.html + ../shared/). You may load ONE library from
  cdnjs.cloudflare.com only if it's worth it, but the page must still render without it (screenshots run offline).
  Prefer raw WebGL/Canvas2D/SVG. Must stay fast: 60 fps on an Air, no layout thrash, `prefers-reduced-motion` respected.
- Motion must mean something (taste.md): storm replay, a sweep over hail, the pick assembling. Never decoration alone.
- Dense and real beats empty and elegant (taste.md: v1 "looks simple and empty" was disliked; v3 with real streets,
  3D columns lit by hail, glowing heat, storm replay, sources on every number was loved).
- Every direction cites what it borrows in an HTML comment at the top AND in a tiny "Inspired by" line on the compare
  page (you return it in your report).

## Research to borrow from (cite)
- Apple Liquid Glass (WWDC25 "Meet Liquid Glass"): glass only for the navigation/controls layer, text on solid, specular
  edge highlight. https://developer.apple.com/videos/play/wwdc2025/219/
- Linear "A calmer interface for a product in motion" (2026-03): warm gray neutrals, one tuned accent, 120-180 ms eased
  feedback motion. https://linear.app/now/behind-the-latest-design-refresh
- Windy / earth.nullschool particle flow (fade-trail particles on a canvas over a vector field; Agafonkin "How I built a
  wind map with WebGL"). https://blog.mapbox.com/how-i-built-a-wind-map-with-webgl-b63022b5537f
- Vercel/Rauno Web Interface Guidelines: animate only transform/opacity, motion clarifies cause and effect,
  interruptible. https://vercel.com/design/guidelines
- 2026 trend round-ups: generative UI assembled at runtime, ambient AI layer, oversized expressive type, dark baseline.
  https://www.stan.vision/journal/ux-ui-trends-shaping-digital-products
- Apple Weather: the layout reshapes around what matters now (rain coming -> radar on top).

## Deliverable per direction
`docs/design/next-level/<x>/index.html` (+ optional files in `<x>/`), screenshots via
`node docs/design/next-level/shared/shoot.mjs <x>` (run from docs/design/next-level; writes `<x>/shots/{dark,light}-{en,es}.png`
at 1440x900, reports console errors: must be zero). LOOK at the dark-en and light-en shots and fix what's off.
