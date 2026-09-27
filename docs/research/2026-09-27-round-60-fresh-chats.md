# Round 60: fresh chats per job + how the King steers other sessions

King, 2026-09-27. FilthE's idea: instead of long chats, close finished chats and open new ones per job ("so it
doesn't have to read everything at once"). Measured cost pain: one long chat = ~$97 in 2.5h; another = ~$860 over
two days; this King session was at ~350-400k tokens before this round.

## 1. The answer in 3 lines
- **Yes, fresh-session-per-job is the right move and it's already what the King's tools are built for**: `create_session` for each job, `get_session`/`list_sessions` for cheap status (not a re-read), `archive_session` when done. This matches Anthropic's own docs and is already partly live in this repo's triggers.
- **The King CANNOT reliably message an already-running session today.** `SendMessage`/`ListAgents` cloud-to-cloud is a confirmed, open Claude Code gap (needs a Remote Control link the King doesn't have) — matches the exact failure it hit.
- **Best current substitute to reach a specific session:** `create_trigger(persistent_session_id=...)` + `fire_trigger(text=...)`, but it's a one-way push (poll `get_session` for the answer), it's undocumented on the public routines page, and one open bug report says it can spawn a new blank session instead of resuming — treat as unverified until tested.

## 2. Ranked fixes

**1. Fresh session per job — `create_session` + `get_session`/`list_sessions` + `archive_session`**
- *How it works:* Each job = a brand-new cloud session with a tight handoff prompt; no shared history with the King. Check on it via status fields only, never by re-reading its transcript.
- *Steps:* King writes a self-contained prompt (repo/branch/what to do/what "done" looks like) -> `create_session` -> poll `get_session`/`list_sessions` (status_bucket, cost, needs_action) -> result lands in repo/hub db -> `archive_session` once reviewed.
- *Can the other session answer back?* No push-back channel; King pulls status by polling.
- *Cost/risk:* Cheap polling; real risk is losing savings if the King ever opens the child's full transcript to "check on it" — don't. Each new session pays full fresh-context startup cost (CLAUDE.md/skills reload), trading big re-reads for many small ones.
- *Verified:* YES — matches code.claude.com/docs/en/claude-code-on-the-web and /en/routines (read in full), and the tool's own schema.
- *Safe test:* Spin up one disposable throwaway session on a test branch with a trivial one-file task; confirm `get_session` shows completion without opening its transcript; archive it.

**2. King-to-King self-rotation (hand off before context gets big)**
- *How it works:* Old King posts a handoff to the hub db + commits repo state, then a NEW King session is created pointing only at those durable artifacts (hub board, full-context.md) — never at the old transcript, which can't be transferred anyway.
- *Steps:* flush hub-queue -> commit -> `create_session` for new King with a pointer-only prompt -> confirm new King reads the board -> re-point any bound trigger -> archive old King.
- *Can the other session answer back?* N/A — it's a rotation, not a link; continuity comes from hub db/repo, not messaging.
- *Cost/risk:* Main risk is a recurring trigger left bound to a now-archived session (CLAUDE.md already says never bind a recurring trigger to a long session, and old triggers are paused not deleted). Also: get_session's documented fields for cost/tokens are what this environment's own schema shows; not confirmed against a public API spec.
- *Verified:* Mostly YES (the "don't transfer history, re-derive from durable store" principle is confirmed in cross-session-messaging docs); the self-rotation choreography itself is inferred, not documented as a named feature.
- *Safe test:* Do this once with a throwaway "test King" pointed at a copy of the board; confirm it reconstructs context correctly before ever doing it to the real King.

**3. `create_trigger(persistent_session_id)` + `fire_trigger(text)` — push into an existing session**
- *How it works:* Bind a Routine to one specific session id; firing it appends `text` as a new user turn to THAT session (per this environment's own tool schema).
- *Steps:* `create_trigger` with `persistent_session_id` set (one-shot preferred, never recurring on a long session) -> `fire_trigger(text=...)` when needed -> poll `get_session` on that same id to see if it landed there vs. a new session appearing.
- *Can the other session answer back?* No automatic reply — still a poll via `get_session`/hub db. Also: the pushed text arrives wrapped in an untrusted `<routine-fire-payload>` block; the target session's own prompt must explicitly opt in to act on it, or it may be a silent no-op.
- *Cost/risk:* NOT confirmed against Anthropic's public routines docs (they only describe triggers that start a *new* session). One open GitHub issue (#94748) reports this mode spawning a brand-new blank session instead of resuming — could silently duplicate sessions and burn usage while looking like it worked.
- *Verified:* UNVERIFIED — real in this session's tool schema, absent from public docs, contradicted by an open bug report.
- *Safe test:* Bind a one-shot (never recurring) trigger to one disposable test session; fire it with text; check via `get_session` whether the SAME session id shows the new content (ack-2) or a second session was created. Clean up: delete trigger, archive session.

**4. `SendMessage`/`ListAgents` cross-session messaging**
- *How it works:* Peer-to-peer messaging between Claude Code sessions, two-way when it works.
- *Steps:* N/A for the King's case.
- *Can the other session answer back?* Yes, in general — but only when the calling session is itself connected to Remote Control (a local-machine feature). A bare cloud session (the King) has no such anchor.
- *Cost/risk:* None to test further — this is a confirmed, currently-open gap (GitHub issue #92540, filed 2026-09-06, still open), matching the King's exact observed failure ("No agent named ... is reachable", ListAgents showing only its own subagents).
- *Verified:* YES, confirmed broken for the King's case, via code.claude.com/docs/en/cross-session-messaging (read in full) and /en/remote-control.
- *Safe test:* Don't bother — it structurally can't work from a bare cloud session without a machine running `claude remote-control`; no test would change the answer.

## 3. What people say online
- Anthropic blog, "Using Claude Code: session management and 1M context" (2026): start a new session per genuinely new task; context rot happens even at 1M context; subagents keep tool noise out of the parent's context. https://claude.com/blog/using-claude-code-session-management-and-1m-context
- code.claude.com/docs/en/routines (2026): API-fired routines "start a new session"; "Claude Code doesn't reuse sessions across events, so two PR updates produce two independent sessions." https://code.claude.com/docs/en/routines
- code.claude.com/docs/en/cross-session-messaging (2026): cloud sessions are reachable via SendMessage only "while this session is connected to Remote Control"; a message never carries the sender's history — "to move a whole conversation or its context, resume the session instead." https://code.claude.com/docs/en/cross-session-messaging
- code.claude.com/docs/en/agent-teams (2026): ranks subagents < cross-session messaging < agent teams < manual worktrees by token cost; agent teams "use significantly more tokens than a single session." https://code.claude.com/docs/en/agent-teams
- GitHub issue #92540 (filed 2026-09-06, open): feature request — cloud sessions can't SendMessage each other yet; confirms this is a real, unresolved gap, not user error. https://github.com/anthropics/claude-code/issues/92540
- GitHub issue #94748 (2026, open/unresolved): `fire_trigger` on a `persistent_session_id` routine reportedly spawns a new blank session instead of resuming the bound one. https://github.com/anthropics/claude-code/issues/94748
- platform.claude.com routines-fire API spec (2026): "Each successful request creates a new session. There is no idempotency key" — by design the fire endpoint doesn't resume/replay into an existing transcript. https://platform.claude.com/docs/en/api/claude-code/routines-fire
- recca0120.github.io (2026-04-13): pushes back on "long session = wasted tokens" — prompt caching makes a single coherent long task cheap; the real waste is mixing unrelated jobs into one chat, not length alone. https://recca0120.github.io/en/2026/04/13/claude-code-session-cost-cache-misconception/
- Towards Data Science, "Context Rot" (2026): keep sessions short, keep CLAUDE.md tight, prefer `/compact`/`/clear` over letting a session run forever. https://towardsdatascience.com/governed-context-managing-context-rot-in-claude-code/
- Community tools (claude-squad, tmux-orchestrator, agent-mail/agentbus MCP mailboxes) exist specifically because native cross-session messaging doesn't cover cloud-to-cloud or persistent-mailbox cases — signal that "one manager steering many workers" is a real, commonly-hand-rolled need. https://github.com/smtg-ai/claude-squad

## 4. What to change in our setup
- **Confirmed today from `list_triggers`:** the current King trigger and standup/wrap/Storm-Watch routines already use `persist_session:false` (fresh session every firing) — the fresh-chat pattern is already live for those. Only 4 legacy Routines are bound to old session ids (the retired "Right Hand" King and a finished T169 check-in) — leave them paused as CLAUDE.md already says, don't delete.
- **Add to CLAUDE.md (short form):** "To push a message into a still-open session, use `create_trigger(persistent_session_id=...)` (one-shot only, never recurring) + `fire_trigger(text=...)`, then poll `get_session` to confirm it landed in that same session, not a new one — this mode is unverified against public docs and one open bug (#94748) says it can misfire. Never rely on `SendMessage`/`ListAgents` to reach another cloud session — confirmed broken without a Remote Control link (issue #92540)."
- **crew-setup.md:** add the safe-test recipe from fix #3 (one-shot trigger + fire_trigger on a disposable session, verify via get_session) as the standard way to sanity-check this path before FilthE trusts it for real jobs.
- **Hub:** no schema change needed — hub db + repo commits are already the durable handoff mechanism this whole pattern depends on (per crew-checkin); keep using it as the thing new/rotated sessions read, never a pasted transcript.
