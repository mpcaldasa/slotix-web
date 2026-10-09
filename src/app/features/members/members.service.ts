import { inject, Injectable } from '@angular/core';
import { Api } from '../../core/api';
import type { Membership, Page, Schema, CompanyRole } from '../../core/models';
@Injectable({ providedIn: 'root' })
export class MembersService {
  private readonly api = inject(Api);
  list(page: number) {
    return this.api.get<Page<Membership>>(this.api.companyPath('/memberships'), { page, size: 20 });
  }
  link(userId: string, roles: CompanyRole[]) {
    return this.api.post<Membership>(this.api.companyPath('/memberships'), { userId, roles });
  }
  register(input: Schema<'RegisterUserRequest'>) {
    return this.api.post<Schema<'UserResponse'>>('/users', input);
  }
  invite(email: string, roles: CompanyRole[]) {
    return this.api.post<Schema<'CompanyInvitationResponse'>>(
      this.api.companyPath('/memberships/invitations'),
      { email, roles },
    );
  }
  roles(id: string, roles: CompanyRole[]) {
    return this.api.put<Membership>(this.api.companyPath(`/memberships/${id}/roles`), { roles });
  }
  status(id: string, action: 'suspend' | 'activate') {
    return this.api.post<Membership>(this.api.companyPath(`/memberships/${id}/${action}`));
  }
}
