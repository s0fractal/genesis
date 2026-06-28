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
  git push -q origin main || true
  cd "${ROOT}" || exit 1
  git add omega
  git commit -q -m "omega bump: ots autostamp" || exit 0
  git push -q origin main || true
fi
