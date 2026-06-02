// src/app/api/interview-room/route.ts
// ─── VERCEL-COMPATIBLE: Uses PostgreSQL via Prisma (no in-memory state) ───────

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  sender: string;
  senderName: string;
  text: string;
  timestamp: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getOrCreateRoom(sessionId: string) {
  // Upsert: create if missing, return existing if present
  return prisma.signalingRoom.upsert({
    where: { id: sessionId },
    create: {
      id: sessionId,
      studentCandidates: [],
      interviewerCandidates: [],
      messages: [],
      offerTimestamp: BigInt(0),
    },
    update: {}, // don't overwrite on read
  });
}

// Auto-clean rooms older than 4 hours (best-effort, non-blocking)
function scheduleCleanup(sessionId: string) {
  setTimeout(async () => {
    try {
      await prisma.signalingRoom.deleteMany({
        where: {
          id: sessionId,
          createdAt: { lt: new Date(Date.now() - 4 * 60 * 60 * 1000) },
        },
      });
    } catch {
      // ignore
    }
  }, 4 * 60 * 60 * 1000);
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const role = searchParams.get('role');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  try {
    const room = await getOrCreateRoom(sessionId);

    if (role === 'student') {
      return NextResponse.json({
        sessionId,
        offer: room.offer ?? null,
        answer: room.answer ?? null,
        // Student receives interviewer's ICE candidates
        iceCandidates: room.interviewerCandidates as unknown as RTCIceCandidateInit[],
        messages: room.messages as unknown as ChatMessage[],
      });
    }

    // Interviewer receives student's offer + student ICE candidates
    return NextResponse.json({
      sessionId,
      offer: room.offer ?? null,
      answer: room.answer ?? null,
      studentCandidates: room.studentCandidates as unknown as RTCIceCandidateInit[],
      messages: room.messages as unknown as ChatMessage[],
    });
  } catch (error) {
    console.error('GET /api/interview-room error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { sessionId, action, role, offer, answer, candidate, text, senderName } = body;

  if (!sessionId || !action) {
    return NextResponse.json(
      { error: 'sessionId and action are required' },
      { status: 400 }
    );
  }

  try {
    switch (action) {
      // ── Student sends offer ────────────────────────────────────────────────
      case 'offer': {
        await prisma.signalingRoom.upsert({
          where: { id: sessionId },
          create: {
            id: sessionId,
            offer,
            studentCandidates: [],
            interviewerCandidates: [],
            messages: [],
            offerTimestamp: BigInt(Date.now()),
          },
          update: {
            offer,
            answer: "",             // clear stale answer
            studentCandidates: [],    // clear stale candidates
            interviewerCandidates: [],
            offerTimestamp: BigInt(Date.now()),
            updatedAt: new Date(),
          },
        });
        scheduleCleanup(sessionId);
        return NextResponse.json({ success: true });
      }
      // ── Interviewer sends answer ───────────────────────────────────────────
      case 'answer': {
        await prisma.signalingRoom.upsert({
          where: { id: sessionId },
          create: {
            id: sessionId,
            answer,
            studentCandidates: [],
            interviewerCandidates: [],
            messages: [],
            offerTimestamp: BigInt(0),
          },
          update: {
            answer,
            updatedAt: new Date(),
          },
        });
        return NextResponse.json({ success: true });
      }

      // ── ICE candidate ─────────────────────────────────────────────────────
      case 'ice-candidate': {
        if (!candidate) {
          return NextResponse.json({ error: 'candidate required' }, { status: 400 });
        }

        const room = await getOrCreateRoom(sessionId);
        const key = JSON.stringify(candidate);

        if (role === 'student') {
          const existing = room.studentCandidates as unknown as RTCIceCandidateInit[];
          if (!existing.some((c) => JSON.stringify(c) === key)) {
            await prisma.signalingRoom.update({
              where: { id: sessionId },
              data: {
                studentCandidates: [...existing, candidate],
                updatedAt: new Date(),
              },
            });
          }
        } else {
          const existing = room.interviewerCandidates as unknown as RTCIceCandidateInit[];
          if (!existing.some((c) => JSON.stringify(c) === key)) {
            await prisma.signalingRoom.update({
              where: { id: sessionId },
              data: {
                interviewerCandidates: [...existing, candidate],
                updatedAt: new Date(),
              },
            });
          }
        }

        return NextResponse.json({ success: true });
      }

      // ── Chat message ──────────────────────────────────────────────────────
      case 'message': {
        if (!text?.trim()) {
          return NextResponse.json({ error: 'text required' }, { status: 400 });
        }

        const message: ChatMessage = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          sender: role ?? 'unknown',
          senderName: senderName ?? (role === 'student' ? 'Student' : 'Interviewer'),
          text: text.trim(),
          timestamp: new Date().toISOString(),
        };

        const room = await getOrCreateRoom(sessionId);
        const messages = room.messages as unknown as ChatMessage[];
        const updated = [...messages, message].slice(-200); // keep last 200

        await prisma.signalingRoom.update({
          where: { id: sessionId },
          data: { messages: updated as unknown as Prisma.InputJsonValue, updatedAt: new Date() },
        });

        return NextResponse.json({ success: true, message });
      }

      // ── Reset room ────────────────────────────────────────────────────────
      case 'reset': {
        await prisma.signalingRoom.deleteMany({ where: { id: sessionId } });
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error(`POST /api/interview-room [${action}] error:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}