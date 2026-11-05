-- Start = due_date + due_time; end = end_date + end_time, may fall on a later day but must be after the start.
alter table tasks add column if not exists end_date date;
alter table tasks add column if not exists end_time time;

-- Drop the earlier same-day end_time check if it was applied by hand.
do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'tasks'::regclass and pg_get_constraintdef(oid) like '%end_time%' loop
    execute format('alter table tasks drop constraint %I', c);
  end loop;
end $$;

update tasks set end_date = due_date where end_time is not null and end_date is null;

alter table tasks
  add check ((end_date is null) = (end_time is null)),
  add check (end_time is null or (due_time is not null and (end_date, end_time) > (due_date, due_time)));

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
end $$;
