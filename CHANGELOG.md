# Changelog

## Independent Fix Completion Batch

Completed the independently actionable items from the verification reports.

1. Added Razorpay webhook processing with signature verification, event persistence, duplicate handling, and shared idempotent subscription/unlock processors.
2. Added logout API route and token-version invalidation.
3. Added Prisma-backed auth rate limiting for login, signup, resend OTP, and verify email.
4. Added `User.tokenVersion`, `PaymentWebhookEvent`, and `RateLimitBucket` schema support plus migrations.
5. Added baseline CSRF Origin/Sec-Fetch-Site checks for cookie-authenticated API routes.
6. Added Vercel cron schedules and hardened cleanup queries/indexes.
7. Removed the legacy unlock fallback to `ManualBookingRequest` and added a cleanup migration for old placeholder rows.
8. Added upload magic-byte validation and prevented invalid replacement uploads from deleting existing interviewer documents.
9. Added CSP/security headers and a root error boundary.
10. Removed stale LinkedIn sync UI and browser `confirm()` usages.
11. Updated the security, regression, and remaining-work reports to reflect the current code.

Verification:

- `npx prisma validate`: passed
- `npx prisma generate`: passed
- `npx tsc --noEmit`: passed
- `npm run build`: passed

## Controlled Remediation Batch

Implemented the 19 approved fixes in the requested order.

1. Centralized Pro pricing in `src/lib/pricing.ts` and corrected subscription order amount to 9900 paise.
2. Fixed Google OAuth login so existing user roles are preserved.
3. Removed Prisma `pendingUser` type bypasses and regenerated Prisma Client.
4. Added required server environment validation in `src/lib/env.ts`.
5. Added Groq request timeout helper.
6. Changed malformed AI behavior-analysis fallback from perfect/green to neutral/yellow.
7. Separated AI system instructions from untrusted user content and validated behavior-analysis output.
8. Escaped user-controlled HTML in email templates.
9. Disabled LinkedIn server-side photo scraping and hardened LinkedIn profile URL validation.
10. Centralized password policy and applied it to signup and password-change flows.
11. Added audit-recommended database indexes.
12. Added `FeatureUnlock` model/table and moved preferred-interviewer unlock orders out of `ManualBookingRequest`.
13. Added App Router error boundaries for student, interviewer, and interview-room routes.
14. Added pre-hydration theme script to prevent dark/light flash.
15. Added local toast provider and removed browser `alert()` usage.
16. Added safer video stream attachment guards in interview rooms.
17. Converted the remaining profile `<img>` usage to `next/image`.
18. Split student dashboard profile refresh from session refresh after profile-only updates.
19. Replaced in-process scheduler behavior with deployment-agnostic cron API routes.

## Verification

- `npx tsc --noEmit`: passed
- `npx prisma validate`: passed
- `npm run build`: passed after allowing network access for `next/font` Google font fetches
- `npm run lint`: blocked because the repo has no ESLint config and `next lint` opens an interactive setup prompt
