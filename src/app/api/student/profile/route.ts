import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';

export async function GET() {
  try {
    const { userId } = await requireAuth(['STUDENT']);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        profilePicture: true,
        provider: true,
        studentProfile: {
          select: {
            id: true,
            name: true,
            college: true,
            branch: true,
            graduationYear: true,
            targetRole: true,
            experienceLevel: true,
            resumeUrl: true,
            // ── Plan fields ──────────────────────────────────────────
            planType: true,
            interviewsUsed: true,
            guidanceUsed: true,
            interviewsLimit: true,
            guidanceLimit: true,
            planExpiresAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { studentProfile: profile, ...userData } = user;

    // Auto-downgrade expired PRO plans on read
    if (
      profile?.planType === 'PRO' &&
      profile.planExpiresAt &&
      new Date(profile.planExpiresAt) < new Date()
    ) {
      const updated = await prisma.studentProfile.update({
        where: { userId },
        data: {
          planType: 'FREE',
          interviewsLimit: 5,
          guidanceLimit: 5,
          interviewsUsed: 0,
          guidanceUsed: 0,
          planExpiresAt: null,
        },
      });
      return NextResponse.json({ user: userData, profile: { ...profile, ...updated } });
    }

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
          // defaults: FREE plan, 5 each, 0 used — from schema defaults
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, profilePicture: true, provider: true },
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

export async function DELETE() {
  try {
    const { userId } = await requireAuth(['STUDENT']);

    const existing = await prisma.studentProfile.findUnique({
      where: { userId },
      select: { id: true, resumeUrl: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    if (!existing.resumeUrl) {
      return NextResponse.json({ error: 'No resume to delete' }, { status: 400 });
    }

    const profile = await prisma.studentProfile.update({
      where: { userId },
      data: { resumeUrl: null, updatedAt: new Date() },
    });

    return NextResponse.json({ profile });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) }
    );
  }
}