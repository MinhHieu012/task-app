import { type ComponentRef, useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { active } from '@/components/ui';
import { color, radius, text } from '@/constants/theme';
import { fmtDay, fromIso, today } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { tr } from '@/lib/i18n';

const SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const CELL = 48;
const GAP = 6;

/** Phones: days as a row of tappable cells (weekday, date, a count under it), scrolling sideways when there
 *  are more than fit. The selected day sits in the accent wash and is kept in view. `mark` colours a day's
 *  count (overdue red, a missed day amber). */
export function WeekStrip({ days, selected, counts = {}, onPick, mark = {}, padded = true }: {
  days: string[]; selected?: string; counts?: Record<string, number>; onPick: (day: string) => void; mark?: Record<string, string>; padded?: boolean;
}) {
  const strip = useRef<ComponentRef<typeof ScrollView>>(null);
  const now = today();
  const at = selected ? days.indexOf(selected) : -1;
  // The count line only takes room when some day has one: an empty line under every date read as a gap.
  const any = days.some((d) => (counts[d] ?? 0) > 0);

  // Keeps the selected day about a third in from the left as it changes (from a tap or from the list below).
  useEffect(() => {
    if (at >= 0) strip.current?.scrollTo({ x: Math.max(0, at * (CELL + GAP) - (CELL + GAP) * 2), animated: true });
  }, [at]);

  return (
    <ScrollView
      ref={strip}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[s.row, padded && s.padded]}
      accessibilityRole="tablist"
    >
      {days.map((d) => {
        const on = d === selected;
        const n = counts[d] ?? 0;
        const wd = tr(SHORT[fromIso(d).getDay()]);
        return (
          <Pressable
            key={d}
            onPress={() => { haptic.select(); onPick(d); }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={tr('{day} {date}: {n} việc', { day: wd, date: fmtDay(d), n })}
            style={(st) => [s.cell, active(st) && !on && { backgroundColor: color.itemHover }, on && s.on]}
          >
            <Text style={[s.wd, d === now && s.now, on && s.onText]}>{wd}</Text>
            <Text style={[s.n, d === now && s.now, on && s.onText]}>{Number(d.slice(8))}</Text>
            {any && (
              <View style={s.countRow}>
                {n > 0 && <Text style={[s.count, mark[d] ? { color: mark[d] } : on && s.onText]}>{n}</Text>}
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: { gap: GAP },
  padded: { paddingHorizontal: 16, paddingVertical: 8 },
  // Painted even when off (Android lost the rounding of a background set later; see the tab bar's pill).
  cell: { width: CELL, alignItems: 'center', paddingTop: 8, paddingBottom: 8, borderRadius: radius.md, gap: 1, backgroundColor: color.background },
  on: { backgroundColor: color.primaryLight },
  wd: { ...text.xs, color: color.muted },
  n: { ...text.base, fontSize: 17, lineHeight: 24, color: color.foreground, fontVariant: ['tabular-nums'] },
  now: { color: color.primary, fontWeight: '700' },
  onText: { color: color.primary },
  countRow: { height: 16, justifyContent: 'center' },
  count: { ...text.xs, fontWeight: '600', color: color.muted, fontVariant: ['tabular-nums'] },
});
