import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readRequiredEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

async function handleRequest(request: NextRequest) {
  try {
    const cronSecret = readRequiredEnv('CRON_SECRET');

    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const staleBefore = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const sessionSafeBefore = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const protectedSessions = await prisma.session.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledTime: { gt: sessionSafeBefore },
      },
      select: { id: true },
    });
    const protectedRoomIds = protectedSessions.map((session) => String(session.id));

    const result = await prisma.signalingRoom.deleteMany({
      where: {
        updatedAt: { lt: staleBefore },
        id: { notIn: protectedRoomIds },
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
    });
  } catch (error) {
    console.error('Signaling room cleanup error:', error);
    return NextResponse.json({ error: 'Signaling room cleanup failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}
