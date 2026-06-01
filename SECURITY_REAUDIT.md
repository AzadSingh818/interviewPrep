# Security Reaudit

Verification date: 2026-06-01

This is the post-fix reaudit after independently applying the fixes that could be completed in code.

## Executive Summary

The launch-blocking payment, logout, auth throttling, cron scheduling, JWT invalidation, upload validation, CSP/header, and root error-boundary gaps have been addressed in code. The production build passes. The remaining high-risk items are architectural or operational: database-backed WebRTC signaling, durable email retry/observability, real deployment secrets, and missing regression tests.

## Fixed Since Prior Report

- Razorpay webhook implemented with raw-body HMAC verification, event persistence, duplicate handling, and shared idempotent payment processors. Evidence: `src/app/api/webhooks/razorpay/route.ts:10-127`, `src/lib/payments.ts:6-173`, `prisma/schema.prisma:239-255`.
- Client payment verification now uses the same shared processors as webhooks. Evidence: `src/app/api/payment/verify/route.ts:51-93`, `src/app/api/payment/unlock-preferred-interviewer/route.ts:50-69`.
- Logout route exists and invalidates existing JWTs by incrementing `tokenVersion`. Evidence: `src/app/api/auth/logout/route.ts:5-30`.
- JWTs now carry `tokenVersion`, and `requireAuth` validates user email, role, and token version against the database. Evidence: `src/lib/auth.ts:10-15`, `src/lib/auth.ts:112-138`, `prisma/schema.prisma:24`.
- Basic Origin/Sec-Fetch-Site CSRF guard is enforced in `requireAuth`. Evidence: `src/lib/auth.ts:71-104`.
- Auth rate limiting is backed by Prisma buckets and applied to login, signup, resend OTP, and verify email. Evidence: `src/lib/rate-limit.ts:37-64`, `src/app/api/auth/login/route.ts:18-25`.
- Cron routes are scheduled in `vercel.json`, and cleanup now protects scheduled sessions and uses the matching `updatedAt` index. Evidence: `vercel.json:16-29`, `src/app/api/cron/cleanup-signaling-rooms/route.ts:16-32`, `prisma/migrations/20260601000100_security_runtime_hardening/migration.sql`.
- File uploads now validate magic bytes before upload and avoid deleting old interviewer documents until DB update succeeds. Evidence: `src/lib/file-validation.ts`, `src/app/api/interviewer/upload-documents/route.ts:129-194`.
- CSP and security headers are configured. Evidence: `next.config.js:24-62`.

## Remaining P0 Findings

None found in the current codebase after this batch.

## Remaining P1 Findings

### P1-1. Postgres WebRTC Signaling Still Races And Does Not Scale

Evidence: signaling data is still stored as JSON arrays in `prisma/schema.prisma:225-236`; the room API still uses JSON read/append/write behavior; clients still poll room state.

Risk: lost ICE candidates/messages under concurrency, high DB load, and unreliable calls.

Recommended action: migrate signaling to LiveKit/Ably/Pusher, or implement append-only signaling events with atomic inserts as an interim.

### P1-2. Email Delivery Is Not Durable

Evidence: reminder sends now throw and the scheduler resets `reminderSent` on failure, but there is still no persistent email job table, retry counter, backoff, or alerting.

Risk: SMTP or provider outages can still silently delay important lifecycle email.

Recommended action: add `EmailJob` persistence, retry/backoff cron processing, and monitoring for failed jobs.

### P1-3. CSRF Guard Is A Baseline, Not A Full Token Defense

Evidence: `requireAuth` validates Origin/Sec-Fetch-Site at `src/lib/auth.ts:71-104`, but no double-submit CSRF token exists.

Risk: older clients, unusual proxies, or missing Origin/Sec-Fetch-Site headers reduce assurance.

Recommended action: add app-wide double-submit CSRF tokens for cookie-authenticated mutations; keep signed webhooks excluded.

### P1-4. Deployment Secrets Must Be Set

Evidence: `.env.example` includes `CRON_SECRET` and `RAZORPAY_WEBHOOK_SECRET`, and routes require them with `readRequiredEnv`, but they are optional in eager startup validation to keep local builds working.

Risk: cron/webhook routes fail at request time if those deployment secrets are missing.

Recommended action: set real `CRON_SECRET` and Razorpay webhook secret in production before launch; consider production-only eager validation.

## Remaining P2 Findings

- Admin provisioning remains undefined. Evidence: `isAdminEmail` exists in `src/lib/auth.ts:176-178`, but no seed or admin-management flow uses it.
- Historical `sessions.difficulty` data-loss risk remains from an old migration and requires production/staging data audit.
- Payment, auth, AI, and email flows need automated regression tests.
- Observability is still mostly `console.error`; add Sentry or equivalent before real traffic.

## Verification Run

- `npx prisma validate`: passed
- `npx prisma generate`: passed
- `npx tsc --noEmit`: passed
- `npm run build`: passed
