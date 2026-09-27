#!/usr/bin/env node
/* T201 Practice mode check: the HMP App with realistic data (the v25_shots.js mock). With Practice on, door taps show on
 * screen but the database gets zero writes; turning Practice off throws the practice taps away and the next tap writes
 * for real. Also shoots the bar at 390 px (dark EN, light ES), the More sheet with the switch, and the claim screen's
 * step label (T205: "Step 5 of 14" / "Paso 5 de 14" stays on one line).
 *   NODE_PATH=/opt/node22/lib/node_modules node tests/pages/practice_check.js [--out DIR]     Exit 0 = pass. */
"use strict";
const fs = require("fs");
const path = require("path");
const { pageUrl, closeServer } = require("./serve");
const { data, initScript } = require("./v25_shots");

const args = process.argv.slice(2);
const OUT = args.includes("--out") ? path.resolve(args[args.indexOf("--out") + 1]) : path.join(__dirname, "out", "practice");
function loadPlaywright() {
  for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright"]) { try { return require(p); } catch (e) { /* next */ } }
  throw new Error("playwright not found (set NODE_PATH=/opt/node22/lib/node_modules)");
}
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };

// wraps the mock's db so every write the page makes is counted in window.__writes
const COUNT_WRITES = (practice) => `(() => { window.__writes = []; const use = window.claude.use;
  window.claude.use = async n => { const c = await use(n); if (n !== 'db' || !c) return c;
    const wrap = d => Object.assign({}, d, {
      set: async (v, x) => { window.__writes.push(['set', d.path]); return d.set(v, x); },
      update: async v => { window.__writes.push(['update', d.path]); return d.update(v); },
      delete: async () => { window.__writes.push(['delete', d.path]); return d.delete(); } });
    return { doc: p => wrap(c.doc(p)), collection: n2 => { const q = c.collection(n2); const od = q.doc; q.doc = id => wrap(od(id)); return q; } }; };
  ${practice ? "try { localStorage.setItem('hmp-app-practice', '1'); } catch (e) {}" : ""} })();`;

(async () => {
  const { chromium } = loadPlaywright();
  const exe = ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
  fs.mkdirSync(OUT, { recursive: true });
  const url = await pageUrl("pages/hmp-app.html");
  async function open(o) {
    const ctx = await browser.newContext({ viewport: { width: o.width || 390, height: 844 }, deviceScaleFactor: 2, colorScheme: "light", timezoneId: "America/Chicago", reducedMotion: "reduce" });
    await ctx.route(/^(https?|wss?):/, r => (/^https?:\/\/127\.0\.0\.1[:/]/.test(r.request().url()) ? r.continue() : r.abort()));
    await ctx.addInitScript(initScript(o, data(o.data)));
    await ctx.addInitScript(COUNT_WRITES(!!o.practice));
    const p = await ctx.newPage(), errs = [];
    p.on("pageerror", e => errs.push(String((e && e.message) || e)));
    await p.goto(url, { waitUntil: "load" });
    await p.waitForTimeout(800);
    return { p, ctx, errs };
  }
  const click = async (p, sel) => { const l = p.locator(sel).locator("visible=true").first(); await l.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {}); await l.click({ timeout: 3000 }); await p.waitForTimeout(450); };
  const shot = (p, name) => p.screenshot({ path: path.join(OUT, name + ".png") });
  try {
    // 1. Practice on, Knock: two taps, zero writes; More shows the switch on; turning off clears and real saves return
    { const { p, ctx, errs } = await open({ tab: "knock", practice: true });
      ok(await p.locator("#practiceBar").isVisible(), "the Practice bar is not showing");
      ok(await p.evaluate(() => document.body.classList.contains("practice-on")), "body.practice-on missing");
      await shot(p, "knock-practice");
      await click(p, '#kNow .ans[data-r="not_home"]');
      await click(p, '#kNow .ans[data-r="no"]');
      const w = await p.evaluate(() => window.__writes.slice());
      ok(w.length === 0, "Practice on but the database got writes: " + JSON.stringify(w));
      const n = await p.evaluate(() => window.HMPPractice.count());
      ok(n >= 2, "Practice kept " + n + " writes, expected the 2 door taps");
      await shot(p, "knock-practice-after-taps");
      await click(p, "#moreBtn");
      ok(await p.locator('#practiceBtn[aria-pressed="true"]').count() === 1, "More: the Practice switch is not shown as on");
      await shot(p, "more-practice-on");
      await click(p, "#practiceBtn");
      ok(await p.evaluate(() => !window.HMPPractice.isOn() && window.HMPPractice.count() === 0), "turning off did not clear the practice writes");
      ok(!(await p.locator("#practiceBar").isVisible()), "the Practice bar still shows after turning off");
      ok(await p.evaluate(() => localStorage.getItem("hmp-app-practice")) === "0", "the off choice was not remembered");
      await shot(p, "more-practice-off");
      await click(p, "#shClose");
      await click(p, '#kNow .ans[data-r="not_home"]');
      const w2 = await p.evaluate(() => window.__writes.slice());
      ok(w2.some(x => x[1].startsWith("doors/")), "after Practice off a door tap did not write for real: " + JSON.stringify(w2));
      ok(!errs.length, "page errors: " + errs.join(" | "));
      await ctx.close(); }
    // 2. off by default; Spanish on the Light pick; on from More; the bar's own Turn off
    { const { p, ctx, errs } = await open({ tab: "now", lang: "es", theme: "light" });
      ok(!(await p.locator("#practiceBar").isVisible()), "Practice bar shows while off");
      await click(p, "#moreBtn");
      await shot(p, "more-es-light-off");
      await click(p, "#practiceBtn");
      await click(p, "#shClose");
      ok(await p.locator("#practiceBar").isVisible(), "turning on from More did not show the bar");
      ok(/Práctica/i.test(await p.locator("#practiceBar").innerText()), "the bar is not in Spanish");
      await shot(p, "now-es-light-practice");
      await click(p, '#practiceBar [data-practice="0"]');
      ok(!(await p.locator("#practiceBar").isVisible()), "the bar's Turn off did not work");
      ok(!errs.length, "page errors: " + errs.join(" | "));
      await ctx.close(); }
    // 2b. MacBook Air width (CLAUDE.md: laptop first): the bar and the More switch at 1440 px
    { const { p, ctx, errs } = await open({ tab: "knock", practice: true, width: 1440 });
      ok(await p.locator("#practiceBar").isVisible(), "1440: the Practice bar is not showing");
      await shot(p, "knock-practice-1440");
      ok(!errs.length, "page errors: " + errs.join(" | "));
      await ctx.close(); }
    // 3. T205: the claim's step label never breaks mid-number at 390 (EN + ES)
    for (const lang of ["en", "es"]) {
      const { p, ctx, errs } = await open({ tab: "money", lang, data: { jobDemo: true } });
      await click(p, '[data-open="claim:1418-irving-st"]');
      const labels = await p.evaluate(() => [...document.querySelectorAll("#sheetWrap .stagebar .nw")].map(e => ({ t: e.textContent, lines: e.getClientRects().length, h: e.getBoundingClientRect().height })));
      ok(labels.length > 0, `T205 ${lang}: no step label on the claim screen`);
      ok(labels.every(l => l.h < 24), `T205 ${lang}: step label wraps: ${JSON.stringify(labels)}`);
      await shot(p, "claim-step-" + lang);
      ok(!errs.length, "page errors: " + errs.join(" | "));
      await ctx.close(); }
  } finally { await browser.close(); await closeServer(); }
  for (const f of fails) console.error("FAIL " + f);
  console.log(fails.length ? `practice check: ${fails.length} failed` : "practice check OK (shots in " + OUT + ")");
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
