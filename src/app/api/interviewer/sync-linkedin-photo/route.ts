import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorStatus } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/interviewer/sync-linkedin-photo
 *
 * Fetches the og:image from a LinkedIn public profile page and saves it
 * as the interviewer's profilePicture.
 *
 * ⚠️ NOTE: LinkedIn aggressively blocks bot/server requests. This works
 * for most public profiles but may return a blocked/generic image in
 * production. The client should always show a fallback upload option if
 * the returned image looks like a LinkedIn default/block page.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(['INTERVIEWER']);

    const { linkedinUrl } = await request.json();

    if (!linkedinUrl) {
      return NextResponse.json({ error: 'LinkedIn URL is required' }, { status: 400 });
    }

    // Validate it's actually a LinkedIn URL
    const isLinkedIn =
      linkedinUrl.includes('linkedin.com/in/') ||
      linkedinUrl.includes('linkedin.com/pub/');

    if (!isLinkedIn) {
      return NextResponse.json(
        { error: 'Please provide a valid LinkedIn profile URL (linkedin.com/in/...)' },
        { status: 400 },
      );
    }

    // Fetch the LinkedIn profile page with browser-like headers to avoid blocking
    let photoUrl: string | null = null;

    try {
      const res = await fetch(linkedinUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
        },
        // 8 second timeout
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        return NextResponse.json(
          {
            error: 'Could not access LinkedIn profile. Make sure the profile is public.',
            code: 'LINKEDIN_BLOCKED',
          },
          { status: 422 },
        );
      }

      const html = await res.text();

      // Extract og:image — LinkedIn puts the profile photo here on public profiles
      const ogImageMatch =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

      if (ogImageMatch?.[1]) {
        const candidate = ogImageMatch[1];

        // Make sure it's actually a profile photo, not LinkedIn's generic share image
        const isGeneric =
          candidate.includes('linkedin-no-photo') ||
          candidate.includes('ghost_person') ||
          candidate.includes('logo') ||
          candidate.includes('LI-Bug') ||
          candidate.includes('linkedin.com/sc/h/') || // LinkedIn's generic og image
          candidate.length < 20;

        if (!isGeneric) {
          photoUrl = candidate;
        }
      }
    } catch (fetchErr: any) {
      // Timeout or network error
      if (fetchErr.name === 'TimeoutError' || fetchErr.name === 'AbortError') {
        return NextResponse.json(
          {
            error: 'LinkedIn took too long to respond. Please upload a photo manually.',
            code: 'LINKEDIN_TIMEOUT',
          },
          { status: 422 },
        );
      }
      throw fetchErr;
    }

    if (!photoUrl) {
      return NextResponse.json(
        {
          error:
            'Could not extract a profile photo from this LinkedIn URL. The profile may be private or LinkedIn is blocking access.',
          code: 'PHOTO_NOT_FOUND',
        },
        { status: 422 },
      );
    }

    // Save the LinkedIn photo URL as the user's profilePicture
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { profilePicture: photoUrl },
      select: { id: true, email: true, name: true, profilePicture: true, provider: true },
    });

    return NextResponse.json({
      success: true,
      profilePicture: photoUrl,
      user: updatedUser,
    });
  } catch (error: any) {
    console.error('LinkedIn photo sync error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) },
    );
  }
}