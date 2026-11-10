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
- **Reminders** via notifications (iOS/Android only).
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

> Reminder notifications need a development build (`npx expo run:ios|android` or `eas build --profile development`); Expo Go is not enough.

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

The data lives in 4 tables: `projects`, `tasks`, `subtasks`, `daily_reports`, all with per-user RLS.

## Web deploy

The web app deploys to Vercel (`vercel.json`): built with `npx expo export -p web` into `dist/`, auto-deployed from `main` only. Set both `EXPO_PUBLIC_SUPABASE_*` variables in the Vercel project.

## License

MIT, see [LICENSE](LICENSE).
