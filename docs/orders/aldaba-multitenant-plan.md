# Aldaba multi-tenant plan (T208 / T77) — DESIGN ONLY, no app edit in this doc

**Plain English:** Aldaba can't go to another roofing company until (a) HMP's own facts (name, phones,
address, prices, radius, city rules) live in one settings doc instead of being typed into the code, and
(b) each company's data can't leak into another's. The runtime we build on (one shared db per artifact,
whole-artifact sharing, no per-collection tenant walls) makes "one artifact per company" the only safe
isolation shape today. Recommendation: do T77 (settings doc, zero behavior change) now; decide on
multi-artifact only when a second company is real. Don't build sharding we can't test.

## 1) Hardcoded HMP facts found

**Already centralized (good news — most of T77 groundwork exists):**
- `pages/hmp-app.html:1207-1223` — the `SETTINGS` object: company name/legal/short/city/state/mail/
  registrationNo, `people.en/es` (name, phone, tel), `home` (lat/lon/label), `radiusMi: 120`,
  `prices.doc`, `links.practiceDoor/printKit`, `maps.tiles`. Nearly everything in the page already reads
  from `SETTINGS.*` (100+ call sites), not literals. This is a single hardcoded **instance**, not yet a
  swappable **doc** — that's the gap, not the object shape.
- `hailhunter/config.py:9-27` — the engine already has a `"company"` block (`id: "hmp"`, name, short_name,
  home_town, state, lat/lon, `radius_mi.hunt/everyday`, phones) with a comment saying it's there so a
  second roofer could someday override it via `config.json`. **The engine is further along than the app.**

**Not yet centralized — real gaps:**
- `pages/translate/translate.js:37` — `BUSINESS_ADDRESS = "2600 Laverna St, Apt 50, Fremont, NE 68025"`,
  a second hardcoded copy of `SETTINGS.company.mail`. This module is intentionally self-contained ("no
  imports" per its own header) so it never received `SETTINGS`.
- `pages/translate/translate.js:58,66` — the federal Notice of Cancellation text has **"HMP SIDING & ROOFING
  LLC"** baked into the fixed legal paragraph (both EN/ES), not interpolated from any company name.
- `pages/translate/translate.js:103-104,142,237` — the AI system prompts for translate/simplify say
  "HMP is a registered contractor" / "You translate for HMP Siding & Roofing... in Fremont, Nebraska" as
  literal strings, not from settings.
- `docs/app/jobtrack.js:225-226` — one step's law text hardcodes a **Fremont-specific city ordinance
  number** ("Res. 2019-049") inside the 14-step runbook, in both languages. City-specific rules belong in
  data (like `data/city_rules.json`), not in a step's literal text.
- `pages/hmp-app.html:5723` — `CITY_DEFAULT` table (Fremont/Omaha/Lincoln/Columbus/Schuyler hours +
  verified flags) is a literal object in the page, not sourced from `SETTINGS` or a per-company doc.
- `pages/v25/calls.js` (several lines) — falls back to the literal string `"Fremont"` when a lead has no
  city, instead of `SETTINGS.company.city`.
- Nebraska statute numbers (44-8604, 44-8605, 44-8606, 69-1601/1602/1604/1606, etc.) are hardcoded
  throughout `pages/hmp-app.html`, `docs/app/jobtrack.js`, `pages/translate/translate.js`. Correct and
  required for HMP today; a second company in another state needs a state-specific legal pack (T207 is
  already scoped for this) — out of scope for T77 but the same "one settings doc" instinct applies later
  (`legal.state`, `legal.statutes{...}`).
- `pages/v25/practice-houses.js`, `pages/v25/practice.js` — mock data on real Fremont streets. **Not a
  bug**: FilthE asked for realistic mock data on real streets for Practice mode (CLAUDE.md, "No knocking
  yet"). Leave as-is; it's test fixture, never written to the real db.

## 2) Isolation options (what the artifact runtime can actually offer)

Read via `artifact-capabilities`: one artifact = one shared `db`. Access is granted **per artifact**
(Viewer/Commenter/Contributor/Editor/Owner), and `rules` only *raise* the minimum level needed for a
collection path — they cannot wall off one signed-in company's people from another company's documents
in the *same* artifact. The only path-level privacy the runtime gives is `data/users/<id>` (private to
one individual viewer, not shared with that viewer's teammates) — wrong shape for a company's whole crew.

| Option | How | Pros | Cons / risk |
|---|---|---|---|
| **A. One artifact per company** | Publish a fresh HMP-App-shaped artifact per company, each with its own db, its own `system/settings` doc, same code/files | True data isolation (separate db = separate blast radius); matches how access is actually granted (per artifact); no risk of cross-company query bugs | N artifacts to publish/update (files map, CHANGELOG, screenshots) every release; no cross-company reporting without a separate rollup; company count = artifact count to keep in sync |
| **B. One artifact, `companies/<id>/...` prefix in every collection** | Same db, same page, collection paths become `companies/hmp/leads`, `companies/hmp/claims`, etc. | One codebase, one publish, one place to watch usage | **PII risk is real and structural**: the runtime's access levels are whole-artifact. Anyone with Contributor+ on the artifact can read *every* company's prefix — there's no rule that says "Contributor of company A can't read company B's leads/claims (homeowner names, addresses, claim $, phone numbers)." Would need every query to filter client-side by company id, which is a UI convention, not a security boundary — a bug or a modified client reads across companies. Do not do this with real customer PII on the current runtime. |
| **C. `data/users/<id>` per-user private data** | Store each company's data under its crew members' private subtrees | Runtime-enforced privacy per viewer | Wrong shape: HMP's crew (Kenny + Alex today, more later) needs *shared* team data, not each person's own private silo; leads/claims must be visible to the whole crew, so this doesn't fit a multi-person company at all |

**Recommendation: Option A** (one artifact per company) is the only option that matches the runtime's
real security boundary today. Option B is attractive for engineering convenience but is a customer-PII
leak waiting to happen given how access levels actually work here; don't build it until/unless the
platform offers real per-path grantee scoping. Option C doesn't fit the "whole crew shares the board"
requirement at all.

## 3) Recommended path (small, safe steps)

1. **T77 now, zero behavior change:** turn the page's literal `SETTINGS` object into a document the page
   reads at boot (`db.doc('system/settings')`, same pattern already used for `system/prices` /
   `system/takeoff`), falling back to today's literal object as the default when the doc doesn't exist
   yet. Ship this for HMP alone; nothing about HMP's experience changes. This alone fixes "hardcoded
   facts" without touching multi-tenancy.
2. **Fold in the loose ends found above**, still HMP-only, still one artifact: `translate.js` takes a
   `company` argument from `init()` instead of its own `BUSINESS_ADDRESS`/literal HMP strings (the fixed
   legal paragraphs still read word-for-word from the statute, just with the company name/address
   substituted, same as the contract PDFs already do with `{ADDRESS}`); `jobtrack.js`'s Fremont ordinance
   line moves to a `city_rules`-shaped data doc; `CITY_DEFAULT` and the `calls.js` `"Fremont"` fallback
   read `SETTINGS.company.city`.
3. **Only once a second real company is signing up:** stand up Option A — a second artifact from the same
   `pages/hmp-app.html` + `hmp-app.files.json` pair, seeded with that company's own `system/settings` doc
   and its own empty collections. No code fork: same files, different artifact URL, different db.
4. **Never build B for production customer data.** If a demo/sandbox ever wants B's convenience (e.g. an
   internal multi-company test), keep it free of real names/addresses/claim numbers — mock data only,
   same rule Practice mode already follows.

## 4) What the engine (hh.py outputs) needs

- `hailhunter/config.py`'s `company` block is already the right shape (id, name, short_name, home_town,
  state, lat/lon, radius_mi, phones) and already documented as override-via-`config.json`. Point step 1's
  app `system/settings` doc at the **same field names** as this block so one company profile can (later)
  drive both the engine's `config.json` and the app's settings doc without a translation layer.
  `hh.py print-name` (`config.py:457-459`) already falls back to a literal `"HMP Siding & Roofing LLC"` —
  fix that fallback to read `cfg['company']['name']` with no literal, same spirit as step 1.
  ⚠ Not confirmed this run: whether every hh.py output (`weekly.py` scorecard headers, `zones.py` printed
  labels, etc.) reads `cfg['company']` end-to-end or still has its own stray literal — worth one grep pass
  before Option A ever ships, not needed for step 1.
- Every doc the engine writes (`today/walk`, `zones/current`, `walks/<zone>`, `calls/today`,
  `system/prices`, `system/takeoff`, `evidence/<slug>`, `doors/<date>_<pid>`, `stats/*`) is written to
  **one artifact's db** by `put(...)` calls the King/hh.py bundler runs server-side (never from the
  client page) — see `hailhunter/daily.py:64,79,89`. For Option A, this means: one `config.json` (company
  A) → one `hh.py daily` run → one artifact's db. A second company needs its own `config.json` and its
  own run pointed at its own artifact `url`, not a shared run split by prefix.

## 5) Test plan

- **Step 1 (settings doc) regression:** `tests/release_checks.sh` full pass; before/after screenshots
  (light+dark, 420px+desktop) of Now/Knock/Leads/Money/More — must be pixel-identical to today, since the
  literal object becomes the doc's default value.
- **Settings doc live-edit test:** with a mock `window.claude`, write a `system/settings` doc with a
  different company name/phone/city/radius and confirm every screen (door script, cancel notice header,
  Money "who to call" line, zone "near me" fallback) picks it up with no other code change.
- **`ArtifactData` functional pass** (per this session's own runtime rules): after any publish that adds
  `system/settings`, one `list` of it, and the same read at `as_level: "interact"` to confirm a plain
  crew viewer sees the doc but never gets write access implied.
- **translate.js unit test** (extend `tests/js/translate_check.js`): pass a fake company/address into
  `init()`/`readLegal()` and assert the cancellation-notice text substitutes it correctly and the glossary
  legal-block rules (deductible, registered-not-licensed) still fire regardless of company name.
- **Before Option A ever ships:** a real "two companies, one runtime" dry run in a throwaway pair of test
  artifacts (mock data only, per CLAUDE.md's no-real-PII-before-permit rule) — confirm a Contributor
  invited to company A's artifact truly cannot open or query company B's artifact's db at any access
  level, since that is the entire safety argument for choosing Option A over B.
