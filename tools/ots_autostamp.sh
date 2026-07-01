#!/usr/bin/env bash
# Recurring OTS auto-stamp — routine witness maintenance (NO quorum, NO spend).
# Anchors any new signed chords into Bitcoin via OpenTimestamps and upgrades
# pending proofs once a block confirms them, then commits + pushes. Free,
# additive, reversible — deliberately kept OUT of the strict safety-daemon.
# Drive from cron, e.g.:  */30 * * * * /Users/s0fractal/trinity/omega/tools/ots_autostamp.sh
set -uo pipefail
ROOT="${TRINITY_ROOT:-/Users/s0fractal/trinity}"
LOG="${ROOT}/omega/ots/.autostamp.log"

cd "${ROOT}/omega" || exit 1
deno run --allow-net --allow-read --allow-write --allow-env \
  tools/ots_anchor.ts autostamp >>"${LOG}" 2>&1 || true

# Commit + push only if proofs changed (new stamps or upgrades).
if [ -n "$(git status --porcelain ots/ | grep -v '\.autostamp\.log')" ]; then
  git add ots/ ':!ots/.autostamp.log'
  git commit -q -m "ots: autostamp (routine witness maintenance)" || exit 0
  # A1: NEVER leave a dangling submodule pin. If the omega push fails (e.g. cron
  # has no git credentials), undo the local commit so omega stays == its remote,
  # and do NOT bump the trinity pin. OTS stamps are idempotent — a later run with
  # credentials redoes them. This is the root fix for the red-public/green-local CI.
  if ! git push -q origin main 2>>"${LOG}"; then
    echo "$(date -u +%FT%TZ) OTS PUSH FAILED — reverting local omega commit (no dangling pin)" >>"${LOG}"
    git reset --hard HEAD~1 >>"${LOG}" 2>&1
    exit 1
  fi
  # Bump the trinity pin ONLY now that omega is confirmed reachable on its remote.
  cd "${ROOT}" || exit 1
  git add omega
  git commit -q -m "omega bump: ots autostamp" || exit 0
  if ! git push -q origin main 2>>"${LOG}"; then
    echo "$(date -u +%FT%TZ) TRINITY PUSH FAILED — omega IS pushed (pin reachable); trinity bump stays local" >>"${LOG}"
    exit 1
  fi
fi
