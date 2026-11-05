import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { type ComponentProps, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Sidebar } from '@/components/Sidebar';
import { TaskForm } from '@/components/TaskForm';
import { useWide } from '@/components/ui';
import { color, radius, text } from '@/constants/theme';
import { useReminders } from '@/lib/reminders';
import { Selection } from '@/lib/selection';
import { type Project, type Task, useRows } from '@/lib/supabase';

type Icon = ComponentProps<typeof Ionicons>['name'];
const tab = (title: string, icon: Icon) => ({
  title,
  tabBarIcon: ({ color: c }: { color: unknown }) => <Ionicons name={icon} size={22} color={c as string} />,
  // Own label: the default one clips Vietnamese diacritics on web.
  tabBarLabel: ({ color: c, focused }: { color: unknown; focused: boolean }) => (
    <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: focused ? '600' : '500', color: c as string }}>{title}</Text>
  ),
});

export default function TabLayout() {
  useReminders();
  const wide = useWide();
  const [selected, select] = useState<string | null>(null);

  const tabs = (
    <Tabs
      backBehavior="history"
      tabBar={wide ? () => null : undefined}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color.muted,
        tabBarLabelPosition: 'below-icon',
        tabBarStyle: { backgroundColor: color.surface, borderTopColor: color.borderStrong, height: 64, paddingTop: 6, paddingBottom: 8 },
      }}
    >
      <Tabs.Screen name="index" options={tab('Hôm nay', 'sunny-outline')} />
      <Tabs.Screen name="upcoming" options={tab('Sắp tới', 'calendar-outline')} />
      <Tabs.Screen name="inbox" options={tab('Hộp thư', 'file-tray-outline')} />
      <Tabs.Screen name="projects" options={tab('Project', 'folder-outline')} />
      <Tabs.Screen name="journal" options={tab('Nhật ký', 'book-outline')} />
      {/* Hidden from the tab bar but still routable (href: null drops the URL). */}
      <Tabs.Screen name="project/[id]" options={{ tabBarItemStyle: { display: 'none' } }} />
    </Tabs>
  );
  if (!wide) return tabs;

  return (
    <Selection.Provider value={{ id: selected, select }}>
      <View style={s.row}>
        <Sidebar />
        <View style={s.main}>{tabs}</View>
        {selected && <TaskPanel id={selected} onClose={() => select(null)} />}
      </View>
    </Selection.Provider>
  );
}

/** Right-hand editor for the selected task on wide screens. */
function TaskPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const [rows, , loaded] = useRows<Task>('tasks', (q) => q.eq('id', id), id);
  const [projects] = useRows<Project>('projects', (q) => q.order('name'));
  const task = rows[0];
  const project = projects.find((p) => p.id === task?.project_id)?.name ?? 'Hộp thư';

  return (
    <View style={s.panel}>
      <View style={s.head}>
        <Text style={s.crumb}>{task ? project : loaded ? 'Việc đã bị xoá' : ''}</Text>
        <Pressable onPress={onClose} accessibilityLabel="Đóng" style={({ pressed }) => [s.close, pressed && { backgroundColor: color.itemHover }]}>
          <Ionicons name="close" size={18} color={color.foreground} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={s.body}>
        {task && <TaskForm key={task.id} task={task} projects={projects} onDone={onClose} />}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', backgroundColor: color.background },
  main: { flex: 1, minWidth: 0 },
  panel: { width: 400, backgroundColor: color.background, borderLeftWidth: 1, borderLeftColor: color.borderStrong },
  head: { flexDirection: 'row', alignItems: 'center', height: 56, paddingLeft: 20, paddingRight: 12, backgroundColor: color.surface, borderBottomWidth: 1, borderBottomColor: color.borderStrong },
  crumb: { ...text.sm, color: color.muted, flex: 1 },
  close: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, gap: 16 },
});
