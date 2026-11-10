import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, router, usePathname } from 'expo-router';
import { StyleSheet, Text, View, Pressable } from 'react-native';

import { QuickAdd } from '@/components/QuickAdd';
import { Avatar, type IconName } from '@/components/ui';
import { color, radius, rule, text } from '@/constants/theme';
import { dayTitle, today } from '@/lib/dates';
import { tr } from '@/lib/i18n';
import { type Project, type Task, useRows } from '@/lib/supabase';

export const NAV: { href: Href; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: '/', label: 'Hôm nay', icon: 'sunny-outline', match: (p) => p === '/' },
  { href: '/upcoming', label: 'Sắp tới', icon: 'calendar-outline', match: (p) => p === '/upcoming' },
  { href: '/inbox', label: 'Hộp thư', icon: 'file-tray-outline', match: (p) => p === '/inbox' },
  { href: '/projects', label: 'Project', icon: 'folder-outline', match: (p) => p.startsWith('/project') },
  { href: '/journal', label: 'Nhật ký', icon: 'book-outline', match: (p) => p === '/journal' },
  { href: '/stats', label: 'Thống kê', icon: 'stats-chart-outline', match: (p) => p === '/stats' },
  { href: '/search', label: 'Tìm kiếm', icon: 'search-outline', match: (p) => p === '/search' },
];

/** Overdue open tasks, for the dot on "Hôm nay". */
export function useOverdue() {
  const day = today();
  const [open] = useRows<Task>('tasks', (q) => q.is('completed_at', null).lt('due_date', day), `over:${day}`);
  return open.filter((t) => (t.end_date ?? t.due_date)! < day).length;
}

/** Wide screens: 88px icon rail on a warm paper step; labels show as tooltips on hover. */
export function Rail() {
  const path = usePathname();
  const over = useOverdue();

  return (
    <View style={s.rail}>
      <View style={s.mark}><Ionicons name="checkmark-done" size={20} color={color.primaryFg} /></View>
      <View style={s.items}>
        {NAV.map((n) => (
          <RailItem key={n.label} icon={n.icon} label={tr(n.label)} on={n.match(path)} badge={n.href === '/' ? over : 0} onPress={() => router.navigate(n.href)} />
        ))}
      </View>
      <View style={s.foot}>
        <RailItem icon="settings-outline" label={tr('Cài đặt')} on={path === '/settings'} onPress={() => router.navigate('/settings')} />
        <Avatar />
      </View>
    </View>
  );
}

function RailItem({ icon, label, on, badge, onPress }: { icon: IconName; label: string; on?: boolean; badge?: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      style={(st) => [s.item, !on && (st.pressed || (st as { hovered?: boolean }).hovered) && s.itemHover, on && s.itemOn]}
    >
      {(st) => (
        <>
          <Ionicons name={icon} size={22} color={on ? color.primary : (st as { hovered?: boolean }).hovered ? color.foreground : color.muted} />
          {!!badge && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{badge > 99 ? '99+' : badge}</Text>
            </View>
          )}
          {(st as { hovered?: boolean }).hovered && <Text style={s.tip}>{label}</Text>}
        </>
      )}
    </Pressable>
  );
}


/** Wide screens: a white top bar with the quick add box in the middle and today's date on the right. */
export function TopBar() {
  const path = usePathname();
  const day = today();
  const [projects] = useRows<Project>('projects');
  const projectId = path.startsWith('/project/') ? path.split('/')[2] : null;
  const name = projects.find((p) => p.id === projectId)?.name;
  const add =
    projectId ? { defaults: { project_id: projectId }, placeholder: tr('Thêm việc vào {name}…', { name: name ?? 'project' }) }
    : path === '/' ? { defaults: { due_date: day }, placeholder: tr('Thêm việc cho hôm nay…') }
    : { defaults: {}, placeholder: tr('Thêm vào Hộp thư…') };

  return (
    <View style={s.top}>
      <View style={s.qa}><QuickAdd key={path} flat {...add} /></View>
      <View style={s.pill}>
        <Ionicons name="calendar-clear-outline" size={14} color={color.soft} />
        <Text style={s.pillText}>{dayTitle(day)}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // Above the main column so hover labels are not covered by the page.
  rail: { width: 88, zIndex: 20, backgroundColor: color.rail, borderRightWidth: rule.hair, borderRightColor: color.border, alignItems: 'center', paddingVertical: 20 },
  mark: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 40 },
  items: { gap: 8, flex: 1 },
  item: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  itemHover: { backgroundColor: color.secondaryHover },
  // The current page: a soft accent wash, the icon in the accent.
  itemOn: { backgroundColor: color.primaryLight },
  badge: { position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: color.danger, alignItems: 'center', justifyContent: 'center' },
  badgeText: { ...text.xs, fontSize: 10, lineHeight: 14, fontWeight: '600', color: color.primaryFg, fontVariant: ['tabular-nums'] },
  tip: { ...text.xs, position: 'absolute', left: 58, top: 14, backgroundColor: color.foreground, color: color.primaryFg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm, zIndex: 30, width: 'max-content' as never },
  foot: { alignItems: 'center', gap: 8 },

  // Above the page so quick add's tag suggestions can drop over it.
  top: { zIndex: 10, height: 72, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 32, backgroundColor: color.surface, borderBottomWidth: rule.hair, borderBottomColor: color.border },
  qa: { flex: 1, maxWidth: 460, marginHorizontal: 'auto' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36 },
  pillText: { ...text.meta, color: color.soft, fontVariant: ['tabular-nums'] },
});
