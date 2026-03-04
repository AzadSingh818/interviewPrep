import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorStatus } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { v2 as cloudinary } from 'cloudinary';

// ── Cloudinary config ─────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * POST /api/interviewer/upload-profile-picture
 *
 * Uploads the photo to Cloudinary and stores the URL in the database.
 *
 * Previously stored as base64 in DB — now uses Cloudinary for permanent
 * cloud storage that works on Vercel, Railway, Fly.io etc.
 *
 * Limit: 5MB file size.
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

    // ── Validate size (5MB max) ───────────────────────────────────────────────
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Photo must be under 5MB. Please compress your image first.' },
        { status: 400 },
      );
    }

    // ── Delete old profile picture from Cloudinary if it exists ──────────────
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { profilePicture: true },
    });

    if (existingUser?.profilePicture && existingUser.profilePicture.includes('cloudinary.com')) {
      try {
        const oldPublicId = existingUser.profilePicture
          .split('/upload/')[1]
          ?.replace(/^v\d+\//, '')
          ?.replace(/\.[^/.]+$/, '');
        if (oldPublicId) {
          await cloudinary.uploader.destroy(oldPublicId, { resource_type: 'image' });
        }
      } catch (e) {
        console.warn('Could not delete old profile picture from Cloudinary:', e);
      }
    }

    // ── Upload to Cloudinary ──────────────────────────────────────────────────
    const buffer = Buffer.from(await file.arrayBuffer());

    const uploadResult = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          public_id: `profile-pictures/user_${userId}`,
          overwrite: true,
          folder: 'profile-pictures',
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' }, // auto crop to face
            { quality: 'auto', fetch_format: 'auto' },                  // auto optimize
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(buffer);
    });

    const profilePicture = uploadResult.secure_url;

    console.log(`✅ Profile photo uploaded to Cloudinary for user ${userId}`);

    // ── Save Cloudinary URL to DB ─────────────────────────────────────────────
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