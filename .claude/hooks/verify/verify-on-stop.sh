#!/usr/bin/env bash
# Stop hook: CLAUDE.md requires lint + typecheck + test before a task is done and there is no CI,
# so run them here. Only when app or core code changed since the last green run (stamp in .git, never committed).
input=$(cat)
# Without this guard a failing check would re-block forever.
[ "$(jq -r '.stop_hook_active // false' <<<"$input")" = "true" ] && exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0

paths=(apps/web/src apps/mobile/src packages/core/src)
# Clean = HEAD, which was already verified when committed.
[ -z "$(git status --porcelain -- "${paths[@]}")" ] && exit 0

hash=$( { git diff HEAD -- "${paths[@]}"; git ls-files -o --exclude-standard -- "${paths[@]}" | while read -r f; do echo "$f"; cat "$f"; done; } | git hash-object --stdin )
stamp="$(git rev-parse --git-dir)/claude-verify-green"
[ "$(cat "$stamp" 2>/dev/null)" = "$hash" ] && exit 0

if out=$( npm run -s check 2>&1 ); then
  echo "$hash" > "$stamp"
  exit 0
fi
jq -n --arg r "lint/typecheck/test failed. Fix these before finishing:
$(tail -n 30 <<<"$out")" '{decision:"block",reason:$r}'
