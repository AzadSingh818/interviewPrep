'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { useParams } from 'next/navigation';

// ─── Star Rating Component ────────────────────────────────────────────────────
function StarRating({
  value,
  onChange,
  readonly = false,
  size = 'md',
}: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [hovered, setHovered] = useState(0);
  const starSize = size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-lg' : 'text-2xl';

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= (hovered || value);
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onClick={() => !readonly && onChange?.(star)}
            onMouseEnter={() => !readonly && setHovered(star)}
            onMouseLeave={() => !readonly && setHovered(0)}
            className={`${starSize} transition-transform ${
              readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
            } ${filled ? 'text-amber-400' : 'text-slate-300'}`}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StudentFeedbackPage() {
  const params = useParams();
  const sessionId = params.sessionId;
  const [feedback, setFeedback]       = useState<any>(null);
  const [loading, setLoading]         = useState(true);

  // Rating state
  const [rating, setRating]           = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingSubmitted, setRatingSubmitted]   = useState(false);
  const [ratingError, setRatingError] = useState('');

  useEffect(() => { fetchFeedback(); }, [sessionId]);

  const fetchFeedback = async () => {
    try {
      const res = await fetch(`/api/feedback?sessionId=${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setFeedback(data.feedback);
        // If already rated, pre-fill
        if (data.feedback?.studentRating) {
          setRating(data.feedback.studentRating);
          setRatingComment(data.feedback.studentRatingComment || '');
          setRatingSubmitted(true);
        }
      }
    } catch (error) {
      console.error('Failed to fetch feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRating = async () => {
    if (rating === 0) {
      setRatingError('Please select a star rating.');
      return;
    }
    setRatingError('');
    setSubmittingRating(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          studentRating: rating,
          studentRatingComment: ratingComment,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRatingSubmitted(true);
      } else {
        setRatingError(data.error || 'Failed to submit rating.');
      }
    } catch {
      setRatingError('An error occurred. Please try again.');
    } finally {
      setSubmittingRating(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading feedback...</div>;
  }

  if (!feedback) {
    return <div className="text-center py-12">Feedback not found</div>;
  }

  const isGuidance = feedback.session.sessionType === 'GUIDANCE';

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">
        Session Feedback
      </h1>
      <p className="text-slate-600 mb-8">
        From your session with {feedback.session.interviewer.name}
      </p>

      <Card variant="elevated" className="p-8 mb-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Summary</h2>
          <p className="text-slate-700">{feedback.summary}</p>
        </div>

        {isGuidance ? (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Strengths</h2>
              <p className="text-slate-700 whitespace-pre-line">{feedback.strengths}</p>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Recommendations</h2>
              <p className="text-slate-700 whitespace-pre-line">{feedback.recommendations}</p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Action Items</h2>
              <p className="text-slate-700 whitespace-pre-line">{feedback.actionItems}</p>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-sm font-medium text-slate-500 mb-2">Technical Depth</h3>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full"
                      style={{ width: `${(feedback.technicalDepth / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-lg font-semibold text-slate-900">
                    {feedback.technicalDepth}/5
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-slate-500 mb-2">Problem Solving</h3>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-violet-600 h-2 rounded-full"
                      style={{ width: `${(feedback.problemSolving / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-lg font-semibold text-slate-900">
                    {feedback.problemSolving}/5
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-slate-500 mb-2">Communication</h3>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-pink-600 h-2 rounded-full"
                      style={{ width: `${(feedback.communication / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-lg font-semibold text-slate-900">
                    {feedback.communication}/5
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-slate-500 mb-2">Confidence</h3>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${(feedback.confidence / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-lg font-semibold text-slate-900">
                    {feedback.confidence}/5
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Overall Comments</h2>
              <p className="text-slate-700 whitespace-pre-line">{feedback.overallComments}</p>
            </div>

            <div className={`p-4 rounded-xl ${
              feedback.hiringRecommendation === 'STRONG_HIRE' ? 'bg-green-50 border border-green-200' :
              feedback.hiringRecommendation === 'HIRE' ? 'bg-blue-50 border border-blue-200' :
              feedback.hiringRecommendation === 'WEAK_HIRE' ? 'bg-amber-50 border border-amber-200' :
              'bg-red-50 border border-red-200'
            }`}>
              <h3 className="font-semibold text-slate-900 mb-1">Hiring Recommendation</h3>
              <p className="text-lg font-bold">{feedback.hiringRecommendation.replace('_', ' ')}</p>
            </div>
          </>
        )}
      </Card>

      {/* ── Rate the Interviewer ───────────────────────────────────────────── */}
      <Card variant="elevated" className="p-8">
        <h2 className="text-xl font-semibold text-slate-900 mb-1">
          Rate Your Interviewer
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          Your rating helps other students choose the best mentor.
        </p>

        {ratingSubmitted ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="text-5xl">🎉</div>
            <p className="text-lg font-semibold text-slate-900">Thank you for your rating!</p>
            <StarRating value={rating} readonly size="lg" />
            <p className="text-slate-500 text-sm">
              You rated {feedback.session.interviewer.name} <strong>{rating} out of 5</strong>
            </p>
            {ratingComment && (
              <p className="text-slate-600 text-sm italic mt-1">"{ratingComment}"</p>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Interviewer info */}
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
                {feedback.session.interviewer.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-slate-900">{feedback.session.interviewer.name}</p>
                <p className="text-xs text-slate-500">How was your experience?</p>
              </div>
            </div>

            {/* Stars */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Your Rating *</p>
              <StarRating value={rating} onChange={setRating} size="lg" />
              {rating > 0 && (
                <p className="text-sm text-slate-500 mt-1">
                  {rating === 1 ? 'Poor' : rating === 2 ? 'Fair' : rating === 3 ? 'Good' : rating === 4 ? 'Very Good' : 'Excellent'}
                </p>
              )}
            </div>

            {/* Optional comment */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Comment <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Share your experience with this interviewer..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:border-indigo-500 focus:outline-none resize-none"
              />
            </div>

            {ratingError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                ❌ {ratingError}
              </p>
            )}

            <button
              onClick={handleSubmitRating}
              disabled={submittingRating || rating === 0}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                rating === 0
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200'
              }`}
            >
              {submittingRating ? 'Submitting…' : 'Submit Rating'}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}