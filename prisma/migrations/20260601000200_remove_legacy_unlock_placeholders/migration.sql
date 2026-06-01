-- Contract step after feature_unlocks backfill: remove old manual booking
-- placeholder rows that only existed to hold preferred-interviewer unlock
-- Razorpay order ids.

DELETE FROM "manual_booking_requests"
WHERE "razorpay_order_id" IS NOT NULL
  AND "preferred_interviewer_id" IS NULL
  AND "topic" IS NULL
  AND "role" IS NULL
  AND "difficulty" IS NULL
  AND "interview_type" IS NULL
  AND "session_id" IS NULL;
