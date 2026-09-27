"""`hh.py daily --out-dir DIR`: everything the 7:40 AM app job needs, in one go (reads hud.json; no network).

Runs todaywalk (+ evidence), calltoday (+ "your accounts hit", round 54), zones (+ one walk per zone), rentals and,
when a leads export is given, followups. Each HMP App doc is written as its own JSON file named by its doc path,
"/" -> "__":
  today__walk.json, calls__today.json, zones__current.json, walks__<zone id>.json, evidence__<slug>.json,
  rentals__current.json, followups__today.json (only with leads)
plus manifest.json {date, generated_utc, files{doc path: file name}, skipped[], errors[{part, error}], basemap?} so the job
knows exactly which docs to write. One part failing never stops the others (its error goes in the manifest).
"""
import json
import os
import re
from datetime import datetime, timezone

from . import calltoday, rentals, todaywalk, zones
from .benchmarks import doors_per_hour

MANIFEST = "manifest.json"


def file_name(doc_path):
    """"walks/2026-09-10_Fremont~t3" -> "walks__2026-09-10_Fremont~t3.json" (other odd characters -> "-")."""
    return re.sub(r"[^A-Za-z0-9._~-]", "-", str(doc_path).replace("/", "__")) + ".json"


def run(cfg, out_dir, day, hud, results_raw=None, dnk_raw=None, leads_raw=None, doors=None, near=None, conn=None,
        bench=None, now=None, maker=None, accounts_raw=None, acct_conn=None, scout=True):
    """Writes the day's app docs into out_dir and returns the manifest. `*_raw` = the app's exports as loaded JSON
    (None = not given); `near` = a zones.resolve_near() dict (None = home base); `bench` = benchmarks.load().
    `maker` = a basemap.Maker: adds `route` + `basemap` to today/walk and every walks/<zone> doc (additive; None =
    no map fields) and puts its counts in manifest `basemap`.
    Round 54 "your accounts hit": calls/today gets `accounts_hit` from accounts.check() on the accounts file
    (`accounts_raw`: a list of accounts, or the app's {leads, claims, doors} exports) + the leads and door taps
    given here + data/scout_contacts.json businesses (`scout`); `acct_conn` = the engine database (read-only) for
    radar at the address, None = hud.json only. Alerts with a hail report also get their `evidence/<slug>` doc
    (unless today's walk already wrote that address). Manifest `accounts` {checked, located, alerts, radar}."""
    os.makedirs(out_dir, exist_ok=True)
    hud = hud or {}
    results = todaywalk.load_results(results_raw) if results_raw is not None else {}
    taps = todaywalk.today_taps(results_raw, day)
    dnk = todaywalk.load_dnk(dnk_raw) if dnk_raw is not None else set()
    man = {"date": str(day), "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
           "files": {}, "skipped": [], "errors": []}

    def put(path, doc):
        name = file_name(path)
        with open(os.path.join(out_dir, name), "w", encoding="utf-8") as f:
            json.dump(doc, f, indent=1, ensure_ascii=False)
            f.write("\n")
        man["files"][path] = name

    def part(name, fn):
        try:
            fn()
        except Exception as e:                     # one broken part never costs the others
            man["errors"].append({"part": name, "error": f"{type(e).__name__}: {e}"[:300]})

    def walk():
        doc = todaywalk.today_doc(hud, day, doors, results, cfg, now=now, dnk=dnk, taps=taps,
                                  pace=doors_per_hour(bench))
        if maker is not None:
            maker.add(doc)
        put("today/walk", doc)
        for path, ev in todaywalk.evidence_docs(hud, doc["stops"])["docs"].items():
            put(path, ev)

    acc = {}

    def account_check():
        from . import accounts
        acc["doc"] = accounts.check(hud, accounts.gather(cfg, accounts_raw, leads_raw, results_raw, scout), day, cfg,
                                    conn=acct_conn)
        d = acc["doc"]
        man["accounts"] = {"checked": d["checked"], "located": d["located"], "alerts": len(d["alerts"]),
                           "radar": d["radar"]}

    def calls():
        put("calls/today", calltoday.today_doc(hud, day, cfg, accounts=acc.get("doc")))

    def account_evidence():
        from . import accounts
        for path, ev in accounts.evidence_docs((acc.get("doc") or {}).get("alerts")).items():
            if path not in man["files"]:           # today's walk wrote it first: keep that one
                put(path, ev)

    def zone_docs():
        z = zones.zones(hud, day, near, None, None, results, dnk, cfg, conn)
        put("zones/current", z)
        for path, w in zones.walks(hud, z, day, None, results, cfg, now=now, dnk=dnk, taps=taps).items():
            put(path, maker.add(w) if maker is not None else w)

    def rentals_doc():
        put("rentals/current", rentals.hotlist(hud, day, near, None, cfg, conn))

    def follow():
        from . import followups, weekly
        put("followups/today", followups.followups(weekly.load_leads(leads_raw), day, cfg))

    part("todaywalk", walk)
    part("accounts", account_check)
    part("calltoday", calls)
    part("account_evidence", account_evidence)
    part("zones", zone_docs)
    part("rentals", rentals_doc)
    if leads_raw is not None:
        part("followups", follow)
    else:
        man["skipped"].append("followups (no --leads)")
    if maker is not None:
        man["basemap"] = maker.summary()
    with open(os.path.join(out_dir, MANIFEST), "w", encoding="utf-8") as f:
        json.dump(man, f, indent=1, ensure_ascii=False)
        f.write("\n")
    return man
