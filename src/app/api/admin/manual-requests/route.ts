import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';
import { sendManualBookingAssignedToStudent } from '@/lib/email';

export const dynamic = 'force-dynamic';

// GET — list all manual booking requests (admin)
export async function GET(request: NextRequest) {
  try {
    await requireAuth(['ADMIN']);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';

    const whereFilter: any = status === 'ALL' ? {} : { status };
    const requests = await prisma.manual_booking_requests.findMany({
        where: whereFilter,
      include: {
        student: {
          include: {
            user: { select: { email: true, name: true, profilePicture: true } },
          },
        },
        preferredInterviewer: {
          include: {
            user: { select: { name: true, email: true, profilePicture: true } },
          },
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

// POST — admin assigns an interviewer to a manual request
export async function POST(request: NextRequest) {
  try {
    await requireAuth(['ADMIN']);
    const body = await request.json();

    const { requestId, interviewerId, scheduledTime, durationMinutes } = body;

    if (!requestId || !interviewerId || !scheduledTime) {
      return NextResponse.json(
        { error: 'requestId, interviewerId and scheduledTime are required.' },
        { status: 400 }
      );
    }

    // Fetch the manual booking request
    const manualRequest = await prisma.manual_booking_requests.findUnique({
      where: { id: parseInt(requestId) },
      include: {
        student: {
          include: { user: { select: { email: true, name: true } } },
        },
      },
    });

    if (!manualRequest) {
      return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
    }
    if (manualRequest.status !== 'PENDING') {
      return NextResponse.json({ error: 'Request is already processed.' }, { status: 400 });
    }

    // Fetch the interviewer
    const interviewer = await prisma.interviewerProfile.findUnique({
      where: { id: parseInt(interviewerId) },
      include: { user: { select: { email: true, name: true } } },
    });

    if (!interviewer || interviewer.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Interviewer not found or not approved.' },
        { status: 400 }
      );
    }

    const duration = durationMinutes || 60;

    // Create the session + update the request atomically
    const [session] = await prisma.$transaction([
      prisma.session.create({
        data: {
          studentId: manualRequest.student_id,
          interviewerId: parseInt(interviewerId),
          sessionType: manualRequest.session_type,
          status: 'SCHEDULED',
          scheduledTime: new Date(scheduledTime),
          durationMinutes: duration,
          topic: manualRequest.topic || null,
          role: manualRequest.role || null,
          difficulty: manualRequest.difficulty || null,
          interviewType: manualRequest.interview_type || null,
        },
      }),
      prisma.manual_booking_requests.update({
        where: { id: manualRequest.id },
        data: {
          status: 'ASSIGNED',
          preferredInterviewerId: parseInt(interviewerId),
        },
      }),
    ]);

    // Link sessionId back to the request
    await prisma.manual_booking_requests.update({
      where: { id: manualRequest.id },
      data: { sessionId: session.id },
    });

    // Increment student usage counter
    const usageField =
      manualRequest.session_type === 'INTERVIEW' ? 'interviewsUsed' : 'guidanceUsed';
    await prisma.studentProfile.update({
      where: { id: manualRequest.student_id },
      data: { [usageField]: { increment: 1 } },
    });

    // Send assignment email to student
    try {
      await sendManualBookingAssignedToStudent({
        studentName: manualRequest.student.user.name || manualRequest.student.name,
        studentEmail: manualRequest.student.user.email,
        sessionType: manualRequest.sessionType,
        interviewerName: interviewer.user.name || interviewer.name,
        interviewerEmail: interviewer.user.email,
        interviewerCompanies: interviewer.companies,
        interviewerYearsOfExperience: interviewer.yearsOfExperience,
        interviewerLinkedinUrl: interviewer.linkedinUrl,
        scheduledTime: new Date(scheduledTime),
        durationMinutes: duration,
        role: manualRequest.role,
        difficulty: manualRequest.difficulty,
        interviewType: manualRequest.interview_type,
        topic: manualRequest.topic,
        sessionId: session.id,
      });
    } catch (e) {
      console.error('Assignment email failed:', e);
    }

    return NextResponse.json({
      success: true,
      message: 'Interviewer assigned and student notified.',
      sessionId: session.id,
    });
  } catch (error: any) {
    console.error('Admin assign manual request error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: authErrorStatus(error.message) }
    );
  }
}