'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';
import { formatDateTime } from '@/lib/utils';

export default function InterviewerSessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/interviewer/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const upcomingSessions = sessions.filter(
    (s) => s.status === 'SCHEDULED' && new Date(s.scheduledTime) > new Date()
  );
  const completedSessions = sessions.filter((s) => s.status === 'COMPLETED');
  const pendingFeedback = upcomingSessions.filter(
    (s) => new Date(s.scheduledTime) < new Date() && !s.feedback
  );

  // Room is open 30 mins before and up to 2 hours after scheduled time
  const isRoomOpen = (scheduledTime: string) => {
    const sessionTime = new Date(scheduledTime).getTime();
    const now = Date.now();
    const diffMs = sessionTime - now;
    return diffMs <= 30 * 60 * 1000 && diffMs >= -2 * 60 * 60 * 1000;
  };

  if (loading) {
    return <div className="text-center py-12">Loading sessions...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-display font-bold text-slate-900 mb-8">
        My Sessions
      </h1>

      {pendingFeedback.length > 0 && (
        <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-amber-900 font-medium">
            ⚠️ You have {pendingFeedback.length} session(s) pending feedback submission
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <Card variant="bordered" className="p-6">
          <div className="text-3xl font-bold text-violet-600 mb-2">{upcomingSessions.length}</div>
          <p className="text-slate-600">Upcoming Sessions</p>
        </Card>
        <Card variant="bordered" className="p-6">
          <div className="text-3xl font-bold text-green-600 mb-2">{completedSessions.length}</div>
          <p className="text-slate-600">Completed Sessions</p>
        </Card>
        <Card variant="bordered" className="p-6">
          <div className="text-3xl font-bold text-indigo-600 mb-2">{sessions.length}</div>
          <p className="text-slate-600">Total Sessions</p>
        </Card>
      </div>

      {/* Upcoming Sessions */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold text-slate-900 mb-4">
          Upcoming Sessions ({upcomingSessions.length})
        </h2>
        {upcomingSessions.length === 0 ? (
          <Card variant="bordered" className="p-8 text-center text-slate-600">
            No upcoming sessions.
          </Card>
        ) : (
          <div className="space-y-4">
            {upcomingSessions.map((session) => {
              const roomOpen = isRoomOpen(session.scheduledTime);
              const canJoinRoom = session.sessionType === 'INTERVIEW';
              const isPastScheduled = new Date(session.scheduledTime) < new Date();

              return (
                <Card key={session.id} variant="bordered" className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          session.sessionType === 'GUIDANCE'
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-violet-100 text-violet-700'
                        }`}>
                          {session.sessionType === 'GUIDANCE' ? '🎓 Guidance' : '💼 Interview'}
                        </span>
                        <span className="text-sm text-slate-500">
                          {session.durationMinutes} minutes
                        </span>
                        {canJoinRoom && roomOpen && (
                          <span className="flex items-center gap-1.5 px-2.5 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                            Room Open
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1">
                        {session.sessionType === 'GUIDANCE' ? session.topic : session.role}
                      </h3>
                      <p className="text-slate-600 mb-2">
                        Student: <span className="font-medium">{session.student.name}</span>
                      </p>
                      <p className="text-sm text-slate-500">
                        📅 {formatDateTime(session.scheduledTime)}
                      </p>
                    </div>

                    <div className="ml-4 flex flex-col items-end gap-2">
                      {/* Join Room Button — only for INTERVIEW sessions */}
                      {canJoinRoom && (
                        <>
                          <button
                            onClick={() => router.push(`/interviewer/interview-room/${session.id}`)}
                            disabled={!roomOpen}
                            title={!roomOpen ? 'Room opens 30 minutes before session' : 'Start live interview room'}
                            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                              roomOpen
                                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-200 hover:scale-105 active:scale-95'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            {roomOpen ? (
                              <>
                                Start Room
                                <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
                              </>
                            ) : (
                              'Room Not Open'
                            )}
                          </button>
                          {!roomOpen && (
                            <p className="text-xs text-slate-400">Opens 30 mins before</p>
                          )}
                        </>
                      )}

                      {/* Submit Feedback button for past-scheduled sessions */}
                      {isPastScheduled && !session.feedback && (
                        <Link href={`/interviewer/feedback/${session.id}`}>
                          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm">
                            Submit Feedback
                          </button>
                        </Link>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed Sessions */}
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-4">
          Completed Sessions ({completedSessions.length})
        </h2>
        {completedSessions.length === 0 ? (
          <Card variant="bordered" className="p-8 text-center text-slate-600">
            No completed sessions yet.
          </Card>
        ) : (
          <div className="space-y-4">
            {completedSessions.map((session) => (
              <Card key={session.id} variant="bordered" className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        session.sessionType === 'GUIDANCE'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-violet-100 text-violet-700'
                      }`}>
                        {session.sessionType === 'GUIDANCE' ? '🎓 Guidance' : '💼 Interview'}
                      </span>
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                        ✓ Completed
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">
                      {session.sessionType === 'GUIDANCE' ? session.topic : session.role}
                    </h3>
                    <p className="text-slate-600 mb-2">
                      Student: <span className="font-medium">{session.student.name}</span>
                    </p>
                    <p className="text-sm text-slate-500">
                      📅 {formatDateTime(session.scheduledTime)}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}