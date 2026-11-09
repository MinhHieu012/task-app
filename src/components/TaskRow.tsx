import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { type ComponentProps, useContext, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { active, Empty, FadeIn, GroupTitle, PriorityTag, Skeleton, Tick, useWide } from '@/components/ui';
import { color, type Priority, radius, text } from '@/constants/theme';
import { addDays, fmtDay, fromIso, localDay, nextDue, today } from '@/lib/dates';
import { Selection } from '@/lib/selection';
import { ok, type Project, type Subtask, supabase, type Task, useRows } from '@/lib/supabase';

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

/** Open tasks split by deadline, overdue first; empty groups dropped. */
export function groupByDue(open: Task[], day = today()) {
  const groups: [string, Task[]][] = [
    ['Quá hạn', open.filter((t) => t.due_date && endDay(t)! < day)],
    ['Hôm nay', open.filter((t) => t.due_date && t.due_date <= day && endDay(t)! >= day)],
    ['Sắp tới', open.filter((t) => t.due_date && t.due_date > day)],
    ['Chưa hẹn', open.filter((t) => !t.due_date)],
  ];
  return groups.filter(([, list]) => list.length);
}

/** Whole days between two ISO days. */
const daysBetween = (from: string, to: string) => Math.round((fromIso(to).getTime() - fromIso(from).getTime()) / 86_400_000);

/** "09:00", "09:00–10:30", or "22:00 – Ngày mai 02:00" when the end is on another day. */
const timeRange = (t: Task) => {
  if (!t.due_time) return '';
  const start = t.due_time.slice(0, 5);
  if (!t.end_time || t.end_time.startsWith('23:59')) return start; // quick add ends at 23:59: just "from now"
  const end = t.end_time.slice(0, 5);
  return t.end_date === t.due_date ? `${start}–${end}` : `${start} – ${dayName(t.end_date!)} ${end}`;
};

type Icon = ComponentProps<typeof Ionicons>['name'];
function M({ icon, children, tone }: { icon?: Icon; children: string; tone?: 'over' }) {
  const c = tone === 'over' ? color.danger : color.muted;
  return (
    <View style={s.m}>
      {icon && <Ionicons name={icon} size={14} color={c} />}
      <Text style={[s.mText, { color: c }, tone && { fontWeight: '500' }]}>{children}</Text>
    </View>
  );
}

/** One task as a white card row (Figma "Task" row).
 *  timeCol: Today's layout, a left column with "Bắt đầu 9:00" or "Hạn 02/11 · Trễ 3 ngày".
 *  compact: narrow columns (Sắp tới), no priority tag. */
export function TaskRow({ task, project, hideDate, timeCol, compact, subs }: {
  task: Task; project?: string; hideDate?: boolean; timeCol?: boolean; compact?: boolean; subs?: string;
}) {
  const [busy, setBusy] = useState(false);
  const sel = useContext(Selection);
  const wide = useWide();
  const done = !!task.completed_at;
  const day = today();
  const last = endDay(task);
  const over = !done && !!last && last < day;
  const late = over ? `Trễ ${daysBetween(last!, day)} ngày` : '';
  const range = timeRange(task);
  const side = wide && timeCol;

  const tick = (
    <Tick
      priority={task.priority as Priority}
      checked={done}
      disabled={busy}
      size={wide ? 36 : 28}
      onPress={async () => {
        setBusy(true);
        await toggleDone(task);
        setBusy(false);
      }}
    />
  );

  const meta = [
    // Today on a phone: the time column is gone, so lateness and start move into the meta line.
    timeCol && !side && over && <M key="late" icon="alert-circle-outline" tone="over">{late}</M>,
    timeCol && !side && !over && range && <M key="start" icon="time-outline">{range}</M>,
    project !== undefined && <M key="p" icon={project ? 'folder-outline' : 'file-tray-outline'}>{project || 'Hộp thư'}</M>,
    !timeCol && !hideDate && !done && task.due_date && (
      <M key="d" icon="calendar-clear-outline" tone={over ? 'over' : undefined}>{[dayName(task.due_date), range].filter(Boolean).join(' · ')}</M>
    ),
    !timeCol && !hideDate && !done && !task.due_date && <M key="nd">Chưa có hạn</M>,
    (hideDate || side) && range && range.includes('–') && <M key="t" icon="time-outline">{range}</M>,
    hideDate && !side && range && !range.includes('–') && <M key="t1" icon="time-outline">{range}</M>,
    done && <M key="at" icon="checkmark-circle-outline">{new Date(task.completed_at!).toTimeString().slice(0, 5)}</M>,
    (task.repeat || task.recurring_copy) && <M key="r" icon="repeat-outline">{!done && task.repeat ? repeatLabel(task.repeat) : 'Lặp lại'}</M>,
    subs && <M key="s" icon="checkbox-outline">{subs}</M>,
    task.note && <M key="n" icon="document-text-outline">{task.note}</M>,
  ].filter(Boolean);

  const selected = sel?.id === task.id;
  return (
    <Pressable
      onPress={() => (sel ? sel.select(selected ? null : task.id) : router.push({ pathname: '/task/[id]', params: { id: task.id } }))}
      style={(st) => [s.row, active(st) && { borderColor: color.borderStrong }, selected && s.selected]}
    >
      {side ? (
        <View style={s.timeCol}>
          {tick}
          <View>
            {over ? (
              <>
                <Text style={s.timeL}>Hạn {fmtDay(last!)}</Text>
                <M icon="alert-circle-outline" tone="over">{late}</M>
              </>
            ) : task.due_time ? (
              <>
                <Text style={s.timeL}>Bắt đầu</Text>
                <M icon="time-outline">{task.due_time.slice(0, 5)}</M>
              </>
            ) : (
              <>
                <Text style={s.timeL}>Cả ngày</Text>
                <M>Chưa hẹn giờ</M>
              </>
            )}
          </View>
        </View>
      ) : (
        <View style={[s.tickCol, !wide && s.tickColNarrow]}>{tick}</View>
      )}
      <View style={[s.body, !wide && s.bodyNarrow, !side && { paddingLeft: wide ? 16 : 12 }]}>
        <Text style={[s.title, done && s.done]}>{task.title}</Text>
        {meta.length > 0 && <View style={s.meta}>{meta}</View>}
      </View>
      {wide && !compact && (
        <View style={s.side}>
          <PriorityTag priority={task.priority} />
        </View>
      )}
    </Pressable>
  );
}

/** Heading with count, then one card per task. Skeleton rows while loading. */
export function TaskGroup({ title, tasks, projects, over, hideDate, empty, timeCol, compact, loading }: {
  title: string; tasks: Task[]; projects?: Project[]; over?: boolean; hideDate?: boolean; empty?: string; timeCol?: boolean; compact?: boolean; loading?: boolean;
}) {
  const names = projects && new Map(projects.map((p) => [p.id, p.name]));
  // ponytail: one query + realtime channel per group; fine at a few groups per screen.
  const ids = tasks.map((t) => t.id);
  const [subtasks] = useRows<Subtask>('subtasks', (q) => q.in('task_id', ids), ids.join());
  const subs = (id: string) => {
    const mine = subtasks.filter((x) => x.task_id === id);
    return mine.length ? `${mine.filter((x) => x.done).length}/${mine.length}` : undefined;
  };
  return (
    <View>
      <GroupTitle title={title} count={loading ? 0 : tasks.length} over={over} />
      <View style={s.rows}>
        {loading
          ? [0, 1, 2].map((i) => <SkeletonRow key={i} />)
          : tasks.map((t) => (
              // Rows are keyed by id, so only rows that are new here fade in: the first load after the
              // skeleton, a task just added, or one that moved group after a tick. Refetches don't replay it.
              <FadeIn key={t.id}>
                <TaskRow
                  task={t}
                  project={names ? (t.project_id ? names.get(t.project_id) ?? '' : '') : undefined}
                  hideDate={hideDate}
                  timeCol={timeCol}
                  compact={compact}
                  subs={subs(t.id)}
                />
              </FadeIn>
            ))}
        {!loading && !tasks.length && empty && (compact ? <View style={s.emptyBox}><Empty>{empty}</Empty></View> : <Empty>{empty}</Empty>)}
      </View>
    </View>
  );
}

function SkeletonRow() {
  return (
    <View style={[s.row, { alignItems: 'center' }]}>
      <View style={s.tickCol}><Skeleton width={32} height={32} round /></View>
      <View style={[s.body, { gap: 10 }]}>
        <Skeleton width="60%" height={14} />
        <Skeleton width="30%" height={12} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  rows: { gap: 12 },
  emptyBox: { borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: color.borderStrong },
  row: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: 'transparent' },
  selected: { borderColor: color.primary, boxShadow: `0 0 0 3px ${color.ringFocus}` },
  timeCol: { width: 184, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 20, borderRightWidth: 1, borderRightColor: color.border },
  timeL: { ...text.meta, fontWeight: '500', color: color.foreground, marginBottom: 2 },
  tickCol: { paddingLeft: 20, paddingVertical: 16, justifyContent: 'center' },
  tickColNarrow: { paddingLeft: 14, paddingVertical: 14, justifyContent: 'flex-start' },
  body: { flex: 1, minWidth: 0, paddingVertical: 16, paddingHorizontal: 20, justifyContent: 'center', gap: 6 },
  bodyNarrow: { paddingVertical: 12, paddingHorizontal: 14, gap: 4 },
  title: { ...text.body, color: color.foreground },
  done: { color: color.muted, textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 14, rowGap: 4 },
  m: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  mText: { ...text.meta, flexShrink: 1 },
  side: { width: 148, paddingVertical: 16, paddingHorizontal: 20, alignItems: 'flex-end', justifyContent: 'center' },
});
