import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Field, IconButton, Tick } from '@/components/ui';
import { color, text } from '@/constants/theme';
import { tr } from '@/lib/i18n';
import { fmtWhen, parseWhen, spanError } from '@/lib/subtasks';
import { ok, type Subtask, supabase, type Task } from '@/lib/supabase';

/** Adds one subtask; null on failure (the error is already shown). */
export async function addSubtask(taskId: string, title: string) {
  const res = await supabase.from('subtasks').insert({ task_id: taskId, title }).select().single();
  return ok(res) ? (res.data as Subtask) : null;
}

/** Checklist of a task. Saves on each change; the typed-but-unadded title (`draft`) is owned by
 *  the form so its "Lưu" can add it too, instead of silently dropping it. */
export function Subtasks({ task, draft: title, setDraft: setTitle }: { task: Task; draft: string; setDraft: (v: string) => void }) {
  const taskId = task.id;
  const [rows, setRows] = useState<Subtask[]>([]);
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
  };

  const remove = async (row: Subtask) => {
    if (ok(await table().delete().eq('id', row.id))) setRows((r) => r.filter((x) => x.id !== row.id));
  };

  const done = rows.filter((r) => r.done).length;
  return (
    <View style={s.wrap}>
      {rows.length > 0 && <Text style={s.count}>Xong {done}/{rows.length}</Text>}
      {rows.map((r) => (
        <View key={r.id} style={s.item}>
          <View style={s.row}>
            <Tick checked={r.done} onPress={() => toggle(r)} size={22} />
            <Text style={[s.title, r.done && s.done]}>{r.title}</Text>
            <IconButton icon="close" label={tr('Xoá “{name}”', { name: r.title })} onPress={() => remove(r)} />
          </View>
          <Times row={r} task={task} />
        </View>
      ))}
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

/** Start/end inputs ("DD/MM HH:MM") of one subtask; saved when either loses focus, if valid and inside the parent. */
function Times({ row, task }: { row: Subtask; task: Task }) {
  const [start, setStart] = useState(fmtWhen(row.start_date, row.start_time));
  const [end, setEnd] = useState(fmtWhen(row.end_date, row.end_time));
  const [saved, setSaved] = useState([start, end].join('|'));
  const [error, setError] = useState('');

  const save = async () => {
    if ([start, end].join('|') === saved) return setError('');
    // A bare time means the parent's start day; the end's bare time means the subtask's start day.
    const a = parseWhen(start, task.due_date);
    const b = a && parseWhen(end, a.date ?? task.due_date);
    if (!a || !b) return setError(tr('Gõ DD/MM HH:MM, DD/MM hoặc HH:MM'));
    const span = { start_date: a.date, start_time: a.time, end_date: b.date, end_time: b.time };
    const e = spanError(task, span);
    setError(e);
    if (!e && ok(await supabase.from('subtasks').update(span).eq('id', row.id))) setSaved([start, end].join('|'));
  };

  const input = (value: string, set: (v: string) => void, label: string) => (
    // Shares the row width, so both fit on a phone.
    <View style={s.timeCol}>
      <Field value={value} onChangeText={set} onBlur={save} onSubmitEditing={save} placeholder={label} aria-label={`${label} (DD/MM HH:MM)`} style={s.time} boxStyle={s.timeBox} />
    </View>
  );
  return (
    <View style={s.times}>
      <View style={s.timesRow}>
        {input(start, setStart, tr('Bắt đầu'))}
        <Text style={s.count}>{tr('đến')}</Text>
        {input(end, setEnd, tr('Kết thúc'))}
      </View>
      {!!error && <Text style={s.error}>{error}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  item: { gap: 4 },
  times: { paddingLeft: 34, gap: 4 },
  timesRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeCol: { flex: 1, minWidth: 0 },
  timeBox: { minHeight: 36, paddingLeft: 12 },
  time: { height: 34, fontSize: 14 },
  error: { ...text.meta, color: color.error },
  wrap: { gap: 8 },
  count: { ...text.meta, color: color.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 36 },
  title: { ...text.body, color: color.foreground, flex: 1, minWidth: 0 },
  done: { color: color.muted, textDecorationLine: 'line-through' },
});
