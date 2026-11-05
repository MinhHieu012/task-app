---
name: ship
description: Commit, push and open a GitHub PR for the current task-app changes, after lint/typecheck/test pass. Use only when the user asks to ship — e.g. "commit và push", "tạo pr", "push lên", "commit push tạo pr", "ship", "/ship".
argument-hint: "[short description of the change]"
---

# Ship: verify → branch → commit → push → PR

The user asked for this, so run it end to end without re-asking. Reply in Vietnamese; commit messages and PR text stay in English (matches git history).

1. **Look first.** `git status --short` and `git diff HEAD --stat`. Nothing to commit and no unpushed commits → say so and stop.
   Never stage `.idea/`, `supabase/.temp/`, `.env*`, or `.claude/settings.local.json` — editor/CLI noise and secrets.

2. **Verify.** `npm run lint && npm run typecheck && npm test` (CLAUDE.md's definition of done; there is no CI to catch it later).
   On failure: fix it if the cause is in this change, otherwise stop and report the error. Never push red.

3. **Branch.** On `main` → `git checkout -b <type>/<kebab-slug>` (types: `feat`, `fix`, `chore`, `docs`, `refactor`; see past branches like `feat/task-app-daily-journal`, `docs/claude-md`). On another branch → stay on it.

4. **Commit.** Stage explicit paths (`git add <paths>`, not `-A`). Message: `type(scope): imperative summary` (scope like `journal`, `tasks`, `ui`, `db`, `claude`), body says *why*. No Co-Authored-By/attribution lines — the user disabled them. Unrelated changes → separate commits.

5. **Push.** `git push -u origin HEAD`.

6. **PR.** `gh pr view --json url -q .url` — if one exists for the branch, the push already updated it; report its URL. Otherwise:
   `gh pr create --base main --title "<commit summary>" --body` with `## Summary` (bullets) and `## Test plan` (checkboxes: what was run, plus manual checks still pending).

7. **Report** the PR URL and branch. If the diff adds `supabase/migrations/*.sql`, remind the user the hosted DB is not updated: they run `! npm run db:push -- --yes` themselves (Claude must not).
