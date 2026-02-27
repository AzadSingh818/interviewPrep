import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

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
      select: { name: true },
    });

    // Fall back to the user's account name if profile name isn't set yet
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    const rawName =
      studentProfile?.name ||
      user?.name ||
      user?.email?.split('@')[0] ||
      `user_${userId}`;

    // Convert "Azad Singh" → "Azad_Singh"  (replace spaces & special chars)
    const safeName = rawName
      .trim()
      .replace(/[^a-zA-Z0-9\s]/g, '')   // remove special chars
      .replace(/\s+/g, '_');             // spaces → underscores

    const fileExtension = path.extname(file.name); // .pdf / .doc / .docx
    const fileName = `${safeName}_resume${fileExtension}`; // e.g. Azad_Singh_resume.pdf

    // ── Save file ──────────────────────────────────────────────────────────
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'resumes');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Delete old resume file if it exists (avoid stale files piling up)
    const existingProfile = await prisma.studentProfile.findUnique({
      where: { userId },
      select: { resumeUrl: true },
    });
    if (existingProfile?.resumeUrl) {
      const oldPath = path.join(process.cwd(), 'public', existingProfile.resumeUrl);
      if (existsSync(oldPath)) {
        await unlink(oldPath).catch(() => {}); // ignore errors if already gone
      }
    }

    const filePath = path.join(uploadsDir, fileName);
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    const resumeUrl = `/uploads/resumes/${fileName}`;

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

    const filePath = path.join(process.cwd(), 'public', profile.resumeUrl);
    if (existsSync(filePath)) {
      await unlink(filePath).catch(() => {});
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