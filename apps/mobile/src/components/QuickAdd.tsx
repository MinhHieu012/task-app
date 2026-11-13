import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { type ComponentRef, type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { active, ErrorText, Fab, Field, type IconName } from '@/components/ui';
import { color, font, radius, rule, shadowModal, text, touch } from '@/constants/theme';
import { dayTitle, today } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { tr } from '@/lib/i18n';
import { EXAMPLES as X, parseQuick, quickFields } from '@/lib/quick';
import { refresh, supabase, type Task, useKnownTags } from '@/lib/supabase';
import { completeTag, suggestTags } from '@/lib/tags';

// The quick add that answers "Thêm việc" buttons and the N shortcut: the focused screen's add sheet on phones,
// the last mounted box on wide screens.
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

type Defaults = Partial<Task> | (() => Partial<Task>);

/** The quick add's state and save, shared by the wide box and the phone sheet.
 *  Enter saves; the text is cleared only after a successful insert (KTD7, AE5). `defaults` may be a function so
 *  values like "now" are taken at submit time. Typed syntax (mai, thứ 6, 20/11, 9h, !1, #nhãn) sets the date,
 *  time, priority and tags; `understood` and `hints` show what was read and the syntax not used yet. */
function useQuickAdd(defaults: Defaults, input: RefObject<ComponentRef<typeof TextInput> | null>) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
  const change = (v: string) => {
    setTitle(v);
    if (error) setError('');
  };

  const add = async () => {
    // A box of only syntax and tags has no title to save.
    if (!q.title || busy) return false;
    setBusy(true);
    const d = typeof defaults === 'function' ? defaults() : defaults;
    // No time given: starts now, ends at the end of that day. Typed syntax wins over the screen's defaults.
    const day = d.due_date ?? today();
    const now = new Date().toTimeString().slice(0, 5);
    const typed = logging ? (q.priority ? { priority: q.priority } : {}) : quickFields(q);
    const { error: e } = await supabase.from('tasks').insert({ title: q.title, due_date: day, due_time: now, end_date: day, end_time: '23:59:59', ...d, ...typed, tags: q.tags });
    setBusy(false);
    if (e) {
      setError(tr('Chưa lưu được. Kiểm tra mạng rồi thử lại.'));
      return false;
    }
    refresh('tasks'); // realtime can arrive late; show the new task at once
    setTitle('');
    setError('');
    return true;
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
  return { title, change, busy, error, suggestions, add, understood, hints, pick, insert, ready: !!q.title };
}

/** Wide screens: the add box in the top bar (`flat`), with a panel of what it understood while focused. */
export function QuickAdd({ defaults = {}, placeholder = tr('Thêm việc…'), flat }: { defaults?: Defaults; placeholder?: string; flat?: boolean }) {
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const qa = useQuickAdd(defaults, input);
  const [focused, setFocused] = useState(false);
  const blur = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const focus = () => input.current?.focus();
    focusLatest = focus;
    return () => {
      if (focusLatest === focus) focusLatest = null;
    };
  }, []);

  return (
    <View>
      <Field
        ref={input}
        icon="add-circle-outline"
        value={qa.title}
        onChangeText={qa.change}
        placeholder={placeholder}
        aria-label={tr('Tên việc mới')}
        autoComplete="off" // a task title, never a login: keeps password managers from filling the email here
        onSubmitEditing={qa.add}
        onFocus={() => {
          clearTimeout(blur.current);
          setFocused(true);
        }}
        // Late, so a tap on a chip lands before the panel goes.
        onBlur={() => { blur.current = setTimeout(() => setFocused(false), 200); }}
        // Web: Tab takes the first tag suggestion instead of leaving the box.
        onKeyPress={(e) => {
          if (e.nativeEvent.key !== 'Tab' || !qa.suggestions.length) return;
          e.preventDefault();
          qa.pick(qa.suggestions[0]);
        }}
        submitBehavior="submit"
        returnKeyType="done"
        error={qa.error}
        boxStyle={flat ? undefined : s.raised}
        trailing={qa.busy ? <ActivityIndicator color={color.primary} /> : Platform.OS === 'web' ? <Text style={s.kbd}>N</Text> : null}
      />
      {focused && (
        // Floats over the page: down from the top bar (flat), up from a footer box so the keyboard doesn't hide it.
        <View style={[s.pop, flat ? s.down : s.up]}>
          {qa.understood.length > 0 && (
            <View style={s.line} accessibilityLabel={tr('Sẽ lưu')}>
              <Text style={s.lead}>{tr('Sẽ lưu')}</Text>
              {qa.understood.map((u) => <Got key={u.label} icon={u.icon} label={u.label} />)}
            </View>
          )}
          {qa.suggestions.length > 0 ? (
            <View style={s.line} accessibilityLabel={tr('Nhãn gợi ý')}>
              <Text style={s.lead}>{tr('Nhãn')}</Text>
              {qa.suggestions.map((tag, i) => <TagChip key={tag} tag={tag} onPress={() => qa.pick(tag)} kbd={i === 0 && Platform.OS === 'web'} />)}
            </View>
          ) : (
            <View style={s.line}>
              <Text style={s.lead}>{tr('Gõ thêm')}</Text>
              {qa.hints.map(([token, means]) => <Hint key={token} token={token} means={means} onPress={() => qa.insert(token)} />)}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

/** Phones: the floating + of a screen, opening the add sheet. The sheet sits on the keyboard and stays open
 *  after each add, so several tasks go in one after another; swipe it down (or press back) when done. */
export function AddFab({ defaults = {}, placeholder = tr('Thêm việc…'), label = tr('Thêm việc') }: { defaults?: Defaults; placeholder?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const qa = useQuickAdd(defaults, input);
  const [added, setAdded] = useState(0); // this sheet's count, so the user sees each add land

  // The focused screen answers focusQuickAdd (tabs keep the others mounted behind it).
  useFocusEffect(useCallback(() => {
    const show = () => setOpen(true);
    focusLatest = show;
    return () => { if (focusLatest === show) focusLatest = null; };
  }, []));

  const submit = async () => {
    if (await qa.add()) {
      haptic.tick();
      setAdded((n) => n + 1);
    }
  };
  const close = () => { setOpen(false); setAdded(0); };

  return (
    <>
      <Fab label={label} onPress={() => setOpen(true)} />
      <Sheet visible={open} onClose={close} focus={input}>
        <View style={s.entry}>
          <TextInput
            ref={input}
            value={qa.title}
            onChangeText={qa.change}
            placeholder={placeholder}
            placeholderTextColor={color.muted}
            aria-label={tr('Tên việc mới')}
            autoComplete="off"
            onSubmitEditing={submit}
            submitBehavior="submit"
            returnKeyType="send"
            multiline
            style={s.entryInput}
          />
          <Pressable
            onPress={submit}
            disabled={!qa.ready || qa.busy}
            accessibilityRole="button"
            accessibilityLabel={tr('Thêm')}
            style={[s.send, !qa.ready && s.sendOff]}
          >
            {qa.busy ? <ActivityIndicator color={color.primaryFg} /> : <Ionicons name="arrow-up" size={22} color={qa.ready ? color.primaryFg : color.muted} />}
          </Pressable>
        </View>
        {!!qa.error && <ErrorText key={qa.error}>{qa.error}</ErrorText>}
        {(qa.understood.length > 0 || added > 0) && (
          <View style={s.line} accessibilityLabel={tr('Sẽ lưu')}>
            {qa.understood.map((u) => <Got key={u.label} icon={u.icon} label={u.label} />)}
            {added > 0 && !qa.understood.length && <Text style={s.lead}>{tr('Đã thêm {n} việc. Gõ tiếp, hoặc vuốt xuống để đóng.', { n: added })}</Text>}
          </View>
        )}
        {/* The accessory row on the keyboard: tag suggestions while typing a #tag, otherwise the syntax. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={s.accessory}>
          {qa.suggestions.length > 0
            ? qa.suggestions.map((tag) => <TagChip key={tag} tag={tag} onPress={() => qa.pick(tag)} />)
            : qa.hints.map(([token, means]) => <Hint key={token} token={token} means={means} onPress={() => qa.insert(token)} />)}
        </ScrollView>
      </Sheet>
    </>
  );
}

function Got({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={s.got}>
      <Ionicons name={icon} size={13} color={color.primary} />
      <Text style={s.gotText}>{label}</Text>
    </View>
  );
}

function TagChip({ tag, onPress, kbd }: { tag: string; onPress: () => void; kbd?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={tr('Thêm nhãn {tag}', { tag })} hitSlop={6} style={(st) => [s.chip, active(st) && { backgroundColor: color.itemHover }]}>
      <Text style={s.chipText}>#{tag}</Text>
      {kbd && <Text style={s.kbd}>Tab</Text>}
    </Pressable>
  );
}

function Hint({ token, means, onPress }: { token: string; means: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tr('Chèn {token}: {means}', { token, means })}
      hitSlop={6}
      style={(st) => [s.hint, active(st) && { backgroundColor: color.itemHover }]}
    >
      <Text style={s.hintToken}>{token}</Text>
      <Text style={s.hintMeans}>{means}</Text>
    </Pressable>
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
  hint: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 34, paddingHorizontal: 12, borderRadius: radius.full, borderWidth: rule.hair, borderColor: color.border, backgroundColor: color.surface },
  hintToken: { ...text.meta, fontWeight: '600', color: color.foreground },
  hintMeans: { ...text.xs, color: color.muted },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: radius.full, backgroundColor: color.primaryLight },
  chipText: { ...text.meta, fontWeight: '500', color: color.primary },
  kbd: { ...text.xs, fontSize: 11, lineHeight: 18, color: color.muted, borderWidth: rule.hair, borderColor: color.border, borderRadius: radius.sm, paddingHorizontal: 6 },

  // The phone sheet: a borderless 17pt line beside a round send button, the syntax chips under it.
  entry: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  entryInput: { flex: 1, minHeight: touch, maxHeight: 120, paddingVertical: 10, paddingHorizontal: 4, fontFamily: font, fontSize: 17, lineHeight: 24, color: color.foreground, outlineWidth: 0 },
  send: { width: touch, height: touch, borderRadius: touch / 2, backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center' },
  sendOff: { backgroundColor: color.secondary },
  accessory: { gap: 8, paddingVertical: 2 },
});
