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

- `src/app/` — routes only. `_layout.tsx` gates `sign-in` vs `(tabs)` + `task/[id]` with `Stack.Protected` on the Supabase session. Tabs: `index` (Today), `inbox`, `upcoming`, `projects`, `project/[id]`, `journal`. `design-system.tsx` is a living style reference.
- `src/components/ui.tsx` — the shared primitives (`Screen`, `Card`, `Button`, `Field`, `ListRow`, `Tick`, `Choices`, `ConfirmModal`, `useWide`, ...). Reuse these before writing new UI.
- `src/constants/theme.ts` — all colors/tokens and the font. Change colors here only; never hardcode hex in screens.
- `src/lib/` — `supabase.ts` (client, `Task`/`Project` types, `useSession`, `useRows`, `ok`), `dates.ts` (local-day ISO helpers, `nextDue`, `parseDate` dd/mm), `journal.ts`, `reminders.ts` (expo-notifications, native only), `notify.ts` (`showError`, `confirmAction`).
- `docs/plans/`, `docs/design/` — past plans and the design-system HTML.

## Conventions

- Font is **Be Vietnam Pro** (one family, faces picked by `fontWeight`). Do not switch to a font without full Vietnamese glyphs (DM Sans broke diacritics).
- Dates are local-day ISO strings (`YYYY-MM-DD`) from `dates.ts`; never derive "today" from UTC (`toISOString`).
- A task row with `completed_at` is a journal entry. `completed_day` is frozen at tick time. Recurring tick: open task moves to `nextDue`, a `recurring_copy` done row stays in the journal.
- `repeat` format: `daily | weekly:<0-6,...> | monthly:<1-31> | every:<N>` (enforced by a DB check).
- New pure logic in `src/lib` gets an assert in `logic.check.ts`.
- Code style: small, direct, no speculative abstractions; comments explain *why*.

## Database (Supabase)

- Schema changes = new file in `supabase/migrations/<timestamp>_<name>.sql`; also update `supabase/schema.sql` (full snapshot) and the `Task`/`Project` types in `src/lib/supabase.ts`.
- RLS is per user (`user_id default auth.uid()`); keep it on every new table.
- `npm run db:push` goes through the IPv4 session pooler (`scripts/supabase.mjs`, region eu-west-1) because the direct host is IPv6-only. Writes to the hosted DB are run by the user — prepare the migration and ask.
- Env in `.env.local` (see `.env.example`). Only `EXPO_PUBLIC_*` reaches the app; `SUPABASE_DB_PASSWORD` must never get that prefix.
