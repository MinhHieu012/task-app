import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DateField, TimeField } from '@/components/DateTime';
import { Editor } from '@/components/Rich';
import { editorLabels, palette } from '@/components/Report';
import { Sheet } from '@/components/Sheet';
import { addSubtask, Subtasks } from '@/components/Subtasks';
import { priorityLabel, removeTask, repeatLabel } from '@/components/TaskRow';
import { active, Button, Card, Choices, ErrorText, Field, ICON_INSET, ListGroup, ListItem } from '@/components/ui';
import { color, priority, radius, rule, text } from '@/constants/theme';
import { addDays, fmtDate, fromIso, nextMonday, parseDate, parseTime, today } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { titleHtml, titleText } from '@/lib/html';
import { tr } from '@/lib/i18n';
import { spanError } from '@/lib/subtasks';
import { ok, type Project, type Subtask, supabase, type Task, useKnownTags } from '@/lib/supabase';
import { fmtTags, parseTags } from '@/lib/tags';

type Kind = '' | 'daily' | 'weekly' | 'monthly' | 'every';
const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const ddmmyyyy = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '');

/** Edit form for one task; mount with key={task.id} so switching tasks resets it. */
export function TaskForm({ task, projects, onDone, bare, sheet }: { task: Task; projects: Project[]; onDone: () => void; bare?: boolean; sheet?: boolean }) {
  // sheet: phones, the full-height sheet of the task route (TaskSheet below); same state, save and delete.
  // bare: straight on the white side panel; otherwise white cards on the gray page.
  // A plain function, not a component: a component defined here would remount the inputs on every keystroke.
  const box = (children: ReactNode, title?: string) =>
    bare ? <View style={s.form}>{title && <Text style={s.section}>{title}</Text>}{children}</View> : <Card title={title}>{children}</Card>;
  const id = task.id;
  const [k0, arg0 = ''] = (task.repeat ?? '').split(':');
  // Refs, not state: the editors are uncontrolled and re-rendering them per keystroke costs a WebView round trip on native.
  // The title is kept twice: formatted to edit, plain (one line) for lists, toasts, reports and search.
  const title = useRef({ html: titleHtml(task), text: task.title });
  const note = useRef(task.note);
  const [tags, setTags] = useState(fmtTags(task.tags));
  // Tags already in use, to pick instead of retyping.
  const picked = parseTags(tags);
  const known = [...new Set([...useKnownTags(), ...picked])];
  const pick = (t: string) => setTags(fmtTags(picked.includes(t) ? picked.filter((x) => x !== t) : [...picked, t]));
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
  const [subDraft, setSubDraft] = useState('');

  const save = async () => {
    const e: Record<string, string> = {};
    const due = date.trim() ? parseDate(date) : null;
    const at = time.trim() ? parseTime(time) : null;
    if (!title.current.text) e.title = tr('Cần có tên việc');
    if (date.trim() && !due) e.date = tr('Ngày không hợp lệ, gõ DD/MM hoặc DD/MM/YYYY');
    if (time.trim() && !at) e.time = tr('Giờ phải từ 00:00 đến 23:59');
    if (at && !due && !e.date) e.time = tr('Đặt giờ thì cần có ngày');
    // End day left blank = same day as the start.
    const endDue = endDate.trim() ? parseDate(endDate) : due;
    const end = endTime.trim() ? parseTime(endTime) : null;
    if (endDate.trim() && !endDue) e.endDate = tr('Ngày không hợp lệ, gõ DD/MM hoặc DD/MM/YYYY');
    if (endDate.trim() && !endTime.trim()) e.endTime = tr('Đặt ngày kết thúc thì cần có giờ kết thúc');
    else if (endTime.trim() && !end) e.endTime = tr('Giờ phải từ 00:00 đến 23:59');
    else if (end && !at && !e.time) e.endTime = tr('Đặt giờ kết thúc thì cần có giờ bắt đầu');
    else if (end && at && endDue && due && `${endDue} ${end}` <= `${due} ${at}`) e.endTime = tr('Thời gian kết thúc phải sau lúc bắt đầu');
    if (kind && !due && !e.date) e.repeat = tr('Việc lặp lại cần có ngày bắt đầu');
    if (kind === 'weekly' && !weekDays.length) e.repeat = tr('Chọn ít nhất một thứ');
    if (kind === 'every' && !/^[1-9]\d*$/.test(everyN.trim())) e.repeat = tr('Gõ số ngày, từ 1 trở lên');
    setErrors(e);
    if (Object.keys(e).length) return;

    const repeat =
      kind === 'weekly' ? `weekly:${[...weekDays].sort().join(',')}`
      : kind === 'monthly' ? `monthly:${fromIso(due!).getDate()}`
      : kind === 'every' ? `every:${everyN.trim()}`
      : kind || null;
    const patch = {
      title: title.current.text, title_html: title.current.html, note: note.current, priority: prio, project_id: projectId || null, tags: parseTags(tags), due_date: due, due_time: at, end_date: end && endDue, end_time: end, repeat,
    };
    setBusy(true);
    // Subtasks must stay inside the parent's span, so a new span can't leave one outside.
    const subs = await supabase.from('subtasks').select('*').eq('task_id', id);
    const outside = ok(subs) ? (subs.data as Subtask[]).find((x) => spanError(patch, x)) : undefined;
    if (!subs.data || outside) {
      setBusy(false);
      if (outside) setErrors({ date: tr('Việc con “{name}” sẽ nằm ngoài thời gian mới. Sửa việc con trước.', { name: outside.title }) });
      return;
    }
    const res = await supabase.from('tasks').update(patch).eq('id', id);
    // A subtask typed but not yet added would be lost when the form closes.
    const sub = ok(res) && (!subDraft.trim() || !!(await addSubtask(id, subDraft.trim())));
    setBusy(false);
    if (sub) onDone();
  };

  // The undo puts the row and its subtasks back with the same ids, so nothing else needs to change.
  const remove = async () => { if (await removeTask(task)) onDone(); };

  if (sheet) {
    const repeat =
      kind === 'weekly' ? (weekDays.length ? repeatLabel(`weekly:${[...weekDays].sort().join(',')}`) : tr('Hằng tuần'))
      : kind === 'monthly' ? tr('Hằng tháng')
      : kind === 'every' ? (/^[1-9]\d*$/.test(everyN.trim()) ? repeatLabel(`every:${everyN.trim()}`) : tr('Mỗi N ngày'))
      : kind === 'daily' ? tr('Hằng ngày') : tr('Không lặp');
    return (
      <TaskSheet
        title={
          <Editor
            initial={titleHtml(task)}
            palette={palette}
            compact
            minHeight={26}
            labels={editorLabels(tr('Tên việc'))}
            onChange={async (html, body) => { title.current = { html, text: titleText(body) }; }}
            dom={{ matchContents: true, scrollEnabled: false }}
          />
        }
        note={
          <Editor
            initial={task.note ?? ''}
            palette={palette}
            minHeight={96}
            labels={editorLabels(tr('Thêm ghi chú…'))}
            onChange={async (html, body) => { note.current = body.trim() ? html : null; }}
            dom={{ matchContents: true, scrollEnabled: false }}
          />
        }
        titleError={errors.title}
        busy={busy}
        onSave={save}
        onCancel={onDone}
        onRemove={remove}
        when={{
          value: date ? `${date}${time ? ` ${time}` : ''}${endTime ? ` – ${endDate ? `${endDate} ` : ''}${endTime}` : ''}` : tr('Chưa có ngày'),
          error: errors.date || errors.time || errors.endDate || errors.endTime,
          body: (
            <>
              <View style={s.quick}>
                {([[today(), tr('Hôm nay')], [addDays(today(), 1), tr('Ngày mai')], [nextMonday(today()), tr('Thứ Hai tới')]] as const).map(([d, l]) => (
                  <Pressable key={l} onPress={() => { haptic.select(); setDate(fmtDate(d)); }} hitSlop={4} accessibilityRole="button" style={(st) => [s.quickChip, date === fmtDate(d) && s.quickOn, active(st) && { backgroundColor: color.itemHover }]}>
                    <Text style={[s.quickText, date === fmtDate(d) && { color: color.primary }]}>{l}</Text>
                  </Pressable>
                ))}
                <Pressable onPress={() => { setDate(''); setTime(''); setEndDate(''); setEndTime(''); }} hitSlop={4} accessibilityRole="button" style={(st) => [s.quickChip, active(st) && { backgroundColor: color.itemHover }]}>
                  <Text style={s.quickText}>{tr('Không hẹn ngày')}</Text>
                </Pressable>
              </View>
              <Text style={s.label}>{tr('Bắt đầu')}</Text>
              <View style={s.pair}>
                <View style={s.dateCol}><DateField value={date} onChange={setDate} error={errors.date} /></View>
                <View style={s.timeCol}><TimeField value={time} onChange={setTime} error={errors.time} /></View>
              </View>
              <Text style={s.label}>{tr('Kết thúc')}</Text>
              <View style={s.pair}>
                <View style={s.dateCol}><DateField value={endDate} onChange={setEndDate} error={errors.endDate} base={parseDate(date)} /></View>
                <View style={s.timeCol}><TimeField value={endTime} onChange={setEndTime} error={errors.endTime} /></View>
              </View>
              <Text style={s.hint}>{tr('Trống = cùng ngày bắt đầu')}</Text>
            </>
          ),
        }}
        repeat={{
          value: repeat,
          error: errors.repeat,
          body: (
            <>
              <ListGroup>
                {([['', tr('Không lặp')], ['daily', tr('Hằng ngày')], ['weekly', tr('Hằng tuần')], ['monthly', tr('Hằng tháng')], ['every', tr('Mỗi N ngày')]] as [Kind, string][]).map(([k, l]) => (
                  <ListItem key={k || 'none'} title={l} selected={kind === k} chevron={false} onPress={() => { haptic.select(); setKind(k); }} />
                ))}
              </ListGroup>
              {kind === 'weekly' && (
                <Choices
                  layout="days"
                  value={weekDays}
                  onChange={(d) => setWeekDays((v) => (v.includes(d) ? v.filter((x) => x !== d) : [...v, d]))}
                  options={DAYS.map((label, value) => ({ value, label: tr(label) }))}
                />
              )}
              {kind === 'monthly' && <Text style={s.muted}>{tr('Lặp vào ngày {d} mỗi tháng (theo ngày ở trên).', { d: date ? date.split('/')[0] : '…' })}</Text>}
              {kind === 'every' && <Field value={everyN} onChangeText={setEveryN} placeholder={tr('Số ngày, ví dụ 3')} keyboardType="number-pad" aria-label="Số ngày" />}
              {errors.repeat && <ErrorText key={errors.repeat}>{errors.repeat}</ErrorText>}
            </>
          ),
        }}
        priority={{
          value: prio,
          set: (p) => { haptic.select(); setPrio(p); },
        }}
        project={{
          value: projectId,
          options: [{ value: '', label: tr('Hộp thư') }, ...projects.map((p) => ({ value: p.id, label: p.name }))],
          set: (p) => { haptic.select(); setProjectId(p); },
        }}
        tags={{
          value: picked.length ? picked.map((t) => `#${t}`).join(' ') : tr('Không có'),
          body: (
            <>
              <Field value={tags} onChangeText={setTags} placeholder="#nhà #gấp" autoCapitalize="none" autoCorrect={false} aria-label={tr('Nhãn')} hint={tr('Gõ nhãn mới cách nhau bằng dấu cách, hoặc chọn bên dưới.')} />
              {known.length > 0 && <Choices value={picked} onChange={pick} options={known.map((t) => ({ value: t, label: `#${t}` }))} />}
            </>
          ),
        }}
        subtasks={<Subtasks task={task} draft={subDraft} setDraft={setSubDraft} />}
      />
    );
  }

  return (
    <>
      {box(
        <View style={s.form}>
          <View style={s.group}>
            <Text style={s.label}>{tr('Tên việc')}</Text>
            <Editor
              initial={titleHtml(task)}
              palette={palette}
              compact
              minHeight={26}
              labels={editorLabels(tr('Tên việc'))}
              onChange={async (html, body) => { title.current = { html, text: titleText(body) }; }}
              dom={{ matchContents: true, scrollEnabled: false }}
            />
            {errors.title && <ErrorText>{errors.title}</ErrorText>}
          </View>
          <View style={s.group}>
            <Text style={s.label}>{tr('Ghi chú')}</Text>
            <Editor
              initial={task.note ?? ''}
              palette={palette}
              minHeight={120}
              labels={editorLabels(tr('Không bắt buộc'))}
              onChange={async (html, body) => { note.current = body.trim() ? html : null; }}
              dom={{ matchContents: true, scrollEnabled: false }}
            />
          </View>
          <View style={s.group}>
            <Field label={tr('Nhãn')} value={tags} onChangeText={setTags} placeholder="#nhà #gấp" hint={tr('Chọn nhãn có sẵn bên dưới, hoặc gõ nhãn mới cách nhau bằng dấu cách. Ở ô thêm nhanh, gõ #nhãn ngay trong tên việc.')} autoCapitalize="none" autoCorrect={false} />
            {known.length > 0 && <Choices value={picked} onChange={pick} options={known.map((t) => ({ value: t, label: `#${t}` }))} />}
          </View>
          <View style={s.group}>
            <Text style={s.label}>{tr('Ưu tiên')}</Text>
            <Choices
              layout="cols"
              value={prio}
              onChange={setPrio}
              options={([1, 2, 3, 4] as const).map((n) => ({ value: n, label: n === 4 ? tr('Thường') : tr('Mức {n}', { n }), dot: priority[n] }))}
            />
          </View>
          <View style={s.group}>
            <Text style={s.label}>Project</Text>
            <Choices value={projectId} onChange={setProjectId} options={[{ value: '', label: tr('Hộp thư') }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} />
          </View>
        </View>,
      )}

      {box(
        <View style={s.form}>
          <View style={s.group}>
            <Text style={s.label}>{tr('Bắt đầu')}</Text>
            <View style={s.pair}>
              <View style={s.dateCol}><DateField value={date} onChange={setDate} error={errors.date} /></View>
              <View style={s.timeCol}><TimeField value={time} onChange={setTime} error={errors.time} /></View>
            </View>
          </View>
          <View style={s.group}>
            <Text style={s.label}>{tr('Kết thúc')}</Text>
            <View style={s.pair}>
              <View style={s.dateCol}>
                <DateField value={endDate} onChange={setEndDate} error={errors.endDate} base={parseDate(date)} />
              </View>
              <View style={s.timeCol}><TimeField value={endTime} onChange={setEndTime} error={errors.endTime} /></View>
            </View>
            <Text style={s.hint}>{tr('Trống = cùng ngày bắt đầu')}</Text>
          </View>
          <View style={s.group}>
            <Text style={s.label}>{tr('Lặp lại')}</Text>
            <Choices<Kind>
              layout="stack"
              value={kind}
              onChange={setKind}
              error={errors.repeat}
              options={[
                { value: '', label: tr('Không lặp') },
                { value: 'daily', label: tr('Hằng ngày') },
                { value: 'weekly', label: tr('Hằng tuần') },
                { value: 'monthly', label: tr('Hằng tháng') },
                { value: 'every', label: tr('Mỗi N ngày') },
              ]}
            />
            {kind === 'weekly' && (
              <Choices
                layout="days"
                value={weekDays}
                onChange={(d) => setWeekDays((v) => (v.includes(d) ? v.filter((x) => x !== d) : [...v, d]))}
                options={DAYS.map((label, value) => ({ value, label: tr(label) }))}
              />
            )}
            {kind === 'monthly' && <Text style={s.muted}>{tr('Lặp vào ngày {d} mỗi tháng (theo ngày ở trên).', { d: date ? date.split('/')[0] : '…' })}</Text>}
            {kind === 'every' && <Field value={everyN} onChangeText={setEveryN} placeholder={tr('Số ngày, ví dụ 3')} keyboardType="number-pad" aria-label="Số ngày" />}
          </View>
        </View>,
        tr('Hạn và lặp lại'),
      )}

      {box(<Subtasks task={task} draft={subDraft} setDraft={setSubDraft} />, tr('Việc con'))}

      <View style={s.actions}>
        <Button title={tr('Xoá việc')} variant="danger" onPress={remove} />
        <Button title={tr('Lưu')} variant="primary" onPress={save} loading={busy} style={s.save} />
      </View>
    </>
  );
}

type Pick = 'when' | 'repeat' | 'priority' | 'project' | 'tags';

/** Phones: the task as a sheet. Huỷ, the title and Lưu in the head; the title and note edited in place; every
 *  other field a row with its value that opens a small picker sheet. Lưu stays explicit, like the wide form. */
function TaskSheet({ title, note, titleError, busy, onSave, onCancel, onRemove, when, repeat, priority: prio, project, tags, subtasks }: {
  title: ReactNode; note: ReactNode; titleError?: string; busy: boolean; onSave: () => void; onCancel: () => void; onRemove: () => void;
  when: { value: string; error?: string; body: ReactNode };
  repeat: { value: string; error?: string; body: ReactNode };
  priority: { value: number; set: (p: number) => void };
  project: { value: string; options: { value: string; label: string }[]; set: (p: string) => void };
  tags: { value: string; body: ReactNode };
  subtasks: ReactNode;
}) {
  const { top } = useSafeAreaInsets();
  const [pick, setPick] = useState<Pick | null>(null);
  const close = () => setPick(null);
  const done = { label: tr('Xong'), onPress: close };
  return (
    <View style={s.sheet}>
      <View style={[s.head, { paddingTop: top + 4 }]}>
        <Pressable onPress={onCancel} hitSlop={8} accessibilityRole="button" style={(st) => [s.headBtn, active(st) && { backgroundColor: color.itemHover }]}>
          <Text style={s.cancel}>{tr('Huỷ')}</Text>
        </Pressable>
        <Text style={s.headTitle}>{tr('Sửa việc')}</Text>
        <Button title={tr('Lưu')} variant="primary" onPress={onSave} loading={busy} style={s.saveBtn} />
      </View>
      <KeyboardAvoidingView behavior="padding" style={s.flex}>
        <ScrollView style={s.flex} contentContainerStyle={s.sheetBody} keyboardShouldPersistTaps="handled">
          <View style={s.titleBox}>
            <Text style={s.fieldHead}>{tr('Tên việc')}</Text>
            {title}
            {titleError && <ErrorText>{titleError}</ErrorText>}
          </View>
          <View style={s.titleBox}>
            <Text style={s.fieldHead}>{tr('Ghi chú')}</Text>
            {note}
          </View>
          <ListGroup inset={ICON_INSET}>
            <ListItem icon="calendar-outline" title={tr('Thời gian')} value={when.value} sub={when.error} subTone="error" onPress={() => setPick('when')} />
            <ListItem icon="repeat-outline" title={tr('Lặp lại')} value={repeat.value} sub={repeat.error} subTone="error" onPress={() => setPick('repeat')} />
            <ListItem icon="flag" tint={priority[prio.value as 1 | 2 | 3 | 4]} title={tr('Ưu tiên')} value={priorityLabel(prio.value)} onPress={() => setPick('priority')} />
            <ListItem icon="folder-outline" title="Project" value={project.options.find((o) => o.value === project.value)?.label} onPress={() => setPick('project')} />
            <ListItem icon="pricetag-outline" title={tr('Nhãn')} value={tags.value} onPress={() => setPick('tags')} />
          </ListGroup>
          <ListGroup title={tr('Việc con')}>
            <View style={s.subs}>{subtasks}</View>
          </ListGroup>
          <ListGroup inset={ICON_INSET}>
            <ListItem icon="trash-outline" title={tr('Xoá việc')} danger chevron={false} onPress={onRemove} />
          </ListGroup>
        </ScrollView>
      </KeyboardAvoidingView>

      <Sheet visible={pick === 'when'} onClose={close} title={tr('Thời gian')} done={done} scroll>{when.body}</Sheet>
      <Sheet visible={pick === 'repeat'} onClose={close} title={tr('Lặp lại')} done={done} scroll>{repeat.body}</Sheet>
      <Sheet visible={pick === 'tags'} onClose={close} title={tr('Nhãn')} done={done} scroll>{tags.body}</Sheet>
      <Sheet visible={pick === 'priority'} onClose={close} title={tr('Ưu tiên')}>
        <ListGroup inset={ICON_INSET}>
          {([1, 2, 3, 4] as const).map((n) => (
            <ListItem key={n} left={<View style={s.flagCol}><Ionicons name="flag" size={20} color={priority[n]} /></View>} title={priorityLabel(n)} selected={prio.value === n} chevron={false} onPress={() => { prio.set(n); close(); }} />
          ))}
        </ListGroup>
      </Sheet>
      <Sheet visible={pick === 'project'} onClose={close} title="Project" scroll>
        <ListGroup inset={ICON_INSET}>
          {project.options.map((o) => (
            <ListItem key={o.value || 'inbox'} icon={o.value ? 'folder-outline' : 'file-tray-outline'} title={o.label} selected={project.value === o.value} chevron={false} onPress={() => { project.set(o.value); close(); }} />
          ))}
        </ListGroup>
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: color.background },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingBottom: 8, borderBottomWidth: rule.hair, borderBottomColor: color.border, backgroundColor: color.background },
  headBtn: { minHeight: 44, paddingHorizontal: 10, borderRadius: radius.full, justifyContent: 'center' },
  cancel: { ...text.body, color: color.primary },
  headTitle: { ...text.bar, flex: 1, textAlign: 'center', color: color.foreground },
  saveBtn: { minWidth: 72, marginRight: 4 },
  sheetBody: { padding: 16, gap: 20, paddingBottom: 48 },
  titleBox: { gap: 6 },
  // Same look as the "Việc con" group heading below (ListGroup title).
  fieldHead: { ...text.smMedium, color: color.muted, paddingHorizontal: 4 },
  subs: { padding: 12 },
  flagCol: { width: 28, alignItems: 'center' },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickChip: { height: 36, paddingHorizontal: 14, borderRadius: radius.full, borderWidth: rule.hair, borderColor: color.fieldEdge, justifyContent: 'center' },
  quickOn: { borderColor: color.primary, backgroundColor: color.primaryLight },
  quickText: { ...text.smMedium, color: color.soft },
  form: { gap: 16 },
  group: { gap: 8 },
  label: { ...text.meta, fontWeight: '500', color: color.soft },
  section: { ...text.h2, color: color.foreground, marginTop: 4 },
  muted: { ...text.sm, color: color.muted },
  hint: { ...text.xs, color: color.muted },
  pair: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  // Explicit basis 0: native sized 'flex: N' columns by content, so date and time came out lopsided.
  dateCol: { flexGrow: 6, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  timeCol: { flexGrow: 5, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingBottom: 24 },
  save: { minWidth: 120 },
});
