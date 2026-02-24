import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(['STUDENT']);
    const body = await request.json();

    const { interviewerId, topic, durationMinutes, scheduledTime } = body;

    if (!interviewerId || !topic || !durationMinutes || !scheduledTime) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const scheduledDate = new Date(scheduledTime);

    const [studentProfile, interviewer] = await Promise.all([
      prisma.studentProfile.findUnique({
        where: { userId },
        select: {
          id: true,
          planType: true,
          guidanceUsed: true,
          guidanceLimit: true,
          planExpiresAt: true,
        },
      }),
      prisma.interviewerProfile.findUnique({
        where: { id: parseInt(interviewerId) },
        select: { id: true, status: true, sessionTypesOffered: true },
      }),
    ]);

    if (!studentProfile) {
      return NextResponse.json({ error: 'Please complete your profile first' }, { status: 400 });
    }

    // ── Check if plan has expired (auto-downgrade to FREE) ───────────────────
    const now = new Date();
    const planExpired =
      studentProfile.planType === 'PRO' &&
      studentProfile.planExpiresAt &&
      studentProfile.planExpiresAt < now;

    if (planExpired) {
      // Downgrade expired plan silently
      await prisma.studentProfile.update({
        where: { id: studentProfile.id },
        data: {
          planType: 'FREE',
          guidanceLimit: 5,
          interviewsLimit: 5,
          guidanceUsed: 0,
          interviewsUsed: 0,
          planExpiresAt: null,
        },
      });
      // Reflect the reset for the check below
      studentProfile.planType = 'FREE';
      studentProfile.guidanceUsed = 0;
      studentProfile.guidanceLimit = 5;
    }

    // ── Quota check ──────────────────────────────────────────────────────────
    if (studentProfile.guidanceUsed >= studentProfile.guidanceLimit) {
      return NextResponse.json(
        {
          error: 'LIMIT_REACHED',
          message:
            studentProfile.planType === 'FREE'
              ? 'You have used all 5 free guidance sessions. Upgrade to Pro for ₹99/month to get 10 more.'
              : 'You have used all 10 guidance sessions for this month. Renew your plan to continue.',
          planType: studentProfile.planType,
          used: studentProfile.guidanceUsed,
          limit: studentProfile.guidanceLimit,
        },
        { status: 403 }
      );
    }

    if (!interviewer || interviewer.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Interviewer not available' }, { status: 400 });
    }

    if (!interviewer.sessionTypesOffered.includes('GUIDANCE')) {
      return NextResponse.json(
        { error: 'This interviewer does not offer guidance sessions' },
        { status: 400 }
      );
    }

    const slot = await prisma.availabilitySlot.findFirst({
      where: {
        interviewerId: interviewer.id,
        startTime: { lte: scheduledDate },
        endTime: { gte: scheduledDate },
        isBooked: false,
      },
      select: { id: true },
    });

    if (!slot) {
      return NextResponse.json({ error: 'Selected time slot is not available' }, { status: 400 });
    }

    // ── Create session + mark slot booked + increment usage atomically ────────
    const [session] = await prisma.$transaction([
      prisma.session.create({
        data: {
          studentId: studentProfile.id,
          interviewerId: interviewer.id,
          sessionType: 'GUIDANCE',
          topic,
          durationMinutes: parseInt(durationMinutes),
          scheduledTime: scheduledDate,
        },
        include: { interviewer: true },
      }),
      prisma.availabilitySlot.update({
        where: { id: slot.id },
        data: { isBooked: true },
      }),
      prisma.studentProfile.update({
        where: { id: studentProfile.id },
        data: { guidanceUsed: { increment: 1 } },
      }),
    ]);

    return NextResponse.json({ session });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) }
    );
  }
}