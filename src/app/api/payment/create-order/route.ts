import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';
import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

const PLAN_AMOUNT_PAISE = 100; // ₹99 in paise

export async function POST() {
  try {
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
      amount: PLAN_AMOUNT_PAISE,
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
        amount: PLAN_AMOUNT_PAISE,
        currency: 'INR',
        status: 'PENDING',
        planType: 'PRO',
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: PLAN_AMOUNT_PAISE,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error: any) {
    console.error('Create order error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create payment order' },
      { status: authErrorStatus(error.message) }
    );
  }
}