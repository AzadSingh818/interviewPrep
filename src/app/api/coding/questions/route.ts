// src/app/api/coding/questions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { userId, role } = await requireAuth(['STUDENT', 'INTERVIEWER', 'ADMIN']);

    const { searchParams } = new URL(request.url);
    const difficulty = searchParams.get('difficulty');
    const category   = searchParams.get('category');
    const search     = searchParams.get('search');

    // Build filter
    const where: any = { isActive: true };
    if (difficulty && difficulty !== 'ALL') where.difficulty = difficulty;
    if (category   && category   !== 'ALL') where.category   = category;
    if (search) {
      where.OR = [
        { title:    { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { tags:     { has: search } },
      ];
    }

    const questions = await (prisma as any).codingQuestion.findMany({
      where,
      select: {
        id:         true,
        title:      true,
        slug:       true,
        difficulty: true,
        category:   true,
        tags:       true,
        orderIndex: true,
        // Count submissions for this user to track solved status
        submissions: {
          where: {
            student: { userId: parseInt(userId as any) },
            status: 'ACCEPTED',
          },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { orderIndex: 'asc' },
    });

    // Also get student profile id for solved tracking
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: userId as any },
      select: { id: true },
    });

    // Get all accepted submissions for this student
    let solvedQuestionIds: Set<number> = new Set();
    if (studentProfile) {
      const accepted = await (prisma as any).codingSubmission.findMany({
        where: {
          studentId: studentProfile.id,
          status: 'ACCEPTED',
        },
        select: { questionId: true },
        distinct: ['questionId'],
      });
      solvedQuestionIds = new Set(accepted.map((s: any) => s.questionId));
    }

    // Get total submissions per question for this student
    const submissionCounts = studentProfile
      ? await (prisma as any).codingSubmission.groupBy({
          by: ['questionId'],
          where: { studentId: studentProfile.id },
          _count: { id: true },
        })
      : [];

    const countMap = new Map(submissionCounts.map((s: any) => [s.questionId, s._count.id]));

    const enriched = questions.map((q: any) => ({
      id:           q.id,
      title:        q.title,
      slug:         q.slug,
      difficulty:   q.difficulty,
      category:     q.category,
      tags:         q.tags,
      solved:       solvedQuestionIds.has(q.id),
      attempted:    (countMap.get(q.id) || 0) > 0,
      submissions:  countMap.get(q.id) || 0,
    }));

    // Also return unique categories for filter
    const allQuestions = await (prisma as any).codingQuestion.findMany({
      where: { isActive: true },
      select: { category: true, difficulty: true },
    });
    const categories = [...new Set(allQuestions.map((q: any) => q.category))].sort();

    return NextResponse.json({ questions: enriched, categories });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) },
    );
  }
}

// Admin: Create new question
export async function POST(request: NextRequest) {
  try {
    await requireAuth(['ADMIN']);
    const body = await request.json();

    const {
      title, slug, description, difficulty, category,
      tags, constraints, examples, testCases, starterCode,
      solution, hints, orderIndex,
    } = body;

    if (!title || !slug || !description || !difficulty || !category) {
      return NextResponse.json({ error: 'Required fields missing' }, { status: 400 });
    }

    const question = await (prisma as any).codingQuestion.create({
      data: {
        title, slug, description, difficulty, category,
        tags:        tags        || [],
        constraints: constraints || null,
        examples:    examples    || [],
        testCases:   testCases   || [],
        starterCode: starterCode || { c: '', cpp: '', sql: '' },
        solution:    solution    || null,
        hints:       hints       || [],
        orderIndex:  orderIndex  || 0,
      },
    });

    return NextResponse.json({ question });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create question' },
      { status: 500 },
    );
  }
}