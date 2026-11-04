import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, ListRow, Meta, Tick } from '@/components/ui';
import { color, type Priority, text } from '@/constants/theme';
import { addDays, fmtDay, localDay, nextDue, today } from '@/lib/dates';
import { ok, type Project, supabase, type Task } from '@/lib/supabase';

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export function repeatLabel(repeat: string) {
  const [kind, arg] = repeat.split(':');
  if (kind === 'daily') return 'Hằng ngày';
  if (kind === 'weekly') return arg.split(',').map((d) => DAYS[Number(d)]).join(', ');
  if (kind === 'monthly') return `Ngày ${arg} hằng tháng`;
  return `Mỗi ${arg} ngày`;
}

/** Tick, untick (KTD5). Returns true on success. */
export async function toggleDone(t: Task) {
  const tasks = supabase.from('tasks');
  if (t.completed_at) {
    return t.recurring_copy
      ? ok(await tasks.delete().eq('id', t.id))
      : ok(await tasks.update({ completed_at: null, completed_day: null }).eq('id', t.id));
  }
  const now = new Date();
  const done = { completed_at: now.toISOString(), completed_day: localDay(now) };
  if (t.repeat && t.due_date) {
    return ok(await supabase.rpc('complete_recurring', {
      p_task_id: t.id, p_completed_at: done.completed_at, p_completed_day: done.completed_day, p_next_due: nextDue(t.repeat, t.due_date),
    }));
  }
  return ok(await tasks.update(done).eq('id', t.id));
}

function dueMeta(t: Task) {
  if (!t.due_date) return null;
  const day = today();
  const time = t.due_time?.slice(0, 5);
  if (t.due_date < day) return <Meta tone="over">{t.due_date === addDays(day, -1) ? 'Hôm qua' : fmtDay(t.due_date)}</Meta>;
  if (t.due_date === day) return <Meta tone="today">{time ? `Hôm nay ${time}` : 'Hôm nay'}</Meta>;
  return <Meta>{[t.due_date === addDays(day, 1) ? 'Ngày mai' : fmtDay(t.due_date), time].filter(Boolean).join(' ')}</Meta>;
}

export function TaskRow({ task, project, hideDate }: { task: Task; project?: string; hideDate?: boolean }) {
  const [busy, setBusy] = useState(false);
  const done = !!task.completed_at;
  const parts = [
    !done && !hideDate && dueMeta(task),
    hideDate && task.due_time && <Meta>{task.due_time.slice(0, 5)}</Meta>,
    // Journal entries: local time of completion; a recurring copy shows just the repeat icon.
    done && <Meta>{new Date(task.completed_at!).toTimeString().slice(0, 5)}</Meta>,
    (task.repeat || task.recurring_copy) && (
      <View style={s.rep}>
        <Ionicons name="repeat" size={12} color={color.muted} />
        {!done && task.repeat && <Meta>{repeatLabel(task.repeat)}</Meta>}
      </View>
    ),
    project && <Meta>{project}</Meta>,
  ].filter(Boolean);

  return (
    <ListRow
      title={task.title}
      onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
      left={
        <Tick
          priority={task.priority as Priority}
          checked={done}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            await toggleDone(task);
            setBusy(false);
          }}
        />
      }
      meta={parts.length ? parts.map((p, i) => <View key={i} style={s.rep}>{i > 0 && <Meta>· </Meta>}{p}</View>) : undefined}
    />
  );
}

/** A card of task rows with a small heading and count; amber for overdue. */
export function TaskGroup({ title, tasks, projects, over, hideDate, empty }: {
  title: string; tasks: Task[]; projects: Project[]; over?: boolean; hideDate?: boolean; empty?: string;
}) {
  const names = new Map(projects.map((p) => [p.id, p.name]));
  return (
    <Card
      flush
      title={
        <Text style={[s.title, over && { color: color.warning }]}>
          {title} <Text style={s.count}>{tasks.length || ''}</Text>
        </Text>
      }
    >
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} project={t.project_id ? names.get(t.project_id) : undefined} hideDate={hideDate} />
      ))}
      {!tasks.length && empty && <Text style={s.empty}>{empty}</Text>}
    </Card>
  );
}

const s = StyleSheet.create({
  rep: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  title: { ...text.smMedium, fontWeight: '600', color: color.foreground },
  count: { fontWeight: '400', color: color.muted },
  empty: { ...text.sm, color: color.muted, paddingHorizontal: 12, paddingBottom: 8 },
});
