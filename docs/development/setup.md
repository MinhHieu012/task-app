# Development setup, environment, build and deploy

## Requirements

- Node.js 22.18+ (plain-node checks run `.ts` files directly). Angular 21 needs ^22.12; Angular 22 would need ^22.22.3.
- npm 10 or 11. On npm 10, a fresh `npm install` in `apps/web` can fail with `Cannot read properties of null (reading 'edgesOut')` (an arborist bug on Vitest's optional peers); use `npx npm@11 install`. `npm ci` from the committed lockfile works on npm 10 (Vercel).
- Mobile native builds: JDK 17, Android SDK (`ANDROID_HOME`), see `docs/development/mobile.md`.

## Environment variables

| Where | Variable | Used by | Public? |
|---|---|---|---|
| root `.env.local` | `SUPABASE_URL` | `npm run db:push`, web fallback | yes |
| root `.env.local` | `SUPABASE_KEY` | web fallback | yes (publishable/anon key) |
| root `.env.local` | `SUPABASE_DB_PASSWORD` | `npm run db:push` only | **no**, never in an app env, never with a public prefix |
| `apps/web/.env.local` (optional) or Vercel | `SUPABASE_URL`, `SUPABASE_KEY` | `apps/web/scripts/env.mjs` | yes |
| `apps/mobile/.env.local` | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY` | Expo | yes (every `EXPO_PUBLIC_*` ships in the app) |

The web's `env.mjs` also accepts the `EXPO_PUBLIC_*` names, so an existing Vercel project keeps working, and it aborts if the key is a secret/`service_role` key.

## Run

```bash
npm run install:all
npm run web       # http://localhost:4200
npm run mobile    # Expo; open the development build on the phone
```

## Check before a commit

```bash
npm run check     # core rules + i18n, web lint/typecheck/unit, mobile lint/typecheck/test
npm run web:e2e   # Playwright, public flows and layout at 1920/1440/1366/768/390/360
```

## Build

- Web production: `npm run web:build` → `apps/web/dist/web/browser` (static SPA). Staging: `npm run build:staging --prefix apps/web`.
- Mobile: `npm run mobile:android`, or `cd apps/mobile/android && ./gradlew assembleDebug`.

## Deploy

- **Web (Vercel)**: `vercel.json` at the root builds `apps/web` (`npm ci --prefix apps/web`, `npm run build --prefix apps/web`, output `apps/web/dist/web/browser`), rewrites every path to `index.html`, keeps the security headers, caches hashed assets for a year, and deploys `main` only. The Vercel project's Root Directory stays the repo root. Set `SUPABASE_URL` and `SUPABASE_KEY` (or keep the existing `EXPO_PUBLIC_SUPABASE_*`).
- **DB**: new migration → `supabase/migrations/<timestamp>_<name>.sql`, update `supabase/schema.sql`, `packages/core/src/types.ts` and `apps/mobile/src/lib/supabase.ts`; run `npm run db:push` before merging.
- **Mobile**: development builds; rebuild after adding a native library.

## Supabase Auth

- **Redirect URLs** must list every path an auth flow returns to, for every origin: `/` (Google sign-in), `/settings` (link Google), `/reset-password` (password reset). Web origins: the Vercel domain and `http://localhost:4200` (the Angular dev server; the old Expo web used `:8081`). Mobile: `taskapp://`, `taskapp://settings`, `taskapp://reset-password`. An unlisted URL silently lands on the Site URL.
- **Google**: OAuth client of type Web application, redirect `https://<project>.supabase.co/auth/v1/callback`; enable *Allow manual linking*.
- **Email templates**: paste `supabase/templates/*.html` into Authentication > Email Templates.
