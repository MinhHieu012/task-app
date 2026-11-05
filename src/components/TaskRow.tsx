import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useContext, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, ListRow, Meta, Tick } from '@/components/ui';
import { color, priority as pColor, type Priority, text } from '@/constants/theme';
import { addDays, fmtDay, localDay, nextDue, today } from '@/lib/dates';
import { Selection } from '@/lib/selection';
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

function dayName(d: string) {
  const day = today();
  if (d === day) return 'Hôm nay';
  if (d === addDays(day, -1)) return 'Hôm qua';
  if (d === addDays(day, 1)) return 'Ngày mai';
  return fmtDay(d);
}

/** Last day a task is open: its end day, or its start day when it has no end. */
export const endDay = (t: Task) => t.end_date ?? t.due_date;

/** "09:00", "09:00–10:30", or "22:00 – Ngày mai 02:00" when the end is on another day. */
const timeRange = (t: Task) => {
  if (!t.due_time) return '';
  const start = t.due_time.slice(0, 5);
  if (!t.end_time) return start;
  const end = t.end_time.slice(0, 5);
  return t.end_date === t.due_date ? `${start}–${end}` : `${start} – ${dayName(t.end_date!)} ${end}`;
};

function dueMeta(t: Task) {
  if (!t.due_date) return null;
  const day = today();
  const label = [dayName(t.due_date), timeRange(t)].filter(Boolean).join(' ');
  if (endDay(t)! < day) return <Meta tone="over">{label}</Meta>;
  return <Meta tone={t.due_date <= day ? 'today' : undefined}>{label}</Meta>;
}

export function TaskRow({ task, project, hideDate }: { task: Task; project?: string; hideDate?: boolean }) {
  const [busy, setBusy] = useState(false);
  const sel = useContext(Selection);
  const done = !!task.completed_at;
  const parts = [
    !done && !hideDate && dueMeta(task),
    hideDate && task.due_time && <Meta>{timeRange(task)}</Meta>,
    // Journal entries: local time of completion; a recurring copy shows just the repeat icon.
    done && <Meta>{new Date(task.completed_at!).toTimeString().slice(0, 5)}</Meta>,
    (task.repeat || task.recurring_copy) && (
      <View style={s.rep}>
        <Ionicons name="repeat" size={12} color={color.muted} />
        {!done && task.repeat && <Meta>{repeatLabel(task.repeat)}</Meta>}
      </View>
    ),
    project && <Meta>{project}</Meta>,
    // Level 4 is the default ("no priority"), so only 1-3 get a label.
    task.priority < 4 && <Text style={[text.xs, { color: pColor[task.priority as Priority], fontWeight: '500' }]}>Mức {task.priority}</Text>,
  ].filter(Boolean);

  return (
    <ListRow
      title={task.title}
      note={task.note}
      selected={sel?.id === task.id}
      onPress={() => (sel ? sel.select(task.id) : router.push({ pathname: '/task/[id]', params: { id: task.id } }))}
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
