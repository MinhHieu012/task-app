import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useContext } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { focusQuickAdd, QuickAdd } from '@/components/QuickAdd';
import { Bars, Stat, StatRow, statText } from '@/components/Stat';
import { endDay, TaskGroup } from '@/components/TaskRow';
import { active, Avatar, Button, Empty, EmptyState, Screen, TextLink, useWide } from '@/components/ui';
import { color, radius, rule, text } from '@/constants/theme';
import { addDays, fmtDay, fromIso, today } from '@/lib/dates';
import { tr } from '@/lib/i18n';
import { Selection } from '@/lib/selection';
import { type Project, type Task, useRows } from '@/lib/supabase';

const WEEKDAY = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const daysBetween = (a: string, b: string) => Math.round((fromIso(b).getTime() - fromIso(a).getTime()) / 86_400_000);

export default function Today() {
  const day = today();
  const sel = useContext(Selection);
  const wide = useWide();
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
    <TaskGroup title={tr('Hôm nay')} tasks={[]} loading />
  ) : open.length === 0 ? (
    <EmptyState
      icon="sunny-outline"
      title={tr('Xong hết việc hôm nay')}
      action={
        <>
          <Button title={tr('Xem Sắp tới')} onPress={() => router.navigate('/upcoming')} />
          <Button title={tr('Thêm việc')} icon="add" variant="primary" onPress={focusQuickAdd} />
        </>
      }
    >
      {tr('Việc có hạn hôm nay sẽ hiện ở đây. Thêm một việc, hoặc xem các ngày tới.')}
    </EmptyState>
  ) : (
    <View style={s.groups}>
      {over.length > 0 && <TaskGroup title={tr('Quá hạn')} over tasks={over} projects={projects} timeCol />}
      <TaskGroup title={tr('Hôm nay')} tasks={due} projects={projects} timeCol empty={tr('Không còn việc nào có hạn hôm nay.')} />
    </View>
  );

  const next = soon[0];
  const aside = (
    <>
      <View>
        <View style={s.asideHead}>
          <Text style={s.asideTitle}>{tr('7 ngày tới')}</Text>
          <TextLink label={tr('Xem tất cả')} onPress={() => router.navigate('/upcoming')} />
        </View>
        <View style={s.week}>
          {week.map((w, i) => {
            const n = soon.filter((t) => t.due_date === w).length;
            const on = i === 0; // tomorrow
            return (
              <Pressable
                key={w}
                onPress={() => router.navigate('/upcoming')}
                accessibilityLabel={tr('{day} {date}: {n} việc', { day: tr(SHORT[fromIso(w).getDay()]), date: fmtDay(w), n })}
                style={(st) => [s.wd, active(st) && { backgroundColor: color.itemHover }, on && s.wdOn]}
              >
                <Text style={s.wdDay}>{tr(SHORT[fromIso(w).getDay()])}</Text>
                <Text style={s.wdNum}>{w.slice(8)}</Text>
                <Text style={s.wdCount}>{n || ''}</Text>
              </Pressable>
            );
          })}
        </View>
        {next && (
          <View style={s.next}>
            <View style={s.nextHead}>
              <Text style={s.nextLabel}>{tr('Việc kế tiếp')}</Text>
              <Text style={s.nextLabel}>{tr(WEEKDAY[fromIso(next.due_date!).getDay()])} {fmtDay(next.due_date!)}</Text>
            </View>
            <Text style={s.nextTitle} numberOfLines={2}>{next.title}</Text>
            <View style={s.nextMeta}>
              <Ionicons name="time-outline" size={14} color={color.muted} />
              <Text style={s.nextLabel}>
                {[next.due_time?.slice(0, 5), next.project_id ? names.get(next.project_id) : tr('Hộp thư')].filter(Boolean).join(', ')}
              </Text>
            </View>
          </View>
        )}
      </View>
      <View>
        <View style={s.asideHead}>
          <Text style={s.asideTitle}>{tr('Đã xong hôm nay')}</Text>
          <TextLink label={tr('Nhật ký')} onPress={() => router.navigate('/journal')} />
        </View>
        {done.map((t, i) => (
          <View key={t.id} style={[s.mini, i === done.length - 1 && { borderBottomWidth: 0 }]}>
            <Ionicons name="checkmark" size={16} color={color.success} />
            <View style={s.miniBody}>
              <Text style={s.miniTitle} numberOfLines={1}>{t.title}</Text>
              <Text style={s.miniTime}>{new Date(t.completed_at!).toTimeString().slice(0, 5)}</Text>
            </View>
          </View>
        ))}
        {!done.length && <Empty>{tr('Chưa xong việc nào.')}</Empty>}
      </View>
    </>
  );

  return (
    <Screen
      title={tr('Hôm nay')}
      sub={`${tr(WEEKDAY[fromIso(day).getDay()])}, ${fmtDay(day)}${loaded ? tr(', {n} việc', { n: open.length }) : ''}`}
      footer={<QuickAdd defaults={{ due_date: day }} placeholder={tr('Thêm việc cho hôm nay…')} />}
      aside={sel?.id ? undefined : aside}
      // Wide screens reach settings from the rail.
      right={!wide && <View style={s.me}><Avatar onPress={() => router.navigate('/settings')} /></View>}
      maxWidth={100000}
    >
      <StatRow>
        <Stat
          icon="list-outline"
          label={tr('Còn lại')}
          n={due.length}
          foot={<Text style={statText.foot}>{tr('Trên')} <Text style={statText.b}>{due.length + done.length}</Text> {tr('việc hôm nay')}</Text>}
        />
        <Stat
          icon="alert-circle-outline"
          label={tr('Quá hạn')}
          n={over.length}
          tone={over.length ? color.danger : undefined}
          foot={<Text style={statText.foot}>{oldest ? <>{tr('Cũ nhất')} <Text style={[statText.b, { color: color.danger }]}>{tr('{n} ngày', { n: oldest })}</Text></> : tr('Không có việc trễ')}</Text>}
        />
        <Stat
          icon="checkmark-circle-outline"
          label={tr('Đã xong')}
          n={done.length}
          foot={
            <>
              <Text style={statText.foot}>
                {vsYesterday === 0 ? tr('Bằng hôm qua') : (
                  <>
                    <Text style={[statText.b, { color: vsYesterday > 0 ? color.success : color.danger }]}>{vsYesterday > 0 ? '+' : ''}{vsYesterday}</Text> {tr('so với hôm qua')}
                  </>
                )}
              </Text>
              <Bars values={perDay} label={tr('Việc xong 7 ngày qua')} />
            </>
          }
        />
      </StatRow>
      {list}
    </Screen>
  );
}

const s = StyleSheet.create({
  // The header row aligns to the bottom; the avatar sits level with the title instead.
  me: { alignSelf: 'flex-start' },
  groups: { gap: 28 },
  asideHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingBottom: 10, marginBottom: 4, borderBottomWidth: rule.bar, borderBottomColor: color.borderStrong },
  asideTitle: { ...text.h2, color: color.foreground },
  // The week as a strip of seven cells; tomorrow sits in a soft accent wash.
  week: { flexDirection: 'row', gap: 4, marginTop: 8 },
  wd: { flex: 1, alignItems: 'center', gap: 2, paddingTop: 10, paddingBottom: 8, borderRadius: radius.md },
  wdOn: { backgroundColor: color.primaryLight },
  wdDay: { ...text.xs, color: color.muted },
  wdNum: { ...text.base, lineHeight: 22, color: color.foreground, fontVariant: ['tabular-nums'] },
  wdCount: { ...text.xs, height: 16, fontWeight: '600', color: color.primary, fontVariant: ['tabular-nums'] },
  next: { marginTop: 16, padding: 16, gap: 4, borderRadius: radius.lg, backgroundColor: color.background },
  nextHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  nextLabel: { ...text.meta, color: color.muted, fontVariant: ['tabular-nums'] },
  nextTitle: { ...text.base, fontSize: 18, lineHeight: 24, color: color.foreground },
  nextMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mini: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: rule.hair, borderBottomColor: color.border },
  miniBody: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  miniTitle: { ...text.sm, color: color.foreground, flex: 1 },
  miniTime: { ...text.meta, color: color.muted, fontVariant: ['tabular-nums'] },
});
