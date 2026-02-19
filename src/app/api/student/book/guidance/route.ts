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

    // Fetch student profile + verify interviewer in parallel
    const [studentProfile, interviewer] = await Promise.all([
      prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } }),
      prisma.interviewerProfile.findUnique({
        where: { id: parseInt(interviewerId) },
        select: { id: true, status: true, sessionTypesOffered: true },
      }),
    ]);

    if (!studentProfile) {
      return NextResponse.json({ error: 'Please complete your profile first' }, { status: 400 });
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

    // Find available slot
    const slot = await prisma.availabilitySlot.findFirst({
      where: {
        interviewerId: interviewer.id,
        startTime: new Date(scheduledTime),
        isBooked: false,
      },
      select: { id: true },
    });

    if (!slot) {
      return NextResponse.json({ error: 'Selected time slot is not available' }, { status: 400 });
    }

    // Create session + mark slot booked atomically
    const [session] = await prisma.$transaction([
      prisma.session.create({
        data: {
          studentId: studentProfile.id,
          interviewerId: interviewer.id,
          sessionType: 'GUIDANCE',
          topic,
          durationMinutes: parseInt(durationMinutes),
          scheduledTime: new Date(scheduledTime),
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