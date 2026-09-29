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
  } finally {
    await browser.close();
    await closeServer();
  }
  for (const m of takeMisses()) if (!/night\.js$/.test(m)) fails.push("file not in the files map: " + m);
  if (fails.length) { console.log("FAIL\n  " + fails.join("\n  ")); process.exit(1); }
  console.log("PASS: open map night strip reads the real brief (EN/ES), samples only under Preview, missing/broken/failed-refresh handled");
}
main().catch((e) => { console.error("open_map_night_check.js crashed: " + (e.stack || e)); process.exit(2); });
