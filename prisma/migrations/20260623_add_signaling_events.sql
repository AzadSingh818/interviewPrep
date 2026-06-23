-- Migration: Add SignalingEvent table (append-only)
-- This replaces JSON array mutations with immutable events

CREATE TABLE signaling_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  room_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  sender_role VARCHAR(20),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT room_id_not_empty CHECK (room_id != ''),
  CONSTRAINT event_type_valid CHECK (event_type IN ('offer', 'answer', 'ice-candidate', 'message', 'ping'))
);

-- Index for fast queries by room + timestamp
CREATE INDEX idx_signaling_events_room_time ON signaling_events(room_id, created_at);

-- Index for cleanup queries
CREATE INDEX idx_signaling_events_created_at ON signaling_events(created_at);
