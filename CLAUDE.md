@AGENTS.md

# task-app

Personal task manager + daily journal. Expo SDK 58 (Expo Router, typed routes), React 19, TypeScript, Supabase (auth + Postgres). Runs on iOS, Android and web (web has a wide layout at >= 1024px). UI text is Vietnamese.

## Commands

```bash
npm start              # dev server (npm run web / ios / android)
npm run lint           # expo lint
npm run typecheck      # tsc --noEmit
npm test               # node src/lib/logic.check.ts — plain node:assert checks for dates/journal logic
npm run db:push        # apply supabase/migrations to the hosted DB
```

Before calling a task done: `npm run lint && npm run typecheck && npm test`.

## Layout

- `src/app/` — routes only. `_layout.tsx` gates `sign-in` vs `(tabs)` + `task/[id]` with `Stack.Protected` on the Supabase session. Tabs: `index` (Today), `inbox`, `upcoming`, `projects`, `project/[id]`, `journal`, `reports`, `report/…`, `settings`, and the hidden `search`, `stats` (reached from the rail and header buttons). `design-system.tsx` is a living style reference.
- `src/components/ui.tsx` — the shared primitives (`Screen`, `Card`, `Button`, `Field`, `ListRow`, `Tick`, `Choices`, `ConfirmModal`, `useWide`, ...). Reuse these before writing new UI.
- `src/constants/theme.ts` — all colors/tokens and the font. Change colors here only; never hardcode hex in screens.
- `src/lib/` — `supabase.ts` (client, `Task`/`Project` types, `useSession`, `useRows`, `ok`), `dates.ts` (local-day ISO helpers, `nextDue`, `parseDate` dd/mm), `journal.ts`, `reminders.ts` (expo-notifications, native only), `notify.ts` (`showError`, `confirmAction`, `toast` with an optional undo action), `tags.ts` (`#tag` parsing, search, suggestions), `quick.ts` (quick add syntax: `mai 9h !1 #tag`).
- `docs/plans/`, `docs/design/` — past plans and the design-system HTML.

## Conventions

- Font is **Be Vietnam Pro** (one family, faces picked by `fontWeight`). Do not switch to a font without full Vietnamese glyphs (DM Sans broke diacritics).
- Dates are local-day ISO strings (`YYYY-MM-DD`) from `dates.ts`; never derive "today" from UTC (`toISOString`).
- A task row with `completed_at` is a journal entry. `completed_day` is frozen at tick time. Recurring tick: open task moves to `nextDue`, a `recurring_copy` done row stays in the journal.
- `repeat` format: `daily | weekly:<0-6,...> | monthly:<1-31> | every:<N>` (enforced by a DB check).
- New pure logic in `src/lib` gets an assert in `logic.check.ts`.
- UI strings go through `tr('Vietnamese text', { vars })` (`src/lib/i18n.ts`): the Vietnamese is the key, add its English to `en` (`npm test` fails on a missing one). Never call `tr` at module level.
- Language and accent are device prefs (`src/lib/prefs.ts` / `.native.ts`), read synchronously at startup; changing one reloads the app, since StyleSheets are built once at module load.
- Daily report (`daily_reports`, one per day, HTML): due 21:00 local, `late` frozen at first save (`src/lib/reports.ts`). The editor/viewer are Expo DOM components (`src/components/dom/`, `'use dom'`): they get labels and colours as props and always pass HTML through `sanitize`.
- Quick add syntax words live only in `quick.ts` (Vietnamese in every language, excluded from the i18n scan); the panel shows them as hint chips, so add any new token to `EXAMPLES` too.
- Moving tasks (snooze, move overdue, undo) goes through the `move_tasks` RPC, which shifts the end date and subtasks by the same days. Destructive or moving actions get an undo toast.
- Auth: email/password plus Google via `google(link, path)` in `supabase.ts` (sign in, or link to the current user). Every path an auth flow returns to (`/`, `/settings`, `/reset-password`) must be in Supabase's Redirect URLs for web origins and `taskapp://`; an unlisted one silently lands on the Site URL. Errors come back in the URL (`error_code`), mapped in `AUTH_ERRORS`.
- Code style: small, direct, no speculative abstractions; comments explain *why*.

## Deploy

Web: Vercel auto-deploys `main` only (`vercel.json`: `expo export -p web` → `dist/`, SPA rewrite). Flow: branch → checks → `db:push` for new migrations before merge → PR → merge. Mobile: development builds only, not on the stores; a new native library means a rebuild.

## Database (Supabase)

- Schema changes = new file in `supabase/migrations/<timestamp>_<name>.sql`; also update `supabase/schema.sql` (full snapshot) and the `Task`/`Project` types in `src/lib/supabase.ts`.
- RLS is per user (`user_id default auth.uid()`); keep it on every new table.
- `npm run db:push` goes through the IPv4 session pooler (`scripts/supabase.mjs`, region eu-west-1) because the direct host is IPv6-only. Writes to the hosted DB are run by the user — prepare the migration and ask.
- Env in `.env.local` (see `.env.example`). Only `EXPO_PUBLIC_*` reaches the app; `SUPABASE_DB_PASSWORD` must never get that prefix.
