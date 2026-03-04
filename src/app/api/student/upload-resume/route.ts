import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// ── Cloudinary config ─────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(['STUDENT']);

    const formData = await request.formData();
    const file = formData.get('resume') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF, DOC, and DOCX files are allowed.' },
        { status: 400 }
      );
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // ── Fetch student's name to build a friendly filename ──────────────────
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
      select: { name: true, resumeUrl: true },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    const rawName =
      studentProfile?.name ||
      user?.name ||
      user?.email?.split('@')[0] ||
      `user_${userId}`;

    const safeName = rawName
      .trim()
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_');

    const fileExtension = path.extname(file.name); // .pdf / .doc / .docx
    const publicId = `resumes/${safeName}_resume_${userId}`;

    // ── Delete old Cloudinary file if exists ──────────────────────────────
    if (studentProfile?.resumeUrl) {
      try {
        // Extract public_id from old URL
        const oldPublicId = studentProfile.resumeUrl
          .split('/upload/')[1]
          ?.replace(/^v\d+\//, '')   // strip version
          ?.replace(/\.[^/.]+$/, ''); // strip extension
        if (oldPublicId) {
          await cloudinary.uploader.destroy(oldPublicId, { resource_type: 'raw' });
        }
      } catch (e) {
        console.warn('Could not delete old resume from Cloudinary:', e);
      }
    }

    // ── Upload to Cloudinary ───────────────────────────────────────────────
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadResult = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',          // PDFs/docs must use 'raw'
          public_id: publicId,
          overwrite: true,
          folder: 'student-resumes',
          format: fileExtension.replace('.', ''),
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(buffer);
    });

    const resumeUrl = uploadResult.secure_url;

    await prisma.studentProfile.update({
      where: { userId },
      data: { resumeUrl },
    });

    return NextResponse.json({
      success: true,
      resumeUrl,
      message: 'Resume uploaded successfully',
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload resume' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await requireAuth(['STUDENT']);

    const profile = await prisma.studentProfile.findUnique({
      where: { userId },
      select: { resumeUrl: true },
    });

    if (!profile?.resumeUrl) {
      return NextResponse.json({ error: 'No resume found' }, { status: 404 });
    }

    // ── Delete from Cloudinary ─────────────────────────────────────────────
    try {
      const oldPublicId = profile.resumeUrl
        .split('/upload/')[1]
        ?.replace(/^v\d+\//, '')
        ?.replace(/\.[^/.]+$/, '');
      if (oldPublicId) {
        await cloudinary.uploader.destroy(oldPublicId, { resource_type: 'raw' });
      }
    } catch (e) {
      console.warn('Could not delete resume from Cloudinary:', e);
    }

    await prisma.studentProfile.update({
      where: { userId },
      data: { resumeUrl: null },
    });

    return NextResponse.json({
      success: true,
      message: 'Resume deleted successfully',
    });

  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete resume' },
      { status: 500 }
    );
  }
}