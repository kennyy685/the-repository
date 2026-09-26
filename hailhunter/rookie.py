"""Rookie plan progress (`hh.py rookie`, and the `rookie` section of `hh.py weekly`): where FilthE is in his first
60 days of knocking, from data/rookie_plan.json (the Research Lead's day-by-day plan) and the HMP App's door taps.

Plan file: a list of blocks {day_range "9-16", focus_en, focus_es, daily_goal, door_target, drill_ids[]}
(or {"blocks": [...]}). door_target = doors a day that make the day "hit"; when a block lacks it, the first number
after "Knock" in daily_goal is used ("Knock 20-25 doors" -> 20; "full route" -> rookie.full_route_doors), else 0.
A block with door_target 0 is a practice block: its days neither extend nor break the streak.

Start date: config `rookie.start_date`, else the first day with any door tap, else unset (-> not ready).
Output (the app's `stats/rookie` doc): {ready, as_of, start_date, start_source, day, plan_days, plan_done, block{...},
today_doors, block_doors, block_expected, block_days_hit, block_days_counted, streak{days, best}, status
(practice|on_pace|behind|ahead|not_started), verdict{en, es}}. Verdict wording never shames: behind = "a bit
behind" + how to catch up. Missing plan or no start -> None (weekly: `rookie` null; `hh.py rookie`: ready false).
"""
import json
import os
import re
from collections import Counter
from datetime import date, timedelta

from .config import DEFAULTS


def _cfg(cfg):
    return {**DEFAULTS["rookie"], **((cfg or {}).get("rookie") or {})}


def default_path(cfg=None):
    return ((cfg or {}).get("paths") or {}).get("rookie_plan") or os.path.join("data", "rookie_plan.json")


def load_plan(path=None, cfg=None):
    """The plan's blocks, or None when the file is missing, broken or empty (never raises)."""
    try:
        with open(path or default_path(cfg), encoding="utf-8") as f:
            doc = json.load(f)
    except (OSError, ValueError):
        return None
    blocks = doc.get("blocks") if isinstance(doc, dict) else doc
    if not isinstance(blocks, list):
        return None
    return [b for b in blocks if isinstance(b, dict)] or None


def _range(b):
    m = re.match(r"^\s*(\d+)\s*(?:-\s*(\d+))?\s*$", str(b.get("day_range") or ""))
    if not m:
        return None
    lo = int(m.group(1))
    return lo, int(m.group(2) or lo)


def door_target(block, cfg=None):
    """Doors a day for this block: explicit `door_target`, else parsed from daily_goal, else 0 (practice)."""
    v = block.get("door_target")
    if isinstance(v, (int, float)) and not isinstance(v, bool) and v >= 0:
        return int(v)
    goal = str(block.get("daily_goal") or "")
    m = re.search(r"\bknock\s+(\d+)", goal, re.I)
    if m:
        return int(m.group(1))
    if re.search(r"\bknock\b.*\bfull route\b", goal, re.I):
        return int(_cfg(cfg)["full_route_doors"])
    return 0


def _blocks(plan, cfg):
    out = []
    for b in plan or []:
        r = _range(b)
        if r:
            out.append({"from_day": r[0], "to_day": r[1], "target": door_target(b, cfg), "src": b})
    return sorted(out, key=lambda x: x["from_day"])


def _block_for(blocks, day):
    for b in blocks:
        if b["from_day"] <= day <= b["to_day"]:
            return b
    return blocks[-1] if day > blocks[-1]["to_day"] else blocks[0]


def start_date(doors, cfg=None):
    """(date, source): config rookie.start_date, else the first door-tap day, else (None, None)."""
    s = _cfg(cfg).get("start_date")
    if s:
        try:
            return date.fromisoformat(str(s)[:10]), "config"
        except ValueError:
            pass
    days = sorted(d["date"] for d in doors or [] if d.get("date"))
    return (date.fromisoformat(days[0]), "first_door") if days else (None, None)


def _pl(n, one, many):
    return f"{n} {one if n == 1 else many}"


def progress(doors, plan, as_of, cfg=None):
    """The rookie doc (see module doc). `doors` = weekly.load_doors rows; `plan` = load_plan(); `as_of` = date/str."""
    blocks = _blocks(plan, cfg)
    if not blocks:
        return None
    as_of = date.fromisoformat(as_of) if isinstance(as_of, str) else as_of
    start, source = start_date(doors, cfg)
    if start is None:
        return None
    rc = _cfg(cfg)
    per_day = Counter(d["date"] for d in doors or [] if d.get("date"))
    count = lambda d: per_day.get(d.isoformat(), 0)  # noqa: E731
    day_no = (as_of - start).days + 1
    plan_days = max(b["to_day"] for b in blocks)
    base = {"ready": True, "as_of": as_of.isoformat(), "start_date": start.isoformat(), "start_source": source,
            "day": day_no, "plan_days": plan_days, "plan_done": day_no > plan_days}
    if day_no < 1:
        return {**base, "block": None, "today_doors": count(as_of), "block_doors": 0, "block_expected": 0,
                "block_days_hit": 0, "block_days_counted": 0, "streak": {"days": 0, "best": 0},
                "status": "not_started",
                "verdict": {"en": f"Your plan starts {start.isoformat()}.",
                            "es": f"Tu plan empieza el {start.isoformat()}."}}

    def target_on(d):
        n = (d - start).days + 1
        return _block_for(blocks, n)["target"] if n >= 1 else 0

    def hit(d):
        return count(d) >= target_on(d)

    # streak: consecutive hit days back from today (today counts once hit; an unfinished today doesn't break it);
    # practice days (target 0) are skipped, neither extending nor breaking it. best = longest run so far.
    streak, best, run, broken = 0, 0, 0, False
    d = as_of
    while d >= start:
        t = target_on(d)
        if t > 0:
            if hit(d):
                if not broken:
                    streak += 1
            elif d != as_of:
                broken = True
        d -= timedelta(days=1)
    d = start
    while d <= as_of:
        t = target_on(d)
        if t > 0:
            if hit(d):
                run += 1
                best = max(best, run)
            elif d != as_of:
                run = 0
        d += timedelta(days=1)

    b = _block_for(blocks, day_no)
    t = b["target"]
    b_start = start + timedelta(days=b["from_day"] - 1)
    days = [b_start + timedelta(days=i) for i in range((as_of - b_start).days + 1)]
    block_doors = sum(count(x) for x in days)
    counted = [x for x in days if x != as_of or hit(x)]   # today counts once its goal is met
    expected = t * len(counted)
    days_hit = sum(1 for x in counted if hit(x)) if t > 0 else 0
    src = b["src"]
    block = {"day_range": src.get("day_range"), "from_day": b["from_day"], "to_day": b["to_day"],
             "focus_en": src.get("focus_en"), "focus_es": src.get("focus_es"), "daily_goal": src.get("daily_goal"),
             "door_target": t, "drill_ids": list(src.get("drill_ids") or [])}
    dl = f"Day {day_no}" + (" (past the 60-day plan)" if base["plan_done"] else "")
    dl_es = f"Día {day_no}" + (" (ya pasaste el plan de 60 días)" if base["plan_done"] else "")
    band = float(rc["pace_band"])
    if t == 0:
        status = "practice"
        en = f"{dl}: practice block, no door goal yet. Focus on the drills."
        es = f"{dl_es}: etapa de práctica, todavía sin meta de puertas. Enfócate en los ejercicios."
    elif not counted:
        status = "on_pace"
        en = f"{dl}: new block today, goal {t} doors a day. You've got this."
        es = f"{dl_es}: etapa nueva hoy, meta de {t} puertas al día. Tú puedes."
    elif block_doors < expected * (1 - band):
        status = "behind"
        short = expected - block_doors
        en = (f"{dl}: a bit behind the {t}-a-day goal ({block_doors} of {expected} doors this block). "
              f"{_pl(short, 'more door', 'more doors')} catches you up; one good day does it.")
        es = (f"{dl_es}: un poco atrás de la meta de {t} al día ({block_doors} de {expected} puertas en esta etapa). "
              f"{_pl(short, 'puerta más', 'puertas más')} y te pones al día; un buen día basta.")
    elif block_doors > expected * (1 + band):
        status = "ahead"
        en = f"{dl}: ahead of pace, {block_doors} doors vs {expected} planned this block. Nice work."
        es = f"{dl_es}: vas adelantado, {block_doors} puertas contra {expected} planeadas en esta etapa. Buen trabajo."
    else:
        status = "on_pace"
        en = f"{dl}: on pace, {block_doors} doors vs {expected} planned this block. Keep it steady."
        es = f"{dl_es}: vas al ritmo, {block_doors} puertas contra {expected} planeadas en esta etapa. Sigue así."
    if streak and t > 0:
        en += f" Streak: {_pl(streak, 'day', 'days')} on goal."
        es += f" Racha: {_pl(streak, 'día', 'días')} cumpliendo la meta."
    return {**base, "block": block, "today_doors": count(as_of), "block_doors": block_doors,
            "block_expected": expected, "block_days_hit": days_hit, "block_days_counted": len(counted) if t else 0,
            "streak": {"days": streak, "best": best}, "status": status, "verdict": {"en": en, "es": es}}


def not_ready(as_of, plan_found):
    """`hh.py rookie` doc when there is no plan file or no start date yet."""
    as_of = as_of.isoformat() if isinstance(as_of, date) else str(as_of)
    if not plan_found:
        en, es = "No rookie plan file yet.", "Todavía no hay plan de novato."
    else:
        en, es = ("Your plan starts with your first door tap.",
                  "Tu plan empieza con la primera puerta que registres.")
    return {"ready": False, "as_of": as_of, "verdict": {"en": en, "es": es}}
