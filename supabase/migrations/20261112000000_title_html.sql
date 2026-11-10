-- Formatted titles. `title` stays the plain one-line text every list, toast, report and search reads;
-- `title_html` is only what the editor opens (ignored by the app once it no longer matches `title`).
-- tasks.note now holds HTML too (older rows stay plain text; the app reads both).
alter table tasks add column title_html text;
alter table subtasks add column title_html text;

-- The journal copy of a recurring tick keeps the formatting.
create or replace function complete_recurring(p_task_id uuid, p_completed_at timestamptz, p_completed_day date, p_next_due date)
returns void
language plpgsql security invoker set search_path = public
as $$
declare t tasks;
begin
  select * into t from tasks where id = p_task_id and repeat is not null and completed_at is null;
  if not found then raise exception 'task not found'; end if;
  if p_next_due is null or p_next_due <= t.due_date then raise exception 'invalid next due date'; end if;

  insert into tasks (project_id, title, title_html, note, priority, due_date, due_time, end_date, end_time, completed_at, completed_day, recurring_copy, tags)
  values (t.project_id, t.title, t.title_html, t.note, t.priority, t.due_date, t.due_time, t.end_date, t.end_time, p_completed_at, p_completed_day, true, t.tags);

  -- The end moves with the start, keeping the same span.
  update tasks set due_date = p_next_due, end_date = p_next_due + (end_date - due_date) where id = p_task_id;
  -- The checklist moves with the task and starts the next round unticked.
  update subtasks set done = false, start_date = start_date + (p_next_due - t.due_date), end_date = end_date + (p_next_due - t.due_date)
  where task_id = p_task_id;
end $$;
