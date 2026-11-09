import { router, useLocalSearchParams } from 'expo-router';
import { useContext, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { focusQuickAdd, QuickAdd } from '@/components/QuickAdd';
import { endDay, groupByDue, TaskGroup } from '@/components/TaskRow';
import { Button, Empty, EmptyState, Field, InfoLine, Screen, useWide } from '@/components/ui';
import { color, projectColor, rule, text } from '@/constants/theme';
import { addDays, fmtDay, today } from '@/lib/dates';
import { tr } from '@/lib/i18n';
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
    if (!(await confirmAction(tr('Xoá project “{name}”?', { name: project.name }), tr('Các việc trong project sẽ chuyển về Hộp thư.'), tr('Xoá project')))) return;
    if (ok(await supabase.from('projects').delete().eq('id', id))) router.back();
  };

  const byDue = groupByDue(open, day);
  const groups: [string, Task[]][] = [...byDue, [tr('Đã xong'), done]];
  const count = (title: string) => byDue.find(([t]) => t === title)?.[1].length ?? 0;
  const total = open.length + done.length;
  const pct = total ? Math.round((done.length / total) * 100) : 0;
  const upcoming = open.filter((t) => t.due_date && endDay(t)! >= day).slice(0, 5);
  const removeButton = project && <Button title={tr('Xoá project')} icon="trash-outline" variant="danger" onPress={remove} />;

  const aside = (
    <>
      <View>
        <Text style={s.title}>{tr('Tiến độ tuần này')}</Text>
        <View style={s.pctRow}>
          <Text style={s.pct}>{pct}%</Text>
          <Text style={s.meta}>{tr('{done}/{total} việc đã xong', { done: done.length, total })}</Text>
        </View>
        <View style={s.track}>
          <View style={[s.fill, { width: `${pct}%`, backgroundColor: projectColor(Math.max(index, 0)) }]} />
        </View>
      </View>
      <View>
        <Text style={s.title}>{tr('Theo hạn')}</Text>
        <InfoLine icon="alert-circle-outline" label={tr('Quá hạn')} n={count(tr('Quá hạn'))} tone={count(tr('Quá hạn')) ? color.danger : undefined} />
        <InfoLine icon="sunny-outline" label={tr('Hôm nay')} n={count(tr('Hôm nay'))} />
        <InfoLine icon="calendar-outline" label={tr('Sắp tới')} n={count(tr('Sắp tới'))} />
        <InfoLine icon="help-circle-outline" label={tr('Chưa hẹn ngày')} n={count(tr('Chưa hẹn'))} last />
      </View>
      <View>
        <Text style={s.title}>{tr('Hạn sắp tới')}</Text>
        {upcoming.map((t, i) => (
          <View key={t.id} style={[s.next, i === upcoming.length - 1 && { borderBottomWidth: 0 }]}>
            <Text style={s.nextTitle} numberOfLines={1}>{t.title}</Text>
            <Text style={s.nextDate}>{t.due_date === day ? tr('Hôm nay') : fmtDay(t.due_date!)}</Text>
          </View>
        ))}
        {!upcoming.length && <Empty>{tr('Không có việc nào sắp đến hạn.')}</Empty>}
      </View>
      <View style={s.danger}>{removeButton}</View>
    </>
  );

  return (
    <Screen
      back
      title={project?.name ?? ''}
      sub={loaded ? tr('{open} việc đang mở, {done} đã xong tuần này', { open: open.length, done: done.length }) : undefined}
      footer={<QuickAdd defaults={{ project_id: id }} placeholder={tr('Thêm việc vào {name}…', { name: project?.name ?? 'project' })} />}
      aside={sel?.id ? undefined : aside}
      maxWidth={100000}
      right={
        project && name === null && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title={tr('Đổi tên')} icon="create-outline" onPress={() => setName(project.name)} />
            <Button title={tr('Thêm việc')} icon="add" variant="primary" onPress={focusQuickAdd} />
          </View>
        )
      }
    >
      {name !== null && (
        <Field
          label={tr('Tên project')}
          value={name}
          onChangeText={setName}
          onSubmitEditing={rename}
          autoFocus
          right={
            <>
              <Button title={tr('Huỷ')} onPress={() => setName(null)} />
              <Button title={tr('Lưu')} variant="primary" onPress={rename} />
            </>
          }
        />
      )}
      {!loaded ? (
        <TaskGroup title={tr('Việc')} tasks={[]} loading />
      ) : !open.length && !done.length ? (
        <EmptyState icon="folder-open-outline" title={tr('Project này chưa có việc')} action={<Button title={tr('Thêm việc')} icon="add" variant="primary" onPress={focusQuickAdd} />}>
          {tr('Thêm việc đầu tiên, hoặc chuyển việc từ Hộp thư vào đây.')}
        </EmptyState>
      ) : (
        <View style={{ gap: 28 }}>
          {groups.filter(([, list]) => list.length).map(([title, list]) => (
            <TaskGroup key={title} title={title} tasks={list} over={title === tr('Quá hạn')} />
          ))}
        </View>
      )}
      {/* Wide: the delete button lives at the bottom of the side panel. */}
      {(!wide || sel?.id) && removeButton && <View style={{ alignItems: 'flex-start' }}>{removeButton}</View>}
    </Screen>
  );
}

const s = StyleSheet.create({
  // Aside heads sit on a light firm rule; the lines under them are hairlines.
  title: { ...text.h2, color: color.foreground, paddingBottom: 10, marginBottom: 4, borderBottomWidth: rule.bar, borderBottomColor: color.borderStrong },
  pctRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8, marginBottom: 10 },
  pct: { ...text.h1, fontSize: 40, lineHeight: 44, letterSpacing: -1.2, color: color.foreground, fontVariant: ['tabular-nums'] },
  meta: { ...text.meta, color: color.muted, fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, backgroundColor: color.secondary, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: rule.hair, borderBottomColor: color.border },
  nextTitle: { ...text.sm, flex: 1, color: color.foreground },
  nextDate: { ...text.meta, fontWeight: '500', color: color.soft, fontVariant: ['tabular-nums'] },
  danger: { alignItems: 'flex-start', paddingTop: 20, borderTopWidth: rule.hair, borderTopColor: color.border },
});
