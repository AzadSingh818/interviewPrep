import { NextRequest, NextResponse } from 'next/server';
import { processPendingEmailJobs } from '@/lib/email-queue';
import { readRequiredEnv } from '@/lib/env';
import { captureError } from '@/lib/monitoring';

export const dynamic = 'force-dynamic';

async function handleRequest(request: NextRequest) {
  try {
    const cronSecret = readRequiredEnv('CRON_SECRET');

    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await processPendingEmailJobs();

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    captureError(error, { route: '/api/cron/process-email-jobs' });
    return NextResponse.json({ error: 'Email job processing failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}
