-- Subtasks get days too: start = start_date + start_time, end = end_date + end_time, like tasks.
-- Fitting inside the parent's span is checked in the app (src/lib/subtasks.ts), not here.
alter table subtasks
  add column if not exists start_date date,
  add column if not exists end_date date;

-- Replace the time-only check from 20261106010000_subtask_times.
do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'subtasks'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%end_time%' loop
    execute format('alter table subtasks drop constraint %I', c);
  end loop;
end $$;

alter table subtasks
  add check (start_time is null or start_date is not null),
  add check (end_time is null or end_date is not null),
  add check (end_date is null or (start_date is not null and end_date >= start_date)),
  add check (end_time is null or start_time is null or (end_date, end_time) > (start_date, start_time));

-- A recurring tick moves the checklist with the task and unticks it for the next round.
create or replace function complete_recurring(p_task_id uuid, p_completed_at timestamptz, p_completed_day date, p_next_due date)
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
  update subtasks set done = false, start_date = start_date + (p_next_due - t.due_date), end_date = end_date + (p_next_due - t.due_date)
  where task_id = p_task_id;
end $$;
