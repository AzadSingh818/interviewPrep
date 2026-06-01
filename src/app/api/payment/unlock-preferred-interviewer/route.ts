import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';
import { env } from '@/lib/env';
import { processFeatureUnlockPaymentCaptured } from '@/lib/payments';
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

    if (!featureUnlock) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    if (featureUnlock.student.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const paymentResult = await processFeatureUnlockPaymentCaptured({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (paymentResult.alreadyProcessed) {
      return NextResponse.json({ success: true, alreadyProcessed: true });
    }

    if (!paymentResult.processed) {
      return NextResponse.json({ error: 'Payment state conflict.' }, { status: 409 });
    }

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
