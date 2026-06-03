import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';
import { InterviewDifficulty, InterviewType, SessionType } from '@prisma/client';
import { sendManualBookingReceivedToStudent } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth(['STUDENT']);
    const body = await request.json();

    const {
      preferredInterviewerId,
      topic,
      role,
      difficulty,
      interviewType,
      sessionType,
    } = body;

    if (!sessionType) {
      return NextResponse.json(
        { error: 'Missing required field: sessionType.' },
        { status: 400 }
      );
    }

    // Get student profile
    const student = await prisma.studentProfile.findUnique({
      where: { userId },
      include: { 
        user: { select: { email: true, name: true } },
        // preferredInterviewerUnlocked: true,
      },
    });
    if (!student) {
      return NextResponse.json({ error: 'Student profile not found.' }, { status: 404 });
    }

    // ✅ Just check the unlock flag — payment was already verified at unlock time
    if (!student.preferredInterviewerUnlocked) {
      return NextResponse.json(
        { error: 'Feature not unlocked. Please pay ₹50 to use this feature.' },
        { status: 403 }
      );
    }

    // Verify preferred interviewer exists and is approved (if provided)
    if (preferredInterviewerId) {
      const interviewer = await prisma.interviewerProfile.findUnique({
        where: { id: parseInt(preferredInterviewerId) },
      });
      if (!interviewer || interviewer.status !== 'APPROVED') {
        return NextResponse.json(
          { error: 'Selected interviewer is not available.' },
          { status: 400 }
        );
      }
    }

    // Create a fresh ManualBookingRequest for this booking
    const newRequest = await prisma.manualBookingRequest.create({
      data: {
        studentId:              student.id,
        preferredInterviewerId: preferredInterviewerId ? parseInt(preferredInterviewerId) : null,
        topic:                  topic || null,
        role:                   role || null,
        difficulty:             difficulty as any,
        interviewType:          interviewType as any,
        sessionType:            sessionType as any,
        status:                 'PENDING',
        paymentStatus:          'PAID', // unlock already paid
      },
      include: {
        studentProfile:        { include: { user: { select: { email: true, name: true } } } },
        interviewerProfile:    { include: { user: { select: { name: true } } } },
      },
    });

    // Send confirmation email to student
    try {
      await sendManualBookingReceivedToStudent({
        studentName:              student.user.name || student.name,
        studentEmail:             student.user.email,
        sessionType:              sessionType as SessionType,
        preferredInterviewerName: newRequest.interviewerProfile?.user.name || undefined,
        requestId:                newRequest.id,
      });
    } catch (e) {
      console.error('Email send failed:', e);
    }

    return NextResponse.json({
      success: true,
      message: 'Request submitted. Admin will assign an interviewer soon.',
      requestId: newRequest.id,
    });
  } catch (error: any) {
    console.error('Manual request error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) }
    );
  }
}

// GET — student can check their own manual requests
export async function GET() {
  try {
    const { userId } = await requireAuth(['STUDENT']);

    const student = await prisma.studentProfile.findUnique({ where: { userId } });
    if (!student) {
      return NextResponse.json({ error: 'Student profile not found.' }, { status: 404 });
    }

    const requests = await prisma.manualBookingRequest.findMany({
      where: { studentId: student.id },
      include: {
        interviewerProfile: {
          include: { user: { select: { name: true, profilePicture: true } } },
        },
        session: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ requests });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) }
    );
  }
}