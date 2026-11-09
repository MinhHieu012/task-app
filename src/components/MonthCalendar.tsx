import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { color, radius, text } from '@/constants/theme';
import { today, toIso } from '@/lib/dates';
import { tr } from '@/lib/i18n';

const WD = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/** Month grid (weeks start Monday): done count per day, amber dot on days with missed tasks. */
export function MonthCalendar({ year, month, selected, counts, missed, onSelect, onMonth }: {
  year: number; month: number; // month is 1-based
  selected: string;
  counts: Record<string, number>;
  missed: Set<string>;
  onSelect: (day: string) => void;
  onMonth: (delta: number) => void;
}) {
  const now = today();
  const lead = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const days = Object.keys(counts).sort();
  const cells = [...Array<string | null>(lead).fill(null), ...days];
  const isCurrent = now.startsWith(`${year}-${String(month).padStart(2, '0')}`);

  return (
    <View style={s.root}>
      <View style={s.head}>
        <NavButton icon="chevron-back" label={tr('Tháng trước')} onPress={() => onMonth(-1)} />
        <Text style={s.title}>{tr('Tháng {m}, {y}', { m: month, y: year })}</Text>
        <NavButton icon="chevron-forward" label={tr('Tháng sau')} onPress={() => onMonth(1)} disabled={isCurrent} />
      </View>
      <View style={s.grid}>
        {WD.map((d) => <Text key={d} style={s.wd}>{d}</Text>)}
        {cells.map((d, i) => {
          if (!d) return <View key={`b${i}`} style={s.cell} />;
          const on = d === selected, future = d > now, n = counts[d];
          return (
            <Pressable
              key={d}
              onPress={() => onSelect(d)}
              disabled={future}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: future }}
              accessibilityLabel={tr('{date}: {n} việc xong', { date: `${d.slice(8)}/${d.slice(5, 7)}`, n })}
              style={({ pressed }) => [s.cell, s.day, pressed && { backgroundColor: color.itemHover }, on && { backgroundColor: color.primary }]}
            >
              <Text style={[s.n, future && s.future, d === now && s.today, on && { color: color.primaryFg }]}>{Number(d.slice(8))}</Text>
              <Text style={[s.cnt, on && { color: color.primaryFg }]}>{!future && n ? n : ''}</Text>
              {missed.has(d) && <View style={s.miss} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function NavButton({ icon, label, onPress, disabled }: { icon: 'chevron-back' | 'chevron-forward'; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityLabel={label} style={({ pressed }) => [s.nav, pressed && { backgroundColor: color.itemHover }, disabled && { opacity: 0.35 }]}>
      <Ionicons name={icon} size={18} color={color.foreground} />
    </Pressable>
  );
}

export const monthOf = (iso: string) => ({ year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) });
/** Day to select after moving to another month: today in the current month, otherwise its last day. */
export function dayForMonth(year: number, month: number) {
  const now = today();
  return now.startsWith(`${year}-${String(month).padStart(2, '0')}`) ? now : toIso(new Date(year, month, 0));
}

const s = StyleSheet.create({
  root: { width: '100%', maxWidth: 448, alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { ...text.base, color: color.foreground },
  nav: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  wd: { width: '14.2857%', textAlign: 'center', ...text.xs, color: color.muted, paddingVertical: 4 },
  cell: { width: '14.2857%', height: 48 },
  day: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  n: { ...text.sm, color: color.foreground, fontVariant: ['tabular-nums'] },
  today: { fontWeight: '700', textDecorationLine: 'underline' },
  future: { color: color.muted, opacity: 0.5 },
  cnt: { fontFamily: text.xs.fontFamily, fontSize: 11, lineHeight: 16, minHeight: 16, fontWeight: '600', color: color.success, fontVariant: ['tabular-nums'] },
  miss: { position: 'absolute', top: 6, right: '22%', width: 6, height: 6, borderRadius: 1, backgroundColor: color.warning },
});
