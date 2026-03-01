// lib/email.ts
// Email utility using Nodemailer — professional table-based HTML emails

import nodemailer from 'nodemailer';

// ─── Transporter ─────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function formatDateOnly(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(date));
}

function formatTimeOnly(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Kolkata', timeZoneName: 'short',
  }).format(new Date(date));
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ─── Table rows builder ───────────────────────────────────────────────────────
function tableRows(rows: Array<{ label: string; value: string; href?: string; highlight?: boolean }>): string {
  return rows.map((r, i) => {
    const isLast = i === rows.length - 1;
    const bg = r.highlight ? '#f0fdf4' : (i % 2 === 0 ? '#ffffff' : '#f8faff');
    const border = isLast ? '' : 'border-bottom:1px solid #ede9fe;';
    const val = r.href
      ? `<a href="${r.href}" style="color:#7c3aed;text-decoration:none;font-weight:700;border-bottom:2px solid #ede9fe;">${r.value}</a>`
      : r.value;
    const labelColor = r.highlight ? '#166534' : '#6b7280';
    const valueColor = r.highlight ? '#15803d' : '#111827';
    return `
      <tr>
        <td style="padding:14px 22px;font-size:13px;color:${labelColor};font-weight:500;
                   background:${bg};${border}width:36%;vertical-align:middle;
                   border-right:1px solid #ede9fe;">${r.label}</td>
        <td style="padding:14px 22px;font-size:13.5px;color:${valueColor};
                   font-weight:700;background:${bg};${border}vertical-align:middle;">${val}</td>
      </tr>`;
  }).join('');
}

// ─── Master email template (table-based, email-client safe) ──────────────────
function buildEmail(opts: {
  preheader: string;
  headerEmoji: string;
  heading: string;
  subheading: string;
  badgeText: string;
  badgeBg: string;
  badgeFg: string;
  dateStr: string;
  startTimeStr: string;
  endTimeStr: string;
  section1Heading: string;
  section1Rows: Array<{ label: string; value: string; href?: string; highlight?: boolean }>;
  section2Heading: string;
  section2Rows: Array<{ label: string; value: string; href?: string; highlight?: boolean }>;
  tipText: string;
  footerText: string;
}): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${opts.heading}</title>
</head>
<body style="margin:0;padding:0;background:#f0f0ff;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#f0f0ff;">${opts.preheader}</div>

<!-- ═══════════════ OUTER WRAPPER ═══════════════ -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0ff;padding:48px 16px;">
<tr><td align="center">

<!-- ═══════════════ CARD ═══════════════ -->
<table width="620" cellpadding="0" cellspacing="0"
  style="max-width:620px;width:100%;border-radius:24px;overflow:hidden;
         box-shadow:0 20px 60px rgba(109,40,217,0.18),0 4px 16px rgba(0,0,0,0.08);">

  <!-- ╔══════════════════════════════════════╗ -->
  <!-- ║           HEADER GRADIENT            ║ -->
  <!-- ╚══════════════════════════════════════╝ -->
  <tr>
    <td style="background:linear-gradient(140deg,#3730a3 0%,#6d28d9 50%,#7c3aed 100%);
               padding:0;">
      <!-- Top decorative bar -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="height:4px;background:linear-gradient(90deg,#818cf8,#c084fc,#f472b6,#c084fc,#818cf8);"></td>
        </tr>
      </table>
      <!-- Logo + title -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:36px 48px 32px;text-align:center;">
            <!-- Icon circle -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 18px;">
              <tr>
                <td style="width:72px;height:72px;border-radius:20px;
                            background:rgba(255,255,255,0.15);text-align:center;
                            line-height:72px;font-size:34px;
                            border:2px solid rgba(255,255,255,0.25);">
                  ${opts.headerEmoji}
                </td>
              </tr>
            </table>
            <p style="margin:0 0 4px;font-size:26px;font-weight:900;color:#ffffff;
                      letter-spacing:-0.5px;line-height:1.2;">
              InterviewPrep<span style="color:#c4b5fd;">Live</span>
            </p>
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.55);
                      letter-spacing:2px;text-transform:uppercase;font-weight:600;">
              Interview Preparation Platform
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ╔══════════════════════════════════════╗ -->
  <!-- ║              WHITE BODY              ║ -->
  <!-- ╚══════════════════════════════════════╝ -->
  <tr>
    <td style="background:#ffffff;">

      <!-- ── HERO SECTION ── -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:40px 48px 0;text-align:center;">
            <h1 style="margin:0 0 10px;font-size:30px;font-weight:900;color:#1e1b4b;
                       letter-spacing:-0.8px;line-height:1.2;">
              ${opts.heading}
            </h1>
            <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.5;">
              ${opts.subheading}
            </p>
            <!-- Badge -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="padding:7px 24px;border-radius:999px;font-size:11px;font-weight:800;
                            letter-spacing:2px;text-transform:uppercase;
                            background:${opts.badgeBg};color:${opts.badgeFg};
                            border:1.5px solid ${opts.badgeFg}22;">
                  ${opts.badgeText}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- ── DATE / TIME BANNER ── -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:28px 48px 0;">
            <!-- Outer banner -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border-radius:16px;overflow:hidden;
                           box-shadow:0 4px 20px rgba(109,40,217,0.12);">
              <!-- Banner top accent -->
              <tr>
                <td colspan="2" style="height:3px;
                    background:linear-gradient(90deg,#6366f1,#8b5cf6,#a855f7);"></td>
              </tr>
              <tr>
                <!-- Date column -->
                <td style="padding:22px 28px;width:52%;vertical-align:middle;
                            background:linear-gradient(135deg,#eef2ff,#ede9fe);
                            border-right:1px solid #c7d2fe;">
                  <p style="margin:0 0 5px;font-size:10px;font-weight:800;color:#7c3aed;
                             text-transform:uppercase;letter-spacing:2px;">📅 &nbsp;Date</p>
                  <p style="margin:0;font-size:15px;font-weight:800;color:#1e1b4b;line-height:1.3;">
                    ${opts.dateStr}
                  </p>
                </td>
                <!-- Time column -->
                <td style="padding:22px 28px;vertical-align:middle;
                            background:linear-gradient(135deg,#faf5ff,#ede9fe);">
                  <p style="margin:0 0 5px;font-size:10px;font-weight:800;color:#7c3aed;
                             text-transform:uppercase;letter-spacing:2px;">🕐 &nbsp;Time (IST)</p>
                  <p style="margin:0 0 3px;font-size:16px;font-weight:900;color:#1e1b4b;">
                    ${opts.startTimeStr}
                  </p>
                  <p style="margin:0;font-size:12px;color:#7c3aed;font-weight:600;">
                    ↳ ends at &nbsp;${opts.endTimeStr}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- ── SECTION 1: SESSION DETAILS ── -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:28px 48px 0;">
            <!-- Section label -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
              <tr>
                <td style="font-size:10px;font-weight:800;color:#7c3aed;
                           text-transform:uppercase;letter-spacing:2px;
                           padding-bottom:10px;border-bottom:2px solid #ede9fe;">
                  ${opts.section1Heading}
                </td>
              </tr>
            </table>
            <!-- Data table -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1.5px solid #ede9fe;border-radius:14px;overflow:hidden;
                          border-collapse:separate;border-spacing:0;
                          box-shadow:0 2px 12px rgba(109,40,217,0.06);">
              ${tableRows(opts.section1Rows)}
            </table>
          </td>
        </tr>
      </table>

      <!-- ── SECTION 2: PERSON DETAILS ── -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:24px 48px 0;">
            <!-- Section label -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
              <tr>
                <td style="font-size:10px;font-weight:800;color:#7c3aed;
                           text-transform:uppercase;letter-spacing:2px;
                           padding-bottom:10px;border-bottom:2px solid #ede9fe;">
                  ${opts.section2Heading}
                </td>
              </tr>
            </table>
            <!-- Data table -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border:1.5px solid #ede9fe;border-radius:14px;overflow:hidden;
                          border-collapse:separate;border-spacing:0;
                          box-shadow:0 2px 12px rgba(109,40,217,0.06);">
              ${tableRows(opts.section2Rows)}
            </table>
          </td>
        </tr>
      </table>

      <!-- ── TIP / NOTE BOX ── -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:24px 48px 0;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="border-radius:14px;overflow:hidden;
                          box-shadow:0 2px 12px rgba(34,197,94,0.10);">
              <!-- Green top accent -->
              <tr>
                <td style="height:3px;background:linear-gradient(90deg,#22c55e,#16a34a,#15803d);"></td>
              </tr>
              <tr>
                <td style="padding:18px 24px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);
                            font-size:13.5px;color:#166534;line-height:1.65;">
                  💡 &nbsp;<strong>Note:</strong> ${opts.tipText}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- ── SPACER ── -->
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="height:32px;"></td></tr>
      </table>

    </td>
  </tr>

  <!-- ╔══════════════════════════════════════╗ -->
  <!-- ║              FOOTER                  ║ -->
  <!-- ╚══════════════════════════════════════╝ -->
  <tr>
    <td style="background:linear-gradient(135deg,#1e1b4b,#312e81);padding:28px 48px;text-align:center;">
      <!-- Footer logo -->
      <p style="margin:0 0 8px;font-size:16px;font-weight:800;color:#ffffff;">
        InterviewPrep<span style="color:#c4b5fd;">Live</span>
      </p>
      <p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.55);">${opts.footerText}</p>
      <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);">
        © ${year} InterviewPrepLive. All rights reserved.
      </p>
    </td>
  </tr>

  <!-- Bottom rainbow bar -->
  <tr>
    <td style="height:4px;background:linear-gradient(90deg,#818cf8,#c084fc,#f472b6,#c084fc,#818cf8);"></td>
  </tr>

</table>
<!-- /CARD -->

</td></tr>
</table>
<!-- /OUTER WRAPPER -->
</body>
</html>`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface BookingEmailData {
  sessionType: 'GUIDANCE' | 'INTERVIEW';
  scheduledTime: Date;
  durationMinutes: number;
  topic?: string | null;
  role?: string | null;
  difficulty?: string | null;
  interviewType?: string | null;

  studentName: string;
  studentEmail: string;
  studentCollege?: string | null;
  studentBranch?: string | null;
  studentTargetRole?: string | null;

  interviewerName: string;
  interviewerEmail: string;
  interviewerCompanies?: string[];
  interviewerYearsOfExperience?: number | null;
  interviewerLinkedinUrl?: string | null;
}

// ─── Student booking confirmation ─────────────────────────────────────────────
export async function sendBookingConfirmationToStudent(data: BookingEmailData): Promise<void> {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'InterviewPrep Live';
  const isInterview = data.sessionType === 'INTERVIEW';
  const sessionLabel = isInterview ? 'Mock Interview' : 'Guidance Session';

  const start = new Date(data.scheduledTime);
  const end   = new Date(start.getTime() + data.durationMinutes * 60_000);

  const section1Rows = isInterview
    ? [
        { label: 'Session Type',   value: 'Mock Interview' },
        { label: 'Role',           value: data.role || 'General' },
        { label: 'Difficulty',     value: data.difficulty ? capitalize(data.difficulty) : '—' },
        { label: 'Interview Type', value: data.interviewType ? capitalize(data.interviewType) : '—' },
        { label: 'Duration',       value: `${data.durationMinutes} minutes` },
        { label: 'Status',         value: '✅ Confirmed', highlight: true },
      ]
    : [
        { label: 'Session Type', value: 'Guidance Session' },
        { label: 'Topic',        value: data.topic || 'General Guidance' },
        { label: 'Duration',     value: `${data.durationMinutes} minutes` },
        { label: 'Status',       value: '✅ Confirmed', highlight: true },
      ];

  const section2Rows: Array<{ label: string; value: string; href?: string }> = [
    { label: 'Name', value: data.interviewerName },
    ...(data.interviewerCompanies?.length ? [{ label: 'Companies', value: data.interviewerCompanies.join(', ') }] : []),
    ...(data.interviewerYearsOfExperience ? [{ label: 'Experience', value: `${data.interviewerYearsOfExperience} years` }] : []),
    ...(data.interviewerLinkedinUrl ? [{ label: 'LinkedIn', value: 'View Profile →', href: data.interviewerLinkedinUrl }] : []),
  ];

  const html = buildEmail({
    preheader: `Your ${sessionLabel} on ${formatDateOnly(start)} is confirmed!`,
    headerEmoji: isInterview ? '💼' : '🎓',
    heading: 'Booking Confirmed! 🎉',
    subheading: `Your ${sessionLabel} has been successfully scheduled.`,
    badgeText: sessionLabel,
    badgeBg: isInterview ? '#dbeafe' : '#ede9fe',
    badgeFg: isInterview ? '#1e40af' : '#5b21b6',
    dateStr: formatDateOnly(start),
    startTimeStr: formatTimeOnly(start),
    endTimeStr: formatTimeOnly(end),
    section1Heading: '📋  Session Details',
    section1Rows,
    section2Heading: `👤  Your ${isInterview ? 'Interviewer' : 'Mentor'}`,
    section2Rows,
    tipText: 'Prepare well before your session! Review the topic, keep your questions ready, and join on time. You got this! 🚀',
    footerText: 'This is an automated confirmation. Please do not reply to this email.',
  });

  try {
    await transporter.sendMail({
      from: `"${appName}" <${process.env.SMTP_USER}>`,
      to: data.studentEmail,
      subject: `✅ ${sessionLabel} Confirmed — ${formatDateOnly(start)}`,
      html,
      text: `Booking Confirmed!\n\n${sessionLabel}\nDate: ${formatDateOnly(start)}\nTime: ${formatTimeOnly(start)} to ${formatTimeOnly(end)}\nDuration: ${data.durationMinutes} min\n\n${isInterview ? 'Interviewer' : 'Mentor'}: ${data.interviewerName}`,
    });
    console.log(`✅ Booking confirmation sent to student: ${data.studentEmail}`);
  } catch (err) {
    console.error('❌ Failed to send student booking confirmation:', err);
  }
}

// ─── Interviewer booking notification ────────────────────────────────────────
export async function sendBookingNotificationToInterviewer(data: BookingEmailData): Promise<void> {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'InterviewPrep Live';
  const isInterview = data.sessionType === 'INTERVIEW';
  const sessionLabel = isInterview ? 'Mock Interview' : 'Guidance Session';

  const start = new Date(data.scheduledTime);
  const end   = new Date(start.getTime() + data.durationMinutes * 60_000);

  const section1Rows = isInterview
    ? [
        { label: 'Session Type',   value: 'Mock Interview' },
        { label: 'Role',           value: data.role || 'General' },
        { label: 'Difficulty',     value: data.difficulty ? capitalize(data.difficulty) : '—' },
        { label: 'Interview Type', value: data.interviewType ? capitalize(data.interviewType) : '—' },
        { label: 'Duration',       value: `${data.durationMinutes} minutes` },
        { label: 'Status',         value: '✅ Confirmed', highlight: true },
      ]
    : [
        { label: 'Session Type', value: 'Guidance Session' },
        { label: 'Topic',        value: data.topic || 'General Guidance' },
        { label: 'Duration',     value: `${data.durationMinutes} minutes` },
        { label: 'Status',       value: '✅ Confirmed', highlight: true },
      ];

  const section2Rows = [
    { label: 'Name',  value: data.studentName },
    { label: 'Email', value: data.studentEmail },
    ...(data.studentCollege    ? [{ label: 'College',      value: data.studentCollege }]    : []),
    ...(data.studentBranch     ? [{ label: 'Branch',       value: data.studentBranch }]     : []),
    ...(data.studentTargetRole ? [{ label: 'Target Role',  value: data.studentTargetRole }] : []),
  ];

  const html = buildEmail({
    preheader: `New ${sessionLabel} assigned on ${formatDateOnly(start)}.`,
    headerEmoji: '📅',
    heading: 'New Session Assigned!',
    subheading: `A student has booked a ${sessionLabel} with you.`,
    badgeText: sessionLabel,
    badgeBg: isInterview ? '#dbeafe' : '#ede9fe',
    badgeFg: isInterview ? '#1e40af' : '#5b21b6',
    dateStr: formatDateOnly(start),
    startTimeStr: formatTimeOnly(start),
    endTimeStr: formatTimeOnly(end),
    section1Heading: '📋  Session Details',
    section1Rows,
    section2Heading: '🎓  Student Details',
    section2Rows,
    tipText: 'After the session, please submit feedback from your dashboard so the student can review their performance.',
    footerText: 'This is an automated notification. Please do not reply to this email.',
  });

  try {
    await transporter.sendMail({
      from: `"${appName}" <${process.env.SMTP_USER}>`,
      to: data.interviewerEmail,
      subject: `📅 New ${sessionLabel} — ${formatDateOnly(start)}, ${formatTimeOnly(start)}`,
      html,
      text: `New ${sessionLabel} Assigned!\n\nDate: ${formatDateOnly(start)}\nTime: ${formatTimeOnly(start)} to ${formatTimeOnly(end)}\nDuration: ${data.durationMinutes} min\n\nStudent: ${data.studentName} (${data.studentEmail})`,
    });
    console.log(`✅ Booking notification sent to interviewer: ${data.interviewerEmail}`);
  } catch (err) {
    console.error('❌ Failed to send interviewer booking notification:', err);
  }
}

// ─── Verification email ───────────────────────────────────────────────────────
export async function sendVerificationEmail(email: string, otp: string): Promise<void> {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'InterviewPrep Live';
  const year = new Date().getFullYear();

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f0f0ff;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0ff;padding:48px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0"
  style="max-width:580px;width:100%;border-radius:24px;overflow:hidden;
         box-shadow:0 20px 60px rgba(109,40,217,0.18);">
  <!-- Rainbow top bar -->
  <tr><td style="height:4px;background:linear-gradient(90deg,#818cf8,#c084fc,#f472b6,#c084fc,#818cf8);"></td></tr>
  <!-- Header -->
  <tr>
    <td style="background:linear-gradient(140deg,#3730a3,#6d28d9,#7c3aed);
               padding:36px 48px 28px;text-align:center;">
      <p style="margin:0 0 4px;font-size:24px;font-weight:900;color:#ffffff;">
        InterviewPrep<span style="color:#c4b5fd;">Live</span>
      </p>
      <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.5);
                letter-spacing:2px;text-transform:uppercase;">Interview Preparation Platform</p>
    </td>
  </tr>
  <!-- Body -->
  <tr>
    <td style="background:#ffffff;padding:44px 48px;text-align:center;">
      <p style="margin:0 0 4px;font-size:36px;">🔐</p>
      <h1 style="margin:8px 0 10px;font-size:26px;font-weight:900;color:#1e1b4b;">Verify Your Email</h1>
      <p style="margin:0 0 32px;font-size:14px;color:#6b7280;line-height:1.6;">
        Use the code below to complete your registration.<br/>It expires in <strong>10 minutes</strong>.
      </p>
      <!-- OTP box -->
      <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
        <tr>
          <td style="background:linear-gradient(135deg,#eef2ff,#faf5ff);
                      border:2px dashed #a5b4fc;border-radius:18px;
                      padding:28px 52px;text-align:center;">
            <p style="margin:0 0 8px;font-size:10px;font-weight:800;color:#7c3aed;
                      text-transform:uppercase;letter-spacing:3px;">Verification Code</p>
            <p style="margin:0;font-size:54px;font-weight:900;color:#4338ca;
                      letter-spacing:12px;font-family:'Courier New',monospace;line-height:1;">
              ${otp}
            </p>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 24px;font-size:13px;color:#ef4444;font-weight:700;">
        ⏰ &nbsp;This code expires in 10 minutes
      </p>
      <!-- Security warning -->
      <table cellpadding="0" cellspacing="0" style="margin:0 auto;max-width:400px;width:100%;">
        <tr>
          <td style="background:#fef2f2;border:1px solid #fca5a5;border-radius:12px;
                      padding:14px 20px;font-size:13px;color:#991b1b;text-align:center;">
            ⚠️ <strong>Security:</strong> Never share this code. Our team will never ask for it.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <!-- Footer -->
  <tr>
    <td style="background:linear-gradient(135deg,#1e1b4b,#312e81);padding:24px 48px;text-align:center;">
      <p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,0.5);">
        If you did not create an account, please ignore this email.
      </p>
      <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.3);">
        © ${year} ${appName}. All rights reserved.
      </p>
    </td>
  </tr>
  <!-- Rainbow bottom bar -->
  <tr><td style="height:4px;background:linear-gradient(90deg,#818cf8,#c084fc,#f472b6,#c084fc,#818cf8);"></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: `"${appName}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Verify Your Email — ${appName}`,
      html,
      text: `Your verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not sign up, ignore this email.`,
    });
    console.log('✅ Verification email sent to:', email);
  } catch (error) {
    console.error('❌ Failed to send verification email:', error);
    throw new Error('Failed to send verification email');
  }
}

// ─── Welcome email ────────────────────────────────────────────────────────────
export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'InterviewPrep Live';
  const year = new Date().getFullYear();

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0f0ff;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0ff;padding:48px 16px;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0"
  style="max-width:580px;width:100%;border-radius:24px;overflow:hidden;
         box-shadow:0 20px 60px rgba(109,40,217,0.18);">
  <!-- Rainbow top bar -->
  <tr><td style="height:4px;background:linear-gradient(90deg,#818cf8,#c084fc,#f472b6,#c084fc,#818cf8);"></td></tr>
  <!-- Header -->
  <tr>
    <td style="background:linear-gradient(140deg,#3730a3,#6d28d9,#7c3aed);
               padding:36px 48px 28px;text-align:center;">
      <p style="margin:0 0 4px;font-size:24px;font-weight:900;color:#ffffff;">
        InterviewPrep<span style="color:#c4b5fd;">Live</span>
      </p>
      <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.5);
                letter-spacing:2px;text-transform:uppercase;">Interview Preparation Platform</p>
    </td>
  </tr>
  <!-- Body -->
  <tr>
    <td style="background:#ffffff;padding:52px 48px;text-align:center;">
      <p style="font-size:64px;margin:0 0 20px;line-height:1;">🎉</p>
      <h1 style="margin:0 0 14px;font-size:28px;font-weight:900;color:#1e1b4b;letter-spacing:-0.5px;">
        Welcome aboard, ${name}!
      </h1>
      <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.7;">
        Your email has been verified successfully.<br/>
        You're all set to start your interview preparation journey!
      </p>
      <!-- Highlights -->
      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:linear-gradient(135deg,#eef2ff,#faf5ff);
                    border:1.5px solid #c7d2fe;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="padding:20px 24px;text-align:center;border-right:1px solid #c7d2fe;width:33%;">
            <p style="margin:0 0 4px;font-size:22px;">📅</p>
            <p style="margin:0;font-size:12px;font-weight:700;color:#4338ca;">Book Sessions</p>
          </td>
          <td style="padding:20px 24px;text-align:center;border-right:1px solid #c7d2fe;width:33%;">
            <p style="margin:0 0 4px;font-size:22px;">💼</p>
            <p style="margin:0;font-size:12px;font-weight:700;color:#4338ca;">Mock Interviews</p>
          </td>
          <td style="padding:20px 24px;text-align:center;width:33%;">
            <p style="margin:0 0 4px;font-size:22px;">🚀</p>
            <p style="margin:0;font-size:12px;font-weight:700;color:#4338ca;">Get Feedback</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <!-- Footer -->
  <tr>
    <td style="background:linear-gradient(135deg,#1e1b4b,#312e81);padding:24px 48px;text-align:center;">
      <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);">
        © ${year} ${appName}. All rights reserved.
      </p>
    </td>
  </tr>
  <!-- Rainbow bottom bar -->
  <tr><td style="height:4px;background:linear-gradient(90deg,#818cf8,#c084fc,#f472b6,#c084fc,#818cf8);"></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: `"${appName}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Welcome to ${appName}! 🎉`,
      html,
    });
  } catch (error) {
    console.error('Failed to send welcome email:', error);
  }
}