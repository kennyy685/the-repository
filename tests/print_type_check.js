#!/usr/bin/env node
/* Cooling-off type check (run by tests/legal_check.py, check 5): opens each print piece that carries the buyer's
 * right to cancel in headless Chromium, as printed (media=print, US Letter width), and measures the type the reader
 * actually gets - not the CSS source - in the blocks the law sets a minimum for:
 *
 *   statement  the buyer's-right-to-cancel statement near the signature. FTC 16 CFR 429.1(a): bold face, 10 points
 *              minimum. Neb. 69-1604(1): not less than ten-point boldface, in capital AND lowercase letters (so the
 *              block must not be forced to all caps with text-transform).
 *   form       every Notice of Cancellation copy, all of its text incl. the date/signature lines. FTC 16 CFR 429.1(b):
 *              10-point bold face type. Each copy must also be whole on its page (not clipped by a fixed-size page).
 *
 * Stricter of the two rules applies: >= 10pt (13.33 CSS px) AND weight >= 700, everywhere in those blocks, except
 * HMP's own tags that are not the notice (a copy's "Copy 1 - Buyer keeps" tag, the rep's "HMP gives the buyer both
 * copies" note).
 *
 *   node tests/print_type_check.js          human report; exit 0 = pass, 1 = a block is under the minimum, 2 = can't run
 *   node tests/print_type_check.js --json   one JSON line: {ok, failures[], checked[]} (what legal_check.py reads)
 *
 * Needs Playwright's Chromium (same lookup as tests/pages/design_gate.js). Fonts are local files, so it runs offline.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MIN_PX = 10 * 96 / 72 - 0.01;   // 10pt in CSS px, with float slack
const MIN_WEIGHT = 700;
const EXEMPT = ".copy, .give";         // HMP's own tags inside the blocks, not the required notice text

// file -> selectors and how many rendered blocks of each it must have (EN + ES pages / copies as printed).
const PIECES = [
  { file: "docs/print/contract-draft.html", statement: ".cancel .must", statementMin: 1, form: ".forms .form", formCount: 2 },
  { file: "docs/print/contract-draft-es.html", statement: ".cancel .must", statementMin: 1, form: ".forms .form", formCount: 2 },
  { file: "docs/print/cancel-notice.html", statement: ".page .must", statementMin: 2, form: ".page .form", formCount: 4 },
  { file: "docs/print/contingency-agreement.html", statement: ".cancel .must", statementMin: 2, form: ".forms .form", formCount: 2 },
  { file: "docs/print/contingency-agreement-es.html", statement: ".cancel .must", statementMin: 4, form: ".forms .form", formCount: 4 },
];

function loadPlaywright() {
  for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright"]) {
    try { return require(p); } catch (e) { /* try the next */ }
  }
  return null;
}
function chromiumPath(chromium) {
  for (const c of [process.env.PLAYWRIGHT_CHROMIUM_PATH, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"]) {
    if (c && fs.existsSync(c)) return c;
  }
  try { const p = chromium.executablePath(); if (p && fs.existsSync(p)) return p; } catch (e) { /* fall through */ }
  return undefined;
}

/* Runs in the page: every text run inside each block, with its computed size/weight. */
function measure(args) {
  const { statement, form, exempt, minPx, minWeight } = args;
  const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const snippet = (s) => s.replace(/\s+/g, " ").trim().slice(0, 48);
  function small(block) {
    const out = [];
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.nodeValue.trim()) continue;
      const el = n.parentElement;
      if (el.closest(exempt)) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const px = parseFloat(cs.fontSize), w = parseInt(cs.fontWeight, 10);
      if (px < minPx || w < minWeight) out.push({ text: snippet(n.nodeValue), pt: +(px * 72 / 96).toFixed(2), weight: w });
    }
    return out;
  }
  const res = { statements: [], forms: [] };
  for (const el of document.querySelectorAll(statement)) {
    if (!shown(el)) continue;
    res.statements.push({ text: snippet(el.textContent), small: small(el), caps: getComputedStyle(el).textTransform === "uppercase" });
  }
  for (const el of document.querySelectorAll(form)) {
    if (!shown(el)) continue;
    const page = el.closest(".page");
    let clipped = false;
    if (page) {
      const r = el.getBoundingClientRect(), p = page.getBoundingClientRect();
      clipped = r.bottom > p.bottom + 0.5 || r.right > p.right + 0.5;
    }
    res.forms.push({ text: snippet(el.textContent), small: small(el), clipped });
  }
  return res;
}

async function main() {
  const asJson = process.argv.includes("--json");
  const say = (o) => { if (asJson) process.stdout.write(JSON.stringify(o) + "\n"); };
  const pw = loadPlaywright();
  const exe = pw && chromiumPath(pw.chromium);
  if (!pw || !exe) {
    const why = !pw ? "Playwright not installed" : "no Chromium found";
    say({ ok: null, unavailable: why, failures: [], checked: [] });
    if (!asJson) console.log(`[SKIP] print type check: ${why}`);
    process.exit(2);
  }
  const browser = await pw.chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
  const failures = [], checked = [];
  try {
    const page = await browser.newPage({ viewport: { width: 816, height: 1056 } });   // US Letter at 96 dpi
    await page.emulateMedia({ media: "print" });
    for (const pc of PIECES) {
      const abs = path.join(ROOT, pc.file);
      if (!fs.existsSync(abs)) { failures.push(`${pc.file}: file not found`); continue; }
      await page.goto("file://" + abs, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      const r = await page.evaluate(measure, { statement: pc.statement, form: pc.form, exempt: EXEMPT, minPx: MIN_PX, minWeight: MIN_WEIGHT });
      checked.push(`${pc.file}: ${r.statements.length} statement block(s), ${r.forms.length} cancel form(s)`);
      if (r.statements.length < pc.statementMin) failures.push(`${pc.file}: found ${r.statements.length} right-to-cancel statement block(s) (${pc.statement}), need ${pc.statementMin}`);
      if (r.forms.length !== pc.formCount) failures.push(`${pc.file}: found ${r.forms.length} Notice of Cancellation form(s) (${pc.form}), need ${pc.formCount}`);
      for (const s of r.statements) {
        if (s.caps) failures.push(`${pc.file}: statement "${s.text}..." is forced to ALL CAPS (69-1604(1): capital and lowercase letters)`);
        for (const t of s.small) failures.push(`${pc.file}: statement text "${t.text}" is ${t.pt}pt weight ${t.weight} (need >= 10pt bold)`);
      }
      r.forms.forEach((f, i) => {
        if (f.clipped) failures.push(`${pc.file}: Notice of Cancellation copy ${i + 1} runs past the edge of its page (clipped)`);
        for (const t of f.small) failures.push(`${pc.file}: Notice of Cancellation copy ${i + 1}: "${t.text}" is ${t.pt}pt weight ${t.weight} (need >= 10pt bold)`);
      });
    }
  } finally {
    await browser.close();
  }
  say({ ok: failures.length === 0, failures, checked });
  if (!asJson) {
    checked.forEach((c) => console.log("  checked " + c));
    failures.forEach((f) => console.log("  FAIL " + f));
    console.log(failures.length ? `\n${failures.length} cooling-off type failure(s).` : "\nAll cooling-off type checks passed.");
  }
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => { console.error(e && e.stack || e); process.exit(2); });
