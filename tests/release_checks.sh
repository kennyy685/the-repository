#!/usr/bin/env bash
# Release checklist step 2 in one command (docs/release-checklist.md): every automatic check, one PASS/FAIL table.
#   tests/release_checks.sh            all checks (legal, module checks, engine selftest, page shots, practice + fake day + 24 h + hub, app + Practice Door live + real E2E day + bad signal, design gate)
#   tests/release_checks.sh --quick    same, but the design gate runs --quick (360 px, EN) while building
#   tests/release_checks.sh --fast     skip the two browser checks (seconds instead of minutes)
# Exit 0 = everything passed. Logs: tests/pages/out/release_checks/<check>.log
set -u
cd "$(dirname "$0")/.." || exit 2
export NODE_PATH="${NODE_PATH:-/opt/node22/lib/node_modules}"
mode="${1:-}"
logdir=tests/pages/out/release_checks
mkdir -p "$logdir"
names=() results=() secs=() fail=0

run() {  # run <name> <command...>
  local name=$1; shift
  local t0=$SECONDS
  if "$@" >"$logdir/$name.log" 2>&1; then results+=(PASS); else results+=(FAIL); fail=1; fi
  names+=("$name"); secs+=($((SECONDS - t0)))
}

run legal_check python3 tests/legal_check.py
for f in tests/js/*_check.js; do run "$(basename "$f" .js)" node "$f"; done
run hh_selftest python3 hh.py selftest
if [ "$mode" != "--fast" ]; then
  run shots node tests/pages/shots.js
  run practice_check node tests/pages/practice_check.js   # T201 Practice mode saves nothing; T205 step label on one line
  run fullday_check node tests/pages/fullday_check.js   # full fake sales day in Practice (1470 + 390 px): hard stops, zero db writes
  run day24_check node tests/pages/day24_check.js   # 24 h on a fake clock: King docs while open, 12:52 refresh mid-tap, overnight, midnight Central
  run hub_live_check node tests/pages/hub_live_check.js   # AI hub on the real db shapes + a runtime that fails or hangs (2026-09-29 freeze)
  run hub_chat_check node tests/pages/hub_chat_check.js   # hub King chat: instant answer, order wake, delivery states, Fresh King (success + real error shown)
  run app_live_check node tests/pages/app_live_check.js   # HMP App + Practice Door on a realistic db + a runtime that fails or hangs (every button, every freeze)
  run e2e_day_check node tests/pages/e2e_day_check.js   # one full REAL working day (EN, ES, slow signal): map -> knock -> lead -> inspection -> claim -> price -> paper -> follow-ups -> day numbers, reload mid-flow
  run badsignal_check node tests/pages/badsignal_check.js   # T163 bad signal: offline / flaky burst / drop mid-save / reload; the outbox always drains by itself
  run desk_check node tests/pages/desk_check.js   # v26 desk layout: map beside the plan, Knock in 3 columns, detail pane, toast off legal text (1280-1512 + 390, light + dark, EN + ES)
  run open_map_night_check node tests/pages/open_map_night_check.js   # night shift: the open map reads the REAL brief; SAMPLE only on samples
  if [ "$mode" = "--quick" ]; then run design_gate node tests/pages/design_gate.js --quick
  else run design_gate node tests/pages/design_gate.js; fi
fi

printf '\n%-28s %-5s %s\n' CHECK RESULT SECONDS
for i in "${!names[@]}"; do printf '%-28s %-5s %s\n' "${names[$i]}" "${results[$i]}" "${secs[$i]}"; done
[ "$mode" = "--fast" ] && echo "(--fast: shots.js and design_gate.js skipped; not a release pass)"
if [ $fail -ne 0 ]; then
  echo; echo "FAILED. Last lines of each failing log:"
  for i in "${!names[@]}"; do
    [ "${results[$i]}" = FAIL ] && { echo "--- ${names[$i]} ($logdir/${names[$i]}.log)"; tail -n 8 "$logdir/${names[$i]}.log"; }
  done
fi
exit $fail
