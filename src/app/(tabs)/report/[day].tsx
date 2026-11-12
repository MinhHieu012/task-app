import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Editor } from '@/components/Rich';
import { editorLabels, palette, ReportBadge, timeOf } from '@/components/Report';
import { Button, InfoLine, Screen } from '@/components/ui';
import { color, rule, text } from '@/constants/theme';
import { fmtDate, localDay, today } from '@/lib/dates';
import { tr } from '@/lib/i18n';
import { dayCounts, groupByProject } from '@/lib/journal';
import { confirmAction, toast } from '@/lib/notify';
import { DEADLINE, draftHtml, isLate, reportStatus } from '@/lib/reports';
import { ok, type Project, refresh, type Report, type Subtask, supabase, type Task, useRows } from '@/lib/supabase';

export default function ReportScreen() {
  const { day = '' } = useLocalSearchParams<{ day: string }>();
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(day) && day <= today();
  const [reports, , rLoaded] = useRows<Report>('daily_reports', (q) => q.eq('day', day), `r:${day}`);
  const [done, , dLoaded] = useRows<Task>('tasks', (q) => q.eq('completed_day', day), `d:${day}`);
  const [due, , uLoaded] = useRows<Task>('tasks', (q) => q.eq('due_date', day), `u:${day}`);
  const [projects, , pLoaded] = useRows<Project>('projects');
  // The subtasks of the day's tasks, for the draft. Keyed by the ids, so it reloads (and holds `ready`) as they come in.
  const ids = [...new Set([...done, ...due].map((t) => t.id))];
  const [subs, , sLoaded] = useRows<Subtask>('subtasks', (q) => q.in('task_id', ids).order('created_at'), `rs:${ids.join()}`);
  const ready = rLoaded && dLoaded && uLoaded && pLoaded && sLoaded;
  const show = valid && ready;

  return (
    <Screen
      back="always"
      fit
      title={valid ? tr('Báo cáo ngày {date}', { date: fmtDate(day) }) : tr('Không có ngày này')}
      // No sub: the status line under the title already gives the deadline in every state.
      aside={show ? <DayAside day={day} done={done} due={due} projects={projects} /> : undefined}
      maxWidth={880}
    >
      {show && <ReportForm key={day} day={day} report={reports.find((r) => r.day === day)} done={done} due={due} projects={projects} subs={subs} />}
    </Screen>
  );
}

/** Wide screens: the day's work beside the editor, so the report can be written without leaving the page. */
function DayAside({ day, done, due, projects }: { day: string; done: Task[]; due: Task[]; projects: Project[] }) {
  const open = due.filter((t) => !t.completed_day || t.completed_day > day);
  const doneCount = done.filter((t) => t.completed_day === day).length;
  const missed = day < today() && open.length > 0;
  const groups = groupByProject(done.filter((t) => t.completed_day === day), projects);

  return (
    <>
      <View>
        <Text style={s.asideTitle}>{tr('Trong ngày')}</Text>
        <InfoLine icon="checkmark-circle-outline" label={tr('Đã xong')} n={doneCount} tone={doneCount ? color.success : undefined} />
        <InfoLine icon="alert-circle-outline" label={tr('Chưa xong')} n={open.length} tone={missed ? color.danger : undefined} last />
      </View>
      <View>
        <Text style={s.asideTitle}>{tr('Việc đã xong')}</Text>
        {groups.length ? groups.map((g) => (
          <View key={g.id ?? 'inbox'} style={s.group}>
            <Text style={s.groupName}>{g.id ? g.name : tr(g.name)}</Text>
            {g.items.map((t) => (
              <View key={t.id} style={s.item}>
                <Ionicons name="checkmark" size={14} color={color.success} style={s.itemIcon} />
                <Text style={s.itemText}>{t.title}</Text>
              </View>
            ))}
          </View>
        )) : <Text style={s.meta}>{tr('Chưa có việc nào xong trong ngày.')}</Text>}
      </View>
      {open.length > 0 && (
        <View>
          <Text style={s.asideTitle}>{tr('Chưa xong')}</Text>
          {open.map((t) => (
            <View key={t.id} style={s.item}>
              <Ionicons name="ellipse-outline" size={14} color={color.muted} style={s.itemIcon} />
              <Text style={s.itemText}>{t.title}</Text>
            </View>
          ))}
        </View>
      )}
    </>
  );
}

/** Mounted once the data is in, so the draft is built once and later realtime reloads don't reset the editor. */
function ReportForm({ day, report, done, due, projects, subs }: { day: string; report?: Report; done: Task[]; due: Task[]; projects: Project[]; subs: Subtask[] }) {
  const [initial] = useState(() => {
    if (report) return report.content;
    const groups = groupByProject(done, projects).map((g) => ({ name: g.id ? g.name : tr(g.name), items: g.items }));
    return draftHtml(groups, due.filter((t) => !t.completed_day || t.completed_day > day), subs);
  });
  const content = useRef({ html: initial, text: report?.body ?? '' });
  const [busy, setBusy] = useState(false);
  const status = reportStatus(day, report, day);
  // Past the day's deadline a report is on the record: it can still be edited, but no longer deleted.
  const locked = isLate(day, new Date());
  const edited = report && +new Date(report.updated_at) - +new Date(report.submitted_at) > 60_000;

  const remove = async () => {
    if (!report || locked) return;
    if (!(await confirmAction(tr('Xoá báo cáo ngày {date}?', { date: fmtDate(day) }), tr('Báo cáo sẽ bị xoá vĩnh viễn. Bạn vẫn viết lại được trước {time}.', { time: DEADLINE })))) return;
    if (!ok(await supabase.from('daily_reports').delete().eq('id', report.id))) return;
    refresh('daily_reports');
    toast(tr('Đã xoá báo cáo ngày {date}.', { date: fmtDate(day) }), tr('Đã xoá'), 'success');
    router.back();
  };

  const save = async () => {
    const { html, text: body } = content.current;
    if (!body.trim()) return toast(tr('Viết vài dòng trước khi nộp.'), tr('Báo cáo đang trống'), 'error');
    setBusy(true);
    const now = new Date();
    const rows = [...new Map([...done, ...due].map((t) => [t.id, t])).values()];
    const { done: doneCount, missed } = dayCounts(rows, day);
    const res = await supabase.from('daily_reports').upsert(
      {
        day, content: html, body, done_count: doneCount, missed_count: missed, updated_at: now.toISOString(),
        // Lateness and the submit time are set by the first save only.
        ...(report ? {} : { late: isLate(day, now), submitted_at: now.toISOString() }),
      },
      { onConflict: 'user_id,day' },
    );
    setBusy(false);
    if (!ok(res)) return;
    refresh('daily_reports'); // Today, Journal and the list update without waiting for realtime
    toast(report ? tr('Đã lưu thay đổi.') : isLate(day, now) ? tr('Báo cáo được tính là nộp trễ.') : tr('Đúng hạn, tốt lắm!'), report ? tr('Đã lưu báo cáo') : tr('Đã nộp báo cáo'), 'success');
    router.back();
  };

  return (
    <View style={s.root}>
      <View style={s.status}>
        {/* Pending: the line beside it already says "Hạn nộp 21:00 tối nay", so no "Hạn 21:00" badge too. */}
        {status !== 'pending' && <ReportBadge status={status} />}
        <Text style={s.meta}>
          {report
            ? tr('Nộp lúc {time} ngày {date}, hạn {deadline}.', { time: timeOf(report.submitted_at), date: fmtDate(localDay(new Date(report.submitted_at))), deadline: DEADLINE }) +
              (edited ? ' ' + tr('Sửa lần cuối {time} ngày {date}.', { time: timeOf(report.updated_at), date: fmtDate(localDay(new Date(report.updated_at))) }) : '')
            : status === 'pending' ? tr('Hạn nộp {time} tối nay. Bản nháp lấy từ các việc đã xong trong ngày.', { time: DEADLINE }) : tr('Đã quá hạn {time}: nộp bây giờ sẽ tính là trễ.', { time: DEADLINE })}
        </Text>
      </View>
      {report && locked && (
        <View style={s.warn} accessibilityRole="alert">
          <Ionicons name="warning-outline" size={18} color={color.warning} />
          <Text style={s.warnText}>{tr('Báo cáo này đã qua hạn {time} nên không xoá được nữa. Bạn vẫn sửa được, và thời điểm sửa sẽ được ghi lại.', { time: DEADLINE })}</Text>
        </View>
      )}
      <Editor
        initial={initial}
        palette={palette}
        labels={editorLabels(tr('Hôm nay bạn đã làm gì?'))}
        onChange={async (html, body) => { content.current = { html, text: body }; }}
        dom={{ matchContents: true, scrollEnabled: false }}
      />
      <View style={s.actions}>
        {report && !locked && <Button title={tr('Xoá báo cáo')} icon="trash-outline" variant="danger" onPress={remove} />}
        <Button title={report ? tr('Lưu thay đổi') : tr('Nộp báo cáo')} icon="send-outline" variant="primary" onPress={save} loading={busy} style={s.save} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 16 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  meta: { ...text.meta, color: color.muted, flexShrink: 1 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  save: { marginLeft: 'auto' },
  warn: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, paddingLeft: 14, borderRadius: 12, backgroundColor: color.warningBg },
  warnText: { ...text.sm, color: color.foreground, flex: 1 },
  // Same head as the Settings aside: h2 over a firm rule.
  asideTitle: { ...text.h2, color: color.foreground, paddingBottom: 10, marginBottom: 12, borderBottomWidth: rule.bar, borderBottomColor: color.borderStrong },
  group: { marginBottom: 12 },
  groupName: { ...text.smMedium, color: color.soft, marginBottom: 4 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 3 },
  itemIcon: { marginTop: 3 },
  itemText: { ...text.sm, color: color.foreground, flex: 1 },
});
