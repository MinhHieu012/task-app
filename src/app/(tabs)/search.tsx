import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { TaskGroup } from '@/components/TaskRow';
import { Choices, Empty, Field, Screen } from '@/components/ui';
import { color, text } from '@/constants/theme';
import { tr } from '@/lib/i18n';
import { type Project, type Task, useRows } from '@/lib/supabase';
import { searchTasks, tagCounts } from '@/lib/tags';

const DONE_SHOWN = 50;

export default function Search() {
  const params = useLocalSearchParams<{ q?: string }>();
  const [q, setQ] = useState(params.q ?? '');
  // A tag tapped while this screen is already open arrives as a new param.
  const [seen, setSeen] = useState(params.q);
  if (params.q !== seen) {
    setSeen(params.q);
    setQ(params.q ?? '');
  }

  // ponytail: loads every task and searches on the device (accent-insensitive, like report search); move to a
  // Postgres unaccent index if this grows into many thousands of rows.
  const [tasks, , loaded] = useRows<Task>('tasks', (x) => x.order('created_at', { ascending: false }), 'search');
  const [projects] = useRows<Project>('projects', (x) => x.order('name'));
  const found = searchTasks(tasks, q);
  const open = found.filter((t) => !t.completed_at);
  const done = found.filter((t) => t.completed_at).sort((a, b) => b.completed_at!.localeCompare(a.completed_at!));
  // Done copies of recurring tasks would count one task many times.
  const tags = tagCounts(tasks.filter((t) => !t.recurring_copy));

  const words = q.trim().split(/\s+/).filter(Boolean);
  const on = words.filter((w) => w.startsWith('#')).map((w) => w.slice(1).toLowerCase());
  const toggle = (tag: string) =>
    setQ(on.includes(tag) ? words.filter((w) => w.toLowerCase() !== `#${tag}`).join(' ') : [...words, `#${tag}`].join(' ') + ' ');

  return (
    <Screen back title={tr('Tìm kiếm')} sub={q.trim() && loaded ? tr('{n} việc khớp', { n: found.length }) : undefined} maxWidth={100000}>
      <Field
        value={q}
        onChangeText={setQ}
        icon="search-outline"
        placeholder={tr('Tìm việc, ghi chú hoặc #nhãn…')}
        aria-label={tr('Tìm việc')}
        autoFocus={!params.q}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {tags.length > 0 && (
        <View style={s.tags}>
          <Text style={s.label}>{tr('Nhãn')}</Text>
          <Choices value={on} onChange={toggle} options={tags.map(([tag, n]) => ({ value: tag, label: `#${tag} ${n}` }))} />
        </View>
      )}
      {!q.trim() ? (
        <Empty>{tr('Gõ để tìm trong tên và ghi chú của mọi việc, kể cả việc đã xong. Thêm #nhãn để lọc theo nhãn.')}</Empty>
      ) : !loaded ? (
        <TaskGroup title={tr('Đang mở')} tasks={[]} loading />
      ) : !found.length ? (
        <Empty>{tr('Không có việc nào khớp “{q}”.', { q: q.trim() })}</Empty>
      ) : (
        <View style={s.groups}>
          {open.length > 0 && <TaskGroup title={tr('Đang mở')} tasks={open} projects={projects} />}
          {done.length > 0 && <TaskGroup title={tr('Đã xong')} tasks={done.slice(0, DONE_SHOWN)} projects={projects} />}
          {done.length > DONE_SHOWN && <Empty>{tr('Còn {n} việc đã xong cũ hơn. Gõ cụ thể hơn để thu hẹp.', { n: done.length - DONE_SHOWN })}</Empty>}
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  tags: { gap: 8 },
  label: { ...text.meta, fontWeight: '500', color: color.muted },
  groups: { gap: 28 },
});
