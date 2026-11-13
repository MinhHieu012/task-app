import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { tr } from '@core/i18n';

import { AuthService } from '../../core/auth.service';
import { NotifyService } from '../../core/notify.service';
import { TrPipe } from '../../core/prefs.service';
import { SupabaseService } from '../../core/supabase.service';
import { AuthShell } from './auth-shell';

/** Where the "forgot password" email lands. The client trades the ?code= for a recovery session itself (PKCE: only
 *  the browser that asked can use it). The form shows only after a valid link (PASSWORD_RECOVERY), never for a mere
 *  session: a used link opened again, or anyone signed in typing /reset-password, must not set a password without the old one. */
@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, TrPipe, AuthShell, RouterLink],
  template: `
    @if (auth.session() !== undefined) {
      @if (!auth.recovering() || !auth.session()) {
        <app-auth-shell [title]="'Link đã hết hạn' | tr" [sub]="'Link đã được dùng, đã hết hạn hoặc được mở trên máy khác. Gửi lại link từ màn đăng nhập.' | tr">
          @if (auth.session()) { <a class="btn btn-primary btn-block" routerLink="/">{{ 'Về trang Hôm nay' | tr }}</a> }
          @else { <a class="btn btn-primary btn-block" routerLink="/sign-in">{{ 'Về màn đăng nhập' | tr }}</a> }
        </app-auth-shell>
      } @else {
        <app-auth-shell [title]="'Đặt mật khẩu mới' | tr" [sub]="'Cho tài khoản {email}' | tr: { email: auth.user()?.email ?? '' }">
          <form [formGroup]="form" (ngSubmit)="save()" class="stack" novalidate>
            <input type="email" name="username" autocomplete="username" [value]="auth.user()?.email ?? ''" readonly hidden />
            <div class="field">
              <label for="next">{{ 'Mật khẩu mới' | tr }}</label>
              <input id="next" class="input" type="password" autocomplete="new-password" formControlName="next" [placeholder]="'Ít nhất 6 ký tự' | tr" [attr.aria-invalid]="tried() && !!errors().next || null" />
              <p class="error-text">{{ tried() ? errors().next : '' }}</p>
            </div>
            <div class="field">
              <label for="again">{{ 'Nhập lại mật khẩu mới' | tr }}</label>
              <input id="again" class="input" type="password" autocomplete="new-password" formControlName="again" [placeholder]="'Gõ lại mật khẩu mới' | tr" [attr.aria-invalid]="tried() && !!errors().again || null" />
              <p class="error-text">{{ tried() ? errors().again : '' }}</p>
            </div>
            <button type="submit" class="btn btn-primary btn-block" [disabled]="busy()" [attr.aria-busy]="busy()">{{ 'Lưu mật khẩu mới' | tr }}</button>
          </form>
        </app-auth-shell>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPassword {
  readonly auth = inject(AuthService);
  private sb = inject(SupabaseService);
  private notify = inject(NotifyService);
  private router = inject(Router);
  readonly tried = signal(false);
  readonly busy = signal(false);
  readonly form = new FormGroup({ next: new FormControl('', { nonNullable: true }), again: new FormControl('', { nonNullable: true }) });
  private values = signal(this.form.getRawValue());
  readonly errors = computed(() => ({
    next: this.values().next.length < 6 ? tr('Cần ít nhất 6 ký tự.') : '',
    again: this.values().again !== this.values().next ? tr('Mật khẩu nhập lại không khớp.') : '',
  }));

  constructor() {
    this.form.valueChanges.subscribe(() => this.values.set(this.form.getRawValue()));
  }

  async save() {
    this.tried.set(true);
    if (this.errors().next || this.errors().again) return;
    this.busy.set(true);
    if (this.sb.ok(await this.sb.client.auth.updateUser({ password: this.values().next }))) {
      this.auth.recovering.set(false); // one link, one change
      this.notify.toast(tr('Lần sau đăng nhập bằng mật khẩu mới.'), tr('Đã đổi mật khẩu'), 'success');
      this.router.navigateByUrl('/');
    } else this.busy.set(false);
  }
}
