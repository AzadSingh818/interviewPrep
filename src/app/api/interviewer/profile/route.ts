import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';
import { DifficultyLevel, SessionType } from '@prisma/client';

export async function GET() {
  try {
    const { userId } = await requireAuth(['INTERVIEWER', 'ADMIN']);

    // Single query — fetches user + interviewer profile together
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        profilePicture: true,
        provider: true,
        interviewerProfile: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { interviewerProfile: profile, ...userData } = user;

    return NextResponse.json({ profile, user: userData });
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

    const {
      name,
      education,
      companies,
      yearsOfExperience,
      rolesSupported,
      difficultyLevels,
      sessionTypesOffered,
      linkedinUrl,
    } = body;

    if (!name || !rolesSupported?.length || !difficultyLevels?.length || !sessionTypesOffered?.length) {
      return NextResponse.json(
        { error: 'Name, roles, difficulty levels, and session types are required' },
        { status: 400 }
      );
    }

    const validDifficultyLevels = difficultyLevels.every((level: string) =>
      ['EASY', 'MEDIUM', 'HARD'].includes(level)
    );
    const validSessionTypes = sessionTypesOffered.every((type: string) =>
      ['GUIDANCE', 'INTERVIEW'].includes(type)
    );

    if (!validDifficultyLevels || !validSessionTypes) {
      return NextResponse.json(
        { error: 'Invalid difficulty levels or session types' },
        { status: 400 }
      );
    }

    // Upsert profile + fetch user data in parallel
    const [profile, userData] = await Promise.all([
      prisma.interviewerProfile.upsert({
        where: { userId },
        update: {
          name,
          education,
          companies: companies || [],
          yearsOfExperience: yearsOfExperience ? parseInt(yearsOfExperience) : null,
          rolesSupported,
          difficultyLevels: difficultyLevels as DifficultyLevel[],
          sessionTypesOffered: sessionTypesOffered as SessionType[],
          linkedinUrl,
        },
        create: {
          userId,
          name,
          education,
          companies: companies || [],
          yearsOfExperience: yearsOfExperience ? parseInt(yearsOfExperience) : null,
          rolesSupported,
          difficultyLevels: difficultyLevels as DifficultyLevel[],
          sessionTypesOffered: sessionTypesOffered as SessionType[],
          linkedinUrl,
          status: 'PENDING',
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

    return NextResponse.json({ profile, user: userData });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) }
    );
  }
}