import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Choices, Field, Screen } from '@/components/ui';
import { color, priority, text } from '@/constants/theme';
import { fromIso, parseDate, parseTime } from '@/lib/dates';
import { confirmAction } from '@/lib/notify';
import { ok, type Project, supabase, type Task, useRows } from '@/lib/supabase';

type Kind = '' | 'daily' | 'weekly' | 'monthly' | 'every';
const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const ddmmyyyy = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '');

export default function TaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [rows, , loaded] = useRows<Task>('tasks', (q) => q.eq('id', id), id);
  const [projects] = useRows<Project>('projects', (q) => q.order('name'));
  if (!rows[0]) {
    return (
      <Screen back title={loaded ? 'Không tìm thấy việc' : ''}>
        {loaded && <Text style={s.muted}>Việc này đã bị xoá.</Text>}
      </Screen>
    );
  }
  // Mounted once the row arrives, so later realtime reloads don't overwrite edits.
  return <TaskForm task={rows[0]} projects={projects} />;
}

function TaskForm({ task, projects }: { task: Task; projects: Project[] }) {
  const id = task.id;
  const [k0, arg0 = ''] = (task.repeat ?? '').split(':');
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note ?? '');
  const [prio, setPrio] = useState(task.priority);
  const [projectId, setProjectId] = useState(task.project_id ?? '');
  const [date, setDate] = useState(ddmmyyyy(task.due_date));
  const [time, setTime] = useState(task.due_time?.slice(0, 5) ?? '');
  const [kind, setKind] = useState(k0 as Kind);
  const [weekDays, setWeekDays] = useState<number[]>(k0 === 'weekly' ? arg0.split(',').map(Number) : []);
  const [everyN, setEveryN] = useState(k0 === 'every' ? arg0 : '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const e: Record<string, string> = {};
    const due = date.trim() ? parseDate(date) : null;
    const at = time.trim() ? parseTime(time) : null;
    if (!title.trim()) e.title = 'Cần có tên việc';
    if (date.trim() && !due) e.date = 'Ngày không hợp lệ, gõ DD/MM hoặc DD/MM/YYYY';
    if (time.trim() && !at) e.time = 'Giờ phải từ 00:00 đến 23:59';
    if (at && !due && !e.date) e.time = 'Đặt giờ thì cần có ngày';
    if (kind && !due && !e.date) e.repeat = 'Việc lặp lại cần có ngày bắt đầu';
    if (kind === 'weekly' && !weekDays.length) e.repeat = 'Chọn ít nhất một thứ';
    if (kind === 'every' && !/^[1-9]\d*$/.test(everyN.trim())) e.repeat = 'Gõ số ngày, từ 1 trở lên';
    setErrors(e);
    if (Object.keys(e).length) return;

    const repeat =
      kind === 'weekly' ? `weekly:${[...weekDays].sort().join(',')}`
      : kind === 'monthly' ? `monthly:${fromIso(due!).getDate()}`
      : kind === 'every' ? `every:${everyN.trim()}`
      : kind || null;
    setBusy(true);
    const res = await supabase.from('tasks').update({
      title: title.trim(), note: note.trim() || null, priority: prio, project_id: projectId || null, due_date: due, due_time: at, repeat,
    }).eq('id', id);
    setBusy(false);
    if (ok(res)) router.back();
  };

  const remove = async () => {
    if (!(await confirmAction('Xoá việc này?', task.completed_at ? 'Mục này cũng mất khỏi nhật ký.' : ''))) return;
    if (ok(await supabase.from('tasks').delete().eq('id', id))) router.back();
  };

  return (
    <Screen back title="Sửa việc">
      <Card>
        <View style={s.form}>
          <Field label="Tên việc" value={title} onChangeText={setTitle} error={errors.title} />
          <Field label="Ghi chú" value={note} onChangeText={setNote} multiline style={s.note} placeholder="Không bắt buộc" />
          <View style={s.group}>
            <Text style={s.label}>Ưu tiên</Text>
            <Choices
              layout="cols"
              value={prio}
              onChange={setPrio}
              options={([1, 2, 3, 4] as const).map((n) => ({ value: n, label: `Mức ${n}`, dot: priority[n] }))}
            />
          </View>
          <View style={s.group}>
            <Text style={s.label}>Project</Text>
            <Choices value={projectId} onChange={setProjectId} options={[{ value: '', label: 'Hộp thư' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} />
          </View>
        </View>
      </Card>

      <Card title="Hạn và lặp lại">
        <View style={s.form}>
          <Field
            label="Ngày"
            value={date}
            onChangeText={setDate}
            placeholder="DD/MM"
            hint="Gõ DD/MM hoặc DD/MM/YYYY"
            error={errors.date}
            right={date ? <Button title="Bỏ" variant="ghost" onPress={() => setDate('')} /> : undefined}
          />
          <Field
            label="Giờ"
            value={time}
            onChangeText={setTime}
            placeholder="HH:MM"
            error={errors.time}
            right={time ? <Button title="Bỏ" variant="ghost" onPress={() => setTime('')} /> : undefined}
          />
          <View style={s.group}>
            <Text style={s.label}>Lặp lại</Text>
            <Choices<Kind>
              layout="stack"
              value={kind}
              onChange={setKind}
              error={errors.repeat}
              options={[
                { value: '', label: 'Không lặp' },
                { value: 'daily', label: 'Hằng ngày' },
                { value: 'weekly', label: 'Hằng tuần' },
                { value: 'monthly', label: 'Hằng tháng' },
                { value: 'every', label: 'Mỗi N ngày' },
              ]}
            />
            {kind === 'weekly' && (
              <Choices
                layout="days"
                value={weekDays}
                onChange={(d) => setWeekDays((v) => (v.includes(d) ? v.filter((x) => x !== d) : [...v, d]))}
                options={DAYS.map((label, value) => ({ value, label }))}
              />
            )}
            {kind === 'monthly' && <Text style={s.muted}>Lặp vào ngày {date ? date.split('/')[0] : '…'} mỗi tháng (theo ngày ở trên).</Text>}
            {kind === 'every' && <Field value={everyN} onChangeText={setEveryN} placeholder="Số ngày, ví dụ 3" keyboardType="number-pad" aria-label="Số ngày" />}
          </View>
        </View>
      </Card>

      <View style={s.actions}>
        <Button title="Xoá việc" variant="danger" onPress={remove} />
        <Button title="Lưu" variant="primary" onPress={save} loading={busy} style={s.save} />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  form: { gap: 16 },
  group: { gap: 8 },
  label: { ...text.smMedium, color: color.foreground },
  muted: { ...text.sm, color: color.muted },
  note: { height: 88, paddingTop: 12, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingBottom: 24 },
  save: { minWidth: 120 },
});
