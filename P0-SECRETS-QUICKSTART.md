# ⚡ P0 SECRETS - 15-MINUTE QUICKSTART

**Time:** 15 minutes  
**Difficulty:** Easy  
**Status:** Ready Now ✅

---

## 🎯 WHAT TO DO IN 15 MINUTES

### STEP 1: Generate CRON_SECRET (1 minute)

**On your computer:**
```bash
openssl rand -base64 32
```

**You'll get something like:**
```
aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890AbCdE=
```

**Copy this value** ← You'll need it in Step 4

---

### STEP 2: Get RAZORPAY_WEBHOOK_SECRET (3 minutes)

1. Go to: https://dashboard.razorpay.com
2. Click: Settings (bottom left)
3. Click: Webhooks
4. Find your webhook (ending with `/api/webhooks/razorpay`)
5. Click on it
6. **Copy the Secret** value
7. Keep this safe ← You'll need it in Step 4

---

### STEP 3: Get SENTRY_DSN (5 minutes)

1. Go to: https://sentry.io
2. Sign in (or create free account)
3. Create/Select Project: "InterviewPrep"
4. Go to: Settings → Client Keys (DSN)
5. **Copy the DSN** (looks like: `https://xxx@xxx.ingest.sentry.io/123`)
6. Keep this safe ← You'll need it in Step 4

---

### STEP 4: Add All 3 to Vercel (6 minutes)

1. Go to: https://vercel.com/dashboard
2. Select your project
3. Click: Settings (top menu)
4. Click: Environment Variables (left sidebar)

**Add CRON_SECRET:**
- Name: `CRON_SECRET`
- Value: `<paste-from-step-1>`
- Click: Save

**Add RAZORPAY_WEBHOOK_SECRET:**
- Name: `RAZORPAY_WEBHOOK_SECRET`
- Value: `<paste-from-step-2>`
- Click: Save

**Add SENTRY_DSN:**
- Name: `SENTRY_DSN`
- Value: `<paste-from-step-3>`
- Click: Save

---

### STEP 5: Redeploy (no time needed)

```bash
git push origin main
```

Or in Vercel: Click "Redeploy" button

---

## ✅ DONE!

When complete:
- [ ] Generated CRON_SECRET
- [ ] Copied RAZORPAY_WEBHOOK_SECRET
- [ ] Copied SENTRY_DSN
- [ ] Added all 3 to Vercel
- [ ] Redeployed

**Status: ✅ P0 SECRETS COMPLETE**

---

## 🆘 QUICK HELP

**Don't have Razorpay webhook yet?**  
→ Do P0 Webhook first (it's next)

**Don't have Sentry account?**  
→ Create free at sentry.io (takes 2 min)

**Can't find Settings in Vercel?**  
→ Project page → Settings (top menu bar)

**Still stuck?**  
→ Read: P0-SECRETS-CONFIGURATION.md (detailed guide)

---

## 🎉 AFTER THIS

- ✅ Secrets configured
- Next: P0 Smoke Test (15 min)
- Then: Launch to Production 🚀

---

**Total P0 time left:** ~45 minutes (migrations + smoke test)
