import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { type IconName, useWide } from '@/components/ui';
import { color, rule, text } from '@/constants/theme';

/** The day's figures as one ruled ledger line on a sheet: columns split by hairlines, no icons, no boxes. */
export function StatRow({ children }: { children: ReactNode }) {
  return <View style={s.row}>{children}</View>;
}

// `icon` stays in the props for the callers; this material sets figures without icon tiles.
export function Stat({ label, n, tone, foot, pad = true }: { icon: IconName; label: string; n: number | string; tone?: string; foot: ReactNode; pad?: boolean }) {
  const wide = useWide();
  const value = typeof n === 'number' && pad ? String(n).padStart(2, '0') : String(n);
  return (
    <View style={[s.stat, !wide && s.narrow]}>
      <Text style={[s.label, !wide && s.labelNarrow]} numberOfLines={2}>{label}</Text>
      <Text style={[s.n, !wide && s.nNarrow, tone && { color: tone }]}>{value}</Text>
      {wide && <View style={s.foot}>{foot}</View>}
    </View>
  );
}

/** Small bar chart, last value marked in ink. Bars instead of a line: no chart library in the app. */
export function Bars({ values, label, height = 28 }: { values: number[]; label: string; height?: number }) {
  const max = Math.max(...values, 1);
  return (
    <View style={[s.bars, { height }]} accessibilityLabel={`${label}: ${values.join(', ')}`}>
      {values.map((v, i) => (
        <View key={i} style={[s.bar, { height: 4 + (v / max) * (height - 4) }, i === values.length - 1 && { backgroundColor: color.foreground }]} />
      ))}
    </View>
  );
}

/** Text styles for a figure's foot line: muted with the numbers in ink. */
export const statText = StyleSheet.create({
  foot: { ...text.meta, color: color.muted, flexShrink: 1, fontVariant: ['tabular-nums'] },
  b: { fontWeight: '600', color: color.foreground },
});

const s = StyleSheet.create({
  row: { flexDirection: 'row', backgroundColor: color.surface, borderTopWidth: rule.bar, borderTopColor: color.foreground },
  stat: { flex: 1, minWidth: 0, paddingVertical: 18, paddingHorizontal: 24, gap: 6, borderRightWidth: rule.hair, borderRightColor: color.border },
  narrow: { paddingVertical: 12, paddingHorizontal: 12, gap: 2 },
  label: { ...text.sm, color: color.muted },
  labelNarrow: { ...text.xs },
  n: { fontFamily: text.h1.fontFamily, fontSize: 40, lineHeight: 44, fontWeight: '600', letterSpacing: -1.2, color: color.foreground, fontVariant: ['tabular-nums'] },
  nNarrow: { fontSize: 24, lineHeight: 30, letterSpacing: -0.5 },
  foot: { paddingTop: 10, marginTop: 4, borderTopWidth: rule.hair, borderTopColor: color.border, minHeight: 41, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  bar: { width: 6, backgroundColor: color.border },
});
