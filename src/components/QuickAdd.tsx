import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { active, Field } from '@/components/ui';
import { color, radius, rule, shadowModal, text } from '@/constants/theme';
import { dayTitle, today } from '@/lib/dates';
import { tr } from '@/lib/i18n';
import { EXAMPLES as X, parseQuick, quickFields } from '@/lib/quick';
import { refresh, supabase, type Task, useKnownTags } from '@/lib/supabase';
import { completeTag, suggestTags } from '@/lib/tags';

// The last mounted quick add box answers "Thêm việc" buttons and the N shortcut.
let focusLatest: (() => void) | null = null;
export const focusQuickAdd = () => focusLatest?.();

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    const el = e.target as HTMLElement | null;
    if (e.key.toLowerCase() !== 'n' || e.metaKey || e.ctrlKey || e.altKey || el?.closest('input, textarea, [contenteditable="true"]')) return;
    e.preventDefault();
    focusQuickAdd();
  });
}

/** Add box: Enter saves; the text is cleared only after a successful insert (KTD7, AE5).
 *  `defaults` may be a function so values like "now" are taken at submit time.
 *  Typed syntax (mai, thứ 6, 20/11, 9h, !1, #nhãn) sets the date, time, priority and tags. While the box has focus a
 *  panel shows what was understood and offers the syntax as chips, so nobody has to remember it. */
export function QuickAdd({ defaults = {}, placeholder = tr('Thêm việc…'), flat }: { defaults?: Partial<Task> | (() => Partial<Task>); placeholder?: string; flat?: boolean }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const blur = useRef<ReturnType<typeof setTimeout>>(undefined);
  const suggestions = suggestTags(title, useKnownTags());
  const q = parseQuick(title);
  // The journal logs work already done on its day: there a typed date or time means nothing.
  const logging = !!(typeof defaults === 'function' ? defaults() : defaults).completed_at;

  const edit = (next: (v: string) => string) => {
    setTitle(next);
    input.current?.focus(); // tapping a chip took focus from the box
  };
  const pick = (tag: string) => edit((v) => completeTag(v, tag));
  // "#" is left open so the tag suggestions take over; everything else gets a space to type on.
  const insert = (token: string) => edit((v) => `${v.trimEnd()} ${token}`.trimStart() + (token === X.tag ? '' : ' '));

  useEffect(() => {
    const focus = () => input.current?.focus();
    focusLatest = focus;
    return () => {
      if (focusLatest === focus) focusLatest = null;
    };
  }, []);

  const add = async () => {
    // A box of only syntax and tags has no title to save.
    if (!q.title || busy) return;
    setBusy(true);
    const d = typeof defaults === 'function' ? defaults() : defaults;
    // No time given: starts now, ends at the end of that day. Typed syntax wins over the screen's defaults.
    const day = d.due_date ?? today();
    const now = new Date().toTimeString().slice(0, 5);
    const typed = logging ? (q.priority ? { priority: q.priority } : {}) : quickFields(q);
    const { error: e } = await supabase.from('tasks').insert({ title: q.title, due_date: day, due_time: now, end_date: day, end_time: '23:59:59', ...d, ...typed, tags: q.tags });
    setBusy(false);
    if (e) return setError(tr('Chưa lưu được. Kiểm tra mạng rồi thử lại.'));
    refresh('tasks'); // realtime can arrive late; show the new task at once
    setTitle('');
    setError('');
  };

  // What the box understood so far, as it will be saved.
  const understood = [
    !logging && q.date ? { icon: 'calendar-clear-outline' as const, label: dayTitle(q.date) } : null,
    !logging && q.time ? { icon: 'time-outline' as const, label: q.time } : null,
    q.priority ? { icon: 'flag-outline' as const, label: tr('Ưu tiên {n}', { n: q.priority }) } : null,
    ...q.tags.map((t) => ({ icon: 'pricetag-outline' as const, label: `#${t}` })),
  ].filter((x) => x !== null);
  // The syntax not used yet, as chips that type it in.
  const hints: [string, string][] = [
    ...(!logging && !q.date ? ([[X.tomorrow, tr('ngày mai')], [X.weekday, tr('thứ Sáu tới')], [X.day, tr('một ngày')]] as [string, string][]) : []),
    ...(!logging && !q.time ? ([[X.time, tr('giờ bắt đầu')]] as [string, string][]) : []),
    ...(!q.priority ? ([[X.priority, tr('ưu tiên 1, !2, !3')]] as [string, string][]) : []),
    [X.tag, tr('nhãn')],
  ];

  return (
    <View>
      <Field
        ref={input}
        icon="add-circle-outline"
        value={title}
        onChangeText={(v) => {
          setTitle(v);
          if (error) setError('');
        }}
        placeholder={placeholder}
        aria-label={tr('Tên việc mới')}
        autoComplete="off" // a task title, never a login: keeps password managers from filling the email here
        onSubmitEditing={add}
        onFocus={() => {
          clearTimeout(blur.current);
          setFocused(true);
        }}
        // Late, so a tap on a chip lands before the panel goes.
        onBlur={() => { blur.current = setTimeout(() => setFocused(false), 200); }}
        // Web: Tab takes the first tag suggestion instead of leaving the box.
        onKeyPress={(e) => {
          if (e.nativeEvent.key !== 'Tab' || !suggestions.length) return;
          e.preventDefault();
          pick(suggestions[0]);
        }}
        submitBehavior="submit"
        returnKeyType="done"
        error={error}
        boxStyle={flat ? undefined : s.raised}
        trailing={busy ? <ActivityIndicator color={color.primary} /> : Platform.OS === 'web' ? <Text style={s.kbd}>N</Text> : null}
      />
      {focused && (
        // Floats over the page: down from the top bar (flat), up from a footer box so the keyboard doesn't hide it.
        <View style={[s.pop, flat ? s.down : s.up]}>
          {understood.length > 0 && (
            <View style={s.line} accessibilityLabel={tr('Sẽ lưu')}>
              <Text style={s.lead}>{tr('Sẽ lưu')}</Text>
              {understood.map((u) => (
                <View key={u.label} style={s.got}>
                  <Ionicons name={u.icon} size={13} color={color.primary} />
                  <Text style={s.gotText}>{u.label}</Text>
                </View>
              ))}
            </View>
          )}
          {suggestions.length > 0 ? (
            <View style={s.line} accessibilityLabel={tr('Nhãn gợi ý')}>
              <Text style={s.lead}>{tr('Nhãn')}</Text>
              {suggestions.map((tag, i) => (
                <Pressable
                  key={tag}
                  onPress={() => pick(tag)}
                  accessibilityRole="button"
                  accessibilityLabel={tr('Thêm nhãn {tag}', { tag })}
                  style={(st) => [s.chip, active(st) && { backgroundColor: color.itemHover }]}
                >
                  <Text style={s.chipText}>#{tag}</Text>
                  {i === 0 && Platform.OS === 'web' && <Text style={s.kbd}>Tab</Text>}
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={s.line}>
              <Text style={s.lead}>{tr('Gõ thêm')}</Text>
              {hints.map(([token, means]) => (
                <Pressable
                  key={token}
                  onPress={() => insert(token)}
                  accessibilityRole="button"
                  accessibilityLabel={tr('Chèn {token}: {means}', { token, means })}
                  style={(st) => [s.hint, active(st) && { backgroundColor: color.itemHover }]}
                >
                  <Text style={s.hintToken}>{token}</Text>
                  <Text style={s.hintMeans}>{means}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  // On the slate page the box takes the sheet colour; `flat` sits in the top bar, which is already the sheet.
  raised: { backgroundColor: color.surface },
  pop: { position: 'absolute', left: 0, right: 0, zIndex: 50, gap: 8, padding: 10, borderRadius: radius.ctl, borderWidth: rule.hair, borderColor: color.border, backgroundColor: color.surface, boxShadow: shadowModal },
  down: { top: '100%', marginTop: 6 },
  up: { bottom: '100%', marginBottom: 6 },
  line: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  lead: { ...text.xs, color: color.muted, marginRight: 2 },
  got: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 8, borderRadius: radius.sm, backgroundColor: color.primaryLight },
  gotText: { ...text.meta, fontWeight: '500', color: color.primary, fontVariant: ['tabular-nums'] },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 30, paddingHorizontal: 10, borderRadius: radius.full, borderWidth: rule.hair, borderColor: color.border },
  hintToken: { ...text.meta, fontWeight: '600', color: color.foreground },
  hintMeans: { ...text.xs, color: color.muted },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 10, borderRadius: radius.full, backgroundColor: color.primaryLight },
  chipText: { ...text.meta, fontWeight: '500', color: color.primary },
  kbd: { ...text.xs, fontSize: 11, lineHeight: 18, color: color.muted, borderWidth: rule.hair, borderColor: color.border, borderRadius: radius.sm, paddingHorizontal: 6 },
});
