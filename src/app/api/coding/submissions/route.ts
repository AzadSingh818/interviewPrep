// src/app/api/coding/submissions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth(['STUDENT']);
    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get('questionId');

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: userId as any },
      select: { id: true },
    });
    if (!studentProfile) {
      return NextResponse.json({ submissions: [] });
    }

    const where: any = { studentId: studentProfile.id };
    if (questionId) where.questionId = parseInt(questionId);

    const submissions = await (prisma as any).codingSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        question: { select: { title: true, slug: true, difficulty: true } },
      },
    });

    return NextResponse.json({ submissions });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) },
    );
  }
}