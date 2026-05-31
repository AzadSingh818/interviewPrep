-- Audit-recommended indexes for reminder lookup, booking, assignment counts,
-- signaling cleanup, and manual booking request lookups.

CREATE INDEX "sessions_reminder_lookup"
  ON "sessions"("status", "reminder_sent", "scheduled_time")
  WHERE "status" = 'SCHEDULED' AND "reminder_sent" = false;

CREATE INDEX "slots_booking_lookup"
  ON "availability_slots"("interviewer_id", "is_booked", "start_time", "end_time")
  WHERE "is_booked" = false;

CREATE INDEX "sessions_upcoming_count"
  ON "sessions"("interviewer_id", "status", "scheduled_time")
  WHERE "status" = 'SCHEDULED';

CREATE INDEX "signaling_rooms_created_at"
  ON "signaling_rooms"("createdAt");

CREATE INDEX "mbr_student_id"
  ON "manual_booking_requests"("student_id");

