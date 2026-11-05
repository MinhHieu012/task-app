import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { QuickAdd } from '@/components/QuickAdd';
import { TaskGroup } from '@/components/TaskRow';
import { Button, Field, Screen } from '@/components/ui';
import { confirmAction } from '@/lib/notify';
import { ok, type Project, supabase, type Task, useRows } from '@/lib/supabase';

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [rows] = useRows<Project>('projects', (q) => q.eq('id', id), id);
  const [open, , loaded] = useRows<Task>(
    'tasks',
    (q) => q.is('completed_at', null).eq('project_id', id).order('due_date', { nullsFirst: false }).order('priority'),
    id,
  );
  const project = rows[0];
  const [name, setName] = useState<string | null>(null); // non-null while renaming

  const rename = async () => {
    if (!name?.trim()) return;
    if (ok(await supabase.from('projects').update({ name: name.trim() }).eq('id', id))) setName(null);
  };
  const remove = async () => {
    if (!(await confirmAction(`Xoá project “${project.name}”?`, 'Các việc trong project sẽ chuyển về Hộp thư.', 'Xoá project'))) return;
    if (ok(await supabase.from('projects').delete().eq('id', id))) router.back();
  };

  return (
    <Screen
      back
      title={project?.name ?? ''}
      footer={<QuickAdd defaults={{ project_id: id }} />}
      right={project && name === null && <Button title="Đổi tên" variant="ghost" onPress={() => setName(project.name)} />}
    >
      {name !== null && (
        <Field
          label="Tên project"
          value={name}
          onChangeText={setName}
          onSubmitEditing={rename}
          autoFocus
          right={<Button title="Lưu" variant="primary" onPress={rename} />}
        />
      )}
      {loaded && <TaskGroup title="Việc" tasks={open} projects={[]} empty="Chưa có việc nào." />}
      {project && (
        <View style={{ alignItems: 'flex-start' }}>
          <Button title="Xoá project" variant="danger" onPress={remove} />
        </View>
      )}
    </Screen>
  );
}
