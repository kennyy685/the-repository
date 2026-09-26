/* Confirms docs/app/estimate.js (the HMP App's quick estimate) gives the same answers as `hh.py estimate`.
 *   node tests/js/estimate_check.js [rules.json]
 * With no file it runs `python3 hh.py estimate --export-rules` itself. Every rules.test_cases entry is a real
 * Python estimate(); the JS must match low/high exactly (plus lines, minimum, warnings and the EN/ES summary).
 * Exit 0 = all match. tests/test_estimate_rules.py runs this too (inside `hh.py selftest`) when node is installed. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const { estimate, selfCheck } = require(path.join(ROOT, "docs", "app", "estimate.js"));

const src = process.argv[2];
const text = src ? fs.readFileSync(src, "utf8")
  : execFileSync("python3", [path.join(ROOT, "hh.py"), "estimate", "--export-rules"], { cwd: ROOT, encoding: "utf8" });
const rules = JSON.parse(text);

const cases = rules.test_cases || [];
if (!cases.length) { console.error("no test_cases in the rules doc"); process.exit(1); }
const fails = selfCheck(rules);
for (const f of fails) console.error("MISMATCH " + f);

// Bad jobs must throw, like the Python ValueError.
const bad = [{ type: "deck", siding_squares: 5 }, { type: "roof" }, { type: "siding", siding_squares: -2 },
             { type: "siding", siding_squares: 5, stories: 4 }, { type: "siding", siding_squares: 5, material: "brick" },
             { type: "siding", siding_squares: 5, material: "constructor" }, { type: "roof", roof_squares: 5, pitch: "flat" }];
let badOk = 0;
for (const job of bad) {
  try { estimate(job, rules); console.error("NO ERROR for bad job " + JSON.stringify(job)); } catch (e) { badOk += 1; }
}

// Ranges only: no deductible / "insurance will pay" wording anywhere in what the JS produces.
const words = ["deductible", "deducible", "waive", "rebate", "insurance will pay"];
let legalOk = true;
for (const t of cases) {
  const out = JSON.stringify(estimate(t.job, rules)).toLowerCase();
  for (const w of words) if (out.includes(w)) { legalOk = false; console.error(`LEGAL: "${w}" in ${t.name}`); }
}

const ok = fails.length === 0 && badOk === bad.length && legalOk;
console.log(`${cases.length - new Set(fails.map(f => f.split(":")[0])).size}/${cases.length} test cases match Python; ` +
            `${badOk}/${bad.length} bad jobs rejected; legal text ${legalOk ? "clean" : "FLAGGED"}`);
process.exit(ok ? 0 : 1);
