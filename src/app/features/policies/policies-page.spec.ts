import { policyBody } from './policies-page';
const values = {
  name: ' Weekday ',
  minDurationMinutes: '30',
  maxDurationMinutes: '120',
  slotIncrementMinutes: '30',
  minNoticeMinutes: '0',
  maxAdvanceDays: '30',
  cancellationNoticeMinutes: '60',
  approvalRequired: 'true',
  allowCustomerCancel: 'false',
};
describe('booking policy duration decisions', () => {
  it('retains minute and day units and boolean choices', () => {
    expect(policyBody(values)).toEqual({
      name: 'Weekday',
      minDurationMinutes: 30,
      maxDurationMinutes: 120,
      slotIncrementMinutes: 30,
      minNoticeMinutes: 0,
      maxAdvanceDays: 30,
      cancellationNoticeMinutes: 60,
      approvalRequired: true,
      allowCustomerCancel: false,
    });
  });
  it('rejects minimum greater than maximum', () =>
    expect(() => policyBody({ ...values, minDurationMinutes: '150' })).toThrow());
  it('rejects either bound not divisible by the increment', () => {
    expect(() => policyBody({ ...values, minDurationMinutes: '40' })).toThrow();
    expect(() => policyBody({ ...values, maxDurationMinutes: '125' })).toThrow();
  });
  it('rejects a zero increment', () =>
    expect(() => policyBody({ ...values, slotIncrementMinutes: '0' })).toThrow());
});
