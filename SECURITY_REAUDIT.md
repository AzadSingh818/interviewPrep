# Security Reaudit

Verification date: 2026-06-01

This is a fresh audit of the current codebase after remediation, not a restatement of the original audit.

## Executive Summary

Several narrow fixes landed correctly, especially pricing, OAuth role preservation, LinkedIn SSRF shutdown, HTML escaping, Groq timeout handling, and video ref guards. However, the codebase is still not production-safe because payment webhooks, rate limiting, CSRF protection, JWT invalidation, scheduled cron execution, durable email delivery, and the realtime architecture remain unresolved.

## P0 Findings

### P0-1. Missing Razorpay Webhook

Payment entitlements still depend on the browser calling client verification endpoints.

Evidence:

- Subscription verification route: `src/app/api/payment/verify/route.ts:10-171`.
- Unlock verification route: `src/app/api/payment/unlock-preferred-interviewer/route.ts:9-118`.
- No webhook route exists under `src/app/api/webhooks`.
- No webhook event table exists in `prisma/schema.prisma`.

Risk: a captured payment can fail to grant access if the user closes the browser or verify races/fails.

Recommended action: implement `POST /api/webhooks/razorpay`, verify raw-body signature, persist event ids, and process subscription/unlock payments idempotently in transactions.

### P0-2. Logout Endpoint Missing

The frontend calls `/api/auth/logout`, but no route exists.

Evidence:

- Student logout call: `src/app/student/layout.tsx:368`.
- Interviewer logout call: `src/app/interviewer/layout.tsx:435`.
- Existing auth routes do not include `src/app/api/auth/logout/route.ts`.
- Cookie removal helper exists but is unused by an API route: `src/lib/auth.ts:73-76`.

Risk: users may believe they logged out while the auth cookie remains valid.

Recommended action: add `POST /api/auth/logout/route.ts` that calls `removeAuthCookie()` and returns success.

### P0-3. No Auth Rate Limiting

Login, resend OTP, and verify OTP remain unthrottled.

Evidence:

- Login flow has no limiter: `src/app/api/auth/login/route.ts`.
- Resend OTP has no limiter: `src/app/api/auth/resend-otp/route.ts:5-78`.
- Verify OTP has no limiter or attempt counter: `src/app/api/auth/verify-email/route.ts:14-126`.

Risk: OTP brute force, SMTP quota burn, and password brute force.

Recommended action: add Redis/Upstash-backed limits for login, resend, and verify, keyed by email plus IP.

## P1 Findings

### P1-1. No CSRF Protection On Cookie-Authenticated Mutations

State-changing API routes rely on cookies and do not check CSRF token or Origin.

Evidence:

- Auth cookie uses `sameSite: 'lax'`: `src/lib/auth.ts:57-65`, `src/lib/auth-options.ts:135-141`.
- Mutations such as profile update, booking, uploads, payment verification, and interview-room POST use cookies through `requireAuth` with no CSRF guard.

Risk: malicious same-site or cross-site contexts can trigger user actions if cookies are sent.

Recommended action: implement Origin validation and/or double-submit CSRF tokens for all cookie-authenticated mutations. Exclude signed webhooks.

### P1-2. JWTs Are Still Not Invalidatable

JWTs remain valid for seven days and `requireAuth` trusts token role without checking DB freshness.

Evidence:

- Token lifetime: `src/lib/auth.ts:40-42`.
- Verification only checks signature: `src/lib/auth.ts:44-50`.
- `requireAuth` returns token payload without DB user status/version lookup: `src/lib/auth.ts:84-95`.

Risk: deleted users, role changes, and password changes do not revoke existing sessions.

Recommended action: add `sessionVersion`/`tokenVersion` to `User`, include it in JWT, and validate it in sensitive route auth.

### P1-3. Cron Routes Are Not Scheduled

Cron endpoints exist but nothing invokes them in deployment.

Evidence:

- Routes: `src/app/api/cron/session-reminders/route.ts`, `src/app/api/cron/cleanup-signaling-rooms/route.ts`, `src/app/api/cron/cleanup-pending-users/route.ts`.
- `vercel.json:1-16` contains no `crons` block.

Risk: reminders are not sent and cleanup does not run in production.

Recommended action: add Vercel Cron config or configure an external scheduler with `Authorization: Bearer ${CRON_SECRET}`.

### P1-4. Reminder Delivery Is Not Reliably Tracked

Reminder job marks sessions as sent before send functions can report failure.

Evidence:

- Claim sent first: `src/lib/scheduler.ts:41-44`.
- Email functions catch and swallow send failures: `src/lib/email.ts:773-784`, `src/lib/email.ts:839-850`.

Risk: users miss reminders with no retry.

Recommended action: make cron-specific send helpers throw, mark `reminderSent` only after success, and introduce retryable email jobs.

### P1-5. Environment Validation Is Incomplete

Env validation is lazy and partial.

Evidence:

- Lazy proxy: `src/lib/env.ts:26-35`.
- Direct env reads remain: `src/lib/email.ts:7-15`, upload routes, cron routes, `src/lib/auth.ts:9-15`.
- `CRON_SECRET` and SMTP envs are not in `src/lib/env.ts:1-14`.

Risk: production misconfiguration fails during user requests, not startup.

Recommended action: add eager env validation and `.env.example`.

### P1-6. Postgres-Based WebRTC Signaling Still Races And Does Not Scale

Signaling remains DB polling with JSON read-modify-write arrays.

Evidence:

- Room API stores JSON arrays in one row: `prisma/schema.prisma:221-231`.
- Candidate append reads then writes arrays: `src/app/api/interview-room/route.ts:236-260`.
- Message append reads then writes arrays: `src/app/api/interview-room/route.ts:280-290`.
- Clients poll room state every 1.5 seconds: `src/app/interviewer/interview-room/[sessionId]/page.tsx:349-352`; student page uses the same polling pattern.

Risk: lost ICE candidates/messages under concurrency, heavy DB load, slow calls, failed WebRTC connections.

Recommended action: move signaling to LiveKit, Ably, Pusher, or append-only signaling events as an interim.

### P1-7. Security Headers Are Minimal

No CSP, frame protections, or broad security headers are configured.

Evidence:

- `next.config.js:24-36` only sets `Permissions-Policy` for interview-room paths.

Risk: increased impact from XSS or embedded-content abuse.

Recommended action: add CSP, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `X-Content-Type-Options`, and conservative permissions defaults.

## P2 Findings

### P2-1. Cloudinary Upload Validation Is MIME-Only

Uploads validate browser-provided MIME type and size, not file magic bytes.

Evidence:

- Student resume type check: `src/app/api/student/upload-resume/route.ts:103-113`.
- Interviewer docs type check: `src/app/api/interviewer/upload-documents/route.ts:97-128`, `src/app/api/interviewer/upload-documents/route.ts:140-152`.
- Profile photo type check: `src/app/api/interviewer/upload-profile-picture/route.ts:95-111`.

Risk: malicious files with forged MIME type can be stored and served.

Recommended action: inspect file signatures server-side and consider AV scanning for documents.

### P2-2. Admin Provisioning Is Still Undefined

`ADMIN_EMAILS` exists but is unused in account creation.

Evidence:

- `src/lib/auth.ts:7` reads `ADMIN_EMAILS`.
- `src/lib/auth.ts:133-135` exposes `isAdminEmail`.
- `rg "isAdminEmail" src` only finds the definition.

Risk: operational confusion and future insecure admin auto-promotion.

Recommended action: add an explicit admin seed or protected admin management path.

### P2-3. Disabled LinkedIn Sync UI Remains

Evidence:

- Handler calls disabled route at `src/app/interviewer/dashboard/page.tsx:99-129`.
- Button is rendered at `src/app/interviewer/dashboard/page.tsx:257-264`.

Risk: broken UX and support noise.

Recommended action: remove the button and replace copy with manual upload only.

### P2-4. Root/Public Error Boundary Missing

Evidence:

- Error boundaries exist under `student` and `interviewer`, but no `src/app/error.tsx`.

Risk: login/signup/verify/public page render errors can white-screen.

Recommended action: add root error boundary.

### P2-5. Historical Difficulty Migration May Have Lost Data

Evidence:

- Migration warns about data loss at `prisma/migrations/20260324201410_career_level_and_interview_difficulty/migration.sql:4-6`.
- It drops and recreates `sessions.difficulty` at `prisma/migrations/20260324201410_career_level_and_interview_difficulty/migration.sql:24-26`.

Risk: historical analytics or matching data may be wrong.

Recommended action: audit production/staging data and repair from backup if needed.

## Positive Security Changes Verified

- LinkedIn SSRF endpoint disabled: `src/app/api/interviewer/sync-linkedin-photo/route.ts:10-20`.
- Email HTML escaping: `src/lib/email.ts:39-50`.
- OAuth existing-role preservation: `src/lib/auth-options.ts:93-104`.
- Password policy centralized and enforced on signup/change-password APIs: `src/lib/password-policy.ts:1-14`.
- Groq timeout and timeout responses: `src/lib/ai/groq.ts:20`, `src/app/api/ai/notes/route.ts:171-175`, `src/app/api/ai/feedback/route.ts:117-121`.

