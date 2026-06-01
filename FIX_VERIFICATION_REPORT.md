# Fix Verification Report

Verification date: 2026-06-01

Scope: original technical audit, `docs/remediation-playbook.md`, `CHANGELOG.md`, current repository code, Prisma schema, migrations, TypeScript build, and production build.

Validation run:

- `npx prisma validate`: passed
- `npx tsc --noEmit`: passed
- `npm run build`: passed

Important: this report treats the changelog as a claim list only. Evidence below comes from repository code.

## 1. Pricing Centralization

### Original Audit Requirement

Move the Pro subscription amount to one server-owned pricing source and make frontend display the same canonical price.

### What Was Implemented

`src/lib/pricing.ts` defines Pro price constants. Payment order creation and visible Pro UI import those constants.

### Files Changed

- `src/lib/pricing.ts`
- `src/app/api/payment/create-order/route.ts`
- `src/components/shared/PaymentGate.tsx`
- `src/app/student/layout.tsx`
- `src/app/student/dashboard/page.tsx`
- `src/app/api/student/book/interview/route.ts`
- `src/app/api/student/book/guidance/route.ts`

### Verification Result

FULLY FIXED

### Evidence

- `src/lib/pricing.ts:1` defines `PRO_PLAN_AMOUNT_PAISE = 9900`.
- `src/lib/pricing.ts:3` derives `PRO_PLAN_PRICE_DISPLAY`.
- `src/app/api/payment/create-order/route.ts:5` imports `PRO_PLAN_AMOUNT_PAISE`.
- `src/app/api/payment/create-order/route.ts:31`, `src/app/api/payment/create-order/route.ts:45`, and `src/app/api/payment/create-order/route.ts:54` use the central amount for Razorpay, DB audit row, and API response.
- Frontend references import the display constant, for example `src/components/shared/PaymentGate.tsx:157`, `src/components/shared/PaymentGate.tsx:191`, `src/app/student/layout.tsx:598`, and `src/app/student/dashboard/page.tsx:1160`.

### Remaining Risks

No test asserts the price constant cannot regress.

### Recommended Action

Add a small unit or build-time assertion that Pro amount remains `9900` until intentionally changed.

### Estimated Fix Time

15 minutes.

## 2. Rs 99 Payment Correction

### Original Audit Requirement

Correct the Razorpay Pro plan order amount from Rs 1 to Rs 99.

### What Was Implemented

The subscription order route now passes `9900` paise to Razorpay.

### Files Changed

- `src/lib/pricing.ts`
- `src/app/api/payment/create-order/route.ts`

### Verification Result

FULLY FIXED

### Evidence

- `src/lib/pricing.ts:1` defines `9900` paise.
- `src/app/api/payment/create-order/route.ts:30-38` creates the Razorpay order using `amount: PRO_PLAN_AMOUNT_PAISE`.
- `src/app/api/payment/create-order/route.ts:41-50` stores the same amount in `Subscription`.

### Remaining Risks

Existing stale Razorpay orders created before this patch at Rs 1 can still complete through client verification if they exist.

### Recommended Action

Expire or manually reject old pending test orders in Razorpay and the database before production launch.

### Estimated Fix Time

30 minutes operational cleanup.

## 3. FeatureUnlock Migration

### Original Audit Requirement

Stop using `ManualBookingRequest` as a payment placeholder for preferred-interviewer unlocks. Add a dedicated feature unlock model/table and update order/verify flows.

### What Was Implemented

`FeatureUnlock` was added to Prisma, a migration creates `feature_unlocks`, unlock order creation writes to `featureUnlock`, and unlock verification reads from `featureUnlock` first.

### Files Changed

- `prisma/schema.prisma`
- `prisma/migrations/20260531000200_add_feature_unlocks/migration.sql`
- `src/app/api/payment/create-unlock-order/route.ts`
- `src/app/api/payment/unlock-preferred-interviewer/route.ts`
- `src/app/api/student/book/manual-request/route.ts`

### Verification Result

PARTIALLY FIXED

### Evidence

- `prisma/schema.prisma:206-219` defines `FeatureUnlock`.
- `prisma/migrations/20260531000200_add_feature_unlocks/migration.sql:5-19` creates the table.
- `prisma/migrations/20260531000200_add_feature_unlocks/migration.sql:21-23` adds order/payment uniqueness and student lookup index.
- `src/app/api/payment/create-unlock-order/route.ts:48-57` creates `prisma.featureUnlock`.
- `src/app/api/payment/unlock-preferred-interviewer/route.ts:36-69` verifies against `featureUnlock` and sets `preferredInterviewerUnlocked`.
- `src/app/api/student/book/manual-request/route.ts:64-75` creates a fresh real manual request after unlock instead of using the payment row.

### Remaining Risks

- The migration backfills old placeholder rows into `feature_unlocks` but does not delete or mark the old `manual_booking_requests`, so ghost rows remain unless filtered everywhere. Evidence: migration inserts at `20260531000200_add_feature_unlocks/migration.sql:30-61` but contains no delete/update of source rows.
- The verification route keeps a legacy fallback that still updates `ManualBookingRequest` for old orders at `src/app/api/payment/unlock-preferred-interviewer/route.ts:71-105`.
- There is still no Razorpay webhook, so unlock entitlement is still client-verification dependent.

### Recommended Action

Add a cleanup/contract migration for old placeholder manual requests or mark them with an explicit legacy status. Keep the fallback only for a time-boxed release and add webhook-driven unlock processing.

### Estimated Fix Time

Half day.

## 4. OAuth Role Overwrite Fix

### Original Audit Requirement

Existing Google OAuth users must keep their database role on later logins. Requested OAuth role should only be used when creating a new user.

### What Was Implemented

Existing-user update no longer writes `role`; new-user creation still uses the requested role.

### Files Changed

- `src/lib/auth-options.ts`

### Verification Result

FULLY FIXED

### Evidence

- Existing user lookup occurs at `src/lib/auth-options.ts:70-74`.
- Existing user update at `src/lib/auth-options.ts:93-102` updates Google metadata and profile picture but does not update `role`.
- Token issuance uses the existing `user.role` at `src/lib/auth-options.ts:125-133`.
- New user creation still sets `role: requestedRole` at `src/lib/auth-options.ts:109-120`.

### Remaining Risks

The pending role cookie remains fragile: it defaults to `STUDENT` and expires in 60 seconds at `src/lib/auth-options.ts:61-67` and `src/lib/auth-options.ts:181-187`. That was a separate audit item, not this specific overwrite fix.

### Recommended Action

Fix OAuth role state durability separately with signed state or a longer-lived, validated pending signup record.

### Estimated Fix Time

2 hours.

## 5. PendingUser Prisma Typing Fix

### Original Audit Requirement

Remove `(prisma as any).pendingUser` bypasses and ensure Prisma Client exposes `pendingUser` normally.

### What Was Implemented

Signup, resend, and verify routes call `prisma.pendingUser` directly. Build script runs `prisma generate`.

### Files Changed

- `src/app/api/auth/signup/route.ts`
- `src/app/api/auth/verify-email/route.ts`
- `src/app/api/auth/resend-otp/route.ts`
- `package.json`

### Verification Result

FULLY FIXED

### Evidence

- `src/app/api/auth/signup/route.ts:60-62`, `src/app/api/auth/signup/route.ts:75-84`, and `src/app/api/auth/signup/route.ts:87-96` use `prisma.pendingUser`.
- `src/app/api/auth/verify-email/route.ts:27-32` and `src/app/api/auth/verify-email/route.ts:86-88` use `prisma.pendingUser`.
- `src/app/api/auth/resend-otp/route.ts:18-20` and `src/app/api/auth/resend-otp/route.ts:47-53` use `prisma.pendingUser`.
- `package.json:7` runs `prisma generate && next build`.
- `npx tsc --noEmit`, `npx prisma validate`, and `npm run build` all passed.

### Remaining Risks

None specific to Prisma typing.

### Recommended Action

Keep `prisma generate` in CI before type-check/build.

### Estimated Fix Time

No further fix needed.

## 6. Password Policy Implementation

### Original Audit Requirement

Replace weak minimum length with a centralized policy and apply it server-side and client-side to signup and password-change flows.

### What Was Implemented

A shared policy requires at least 8 characters with at least one letter and one number. Signup and both password-change APIs and forms use it.

### Files Changed

- `src/lib/password-policy.ts`
- `src/app/api/auth/signup/route.ts`
- `src/app/api/student/change-password/route.ts`
- `src/app/api/interviewer/change-password/route.ts`
- `src/app/signup/student/page.tsx`
- `src/app/signup/interviewer/page.tsx`
- `src/app/student/layout.tsx`
- `src/app/interviewer/layout.tsx`

### Verification Result

FULLY FIXED

### Evidence

- `src/lib/password-policy.ts:1-14` defines and enforces the shared policy.
- Signup API validates at `src/app/api/auth/signup/route.ts:29-36`.
- Student password change validates at `src/app/api/student/change-password/route.ts:20-26`.
- Interviewer password change validates at `src/app/api/interviewer/change-password/route.ts:20-26`.
- Frontend signup/layout references were found by `rg`: `src/app/signup/student/page.tsx:9`, `src/app/signup/interviewer/page.tsx:9`, `src/app/student/layout.tsx:8`, and `src/app/interviewer/layout.tsx:7`.

### Remaining Risks

Existing weak passwords are not forced to rotate. There is no breached-password or common-password check.

### Recommended Action

Prompt existing email/password users to rotate weak passwords on next password change or next login after launch.

### Estimated Fix Time

2-4 hours.

## 7. LinkedIn SSRF Mitigation

### Original Audit Requirement

Remove or harden server-side LinkedIn photo scraping to prevent SSRF.

### What Was Implemented

The sync route authenticates interviewers and returns HTTP 410 without fetching user-supplied URLs. Interviewer profile updates also parse and restrict LinkedIn profile URLs.

### Files Changed

- `src/app/api/interviewer/sync-linkedin-photo/route.ts`
- `src/app/api/interviewer/profile/route.ts`
- `src/app/interviewer/dashboard/page.tsx`

### Verification Result

FULLY FIXED

### Evidence

- `src/app/api/interviewer/sync-linkedin-photo/route.ts:10-20` returns 410 and performs no fetch.
- `src/app/api/interviewer/profile/route.ts:6-24` parses URL, requires `https:`, exact `linkedin.com` or `www.linkedin.com`, profile path `/in/` or `/pub/`, and no credentials.
- `src/app/api/interviewer/profile/route.ts:107-114` rejects invalid LinkedIn URLs before storing them.

### Remaining Risks

The dashboard still renders a "Sync from LinkedIn" button and calls the disabled route at `src/app/interviewer/dashboard/page.tsx:99-129` and `src/app/interviewer/dashboard/page.tsx:257-264`, creating a confusing UX. This is not an SSRF risk because the server route is disabled.

### Recommended Action

Remove the LinkedIn sync button and copy from the dashboard.

### Estimated Fix Time

30 minutes.

## 8. Email HTML Escaping

### Original Audit Requirement

Escape all user-controlled values inserted into HTML email templates.

### What Was Implemented

HTML escaping helpers were added and used in the shared template and manual booking templates.

### Files Changed

- `src/lib/email.ts`

### Verification Result

FULLY FIXED

### Evidence

- `src/lib/email.ts:39-50` defines `escapeHtml` and attribute escaping.
- Shared row renderer escapes labels and values at `src/lib/email.ts:70-81`.
- Master template escapes heading/subheading/badge/date/time/section headings/tip/footer at `src/lib/email.ts:111-114`, `src/lib/email.ts:139-176`, `src/lib/email.ts:201-212`, `src/lib/email.ts:229-251`, and `src/lib/email.ts:277-299`.
- Manual booking received email pre-escapes dynamic values at `src/lib/email.ts:889-896` and uses safe variables at `src/lib/email.ts:923-956`.
- Manual booking assigned email escapes table rows at `src/lib/email.ts:1051-1061`.

### Remaining Risks

Email subject lines and plaintext bodies are not HTML contexts and are not escaped, which is acceptable for this finding. URLs in email links are restricted to `http`/`https` by `safeHref` at `src/lib/email.ts:52-62`.

### Recommended Action

Add tests around names/topics containing `<`, `"`, and `&`.

### Estimated Fix Time

1 hour.

## 9. Prompt Injection Hardening

### Original Audit Requirement

Separate system instructions from untrusted chat/user content and validate behavior-analysis output.

### What Was Implemented

AI routes now use system/user message separation, add "untrusted source material" instructions, and validate behavior-analysis JSON shape.

### Files Changed

- `src/app/api/ai/notes/route.ts`
- `src/app/api/ai/feedback/route.ts`

### Verification Result

PARTIALLY FIXED

### Evidence

- Notes generation separates `systemPrompt` and `userPrompt` at `src/app/api/ai/notes/route.ts:58-89`.
- Behavior analysis separates `systemPrompt` and `userPrompt` at `src/app/api/ai/notes/route.ts:120-149`.
- Behavior output is parsed and validated for score, flag, summary, and issue types at `src/app/api/ai/notes/route.ts:14-40`.
- Feedback generation separates system/user content at `src/app/api/ai/feedback/route.ts:67-89`.

### Remaining Risks

- This is prompt hardening, not prompt-injection prevention. User content is still concatenated directly into prompt text at `src/app/api/ai/notes/route.ts:71-82`, `src/app/api/ai/notes/route.ts:138-139`, and `src/app/api/ai/feedback/route.ts:79-81`.
- Notes/feedback outputs are not schema constrained or validated.
- No transcript size limits or abuse controls exist.

### Recommended Action

Wrap untrusted content in explicit delimiters, cap input length, add structured output schema where possible, and add tests with malicious transcript fixtures.

### Estimated Fix Time

Half day.

## 10. Groq Timeout Implementation

### Original Audit Requirement

Add timeout handling to Groq calls so API routes do not hang indefinitely.

### What Was Implemented

A shared Groq helper uses `AbortSignal.timeout(15000)`, and all direct Groq calls use it.

### Files Changed

- `src/lib/ai/groq.ts`
- `src/app/api/ai/notes/route.ts`
- `src/app/api/ai/feedback/route.ts`

### Verification Result

FULLY FIXED

### Evidence

- `src/lib/ai/groq.ts:3-23` defines the shared helper and timeout.
- `src/app/api/ai/notes/route.ts:84-92` and `src/app/api/ai/notes/route.ts:141-149` use `fetchGroqChatCompletion`.
- `src/app/api/ai/feedback/route.ts:84-92` uses `fetchGroqChatCompletion`.
- Timeout errors return 504 in notes and feedback routes at `src/app/api/ai/notes/route.ts:171-175` and `src/app/api/ai/feedback/route.ts:117-121`.

### Remaining Risks

No retry budget or circuit breaker.

### Recommended Action

Add minimal telemetry and rate limiting before production.

### Estimated Fix Time

2 hours.

## 11. Neutral AI Fallback

### Original Audit Requirement

Behavior-analysis failures must not return a perfect green score.

### What Was Implemented

Malformed behavior-analysis output falls back to score 50/yellow with retry language.

### Files Changed

- `src/app/api/ai/notes/route.ts`

### Verification Result

FULLY FIXED

### Evidence

- Neutral fallback is defined at `src/app/api/ai/notes/route.ts:7-12`.
- Malformed parse fallback returns neutral at `src/app/api/ai/notes/route.ts:159-164`.
- API timeout/fetch exceptions return an error instead of green at `src/app/api/ai/notes/route.ts:169-180`.

### Remaining Risks

The "not enough messages" branch still returns green/100 at `src/app/api/ai/notes/route.ts:111-117`. That is not a failure fallback, but it can be misread as a real score.

### Recommended Action

Return a neutral "insufficient data" state instead of score 100.

### Estimated Fix Time

30 minutes.

## 12. Audit-Recommended Indexes

### Original Audit Requirement

Add partial/composite indexes matching reminder lookup, availability booking, upcoming session counts, signaling cleanup, and manual booking lookup queries.

### What Was Implemented

A raw SQL migration creates five indexes.

### Files Changed

- `prisma/migrations/20260531000100_add_audit_recommended_indexes/migration.sql`
- `prisma/schema.prisma`

### Verification Result

PARTIALLY FIXED

### Evidence

- Reminder lookup partial index: `prisma/migrations/20260531000100_add_audit_recommended_indexes/migration.sql:4-6`.
- Availability booking lookup partial index: `prisma/migrations/20260531000100_add_audit_recommended_indexes/migration.sql:8-10`.
- Upcoming session count partial index: `prisma/migrations/20260531000100_add_audit_recommended_indexes/migration.sql:12-14`.
- Signaling cleanup index: `prisma/migrations/20260531000100_add_audit_recommended_indexes/migration.sql:16-17`.
- Manual booking student index: `prisma/migrations/20260531000100_add_audit_recommended_indexes/migration.sql:19-20`.
- Prisma schema validates successfully.

### Remaining Risks

- Cleanup query uses `updatedAt` at `src/app/api/cron/cleanup-signaling-rooms/route.ts:18-22`, but the migration indexes `"createdAt"` at `prisma/migrations/20260531000100_add_audit_recommended_indexes/migration.sql:16-17`. That cleanup index does not match the implemented cleanup query.
- Indexes are created with plain `CREATE INDEX`, not `CREATE INDEX CONCURRENTLY`; this is acceptable for empty/small tables but can lock writes on larger production tables.
- Partial indexes are raw SQL only; Prisma schema cannot represent them, so future migrations may not know about them unless migration history is preserved.

### Recommended Action

Add an `updatedAt` index for signaling cleanup or change cleanup to use `createdAt` intentionally. Use concurrent index creation for large production data.

### Estimated Fix Time

30 minutes to 2 hours depending on production data size.

## 13. Error Boundaries

### Original Audit Requirement

Add App Router error boundaries for student, interviewer, and interview-room routes.

### What Was Implemented

Segment-level `error.tsx` files were added for student, interviewer, and both interview-room routes.

### Files Changed

- `src/app/student/error.tsx`
- `src/app/interviewer/error.tsx`
- `src/app/student/interview-room/[sessionId]/error.tsx`
- `src/app/interviewer/interview-room/[sessionId]/error.tsx`

### Verification Result

PARTIALLY FIXED

### Evidence

- Student boundary exists at `src/app/student/error.tsx:1-33`.
- Interviewer boundary exists at `src/app/interviewer/error.tsx:1-33`.
- Student room boundary exists at `src/app/student/interview-room/[sessionId]/error.tsx:1-33`.
- Interviewer room boundary exists at `src/app/interviewer/interview-room/[sessionId]/error.tsx:1-33`.

### Remaining Risks

- No root `src/app/error.tsx`, so public routes like login/signup/verify are not covered.
- App Router error boundaries do not catch async errors already handled in effects/fetch callbacks.
- Boundaries log to console only; no monitoring integration.

### Recommended Action

Add a root boundary and wire error capture to Sentry or equivalent.

### Estimated Fix Time

2 hours.

## 14. Theme FOUC Fix

### Original Audit Requirement

Apply the persisted/system theme before first paint to avoid dark/light flash.

### What Was Implemented

Root layout injects an inline pre-hydration theme script into `<head>` and suppresses hydration warnings on `<html>`.

### Files Changed

- `src/app/layout.tsx`

### Verification Result

FULLY FIXED

### Evidence

- Theme script reads `localStorage` and system preference at `src/app/layout.tsx:22-31`.
- Script is injected in `<head>` at `src/app/layout.tsx:51-53`.
- `<html suppressHydrationWarning>` is set at `src/app/layout.tsx:50`.

### Remaining Risks

The student/interviewer client hooks still initialize React state to `false` before reading localStorage at `src/app/student/layout.tsx:11-20` and `src/app/interviewer/layout.tsx:10-19`, so the icon/toggle state can briefly be stale even though the document class is set before paint.

### Recommended Action

Initialize the client hook from `document.documentElement.classList.contains('dark')`.

### Estimated Fix Time

30 minutes.

## 15. Alert To Toast Migration

### Original Audit Requirement

Remove blocking browser `alert()` usage and replace user feedback with non-blocking UI.

### What Was Implemented

A `ToastProvider` and `useToast` hook were added. `rg "alert\\(" src` found no alert calls.

### Files Changed

- `src/components/ui/Toast.tsx`
- `src/app/layout.tsx`
- `src/app/student/book-interview/page.tsx`
- `src/app/student/book-guidance/page.tsx`
- `src/app/interviewer/availability/page.tsx`
- `src/app/interviewer/feedback/[sessionId]/page.tsx`
- `src/app/interviewer/dashboard/page.tsx`

### Verification Result

FULLY FIXED

### Evidence

- Toast provider implementation: `src/components/ui/Toast.tsx:19-61`.
- Provider mounted globally at `src/app/layout.tsx:57`.
- Booking page uses toast at `src/app/student/book-interview/page.tsx:497`, `src/app/student/book-interview/page.tsx:599`, and `src/app/student/book-interview/page.tsx:646`.
- Guidance page uses toast at `src/app/student/book-guidance/page.tsx:395` and `src/app/student/book-guidance/page.tsx:480`.
- `rg "alert\\(" src` returned no matches.

### Remaining Risks

`confirm()` remains for destructive resume deletion at `src/app/student/dashboard/page.tsx:687-689`. This is not `alert()`, but it is still blocking browser UI.

### Recommended Action

Replace `confirm()` with a modal confirmation.

### Estimated Fix Time

1 hour.

## 16. Profile Refetch Optimization

### Original Audit Requirement

Saving profile-only changes should not refetch sessions.

### What Was Implemented

Student dashboard split profile and session fetches. Profile save applies returned profile data and does not call `fetchData()`.

### Files Changed

- `src/app/student/dashboard/page.tsx`

### Verification Result

FULLY FIXED

### Evidence

- `fetchProfile` only calls `/api/student/profile` at `src/app/student/dashboard/page.tsx:598-603`.
- `fetchSessions` only calls `/api/student/sessions` at `src/app/student/dashboard/page.tsx:605-611`.
- Initial load calls both at `src/app/student/dashboard/page.tsx:613-621`.
- `handleSaveProfile` applies the POST response and does not refetch sessions at `src/app/student/dashboard/page.tsx:623-646`.
- Resume upload/payment refresh only profile at `src/app/student/dashboard/page.tsx:673-701`.

### Remaining Risks

No cache invalidation strategy if session-relevant profile fields later become coupled to sessions.

### Recommended Action

Keep profile-only and session-list fetch paths separate.

### Estimated Fix Time

No further fix needed.

## 17. next/image Migration

### Original Audit Requirement

Replace remaining profile `<img>` usage with `next/image`.

### What Was Implemented

Profile/avatar usages import and render `next/image`; no `<img` tags remain in `src`.

### Files Changed

- `src/app/student/layout.tsx`
- `src/app/interviewer/layout.tsx`
- `src/app/interviewer/dashboard/page.tsx`
- `src/app/student/book-guidance/page.tsx`
- `next.config.js`

### Verification Result

FULLY FIXED

### Evidence

- Student layout uses `Image` at `src/app/student/layout.tsx:5`, `src/app/student/layout.tsx:491`, `src/app/student/layout.tsx:629`, and `src/app/student/layout.tsx:682`.
- Interviewer layout uses `Image` at `src/app/interviewer/layout.tsx:5`, `src/app/interviewer/layout.tsx:529`, `src/app/interviewer/layout.tsx:637`, and `src/app/interviewer/layout.tsx:693-699`.
- Interviewer dashboard avatar uses `Image` at `src/app/interviewer/dashboard/page.tsx:4` and `src/app/interviewer/dashboard/page.tsx:183-189`.
- Guidance interviewer avatar uses `Image` at `src/app/student/book-guidance/page.tsx:4` and `src/app/student/book-guidance/page.tsx:146-153`.
- `next.config.js:8-22` allows Google and Cloudinary remote images.
- `rg "<img" src` returned no matches.

### Remaining Risks

Remote patterns only include Google and Cloudinary; any future external image source will fail until explicitly allowed.

### Recommended Action

Keep remote image hosts explicit.

### Estimated Fix Time

No further fix needed.

## 18. Video Ref Safety

### Original Audit Requirement

Guard video refs before assigning `srcObject` in interview rooms.

### What Was Implemented

Both room pages use `attachVideoStream` helper that checks the ref and stream and catches assignment errors.

### Files Changed

- `src/app/student/interview-room/[sessionId]/page.tsx`
- `src/app/interviewer/interview-room/[sessionId]/page.tsx`

### Verification Result

FULLY FIXED

### Evidence

- Student helper at `src/app/student/interview-room/[sessionId]/page.tsx:14-27`.
- Student assignments call helper at `src/app/student/interview-room/[sessionId]/page.tsx:207`, `src/app/student/interview-room/[sessionId]/page.tsx:218`, `src/app/student/interview-room/[sessionId]/page.tsx:335`, `src/app/student/interview-room/[sessionId]/page.tsx:350`, and `src/app/student/interview-room/[sessionId]/page.tsx:360`.
- Interviewer helper at `src/app/interviewer/interview-room/[sessionId]/page.tsx:21-34`.
- Interviewer assignments call helper at `src/app/interviewer/interview-room/[sessionId]/page.tsx:291` and `src/app/interviewer/interview-room/[sessionId]/page.tsx:302`.

### Remaining Risks

This does not fix the broader WebRTC/Postgres polling architecture.

### Recommended Action

Track the broader realtime replacement separately.

### Estimated Fix Time

No further fix needed for ref safety.

## 19. Environment Validation

### Original Audit Requirement

Required environment variables should fail loudly at startup/build, not late at runtime.

### What Was Implemented

`src/lib/env.ts` exposes a lazy proxy for a subset of required variables. Some payment and AI routes use it.

### Files Changed

- `src/lib/env.ts`
- `src/lib/ai/groq.ts`
- payment routes

### Verification Result

PARTIALLY FIXED

### Evidence

- Required list is defined at `src/lib/env.ts:1-14`.
- The proxy validates only when a property is accessed at `src/lib/env.ts:26-35`.
- Groq uses `env.GROQ_API_KEY` at `src/lib/ai/groq.ts:18`.
- Payment routes use `env.RAZORPAY_*` at `src/app/api/payment/create-order/route.ts:11-13`, `src/app/api/payment/verify/route.ts:26`, `src/app/api/payment/create-unlock-order/route.ts:15-17`, and `src/app/api/payment/unlock-preferred-interviewer/route.ts:25`.

### Remaining Risks

- This does not fail at startup/build; it fails when a route accesses a missing property.
- `env.ts` is not imported by app bootstrap or `next.config.js`.
- Many required envs are still read directly from `process.env`, including JWT in `src/lib/auth.ts:9-15`, SMTP in `src/lib/email.ts:7-15`, Cloudinary in upload routes, and `CRON_SECRET` in cron routes.
- `CRON_SECRET`, SMTP credentials, and `NEXT_PUBLIC_APP_NAME` are not included in `requiredServerEnv`.
- There is no `.env.example`; only `.env` exists.

### Recommended Action

Replace the lazy proxy with eager validation in a server-only module imported by route helpers and build/startup, classify optional feature envs, add `.env.example`, and include cron/SMTP/Cloudinary consumers.

### Estimated Fix Time

Half day.

## 20. Scheduler Replacement

### Original Audit Requirement

Replace in-process `node-cron`/manual scheduler init with deployment-agnostic cron routes and remove dead scheduler behavior.

### What Was Implemented

In-process scheduler init now returns 410. Reminder processing is exposed through `/api/cron/session-reminders`.

### Files Changed

- `src/lib/scheduler.ts`
- `src/app/api/scheduler/init/route.ts`
- `src/app/api/cron/session-reminders/route.ts`
- `vercel.json`

### Verification Result

PARTIALLY FIXED

### Evidence

- `src/lib/scheduler.ts:4-95` now exports `processDueSessionReminders`; no `node-cron` usage remains.
- `src/app/api/scheduler/init/route.ts:5-12` disables manual in-process scheduler init.
- `src/app/api/cron/session-reminders/route.ts:6-24` exposes authenticated reminder processing.
- `rg "node-cron|cron\\.schedule|startScheduler" src package.json package-lock.json` found no active scheduler dependency/use.

### Remaining Risks

- `vercel.json:1-16` has no `crons` block, so Vercel will not call `/api/cron/session-reminders`.
- `processDueSessionReminders` marks `reminderSent: true` before sending at `src/lib/scheduler.ts:41-44`, but `sendReminderToStudent` and `sendReminderToInterviewer` catch and swallow SMTP errors at `src/lib/email.ts:773-784` and `src/lib/email.ts:839-850`. The scheduler will count these as sent and not retry.
- The route depends on `CRON_SECRET`, which is not validated by `src/lib/env.ts`.

### Recommended Action

Add Vercel cron configuration or external scheduler config, make email functions throw on failure for cron paths, and add retryable email jobs or at least mark sent only after verified send.

### Estimated Fix Time

Half day.

## 21. Cleanup Routes

### Original Audit Requirement

Replace serverless `setTimeout` cleanup with cron-driven cleanup for signaling rooms and expired pending users.

### What Was Implemented

Cron routes exist for pending users and signaling rooms. No in-process cleanup timer remains in the interview-room route.

### Files Changed

- `src/app/api/cron/cleanup-signaling-rooms/route.ts`
- `src/app/api/cron/cleanup-pending-users/route.ts`
- `src/app/api/interview-room/route.ts`
- `vercel.json`

### Verification Result

PARTIALLY FIXED

### Evidence

- Signaling cleanup route deletes rooms older than 4 hours by `updatedAt` at `src/app/api/cron/cleanup-signaling-rooms/route.ts:18-23`.
- Pending users cleanup route deletes expired rows at `src/app/api/cron/cleanup-pending-users/route.ts:24-31`.
- Both routes require `Authorization: Bearer ${CRON_SECRET}` at `src/app/api/cron/cleanup-signaling-rooms/route.ts:8-16` and `src/app/api/cron/cleanup-pending-users/route.ts:13-22`.
- `src/app/api/interview-room/route.ts` contains no `setTimeout` cleanup.

### Remaining Risks

- `vercel.json:1-16` does not schedule either cleanup route.
- Signaling cleanup uses `updatedAt`, but the added index is on `createdAt` (`prisma/migrations/20260531000100_add_audit_recommended_indexes/migration.sql:16-17`).
- Cleanup deletes any room not updated for 4 hours without checking session status. A very long or paused active room could be removed.

### Recommended Action

Add cron schedules, add an `updatedAt` index, and include session status/scheduled-time guards in signaling cleanup.

### Estimated Fix Time

2 hours.

