import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { fromIso, today } from './dates';
import { type Task, useRows } from './supabase';

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

async function schedule(tasks: Task[]) {
  if (!(await Notifications.requestPermissionsAsync()).granted) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = new Date();
  // ponytail: soonest 60 only; iOS keeps at most 64 pending local notifications.
  const upcoming = tasks.map((t) => ({ t, at: dueAt(t) })).filter((r) => r.at > now).sort((a, b) => +a.at - +b.at).slice(0, 60);
  for (const { t, at } of upcoming) {
    await Notifications.scheduleNotificationAsync({
      content: { title: t.title, body: `Đến hạn lúc ${t.due_time!.slice(0, 5)}` },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
  }
}

// Serialize reschedules so a quick second update can't interleave with the first.
let queue = Promise.resolve();

/** Local notification at the due time of each open task that has one (R7, KTD8). Does nothing on web. */
export function useReminders() {
  const day = today();
  // Recurring tasks keep a single row whose due_date is the next occurrence, so only that one is scheduled.
  const [tasks] = useRows<Task>('tasks', (q) => (native ? q.is('completed_at', null).not('due_time', 'is', null).gte('due_date', day) : q.limit(0)), day);
  useEffect(() => {
    if (native) queue = queue.then(() => schedule(tasks)).catch(() => {});
  }, [tasks]);
}
