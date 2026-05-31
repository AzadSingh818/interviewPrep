import { prisma } from '@/lib/prisma';
import { sendReminderToStudent, sendReminderToInterviewer } from '@/lib/email';

export async function processDueSessionReminders(now = new Date()) {
  const windowStart = new Date(now.getTime() + 29 * 60_000);
  const windowEnd = new Date(now.getTime() + 31 * 60_000);

  const upcomingSessions = await prisma.session.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledTime: { gte: windowStart, lte: windowEnd },
      reminderSent: false,
    },
    include: {
      student: {
        select: {
          name: true,
          college: true,
          branch: true,
          targetRole: true,
          user: { select: { email: true } },
        },
      },
      interviewer: {
        select: {
          name: true,
          companies: true,
          yearsOfExperience: true,
          linkedinUrl: true,
          user: { select: { email: true } },
        },
      },
    },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const session of upcomingSessions) {
    const claim = await prisma.session.updateMany({
      where: { id: session.id, reminderSent: false },
      data: { reminderSent: true },
    });

    if (claim.count === 0) {
      skipped += 1;
      continue;
    }

    try {
      const reminderData = {
        sessionType: session.sessionType as 'GUIDANCE' | 'INTERVIEW',
        scheduledTime: session.scheduledTime,
        durationMinutes: session.durationMinutes,
        topic: session.topic,
        role: session.role,
        difficulty: session.difficulty,
        interviewType: session.interviewType,

        studentName: session.student.name,
        studentEmail: session.student.user.email,
        studentCollege: session.student.college,
        studentBranch: session.student.branch,
        studentTargetRole: session.student.targetRole,

        interviewerName: session.interviewer.name,
        interviewerEmail: session.interviewer.user.email,
        interviewerCompanies: session.interviewer.companies,
        interviewerYearsOfExperience: session.interviewer.yearsOfExperience,
        interviewerLinkedinUrl: session.interviewer.linkedinUrl,
      };

      await Promise.all([
        sendReminderToStudent(reminderData),
        sendReminderToInterviewer(reminderData),
      ]);
      sent += 1;
    } catch (error) {
      failed += 1;
      await prisma.session.update({
        where: { id: session.id },
        data: { reminderSent: false },
      });
      console.error(`Reminder failed for session ${session.id}:`, error);
    }
  }

  return {
    matched: upcomingSessions.length,
    sent,
    skipped,
    failed,
  };
}
