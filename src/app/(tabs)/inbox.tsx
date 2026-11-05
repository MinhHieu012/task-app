import { QuickAdd } from '@/components/QuickAdd';
import { TaskGroup } from '@/components/TaskRow';
import { Screen } from '@/components/ui';
import { type Task, useRows } from '@/lib/supabase';

export default function Inbox() {
  const [open, , loaded] = useRows<Task>('tasks', (q) =>
    q.is('completed_at', null).is('project_id', null).order('due_date', { nullsFirst: false }).order('priority').order('created_at'),
  );

  return (
    <Screen title="Hộp thư" sub="Việc chưa thuộc project nào" footer={<QuickAdd />}>
      {loaded && <TaskGroup title="Việc" tasks={open} projects={[]} empty="Hộp thư trống." />}
    </Screen>
  );
}
