# API contracts

The backend is Supabase. There is no custom HTTP API: clients use the PostgREST REST endpoints (`/rest/v1/<table>`), two RPCs (`/rest/v1/rpc/<name>`), Auth (`/auth/v1`) and Realtime (WebSocket). Both apps send the publishable (anon) key plus the user's access token; Row Level Security limits every table to `user_id = auth.uid()`, and `user_id` defaults to `auth.uid()`, so clients never send it.

Source of truth: `supabase/migrations/*.sql` (applied history) and `supabase/schema.sql` (current snapshot). Row types: `packages/core/src/types.ts`.

## Tables

### projects
| column | type | notes |
|---|---|---|
| id | uuid | default `gen_random_uuid()` |
| name | text | required |
| created_at | timestamptz | default `now()` |

Deleting a project sets its tasks' `project_id` to null (they return to the Inbox).

### tasks
One table for open tasks and journal entries: a row with `completed_at` is a journal entry.

| column | type | notes |
|---|---|---|
| id | uuid | |
| project_id | uuid \| null | null = Inbox |
| title | text | plain, one line (lists, search, reports) |
| title_html | text \| null | the same title formatted; used only if `htmlToText(title_html) === title` |
| note | text \| null | HTML (older rows: plain text) |
| priority | int 1..4 | 4 = normal |
| due_date | date \| null | start day, `YYYY-MM-DD` local |
| due_time | time \| null | start time; requires `due_date` |
| end_date, end_time | date, time | both or neither; end must be after start |
| repeat | text \| null | `daily` \| `weekly:<0-6,...>` (0 = Sunday) \| `monthly:<1-31>` \| `every:<N>`; requires `due_date` |
| completed_at | timestamptz \| null | |
| completed_day | date \| null | local day at tick time, frozen; set together with `completed_at` |
| recurring_copy | bool | true only on the done copy a recurring tick leaves |
| tags | text[] | lowercase, without `#` |
| created_at | timestamptz | |

### subtasks
`id, task_id (cascade), title, title_html, done, start_date, start_time, end_date, end_time, created_at`. One level only. A time needs its date; the end is not before the start. Fitting inside the parent's span is checked by the clients (`spanError` in core).

### daily_reports
`id, day (unique per user), content (HTML, ≤ 200 000 chars), body (plain text, for search), late, done_count, missed_count, submitted_at, updated_at`. Upsert on `(user_id, day)`. `late` and `submitted_at` are set by the first save only (late = saved after 21:00 local on that day, or any later day). A report past its deadline can be edited but not deleted (client rule).

### journal_notes
`id, day (unique per user), body (≤ 20 000 chars), updated_at`. Upsert on `(user_id, day)`; an emptied note is deleted.

## RPCs

### complete_recurring(p_task_id uuid, p_completed_at timestamptz, p_completed_day date, p_next_due date) → void
Ticks a recurring task in one transaction: inserts a done copy (`recurring_copy = true`), moves the task (and its end) to `p_next_due`, moves its subtasks by the same number of days and unticks them. `p_next_due` must be after the current `due_date` (computed by `nextDue` in core).

### move_tasks(p_ids uuid[], p_days date[]) → int
Moves open tasks to new start days, one day per task; the end and the subtasks shift by the same number of days. Returns the number moved. Used for snooze, "move all overdue to today", and their undo.

## Common queries

PostgREST filters as both apps send them, for example:

```
GET /rest/v1/tasks?select=*&completed_at=is.null&due_date=lte.2026-11-12&order=due_date.asc,due_time.asc.nullslast,priority.asc   (Today)
GET /rest/v1/tasks?select=*&completed_day=gte.2026-11-01&completed_day=lte.2026-11-30                                            (Journal month)
GET /rest/v1/tasks?select=*&completed_at=is.null&project_id=is.null                                                              (Inbox)
GET /rest/v1/subtasks?select=*&task_id=in.(<ids>)&order=created_at.asc
POST /rest/v1/daily_reports?on_conflict=user_id,day   (Prefer: resolution=merge-duplicates)
POST /rest/v1/rpc/move_tasks   {"p_ids": [...], "p_days": [...]}
```

## Auth

- Email/password: `signUp` (confirmation email), `signInWithPassword`, `resetPasswordForEmail(redirectTo=<origin>/reset-password)`, `updateUser({ password })`.
- Google: OAuth with **PKCE** (`flowType: 'pkce'`); the client trades `?code=` for a session. Linking: `linkIdentity`, `unlinkIdentity` (the last identity cannot be removed).
- Password recovery: the client receives the `PASSWORD_RECOVERY` event once; only then may it show the new-password form.
- Errors returned in the redirect URL: `error_code`, `error_description`. Known codes are translated by the clients (`AUTH_ERRORS`).
- Sessions: access token (JWT, about 1 hour) refreshed by the client with the refresh token; sign-out revokes it.

## Errors

PostgREST/Auth errors are JSON: `{ "code": "...", "message": "...", "details": ..., "hint": ... }` (Auth: `{ "code", "msg"/"message" }`). Check-constraint violations (`23514`) mean a client sent an invalid combination (for example an end time without an end day). Clients show `message`, or a translated text for known auth codes.

## Pagination

Lists are small (one person's data) and are loaded whole, ordered server-side. PostgREST supports `limit`/`offset` and `Range` headers when a list grows; search and report search are done on the device today (`ponytail` notes in the code mark where to move them server-side).

## Dates and times

- `date` columns are local calendar days, `YYYY-MM-DD`, computed on the device (never from UTC). `time` columns are local `HH:MM[:SS]`.
- `timestamptz` columns (`completed_at`, `submitted_at`, `updated_at`, `created_at`) are UTC instants; the matching local day is stored separately where it matters (`completed_day`, report `day`) and frozen at write time.
- The report deadline is 21:00 local time of the report's day.

## Versioning

The schema evolves by additive migrations (new nullable columns, new tables). A breaking change needs a new column or table first, both apps moved to it, then the old one dropped in a later migration. Database functions are versioned by name (`move_tasks_v2`) if their signature must change.
