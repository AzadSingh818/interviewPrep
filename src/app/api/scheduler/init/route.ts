import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      error: 'In-process scheduler init is disabled. Call /api/cron/session-reminders from your scheduler instead.',
      code: 'SCHEDULER_INIT_DISABLED',
    },
    { status: 410 },
  );
}
