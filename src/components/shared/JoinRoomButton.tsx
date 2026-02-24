'use client';

import { useRouter } from 'next/navigation';

interface JoinRoomButtonProps {
  sessionId: number; // Int in your schema
  role: 'student' | 'interviewer';
  sessionStatus?: string; // 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'
  scheduledTime?: string; // ISO date string — matches your schema field name
  className?: string;
}

/**
 * JoinRoomButton — drop into session cards in:
 *   src/app/student/sessions/page.tsx
 *   src/app/interviewer/sessions/page.tsx
 *
 * Usage:
 *   <JoinRoomButton
 *     sessionId={session.id}
 *     role="student"
 *     sessionStatus={session.status}
 *     scheduledTime={session.scheduledTime}
 *   />
 */
export default function JoinRoomButton({
  sessionId,
  role,
  sessionStatus,
  scheduledTime,
  className,
}: JoinRoomButtonProps) {
  const router = useRouter();

  // Don't show for completed/cancelled sessions
  if (sessionStatus === 'COMPLETED' || sessionStatus === 'CANCELLED') return null;

  const isRoomOpen = () => {
    if (!scheduledTime) return true; // no schedule = always show
    const sessionTime = new Date(scheduledTime).getTime();
    const now = Date.now();
    const diffMs = sessionTime - now;
    // Open window: 30 mins before → 2 hours after
    return diffMs <= 30 * 60 * 1000 && diffMs >= -2 * 60 * 60 * 1000;
  };

  const roomOpen = isRoomOpen();

  const handleJoin = () => {
    const path =
      role === 'student'
        ? `/student/interview-room/${sessionId}`
        : `/interviewer/interview-room/${sessionId}`;
    router.push(path);
  };

  return (
    <button
      onClick={handleJoin}
      disabled={!roomOpen}
      title={!roomOpen ? 'Room opens 30 minutes before session' : 'Join live interview room'}
      className={`
        inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all
        ${
          roomOpen
            ? 'bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-200 hover:scale-105 active:scale-95'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
        }
        ${className ?? ''}
      `}
    >
      {/* Camera icon */}
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>

      {roomOpen ? (
        <>
          Join Room
          {/* Live dot */}
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        </>
      ) : (
        'Room not open yet'
      )}
    </button>
  );
}