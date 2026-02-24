import { NextRequest, NextResponse } from 'next/server';

interface ChatMessage {
  id: string;
  sender: string;
  senderName: string;
  text: string;
  timestamp: string;
}

interface RoomData {
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  studentCandidates: RTCIceCandidateInit[];
  interviewerCandidates: RTCIceCandidateInit[];
  messages: ChatMessage[];
  createdAt: number;
}

const rooms = new Map<string, RoomData>();

function getOrCreateRoom(sessionId: string): RoomData {
  if (!rooms.has(sessionId)) {
    rooms.set(sessionId, {
      studentCandidates: [],
      interviewerCandidates: [],
      messages: [],
      createdAt: Date.now(),
    });
    setTimeout(() => rooms.delete(sessionId), 4 * 60 * 60 * 1000);
  }
  return rooms.get(sessionId)!;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const role = searchParams.get('role');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const room = getOrCreateRoom(sessionId);

  if (role === 'student') {
    return NextResponse.json({
      sessionId,
      offer: room.offer,
      answer: room.answer,
      iceCandidates: room.interviewerCandidates,
      messages: room.messages,
    });
  }

  return NextResponse.json({
    sessionId,
    offer: room.offer,
    answer: room.answer,
    studentCandidates: room.studentCandidates,
    messages: room.messages,
  });
}

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

  const room = getOrCreateRoom(sessionId);

  switch (action) {
    case 'offer':
      room.offer = offer;
      // Reset answer and candidates when new offer comes in (reconnect scenario)
      room.answer = undefined;
      room.studentCandidates = [];
      room.interviewerCandidates = [];
      return NextResponse.json({ success: true });

    case 'answer':
      room.answer = answer;
      return NextResponse.json({ success: true });

    case 'ice-candidate':
      if (role === 'student') {
        room.studentCandidates.push(candidate);
      } else {
        room.interviewerCandidates.push(candidate);
      }
      return NextResponse.json({ success: true });

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
      room.messages.push(message);
      // Keep last 200 messages
      if (room.messages.length > 200) {
        room.messages = room.messages.slice(-200);
      }
      return NextResponse.json({ success: true, message });
    }

    case 'reset':
      rooms.delete(sessionId);
      return NextResponse.json({ success: true });

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}