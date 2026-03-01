"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import Link from "next/link";
import { formatDateTime } from "@/lib/utils";

export default function InterviewerSessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => { fetchSessions(); }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/interviewer/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const upcomingSessions  = sessions.filter(s => s.status === "SCHEDULED" && new Date(s.scheduledTime) > new Date());
  const completedSessions = sessions.filter(s => s.status === "COMPLETED");
  const pastScheduled     = sessions.filter(s => s.status === "SCHEDULED" && new Date(s.scheduledTime) <= new Date());

  const isRoomOpen = (scheduledTime: string) => {
    const sessionTime = new Date(scheduledTime).getTime();
    const now = Date.now();
    const diffMs = sessionTime - now;
    return diffMs <= 30 * 60 * 1000 && diffMs >= -2 * 60 * 60 * 1000;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Loading sessions…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white mb-6 sm:mb-8">
        My Sessions
      </h1>

      {/* Pending feedback alert */}
      {pastScheduled.filter(s => !s.feedback).length > 0 && (
        <div className="mb-6 p-3 sm:p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-amber-900 font-medium text-sm sm:text-base">
            ⚠️ You have {pastScheduled.filter(s => !s.feedback).length} session(s) pending feedback submission
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 sm:mb-8">
        {[
          { label: 'Total',     value: sessions.length,          color: 'bg-slate-50 dark:bg-gray-800' },
          { label: 'Upcoming',  value: upcomingSessions.length,  color: 'bg-indigo-50 dark:bg-indigo-900/20' },
          { label: 'Completed', value: completedSessions.length, color: 'bg-green-50 dark:bg-green-900/20' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.color} rounded-xl p-3 sm:p-4 text-center`}>
            <p className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Upcoming Sessions */}
      <div className="mb-8">
        <h2 className="text-lg sm:text-2xl font-semibold text-slate-900 dark:text-white mb-3 sm:mb-4">
          Upcoming Sessions ({upcomingSessions.length})
        </h2>
        {upcomingSessions.length === 0 ? (
          <Card variant="bordered" className="p-6 sm:p-8 text-center text-slate-600 dark:text-slate-400">
            No upcoming sessions scheduled.
          </Card>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {upcomingSessions.map(session => {
              const roomOpen = isRoomOpen(session.scheduledTime);
              return (
                <Card key={session.id} variant="elevated" className="p-4 sm:p-6">
                  {/* Header row */}
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-base sm:text-lg">
                          {session.sessionType === 'INTERVIEW' ? '💼' : '🎓'}
                        </span>
                        <h3 className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base">
                          {session.sessionType === 'INTERVIEW' ? 'Mock Interview' : 'Guidance Session'}
                        </h3>
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                          Scheduled
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                        📅 {formatDateTime(session.scheduledTime)} · {session.durationMinutes}min
                      </p>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                    {session.studentProfile?.name && (
                      <span>👤 {session.studentProfile.name}</span>
                    )}
                    {session.role && <span>🎯 {session.role}</span>}
                    {session.topic && <span>📌 {session.topic}</span>}
                    {session.difficulty && <span>⚡ {session.difficulty}</span>}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => roomOpen && router.push(`/interviewer/interview-room/${session.id}`)}
                      disabled={!roomOpen}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                        roomOpen
                          ? "bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-200"
                          : "bg-slate-100 dark:bg-gray-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      {roomOpen ? 'Start Room' : 'Room Not Open'}
                    </button>
                    {!roomOpen && (
                      <p className="text-xs text-slate-400 dark:text-slate-500">Opens 30 min before</p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Past Scheduled (needs feedback) */}
      {pastScheduled.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg sm:text-2xl font-semibold text-slate-900 dark:text-white mb-3 sm:mb-4">
            Awaiting Feedback ({pastScheduled.length})
          </h2>
          <div className="space-y-3 sm:space-y-4">
            {pastScheduled.map(session => (
              <Card key={session.id} variant="elevated" className="p-4 sm:p-6 border-l-4 border-amber-400">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span>{session.sessionType === 'INTERVIEW' ? '💼' : '🎓'}</span>
                      <h3 className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base">
                        {session.sessionType === 'INTERVIEW' ? 'Mock Interview' : 'Guidance Session'}
                      </h3>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                      📅 {formatDateTime(session.scheduledTime)}
                    </p>
                    {session.studentProfile?.name && (
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                        👤 {session.studentProfile.name}
                      </p>
                    )}
                  </div>
                  {!session.feedback && (
                    <Link href={`/interviewer/feedback/${session.id}`}>
                      <button className="shrink-0 px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs sm:text-sm font-medium">
                        Submit Feedback
                      </button>
                    </Link>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Completed Sessions */}
      <div>
        <h2 className="text-lg sm:text-2xl font-semibold text-slate-900 dark:text-white mb-3 sm:mb-4">
          Completed Sessions ({completedSessions.length})
        </h2>
        {completedSessions.length === 0 ? (
          <Card variant="bordered" className="p-6 sm:p-8 text-center text-slate-600 dark:text-slate-400">
            No completed sessions yet.
          </Card>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {completedSessions.map(session => (
              <Card key={session.id} variant="elevated" className="p-4 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span>{session.sessionType === 'INTERVIEW' ? '💼' : '🎓'}</span>
                      <h3 className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base">
                        {session.sessionType === 'INTERVIEW' ? 'Mock Interview' : 'Guidance Session'}
                      </h3>
                      <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                        Completed
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                      📅 {formatDateTime(session.scheduledTime)} · {session.durationMinutes}min
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                      {session.studentProfile?.name && <span>👤 {session.studentProfile.name}</span>}
                      {session.role && <span>🎯 {session.role}</span>}
                      {session.topic && <span>📌 {session.topic}</span>}
                    </div>
                  </div>
                  {session.feedback && (
                    <Link href={`/interviewer/feedback/${session.id}`}>
                      <button className="shrink-0 px-3 sm:px-4 py-2 bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-600 transition-colors text-xs sm:text-sm font-medium">
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