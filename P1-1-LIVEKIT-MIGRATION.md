# P1-1: Replace Postgres WebRTC Signaling → LiveKit Migration

## Problem Statement
- Current: Postgres signaling with JSON arrays + polling every 1.5s
- Issues: DB saturation, lost ICE candidates, unreliable rooms
- Solution: Migrate to LiveKit with feature flag fallback

## Implementation Plan

### Phase 1: Setup & Helper (1-2 hours)
- [x] Feature flag: `ENABLE_LIVEKIT` env var
- [x] Helper: `useLiveKit()` to determine which signaling to use
- [ ] Update `.env.example`

### Phase 2: Client Integration (3-4 hours)
- [ ] Create `InterviewRoomLiveKit` component (new)
- [ ] Keep original polling component as fallback
- [ ] Update both interviewer-room and student-room pages
- [ ] Chat over LiveKit DataChannel
- [ ] Connection status indicators

### Phase 3: Testing & Rollback (1-2 hours)
- [ ] Test with ENABLE_LIVEKIT=true (LiveKit)
- [ ] Test with ENABLE_LIVEKIT=false (Postgres fallback)
- [ ] Verify both paths work independently
- [ ] Manual staging test

### Phase 4: Cleanup (1 day post-launch)
- [ ] Remove Postgres signaling after staging validation
- [ ] Cleanup route for draining old rooms

## Key Files
- `src/lib/livekit-helper.ts` (new) - Feature flag & env validation
- `src/components/LiveKitInterviewRoom.tsx` (new) - LiveKit client
- `src/app/interviewer/interview-room/[sessionId]/page.tsx` (update)
- `src/app/student/interview-room/[sessionId]/page.tsx` (update)
- `src/app/student/guidance-room/[sessionId]/page.tsx` (update)
- `.env.example` (update)

## Success Criteria
1. Feature flag routes correctly to LiveKit or Postgres
2. Both paths work independently
3. Chat messages transmit (via LiveKit DataChannel or Postgres)
4. All 38 tests still pass
5. No regression in existing booking/payment paths
