import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput } from 'react-native';

import { Field } from '@/components/ui';
import { color, radius, rule, text } from '@/constants/theme';
import { today } from '@/lib/dates';
import { tr } from '@/lib/i18n';
import { supabase, type Task } from '@/lib/supabase';

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

/** Add box: Enter saves; the text is cleared only after a successful insert (KTD7, AE5). */
/** `defaults` may be a function so values like "now" are taken at submit time. */
export function QuickAdd({ defaults = {}, placeholder = tr('Thêm việc…'), flat }: { defaults?: Partial<Task> | (() => Partial<Task>); placeholder?: string; flat?: boolean }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    const focus = () => input.current?.focus();
    focusLatest = focus;
    return () => {
      if (focusLatest === focus) focusLatest = null;
    };
  }, []);

  const add = async () => {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    const d = typeof defaults === 'function' ? defaults() : defaults;
    // No time given: starts now, ends at the end of that day.
    const day = d.due_date ?? today();
    const now = new Date().toTimeString().slice(0, 5);
    const { error: e } = await supabase.from('tasks').insert({ title: t, due_date: day, due_time: now, end_date: day, end_time: '23:59:59', ...d });
    setBusy(false);
    if (e) return setError(tr('Chưa lưu được. Kiểm tra mạng rồi thử lại.'));
    setTitle('');
    setError('');
  };

  return (
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
      onSubmitEditing={add}
      submitBehavior="submit"
      returnKeyType="done"
      error={error}
      boxStyle={flat ? undefined : s.raised}
      trailing={busy ? <ActivityIndicator color={color.primary} /> : Platform.OS === 'web' ? <Text style={s.kbd}>N</Text> : null}
    />
  );
}

const s = StyleSheet.create({
  // On the slate page the box takes the sheet colour; `flat` sits in the top bar, which is already the sheet.
  raised: { backgroundColor: color.surface },
  kbd: { ...text.xs, fontSize: 11, lineHeight: 18, color: color.muted, borderWidth: rule.hair, borderColor: color.border, borderRadius: radius.sm, paddingHorizontal: 6 },
});
