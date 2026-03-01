import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';
import { DifficultyLevel, InterviewType } from '@prisma/client';
import { sendBookingConfirmationToStudent, sendBookingNotificationToInterviewer } from '@/lib/email';

const MIN_REMAINDER_MINUTES = 30;

// ─── Interviewer Scoring Algorithm ───────────────────────────────────────────
//
// Each candidate interviewer receives a score out of 100 based on 4 signals:
//
//  [40 pts] ROLE MATCH
//    Full match:    student role exactly contained in interviewer's rolesSupported    → 40
//    Partial match: at least one word from student role appears in any supported role → 20
//    No match:      interviewer has the required difficulty/type but not this role    →  0
//    (We never reject a no-match interviewer — they're the fallback pool.)
//
//  [30 pts] WORKLOAD (load balancing)
//    Interviewer with 0 upcoming sessions → 30 pts (they get priority)
//    Score decays linearly: 30 - (upcomingSessions * 5), floored at 0.
//    This ensures busy interviewers are deprioritised rather than skipped.
//
//  [20 pts] SLOT EFFICIENCY (fragmentation minimisation)
//    We pick the slot that best fits the session duration for each interviewer.
//    Slot waste = slotDurationMins - sessionDurationMins.
//    Less waste = higher score. Perfect fit (0 waste) → 20 pts.
//    Score = max(0, 20 - Math.floor(wasteMinutes / 30) * 4)
//    (Every extra 30-min block of waste costs 4 points.)
//
//  [10 pts] EXPERIENCE
//    yearsOfExperience / 2, capped at 10. (A 20-yr vet gets max; 0-yr gets 0.)
//
// Final selection: highest total score. Ties broken by load (fewest sessions).

interface ScoredInterviewer {
  id: number;
  name: string;
  rolesSupported: string[];
  yearsOfExperience: number | null;
  bestSlot: { id: number; startTime: Date; endTime: Date };
  upcomingSessions: number;
  score: number;
}

function scoreInterviewer(
  interviewer: {
    id: number;
    name: string;
    rolesSupported: string[];
    yearsOfExperience: number | null;
    availabilitySlots: { id: number; startTime: Date; endTime: Date }[];
    _count: { sessions: number };
  },
  role: string,
  sessionDurationMins: number,
): ScoredInterviewer | null {
  if (interviewer.availabilitySlots.length === 0) return null;

  const roleNorm = role.toLowerCase().trim();

  // ── Role match (40 pts) ──────────────────────────────────────────────────
  const fullMatch = interviewer.rolesSupported.some(
    r => r.toLowerCase().includes(roleNorm) || roleNorm.includes(r.toLowerCase()),
  );
  const partialMatch = !fullMatch && roleNorm.split(/\s+/).some(word =>
    interviewer.rolesSupported.some(r => r.toLowerCase().includes(word)),
  );
  const roleScore = fullMatch ? 40 : partialMatch ? 20 : 0;

  // ── Workload (30 pts) ────────────────────────────────────────────────────
  const upcoming      = interviewer._count.sessions;
  const workloadScore = Math.max(0, 30 - upcoming * 5);

  // ── Slot efficiency (20 pts) — pick best-fitting slot ───────────────────
  const slotsByFit = [...interviewer.availabilitySlots].sort((a, b) => {
    const wasteA = (a.endTime.getTime() - a.startTime.getTime()) / 60_000 - sessionDurationMins;
    const wasteB = (b.endTime.getTime() - b.startTime.getTime()) / 60_000 - sessionDurationMins;
    return wasteA - wasteB;
  });
  const bestSlot    = slotsByFit[0];
  const slotWaste   = (bestSlot.endTime.getTime() - bestSlot.startTime.getTime()) / 60_000 - sessionDurationMins;
  const slotScore   = Math.max(0, 20 - Math.floor(slotWaste / 30) * 4);

  // ── Experience (10 pts) ──────────────────────────────────────────────────
  const expScore = Math.min(10, Math.floor((interviewer.yearsOfExperience ?? 0) / 2));

  const totalScore = roleScore + workloadScore + slotScore + expScore;

  return {
    id:               interviewer.id,
    name:             interviewer.name,
    rolesSupported:   interviewer.rolesSupported,
    yearsOfExperience: interviewer.yearsOfExperience,
    bestSlot,
    upcomingSessions: upcoming,
    score:            totalScore,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(['STUDENT']);
    const body = await request.json();

    const { role, difficulty, interviewType, durationMinutes, scheduledTime } = body;

    if (!role || !difficulty || !interviewType || !durationMinutes || !scheduledTime) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const duration     = parseInt(durationMinutes);
    const sessionStart = new Date(scheduledTime);
    const sessionEnd   = new Date(sessionStart.getTime() + duration * 60_000);

    if (sessionStart <= new Date()) {
      return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 });
    }

    // ── Fetch student profile + candidate interviewers in parallel ────────────
    const [studentProfile, candidates] = await Promise.all([
      prisma.studentProfile.findUnique({
        where: { userId },
        select: {
          id: true, planType: true, interviewsUsed: true,
          interviewsLimit: true, planExpiresAt: true,
          name: true, college: true, branch: true, targetRole: true,
          user: { select: { email: true } },
        },
      }),

      prisma.interviewerProfile.findMany({
        where: {
          status:                'APPROVED',
          difficultyLevels:      { has: difficulty as DifficultyLevel },
          sessionTypesOffered:   { has: 'INTERVIEW' },
          interviewTypesOffered: { has: interviewType as InterviewType },
          availabilitySlots: {
            some: {
              isBooked:  false,
              startTime: { lte: sessionStart },
              endTime:   { gte: sessionEnd   },
            },
          },
        },
        select: {
          id:                    true,
          name:                  true,
          rolesSupported:        true,
          yearsOfExperience:     true,
          companies:             true,
          linkedinUrl:           true,
          availabilitySlots: {
            where: {
              isBooked:  false,
              startTime: { lte: sessionStart },
              endTime:   { gte: sessionEnd   },
            },
            select: { id: true, startTime: true, endTime: true },
          },
          _count: {
            select: {
              sessions: {
                where: { scheduledTime: { gte: new Date() }, status: 'SCHEDULED' },
              },
            },
          },
          user: { select: { email: true } },
        },
      }),
    ]);

    // ── Guards ────────────────────────────────────────────────────────────────
    if (!studentProfile) {
      return NextResponse.json({ error: 'Please complete your profile first' }, { status: 400 });
    }

    // Auto-downgrade expired PRO
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
      studentProfile.interviewsUsed = 0;
      studentProfile.interviewsLimit = 5;
    }

    // Quota check
    if (studentProfile.interviewsUsed >= studentProfile.interviewsLimit) {
      return NextResponse.json(
        {
          error: 'LIMIT_REACHED',
          message: studentProfile.planType === 'FREE'
            ? 'You have used all 5 free interviews. Upgrade to Pro for ₹99/month to get 10 more.'
            : 'You have used all 10 interviews for this month. Renew your plan to continue.',
          planType: studentProfile.planType,
          used:     studentProfile.interviewsUsed,
          limit:    studentProfile.interviewsLimit,
        },
        { status: 403 },
      );
    }

    if (candidates.length === 0) {
      return NextResponse.json(
        {
          error:
            'No interviewers are currently available for your chosen role, difficulty, ' +
            'interview type, and time slot. Please try a different time or criteria.',
        },
        { status: 400 },
      );
    }

    // ── Score every candidate, pick the best ──────────────────────────────────
    const scored = candidates
      .map(c => scoreInterviewer(c, role, duration))
      .filter((s): s is ScoredInterviewer => s !== null)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.upcomingSessions - b.upcomingSessions;
      });

    if (scored.length === 0) {
      return NextResponse.json(
        { error: 'No suitable interviewer found. Please try a different time.' },
        { status: 400 },
      );
    }

    const winner   = scored[0];
    // Find full candidate record for email data (includes user.email, companies, etc.)
    const winnerFull = candidates.find(c => c.id === winner.id)!;
    const slot     = winner.bestSlot;

    // ── Slot splitting ────────────────────────────────────────────────────────
    const beforeMins = (sessionStart.getTime() - slot.startTime.getTime()) / 60_000;
    const afterMins  = (slot.endTime.getTime()  - sessionEnd.getTime())    / 60_000;

    const ops: any[] = [
      // 1. Consume original slot
      prisma.availabilitySlot.update({
        where: { id: slot.id },
        data:  { isBooked: true },
      }),

      // 2. Create session
      prisma.session.create({
        data: {
          studentId:       studentProfile.id,
          interviewerId:   winner.id,
          sessionType:     'INTERVIEW',
          role,
          difficulty:      difficulty as DifficultyLevel,
          interviewType:   interviewType as InterviewType,
          durationMinutes: duration,
          scheduledTime:   sessionStart,
        },
        include: { interviewer: { select: { name: true } } },
      }),

      // 3. Increment interview usage
      prisma.studentProfile.update({
        where: { id: studentProfile.id },
        data:  { interviewsUsed: { increment: 1 } },
      }),
    ];

    // 4. Keep BEFORE gap
    if (beforeMins >= MIN_REMAINDER_MINUTES) {
      ops.push(
        prisma.availabilitySlot.create({
          data: {
            interviewerId: winner.id,
            startTime:     slot.startTime,
            endTime:       sessionStart,
            isBooked:      false,
          },
        }),
      );
    }

    // 5. Keep AFTER gap
    if (afterMins >= MIN_REMAINDER_MINUTES) {
      ops.push(
        prisma.availabilitySlot.create({
          data: {
            interviewerId: winner.id,
            startTime:     sessionEnd,
            endTime:       slot.endTime,
            isBooked:      false,
          },
        }),
      );
    }

    const results = await prisma.$transaction(ops);
    const session = results[1];

    // ── Send booking confirmation emails (non-blocking) ───────────────────────
    const emailData = {
      sessionType: 'INTERVIEW' as const,
      scheduledTime: sessionStart,
      durationMinutes: duration,
      role,
      difficulty,
      interviewType,

      studentName:       studentProfile.name,
      studentEmail:      studentProfile.user.email,
      studentCollege:    studentProfile.college,
      studentBranch:     studentProfile.branch,
      studentTargetRole: studentProfile.targetRole,

      interviewerName:              winner.name,
      interviewerEmail:             winnerFull.user.email,
      interviewerCompanies:         winnerFull.companies,
      interviewerYearsOfExperience: winner.yearsOfExperience,
      interviewerLinkedinUrl:       winnerFull.linkedinUrl,
    };

    // Fire-and-forget — don't await so the API response is instant
    Promise.all([
      sendBookingConfirmationToStudent(emailData),
      sendBookingNotificationToInterviewer(emailData),
    ]).catch(err => console.error('Email sending failed (non-critical):', err));

    return NextResponse.json({
      session,
      assignedInterviewer: {
        id:    winner.id,
        name:  winner.name,
        score: winner.score,
      },
      slotSplit: {
        beforeMinutesReclaimed: beforeMins >= MIN_REMAINDER_MINUTES ? Math.round(beforeMins) : 0,
        afterMinutesReclaimed:  afterMins  >= MIN_REMAINDER_MINUTES ? Math.round(afterMins)  : 0,
      },
    });
  } catch (error: any) {
    console.error('Book interview error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) },
    );
  }
}