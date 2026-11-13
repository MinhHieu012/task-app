import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Animated, PanResponder, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet } from '@/components/Sheet';
import { animate, ConfirmModal, ease, IconButton, type IconName, reducedMotion, TextLink } from '@/components/ui';
import { color, duration, radius, rule, shadowModal, text } from '@/constants/theme';
import { haptic } from '@/lib/haptics';
import { tr } from '@/lib/i18n';
import { answer, dismissToast, notifyStore, picked, type Toast, type Tone } from '@/lib/notify';

const look: Record<Tone, { icon: IconName; fg: string; bg: string }> = {
  error: { icon: 'alert-circle', fg: color.danger, bg: color.dangerBg },
  success: { icon: 'checkmark-circle', fg: color.success, bg: color.successBg },
  info: { icon: 'information-circle', fg: color.primary, bg: color.primaryLight },
};

// Phones: toasts sit just above the tab bar (64 + the gesture inset), where the thumb already is and where the
// system notifications at the top cannot cover them.
const TAB_BAR = 64;

/** Draws the toasts, the confirm and the menus from lib/notify. Mounted once, over the whole app. */
export function Notifier() {
  const { toasts, ask, asking, menu, menuOpen } = useSyncExternalStore(notifyStore.subscribe, notifyStore.get);
  const { top, bottom } = useSafeAreaInsets();
  // Top-right corner once there is room beside it (tablets too); phones get a full-width toast at the bottom.
  const wide = useWindowDimensions().width >= 640;
  // Opening a confirm is the moment before something is lost: a warning buzz on phones.
  useEffect(() => { if (asking && !wide) haptic.warn(); }, [asking, wide]);
  return (
    <>
      {/* Clips toasts while they slide in from off-screen, so the page never grows sideways. */}
      <View pointerEvents="box-none" style={s.layer}>
        <View pointerEvents="box-none" style={[s.stack, wide ? [s.stackWide, { top: top + 24 }] : [s.stackNarrow, { bottom: bottom + TAB_BAR + 12 }]]}>
          {toasts.map((t) => <ToastCard key={t.id} toast={t} wide={wide} />)}
        </View>
      </View>
      {wide ? (
        <ConfirmModal
          visible={asking}
          title={ask?.title ?? ''}
          message={ask?.message || undefined}
          confirmText={ask?.confirmText}
          onCancel={() => answer(false)}
          onConfirm={() => answer(true)}
        />
      ) : (
        <ActionSheet
          visible={asking}
          title={ask?.title}
          message={ask?.message || undefined}
          actions={[{ key: 'yes', label: ask?.confirmText ?? tr('Xoá'), icon: 'trash-outline', danger: true }]}
          onPick={() => answer(true)}
          onClose={() => answer(false)}
        />
      )}
      <ActionSheet
        visible={menuOpen}
        title={menu?.title}
        message={menu?.message || undefined}
        actions={(menu?.choices ?? []).map((c) => ({ ...c, icon: c.icon as IconName | undefined }))}
        onPick={(k) => { haptic.select(); picked(k); }}
        onClose={() => picked(null)}
      />
    </>
  );
}

function ToastCard({ toast: t, wide }: { toast: Toast; wide: boolean }) {
  const [v] = useState(() => new Animated.Value(0));
  const [swipe] = useState(() => new Animated.Value(0));
  const [leaving, setLeaving] = useState(false);
  const { icon, fg } = look[t.tone];

  // Slides in from off-screen (past the right edge on wide screens: card 380 + gap 24; up from below on phones),
  // ease-out with no overshoot; leaves the same way (ease-in), then drops out of the store. The fade finishes in
  // the first third so the card reads as solid while it travels. Reduce motion: fade only.
  const shift = v.interpolate({ inputRange: [0, 1], outputRange: [reducedMotion() ? 0 : wide ? 420 : 120, 0] });
  const opacity = v.interpolate({ inputRange: [0, 0.3], outputRange: [0, 1], extrapolate: 'clamp' });
  useEffect(() => {
    const a = leaving ? animate(v, 0, duration.toast, ease.in) : animate(v, 1, duration.toast);
    a.start(({ finished }) => { if (finished && leaving) dismissToast(t.id); });
    return () => a.stop();
  }, [leaving, v, t.id]);
  // Errors stay longer: they usually need reading. A toast with an action (undo) stays longest, to be caught.
  const ms = t.action ? 10000 : t.tone === 'error' ? 6000 : 4000;
  useEffect(() => {
    const timer = setTimeout(() => setLeaving(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  // The action shows the seconds it has left, so the user knows how long the undo stays.
  const [left, setLeft] = useState(ms / 1000);
  useEffect(() => {
    if (!t.action) return;
    const tick = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(tick);
  }, [t.action]);

  // Phones: flick the toast sideways to dismiss it.
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: (_, g) => swipe.setValue(g.dx),
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) > 100 || Math.abs(g.vx) > 1) {
        Animated.timing(swipe, { toValue: Math.sign(g.dx) * 500, duration: duration.base, useNativeDriver: true }).start(() => dismissToast(t.id));
      } else Animated.spring(swipe, { toValue: 0, useNativeDriver: true }).start();
    },
  }), [swipe, t.id]);

  return (
    <Animated.View
      {...(wide ? {} : pan.panHandlers)}
      accessibilityRole="alert"
      aria-live={t.tone === 'error' ? 'assertive' : 'polite'}
      style={[
        s.toast,
        { opacity: reducedMotion() ? v : opacity, transform: wide ? [{ translateX: shift }] : [{ translateY: shift }, { translateX: swipe }] },
      ]}
    >
      <View style={s.icon}><Ionicons name={icon} size={20} color={fg} /></View>
      <View style={s.body}>
        <Text style={s.title}>{t.title}</Text>
        {!!t.message && <Text style={s.message}>{t.message}</Text>}
        {t.action && (
          <View style={s.action}>
            <TextLink icon="arrow-undo" label={`${t.action.label} (${left}s)`} onPress={() => { t.action!.run(); setLeaving(true); }} />
          </View>
        )}
      </View>
      <IconButton icon="close" label={tr('Đóng thông báo')} onPress={() => setLeaving(true)} />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  // Wide: pinned top-right. Phones: full width with the 16px gutter, just above the tab bar. (Separate styles:
  // a later `left: undefined` does not cancel an earlier `left`.)
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden', zIndex: 1000 },
  stack: { position: 'absolute', gap: 8 },
  stackNarrow: { left: 16, right: 16, alignItems: 'center' },
  stackWide: { right: 24, width: 380 },
  toast: {
    width: '100%', maxWidth: 380, flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 12, paddingLeft: 14, backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: rule.hair, borderColor: color.border, boxShadow: shadowModal,
  },
  icon: { width: 24, height: 32, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, paddingTop: 5 },
  title: { ...text.smMedium, color: color.foreground },
  message: { ...text.meta, color: color.muted, marginTop: 2 },
  action: { marginTop: 8, alignSelf: 'flex-start' },
});
