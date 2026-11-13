import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { NewProject } from '@/components/NewProject';
import { Avatar, ICON_INSET, IconButton, ListGroup, ListItem, Screen, Skeleton } from '@/components/ui';
import { color, projectColor, radius } from '@/constants/theme';
import { today } from '@/lib/dates';
import { tr } from '@/lib/i18n';
import { DEADLINE, reportStatus } from '@/lib/reports';
import { type Project, type Report, type Task, useRows, useSession } from '@/lib/supabase';

/** Phones: the fourth tab. Everything that is not today, upcoming or the journal: the inbox and the projects
 *  (the inbox is the default project, so they sit together), then reports, stats, search and settings.
 *  Every destination is two taps from anywhere. Wide screens reach the same places from the rail. */
export default function Browse() {
  const day = today();
  const email = useSession()?.user.email;
  const [projects, , loaded] = useRows<Project>('projects', (q) => q.order('name'));
  const [open] = useRows<Task>('tasks', (q) => q.is('completed_at', null), 'browse-open');
  const [reports] = useRows<Report>('daily_reports', (q) => q.eq('day', day), `rep:${day}`);
  const [naming, setNaming] = useState(false);
  const inbox = open.filter((t) => !t.project_id).length;
  const status = reportStatus(day, reports[0], day);
  const reportNote = status === 'ontime' ? tr('Đã nộp hôm nay') : status === 'late' ? tr('Nộp trễ') : status === 'missing' ? tr('Hôm nay chưa nộp') : tr('Hạn {time}', { time: DEADLINE });

  return (
    <Screen title={tr('Duyệt')} actions={[{ icon: 'search-outline', label: tr('Tìm kiếm'), onPress: () => router.navigate('/search') }]}>
      <ListGroup inset={ICON_INSET}>
        <ListItem icon="file-tray-outline" title={tr('Hộp thư')} value={String(inbox || '')} onPress={() => router.navigate('/inbox')} />
      </ListGroup>

      <ListGroup
        title="Project"
        inset={ICON_INSET}
        action={<IconButton icon="add" label={tr('Project mới')} onPress={() => setNaming(true)} />}
      >
        {!loaded && <View style={s.skel}><Skeleton width="50%" height={16} /></View>}
        {projects.map((p, i) => (
          <ListItem
            key={p.id}
            left={<View style={s.dotCol}><View style={[s.dot, { backgroundColor: projectColor(i) }]} /></View>}
            title={p.name}
            value={String(open.filter((t) => t.project_id === p.id).length || '')}
            onPress={() => router.push({ pathname: '/project/[id]', params: { id: p.id } })}
          />
        ))}
        {loaded && !projects.length && (
          <ListItem icon="add-circle-outline" tint={color.primary} title={tr('Tạo project đầu tiên')} onPress={() => setNaming(true)} chevron={false} />
        )}
      </ListGroup>

      <ListGroup inset={ICON_INSET}>
        <ListItem icon="document-text-outline" title={tr('Báo cáo ngày')} value={reportNote} onPress={() => router.navigate('/reports')} />
        <ListItem icon="stats-chart-outline" title={tr('Thống kê')} onPress={() => router.navigate('/stats')} />
        <ListItem icon="search-outline" title={tr('Tìm kiếm')} onPress={() => router.navigate('/search')} />
      </ListGroup>

      <ListGroup inset={ICON_INSET}>
        <ListItem left={<View style={s.dotCol}><Avatar size={28} /></View>} title={tr('Cài đặt')} sub={email} onPress={() => router.navigate('/settings')} />
      </ListGroup>

      <NewProject visible={naming} onClose={() => setNaming(false)} />
    </Screen>
  );
}

const s = StyleSheet.create({
  skel: { padding: 16 },
  dotCol: { width: 28, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: radius.full },
});
