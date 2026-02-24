'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import Link from 'next/link';
import { formatDateTime } from '@/lib/utils';

export default function StudentSessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/student/sessions');
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
  const pastSessions = sessions.filter(
    (s) => s.status === 'COMPLETED' || new Date(s.scheduledTime) < new Date()
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

      {/* Upcoming Sessions */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold text-slate-900 mb-4">
          Upcoming Sessions ({upcomingSessions.length})
        </h2>
        {upcomingSessions.length === 0 ? (
          <Card variant="bordered" className="p-8 text-center text-slate-600">
            No upcoming sessions. Book a session to get started!
          </Card>
        ) : (
          <div className="space-y-4">
            {upcomingSessions.map((session) => {
              const roomOpen = isRoomOpen(session.scheduledTime);
              // Only show Join Room for INTERVIEW sessions, not GUIDANCE
              const canJoinRoom = session.sessionType === 'INTERVIEW';

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
                        with <span className="font-medium">{session.interviewer.name}</span>
                      </p>
                      <p className="text-sm text-slate-500">
                        📅 {formatDateTime(session.scheduledTime)}
                      </p>
                    </div>

                    {/* Join Room Button — only for INTERVIEW sessions */}
                    {canJoinRoom && (
                      <div className="ml-4 flex flex-col items-end gap-2">
                        <button
                          onClick={() => router.push(`/student/interview-room/${session.id}`)}
                          disabled={!roomOpen}
                          title={!roomOpen ? 'Room opens 30 minutes before session' : 'Join live interview room'}
                          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                            roomOpen
                              ? 'bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-200 hover:scale-105 active:scale-95'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          {roomOpen ? (
                            <>
                              Join Room
                              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                            </>
                          ) : (
                            'Room Not Open'
                          )}
                        </button>
                        {!roomOpen && (
                          <p className="text-xs text-slate-400">Opens 30 mins before</p>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Past Sessions */}
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-4">
          Past Sessions ({pastSessions.length})
        </h2>
        {pastSessions.length === 0 ? (
          <Card variant="bordered" className="p-8 text-center text-slate-600">
            No past sessions yet.
          </Card>
        ) : (
          <div className="space-y-4">
            {pastSessions.map((session) => (
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
                      {session.status === 'COMPLETED' && (
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                          ✓ Completed
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">
                      {session.sessionType === 'GUIDANCE' ? session.topic : session.role}
                    </h3>
                    <p className="text-slate-600 mb-2">
                      with <span className="font-medium">{session.interviewer.name}</span>
                    </p>
                    <p className="text-sm text-slate-500">
                      📅 {formatDateTime(session.scheduledTime)}
                    </p>
                  </div>
                  {session.feedback && (
                    <Link href={`/student/feedback/${session.id}`}>
                      <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                        View Feedback
                      </button>
                    </Link>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}