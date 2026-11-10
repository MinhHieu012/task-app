import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DayChart } from '@/components/DayChart';
import { dayForMonth, MonthCalendar, monthOf } from '@/components/MonthCalendar';
import { QuickAdd } from '@/components/QuickAdd';
import { ReportCard } from '@/components/Report';
import { Stat, StatRow, statText } from '@/components/Stat';
import { TaskGroup } from '@/components/TaskRow';
import { Badge, Button, Card, EmptyState, Field, Screen, useWide } from '@/components/ui';
import { color, rule, text } from '@/constants/theme';
import { addDays, fmtDay, fromIso, toIso, today } from '@/lib/dates';
import { tr } from '@/lib/i18n';
import { dayCounts, groupByProject, monthCounts } from '@/lib/journal';
import { reportStats, reportStatus, type Status } from '@/lib/reports';
import { type JournalNote, ok, type Project, refresh, type Report, supabase, type Task, useRows } from '@/lib/supabase';

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
      <DayNote key={day} day={day} />
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
    <Screen
      title={tr('Nhật ký')}
      sub={tr('Tháng {m}, {y}', { m: month, y: year })}
      // Wide screens reach the stats from the rail.
      right={!wide && <Button title={tr('Thống kê')} icon="stats-chart-outline" onPress={() => router.navigate('/stats')} />}
      maxWidth={100000}
      footer={wide ? undefined : log}
    >
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
          foot={<Text style={statText.foot}><Text style={statText.b}>{rep.late}</Text> {tr('trễ')}, <Text style={[statText.b, rep.missing > 0 && { color: color.danger }]}>{rep.missing}</Text> {tr('thiếu')}, {tr('chuỗi đúng hạn')} <Text style={statText.b}>{tr('{n} ngày', { n: rep.ontimeStreak })}</Text></Text>}
        />
      </StatRow>
      <DayChart counts={counts} missed={missed} selected={day} onSelect={setDay} />
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

/** A free note for the day, beside the done tasks and the report. Mounted per day (key), so a draft is per day. */
function DayNote({ day }: { day: string }) {
  const [rows, , loaded] = useRows<JournalNote>('journal_notes', (q) => q.eq('day', day), `note:${day}`);
  const saved = rows[0]?.body ?? '';
  const [draft, setDraft] = useState<string | null>(null); // null: showing what is saved
  const [busy, setBusy] = useState(false);
  const dirty = draft !== null && draft.trim() !== saved;

  const save = async () => {
    const body = draft!.trim();
    setBusy(true);
    // Emptied: the row goes, so an empty note never lingers.
    const res = body
      ? await supabase.from('journal_notes').upsert({ day, body, updated_at: new Date().toISOString() }, { onConflict: 'user_id,day' })
      : await supabase.from('journal_notes').delete().eq('day', day);
    setBusy(false);
    if (!ok(res)) return;
    setDraft(null);
    refresh('journal_notes');
  };

  return (
    <Card title={tr('Ghi chú trong ngày')}>
      <View style={s.note}>
        <Field
          value={draft ?? saved}
          onChangeText={setDraft}
          editable={loaded}
          multiline
          maxLength={20000}
          placeholder={tr('Hôm nay thế nào? Điều gì đáng nhớ, điều gì muốn làm khác đi…')}
          aria-label={tr('Ghi chú trong ngày')}
          style={s.noteInput}
        />
        {dirty && (
          <View style={s.noteActions}>
            <Button title={tr('Huỷ')} variant="ghost" onPress={() => setDraft(null)} />
            <Button title={tr('Lưu ghi chú')} variant="primary" onPress={save} loading={busy} />
          </View>
        )}
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  note: { gap: 12 },
  noteInput: { height: 112, paddingTop: 12, textAlignVertical: 'top' },
  noteActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  cols: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  calCol: { width: 380 },
  dayCol: { flex: 1, minWidth: 0, gap: 16 },
  dayHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingBottom: 10, borderBottomWidth: rule.bar, borderBottomColor: color.borderStrong },
  dayTitle: { ...text.h2, color: color.foreground, fontVariant: ['tabular-nums'] },
  badges: { flexDirection: 'row', gap: 6 },
});
