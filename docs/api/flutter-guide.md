# Preparing a Flutter mobile app

Not implemented; this is what a Flutter app needs to work against the same backend without backend changes.

## Client

- Use `supabase_flutter`: it covers PostgREST, RPC, Auth (PKCE, deep links) and Realtime, as `supabase-js` does for the current apps.
- Config: the project URL and the publishable (anon) key only. Never the DB password or a service-role key.
- Deep link scheme: `taskapp://` is already in Supabase's Redirect URLs; a Flutter app can reuse it (only one app per device should own it) or add its own scheme to the Redirect URLs.

## Contracts to follow

- Tables, RPCs, constraints, auth flows, error format, date rules: [contracts.md](contracts.md).
- Row models: mirror `packages/core/src/types.ts` (generate Dart models from the database with `supabase gen types` or by hand).
- Write `completed_day`, `due_date` and the report `day` from the **device's local day**, never from UTC.

## Business rules to port

The rules are plain TypeScript in `packages/core/src` with executable examples in `logic.check.ts`; port each one and its assertions to Dart tests:

| Rule | File |
|---|---|
| next due date of a recurring task (`nextDue`), date parsing, ranges, weeks starting Monday | `dates.ts` |
| journal grouping, done/missed counts per day, period stats | `journal.ts` |
| report lateness (21:00), status, streaks, draft content, search folding | `reports.ts` |
| tags parsing, search, suggestions | `tags.ts` |
| quick add syntax (`mai 9h !1 #tag`, Vietnamese words in every language) | `quick.ts` |
| subtask span rules and labels | `subtasks.ts` |
| grouping by deadline, time ranges, repeat labels | `tasks.ts` |
| HTML↔text for titles and notes | `html.ts` |
| accent colour tokens and contrast | `accent.ts` |
| UI strings (Vietnamese key → English) | `i18n.ts` |

Rich text: store the same allow-listed HTML (p, br, b/strong, i/em, u, s, h2, h3, ul/ol/li, blockquote, no attributes); clean incoming HTML with the same allow-list as `apps/web/src/app/shared/sanitize.ts`, and keep `title` in sync with `title_html`.

## Behaviour to match

- Recurring tick → `complete_recurring`; moving tasks → `move_tasks`; undo a delete by re-inserting the task and its subtasks with the same ids.
- A report keeps `late`/`submitted_at` from its first save and cannot be deleted after its deadline.
- Realtime: subscribe to `postgres_changes` per table and refetch, as the current apps do.
