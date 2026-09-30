# Hologram Walk contest: paused (FilthE, 2026-09-30)

**Done:** 5 concepts built (holo-jarvis, holo-spectral, holo-neon, holo-lidar, holo-ember), 3 judges voted,
winner **holo-spectral** (2 of 3). Ideas harvested from the 4 others and built into the final at `h/`.
QA round 1 found issues. Fix round 1 was **in progress** when paused (partial edits committed).

**Open QA items (round 1):** at door 25, the Next button closes the card but ArrowRight does nothing (they
should match); Prev/Next and the arrow keys silently pause the tour; at 1280x800 the "HAIL CORE 1.10"" label
overlaps pins 5/20; the ES Prev button truncates the address.

**Resume:** in a session that has run id `wf_4f024bbf-c8c`: `Workflow({scriptPath:
"docs/design/next-level/holo-contest.workflow.js", resumeFromRunId: "wf_4f024bbf-c8c"})` (cached up to fix:r1).
In a fresh session there's no cache: have one builder run fix round 1 on the items above in `h/`, then the
workflow's Verify lenses once more.

**Then:** fill `window.LAB` in `holo-lab.html` (winner "holo-spectral", scores, pitches). Publish the artifact
"Aldaba Hologram Walk": root page holo-lab.html; files = h/**, holo-*/ (index + js + shots/walk-*.png),
shared/{data.js,data-fremont.js,fonts/*,vendor/**}; leave out _fremont_raw.json and build scripts. Prove the 3D
loads: Artifact read of the published files list + a Playwright shot of the same layout, zero console errors.
