import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { Field } from '@/components/ui';
import { color, radius } from '@/constants/theme';
import { today } from '@/lib/dates';
import { supabase, type Task } from '@/lib/supabase';

/** Pinned add box: Enter saves; the text is cleared only after a successful insert (KTD7, AE5). */
/** `defaults` may be a function so values like "now" are taken at submit time. */
export function QuickAdd({ defaults = {}, placeholder = 'Thêm việc…' }: { defaults?: Partial<Task> | (() => Partial<Task>); placeholder?: string }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
    if (e) return setError('Chưa lưu được. Kiểm tra mạng rồi thử lại.');
    setTitle('');
    setError('');
  };

  return (
    <Field
      value={title}
      onChangeText={(v) => {
        setTitle(v);
        if (error) setError('');
      }}
      placeholder={placeholder}
      aria-label="Tên việc mới"
      onSubmitEditing={add}
      submitBehavior="submit"
      returnKeyType="done"
      error={error}
      style={s.input}
      right={
        <Pressable onPress={add} disabled={busy} accessibilityRole="button" accessibilityLabel="Thêm" style={({ pressed }) => [s.send, pressed && { backgroundColor: color.primaryHover }]}>
          {busy ? <ActivityIndicator color={color.primaryFg} /> : <Ionicons name="arrow-up" size={20} color={color.primaryFg} />}
        </Pressable>
      }
    />
  );
}

const s = StyleSheet.create({
  input: { height: 48, borderRadius: radius.full, paddingHorizontal: 20 },
  send: { width: 48, height: 48, borderRadius: radius.full, backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center' },
});
