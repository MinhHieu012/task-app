import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { QuickAdd } from '@/components/QuickAdd';
import { TaskGroup } from '@/components/TaskRow';
import { Card, Empty, Screen } from '@/components/ui';
import { color, radius, text } from '@/constants/theme';
import { fromIso, today } from '@/lib/dates';
import { type Project, type Task, useRows } from '@/lib/supabase';

const WEEKDAY = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export default function Today() {
  const day = today();
  const [open, , loaded] = useRows<Task>(
    'tasks',
    (q) => q.is('completed_at', null).lte('due_date', day).order('due_date').order('due_time', { nullsFirst: false }).order('priority'),
    day,
  );
  const [done] = useRows<Task>('tasks', (q) => q.eq('completed_day', day), `done:${day}`);
  const [projects] = useRows<Project>('projects');

  const over = open.filter((t) => t.due_date! < day);
  const due = open.filter((t) => t.due_date === day);
  const [, m, d] = day.split('-');

  return (
    <Screen
      title="Hôm nay"
      sub={`${WEEKDAY[fromIso(day).getDay()]}, ${d}/${m}${loaded ? ` · ${open.length} việc` : ''}`}
      footer={<QuickAdd defaults={{ due_date: day }} placeholder="Thêm việc cho hôm nay…" />}
    >
      {done.length > 0 && (
        <Pressable onPress={() => router.push('/journal')} style={({ pressed }) => [s.done, pressed && { opacity: 0.8 }]}>
          <Ionicons name="checkmark-circle-outline" size={14} color={color.success} />
          <Text style={s.doneText}>Đã xong hôm nay: {done.length}</Text>
          <Ionicons name="chevron-forward" size={14} color={color.success} />
        </Pressable>
      )}
      {!loaded ? null : open.length === 0 ? (
        <Card>
          <View style={s.empty}>
            <Text style={s.emptyTitle}>Xong hết việc hôm nay</Text>
            <Empty>Việc có hạn hôm nay sẽ hiện ở đây.</Empty>
          </View>
        </Card>
      ) : (
        <>
          {over.length > 0 && <TaskGroup title="Quá hạn" over tasks={over} projects={projects} />}
          <TaskGroup title="Hôm nay" tasks={due} projects={projects} empty="Không còn việc nào có hạn hôm nay." />
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  done: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 32, paddingHorizontal: 12, borderRadius: radius.full, backgroundColor: color.successBg },
  doneText: { ...text.xs, fontWeight: '500', color: color.success },
  empty: { alignItems: 'center', paddingTop: 16 },
  emptyTitle: { ...text.base, color: color.foreground },
});
