-- Tags on tasks: lowercase words without the '#', set from quick add (#tag) or the task form.
alter table tasks add column tags text[] not null default '{}';

-- The done copy of a recurring task keeps its tags (same function as before, plus tags).
create or replace function complete_recurring(p_task_id uuid, p_completed_at timestamptz, p_completed_day date, p_next_due date)
returns void
language plpgsql security invoker set search_path = public
as $$
declare t tasks;
begin
  select * into t from tasks where id = p_task_id and repeat is not null and completed_at is null;
  if not found then raise exception 'task not found'; end if;
  if p_next_due is null or p_next_due <= t.due_date then raise exception 'invalid next due date'; end if;

  insert into tasks (project_id, title, note, priority, due_date, due_time, end_date, end_time, completed_at, completed_day, recurring_copy, tags)
  values (t.project_id, t.title, t.note, t.priority, t.due_date, t.due_time, t.end_date, t.end_time, p_completed_at, p_completed_day, true, t.tags);

  update tasks set due_date = p_next_due, end_date = p_next_due + (end_date - due_date) where id = p_task_id;
  update subtasks set done = false, start_date = start_date + (p_next_due - t.due_date), end_date = end_date + (p_next_due - t.due_date)
  where task_id = p_task_id;
end $$;

-- Move every overdue open task (its last day before p_today) to start on p_today, in one transaction.
-- The end and the subtasks move by the same number of days, so spans and subtask bounds stay valid.
-- p_today comes from the device: "today" is the local day, not the server's.
create function reschedule_overdue(p_today date)
returns int
language plpgsql security invoker set search_path = public
as $$
declare n int;
begin
  -- Data-modifying CTEs always run, so the subtask update happens even though nothing reads `subs`.
  with moved as (
    select id, p_today - due_date as delta from tasks
    where completed_at is null and coalesce(end_date, due_date) < p_today
  ), upd as (
    update tasks t set due_date = t.due_date + m.delta, end_date = t.end_date + m.delta from moved m where t.id = m.id returning t.id
  ), subs as (
    update subtasks s set start_date = s.start_date + m.delta, end_date = s.end_date + m.delta from moved m where s.task_id = m.id
  )
  select count(*) into n from upd;
  return n;
end $$;

-- A free note per day in the journal, beside the done tasks and the report.
create table journal_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  body text not null check (char_length(body) <= 20000),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

alter table journal_notes enable row level security;
create policy "own rows" on journal_notes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter publication supabase_realtime add table journal_notes;
