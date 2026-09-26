/* Confirms docs/app/takeoff.js (the HMP App's material order list) gives the same answers as `hh.py takeoff`.
 *   node tests/js/takeoff_check.js [rules.json]
 * With no file it runs `python3 hh.py takeoff --export-rules` itself. Every rules.test_cases entry is a real
 * Python takeoff(); the JS must match the WHOLE result (quantities, how text, assumptions, order text).
 * Exit 0 = all match. tests/test_takeoff.py runs this too (inside `hh.py selftest`) when node is installed. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const { takeoff, selfCheck } = require(path.join(ROOT, "docs", "app", "takeoff.js"));

const src = process.argv[2];
const text = src ? fs.readFileSync(src, "utf8")
  : execFileSync("python3", [path.join(ROOT, "hh.py"), "takeoff", "--export-rules"], { cwd: ROOT, encoding: "utf8" });
const rules = JSON.parse(text);

const cases = rules.test_cases || [];
if (!cases.length) { console.error("no test_cases in the rules doc"); process.exit(1); }
const fails = selfCheck(rules);
for (const f of fails) console.error("MISMATCH " + f);

// Bad jobs must throw, like the Python ValueError.
const bad = [{ kind: "deck" }, { kind: "roof" }, { kind: "mixed" }, { kind: "roof", roof: [] },
             { kind: "roof", roof: { squares: -2 } }, { kind: "roof", roof: { squares: "abc" } },
             { kind: "roof", roof: { squares: 10, roof_type: "dome" } }, { kind: "roof", roof: { squares: 10, pitch: "flat" } },
             { kind: "siding", siding: { material: "brick", wall_sqft: 100 } },
             { kind: "siding", siding: { material: "hardie", wall_sqft: 100, exposure_in: 0 } },
             { kind: "gutters", gutters: {} }, { kind: "roof", roof: {} }];
let badOk = 0;
for (const job of bad) {
  try { takeoff(job, rules); console.error("NO ERROR for bad job " + JSON.stringify(job)); } catch (e) { badOk += 1; }
}

// Materials only: no price, deductible or insurance wording anywhere.
const words = ["deductible", "deducible", "waive", "rebate", "insurance", "seguro", "$"];
let legalOk = true;
for (const t of cases) {
  const out = JSON.stringify(takeoff(t.job, rules)).toLowerCase();
  for (const w of words) if (out.includes(w)) { legalOk = false; console.error(`LEGAL: "${w}" in ${t.name}`); }
}

const failed = new Set(fails.map(f => f.split(":")[0])).size;
const ok = fails.length === 0 && badOk === bad.length && legalOk;
console.log(`${cases.length - failed}/${cases.length} test cases match Python; ` +
            `${badOk}/${bad.length} bad jobs rejected; legal text ${legalOk ? "clean" : "FLAGGED"}`);
process.exit(ok ? 0 : 1);
