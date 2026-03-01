import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorStatus } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/interviewer/upload-profile-picture
 *
 * Stores the photo as a base64 data URL directly in the database.
 *
 * WHY base64 instead of filesystem?
 * Storing files in `public/uploads/` fails in production environments
 * (Vercel, Railway, Fly.io, etc.) because the filesystem is ephemeral —
 * files are wiped on every deploy or server restart. Base64 in the DB
 * is permanent and works everywhere without any cloud storage setup.
 *
 * Limit: 2MB file size to keep base64 strings manageable in the DB.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(['INTERVIEWER']);

    const formData = await request.formData();
    const file     = formData.get('photo') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No photo provided' }, { status: 400 });
    }

    // ── Validate type ─────────────────────────────────────────────────────────
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Photo must be a JPG, PNG, or WebP image' },
        { status: 400 },
      );
    }

    // ── Validate size (2 MB max to keep base64 reasonable) ────────────────────
    const maxSize = 2 * 1024 * 1024; // 2 MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Photo must be under 2MB. Please compress your image first.' },
        { status: 400 },
      );
    }

    // ── Convert to base64 data URL ────────────────────────────────────────────
    const buffer      = Buffer.from(await file.arrayBuffer());
    const base64      = buffer.toString('base64');
    const dataUrl     = `data:${file.type};base64,${base64}`;

    // ── Save to DB (permanent — survives restarts/redeploys) ──────────────────
    const updatedUser = await prisma.user.update({
      where:  { id: userId },
      data:   { profilePicture: dataUrl },
      select: { id: true, email: true, name: true, profilePicture: true, provider: true },
    });

    console.log(`✅ Profile photo saved to DB for user ${userId} (${Math.round(base64.length / 1024)}KB base64)`);

    return NextResponse.json({
      success:        true,
      user:           updatedUser,
      profilePicture: dataUrl,
    });

  } catch (error: any) {
    console.error('Profile picture upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: authErrorStatus(error.message) },
    );
  }
}