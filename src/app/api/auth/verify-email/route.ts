import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToken, setAuthCookie } from '@/lib/auth';
import { sendWelcomeEmail } from '@/lib/email';
import { UserRole } from '@prisma/client';
import {
  checkRateLimit,
  getClientIp,
  normalizeRateLimitEmail,
  rateLimitResponse,
} from '@/lib/rate-limit';

function parsePendingUserRole(role: string): UserRole | null {
  if (role === UserRole.STUDENT || role === UserRole.INTERVIEWER) {
    return role;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp } = body;
    const normalizedEmail = normalizeRateLimitEmail(email);
    const clientIp = getClientIp(request);

    const limit = await checkRateLimit({
      key: `auth:verify-email:${normalizedEmail}:${clientIp}`,
      limit: 5,
      windowMs: 10 * 60 * 1000,
    });
    if (!limit.allowed) {
      return rateLimitResponse(limit.retryAfter);
    }

    if (!email || !otp) {
      return NextResponse.json(
        { error: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    // Find pending user with matching email and OTP
    const pendingUser = await prisma.pendingUser.findFirst({
      where: {
        email,
        verificationToken: otp,
      },
    });

    if (!pendingUser) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Check if OTP has expired
    if (pendingUser.verificationTokenExpiry < new Date()) {
      return NextResponse.json(
        { error: 'Verification code has expired. Please sign up again.' },
        { status: 400 }
      );
    }

    // Check if user already exists (edge case: created between signup and verify)
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Clean up pending user
      await prisma.pendingUser.delete({ where: { id: pendingUser.id } });
      
      return NextResponse.json(
        { error: 'User already exists. Please login.' },
        { status: 400 }
      );
    }

    const pendingRole = parsePendingUserRole(pendingUser.role);
    if (!pendingRole) {
      return NextResponse.json(
        { error: 'Invalid pending user role. Please sign up again.' },
        { status: 400 }
      );
    }

    // Create actual user in main users table
    const user = await prisma.user.create({
      data: {
        email: pendingUser.email,
        passwordHash: pendingUser.passwordHash,
        role: pendingRole,
        provider: 'EMAIL',
        emailVerified: true, // Already verified by OTP
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    });

    // Delete pending user record (no longer needed)
    await prisma.pendingUser.delete({
      where: { id: pendingUser.id },
    });

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
      id: undefined
    });

    // Set auth cookie
    await setAuthCookie(token);

    // Send welcome email (non-blocking)
    sendWelcomeEmail(user.email, user.name || user.email.split('@')[0]).catch(err => {
      console.error('Failed to send welcome email:', err);
    });

    return NextResponse.json({
      message: 'Email verified successfully!',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      // Redirect URL based on role
      redirectUrl: user.role === 'STUDENT' ? '/student/dashboard' : 
                   user.role === 'INTERVIEWER' ? '/interviewer/dashboard' : 
                   '/',
    });

  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
