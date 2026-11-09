import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { fromIso, today } from './dates';
import { tr } from './i18n';
import { reportReminders } from './reports';
import { type Report, type Task, useRows } from './supabase';

const native = Platform.OS !== 'web';

if (native) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

const dueAt = (t: Task) => {
  const [h, m] = t.due_time!.split(':').map(Number);
  return new Date(fromIso(t.due_date!).setHours(h, m, 0, 0));
};

async function schedule(tasks: Task[], reported: string[]) {
  if (!(await Notifications.requestPermissionsAsync()).granted) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = new Date();
  // Daily report: 20:30 and 21:00 for the coming week, skipping days already reported (at most 14).
  for (const { at, last } of reportReminders(new Set(reported), now)) {
    await Notifications.scheduleNotificationAsync({
      content: { title: tr('Báo cáo ngày'), body: last ? tr('Đến hạn nộp báo cáo ngày.') : tr('Còn 30 phút để nộp báo cáo ngày.') },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
  }
  // ponytail: soonest 48 only; iOS keeps at most 64 pending local notifications and reports take up to 14.
  const upcoming = tasks.map((t) => ({ t, at: dueAt(t) })).filter((r) => r.at > now).sort((a, b) => +a.at - +b.at).slice(0, 48);
  for (const { t, at } of upcoming) {
    await Notifications.scheduleNotificationAsync({
      content: { title: t.title, body: tr('Đến hạn lúc {time}', { time: t.due_time!.slice(0, 5) }) },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
  }
}

// Serialize reschedules so a quick second update can't interleave with the first.
let queue = Promise.resolve();

/** Local notification at the due time of each open task that has one (R7, KTD8), and the daily report nudges.
 *  Does nothing on web (Today shows the report nudge instead). */
export function useReminders() {
  const day = today();
  // Recurring tasks keep a single row whose due_date is the next occurrence, so only that one is scheduled.
  const [tasks] = useRows<Task>('tasks', (q) => (native ? q.is('completed_at', null).not('due_time', 'is', null).gte('due_date', day) : q.limit(0)), day);
  const [reports] = useRows<Report>('daily_reports', (q) => (native ? q.gte('day', day) : q.limit(0)), `rem:${day}`);
  useEffect(() => {
    if (native) queue = queue.then(() => schedule(tasks, reports.map((r) => r.day))).catch(() => {});
  }, [tasks, reports]);
}
