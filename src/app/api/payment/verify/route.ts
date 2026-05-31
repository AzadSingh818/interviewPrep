import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';
import { env } from '@/lib/env';
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
    const paymentResult = await prisma.$transaction(async (tx) => {
      const existingSubscription = await tx.subscription.findUnique({
        where: { id: subscription.id },
        select: { id: true, status: true, studentId: true },
      });

      if (!existingSubscription) {
        throw new Error('Order not found');
      }

      const currentStudent = await tx.studentProfile.findUnique({
        where: { id: existingSubscription.studentId },
        select: { planExpiresAt: true },
      });

      if (!currentStudent) {
        throw new Error('Student profile not found');
      }

      if (existingSubscription.status === 'PAID') {
        return {
          alreadyProcessed: true,
          validUntil: currentStudent.planExpiresAt,
        };
      }

      const now = new Date();
      const startFrom =
        currentStudent.planExpiresAt && currentStudent.planExpiresAt > now
          ? currentStudent.planExpiresAt
          : now;
      const validUntil = new Date(startFrom);
      validUntil.setMonth(validUntil.getMonth() + 1);

      const claim = await tx.subscription.updateMany({
        where: {
          id: existingSubscription.id,
          status: 'PENDING',
        },
        data: {
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          status: 'PAID',
          planType: 'PRO',
          validFrom: startFrom,
          validUntil,
        },
      });

      if (claim.count === 0) {
        const latest = await tx.subscription.findUnique({
          where: { id: existingSubscription.id },
          select: { status: true },
        });

        if (latest?.status === 'PAID') {
          return {
            alreadyProcessed: true,
            validUntil: currentStudent.planExpiresAt,
          };
        }

        throw new Error('Payment state conflict');
      }

      await tx.studentProfile.update({
        where: { id: existingSubscription.studentId },
        data: {
          planType: 'PRO',
          interviewsUsed: 0,
          guidanceUsed: 0,
          interviewsLimit: MONTHLY_INTERVIEW_LIMIT,
          guidanceLimit: MONTHLY_GUIDANCE_LIMIT,
          planExpiresAt: validUntil,
        },
      });

      return {
        alreadyProcessed: false,
        validUntil,
      };
    });

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
