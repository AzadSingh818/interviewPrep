'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { formatDateTime } from '@/lib/utils';

export default function InterviewerAvailabilityPage() {
  const [slots, setSlots]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState('');
  const [formData, setFormData] = useState({ startTime: '', endTime: '' });

  useEffect(() => { fetchSlots(); }, []);

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
    const end   = new Date(formData.endTime);

    if (end <= start) { setFormError('End time must be after start time.'); return; }
    const durationMins = (end.getTime() - start.getTime()) / (1000 * 60);
    if (durationMins < 30 || durationMins > 240) { setFormError('Slot duration must be between 30 minutes and 4 hours.'); return; }
    if (start <= new Date()) { setFormError('Start time must be in the future.'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/interviewer/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime: start.toISOString(), endTime: end.toISOString() }),
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
    } catch { setFormError('An error occurred. Please try again.'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteSlot = async (slotId: number) => {
    if (!confirm('Are you sure you want to delete this slot?')) return;
    try {
      const res = await fetch('/api/interviewer/availability', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId }),
      });
      if (res.ok) { await fetchSlots(); }
      else { const data = await res.json(); alert(data.error || 'Failed to delete slot'); }
    } catch { alert('An error occurred. Please try again.'); }
  };

  const now = new Date();
  const availableSlots = slots.filter(s => !s.isBooked && new Date(s.startTime) > now);
  const bookedSlots    = slots.filter(s => s.isBooked);
  const expiredSlots   = slots.filter(s => !s.isBooked && new Date(s.startTime) <= now);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Loading availability…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white">
          Manage Availability
        </h1>
        <Button onClick={() => { setShowForm(!showForm); setFormError(''); }} size="sm">
          {showForm ? 'Cancel' : '+ Add Time Slot'}
        </Button>
      </div>

      {/* Add slot form */}
      {showForm && (
        <Card variant="elevated" className="p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-4">Add New Time Slot</h2>
          <form onSubmit={handleAddSlot} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <Input
                label="Start Time"
                type="datetime-local"
                value={formData.startTime}
                onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                required
              />
              <Input
                label="End Time"
                type="datetime-local"
                value={formData.endTime}
                onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                required
              />
            </div>

            {formError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
                <p className="text-sm text-red-800 dark:text-red-300">{formError}</p>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                ℹ️ Slot duration must be between <strong>30 minutes</strong> and <strong>4 hours</strong>. Students can book any time within your slot window.
              </p>
            </div>

            <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Slot'}
            </Button>
          </form>
        </Card>
      )}

      {/* Slots sections — stack on mobile, 2-col on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">

        {/* Available Slots */}
        <div>
          <h2 className="text-lg sm:text-2xl font-semibold text-slate-900 dark:text-white mb-3 sm:mb-4">
            Available Slots ({availableSlots.length})
          </h2>
          {availableSlots.length === 0 ? (
            <Card variant="bordered" className="p-6 sm:p-8 text-center text-slate-600 dark:text-slate-400 text-sm">
              No available slots. Add some to start receiving bookings.
            </Card>
          ) : (
            <div className="space-y-3">
              {availableSlots.map(slot => {
                const durationMins = Math.round(
                  (new Date(slot.endTime).getTime() - new Date(slot.startTime).getTime()) / 60000
                );
                return (
                  <Card key={slot.id} variant="bordered" className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 dark:text-white text-sm sm:text-base">
                          {formatDateTime(slot.startTime)}
                        </p>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                          Until: {formatDateTime(slot.endTime)}
                        </p>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                          Duration: {durationMins} mins
                        </p>
                      </div>
                      <Button onClick={() => handleDeleteSlot(slot.id)} variant="danger" size="sm">
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
          <h2 className="text-lg sm:text-2xl font-semibold text-slate-900 dark:text-white mb-3 sm:mb-4">
            Booked Slots ({bookedSlots.length})
          </h2>
          {bookedSlots.length === 0 ? (
            <Card variant="bordered" className="p-6 sm:p-8 text-center text-slate-600 dark:text-slate-400 text-sm">
              No booked slots yet.
            </Card>
          ) : (
            <div className="space-y-3">
              {bookedSlots.map(slot => {
                const durationMins = Math.round(
                  (new Date(slot.endTime).getTime() - new Date(slot.startTime).getTime()) / 60000
                );
                return (
                  <Card key={slot.id} variant="bordered" className="p-3 sm:p-4 border-indigo-200 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-900/10">
                    <p className="font-medium text-slate-900 dark:text-white text-sm sm:text-base">
                      {formatDateTime(slot.startTime)}
                    </p>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                      Until: {formatDateTime(slot.endTime)}
                    </p>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                      Duration: {durationMins} mins
                    </p>
                    <span className="inline-block mt-2 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                      📅 Booked
                    </span>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Expired Slots */}
      {expiredSlots.length > 0 && (
        <div className="mt-6 sm:mt-8">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-500 dark:text-slate-400 mb-3">
            Expired Slots ({expiredSlots.length})
          </h2>
          <div className="space-y-2">
            {expiredSlots.map(slot => (
              <Card key={slot.id} variant="bordered" className="p-3 sm:p-4 opacity-60">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-600 dark:text-slate-400 text-sm line-through">
                      {formatDateTime(slot.startTime)}
                    </p>
                    <p className="text-xs text-slate-400">Expired — not booked</p>
                  </div>
                  <Button onClick={() => handleDeleteSlot(slot.id)} variant="secondary" size="sm">
                    Remove
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