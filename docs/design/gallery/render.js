#!/usr/bin/env node
/* T170: visual-regression baseline for the component gallery.
 * Renders docs/design/gallery/index.html headless at phone width (390) and saves one full-page
 * PNG to docs/design/gallery/baseline/. The page always shows every component's light AND dark
 * swatch side by side (pinned tokens, independent of the page's own theme), so a single render
 * already captures both - this script exists to freeze that render so a future diff shows exactly
 * what changed.
 *
 *   node docs/design/gallery/render.js
 *
 * Uses playwright (installed globally at /opt/node22/lib/node_modules/playwright) against the
 * Playwright-managed Chromium at /opt/pw-browsers/chromium-1194, with a plain
 * `chromium --screenshot` shell-out fallback if playwright isn't importable.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const DIR = __dirname;
const PAGE = path.join(DIR, "index.html");
const OUT_DIR = path.join(DIR, "baseline");
const OUT = path.join(OUT_DIR, "gallery-390.png");
const WIDTH = 390;

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
  try {
    const context = await browser.newContext({ viewport: { width: WIDTH, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String((e && e.message) || e)));
    await page.goto("file://" + PAGE, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(300); // let @font-face + the token-swatch script settle
    fs.mkdirSync(OUT_DIR, { recursive: true });
    await page.screenshot({ path: OUT, fullPage: true });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    await context.close();
    return { errors, scrollWidth, clientWidth };
  } finally {
    await browser.close();
  }
}

function runWithChromiumCli() {
  const executablePath = findChromiumExecutable();
  if (!executablePath) throw new Error("no chromium executable found");
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // No fullPage support on the CLI path - use a tall window so nothing gets cut off, matching
  // the project convention of over-sizing then relying on the caller to check for empty margin.
  execFileSync(executablePath, [
    "--headless=new", "--no-sandbox", "--disable-gpu",
    `--window-size=${WIDTH},9000`,
    `--screenshot=${OUT}`, "file://" + PAGE,
  ], { timeout: 30000, stdio: "pipe" });
  return { errors: [], scrollWidth: null, clientWidth: null, cliFallback: true };
}

async function main() {
  let result;
  let mode;
  try {
    require.resolve("/opt/node22/lib/node_modules/playwright");
    mode = "playwright (full-page)";
    result = await runWithPlaywright();
  } catch (e) {
    mode = "chromium --screenshot (tall window, no full-page)";
    result = runWithChromiumCli();
  }
  console.log(`Rendering with: ${mode}`);
  console.log(`Saved: ${path.relative(process.cwd(), OUT)}`);
  if (result.errors && result.errors.length) {
    console.log("JS errors:");
    result.errors.forEach((e) => console.log("  " + e));
    process.exitCode = 1;
  }
  if (result.scrollWidth != null && result.clientWidth != null && result.scrollWidth > result.clientWidth + 1) {
    console.log(`Sideways scroll: scrollWidth ${result.scrollWidth} > clientWidth ${result.clientWidth}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("render.js crashed: " + ((e && e.stack) || e));
  process.exit(1);
});
