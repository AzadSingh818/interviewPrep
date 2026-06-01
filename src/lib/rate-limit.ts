import { NextRequest, NextResponse } from 'next/server';
import { prisma } from './prisma';

interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

export function normalizeRateLimitEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : 'unknown';
}

export function rateLimitResponse(retryAfter: number) {
  return NextResponse.json(
    { error: 'Too many attempts. Please try again later.', retryAfter },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    },
  );
}

export async function checkRateLimit({ key, limit, windowMs }: RateLimitOptions) {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);

  const bucket = await prisma.rateLimitBucket.findUnique({ where: { key } });

  if (!bucket || bucket.resetAt <= now) {
    await prisma.rateLimitBucket.upsert({
      where: { key },
      create: { key, count: 1, resetAt },
      update: { count: 1, resetAt },
    });

    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  if (bucket.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt.getTime() - now.getTime()) / 1000));
    return { allowed: false, remaining: 0, retryAfter };
  }

  await prisma.rateLimitBucket.update({
    where: { key },
    data: { count: { increment: 1 } },
  });

  return { allowed: true, remaining: limit - bucket.count - 1, retryAfter: 0 };
}
