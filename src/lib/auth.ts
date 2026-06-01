import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies, headers } from 'next/headers';
import { prisma } from './prisma';
import { UserRole } from '@prisma/client';
import { env, getOptionalEnv } from './env';

const ADMIN_EMAILS = (getOptionalEnv('ADMIN_EMAILS', '') || '').split(',').map(e => e.trim());

export interface JWTPayload {
  id?: any;
  userId: number;
  email: string;
  role: UserRole;
  tokenVersion: number;
}

// ========================================
// PASSWORD FUNCTIONS
// ========================================

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ========================================
// TOKEN FUNCTIONS
// ========================================

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

// ========================================
// COOKIE FUNCTIONS
// ========================================

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

export async function getAuthCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get('auth-token')?.value;
}

export async function removeAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete('auth-token');
}

async function enforceSameOriginRequest() {
  const headerStore = await headers();
  const origin = headerStore.get('origin');
  const host = headerStore.get('host');
  const forwardedHost = headerStore.get('x-forwarded-host');
  const forwardedProto = headerStore.get('x-forwarded-proto') || 'https';
  const secFetchSite = headerStore.get('sec-fetch-site');

  if (secFetchSite === 'cross-site') {
    throw new Error('CSRF validation failed');
  }

  if (!origin || (!host && !forwardedHost)) {
    return;
  }

  const expectedHosts = new Set([host, forwardedHost].filter(Boolean));
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    throw new Error('CSRF validation failed');
  }
  const originHost = originUrl.host;
  const expectedOrigins = Array.from(expectedHosts).flatMap((expectedHost) => [
    `https://${expectedHost}`,
    `http://${expectedHost}`,
    `${forwardedProto}://${expectedHost}`,
  ]);

  if (!expectedHosts.has(originHost) && !expectedOrigins.includes(originUrl.origin)) {
    throw new Error('CSRF validation failed');
  }
}

// ========================================
// FAST AUTH — JWT only, ZERO DB queries
// Returns { userId, email, role }
// Use this in all API routes
// ========================================

export async function requireAuth(allowedRoles?: UserRole[]): Promise<JWTPayload> {
  await enforceSameOriginRequest();

  const token = await getAuthCookie();
  if (!token) throw new Error('Unauthorized');

  const payload = verifyToken(token);
  if (!payload) throw new Error('Unauthorized');

  if (!Number.isInteger(payload.tokenVersion)) {
    throw new Error('Unauthorized');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, role: true, tokenVersion: true },
  });

  if (!user || user.email !== payload.email || user.tokenVersion !== payload.tokenVersion) {
    throw new Error('Unauthorized');
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    throw new Error('Forbidden');
  }

  return { ...payload, role: user.role }; // { userId, email, role, tokenVersion }
}

// ========================================
// FULL USER — hits DB, use only when you
// actually need profile/picture/provider
// (e.g. /api/auth/me)
// ========================================

export async function getCurrentUser() {
  const token = await getAuthCookie();
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  return prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      role: true,
      name: true,
      profilePicture: true,
      provider: true,
      emailVerified: true,
      studentProfile: true,
      interviewerProfile: {
        select: {
          id: true,
          status: true,
          name: true,
        },
      },
    },
  });
}

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email);
}

// ========================================
// SHARED ERROR RESPONSE HELPER
// ========================================

export function authErrorStatus(message: string): number {
  if (message === 'Unauthorized') return 401;
  if (message === 'Forbidden') return 403;
  if (message === 'CSRF validation failed') return 403;
  return 500;
}
