import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dayForMonth, MonthCalendar, monthOf } from '@/components/MonthCalendar';
import { QuickAdd } from '@/components/QuickAdd';
import { Stat, StatRow, statText } from '@/components/Stat';
import { TaskGroup } from '@/components/TaskRow';
import { Badge, Card, EmptyState, Screen, useWide, webEase } from '@/components/ui';
import { color, radius, text } from '@/constants/theme';
import { fmtDay, fromIso, toIso, today } from '@/lib/dates';
import { dayCounts, groupByProject, monthCounts } from '@/lib/journal';
import { type Project, type Task, useRows } from '@/lib/supabase';

const WEEKDAY = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export default function Journal() {
  const [day, setDay] = useState(today);
  const { year, month } = monthOf(day);
  const from = toIso(new Date(year, month - 1, 1));
  const to = toIso(new Date(year, month, 0));

  // Done entries of the month (list + calendar) and tasks due in the month (missed counts, R12).
  const [done, , loaded] = useRows<Task>('tasks', (q) => q.gte('completed_day', from).lte('completed_day', to), `done:${from}`);
  const [due] = useRows<Task>('tasks', (q) => q.gte('due_date', from).lte('due_date', to), `due:${from}`);
  const [projects] = useRows<Project>('projects');

  const rows = [...new Map([...done, ...due].map((t) => [t.id, t])).values()];
  const counts = monthCounts(rows, year, month);
  const missed = new Set(Object.keys(counts).filter((d) => dayCounts(rows, d).missed > 0));
  const { done: n, missed: m } = dayCounts(rows, day);
  const groups = groupByProject(done.filter((t) => t.completed_day === day), projects);

  const isToday = day === today();
  const label = `${day.slice(8)}/${day.slice(5, 7)}`;
  const logDefaults = () => {
    // Today: now. Another day: 12:00 local of that day (U6).
    const at = isToday ? new Date() : new Date(fromIso(day).setHours(12));
    return { completed_at: at.toISOString(), completed_day: day, due_date: day, due_time: at.toTimeString().slice(0, 5) };
  };

  // Month summary for the number cards: only days up to today count.
  const now = today();
  const days = Object.keys(counts).sort().filter((d) => d <= now);
  const total = days.reduce((sum, d) => sum + counts[d], 0);
  const active = days.filter((d) => counts[d] > 0).length;
  const best = days.reduce<string | null>((b, d) => (counts[d] > (b ? counts[b] : 0) ? d : b), null);
  const lastMissed = [...missed].sort().at(-1);
  const avg = days.length ? (total / days.length).toFixed(1).replace('.', ',') : '0';

  const wide = useWide();
  const log = <QuickAdd defaults={logDefaults} placeholder={isToday ? 'Ghi việc đã làm hôm nay…' : `Ghi việc đã làm ngày ${label}…`} />;
  const calendar = (
    <Card>
      <MonthCalendar
        year={year}
        month={month}
        selected={day}
        counts={counts}
        missed={missed}
        onSelect={setDay}
        onMonth={(delta) => setDay(dayForMonth(year, month + delta))}
      />
    </Card>
  );
  const dayList = (
    <>
      <View style={s.dayHead}>
        <Text style={s.dayTitle}>{isToday ? 'Hôm nay' : WEEKDAY[fromIso(day).getDay()]}, {label}</Text>
        <View style={s.badges}>
          <Badge tone="success" label={`Xong ${n}`} />
          {m > 0 && <Badge tone="warning" label={`Trễ ${m}`} />}
        </View>
      </View>
      {wide && log}
      {loaded && !groups.length && (
        <EmptyState icon="book-outline" title="Chưa ghi việc nào ngày này">
          {m ? `Có ${m} việc đến hạn mà không xong. ` : ''}Ghi lại việc đã làm ở ô {wide ? 'phía trên' : 'bên dưới'}.
        </EmptyState>
      )}
      {groups.map((g) => (
        <TaskGroup key={g.id ?? 'inbox'} title={g.name} tasks={g.items} />
      ))}
    </>
  );

  return (
    <Screen title="Nhật ký" sub={`Tháng ${month}, ${year}`} maxWidth={100000} footer={wide ? undefined : log}>
      <StatRow>
        <Stat
          icon="checkmark-done-outline"
          label="Xong trong tháng"
          n={total}
          foot={<Text style={statText.foot}>{best ? <>Nhiều nhất <Text style={statText.b}>{counts[best]} việc</Text> ngày {fmtDay(best)}</> : 'Chưa có việc nào xong'}</Text>}
        />
        <Stat
          icon="calendar-outline"
          label="Ngày có làm việc"
          n={active}
          foot={<Text style={statText.foot}>Trên <Text style={statText.b}>{days.length}</Text> ngày · trung bình <Text style={statText.b}>{avg}</Text> việc/ngày</Text>}
        />
        <Stat
          icon="alert-circle-outline"
          label="Ngày có việc lỡ"
          n={missed.size}
          tone={missed.size ? color.warning : undefined}
          foot={<Text style={statText.foot}>{lastMissed ? <>Gần nhất <Text style={[statText.b, { color: color.warning }]}>{fmtDay(lastMissed)}</Text></> : 'Không lỡ ngày nào'}</Text>}
        />
      </StatRow>
      <MonthChart counts={counts} missed={missed} selected={day} onSelect={setDay} />
      {/* Wide screens: calendar on the left, the selected day on the right. */}
      {wide ? (
        <View style={s.cols}>
          <View style={s.calCol}>{calendar}</View>
          <View style={s.dayCol}>{dayList}</View>
        </View>
      ) : (
        <>
          {calendar}
          {dayList}
        </>
      )}
    </Screen>
  );
}

/** Done per day of the month as bars (Figma "Task Done" chart); a bar selects its day. */
function MonthChart({ counts, missed, selected, onSelect }: { counts: Record<string, number>; missed: Set<string>; selected: string; onSelect: (d: string) => void }) {
  const now = today();
  const days = Object.keys(counts).sort();
  const top = Math.max(...days.map((d) => counts[d]));
  const max = Math.max(top, 1);
  return (
    <Card title="Việc xong theo ngày" action={<Text style={s.legend}>{top ? `Cao nhất ${top} việc` : 'Chưa có việc xong tháng này'}</Text>}>
      <View style={s.chart}>
        {days.map((d) => {
          const future = d > now;
          const on = d === selected;
          const v = counts[d];
          return (
            <Pressable
              key={d}
              onPress={() => onSelect(d)}
              disabled={future}
              accessibilityRole="button"
              accessibilityLabel={`${fmtDay(d)}: ${v} việc xong`}
              accessibilityState={{ selected: on, disabled: future }}
              style={s.col}
            >
              {(st) => (
                <>
                  <View style={s.barArea}>
                    <View
                      style={[
                        s.bar,
                        webEase,
                        { height: v ? 6 + (v / max) * 114 : 4 },
                        { backgroundColor: on ? color.primary : (st as { hovered?: boolean }).hovered ? color.chartBarHover : v ? color.chartBar : color.border },
                        future && { opacity: 0.4 },
                      ]}
                    />
                  </View>
                  <View style={[s.miss, missed.has(d) && { backgroundColor: color.warning }]} />
                  <Text style={[s.tick, on && { color: color.primary, fontWeight: '600' }]}>{Number(d.slice(8)) % 5 === 1 || on ? Number(d.slice(8)) : ''}</Text>
                </>
              )}
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  cols: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  calCol: { width: 380 },
  dayCol: { flex: 1, minWidth: 0, gap: 16 },
  dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingHorizontal: 4 },
  dayTitle: { ...text.h2, color: color.foreground },
  badges: { flexDirection: 'row', gap: 6 },
  legend: { ...text.meta, color: color.muted },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  col: { flex: 1, minWidth: 0, alignItems: 'center', gap: 6 },
  barArea: { height: 120, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '100%', maxWidth: 18, borderRadius: radius.sm },
  miss: { width: 5, height: 5, borderRadius: 3 },
  tick: { ...text.xs, fontSize: 11, lineHeight: 14, height: 14, color: color.muted },
});
