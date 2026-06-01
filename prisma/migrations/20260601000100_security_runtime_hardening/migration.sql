-- Runtime security hardening: invalidatable JWTs, Razorpay webhook
-- idempotency, durable auth rate limits, and matching cleanup index.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "token_version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "payment_webhook_events" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'RAZORPAY',
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "order_id" TEXT,
    "payment_id" TEXT,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3),
    "processing_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_webhook_events_event_id_key"
  ON "payment_webhook_events"("event_id");

CREATE INDEX IF NOT EXISTS "payment_webhook_events_order_id_idx"
  ON "payment_webhook_events"("order_id");

CREATE INDEX IF NOT EXISTS "payment_webhook_events_payment_id_idx"
  ON "payment_webhook_events"("payment_id");

CREATE TABLE IF NOT EXISTS "rate_limit_buckets" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "reset_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "rate_limit_buckets_reset_at_idx"
  ON "rate_limit_buckets"("reset_at");

CREATE INDEX IF NOT EXISTS "signaling_rooms_updatedAt"
  ON "signaling_rooms"("updatedAt");
