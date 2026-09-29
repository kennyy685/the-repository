#!/usr/bin/env node
/* Hub v28.2 Shipped shelf (QUEUE-SPECS F, CONTRACT v28.2 HUB.shipped): the real 3D scene (pages/hub/scene.js) in the real
 * hub page with the mocked runtime. The page doesn't set HUB.shipped yet, so this test holds it itself (a locked property
 * the page can't overwrite) and checks the scene:
 *   empty    HUB.shipped {list:[]}: SCENE.shelf.n 0, no boxes, no sign, no #shelfTag, draw-call delta 0
 *   three    3 fixture ships: 3 boxes in list order, newest on the viewer's left, the sign shows, delta <= 4
 *            (measured in one frame, with and without the shelf), the plank merged into the static walnut (+0),
 *            nothing on the shelf casts a shadow
 *   hover    the pointer over box 2 = SCENE.shelf.hover is ship 2, #shelfTag shows its text; off the box = tag hidden
 *   max      9 ships = 8 boxes, the sign reads HUB.shipped.count when given (the week's true total); back to 0 = empty again (sign hidden, tag hidden)
 *   drop     full motion: a ship added later lands on the shelf (starts above it, ends on it)
 *   no-gl    three.js unreachable: the still shows, no #shelfTag, no page error (the no-WebGL path is unchanged)
 *   wiring   the page itself (no lock): 3 ship events + 1 "ready to publish" event in the db. Once the page sets
 *            HUB.shipped (see the report line), it must list exactly the 3 ships, newest first. Until then: SKIP.
 * Needs a local three@0.169.0 (the container can't reach jsdelivr): HUB_QA_SD/three/package (default /tmp/hub-qa);
 * fetched once with `npm pack three@0.169.0` when missing.
 *   NODE_PATH=/opt/node22/lib/node_modules node tests/pages/hub_shelf_check.js [scenario ...]
 * Exit 0 = pass. Shots in tests/pages/out/hub_shelf/. */
"use strict";
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const { pageUrl, closeServer } = require("./serve");
const REPO = path.resolve(__dirname, "..", ".."), OUT = path.join(__dirname, "out", "hub_shelf");
const SD = process.env.HUB_QA_SD || "/tmp/hub-qa", THREE_DIR = path.join(SD, "three", "package");
const FIX = JSON.parse(fs.readFileSync(path.join(REPO, "tests", "fixtures", "hub_live.json"), "utf8")).docs;
const MOCK = path.join(__dirname, "hub_runtime_mock.js");
const WANT = process.argv.slice(2).filter(a => !a.startsWith("--"));
const run = n => !WANT.length || WANT.includes(n);
function loadPlaywright() { for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright"]) { try { return require(p); } catch (e) { /* next */ } } throw new Error("playwright not found (set NODE_PATH=/opt/node22/lib/node_modules)"); }
const fails = [], notes = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); return !!cond; };
const H = 3600e3, now = Date.now();
const SHIPS = [   // newest first, the shape the page sends (CONTRACT v28.2)
  { id: "20260929T160000Z-builder", text: "Builder · Hub v34 published (Version 36)", at: now - 1 * H },
  { id: "20260929T120000Z-designer", text: "Designer · Practice Door v12 went live", at: now - 5 * H },
  { id: "20260928T220000Z-code", text: "Claude Code · merged the night-shift branch into the work branch", at: now - 19 * H }];
const nine = Array.from({ length: 9 }, (_, i) => ({ id: "s" + i, text: "Builder · ship " + i + " published", at: now - i * H }));

function ensureThree() {
  if (fs.existsSync(path.join(THREE_DIR, "build", "three.module.js"))) return true;
  try { fs.mkdirSync(path.join(SD, "three"), { recursive: true });
    execFileSync("npm", ["pack", "three@0.169.0"], { cwd: path.join(SD, "three"), stdio: "ignore", timeout: 120000 });
    execFileSync("tar", ["xzf", "three-0.169.0.tgz"], { cwd: path.join(SD, "three"), stdio: "ignore" });
  } catch (e) { /* reported below */ }
  return fs.existsSync(path.join(THREE_DIR, "build", "three.module.js"));
}

async function open(browser, url, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: o.vp || { width: 1440, height: 900 }, deviceScaleFactor: 1, timezoneId: "America/Chicago",
    reducedMotion: o.rm === false ? "no-preference" : "reduce", colorScheme: o.scheme || "dark" });
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", e => errs.push("pageerror: " + e.message));
  p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|ERR_|net::/.test(m.text())) errs.push("console: " + m.text().slice(0, 200)); });
  if (o.noThree) await p.route(/cdn\.jsdelivr\.net/, r => r.abort());
  else await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.169\.0\/(.*)$/, r => { const f = path.join(THREE_DIR, r.request().url().split("three@0.169.0/")[1]);
    if (fs.existsSync(f)) r.fulfill({ contentType: "text/javascript", body: fs.readFileSync(f, "utf8") }); else r.abort(); });
  await p.route(/^https?:\/\/(?!127\.0\.0\.1)(?!cdn\.jsdelivr)/, r => r.abort());
  await p.addInitScript(({ docs, lock }) => {
    window.__MOCK = { docs, modes: {} }; try { localStorage.clear(); } catch (e) { /* none */ }
    // swiftshader renders ~1-5 fps: keep the page from swapping the 3D room for the still because it's "slow"
    const iv = setInterval(() => { const Hb = window.HUB; if (!Hb || Hb.__pf) return; Hb.__pf = 1; const f = Hb.fallback; Hb.fallback = why => why === "slow" ? 0 : f.call(Hb, why);
      if (lock) { window.__ship = { v: 1, list: [] }; Object.defineProperty(Hb, "shipped", { get: () => window.__ship, set() { /* the test owns it */ }, configurable: true }); }
      clearInterval(iv); }, 5);
  }, { docs: o.docs || FIX, lock: o.lock !== false });
  await p.addInitScript({ path: MOCK });
  await p.goto(url + "#3d-test", { waitUntil: "load" });
  if (!o.noThree) await p.waitForFunction(() => window.SCENE && window.SCENE.ready, null, { timeout: 60000 });
  return { ctx, p, errs };
}
const setShips = (p, list) => p.evaluate(list => { window.__ship = { v: window.__ship.v + 1, list }; }, list);
const until = (p, fn, arg, ms) => p.waitForFunction(fn, arg, { timeout: ms || 90000, polling: 250 }).then(() => true, () => false);
const shelf = p => p.evaluate(() => Object.assign({}, window.SCENE.shelf, { dbg: window.SCENE.debug().shelf, tag: (t => t ? { op: t.style.opacity, text: t.textContent } : null)(document.getElementById("shelfTag")) }));

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  if (!ensureThree()) { console.log("hub_shelf_check: FAIL (no local three@0.169.0 in " + THREE_DIR + " and npm pack failed)"); process.exit(1); }
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ executablePath: fs.existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome") ? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" : undefined,
    args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const url = await pageUrl("pages/crew-hq.html");
  try {
    if (run("empty") || run("three") || run("hover") || run("max")) {
      const { ctx, p, errs } = await open(browser, url);
      await until(p, () => window.SCENE.shelf.v === 1, null, 60000);
      if (run("empty")) {
        const s = await shelf(p), pr = await p.evaluate(() => window.SCENE.shelfProbe());
        ok(s.n === 0 && s.boxes.length === 0, "empty: shelf has boxes: " + JSON.stringify(s));
        ok(!s.dbg.im && !s.dbg.sign, "empty: boxes mesh or SHIPPED sign visible with 0 ships: " + JSON.stringify(s.dbg));
        ok(!s.tag, "empty: #shelfTag exists with 0 ships");
        ok(pr.delta === 0, "empty: an empty shelf costs draw calls: " + JSON.stringify(pr));
        notes.push("empty: n 0, delta " + pr.delta + " (" + pr.on + " calls)");
      }
      await setShips(p, SHIPS);
      const got3 = await until(p, () => window.SCENE.shelf.n === 3 && window.SCENE.shelf.boxes.length === 3);
      ok(got3, "three: 3 ships never became 3 boxes");
      if (got3 && run("three")) {
        const s = await shelf(p), pr = await p.evaluate(() => window.SCENE.shelfProbe());
        ok(s.dbg.count === 3 && s.dbg.im && s.dbg.sign, "three: instanced count / sign wrong: " + JSON.stringify(s.dbg));
        ok(s.boxes.map(b => b.id).join() === SHIPS.map(x => x.id).join(), "three: boxes not in list order: " + s.boxes.map(b => b.id));
        ok(s.boxes.every(b => b.visible) && s.boxes[0].x < s.boxes[1].x && s.boxes[1].x < s.boxes[2].x, "three: newest box is not on the left: " + JSON.stringify(s.boxes));
        ok(pr.delta >= 1 && pr.delta <= 4, "three: shelf draw calls " + pr.delta + " (want 1-4)");
        ok(pr.plankMerged, "three: the plank did not merge into the static walnut (costs a call)");
        ok(!pr.shadows, "three: shelf boxes/sign cast shadows");
        notes.push("three: boxes " + s.boxes.map(b => b.x + "," + b.y).join(" ") + " · shelf calls +" + pr.delta + " (" + pr.off + " -> " + pr.on + ")");
        await p.screenshot({ path: path.join(OUT, "three-1440.png") });
      }
      if (got3 && run("hover")) {
        const b = (await shelf(p)).boxes[1];
        await p.mouse.move(b.x, b.y);
        const hov = await until(p, id => { const s = window.SCENE.shelf; const t = document.getElementById("shelfTag"); return s.hover && s.hover.id === id && t && t.style.opacity === "1"; }, SHIPS[1].id, 60000);
        const s = await shelf(p);
        ok(hov, "hover: pointer on box 2 did not show its tag: " + JSON.stringify({ hover: s.hover, tag: s.tag }));
        ok(s.tag && s.tag.text.includes(SHIPS[1].text), "hover: tag text is not the ship's text: " + JSON.stringify(s.tag));
        await p.screenshot({ path: path.join(OUT, "hover-1440.png") });
        await p.mouse.move(700, 700);
        ok(await until(p, () => { const t = document.getElementById("shelfTag"); return !window.SCENE.shelf.hover && t && t.style.opacity === "0"; }, null, 60000), "hover: tag stays after the pointer leaves");
        notes.push("hover: " + (s.tag && s.tag.text));
      }
      if (run("max")) {
        await setShips(p, nine);
        ok(await until(p, () => window.SCENE.shelf.n === 8), "max: 9 ships did not cap at 8 boxes (n " + (await shelf(p)).n + ")");
        const pr = await p.evaluate(() => window.SCENE.shelfProbe()); ok(pr.delta <= 4, "max: 8 boxes cost " + pr.delta + " calls");
        await p.screenshot({ path: path.join(OUT, "max-1440.png") });
        const tot = (await shelf(p)).dbg.total; ok(tot === 8, "max: with no HUB.shipped.count the sign should count the 8 boxes (got " + tot + ")");
        await p.evaluate(list => { window.__ship = { v: window.__ship.v + 1, list, count: 14 }; }, nine);   // the week's true total rides count
        ok(await until(p, () => window.SCENE.debug().shelf.total === 14), "max: the sign ignores HUB.shipped.count (total " + (await shelf(p)).dbg.total + ")");
        await setShips(p, []);
        ok(await until(p, () => window.SCENE.shelf.n === 0), "max: back to 0 ships left boxes");
        const s = await shelf(p); ok(!s.dbg.im && !s.dbg.sign && (!s.tag || s.tag.op === "0"), "max: empty again but sign/boxes/tag show: " + JSON.stringify(s));
      }
      ok(!errs.length, "shelf scenarios: page errors: " + errs.join(" | "));
      await ctx.close();
    }
    if (run("drop")) {
      const { ctx, p, errs } = await open(browser, url, { rm: false });
      await until(p, () => window.SCENE.shelf.v === 1, null, 60000);
      await p.waitForTimeout(9000);   // past the 8 s "first data places at once" window
      await setShips(p, SHIPS.slice(1));
      await until(p, () => window.SCENE.shelf.n === 2);
      await p.waitForTimeout(4000);
      const rest = (await shelf(p)).boxes;
      await setShips(p, SHIPS);
      const seen = await until(p, () => window.SCENE.shelf.n === 3, null, 60000);
      const y0 = seen ? (await shelf(p)).boxes[0].y : null;
      await p.waitForTimeout(6000);
      const end = (await shelf(p)).boxes;
      ok(seen, "drop: the third ship never arrived");
      ok(seen && y0 < end[0].y, "drop: the new box did not fall onto the shelf (y " + y0 + " -> " + (end[0] && end[0].y) + ")");
      ok(end[1] && rest[0] && Math.abs(end[1].x - rest[0].x) > 2, "drop: the older boxes did not slide back a slot");
      ok(!errs.length, "drop: page errors: " + errs.join(" | "));
      notes.push("drop: new box y " + y0 + " -> " + (end[0] && end[0].y));
      await ctx.close();
    }
    if (run("no-gl")) {
      const { ctx, p, errs } = await open(browser, url, { noThree: true });
      await p.waitForTimeout(6000);
      const st = await p.evaluate(() => ({ nogl: !!document.querySelector(".no-gl"), tag: !!document.getElementById("shelfTag"), ready: !!(window.SCENE && window.SCENE.ready) }));
      ok(st.nogl && !st.ready && !st.tag, "no-gl: the still path changed: " + JSON.stringify(st));
      ok(!errs.length, "no-gl: page errors: " + errs.join(" | "));
      await ctx.close();
    }
    if (run("wiring")) {
      const { ctx, p, errs } = await open(browser, url, { lock: false });
      await p.waitForTimeout(3000);
      const at = ms => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z"), stamp = ms => at(ms).replace(/[-:]/g, "");
      const evs = [[25, "builder", "done", "Hub v34 published (Version 36)"], [15, "designer", "note", "Practice Door v12 went live"], [5, "code", "done", "Merged the night-shift branch into the work branch"],
        [2, "builder", "note", "Hub v35 ready to publish, waiting on your OK"]];
      await p.evaluate(({ evs }) => { for (const [id, doc] of evs) window.__mockDb.store.set(id, doc); window.__mockDb.notify(); },
        { evs: evs.map(([m, a, kind, text]) => ["events/" + stamp(Date.now() - m * 60000) + "-" + a, { agent: a, at: at(Date.now() - m * 60000), kind, lane: "code", room: "dock", status: "done", task: "T1", text }]) });
      await p.waitForTimeout(4000);
      const hs = await p.evaluate(() => window.HUB.shipped || null);
      if (!hs) notes.push("wiring: SKIP (the page doesn't set HUB.shipped yet)");
      else {
        const L = hs.list || [], texts = L.map(x => x.text).join(" | ");
        ok(L.length === 3, "wiring: HUB.shipped has " + L.length + " ships, want 3: " + texts);
        ok(!/ready to publish/.test(texts), "wiring: a 'ready to publish' event counted as shipped");
        ok(L.length === 3 && L[0].at >= L[1].at && L[1].at >= L[2].at && /Merged/.test(L[0].text), "wiring: not newest first: " + texts);
        ok(typeof hs.v === "number" && L.every(x => x.id && typeof x.text === "string" && x.text.length <= 90 && typeof x.at === "number"), "wiring: bad shape: " + JSON.stringify(hs).slice(0, 300));
        const v0 = hs.v; await p.evaluate(() => window.__mockDb.notify()); await p.waitForTimeout(1500);
        ok((await p.evaluate(() => window.HUB.shipped.v)) === v0, "wiring: v bumped with no change in the list");
        notes.push("wiring: page sets HUB.shipped: " + L.length + " ships");
      }
      ok(!errs.length, "wiring: page errors: " + errs.join(" | "));
      await ctx.close();
    }
  } finally { await browser.close(); await closeServer(); }
  for (const n of notes) console.log("  " + n);
  if (fails.length) { console.log("hub_shelf_check: FAIL (" + fails.length + ")"); for (const f of fails) console.log("  - " + f); process.exit(1); }
  console.log("hub_shelf_check: PASS");
}
main().catch(e => { console.error(e); process.exit(1); });
