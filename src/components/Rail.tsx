import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, router, usePathname } from 'expo-router';
import { StyleSheet, Text, View, Pressable } from 'react-native';

import { QuickAdd } from '@/components/QuickAdd';
import { type IconName } from '@/components/ui';
import { color, radius, shadowPrimary, text } from '@/constants/theme';
import { fmtDay, fromIso, today } from '@/lib/dates';
import { type Project, supabase, type Task, useRows, useSession } from '@/lib/supabase';

export const NAV: { href: Href; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: '/', label: 'Hôm nay', icon: 'sunny-outline', match: (p) => p === '/' },
  { href: '/upcoming', label: 'Sắp tới', icon: 'calendar-outline', match: (p) => p === '/upcoming' },
  { href: '/inbox', label: 'Hộp thư', icon: 'file-tray-outline', match: (p) => p === '/inbox' },
  { href: '/projects', label: 'Project', icon: 'folder-outline', match: (p) => p.startsWith('/project') },
  { href: '/journal', label: 'Nhật ký', icon: 'book-outline', match: (p) => p === '/journal' },
];

/** Overdue open tasks, for the dot on "Hôm nay". */
export function useOverdue() {
  const day = today();
  const [open] = useRows<Task>('tasks', (q) => q.is('completed_at', null).lt('due_date', day), `over:${day}`);
  return open.filter((t) => (t.end_date ?? t.due_date)! < day).length;
}

/** Wide screens: 88px icon rail (Figma), labels show as tooltips on hover. */
export function Rail() {
  const path = usePathname();
  const session = useSession();
  const over = useOverdue();
  const initial = (session?.user.email ?? '?')[0].toUpperCase();

  return (
    <View style={s.rail}>
      <View style={s.mark}><Ionicons name="checkmark-done" size={20} color={color.primaryFg} /></View>
      <View style={s.items}>
        {NAV.map((n) => (
          <RailItem key={n.label} icon={n.icon} label={n.label} on={n.match(path)} badge={n.href === '/' ? over : 0} onPress={() => router.navigate(n.href)} />
        ))}
      </View>
      <View style={s.foot}>
        <RailItem icon="log-out-outline" label="Đăng xuất" onPress={() => supabase.auth.signOut()} />
        <View style={s.avatar} accessibilityLabel={session?.user.email}><Text style={s.avatarText}>{initial}</Text></View>
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
          <Ionicons name={icon} size={22} color={on ? color.primaryFg : (st as { hovered?: boolean }).hovered ? color.foreground : color.muted} />
          {!!badge && (
            <View style={[s.badge, on && { backgroundColor: color.primaryFg }]}>
              <Text style={[s.badgeText, on && { color: color.primary }]}>{badge > 99 ? '99+' : badge}</Text>
            </View>
          )}
          {(st as { hovered?: boolean }).hovered && <Text style={s.tip}>{label}</Text>}
        </>
      )}
    </Pressable>
  );
}

const WEEKDAY = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/** Wide screens: white top bar with the quick add box in the middle and today's date on the right. */
export function TopBar() {
  const path = usePathname();
  const day = today();
  const [projects] = useRows<Project>('projects');
  const projectId = path.startsWith('/project/') ? path.split('/')[2] : null;
  const name = projects.find((p) => p.id === projectId)?.name;
  const add =
    projectId ? { defaults: { project_id: projectId }, placeholder: `Thêm việc vào ${name ?? 'project'}…` }
    : path === '/' ? { defaults: { due_date: day }, placeholder: 'Thêm việc cho hôm nay…' }
    : { defaults: {}, placeholder: 'Thêm vào Hộp thư…' };

  return (
    <View style={s.top}>
      <View style={s.qa}><QuickAdd key={path} flat {...add} /></View>
      <View style={s.pill}>
        <Ionicons name="calendar-clear-outline" size={14} color={color.soft} />
        <Text style={s.pillText}>{WEEKDAY[fromIso(day).getDay()]}, {fmtDay(day)}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  // Above the main column so hover labels are not covered by the page.
  rail: { width: 88, zIndex: 20, backgroundColor: color.rail, alignItems: 'center', paddingVertical: 20 },
  mark: { width: 40, height: 40, borderRadius: radius.ctl, backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 40 },
  items: { gap: 8, flex: 1 },
  item: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  itemHover: { backgroundColor: color.itemHover },
  itemOn: { backgroundColor: color.primary, boxShadow: shadowPrimary },
  badge: { position: 'absolute', top: 7, right: 7, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: color.danger, alignItems: 'center', justifyContent: 'center' },
  badgeText: { ...text.xs, fontSize: 10, lineHeight: 14, fontWeight: '600', color: '#fff' },
  tip: { ...text.xs, position: 'absolute', left: 58, top: 14, backgroundColor: color.foreground, color: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, zIndex: 30, width: 'max-content' as never },
  foot: { alignItems: 'center', gap: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...text.smMedium, fontWeight: '600', color: color.primary },

  top: { height: 76, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 32, backgroundColor: color.surface },
  qa: { flex: 1, maxWidth: 460, marginHorizontal: 'auto' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: color.field },
  pillText: { ...text.meta, color: color.soft },
});
