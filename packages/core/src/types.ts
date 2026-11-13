export type Project = { id: string; name: string; created_at: string };
export type Task = {
  id: string;
  project_id: string | null;
  title: string; // plain, one line: lists, toasts, reports, search
  title_html: string | null; // the same title formatted, for the editor (see titleHtml)
  note: string | null; // HTML (older rows: plain text)
  priority: number;
  due_date: string | null;
  due_time: string | null; // start time
  end_date: string | null;
  end_time: string | null;
  repeat: string | null;
  completed_at: string | null;
  completed_day: string | null;
  recurring_copy: boolean;
  tags: string[]; // lowercase, without '#'
  created_at: string;
};
export type Report = {
  id: string;
  day: string;
  content: string; // HTML
  body: string; // plain text, for search
  late: boolean;
  done_count: number;
  missed_count: number;
  submitted_at: string;
  updated_at: string;
};
export type JournalNote = { id: string; day: string; body: string; updated_at: string };
export type Subtask = { id: string; task_id: string; title: string; title_html: string | null; done: boolean; start_date: string | null; start_time: string | null; end_date: string | null; end_time: string | null; created_at: string };
