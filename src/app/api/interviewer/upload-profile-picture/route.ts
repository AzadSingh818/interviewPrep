import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorStatus } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasValidFileSignature } from '@/lib/file-validation';
import { env } from '@/lib/env';
// ── Cloudinary upload via REST API (no SDK, no streams) ───────────────────────
async function uploadToCloudinary(
  buffer: Buffer,
  filename: string,
  folder: string,
): Promise<string> {
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;
  const timestamp = Math.floor(Date.now() / 1000);

  // transformation as a string for signature
  const transformation = 'c_fill,g_face,h_400,w_400/f_auto,q_auto';
  const paramsToSign = `folder=${folder}&overwrite=true&public_id=${filename}&timestamp=${timestamp}&transformation=${transformation}`;

  const crypto = await import('crypto');
  const signature = crypto
    .createHash('sha256')
    .update(paramsToSign + apiSecret)
    .digest('hex');

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: 'image/jpeg' });
  formData.append('file',           blob, filename);
  formData.append('public_id',      filename);
  formData.append('folder',         folder);
  formData.append('overwrite',      'true');
  formData.append('transformation', transformation);
  formData.append('timestamp',      String(timestamp));
  formData.append('api_key',        apiKey);
  formData.append('signature',      signature);

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const res = await fetch(url, { method: 'POST', body: formData });
  const data = await res.json();

  if (!res.ok) {
    console.error('Cloudinary error:', data);
    throw new Error(data?.error?.message || 'Cloudinary upload failed');
  }

  return data.secure_url as string;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(['INTERVIEWER']);

    const formData = await request.formData();
    const file     = formData.get('photo') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No photo provided' }, { status: 400 });
    }

    // ── Validate type ─────────────────────────────────────────────────────
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Photo must be a JPG, PNG, or WebP image' },
        { status: 400 },
      );
    }

    // ── Validate size (5MB max) ───────────────────────────────────────────
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Photo must be under 5MB. Please compress your image first.' },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!hasValidFileSignature(buffer, file.type)) {
      return NextResponse.json(
        { error: 'Photo content does not match the selected file type' },
        { status: 400 },
      );
    }

    // ── Upload to Cloudinary ──────────────────────────────────────────────
    const filename  = `user_${userId}`; // no slashes
    const profilePicture = await uploadToCloudinary(buffer, filename, 'profile-pictures');

    console.log(`✅ Profile photo uploaded to Cloudinary for user ${userId}`);

    // ── Save URL to DB ────────────────────────────────────────────────────
    const updatedUser = await prisma.user.update({
      where:  { id: userId },
      data:   { profilePicture },
      select: { id: true, email: true, name: true, profilePicture: true, provider: true },
    });

    return NextResponse.json({
      success:        true,
      user:           updatedUser,
      profilePicture,
    });

  } catch (error: any) {
    console.error('Profile picture upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: authErrorStatus(error.message) },
    );
  }
}
