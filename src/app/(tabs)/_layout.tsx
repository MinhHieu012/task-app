import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NAV, Rail, TopBar, useOverdue } from '@/components/Rail';
import { TaskForm } from '@/components/TaskForm';
import { FadeIn, type IconName, useWide } from '@/components/ui';
import { color, duration, radius, rule, text } from '@/constants/theme';
import { useReminders } from '@/lib/reminders';
import { Selection } from '@/lib/selection';
import { type Project, type Task, useRows } from '@/lib/supabase';

const tab = (title: string, icon: IconName, badge?: number) => ({
  title,
  tabBarIcon: ({ color: c }: { color: unknown }) => <Ionicons name={icon} size={22} color={c as string} />,
  // Own label: the default one clips Vietnamese diacritics on web.
  tabBarLabel: ({ color: c, focused }: { color: unknown; focused: boolean }) => (
    <Text style={{ ...text.xs, fontWeight: focused ? '600' : '500', color: c as string }}>{title}</Text>
  ),
  tabBarBadge: badge || undefined,
  tabBarBadgeStyle: { backgroundColor: color.danger, color: color.primaryFg, fontFamily: text.xs.fontFamily, fontSize: 10, fontWeight: '600' as const },
});
const icon = (label: string) => NAV.find((n) => n.label === label)!.icon;

export default function TabLayout() {
  useReminders();
  const wide = useWide();
  const over = useOverdue();
  const { bottom } = useSafeAreaInsets();
  const [selected, select] = useState<string | null>(null);

  const tabs = (
    <Tabs
      backBehavior="history"
      tabBar={wide ? () => null : undefined}
      screenOptions={{
        headerShown: false,
        // Cross-fade between tabs (opacity only, no movement, so it stays fine for reduce-motion users).
        animation: 'fade',
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color.muted,
        tabBarLabelPosition: 'below-icon',
        // The tab bar would otherwise sit between the footer input and the keyboard on Android.
        tabBarHideOnKeyboard: true,
        // A fixed height/padding replaces the default safe-area padding, so add the bottom inset back
        // or the labels sit on the home indicator / gesture bar.
        tabBarStyle: { backgroundColor: color.surface, borderTopColor: color.borderStrong, borderTopWidth: rule.bar, height: 64 + bottom, paddingTop: 6, paddingBottom: 8 + bottom },
      }}
    >
      <Tabs.Screen name="index" options={tab('Hôm nay', icon('Hôm nay'), over)} />
      <Tabs.Screen name="upcoming" options={tab('Sắp tới', icon('Sắp tới'))} />
      <Tabs.Screen name="inbox" options={tab('Hộp thư', icon('Hộp thư'))} />
      <Tabs.Screen name="projects" options={tab('Project', icon('Project'))} />
      <Tabs.Screen name="journal" options={tab('Nhật ký', icon('Nhật ký'))} />
      {/* Hidden from the tab bar but still routable (href: null drops the URL). */}
      <Tabs.Screen name="project/[id]" options={{ tabBarItemStyle: { display: 'none' } }} />
    </Tabs>
  );
  if (!wide) return tabs;

  return (
    <Selection.Provider value={{ id: selected, select }}>
      <View style={s.row}>
        <Rail />
        <View style={s.main}>
          <TopBar />
          <View style={s.body}>
            <View style={s.main}>{tabs}</View>
            {selected && <TaskPanel id={selected} onClose={() => select(null)} />}
          </View>
        </View>
      </View>
    </Selection.Provider>
  );
}

/** Right-hand editor for the selected task on wide screens; takes the place of a screen's aside. */
function TaskPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const [rows, , loaded] = useRows<Task>('tasks', (q) => q.eq('id', id), id);
  const [projects] = useRows<Project>('projects', (q) => q.order('name'));
  const task = rows[0];
  const project = projects.find((p) => p.id === task?.project_id)?.name ?? 'Hộp thư';

  return (
    <FadeIn x={24} ms={duration.panel} style={s.panel}>
      <View style={s.head}>
        <Text style={s.crumb}>{task ? project : loaded ? 'Việc đã bị xoá' : ''}</Text>
        <Pressable onPress={onClose} accessibilityLabel="Đóng" style={(st) => [s.close, (st.pressed || (st as { hovered?: boolean }).hovered) && { backgroundColor: color.itemHover }]}>
          <Ionicons name="close" size={18} color={color.muted} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={s.panelBody}>
        {task && <TaskForm key={task.id} task={task} projects={projects} onDone={onClose} bare />}
      </ScrollView>
    </FadeIn>
  );
}

const s = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', backgroundColor: color.background },
  main: { flex: 1, minWidth: 0 },
  body: { flex: 1, flexDirection: 'row' },
  // Same width as Today's aside, which steps aside while a task is open.
  panel: { width: 360, backgroundColor: color.surface, borderLeftWidth: rule.hair, borderLeftColor: color.border },
  head: { flexDirection: 'row', alignItems: 'center', paddingTop: 20, paddingLeft: 28, paddingRight: 20 },
  crumb: { ...text.meta, color: color.muted, flex: 1 },
  close: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  panelBody: { paddingHorizontal: 28, paddingTop: 12, paddingBottom: 32, gap: 24 },
});
