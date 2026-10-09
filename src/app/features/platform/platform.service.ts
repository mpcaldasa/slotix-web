import { inject, Injectable } from '@angular/core';
import { Api } from '../../core/api';
import type { Company, Page, PlatformUser, Schema } from '../../core/models';
@Injectable({ providedIn: 'root' })
export class PlatformService {
  private readonly api = inject(Api);
  companies() {
    return this.api.get<Company[]>('/companies');
  }
  users(page: number) {
    return this.api.get<Page<PlatformUser>>('/platform/users', { page, size: 20 });
  }
  createCompany(input: Schema<'CreateCompanyRequest'>) {
    return this.api.post<Company>('/companies', input);
  }
  onboard(input: Schema<'CompanyOnboardingRequest'>) {
    return this.api.post<Schema<'CompanyOnboardingResponse'>>('/v1/companies/onboarding', input);
  }
  initialize(id: string, input: Schema<'InitialAdministratorRequest'>) {
    return this.api.post<Schema<'CompanyOnboardingResponse'>>(
      `/v1/companies/${id}/initial-administrator`,
      input,
    );
  }
  activateCompany(id: string) {
    return this.api.post<Company>(`/companies/${id}/activate`);
  }
  userAction(id: string, action: 'deactivate' | 'reactivate' | 'platform-admin') {
    return this.api.post<PlatformUser>(`/platform/users/${id}/${action}`);
  }
  revoke(id: string) {
    return this.api.delete<PlatformUser>(`/platform/users/${id}/platform-admin`);
  }
}
