/**
 * monitoring.ts
 *
 * Structured error capture + logging for InterviewPrep Live.
 *
 * Sends to both:
 *   1. Structured JSON to console (stdout) — Vercel/Railway log aggregators parse route, userId, etc.
 *   2. Sentry (when SENTRY_AUTH_TOKEN is set) — for production error tracking and alerting
 */

import * as Sentry from '@sentry/nextjs';

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

  // ── Send to Sentry ────────────────────────────────────────────────────────
  Sentry.withScope((scope) => {
    if (userId !== undefined) scope.setUser({ id: String(userId) });
    Object.entries(rest).forEach(([k, v]) => scope.setExtra(k, v));
    Sentry.captureException(error);
  });
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

  // ── Send to Sentry as a custom event ───────────────────────────────────
  Sentry.captureMessage(`[BUSINESS_EVENT] ${eventName}`, {
    level: 'info',
    contexts: {
      custom: { ...rest },
    },
    ...(userId !== undefined && { user: { id: String(userId) } }),
  });
}
