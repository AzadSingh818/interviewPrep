'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { apiFetch } from '@/lib/api-client';

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
      const res = await apiFetch('/api/ai/feedback', {
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
        className="inline-flex min-h-11 items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap
                   bg-gradient-to-r from-violet-500 to-indigo-500 text-white
                   hover:from-violet-600 hover:to-indigo-600
                   disabled:opacity-60 disabled:cursor-not-allowed
                   transition-all shadow-sm hover:shadow-md hover:shadow-indigo-200
                   active:scale-[0.98] touch-manipulation select-none"
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

// ─── Simple Markdown Formatter ───────────────────────────────────────────────
function renderMarkdown(text: string) {
  if (!text) return null;

  const lines = text.split('\n');
  return (
    <div className="space-y-3">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        // Header level 4 (e.g. ### Header or #### Header or 1. **Header**)
        if (trimmed.startsWith('####') || trimmed.startsWith('###')) {
          const headerText = trimmed.replace(/^####?\s*/, '');
          return (
            <h4 key={idx} className="text-xs font-bold text-slate-800 uppercase tracking-wide mt-4 mb-1.5 first:mt-0">
              {parseBoldText(headerText)}
            </h4>
          );
        }
        // Header level 3
        if (trimmed.startsWith('##') || trimmed.startsWith('#')) {
          const headerText = trimmed.replace(/^##?\s*/, '');
          return (
            <h3 key={idx} className="text-sm font-bold text-slate-900 mt-5 mb-2 border-b pb-1 border-slate-100 first:mt-0">
              {parseBoldText(headerText)}
            </h3>
          );
        }

        // Bullet points
        if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*')) {
          const content = trimmed.replace(/^[-•*]\s*/, '');
          return (
            <div key={idx} className="flex items-start gap-1.5 text-xs text-slate-600 pl-1 py-0.5">
              <span className="text-violet-500 mt-1 shrink-0">•</span>
              <span className="leading-relaxed">{parseBoldText(content)}</span>
            </div>
          );
        }

        // Ordered/numbered items
        if (/^\d+\.\s+/.test(trimmed)) {
          const content = trimmed.replace(/^\d+\.\s+/, '');
          const matchNum = trimmed.match(/^(\d+)\./);
          const num = matchNum ? matchNum[1] : '1';
          return (
            <div key={idx} className="flex items-start gap-1.5 text-xs text-slate-600 pl-1 py-0.5">
              <span className="text-violet-600 font-bold mt-0.5 shrink-0 text-[10px]">{num}.</span>
              <span className="leading-relaxed">{parseBoldText(content)}</span>
            </div>
          );
        }

        // Paragraph
        return (
          <p key={idx} className="text-xs text-slate-600 leading-relaxed py-0.5">
            {parseBoldText(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

function parseBoldText(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold text-slate-800">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function InterviewerFeedbackPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const sessionId = params.sessionId;
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [aiReport, setAiReport] = useState<any>(null);
  const [aiReportLoading, setAiReportLoading] = useState(true);
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

  useEffect(() => {
    fetchSession();
    fetchAIReport();
  }, [sessionId]);

  const fetchSession = async () => {
    try {
      const res = await apiFetch('/api/interviewer/sessions');
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

  const fetchAIReport = async () => {
    setAiReportLoading(true);
    try {
      const res = await apiFetch(`/api/ai/monitor?sessionId=${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setAiReport(data.report);
      }
    } catch (error) {
      console.error('Failed to fetch AI report:', error);
    } finally {
      setAiReportLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, sessionType: session.sessionType, ...formData }),
      });
      if (res.ok) {
        toast('Feedback submitted successfully!', 'success');
        router.push('/interviewer/sessions');
      } else {
        const data = await res.json();
        toast(data.error || 'Failed to submit feedback', 'error');
      }
    } catch (error) {
      toast('An error occurred. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const setField = (field: string) => (val: string) =>
    setFormData((prev: any) => ({ ...prev, [field]: val }));

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-1 sm:px-4 animate-pulse py-4">
        <div className="h-8 w-52 bg-slate-200 rounded-lg mb-3" />
        <div className="h-4 w-72 bg-slate-200 rounded mb-6" />
        <div className="h-16 w-full bg-slate-200 rounded-xl mb-6" />
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-8 space-y-4">
          <div className="h-5 w-36 bg-slate-200 rounded" />
          <div className="h-24 w-full bg-slate-200 rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-11 bg-slate-200 rounded-xl" />
            <div className="h-11 bg-slate-200 rounded-xl" />
            <div className="h-11 bg-slate-200 rounded-xl" />
            <div className="h-11 bg-slate-200 rounded-xl" />
          </div>
          <div className="h-24 w-full bg-slate-200 rounded-xl" />
          <div className="h-11 w-full bg-slate-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!session) return <div className="text-center py-12 text-slate-500">Session not found</div>;

  const isGuidance = session.sessionType === 'GUIDANCE';

  return (
    <div className="max-w-6xl mx-auto px-1 sm:px-4 py-4">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 mb-2">Submit Feedback</h1>
        <p className="text-slate-600 text-sm sm:text-base break-words">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2">
          <Card variant="elevated" className="p-5 sm:p-8">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        <div className="lg:col-span-1 space-y-6">
          <Card className="p-5 border border-slate-200 bg-gradient-to-b from-white to-slate-50/50 shadow-sm rounded-2xl">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-sm shrink-0">
                <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">AI Assistant Insights</h3>
                <p className="text-[10px] text-slate-400">Student Mistakes & Feedback</p>
              </div>
            </div>

            {aiReportLoading ? (
              <div className="space-y-3 py-2">
                <div className="h-4 w-3/4 bg-slate-100 rounded animate-pulse" />
                <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
                <div className="h-3 w-5/6 bg-slate-100 rounded animate-pulse" />
                <div className="h-3 w-2/3 bg-slate-100 rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-slate-100 rounded animate-pulse mt-4" />
                <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
                <div className="h-3 w-4/5 bg-slate-100 rounded animate-pulse" />
              </div>
            ) : aiReport?.studentReport ? (
              <div className="max-h-[550px] overflow-y-auto pr-1">
                {renderMarkdown(aiReport.studentReport)}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  No automated AI assessment found for this session. Use the standard ratings and textboxes on the left to submit feedback.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
