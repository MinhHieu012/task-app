import { QuickAdd } from '@/components/QuickAdd';
import { TaskGroup } from '@/components/TaskRow';
import { ScrollView, View } from 'react-native';

import { Screen, useWide } from '@/components/ui';
import { addDays, fmtDay, fromIso, today } from '@/lib/dates';
import { type Project, type Task, useRows } from '@/lib/supabase';

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export default function Upcoming() {
  const day = today();
  const days = Array.from({ length: 7 }, (_, i) => addDays(day, i + 1));
  const [open] = useRows<Task>(
    'tasks',
    (q) => q.is('completed_at', null).gt('due_date', day).lte('due_date', days[6]).order('due_time', { nullsFirst: false }).order('priority'),
    day,
  );
  const [projects] = useRows<Project>('projects');
  const wide = useWide();
  const groups = days.map((d, i) => (
    <View key={d} style={wide ? { width: 260 } : undefined}>
      <TaskGroup
        title={`${i === 0 ? 'Ngày mai' : DAYS[fromIso(d).getDay()]} · ${fmtDay(d)}`}
        tasks={open.filter((t) => t.due_date === d)}
        projects={projects}
        hideDate
        empty="Trống"
      />
    </View>
  ));

  return (
    <Screen title="Sắp tới" sub="7 ngày tới" maxWidth={100000} footer={<QuickAdd placeholder="Thêm vào Hộp thư…" />}>
      {/* Wide screens: one column per day, side by side. */}
      {wide ? <ScrollView horizontal contentContainerStyle={{ gap: 12, alignItems: 'flex-start' }}>{groups}</ScrollView> : groups}
    </Screen>
  );
}
