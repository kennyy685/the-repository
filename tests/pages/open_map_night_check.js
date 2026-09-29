#!/usr/bin/env node
/* Night shift, page side: the open map's "Since last night" strip shows the REAL brief (data/night.js, written by
 * `hh.py night-shift`), the SAMPLE tag only on a sample, the samples only under Preview, and still works when the real
 * file is missing (first publish, a failed night) or broken. Offline (MapLibre never loads; the fallback map draws).
 *   node tests/pages/open_map_night_check.js     Exit 0 = pass, 1 = a check failed, 2 = could not run. */
"use strict";
const fs = require("fs");
const path = require("path");
const { pageUrl, closeServer, takeMisses } = require("./serve");

const REL = "docs/design/open-map/index.html";
const ROOT = path.resolve(__dirname, "..", "..");
function loadPlaywright() {
  for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright"]) { try { return require(p); } catch (e) { /* next */ } }
  return null;
}
const briefOf = (text) => { const d = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); return d; };
const REAL = briefOf(fs.readFileSync(path.join(ROOT, "docs/design/open-map/data/night.js"), "utf8"));
/* a brief like tonight's: Columbus pick (outside the map box), Omaha old-house backup, a Columbus sister turf third,
   with the map shapes `hh.py night` adds (hailhunter/openmap.py over data/storms-2026.json) */
function synthBrief() {
  const { execFileSync } = require("child_process");
  const map = JSON.parse(execFileSync("python3", ["-c",
    "import json,sys;sys.path.insert(0,'.');from hailhunter import openmap;" +
    "print(json.dumps(openmap.extra(json.load(open('data/storms-2026.json')),['z0808-columbus'])))"], { cwd: ROOT }).toString());
  const card = (id, name, kind, area, lon, lat, hail) => ({ zone_id: id, name, kind, score: 60, hail_in: hail, storm_day: hail ? "2026-08-08" : null,
    dist_mi: 45.5, doors: 25, start: { address: "22 St", lat, lon }, best_time: null, why: { en: "Why " + name, es: "Por qué " + name },
    plan: { en: "Drive to " + name, es: "Maneja a " + name }, center: { lat, lon }, area_id: area });
  const pick = card("2026-08-08_Columbus~t3", "Columbus: 22 St & 21 St", "storm", "z0808-columbus", -97.376, 41.437, 1.64);
  const backup = card("everyday_Omaha~t2", "Omaha: Pierce St & S 137 Av", "everyday", null, -96.128, 41.247, null);
  const third = card("2026-08-08_Columbus~t1", "Columbus: 36 Ave & 18 St", "storm", "z0808-columbus", -97.36, 41.44, 1.5);
  return { ...REAL, pick, backup, top: [pick, backup, third], map };
}
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };

async function open(browser, url, nightJs) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await ctx.route(/^(https?|wss?):/, (r) => {
    const u = r.request().url();
    if (!/^https?:\/\/127\.0\.0\.1[:/]/.test(u)) return r.abort();
    if (nightJs !== undefined && /\/data\/night\.js$/.test(u)) {
      return nightJs === null ? r.fulfill({ status: 404, body: "404" }) : r.fulfill({ status: 200, contentType: "text/javascript", body: nightJs });
    }
    return r.continue();
  });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e.message || e)));
  await p.goto(url, { waitUntil: "load", timeout: 20000 });
  await p.waitForSelector("section.night", { timeout: 10000 });
  const strip = () => p.$eval("section.night", (s) => ({
    head: s.querySelector(".hl").textContent.trim(),
    sample: !!s.querySelector(".nh .smp"),
    note: (s.querySelector("p.nf") || { textContent: "" }).textContent,
    pressed: [...s.querySelectorAll("[data-night]")].filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset.night),
    keys: [...s.querySelectorAll("[data-night]")].map((b) => b.dataset.night),
    picks: [...s.querySelectorAll(".np .k")].map((k) => k.textContent.trim()),
    plan: [...s.querySelectorAll(".np .pl")].map((k) => k.textContent.trim()),
  }));
  return { p, ctx, errors, strip };
}

async function main() {
  const pw = loadPlaywright();
  if (!pw) { console.error("needs Playwright (/opt/node22/lib/node_modules/playwright)"); process.exit(2); }
  const browser = await pw.chromium.launch({ args: ["--no-sandbox"] });
  try {
    const url = await pageUrl(REL);

    // 1. the real brief, as published
    let t = await open(browser, url);
    let s = await t.strip();
    ok(s.head === REAL.headline.en, `real: headline "${s.head}" is not the brief's "${REAL.headline.en}"`);
    ok(!s.sample, "real: the SAMPLE tag shows on the real brief");
    ok(s.pressed.join() === "real", `real: Preview should start on "Last night", got ${s.pressed}`);
    ok(s.keys.join() === "real,quiet,storm", `real: Preview should offer real,quiet,storm, got ${s.keys}`);
    if (REAL.pick) ok(s.plan[0] === REAL.pick.plan.en, `real: pick plan "${s.plan[0]}" != "${REAL.pick.plan.en}"`);
    ok(s.picks.length === (REAL.pick ? 1 : 0) + (REAL.backup ? 1 : 0), `real: pick/backup rows ${s.picks}`);
    ok(!/^\d+ \S+ \d/.test((REAL.pick && REAL.pick.start && REAL.pick.start.address) || ""), "real: a house number is published");
    // Spanish: the same brief, Spanish words
    await t.p.click('button[data-lang="es"]');
    s = await t.strip();
    ok(s.head === REAL.headline.es, `real ES: headline "${s.head}"`);
    // a sample under Preview: tagged, with its note, then back to the real one
    await t.p.click('[data-night="storm"]');
    s = await t.strip();
    ok(s.sample && s.note.length > 0, "storm sample: no SAMPLE tag / note");
    ok(s.picks.length === 0, "storm sample: pick rows are for the real brief only");
    await t.p.click('[data-night="real"]');
    s = await t.strip();
    ok(!s.sample && s.head === REAL.headline.es, "back to the real brief failed");
    // an area's "N days ago" reason counts to TODAY's Nebraska date (not the day the data file was built) and carries
    // the claim-deadline rule (FilthE 2026-09-29); other reasons pass through untouched
    const ct = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
    const want = Math.round((new Date(ct + "T12:00:00Z") - new Date("2026-08-08T12:00:00Z")) / 864e5);
    const ag = await t.p.evaluate(() => [ageWhy({ st: "d20260808" }, [1, { en: "51 days ago.", es: "Hace 51 días." }]),
      ageWhy({ st: "d20260808" }, [1, { en: "Biggest report: 1.5 in.", es: "x" }])]);
    ok(ag[0][1].en.startsWith(`${want} days ago. Deadline: Nebraska sets no cutoff in days`), `age line: ${JSON.stringify(ag[0])} (want ${want})`);
    ok(ag[0][1].es.startsWith(`Hace ${want} días. Plazo:`), `age line ES: ${ag[0][1].es}`);
    ok(ag[1][1].en === "Biggest report: 1.5 in.", "age line: a non-age reason was rewritten");
    ok(!t.errors.length, "real: JS errors: " + t.errors.join(" | "));
    await t.ctx.close();

    // 2. no real file yet (404): the samples still show, tagged SAMPLE, no "Last night" button
    t = await open(browser, url, null);
    s = await t.strip();
    ok(s.sample, "no real brief: the sample must say SAMPLE");
    ok(!s.keys.includes("real"), "no real brief: a Last night button with nothing behind it");
    ok(!t.errors.length, "no real brief: JS errors: " + t.errors.join(" | "));
    await t.ctx.close();
    takeMisses();

    // 3. a broken / foreign file: ignored, same as missing
    t = await open(browser, url, 'window.NIGHT_REAL={"kind":"junk"};');
    s = await t.strip();
    ok(s.sample && !s.keys.includes("real"), "broken real brief should fall back to the samples");
    ok(!t.errors.length, "broken real brief: JS errors: " + t.errors.join(" | "));
    await t.ctx.close();

    // 4. a failed refresh shows its one line
    t = await open(browser, url, "window.NIGHT_REAL=" + JSON.stringify({ ...REAL, refresh_error: "OSError: down" }) + ";");
    s = await t.strip();
    ok(/storm update failed/i.test(s.note), "refresh_error: no 'storm update failed' line");
    await t.ctx.close();

    // 5. the top 3 follows the brief (King, 2026-09-29): pick, backup, next storm walk, in the brief's order; a pick
    //    west of the map box (Columbus) arrives in the brief's `map` and opens as an area; the home view takes it in
    const BR = synthBrief();
    t = await open(browser, url, "window.NIGHT_REAL=" + JSON.stringify(BR) + ";");
    const top = () => t.p.$$eval(".picks .pick", (bs) => bs.map((b) => ({ name: b.querySelector(".nm").childNodes[0].textContent.trim(),
      pick: b.dataset.pick || null, fly: b.dataset.fly || null, bk: !!b.querySelector("em.bk") })));
    let rows = await top();
    ok(rows.map((r) => r.name).join("|") === BR.top.map((c) => c.name).join("|"), `top 3: ${rows.map((r) => r.name)} != brief ${BR.top.map((c) => c.name)}`);
    ok(rows[0] && rows[0].pick === "z0808-columbus", `top 3: the Columbus pick is not a tappable area (${JSON.stringify(rows[0])})`);
    ok(rows[1] && rows[1].bk && !rows[1].pick && /,/.test(rows[1].fly || ""), `top 3: the backup card (no area) should fly to its middle: ${JSON.stringify(rows[1])}`);
    ok(rows[2] && rows[2].pick === "z0808-columbus" && !rows[2].bk, `top 3: #3 = the next storm walk: ${JSON.stringify(rows[2])}`);
    const b = await t.p.evaluate(() => ({ b: BOUNDS, cam: CAM.center, x: fbProj([-97.3768, 41.4373]).x, w: innerWidth }));
    ok(b.b[0][0] < -97.38 && b.cam[0] < -96.34, `bounds: the home view does not reach Columbus: ${JSON.stringify(b)}`);
    ok(b.x > 0 && b.x < b.w, `bounds: Columbus is off the fallback map (x=${b.x})`);
    await t.p.click('.picks .pick[data-pick="z0808-columbus"]');
    const sel = await t.p.evaluate(() => st.sel);
    ok(sel === "z0808-columbus", `tapping the pick should open Columbus, got ${sel}`);
    ok(!t.errors.length, "top 3: JS errors: " + t.errors.join(" | "));
    await t.ctx.close();

    // 5b. hostile text in the brief's map data never runs; a non-number hail size doesn't break the list (QA)
    const evil = JSON.parse(JSON.stringify(BR));
    evil.map.areas[0].name = { en: '<img src=x onerror="window.__x=1">Columbus', es: "<script>window.__x=1</script>" };
    evil.map.areas[0].town = '<img src=x onerror="window.__x=1">';
    evil.top[2] = { ...evil.top[2], hail_in: "big" };
    t = await open(browser, url, "window.NIGHT_REAL=" + JSON.stringify(evil) + ";");
    await t.p.click('.picks .pick[data-pick="z0808-columbus"]');
    await t.p.waitForTimeout(300);
    const pwn = await t.p.evaluate(() => ({ x: window.__x || 0, n: document.querySelectorAll(".picks .pick").length, img: document.querySelectorAll("img[src=x]").length }));
    ok(!pwn.x && !pwn.img, `hostile map text ran or was drawn as HTML: ${JSON.stringify(pwn)}`);
    ok(pwn.n === 3, `non-number hail: top 3 has ${pwn.n} rows`);
    ok(!t.errors.length, "hostile brief: JS errors: " + t.errors.join(" | "));
    await t.ctx.close();

    // 7. map-west (2026-09-29): a pick west of the old street box draws ITS walk (the Knock app's order, from the start
    //    street) on real streets from the brief's own tile; a malformed walk/tile is dropped, never an error
    const mw = JSON.parse(require("child_process").execFileSync("python3", ["-c",
      "import json,sys;sys.path.insert(0,'.');sys.path.insert(0,'tests');import test_mapwalk as T;from hailhunter import mapwalk;" +
      "d,w=T.columbus();print(json.dumps({'walks':{'z0808-columbus':mapwalk.page_walk(w,1.64)},'tiles':[mapwalk.tile(d['feats'],mapwalk.tile_box(w))]}))"],
      { cwd: ROOT }).toString());
    const BW = { ...BR, map: { ...BR.map, ...mw } };
    t = await open(browser, url, "window.NIGHT_REAL=" + JSON.stringify(BW) + ";");
    await t.p.waitForFunction(() => typeof AREAX !== "undefined" && AREAX && AREAX["z0808-columbus"] && STR_LL, null, { timeout: 10000 });
    await t.p.click('.picks .pick[data-pick="z0808-columbus"]');
    await t.p.evaluate(() => planWalk(false));
    const wk = await t.p.evaluate(() => {
      const X = AREAX["z0808-columbus"], W = st.walk, bb = W && W.pts ? bbox(W.pts) : null;
      const near = STR_LL.flat().filter((l) => l.b[0] < -97.36 && l.b[2] > -97.39 && l.b[1] < 41.45 && l.b[3] > 41.43).length;
      return { sel: st.sel, names: X.s.map((s) => s.n), id: W && W.id, n: W && W.pts ? W.pts.length : 0, k: W && W.k, bb, near,
        rows: [...document.querySelectorAll(".plan")].map((e) => e.textContent).join(" ") };
    });
    ok(wk.sel === "z0808-columbus", `map-west: the pick did not open (${wk.sel})`);
    ok(wk.names.join() === "22 St,21 St", `map-west: walk streets ${wk.names} (want the Knock app's 22 St, 21 St)`);
    ok(wk.id === "z0808-columbus" && wk.n > 10, `map-west: no walk drawn for the Columbus pick: ${JSON.stringify(wk)}`);
    ok(wk.bb && wk.bb[0] > -97.40 && wk.bb[2] < -97.36 && wk.bb[1] > 41.43 && wk.bb[3] < 41.45, `map-west: walk not in Columbus: ${JSON.stringify(wk.bb)}`);
    ok(wk.near > 50, `map-west: no real streets around the Columbus walk (${wk.near} lines)`);
    ok(/22 St/.test(wk.rows), "map-west: the plan panel does not name the start street 22 St");
    ok(!t.errors.length, "map-west: JS errors: " + t.errors.join(" | "));
    await t.ctx.close();
    // 7b. junk walks/tiles are dropped quietly
    const junk = JSON.parse(JSON.stringify(BW));
    junk.map.walks["z0808-columbus"].s[0].p = "nope";
    junk.map.walks["z0808-columbus"].s[1].n = '<img src=x onerror="window.__x=1">';
    junk.map.tiles.push({ o: [0, 0], s: 1, t: [["x"]] });
    t = await open(browser, url, "window.NIGHT_REAL=" + JSON.stringify(junk) + ";");
    await t.p.click('.picks .pick[data-pick="z0808-columbus"]');
    await t.p.waitForTimeout(300);
    const jk = await t.p.evaluate(() => ({ x: window.__x || 0, img: document.querySelectorAll("img[src=x]").length, tiles: NIGHT_X.tiles.length,
      walk: !!NIGHT_X.walks["z0808-columbus"] }));
    ok(!jk.x && !jk.img && jk.tiles === 1 && !jk.walk, `map-west junk: ${JSON.stringify(jk)}`);
    ok(!t.errors.length, "map-west junk: JS errors: " + t.errors.join(" | "));
    await t.ctx.close();
    // 7d. every card draws ITS OWN walk (2026-09-29, every-card-walk): #3 (Columbus t1, same storm area as the pick)
    //     switches the open area to its walk; the old-house backup (no area) draws its walk where it is; the 7 AM
    //     knock plan always stays on the pick's walk
    const zw = JSON.parse(require("child_process").execFileSync("python3", ["-c",
      "import json,sys;sys.path.insert(0,'.');sys.path.insert(0,'tests');import test_mapwalk as T;from hailhunter import mapwalk;" +
      "d,w=T.columbus();w1=dict(w,zone_id='2026-08-08_Columbus~t1',stops=w['stops'][::-1]);" +
      "om=mapwalk.page_walk(w,None);sh=lambda p:[[x+1.25,y-0.19] for x,y in p];" +
      "om={**om,'zone_id':'everyday_Omaha~t2','park':sh([om['park']])[0],'s':[{**r,'p':sh(r['p'])} for r in om['s']],'c':[sh(c) for c in om['c']],'r':[sh(r) for r in om['r']]};" +
      "print(json.dumps({'2026-08-08_Columbus~t3':mapwalk.page_walk(w,1.64),'2026-08-08_Columbus~t1':mapwalk.page_walk(w1,1.5),'everyday_Omaha~t2':om}))"],
      { cwd: ROOT }).toString());
    const BZ = { ...BW, map: { ...BW.map, zwalks: zw } };
    t = await open(browser, url, "window.NIGHT_REAL=" + JSON.stringify(BZ) + ";");
    await t.p.waitForFunction(() => typeof AREAX !== "undefined" && AREAX && STR_LL, null, { timeout: 10000 });
    const cards = await t.p.$$eval(".picks .pick", (bs) => bs.map((b) => ({ pick: b.dataset.pick || null, z: b.dataset.z || null, zw: b.dataset.zw || null })));
    ok(cards[0].z === "2026-08-08_Columbus~t3" && cards[2].z === "2026-08-08_Columbus~t1" && cards[1].zw === "everyday_Omaha~t2" && !cards[1].pick,
      `every card: cards don't carry their walks ${JSON.stringify(cards)}`);
    const park = (z) => zw[z].park.join();
    await t.p.click(".picks .pick:nth-child(3)");                     // #3: Columbus t1, same area as the pick
    await t.p.evaluate(() => planWalk(false));
    let ev = await t.p.evaluate(() => ({ sel: st.sel, cw: st.cw, park: AX(st.sel).park.join(), best: bestFC(areaOf(st.sel)).features.length,
      w0: st.walk && st.walk.pts[0].join(), kp: knockPlan().X.park.join() }));
    ok(ev.sel === "z0808-columbus" && ev.cw === "2026-08-08_Columbus~t1", `every card: #3 did not open its own walk ${JSON.stringify(ev)}`);
    ok(ev.park === park("2026-08-08_Columbus~t1") && ev.park !== park("2026-08-08_Columbus~t3"), `every card: #3 draws the pick's walk ${JSON.stringify(ev)}`);
    ok(ev.w0 === park("2026-08-08_Columbus~t1"), `every card: #3's planned walk does not start at its own start ${JSON.stringify(ev)}`);
    ok(ev.kp === park("2026-08-08_Columbus~t3"), `every card: the 7 AM knock plan left the pick's walk ${JSON.stringify(ev)}`);
    await t.p.evaluate(() => { exitArea(); });
    await t.p.click(".picks .pick:nth-child(1)");                     // back to the pick: its own walk again
    ev = await t.p.evaluate(() => ({ cw: st.cw, park: AX(st.sel).park.join() }));
    ok(ev.cw === "2026-08-08_Columbus~t3" && ev.park === park("2026-08-08_Columbus~t3"), `every card: the pick lost its walk ${JSON.stringify(ev)}`);
    await t.p.evaluate(() => { exitArea(); });
    await t.p.click(".picks .pick:nth-child(2)");                     // the Omaha backup: no area, its walk where it is
    ev = await t.p.evaluate(() => ({ sel: st.sel, pv: PV, park: walkMk.filter((m) => m.park).map((m) => m.ll.join()), lbl: bestLbls.length,
      on: document.querySelector(".picks .pick:nth-child(2)").classList.contains("pv"), pts: walkPts(NIGHT_X.zwalks[PV]).length }));
    ok(!ev.sel && ev.pv === "everyday_Omaha~t2" && ev.on, `every card: the backup did not draw its walk ${JSON.stringify(ev)}`);
    ok(ev.park.join() === park("everyday_Omaha~t2") && ev.lbl === zw["everyday_Omaha~t2"].s.length && ev.pts > 10, `every card: backup walk marks ${JSON.stringify(ev)}`);
    await t.p.click(".picks .pick:nth-child(1)");                     // opening an area clears the preview
    ev = await t.p.evaluate(() => ({ pv: PV, mk: walkMk.length, sel: st.sel }));
    ok(!ev.pv && !ev.mk && ev.sel === "z0808-columbus", `every card: the backup preview stuck ${JSON.stringify(ev)}`);
    ok(!t.errors.length, "every card: JS errors: " + t.errors.join(" | "));
    await t.ctx.close();
    // 7c. tiles/walks of the wrong type, absurd door counts: the page still renders (QA 2026-09-29)
    const odd = JSON.parse(JSON.stringify(BW));
    odd.map.tiles = { nope: 1 };
    odd.map.walks["z0808-columbus"].s[0].h = 1e308;
    t = await open(browser, url, "window.NIGHT_REAL=" + JSON.stringify(odd) + ";");
    const od = await t.p.evaluate(() => ({ picks: document.querySelectorAll(".picks .pick").length, tiles: NIGHT_X.tiles.length,
      h: NIGHT_X.walks["z0808-columbus"] ? NIGHT_X.walks["z0808-columbus"].s[0].h : null }));
    ok(od.picks === 3 && od.tiles === 0 && od.h === 500, `map-west odd types: ${JSON.stringify(od)}`);
    ok(!t.errors.length, "map-west junk: JS errors: " + t.errors.join(" | "));
    await t.ctx.close();

    // 6. an older brief (no top, no map): the list is still pick + backup; an in-box pick keeps the designed view
    t = await open(browser, url, "window.NIGHT_REAL=" + JSON.stringify({ ...BR, top: undefined, map: undefined,
      pick: { ...BR.pick, area_id: "z0613-fremont", center: { lat: 41.32, lon: -96.45 } } }) + ";");
    rows = await top();
    ok(rows.length === 2 && rows[0].pick === "z0613-fremont" && rows[1].bk, `old brief: ${JSON.stringify(rows)}`);
    const b2 = await t.p.evaluate(() => BOUNDS[0][0]);
    ok(b2 === -96.86, `old brief: in-box pick changed the bounds (${b2})`);
    ok(!t.errors.length, "old brief: JS errors: " + t.errors.join(" | "));
    await t.ctx.close();
  } finally {
    await browser.close();
    await closeServer();
  }
  for (const m of takeMisses()) if (!/night\.js$/.test(m)) fails.push("file not in the files map: " + m);
  if (fails.length) { console.log("FAIL\n  " + fails.join("\n  ")); process.exit(1); }
  console.log("PASS: open map night strip reads the real brief (EN/ES), samples only under Preview, missing/broken/failed-refresh handled; top 3 follows the brief's pick + backup; home view reaches a pick west of the box; a Columbus pick draws its own walk on real streets");
}
main().catch((e) => { console.error("open_map_night_check.js crashed: " + (e.stack || e)); process.exit(2); });
