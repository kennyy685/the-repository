# Designer lessons (newest last; one line each: date, what went wrong, the rule)
- 2026-09-28 7 AM screen: good report shape (commits, shots per theme/language, checks, For FilthE). Keep it.
- 2026-09-28 design_gate renders phones only; FilthE wants MacBook first. Rule: screenshot 1280/1440/1470, light + dark, EN + ES yourself.
- 2026-09-27 Web fetch blocked by the proxy. Rule: proxy status, then curl with a browser user agent, before giving up.
- 2026-09-29 Knock: CSS names clashed (.yes sheet hit a .yes stat cell) and a 1fr column overflowed. Rule: prefix modal classes, grids use minmax(0,1fr), shoot at 1440x810 (real Air window) not 900.
- 2026-09-29 open map v5: spent the budget reading the 2,400-line page before building. Rule: on a big page, grep only the functions you'll change and write the data builder first.
- 2026-09-29 open map v5: the headless smoke test hung on localhost (the agent proxy grabs it) and a CDN script. Rule: serve pages to Playwright with context.route('http://app.test/**') from disk, route CDN files to a curl'd local copy.
- 2026-09-29 next-level x3: shared real-data file (shared/data.js) + one offline shooter (shared/shoot.mjs) first, then 3 designers in parallel = 3 strong mockups in ~30 min. Rule: build the data + shooter before fanning out; swiftshader can't show intros, so check settled state.
