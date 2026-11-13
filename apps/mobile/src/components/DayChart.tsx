import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, webEase } from '@/components/ui';
import { color, rule, text } from '@/constants/theme';
import { fmtDay, today } from '@/lib/dates';
import { tr } from '@/lib/i18n';

/** Done per day as bars (Figma "Task Done" chart); with onSelect a bar selects its day. A week labels every bar,
 *  a month every fifth day. */
export function DayChart({ counts, missed, selected, onSelect }: { counts: Record<string, number>; missed: Set<string>; selected?: string; onSelect?: (d: string) => void }) {
  const now = today();
  const days = Object.keys(counts).sort();
  const top = Math.max(...days.map((d) => counts[d]));
  const max = Math.max(top, 1);
  return (
    <Card title={tr('Việc xong theo ngày')} action={<Text style={s.legend}>{top ? tr('Cao nhất {n} việc', { n: top }) : tr('Chưa có việc nào xong')}</Text>}>
      <View style={s.chart}>
        {days.map((d) => {
          const future = d > now;
          const on = d === selected;
          const v = counts[d];
          return (
            <Pressable
              key={d}
              onPress={() => onSelect?.(d)}
              disabled={future || !onSelect}
              accessibilityRole="button"
              accessibilityLabel={tr('{date}: {n} việc xong', { date: fmtDay(d), n: v })}
              accessibilityState={{ selected: on, disabled: future }}
              style={s.col}
            >
              {(st) => (
                <>
                  <View style={s.barArea}>
                    <View
                      style={[
                        s.bar,
                        webEase,
                        { height: v ? 6 + (v / max) * 114 : 4 },
                        { backgroundColor: on ? color.primary : (st as { hovered?: boolean }).hovered ? color.chartBarHover : v ? color.chartBar : color.border },
                        future && { opacity: 0.4 },
                      ]}
                    />
                  </View>
                  <View style={[s.miss, missed.has(d) && { backgroundColor: color.warning }]} />
                  <Text style={[s.tick, on && { color: color.primary, fontWeight: '600' }]}>{days.length <= 7 || Number(d.slice(8)) % 5 === 1 || on ? Number(d.slice(8)) : ''}</Text>
                </>
              )}
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  legend: { ...text.meta, color: color.muted, fontVariant: ['tabular-nums'] },
  // The month's one chart, set large: bars stand on a baseline rule.
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  col: { flex: 1, minWidth: 0, alignItems: 'center', gap: 6 },
  barArea: { height: 140, width: '100%', justifyContent: 'flex-end', alignItems: 'center', borderBottomWidth: rule.bar, borderBottomColor: color.borderStrong },
  bar: { width: '100%', maxWidth: 18, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  miss: { width: 5, height: 5, borderRadius: 3 },
  // Fixed width wider than a phone's day column, centred on it, so two-digit days are not cut.
  tick: { ...text.xs, fontSize: 11, lineHeight: 14, height: 14, width: 28, textAlign: 'center', color: color.muted, fontVariant: ['tabular-nums'] },
});
