'use client';

import { useEffect } from 'react';

export default function InterviewerError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Interviewer route error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-400/20 dark:bg-red-500/10">
        <h2 className="text-lg font-bold text-red-900 dark:text-red-200">Something went wrong</h2>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">
          We could not load this interviewer page. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

