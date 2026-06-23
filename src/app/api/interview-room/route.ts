// src/app/api/interview-room/route.ts
// ─── VERCEL-COMPATIBLE: Uses PostgreSQL via Prisma (no in-memory state) ───────
// Supports both append-only SignalingEvent (new) and JSON arrays (legacy)

import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { authErrorStatus, requireAuth } from '@/lib/auth';
import { captureError } from '@/lib/monitoring';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  sender: string;
  senderName: string;
  text: string;
  timestamp: string;
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const message = value as Record<string, unknown>;
  return (
    typeof message.id === 'string' &&
    typeof message.sender === 'string' &&
    typeof message.senderName === 'string' &&
    typeof message.text === 'string' &&
    typeof message.timestamp === 'string'
  );
}

function parseChatMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isChatMessage);
}

type RoomRole = 'student' | 'interviewer';

function isValidRoomRole(value: unknown): value is RoomRole {
  return value === 'student' || value === 'interviewer';
}

function roomErrorStatus(message: string): number {
  if (message === 'Session not found') return 404;
  if (message === 'Invalid sessionId') return 400;
  return authErrorStatus(message);
}

async function authorizeRoomAccess(sessionIdRaw: string, requestedRole: RoomRole | null) {
  const auth = await requireAuth(['STUDENT', 'INTERVIEWER']);

  const sessionId = Number(sessionIdRaw);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    throw new Error('Invalid sessionId');
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      student: { select: { userId: true } },
      interviewer: { select: { userId: true } },
    },
  });

  if (!session) {
    throw new Error('Session not found');
  }

  const effectiveRole: RoomRole = auth.role === 'STUDENT' ? 'student' : 'interviewer';
  if (requestedRole && requestedRole !== effectiveRole) {
    throw new Error('Forbidden');
  }

  const isOwner =
    effectiveRole === 'student'
      ? session.student.userId === auth.userId
      : session.interviewer.userId === auth.userId;

  if (!isOwner) {
    throw new Error('Forbidden');
  }

  return { effectiveRole };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getOrCreateRoom(sessionId: string) {
  // Upsert: create if missing, return existing if present
  return prisma.signalingRoom.upsert({
    where: { id: sessionId },
    create: {
      id: sessionId,
      offer: undefined,
      answer: undefined,
      studentCandidates: [],
      interviewerCandidates: [],
      messages: [],
      offerTimestamp: BigInt(0),
    },
    update: {}, // don't overwrite on read
  });
}

/**
 * Append-only signaling event: write to SignalingEvent table
 * (New system: immutable events instead of JSON mutations)
 */
async function recordSignalingEvent(
  roomId: string,
  eventType: 'offer' | 'answer' | 'ice-candidate' | 'message',
  senderRole: 'student' | 'interviewer' | null,
  payload: any
) {
  try {
    return await prisma.signalingEvent.create({
      data: {
        roomId,
        eventType,
        senderRole,
        payload,
      },
    });
  } catch (error) {
    // Silently log append failures; system falls back to legacy
    console.error('Failed to record signaling event:', error);
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const roleParam = searchParams.get('role');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  if (roleParam && !isValidRoomRole(roleParam)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  try {
    const requestedRole: RoomRole | null = roleParam && isValidRoomRole(roleParam) ? roleParam : null;
    const { effectiveRole } = await authorizeRoomAccess(sessionId, requestedRole);
    const room = await getOrCreateRoom(sessionId);

    if (effectiveRole === 'student') {
      return NextResponse.json({
        sessionId,
        offer: room.offer ?? null,
        answer: room.answer ?? null,
        // Student receives interviewer's ICE candidates
        iceCandidates: room.interviewerCandidates as RTCIceCandidateInit[],
        messages: parseChatMessages(room.messages),
      });
    }

    // Interviewer receives student's offer + student ICE candidates
    return NextResponse.json({
      sessionId,
      offer: room.offer ?? null,
      answer: room.answer ?? null,
      studentCandidates: room.studentCandidates as RTCIceCandidateInit[],
      messages: parseChatMessages(room.messages),
    });
  } catch (error) {
    console.error('GET /api/interview-room error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: roomErrorStatus(message) });
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

  const { sessionId, action, role: roleParam, offer, answer, candidate, text, senderName } = body;

  if (!sessionId || !action) {
    return NextResponse.json(
      { error: 'sessionId and action are required' },
      { status: 400 }
    );
  }

  if (roleParam && !isValidRoomRole(roleParam)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  try {
    const requestedRole: RoomRole | null = roleParam && isValidRoomRole(roleParam) ? roleParam : null;
    const { effectiveRole } = await authorizeRoomAccess(sessionId, requestedRole);

    switch (action) {
      // ── Student sends offer ────────────────────────────────────────────────
      case 'offer': {
        await Promise.all([
          prisma.signalingRoom.upsert({
            where: { id: sessionId },
            create: {
              id: sessionId,
              offer,
              answer: undefined,
              studentCandidates: [],
              interviewerCandidates: [],
              messages: [],
              offerTimestamp: BigInt(Date.now()),
            },
            update: {
              offer,
              answer: undefined,        // clear stale answer
              studentCandidates: [],    // clear stale candidates
              interviewerCandidates: [],
              offerTimestamp: BigInt(Date.now()),
              updatedAt: new Date(),
            },
          }),
          recordSignalingEvent(sessionId, 'offer', effectiveRole, { offer }),
        ]);
        return NextResponse.json({ success: true });
      }

      // ── Interviewer sends answer ───────────────────────────────────────────
      case 'answer': {
        await Promise.all([
          prisma.signalingRoom.upsert({
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
          }),
          recordSignalingEvent(sessionId, 'answer', effectiveRole, { answer }),
        ]);
        return NextResponse.json({ success: true });
      }

      // ── ICE candidate ─────────────────────────────────────────────────────
      case 'ice-candidate': {
        if (!candidate) {
          return NextResponse.json({ error: 'candidate required' }, { status: 400 });
        }

        const room = await getOrCreateRoom(sessionId);
        const key = JSON.stringify(candidate);

        if (effectiveRole === 'student') {
          const existing = room.studentCandidates as RTCIceCandidateInit[];
          if (!existing.some((c) => JSON.stringify(c) === key)) {
            await Promise.all([
              prisma.signalingRoom.update({
                where: { id: sessionId },
                data: {
                  studentCandidates: [...existing, candidate],
                  updatedAt: new Date(),
                },
              }),
              recordSignalingEvent(sessionId, 'ice-candidate', effectiveRole, { candidate }),
            ]);
          }
        } else {
          const existing = room.interviewerCandidates as RTCIceCandidateInit[];
          if (!existing.some((c) => JSON.stringify(c) === key)) {
            await Promise.all([
              prisma.signalingRoom.update({
                where: { id: sessionId },
                data: {
                  interviewerCandidates: [...existing, candidate],
                  updatedAt: new Date(),
                },
              }),
              recordSignalingEvent(sessionId, 'ice-candidate', effectiveRole, { candidate }),
            ]);
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
          sender: effectiveRole,
          senderName: senderName ?? (effectiveRole === 'student' ? 'Student' : 'Interviewer'),
          text: text.trim(),
          timestamp: new Date().toISOString(),
        };

        const room = await getOrCreateRoom(sessionId);
        const messages = parseChatMessages(room.messages);
        const updated = [...messages, message].slice(-200); // keep last 200

        await Promise.all([
          prisma.signalingRoom.update({
            where: { id: sessionId },
            data: {
              messages: updated as unknown as Prisma.InputJsonValue,
              updatedAt: new Date(),
            },
          }),
          recordSignalingEvent(sessionId, 'message', effectiveRole, { message }),
        ]);

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
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: roomErrorStatus(message) });
  }
}
