#!/usr/bin/env python3
"""Turn the helper check-ins the hooks logged (T21, .claude/state/hub-queue.jsonl) into ONE AI hub batch.

  python3 .claude/hooks/hub_flush.py                        # events only; lists which robots also need an update
  python3 .claude/hooks/hub_flush.py --versions builder=13,designer=12   # + pinned agents/<id> status updates
  -> prints the `writes` array: pass it to ArtifactData action "batch" (hub url below), then:
  python3 .claude/hooks/hub_flush.py --hold qa-tester       # keep a paused helper's rows queued (see below)
  python3 .claude/hooks/hub_flush.py --done                 # batch committed: drop the rows it posted
  python3 .claude/hooks/hub_flush.py --discard              # no hub in this session: drop them unposted

Hub writes to existing docs must be pinned to their version (the server refuses unpinned ones), so robot status
updates need --versions (from the King's last write result or an ArtifactData list of `agents`). Events are new docs
and need none. One-off helpers never get their own robot (crew-checkin): scouts are left out (their Research Lead
posts), and the King's own one-off helpers post as events under `code` without touching the King's status.
SubagentStop also fires when a helper only PAUSES to wait on its own background helpers (the King's notice then says
"stopped with background work of its own still running"): flush with `--hold <type>,...` so that stop isn't posted
as a finish; held rows stay queued for the next flush.
"""
import json
import os
import sys
from datetime import datetime, timedelta, timezone

HUB = "https://claude.ai/artifact/Qkc52bt2JL5gW7ZKWBJDHU"
KING = "SMUIPO"  # the King's name (FilthE, 2026-09-27)
# subagent_type -> (hub agent id, room); anything not listed is a King one-off helper -> ("code", "board")
CREW = {
    "builder": ("builder", "dock"),
    "designer": ("designer", "dock"),
    "hub-keeper": ("hub-keeper", "data"),
    "qa-tester": ("qa-tester", "tests"),
    "engine-mechanic": ("engine-mechanic", "engine"),
}
SKIP = {"improvement-scout", "statusline-setup", ""}  # "" = an internal agent with no type: not a crew job
NAMES = {"builder": "Builder", "designer": "Designer", "hub-keeper": "Research Lead", "qa-tester": "QA Tester",
         "engine-mechanic": "Engine Mechanic", "code": "A helper"}

ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
STATE = os.path.join(ROOT, ".claude", "state")
QUEUE = os.path.join(STATE, "hub-queue.jsonl")
PENDING = os.path.join(STATE, "hub-flush.pending")
HELD = os.path.join(STATE, "hub-held.jsonl")  # --hold rows wait here (the stop reminder only counts the queue)
OUT = os.path.join(STATE, "hub-out")


def read_queue():
    try:
        with open(QUEUE) as f:
            lines = f.readlines()
    except FileNotFoundError:
        return [], []
    rows = []
    for ln in lines:
        try:
            rows.append(json.loads(ln))
        except ValueError:
            rows.append(None)
    return lines, rows


def describe(rows):
    """agent_id -> launch description; launches without an id (sync agents) are matched by type, oldest first."""
    by_id, loose = {}, []
    for r in rows:
        if r and r.get("event") == "launch" and r.get("description"):
            if r.get("agent_id"):
                by_id[r["agent_id"]] = r["description"]
            else:
                loose.append(r)

    def find(r):
        if r.get("agent_id") in by_id:
            return by_id[r["agent_id"]]
        for i, l in enumerate(loose):
            if l.get("agent_type") == r.get("agent_type"):
                if r.get("event") == "stop":
                    loose.pop(i)
                return l["description"]
        return ""
    return find


def clip(text, n=290):
    return text if len(text) <= n else text[: n - 1].rstrip() + "…"


def build(rows, hold=()):
    find = describe(rows)
    events, latest, used, held = [], {}, set(), set()
    last_stop = {r.get("agent_id") or n: n for n, r in enumerate(rows) if r and r.get("event") == "stop"}
    for n, r in enumerate(rows):
        if r and r.get("agent_type") in hold and r.get("event") == "stop":
            held.add(n)
            continue
        if r and r.get("event") == "stop" and last_stop.get(r.get("agent_id") or n) != n:
            continue  # an earlier pause of the same helper: only its last stop is the finish
        if not r or r.get("event") not in ("start", "stop") or r.get("agent_type") in SKIP:
            continue
        hub_id, room = CREW.get(r.get("agent_type"), ("code", "board"))
        desc = find(r)
        done = r["event"] == "stop"
        who = NAMES.get(hub_id, "A helper")
        at = r.get("at") or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        t = datetime.strptime(at, "%Y-%m-%dT%H:%M:%SZ")
        doc_id = t.strftime("%Y%m%dT%H%M%SZ") + "-" + hub_id
        while doc_id in used:  # two check-ins in the same second
            t += timedelta(seconds=1)
            doc_id = t.strftime("%Y%m%dT%H%M%SZ") + "-" + hub_id
        used.add(doc_id)
        if desc:
            text = f"Finished: {desc}. {KING} is reviewing it." if done else f"Started: {desc}."
        else:  # launched before the hooks were on: no job description logged
            text = f"{who} finished; {KING} is reviewing it." if done else f"{who} started a job."
        ev = {"agent": hub_id, "at": at, "kind": "done" if done else "start", "lane": "code", "room": room,
              "status": "done" if done else "working", "text": clip(text)}
        if desc:
            ev["task"] = clip(desc, 80)
        events.append(ev | {"_id": doc_id})
        if hub_id != "code":
            upd = {"status": "done" if done else "working", "room": room, "at": at,
                   "doing": clip((f"Done, {KING} reviewing: {desc}" if desc else f"Done, {KING} reviewing the result")
                                 if done else (desc or "Working on a job"), 200)}
            if desc:
                upd["task"] = clip(desc, 80)
            latest[hub_id] = upd
    return events, latest, held


def unhold():
    """Put rows held by an earlier --hold back at the front of the queue."""
    try:
        held = open(HELD).readlines()
    except FileNotFoundError:
        return
    lines = read_queue()[0]
    with open(QUEUE, "w") as f:
        f.writelines(held + lines)
    os.remove(HELD)


def main(argv):
    if "--done" not in argv and "--discard" not in argv:
        unhold()
    lines, rows = read_queue()
    if "--done" in argv or "--discard" in argv:
        try:
            gone = set(json.load(open(PENDING))) if "--done" in argv else set(range(len(lines)))
        except (FileNotFoundError, ValueError):
            print("Nothing pending: run hub_flush.py first.")
            return 1
        with open(QUEUE, "w") as f:  # held rows and rows the hooks added after the flush stay queued
            f.writelines(ln for i, ln in enumerate(lines) if i not in gone)
        if os.path.exists(PENDING):
            os.remove(PENDING)
        print(f"Cleared {len(gone)} queued row(s); {len(lines) - len(gone)} left.")
        return 0

    versions = {}
    if "--versions" in argv:
        spec = argv[argv.index("--versions") + 1] if argv.index("--versions") + 1 < len(argv) else ""
        for part in filter(None, spec.split(",")):
            k, _, v = part.partition("=")
            versions[k.strip()] = int(v)
    hold = set()
    if "--hold" in argv and argv.index("--hold") + 1 < len(argv):
        hold = set(filter(None, argv[argv.index("--hold") + 1].split(",")))
    events, latest, held = build(rows, hold)
    # a held helper keeps its launch row too, so its description is still there at the real finish
    keep = held | {i for i, r in enumerate(rows) if r and r.get("event") == "launch" and r.get("agent_type") in hold}
    if keep:
        with open(HELD, "w") as f:
            f.writelines(ln for i, ln in enumerate(lines) if i in keep)
    if not events:  # only launches, scouts or held rows: nothing for the hub, drop what was read
        with open(QUEUE, "w") as f:
            f.writelines(read_queue()[0][len(lines):])
        print(f"No helper check-ins for the hub (cleared {len(lines) - len(keep)} row(s), holding {len(keep)}).")
        return 0
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        os.remove(os.path.join(OUT, f))
    writes = []
    for e in events:
        doc_id = e.pop("_id")
        path = os.path.join(OUT, f"events-{doc_id}.json")
        json.dump(e, open(path, "w"))
        writes.append({"op": "set", "collection": "events", "doc_id": doc_id, "file_path": path})
    missing = []
    for hub_id, data in latest.items():
        if hub_id not in versions:
            missing.append(hub_id)
            continue
        path = os.path.join(OUT, f"agents-{hub_id}.json")
        json.dump(data, open(path, "w"))
        writes.append({"op": "update", "collection": "agents", "doc_id": hub_id, "file_path": path,
                       "if_version": versions[hub_id]})
    with open(PENDING, "w") as f:
        json.dump(list(range(len(lines))), f)  # held rows already moved to HELD
    print(f"# ArtifactData batch, url {HUB} ({len(events)} event(s)). After it commits: hub_flush.py --done")
    if missing:
        print("# Robots not updated (need --versions): " + ",".join(f"{m}=?" for m in missing))
    print(json.dumps(writes))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
