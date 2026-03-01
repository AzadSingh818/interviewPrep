'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

function formatDateTime(dt: string) {
  return new Date(dt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AdminDashboardPage() {
  const [analytics, setAnalytics]   = useState<any>(null);
  const [recent, setRecent]         = useState<any[]>([]);
  const [topIvs, setTopIvs]         = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => { fetchAnalytics(); }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/admin/analytics');
      if (res.ok) {
        const d = await res.json();
        setAnalytics(d.analytics);
        setRecent(d.recentSessions || []);
        setTopIvs(d.topInterviewers || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500 text-sm">Loading analytics…</p>
      </div>
    </div>
  );

  const stats = analytics ? [
    { label: 'Total Students',       value: analytics.totalStudents,       icon: '🎓', color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Total Interviewers',   value: analytics.totalInterviewers,   icon: '👔', color: 'bg-violet-50 text-violet-600' },
    { label: 'Pending Approval',     value: analytics.pendingInterviewers, icon: '⏳', color: 'bg-amber-50 text-amber-600', alert: analytics.pendingInterviewers > 0 },
    { label: 'Approved Interviewers',value: analytics.approvedInterviewers,icon: '✅', color: 'bg-green-50 text-green-600' },
    { label: 'Total Sessions',       value: analytics.totalSessions,       icon: '📅', color: 'bg-blue-50 text-blue-600' },
    { label: 'Completed Sessions',   value: analytics.completedSessions,   icon: '🏁', color: 'bg-green-50 text-green-600' },
    { label: 'Guidance Sessions',    value: analytics.guidanceSessions,    icon: '📚', color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Mock Interviews',      value: analytics.interviewSessions,   icon: '💼', color: 'bg-violet-50 text-violet-600' },
  ] : [];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Platform overview and management</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Link href="/admin/interviewers">
            <button className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all">
              👥 Manage Interviewers
              {analytics?.pendingInterviewers > 0 && (
                <span className="bg-amber-400 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{analytics.pendingInterviewers}</span>
              )}
            </button>
          </Link>
          <Link href="/admin/analytics">
            <button className="flex items-center gap-2 px-3 sm:px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition-all">
              📈 Full Analytics
            </button>
          </Link>
        </div>
      </div>

      {/* Alert banner for pending interviewers */}
      {analytics?.pendingInterviewers > 0 && (
        <div className="mb-5 sm:mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <p className="text-sm font-medium text-amber-800">
              <span className="font-bold">{analytics.pendingInterviewers}</span> interviewer{analytics.pendingInterviewers > 1 ? 's' : ''} waiting for approval.
            </p>
          </div>
          <Link href="/admin/interviewers">
            <button className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-all whitespace-nowrap">
              Review Now →
            </button>
          </Link>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5 sm:mb-8">
        {stats.map(s => (
          <Card key={s.label} variant="bordered" className={`p-3 sm:p-5 ${s.alert ? 'border-amber-300 bg-amber-50' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-slate-500 mb-1 leading-tight">{s.label}</p>
                <p className={`text-xl sm:text-2xl font-bold ${s.alert ? 'text-amber-600' : 'text-slate-900'}`}>{s.value ?? '—'}</p>
              </div>
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-base sm:text-xl shrink-0 ${s.color}`}>{s.icon}</div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
        {/* Top Interviewers */}
        <Card variant="elevated" className="p-4 sm:p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base sm:text-xl font-semibold text-slate-900">🏆 Top Interviewers</h2>
            <Link href="/admin/interviewers"><span className="text-sm text-indigo-600 hover:underline">View all →</span></Link>
          </div>
          <div className="space-y-2 sm:space-y-3">
            {topIvs.length === 0 ? (
              <p className="text-slate-500 text-sm py-4 text-center">No interviewers yet.</p>
            ) : topIvs.slice(0, 5).map((iv, i) => (
              <div key={iv.id} className="flex items-center justify-between py-2 sm:py-3 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <span className="text-lg sm:text-2xl font-bold text-slate-300 shrink-0">#{i + 1}</span>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 text-sm sm:text-base truncate">{iv.name}</p>
                    <p className="text-xs text-slate-500 truncate">{(iv.rolesSupported ?? []).slice(0, 2).join(', ')}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-base sm:text-lg font-semibold text-indigo-600">{iv.sessionCount}</p>
                  <p className="text-xs text-slate-500">sessions</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Sessions */}
        <Card variant="elevated" className="p-4 sm:p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base sm:text-xl font-semibold text-slate-900">🕐 Recent Sessions</h2>
          </div>
          <div className="space-y-2 sm:space-y-3">
            {recent.length === 0 ? (
              <p className="text-slate-500 text-sm py-4 text-center">No sessions yet.</p>
            ) : recent.slice(0, 6).map(s => (
              <div key={s.id} className="flex items-center justify-between py-2 sm:py-3 border-b border-slate-100 last:border-0 gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 text-xs sm:text-sm truncate">
                    {s.student?.name} → {s.interviewer?.name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{formatDateTime(s.scheduledTime)}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${s.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : s.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick nav cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Link href="/admin/interviewers">
          <Card variant="bordered" className="p-4 sm:p-6 hover:shadow-lg transition-all cursor-pointer hover:border-indigo-300 group">
            <div className="text-3xl sm:text-5xl mb-3">👥</div>
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">Manage Interviewers</h3>
            <p className="text-slate-500 text-xs sm:text-sm">Approve or reject interviewer applications</p>
          </Card>
        </Link>
        <Link href="/admin/analytics">
          <Card variant="bordered" className="p-4 sm:p-6 hover:shadow-lg transition-all cursor-pointer hover:border-violet-300 group">
            <div className="text-3xl sm:text-5xl mb-3">📈</div>
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-1 group-hover:text-violet-600 transition-colors">View Analytics</h3>
            <p className="text-slate-500 text-xs sm:text-sm">Platform statistics and detailed insights</p>
          </Card>
        </Link>
        <Card variant="bordered" className="p-4 sm:p-6">
          <div className="text-3xl sm:text-5xl mb-3">⚙️</div>
          <h3 className="text-base sm:text-lg font-semibold text-slate-900 mb-1">Configuration</h3>
          <p className="text-slate-500 text-xs sm:text-sm">System settings, roles, and difficulty levels</p>
        </Card>
      </div>
    </div>
  );
}