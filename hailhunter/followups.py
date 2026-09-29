"""Follow-up schedule for Interested and booked leads (`hh.py followups`, research round 9 #2).

Most sales need several touches and most new reps stop after one or two, so every lead that said Interested gets
planned touches at 2, 5 and 10 days after the FIRST Interested (config `followups.touch_days`), and every open lead's
`next_step` counts too. One line per lead: whichever is due first (its next step or its next touch), grouped
Today (due today or late) / Tomorrow / Later, each with a short reason in English and Spanish.

Input: the HMP App's `leads/<slug>` docs (weekly.load_leads shapes: dict {"leads/<id>": doc} or a list of docs)
{address, city, source, type, stage, next_step{en, es, due}, doors_visits[{date, result, at}], last_contact,
interested_at?, created_at}.
- First Interested day = the earliest of `interested_at` and the doors_visits tapped interested/booked; with none,
  `created_at` when the stage is contacted/inspection_set (the stages the app sets on those taps).
- Touches apply while the stage is in `touch_stages` (not_contacted, contacted = Interested, inspection_set =
  booked). A booked lead only gets touches due before its appointment (next_step.due), none once that day comes. Closed leads (done/lost) are skipped.
- A touch counts as done when there was a contact (last_contact, or any door visit that wasn't "not home") on or
  after its due day minus `early_ok_days` (1), and after the first Interested day. Late touches collapse into the
  latest one due, so a lead never shows more than one touch.

Output: {as_of, today[], tomorrow[], later[], counts{today, tomorrow, later, overdue}, summary{en, es}}; each item
{id, address, city, stage, kind: touch|next_step, touch (1-3 or null), due, overdue, days_late, reason{en, es}}.
docs/app/followups.js is the JavaScript copy (same math and words; `export_rules` gives it the rules + test cases).
Logistics only: no insurance promises, nothing about the deductible (44-8604). Calls only when the homeowner gave
HMP the number (no cold calls or texts).
"""
import re
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from .config import DEFAULTS

RULES_VERSION = 1
_CHICAGO = ZoneInfo("America/Chicago")   # HMP is in Fremont, NE (Central time); handles DST
MON_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
MON_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
YES = ("interested", "booked")
NOT_HOME = ("not_home", "nothome", "not home", "not-home", "no_home", "no esta", "no está")


def _rules(cfg=None):
    return {**DEFAULTS["followups"], **((cfg or {}).get("followups") or {})}


def _day(v):
    """Plain "YYYY-MM-DD" stays as-is. A full timestamp ("...T21:00:00Z") converts to its America/Chicago
    LOCAL calendar date (handles DST), so a contact after ~7 PM Central doesn't roll to the next day just
    because it's already tomorrow in UTC. Anything unparseable falls back to the first 10 characters, then None."""
    s = str(v or "")
    s10 = s[:10]
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", s10):
        return None
    if len(s) <= 10 or not re.match(r"^[T ]", s[10:]):
        try:
            return date.fromisoformat(s10).isoformat()
        except ValueError:
            return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        try:
            return date.fromisoformat(s10).isoformat()
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)   # timestamps in this app are stored in UTC
    return dt.astimezone(_CHICAGO).date().isoformat()


def _add(d, n):
    return (date.fromisoformat(d) + timedelta(days=n)).isoformat()


def _diff(a, b):
    """Days from b to a."""
    return (date.fromisoformat(a) - date.fromisoformat(b)).days


def _en(d):
    x = date.fromisoformat(d)
    return f"{MON_EN[x.month - 1]} {x.day}"


def _es(d):
    x = date.fromisoformat(d)
    return f"{x.day} de {MON_ES[x.month - 1]}"


def _days_en(n):
    return f"{n} day" + ("" if n == 1 else "s")


def _days_es(n):
    return f"{n} día" + ("" if n == 1 else "s")


def first_interested(lead, rules):
    days = [_day(lead.get("interested_at"))]
    for v in lead.get("doors_visits") or []:
        if isinstance(v, dict) and str(v.get("result") or "").strip().lower() in YES:
            days.append(_day(v.get("date")) or _day(v.get("at")))
    days = sorted(d for d in days if d)
    if days:
        return days[0]
    if lead.get("stage") in rules["created_stages"]:
        return _day(lead.get("created_at"))
    return None


def contacts(lead):
    out = [_day(lead.get("last_contact"))]
    for v in lead.get("doors_visits") or []:
        if isinstance(v, dict) and v.get("result") and str(v.get("result")).strip().lower() not in NOT_HOME:
            out.append(_day(v.get("date")) or _day(v.get("at")))
    return [d for d in out if d]


def _touch(lead, start, today, rules, stop_at):
    """(k, due) of the touch to show, or None."""
    seen = contacts(lead)
    pending = []
    for k, n in enumerate(rules["touch_days"], 1):
        due = _add(start, n)
        if stop_at and due >= stop_at:
            break
        if any(c > start and c >= _add(due, -rules["early_ok_days"]) for c in seen):
            continue
        pending.append((k, due))
    late = [p for p in pending if p[1] <= today]
    if late:
        return late[-1]
    return pending[0] if pending else None


def _late(days_late, en, es):
    """Late items start with how late they are."""
    if days_late <= 0:
        return en, es
    return f"{_days_en(days_late)} late. {en}", f"{_days_es(days_late)} de atraso. {es}"


def _touch_reason(lead, k, due, start, today, rules):
    n, last = rules["touch_days"][k - 1], k == len(rules["touch_days"])
    ago = _diff(today, start)
    ago_en = "today" if ago == 0 else f"{_days_en(ago)} ago"
    ago_es = "hoy" if ago == 0 else f"hace {_days_es(ago)}"
    if lead.get("stage") in rules["booked_stages"]:
        en = f"Booked on {_en(start)} ({ago_en}). {n}-day check-in: make sure the visit is still on."
        es = f"Agendado el {_es(start)} ({ago_es}). Seguimiento de {n} días: confirma que la cita sigue en pie."
    else:
        cash = lead.get("type") == "cash" or lead.get("source") == "everyday"
        en = (f"Interested on {_en(start)} ({ago_en}). {n}-day follow-up: stop by, or call if they gave you their "
              f"number, to set a time for {'an estimate' if cash else 'a roof check'}.")
        es = (f"Interesado el {_es(start)} ({ago_es}). Seguimiento de {n} días: pasa, o llama si te dio su número, "
              f"para agendar {'un estimado' if cash else 'una revisión del techo'}.")
    if last:
        en += " Last planned touch: if it's still not a yes, mark the lead Lost."
        es += " Último seguimiento planeado: si todavía no es un sí, marca el cliente como Perdido."
    return _late(_diff(today, due), en, es)


def _step_reason(ns, due, today):
    en = str(ns.get("en") or "Next step").strip()
    es = str(ns.get("es") or ns.get("en") or "Siguiente paso").strip()
    late = _diff(today, due)
    if late > 0:
        return f"{en} (due {_en(due)}, {_days_en(late)} late)", f"{es} (vencía el {_es(due)}, {_days_es(late)} de atraso)"
    return f"{en} (due {_en(due)})", f"{es} (vence el {_es(due)})"


def followups(leads, today, cfg=None, rules=None):
    """The follow-up schedule doc (see the module doc). `leads` = weekly.load_leads() rows; `today` YYYY-MM-DD."""
    rules = rules or _rules(cfg)
    today = today.isoformat() if isinstance(today, date) else _day(today)
    if not today:
        raise ValueError("followups: today must be YYYY-MM-DD")
    tomorrow = _add(today, 1)
    groups = {"today": [], "tomorrow": [], "later": []}
    for L in leads or []:
        if not isinstance(L, dict) or L.get("stage") in rules["closed"]:
            continue
        ns = L.get("next_step") if isinstance(L.get("next_step"), dict) else {}
        step_due = _day(ns.get("due"))
        cand = []
        if step_due:
            cand.append(("next_step", None, step_due))
        start = first_interested(L, rules) if L.get("stage") in rules["touch_stages"] or not L.get("stage") else None
        if start:
            stop_at = step_due if L.get("stage") in rules["booked_stages"] else None
            t = None if stop_at and stop_at <= today else _touch(L, start, today, rules, stop_at)
            if t:
                cand.append(("touch", t[0], t[1]))
        if not cand:
            continue
        kind, k, due = min(cand, key=lambda c: (c[2], 0 if c[0] == "next_step" else 1))
        en, es = _touch_reason(L, k, due, start, today, rules) if kind == "touch" else _step_reason(ns, due, today)
        late = max(_diff(today, due), 0)
        item = {"id": L.get("id") or "", "address": L.get("address") or L.get("id") or "", "city": L.get("city") or "",
                "stage": L.get("stage"), "kind": kind, "touch": k, "due": due, "overdue": late > 0,
                "days_late": late, "reason": {"en": en, "es": es}}
        groups["today" if due <= today else ("tomorrow" if due == tomorrow else "later")].append(item)
    for g in groups.values():
        g.sort(key=lambda r: (r["due"], r["address"], r["id"]))
    over = sum(r["overdue"] for r in groups["today"])
    nt, nm = len(groups["today"]), len(groups["tomorrow"])
    en = f"{nt} follow-up{'' if nt == 1 else 's'} today" + (f" ({over} late)" if over else "") + f", {nm} tomorrow."
    es = f"{nt} seguimiento{'' if nt == 1 else 's'} hoy" + (f" ({over} atrasado{'' if over == 1 else 's'})"
                                                           if over else "") + f", {nm} mañana."
    return {"as_of": today, **groups,
            "counts": {"today": nt, "tomorrow": nm, "later": len(groups["later"]), "overdue": over},
            "summary": {"en": en, "es": es}}


# ------------------------------------------------------------------ the HMP App's copy (docs/app/followups.js)
RULE_TEST_CASES = [
    ("interested_48h_due_today", "2026-09-26", [
        {"id": "a", "address": "105 E 4th St", "city": "Fremont", "stage": "contacted", "type": "insurance",
         "doors_visits": [{"date": "2026-09-24", "result": "interested"}]}]),
    ("interested_5d_late_collapses", "2026-10-01", [
        {"id": "b", "address": "300 Pine St", "city": "Fremont", "stage": "contacted", "type": "cash",
         "source": "everyday", "doors_visits": [{"date": "2026-09-24", "result": "interested", "at": "x"}]}]),
    ("touch_done_by_contact", "2026-09-27", [
        {"id": "c", "address": "12 Oak St", "stage": "contacted", "last_contact": "2026-09-26T15:00:00Z",
         "doors_visits": [{"date": "2026-09-24", "result": "interested"}]}]),
    ("last_touch_and_tomorrow", "2026-10-03", [
        {"id": "d", "address": "9 Elm St", "stage": "contacted", "last_contact": "2026-09-29",
         "doors_visits": [{"date": "2026-09-24", "result": "interested"}]},
        {"id": "e", "address": "7 Elm St", "stage": "contacted", "interested_at": "2026-10-02T20:00:00Z"}]),
    ("next_step_overdue_and_later", "2026-09-28", [
        {"id": "f", "address": "400 Pine St", "stage": "claim_filed",
         "next_step": {"en": "Call the adjuster's office", "es": "Llamar a la oficina del ajustador", "due": "2026-09-25"}},
        {"id": "g", "address": "401 Pine St", "stage": "approved", "next_step": {"en": "Order siding", "due": "2026-10-09"}},
        {"id": "h", "address": "402 Pine St", "stage": "done", "next_step": {"en": "x", "due": "2026-09-01"}},
        {"id": "i", "address": "403 Pine St", "stage": "lost", "doors_visits": [{"date": "2026-09-24", "result": "interested"}]}]),
    ("booked_touch_stops_at_visit", "2026-09-26", [
        {"id": "j", "address": "105 E 4th St", "stage": "inspection_set",
         "next_step": {"en": "Inspection Tue Sep 29, 4 PM", "es": "Inspección mar 29 sep, 4 PM", "due": "2026-09-29"},
         "doors_visits": [{"date": "2026-09-24", "result": "booked"}]},
        {"id": "k", "address": "106 E 4th St", "stage": "inspection_set",
         "next_step": {"en": "Inspection", "due": "2026-09-25"},
         "doors_visits": [{"date": "2026-09-24", "result": "booked"}]}]),
    ("created_fallback_and_bad_dates", "2026-09-27", [
        {"id": "l", "address": "1 A St", "stage": "contacted", "created_at": "2026-09-25T22:00:00Z"},
        {"id": "m", "address": "2 A St", "stage": "contacted", "created_at": "garbage",
         "next_step": {"en": "Call back", "due": "2026-02-30"}},
        {"id": "n", "address": "3 A St", "doors_visits": [{"date": "2026-09-20", "result": "not_home"},
                                                          {"at": "2026-09-21T10:00:00Z", "result": "Interested"}]}]),
    ("evening_contact_local_day", "2026-09-28", [    # 7:01 PM Central tap must anchor to that LOCAL day, not UTC's
        {"id": "o", "address": "500 Pine St", "stage": "contacted",
         "doors_visits": [{"at": "2026-09-27T00:01:00Z", "result": "interested"}]}]),
    ("dst_fallback_local_day", "2026-11-01", [        # Nov 1 2026 DST fallback: still CDT (-5) just before 2 AM local
        {"id": "p", "address": "600 Pine St", "stage": "contacted",
         "doors_visits": [{"at": "2026-11-01T05:30:00Z", "result": "interested"}]}]),
]


def export_rules(cfg=None):
    """The HMP App's rules doc for docs/app/followups.js: the rules + real followups() results to self-check."""
    rules = _rules(cfg)
    cases = [{"name": n, "today": t, "leads": ls, "result": followups(ls, t, rules=rules)}
             for n, t, ls in RULE_TEST_CASES]
    return {"version": RULES_VERSION, **rules, "test_cases": cases}
