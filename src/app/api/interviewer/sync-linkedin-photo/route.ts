import { NextResponse } from 'next/server';
import { requireAuth, authErrorStatus } from '@/lib/auth';

/**
 * POST /api/interviewer/sync-linkedin-photo
 *
 * This feature is disabled because server-side fetching of user-provided
 * profile URLs creates SSRF risk. Users should upload a profile photo instead.
 */
export async function POST() {
  try {
    await requireAuth(['INTERVIEWER']);

    return NextResponse.json(
      {
        error: 'LinkedIn photo sync is disabled for security. Please upload a profile photo manually.',
        code: 'LINKEDIN_SYNC_DISABLED',
      },
      { status: 410 },
    );
  } catch (error: any) {
    console.error('LinkedIn photo sync error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) },
    );
  }
}
