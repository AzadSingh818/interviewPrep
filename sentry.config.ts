/**
 * sentry.config.ts
 *
 * Sentry configuration for InterviewPrep Live.
 * Automatically initializes on app startup when SENTRY_AUTH_TOKEN is set.
 */

import { getOptionalEnv } from '@/lib/env';

const SENTRY_DSN = getOptionalEnv('SENTRY_DSN', '');

/**
 * Sentry configuration for Next.js
 * Returns null if SENTRY_DSN is not configured (graceful degradation)
 */
export const getSentryConfig = () => {
  if (!SENTRY_DSN) return null;

  return {
    // ── Essentials ─────────────────────────────────────────────────────────
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    enabled: process.env.NODE_ENV === 'production', // Only send errors in production
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev
    debug: false,

    // ── Release tracking ───────────────────────────────────────────────────
    release: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',

    // ── Request filtering ──────────────────────────────────────────────────
    // Ignore health checks and non-critical routes
    ignoreErrors: [
      // Browser console errors (low signal-to-noise)
      'NetworkError',
      'TimeoutError',
      'Non-Error promise rejection captured',
      // Duplicate webhook processing (expected)
      'Webhook already processed',
    ],
    denyUrls: [
      // Ignore errors from browser extensions
      /extensions\//i,
      /^chrome:\/\//i,
    ],

    // ── Data scrubbing (PII removal) ───────────────────────────────────────
    beforeSend(event, hint) {
      // Remove sensitive fields from error context
      if (event.contexts?.custom) {
        const sensitive = ['password', 'token', 'secret', 'creditCard'];
        sensitive.forEach(field => {
          delete (event.contexts as any).custom[field];
        });
      }

      // Remove PII from user data
      if (event.user) {
        event.user = {
          id: event.user.id, // Keep only user ID
        };
      }

      return event;
    },

    // ── Integrations ───────────────────────────────────────────────────────
    integrations: [
      // Automatically capture NextJS errors
    ],

    // ── Additional context ─────────────────────────────────────────────────
    initialScope: {
      tags: {
        component: 'next-app',
        product: 'interviewprep-live',
      },
    },
  };
};

export const sentryConfig = getSentryConfig();
