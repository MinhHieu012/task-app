import { type ReactNode, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Choices, Field } from '@/components/ui';
import { color, priority, text } from '@/constants/theme';
import { fromIso, parseDate, parseTime } from '@/lib/dates';
import { confirmAction } from '@/lib/notify';
import { ok, type Project, supabase, type Task } from '@/lib/supabase';

type Kind = '' | 'daily' | 'weekly' | 'monthly' | 'every';
const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const ddmmyyyy = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '');

/** Edit form for one task; mount with key={task.id} so switching tasks resets it. */
export function TaskForm({ task, projects, onDone, bare }: { task: Task; projects: Project[]; onDone: () => void; bare?: boolean }) {
  // bare: straight on the white side panel; otherwise white cards on the gray page.
  // A plain function, not a component: a component defined here would remount the inputs on every keystroke.
  const box = (children: ReactNode, title?: string) =>
    bare ? <View style={s.form}>{title && <Text style={s.section}>{title}</Text>}{children}</View> : <Card title={title}>{children}</Card>;
  const id = task.id;
  const [k0, arg0 = ''] = (task.repeat ?? '').split(':');
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note ?? '');
  const [prio, setPrio] = useState(task.priority);
  const [projectId, setProjectId] = useState(task.project_id ?? '');
  const [date, setDate] = useState(ddmmyyyy(task.due_date));
  const [time, setTime] = useState(task.due_time?.slice(0, 5) ?? '');
  const [endDate, setEndDate] = useState(task.end_date === task.due_date ? '' : ddmmyyyy(task.end_date));
  const [endTime, setEndTime] = useState(task.end_time?.slice(0, 5) ?? '');
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
    // End day left blank = same day as the start.
    const endDue = endDate.trim() ? parseDate(endDate) : due;
    const end = endTime.trim() ? parseTime(endTime) : null;
    if (endDate.trim() && !endDue) e.endDate = 'Ngày không hợp lệ, gõ DD/MM hoặc DD/MM/YYYY';
    if (endDate.trim() && !endTime.trim()) e.endTime = 'Đặt ngày kết thúc thì cần có giờ kết thúc';
    else if (endTime.trim() && !end) e.endTime = 'Giờ phải từ 00:00 đến 23:59';
    else if (end && !at && !e.time) e.endTime = 'Đặt giờ kết thúc thì cần có giờ bắt đầu';
    else if (end && at && endDue && due && `${endDue} ${end}` <= `${due} ${at}`) e.endTime = 'Thời gian kết thúc phải sau lúc bắt đầu';
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
      title: title.trim(), note: note.trim() || null, priority: prio, project_id: projectId || null, due_date: due, due_time: at, end_date: end && endDue, end_time: end, repeat,
    }).eq('id', id);
    setBusy(false);
    if (ok(res)) onDone();
  };

  const remove = async () => {
    if (!(await confirmAction('Xoá việc này?', task.completed_at ? 'Mục này cũng mất khỏi nhật ký.' : ''))) return;
    if (ok(await supabase.from('tasks').delete().eq('id', id))) onDone();
  };

  return (
    <>
      {box(
        <View style={s.form}>
          <Field label="Tên việc" value={title} onChangeText={setTitle} error={errors.title} />
          <Field label="Ghi chú" value={note} onChangeText={setNote} multiline style={s.note} placeholder="Không bắt buộc" />
          <View style={s.group}>
            <Text style={s.label}>Ưu tiên</Text>
            <Choices
              layout="cols"
              value={prio}
              onChange={setPrio}
              options={([1, 2, 3, 4] as const).map((n) => ({ value: n, label: n === 4 ? 'Thường' : `Mức ${n}`, dot: priority[n] }))}
            />
          </View>
          <View style={s.group}>
            <Text style={s.label}>Project</Text>
            <Choices value={projectId} onChange={setProjectId} options={[{ value: '', label: 'Hộp thư' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} />
          </View>
        </View>,
      )}

      {box(
        <View style={s.form}>
          <Field
            label="Ngày bắt đầu"
            value={date}
            onChangeText={setDate}
            placeholder="DD/MM"
            hint="Gõ DD/MM hoặc DD/MM/YYYY"
            error={errors.date}
            right={date ? <Button title="Bỏ" variant="ghost" onPress={() => setDate('')} /> : undefined}
          />
          <Field
            label="Giờ bắt đầu"
            value={time}
            onChangeText={setTime}
            placeholder="HH:MM"
            error={errors.time}
            right={time ? <Button title="Bỏ" variant="ghost" onPress={() => setTime('')} /> : undefined}
          />
          <Field
            label="Ngày kết thúc"
            value={endDate}
            onChangeText={setEndDate}
            placeholder="DD/MM"
            hint="Để trống nếu kết thúc cùng ngày bắt đầu"
            error={errors.endDate}
            right={endDate ? <Button title="Bỏ" variant="ghost" onPress={() => setEndDate('')} /> : undefined}
          />
          <Field
            label="Giờ kết thúc"
            value={endTime}
            onChangeText={setEndTime}
            placeholder="HH:MM"
            hint="Không bắt buộc"
            error={errors.endTime}
            right={endTime ? <Button title="Bỏ" variant="ghost" onPress={() => setEndTime('')} /> : undefined}
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
        </View>,
        'Hạn và lặp lại',
      )}

      <View style={s.actions}>
        <Button title="Xoá việc" variant="danger" onPress={remove} />
        <Button title="Lưu" variant="primary" onPress={save} loading={busy} style={s.save} />
      </View>
    </>
  );
}

const s = StyleSheet.create({
  form: { gap: 16 },
  group: { gap: 8 },
  label: { ...text.meta, fontWeight: '500', color: color.soft },
  section: { ...text.h2, color: color.foreground, marginTop: 4 },
  muted: { ...text.sm, color: color.muted },
  note: { height: 88, paddingTop: 12, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingBottom: 24 },
  save: { minWidth: 120 },
});
