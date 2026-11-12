import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dayForMonth, MonthCalendar, monthOf } from '@/components/MonthCalendar';
import { ReportBadge } from '@/components/Report';
import { active, Button, Empty, EmptyState, Fab, Field, InfoLine, Screen, useWide } from '@/components/ui';
import { color, radius, rule, text } from '@/constants/theme';
import { addDays, fmtDate, fromIso, today, toIso } from '@/lib/dates';
import { tr } from '@/lib/i18n';
import { DEADLINE, matches, reportStats, reportStatus, snippet, type Status } from '@/lib/reports';
import { type Report, useRows } from '@/lib/supabase';

const WEEKDAY = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export default function Reports() {
  // ponytail: loads every report and searches on the device (accent-insensitive); page it if this grows into years.
  const [reports, , loaded] = useRows<Report>('daily_reports', (q) => q.order('day', { ascending: false }));
  const [q, setQ] = useState('');
  const shown = q.trim() ? reports.filter((r) => matches(r.body, q)) : reports;
  const now = today();
  const mine = reports.find((r) => r.day === now);
  const wide = useWide();
  const openToday = () => router.push({ pathname: '/report/[day]', params: { day: now } });
  const write = (
    <Button
      title={mine ? tr('Sửa báo cáo hôm nay') : tr('Viết báo cáo hôm nay')}
      icon={mine ? 'create-outline' : 'add'}
      variant={mine ? 'outline' : 'primary'}
      onPress={openToday}
    />
  );

  return (
    <Screen
      back
      title={tr('Báo cáo ngày')}
      sub={loaded ? tr('{n} báo cáo, {late} nộp trễ', { n: reports.length, late: reports.filter((r) => r.late).length }) : undefined}
      right={loaded ? write : undefined}
      fab={loaded ? <Fab icon={mine ? 'create-outline' : 'pencil'} label={mine ? tr('Sửa báo cáo hôm nay') : tr('Viết báo cáo hôm nay')} onPress={openToday} /> : undefined}
      aside={loaded && reports.length ? <Overview reports={reports} /> : undefined}
      maxWidth={880}
    >
      <Field value={q} onChangeText={setQ} icon="search-outline" placeholder={tr('Tìm trong báo cáo…')} aria-label={tr('Tìm trong báo cáo')} autoCorrect={false} />
      {loaded && !reports.length && (
        <EmptyState icon="document-text-outline" title={tr('Chưa có báo cáo nào')}>
          {tr('Cuối mỗi ngày, trước {time}, viết vài dòng về việc đã làm. Bản nháp được tạo sẵn từ nhật ký.', { time: DEADLINE })}
        </EmptyState>
      )}
      {loaded && !!reports.length && !shown.length && <Empty>{tr('Không có báo cáo nào khớp “{q}”.', { q: q.trim() })}</Empty>}
      {!!shown.length && (
      <View style={[s.list, !wide && s.listNarrow]}>
        {shown.map((r, i) => (
          <Pressable
            key={r.id}
            onPress={() => router.push({ pathname: '/report/[day]', params: { day: r.day } })}
            accessibilityRole="button"
            style={(st) => [s.row, i === shown.length - 1 && s.last, active(st) && { backgroundColor: color.itemHover }]}
          >
            <View style={s.head}>
              <Text style={s.day}>{tr(WEEKDAY[fromIso(r.day).getDay()])}, {fmtDate(r.day)}</Text>
              <ReportBadge status={r.late ? 'late' : 'ontime'} />
              <Text style={[s.meta, !wide && s.metaNarrow]}>{tr('{done} việc xong, {missed} lỡ', { done: r.done_count, missed: r.missed_count })}</Text>
            </View>
            <Text style={s.snippet} numberOfLines={wide ? 2 : 1}>{snippet(r.body, q)}</Text>
          </Pressable>
        ))}
      </View>
      )}
    </Screen>
  );
}

/** Wide screens: the month at a glance (report marks per day) and the running totals since the first report. */
function Overview({ reports }: { reports: Report[] }) {
  const [day, setDay] = useState(today);
  const { year, month } = monthOf(day);
  const by = new Map(reports.map((r) => [r.day, r]));
  const since = reports.at(-1)?.day ?? null; // sorted newest first

  const counts: Record<string, number> = {};
  const missed = new Set<string>();
  for (let d = 1, n = new Date(year, month, 0).getDate(); d <= n; d++) {
    const iso = toIso(new Date(year, month - 1, d));
    counts[iso] = by.get(iso)?.done_count ?? 0;
    if (by.get(iso)?.missed_count) missed.add(iso);
  }
  const statuses: Record<string, Status> = Object.fromEntries(Object.keys(counts).map((d) => [d, reportStatus(d, by.get(d), since)]));

  // ponytail: walks every day since the first report; fine for years of reports.
  const days: string[] = [];
  for (let d = since, end = today(); d && d <= end; d = addDays(d, 1)) days.push(d);
  const st = reportStats(days, reports, since);

  return (
    <>
      <MonthCalendar
        year={year}
        month={month}
        selected={day}
        counts={counts}
        missed={missed}
        reports={statuses}
        onSelect={(d) => {
          setDay(d);
          router.push({ pathname: '/report/[day]', params: { day: d } });
        }}
        onMonth={(delta) => setDay(dayForMonth(year, month + delta))}
      />
      <View>
        <Text style={s.asideTitle}>{tr('Tổng quan')}</Text>
        <InfoLine icon="checkmark-circle-outline" label={tr('Đúng hạn')} n={st.ontime} tone={st.ontime ? color.success : undefined} />
        <InfoLine icon="time-outline" label={tr('Nộp trễ')} n={st.late} tone={st.late ? color.warning : undefined} />
        <InfoLine icon="alert-circle-outline" label={tr('Thiếu báo cáo')} n={st.missing} tone={st.missing ? color.danger : undefined} />
        <InfoLine icon="flame-outline" label={tr('Chuỗi hiện tại')} n={tr('{n} ngày', { n: st.streak })} />
        <InfoLine icon="flame" label={tr('Chuỗi đúng hạn')} n={tr('{n} ngày', { n: st.ontimeStreak })} tone={st.ontimeStreak ? color.primary : undefined} last />
      </View>
    </>
  );
}

const s = StyleSheet.create({
  asideTitle: { ...text.h2, color: color.foreground, paddingBottom: 10, marginBottom: 12, borderBottomWidth: rule.bar, borderBottomColor: color.borderStrong },
  list: { backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: rule.hair, borderColor: color.border, overflow: 'hidden' },
  listNarrow: { borderWidth: 0 },
  // Phones: the counts start their own line at the left, under the day.
  metaNarrow: { marginLeft: 0, width: '100%' },
  row: { paddingVertical: 14, paddingHorizontal: 16, gap: 6, borderBottomWidth: rule.hair, borderBottomColor: color.border },
  last: { borderBottomWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  day: { ...text.base, color: color.foreground, fontVariant: ['tabular-nums'] },
  meta: { ...text.meta, color: color.muted, marginLeft: 'auto', fontVariant: ['tabular-nums'] },
  snippet: { ...text.sm, color: color.soft },
});
