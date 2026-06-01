# Remaining Work Roadmap

Verification date: 2026-06-01

This roadmap is based on the current codebase after fix verification.

## P0 - Immediate Launch Blockers

### 1. Implement Razorpay Webhooks

Reason: payments are still client-verification dependent.

Risk: users can be charged without receiving Pro/unlock entitlement.

Dependencies: Razorpay webhook secret, webhook event persistence migration, idempotent subscription/unlock processors.

Implementation order:

1. Add `PaymentWebhookEvent` model/migration.
2. Add raw-body Razorpay webhook route.
3. Process `payment.captured`/`payment.failed` idempotently.
4. Keep client verify as fallback.
5. Test duplicate/out-of-order events.

Estimated effort: 4-6 hours.

### 2. Add Missing Logout Route

Reason: UI calls `/api/auth/logout`, but the route does not exist.

Risk: users remain authenticated after clicking logout.

Dependencies: existing `removeAuthCookie()` helper.

Implementation order:

1. Create `src/app/api/auth/logout/route.ts`.
2. Call `removeAuthCookie()`.
3. Return success and no-store headers.
4. Smoke test student/interviewer logout.

Estimated effort: 30 minutes.

### 3. Add Server-Side Auth Rate Limiting

Reason: login, OTP resend, and OTP verify are unthrottled.

Risk: OTP brute force, account attacks, SMTP abuse.

Dependencies: Redis/Upstash or durable rate-limit service.

Implementation order:

1. Add env validation for Redis.
2. Implement shared limiter helper.
3. Protect login, resend OTP, verify OTP.
4. Add frontend 429 messaging.
5. Add tests for lockout/cooldown behavior.

Estimated effort: 4-6 hours.

### 4. Configure Production Cron Execution

Reason: cron routes exist but are not scheduled.

Risk: reminders and cleanup never run.

Dependencies: `CRON_SECRET`, Vercel Cron or external scheduler.

Implementation order:

1. Add `CRON_SECRET` to env validation.
2. Add `crons` to `vercel.json` or external scheduler config.
3. Test authorization header behavior.
4. Monitor first production run.

Estimated effort: 1-2 hours.

## P1 - High Risk

### 5. Fix Reminder Delivery Semantics

Reason: reminders are marked sent before email delivery is known, and email helpers swallow errors.

Risk: failed reminder emails are never retried.

Dependencies: scheduler route, email helper behavior.

Implementation order:

1. Create throwing email helper variants or return send result.
2. Mark `reminderSent` only after both sends succeed.
3. Add retry/backoff or email job table.
4. Add tests for SMTP failure.

Estimated effort: half day.

### 6. Add CSRF Protection

Reason: cookie-authenticated mutations lack CSRF/Origin validation.

Risk: malicious sites can trigger state changes when cookies are sent.

Dependencies: frontend fetch wrapper or shared API client.

Implementation order:

1. Inventory mutation routes.
2. Add Origin validation as quick protection.
3. Add double-submit CSRF token for app mutations.
4. Exclude signed webhooks.
5. Test payment/OAuth flows.

Estimated effort: half day.

### 7. Make JWTs Invalidatable

Reason: 7-day JWTs remain valid after role/password/account changes.

Risk: stale tokens preserve unauthorized access.

Dependencies: Prisma migration for `tokenVersion` or Redis session store.

Implementation order:

1. Add `User.tokenVersion`.
2. Include version in JWT.
3. Validate version in `requireAuth` for sensitive routes.
4. Increment on password change/logout/admin role change.
5. Add caching if DB load becomes high.

Estimated effort: 1 day.

### 8. Replace Postgres Signaling

Reason: current WebRTC signaling uses DB polling and JSON read-modify-write arrays.

Risk: lost ICE candidates, call failures, DB saturation.

Dependencies: LiveKit/Ably/Pusher decision, frontend room refactor.

Implementation order:

1. Choose provider; LiveKit is already installed.
2. Implement room token/session issuance.
3. Migrate one room path behind a feature flag.
4. Remove DB polling after successful staging calls.
5. Retain cleanup for old rooms until drained.

Estimated effort: 2-5 days.

### 9. Complete Environment Validation

Reason: current validation is lazy and partial.

Risk: production fails on first user request for missing secrets.

Dependencies: env inventory.

Implementation order:

1. Add eager server env validation.
2. Include SMTP, `CRON_SECRET`, Cloudinary, Razorpay, Google, JWT, NextAuth, Groq.
3. Add `.env.example`.
4. Replace direct `process.env` reads where practical.

Estimated effort: half day.

### 10. Add Security Headers

Reason: only interview-room permissions policy is configured.

Risk: avoidable XSS/clickjacking/content-sniffing exposure.

Dependencies: asset/domain inventory.

Implementation order:

1. Define CSP for scripts, images, connect, frames.
2. Add frame/referrer/content-type headers.
3. Test Razorpay, Google OAuth, Cloudinary, and Groq/API calls.

Estimated effort: 2-4 hours.

## P2 - Medium Risk

### 11. Finish FeatureUnlock Contract Cleanup

Reason: old placeholder manual booking rows remain after backfill.

Risk: admin/manual-request views can show ghost records if filters are missed.

Dependencies: production data snapshot.

Implementation order:

1. Identify legacy placeholder rows.
2. Add cleanup/marking migration.
3. Remove legacy fallback after one release.
4. Add admin query guard if admin is added later.

Estimated effort: half day.

### 12. Fix Signaling Cleanup Index And Guard

Reason: cleanup queries `updatedAt`, but migration indexed `createdAt`; deletion does not check session state.

Risk: slow cleanup and possible deletion of long-running rooms.

Dependencies: session status rules.

Implementation order:

1. Add `signaling_rooms_updatedAt` index.
2. Include session status/scheduled-time safe buffer.
3. Add route tests for active/stale rooms.

Estimated effort: 2 hours.

### 13. Remove Disabled LinkedIn Sync UI

Reason: backend correctly returns 410, but dashboard still offers the button.

Risk: broken UX and support tickets.

Dependencies: none.

Implementation order:

1. Remove handler/button.
2. Update copy to manual upload only.

Estimated effort: 30 minutes.

### 14. Add Root Error Boundary And Monitoring

Reason: public/root routes lack error boundary and all boundaries log only to console.

Risk: white screens and invisible incidents.

Dependencies: Sentry or selected monitoring provider.

Implementation order:

1. Add `src/app/error.tsx`.
2. Add monitoring SDK/instrumentation.
3. Capture route errors and critical business failures.

Estimated effort: 2-4 hours.

### 15. Harden Upload Validation

Reason: uploads trust MIME type.

Risk: malicious files with forged MIME are stored.

Dependencies: file signature library and optional AV service.

Implementation order:

1. Inspect magic bytes for PDF/images/doc formats.
2. Normalize allowed extensions/resource types.
3. Add optional malware scanning for documents.

Estimated effort: half day.

### 16. Audit Difficulty Migration Data

Reason: migration dropped/recreated `sessions.difficulty`.

Risk: lost historical session difficulty values.

Dependencies: production/staging backup.

Implementation order:

1. Count null historical difficulties.
2. Recover from backup if possible.
3. Document intentional loss if unrecoverable.

Estimated effort: 2 hours plus data recovery time.

## P3 - Future Improvements

### 17. Add Payment/AI/Email Observability

Reason: important failures are mostly `console.error`.

Risk: incidents are discovered by users.

Dependencies: monitoring provider.

Implementation order:

1. Add Sentry or equivalent.
2. Tag errors by route and sanitized user id.
3. Add business metrics for payments, email, AI timeout.

Estimated effort: half day.

### 18. Add Prompt-Injection Regression Tests

Reason: prompts are hardened but not robustly tested.

Risk: future prompt changes regress behavior.

Dependencies: test harness and malicious fixture set.

Implementation order:

1. Add fixtures for instruction override attempts.
2. Validate behavior parser fallback.
3. Add input length caps.

Estimated effort: half day.

### 19. Replace Blocking `confirm()`

Reason: `confirm()` remains in resume deletion.

Risk: minor UX inconsistency.

Dependencies: modal component.

Implementation order:

1. Add confirmation modal to student dashboard.
2. Remove browser `confirm()`.

Estimated effort: 1 hour.

### 20. Add Tests For Pricing And Entitlements

Reason: critical money behavior is untested.

Risk: future regression to wrong amount or wrong entitlement.

Dependencies: test framework.

Implementation order:

1. Assert Pro amount is 9900 paise.
2. Test subscription verify idempotency.
3. Test unlock verify idempotency.
4. Test webhook once implemented.

Estimated effort: half day.

