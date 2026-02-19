import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';

export async function GET() {
  try {
    const { userId } = await requireAuth(['STUDENT']);

    // Single query — finds profile and fetches sessions with nested data
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        sessions: {
          orderBy: { scheduledTime: 'desc' },
          include: {
            interviewer: {
              select: {
                id: true,
                name: true,
                companies: true,
                rolesSupported: true,
                user: {
                  select: { email: true },
                },
              },
            },
            feedback: true,
          },
        },
      },
    });

    if (!studentProfile) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
    }

    return NextResponse.json({ sessions: studentProfile.sessions });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) }
    );
  }
}