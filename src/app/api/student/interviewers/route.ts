import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET — returns only APPROVED interviewers (accessible by students)
export async function GET() {
  try {
    await requireAuth(['STUDENT']);

    const interviewers = await prisma.interviewerProfile.findMany({
      where: { status: 'APPROVED' },
      select: {
        id: true,
        name: true,
        companies: true,
        rolesSupported: true,
        yearsOfExperience: true,
        careerLevel: true,
        sessionTypesOffered: true,
        interviewTypesOffered: true,
        linkedinUrl: true,
        user: {
          select: {
            name: true,
            profilePicture: true,
          },
        },
        _count: {
          select: { sessions: true },
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