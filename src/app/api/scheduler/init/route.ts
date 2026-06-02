// src/app/api/scheduler/init/route.ts
// This route is called once on app startup to start the reminder scheduler.

import { NextResponse } from 'next/server';
import { startScheduler } from '@/lib/scheduler';

let initialized = false;

export async function GET() {
  if (!initialized) {
    startScheduler();
    initialized = true;
    return NextResponse.json({ message: 'Scheduler started' });
  }
  return NextResponse.json({ message: 'Scheduler already running' });
}