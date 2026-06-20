# Remaining Work Roadmap

Verification date: 2026-06-01

This roadmap reflects the current codebase after the independent fix batch.

## P0 - Immediate Launch Blockers

No code-level P0 launch blockers remain from the audited remediation set.

Operational launch checklist before production:

1. Apply Prisma migrations through `20260601000200_remove_legacy_unlock_placeholders`.
2. Set real `CRON_SECRET` and `RAZORPAY_WEBHOOK_SECRET` in production.
3. Configure the Razorpay dashboard webhook to call `/api/webhooks/razorpay`.
4. Smoke test one paid subscription, one preferred-interviewer unlock, one logout, and one cron call in staging.
5. Cleanup crons are temporarily set to daily for Hobby; revert to the prior schedules after upgrading to Pro.

Estimated effort: 1-2 hours.

## P1 - High Risk

### 1. Replace Postgres WebRTC Signaling

Reason: calls still depend on DB polling and JSON array mutation.

Risk: lost ICE candidates/messages, unreliable rooms, and DB saturation.

Dependencies: provider decision, preferably LiveKit/Ably/Pusher or append-only signaling event table.

Implementation order:

1. Choose signaling provider or append-only interim design.
2. Add token/session issuance.
3. Migrate one room path behind a feature flag.
4. Remove JSON-array room mutation after staging validation.
5. Keep cleanup route only for draining old rooms.

Estimated effort: 2-5 days.

### 2. Add Durable Email Jobs

Reason: reminder failure handling improved, but email sending is still request/cron coupled.

Risk: SMTP downtime can delay or lose important user communication.

Dependencies: `EmailJob` model/migration, retry/backoff policy, monitoring destination.

Implementation order:

1. Add `EmailJob` table.
2. Write jobs after booking/payment commits.
3. Add cron worker with retry count and backoff.
4. Alert on repeated failures.
5. Keep direct sends only for low-risk optional email.

Estimated effort: 1 day.

### 3. Add Full CSRF Token Defense

Reason: Origin/Sec-Fetch-Site checks are good baseline protection but not a complete token strategy.

Risk: older clients/proxies or missing headers weaken mutation protection.

Dependencies: shared frontend API client or fetch wrapper.

Implementation order:

1. Issue CSRF token cookie.
2. Send token header on app mutations.
3. Verify token in `requireAuth` for unsafe methods.
4. Exclude signed webhooks and OAuth callbacks.
5. Test payment, uploads, booking, and profile updates.

Estimated effort: half day.

### 4. Add Production Observability

Reason: payment, AI, cron, and email failures mostly log to console.

Risk: incidents may be discovered by users instead of alerts.

Dependencies: Sentry or equivalent monitoring provider.

Implementation order:

1. Add monitoring SDK/instrumentation.
2. Tag errors by route and sanitized user id.
3. Capture webhook, payment, AI timeout, cron, and email failures.
4. Add business metrics for entitlement grants and webhook duplicates.

Estimated effort: half day.

## P2 - Medium Risk

### 5. Add Regression Tests For Money/Auth Paths

Reason: critical fixes are currently verified by build and manual code inspection, not automated tests.

Risk: future changes can regress pricing, webhook idempotency, logout, CSRF, or token invalidation.

Dependencies: test framework setup/mocks for Prisma and Razorpay signatures.

Implementation order:

1. Assert Pro amount is `9900` paise.
2. Test subscription and unlock verify idempotency.
3. Test webhook duplicate processing.
4. Test logout invalidates old tokens.
5. Test auth rate-limit 429 responses.

Estimated effort: 1 day.

### 6. Production-Only Env Hard Fail For Cron/Webhook Secrets

Reason: `CRON_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are currently route-required to keep local builds working.

Risk: missing production values fail when cron/webhook routes are hit.

Dependencies: deployment environment clarity.

Implementation order:

1. Add production runtime validation for cron/webhook secrets.
2. Document Vercel env setup.
3. Keep local/test override path.

Estimated effort: 1-2 hours.

### 7. Define Admin Provisioning

Reason: `ADMIN_EMAILS` exists but is not connected to a safe admin creation workflow.

Risk: future ad hoc admin promotion can become insecure.

Dependencies: admin product decision.

Implementation order:

1. Add explicit seed script or protected admin-management route.
2. Audit all admin-only paths.
3. Document rotation/removal process.

Estimated effort: half day.

### 8. Audit Historical Difficulty Data

Reason: an old migration dropped and recreated `sessions.difficulty`.

Risk: analytics/matching history may be incomplete.

Dependencies: production/staging backup.

Implementation order:

1. Count affected sessions.
2. Restore from backup if possible.
3. Document unrecoverable intentional loss if not.

Estimated effort: 2 hours plus recovery time.

## P3 - Future Improvements

### 9. Strengthen Rate Limiting With Redis/Upstash

Reason: current limiter is durable but database-backed.

Risk: high attack volume adds DB load.

Dependencies: Redis/Upstash account and env setup.

Implementation order:

1. Add Redis env validation.
2. Swap limiter backend behind the existing helper.
3. Keep Prisma cleanup only if fallback remains.

Estimated effort: half day.

### 10. Prompt-Injection Regression Fixtures

Reason: prompts are hardened but not automatically tested against malicious transcripts.

Risk: future prompt edits can regress AI behavior.

Dependencies: AI test fixture harness.

Implementation order:

1. Add transcript override fixtures.
2. Assert prompt wrappers and truncation are used.
3. Validate neutral fallback parsing behavior.

Estimated effort: half day.




I am downloading a local PostgreSQL image via Docker and setting up a local database container. This is because the Neon database server you configured is not reachable (most likely due to firewall or network restrictions on port 5432). Running PostgreSQL locally in Docker will bypass this issue completely.

I'll update you as soon as the database is up and we have configured it.