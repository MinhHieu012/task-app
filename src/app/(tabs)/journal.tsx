import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { dayForMonth, MonthCalendar, monthOf } from '@/components/MonthCalendar';
import { QuickAdd } from '@/components/QuickAdd';
import { TaskGroup } from '@/components/TaskRow';
import { Badge, Card, Empty, Screen, useWide } from '@/components/ui';
import { color, text } from '@/constants/theme';
import { fromIso, toIso, today } from '@/lib/dates';
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
        <Card>
          <View style={s.empty}>
            <Text style={s.emptyTitle}>Chưa ghi việc nào ngày này</Text>
            <Empty>{m ? `Có ${m} việc đến hạn mà không xong. ` : ''}Ghi lại việc đã làm ở ô {wide ? 'phía trên' : 'bên dưới'}.</Empty>
          </View>
        </Card>
      )}
      {groups.map((g) => (
        <TaskGroup key={g.id ?? 'inbox'} title={g.name} tasks={g.items} projects={[]} />
      ))}
    </>
  );

  return (
    <Screen title="Nhật ký" maxWidth={1040} footer={wide ? undefined : log}>
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

const s = StyleSheet.create({
  cols: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  calCol: { width: 360 },
  dayCol: { flex: 1, minWidth: 0, gap: 12 },
  dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingHorizontal: 4 },
  dayTitle: { ...text.base, color: color.foreground },
  badges: { flexDirection: 'row', gap: 6 },
  empty: { alignItems: 'center', paddingTop: 16 },
  emptyTitle: { ...text.base, color: color.foreground },
});
