import { NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrorStatus } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
// ── Cloudinary upload via REST API (no SDK, no streams) ───────────────────────
async function uploadToCloudinary(
  buffer: Buffer,
  filename: string,
  folder: string,
  resourceType: 'raw' | 'image' = 'raw',
): Promise<string> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey    = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;
  const timestamp = Math.floor(Date.now() / 1000);

  const paramsToSign = `folder=${folder}&overwrite=true&public_id=${filename}&timestamp=${timestamp}`;
  const crypto = await import('crypto');
  const signature = crypto
    .createHash('sha256')
    .update(paramsToSign + apiSecret)
    .digest('hex');

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: 'application/octet-stream' });
  formData.append('file',      blob, filename);
  formData.append('public_id', filename);
  formData.append('folder',    folder);
  formData.append('overwrite', 'true');
  formData.append('timestamp', String(timestamp));
  formData.append('api_key',   apiKey);
  formData.append('signature', signature);

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

    const afterUpload = url.split('/upload/')[1];
    if (!afterUpload) return;
    const publicId = afterUpload.replace(/^v\d+\//, '').replace(/\.[^/.]+$/, '');

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
    const { userId } = await requireAuth(["INTERVIEWER"]);

    const formData = await request.formData();
    const resumeFile = formData.get("resume") as File | null;
    const idCardFile = formData.get("idCard") as File | null;

    if (!resumeFile && !idCardFile) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];
    const maxSize = 5 * 1024 * 1024; // 5MB

    const updateData: any = {};

    // Fetch existing URLs to delete old files
    const existing = await prisma.interviewerProfile.findUnique({
      where:  { userId },
      select: { resumeUrl: true, idCardUrl: true },
    });

    // ── Handle resume upload ──────────────────────────────────────────────
    if (resumeFile) {
      if (!allowedTypes.includes(resumeFile.type)) {
        return NextResponse.json(
          { error: "Resume must be a PDF, DOC, DOCX, JPG, or PNG file" },
          { status: 400 },
        );
      }
      if (resumeFile.size > maxSize) {
        return NextResponse.json(
          { error: "Resume must be under 5MB" },
          { status: 400 },
        );
      }

      if (existing?.resumeUrl?.includes('cloudinary.com')) {
        await deleteFromCloudinary(existing.resumeUrl, 'raw');
      }

      const buffer  = Buffer.from(await resumeFile.arrayBuffer());
      const filename = `resume_${userId}_${Date.now()}`; // no slashes
      updateData.resumeUrl = await uploadToCloudinary(buffer, filename, 'interviewer-docs', 'raw');
    }

    // ── Handle ID card upload ─────────────────────────────────────────────
    if (idCardFile) {
      if (!allowedTypes.includes(idCardFile.type)) {
        return NextResponse.json(
          { error: "ID card must be a PDF, JPG, or PNG file" },
          { status: 400 },
        );
      }
      if (idCardFile.size > maxSize) {
        return NextResponse.json(
          { error: "ID card must be under 5MB" },
          { status: 400 },
        );
      }

      const isImage   = ['image/jpeg', 'image/png', 'image/webp'].includes(idCardFile.type);
      const resType   = isImage ? 'image' : 'raw';

      if (existing?.idCardUrl?.includes('cloudinary.com')) {
        await deleteFromCloudinary(existing.idCardUrl, resType);
      }

      const buffer   = Buffer.from(await idCardFile.arrayBuffer());
      const filename  = `idcard_${userId}_${Date.now()}`; // no slashes
      updateData.idCardUrl = await uploadToCloudinary(buffer, filename, 'interviewer-docs', resType);
    }

    // ── Set pending status only when both documents are present ─────────────
    const finalResumeUrl = updateData.resumeUrl || existing?.resumeUrl;
    const finalIdCardUrl = updateData.idCardUrl || existing?.idCardUrl;

    if (finalResumeUrl && finalIdCardUrl) {
      updateData.status = 'PENDING';
    }

    // ── Update interviewer profile ────────────────────────────────────────
    const profile = await prisma.interviewerProfile.update({
      where: { userId },
      data:  updateData,
    });

    return NextResponse.json({
      success:   true,
      resumeUrl: (profile as any).resumeUrl,
      idCardUrl: (profile as any).idCardUrl,
    });

  } catch (error: any) {
    console.error("Document upload error:", error);
    return NextResponse.json(
      { error: error.message || "Upload failed" },
      { status: authErrorStatus(error.message) },
    );
  }
}
