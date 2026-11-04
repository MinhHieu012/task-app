export type Project = { id: string; name: string; created_at: string };
export type Task = {
  id: string;
  project_id: string | null;
  title: string;
  note: string | null;
  priority: number;
  due_date: string | null;
  due_time: string | null;
  repeat: string | null;
  completed_at: string | null;
  completed_day: string | null;
  recurring_copy: boolean;
  created_at: string;
};
