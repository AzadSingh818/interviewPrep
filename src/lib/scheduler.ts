// src/lib/scheduler.ts
// Runs a background cron job every minute to send reminder emails
// 30 minutes before each scheduled session.

import cron from 'node-cron';
import { prisma } from '@/lib/prisma';
import { sendReminderToStudent, sendReminderToInterviewer } from '@/lib/email';

let isSchedulerRunning = false;

export function startScheduler() {
  // Prevent duplicate schedulers (Next.js hot reload can call this multiple times)
  if (isSchedulerRunning) return;
  isSchedulerRunning = true;

  console.log('✅ Session reminder scheduler started');

  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();

      // Window: sessions starting between 29 and 31 minutes from now
      // This gives a 2-minute window so no session is missed between cron ticks
      const windowStart = new Date(now.getTime() + 29 * 60_000);
      const windowEnd   = new Date(now.getTime() + 31 * 60_000);

      const upcomingSessions = await prisma.session.findMany({
        where: {
          status:        'SCHEDULED',
          scheduledTime: { gte: windowStart, lte: windowEnd },
          reminderSent:  false, // only send once
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

      if (upcomingSessions.length === 0) return;

      console.log(`🔔 Sending reminders for ${upcomingSessions.length} session(s)...`);

      for (const session of upcomingSessions) {
        const reminderData = {
          sessionType:     session.sessionType as 'GUIDANCE' | 'INTERVIEW',
          scheduledTime:   session.scheduledTime,
          durationMinutes: session.durationMinutes,
          topic:           session.topic,
          role:            session.role,
          difficulty:      session.difficulty,
          interviewType:   session.interviewType,

          studentName:       session.student.name,
          studentEmail:      session.student.user.email,
          studentCollege:    session.student.college,
          studentBranch:     session.student.branch,
          studentTargetRole: session.student.targetRole,

          interviewerName:              session.interviewer.name,
          interviewerEmail:             session.interviewer.user.email,
          interviewerCompanies:         session.interviewer.companies,
          interviewerYearsOfExperience: session.interviewer.yearsOfExperience,
          interviewerLinkedinUrl:       session.interviewer.linkedinUrl,
        };

        // Send both emails
        await Promise.all([
          sendReminderToStudent(reminderData),
          sendReminderToInterviewer(reminderData),
        ]);

        console.log(`✅ Reminder sent for session ${session.id} (${session.sessionType})`);
      }
    } catch (error) {
      console.error('❌ Scheduler error:', error);
    }
  });
}