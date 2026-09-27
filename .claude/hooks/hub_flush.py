#!/usr/bin/env python3
"""Turn the helper check-ins the hooks logged (T21, .claude/state/hub-queue.jsonl) into ONE AI hub batch.

  python3 .claude/hooks/hub_flush.py                        # events only; lists which robots also need an update
  python3 .claude/hooks/hub_flush.py --versions builder=13,designer=12   # + pinned agents/<id> status updates
  -> prints the `writes` array: pass it to ArtifactData action "batch" (hub url below), then:
  python3 .claude/hooks/hub_flush.py --done                 # batch committed: drop the rows it posted
  python3 .claude/hooks/hub_flush.py --discard              # no hub in this session: drop them unposted

Hub writes to existing docs must be pinned to their version (the server refuses unpinned ones), so robot status
updates need --versions (from the King's last write result or an ArtifactData list of `agents`). Events are new docs
and need none. One-off helpers never get their own robot (crew-checkin): scouts are left out (their Research Lead
posts), and the King's own one-off helpers post as events under `code` without touching the King's status.
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
SKIP = {"improvement-scout", "statusline-setup"}

ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
STATE = os.path.join(ROOT, ".claude", "state")
QUEUE = os.path.join(STATE, "hub-queue.jsonl")
PENDING = os.path.join(STATE, "hub-flush.pending")
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


def build(rows):
    find = describe(rows)
    events, latest, used = [], {}, set()
    for r in rows:
        if not r or r.get("event") not in ("start", "stop") or r.get("agent_type") in SKIP:
            continue
        hub_id, room = CREW.get(r.get("agent_type"), ("code", "board"))
        desc = find(r) or r.get("agent_type") or "a job"
        done = r["event"] == "stop"
        at = r.get("at") or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        t = datetime.strptime(at, "%Y-%m-%dT%H:%M:%SZ")
        doc_id = t.strftime("%Y%m%dT%H%M%SZ") + "-" + hub_id
        while doc_id in used:  # two check-ins in the same second
            t += timedelta(seconds=1)
            doc_id = t.strftime("%Y%m%dT%H%M%SZ") + "-" + hub_id
        used.add(doc_id)
        text = f"Finished: {desc}. {KING} is reviewing it." if done else f"Started: {desc}."
        events.append({"agent": hub_id, "at": at, "kind": "done" if done else "start", "lane": "code", "room": room,
                       "status": "done" if done else "working", "task": clip(desc, 80), "text": clip(text)} | {"_id": doc_id})
        if hub_id != "code":
            latest[hub_id] = {"status": "done" if done else "working", "room": room,
                              "doing": clip(("Done, " + KING + " reviewing: " if done else "") + desc, 200),
                              "task": clip(desc, 80), "at": at}
    return events, latest


def main(argv):
    lines, rows = read_queue()
    if "--done" in argv or "--discard" in argv:
        try:
            n = int(open(PENDING).read().strip()) if "--done" in argv else len(lines)
        except (FileNotFoundError, ValueError):
            print("Nothing pending: run hub_flush.py first.")
            return 1
        with open(QUEUE, "w") as f:
            f.writelines(lines[n:])  # rows the hooks added after the flush stay queued
        if os.path.exists(PENDING):
            os.remove(PENDING)
        print(f"Cleared {n} queued row(s); {len(lines) - n} left.")
        return 0

    versions = {}
    if "--versions" in argv:
        spec = argv[argv.index("--versions") + 1] if argv.index("--versions") + 1 < len(argv) else ""
        for part in filter(None, spec.split(",")):
            k, _, v = part.partition("=")
            versions[k.strip()] = int(v)
    events, latest = build(rows)
    if not events:  # only launches or scouts: nothing for the hub, drop what was read
        with open(QUEUE, "w") as f:
            f.writelines(read_queue()[0][len(lines):])
        print(f"No helper check-ins for the hub (cleared {len(lines)} row(s)).")
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
        f.write(str(len(lines)))
    print(f"# ArtifactData batch, url {HUB} ({len(events)} event(s)). After it commits: hub_flush.py --done")
    if missing:
        print("# Robots not updated (need --versions): " + ",".join(f"{m}=?" for m in missing))
    print(json.dumps(writes))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
