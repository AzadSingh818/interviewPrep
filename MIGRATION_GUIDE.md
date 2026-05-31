# Migration Guide

## Required Database Migrations

Apply these new Prisma migrations in order:

1. `20260531000100_add_audit_recommended_indexes`
2. `20260531000200_add_feature_unlocks`

The first migration adds only indexes. The second migration creates:

- `FeatureUnlockType` enum
- `feature_unlocks` table
- unique indexes for Razorpay order/payment ids
- student foreign key
- backfill from legacy unlock placeholder rows in `manual_booking_requests`

## Deployment Notes

1. Run `prisma migrate deploy` in staging.
2. Deploy the application.
3. Verify preferred-interviewer unlock order creation writes to `feature_unlocks`.
4. Verify legacy unlock orders from `manual_booking_requests` can still be verified.
5. Run `prisma migrate deploy` in production.
6. Deploy the application to production.

## Cron Routes

The old `/api/scheduler/init` route now returns `410` by design.

Use these deployment-agnostic routes from your scheduler of choice:

- `GET /api/cron/session-reminders`
- `GET /api/cron/cleanup-signaling-rooms`
- `GET /api/cron/cleanup-pending-users`

All require:

```http
Authorization: Bearer <CRON_SECRET>
```

No external cron provider was configured in this remediation batch.

## Environment Variables

`src/lib/env.ts` now validates these required server variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `GROQ_API_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

Missing values now fail fast when server code loads.

## Rollback Notes

- Pricing rollback is a code-only revert of `PRO_PLAN_AMOUNT_PAISE`.
- Feature unlock rollback can keep the new table in place; the verify route still has legacy fallback support.
- Index migrations are safe to roll back by dropping the new indexes if needed.
- Scheduler rollback should not restore `node-cron` on serverless; keep cron routes and disable external calls if needed.

