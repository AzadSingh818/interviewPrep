import { prisma } from '@/lib/prisma';

const MONTHLY_INTERVIEW_LIMIT = 10;
const MONTHLY_GUIDANCE_LIMIT = 10;

export async function processSubscriptionPaymentCaptured(params: {
  orderId: string;
  paymentId: string;
  signature?: string | null;
}) {
  const subscription = await prisma.subscription.findUnique({
    where: { razorpayOrderId: params.orderId },
    select: { id: true },
  });

  if (!subscription) return { processed: false, target: 'subscription' as const, reason: 'order_not_found' };

  return prisma.$transaction(async (tx) => {
    const current = await tx.subscription.findUnique({
      where: { id: subscription.id },
      select: { id: true, status: true, studentId: true },
    });

    if (!current) return { processed: false, target: 'subscription' as const, reason: 'order_not_found' };

    const student = await tx.studentProfile.findUnique({
      where: { id: current.studentId },
      select: { planExpiresAt: true },
    });

    if (!student) return { processed: false, target: 'subscription' as const, reason: 'student_not_found' };

    if (current.status === 'PAID') {
      await tx.studentProfile.update({
        where: { id: current.studentId },
        data: {
          planType: 'PRO',
          interviewsLimit: MONTHLY_INTERVIEW_LIMIT,
          guidanceLimit: MONTHLY_GUIDANCE_LIMIT,
        },
      });
      return {
        processed: true,
        target: 'subscription' as const,
        alreadyProcessed: true,
        validUntil: student.planExpiresAt,
      };
    }

    const now = new Date();
    const startFrom =
      student.planExpiresAt && student.planExpiresAt > now
        ? student.planExpiresAt
        : now;
    const validUntil = new Date(startFrom);
    validUntil.setMonth(validUntil.getMonth() + 1);

    const claim = await tx.subscription.updateMany({
      where: { id: current.id, status: 'PENDING' },
      data: {
        razorpayPaymentId: params.paymentId,
        razorpaySignature: params.signature ?? null,
        status: 'PAID',
        planType: 'PRO',
        validFrom: startFrom,
        validUntil,
      },
    });

    if (claim.count === 0) {
      return { processed: false, target: 'subscription' as const, reason: 'state_conflict' };
    }

    await tx.studentProfile.update({
      where: { id: current.studentId },
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
      processed: true,
      target: 'subscription' as const,
      alreadyProcessed: false,
      validUntil,
    };
  });
}

export async function processSubscriptionPaymentFailed(orderId: string) {
  const result = await prisma.subscription.updateMany({
    where: { razorpayOrderId: orderId, status: 'PENDING' },
    data: { status: 'FAILED' },
  });

  return { processed: result.count > 0, target: 'subscription' as const };
}

export async function processFeatureUnlockPaymentCaptured(params: {
  orderId: string;
  paymentId: string;
  signature?: string | null;
}) {
  const unlock = await prisma.featureUnlock.findUnique({
    where: { razorpayOrderId: params.orderId },
    select: { id: true, studentId: true, paymentStatus: true },
  });

  if (!unlock) return { processed: false, target: 'feature_unlock' as const, reason: 'order_not_found' };

  if (unlock.paymentStatus === 'PAID') {
    await prisma.studentProfile.update({
      where: { id: unlock.studentId },
      data: { preferredInterviewerUnlocked: true },
    });
    return { processed: true, target: 'feature_unlock' as const, alreadyProcessed: true };
  }

  const result = await prisma.$transaction([
    prisma.featureUnlock.updateMany({
      where: { id: unlock.id, paymentStatus: 'PENDING' },
      data: {
        razorpayPaymentId: params.paymentId,
        razorpaySignature: params.signature ?? null,
        paymentStatus: 'PAID',
      },
    }),
    prisma.studentProfile.update({
      where: { id: unlock.studentId },
      data: { preferredInterviewerUnlocked: true },
    }),
  ]);

  return {
    processed: result[0].count > 0,
    target: 'feature_unlock' as const,
    alreadyProcessed: false,
  };
}

export async function processFeatureUnlockPaymentFailed(orderId: string) {
  const result = await prisma.featureUnlock.updateMany({
    where: { razorpayOrderId: orderId, paymentStatus: 'PENDING' },
    data: { paymentStatus: 'FAILED' },
  });

  return { processed: result.count > 0, target: 'feature_unlock' as const };
}

export async function processCapturedPayment(params: {
  orderId: string;
  paymentId: string;
  signature?: string | null;
}) {
  const subscription = await processSubscriptionPaymentCaptured(params);
  if (subscription.processed || subscription.reason !== 'order_not_found') {
    return subscription;
  }

  return processFeatureUnlockPaymentCaptured(params);
}

export async function processFailedPayment(orderId: string) {
  const subscription = await processSubscriptionPaymentFailed(orderId);
  if (subscription.processed) return subscription;

  return processFeatureUnlockPaymentFailed(orderId);
}
