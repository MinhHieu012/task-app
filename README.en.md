# Việc & Nhật ký

[Tiếng Việt](README.md) · English

A personal task manager with a daily journal. One Supabase backend, two independent apps:

| | Stack | Folder |
|---|---|---|
| **Web** | Angular 21 (standalone components, signals, lazy routes), SCSS | [`apps/web`](apps/web/README.md) |
| **Mobile** (iOS/Android) | Expo SDK 58, React Native 0.88, Expo Router | [`apps/mobile`](apps/mobile/README.md) |
| **Backend** | Supabase: Postgres + RLS, Auth (email/password, Google), Realtime, 2 RPCs | [`supabase/`](supabase) |
| **Shared rules** | Plain TypeScript, no framework | [`packages/core`](packages/core) |

The web no longer runs on Expo or React Native Web. The apps share no UI, only the backend, the data contracts and the business rules.

## Quick start

Node.js 22.18+ and a Supabase project.

```bash
cp .env.example .env.local        # URL, publishable key, DB password (db:push only)
npm run install:all
npm run db:push                   # applies migrations to the hosted DB
npm run web                       # Angular on http://localhost:4200
npm run mobile                    # Expo dev server (needs apps/mobile/.env.local)
```

`npm run check` runs every check (core rules and translations, web lint/typecheck/unit tests, mobile lint/typecheck/tests). `npm run web:e2e` runs the Playwright tests.

Docs: [architecture](docs/architecture/overview.md) · [setup & deploy](docs/development/setup.md) · [API contracts](docs/api/contracts.md) · [Flutter guide](docs/api/flutter-guide.md) · [migration notes](docs/migration/angular-web.md).

## Deploy

Web: Vercel deploys `main` (`vercel.json` builds `apps/web`; env `SUPABASE_URL`, `SUPABASE_KEY`). Mobile: development builds only. DB: run `npm run db:push` for new migrations before merging.

## License

MIT, see [LICENSE](LICENSE).
