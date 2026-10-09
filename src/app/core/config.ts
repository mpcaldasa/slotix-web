import { InjectionToken } from '@angular/core';
export interface RuntimeConfig {
  apiBaseUrl: string;
  companyTimezone: string;
}
export const CONFIG = new InjectionToken<RuntimeConfig>('Slotix runtime configuration');
export function validateConfig(value: unknown): RuntimeConfig {
  if (
    !value ||
    typeof value !== 'object' ||
    !('apiBaseUrl' in value) ||
    typeof value.apiBaseUrl !== 'string' ||
    !('companyTimezone' in value) ||
    typeof value.companyTimezone !== 'string'
  )
    throw new Error('Invalid runtime configuration');
  const url = new URL(value.apiBaseUrl, location.origin);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !['http:', 'https:'].includes(url.protocol) ||
    !url.pathname.endsWith('/api')
  )
    throw new Error('Invalid API URL');
  new Intl.DateTimeFormat('es', { timeZone: value.companyTimezone });
  return {
    apiBaseUrl: value.apiBaseUrl.replace(/\/$/, ''),
    companyTimezone: value.companyTimezone,
  };
}
