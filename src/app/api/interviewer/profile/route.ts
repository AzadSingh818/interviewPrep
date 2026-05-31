import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';
import { CareerLevel, SessionType, InterviewType } from '@prisma/client';

function parseLinkedInProfileUrl(linkedinUrl: string): string | null {
  try {
    const normalized = linkedinUrl.trim().startsWith('http')
      ? linkedinUrl.trim()
      : `https://${linkedinUrl.trim()}`;
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase();
    const isLinkedInHost = host === 'linkedin.com' || host === 'www.linkedin.com';
    const isProfilePath = url.pathname.startsWith('/in/') || url.pathname.startsWith('/pub/');

    if (url.protocol !== 'https:' || !isLinkedInHost || !isProfilePath || url.username || url.password) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
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
      careerLevel,
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
    if (!careerLevel?.trim())                missing.push('Career Level');
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
    const validCareerLevel   = ['JUNIOR', 'MID', 'SENIOR', 'STAFF_LEAD'].includes(careerLevel);
    const validSessionTypes   = sessionTypesOffered.every((t: string) => ['GUIDANCE', 'INTERVIEW'].includes(t));
    const validInterviewTypes = (interviewTypesOffered || []).every((t: string) =>
      ['TECHNICAL', 'HR', 'MIXED'].includes(t),
    );

    if (!validCareerLevel || !validSessionTypes || !validInterviewTypes) {
      return NextResponse.json(
        { error: 'Invalid career level, session types, or interview types' },
        { status: 400 },
      );
    }

    // ── Validate LinkedIn URL format ──────────────────────────────────────────
    const normalizedLinkedInUrl = parseLinkedInProfileUrl(linkedinUrl);

    if (!normalizedLinkedInUrl) {
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
      careerLevel:          careerLevel as CareerLevel,
      sessionTypesOffered:   sessionTypesOffered as SessionType[],
      interviewTypesOffered: sessionTypesOffered.includes('INTERVIEW')
        ? (interviewTypesOffered as InterviewType[])
        : ([] as InterviewType[]),
      linkedinUrl: normalizedLinkedInUrl,
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

    return NextResponse.json({ profile, user: currentUser, linkedinPhotoSynced: false });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) },
    );
  }
}
