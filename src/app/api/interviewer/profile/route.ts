import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';
import { DifficultyLevel, SessionType, InterviewType } from '@prisma/client';

// ─── LinkedIn og:image scraper ────────────────────────────────────────────────
async function fetchLinkedInPhoto(linkedinUrl: string): Promise<string | null> {
  try {
    const url = linkedinUrl.startsWith('http') ? linkedinUrl : `https://${linkedinUrl}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(7000),
    });

    if (!res.ok) return null;

    const html = await res.text();

    const ogMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

    if (ogMatch?.[1]) {
      const url = ogMatch[1];
      const isGeneric =
        url.includes('linkedin-no-photo') ||
        url.includes('ghost_person') ||
        url.includes('LI-Bug') ||
        url.includes('linkedin.com/sc/h/') ||
        url.includes('/static/images/') ||
        url.length < 30;

      if (!isGeneric) return url;
    }

    return null;
  } catch {
    return null;
  }
}

function isGooglePhoto(url: string | null | undefined): boolean {
  // null/undefined = no photo, treat same as "no custom photo"
  if (!url) return true;
  return url.includes('googleusercontent.com') || url.includes('ggpht.com');
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const { userId } = await requireAuth(['INTERVIEWER', 'ADMIN']);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        profilePicture: true,
        provider: true,
        interviewerProfile: true,
      },
    });

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { interviewerProfile: profile, ...userData } = user;
    return NextResponse.json({ profile, user: userData });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) },
    );
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(['INTERVIEWER']);
    const body = await request.json();

    const {
      name,
      education,
      companies,
      yearsOfExperience,
      rolesSupported,
      difficultyLevels,
      sessionTypesOffered,
      interviewTypesOffered,
      linkedinUrl,
    } = body;

    // ── All fields mandatory ──────────────────────────────────────────────────
    const missing: string[] = [];
    if (!name?.trim())                       missing.push('Full Name');
    if (!education?.trim())                  missing.push('Education');
    if (!companies?.length)                  missing.push('Companies');
    if (yearsOfExperience == null || yearsOfExperience === '') missing.push('Years of Experience');
    if (!rolesSupported?.length)             missing.push('Roles Supported');
    if (!difficultyLevels?.length)           missing.push('Difficulty Levels');
    if (!sessionTypesOffered?.length)        missing.push('Session Types');
    if (sessionTypesOffered?.includes('INTERVIEW') && !interviewTypesOffered?.length)
      missing.push('Interview Types');
    if (!linkedinUrl?.trim())                missing.push('LinkedIn Profile URL');

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Please fill in all required fields: ${missing.join(', ')}` },
        { status: 400 },
      );
    }

    // ── Validate enum values ──────────────────────────────────────────────────
    const validDifficulty     = difficultyLevels.every((l: string) => ['EASY', 'MEDIUM', 'HARD'].includes(l));
    const validSessionTypes   = sessionTypesOffered.every((t: string) => ['GUIDANCE', 'INTERVIEW'].includes(t));
    const validInterviewTypes = (interviewTypesOffered || []).every((t: string) =>
      ['TECHNICAL', 'HR', 'MIXED'].includes(t),
    );

    if (!validDifficulty || !validSessionTypes || !validInterviewTypes) {
      return NextResponse.json(
        { error: 'Invalid difficulty levels, session types, or interview types' },
        { status: 400 },
      );
    }

    // ── Validate LinkedIn URL format ──────────────────────────────────────────
    const isValidLinkedIn =
      linkedinUrl.includes('linkedin.com/in/') ||
      linkedinUrl.includes('linkedin.com/pub/');

    if (!isValidLinkedIn) {
      return NextResponse.json(
        { error: 'Please provide a valid LinkedIn profile URL (linkedin.com/in/...)' },
        { status: 400 },
      );
    }

    const profileData = {
      name:                  name.trim(),
      education:             education.trim(),
      companies:             companies || [],
      yearsOfExperience:     yearsOfExperience != null ? parseInt(yearsOfExperience) : null,
      rolesSupported,
      difficultyLevels:      difficultyLevels    as DifficultyLevel[],
      sessionTypesOffered:   sessionTypesOffered as SessionType[],
      interviewTypesOffered: sessionTypesOffered.includes('INTERVIEW')
        ? (interviewTypesOffered as InterviewType[])
        : ([] as InterviewType[]),
      linkedinUrl: linkedinUrl.trim(),
    };

    // ── Upsert profile ────────────────────────────────────────────────────────
    const [profile, currentUser] = await Promise.all([
      prisma.interviewerProfile.upsert({
        where:  { userId },
        update: profileData,
        create: { userId, ...profileData, status: 'PENDING' },
      }),
      prisma.user.findUnique({
        where:  { id: userId },
        select: { id: true, email: true, name: true, profilePicture: true, provider: true },
      }),
    ]);

    // ── Auto-sync LinkedIn photo ──────────────────────────────────────────────
    // Only if user has no custom photo yet (null or still a Google default)
    const currentPhoto         = currentUser?.profilePicture;
    const hasNoCustomPhoto     = isGooglePhoto(currentPhoto);
    const alreadyLinkedInPhoto =
      currentPhoto?.includes('licdn.com') || currentPhoto?.includes('media.linkedin.com');

    let userData = currentUser;
    let linkedinPhotoSynced = false;

    if (hasNoCustomPhoto && !alreadyLinkedInPhoto) {
      const photoUrl = await fetchLinkedInPhoto(linkedinUrl.trim());

      if (photoUrl) {
        userData = await prisma.user.update({
          where:  { id: userId },
          data:   { profilePicture: photoUrl },
          select: { id: true, email: true, name: true, profilePicture: true, provider: true },
        });
        linkedinPhotoSynced = true;
      }
    }

    return NextResponse.json({ profile, user: userData, linkedinPhotoSynced });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) },
    );
  }
}