import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authErrorStatus, removeAuthCookie, requireAuth } from '@/lib/auth';

export async function POST() {
  try {
    const user = await requireAuth();

    await prisma.user.updateMany({
      where: {
        id: user.userId,
        tokenVersion: user.tokenVersion,
      },
      data: { tokenVersion: { increment: 1 } },
    });

    await removeAuthCookie();

    return NextResponse.json(
      { success: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: any) {
    await removeAuthCookie();
    return NextResponse.json(
      { error: error.message || 'Logout failed' },
      { status: authErrorStatus(error.message), headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
