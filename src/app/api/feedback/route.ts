import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';
import { HiringRecommendation } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const feedback = await prisma.feedback.findUnique({
      where: { sessionId: parseInt(sessionId) },
      include: {
        session: {
          include: {
            student: true,
            interviewer: true,
          },
        },
      },
    });

    if (!feedback) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }

    return NextResponse.json({ feedback });
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

    const { sessionId, sessionType, ...feedbackData } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const [interviewerProfile, session] = await Promise.all([
      prisma.interviewerProfile.findUnique({
        where: { userId },
        select: { id: true },
      }),
      prisma.session.findUnique({
        where: { id: parseInt(sessionId) },
        select: { id: true, interviewerId: true, sessionType: true },
      }),
    ]);

    if (!interviewerProfile) {
      return NextResponse.json({ error: 'Interviewer profile not found' }, { status: 404 });
    }

    if (!session || session.interviewerId !== interviewerProfile.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const resolvedSessionType = sessionType || session.sessionType;

    if (resolvedSessionType === 'GUIDANCE') {
      const { summary, strengths, recommendations, actionItems } = feedbackData;
      if (!summary || !strengths || !recommendations || !actionItems) {
        return NextResponse.json(
          { error: 'All guidance feedback fields are required' },
          { status: 400 }
        );
      }

      const [feedback] = await prisma.$transaction([
        prisma.feedback.create({
          data: {
            sessionId: session.id,
            interviewerId: interviewerProfile.id,
            summary,
            strengths,
            recommendations,
            actionItems,
          },
        }),
        prisma.session.update({
          where: { id: session.id },
          data: { status: 'COMPLETED' },
        }),
      ]);

      return NextResponse.json({ feedback });
    } else if (resolvedSessionType === 'INTERVIEW') {
      const {
        summary,
        technicalDepth,
        problemSolving,
        communication,
        confidence,
        overallComments,
        hiringRecommendation,
      } = feedbackData;

      if (
        !summary || !technicalDepth || !problemSolving ||
        !communication || !confidence || !overallComments || !hiringRecommendation
      ) {
        return NextResponse.json(
          { error: 'All interview feedback fields are required' },
          { status: 400 }
        );
      }

      const [feedback] = await prisma.$transaction([
        prisma.feedback.create({
          data: {
            sessionId: session.id,
            interviewerId: interviewerProfile.id,
            summary,
            technicalDepth: parseInt(technicalDepth),
            problemSolving: parseInt(problemSolving),
            communication: parseInt(communication),
            confidence: parseInt(confidence),
            overallComments,
            hiringRecommendation: hiringRecommendation as HiringRecommendation,
          },
        }),
        prisma.session.update({
          where: { id: session.id },
          data: { status: 'COMPLETED' },
        }),
      ]);

      return NextResponse.json({ feedback });
    } else {
      return NextResponse.json({ error: 'Invalid session type' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) }
    );
  }
}

// ── Student submits rating for the interviewer ────────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await requireAuth(['STUDENT']);
    const body = await request.json();
    const { sessionId, studentRating, studentRatingComment } = body;

    if (!sessionId || !studentRating) {
      return NextResponse.json({ error: 'Session ID and rating are required' }, { status: 400 });
    }

    if (studentRating < 1 || studentRating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    // Verify the session belongs to this student
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!studentProfile) {
      return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
    }

    const session = await prisma.session.findUnique({
      where: { id: parseInt(sessionId) },
      select: { id: true, studentId: true, interviewerId: true, status: true },
    });

    if (!session || session.studentId !== studentProfile.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Can only rate completed sessions' }, { status: 400 });
    }

    // Check feedback exists and student hasn't already rated
    const existingFeedback = await prisma.feedback.findUnique({
      where: { sessionId: parseInt(sessionId) },
      select: { id: true, studentRating: true, interviewerId: true },
    });

    if (!existingFeedback) {
      return NextResponse.json({ error: 'Feedback not found for this session' }, { status: 404 });
    }

    if (existingFeedback.studentRating !== null) {
      return NextResponse.json({ error: 'You have already rated this session' }, { status: 400 });
    }

    // Save rating on feedback record
    await prisma.feedback.update({
      where: { sessionId: parseInt(sessionId) },
      data: { studentRating, studentRatingComment: studentRatingComment || null },
    });

    // Recalculate interviewer's average rating
    const allRatings = await prisma.feedback.findMany({
      where: {
        interviewerId: existingFeedback.interviewerId,
        studentRating: { not: null },
      },
      select: { studentRating: true },
    });

    const totalRatings = allRatings.length;
    const averageRating =
      allRatings.reduce((sum, f) => sum + (f.studentRating ?? 0), 0) / totalRatings;

    await prisma.interviewerProfile.update({
      where: { id: existingFeedback.interviewerId },
      data: {
        averageRating: Math.round(averageRating * 10) / 10, // round to 1 decimal
        totalRatings,
      },
    });

    return NextResponse.json({ success: true, averageRating, totalRatings });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) }
    );
  }
}