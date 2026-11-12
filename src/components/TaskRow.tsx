import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { type ComponentProps, type ReactNode, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Calendar } from '@/components/DateTime';
import { Sheet } from '@/components/Sheet';
import { active, Badge, Empty, FadeIn, GroupTitle, PriorityTag, reducedMotion, Skeleton, Tick, useWide } from '@/components/ui';
import { color, priority as pColor, type Priority, radius, rule, text } from '@/constants/theme';
import { addDays, fmtDay, fromIso, localDay, nextDue, nextMonday, today } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { htmlToText } from '@/lib/html';
import { tr } from '@/lib/i18n';
import { choose, confirmAction, toast } from '@/lib/notify';
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
  const now = new Date();
  const done = { completed_at: now.toISOString(), completed_day: localDay(now) };
  const res = t.completed_at
    ? t.recurring_copy ? await tasks.delete().eq('id', t.id) : await tasks.update({ completed_at: null, completed_day: null }).eq('id', t.id)
    : t.repeat && t.due_date
      ? await supabase.rpc('complete_recurring', {
          p_task_id: t.id, p_completed_at: done.completed_at, p_completed_day: done.completed_day, p_next_due: nextDue(t.repeat, t.due_date),
        })
      : await tasks.update(done).eq('id', t.id);
  // Realtime can arrive late: a row swiped away must not come back as a gap while it waits.
  if (ok(res)) refresh('tasks');
  return !res.error;
}

/** Asks, deletes the task (subtasks go with it), then offers an undo that puts both back with the same ids.
 *  Returns true once deleted. Shared by the task form and the row's long-press menu. */
export async function removeTask(task: Task) {
  const msg = tr('“{name}” sẽ bị xoá. Bạn có vài giây để hoàn tác.', { name: task.title }) + (task.completed_at ? ' ' + tr('Mục này cũng mất khỏi nhật ký.') : '');
  if (!(await confirmAction(tr('Xoá việc này?'), msg))) return false;
  const subs = await supabase.from('subtasks').select('*').eq('task_id', task.id);
  if (!ok(subs) || !ok(await supabase.from('tasks').delete().eq('id', task.id))) return false;
  refresh('tasks');
  toast(tr('“{name}” đã bị xoá.', { name: task.title }), tr('Đã xoá việc'), 'success', {
    label: tr('Hoàn tác'),
    run: async () => {
      if (!ok(await supabase.from('tasks').insert(task))) return;
      if (subs.data?.length) ok(await supabase.from('subtasks').insert(subs.data));
      refresh('tasks');
      refresh('subtasks');
    },
  });
  return true;
}

export const priorityLabel = (p: number) => (p === 4 ? tr('Bình thường') : tr('Ưu tiên {n}', { n: p }));

/** A one-field change from a menu (priority, project), with an undo when it moved the task somewhere. */
async function patchTask(t: Task, patch: Partial<Task>, undo?: { title: string; message: string }) {
  if (!ok(await supabase.from('tasks').update(patch).eq('id', t.id))) return;
  refresh('tasks');
  const back = Object.fromEntries(Object.keys(patch).map((k) => [k, t[k as keyof Task]]));
  if (undo) {
    toast(undo.message, undo.title, 'success', {
      label: tr('Hoàn tác'),
      run: async () => { if (ok(await supabase.from('tasks').update(back).eq('id', t.id))) refresh('tasks'); },
    });
  }
}

/** Moves open tasks to new start days (`to` per task) on the server, ends and subtasks along, then offers an undo
 *  that puts each one back on its own old day. Returns true on success. */
export async function moveTasks(tasks: Task[], to: (t: Task) => string, title: string, message: string) {
  const move = async (pairs: [string, string][]) => {
    const res = await supabase.rpc('move_tasks', { p_ids: pairs.map((p) => p[0]), p_days: pairs.map((p) => p[1]) });
    if (!ok(res)) return false;
    refresh('tasks');
    refresh('subtasks');
    return true;
  };
  const moved = tasks.filter((t) => t.due_date);
  if (!(await move(moved.map((t) => [t.id, to(t)])))) return false;
  const back = moved.map((t): [string, string] => [t.id, t.due_date!]);
  toast(message, title, 'success', { label: tr('Hoàn tác'), run: () => move(back) });
  return true;
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
function M({ icon, children, tone, lines }: { icon?: Icon; children: string; tone?: 'over'; lines?: number }) {
  const c = tone === 'over' ? color.danger : color.muted;
  return (
    <View style={s.m}>
      {icon && <Ionicons name={icon} size={14} color={c} />}
      <Text style={[s.mText, { color: c }, tone && { fontWeight: '500' }]} numberOfLines={lines}>{children}</Text>
    </View>
  );
}

/** One task as a line on the group's sheet.
 *  timeCol: Today's layout, a left column with "Bắt đầu 9:00" or "Hạn 02/11" over "Trễ 3 ngày".
 *  compact: narrow columns (Sắp tới), no priority tag. */
export function TaskRow({ task, project, hideDate, timeCol, compact, subs = [], isLast }: {
  task: Task; project?: string; hideDate?: boolean; timeCol?: boolean; compact?: boolean; subs?: Subtask[]; isLast?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false); // phones: the "pick a day" sheet of the swipe and the menu
  const sel = useContext(Selection);
  const wide = useWide();
  const done = !!task.completed_at;
  const day = today();
  const last = endDay(task);
  const over = !done && !!last && last < day;
  const late = over ? tr('Trễ {n} ngày', { n: daysBetween(last!, day) }) : '';
  const range = timeRange(task);
  const side = wide && timeCol;
  // Due today or overdue: one tap pushes it to tomorrow or next Monday (wide; phones swipe instead).
  const snooze = wide && !done && !!task.due_date && task.due_date <= day;
  const push = (to: string, label: string) => {
    setBusy(true);
    return moveTasks([task], () => to, tr('Đã dời việc'), tr('“{name}” chuyển sang {day}.', { name: task.title, day: label })).finally(() => setBusy(false));
  };
  const openTask = () => (sel ? sel.select(sel.id === task.id ? null : task.id) : router.push({ pathname: '/task/[id]', params: { id: task.id } }));
  const tickIt = async () => {
    setBusy(true);
    const r = await toggleDone(task);
    setBusy(false);
    return r;
  };

  // Phones: long press. Everything the form can change in one tap, without opening it.
  const menu = async () => {
    haptic.select();
    const dated = !done && !!task.due_date;
    const k = await choose(task.title, [
      { key: 'done', label: done ? tr('Bỏ đánh dấu xong') : tr('Đánh dấu xong'), icon: done ? 'arrow-undo-outline' : 'checkmark-circle-outline' },
      ...(dated && task.due_date !== day ? [{ key: 'today', label: tr('Dời sang hôm nay'), icon: 'sunny-outline' }] : []),
      ...(dated ? [
        { key: 'tomorrow', label: tr('Dời sang ngày mai'), icon: 'arrow-forward-outline' },
        { key: 'monday', label: tr('Dời sang thứ Hai tuần sau'), icon: 'calendar-outline' },
        { key: 'pick', label: tr('Chọn ngày khác…'), icon: 'calendar-clear-outline' },
      ] : []),
      ...(!done ? [
        { key: 'priority', label: tr('Ưu tiên'), icon: 'flag-outline', detail: priorityLabel(task.priority) },
        { key: 'project', label: 'Project', icon: 'folder-outline', detail: project || tr('Hộp thư') },
      ] : []),
      { key: 'edit', label: tr('Sửa chi tiết'), icon: 'create-outline' },
      { key: 'delete', label: tr('Xoá việc'), icon: 'trash-outline', danger: true },
    ]);
    if (k === 'done') tickIt();
    else if (k === 'today') push(day, tr('hôm nay'));
    else if (k === 'tomorrow') push(addDays(day, 1), tr('ngày mai'));
    else if (k === 'monday') push(nextMonday(day), tr('thứ Hai tuần sau'));
    else if (k === 'pick') setPicking(true);
    else if (k === 'edit') openTask();
    else if (k === 'delete') removeTask(task);
    else if (k === 'priority') {
      const p = await choose(tr('Ưu tiên'), ([1, 2, 3, 4] as const).map((n) => ({ key: String(n), label: priorityLabel(n), icon: 'flag', tint: pColor[n], on: task.priority === n })));
      if (p && Number(p) !== task.priority) patchTask(task, { priority: Number(p) });
    } else if (k === 'project') {
      const res = await supabase.from('projects').select('*').order('name');
      if (!ok(res)) return;
      const list = res.data as Project[];
      const p = await choose(tr('Chuyển sang project'), [
        { key: '', label: tr('Hộp thư'), icon: 'file-tray-outline', on: !task.project_id },
        ...list.map((x) => ({ key: x.id, label: x.name, icon: 'folder-outline', on: task.project_id === x.id })),
      ]);
      if (p === null || p === (task.project_id ?? '')) return;
      const name = list.find((x) => x.id === p)?.name ?? tr('Hộp thư');
      patchTask(task, { project_id: p || null }, { title: tr('Đã chuyển project'), message: tr('“{name}” chuyển sang {project}.', { name: task.title, project: name }) });
    }
  };

  const tick = (
    <Tick
      priority={task.priority as Priority}
      checked={done}
      disabled={busy}
      size={wide ? 36 : 28}
      onPress={tickIt}
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
        hitSlop={12}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? tr('Ẩn việc con') : tr('Xem việc con')}
        style={(st) => [s.subToggle, active(st) && { backgroundColor: color.itemHover }]}
      >
        <M icon="checkbox-outline">{`${subs.filter((x) => x.done).length}/${subs.length}`}</M>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={color.muted} />
      </Pressable>
    ),
    ...(wide ? task.tags ?? [] : (task.tags ?? []).slice(0, 2)).map((tag) => (
      // Wide: its own press target, like the subtask toggle, opening search on that tag. Phones: plain muted text,
      // so a thumb meaning to open the task never lands in search (tags are filtered from the search screen).
      wide ? (
        <Pressable
          key={`#${tag}`}
          onPress={() => router.navigate({ pathname: '/search', params: { q: `#${tag}` } })}
          hitSlop={6}
          accessibilityRole="link"
          accessibilityLabel={tr('Xem việc có nhãn {tag}', { tag })}
          style={(st) => [s.tag, active(st) && { backgroundColor: color.itemHover }]}
        >
          <Text style={s.tagText}>#{tag}</Text>
        </Pressable>
      ) : <Text key={`#${tag}`} style={[s.mText, s.muted]}>#{tag}</Text>
    )),
    // Phones: two tags, then how many more, so one task keeps to its two lines.
    !wide && (task.tags?.length ?? 0) > 2 && <Text key="#more" style={[s.mText, s.muted]}>+{task.tags!.length - 2}</Text>,
    task.note && <M key="n" icon="document-text-outline" lines={2}>{htmlToText(task.note)}</M>,
    ...(snooze
      ? ([[addDays(day, 1), tr('Mai'), tr('ngày mai')], [nextMonday(day), tr('Tuần sau'), tr('thứ Hai tuần sau')]] as const).map(([to, label, said]) => (
          // Own press targets inside the row, like the tags.
          <Pressable
            key={`to:${label}`}
            onPress={() => push(to, said)}
            disabled={busy}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={tr('Dời sang {day}', { day: said })}
            style={(st) => [s.snooze, active(st) && { backgroundColor: color.itemHover }]}
          >
            <Ionicons name="arrow-forward" size={12} color={color.muted} />
            <Text style={s.snoozeText}>{label}</Text>
          </Pressable>
        ))
      : []),
  ].filter(Boolean);

  const selected = sel?.id === task.id;
  const item = (
    // The whole item (row + open subtasks) is one press target, so hover and selection tint it as one block.
    <Pressable
      onPress={openTask}
      onLongPress={wide ? undefined : menu}
      delayLongPress={350}
      style={(st) => [s.item, !wide && s.itemNarrow, active(st) && { backgroundColor: color.itemHover }, selected && s.selected]}
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
  if (wide) return item;
  return (
    <>
      <Swipe
        enabled={!done && !busy}
        dated={!!task.due_date}
        onDone={tickIt}
        onTomorrow={() => push(addDays(day, 1), tr('ngày mai'))}
        onPick={() => setPicking(true)}
        last={isLast}
      >
        {item}
      </Swipe>
      <Sheet visible={picking} onClose={() => setPicking(false)} title={tr('Dời sang ngày')}>
        <Calendar
          selected={task.due_date}
          start={task.due_date ?? day}
          onPick={(d) => {
            setPicking(false);
            if (d && d !== task.due_date) push(d, fmtDay(d));
          }}
        />
      </Sheet>
    </>
  );
}

const ACT = 80; // width of each button a left swipe uncovers
const nativeDriver = Platform.OS !== 'web';

/** Phones: the row slides under the thumb. Right past 30% of the width: green "Xong", let go to tick it.
 *  Left: uncovers "Mai" (to tomorrow) and "Dời…" (pick a day). A click (haptic) marks each threshold.
 *  Under reduce motion the row still follows the finger (that is the gesture), but snaps instead of springing. */
function Swipe({ children, enabled, dated, onDone, onTomorrow, onPick, last }: {
  children: ReactNode; enabled: boolean; dated: boolean; onDone: () => Promise<boolean>; onTomorrow: () => void; onPick: () => void; last?: boolean;
}) {
  const { width } = useWindowDimensions();
  const [x] = useState(() => new Animated.Value(0));
  const [opened, setOpened] = useState(false);
  const rest = useRef(0); // 0, or -2*ACT while the buttons are uncovered
  const zone = useRef(0); // which threshold the drag is past: 1 done, -1 buttons, 0 none
  const reveal = dated ? 2 * ACT : 0;
  // The responder is built once: a list re-render mid-drag (realtime) must not swap its handlers.
  const live = useRef({ enabled, reveal, width, onDone });
  useLayoutEffect(() => { live.current = { enabled, reveal, width, onDone }; });

  const settle = (to: number) => {
    rest.current = to;
    setOpened(to !== 0);
    if (reducedMotion()) x.setValue(to);
    else Animated.spring(x, { toValue: to, useNativeDriver: nativeDriver, friction: 9, tension: 90 }).start();
  };
  const settleRef = useRef(settle);
  useLayoutEffect(() => { settleRef.current = settle; });

  // PanResponder is imperative: its handlers read the refs when the finger moves, never during render.
  // eslint-disable-next-line react-hooks/refs
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => live.current.enabled && Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderGrant: () => { zone.current = 0; return true; }, // true: the list may not take the touch back
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => {
      const { reveal: r, width: w } = live.current;
      const dx = Math.max(rest.current + g.dx, -r - 32);
      x.setValue(dx);
      const z = dx > w * 0.3 ? 1 : r && dx < -ACT * 0.8 ? -1 : 0;
      if (z !== zone.current) {
        zone.current = z;
        if (z) haptic.select();
      }
    },
    onPanResponderRelease: () => {
      if (zone.current === 1) {
        rest.current = 0;
        const after = async () => {
          if (!(await live.current.onDone())) settleRef.current(0);
          else x.setValue(0); // the row leaves the list; reset in case it stays (a recurring task in Upcoming)
        };
        if (reducedMotion()) after();
        else Animated.timing(x, { toValue: live.current.width, duration: 180, useNativeDriver: nativeDriver }).start(after);
      } else settleRef.current(zone.current === -1 ? -live.current.reveal : 0);
    },
    onPanResponderTerminate: () => settleRef.current(rest.current),
  }), [x]);

  const doneLayer = x.interpolate({ inputRange: [0, 48], outputRange: [0, 1], extrapolate: 'clamp' });
  const actLayer = x.interpolate({ inputRange: [-48, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <View style={s.swipe}>
      <Animated.View style={[s.doneBg, { opacity: doneLayer }]} pointerEvents="none">
        <Ionicons name="checkmark-circle" size={24} color={color.primaryFg} />
        <Text style={s.doneText}>{tr('Xong')}</Text>
      </Animated.View>
      {dated && (
        <Animated.View style={[s.acts, { opacity: actLayer }]} pointerEvents={opened ? 'auto' : 'none'}>
          <Pressable onPress={() => { settle(0); onTomorrow(); }} accessibilityRole="button" accessibilityLabel={tr('Dời sang {day}', { day: tr('ngày mai') })} style={[s.act, { backgroundColor: color.primary }]}>
            <Ionicons name="arrow-forward" size={20} color={color.primaryFg} />
            <Text style={[s.actText, { color: color.primaryFg }]}>{tr('Mai')}</Text>
          </Pressable>
          <Pressable onPress={() => { settle(0); onPick(); }} accessibilityRole="button" accessibilityLabel={tr('Chọn ngày khác…')} style={[s.act, { backgroundColor: color.secondaryHover }]}>
            <Ionicons name="calendar-outline" size={20} color={color.foreground} />
            <Text style={s.actText}>{tr('Dời…')}</Text>
          </Pressable>
        </Animated.View>
      )}
      <Animated.View style={[s.slide, { transform: [{ translateX: x }] }]} {...pan.panHandlers}>
        {children}
        {!last && <View style={s.sep} />}
        {/* While the buttons show, a tap on the row closes them instead of opening the task. */}
        {opened && <Pressable style={StyleSheet.absoluteFill} onPress={() => settle(0)} accessibilityLabel={tr('Đóng')} />}
      </Animated.View>
    </View>
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
export function TaskGroup({ title, tasks, projects, over, hideDate, empty, timeCol, compact, loading, action, folded }: {
  title: string; tasks: Task[]; projects?: Project[]; over?: boolean; hideDate?: boolean; empty?: string; timeCol?: boolean; compact?: boolean; loading?: boolean; action?: ReactNode;
  folded?: boolean; // phones: starts folded under its heading (done tasks), a tap on the heading opens it
}) {
  const wide = useWide();
  const [open, setOpen] = useState(!folded);
  const names = projects && new Map(projects.map((p) => [p.id, p.name]));
  // ponytail: one query + realtime channel per group; fine at a few groups per screen.
  const ids = tasks.map((t) => t.id);
  const [subtasks] = useRows<Subtask>('subtasks', (q) => q.in('task_id', ids).order('created_at'), ids.join());
  const subs = (id: string) => subtasks.filter((x) => x.task_id === id);
  const foldable = folded !== undefined && !wide && tasks.length > 0;
  return (
    <View>
      <GroupTitle title={title} count={loading ? 0 : tasks.length} over={over} action={action} open={open} onToggle={foldable ? () => setOpen((o) => !o) : undefined} />
      {(open || !foldable) && (
        <TaskRows tasks={tasks} names={names} subs={subs} hideDate={hideDate} timeCol={timeCol} compact={compact} loading={loading} empty={empty} />
      )}
    </View>
  );
}

/** The sheet of task lines without a heading; the caller brings the subtasks (one query for many groups). */
export function TaskRows({ tasks, names, subs, hideDate, timeCol, compact, loading, empty }: {
  tasks: Task[]; names?: Map<string, string>; subs: (id: string) => Subtask[]; hideDate?: boolean; timeCol?: boolean; compact?: boolean; loading?: boolean; empty?: string;
}) {
  const wide = useWide();
  return (
    <View style={wide ? s.rows : s.rowsNarrow}>
      {loading
        ? [0, 1, 2].map((i) => <SkeletonRow key={i} />)
        : tasks.map((t, i) => (
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
                isLast={i === tasks.length - 1}
              />
            </FadeIn>
          ))}
      {!loading && !tasks.length && empty && <View style={s.emptyBox}><Empty>{empty}</Empty></View>}
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
  // Phones: an inset group, no edge; rows split by hairlines that start at the title column (16 + 28 + 12).
  rowsNarrow: { backgroundColor: color.surface, borderRadius: radius.lg, overflow: 'hidden' },
  emptyBox: { paddingHorizontal: 16 },
  item: { borderBottomWidth: rule.hair, borderBottomColor: color.border },
  itemNarrow: { borderBottomWidth: 0, backgroundColor: color.surface },
  swipe: { overflow: 'hidden' },
  slide: { backgroundColor: color.surface },
  sep: { position: 'absolute', left: 16 + 28 + 12, right: 0, bottom: 0, height: rule.hair, backgroundColor: color.border },
  doneBg: { ...StyleSheet.absoluteFill, backgroundColor: color.success, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 20 },
  doneText: { ...text.base, color: color.primaryFg },
  acts: { position: 'absolute', top: 0, bottom: 0, right: 0, flexDirection: 'row' },
  act: { width: ACT, alignItems: 'center', justifyContent: 'center', gap: 4 },
  actText: { ...text.meta, fontWeight: '600', color: color.foreground },
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
  snooze: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.sm, borderWidth: rule.hair, borderColor: color.border, backgroundColor: color.surface },
  snoozeText: { ...text.meta, color: color.muted },
  tag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.sm, backgroundColor: color.primaryLight },
  tagText: { ...text.meta, color: color.primary },
  badgeCol: { width: 96, alignItems: 'flex-end' },
  selected: { backgroundColor: color.primaryLight },
  timeCol: { width: 184, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 20, borderRightWidth: rule.hair, borderRightColor: color.border },
  timeL: { ...text.meta, fontWeight: '500', color: color.foreground, marginBottom: 2, fontVariant: ['tabular-nums'] },
  tickCol: { paddingLeft: 20, paddingVertical: 16, justifyContent: 'center' },
  tickColNarrow: { paddingLeft: 16, paddingVertical: 14, justifyContent: 'flex-start' },
  body: { flex: 1, minWidth: 0, paddingVertical: 16, paddingHorizontal: 20, justifyContent: 'center', gap: 6 },
  bodyNarrow: { paddingVertical: 13, paddingRight: 16, gap: 4, minHeight: 56 },
  title: { ...text.body, color: color.foreground },
  done: { color: color.muted, textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 14, rowGap: 4 },
  m: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  mText: { ...text.meta, flexShrink: 1, fontVariant: ['tabular-nums'] },
  muted: { color: color.muted },
  side: { width: 148, paddingVertical: 16, paddingHorizontal: 20, alignItems: 'flex-end', justifyContent: 'center' },
});
