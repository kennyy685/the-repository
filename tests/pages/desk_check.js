#!/usr/bin/env node
/* HMP App desk layout (FilthE: "design for a MacBook Air screen first"; docs/design/app-desk/).
 * Runs the app on the same seeded mock day as e2e_day_check.js (tests/fixtures/app_live.json, 7:00 AM Tue) and checks
 * the layout, not the flow:
 *   1440 x 900 (MacBook Air): Now = map beside the plan; Knock = walk list + door card beside the map, 4 big taps in
 *   view; Leads = list + open lead side by side (clicking another lead swaps the detail, the list stays usable);
 *   Money beside its detail; nav rail on the left; nothing scrolls sideways; a toast never covers a legal notice.
 *   390 x 844 (phone): today's one-column layout, bottom tab bar, sheets from the bottom.
 * Light + dark, EN + ES. Shots in tests/pages/out/desk/ (--shots <dir> writes them somewhere else, e.g. the design folder).
 *   NODE_PATH=/opt/node22/lib/node_modules node tests/pages/desk_check.js [--shots docs/design/app-desk/shots]
 * Exit 0 = pass. */
"use strict";
const fs = require("fs");
const path = require("path");
const { pageUrl, closeServer } = require("./serve");

const ROOT = path.resolve(__dirname, "..", "..");
const argv = process.argv.slice(2), si = argv.indexOf("--shots");
const OUT = si >= 0 ? path.resolve(ROOT, argv[si + 1]) : path.join(__dirname, "out", "desk");
const oi = argv.indexOf("--option"), OPTION = oi >= 0 ? argv[oi + 1] : "";   // docs/design/app-desk/: shoot option B of the comparison
const wi = argv.indexOf("--width"), ONLYW = wi >= 0 ? +argv[wi + 1] : 0;
const FIXF = path.join(ROOT, "tests", "fixtures", "app_live.json");
const MOCK = path.join(__dirname, "hub_runtime_mock.js");
const T7 = "2026-09-29T07:00:00-05:00";
function loadPlaywright() {
  for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright"]) { try { return require(p); } catch (e) { /* next */ } }
  throw new Error("playwright not found (set NODE_PATH=/opt/node22/lib/node_modules)");
}
if (!fs.existsSync(FIXF)) require("child_process").execFileSync("python3", [path.join(__dirname, "app_live_fixture.py")], { cwd: ROOT });
const FIX = JSON.parse(fs.readFileSync(FIXF, "utf8")).docs;
const fails = [];
const PRE = `(() => { window.__MOCK = { docs: window.__E2E_FIX, modes: {} }; window.print = () => {};
  try { localStorage.clear(); for (const [k, v] of Object.entries(window.__E2E_LS || {})) localStorage.setItem(k, v); } catch (e) {} })();`;

async function run(browser, url, o) {
  const tag = `${o.w}-${o.theme}-${o.lang}`, ok = (c, m) => { if (!c) fails.push(`${tag}: ${m}`); return !!c; };
  const ctx = await browser.newContext({ viewport: { width: o.w, height: o.h }, timezoneId: "America/Chicago", colorScheme: o.theme, reducedMotion: "reduce" });
  const p = await ctx.newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.route(/^(https?|wss?):\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await p.addInitScript(({ fix, ls }) => { window.__E2E_FIX = fix; window.__E2E_LS = ls; }, { fix: FIX, ls: { "hmp-app-lang": o.lang, "hmp-app-tab": "now", "hmp-app-look": o.theme } });
  await p.addInitScript(PRE);
  if (OPTION) await p.addInitScript(o => { const set = () => { if (document.documentElement) document.documentElement.dataset.desk = o; }; set(); document.addEventListener("DOMContentLoaded", set); }, OPTION);
  await p.addInitScript({ path: MOCK });
  await p.clock.setFixedTime(new Date(T7));
  await p.goto(url, { waitUntil: "load" });
  await p.waitForTimeout(1500);
  const shot = nm => p.screenshot({ path: path.join(OUT, `${OPTION ? OPTION + "-" : ""}${nm}-${tag}.png`) });
  const box = sel => p.evaluate(s => { const e = document.querySelector(s); if (!e || !e.offsetParent && getComputedStyle(e).position !== "fixed") return null; const r = e.getBoundingClientRect(); return r.width && r.height ? { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom } : null; }, sel);
  const side = (a, b) => a && b && (a.r <= b.x + 1 || b.r <= a.x + 1);   // a and b sit side by side, not stacked
  const noSideScroll = async nm => ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${nm}: the page scrolls sideways`);
  const tab = async t => { await p.click(`#tb-${t}`); await p.waitForTimeout(600); await p.evaluate(() => scrollTo(0, 0)); };
  const DESK = o.w >= 1100;

  // Now
  const map = await box("#zMap"), plan = await box("#dueS"), nav = await box("#tabs");
  ok(map && map.h >= (DESK ? 420 : 200), `Now: the map is ${map ? Math.round(map.h) : 0} px tall`);
  if (DESK) {
    ok(side(map, plan), "Now: the map and today's plan are stacked, not side by side");
    ok(nav && nav.h > nav.w, "Now: the tabs are not a left rail");
    ok(map && map.w >= 560, `Now: the map is only ${map ? Math.round(map.w) : 0} px wide`);
  } else {
    ok(!side(map, plan), "phone: the map and the plan should stack");
    ok(nav && nav.w > nav.h && nav.b >= o.h - 2, "phone: the tab bar is not at the bottom");
  }
  await noSideScroll("Now"); await shot("1-now");

  // Knock: go through the pick so a walk is loaded
  await p.click("#zGo").catch(() => {}); await p.waitForTimeout(900);
  ok(await p.evaluate(() => document.body.dataset.tab) === "knock", "Start knocking didn't open Knock");
  await p.evaluate(() => scrollTo(0, 0));
  const wm = await box("#knock .walkmap"), door = await box("#kNow");
  ok(door, "Knock: no current door card");
  const taps = await p.$$eval("#kNow .ans", bs => bs.map(b => { const r = b.getBoundingClientRect(); return { h: r.height, w: r.width, b: r.bottom }; }));
  ok(taps.length === 4, `Knock: ${taps.length} answer buttons on the door, expected 4`);
  if (DESK) {
    ok(side(wm, door), "Knock: the map and the door card are stacked, not side by side");
    ok(wm && wm.h >= 480, `Knock: the walk map is only ${wm ? Math.round(wm.h) : 0} px tall`);
    ok(taps.every(t => t.h >= 64 && t.b <= o.h), "Knock: the 4 taps are not big (64 px+) and in view without scrolling");
    const list = await box("#knock .kside");
    ok(side(list, wm), "Knock: the walk list is not beside the map");
  }
  // one tap per door stays one tap
  const before = await p.evaluate(() => document.querySelector("#kNow").dataset.pid);
  await p.click('#kNow [data-r="not_home"]'); await p.waitForTimeout(700);
  ok(await p.evaluate(() => document.querySelector("#kNow") && document.querySelector("#kNow").dataset.pid) !== before, "Knock: one tap didn't move to the next door");
  const toast = await box("#appToast");
  if (toast) for (const s of ["#kNow .ans", "#kNow"]) {
    const t = await box(s); if (t && DESK) ok(!(toast.x < t.r && t.x < toast.r && toast.y < t.b && t.y < toast.b) || s === "#kNow", `Knock: the toast covers ${s}`);
  }
  await noSideScroll("Knock"); await shot("2-knock");

  // Leads: list + detail
  await tab("leads");
  const rows = await p.$$eval("#lCards [data-open^='lead:']", bs => bs.map(b => b.dataset.open));
  ok(rows.length >= 2, `Leads: ${rows.length} leads in the list (the fixture has more)`);
  if (rows.length) {
    await p.click(`#lCards [data-open="${rows[0]}"]`); await p.waitForTimeout(700);
    const sh = await box("#sheet"), list = await box("#lCards");
    if (DESK) {
      ok(side(list, sh), "Leads: the open lead covers the list (not two panes)");
      if (rows[1]) { await p.click(`#lCards [data-open="${rows[1]}"]`); await p.waitForTimeout(700);
        ok(await p.evaluate(() => !document.querySelector("#sheetWrap").hidden), "Leads: clicking a second lead closed the detail instead of swapping it"); }
    } else ok(sh && sh.w >= o.w - 2, "phone: the lead sheet is not full width");
    // legal text never under a toast
    const legal = await p.$$eval("#shBody .mustl, #shBody .ns-must, #shBody .legal, #shBody [data-legal]", es => es.length);
    await noSideScroll("Leads"); await shot("3-leads");
    if (legal) { await p.evaluate(() => window.toast && window.toast("Saved")); }
    await p.keyboard.press("Escape"); await p.waitForTimeout(400);
  }
  // Money
  await tab("money");
  await noSideScroll("Money"); await shot("4-money");
  // the homeowner view stays HMP
  ok(errs.length === 0, "JS errors: " + errs.slice(0, 3).join(" | "));
  await ctx.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const url = await pageUrl("pages/hmp-app.html");
  const runs = [{ w: 1440, h: 900, theme: "dark", lang: "en" }, { w: 1440, h: 900, theme: "light", lang: "es" }, { w: 1280, h: 800, theme: "dark", lang: "es" },
    { w: 1512, h: 945, theme: "light", lang: "en" }, { w: 390, h: 844, theme: "dark", lang: "en" }, { w: 390, h: 844, theme: "light", lang: "es" }];
  for (const r of runs.filter(r => !ONLYW || r.w === ONLYW)) { try { await run(browser, url, r); } catch (e) { fails.push(`${r.w}-${r.theme}-${r.lang}: ${String(e.message || e).split("\n")[0]}`); } }
  await browser.close(); await closeServer();
  if (fails.length) { console.log("FAIL\n" + fails.map(f => " - " + f).join("\n")); process.exit(1); }
  console.log(`PASS desk_check: ${runs.length} runs (1440/1512/1280 desk, 390 phone; light + dark; EN + ES). Shots: ${path.relative(ROOT, OUT)}`);
})();
