# task-app

Personal task manager + daily journal. One Supabase backend (auth + Postgres), two independent apps:

- `apps/web/` — **Angular 21** (standalone, signals, zoneless, lazy routes, SCSS). The only web app; Vercel deploys it.
- `apps/mobile/` — **Expo SDK 58** (Expo Router, React Native 0.88). iOS/Android development builds. Its own rules: `apps/mobile/AGENTS.md`.
- `packages/core/` — framework-free TS rules (dates, recurrence, journal, reports, tags, quick add, i18n, row types), used by the web.
- `supabase/` — migrations (source of truth), `schema.sql`, email templates. `scripts/supabase.mjs` runs the CLI.

UI text is Vietnamese (English through `tr`). Docs: `docs/architecture/overview.md`, `docs/api/contracts.md`, `docs/development/setup.md`, `docs/development/mobile.md`, `docs/migration/angular-web.md`.

## Commands (repo root)

```bash
npm run web | web:build | web:check | web:e2e
npm run mobile | mobile:android | mobile:check
npm run core:test        # packages/core rules + the web translation scan
npm run check            # everything above except e2e
npm run db:push          # apply supabase/migrations to the hosted DB
```

Before calling a task done: `npm run check`. No npm workspaces: each app has its own node_modules and lockfile.

## Rules

- **Mobile is frozen** apart from mobile tasks: never redesign it or change its logic as a side effect of web work. Expo rules in `apps/mobile/AGENTS.md`.
- Web never uses Expo or React Native Web. Web and mobile share no UI.
- A business rule lives in `packages/core` (with an assert in `logic.check.ts`) and, until mobile imports core, in `apps/mobile/src/lib` too: change both.
- Font is **Be Vietnam Pro** (full Vietnamese glyphs; DM Sans broke diacritics).
- Dates are local-day ISO strings (`YYYY-MM-DD`) from `dates.ts`; never derive "today" from UTC.
- A task row with `completed_at` is a journal entry; `completed_day` is frozen at tick time. Recurring tick: `complete_recurring` RPC. Moving tasks: `move_tasks` RPC. Destructive or moving actions get an undo toast.
- `repeat` format: `daily | weekly:<0-6,...> | monthly:<1-31> | every:<N>` (DB check).
- Daily report: due 21:00 local, `late` frozen at first save; rich HTML always through the sanitizer allow-list.
- Quick add syntax words live only in `core/quick.ts` (Vietnamese in every language); add new tokens to `EXAMPLES`.
- Auth: email/password + Google with PKCE. Every return path (`/`, `/settings`, `/reset-password`) must be in Supabase's Redirect URLs for each origin (`http://localhost:4200`, the Vercel domain, `taskapp://`).
- Code style: small, direct, no speculative abstractions; comments explain *why*.

### Web (apps/web)

- Strings: `{{ 'Tiếng Việt' | tr }}` / `tr()`; the Vietnamese is the key, add English to `packages/core/src/i18n.ts` (`core:test` fails on a missing one). Never call `tr` at module level.
- Colours only via tokens (`src/styles/tokens.css` + `core/theme/palette.ts`); never a hex in a component. Global system in `src/styles.scss` (Hallmark stamp first).
- Data: `liveRows()` for reads, `TasksService` for writes (each refreshes its tables). Components standalone + OnPush, signal inputs.
- Shareable state in the URL (`?task`, `?day`, `?q`, Upcoming/Stats params).
- Env: `scripts/env.mjs` writes `src/environments/supabase.ts` (gitignored) from `SUPABASE_URL`/`SUPABASE_KEY` (or `EXPO_PUBLIC_*`); publishable key only.

## Deploy

Web: Vercel auto-deploys `main` (`vercel.json` builds `apps/web` → `apps/web/dist/web/browser`, SPA rewrite). Flow: branch → `npm run check` → `db:push` for new migrations before merge → PR → merge. Mobile: development builds only; a new native library means a rebuild.

## Database (Supabase)

- Schema change = new `supabase/migrations/<timestamp>_<name>.sql`; also update `supabase/schema.sql`, `packages/core/src/types.ts` and `apps/mobile/src/lib/supabase.ts`.
- RLS per user (`user_id default auth.uid()`) on every table.
- `npm run db:push` goes through the IPv4 session pooler (eu-west-1). Writes to the hosted DB are run by the user — prepare the migration and ask.
- Env: root `.env.local` (`SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_DB_PASSWORD`); `apps/mobile/.env.local` (`EXPO_PUBLIC_*`). The DB password never gets a public prefix or goes into an app env.
