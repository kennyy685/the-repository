"""Offline tests for "storm alert on your own accounts" (research round 54 item 3, board T193): new hail (or damaging
wind) over an address HMP already has -> `hh.py accounts` alerts + the first block (`accounts_hit`) of calls/today.

Fixtures (tests/fixtures/accounts_*.json), today = 2026-09-27, window 60 days:
- inside the hail: lead 105 E 4th St (hud.json hail_evidence at the house, 1.65"), claim 50 Near St (0.2 mi from a
  storm door-list house), Interested door 77 Wahoo Ave (0.4 mi from a town hail report), the Springhill Ridge business
  (two buildings in hud.json targets, one business line), Booked door 300 Wind Rd (70 mph wind 0.6 mi away)
- outside: lead 9 Far Away Ln (Lincoln); old storm: lead 10 Old Storm Rd (June 1 storm, 118 days ago)
- not new: claim 200 N Main St (hail on its own date of loss); not accounts: a lost lead, a "No" door, a cell phone"""
import contextlib
import io
import json
import os
import shutil
import sys
import tempfile
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import hh  # noqa: E402
from hailhunter import accounts, calltoday, daily, db, mrms  # noqa: E402
from hailhunter import config as C  # noqa: E402

TODAY = "2026-09-27"
FIX = os.path.join(HERE, "fixtures")
BAD_WORDS = ("insurance", "claim", "deductible", "covered", "will pay", "seguro", "reclamo", "deducible", "cubr",
             "pagar")


def fixture(name):
    with open(os.path.join(FIX, name), encoding="utf-8") as f:
        return json.load(f)


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.cfg = C.load(os.path.join(self.tmp, "none.json"))
        self.cfg["paths"] = {**self.cfg["paths"], **{k: os.path.join(self.tmp, k) for k in ("db", "cache", "export")}}
        self.hud = fixture("accounts_hud.json")
        self.accts = accounts.merge(accounts.load_accounts(fixture("accounts_app.json"), self.cfg),
                                    accounts.scout_accounts(self.cfg, os.path.join(FIX, "accounts_scout.json")))

    def tearDown(self):
        shutil.rmtree(self.tmp)


class LoadAccounts(Base):
    def test_app_exports_become_accounts(self):
        by_key = {a["key"]: a for a in self.accts}
        self.assertEqual(len(self.accts), 9)
        self.assertNotIn("leads/200-n-main-st", by_key)                      # lost lead: not an account
        self.assertNotIn("doors/2026-09-10_P3", by_key)                      # a "No" door: not an account
        self.assertNotIn("4 Cell Ln|", by_key)                               # a cell phone: never called
        self.assertEqual(by_key["claims/200-n-main-st-fremont"]["since"], "2026-09-20")   # date of loss
        self.assertEqual(by_key["leads/105-e-4th-st"]["since"], "2026-09-01")             # created_at
        self.assertEqual(by_key["doors/2026-09-10_P1"]["since"], "2026-09-10")            # tap date
        for a in self.accts:
            if a["kind"] != "commercial":                                    # homes: no names, no phones
                self.assertFalse({"name", "phone", "homeowner_first_name"} & set(a), a)

    def test_explicit_list_and_forgiving_input(self):
        got = accounts.load_accounts({"accounts": [
            {"kind": "lead", "key": "k1", "address": "1 A St", "city": "Fremont", "lat": "41.4", "lon": "-96.5"},
            {"kind": "commercial", "address": "2 B St", "name": "Plaza", "phone": "402-555-0199"},
            {"kind": "weird", "address": "3 C St"},                          # unknown kind -> lead
            {"kind": "lead"},                                                # no address, no location: skipped
            "not a dict"]}, self.cfg)
        self.assertEqual([(a["kind"], a["key"]) for a in got],
                         [("lead", "k1"), ("commercial", "2 B St|"), ("lead", "3 C St|")])
        self.assertEqual((got[0]["lat"], got[0]["lon"]), (41.4, -96.5))
        self.assertEqual(got[1]["phone"], "402-555-0199")
        self.assertEqual(accounts.load_accounts(None, self.cfg), [])
        self.assertEqual(accounts.scout_accounts(self.cfg, os.path.join(self.tmp, "missing.json")), [])

    def test_one_account_per_address_claim_first(self):
        got = accounts.merge([{"kind": "door", "key": "d", "address": "9 X St", "city": "Fremont", "lat": 41.0,
                               "lon": -96.0, "since": None}],
                             [{"kind": "claim", "key": "c", "address": "9 x st.", "city": "FREMONT", "lat": None,
                               "lon": None, "since": "2026-09-01"}])
        self.assertEqual(len(got), 1)
        self.assertEqual((got[0]["key"], got[0]["lat"]), ("c", 41.0))        # claim wins, keeps the door's location


class CheckHudOnly(Base):
    """The cloud morning run: hud.json only, no engine database."""

    def test_inside_hit_outside_and_old_storm_not(self):
        doc = accounts.check(self.hud, self.accts, TODAY, self.cfg)
        keys = [a["key"] for a in doc["alerts"]]
        self.assertEqual(keys, ["leads/105-e-4th-st", "15735 Rosewood St|Omaha", "15859 Rosewood St|Omaha",
                                "doors/2026-09-10_P1", "claims/50-near-st-fremont", "doors/2026-09-10_P2"])
        for k in ("leads/9-far-away-ln", "leads/10-old-storm-rd", "claims/200-n-main-st-fremont"):
            self.assertNotIn(k, keys)                                        # outside / old storm / not new
        self.assertEqual((doc["checked"], doc["located"], doc["days"], doc["min_hail"], doc["radar"]),
                         (9, 7, 60, 1.0, False))
        self.assertEqual(doc["since"], "2026-07-29")
        self.assertEqual(doc["not_located"], [])        # businesses match by address (hud.json targets) instead

    def test_alert_fields_sources_and_hail_report(self):
        a = {x["key"]: x for x in accounts.check(self.hud, self.accts, TODAY, self.cfg)["alerts"]}
        lead = a["leads/105-e-4th-st"]
        for k in ("key", "kind", "address", "city", "event_date", "max_hail_in", "distance_mi", "source",
                  "hail_report_hint"):
            self.assertIn(k, lead)
        self.assertEqual((lead["event_date"], lead["max_hail_in"], lead["distance_mi"], lead["source"], lead["match"]),
                         ("2026-09-20", 1.65, 0.0, "hail_evidence", "at"))      # evidence beats the door list's 1.6
        self.assertEqual(lead["hail_report"]["nearest_report"]["source"], "trained spotter")
        self.assertEqual(lead["hail_report_hint"]["doc"], "evidence/105-e-4th-st-fremont")
        self.assertIn('1.65" hail at the address', lead["hail_report_hint"]["en"])
        self.assertIn("Granizo de 1.65\"", lead["hail_report_hint"]["es"])
        near = a["claims/50-near-st-fremont"]
        self.assertEqual((near["source"], near["match"], near["max_hail_in"], near["distance_mi"]),
                         ("near_house", "near", 1.6, 0.2))
        self.assertIsNone(near["hail_report"]["hail_in"])                    # no reading AT the address: said so
        self.assertIn("no reading at the address", near["hail_report_hint"]["en"])
        town = a["doors/2026-09-10_P1"]
        self.assertEqual((town["source"], town["max_hail_in"], town["event_date"]), ("storm_report", 1.25, "2026-09-24"))
        wind = a["doors/2026-09-10_P2"]
        self.assertEqual((wind["peril"], wind["max_wind_mph"], wind["max_hail_in"], wind["source"], wind["hail_report"]),
                         ("wind", 70.0, None, "wind_report", None))            # the 45 mph gust (band 0) is ignored
        biz = a["15735 Rosewood St|Omaha"]
        self.assertEqual((biz["kind"], biz["city"], biz["name"], biz["phone"], biz["source"]),
                         ("commercial", "Omaha", "Springhill Ridge Apartments", "(402) 891-0742", "commercial"))

    def test_window_config_and_since(self):
        old = accounts.check(self.hud, self.accts, TODAY, self.cfg, days=150)
        hit = {a["key"]: a for a in old["alerts"]}["leads/10-old-storm-rd"]      # a longer window reaches June 1
        self.assertEqual((hit["event_date"], hit["source"]), ("2026-06-01", "door_list"))
        self.cfg["accounts"]["max_days"] = 5                                   # config.json can set the window
        self.assertEqual([a["key"] for a in accounts.check(self.hud, self.accts, TODAY, self.cfg)["alerts"]],
                         ["doors/2026-09-10_P1", "doors/2026-09-10_P2"])
        self.cfg["call_today"]["min_hail"] = 1.5                               # the call list's hail bar is reused
        del self.cfg["accounts"]["max_days"]
        keys = [a["key"] for a in accounts.check(self.hud, self.accts, TODAY, self.cfg)["alerts"]]
        self.assertNotIn("doors/2026-09-10_P1", keys)                          # 1.25" < 1.5"
        self.assertIn("15735 Rosewood St|Omaha", keys)

    def test_missing_or_empty_hud(self):
        doc = accounts.check({}, self.accts, TODAY, self.cfg)
        self.assertEqual([a["key"] for a in doc["alerts"]], [])
        self.assertIn("leads/105-e-4th-st", doc["not_located"])            # no hud.json, no lat/lon: said so
        self.assertNotIn("claims/50-near-st-fremont", doc["not_located"])  # it has its own lat/lon
        self.assertEqual(accounts.check(None, [], TODAY, self.cfg)["alerts"], [])


class CallsToday(Base):
    def test_accounts_block_first_and_existing_fields_kept(self):
        before = calltoday.today_doc(self.hud, TODAY, self.cfg, associations=[])
        chk = accounts.check(self.hud, self.accts, TODAY, self.cfg)
        doc = calltoday.today_doc(self.hud, TODAY, self.cfg, associations=[], accounts=chk)
        for k in before:                                                       # every existing field is still there
            self.assertIn(k, doc)
        self.assertEqual(doc["count"], before["count"])
        for old, new in zip(before["calls"], doc["calls"]):                    # same calls, one additive flag
            self.assertEqual({k: v for k, v in new.items() if k != "account_hit"}, old)
        self.assertTrue(doc["calls"][0]["account_hit"])
        self.assertEqual(list(doc).index("accounts_hit") < list(doc).index("calls"), True)
        rows = doc["accounts_hit"]
        self.assertEqual((doc["accounts_count"], doc["accounts_checked"]), (5, 9))
        self.assertEqual(doc["accounts_title"]["en"], "Your accounts hit")
        self.assertEqual([r["key"] for r in rows], ["leads/105-e-4th-st", "15735 Rosewood St|Omaha",
                                                    "doors/2026-09-10_P1", "claims/50-near-st-fremont",
                                                    "doors/2026-09-10_P2"])
        self.assertEqual([r["rank"] for r in rows], [1, 2, 3, 4, 5])
        biz = rows[1]                                                          # one row per business line
        self.assertEqual(([x["address"] for x in biz["also"]], biz["call_rank"]), (["15859 Rosewood St"], 1))
        self.assertIn("1 more of their buildings hit", biz["why"]["en"])
        self.assertIn("Springhill Ridge Apartments after the September 12 hail", biz["opener"]["en"])
        lead = rows[0]
        for k in ("name", "phone", "ask_for", "address", "city", "hail_in", "day", "why", "opener", "hail_report",
                  "hail_report_hint", "event_date", "max_hail_in", "distance_mi", "source"):
            self.assertIn(k, lead)
        self.assertEqual((lead["name"], lead["phone"], lead["hail_in"], lead["day"]),
                         ("105 E 4th St", "", 1.65, "2026-09-20"))
        self.assertIn("Your lead", lead["why"]["en"])
        self.assertIn("7 days ago", lead["why"]["en"])
        self.assertIn("hace 7 días", lead["why"]["es"])
        self.assertIn("0.2 mi away", rows[3]["why"]["en"])
        self.assertIn("wind gusts to 70 mph", rows[4]["why"]["en"])
        self.assertIn("strong wind", rows[4]["opener"]["en"])

    def test_legal_no_owner_names_no_personal_phones_no_insurance_talk(self):
        chk = accounts.check(self.hud, self.accts, TODAY, self.cfg)
        rows = calltoday.today_doc(self.hud, TODAY, self.cfg, associations=[], accounts=chk)["accounts_hit"]
        text = json.dumps(rows, ensure_ascii=False)
        for bad in ("SOME OWNER", "PO BOX", "Maria", "Rosa", "Ana", "402-555-0101", "555-1212", "Cell Apts"):
            self.assertNotIn(bad, text)
        for r in rows:
            if r["kind"] != "commercial":
                self.assertEqual((r["phone"], r["name"], r["ask_for"]), ("", r["address"], ""))
            for lang in ("en", "es"):
                said = r["opener"][lang].lower()
                for bad in BAD_WORDS:
                    self.assertNotIn(bad, said, f"{bad!r} in {lang}: {said}")
                self.assertEqual(said.count("?"), 1)                          # one sentence

    def test_not_checked_is_additive_empty(self):
        doc = calltoday.today_doc(self.hud, TODAY, self.cfg, associations=[])
        self.assertEqual((doc["accounts_hit"], doc["accounts_count"], doc["accounts_checked"]), ([], 0, None))


class Radar(Base):
    """Where the engine database has the radar maps: the reading AT the address wins."""

    def setUp(self):
        super().setUp()
        self.conn = db.connect(self.cfg["paths"]["db"])

    def tearDown(self):
        self.conn.close()
        super().tearDown()

    def _swath(self, day, inches):
        meta = {"lat0": 41.6, "lon0": -96.7, "dlat": 0.01, "dlon": 0.01, "shape": [60, 60], "complete": True}
        with open(mrms.grid_path(self.cfg, day), "wb") as f:
            np.savez_compressed(f, mesh=np.round(inches * 25.4 * 10).astype(np.uint16), meta=json.dumps(meta))
        self.conn.execute("INSERT INTO swaths VALUES (?,?,?,1,?,0,0,0,0,?)", (day, "k", "t", float(inches.max()), "t"))
        self.conn.commit()

    def test_inside_swath_outside_and_old_storm(self):
        g = np.zeros((60, 60))
        g[5:15, 5:15] = 1.4                                                    # hail swath around 41.50, -96.60
        self._swath("2026-09-12", g)
        old = np.zeros((60, 60))
        old[18:23, 28:33] = 2.0                                                # June 1: around 41.40, -96.40
        self._swath("2026-06-01", old)
        self.conn.execute("INSERT INTO parcels (pid, address, city, lat, lon) VALUES "
                          "('P9', '12 Parcel Rd', 'Waterloo', 41.51, -96.61)")  # located from the database
        self.conn.commit()
        accts = accounts.load_accounts([
            {"kind": "lead", "key": "inside", "address": "1 Swath St", "city": "Valley", "lat": 41.50, "lon": -96.60},
            {"kind": "lead", "key": "outside", "address": "2 Dry St", "city": "Wahoo", "lat": 41.20, "lon": -96.30},
            {"kind": "claim", "key": "old", "address": "3 June St", "city": "Yutan", "lat": 41.40, "lon": -96.40},
            {"kind": "door", "key": "parcel", "address": "12 Parcel Rd", "city": "Waterloo"}], self.cfg)
        hud = {"storms": [{"day": "2026-09-12", "lat": 41.21, "lon": -96.31, "hail": 1.5, "basis": "ground"}]}
        doc = accounts.check(hud, accts, TODAY, self.cfg, conn=self.conn)
        by = {a["key"]: a for a in doc["alerts"]}
        self.assertEqual(sorted(by), ["inside", "parcel"])                    # outside + old storm: no alert
        self.assertTrue(doc["radar"])
        a = by["inside"]
        self.assertEqual((a["source"], a["match"], a["event_date"], a["distance_mi"]), ("radar", "at", "2026-09-12", 0.0))
        self.assertAlmostEqual(a["max_hail_in"], 1.4, places=1)
        self.assertAlmostEqual(a["hail_report"]["hail_in"], 1.4, places=1)
        self.assertAlmostEqual(a["hail_report"]["radar_max_in"], 1.4, places=1)
        # the radar said no hail at "outside" that day, so the town report 0.7 mi away doesn't count...
        self.assertIn("outside", [x["key"] for x in accounts.check(hud, accts, TODAY, self.cfg)["alerts"]])  # ...w/o it
        longer = {x["key"] for x in accounts.check(hud, accts, TODAY, self.cfg, conn=self.conn, days=150)["alerts"]}
        self.assertIn("old", longer)

    def test_fresh_empty_database(self):
        """The cloud always starts empty: a brand-new database (no radar maps, no parcels) = the hud.json answer."""
        doc = accounts.check(self.hud, self.accts, TODAY, self.cfg, conn=self.conn)
        plain = accounts.check(self.hud, self.accts, TODAY, self.cfg)
        self.assertFalse(doc["radar"])
        self.assertEqual([a["key"] for a in doc["alerts"]], [a["key"] for a in plain["alerts"]])


class Commands(unittest.TestCase):
    """hh.py accounts / calltoday --accounts / daily --accounts, on a config whose database and scout file are temp
    (so a real engine database on the machine never changes the answers)."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        data = os.path.join(self.tmp, "data")
        os.makedirs(data)
        shutil.copy(os.path.join(FIX, "accounts_scout.json"), os.path.join(data, "scout_contacts.json"))
        self.config = os.path.join(self.tmp, "config.json")
        with open(self.config, "w") as f:
            json.dump({"paths": {"db": os.path.join(data, "hailhunter.db"), "cache": os.path.join(data, "cache"),
                                 "export": os.path.join(data, "export"), "tuned": os.path.join(data, "tuned.json"),
                                 "association_contacts": os.path.join(data, "none.json")}}, f)
        self.hud = os.path.join(FIX, "accounts_hud.json")
        self.acc = os.path.join(FIX, "accounts_app.json")

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def run_hh(self, *args):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            rc = hh.main(["--config", self.config, "--offline", *args])
        return rc, out.getvalue(), err.getvalue()

    def test_accounts_command(self):
        out_p = os.path.join(self.tmp, "alerts.json")
        rc, out, err = self.run_hh("accounts", "--accounts", self.acc, "--hud", self.hud, "--date", TODAY,
                                   "--out", out_p)
        self.assertEqual(rc, 0)
        doc = json.loads(out)
        self.assertEqual((len(doc["alerts"]), doc["checked"]), (6, 9))
        with open(out_p) as f:
            self.assertEqual(json.load(f)["alerts"][0]["key"], "leads/105-e-4th-st")
        self.assertIn("6 hit of 9 checked", err)
        rc, out, _ = self.run_hh("accounts", "--accounts", self.acc, "--hud", self.hud, "--date", TODAY, "--no-scout")
        self.assertEqual(len(json.loads(out)["alerts"]), 4)                  # the two Springhill buildings left out
        rc, _, _ = self.run_hh("accounts", "--accounts", os.path.join(self.tmp, "missing.json"), "--hud", self.hud)
        self.assertEqual(rc, 2)

    def test_calltoday_with_accounts(self):
        rc, out, _ = self.run_hh("calltoday", "--hud", self.hud, "--date", TODAY, "--accounts", self.acc)
        self.assertEqual(rc, 0)
        doc = json.loads(out)
        self.assertEqual((doc["accounts_count"], doc["count"]), (5, 1))
        rc, out, _ = self.run_hh("calltoday", "--hud", self.hud, "--date", TODAY)   # scout businesses only
        self.assertEqual([r["kind"] for r in json.loads(out)["accounts_hit"]], ["commercial"])

    def test_daily_writes_accounts_block_and_evidence(self):
        out_dir = os.path.join(self.tmp, "out")
        rc, out, _ = self.run_hh("daily", "--out-dir", out_dir, "--date", TODAY, "--hud", self.hud,
                                 "--accounts", self.acc, "--no-basemap")
        man = json.loads(out)
        self.assertEqual(man["errors"], [])
        self.assertEqual(man["accounts"], {"checked": 9, "located": 7, "alerts": 6, "radar": False})
        with open(os.path.join(out_dir, man["files"]["calls/today"]), encoding="utf-8") as f:
            self.assertEqual(json.load(f)["accounts_count"], 5)
        self.assertIn("evidence/50-near-st-fremont", man["files"])           # the hail report the row points to
        self.assertEqual(daily.file_name("evidence/50-near-st-fremont"), "evidence__50-near-st-fremont.json")
        with open(os.path.join(out_dir, man["files"]["evidence/105-e-4th-st-fremont"]), encoding="utf-8") as f:
            self.assertEqual(json.load(f)["hail_in"], 1.65)


if __name__ == "__main__":
    unittest.main()
