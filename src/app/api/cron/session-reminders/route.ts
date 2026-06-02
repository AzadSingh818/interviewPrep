import { NextRequest, NextResponse } from 'next/server';
import { processDueSessionReminders } from '@/lib/scheduler';
import { readRequiredEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

async function handleRequest(request: NextRequest) {
  try {
    const cronSecret = readRequiredEnv('CRON_SECRET');

    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await processDueSessionReminders();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Session reminder cron error:', error);
    return NextResponse.json({ error: 'Session reminder processing failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}
