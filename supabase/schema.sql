-- Paste into Supabase Dashboard > SQL Editor and run once.

create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- One table for open tasks and journal entries: a row with completed_at is a journal entry.
-- repeat: daily | weekly:<days, 0=Sun..6=Sat, comma-separated> | monthly:<day 1..31> | every:<N>
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid references projects on delete set null,
  title text not null,
  note text,
  priority int not null default 4 check (priority between 1 and 4),
  due_date date,
  due_time time, -- start time
  end_date date,
  end_time time,
  repeat text check (repeat ~ '^(daily|weekly:[0-6](,[0-6])*|monthly:([1-9]|[12][0-9]|3[01])|every:[1-9][0-9]*)$'),
  completed_at timestamptz,
  -- Local day on the device at tick time, frozen so later time-zone changes don't move it.
  completed_day date,
  -- True only on the done copy a recurring tick leaves in the journal.
  recurring_copy boolean not null default false,
  created_at timestamptz not null default now(),
  check ((completed_at is null) = (completed_day is null)),
  check (due_time is null or due_date is not null),
  check ((end_date is null) = (end_time is null)),
  check (end_time is null or (due_time is not null and (end_date, end_time) > (due_date, due_time))),
  check (repeat is null or due_date is not null)
);

create index tasks_user_completed_day on tasks (user_id, completed_day);
create index tasks_user_due_date on tasks (user_id, due_date);

-- Checklist inside a task. One level only: a subtask is not a task, so it never shows in lists or the journal.
create table subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  task_id uuid not null references tasks on delete cascade,
  title text not null,
  done boolean not null default false,
  -- Start = start_date + start_time, end = end_date + end_time. Fitting inside the parent's span is checked in the app.
  start_date date,
  start_time time,
  end_date date,
  end_time time,
  created_at timestamptz not null default now(),
  check (start_time is null or start_date is not null),
  check (end_time is null or end_date is not null),
  check (end_date is null or (start_date is not null and end_date >= start_date)),
  check (end_time is null or start_time is null or (end_date, end_time) > (start_date, start_time))
);

create index subtasks_task on subtasks (task_id);

alter table projects enable row level security;
alter table tasks enable row level security;
alter table subtasks enable row level security;

create policy "own rows" on projects for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on tasks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on subtasks for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Tick a recurring task: insert a done copy for the journal and move the original to its next due date,
-- in one transaction. Security invoker, so RLS hides other users' tasks.
create function complete_recurring(p_task_id uuid, p_completed_at timestamptz, p_completed_day date, p_next_due date)
returns void
language plpgsql security invoker set search_path = public
as $$
declare t tasks;
begin
  select * into t from tasks where id = p_task_id and repeat is not null and completed_at is null;
  if not found then raise exception 'task not found'; end if;
  if p_next_due is null or p_next_due <= t.due_date then raise exception 'invalid next due date'; end if;

  insert into tasks (project_id, title, note, priority, due_date, due_time, end_date, end_time, completed_at, completed_day, recurring_copy)
  values (t.project_id, t.title, t.note, t.priority, t.due_date, t.due_time, t.end_date, t.end_time, p_completed_at, p_completed_day, true);

  -- The end moves with the start, keeping the same span.
  update tasks set due_date = p_next_due, end_date = p_next_due + (end_date - due_date) where id = p_task_id;
  -- The checklist moves with the task and starts the next round unticked.
  update subtasks set done = false, start_date = start_date + (p_next_due - t.due_date), end_date = end_date + (p_next_due - t.due_date)
  where task_id = p_task_id;
end $$;

alter publication supabase_realtime add table projects, tasks, subtasks;
