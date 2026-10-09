import { inject, Injectable } from '@angular/core';
import { Api } from '../../core/api';
import type { Policy, PolicyInput } from '../../core/models';
@Injectable({ providedIn: 'root' })
export class PoliciesApi {
  private readonly api = inject(Api);
  private path(id = '') {
    return this.api.companyPath('/booking-policies' + (id ? '/' + encodeURIComponent(id) : ''));
  }
  list() {
    return this.api.get<Policy[]>(this.path());
  }
  create(body: PolicyInput) {
    return this.api.post<{ id: string }>(this.path(), body);
  }
  update(id: string, body: PolicyInput) {
    return this.api.put<Policy>(this.path(id), body);
  }
  state(id: string, action: 'activate' | 'deactivate') {
    return this.api.post<Policy>(this.path(id) + '/' + action);
  }
}
