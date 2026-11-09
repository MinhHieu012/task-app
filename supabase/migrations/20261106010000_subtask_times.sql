-- Start/end time of a subtask, on the parent task's day(s); the end needs a start and must come after it.
alter table subtasks
  add column start_time time,
  add column end_time time,
  add check (end_time is null or (start_time is not null and end_time > start_time));
