import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';

/**
 * Minimum leftover minutes worth keeping as a new slot.
 * Smaller slivers are consumed silently — a 5-min gap is useless to anyone.
 */
const MIN_REMAINDER_MINUTES = 30;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(['STUDENT']);
    const body = await request.json();

    const { interviewerId, topic, durationMinutes, scheduledTime } = body;

    if (!interviewerId || !topic || !durationMinutes || !scheduledTime) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const duration     = parseInt(durationMinutes); // 30 | 45 | 60
    const sessionStart = new Date(scheduledTime);
    const sessionEnd   = new Date(sessionStart.getTime() + duration * 60_000);

    if (sessionStart <= new Date()) {
      return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 });
    }

    // ── Fetch student + interviewer in parallel ───────────────────────────────
    const [studentProfile, interviewer] = await Promise.all([
      prisma.studentProfile.findUnique({
        where: { userId },
        select: {
          id: true, planType: true, guidanceUsed: true,
          guidanceLimit: true, planExpiresAt: true,
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

    // ── Auto-downgrade expired PRO plan ───────────────────────────────────────
    const now = new Date();
    const planExpired =
      studentProfile.planType === 'PRO' &&
      studentProfile.planExpiresAt &&
      studentProfile.planExpiresAt < now;

    if (planExpired) {
      await prisma.studentProfile.update({
        where: { id: studentProfile.id },
        data: {
          planType: 'FREE', guidanceLimit: 5, interviewsLimit: 5,
          guidanceUsed: 0, interviewsUsed: 0, planExpiresAt: null,
        },
      });
      studentProfile.planType = 'FREE';
      studentProfile.guidanceUsed = 0;
      studentProfile.guidanceLimit = 5;
    }

    // ── Quota check ───────────────────────────────────────────────────────────
    if (studentProfile.guidanceUsed >= studentProfile.guidanceLimit) {
      return NextResponse.json(
        {
          error: 'LIMIT_REACHED',
          message: studentProfile.planType === 'FREE'
            ? 'You have used all 5 free guidance sessions. Upgrade to Pro for ₹99/month to get 10 more.'
            : 'You have used all 10 guidance sessions for this month. Renew your plan to continue.',
          planType: studentProfile.planType,
          used: studentProfile.guidanceUsed,
          limit: studentProfile.guidanceLimit,
        },
        { status: 403 },
      );
    }

    if (!interviewer || interviewer.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Interviewer not available' }, { status: 400 });
    }
    if (!interviewer.sessionTypesOffered.includes('GUIDANCE')) {
      return NextResponse.json(
        { error: 'This interviewer does not offer guidance sessions' },
        { status: 400 },
      );
    }

    // ── Find the tightest-fitting available slot ──────────────────────────────
    //
    // The slot MUST fully contain the session window [sessionStart, sessionEnd].
    // We sort by endTime ASC so the shortest qualifying slot is preferred —
    // this minimises wasted time and fragmentation.
    const slot = await prisma.availabilitySlot.findFirst({
      where: {
        interviewerId: interviewer.id,
        isBooked:  false,
        startTime: { lte: sessionStart },
        endTime:   { gte: sessionEnd   },
      },
      orderBy: { endTime: 'asc' },
    });

    if (!slot) {
      return NextResponse.json(
        {
          error:
            'No available slot covers your chosen time and duration. ' +
            'Please pick a different start time or select a shorter session.',
        },
        { status: 400 },
      );
    }

    // ── Slot splitting algorithm ──────────────────────────────────────────────
    //
    //  Before booking:
    //  [================ original slot =================]
    //  slot.startTime                            slot.endTime
    //
    //  After booking a 60-min session starting at sessionStart:
    //  [= BEFORE =][======= 60-min session =======][= AFTER =]
    //  slot.start  sessionStart             sessionEnd  slot.end
    //
    //  BEFORE and AFTER are re-created as FREE slots only when ≥ MIN_REMAINDER_MINUTES.
    //  The original slot is marked isBooked = true (consumed / referenced by this booking).

    const beforeMins = (sessionStart.getTime() - slot.startTime.getTime()) / 60_000;
    const afterMins  = (slot.endTime.getTime()  - sessionEnd.getTime())    / 60_000;

    // Build atomic transaction operations
    const ops: any[] = [
      // 1. Mark original slot as consumed
      prisma.availabilitySlot.update({
        where: { id: slot.id },
        data:  { isBooked: true },
      }),

      // 2. Create the session record
      prisma.session.create({
        data: {
          studentId:       studentProfile.id,
          interviewerId:   interviewer.id,
          sessionType:     'GUIDANCE',
          topic,
          durationMinutes: duration,
          scheduledTime:   sessionStart,
        },
        include: { interviewer: true },
      }),

      // 3. Increment student's guidance usage
      prisma.studentProfile.update({
        where: { id: studentProfile.id },
        data:  { guidanceUsed: { increment: 1 } },
      }),
    ];

    // 4. Preserve BEFORE gap if worth keeping
    if (beforeMins >= MIN_REMAINDER_MINUTES) {
      ops.push(
        prisma.availabilitySlot.create({
          data: {
            interviewerId: interviewer.id,
            startTime:     slot.startTime,
            endTime:       sessionStart,
            isBooked:      false,
          },
        }),
      );
    }

    // 5. Preserve AFTER gap if worth keeping
    if (afterMins >= MIN_REMAINDER_MINUTES) {
      ops.push(
        prisma.availabilitySlot.create({
          data: {
            interviewerId: interviewer.id,
            startTime:     sessionEnd,
            endTime:       slot.endTime,
            isBooked:      false,
          },
        }),
      );
    }

    const results = await prisma.$transaction(ops);
    const session = results[1]; // session is always index 1

    return NextResponse.json({
      session,
      slotSplit: {
        beforeMinutesReclaimed: beforeMins >= MIN_REMAINDER_MINUTES ? Math.round(beforeMins) : 0,
        afterMinutesReclaimed:  afterMins  >= MIN_REMAINDER_MINUTES ? Math.round(afterMins)  : 0,
      },
    });
  } catch (error: any) {
    console.error('Book guidance error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) },
    );
  }
}