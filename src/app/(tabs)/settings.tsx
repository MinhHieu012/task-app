import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar, Button, Card, Screen } from '@/components/ui';
import { color, text } from '@/constants/theme';
import { fmtDay, localDay } from '@/lib/dates';
import { ok, supabase, useSession } from '@/lib/supabase';

export default function Settings() {
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const user = session?.user;

  const signOut = async () => {
    setBusy(true);
    // On success the root layout's Stack.Protected swaps to sign-in, unmounting this screen.
    if (!ok(await supabase.auth.signOut())) setBusy(false);
  };

  return (
    <Screen title="Cài đặt" sub="Tài khoản của bạn" back>
      <Card title="Tài khoản">
        <View style={s.account}>
          <Avatar size={48} />
          <View style={s.info}>
            <Text style={s.email} numberOfLines={1}>{user?.email}</Text>
            {user && <Text style={s.meta}>Tham gia từ {fmtDay(localDay(new Date(user.created_at)))}</Text>}
          </View>
        </View>
        <Button title="Đăng xuất" icon="log-out-outline" variant="danger" onPress={signOut} loading={busy} style={s.out} />
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  account: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  info: { flex: 1, minWidth: 0 },
  email: { ...text.smMedium, color: color.foreground },
  meta: { ...text.meta, color: color.muted, marginTop: 2 },
  out: { marginTop: 20, alignSelf: 'flex-start' },
});
