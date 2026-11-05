import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useContext, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { endDay } from '@/components/TaskRow';
import { Button, EmptyState, Field, Screen, Skeleton, useWide } from '@/components/ui';
import { color, projectColor, radius, text } from '@/constants/theme';
import { addDays, fmtDay, today } from '@/lib/dates';
import { Selection } from '@/lib/selection';
import { ok, type Project, supabase, type Task, useRows } from '@/lib/supabase';

const GAP = 24;
const MIN_CARD = 280;

export default function Projects() {
  const day = today();
  const wide = useWide();
  const sel = useContext(Selection);
  const { width } = useWindowDimensions();
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

  // Columns from the room left beside the rail (and the task panel when open).
  const room = wide ? width - 88 - 64 - (sel?.id ? 360 : 0) : width - 32;
  const cols = Math.max(1, Math.floor((room + GAP) / (MIN_CARD + GAP)));
  const cardWidth = (room - (cols - 1) * GAP) / cols;

  const newCard = (
    <View style={[s.card, s.newCard, { width: cardWidth }]}>
      <View style={s.top}>
        <View style={[s.mark, { backgroundColor: color.background }]}><Ionicons name="add" size={20} color={color.muted} /></View>
        <Text style={s.name}>Project mới</Text>
      </View>
      <Field value={name} onChangeText={setName} placeholder="Tên project" aria-label="Tên project mới" onSubmitEditing={add} boxStyle={s.newField} />
      <Button title="Thêm project" icon="add" variant="primary" onPress={add} loading={busy} />
    </View>
  );

  return (
    <Screen title="Project" sub={loaded ? `${projects.length} project · ${open.length} việc đang mở` : undefined} maxWidth={100000}>
      {!loaded ? (
        <View style={s.grid}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[s.card, { width: cardWidth }]}>
              <Skeleton width={40} height={40} />
              <Skeleton width="60%" height={16} />
              <Skeleton width="100%" height={8} />
            </View>
          ))}
        </View>
      ) : (
        <>
          {!projects.length && (
            <EmptyState icon="folder-open-outline" title="Chưa có project nào">
              Gom các việc cùng mục tiêu vào một project. Tạo project đầu tiên ở card bên dưới.
            </EmptyState>
          )}
          <View style={s.grid}>
            {projects.map((p, i) => {
              const mine = open.filter((t) => t.project_id === p.id);
              const over = mine.filter((t) => t.due_date && endDay(t)! < day).length;
              const doneN = done.filter((t) => t.project_id === p.id).length;
              const total = mine.length + doneN;
              const next = mine.map((t) => t.due_date).filter((d): d is string => !!d && d >= day).sort()[0];
              const c = projectColor(i);
              return (
                <Pressable
                  key={p.id}
                  onPress={() => router.push({ pathname: '/project/[id]', params: { id: p.id } })}
                  style={(st) => [s.card, { width: cardWidth }, (st.pressed || (st as { hovered?: boolean }).hovered) && { borderColor: color.borderStrong }]}
                >
                  <View style={s.top}>
                    <View style={[s.mark, { backgroundColor: `${c}1f` }]}><Ionicons name="folder-outline" size={20} color={c} /></View>
                    <Text style={s.name} numberOfLines={2}>{p.name}</Text>
                    <Ionicons name="chevron-forward" size={18} color={color.muted} />
                  </View>
                  <View style={s.counts}>
                    <Text style={s.meta}><Text style={s.b}>{mine.length}</Text> đang mở</Text>
                    {over > 0 && <Text style={[s.meta, { color: color.danger }]}><Text style={[s.b, { color: color.danger }]}>{over}</Text> quá hạn</Text>}
                  </View>
                  <View style={s.progress}>
                    <View style={s.progressHead}>
                      <Text style={s.meta}>Xong tuần này</Text>
                      <Text style={s.metaStrong}>{doneN}/{total}</Text>
                    </View>
                    <View style={s.track}>
                      <View style={[s.fill, { width: `${total ? (doneN / total) * 100 : 0}%`, backgroundColor: c }]} />
                    </View>
                  </View>
                  <View style={s.foot}>
                    <Ionicons name="calendar-clear-outline" size={14} color={color.muted} />
                    <Text style={s.meta}>{next ? `Hạn gần nhất ${fmtDay(next)}` : 'Chưa có hạn sắp tới'}</Text>
                  </View>
                </Pressable>
              );
            })}
            {newCard}
          </View>
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, alignItems: 'stretch' },
  card: { backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: 'transparent', padding: 20, gap: 16 },
  newCard: { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: color.borderStrong, gap: 12 },
  newField: { backgroundColor: color.surface, borderColor: color.borderStrong },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mark: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  name: { ...text.base, flex: 1, color: color.foreground },
  counts: { flexDirection: 'row', gap: 16 },
  meta: { ...text.meta, color: color.muted },
  metaStrong: { ...text.meta, fontWeight: '600', color: color.foreground },
  b: { fontWeight: '600', color: color.foreground },
  progress: { gap: 8 },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 6, borderRadius: 3, backgroundColor: color.background, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 14, borderTopWidth: 1, borderTopColor: color.border },
});
