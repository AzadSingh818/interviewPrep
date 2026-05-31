import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';
import { env } from '@/lib/env';
import { PRO_PLAN_AMOUNT_PAISE } from '@/lib/pricing';
import Razorpay from 'razorpay';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const razorpay = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });

    const { userId } = await requireAuth(['STUDENT']);

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
      select: { id: true, planType: true, planExpiresAt: true },
    });
    if (!studentProfile) {
      return NextResponse.json(
        { error: 'Please complete your profile first' },
        { status: 400 }
      );
    }

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: PRO_PLAN_AMOUNT_PAISE,
      currency: 'INR',
      receipt: `receipt_student_${studentProfile.id}_${Date.now()}`,
      notes: {
        studentId: studentProfile.id.toString(),
        planType: 'PRO',
      },
    });

    // Save pending subscription record for audit trail
    await prisma.subscription.create({
      data: {
        studentId: studentProfile.id,
        razorpayOrderId: order.id,
        amount: PRO_PLAN_AMOUNT_PAISE,
        currency: 'INR',
        status: 'PENDING',
        planType: 'PRO',
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: PRO_PLAN_AMOUNT_PAISE,
      currency: 'INR',
      keyId: env.RAZORPAY_KEY_ID,
    });
  } catch (error: any) {
    console.error('Create order error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create payment order' },
      { status: authErrorStatus(error.message) }
    );
  }
}
