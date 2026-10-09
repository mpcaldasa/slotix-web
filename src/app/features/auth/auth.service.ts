import { inject, Injectable } from '@angular/core';
import { Api } from '../../core/api';
import type { Complete } from '../../core/models';
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(Api);
  login(company: boolean, data: Record<string, string>) {
    return this.api.post<Complete<'LoginResponse'>>(
      company ? '/users/login' : '/platform/login',
      company
        ? { companyId: data['companyId'], email: data['email'], password: data['password'] }
        : { email: data['email'], password: data['password'] },
    );
  }
  recover(email: string) {
    return this.api.post<Complete<'PasswordResetResponse'>>('/password-resets', { email });
  }
  reset(token: string, password: string) {
    return this.api.post<Complete<'PasswordResetResponse'>>('/password-resets/confirm', {
      token,
      password,
    });
  }
  accept(token: string, password: string, fullName: string) {
    return this.api.post<Complete<'UserResponse'>>('/invitations/accept', {
      token,
      password,
      fullName,
    });
  }
}
