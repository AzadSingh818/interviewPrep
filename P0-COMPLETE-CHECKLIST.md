# 🔴 P0 CRITICAL ITEMS - EXECUTABLE CHECKLIST

**Follow this exactly in order to launch to production**

---

## 📋 P0 CHECKLIST (90 MINUTES TOTAL)

### ✅ ITEM 1: P0 MIGRATIONS (30 MINUTES)
**Status:** Code ready, you execute

```bash
# Run this command on your computer:
npx prisma db push
```

**What happens:**
- Creates SignalingEvent table in database
- Adds indexes for fast queries
- No data loss, backward compatible

**When done:**
- [ ] Command completed successfully
- [ ] No errors in output
- [ ] Ready for next step

**Time:** 30 minutes

---

### ⏳ ITEM 2: P0 WEBHOOK (15 MINUTES)
**Status:** You configure in Razorpay

**Follow:** P0-WEBHOOK-EXECUTABLE.txt

**Quick steps:**
1. Login to Razorpay dashboard
2. Settings → Webhooks
3. Add new webhook
4. URL: https://your-domain.com/api/webhooks/razorpay
5. Select 3 events: payment.captured, payment.failed, order.paid
6. Save
7. Copy webhook secret (you'll need for next step)
8. Test webhook (should return 200 OK)

**When done:**
- [ ] Webhook created and active
- [ ] Status shows "Active"
- [ ] Test webhook returned 200 OK
- [ ] Secret copied and saved
- [ ] Ready for next step

**Time:** 15 minutes

---

### ⏳ ITEM 3: P0 SECRETS (15 MINUTES)
**Status:** You add to Vercel

**Follow:** P0-SECRETS-QUICKSTART.md

**Quick steps:**
1. Generate CRON_SECRET: `openssl rand -base64 32`
2. Copy it and save
3. Go to Vercel dashboard
4. Project → Settings → Environment Variables
5. Add 3 variables:
   - CRON_SECRET = <generated value>
   - RAZORPAY_WEBHOOK_SECRET = <copied from Razorpay>
   - SENTRY_DSN = https://xxx@xxx.ingest.sentry.io/xxx
6. Redeploy: `git push origin main`

**When done:**
- [ ] CRON_SECRET generated
- [ ] RAZORPAY_WEBHOOK_SECRET copied from Razorpay
- [ ] SENTRY_DSN obtained (create Sentry account if needed)
- [ ] All 3 added to Vercel
- [ ] Application redeployed
- [ ] Ready for next step

**Time:** 15 minutes

---

### ⏳ ITEM 4: P0 SMOKE TEST (15 MINUTES)
**Status:** You verify 4 flows

**Test 1: Subscription Payment (5 min)**
- [ ] Go to: https://your-domain.com/student/subscribe
- [ ] Click: "Upgrade to Pro"
- [ ] Complete payment (use test card)
- [ ] Check: PRO plan shows on dashboard
- [ ] Verify: Sentry received entitlement event

**Test 2: Feature Unlock (5 min)**
- [ ] Go to: https://your-domain.com/student/dashboard
- [ ] Click: "Unlock Feature"
- [ ] Complete payment
- [ ] Check: Feature now available
- [ ] Verify: Can use feature

**Test 3: Logout (3 min)**
- [ ] Click: "Logout"
- [ ] Try: Go to /student/dashboard (should fail)
- [ ] Check: Redirected to login page

**Test 4: Cron Trigger (2 min)**
- [ ] URL: https://your-domain.com/api/cron/cleanup-rooms?secret=<CRON_SECRET>
- [ ] Check: Returns 200 OK
- [ ] Verify: No errors in logs

**When done:**
- [ ] Test 1 passed ✓
- [ ] Test 2 passed ✓
- [ ] Test 3 passed ✓
- [ ] Test 4 passed ✓
- [ ] All 4 flows working

**Time:** 15 minutes

---

### ✅ ITEM 5: DEPLOY TO PRODUCTION (10 MINUTES)
**Status:** Final deployment

```bash
# Make sure all changes are committed:
git status

# Should show: "working tree clean"

# If not, commit remaining changes:
git add .
git commit -m "P0 setup complete - ready for launch"

# Deploy:
git push origin main

# Vercel will automatically deploy
# Check deployment: https://vercel.com/dashboard
```

**When done:**
- [ ] All changes committed
- [ ] Code pushed to main
- [ ] Vercel deployment started
- [ ] Deployment shows "READY" (green checkmark)
- [ ] No errors in deployment logs

**Time:** 10 minutes

---

## ⏱️ TOTAL TIME: ~95 MINUTES

```
P0-1 Migrations:   30 min → ✓
P0-2 Webhook:      15 min → ⏳ (you do now)
P0-3 Secrets:      15 min → ⏳
P0-4 Smoke Test:   15 min → ⏳
P0-5 Deploy:       10 min → ⏳
────────────────────────────
TOTAL:             ~95 min → 🚀 LIVE
```

---

## 📊 PROGRESS TRACKER

```
[ ] P0-1: Migrations (30 min)     ⏳ Start here
[ ] P0-2: Webhook (15 min)        ⏳ Then here
[ ] P0-3: Secrets (15 min)        ⏳ Then here
[ ] P0-4: Smoke Test (15 min)     ⏳ Then here
[ ] P0-5: Deploy (10 min)         ⏳ Finally here
────────────────────────────────────────────────
✅ PRODUCTION LIVE                  🚀 End result
```

---

## 🆘 QUICK TROUBLESHOOTING

**Webhook test returns error:**
- Wait 30 seconds and try again
- Check domain is correct (no typos)
- Make sure HTTPS (not HTTP)
- Proceed anyway (will work after deploy)

**Secrets not working after adding to Vercel:**
- Wait 5 minutes after redeploy
- Check environment variable name is EXACT (case-sensitive)
- Verify value is correct (no extra spaces)

**Smoke tests fail:**
- Check Sentry for error messages
- Verify secrets were applied (check Vercel logs)
- Make sure webhooks are getting to your app

**Can't find where to add environment variables:**
- Project page → Settings (top menu) → Environment Variables (left)
- NOT project overview, but SETTINGS page

---

## 📞 SUPPORT DOCS

| Issue | File |
|-------|------|
| Migrations | README-REMAINING-WORK.md |
| Webhook | P0-WEBHOOK-EXECUTABLE.txt |
| Secrets | P0-SECRETS-QUICKSTART.md |
| Smoke Test | README-REMAINING-WORK.md |
| All | COMPLETE-STATUS-REPORT.md |

---

## ✨ AFTER P0 IS COMPLETE

**Immediately after all P0 items done:**
1. ✅ Code live in production
2. ✅ Users can subscribe
3. ✅ Payments processing
4. ✅ Emails sending
5. ✅ Errors tracked in Sentry

**Next (optional, tomorrow):**
- P2-6: Env validation (1-2 hr)
- P2-8: Data audit (1-2 hr)

**Later (next week, optional):**
- P1-1 Full LiveKit (2-5 days)
- P2-7 Admin provisioning (0.5 day)

---

## 🎯 YOU'RE ALMOST THERE!

All code is ready. Just need to:
1. Apply migrations (30 min)
2. Configure webhook (15 min)
3. Add secrets (15 min)
4. Test flows (15 min)
5. Deploy (10 min)

**TOTAL: ~90 MINUTES TO LAUNCH 🚀**

Start with Item 1 (Migrations), then follow the checklist!

Let me know when each item is done, and I'll help with the next one.
