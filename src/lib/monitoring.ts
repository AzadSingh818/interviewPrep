/**
 * monitoring.ts
 *
 * Structured error capture + logging for InterviewPrep Live.
 *
 * Current implementation: structured JSON to console (stdout) so that
 * Vercel/Railway log aggregators can parse fields like route, userId, etc.
 *
 * To add Sentry in the future:
 *   1. `npm install @sentry/nextjs`
 *   2. Uncomment the Sentry blocks below and run `npx @sentry/wizard -i nextjs`
 *   3. Remove or keep the console fallback — they can co-exist.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ErrorContext = {
  route?: string;
  /** Pass userId as a number; it will be logged as a string to avoid PII leakage. */
  userId?: number;
  orderId?: string;
  paymentId?: string;
  sessionId?: number;
  eventType?: string;
  [key: string]: unknown;
};

export type EventContext = {
  route?: string;
  userId?: number;
  [key: string]: unknown;
};

// ─── Core helpers ─────────────────────────────────────────────────────────────

/**
 * Capture and log an error with structured context.
 * Use this instead of bare `console.error` for any production-relevant failure.
 *
 * @example
 * captureError(err, { route: '/api/webhooks/razorpay', orderId });
 */
export function captureError(error: unknown, context: ErrorContext = {}): void {
  const { userId, ...rest } = context;

  const entry = {
    level: 'error',
    timestamp: new Date().toISOString(),
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    // Sanitize userId: convert to string so it can be cross-referenced
    // in logs without being treated as a PII field by log scanners.
    userId: userId !== undefined ? String(userId) : undefined,
    ...rest,
  };

  console.error(JSON.stringify(entry));

  // ── Sentry (uncomment after adding @sentry/nextjs) ────────────────────────
  // import * as Sentry from '@sentry/nextjs';
  // Sentry.withScope((scope) => {
  //   if (userId !== undefined) scope.setUser({ id: String(userId) });
  //   Object.entries(rest).forEach(([k, v]) => scope.setExtra(k, v));
  //   Sentry.captureException(error);
  // });
  // ─────────────────────────────────────────────────────────────────────────
}

/**
 * Log a structured warning (non-fatal).
 */
export function captureWarning(message: string, context: EventContext = {}): void {
  const { userId, ...rest } = context;

  const entry = {
    level: 'warn',
    timestamp: new Date().toISOString(),
    message,
    userId: userId !== undefined ? String(userId) : undefined,
    ...rest,
  };

  console.warn(JSON.stringify(entry));
}

/**
 * Log a structured business metric / audit event (non-error).
 * Use for important state transitions: entitlement grants, webhook duplicates, etc.
 *
 * @example
 * captureEvent('payment.captured', { route: '/api/webhooks/razorpay', orderId, userId: student.userId });
 */
export function captureEvent(eventName: string, context: EventContext = {}): void {
  const { userId, ...rest } = context;

  const entry = {
    level: 'info',
    timestamp: new Date().toISOString(),
    event: eventName,
    userId: userId !== undefined ? String(userId) : undefined,
    ...rest,
  };

  console.log(JSON.stringify(entry));
}
