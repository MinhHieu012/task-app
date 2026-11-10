# Việc & Nhật ký

[Tiếng Việt](README.md) · English

A personal task manager with a daily journal. Runs on iOS, Android and web (the web app switches to a wide layout from 1024px). The UI is in Vietnamese, with an English version.

## Features

- **Today / Inbox / Upcoming**: tasks for the day, unscheduled tasks and tasks coming up.
- **Projects**: group tasks by project.
- **Subtasks** with their own date and time.
- **Recurring tasks**: daily, on chosen weekdays, on a day of the month, or every N days.
- **Journal**: every finished task is logged under the day it was completed.
- **Daily report**: one rich-text report per day, due at 21:00; reports saved after that are marked late.
- **On-time streak**: consecutive days with the report saved before 21:00.
- **Tags** (`#tag`): tag tasks, pick tags used before instead of retyping them, filter by tag.
- **Search**: by title and note (accent-insensitive), filtered by `#tag`.
- **Quick add syntax**: `Team meeting mai 9h !1 #work` sets the date, time, priority and tags. The syntax is suggested while typing, with a preview of what will be saved.
- **Moving tasks**: "Tomorrow" / "Next week" on each task, "Move to today" for all overdue tasks.
- **Undo** on the toast (10 seconds, with a countdown) after moving or deleting tasks.
- **Weekly/monthly stats**: tasks done against the previous period, missed tasks, on-time rate, by project and by tag.
- **A free note** for each day in the journal.
- **Reminders** via notifications (iOS/Android only).
- **Sign-in** with email/password or Google; link and unlink Google accounts in Settings; password reset by email.
- Light/dark mode; language and accent color in Settings.

## Stack

Expo SDK 58 (Expo Router, typed routes), React 19, React Native 0.88, TypeScript, Supabase (auth + Postgres). Font: Be Vietnam Pro.

## Setup

Requires Node.js 22.18+ (`npm test` runs a `.ts` file directly with node) and a Supabase project.

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL, key and DB password
npm run db:push              # create the tables in your Supabase DB
npm start                    # then press w (web), i (iOS) or a (Android)
```

Environment variables (`.env.local`):

| Variable | Used for |
|----------|----------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_KEY` | anon / publishable key |
| `SUPABASE_DB_PASSWORD` | only for `npm run db:push`; **never** add the `EXPO_PUBLIC_` prefix |

Sign-up confirmation and password reset email templates live in `supabase/templates/`; paste them into Supabase Dashboard > Authentication > Email Templates.

> Reminder notifications and Google sign-in on phones need a development build (`npx expo run:ios|android` or `eas build --profile development`); Expo Go is not enough.

## Commands

```bash
npm start           # dev server (npm run web / ios / android)
npm run lint        # expo lint
npm run typecheck   # tsc --noEmit
npm test            # checks for date, journal and i18n logic
npm run db:push     # apply supabase/migrations to the DB
```

Before committing: `npm run lint && npm run typecheck && npm test`.

## Layout

```
src/app/          screens (Expo Router)
src/components/   shared UI (ui.tsx) and components; dom/ holds Expo DOM components
src/constants/    theme: colors, tokens, font
src/lib/          Supabase client, dates, journal, reports, reminders, i18n
supabase/         migrations, schema.sql (full snapshot), email templates
docs/             plans and design-system docs
```

The data lives in 5 tables: `projects`, `tasks`, `subtasks`, `daily_reports`, `journal_notes`, all with per-user RLS.

## Deploy

Current flow:

1. Work on a branch; run `npm run lint && npm run typecheck && npm test`.
2. With a new migration, run `npm run db:push` **before merging**, so the DB has the new columns/tables when the new web build goes live.
3. Open a PR into `main` on GitHub and merge it.
4. **Vercel** builds and deploys whenever `main` changes (other branches never deploy, see `vercel.json`): built with `npx expo export -p web` into `dist/`, every path served by `index.html`. Set both `EXPO_PUBLIC_SUPABASE_*` variables in the Vercel project.

### Supabase Auth setup (once, in the Dashboard)

- **URL Configuration**: *Site URL* is the main web domain. *Redirect URLs* list exactly the URLs the app returns to, for each place it runs (the Vercel domain, `http://localhost:8081`, `taskapp://`):
  - `/` (Google sign-in), `/settings` (linking Google), `/reset-password` (password reset).
  - For example `https://<domain>/settings`, `taskapp://settings`. A URL not on the list is sent to the Site URL instead.
- **Google**: create an OAuth client of type *Web application* in Google Cloud, redirect URI `https://<project>.supabase.co/auth/v1/callback`; paste the Client ID/Secret into *Sign In / Providers → Google*; turn on *Allow manual linking* so a Gmail with another email can be linked. While the Google app is in *Testing*, only Gmails listed under *Test users* can sign in.
- **Email Templates**: paste the templates from `supabase/templates/`.

### Mobile

Not on the stores yet. Runs as a development build (`npx expo run:ios|android`); rebuild whenever a library with native code is added (e.g. `expo-web-browser`, `expo-notifications`).

## License

MIT, see [LICENSE](LICENSE).
