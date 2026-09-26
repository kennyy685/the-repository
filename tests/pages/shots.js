#!/usr/bin/env node
/* T72: real pass/fail check on the app pages themselves - renders each page headless, at two
 * phone sizes, with a mocked window.claude (present but no capabilities granted, the same shape
 * real pages get in preview / before the viewer approves anything), and fails the run if the page
 * throws a JS error or scrolls sideways.
 *
 *   node tests/pages/shots.js
 *
 * Saves a PNG per page+size under tests/pages/out/ (gitignored scratch, not the deliverable) and
 * prints one PASS/FAIL line per page+size. Exit 0 = every page rendered clean at both sizes.
 *
 * Uses playwright (installed globally; look at /opt/pw-browsers/chromium for a Playwright-managed
 * browser like this repo has). Falls back to puppeteer-core against the same browser folder, then
 * to a plain `chromium --screenshot` shell-out, so this still runs somewhere without either module.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const OUT_DIR = path.join(__dirname, "out");
const PAGES = ["pages/hmp-app.html", "pages/crew-hq.html", "pages/practice-door.html"];
const SIZES = [
  { width: 360, height: 800 },
  { width: 420, height: 900 },
];

// Present but grants nothing - the same shape a page sees before the viewer approves any
// capability, or when a capability isn't declared. Every page in PAGES already has a fallback
// path for this (checked for `window.claude && typeof window.claude.use === 'function'`, then
// treats a null/rejected `use()` as "no capability"), so this is the realistic mock to test
// against, not an empty `window.claude = undefined`.
const MOCK_CLAUDE_INIT = `
  window.claude = {
    use: async () => null,
    complete: async () => "",
  };
`;

function findChromiumExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_PATH,
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  try {
    // eslint-disable-next-line import/no-extraneous-dependencies
    const { chromium } = require("/opt/node22/lib/node_modules/playwright");
    return chromium.executablePath();
  } catch (e) {
    return null;
  }
}

async function runWithPlaywright() {
  const { chromium } = require("/opt/node22/lib/node_modules/playwright");
  const executablePath = findChromiumExecutable() || undefined;
  const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
  const results = [];
  try {
    for (const rel of PAGES) {
      for (const size of SIZES) {
        results.push(await checkOnePlaywright(browser, rel, size));
      }
    }
  } finally {
    await browser.close();
  }
  return results;
}

async function checkOnePlaywright(browser, rel, size) {
  const fileUrl = "file://" + path.join(ROOT, rel);
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height } });
  await context.addInitScript(MOCK_CLAUDE_INIT);
  const page = await context.newPage();
  const errors = [];
  const networkNotes = [];
  page.on("pageerror", (e) => errors.push(String(e && e.message || e)));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // A page in this sandbox has no real internet (Google Fonts, mainly), so a failed external
    // resource load is expected here and not a bug in the page's own code - keep it out of the
    // pass/fail count, but still surface it so a real broken-asset path doesn't go unnoticed.
    if (isNetworkResourceError(text)) networkNotes.push(text);
    else errors.push("console.error: " + text);
  });
  let loadError = null;
  try {
    await page.goto(fileUrl, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(500); // let async connect()/render settle
  } catch (e) {
    loadError = String(e && e.message || e);
  }
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth).catch(() => null);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth).catch(() => null);
  const sidewaysScroll = scrollWidth != null && clientWidth != null && scrollWidth > clientWidth + 1;
  const outPath = shotPath(rel, size);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  try {
    await page.screenshot({ path: outPath, fullPage: false });
  } catch (e) {
    errors.push("screenshot failed: " + (e && e.message || e));
  }
  await context.close();
  return {
    rel, size, errors, networkNotes, loadError, sidewaysScroll, scrollWidth, clientWidth, outPath,
  };
}

function isNetworkResourceError(text) {
  return /failed to load resource|net::err_|err_cert|err_name_not_resolved|err_internet_disconnected/i.test(text);
}

function shotPath(rel, size) {
  const base = path.basename(rel, ".html");
  return path.join(OUT_DIR, `${base}-${size.width}x${size.height}.png`);
}

async function runWithPuppeteer() {
  // eslint-disable-next-line import/no-extraneous-dependencies
  const puppeteer = require("puppeteer-core");
  const executablePath = findChromiumExecutable();
  if (!executablePath) throw new Error("no chromium executable found for puppeteer-core");
  const browser = await puppeteer.launch({ executablePath, args: ["--no-sandbox"] });
  const results = [];
  try {
    for (const rel of PAGES) {
      for (const size of SIZES) {
        results.push(await checkOnePuppeteer(browser, rel, size));
      }
    }
  } finally {
    await browser.close();
  }
  return results;
}

async function checkOnePuppeteer(browser, rel, size) {
  const fileUrl = "file://" + path.join(ROOT, rel);
  const page = await browser.newPage();
  await page.setViewport({ width: size.width, height: size.height });
  await page.evaluateOnNewDocument(MOCK_CLAUDE_INIT);
  const errors = [];
  const networkNotes = [];
  page.on("pageerror", (e) => errors.push(String(e && e.message || e)));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (isNetworkResourceError(text)) networkNotes.push(text);
    else errors.push("console.error: " + text);
  });
  let loadError = null;
  try {
    await page.goto(fileUrl, { waitUntil: "networkidle0", timeout: 20000 });
    await new Promise((r) => setTimeout(r, 500));
  } catch (e) {
    loadError = String(e && e.message || e);
  }
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth).catch(() => null);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth).catch(() => null);
  const sidewaysScroll = scrollWidth != null && clientWidth != null && scrollWidth > clientWidth + 1;
  const outPath = shotPath(rel, size);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  try {
    await page.screenshot({ path: outPath });
  } catch (e) {
    errors.push("screenshot failed: " + (e && e.message || e));
  }
  await page.close();
  return {
    rel, size, errors, networkNotes, loadError, sidewaysScroll, scrollWidth, clientWidth, outPath,
  };
}

function runWithChromiumCli() {
  const executablePath = findChromiumExecutable();
  if (!executablePath) throw new Error("no chromium executable found for --screenshot fallback");
  const results = [];
  for (const rel of PAGES) {
    for (const size of SIZES) {
      const fileUrl = "file://" + path.join(ROOT, rel);
      const outPath = shotPath(rel, size);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      const errors = [];
      let loadError = null;
      try {
        execFileSync(executablePath, [
          "--headless=new", "--no-sandbox", "--disable-gpu",
          `--window-size=${size.width},${size.height}`,
          `--screenshot=${outPath}`, fileUrl,
        ], { timeout: 20000, stdio: "pipe" });
      } catch (e) {
        loadError = String(e && e.message || e);
      }
      // The CLI fallback can't inject window.claude, read console errors, or measure scroll
      // width - it only confirms the page renders without crashing chromium itself.
      results.push({
        rel, size, errors, networkNotes: [], loadError, sidewaysScroll: false, scrollWidth: null,
        clientWidth: null, outPath, cliFallback: true,
      });
    }
  }
  return results;
}

async function main() {
  let results;
  let mode;
  try {
    require.resolve("/opt/node22/lib/node_modules/playwright");
    mode = "playwright";
    results = await runWithPlaywright();
  } catch (e1) {
    try {
      require.resolve("puppeteer-core");
      mode = "puppeteer-core";
      results = await runWithPuppeteer();
    } catch (e2) {
      mode = "chromium --screenshot (no JS-error or scroll checks)";
      results = runWithChromiumCli();
    }
  }

  console.log(`Rendering with: ${mode}\n`);
  let anyFail = false;
  for (const r of results) {
    const problems = [];
    if (r.loadError) problems.push(`failed to load: ${r.loadError}`);
    if (r.errors.length) problems.push(...r.errors.map((e) => `JS error: ${e}`));
    if (r.sidewaysScroll) problems.push(`sideways scroll (scrollWidth ${r.scrollWidth} > clientWidth ${r.clientWidth})`);
    const label = `${r.rel} @ ${r.size.width}x${r.size.height}`;
    if (problems.length) {
      anyFail = true;
      console.log(`[FAIL] ${label}`);
      for (const p of problems) console.log(`    ${p}`);
    } else {
      console.log(`[PASS] ${label}${r.cliFallback ? " (render only)" : ""} -> ${path.relative(ROOT, r.outPath)}`);
    }
    if (r.networkNotes && r.networkNotes.length) {
      console.log(`    (${r.networkNotes.length} external resource load(s) failed - no network in this sandbox, not counted against the page)`);
    }
  }

  if (anyFail) {
    console.error("\nOne or more pages failed.");
    process.exit(1);
  }
  console.log("\nAll pages rendered clean at both sizes.");
  process.exit(0);
}

main().catch((e) => {
  console.error("shots.js crashed: " + (e && e.stack || e));
  process.exit(1);
});
