import { Session, decodeIdentity } from './session';
import { vi } from 'vitest';
function token(claims: object): string {
  return `header.${btoa(JSON.stringify(claims))}.signature`;
}
const claims = {
  sub: 'user',
  companyId: 'company',
  roles: ['CUSTOMER'],
  exp: Math.floor(Date.now() / 1000) + 600,
};
describe('authorized session identity', () => {
  afterEach(() => vi.useRealTimers());
  it('requires company identity and recognized roles', () => {
    expect(() => decodeIdentity(token({ ...claims, companyId: null }))).toThrow();
    expect(() => decodeIdentity(token({ ...claims, roles: ['SUPERUSER'] }))).toThrow();
    expect(() => decodeIdentity(token({ ...claims, exp: 0 }))).toThrow();
    expect(() => decodeIdentity('malformed')).toThrow();
    expect(
      decodeIdentity(token({ ...claims, companyId: null, roles: ['PLATFORM_ADMIN'] })).companyId,
    ).toBeNull();
  });
  it('derives only authorized actions and clears previous identity', () => {
    const session = new Session();
    session.accept(token({ ...claims, roles: ['COMPANY_ADMIN'] }));
    expect(session.admin()).toBe(true);
    expect(session.staff()).toBe(true);
    expect(session.platform()).toBe(false);
    session.accept(token(claims));
    expect(session.admin()).toBe(false);
    expect(session.staff()).toBe(false);
    session.clear();
    expect(session.identity()).toBeNull();
    expect(() => session.companyId).toThrow();
  });
  it('expires session without persisting the JWT', () => {
    vi.useFakeTimers();
    const session = new Session();
    session.accept(token({ ...claims, exp: Math.floor(Date.now() / 1000) + 2 }));
    vi.advanceTimersByTime(2000);
    expect(session.identity()).toBeNull();
    expect(session.notice()).toContain('expiró');
  });
});
