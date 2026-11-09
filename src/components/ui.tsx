import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { type ComponentProps, type ComponentRef, type ReactNode, type Ref, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  type PressableStateCallbackType,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  color,
  duration,
  easeCss,
  font,
  priority as pColor,
  priorityBg,
  priorityText,
  type Priority,
  radius,
  rule,
  shadowModal,
  text,
} from '@/constants/theme';
import { tr } from '@/lib/i18n';
import { useSession } from '@/lib/supabase';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// react-native-web also reports hover; native only has pressed.
export const active = (s: PressableStateCallbackType) => s.pressed || !!(s as { hovered?: boolean }).hovered;

/* Motion. The OS "reduce motion" setting (prefers-reduced-motion on web) is kept in one module flag
   instead of a hook per component. Under it, fades still run (they don't move anything) but movement and
   scale are dropped: components read the flag when they build their transforms. */
let reduceMotion = false;
export const reducedMotion = () => reduceMotion;
AccessibilityInfo.isReduceMotionEnabled().then((v) => { reduceMotion = v; });
AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => { reduceMotion = v; });

// react-native-web has no native animated module and warns if asked for it.
const nativeDriver = Platform.OS !== 'web';
export const ease = { out: Easing.out(Easing.cubic), in: Easing.in(Easing.cubic), inOut: Easing.inOut(Easing.ease) };

/** Timing animation on transform/opacity values. Enter with ease.out (default), exit with ease.in. */
export const animate = (v: Animated.Value, toValue: number, ms: number, easing = ease.out) =>
  Animated.timing(v, { toValue, duration: ms, easing, useNativeDriver: nativeDriver });

// Web: eases colour changes on views that are not Pressables themselves (the global [tabindex] rule covers those).
export const webEase = Platform.OS === 'web'
  ? ({ transitionProperty: 'background-color, border-color, box-shadow', transitionDuration: `${duration.fast}ms`, transitionTimingFunction: easeCss } as ViewStyle)
  : null;

/** Fades its children in on mount, rising 6px (or sliding in from `x` px to the right). For content that appears. */
export function FadeIn({ children, x, ms = duration.base, style }: { children: ReactNode; x?: number; ms?: number; style?: ViewStyle }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const a = animate(v, 1, ms);
    a.start();
    return () => a.stop();
  }, [v, ms]);
  const shift = v.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 0 : x ?? 6, 0] });
  return <Animated.View style={[style, { opacity: v, transform: [x ? { translateX: shift } : { translateY: shift }] }]}>{children}</Animated.View>;
}

const pressed = (s: PressableStateCallbackType) => s.pressed && st.pressed;

/* Button */
type Variant = 'outline' | 'primary' | 'secondary' | 'ghost' | 'danger';
const btn: Record<Variant, { bg: string; bgActive: string; fg: string; border?: string }> = {
  outline: { bg: color.surface, bgActive: color.buttonHover, fg: color.foreground, border: color.fieldEdge },
  primary: { bg: color.primary, bgActive: color.primaryHover, fg: color.primaryFg },
  secondary: { bg: color.secondary, bgActive: color.secondaryHover, fg: color.foreground },
  ghost: { bg: 'transparent', bgActive: color.ghostHover, fg: color.muted },
  danger: { bg: color.dangerBg, bgActive: color.dangerBgHover, fg: color.danger },
};

export function Button({ title, icon, onPress, variant = 'outline', disabled, loading, style }: {
  title: string; icon?: IconName; onPress?: () => void; variant?: Variant; disabled?: boolean; loading?: boolean; style?: ViewStyle;
}) {
  const v = btn[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={(s) => [
        st.btn,
        { backgroundColor: active(s) ? v.bgActive : v.bg, borderColor: v.border ?? 'transparent' },
        pressed(s),
        disabled && !loading && st.disabled,
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={16} color={v.fg} style={loading && st.hidden} />}
      <Text style={[st.btnText, { color: v.fg }, loading && st.hidden]}>{title}</Text>
      {loading && <ActivityIndicator color={v.fg} size="small" style={StyleSheet.absoluteFill} />}
    </Pressable>
  );
}

/* Square icon-only button */
export function IconButton({ icon, label, onPress, tint, surface, size = 32 }: { icon: IconName; label: string; onPress?: () => void; tint?: boolean; surface?: boolean; size?: number }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={(s) => [st.iconBtn, { width: size, height: size }, surface && st.iconBtnSurface, tint && { backgroundColor: color.primaryLight }, !tint && active(s) && { backgroundColor: surface ? color.buttonHover : color.itemHover }, pressed(s)]}
    >
      <Ionicons name={icon} size={18} color={tint ? color.primary : color.muted} />
    </Pressable>
  );
}

/* The signed-in user's initial on an accent wash; with onPress it is a button (opens settings) */
export function Avatar({ size = 40, onPress }: { size?: number; onPress?: () => void }) {
  const email = useSession()?.user.email;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${tr('Cài đặt')}, ${email ?? ''}` : email}
      style={(s) => [st.avatar, { width: size, height: size, borderRadius: size / 2 }, pressed(s)]}
    >
      <Text style={[st.avatarText, { fontSize: size * 0.42, lineHeight: size * 0.6 }]}>{(email ?? '?')[0].toUpperCase()}</Text>
    </Pressable>
  );
}

/* Text link: ink with an accent underline; the underline turns ink on hover */
export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="link">
      {(s) => <Text style={[st.link, active(s) && { textDecorationColor: color.foreground }]}>{label}</Text>}
    </Pressable>
  );
}

/* Badge */
type Tone = 'neutral' | 'success' | 'warning' | 'error';
const tones: Record<Tone, [string, string]> = {
  neutral: [color.neutralBg, color.neutral],
  success: [color.successBg, color.success],
  warning: [color.warningBg, color.warning],
  error: [color.errorBg, color.errorStrong],
};
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const [bg, fg] = tones[tone];
  return (
    <View style={[st.badge, { backgroundColor: bg }]}>
      <Text style={[st.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/* Priority tag: "Ưu tiên 1".."Ưu tiên 3", level 4 is "Bình thường" */
export function PriorityTag({ priority }: { priority: number }) {
  const p = priority as Priority;
  return (
    <View style={[st.tag, { backgroundColor: priorityBg[p] }]}>
      <Text style={[st.tagText, { color: priorityText[p] }]}>{p === 4 ? tr('Bình thường') : tr('Ưu tiên {n}', { n: p })}</Text>
    </View>
  );
}

/* Input with label, hint, error and an optional icon on the left */
export function Field({ label, hint, error, editable = true, right, icon, trailing, boxStyle, ref, ...props }: TextInputProps & {
  label?: string; hint?: string; error?: string; right?: ReactNode; icon?: IconName; trailing?: ReactNode; boxStyle?: ViewStyle; ref?: Ref<ComponentRef<typeof TextInput>>;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={st.field}>
      {label && <Text style={st.label}>{label}</Text>}
      <View style={st.fieldRow}>
        <View
          style={[
            st.inputBox,
            webEase,
            boxStyle,
            // Focus is a 2px ring outside the edge (the edge itself never changes width).
            focus && { boxShadow: `0 0 0 2px ${error ? color.errorRing : color.ringFocus}` },
            !!error && !focus && { borderColor: color.error },
            !editable && st.inputDisabled,
          ]}
        >
          {icon && <Ionicons name={icon} size={18} color={color.muted} />}
          <TextInput
            {...props}
            ref={ref}
            editable={editable}
            aria-invalid={!!error}
            placeholderTextColor={color.muted}
            onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
            onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
            style={[st.input, props.style]}
          />
          {trailing}
        </View>
        {right}
      </View>
      {error ? <ErrorText key={error}>{error}</ErrorText> : hint ? <Text style={st.hint}>{hint}</Text> : null}
    </View>
  );
}

/* Card: a white sheet on the cream page, soft corners and a hairline edge */
export function Card({ title, action, flush, children, style }: { title?: ReactNode; action?: ReactNode; flush?: boolean; children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[st.card, flush && st.cardFlush, style]}>
      {(title || action) && (
        <View style={[st.cardHead, flush && st.cardHeadFlush]}>
          {typeof title === 'string' ? <Text style={st.cardTitle}>{title}</Text> : title}
          {action}
        </View>
      )}
      <View style={flush && st.cardBodyFlush}>{children}</View>
    </View>
  );
}

/* List row inside a card: tick or anything on the left, title and meta on the right */
export function ListRow({ title, note, meta, left, done, selected, onPress }: {
  title: string; note?: string | null; meta?: ReactNode; left?: ReactNode; done?: boolean; selected?: boolean; onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={(s) => [st.row, active(s) && { backgroundColor: color.itemHover }, selected && { backgroundColor: color.primaryLight }]}
    >
      {left}
      <View style={st.rowBody}>
        <Text style={[st.rowTitle, done && st.rowDone]}>{title}</Text>
        {note ? <Text style={[st.meta, { marginTop: 2 }]} numberOfLines={2}>{note}</Text> : null}
        {meta && <View style={st.rowMeta}>{meta}</View>}
      </View>
    </Pressable>
  );
}
export function Meta({ children, tone }: { children: ReactNode; tone?: 'over' | 'today' }) {
  return <Text style={[st.meta, tone === 'over' && { color: color.danger, fontWeight: '500' }, tone === 'today' && st.metaToday]}>{children}</Text>;
}

/* Confirm modal */
export function ConfirmModal({ visible, title, message, confirmText = tr('Xoá'), onCancel, onConfirm, busy }: {
  visible: boolean; title: string; message?: string; confirmText?: string; onCancel: () => void; onConfirm: () => void; busy?: boolean;
}) {
  // Backdrop fades, card fades + scales from 0.96. The Modal stays mounted (`shown`) until the exit finishes.
  const [shown, setShown] = useState(visible);
  if (visible && !shown) setShown(true);
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const a = visible ? animate(v, 1, duration.modal) : animate(v, 0, duration.fast, ease.in);
    a.start(({ finished }) => { if (finished && !visible) setShown(false); });
    return () => a.stop();
  }, [visible, v]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 1 : 0.96, 1] });
  return (
    <Modal visible={shown} transparent animationType="none" onRequestClose={onCancel}>
      <Animated.View style={[st.backdrop, { opacity: v }]}>
        <Animated.View style={[st.modal, { transform: [{ scale }] }]}>
          <View style={st.modalHead}>
            <Ionicons name="trash-outline" size={22} color={color.danger} style={st.modalIcon} />
            <View style={st.modalBody}>
              <Text style={st.cardTitle}>{title}</Text>
              {message && <Text style={st.modalText}>{message}</Text>}
            </View>
          </View>
          <View style={st.modalFoot}>
            <Button title={tr('Huỷ')} variant="secondary" onPress={onCancel} />
            <Button title={confirmText} icon="trash-outline" variant="danger" onPress={onConfirm} loading={busy} />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

/** Wide screens (web on a computer) use the rail + top bar layout instead of the bottom tabs. */
export const useWide = () => useWindowDimensions().width >= 1024;

/* Screen: title, scrolling body, optional right aside (wide only) and footer pinned above the tab bar.
   On wide screens the top bar holds the quick add, so `footer` is hidden there unless `wideFooter`. */
export function Screen({ title, sub, back, right, footer, wideFooter, aside, children, maxWidth = 760 }: {
  // `back`: narrow only, where there is no rail. 'always' also shows it on wide, for pages the rail can't reach.
  title: string; sub?: string; back?: boolean | 'always'; right?: ReactNode; footer?: ReactNode; wideFooter?: boolean; aside?: ReactNode; children: ReactNode; maxWidth?: number;
}) {
  const wide = useWide();
  const body = (
    <ScrollView style={st.screen} contentContainerStyle={[st.screenBody, wide && { padding: 32, gap: 28, maxWidth, alignSelf: 'flex-start' }]} keyboardShouldPersistTaps="handled">
      {back && (!wide || back === 'always') && (
        <Button
          title={tr('Quay lại')}
          icon="chevron-back"
          variant="ghost"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={st.back}
        />
      )}
      <View style={st.head}>
        <View style={st.headText}>
          <Text style={[st.h1, !wide && { fontSize: 24, lineHeight: 32 }]}>{title}</Text>
          {sub && <Text style={st.sub}>{sub}</Text>}
        </View>
        {right}
      </View>
      {children}
      {wide && wideFooter && footer}
    </ScrollView>
  );
  return (
    <SafeAreaView edges={wide ? [] : ['top']} style={st.screen}>
      {/* Both platforms: Expo apps are edge-to-edge on Android, so the window no longer resizes for the
          keyboard; without a behavior the footer input stays under it (Expo keyboard-handling guide). */}
      <KeyboardAvoidingView style={st.screen} behavior="padding">
        {wide && aside ? (
          <View style={st.split}>
            {body}
            <ScrollView style={st.aside} contentContainerStyle={st.asideBody}>{aside}</ScrollView>
          </View>
        ) : body}
        {!wide && footer && <View style={st.footer}>{footer}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* Group heading: 18px, count beside it; overdue is red with an alert icon */
export function GroupTitle({ title, count, over }: { title: string; count?: number; over?: boolean }) {
  return (
    <View style={st.groupHead}>
      {over && <Ionicons name="alert-circle" size={20} color={color.danger} />}
      <Text style={[st.groupTitle, over && { color: color.danger }]}>{title}</Text>
      {!!count && <Text style={st.groupCount}>{count}</Text>}
    </View>
  );
}

/* Side panel line: round icon, label, number on the right */
export function InfoLine({ icon, label, n, tone, last }: { icon: IconName; label: string; n: number | string; tone?: string; last?: boolean }) {
  return (
    <View style={[st.line, last && { borderBottomWidth: 0 }]}>
      <Ionicons name={icon} size={16} color={tone ?? color.muted} />
      <Text style={st.lineLabel}>{label}</Text>
      <Text style={[st.lineN, tone && { color: tone }]}>{n}</Text>
    </View>
  );
}

/* Empty state */
export function Empty({ children }: { children: ReactNode }) {
  return <Text style={st.empty}>{children}</Text>;
}
export function EmptyState({ icon, title, children, action }: { icon: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <FadeIn>
    <Card>
      <View style={st.emptyBox}>
        <Ionicons name={icon} size={24} color={color.muted} style={st.emptyIcon} />
        <Text style={st.emptyTitle}>{title}</Text>
        {children && <Text style={st.emptyText}>{children}</Text>}
        {action && <View style={st.emptyAction}>{action}</View>}
      </View>
    </Card>
    </FadeIn>
  );
}

/* Gray placeholder block while rows load; a slow opacity pulse says "still loading". Static under reduce motion. */
export function Skeleton({ width, height, round }: { width: ViewStyle['width']; height: number; round?: boolean }) {
  const [v] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduceMotion) return;
    const a = Animated.loop(Animated.sequence([animate(v, 0.5, 800, ease.inOut), animate(v, 1, 800, ease.inOut)]));
    a.start();
    return () => a.stop();
  }, [v]);
  return <Animated.View style={{ width, height, borderRadius: round ? height / 2 : radius.sm, backgroundColor: color.skeleton, opacity: v }} />;
}

/* Round tick in the priority color; done fills green */
export function Tick({ priority = 4, checked, onPress, disabled, size = 24 }: {
  priority?: Priority; checked?: boolean; onPress?: () => void; disabled?: boolean; size?: number;
}) {
  const c = pColor[priority];
  // Ticking is the app's main action: a short spring pop confirms the tap before the row moves.
  const [scale] = useState(() => new Animated.Value(1));
  const pop = () => {
    if (reduceMotion) return;
    scale.setValue(0.8);
    Animated.spring(scale, { toValue: 1, friction: 6, tension: 180, useNativeDriver: nativeDriver }).start();
  };
  return (
    <Pressable
      onPress={() => { pop(); onPress?.(); }}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={checked ? tr('Bỏ đánh dấu xong') : tr('Đánh dấu xong')}
      accessibilityState={{ checked, disabled }}
      hitSlop={size < 32 ? 10 : 4}
      style={[disabled && st.disabled]}
    >
      {(s) => (
        <Animated.View
          style={[
            st.tick,
            webEase,
            { width: size, height: size, borderRadius: size / 2, borderWidth: size >= 32 ? 2 : 1.5, borderColor: checked ? color.success : c },
            checked && { backgroundColor: color.success },
            { transform: [{ scale }] },
          ]}
        >
          {(checked || active(s)) && (
            <Ionicons name="checkmark" size={size * 0.5} color={checked ? color.primaryFg : c} style={!checked && { opacity: 0.6 }} />
          )}
        </Animated.View>
      )}
    </Pressable>
  );
}

/* Choice group: single (value) or multi (value[]) */
export type Option<T> = { value: T; label: string; dot?: string };
export function Choices<T extends string | number>({ options, value, onChange, layout = 'wrap', error, disabled }: {
  options: Option<T>[];
  value: T | T[] | null;
  onChange: (v: T) => void; // multi: caller toggles
  layout?: 'wrap' | 'cols' | 'stack' | 'days';
  error?: string;
  disabled?: boolean;
}) {
  const multi = Array.isArray(value);
  const grid = layout === 'cols' || layout === 'days';
  const { width } = useWindowDimensions();
  const stack = layout === 'stack' && width < 640;
  return (
    <View style={st.field}>
      <View style={[st.choices, stack && st.choicesStack, grid && { gap: 6, flexWrap: 'nowrap' }]}>
        {options.map((o) => {
          const on = multi ? value.includes(o.value) : value === o.value;
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => onChange(o.value)}
              disabled={disabled}
              accessibilityRole={multi ? 'checkbox' : 'radio'}
              accessibilityState={{ checked: on, disabled }}
              style={(s) => [
                st.choice,
                grid && st.choiceGrid,
                on ? st.choiceOn : active(s) && { backgroundColor: color.itemHover },
                disabled && st.disabled,
              ]}
            >
              {o.dot && <View style={[st.dot, { backgroundColor: o.dot }]} />}
              <Text numberOfLines={1} style={[st.choiceText, on && { color: color.primary, fontWeight: '600' }, st.num]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error && <ErrorText key={error}>{error}</ErrorText>}
    </View>
  );
}

/* Validation message: keyed by its text at the call site, so each new error fades in instead of popping. */
function ErrorText({ children }: { children: string }) {
  return <FadeIn ms={duration.fast}><Text style={[st.hint, { color: color.errorText }]}>{children}</Text></FadeIn>;
}

export const st = StyleSheet.create({
  disabled: { opacity: 0.55 },
  // State, not movement: a press darkens a step instead of scaling.
  pressed: { opacity: 0.85 },
  hidden: { opacity: 0 },
  num: { fontVariant: ['tabular-nums'] },

  btn: { minHeight: 40, paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.ctl, borderWidth: rule.hair, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  btnText: { ...text.smMedium, lineHeight: 18, textAlign: 'center' },
  avatar: { backgroundColor: color.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font, fontWeight: '600', color: color.primary },
  iconBtn: { borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  iconBtnSurface: { borderRadius: radius.ctl, borderWidth: rule.hair, borderColor: color.fieldEdge, backgroundColor: color.surface },
  link: { ...text.meta, fontWeight: '500', color: color.foreground, textDecorationLine: 'underline', textDecorationColor: color.primary },

  badge: { alignSelf: 'flex-start', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { ...text.xs, fontWeight: '500', fontVariant: ['tabular-nums'] },
  tag: { height: 22, paddingHorizontal: 8, borderRadius: radius.sm, justifyContent: 'center', alignSelf: 'flex-start' },
  tagText: { ...text.xs, fontWeight: '500' },

  field: { gap: 6 },
  label: { ...text.meta, fontWeight: '500', color: color.muted },
  fieldRow: { flexDirection: 'row', gap: 8 },
  inputBox: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 8, borderRadius: radius.ctl, borderWidth: rule.hair, borderColor: color.fieldEdge, backgroundColor: color.field },
  input: { flex: 1, minWidth: 0, height: 42, paddingRight: 8, fontFamily: font, color: color.foreground, fontSize: 16, outlineWidth: 0, outlineStyle: 'solid' },
  inputDisabled: { opacity: 0.55 },
  hint: { ...text.xs, color: color.muted },

  card: { backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: rule.hair, borderColor: color.border, paddingVertical: 20, paddingHorizontal: 24 },
  cardFlush: { paddingHorizontal: 0, paddingVertical: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  cardHeadFlush: { paddingHorizontal: 20, marginBottom: 6 },
  cardBodyFlush: { paddingHorizontal: 8 },
  cardTitle: { ...text.h2, color: color.foreground, flexShrink: 1 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: rule.hair, borderBottomColor: color.border },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { ...text.body, color: color.foreground },
  rowDone: { color: color.muted, textDecorationLine: 'line-through' },
  rowMeta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, marginTop: 2 },
  meta: { ...text.meta, color: color.muted, fontVariant: ['tabular-nums'] },
  metaToday: { color: color.foreground, fontWeight: '500' },

  backdrop: { flex: 1, backgroundColor: color.backdrop, justifyContent: 'center', alignItems: 'center', padding: 16 },
  modal: { width: '100%', maxWidth: 400, backgroundColor: color.surface, borderRadius: radius.lg, padding: 24, gap: 24, boxShadow: shadowModal },
  modalHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  modalIcon: { paddingTop: 2 },
  modalBody: { flex: 1, minWidth: 0 },
  modalText: { ...text.sm, lineHeight: 22, color: color.muted, marginTop: 4 },
  modalFoot: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 12 },

  screen: { flex: 1, backgroundColor: color.background },
  split: { flex: 1, flexDirection: 'row' },
  aside: { width: 360, flexGrow: 0, backgroundColor: color.surface, borderLeftWidth: rule.hair, borderLeftColor: color.border },
  asideBody: { paddingHorizontal: 28, paddingTop: 32, paddingBottom: 32, gap: 32 },
  screenBody: { padding: 16, gap: 20, width: '100%', maxWidth: 720, alignSelf: 'center' },
  back: { alignSelf: 'flex-start', marginLeft: -12, marginBottom: -12, paddingHorizontal: 12, borderWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 },
  headText: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  h1: { ...text.h1, color: color.foreground },
  sub: { ...text.sm, color: color.muted, marginTop: 6, fontVariant: ['tabular-nums'] },
  footer: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 },

  groupHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 8 },
  groupTitle: { ...text.h2, color: color.foreground },
  groupCount: { ...text.meta, fontWeight: '500', color: color.muted, fontVariant: ['tabular-nums'] },

  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: rule.hair, borderBottomColor: color.border },
  lineLabel: { ...text.sm, flex: 1, color: color.soft },
  lineN: { ...text.base, color: color.foreground, fontVariant: ['tabular-nums'], textAlign: 'right' },

  empty: { ...text.sm, color: color.muted, paddingVertical: 16 },
  emptyBox: { alignItems: 'flex-start', paddingVertical: 8, gap: 6 },
  emptyIcon: { marginBottom: 4 },
  emptyTitle: { ...text.base, color: color.foreground },
  emptyText: { ...text.sm, color: color.muted, maxWidth: 420 },
  emptyAction: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  tick: { alignItems: 'center', justifyContent: 'center' },

  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choicesStack: { flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch' },
  choice: { height: 36, paddingHorizontal: 14, borderRadius: radius.full, borderWidth: rule.hair, borderColor: color.fieldEdge, backgroundColor: color.surface, flexDirection: 'row', alignItems: 'center', gap: 6 },
  choiceOn: { borderColor: color.primary, backgroundColor: color.primaryLight },
  choiceGrid: { flex: 1, minWidth: 0, paddingHorizontal: 4, gap: 4, justifyContent: 'center' },
  choiceText: { ...text.meta, color: color.soft },
  dot: { width: 8, height: 8, borderRadius: 1 },
});
