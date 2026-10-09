import { computed, Injectable, signal } from '@angular/core';
import type { Role } from './models';
export interface Identity {
  token: string;
  userId: string;
  companyId: string | null;
  roles: Role[];
  expiresAt: number;
}
const roles: readonly string[] = ['PLATFORM_ADMIN', 'COMPANY_ADMIN', 'BOOKING_MANAGER', 'CUSTOMER'];
export function decodeIdentity(token: string): Identity {
  const part = token.split('.')[1];
  if (!part) throw new Error('Invalid token');
  const data: unknown = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
  if (
    !data ||
    typeof data !== 'object' ||
    !('sub' in data) ||
    typeof data.sub !== 'string' ||
    !('exp' in data) ||
    typeof data.exp !== 'number' ||
    !('roles' in data) ||
    !Array.isArray(data.roles) ||
    !data.roles.every((role: unknown) => typeof role === 'string' && roles.includes(role))
  )
    throw new Error('Invalid token claims');
  const companyId =
    'companyId' in data && typeof data.companyId === 'string' ? data.companyId : null;
  if (data.exp * 1000 <= Date.now()) throw new Error('Expired token');
  if (!companyId && !data.roles.includes('PLATFORM_ADMIN'))
    throw new Error('Missing company identity');
  return {
    token,
    userId: data.sub,
    companyId,
    roles: data.roles as Role[],
    expiresAt: data.exp * 1000,
  };
}
@Injectable({ providedIn: 'root' })
export class Session {
  readonly identity = signal<Identity | null>(null);
  readonly notice = signal('');
  readonly admin = computed(() => this.has('COMPANY_ADMIN'));
  readonly staff = computed(() => this.has('COMPANY_ADMIN', 'BOOKING_MANAGER'));
  readonly platform = computed(
    () => this.identity()?.companyId === null && this.has('PLATFORM_ADMIN'),
  );
  private expiry?: ReturnType<typeof setTimeout>;
  has(...allowed: Role[]): boolean {
    return !!this.identity()?.roles.some((role) => allowed.includes(role));
  }
  get companyId(): string {
    const id = this.identity()?.companyId;
    if (!id) throw new Error('Company identity required');
    return id;
  }
  accept(token: string): void {
    this.clear();
    const identity = decodeIdentity(token);
    this.identity.set(identity);
    this.expiry = setTimeout(
      () => this.clear('Tu sesión expiró. Vuelve a iniciar sesión.'),
      Math.min(identity.expiresAt - Date.now(), 2147483647),
    );
  }
  clear(notice = ''): void {
    clearTimeout(this.expiry);
    this.identity.set(null);
    this.notice.set(notice);
  }
}
