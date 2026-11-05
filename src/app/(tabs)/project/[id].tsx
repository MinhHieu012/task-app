import { router, useLocalSearchParams } from 'expo-router';
import { useContext, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { focusQuickAdd, QuickAdd } from '@/components/QuickAdd';
import { endDay, groupByDue, TaskGroup } from '@/components/TaskRow';
import { Button, Empty, EmptyState, Field, InfoLine, Screen, useWide } from '@/components/ui';
import { color, projectColor, text } from '@/constants/theme';
import { addDays, fmtDay, today } from '@/lib/dates';
import { confirmAction } from '@/lib/notify';
import { Selection } from '@/lib/selection';
import { ok, type Project, supabase, type Task, useRows } from '@/lib/supabase';

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const day = today();
  const weekAgo = addDays(day, -6);
  const wide = useWide();
  const sel = useContext(Selection);
  const [projects] = useRows<Project>('projects', (q) => q.order('name'));
  const [open, , loaded] = useRows<Task>(
    'tasks',
    (q) => q.is('completed_at', null).eq('project_id', id).order('due_date', { nullsFirst: false }).order('due_time', { nullsFirst: false }).order('priority'),
    id,
  );
  const [done] = useRows<Task>('tasks', (q) => q.eq('project_id', id).gte('completed_day', weekAgo).order('completed_at', { ascending: false }), `done:${id}:${day}`);
  const index = projects.findIndex((p) => p.id === id);
  const project = projects[index];
  const [name, setName] = useState<string | null>(null); // non-null while renaming

  const rename = async () => {
    if (!name?.trim()) return;
    if (ok(await supabase.from('projects').update({ name: name.trim() }).eq('id', id))) setName(null);
  };
  const remove = async () => {
    if (!(await confirmAction(`Xoá project “${project.name}”?`, 'Các việc trong project sẽ chuyển về Hộp thư.', 'Xoá project'))) return;
    if (ok(await supabase.from('projects').delete().eq('id', id))) router.back();
  };

  const byDue = groupByDue(open, day);
  const groups: [string, Task[]][] = [...byDue, ['Đã xong', done]];
  const count = (title: string) => byDue.find(([t]) => t === title)?.[1].length ?? 0;
  const total = open.length + done.length;
  const pct = total ? Math.round((done.length / total) * 100) : 0;
  const upcoming = open.filter((t) => t.due_date && endDay(t)! >= day).slice(0, 5);
  const removeButton = project && <Button title="Xoá project" icon="trash-outline" variant="danger" onPress={remove} />;

  const aside = (
    <>
      <View>
        <Text style={s.title}>Tiến độ tuần này</Text>
        <View style={s.pctRow}>
          <Text style={s.pct}>{pct}%</Text>
          <Text style={s.meta}>{done.length}/{total} việc đã xong</Text>
        </View>
        <View style={s.track}>
          <View style={[s.fill, { width: `${pct}%`, backgroundColor: projectColor(Math.max(index, 0)) }]} />
        </View>
      </View>
      <View>
        <Text style={s.title}>Theo hạn</Text>
        <InfoLine icon="alert-circle-outline" label="Quá hạn" n={count('Quá hạn')} tone={count('Quá hạn') ? color.danger : undefined} />
        <InfoLine icon="sunny-outline" label="Hôm nay" n={count('Hôm nay')} />
        <InfoLine icon="calendar-outline" label="Sắp tới" n={count('Sắp tới')} />
        <InfoLine icon="help-circle-outline" label="Chưa hẹn ngày" n={count('Chưa hẹn')} last />
      </View>
      <View>
        <Text style={s.title}>Hạn sắp tới</Text>
        {upcoming.map((t, i) => (
          <View key={t.id} style={[s.next, i === upcoming.length - 1 && { borderBottomWidth: 0 }]}>
            <Text style={s.nextTitle} numberOfLines={1}>{t.title}</Text>
            <Text style={s.nextDate}>{t.due_date === day ? 'Hôm nay' : fmtDay(t.due_date!)}</Text>
          </View>
        ))}
        {!upcoming.length && <Empty>Không có việc nào sắp đến hạn.</Empty>}
      </View>
      <View style={s.danger}>{removeButton}</View>
    </>
  );

  return (
    <Screen
      back
      title={project?.name ?? ''}
      sub={loaded ? `${open.length} việc đang mở · ${done.length} đã xong tuần này` : undefined}
      footer={<QuickAdd defaults={{ project_id: id }} placeholder={`Thêm việc vào ${project?.name ?? 'project'}…`} />}
      aside={sel?.id ? undefined : aside}
      maxWidth={100000}
      right={
        project && name === null && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Đổi tên" icon="create-outline" onPress={() => setName(project.name)} />
            <Button title="Thêm việc" icon="add" variant="primary" onPress={focusQuickAdd} />
          </View>
        )
      }
    >
      {name !== null && (
        <Field
          label="Tên project"
          value={name}
          onChangeText={setName}
          onSubmitEditing={rename}
          autoFocus
          right={
            <>
              <Button title="Huỷ" onPress={() => setName(null)} />
              <Button title="Lưu" variant="primary" onPress={rename} />
            </>
          }
        />
      )}
      {!loaded ? (
        <TaskGroup title="Việc" tasks={[]} loading />
      ) : !open.length && !done.length ? (
        <EmptyState icon="folder-open-outline" title="Project này chưa có việc" action={<Button title="Thêm việc" icon="add" variant="primary" onPress={focusQuickAdd} />}>
          Thêm việc đầu tiên, hoặc chuyển việc từ Hộp thư vào đây.
        </EmptyState>
      ) : (
        <View style={{ gap: 28 }}>
          {groups.filter(([, list]) => list.length).map(([title, list]) => (
            <TaskGroup key={title} title={title} tasks={list} over={title === 'Quá hạn'} />
          ))}
        </View>
      )}
      {/* Wide: the delete button lives at the bottom of the side panel. */}
      {(!wide || sel?.id) && removeButton && <View style={{ alignItems: 'flex-start' }}>{removeButton}</View>}
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { ...text.h2, color: color.foreground, marginBottom: 8 },
  pctRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  pct: { ...text.h1, color: color.foreground },
  meta: { ...text.meta, color: color.muted },
  track: { height: 8, borderRadius: 4, backgroundColor: color.background, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: color.border },
  nextTitle: { ...text.sm, flex: 1, color: color.foreground },
  nextDate: { ...text.meta, fontWeight: '500', color: color.soft },
  danger: { alignItems: 'flex-start', paddingTop: 20, borderTopWidth: 1, borderTopColor: color.border },
});
