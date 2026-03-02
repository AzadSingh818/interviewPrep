'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

// ─── Star display ─────────────────────────────────────────────────────────────
function StarDisplay({ rating, totalRatings }: { rating: number | null; totalRatings: number }) {
  if (!rating || totalRatings === 0) {
    return <span className="text-xs text-slate-400">No ratings yet</span>;
  }
  const fullStars = Math.floor(rating);
  const halfStar  = rating - fullStars >= 0.5;

  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`text-sm ${
              star <= fullStars
                ? 'text-amber-400'
                : star === fullStars + 1 && halfStar
                ? 'text-amber-300'
                : 'text-slate-300'
            }`}
          >
            ★
          </span>
        ))}
      </div>
      <span className="text-xs font-semibold text-amber-600">{rating.toFixed(1)}</span>
      <span className="text-xs text-slate-400">({totalRatings} {totalRatings === 1 ? 'rating' : 'ratings'})</span>
    </div>
  );
}

export default function AdminInterviewersPage() {
  const [interviewers, setInterviewers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => { fetchInterviewers(); }, []);

  const fetchInterviewers = async () => {
    try {
      const res = await fetch('/api/admin/interviewers');
      if (res.ok) {
        const data = await res.json();
        setInterviewers(data.interviewers || []);
      }
    } catch (error) {
      console.error('Failed to fetch interviewers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (interviewerId: number, status: string) => {
    try {
      const res = await fetch('/api/admin/interviewers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewerId, status }),
      });
      if (res.ok) await fetchInterviewers();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const pendingInterviewers  = interviewers.filter(i => i.status === 'PENDING');
  const approvedInterviewers = interviewers.filter(i => i.status === 'APPROVED');
  const rejectedInterviewers = interviewers.filter(i => i.status === 'REJECTED');

  if (loading) return <div className="text-center py-12 text-slate-500">Loading interviewers...</div>;

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-display font-bold text-slate-900 mb-8">Manage Interviewers</h1>

      {/* ── PENDING ── */}
      {pendingInterviewers.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-2xl font-semibold text-slate-900">Pending Approval</h2>
            <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
              {pendingInterviewers.length}
            </span>
          </div>
          <div className="space-y-4">
            {pendingInterviewers.map((iv) => (
              <InterviewerCard
                key={iv.id}
                interviewer={iv}
                expanded={expanded === iv.id}
                onToggle={() => setExpanded(expanded === iv.id ? null : iv.id)}
                onApprove={() => handleUpdateStatus(iv.id, 'APPROVED')}
                onReject={() => handleUpdateStatus(iv.id, 'REJECTED')}
                showActions
              />
            ))}
          </div>
        </section>
      )}

      {/* ── APPROVED ── */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-slate-900 mb-4">
          Approved Interviewers ({approvedInterviewers.length})
        </h2>
        {approvedInterviewers.length === 0 ? (
          <Card variant="bordered" className="p-8 text-center text-slate-500">No approved interviewers yet.</Card>
        ) : (
          <div className="space-y-4">
            {approvedInterviewers.map((iv) => (
              <InterviewerCard
                key={iv.id}
                interviewer={iv}
                expanded={expanded === iv.id}
                onToggle={() => setExpanded(expanded === iv.id ? null : iv.id)}
                onReject={() => handleUpdateStatus(iv.id, 'REJECTED')}
                showActions={false}
                isApproved
              />
            ))}
          </div>
        )}
      </section>

      {/* ── REJECTED ── */}
      {rejectedInterviewers.length > 0 && (
        <section>
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">
            Rejected ({rejectedInterviewers.length})
          </h2>
          <div className="space-y-4">
            {rejectedInterviewers.map((iv) => (
              <InterviewerCard
                key={iv.id}
                interviewer={iv}
                expanded={expanded === iv.id}
                onToggle={() => setExpanded(expanded === iv.id ? null : iv.id)}
                onApprove={() => handleUpdateStatus(iv.id, 'APPROVED')}
                showActions={false}
                isRejected
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Interviewer Card ─────────────────────────────────────────────────────────
function InterviewerCard({ interviewer: iv, expanded, onToggle, onApprove, onReject, showActions, isApproved, isRejected }: any) {
  const hasDocuments = iv.resumeUrl || iv.idCardUrl;
  const missingDocs  = !iv.resumeUrl || !iv.idCardUrl;

  return (
    <Card variant="bordered" className="overflow-hidden">
      <div className="p-6">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-lg font-semibold text-slate-900">{iv.name}</h3>
              {isApproved  && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">✓ Active</span>}
              {isRejected  && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">✗ Rejected</span>}
              {!isApproved && !isRejected && missingDocs && (
                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">⚠ Docs incomplete</span>
              )}
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2">
              <span className="text-sm text-slate-600">📧 {iv.user.email}</span>
              {iv.companies?.length > 0    && <span className="text-sm text-slate-600">🏢 {iv.companies.join(', ')}</span>}
              {iv.yearsOfExperience         && <span className="text-sm text-slate-600">💼 {iv.yearsOfExperience} yrs exp</span>}
              {iv.linkedinUrl ? (
                <a href={iv.linkedinUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                  onClick={e => e.stopPropagation()}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  LinkedIn Profile
                </a>
              ) : (
                <span className="text-sm text-slate-400">🔗 No LinkedIn</span>
              )}
            </div>

            {/* ── Rating row ── */}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-slate-500">Student Rating:</span>
              <StarDisplay rating={iv.averageRating ?? null} totalRatings={iv.totalRatings ?? 0} />
            </div>
          </div>

          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={onToggle}
              className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              {expanded ? 'Less ▲' : 'Details ▼'}
            </button>
            {showActions && (
              <>
                <Button onClick={onApprove} size="sm">Approve</Button>
                <Button onClick={onReject} variant="danger" size="sm">Reject</Button>
              </>
            )}
            {isApproved  && <Button onClick={onReject}  variant="danger" size="sm">Revoke</Button>}
            {isRejected  && <Button onClick={onApprove} size="sm">Re-approve</Button>}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 p-6">
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Roles Supported</p>
              <p className="text-sm text-slate-700">{iv.rolesSupported?.join(', ') || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Difficulty Levels</p>
              <div className="flex gap-1 flex-wrap">
                {iv.difficultyLevels?.map((d: string) => (
                  <span key={d} className={`px-2 py-0.5 rounded text-xs font-medium ${
                    d === 'HARD'   ? 'bg-red-100 text-red-700' :
                    d === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>{d}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Session Types</p>
              <p className="text-sm text-slate-700">{iv.sessionTypesOffered?.join(', ') || '—'}</p>
            </div>
            {iv.education && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Education</p>
                <p className="text-sm text-slate-700">{iv.education}</p>
              </div>
            )}
            {/* Rating detail in expanded view */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Student Rating</p>
              <StarDisplay rating={iv.averageRating ?? null} totalRatings={iv.totalRatings ?? 0} />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Verification Documents</p>
            <div className="grid grid-cols-2 gap-4">
              <div className={`rounded-xl border-2 p-4 ${iv.resumeUrl ? 'border-green-200 bg-green-50' : 'border-dashed border-slate-300 bg-white'}`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📄</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-700">Resume / CV</p>
                    {iv.resumeUrl ? (
                      <a href={iv.resumeUrl} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-indigo-600 hover:underline">
                        View Document →
                      </a>
                    ) : (
                      <p className="text-sm text-slate-400">Not uploaded yet</p>
                    )}
                  </div>
                  {iv.resumeUrl && <span className="text-green-500 text-lg">✓</span>}
                </div>
              </div>

              <div className={`rounded-xl border-2 p-4 ${iv.idCardUrl ? 'border-green-200 bg-green-50' : 'border-dashed border-slate-300 bg-white'}`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🪪</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-700">Company ID Card</p>
                    {iv.idCardUrl ? (
                      <a href={iv.idCardUrl} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-indigo-600 hover:underline">
                        View Document →
                      </a>
                    ) : (
                      <p className="text-sm text-slate-400">Not uploaded yet</p>
                    )}
                  </div>
                  {iv.idCardUrl && <span className="text-green-500 text-lg">✓</span>}
                </div>
              </div>
            </div>

            {!hasDocuments && (
              <p className="mt-3 text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-4 py-2">
                ⚠️ This interviewer hasn't uploaded any verification documents yet.
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}