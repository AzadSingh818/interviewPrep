import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { DifficultyLevel, InterviewType } from '@prisma/client';
export const dynamic = 'force-dynamic';

// ... rest of your route
/**
 * Manual assignment endpoint for admins
 * Allows admins to manually assign an interviewer to a session
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth(['ADMIN']);
    const body = await request.json();

    const { sessionId, interviewerId } = body;

    if (!sessionId || !interviewerId) {
      return NextResponse.json(
        { error: 'Session ID and Interviewer ID are required' },
        { status: 400 }
      );
    }

    // Verify session exists and is not already assigned
    const session = await prisma.session.findUnique({
      where: { id: parseInt(sessionId) },
      include: {
        interviewer: true,
        student: true,
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Verify interviewer exists and is approved
    const interviewer = await prisma.interviewerProfile.findUnique({
      where: { id: parseInt(interviewerId) },
    });

    if (!interviewer || interviewer.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Interviewer not available or not approved' },
        { status: 400 }
      );
    }

    // Check if interviewer supports the session requirements
    if (session.sessionType === 'INTERVIEW') {
      if (!interviewer.sessionTypesOffered.includes('INTERVIEW')) {
        return NextResponse.json(
          { error: 'Interviewer does not offer interview sessions' },
          { status: 400 }
        );
      }

      if (session.role && !interviewer.rolesSupported.includes(session.role)) {
        return NextResponse.json(
          { error: 'Interviewer does not support this role' },
          { status: 400 }
        );
      }

      if (session.difficulty && !interviewer.difficultyLevels.includes(session.difficulty)) {
        return NextResponse.json(
          { error: 'Interviewer does not handle this difficulty level' },
          { status: 400 }
        );
      }
    } else if (session.sessionType === 'GUIDANCE') {
      if (!interviewer.sessionTypesOffered.includes('GUIDANCE')) {
        return NextResponse.json(
          { error: 'Interviewer does not offer guidance sessions' },
          { status: 400 }
        );
      }
    }

    // Update session with new interviewer
    const updatedSession = await prisma.session.update({
      where: { id: session.id },
      data: { interviewerId: interviewer.id },
      include: {
        interviewer: true,
        student: true,
      },
    });

    return NextResponse.json({
      session: updatedSession,
      message: 'Interviewer assigned successfully',
    });
  } catch (error: any) {
    console.error('Manual assignment error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : 500 }
    );
  }
}

/**
 * Get available interviewers for a specific session
 * Helps admin make manual assignment decisions
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth(['ADMIN']);
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const session = await prisma.session.findUnique({
      where: { id: parseInt(sessionId) },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Find suitable interviewers based on session type
    let whereClause: any = {
      status: 'APPROVED',
    };

    if (session.sessionType === 'INTERVIEW') {
      whereClause.sessionTypesOffered = { has: 'INTERVIEW' };
      if (session.role) {
        whereClause.rolesSupported = { has: session.role };
      }
      if (session.difficulty) {
        whereClause.difficultyLevels = { has: session.difficulty };
      }
    } else {
      whereClause.sessionTypesOffered = { has: 'GUIDANCE' };
    }

    const availableInterviewers = await prisma.interviewerProfile.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            email: true,
          },
        },
        sessions: {
          where: {
            scheduledTime: {
              gte: new Date(),
            },
            status: 'SCHEDULED',
          },
        },
      },
    });

    // Add session count for each interviewer
    const interviewersWithCount = availableInterviewers.map((interviewer) => ({
      ...interviewer,
      upcomingSessionCount: interviewer.sessions.length,
    }));

    return NextResponse.json({
      interviewers: interviewersWithCount,
      session,
    });
  } catch (error: any) {
    console.error('Get available interviewers error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : 500 }
    );
  }
}