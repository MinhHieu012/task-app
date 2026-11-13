import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { createElement, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { GoogleLogo } from '@/components/GoogleLogo';
import { Sheet } from '@/components/Sheet';
import { AppMark, Avatar, Button, Card, Choices, Field, ICON_INSET, InfoLine, ListGroup, ListItem, Screen, useWide } from '@/components/ui';
import { color, dark, radius, rule, text } from '@/constants/theme';
import { accentTokens, ACCENTS, DEFAULT_ACCENT, isHex } from '@/lib/accent';
import { localDay } from '@/lib/dates';
import { getLang, type Lang, LANGS, tr } from '@/lib/i18n';
import { getPref, restart, setPref } from '@/lib/prefs';
import { confirmAction, toast } from '@/lib/notify';
import type { UserIdentity } from '@supabase/supabase-js';

import { google, ok, supabase, useSession } from '@/lib/supabase';
type Theme = 'light' | 'dark' | 'system';

export default function Settings() {
  const session = useSession();
  const wide = useWide();
  const [busy, setBusy] = useState(false);
  const user = session?.user;
  // Lifted here so the aside can preview the colour being picked before it is applied.
  const current = (getPref('accent') ?? DEFAULT_ACCENT).toLowerCase();
  const [hex, setHex] = useState(current);
  const [lang, setLangPick] = useState<Lang>(getLang());
  const theme0 = (getPref('theme') ?? 'light') as Theme; // the same default as theme.ts
  const [theme, setTheme] = useState<Theme>(theme0);
  const [sheet, setSheet] = useState<'lang' | 'theme' | 'accent' | 'password' | 'google' | null>(null); // phones
  const googles = (user?.identities ?? []).filter((i) => i.provider === 'google');
  const accent = accentTokens(isHex(hex) ? hex : current).primary; // what the app will really use (light picks get darkened)
  const dirty = lang !== getLang() || accent !== current || theme !== theme0;

  // All three settings are device-local and applied together by one reload: styles and strings are fixed at startup.
  const apply = () => {
    setPref('lang', lang);
    setPref('accent', accent);
    setPref('theme', theme);
    restart();
  };

  const signOut = async () => {
    setBusy(true);
    // On success the root layout's Stack.Protected swaps to sign-in, unmounting this screen.
    if (!ok(await supabase.auth.signOut())) setBusy(false);
  };
  const reset = () => { setHex(current); setLangPick(getLang()); setTheme(theme0); };
  const themes: { value: Theme; label: string }[] = [
    { value: 'light', label: tr('Sáng') },
    { value: 'dark', label: tr('Tối') },
    { value: 'system', label: tr('Theo hệ thống') },
  ];

  if (!wide) {
    // Phones: the system settings pattern. Rows with a value and a chevron; each opens a small sheet. Picks
    // wait in a bar at the bottom until Áp dụng, since applying reloads the app.
    const preset = ACCENTS.find((a) => a.hex === accent);
    return (
      <Screen
        title={tr('Cài đặt')}
        back
        footer={dirty ? (
          <View style={s.applyBar}>
            <Text style={[s.meta, s.info]}>{tr('Áp dụng sẽ tải lại ứng dụng.')}</Text>
            <Button title={tr('Hoàn tác')} variant="ghost" onPress={reset} />
            <Button title={tr('Áp dụng')} variant="primary" onPress={apply} />
          </View>
        ) : undefined}
      >
        <ListGroup title={tr('Tài khoản')} inset={ICON_INSET}>
          <ListItem
            left={<View style={s.avatarCol}><Avatar size={36} /></View>}
            title={user?.email ?? ''}
            sub={user ? tr('Tham gia từ {date}', { date: localDay(new Date(user.created_at)).split('-').reverse().join('/') }) : undefined}
          />
          <ListItem icon="key-outline" title={tr('Đổi mật khẩu')} onPress={() => setSheet('password')} />
          <ListItem left={<View style={s.avatarCol}><GoogleLogo /></View>} title={tr('Tài khoản Google')} value={googles.length ? String(googles.length) : tr('Chưa liên kết')} onPress={() => setSheet('google')} />
        </ListGroup>

        <ListGroup title={tr('Giao diện')} inset={ICON_INSET}>
          <ListItem icon="language-outline" title={tr('Ngôn ngữ')} value={LANGS.find((l) => l.value === lang)?.label} onPress={() => setSheet('lang')} />
          <ListItem icon="contrast-outline" title={tr('Sáng / Tối')} value={themes.find((t) => t.value === theme)?.label} onPress={() => setSheet('theme')} />
          <ListItem
            icon="color-palette-outline"
            tint={accent}
            title={tr('Màu chủ đạo')}
            value={preset ? tr(preset.name) : accent}
            right={<View style={[s.dotBig, { backgroundColor: accent }]} />}
            onPress={() => setSheet('accent')}
          />
        </ListGroup>

        <ListGroup title={tr('Ứng dụng')} inset={ICON_INSET}>
          <ListItem icon="information-circle-outline" title={tr('Phiên bản')} value={Constants.expoConfig?.version ?? '-'} />
        </ListGroup>

        <ListGroup inset={ICON_INSET}>
          <ListItem icon="log-out-outline" title={busy ? tr('Đang đăng xuất…') : tr('Đăng xuất')} danger onPress={busy ? undefined : signOut} chevron={false} />
        </ListGroup>

        <Sheet visible={sheet === 'lang'} onClose={() => setSheet(null)} title={tr('Ngôn ngữ')}>
          <ListGroup>
            {LANGS.map((l) => <ListItem key={l.value} title={l.label} selected={lang === l.value} chevron={false} onPress={() => { setLangPick(l.value); setSheet(null); }} />)}
          </ListGroup>
        </Sheet>
        <Sheet visible={sheet === 'theme'} onClose={() => setSheet(null)} title={tr('Sáng / Tối')}>
          <ListGroup>
            {themes.map((t) => <ListItem key={t.value} title={t.label} selected={theme === t.value} chevron={false} onPress={() => { setTheme(t.value); setSheet(null); }} />)}
          </ListGroup>
        </Sheet>
        <Sheet visible={sheet === 'accent'} onClose={() => setSheet(null)} title={tr('Màu chủ đạo')} done={{ label: tr('Xong'), onPress: () => setSheet(null) }} scroll>
          <AccentCard hex={hex} setHex={setHex} shown={accent} bare />
        </Sheet>
        <Sheet visible={sheet === 'password'} onClose={() => setSheet(null)} title={tr('Đổi mật khẩu')} scroll>
          <PasswordCard email={user?.email ?? ''} wide={false} bare onDone={() => setSheet(null)} />
        </Sheet>
        <Sheet visible={sheet === 'google'} onClose={() => setSheet(null)} title={tr('Tài khoản Google')} scroll>
          <GoogleLine identities={user?.identities ?? []} bare />
        </Sheet>
      </Screen>
    );
  }

  return (
    <Screen title={tr('Cài đặt')} sub={tr('Tài khoản của bạn')} back aside={<Preview hex={hex} />} maxWidth={1120}>
      {/* Wide: account and language side by side, so the form fills the room up to the preview. */}
      <View style={wide ? s.pair : s.stack}>
      <Card title={tr('Tài khoản')} style={wide ? s.half : undefined}>
        <View style={s.account}>
          <Avatar size={48} />
          <View style={s.info}>
            <Text style={s.email} numberOfLines={1}>{user?.email}</Text>
            {user && <Text style={s.meta}>{tr('Tham gia từ {date}', { date: localDay(new Date(user.created_at)).split('-').reverse().join('/') } /* always with the year: a join date is read years later */)}</Text>}
          </View>
        </View>
        <GoogleLine identities={user?.identities ?? []} />
        <Button title={tr('Đăng xuất')} icon="log-out-outline" variant="danger" onPress={signOut} loading={busy} style={s.out} />
      </Card>

      <Card title={tr('Ngôn ngữ')} style={wide ? s.half : undefined}>
        <Choices<Lang> value={lang} onChange={setLangPick} options={LANGS} />
      </Card>
      </View>

      <PasswordCard email={user?.email ?? ''} wide={wide} />

      <Card title={tr('Giao diện')}>
        <Choices<Theme> value={theme} onChange={setTheme} options={themes} />
      </Card>

      <AccentCard hex={hex} setHex={setHex} shown={accent} />

      <View style={s.applyRow}>
        <Text style={[s.meta, s.info]}>{tr('Đổi ngôn ngữ, giao diện hoặc màu sẽ tải lại ứng dụng.')}</Text>
        {dirty && <Button title={tr('Hoàn tác')} variant="ghost" onPress={reset} />}
        <Button title={tr('Áp dụng')} variant="primary" disabled={!dirty} onPress={apply} />
      </View>
    </Screen>
  );
}

/** The Google accounts that sign in to this account, each with Gỡ (unlink); Liên kết adds one more. */
function GoogleLine({ identities, bare }: { identities: UserIdentity[]; bare?: boolean }) {
  const [busy, setBusy] = useState('');
  const googles = identities.filter((i) => i.provider === 'google');

  const unlink = async (i: UserIdentity) => {
    const email = i.identity_data?.email ?? '';
    if (!(await confirmAction(tr('Gỡ liên kết {email}?', { email }), tr('Tài khoản Google này sẽ không đăng nhập vào đây được nữa. Dữ liệu của bạn vẫn giữ nguyên.'), tr('Gỡ liên kết')))) return;
    setBusy(i.identity_id);
    // Supabase refuses to remove the last way in (single_identity_not_deletable).
    if (ok(await supabase.auth.unlinkIdentity(i))) {
      await supabase.auth.refreshSession(); // the user's identity list updates only with a new session
      toast(tr('Đã gỡ {email}.', { email }), tr('Đã gỡ liên kết'), 'success');
    }
    setBusy('');
  };

  return (
    // Stacked, so it reads on a phone: title, a line of help, the linked accounts as rows, then the button.
    <View style={[s.google, bare && s.bare]}>
      <View style={s.googleHead}>
        <GoogleLogo />
        <Text style={s.email}>{tr('Tài khoản Google')}</Text>
      </View>
      <Text style={s.meta}>
        {googles.length ? tr('Đăng nhập được bằng các tài khoản Google này.') : tr('Chưa liên kết. Liên kết để lần sau đăng nhập bằng Google.')}
      </Text>
      {googles.length > 0 && (
        <View style={s.linkedList}>
          {googles.map((i, n) => (
            <View key={i.identity_id} style={[s.linkedRow, n > 0 && s.linkedRule]}>
              <Ionicons name="checkmark-circle" size={16} color={color.success} />
              <Text style={[s.linkedEmail, s.info]} numberOfLines={1} ellipsizeMode="middle">{i.identity_data?.email}</Text>
              <Button title={tr('Gỡ')} icon="unlink-outline" variant="ghost" loading={busy === i.identity_id} disabled={!!busy} onPress={() => unlink(i)} />
            </View>
          ))}
        </View>
      )}
      <Button
        title={googles.length ? tr('Liên kết thêm') : tr('Liên kết')}
        icon="link-outline"
        loading={busy === 'link'}
        disabled={!!busy}
        onPress={async () => { setBusy('link'); await google(true, '/settings'); setBusy(''); }}
        style={s.linkBtn}
      />
    </View>
  );
}

function PasswordCard({ email, wide, bare, onDone }: { email: string; wide: boolean; bare?: boolean; onDone?: () => void }) {
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
      onDone?.();
    }
    setBusy(false);
  };

  const field = (label: string, value: string, set: (v: string) => void, error: string | undefined, auto: 'current-password' | 'new-password', placeholder: string) => (
    <View style={wide ? s.half : undefined}>
      <Field label={label} placeholder={placeholder} value={value} onChangeText={set} error={error} secureTextEntry autoComplete={auto} onSubmitEditing={save} />
    </View>
  );

  const body = (
    <>
      {/* Password managers pair a password with the nearest text field before it; without this they took the
          top bar's quick add for the username and filled the email into it. Chrome's advice: a hidden username. */}
      {Platform.OS === 'web' && createElement('input', { type: 'text', name: 'username', autoComplete: 'username', value: email, readOnly: true, hidden: true })}
      <View style={wide ? s.pair : s.stack}>
        {field(tr('Mật khẩu hiện tại'), old, setOld, err('old'), 'current-password', tr('Mật khẩu đang dùng'))}
        {field(tr('Mật khẩu mới'), next, setNext, err('next'), 'new-password', tr('Ít nhất 6 ký tự'))}
        {field(tr('Nhập lại mật khẩu mới'), again, setAgain, err('again'), 'new-password', tr('Gõ lại mật khẩu mới'))}
      </View>
      <Button title={tr('Đổi mật khẩu')} icon="key-outline" variant={bare ? 'primary' : 'outline'} onPress={save} loading={busy} disabled={busy} style={bare ? s.full : s.out} />
    </>
  );
  return bare ? <View style={s.stack}>{body}</View> : <Card title={tr('Đổi mật khẩu')}>{body}</Card>;
}

// Picking only changes the preview; the Apply button at the bottom saves and reloads.
function AccentCard({ hex, setHex, shown, bare }: { hex: string; setHex: (h: string) => void; shown: string; bare?: boolean }) {
  const valid = isHex(hex);
  const preset = ACCENTS.find((a) => a.hex === shown)?.hex ?? null;

  const body = (
    <>
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
    </>
  );
  return bare ? <View>{body}</View> : <Card title={tr('Màu chủ đạo')}>{body}</Card>;
}

/** Wide screens: the picked colour on a few real pieces of the app, before the reload that applies it. */
function Preview({ hex }: { hex: string }) {
  const t = accentTokens(isHex(hex) ? hex : getPref('accent') ?? DEFAULT_ACCENT, dark);
  const bars = [3, 5, 2, 6, 4, 7, 5];
  return (
    <>
      <View>
        <Text style={s.title}>{tr('Xem trước')}</Text>
        <View style={s.brand}>
          <View style={[s.icon, { backgroundColor: t.primary }]}>
            <AppMark size={32} tint={color.primaryFg} />
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
  bare: { marginTop: 0, paddingTop: 0, borderTopWidth: 0 },
  full: { marginTop: 4 },
  avatarCol: { width: 28, alignItems: 'center' },
  dotBig: { width: 18, height: 18, borderRadius: 9 },
  applyBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, borderTopWidth: rule.hair, borderTopColor: color.border },
  half: { flex: 1, minWidth: 0 },
  applyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  google: { gap: 6, marginTop: 20, paddingTop: 16, borderTopWidth: rule.hair, borderTopColor: color.border },
  googleHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  linkedList: { marginTop: 8, borderRadius: radius.ctl, borderWidth: rule.hair, borderColor: color.border, paddingLeft: 12, paddingRight: 4 },
  linkedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },
  linkedRule: { borderTopWidth: rule.hair, borderTopColor: color.border },
  linkedEmail: { ...text.sm, color: color.foreground },
  linkBtn: { alignSelf: 'flex-start', marginTop: 8 },
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
