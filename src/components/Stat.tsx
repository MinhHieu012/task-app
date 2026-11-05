import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { type IconName, useWide } from '@/components/ui';
import { color, radius, text } from '@/constants/theme';

/** Row of number cards (Figma dashboard). Phones get compact cards: label and number only. */
export function StatRow({ children }: { children: ReactNode }) {
  const wide = useWide();
  return <View style={[s.row, !wide && { gap: 8 }]}>{children}</View>;
}

export function Stat({ icon, label, n, tone, foot, pad = true }: { icon: IconName; label: string; n: number | string; tone?: string; foot: ReactNode; pad?: boolean }) {
  const wide = useWide();
  const value = typeof n === 'number' && pad ? String(n).padStart(2, '0') : String(n);
  if (!wide) {
    return (
      <View style={[s.stat, s.narrow]}>
        <Text style={s.labelNarrow} numberOfLines={2}>{label}</Text>
        <Text style={[s.n, s.nNarrow, tone && { color: tone }]}>{value}</Text>
      </View>
    );
  }
  return (
    <View style={s.stat}>
      <View style={s.top}>
        <View style={s.icon}><Ionicons name={icon} size={18} color={color.soft} /></View>
        <Text style={s.label}>{label}</Text>
        <Text style={[s.n, tone && { color: tone }]}>{value}</Text>
      </View>
      <View style={s.foot}>{foot}</View>
    </View>
  );
}

/** Small bar chart, last value highlighted. Bars instead of the Figma line: no chart library in the app. */
export function Bars({ values, label, height = 28 }: { values: number[]; label: string; height?: number }) {
  const max = Math.max(...values, 1);
  return (
    <View style={[s.bars, { height }]} accessibilityLabel={`${label}: ${values.join(', ')}`}>
      {values.map((v, i) => (
        <View key={i} style={[s.bar, { height: 4 + (v / max) * (height - 4) }, i === values.length - 1 && { backgroundColor: color.success }]} />
      ))}
    </View>
  );
}

/** Text styles for a card footer: muted line with bold numbers. */
export const statText = StyleSheet.create({
  foot: { ...text.meta, color: color.muted, flexShrink: 1 },
  b: { fontWeight: '600', color: color.foreground },
});

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 24 },
  stat: { flex: 1, minWidth: 0, backgroundColor: color.surface, borderRadius: radius.lg, paddingVertical: 20, paddingHorizontal: 24, gap: 16 },
  narrow: { paddingVertical: 12, paddingHorizontal: 12, gap: 4 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.background, alignItems: 'center', justifyContent: 'center' },
  label: { ...text.sm, fontSize: 15, flex: 1, color: color.soft },
  labelNarrow: { ...text.xs, color: color.soft },
  n: { ...text.h1, lineHeight: 32, color: color.foreground, fontVariant: ['tabular-nums'] },
  nNarrow: { fontSize: 22, lineHeight: 28 },
  foot: { borderTopWidth: 1, borderTopColor: color.border, paddingTop: 14, minHeight: 47, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  bar: { width: 6, borderRadius: 3, backgroundColor: color.primaryLight },
});
