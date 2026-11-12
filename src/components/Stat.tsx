import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { type IconName, useWide } from '@/components/ui';
import { color, radius, rule, text } from '@/constants/theme';

/** The day's figures as one line on a sheet: columns split by hairlines, no icon tiles. */
export function StatRow({ children }: { children: ReactNode }) {
  // Phones: a 2x2 grid, so every label fits on its lines (four in a row cut them to "Xong trong th…").
  return <View style={[s.row, !useWide() && s.grid]}>{children}</View>;
}

// `icon` stays in the props for the callers; this material sets figures without icon tiles.
export function Stat({ label, n, tone, foot, pad = true }: { icon: IconName; label: string; n: number | string; tone?: string; foot: ReactNode; pad?: boolean }) {
  const wide = useWide();
  // Phones never pad to two digits: "00" over a label reads as a dashboard prop, not a count.
  const value = typeof n === 'number' && pad && wide ? String(n).padStart(2, '0') : String(n);
  return (
    <View style={[s.stat, !wide && s.narrow]}>
      <Text style={s.label} numberOfLines={wide ? 2 : undefined}>{label}</Text>
      <Text style={[s.n, !wide && s.nNarrow, tone && { color: tone }]}>{value}</Text>
      <View style={[s.foot, !wide && s.footNarrow]}>{foot}</View>
    </View>
  );
}

/** Small bar chart, last value in the accent. Bars instead of a line: no chart library in the app. */
export function Bars({ values, label, height = 28 }: { values: number[]; label: string; height?: number }) {
  const max = Math.max(...values, 1);
  return (
    <View style={[s.bars, { height }]} accessibilityLabel={`${label}: ${values.join(', ')}`}>
      {values.map((v, i) => (
        <View key={i} style={[s.bar, { height: 4 + (v / max) * (height - 4) }, i === values.length - 1 && { backgroundColor: color.primary }]} />
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
  row: { flexDirection: 'row', backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: rule.hair, borderColor: color.border, overflow: 'hidden' },
  stat: { flex: 1, minWidth: 0, paddingVertical: 18, paddingHorizontal: 24, gap: 6, borderRightWidth: rule.hair, borderRightColor: color.border },
  // Phones: a label may wrap to two lines in one column and not the next; pinning the figure to the
  // bottom keeps the figures on one baseline across the row.
  grid: { flexWrap: 'wrap', borderWidth: 0 },
  narrow: { flex: 0, width: '50%', paddingVertical: 14, paddingHorizontal: 16, gap: 2, borderBottomWidth: rule.hair, borderBottomColor: color.border },
  label: { ...text.sm, color: color.muted },
  n: { fontFamily: text.h1.fontFamily, fontSize: 40, lineHeight: 44, fontWeight: '600', letterSpacing: -1.2, color: color.foreground, fontVariant: ['tabular-nums'] },
  nNarrow: { fontSize: 24, lineHeight: 30, letterSpacing: -0.5 },
  foot: { paddingTop: 10, marginTop: 4, borderTopWidth: rule.hair, borderTopColor: color.border, minHeight: 41, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  footNarrow: { paddingTop: 2, marginTop: 0, borderTopWidth: 0, minHeight: 0 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  bar: { width: 6, borderRadius: 3, backgroundColor: color.chartBar },
});
