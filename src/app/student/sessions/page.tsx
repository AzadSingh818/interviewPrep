"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import Link from "next/link";
import { formatDateTime } from "@/lib/utils";

export default function StudentSessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/student/sessions");
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

  const upcomingSessions = sessions.filter(
    (s) => s.status === "SCHEDULED" && new Date(s.scheduledTime) > new Date(),
  );
  const pastSessions = sessions.filter(
    (s) => s.status === "COMPLETED" || new Date(s.scheduledTime) < new Date(),
  );

  // Room is open 30 mins before and up to 2 hours after scheduled time
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
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading sessions…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 mb-6 sm:mb-8">
        My Sessions
      </h1>

      {/* ── Upcoming Sessions ── */}
      <div className="mb-8 sm:mb-12">
        <h2 className="text-lg sm:text-2xl font-semibold text-slate-900 mb-3 sm:mb-4">
          Upcoming Sessions{' '}
          <span className="text-slate-400 font-normal text-base">({upcomingSessions.length})</span>
        </h2>

        {upcomingSessions.length === 0 ? (
          <Card variant="bordered" className="p-6 sm:p-8 text-center text-slate-600 text-sm sm:text-base">
            No upcoming sessions. Book a session to get started!
          </Card>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {upcomingSessions.map((session) => {
              const roomOpen = isRoomOpen(session.scheduledTime);
              const canJoinRoom = session.sessionType === "INTERVIEW";

              return (
                <Card key={session.id} variant="bordered" className="p-4 sm:p-6">
                  {/* Top row: badges + join button */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Badges row */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs sm:text-sm font-medium ${
                            session.sessionType === "GUIDANCE"
                              ? "bg-indigo-100 text-indigo-700"
                              : "bg-violet-100 text-violet-700"
                          }`}
                        >
                          {session.sessionType === "GUIDANCE" ? "🎓 Guidance" : "💼 Interview"}
                        </span>
                        <span className="text-xs sm:text-sm text-slate-500">
                          {session.durationMinutes} min
                        </span>
                        {canJoinRoom && roomOpen && (
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                            Room Open
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-1 leading-snug">
                        {session.sessionType === "GUIDANCE" ? session.topic : session.role}
                      </h3>
                      <p className="text-sm text-slate-600 mb-1">
                        with{" "}
                        <span className="font-medium">{session.interviewer.name}</span>
                      </p>
                      <p className="text-xs sm:text-sm text-slate-500">
                        📅 {formatDateTime(session.scheduledTime)}
                      </p>
                    </div>

                    {/* Join Room Button */}
                    {canJoinRoom && (
                      <div className="flex flex-col items-stretch sm:items-end gap-1 shrink-0">
                        <button
                          onClick={() =>
                            window.open(
                              `/student/interview-room/${session.id}`,
                              "_blank",
                              "width=1280,height=720,toolbar=no,menubar=no,scrollbars=no,location=no,status=no",
                            )
                          }
                          disabled={!roomOpen}
                          title={
                            !roomOpen
                              ? "Room opens 30 minutes before session"
                              : "Join live interview room"
                          }
                          className={`inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                            roomOpen
                              ? "bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-200 hover:scale-105 active:scale-95"
                              : "bg-slate-100 text-slate-400 cursor-not-allowed"
                          }`}
                        >
                          <svg
                            className="w-4 h-4 shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
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
                              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                            </>
                          ) : (
                            "Room Not Open"
                          )}
                        </button>
                        {!roomOpen && (
                          <p className="text-xs text-slate-400 text-center sm:text-right">
                            Opens 30 mins before
                          </p>
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

      {/* ── Past Sessions ── */}
      <div>
        <h2 className="text-lg sm:text-2xl font-semibold text-slate-900 mb-3 sm:mb-4">
          Past Sessions{' '}
          <span className="text-slate-400 font-normal text-base">({pastSessions.length})</span>
        </h2>

        {pastSessions.length === 0 ? (
          <Card variant="bordered" className="p-6 sm:p-8 text-center text-slate-600 text-sm sm:text-base">
            No past sessions yet.
          </Card>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {pastSessions.map((session) => (
              <Card key={session.id} variant="bordered" className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Badges */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs sm:text-sm font-medium ${
                          session.sessionType === "GUIDANCE"
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-violet-100 text-violet-700"
                        }`}
                      >
                        {session.sessionType === "GUIDANCE" ? "🎓 Guidance" : "💼 Interview"}
                      </span>
                      {session.status === "COMPLETED" && (
                        <span className="px-2.5 py-1 rounded-full text-xs sm:text-sm font-medium bg-green-100 text-green-700">
                          ✓ Completed
                        </span>
                      )}
                    </div>

                    <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-1 leading-snug">
                      {session.sessionType === "GUIDANCE" ? session.topic : session.role}
                    </h3>
                    <p className="text-sm text-slate-600 mb-1">
                      with{" "}
                      <span className="font-medium">{session.interviewer.name}</span>
                    </p>
                    <p className="text-xs sm:text-sm text-slate-500">
                      📅 {formatDateTime(session.scheduledTime)}
                    </p>
                  </div>

                  {session.feedback && (
                    <div className="shrink-0">
                      <Link href={`/student/feedback/${session.id}`}>
                        <button className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
                          View Feedback
                        </button>
                      </Link>
                    </div>
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