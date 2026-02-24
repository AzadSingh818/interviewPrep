-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'PRO');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- AlterTable
ALTER TABLE "interviewer_profiles" ADD COLUMN     "id_card_url" TEXT,
ADD COLUMN     "interview_types_offered" "InterviewType"[] DEFAULT ARRAY[]::"InterviewType"[],
ADD COLUMN     "resume_url" TEXT;

-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN     "guidance_limit" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "guidance_used" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "interviews_limit" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "interviews_used" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "plan_expires_at" TIMESTAMP(3),
ADD COLUMN     "plan_type" "PlanType" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "resume_url" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verified" BOOLEAN DEFAULT false,
ADD COLUMN     "name" VARCHAR(255),
ADD COLUMN     "profile_picture" TEXT,
ADD COLUMN     "verification_token" TEXT,
ADD COLUMN     "verification_token_expiry" TIMESTAMP(6);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" SERIAL NOT NULL,
    "student_id" INTEGER NOT NULL,
    "razorpay_order_id" TEXT NOT NULL,
    "razorpay_payment_id" TEXT,
    "razorpay_signature" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "plan_type" "PlanType" NOT NULL,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "verification_token" VARCHAR(10) NOT NULL,
    "verification_token_expiry" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "pending_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_razorpay_order_id_key" ON "subscriptions"("razorpay_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_razorpay_payment_id_key" ON "subscriptions"("razorpay_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "pending_users_email_key" ON "pending_users"("email");

-- CreateIndex
CREATE INDEX "idx_pending_users_email" ON "pending_users"("email");

-- CreateIndex
CREATE INDEX "idx_pending_users_expires_at" ON "pending_users"("expires_at");

-- CreateIndex
CREATE INDEX "idx_pending_users_verification_token" ON "pending_users"("verification_token");

-- CreateIndex
CREATE INDEX "idx_users_verification_token" ON "users"("verification_token");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_users_google_id" RENAME TO "users_google_id_idx";
