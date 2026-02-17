import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateOTP, sendVerificationEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find pending user
    const pendingUser = await (prisma as any).pendingUser.findUnique({
      where: { email },
    });

    if (!pendingUser) {
      return NextResponse.json(
        { error: 'No pending signup found for this email. Please sign up first.' },
        { status: 404 }
      );
    }

    // Check if account has expired (24 hours)
    if (pendingUser.expiresAt < new Date()) {
      // Delete expired pending user
      await (prisma as any).pendingUser.delete({
        where: { id: pendingUser.id },
      });
      
      return NextResponse.json(
        { error: 'Signup session expired. Please sign up again.' },
        { status: 400 }
      );
    }

    // Generate new OTP
    const newOtp = generateOTP();
    const newExpiryTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update pending user with new OTP
    await (prisma as any).pendingUser.update({
      where: { id: pendingUser.id },
      data: {
        verificationToken: newOtp,
        verificationTokenExpiry: newExpiryTime,
      },
    });

    // Send new verification email
    try {
      await sendVerificationEmail(email, newOtp);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      return NextResponse.json(
        { error: 'Failed to send verification email. Please try again in a moment.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Verification code sent successfully!',
      email,
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}