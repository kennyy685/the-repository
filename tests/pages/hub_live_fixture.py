#!/usr/bin/env python3
"""Build tests/fixtures/hub_live.json for hub_live_check.js from a real AI hub db export, with every word scrubbed.

The smoke test needs the hub's REAL data shapes (how many docs, which fields, how long the texts are, line breaks,
numbered lists, odd values) but the repo must not carry the crew's real messages. So: keys, timestamps, enums, numbers
and structure stay; every free text becomes filler of the same length (line breaks and "1." list starts kept); session
and trigger ids become fake ids of the same format.

  ArtifactData list/query each collection with out_dir=<dir>   (agents, answers, board, crew, events, system, wakes)
  python3 tests/pages/hub_live_fixture.py <dir> [events_to_keep=160]
"""
import glob
import hashlib
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "tests", "fixtures", "hub_live.json")
WORDS = "robot hub board check build test page chat king answer storm roof door map zone walk fix ship note plan".split()
ISO = re.compile(r"^\d{4}-\d\d-\d\dT[\d:.]+Z$")
KEEP = re.compile(r"^([A-Za-z][A-Za-z0-9_-]{0,23}( \([A-Za-z]+\))?|T\d{1,4}|D\d{1,3}|W\d{1,3}|env_[A-Za-z0-9]+)$")   # enums, ids, one-word names


def filler(s, seed):
    h = int(hashlib.sha1(seed.encode()).hexdigest(), 16)
    out = []
    for line in s.split("\n"):
        m = re.match(r"^(\s*(?:\d{1,2}[.)]|[-*])\s+)", line)
        pre = m.group(1) if m else ""
        n, words = max(0, len(line) - len(pre)), []
        while sum(len(w) + 1 for w in words) < n:
            words.append(WORDS[h % len(WORDS)])
            h = h // 7 + 13
        out.append((pre + " ".join(words))[: len(line)] if line.strip() else line)
    return "\n".join(out)


def fake_id(s):
    for pre in ("session_", "trig_"):
        if s.startswith(pre):
            return pre + "TEST" + hashlib.sha1(s.encode()).hexdigest()[: max(4, len(s) - len(pre) - 4)]
    return None


def scrub(v, key=""):
    if isinstance(v, dict):
        return {k: scrub(x, k) for k, x in v.items()}
    if isinstance(v, list):
        return [scrub(x, key) for x in v]
    if not isinstance(v, str) or ISO.match(v) or KEEP.match(v) or v == "":
        return v
    f = fake_id(v)
    if f:
        return f
    if re.match(r"^\d{8}T\d{6}Z-[a-z0-9-]+$", v):   # an event id (re:) stays: the thread links by it
        return v
    return filler(v, key + v)


def main():
    src, keep = sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 160
    docs = {}
    for f in glob.glob(os.path.join(src, "**", "*.json"), recursive=True):
        docs[os.path.relpath(f, src)[:-5]] = json.load(open(f))
    docs.pop("system/prices", None)   # the hub never reads it
    ev = sorted((k for k in docs if k.startswith("events/")), key=lambda k: docs[k].get("at", ""), reverse=True)
    for k in ev[keep:]:
        docs.pop(k)
    out = {"_comment": "hub_live_check.js fixture: the real AI hub db shapes (read 2026-09-29, the day it froze live), every "
           "word scrubbed by tests/pages/hub_live_fixture.py (keys, times, enums and lengths kept).",
           "docs": {k: scrub(v) for k, v in sorted(docs.items())}}
    with open(OUT, "w") as fh:
        json.dump(out, fh, indent=0, sort_keys=True, ensure_ascii=False)
    print(OUT, len(docs), "docs")


if __name__ == "__main__":
    main()
