import { router } from 'expo-router';
import { type ComponentRef, useRef, useState } from 'react';
import type { TextInput } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { Button, Field } from '@/components/ui';
import { tr } from '@/lib/i18n';
import { ok, type Project, refresh, supabase } from '@/lib/supabase';

/** A sheet with one field: the new project's name. Opens the project once it exists. */
export function NewProject({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const add = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const res = await supabase.from('projects').insert({ name: name.trim() }).select().single();
    setBusy(false);
    if (!ok(res)) return;
    refresh('projects');
    setName('');
    onClose();
    router.push({ pathname: '/project/[id]', params: { id: (res.data as Project).id } });
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={tr('Project mới')} focus={input}>
      <Field ref={input} value={name} onChangeText={setName} placeholder={tr('Tên project')} aria-label={tr('Tên project mới')} onSubmitEditing={add} returnKeyType="done" />
      <Button title={tr('Tạo project')} variant="primary" onPress={add} loading={busy} disabled={!name.trim()} />
    </Sheet>
  );
}
