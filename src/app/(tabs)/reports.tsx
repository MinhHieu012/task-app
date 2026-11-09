import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ReportBadge } from '@/components/Report';
import { active, Empty, EmptyState, Field, Screen } from '@/components/ui';
import { color, radius, rule, text } from '@/constants/theme';
import { fmtDay, fromIso } from '@/lib/dates';
import { tr } from '@/lib/i18n';
import { DEADLINE, matches, snippet } from '@/lib/reports';
import { type Report, useRows } from '@/lib/supabase';

const WEEKDAY = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export default function Reports() {
  // ponytail: loads every report and searches on the device (accent-insensitive); page it if this grows into years.
  const [reports, , loaded] = useRows<Report>('daily_reports', (q) => q.order('day', { ascending: false }));
  const [q, setQ] = useState('');
  const shown = q.trim() ? reports.filter((r) => matches(r.body, q)) : reports;

  return (
    <Screen back title={tr('Báo cáo ngày')} sub={loaded ? tr('{n} báo cáo, {late} nộp trễ', { n: reports.length, late: reports.filter((r) => r.late).length }) : undefined}>
      <Field value={q} onChangeText={setQ} icon="search-outline" placeholder={tr('Tìm trong báo cáo…')} aria-label={tr('Tìm trong báo cáo')} autoCorrect={false} />
      {loaded && !reports.length && (
        <EmptyState icon="document-text-outline" title={tr('Chưa có báo cáo nào')}>
          {tr('Cuối mỗi ngày, trước {time}, viết vài dòng về việc đã làm. Bản nháp được tạo sẵn từ nhật ký.', { time: DEADLINE })}
        </EmptyState>
      )}
      {loaded && !!reports.length && !shown.length && <Empty>{tr('Không có báo cáo nào khớp “{q}”.', { q: q.trim() })}</Empty>}
      {!!shown.length && (
      <View style={s.list}>
        {shown.map((r, i) => (
          <Pressable
            key={r.id}
            onPress={() => router.push({ pathname: '/report/[day]', params: { day: r.day } })}
            accessibilityRole="button"
            style={(st) => [s.row, i === shown.length - 1 && s.last, active(st) && { backgroundColor: color.itemHover }]}
          >
            <View style={s.head}>
              <Text style={s.day}>{tr(WEEKDAY[fromIso(r.day).getDay()])}, {fmtDay(r.day)}</Text>
              <ReportBadge status={r.late ? 'late' : 'ontime'} />
              <Text style={s.meta}>{tr('{done} việc xong, {missed} lỡ', { done: r.done_count, missed: r.missed_count })}</Text>
            </View>
            <Text style={s.snippet} numberOfLines={2}>{snippet(r.body, q)}</Text>
          </Pressable>
        ))}
      </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  list: { backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: rule.hair, borderColor: color.border, overflow: 'hidden' },
  row: { paddingVertical: 14, paddingHorizontal: 16, gap: 6, borderBottomWidth: rule.hair, borderBottomColor: color.border },
  last: { borderBottomWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  day: { ...text.base, color: color.foreground, fontVariant: ['tabular-nums'] },
  meta: { ...text.meta, color: color.muted, marginLeft: 'auto', fontVariant: ['tabular-nums'] },
  snippet: { ...text.sm, color: color.soft },
});
