import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';

export async function GET() {
  try {
    const { userId } = await requireAuth(['INTERVIEWER']);

    // Single query — profile + slots together
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

    const slot = await prisma.availabilitySlot.create({
      data: {
        interviewerId: profile.id,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
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
    const body = await request.json();
    const { slotId } = body;

    if (!slotId) {
      return NextResponse.json({ error: 'Slot ID is required' }, { status: 400 });
    }

    // Verify slot belongs to this interviewer before deleting
    const profile = await prisma.interviewerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Interviewer profile not found' }, { status: 404 });
    }

    await prisma.availabilitySlot.deleteMany({
      where: { id: parseInt(slotId), interviewerId: profile.id, isBooked: false },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) }
    );
  }
}