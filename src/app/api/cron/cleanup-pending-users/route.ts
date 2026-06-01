// app/api/cron/cleanup-pending-users/route.ts
// Optional: API route to clean up expired pending signups
// You can call this periodically using a cron service like Vercel Cron or run it manually

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readRequiredEnv } from '@/lib/env';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify this is being called by authorized source
    // For production, add authentication here
    const authHeader = request.headers.get('authorization');
    const cronSecret = readRequiredEnv('CRON_SECRET');
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete expired pending users (older than 24 hours)
    const result = await prisma.pendingUser.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(), // Less than current time
        },
      },
    });

    const expiredRateLimits = await prisma.rateLimitBucket.deleteMany({
      where: {
        resetAt: { lt: new Date() },
      },
    });

    console.log(`✅ Cleaned up ${result.count} expired pending users`);

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      expiredRateLimitBuckets: expiredRateLimits.count,
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
