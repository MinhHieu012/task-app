import { type ReactNode, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { active, Button, Field, IconButton } from '@/components/ui';
import { color, radius, shadowModal, text } from '@/constants/theme';
import { fmtDate, monthGrid, parseDate, parseTime, today } from '@/lib/dates';
import { tr } from '@/lib/i18n';

const WD = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const pad = (n: number) => String(n).padStart(2, '0');

/** Date input: type "DD/MM" or "DD/MM/YYYY", or pick from a month calendar. `value` is the typed text.
 *  `base`: ISO day the calendar opens on when the field is empty (e.g. the parent task's day). */
export function DateField({ label, value, onChange, error, hint, base }: {
  label?: string; value: string; onChange: (v: string) => void; error?: string; hint?: string; base?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const picked = value.trim() ? parseDate(value) : null;
  return (
    <>
      <Field
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder="DD/MM/YYYY"
        error={error}
        hint={hint}
        aria-label={label}
        trailing={<IconButton icon="calendar-outline" label={tr('Chọn ngày')} onPress={() => setOpen(true)} />}
      />
      {open && (
        <Popup title={tr('Chọn ngày')} onClose={() => setOpen(false)}>
          <Calendar
            selected={picked}
            start={picked ?? base ?? today()}
            onPick={(d) => { onChange(d ? fmtDate(d) : ''); setOpen(false); }}
          />
        </Popup>
      )}
    </>
  );
}

/** Time input: type "HH:MM", or pick hour then minute from a grid. */
export function TimeField({ label, value, onChange, error }: { label?: string; value: string; onChange: (v: string) => void; error?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Field
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder="HH:MM"
        error={error}
        aria-label={label}
        trailing={<IconButton icon="time-outline" label={tr('Chọn giờ')} onPress={() => setOpen(true)} />}
      />
      {open && (
        <Popup title={tr('Chọn giờ')} onClose={() => setOpen(false)}>
          <Clock value={value} onChange={onChange} onClose={() => setOpen(false)} />
        </Popup>
      )}
    </>
  );
}

function Popup({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel={tr('Đóng')}>
        {/* Swallows taps so a tap inside the card doesn't close it. */}
        <Pressable style={s.card} onPress={() => {}}>
          <View style={s.bar}>
            <Text style={s.barTitle}>{title}</Text>
            <IconButton icon="close" label={tr('Đóng')} onPress={onClose} />
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Calendar({ selected, start, onPick }: { selected: string | null; start: string; onPick: (iso: string | null) => void }) {
  const [ym, setYm] = useState({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) });
  const move = (d: number) => setYm(({ y, m }) => ({ y: m + d > 12 ? y + 1 : m + d < 1 ? y - 1 : y, m: ((m + d + 11) % 12) + 1 }));
  const now = today();
  return (
    <View style={s.gap}>
      <View style={s.head}>
        <IconButton icon="chevron-back" label={tr('Tháng trước')} onPress={() => move(-1)} size={40} />
        <Text style={s.title}>{tr('Tháng {m}, {y}', { m: ym.m, y: ym.y })}</Text>
        <IconButton icon="chevron-forward" label={tr('Tháng sau')} onPress={() => move(1)} size={40} />
      </View>
      <View style={s.grid}>
        {WD.map((d) => <Text key={d} style={s.wd}>{tr(d)}</Text>)}
        {monthGrid(ym.y, ym.m).map((d, i) =>
          d ? (
            <Pressable
              key={d}
              onPress={() => onPick(d)}
              accessibilityRole="button"
              accessibilityLabel={fmtDate(d)}
              accessibilityState={{ selected: d === selected }}
              style={(st) => [s.cell, s.day, active(st) && { backgroundColor: color.itemHover }, d === selected && s.on]}
            >
              <Text style={[s.n, d === now && s.today, d === selected && s.onText]}>{Number(d.slice(8))}</Text>
            </Pressable>
          ) : <View key={`b${i}`} style={s.cell} />,
        )}
      </View>
      <View style={s.foot}>
        <Button title={tr('Xoá')} variant="ghost" onPress={() => onPick(null)} />
        <Button title={tr('Hôm nay')} onPress={() => onPick(now)} />
      </View>
    </View>
  );
}

function Clock({ value, onChange, onClose }: { value: string; onChange: (v: string) => void; onClose: () => void }) {
  const t = parseTime(value);
  const [h, m] = t ? t.split(':') : [null, null];
  const cell = (label: string, on: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={(st) => [s.tcell, s.day, active(st) && { backgroundColor: color.itemHover }, on && s.on]}
    >
      <Text style={[s.n, on && s.onText]}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={s.gap}>
      <Text style={s.label}>{tr('Giờ')}</Text>
      <View style={s.grid}>{Array.from({ length: 24 }, (_, i) => cell(pad(i), h === pad(i), () => onChange(`${pad(i)}:${m ?? '00'}`)))}</View>
      <Text style={s.label}>{tr('Phút')}</Text>
      {/* Picking the minute finishes the time, so it closes; odd minutes (09:07) are typed by hand. */}
      <View style={s.grid}>{Array.from({ length: 12 }, (_, i) => cell(pad(i * 5), m === pad(i * 5), () => { onChange(`${h ?? '09'}:${pad(i * 5)}`); onClose(); }))}</View>
      <View style={s.foot}>
        <Button title={tr('Xoá')} variant="ghost" onPress={() => { onChange(''); onClose(); }} />
        <Button title={tr('Xong')} variant="primary" onPress={onClose} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: color.backdrop, justifyContent: 'center', alignItems: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 340, backgroundColor: color.surface, borderRadius: radius.lg, padding: 16, boxShadow: shadowModal },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginRight: -4 },
  barTitle: { ...text.base, fontWeight: '600', color: color.foreground },
  gap: { gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...text.base, color: color.foreground },
  label: { ...text.meta, fontWeight: '500', color: color.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  wd: { width: '14.2857%', textAlign: 'center', ...text.xs, color: color.muted, paddingVertical: 4 },
  cell: { width: '14.2857%', height: 40 },
  tcell: { width: '16.6667%', height: 38 },
  day: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  on: { backgroundColor: color.primary },
  n: { ...text.sm, color: color.foreground, fontVariant: ['tabular-nums'] },
  onText: { color: color.primaryFg, fontWeight: '600' },
  today: { fontWeight: '700', color: color.primary },
  foot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
});
