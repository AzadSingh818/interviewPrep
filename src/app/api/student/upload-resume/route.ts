import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// ── Cloudinary upload via REST API (no SDK stream issues) ─────────────────────
async function uploadToCloudinary(
  buffer: Buffer,
  filename: string,          // e.g. "Azad_Singh_resume_5"
  folder: string,            // e.g. "student-resumes"
  resourceType: 'raw' | 'image' = 'raw',
): Promise<string> {
  const cloudName  = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey     = process.env.CLOUDINARY_API_KEY!;
  const apiSecret  = process.env.CLOUDINARY_API_SECRET!;
  const timestamp  = Math.floor(Date.now() / 1000);

  // ── Build signature ───────────────────────────────────────────────────────
  // Params must be sorted alphabetically for signature
  const paramsToSign = `folder=${folder}&overwrite=true&public_id=${filename}&timestamp=${timestamp}`;

  const crypto = await import('crypto');
  const signature = crypto
    .createHash('sha256')
    .update(paramsToSign + apiSecret)
    .digest('hex');

  // ── Build multipart form ──────────────────────────────────────────────────
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: 'application/octet-stream' });
  formData.append('file', blob, filename);
  formData.append('public_id',  filename);
  formData.append('folder',     folder);
  formData.append('overwrite',  'true');
  formData.append('timestamp',  String(timestamp));
  formData.append('api_key',    apiKey);
  formData.append('signature',  signature);

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;
  const res = await fetch(url, { method: 'POST', body: formData });
  const data = await res.json();

  if (!res.ok) {
    console.error('Cloudinary error:', data);
    throw new Error(data?.error?.message || 'Cloudinary upload failed');
  }

  return data.secure_url as string;
}

// ── Delete from Cloudinary via REST API ──────────────────────────────────────
async function deleteFromCloudinary(
  url: string,
  resourceType: 'raw' | 'image' = 'raw',
): Promise<void> {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
    const apiKey    = process.env.CLOUDINARY_API_KEY!;
    const apiSecret = process.env.CLOUDINARY_API_SECRET!;
    const timestamp = Math.floor(Date.now() / 1000);

    // Extract public_id including folder, strip version and extension
    const afterUpload = url.split('/upload/')[1];
    if (!afterUpload) return;
    const withoutVersion = afterUpload.replace(/^v\d+\//, '');
    const publicId = withoutVersion.replace(/\.[^/.]+$/, '');

    const crypto = await import('crypto');
    const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}`;
    const signature = crypto
      .createHash('sha256')
      .update(paramsToSign + apiSecret)
      .digest('hex');

    const formData = new FormData();
    formData.append('public_id',     publicId);
    formData.append('timestamp',     String(timestamp));
    formData.append('api_key',       apiKey);
    formData.append('signature',     signature);
    formData.append('resource_type', resourceType);

    await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`,
      { method: 'POST', body: formData },
    );
  } catch (e) {
    console.warn('Could not delete old file from Cloudinary:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

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
        { status: 400 },
      );
    }

    // 5MB limit — base64 encoding adds ~33% overhead, keeping total under Vercel's 4.5MB limit
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 5MB.' },
        { status: 400 },
      );
    }

    // ── Build a safe filename (no slashes, no special chars) ──────────────
    const studentProfile = await prisma.studentProfile.findUnique({
      where:  { userId },
      select: { name: true, resumeUrl: true },
    });
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { name: true, email: true },
    });

    const rawName =
      studentProfile?.name ||
      user?.name ||
      user?.email?.split('@')[0] ||
      `user_${userId}`;

    // Strip everything except letters, digits, spaces → replace spaces with _
    const safeName = rawName
      .trim()
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50); // cap length just in case

    // Final filename — guaranteed no slashes
    const filename = `${safeName}_resume_${userId}`;

    // ── Delete old resume from Cloudinary ─────────────────────────────────
    if (studentProfile?.resumeUrl?.includes('cloudinary.com')) {
      await deleteFromCloudinary(studentProfile.resumeUrl, 'raw');
    }

    // ── Upload ────────────────────────────────────────────────────────────
    const buffer   = Buffer.from(await file.arrayBuffer());
    const resumeUrl = await uploadToCloudinary(buffer, filename, 'student-resumes', 'raw');

    await prisma.studentProfile.update({
      where: { userId },
      data:  { resumeUrl },
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
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await requireAuth(['STUDENT']);

    const profile = await prisma.studentProfile.findUnique({
      where:  { userId },
      select: { resumeUrl: true },
    });

    if (!profile?.resumeUrl) {
      return NextResponse.json({ error: 'No resume found' }, { status: 404 });
    }

    if (profile.resumeUrl.includes('cloudinary.com')) {
      await deleteFromCloudinary(profile.resumeUrl, 'raw');
    }

    await prisma.studentProfile.update({
      where: { userId },
      data:  { resumeUrl: null },
    });

    return NextResponse.json({
      success: true,
      message: 'Resume deleted successfully',
    });

  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete resume' },
      { status: 500 },
    );
  }
}