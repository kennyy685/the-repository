/* Checks pages/translate/translate.js:
 *   1. its embedded glossary equals data/glossary_en_es.json (30+ terms, each {en, es, note});
 *   2. readLegal() text is word for word the printed notices (docs/print/cancel-notice.html, contract-draft*.html);
 *   3. deductible and cancel-rights sentences are blocked before any AI call; the prompt carries the glossary.
 *   node tests/js/translate_check.js      exit 0 = all good */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");
const T = require(path.join(ROOT, "pages", "translate", "translate.js"));

let fails = 0;
const bad = (m) => { fails++; console.error("FAIL " + m); };
const norm = (s) => s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&middot;/g, "·").replace(/\s+/g, " ")
  .replace(/\s+([,.)])/g, "$1").trim();

// 1. glossary
const file = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "glossary_en_es.json"), "utf8"));
if (JSON.stringify(file) !== JSON.stringify(T.getGlossary())) bad("embedded glossary differs from data/glossary_en_es.json (re-embed it between GLOSSARY:START/END)");
if (file.terms.length < 30) bad("glossary has " + file.terms.length + " terms, want 30+");
for (const t of file.terms) if (!t.en || !t.es || typeof t.note !== "string") bad("glossary term missing en/es/note: " + JSON.stringify(t));

// 2. legal text vs the print pieces
function paras(html) { return [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1]); }
const cancel = fs.readFileSync(path.join(ROOT, "docs", "print", "cancel-notice.html"), "utf8");
for (const lang of ["en", "es"]) {
  const sec = cancel.match(new RegExp('<section class="page" lang="' + lang + '">([\\s\\S]*?)</section>'))[1];
  const ps = paras(sec.replace(/<span class="fill w addr"><\/span>/g, "{ADDRESS}").replace(/<span class="fill"><\/span>/g, "{DEADLINE}"));
  const must = norm(ps[0].replace(/<span class="give">[\s\S]*?<\/span>/, ""));
  const right = T.readLegal("cancel_right", lang).text;
  if (norm(right) !== must) bad("cancel_right/" + lang + " differs from cancel-notice.html:\n  page: " + must + "\n  js:   " + right);
  const form = sec.match(/<div class="txt">([\s\S]*?)<\/div>/)[1];
  const want = paras(form.replace(/<span class="fill w addr"><\/span>/g, "{ADDRESS}").replace(/<span class="fill"><\/span>/g, "{DEADLINE}")).map(norm);
  const got = T.readLegal("cancel_notice", lang).paras.map((p) => p.replace(T.BUSINESS_ADDRESS, "{ADDRESS}").replace("________", "{DEADLINE}"));
  if (want.length !== got.length) bad("cancel_notice/" + lang + " paragraph count " + got.length + " vs page " + want.length);
  want.forEach((w, i) => { if (w !== got[i]) bad("cancel_notice/" + lang + " para " + (i + 1) + " differs:\n  page: " + w + "\n  js:   " + got[i]); });
}
const addr = cancel.match(/"business_address":\s*"([^"]+)"/);
if (!addr || addr[1] !== T.BUSINESS_ADDRESS) bad("business address differs from cancel-notice.html");
for (const [lang, f] of [["en", "contract-draft.html"], ["es", "contract-draft-es.html"]]) {
  const html = fs.readFileSync(path.join(ROOT, "docs", "print", f), "utf8");
  const text = norm(html);
  const got = T.readLegal("deductible_notice", lang).text;
  if (!text.includes(got)) bad("deductible_notice/" + lang + " not found word for word in " + f);
  const sentences = got.split(/\.\s/).length;
  if (sentences !== 5) bad("deductible_notice/" + lang + " has " + sentences + " sentences, 44-8607 has 5");
}
try { T.readLegal("made_up", "en"); bad("readLegal accepted an unknown id"); } catch (e) { /* good */ }

// 3. guard + prompt
const blocked = ["Can you cover my deductible?", "We can help with the deductible", "¿Me pueden rebajar el deducible?",
  "You have a right to cancel within three business days", "Tiene tres días hábiles para cancelar"];
for (const s of blocked) if (!T.checkRisk(s).blocked) bad("not blocked: " + s);
const fine = ["Can I look at your roof?", "¿Cuándo viene el ajustador?", "We found hail damage on the north slope"];
for (const s of fine) if (T.checkRisk(s).blocked) bad("blocked by mistake: " + s);
if (!T.checkRisk("Your insurance will pay for the roof").flags.includes("insurance_promise")) bad("insurance promise not flagged");
const pr = T.buildPrompt("Hi, can I check your gutters?", "en", "es");
for (const t of file.terms) if (!pr.includes(t.en + " = " + t.es)) bad("prompt missing glossary pair " + t.en);

(async () => {
  const r = await T.sayIt("Can you waive my deductible?", "en", "es");
  if (!r.blocked || r.legal !== "deductible_notice") bad("sayIt did not block a deductible sentence");
  const n = await T.sayIt("Hello", "en", "es"); // no window.claude in node -> clean failure, no throw
  if (n.ok || n.code !== "unavailable") bad("sayIt without sample should fail with code unavailable, got " + JSON.stringify(n));
  console.log(fails ? fails + " problem(s)" : "translate.js OK: glossary " + file.terms.length + " terms, legal text matches print, guard works");
  process.exit(fails ? 1 : 0);
})();
