'use client';

import { useEffect } from 'react';

export default function StudentInterviewRoomError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Student interview room error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4 text-white">
      <div className="max-w-md w-full rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
        <h2 className="text-lg font-bold">Interview room error</h2>
        <p className="mt-2 text-sm text-red-100">
          The interview room could not recover automatically. Please try reloading the room.
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

