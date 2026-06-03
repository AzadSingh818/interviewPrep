import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

interface FeedbackFormProps {
  sessionType: 'GUIDANCE' | 'INTERVIEW';
  sessionId: number;
  onSubmit: (data: any) => Promise<void>;
  onCancel?: () => void;
}

export function FeedbackForm({ sessionType, sessionId, onSubmit, onCancel }: FeedbackFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    summary: '',
    // Guidance fields
    strengths: '',
    recommendations: '',
    actionItems: '',
    // Interview fields
    technicalDepth: '3',
    problemSolving: '3',
    communication: '3',
    confidence: '3',
    overallComments: '',
    hiringRecommendation: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({ sessionId, sessionType, ...formData });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Summary - Common for both */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Summary
        </label>
        <textarea
          className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
          rows={4}
          value={formData.summary}
          onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
          placeholder="Provide a brief summary of the session"
          required
        />
      </div>

      {sessionType === 'GUIDANCE' ? (
        <>
          {/* Guidance-specific fields */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Strengths
            </label>
            <textarea
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
              rows={3}
              value={formData.strengths}
              onChange={(e) => setFormData({ ...formData, strengths: e.target.value })}
              placeholder="What did the student do well?"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Recommendations
            </label>
            <textarea
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
              rows={3}
              value={formData.recommendations}
              onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
              placeholder="What areas need improvement?"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Action Items
            </label>
            <textarea
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
              rows={3}
              value={formData.actionItems}
              onChange={(e) => setFormData({ ...formData, actionItems: e.target.value })}
              placeholder="Specific next steps for the student"
              required
            />
          </div>
        </>
      ) : (
        <>
          {/* Interview-specific fields */}
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Technical Depth (1-5)"
              value={formData.technicalDepth}
              onChange={(e) => setFormData({ ...formData, technicalDepth: e.target.value })}
              options={[
                { value: '1', label: '1 - Poor' },
                { value: '2', label: '2 - Below Average' },
                { value: '3', label: '3 - Average' },
                { value: '4', label: '4 - Good' },
                { value: '5', label: '5 - Excellent' },
              ]}
            />

            <Select
              label="Problem Solving (1-5)"
              value={formData.problemSolving}
              onChange={(e) => setFormData({ ...formData, problemSolving: e.target.value })}
              options={[
                { value: '1', label: '1 - Poor' },
                { value: '2', label: '2 - Below Average' },
                { value: '3', label: '3 - Average' },
                { value: '4', label: '4 - Good' },
                { value: '5', label: '5 - Excellent' },
              ]}
            />

            <Select
              label="Communication (1-5)"
              value={formData.communication}
              onChange={(e) => setFormData({ ...formData, communication: e.target.value })}
              options={[
                { value: '1', label: '1 - Poor' },
                { value: '2', label: '2 - Below Average' },
                { value: '3', label: '3 - Average' },
                { value: '4', label: '4 - Good' },
                { value: '5', label: '5 - Excellent' },
              ]}
            />

            <Select
              label="Confidence (1-5)"
              value={formData.confidence}
              onChange={(e) => setFormData({ ...formData, confidence: e.target.value })}
              options={[
                { value: '1', label: '1 - Poor' },
                { value: '2', label: '2 - Below Average' },
                { value: '3', label: '3 - Average' },
                { value: '4', label: '4 - Good' },
                { value: '5', label: '5 - Excellent' },
              ]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Overall Comments
            </label>
            <textarea
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
              rows={4}
              value={formData.overallComments}
              onChange={(e) => setFormData({ ...formData, overallComments: e.target.value })}
              placeholder="Provide detailed feedback on the candidate's performance"
              required
            />
          </div>

          <Select
            label="Hiring Recommendation"
            value={formData.hiringRecommendation}
            onChange={(e) => setFormData({ ...formData, hiringRecommendation: e.target.value })}
            options={[
              { value: 'STRONG_HIRE', label: 'Strong Hire - Exceptional candidate' },
              { value: 'HIRE', label: 'Hire - Good candidate' },
              { value: 'WEAK_HIRE', label: 'Weak Hire - Borderline' },
              { value: 'NO_HIRE', label: 'No Hire - Not ready' },
            ]}
          />
        </>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button type="submit" className="flex-1" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit Feedback'}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}