import { router } from 'expo-router';
import { useState } from 'react';

import { Button, Card, Empty, Field, ListRow, Meta, Screen } from '@/components/ui';
import { ok, type Project, supabase, type Task, useRows } from '@/lib/supabase';

export default function Projects() {
  const [projects, , loaded] = useRows<Project>('projects', (q) => q.order('name'));
  const [open] = useRows<Task>('tasks', (q) => q.is('completed_at', null).not('project_id', 'is', null));
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    if (ok(await supabase.from('projects').insert({ name: name.trim() }))) setName('');
    setBusy(false);
  };

  return (
    <Screen
      title="Project"
      footer={
        <Field
          value={name}
          onChangeText={setName}
          placeholder="Tên project mới"
          aria-label="Tên project mới"
          onSubmitEditing={add}
          right={<Button title="Thêm" variant="primary" onPress={add} loading={busy} />}
        />
      }
    >
      {loaded && (
        <Card flush title="Tất cả project">
          {projects.map((p) => {
            const n = open.filter((t) => t.project_id === p.id).length;
            return <ListRow key={p.id} title={p.name} meta={<Meta>{n ? `${n} việc` : 'Không còn việc'}</Meta>} onPress={() => router.push({ pathname: '/project/[id]', params: { id: p.id } })} />;
          })}
          {!projects.length && <Empty>Chưa có project nào. Thêm ở ô bên dưới.</Empty>}
        </Card>
      )}
    </Screen>
  );
}
