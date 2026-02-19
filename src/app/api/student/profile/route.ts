import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';

export async function GET() {
  try {
    const { userId } = await requireAuth(['STUDENT']);

    // Single query — fetches user + profile together
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        profilePicture: true,
        provider: true,
        studentProfile: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { studentProfile: profile, ...userData } = user;

    return NextResponse.json({ user: userData, profile });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(['STUDENT']);
    const body = await request.json();

    const { name, college, branch, graduationYear, targetRole, experienceLevel } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Upsert profile + fetch user data in parallel
    const [profile, userData] = await Promise.all([
      prisma.studentProfile.upsert({
        where: { userId },
        update: {
          name,
          college,
          branch,
          graduationYear: graduationYear ? parseInt(graduationYear) : null,
          targetRole,
          experienceLevel,
        },
        create: {
          userId,
          name,
          college,
          branch,
          graduationYear: graduationYear ? parseInt(graduationYear) : null,
          targetRole,
          experienceLevel,
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          profilePicture: true,
          provider: true,
        },
      }),
    ]);

    return NextResponse.json({ user: userData, profile });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) }
    );
  }
}