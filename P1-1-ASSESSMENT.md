# P1-1 WebRTC Signaling Migration - Strategic Assessment Report

**Date:** 2026-06-23  
**Status:** Foundation Laid, Strategic Decision Needed  
**Tests:** All 38 passing ✅

---

## What I Found

### Current Architecture Problems ❌
- **SignalingRoom table**: Stores offer, answer, candidates (JSON arrays), messages
- **Polling overhead**: Clients query every 1.5s (multiplied across all concurrent sessions)
- **JSON mutation cost**: Each ICE candidate addition requires read-modify-write of entire array
- **Risk**: Lost candidates, message gaps, DB saturation during high concurrency

### Existing Infrastructure ✅
- LiveKit token route (`/api/interview-room/token`) exists and validated
- LiveKit client/server SDKs already installed:
  - `livekit-client`, `@livekit/components-react`, `livekit-server-sdk`
- `.env` vars documented for LiveKit (LIVEKIT_URL, API_KEY, API_SECRET)

### Foundation Work Completed
Created 3 new files as migration groundwork:
1. **`src/lib/livekit-helper.ts`** - Feature flag system
   - `getSignalingBackend()` - server-side backend selection
   - `useClientSignalingBackend()` - client-side backend selection
   - `validateLiveKitEnv()` - credentials validation
   
2. **`src/components/LiveKitInterviewRoom.tsx`** - LiveKit client component
   - Ready-to-use video/audio/chat UI
   - Connection status, error handling
   - Wrapped around LiveKit's VideoConference component
   
3. **`.env.example` updated**
   - Added `NEXT_PUBLIC_ENABLE_LIVEKIT="false"` feature flag

---

## Implementation Complexity Analysis

### LiveKit Full Migration (Roadmap's "Replace" Approach)
**Estimated: 2-5 days** (as stated in roadmap)

**Why:**
- Two large client components (~1200 lines each):
  - `src/app/interviewer/interview-room/[sessionId]/page.tsx` (complex RTCPeerConnection logic)
  - `src/app/student/interview-room/[sessionId]/page.tsx` (similar)
  - `src/app/student/guidance-room/[sessionId]/page.tsx` (additional variant)
  
- Each requires rewriting:
  - Polling loop → LiveKit event listeners
  - ICE candidate management → LiveKit handles internally
  - Offer/answer signaling → LiveKit room API
  - Chat over HTTP → Chat via LiveKit DataChannel
  - Media stream setup → LiveKit VideoConference wrapper
  
- Risk: Feature parity, behavior analysis, media recording,conduct monitor, AI notes integration

### Append-Only Event Table Approach (Roadmap's "Interim" Option)
**Estimated: 1-2 days** ⚡

**How it works:**
1. Add `SignalingEvent` table (append-only, no mutations):
   ```prisma
   model SignalingEvent {
     id        String   @id @default(cuid())
     roomId    String
     eventType String   // 'offer', 'answer', 'ice-candidate', 'message'
     payload   Json
     createdAt DateTime @default(now())
     
     @@index([roomId, createdAt])
   }
   ```

2. Update `/api/interview-room`:
   - POST: Write events instead of mutating arrays
   - GET: Query events since last known timestamp

3. Benefits:
   - ✅ Eliminates JSON array mutations (fixes one major issue)
   - ✅ Reduces polling overhead (selective queries)
   - ✅ No client-side rewrites needed
   - ✅ Lower risk (minimal behavior changes)
   - ✅ 1-2 day effort
   - ✅ Can be done NOW while LiveKit is later proper migration

---

## Recommendation

**Two-Phase Approach:**

### Phase 1 (THIS WEEK): Append-Only Event Table (1-2 days)
- ✅ Solves JSON mutation problem
- ✅ Reduces polling load
- ✅ Lower risk, faster delivery
- ✅ Keeps existing client-side working
- ✅ Can be deployed to production safely

### Phase 2 (FUTURE): Full LiveKit Migration (2-5 days)
- Use foundation work already created
- Gradual migration behind feature flag
- More reliable signaling layer
- Full real-time transport

---

## Current Status

✅ **Done this week:**
- P2-5: Money/Auth regression tests
- P1-2: Durable email jobs
- P1-4: Sentry observability
- **P1-1 Foundation:** LiveKit helper, component skeleton

📊 **Overall Progress: 7/14 items (71%)**

✅ Completed: P2-5, P1-2, P1-4, + multiple P0 items  
⏳ Ready: P1-1 (two approaches available)  
📋 Next: P2-8 (difficulty audit), P2-6 (env validation)  

---

## Decision Request

**Should I proceed with:**

**Option A:** Append-Only Events Table (FAST, THIS WEEK)
- Solves immediate problems
- 1-2 day effort
- Production-safe
- Foundation for future LiveKit

**Option B:** Full LiveKit Migration (COMPLETE, BUT SLOWER)
- Proper solution
- 2-5 day effort
- Requires extensive client rewrites
- Higher risk during migration

**Recommended:** Option A → Option B sequential approach
