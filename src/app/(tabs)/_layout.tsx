import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Text } from 'react-native';

import { color } from '@/constants/theme';

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
  return (
    <Tabs
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
    </Tabs>
  );
}
