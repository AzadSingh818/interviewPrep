import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { UserRole } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());

export interface JWTPayload {
  id: any;
  userId: number;
  email: string;
  role: UserRole;
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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
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

// ========================================
// FAST AUTH — JWT only, ZERO DB queries
// Returns { userId, email, role }
// Use this in all API routes
// ========================================

export async function requireAuth(allowedRoles?: UserRole[]): Promise<JWTPayload> {
  const token = await getAuthCookie();
  if (!token) throw new Error('Unauthorized');

  const payload = verifyToken(token);
  if (!payload) throw new Error('Unauthorized');

  if (allowedRoles && !allowedRoles.includes(payload.role)) {
    throw new Error('Forbidden');
  }

  return payload; // { userId, email, role }
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
  return 500;
}