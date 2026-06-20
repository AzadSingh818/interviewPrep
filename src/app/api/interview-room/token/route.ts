/**
 * /api/interview-room/token
 *
 * Issues a signed LiveKit access token for a verified session participant.
 * The token grants the user permission to publish/subscribe in a LiveKit room
 * whose name matches the sessionId.
 *
 * Query params:
 *   ?sessionId=<number>
 *
 * The response includes:
 *   { token: string, roomName: string, wsUrl: string }
 *
 * Environment variables required (set in Vercel dashboard):
 *   LIVEKIT_URL        - wss://your-project.livekit.cloud
 *   LIVEKIT_API_KEY    - API key from LiveKit Cloud
 *   LIVEKIT_API_SECRET - API secret from LiveKit Cloud
 *
 * Security:
 *   - User must be authenticated (requireAuth) and a participant in the session.
 *   - Token is scoped to the exact room name (session-<sessionId>).
 *   - Token expires in 4 hours (max interview + buffer).
 *   - canPublishData=true for chat over DataChannel.
 */

import { NextRequest, NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { prisma } from '@/lib/prisma';
import { requireAuth, authErrorStatus } from '@/lib/auth';
import { captureError } from '@/lib/monitoring';

const TOKEN_TTL_SECONDS = 4 * 60 * 60; // 4 hours

function getLiveKitEnv() {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!url || !apiKey || !apiSecret) {
    throw new Error('LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.');
  }

  return { url, apiKey, apiSecret };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionIdRaw = searchParams.get('sessionId');

  if (!sessionIdRaw) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const sessionId = Number(sessionIdRaw);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
  }

  try {
    const auth = await requireAuth(['STUDENT', 'INTERVIEWER']);

    // Verify the user is actually a participant in this session
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        student: { select: { userId: true } },
        interviewer: { select: { userId: true } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const effectiveRole = auth.role === 'STUDENT' ? 'student' : 'interviewer';
    const isOwner =
      effectiveRole === 'student'
        ? session.student.userId === auth.userId
        : session.interviewer.userId === auth.userId;

    if (!isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { url: wsUrl, apiKey, apiSecret } = getLiveKitEnv();

    const roomName = `session-${sessionId}`;
    const participantIdentity = `${effectiveRole}-${auth.userId}`;
    const participantName = effectiveRole === 'student' ? 'Student' : 'Interviewer';

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: participantName,
      ttl: TOKEN_TTL_SECONDS,
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true, // for DataChannel chat
    });

    const token = await at.toJwt();

    return NextResponse.json({
      token,
      roomName,
      wsUrl,
      participantIdentity,
      participantName,
    });
  } catch (error: any) {
    captureError(error, { route: '/api/interview-room/token', sessionId });

    if (error.message?.includes('LiveKit is not configured')) {
      // Graceful degradation: signal the client to fall back to Postgres signaling
      return NextResponse.json(
        { error: 'livekit_not_configured', fallback: true },
        { status: 503 },
      );
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: authErrorStatus(message) },
    );
  }
}
