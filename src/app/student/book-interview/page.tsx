'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { PaymentGate, UsageBanner } from '@/components/shared/PaymentGate';

export default function BookInterviewPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    role: '',
    difficulty: '',
    interviewType: '',
    durationMinutes: '60',
    scheduledTime: '',
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Plan state
  const [plan, setPlan] = useState<{
    planType: 'FREE' | 'PRO';
    interviewsUsed: number;
    interviewsLimit: number;
    planExpiresAt: string | null;
  } | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  useEffect(() => {
    fetchPlan();
  }, []);

  const fetchPlan = async () => {
    try {
      const res = await fetch('/api/student/profile');
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setPlan({
            planType: data.profile.planType,
            interviewsUsed: data.profile.interviewsUsed,
            interviewsLimit: data.profile.interviewsLimit,
            planExpiresAt: data.profile.planExpiresAt,
          });
          setLimitReached(data.profile.interviewsUsed >= data.profile.interviewsLimit);
        }
      }
    } catch (err) {
      console.error('Failed to load plan:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    fetchPlan();
    setLimitReached(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.difficulty) { setError('Please select a difficulty level.'); return; }
    if (!formData.interviewType) { setError('Please select an interview type.'); return; }
    if (!formData.scheduledTime) { setError('Please select a preferred date and time.'); return; }

    const chosenTime = new Date(formData.scheduledTime);
    if (chosenTime <= new Date()) { setError('Please select a future date and time.'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/student/book/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, scheduledTime: chosenTime.toISOString() }),
      });

      const data = await res.json();

      if (res.ok) {
        const interviewerName = data.assignedInterviewer?.name ?? 'an interviewer';
        alert(`Interview booked successfully with ${interviewerName}!`);
        router.push('/student/sessions');
      } else if (data.error === 'LIMIT_REACHED') {
        setLimitReached(true);
        setPlan((prev) =>
          prev
            ? { ...prev, interviewsUsed: data.used, interviewsLimit: data.limit, planType: data.planType }
            : prev
        );
      } else {
        setError(data.error || 'Failed to book interview. Please try again.');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const minDateTime = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  // ── Show payment wall ─────────────────────────────────────────────────────
  if (limitReached && plan) {
    return (
      <div className="max-w-6xl mx-auto px-0 sm:px-0">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 mb-2">Book Mock Interview</h1>
        <p className="text-slate-600 mb-6 sm:mb-8 text-sm sm:text-base">
          We'll automatically match you with the best available interviewer.
        </p>
        <PaymentGate
          planType={plan.planType}
          used={plan.interviewsUsed}
          limit={plan.interviewsLimit}
          sessionType="interview"
          onPaymentSuccessAction={handlePaymentSuccess}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 mb-1 sm:mb-2">
        Book Mock Interview
      </h1>
      <p className="text-slate-600 mb-4 sm:mb-6 text-sm sm:text-base">
        We'll automatically match you with the best available interviewer.
      </p>

      {/* Usage banner */}
      {plan && (
        <UsageBanner
          planType={plan.planType}
          used={plan.interviewsUsed}
          limit={plan.interviewsLimit}
          sessionType="interview"
          planExpiresAt={plan.planExpiresAt}
        />
      )}

      <Card variant="elevated" className="p-4 sm:p-6 lg:p-8">
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <Input
            label="Target Role"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            placeholder="e.g., Software Engineer, Product Manager"
            required
          />

          {/* Two-column on sm+, single column on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <Select
              label="Difficulty Level"
              value={formData.difficulty}
              onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
              options={[
                { value: 'EASY', label: 'Easy' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'HARD', label: 'Hard' },
              ]}
            />

            <Select
              label="Interview Type"
              value={formData.interviewType}
              onChange={(e) => setFormData({ ...formData, interviewType: e.target.value })}
              options={[
                { value: 'TECHNICAL', label: 'Technical' },
                { value: 'HR', label: 'HR / Behavioral' },
                { value: 'MIXED', label: 'Mixed (Technical + HR)' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <Select
              label="Duration"
              value={formData.durationMinutes}
              onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
              options={[
                { value: '45', label: '45 minutes' },
                { value: '60', label: '60 minutes' },
                { value: '90', label: '90 minutes' },
              ]}
            />

            <Input
              label="Preferred Date & Time"
              type="datetime-local"
              value={formData.scheduledTime}
              min={minDateTime}
              onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
              required
            />
          </div>

          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-indigo-900">
              <strong>Auto-Assignment:</strong> We'll match you with an available interviewer
              who supports your <strong>Interview Type</strong> and <strong>Difficulty Level</strong>.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-red-800">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={submitting}>
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Finding best interviewer...
              </span>
            ) : 'Book Interview (Auto-Assign)'}
          </Button>
        </form>
      </Card>
    </div>
  );
}