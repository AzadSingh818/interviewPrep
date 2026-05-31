import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';
import { env } from '@/lib/env';
import Razorpay from 'razorpay';

export const dynamic = 'force-dynamic';

const UNLOCK_AMOUNT_PAISE = 5000; // ₹50 in paise

export async function POST() {
  try {
    const { userId } = await requireAuth(['STUDENT']);

    const razorpay = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });

    const student = await prisma.studentProfile.findUnique({
      where: { userId },
      select: { id: true, preferredInterviewerUnlocked: true },
    });

    if (!student) {
      return NextResponse.json({ error: 'Student profile not found.' }, { status: 404 });
    }

    // Already unlocked — no need to pay again
    if (student.preferredInterviewerUnlocked) {
      return NextResponse.json(
        { error: 'Feature already unlocked.', alreadyUnlocked: true },
        { status: 400 }
      );
    }

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: UNLOCK_AMOUNT_PAISE,
      currency: 'INR',
      receipt: `unlock_${student.id}_${Date.now()}`,
      notes: {
        studentId: student.id.toString(),
        purpose: 'preferred_interviewer_unlock',
      },
    });

    await prisma.featureUnlock.create({
      data: {
        studentId: student.id,
        feature: 'PREFERRED_INTERVIEWER',
        razorpayOrderId: order.id,
        amount: UNLOCK_AMOUNT_PAISE,
        currency: 'INR',
        paymentStatus: 'PENDING',
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: UNLOCK_AMOUNT_PAISE,
      currency: 'INR',
      keyId: env.RAZORPAY_KEY_ID,
    });
  } catch (error: any) {
    console.error('Create unlock order error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create payment order.' },
      { status: authErrorStatus(error.message) }
    );
  }
}
