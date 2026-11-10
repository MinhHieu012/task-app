import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { type ComponentProps, useContext, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { active, Badge, Empty, FadeIn, GroupTitle, PriorityTag, Skeleton, Tick, useWide } from '@/components/ui';
import { color, type Priority, radius, rule, text } from '@/constants/theme';
import { addDays, fmtDay, fromIso, localDay, nextDue, today } from '@/lib/dates';
import { tr } from '@/lib/i18n';
import { Selection } from '@/lib/selection';
import { fmtSpan, spanLength, subStatus } from '@/lib/subtasks';
import { ok, type Project, refresh, type Subtask, supabase, type Task, useRows } from '@/lib/supabase';

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export function repeatLabel(repeat: string) {
  const [kind, arg] = repeat.split(':');
  if (kind === 'daily') return tr('Hằng ngày');
  if (kind === 'weekly') return arg.split(',').map((d) => tr(DAYS[Number(d)])).join(', ');
  if (kind === 'monthly') return tr('Ngày {d} hằng tháng', { d: arg });
  return tr('Mỗi {n} ngày', { n: arg });
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
  if (d === day) return tr('Hôm nay');
  if (d === addDays(day, -1)) return tr('Hôm qua');
  if (d === addDays(day, 1)) return tr('Ngày mai');
  return fmtDay(d);
}

/** Last day a task is open: its end day, or its start day when it has no end. */
export const endDay = (t: Task) => t.end_date ?? t.due_date;

/** Open tasks split by deadline, overdue first; empty groups dropped. */
export function groupByDue(open: Task[], day = today()) {
  const groups: [string, Task[]][] = [
    [tr('Quá hạn'), open.filter((t) => t.due_date && endDay(t)! < day)],
    [tr('Hôm nay'), open.filter((t) => t.due_date && t.due_date <= day && endDay(t)! >= day)],
    [tr('Sắp tới'), open.filter((t) => t.due_date && t.due_date > day)],
    [tr('Chưa hẹn'), open.filter((t) => !t.due_date)],
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

/** One task as a line on the group's sheet.
 *  timeCol: Today's layout, a left column with "Bắt đầu 9:00" or "Hạn 02/11" over "Trễ 3 ngày".
 *  compact: narrow columns (Sắp tới), no priority tag. */
export function TaskRow({ task, project, hideDate, timeCol, compact, subs = [] }: {
  task: Task; project?: string; hideDate?: boolean; timeCol?: boolean; compact?: boolean; subs?: Subtask[];
}) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const sel = useContext(Selection);
  const wide = useWide();
  const done = !!task.completed_at;
  const day = today();
  const last = endDay(task);
  const over = !done && !!last && last < day;
  const late = over ? tr('Trễ {n} ngày', { n: daysBetween(last!, day) }) : '';
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
    project !== undefined && <M key="p" icon={project ? 'folder-outline' : 'file-tray-outline'}>{project || tr('Hộp thư')}</M>,
    !timeCol && !hideDate && !done && task.due_date && (
      <M key="d" icon="calendar-clear-outline" tone={over ? 'over' : undefined}>{[dayName(task.due_date), range].filter(Boolean).join(', ')}</M>
    ),
    !timeCol && !hideDate && !done && !task.due_date && <M key="nd">{tr('Chưa có hạn')}</M>,
    (hideDate || side) && range && range.includes('–') && <M key="t" icon="time-outline">{range}</M>,
    hideDate && !side && range && !range.includes('–') && <M key="t1" icon="time-outline">{range}</M>,
    done && <M key="at" icon="checkmark-circle-outline">{new Date(task.completed_at!).toTimeString().slice(0, 5)}</M>,
    (task.repeat || task.recurring_copy) && <M key="r" icon="repeat-outline">{!done && task.repeat ? repeatLabel(task.repeat) : tr('Lặp lại')}</M>,
    subs.length > 0 && (
      // Its own press target inside the row: opens the subtasks under the row instead of the task.
      <Pressable
        key="s"
        onPress={() => setOpen((o) => !o)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? tr('Ẩn việc con') : tr('Xem việc con')}
        style={(st) => [s.subToggle, active(st) && { backgroundColor: color.itemHover }]}
      >
        <M icon="checkbox-outline">{`${subs.filter((x) => x.done).length}/${subs.length}`}</M>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={color.muted} />
      </Pressable>
    ),
    task.note && <M key="n" icon="document-text-outline">{task.note}</M>,
  ].filter(Boolean);

  const selected = sel?.id === task.id;
  return (
    // The whole item (row + open subtasks) is one press target, so hover and selection tint it as one block.
    <Pressable
      onPress={() => (sel ? sel.select(selected ? null : task.id) : router.push({ pathname: '/task/[id]', params: { id: task.id } }))}
      style={(st) => [s.item, active(st) && { backgroundColor: color.itemHover }, selected && s.selected]}
    >
    <View style={s.row}>
      {side ? (
        <View style={s.timeCol}>
          {tick}
          <View>
            {over ? (
              <>
                <Text style={s.timeL}>{tr('Hạn {date}', { date: fmtDay(last!) })}</Text>
                <M icon="alert-circle-outline" tone="over">{late}</M>
              </>
            ) : task.due_time ? (
              <>
                <Text style={s.timeL}>{tr('Bắt đầu')}</Text>
                <M icon="time-outline">{task.due_time.slice(0, 5)}</M>
              </>
            ) : (
              <>
                <Text style={s.timeL}>{tr('Cả ngày')}</Text>
                <M>{tr('Chưa hẹn giờ')}</M>
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
    </View>
    {open && (
      // Indented to line up with the task title.
      <FadeIn style={{ ...s.subs, marginLeft: side ? 184 + 20 : wide ? 20 + 36 + 16 : 14 + 28 + 12, marginRight: wide ? 20 : 14 }}>
        <SubPanel subs={subs} wide={wide && !compact} />
      </FadeIn>
    )}
    </Pressable>
  );
}

/** The open subtasks of a task: progress, then one line each with time, length and status. Editing stays in the form. */
function SubPanel({ subs, wide }: { subs: Subtask[]; wide: boolean }) {
  const n = subs.filter((x) => x.done).length;
  const d = new Date();
  const now = `${localDay(d)} ${d.toTimeString().slice(0, 5)}`;
  return (
    <View style={s.panel}>
      <View style={s.panelHead}>
        <Text style={s.panelTitle}>{tr('Việc con')}</Text>
        <Text style={s.panelCount}>{tr('Xong {done}/{n}', { done: n, n: subs.length })}</Text>
        <View style={s.track}><View style={[s.fill, { width: `${(n / subs.length) * 100}%` }]} /></View>
      </View>
      {subs.map((x, i) => <SubLine key={x.id} sub={x} now={now} wide={wide} last={i === subs.length - 1} />)}
    </View>
  );
}

function SubLine({ sub, now, wide, last }: { sub: Subtask; now: string; wide: boolean; last: boolean }) {
  // Optimistic tick; a newer value from the server (realtime, the form) replaces it.
  const [done, setDone] = useState(sub.done);
  const [seen, setSeen] = useState(sub.done);
  if (seen !== sub.done) { setSeen(sub.done); setDone(sub.done); }
  const span = fmtSpan(sub);
  const length = spanLength(sub);
  const status = subStatus({ ...sub, done }, now);
  const when = (
    <View style={[s.when, wide && s.whenWide]}>
      <M icon="time-outline" tone={status === 'late' ? 'over' : undefined}>{span || tr('Chưa đặt thời gian')}</M>
      {!!length && <Text style={s.length}>{length}</Text>}
    </View>
  );
  const badge = done ? <Badge label={tr('Xong')} tone="success" />
    : status === 'late' ? <Badge label={tr('Trễ hạn')} tone="error" />
    : status === 'now' ? <Badge label={tr('Đang diễn ra')} tone="warning" />
    : null;
  return (
    <View style={[s.subLine, !last && s.subRule]}>
      <Tick
        checked={done}
        size={20}
        onPress={async () => {
          setDone(!done);
          if (ok(await supabase.from('subtasks').update({ done: !done }).eq('id', sub.id))) refresh('subtasks');
          else setDone(done);
        }}
      />
      <View style={s.subBody}>
        <Text style={[s.subTitle, done && s.done]}>{sub.title}</Text>
        {!wide && <View style={s.subMeta}>{when}{badge}</View>}
      </View>
      {wide && when}
      {wide && <View style={s.badgeCol}>{badge}</View>}
    </View>
  );
}

/** Heading with count, then the tasks as lines on one sheet. Skeleton rows while loading. */
export function TaskGroup({ title, tasks, projects, over, hideDate, empty, timeCol, compact, loading }: {
  title: string; tasks: Task[]; projects?: Project[]; over?: boolean; hideDate?: boolean; empty?: string; timeCol?: boolean; compact?: boolean; loading?: boolean;
}) {
  const names = projects && new Map(projects.map((p) => [p.id, p.name]));
  // ponytail: one query + realtime channel per group; fine at a few groups per screen.
  const ids = tasks.map((t) => t.id);
  const [subtasks] = useRows<Subtask>('subtasks', (q) => q.in('task_id', ids).order('created_at'), ids.join());
  const subs = (id: string) => subtasks.filter((x) => x.task_id === id);
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
        {!loading && !tasks.length && empty && <View style={s.emptyBox}><Empty>{empty}</Empty></View>}
      </View>
    </View>
  );
}

function SkeletonRow() {
  return (
    <View style={[s.row, s.item, { alignItems: 'center' }]}>
      <View style={s.tickCol}><Skeleton width={32} height={32} round /></View>
      <View style={[s.body, { gap: 10 }]}>
        <Skeleton width="60%" height={14} />
        <Skeleton width="30%" height={12} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // The group is one white sheet with soft corners; hairlines between the lines.
  rows: { backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: rule.hair, borderColor: color.border, overflow: 'hidden' },
  emptyBox: { paddingHorizontal: 16 },
  item: { borderBottomWidth: rule.hair, borderBottomColor: color.border },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  subToggle: { flexDirection: 'row', alignItems: 'center', gap: 2, marginHorizontal: -6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, borderWidth: rule.hair, borderColor: color.border, backgroundColor: color.surface },
  subs: { marginTop: -4, marginBottom: 16 },
  // A white inset on the row: stays readable whether the row is plain, hovered or selected.
  panel: { backgroundColor: color.surface, borderRadius: radius.ctl, borderWidth: rule.hair, borderColor: color.border, paddingHorizontal: 14 },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: rule.hair, borderBottomColor: color.border },
  panelTitle: { ...text.meta, fontWeight: '600', color: color.foreground },
  panelCount: { ...text.meta, color: color.muted, fontVariant: ['tabular-nums'] },
  track: { flex: 1, maxWidth: 160, height: 4, borderRadius: 2, backgroundColor: color.border, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: color.success },
  subLine: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  subRule: { borderBottomWidth: rule.hair, borderBottomColor: color.border },
  subBody: { flex: 1, minWidth: 0, gap: 4 },
  subTitle: { ...text.sm, color: color.foreground },
  subMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 4 },
  when: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  whenWide: { width: 240 },
  length: { ...text.xs, color: color.muted, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.sm, backgroundColor: color.neutralBg, fontVariant: ['tabular-nums'] },
  badgeCol: { width: 96, alignItems: 'flex-end' },
  selected: { backgroundColor: color.primaryLight },
  timeCol: { width: 184, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 20, borderRightWidth: rule.hair, borderRightColor: color.border },
  timeL: { ...text.meta, fontWeight: '500', color: color.foreground, marginBottom: 2, fontVariant: ['tabular-nums'] },
  tickCol: { paddingLeft: 20, paddingVertical: 16, justifyContent: 'center' },
  tickColNarrow: { paddingLeft: 14, paddingVertical: 14, justifyContent: 'flex-start' },
  body: { flex: 1, minWidth: 0, paddingVertical: 16, paddingHorizontal: 20, justifyContent: 'center', gap: 6 },
  bodyNarrow: { paddingVertical: 12, paddingHorizontal: 14, gap: 4 },
  title: { ...text.body, color: color.foreground },
  done: { color: color.muted, textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 14, rowGap: 4 },
  m: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  mText: { ...text.meta, flexShrink: 1, fontVariant: ['tabular-nums'] },
  side: { width: 148, paddingVertical: 16, paddingHorizontal: 20, alignItems: 'flex-end', justifyContent: 'center' },
});
