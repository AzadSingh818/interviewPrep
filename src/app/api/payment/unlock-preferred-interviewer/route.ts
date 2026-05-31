import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';
import { env } from '@/lib/env';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(['STUDENT']);
    const body = await request.json();

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: 'Missing payment verification fields.' },
        { status: 400 }
      );
    }

    // Verify Razorpay signature
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

    const featureUnlock = await prisma.featureUnlock.findUnique({
      where: { razorpayOrderId: razorpay_order_id },
      include: { student: true },
    });

    if (featureUnlock) {
      if (featureUnlock.student.userId !== userId) {
        return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
      }

      if (featureUnlock.paymentStatus === 'PAID') {
        return NextResponse.json({ success: true, alreadyProcessed: true });
      }

      await prisma.$transaction([
        prisma.featureUnlock.update({
          where: { id: featureUnlock.id },
          data: {
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            paymentStatus: 'PAID',
          },
        }),
        prisma.studentProfile.update({
          where: { id: featureUnlock.studentId },
          data: { preferredInterviewerUnlocked: true },
        }),
      ]);

      return NextResponse.json({
        success: true,
        message: 'Feature unlocked! You can now choose your preferred interviewer.',
      });
    }

    // Legacy fallback for unlock orders created before FeatureUnlock existed.
    const pendingRequest = await prisma.manualBookingRequest.findFirst({
      where: { razorpayOrderId: razorpay_order_id },
      include: { studentProfile: true },
    });

    if (!pendingRequest) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    // Guard: make sure student owns this order
    if (pendingRequest.studentProfile?.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    // Guard: prevent double-processing
    if (pendingRequest.paymentStatus === 'PAID') {
      return NextResponse.json({ success: true, alreadyProcessed: true });
    }

    // Mark payment as paid + unlock feature on student profile
    await prisma.$transaction([
      prisma.manualBookingRequest.update({
        where: { id: pendingRequest.id },
        data: {
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          paymentStatus: 'PAID',
        },
      }),
      prisma.studentProfile.update({
        where: { id: pendingRequest.studentId },
        data: { preferredInterviewerUnlocked: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Feature unlocked! You can now choose your preferred interviewer.',
    });
  } catch (error: any) {
    console.error('Unlock verify error:', error);
    return NextResponse.json(
      { error: error.message || 'Verification failed.' },
      { status: authErrorStatus(error.message) }
    );
  }
}
