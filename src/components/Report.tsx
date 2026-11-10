// Daily report pieces shared by Today, Journal, the report list and the editor screen.
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import RichView from '@/components/dom/RichView';
import type { EditorLabels, Palette } from '@/components/dom/RichEditor';
import { Badge, Button, Card, TextLink } from '@/components/ui';
import { color, radius, text } from '@/constants/theme';
import { fmtDate, localDay } from '@/lib/dates';
import { tr } from '@/lib/i18n';
import { DEADLINE, type Status } from '@/lib/reports';
import type { Report } from '@/lib/supabase';

/** Theme colours for the DOM components, which can't import the theme themselves on native. */
export const palette: Palette = {
  fg: color.foreground, muted: color.muted, border: color.border, accent: color.primary, wash: color.primaryLight, surface: color.surface, hover: color.itemHover,
  field: color.field, edge: color.fieldEdge, ring: color.ringFocus,
};

/** Toolbar labels for RichEditor; a function because tr() can't run at module level. */
export const editorLabels = (placeholder: string): EditorLabels => ({
  style: tr('Kiểu đoạn'), paragraph: tr('Đoạn văn'), heading: tr('Tiêu đề'), subheading: tr('Tiêu đề nhỏ'), quote: tr('Trích dẫn'),
  bold: tr('Đậm'), italic: tr('Nghiêng'), underline: tr('Gạch chân'), strike: tr('Gạch ngang'), bullets: tr('Gạch đầu dòng'), numbers: tr('Danh sách số'),
  undo: tr('Hoàn tác'), redo: tr('Làm lại'), clear: tr('Xoá định dạng'), placeholder,
});

const BADGE: Partial<Record<Status, [string, 'success' | 'warning' | 'error' | 'neutral']>> = {
  ontime: ['Đã nộp', 'success'],
  late: ['Nộp trễ', 'warning'],
  missing: ['Chưa nộp', 'error'],
  pending: ['Hạn {time}', 'neutral'],
};
export function ReportBadge({ status }: { status: Status }) {
  const b = BADGE[status];
  return b ? <Badge label={tr(b[0], { time: DEADLINE })} tone={b[1]} /> : null;
}

/** Colour of a status mark on the calendar. */
export const statusColor = (s: Status) => (s === 'ontime' ? color.success : s === 'late' ? color.warning : s === 'missing' ? color.danger : undefined);

/** "HH:MM" local time of a timestamp. */
export const timeOf = (at: string) => new Date(at).toTimeString().slice(0, 5);

/** The selected day's report in the journal: read it, or a button to write it. */
export function ReportCard({ day, report, status }: { day: string; report?: Report; status: Status }) {
  const open = () => router.push({ pathname: '/report/[day]', params: { day } });
  return (
    <Card
      title={
        <View style={s.head}>
          <Text style={s.title}>{tr('Báo cáo ngày')}</Text>
          <ReportBadge status={status} />
        </View>
      }
      action={<TextLink label={tr('Tất cả báo cáo')} onPress={() => router.push('/reports')} />}
    >
      {report ? (
        <View style={s.gap}>
          <RichView html={report.content} palette={palette} dom={{ matchContents: true, scrollEnabled: false }} />
          <View style={s.row}>
            <Text style={s.meta}>{tr('Nộp lúc {time} ngày {date}', { time: timeOf(report.submitted_at), date: fmtDate(localDay(new Date(report.submitted_at))) })}</Text>
            <Button title={tr('Sửa báo cáo')} icon="create-outline" onPress={open} />
          </View>
        </View>
      ) : (
        <View style={s.row}>
          <Text style={s.meta}>{status === 'pending' ? tr('Hạn nộp {time} tối nay.', { time: DEADLINE }) : tr('Chưa có báo cáo cho ngày này.')}</Text>
          <Button title={tr('Viết báo cáo')} icon="create-outline" variant="primary" onPress={open} />
        </View>
      )}
    </Card>
  );
}

/** The run of on-time reports, as a small flame chip. */
function Streak({ n }: { n: number }) {
  if (!n) return null;
  return (
    <View style={s.streak} accessibilityLabel={tr('Chuỗi nộp đúng hạn: {n} ngày', { n })}>
      <Ionicons name="flame" size={14} color={color.primary} />
      <Text style={s.streakText}>{tr('{n} ngày đúng hạn', { n })}</Text>
    </View>
  );
}

/** Today: a reminder line until today's report is in (web has no notifications), with the on-time streak.
 *  Once past the deadline the streak is already lost, so it is not shown. */
export function ReportNudge({ day, report, status, streak = 0 }: { day: string; report?: Report; status: Status; streak?: number }) {
  const open = () => router.push({ pathname: '/report/[day]', params: { day } });
  if (report) {
    return (
      <View style={[s.nudge, s.nudgeDone]}>
        <Ionicons name="document-text-outline" size={18} color={color.success} />
        <Text style={s.nudgeText}>{tr('Đã nộp báo cáo hôm nay lúc {time}.', { time: timeOf(report.submitted_at) })}</Text>
        <Streak n={streak} />
        <TextLink label={tr('Xem')} onPress={open} />
      </View>
    );
  }
  const late = status === 'missing';
  return (
    <View style={[s.nudge, late && s.nudgeLate]}>
      <Ionicons name="document-text-outline" size={18} color={late ? color.danger : color.primary} />
      <Text style={s.nudgeText}>
        {late ? tr('Đã quá {time}: báo cáo hôm nay vẫn nộp được nhưng sẽ tính là trễ.', { time: DEADLINE }) : tr('Báo cáo ngày: hạn {time} tối nay.', { time: DEADLINE })}
      </Text>
      {!late && <Streak n={streak} />}
      <Button title={tr('Viết báo cáo')} variant="primary" onPress={open} />
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { ...text.h2, color: color.foreground },
  gap: { gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  meta: { ...text.meta, color: color.muted, flexShrink: 1 },
  nudge: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: 14, paddingLeft: 16, borderRadius: 14, backgroundColor: color.primaryLight },
  nudgeLate: { backgroundColor: color.dangerBg },
  nudgeDone: { backgroundColor: color.successBg },
  nudgeText: { ...text.sm, color: color.foreground, flex: 1, minWidth: 180 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, backgroundColor: color.surface },
  streakText: { ...text.xs, fontWeight: '600', color: color.primary, fontVariant: ['tabular-nums'] },
});
