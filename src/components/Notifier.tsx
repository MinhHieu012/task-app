import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Animated, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { animate, ConfirmModal, ease, IconButton, type IconName, reducedMotion } from '@/components/ui';
import { color, duration, radius, shadowModal, text } from '@/constants/theme';
import { answer, dismissToast, notifyStore, type Toast, type Tone } from '@/lib/notify';

const look: Record<Tone, { icon: IconName; fg: string; bg: string }> = {
  error: { icon: 'alert-circle', fg: color.danger, bg: color.dangerBg },
  success: { icon: 'checkmark-circle', fg: color.success, bg: color.successBg },
  info: { icon: 'information-circle', fg: color.primary, bg: color.primaryLight },
};

/** Draws the toasts and the confirm dialog from lib/notify. Mounted once, over the whole app. */
export function Notifier() {
  const { toasts, ask, asking } = useSyncExternalStore(notifyStore.subscribe, notifyStore.get);
  const top = useSafeAreaInsets().top;
  // Top-right corner once there is room beside it (tablets too); phones get a full-width toast.
  const wide = useWindowDimensions().width >= 640;
  return (
    <>
      {/* Clips toasts while they slide in from off-screen, so the page never grows sideways. */}
      <View pointerEvents="box-none" style={s.layer}>
        <View pointerEvents="box-none" style={[s.stack, { top: top + (wide ? 24 : 8) }, wide ? s.stackWide : s.stackNarrow]}>
          {toasts.map((t) => <ToastCard key={t.id} toast={t} fromRight={wide} />)}
        </View>
      </View>
      <ConfirmModal
        visible={asking}
        title={ask?.title ?? ''}
        message={ask?.message || undefined}
        confirmText={ask?.confirmText}
        onCancel={() => answer(false)}
        onConfirm={() => answer(true)}
      />
    </>
  );
}

function ToastCard({ toast: t, fromRight }: { toast: Toast; fromRight: boolean }) {
  const [v] = useState(() => new Animated.Value(0));
  const [leaving, setLeaving] = useState(false);
  const { icon, fg, bg } = look[t.tone];

  // Slides in from off-screen (past the right edge on wide screens: card 380 + gap 24; above the top on phones),
  // ease-out with no overshoot; leaves the same way (ease-in), then drops out of the store. The fade finishes in
  // the first third so the card reads as solid while it travels. Reduce motion: fade only.
  const shift = v.interpolate({ inputRange: [0, 1], outputRange: [reducedMotion() ? 0 : fromRight ? 420 : -120, 0] });
  const opacity = v.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1], extrapolate: 'clamp' });
  useEffect(() => {
    const a = leaving ? animate(v, 0, duration.toast, ease.in) : animate(v, 1, duration.toast);
    a.start(({ finished }) => { if (finished && leaving) dismissToast(t.id); });
    return () => a.stop();
  }, [leaving, v, t.id]);
  // Errors stay longer: they usually need reading.
  useEffect(() => {
    const timer = setTimeout(() => setLeaving(true), t.tone === 'error' ? 6000 : 4000);
    return () => clearTimeout(timer);
  }, [t.tone]);

  return (
    <Animated.View
      accessibilityRole="alert"
      aria-live={t.tone === 'error' ? 'assertive' : 'polite'}
      style={[s.toast, { opacity: reducedMotion() ? v : opacity, transform: [fromRight ? { translateX: shift } : { translateY: shift }] }]}
    >
      <View style={[s.icon, { backgroundColor: bg }]}><Ionicons name={icon} size={20} color={fg} /></View>
      <View style={s.body}>
        <Text style={s.title}>{t.title}</Text>
        {!!t.message && <Text style={s.message}>{t.message}</Text>}
      </View>
      <IconButton icon="close" label="Đóng thông báo" onPress={() => setLeaving(true)} />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  // Top of the screen: the bottom is taken by the tab bar on phones and the quick add on the web.
  // Phones: full width with the 16px gutter. Wide: pinned top-right. (Separate styles: a later `left: undefined`
  // does not cancel an earlier `left`.)
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden', zIndex: 1000 },
  stack: { position: 'absolute', gap: 8 },
  stackNarrow: { left: 16, right: 16, alignItems: 'center' },
  stackWide: { right: 24, width: 380 },
  toast: {
    width: '100%', maxWidth: 380, flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 12, paddingLeft: 14, borderRadius: radius.md, backgroundColor: color.surface, boxShadow: shadowModal,
  },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, paddingTop: 5 },
  title: { ...text.smMedium, color: color.foreground },
  message: { ...text.meta, color: color.muted, marginTop: 2 },
});
