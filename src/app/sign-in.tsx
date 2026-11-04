import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { showError } from '@/lib/notify';
import { ok, supabase } from '@/lib/supabase';

// Temporary UI; rebuilt with the design system in U8.
export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const creds = { email: email.trim(), password };

  const signIn = async () => ok(await supabase.auth.signInWithPassword(creds));
  // ponytail: only for creating the owner's and the two test accounts; remove once sign-ups are disabled.
  const signUp = async () => {
    if (password.length < 6) return showError('Cần ít nhất 6 ký tự.', 'Mật khẩu quá ngắn');
    const res = await supabase.auth.signUp(creds);
    if (ok(res) && !res.data.session) showError('Mở link xác nhận trong email rồi đăng nhập.', 'Kiểm tra email');
  };

  return (
    <SafeAreaView style={styles.fill}>
      <View style={styles.form}>
        <Text style={styles.title}>Đăng nhập</Text>
        <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
        <TextInput style={styles.input} placeholder="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" onSubmitEditing={signIn} />
        <Button title="Đăng nhập" onPress={signIn} />
        <Button title="Tạo tài khoản" onPress={signUp} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  form: { padding: 24, gap: 12, maxWidth: 420, width: '100%', alignSelf: 'center' },
  title: { fontSize: 24, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
});
