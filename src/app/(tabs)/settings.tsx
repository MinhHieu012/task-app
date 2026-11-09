import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { createElement, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Avatar, Button, Card, Choices, Field, InfoLine, Screen, useWide } from '@/components/ui';
import { color, radius, rule, text } from '@/constants/theme';
import { accentTokens, ACCENTS, DEFAULT_ACCENT, isHex } from '@/lib/accent';
import { fmtDay, localDay } from '@/lib/dates';
import { getLang, type Lang, LANGS, tr } from '@/lib/i18n';
import { getPref, restart, setPref } from '@/lib/prefs';
import { toast } from '@/lib/notify';
import { ok, supabase, useSession } from '@/lib/supabase';


export default function Settings() {
  const session = useSession();
  const wide = useWide();
  const [busy, setBusy] = useState(false);
  const user = session?.user;
  // Lifted here so the aside can preview the colour being picked before it is applied.
  const current = (getPref('accent') ?? DEFAULT_ACCENT).toLowerCase();
  const [hex, setHex] = useState(current);
  const [lang, setLangPick] = useState<Lang>(getLang());
  const accent = accentTokens(isHex(hex) ? hex : current).primary; // what the app will really use (light picks get darkened)
  const dirty = lang !== getLang() || accent !== current;

  // Both settings are device-local and applied together by one reload: styles and strings are fixed at startup.
  const apply = () => {
    setPref('lang', lang);
    setPref('accent', accent);
    restart();
  };

  const signOut = async () => {
    setBusy(true);
    // On success the root layout's Stack.Protected swaps to sign-in, unmounting this screen.
    if (!ok(await supabase.auth.signOut())) setBusy(false);
  };

  return (
    <Screen title={tr('Cài đặt')} sub={tr('Tài khoản của bạn')} back aside={<Preview hex={hex} />} maxWidth={1120}>
      {/* Wide: account and language side by side, so the form fills the room up to the preview. */}
      <View style={wide ? s.pair : s.stack}>
      <Card title={tr('Tài khoản')} style={wide ? s.half : undefined}>
        <View style={s.account}>
          <Avatar size={48} />
          <View style={s.info}>
            <Text style={s.email} numberOfLines={1}>{user?.email}</Text>
            {user && <Text style={s.meta}>{tr('Tham gia từ {date}', { date: fmtDay(localDay(new Date(user.created_at))) })}</Text>}
          </View>
        </View>
        <Button title={tr('Đăng xuất')} icon="log-out-outline" variant="danger" onPress={signOut} loading={busy} style={s.out} />
      </Card>

      <Card title={tr('Ngôn ngữ')} style={wide ? s.half : undefined}>
        <Choices<Lang> value={lang} onChange={setLangPick} options={LANGS} />
      </Card>
      </View>

      <PasswordCard email={user?.email ?? ''} wide={wide} />

      <AccentCard hex={hex} setHex={setHex} shown={accent} />

      <View style={s.applyRow}>
        <Text style={[s.meta, s.info]}>{tr('Đổi ngôn ngữ hoặc màu sẽ tải lại ứng dụng.')}</Text>
        {dirty && <Button title={tr('Hoàn tác')} variant="ghost" onPress={() => { setHex(current); setLangPick(getLang()); }} />}
        <Button title={tr('Áp dụng')} variant="primary" disabled={!dirty} onPress={apply} />
      </View>
    </Screen>
  );
}

function PasswordCard({ email, wide }: { email: string; wide: boolean }) {
  const [old, setOld] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [tried, setTried] = useState(false); // field errors only after the first submit, like sign-in
  const [busy, setBusy] = useState(false);
  const errors = {
    old: !old ? tr('Nhập mật khẩu.') : undefined,
    next: next.length < 6 ? tr('Cần ít nhất 6 ký tự.') : next === old ? tr('Mật khẩu mới phải khác mật khẩu cũ.') : undefined,
    again: again !== next ? tr('Mật khẩu nhập lại không khớp.') : undefined,
  };
  const err = (k: keyof typeof errors) => (tried ? errors[k] : undefined);

  const save = async () => {
    setTried(true);
    if (errors.old || errors.next || errors.again) return;
    setBusy(true);
    // Check the current password first, so an unlocked device alone cannot change it.
    const check = await supabase.auth.signInWithPassword({ email, password: old });
    if (check.error) toast(tr('Mật khẩu hiện tại chưa đúng.'), tr('Lỗi'), 'error');
    else if (ok(await supabase.auth.updateUser({ password: next }))) {
      toast(tr('Lần sau đăng nhập bằng mật khẩu mới.'), tr('Đã đổi mật khẩu'), 'success');
      setOld(''); setNext(''); setAgain(''); setTried(false);
    }
    setBusy(false);
  };

  const field = (label: string, value: string, set: (v: string) => void, error: string | undefined, auto: 'current-password' | 'new-password', placeholder: string) => (
    <View style={wide ? s.half : undefined}>
      <Field label={label} placeholder={placeholder} value={value} onChangeText={set} error={error} secureTextEntry autoComplete={auto} onSubmitEditing={save} />
    </View>
  );

  return (
    <Card title={tr('Đổi mật khẩu')}>
      {/* Password managers pair a password with the nearest text field before it; without this they took the
          top bar's quick add for the username and filled the email into it. Chrome's advice: a hidden username. */}
      {Platform.OS === 'web' && createElement('input', { type: 'text', name: 'username', autoComplete: 'username', value: email, readOnly: true, hidden: true })}
      <View style={wide ? s.pair : s.stack}>
        {field(tr('Mật khẩu hiện tại'), old, setOld, err('old'), 'current-password', tr('Mật khẩu đang dùng'))}
        {field(tr('Mật khẩu mới'), next, setNext, err('next'), 'new-password', tr('Ít nhất 6 ký tự'))}
        {field(tr('Nhập lại mật khẩu mới'), again, setAgain, err('again'), 'new-password', tr('Gõ lại mật khẩu mới'))}
      </View>
      <Button title={tr('Đổi mật khẩu')} icon="key-outline" onPress={save} loading={busy} disabled={busy} style={s.out} />
    </Card>
  );
}

// Picking only changes the preview; the Apply button at the bottom saves and reloads.
function AccentCard({ hex, setHex, shown }: { hex: string; setHex: (h: string) => void; shown: string }) {
  const valid = isHex(hex);
  const preset = ACCENTS.find((a) => a.hex === shown)?.hex ?? null;

  return (
    <Card title={tr('Màu chủ đạo')}>
      <Text style={s.label}>{tr('Màu gợi ý')}</Text>
      <Choices
        value={preset}
        onChange={setHex}
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
      </View>
    </Card>
  );
}

/** Wide screens: the picked colour on a few real pieces of the app, before the reload that applies it. */
function Preview({ hex }: { hex: string }) {
  const t = accentTokens(isHex(hex) ? hex : getPref('accent') ?? DEFAULT_ACCENT);
  const bars = [3, 5, 2, 6, 4, 7, 5];
  return (
    <>
      <View>
        <Text style={s.title}>{tr('Xem trước')}</Text>
        <View style={s.brand}>
          <View style={[s.icon, { backgroundColor: t.primary }]}>
            <Ionicons name="checkmark-done" size={28} color={color.primaryFg} />
          </View>
          <View style={s.info}>
            <Text style={s.email}>{tr('Việc & Nhật ký')}</Text>
            <Text style={s.meta}>{t.primary}</Text>
          </View>
        </View>
        <View style={s.sheet}>
          <View style={[s.nav, { backgroundColor: t.light }]}>
            <Ionicons name="sunny" size={18} color={t.primary} />
            <Text style={[s.navText, { color: t.primary, fontWeight: '600' }]}>{tr('Hôm nay')}</Text>
          </View>
          <View style={s.nav}>
            <Ionicons name="file-tray-outline" size={18} color={color.muted} />
            <Text style={s.navText}>{tr('Hộp thư')}</Text>
          </View>
          <View style={s.track}>
            <View style={[s.fill, { backgroundColor: t.primary }]} />
          </View>
          <View style={s.chart}>
            {bars.map((h, i) => (
              <View key={i} style={[s.bar, { height: h * 8, backgroundColor: i === bars.length - 1 ? t.primary : t.bar }]} />
            ))}
          </View>
          <View style={[s.btn, { backgroundColor: t.primary }]}>
            <Ionicons name="add" size={18} color={color.primaryFg} />
            <Text style={s.btnText}>{tr('Thêm việc')}</Text>
          </View>
        </View>
      </View>
      <View>
        <Text style={s.title}>{tr('Ứng dụng')}</Text>
        <InfoLine icon="information-circle-outline" label={tr('Phiên bản')} n={Constants.expoConfig?.version ?? '-'} />
        <InfoLine icon="language-outline" label={tr('Ngôn ngữ')} n={LANGS.find((l) => l.value === getLang())?.label ?? getLang()} last />
      </View>
    </>
  );
}

const s = StyleSheet.create({
  title: { ...text.h2, color: color.foreground, paddingBottom: 10, marginBottom: 16, borderBottomWidth: rule.bar, borderBottomColor: color.borderStrong },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  icon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sheet: { backgroundColor: color.background, borderRadius: radius.lg, borderWidth: rule.hair, borderColor: color.border, padding: 16, gap: 8 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 36, paddingHorizontal: 10, borderRadius: radius.ctl },
  navText: { ...text.sm, color: color.foreground },
  track: { height: 6, borderRadius: 3, backgroundColor: color.secondary, overflow: 'hidden', marginTop: 8 },
  fill: { width: '62%', height: 6, borderRadius: 3 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 64, marginTop: 8 },
  bar: { flex: 1, borderRadius: 3 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: radius.ctl, marginTop: 8 },
  btnText: { ...text.smMedium, fontWeight: '600', color: color.primaryFg },
  pair: { flexDirection: 'row', gap: 28, alignItems: 'stretch' },
  stack: { gap: 20 },
  half: { flex: 1, minWidth: 0 },
  applyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
