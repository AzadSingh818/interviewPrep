'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { formatDateTime } from '@/lib/utils';

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/admin/analytics');
      if (res.ok) {
        const analyticsData = await res.json();
        setData(analyticsData);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading analytics...</div>;
  }

  if (!data) {
    return <div className="text-center py-12">Failed to load analytics</div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-display font-bold text-slate-900 mb-8">
        Platform Analytics
      </h1>

      <div className="grid grid-cols-4 gap-6 mb-8">
        <Card variant="bordered" className="p-6">
          <div className="text-3xl font-bold text-indigo-600 mb-2">
            {data.analytics.totalStudents}
          </div>
          <p className="text-slate-600">Total Students</p>
        </Card>

        <Card variant="bordered" className="p-6">
          <div className="text-3xl font-bold text-violet-600 mb-2">
            {data.analytics.totalInterviewers}
          </div>
          <p className="text-slate-600">Total Interviewers</p>
        </Card>

        <Card variant="bordered" className="p-6">
          <div className="text-3xl font-bold text-green-600 mb-2">
            {data.analytics.completedSessions}
          </div>
          <p className="text-slate-600">Completed Sessions</p>
        </Card>

        <Card variant="bordered" className="p-6">
          <div className="text-3xl font-bold text-amber-600 mb-2">
            {data.analytics.scheduledSessions}
          </div>
          <p className="text-slate-600">Scheduled Sessions</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <Card variant="bordered" className="p-6">
          <div className="text-2xl font-bold text-pink-600 mb-2">
            {data.analytics.guidanceSessions}
          </div>
          <p className="text-slate-600">Guidance Sessions</p>
        </Card>

        <Card variant="bordered" className="p-6">
          <div className="text-2xl font-bold text-blue-600 mb-2">
            {data.analytics.interviewSessions}
          </div>
          <p className="text-slate-600">Mock Interviews</p>
        </Card>
      </div>

      <Card variant="elevated" className="p-6 mb-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">
          Top Interviewers
        </h2>
        <div className="space-y-3">
          {data.topInterviewers.slice(0, 5).map((interviewer: any, index: number) => (
            <div key={interviewer.id} className="flex items-center justify-between py-3 border-b border-slate-200 last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-slate-400">
                  #{index + 1}
                </span>
                <div>
                  <p className="font-medium text-slate-900">{interviewer.name}</p>
                  <p className="text-sm text-slate-600">
                    {(interviewer.rolesSupported ?? []).slice(0, 2).join(', ')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-indigo-600">
                  {interviewer.sessionCount}
                </p>
                <p className="text-sm text-slate-500">sessions</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card variant="elevated" className="p-6">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">
          Recent Sessions
        </h2>
        <div className="space-y-3">
          {data.recentSessions.map((session: any) => (
            <div key={session.id} className="flex items-center justify-between py-3 border-b border-slate-200 last:border-0">
              <div>
                <p className="font-medium text-slate-900">
                  {session.student.name} → {session.interviewer.name}
                </p>
                <p className="text-sm text-slate-600">
                  {session.sessionType === 'GUIDANCE' ? session.topic : session.role}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">
                  {formatDateTime(session.scheduledTime)}
                </p>
                <span className={`text-xs px-2 py-1 rounded ${
                  session.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {session.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}