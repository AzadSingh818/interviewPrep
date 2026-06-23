/**
 * Razorpay webhook regression tests.
 *
 * Covers duplicate-event idempotency at the route level so a repeated webhook
 * does not trigger payment processing again.
 */

import crypto from 'crypto';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    paymentWebhookEvent: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/env', () => ({
  readRequiredEnv: jest.fn((name: string) => {
    if (name === 'RAZORPAY_WEBHOOK_SECRET') return 'test_webhook_secret';
    return 'test_value';
  }),
}));

jest.mock('@/lib/payments', () => ({
  processCapturedPayment: jest.fn(),
  processFailedPayment: jest.fn(),
}));

jest.mock('@/lib/monitoring', () => ({
  captureError: jest.fn(),
  captureEvent: jest.fn(),
}));

import { prisma } from '@/lib/prisma';
import { processCapturedPayment, processFailedPayment } from '@/lib/payments';
import { POST } from '@/app/api/webhooks/razorpay/route';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockProcessCapturedPayment = processCapturedPayment as jest.MockedFunction<typeof processCapturedPayment>;
const mockProcessFailedPayment = processFailedPayment as jest.MockedFunction<typeof processFailedPayment>;

function signPayload(rawBody: string) {
  return crypto
    .createHmac('sha256', 'test_webhook_secret')
    .update(rawBody)
    .digest('hex');
}

function buildRequest(rawBody: string, signature: string) {
  return {
    text: async () => rawBody,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'x-razorpay-signature' ? signature : null),
    },
  } as any;
}

describe('/api/webhooks/razorpay POST', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns duplicate=true and skips processors when webhook event is already processed', async () => {
    const payload = {
      id: 'evt_duplicate_1',
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_123', order_id: 'order_123' } },
      },
    };
    const rawBody = JSON.stringify(payload);
    const signature = signPayload(rawBody);

    (mockPrisma.paymentWebhookEvent.upsert as jest.Mock).mockResolvedValue({
      processedAt: new Date('2026-06-23T00:00:00.000Z'),
    });

    const res = await POST(buildRequest(rawBody, signature));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, duplicate: true });
    expect(mockProcessCapturedPayment).not.toHaveBeenCalled();
    expect(mockProcessFailedPayment).not.toHaveBeenCalled();
    expect(mockPrisma.paymentWebhookEvent.update).not.toHaveBeenCalled();
  });
});

