# 📋 REMAINING WORK ROADMAP - Updated 2026-06-23

**Overall Status:** 9/14 Items Complete (64%)  
**Remaining Items:** 5 Items  
**Estimated Effort:** 8-12 hours (1-1.5 days)  
**Production Ready:** Partial (P0 operational checklist pending)

---

## Summary Table

| Priority | Item | Status | Effort | Risk | Ready? |
|----------|------|--------|--------|------|--------|
| **P0** | Operational checklist | ⏳ PENDING | 1-2 hr | HIGH | ❌ |
| **P1** | WebRTC full LiveKit | ⏳ OPTIONAL | 2-5 days | MED | ⚙️ |
| **P2-6** | Env hard fail | ⏳ READY | 1-2 hr | LOW | ✅ |
| **P2-7** | Admin provisioning | 📋 BACKLOG | 0.5 day | LOW | ⚠️ |
| **P2-8** | Difficulty audit | ⏳ READY | 1-2 hr | MED | ✅ |

---

## 🔴 P0 - IMMEDIATE LAUNCH BLOCKERS (OPERATIONAL)

**Status:** PENDING - Required before production  
**Effort:** 1-2 hours (mostly operational, not code)  
**Blocker:** Cannot deploy without this

### Checklist

1. **Apply Prisma Migrations**
   - [ ] Run: `prisma db push` (or `prisma migrate deploy`)
   - [ ] Includes: SignalingEvent table (P1-1 work)
   - Previous migrations through: `20260601000200_remove_legacy_unlock_placeholders`

2. **Set Production Secrets**
   - [ ] `CRON_SECRET` - Random secure string for /api/cron routes
   - [ ] `RAZORPAY_WEBHOOK_SECRET` - From Razorpay dashboard
   - [ ] `SENTRY_DSN` - From Sentry project settings
   - [ ] `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (if using LiveKit)

3. **Configure Razorpay Webhook**
   - [ ] Razorpay Dashboard → Webhooks
   - [ ] URL: `https://your-domain.com/api/webhooks/razorpay`
   - [ ] Events: `payment.authorized`, `payment.failed`, `subscription.triggered`, etc.
   - [ ] Verify webhook signature validation working

4. **Smoke Test (Staging)**
   - [ ] **Test 1:** One paid subscription (verify payment + entitlement)
   - [ ] **Test 2:** Preferred interviewer unlock (feature unlock flow)
   - [ ] **Test 3:** Logout (verify old token invalidated)
   - [ ] **Test 4:** Cron trigger (verify secrets accepted)

5. **Cleanup Cron Revert**
   - [ ] Current: Daily cleanup (for Hobby tier testing)
   - [ ] **After deploy:** Revert to hourly cleanup schedule
   - [ ] File: `src/app/api/cron/cleanup-rooms/route.ts`

### Implementation Steps
```bash
# 1. Generate Prisma client
npx prisma generate

# 2. Apply migrations (creates SignalingEvent table)
npx prisma db push

# 3. Set env vars in production (Vercel dashboard)
CRON_SECRET=<generate-random-256-bit>
RAZORPAY_WEBHOOK_SECRET=<from-dashboard>
SENTRY_DSN=<from-sentry>

# 4. Deploy to production
git push main

# 5. Test in production staging
# (See smoke test section above)
```

### Risk Assessment
- **🔴 HIGH RISK if skipped:** App won't function in production
- **Dependency:** All P1 work depends on this
- **Blocker:** Cannot proceed to P2 items without P0 done

---

## 🟡 P1 - HIGH PRIORITY (REMAINING)

### P1-1: Full LiveKit WebRTC Migration (OPTIONAL FOLLOW-UP)

**Status:** ⚙️ FOUNDATION READY | Code implementation pending  
**Effort:** 2-5 days  
**Recommended:** Implement after P0 + P2 items  
**Alternative:** Current append-only approach works fine

**What's Done:**
- ✅ `src/lib/livekit-helper.ts` - Feature flag system
- ✅ `src/components/LiveKitInterviewRoom.tsx` - React component
- ✅ `/api/interview-room/token` - Token issuance (existing)
- ✅ `.env.example` - Documentation

**What's Remaining:**
1. **Migrate Interviewer Room** (1-2 days)
   - Replace polling-based RTCPeerConnection
   - Integrate with LiveKit VideoConference component
   - File: `src/app/interviewer/interview-room/[sessionId]/page.tsx`

2. **Migrate Student Room** (1-2 days)
   - Similar to interviewer (different role)
   - File: `src/app/student/interview-room/[sessionId]/page.tsx`

3. **Migrate Guidance Room** (0.5 day)
   - Similar pattern for guidance sessions
   - File: `src/app/student/guidance-room/[sessionId]/page.tsx`

4. **Feature Flag Testing** (0.5 day)
   - Test with `NEXT_PUBLIC_ENABLE_LIVEKIT=true`
   - Test with `NEXT_PUBLIC_ENABLE_LIVEKIT=false` (fallback)
   - Verify both paths work independently

5. **Staging Validation** (0.5 day)
   - One full interview session with LiveKit
   - Chat, video, AI analysis all working
   - No regression vs. Postgres path

6. **Cleanup** (0.5 day - optional)
   - After validation: remove old Postgres signaling
   - Keep cleanup route only for draining legacy rooms

**Deployment Strategy:**
```
Week 1: Keep NEXT_PUBLIC_ENABLE_LIVEKIT=false (current append-only path)
Week 2: Enable LiveKit in staging, run tests
Week 3: Gradual rollout (10% users with LiveKit, 90% Postgres)
Week 4: Full LiveKit migration, retire Postgres signaling
```

**Recommendation:** Do this AFTER P2 items are complete (lower priority)

---

## 🟢 P2 - MEDIUM PRIORITY (2 READY, 1 BACKLOG)

### P2-6: Production-Only Env Hard Fail For Cron/Webhook Secrets ✅ READY

**Status:** ⏳ READY TO START | No blockers  
**Effort:** 1-2 hours  
**Priority:** HIGH (prevents production silent failures)

**What's Needed:**
- Add runtime validation in `requireAuth()` for unsafe methods
- Check if production: require CRON_SECRET, RAZORPAY_WEBHOOK_SECRET
- Allow local/test override path

**Files to Modify:**
- `src/lib/auth.ts` - Add production env validation
- `src/app/api/cron/*` - Routes using CRON_SECRET
- `src/app/api/webhooks/razorpay` - Route using RAZORPAY_WEBHOOK_SECRET

**Implementation:**
```typescript
export async function requireAuth(allowedRoles?: UserRole[]): Promise<JWTPayload> {
  // Existing auth logic...
  
  // NEW: Production-only secret validation
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.CRON_SECRET?.trim()) {
      throw new Error('CRON_SECRET not configured in production');
    }
    if (!process.env.RAZORPAY_WEBHOOK_SECRET?.trim()) {
      throw new Error('RAZORPAY_WEBHOOK_SECRET not configured in production');
    }
  }
  
  return payload;
}
```

**Why Important:**
- ❌ **Before:** Missing secrets silently fail in production
- ✅ **After:** Missing secrets caught at runtime with clear error
- **Impact:** Prevents "app works locally but fails in prod" issues

**Testing:**
- [ ] Verify error thrown when secret missing in production
- [ ] Verify local dev works without secrets
- [ ] Verify test suite unaffected

---

### P2-8: Audit Historical Difficulty Data ✅ READY

**Status:** ⏳ READY TO START | No blockers  
**Effort:** 1-2 hours (+ recovery time if needed)  
**Priority:** MEDIUM (analytics/data integrity)

**Background:**
- Old migration dropped/recreated `sessions.difficulty` column
- Some historical difficulty data may be lost
- Need to assess damage and recovery plan

**Investigation Steps:**

1. **Count Affected Sessions**
   ```sql
   SELECT COUNT(*) as affected_sessions
   FROM sessions 
   WHERE difficulty IS NULL 
   AND created_at < '2026-06-01';
   ```

2. **Check Backup Availability**
   - Database backup before difficulty drop
   - Can data be restored?
   - Timeline for recovery?

3. **Document Findings**
   - [ ] How many sessions lost difficulty data?
   - [ ] Percentage of total sessions?
   - [ ] Recoverable or permanent loss?

4. **Recovery Plan**
   - [ ] If backup available: restore from snapshot
   - [ ] If not available: document intentional loss
   - [ ] Update schema comments
   - [ ] Prevent future similar migrations

**Output:**
- Document: `DIFFICULTY_DATA_AUDIT.md`
- Impact assessment: X sessions affected
- Recovery status: [restored/unrecoverable/partial]

---

### P2-7: Define Admin Provisioning 📋 BACKLOG

**Status:** 📋 BACKLOG | Lower priority  
**Effort:** 0.5 day  
**Priority:** LOW-MEDIUM (operational, not user-facing)

**What's Needed:**
- `ADMIN_EMAILS` exists but no provisioning workflow
- Need safe admin creation process
- Need admin removal/rotation documented

**Implementation:**

1. **Add Admin Seed Script**
   ```bash
   # scripts/seed-admin.ts
   node scripts/seed-admin.ts admin@example.com
   ```

2. **Protected Admin Route** (optional)
   ```
   POST /api/admin/provision-admin
   Body: { email: "new-admin@example.com" }
   (Only callable by existing admin with secret key)
   ```

3. **Audit Admin-Only Paths**
   - [ ] List all routes requiring ADMIN role
   - [ ] Document security model
   - [ ] Verify role checks in place

4. **Documentation**
   - How to create first admin (seed script)
   - How to add additional admins (API or script)
   - How to remove admin (revoke role)
   - How to audit admin actions

**When to Do:** After P0, P2-6, P2-8 complete

---

## 🔵 P3 - FUTURE IMPROVEMENTS (BACKLOG)

### P3-9: Strengthen Rate Limiting With Redis/Upstash

**Status:** 📋 BACKLOG | Optional  
**Effort:** 0.5 day  
**Priority:** LOW (current DB limiter works)

**What:**
- Current: Database-backed rate limiter
- Proposal: Redis/Upstash for faster response
- Benefit: Better under high attack volume

**When:** After all P0, P1, P2 items

---

### P3-10: Prompt-Injection Regression Fixtures

**Status:** 📋 BACKLOG | Optional  
**Effort:** 0.5 day  
**Priority:** LOW (prompts already hardened)

**What:**
- Add fixtures for malicious transcript testing
- Verify prompt wrappers used correctly
- Regression test for future edits

**When:** After all P0, P1, P2 items

---

## 📊 Completion Status Chart

```
P0: Operational [████░░░░░░] 0% (Must do before launch)
    ├─ Migrations: ⏳ Pending
    ├─ Secrets: ⏳ Pending  
    ├─ Webhook config: ⏳ Pending
    ├─ Smoke tests: ⏳ Pending
    └─ Cron revert: ⏳ Pending

P1: High Risk [████████░░] 80% (3 complete, 1 optional)
    ├─ Replace WebRTC: ✅ Foundation (append-only done, LiveKit optional)
    ├─ Email jobs: ✅ Complete
    ├─ CSRF defense: ✅ Complete
    └─ Observability: ✅ Complete

P2: Medium Risk [██████░░░░] 60% (1 complete, 2 ready, 1 backlog)
    ├─ Money/Auth tests: ✅ Complete
    ├─ Env hard fail: ⏳ Ready (1-2 hr)
    ├─ Difficulty audit: ⏳ Ready (1-2 hr)
    └─ Admin provisioning: 📋 Backlog (0.5 day)

P3: Future [░░░░░░░░░░] 0%
    ├─ Redis rate limiting: 📋 Backlog
    └─ Prompt injection tests: 📋 Backlog
```

---

## 🎯 Recommended Execution Order

### **Phase 1 - LAUNCH PREP (TODAY/TOMORROW)**
Priority: 🔴 CRITICAL - Must do before production deploy

1. **P0: Apply Migrations & Set Secrets** (1-2 hr)
   - `npx prisma db push` (includes SignalingEvent)
   - Set CRON_SECRET, RAZORPAY_WEBHOOK_SECRET, SENTRY_DSN
   - Configure Razorpay webhook URL

2. **P0: Smoke Test** (1 hr)
   - One subscription payment
   - Feature unlock
   - Logout validation
   - Cron trigger
   - ✅ All pass → Ready for production

### **Phase 2 - POLISH (NEXT DAY)**
Priority: 🟡 HIGH - Recommended before users access

1. **P2-6: Env Hard Fail** (1-2 hr)
   - Add runtime validation for missing secrets
   - Test in staging
   
2. **P2-8: Difficulty Audit** (1-2 hr)
   - Investigate missing data
   - Document findings
   - Plan recovery if possible

### **Phase 3 - OPTIMIZATION (FUTURE)**
Priority: 🟢 LOW - Can do after launch

1. **P1-1: Full LiveKit Migration** (2-5 days)
   - Foundation already ready
   - Gradual rollout recommended
   - Keep Postgres fallback for safety

2. **P2-7: Admin Provisioning** (0.5 day)
   - Seed script for first admin
   - Documented workflow

3. **P3: Redis Limiter & Tests** (1 day)
   - Backlog items, low priority

---

## ✅ Pre-Launch Verification

### Code Level
- [x] All tests passing (38/38)
- [x] Build clean
- [x] No TypeScript errors
- [x] Prisma schema valid
- [ ] Migrations ready to apply

### Operational
- [ ] CRON_SECRET generated
- [ ] RAZORPAY_WEBHOOK_SECRET configured
- [ ] SENTRY_DSN obtained
- [ ] Razorpay webhook configured
- [ ] Staging env ready for smoke tests

### Deployment
- [ ] Production database backed up
- [ ] Rollback plan documented
- [ ] Smoke test procedures documented
- [ ] On-call support briefed

---

## 📋 Remaining Work Summary

**Must Complete Before Launch:**
- ⏳ Apply Prisma migrations (SignalingEvent table)
- ⏳ Configure production secrets (CRON, RAZORPAY, SENTRY)
- ⏳ Setup Razorpay webhook
- ⏳ Smoke test all critical flows

**Strongly Recommended (1-2 days after launch):**
- ⏳ Add env validation (hard fail on missing secrets)
- ⏳ Audit difficulty data (assess data loss)

**Optional (Can do later):**
- 📋 Full LiveKit migration (foundation ready)
- 📋 Admin provisioning workflow
- 📋 Redis rate limiting
- 📋 Prompt injection tests

---

## 🚀 Launch Timeline

**Today (1-2 hours):**
1. Apply migrations
2. Set secrets
3. Configure webhook
4. Run smoke tests
5. ✅ Deploy to production

**Tomorrow (2-3 hours):**
1. Add env validation
2. Audit difficulty data
3. Monitor production
4. ✅ Production stable

**This Week (if time):**
1. Plan LiveKit migration
2. Prepare gradual rollout strategy

---

**Report Generated:** 2026-06-23 21:16 UTC+5:30  
**Overall Readiness:** 64% Code-Complete, Pending Operations (P0)  
**Can Launch:** Yes, after P0 checklist complete
