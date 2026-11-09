import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type IconName, useWide } from '@/components/ui';
import { color, radius, rule, shadowModal, text } from '@/constants/theme';
import { tr } from '@/lib/i18n';

// The signed-out frame shared by sign-in and reset-password: on wide screens the accent intro panel on the
// left and the form on the right; on phones the form on a white card with the logo above.

const FEATURES: [IconName, string, string][] = [
  ['sunny-outline', 'Hôm nay rõ ràng', 'Việc quá hạn, việc hôm nay và việc kế tiếp trên một màn.'],
  ['folder-open-outline', 'Gom theo project', 'Thêm nhanh vào Hộp thư, xếp vào project khi rảnh.'],
  ['book-outline', 'Nhật ký tự ghi', 'Việc xong nằm lại theo ngày, xem lại cả tháng.'],
];

const PREVIEW: [string, string, boolean][] = [
  ['Gửi báo cáo tuần', '09:00', true],
  ['Review thiết kế màn đăng nhập', '14:30', false],
  ['Gọi lại cho khách', 'Trễ 1 ngày', false],
];

export function AuthShell({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  const wide = useWide();
  const form = (
    <View style={s.form}>
      {!wide && <Logo />}
      <View style={{ gap: 6 }}>
        <Text style={s.title}>{title}</Text>
        {sub && <Text style={s.sub}>{sub}</Text>}
      </View>
      {children}
    </View>
  );
  return (
    <SafeAreaView style={[s.fill, wide && { backgroundColor: color.surface }]}>
      <View style={s.split}>
        {wide && <Intro />}
        {/* `padding` on Android too: edge-to-edge windows do not resize for the keyboard. */}
        <KeyboardAvoidingView style={s.side} behavior="padding">
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            {wide ? form : <View style={s.card}>{form}</View>}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

function Logo({ light }: { light?: boolean }) {
  return (
    <View style={s.brand}>
      <View style={[s.mark, light && { backgroundColor: color.surface }]}>
        <Ionicons name="checkmark-done" size={22} color={light ? color.foreground : color.surface} />
      </View>
      <Text style={[s.brandName, light && { color: color.surface }]}>{tr('Việc & Nhật ký')}</Text>
    </View>
  );
}

/** Left side on wide screens, a soft accent panel: what the app does, with a small static preview. */
function Intro() {
  const { width, height } = useWindowDimensions();
  const big = width >= 1280; // room for the headline at full size, one clause per line
  return (
    <View style={s.intro}>
      <Logo />
      <View style={{ gap: 28 }}>
        <View style={{ gap: 12 }}>
          <Text style={[s.headline, !big && { fontSize: 28, lineHeight: 36 }]}>{tr('Biết hôm nay làm gì,')}{big ? '\n' : ' '}{tr('nhớ hôm qua đã làm gì.')}</Text>
          <Text style={s.lead}>{tr('Một nơi cho việc cần làm và nhật ký việc đã xong, đồng bộ giữa web và điện thoại.')}</Text>
        </View>

        {/* Short screens drop the preview so the panel never overflows. */}
        <View style={[s.preview, height < 820 && { display: 'none' }]} aria-hidden>
          <Text style={s.previewHead}>{tr('Hôm nay')}</Text>
          {PREVIEW.map(([title, meta, done], i) => (
            <View key={title} style={[s.previewRow, i === PREVIEW.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={[s.previewTick, done && { backgroundColor: color.success, borderColor: color.success }]}>
                {done && <Ionicons name="checkmark" size={12} color={color.surface} />}
              </View>
              <Text style={[s.previewTitle, done && s.previewDone]} numberOfLines={1}>{tr(title)}</Text>
              <Text style={[s.previewMeta, i === 2 && { color: color.danger }]}>{tr(meta)}</Text>
            </View>
          ))}
        </View>

        {/* What the app does, as a short definition list (no icon tiles). */}
        <View style={s.features}>
          {FEATURES.map(([, title, body]) => (
            <View key={title} style={s.feature}>
              <Text style={s.featureTitle}>{tr(title)}</Text>
              <Text style={s.featureBody}>{tr(body)}</Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={s.foot}>© {new Date().getFullYear()} {tr('Việc & Nhật ký')}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.background },
  split: { flex: 1, flexDirection: 'row' },
  side: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 16, paddingVertical: 32 },
  // Phones: the form on a white sheet with soft corners.
  card: { width: '100%', maxWidth: 440, alignSelf: 'center', backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: rule.hair, borderColor: color.border, padding: 24 },
  form: { width: '100%', maxWidth: 400, alignSelf: 'center', gap: 24 },

  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mark: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center' },
  brandName: { ...text.base, color: color.foreground },

  title: { ...text.h1, color: color.foreground },
  sub: { ...text.sm, color: color.muted },

  // The intro panel: a soft accent wash beside the white form.
  intro: { width: '46%', maxWidth: 640, backgroundColor: color.primaryLight, paddingHorizontal: 56, paddingVertical: 48, justifyContent: 'space-between', gap: 32 },
  headline: { ...text.h1, fontSize: 40, lineHeight: 48, letterSpacing: -1.2, color: color.foreground },
  lead: { ...text.body, color: color.soft, maxWidth: 460 },
  preview: { backgroundColor: color.surface, borderRadius: radius.lg, boxShadow: shadowModal, paddingHorizontal: 20, paddingVertical: 14, maxWidth: 460 },
  previewHead: { ...text.meta, fontWeight: '600', color: color.muted, marginBottom: 4 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: rule.hair, borderBottomColor: color.border },
  previewTick: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: color.fieldEdge, alignItems: 'center', justifyContent: 'center' },
  previewTitle: { ...text.sm, flex: 1, color: color.foreground },
  previewDone: { color: color.muted, textDecorationLine: 'line-through' },
  previewMeta: { ...text.xs, color: color.muted, fontVariant: ['tabular-nums'] },
  features: { maxWidth: 460, gap: 14 },
  feature: { gap: 2 },
  featureTitle: { ...text.smMedium, fontWeight: '600', color: color.foreground },
  featureBody: { ...text.meta, color: color.muted },
  foot: { ...text.xs, color: color.muted },
});
