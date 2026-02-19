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

    // Get interviewer profile + verify session ownership in parallel
    const [interviewerProfile, session] = await Promise.all([
      prisma.interviewerProfile.findUnique({
        where: { userId },
        select: { id: true },
      }),
      // Will re-check ownership after we have the profile id
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