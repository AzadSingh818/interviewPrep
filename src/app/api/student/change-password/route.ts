import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, verifyPassword, hashPassword, generateToken, setAuthCookie } from '@/lib/auth';
import { validatePasswordPolicy } from '@/lib/password-policy';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(['STUDENT']);

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    const passwordPolicy = validatePasswordPolicy(newPassword);
    if (!passwordPolicy.valid) {
      return NextResponse.json(
        { error: passwordPolicy.error },
        { status: 400 }
      );
    }

    // Fetch fresh user record with passwordHash
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },  // ✅ fixed: was user.id
      select: { email: true, role: true, passwordHash: true, provider: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Google-only accounts have no password
    if (dbUser.provider === 'GOOGLE' || !dbUser.passwordHash) {
      return NextResponse.json(
        { error: 'Your account uses Google sign-in. Password change is not available.' },
        { status: 400 }
      );
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, dbUser.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // Hash and save new password
    const newHash = await hashPassword(newPassword);
    const updatedUser = await prisma.user.update({
      where: { id: user.userId },  // ✅ fixed: was user.id
      data: {
        passwordHash: newHash,
        tokenVersion: { increment: 1 },
      },
      select: { id: true, email: true, role: true, tokenVersion: true },
    });
    await setAuthCookie(generateToken({
      userId: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      tokenVersion: updatedUser.tokenVersion,
    }));

    return NextResponse.json({ message: 'Password updated successfully' });
  } catch (error: any) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      {
        status:
          error.message === 'Unauthorized'
            ? 401
            : error.message === 'Forbidden'
            ? 403
            : 500,
      }
    );
  }
}
