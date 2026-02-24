import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAuth(['ADMIN']);

    // All counts in a single Promise.all — fire in parallel
    const [
      totalStudents,
      totalInterviewers,
      pendingInterviewers,
      approvedInterviewers,
      totalSessions,
      completedSessions,
      scheduledSessions,
      guidanceSessions,
      interviewSessions,
      recentSessions,
      topInterviewers,
    ] = await Promise.all([
      prisma.studentProfile.count(),
      prisma.interviewerProfile.count(),
      prisma.interviewerProfile.count({ where: { status: 'PENDING' } }),
      prisma.interviewerProfile.count({ where: { status: 'APPROVED' } }),
      prisma.session.count(),
      prisma.session.count({ where: { status: 'COMPLETED' } }),
      prisma.session.count({ where: { status: 'SCHEDULED' } }),
      prisma.session.count({ where: { sessionType: 'GUIDANCE' } }),
      prisma.session.count({ where: { sessionType: 'INTERVIEW' } }),
      // Recent sessions with only required fields
      prisma.session.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          sessionType: true,
          status: true,
          scheduledTime: true,
          student: { select: { name: true } },
          interviewer: { select: { name: true } },
        },
      }),
      // Top interviewers using _count (no N+1 sessions fetch)
      prisma.interviewerProfile.findMany({
        take: 5,
        where: { status: 'APPROVED' },
        select: {
          id: true,
          name: true,
          rolesSupported: true,
          _count: {
            select: { sessions: { where: { status: 'COMPLETED' } } },
          },
        },
        orderBy: {
          sessions: { _count: 'desc' },
        },
      }),
    ]);

    const topInterviewersWithCount = topInterviewers.map(i => ({
      ...i,
      sessionCount: i._count.sessions,
    }));

    return NextResponse.json({
      analytics: {
        totalStudents,
        totalInterviewers,
        pendingInterviewers,
        approvedInterviewers,
        totalSessions,
        completedSessions,
        scheduledSessions,
        guidanceSessions,
        interviewSessions,
      },
      recentSessions,
      topInterviewers: topInterviewersWithCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) }
    );
  }
}