import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/AuthShell';
import { animate, Button, FadeIn, Field, IconButton, reducedMotion, TextLink } from '@/components/ui';
import { color, duration, rule, text } from '@/constants/theme';
import { tr } from '@/lib/i18n';
import { toast } from '@/lib/notify';
import { authRedirect, google, ok, supabase } from '@/lib/supabase';

type Mode = 'in' | 'up' | 'forgot';

export default function SignIn() {
  const [mode, setMode] = useState<Mode>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [tried, setTried] = useState(false); // show field errors only after the first submit
  const [busy, setBusy] = useState(false);
  const up = mode === 'up';
  const forgot = mode === 'forgot';

  // The tab bar's underline slides to the chosen tab (jumps under reduce motion: it is movement).
  const [tabsWidth, setTabsWidth] = useState(0);
  const [bar] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const to = up ? tabsWidth / 2 : 0;
    if (reducedMotion()) return bar.setValue(to);
    const a = animate(bar, to, duration.base);
    a.start();
    return () => a.stop();
  }, [up, tabsWidth, bar]);

  const errors = {
    email: !email.trim() ? tr('Nhập email.') : !/^\S+@\S+\.\S+$/.test(email.trim()) ? tr('Email chưa đúng dạng.') : undefined,
    password: forgot ? undefined : !password ? tr('Nhập mật khẩu.') : up && password.length < 6 ? tr('Cần ít nhất 6 ký tự.') : undefined,
    confirm: up && confirm !== password ? tr('Mật khẩu nhập lại không khớp.') : undefined,
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
    if (forgot) {
      // The link lands on /reset-password, signed in for recovery. Its URL must be in Supabase's redirect allow-list.
      const redirectTo = authRedirect('/reset-password');
      if (ok(await supabase.auth.resetPasswordForEmail(creds.email, { redirectTo }))) {
        toast(tr('Mở link trong email để đặt mật khẩu mới.'), tr('Kiểm tra email'), 'success');
        switchMode('in');
      }
    } else if (!up) {
      ok(await supabase.auth.signInWithPassword(creds));
    } else {
      // ponytail: sign-up stays open for the owner and test accounts; hide this tab once sign-ups are disabled.
      const res = await supabase.auth.signUp(creds);
      if (ok(res) && !res.data.session) {
        toast(tr('Mở link xác nhận trong email rồi đăng nhập.'), tr('Kiểm tra email'));
        switchMode('in');
      }
    }
    setBusy(false);
  };

  const eye = <IconButton icon={show ? 'eye-off-outline' : 'eye-outline'} label={show ? tr('Ẩn mật khẩu') : tr('Hiện mật khẩu')} onPress={() => setShow(!show)} />;

  return (
    <AuthShell
      title={forgot ? tr('Quên mật khẩu') : up ? tr('Tạo tài khoản') : tr('Chào mừng trở lại')}
      sub={forgot ? tr('Nhập email của bạn, mình gửi link để đặt mật khẩu mới.') : up ? tr('Vài giây là xong, không cần thẻ thanh toán.') : tr('Đăng nhập để xem việc của hôm nay.')}
    >
      {!forgot && <View style={s.tabs} accessibilityRole="tablist" onLayout={(e) => setTabsWidth(e.nativeEvent.layout.width)}>
        {(['in', 'up'] as Mode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => switchMode(m)}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === m }}
            style={s.tab}
          >
            <Text style={[s.tabText, mode === m && s.tabTextOn]}>{m === 'in' ? tr('Đăng nhập') : tr('Đăng ký')}</Text>
          </Pressable>
        ))}
        <Animated.View style={[s.bar, { transform: [{ translateX: bar }] }]} />
      </View>}

      {/* Keyed by mode: the form fades and rises in on each switch. Values live up here, so nothing typed is lost. */}
      <FadeIn key={mode} style={s.form}>
      <View style={{ gap: 16 }}>
        <Field
          label="Email"
          placeholder={tr('ten@vidu.com')}
          value={email}
          onChangeText={setEmail}
          error={err('email')}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onSubmitEditing={submit}
        />
        {!forgot && <Field
          label={tr('Mật khẩu')}
          placeholder={up ? tr('Ít nhất 6 ký tự') : tr('Mật khẩu của bạn')}
          value={password}
          onChangeText={setPassword}
          error={err('password')}
          secureTextEntry={!show}
          autoComplete={up ? 'new-password' : 'current-password'}
          trailing={eye}
          onSubmitEditing={submit}
        />}
        {mode === 'in' && (
          <View style={s.forgot}>
            <TextLink label={tr('Quên mật khẩu?')} onPress={() => switchMode('forgot')} />
          </View>
        )}
        {up && (
          <Field
            label={tr('Nhập lại mật khẩu')}
            placeholder={tr('Gõ lại mật khẩu ở trên')}
            value={confirm}
            onChangeText={setConfirm}
            error={err('confirm')}
            secureTextEntry={!show}
            autoComplete="new-password"
            onSubmitEditing={submit}
          />
        )}
      </View>

      <Button title={forgot ? tr('Gửi link đặt lại') : up ? tr('Tạo tài khoản') : tr('Đăng nhập')} variant="primary" onPress={submit} loading={busy} disabled={busy} />

      {!forgot && (
        <>
          <View style={s.or}>
            <View style={s.line} />
            <Text style={s.switch}>{tr('hoặc')}</Text>
            <View style={s.line} />
          </View>
          {/* Signs in, or makes the account on first use: one button for both tabs. */}
          <Button title={tr('Tiếp tục với Google')} icon="logo-google" onPress={() => google(false)} />
        </>
      )}

      <View style={s.switchRow}>
        <Text style={s.switch}>{forgot ? tr('Nhớ ra rồi? ') : up ? tr('Đã có tài khoản? ') : tr('Chưa có tài khoản? ')}</Text>
        {/* The shared link, so it hovers like "Quên mật khẩu?". */}
        <TextLink label={mode === 'in' ? tr('Tạo tài khoản') : tr('Đăng nhập')} onPress={() => switchMode(mode === 'in' ? 'up' : 'in')} />
      </View>
      </FadeIn>
    </AuthShell>
  );
}

const s = StyleSheet.create({
  // Sign in / sign up: a ruled tab row, the current tab underlined in ink by a bar that slides between them.
  tabs: { flexDirection: 'row', borderBottomWidth: rule.hair, borderBottomColor: color.border },
  tab: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', left: 0, bottom: -rule.hair, width: '50%', height: rule.bar, backgroundColor: color.borderStrong },
  // The shell spaces its children; the faded block keeps that spacing inside.
  form: { gap: 24 },
  tabText: { ...text.smMedium, color: color.muted },
  tabTextOn: { color: color.foreground, fontWeight: '600' },
  forgot: { alignSelf: 'flex-end', marginTop: -6 },
  switchRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: 4 },
  switch: { ...text.sm, color: color.muted },
  or: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: -8 },
  line: { flex: 1, height: rule.hair, backgroundColor: color.border },
});
