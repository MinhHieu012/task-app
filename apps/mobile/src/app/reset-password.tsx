import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AuthShell } from '@/components/AuthShell';
import { Button, Field, IconButton } from '@/components/ui';
import { tr } from '@/lib/i18n';
import { toast } from '@/lib/notify';
import { endRecovery, ok, supabase, useRecovery, useSession } from '@/lib/supabase';

// Where the "forgot password" email link lands. Outside the session guard: the link arrives signed out.
// Web: the client trades the ?code= for a recovery session itself (detectSessionInUrl). Native: the deep link
// brings the code here and we trade it. PKCE: only the device that asked for the link can use it.
// The form shows only after a valid link (useRecovery), never for a mere session: a used link opened again,
// or anyone signed in typing /reset-password, must not get to set a password without the old one.
export default function ResetPassword() {
  const session = useSession();
  const recovering = useRecovery();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [failed, setFailed] = useState(false);
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web' || !code) return;
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => error && setFailed(true));
  }, [code]);

  const errors = {
    next: next.length < 6 ? tr('Cần ít nhất 6 ký tự.') : undefined,
    again: again !== next ? tr('Mật khẩu nhập lại không khớp.') : undefined,
  };

  const save = async () => {
    setTried(true);
    if (errors.next || errors.again) return;
    setBusy(true);
    if (ok(await supabase.auth.updateUser({ password: next }))) {
      endRecovery();
      toast(tr('Lần sau đăng nhập bằng mật khẩu mới.'), tr('Đã đổi mật khẩu'), 'success');
      router.replace('/');
    } else setBusy(false);
  };

  const eye = <IconButton icon={show ? 'eye-off-outline' : 'eye-outline'} label={show ? tr('Ẩn mật khẩu') : tr('Hiện mật khẩu')} onPress={() => setShow(!show)} />;

  // Still trading the code (or the session is loading): show nothing rather than a flash of "link expired".
  const waiting = session === undefined || (!recovering && !failed && !!code && Platform.OS !== 'web');

  if (waiting) return null;
  return !recovering || !session ? (
    <AuthShell title={tr('Link đã hết hạn')} sub={tr('Link đã được dùng, đã hết hạn hoặc được mở trên máy khác. Gửi lại link từ màn đăng nhập.')}>
      {session ? (
        <Button title={tr('Về trang Hôm nay')} variant="primary" onPress={() => router.replace('/')} />
      ) : (
        <Button title={tr('Về màn đăng nhập')} variant="primary" onPress={() => router.replace('/sign-in')} />
      )}
    </AuthShell>
  ) : (
    <AuthShell title={tr('Đặt mật khẩu mới')} sub={tr('Cho tài khoản {email}', { email: session.user.email ?? '' })}>
      <View style={s.fields}>
        <Field label={tr('Mật khẩu mới')} placeholder={tr('Ít nhất 6 ký tự')} value={next} onChangeText={setNext} error={tried ? errors.next : undefined} secureTextEntry={!show} autoComplete="new-password" trailing={eye} onSubmitEditing={save} />
        <Field label={tr('Nhập lại mật khẩu mới')} placeholder={tr('Gõ lại mật khẩu mới')} value={again} onChangeText={setAgain} error={tried ? errors.again : undefined} secureTextEntry={!show} autoComplete="new-password" onSubmitEditing={save} />
      </View>
      <Button title={tr('Lưu mật khẩu mới')} variant="primary" onPress={save} loading={busy} disabled={busy} />
    </AuthShell>
  );
}

const s = StyleSheet.create({
  fields: { gap: 16 },
});
