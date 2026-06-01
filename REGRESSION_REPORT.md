# Regression Report

Verification date: 2026-06-01

## Resolved Issues

- Pro plan amount now uses `9900` paise and shared pricing constants. Evidence: `src/lib/pricing.ts:1-5`, `src/app/api/payment/create-order/route.ts:30-56`.
- OAuth existing-user role overwrite is fixed. Evidence: `src/lib/auth-options.ts:93-104` updates existing users without changing role.
- PendingUser Prisma typing bypasses are removed. Evidence: `src/app/api/auth/signup/route.ts:60-96`, `src/app/api/auth/verify-email/route.ts:27-88`, `src/app/api/auth/resend-otp/route.ts:18-53`.
- LinkedIn server-side SSRF path is closed because the route returns 410 and performs no fetch. Evidence: `src/app/api/interviewer/sync-linkedin-photo/route.ts:10-20`.
- Email HTML escaping is implemented in shared and manual templates. Evidence: `src/lib/email.ts:39-50`, `src/lib/email.ts:70-81`, `src/lib/email.ts:1051-1061`.
- Groq timeout helper is implemented and used by all direct Groq calls. Evidence: `src/lib/ai/groq.ts:10-23`.
- Browser `alert()` calls are removed. `rg "alert\\(" src` returns no matches.
- Remaining profile images use `next/image`. `rg "<img" src` returns no matches.
- Video `srcObject` writes are guarded in both interview rooms. Evidence: `src/app/student/interview-room/[sessionId]/page.tsx:14-27`, `src/app/interviewer/interview-room/[sessionId]/page.tsx:21-34`.

## Partially Resolved Issues

- Feature unlocks now use `feature_unlocks` for new orders, but old placeholder manual booking rows remain and legacy fallback still updates them. Evidence: `prisma/migrations/20260531000200_add_feature_unlocks/migration.sql:30-61`, `src/app/api/payment/unlock-preferred-interviewer/route.ts:71-105`.
- Audit indexes exist, but the signaling cleanup index does not match the cleanup query. Evidence: index on `"createdAt"` at `prisma/migrations/20260531000100_add_audit_recommended_indexes/migration.sql:16-17`; query uses `updatedAt` at `src/app/api/cron/cleanup-signaling-rooms/route.ts:18-22`.
- Error boundaries exist for student/interviewer/room segments, but not root/public routes. Evidence: four `error.tsx` files under `src/app/student` and `src/app/interviewer`; no `src/app/error.tsx`.
- Environment validation exists as a lazy proxy but does not fail at startup and is not used by all env consumers. Evidence: `src/lib/env.ts:26-35`, direct `process.env` reads in `src/lib/email.ts:7-15` and upload routes.
- Scheduler logic moved to cron routes, but `vercel.json` has no cron schedule. Evidence: `src/app/api/cron/session-reminders/route.ts:6-24`, `vercel.json:1-16`.
- Cleanup routes exist, but are unscheduled and signaling cleanup can delete by age without session-state checks. Evidence: `src/app/api/cron/cleanup-signaling-rooms/route.ts:18-23`.

## Unresolved Issues From Original Audit

- Razorpay webhook handler is still missing. No `src/app/api/webhooks/razorpay/route.ts` exists; payment entitlement still depends on client verification routes.
- Auth rate limiting is still missing for login, resend OTP, and verify OTP. Evidence: `src/app/api/auth/login/route.ts`, `src/app/api/auth/resend-otp/route.ts`, and `src/app/api/auth/verify-email/route.ts` contain no limiter or 429 path.
- JWTs are still not invalidatable. Evidence: `src/lib/auth.ts:40-47` signs/verifies 7-day JWTs; `requireAuth` trusts token payload at `src/lib/auth.ts:84-95`.
- CSRF protection is still missing on cookie-authenticated mutations. Auth cookies remain `sameSite: 'lax'` at `src/lib/auth.ts:57-65` and `src/lib/auth-options.ts:135-141`; mutation routes do not validate CSRF or Origin.
- Admin provisioning remains unclear. `isAdminEmail` exists at `src/lib/auth.ts:133-135` but is not used in signup/login/OAuth routes.
- PostgreSQL polling WebRTC signaling remains the core realtime architecture. Evidence: polling every 1.5s in `src/app/student/interview-room/[sessionId]/page.tsx` and `src/app/interviewer/interview-room/[sessionId]/page.tsx`, with DB JSON array mutation in `src/app/api/interview-room/route.ts:236-290`.
- Signaling JSON append race remains. Evidence: read-modify-write candidates at `src/app/api/interview-room/route.ts:236-260` and messages at `src/app/api/interview-room/route.ts:280-290`.
- Difficulty migration data-loss risk remains historical. Evidence: `prisma/migrations/20260324201410_career_level_and_interview_difficulty/migration.sql:4-6` warns and `prisma/migrations/20260324201410_career_level_and_interview_difficulty/migration.sql:24-26` drops/recreates `sessions.difficulty`.
- Email delivery still has no durable retry or alerting. Evidence: send functions catch and log errors, e.g. `src/lib/email.ts:390-401`, `src/lib/email.ts:456-467`, `src/lib/email.ts:773-784`.
- No CSP/security headers beyond interview-room Permissions-Policy. Evidence: `next.config.js:24-36`.

## New Issues Introduced Or Discovered

### 1. Logout Endpoint Missing

The UI calls `/api/auth/logout`, but no route exists under `src/app/api/auth`.

Evidence:

- Calls: `src/app/student/layout.tsx:368`, `src/app/interviewer/layout.tsx:435`.
- Existing auth API files listed by `rg --files src/app/api/auth` do not include `logout/route.ts`.

Impact: logout appears to navigate client-side but may leave `auth-token` cookie intact.

Severity: P0 launch blocker.

### 2. Cron Routes Exist But Are Not Scheduled

Evidence:

- Reminder route: `src/app/api/cron/session-reminders/route.ts:6-24`.
- Cleanup routes: `src/app/api/cron/cleanup-signaling-rooms/route.ts:6-33`, `src/app/api/cron/cleanup-pending-users/route.ts:9-48`.
- `vercel.json:1-16` has only function settings and no `crons`.

Impact: reminders and cleanup will not run automatically on Vercel.

Severity: P0/P1 depending on launch promise for reminders.

### 3. Reminder Cron Marks Sent Before It Knows Email Succeeded

Evidence:

- `src/lib/scheduler.ts:41-44` marks `reminderSent: true`.
- Reminder send functions swallow errors at `src/lib/email.ts:773-784` and `src/lib/email.ts:839-850`.

Impact: failed reminder emails can be permanently marked sent and never retried.

Severity: P1.

### 4. Disabled LinkedIn Sync Still Has UI Entry Point

Evidence:

- Button still renders at `src/app/interviewer/dashboard/page.tsx:257-264`.
- Handler still calls disabled route at `src/app/interviewer/dashboard/page.tsx:99-129`.

Impact: users see a feature that always fails with 410.

Severity: P2.

### 5. Environment Validation Gives A False Sense Of Startup Safety

Evidence:

- Lazy proxy validation only on property access: `src/lib/env.ts:26-35`.
- Direct `process.env` reads remain in `src/lib/email.ts:7-15`, upload routes, JWT helper, and cron routes.

Impact: missing secrets still fail late and route-specific.

Severity: P1.
