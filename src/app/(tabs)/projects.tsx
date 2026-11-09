import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { endDay } from '@/components/TaskRow';
import { active, Button, EmptyState, Field, Screen, Skeleton, useWide } from '@/components/ui';
import { color, projectColor, radius, rule, text } from '@/constants/theme';
import { addDays, fmtDay, today } from '@/lib/dates';
import { tr } from '@/lib/i18n';
import { ok, type Project, supabase, type Task, useRows } from '@/lib/supabase';

// Projects as one table on a sheet (app screens: tables before cards). Phones restack each row.
export default function Projects() {
  const day = today();
  const wide = useWide();
  const [projects, , loaded] = useRows<Project>('projects', (q) => q.order('name'));
  const [open] = useRows<Task>('tasks', (q) => q.is('completed_at', null).not('project_id', 'is', null));
  const [done] = useRows<Task>('tasks', (q) => q.not('project_id', 'is', null).gte('completed_day', addDays(day, -6)), `pdone:${day}`);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    if (ok(await supabase.from('projects').insert({ name: name.trim() }))) setName('');
    setBusy(false);
  };

  const newRow = (
    <View style={[s.newRow, !wide && s.newRowNarrow]}>
      <Text style={s.newLabel}>{tr('Project mới')}</Text>
      <View style={s.newField}>
        <Field value={name} onChangeText={setName} placeholder={tr('Tên project')} aria-label="Tên project mới" onSubmitEditing={add} />
      </View>
      <Button title={tr('Thêm project')} icon="add" variant="primary" onPress={add} loading={busy} />
    </View>
  );

  return (
    <Screen title="Project" sub={loaded ? tr('{p} project, {n} việc đang mở', { p: projects.length, n: open.length }) : undefined} maxWidth={1040}>
      {!loaded ? (
        <View style={s.sheet}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={s.row}>
              <Skeleton width={12} height={12} />
              <Skeleton width="40%" height={16} />
            </View>
          ))}
        </View>
      ) : (
        <>
          {!projects.length && (
            <EmptyState icon="folder-open-outline" title={tr('Chưa có project nào')}>
              {tr('Gom các việc cùng mục tiêu vào một project. Tạo project đầu tiên ở dòng bên dưới.')}
            </EmptyState>
          )}
          <View style={s.sheet}>
            {wide && projects.length > 0 && (
              <View style={[s.row, s.headRow]}>
                <Text style={[s.th, s.cName]}>Project</Text>
                <Text style={[s.th, s.cNum]}>{tr('Đang mở')}</Text>
                <Text style={[s.th, s.cNum]}>{tr('Quá hạn')}</Text>
                <Text style={[s.th, s.cWeek]}>{tr('Xong tuần này')}</Text>
                <Text style={[s.th, s.cNext]}>{tr('Hạn gần nhất')}</Text>
                <View style={s.cGo} />
              </View>
            )}
            {projects.map((p, i) => {
              const mine = open.filter((t) => t.project_id === p.id);
              const over = mine.filter((t) => t.due_date && endDay(t)! < day).length;
              const doneN = done.filter((t) => t.project_id === p.id).length;
              const total = mine.length + doneN;
              const next = mine.map((t) => t.due_date).filter((d): d is string => !!d && d >= day).sort()[0];
              const c = projectColor(i);
              const bar = (
                <View style={s.track}>
                  <View style={[s.fill, { width: `${total ? (doneN / total) * 100 : 0}%`, backgroundColor: c }]} />
                </View>
              );
              return (
                <Pressable
                  key={p.id}
                  onPress={() => router.push({ pathname: '/project/[id]', params: { id: p.id } })}
                  accessibilityRole="link"
                  style={(st) => [s.row, !wide && s.rowNarrow, active(st) && { backgroundColor: color.itemHover }]}
                >
                  {wide ? (
                    <>
                      <View style={[s.cName, s.nameCell]}>
                        <View style={[s.mark, { backgroundColor: c }]} />
                        <Text style={s.name} numberOfLines={1}>{p.name}</Text>
                      </View>
                      <Text style={[s.td, s.cNum]}>{mine.length}</Text>
                      <Text style={[s.td, s.cNum, over > 0 && s.over]}>{over}</Text>
                      <View style={[s.cWeek, s.weekCell]}>
                        {bar}
                        <Text style={s.td}>{doneN}/{total}</Text>
                      </View>
                      <Text style={[s.td, s.cNext, !next && s.mutedText]}>{next ? fmtDay(next) : tr('Chưa có hạn sắp tới')}</Text>
                      <Ionicons name="chevron-forward" size={18} color={color.muted} style={s.cGo} />
                    </>
                  ) : (
                    <>
                      <View style={s.nameCell}>
                        <View style={[s.mark, { backgroundColor: c }]} />
                        <Text style={s.name} numberOfLines={2}>{p.name}</Text>
                        <Ionicons name="chevron-forward" size={18} color={color.muted} />
                      </View>
                      <View style={s.metaLine}>
                        <Text style={s.meta}><Text style={s.b}>{mine.length}</Text> {tr('đang mở')}</Text>
                        {over > 0 && <Text style={[s.meta, s.over]}><Text style={[s.b, s.over]}>{over}</Text> {tr('quá hạn')}</Text>}
                        <Text style={s.meta}>{tr('Xong tuần này')} <Text style={s.b}>{doneN}/{total}</Text></Text>
                      </View>
                      {bar}
                      <Text style={s.meta}>{next ? tr('Hạn gần nhất {date}', { date: fmtDay(next) }) : tr('Chưa có hạn sắp tới')}</Text>
                    </>
                  )}
                </Pressable>
              );
            })}
            {newRow}
          </View>
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  sheet: { backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: rule.hair, borderColor: color.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 56, paddingHorizontal: 20, borderBottomWidth: rule.hair, borderBottomColor: color.border },
  rowNarrow: { flexDirection: 'column', alignItems: 'stretch', gap: 8, paddingVertical: 14, paddingHorizontal: 16 },
  headRow: { minHeight: 40, borderBottomWidth: rule.bar, borderBottomColor: color.borderStrong },
  th: { ...text.meta, fontWeight: '500', color: color.muted },
  td: { ...text.sm, color: color.foreground, fontVariant: ['tabular-nums'] },
  cName: { flex: 1, minWidth: 0 },
  cNum: { width: 72, textAlign: 'right' },
  cWeek: { width: 180, paddingLeft: 24 },
  cNext: { width: 150 },
  cGo: { width: 18 },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  weekCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 12, height: 12, borderRadius: 6 },
  name: { ...text.base, flex: 1, color: color.foreground },
  over: { color: color.danger, fontWeight: '600' },
  mutedText: { color: color.muted },
  metaLine: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4 },
  meta: { ...text.meta, color: color.muted, fontVariant: ['tabular-nums'] },
  b: { fontWeight: '600', color: color.foreground },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: color.secondary, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16, paddingHorizontal: 20, backgroundColor: color.rail },
  newRowNarrow: { flexDirection: 'column', alignItems: 'stretch', gap: 10, paddingHorizontal: 16 },
  newLabel: { ...text.base, color: color.foreground },
  newField: { flex: 1, minWidth: 0 },
});
