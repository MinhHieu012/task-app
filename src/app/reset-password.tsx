import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Field, Screen } from '@/components/ui';
import { color, text } from '@/constants/theme';
import { tr } from '@/lib/i18n';
import { toast } from '@/lib/notify';
import { ok, supabase, useSession } from '@/lib/supabase';

// Where the "forgot password" email link lands. Outside the session guard: the link arrives signed out.
// Web: the client trades the ?code= for a recovery session itself (detectSessionInUrl). Native: the deep link
// brings the code here and we trade it. PKCE: only the device that asked for the link can use it.
export default function ResetPassword() {
  const session = useSession();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [failed, setFailed] = useState(false);
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

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
      toast(tr('Lần sau đăng nhập bằng mật khẩu mới.'), tr('Đã đổi mật khẩu'), 'success');
      router.replace('/');
    } else setBusy(false);
  };

  // Still trading the code (or the session is loading): show nothing rather than a flash of "link expired".
  const waiting = session === undefined || (!session && !failed && !!code && Platform.OS !== 'web');

  return (
    <Screen title={tr('Đặt mật khẩu mới')} sub={session?.user.email}>
      {waiting ? null : !session ? (
        <Card>
          <Text style={s.body}>{tr('Link đã hết hạn hoặc được mở trên máy khác. Gửi lại link từ màn đăng nhập.')}</Text>
          <Button title={tr('Về màn đăng nhập')} variant="primary" onPress={() => router.replace('/sign-in')} style={s.btn} />
        </Card>
      ) : (
        <Card>
          <View style={s.fields}>
            <Field label={tr('Mật khẩu mới')} placeholder={tr('Ít nhất 6 ký tự')} value={next} onChangeText={setNext} error={tried ? errors.next : undefined} secureTextEntry autoComplete="new-password" onSubmitEditing={save} />
            <Field label={tr('Nhập lại mật khẩu mới')} placeholder={tr('Gõ lại mật khẩu mới')} value={again} onChangeText={setAgain} error={tried ? errors.again : undefined} secureTextEntry autoComplete="new-password" onSubmitEditing={save} />
          </View>
          <Button title={tr('Lưu mật khẩu mới')} variant="primary" onPress={save} loading={busy} disabled={busy} style={s.btn} />
        </Card>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  body: { ...text.body, color: color.soft },
  fields: { gap: 16 },
  btn: { marginTop: 20, alignSelf: 'flex-start' },
});
