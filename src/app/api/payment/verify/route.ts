import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';
import { env } from '@/lib/env';
import { processSubscriptionPaymentCaptured } from '@/lib/payments';
import crypto from 'crypto';

const MONTHLY_INTERVIEW_LIMIT = 10;
const MONTHLY_GUIDANCE_LIMIT = 10;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(['STUDENT']);
    const body = await request.json();

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: 'Missing payment verification fields' },
        { status: 400 }
      );
    }

    // ── 1. Verify Razorpay signature ─────────────────────────────────────────
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json(
        { error: 'Payment verification failed. Invalid signature.' },
        { status: 400 }
      );
    }

    // ── 2. Find the subscription record ──────────────────────────────────────
    const subscription = await prisma.subscription.findUnique({
      where: { razorpayOrderId: razorpay_order_id },
      include: { student: true },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Guard: make sure this student owns this order
    if (subscription.student.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // ── 3. Update subscription + student profile atomically and idempotently ─
    const paymentResult = await processSubscriptionPaymentCaptured({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!paymentResult.processed || !('validUntil' in paymentResult)) {
      return NextResponse.json({ error: 'Payment state conflict.' }, { status: 409 });
    }

    if (paymentResult.alreadyProcessed) {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        plan: paymentResult.validUntil
          ? {
              type: 'PRO',
              interviewsLimit: MONTHLY_INTERVIEW_LIMIT,
              guidanceLimit: MONTHLY_GUIDANCE_LIMIT,
              validUntil: paymentResult.validUntil.toISOString(),
            }
          : undefined,
      });
    }

    if (!paymentResult.validUntil) {
      throw new Error('Missing subscription validity after payment processing');
    }

    return NextResponse.json({
      success: true,
      plan: {
        type: 'PRO',
        interviewsLimit: MONTHLY_INTERVIEW_LIMIT,
        guidanceLimit: MONTHLY_GUIDANCE_LIMIT,
        validUntil: paymentResult.validUntil.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Payment verify error:', error);
    return NextResponse.json(
      { error: error.message || 'Payment verification failed' },
      { status: authErrorStatus(error.message) }
    );
  }
}
