'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { PaymentGate, UsageBanner } from '@/components/shared/PaymentGate';

export default function BookGuidancePage() {
  const router = useRouter();
  const [interviewers, setInterviewers] = useState<any[]>([]);
  const [selectedInterviewer, setSelectedInterviewer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Plan state
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

  useEffect(() => {
    fetchAll();
  }, []);

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
            planType: data.profile.planType,
            guidanceUsed: data.profile.guidanceUsed,
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
    // Refresh plan data and unlock the form
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
        setPlan((prev) =>
          prev
            ? { ...prev, guidanceUsed: data.used, guidanceLimit: data.limit, planType: data.planType }
            : prev
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
    return <div className="text-center py-12 text-slate-500">Loading...</div>;
  }

  // ── Show payment wall ─────────────────────────────────────────────────────
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
          sessionType="guidance" onPaymentSuccessAction={function (): void {
            throw new Error('Function not implemented.');
          } }        />
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
        {/* Mentors list */}
        <div className="col-span-2">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Select a Mentor</h2>
          <div className="space-y-4">
            {interviewers.length === 0 ? (
              <p className="text-slate-600">No mentors available at the moment.</p>
            ) : (
              interviewers.map((interviewer) => (
                <Card
                  key={interviewer.id}
                  variant="bordered"
                  className={`p-6 cursor-pointer transition-all ${
                    selectedInterviewer?.id === interviewer.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'hover:border-slate-300'
                  }`}
                  onClick={() => setSelectedInterviewer(interviewer)}
                >
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">{interviewer.name}</h3>
                  {interviewer.companies?.length > 0 && (
                    <p className="text-sm text-slate-600 mb-1">
                      <span className="font-medium">Companies:</span> {interviewer.companies.join(', ')}
                    </p>
                  )}
                  {interviewer.yearsOfExperience && (
                    <p className="text-sm text-slate-600 mb-1">
                      <span className="font-medium">Experience:</span> {interviewer.yearsOfExperience} years
                    </p>
                  )}
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">Specializes in:</span>{' '}
                    {interviewer.rolesSupported?.join(', ')}
                  </p>
                  {interviewer.availabilitySlots?.length > 0 && (
                    <p className="text-xs text-green-600 mt-2">
                      ✓ {interviewer.availabilitySlots.length} slots available
                    </p>
                  )}
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Booking form */}
        <div>
          <Card variant="elevated" className="p-6 sticky top-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Session Details</h2>
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
                <Select
                  label="Time Slot"
                  value={formData.scheduledTime}
                  onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                  options={selectedInterviewer.availabilitySlots.map((slot: any) => ({
                    value: slot.startTime,
                    label: new Date(slot.startTime).toLocaleString(),
                  }))}
                />
              ) : (
                <div className="text-sm text-amber-600">
                  {selectedInterviewer
                    ? 'No available slots for this mentor'
                    : 'Select a mentor to see available slots'}
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={submitting || !selectedInterviewer || !formData.scheduledTime}
              >
                {submitting ? 'Booking...' : 'Book Session'}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}