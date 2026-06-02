'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { PaymentGate, UsageBanner } from '@/components/shared/PaymentGate';

declare global { interface Window { Razorpay: any; } }

// ─── Constants ──────────────────────────────────────────────────────────────
const TARGET_ROLES = [
  'Software Engineer',
  'Frontend',
  'Backend',
  'Full Stack',
  'Data Scientist',
  'Product Manager',
  'DevOps',
  'QA/Test Engineer',
  'Other',
];

const INTERVIEW_DIFFICULTIES = [
  { value: 'INTERN', label: 'Intern' },
  { value: 'ENTRY', label: 'Entry' },
  { value: 'MID', label: 'Mid' },
  { value: 'SENIOR', label: 'Senior' },
];

const LEVEL_RANK: Record<string, number> = {
  INTERN: 1,
  ENTRY: 2,
  MID: 3,
  SENIOR: 4,
};

function detectStudentLevel(profile: any): 'INTERN' | 'ENTRY' | 'MID' | 'SENIOR' {
  if (!profile) return 'ENTRY';

  const text = (profile.experienceLevel || '').toString().toLowerCase();
  const years = Number(profile.yearsOfExperience ?? 0);

  if (text.includes('intern') || text.includes('3rd') || text.includes('third')) {
    return 'INTERN';
  }
  if (text.includes('fresher') || text.includes('entry') || text.includes('graduate')) {
    return 'ENTRY';
  }
  if (text.includes('mid')) {
    return 'MID';
  }
  if (text.includes('senior') || text.includes('lead')) {
    return 'SENIOR';
  }

  if (years < 1) return 'ENTRY';
  if (years < 2) return 'ENTRY';
  if (years < 5) return 'MID';
  return 'SENIOR';
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Interviewer {
  id: number;
  name: string;
  companies: string[];
  rolesSupported: string[];
  yearsOfExperience: number | null;
  careerLevel: string | null;
  sessionTypesOffered: string[];
  interviewTypesOffered: string[];
  linkedinUrl: string | null;
  user: { name: string | null; profilePicture: string | null };
  _count: { sessions: number };
}

interface BookingForm {
  role: string;
  difficulty: string;
  interviewType: string;
  scheduledTime: string;
}

// ─── Unlock Modal ─────────────────────────────────────────────────────────────
function UnlockModal({
  onClose,
  onUnlocked,
  interviewers,
}: {
  onClose: () => void;
  onUnlocked: () => void;
  interviewers: Interviewer[];
}) {
  const [unlocking, setUnlocking] = useState(false);
  const [err, setErr] = useState('');

  const loadRazorpay = () =>
    new Promise<boolean>((resolve) => {
      if (window.Razorpay) return resolve(true);
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });

  const handleUnlock = async () => {
    setErr('');
    setUnlocking(true);
    try {
      const loaded = await loadRazorpay();
      if (!loaded) { setErr('Failed to load payment gateway.'); setUnlocking(false); return; }

      const orderRes = await fetch('/api/payment/create-unlock-order', { method: 'POST' });
      const orderData = await orderRes.json();
      if (!orderRes.ok) { setErr(orderData.error || 'Failed to create order.'); setUnlocking(false); return; }
      if (orderData.alreadyUnlocked) { onUnlocked(); return; }

      const profileRes = await fetch('/api/student/profile');
      const profileData = await profileRes.json();
      const userEmail = profileData.user?.email ?? '';
      const userName  = profileData.profile?.name ?? profileData.user?.name ?? '';

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'InterviewPrepLive',
        description: 'Unlock — Choose Your Preferred Interviewer',
        order_id: orderData.orderId,
        prefill: { name: userName, email: userEmail },
        theme: { color: '#7c3aed' },
        modal: { ondismiss: () => setUnlocking(false) },
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch('/api/payment/unlock-preferred-interviewer', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
              }),
            });
            const vData = await verifyRes.json();
            if (verifyRes.ok && vData.success) { onUnlocked(); }
            else { setErr(vData.error || 'Payment verification failed.'); }
          } catch { setErr('Verification error. Contact support.'); }
          finally { setUnlocking(false); }
        },
      };
      new window.Razorpay(options).open();
    } catch { setErr('Something went wrong.'); setUnlocking(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(6px)', backgroundColor: 'rgba(15,10,40,0.55)' }}
      onClick={onClose}>
      <div className="relative w-full max-w-2xl bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        <div className="h-1 w-full bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400" />
        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white mb-1">🎯 Choose Your Interviewer</h2>
              <p className="text-sm text-white/60">Unlock for <span className="font-bold text-violet-300">₹50</span> to pick a company-specific interviewer</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-all text-lg font-bold">✕</button>
          </div>

          <div className="relative mb-6">
            <div className="space-y-3 max-h-52 overflow-y-auto pr-1" style={{ filter: 'blur(3px)', userSelect: 'none', pointerEvents: 'none' }}>
              {interviewers.slice(0, 5).map((iv) => (
                <div key={iv.id} className="flex items-center gap-3 bg-white/10 rounded-2xl p-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold text-sm shrink-0">{iv.name.charAt(0)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-semibold text-sm truncate">{iv.name}</p>
                    <p className="text-white/50 text-xs truncate">{iv.companies.slice(0, 2).join(', ')}{iv.yearsOfExperience ? ` · ${iv.yearsOfExperience}y exp` : ''}</p>
                  </div>
                </div>
              ))}
              {interviewers.length === 0 && [1, 2, 3].map((n) => (
                <div key={n} className="flex items-center gap-3 bg-white/10 rounded-2xl p-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20" />
                  <div className="flex-1"><div className="h-3 bg-white/20 rounded w-32 mb-2" /><div className="h-2 bg-white/10 rounded w-20" /></div>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-6 py-4 text-center">
                <p className="text-3xl mb-2">🔒</p>
                <p className="text-white font-bold text-sm">Unlock to see & choose interviewers</p>
              </div>
            </div>
          </div>

          <div className="bg-white/10 border border-white/15 rounded-2xl p-4 mb-5">
            <p className="text-xs font-bold text-violet-300 uppercase tracking-widest mb-2">What you get</p>
            <ul className="space-y-1.5">
              {['See full list of approved company-specific interviewers', 'Choose the interviewer you prefer', 'Admin assigns your session within 24 hours', 'Get email confirmation with your interviewer details'].map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm text-white/80"><span className="text-green-400 mt-0.5 shrink-0">✓</span>{t}</li>
              ))}
            </ul>
          </div>

          {err && <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-3 mb-4 text-sm text-red-200">{err}</div>}

          <button onClick={handleUnlock} disabled={unlocking}
            className="w-full py-3.5 rounded-2xl font-black text-base bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-400 hover:to-indigo-400 text-white transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed">
            {unlocking ? <span className="flex items-center justify-center gap-2"><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Processing…</span> : 'Pay ₹50 & Unlock Feature'}
          </button>
          <p className="text-center text-xs text-white/30 mt-2">Secured by Razorpay · One-time unlock</p>
        </div>
      </div>
    </div>
  );
}

// ─── Interviewer Picker Modal — 2 steps ───────────────────────────────────────
// Step 1: Pick interviewer  |  Step 2: Fill booking form
function InterviewerPickerModal({
  interviewers,
  onBook,
  onClose,
  submitting,
  error,
}: {
  interviewers: Interviewer[];
  onBook: (interviewerId: number | null, form: BookingForm) => void;
  onClose: () => void;
  submitting: boolean;
  error: string;
}) {
  const [step, setStep]         = useState<1 | 2>(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [search, setSearch]     = useState('');

  const minDateTime = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const [form, setForm] = useState<BookingForm>({
    role: '',
    difficulty: '',
    interviewType: '',
    scheduledTime: '',
  });
  const [roleOption, setRoleOption] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [formError, setFormError] = useState('');

  const filtered = interviewers.filter((iv) => {
    const q = search.toLowerCase();
    return iv.name.toLowerCase().includes(q) || iv.companies.some((c) => c.toLowerCase().includes(q)) || iv.rolesSupported.some((r) => r.toLowerCase().includes(q));
  });

  const selectedInterviewer = interviewers.find((iv) => iv.id === selected);

  const handleNext = () => {
    if (selected === null) return;
    setStep(2);
  };

  const handleNoPreference = () => {
    // Skip to form without selecting interviewer
    setSelected(null);
    setStep(2);
  };

  const handleSubmit = () => {
    setFormError('');
    const selectedRole = roleOption === 'Other' ? customRole.trim() : roleOption;
    if (!selectedRole) {
      setFormError('Please select a target role or enter a custom role.');
      return;
    }
    if (roleOption === 'Other' && !customRole.trim()) {
      setFormError('Please enter a custom role.');
      return;
    }
    if (!form.difficulty)    { setFormError('Please select a difficulty level.'); return; }
    if (!form.interviewType) { setFormError('Please select an interview type.');   return; }
    if (!form.scheduledTime) { setFormError('Please select a preferred date & time.'); return; }
    const chosenTime = new Date(form.scheduledTime);
    if (chosenTime <= new Date()) { setFormError('Please select a future date and time.'); return; }

    onBook(selected, {
      ...form,
      role: selectedRole,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(6px)', backgroundColor: 'rgba(15,10,40,0.55)' }}
      onClick={onClose}>
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        <div className="h-1 w-full bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400" />

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              {step === 2 && (
                <button onClick={() => setStep(1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all text-sm font-bold">←</button>
              )}
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  {step === 1 ? 'Pick Your Interviewer' : 'Booking Details'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {step === 1
                    ? 'Select an interviewer to continue'
                    : selectedInterviewer
                      ? `Booking with ${selectedInterviewer.name} · ${selectedInterviewer.companies[0] ?? ''}`
                      : 'No preference — admin will assign best match'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-white transition-all text-lg font-bold">✕</button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-5">
            <div className={`flex-1 h-1.5 rounded-full ${step >= 1 ? 'bg-violet-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
            <div className={`flex-1 h-1.5 rounded-full ${step >= 2 ? 'bg-violet-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
          </div>

          {/* ── Step 1: Choose interviewer ── */}
          {step === 1 && (
            <>
              <input type="text" placeholder="Search by name, company, or role…" value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 mb-4 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white dark:bg-slate-900/80" />

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 mb-5">
                {filtered.length === 0 && <p className="text-center text-slate-400 text-sm py-6">No interviewers match your search.</p>}
                {filtered.map((iv) => {
                  const isSel = selected === iv.id;
                  return (
                    <button key={iv.id} onClick={() => setSelected(isSel ? null : iv.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all ${isSel ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10' : 'border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:border-slate-300 dark:hover:border-white/20 hover:bg-white dark:hover:bg-white/[0.07]'}`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${isSel ? 'bg-violet-500 text-white' : 'bg-gradient-to-br from-indigo-400 to-violet-500 text-white'}`}>
                        {iv.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{iv.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{iv.companies.slice(0, 2).join(' · ')}{iv.yearsOfExperience ? ` · ${iv.yearsOfExperience}y exp` : ''}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {iv.rolesSupported.slice(0, 3).map((r) => (
                            <span key={r} className="text-[10px] px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 rounded-full">{r}</span>
                          ))}
                        </div>
                      </div>
                      {isSel && <span className="text-violet-500 text-xl shrink-0">✓</span>}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button onClick={handleNoPreference} className="flex-1 py-3 rounded-2xl font-bold text-sm border-2 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                  No Preference
                </button>
                <button onClick={handleNext} disabled={selected === null}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-400 hover:to-indigo-400 transition-all shadow disabled:opacity-50 disabled:cursor-not-allowed">
                  Next: Fill Details →
                </button>
              </div>
            </>
          )}

          {/* ── Step 2: Booking form ── */}
          {step === 2 && (
            <>
              {/* Selected interviewer summary */}
              {selectedInterviewer && (
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-400/20 mb-5">
                  <div className="w-9 h-9 rounded-xl bg-violet-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {selectedInterviewer.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white text-sm">{selectedInterviewer.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{selectedInterviewer.companies.slice(0, 2).join(' · ')}</p>
                  </div>
                  <span className="text-violet-500 text-lg">✓</span>
                </div>
              )}

              <div className="space-y-4">
                {/* Target Role */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Target Role</label>
                  <select
                    value={roleOption}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRoleOption(val);
                      if (val === 'Other') {
                        setCustomRole('');
                        setForm((prev) => ({ ...prev, role: '' }));
                      } else {
                        setCustomRole('');
                        setForm((prev) => ({ ...prev, role: val }));
                      }
                    }}
                    className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white dark:bg-slate-900/80"
                  >
                    <option value="">Select a role</option>
                    {TARGET_ROLES.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                  {roleOption === 'Other' && (
                    <input
                      type="text"
                      value={customRole}
                      onChange={(e) => {
                        setCustomRole(e.target.value);
                        setForm((prev) => ({ ...prev, role: e.target.value }));
                      }}
                      autoFocus
                      placeholder="Please describe your target role…"
                      className="mt-2 w-full border border-indigo-300 dark:border-indigo-400/30 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white dark:bg-slate-900/80"
                    />
                  )}
                </div>

                {/* Difficulty + Interview Type */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Difficulty Level</label>
                    <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                      className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white dark:bg-slate-900/80">
                      <option value="">Select…</option>
                      <option value="INTERN">Intern</option>
                      <option value="ENTRY">Entry</option>
                      <option value="MID">Mid</option>
                      <option value="SENIOR">Senior</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Interview Type</label>
                    <select value={form.interviewType} onChange={(e) => setForm({ ...form, interviewType: e.target.value })}
                      className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white dark:bg-slate-900/80">
                      <option value="">Select…</option>
                      <option value="TECHNICAL">Technical</option>
                      <option value="HR">HR / Behavioral</option>
                      <option value="MIXED">Mixed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Preferred Date & Time</label>
                  <input
                    type="datetime-local"
                    value={form.scheduledTime}
                    min={minDateTime}
                    onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })}
                    className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white dark:bg-slate-900/80"
                  />
                </div>
              </div>

              {(formError || error) && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-400/20 rounded-xl p-3 mt-4 text-sm text-red-700 dark:text-red-300">{formError || error}</div>
              )}

              <button onClick={handleSubmit} disabled={submitting}
                className="w-full mt-5 py-3.5 rounded-2xl font-bold text-sm bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-400 hover:to-indigo-400 transition-all shadow disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Submitting…
                  </span>
                ) : 'Submit Request to Admin'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BookInterviewPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    role: '',
    difficulty: '',
    interviewType: '',
    scheduledTime: '',
  });

  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');

  const [plan, setPlan] = useState<{
    planType: 'FREE' | 'PRO';
    interviewsUsed: number;
    interviewsLimit: number;
    planExpiresAt: string | null;
    preferredInterviewerUnlocked: boolean;
  } | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  const [roleOption, setRoleOption] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [studentLevel, setStudentLevel] = useState<'INTERN' | 'ENTRY' | 'MID' | 'SENIOR' | null>(null);
  const [levelWarning, setLevelWarning] = useState('');

  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [manualError, setManualError]         = useState('');

  useEffect(() => { fetchPlan(); fetchInterviewers(); }, []);

  const fetchPlan = async () => {
    try {
      const res = await fetch('/api/student/profile');
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setPlan({
            planType:                     data.profile.planType,
            interviewsUsed:               data.profile.interviewsUsed,
            interviewsLimit:              data.profile.interviewsLimit,
            planExpiresAt:                data.profile.planExpiresAt,
            preferredInterviewerUnlocked: data.profile.preferredInterviewerUnlocked ?? false,
          });
          setLimitReached(data.profile.interviewsUsed >= data.profile.interviewsLimit);
          setStudentLevel(detectStudentLevel(data.profile));
        }
      }
    } catch (e) { console.error('Failed to load plan:', e); }
    finally { setLoading(false); }
  };

  const fetchInterviewers = async () => {
    try {
      const res = await fetch('/api/student/interviewers');
      if (res.ok) {
        const data = await res.json();
        setInterviewers(data.interviewers || []);
      }
    } catch (e) { console.error('Failed to load interviewers:', e); }
  };

  const handlePaymentSuccess = () => { fetchPlan(); setLimitReached(false); };

  // ── FREE: Auto-assign ─────────────────────────────────────────────────────
  const handleAutoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const selectedRole = roleOption === 'Other' ? customRole.trim() : roleOption;
    if (!selectedRole) { setError('Please select a target role or specify one.'); return; }
    if (roleOption === 'Other' && !customRole.trim()) { setError('Please enter a custom role for Other.'); return; }
    if (!formData.difficulty)    { setError('Please select a difficulty level.'); return; }
    if (!formData.interviewType) { setError('Please select an interview type.');   return; }
    if (!formData.scheduledTime) { setError('Please select a preferred date and time.'); return; }

    const chosenTime = new Date(formData.scheduledTime);
    if (chosenTime <= new Date()) { setError('Please select a future date and time.'); return; }

    if (studentLevel && formData.difficulty && LEVEL_RANK[formData.difficulty] > LEVEL_RANK[studentLevel]) {
      setLevelWarning('Selected level is higher than your detected experience level. We recommend adjusting for best match.');
    } else {
      setLevelWarning('');
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/student/book/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedRole,
          difficulty: formData.difficulty,
          interviewType: formData.interviewType,
          scheduledTime: chosenTime.toISOString(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Interview booked with ${data.assignedInterviewer?.name ?? 'an interviewer'}!`);
        router.push('/student/sessions');
      } else if (data.error === 'LIMIT_REACHED') {
        setLimitReached(true);
        setPlan((prev) => prev ? { ...prev, interviewsUsed: data.used, interviewsLimit: data.limit, planType: data.planType } : prev);
      } else {
        setError(data.error || 'Failed to book interview. Please try again.');
      }
    } catch { setError('An error occurred. Please try again.'); }
    finally { setSubmitting(false); }
  };

  // ── PAID: Open unlock or picker ───────────────────────────────────────────
  const handlePreferredClick = () => {
    if (!plan?.preferredInterviewerUnlocked) {
      setShowUnlockModal(true);
    } else {
      setShowPickerModal(true);
    }
  };

  const handleUnlocked = () => {
    setShowUnlockModal(false);
    fetchPlan();
    setTimeout(() => setShowPickerModal(true), 300);
  };

  // ── PAID: Submit with interviewer + form data ─────────────────────────────
  const handleManualBook = async (preferredInterviewerId: number | null, form: BookingForm) => {
    setManualError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/student/book/manual-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferredInterviewerId,
          topic:         form.role || null,
          role:          form.role || null,
          difficulty:    form.difficulty || null,
          interviewType: form.interviewType || null,
          sessionType:   'INTERVIEW',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowPickerModal(false);
        alert('Request submitted! Admin will assign your interviewer soon. Check your email for confirmation.');
        router.push('/student/sessions');
      } else {
        setManualError(data.error || 'Failed to submit request.');
      }
    } catch { setManualError('An error occurred. Please try again.'); }
    finally { setSubmitting(false); }
  };

  const minDateTime = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (limitReached && plan) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white mb-2">Book Mock Interview</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6 text-sm sm:text-base">We'll automatically match you with the best available interviewer.</p>
        <PaymentGate planType={plan.planType} used={plan.interviewsUsed} limit={plan.interviewsLimit} sessionType="interview" onPaymentSuccessAction={handlePaymentSuccess} />
      </div>
    );
  }

  return (
    <>
      {showUnlockModal && (
        <UnlockModal onClose={() => setShowUnlockModal(false)} onUnlocked={handleUnlocked} interviewers={interviewers} />
      )}
      {showPickerModal && (
        <InterviewerPickerModal
          interviewers={interviewers}
          onBook={handleManualBook}
          onClose={() => { setShowPickerModal(false); setManualError(''); }}
          submitting={submitting}
          error={manualError}
        />
      )}

      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white mb-1 sm:mb-2">Book Mock Interview</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-4 sm:mb-6 text-sm sm:text-base">Auto-assign or choose your preferred interviewer.</p>

        {plan && (
          <UsageBanner planType={plan.planType} used={plan.interviewsUsed} limit={plan.interviewsLimit} sessionType="interview" planExpiresAt={plan.planExpiresAt} />
        )}

        {/* ── Mode selector ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="rounded-2xl border-2 border-indigo-200 dark:border-indigo-400/20 bg-indigo-50 dark:bg-indigo-500/10 p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-indigo-800 dark:text-indigo-200 text-sm">Auto-Assign</span>
              <span className="ml-auto text-xs px-2 py-0.5 bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 rounded-full font-semibold">FREE</span>
            </div>
            <p className="text-xs text-indigo-600 dark:text-indigo-300">Our algorithm picks the best available interviewer for you instantly.</p>
          </div>

          <button onClick={handlePreferredClick} className="rounded-2xl border-2 border-violet-200 dark:border-violet-400/20 bg-violet-50 dark:bg-violet-500/10 p-4 text-left hover:border-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/15 transition-all">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-violet-800 dark:text-violet-200 text-sm">Choose Interviewer</span>
              {plan?.preferredInterviewerUnlocked ? (
                <span className="ml-auto text-xs px-2 py-0.5 bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300 rounded-full font-semibold">✓ Unlocked</span>
              ) : (
                <span className="ml-auto text-xs px-2 py-0.5 bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 rounded-full font-semibold">🔒 ₹50</span>
              )}
            </div>
            <p className="text-xs text-violet-600 dark:text-violet-300">
              {plan?.preferredInterviewerUnlocked ? 'Pick any approved interviewer. Admin will confirm your slot.' : 'Unlock once to browse & choose a company-specific interviewer.'}
            </p>
          </button>
        </div>

        {/* ── Auto-assign form ── */}
        <Card variant="elevated" className="theme-surface-card p-4 sm:p-6 lg:p-8">
          <form onSubmit={handleAutoSubmit} className="space-y-4 sm:space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Target Role</label>
              <select
                value={roleOption}
                onChange={(e) => {
                  const val = e.target.value;
                  setRoleOption(val);
                  if (val !== 'Other') {
                    setCustomRole('');
                    setFormData((prev) => ({ ...prev, role: val }));
                  } else {
                    setFormData((prev) => ({ ...prev, role: '' }));
                  }
                }}
                className="w-full border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white dark:bg-slate-900/80"
                required
              >
                <option value="">Select a role</option>
                {TARGET_ROLES.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>

              {roleOption === 'Other' && (
                <input
                  type="text"
                  placeholder="Please describe your target role…"
                  value={customRole}
                  autoFocus
                  onChange={(e) => {
                    setCustomRole(e.target.value);
                    setFormData((prev) => ({ ...prev, role: e.target.value }));
                  }}
                  className="mt-2 w-full border border-indigo-300 dark:border-indigo-400/30 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white dark:bg-slate-900/80"
                  required
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <Select label="Difficulty Level" value={formData.difficulty} onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                options={INTERVIEW_DIFFICULTIES} />
              <Select label="Interview Type" value={formData.interviewType} onChange={(e) => setFormData({ ...formData, interviewType: e.target.value })}
                options={[{ value: 'TECHNICAL', label: 'Technical' }, { value: 'HR', label: 'HR / Behavioral' }, { value: 'MIXED', label: 'Mixed (Technical + HR)' }]} />
            </div>

            <div>
              <Input
                label="Preferred Date & Time"
                type="datetime-local"
                value={formData.scheduledTime}
                min={minDateTime}
                onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                required
              />
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-400/20 rounded-xl p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-indigo-900 dark:text-indigo-200">
                <strong>Auto-Assignment:</strong> Clicking the button below uses our algorithm to instantly match you. To choose your own interviewer, click the <strong>🎯 Choose Interviewer</strong> card above.
              </p>
            </div>

            {levelWarning && <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-400/20 rounded-xl p-3 sm:p-4"><p className="text-xs sm:text-sm text-amber-800 dark:text-amber-200">{levelWarning}</p></div>}
            {error && <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-400/20 rounded-xl p-3 sm:p-4"><p className="text-xs sm:text-sm text-red-800 dark:text-red-200">{error}</p></div>}

            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                  Finding best interviewer…
                </span>
              ) : 'Book Interview (Auto-Assign)'}
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
