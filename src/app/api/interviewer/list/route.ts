import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';

export async function GET() {
  try {
    await requireAuth(['STUDENT']);

    const interviewers = await prisma.interviewerProfile.findMany({
      where: {
        status: 'APPROVED',
        sessionTypesOffered: { has: 'GUIDANCE' },
      },
      include: {
        availabilitySlots: {
          where: {
            startTime: { gte: new Date() },
            isBooked: false,
          },
          orderBy: { startTime: 'asc' },
        },
      },
    });

    return NextResponse.json({ interviewers });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) }
    );
  }
}