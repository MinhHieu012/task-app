import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DateField, TimeField } from '@/components/DateTime';
import RichEditor from '@/components/dom/RichEditor';
import { editorLabels, palette } from '@/components/Report';
import { active, Button, Field, IconButton, Tick } from '@/components/ui';
import { color, radius, text } from '@/constants/theme';
import { fmtDate, parseDate, parseTime, today } from '@/lib/dates';
import { titleHtml, titleText } from '@/lib/html';
import { tr } from '@/lib/i18n';
import { fmtSpan, spanError } from '@/lib/subtasks';
import { ok, refresh, type Subtask, supabase, type Task } from '@/lib/supabase';

/** Adds one subtask; null on failure (the error is already shown). */
export async function addSubtask(taskId: string, title: string) {
  const res = await supabase.from('subtasks').insert({ task_id: taskId, title }).select().single();
  if (ok(res)) refresh('subtasks');
  return ok(res) ? (res.data as Subtask) : null;
}

/** Checklist of a task. Saves on each change; the typed-but-unadded title (`draft`) is owned by
 *  the form so its "Lưu" can add it too, instead of silently dropping it. */
export function Subtasks({ task, draft: title, setDraft: setTitle }: { task: Task; draft: string; setDraft: (v: string) => void }) {
  const taskId = task.id;
  const [rows, setRows] = useState<Subtask[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const table = () => supabase.from('subtasks');

  // Loaded once, not via useRows: only this form edits the list, and a realtime refetch would undo optimistic ticks.
  useEffect(() => {
    supabase.from('subtasks').select('*').eq('task_id', taskId).order('created_at')
      .then((res) => ok(res) && setRows(res.data as Subtask[]));
  }, [taskId]);

  const add = async () => {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    const row = await addSubtask(taskId, t);
    setBusy(false);
    if (!row) return;
    setRows((r) => [...r, row]);
    setTitle('');
  };

  const toggle = async (row: Subtask) => {
    const set = (done: boolean) => setRows((r) => r.map((x) => (x.id === row.id ? { ...x, done } : x)));
    set(!row.done);
    if (!ok(await table().update({ done: !row.done }).eq('id', row.id))) set(row.done);
    else refresh('subtasks');
  };

  const remove = async (row: Subtask) => {
    if (!ok(await table().delete().eq('id', row.id))) return;
    setRows((r) => r.filter((x) => x.id !== row.id));
    refresh('subtasks');
  };

  const done = rows.filter((r) => r.done).length;
  return (
    <View style={s.wrap}>
      {rows.length > 0 && <Text style={s.count}>{tr('Xong {done}/{n}', { done, n: rows.length })}</Text>}
      {rows.map((r) =>
        editing === r.id ? (
          <Editor
            key={r.id}
            row={r}
            task={task}
            onClose={() => setEditing(null)}
            onSaved={(x) => { setRows((all) => all.map((y) => (y.id === x.id ? x : y))); setEditing(null); }}
          />
        ) : (
          <View key={r.id} style={s.row}>
            <View style={s.tick}><Tick checked={r.done} onPress={() => toggle(r)} size={22} /></View>
            <Pressable
              onPress={() => setEditing(r.id)}
              accessibilityRole="button"
              accessibilityLabel={tr('Sửa “{name}”', { name: r.title })}
              style={(st) => [s.body, active(st) && { backgroundColor: color.itemHover }]}
            >
              <Text style={[s.title, r.done && s.done]}>{r.title}</Text>
              <View style={s.when}>
                <Ionicons name="time-outline" size={14} color={r.start_date ? color.soft : color.muted} />
                <Text style={[s.whenText, !r.start_date && s.unset]}>{fmtSpan(r) || tr('Chưa đặt thời gian')}</Text>
              </View>
            </Pressable>
            <IconButton icon="close" label={tr('Xoá “{name}”', { name: r.title })} onPress={() => remove(r)} />
          </View>
        ),
      )}
      <Field
        icon="add"
        value={title}
        onChangeText={setTitle}
        placeholder={tr('Thêm việc con…')}
        aria-label={tr('Tên việc con mới')}
        onSubmitEditing={add}
        submitBehavior="submit"
        returnKeyType="done"
        right={title.trim() ? <Button title={tr('Thêm')} onPress={add} loading={busy} /> : undefined}
      />
    </View>
  );
}

const dmy = (iso: string | null) => (iso ? fmtDate(iso) : '');

/** Inline edit of one subtask: title, start and end (date + time). Must fit inside the parent's span. */
function Editor({ row, task, onClose, onSaved }: { row: Subtask; task: Task; onClose: () => void; onSaved: (x: Subtask) => void }) {
  // A ref, like the task form: the editor is uncontrolled. Plain one-line title for the list, HTML to edit.
  const title = useRef({ html: titleHtml(row), text: row.title });
  const [startDate, setStartDate] = useState(dmy(row.start_date));
  const [startTime, setStartTime] = useState(row.start_time?.slice(0, 5) ?? '');
  // End on the start day shows blank, like the parent's form.
  const [endDate, setEndDate] = useState(row.end_date === row.start_date ? '' : dmy(row.end_date));
  const [endTime, setEndTime] = useState(row.end_time?.slice(0, 5) ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const base = task.due_date ?? today();

  const save = async () => {
    // A blank start day with a time means the parent's start day; a blank end day means the start day.
    const sd = startDate.trim() ? parseDate(startDate, base) : startTime.trim() ? task.due_date : null;
    const st = startTime.trim() ? parseTime(startTime) : null;
    const ed = endDate.trim() ? parseDate(endDate, sd ?? base) : endTime.trim() ? sd : null;
    const et = endTime.trim() ? parseTime(endTime) : null;
    const e =
      !title.current.text ? tr('Cần có tên việc')
      : (startDate.trim() && !sd) || (endDate.trim() && !ed) ? tr('Ngày không hợp lệ, gõ DD/MM hoặc DD/MM/YYYY')
      : (startTime.trim() && !st) || (endTime.trim() && !et) ? tr('Giờ phải từ 00:00 đến 23:59')
      : st && !sd ? tr('Việc cha chưa có ngày, nên việc con chưa đặt ngày được')
      : spanError(task, { start_date: sd, start_time: st, end_date: ed, end_time: et });
    setError(e);
    if (e) return;
    const patch = { title: title.current.text, title_html: title.current.html, start_date: sd, start_time: st, end_date: ed, end_time: et };
    setBusy(true);
    const res = await supabase.from('subtasks').update(patch).eq('id', row.id);
    setBusy(false);
    if (!ok(res)) return;
    refresh('subtasks');
    onSaved({ ...row, ...patch });
  };

  return (
    <View style={s.editor}>
      <Text style={[s.label, { marginTop: 0 }]}>{tr('Tên việc con')}</Text>
      <RichEditor
        initial={titleHtml(row)}
        palette={palette}
        compact
        minHeight={26}
        labels={editorLabels(tr('Tên việc con'))}
        onChange={async (html, body) => { title.current = { html, text: titleText(body) }; }}
        dom={{ matchContents: true, scrollEnabled: false }}
      />
      <Text style={s.label}>{tr('Bắt đầu')}</Text>
      <View style={s.pair}>
        <View style={s.dateCol}><DateField value={startDate} onChange={setStartDate} base={base} /></View>
        <View style={s.timeCol}><TimeField value={startTime} onChange={setStartTime} /></View>
      </View>
      <Text style={s.label}>{tr('Kết thúc')}</Text>
      <View style={s.pair}>
        <View style={s.dateCol}><DateField value={endDate} onChange={setEndDate} base={parseDate(startDate, base) ?? base} /></View>
        <View style={s.timeCol}><TimeField value={endTime} onChange={setEndTime} /></View>
      </View>
      {error ? <Text style={s.error}>{error}</Text> : <Text style={s.hint}>{tr('Ngày để trống = ngày của việc cha. Phải nằm trong thời gian của việc cha.')}</Text>}
      <View style={s.actions}>
        <Button title={tr('Huỷ')} variant="ghost" onPress={onClose} />
        <Button title={tr('Lưu')} variant="primary" onPress={save} loading={busy} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 8 },
  count: { ...text.meta, color: color.muted },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tick: { paddingTop: 10 },
  body: { flex: 1, minWidth: 0, gap: 2, paddingVertical: 6, paddingHorizontal: 6, borderRadius: radius.sm },
  title: { ...text.body, color: color.foreground },
  done: { color: color.muted, textDecorationLine: 'line-through' },
  when: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  whenText: { ...text.meta, color: color.soft, fontVariant: ['tabular-nums'] },
  unset: { color: color.muted },
  editor: { gap: 8, padding: 12, borderRadius: radius.ctl, backgroundColor: color.background },
  label: { ...text.meta, fontWeight: '500', color: color.soft, marginTop: 4 },
  pair: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  // Explicit basis 0: native sized 'flex: N' columns by content, so date and time came out lopsided.
  dateCol: { flexGrow: 6, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  timeCol: { flexGrow: 5, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  hint: { ...text.xs, color: color.muted },
  error: { ...text.meta, color: color.error },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
