// src/app/api/ai/notes/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorStatus } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await requireAuth(['INTERVIEWER']);

    const body = await request.json();
    const { action, sessionId, notes, chatMessages, sessionInfo } = body;

    // ── ACTION 1: Generate structured AI notes from bullet points ────────────
    if (action === 'generate-notes') {
      const chatContext = chatMessages?.length
        ? chatMessages
            .filter((m: any) => m.sender !== 'system')
            .map((m: any) => `[${m.sender === 'interviewer' ? 'Interviewer' : 'Student'}]: ${m.text}`)
            .join('\n')
        : 'No chat messages yet.';

      const prompt = `You are an expert technical interviewer. Generate structured, professional interview notes for an admin based on the following raw notes and chat transcript.

SESSION INFO:
- Student: ${sessionInfo?.studentName || 'Student'}
- Role: ${sessionInfo?.role || 'General'}
- Difficulty: ${sessionInfo?.difficulty || 'N/A'}
- Interview Type: ${sessionInfo?.interviewType || 'Technical'}
- Duration: ${sessionInfo?.duration || 'N/A'}

RAW NOTES FROM INTERVIEWER:
${notes || '(No notes written yet)'}

CHAT TRANSCRIPT:
${chatContext}

Generate a structured report with these exact sections:
1. **Interview Summary** - 2-3 sentences overview
2. **Technical Assessment** - Key technical points observed
3. **Communication & Behavior** - How the student communicated
4. **Strengths Observed** - 2-3 bullet points
5. **Areas for Improvement** - 2-3 bullet points
6. **Overall Impression** - One final sentence

Keep it professional, concise, and factual. Only include what can be inferred from the notes and chat.`;

      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
          max_tokens: 800,
        }),
      });

      if (!groqRes.ok) {
        const err = await groqRes.json();
        return NextResponse.json({ error: err?.error?.message || 'AI failed' }, { status: 500 });
      }

      const data = await groqRes.json();
      const text = data?.choices?.[0]?.message?.content?.trim() || '';
      return NextResponse.json({ notes: text });
    }

    // ── ACTION 2: Behavior analysis of interviewer's messages ─────────────────
    if (action === 'analyze-behavior') {
      const interviewerMessages = chatMessages
        ?.filter((m: any) => m.sender === 'interviewer')
        .map((m: any) => m.text)
        .join('\n');

      if (!interviewerMessages || interviewerMessages.trim().length < 10) {
        return NextResponse.json({
          score: 100,
          flag: 'green',
          summary: 'Not enough messages to analyze yet.',
          issues: [],
        });
      }

      const prompt = `You are a professional conduct monitor for an interview platform. Analyze the following messages sent by an INTERVIEWER to a STUDENT during a mock interview session.

INTERVIEWER MESSAGES:
${interviewerMessages}

Evaluate the interviewer's conduct and respond ONLY with a valid JSON object in this exact format:
{
  "score": <number 0-100, where 100 is perfect professional conduct>,
  "flag": <"green" | "yellow" | "red">,
  "summary": "<1-2 sentence summary of overall conduct>",
  "issues": ["<issue 1 if any>", "<issue 2 if any>"]
}

Scoring guide:
- green (80-100): Professional, respectful, encouraging
- yellow (50-79): Minor issues — slightly informal, borderline comments  
- red (0-49): Unprofessional, rude, inappropriate, discriminatory, or harassing language

issues array should be empty [] if no issues found. Be fair and objective.`;

      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 300,
        }),
      });

      if (!groqRes.ok) {
        const err = await groqRes.json();
        return NextResponse.json({ error: err?.error?.message || 'AI failed' }, { status: 500 });
      }

      const data = await groqRes.json();
      const raw = data?.choices?.[0]?.message?.content?.trim() || '{}';

      try {
        const clean = raw.replace(/```json|```/g, '').trim();
        const result = JSON.parse(clean);
        return NextResponse.json(result);
      } catch {
        return NextResponse.json({
          score: 100,
          flag: 'green',
          summary: 'Analysis complete.',
          issues: [],
        });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    console.error('AI notes error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed' },
      { status: authErrorStatus(error.message) },
    );
  }
}
