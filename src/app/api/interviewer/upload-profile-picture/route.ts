import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorStatus } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(['INTERVIEWER']);

    const formData = await request.formData();
    const file = formData.get('photo') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No photo provided' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Photo must be a JPG, PNG, or WebP image' },
        { status: 400 },
      );
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Photo must be under 5MB' }, { status: 400 });
    }

    // Save to public/uploads/profile-pictures/
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'profile-pictures');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const ext = path.extname(file.name) || '.jpg';
    const fileName = `profile_${userId}_${Date.now()}${ext}`;
    const filePath = path.join(uploadsDir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const profilePictureUrl = `/uploads/profile-pictures/${fileName}`;

    // Update user.profilePicture
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { profilePicture: profilePictureUrl },
      select: { id: true, email: true, name: true, profilePicture: true, provider: true },
    });

    return NextResponse.json({ success: true, user: updatedUser, profilePicture: profilePictureUrl });
  } catch (error: any) {
    console.error('Profile picture upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: authErrorStatus(error.message) },
    );
  }
}