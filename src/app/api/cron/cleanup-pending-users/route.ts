// app/api/cron/cleanup-pending-users/route.ts
// Optional: API route to clean up expired pending signups
// You can call this periodically using a cron service like Vercel Cron or run it manually

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify this is being called by authorized source
    // For production, add authentication here
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete expired pending users (older than 24 hours)
    const result = await (prisma as any).pendingUser.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(), // Less than current time
        },
      },
    });

    console.log(`✅ Cleaned up ${result.count} expired pending users`);

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      message: `Deleted ${result.count} expired pending signups`,
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: 'Cleanup failed' },
      { status: 500 }
    );
  }
}

// For Vercel Cron Jobs, add this to vercel.json:
/*
{
  "crons": [{
    "path": "/api/cron/cleanup-pending-users",
    "schedule": "0 * * * *"
  }]
}
*/