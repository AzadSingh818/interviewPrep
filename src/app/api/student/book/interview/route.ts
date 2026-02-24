import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';
import { DifficultyLevel, InterviewType } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(['STUDENT']);
    const body = await request.json();

    const { role, difficulty, interviewType, durationMinutes, scheduledTime } = body;

    if (!role || !difficulty || !interviewType || !durationMinutes || !scheduledTime) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const scheduledDate = new Date(scheduledTime);

    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        { error: 'Scheduled time must be in the future' },
        { status: 400 }
      );
    }

    const [studentProfile, availableInterviewers] = await Promise.all([
      prisma.studentProfile.findUnique({
        where: { userId },
        select: {
          id: true,
          planType: true,
          interviewsUsed: true,
          interviewsLimit: true,
          planExpiresAt: true,
        },
      }),
      prisma.interviewerProfile.findMany({
        where: {
          status: 'APPROVED',
          difficultyLevels: { has: difficulty as DifficultyLevel },
          sessionTypesOffered: { has: 'INTERVIEW' },
          interviewTypesOffered: { has: interviewType as InterviewType },
          availabilitySlots: {
            some: {
              startTime: { lte: scheduledDate },
              endTime: { gte: scheduledDate },
              isBooked: false,
            },
          },
        },
        select: {
          id: true,
          name: true,
          rolesSupported: true,
          availabilitySlots: {
            where: {
              startTime: { lte: scheduledDate },
              endTime: { gte: scheduledDate },
              isBooked: false,
            },
            select: { id: true },
          },
          _count: {
            select: {
              sessions: {
                where: { scheduledTime: { gte: new Date() }, status: 'SCHEDULED' },
              },
            },
          },
        },
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
      studentProfile.planType = 'FREE';
      studentProfile.interviewsUsed = 0;
      studentProfile.interviewsLimit = 5;
    }

    // ── Quota check ──────────────────────────────────────────────────────────
    if (studentProfile.interviewsUsed >= studentProfile.interviewsLimit) {
      return NextResponse.json(
        {
          error: 'LIMIT_REACHED',
          message:
            studentProfile.planType === 'FREE'
              ? 'You have used all 5 free interviews. Upgrade to Pro for ₹99/month to get 10 more.'
              : 'You have used all 10 interviews for this month. Renew your plan to continue.',
          planType: studentProfile.planType,
          used: studentProfile.interviewsUsed,
          limit: studentProfile.interviewsLimit,
        },
        { status: 403 }
      );
    }

    if (availableInterviewers.length === 0) {
      return NextResponse.json(
        { error: 'No interviewers available for the selected criteria and time slot' },
        { status: 400 }
      );
    }

    // Prefer interviewers who support the student's role, then load-balance
    const roleNormalized = role.toLowerCase().trim();
    const withRoleMatch = availableInterviewers.filter((i) =>
      i.rolesSupported.some(
        (r) =>
          r.toLowerCase().includes(roleNormalized) ||
          roleNormalized.includes(r.toLowerCase())
      )
    );
    const pool = withRoleMatch.length > 0 ? withRoleMatch : availableInterviewers;
    const selectedInterviewer = pool.reduce((prev, current) =>
      prev._count.sessions <= current._count.sessions ? prev : current
    );

    const slot = selectedInterviewer.availabilitySlots[0];
    if (!slot) {
      return NextResponse.json(
        { error: 'No available slot found. Please try again.' },
        { status: 400 }
      );
    }

    // ── Create session + mark slot booked + increment usage atomically ────────
    const [session] = await prisma.$transaction([
      prisma.session.create({
        data: {
          studentId: studentProfile.id,
          interviewerId: selectedInterviewer.id,
          sessionType: 'INTERVIEW',
          role,
          difficulty: difficulty as DifficultyLevel,
          interviewType: interviewType as InterviewType,
          durationMinutes: parseInt(durationMinutes),
          scheduledTime: scheduledDate,
        },
        include: { interviewer: { select: { name: true } } },
      }),
      prisma.availabilitySlot.update({
        where: { id: slot.id },
        data: { isBooked: true },
      }),
      prisma.studentProfile.update({
        where: { id: studentProfile.id },
        data: { interviewsUsed: { increment: 1 } },
      }),
    ]);

    return NextResponse.json({
      session,
      assignedInterviewer: {
        id: selectedInterviewer.id,
        name: selectedInterviewer.name,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) }
    );
  }
}