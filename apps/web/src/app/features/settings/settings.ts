import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import type { UserIdentity } from '@supabase/supabase-js';
import { accentTokens, ACCENTS, isHex } from '@core/accent';
import { localDay } from '@core/dates';
import { type Lang, LANGS, tr } from '@core/i18n';

import { AuthService } from '../../core/auth.service';
import { NotifyService } from '../../core/notify.service';
import { PrefsService, type Theme, TrPipe } from '../../core/prefs.service';
import { SupabaseService } from '../../core/supabase.service';
import { Icon } from '../../shared/icon';

/** Account (Google links, sign out, password), and the device-local look: theme and accent apply at once,
 *  the language reloads the page. */
@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule, TrPipe, Icon],
  templateUrl: './settings.html',
  styles: `
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items: start; }
    .full { grid-column: 1 / -1; }
    .account { display: flex; align-items: center; gap: 14px; }
    .avatar { width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; background: var(--color-accent-wash); color: var(--color-accent); font-weight: 600; font-size: var(--text-lg); flex: none; }
    .linked { display: flex; align-items: center; gap: 10px; min-height: 44px; border-bottom: var(--rule-hair) solid var(--color-rule); font-size: var(--text-sm); }
    .linked > app-icon { color: var(--color-success); }
    .g { width: 18px; height: 18px; }
    .pw { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .custom { display: flex; align-items: center; gap: 8px; max-width: 260px; }
    .custom input[type='color'] { flex: none; width: var(--control); height: var(--control); padding: 0; border: 0; border-radius: var(--radius-ctl); background: none; cursor: pointer; }
    .custom input[type='color']::-webkit-color-swatch-wrapper { padding: 0; }
    .custom input[type='color']::-webkit-color-swatch { border: var(--rule-hair) solid var(--color-edge); border-radius: var(--radius-ctl); }
    .custom input[type='color']::-moz-color-swatch { border: var(--rule-hair) solid var(--color-edge); border-radius: var(--radius-ctl); }    .swatch { width: 10px; height: 10px; border-radius: 50%; }
    @media (max-width: 60rem) { .grid, .pw { grid-template-columns: minmax(0, 1fr); } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  readonly auth = inject(AuthService);
  readonly prefs = inject(PrefsService);
  private sb = inject(SupabaseService);
  private notify = inject(NotifyService);
  readonly langs = LANGS;
  readonly accents = ACCENTS;
  readonly themes: [Theme, string][] = [['light', 'Sáng'], ['dark', 'Tối'], ['system', 'Theo hệ thống']];
  readonly user = this.auth.user;
  readonly joined = computed(() => (this.user() ? localDay(new Date(this.user()!.created_at)).split('-').reverse().join('/') : ''));
  readonly googles = computed(() => (this.user()?.identities ?? []).filter((i) => i.provider === 'google'));
  readonly busy = signal('');
  readonly hex = signal(this.prefs.accent());
  readonly hexValid = computed(() => isHex(this.hex()));
  /** What the app really uses: a light pick is darkened until white text on it reads. */
  readonly darkened = computed(() => this.hexValid() && accentTokens(this.hex()).primary !== this.hex().trim().toLowerCase());

  readonly pw = new FormGroup({ old: new FormControl('', { nonNullable: true }), next: new FormControl('', { nonNullable: true }), again: new FormControl('', { nonNullable: true }) });
  private pwv = signal(this.pw.getRawValue());
  readonly tried = signal(false);
  readonly pwErr = computed(() => {
    const { old, next, again } = this.pwv();
    return {
      old: !old ? tr('Nhập mật khẩu.') : '',
      next: next.length < 6 ? tr('Cần ít nhất 6 ký tự.') : next === old ? tr('Mật khẩu mới phải khác mật khẩu cũ.') : '',
      again: again !== next ? tr('Mật khẩu nhập lại không khớp.') : '',
    };
  });

  constructor() {
    this.pw.valueChanges.subscribe(() => this.pwv.set(this.pw.getRawValue()));
  }

  pick(hex: string) {
    this.hex.set(hex);
    if (isHex(hex)) this.prefs.setAccent(accentTokens(hex).primary);
  }
  setLang(l: Lang) {
    if (l !== this.prefs.lang) this.prefs.setLang(l);
  }

  async signOut() {
    this.busy.set('out');
    // On success the app root sends the page to sign-in.
    if (!this.sb.ok(await this.sb.client.auth.signOut())) this.busy.set('');
  }

  async link() {
    this.busy.set('link');
    await this.sb.google(true, '/settings');
    this.busy.set('');
  }
  async unlink(i: UserIdentity) {
    const email = String(i.identity_data?.['email'] ?? '');
    if (!(await this.notify.confirm(tr('Gỡ liên kết {email}?', { email }), tr('Tài khoản Google này sẽ không đăng nhập vào đây được nữa. Dữ liệu của bạn vẫn giữ nguyên.'), tr('Gỡ liên kết')))) return;
    this.busy.set(i.identity_id);
    // Supabase refuses to remove the last way in (single_identity_not_deletable).
    if (this.sb.ok(await this.sb.client.auth.unlinkIdentity(i))) {
      await this.sb.client.auth.refreshSession(); // the identity list updates only with a new session
      this.notify.toast(tr('Đã gỡ {email}.', { email }), tr('Đã gỡ liên kết'), 'success');
    }
    this.busy.set('');
  }
  googleEmail(i: UserIdentity) {
    return String(i.identity_data?.['email'] ?? '');
  }

  async changePassword() {
    this.tried.set(true);
    const e = this.pwErr();
    if (e.old || e.next || e.again) return;
    this.busy.set('pw');
    const { old, next } = this.pwv();
    // Check the current password first, so an unlocked device alone cannot change it.
    const check = await this.sb.client.auth.signInWithPassword({ email: this.user()?.email ?? '', password: old });
    if (check.error) this.notify.error(tr('Mật khẩu hiện tại chưa đúng.'));
    else if (this.sb.ok(await this.sb.client.auth.updateUser({ password: next }))) {
      this.notify.toast(tr('Lần sau đăng nhập bằng mật khẩu mới.'), tr('Đã đổi mật khẩu'), 'success');
      this.pw.reset();
      this.tried.set(false);
    }
    this.busy.set('');
  }
}
