import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, router, usePathname } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui';
import { color, radius, text } from '@/constants/theme';
import { addDays, today } from '@/lib/dates';
import { type Project, supabase, type Task, useRows, useSession } from '@/lib/supabase';

type Icon = ComponentProps<typeof Ionicons>['name'];

/** Left navigation for wide screens: sections with counts, projects, today's done/overdue, account. */
export function Sidebar() {
  const path = usePathname();
  const day = today();
  const session = useSession();
  const [open] = useRows<Task>('tasks', (q) => q.is('completed_at', null));
  const [done] = useRows<Task>('tasks', (q) => q.eq('completed_day', day), `side:${day}`);
  const [projects] = useRows<Project>('projects', (q) => q.order('name'));

  const due = open.filter((t) => t.due_date && t.due_date <= day).length;
  const over = open.filter((t) => t.due_date && t.due_date < day).length;
  const soon = open.filter((t) => t.due_date && t.due_date > day && t.due_date <= addDays(day, 7)).length;
  const inbox = open.filter((t) => !t.project_id).length;

  return (
    <View style={s.side}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.brand}>
          <View style={s.mark}><Ionicons name="checkmark" size={16} color={color.primaryFg} /></View>
          <Text style={s.brandText}>Việc & Nhật ký</Text>
        </View>
        <Item icon="sunny-outline" label="Hôm nay" n={due} href="/" on={path === '/'} />
        <Item icon="calendar-outline" label="Sắp tới" n={soon} href="/upcoming" on={path === '/upcoming'} />
        <Item icon="file-tray-outline" label="Hộp thư" n={inbox} href="/inbox" on={path === '/inbox'} />
        <Item icon="book-outline" label="Nhật ký" href="/journal" on={path === '/journal'} />

        <View style={s.sec}>
          <Text style={s.secText}>Project</Text>
          <Pressable onPress={() => router.navigate('/projects')} accessibilityLabel="Quản lý project" style={({ pressed }) => [s.secBtn, pressed && s.hover]}>
            <Ionicons name="add" size={18} color={color.muted} />
          </Pressable>
        </View>
        {projects.map((p) => (
          <Item
            key={p.id}
            icon="pricetag-outline"
            label={p.name}
            n={open.filter((t) => t.project_id === p.id).length}
            href={{ pathname: '/project/[id]', params: { id: p.id } }}
            on={path === `/project/${p.id}`}
          />
        ))}
      </ScrollView>

      <View style={s.foot}>
        <Pressable onPress={() => router.navigate('/journal')} style={({ pressed }) => [s.sum, pressed && s.hover]}>
          <Badge tone="success" label={`Xong ${done.length}`} />
          {over > 0 && <Badge tone="warning" label={`Trễ ${over}`} />}
          <Text style={s.muted}>hôm nay</Text>
        </Pressable>
        <View style={s.me}>
          <Text style={[s.muted, s.mail]} numberOfLines={1}>{session?.user.email}</Text>
          <Pressable onPress={() => supabase.auth.signOut()} accessibilityLabel="Đăng xuất" style={({ pressed }) => [s.secBtn, pressed && s.hover]}>
            <Ionicons name="log-out-outline" size={18} color={color.muted} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Item({ icon, label, n, href, on }: { icon: Icon; label: string; n?: number; href: Href; on: boolean }) {
  return (
    <Pressable
      onPress={() => router.navigate(href)}
      accessibilityRole="link"
      accessibilityState={{ selected: on }}
      style={(st) => [s.item, (st.pressed || (st as { hovered?: boolean }).hovered) && s.hover, on && s.on]}
    >
      <Ionicons name={icon} size={18} color={on ? color.primary : color.muted} />
      <Text style={[s.label, on && s.labelOn]} numberOfLines={1}>{label}</Text>
      {!!n && <Text style={[s.n, on && { color: color.neutral }]}>{n}</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  side: { width: 248, backgroundColor: color.surface, borderRightWidth: 1, borderRightColor: color.borderStrong },
  scroll: { padding: 12, paddingTop: 16, gap: 2 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 40, paddingHorizontal: 8, marginBottom: 8 },
  mark: { width: 28, height: 28, borderRadius: 8, backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center' },
  brandText: { ...text.base, fontWeight: '700', color: color.foreground },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 36, paddingHorizontal: 10, borderRadius: radius.sm },
  hover: { backgroundColor: color.itemHover },
  on: { backgroundColor: color.secondary },
  label: { ...text.sm, color: color.foreground, flex: 1 },
  labelOn: { fontWeight: '600' },
  n: { ...text.xs, color: color.muted },
  sec: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, paddingBottom: 4, paddingLeft: 10 },
  secText: { ...text.xs, fontWeight: '600', color: color.muted },
  secBtn: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  foot: { padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: color.borderStrong },
  sum: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6, borderRadius: radius.sm },
  muted: { ...text.xs, color: color.muted },
  me: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 8 },
  mail: { flex: 1 },
});
