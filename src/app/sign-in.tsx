import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Field } from '@/components/ui';
import { color, text } from '@/constants/theme';
import { showError } from '@/lib/notify';
import { ok, supabase } from '@/lib/supabase';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'in' | 'up' | null>(null);
  const creds = { email: email.trim(), password };

  const signIn = async () => {
    setBusy('in');
    ok(await supabase.auth.signInWithPassword(creds));
    setBusy(null);
  };
  // ponytail: only for creating the owner's and the two test accounts; remove once sign-ups are disabled.
  const signUp = async () => {
    if (password.length < 6) return showError('Cần ít nhất 6 ký tự.', 'Mật khẩu quá ngắn');
    setBusy('up');
    const res = await supabase.auth.signUp(creds);
    setBusy(null);
    if (ok(res) && !res.data.session) showError('Mở link xác nhận trong email rồi đăng nhập.', 'Kiểm tra email');
  };

  return (
    <SafeAreaView style={s.fill}>
      <KeyboardAvoidingView style={s.center} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.box}>
          <Text style={s.title}>Đăng nhập</Text>
          <Card>
            <View style={s.form}>
              <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
              <Field label="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" onSubmitEditing={signIn} />
              <Button title="Đăng nhập" variant="primary" onPress={signIn} loading={busy === 'in'} disabled={!!busy} />
              <Button title="Tạo tài khoản" variant="ghost" onPress={signUp} loading={busy === 'up'} disabled={!!busy} />
            </View>
          </Card>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.background },
  center: { flex: 1, justifyContent: 'center', padding: 16 },
  box: { width: '100%', maxWidth: 400, alignSelf: 'center', gap: 16 },
  title: { ...text.xl, color: color.foreground, textAlign: 'center' },
  form: { gap: 16 },
});
