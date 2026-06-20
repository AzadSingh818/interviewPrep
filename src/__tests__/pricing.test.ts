/**
 * Pricing regression tests.
 *
 * These tests assert the exact monetary constants used when creating
 * Razorpay orders. Any accidental change to pricing values will fail
 * these tests immediately, preventing billing bugs from reaching production.
 */

import {
  PRO_PLAN_AMOUNT_PAISE,
  PRO_PLAN_PRICE_RUPEES,
  PRO_PLAN_PRICE_DISPLAY,
  PRO_PLAN_PERIOD_LABEL,
  PRO_PLAN_DESCRIPTION,
} from '@/lib/pricing';

describe('Pricing constants — regression guard', () => {
  it('PRO_PLAN_AMOUNT_PAISE is exactly 9900 (₹99)', () => {
    expect(PRO_PLAN_AMOUNT_PAISE).toBe(9900);
  });

  it('PRO_PLAN_PRICE_RUPEES is exactly 99', () => {
    expect(PRO_PLAN_PRICE_RUPEES).toBe(99);
  });

  it('PRO_PLAN_PRICE_DISPLAY is "₹99"', () => {
    expect(PRO_PLAN_PRICE_DISPLAY).toBe('₹99');
  });

  it('PRO_PLAN_PERIOD_LABEL is "month"', () => {
    expect(PRO_PLAN_PERIOD_LABEL).toBe('month');
  });

  it('PRO_PLAN_DESCRIPTION includes correct amount', () => {
    expect(PRO_PLAN_DESCRIPTION).toContain('₹99');
    expect(PRO_PLAN_DESCRIPTION).toContain('10 Interviews');
    expect(PRO_PLAN_DESCRIPTION).toContain('10 Guidance');
  });

  it('PRO_PLAN_AMOUNT_PAISE / 100 === PRO_PLAN_PRICE_RUPEES (no rounding error)', () => {
    expect(PRO_PLAN_AMOUNT_PAISE / 100).toBe(PRO_PLAN_PRICE_RUPEES);
  });

  it('amount is in paise (integer, > 0)', () => {
    expect(Number.isInteger(PRO_PLAN_AMOUNT_PAISE)).toBe(true);
    expect(PRO_PLAN_AMOUNT_PAISE).toBeGreaterThan(0);
  });
});
