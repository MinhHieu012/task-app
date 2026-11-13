# Web (Angular)

Angular 21 LTS, standalone components, signals, zoneless change detection, lazy-loaded routes, Reactive Forms, SCSS. Talks to Supabase directly with `@supabase/supabase-js` (PostgREST, RPC, Auth, Realtime), the same backend the mobile app uses.

Angular 21 rather than 22: Angular 22 needs Node ^22.22.3; this repo runs on Node 22.20.

## Commands

```bash
npm install          # if npm 10 fails with "Cannot read properties of null (reading 'edgesOut')", run: npx npm@11 install
npm start            # http://localhost:4200 (writes src/environments/supabase.ts first)
npm run build        # production build → dist/web/browser
npm run build:staging
npm test             # unit tests (Vitest through the Angular builder)
npm run test:core    # packages/core rules + the translation check
npm run lint         # angular-eslint (TS + template accessibility rules)
npm run typecheck    # strict tsc for app and specs
npm run e2e          # Playwright (starts its own dev server on :4310)
npm run check        # lint + typecheck + test + test:core
npm run format       # Prettier
```

## Environment

`scripts/env.mjs` runs before serve/build/test and writes `src/environments/supabase.ts` (gitignored) from, in order: the process environment (Vercel), `apps/web/.env.local`, the repo root `.env.local`. Names: `SUPABASE_URL` / `SUPABASE_KEY`, or `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_KEY`. It refuses a secret or `service_role` key: only the publishable (anon) key may ship in a browser bundle.

`environment.ts` (production), `environment.development.ts` (`ng serve`) and `environment.staging.ts` (`--configuration staging`) differ only in `name`/`production`; the Supabase project comes from the build's environment variables.

## Structure

```
src/app/
  app.ts, app.config.ts, app.routes.ts   root, providers (zoneless, router with input binding, translated titles), routes
  core/
    supabase.service.ts   the client, error toasts (auth errors by code), Google sign-in/link
    auth.service.ts       session signal, password-recovery flag, signedIn/signedOut guards
    live.ts               liveRows(): a query as signals, kept live by one Realtime channel per table + refresh after writes
    tasks.service.ts      every write by domain (tasks, subtasks, projects, notes, reports) with undo toasts
    notify.service.ts     toasts (undo countdown) and the confirm dialog
    prefs.service.ts      theme/accent/language (device-local), TrPipe
    ui.service.ts         open task (?task=), the quick add's per-page context
    theme/palette.ts      colour tokens computed from the accent and theme
    layout/shell.*        sidebar + top bar (wide), top bar + bottom tabs + sheets (< 60rem)
  shared/                 icon, tick, task-row, task-group, quick-add, rich-editor, sanitize, calendar, day-chart, report bits, notifier
  features/               auth, today, upcoming, inbox, projects, journal, stats, search, reports, settings, task (drawer), design-system
src/styles.scss           global design system (Hallmark stamp first), tokens in src/styles/tokens.css
e2e/                      Playwright
```

Domain rules (dates, recurrence, journal counts, report deadlines, tags, quick add syntax, i18n) come from `packages/core` through the `@core/*` path; nothing in there knows Angular.

## Conventions

- UI strings: `{{ 'Tiếng Việt' | tr }}` or `tr('…')` in code. The Vietnamese text is the key; add its English to `packages/core/src/i18n.ts` (`npm run test:core` fails on a missing one). Never call `tr` at module level.
- Colours only through tokens (`var(--color-*)`); add a token in `tokens.css` and `palette.ts`, never a literal in a component.
- Components are standalone, `OnPush`, inputs/outputs as signals. A data region shows loading (skeleton), empty, error (toast) and full.
- State that should survive a reload lives in the URL: `?task=`, Upcoming's `?span&n&from&to`, Journal's `?day`, Stats' `?kind&at`, Search's `?q`.
- Writes go through `TasksService`; moving tasks uses the `move_tasks` RPC; destructive or moving actions offer an undo.
- Rich text is cleaned by `shared/sanitize.ts` (allow-list) on the way in and out.
- Design reference: `/design-system` (public route).
