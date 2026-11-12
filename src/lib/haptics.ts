// Phones only: a light tap when a task is ticked, a click when a swipe crosses its threshold or a picker
// changes, a warning before a delete. Web has no haptics, and a failed call must never break the action.
import * as H from 'expo-haptics';
import { Platform } from 'react-native';

const run = (f: () => Promise<void>) => {
  if (Platform.OS !== 'web') f().catch(() => {});
};

export const haptic = {
  tick: () => run(() => H.impactAsync(H.ImpactFeedbackStyle.Light)),
  select: () => run(() => H.selectionAsync()),
  warn: () => run(() => H.notificationAsync(H.NotificationFeedbackType.Warning)),
};
