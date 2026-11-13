import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Children, type ComponentProps, type ComponentRef, Fragment, type ReactNode, type Ref, type RefObject, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  RefreshControl,
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

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
  shadowFab,
  shadowModal,
  text,
  touch,
} from '@/constants/theme';
import { haptic } from '@/lib/haptics';
import { tr } from '@/lib/i18n';
import { choose, type Choice } from '@/lib/notify';
import { refresh, useSession } from '@/lib/supabase';

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

export function Button({ title, icon, leading, onPress, variant = 'outline', disabled, loading, style }: {
  // leading: a picture in place of the icon, for a brand logo that must keep its own colours.
  title: string; icon?: IconName; leading?: ReactNode; onPress?: () => void; variant?: Variant; disabled?: boolean; loading?: boolean; style?: ViewStyle;
}) {
  const v = btn[variant];
  const narrow = !useWide();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={(s) => [
        st.btn,
        narrow && { minHeight: touch },
        { backgroundColor: active(s) ? v.bgActive : v.bg, borderColor: v.border ?? 'transparent' },
        pressed(s),
        disabled && !loading && st.disabled,
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={16} color={v.fg} style={loading && st.hidden} />}
      {leading && <View style={loading && st.hidden}>{leading}</View>}
      <Text style={[st.btnText, { color: v.fg }, loading && st.hidden]}>{title}</Text>
      {loading && <ActivityIndicator color={v.fg} size="small" style={StyleSheet.absoluteFill} />}
    </Pressable>
  );
}

/* Square icon-only button. Whatever it draws, the touch target reaches 44 (hitSlop makes up the rest). */
export function IconButton({ icon, label, onPress, tint, surface, size = 32, ink }: { icon: IconName; label: string; onPress?: () => void; tint?: boolean; surface?: boolean; size?: number; ink?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={Math.max(0, (touch - size) / 2)}
      style={(s) => [st.iconBtn, { width: size, height: size }, surface && st.iconBtnSurface, tint && { backgroundColor: color.primaryLight }, !tint && active(s) && { backgroundColor: surface ? color.buttonHover : color.itemHover }, pressed(s)]}
    >
      {/* ink: the top bar's icons, drawn in the text colour at a phone's 22. */}
      <Ionicons name={icon} size={ink ? 22 : 18} color={tint ? color.primary : ink ? color.foreground : color.muted} />
    </Pressable>
  );
}

/* The signed-in user's initial on an accent wash; with onPress it is a button (opens settings).
   An email that starts with a digit or a symbol gets a person icon: a lone "0" read as a counter. */
export function Avatar({ size = 40, onPress }: { size?: number; onPress?: () => void }) {
  const email = useSession()?.user.email;
  const first = (email ?? '')[0] ?? '';
  const letter = first.toLowerCase() !== first.toUpperCase();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${tr('Cài đặt')}, ${email ?? ''}` : email}
      style={(s) => [st.avatar, { width: size, height: size, borderRadius: size / 2 }, pressed(s)]}
    >
      {letter
        ? <Text style={[st.avatarText, { fontSize: size * 0.42, lineHeight: size * 0.6 }]}>{first.toUpperCase()}</Text>
        : <Ionicons name="person" size={size * 0.5} color={color.primary} />}
    </Pressable>
  );
}

/* Text link: accent text with a chevron (or a leading icon), no underline; a soft accent pill on hover/press.
   Pulled out by its padding so the text still lines up with what sits beside it. */
export function TextLink({ label, onPress, icon }: { label: string; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="link" style={(s) => [st.link, active(s) && { backgroundColor: color.primaryLight }]}>
      {icon && <Ionicons name={icon} size={14} color={color.primary} />}
      <Text style={st.linkText}>{label}</Text>
      {!icon && <Ionicons name="chevron-forward" size={14} color={color.primary} />}
    </Pressable>
  );
}

/** The app's mark (two ticks), drawn in `tint`. One white image for every size and colour. */
export function AppMark({ size, tint }: { size: number; tint: string }) {
  return <Image source={require('../../assets/mark.png')} style={{ width: size, height: size, tintColor: tint }} accessibilityIgnoresInvertColors />;
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
  // Web textareas don't grow with their text (native ones do), so long titles hid behind a scrollbar: size to the content.
  // ponytail: scrollHeight never shrinks, so the box stays tall after deleting text until remount; CSS field-sizing once Firefox has it.
  const [h, setH] = useState(0);
  const grow = Platform.OS === 'web' && props.multiline;
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
            onContentSizeChange={grow ? (e) => { setH(e.nativeEvent.contentSize.height); props.onContentSizeChange?.(e); } : props.onContentSizeChange}
            style={[st.input, props.style, grow && h > 0 && { height: h }]}
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
  const narrow = !useWide();
  return (
    // Phones: no edge and a 16 gutter; a white sheet on cream is enough to group.
    <View style={[st.card, narrow && st.cardNarrow, flush && st.cardFlush, style]}>
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

export type BarAction = { icon: IconName; label: string; onPress: () => void };
/** A line of a screen's ⋯ menu (phones). */
export type MenuItem = Choice & { run: () => void };

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

/* Screen: title, scrolling body, optional right aside (wide only) and footer pinned above the tab bar.
   On wide screens the top bar holds the quick add, so `footer` is hidden there unless `wideFooter`.
   Phones get their own frame (MobileScreen): `actions`, `menu`, `fab` and `top` are read there only, `right` and
   `aside` only on wide. */
export function Screen({ title, sub, back, right, footer, wideFooter, aside, children, maxWidth = 760, ...phone }: {
  // `back`: narrow only, where there is no rail. 'always' also shows it on wide, for pages the rail can't reach.
  title: string; sub?: string; back?: boolean | 'always'; right?: ReactNode; footer?: ReactNode; wideFooter?: boolean; aside?: ReactNode; children: ReactNode; maxWidth?: number;
} & MobileProps) {
  const wide = useWide();
  if (!wide) return <MobileScreen title={title} sub={sub} back={!!back} footer={footer} {...phone}>{children}</MobileScreen>;
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

type MobileProps = {
  actions?: BarAction[]; // icons at the right of the top bar; with a menu only the first stays beside the ⋯
  menu?: MenuItem[]; // the screen's less used actions (rename, delete…), as an action sheet behind ⋯
  fab?: ReactNode; // the floating add button (see AddFab), drawn over the list in the thumb's corner
  top?: ReactNode; // pinned under the top bar (a week strip); the title then stays in the bar
  fit?: boolean; // the large title keeps to one line, shrinking a little if it must (a dated title, "Báo cáo ngày 09/11/2026")
  scrollRef?: RefObject<ComponentRef<typeof ScrollView> | null>;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

// Pull to refresh reloads every table a screen may show; realtime normally keeps them current anyway.
const TABLES = ['tasks', 'subtasks', 'projects', 'daily_reports', 'journal_notes'];

/** Phones: a top bar (back, the title once the large one has scrolled away, up to two icons) over a scrolling
 *  page that opens with the large title. Pull down to refresh. No text buttons in the head, ever: they wrapped
 *  the title into a column of single words. */
function MobileScreen({ title, sub, back, footer, actions = [], menu, fab, top, fit, children, scrollRef, onScroll }: {
  title: string; sub?: string; back: boolean; footer?: ReactNode; children: ReactNode;
} & MobileProps) {
  const inset = useSafeAreaInsets().top;
  const [y] = useState(() => new Animated.Value(0));
  const [refreshing, setRefreshing] = useState(false);
  const fixed = !!top;
  // The small title and the bar's rule fade in as the large title goes under the bar (opacity only).
  const shown = fixed ? 1 : y.interpolate({ inputRange: [28, 56], outputRange: [0, 1], extrapolate: 'clamp' });
  const reload = () => {
    setRefreshing(true);
    TABLES.forEach(refresh);
    setTimeout(() => setRefreshing(false), 700); // ponytail: refresh() doesn't report back; a fixed beat reads as done
  };
  const icons: BarAction[] = menu?.length
    ? [...actions.slice(0, 1), {
        icon: 'ellipsis-horizontal', label: tr('Thêm thao tác'),
        onPress: async () => { const k = await choose(title, menu); menu.find((m) => m.key === k)?.run(); },
      }]
    : actions.slice(0, 2);

  return (
    <View style={st.screen}>
      <View style={[st.bar, { paddingTop: inset }]}>
        <View style={st.barRow}>
          {back && <IconButton icon="chevron-back" ink size={40} label={tr('Quay lại')} onPress={goBack} />}
          <Animated.Text style={[fixed ? st.barTitleFixed : st.barTitle, { opacity: shown }, !back && { paddingLeft: 8 }]} numberOfLines={1}>{title}</Animated.Text>
          {icons.map((a) => <IconButton key={a.label} icon={a.icon} ink size={40} label={a.label} onPress={a.onPress} />)}
        </View>
        {top}
        <Animated.View style={[st.barRule, { opacity: shown }]} />
      </View>
      <KeyboardAvoidingView style={st.screen} behavior="padding">
        <Animated.ScrollView
          ref={scrollRef as never}
          style={st.screen}
          contentContainerStyle={[st.mBody, { paddingBottom: fab ? 104 : 40 }]}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y } } }], { useNativeDriver: Platform.OS !== 'web', listener: onScroll })}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} colors={[color.primary]} tintColor={color.primary} progressBackgroundColor={color.surface} />}
        >
          {!fixed && (
            <View style={st.mHead}>
              <Text style={[st.mTitle, fit && st.mTitleFit]} numberOfLines={fit ? 1 : 2} adjustsFontSizeToFit={fit} minimumFontScale={0.75}>{title}</Text>
              {sub && <Text style={st.sub}>{sub}</Text>}
            </View>
          )}
          {children}
        </Animated.ScrollView>
        {footer && <View style={st.footer}>{footer}</View>}
      </KeyboardAvoidingView>
      {fab}
    </View>
  );
}

/** Phones: the round add button over the list, bottom right where the thumb rests. */
export function Fab({ icon = 'add', label, onPress }: { icon?: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={(s) => [st.fab, s.pressed && { backgroundColor: color.primaryHover }]}>
      <Ionicons name={icon} size={28} color={color.primaryFg} />
    </Pressable>
  );
}

/** Where a list row's text starts when it has an icon: separators begin there, not at the edge. */
export const ICON_INSET = 16 + 28 + 14;

/** Phones: an inset group of rows (settings, browse, pickers): a quiet heading, then one rounded sheet with
 *  hairlines between the rows, starting at the text column (`inset`). No border, no card in a card. */
export function ListGroup({ title, action, footer, inset = 16, children }: { title?: string; action?: ReactNode; footer?: string; inset?: number; children: ReactNode }) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={st.lg}>
      {(title || action) && (
        <View style={st.lgHead}>
          <Text style={st.lgTitle}>{title}</Text>
          {action}
        </View>
      )}
      <View style={st.lgBox}>
        {rows.map((r, i) => (
          <Fragment key={(r as { key?: string }).key ?? i}>
            {i > 0 && <View style={[st.lgRule, { marginLeft: inset }]} />}
            {r}
          </Fragment>
        ))}
      </View>
      {footer && <Text style={st.lgFoot}>{footer}</Text>}
    </View>
  );
}

/** One row of a ListGroup: icon, title (and a line under it), the current value, a chevron when it leads on. */
export function ListItem({ icon, tint, title, sub, value, onPress, chevron = !!onPress, danger, left, right, selected, subTone }: {
  icon?: IconName; tint?: string; title: string; sub?: string; value?: string; onPress?: () => void; chevron?: boolean;
  danger?: boolean; left?: ReactNode; right?: ReactNode; selected?: boolean; subTone?: 'error';
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={selected !== undefined ? { selected } : undefined}
      style={(s) => [st.li, !!onPress && active(s) && { backgroundColor: color.itemHover }]}
    >
      {left ?? (icon && <View style={st.liIcon}><Ionicons name={icon} size={20} color={danger ? color.danger : tint ?? color.soft} /></View>)}
      <View style={st.liBody}>
        <Text style={[st.liTitle, danger && { color: color.danger }]} numberOfLines={2}>{title}</Text>
        {sub && <Text style={[st.liSub, subTone === 'error' && { color: color.errorText }]} numberOfLines={2}>{sub}</Text>}
      </View>
      {value !== undefined && <Text style={st.liValue} numberOfLines={1}>{value}</Text>}
      {right}
      {selected && <Ionicons name="checkmark" size={20} color={color.primary} />}
      {chevron && <Ionicons name="chevron-forward" size={18} color={color.muted} />}
    </Pressable>
  );
}

/* Group heading: 18px, count beside it; overdue is red with an alert icon. Phones: 16px.
   With onToggle the heading folds its group (a chevron after the count). */
export function GroupTitle({ title, count, over, action, open, onToggle }: { title: string; count?: number; over?: boolean; action?: ReactNode; open?: boolean; onToggle?: () => void }) {
  const narrow = !useWide();
  const head = (
    <>
      {over && <Ionicons name="alert-circle" size={narrow ? 18 : 20} color={color.danger} />}
      <Text style={[st.groupTitle, narrow && st.groupTitleNarrow, over && { color: color.danger }]}>{title}</Text>
      {!!count && <Text style={st.groupCount}>{count}</Text>}
      {onToggle && <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={color.muted} />}
    </>
  );
  return (
    <View style={[st.groupHead, narrow && st.groupHeadNarrow]}>
      {onToggle ? (
        <Pressable onPress={onToggle} hitSlop={12} accessibilityRole="button" accessibilityState={{ expanded: open }} style={st.groupToggle}>{head}</Pressable>
      ) : head}
      {action && <View style={st.groupAction}>{action}</View>}
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
  const wide = useWide();
  const body = (
    <View style={[st.emptyBox, !wide && st.emptyNarrow]}>
      <Ionicons name={icon} size={wide ? 24 : 32} color={color.muted} style={st.emptyIcon} />
      <Text style={[st.emptyTitle, !wide && st.center]}>{title}</Text>
      {children && <Text style={[st.emptyText, !wide && st.center]}>{children}</Text>}
      {action && <View style={[st.emptyAction, !wide && { justifyContent: 'center' }]}>{action}</View>}
    </View>
  );
  // Phones: straight on the page, centred; a white card around one sentence was a web habit.
  return <FadeIn>{wide ? <Card>{body}</Card> : body}</FadeIn>;
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
      onPress={() => { pop(); if (!checked) haptic.tick(); onPress?.(); }}
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
  layout?: 'wrap' | 'cols' | 'stack' | 'days' | 'row'; // row: one line that never wraps (inside a sideways scroll)
  error?: string;
  disabled?: boolean;
}) {
  const multi = Array.isArray(value);
  const grid = layout === 'cols' || layout === 'days';
  const { width } = useWindowDimensions();
  const stack = layout === 'stack' && width < 640;
  return (
    <View style={st.field}>
      <View style={[st.choices, stack && st.choicesStack, grid && { gap: 6, flexWrap: 'nowrap' }, layout === 'row' && { flexWrap: 'nowrap' }]}>
        {options.map((o) => {
          const on = multi ? value.includes(o.value) : value === o.value;
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => onChange(o.value)}
              disabled={disabled}
              hitSlop={4}
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
export function ErrorText({ children }: { children: string }) {
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
  link: { flexDirection: 'row', alignItems: 'center', gap: 2, marginHorizontal: -8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  linkText: { ...text.meta, fontWeight: '600', color: color.primary },

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
  cardNarrow: { borderWidth: 0, paddingVertical: 16, paddingHorizontal: 16 },
  cardFlush: { paddingHorizontal: 0, paddingVertical: 16 },
  // Wraps: on a phone a long title (Báo cáo ngày + badge) and its action do not fit one line.
  cardHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: 12, rowGap: 8, marginBottom: 16 },
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

  // Phones: the top bar, the large title, the page.
  bar: { backgroundColor: color.background, zIndex: 2 },
  barRow: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8 },
  barTitle: { ...text.bar, flex: 1, color: color.foreground },
  barTitleFixed: { ...text.xl, flex: 1, color: color.foreground },
  barRule: { height: rule.hair, backgroundColor: color.border },
  mBody: { paddingHorizontal: 16, paddingTop: 4, gap: 20, width: '100%', maxWidth: 720, alignSelf: 'center' },
  mHead: { gap: 2, marginBottom: -4 },
  mTitle: { ...text.title, color: color.foreground },
  // A dated title (the report): a step down from 28, so the date sits on one line without being squeezed.
  mTitleFit: { fontSize: 24, lineHeight: 32, letterSpacing: -0.4 },
  fab: { position: 'absolute', right: 16, bottom: 16, width: 56, height: 56, borderRadius: 18, backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center', boxShadow: shadowFab },

  lg: { gap: 8 },
  lgHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 28, paddingHorizontal: 4 },
  lgTitle: { ...text.smMedium, color: color.muted, flexShrink: 1 },
  lgBox: { backgroundColor: color.surface, borderRadius: radius.lg, overflow: 'hidden' },
  lgRule: { height: rule.hair, backgroundColor: color.border },
  lgFoot: { ...text.meta, color: color.muted, paddingHorizontal: 4 },
  li: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52, paddingHorizontal: 16, paddingVertical: 10 },
  liIcon: { width: 28, alignItems: 'center' },
  liBody: { flex: 1, minWidth: 0, gap: 2 },
  liTitle: { ...text.body, color: color.foreground },
  liSub: { ...text.meta, color: color.muted, fontVariant: ['tabular-nums'] },
  liValue: { ...text.sm, color: color.muted, maxWidth: '50%', textAlign: 'right', fontVariant: ['tabular-nums'] },

  groupHead: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 8 },
  groupHeadNarrow: { alignItems: 'center', minHeight: 32, paddingHorizontal: 4, marginBottom: 6 },
  groupToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupTitle: { ...text.h2, color: color.foreground },
  groupTitleNarrow: { ...text.base },
  groupCount: { ...text.meta, fontWeight: '500', color: color.muted, fontVariant: ['tabular-nums'] },
  groupAction: { marginLeft: 'auto', alignSelf: 'center' },

  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: rule.hair, borderBottomColor: color.border },
  lineLabel: { ...text.sm, flex: 1, color: color.soft },
  lineN: { ...text.base, color: color.foreground, fontVariant: ['tabular-nums'], textAlign: 'right' },

  empty: { ...text.sm, color: color.muted, paddingVertical: 16 },
  emptyBox: { alignItems: 'flex-start', paddingVertical: 8, gap: 6 },
  emptyNarrow: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 },
  center: { textAlign: 'center' },
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
