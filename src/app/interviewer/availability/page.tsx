'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { formatDateTime } from '@/lib/utils';

export default function InterviewerAvailabilityPage() {
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    startTime: '',
    endTime: '',
  });

  useEffect(() => {
    fetchSlots();
  }, []);

  const fetchSlots = async () => {
    try {
      const res = await fetch('/api/interviewer/availability');
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots || []);
      }
    } catch (error) {
      console.error('Failed to fetch slots:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const start = new Date(formData.startTime);
    const end = new Date(formData.endTime);

    // Client-side validation
    if (end <= start) {
      setFormError('End time must be after start time.');
      return;
    }

    const durationMins = (end.getTime() - start.getTime()) / (1000 * 60);
    if (durationMins < 30 || durationMins > 240) {
      setFormError('Slot duration must be between 30 minutes and 4 hours.');
      return;
    }

    if (start <= new Date()) {
      setFormError('Start time must be in the future.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/interviewer/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        }),
      });

      if (res.ok) {
        setFormData({ startTime: '', endTime: '' });
        setShowForm(false);
        setFormError('');
        await fetchSlots();
      } else {
        const data = await res.json();
        setFormError(data.error || 'Failed to add slot');
      }
    } catch (error) {
      setFormError('An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSlot = async (slotId: number) => {
    if (!confirm('Are you sure you want to delete this slot?')) return;

    try {
      const res = await fetch('/api/interviewer/availability', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId }),
      });

      if (res.ok) {
        await fetchSlots();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete slot');
      }
    } catch (error) {
      alert('An error occurred. Please try again.');
    }
  };

  const now = new Date();
  const availableSlots = slots.filter((s) => !s.isBooked && new Date(s.startTime) > now);
  const bookedSlots = slots.filter((s) => s.isBooked);
  const expiredSlots = slots.filter((s) => !s.isBooked && new Date(s.startTime) <= now); // ✅ shows old bad slots

  if (loading) {
    return <div className="text-center py-12">Loading availability...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-display font-bold text-slate-900">
          Manage Availability
        </h1>
        <Button onClick={() => { setShowForm(!showForm); setFormError(''); }}>
          {showForm ? 'Cancel' : '+ Add Time Slot'}
        </Button>
      </div>

      {showForm && (
        <Card variant="elevated" className="p-6 mb-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            Add New Time Slot
          </h2>
          <form onSubmit={handleAddSlot} className="grid grid-cols-2 gap-4">
            <Input
              label="Start Time"
              type="datetime-local"
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              required
            />
            <Input
              label="End Time"
              type="datetime-local"
              value={formData.endTime}
              onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
              required
            />
            {formError && (
              <div className="col-span-2 bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm text-red-800">{formError}</p>
              </div>
            )}
            <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-sm text-blue-800">
                ℹ️ Slot duration must be between <strong>30 minutes</strong> and{' '}
                <strong>4 hours</strong>. Students can book any time within your slot window.
              </p>
            </div>
            <div className="col-span-2">
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Adding...' : 'Add Slot'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-8">
        {/* Available Slots */}
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">
            Available Slots ({availableSlots.length})
          </h2>
          {availableSlots.length === 0 ? (
            <Card variant="bordered" className="p-8 text-center text-slate-600">
              No available slots. Add some to start receiving bookings.
            </Card>
          ) : (
            <div className="space-y-3">
              {availableSlots.map((slot) => {
                const durationMins = Math.round(
                  (new Date(slot.endTime).getTime() - new Date(slot.startTime).getTime()) / 60000
                );
                return (
                  <Card key={slot.id} variant="bordered" className="p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-slate-900">
                          {formatDateTime(slot.startTime)}
                        </p>
                        <p className="text-sm text-slate-500">
                          Until: {formatDateTime(slot.endTime)}
                        </p>
                        <p className="text-sm text-slate-500">
                          Duration: {durationMins} mins
                        </p>
                      </div>
                      <Button
                        onClick={() => handleDeleteSlot(slot.id)}
                        variant="danger"
                        size="sm"
                      >
                        Delete
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Booked Slots */}
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">
            Booked Slots ({bookedSlots.length})
          </h2>
          {bookedSlots.length === 0 ? (
            <Card variant="bordered" className="p-8 text-center text-slate-600">
              No booked slots yet.
            </Card>
          ) : (
            <div className="space-y-3">
              {bookedSlots.map((slot) => (
                <Card
                  key={slot.id}
                  variant="bordered"
                  className="p-4 bg-green-50 border-green-200"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">
                        {formatDateTime(slot.startTime)}
                      </p>
                      <p className="text-sm text-slate-500">Booked</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expired Slots — shown so interviewer can clean them up */}
      {expiredSlots.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-slate-500 mb-4">
            Expired Slots ({expiredSlots.length}) — Please delete to clean up
          </h2>
          <div className="space-y-3">
            {expiredSlots.map((slot) => (
              <Card
                key={slot.id}
                variant="bordered"
                className="p-4 bg-gray-50 border-gray-200 opacity-60"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-slate-500">
                      {formatDateTime(slot.startTime)}
                    </p>
                    <p className="text-sm text-slate-400">
                      Until: {formatDateTime(slot.endTime)}
                    </p>
                    <p className="text-sm text-red-400">Expired</p>
                  </div>
                  <Button
                    onClick={() => handleDeleteSlot(slot.id)}
                    variant="danger"
                    size="sm"
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}