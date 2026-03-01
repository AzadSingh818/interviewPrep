'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';

// ─── AI Assist Button ─────────────────────────────────────────────────────────
function AIAssistButton({
  field,
  session,
  formData,
  onGenerated,
}: {
  field: string;
  session: any;
  formData: any;
  onGenerated: (text: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClick = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, session, formData }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Generation failed');

      onGenerated(data.text);
    } catch (err: any) {
      const msg = err.message || 'AI generation failed. Please try again.';
      setError(msg);
      setTimeout(() => setError(''), 4000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded-md border border-red-100">
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                   bg-gradient-to-r from-violet-500 to-indigo-500 text-white
                   hover:from-violet-600 hover:to-indigo-600
                   disabled:opacity-60 disabled:cursor-not-allowed
                   transition-all shadow-sm hover:shadow-md hover:shadow-indigo-200
                   active:scale-95 select-none"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating...
          </>
        ) : (
          <>
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            AI Assist
          </>
        )}
      </button>
    </div>
  );
}

// ─── Textarea with AI assist ──────────────────────────────────────────────────
function AITextarea({
  label, field, value, rows, required, placeholder,
  session, formData, onChange,
}: {
  label: string; field: string; value: string; rows: number;
  required?: boolean; placeholder?: string;
  session: any; formData: any; onChange: (val: string) => void;
}) {
  const [justGenerated, setJustGenerated] = useState(false);

  const handleGenerated = (text: string) => {
    onChange(text);
    setJustGenerated(true);
    setTimeout(() => setJustGenerated(false), 2500);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <AIAssistButton field={field} session={session} formData={formData} onGenerated={handleGenerated} />
      </div>
      <div className="relative">
        <textarea
          className={`w-full px-4 py-3 rounded-xl border-2 transition-all duration-300 resize-none
            focus:ring-4 focus:outline-none
            ${justGenerated
              ? 'border-violet-400 bg-violet-50/40 focus:border-violet-500 focus:ring-violet-500/10'
              : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/10'}`}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
        />
        {justGenerated && (
          <div className="absolute top-2.5 right-3 flex items-center gap-1 px-2.5 py-1
                          bg-violet-100 text-violet-700 rounded-full text-xs font-semibold
                          border border-violet-200 shadow-sm animate-pulse pointer-events-none">
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            AI Generated
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InterviewerFeedbackPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId;
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<any>({
    summary: '',
    strengths: '',
    recommendations: '',
    actionItems: '',
    technicalDepth: '3',
    problemSolving: '3',
    communication: '3',
    confidence: '3',
    overallComments: '',
    hiringRecommendation: '',
  });

  useEffect(() => { fetchSession(); }, [sessionId]);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/interviewer/sessions');
      if (res.ok) {
        const data = await res.json();
        const foundSession = data.sessions.find((s: any) => s.id === parseInt(sessionId as string));
        setSession(foundSession);
      }
    } catch (error) {
      console.error('Failed to fetch session:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, sessionType: session.sessionType, ...formData }),
      });
      if (res.ok) {
        alert('Feedback submitted successfully!');
        router.push('/interviewer/sessions');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to submit feedback');
      }
    } catch (error) {
      alert('An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const setField = (field: string) => (val: string) =>
    setFormData((prev: any) => ({ ...prev, [field]: val }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-slate-500">
          <svg className="animate-spin h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading session...
        </div>
      </div>
    );
  }

  if (!session) return <div className="text-center py-12 text-slate-500">Session not found</div>;

  const isGuidance = session.sessionType === 'GUIDANCE';

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">Submit Feedback</h1>
        <p className="text-slate-600">
          For <span className="font-semibold text-slate-800">{session.student.name}</span>'s{' '}
          {isGuidance ? 'guidance' : 'interview'} session
        </p>
      </div>

      {/* AI Assist info banner */}
      <div className="mb-6 flex items-start gap-3 px-4 py-3.5 rounded-xl
                      bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200/70">
        <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg
                        bg-gradient-to-br from-violet-500 to-indigo-500
                        flex items-center justify-center shadow-sm">
          <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-violet-800">AI Assist Available</p>
          <p className="text-xs text-violet-600 mt-0.5 leading-relaxed">
            Click the <span className="font-bold">✦ AI Assist</span> button next to any field
            to get an AI-generated suggestion based on the session context.
            You can freely edit the suggestion afterwards.
          </p>
        </div>
      </div>

      <Card variant="elevated" className="p-8">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Summary — common */}
          <AITextarea label="Summary" field="summary" value={formData.summary}
            rows={4} required placeholder="Provide a brief summary of the session..."
            session={session} formData={formData} onChange={setField('summary')} />

          {isGuidance ? (
            <>
              <AITextarea label="Strengths" field="strengths" value={formData.strengths}
                rows={3} required placeholder="What did the student do well?"
                session={session} formData={formData} onChange={setField('strengths')} />

              <AITextarea label="Recommendations" field="recommendations" value={formData.recommendations}
                rows={3} required placeholder="What areas need improvement?"
                session={session} formData={formData} onChange={setField('recommendations')} />

              <AITextarea label="Action Items" field="actionItems" value={formData.actionItems}
                rows={3} required placeholder="What specific steps should the student take next?"
                session={session} formData={formData} onChange={setField('actionItems')} />
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Select label="Technical Depth (1-5)" value={formData.technicalDepth}
                  onChange={(e) => setFormData({ ...formData, technicalDepth: e.target.value })}
                  options={[
                    { value: '1', label: '1 - Poor' }, { value: '2', label: '2 - Below Average' },
                    { value: '3', label: '3 - Average' }, { value: '4', label: '4 - Good' },
                    { value: '5', label: '5 - Excellent' },
                  ]} />
                <Select label="Problem Solving (1-5)" value={formData.problemSolving}
                  onChange={(e) => setFormData({ ...formData, problemSolving: e.target.value })}
                  options={[
                    { value: '1', label: '1 - Poor' }, { value: '2', label: '2 - Below Average' },
                    { value: '3', label: '3 - Average' }, { value: '4', label: '4 - Good' },
                    { value: '5', label: '5 - Excellent' },
                  ]} />
                <Select label="Communication (1-5)" value={formData.communication}
                  onChange={(e) => setFormData({ ...formData, communication: e.target.value })}
                  options={[
                    { value: '1', label: '1 - Poor' }, { value: '2', label: '2 - Below Average' },
                    { value: '3', label: '3 - Average' }, { value: '4', label: '4 - Good' },
                    { value: '5', label: '5 - Excellent' },
                  ]} />
                <Select label="Confidence (1-5)" value={formData.confidence}
                  onChange={(e) => setFormData({ ...formData, confidence: e.target.value })}
                  options={[
                    { value: '1', label: '1 - Poor' }, { value: '2', label: '2 - Below Average' },
                    { value: '3', label: '3 - Average' }, { value: '4', label: '4 - Good' },
                    { value: '5', label: '5 - Excellent' },
                  ]} />
              </div>

              <AITextarea label="Overall Comments" field="overallComments" value={formData.overallComments}
                rows={4} required placeholder="Provide detailed feedback on the candidate's overall performance..."
                session={session} formData={formData} onChange={setField('overallComments')} />

              <Select label="Hiring Recommendation" value={formData.hiringRecommendation}
                onChange={(e) => setFormData({ ...formData, hiringRecommendation: e.target.value })}
                options={[
                  { value: 'STRONG_HIRE', label: 'Strong Hire' }, { value: 'HIRE', label: 'Hire' },
                  { value: 'WEAK_HIRE', label: 'Weak Hire' }, { value: 'NO_HIRE', label: 'No Hire' },
                ]} />
            </>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </form>
      </Card>
    </div>
  );
}