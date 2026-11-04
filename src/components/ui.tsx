import { router } from 'expo-router';
import { type ReactNode, useState } from 'react';
import {
  ActivityIndicator,
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

import { color, priority as pColor, type Priority, radius, shadowModal, text } from '@/constants/theme';

// react-native-web also reports hover; native only has pressed.
const active = (s: PressableStateCallbackType) => s.pressed || !!(s as { hovered?: boolean }).hovered;

/* Button */
type Variant = 'outline' | 'primary' | 'secondary' | 'ghost' | 'danger';
const btn: Record<Variant, { bg: string; bgActive: string; fg: string; border?: string }> = {
  outline: { bg: color.surface, bgActive: color.buttonHover, fg: color.foreground, border: color.borderStrong },
  primary: { bg: color.primary, bgActive: color.primaryHover, fg: color.primaryFg },
  secondary: { bg: color.secondary, bgActive: color.secondaryHover, fg: color.foreground },
  ghost: { bg: 'transparent', bgActive: color.ghostHover, fg: color.muted },
  danger: { bg: color.dangerBg, bgActive: color.dangerBgHover, fg: color.danger },
};

export function Button({ title, onPress, variant = 'outline', disabled, loading, style }: {
  title: string; onPress?: () => void; variant?: Variant; disabled?: boolean; loading?: boolean; style?: ViewStyle;
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
        disabled && !loading && st.disabled,
        style,
      ]}
    >
      <Text style={[st.btnText, { color: v.fg }, loading && st.hidden]}>{title}</Text>
      {loading && <ActivityIndicator color={v.fg} size="small" style={StyleSheet.absoluteFill} />}
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
      <View style={[st.badgeDot, { backgroundColor: fg }]} />
      <Text style={[st.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/* Input with label, hint and error */
export function Field({ label, hint, error, editable = true, right, ...props }: TextInputProps & {
  label?: string; hint?: string; error?: string; right?: ReactNode;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={st.field}>
      {label && <Text style={st.label}>{label}</Text>}
      <View style={st.fieldRow}>
        <TextInput
          {...props}
          editable={editable}
          aria-invalid={!!error}
          placeholderTextColor={color.muted}
          onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
          style={[
            st.input,
            focus && { borderColor: error ? color.error : color.primary, boxShadow: `0 0 0 2px ${error ? color.errorRing : color.ringFocus}` },
            !!error && !focus && { borderColor: color.error },
            !editable && st.inputDisabled,
            props.style,
          ]}
        />
        {right}
      </View>
      {(error || hint) && <Text style={[st.hint, !!error && { color: color.errorText }]}>{error || hint}</Text>}
    </View>
  );
}

/* Card */
export function Card({ title, action, flush, children }: { title?: ReactNode; action?: ReactNode; flush?: boolean; children: ReactNode }) {
  return (
    <View style={[st.card, flush && st.cardFlush]}>
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

/* List row: tick or anything on the left, title and meta on the right */
export function ListRow({ title, meta, left, done, onPress }: {
  title: string; meta?: ReactNode; left?: ReactNode; done?: boolean; onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={(s) => [st.row, active(s) && { backgroundColor: color.itemHover }]}>
      {left}
      <View style={st.rowBody}>
        <Text style={[st.rowTitle, done && st.rowDone]}>{title}</Text>
        {meta && <View style={st.rowMeta}>{meta}</View>}
      </View>
    </Pressable>
  );
}
export function Meta({ children, tone }: { children: ReactNode; tone?: 'over' | 'today' }) {
  return <Text style={[st.meta, tone === 'over' && { color: color.warning }, tone === 'today' && st.metaToday]}>{children}</Text>;
}

/* Confirm modal */
export function ConfirmModal({ visible, title, message, confirmText = 'Xoá', onCancel, onConfirm, busy }: {
  visible: boolean; title: string; message?: string; confirmText?: string; onCancel: () => void; onConfirm: () => void; busy?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={st.backdrop}>
        <View style={st.modal}>
          <View>
            <Text style={st.cardTitle}>{title}</Text>
            {message && <Text style={st.modalText}>{message}</Text>}
          </View>
          <View style={st.modalFoot}>
            <Button title="Huỷ" variant="secondary" onPress={onCancel} />
            <Button title={confirmText} variant="danger" onPress={onConfirm} loading={busy} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* Screen: title, scrolling body, optional footer pinned above the tab bar */
export function Screen({ title, sub, back, right, footer, children }: {
  title: string; sub?: string; back?: boolean; right?: ReactNode; footer?: ReactNode; children: ReactNode;
}) {
  return (
    <SafeAreaView edges={['top']} style={st.screen}>
      <KeyboardAvoidingView style={st.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={st.screenBody} keyboardShouldPersistTaps="handled">
          {back && (
            <Button
              title="‹ Quay lại"
              variant="ghost"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/index'))}
              style={st.back}
            />
          )}
          <View style={st.head}>
            <View style={st.rowBody}>
              <Text style={st.h1}>{title}</Text>
              {sub && <Text style={st.sub}>{sub}</Text>}
            </View>
            {right}
          </View>
          {children}
        </ScrollView>
        {footer && <View style={st.footer}>{footer}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* Empty state */
export function Empty({ children }: { children: ReactNode }) {
  return <Text style={st.empty}>{children}</Text>;
}

/* Round tick colored by priority: 20px circle, 44px tap area */
export function Tick({ priority = 4, checked, onPress, disabled }: {
  priority?: Priority; checked?: boolean; onPress?: () => void; disabled?: boolean;
}) {
  const c = pColor[priority];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      hitSlop={12}
      style={[st.tickSlot, disabled && st.disabled]}
    >
      {(s) => (
        <View style={[st.tick, { borderColor: c, backgroundColor: checked ? c : `${c}14` }]}>
          {(checked || active(s)) && <Text style={[st.tickMark, { color: checked ? '#fff' : c }]}>✓</Text>}
        </View>
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
  const stack = layout === 'stack' && width < 640; // same breakpoint as the approved page
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
                { backgroundColor: on ? color.primary : active(s) ? color.chipHover : color.chip },
                disabled && st.disabled,
              ]}
            >
              {o.dot && <View style={[st.dot, { backgroundColor: o.dot }, on && st.dotOn]} />}
              <Text numberOfLines={1} style={[st.choiceText, { color: on ? color.primaryFg : color.chipText }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error && <Text style={[st.hint, { color: color.errorText }]}>{error}</Text>}
    </View>
  );
}

export const st = StyleSheet.create({
  disabled: { opacity: 0.5 },
  hidden: { opacity: 0 },

  btn: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  btnText: { fontSize: 14, lineHeight: 18, fontWeight: '500', textAlign: 'center' },

  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { ...text.xs, fontWeight: '500' },

  field: { gap: 6 },
  label: { ...text.smMedium, color: color.foreground },
  fieldRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, minWidth: 0, height: 44, paddingHorizontal: 16, borderRadius: radius.md, borderWidth: 1, borderColor: color.borderStrong, backgroundColor: color.surface, color: color.foreground, fontSize: 16, outlineWidth: 0 },
  inputDisabled: { opacity: 0.5, backgroundColor: color.background },
  hint: { ...text.xs, color: color.muted },

  card: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.border, borderRadius: radius.lg, padding: 16 },
  cardFlush: { paddingHorizontal: 0 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  cardHeadFlush: { paddingHorizontal: 16, marginBottom: 6 },
  cardBodyFlush: { paddingHorizontal: 4 },
  cardTitle: { ...text.base, color: color.foreground, flexShrink: 1 },

  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.md },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { ...text.sm, color: color.foreground },
  rowDone: { color: color.muted, textDecorationLine: 'line-through' },
  rowMeta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 4, marginTop: 2 },
  meta: { ...text.xs, color: color.muted },
  metaToday: { color: color.foreground, fontWeight: '500' },

  backdrop: { flex: 1, backgroundColor: color.backdrop, justifyContent: 'center', alignItems: 'center', padding: 16 },
  modal: { width: '100%', maxWidth: 400, backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: color.border, padding: 24, gap: 24, boxShadow: shadowModal },
  modalText: { ...text.sm, lineHeight: 24, color: color.muted, marginTop: 8 },
  modalFoot: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 12 },

  screen: { flex: 1, backgroundColor: color.background },
  screenBody: { padding: 16, gap: 16, width: '100%', maxWidth: 720, alignSelf: 'center' },
  back: { alignSelf: 'flex-start', marginLeft: -12, marginBottom: -12 },
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingTop: 4 },
  h1: { ...text.xl, color: color.foreground },
  sub: { ...text.sm, color: color.muted },
  footer: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },

  empty: { ...text.sm, color: color.muted, textAlign: 'center', paddingVertical: 24 },

  tickSlot: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  tick: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  tickMark: { fontSize: 11, lineHeight: 13, fontWeight: '700' },

  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choicesStack: { flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch' },
  choice: { height: 36, paddingHorizontal: 14, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', gap: 6 },
  choiceGrid: { flex: 1, minWidth: 0, paddingHorizontal: 4, gap: 4, justifyContent: 'center' },
  choiceText: { ...text.smMedium },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { borderWidth: 1.5, borderColor: color.primaryFg },
});
