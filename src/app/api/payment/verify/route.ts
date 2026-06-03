import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';
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
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
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

    // Guard: prevent double-processing
    if (subscription.status === 'PAID') {
      return NextResponse.json({ success: true, alreadyProcessed: true });
    }

    // ── 3. Calculate new plan period ─────────────────────────────────────────
    // If student already has an active plan, extend from its expiry date.
    // Otherwise start from today.
    const now = new Date();
    const currentExpiry = subscription.student.planExpiresAt;
    const startFrom = currentExpiry && currentExpiry > now ? currentExpiry : now;
    const validUntil = new Date(startFrom);
    validUntil.setMonth(validUntil.getMonth() + 1);

    // ── 4. Update subscription + student profile atomically ──────────────────
    await prisma.$transaction([
      // Mark subscription as PAID
      prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          status: 'PAID',
          planType: 'PRO',
          validFrom: startFrom,
          validUntil,
        },
      }),
      // Reset usage counters + set new limits + extend expiry
      prisma.studentProfile.update({
        where: { id: subscription.studentId },
        data: {
          planType: 'PRO',
          interviewsUsed: 0,          // reset usage for the new month
          guidanceUsed: 0,
          interviewsLimit: MONTHLY_INTERVIEW_LIMIT,
          guidanceLimit: MONTHLY_GUIDANCE_LIMIT,
          planExpiresAt: validUntil,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      plan: {
        type: 'PRO',
        interviewsLimit: MONTHLY_INTERVIEW_LIMIT,
        guidanceLimit: MONTHLY_GUIDANCE_LIMIT,
        validUntil: validUntil.toISOString(),
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