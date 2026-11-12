import { router, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';

import { TaskForm } from '@/components/TaskForm';
import { Screen, useWide } from '@/components/ui';
import { color, text } from '@/constants/theme';
import { tr } from '@/lib/i18n';
import { type Project, type Task, useRows } from '@/lib/supabase';

export default function TaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [rows, , loaded] = useRows<Task>('tasks', (q) => q.eq('id', id), id);
  const [projects] = useRows<Project>('projects', (q) => q.order('name'));
  const wide = useWide();
  // Phones: the form draws its own sheet head (Huỷ, Sửa việc, Lưu); until the row is in, the plain screen shows.
  if (!wide && rows[0]) return <TaskForm task={rows[0]} projects={projects} onDone={() => router.back()} sheet />;
  return (
    <Screen back title={rows[0] ? tr('Sửa việc') : loaded ? tr('Không tìm thấy việc') : ''}>
      {rows[0] ? (
        // Mounted once the row arrives, so later realtime reloads don't overwrite edits.
        <TaskForm task={rows[0]} projects={projects} onDone={() => router.back()} />
      ) : (
        loaded && <Text style={{ ...text.sm, color: color.muted }}>{tr('Việc này đã bị xoá.')}</Text>
      )}
    </Screen>
  );
}
