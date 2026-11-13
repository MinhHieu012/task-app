# Architecture

```
            ┌──────────────────────────┐        ┌──────────────────────────┐
            │ apps/web  (Angular 21)   │        │ apps/mobile (Expo 58)    │
            │ browser, Vercel          │        │ iOS / Android dev builds │
            └────────────┬─────────────┘        └────────────┬─────────────┘
                         │ @supabase/supabase-js (HTTPS + WebSocket)          │
                         └───────────────────────┬────────────────────────────┘
                                                 ▼
                    ┌───────────────────────────────────────────────────┐
                    │ Supabase (eu-west-1)                              │
                    │ Auth · PostgREST · RPC · Realtime · Postgres+RLS  │
                    └───────────────────────────────────────────────────┘
packages/core: framework-free rules (dates, recurrence, journal, reports, tags, quick add, i18n, row types)
```

## Parts

| Part | What it is | Depends on |
|---|---|---|
| `supabase/` | The backend: migrations (source of truth), `schema.sql` snapshot, auth email templates. No custom server: the apps call PostgREST, two `security invoker` RPCs and Auth directly; RLS (`user_id = auth.uid()`) scopes every row. | – |
| `packages/core` | Pure TypeScript, no imports outside itself, runnable in plain node (`logic.check.ts`). | – |
| `apps/web` | Angular app. Imports `packages/core` through the `@core/*` tsconfig path; the Angular compiler builds those files with the app. | core, Supabase |
| `apps/mobile` | Expo app, unchanged. Has its own copy of the rules in `src/lib`. | Supabase |

The two apps never import each other and share no UI. Each has its own `node_modules`, lockfile, lint and test setup; the root `package.json` only forwards commands (no npm workspaces, so an Expo install can never disturb the Angular one and the reverse).

## Web (Angular)

- **Shell**: `core/layout/shell` holds the navigation (sidebar wide, bottom tabs under 60rem), the quick add, and the task drawer, which opens from `?task=<id>` over any page.
- **Data**: `liveRows(table, query)` turns a Supabase select into signals (`rows`, `loaded`, `failed`). The query rebuilds when a signal it reads changes; one Realtime channel per table reloads every open query of that table, and every write calls `LiveService.refresh(table)` so the user's own change shows at once. This replaces the mobile `useRows` hook.
- **Writes**: `TasksService`, one method per domain action, the same calls and rules as mobile (recurring tick through `complete_recurring`, moves through `move_tasks`, undo by re-inserting with the same ids).
- **Why no HttpClient/interceptors**: the backend contract is Supabase's (PostgREST query syntax, Realtime, Auth with PKCE and token refresh), which `supabase-js` implements and the mobile app already uses. Wrapping it in HttpClient would re-implement that client, not reuse it. Errors are handled in one place (`SupabaseService.ok`), auth tokens and refresh by the client.
- **Auth**: `AuthService.session` signal; `signedIn`/`signedOut` guards; `App` sends a signed-out user to `/sign-in` (except the public `/reset-password` and `/design-system`). PKCE for Google and email links.
- **Theme**: tokens in `styles/tokens.css`; `core/theme/palette.ts` recomputes them from the user's accent and light/dark/system, applied live.
- **i18n**: `tr()` from core (Vietnamese text is the key, English table in `core/src/i18n.ts`); the language is read at startup and a change reloads the page.

## Sharing

Shared: the backend and its contracts (`docs/api/contracts.md`), the row types (`packages/core/src/types.ts`), and the business rules in `packages/core`. Not shared: UI, navigation, state management, platform code (notifications, haptics, secure storage).

`packages/core` started as a copy of `apps/mobile/src/lib/{dates,journal,tags,quick,subtasks,reports,html,accent,i18n}.ts` plus the display rules that were inline in the mobile task row (`tasks.ts`). The mobile app still uses its own copy: pointing Metro at a folder outside the app (`watchFolders`, resolver) and re-verifying native builds was out of scope for a move that must not change mobile. Follow-up when convenient: import `packages/core` from mobile, delete the copies, run both apps' checks.

A future Flutter app cannot import TypeScript; for it the contract is the database schema and RPCs, documented in `docs/api/`, and `logic.check.ts` is the executable specification of the rules it must reproduce (`docs/api/flutter-guide.md`).
