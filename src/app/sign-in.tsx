import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/AuthShell';
import { Button, Field, IconButton, TextLink } from '@/components/ui';
import { color, rule, text } from '@/constants/theme';
import { tr } from '@/lib/i18n';
import { toast } from '@/lib/notify';
import { ok, supabase } from '@/lib/supabase';

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
      const redirectTo = Platform.OS === 'web' ? `${window.location.origin}/reset-password` : Linking.createURL('/reset-password');
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
      {!forgot && <View style={s.tabs} accessibilityRole="tablist">
        {(['in', 'up'] as Mode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => switchMode(m)}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === m }}
            style={[s.tab, mode === m && s.tabOn]}
          >
            <Text style={[s.tabText, mode === m && s.tabTextOn]}>{m === 'in' ? tr('Đăng nhập') : tr('Đăng ký')}</Text>
          </Pressable>
        ))}
      </View>}

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

      <Text style={s.switch}>
        {forgot ? tr('Nhớ ra rồi? ') : up ? tr('Đã có tài khoản? ') : tr('Chưa có tài khoản? ')}
        <Text style={s.link} onPress={() => switchMode(mode === 'in' ? 'up' : 'in')} accessibilityRole="link">
          {mode === 'in' ? tr('Tạo tài khoản') : tr('Đăng nhập')}
        </Text>
      </Text>
    </AuthShell>
  );
}

const s = StyleSheet.create({
  // Sign in / sign up: a ruled tab row, the current tab underlined in ink.
  tabs: { flexDirection: 'row', borderBottomWidth: rule.hair, borderBottomColor: color.border },
  tab: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderBottomWidth: rule.bar, borderBottomColor: 'transparent', marginBottom: -rule.hair },
  tabOn: { borderBottomColor: color.borderStrong },
  tabText: { ...text.smMedium, color: color.muted },
  tabTextOn: { color: color.foreground, fontWeight: '600' },
  forgot: { alignSelf: 'flex-end', marginTop: -6 },
  switch: { ...text.sm, color: color.muted, textAlign: 'center' },
  link: { color: color.foreground, fontWeight: '600', textDecorationLine: 'underline', textDecorationColor: color.primary },
});
