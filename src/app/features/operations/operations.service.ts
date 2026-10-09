import { inject, Injectable } from '@angular/core';
import { Api } from '../../core/api';
import type { AuditEntry, Delivery, Page } from '../../core/models';
export interface AuditFilters {
  companyId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
}
@Injectable({ providedIn: 'root' })
export class OperationsService {
  private readonly api = inject(Api);
  audit(filters: AuditFilters, page: number) {
    return this.api.get<Page<AuditEntry>>('/platform/operations/audit', {
      ...filters,
      page,
      size: 20,
    });
  }
  deliveries(status: string, page: number) {
    return this.api.get<Page<Delivery>>('/platform/operations/notification-deliveries', {
      status,
      page,
      size: 20,
    });
  }
  replay(id: string) {
    return this.api.post<Delivery>(`/platform/operations/notification-deliveries/${id}/replay`);
  }
}
