/* v28.1 hub chat check: a mocked runtime (db + user + sample + mcp) drives the King chat end to end.
 *   node tests/pages/hub_chat_check.js   -> screenshots in tests/pages/out/hub-chat-*.png, exit 1 on a failed check
 * Checks: a question gets an instant SMUIPO answer (no wake), an order streams "Got it, sending to the King", fires the
 * CURRENT system/king.wake_trigger at once, and the status walks sent -> King got it -> on it -> done. */
"use strict";
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const { pageUrl, closeServer } = require("./serve");
const OUT = path.join(__dirname, "out"); fs.mkdirSync(OUT, { recursive: true });

const MOCK = () => {
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const docs = new Map([
    ["system/king", { wake_trigger: "trig_TESTwake01", live_session: "session_OLDKING", orders: [] }],
    ["board/current", { now: [{ id: "T1", owner: "Code", status: "DOING", task: "Hub instant chat" }], next: [], waiting: [] }],
    ["crew/sessions", { sessions: [{ title: "SMUIPO (King)", state: "working", doing: "Talking with you" }] }],
    ["system/memory", { facts: ["FilthE wants instant answers in the hub"] }],
    ["agents/code", { status: "idle", at: now, doing: "" }],
  ]);
  const subs = [];
  const coll = (p) => [...docs.entries()].filter(([k]) => k.split("/").length === p.split("/").length + 1 && k.startsWith(p + "/"));
  const snapDoc = (p) => ({ exists: docs.has(p), id: p.split("/").pop(), data: () => docs.get(p) });
  const snapColl = (p, ord) => { let d = coll(p).map(([k, v]) => ({ id: k.split("/").pop(), data: () => v }));
    if (ord) d.sort((a, b) => String(b.data().at).localeCompare(String(a.data().at))); return { docs: d, size: d.length }; };
  const fire = () => setTimeout(() => { for (const s of subs) s(); }, 5);
  const q = (p, ord) => ({ orderBy: () => q(p, true), limit: () => q(p, ord), where: () => q(p, ord),
    onSnapshot: (fn) => { const s = () => fn(snapColl(p, ord)); subs.push(s); setTimeout(s, 10); return () => {}; },
    get: async () => snapColl(p, ord), doc: (id) => doc(p + "/" + id) });
  const doc = (p) => ({ onSnapshot: (fn) => { const s = () => fn(snapDoc(p)); subs.push(s); setTimeout(s, 10); return () => {}; },
    get: async () => snapDoc(p), set: async (v) => { docs.set(p, JSON.parse(JSON.stringify(v))); fire(); },
    update: async (v) => { if (!docs.has(p)) throw Object.assign(new Error("nf"), { code: "not_found" }); docs.set(p, Object.assign({}, docs.get(p), v)); fire(); },
    delete: async () => { docs.delete(p); fire(); } });
  const db = { doc, collection: (p) => q(p) };
  const calls = []; window.__mock = { docs, calls, fire, lastRun: null };
  const sample = async (input, opts) => {
    calls.push({ tool: "sample", input: String(input).slice(-200) });
    const order = /build|fix|publish/i.test(String(input).split("FilthE just wrote:").pop());
    const full = order ? "#ORDER Build the TEST thing FilthE asked for\n\nGot it, sending to the King: build the TEST thing.\nThe King posts the result right here.\n\n1. Want a screenshot when it's done? Our pick: yes."
      : "#ANSWER\n\nThe King is on the hub instant chat (T1). Nothing is blocked.\n\n1. Want a morning summary here at 7 AM? Our pick: yes.\n2. What do you picture when you open the hub?";
    for (let i = 20; i < full.length + 20; i += 20) { await new Promise((r) => setTimeout(r, 30)); opts.onText && opts.onText({ text: full.slice(0, i), delta: "" }); }
    return { text: full, truncated: false };
  };
  sample.json = async () => ({ reply: "ok", actions: [] });
  const mcp = { callTool: async (server, tool, input) => { calls.push({ tool, input });
    if (tool === "fire_trigger") { window.__mock.lastRun = { status: "SUCCEEDED", fired_at: new Date().toISOString() }; return { payload: {} }; }
    if (tool === "get_session") return { payload: { ccr: { id: input.session_id, external_metadata: { context_usage: { used_tokens: 236000 } }, session_context: { model: "m-test" } } } };
    if (tool === "list_environments") return { payload: { environments: [{ environment_id: "env_TEST", kind: "anthropic_cloud", state: "active" }] } };
    if (tool === "create_session") return { payload: { session_id: "session_NEWKING01" } };
    if (tool === "get_trigger") return { payload: { trigger: { id: input.trigger_id, enabled: true, last_run: window.__mock.lastRun } } };
    return { payload: {} }; } };
  const user = { canEdit: async () => true, isOwner: async () => false };
  window.claude = { use: async (n) => ({ db, sample, mcp, user })[n] || null };
};

(async () => {
  const browser = await chromium.launch({ executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined });
  const fails = [], errs = [];
  for (const look of ["graphite", "ledger"]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("pageerror", (e) => errs.push(String(e)));
    await page.addInitScript(MOCK);
    if (look === "ledger") await page.addInitScript(() => { try { localStorage.setItem("hub-theme", JSON.stringify({ look: "ledger" })); } catch (e) {} });
    await page.goto(await pageUrl("pages/crew-hq.html"));
    await page.waitForTimeout(2500);
    await page.keyboard.press("k").catch(() => {});
    await page.evaluate(() => { const w = document.getElementById("kingWin"); if (w.hidden) document.getElementById("kingBubble").click(); });
    await page.waitForTimeout(400);
    // 1) a question: instant answer, no wake
    await page.fill("#kcInput", "TEST: what are you working on?"); await page.press("#kcInput", "Enter");
    await page.waitForTimeout(2500);
    let st = await page.evaluate(() => ({ fires: window.__mock.calls.filter((c) => c.tool === "fire_trigger").length,
      inst: [...window.__mock.docs.entries()].filter(([k, v]) => /-king-i$/.test(k) && v.instant).length,
      mode: [...window.__mock.docs.entries()].filter(([k]) => /-you-k$/.test(k)).map(([, v]) => v.mode) }));
    if (st.fires !== 0) fails.push(look + ": a question woke the King");
    if (st.inst !== 1) fails.push(look + ": no instant answer saved");
    if (!(await page.$("#ktLog li.king.inst .kt-tag"))) fails.push(look + ": instant answer has no tag (" + (await page.evaluate(() => document.getElementById("ktLog").innerHTML.slice(0, 600))) + ")");
    if (st.mode[0] !== "answered") fails.push(look + ": question not marked answered (" + st.mode + ")");
    // 2) an order: instant ack + a wake of the CURRENT trigger
    await page.waitForTimeout(1100);   // new second = new event id
    await page.fill("#kcInput", "TEST: build the test thing please"); await page.press("#kcInput", "Enter");
    await page.waitForTimeout(2500);
    st = await page.evaluate(() => ({ fires: window.__mock.calls.filter((c) => c.tool === "fire_trigger"), ev: [...window.__mock.docs.entries()].filter(([k]) => /-you-k$/.test(k)).map(([k, v]) => [k, v]) }));
    if (st.fires.length !== 1 || st.fires[0].input.trigger_id !== "trig_TESTwake01") fails.push(look + ": order did not fire the current trigger once");
    const ord = st.ev[st.ev.length - 1];
    if (!ord || ord[1].mode !== "order" || ord[1].wake !== "ok") fails.push(look + ": order event not stamped (" + JSON.stringify(ord && ord[1]) + ")");
    await page.screenshot({ path: path.join(OUT, `hub-chat-${look}-sent.png`) });
    // delivery check (12 s) -> "King got it"; then the King acks and replies
    await page.waitForTimeout(13000);
    const got = await page.evaluate(() => [...document.querySelectorAll("#ktLog .kt-st span")].map((s) => s.textContent));
    if (!got.some((t) => /King got it/.test(t))) fails.push(look + ": no 'King got it' after last_run (" + got + ")");
    await page.evaluate((id) => { const at = new Date().toISOString().replace(/\.\d+Z$/, "Z"), s = at.replace(/[-:]/g, "");
      window.__mock.docs.set("events/" + s + "-code-a", { agent: "code", at, kind: "progress", to: "you", re: id, text: "On it" }); window.__mock.fire(); }, ord[0].split("/")[1]);
    await page.waitForTimeout(400);
    const on = await page.evaluate(() => [...document.querySelectorAll("#ktLog .kt-st span")].map((s) => s.textContent));
    if (!on.some((t) => /on it/.test(t))) fails.push(look + ": ack not shown");
    await page.waitForTimeout(1100);
    await page.evaluate((id) => { const at = new Date().toISOString().replace(/\.\d+Z$/, "Z"), s = at.replace(/[-:]/g, "");
      window.__mock.docs.set("events/" + s + "-code-r", { agent: "code", at, kind: "note", to: "you", re: id, text: "TEST done", long: "Built the TEST thing.\n\n1. Publish it? Our pick: yes." }); window.__mock.fire(); }, ord[0].split("/")[1]);
    await page.waitForTimeout(500);
    const done = await page.evaluate(() => [...document.querySelectorAll("#ktLog .kt-st span")].map((s) => s.textContent));
    if (!done.some((t) => /^Done/.test(t))) fails.push(look + ": done not shown");
    await page.screenshot({ path: path.join(OUT, `hub-chat-${look}-done.png`) });
    const tg = await page.$("#ktLog li.king.inst .kt-tag"); if (tg) { const bb = await tg.boundingBox(); const cs = await tg.evaluate((n) => { const c = getComputedStyle(n); return [c.display, c.visibility, c.opacity, c.color, c.fontSize].join(" "); }); if (!bb || bb.width < 10) fails.push(look + ": tag not visible " + cs); else console.log(look, "tag", JSON.stringify(bb), cs); }
    // 3) "Start a fresh King": memory line says heavy, two-step confirm, session made from his account, old King told
    if (look === "graphite") {
      await page.evaluate(() => { const w = document.getElementById("kingWin"); w.hidden = true; document.getElementById("kingBubble").click(); });
      await page.waitForTimeout(800);
      const t = await page.textContent("#kFreshT");
      if (!/236k/.test(t) || !/heavy/.test(t)) fails.push("fresh: memory line wrong (" + t + ")");
      await page.click("#kFreshBtn"); await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(OUT, "hub-chat-fresh-ask.png") });
      await page.click('#kFresh [data-fk="yes"]'); await page.waitForTimeout(1500);
      const r = await page.evaluate(() => ({ cs: window.__mock.calls.filter((c) => c.tool === "create_session").map((c) => c.input), k: window.__mock.docs.get("system/king"),
        lastFire: window.__mock.calls.filter((c) => c.tool === "fire_trigger").pop() }));
      if (r.cs.length !== 1 || r.cs[0].environment_id !== "env_TEST" || r.cs[0].source_revision !== "claude/amazing-gauss-yzfpq0" || r.cs[0].model !== "m-test") fails.push("fresh: create_session args " + JSON.stringify(r.cs));
      if (!r.k.pending_king || r.k.pending_king.session !== "session_NEWKING01") fails.push("fresh: pending_king not written");
      if (!r.lastFire || !/fresh King/.test(r.lastFire.input.text)) fails.push("fresh: old King not told");
      const t2 = await page.textContent("#kFreshT"); if (!/New King starting/.test(t2)) fails.push("fresh: no starting line (" + t2 + ")");
      await page.evaluate(() => { const k = window.__mock.docs.get("system/king"); window.__mock.docs.set("system/king", Object.assign({}, k, { live_session: "session_NEWKING01", wake_trigger: "trig_NEWwake02" })); window.__mock.fire(); });
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, "hub-chat-fresh-live.png") });
      const t3 = await page.textContent("#kFreshT"); if (/starting/.test(t3)) fails.push("fresh: still 'starting' after the new King went live");
    }
    await page.close();
  }
  await browser.close(); await closeServer();
  if (errs.length) fails.push("JS errors: " + errs.slice(0, 3).join(" | "));
  console.log(fails.length ? "FAIL\n- " + fails.join("\n- ") : "PASS: instant answer, order wake, status sent -> got it -> on it -> done (graphite + ledger)");
  process.exit(fails.length ? 1 : 0);
})();
