import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { focusQuickAdd, QuickAdd } from '@/components/QuickAdd';
import { Bars, Stat, StatRow, statText } from '@/components/Stat';
import { endDay, TaskGroup } from '@/components/TaskRow';
import { active, Button, Empty, EmptyState, Screen, TextLink } from '@/components/ui';
import { color, radius, text } from '@/constants/theme';
import { addDays, fmtDay, fromIso, today } from '@/lib/dates';
import { Selection } from '@/lib/selection';
import { type Project, type Task, useRows } from '@/lib/supabase';

const WEEKDAY = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const daysBetween = (a: string, b: string) => Math.round((fromIso(b).getTime() - fromIso(a).getTime()) / 86_400_000);

export default function Today() {
  const day = today();
  const sel = useContext(Selection);
  const [open, , loaded] = useRows<Task>(
    'tasks',
    (q) => q.is('completed_at', null).lte('due_date', day).order('due_date').order('due_time', { nullsFirst: false }).order('priority'),
    day,
  );
  const past = Array.from({ length: 7 }, (_, i) => addDays(day, i - 6)); // last 7 days, today last
  const [recent] = useRows<Task>('tasks', (q) => q.gte('completed_day', past[0]).lte('completed_day', day).order('completed_at'), `done7:${day}`);
  const [projects] = useRows<Project>('projects');
  const week = Array.from({ length: 7 }, (_, i) => addDays(day, i + 1));
  const [soon] = useRows<Task>(
    'tasks',
    (q) => q.is('completed_at', null).gt('due_date', day).lte('due_date', week[6]).order('due_date').order('due_time', { nullsFirst: false }),
    `soon:${day}`,
  );

  // A task that started earlier but ends today or later is still on time.
  const over = open.filter((t) => endDay(t)! < day);
  const due = open.filter((t) => endDay(t)! >= day);
  const done = recent.filter((t) => t.completed_day === day);
  const perDay = past.map((d) => recent.filter((t) => t.completed_day === d).length);
  const vsYesterday = perDay[6] - perDay[5];
  const oldest = over.length ? Math.max(...over.map((t) => daysBetween(endDay(t)!, day))) : 0;
  const names = new Map(projects.map((p) => [p.id, p.name]));

  const list = !loaded ? (
    <TaskGroup title="Hôm nay" tasks={[]} loading />
  ) : open.length === 0 ? (
    <EmptyState
      icon="sunny-outline"
      title="Xong hết việc hôm nay"
      action={
        <>
          <Button title="Xem Sắp tới" onPress={() => router.navigate('/upcoming')} />
          <Button title="Thêm việc" icon="add" variant="primary" onPress={focusQuickAdd} />
        </>
      }
    >
      Việc có hạn hôm nay sẽ hiện ở đây. Thêm một việc, hoặc xem các ngày tới.
    </EmptyState>
  ) : (
    <View style={s.groups}>
      {over.length > 0 && <TaskGroup title="Quá hạn" over tasks={over} projects={projects} timeCol />}
      <TaskGroup title="Hôm nay" tasks={due} projects={projects} timeCol empty="Không còn việc nào có hạn hôm nay." />
    </View>
  );

  const next = soon[0];
  const aside = (
    <>
      <View>
        <View style={s.asideHead}>
          <Text style={s.asideTitle}>7 ngày tới</Text>
          <TextLink label="Xem tất cả" onPress={() => router.navigate('/upcoming')} />
        </View>
        <View style={s.week}>
          {week.map((w, i) => {
            const n = soon.filter((t) => t.due_date === w).length;
            const on = i === 0; // tomorrow
            return (
              <Pressable
                key={w}
                onPress={() => router.navigate('/upcoming')}
                accessibilityLabel={`${SHORT[fromIso(w).getDay()]} ${fmtDay(w)}: ${n} việc`}
                style={(st) => [s.wd, !on && active(st) && { backgroundColor: color.secondary }, on && s.wdOn]}
              >
                <Text style={[s.wdDay, on && s.wdOnText]}>{SHORT[fromIso(w).getDay()]}</Text>
                <Text style={[s.wdNum, on && { color: color.primaryFg }]}>{w.slice(8)}</Text>
                <Text style={[s.wdCount, on && s.wdOnText]}>{n || ''}</Text>
              </Pressable>
            );
          })}
        </View>
        {next && (
          <View style={s.next}>
            <Text style={s.nextLabel}>Việc kế tiếp · {WEEKDAY[fromIso(next.due_date!).getDay()]} {fmtDay(next.due_date!)}</Text>
            <Text style={s.nextTitle} numberOfLines={2}>{next.title}</Text>
            <View style={s.nextMeta}>
              <Ionicons name="time-outline" size={14} color={color.primaryFg} />
              <Text style={s.nextLabel}>
                {[next.due_time?.slice(0, 5), next.project_id ? names.get(next.project_id) : 'Hộp thư'].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>
        )}
      </View>
      <View>
        <View style={s.asideHead}>
          <Text style={s.asideTitle}>Đã xong hôm nay</Text>
          <TextLink label="Nhật ký" onPress={() => router.navigate('/journal')} />
        </View>
        {done.map((t, i) => (
          <View key={t.id} style={[s.mini, i === done.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={s.ok}><Ionicons name="checkmark" size={16} color={color.success} /></View>
            <View style={s.miniBody}>
              <Text style={s.miniTitle} numberOfLines={1}>{t.title}</Text>
              <Text style={s.miniTime}>{new Date(t.completed_at!).toTimeString().slice(0, 5)}</Text>
            </View>
          </View>
        ))}
        {!done.length && <Empty>Chưa xong việc nào.</Empty>}
      </View>
    </>
  );

  return (
    <Screen
      title="Hôm nay"
      sub={`${WEEKDAY[fromIso(day).getDay()]}, ${fmtDay(day)}${loaded ? ` · ${open.length} việc` : ''}`}
      footer={<QuickAdd defaults={{ due_date: day }} placeholder="Thêm việc cho hôm nay…" />}
      aside={sel?.id ? undefined : aside}
      maxWidth={100000}
    >
      <StatRow>
        <Stat
          icon="list-outline"
          label="Còn lại"
          n={due.length}
          foot={<Text style={statText.foot}>Trên <Text style={statText.b}>{due.length + done.length}</Text> việc hôm nay</Text>}
        />
        <Stat
          icon="alert-circle-outline"
          label="Quá hạn"
          n={over.length}
          tone={over.length ? color.danger : undefined}
          foot={<Text style={statText.foot}>{oldest ? <>Cũ nhất <Text style={[statText.b, { color: color.danger }]}>{oldest} ngày</Text></> : 'Không có việc trễ'}</Text>}
        />
        <Stat
          icon="checkmark-circle-outline"
          label="Đã xong"
          n={done.length}
          foot={
            <>
              <Text style={statText.foot}>
                {vsYesterday === 0 ? 'Bằng hôm qua' : (
                  <>
                    <Text style={[statText.b, { color: vsYesterday > 0 ? color.success : color.danger }]}>{vsYesterday > 0 ? '+' : ''}{vsYesterday}</Text> so với hôm qua
                  </>
                )}
              </Text>
              <Bars values={perDay} label="Việc xong 7 ngày qua" />
            </>
          }
        />
      </StatRow>
      {list}
    </Screen>
  );
}

const s = StyleSheet.create({
  groups: { gap: 28 },
  asideHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  asideTitle: { ...text.h2, color: color.foreground },
  week: { flexDirection: 'row', gap: 6 },
  wd: { flex: 1, alignItems: 'center', gap: 2, paddingTop: 10, paddingBottom: 8, borderRadius: radius.md, backgroundColor: color.background },
  wdOn: { backgroundColor: color.primary },
  wdOnText: { color: color.primaryFg },
  wdDay: { ...text.xs, fontSize: 11, lineHeight: 14, color: color.muted },
  wdNum: { ...text.base, fontSize: 15, lineHeight: 20, color: color.foreground },
  wdCount: { ...text.xs, fontSize: 11, lineHeight: 14, height: 14, fontWeight: '600', color: color.primary },
  next: { marginTop: 16, borderRadius: 14, backgroundColor: color.primary, paddingVertical: 16, paddingHorizontal: 18, gap: 4 },
  nextLabel: { ...text.xs, color: color.primaryFg },
  nextTitle: { ...text.base, lineHeight: 22, color: color.primaryFg },
  nextMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mini: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: color.border },
  ok: { width: 28, height: 28, borderRadius: 14, backgroundColor: color.successBg, alignItems: 'center', justifyContent: 'center' },
  miniBody: { flex: 1, minWidth: 0 },
  miniTitle: { ...text.sm, color: color.foreground },
  miniTime: { ...text.xs, color: color.muted },
});
