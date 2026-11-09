-- End-of-day report, one per user and day, due by 21:00 local time.
-- content is the formatted report as HTML (sanitized again whenever it is shown); body is its plain text, for search.
-- late is decided on the device at the first save (local 21:00) and frozen, like tasks.completed_day.
-- done_count / missed_count snapshot the day's journal at the last save, so the report list needs no task query.
create table daily_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  content text not null check (char_length(content) <= 200000),
  body text not null default '',
  late boolean not null default false,
  done_count int not null default 0,
  missed_count int not null default 0,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

alter table daily_reports enable row level security;
create policy "own rows" on daily_reports for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter publication supabase_realtime add table daily_reports;
