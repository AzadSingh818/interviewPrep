-- Separate feature-unlock payment state from manual booking requests.

CREATE TYPE "FeatureUnlockType" AS ENUM ('PREFERRED_INTERVIEWER');

CREATE TABLE "feature_unlocks" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "feature" "FeatureUnlockType" NOT NULL DEFAULT 'PREFERRED_INTERVIEWER',
    "razorpay_order_id" TEXT NOT NULL,
    "razorpay_payment_id" TEXT,
    "razorpay_signature" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_unlocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "feature_unlocks_razorpay_order_id_key" ON "feature_unlocks"("razorpay_order_id");
CREATE UNIQUE INDEX "feature_unlocks_razorpay_payment_id_key" ON "feature_unlocks"("razorpay_payment_id");
CREATE INDEX "feature_unlocks_student_id_idx" ON "feature_unlocks"("student_id");

ALTER TABLE "feature_unlocks"
  ADD CONSTRAINT "feature_unlocks_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "feature_unlocks" (
  "student_id",
  "feature",
  "razorpay_order_id",
  "razorpay_payment_id",
  "razorpay_signature",
  "amount",
  "currency",
  "payment_status",
  "created_at",
  "updated_at"
)
SELECT
  "student_id",
  'PREFERRED_INTERVIEWER',
  "razorpay_order_id",
  "razorpay_payment_id",
  "razorpay_signature",
  5000,
  'INR',
  "payment_status",
  "created_at",
  "updated_at"
FROM "manual_booking_requests"
WHERE "razorpay_order_id" IS NOT NULL
  AND "preferred_interviewer_id" IS NULL
  AND "topic" IS NULL
  AND "role" IS NULL
  AND "difficulty" IS NULL
  AND "interview_type" IS NULL
  AND "session_id" IS NULL
ON CONFLICT ("razorpay_order_id") DO NOTHING;

