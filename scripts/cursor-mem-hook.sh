#!/usr/bin/env bash
# Fail-open trampoline: Cursor Agent → isolated cursor-mem worker.
# Always prints {"continue":true} and exits 0 so a missing bun/worker never blocks the agent.
set +e

EVENT="$1"
if [ -z "$EVENT" ]; then
  printf '%s\n' '{"continue":true}'
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME="$REPO_ROOT/scripts/cursor-mem-runtime.ts"

find_bun() {
  if command -v bun >/dev/null 2>&1; then
    command -v bun
    return 0
  fi
  for candidate in "$HOME/.bun/bin/bun" /usr/local/bin/bun /opt/homebrew/bin/bun; do
    if [ -x "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

BUN="$(find_bun)"
if [ -z "$BUN" ] || [ ! -f "$RUNTIME" ]; then
  printf '%s\n' '{"continue":true}'
  exit 0
fi

TMP_OUT="$(mktemp -t cursor-mem-hook.XXXXXX)"
"$BUN" "$RUNTIME" hook "$EVENT" >"$TMP_OUT"
if grep -q '"continue"' "$TMP_OUT" 2>/dev/null; then
  cat "$TMP_OUT"
else
  printf '%s\n' '{"continue":true}'
fi
rm -f "$TMP_OUT"
exit 0
