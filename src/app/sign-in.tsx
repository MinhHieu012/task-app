import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field, IconButton, type IconName, useWide } from '@/components/ui';
import { color, radius, rule, shadowModal, text } from '@/constants/theme';
import { toast } from '@/lib/notify';
import { ok, supabase } from '@/lib/supabase';

type Mode = 'in' | 'up';

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

export default function SignIn() {
  const wide = useWide();
  const [mode, setMode] = useState<Mode>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [tried, setTried] = useState(false); // show field errors only after the first submit
  const [busy, setBusy] = useState(false);
  const up = mode === 'up';

  const errors = {
    email: !email.trim() ? 'Nhập email.' : !/^\S+@\S+\.\S+$/.test(email.trim()) ? 'Email chưa đúng dạng.' : undefined,
    password: !password ? 'Nhập mật khẩu.' : up && password.length < 6 ? 'Cần ít nhất 6 ký tự.' : undefined,
    confirm: up && confirm !== password ? 'Mật khẩu nhập lại không khớp.' : undefined,
  };
  const err = (k: keyof typeof errors) => (tried ? errors[k] : undefined);

  const switchMode = (m: Mode) => {
    setMode(m);
    setTried(false);
    setConfirm('');
  };

  const submit = async () => {
    setTried(true);
    if (errors.email || errors.password || errors.confirm) return;
    const creds = { email: email.trim(), password };
    setBusy(true);
    if (!up) {
      ok(await supabase.auth.signInWithPassword(creds));
    } else {
      // ponytail: sign-up stays open for the owner and test accounts; hide this tab once sign-ups are disabled.
      const res = await supabase.auth.signUp(creds);
      if (ok(res) && !res.data.session) {
        toast('Mở link xác nhận trong email rồi đăng nhập.', 'Kiểm tra email');
        switchMode('in');
      }
    }
    setBusy(false);
  };

  const eye = <IconButton icon={show ? 'eye-off-outline' : 'eye-outline'} label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onPress={() => setShow(!show)} />;

  const form = (
    <View style={s.form}>
      {!wide && <Logo />}
      <View style={{ gap: 6 }}>
        <Text style={s.title}>{up ? 'Tạo tài khoản' : 'Chào mừng trở lại'}</Text>
        <Text style={s.sub}>{up ? 'Vài giây là xong, không cần thẻ thanh toán.' : 'Đăng nhập để xem việc của hôm nay.'}</Text>
      </View>

      <View style={s.tabs} accessibilityRole="tablist">
        {(['in', 'up'] as Mode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => switchMode(m)}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === m }}
            style={[s.tab, mode === m && s.tabOn]}
          >
            <Text style={[s.tabText, mode === m && s.tabTextOn]}>{m === 'in' ? 'Đăng nhập' : 'Đăng ký'}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ gap: 16 }}>
        <Field
          label="Email"
          placeholder="ban@email.com"
          value={email}
          onChangeText={setEmail}
          error={err('email')}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onSubmitEditing={submit}
        />
        <Field
          label="Mật khẩu"
          placeholder={up ? 'Ít nhất 6 ký tự' : 'Mật khẩu của bạn'}
          value={password}
          onChangeText={setPassword}
          error={err('password')}
          secureTextEntry={!show}
          autoComplete={up ? 'new-password' : 'current-password'}
          trailing={eye}
          onSubmitEditing={submit}
        />
        {up && (
          <Field
            label="Nhập lại mật khẩu"
            value={confirm}
            onChangeText={setConfirm}
            error={err('confirm')}
            secureTextEntry={!show}
            autoComplete="new-password"
            onSubmitEditing={submit}
          />
        )}
      </View>

      <Button title={up ? 'Tạo tài khoản' : 'Đăng nhập'} variant="primary" onPress={submit} loading={busy} disabled={busy} />

      <Text style={s.switch}>
        {up ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? '}
        <Text style={s.link} onPress={() => switchMode(up ? 'in' : 'up')} accessibilityRole="link">
          {up ? 'Đăng nhập' : 'Tạo tài khoản'}
        </Text>
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[s.fill, wide && { backgroundColor: color.surface }]}>
      <View style={s.split}>
        {wide && <Intro />}
        <KeyboardAvoidingView style={s.side} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
      <Text style={[s.brandName, light && { color: color.surface }]}>Việc & Nhật ký</Text>
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
          <Text style={[s.headline, !big && { fontSize: 28, lineHeight: 36 }]}>Biết hôm nay làm gì,{big ? '\n' : ' '}nhớ hôm qua đã làm gì.</Text>
          <Text style={s.lead}>Một nơi cho việc cần làm và nhật ký việc đã xong, đồng bộ giữa web và điện thoại.</Text>
        </View>

        {/* Short screens drop the preview so the panel never overflows. */}
        <View style={[s.preview, height < 820 && { display: 'none' }]} aria-hidden>
          <Text style={s.previewHead}>Hôm nay</Text>
          {PREVIEW.map(([title, meta, done], i) => (
            <View key={title} style={[s.previewRow, i === PREVIEW.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={[s.previewTick, done && { backgroundColor: color.success, borderColor: color.success }]}>
                {done && <Ionicons name="checkmark" size={12} color={color.surface} />}
              </View>
              <Text style={[s.previewTitle, done && s.previewDone]} numberOfLines={1}>{title}</Text>
              <Text style={[s.previewMeta, i === 2 && { color: color.danger }]}>{meta}</Text>
            </View>
          ))}
        </View>

        {/* What the app does, as a short definition list (no icon tiles). */}
        <View style={s.features}>
          {FEATURES.map(([, title, body]) => (
            <View key={title} style={s.feature}>
              <Text style={s.featureTitle}>{title}</Text>
              <Text style={s.featureBody}>{body}</Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={s.foot}>© {new Date().getFullYear()} Việc & Nhật ký</Text>
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
  // Sign in / sign up: a ruled tab row, the current tab underlined in ink.
  tabs: { flexDirection: 'row', borderBottomWidth: rule.hair, borderBottomColor: color.border },
  tab: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderBottomWidth: rule.bar, borderBottomColor: 'transparent', marginBottom: -rule.hair },
  tabOn: { borderBottomColor: color.borderStrong },
  tabText: { ...text.smMedium, color: color.muted },
  tabTextOn: { color: color.foreground, fontWeight: '600' },
  switch: { ...text.sm, color: color.muted, textAlign: 'center' },
  link: { color: color.foreground, fontWeight: '600', textDecorationLine: 'underline', textDecorationColor: color.primary },

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
