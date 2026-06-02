// src/app/api/ai/feedback/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authErrorStatus } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await requireAuth(['INTERVIEWER']);

    const body = await request.json();
    const { field, session, formData } = body;

    if (!field || !session) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const isGuidance = session.sessionType === 'GUIDANCE';

    const sessionContext = isGuidance
      ? `Session Type: Guidance Session
Student Name: ${session.student?.name || 'Student'}
Topic: ${session.topic || 'General Guidance'}
Duration: ${session.durationMinutes} minutes`
      : `Session Type: Mock Interview
Student Name: ${session.student?.name || 'Student'}
Role Applied For: ${session.role || 'General'}
Difficulty Level: ${session.difficulty || 'Medium'}
Interview Type: ${session.interviewType || 'Technical'}
Duration: ${session.durationMinutes} minutes`;

    const ratingsContext =
      !isGuidance && formData
        ? `
Ratings provided by interviewer:
- Technical Depth: ${formData.technicalDepth}/5
- Problem Solving: ${formData.problemSolving}/5
- Communication: ${formData.communication}/5
- Confidence: ${formData.confidence}/5`
        : '';

    const writtenFields = formData
      ? Object.entries({
          summary: formData.summary,
          strengths: formData.strengths,
          recommendations: formData.recommendations,
          actionItems: formData.actionItems,
          overallComments: formData.overallComments,
        })
          .filter(([k, v]) => k !== field && v && String(v).trim())
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n')
      : '';

    const fieldInstructions: Record<string, string> = {
      summary: `Write a concise, professional 2-3 sentence summary of this ${isGuidance ? 'guidance' : 'mock interview'} session. Mention the session topic/role and give an overall impression of how it went.`,
      strengths: `List exactly 3-4 specific strengths the student demonstrated during this session. Each point should be on a new line starting with "- ". Be specific, encouraging, and professional.`,
      recommendations: `List exactly 3-4 specific, constructive areas for improvement. Each point should be on a new line starting with "- ". Be specific about what to improve and how.`,
      actionItems: `List exactly 3-4 concrete, actionable next steps the student should take after this session. Each point should be on a new line starting with "- ". Be specific with tools or resources where relevant.`,
      overallComments: `Write a 2-3 sentence overall performance comment for this mock interview. Reference the ratings given and provide a balanced, honest assessment. End with an encouraging note.`,
    };

    if (!fieldInstructions[field]) {
      return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
    }

    const prompt = `You are a senior technical interviewer writing professional feedback for a candidate.

SESSION CONTEXT:
${sessionContext}${ratingsContext}
${writtenFields ? `\nALREADY WRITTEN FEEDBACK (for context):\n${writtenFields}` : ''}

YOUR TASK:
${fieldInstructions[field]}

RULES:
- Write ONLY the feedback text itself
- No preamble like "Here is the feedback:" or "Sure!"
- No labels or field names
- Keep tone professional, specific, and constructive`;

    // Call Groq API (free, fast, generous limits)
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!groqRes.ok) {
      const errData = await groqRes.json();
      console.error('Groq API error:', errData);
      return NextResponse.json(
        { error: errData?.error?.message || 'AI call failed' },
        { status: 500 },
      );
    }

    const groqData = await groqRes.json();
    const text = groqData?.choices?.[0]?.message?.content?.trim() || '';

    if (!text) {
      return NextResponse.json(
        { error: 'No response from AI. Please try again.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ text });

  } catch (error: any) {
    console.error('AI feedback generation error:', error);
    return NextResponse.json(
      { error: error.message || 'AI generation failed' },
      { status: authErrorStatus(error.message) },
    );
  }
}