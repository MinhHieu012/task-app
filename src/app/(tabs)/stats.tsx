import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DayChart } from '@/components/DayChart';
import { Stat, StatRow, statText } from '@/components/Stat';
import { Card, Choices, Empty, IconButton, InfoLine, Screen, TextLink, useWide } from '@/components/ui';
import { color, radius, rule, text } from '@/constants/theme';
import { addDays, daysIn, fmtDay, type Period, periodRange, shiftPeriod, today } from '@/lib/dates';
import { tr } from '@/lib/i18n';
import { dayCounts, periodStats } from '@/lib/journal';
import { reportStats } from '@/lib/reports';
import { type Project, type Report, type Task, useRows } from '@/lib/supabase';

const pct = (r: number | null) => (r === null ? '–' : `${Math.round(r * 100)}%`);

export default function Stats() {
  const wide = useWide();
  const now = today();
  const [kind, setKind] = useState<Period>('week');
  const [anchor, setAnchor] = useState(now);
  const [from, to] = periodRange(kind, anchor);
  const prevFrom = shiftPeriod(kind, anchor, -1);
  const [, prevTo] = periodRange(kind, prevFrom);
  const current = from <= now && now <= to;

  // Done and due tasks of this period and the one before (for the comparison); missed counts follow R12.
  const [done, , loaded] = useRows<Task>('tasks', (q) => q.gte('completed_day', prevFrom).lte('completed_day', to), `st-done:${prevFrom}`);
  const [due] = useRows<Task>('tasks', (q) => q.gte('due_date', prevFrom).lte('due_date', to), `st-due:${prevFrom}`);
  const [projects] = useRows<Project>('projects');
  const [reports] = useRows<Report>('daily_reports', (q) => q.gte('day', from).lte('day', to), `st-rep:${from}`);
  const [first] = useRows<Report>('daily_reports', (q) => q.order('day').limit(1), 'rep:first');
  // The streak runs back from today whatever period is shown (ponytail: caps at 120 days, as in Journal).
  const [recent] = useRows<Report>('daily_reports', (q) => q.gte('day', addDays(now, -120)).lte('day', now), `rep120:${now}`);

  const rows = [...new Map([...done, ...due].map((t) => [t.id, t])).values()];
  const days = daysIn(from, to);
  const st = periodStats(rows, days, projects, now);
  // The running period is compared with the same number of days of the one before, not all of it.
  const elapsed = days.filter((d) => d <= now).length;
  const prev = periodStats(rows, daysIn(prevFrom, prevTo).slice(0, current ? elapsed : undefined), projects, now);
  const diff = st.done - prev.done;
  const rep = reportStats(days.filter((d) => d <= now), reports, first[0]?.day ?? null);

  const counts = Object.fromEntries(days.map((d, i) => [d, st.perDay[i]]));
  const missed = new Set(days.filter((d) => dayCounts(rows, d, now).missed > 0));
  const unit = kind === 'week' ? tr('tuần trước') : tr('tháng trước');
  const [y, m] = from.split('-').map(Number);

  // Highlights of the days so far: the average, the best day, and how many days had anything done.
  const past = days.slice(0, elapsed);
  const best = past.reduce<string | null>((b, d, i) => (st.perDay[i] > (b ? counts[b] : 0) ? d : b), null);
  const activeDays = past.filter((d) => counts[d] > 0).length;
  const avg = elapsed ? (st.done / elapsed).toFixed(1).replace('.', ',') : '0';
  const { ontimeStreak } = reportStats([], recent, null);

  const aside = (
    <>
      <View>
        <Text style={s.asideTitle}>{tr('Điểm nổi bật')}</Text>
        <InfoLine icon="trending-up-outline" label={tr('Trung bình mỗi ngày')} n={tr('{n} việc', { n: avg })} />
        <InfoLine icon="trophy-outline" label={best ? tr('Nhiều nhất ({date})', { date: fmtDay(best) }) : tr('Nhiều nhất')} n={best ? tr('{n} việc', { n: counts[best] }) : '–'} />
        <InfoLine icon="calendar-outline" label={tr('Ngày có làm việc')} n={`${activeDays}/${elapsed}`} />
        <InfoLine icon="alert-circle-outline" label={tr('Ngày có việc lỡ')} n={missed.size} tone={missed.size ? color.warning : undefined} last />
      </View>
      <View>
        <Text style={s.asideTitle}>{tr('Báo cáo ngày')}</Text>
        <InfoLine icon="checkmark-circle-outline" label={tr('Đúng hạn')} n={rep.ontime} tone={rep.ontime ? color.success : undefined} />
        <InfoLine icon="time-outline" label={tr('Nộp trễ')} n={rep.late} tone={rep.late ? color.warning : undefined} />
        <InfoLine icon="alert-circle-outline" label={tr('Thiếu báo cáo')} n={rep.missing} tone={rep.missing ? color.danger : undefined} />
        <InfoLine icon="flame" label={tr('Chuỗi đúng hạn')} n={tr('{n} ngày', { n: ontimeStreak })} tone={ontimeStreak ? color.primary : undefined} last />
      </View>
    </>
  );

  const breakdowns = (
    <View style={wide ? s.pair : s.stack}>
      <Breakdown
        half={wide}
        title={tr('Theo project')}
        items={st.byProject.map((g) => ({ label: g.id ? g.name : tr(g.name), n: g.n }))}
        empty={tr('Chưa có việc nào xong')}
      />
      <Breakdown
        half={wide}
        title={tr('Theo nhãn')}
        items={st.byTag.map(([tag, n]) => ({ label: `#${tag}`, n }))}
        empty={tr('Việc xong trong kỳ này chưa có nhãn.')}
      />
    </View>
  );

  return (
    <Screen
      back
      title={tr('Thống kê')}
      sub={kind === 'week' ? tr('Tuần {from} – {to}', { from: fmtDay(from), to: fmtDay(to) }) : tr('Tháng {m}, {y}', { m, y })}
      aside={aside}
      maxWidth={100000}
    >
      <View style={s.controls}>
        <Choices<Period>
          value={kind}
          onChange={(k) => { setKind(k); setAnchor(now); }}
          options={[{ value: 'week', label: tr('Tuần') }, { value: 'month', label: tr('Tháng') }]}
        />
        <View style={s.nav}>
          {!current && <TextLink label={tr('Về hiện tại')} onPress={() => setAnchor(now)} />}
          <IconButton icon="chevron-back" label={tr('Kỳ trước')} surface size={36} onPress={() => setAnchor(prevFrom)} />
          {/* No future periods: nothing is done or missed there yet. */}
          {!current && <IconButton icon="chevron-forward" label={tr('Kỳ sau')} surface size={36} onPress={() => setAnchor(shiftPeriod(kind, anchor, 1))} />}
        </View>
      </View>

      <StatRow>
        <Stat
          icon="checkmark-done-outline"
          label={tr('Đã xong')}
          n={loaded ? st.done : '–'}
          foot={
            <Text style={statText.foot}>
              {diff === 0 ? tr('Bằng {unit}', { unit }) : (
                <><Text style={[statText.b, { color: diff > 0 ? color.success : color.danger }]}>{diff > 0 ? '+' : ''}{diff}</Text> {tr('so với {unit}', { unit })}</>
              )}
            </Text>
          }
        />
        <Stat
          icon="alert-circle-outline"
          label={tr('Lỡ hạn')}
          n={st.missed}
          tone={st.missed ? color.warning : undefined}
          foot={<Text style={statText.foot}>{tr('Việc đến hạn mà không xong trong ngày')}</Text>}
        />
        <Stat
          icon="speedometer-outline"
          label={tr('Đúng hạn')}
          n={pct(st.rate)}
          foot={
            <Text style={statText.foot}>
              {tr('Trên')} <Text style={statText.b}>{st.due}</Text> {tr('việc đã đến hạn')}
              {prev.rate !== null && <>, {unit} <Text style={statText.b}>{pct(prev.rate)}</Text></>}
            </Text>
          }
        />
        <Stat
          icon="document-text-outline"
          label={tr('Báo cáo đúng hạn')}
          n={rep.ontime}
          foot={<Text style={statText.foot}><Text style={statText.b}>{rep.late}</Text> {tr('trễ')}, <Text style={[statText.b, rep.missing > 0 && { color: color.danger }]}>{rep.missing}</Text> {tr('thiếu')}</Text>}
        />
      </StatRow>
      <DayChart counts={counts} missed={missed} />
      {breakdowns}
    </Screen>
  );
}

/** Ranked lines with a bar each, longest first. */
function Breakdown({ title, items, empty, half }: { title: string; items: { label: string; n: number }[]; empty: string; half?: boolean }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <Card title={title} style={half ? s.flex : undefined}>
      {items.length ? items.map((i, k) => (
        <View key={i.label} style={[s.line, k === items.length - 1 && s.last]}>
          <Text style={s.label} numberOfLines={1}>{i.label}</Text>
          <View style={s.track}><View style={[s.fill, { width: `${(i.n / max) * 100}%` }]} /></View>
          <Text style={s.n}>{i.n}</Text>
        </View>
      )) : <Empty>{empty}</Empty>}
    </Card>
  );
}

const s = StyleSheet.create({
  asideTitle: { ...text.h2, color: color.foreground, paddingBottom: 10, marginBottom: 4, borderBottomWidth: rule.bar, borderBottomColor: color.borderStrong },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pair: { flexDirection: 'row', gap: 24 },
  stack: { gap: 20 },
  flex: { flex: 1, minWidth: 0 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: rule.hair, borderBottomColor: color.border },
  last: { borderBottomWidth: 0 },
  label: { ...text.sm, color: color.foreground, width: '40%' },
  track: { flex: 1, height: 8, borderRadius: radius.full, backgroundColor: color.border, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.full, backgroundColor: color.chartBar },
  n: { ...text.meta, minWidth: 24, textAlign: 'right', color: color.foreground, fontVariant: ['tabular-nums'] },
});
