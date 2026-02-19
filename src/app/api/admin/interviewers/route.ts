import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';
import { InterviewerStatus } from '@prisma/client';

export async function GET() {
  try {
    await requireAuth(['ADMIN']);

    const interviewers = await prisma.interviewerProfile.findMany({
      include: {
        user: {
          select: { email: true, name: true, profilePicture: true, provider: true },
        },
        _count: {
          select: {
            sessions: {
              where: { status: 'SCHEDULED', scheduledTime: { gte: new Date() } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ interviewers });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAuth(['ADMIN']);
    const body = await request.json();

    const { interviewerId, status } = body;

    if (!interviewerId || !status) {
      return NextResponse.json(
        { error: 'Interviewer ID and status are required' },
        { status: 400 }
      );
    }

    if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const interviewer = await prisma.interviewerProfile.update({
      where: { id: parseInt(interviewerId) },
      data: { status: status as InterviewerStatus },
    });

    return NextResponse.json({ interviewer });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) }
    );
  }
}