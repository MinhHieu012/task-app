import { router } from 'expo-router';
import { useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { focusQuickAdd, QuickAdd } from '@/components/QuickAdd';
import { endDay, groupByDue, TaskGroup } from '@/components/TaskRow';
import { active, Button, Empty, EmptyState, InfoLine, Screen, TextLink } from '@/components/ui';
import { color, projectColor, rule, text } from '@/constants/theme';
import { today } from '@/lib/dates';
import { tr } from '@/lib/i18n';
import { Selection } from '@/lib/selection';
import { type Project, type Task, useRows } from '@/lib/supabase';

export default function Inbox() {
  const day = today();
  const sel = useContext(Selection);
  const [open, , loaded] = useRows<Task>('tasks', (q) =>
    q.is('completed_at', null).is('project_id', null).order('due_date', { nullsFirst: false }).order('due_time', { nullsFirst: false }).order('priority').order('created_at'),
  );
  const [projects] = useRows<Project>('projects', (q) => q.order('name'));
  const [inProjects] = useRows<Task>('tasks', (q) => q.is('completed_at', null).not('project_id', 'is', null), 'inbox-side');
  const over = open.filter((t) => t.due_date && endDay(t)! < day).length;
  const dueToday = open.filter((t) => t.due_date && t.due_date <= day && endDay(t)! >= day).length;
  const undated = open.filter((t) => !t.due_date).length;

  const aside = (
    <>
      <View>
        <View style={s.head}><Text style={s.title}>{tr('Tổng quan')}</Text></View>
        <InfoLine icon="file-tray-outline" label={tr('Trong Hộp thư')} n={open.length} />
        <InfoLine icon="alert-circle-outline" label={tr('Quá hạn')} n={over} tone={over ? color.danger : undefined} />
        <InfoLine icon="sunny-outline" label={tr('Có hạn hôm nay')} n={dueToday} />
        <InfoLine icon="help-circle-outline" label={tr('Chưa hẹn ngày')} n={undated} last />
      </View>
      <View>
        <View style={s.head}>
          <Text style={s.title}>Project</Text>
          <TextLink label={tr('Quản lý')} onPress={() => router.navigate('/projects')} />
        </View>
        <Text style={s.hint}>{tr('Bấm một việc rồi chọn project trong panel để chuyển việc ra khỏi Hộp thư.')}</Text>
        {projects.map((p, i) => (
          <Pressable
            key={p.id}
            onPress={() => router.push({ pathname: '/project/[id]', params: { id: p.id } })}
            style={(st) => [s.project, active(st) && { backgroundColor: color.itemHover }]}
          >
            <View style={[s.dot, { backgroundColor: projectColor(i) }]} />
            <Text style={s.projectName} numberOfLines={1}>{p.name}</Text>
            <Text style={s.count}>{inProjects.filter((t) => t.project_id === p.id).length}</Text>
          </Pressable>
        ))}
        {!projects.length && <Empty>{tr('Chưa có project nào.')}</Empty>}
      </View>
    </>
  );

  return (
    <Screen
      title={tr('Hộp thư')}
      sub={tr('Việc chưa thuộc project nào') + (loaded ? tr(', {n} việc', { n: open.length }) : '')}
      footer={<QuickAdd placeholder={tr('Thêm vào Hộp thư…')} />}
      aside={sel?.id ? undefined : aside}
      maxWidth={100000}
    >
      {!loaded ? (
        <TaskGroup title={tr('Việc')} tasks={[]} loading />
      ) : !open.length ? (
        <EmptyState icon="file-tray-outline" title={tr('Hộp thư trống')} action={<Button title={tr('Thêm việc')} icon="add" variant="primary" onPress={focusQuickAdd} />}>
          {tr('Việc thêm nhanh mà chưa chọn project sẽ nằm ở đây cho tới khi bạn xếp nó vào project.')}
        </EmptyState>
      ) : (
        <View style={{ gap: 28 }}>
          {groupByDue(open, day).map(([title, list]) => (
            <TaskGroup key={title} title={title} tasks={list} over={title === tr('Quá hạn')} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { ...text.h2, color: color.foreground },
  // Aside heads sit on a light firm rule; the lines under them are hairlines.
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: 10, marginBottom: 4, borderBottomWidth: rule.bar, borderBottomColor: color.borderStrong },
  hint: { ...text.meta, color: color.muted, marginTop: 6, marginBottom: 8 },
  project: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 40, borderBottomWidth: rule.hair, borderBottomColor: color.border },
  dot: { width: 10, height: 10, borderRadius: 5 },
  projectName: { ...text.sm, flex: 1, color: color.foreground },
  count: { ...text.meta, color: color.muted, fontVariant: ['tabular-nums'] },
});
