-- Move open tasks to new start days, one day per task, in one transaction: snooze one task ("Mai", "Tuần sau"),
-- move every overdue task to today, and undo either (each task back to its own old day).
-- The end and the subtasks move by the same number of days, so spans and subtask bounds stay valid.
-- Replaces reschedule_overdue, which could only move to one day and so could not be undone.
create function move_tasks(p_ids uuid[], p_days date[])
returns int
language plpgsql security invoker set search_path = public
as $$
declare n int;
begin
  -- Data-modifying CTEs always run, so the subtask update happens even though nothing reads `subs`.
  with m as (
    select t.id, d.day - t.due_date as delta
    from unnest(p_ids, p_days) as d(id, day) join tasks t on t.id = d.id
    where t.completed_at is null and t.due_date is not null and d.day is not null
  ), upd as (
    update tasks t set due_date = t.due_date + m.delta, end_date = t.end_date + m.delta from m where t.id = m.id returning t.id
  ), subs as (
    update subtasks s set start_date = s.start_date + m.delta, end_date = s.end_date + m.delta from m where s.task_id = m.id
  )
  select count(*) into n from upd;
  return n;
end $$;

drop function reschedule_overdue(date);
