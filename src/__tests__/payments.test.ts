/**
 * Payment processing regression tests.
 *
 * Tests the critical payment functions:
 * - Idempotency: duplicate webhook payments don't double-grant entitlements
 * - State machine: only PENDING → PAID transitions succeed
 * - Failed payment marking
 *
 * All DB calls are mocked — no real database connection needed.
 */

// ─── Mock Prisma ──────────────────────────────────────────────────────────────
jest.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    studentProfile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    featureUnlock: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import {
  processSubscriptionPaymentCaptured,
  processSubscriptionPaymentFailed,
  processFeatureUnlockPaymentCaptured,
  processFeatureUnlockPaymentFailed,
  processCapturedPayment,
  processFailedPayment,
} from '@/lib/payments';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Helper to reset all mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Subscription payment tests ───────────────────────────────────────────────

describe('processSubscriptionPaymentCaptured', () => {
  const params = { orderId: 'order_123', paymentId: 'pay_abc', signature: 'sig_xyz' };

  it('returns processed: false if subscription order not found', async () => {
    (mockPrisma.subscription.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await processSubscriptionPaymentCaptured(params);
    expect(result).toMatchObject({ processed: false, reason: 'order_not_found' });
  });

  it('marks idempotent if subscription already PAID', async () => {
    (mockPrisma.subscription.findUnique as jest.Mock).mockResolvedValue({ id: 1 });

    // $transaction executes the callback
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      // Mock inner tx calls
      const tx = {
        subscription: {
          findUnique: jest.fn().mockResolvedValue({ id: 1, status: 'PAID', studentId: 10 }),
        },
        studentProfile: {
          findUnique: jest.fn().mockResolvedValue({ planExpiresAt: new Date('2026-12-31') }),
          update: jest.fn().mockResolvedValue({}),
        },
      };
      return cb(tx);
    });

    const result = await processSubscriptionPaymentCaptured(params);
    expect(result).toMatchObject({ processed: true, alreadyProcessed: true });
  });

  it('processes PENDING subscription and grants PRO', async () => {
    (mockPrisma.subscription.findUnique as jest.Mock).mockResolvedValue({ id: 1 });

    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      const tx = {
        subscription: {
          findUnique: jest.fn().mockResolvedValue({ id: 1, status: 'PENDING', studentId: 10 }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        studentProfile: {
          findUnique: jest.fn().mockResolvedValue({ planExpiresAt: null }),
          update: jest.fn().mockResolvedValue({}),
        },
      };
      return cb(tx);
    });

    const result = await processSubscriptionPaymentCaptured(params);
    expect(result).toMatchObject({ processed: true, alreadyProcessed: false });
  });

  it('returns state_conflict if another process already claimed the PENDING row', async () => {
    (mockPrisma.subscription.findUnique as jest.Mock).mockResolvedValue({ id: 1 });

    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      const tx = {
        subscription: {
          findUnique: jest.fn().mockResolvedValue({ id: 1, status: 'PENDING', studentId: 10 }),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }), // race condition — another worker claimed it
        },
        studentProfile: {
          findUnique: jest.fn().mockResolvedValue({ planExpiresAt: null }),
        },
      };
      return cb(tx);
    });

    const result = await processSubscriptionPaymentCaptured(params);
    expect(result).toMatchObject({ processed: false, reason: 'state_conflict' });
  });
});

describe('processSubscriptionPaymentFailed', () => {
  it('marks PENDING subscription as FAILED', async () => {
    (mockPrisma.subscription.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const result = await processSubscriptionPaymentFailed('order_123');
    expect(result).toMatchObject({ processed: true, target: 'subscription' });
    expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { razorpayOrderId: 'order_123', status: 'PENDING' },
        data: { status: 'FAILED' },
      }),
    );
  });

  it('returns processed: false if no PENDING row to update', async () => {
    (mockPrisma.subscription.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    const result = await processSubscriptionPaymentFailed('order_999');
    expect(result).toMatchObject({ processed: false });
  });
});

// ─── Feature unlock tests ─────────────────────────────────────────────────────

describe('processFeatureUnlockPaymentCaptured', () => {
  const params = { orderId: 'order_unlock_1', paymentId: 'pay_unlock_1', signature: null };

  it('returns processed: false if feature unlock not found', async () => {
    (mockPrisma.featureUnlock.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await processFeatureUnlockPaymentCaptured(params);
    expect(result).toMatchObject({ processed: false, reason: 'order_not_found' });
  });

  it('is idempotent if unlock already PAID — still sets preferredInterviewerUnlocked', async () => {
    (mockPrisma.featureUnlock.findUnique as jest.Mock).mockResolvedValue({
      id: 5,
      studentId: 20,
      paymentStatus: 'PAID',
    });
    (mockPrisma.studentProfile.update as jest.Mock).mockResolvedValue({});

    const result = await processFeatureUnlockPaymentCaptured(params);
    expect(result).toMatchObject({ processed: true, alreadyProcessed: true });
    expect(mockPrisma.studentProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { preferredInterviewerUnlocked: true } }),
    );
  });
});

describe('processFeatureUnlockPaymentFailed', () => {
  it('marks PENDING unlock as FAILED', async () => {
    (mockPrisma.featureUnlock.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const result = await processFeatureUnlockPaymentFailed('order_unlock_2');
    expect(result).toMatchObject({ processed: true, target: 'feature_unlock' });
  });
});

// ─── Webhook routing (processCapturedPayment / processFailedPayment) ──────────

describe('processCapturedPayment', () => {
  it('tries subscription first, then feature unlock if not found', async () => {
    // First call (subscription lookup) returns not found
    (mockPrisma.subscription.findUnique as jest.Mock).mockResolvedValue(null);
    // Second call (feature unlock) also returns not found
    (mockPrisma.featureUnlock.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await processCapturedPayment({ orderId: 'order_x', paymentId: 'pay_x' });
    expect(result).toMatchObject({ processed: false, reason: 'order_not_found' });
    expect(mockPrisma.subscription.findUnique).toHaveBeenCalledTimes(1);
    expect(mockPrisma.featureUnlock.findUnique).toHaveBeenCalledTimes(1);
  });
});

describe('processFailedPayment', () => {
  it('tries subscription first, then feature unlock if not processed', async () => {
    (mockPrisma.subscription.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (mockPrisma.featureUnlock.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    const result = await processFailedPayment('order_y');
    expect(result).toMatchObject({ processed: false });
    expect(mockPrisma.subscription.updateMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.featureUnlock.updateMany).toHaveBeenCalledTimes(1);
  });
});
