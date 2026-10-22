import { validateConfig } from './config';
describe('runtime API origin boundary', () => {
  it('rejects foreign API origins and keeps the same-origin path', () => {
    expect(() =>
      validateConfig({ apiBaseUrl: 'https://foreign.test/api', companyTimezone: 'UTC' }),
    ).toThrow();
    expect(validateConfig({ apiBaseUrl: '/api', companyTimezone: 'UTC' }).apiBaseUrl).toBe('/api');
  });
});
