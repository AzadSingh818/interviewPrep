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

    // Fetch student profile + available interviewers in parallel
    const [studentProfile, availableInterviewers] = await Promise.all([
      prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } }),
      prisma.interviewerProfile.findMany({
        where: {
          status: 'APPROVED',
          rolesSupported: { has: role },
          difficultyLevels: { has: difficulty as DifficultyLevel },
          sessionTypesOffered: { has: 'INTERVIEW' },
          availabilitySlots: {
            some: { startTime: scheduledDate, isBooked: false },
          },
        },
        select: {
          id: true,
          availabilitySlots: {
            where: { startTime: scheduledDate, isBooked: false },
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

    if (availableInterviewers.length === 0) {
      return NextResponse.json(
        { error: 'No interviewers available for the selected criteria and time slot' },
        { status: 400 }
      );
    }

    // Load balancing: pick interviewer with fewest upcoming sessions
    const selectedInterviewer = availableInterviewers.reduce((prev, current) =>
      prev._count.sessions <= current._count.sessions ? prev : current
    );

    const slot = selectedInterviewer.availabilitySlots[0];

    // Create session + mark slot booked atomically
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
        include: { interviewer: true },
      }),
      prisma.availabilitySlot.update({
        where: { id: slot.id },
        data: { isBooked: true },
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