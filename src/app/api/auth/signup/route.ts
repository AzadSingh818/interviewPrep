import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { generateOTP, sendVerificationEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, role } = body;

    // Validation
    if (!email || !password || !role) {
      return NextResponse.json(
        { error: 'Email, password, and role are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Validate role
    if (role !== 'STUDENT' && role !== 'INTERVIEWER') {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    // Check if user already exists in main users table
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true },
    });

    if (existingUser && existingUser.emailVerified) {
      return NextResponse.json(
        { error: 'User already exists. Please login.' },
        { status: 400 }
      );
    }

    // Check if there's already a pending signup for this email
    const existingPendingUser = await (prisma as any).pendingUser.findUnique({
      where: { email },
    });

    // Hash password
    const passwordHash = await hashPassword(password);

    // Generate OTP
    const otp = generateOTP();
    const expiryTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const accountExpiryTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create or update pending user
    if (existingPendingUser) {
      // Update existing pending user with new OTP
      await (prisma as any).pendingUser.update({
        where: { email },
        data: {
          passwordHash,
          role,
          verificationToken: otp,
          verificationTokenExpiry: expiryTime,
          expiresAt: accountExpiryTime,
        },
      });
    } else {
      // Create new pending user
      await (prisma as any).pendingUser.create({
        data: {
          email,
          passwordHash,
          role,
          verificationToken: otp,
          verificationTokenExpiry: expiryTime,
          expiresAt: accountExpiryTime,
        },
      });
    }

    // Send verification email
    try {
      await sendVerificationEmail(email, otp);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Don't delete pending user - they can try again
      return NextResponse.json(
        { error: 'Failed to send verification email. Please try again in a moment.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Verification code sent! Please check your email.',
      email,
      requiresVerification: true,
    });

  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
