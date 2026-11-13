import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentRef, type ReactNode, type RefObject, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { active, animate, ease, type IconName, reducedMotion } from '@/components/ui';
import { color, duration, radius, rule, text, touch } from '@/constants/theme';
import { tr } from '@/lib/i18n';

/** Phones: a panel that rises from the bottom over a dimmed page, for adding, picking and confirming without
 *  leaving the screen. Drag the grabber (or the head) down, tap the backdrop, or press back to close.
 *  Stays mounted while it slides out, so callers can just flip `visible`. */
export function Sheet({ visible, onClose, title, done, children, scroll, onShow, focus }: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  done?: { label: string; onPress: () => void }; // a text action at the right of the head ("Xong")
  children: ReactNode;
  scroll?: boolean; // long content: the body scrolls inside the sheet
  onShow?: () => void;
  // A field to focus once the sheet is up: autoFocus inside an Android Modal focuses without raising the keyboard.
  focus?: RefObject<ComponentRef<typeof TextInput> | null>;
}) {
  const { height } = useWindowDimensions();
  const { bottom, top } = useSafeAreaInsets();
  const [shown, setShown] = useState(visible);
  if (visible && !shown) setShown(true);
  const [v] = useState(() => new Animated.Value(0));
  const [drag] = useState(() => new Animated.Value(0));
  // With the keyboard up the sheet rests on it, so the gesture-bar inset under the content is just a gap.
  const [kb, setKb] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKb(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKb(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (!shown) return;
    if (visible) drag.setValue(0);
    const a = visible ? animate(v, 1, duration.panel) : animate(v, 0, duration.base, ease.in);
    a.start(({ finished }) => { if (finished && !visible) setShown(false); });
    return () => a.stop();
  }, [visible, shown, v, drag]);

  // Pulling down follows the finger; past a third of the way (or a flick) it closes, otherwise it springs back.
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
    onPanResponderRelease: (_, g) => {
      if (g.dy > 120 || g.vy > 1.2) onClose();
      else Animated.spring(drag, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
    },
    onPanResponderTerminate: () => Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start(),
  }), [drag, onClose]);

  if (!shown) return null;
  // Reduce motion: the panel fades in place instead of travelling up.
  const rise = v.interpolate({ inputRange: [0, 1], outputRange: [reducedMotion() ? 0 : height * 0.6, 0] });
  const head = title || done;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose} onShow={() => { onShow?.(); if (focus) setTimeout(() => focus.current?.focus(), 50); }}>
      <Animated.View style={[s.backdrop, { opacity: v }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={tr('Đóng')} />
      </Animated.View>
      <KeyboardAvoidingView behavior="padding" style={s.dock} pointerEvents="box-none">
        <Animated.View
          style={[s.panel, { maxHeight: height - top - 24, paddingBottom: kb ? 8 : bottom + 8, opacity: reducedMotion() ? v : 1, transform: [{ translateY: Animated.add(rise, drag) }] }]}
          accessibilityViewIsModal
        >
          <View {...pan.panHandlers}>
            <View style={s.grabZone}><View style={s.grabber} /></View>
            {head && (
              <View style={s.head}>
                <Text style={s.title} numberOfLines={1}>{title}</Text>
                {done && (
                  <Pressable onPress={done.onPress} hitSlop={8} accessibilityRole="button" style={(st) => [s.done, active(st) && { backgroundColor: color.primaryLight }]}>
                    <Text style={s.doneText}>{done.label}</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
          {scroll ? (
            <ScrollView style={s.scroll} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">{children}</ScrollView>
          ) : (
            <View style={s.body}>{children}</View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export type SheetAction = { key: string; label: string; icon?: IconName; tint?: string; danger?: boolean; on?: boolean; detail?: string };

/** A list of choices in a sheet, with a large Huỷ at the bottom where the thumb is. Replaces menus and
 *  the centred confirm dialog on phones. */
export function ActionSheet({ visible, title, message, actions, onPick, onClose }: {
  visible: boolean; title?: string; message?: string; actions: SheetAction[]; onPick: (key: string) => void; onClose: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} scroll>
      {(title || message) && (
        <View style={s.askHead}>
          {title && <Text style={s.askTitle}>{title}</Text>}
          {message && <Text style={s.askText}>{message}</Text>}
        </View>
      )}
      <View style={s.list}>
        {actions.map((a, i) => (
          <Pressable
            key={a.key}
            onPress={() => onPick(a.key)}
            accessibilityRole="button"
            accessibilityState={a.on !== undefined ? { selected: a.on } : undefined}
            style={(st) => [s.action, i > 0 && s.actionRule, active(st) && { backgroundColor: color.itemHover }]}
          >
            {a.icon && <Ionicons name={a.icon} size={22} color={a.danger ? color.danger : a.tint ?? color.soft} />}
            <Text style={[s.actionText, a.danger && { color: color.danger }]} numberOfLines={2}>{a.label}</Text>
            {a.detail && <Text style={s.detail} numberOfLines={1}>{a.detail}</Text>}
            {a.on && <Ionicons name="checkmark" size={20} color={color.primary} />}
          </Pressable>
        ))}
      </View>
      <Pressable onPress={onClose} accessibilityRole="button" style={(st) => [s.cancel, active(st) && { backgroundColor: color.secondaryHover }]}>
        <Text style={s.cancelText}>{tr('Huỷ')}</Text>
      </Pressable>
    </Sheet>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: color.backdrop },
  dock: { flex: 1, justifyContent: 'flex-end' },
  panel: { backgroundColor: color.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  grabZone: { height: 24, alignItems: 'center', justifyContent: 'center' },
  grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: color.borderStrong },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: touch, paddingLeft: 20, paddingRight: 12 },
  title: { ...text.bar, flex: 1, color: color.foreground },
  done: { minHeight: 36, paddingHorizontal: 12, borderRadius: radius.full, justifyContent: 'center' },
  doneText: { ...text.base, color: color.primary },
  scroll: { flexGrow: 0 },
  body: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 12 },

  askHead: { paddingHorizontal: 4, gap: 4 },
  askTitle: { ...text.lg, color: color.foreground },
  askText: { ...text.sm, color: color.muted },
  list: { borderRadius: radius.lg, backgroundColor: color.background, overflow: 'hidden' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52, paddingHorizontal: 16, paddingVertical: 10 },
  actionRule: { borderTopWidth: rule.hair, borderTopColor: color.border },
  actionText: { ...text.body, flex: 1, color: color.foreground },
  detail: { ...text.meta, color: color.muted, maxWidth: '45%' },
  cancel: { minHeight: 52, borderRadius: radius.lg, backgroundColor: color.secondary, alignItems: 'center', justifyContent: 'center' },
  cancelText: { ...text.base, color: color.foreground },
});
