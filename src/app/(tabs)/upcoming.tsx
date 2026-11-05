import { type ComponentRef, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { QuickAdd } from '@/components/QuickAdd';
import { TaskGroup } from '@/components/TaskRow';
import { IconButton, Screen, useWide } from '@/components/ui';
import { addDays, fmtDay, fromIso, today } from '@/lib/dates';
import { type Project, type Task, useRows } from '@/lib/supabase';

const DAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const COL = 260;
const GAP = 16;

export default function Upcoming() {
  const day = today();
  const days = Array.from({ length: 7 }, (_, i) => addDays(day, i + 1));
  const [open] = useRows<Task>(
    'tasks',
    (q) => q.is('completed_at', null).gt('due_date', day).lte('due_date', days[6]).order('due_time', { nullsFirst: false }).order('priority'),
    day,
  );
  const [projects] = useRows<Project>('projects');
  const wide = useWide();
  const strip = useRef<ComponentRef<typeof ScrollView>>(null);
  const [pos, setPos] = useState({ x: 0, max: 0 }); // max: how far the strip can scroll

  const groups = days.map((d, i) => (
    <View key={d} style={wide ? { width: COL } : undefined}>
      <TaskGroup
        title={`${i === 0 ? 'Ngày mai' : DAYS[fromIso(d).getDay()]} · ${fmtDay(d)}`}
        tasks={open.filter((t) => t.due_date === d)}
        projects={projects}
        hideDate
        compact
        empty="Trống"
      />
    </View>
  ));

  // Slide one day column per press instead of showing a scrollbar.
  const slide = (dir: number) => strip.current?.scrollTo({ x: Math.max(0, Math.min(pos.max, pos.x + dir * (COL + GAP))), animated: true });
  const arrows = wide && pos.max > 0 && (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <View style={pos.x <= 0 ? { opacity: 0.35 } : undefined}>
        <IconButton icon="chevron-back" label="Ngày trước" size={40} surface onPress={() => slide(-1)} />
      </View>
      <View style={pos.x >= pos.max - 1 ? { opacity: 0.35 } : undefined}>
        <IconButton icon="chevron-forward" label="Ngày sau" size={40} surface onPress={() => slide(1)} />
      </View>
    </View>
  );

  return (
    <Screen title="Sắp tới" sub="7 ngày tới" maxWidth={100000} right={arrows} footer={<QuickAdd placeholder="Thêm vào Hộp thư…" />}>
      {/* Wide screens: one column per day, side by side. */}
      {wide ? (
        <ScrollView
          ref={strip}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            setPos({ x: contentOffset.x, max: contentSize.width - layoutMeasurement.width });
          }}
          onLayout={(e) => setPos((p) => ({ ...p, max: days.length * COL + (days.length - 1) * GAP - e.nativeEvent.layout.width }))}
          contentContainerStyle={{ gap: GAP, alignItems: 'flex-start' }}
        >
          {groups}
        </ScrollView>
      ) : groups}
    </Screen>
  );
}
