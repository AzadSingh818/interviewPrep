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
    return <div className="text-center py-12 text-slate-500">Loading...</div>;
  }

  // ── Show payment wall ─────────────────────────────────────────────────────
  if (limitReached && plan) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">Book Mock Interview</h1>
        <p className="text-slate-600 mb-8">
          We'll automatically match you with the best available interviewer.
        </p>
        <PaymentGate
          planType={plan.planType}
          used={plan.interviewsUsed}
          limit={plan.interviewsLimit}
          sessionType="interview" onPaymentSuccessAction={function (): void {
            throw new Error('Function not implemented.');
          } }        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">Book Mock Interview</h1>
      <p className="text-slate-600 mb-6">
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

      <Card variant="elevated" className="p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Target Role"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            placeholder="e.g., Software Engineer, Product Manager"
            required
          />

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

          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
            <p className="text-sm text-indigo-900">
              <strong>Auto-Assignment:</strong> We'll match you with an available interviewer
              who supports your <strong>Interview Type</strong> and <strong>Difficulty Level</strong>.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={submitting}>
            {submitting ? 'Finding best interviewer...' : 'Book Interview (Auto-Assign)'}
          </Button>
        </form>
      </Card>
    </div>
  );
}