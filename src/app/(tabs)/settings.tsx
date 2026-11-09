import { createElement, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Avatar, Button, Card, Choices, Field, Screen } from '@/components/ui';
import { color, radius, text } from '@/constants/theme';
import { accentTokens, ACCENTS, DEFAULT_ACCENT, isHex } from '@/lib/accent';
import { fmtDay, localDay } from '@/lib/dates';
import { getLang, type Lang, LANGS, tr } from '@/lib/i18n';
import { getPref, restart, setPref } from '@/lib/prefs';
import { ok, supabase, useSession } from '@/lib/supabase';

// Both settings are device-local and applied by reloading: styles and strings are fixed at startup.
const apply = (key: string, value: string) => {
  setPref(key, value);
  restart();
};

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
    <Screen title={tr('Cài đặt')} sub={tr('Tài khoản của bạn')} back>
      <Card title={tr('Tài khoản')}>
        <View style={s.account}>
          <Avatar size={48} />
          <View style={s.info}>
            <Text style={s.email} numberOfLines={1}>{user?.email}</Text>
            {user && <Text style={s.meta}>{tr('Tham gia từ {date}', { date: fmtDay(localDay(new Date(user.created_at))) })}</Text>}
          </View>
        </View>
        <Button title={tr('Đăng xuất')} icon="log-out-outline" variant="danger" onPress={signOut} loading={busy} style={s.out} />
      </Card>

      <Card title={tr('Ngôn ngữ')}>
        <Choices<Lang> value={getLang()} onChange={(l) => l !== getLang() && apply('lang', l)} options={LANGS} />
      </Card>

      <AccentCard />
      <Text style={s.meta}>{tr('Đổi ngôn ngữ hoặc màu sẽ tải lại ứng dụng.')}</Text>
    </Screen>
  );
}

function AccentCard() {
  const current = (getPref('accent') ?? DEFAULT_ACCENT).toLowerCase();
  const [hex, setHex] = useState(current);
  const valid = isHex(hex);
  const shown = accentTokens(valid ? hex : current).primary; // what the app will really use (light picks get darkened)
  const preset = ACCENTS.find((a) => a.hex === current)?.hex ?? null;

  return (
    <Card title={tr('Màu chủ đạo')}>
      <Text style={s.label}>{tr('Màu gợi ý')}</Text>
      <Choices
        value={preset}
        onChange={(v) => v !== current && apply('accent', v)}
        options={ACCENTS.map((a) => ({ value: a.hex as string, label: tr(a.name), dot: a.hex }))}
      />

      <Text style={[s.label, s.gap]}>{tr('Tự chọn')}</Text>
      <View style={s.custom}>
        {Platform.OS === 'web' ? (
          // The browser's own colour picker; native gets the hex field only.
          createElement('input', {
            type: 'color',
            value: shown,
            onChange: (e: { target: { value: string } }) => setHex(e.target.value),
            'aria-label': tr('Màu chủ đạo'),
            style: { width: 44, height: 44, padding: 0, border: 'none', borderRadius: radius.ctl, background: 'none', cursor: 'pointer' },
          })
        ) : (
          <View style={[s.swatch, { backgroundColor: shown }]} />
        )}
        <View style={s.hexField}>
          <Field
            value={hex}
            onChangeText={setHex}
            placeholder="#b04a24"
            aria-label={tr('Mã màu')}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={7}
            error={hex && !valid ? tr('Mã màu dạng #RRGGBB') : undefined}
            hint={valid && shown !== hex.trim().toLowerCase() ? tr('Màu quá sáng cho chữ trắng nên sẽ được làm đậm hơn một chút.') : undefined}
          />
        </View>
        <Button title={tr('Áp dụng')} variant="primary" disabled={!valid || shown === current} onPress={() => apply('accent', shown)} />
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  account: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  info: { flex: 1, minWidth: 0 },
  email: { ...text.smMedium, color: color.foreground },
  meta: { ...text.meta, color: color.muted, marginTop: 2 },
  out: { marginTop: 20, alignSelf: 'flex-start' },
  label: { ...text.smMedium, color: color.soft, marginBottom: 8 },
  gap: { marginTop: 20 },
  custom: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  swatch: { width: 44, height: 44, borderRadius: radius.ctl },
  hexField: { flex: 1, minWidth: 0 },
});
