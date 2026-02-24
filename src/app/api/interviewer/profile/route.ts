import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';
import { DifficultyLevel, SessionType, InterviewType } from '@prisma/client';

export async function GET() {
  try {
    const { userId } = await requireAuth(['INTERVIEWER', 'ADMIN']);

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
      interviewTypesOffered, // ✅ NEW
      linkedinUrl,
    } = body;

    // Base validation
    if (!name || !rolesSupported?.length || !difficultyLevels?.length || !sessionTypesOffered?.length) {
      return NextResponse.json(
        { error: 'Name, roles, difficulty levels, and session types are required' },
        { status: 400 }
      );
    }

    // If INTERVIEW session type is selected, must pick at least one interview type
    if (sessionTypesOffered.includes('INTERVIEW') && !interviewTypesOffered?.length) {
      return NextResponse.json(
        { error: 'Please select at least one interview type (Technical, HR, or Mixed)' },
        { status: 400 }
      );
    }

    // Validate enum values
    const validDifficulty = difficultyLevels.every((l: string) =>
      ['EASY', 'MEDIUM', 'HARD'].includes(l)
    );
    const validSessionTypes = sessionTypesOffered.every((t: string) =>
      ['GUIDANCE', 'INTERVIEW'].includes(t)
    );
    const validInterviewTypes = (interviewTypesOffered || []).every((t: string) =>
      ['TECHNICAL', 'HR', 'MIXED'].includes(t)
    );

    if (!validDifficulty || !validSessionTypes || !validInterviewTypes) {
      return NextResponse.json(
        { error: 'Invalid difficulty levels, session types, or interview types' },
        { status: 400 }
      );
    }

    const profileData = {
      name,
      education,
      companies: companies || [],
      yearsOfExperience: yearsOfExperience ? parseInt(yearsOfExperience) : null,
      rolesSupported,
      difficultyLevels: difficultyLevels as DifficultyLevel[],
      sessionTypesOffered: sessionTypesOffered as SessionType[],
      // Clear interviewTypesOffered if INTERVIEW is not selected
      interviewTypesOffered: sessionTypesOffered.includes('INTERVIEW')
        ? (interviewTypesOffered as InterviewType[])
        : ([] as InterviewType[]),
      linkedinUrl,
    };

    const [profile, userData] = await Promise.all([
      prisma.interviewerProfile.upsert({
        where: { userId },
        update: profileData,
        create: { userId, ...profileData, status: 'PENDING' },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, profilePicture: true, provider: true },
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