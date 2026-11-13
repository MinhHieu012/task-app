import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { tr } from '@core/i18n';

import { NotifyService } from '../../core/notify.service';
import { TrPipe } from '../../core/prefs.service';
import { SupabaseService } from '../../core/supabase.service';
import { Icon } from '../../shared/icon';
import { AuthShell } from './auth-shell';

type Mode = 'in' | 'up' | 'forgot';

/** Email + password sign in, sign up, the reset-link request, and Google. Field errors show after the first submit. */
@Component({
  selector: 'app-sign-in',
  imports: [ReactiveFormsModule, TrPipe, Icon, AuthShell],
  templateUrl: './sign-in.html',
  styles: `
    form { display: flex; flex-direction: column; gap: 16px; }
    .forgot { align-self: flex-end; margin-top: -8px; }
    .or { display: flex; align-items: center; gap: 12px; color: var(--color-muted); font-size: var(--text-sm); }
    .or::before, .or::after { content: ''; flex: 1; height: 1px; background: var(--color-rule); }
    .switch { text-align: center; font-size: var(--text-sm); color: var(--color-muted); }
    .seg { width: 100%; } .seg button { flex: 1; }
    .g { width: 18px; height: 18px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignIn {
  private sb = inject(SupabaseService);
  private notify = inject(NotifyService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly mode = signal<Mode>('in');
  readonly show = signal(false);
  readonly tried = signal(false);
  readonly busy = signal(false);
  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true }),
    password: new FormControl('', { nonNullable: true }),
    confirm: new FormControl('', { nonNullable: true }),
  });
  private values = signal(this.form.getRawValue());
  readonly errors = computed(() => {
    const { email, password, confirm } = this.values();
    const up = this.mode() === 'up';
    return {
      email: !email.trim() ? tr('Nhập email.') : !/^\S+@\S+\.\S+$/.test(email.trim()) ? tr('Email chưa đúng dạng.') : '',
      password: this.mode() === 'forgot' ? '' : !password ? tr('Nhập mật khẩu.') : up && password.length < 6 ? tr('Cần ít nhất 6 ký tự.') : '',
      confirm: up && confirm !== password ? tr('Mật khẩu nhập lại không khớp.') : '',
    };
  });
  readonly title = computed(() => (this.mode() === 'forgot' ? tr('Quên mật khẩu') : this.mode() === 'up' ? tr('Tạo tài khoản') : tr('Chào mừng trở lại')));
  readonly sub = computed(() =>
    this.mode() === 'forgot' ? tr('Nhập email của bạn, mình gửi link để đặt mật khẩu mới.') : this.mode() === 'up' ? tr('Vài giây là xong, không cần thẻ thanh toán.') : tr('Đăng nhập để xem việc của hôm nay.'));

  constructor() {
    this.form.valueChanges.subscribe(() => this.values.set(this.form.getRawValue()));
  }

  err(k: 'email' | 'password' | 'confirm') {
    return this.tried() ? this.errors()[k] : '';
  }

  switchTo(m: Mode) {
    this.mode.set(m);
    this.tried.set(false);
    this.form.controls.confirm.setValue('');
  }

  async submit() {
    this.tried.set(true);
    const e = this.errors();
    if (e.email || e.password || e.confirm) {
      setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    const auth = this.sb.client.auth;
    const creds = { email: this.values().email.trim(), password: this.values().password };
    this.busy.set(true);
    if (this.mode() === 'forgot') {
      // The link lands on /reset-password, signed in for recovery. Its URL must be in Supabase's Redirect URLs.
      if (this.sb.ok(await auth.resetPasswordForEmail(creds.email, { redirectTo: this.sb.redirect('/reset-password') }))) {
        this.notify.toast(tr('Mở link trong email để đặt mật khẩu mới.'), tr('Kiểm tra email'), 'success');
        this.switchTo('in');
      }
    } else if (this.mode() === 'in') {
      this.sb.ok(await auth.signInWithPassword(creds)); // the app root leaves this page once the session is in
    } else {
      // ponytail: sign-up stays open for the owner and test accounts; hide this tab once sign-ups are disabled.
      const res = await auth.signUp(creds);
      if (this.sb.ok(res) && !res.data.session) {
        this.notify.toast(tr('Mở link xác nhận trong email rồi đăng nhập.'), tr('Kiểm tra email'));
        this.switchTo('in');
      }
    }
    this.busy.set(false);
  }

  google() {
    this.sb.google(false);
  }
}
