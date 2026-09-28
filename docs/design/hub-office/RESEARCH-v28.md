# v28 research: smoothness, shadows, and "feels basic but isn't"

For `pages/crew-hq.html` + `pages/hub/scene.js`, after FilthE's v27 feedback: "it's not as smooth, shadowing
errors, feels basic but isn't." Findings are ranked by payoff for this specific scene, each with the exact change
it implies. Read against the current code: three r169, WebGLRenderer(`antialias:true, alpha:true`), DPR up to 2,
one shadow-casting DirectionalLight (2048 PCFSoft, `renderer.shadowMap.autoUpdate = false` but force-refreshed on
a 15 Hz/6 s cadence), no EffectComposer (bloom done with additive sprites, by design, to keep canvas alpha), static
geometry already merged with `mergeGeometries`/`bake()`, status bars and plants already on `InstancedMesh`, dynamic
DPR step-down already wired to measured frame time (`scene.js` ~1678-1682). v27 already did a lot of the textbook
three.js optimization; the remaining stutter looks like it's coming from a handful of specific, fixable things, not
from a missing general pass.

---

## Fix smoothness + shadows first

### 1. Robots are (probably) real shadow casters on top of their own blob decal — stop double-paying for it
**Payoff: very high. Effort: S.** `scene.js`'s `S()` helper defaults every mesh to `castShadow = true`
(line 264), and robots already get a separate baked-look contact shadow: `blob()` (line 270) and the per-robot
`shadow` plane with a `blobTex` (line 1005), whose scale/opacity is animated every frame from hover height (line
1426). If the ceramic robot bodies *also* cast into the real shadow map, the scene is paying for both a real-time
shadow (expensive: 2048×2048 PCFSoft, redrawn on a forced cadence) and a fake contact shadow that alone reads fine
at this scale (per the game-dev standard: blob/decal shadows for small dynamic characters, real shadows only for
architecture — this is exactly what Unity/Unreal "blob shadow" LODs do for background characters). Worse, 10
robots hover on a constant sine (`hover bob ±6mm on a 4.2s sine`, ART-DIRECTION 8.3) — if that counts as "moved"
for the shadow-map refresh logic, the shadow map is *always* dirty, so the periodic forced repaint (line 1474-1475:
elevation change, or every 6 s, or the 15 Hz cadence check) is doing full-scene shadow passes essentially
continuously rather than only when the static room changes. A full shadow pass landing on an unpredictable frame
is a textbook stutter cause: it doesn't lower average FPS much, but it spikes *that* frame's time, which reads as
jank/hitching even at a healthy average — this matches "not as smooth" better than a flat low frame rate would.
**Fix:** set `castShadow = false` on every robot root (keep `receiveShadow` where useful for contact with the
floor's real shadows from furniture), keep the existing blob decal as the only per-robot shadow, and gate the
shadow-map refresh purely on static-scene events (sun elevation crossing a sky-state boundary, a view change, or
furniture actually changing) — never on robot animation. This should let `shadow.autoUpdate` stay `false` with
`needsUpdate` set maybe once every few seconds instead of at a steady 15 Hz, which is the single biggest win
available without touching the art direction at all.
Sources: [three.js shadow map perf discussion](https://discourse.threejs.org/t/how-to-optimize-shadow-rendering-in-three-js-for-better-performance/64681) ·
[triggering shadow updates separately from rendering](https://github.com/mrdoob/three.js/issues/23461) ·
[shadowmap halves my fps](https://discourse.threejs.org/t/shadowmap-halves-my-fps/11519) ·
[100 three.js perf tips](https://www.utsubo.com/blog/threejs-best-practices-100-tips).

### 2. `antialias:true` + `alpha:true` together is a known slow combination — drop native MSAA
**Payoff: high. Effort: S.** The canvas is created `alpha:true` on purpose (so the CSS sky shows through, per
ART-DIRECTION 6.4 — correct call, keep it), but it's also `antialias:true`. On a transparent WebGL canvas, native
MSAA plus alpha forces the browser to composite the canvas the slow way in several engines (it can't just blit the
GPU surface into the page — it has to resolve MSAA *and* handle non-premultiplied alpha per frame), and this is a
long-standing, specifically Safari/macOS-flavored complaint in the three.js forum ("Safari 15.5 gives 3-7 fps vs
Chrome 60fps" on otherwise-identical scenes; MacBook Pro Intel struggles where an M1 Air is fine, i.e. it's GPU/
driver-path sensitive, not just raw power). Combined with `DPR` up to 2 on a Retina MacBook, the canvas is already
rendering at ~2× supersampling, which is itself a form of antialiasing — native MSAA on top is largely redundant
video-memory and bandwidth cost for marginal extra crispness. **Fix:** set `antialias:false`, keep the DPR-based
supersampling (already capped sensibly), and if edges look too hard at DPR 1 (low-power mode / a non-Retina
external display), add a *cheap* post-process AA instead of MSAA — SMAA is the standard choice, it's a
single-pass image-space filter that doesn't need an MSAA-capable framebuffer, and it's cheap enough for a MacBook
Air. Since the composer is deliberately not used to preserve alpha, either skip AA when DPR≥1.5 (the common case
on this hardware) or apply SMAA as a raw WebGL2 post-pass on the resolved color buffer while leaving alpha
untouched, rather than through `EffectComposer`.
Sources: [Horrible Safari Performance (three.js forum)](https://discourse.threejs.org/t/horrible-safari-performance/38364) ·
[Horrible 3D/Three.js performance in latest Safari on macOS](https://discourse.threejs.org/t/horrible-3d-three-js-performance-in-latest-safari-on-macos/25940) ·
[inconsistent Safari iOS animation perf, 2025](https://discourse.threejs.org/t/inconsistent-performance-of-three-js-animations-in-safari-for-ios/76329).

### 3. The "shadowing errors" are almost certainly acne/peter-panning at the 8° dusk sun, not a bug
**Payoff: high (fixes the literal complaint). Effort: S.** ART-DIRECTION 6.2 already documents the dusk key light
clamped to a minimum 8° elevation specifically because lower angles blow out the ±10 unit shadow frustum, and uses
one fixed `normalBias:.02`/`bias:-.0004` pair for every sky state. A single bias tuned for one elevation is a
classic acne/peter-panning trade-off: shadow bias needs vary with the light's grazing angle — a bias that looks
right at a 50° day sun will under-bias (acne/moiré stripes on lit floors) or over-bias (shadows visibly detached
from robot feet — "peter-panning") at an 8° dusk graze, and this scene runs through day/dawn/golden/dusk/night in
one session. Also: at a 2048 map over a ±10 unit frustum, a texel is ~10 cm (ART-DIRECTION's own number, used to
justify excluding thin mullions from shadows) — that's coarse enough that anything thin near the floor (chair
legs, desk edges, prop bases) will show stair-stepped/acne-like edges regardless of bias. **Fix:** (a) slope-scale
the bias with elevation — larger `normalBias` (e.g. .03-.05) at low elevations, tightening toward .015-.02 near
noon/day — recompute it alongside `lightFromSky()`'s existing per-state lerp instead of hard-coding one value; (b)
since SPEC.md now calls for "dark futuristic default" at every hour, consider making the cool night moon (elevation
45°, already in the rig) the *primary* real shadow caster year-round rather than the 8° dusk sun, and only use the
grazing sun for the couple of transitional sky states — a 45° light is dramatically less bias-sensitive; (c) tighten
the shadow camera frustum from the flat ±10 to the room's actual occupied footprint (the two floors' real bounding
box) so the same 2048 texels cover less area and acne shrinks without changing bias at all — this is the standard
first fix in every three.js shadow guide ("set the shadow box to the absolute minimum that covers your scene").
Sources: [shadow acne vs peter-panning explainer](https://lucidmodules.com/blog/threejs/how-to-fix-shadow-acne/) ·
[bias/normalBias guidance](https://github.com/mrdoob/three.js/issues/13108) ·
[three.js shadows guide](https://threejsresources.com/guides/shadows) ·
[shadow acne/banding, what I learned](https://discourse.threejs.org/t/shadow-acne-banding-what-i-learned/43666).

### 4. Measure before tuning further — `SCENE.info` is already exposed, nothing reads it
**Payoff: high (unblocks everything else). Effort: S.** `scene.js` line 1779 already exposes
`get info(){ return renderer.info.render; }` on `window.SCENE` — draw calls, triangles, points — but nothing in
`crew-hq.html` logs or displays it, so the "~450 draw calls" figure in SPEC's v27 live note is an estimate, not a
measurement, and the real MacBook Air frame rate is explicitly still unmeasured (SPEC.md "Open items"). **Fix:**
add one dev-only overlay (query-param gated, e.g. `?perf`, so it never ships to FilthE by accident) that prints
`SCENE.info.calls/triangles/points` plus a rolling frame-time graph, and actually run it on the real hardware
before tuning further — Safari's Web Inspector has a WebGL/GPU timeline (Develop menu → the page's inspector →
Timelines → "WebGL"), and Chrome's `chrome://tracing` / the Performance panel's GPU track will show exactly which
frames spike and whether it's the shadow pass, script time, or compositing. Spector.js (a browser extension) can
capture one frame's exact draw-call list if the count needs auditing further. Without this, every fix above is a
guess about *which* frame is spiking; with it, the shadow-pass hypothesis in #1 can be confirmed or ruled out in
minutes.
Sources: [three.js r169 release notes](https://github.com/mrdoob/three.js/releases/tag/r169) ·
[100 three.js perf tips, on renderer.info](https://www.utsubo.com/blog/threejs-best-practices-100-tips) ·
[optimizing draw calls, instancing & batching](https://bersus.io/insights/creative-dev/threejs-optimizing-instancing-and-batching/).

### 5. `BatchedMesh` for the per-robot dynamic props (hats, props, gear) once Wardrobe v2 lands
**Payoff: medium-high, but only relevant once FUN-IDEAS #1 (Wardrobe v2) is built. Effort: M.**
`BatchedMesh` (solid since r159, much improved by r170: per-instance opacity, per-object frustum culling and
sorting) is exactly the right primitive for "10 robots, each with a different hat/prop geometry but sharing very
few materials" — the shape Wardrobe v2 and the hero-prop plan (ART-DIRECTION 6.6) describe. Right now `dress()`
merges each robot's *own* head into one static mesh per robot (fine), but 10 robots × (hat + prop + gear pieces)
is still 10× the draw calls of a single batch, and Wardrobe v2's earned pieces / moving gear groups will only grow
that count. **Fix:** when building Wardrobe v2, put every robot's hat geometry into one shared `BatchedMesh` (one
draw call for all 10 hats), and the same for props and any earned-gear decals, instead of one `Mesh` per robot per
part; use `InstancedMesh` only where the geometry is *identical* across robots (it mostly isn't, since every
outfit is bespoke — that's why `BatchedMesh` is the right tool here, not `InstancedMesh`).
Sources: [BatchedMesh vs InstancedMesh explainer](https://bersus.io/insights/creative-dev/threejs-optimizing-instancing-and-batching/) ·
[BatchedMesh perf issue thread, useful caveats](https://github.com/mrdoob/three.js/issues/28776).

### 6. WebGPURenderer: not now, but worth a flag for the next hardware refresh
**Payoff: low today (Safari's WebGPU story is still behind Chrome), noted for later. Effort: none now.**
Benchmarks in 2026 show WebGPU pulling ahead specifically in draw-call-heavy, many-material scenes (one comparison:
355→183 draw calls, 136→205 fps, switching renderers on the same three.js scene) because command buffer prep
spreads across CPU cores instead of one sequential WebGL command stream — which is close to this scene's shape
(many small meshes, many materials). But other reports show WebGPURenderer *slower* than WebGL in scenes that
aren't draw-call-bound, and Safari's WebGPU support is newer and less consistent than Chrome's, so this is not a
v28 fix — it's a note to re-test once #1-#5 land and once the real bottleneck (draw calls vs. shadow-pass spikes
vs. fragment cost) is known from #4's profiling.
Sources: [WebGPU vs WebGL practical three.js test](https://aestar.tech/en/blog-en/webgpu-vs-webgl-practical-three-js-performance-test-for-complex-3d-scenes/) ·
[three.js vs WebGPU in 2026](https://altersquare.io/blog/three-js-vs-webgpu-2026-large-scale-construction-viewers) ·
[WebGPU performance issue thread (mixed results)](https://discourse.threejs.org/t/webgpu-performance-issue/87939).

---

## Why it "feels basic" — reading premium into real-time 3D

### 7. Baked-look lighting over more real-time lights — the room already knows this, lean further in
**Payoff: high. Effort: S-M.** The ART-DIRECTION doc already cites the exact right principle ("when it comes to
performance, light is expensive, and baking is the method for optimization... the shadow is a texture simply
animated to light up the illusion") and the custom PMREM studio environment (6.3) is the right instinct — Bruno
Simon's own courseware leans on baked scenes for this same reason. The place this can go further without adding
lights: bake **ambient occlusion into the static geometry's vertex colors or a lightmap-style canvas texture**
(the travertine/stone canvases already exist per ART's material section — add a soft AO gradient into the same
texture pass at desk legs, wall corners, under furniture) instead of relying on the hemisphere light + shadow
pockets alone to read as "grounded." This is the "GPU-baked irradiance probe" trick in miniature, without needing
a real probe volume — a hand-painted AO gradient in the existing canvas textures gets 80% of the visual benefit at
zero runtime cost.
Sources: [three.js baked-lighting overview](https://www.threejs-journey.com/) ·
[walkable scene with baked irradiance probe GI + cascaded shadows, reference implementation](https://github.com/vvanghelue/threejs-probe-gi).

### 8. Tone mapping: A/B AgX against Neutral on the actual review shots, don't assume Neutral wins
**Payoff: medium. Effort: S (the A/B hook already exists — `window.__hubTM`).** ART-DIRECTION already flags
Khronos PBR Neutral specifically to keep knocker-orange and brass from shifting toward yellow the way ACES does,
which is the right call for a brand-orange-critical scene. But AgX (now Blender 4.0's default, and generally
considered to have better highlight roll-off / filmic character than either Neutral or Reinhardt) is one flag away
(`window.__hubTM = 'agx'`) from being compared on the same shots. Given the room leans hard on practicals (lamp
pools, the ember breath, brass highlights) rather than one blown-out sun, AgX's smoother highlight compression
could read as more "cinematic/expensive" in exactly the lamp-pool shots that matter most, at zero runtime cost
either way — it's a tone-mapping curve, not a light. Worth one side-by-side pass before locking Neutral in v28.
Sources: [AgX tone mapping issue/discussion](https://github.com/mrdoob/three.js/issues/27362) ·
[tone mapping overview, three.js forum](https://discourse.threejs.org/t/tone-mapping-overview/75204) ·
[is AgX implemented correctly, caveats](https://discourse.threejs.org/t/is-agx-tonemapping-implemented-correctly/60609).

### 9. Cheap post that doesn't need the composer: film grain and vignette are already there — add SMAA the sprite-safe way, and check sprite overdraw cost
**Payoff: medium. Effort: S.** The scene already does CSS-layer grain (256px SVG feTurbulence, `.035` opacity,
soft-light) and a strengthened vignette, which is the right call for a transparent canvas — real post-processing
passes (UnrealBloomPass etc.) genuinely do break canvas alpha the way ART-DIRECTION 6.4 says. The one gap: dozens
of additive `Sprite`s (halos, streaks, gold leaf, glow, thought bubbles — 9+ distinct additive-sprite materials
counted in `scene.js`) all read+blend into the same pixels in the lamp-pool areas, and WebGL renders Sprites in a
second pass after opaque geometry — every overlapping pair is extra fragment-shader overdraw exactly where the
"premium" lamp pools live. **Fix:** where multiple halos sit near the same lamp (line ~1078's per-lamp halo loop,
the King's cabochon + strip halo + call-pool glow when he's the one waiting, etc.), pre-composite overlapping
glows into one shared sprite/texture rather than stacking N additive draws, and consider premultiplied-alpha
sprites specifically for the always-on halos (lamp glow, strip glow) so they can share a draw with non-additive
elements where the engine allows it — the visual result (concentrated warm pools) is what "expensive" scenes like
Deakins-lit product shots actually look like, so this is a performance fix that doesn't cost any of the intended
look.
Sources: [three.js Sprite second-pass rendering note](https://discourse.threejs.org/t/threejs-and-the-transparent-problem/11553) ·
[premultiplied alpha for mixed blend modes](https://developer.nvidia.com/content/transparency-or-translucency-rendering) ·
[100 three.js perf tips, on transparency cost](https://www.utsubo.com/blog/threejs-best-practices-100-tips).

### 10. Camera and motion language: the studios that read as "premium" all under-move the camera, not over-move it
**Payoff: medium-high, no-cost (motion tuning only). Effort: S.** Lusion, Active Theory and Igloo Inc. are cited
by name in the task; what they share isn't more motion, it's *fewer, better-timed* moves: Lusion's work is
specifically noted for "unusually fluid motion work" built on careful easing rather than many simultaneous
animations, and Igloo Inc. is known for "landscape flyovers, narrative pacing, and Pixar-grade lighting" — pacing
being the operative word. The v27 build already has the right primitives (750 ms easeInOutCubic view tweens,
critically-damped Follow, a 4.2 s hover-bob offset per robot so nothing syncs) — the premium gap is more likely in
*how many things move on screen per second* than in any single easing curve. **Concrete check for v28 QA:** count
simultaneous animated properties in a typical "everyone idle" frame (10 robots' hover-bob + breathing + idle
habits + 6 lamp flicker sprites + slide/tube idle glints + sky drift + mind particles) — if it's a lot, the read is
"busy," not "alive." Premium real-time scenes (Apple product pages, Monument Valley, Townscaper) tend to hold most
of the frame *visually still* and let one or two things carry all the motion attention at a time. This costs
nothing to fix (it's about which idle animations get toned down or staggered further, not about removing any of
the approved fun layer), but it needs a deliberate pass, not just adding motion.
Sources: [Lusion / Codrops feature, "digital craft"](https://tympanus.net/codrops/2026/04/13/lusion-where-digital-craft-meets-ambitious-experimentation/) ·
[best WebGL/3D agencies 2026, motion notes](https://www.psychoactive.co.nz/content-hub/best-webgl-interactive-3d-agencies) ·
[Awwwards-style 3D build reference stack](https://github.com/tsogjavklann/awwwards-3d).

### 11. Materials: the "satin ceramic" note is right, roughness variation is the next lever
**Payoff: medium. Effort: S.** ART-DIRECTION already specifies clearcoat + roughness for the ceramic
(`rough .42, clearcoat .30`) which is the correct instinct (uniform roughness reads as plastic/render; *varying*
roughness across a surface — worn edges duller, fresh-molded caps glossier — is what separates a hero product shot
from a default PBR material). Given the studio-environment PMREM is already built and costs nothing extra per
frame, the next-cheapest premium lever is painting a subtle roughness map into the same canvas textures already
used for travertine pits/walnut grain (ART 6.3) rather than adding it to the ceramic (which is a solid color, not
canvas-textured today) — a very low-frequency procedural roughness variance (baked once, at init, the same way the
travertine pits are) would catch the PMREM's one long highlight differently across each robot's dome, which is
exactly the "watches are shot" reference ART-DIRECTION already cites approvingly.
Sources: [three.js material PBR practices](https://www.threejs-journey.com/) ·
[100 three.js perf tips, texture reuse](https://www.utsubo.com/blog/threejs-best-practices-100-tips).

---

## The best "AI agents at work" visualizations, and what they do that this hub doesn't yet

### 12. AI Town / Generative Agents: the memory stream + reflection view is the missing "why," not the "what"
**Payoff: medium-high (a genuinely new idea, not in FUN-IDEAS/CONVENIENCES). Effort: M.** The Park et al.
Generative Agents lineage (AI Town, Smallville reimplementations) puts a **memory stream / reflection panel**
alongside the 3D view — not just current activity and location, but *why* an agent is doing what it's doing right
now, surfaced as short natural-language lines pulled from its own reasoning. This hub's crew card already shows
"Now / Since / Last report" (ART 7.3), which is close, but it's facts, not reasoning. The Research Lead's card
(this very report) or the King's card could show one line of "why this, why now" pulled from its own check-in
text — which is exactly the kind of "carefully thought-out, wouldn't have thought of it himself" convenience
FilthE responds to, because it answers "why is the King doing *that* right now" without him having to ask. This
is new relative to everything in FUN-IDEAS/CONVENIENCES and worth flagging to the Research Lead's own backlog
separately from this rendering-focused report.
Sources: [smallville-lite, memory stream + web viewer](https://github.com/kobowood1/smallville-lite) ·
[generative agents reimplementation, dashboard fields](https://github.com/HarshPAtel273/generative_agents).

### 13. Pixel Agents for Claude Code: speech bubbles built straight from transcript events, zero invented text
**Payoff: medium (validates a decision already made, and suggests one extension). Effort: none new — already the
plan.** Pixel Agents reads Claude Code's own JSONL transcript via hooks and turns real log lines into character
state/speech, which is the same "every animation comes from a real event, no fake help" rule this hub already
holds (FUN-IDEAS.md, "Rules every idea here keeps"). The one thing Pixel Agents does that isn't in the current
plan: it's explicitly framed by its own coverage as solving "one of AI coding's most annoying UX problems" — not
knowing whether a long-running agent is *actually working* or silently stuck, at a glance, without reading logs.
This is squarely CONVENIENCES.md #2 (the run watchdog) and #9 (real blocker on top), already the two highest-scored
conveniences — this is independent confirmation from a shipped, well-covered product that this is the right thing
to prioritize first, not a new idea.
Sources: [Pixel Agents, Fast Company coverage](https://www.fastcompany.com/91497413/this-charming-pixel-art-game-solves-one-of-ai-codings-most-annoying-ux-problems) ·
[Pixel Agents for Claude Code, skill page](https://www.mdskills.ai/skills/pixel-agents) ·
[agent-town, zero-dependency pixel visualization](https://github.com/rafapetter/agent-town).

### 14. Mission-control dashboards for AI agent fleets: cost/usage is the one thing this hub doesn't show at all
**Payoff: high — a real gap. Effort: M.** Every AI-agent mission-control pattern found (Mission Control,
tenacitOS-style dashboards) treats **cost and token usage per agent, with running totals**, as core, not optional
— "captures cost and full token usage... displayed on the dashboard with per-task cost breakdown and running
totals." CONVENIENCES.md's "Also good" section has a related item ("Today's usage on the King's card") but it's
in the *cut-for-now* tier, not the top 12. Given FilthE's own CLAUDE.md explicitly tracks Claude usage cost as a
real constraint ("Measured 2026-09-27: one long King chat cost ~$97 in ~2.5h"), and this hub is *the* place he'd
look to catch a runaway session before it burns budget, this is worth re-ranking upward, not left as a "also
good." A simple version: the existing King card gets one line, "Today: 3 runs · ~$X" (or token count if $ isn't
available), pulling from `usage/wakes/<stamp>-<device>` docs CONVENIENCES.md already specs — the data plumbing is
already designed, it's just not in the ranked-to-build list.
Sources: [Mission Control, cost/token tracking](https://github.com/MeisnerDan/mission-control) ·
[mission control dashboard UX patterns](https://uxplanet.org/mission-control-software-ux-design-patterns-benchmarking-e8a2d802c1f3).

---

## What a command center should do for its owner: trust, oversight, and when to notify

### 15. The trigger → policy-gate → evidence-log pattern matches CONVENIENCES.md's #7 almost exactly — cite it as validation
**Payoff: confirms an existing high-ranked plan; no new build implied.** Recent human-AI oversight research
(2025-2026) converges on a specific shape: *Trigger → Planner → Policy Gate → Tools → Validators → Outcome*, with
every step written to an evidence log that preserves "prompts, tool I/O, decisions, approvals" for audit. This is
functionally what CONVENIENCES.md #7 ("Nothing changes behind your back," built entirely on `decided` events) and
#5 ("Silence is a safe answer," the two-way-door default-with-reason pattern) already are — the research literature's
"policy gate" is CLAUDE.md's own only-a-person list, and the "evidence log" is the hub's `decided` event stream.
Worth citing in the build doc as external validation that this is the right shape, not a new instruction — CONVENIENCES.md's
existing #5 and #7 are already better-specified than most of what the papers describe abstractly.
Sources: [design considerations for human oversight of AI (arXiv)](https://arxiv.org/pdf/2510.19512) ·
[human-in-the-loop 2026 guide](https://www.strata.io/blog/agentic-identity/practicing-the-human-in-the-loop/) ·
[trustworthy agentic AI, balancing autonomy with oversight](https://www.researchgate.net/publication/399787839_Trustworthy_Agentic_AI_Balancing_Autonomy_with_Human_Oversight).

### 16. "Notify only for what the owner's own actions are waiting on" is the literature's consensus, and it's exactly CONVENIENCES.md #10
**Payoff: confirms existing plan; no new build implied.** The approval-routing research pattern ("the agent
recognizes the policy boundary, pauses execution, packages the context, and routes an approval request") lines up
with CONVENIENCES.md #10's ranked notification order (newly blocked on him → run about to need him → missed run
→ his own loop closed) almost line for line — the literature's version doesn't have the "his own loop closed"
tier, which is CONVENIENCES.md's own addition and arguably the more thoughtful one (most agent dashboards notify
on *any* completion; this design deliberately narrows it to completions the owner personally triggered). No
new build implied — this is a second independent confirmation (alongside #13) that the already-ranked list has its
priorities right, which is useful validation to put in front of FilthE before more build time goes in.
Sources: [human-AI teaming trust literature review, CHI 2025](https://dl.acm.org/doi/10.1145/3706598.3713527) ·
[collaborative human-AI trust process framework](https://www.sciencedirect.com/science/article/pii/S2949882125000842).

---

## Sources (all, deduplicated)
- [100 Three.js Tips That Actually Improve Performance (2026)](https://www.utsubo.com/blog/threejs-best-practices-100-tips)
- [Horrible 3D/Three.js performance in latest Safari on macOS](https://discourse.threejs.org/t/horrible-3d-three-js-performance-in-latest-safari-on-macos/25940)
- [Horrible Safari Performance](https://discourse.threejs.org/t/horrible-safari-performance/38364)
- [Inconsistent performance of Three.js animations in Safari for iOS](https://discourse.threejs.org/t/inconsistent-performance-of-three-js-animations-in-safari-for-ios/76329)
- [R168 WebGPU - Chasing Shadows - fixed in r169](https://discourse.threejs.org/t/r168-webgpu-chasing-shadows-fixed-in-r169/70319)
- [Release r169 · mrdoob/three.js](https://github.com/mrdoob/three.js/releases/tag/r169)
- [Significant Performance Drop with BatchedMesh · Issue #28776](https://github.com/mrdoob/three.js/issues/28776)
- [Optimizing Three.js: Draw Calls, Instancing & Batching](https://bersus.io/insights/creative-dev/threejs-optimizing-instancing-and-batching/)
- [How to Optimize Shadow Rendering in Three.js](https://discourse.threejs.org/t/how-to-optimize-shadow-rendering-in-three-js-for-better-performance/64681)
- [Add a way to trigger shadow map updates separately from rendering · Issue #23461](https://github.com/mrdoob/three.js/issues/23461)
- [Shadowmap halves my fps](https://discourse.threejs.org/t/shadowmap-halves-my-fps/11519)
- [Shadow normalBias and slopeBias · Issue #13108](https://github.com/mrdoob/three.js/issues/13108)
- [How to fix the shadow acne in Three.js](https://lucidmodules.com/blog/threejs/how-to-fix-shadow-acne/)
- [Three.js Shadows Guide](https://threejsresources.com/guides/shadows)
- [Shadow Acne/Banding; What I learned](https://discourse.threejs.org/t/shadow-acne-banding-what-i-learned/43666)
- [WebGPU performance issue](https://discourse.threejs.org/t/webgpu-performance-issue/87939)
- [WebGPU vs WebGL: Practical Three.js Performance Test](https://aestar.tech/en/blog-en/webgpu-vs-webgl-practical-three-js-performance-test-for-complex-3d-scenes/)
- [Three.js vs WebGPU in 2026: Large-Scale Construction Viewers](https://altersquare.io/blog/three-js-vs-webgpu-2026-large-scale-construction-viewers)
- [Support AgX tone mapping · Issue #27362](https://github.com/mrdoob/three.js/issues/27362)
- [Tone Mapping Overview](https://discourse.threejs.org/t/tone-mapping-overview/75204)
- [Is AGX tonemapping implemented correctly?](https://discourse.threejs.org/t/is-agx-tonemapping-implemented-correctly/60609)
- [Walkable three.js scene with baked irradiance probe GI](https://github.com/vvanghelue/threejs-probe-gi)
- [Three.js and the transparent problem](https://discourse.threejs.org/t/threejs-and-the-transparent-problem/11553)
- [Transparency or Translucency Rendering (NVIDIA)](https://developer.nvidia.com/content/transparency-or-translucency-rendering)
- [Lusion: Where Digital Craft Meets Ambitious Experimentation (Codrops)](https://tympanus.net/codrops/2026/04/13/lusion-where-digital-craft-meets-ambitious-experimentation/)
- [The best WebGL & interactive 3D agencies in 2026](https://www.psychoactive.co.nz/content-hub/best-webgl-interactive-3d-agencies)
- [Awwwards-3d Claude Code skill (reference stack)](https://github.com/tsogjavklann/awwwards-3d)
- [smallville-lite: Generative Agents on Claude API](https://github.com/kobowood1/smallville-lite)
- [generative_agents (Smallville) reimplementation](https://github.com/HarshPAtel273/generative_agents)
- [agent-town: pixel-art AI agent visualization](https://github.com/rafapetter/agent-town)
- [Pixel Agents solves AI coding's UX problem (Fast Company)](https://www.fastcompany.com/91497413/this-charming-pixel-art-game-solves-one-of-ai-codings-most-annoying-ux-problems)
- [Pixel Agents for Claude Code & Claude Desktop](https://www.mdskills.ai/skills/pixel-agents)
- [Mission Control: open-source task management for AI agents](https://github.com/MeisnerDan/mission-control)
- [Mission Control Software UX Design Patterns & Benchmarking](https://uxplanet.org/mission-control-software-ux-design-patterns-benchmarking-e8a2d802c1f3)
- [Design Considerations for Human Oversight of AI (arXiv)](https://arxiv.org/pdf/2510.19512)
- [Human-in-the-Loop: A 2026 Guide to AI Oversight](https://www.strata.io/blog/agentic-identity/practicing-the-human-in-the-loop/)
- [Trustworthy Agentic AI: Balancing Autonomy with Human Oversight](https://www.researchgate.net/publication/399787839_Trustworthy_Agentic_AI_Balancing_Autonomy_with_Human_Oversight)
- [Trusting Autonomous Teammates in Human-AI Teams (CHI 2025)](https://dl.acm.org/doi/10.1145/3706598.3713527)
- [Collaborative human-AI trust (CHAI-T) process framework](https://www.sciencedirect.com/science/article/pii/S2949882125000842)

---

*Written by the Research Lead, 2026-09-28, for the v27→v28 fix pass. Read alongside `SPEC.md`, `ART-DIRECTION.md`,
`FUN-IDEAS.md` and `CONVENIENCES.md`; nothing here repeats their content — items 15-16 explicitly cross-reference
CONVENIENCES.md rather than re-speccing it. Item 12 and 14 are the two genuinely new ideas; everything else is
either a concrete code-level fix (1-11) or external validation of a plan that's already ranked (13, 15, 16).*
