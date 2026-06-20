import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, generateToken, setAuthCookie, generateCsrfToken, setCsrfCookie } from '@/lib/auth';
import {
  getClientIp,
  normalizeRateLimitEmail,
  rateLimitResponse,
} from '@/lib/rate-limit';
import { checkRateLimitWithFallback } from '@/lib/rate-limit-redis';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;
    const normalizedEmail = normalizeRateLimitEmail(email);
    const clientIp = getClientIp(request);

    // Rate limiting: try Redis (sliding window) first, fall back to Postgres
    const limit = await checkRateLimitWithFallback({
      redisPrefix: 'login',
      redisLimit: 5,
      redisWindow: '15 m',
      identifier: `${normalizedEmail}:${clientIp}`,
      pgKey: `auth:login:${normalizedEmail}:${clientIp}`,
      pgLimit: 5,
      pgWindowMs: 15 * 60 * 1000,
    });
    if (!limit.allowed) {
      return rateLimitResponse(limit.retryAfter);
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        tokenVersion: true,
        provider: true,
        emailVerified: true,
        studentProfile: true,
        interviewerProfile: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // ========================================
    // EMAIL VERIFICATION CHECK (NEW)
    // ========================================
    // Only check email verification for EMAIL provider (not Google OAuth)
    if (user.provider === 'EMAIL' && !user.emailVerified) {
      return NextResponse.json(
        { 
          error: 'Please verify your email before logging in',
          requiresVerification: true,
          email: user.email,
        },
        { status: 403 }
      );
    }

    // Check if interviewer is approved
    if (user.role === 'INTERVIEWER' && user.interviewerProfile?.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Your interviewer account is pending approval' },
        { status: 403 }
      );
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
      id: undefined
    });

    // Set auth cookie
    await setAuthCookie(token);

    // Set CSRF token cookie (readable by JS, used for double-submit CSRF protection)
    const csrfToken = generateCsrfToken();
    await setCsrfCookie(csrfToken);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        hasProfile: user.role === 'STUDENT' ? !!user.studentProfile : !!user.interviewerProfile,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
