import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';

export async function GET() {
  try {
    const { userId } = await requireAuth(['INTERVIEWER']);

    // Single query — profile + sessions together
    const profile = await prisma.interviewerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        sessions: {
          orderBy: { scheduledTime: 'desc' },
          include: {
            student: true,
            feedback: true,
          },
        },
      },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Interviewer profile not found' }, { status: 404 });
    }

    return NextResponse.json({ sessions: profile.sessions });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) }
    );
  }
}