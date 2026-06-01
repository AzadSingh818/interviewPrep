# Regression Report

Verification date: 2026-06-01

## Resolved Issues

- Pro price centralization and Rs 99 correction are still intact. Evidence: `src/lib/pricing.ts:1-5`, `src/app/api/payment/create-order/route.ts`.
- Feature unlock payments now use `FeatureUnlock` only; the legacy `ManualBookingRequest` fallback was removed, and a cleanup migration deletes placeholder rows. Evidence: `src/app/api/payment/unlock-preferred-interviewer/route.ts:36-69`, `prisma/migrations/20260601000200_remove_legacy_unlock_placeholders/migration.sql`.
- Razorpay webhook support was added. Evidence: `src/app/api/webhooks/razorpay/route.ts:10-127`, `src/lib/payments.ts:6-173`.
- Missing logout route was added and invalidates token versions. Evidence: `src/app/api/auth/logout/route.ts:5-30`.
- Auth rate limiting was added for login/signup/resend/verify paths. Evidence: `src/lib/rate-limit.ts:37-64`, `src/app/api/auth/login/route.ts:18-25`.
- JWT invalidation was added with `User.tokenVersion`. Evidence: `prisma/schema.prisma:24`, `src/lib/auth.ts:112-138`.
- Baseline CSRF Origin/Sec-Fetch-Site validation was added. Evidence: `src/lib/auth.ts:71-104`.
- Cron schedules now exist in `vercel.json`. Evidence: `vercel.json:16-29`.
- Signaling cleanup now queries `updatedAt` with a matching index and protects scheduled sessions. Evidence: `src/app/api/cron/cleanup-signaling-rooms/route.ts:16-32`, `prisma/migrations/20260601000100_security_runtime_hardening/migration.sql`.
- LinkedIn sync UI was removed while the disabled backend route remains 410-only.
- Root/public error boundary was added without invalid `<html>/<body>` nesting. Evidence: `src/app/error.tsx`.
- Browser `confirm()` and `alert()` calls are gone. Evidence: `rg "confirm\\(|alert\\(" src` returns no matches.
- Upload magic-byte checks were added. Evidence: `src/lib/file-validation.ts`.
- CSP/security headers were added. Evidence: `next.config.js:24-62`.

## Partially Resolved Issues

- CSRF protection is improved but still lacks a double-submit token.
- Environment validation is eager for core required secrets, but `CRON_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are enforced at route call time rather than startup.
- Reminder delivery now retries by resetting `reminderSent` on failure, but there is still no durable email job queue.
- Auth rate limiting is durable in Postgres but not as strong as Redis/Upstash under high-concurrency brute force.

## Unresolved Issues

- Postgres polling WebRTC signaling remains the main architectural risk.
- Admin provisioning remains undefined.
- Historical difficulty migration data needs a production/staging data audit.
- Observability and automated security/payment regression tests are still missing.

## New Issues Introduced

No new build/type/schema regressions were found after this implementation batch.

## Verification Run

- `npx prisma validate`: passed
- `npx prisma generate`: passed
- `npx tsc --noEmit`: passed
- `npm run build`: passed
