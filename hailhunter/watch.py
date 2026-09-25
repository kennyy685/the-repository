"""Storm alerts for places HMP cares about (T31).

Two kinds of watched places:
  - buildings with a business contact (data/scout_contacts.json, matched into hud.json targets), and
  - a hand-kept watch list, data/watch_list.json: {"places": [{"name", "address", "lat", "lon", "note"}]}
    (jobs HMP worked on, partners' sites, past customers' buildings).
A place is "hit" when the radar+ground hail estimate at it reaches min_hail on a storm day.
"""
import json
import os
from datetime import date, timedelta

from . import mrms, nbhd


def load_watch_list(cfg):
    path = os.path.join(os.path.dirname(cfg["paths"]["db"]), "watch_list.json")
    if not os.path.exists(path):
        return []
    try:
        with open(path) as f:
            places = json.load(f).get("places", [])
    except (ValueError, OSError, AttributeError):
        return []
    out = []
    for p in places:
        try:
            out.append({"name": str(p["name"])[:80], "address": str(p.get("address", ""))[:120],
                        "lat": float(p["lat"]), "lon": float(p["lon"]), "note": str(p.get("note", ""))[:160]})
        except (KeyError, TypeError, ValueError):
            continue                                   # an entry without a usable location is skipped, not fatal
    return out


def hail_at(grid, meta, lat, lon):
    """Largest estimated hail (inches) in the 3x3 radar cells around a point, or None if outside the map."""
    H, W = grid.shape
    i = int(round((meta["lat0"] - lat) / meta["dlat"]))
    j = int(round((lon - meta["lon0"]) / meta["dlon"]))
    if not (0 <= i < H and 0 <= j < W):
        return None
    return float(grid[max(0, i - 1):i + 2, max(0, j - 1):j + 2].max())


def watch_hits(conn, cfg, places, days_back=60, min_hail=1.0, today=None):
    """[{name, address, note, day, hail}] for watched places hit in the last days_back days, newest first."""
    if not places:
        return []
    since = ((today or date.today()) - timedelta(days=days_back)).isoformat()
    days = [r[0] for r in conn.execute("SELECT conv_day FROM swaths WHERE conv_day >= ? ORDER BY conv_day DESC",
                                       (since,))]
    out = []
    for day in days:
        if mrms.load_grid(cfg, day)[0] is None:
            continue
        grid, meta, _ = nbhd.fused_grid(conn, cfg, day)
        for p in places:
            h = hail_at(grid, meta, p["lat"], p["lon"])
            if h is not None and h >= min_hail:
                out.append({"name": p["name"], "address": p["address"], "note": p["note"], "day": day,
                            "hail": round(h, 2)})
    return out


def new_hits(old_hud, new_hud, min_hail=1.0):
    """What the morning brief should call out: watched places and contacted buildings newly hit since old_hud."""
    seen_w = {(w["name"], w["day"]) for w in old_hud.get("watch_hits", [])}
    watch = [w for w in new_hud.get("watch_hits", []) if (w["name"], w["day"]) not in seen_w]
    seen_t = {(t["key"], t["day"]) for t in old_hud.get("targets", [])}
    contacts = [{"name": (t.get("contact") or {}).get("name") or t["address"], "address": t["address"], "city": t["city"],
                 "day": t["day"], "hail": t["hail"], "phone": (t.get("contact") or {}).get("phone", ""),
                 "ask_for": (t.get("contact") or {}).get("ask_for", "")}
                for t in new_hud.get("targets", [])
                if t.get("contact") and t["hail"] >= min_hail and (t["key"], t["day"]) not in seen_t]
    return {"watch": watch, "contacts": contacts}
