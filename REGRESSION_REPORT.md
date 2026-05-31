# Regression Report

## Verification Summary

| Check | Status | Notes |
| --- | --- | --- |
| TypeScript | Passed | `npx tsc --noEmit` |
| Prisma schema | Passed | `npx prisma validate` |
| Production build | Passed | `npm run build` |
| Lint | Blocked | `next lint` prompts to create ESLint config; no config was generated to avoid unrelated setup changes. |

## Fix-Level Risk Review

| Fix | Files changed | Risk | Regression notes |
| --- | --- | --- | --- |
| Payment amount | `src/lib/pricing.ts`, payment create order, payment UI/copy | Low | Unlock price untouched. Subscription amount is now 9900 paise. |
| OAuth role preservation | `src/lib/auth-options.ts` | Low | Existing users keep DB role; new users still receive requested role. |
| Prisma typing | auth OTP/signup routes, cleanup pending users | Low | `prisma.pendingUser` is typed; invalid pending roles are rejected. |
| Env validation | `src/lib/env.ts`, auth/prisma/payment usage | Medium | Missing required env now fails fast. |
| Groq timeout | `src/lib/ai/groq.ts`, AI routes | Low | 15s timeout returns graceful 504. |
| AI fallback | `src/app/api/ai/notes/route.ts` | Low | Malformed behavior analysis returns neutral yellow, not perfect green. |
| Prompt hardening | AI routes | Medium | Instructions are separated from untrusted content; output is validated. |
| Email escaping | `src/lib/email.ts` | Medium | User values are escaped in HTML; formatting retained. |
| LinkedIn SSRF | interviewer profile/sync routes | Medium | Server-side LinkedIn scraping disabled; manual upload remains. |
| Password policy | signup/change-password routes and forms | Low | Login unchanged; new passwords require 8+ chars, letter, and number. |
| DB indexes | Prisma migration | Low | Additive indexes only. |
| FeatureUnlock | Prisma schema/migration, unlock routes, manual request list | Medium | New unlocks use `feature_unlocks`; legacy verification fallback preserved. |
| Error boundaries | student/interviewer/room `error.tsx` files | Low | Additive route-level recovery UI. |
| Theme FOUC | root layout | Low | Pre-hydration class script preserves localStorage behavior. |
| Toast migration | toast provider and alert callers | Low | `alert()` removed; success/error flows preserved. |
| Video ref safety | student/interviewer room pages | Low | `srcObject` assignment guarded; WebRTC logic unchanged. |
| next/image | interviewer dashboard avatar | Low | Existing remote patterns already support Google and Cloudinary. |
| Profile refetch | student dashboard | Medium | Profile-only actions no longer fetch sessions; initial load still fetches both. |
| Scheduler cleanup | scheduler lib/routes/interview-room cleanup | Medium | In-process cron and serverless timers removed; callable cron routes added. |

## Manual Staging Checklist

- Create a student signup with a weak password and verify rejection.
- Create a student signup with a valid password and complete OTP verification.
- Sign in an existing interviewer with Google from the student path and verify role remains interviewer.
- Create a Pro order and confirm Razorpay amount is 9900 paise.
- Create and verify a preferred-interviewer unlock; confirm `feature_unlocks` row is used.
- Submit an actual manual booking request and confirm it appears separately from unlock payments.
- Save student profile and confirm sessions are not refetched.
- Save interviewer profile with LinkedIn URL and confirm no server-side photo sync occurs.
- Trigger AI behavior analysis with malformed/model-invalid output in a mock and confirm neutral fallback handling.
- Call cron routes with and without `CRON_SECRET` authorization.
- Load student/interviewer dashboards in dark mode and confirm no theme flash.
- Confirm toasts replace former alert flows.
- Join interview rooms and verify local/remote video still attach.

## Known Non-Code Blockers

- ESLint is not configured, so `npm run lint` cannot run non-interactively.
- Production cron scheduling still needs an external scheduler or platform cron to call the new routes.
- Production database migrations still need to be applied with deployment credentials.

