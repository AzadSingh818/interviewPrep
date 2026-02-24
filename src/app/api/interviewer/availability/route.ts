import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';

export async function GET() {
  try {
    const { userId } = await requireAuth(['INTERVIEWER']);

    const profile = await prisma.interviewerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        availabilitySlots: {
          orderBy: { startTime: 'asc' },
        },
      },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Interviewer profile not found' }, { status: 404 });
    }

    return NextResponse.json({ slots: profile.availabilitySlots });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(['INTERVIEWER']);
    const body = await request.json();

    const { startTime, endTime } = body;

    if (!startTime || !endTime) {
      return NextResponse.json({ error: 'Start time and end time are required' }, { status: 400 });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    // Validate: end must be after start
    if (end <= start) {
      return NextResponse.json(
        { error: 'End time must be after start time' },
        { status: 400 }
      );
    }

    // Validate: slot must be between 30 mins and 4 hours
    const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    if (durationMinutes < 30 || durationMinutes > 240) {
      return NextResponse.json(
        { error: 'Slot duration must be between 30 minutes and 4 hours' },
        { status: 400 }
      );
    }

    // Validate: slot must be in the future
    if (start <= new Date()) {
      return NextResponse.json(
        { error: 'Availability slot must be in the future' },
        { status: 400 }
      );
    }

    const profile = await prisma.interviewerProfile.findUnique({
      where: { userId },
      select: { id: true, status: true },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Please complete your profile first' }, { status: 400 });
    }

    if (profile.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Your profile must be approved before adding availability' },
        { status: 403 }
      );
    }

    // Check for overlapping slots — only check future slots, ignore expired ones
    const overlapping = await prisma.availabilitySlot.findFirst({
      where: {
        interviewerId: profile.id,
        isBooked: false,
        endTime: { gt: new Date() }, // ✅ ignore expired/past slots
        OR: [
          { startTime: { lt: end }, endTime: { gt: start } },
        ],
      },
    });

    if (overlapping) {
      return NextResponse.json(
        { error: 'This time slot overlaps with an existing slot' },
        { status: 400 }
      );
    }

    const slot = await prisma.availabilitySlot.create({
      data: {
        interviewerId: profile.id,
        startTime: start,
        endTime: end,
      },
    });

    return NextResponse.json({ slot });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await requireAuth(['INTERVIEWER']);

    // Support both query param (?id=) and request body ({ slotId })
    const url = new URL(request.url);
    const queryId = url.searchParams.get('id');

    let slotId: number;

    if (queryId) {
      slotId = parseInt(queryId);
    } else {
      const body = await request.json();
      slotId = parseInt(body.slotId);
    }

    if (!slotId || isNaN(slotId)) {
      return NextResponse.json({ error: 'Slot ID is required' }, { status: 400 });
    }

    const profile = await prisma.interviewerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Interviewer profile not found' }, { status: 404 });
    }

    const deleted = await prisma.availabilitySlot.deleteMany({
      where: { id: slotId, interviewerId: profile.id, isBooked: false },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: 'Slot not found or already booked' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) }
    );
  }
}