# InterviewPrep Live Remediation Playbook

Generated from the completed technical audit for a Next.js 14 App Router, Prisma, PostgreSQL, Razorpay, Groq, Cloudinary, NextAuth/JWT, and WebRTC platform.

This is an implementation playbook, not a rewrite plan. Do not execute lower phases before their stated preconditions are complete.

## Severity Legend

- P0: launch blocker or immediate money/security loss
- P1: high production risk
- P2: important maintainability or scale issue
- P3: future hardening

## Issue Implementation Cards

### R1. Paid Subscription Amount Is Set To Rs 1

| Field | Value |
| --- | --- |
| Current state | `PLAN_AMOUNT_PAISE = 100` charges Rs 1 while product copy says Rs 99. |
| Target state | Server-owned subscription price equals the approved production price and frontend displays server-provided pricing. |
| Files to modify | `src/app/api/payment/create-order/route.ts`, pricing UI components/pages, `.env.example` or env validation file. |
| Files to create | Optional `src/lib/pricing.ts`. |
| Migration required | No |
| Deployment required | Yes |
| Breaking change | No |
| Effort | 30 min |

Why: This is direct revenue leakage and creates reconciliation confusion.
Depends on: Razorpay order creation, subscription UI, payment verification.
Before fixing: Confirm production price, currency, tax/GST assumptions, and whether existing Rs 1 orders were tests.
Must not change yet: Do not change subscription entitlement logic or plan limits in the same patch.
Implementation steps: Move amount to one server constant or env-backed pricing module; update create-order to use it; make UI read the same exported display value where practical; add a test/assertion that amount is 9900 paise for Rs 99.
Database migrations: None.
API changes: Response may include canonical `amount`, `currency`, and `displayAmount`.
Frontend changes: Replace hardcoded Rs 99/Rs 1 strings with canonical display amount.
Deployment changes: Set production pricing env if using env-based pricing.
Rollback: Revert constant/env value only; no data rollback.
Testing: Unit test price constant; create Razorpay test order and verify amount in dashboard.
Staging checklist: Confirm displayed amount, order amount, payment amount, and subscription amount match.
Production rollout: Deploy during low traffic; create one internal test order; verify Razorpay dashboard before announcing.
Hidden risks: Existing pending orders at Rs 1 may still complete; expire/cancel stale orders if needed.

### R2. Missing Razorpay Webhook Handler

| Field | Value |
| --- | --- |
| Current state | Payment entitlement relies on client calling `/api/payment/verify`. |
| Target state | Razorpay webhook is canonical source for captured/failed payments; client verify remains idempotent fallback. |
| Files to modify | `src/app/api/payment/verify/route.ts`, `src/app/api/payment/unlock-preferred-interviewer/route.ts`, `src/app/api/payment/create-order/route.ts`, `src/app/api/payment/create-unlock-order/route.ts`, `src/lib/prisma.ts`. |
| Files to create | `src/app/api/webhooks/razorpay/route.ts`, `src/lib/payments/razorpay.ts`, tests for webhook fixtures. |
| Migration required | Yes |
| Deployment required | Yes |
| Breaking change | No |
| Effort | 2 hours |

Why: Users can be charged without receiving access if their browser closes after payment but before verify.
Depends on: `Subscription`, unlock payment state, Razorpay secrets, student entitlement updates.
Before fixing: Add webhook secret in Razorpay dashboard; inventory payment event names used by Razorpay account; decide canonical events: `payment.captured`, `payment.failed`, optionally `order.paid`.
Must not change yet: Do not remove existing verify route until webhook has run in production successfully.
Implementation steps: Add raw-body webhook route; verify `X-Razorpay-Signature` using webhook secret; route event by payment/order id; update `Subscription` or unlock record in a transaction; set entitlement idempotently; persist processed webhook event ids; return 2xx for duplicates.
Database migrations: Create `PaymentWebhookEvent(id, provider, eventId unique, eventType, payload Json, processedAt, createdAt)` or equivalent; optional `paymentSource` and `failureReason`.
API changes: New `POST /api/webhooks/razorpay`; verify routes return `alreadyProcessed` if webhook already granted entitlement.
Frontend changes: Payment success screen should poll entitlement or call verify, then handle `alreadyProcessed`.
Deployment changes: Add `RAZORPAY_WEBHOOK_SECRET`; register production webhook URL; ensure route runtime can access raw request body.
Rollback: Disable webhook in Razorpay dashboard; leave verify route active; do not drop event table.
Testing: Signature fixture tests; duplicate delivery tests; captured payment grants entitlement once; failed payment does not grant.
Staging checklist: Trigger Razorpay test webhook; close browser before client verify; confirm entitlement still activates.
Production rollout: Deploy code first, configure webhook second, monitor events and entitlement count for 24 hours.
Hidden risks: Razorpay can retry webhooks out of order; client verify and webhook can race, so all writes must be transactional and idempotent.

### R3. Unlock Flow Uses `ManualBookingRequest` As Payment Placeholder

| Field | Value |
| --- | --- |
| Current state | Unlock order creates ghost manual booking rows with no real booking intent. |
| Target state | Feature unlock payment state is stored in a dedicated model/table. |
| Files to modify | `prisma/schema.prisma`, `src/app/api/payment/create-unlock-order/route.ts`, `src/app/api/payment/unlock-preferred-interviewer/route.ts`, admin/manual booking queries if present. |
| Files to create | Prisma migration; optional `src/lib/payments/unlocks.ts`. |
| Migration required | Yes |
| Deployment required | Yes |
| Breaking change | Yes, for internal data model only |
| Effort | half day |

Why: Ghost manual requests pollute admin workflows and make payment status ambiguous.
Depends on: Preferred interviewer unlock, manual booking request creation, payment webhooks.
Before fixing: Implement or design Razorpay webhook idempotency; identify existing placeholder rows for cleanup.
Must not change yet: Do not change actual manual booking request lifecycle in the same migration.
Implementation steps: Add `FeatureUnlock` model with student id, feature type, Razorpay ids, amount, currency, status, timestamps; update create-unlock-order to create `FeatureUnlock`; update verify/webhook to mark it paid and set `StudentProfile.preferredInterviewerUnlocked`; backfill from placeholder rows; mark or delete placeholder rows after verification.
Database migrations: Add `feature_unlocks`; unique indexes on order/payment ids; optional enum `FeatureUnlockType`.
API changes: Unlock verify resolves via `FeatureUnlock` instead of manual booking request.
Frontend changes: None except error copy if unlock not found.
Deployment changes: Deploy migration before route changes or use expand/contract with both paths temporarily.
Rollback: Keep old lookup fallback for one release; rollback code while retaining table.
Testing: Existing unlock order/verify tests; admin manual request list no longer shows unlock ghosts.
Staging checklist: Create unlock order, pay, verify; submit actual manual request after unlock.
Production rollout: Migrate, deploy, monitor duplicate unlocks and orphan placeholders.
Hidden risks: Existing paid placeholder rows must not lose entitlement during migration.

### S1. No Server-Side Rate Limiting

| Field | Value |
| --- | --- |
| Current state | Login, OTP resend, and OTP verify can be called without backend throttling. |
| Target state | Redis-backed rate limits and lockouts protect auth and expensive routes. |
| Files to modify | `src/app/api/auth/login/route.ts`, `src/app/api/auth/resend-otp/route.ts`, `src/app/api/auth/verify-email/route.ts`, optionally `src/lib/auth.ts`. |
| Files to create | `src/lib/rate-limit.ts`, env validation for Redis, tests. |
| Migration required | No |
| Deployment required | Yes |
| Breaking change | No |
| Effort | 2 hours |

Why: OTP brute force can compromise accounts; resend abuse can burn SMTP quota.
Depends on: Redis/Upstash or equivalent durable store.
Before fixing: Provision Redis; define limits: login 5/15 min/IP+email, OTP verify 5/10 min/email, resend 3/hour/email+IP.
Must not change yet: Do not redesign OTP model until throttling exists.
Implementation steps: Add shared rate limiter; key by normalized email plus IP; return 429 with retry metadata; add failed OTP attempt counter and temporary lockout; add logs for lockouts.
Database migrations: None if Redis only; optional future DB audit table.
API changes: Auth endpoints may return 429 with `{ error, retryAfter }`.
Frontend changes: Show cooldown/lockout messages, disable resend based on server response.
Deployment changes: Add Redis env vars.
Rollback: Disable limiter via env flag if false positives block users.
Testing: Simulate repeated requests; verify reset window and 429 response.
Staging checklist: Attempt brute force; verify legitimate resend after window.
Production rollout: Start with conservative limits and monitor 429 volume.
Hidden risks: IP-only limiting can punish shared networks; include email key.

### S2. SSRF In LinkedIn Photo Sync

| Field | Value |
| --- | --- |
| Current state | Server fetches user-supplied URL with `includes('linkedin.com/in/')` validation. |
| Target state | Feature is removed or URL fetch is restricted to verified public LinkedIn hosts with redirect/IP protections. |
| Files to modify | `src/app/api/interviewer/sync-linkedin-photo/route.ts`, interviewer profile UI. |
| Files to create | Optional `src/lib/security/url-policy.ts`. |
| Migration required | No |
| Deployment required | Yes |
| Breaking change | Possibly, if feature is removed |
| Effort | 2 hours |

Why: Attackers can make the server request internal metadata or private services.
Depends on: Interviewer profile photo UX, Cloudinary upload flow.
Before fixing: Decide whether business needs server-side LinkedIn scraping. Safer recommendation: remove it and require manual upload.
Must not change yet: Do not introduce a broad proxy/fetch helper that other routes can misuse.
Implementation steps: Preferred: disable route with 410 and remove UI entry point. If retained, parse URL, require `https`, allow exact LinkedIn host suffixes, disallow credentials/ports, block redirects, resolve DNS and reject private/link-local IPs, enforce timeout and response size cap.
Database migrations: None.
API changes: Route returns 410 if removed or stricter 400 for invalid URLs.
Frontend changes: Replace sync button with upload-only UI.
Deployment changes: None.
Rollback: Re-enable old UI only behind admin-only feature flag; avoid restoring unsafe fetch.
Testing: URLs with `@host`, redirects, private IPs, localhost, and oversized responses.
Staging checklist: Confirm valid uploads still work and malicious URLs are blocked.
Production rollout: Deploy route hardening before removing UI to close direct API access.
Hidden risks: DNS rebinding if host validation is not tied to resolved IP.

### S3. JWTs Are Not Invalidatable

| Field | Value |
| --- | --- |
| Current state | JWT cookie remains valid for 7 days regardless of user deletion, suspension, or role change. |
| Target state | Access tokens can be revoked or become stale quickly. |
| Files to modify | `src/lib/auth.ts`, `src/lib/auth-options.ts`, auth routes, protected route helpers. |
| Files to create | `src/lib/session-store.ts` or Redis blocklist helper. |
| Migration required | Optional |
| Deployment required | Yes |
| Breaking change | No |
| Effort | half day |

Why: Revoked interviewers or changed roles retain API access until token expiry.
Depends on: JWT issuance, NextAuth Google callback, admin user management.
Before fixing: Add Redis for blocklist/session version or create DB-backed sessions.
Must not change yet: Do not replace all auth with NextAuth in this phase.
Implementation steps: Add `tokenVersion` or `sessionVersion` to `User`, include it in JWT; `requireAuth` checks cached user role/version for sensitive routes or checks Redis denylist by `jti`; reduce access token lifetime; rotate token after role changes; revoke on logout/password change.
Database migrations: If using versioning, add `users.token_version Int @default(0)` and maybe `last_logout_at`.
API changes: Unauthorized responses may increase after role/password changes.
Frontend changes: Redirect to login on 401; show session expired toast.
Deployment changes: Add Redis if using denylist.
Rollback: Increase token lifetime and bypass version check via feature flag; keep column.
Testing: Issue token, change role, verify old token fails; logout invalidates token.
Staging checklist: Student/interviewer/admin flows continue after fresh login.
Production rollout: Deploy version-compatible code, then start enforcing on sensitive routes.
Hidden risks: DB lookup on every route can hurt latency; cache role/version.

### S4. No CSRF Protection On Cookie-Authenticated Mutations

| Field | Value |
| --- | --- |
| Current state | State-changing routes rely on `sameSite: lax`. |
| Target state | Mutations require CSRF token or strict same-site policy plus origin validation. |
| Files to modify | `src/lib/auth.ts`, all POST/PATCH/PUT/DELETE route handlers, frontend fetch helper. |
| Files to create | `src/lib/csrf.ts`, `src/app/api/auth/csrf/route.ts`. |
| Migration required | No |
| Deployment required | Yes |
| Breaking change | Yes, for API clients without token |
| Effort | half day |

Why: Cookie auth can be abused by malicious origins to trigger state changes.
Depends on: Shared frontend API client or fetch wrapper.
Before fixing: Inventory all mutation routes and any third-party callbacks. Exclude Razorpay webhook from CSRF but keep signature verification.
Must not change yet: Do not apply CSRF to webhook routes.
Implementation steps: Add double-submit CSRF cookie/token or origin check middleware; include token header in client mutations; reject missing/invalid token with 403; set auth cookie `sameSite: strict` if OAuth/payment redirects remain compatible.
Database migrations: None.
API changes: Mutations require `x-csrf-token`.
Frontend changes: Fetch CSRF token at app load and attach to mutations.
Deployment changes: Configure allowed origins.
Rollback: Temporarily log-only CSRF failures before hard enforcement.
Testing: Cross-origin POST without token fails; normal app requests pass.
Staging checklist: Signup/login/payment/webhooks still work.
Production rollout: Deploy log-only, review, then enforce.
Hidden risks: OAuth and Razorpay return flows can break if cookie policy changes too aggressively.

### S5. Cloudinary Upload Signing Allows Overwrite Risk

| Field | Value |
| --- | --- |
| Current state | Authenticated users can influence Cloudinary params including `public_id`/folder and overwrite. |
| Target state | Server owns upload folder/public id policy and disallows cross-user overwrite. |
| Files to modify | `src/app/api/student/upload-resume/route.ts`, `src/app/api/interviewer/upload-documents/route.ts`, `src/app/api/interviewer/upload-profile-picture/route.ts`. |
| Files to create | `src/lib/cloudinary.ts`. |
| Migration required | No |
| Deployment required | Yes |
| Breaking change | No |
| Effort | 2 hours |

Why: A compromised account could overwrite another user's documents if upload params are user-controlled.
Depends on: Cloudinary account, profile document URLs.
Before fixing: Decide naming policy by user id and document type.
Must not change yet: Do not migrate existing assets until new uploads are safe.
Implementation steps: Centralize signature generation; generate `public_id` server-side as `users/{userId}/{type}/{uuid}` or deterministic self-only path; set overwrite false except for self profile picture; validate authenticated role owns target profile.
Database migrations: None.
API changes: Upload route ignores client-provided folder/public id.
Frontend changes: None or remove public-id params from client upload request.
Deployment changes: Rotate Cloudinary secret if exposure is suspected.
Rollback: Re-enable old behavior only for uploads blocked by policy, not globally.
Testing: Student cannot upload to interviewer path; duplicate upload does not overwrite unrelated asset.
Staging checklist: Resume, ID card, and profile picture uploads succeed.
Production rollout: Deploy helper and all routes together.
Hidden risks: Existing frontend may rely on old signed params; keep response shape compatible.

### S6. Email HTML Is Not Escaped

| Field | Value |
| --- | --- |
| Current state | User names/topics can be inserted into HTML email templates unsanitized. |
| Target state | All dynamic email values are escaped or rendered through a safe template helper. |
| Files to modify | `src/lib/email.ts`. |
| Files to create | Optional `src/lib/html.ts`. |
| Migration required | No |
| Deployment required | Yes |
| Breaking change | No |
| Effort | 30 min |

Why: HTML injection can spoof email content or trip scanners.
Depends on: Booking confirmation, reminders, notification emails.
Before fixing: Inventory all dynamic email fields.
Must not change yet: Do not redesign email provider at the same time.
Implementation steps: Add `escapeHtml`; wrap every user-supplied value; keep trusted static HTML unchanged.
Testing: Names with `<script>` render as text.
Hidden risks: Double-escaping if applied to already-rendered HTML blocks.

### S7. Admin Email-Based Role Assignment Is Unsafe And Incomplete

| Field | Value |
| --- | --- |
| Current state | `ADMIN_EMAILS` exists but is not consistently used; admin creation is operationally unclear. |
| Target state | Admins are assigned through controlled DB/admin process, not arbitrary signup email match. |
| Files to modify | `src/lib/auth.ts`, signup/auth routes, admin routes when added. |
| Files to create | Admin seed script or protected admin management route. |
| Migration required | Optional |
| Deployment required | Yes |
| Breaking change | No |
| Effort | half day |

Why: Email-only admin rules can grant admin to someone who registers a known admin email first.
Depends on: Signup, OAuth creation, future admin dashboard.
Before fixing: Define admin provisioning process.
Must not change yet: Do not auto-promote users from env on every login.
Implementation steps: Remove automatic role assignment from public signup; seed explicit admin users; guard admin APIs with DB role; optionally require verified email and manual promotion.
API/frontend/deploy: Admin login remains same; document operational command.
Rollback: Revert to manual DB role updates only, not env auto-promotion.
Testing: User with admin email cannot self-promote through signup.
Hidden risks: Locking out real admin if no seed path exists.

### A1. Google OAuth Can Change Existing User Roles

| Field | Value |
| --- | --- |
| Current state | Existing non-admin user role is overwritten by requested OAuth role. |
| Target state | Role is set on first creation only; existing users keep their DB role. |
| Files to modify | `src/lib/auth-options.ts`. |
| Files to create | Auth regression tests if test harness exists. |
| Migration required | No |
| Deployment required | Yes |
| Breaking change | No |
| Effort | 30 min |

Why: An interviewer can accidentally become a student by logging in from the wrong page.
Depends on: Google OAuth callback, dashboard routing.
Before fixing: None.
Must not change yet: Do not redesign pending role cookie.
Implementation steps: For existing user, do not write `role`; preserve `user.role`; only use requested role when creating a new user.
API changes: None.
Frontend changes: Optional redirect based on actual role after login.
Rollback: Revert single callback change.
Testing: Existing interviewer signs in through student login and remains interviewer.
Hidden risks: Users already corrupted need DB repair.

### A2. PendingUser Access Uses `(prisma as any).pendingUser`

| Field | Value |
| --- | --- |
| Current state | Signup/verify bypass Prisma typing. |
| Target state | Generated Prisma client exposes `pendingUser` normally. |
| Files to modify | `src/app/api/auth/signup/route.ts`, `src/app/api/auth/verify-email/route.ts`, `src/app/api/auth/resend-otp/route.ts`, generated client via build process if committed. |
| Files to create | None |
| Migration required | No, unless DB lacks table |
| Deployment required | Yes |
| Breaking change | No |
| Effort | 30 min |

Why: Runtime can fail after a clean install/build if Prisma client is stale.
Depends on: Prisma schema and migration state.
Before fixing: Run `prisma generate`; confirm migration for `pending_users` is applied in staging.
Must not change yet: Do not rewrite OTP flow.
Implementation steps: Regenerate Prisma client; replace `(prisma as any).pendingUser` with `prisma.pendingUser`; make CI/build run `prisma generate`; remove casts.
Testing: Signup, resend OTP, verify email from a fresh checkout.
Hidden risks: Production DB may lack `pending_users`; check migrations before deploy.

### A3. OAuth Pending Role Cookie Is Fragile

| Field | Value |
| --- | --- |
| Current state | Role selection cookie expires in 60 seconds and defaults to student. |
| Target state | OAuth signup role is durable through redirect or confirmed after login. |
| Files to modify | `src/lib/auth-options.ts`, signup/login pages. |
| Files to create | Optional OAuth state helper. |
| Migration required | No |
| Deployment required | Yes |
| Breaking change | No |
| Effort | 2 hours |

Why: Slow OAuth flows can create interviewer applicants as students.
Depends on: NextAuth redirect/callback behavior.
Before fixing: Fix role overwrite bug first.
Must not change yet: Do not allow existing users to switch roles through OAuth state.
Implementation steps: Increase cookie max age moderately or encode requested role in signed OAuth state/callbackUrl; on new user creation only, use validated role; redirect existing users by DB role.
Testing: Simulate delayed OAuth callback.
Hidden risks: Tampered callback role if not signed/validated.

### A4. Password Policy Is Weak

| Field | Value |
| --- | --- |
| Current state | Minimum password length is 6. |
| Target state | 8+ characters with reasonable breached/common-password checks later. |
| Files to modify | signup/change password API routes and forms. |
| Files to create | `src/lib/password-policy.ts`. |
| Migration required | No |
| Deployment required | Yes |
| Breaking change | No |
| Effort | 2 hours |

Why: Weak passwords increase credential stuffing success.
Depends on: Signup and change password flows.
Before fixing: Add user-friendly validation messages.
Must not change yet: Do not force immediate password reset for all users unless required.
Implementation steps: Centralize policy; validate server-side and client-side; optionally prompt existing users on next password change.
Testing: Boundary values and old password change flow.
Hidden risks: Too strict policy can lower conversions.

### D1. Missing Critical Database Indexes

| Field | Value |
| --- | --- |
| Current state | Hot queries for reminders, booking, upcoming counts, cleanup, and manual requests lack indexes. |
| Target state | Partial/composite indexes match production query patterns. |
| Files to modify | `prisma/schema.prisma` if Prisma-supported; otherwise migration SQL only. |
| Files to create | New Prisma migration SQL. |
| Migration required | Yes |
| Deployment required | Yes |
| Breaking change | No |
| Effort | 2 hours |

Why: Booking and reminder queries will full-scan as data grows.
Depends on: Existing table names and enum values.
Before fixing: Run `EXPLAIN ANALYZE` on staging with representative data.
Must not change yet: Do not rewrite booking algorithm until indexes are in place.
Implementation steps: Add indexes: sessions reminder lookup, slots booking lookup, sessions upcoming count, signaling createdAt, manual requests by student; use concurrent index creation for large production tables if needed.
Database migrations: `CREATE INDEX`/partial indexes listed in audit.
API/frontend changes: None.
Deployment changes: Run migration in maintenance-safe window.
Rollback: Drop new indexes if they cause planner regressions; data unaffected.
Testing: Query plans use indexes; booking still succeeds.
Hidden risks: Prisma schema may not represent partial indexes; preserve raw SQL migration.

### D2. SignalingRoom JSON Arrays Grow Unbounded And Race

| Field | Value |
| --- | --- |
| Current state | ICE candidates/chat are stored as append-only JSON arrays in one row. |
| Target state | Short term TTL cleanup; medium term move signaling off Postgres or into append-only event rows. |
| Files to modify | `src/app/api/interview-room/route.ts`, `prisma/schema.prisma`, cleanup cron route. |
| Files to create | Migration for signaling events if interim DB approach is used. |
| Migration required | Yes for interim event table; no if only external provider. |
| Deployment required | Yes |
| Breaking change | Yes for realtime internals |
| Effort | multi-day |

Why: JSON read-modify-write causes lost updates and slow row rewrites.
Depends on: Interview room pages, polling API, cleanup.
Before fixing: Choose realtime replacement in Phase 7.
Must not change yet: Do not change WebRTC UI and DB signaling schema in the same release without feature flag.
Implementation steps: Add cleanup first; then replace with LiveKit/Ably/Pusher; if interim, use `SignalingEvent` rows keyed by session and monotonic id.
Rollback: Feature flag back to DB signaling for active sessions only.
Testing: Concurrent candidate sends are not lost.
Hidden risks: Existing rooms cannot migrate mid-call; deploy between sessions or maintain dual path.

### D3. Cascade Deletes Remove Session And Feedback History

| Field | Value |
| --- | --- |
| Current state | User/profile deletion cascades through sessions and feedback. |
| Target state | Soft delete or anonymization preserves business records. |
| Files to modify | `prisma/schema.prisma`, delete/deactivate routes when present, queries filtering active users. |
| Files to create | Migration adding `deletedAt` fields. |
| Migration required | Yes |
| Deployment required | Yes |
| Breaking change | Yes for delete semantics |
| Effort | full day |

Why: Feedback and session history are business records and interviewer reputation inputs.
Depends on: Account deletion policy and compliance requirements.
Before fixing: Define retention/anonymization policy.
Must not change yet: Do not alter cascades before all reads understand soft delete.
Implementation steps: Add `deletedAt` to user/profile; update delete to deactivate/anonymize; update queries to filter active by default; later relax cascade rules.
Testing: Deleted student no longer logs in; interviewer feedback aggregate remains.
Hidden risks: Privacy laws may require true deletion for some data.

### D4. Difficulty Migration May Have Lost Existing Values

| Field | Value |
| --- | --- |
| Current state | Old `DifficultyLevel` enum coexists in schema while sessions use nullable `InterviewDifficulty`; audit notes data loss risk. |
| Target state | Historical values are mapped or confirmed intentionally discarded. |
| Files to modify | `prisma/schema.prisma`, historical migration only if creating corrective migration. |
| Files to create | Data repair migration/script if needed. |
| Migration required | Maybe |
| Deployment required | Maybe |
| Breaking change | No |
| Effort | 2 hours |

Why: Analytics and session matching can be wrong if difficulty data vanished.
Depends on: Production data snapshot.
Before fixing: Query production/staging to count null difficulty on past sessions.
Must not change yet: Do not remove enum until data audit is complete.
Implementation steps: Map old EASY/MEDIUM/HARD to ENTRY/MID/SENIOR if recoverable; make difficulty required for new interview sessions if product needs it.
Testing: Booking creates expected difficulty.
Hidden risks: Original values may be unrecoverable without backup.

### RLY1. Cron Scheduler And Reminder `setTimeout` Do Not Work On Vercel

| Field | Value |
| --- | --- |
| Current state | `node-cron` and `setTimeout` assume persistent process. |
| Target state | Vercel Cron or external worker invokes idempotent reminder API. |
| Files to modify | `src/lib/scheduler.ts`, `src/lib/email.ts`, `src/app/api/scheduler/init/route.ts`, `vercel.json`. |
| Files to create | `src/app/api/cron/session-reminders/route.ts`. |
| Migration required | Maybe, if adding email jobs table |
| Deployment required | Yes |
| Breaking change | No |
| Effort | half day |

Why: Reminder emails silently never send in serverless.
Depends on: Email sending, session reminder fields, cron secret.
Before fixing: Choose Vercel Cron for simple reminders or worker/queue for retries.
Must not change yet: Do not rely on in-memory `isSchedulerRunning`.
Implementation steps: Create authenticated cron route that queries due sessions, sends reminders, marks `reminderSent` in a transaction; configure Vercel cron; remove/manual-disable scheduler init; delete or quarantine `scheduleSessionReminder` dead code.
Database migrations: Optional `EmailJob` table for robust retries.
API changes: New `GET /api/cron/session-reminders` requiring `CRON_SECRET`.
Frontend changes: None.
Deployment changes: Add cron schedule in `vercel.json`; set `CRON_SECRET`.
Rollback: Disable cron schedule; route can remain unused.
Testing: Due session sends once; repeated cron call does not duplicate.
Hidden risks: Email provider rate limits; use batching.

### RLY2. Signaling Cleanup Uses Serverless `setTimeout`

| Field | Value |
| --- | --- |
| Current state | `scheduleCleanup` uses a 4-hour timer in an API invocation. |
| Target state | Cleanup is cron-driven by `createdAt`/`updatedAt` TTL. |
| Files to modify | `src/app/api/interview-room/route.ts`, `vercel.json`. |
| Files to create | `src/app/api/cron/cleanup-signaling-rooms/route.ts`. |
| Migration required | Yes, index only |
| Deployment required | Yes |
| Breaking change | No |
| Effort | 2 hours |

Why: Rooms never clean up on Vercel, causing table growth.
Depends on: `SignalingRoom.createdAt` index.
Before fixing: Add cleanup index.
Must not change yet: Do not delete rooms for active scheduled sessions.
Implementation steps: Remove process timer; cron deletes rooms older than TTL where session is completed/cancelled or scheduled time older than safe buffer.
Testing: Active room survives; stale room deleted.
Hidden risks: Clock/timezone mismatches.

### RLY3. Email Sending Has No Retry Or Alerting

| Field | Value |
| --- | --- |
| Current state | Booking emails are fire-and-forget with console error. |
| Target state | Email delivery is job-backed or at least logged and retryable. |
| Files to modify | booking routes, `src/lib/email.ts`. |
| Files to create | Optional `EmailJob` model/migration and cron processor. |
| Migration required | Recommended |
| Deployment required | Yes |
| Breaking change | No |
| Effort | half day |

Why: Users can miss booked sessions with no operator visibility.
Depends on: Transactional email provider, booking transaction.
Before fixing: Decide whether to adopt Resend/SendGrid.
Must not change yet: Do not block booking success on transient email failure unless product requires it.
Implementation steps: Persist email jobs after booking commit; worker/cron sends with retry count/backoff; capture failures in Sentry.
Testing: SMTP failure creates retryable job.
Hidden risks: Duplicate emails if idempotency key absent.

### RLY4. Missing Environment Validation

| Field | Value |
| --- | --- |
| Current state | Required env vars fail late at runtime. |
| Target state | Startup/build-time validation fails loudly. |
| Files to modify | `next.config.js`, app bootstrap imports, `.env.example`. |
| Files to create | `src/lib/env.ts`. |
| Migration required | No |
| Deployment required | Yes |
| Breaking change | No |
| Effort | 2 hours |

Why: Missing secrets break payments, OAuth, AI, uploads, cron, or auth only when users hit routes.
Depends on: Complete env inventory.
Before fixing: Classify required vs feature-optional env vars.
Implementation steps: Add schema validation; import server env in route helpers; document all variables.
Testing: Build fails when required env missing.
Hidden risks: Build-time validation can fail preview deployments that intentionally disable features; support optional flags.

### RLY5. No Error Monitoring Or Structured Logging

| Field | Value |
| --- | --- |
| Current state | `console.error` is primary incident signal. |
| Target state | Sentry or equivalent captures exceptions and important business failures. |
| Files to modify | Next config/instrumentation, route error handlers. |
| Files to create | `sentry.*.config.ts` or provider equivalent. |
| Migration required | No |
| Deployment required | Yes |
| Breaking change | No |
| Effort | 2 hours |

Why: Payment/email/video/AI failures will be invisible until users complain.
Before fixing: Pick provider and define PII redaction.
Implementation steps: Install/configure Sentry; tag user id/role where safe; capture payment webhook failures, email failures, AI timeouts.
Rollback: Disable DSN env.
Testing: Send test exception in staging.
Hidden risks: Logging sensitive resume/payment data; redact aggressively.

### FE1. Student And Interviewer Layouts Are God Components

| Field | Value |
| --- | --- |
| Current state | `student/layout.tsx` and `interviewer/layout.tsx` mix layout, settings, theme, profile fetch, and logout. |
| Target state | Layout shell delegates to small client components/hooks. |
| Files to modify | `src/app/student/layout.tsx`, `src/app/interviewer/layout.tsx`. |
| Files to create | `src/components/layout/*`, `src/hooks/useTheme.ts`, `src/hooks/useCurrentUser.ts`. |
| Migration required | No |
| Deployment required | Yes |
| Breaking change | No |
| Effort | full day |

Why: Large stateful layouts are hard to test and easy to break.
Depends on: Stable auth/profile APIs.
Before fixing: Add error boundaries first.
Must not change yet: Do not redesign visual navigation.
Implementation steps: Extract sidebar/topbar/settings modal/theme hook/profile menu; keep props/API identical; test student and interviewer shells.
Testing: Navigation, logout, settings modal, mobile drawer.
Hidden risks: Layout server/client boundary mistakes in App Router.

### FE2. No Error Boundaries

| Field | Value |
| --- | --- |
| Current state | Dashboard errors can white-screen full UI. |
| Target state | Route-level `error.tsx` and component-level fallbacks around risky client widgets. |
| Files to modify/create | `src/app/student/error.tsx`, `src/app/interviewer/error.tsx`, room-level error files, shared error UI. |
| Migration required | No |
| Deployment required | Yes |
| Breaking change | No |
| Effort | 2 hours |

Why: One failed fetch or render error can destroy core workflow.
Before fixing: None.
Implementation steps: Add App Router error files; add reset button; capture errors to monitoring.
Testing: Throw test error in staging route and recover.
Hidden risks: Error boundary cannot catch async errors outside render unless handled.

### FE3. Theme Persistence Causes FOUC

| Field | Value |
| --- | --- |
| Current state | Theme is stored in localStorage after first render. |
| Target state | Initial theme is available before paint via cookie/script. |
| Files to modify | `src/app/layout.tsx`, layout components, theme hook. |
| Files to create | Optional `src/components/theme/ThemeScript.tsx`. |
| Migration required | No |
| Deployment required | Yes |
| Breaking change | No |
| Effort | 2 hours |

Why: Users see a flash of wrong theme.
Implementation steps: Use inline pre-hydration script or cookie-backed theme; set html class before React hydration.
Testing: Reload dark mode page with throttled CPU.
Hidden risks: Hydration mismatch if server and client disagree.

### FE4. Interview Room Pages Are 1200+ Lines

| Field | Value |
| --- | --- |
| Current state | WebRTC state machine, chat, notes, AI, UI are in one page per role. |
| Target state | Room is composed of hooks/components with realtime implementation isolated. |
| Files to modify | `src/app/student/interview-room/[sessionId]/page.tsx`, `src/app/interviewer/interview-room/[sessionId]/page.tsx`. |
| Files to create | `src/features/interview-room/*`, hooks for media/signaling/chat/notes. |
| Migration required | No |
| Deployment required | Yes |
| Breaking change | No |
| Effort | multi-day |

Why: WebRTC bugs currently risk the entire UI and are hard to test.
Depends on: Realtime architecture decision. Do not refactor deeply before Phase 7 unless extracting pure UI.
Must not change yet: Do not preserve DB polling abstraction as a permanent interface.
Implementation steps: First extract presentational components; then isolate room state; after LiveKit/Ably decision, implement provider-specific hook behind feature flag.
Testing: Join/leave, reconnect, chat, notes, feedback, permissions.
Hidden risks: Active sessions during deploy can break if room protocol changes.

### FE5. Inefficient Fetching And Rendering

| Field | Value |
| --- | --- |
| Current state | Profile saves refetch sessions; complex lists rerender broadly; Suspense is used as generic loading. |
| Target state | Profile and sessions have separate cache keys, scoped refetch, memoized heavy lists. |
| Files to modify | dashboard pages/layouts, profile forms, session lists. |
| Files to create | Shared hooks using SWR already in dependencies. |
| Migration required | No |
| Deployment required | Yes |
| Breaking change | No |
| Effort | half day |

Why: Unnecessary DB/API traffic and UI churn increase latency.
Before fixing: Add rate limiting and indexes for backend hot paths first.
Implementation steps: Use SWR keys by resource; mutate profile only after profile save; memoize list item components; keep loading states local.
Testing: Profile save does not refetch sessions.
Hidden risks: Stale caches after booking; invalidate sessions after booking.

### FE6. Production UX Uses `alert()` And Popup Join Flow

| Field | Value |
| --- | --- |
| Current state | Alerts block thread; `window.open` can be blocked. |
| Target state | Toasts/inline errors and normal router navigation. |
| Files to modify | booking pages, join button, dashboards. |
| Files to create | `src/components/ui/Toast.tsx` or add a toast library. |
| Migration required | No |
| Deployment required | Yes |
| Breaking change | No |
| Effort | half day |

Why: Blocking dialogs feel unprofessional and can disrupt routing.
Implementation steps: Add toast provider; replace alerts; change join room to direct link/button with router navigation.
Testing: Booking success/error and join room on mobile.
Hidden risks: Toast provider placement in server/client layout.

### FE7. Media/Image And Ref Hygiene

| Field | Value |
| --- | --- |
| Current state | Some video refs are not guarded; profile images use `<img>`. |
| Target state | Null-safe media assignment and `next/image` where possible. |
| Files to modify | room pages/components, profile/dashboard components, `next.config.js` image domains. |
| Migration required | No |
| Deployment required | Yes |
| Breaking change | No |
| Effort | 2 hours |

Why: Null ref errors crash room UI; unoptimized images hurt performance.
Testing: Camera unavailable/null states; Cloudinary and Google images render.
Hidden risks: `next/image` remote patterns must include Cloudinary/Google.

### RT1. PostgreSQL Polling For WebRTC Signaling

| Field | Value |
| --- | --- |
| Current state | Every active pair polls DB every 1.5s, causing high query rate. |
| Target state | Managed realtime channel or LiveKit handles signaling/media. |
| Files to modify | `src/app/api/interview-room/route.ts`, room pages, package/env, `prisma/schema.prisma` later cleanup. |
| Files to create | `src/lib/livekit.ts` or `src/lib/realtime.ts`, token route if LiveKit. |
| Migration required | Eventually yes to remove old table; no for first dual-run. |
| Deployment required | Yes |
| Breaking change | Yes internally |
| Effort | multi-day |

Why: This is the primary scalability bottleneck and has race conditions.
Depends on: Phase 1-5 stabilization, TURN/realtime provider decision.
Before fixing: Add TURN as emergency reliability patch; choose LiveKit if using existing deps.
Must not change yet: Do not delete DB signaling until new path is stable.
Implementation steps: Add provider env; create room token API; update student/interviewer rooms to join provider room; preserve session authorization; feature flag by session; stop polling for flagged sessions; retain old API for rollback.
Testing: 1:1 call, reconnect, NAT scenarios, mobile browser, concurrent sessions.
Hidden risks: Provider billing, browser permission edge cases, active session incompatibility.

### RT2. No TURN Server

| Field | Value |
| --- | --- |
| Current state | Only STUN servers configured. |
| Target state | TURN is configured or LiveKit handles relay. |
| Files to modify | room WebRTC config or LiveKit config. |
| Files to create | Env validation entries. |
| Migration required | No |
| Deployment required | Yes |
| Breaking change | No |
| Effort | 2 hours |

Why: STUN fails for a meaningful share of real networks.
Before fixing: Pick Twilio TURN, Metered, coturn, or LiveKit Cloud.
Implementation steps: Add TURN credentials to `iceServers`; surface connection failure guidance.
Testing: Force relay-only in browser/WebRTC internals.
Hidden risks: TURN credentials must be short-lived if possible.

### RT3. Fragile WebRTC Negotiation Logic

| Field | Value |
| --- | --- |
| Current state | Manual rollback and offer flags can race. |
| Target state | Perfect negotiation pattern or provider-managed negotiation. |
| Files to modify | room pages/hooks. |
| Migration required | No |
| Deployment required | Yes |
| Breaking change | No |
| Effort | full day if staying custom; included in LiveKit migration otherwise |

Why: Reconnects can fail silently.
Before fixing: Decide whether custom WebRTC survives Phase 7. If LiveKit is chosen, do not spend full day here beyond critical TURN.
Testing: Disconnect/reconnect mid-ICE, camera switch, tab refresh.
Hidden risks: Browser-specific behavior.

### AI1. Groq Calls Lack Timeout

| Field | Value |
| --- | --- |
| Current state | Groq fetches can hang until route timeout. |
| Target state | All external AI calls use timeout and graceful fallback. |
| Files to modify | `src/app/api/ai/feedback/route.ts`, `src/app/api/ai/notes/route.ts`, behavior analysis code in room/API if separate. |
| Files to create | `src/lib/ai/groq.ts`. |
| Migration required | No |
| Deployment required | Yes |
| Breaking change | No |
| Effort | 30 min |

Why: Slow Groq degrades UX and consumes serverless duration.
Implementation steps: Centralize Groq fetch with `AbortSignal.timeout(15000)`; return 503/timeout-specific state.
Testing: Mock timeout.
Hidden risks: Node runtime support for `AbortSignal.timeout`; polyfill if needed.

### AI2. Prompt Injection In Behavior Analysis

| Field | Value |
| --- | --- |
| Current state | User/interviewer messages are interpolated into instruction text. |
| Target state | System/developer instructions are separated from user content and model output is schema-validated. |
| Files to modify | AI behavior analysis route/code. |
| Files to create | `src/lib/ai/prompts.ts`, schema parser helper. |
| Migration required | No |
| Deployment required | Yes |
| Breaking change | No |
| Effort | 2 hours |

Why: A participant can manipulate conduct scoring.
Implementation steps: Use role-separated messages; wrap transcript as data; explicitly instruct model to treat transcript as untrusted; validate JSON response and clamp scores.
Testing: Injection transcript does not force green/100.
Hidden risks: LLMs remain probabilistic; do not use score as sole enforcement.

### AI3. AI Failure Defaults To Perfect Green Score

| Field | Value |
| --- | --- |
| Current state | Failure returns score 100/green. |
| Target state | Failure returns neutral/unknown and logs the failure. |
| Files to modify | Behavior analysis route/code. |
| Migration required | No |
| Deployment required | Yes |
| Breaking change | No |
| Effort | 30 min |

Why: Monitoring failure should not certify perfect conduct.
Implementation steps: Return `flag: "unknown"` or neutral score with `analysisUnavailable: true`; update UI copy.
Testing: Groq failure shows unavailable state.
Hidden risks: Existing frontend may expect only red/yellow/green.

### AI4. No Streaming Or Cost Tracking

| Field | Value |
| --- | --- |
| Current state | Feedback generation is synchronous and token usage is not tracked. |
| Target state | Streaming UX and token usage logs by route/user/session. |
| Files to modify | AI routes and feedback UI. |
| Files to create | Optional `AiUsageLog` model, streaming route helper. |
| Migration required | Yes for durable cost logs |
| Deployment required | Yes |
| Breaking change | No |
| Effort | full day |

Why: Users wait blindly and operators cannot monitor abuse/cost.
Before fixing: Add timeouts first.
Implementation steps: Log Groq usage metadata where available; add per-user AI rate limit; stream feedback with readable stream or polling job.
Testing: Long response streams incrementally; usage row created.
Hidden risks: Streaming complicates error handling and Vercel limits.

### DEV1. Scheduler Init Route Requires Manual Call

| Field | Value |
| --- | --- |
| Current state | `/api/scheduler/init` must be manually invoked and still cannot keep process alive. |
| Target state | Route is removed or returns deprecated; cron schedule is declarative. |
| Files to modify | `src/app/api/scheduler/init/route.ts`, `vercel.json`, docs. |
| Migration required | No |
| Deployment required | Yes |
| Breaking change | No |
| Effort | 30 min after cron replacement |

Why: Manual post-deploy steps are easy to miss and ineffective on serverless.
Implementation steps: Replace with Vercel Cron routes; remove runbook instruction to call init.
Testing: Deployment does not require manual scheduler init.

### DEV2. Transactional Email Provider Risk

| Field | Value |
| --- | --- |
| Current state | Nodemailer likely uses Gmail SMTP limits. |
| Target state | Resend/SendGrid/Postmark handles transactional volume and deliverability. |
| Files to modify | `src/lib/email.ts`, env validation. |
| Files to create | Provider adapter. |
| Migration required | No |
| Deployment required | Yes |
| Breaking change | No |
| Effort | half day |

Why: Gmail quotas can block reminders/confirmations as bookings grow.
Before fixing: Add email jobs/retries or at least adapter interface.
Implementation steps: Implement provider adapter; keep templates; configure SPF/DKIM; monitor bounces.
Testing: Staging domain sends to test inbox.
Hidden risks: Domain DNS setup delay.

### SCALE1. No Caching For Hot Reads

| Field | Value |
| --- | --- |
| Current state | Profiles, interviewer lists, counts, leaderboard-style data hit DB directly. |
| Target state | Redis/SWR caching for hot and safe-to-cache reads. |
| Files to modify | profile/list/session API routes, frontend hooks. |
| Files to create | `src/lib/cache.ts`. |
| Migration required | No |
| Deployment required | Yes |
| Breaking change | No |
| Effort | full day |

Why: After signaling is fixed, repeated DB reads become next bottleneck.
Before fixing: Add indexes and rate limiting Redis first.
Must not change yet: Do not cache auth-sensitive mutable entitlements without invalidation.
Implementation steps: Cache interviewer lists and profile reads with short TTL; invalidate after profile update/booking; use SWR client cache.
Testing: Cache hit/miss; stale entitlement does not allow unpaid access.
Hidden risks: Incorrect invalidation can show stale slots.

### SCALE2. Large Lists Lack Pagination/Search Boundaries

| Field | Value |
| --- | --- |
| Current state | Some routes fetch broad session/interviewer lists. |
| Target state | Cursor/limit pagination and indexed filters. |
| Files to modify | `src/app/api/student/sessions/route.ts`, `src/app/api/interviewer/sessions/route.ts`, `src/app/api/interviewer/list/route.ts`, UI list pages. |
| Files to create | Pagination helpers. |
| Migration required | Maybe indexes |
| Deployment required | Yes |
| Breaking change | Yes, if response shape changes |
| Effort | full day |

Why: Full list fetches degrade with user history.
Before fixing: Frontend should support incremental loading.
Implementation steps: Add backwards-compatible `limit/cursor`; return `nextCursor`; update UI.
Testing: Old callers still work or are migrated together.
Hidden risks: Sort order must be stable.

## Master Execution Order

Do not reorder across phases unless a production incident forces it.

1. R1 payment amount
2. R2 Razorpay webhook
3. R3 unlock payment data model
4. S1 auth rate limits
5. S2 SSRF closure
6. S4 CSRF log-only then enforce
7. S5 Cloudinary upload policy
8. S6 email escaping
9. A1 OAuth role preservation
10. A2 Prisma pending user typing/generate
11. A3 OAuth pending role durability
12. S3 JWT invalidation/session versioning
13. A4 password policy
14. D1 database indexes
15. D4 difficulty data audit
16. RLY1 cron reminders
17. RLY2 signaling cleanup
18. RLY3 email retry/jobs
19. RLY4 env validation
20. RLY5 error monitoring
21. FE2 error boundaries
22. FE1 layout extraction
23. FE3 theme FOUC
24. FE5 fetch/cache hygiene
25. FE6 toast/join UX
26. FE7 media/image hygiene
27. RT2 TURN
28. RT1 LiveKit/managed realtime migration
29. RT3 negotiation cleanup only if custom WebRTC remains
30. AI1 timeouts
31. AI3 neutral failure state
32. AI2 prompt-injection hardening
33. AI4 streaming/cost tracking
34. DEV1 remove scheduler init
35. DEV2 transactional email provider
36. SCALE1 Redis caching
37. SCALE2 pagination/search boundaries
38. D3 soft deletes/anonymization

## Phase Plans

### Phase 1 - Revenue Protection

Preconditions: Production price confirmed; Razorpay test credentials and webhook secret available; database migration process verified.
Implementation steps: Fix server price; add webhook and event idempotency; keep client verify as fallback; split unlock payments into `FeatureUnlock`.
Testing: Razorpay test order success/failure/duplicate webhook; browser closed after payment still grants access.
Rollback plan: Disable webhook in Razorpay dashboard and rely on existing verify; revert price constant if needed; keep additive tables.
Go/no-go: Go only if order amount is correct, webhook signature verification passes, and entitlements are idempotent.

### Phase 2 - Security

Preconditions: Redis provisioned; env validation plan drafted; list of mutation routes complete.
Implementation steps: Rate limit auth; remove/harden LinkedIn sync; add CSRF log-only then enforce; lock Cloudinary upload params; escape email HTML; define admin provisioning.
Testing: Abuse tests for OTP/login; malicious URL tests; CSRF cross-origin test; upload path ownership test.
Rollback plan: Feature flags for CSRF/rate limits; LinkedIn sync remains disabled if uncertain.
Go/no-go: Go only if legitimate signup/login/upload/payment flows pass and attack cases fail.

### Phase 3 - Authentication

Preconditions: Phase 2 rate limiting complete; Prisma generate verified; admin provisioning defined.
Implementation steps: Preserve existing OAuth roles; remove `(prisma as any)`; make OAuth requested role durable for new users only; add token version/session invalidation; improve password policy.
Testing: Existing interviewer/student/admin login; role change invalidates old token; signup/verify/resend OTP.
Rollback plan: Disable token-version enforcement while keeping columns; revert OAuth callback logic if login blocks appear.
Go/no-go: Go only if no existing role can be downgraded by login and revoked accounts lose access.

### Phase 4 - Database

Preconditions: Backup/snapshot available; staging data loaded; migration window selected.
Implementation steps: Add indexes; audit difficulty values; prepare signaling cleanup index; defer soft delete until reads are updated.
Testing: `EXPLAIN` hot queries; booking concurrency; reminder query; migration rollback dry run.
Rollback plan: Drop new indexes if planner regressions occur; data repair scripts must be reversible from backup.
Go/no-go: Go if migrations apply cleanly and query plans improve.

### Phase 5 - Reliability

Preconditions: Cron secret configured; monitoring provider selected; email provider/SMTP limits understood.
Implementation steps: Replace node-cron and setTimeout reminders with cron route; add signaling cleanup cron; introduce email job/retry; add env validation; add Sentry/structured logging.
Testing: Cron idempotency; duplicate reminder prevention; missing env fails fast; captured test exception.
Rollback plan: Disable cron schedules; keep routes inert; turn off monitoring DSN if noisy.
Go/no-go: Go if reminders send exactly once and failures are observable.

### Phase 6 - Frontend Refactor

Preconditions: Error monitoring live; backend auth/payment stable.
Implementation steps: Add route error boundaries; extract layout components; fix theme prepaint; separate profile/session fetching; replace alerts with toasts; guard refs and use `next/image`.
Testing: Responsive navigation, settings, profile save, booking, room entry, dark reload.
Rollback plan: Revert component extraction by route if regression; keep error boundaries.
Go/no-go: Go if no route loses auth gating or navigation behavior.

### Phase 7 - Realtime System

Preconditions: Phase 5 monitoring live; TURN/provider credentials ready; active session deploy window chosen.
Implementation steps: Add TURN immediately; implement LiveKit or managed realtime behind feature flag; add token route with session authorization; dual-run with old DB signaling; cut over new sessions; cleanup old rooms later.
Testing: NAT/relay test, reconnect, mobile, two simultaneous sessions, permission denied cases.
Rollback plan: Feature flag back to DB signaling for new sessions; keep old API until confidence window ends.
Go/no-go: Go if call setup succeeds under relay-only and DB query rate drops.

### Phase 8 - AI Improvements

Preconditions: Reliability monitoring active; AI routes identified; Redis rate limiter available.
Implementation steps: Add Groq timeout helper; neutral failure states; prompt injection hardening; output validation; token usage logging; then streaming.
Testing: Timeout, malicious transcript, malformed model output, usage log creation, streaming cancel.
Rollback plan: Disable streaming and fall back to synchronous timeout path.
Go/no-go: Go if AI failure never returns false perfect scores.

### Phase 9 - DevOps

Preconditions: Env validation implemented; deployment environments documented.
Implementation steps: Remove scheduler init runbook; formalize Vercel cron; transactional email provider with DNS; complete `.env.example`; CI build with Prisma generate and migrations policy.
Testing: Fresh environment boots only with valid env; preview deployment behavior documented.
Rollback plan: Revert provider adapter to SMTP temporarily.
Go/no-go: Go if a new engineer can deploy without hidden manual calls.

### Phase 10 - Scalability

Preconditions: Realtime no longer uses DB polling; indexes deployed; Redis available.
Implementation steps: Cache hot reads; add pagination; move email to provider; add read replicas only after query metrics justify; plan soft deletes/anonymization.
Testing: Load test 50/200 concurrent sessions; cache invalidation; pagination consistency.
Rollback plan: Disable cache by env; keep pagination backwards-compatible for one release.
Go/no-go: Go if DB query rate and p95 latency improve without stale entitlement bugs.

## Master Checklist

- [ ] Production pricing constant corrected and verified in Razorpay dashboard.
- [ ] Razorpay webhook route deployed with signature verification and idempotency.
- [ ] Unlock payments moved out of `ManualBookingRequest`.
- [ ] Redis-backed rate limits on login, OTP verify, OTP resend.
- [ ] LinkedIn photo SSRF route removed or hardened.
- [ ] CSRF protection deployed, first log-only then enforced.
- [ ] Cloudinary upload params are server-owned.
- [ ] Email templates escape user content.
- [ ] OAuth no longer changes existing user roles.
- [ ] `prisma.pendingUser` typed access works after fresh `prisma generate`.
- [ ] JWT/session invalidation implemented for role/suspension/password changes.
- [ ] Critical DB indexes deployed.
- [ ] Vercel Cron or worker handles reminders.
- [ ] Signaling cleanup is cron-driven.
- [ ] Email jobs/retry/monitoring in place.
- [ ] Env validation and `.env.example` complete.
- [ ] Error monitoring live.
- [ ] Error boundaries added to student/interviewer/room routes.
- [ ] Layouts and room pages decomposed safely.
- [ ] TURN configured.
- [ ] DB polling replaced by LiveKit/managed realtime.
- [ ] Groq timeout, safe fallback, prompt hardening, and usage tracking implemented.
- [ ] Scheduler init route removed/deprecated.
- [ ] Hot reads cached and large lists paginated.

## Dependency Graph

```text
R1 -> R2 -> R3
S1 -> A3 -> S3
S1 -> AI4
S2 -> FE6
S4 -> all mutation routes
S5 -> FE7
A1 -> A3 -> S3
A2 -> auth stability
D1 -> RLY1
D1 -> SCALE1
D1 -> RT1 cleanup
RLY4 -> all deployment phases
RLY5 -> FE refactor, RT migration, AI rollout
FE2 -> FE1 -> FE4
RT2 -> RT1
RT1 -> SCALE1
AI1 -> AI3 -> AI2 -> AI4
RLY1 -> DEV1
RLY3 -> DEV2
SCALE1 -> SCALE2
D3 last, after query layer supports soft delete
```

## Risk Matrix

| Risk | Likelihood | Impact | Phase | Mitigation |
| --- | --- | --- | --- | --- |
| Wrong payment amount remains live | High | Critical | 1 | Server constant, staging Razorpay check, production smoke test. |
| Webhook/client verify race | High | High | 1 | Transactional idempotency and unique payment ids. |
| OTP brute force | High | Critical | 2 | Redis rate limits and lockouts. |
| SSRF through LinkedIn sync | Medium | Critical | 2 | Remove route or strict URL/IP policy. |
| CSRF rollout breaks legitimate flows | Medium | High | 2 | Log-only period and webhook exclusions. |
| OAuth role corruption | High | High | 3 | Preserve DB role for existing users. |
| Token invalidation adds DB latency | Medium | Medium | 3 | Session version cache/Redis. |
| Index migration locks table | Low/Medium | High | 4 | Concurrent indexes for large prod tables. |
| Reminders duplicate | Medium | Medium | 5 | Idempotent `reminderSent` transaction/job keys. |
| Frontend refactor regresses navigation | Medium | Medium | 6 | Route-level rollout and visual smoke tests. |
| Realtime migration breaks active calls | Medium | Critical | 7 | Feature flag new sessions, keep DB fallback. |
| TURN costs spike | Medium | Medium | 7 | Usage monitoring and provider limits. |
| AI prompt injection persists | Medium | Medium | 8 | Role-separated prompts and schema validation. |
| Cache serves stale entitlement/slots | Medium | High | 10 | Short TTL and explicit invalidation. |

## Estimated Total Engineering Hours

| Area | Estimate |
| --- | ---: |
| Phase 1 Revenue Protection | 8-12 hours |
| Phase 2 Security | 16-24 hours |
| Phase 3 Authentication | 8-14 hours |
| Phase 4 Database | 6-12 hours |
| Phase 5 Reliability | 14-24 hours |
| Phase 6 Frontend Refactor | 24-40 hours |
| Phase 7 Realtime System | 40-80 hours |
| Phase 8 AI Improvements | 12-24 hours |
| Phase 9 DevOps | 8-16 hours |
| Phase 10 Scalability | 24-48 hours |
| Total | 160-294 hours |

Recommended staffing: one senior full-stack engineer can complete Phases 1-5 in roughly 1-2 focused weeks. Phase 7 deserves its own implementation/testing window because it changes the core live-session architecture.
