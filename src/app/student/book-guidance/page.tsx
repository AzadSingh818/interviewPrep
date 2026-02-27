'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { PaymentGate, UsageBanner } from '@/components/shared/PaymentGate';

// ─── Helper: resolve a displayable photo URL ─────────────────────────────────
// Returns null if the URL is a Google default alphabet avatar (so we fall back
// to the initials avatar instead of showing a generic Google icon).
function resolvePhoto(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.includes('googleusercontent.com') || url.includes('ggpht.com')) return null;
  return url;
}

// ─── Interviewer Avatar ───────────────────────────────────────────────────────
function InterviewerAvatar({
  interviewer,
  size = 56,
}: {
  interviewer: any;
  size?: number;
}) {
  const photoUrl = resolvePhoto(interviewer.user?.profilePicture);
  const initials = (interviewer.name || 'I')
    .split(' ')
    .map((n: string) => n[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={interviewer.name}
        width={size}
        height={size}
        className="rounded-full object-cover border-2 border-white shadow-sm flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center border-2 border-white shadow-sm flex-shrink-0 text-white font-bold"
      style={{ width: size, height: size, fontSize: size * 0.33 }}
    >
      {initials}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BookGuidancePage() {
  const router = useRouter();
  const [interviewers, setInterviewers]               = useState<any[]>([]);
  const [selectedInterviewer, setSelectedInterviewer] = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');

  const [plan, setPlan] = useState<{
    planType: 'FREE' | 'PRO';
    guidanceUsed: number;
    guidanceLimit: number;
    planExpiresAt: string | null;
  } | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  const [formData, setFormData] = useState({
    topic: '',
    durationMinutes: '30',
    scheduledTime: '',
  });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [interviewersRes, profileRes] = await Promise.all([
        fetch('/api/interviewer/list'),
        fetch('/api/student/profile'),
      ]);

      if (interviewersRes.ok) {
        const data = await interviewersRes.json();
        setInterviewers(data.interviewers || []);
      }

      if (profileRes.ok) {
        const data = await profileRes.json();
        if (data.profile) {
          setPlan({
            planType:      data.profile.planType,
            guidanceUsed:  data.profile.guidanceUsed,
            guidanceLimit: data.profile.guidanceLimit,
            planExpiresAt: data.profile.planExpiresAt,
          });
          setLimitReached(data.profile.guidanceUsed >= data.profile.guidanceLimit);
        }
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    fetchAll();
    setLimitReached(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInterviewer) {
      setError('Please select a mentor.');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/student/book/guidance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewerId: selectedInterviewer.id,
          ...formData,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert('Guidance session booked successfully!');
        router.push('/student/sessions');
      } else if (data.error === 'LIMIT_REACHED') {
        setLimitReached(true);
        setPlan(prev =>
          prev
            ? { ...prev, guidanceUsed: data.used, guidanceLimit: data.limit, planType: data.planType }
            : prev,
        );
      } else {
        setError(data.error || 'Failed to book session. Please try again.');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading mentors…</p>
        </div>
      </div>
    );
  }

  // ── Payment wall ───────────────────────────────────────────────────────────
  if (limitReached && plan) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">
          Book Guidance Session
        </h1>
        <p className="text-slate-600 mb-8">Get mentorship from industry experts.</p>
        <PaymentGate
          planType={plan.planType}
          used={plan.guidanceUsed}
          limit={plan.guidanceLimit}
          sessionType="guidance"
          onPaymentSuccessAction={handlePaymentSuccess}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">
        Book Guidance Session
      </h1>
      <p className="text-slate-600 mb-6">Get mentorship from industry experts.</p>

      {/* Usage banner */}
      {plan && (
        <UsageBanner
          planType={plan.planType}
          used={plan.guidanceUsed}
          limit={plan.guidanceLimit}
          sessionType="guidance"
          planExpiresAt={plan.planExpiresAt}
        />
      )}

      <div className="grid grid-cols-3 gap-8">
        {/* ── Mentors list ── */}
        <div className="col-span-2">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Select a Mentor</h2>

          {interviewers.length === 0 ? (
            <p className="text-slate-600">No mentors available at the moment.</p>
          ) : (
            <div className="space-y-4">
              {interviewers.map((interviewer) => {
                const isSelected = selectedInterviewer?.id === interviewer.id;
                return (
                  <Card
                    key={interviewer.id}
                    variant="bordered"
                    className={`p-5 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                        : 'hover:border-slate-300 hover:shadow-sm'
                    }`}
                    onClick={() => setSelectedInterviewer(interviewer)}
                  >
                    <div className="flex items-start gap-4">
                      {/* ✅ Profile photo */}
                      <InterviewerAvatar interviewer={interviewer} size={56} />

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h3 className="text-base font-semibold text-slate-900 truncate">
                            {interviewer.name}
                          </h3>
                          {isSelected && (
                            <span className="shrink-0 text-xs font-semibold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                              ✓ Selected
                            </span>
                          )}
                        </div>

                        {interviewer.companies?.length > 0 && (
                          <p className="text-sm text-slate-600 mb-1">
                            <span className="font-medium">Companies:</span>{' '}
                            {interviewer.companies.join(', ')}
                          </p>
                        )}

                        {interviewer.yearsOfExperience && (
                          <p className="text-sm text-slate-600 mb-1">
                            <span className="font-medium">Experience:</span>{' '}
                            {interviewer.yearsOfExperience} years
                          </p>
                        )}

                        <p className="text-sm text-slate-600 mb-2">
                          <span className="font-medium">Specializes in:</span>{' '}
                          {interviewer.rolesSupported?.join(', ')}
                        </p>

                        {/* Availability chip */}
                        {interviewer.availabilitySlots?.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                            {interviewer.availabilitySlots.length} slot{interviewer.availabilitySlots.length !== 1 ? 's' : ''} available
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                            No slots currently available
                          </span>
                        )}

                        {/* LinkedIn */}
                        {interviewer.linkedinUrl && (
                          <a
                            href={interviewer.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs text-[#0A66C2] hover:underline mt-1 ml-2"
                          >
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                            </svg>
                            LinkedIn
                          </a>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Booking form ── */}
        <div>
          <Card variant="elevated" className="p-6 sticky top-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Session Details</h2>

            {/* Selected mentor preview */}
            {selectedInterviewer && (
              <div className="flex items-center gap-3 mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                <InterviewerAvatar interviewer={selectedInterviewer} size={40} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-indigo-900 truncate">
                    {selectedInterviewer.name}
                  </p>
                  <p className="text-xs text-indigo-600 truncate">
                    {selectedInterviewer.companies?.join(', ')}
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Topic"
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                placeholder="e.g., Resume Review, Career Guidance"
                required
              />

              <Select
                label="Duration"
                value={formData.durationMinutes}
                onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
                options={[
                  { value: '30', label: '30 minutes' },
                  { value: '45', label: '45 minutes' },
                  { value: '60', label: '60 minutes' },
                ]}
              />

              {selectedInterviewer && selectedInterviewer.availabilitySlots?.length > 0 ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Available Slot
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:border-indigo-500 focus:outline-none"
                    value={formData.scheduledTime}
                    onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                    required
                  >
                    <option value="">Select a time slot</option>
                    {selectedInterviewer.availabilitySlots.map((slot: any) => (
                      <option key={slot.id} value={slot.startTime}>
                        {new Date(slot.startTime).toLocaleString('en-IN', {
                          weekday: 'short',
                          month:   'short',
                          day:     'numeric',
                          hour:    '2-digit',
                          minute:  '2-digit',
                        })}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <Input
                  label="Preferred Date & Time"
                  type="datetime-local"
                  value={formData.scheduledTime}
                  onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                  required
                />
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  ❌ {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={submitting || !selectedInterviewer}
                className="w-full"
              >
                {submitting ? 'Booking…' : 'Book Session'}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}