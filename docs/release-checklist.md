# Release checklist: every page publish (HMP App, AI hub, Practice Door, HMP HQ)

No page goes live until every box is checked. FilthE's bar is a product a roofer would pay for, not a demo.
This exists because v24 passed every test but still shipped blank buttons and a weak map.

## 1. Build
- [ ] Start from the LIVE version: `git pull` + Artifact read the live page (and `list` its files); merge anything newer.
- [ ] Keep every data collection and field. New fields are additive only. No migrations without the King's OK.
- [ ] Capabilities: omit them on publish (they carry forward) unless the change is deliberate.

## 2. Automatic checks (all must pass)
- [ ] The page's own test drivers (`runall.sh` in the harness folder): every driver ALL PASS.
- [ ] `python3 tests/legal_check.py`: statute text, cancel-notice elements, banned phrases.
- [ ] `node tests/pages/shots.js`: no JS errors, no sideways scroll at 360 and 420.
- [ ] `node tests/pages/design_gate.js`: contrast, empty controls, 44px targets, overlaps, duplicate controls, light and dark (EN + ES, 360 and 420). Exit 0 only; `--quick` while building.
- [ ] `python3 hh.py selftest` (and a fresh-folder bundle test if the engine changed).
- [ ] Module checks the page uses: `tests/js/*_check.js` (incl. `app_files_check.js`: the page and `pages/hmp-app.files.json` agree, no module pasted back inline).

## 3. Look at it (the King does this before publishing)
- [ ] Screenshots of every main screen at 390 px in LIGHT and DARK, EN and one ES.
- [ ] Compare them against the approved mockups (`docs/design/v25-polish/after/`). If it doesn't look like the mockup, it doesn't ship.
- [ ] Every label passes the 2-second test: would FilthE get it at a door, in the sun?
- [ ] No duplicate info, no wall of text, no mystery labels.

## 4. Legal (every customer-facing change)
- [ ] 69-1602: name, HMP, what you sell, said first.
- [ ] 69-1601 / 69-1604(3): 3-day cancel form, EN + ES, every sale.
- [ ] 69-1606(5): no work before the cancel window ends on a non-insurance sale.
- [ ] 44-8604: nothing that covers, waives or rebates a deductible. Never promise insurance pays. Never negotiate claims.
- [ ] 44-8606: itemized description to the homeowner AND the insurer before insurance work starts. 44-8605: no assignment of benefits.
- [ ] "Registered", never "licensed". Business lines only. No cold texts. No owner names for homes.

## 5. Ship
- [ ] Publish to the same URL. A page with a `pages/<name>.files.json` (the HMP App, T169) passes that map as the Artifact tool's `files`, so every module file goes out with it. Copy the page to `pages/`. Commit ONLY your own files (`git add <paths>`, never `-A`), then push.
- [ ] Add a line to `docs/CHANGELOG.md` (version, date, 3 plain bullets).
- [ ] Tell FilthE in 5 lines or fewer what changed and what to try. Push his phone for big releases.
