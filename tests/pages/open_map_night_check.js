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
  console.log("PASS: open map night strip reads the real brief (EN/ES), samples only under Preview, missing/broken/failed-refresh handled; top 3 follows the brief's pick + backup; home view reaches a pick west of the box");
}
main().catch((e) => { console.error("open_map_night_check.js crashed: " + (e.stack || e)); process.exit(2); });
