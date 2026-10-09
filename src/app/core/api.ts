import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { CONFIG } from './config';
import { Session } from './session';
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  private readonly config = inject(CONFIG);
  private readonly session = inject(Session);
  companyPath(suffix = ''): string {
    return `/v1/companies/${this.session.companyId}${suffix}`;
  }
  get<T>(path: string, query: Record<string, string | number | boolean | undefined> = {}) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined && value !== '') params = params.set(key, value);
    return this.http.get<T>(this.config.apiBaseUrl + path, { params });
  }
  post<T>(path: string, body: unknown = {}, idempotencyKey?: string) {
    return this.http.post<T>(this.config.apiBaseUrl + path, body, {
      headers: idempotencyKey ? new HttpHeaders({ 'Idempotency-Key': idempotencyKey }) : undefined,
    });
  }
  put<T>(path: string, body: unknown) {
    return this.http.put<T>(this.config.apiBaseUrl + path, body);
  }
  delete<T = void>(path: string) {
    return this.http.delete<T>(this.config.apiBaseUrl + path);
  }
}
