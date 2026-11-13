#!/usr/bin/env bash
# PreToolUse Edit|Write guard.
# - Committed migrations are already applied to the hosted DB; editing one desyncs schema history.
# - .env* holds SUPABASE_DB_PASSWORD; ask before touching it (.env.example is the safe template).
input=$(cat)
f=$(jq -r '.tool_input.file_path // empty' <<<"$input")
[ -z "$f" ] && exit 0
f=$(cygpath -u "$f" 2>/dev/null || echo "$f")
root=$(cygpath -u "$CLAUDE_PROJECT_DIR" 2>/dev/null || echo "$CLAUDE_PROJECT_DIR")
rel=${f#"$root"/}

decide() {
  jq -n --arg d "$1" --arg r "$2" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:$d,permissionDecisionReason:$r}}'
  exit 0
}

case "$rel" in
  supabase/migrations/*.sql)
    if git -C "$root" ls-files --error-unmatch -- "$rel" >/dev/null 2>&1; then
      decide deny "$rel is committed and already applied to the hosted DB. Don't edit it: add a new supabase/migrations/<timestamp>_<name>.sql, then update supabase/schema.sql and the row types in packages/core/src/types.ts and apps/mobile/src/lib/supabase.ts."
    fi ;;
esac

case "${rel##*/}" in
  .env.example) ;;
  .env|.env.*) decide ask "$rel holds secrets (SUPABASE_DB_PASSWORD). Confirm this edit." ;;
esac
exit 0
