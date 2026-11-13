# Migration notes: web to Angular, repo split (2026-11-12)

Plan: [angular-web-plan.md](angular-web-plan.md). Branch `refactor/angular-web`.

## Before → after

```
before                              after
src/  assets/  app.json             apps/mobile/   (git mv, unchanged)
package.json  tsconfig.json  ...    apps/web/      (new Angular 21 app)
vercel.json (expo export -p web)    packages/core/ (pure rules, copied from src/lib)
supabase/  scripts/  docs/          supabase/  scripts/  docs/  (stay; docs gained architecture/api/development/migration)
                                    package.json   (root command forwarder), vercel.json (builds apps/web)
```

Moved with `git mv` (history kept): `src/`, `assets/`, `app.json`, `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.js`, `AGENTS.md` → `apps/mobile/`. Moved on disk (untracked): `node_modules/`, `.expo/`, `android/`, `expo-env.d.ts`. `.env.local` copied to `apps/mobile/.env.local` with only the `EXPO_PUBLIC_*` keys.

## Mobile

Changed, and why:

| File | Change | Why |
|---|---|---|
| `apps/mobile/package.json` | removed `web`, `supabase`, `db:push` scripts | the web is Angular now; the DB scripts point at `scripts/` and moved to the root |
| `.gitignore` (root) | `/android`, `/ios` → `apps/mobile/android/`, `apps/mobile/ios/` | anchored paths moved |
| `apps/mobile/.env.local` (untracked) | new, public keys only | Expo reads env from the app folder |
| `apps/mobile/android/app/.cxx` (generated cache) | cleared | CMake caches held absolute paths to the old `node_modules` |

Unchanged (byte-compared with HEAD, line endings aside): every file in `src/`, `assets/`, `app.json`, `tsconfig.json`, `eslint.config.js`, `AGENTS.md`, `package-lock.json`. Same dependencies, navigation, state, API calls and UI.

Verified from `apps/mobile`: `npm run typecheck`, `npm test`, `npm run lint`, `npx expo export --platform android` (Metro bundle incl. DOM components), `./gradlew assembleDebug` (native build). Not verified: an iOS build (no macOS here) and a run on the phone (the dev build must be reinstalled from the new path by the user).

## Web feature map

Every web screen of the Expo app has an Angular counterpart at the same path:

| Old (Expo web) | Angular | Notes |
|---|---|---|
| `/` Today: stats, report nudge, overdue + today ledger, move overdue, 7-day strip, next task, done today | `features/today` | same |
| `/upcoming`: spans 3d…year, custom, quarter/year stepping, day lanes, month grid | `features/upcoming` | range now in the URL; phones get the lanes stacked instead of the 30-day agenda |
| `/inbox` | `features/inbox` | same |
| `/projects` table + add, `/project/:id` rename/delete/progress | `features/projects` | same |
| `/journal`: month stats, chart, calendar, day report, day note, done by project, log done work | `features/journal` | selected day in `?day` |
| `/stats` | `features/stats` | period in `?kind&at` |
| `/search` with tag filters | `features/search` | `?q` |
| `/reports`, `/report/:day` editor with draft, lock after deadline | `features/reports` | same |
| `/settings`: account, Google link/unlink, sign out, password, language, theme, accent | `features/settings` | theme and accent apply instantly (no reload); language still reloads |
| `/sign-in`, `/reset-password` | `features/auth` | same flows, PKCE |
| task side panel / `/task/:id` | `features/task/task-drawer` | `?task=<id>` over any page; `/task/:id` redirects to `/?task=id` |
| quick add with syntax, hints, tag suggestions, `N` shortcut | `shared/quick-add` | one box in the top bar (wide) / add sheet (phones) |
| toasts with undo, confirm dialog | `shared/notifier` | native `<dialog>`: focus trap, Esc, focus on Cancel |
| `/design-system` | `features/design-system` | living reference of the new system |

Phone-only mobile features that the old web never had (notifications, haptics, swipe gestures) stay mobile-only.

## Deliberate differences

- Date and time fields are native `<input type="date|time">` instead of typed `DD/MM` text with custom pickers. Stored values are unchanged. The display format follows the browser's locale (an English-locale Chrome shows `mm/dd/yyyy`).
- The quick add of the Journal (log done work) is the shell's box with a Journal context, not a second box on the page.
- Navigation: a labelled sidebar instead of the 88px icon rail with hover tooltips; phones get four tabs plus "Thêm" (more).

## Redesign (Hallmark, app scope, full)

System kept from the brand: Be Vietnam Pro, warm paper turned to the accent's hue, white sheets, soft corners, the user's accent. Recomposed: shell, ledger rows (time column, stretched-link rows with their own tick, tag and snooze targets), stat band, aside summaries, tables, drawers and sheets, empty/loading/error states. Tokens in `apps/web/src/styles/tokens.css`; stamp, waivers and decisions at the top of `apps/web/src/styles.scss`. Sweep: sloplint 0 FAIL, 4 REFLEX waived on the record (pure white sheet is the brand; inline text links), 1 WARN answered (sign-in intro hidden on phones).

## Testing done

- Unit (Vitest): palette contrast for every preset in light/dark, notify queue and confirm, tick component, sanitizer. Core: `logic.check.ts` incl. new task rules and a translation scan over the web templates.
- E2E (Playwright): guard redirect, sign-in validation, mode switching, reset link without recovery, theme switch, no horizontal scroll at 1920/1440/1366/768/390/360.
- Manual, in Chrome against the real Supabase project with the owner signed in (Google, PKCE): quick add with syntax, edit in the drawer (priority, note, subtask), tick subtask, tick task (moves to done and the journal), delete with confirm, undo (restored with its subtask), search, accent/theme switch, every route at 1920, 1440, 1366, 768, 390, 360, light and dark; no console errors. Test rows were removed afterwards.

## Known gaps

- `packages/core` and `apps/mobile/src/lib` are two copies of the same rules until mobile imports core.
- Not automated: signed-in E2E (needs a dedicated test account and project).
- Initial web bundle is about 680 kB raw / 175 kB transferred, mostly `supabase-js` and Angular; budget warning raised to 750 kB.
