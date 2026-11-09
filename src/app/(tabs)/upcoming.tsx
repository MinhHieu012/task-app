import { router } from 'expo-router';
import { type ComponentRef, useContext, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { QuickAdd } from '@/components/QuickAdd';
import { TaskGroup } from '@/components/TaskRow';
import { active, Empty, Field, IconButton, Screen, useWide } from '@/components/ui';
import { addDays, fmtDay, fromIso, parseDate, type Span, spanRange, today, toIso } from '@/lib/dates';
import { color, priority, radius, rule, shadowRaised, text } from '@/constants/theme';
import { tr } from '@/lib/i18n';
import { Selection } from '@/lib/selection';
import { type Project, type Task, useRows } from '@/lib/supabase';

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const COL = 260;
const GAP = 16;
const LANES = 14; // up to two weeks shows every day as a lane; longer ranges list only the days with work

type Pick = Span | 'custom';
const SPANS: [Pick, string][] = [
  ['3d', '3 ngày'], ['1w', '1 tuần'], ['2w', '2 tuần'], ['1m', '1 tháng'], ['q', 'Quý'], ['y', 'Năm'], ['custom', 'Tự chọn'],
];

export default function Upcoming() {
  const day = today();
  const [pick, setPick] = useState<Pick>('1w');
  const [n, setN] = useState(0); // which quarter/year: 0 = current
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');

  const customFrom = parseDate(fromText, day);
  const customTo = parseDate(toText, day);
  const customErr = (fromText && !customFrom) || (toText && !customTo)
    ? tr('Ngày không hợp lệ, gõ DD/MM hoặc DD/MM/YYYY')
    : customFrom && customTo && customFrom > customTo ? tr('Ngày bắt đầu phải trước ngày kết thúc') : undefined;
  const [from, to] = pick === 'custom'
    ? (customFrom && customTo && !customErr ? [customFrom, customTo] : [day, day]) // [day, day] matches nothing (query is > day)
    : spanRange(pick, day, n);

  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);

  const [open] = useRows<Task>(
    'tasks',
    (q) => q.is('completed_at', null).gt('due_date', day).gte('due_date', from).lte('due_date', to).order('due_date').order('due_time', { nullsFirst: false }).order('priority'),
    `${day}:${from}:${to}`,
  );
  const [projects] = useRows<Project>('projects');
  const wide = useWide();
  const lanes = days.length <= LANES;
  const shown = lanes ? days : days.filter((d) => open.some((t) => t.due_date === d));
  // Lanes run to the bottom of the window so the board reads as a week, not a row of stubs.
  // ponytail: 360 ~ top bar + title + range picker + paddings; measure the header if it ever changes size.
  const laneHeight = useWindowDimensions().height - 360;
  const strip = useRef<ComponentRef<typeof ScrollView>>(null);
  const [pos, setPos] = useState({ x: 0, max: 0 }); // max: how far the strip can scroll

  const groups = shown.map((d) => (
    <View key={d} style={wide && lanes ? { width: COL, minHeight: laneHeight, padding: 12, borderRadius: radius.lg, backgroundColor: color.rail } : undefined}>
      <TaskGroup
        title={`${d === addDays(day, 1) ? tr('Ngày mai') : tr(DAYS[fromIso(d).getDay()])}, ${fmtDay(d)}`}
        tasks={open.filter((t) => t.due_date === d)}
        projects={projects}
        hideDate
        compact
        empty={tr('Trống')}
      />
    </View>
  ));

  // Slide one day column per press instead of showing a scrollbar.
  const slide = (dir: number) => strip.current?.scrollTo({ x: Math.max(0, Math.min(pos.max, pos.x + dir * (COL + GAP))), animated: true });
  const arrows = wide && lanes && pos.max > 0 && (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <View style={pos.x <= 0 ? { opacity: 0.35 } : undefined}>
        <IconButton icon="chevron-back" label={tr('Ngày trước')} size={40} surface onPress={() => slide(-1)} />
      </View>
      <View style={pos.x >= pos.max - 1 ? { opacity: 0.35 } : undefined}>
        <IconButton icon="chevron-forward" label={tr('Ngày sau')} size={40} surface onPress={() => slide(1)} />
      </View>
    </View>
  );

  // Quarter/year: one period at a time, stepped with arrows (labels read the same in both languages).
  const end = fromIso(to);
  const period = pick === 'q' ? `Q${(end.getMonth() + 1) / 3}/${end.getFullYear()}` : pick === 'y' ? `${end.getFullYear()}` : null;

  const picker = (
    <View style={{ gap: 12 }}>
      <View style={c.bar}>
        {/* Phones: the segments scroll sideways instead of wrapping onto a second line. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
          <View style={c.seg} accessibilityRole="radiogroup">
            {SPANS.map(([value, label]) => {
              const on = pick === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => { setPick(value); setN(0); }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  style={(st) => [c.segItem, on ? c.segOn : active(st) && { backgroundColor: color.secondaryHover }]}
                >
                  <Text style={[c.segText, on && c.segTextOn]}>{tr(label)}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        {period && (
          <View style={c.step}>
            <View style={n === 0 ? { opacity: 0.35 } : undefined}>
              <IconButton icon="chevron-back" label={tr('Kỳ trước')} onPress={() => setN((v) => Math.max(0, v - 1))} />
            </View>
            <Text style={c.period}>{period}</Text>
            <IconButton icon="chevron-forward" label={tr('Kỳ sau')} onPress={() => setN((v) => v + 1)} />
          </View>
        )}
      </View>
      {pick === 'custom' && (
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 12, maxWidth: 520 }}>
          <View style={{ flex: wide ? 1 : undefined }}>
            <Field label={tr('Từ ngày')} placeholder="DD/MM/YYYY" value={fromText} onChangeText={setFromText} error={customErr} />
          </View>
          <View style={{ flex: wide ? 1 : undefined }}>
            <Field label={tr('Đến ngày')} placeholder="DD/MM/YYYY" value={toText} onChangeText={setToText} />
          </View>
        </View>
      )}
    </View>
  );

  const sub = from < to || pick !== 'custom' ? `${fmtDay(from)} – ${fmtDay(to)}` : undefined;

  // The calendar shows every day of the range, empty or not; the list only the days with work.
  const empty = !(wide && !lanes) && !shown.length;

  return (
    <Screen title={tr('Sắp tới')} sub={sub} maxWidth={100000} right={arrows} footer={<QuickAdd placeholder={tr('Thêm vào Hộp thư…')} />}>
      {picker}
      {empty ? (
        <Empty>{tr('Không có việc nào trong khoảng này.')}</Empty>
      ) : wide && lanes ? (
        // Wide screens, short ranges: one column per day, side by side. Keyed by range so the strip resets.
        <ScrollView
          key={`${from}:${to}`}
          ref={strip}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            setPos({ x: contentOffset.x, max: contentSize.width - layoutMeasurement.width });
          }}
          onLayout={(e) => setPos({ x: 0, max: shown.length * COL + (shown.length - 1) * GAP - e.nativeEvent.layout.width })}
          contentContainerStyle={{ gap: GAP, alignItems: 'flex-start' }}
        >
          {groups}
        </ScrollView>
      ) : wide ? (
        // Wide screens, long ranges: month grids, so the page shows the whole period at a glance.
        <View style={{ gap: 32 }}>
          {months(from, to).map((m) => <Month key={m} first={m} from={from} to={to} tasks={open} />)}
        </View>
      ) : (
        <View style={{ gap: 28 }}>{groups}</View>
      )}
    </Screen>
  );
}

const MORE = 3; // task chips per day cell before "+N"

/** First day ("YYYY-MM-01") of each month the range touches. */
const months = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = `${from.slice(0, 7)}-01`; d <= to; d = toIso(new Date(+d.slice(0, 4), +d.slice(5, 7), 1))) out.push(d);
  return out;
};

/** One month as a Monday-first grid; days outside the range are dimmed. */
function Month({ first, from, to, tasks }: { first: string; from: string; to: string; tasks: Task[] }) {
  const sel = useContext(Selection);
  const start = fromIso(first);
  const lead = (start.getDay() + 6) % 7;
  const count = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const cells = [...Array<string | null>(lead).fill(null), ...Array.from({ length: count }, (_, i) => addDays(first, i))];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const open = (id: string) => (sel ? sel.select(sel.id === id ? null : id) : router.push({ pathname: '/task/[id]', params: { id } }));

  return (
    <View>
      <Text style={c.title}>{tr('Tháng {m}, {y}', { m: start.getMonth() + 1, y: start.getFullYear() })}</Text>
      <View style={c.sheet}>
        <View style={c.week}>
          {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => <Text key={d} style={c.wd}>{tr(d)}</Text>)}
        </View>
        {weeks.map((w, i) => (
          <View key={i} style={[c.week, i === weeks.length - 1 && { borderBottomWidth: 0 }]}>
            {w.map((d, j) => {
              const out = !d || d < from || d > to;
              const mine = d && !out ? tasks.filter((t) => t.due_date === d) : [];
              return (
                <View key={d ?? `b${j}`} style={[c.cell, j === 6 && { borderRightWidth: 0 }, out && c.out]}>
                  {d && <Text style={[c.n, out && c.nOut]}>{Number(d.slice(8))}</Text>}
                  {mine.slice(0, MORE).map((t) => (
                    <Pressable
                      key={t.id}
                      onPress={() => open(t.id)}
                      accessibilityRole="link"
                      style={(st) => [c.chip, (sel?.id === t.id || st.pressed || ('hovered' in st && st.hovered)) && { backgroundColor: color.primaryLight }]}
                    >
                      <View style={[c.dot, { backgroundColor: priority[t.priority as 1 | 2 | 3 | 4] ?? color.muted }]} />
                      <Text style={c.chipText} numberOfLines={1}>{t.title}</Text>
                    </Pressable>
                  ))}
                  {mine.length > MORE && <Text style={c.more}>{tr('+{n} việc', { n: mine.length - MORE })}</Text>}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const c = StyleSheet.create({
  // Range picker: one segmented control on a rail; the chosen segment is a raised white tab.
  bar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  seg: { flexDirection: 'row', padding: 3, gap: 2, borderRadius: radius.ctl, backgroundColor: color.secondary },
  segItem: { height: 34, paddingHorizontal: 14, borderRadius: radius.ctl - 3, justifyContent: 'center' },
  segOn: { backgroundColor: color.surface, boxShadow: shadowRaised },
  segText: { ...text.smMedium, color: color.muted },
  segTextOn: { color: color.foreground, fontWeight: '600' },
  step: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 40, paddingHorizontal: 4, borderRadius: radius.ctl, borderWidth: rule.hair, borderColor: color.border, backgroundColor: color.surface },
  period: { ...text.smMedium, color: color.foreground, minWidth: 72, textAlign: 'center', fontVariant: ['tabular-nums'] },
  title: { ...text.h2, color: color.foreground, marginBottom: 12 },
  sheet: { backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: rule.hair, borderColor: color.border, overflow: 'hidden' },
  week: { flexDirection: 'row', borderBottomWidth: rule.hair, borderBottomColor: color.border },
  wd: { flex: 1, ...text.xs, fontWeight: '500', color: color.muted, paddingVertical: 8, paddingHorizontal: 10 },
  cell: { flex: 1, minWidth: 0, minHeight: 112, padding: 8, gap: 4, borderRightWidth: rule.hair, borderRightColor: color.border },
  out: { backgroundColor: color.rail },
  n: { ...text.sm, fontWeight: '600', color: color.foreground, fontVariant: ['tabular-nums'], paddingHorizontal: 2 },
  nOut: { color: color.muted, fontWeight: '400' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: color.chip },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { ...text.xs, flex: 1, color: color.foreground },
  more: { ...text.xs, color: color.muted, paddingHorizontal: 6 },
});
