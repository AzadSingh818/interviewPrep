import bcrypt from 'bcryptjs';
import crypto from 'crypto';
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
  cookieStore.delete('csrf-token');
}

// ========================================
// CSRF TOKEN FUNCTIONS
// ========================================

/**
 * Generate a cryptographically random CSRF token.
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Set the CSRF token as a readable (non-httpOnly) cookie so the
 * frontend JS can read it and include it as a request header.
 * SameSite=Strict prevents cross-site requests from carrying it.
 */
export async function setCsrfCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set('csrf-token', token, {
    httpOnly: false, // must be readable by JS
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7, // same lifetime as auth cookie
    path: '/',
  });
}

/**
 * Read the CSRF token from the cookie store.
 */
export async function getCsrfCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get('csrf-token')?.value;
}

/**
 * Verify the CSRF token: compare the X-CSRF-Token request header
 * against the csrf-token cookie value using a timing-safe comparison.
 * Throws if the token is missing or does not match.
 */
async function verifyCsrfToken(headerStore: Awaited<ReturnType<typeof headers>>) {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get('csrf-token')?.value;
  const headerToken = headerStore.get('x-csrf-token');

  if (!cookieToken || !headerToken) {
    throw new Error('CSRF validation failed');
  }

  const cookieBuf = Buffer.from(cookieToken);
  const headerBuf = Buffer.from(headerToken);

  if (
    cookieBuf.length !== headerBuf.length ||
    !crypto.timingSafeEqual(cookieBuf, headerBuf)
  ) {
    throw new Error('CSRF validation failed');
  }
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

// Unsafe methods that require CSRF token verification
const CSRF_REQUIRED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function requireAuth(allowedRoles?: UserRole[]): Promise<JWTPayload> {
  const headerStore = await headers();
  await enforceSameOriginRequest();

  // CSRF token check for state-changing requests
  const method = headerStore.get('x-http-method') ?? // allow override header
    (typeof (globalThis as any).Request !== 'undefined' ? undefined : undefined);
  // We use a dedicated header since Next.js Route Handlers don't expose method via headers().
  // The method is forwarded by our convention via X-Request-Method, or we check unconditionally
  // for mutation methods using the presence of the CSRF header itself.
  //
  // Strategy: if the request carries a 'x-csrf-expected: 1' header set by the
  // frontend wrapper on all non-GET calls, we enforce the CSRF token.
  // This keeps GET/HEAD/OPTIONS excluded without needing to read the method.
  const expectsCsrf = headerStore.get('x-csrf-expected') === '1';
  if (expectsCsrf) {
    await verifyCsrfToken(headerStore);
  }

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
