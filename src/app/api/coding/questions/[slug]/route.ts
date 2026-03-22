import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const { userId, role } = await requireAuth(['STUDENT', 'INTERVIEWER', 'ADMIN']);
    const { slug } = params;
    const isAdmin = role === 'ADMIN';

    // Admins can fetch inactive questions too (for editing)
    const question = await (prisma as any).codingQuestion.findUnique({
      where: isAdmin ? { slug } : { slug, isActive: true },
    });

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Admins get full data including solution & all test cases
    if (isAdmin) {
      return NextResponse.json({ question });
    }

    // Get student's submissions for this question
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: userId as any },
      select: { id: true },
    });

    let submissions: any[] = [];
    let isSolved = false;

    if (studentProfile) {
      submissions = await (prisma as any).codingSubmission.findMany({
        where: {
          studentId:  studentProfile.id,
          questionId: question.id,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id:          true,
          language:    true,
          status:      true,
          runtime:     true,
          memory:      true,
          testsPassed: true,
          totalTests:  true,
          createdAt:   true,
        },
      });
      isSolved = submissions.some((s: any) => s.status === 'ACCEPTED');
    }

    // Strip hidden test cases from response (don't show expected outputs)
    const publicTestCases = (question.testCases as any[]).map((tc: any) => ({
      input:          tc.input,
      expectedOutput: tc.isHidden ? '???' : tc.expectedOutput,
      isHidden:       tc.isHidden,
    }));

    return NextResponse.json({
      question: {
        ...question,
        testCases: publicTestCases,
        solution:  undefined, // never send solution to client
      },
      submissions,
      isSolved,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    await requireAuth(['ADMIN']);
    const { slug } = params;
    const body = await request.json();

    // Verify question exists
    const existing = await (prisma as any).codingQuestion.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    const {
      title, description, difficulty, category,
      tags, constraints, hints, orderIndex,
      examples, testCases, starterCode, solution,
    } = body;

    if (!title || !description || !difficulty || !category) {
      return NextResponse.json(
        { error: 'title, description, difficulty, and category are required' },
        { status: 400 },
      );
    }

    const updated = await (prisma as any).codingQuestion.update({
      where: { slug },
      data: {
        title:       title.trim(),
        description: description.trim(),
        difficulty,
        category:    category.trim(),
        tags:        tags        || [],
        constraints: constraints || null,
        hints:       hints       || [],
        orderIndex:  orderIndex  ?? 0,
        examples:    examples    || [],
        testCases:   testCases   || [],
        starterCode: starterCode || {},
        solution:    solution    || null,
      },
    });

    return NextResponse.json({ question: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    await requireAuth(['ADMIN']);
    const { slug } = params;

    const existing = await (prisma as any).codingQuestion.findUnique({
      where: { slug },
      select: { id: true, title: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Soft-delete: set isActive = false so submissions history is preserved
    await (prisma as any).codingQuestion.update({
      where: { slug },
      data:  { isActive: false },
    });

    return NextResponse.json({ success: true, message: `"${existing.title}" deleted.` });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) },
    );
  }
}