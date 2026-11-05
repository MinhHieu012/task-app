import { router } from 'expo-router';
import { useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { focusQuickAdd, QuickAdd } from '@/components/QuickAdd';
import { endDay, groupByDue, TaskGroup } from '@/components/TaskRow';
import { active, Button, Empty, EmptyState, InfoLine, Screen, TextLink } from '@/components/ui';
import { color, projectColor, radius, text } from '@/constants/theme';
import { today } from '@/lib/dates';
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
        <Text style={s.title}>Tổng quan</Text>
        <InfoLine icon="file-tray-outline" label="Trong Hộp thư" n={open.length} />
        <InfoLine icon="alert-circle-outline" label="Quá hạn" n={over} tone={over ? color.danger : undefined} />
        <InfoLine icon="sunny-outline" label="Có hạn hôm nay" n={dueToday} />
        <InfoLine icon="help-circle-outline" label="Chưa hẹn ngày" n={undated} last />
      </View>
      <View>
        <View style={s.head}>
          <Text style={[s.title, { marginBottom: 0 }]}>Project</Text>
          <TextLink label="Quản lý" onPress={() => router.navigate('/projects')} />
        </View>
        <Text style={s.hint}>Bấm một việc rồi chọn project trong panel để chuyển việc ra khỏi Hộp thư.</Text>
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
        {!projects.length && <Empty>Chưa có project nào.</Empty>}
      </View>
    </>
  );

  return (
    <Screen
      title="Hộp thư"
      sub={`Việc chưa thuộc project nào${loaded ? ` · ${open.length} việc` : ''}`}
      footer={<QuickAdd placeholder="Thêm vào Hộp thư…" />}
      aside={sel?.id ? undefined : aside}
      maxWidth={100000}
    >
      {!loaded ? (
        <TaskGroup title="Việc" tasks={[]} loading />
      ) : !open.length ? (
        <EmptyState icon="file-tray-outline" title="Hộp thư trống" action={<Button title="Thêm việc" icon="add" variant="primary" onPress={focusQuickAdd} />}>
          Việc thêm nhanh mà chưa chọn project sẽ nằm ở đây cho tới khi bạn xếp nó vào project.
        </EmptyState>
      ) : (
        <View style={{ gap: 28 }}>
          {groupByDue(open, day).map(([title, list]) => (
            <TaskGroup key={title} title={title} tasks={list} over={title === 'Quá hạn'} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  title: { ...text.h2, color: color.foreground, marginBottom: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  hint: { ...text.meta, color: color.muted, marginBottom: 12 },
  project: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 40, paddingHorizontal: 10, marginHorizontal: -10, borderRadius: radius.md },
  dot: { width: 10, height: 10, borderRadius: 3 },
  projectName: { ...text.sm, flex: 1, color: color.foreground },
  count: { ...text.xs, color: color.muted, fontVariant: ['tabular-nums'] },
});
