import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { DifficultyLevel, SessionType } from '@prisma/client';

export async function GET() {
  try {
    const user = await requireAuth(['INTERVIEWER', 'ADMIN']);

    const [profile, userData] = await Promise.all([
      prisma.interviewerProfile.findUnique({
        where: { userId: user.id },
      }),
      // ✅ Also fetch user data (name, email, profilePicture, provider)
      prisma.user.findUnique({
        where: { id: user.id },
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
    console.error('Get interviewer profile error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(['INTERVIEWER']);
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

    const profile = await prisma.interviewerProfile.upsert({
      where: { userId: user.id },
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
        userId: user.id,
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
    });

    // Also return user data in POST response
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        profilePicture: true,
        provider: true,
      },
    });

    return NextResponse.json({ profile, user: userData });
  } catch (error: any) {
    console.error('Create/update interviewer profile error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.message === 'Unauthorized' ? 401 : error.message === 'Forbidden' ? 403 : 500 }
    );
  }
}