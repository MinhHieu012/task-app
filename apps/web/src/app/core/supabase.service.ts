import { inject, Injectable } from '@angular/core';
import { createClient } from '@supabase/supabase-js';
import { tr } from '@core/i18n';

import { environment } from '../../environments/environment';
import { NotifyService } from './notify.service';

// Supabase auth errors arrive in English whatever the app language; the common ones by code, through tr().
const AUTH_ERRORS: Record<string, string> = {
  same_password: 'Mật khẩu mới phải khác mật khẩu cũ.',
  invalid_credentials: 'Email hoặc mật khẩu chưa đúng.',
  email_not_confirmed: 'Email chưa được xác nhận. Mở link trong email trước rồi đăng nhập.',
  user_already_exists: 'Email này đã có tài khoản. Hãy đăng nhập.',
  email_exists: 'Email này đã có tài khoản. Hãy đăng nhập.',
  weak_password: 'Mật khẩu quá yếu. Chọn mật khẩu dài hơn hoặc khó đoán hơn.',
  email_address_invalid: 'Email chưa đúng dạng.',
  over_email_send_rate_limit: 'Đã gửi quá nhiều email trong một giờ. Đợi một lúc rồi thử lại.',
  over_request_rate_limit: 'Thử quá nhiều lần. Đợi một lúc rồi thử lại.',
  otp_expired: 'Link đã hết hạn hoặc được mở trên máy khác. Gửi lại link từ màn đăng nhập.',
  signup_disabled: 'Hiện chưa mở đăng ký tài khoản mới.',
  identity_already_exists: 'Tài khoản Google này đã gắn với một tài khoản khác.',
  manual_linking_disabled: 'Chưa bật liên kết tài khoản trong Supabase (Allow manual linking).',
  provider_disabled: 'Chưa bật đăng nhập Google trong Supabase.',
  access_denied: 'Bạn đã huỷ đăng nhập Google.',
  single_identity_not_deletable: 'Đây là cách đăng nhập duy nhất của tài khoản nên chưa gỡ được.',
};

type Err = { message: string; code?: string } | null;

/** The one Supabase client (PostgREST, RPC, Auth, Realtime) and the app-wide error surface. */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private notify = inject(NotifyService);

  readonly client = createClient(environment.supabase.url, environment.supabase.key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // PKCE: a URL only signs in if this browser started the flow (holds the code verifier); the implicit flow
      // accepted any #access_token=… link, so a crafted link could swap the user into another account.
      flowType: 'pkce',
    },
  });

  constructor() {
    // The redirect back from Google (or an auth email) reports a failure in the URL, not as a thrown error.
    const href = window.location.href;
    if (/[?&#]error/.test(href)) {
      window.history.replaceState(null, '', window.location.pathname); // a reload must not show it again
      const q = new URLSearchParams(href.split(/[?#]/).slice(1).join('&'));
      const code = q.get('error_code') ?? q.get('error');
      if (code) queueMicrotask(() => this.ok({ error: { code, message: q.get('error_description') ?? code } }));
    }
  }

  /** Surfaces a Supabase error as a toast; true on success. */
  ok(res: { error: Err }) {
    const e = res.error;
    if (e) this.notify.error(e.code && AUTH_ERRORS[e.code] ? tr(AUTH_ERRORS[e.code]) : e.message);
    return !e;
  }

  /** Where an auth email or OAuth round trip returns; each path must be in Supabase's Redirect URLs. */
  redirect(path: string) {
    return `${window.location.origin}${path}`;
  }

  /** Google sign-in, or linking Google to the signed-in account. Leaves the page; the client trades ?code= on return. */
  async google(link: boolean, path = '/') {
    const options = { redirectTo: this.redirect(path) };
    const auth = this.client.auth;
    this.ok(link ? await auth.linkIdentity({ provider: 'google', options }) : await auth.signInWithOAuth({ provider: 'google', options }));
  }
}
