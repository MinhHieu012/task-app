import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dayForMonth, MonthCalendar, monthOf } from '@/components/MonthCalendar';
import { QuickAdd } from '@/components/QuickAdd';
import { ReportCard } from '@/components/Report';
import { Stat, StatRow, statText } from '@/components/Stat';
import { TaskGroup } from '@/components/TaskRow';
import { Badge, Card, EmptyState, Screen, useWide, webEase } from '@/components/ui';
import { color, rule, text } from '@/constants/theme';
import { addDays, fmtDay, fromIso, toIso, today } from '@/lib/dates';
import { tr } from '@/lib/i18n';
import { dayCounts, groupByProject, monthCounts } from '@/lib/journal';
import { reportStats, reportStatus, type Status } from '@/lib/reports';
import { type Project, type Report, type Task, useRows } from '@/lib/supabase';

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
  // Reports of the month, plus the last 120 days for the streak (ponytail: a streak caps at 120 days).
  const recent = addDays(today(), -120);
  const [reports] = useRows<Report>('daily_reports', (q) => q.gte('day', from < recent ? from : recent).lte('day', to), `rep:${from}`);
  // The first report ever: days before it are not counted as missing.
  const [first] = useRows<Report>('daily_reports', (q) => q.order('day').limit(1), 'rep:first');
  const since = first[0]?.day ?? null;

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
  const byDay = new Map(reports.map((r) => [r.day, r]));
  const statuses: Record<string, Status> = Object.fromEntries(Object.keys(counts).map((d) => [d, reportStatus(d, byDay.get(d), since)]));
  const rep = reportStats(days, reports, since);
  const avg = days.length ? (total / days.length).toFixed(1).replace('.', ',') : '0';

  const wide = useWide();
  const log = <QuickAdd defaults={logDefaults} placeholder={isToday ? tr('Ghi việc đã làm hôm nay…') : tr('Ghi việc đã làm ngày {day}…', { day: label })} />;
  const calendar = (
    <Card>
      <MonthCalendar
        year={year}
        month={month}
        selected={day}
        counts={counts}
        missed={missed}
        reports={statuses}
        onSelect={setDay}
        onMonth={(delta) => setDay(dayForMonth(year, month + delta))}
      />
    </Card>
  );
  const dayList = (
    <>
      <View style={s.dayHead}>
        <Text style={s.dayTitle}>{isToday ? tr('Hôm nay') : tr(WEEKDAY[fromIso(day).getDay()])}, {label}</Text>
        <View style={s.badges}>
          <Badge tone="success" label={tr('Xong {n}', { n })} />
          {m > 0 && <Badge tone="warning" label={tr('Trễ {n}', { n: m })} />}
        </View>
      </View>
      <ReportCard day={day} report={byDay.get(day)} status={statuses[day] ?? 'none'} />
      {wide && log}
      {loaded && !groups.length && (
        <EmptyState icon="book-outline" title={tr('Chưa ghi việc nào ngày này')}>
          {m ? tr('Có {n} việc đến hạn mà không xong.', { n: m }) + ' ' : ''}{wide ? tr('Ghi lại việc đã làm ở ô phía trên.') : tr('Ghi lại việc đã làm ở ô bên dưới.')}
        </EmptyState>
      )}
      {groups.map((g) => (
        <TaskGroup key={g.id ?? 'inbox'} title={g.id ? g.name : tr(g.name)} tasks={g.items} />
      ))}
    </>
  );

  return (
    <Screen title={tr('Nhật ký')} sub={tr('Tháng {m}, {y}', { m: month, y: year })} maxWidth={100000} footer={wide ? undefined : log}>
      <StatRow>
        <Stat
          icon="checkmark-done-outline"
          label={tr('Xong trong tháng')}
          n={total}
          foot={<Text style={statText.foot}>{best ? <>{tr('Nhiều nhất')} <Text style={statText.b}>{tr('{n} việc', { n: counts[best] })}</Text> {tr('ngày {date}', { date: fmtDay(best) })}</> : tr('Chưa có việc nào xong')}</Text>}
        />
        <Stat
          icon="calendar-outline"
          label={tr('Ngày có làm việc')}
          n={active}
          foot={<Text style={statText.foot}>{tr('Trên')} <Text style={statText.b}>{days.length}</Text> {tr('ngày, trung bình')} <Text style={statText.b}>{avg}</Text> {tr('việc/ngày')}</Text>}
        />
        <Stat
          icon="alert-circle-outline"
          label={tr('Ngày có việc lỡ')}
          n={missed.size}
          tone={missed.size ? color.warning : undefined}
          foot={<Text style={statText.foot}>{lastMissed ? <>{tr('Gần nhất')} <Text style={[statText.b, { color: color.warning }]}>{fmtDay(lastMissed)}</Text></> : tr('Không lỡ ngày nào')}</Text>}
        />
        <Stat
          icon="document-text-outline"
          label={tr('Báo cáo đúng hạn')}
          n={rep.ontime}
          foot={<Text style={statText.foot}><Text style={statText.b}>{rep.late}</Text> {tr('trễ')}, <Text style={[statText.b, rep.missing > 0 && { color: color.danger }]}>{rep.missing}</Text> {tr('thiếu')}, {tr('chuỗi')} <Text style={statText.b}>{tr('{n} ngày', { n: rep.streak })}</Text></Text>}
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
    <Card title={tr('Việc xong theo ngày')} action={<Text style={s.legend}>{top ? tr('Cao nhất {n} việc', { n: top }) : tr('Chưa có việc xong tháng này')}</Text>}>
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
              accessibilityLabel={tr('{date}: {n} việc xong', { date: fmtDay(d), n: v })}
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
  dayHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingBottom: 10, borderBottomWidth: rule.bar, borderBottomColor: color.borderStrong },
  dayTitle: { ...text.h2, color: color.foreground, fontVariant: ['tabular-nums'] },
  badges: { flexDirection: 'row', gap: 6 },
  legend: { ...text.meta, color: color.muted, fontVariant: ['tabular-nums'] },
  // The month's one chart, set large: bars stand on a baseline rule.
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  col: { flex: 1, minWidth: 0, alignItems: 'center', gap: 6 },
  barArea: { height: 140, width: '100%', justifyContent: 'flex-end', alignItems: 'center', borderBottomWidth: rule.bar, borderBottomColor: color.borderStrong },
  bar: { width: '100%', maxWidth: 18, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  miss: { width: 5, height: 5, borderRadius: 3 },
  // Fixed width wider than a phone's day column, centred on it, so two-digit days are not cut.
  tick: { ...text.xs, fontSize: 11, lineHeight: 14, height: 14, width: 28, textAlign: 'center', color: color.muted, fontVariant: ['tabular-nums'] },
});
