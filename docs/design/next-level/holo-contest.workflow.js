export const meta = {
  name: 'hologram-walk-contest',
  description: '5 artistic hologram-walk concepts on real Fremont data, judged, synthesized into one showpiece, adversarially QA-ed',
  phases: [
    { title: 'Concepts', detail: '5 designers, 5 directions, each builds + screenshots its own page' },
    { title: 'Judge', detail: '3 judges with different lenses score all concepts from screenshots' },
    { title: 'Harvest', detail: 'one harvester per losing concept pulls its best ideas for the winner' },
    { title: 'Build final', detail: 'winner + grafted ideas into docs/design/next-level/h/' },
    { title: 'Verify', detail: 'runtime, craft, and legal/data/i18n skeptics try to break it' },
    { title: 'Fix', detail: 'apply confirmed issues, re-verify' },
  ],
}

const ROOT = '/home/user/the-repository/docs/design/next-level'

const SPEC = `
CONTEXT: FilthE (owner, sells insurance roof restoration door to door in Nebraska; ADHD, visual; wants "Apple-ad premium, futuristic, dark and alive") reviewed three 7 AM mockups. He LOVED the hologram effect in the Deck concept (${ROOT}/c/index.html) and wants: "when you select a zone to view the road, the walk and the houses become holograms ... have a really fun time designing that". He also said: "there is no color limit or limit to anything", "show me what you can do", "impress me". He disliked: particle storms that "look like worms", zoom-ins that are glitchy/over-highlighted and show NO information. When he clicks a hologram house he wants HAIL SIZE and ROOF AGE in big type first, then WHY it is a good door.

BUILD: one self-contained page, the HOLOGRAM WALK view, at ${ROOT}/<DIR>/index.html (you may add extra .js/.css files inside <DIR>/ only). Designed for a MacBook Air 1440x900 (must not break at 1280x800).

DATA (real, already built): <script src="../shared/data.js"></script><script src="../shared/data-fremont.js"></script> (BOTH, in that order: FilthE: "start with Fremont, we're a local Fremont company"; data-fremont.js swaps the pick/homes/walk/streets to the real Fremont zone E 12th St & E Linden Ave, Jul 1 2026 hail, 1.4 mi from HMP's office) defines window.NL:
- NL.pick: {name "Fremont: E 12th St & E Linden Ave", hail_in 1.0, storm_day "2026-07-01", doors 25, best_time{en,es,start,end}, why{en,es}, plan{en,es}, center{lat,lon}, start{address,lat,lon}, score}
- NL.homes: 25 SAMPLE homes (fake, never owner names): {addr, st, p:[lon,lat], built (year), roof (roof age in years, estimate), own (owner-lived bool), hail (inches at that home), score, rank (1..25)}. Door order in the walk = rank.
- NL.walk: {park:[lon,lat] parking spot, pn:[two cross-street names], s:[{n street, b, h homes on it, m meters, f from-street, t to-street, p:[[lon,lat]..]}], r: route polylines per segment, c: connectors}
- NL.columbus (= NL.streets, Fremont after data-fremont.js; NL.city = "Fremont"): ~570 real named street centerlines {c class (lower = bigger road), n name, p:[[lon,lat],...]}; use those around NL.pick.center. Project lon/lat to local meters (equirectangular around the center).
- NL.storms (18 real 2026 storm days: {date, d{en,es}, long{en,es}, max inches, path}), NL.zones, NL.backup.
3D: three.js r170 vendored locally. Use exactly:
<script type="importmap">{"imports":{"three":"../shared/vendor/three/three.module.min.js","three/addons/":"../shared/vendor/three/addons/"}}</script>
Addons available: controls/*, postprocessing/* (EffectComposer, RenderPass, UnrealBloomPass, OutputPass, ShaderPass, AfterimagePass, FilmPass, GlitchPass, BokehPass, SSAOPass...), shaders/*, lines/* (Line2, LineMaterial, LineGeometry). NO CDN, no network. Fonts: @font-face from ../shared/fonts/ (BricolageGrotesque-var.woff2 display, Geist-400/500/600.woff2 UI, GeistMono-500.woff2) - see ${ROOT}/c/index.html for how.

MUST HAVE:
1. The 25 homes as HOLOGRAM HOUSES at their real positions (procedural house shapes with seeded variety), real streets as light, the walk path drawing door to door in rank order, numbered door beacons, the parking spot as the start.
2. Hail shown CALMLY (e.g. ground tint/contours by NL.homes hail) - NO flowing particle "worms".
3. Hover a house = highlight + small tag (door #, address). Click = CARD: HAIL SIZE (e.g. 1.68") and ROOF AGE (e.g. 21 yrs) in huge type first; then a "why this door" line built from the data (roof age, year built, owner-lived, hail, score); then address, "Door 3 of 25", Prev/Next buttons that fly the camera to the neighbour door; Esc closes. The camera move to a house must be smooth, land framed on it, and never be glitchy or blown-out.
4. "Start walk" = auto-tour following the path door to door (pausable); a HUD with zone name, storm day + hail, 25 doors, best time 4-7:30 PM, walk progress; a clear always-visible Back/exit (top-left) returning to the overview.
5. EN/ES toggle, every string in both (Spanish natural, Nebraska sales context). A subtle "Sample homes" label. Legal: never say a home "is insured", never owner names, never the word "free"/"gratis", no promises that insurance pays.
6. Query params: ?still=1 skips the intro and renders a settled deterministic frame (use a seeded PRNG, no Math.random-dependent layout); ?lang=en|es; ?house=N opens the card for door N with the camera framed on it. Without still: a 3-5 s cinematic intro (holograms materialize, path draws).
7. Performance: instancing/merged geometry, pixel ratio capped at 2, target 60 fps; prefers-reduced-motion = no flicker, no auto camera.
8. Zero console errors.
9. FilthE's newest taste (2026-09-29/30): (a) "nothing tells me what to do" = every view shows ONE next move first, big and obvious (overview: "Start walk at door 1"; card: "Next: door N, 120 ft"; tour: "Knock door N"), (b) "no color limit" and colors must MEAN things: hail size on a cool->hot scale (e.g. <1.0" cool blue/teal -> 1.0" yellow -> 1.5" orange -> 2"+ red/magenta) with a visible legend, door states (next / done / skipped / top-5) each their own color; not just brand black/orange/white, (c) never "free"/"gratis", never "licensed"/"licenciado" (say "registered"), no owner names, sample homes labeled.
10. PUBLISHABLE: the page will be published as a claude.ai artifact where it is served at /<DIR>/index.html next to /shared/... . So: start with <!doctype html> + charset + viewport, reference EVERY file with a relative path (../shared/..., ./x.js), no absolute paths, no fetch() of files (use <script src>), no inline import maps pointing anywhere else than ../shared/vendor/three/.

VERIFY YOURSELF (required): from ${ROOT} run: node shared/holo-shoot.mjs <DIR> 6000  (it writes <DIR>/shots/{walk-en,walk-es,house-en,house-es,intro-en}.png and prints rAF/s + errors). LOOK at the PNGs with the Read tool, then iterate until it is genuinely stunning, readable, and error-free. Headless uses SwiftShader, so rAF/s there is low; judge perf by design (instancing), not by that number. Existing starting points you may reuse or discard: holo-jarvis/ and holo-spectral/ (partial, Columbus-based, from an interrupted run). Do NOT git commit (a commit step runs after each phase). Do NOT edit files outside <DIR>/.
`

const CONCEPT = {
  type: 'object',
  properties: {
    dir: { type: 'string' },
    title: { type: 'string' },
    pitch: { type: 'string', description: 'one sentence, plain English, for FilthE' },
    palette: { type: 'string' },
    signature_moment: { type: 'string' },
    shoot_ok: { type: 'boolean', description: 'holo-shoot ran with zero console errors' },
    known_issues: { type: 'array', items: { type: 'string' } },
  },
  required: ['dir', 'title', 'pitch', 'signature_moment', 'shoot_ok', 'known_issues'],
}

const DIRECTIONS = [
  { dir: 'holo-jarvis', name: 'Blueprint Holo', brief: 'Ice-cyan and white holographic table projection (Iron Man JARVIS / Minority Report). The neighbourhood is projected up from a glowing disc; blueprint grid, Fresnel-rim wireframe+translucent houses, horizontal scanlines, soft chromatic aberration, light data readouts floating beside the selected house.' },
  { dir: 'holo-spectral', name: 'Spectral', brief: 'Iridescent thin-film holograms: every house shimmers like a soap bubble / holographic foil, hue driven by hail severity across the full spectrum; deep violet-black night, faint aurora in the sky, prismatic walk path. Luxury, dreamy, jaw-dropping color.' },
  { dir: 'holo-neon', name: 'Neon Grid', brief: 'Synthwave/Tron: black glass ground with a glowing grid, houses as light-cube voxels whose glow height reflects score, magenta/orange/cyan palette, walk path as a light-cycle trail that leaves an afterimage, sunset horizon glow. Fun, energetic, bold.' },
  { dir: 'holo-lidar', name: 'LiDAR Scan', brief: 'Houses and streets reconstructed as dense point clouds, assembled by a scanner sweep like autonomous-car LiDAR; heat colormap by hail; cinematic depth of field; points breathe subtly. Feels like cutting-edge sensing tech.' },
  { dir: 'holo-ember', name: 'Ember Gold', brief: 'Aldaba brand taken to luxury: knocker-orange and molten-gold holograms on deep graphite, warm glass reflections, fine gold line-work, embers of light rising gently from the best doors. Premium watch-ad feel.' },
]

phase('Concepts')
log('5 designers are building their hologram walk concepts in parallel')
const concepts = (await parallel(DIRECTIONS.map(d => () =>
  agent(`You are a world-class creative technologist and 3D designer. Direction: "${d.name}" - ${d.brief}\n${SPEC.split('<DIR>').join(d.dir)}\nIf docs/design/next-level/${d.dir}/ already has files from an interrupted earlier run (container restart), do NOT start over: read them, run holo-shoot, look at the shots, and only finish what is missing (especially MUST HAVE 9 and 10); keep edits surgical to save usage.\nReturn dir="${d.dir}".`,
    { label: `concept:${d.dir}`, phase: 'Concepts', schema: CONCEPT })
))).filter(Boolean)
log(`${concepts.length}/5 concepts built: ${concepts.map(c => c.dir + (c.shoot_ok ? '' : ' (errors)')).join(', ')}`)
if (!concepts.length) return { error: 'no concepts built' }

await agent(`In /home/user/the-repository run: git add docs/design/next-level/holo-* && git commit -m "Hologram contest: 5 concepts built" && git pull --rebase origin claude/amazing-gauss-yzfpq0 && git push origin HEAD:claude/amazing-gauss-yzfpq0 (retry push up to 4x with backoff). Reply ok or the error.`, { label: 'commit:concepts', phase: 'Concepts', model: 'haiku' })

phase('Judge')
const JUDGE = {
  type: 'object',
  properties: {
    scores: { type: 'array', items: { type: 'object', properties: { dir: { type: 'string' }, score: { type: 'number', description: '0-100' }, why: { type: 'string' } }, required: ['dir', 'score', 'why'] } },
    winner: { type: 'string' },
    graft: { type: 'array', items: { type: 'string' }, description: 'best specific ideas from non-winners worth grafting onto the winner, each naming its source dir' },
    must_fix: { type: 'array', items: { type: 'string' }, description: 'problems in the winner that must be fixed' },
  },
  required: ['scores', 'winner', 'graft', 'must_fix'],
}
const list = concepts.map(c => `- ${c.dir} "${c.title}": ${c.pitch} | signature: ${c.signature_moment} | issues: ${c.known_issues.join('; ') || 'none'}`).join('\n')
const LENSES = [
  { key: 'wow', text: 'FilthE\'s taste: does it make him say "wow"? Apple-ad premium, futuristic, alive, artistic, a leap not polish. Would he show it to people?' },
  { key: 'field', text: 'A door-to-door salesman at 4 PM: is the info instantly readable (hail size + roof age big, why, door order, next door), is the walk obvious, is navigation (back, next, tour) effortless, nothing glitchy or blown out?' },
  { key: 'craft', text: 'Senior graphics engineer: rendering quality, aliasing, bloom balance, typography, layout at 1440x900, likely perf on a MacBook Air, code robustness, any console errors or broken states.' },
]
const verdicts = (await parallel(LENSES.map(L => () =>
  agent(`You are a judge. Lens: ${L.text}\nConcepts (pages in ${ROOT}/<dir>/index.html, screenshots in ${ROOT}/<dir>/shots/*.png):\n${list}\nOpen and LOOK at every concept's walk-en.png and house-en.png (and intro-en.png) with the Read tool; skim the code where useful. Score each 0-100 through your lens only, pick a winner, list concrete ideas from other concepts worth grafting onto the winner (name source dir), and must-fix problems in the winner.`,
    { label: `judge:${L.key}`, phase: 'Judge', schema: JUDGE, model: 'sonnet' })
))).filter(Boolean)
const totals = {}
for (const v of verdicts) for (const s of v.scores) totals[s.dir] = (totals[s.dir] || 0) + s.score
const ranking = Object.entries(totals).sort((a, b) => b[1] - a[1])
const winner = ranking.length ? ranking[0][0] : concepts[0].dir
log(`Ranking: ${ranking.map(([d, t]) => `${d} ${Math.round(t / Math.max(1, verdicts.length))}`).join(' > ')}; winner ${winner}`)
const grafts = verdicts.flatMap(v => v.graft)
const mustFix = verdicts.flatMap(v => v.must_fix)
const judgeNotes = verdicts.map((v, i) => `${LENSES[i] ? LENSES[i].key : 'judge'}: ` + v.scores.map(s => `${s.dir}=${s.score} (${s.why})`).join(' | ')).join('\n')


phase('Harvest')
const losers = concepts.filter(c => c.dir !== winner)
const HARVEST = { type: 'object', properties: { ideas: { type: 'array', items: { type: 'object', properties: { idea: { type: 'string' }, where_in_code: { type: 'string' }, why_better: { type: 'string' } }, required: ['idea', 'where_in_code', 'why_better'] } } }, required: ['ideas'] }
const harvested = (await parallel(losers.map(c => () =>
  agent(`FilthE: "dont just pick the winner, collect the best ideas from the rest and apply them to the winner to improve it". You harvest from the LOSING concept ${ROOT}/${c.dir}/ ("${c.title}"). The winner is ${ROOT}/${winner}/. Open both (code + shots/*.png via Read). List the 2-5 best specific ideas in ${c.dir} that the winner lacks and that would make the winner better for FilthE (look, feel, information, interaction, camera, typography, shaders). Point to the exact code (file + function/shader) so a builder can port it.`,
    { label: `harvest:${c.dir}`, phase: 'Harvest', schema: HARVEST, model: 'sonnet' })
))).filter(Boolean)
const harvestList = harvested.flatMap((h, i) => h.ideas.map(x => `[from ${losers[i] ? losers[i].dir : '?'}] ${x.idea} (code: ${x.where_in_code}; why: ${x.why_better})`))
log(`Harvested ${harvestList.length} ideas from ${losers.length} losing concepts`)

phase('Build final')
const FINAL = {
  type: 'object',
  properties: {
    title: { type: 'string' }, pitch: { type: 'string' },
    grafted: { type: 'array', items: { type: 'string' } },
    shoot_ok: { type: 'boolean' }, known_issues: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'pitch', 'grafted', 'shoot_ok', 'known_issues'],
}
const final = await agent(`You are the lead creative technologist building the FINAL hologram walk showpiece at ${ROOT}/h/index.html (+ extra files only inside h/).
Start from the winning concept ${ROOT}/${winner}/ (copy it into h/ and elevate it). Apply EVERY harvested idea below from the other concepts unless it truly clashes (then say why in known_issues); keep one coherent art direction:\n- ${harvestList.concat(grafts).join('\n- ')}\nAlso apply the research in /home/user/the-repository/docs/research/2026-09-29-hologram-rendering.md.
Fix everything here:\n- ${mustFix.join('\n- ')}
Judge notes:\n${judgeNotes}
Then push it further: this is the piece that must impress FilthE. Add one unforgettable signature moment, flawless camera choreography, perfect typography in the card, and make sure every view carries real information.
${SPEC.split('<DIR>').join('h')}`,
  { label: 'final:h', phase: 'Build final', schema: FINAL })

const ISSUES = {
  type: 'object',
  properties: { issues: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, what: { type: 'string' }, where: { type: 'string' }, repro: { type: 'string' } }, required: ['severity', 'what', 'repro'] } } },
  required: ['issues'],
}
const VLENSES = [
  { key: 'runtime', text: 'Runtime + interaction. Write a throwaway Playwright script in /tmp (import playwright; serve files like shared/holo-shoot.mjs does) that loads h/index.html, waits, hovers and clicks at least 5 different houses (find them via exposed debug hooks or by projecting positions), uses Next/Prev, Esc, Back, Start walk + pause, the EN/ES toggle, resizes to 1280x800, and ?house=25. Report every console error, dead button, stuck state, camera that lands badly, overlapping UI.' },
  { key: 'craft', text: 'Visual craft. Run node shared/holo-shoot.mjs h 6000 from ' + ROOT + ' and LOOK at every PNG. Report anything ugly, unreadable, blown-out, aliased, cluttered, misaligned, or below "Apple ad" quality; also any view that shows no real information.' },
  { key: 'legal', text: 'Legal + data + language + FilthE taste (is ONE next move shown first on every view? do colors carry meaning with a legend?). Read the code and the rendered text (both EN and ES). Report: any owner names, any claim a home "is insured", the words free/gratis/licensed/licenciado, promises insurance pays, wrong numbers vs NL.homes (hail, roof age, door order), missing or awkward Spanish, missing "Sample homes" label.' },
]
const verify = async (round) => (await parallel(VLENSES.map(L => () =>
  agent(`Adversarial QA (round ${round}) of the hologram walk at ${ROOT}/h/index.html. Your job is to BREAK it. Lens: ${L.text}\nOnly report real, reproducible problems; no style nitpicks outside your lens.`,
    { label: `verify:${L.key}:r${round}`, phase: 'Verify', schema: ISSUES, model: 'sonnet' })
))).filter(Boolean).flatMap(r => r.issues)

await agent(`In /home/user/the-repository run: git add docs/design/next-level/h && git commit -m "Hologram walk final build (winner + harvested ideas)" && git pull --rebase origin claude/amazing-gauss-yzfpq0 && git push origin HEAD:claude/amazing-gauss-yzfpq0 (retry up to 4x). Reply ok or the error.`, { label: 'commit:final', phase: 'Build final', model: 'haiku' })

phase('Verify')
let issues = await verify(1)
log(`Round 1: ${issues.length} issues (${issues.filter(i => i.severity === 'blocker').length} blockers)`)
let fixes = []
for (let round = 1; round <= 2 && issues.filter(i => i.severity !== 'minor').length + (round === 1 ? issues.length : 0) > 0; round++) {
  phase('Fix')
  const fx = await agent(`Fix these QA findings in ${ROOT}/h/ (only edit files in h/). Verify each fix yourself (run node shared/holo-shoot.mjs h 6000 from ${ROOT} and look at the PNGs; re-run any repro). Keep the art direction; do not regress anything.\n${issues.map((i, n) => `${n + 1}. [${i.severity}] ${i.what} @ ${i.where || '?'} | repro: ${i.repro}`).join('\n')}\nReturn a short list of what you fixed and anything you could not.`,
    { label: `fix:r${round}`, phase: 'Fix' })
  fixes.push(fx)
  phase('Verify')
  issues = await verify(round + 1)
  log(`Round ${round + 1}: ${issues.length} issues (${issues.filter(i => i.severity === 'blocker').length} blockers)`)
}

await agent(`In /home/user/the-repository run: git add docs/design/next-level/h && git commit -m "Hologram walk: QA fixes" ; git pull --rebase origin claude/amazing-gauss-yzfpq0 && git push origin HEAD:claude/amazing-gauss-yzfpq0 (retry up to 4x). Reply ok or the error.`, { label: 'commit:qa', phase: 'Fix', model: 'haiku' })

return {
  harvested: harvestList,
  concepts: concepts.map(c => ({ dir: c.dir, title: c.title, pitch: c.pitch, shoot_ok: c.shoot_ok })),
  ranking: ranking.map(([d, t]) => ({ dir: d, avg: Math.round(t / Math.max(1, verdicts.length)) })),
  winner, final, fixes, remaining_issues: issues,
}
