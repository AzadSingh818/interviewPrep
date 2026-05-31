import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const staleBefore = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const result = await prisma.signalingRoom.deleteMany({
      where: {
        updatedAt: { lt: staleBefore },
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

