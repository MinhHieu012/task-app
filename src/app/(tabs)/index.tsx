import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { QuickAdd } from '@/components/QuickAdd';
import { endDay, TaskGroup } from '@/components/TaskRow';
import { Card, Empty, Screen, useWide } from '@/components/ui';
import { color, radius, text } from '@/constants/theme';
import { addDays, fmtDay, fromIso, today } from '@/lib/dates';
import { Selection } from '@/lib/selection';
import { type Project, type Task, useRows } from '@/lib/supabase';

const WEEKDAY = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export default function Today() {
  const day = today();
  const wide = useWide();
  const sel = useContext(Selection);
  const [open, , loaded] = useRows<Task>(
    'tasks',
    (q) => q.is('completed_at', null).lte('due_date', day).order('due_date').order('due_time', { nullsFirst: false }).order('priority'),
    day,
  );
  const [done] = useRows<Task>('tasks', (q) => q.eq('completed_day', day), `done:${day}`);
  const [projects] = useRows<Project>('projects');
  const week = Array.from({ length: 7 }, (_, i) => addDays(day, i + 1));
  const [soon] = useRows<Task>('tasks', (q) => q.is('completed_at', null).gt('due_date', day).lte('due_date', week[6]), `soon:${day}`);

  // A task that started earlier but ends today or later is still on time.
  const over = open.filter((t) => endDay(t)! < day);
  const due = open.filter((t) => endDay(t)! >= day);
  const [, m, d] = day.split('-');
  const quick = <QuickAdd defaults={{ due_date: day }} placeholder="Thêm việc cho hôm nay…" />;

  const list = !loaded ? null : open.length === 0 ? (
    <Card>
      <View style={s.empty}>
        <Text style={s.emptyTitle}>Xong hết việc hôm nay</Text>
        <Empty>Việc có hạn hôm nay sẽ hiện ở đây.</Empty>
      </View>
    </Card>
  ) : (
    <>
      {over.length > 0 && <TaskGroup title="Quá hạn" over tasks={over} projects={projects} />}
      <TaskGroup title="Hôm nay" tasks={due} projects={projects} empty="Không còn việc nào có hạn hôm nay." />
    </>
  );

  return (
    <Screen
      title="Hôm nay"
      sub={`${WEEKDAY[fromIso(day).getDay()]}, ${d}/${m}${loaded ? ` · ${open.length} việc` : ''}`}
      footer={wide ? undefined : quick}
      maxWidth={wide ? 1200 : undefined}
    >
      {wide ? (
        <>
          <View style={s.stats}>
            <Stat label="Còn lại" n={due.length} />
            <Stat label="Quá hạn" n={over.length} tone={over.length ? color.warning : undefined} />
            <Stat label="Đã xong" n={done.length} tone={done.length ? color.success : undefined} />
            <Stat label="7 ngày tới" n={soon.length} />
          </View>
          <View style={s.cols}>
            <View style={s.main}>{list}{quick}</View>
            {/* The task panel needs the room on narrower desktops. */}
            {!sel?.id && (
              <View style={s.aside}>
                <Card title="7 ngày tới" action={<Link label="Xem" onPress={() => router.navigate('/upcoming')} />}>
                  {week.map((w, i) => {
                    const n = soon.filter((t) => t.due_date === w).length;
                    return (
                      <View key={w} style={s.dayRow}>
                        <Text style={s.dayText}>{i === 0 ? 'Ngày mai' : SHORT[fromIso(w).getDay()]} · {fmtDay(w)}</Text>
                        <Text style={[s.dayN, !n && { color: color.muted, fontWeight: '400' }]}>{n || '–'}</Text>
                      </View>
                    );
                  })}
                </Card>
                <TaskGroup title="Đã xong hôm nay" tasks={done} projects={projects} hideDate empty="Chưa xong việc nào." />
              </View>
            )}
          </View>
        </>
      ) : (
        <>
          {done.length > 0 && (
            <Pressable onPress={() => router.push('/journal')} style={({ pressed }) => [s.done, pressed && { opacity: 0.8 }]}>
              <Ionicons name="checkmark-circle-outline" size={14} color={color.success} />
              <Text style={s.doneText}>Đã xong hôm nay: {done.length}</Text>
              <Ionicons name="chevron-forward" size={14} color={color.success} />
            </Pressable>
          )}
          {list}
        </>
      )}
    </Screen>
  );
}

function Stat({ label, n, tone }: { label: string; n: number; tone?: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statN, tone && { color: tone }]}>{n}</Text>
    </View>
  );
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      {({ pressed }) => <Text style={[s.link, pressed && { opacity: 0.6 }]}>{label}</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  done: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 32, paddingHorizontal: 12, borderRadius: radius.full, backgroundColor: color.successBg },
  doneText: { ...text.xs, fontWeight: '500', color: color.success },
  empty: { alignItems: 'center', paddingTop: 16 },
  emptyTitle: { ...text.base, color: color.foreground },

  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, backgroundColor: color.surface, borderWidth: 1, borderColor: color.border, borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: 16, gap: 4 },
  statLabel: { ...text.xs, color: color.muted },
  statN: { fontSize: 24, lineHeight: 32, fontWeight: '700', color: color.foreground },
  cols: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  main: { flex: 1, minWidth: 0, gap: 16 },
  aside: { width: 320, gap: 16 },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  dayText: { ...text.sm, color: color.foreground },
  dayN: { ...text.smMedium, fontWeight: '600', color: color.foreground },
  link: { ...text.sm, color: color.muted },
});
