import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';

export async function GET() {
  try {
    const { userId, role } = await requireAuth(['STUDENT', 'INTERVIEWER', 'ADMIN']);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        profilePicture: true,
        provider: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch role-specific profile
    let profile = null;
    if (role === 'STUDENT') {
      profile = await prisma.studentProfile.findUnique({
        where: { userId },
        select: { id: true, name: true },
      });
    } else if (role === 'INTERVIEWER') {
      profile = await prisma.interviewerProfile.findUnique({
        where: { userId },
        select: { id: true, name: true },
      });
    }

    return NextResponse.json({ user, profile, role });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) }
    );
  }
}