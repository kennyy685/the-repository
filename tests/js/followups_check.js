/* Confirms docs/app/followups.js (the HMP App's follow-up schedule) gives the same answers as `hh.py followups`.
 *   node tests/js/followups_check.js [rules.json]
 * With no file it runs `python3 hh.py followups --export-rules` itself. Every rules.test_cases entry is a real
 * Python followups() result; the JS must match it WHOLE (groups, dates, reasons EN/ES, counts, summary).
 * Exit 0 = all match. tests/test_followups.py runs this too (inside `hh.py selftest`) when node is installed. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");
const { followups, selfCheck } = require(path.join(ROOT, "docs", "app", "followups.js"));

const src = process.argv[2];
const text = src ? fs.readFileSync(src, "utf8")
  : execFileSync("python3", [path.join(ROOT, "hh.py"), "followups", "--export-rules"], { cwd: ROOT, encoding: "utf8" });
const rules = JSON.parse(text);

const cases = rules.test_cases || [];
if (!cases.length) { console.error("no test_cases in the rules doc"); process.exit(1); }
const fails = selfCheck(rules);
for (const f of fails) console.error("MISMATCH " + f);

// A bad day must throw, like the Python ValueError.
let badOk = 0;
const badDays = ["", "2026-02-30", "tomorrow"];
for (const d of badDays) {
  try { followups([], d, rules); console.error("NO ERROR for bad day " + JSON.stringify(d)); } catch (e) { badOk += 1; }
}

// Logistics only: nothing about the deductible, waiving, or insurance paying.
const words = ["deductible", "deducible", "waive", "rebate", "insurance will", "seguro pagar", "$"];
let legalOk = true;
for (const t of cases) {
  const out = JSON.stringify(followups(t.leads, t.today, rules)).toLowerCase();
  for (const w of words) if (out.includes(w)) { legalOk = false; console.error(`LEGAL: "${w}" in ${t.name}`); }
}

const failed = new Set(fails.map(f => f.split(":")[0])).size;
const ok = fails.length === 0 && badOk === badDays.length && legalOk;
console.log(`${cases.length - failed}/${cases.length} test cases match Python; ` +
            `${badOk}/${badDays.length} bad days rejected; legal text ${legalOk ? "clean" : "FLAGGED"}`);
process.exit(ok ? 0 : 1);
