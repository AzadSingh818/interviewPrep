// src/app/api/ai/monitor/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorStatus } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendCustomEmail } from '@/lib/email';
import { fetchGroqChatCompletion } from '@/lib/ai/groq';

// Parse Groq JSON behavior response
interface BehaviorAnalysis {
  score: number;
  flag: 'green' | 'yellow' | 'red';
  summary: string;
  issues: string[];
}

function parseBehaviorAnalysis(raw: string): BehaviorAnalysis {
  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    const score = Number(parsed?.score);
    const flag = parsed?.flag;
    const summary = typeof parsed?.summary === 'string' ? parsed.summary.trim() : '';
    const issues = Array.isArray(parsed?.issues)
      ? parsed.issues.filter((issue: unknown) => typeof issue === 'string').map((issue: string) => String(issue).trim()).filter(Boolean)
      : [];

    if (!Number.isFinite(score) || score < 0 || score > 100) {
      throw new Error('Invalid behavior score');
    }
    if (flag !== 'green' && flag !== 'yellow' && flag !== 'red') {
      throw new Error('Invalid behavior flag');
    }
    if (!summary) {
      throw new Error('Invalid behavior summary');
    }

    return {
      score: Math.round(score),
      flag,
      summary,
      issues,
    };
  } catch (err) {
    console.error('Failed to parse behavior analysis JSON:', err);
    return {
      score: 50,
      flag: 'yellow',
      summary: 'Automated conduct analysis yielded formatting anomalies. Please review manually.',
      issues: ['Could not verify score cleanly.'],
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authorize the user (Interviewer only)
    const auth = await requireAuth(['INTERVIEWER']);

    // 2. Parse form data
    const formData = await request.formData();
    const sessionIdRaw = formData.get('sessionId');
    const audioFile = formData.get('audio') as File | null;

    if (!sessionIdRaw || !audioFile) {
      return NextResponse.json({ error: 'sessionId and audio are required' }, { status: 400 });
    }

    const sessionId = Number(sessionIdRaw);
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
    }

    // Verify session exists and belongs to this interviewer
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        sessionType: true,
        topic: true,
        role: true,
        difficulty: true,
        interviewType: true,
        student: { select: { name: true, user: { select: { email: true } } } },
        interviewer: { select: { name: true, userId: true } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.interviewer.userId !== auth.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. Transcribe audio using Groq Whisper API
    console.log(`🎙️ Sending audio upload for session #${sessionId} to Groq Whisper...`);
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    const audioBlob = new Blob([audioBuffer], { type: audioFile.type || 'audio/webm' });

    const whisperFormData = new FormData();
    whisperFormData.append('file', audioBlob, 'audio.webm');
    whisperFormData.append('model', 'whisper-large-v3');
    whisperFormData.append('response_format', 'json');

    const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: whisperFormData,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      console.error('Groq Whisper transcription failed:', errText);
      return NextResponse.json({ error: 'Failed to transcribe audio' }, { status: 500 });
    }

    const whisperData = await whisperRes.json();
    const transcript = (whisperData.text || '').trim();

    if (!transcript) {
      console.warn('Transcript is empty for session:', sessionId);
      return NextResponse.json({ error: 'No audio detected' }, { status: 400 });
    }

    console.log(`📝 Transcript obtained: ${transcript.substring(0, 100)}...`);

    // 4. Generate Student Performance Report (Technical Mistakes)
    console.log('🤖 Running student performance evaluation...');
    const studentSystemPrompt = `You are a senior technical interviewer. Analyze the transcript of a mock interview between an Interviewer and a Student.
Identify and list ALL technical mistakes, conceptual errors, incorrect answers, and gaps in knowledge shown by the Student.
Present this as a clean, structured Markdown report with clear headings:
1. **Technical Errors & Mistakes** (Explain what the student answered incorrectly)
2. **Knowledge Gaps & Weak Areas** (Concepts the student struggled to explain)
3. **Communication Notes** (Feedback on clarity and confidence)
4. **Actionable Recommendations** (What the student should study next)

Be specific, objective, and constructive. Keep the formatting clean.`;

    const studentUserPrompt = `<session_metadata>
Student Name: ${session.student.name}
Role: ${session.role || 'General'}
Difficulty: ${session.difficulty || 'Medium'}
Interview Type: ${session.interviewType || 'Technical'}
</session_metadata>

<interview_transcript>
${transcript}
</interview_transcript>`;

    const studentEvalRes = await fetchGroqChatCompletion({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: studentSystemPrompt },
        { role: 'user', content: studentUserPrompt },
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    let studentReport = 'Unable to generate student report.';
    if (studentEvalRes.ok) {
      const studentData = await studentEvalRes.json();
      studentReport = studentData?.choices?.[0]?.message?.content?.trim() || studentReport;
    }

    // 5. Generate Interviewer Conduct Report
    console.log('🤖 Running interviewer conduct evaluation...');
    const interviewerSystemPrompt = `You are a professional conduct auditor for an interview platform. Analyze the transcript of a mock interview.
Evaluate the Interviewer's questioning style, professionalism, tone, and behavior. Look for any rude, dismissive, inappropriate, or unprofessional remarks.

Output ONLY a valid JSON object in this exact format:
{
  "score": <number 0-100, where 100 is perfect professional conduct>,
  "flag": <"green" | "yellow" | "red">,
  "summary": "<1-2 sentence summary of overall conduct>",
  "issues": ["<specific issue 1 if any>", "<specific issue 2 if any>"]
}

Scoring:
- green (80-100): Professional, respectful, encouraging, constructive
- yellow (50-79): Minor issues (impatient, overly informal, mild bias)
- red (0-49): Highly unprofessional, rude, offensive, or inappropriate language`;

    const interviewerUserPrompt = `<session_metadata>
Interviewer Name: ${session.interviewer.name}
Student Name: ${session.student.name}
</session_metadata>

<interview_transcript>
${transcript}
</interview_transcript>`;

    const interviewerEvalRes = await fetchGroqChatCompletion({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: interviewerSystemPrompt },
        { role: 'user', content: interviewerUserPrompt },
      ],
      temperature: 0.2,
      max_tokens: 400,
    });

    let interviewerScore = 90;
    let interviewerFlag: 'green' | 'yellow' | 'red' = 'green';
    let interviewerReport = 'Interviewer behaved professionally.';

    if (interviewerEvalRes.ok) {
      const interviewerData = await interviewerEvalRes.json();
      const rawReportText = interviewerData?.choices?.[0]?.message?.content?.trim() || '';
      const parsedReport = parseBehaviorAnalysis(rawReportText);
      interviewerScore = parsedReport.score;
      interviewerFlag = parsedReport.flag;
      interviewerReport = parsedReport.summary;
      if (parsedReport.issues.length > 0) {
        interviewerReport += ` Issues flagged: ${parsedReport.issues.join(', ')}`;
      }
    }

    // 6. Save AIReport to Database
    console.log('💾 Saving AI report to database...');
    const dbReport = await prisma.aIReport.upsert({
      where: { sessionId },
      create: {
        sessionId,
        studentReport,
        interviewerReport,
        interviewerScore,
        interviewerFlag,
        transcript,
      },
      update: {
        studentReport,
        interviewerReport,
        interviewerScore,
        interviewerFlag,
        transcript,
      },
    });

    // 7. Email the Conduct Report to Admins
    const adminEmailsRaw = process.env.ADMIN_EMAILS || '';
    const adminEmails = adminEmailsRaw
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.includes('@'));

    if (adminEmails.length > 0) {
      const flagEmoji = { green: '🟢', yellow: '🟡', red: '🔴' };
      const mailSubject = `[AI Monitor] Conduct Report - Session #${sessionId} (${session.interviewer.name})`;
      const mailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #1e1b4b; border-bottom: 2px solid #6d28d9; padding-bottom: 8px;">AI Interview Conduct Monitor</h2>
          <p>An automated analysis has been completed for Mock Interview Session <strong>#${sessionId}</strong>.</p>
          
          <table width="100%" style="border-collapse: collapse; margin-top: 15px;">
            <tr style="background: #f8fafc;">
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">Interviewer</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0;">${session.interviewer.name}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">Student</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0;">${session.student.name}</td>
            </tr>
            <tr style="background: #f8fafc;">
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">Conduct Rating</td>
              <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; color: ${interviewerFlag === 'green' ? '#16a34a' : interviewerFlag === 'yellow' ? '#d97706' : '#dc2626'}">
                ${flagEmoji[interviewerFlag]} ${interviewerScore}/100 (${interviewerFlag.toUpperCase()})
              </td>
            </tr>
          </table>

          <div style="margin-top: 20px; padding: 15px; background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 6px;">
            <h3 style="color: #6d28d9; margin-top: 0;">AI Audit Summary</h3>
            <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0;">${interviewerReport}</p>
          </div>
          
          <p style="font-size: 11px; color: #9ca3af; margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: center;">
            This is an automated security audit generated by InterviewPrepLive.
          </p>
        </div>
      `;

      console.log(`✉️ Sending AI conduct report to ${adminEmails.length} admin(s)...`);
      for (const adminEmail of adminEmails) {
        try {
          await sendCustomEmail(adminEmail, mailSubject, mailHtml);
        } catch (emailErr) {
          console.error(`Failed to send email to admin ${adminEmail}:`, emailErr);
        }
      }
    }

    return NextResponse.json({ success: true, reportId: dbReport.id });

  } catch (error: any) {
    console.error('Error in POST /api/ai/monitor:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: authErrorStatus(error.message) },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // 1. Authorize user (Interviewer or Student)
    const auth = await requireAuth(['INTERVIEWER', 'STUDENT']);

    // 2. Fetch parameter
    const { searchParams } = new URL(request.url);
    const sessionIdRaw = searchParams.get('sessionId');

    if (!sessionIdRaw) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }

    const sessionId = Number(sessionIdRaw);
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
    }

    // 3. Query report
    const report = await prisma.aIReport.findUnique({
      where: { sessionId },
      select: {
        id: true,
        sessionId: true,
        studentReport: true,
        interviewerReport: true,
        interviewerScore: true,
        interviewerFlag: true,
        createdAt: true,
      },
    });

    if (!report) {
      return NextResponse.json({ error: 'No report found for this session' }, { status: 404 });
    }

    // 4. Verify access
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        student: { select: { userId: true } },
        interviewer: { select: { userId: true } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const isAuthorized =
      session.student.userId === auth.userId || session.interviewer.userId === auth.userId;

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ report });

  } catch (error: any) {
    console.error('Error in GET /api/ai/monitor:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: authErrorStatus(error.message) },
    );
  }
}
