import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  webServer: undefined,
  testIgnore: '**/*.real.spec.ts',
  use: { ...base.use, baseURL: 'http://127.0.0.1:4280' },
});
