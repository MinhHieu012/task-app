import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { type ComponentProps, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Rail, TopBar, useOverdue } from '@/components/Rail';
import { TaskForm } from '@/components/TaskForm';
import { FadeIn, type IconName, useWide } from '@/components/ui';
import { color, duration, radius, rule, text } from '@/constants/theme';
import { haptic } from '@/lib/haptics';
import { tr } from '@/lib/i18n';
import { useReminders } from '@/lib/reminders';
import { Selection } from '@/lib/selection';
import { type Project, type Task, useRows } from '@/lib/supabase';

// Phones: four tabs. Inbox, projects, reports, stats, search and settings stay routes of their own (deep links,
// the wide rail) but live under Browse, so their screens light up its tab.
const TABS: { name: string; label: string; icon: IconName; on: IconName }[] = [
  { name: 'index', label: 'Hôm nay', icon: 'sunny-outline', on: 'sunny' },
  { name: 'upcoming', label: 'Sắp tới', icon: 'calendar-outline', on: 'calendar' },
  { name: 'journal', label: 'Nhật ký', icon: 'book-outline', on: 'book' },
  { name: 'browse', label: 'Duyệt', icon: 'grid-outline', on: 'grid' },
];

type BarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** Phones: the bottom bar, Material 3 style: the current tab's icon in a soft accent pill, labels always shown. */
function TabBar({ state, navigateToTab }: BarProps) {
  const { bottom } = useSafeAreaInsets();
  const over = useOverdue();
  const current = state.routes[state.index].name;
  const lit = TABS.some((t) => t.name === current) ? current : 'browse';
  return (
    <View style={[s.bar, { paddingBottom: bottom + 6 }]} accessibilityRole="tablist">
      {TABS.map((t) => {
        const on = lit === t.name;
        const badge = t.name === 'index' ? over : 0;
        return (
          <Pressable
            key={t.name}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={badge ? `${tr(t.label)}, ${tr('{n} việc quá hạn', { n: badge })}` : tr(t.label)}
            onPress={() => {
              if (current !== t.name) haptic.select();
              // From a Browse screen (a project, settings…), its tab goes back to Browse itself.
              const key = state.routes.find((r) => r.name === t.name)?.key;
              if (key) navigateToTab(key);
            }}
            style={s.tab}
          >
            <View style={[s.pill, on && s.pillOn]}>
              <Ionicons name={on ? t.on : t.icon} size={22} color={on ? color.primary : color.muted} />
              {badge > 0 && (
                <View style={s.badge}><Text style={s.badgeText}>{badge > 99 ? '99+' : badge}</Text></View>
              )}
            </View>
            {/* Own label: the default one clips Vietnamese diacritics on web. */}
            <Text style={[s.label, on && s.labelOn]} numberOfLines={1}>{tr(t.label)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  useReminders();
  const wide = useWide();
  const [selected, select] = useState<string | null>(null);

  const tabs = (
    <Tabs
      backBehavior="history"
      tabBar={wide ? () => null : (p) => <TabBar {...p} />}
      screenOptions={{
        headerShown: false,
        // Cross-fade between tabs (opacity only, no movement, so it stays fine for reduce-motion users).
        animation: 'fade',
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="upcoming" />
      <Tabs.Screen name="journal" />
      <Tabs.Screen name="browse" />
      <Tabs.Screen name="inbox" />
      <Tabs.Screen name="projects" />
      <Tabs.Screen name="project/[id]" />
      <Tabs.Screen name="settings" />
      <Tabs.Screen name="reports" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="stats" />
      {/* Inside the tabs so wide screens keep the rail and top bar while writing a report. */}
      <Tabs.Screen name="report/[day]" />
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
  const project = projects.find((p) => p.id === task?.project_id)?.name ?? tr('Hộp thư');
  // Wider than the screens' 360 aside: the form puts date + time side by side and edits subtasks inline.
  const width = useWindowDimensions().width >= 1440 ? 560 : 480;

  return (
    <FadeIn x={24} ms={duration.panel} style={{ ...s.panel, width }}>
      <View style={s.head}>
        <Text style={s.crumb}>{task ? project : loaded ? tr('Việc đã bị xoá') : ''}</Text>
        <Pressable onPress={onClose} accessibilityLabel={tr('Đóng')} style={(st) => [s.close, (st.pressed || (st as { hovered?: boolean }).hovered) && { backgroundColor: color.itemHover }]}>
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
  bar: { flexDirection: 'row', backgroundColor: color.surface, borderTopWidth: rule.hair, borderTopColor: color.border, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', gap: 4, minHeight: 52 },
  // Always painted (the bar's colour when off): Android dropped the rounding of a background added to a
  // view that had none, so the pill turned square after switching tabs.
  pill: { width: 60, height: 32, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
  pillOn: { backgroundColor: color.primaryLight },
  label: { ...text.xs, fontWeight: '500', color: color.muted },
  labelOn: { fontWeight: '600', color: color.foreground },
  badge: { position: 'absolute', top: 0, right: 10, minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, borderWidth: 2, borderColor: color.surface, backgroundColor: color.danger, alignItems: 'center', justifyContent: 'center' },
  badgeText: { ...text.xs, fontSize: 10, lineHeight: 12, fontWeight: '700', color: color.primaryFg, fontVariant: ['tabular-nums'] },
  row: { flex: 1, flexDirection: 'row', backgroundColor: color.background },
  main: { flex: 1, minWidth: 0 },
  body: { flex: 1, flexDirection: 'row' },
  // Takes the place of the screen's aside, which steps aside while a task is open.
  panel: { backgroundColor: color.surface, borderLeftWidth: rule.hair, borderLeftColor: color.border },
  head: { flexDirection: 'row', alignItems: 'center', paddingTop: 20, paddingLeft: 28, paddingRight: 20 },
  crumb: { ...text.meta, color: color.muted, flex: 1 },
  close: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  panelBody: { paddingHorizontal: 28, paddingTop: 12, paddingBottom: 32, gap: 24 },
});
